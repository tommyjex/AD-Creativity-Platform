"""Verify actual-font ordinary PNG overlays and failed-image fallback offline."""

import argparse
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from video_subtitle_grounding import layout

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "subtitle_browser_fixture", ROOT / "scripts/verify-subtitle-translation-browser.py")
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3058")
    parser.add_argument("--font-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    fixture.OUT = args.output_dir
    resources = {}
    for font_id, filename in (("CenturyGothic", "centurygothic.ttf"),
                              ("CenturyGothicBold", "centurygothic_bold.ttf")):
        content = (args.font_dir / filename).read_bytes()
        url = layout.FONT_RESOURCES[font_id]
        resources[url] = layout._FontResource(
            url, content, hashlib.sha256(content).hexdigest(), layout._font_codepoints(content))
    original_loader = layout._load_font_resource
    layout._load_font_resource = resources.__getitem__

    class PNGAPI(fixture.MockAPI):
        def product_measure(self, current, recognize=False):
            compiled = layout.compile_subtitle_project(
                current["segments"], {**fixture.META, "video_category": current["video_category"],
                                      "source_url": "https://fixture.example/clean.mp4"})
            for item in current["segments"]:
                summary = compiled["layouts"][item["segment_id"]]
                for key in ("render_bbox_pixels", "effective_font_size_px", "estimated_font_size_px",
                            "font_type", "font_sha256", "text_runs", "render_layer_asset_id"):
                    item[key] = deepcopy(summary[key])
                item["render_layer_url"] = (
                    f'{fixture.PREFIX}/{current["id"]}/layers/{summary["render_layer_asset_id"]}.png')
            for layer_id, layer in compiled["layers"].items():
                self.product_layers[layer_id] = layer["content"]

    results = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                for width, height in ((1440, 900), (834, 1112), (390, 844)):
                    for role in ("creator", "viewer"):
                        context = browser.new_context(viewport={"width": width, "height": height})
                        api = PNGAPI(role, args.font_dir)
                        api.product_checks = True
                        current = api.workspaces["workspace-a"]
                        records = []
                        for index, visual_role, text in (
                            (1, "headline", "180° Flachlagerungs-Design"),
                            (2, "body", "Erreicht mühelos niedrige Bereiche"),
                            (3, "footnote", "*Die Höhe beträgt 12,75 cm"),
                        ):
                            item = fixture.segment(index)
                            item.update(translated_text=text, visual_role=visual_role,
                                        translation_status="succeeded", end_ms=3000,
                                        background_color="#000000", warnings=[],
                                        bbox_normalized=[100, 150 * index, 900, 150 * index + 40],
                                        style={})
                            records.append(item)
                        current.update(segments=records, video_category="product",
                                       clean_video_asset_id="clean-a", clean_video=deepcopy(fixture.META),
                                       reference_video_asset_id="reference-a",
                                       reference_video=deepcopy(fixture.META), stage="succeeded")
                        api.product_measure(current)
                        context.route("**/*", api.route)
                        page = context.new_page()
                        try:
                            fixture.open_tool(page, args.base_url)

                            def open_review():
                                page.get_by_role("button", name="3 · 原文").click()
                                dialog = page.get_by_role("dialog")
                                dialog.get_by_role("button", name="字幕 1 · 定位", exact=True).click()
                                return dialog

                            dialog = open_review()
                            for index in range(1, 4):
                                image = dialog.locator(f'[data-subtitle-layer="line-{index}"]')
                                expect(image).to_be_visible()
                                expect(image).to_have_js_property(
                                    "naturalWidth",
                                    records[index - 1]["render_bbox_pixels"][2]
                                    - records[index - 1]["render_bbox_pixels"][0])
                            assert records[2]["effective_font_size_px"] == 24
                            fixture.no_overflow(page)
                            page.screenshot(path=str(args.output_dir / f"png-{role}-{width}.png"),
                                            full_page=True)
                            if role == "creator":
                                dialog.get_by_role("button", name="计算排版 · 不保存", exact=True).click()
                                expect(dialog.locator('[data-subtitle-layer="line-3"]')).to_be_visible()
                            dialog.get_by_role("button", name="关闭", exact=True).click()
                            api.fail_layers = True
                            page.reload(wait_until="networkidle")
                            page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
                            dialog = open_review()
                            for index in range(1, 4):
                                fallback = dialog.locator(f'[data-subtitle-panel="line-{index}"]')
                                expect(fallback).to_be_visible()
                                expect(fallback).to_contain_text(records[index - 1]["translated_text"])
                                expect(fallback).to_have_css("background-color", "rgba(0, 0, 0, 0)")
                            fixture.no_overflow(page)
                            page.screenshot(path=str(args.output_dir / f"fallback-{role}-{width}.png"),
                                            full_page=True)
                            assert not api.unexpected, api.unexpected
                            result = {"viewport": f"{width}x{height}", "role": role,
                                      "result": "passed", "actual_font_png_lines": 3,
                                      "footnote_size_px": 24, "failed_image_fallback": True,
                                      "overflow": False, "paid_calls": False}
                            results.append(result)
                            print(json.dumps(result))
                        except Exception:
                            page.screenshot(path=str(args.output_dir / f"failure-{role}-{width}.png"),
                                            full_page=True)
                            raise
                        finally:
                            context.close()
            finally:
                browser.close()
    finally:
        layout._load_font_resource = original_loader
        (args.output_dir / "results.json").write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
