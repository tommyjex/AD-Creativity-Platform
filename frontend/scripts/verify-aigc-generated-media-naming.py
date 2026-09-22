#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from playwright.sync_api import Locator, Page
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import expect, sync_playwright


FRONTEND_URL = os.getenv(
    "NAMING_ACCEPTANCE_FRONTEND_URL",
    "http://127.0.0.1:3010",
)
BACKEND_URL = os.getenv(
    "NAMING_ACCEPTANCE_BACKEND_URL",
    "http://127.0.0.1:8010",
)
RESULTS_DIR = Path(
    os.getenv(
        "NAMING_ACCEPTANCE_RESULTS_DIR",
        "test-results/aigc-generated-media-naming",
    )
)
VIEWPORTS = (
    ("desktop", 1440, 1000),
    ("tablet", 1024, 768),
    ("mobile", 390, 844),
)


def request_json(path: str, *, method: str = "GET") -> dict[str, Any]:
    request = urllib.request.Request(f"{BACKEND_URL}{path}", method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def content_disposition_filename(asset_id: str) -> str:
    url = f"{BACKEND_URL}/api/assets/{urllib.parse.quote(asset_id)}/content?download=1"
    with urllib.request.urlopen(url, timeout=30) as response:
        disposition = response.headers.get("Content-Disposition", "")
        response.read(1)
    encoded = re.search(r"filename\*=UTF-8''([^;]+)", disposition)
    if encoded:
        return urllib.parse.unquote(encoded.group(1))
    plain = re.search(r'filename="([^"]+)"', disposition)
    if plain:
        return plain.group(1)
    raise AssertionError(f"missing download filename for {asset_id}: {disposition}")


def navigate(page: Page, url: str) -> None:
    page.goto(url, wait_until="domcontentloaded", timeout=120_000)
    try:
        page.wait_for_load_state("networkidle", timeout=15_000)
    except PlaywrightTimeoutError:
        # Active run polling intentionally keeps the editor network busy.
        pass


def visible_box(locator: Locator, label: str) -> dict[str, float]:
    expect(locator).to_be_visible(timeout=15_000)
    box = locator.bounding_box()
    assert box is not None, f"{label} has no bounding box"
    return box


def assert_reachable(page: Page, locator: Locator, label: str) -> dict[str, float]:
    locator.scroll_into_view_if_needed()
    box = visible_box(locator, label)
    viewport = page.viewport_size
    assert viewport is not None
    assert box["x"] >= -1 and box["y"] >= -1, f"{label} starts off-screen: {box}"
    assert box["x"] + box["width"] <= viewport["width"] + 1, (
        f"{label} exceeds viewport width: {box}"
    )
    assert box["y"] + box["height"] <= viewport["height"] + 1, (
        f"{label} exceeds viewport height: {box}"
    )
    target_hit = page.evaluate(
        """({selector, x, y}) => {
          const target = document.querySelector(selector);
          const hit = document.elementFromPoint(x, y);
          return Boolean(target && hit && (target === hit || target.contains(hit)));
        }""",
        {
            "selector": f'[data-acceptance-target="{label}"]',
            "x": box["x"] + box["width"] / 2,
            "y": box["y"] + box["height"] / 2,
        },
    )
    assert target_hit, f"{label} is covered at its center"
    return box


def mark_target(locator: Locator, label: str) -> Locator:
    locator.evaluate(
        "(element, value) => element.setAttribute('data-acceptance-target', value)",
        label,
    )
    return locator


def intersection_area(first: dict[str, float], second: dict[str, float]) -> float:
    width = max(
        0.0,
        min(first["x"] + first["width"], second["x"] + second["width"])
        - max(first["x"], second["x"]),
    )
    height = max(
        0.0,
        min(first["y"] + first["height"], second["y"] + second["height"])
        - max(first["y"], second["y"]),
    )
    return width * height


def layout_evidence(
    page: Page,
    *,
    include_inspector: bool,
    context: str,
) -> dict[str, Any]:
    dimensions = page.evaluate(
        """() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight
        })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["clientWidth"] + 1, (
        f"{context} has horizontal overflow: {dimensions}"
    )

    shell = page.get_by_test_id("aigc-editor-shell")
    if shell.count():
        shell_dimensions = shell.evaluate(
            """element => ({
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              clientHeight: element.clientHeight,
              scrollHeight: element.scrollHeight
            })"""
        )
        assert shell_dimensions["scrollWidth"] <= shell_dimensions["clientWidth"] + 1
        assert shell_dimensions["scrollHeight"] <= shell_dimensions["clientHeight"] + 1
    else:
        shell_dimensions = None

    controls = {
        "details": page.get_by_test_id("aigc-command-inspector"),
    }
    if include_inspector:
        controls.update(
            {
                "config-tab": page.get_by_role("tab", name="配置"),
                "result-tab": page.get_by_role("tab", name="结果"),
                "run-tab": page.get_by_role("tab", name="运行"),
                "close-inspector": page.get_by_role(
                    "button",
                    name="关闭详情栏",
                ),
            }
        )
    boxes: dict[str, dict[str, float]] = {}
    for label, locator in controls.items():
        if locator.count() and locator.is_visible():
            boxes[label] = assert_reachable(
                page,
                mark_target(locator, f"{context}-{label}"),
                f"{context}-{label}",
            )

    overlaps: list[dict[str, Any]] = []
    labels = list(boxes)
    for index, first_label in enumerate(labels):
        for second_label in labels[index + 1 :]:
            area = intersection_area(boxes[first_label], boxes[second_label])
            if area > 1:
                overlaps.append(
                    {
                        "first": first_label,
                        "second": second_label,
                        "area": area,
                    }
                )
    assert not overlaps, f"{context} control overlap: {overlaps}"
    return {
        "document": dimensions,
        "shell": shell_dimensions,
        "reachable": boxes,
        "overlaps": overlaps,
    }


def open_node_inspector(page: Page, node_id: str) -> None:
    inspector = page.get_by_test_id("aigc-inspector")
    viewport = page.viewport_size
    if (
        viewport is not None
        and viewport["width"] < 768
        and inspector.is_visible()
    ):
        page.get_by_role("button", name="关闭详情栏").click()
        expect(inspector).not_to_be_visible()
    page.locator(f'.react-flow__node[data-id="{node_id}"]').click()
    if not inspector.is_visible():
        page.get_by_test_id("aigc-command-inspector").click()
    expect(inspector).to_be_visible()


def named_download_link(
    page: Page,
    *,
    label: str,
    filename: str,
) -> Locator:
    link = page.get_by_role("link", name=label)
    expect(link).to_have_attribute("download", filename)
    href = link.get_attribute("href")
    assert href and f"filename={urllib.parse.quote(filename)}" in href, href
    return link


def perform_download(
    page: Page,
    locator: Locator,
    expected_filename: str,
    evidence_name: str,
) -> dict[str, Any]:
    locator.scroll_into_view_if_needed()
    with page.expect_download(timeout=30_000) as download_info:
        locator.click()
    download = download_info.value
    assert download.suggested_filename == expected_filename, {
        "actual": download.suggested_filename,
        "expected": expected_filename,
    }
    destination = RESULTS_DIR / "downloads" / evidence_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    download.save_as(destination)
    size = destination.stat().st_size
    assert size > 0, f"empty browser download: {expected_filename}"
    return {
        "filename": download.suggested_filename,
        "path": str(destination),
        "size_bytes": size,
    }


def assert_editor_names(page: Page, manifest: dict[str, Any]) -> None:
    for node_id, key in (("image-model", "image"), ("video-model", "video")):
        expect(
            page.locator(f'.react-flow__node[data-id="{node_id}"]').get_by_test_id(
                "aigc-node-title"
            )
        ).to_have_text(manifest[key]["name"], timeout=20_000)


def assert_revision(page: Page) -> int:
    autosave_status = page.get_by_test_id("aigc-autosave-status")
    expect(autosave_status).to_have_text(re.compile(r"已保存 Revision \d+"))
    page_revision = int(re.search(r"\d+", autosave_status.inner_text()).group())
    server_revision = request_json("/api/_acceptance/naming/manifest")["revision"]
    assert page_revision == server_revision, {
        "page_revision": page_revision,
        "server_revision": server_revision,
    }
    return page_revision


def verify_editor(
    page: Page,
    manifest: dict[str, Any],
    *,
    perform_real_downloads: bool,
    verify_precommit: bool,
) -> dict[str, Any]:
    navigate(
        page,
        f"{FRONTEND_URL}/workspace/aigc/acceptance"
        f"?pipelineId={manifest['pipeline_id']}",
    )
    expect(page.get_by_test_id("aigc-editor-shell")).to_be_visible(
        timeout=30_000
    )

    if verify_precommit:
        expect(page.get_by_test_id("aigc-node-title")).to_contain_text(
            ["文本节点1", "运行中人工图片名", "文本节点2", "运行中人工视频名"]
        )
        initial_revision = assert_revision(page)
        server_revision = request_json(
            "/api/_acceptance/naming/manifest"
        )["revision"]
        assert initial_revision == server_revision, {
            "page_revision": initial_revision,
            "server_revision": server_revision,
        }
        prepared = request_json(
            "/api/_acceptance/naming/prepare",
            method="POST",
        )
        assert prepared["revision"] == server_revision, prepared
        page.wait_for_timeout(2_500)
        committed = request_json("/api/_acceptance/naming/commit", method="POST")
        assert committed["revision"] >= 2, committed
        navigate(
            page,
            f"{FRONTEND_URL}/workspace/aigc/acceptance"
            f"?pipelineId={manifest['pipeline_id']}",
        )
        expect(page.get_by_test_id("aigc-editor-shell")).to_be_visible(
            timeout=30_000
        )

    assert_editor_names(page, manifest)
    revision_before_refresh = assert_revision(page)

    image_name = manifest["image"]["name"]
    video_name = manifest["video"]["name"]
    node_downloads: dict[str, Any] = {}
    result_downloads: list[dict[str, Any]] = []

    open_node_inspector(page, "image-model")
    expect(page.locator("#node-custom-name-image-model")).to_have_value(image_name)
    image_node = page.locator('.react-flow__node[data-id="image-model"]')
    if perform_real_downloads:
        image_node.get_by_test_id("aigc-node-title-row").hover()
    image_node_link = named_download_link(
        page,
        label=f"下载图片：{image_name}",
        filename=f"{image_name}.png",
    )
    if perform_real_downloads:
        node_downloads["image"] = perform_download(
            page,
            image_node_link,
            f"{image_name}.png",
            "node-image.png",
        )

    page.get_by_role("tab", name="结果").click()
    image_results = page.get_by_test_id("aigc-inspector").get_by_role(
        "link",
        name="下载图片",
        exact=True,
    )
    expect(image_results).to_have_count(2)
    for ordinal, filename in enumerate(
        (f"{image_name}.png", f"{image_name}-2.png")
    ):
        expect(image_results.nth(ordinal)).to_have_attribute("download", filename)
        if perform_real_downloads:
            result_downloads.append(
                perform_download(
                    page,
                    image_results.nth(ordinal),
                    filename,
                    f"result-image-{ordinal + 1}.png",
                )
            )

    page.get_by_role("tab", name="配置").click()
    open_node_inspector(page, "video-model")
    expect(page.locator("#node-custom-name-video-model")).to_have_value(video_name)
    video_node = page.locator('.react-flow__node[data-id="video-model"]')
    if perform_real_downloads:
        video_node.get_by_test_id("aigc-node-title-row").hover()
    video_node_link = named_download_link(
        page,
        label=f"下载视频：{video_name}",
        filename=f"{video_name}.mp4",
    )
    if perform_real_downloads:
        node_downloads["video"] = perform_download(
            page,
            video_node_link,
            f"{video_name}.mp4",
            "node-video.mp4",
        )

    page.get_by_role("tab", name="结果").click()
    video_result = page.get_by_test_id("aigc-inspector").get_by_role(
        "link",
        name="下载视频",
        exact=True,
    )
    expect(video_result).to_have_attribute("download", f"{video_name}.mp4")
    if perform_real_downloads:
        result_downloads.append(
            perform_download(
                page,
                video_result,
                f"{video_name}.mp4",
                "result-video.mp4",
            )
        )

    page.reload(wait_until="domcontentloaded", timeout=120_000)
    expect(page.get_by_test_id("aigc-editor-shell")).to_be_visible(
        timeout=30_000
    )
    assert_editor_names(page, manifest)
    revision_after_refresh = assert_revision(page)
    assert revision_after_refresh == revision_before_refresh
    open_node_inspector(page, "image-model")
    expect(page.locator("#node-custom-name-image-model")).to_have_value(image_name)
    open_node_inspector(page, "video-model")
    expect(page.locator("#node-custom-name-video-model")).to_have_value(video_name)

    return {
        "revision_before_refresh": revision_before_refresh,
        "revision_after_refresh": revision_after_refresh,
        "node_downloads": node_downloads,
        "result_downloads": result_downloads,
        "layout": layout_evidence(
            page,
            include_inspector=True,
            context="editor",
        ),
    }


def asset_card(page: Page, filename: str) -> Locator:
    card = page.locator("article").filter(has_text=filename)
    expect(card).to_have_count(1)
    return card


def verify_asset_library(
    page: Page,
    manifest: dict[str, Any],
    *,
    perform_real_downloads: bool,
) -> dict[str, Any]:
    navigate(page, f"{FRONTEND_URL}/workspace/assets?source=aigc")
    expect(page.get_by_role("heading", name="资产库")).to_be_visible()
    downloads: dict[str, Any] = {}
    expected = (
        ("image", f"{manifest['image']['name']}.png"),
        ("image-2", f"{manifest['image']['name']}-2.png"),
        ("video", f"{manifest['video']['name']}.mp4"),
        ("historical", f"{manifest['historical']['name']}.png"),
    )
    for key, filename in expected:
        card = asset_card(page, filename)
        link = card.get_by_role("link", name="下载资产")
        expect(link).to_be_visible()
        if perform_real_downloads:
            downloads[key] = perform_download(
                page,
                link,
                filename,
                f"asset-library-{key}{Path(filename).suffix}",
            )

    first_image_card = asset_card(page, f"{manifest['image']['name']}.png")
    first_image_card.get_by_role(
        "button",
        name=re.compile(f"{re.escape(manifest['image']['name'])}.*预览"),
    ).click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_contain_text(manifest["image"]["name"])
    expect(dialog.get_by_role("link", name="下载资产")).to_be_visible()
    page.keyboard.press("Escape")

    return {
        "downloads": downloads,
        "layout": layout_evidence(
            page,
            include_inspector=False,
            context="asset-library",
        ),
    }


def validate_metadata(manifest: dict[str, Any]) -> dict[str, Any]:
    evidence: dict[str, Any] = {}
    targets = (
        ("image", manifest["image"]["asset_ids"][0], "png", 0),
        ("image-2", manifest["image"]["asset_ids"][1], "png", 1),
        ("video", manifest["video"]["asset_id"], "mp4", 0),
    )
    for key, asset_id, extension, ordinal in targets:
        asset = request_json(f"/api/_acceptance/naming/asset/{asset_id}")
        metadata = asset["metadata"]
        source = manifest["video"] if key == "video" else manifest["image"]
        suffix = "" if ordinal == 0 else f"-{ordinal + 1}"
        assert asset["status"] == "succeeded", asset
        assert metadata["name_scheme"] == "aigc_generated_node_v2", metadata
        assert metadata["generated_name"] == source["name"], metadata
        assert metadata["name_source"] == "ai", metadata
        assert metadata["naming_model"] == "doubao-seed-2-0-mini-260428", metadata
        assert metadata["naming_status"] == "succeeded", metadata
        assert metadata["output_ordinal"] == ordinal, metadata
        assert metadata["name"] == f"{source['name']}{suffix}.{extension}", metadata
        evidence[key] = asset
    assert manifest["provider_calls"] == 0, manifest
    return evidence


def main() -> int:
    if RESULTS_DIR.exists():
        shutil.rmtree(RESULTS_DIR)
    RESULTS_DIR.mkdir(parents=True)
    initial = request_json("/api/_acceptance/naming/manifest")
    started_clean = initial["committed"] is False
    evidence: dict[str, Any] = {
        "initial_manifest": initial,
        "started_clean": started_clean,
        "viewports": {},
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for index, (label, width, height) in enumerate(VIEWPORTS):
                print(f"VERIFY {label} editor", flush=True)
                context = browser.new_context(
                    accept_downloads=True,
                    viewport={"width": width, "height": height},
                )
                page = context.new_page()
                console_errors: list[str] = []
                page_errors: list[str] = []
                http_errors: list[dict[str, Any]] = []
                page.on(
                    "console",
                    lambda message: (
                        console_errors.append(message.text)
                        if message.type == "error"
                        else None
                    ),
                )
                page.on("pageerror", lambda error: page_errors.append(str(error)))
                page.on(
                    "response",
                    lambda response: (
                        http_errors.append(
                            {
                                "status": response.status,
                                "url": response.url,
                            }
                        )
                        if response.status >= 400
                        else None
                    ),
                )

                editor_evidence = verify_editor(
                    page,
                    initial,
                    perform_real_downloads=index == 0,
                    verify_precommit=index == 0 and started_clean,
                )
                page.screenshot(
                    path=RESULTS_DIR / f"{label}-editor.png",
                    full_page=True,
                )
                print(f"VERIFY {label} asset library", flush=True)
                asset_evidence = verify_asset_library(
                    page,
                    initial,
                    perform_real_downloads=index == 0,
                )
                page.screenshot(
                    path=RESULTS_DIR / f"{label}-assets.png",
                    full_page=True,
                )
                assert not console_errors, {
                    "viewport": label,
                    "console_errors": console_errors,
                    "http_errors": http_errors,
                }
                assert not page_errors, f"{label} page errors: {page_errors}"
                assert not http_errors, f"{label} HTTP errors: {http_errors}"
                evidence["viewports"][label] = {
                    "size": [width, height],
                    "editor": editor_evidence,
                    "asset_library": asset_evidence,
                    "console_errors": console_errors,
                    "page_errors": page_errors,
                    "http_errors": http_errors,
                }
                context.close()
        finally:
            browser.close()

    committed = request_json("/api/_acceptance/naming/manifest")
    assert committed["committed"] is True, committed
    assert committed["revision"] >= 2, committed
    evidence["committed_manifest"] = committed
    evidence["metadata"] = validate_metadata(committed)
    evidence["content_disposition"] = {
        "image": content_disposition_filename(committed["image"]["asset_ids"][0]),
        "image-2": content_disposition_filename(
            committed["image"]["asset_ids"][1]
        ),
        "video": content_disposition_filename(committed["video"]["asset_id"]),
        "historical": content_disposition_filename(
            committed["historical"]["asset_id"]
        ),
    }
    assert evidence["content_disposition"] == {
        "image": f"{committed['image']['name']}.png",
        "image-2": f"{committed['image']['name']}-2.png",
        "video": f"{committed['video']['name']}.mp4",
        "historical": f"{committed['historical']['name']}.png",
    }, evidence["content_disposition"]

    evidence_path = RESULTS_DIR / "evidence.json"
    evidence_path.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"PASS: AIGC generated media naming acceptance ({evidence_path})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
