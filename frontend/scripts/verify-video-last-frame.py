"""Verify the real asset library against the deterministic gateway fixture."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE_URL = os.getenv("LAST_FRAME_FRONTEND_URL", "http://127.0.0.1:3040")
RESULTS = Path(__file__).resolve().parents[1] / "test-results/video-last-frame"
VIEWPORTS = [(1440, 900), (834, 1112), (390, 844)]


def main():
    RESULTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        api = p.request.new_context(base_url=BASE_URL)
        setup = api.post("/api/auth/setup", data=json.dumps({
            "username": "tail-acceptance", "display_name": "Tail Acceptance",
            "password": "tail fixture password",
        }), headers={"Origin": BASE_URL, "Content-Type": "application/json"})
        assert setup.ok, setup.text()
        fixture = api.get("/api/_acceptance/last-frame").json()
        assert fixture["provider_calls"] == 0 and fixture["naming_calls"] == 1
        assert fixture["object_count"] == 2
        reports = []
        for width, height in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                storage_state=api.storage_state(),
                accept_downloads=True,
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"{BASE_URL}/workspace/assets?source=aigc", wait_until="networkidle", timeout=120000)
            name = fixture["tail_name"]
            preview = page.get_by_role("button", name=f"放大查看{name}预览", exact=True)
            expect(preview).to_be_visible(timeout=30000)
            expect(page.get_by_text("视频尾帧", exact=True)).to_be_visible()
            assert preview.count() == 1
            page.get_by_role("button", name="图片 1", exact=True).click()
            expect(preview).to_be_visible()
            assert preview.locator("img").evaluate("el => getComputedStyle(el).objectFit") == "contain"
            page.get_by_role("searchbox", name="搜索资产").fill("跑车视频尾帧")
            expect(preview).to_be_visible()
            assert page.get_by_role("button", name=re.compile("^播放")).count() == 0
            dimensions = page.evaluate("""() => ({
                clientWidth: document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth
            })""")
            assert dimensions["scrollWidth"] <= dimensions["clientWidth"] + 1
            preview.click()
            dialog = page.get_by_role("dialog")
            expect(dialog).to_be_visible()
            image = dialog.locator("img")
            expect(image).to_be_visible()
            page.wait_for_function("""() => [...document.querySelectorAll('[role="dialog"] img')]
                .every(img => img.complete && img.naturalWidth > 0)""")
            assert image.evaluate("el => getComputedStyle(el).objectFit") == "contain"
            assert image.evaluate("el => el.naturalWidth / el.naturalHeight") == 0.5
            download_link = dialog.get_by_role("link", name="下载资产")
            download_link.scroll_into_view_if_needed()
            bounds = download_link.bounding_box()
            assert bounds and 0 <= bounds["x"] and bounds["x"] + bounds["width"] <= width + 1
            assert download_link.evaluate("""el => {
                const box = el.getBoundingClientRect();
                const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                return hit === el || el.contains(hit);
            }""")
            with page.expect_download() as event:
                download_link.click()
            download = event.value
            assert download.suggested_filename == name
            download.save_as(str(RESULTS / f"{width}-tail.png"))
            page.screenshot(path=str(RESULTS / f"{width}-preview.png"))
            assert not errors, errors
            reports.append({"width": width, "height": height, "filename": name, **dimensions})
            context.close()
        browser.close()
        (RESULTS / "report.json").write_text(json.dumps(reports, ensure_ascii=False, indent=2))
        print(json.dumps({"passed": len(reports), "provider_calls": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
