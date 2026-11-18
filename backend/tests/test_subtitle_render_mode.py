"""Platform render contracts, exercised offline against the shared compiler."""

import asyncio
import json
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from backend.app.api.dependencies import get_subtitle_translation_service
from backend.app.repositories import RevisionConflictError
from backend.app.schemas import AssetCreate, AssetType, Status, ToolAssetRole
from backend.app.schemas.auth import UserRole
from backend.app.schemas.subtitle_translation import (
    SubtitleStageRequest,
    SubtitleProductMention,
    SubtitleWorkspace,
    SubtitleWorkspaceCreate,
    SubtitleWorkspaceUpdate,
)
from backend.app.services import subtitle_translation_layout as layout
from backend.app.services.subtitle_translation import LAYOUT_FIELDS
from backend.app.services.subtitle_translation_media import SubtitleTranslationMediaService
from backend.tests.auth_helpers import authenticate_test_client
from backend.tests.test_subtitle_translation_execution import render_task
from backend.tests.test_subtitle_translation_layout import font_http
from backend.tests.test_subtitle_translation_media import FakeInspector, FakeStorage
from backend.tests.test_subtitle_translation_workspace import (
    extracted,
    segment,
    subtitle_repo,
    subtitle_service,
)

__all__ = ["font_http", "subtitle_repo", "subtitle_service"]
BASE = "/api/tools/subtitle-translation/workspaces"
POLICY = "configurable-crf-h264-v3"
SAFE_FIELDS = {"render_mode", "effective_render_mode", "encoding_policy_version", "video_codec", "crf"}


@pytest.mark.parametrize("model", [SubtitleWorkspaceCreate, SubtitleWorkspace, SubtitleWorkspaceUpdate])
@pytest.mark.parametrize("invalid", [-1, 31, 12.0, 12.5, "12", False, True, None])
def test_crf_schema_is_strict(model, invalid):
    values = {"expected_revision": 1} if model is SubtitleWorkspaceUpdate else {}
    with pytest.raises(ValidationError):
        model.model_validate({**values, "crf": invalid})


@pytest.mark.parametrize("crf", [0, 12, 16, 30])
def test_crf_routes_persist_and_reject_invalid_without_submission(client, subtitle_service, crf):
    service = subtitle_service
    service.preview = AsyncMock(side_effect=lambda workspace: workspace)
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    response = client.post(BASE, json={"crf": crf})
    assert response.status_code == 201 and response.json()["crf"] == crf
    url = f"{BASE}/{response.json()['id']}"
    assert client.get(url).json()["crf"] == crf
    saved = client.patch(url, json={"expected_revision": 1, "crf": 0})
    assert saved.status_code == 200 and client.get(url).json()["crf"] == 0
    for value in (-1, 31, 12.0, "12", False, None):
        assert client.post(BASE, json={"crf": value}).status_code == 422
        assert client.patch(url, json={"expected_revision": 2, "crf": value}).status_code == 422
    assert service.repository.list_tool_tasks() == []


@pytest.mark.parametrize("crf", [0, 12, 30])
def test_crf_change_preserves_layout_and_upstream_and_detaches_late_result(subtitle_service, crf):
    service = subtitle_service
    workspace, task, _ = render_task(service)
    def seed(current, tasks):
        current.stage_task_ids["translate"] = "translation-history"
        current.output_asset_id = "old-output"
        item = current.segments[0]
        item.render_layer_asset_id, item.render_layer_url = "layer", "/layer.png"
        item.effective_font_size_px, item.render_bbox_pixels = 24, (1, 2, 100, 30)
        item.text_runs, item.warnings = [{"text": "Ursprung"}], ["layout_preview:notice"]
        return current, None
    workspace = service.repository.mutate_subtitle_workspace(workspace.id, seed)
    workspace = service.repository.get_subtitle_workspace(workspace.id)
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(expected_revision=workspace.revision, crf=crf))
    assert saved.crf == crf and saved.segments == workspace.segments
    assert saved.reference_video == workspace.reference_video and saved.clean_video == workspace.clean_video
    assert saved.stage_task_ids == {key: value for key, value in workspace.stage_task_ids.items() if key != "render"}
    assert saved.output_asset_id is saved.active_task_id is None
    assert service.repository.get_tool_task(task.id).input_snapshot["crf"] == 16
    service._complete(task.id, result={"output_asset_id": "late-output"})
    assert service.repository.get_subtitle_workspace(workspace.id) == saved
    assert service.repository.get_tool_task(task.id).input_snapshot["result"]["output_asset_id"] == "late-output"
    service.translator.recognize_products.assert_not_awaited()


def test_same_crf_preserves_active_render_and_writeback(subtitle_service):
    service = subtitle_service
    workspace, task, _ = render_task(service)
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(expected_revision=workspace.revision, crf=16))
    assert saved.active_task_id == task.id
    service._complete(task.id, result={"output_asset_id": "output"})
    assert service.repository.get_subtitle_workspace(workspace.id).output_asset_id == "output"


@pytest.mark.parametrize("crf", [0, 12, 30])
@pytest.mark.parametrize("mode", ["png", "text"])
def test_crf_frozen_submit_result_and_log_are_consistent(subtitle_service, caplog, crf, mode):
    service = subtitle_service
    workspace, old, client = render_task(service)
    service._complete(old.id, result={"output_asset_id": "old"})
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, crf=crf, render_mode=mode))
    task = service.submit(saved.id, "render", SubtitleStageRequest(expected_revision=saved.revision))
    assert task.id != old.id and task.input_snapshot["crf"] == crf
    assert task.input_snapshot["encoding_result"]["crf"] == crf
    seen = []
    def compiler(segments, video):
        seen.append(video)
        return {"project": {"canvas": {"background_color": "#000000FF"},
                            "track": [[{"type": "video"}], [{"type": "text", "background_color": "#FF000080"}]],
                            "output": {"codec": {"video_bit_rate": 7000}}},
                "layouts": {}, "warnings": []}
    service.compiler = compiler
    import logging
    with caplog.at_level(logging.INFO):
        asyncio.run(service.run(task.id))
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED and seen[0]["crf"] == crf
    assert finished.input_snapshot["result"]["crf"] == crf
    project = client.submit.call_args.kwargs["project"]
    assert project["output"]["codec"] == {"video_codec": "h264", "crf": crf}
    assert "background_color" not in project["canvas"]
    assert "background_color" not in project["track"][1][0]
    event = next(record for record in caplog.records if record.message == "subtitle_translation.submitted")
    assert event.structured_context["crf"] == crf


@pytest.mark.parametrize("frozen,expected", [({}, 16), ({"crf": 0}, 0),
    ({"encoding_result": {"crf": 12}}, 12), ({"crf": 30, "encoding_result": {"crf": 0}}, 30),
    ({"crf": False, "encoding_result": {"crf": 0}}, 0)])
def test_legacy_unsubmitted_uses_frozen_crf_not_latest_workspace(subtitle_service, frozen, expected):
    service = subtitle_service
    workspace, task, client = render_task(service)
    snapshot = {key: value for key, value in task.input_snapshot.items()
                if key not in {"crf", "encoding_result", "encoding_policy_version"}}
    snapshot.update(frozen)
    service.repository.update_tool_task(task.id, input_snapshot=snapshot)
    service.patch(workspace.id, SubtitleWorkspaceUpdate(expected_revision=workspace.revision, crf=12))
    asyncio.run(service.run(task.id))
    assert client.submit.call_args.kwargs["project"]["output"]["codec"]["crf"] == expected


def test_crf_guard_blocks_stale_retry_without_revision_change(subtitle_service):
    service = subtitle_service
    workspace, task, _ = render_task(service)
    def change(current, tasks):
        current.crf = 0
        return current, None
    service.repository.mutate_subtitle_workspace(workspace.id, change)
    service._complete(task.id, error="offline failure")
    with pytest.raises(RevisionConflictError):
        service.retry(task.id)


@pytest.mark.parametrize("model", [SubtitleWorkspaceCreate, SubtitleWorkspace, SubtitleWorkspaceUpdate])
@pytest.mark.parametrize("invalid", [None, "", "PNG", "mixed", "invalid", 1, False])
def test_mode_schema_rejects_explicit_invalid_values(model, invalid):
    values = {"expected_revision": 1} if model is SubtitleWorkspaceUpdate else {}
    with pytest.raises(ValidationError):
        model.model_validate({**values, "render_mode": invalid})


@pytest.mark.parametrize("mode", [None, "png", "text"])
def test_mode_routes_persistence_and_revision(client, subtitle_service, mode):
    service = subtitle_service
    service.preview = AsyncMock(side_effect=lambda workspace: workspace)
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    response = client.post(BASE, json={} if mode is None else {"render_mode": mode})
    assert response.status_code == 201
    workspace = response.json()
    expected = mode or "png"
    url = f"{BASE}/{workspace['id']}"
    assert workspace["render_mode"] == expected
    assert client.get(url).json()["render_mode"] == expected
    assert client.get(BASE).json()[0]["render_mode"] == expected
    saved = client.patch(url, json={"expected_revision": 1, "render_mode": "text"})
    assert saved.status_code == 200 and saved.json()["revision"] == 2
    assert client.get(url).json()["render_mode"] == "text"
    assert service.repository.list_subtitle_workspace_history(workspace["id"])[-1]["render_mode"] == "text"
    assert client.patch(url, json={"expected_revision": 1, "render_mode": "png"}).status_code == 409
    service.translator.recognize_products.assert_not_awaited()


@pytest.mark.parametrize("invalid", [None, "", "mixed", "PNG", 1])
def test_mode_routes_reject_invalid_without_mutation(client, subtitle_service, invalid):
    service = subtitle_service
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    assert client.post(BASE, json={"render_mode": invalid}).status_code == 422
    workspace = service.create(SubtitleWorkspaceCreate(render_mode="text"))
    url = f"{BASE}/{workspace.id}"
    assert client.patch(url, json={"expected_revision": 1, "render_mode": invalid}).status_code == 422
    assert service.repository.get_subtitle_workspace(workspace.id) == workspace


def test_mode_routes_permissions(anonymous_client, repository, subtitle_service):
    service = subtitle_service
    service.preview = AsyncMock(side_effect=lambda workspace: workspace)
    anonymous_client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    workspace = service.create(SubtitleWorkspaceCreate(render_mode="text"))
    url = f"{BASE}/{workspace.id}"
    assert anonymous_client.patch(url, json={"expected_revision": 1, "render_mode": "png"}).status_code == 401
    authenticate_test_client(anonymous_client, repository, role=UserRole.VIEWER)
    assert anonymous_client.get(url).json()["render_mode"] == "text"
    assert anonymous_client.patch(url, json={"expected_revision": 1, "render_mode": "png"}).status_code == 403
    assert anonymous_client.post(BASE, json={"render_mode": "text"}).status_code == 403
    assert service.repository.get_subtitle_workspace(workspace.id) == workspace


def test_missing_mode_defaults_png_without_rewriting_history(subtitle_service):
    from backend.app.db.models import SubtitleWorkspaceORM

    service = subtitle_service
    workspace = service.create(SubtitleWorkspaceCreate())
    legacy = workspace.model_dump(mode="json", exclude={"render_mode"})
    repo = service.repository
    if hasattr(repo, "_session_factory"):
        with repo._session_factory.begin() as session:
            row = session.get(SubtitleWorkspaceORM, workspace.id)
            row.payload, row.history = legacy, [legacy]
    else:
        repo._subtitle_workspaces[workspace.id] = SubtitleWorkspace.model_validate(legacy)
        repo._subtitle_history[workspace.id] = [legacy]
    assert repo.get_subtitle_workspace(workspace.id).render_mode == "png"
    assert repo.list_subtitle_workspaces()[0].render_mode == "png"
    assert repo.list_subtitle_workspace_history(workspace.id) == [legacy]
    if hasattr(repo, "_session_factory"):
        with repo._session_factory() as session:
            assert session.get(SubtitleWorkspaceORM, workspace.id).payload == legacy


def test_mode_invalidates_only_layout_and_current_render(subtitle_service):
    service = subtitle_service
    workspace, extraction = extracted(service)

    def seed(current, tasks):
        item = current.segments[0]
        item.style.font_size_px = 24
        item.background_color = "#FFFFFF"
        item.product_mentions = [{
            "start": 0, "end": 8, "model": "Ursprung", "spec": "",
            "origin": "manual", "status": "confirmed",
        }]
        item.product_text_sha256, item.product_recognition_sha256 = "a" * 64, "b" * 64
        item.render_layer_asset_id, item.render_layer_url = "layer", "/layer.png"
        item.text_runs, item.effective_render_mode = [{"text": "Ursprung"}], "png"
        item.warnings = ["recognition_notice", "missing_glyphs", "layout_preview:old"]
        current.warnings = ["recognition_notice", "s1:subtitle_raster_unavailable", "png_text_fallback"]
        current.stage_task_ids["translate"] = "translate-history"
        return current, None

    workspace = service.repository.mutate_subtitle_workspace(workspace.id, seed)
    task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
    asset = service.repository.create_subtitle_output_asset(AssetCreate(
        type=AssetType.STORYBOARD_VIDEO, status=Status.SUCCEEDED,
        tool_asset_role=ToolAssetRole.OUTPUT, tool_task_id=task.id, mime_type="video/mp4",
        metadata={"render_mode": "png"},
    ))
    service._complete(task.id, result={"output_asset_id": asset.id})
    old_task = service.repository.get_tool_task(task.id)
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode="text",
    ))
    assert saved.revision == workspace.revision + 1 and saved.render_mode == "text"
    assert saved.output_asset_id is None and saved.active_task_id is None
    assert saved.stage_task_ids == {"extract": extraction.id, "translate": "translate-history"}
    assert all(getattr(saved.segments[0], field) is None for field in LAYOUT_FIELDS)
    for field in ("text", "translated_text", "excluded", "style", "product_mentions",
                  "product_text_sha256", "product_recognition_sha256"):
        assert getattr(saved.segments[0], field) == getattr(workspace.segments[0], field)
    assert saved.warnings == saved.segments[0].warnings == ["recognition_notice"]
    assert service.repository.get_asset(asset.id) == asset
    assert service.repository.get_tool_task(task.id) == old_task
    service.translator.recognize_products.assert_not_awaited()


@pytest.mark.parametrize("operation", ["extract", "translate", "render"])
def test_mode_change_rebases_only_unaffected_stages(subtitle_service, operation):
    service = subtitle_service
    workspace, _ = extracted(service)
    if operation == "translate":
        def pending(current, tasks):
            current.segments[0].translated_text = None
            return current, None
        workspace = service.repository.mutate_subtitle_workspace(workspace.id, pending)
    task = service.submit(workspace.id, operation, SubtitleStageRequest(expected_revision=workspace.revision))
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode="text",
    ))
    snapshot = service.repository.get_tool_task(task.id).input_snapshot
    assert snapshot["render_mode"] == "png"
    assert snapshot["revision"] == workspace.revision
    if operation == "render":
        assert saved.active_task_id is None and "writeback_revision" not in snapshot
    else:
        assert saved.active_task_id == task.id and snapshot["writeback_revision"] == saved.revision


def test_same_mode_preserves_current_render_and_derived_fields(subtitle_service):
    service = subtitle_service
    workspace, task, _ = render_task(service)
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode="png",
    ))
    assert saved.active_task_id == task.id
    service._complete(task.id, result={"output_asset_id": "output"})
    assert service.repository.get_subtitle_workspace(workspace.id).output_asset_id == "output"


def test_mode_identity_is_distinct_even_at_same_revision(subtitle_service):
    service = subtitle_service
    workspace, task, _ = render_task(service)
    service._complete(task.id, result={"output_asset_id": "old-output"})
    def change(current, tasks):
        current.render_mode = "text"
        return current, None
    service.repository.mutate_subtitle_workspace(workspace.id, change)
    request = SubtitleStageRequest(expected_revision=workspace.revision)
    fresh = service.submit(workspace.id, "render", request)
    assert fresh.id != task.id
    assert fresh.input_snapshot["idempotency_key"] != task.input_snapshot["idempotency_key"]
    assert fresh.input_snapshot["render_mode"] == "text"
    assert service.submit(workspace.id, "render", request).id == fresh.id


@pytest.mark.parametrize("revision_change", [False, True])
def test_mode_guard_prevents_late_writeback_and_stale_retry(subtitle_service, revision_change):
    service = subtitle_service
    workspace, task, client = render_task(service)
    async def poll(**kwargs):
        if revision_change:
            service.patch(workspace.id, SubtitleWorkspaceUpdate(
                expected_revision=workspace.revision, render_mode="text"))
        else:
            def change(current, tasks):
                current.render_mode = "text"
                return current, None
            service.repository.mutate_subtitle_workspace(workspace.id, change)
        raise RuntimeError("poll interrupted")
    client.poll.side_effect = poll
    asyncio.run(service.run(task.id))
    assert service.repository.get_subtitle_workspace(workspace.id).output_asset_id is None
    with pytest.raises(RevisionConflictError, match="snapshot is stale"):
        service.retry(task.id)


@pytest.mark.parametrize("mode", ["png", "text"])
@pytest.mark.parametrize("category", ["product", "unboxing"])
def test_real_compiler_preview_and_submit_follow_saved_mode(subtitle_service, mode, category):
    service = subtitle_service
    workspace, task, client = render_task(service, video_category=category)
    service._complete(task.id, error="not submitted")
    workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode=mode))
    service.compiler = None
    original_prepare = service.layers.prepare
    service.layers.prepare = AsyncMock(wraps=original_prepare)
    before = service.repository.list_subtitle_workspace_history(workspace.id)
    preview = asyncio.run(service.preview(workspace))
    assert preview.render_mode == mode
    assert preview.segments[0].effective_render_mode == mode
    assert bool(preview.segments[0].render_layer_asset_id) == (mode == "png")
    assert service.repository.list_subtitle_workspace_history(workspace.id) == before
    task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
    asyncio.run(service.run(task.id))
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED
    assert finished.input_snapshot["render_mode"] == finished.input_snapshot["effective_render_mode"] == mode
    assert finished.input_snapshot["layouts"]["s1"]["effective_render_mode"] == mode
    project = client.submit.call_args.kwargs["project"]
    assert project["output"]["codec"] == {"video_codec": "h264", "crf": 16}
    assert project["output"]["fps"] == 30 and project["output"]["disable_audio"] is False
    assert project["track"][0][0]["type"] == "video"
    assert {e["type"] for t in project["track"][1:] for e in t} == ({"text"} if mode == "text" else {"image"})
    if mode == "text":
        service.layers.prepare.assert_not_awaited()
        assert "subtitle-layer:" not in json.dumps(project)
    else:
        assert service.layers.prepare.await_count == 2


def test_unsaved_preview_uses_saved_mode_and_clears_png(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    service.compiler = None
    preview = asyncio.run(service.preview(workspace))
    assert preview.segments[0].render_layer_asset_id
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode="text"))
    drafts = [item.model_copy(deep=True) for item in preview.segments]
    drafts[0].translated_text = "Draft"
    before = service.repository.list_subtitle_workspace_history(workspace.id)
    result = asyncio.run(service.preview(saved, SubtitleWorkspaceUpdate(
        expected_revision=saved.revision, segments=drafts, render_mode="png")))
    assert result.render_mode == "text" and result.revision == saved.revision
    assert result.segments[0].translated_text == "Draft"
    assert result.segments[0].effective_render_mode == "text"
    assert result.segments[0].render_layer_asset_id is result.segments[0].render_layer_url is None
    assert not result.segments[0].text_runs
    assert service.repository.list_subtitle_workspace_history(workspace.id) == before
    assert service.repository.get_subtitle_workspace(workspace.id) == saved


@pytest.mark.parametrize("failure", ["storage", "mixed", "all_text"])
def test_png_fallback_is_tracked_without_rewriting_requested_mode(subtitle_service, monkeypatch, failure):
    service = subtitle_service
    workspace, task, client = render_task(service)
    service.compiler = None
    if failure == "storage":
        service.layers.prepare = AsyncMock(side_effect=RuntimeError("private storage URL"))
        expected = "text"
    else:
        def seed(current, tasks):
            current.segments = [segment("s1"), segment("s2")]
            return current, None
        workspace = service.repository.mutate_subtitle_workspace(workspace.id, seed)
        snapshot = {**task.input_snapshot, "segments": [s.model_dump(mode="json") for s in workspace.segments]}
        service.repository.update_tool_task(task.id, input_snapshot=snapshot)
        from video_subtitle_grounding import raster
        original = raster.rasterize_text
        def rasterize(element, summary):
            if failure == "all_text" or summary["segment_id"] == "s2":
                raise ValueError("offline raster failure")
            return original(element, summary)
        monkeypatch.setattr(raster, "rasterize_text", rasterize)
        expected = "text" if failure == "all_text" else "mixed"
    asyncio.run(service.run(task.id))
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED
    snapshot = finished.input_snapshot
    assert snapshot["render_mode"] == "png" and snapshot["effective_render_mode"] == expected
    assert f"png_{expected}_fallback" in snapshot["layout_warnings"]
    assert {s["effective_render_mode"] for s in snapshot["layouts"].values()} == (
        {"png", "text"} if expected == "mixed" else {"text"})
    assert client.submit.call_args.kwargs["project"]["output"]["codec"] == {"video_codec": "h264", "crf": 16}
    assert service.media.store_output.call_args.kwargs["task"].input_snapshot["effective_render_mode"] == expected


def test_old_unsubmitted_snapshot_upgrades_from_frozen_png_not_workspace(subtitle_service):
    service = subtitle_service
    workspace, task, client = render_task(service)
    old = deepcopy(task.input_snapshot)
    old.pop("render_mode")
    old.update(encoding_policy_version="source-video-bit-rate-v1",
               encoding_result={"source_asset_id": "clean", "video_bit_rate": 7000000},
               layouts={"old": {}}, effective_render_mode="png", layout_warnings=["old"])
    service.repository.update_tool_task(task.id, input_snapshot=old)
    service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode="text"))
    seen = []
    def compiler(segments, video):
        seen.append(video["render_mode"])
        return layout.compile_subtitle_project(segments, video)
    service.compiler = compiler
    service.media.ensure_metadata = AsyncMock(side_effect=AssertionError("no probe"))
    asyncio.run(service.run(task.id))
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED and seen == ["png"]
    assert finished.input_snapshot["encoding_policy_version"] == POLICY
    assert finished.input_snapshot["encoding_result"] == {"source_asset_id": "clean", "video_codec": "h264", "crf": 16}
    assert finished.input_snapshot["idempotency_key"] != old["idempotency_key"]
    assert "old" not in finished.input_snapshot["layouts"]
    assert service.repository.get_subtitle_workspace(workspace.id).output_asset_id is None
    service.media.ensure_metadata.assert_not_awaited()
    assert client.submit.await_count == 1


@pytest.mark.parametrize("resume", [False, True])
def test_historical_provider_poll_preserves_snapshot_and_output_metadata(
    subtitle_service, tmp_path, resume,
):
    service = subtitle_service
    workspace, task, client = render_task(service)
    old = {k: v for k, v in task.input_snapshot.items()
           if k not in {"render_mode", "crf", "encoding_policy_version", "encoding_result"}}
    old.update(render_layout_version="historic", layouts={"s1": {"effective_font_size_px": 22}})
    service.repository.update_tool_task(task.id, provider_task_id="historic-provider", input_snapshot=old)
    if resume:
        service._complete(task.id, error="poll interrupted")
        task = service.retry(task.id)
        old = deepcopy(task.input_snapshot)
    service.compiler = lambda *args: pytest.fail("must not compile historic submitted task")
    service.layers.prepare = AsyncMock(side_effect=AssertionError("must not prepare"))
    media = SubtitleTranslationMediaService(service.repository, FakeStorage(), inspector=FakeInspector())
    path = tmp_path / "output.mp4"
    path.touch(mode=0o600)
    async def store(url, *, task):
        display, metadata = await media.inspector.inspect(path, role="clean")
        return await media._store_path(path, mime_type="video/mp4", size=1, metadata=metadata,
                                       display=display, filename="output.mp4", task=task)
    service.media = SimpleNamespace(store_output=AsyncMock(side_effect=store),
                                    ensure_metadata=AsyncMock(side_effect=AssertionError("must not probe")))
    asyncio.run(service.run(task.id))
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED
    for key, value in old.items():
        if key != "result":
            assert finished.input_snapshot[key] == value
    assert not (SAFE_FIELDS & finished.input_snapshot.keys())
    asset = service.repository.get_asset(finished.input_snapshot["result"]["output_asset_id"])
    assert not (SAFE_FIELDS & asset.metadata.keys())
    assert client.submit.await_count == 0
    assert client.poll.call_args.kwargs["task_id"] == "historic-provider"
    service.layers.prepare.assert_not_awaited()
    service.media.ensure_metadata.assert_not_awaited()


@pytest.mark.parametrize("requested,effective", [("png", "png"), ("text", "text"), ("png", "text"), ("png", "mixed")])
@pytest.mark.parametrize("crf", [0, 12, 16, 30])
def test_output_metadata_contains_only_safe_frozen_configuration(subtitle_service, tmp_path, requested, effective, crf):
    service = subtitle_service
    _, task, _ = render_task(service)
    snapshot = {**task.input_snapshot, "render_mode": requested, "effective_render_mode": effective,
                "encoding_policy_version": POLICY,
                "encoding_result": {"source_asset_id": "clean", "video_codec": "h264", "crf": crf,
                                    "url": "https://private/?token=secret"},
                "model_raw": "private model"}
    task = task.model_copy(update={"input_snapshot": snapshot})
    media = SubtitleTranslationMediaService(service.repository, FakeStorage(), inspector=FakeInspector())
    path = tmp_path / "output.mp4"
    path.touch(mode=0o600)
    async def store():
        display, metadata = await media.inspector.inspect(path, role="clean")
        return await media._store_path(path, mime_type="video/mp4", size=1, metadata=metadata,
                                       display=display, filename="output.mp4", task=task)
    asset = asyncio.run(store())
    assert {key: asset.metadata[key] for key in SAFE_FIELDS} == {
        "render_mode": requested, "effective_render_mode": effective,
        "encoding_policy_version": POLICY, "video_codec": "h264", "crf": crf,
    }
    assert "private" not in json.dumps(asset.metadata) and "secret" not in json.dumps(asset.metadata)


@pytest.mark.parametrize("preview", [False, True])
def test_storage_fallback_keeps_png_failure_reasons(subtitle_service, preview):
    service = subtitle_service
    workspace, task, _ = render_task(service)
    prior = ["s1:subtitle_raster_unavailable", "s1:missing_glyphs"]
    def compiler(records, video):
        compiled = layout.compile_subtitle_project(records, video)
        compiled["warnings"].extend(prior)
        compiled["layouts"]["s1"]["warnings"].extend(["subtitle_raster_unavailable", "missing_glyphs"])
        return compiled
    service.compiler = compiler
    service.layers.prepare = AsyncMock(side_effect=RuntimeError("private storage failure"))
    if preview:
        result = asyncio.run(service.preview(workspace))
        warnings, row = result.warnings, result.segments[0]
        assert row.effective_render_mode == "text"
        row_warnings = row.warnings
    else:
        asyncio.run(service.run(task.id))
        snapshot = service.repository.get_tool_task(task.id).input_snapshot
        assert snapshot["effective_render_mode"] == "text" and snapshot["render_mode"] == "png"
        warnings, row_warnings = snapshot["layout_warnings"], snapshot["layouts"]["s1"]["warnings"]
    assert set(prior) <= set(warnings)
    assert {"subtitle_raster_unavailable", "missing_glyphs", "product_layer_storage_unavailable"} <= set(row_warnings)
    assert "product_layer_storage_unavailable" in warnings


def test_injected_object_compiler_initializes_new_warnings(subtitle_service):
    service = subtitle_service
    _, task, _ = render_task(service)
    snapshot = {**task.input_snapshot, "layout_warnings": ["stale-warning"]}
    service.repository.update_tool_task(task.id, input_snapshot=snapshot)
    service.compiler = lambda records, video: SimpleNamespace(
        project={"track": [[{"type": "video"}], [{"type": "text"}]]},
        layouts={"s1": {"track_index": 1}}, warnings=["new-warning"],
    )
    asyncio.run(service.run(task.id))
    snapshot = service.repository.get_tool_task(task.id).input_snapshot
    assert "new-warning" in snapshot["layout_warnings"]
    assert "stale-warning" not in snapshot["layout_warnings"]
    assert snapshot["effective_render_mode"] == "text"


@pytest.mark.parametrize("preview", [False, True])
def test_text_invalid_custom_layers_never_prepare_or_submit(subtitle_service, preview):
    service = subtitle_service
    workspace, old_task, client = render_task(service)
    service._complete(old_task.id, error="not submitted")
    workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode="text"))
    service.compiler = lambda records, video: {
        "project": {}, "layouts": {}, "warnings": [], "layers": {"invalid": {}},
    }
    service.layers.prepare = AsyncMock(side_effect=AssertionError("text must never prepare"))
    if preview:
        result = asyncio.run(service.preview(workspace))
        assert "layout_preview:text_render_layers_unavailable" in result.warnings
    else:
        task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
        asyncio.run(service.run(task.id))
        assert service.repository.get_tool_task(task.id).status == Status.FAILED
    service.layers.prepare.assert_not_awaited()
    client.submit.assert_not_awaited()


@pytest.mark.parametrize("preview", [False, True])
def test_text_product_fallback_preserves_recognition(subtitle_service, preview):
    service = subtitle_service
    workspace, old_task, client = render_task(service)
    service._complete(old_task.id, error="not submitted")
    items = [item.model_copy(deep=True) for item in workspace.segments]
    items[0].translated_text = "DEEBOT X8 PRO OMNI"
    items[0].product_mentions = [{
        "start": 0, "end": 18, "model": "DEEBOT X8", "spec": "PRO OMNI",
        "origin": "manual", "status": "confirmed",
    }]
    from video_subtitle_grounding.product_names import text_fingerprint
    items[0].product_text_sha256 = text_fingerprint(items[0].translated_text)
    workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode="text", segments=items))
    workspace = service.repository.get_subtitle_workspace(workspace.id)
    before = deepcopy(workspace.segments[0].product_mentions)
    assert before
    service.compiler = None
    service.layers.prepare = AsyncMock(side_effect=AssertionError("text must never prepare"))
    if preview:
        result = asyncio.run(service.preview(workspace))
        assert "text_product_font_fallback" in result.segments[0].warnings
        assert [
            SubtitleProductMention.model_validate(item).model_dump(exclude_none=True)
            for item in result.segments[0].product_mentions
        ] == [
            SubtitleProductMention.model_validate(item).model_dump(exclude_none=True)
            for item in before
        ]
    else:
        task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
        asyncio.run(service.run(task.id))
        finished = service.repository.get_tool_task(task.id)
        assert finished.status == Status.SUCCEEDED
        assert "text_product_font_fallback" in finished.input_snapshot["layouts"]["s1"]["warnings"]
        project = client.submit.call_args.kwargs["project"]
        assert {e["type"] for t in project["track"][1:] for e in t} == {"text"}
    assert service.repository.get_subtitle_workspace(workspace.id).segments[0].product_mentions == before
    service.layers.prepare.assert_not_awaited()
    service.translator.recognize_products.assert_not_awaited()


@pytest.mark.parametrize("revision_change", [False, True])
def test_mode_change_during_poll_keeps_success_history_only(subtitle_service, revision_change):
    service = subtitle_service
    workspace, task, client = render_task(service)
    async def poll(**kwargs):
        if revision_change:
            service.patch(workspace.id, SubtitleWorkspaceUpdate(
                expected_revision=workspace.revision, render_mode="text"))
        else:
            def change(current, tasks):
                current.render_mode = "text"
                return current, None
            service.repository.mutate_subtitle_workspace(workspace.id, change)
        return SimpleNamespace(output_video_url="https://offline.example/video.mp4")
    client.poll.side_effect = poll
    asyncio.run(service.run(task.id))
    assert service.repository.get_subtitle_workspace(workspace.id).output_asset_id is None
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED
    assert finished.input_snapshot["result"]["output_asset_id"] == "stored-output"
    assert finished.input_snapshot["render_mode"] == "png"


@pytest.mark.parametrize("mode", ["png", "text"])
def test_queued_render_executes_frozen_mode_after_switch(subtitle_service, mode):
    service = subtitle_service
    workspace, old_task, client = render_task(service)
    service._complete(old_task.id, error="not submitted")
    workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode=mode))
    task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
    changed = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, render_mode="text" if mode == "png" else "png"))
    service.compiler = None
    asyncio.run(service.run(task.id))
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED
    assert finished.input_snapshot["render_mode"] == finished.input_snapshot["effective_render_mode"] == mode
    assert service.repository.get_subtitle_workspace(workspace.id) == changed
    assert {e["type"] for t in client.submit.call_args.kwargs["project"]["track"][1:] for e in t} == (
        {"image"} if mode == "png" else {"text"})


@pytest.mark.parametrize("cached", [None, {"source_asset_id": "clean", "video_bit_rate": 7000},
                                   {"source_asset_id": "other", "video_codec": "h264", "crf": 16}])
def test_encoding_cache_replaced_without_metadata_fetch(subtitle_service, cached):
    service = subtitle_service
    _, task, _ = render_task(service)
    service.repository.update_tool_task(task.id, input_snapshot={**task.input_snapshot, "encoding_result": cached})
    task = service.repository.get_tool_task(task.id)
    service.media.ensure_metadata = AsyncMock(side_effect=AssertionError("no metadata fetch"))
    result = asyncio.run(service._resolve_render_encoding(task, service.media))
    assert result["encoding_result"] == {"source_asset_id": "clean", "video_codec": "h264", "crf": 16}
    assert result["idempotency_key"] == task.input_snapshot["idempotency_key"]
    assert asyncio.run(service._resolve_render_encoding(
        service.repository.get_tool_task(task.id), service.media)) == result
    service.media.ensure_metadata.assert_not_awaited()


@pytest.mark.parametrize("warning", ["background_unknown", "low_contrast", "contrast_unverified"])
def test_mode_switch_and_refresh_clear_color_diagnostics_only(subtitle_service, warning):
    service = subtitle_service
    workspace, extraction = extracted(service)
    keep = ["product_recognition_unavailable", "translation_notice"]
    old_warning = f"s1:{warning}"
    def seed(current, tasks):
        item = current.segments[0]
        item.background_color = "#FFFFFF"
        item.style.text_color = "#000000"
        item.style.background_color = "#FFFFFF"
        item.product_recognition_sha256 = "b" * 64
        item.warnings = [*keep, warning]
        current.warnings = [*keep, old_warning]
        current.stage_task_ids["translate"] = "translation-history"
        return current, None
    workspace = service.repository.mutate_subtitle_workspace(workspace.id, seed)
    task = service.submit(workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision))
    service._complete(task.id, result={
        "output_asset_id": "historical-output", "warnings": [old_warning],
        "layouts": {"s1": {"warnings": [*keep, warning]}},
    })
    historic = service.repository.get_tool_task(task.id)
    asset = service.repository.create_subtitle_output_asset(AssetCreate(
        id="historical-output", type=AssetType.STORYBOARD_VIDEO, status=Status.SUCCEEDED,
        tool_asset_role=ToolAssetRole.OUTPUT, tool_task_id=task.id, mime_type="video/mp4",
        metadata={"warnings": [old_warning]},
    ))
    for mode in ("text", "png"):
        workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, render_mode=mode))
        assert warning not in workspace.segments[0].warnings and old_warning not in workspace.warnings
        assert set(keep) <= set(workspace.segments[0].warnings)
        assert set(keep) <= set(workspace.warnings)
        assert workspace.segments[0].product_recognition_sha256 == "b" * 64
        assert workspace.stage_task_ids == {"extract": extraction.id, "translate": "translation-history"}
        assert workspace.output_asset_id is None
        refreshed = service.repository.get_subtitle_workspace(workspace.id)
        assert refreshed == workspace
        service.compiler = None
        preview = asyncio.run(service.preview(refreshed))
        assert warning not in preview.segments[0].warnings
        assert old_warning not in preview.warnings
        assert preview.segments[0].effective_render_mode == mode
    assert service.repository.get_tool_task(task.id) == historic
    assert service.repository.get_asset(asset.id) == asset
    assert service.repository.get_tool_task(task.id).input_snapshot["result"]["warnings"] == [old_warning]
    service.translator.recognize_products.assert_not_awaited()


def test_mode_switch_preserves_brand_notices_and_frozen_diagnostics(subtitle_service):
    from backend.tests.test_subtitle_brand_exclusion import seed

    service = subtitle_service
    workspace, _ = seed(service)
    workspace.segments[-1].translated_text = "Product"
    workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, segments=workspace.segments))
    assert "brand_content_skipped" in workspace.warnings
    originals = [item.model_dump(exclude={*LAYOUT_FIELDS, "warnings"}) for item in workspace.segments]
    for mode in ("text", "png"):
        workspace = service.patch(workspace.id, SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, render_mode=mode))
        assert "brand_content_skipped" in workspace.warnings
        assert all("brand_content_skipped" in item.warnings for item in workspace.segments[:2])
        assert [item.model_dump(exclude={*LAYOUT_FIELDS, "warnings"}) for item in workspace.segments] == originals
        assert service.repository.get_subtitle_workspace(workspace.id).render_mode == mode
    service.translator.recognize_products.assert_not_awaited()
