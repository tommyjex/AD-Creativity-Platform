from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, sync_playwright


FRONTEND_URL = sys.argv[1].rstrip("/")
BACKEND_URL = sys.argv[2].rstrip("/")
MOCK_BACKEND_URL = sys.argv[3].rstrip("/")
OUTPUT_DIR = Path("test-results/structure-english-image-prompts")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

VIEWPORTS = (
    ("desktop", 1440, 900),
    ("tablet", 1024, 768),
    ("mobile", 390, 844),
)
PROTECTED = (
    "“家庭清洁专家”",
    "ACME",
    "ZX-9",
    "Image 1 <bbox> 100 200 700 800 </bbox>",
)
CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]")
LINE = re.compile(r"^[A-Za-z][A-Za-z0-9 &/-]{1,39}: .+$")
CANONICAL_ANCHOR = re.compile(
    r"\s*(?:Preserve exact identity|Honor exclusion exactly|"
    r"Preserve exact quantity-object constraint): .*?"
    r"(?=\s+(?:Preserve exact identity|Honor exclusion exactly|"
    r"Preserve exact quantity-object constraint):|$)"
)


def api_request(
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> Any:
    body = json.dumps(payload, ensure_ascii=False).encode() if payload else None
    request = urllib.request.Request(
        f"{BACKEND_URL}{path}",
        data=body,
        headers={"content-type": "application/json"} if body else {},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            content = response.read()
            return json.loads(content) if content else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"{method} {path} failed with HTTP {error.code}: {detail}"
        ) from error


def text_node(node_id: str, title: str, text: str, x: int, y: int) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": "text",
        "position": {"x": x, "y": y},
        "size": {"width": 300, "height": 220},
        "config": {
            "text": text,
            "bbox_references": [],
            "title": title,
        },
    }


def image_model(
    node_id: str,
    node_type: str,
    x: int,
    y: int,
    *,
    operation: str | None = None,
) -> dict[str, Any]:
    config = {
        "model": "doubao-seedream-5-0-pro-260628",
        "aspect_ratio": "9:16" if node_id == "indoor-model" else "1:1",
        "size": "2K",
        "format": "png",
    }
    if operation:
        config["operation"] = operation
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": x, "y": y},
        "size": {"width": 300, "height": 240},
        "config": config,
    }


def edge(
    edge_id: str,
    source: str,
    source_handle: str,
    target: str,
    target_handle: str,
) -> dict[str, str]:
    return {
        "id": edge_id,
        "sourceNodeId": source,
        "sourceHandle": source_handle,
        "targetNodeId": target,
        "targetHandle": target_handle,
    }


def fixture_payload(asset_id: str) -> dict[str, Any]:
    indoor = text_node(
        "indoor-prompt",
        "室内文生图验收",
        "室内客厅中，一位人物与一只猫展示红色产品，9:16，不要出现多余人物。",
        40,
        40,
    )
    product = text_node(
        "product-prompt",
        "商品文生图验收",
        "红色商品包装主图，品牌: ACME，型号: ZX-9，包装上显示“家庭清洁专家”，"
        "不要出现多余人物，不改变包装文字，1:1。",
        40,
        340,
    )
    edit = text_node(
        "edit-prompt",
        "图片编辑验收",
        "只替换背景，保留红色产品，品牌: ACME，型号: ZX-9。",
        400,
        660,
    )
    bbox_prompt = text_node(
        "bbox-prompt",
        "BBox 图生图验收",
        "保留红色产品并调整框选人物。",
        400,
        980,
    )
    bbox_prompt["config"]["bbox_references"] = [
        {
            "source_node_id": "bbox-source-2",
            "instruction": "缩小框选人物，保持蓝色外套。",
        }
    ]
    return {
        "name": (
            "[临时验收 6.3-6.5] "
            + datetime.now(timezone.utc).isoformat(timespec="seconds")
        ),
        "description": "Mock Provider browser acceptance fixture; never execute.",
        "definition": {
            "schemaVersion": 2,
            "nodes": [
                indoor,
                image_model("indoor-model", "text_to_image", 400, 40),
                product,
                image_model("product-model", "text_to_image", 400, 340),
                {
                    "id": "bbox-source",
                    "type": "image",
                    "position": {"x": 40, "y": 660},
                    "size": {"width": 300, "height": 240},
                    "config": {
                        "asset_id": asset_id,
                        "title": "图片编辑来源图",
                    },
                },
                edit,
                image_model(
                    "edit-model",
                    "image_to_image",
                    780,
                    660,
                    operation="image_edit",
                ),
                {
                    "id": "bbox-source-2",
                    "type": "image",
                    "position": {"x": 40, "y": 980},
                    "size": {"width": 300, "height": 240},
                    "config": {
                        "asset_id": asset_id,
                        "bbox_asset_id": asset_id,
                        "bbox": {
                            "type": "bbox",
                            "x1": 100,
                            "y1": 200,
                            "x2": 700,
                            "y2": 800,
                        },
                        "title": "BBox Token 来源图",
                    },
                },
                bbox_prompt,
                image_model("bbox-model", "image_to_image", 780, 980),
            ],
            "edges": [
                edge(
                    "indoor-prompt-edge",
                    "indoor-prompt",
                    "text",
                    "indoor-model",
                    "prompt",
                ),
                edge(
                    "product-prompt-edge",
                    "product-prompt",
                    "text",
                    "product-model",
                    "prompt",
                ),
                edge(
                    "edit-image-edge",
                    "bbox-source",
                    "image",
                    "edit-model",
                    "edit_image",
                ),
                edge(
                    "edit-prompt-edge",
                    "edit-prompt",
                    "text",
                    "edit-model",
                    "prompt",
                ),
                edge(
                    "bbox-image-edge",
                    "bbox-source-2",
                    "image",
                    "bbox-model",
                    "image",
                ),
                edge(
                    "bbox-prompt-edge",
                    "bbox-prompt",
                    "text",
                    "bbox-model",
                    "prompt",
                ),
            ],
            "viewport": {"x": 30, "y": 30, "zoom": 0.72},
        },
    }


def assert_layered_english(value: str) -> list[str]:
    lines = value.splitlines()
    assert 4 <= len(lines) <= 10, lines
    assert all(LINE.fullmatch(line) for line in lines), lines
    labels = [line.split(":", 1)[0].casefold() for line in lines]
    assert labels[-2:] == ["composition", "negative prompt"], labels
    assert len(labels) == len(set(labels)), labels
    masked = value
    masked = "\n".join(
        CANONICAL_ANCHOR.sub("", line) for line in masked.splitlines()
    )
    for literal in PROTECTED:
        masked = masked.replace(literal, "")
    assert not CJK.search(masked), masked
    return lines


def click_node(page: Page, node_id: str) -> None:
    page.locator(f'[data-id="{node_id}"]').get_by_test_id(
        "aigc-node-title"
    ).dispatch_event("click")
    optimize = page.get_by_role("button", name="优化提示词")
    if optimize.count() == 0 or not optimize.first.is_visible():
        inspector = page.get_by_role("button", name="打开检查器")
        if inspector.count():
            inspector.click()
    optimize.wait_for(state="visible")


def box_in_viewport(page: Page, box: dict[str, float]) -> bool:
    viewport = page.viewport_size
    assert viewport is not None
    return (
        box["x"] >= -1
        and box["y"] >= -1
        and box["x"] + box["width"] <= viewport["width"] + 1
        and box["y"] + box["height"] <= viewport["height"] + 1
    )


def assert_layout(page: Page) -> dict[str, Any]:
    metrics = page.evaluate(
        """() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          bodyWidth: document.body.scrollWidth,
          viewportHeight: document.documentElement.clientHeight
        })"""
    )
    assert metrics["documentWidth"] <= metrics["viewportWidth"] + 1, metrics
    assert metrics["bodyWidth"] <= metrics["viewportWidth"] + 1, metrics

    dialog = page.get_by_role("dialog", name="优化提示词")
    body = page.get_by_test_id("aigc-prompt-optimization-body")
    footer = page.get_by_test_id("aigc-prompt-optimization-footer")
    dialog_box = dialog.bounding_box()
    footer_box = footer.bounding_box()
    assert dialog_box is not None and box_in_viewport(page, dialog_box), dialog_box
    assert footer_box is not None and box_in_viewport(page, footer_box), footer_box

    scroll_metrics = body.evaluate(
        """element => ({
          clientHeight: element.clientHeight,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          scrollWidth: element.scrollWidth
        })"""
    )
    assert scroll_metrics["scrollWidth"] <= scroll_metrics["clientWidth"] + 1, (
        scroll_metrics
    )
    body_scrollable = (
        scroll_metrics["scrollHeight"] > scroll_metrics["clientHeight"] + 1
    )
    initially_clipped_textareas = 0
    for textarea in dialog.locator("textarea:visible").all():
        initial_box = textarea.bounding_box()
        assert initial_box is not None
        if not box_in_viewport(page, initial_box):
            initially_clipped_textareas += 1
            assert body_scrollable, (initial_box, scroll_metrics)
            textarea.scroll_into_view_if_needed()
            reached_box = textarea.bounding_box()
            assert reached_box is not None and box_in_viewport(page, reached_box), (
                reached_box,
                scroll_metrics,
            )
            footer_after_scroll = footer.bounding_box()
            assert footer_after_scroll is not None and box_in_viewport(
                page, footer_after_scroll
            ), footer_after_scroll

    dialog_buttons = page.locator("[role=dialog] button:visible")
    boxes = [item.bounding_box() for item in dialog_buttons.all()]
    boxes = [box for box in boxes if box is not None]
    assert boxes and all(box_in_viewport(page, box) for box in boxes), boxes
    for index, left in enumerate(boxes):
        for right in boxes[index + 1 :]:
            overlap_x = min(left["x"] + left["width"], right["x"] + right["width"]) - max(
                left["x"], right["x"]
            )
            overlap_y = min(left["y"] + left["height"], right["y"] + right["height"]) - max(
                left["y"], right["y"]
            )
            assert overlap_x <= 0 or overlap_y <= 0, (left, right)
    return {
        "dialog_box": dialog_box,
        "footer_box": footer_box,
        "body": scroll_metrics,
        "body_scrollable": body_scrollable,
        "initially_clipped_textareas": initially_clipped_textareas,
        "dialog_button_count": len(boxes),
        "horizontal_overflow": False,
        "button_overlap": False,
    }


def optimize(page: Page, node_id: str, direction: str = "") -> dict[str, Any]:
    click_node(page, node_id)
    page.get_by_role("button", name="优化提示词").click()
    dialog = page.get_by_role("dialog", name="优化提示词")
    dialog.wait_for(state="visible")
    if direction:
        dialog.get_by_role("textbox", name="优化方向").fill(direction)
    layout = assert_layout(page)
    with page.expect_response(
        lambda response: response.request.method == "POST"
        and response.url.endswith("/api/aigc/prompts/optimize")
    ) as response_info:
        dialog.get_by_role("button", name="开始优化").click()
    response = response_info.value
    assert response.status == 200, response.text()
    payload = response.json()
    page.get_by_text("提示词已优化，可撤销恢复。").wait_for(state="visible")
    assert page.get_by_role("textbox", name="基础文本").input_value() == payload[
        "optimized_text"
    ]
    payload["_layout"] = layout
    return payload


assets = api_request("/api/assets?status=succeeded")
fixture_asset = next(
    (
        asset
        for asset in assets
        if str(asset.get("mime_type", "")).startswith("image/")
        and asset.get("asset_role") == "public"
    ),
    None,
)
if fixture_asset is None:
    raise RuntimeError("No succeeded public image asset is available for the fixture")
pipeline = api_request(
    "/api/aigc/pipelines",
    method="POST",
    payload=fixture_payload(fixture_asset["id"]),
)
pipeline_id = pipeline["id"]
pipeline_url = f"{FRONTEND_URL}/workspace/aigc/acceptance?pipelineId={pipeline_id}"
report: dict[str, Any] = {
    "fixture": {
        "pipeline_id": pipeline_id,
        "pipeline_name": pipeline["name"],
        "schema_version": pipeline["definition"]["schemaVersion"],
        "asset_id": fixture_asset["id"],
        "url": pipeline_url,
    },
    "provider": {
        "type": "MockModelArkAdapter",
        "endpoint": MOCK_BACKEND_URL,
        "real_billing_disabled": True,
    },
    "viewports": {},
}

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for name, width, height in VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height})
            page.set_default_timeout(15_000)
            routed_mock_requests: list[str] = []

            def route_optimization(route: Any) -> None:
                routed_mock_requests.append(route.request.post_data or "")
                route.continue_(
                    url=f"{MOCK_BACKEND_URL}/api/aigc/prompts/optimize"
                )

            page.route(
                "**/api/aigc/prompts/optimize",
                route_optimization,
            )
            page.route(
                f"**/api/aigc/pipelines/{pipeline_id}",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(pipeline, ensure_ascii=False),
                )
                if route.request.method == "PUT"
                else route.continue_(),
            )
            page.route("http://127.0.0.1:7777/**", lambda route: route.fulfill(status=204))
            page.route("http://127.0.0.1:7778/**", lambda route: route.fulfill(status=204))
            console_errors: list[str] = []
            page_errors: list[str] = []
            requests: list[dict[str, str]] = []
            responses: list[dict[str, Any]] = []
            page.on(
                "console",
                lambda message: console_errors.append(message.text)
                if message.type == "error"
                else None,
            )
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on(
                "request",
                lambda request: requests.append(
                    {"method": request.method, "url": request.url}
                ),
            )
            page.on(
                "response",
                lambda response: responses.append(
                    {"status": response.status, "url": response.url}
                ),
            )

            page.goto(pipeline_url)
            page.wait_for_load_state("networkidle")
            titles = page.get_by_test_id("aigc-node-title").all_inner_texts()
            buttons = page.get_by_role("button").all_inner_texts()
            for node_id in (
                "indoor-prompt",
                "product-prompt",
                "edit-prompt",
                "bbox-prompt",
            ):
                assert page.locator(f'[data-id="{node_id}"]').count() == 1
            page.screenshot(
                path=str((OUTPUT_DIR / f"{name}-reconnaissance.png").resolve()),
                full_page=True,
            )

            indoor = optimize(page, "indoor-prompt", "强调室内空间层次")
            indoor_lines = assert_layered_english(indoor["optimized_text"])
            assert any(line.startswith("Space:") for line in indoor_lines)
            assert any(line.startswith("People:") for line in indoor_lines)
            assert any(line.startswith("Animals:") for line in indoor_lines)

            product = optimize(page, "product-prompt", "强化商品质感")
            product_lines = assert_layered_english(product["optimized_text"])
            assert any(line.startswith("Product:") for line in product_lines)
            assert not any(line.startswith("People:") for line in product_lines)
            for literal in ("“家庭清洁专家”", "ACME", "ZX-9"):
                assert literal in product["optimized_text"]
            for canonical_anchor in (
                "Preserve exact identity: ACME",
                "Preserve exact identity: ZX-9",
                "Honor exclusion exactly: 不要出现多余人物",
                "Honor exclusion exactly: 不改变包装文字",
            ):
                assert canonical_anchor in product["optimized_text"]

            edit = optimize(page, "edit-prompt", "仅替换背景")
            edit_lines = assert_layered_english(edit["optimized_text"])
            labels = [line.split(":", 1)[0] for line in edit_lines]
            assert "Reference Usage" in labels
            assert "Edit Instructions" in labels
            assert "Preserve" in labels

            click_node(page, "bbox-prompt")
            reference = page.get_by_role(
                "textbox", name=re.compile(r"^框选引用说明：")
            )
            bbox_token = "Image 1 <bbox> 100 200 700 800 </bbox>"
            bbox = optimize(page, "bbox-prompt", "仅编辑框选区域")
            bbox_lines = assert_layered_english(bbox["optimized_text"])
            assert len(bbox["optimized_reference_instructions"]) == 1
            optimized_reference = bbox["optimized_reference_instructions"][0]
            assert "blue" in optimized_reference.casefold()
            assert page.get_by_role(
                "group",
                name=re.compile(r"bbox 100 200 700 800"),
            ).is_visible()
            assert reference.input_value() == optimized_reference
            bbox_api = page.evaluate(
                """async ({ token }) => {
                  const response = await fetch(
                    "http://localhost:8000/api/aigc/prompts/optimize",
                    {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        target_node_id: "bbox-api-model",
                        target_type: "image_to_image",
                        target_config: {
                          model: "doubao-seedream-5-0-pro-260628",
                          operation: "image_to_image",
                          aspect_ratio: "1:1",
                          size: "2K",
                          reference_image_count: 1
                        },
                        optimization_direction: "Preserve the selected region",
                        text: "保留红色产品并调整框选人物。",
                        reference_instructions: [
                          `缩小框选人物，保持蓝色外套，保留 ${token}。`
                        ]
                      })
                    }
                  );
                  return { status: response.status, body: await response.json() };
                }""",
                {"token": bbox_token},
            )
            assert bbox_api["status"] == 200, bbox_api
            assert bbox_token in bbox_api["body"][
                "optimized_reference_instructions"
            ][0]

            page.get_by_role("button", name="优化提示词").click()
            page.get_by_role("dialog", name="优化提示词").wait_for(state="visible")
            final_layout = assert_layout(page)
            page.screenshot(
                path=str((OUTPUT_DIR / f"{name}-optimized-dialog.png").resolve()),
                full_page=True,
            )

            optimization_posts = [
                item
                for item in requests
                if item["method"] == "POST"
                and item["url"].endswith("/api/aigc/prompts/optimize")
            ]
            assert len(optimization_posts) == 5, optimization_posts
            assert len(routed_mock_requests) == 5, routed_mock_requests
            assert all(
                item["url"].endswith("/api/aigc/prompts/optimize")
                for item in optimization_posts
            ), optimization_posts
            forbidden = re.compile(
                r"/runs(?:[/?]|$)|/images(?:[/?]|$)|generate|generation",
                re.IGNORECASE,
            )
            generation_requests = [
                item
                for item in requests
                if item["method"] not in {"GET", "HEAD"}
                and "/prompts/optimize" not in item["url"]
                and forbidden.search(item["url"])
            ]
            assert not generation_requests, generation_requests
            assert all(
                item["url"].startswith(("http://127.0.0.1:", "http://localhost:"))
                for item in requests
            ), requests
            assert not console_errors, console_errors
            assert not page_errors, page_errors
            assert not [
                item for item in responses if item["status"] >= 400
            ], responses

            report["viewports"][name] = {
                "size": [width, height],
                "reconnaissance": {
                    "node_titles": titles,
                    "button_count": len(buttons),
                    "textarea_count": page.locator("textarea").count(),
                },
                "assertions": {
                    "indoor_labels": [
                        line.split(":", 1)[0] for line in indoor_lines
                    ],
                    "product_labels": [
                        line.split(":", 1)[0] for line in product_lines
                    ],
                    "edit_labels": labels,
                    "bbox_labels": [
                        line.split(":", 1)[0] for line in bbox_lines
                    ],
                    "protected_literals": list(PROTECTED),
                    "bbox_coordinates": [100, 200, 700, 800],
                    "bbox_api_reference": bbox_api["body"][
                        "optimized_reference_instructions"
                    ][0],
                    "mock_optimization_count": len(routed_mock_requests),
                    "line_counts": {
                        "indoor": len(indoor_lines),
                        "product": len(product_lines),
                        "image_edit": len(edit_lines),
                        "bbox": len(bbox_lines),
                    },
                    "product_people_absent": not any(
                        line.startswith("People:") for line in product_lines
                    ),
                    "layouts": {
                        "indoor": indoor["_layout"],
                        "product": product["_layout"],
                        "image_edit": edit["_layout"],
                        "bbox": bbox["_layout"],
                        "final_dialog": final_layout,
                    },
                    "generation_requests": generation_requests,
                    "optimization_requests": optimization_posts,
                    "network_requests": requests,
                    "console_errors": console_errors,
                    "page_errors": page_errors,
                    "http_errors": [
                        item for item in responses if item["status"] >= 400
                    ],
                },
                "screenshots": [
                    f"{name}-reconnaissance.png",
                    f"{name}-optimized-dialog.png",
                ],
            }
            page.close()
        browser.close()
        report["result"] = {
            "status": "passed",
            "completed_viewports": list(report["viewports"]),
        }
finally:
    try:
        api_request(f"/api/aigc/pipelines/{pipeline_id}", method="DELETE")
        report["fixture"]["deleted"] = True
    except Exception as error:
        report["fixture"]["deleted"] = False
        report["fixture"]["delete_error"] = str(error)
    (OUTPUT_DIR / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

print(json.dumps(report, ensure_ascii=False, indent=2))
