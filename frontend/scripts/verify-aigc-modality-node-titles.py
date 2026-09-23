from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, Locator, Page, Route, sync_playwright


FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://127.0.0.1:8000"
RESULTS_DIR = Path("test-results/aigc-modality-node-titles")
VIEWPORTS = (
    {"name": "desktop", "width": 1440, "height": 900},
    {"name": "tablet", "width": 1024, "height": 768},
    {"name": "mobile", "width": 390, "height": 844},
)
NODE_IDS = {
    "text": "title-qa-text",
    "image": "title-qa-image",
    "video": "title-qa-video",
    "audio": "title-qa-audio",
    "model": "title-qa-model",
    "control": "title-qa-control",
}


def api_json(path: str, *, method: str = "GET", payload: Any = None) -> Any:
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        f"{BACKEND_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json"} if body else {},
        method=method,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status == 204:
            return None
        return json.load(response)


def choose_assets() -> dict[str, dict[str, Any]]:
    assets = api_json("/api/assets?status=succeeded")
    selected: dict[str, dict[str, Any]] = {}
    for asset in assets:
        mime_type = asset.get("mime_type") or ""
        kind = mime_type.split("/", 1)[0]
        if kind not in {"image", "video", "audio"} or kind in selected:
            continue
        try:
            request = urllib.request.Request(
                f"{BACKEND_URL}/api/assets/{asset['id']}/content",
                headers={"Range": "bytes=0-0"},
            )
            with urllib.request.urlopen(request, timeout=20) as response:
                response.read(1)
        except Exception:
            continue
        selected[kind] = asset
    missing = {"image", "video", "audio"} - selected.keys()
    assert not missing, f"Missing accessible assets: {sorted(missing)}"
    return selected


def create_pipeline(assets: dict[str, dict[str, Any]]) -> dict[str, Any]:
    definition = {
        "schemaVersion": 2,
        "nodes": [
            {
                "id": NODE_IDS["text"],
                "type": "text",
                "custom_name": "Text QA",
                "position": {"x": 20, "y": 20},
                "size": {"width": 240, "height": 180},
                "config": {
                    "text": "Task 5 text content remains visible.",
                    "bbox_references": [],
                    "title": "Hidden text title",
                },
            },
            {
                "id": NODE_IDS["image"],
                "type": "image",
                "custom_name": "Image QA",
                "position": {"x": 300, "y": 20},
                "size": {"width": 240, "height": 180},
                "config": {
                    "asset_id": assets["image"]["id"],
                    "bbox": None,
                    "bbox_asset_id": None,
                    "title": "Hidden image title",
                },
            },
            {
                "id": NODE_IDS["video"],
                "type": "video",
                "custom_name": "Video QA",
                "position": {"x": 20, "y": 270},
                "size": {"width": 240, "height": 180},
                "config": {
                    "asset_id": assets["video"]["id"],
                    "title": "Hidden video title",
                },
            },
            {
                "id": NODE_IDS["audio"],
                "type": "audio",
                "custom_name": "Audio QA",
                "position": {"x": 300, "y": 270},
                "size": {"width": 240, "height": 180},
                "config": {
                    "asset_id": assets["audio"]["id"],
                    "title": "Audio result",
                },
            },
            {
                "id": NODE_IDS["model"],
                "type": "llm",
                "custom_name": "Model QA",
                "position": {"x": 20, "y": 520},
                "size": {"width": 240, "height": 180},
                "config": {
                    "model": "doubao-seed-evolving",
                    "system_prompt": "",
                    "temperature": 0.7,
                },
            },
            {
                "id": NODE_IDS["control"],
                "type": "json_parser",
                "custom_name": "Control QA",
                "position": {"x": 300, "y": 520},
                "size": {"width": 240, "height": 180},
                "config": {"json_path": "$.items"},
            },
        ],
        "edges": [
            {
                "id": "title-qa-text-edge",
                "sourceNodeId": NODE_IDS["model"],
                "sourceHandle": "text",
                "targetNodeId": NODE_IDS["text"],
                "targetHandle": "text",
            }
        ],
        "viewport": {"x": 20, "y": 80, "zoom": 0.8},
    }
    pipeline = api_json(
        "/api/aigc/pipelines",
        method="POST",
        payload={
            "name": f"[Task 5 title QA] {datetime.now(timezone.utc).isoformat()}",
            "description": "Temporary browser acceptance fixture.",
            "definition": definition,
        },
    )
    pipeline["definition"] = definition
    return pipeline


def run_fixture(
    pipeline: dict[str, Any], assets: dict[str, dict[str, Any]]
) -> tuple[dict, dict]:
    now = datetime.now(timezone.utc).isoformat()
    run = {
        "id": "title-qa-run",
        "pipeline_id": pipeline["id"],
        "run_number": 1,
        "pipeline_revision": pipeline["revision"],
        "mode": "full",
        "start_node_id": None,
        "source_run_id": None,
        "source_node_id": None,
        "status": "succeeded",
        "definition_snapshot": pipeline["definition"],
        "input_snapshot": {},
        "error": None,
        "cancellation_requested": False,
        "created_at": now,
        "updated_at": now,
        "started_at": now,
        "finished_at": now,
    }
    empty_result = {
        "kind": "none",
        "text": None,
        "text_digest": None,
        "assets": [],
    }
    nodes = []
    for node in pipeline["definition"]["nodes"]:
        result = empty_result
        if node["id"] in {NODE_IDS["text"], NODE_IDS["model"]}:
            result = {
                "kind": "text",
                "text": "Task 5 text content remains visible.",
                "text_digest": "title-qa-text",
                "assets": [],
            }
        elif node["id"] in {
            NODE_IDS["image"],
            NODE_IDS["video"],
            NODE_IDS["audio"],
        }:
            kind = next(
                key for key, node_id in NODE_IDS.items() if node_id == node["id"]
            )
            asset = assets[kind]
            result = {
                "kind": "assets",
                "text": None,
                "text_digest": None,
                "assets": [
                    {
                        "asset_id": asset["id"],
                        "ordinal": 0,
                        "mime_type": asset["mime_type"],
                        "download_url": asset["url"],
                        "available": True,
                        "metadata": {
                            "duration_seconds": 1,
                            "height": 720,
                            "name": f"{kind.title()} result",
                            "width": 1280,
                        },
                    }
                ],
            }
        nodes.append(
            {
                "node_id": node["id"],
                "included_in_plan": True,
                "status": "succeeded",
                "current_task_id": None,
                "reused_from_task_id": None,
                "input_hash": None,
                "result": result,
                "error": None,
                "attempts": [],
            }
        )
    return (
        {"items": [run], "page": 1, "page_size": 100, "total": 1},
        {"run": run, "nodes": nodes},
    )


def fulfill_json(route: Route, payload: Any) -> None:
    route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps(payload),
    )


def node(page: Page, node_id: str) -> Locator:
    return page.locator(f'.react-flow__node[data-id="{node_id}"]')


def boxes_overlap(first: dict[str, float], second: dict[str, float]) -> bool:
    return not (
        first["x"] + first["width"] <= second["x"]
        or second["x"] + second["width"] <= first["x"]
        or first["y"] + first["height"] <= second["y"]
        or second["y"] + second["height"] <= first["y"]
    )


def assert_contained(child: dict[str, float], parent: dict[str, float], label: str) -> None:
    tolerance = 7
    assert child["x"] >= parent["x"] - tolerance, f"{label}: left overflow"
    assert child["y"] >= parent["y"] - tolerance, f"{label}: top overflow"
    assert child["x"] + child["width"] <= parent["x"] + parent["width"] + tolerance, (
        f"{label}: right overflow"
    )
    assert child["y"] + child["height"] <= parent["y"] + parent["height"] + tolerance, (
        f"{label}: bottom overflow"
    )


def center(box: dict[str, float]) -> dict[str, float]:
    return {
        "x": box["x"] + box["width"] / 2,
        "y": box["y"] + box["height"] / 2,
    }


def css_size(target: Locator) -> dict[str, float]:
    return target.evaluate(
        "element => { const style = getComputedStyle(element); "
        "return {width: parseFloat(style.width), height: parseFloat(style.height)}; }"
    )


def drag_from_point(
    page: Page,
    point: dict[str, float],
    *,
    dx: float = 36,
    dy: float = 24,
) -> None:
    page.mouse.move(point["x"], point["y"])
    page.mouse.down()
    page.mouse.move(point["x"] + dx, point["y"] + dy, steps=8)
    page.mouse.up()


def assert_position_changed(
    before: dict[str, float],
    after: dict[str, float],
    label: str,
) -> None:
    assert abs(after["x"] - before["x"]) >= 5, f"{label}: x position did not change"
    assert abs(after["y"] - before["y"]) >= 5, f"{label}: y position did not change"


def assert_position_unchanged(
    before: dict[str, float],
    after: dict[str, float],
    label: str,
) -> None:
    tolerance = 1
    assert abs(after["x"] - before["x"]) <= tolerance, f"{label}: x position changed"
    assert abs(after["y"] - before["y"]) <= tolerance, f"{label}: y position changed"


def dismiss_inspector(page: Page) -> None:
    inspector = page.get_by_test_id("aigc-inspector")
    pane = page.locator(".react-flow__pane")
    if pane.count():
        pane_box = pane.bounding_box()
        if pane_box:
            page.mouse.click(
                pane_box["x"] + 12,
                pane_box["y"] + pane_box["height"] - 12,
            )
    page.wait_for_timeout(250)
    for _ in range(3):
        close_inspector = page.locator(
            'button[aria-label="关闭详情栏"]:visible'
        )
        if not close_inspector.count():
            return
        close_inspector.click()
        inspector.wait_for(state="hidden")
        page.wait_for_timeout(150)
    assert not inspector.is_visible(), "inspector reopened after close"


def wait_for_autosave(page: Page) -> None:
    page.wait_for_timeout(850)
    page.wait_for_function(
        """() => {
          const status = document.querySelector(
            '[data-testid="aigc-autosave-status"]'
          );
          return ["idle", "saved"].includes(
            status?.getAttribute("data-status") ?? ""
          );
        }"""
    )


def reload_canvas(page: Page) -> None:
    page.reload(wait_until="domcontentloaded")
    page.get_by_test_id("aigc-editor-header").wait_for()
    dismiss_inspector(page)
    fit_view = page.locator(".react-flow__controls-fitview")
    if fit_view.is_visible():
        fit_view.click()
        page.wait_for_timeout(500)
        wait_for_autosave(page)


def modality_drag_point(page: Page, kind: str) -> dict[str, float]:
    target = node(page, NODE_IDS[kind])
    point = target.evaluate(
        """element => {
          const rect = element.getBoundingClientRect();
          const fractions = [0.02, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.98];
          const interactive =
            ".nodrag,button,a,input,textarea,select,audio,video," +
            ".react-flow__handle,.react-flow__resize-control";
          for (const yFraction of fractions) {
            for (const xFraction of fractions) {
              const x = rect.x + rect.width * xFraction;
              const y = rect.y + rect.height * yFraction;
              const hit = document.elementFromPoint(x, y);
              if (
                hit &&
                hit.closest(".react-flow__node") === element &&
                !hit.closest(interactive)
              ) {
                return {x, y};
              }
            }
          }
          return null;
        }"""
    )
    assert point, (
        f"{kind}: no visible non-interactive drag surface at "
        f"{page.viewport_size}, node={target.bounding_box()}, "
        f"inspector_visible={page.get_by_test_id('aigc-inspector').is_visible()}"
    )
    return point


def assert_control_does_not_drag(
    page: Page,
    target: Locator,
    control: Locator,
    label: str,
) -> None:
    before = target.bounding_box()
    control_box = control.bounding_box()
    assert before, f"{label}: missing node bounds"
    assert control_box, f"{label}: missing control bounds"
    start = center(control_box)
    page.mouse.move(start["x"], start["y"])
    page.mouse.down()
    page.mouse.move(
        before["x"] + before["width"] / 2,
        before["y"] + 2,
        steps=8,
    )
    page.mouse.up()
    page.wait_for_timeout(100)
    dialog = page.get_by_role("dialog")
    if dialog.count() and dialog.is_visible():
        page.keyboard.press("Escape")
        dialog.wait_for(state="hidden")
    after = target.bounding_box()
    assert after, f"{label}: missing node bounds after control gesture"
    assert_position_unchanged(before, after, label)


def verify_viewport(
    browser: Browser,
    viewport: dict[str, Any],
    pipeline: dict[str, Any],
    runs_page: dict[str, Any],
    run_detail: dict[str, Any],
) -> dict[str, Any]:
    context = browser.new_context(
        accept_downloads=True,
        viewport={"width": viewport["width"], "height": viewport["height"]},
    )
    page = context.new_page()
    console_errors: list[str] = []
    page_errors: list[str] = []
    request_failures: list[str] = []
    page.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on(
        "requestfailed",
        lambda request: request_failures.append(
            f"{request.url}: {request.failure}"
        ),
    )
    page.route("http://127.0.0.1:7777/**", lambda route: route.fulfill(status=204))
    page.route("http://127.0.0.1:7778/**", lambda route: route.fulfill(status=204))
    page.route(
        f"**/api/aigc/pipelines/{pipeline['id']}/runs?**",
        lambda route: fulfill_json(route, runs_page),
    )
    page.route(
        "**/api/aigc/runs/title-qa-run",
        lambda route: fulfill_json(route, run_detail),
    )

    try:
        page.goto(
            f"{FRONTEND_URL}/workspace/aigc/acceptance?pipelineId={pipeline['id']}",
            wait_until="networkidle",
        )
        page.get_by_test_id("aigc-editor-header").wait_for()
        dismiss_inspector(page)
        fit_view = page.locator(".react-flow__controls-fitview")
        if fit_view.is_visible():
            fit_view.click()
            page.wait_for_timeout(500)

        for kind in ("audio", "video", "image", "text"):
            target = node(page, NODE_IDS[kind])
            target.wait_for()
            assert target.get_by_test_id("aigc-node-title").count() == 0
            assert target.get_by_test_id("aigc-node-title-row").count() == 0
            assert target.get_by_role(
                "group", name=f"{kind.title()} QA", exact=True
            ).count() == 1

        for kind, title in (("model", "Model QA"), ("control", "Control QA")):
            target = node(page, NODE_IDS[kind])
            target.wait_for()
            assert target.get_by_test_id("aigc-node-title").inner_text() == title

        assert node(page, NODE_IDS["text"]).get_by_text(
            "Task 5 text content remains visible.", exact=True
        ).is_visible()
        image = node(page, NODE_IDS["image"]).locator("img")
        image.wait_for()
        assert image.evaluate("element => element.complete && element.naturalWidth > 0")
        assert node(page, NODE_IDS["video"]).locator("video").is_visible()
        assert node(page, NODE_IDS["audio"]).locator("audio").is_visible()

        image_node = node(page, NODE_IDS["image"])
        image_card = image_node.get_by_role("group", name="Image QA", exact=True)
        image_preview = image_node.get_by_test_id("aigc-image-preview")
        image_actions = image_node.get_by_test_id("aigc-image-node-actions")
        image_action = image_actions.get_by_role("button", name="精准编辑")
        image_action.wait_for()
        image_box = image_card.bounding_box()
        image_action_box = image_actions.bounding_box()
        image_button_box = image_action.bounding_box()
        image_icon_box = image_action.locator("svg").bounding_box()
        image_action_size = css_size(image_actions)
        image_button_size = css_size(image_action)
        image_icon_size = css_size(image_action.locator("svg"))
        assert image_box, "image: missing card bounds"
        assert image_action_box, "image: missing external action bounds"
        assert image_button_box, "image: missing precise edit button bounds"
        assert image_icon_box, "image: missing precise edit icon bounds"
        assert image_action_size == {"width": 12, "height": 12}
        assert image_button_size == {"width": 10, "height": 10}
        assert image_icon_size == {"width": 6, "height": 6}
        assert image_action_box["y"] + image_action_box["height"] <= image_box["y"], (
            "image: precise edit action must sit above the card"
        )
        assert abs(
            image_action_box["x"]
            + image_action_box["width"]
            - image_box["x"]
            - image_box["width"]
        ) <= 1, "image: precise edit action must align to the card right edge"
        for handle_box in image_node.locator(".react-flow__handle").evaluate_all(
            "els => els.map(el => { const r = el.getBoundingClientRect(); "
            "return {x:r.x,y:r.y,width:r.width,height:r.height}; })"
        ):
            assert not boxes_overlap(image_action_box, handle_box), (
                "image: precise edit action overlaps port"
            )
        text_card = node(page, NODE_IDS["text"]).get_by_role(
            "group", name="Text QA", exact=True
        )
        assert image_preview.evaluate(
            "(element) => getComputedStyle(element).backgroundColor"
        ) == text_card.evaluate(
            "(element) => getComputedStyle(element).backgroundColor"
        ), "image: preview background differs from text node"
        audio_download = node(page, NODE_IDS["audio"]).get_by_role(
            "link", name="下载音频"
        )
        audio_download.wait_for()
        assert audio_download.get_attribute("download")

        for kind in ("text", "image", "video", "audio", "model", "control"):
            target = node(page, NODE_IDS[kind])
            target_box = target.bounding_box()
            assert target_box, f"{kind}: missing node bounds"
            descendants = target.locator(
                "[data-testid='aigc-node-actions'], img, video, audio, "
                "[data-testid='aigc-node-name-input']"
            )
            for index in range(descendants.count()):
                item = descendants.nth(index)
                if item.is_visible():
                    item_box = item.bounding_box()
                    if item_box:
                        assert_contained(item_box, target_box, f"{kind} content")
            actions = target.get_by_test_id("aigc-node-actions")
            if actions.count() and actions.is_visible():
                action_box = actions.bounding_box()
                assert action_box
                for handle_box in target.locator(".react-flow__handle").evaluate_all(
                    "els => els.map(el => { const r = el.getBoundingClientRect(); "
                    "return {x:r.x,y:r.y,width:r.width,height:r.height}; })"
                ):
                    assert not boxes_overlap(action_box, handle_box), (
                        f"{kind}: action overlaps port"
                    )

        drag_kinds = ("audio", "video", "image", "text")
        for index, kind in enumerate(drag_kinds):
            target = node(page, NODE_IDS[kind])
            before = target.bounding_box()
            assert before, f"{kind}: missing node bounds before drag"
            drag_point = modality_drag_point(page, kind)
            drag_from_point(page, drag_point)
            wait_for_autosave(page)
            after = target.bounding_box()
            assert after, f"{kind}: missing node bounds after drag"
            assert_position_changed(before, after, f"{viewport['name']} {kind}")
            if index < len(drag_kinds) - 1:
                reload_canvas(page)

        reload_canvas(page)

        assert_control_does_not_drag(
            page,
            node(page, NODE_IDS["audio"]),
            node(page, NODE_IDS["audio"]).locator("audio"),
            "audio control",
        )
        reload_canvas(page)
        assert_control_does_not_drag(
            page,
            node(page, NODE_IDS["video"]),
            node(page, NODE_IDS["video"]).locator("video"),
            "video control",
        )
        reload_canvas(page)
        assert_control_does_not_drag(
            page,
            node(page, NODE_IDS["image"]),
            node(page, NODE_IDS["image"]).get_by_role(
                "button", name="精准编辑"
            ),
            "image precise edit control",
        )
        assert_control_does_not_drag(
            page,
            node(page, NODE_IDS["image"]),
            node(page, NODE_IDS["image"]).get_by_role(
                "button", name="查看原图"
            ),
            "image preview control",
        )
        assert_control_does_not_drag(
            page,
            node(page, NODE_IDS["text"]),
            node(page, NODE_IDS["text"]).get_by_role(
                "button", name="复制文本"
            ),
            "text copy control",
        )

        text_node = node(page, NODE_IDS["text"])
        text_node_box = text_node.bounding_box()
        assert text_node_box, "text: missing bounds for context menu"
        text_node.evaluate(
            """(element, point) => element.dispatchEvent(
              new MouseEvent("contextmenu", {
                bubbles: true,
                button: 2,
                cancelable: true,
                clientX: point.x,
                clientY: point.y
              })
            )""",
            center(text_node_box),
        )
        page.get_by_test_id("aigc-node-context-menu").wait_for()
        page.get_by_role("menuitem", name="重命名").click()
        rename_input = text_node.get_by_role("textbox", name="节点名称")
        rename_input.wait_for()
        assert text_node.get_by_test_id("aigc-node-title-row").is_visible()
        rename_box = rename_input.bounding_box()
        text_box = text_node.bounding_box()
        assert rename_box and text_box
        assert_contained(rename_box, text_box, "rename input")
        for handle_box in text_node.locator(".react-flow__handle").evaluate_all(
            "els => els.map(el => { const r = el.getBoundingClientRect(); "
            "return {x:r.x,y:r.y,width:r.width,height:r.height}; })"
        ):
            assert not boxes_overlap(rename_box, handle_box), "rename input overlaps port"
        rename_input.press("Escape")
        assert text_node.get_by_test_id("aigc-node-title-row").count() == 0

        page.wait_for_function(
            """() => {
              const action = document.querySelector(
                '[data-testid="aigc-image-node-actions"] button'
              );
              return action instanceof HTMLButtonElement && !action.disabled;
            }"""
        )
        assert image_action.is_enabled(), "precise edit action is disabled"
        image_action.evaluate("element => element.click()")
        dialog = page.get_by_role("dialog")
        dialog.wait_for()
        dialog_box = dialog.bounding_box()
        assert dialog_box
        assert_contained(
            dialog_box,
            {
                "x": 0,
                "y": 0,
                "width": viewport["width"],
                "height": viewport["height"],
            },
            "precise edit dialog",
        )
        page.keyboard.press("Escape")
        dialog.wait_for(state="hidden")

        downloaded = False
        if viewport["name"] == "desktop":
            with page.expect_download(timeout=30_000) as download_info:
                audio_download.click()
            download = download_info.value
            destination = RESULTS_DIR / "audio-download"
            download.save_as(destination)
            downloaded = destination.stat().st_size > 0
            assert downloaded

        reload_canvas(page)
        overflow = page.evaluate(
            "() => document.documentElement.scrollWidth > "
            "document.documentElement.clientWidth"
        )
        assert not overflow, f"{viewport['name']}: horizontal page overflow"
        assert not console_errors, (
            f"{viewport['name']}: console errors: {console_errors}; "
            f"request failures: {request_failures}"
        )
        assert not page_errors, f"{viewport['name']}: page errors: {page_errors}"

        screenshot = RESULTS_DIR / f"{viewport['name']}-{viewport['width']}x{viewport['height']}.png"
        page.screenshot(path=str(screenshot), full_page=True)
        return {
            "name": viewport["name"],
            "size": f"{viewport['width']}x{viewport['height']}",
            "screenshot": str(screenshot),
            "modality_titles_hidden": 4,
            "representative_titles_visible": 2,
            "draggable_modalities": 4,
            "isolated_controls": 5,
            "download_verified": downloaded,
            "console_errors": len(console_errors),
            "page_errors": len(page_errors),
        }
    finally:
        context.close()


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    assets = choose_assets()
    pipeline = create_pipeline(assets)
    runs_page, run_detail = run_fixture(pipeline, assets)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                results = [
                    verify_viewport(browser, viewport, pipeline, runs_page, run_detail)
                    for viewport in VIEWPORTS
                ]
            finally:
                browser.close()
        print(
            json.dumps(
                {
                    "result": "PASS",
                    "pipeline_id": pipeline["id"],
                    "viewports": results,
                },
                indent=2,
            )
        )
    finally:
        api_json(f"/api/aigc/pipelines/{pipeline['id']}", method="DELETE")


if __name__ == "__main__":
    main()
