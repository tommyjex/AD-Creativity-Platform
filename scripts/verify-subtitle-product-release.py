"""Verify the installed and isolated vendor wheel without source-path shadowing."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".trae/specs/recognize-and-style-product-names/evidence"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--isolated", action="store_true")
    args = parser.parse_args()
    if args.isolated:
        sys.path.insert(0, str(ROOT / ".venv/subtitle-wheel-verification-0.3.1"))
    import video_subtitle_grounding as package
    from video_subtitle_grounding import layout
    from video_subtitle_grounding.product_names import PRODUCT_CATALOG, validated_mentions

    imported = Path(package.__file__).resolve()
    assert "standalone" not in str(imported)
    assert package.__version__ == "0.3.1"
    assert layout.LAYOUT_VERSION == "single-line-adaptive-panel35-product-font-v3"
    assert len(PRODUCT_CATALOG) == 72
    name = "FLOOR ONE S10 Stretch Steam"
    assert validated_mentions(name, [{
        "start": 0, "end": len(name), "model": "FLOOR ONE S10", "spec": "Stretch Steam",
        "origin": "model_pattern",
    }])[0]["catalog_id"] is None
    wheel = ROOT / "vendor/video_subtitle_grounding-0.3.1-py3-none-any.whl"
    source = ROOT / "exports/video-subtitle-grounding-0.3.1-source.tar.gz"
    with zipfile.ZipFile(wheel) as archive:
        names = archive.namelist()
        assert "video_subtitle_grounding/product_names.py" in names
        assert "video_subtitle_grounding/product_layout.py" in names
        assert all(name.endswith((".py", "/METADATA", "/WHEEL", "/top_level.txt", "/RECORD"))
                   for name in names)
        for name in names:
            if name.endswith(".py"):
                current = ROOT / "standalone/video-subtitle-grounding/src" / name
                assert archive.read(name) == current.read_bytes(), name
    with tarfile.open(source) as archive:
        names = archive.getnames()
        assert all(not name.endswith((".key", ".pem", ".log", ".mp4", ".png", "/.env"))
                   and "__pycache__" not in name and "/.git/" not in name for name in names)
    result = {
        "mode": "isolated" if args.isolated else "installed",
        "imported_from": str(imported), "version": package.__version__,
        "layout_version": layout.LAYOUT_VERSION,
        "wheel_sha256": hashlib.sha256(wheel.read_bytes()).hexdigest(),
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "wheel_sources_match": True, "catalog_entries": 72, "result": "passed",
    }
    (OUT / f'release-{result["mode"]}.json').write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
