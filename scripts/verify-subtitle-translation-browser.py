"""Offline real-UI acceptance. All business APIs are in-memory fixtures.

Start --serve-fixture on 8058 before Next with BACKEND_INTERNAL_BASE_URL set
to that address. Run this script against Next at --base-url (default 3058).
No model, MediaKit, object-store or production backend is contacted.

--role-font-checks --font-dir additionally requires fontTools to compare the
downloaded fonts' PostScript names against Chromium's actual rendered fonts.
"""

import argparse
from copy import deepcopy
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "frontend/public/acceptance/aigc-video-fullscreen.mp4"
FONT_FIXTURE = ROOT / "backend/tests/fixtures/subtitle_fonts/ABeeZee-Regular.ttf"
FONT_ROOT = "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF"
FONT_URLS = {
    f"{FONT_ROOT}/CN/SourceHanSansCN-Regular.otf",
    f"{FONT_ROOT}/JP/SourceHanSansJP-Regular.otf",
    "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf",
    "https://xujianhua-utils.tos-cn-beijing.volces.com/CenturyGothic/centurygothic_bold.ttf",
    "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/AvenirLTStd-Black.otf",
    "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/AvenirLTStd-Light.otf",
}
ROLE_FONT_URLS = {
    "CenturyGothic": "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf",
    "CenturyGothicBold": "https://xujianhua-utils.tos-cn-beijing.volces.com/CenturyGothic/centurygothic_bold.ttf",
}
OUT = Path("/tmp/subtitle-category-browser-acceptance")
NOW = "2026-10-26T00:00:00Z"
META = dict(width=1280, height=720, duration_ms=4500, rotation=0, fps=30, has_audio=True)
PREFIX = "/api/tools/subtitle-translation/workspaces"
PRODUCT_EVIDENCE = ROOT / ".trae/specs/recognize-and-style-product-names/evidence"


def asset(identifier):
    return dict(
        id=identifier, project_id=None, tool_asset_role="input", type="uploaded_video",
        category=None, status="succeeded", stage=None,
        url=f"/api/assets/{identifier}/content", object_key=f"tools/{identifier}.mp4",
        mime_type="video/mp4", size_bytes=2048, source_task_id=None,
        metadata={"name": f"{identifier}.mp4", "tool_asset_kind": "video"},
        created_at=NOW, updated_at=NOW,
    )


def workspace(identifier="workspace-a"):
    return dict(
        id=identifier, name=f"Acceptance {identifier}", revision=1, stage="draft",
        reference_video_asset_id=None, clean_video_asset_id=None,
        source_language="auto", target_language="de", reference_video=None,
        clean_video=None, segments=[], active_task_id=None, stage_task_ids={},
        output_asset_id=None,
        warnings=["fps_support_local_contract_only", "line-1:font_url_version_unverified",
                  "line-2:font_url_version_unverified", "line-1:low_contrast"],
        created_at=NOW, updated_at=NOW,
    )


def segment(index):
    return dict(
        segment_id=f"line-{index}", text=f"Reference label {index}",
        translated_text=None, translation_status="pending", start_ms=1000,
        end_ms=3000 if index == 1 else 5000,
        bbox_normalized=[100, 100 * index, 800, 100 * index + 80],
        bbox_pixels=[128, 72 * index, 1024, 72 * index + 58],
        visual_role="headline" if index == 1 else "footnote",
        font_height_ratio=0.08, alignment="left", block_id="labels", line_index=index,
        background_color="#EEEEEE", style={}, excluded=False, warnings=[],
        render_bbox_pixels=None, effective_font_size_px=None,
        estimated_font_size_px=32, recommended_text_color="#000000",
    )


class FixtureHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        values = {
            "/api/tools/assets": [asset("reference-a"), asset("clean-a")],
            "/api/tools/tasks": [],
            "/health": {"status": "ok"},
        }
        status = 200 if path in values else 503
        body = json.dumps(values.get(path, {"detail": "Offline fixture: undeclared API"})).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


class MockAPI:
    def __init__(self, role="creator", font_dir=None):
        self.role = role
        self.workspaces = {"workspace-a": workspace()}
        self.assets = [asset("reference-a"), asset("clean-a")]
        self.tasks = {}
        self.calls = []
        self.payloads = []
        self.unexpected = []
        self.blocked_debug = 0
        self.mocked_fonts = 0
        self.font_dir = font_dir
        self.font_files = {}
        self.font_checks = []
        self.conflict_next = False
        self.partial_once = True
        self.render_fail_once = True
        self.product_checks = False
        self.product_examples = {}
        self.product_layers = {}
        self.fail_layers = False
        self.category_checks = False
        self.hold_tasks = False

    def product_measure(self, current, recognize=False):
        for item in current["segments"]:
            example = self.product_examples.get(item.get("translated_text"))
            if not example or item.get("product_names_enabled") is False:
                item.update(render_layer_url=None, render_layer_asset_id=None, text_runs=None)
                continue
            summary = example["layout"]
            if recognize or not item.get("product_mentions"):
                item["product_mentions"] = deepcopy(summary["product_mentions"])
                for mention in item["product_mentions"]:
                    mention["origin"] = "catalog" if example["text"] == "FLOOR ONE S7 Stretch Steam" else "model_pattern"
            item["product_text_sha256"] = hashlib.sha256(item["translated_text"].encode()).hexdigest()
            for key in ("render_bbox_pixels", "effective_font_size_px", "text_runs", "render_layer_asset_id"):
                item[key] = deepcopy(summary[key])
            box = item["render_bbox_pixels"]
            top = round(item["bbox_normalized"][1] / 999 * META["height"])
            item["render_bbox_pixels"] = [box[0], top, box[2], top + box[3] - box[1]]
            item["render_layer_url"] = f'{PREFIX}/{current["id"]}/layers/{summary["render_layer_asset_id"]}.png'
            if self.category_checks:
                from PIL import Image
                original = Image.open(self.product_layers[summary["render_layer_asset_id"]]).convert("RGBA")
                category = current.get("video_category", "unboxing")
                panel = "#00000000" if category == "product" else item["style"].get("background_color") or "#33333359"
                image = Image.new("RGBA", original.size, panel)
                image.alpha_composite(original)
                buffer = BytesIO()
                image.save(buffer, format="PNG")
                content = buffer.getvalue()
                identifier = hashlib.sha256(category.encode() + content).hexdigest()
                self.product_layers[identifier] = content
                item.update(render_layer_asset_id=identifier,
                            render_layer_url=f'{PREFIX}/{current["id"]}/layers/{identifier}.png')

    def route(self, route):
        request = route.request
        parsed = urlsplit(request.url)
        path, method = parsed.path, request.method
        if request.url in FONT_URLS:
            self.mocked_fonts += 1
            if self.font_dir and request.url in ROLE_FONT_URLS.values():
                font = self.font_dir / Path(parsed.path).name
                content = font.read_bytes()
                self.font_files[request.url] = {
                    "path": str(font), "bytes": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
                return route.fulfill(body=content, content_type="font/ttf",
                                     headers={"Access-Control-Allow-Origin": "*"})
            return route.fulfill(path=str(FONT_FIXTURE), content_type="font/ttf")
        if parsed.hostname == "127.0.0.1" and parsed.port == 7777:
            self.blocked_debug += 1
            return route.abort()
        if parsed.hostname not in {"127.0.0.1", "localhost"}:
            self.unexpected.append(f"external:{parsed.hostname}")
            return route.abort()
        if not path.startswith("/api/"):
            return route.continue_()
        self.calls.append((method, path))
        payload = request.post_data_json if method in {"POST", "PATCH"} and path != "/api/tools/subtitle-translation/upload-video" else {}
        self.payloads.append({"method": method, "path": path, "payload": deepcopy(payload)})

        def reply(body, status=200):
            route.fulfill(status=status, content_type="application/json", body=json.dumps(body))

        if path == "/api/auth/setup-status":
            return reply({"initialized": True})
        if path == "/api/auth/me":
            return reply(dict(id="acceptance-user", username="acceptance",
                              display_name="Acceptance", role=self.role,
                              is_enabled=True, must_change_password=False, created_at=NOW,
                              updated_at=NOW, last_login_at=None))
        if self.role == "viewer" and method != "GET":
            return reply({"detail": {"code": "forbidden", "message": "Read only"}}, 403)
        if path == "/api/tools/assets":
            return reply(self.assets)
        if path == "/api/tools/tasks":
            return reply(list(self.tasks.values()))
        if re.fullmatch(r"/api/assets/[^/]+/(content|download)", path):
            content = MEDIA.read_bytes()
            requested = request.headers.get("range")
            if requested:
                match = re.fullmatch(r"bytes=(\d+)-(\d*)", requested)
                assert match, requested
                start = int(match[1])
                end = min(int(match[2]) if match[2] else len(content) - 1, len(content) - 1)
                return route.fulfill(status=206, body=content[start:end + 1],
                                     content_type="video/mp4",
                                     headers={"Content-Range": f"bytes {start}-{end}/{len(content)}",
                                              "Accept-Ranges": "bytes"})
            return route.fulfill(body=content, content_type="video/mp4",
                                 headers={"Accept-Ranges": "bytes"})
        if path in {"/api/tools/subtitle-translation/import-video", "/api/tools/subtitle-translation/upload-video"}:
            identifier = f"import-{len(self.assets)}"
            imported = asset(identifier)
            self.assets.insert(0, imported)
            return reply(imported, 201)
        if path == PREFIX:
            if method == "GET":
                return reply(list(self.workspaces.values()))
            if payload.get("video_category", "unboxing") not in {"product", "unboxing"}:
                return reply({"detail": "Invalid video_category"}, 422)
            created = workspace(f"workspace-{len(self.workspaces) + 1}")
            created["video_category"] = "unboxing"
            created.update(payload)
            self.workspaces = {created["id"]: created, **self.workspaces}
            return reply(created, 201)
        if "/layers/" in path and self.product_checks:
            if self.fail_layers:
                return reply({"detail": "Layer unavailable"}, 503)
            layer = self.product_layers.get(Path(path).stem)
            if layer:
                if isinstance(layer, bytes):
                    return route.fulfill(body=layer, content_type="image/png")
                return route.fulfill(path=str(layer), content_type="image/png")
        match = re.fullmatch(PREFIX + r"/([^/]+)(?:/(extract|translate|render|preview|recognize-products))?", path)
        if match:
            identifier, operation = match.groups()
            current = self.workspaces[identifier]
            if operation == "preview":
                assert payload["expected_revision"] == current["revision"]
                measured = deepcopy(current)
                measured["segments"] = deepcopy(payload["segments"])
                for s in measured["segments"]:
                    if s["translated_text"]:
                        s.update(estimated_font_size_px=32, effective_font_size_px=24,
                                 render_bbox_pixels=[128, 72 * s["line_index"], 1216, 72 * s["line_index"] + 58],
                                 recommended_text_color="#000000",
                                 warnings=["font_size_reduced", "bbox_expanded", "expanded_background_unverified"])
                measured["warnings"] = ["provider_text_capacity_unverified",
                                        "provider_vertical_anchor_unverified",
                                        "provider_literal_escaping_unverified"]
                if self.product_checks:
                    self.product_measure(measured)
                return reply(measured)
            if operation == "recognize-products":
                assert payload["expected_revision"] == current["revision"]
                current["segments"] = deepcopy(payload["segments"])
                current["revision"] += 1
                self.product_measure(current, recognize=True)
                return reply(current)
            if operation:
                if payload["expected_revision"] != current["revision"]:
                    return reply({"detail": {"code": "revision_conflict", "message": "Revision changed"}}, 409)
                task = self.submit(current, operation, payload.get("segment_ids"))
                return reply(task, 201)
            if method == "GET":
                active = current["active_task_id"]
                if active:
                    task = self.tasks[active]
                    task["reads"] += 1
                    if task["reads"] >= 2 and not self.hold_tasks:
                        self.complete(current, task)
                return reply(current)
            if self.conflict_next:
                self.conflict_next = False
                current["revision"] += 1
                return reply({"detail": {"code": "revision_conflict", "message": "Revision changed remotely"}}, 409)
            if payload["expected_revision"] != current["revision"]:
                return reply({"detail": {"code": "revision_conflict", "message": "Revision changed"}}, 409)
            if "video_category" in payload and payload["video_category"] not in {"product", "unboxing"}:
                return reply({"detail": "Invalid video_category"}, 422)
            original = {s["segment_id"]: s["text"] for s in current["segments"]}
            if "segments" in payload:
                assert all(s["text"] == original[s["segment_id"]] for s in payload["segments"])
            changed_language = any(k in payload and payload[k] != current[k] for k in ("source_language", "target_language"))
            changed_category = "video_category" in payload and payload["video_category"] != current.get("video_category", "unboxing")
            current.update({k: deepcopy(v) for k, v in payload.items() if k != "expected_revision"})
            for role in ("reference", "clean"):
                if f"{role}_video_asset_id" in payload:
                    current[f"{role}_video"] = deepcopy(META) if payload[f"{role}_video_asset_id"] else None
            if changed_language:
                for s in current["segments"]:
                    s.update(translated_text=None, translation_status="pending")
            if self.product_checks and not changed_category:
                self.product_measure(current, recognize=True)
            if changed_category:
                current["stage_task_ids"].pop("render", None)
                for item in current["segments"]:
                    for key in ("render_layer_url", "render_layer_asset_id", "text_runs",
                                "render_bbox_pixels", "effective_font_size_px",
                                "estimated_font_size_px", "recommended_text_color"):
                        item[key] = None
            current["revision"] += 1
            current["output_asset_id"] = None
            current["active_task_id"] = None
            current["stage"] = "review_ready" if current["segments"] else "draft"
            self.workspaces = {identifier: current, **self.workspaces}
            return reply(current)
        match = re.fullmatch(r"/api/tools/tasks/([^/]+)(/retry)?", path)
        if match:
            identifier, retry = match.groups()
            task = self.tasks[identifier]
            if retry:
                current = self.workspaces[task["input_snapshot"]["workspace_id"]]
                return reply(self.submit(current, task["input_snapshot"]["operation"]), 201)
            return reply(task)
        self.unexpected.append(f"{method}:{path}")
        return reply({"detail": "Offline acceptance: undeclared API"}, 503)

    def submit(self, current, operation, selected=None):
        identifier = f"task-{len(self.tasks) + 1}"
        task = dict(
            id=identifier, type="video_subtitle_translation", status="queued",
            input_snapshot={"workspace_id": current["id"], "operation": operation,
                            "revision": current["revision"], "segment_ids": selected,
                            "video_category": current.get("video_category", "unboxing")},
            provider_task_id=None, created_at=NOW, updated_at=NOW,
            started_at=None, finished_at=None, error=None, reads=0,
        )
        self.tasks[identifier] = task
        current["active_task_id"] = identifier
        current["stage_task_ids"][operation] = identifier
        current["stage"] = {"extract": "extracting", "translate": "translating", "render": "rendering"}[operation]
        return task

    def complete(self, current, task):
        operation = task["input_snapshot"]["operation"]
        task.update(status="succeeded", finished_at=NOW)
        current["active_task_id"] = None
        if operation == "extract":
            current.update(segments=[segment(1), segment(2)], stage="extracted")
        elif operation == "translate":
            selected = task["input_snapshot"]["segment_ids"]
            for s in current["segments"]:
                if selected and s["segment_id"] not in selected:
                    continue
                if self.partial_once and s["segment_id"] == "line-2":
                    s.update(translation_status="failed", warnings=["translation_pending"])
                else:
                    s.update(translated_text=f"Uebersetzung {s['segment_id']}", translation_status="succeeded", warnings=[])
            self.partial_once = False
            current["stage"] = "review_ready"
        elif self.render_fail_once:
            self.render_fail_once = False
            task.update(status="failed", error={"code": "external_service_error",
                                               "message": "Mock render failure", "stage": "render"})
            current["stage"] = "failed"
            return
        else:
            output = asset(f"output-{task['id']}")
            output.update(type="generated_video", tool_asset_role="output")
            self.assets.insert(0, output)
            current.update(stage="succeeded", output_asset_id=output["id"])
        if operation != "render":
            current["revision"] += 1


def open_tool(page, base):
    page.goto(f"{base}/workspace/tools", wait_until="networkidle")
    page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
    expect(page.get_by_label("字幕工作区历史")).to_be_visible()


def no_overflow(page):
    expect(page.locator("[data-warning-code]")).to_have_count(0)
    for message in ("此帧率仅通过本地接口校验，尚未真实压制验证。",
                    "字体版本尚未确认，请核对实际字体并检查成片。",
                    "文字与背景对比度偏低，请调整文字色或底板色。"):
        expect(page.get_by_text(message, exact=True)).to_have_count(0)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "Horizontal overflow"
    for dialog in page.get_by_role("dialog").all():
        assert dialog.evaluate("d => d.scrollWidth <= d.clientWidth + 1"), "Dialog horizontal overflow"
    for video in page.locator("video").all():
        assert video.get_attribute("controls") is not None, "Native controls missing"
        assert video.evaluate("v => getComputedStyle(v).objectFit") == "contain"


def run_creator(page, api, base):
    open_tool(page, base)
    expect(page.get_by_text("压制支持边界 · 请在提交前核对", exact=True)).to_be_visible()
    expect(page.get_by_text(re.compile("MediaKit 未公开文字"))).to_be_visible()
    page.get_by_label("带字幕参考视频资产").select_option("reference-a")
    expect(page.get_by_role("button", name="1 · 提取字幕")).to_be_enabled()
    page.get_by_label("带字幕参考视频地址").fill("https://fixture.tos-cn-beijing.volces.com/reference.mp4")
    page.get_by_role("heading", name="带字幕参考视频", exact=True).locator("..").get_by_role("button", name="导入地址", exact=True).click()
    expect(page.get_by_label("带字幕参考视频资产")).to_have_value("import-2")
    page.get_by_label("无字幕成片视频上传").set_input_files(str(MEDIA))
    expect(page.get_by_label("无字幕成片视频资产")).to_have_value("import-3")
    page.get_by_role("button", name="1 · 提取字幕").click()
    expect(page.get_by_role("button", name="2 · 翻译", exact=True)).to_be_enabled(timeout=15000)
    page.get_by_role("button", name="2 · 翻译", exact=True).click()
    retry = page.get_by_role("button", name="仅重试缺失译文 (1)", exact=True)
    expect(retry).to_be_enabled(timeout=15000)
    preserved = api.workspaces["workspace-a"]["segments"][0]["translated_text"]
    retry.click()
    expect(page.get_by_role("button", name="4 · 压制已保存字幕")).to_be_enabled(timeout=15000)
    assert api.workspaces["workspace-a"]["segments"][0]["translated_text"] == preserved
    last = list(api.tasks.values())[-1]
    assert last["input_snapshot"]["segment_ids"] == ["line-2"]
    page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
    dialog = page.get_by_role("dialog")
    expect(dialog.get_by_text("Reference label 1", exact=True)).to_be_visible()
    dialog.get_by_label("字幕 1译文").fill("Reviewed German label")
    dialog.get_by_label("字幕 1字号").fill("24")
    before_preview = deepcopy(api.workspaces["workspace-a"])
    dialog.get_by_role("button", name="计算排版 · 不保存", exact=True).click()
    expect(dialog.get_by_text("估算字号 32 · 输出字号 24", exact=True).first).to_be_visible()
    expect(page.locator("[data-warning-code]")).to_have_count(0)
    expect(page.get_by_text("译文框已自动横向扩宽，原始坐标和对齐锚点保持不变。")).to_have_count(0)
    box = dialog.locator('[data-subtitle-box="line-1"]')
    dialog.get_by_role("button", name="字幕 1 · 定位", exact=True).click()
    expect(box).to_be_visible()
    expect(box).to_have_css("white-space", "nowrap")
    expect(dialog.locator('[data-subtitle-panel="line-1"]')).to_have_css(
        "background-color", "rgba(51, 51, 51, 0.35)"
    )
    assert box.evaluate("e => Math.abs(parseFloat(e.style.width) - 85) < 0.01")
    assert box.evaluate("e => Math.abs(parseFloat(e.style.left) - 10) < 0.01")
    native = dialog.locator("video")
    native.focus()
    page.keyboard.press("Space")
    expect(native).to_have_js_property("paused", False)
    page.keyboard.press("Space")
    expect(native).to_have_js_property("paused", True)
    no_overflow(page)
    page.screenshot(path=str(OUT / f"adaptive-{page.viewport_size['width']}.png"), full_page=True)
    dialog.get_by_label("字幕 1译文").fill("Reviewed German label edited")
    expect(dialog.get_by_text("估算字号 待计算 · 输出字号 待计算").first).to_be_visible()
    assert box.evaluate("e => Math.abs(parseFloat(e.style.width) - 700 / 999 * 100) < 0.01")
    dialog.get_by_label("字幕 1译文").fill("Reviewed German label")
    dialog.get_by_role("button", name="计算排版 · 不保存", exact=True).click()
    expect(box).to_have_attribute("style", re.compile(r"width: 85%"))
    assert api.workspaces["workspace-a"] == before_preview
    expect(dialog.get_by_text(re.compile("未保存修改"))).to_be_visible()
    dialog.get_by_role("button", name="关闭", exact=True).click()
    expect(dialog.get_by_text("有未保存修改，如何关闭？")).to_be_visible()
    dialog.get_by_role("button", name="继续校对").click()
    dialog.get_by_role("button", name="保存校对", exact=True).click()
    expect(dialog.get_by_text(re.compile("已保存"))).to_be_visible()
    assert api.workspaces["workspace-a"]["segments"][0]["text"] == "Reference label 1"
    dialog.get_by_label("字幕 1译文").fill("Conflict local draft")
    api.conflict_next = True
    dialog.get_by_role("button", name="保存校对", exact=True).click()
    expect(dialog.get_by_text(re.compile("远端 revision 已变更"))).to_be_visible()
    expect(dialog.get_by_label("字幕 1译文")).to_have_value("Conflict local draft")
    page.once("dialog", lambda d: d.accept())
    dialog.get_by_role("button", name="重新加载远端", exact=True).click()
    expect(dialog).not_to_be_visible()
    page.reload(wait_until="networkidle")
    page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
    page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
    dialog = page.get_by_role("dialog")
    expect(dialog.get_by_label("字幕 1译文")).to_have_value("Reviewed German label")
    dialog.get_by_role("button", name="字幕 2 · 定位", exact=True).click()
    no_overflow(page)
    page.screenshot(path=str(OUT / f"review-{page.viewport_size['width']}.png"), full_page=True)
    dialog.get_by_role("button", name="保存并压制视频", exact=True).click()
    expect(page.get_by_role("button", name="重试失败阶段", exact=True)).to_be_enabled(timeout=15000)
    operations = [t["input_snapshot"]["operation"] for t in api.tasks.values()]
    page.get_by_role("button", name="重试失败阶段", exact=True).click()
    expect(page.get_by_role("heading", name="当前成片", exact=True)).to_be_visible(timeout=15000)
    assert [t["input_snapshot"]["operation"] for t in api.tasks.values()] == operations + ["render"]
    download = page.get_by_role("link", name="下载 MP4", exact=True)
    assert "download=1" in download.get_attribute("href")
    page.get_by_role("button", name="放大预览", exact=True).click()
    expect(page.get_by_role("dialog")).to_be_visible()
    no_overflow(page)
    page.get_by_role("dialog").get_by_role("button", name="关闭", exact=True).click()
    page.get_by_role("button", name="新建开箱视频任务", exact=True).click()
    expect(page.get_by_role("heading", name="当前成片", exact=True)).not_to_be_visible()
    page.get_by_label("字幕工作区历史").select_option("workspace-a")
    expect(page.get_by_role("heading", name="当前成片", exact=True)).to_be_visible()
    page.get_by_label("目标语言").select_option("fr")
    expect(page.get_by_role("heading", name="当前成片", exact=True)).not_to_be_visible()
    expect(page.get_by_role("button", name="4 · 压制已保存字幕")).to_be_disabled()
    for name in ("视频人物打码", "全模态参考生视频"):
        page.get_by_role("tab", name=name, exact=True).click()
        no_overflow(page)
    page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
    no_overflow(page)
    page.screenshot(path=str(OUT / f"tools-{page.viewport_size['width']}.png"), full_page=True)


def run_viewer(page, api, base):
    current = api.workspaces["workspace-a"]
    current.update(reference_video_asset_id="reference-a", reference_video=META,
                   clean_video_asset_id="clean-a", clean_video=META,
                   stage="review_ready", segments=[segment(1)])
    current["segments"][0].update(translated_text="Read only translation", translation_status="succeeded")
    open_tool(page, base)
    for label in ("新建产品视频任务", "新建开箱视频任务", "1 · 提取字幕", "2 · 翻译", "4 · 压制已保存字幕"):
        expect(page.get_by_role("button", name=label, exact=True)).to_be_disabled()
    page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
    dialog = page.get_by_role("dialog")
    expect(dialog.get_by_label("字幕 1译文")).to_be_disabled()
    expect(dialog.get_by_role("button", name="保存校对", exact=True)).to_be_disabled()
    expect(dialog.get_by_role("button", name="计算排版 · 不保存", exact=True)).to_be_disabled()
    expect(dialog.get_by_role("button", name="字幕 1 · 定位", exact=True)).to_be_enabled()
    no_overflow(page)
    page.screenshot(path=str(OUT / f"viewer-{page.viewport_size['width']}.png"), full_page=True)
    assert all(method == "GET" for method, _ in api.calls), "Viewer emitted mutation"


def run_role_fonts(page, api, base):
    current = api.workspaces["workspace-a"]
    records = [segment(index) for index in range(1, 6)]
    for item, role in zip(records, ("headline", "body", "footnote", None, None)):
        item.update(visual_role=role, translated_text=f"Font acceptance line {item['line_index']}",
                    translation_status="succeeded", end_ms=3000,
                    font_type=ROLE_FONT_URLS["CenturyGothicBold"],
                    effective_font_size_px=32)
    records[3]["style"]["font"] = ""
    records[4].pop("visual_role")
    records[4]["style"]["font"] = None
    current.update(reference_video_asset_id="reference-a", reference_video=META,
                   clean_video_asset_id="clean-a", clean_video=META,
                   stage="review_ready", segments=records)
    open_tool(page, base)
    if api.role == "viewer":
        for label in ("新建产品视频任务", "新建开箱视频任务", "1 · 提取字幕", "2 · 翻译", "4 · 压制已保存字幕"):
            expect(page.get_by_role("button", name=label, exact=True)).to_be_disabled()
    page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_role("button", name="字幕 1 · 定位", exact=True).click()
    cdp = page.context.new_cdp_session(page)
    cdp.send("DOM.enable")
    cdp.send("CSS.enable")

    def check_font(index, font_id, phase):
        selector = f'[data-subtitle-box="line-{index}"]'
        box = dialog.locator(selector)
        expect(box).to_be_visible()
        expect(box).to_have_css("font-family", f"subtitle-{font_id}, sans-serif")
        expect(box).to_have_css("font-weight", "400")
        expect(box).to_have_css("font-synthesis", "none")
        page.wait_for_function(
            """family => [...document.fonts].some(
                f => f.family === family && f.status === 'loaded')""",
            arg=f"subtitle-{font_id}",
        )
        root = cdp.send("DOM.getDocument")["root"]["nodeId"]
        node = cdp.send("DOM.querySelector", {
            "nodeId": root, "selector": f'{selector} [data-subtitle-panel]',
        })["nodeId"]
        fonts = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": node})["fonts"]
        assert fonts and all(f["isCustomFont"] and f["glyphCount"] > 0 for f in fonts), fonts
        if api.font_dir:
            from fontTools.ttLib import TTFont
            path = api.font_dir / Path(urlsplit(ROLE_FONT_URLS[font_id]).path).name
            with TTFont(path) as real_font:
                postscript = real_font["name"].getDebugName(6)
            assert {f["postScriptName"] for f in fonts} == {postscript}, fonts
            assert ROLE_FONT_URLS[font_id] in api.font_files
        api.font_checks.append({
            "phase": phase, "segment": f"line-{index}", "font_id": font_id,
            "font_weight": box.evaluate("e => getComputedStyle(e).fontWeight"),
            "font_synthesis": box.evaluate("e => getComputedStyle(e).fontSynthesis"),
            "rendered_fonts": fonts,
        })

    def screenshot(phase):
        dialog.locator("video").scroll_into_view_if_needed()
        no_overflow(page)
        page.screenshot(path=str(OUT / f"role-font-{api.role}-{page.viewport_size['width']}-{phase}.png"),
                        full_page=True)

    for index in range(1, 6):
        expect(dialog.get_by_label(f"字幕 {index}字体")).to_have_value("")
        expect(dialog.get_by_label(f"字幕 {index}字体").locator("option").first).to_have_text(
            "自动 · 标题粗体，正文/脚注常规体"
        )
        check_font(index, "CenturyGothicBold" if index == 1 else "CenturyGothic", "automatic-legacy-summary")
    screenshot("automatic")
    if api.role == "viewer":
        for index in range(1, 6):
            article = dialog.get_by_label(f"字幕 {index}译文").locator("xpath=ancestor::article")
            expect(article.locator("input, textarea, select")).to_have_count(16)
            for control in article.locator("input, textarea, select").all():
                expect(control).to_be_disabled()
            expect(dialog.get_by_role("button", name=f"字幕 {index} · 定位", exact=True)).to_be_enabled()
        for label in ("保存校对", "保存并压制视频", "计算排版 · 不保存"):
            expect(dialog.get_by_role("button", name=label, exact=True)).to_be_disabled()
        assert all(method == "GET" for method, _ in api.calls), "Viewer emitted mutation"
        return

    def reopen():
        dialog.get_by_role("button", name="关闭", exact=True).click()
        expect(dialog).not_to_be_visible()
        page.reload(wait_until="networkidle")
        page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
        page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
        dialog.get_by_role("button", name="字幕 1 · 定位", exact=True).click()

    before = deepcopy(current)
    dialog.get_by_label("字幕 1字体").select_option("CenturyGothic")
    dialog.get_by_label("字幕 2字体").select_option("CenturyGothicBold")
    check_font(1, "CenturyGothic", "manual")
    check_font(2, "CenturyGothicBold", "manual")
    assert current == before, "Unsaved manual selection mutated workspace"
    screenshot("manual")
    dialog.get_by_role("button", name="保存校对", exact=True).click()
    expect(dialog.get_by_text(re.compile("已保存"))).to_be_visible()
    assert current["segments"][0]["style"]["font"] == "CenturyGothic"
    assert current["segments"][1]["style"]["font"] == "CenturyGothicBold"
    reopen()
    check_font(1, "CenturyGothic", "manual-saved-reopened")
    check_font(2, "CenturyGothicBold", "manual-saved-reopened")
    dialog.get_by_label("字幕 1字体").select_option("")
    dialog.get_by_label("字幕 2字体").select_option("")
    check_font(1, "CenturyGothicBold", "cleared")
    check_font(2, "CenturyGothic", "cleared")
    screenshot("cleared")
    dialog.get_by_role("button", name="保存校对", exact=True).click()
    expect(dialog.get_by_text(re.compile("已保存"))).to_be_visible()
    assert current["segments"][0]["style"]["font"] is None
    assert current["segments"][1]["style"]["font"] is None
    reopen()
    check_font(1, "CenturyGothicBold", "cleared-saved-reopened")
    check_font(2, "CenturyGothic", "cleared-saved-reopened")
    no_overflow(page)
    assert not api.tasks, "Font editing submitted an extract/translate/render task"


def run_product_names(page, api, base):
    api.product_checks = True
    evidence = json.loads((PRODUCT_EVIDENCE / "real-font-evidence.json").read_text())
    for index, example in enumerate(evidence["examples"]):
        path = PRODUCT_EVIDENCE / f"sample-{index}.png"
        if path.exists():
            api.product_examples[example["text"]] = example
            api.product_layers[example["layout"]["render_layer_asset_id"]] = path
    current = api.workspaces["workspace-a"]
    records = [segment(index) for index in range(1, 4)]
    for record, text in zip(records, ("FLOOR ONE S7 Stretch Steam", "FLOOR ONE i5 Lite", "Steam Pro Stretch")):
        record.update(translated_text=text, translation_status="succeeded", end_ms=3000)
        example = api.product_examples.get(text)
        if example:
            record["bbox_normalized"] = [62, 111 + 150 * (record["line_index"] - 1),
                                        859, 208 + 150 * (record["line_index"] - 1)]
        else:
            record["bbox_normalized"] = [100, 500, 800, 580]
    current.update(reference_video_asset_id="reference-a", reference_video=META,
                   clean_video_asset_id="clean-a", clean_video=META,
                   stage="review_ready", segments=records)
    api.product_measure(current, recognize=True)
    open_tool(page, base)
    page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_role("button", name="字幕 1 · 定位", exact=True).click()
    expect(dialog.locator('[data-product-name="line-1"]')).to_contain_text("型号：FLOOR ONE S7")
    expect(dialog.locator('[data-product-name="line-1"]')).to_contain_text("规格：Stretch Steam")
    expect(dialog.locator('[data-product-name="line-2"]')).to_contain_text("型号：FLOOR ONE i5")
    expect(dialog.locator('[data-product-name="line-2"]')).to_contain_text("规格：Lite")
    expect(dialog.locator('[data-product-name="line-3"]')).to_have_count(0)
    for identifier in ("line-1", "line-2"):
        layer = dialog.locator(f'[data-subtitle-layer="{identifier}"]')
        expect(layer).to_be_visible()
        page.wait_for_function("id => document.querySelector(`[data-subtitle-layer=\"${id}\"]`)?.naturalWidth > 0",
                               arg=identifier)
        expect(layer).to_have_css("object-fit", "contain")
    no_overflow(page)
    page.screenshot(path=str(OUT / f"product-{api.role}-{page.viewport_size['width']}.png"), full_page=False)
    recognize = dialog.get_by_role("button", name=re.compile("识别产品名称"))
    expect(recognize).to_have_count(0)
    expect(dialog.get_by_label("字幕 2产品名称字体")).to_have_count(0)
    expect(dialog.get_by_label("字幕 2产品1model")).to_have_count(0)
    if api.role == "viewer":
        for control in dialog.locator("article input, article textarea, article select").all():
            expect(control).to_be_disabled()
        assert all(method == "GET" for method, _ in api.calls)
        return
    dialog.get_by_label("字幕 2译文").fill("FLOOR ONE S10 Stretch Steam")
    expect(dialog.locator('[data-subtitle-layer="line-2"]')).to_have_count(0)
    dialog.get_by_role("button", name="计算排版 · 不保存", exact=True).click()
    expect(dialog.locator('[data-product-name="line-2"]')).to_contain_text("型号：FLOOR ONE S10")
    expect(dialog.locator('[data-product-name="line-2"]')).to_contain_text("规格：Stretch Steam")
    expect(dialog.locator('[data-subtitle-layer="line-2"]')).to_have_count(1)
    assert current["segments"][1]["translated_text"] == "FLOOR ONE i5 Lite"
    dialog.get_by_role("button", name="保存校对", exact=True).click()
    expect(dialog.get_by_text(re.compile("已保存"))).to_be_visible()
    assert current["segments"][1]["translated_text"] == "FLOOR ONE S10 Stretch Steam"
    assert current["segments"][1]["product_mentions"][0]["origin"] == "model_pattern"
    dialog.get_by_label("字幕 2译文").fill("FLOOR ONE i5 Lite")
    dialog.get_by_role("button", name="保存校对", exact=True).click()
    expect(dialog.locator('[data-product-name="line-2"]')).to_contain_text("型号：FLOOR ONE i5")
    assert not any("recognize-products" in path for _, path in api.calls)
    assert not api.tasks, "Product review submitted an extraction, translation or render"
    api.fail_layers = True
    dialog.get_by_role("button", name="关闭", exact=True).click()
    page.reload(wait_until="networkidle")
    page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
    page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
    dialog.get_by_role("button", name="字幕 1 · 定位", exact=True).click()
    expect(dialog.locator('[data-subtitle-panel="line-1"]')).to_be_visible()
    expect(dialog.locator('[data-subtitle-panel="line-1"]')).to_contain_text("FLOOR ONE S7 Stretch Steam")
    no_overflow(page)
    api.font_checks.append({"known_and_unknown_png": True, "automatic_save": True,
                            "automatic_preview": True, "text_invalidation": True,
                            "no_manual_product_controls": True, "image_failure_fallback": True})


def run_brands(page, api, base):
    """Brand skip warnings are server-derived fixtures; test real UI suppression."""
    current = api.workspaces["workspace-a"]
    records = [segment(index) for index in range(1, 4)]
    records[0].update(text="Tineco", translated_text="Historical brand translation",
                      translation_status="succeeded", warnings=["brand_content_skipped"],
                      render_layer_url=f'{PREFIX}/workspace-a/layers/{"a" * 64}.png')
    records[1].update(text="Live Easy. Enjoy Life.", translated_text=None,
                      warnings=["brand_content_skipped"])
    records[2].update(text="Tineco FLOOR ONE S7", translated_text="Normal product explanation",
                      translation_status="succeeded")
    current.update(reference_video_asset_id="reference-a", reference_video=deepcopy(META),
                   clean_video_asset_id="clean-a", clean_video=deepcopy(META),
                   stage="review_ready", segments=records, warnings=["brand_content_skipped"])
    open_tool(page, base)
    for category in ("unboxing", "product"):
        if category == "product":
            if api.role == "creator":
                page.get_by_label("视频类型", exact=True).select_option(category)
                expect(page.get_by_label("视频类型", exact=True)).to_have_value(category)
            else:
                current["video_category"] = category
                page.reload(wait_until="networkidle")
                page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
        page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
        dialog = page.get_by_role("dialog")
        dialog.get_by_role("button", name="字幕 3 · 定位", exact=True).click()
        expect(dialog.locator('[data-subtitle-panel="line-3"]')).to_be_visible()
        expect(dialog.locator('[data-subtitle-panel="line-1"]')).to_have_count(0)
        expect(dialog.locator('[data-subtitle-panel="line-2"]')).to_have_count(0)
        expect(dialog.locator("[data-subtitle-layer]")).to_have_count(0)
        expect(dialog.get_by_role("button", name="仅重试缺失译文 (0)", exact=True)).to_be_disabled()
        expect(dialog.get_by_label("字幕 2译文")).to_have_value("")
        render = dialog.get_by_role("button", name="保存并压制视频", exact=True)
        (expect(render).to_be_enabled() if api.role == "creator" else expect(render).to_be_disabled())
        no_overflow(page)
        dialog.get_by_role("button", name="关闭", exact=True).click()
    current["segments"] = records[:2]
    page.reload(wait_until="networkidle")
    page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
    page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
    dialog = page.get_by_role("dialog")
    expect(dialog.get_by_role("button", name="保存并压制视频", exact=True)).to_be_disabled()
    expect(dialog.get_by_role("button", name="仅重试缺失译文 (0)", exact=True)).to_be_disabled()
    assert not any(p["path"].endswith(("/translate", "/render", "/recognize-products"))
                   for p in api.payloads), "Brand UI caused a paid operation"
    no_overflow(page)
    page.screenshot(path=str(OUT / f"brand-{api.role}-{page.viewport_size['width']}.png"), full_page=True)


def run_categories(page, api, base):
    """UI acceptance only: API persistence and PNG backgrounds are offline fixtures."""
    api.product_checks = api.category_checks = True
    evidence = json.loads((PRODUCT_EVIDENCE / "real-font-evidence.json").read_text())
    for index, example in enumerate(evidence["examples"]):
        path = PRODUCT_EVIDENCE / f"sample-{index}.png"
        if path.exists():
            api.product_examples[example["text"]] = example
            api.product_layers[example["layout"]["render_layer_asset_id"]] = path
    current = api.workspaces["workspace-a"]
    records = [segment(index) for index in range(1, 4)]
    for record, visual_role, text, background, panel in zip(
        records, ("headline", "body", "footnote"),
        ("FLOOR ONE S7 Stretch Steam", "Category body label", "Category footnote label"),
        (None, "#FFFFFF", "#808080"), ("#CC220080", None, "#00000000"),
    ):
        record.update(visual_role=visual_role, translated_text=text,
                      translation_status="succeeded", end_ms=3000,
                      background_color=background,
                      warnings=["expanded_background_unverified", "low_contrast"])
        record["style"] = {"background_color": panel, "text_color": "#2255CC",
                           "font_size_px": 24, "font": "CenturyGothic"}
    current.update(reference_video_asset_id="reference-a", reference_video=deepcopy(META),
                   clean_video_asset_id="clean-a", clean_video=deepcopy(META),
                   stage="succeeded", segments=records, output_asset_id="old-output",
                   stage_task_ids={"render": "old-render"})
    api.assets.append(asset("old-output"))
    api.tasks["old-render"] = dict(
        id="old-render", type="video_subtitle_translation", status="succeeded",
        input_snapshot={"workspace_id": current["id"], "operation": "render", "revision": 1},
        provider_task_id=None, created_at=NOW, updated_at=NOW,
        started_at=NOW, finished_at=NOW, error=None, reads=0,
    )
    api.product_measure(current, recognize=True)
    preserved = [{key: deepcopy(item.get(key)) for key in (
        "text", "translated_text", "style", "product_mentions", "product_text_sha256",
        "bbox_normalized", "start_ms", "end_ms", "visual_role",
    )} for item in current["segments"]]
    old_layer = current["segments"][0]["render_layer_asset_id"]
    open_tool(page, base)
    category = page.get_by_label("视频类型", exact=True)
    expect(category).to_have_value("unboxing")
    assert "video_category" not in current, "Reading legacy fixture backfilled category"
    entries = [page.get_by_role("button", name=f"新建{name}视频任务", exact=True)
               for name in ("产品", "开箱")]

    def mutations():
        return [entry for entry in api.payloads if entry["method"] != "GET"]

    def review():
        page.get_by_role("button", name=re.compile(r"3 · 原文")).click()
        dialog = page.get_by_role("dialog")
        dialog.get_by_role("button", name="字幕 1 · 定位", exact=True).click()
        return dialog

    def screenshot(phase):
        no_overflow(page)
        page.screenshot(path=str(OUT / f"category-{api.role}-{page.viewport_size['width']}-{phase}.png"),
                        full_page=True)

    def panel_controls(dialog, product):
        for index in range(1, 4):
            for suffix in ("底板模式", "底板颜色", "底板不透明度", "background_color"):
                control = dialog.get_by_label(f"字幕 {index}{suffix}", exact=True)
                expect(control).to_have_count(0 if product else 1)
            for suffix in ("译文", "字体", "字号", "text_color"):
                control = dialog.get_by_label(f"字幕 {index}{suffix}", exact=True)
                (expect(control).to_be_disabled() if api.role == "viewer"
                 else expect(control).to_be_enabled())
        if product:
            expect(dialog.get_by_text("产品视频：字幕无底板", exact=True).first).to_be_visible()
            expect(dialog.get_by_text(re.compile("半透明深灰底|已添加.*灰|启用底板|调整文字色或底板"))).to_have_count(0)
        expect(dialog.get_by_role("button", name=re.compile("识别产品名称"))).to_have_count(0)
        expect(dialog.get_by_label("字幕 1产品1model")).to_have_count(0)

    def native_video(dialog):
        video = dialog.locator("video")
        video.scroll_into_view_if_needed()
        before = len(mutations())
        video.focus()
        page.keyboard.press("Space")
        expect(video).to_have_js_property("paused", False)
        page.keyboard.press("Space")
        expect(video).to_have_js_property("paused", True)
        video.evaluate("v => { v.currentTime = 1.25; v.volume = 0.5; }")
        expect(video).to_have_js_property("volume", 0.5)
        assert video.evaluate("""v => {
            const r = v.getBoundingClientRect();
            return document.elementFromPoint(r.left + r.width / 2, r.bottom - 12) === v;
        }"""), "Native control strip is covered"
        assert len(mutations()) == before, "Playback emitted business mutation"
        no_overflow(page)

    if api.role == "creator":
        for entry, value in zip(entries, ("product", "unboxing")):
            entry.click()
            expect(category).to_have_value(value)
            created = [item for item in api.payloads
                       if item["method"] == "POST" and item["path"] == PREFIX][-1]
            assert created["payload"]["video_category"] == value, created
            page.reload(wait_until="networkidle")
            page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
            expect(category).to_have_value(value)
        page.get_by_label("字幕工作区历史").select_option("workspace-a")
        expect(category).to_have_value("unboxing")
        expect(page.get_by_role("heading", name="当前成片", exact=True)).to_be_visible()
    else:
        for entry in entries:
            expect(entry).to_be_disabled()
        expect(category).to_be_disabled()

    dialog = review()
    panel_controls(dialog, False)
    expect(dialog.get_by_label("字幕 1底板模式")).to_have_value("custom")
    expect(dialog.get_by_label("字幕 1background_color")).to_have_value("#CC220080")
    expect(dialog.get_by_label("字幕 3底板模式")).to_have_value("none")
    expect(dialog.locator('[data-subtitle-layer="line-1"]')).to_be_visible()
    native_video(dialog)
    screenshot("legacy-unboxing")
    dialog.get_by_role("button", name="关闭", exact=True).click()
    expect(dialog).not_to_be_visible()

    before = len(mutations())
    if api.role == "creator":
        revision = current["revision"]
        category.select_option("product")
        expect(category).to_have_value("product")
        expect(page.get_by_role("heading", name="当前成片", exact=True)).to_have_count(0)
        assert current["video_category"] == "product" and current["revision"] == revision + 1
        patch = mutations()[-1]
        assert patch["method"] == "PATCH" and patch["payload"]["video_category"] == "product"
        assert patch["payload"]["expected_revision"] == revision
        assert current["output_asset_id"] is None and "render" not in current["stage_task_ids"]
        assert all(item["render_layer_url"] is None and item["render_bbox_pixels"] is None
                   for item in current["segments"])
        assert [{key: item.get(key) for key in saved} for item, saved in
                zip(current["segments"], preserved)] == preserved
        assert current["reference_video_asset_id"] == "reference-a"
        assert current["clean_video_asset_id"] == "clean-a"
    else:
        # Server-originated product workspace, not a viewer mutation.
        current["video_category"] = "product"
        for item in current["segments"]:
            item.update(render_layer_url=None, render_layer_asset_id=None, render_bbox_pixels=None)
    page.reload(wait_until="networkidle")
    page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
    expect(category).to_have_value("product")
    expect(page.get_by_label("字幕工作区历史").locator('option[value="workspace-a"]')).to_contain_text("产品")
    dialog = review()
    panel_controls(dialog, True)
    expect(dialog.locator('[data-subtitle-layer="line-1"]')).to_have_count(0)
    for index in range(1, 4):
        expect(dialog.locator(f'[data-subtitle-panel="line-{index}"]')).to_have_css(
            "background-color", "rgba(0, 0, 0, 0)")
    expect(dialog.locator('[data-subtitle-box="line-2"]')).to_have_css("color", "rgb(34, 85, 204)")
    native_video(dialog)
    screenshot("product-invalidated")
    if api.role == "creator":
        dialog.get_by_role("button", name="计算排版 · 不保存", exact=True).click()
        layer = dialog.locator('[data-subtitle-layer="line-1"]')
        expect(layer).to_be_visible()
        page.wait_for_function('() => document.querySelector(\'[data-subtitle-layer="line-1"]\')?.naturalWidth > 0')
        assert old_layer not in layer.get_attribute("src"), "Old unboxing PNG reused"
        screenshot("product-png")
        assert all(item["render_layer_url"] is None for item in current["segments"])
    dialog.get_by_role("button", name="关闭", exact=True).click()
    expect(dialog).not_to_be_visible()

    # Seed a category-specific PNG on server GET and fail only its local content route.
    api.product_measure(current)
    api.fail_layers = True
    page.reload(wait_until="networkidle")
    page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
    dialog = review()
    fallback = dialog.locator('[data-subtitle-panel="line-1"]')
    expect(fallback).to_be_visible()
    expect(fallback).to_contain_text("产品图层加载失败")
    expect(fallback).to_have_css("background-color", "rgba(0, 0, 0, 0)")
    panel_controls(dialog, True)
    screenshot("product-failed-png")
    dialog.get_by_role("button", name="关闭", exact=True).click()
    expect(dialog).not_to_be_visible()
    api.fail_layers = False

    if api.role == "creator":
        category.select_option("unboxing")
        expect(category).to_have_value("unboxing")
        page.reload(wait_until="networkidle")
        page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
        expect(category).to_have_value("unboxing")
        expect(page.get_by_label("字幕工作区历史").locator('option[value="workspace-a"]')).to_contain_text("开箱")
        dialog = review()
        panel_controls(dialog, False)
        expect(dialog.get_by_label("字幕 1background_color")).to_have_value("#CC220080")
        expect(dialog.get_by_label("字幕 1底板模式")).to_have_value("custom")
        expect(dialog.get_by_label("字幕 3底板模式")).to_have_value("none")
        expect(dialog.locator('[data-subtitle-panel="line-1"]')).to_have_css(
            "background-color", re.compile(r"rgba\(204, 34, 0, 0\.5(?:02)?\)"))
        screenshot("unboxing-restored")
        dialog.get_by_role("button", name="关闭", exact=True).click()
        assert [{key: item.get(key) for key in saved} for item, saved in
                zip(current["segments"], preserved)] == preserved
        assert set(api.tasks) == {"old-render"}, "Category switching submitted pipeline task"
    else:
        assert len(mutations()) == before == 0, "Viewer emitted mutation"

    # Workspace stages lock category; entries retain the panel's canWrite guard.
    api.hold_tasks = True
    before = len(mutations())
    for operation in ("extract", "translate", "render"):
        current["video_category"] = "product"
        api.submit(current, operation)
        page.reload(wait_until="networkidle")
        page.get_by_role("tab", name="视频字幕翻译", exact=True).click()
        expect(category).to_have_value("product")
        expect(category).to_be_disabled()
        for entry in entries:
            (expect(entry).to_be_disabled() if api.role == "viewer"
             else expect(entry).to_be_enabled())
        screenshot(f"busy-{operation}")
    assert len(mutations()) == before, "Busy state emitted mutation"
    api.font_checks.append({
        "category_checks": True, "legacy_missing_is_unboxing": True,
        "two_entry_payloads": api.role == "creator", "persisted_switch_and_styles": api.role == "creator",
        "product_controls_hidden": True, "transparent_dom_and_failed_png": True,
        "no_gray_panel_advice": True, "viewer_and_busy_no_mutations": True,
        "native_controls": True, "horizontal_overflow": False,
        "png_backgrounds": "fixture compositing of existing real-font PNG, not compiler acceptance",
    })


def main():
    global OUT
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve-fixture", action="store_true")
    parser.add_argument("--base-url", default="http://127.0.0.1:3058")
    parser.add_argument("--output-dir", type=Path, default=OUT)
    parser.add_argument("--role-font-checks", action="store_true",
                        help="Verify automatic role fonts, legacy summaries, manual overrides and readonly UI")
    parser.add_argument("--product-checks", action="store_true",
                        help="Verify real product PNGs, corrections, recognition, invalidation and readonly UI")
    parser.add_argument("--category-checks", action="store_true",
                        help="Verify video category entries, persistence, invalidation, panels and permissions")
    parser.add_argument("--brand-checks", action="store_true",
                        help="Verify skipped brand text/PNG, missing translation counts and brand-only stages")
    parser.add_argument("--font-dir", type=Path,
                        help="Serve real downloaded centurygothic.ttf and centurygothic_bold.ttf from this directory")
    parser.add_argument("--viewport", action="append", choices=("1440", "834", "390"),
                        help="Run only selected viewport widths; repeat for multiple widths")
    parser.add_argument("--role", choices=("creator", "viewer"),
                        help="Run only one permission role")
    args = parser.parse_args()
    OUT = args.output_dir
    if args.serve_fixture:
        ThreadingHTTPServer(("127.0.0.1", 8058), FixtureHandler).serve_forever()
        return
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for width, height in [(1440, 900), (834, 1112), (390, 844)]:
                if args.viewport and str(width) not in args.viewport:
                    continue
                for role in ("creator", "viewer"):
                    if args.role and role != args.role:
                        continue
                    context = browser.new_context(viewport={"width": width, "height": height})
                    api = MockAPI(role, args.font_dir)
                    context.route("**/*", api.route)
                    page = context.new_page()
                    try:
                        if args.brand_checks:
                            run_brands(page, api, args.base_url)
                        elif args.category_checks:
                            run_categories(page, api, args.base_url)
                        elif args.product_checks:
                            run_product_names(page, api, args.base_url)
                        elif args.role_font_checks:
                            run_role_fonts(page, api, args.base_url)
                        else:
                            (run_creator if role == "creator" else run_viewer)(page, api, args.base_url)
                        assert not api.unexpected, f"Undeclared requests: {api.unexpected}"
                        assert api.blocked_debug == 0, "Legacy local debug calls remain after task 9"
                        result = dict(viewport=f"{width}x{height}", role=role,
                                      result="passed", api_requests=len(api.calls),
                                      blocked_legacy_debug=api.blocked_debug,
                                      mocked_font_requests=api.mocked_fonts,
                                      font_files=api.font_files, font_checks=api.font_checks)
                        results.append(result)
                        print(json.dumps(result))
                    except Exception as error:
                        page.screenshot(path=str(OUT / f"failure-{role}-{width}.png"), full_page=True)
                        print(json.dumps(dict(viewport=f"{width}x{height}", role=role,
                                              result="failed", unexpected=api.unexpected,
                                              error=str(error))))
                        raise
                    finally:
                        context.close()
        finally:
            browser.close()
            (OUT / "results.json").write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
