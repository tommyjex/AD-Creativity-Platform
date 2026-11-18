"""Verify the installed and isolated vendor wheel without source-path shadowing."""
import argparse
import asyncio
from email.parser import BytesParser
import hashlib
from importlib import metadata
from io import BytesIO
import json
from pathlib import Path
import sys
import tarfile
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.3.8"
LAYOUT_VERSION = "single-line-png-text-default-background-v8"
ENCODING_POLICY_VERSION = "configurable-crf-h264-v3"
DICTIONARY_VERSION = "tineco-names-20261116-v1"


def verify_policy(font_dir):
    import httpx
    from PIL import Image, ImageChops, ImageDraw
    from video_subtitle_grounding import layout
    from video_subtitle_grounding.product_names import text_fingerprint
    from video_subtitle_grounding.mediakit import MultiTrackTask
    from video_subtitle_grounding.render import SubtitleRenderService

    fonts = {
        layout.FONT_RESOURCES["AvenirLTStdBlack"]: font_dir / "AvenirLTStd-Black.otf",
        layout.FONT_RESOURCES["AvenirLTStdLight"]: font_dir / "AvenirLTStd-Light.otf",
        layout.FONT_RESOURCES["CenturyGothic"]: font_dir / "centurygothic.ttf",
        layout.FONT_RESOURCES["CenturyGothicBold"]: font_dir / "centurygothic_bold.ttf",
    }
    original_client = httpx.Client

    def respond(request):
        path = fonts[str(request.url)]
        return httpx.Response(200, content=path.read_bytes())

    layout.httpx.Client = lambda **kwargs: original_client(
        **kwargs, transport=httpx.MockTransport(respond)
    )
    layout._load_font_resource.cache_clear()
    video = {
        "width": 1280, "height": 720, "duration_ms": 4500, "fps": 30,
        "has_audio": False, "source_url": "https://fixture.example/video.mp4",
        "video_bit_rate": 7000000,
    }
    name = "FLOOR ONE i5 Lite"
    base = {
        "segment_id": "sample", "translated_text": name,
        "start_ms": 1000, "end_ms": 3000, "bbox_normalized": [62, 111, 859, 208],
        "product_mentions": [{
            "start": 0, "end": len(name), "model": "FLOOR ONE i5", "spec": "Lite",
            "origin": "model_pattern",
        }],
        "product_text_sha256": text_fingerprint(name),
    }
    cases = 0
    ids = {}
    try:
        for category in ("product", "unboxing", None):
            runtime = {**video, **({"video_category": category} if category else {})}
            for background in ("#FFFFFF", "#000000", "#888888", None):
                for panel in (None, "#FF000080", "#00000000"):
                    for role in ("headline", "body", "footnote"):
                        for mixed in (False, True):
                            style = {} if panel is None else {"background_color": panel}
                            segment = {
                                **base, "background_color": background, "style": style,
                                "visual_role": role, "product_names_enabled": mixed,
                            }
                            compiled = layout.compile_subtitle_project([segment], runtime)
                            assert compiled["project"]["output"]["codec"] == {"video_codec": "h264", "crf": 16}
                            assert compiled["render_mode"] == compiled["effective_render_mode"] == "png"
                            summary = compiled["layouts"]["sample"]
                            assert summary["render_mode"] == summary["effective_render_mode"] == "png"
                            native = layout.compile_subtitle_project(
                                [segment], {**runtime, "render_mode": "text"})
                            native_summary = native["layouts"]["sample"]
                            element = native["project"]["track"][1][0]
                            assert not native["layers"]
                            assert native["render_mode"] == native["effective_render_mode"] == "text"
                            assert native_summary["render_mode"] == native_summary["effective_render_mode"] == "text"
                            assert element["type"] == "text"
                            assert element["bold"] is (role != "headline")
                            assert native["project"]["output"]["codec"] == {"video_codec": "h264", "crf": 16}
                            assert ("text_product_font_fallback" in native_summary["warnings"]) is mixed
                            for key in ("background_color", "text_color", "target_time"):
                                assert native_summary[key] == summary[key], key
                            if role == "footnote":
                                assert native_summary["effective_font_size_px"] == 24
                            cases += 1
                            expected = "#00000000" if category == "product" else (
                                panel if panel is not None else (
                                    "#00000000" if background in ("#FFFFFF", "#000000")
                                    else "#33333359"
                                )
                            )
                            assert summary["background_color"] == expected
                            if category == "product":
                                assert summary["text_color"] == (
                                    "#000000FF" if background == "#FFFFFF" else "#FFFFFFFF"
                                )
                            if compiled["layers"]:
                                assert compiled["project"]["track"][1][0]["type"] == "image"
                                assert "bold" not in compiled["project"]["track"][1][0]
                                layer = compiled["layers"][summary["render_layer_asset_id"]]
                                png = Image.open(BytesIO(layer["content"])).convert("RGBA")
                                if expected[-2:] == "00":
                                    text_only = Image.new("RGBA", (png.width * 4, png.height * 4))
                                    draw = ImageDraw.Draw(text_only)
                                    for run in summary["text_runs"]:
                                        resource = layout._load_font_resource(run["font_type"])
                                        draw.text(
                                            (run["x_px"] * 4, run["baseline_px"] * 4), run["text"],
                                            font=resource.font(run["font_size_px"] * 4),
                                            fill=summary["text_color"], anchor="ls",
                                        )
                                    text_only = text_only.convert("RGBa").resize(
                                        png.size, Image.Resampling.LANCZOS).convert("RGBA")
                                    assert ImageChops.difference(png, text_only).getbbox(
                                        alpha_only=False
                                    ) is None
                                else:
                                    panel_pixel = tuple(
                                        int(expected[index:index + 2], 16)
                                        for index in (1, 3, 5, 7)
                                    )
                                    pixels = dict((pixel, count) for count, pixel in
                                                  png.getcolors(png.width * png.height))
                                    assert pixels.get(panel_pixel, 0) > 100
                                if mixed:
                                    ids[(category, background, panel, role)] = layer["id"]
                                if role == "footnote":
                                    assert summary["effective_font_size_px"] == 24
                                assert summary["raster_scale"] == 4
                            else:
                                raise AssertionError("Default subtitle must use PNG")
                            cases += 1
            colored = {**base, "style": {"text_color": "#FF0000", "background_color": "#FFFFFFFF"}}
            assert layout.compile_subtitle_project([colored], runtime)["layouts"]["sample"]["text_color"] == "#FF0000FF"
            cases += 1

            class Client:
                async def submit(self, **kwargs):
                    assert kwargs["project"]["output"]["codec"] == {"video_codec": "h264", "crf": 16}
                    element = kwargs["project"]["track"][1][0]
                    assert element["type"] == "text"
                    assert element["bold"] is (self.role != "headline")
                    assert "background_color" not in element
                    assert "background_color" not in kwargs["project"]["canvas"]
                    return MultiTrackTask(task_id="offline-fixture", status="queued")

            renderer = SubtitleRenderService(client=Client())
            for role in ("headline", "body", "footnote", None, "legacy"):
                renderer.client.role = role
                result = asyncio.run(renderer.submit(
                    [{**base, "visual_role": role}], runtime,
                    idempotency_key=f"offline-fallback-{role}",
                ))
                assert result["render_mode"] == "png"
                assert result["effective_render_mode"] == "text"
                assert result["encoding_policy_version"] == ENCODING_POLICY_VERSION
                cases += 1
                result = asyncio.run(renderer.submit(
                    [{**base, "visual_role": role}], {**runtime, "render_mode": "text"},
                    idempotency_key=f"offline-text-{role}",
                ))
                assert result["render_mode"] == result["effective_render_mode"] == "text"
                cases += 1
        for mode in ("png", "text"):
            for bitrate in (7000, 7000000, None, 0, -1, "invalid", True):
                runtime = {**video, "render_mode": mode, "video_bit_rate": bitrate}
                compiled = layout.compile_subtitle_project([base], runtime)
                assert compiled["project"]["output"] == {
                    "format": "mp4", "fps": 30, "disable_audio": True,
                    "codec": {"video_codec": "h264", "crf": 16},
                }
                assert "source_video_bit_rate_unavailable" not in compiled["warnings"]
                cases += 1
            runtime = {key: value for key, value in runtime.items() if key != "video_bit_rate"}
            assert layout.compile_subtitle_project([base], runtime)["project"]["output"]["codec"] == {
                "video_codec": "h264", "crf": 16}
            cases += 1
        for mode in ("png", "text"):
            for category in ("product", "unboxing"):
                for panel in (None, "#FF000080"):
                    layers = None
                    for crf in (0, 12, 16, 30):
                        compiled = layout.compile_subtitle_project(
                            [{**base, "background_color": "#888888",
                              "style": {} if panel is None else {"background_color": panel}}],
                            {**video, "render_mode": mode, "video_category": category, "crf": crf})
                        project = compiled["project"]
                        assert project["output"]["codec"] == {"video_codec": "h264", "crf": crf}
                        assert "background_color" not in project["canvas"]
                        assert all("background_color" not in element
                                   for track in project["track"] for element in track
                                   if element["type"] == "text")
                        if layers is not None:
                            assert compiled["layers"] == layers
                        layers = compiled["layers"]
                        cases += 1
        for background in ("#FFFFFF", "#000000", "#888888", None):
            for panel in (None, "#FF000080", "#00000000"):
                for role in ("headline", "body", "footnote"):
                    assert ids[("product", background, panel, role)] != ids[("unboxing", background, panel, role)]
                    assert ids[(None, background, panel, role)] == ids[("unboxing", background, panel, role)]
        return {
            "policy_cases": cases, "category_cache_isolation": True,
            "nonheadline_text_bold": True, "image_has_no_bold": True,
            "render_modes": ["png", "text"], "video_codec": "h264", "crf_values": [0, 12, 16, 30],
            "canvas_text_background_omitted": True, "png_panels_preserved": True,
            "encoding_policy_version": ENCODING_POLICY_VERSION,
            "video_bit_rate_omitted": True, "requested_effective_fallback_tracking": True,
            "real_font_sha256": {
                path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                for path in fonts.values()
            },
            "real_model_called": False, "real_mediakit_called": False,
        }
    finally:
        layout.httpx.Client = original_client
        layout._load_font_resource.cache_clear()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--isolated", action="store_true")
    parser.add_argument(
        "--isolated-target", type=Path,
        default=ROOT / f".venv/subtitle-wheel-verification-{VERSION}",
    )
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--font-dir", type=Path, default=Path("/tmp/subtitle-role-real-fonts"))
    args = parser.parse_args()
    if args.isolated:
        sys.path.insert(0, str(args.isolated_target.resolve()))
    import video_subtitle_grounding as package
    from video_subtitle_grounding import layout
    from video_subtitle_grounding.product_names import (
        CATALOG_VERSION, PRODUCT_CATALOG, validated_mentions,
    )

    imported = Path(package.__file__).resolve()
    assert "standalone" not in str(imported)
    install_root = args.isolated_target.resolve() if args.isolated else Path(sys.prefix).resolve()
    assert imported.is_relative_to(install_root), imported
    assert package.__version__ == VERSION
    assert metadata.version("video-subtitle-grounding") == VERSION
    assert layout.LAYOUT_VERSION == LAYOUT_VERSION
    assert layout.ENCODING_POLICY_VERSION == ENCODING_POLICY_VERSION
    assert CATALOG_VERSION == DICTIONARY_VERSION
    assert len(PRODUCT_CATALOG) == 72
    assert f"./vendor/video_subtitle_grounding-{VERSION}-py3-none-any.whl" in (
        ROOT / "requirements.txt"
    ).read_text().splitlines()
    name = "FLOOR ONE S10 Stretch Steam"
    assert validated_mentions(name, [{
        "start": 0, "end": len(name), "model": "FLOOR ONE S10", "spec": "Stretch Steam",
        "origin": "model_pattern",
    }])[0]["catalog_id"] is None
    wheel = ROOT / f"vendor/video_subtitle_grounding-{VERSION}-py3-none-any.whl"
    source = ROOT / f"exports/video-subtitle-grounding-{VERSION}-source.tar.gz"
    sdist = ROOT / f"vendor/video_subtitle_grounding-{VERSION}.tar.gz"
    assert source.read_bytes() == sdist.read_bytes()
    source_files = {}
    source_content_paths = []
    with zipfile.ZipFile(wheel) as archive:
        names = archive.namelist()
        wheel_metadata = BytesParser().parsebytes(archive.read(
            f"video_subtitle_grounding-{VERSION}.dist-info/METADATA"
        ))
        assert wheel_metadata["Version"] == VERSION
        assert "video_subtitle_grounding/product_names.py" in names
        assert "video_subtitle_grounding/product_layout.py" in names
        assert all(name.endswith((".py", "/METADATA", "/WHEEL", "/top_level.txt", "/RECORD"))
                   for name in names)
        for name in names:
            if name.endswith(".py"):
                current = ROOT / "standalone/video-subtitle-grounding/src" / name
                assert archive.read(name) == current.read_bytes(), name
                assert archive.read(name) == (imported.parent.parent / name).read_bytes(), name
                source_files[name] = archive.read(name)
    with tarfile.open(source) as archive:
        names = archive.getnames()
        prefix = f"video_subtitle_grounding-{VERSION}"
        source_metadata = BytesParser().parsebytes(
            archive.extractfile(f"{prefix}/PKG-INFO").read()
        )
        assert source_metadata["Version"] == VERSION
        source_project = tomllib.loads(
            archive.extractfile(f"{prefix}/pyproject.toml").read().decode()
        )
        assert source_project["project"]["version"] == VERSION
        assert all(not name.endswith((".key", ".pem", ".log", ".mp4", ".png", "/.env"))
                   and "__pycache__" not in name and "/.git/" not in name for name in names)
        for name, content in source_files.items():
            members = [member for member in archive.getmembers()
                       if member.name.endswith("/src/" + name)]
            assert len(members) == 1, name
            assert archive.extractfile(members[0]).read() == content, name
        source_root = ROOT / "standalone/video-subtitle-grounding"
        for member in archive.getmembers():
            if not member.isfile():
                continue
            relative = Path(member.name).relative_to(prefix)
            if relative.name in ("PKG-INFO", "setup.cfg") or any(
                part.endswith(".egg-info") for part in relative.parts
            ):
                continue
            current = source_root / relative
            assert current.is_file(), relative
            assert archive.extractfile(member).read() == current.read_bytes(), relative
            source_content_paths.append(str(relative))
    policy = verify_policy(args.font_dir)
    result = {
        "mode": "isolated" if args.isolated else "installed",
        "imported_from": str(imported), "version": package.__version__,
        "layout_version": layout.LAYOUT_VERSION,
        "dictionary_version": CATALOG_VERSION,
        "wheel_sha256": hashlib.sha256(wheel.read_bytes()).hexdigest(),
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "sdist_sha256": hashlib.sha256(sdist.read_bytes()).hexdigest(),
        "wheel_sources_match": True, "source_archive_matches": True,
        "source_paths": sorted(source_files), "catalog_entries": 72,
        "source_content_paths": sorted(source_content_paths),
        "source_contents_match": True,
        **policy, "result": "passed",
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / f'release-{result["mode"]}.json').write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
