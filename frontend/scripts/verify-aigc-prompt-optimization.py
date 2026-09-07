from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


url = sys.argv[1]
output_dir = Path("test-results/prompt-optimization")
output_dir.mkdir(parents=True, exist_ok=True)
viewports = (
    ("desktop", 1440, 900),
    ("tablet", 1023, 768),
    ("mobile", 390, 844),
)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for name, width, height in viewports:
        print(f"checking {name} {width}x{height}", flush=True)
        page = browser.new_page(viewport={"width": width, "height": height})
        page.set_default_timeout(10_000)
        console_errors: list[str] = []
        requests: list[str] = []
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("request", lambda request: requests.append(request.url))
        page.goto(url)
        page.wait_for_load_state("networkidle")

        text_title = page.get_by_test_id("aigc-node-title").filter(
            has_text="文本节点"
        )
        text_title.first.dispatch_event("click")
        optimize = page.get_by_role("button", name="优化提示词")
        if optimize.count() == 0:
            inspector = page.get_by_role("button", name="打开检查器")
            if inspector.count() > 0:
                inspector.click()
        optimize.wait_for(state="visible")
        assert page.get_by_text("本地", exact=True).count() == 0
        assert page.get_by_text("上游", exact=True).count() == 0
        assert page.locator('a[aria-label^="下载图片"]').count() == 0
        assert page.locator('a[aria-label^="下载视频"]').count() == 0

        optimize.click()
        dialog = page.get_by_role("dialog", name="优化提示词")
        dialog.wait_for(state="visible")
        dialog.get_by_role("textbox", name="优化方向").fill("强化镜头节奏")
        assert dialog.get_by_role("combobox", name="目标模型").input_value()
        box = dialog.bounding_box()
        assert box is not None
        assert box["x"] >= 0 and box["y"] >= 0
        assert box["x"] + box["width"] <= width + 1
        assert box["y"] + box["height"] <= height + 1

        page.screenshot(
            path=str((output_dir / f"{name}.png").resolve()),
            full_page=True,
        )
        assert not any("/api/aigc/prompts/optimize" in item for item in requests)
        assert all(
            item.startswith(("http://127.0.0.1:", "http://localhost:"))
            for item in requests
        )
        assert not console_errors, console_errors
        page.close()
    browser.close()
