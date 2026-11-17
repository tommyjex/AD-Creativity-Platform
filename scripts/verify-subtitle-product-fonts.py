"""Offline product typography evidence using the specified real font binaries."""
import hashlib
import json
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw

from video_subtitle_grounding import layout
from video_subtitle_grounding.product_names import PRODUCT_CATALOG, text_fingerprint

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".trae/specs/recognize-and-style-product-names/evidence"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    font_info = {}
    for identifier in ("AvenirLTStdBlack", "AvenirLTStdLight", "CenturyGothicBold"):
        resource = layout._load_font_resource(layout.FONT_RESOURCES[identifier])
        font_info[identifier] = {
            "url": resource.url, "sha256": resource.sha256, "bytes": len(resource.content),
            "font_name": list(resource.font(32).getname()),
        }
    examples = [dict(entry) for entry in PRODUCT_CATALOG]
    examples.extend([
        {"text": "FLOOR ONE i5 Lite", "model": "FLOOR ONE i5", "spec": "Lite"},
        {"text": "FLOOR ONE S10 Stretch Steam", "model": "FLOOR ONE S10", "spec": "Stretch Steam"},
        {"text": "Try FLOOR ONE i5 Lite today", "model": "FLOOR ONE i5", "spec": "Lite"},
        {"text": "新品 FLOOR ONE i5 Lite", "model": "FLOOR ONE i5", "spec": "Lite"},
    ])
    rows, records = [], []
    for index, entry in enumerate(examples):
        text = entry["text"]
        name = f'{entry["model"]} {entry["spec"]}'.strip()
        start = text.index(name)
        segment = {
            "segment_id": f"sample-{index}", "translated_text": text,
            "start_ms": 1000, "end_ms": 3000, "block_id": str(index),
            "bbox_normalized": [62, 111, 859, 208], "visual_role": "headline",
            "style": {"background_color": "#00000000"},
            "product_mentions": [{"start": start, "end": start + len(name),
                                  "model": entry["model"], "spec": entry["spec"],
                                  "origin": "manual", "status": "confirmed"}],
            "product_text_sha256": text_fingerprint(text),
        }
        compiled = layout.compile_subtitle_project([segment], {
            "width": 1280, "height": 720, "duration_ms": 4500, "fps": 30,
            "has_audio": False, "source_url": "https://fixture.example/video.mp4",
        })
        summary = compiled["layouts"][segment["segment_id"]]
        assert len({r["baseline_px"] for r in summary["text_runs"]}) == 1
        assert len({r["font_size_px"] for r in summary["text_runs"]}) == 1
        assert "".join(r["text"] for r in summary["text_runs"]) == text
        layer = compiled["layers"][summary["render_layer_asset_id"]]
        png = Image.open(BytesIO(layer["content"])).convert("RGBA")
        alpha_box = png.getchannel("A").getbbox()
        assert alpha_box and alpha_box[0] > 0 and alpha_box[1] > 0
        assert alpha_box[2] < png.width and alpha_box[3] < png.height
        assert 0 in png.getchannel("A").getdata()
        assert any(0 < value < 255 for value in png.getchannel("A").getdata())
        for run in summary["text_runs"]:
            resource = layout._load_font_resource(run["font_type"])
            assert all(char.isspace() or ord(char) in resource.codepoints for char in run["text"])
            expected = layout.FONT_RESOURCES[
                "AvenirLTStdBlack" if run["kind"] == "product_model" else
                "AvenirLTStdLight" if run["kind"] == "product_spec" else "CenturyGothicBold"]
            if run["font_type"] != expected:
                assert run["font_type"] == layout.FONT_RESOURCES["SY_Black"]
                assert "product_glyph_font_fallback" in summary["warnings"]
                font_info["SY_Black"] = {
                    "url": resource.url, "sha256": resource.sha256, "bytes": len(resource.content),
                    "font_name": list(resource.font(32).getname()),
                }
        records.append({"text": text, "png_sha256": hashlib.sha256(layer["content"]).hexdigest(),
                        "alpha_bounds": alpha_box, "layout": summary})
        rows.append(png)
        if index in {0, 30, 72, 73, 74, 75} or text == "FLOOR ONE S7 Stretch Steam":
            (OUT / f"sample-{index}.png").write_bytes(layer["content"])
    sheet = Image.new("RGB", (1100, len(rows) * 100), "#111111")
    draw = ImageDraw.Draw(sheet)
    for index, png in enumerate(rows):
        draw.text((8, index * 100 + 4), f"{index + 1:02}", fill="#AAAAAA")
        sheet.paste(png, (35, index * 100 + 24), png)
    sheet.save(OUT / "product-font-contact-sheet.png")
    (OUT / "real-font-evidence.json").write_text(json.dumps({
        "fonts": font_info, "catalog_examples": 72, "extra_examples": 4,
        "shared_baseline": True, "transparent_rgba": True, "glyph_edges_not_clipped": True,
        "real_model_called": False, "real_mediakit_called": False, "examples": records,
    }, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"examples": len(rows), "fonts": font_info, "result": "passed"}))


if __name__ == "__main__":
    main()
