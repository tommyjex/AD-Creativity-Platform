from __future__ import annotations

import json
import os
import re
from pathlib import Path

from playwright.sync_api import Browser, Page, sync_playwright


BASE_URL = os.environ.get("FRONTEND_BASE_URL", "http://127.0.0.1:3001")
ARTIFACTS_PATH = Path(__file__).resolve().parent.parent / "test-results" / "home-generated-media-gallery"
VIEWPORTS = (
    {"name": "desktop", "width": 1440, "height": 1000, "columns": 5},
    {"name": "tablet", "width": 1024, "height": 768, "columns": 4},
    {"name": "mobile", "width": 390, "height": 844, "columns": 2},
)


def assert_no_horizontal_overflow(page: Page, name: str) -> None:
    has_overflow = page.evaluate(
        "() => document.documentElement.scrollWidth > window.innerWidth"
    )
    assert not has_overflow, f"{name}: 页面存在横向溢出"


def assert_controls_do_not_overlap(page: Page, name: str) -> None:
    boxes = page.locator('[role="tablist"], input[aria-label="搜索产物"]').evaluate_all(
        """elements => elements.map(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        })"""
    )
    assert len(boxes) == 2, f"{name}: 分类控件或搜索框缺失"
    first, second = boxes
    overlaps = not (
        first["right"] <= second["left"]
        or second["right"] <= first["left"]
        or first["bottom"] <= second["top"]
        or second["bottom"] <= first["top"]
    )
    assert not overlaps, f"{name}: 分类控件与搜索框重叠"


def verify_image_preview(page: Page, name: str) -> None:
    cards = page.get_by_role("button", name=re.compile(r"^放大查看 "))
    assert cards.count() > 0, f"{name}: 图片分类没有可预览卡片"
    cards.first.click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(state="visible")
    image = dialog.locator("img")
    assert image.count() == 1, f"{name}: 图片预览未渲染"
    assert image.evaluate("(element) => getComputedStyle(element).objectFit") == "contain"
    intrinsic = image.evaluate(
        """element => ({
          naturalWidth: element.naturalWidth,
          naturalHeight: element.naturalHeight,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height
        })"""
    )
    assert intrinsic["naturalWidth"] > 0 and intrinsic["naturalHeight"] > 0, (
        f"{name}: 图片预览未完成加载"
    )
    stage_bounds = dialog.get_by_test_id("home-media-preview-stage").bounding_box()
    image_bounds = image.bounding_box()
    assert stage_bounds is not None and image_bounds is not None, (
        f"{name}: 图片预览边界不可用"
    )
    tolerance = 1
    assert image_bounds["y"] >= stage_bounds["y"] - tolerance, (
        f"{name}: 图片预览顶部溢出媒体区"
    )
    assert (
        image_bounds["y"] + image_bounds["height"]
        <= stage_bounds["y"] + stage_bounds["height"] + tolerance
    ), (
        f"{name}: 图片预览底部溢出媒体区"
    )
    assert image_bounds["x"] >= stage_bounds["x"] - tolerance, (
        f"{name}: 图片预览左侧溢出媒体区"
    )
    assert (
        image_bounds["x"] + image_bounds["width"]
        <= stage_bounds["x"] + stage_bounds["width"] + tolerance
    ), (
        f"{name}: 图片预览右侧溢出媒体区"
    )
    page.screenshot(path=str(ARTIFACTS_PATH / f"{name}-image-dialog.png"))
    page.get_by_role("button", name="关闭").click()
    dialog.wait_for(state="hidden")


def verify_video_preview(page: Page, name: str) -> None:
    page.get_by_role("tab", name=re.compile(r"^视频 ")).click()
    masonry = page.get_by_test_id("home-media-masonry")
    masonry.wait_for(state="visible")
    cards = page.get_by_role("button", name=re.compile(r"^放大查看 "))
    assert cards.count() > 0, f"{name}: 视频分类没有可预览卡片"
    cards.first.click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(state="visible")
    video = dialog.locator("video")
    assert video.count() == 1, f"{name}: 视频预览未渲染"
    assert video.evaluate("(element) => element.controls") is True
    assert video.evaluate("(element) => element.autoplay") is False
    assert video.evaluate(
        "(element) => element.getBoundingClientRect().width >= window.innerWidth * 0.75"
    ), f"{name}: 视频预览未充分利用 Dialog 宽度"
    page.screenshot(path=str(ARTIFACTS_PATH / f"{name}-video-dialog.png"))
    page.get_by_role("button", name="关闭").click()
    dialog.wait_for(state="hidden")
    assert page.locator('[role="dialog"] video').count() == 0, f"{name}: 关闭后视频仍在播放"


def verify_viewport(browser: Browser, viewport: dict[str, int | str]) -> dict[str, object]:
    context = browser.new_context(
        viewport={"width": int(viewport["width"]), "height": int(viewport["height"])}
    )
    page = context.new_page()
    page_errors: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    try:
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30_000)
        page.get_by_role("heading", name="创意产物", exact=True).wait_for(
            state="visible"
        )
        assert page.get_by_text("首页创作工作台").count() == 0
        assert page.get_by_text("Brief Control Surface").count() == 0

        image_tab = page.get_by_role("tab", name=re.compile(r"^图片 "))
        assert image_tab.get_attribute("aria-selected") == "true"
        masonry = page.get_by_test_id("home-media-masonry")
        masonry.wait_for(state="visible")
        page.wait_for_function(
            """count => {
              const images = [...document.querySelectorAll(
                '#home-media-panel > div > article:first-child img'
              )];
              return images.length === count &&
                images.every(image => image.complete && image.naturalWidth > 0);
            }""",
            arg=int(viewport["columns"]),
            timeout=60_000,
        )
        page.wait_for_timeout(750)
        first_row_images = page.locator(
            "#home-media-panel > div > article:first-child img"
        ).evaluate_all(
            """images => images.map(image => ({
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              width: image.getBoundingClientRect().width,
              height: image.getBoundingClientRect().height
            }))"""
        )
        for image in first_row_images:
            natural_ratio = image["naturalWidth"] / image["naturalHeight"]
            rendered_ratio = image["width"] / image["height"]
            assert abs(natural_ratio - rendered_ratio) < 0.03, (
                f"{viewport['name']}: 首屏缩略图比例失真"
            )
        column_count = int(masonry.get_attribute("data-column-count") or "0")
        assert column_count == viewport["columns"], (
            f"{viewport['name']}: 预期 {viewport['columns']} 列，实际 {column_count} 列"
        )

        assert_controls_do_not_overlap(page, str(viewport["name"]))
        assert_no_horizontal_overflow(page, str(viewport["name"]))
        page.screenshot(
            path=str(ARTIFACTS_PATH / f"{viewport['name']}-images.png"),
        )
        verify_image_preview(page, str(viewport["name"]))
        verify_video_preview(page, str(viewport["name"]))
        assert not page_errors, f"{viewport['name']}: 页面异常 {page_errors}"

        return {
            "columnCount": column_count,
            "name": viewport["name"],
            "size": f"{viewport['width']}x{viewport['height']}",
        }
    finally:
        context.close()


def main() -> None:
    ARTIFACTS_PATH.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            results = [verify_viewport(browser, viewport) for viewport in VIEWPORTS]
        finally:
            browser.close()

    print(
        json.dumps(
            {
                "artifactsPath": str(ARTIFACTS_PATH),
                "result": "PASS",
                "viewports": results,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
