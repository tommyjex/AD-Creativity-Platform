"""Replay an exported reviewed draft with real font metrics, without render APIs."""

import argparse
import json
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

from backend.app.services import subtitle_translation_layout as layout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("draft", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    draft = json.loads(args.draft.read_text())
    segments = draft["segments"]
    original = deepcopy(segments)
    video = {
        **draft["output_video"],
        "source_url": "https://offline.example.com/clean.mp4",
    }
    with patch.object(layout, "_expand_box", lambda box, *_: box):
        baseline = layout.compile_subtitle_project(segments, video)["layouts"]
    adapted = layout.compile_subtitle_project(segments, video)["layouts"]
    assert segments == original
    rows = []
    for identifier, result in adapted.items():
        if result.get("excluded"):
            continue
        box = result["render_bbox_pixels"]
        source = result["original_bbox_pixels"]
        assert 0 <= box[0] <= source[0] < source[2] <= box[2] <= video["width"]
        assert box[1::2] == source[1::2]
        assert result["target_time"] == baseline[identifier]["target_time"]
        assert (
            result["effective_font_size_px"]
            >= baseline[identifier]["effective_font_size_px"]
        )
        assert result["measured_text_width_px"] <= box[2] - box[0]
        rows.append(
            {
                "segment_id": identifier,
                "baseline_font_size": baseline[identifier]["effective_font_size_px"],
                "target_font_size": result["target_font_size_px"],
                "adaptive_font_size": result["effective_font_size_px"],
                "original_box": source,
                "adaptive_box": box,
                "warnings": result["warnings"],
            }
        )
    # Check all simultaneous pairs for newly introduced spatial intersections.
    for index, row in enumerate(rows):
        for other in rows[index + 1 :]:
            first, second = adapted[row["segment_id"]], adapted[other["segment_id"]]
            a, b = first["target_time"], second["target_time"]
            if a[0] >= b[1] or b[0] >= a[1]:
                continue

            def intersect(a, b):
                return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]

            assert not intersect(
                row["adaptive_box"], other["adaptive_box"]
            ) or intersect(row["original_box"], other["original_box"])
    report = {
        "segments": len(rows),
        "expanded": sum(r["original_box"] != r["adaptive_box"] for r in rows),
        "font_improved": sum(
            r["adaptive_font_size"] > r["baseline_font_size"] for r in rows
        ),
        "target_size_preserved": sum(
            r["adaptive_font_size"] == r["target_font_size"] for r in rows
        ),
        "baseline_below_80_percent": sum(
            r["baseline_font_size"] < 0.8 * r["target_font_size"] for r in rows
        ),
        "adaptive_below_80_percent": sum(
            r["adaptive_font_size"] < 0.8 * r["target_font_size"] for r in rows
        ),
        "new_overlaps": 0,
        "source_fields_unchanged": True,
        "paid_calls": 0,
        "real_render_verified": False,
        "rows": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "rows"}))


if __name__ == "__main__":
    main()
