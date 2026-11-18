import asyncio
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from backend.app.repositories import RevisionConflictError
from backend.app.schemas import AssetCreate, AssetType, Status, ToolAssetRole
from backend.app.schemas.subtitle_translation import (
    SubtitleStageRequest,
    SubtitleTranslationSegment,
    SubtitleWorkspace,
    SubtitleWorkspaceCreate,
    SubtitleWorkspaceUpdate,
)
from backend.app.services.subtitle_translation import LAYOUT_FIELDS, SubtitleTranslationService


@pytest.fixture(params=["memory", "mysql"])
def subtitle_repo(request, repository, mysql_repository):
    return repository if request.param == "memory" else mysql_repository


@pytest.fixture
def subtitle_service(subtitle_repo, test_asset_storage):
    for asset_id in ("reference", "clean", "reference2"):
        subtitle_repo.create_asset(
            AssetCreate(
                id=asset_id,
                type=AssetType.STORYBOARD_VIDEO,
                tool_asset_role=ToolAssetRole.INPUT,
                status=Status.SUCCEEDED,
                mime_type="video/mp4",
                object_key=f"{asset_id}.mp4",
                size_bytes=12,
                metadata={
                    "subtitle_video": {
                        "width": 1280,
                        "height": 720,
                        "duration_ms": 10000,
                        "rotation": 0,
                        "fps": 30,
                        "has_audio": True,
                        "video_bit_rate": 7000000,
                        "video_bit_rate_probed": True,
                    }
                },
            )
        )
    async def recognize(records, *, segment_ids):
        from video_subtitle_grounding.product_names import effective_mentions, text_fingerprint

        return {
            "product_mentions": {r["segment_id"]: effective_mentions(r) for r in records
                                 if r["segment_id"] in segment_ids},
            "product_text_sha256": {r["segment_id"]: text_fingerprint(r["text"]) for r in records},
            "warnings": {},
        }

    return SubtitleTranslationService(
        subtitle_repo, test_asset_storage,
        translator=SimpleNamespace(recognize_products=AsyncMock(side_effect=recognize)))


def segment(segment_id="s1"):
    return SubtitleTranslationSegment(
        segment_id=segment_id,
        text="Original",
        start_ms=100,
        end_ms=1000,
        bbox_normalized=(10, 10, 500, 100),
        bbox_pixels=(12, 7, 640, 72),
        block_id="block1",
        translated_text="Ursprung",
        translation_status="succeeded",
    )


def extracted(service, *, video_category="unboxing"):
    workspace = service.create(
        SubtitleWorkspaceCreate(
            video_category=video_category,
            reference_video_asset_id="reference",
            clean_video_asset_id="clean",
        )
    )
    task = service.submit(
        workspace.id, "extract", SubtitleStageRequest(expected_revision=1)
    )
    service._complete(task.id, result={"segments": [segment().model_dump(mode="json")]})
    return service.repository.get_subtitle_workspace(workspace.id), task


@pytest.mark.parametrize("category", ["product", "unboxing"])
def test_video_category_json_history_and_stage_snapshot(subtitle_service, category):
    service = subtitle_service
    workspace = service.create(SubtitleWorkspaceCreate(
        video_category=category, reference_video_asset_id="reference",
    ))
    assert service.repository.get_subtitle_workspace(workspace.id).video_category == category
    assert service.repository.list_subtitle_workspaces()[0].video_category == category
    assert workspace.model_dump(mode="json")["video_category"] == category
    history = service.repository.list_subtitle_workspace_history(workspace.id)
    assert history[0]["video_category"] == category
    saved = service.patch(
        workspace.id, SubtitleWorkspaceUpdate(expected_revision=1, name="Renamed"),
    )
    assert saved.video_category == category
    task = service.submit(
        workspace.id, "extract", SubtitleStageRequest(expected_revision=saved.revision),
    )
    assert task.input_snapshot["video_category"] == category
    assert service.repository.list_subtitle_workspace_history(workspace.id)[-1]["video_category"] == category


def test_legacy_workspace_category_defaults_without_rewriting_json(subtitle_service):
    from backend.app.db.models import SubtitleWorkspaceORM

    service = subtitle_service
    workspace = service.create(SubtitleWorkspaceCreate())
    assert workspace.video_category == "unboxing"
    legacy = workspace.model_dump(mode="json", exclude={"video_category"})
    assert SubtitleWorkspace.model_validate(legacy).video_category == "unboxing"
    repo = service.repository
    if hasattr(repo, "_session_factory"):
        with repo._session_factory.begin() as session:
            row = session.get(SubtitleWorkspaceORM, workspace.id)
            row.payload = legacy
            row.history = [legacy]
    else:
        repo._subtitle_workspaces[workspace.id] = SubtitleWorkspace.model_validate(legacy)
        repo._subtitle_history[workspace.id] = [legacy]
    assert repo.get_subtitle_workspace(workspace.id).video_category == "unboxing"
    assert repo.list_subtitle_workspaces()[0].video_category == "unboxing"
    assert repo.list_subtitle_workspace_history(workspace.id) == [legacy]
    if hasattr(repo, "_session_factory"):
        with repo._session_factory() as session:
            assert session.get(SubtitleWorkspaceORM, workspace.id).payload == legacy


def test_category_change_invalidates_only_render_and_preserves_product_fingerprints(
    subtitle_service,
):
    service = subtitle_service
    workspace, extraction = extracted(service)

    def seed(current, tasks):
        item = current.segments[0]
        item.style.background_color = "#33333359"
        item.product_mentions = [{
            "start": 0, "end": 8, "model": "Ursprung", "spec": "",
            "origin": "model_pattern", "status": "confirmed",
        }]
        item.product_text_sha256 = "a" * 64
        item.product_recognition_sha256 = "b" * 64
        item.render_layer_asset_id = "old-layer"
        item.render_layer_url = "/old-layer.png"
        item.effective_font_size_px = 22
        item.text_runs = [{"text": "Ursprung"}]
        current.output_asset_id = "old-output"
        current.stage_task_ids["translate"] = "translation-history"
        return current, None

    workspace = service.repository.mutate_subtitle_workspace(workspace.id, seed)
    before = workspace.segments[0].model_dump(exclude=set(LAYOUT_FIELDS))
    task = service.submit(
        workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision),
    )
    assert task.input_snapshot["video_category"] == "unboxing"
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, video_category="product",
    ))
    assert saved.revision == workspace.revision + 1
    assert saved.video_category == "product"
    assert saved.output_asset_id is None
    assert saved.active_task_id is None
    assert saved.stage.value == "review_ready"
    assert saved.stage_task_ids == {
        "extract": extraction.id, "translate": "translation-history",
    }
    assert saved.reference_video == workspace.reference_video
    assert saved.clean_video == workspace.clean_video
    assert saved.segments[0].model_dump(exclude=set(LAYOUT_FIELDS)) == before
    assert all(getattr(saved.segments[0], key) is None for key in LAYOUT_FIELDS)
    assert service.repository.get_tool_task(task.id).input_snapshot == task.input_snapshot
    service.translator.recognize_products.assert_not_awaited()
    service._complete(task.id, result={"output_asset_id": "late-output"})
    assert service.repository.get_subtitle_workspace(workspace.id) == saved
    assert service.repository.get_tool_task(task.id).input_snapshot["result"]["output_asset_id"] == "late-output"
    with pytest.raises(RevisionConflictError):
        service.patch(workspace.id, SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, video_category="unboxing",
        ))
    restored = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=saved.revision, video_category="unboxing",
    ))
    assert restored.segments[0].style.background_color == "#33333359"
    assert restored.segments[0].product_recognition_sha256 == "b" * 64


def test_same_category_does_not_invalidate_active_render(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    task = service.submit(
        workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision),
    )
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, video_category="unboxing",
    ))
    assert saved.active_task_id == task.id
    assert saved.stage.value == "rendering"
    service._complete(task.id, result={"output_asset_id": "output"})
    assert service.repository.get_subtitle_workspace(workspace.id).output_asset_id == "output"


@pytest.mark.parametrize("operation", ["extract", "translate"])
def test_category_edit_rebases_unaffected_stage(subtitle_service, operation):
    service = subtitle_service
    workspace = service.create(SubtitleWorkspaceCreate(reference_video_asset_id="reference"))
    if operation == "translate":
        workspace, _ = extracted(service)

        def pending(current, tasks):
            current.segments[0].translated_text = None
            return current, None

        workspace = service.repository.mutate_subtitle_workspace(workspace.id, pending)
    task = service.submit(
        workspace.id, operation, SubtitleStageRequest(expected_revision=workspace.revision),
    )
    saved = service.patch(workspace.id, SubtitleWorkspaceUpdate(
        expected_revision=workspace.revision, video_category="product",
    ))
    assert saved.active_task_id == task.id
    assert saved.stage.value == ("extracting" if operation == "extract" else "translating")
    snapshot = service.repository.get_tool_task(task.id).input_snapshot
    assert snapshot["video_category"] == "unboxing"
    assert snapshot["revision"] == workspace.revision
    assert snapshot["writeback_revision"] == saved.revision
    result = (
        {"segments": [segment().model_dump(mode="json")]}
        if operation == "extract" else {"translations": {"s1": "Translated"}, "failed_ids": []}
    )
    service._complete(task.id, result=result)
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.video_category == "product"
    assert current.segments[0].translated_text
    assert current.revision == saved.revision + 1


def test_category_is_in_render_identity_even_at_same_revision(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    request = SubtitleStageRequest(expected_revision=workspace.revision)
    first = service.submit(workspace.id, "render", request)
    service._complete(first.id, result={"output_asset_id": "old-output"})

    def change_only_category(current, tasks):
        current.video_category = "product"
        return current, None

    service.repository.mutate_subtitle_workspace(workspace.id, change_only_category)
    fresh = service.submit(workspace.id, "render", request)
    assert fresh.id != first.id
    assert fresh.input_snapshot["video_category"] == "product"
    assert fresh.input_snapshot["idempotency_key"] != first.input_snapshot["idempotency_key"]
    assert service.submit(workspace.id, "render", request).id == fresh.id


def test_render_does_not_reuse_pre_category_identity(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    request = SubtitleStageRequest(expected_revision=workspace.revision)
    task = service.submit(workspace.id, "render", request)
    snapshot = {k: v for k, v in task.input_snapshot.items() if k != "video_category"}
    snapshot["idempotency_key"] = hashlib.sha256(json.dumps([
        workspace.id, "render", workspace.revision, [], None,
        {
            "render_layout_version": snapshot["render_layout_version"],
            "product_catalog_version": snapshot["product_catalog_version"],
        },
    ], separators=(",", ":")).encode()).hexdigest()
    service.repository.update_tool_task(task.id, input_snapshot=snapshot)
    service._complete(task.id, result={"output_asset_id": "legacy-output"})
    fresh = service.submit(workspace.id, "render", request)
    assert fresh.id != task.id
    assert fresh.input_snapshot["video_category"] == "unboxing"
    assert fresh.input_snapshot["render_layout_version"] == snapshot["render_layout_version"]
    assert service.submit(workspace.id, "render", request).id == fresh.id
    assert "video_category" not in service.repository.get_tool_task(task.id).input_snapshot


@pytest.mark.parametrize("change_revision", [False, True])
def test_retry_rejects_changed_render_category(subtitle_service, change_revision):
    service = subtitle_service
    workspace, _ = extracted(service)
    task = service.submit(
        workspace.id, "render", SubtitleStageRequest(expected_revision=workspace.revision),
    )
    service._complete(task.id, error="poll interrupted")
    if change_revision:
        service.patch(workspace.id, SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, video_category="product",
        ))
    else:
        def category_only(current, tasks):
            current.video_category = "product"
            return current, None

        service.repository.mutate_subtitle_workspace(workspace.id, category_only)
    with pytest.raises(RevisionConflictError, match="snapshot is stale"):
        service.retry(task.id)
    assert service.repository.get_tool_task(task.id).input_snapshot["video_category"] == "unboxing"


def test_workspace_revision_persistence_history_and_conflict(subtitle_service):
    service = subtitle_service
    workspace = service.create(
        SubtitleWorkspaceCreate(reference_video_asset_id="reference")
    )
    updated = service.patch(
        workspace.id, SubtitleWorkspaceUpdate(expected_revision=1, name="Saved")
    )
    assert updated.revision == 2
    assert service.repository.get_subtitle_workspace(workspace.id).name == "Saved"
    with pytest.raises(RevisionConflictError):
        service.patch(
            workspace.id,
            SubtitleWorkspaceUpdate(expected_revision=1, name="Lost update"),
        )
    assert len(service.repository.list_subtitle_workspace_history(workspace.id)) == 2


def test_stage_creation_is_atomic_and_duplicate_is_idempotent(subtitle_service):
    service = subtitle_service
    workspace = service.create(
        SubtitleWorkspaceCreate(reference_video_asset_id="reference")
    )
    request = SubtitleStageRequest(expected_revision=1)
    task = service.submit(workspace.id, "extract", request)
    duplicate = service.submit(workspace.id, "extract", request)
    assert task.id == duplicate.id
    assert task.type.value == "video_subtitle_translation"
    assert [i.asset_id for i in task.input_assets] == ["reference"]
    assert (
        service.repository.get_subtitle_workspace(workspace.id).active_task_id
        == task.id
    )
    service._complete(task.id, result={"segments": [segment().model_dump(mode="json")]})
    assert service.submit(workspace.id, "extract", request).id == task.id
    assert len(service.repository.list_tool_tasks()) == 1


@pytest.mark.parametrize("historical_status", ["failed", "succeeded"])
def test_render_does_not_reuse_legacy_layout_task(subtitle_service, historical_status):
    service = subtitle_service
    workspace, _ = extracted(service)
    request = SubtitleStageRequest(expected_revision=workspace.revision)
    legacy = service.submit(workspace.id, "render", request)
    snapshot = {
        k: v for k, v in legacy.input_snapshot.items() if k != "render_layout_version"
    }
    snapshot["idempotency_key"] = hashlib.sha256(
        json.dumps(
            [workspace.id, "render", workspace.revision, [], None],
            separators=(",", ":"),
        ).encode()
    ).hexdigest()
    service.repository.update_tool_task(legacy.id, input_snapshot=snapshot)
    if historical_status == "failed":
        service._complete(
            legacy.id,
            error="historical provider failure",
            failure_reason="provider_failed",
        )
    else:
        service._complete(legacy.id, result={"output_asset_id": "old-output"})
    fresh = service.submit(workspace.id, "render", request)
    assert fresh.id != legacy.id
    assert fresh.status == Status.QUEUED
    assert fresh.input_snapshot["render_layout_version"]
    assert service.submit(workspace.id, "render", request).id == fresh.id
    assert service.repository.get_tool_task(legacy.id).status.value == historical_status


def test_render_layout_version_changes_identity_without_changing_draft(
    subtitle_service, monkeypatch
):
    from backend.app.services import subtitle_translation_layout as layout

    service = subtitle_service
    workspace, extraction = extracted(service)
    current_version = layout.LAYOUT_VERSION
    assert current_version == "single-line-png-text-default-background-v8"
    monkeypatch.setattr(layout, "LAYOUT_VERSION", "single-line-adaptive-panel35-v1")
    request = SubtitleStageRequest(expected_revision=workspace.revision)
    first = service.submit(workspace.id, "render", request)
    old_asset = service.repository.create_subtitle_output_asset(
        AssetCreate(
            id="old-output",
            type=AssetType.STORYBOARD_VIDEO,
            tool_asset_role=ToolAssetRole.OUTPUT,
            tool_task_id=first.id,
            status=Status.SUCCEEDED,
            mime_type="video/mp4",
            object_key="old-output.mp4",
            size_bytes=12,
        )
    )
    service._complete(first.id, result={"output_asset_id": "old-output"})
    old_task = service.repository.get_tool_task(first.id).model_dump(mode="json")
    history = service.repository.list_subtitle_workspace_history(workspace.id)
    monkeypatch.setattr(layout, "LAYOUT_VERSION", current_version)
    fresh = service.submit(workspace.id, "render", request)
    assert fresh.id != first.id
    assert (
        fresh.input_snapshot["idempotency_key"]
        != first.input_snapshot["idempotency_key"]
    )
    assert fresh.input_snapshot["revision"] == first.input_snapshot["revision"]
    assert fresh.input_snapshot["segments"] == first.input_snapshot["segments"]
    assert fresh.input_snapshot["render_layout_version"] == current_version
    assert service.submit(workspace.id, "render", request).id == fresh.id
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.revision == workspace.revision
    assert current.segments == workspace.segments
    assert current.output_asset_id is None
    assert current.stage_task_ids["extract"] == extraction.id
    assert service.repository.get_tool_task(first.id).model_dump(mode="json") == old_task
    assert service.repository.get_asset(old_asset.id) == old_asset
    retained_history = service.repository.list_subtitle_workspace_history(workspace.id)
    assert retained_history[:len(history)] == history
    assert history[-1]["output_asset_id"] == old_asset.id
    service._complete(fresh.id, result={"output_asset_id": "new-output"})
    assert service.submit(workspace.id, "render", request).id == fresh.id
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.output_asset_id == "new-output"
    assert current.revision == workspace.revision
    assert current.segments == workspace.segments
    assert service.repository.get_tool_task(first.id).model_dump(mode="json") == old_task
    assert service.repository.get_asset(old_asset.id) == old_asset
    tasks = service.repository.list_tool_tasks()
    assert len(tasks) == 3
    assert sorted(t.input_snapshot["operation"] for t in tasks) == [
        "extract",
        "render",
        "render",
    ]


def test_role_font_render_payload_and_measured_writeback(subtitle_service, monkeypatch):
    from backend.app.services import subtitle_translation_layout as layout
    from backend.app.services.mediakit_multitrack import MediaKitMultiTrackClient

    service = subtitle_service
    workspace, extraction = extracted(service)
    roles = ["headline", "body", "footnote"]
    items = []
    for index, role in enumerate(roles):
        item = SubtitleTranslationSegment.model_validate(
            {
                **segment(f"s{index}").model_dump(mode="json"),
                "visual_role": role,
                "line_index": index,
                "bbox_normalized": (100, 100 + index * 150, 300, 180 + index * 150),
                "background_color": "#FFFFFF",
                "translated_text": None,
                "translation_status": "pending",
                "font_type": layout.CENTURY_GOTHIC_BOLD_URL,
                "effective_font_size_px": 999,
            }
        )
        items.append(item)

    def seed(current, tasks):
        current.segments = items
        return current, None

    service.repository.mutate_subtitle_workspace(workspace.id, seed)
    translation = service.submit(
        workspace.id,
        "translate",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    service._complete(
        translation.id,
        result={
            "translations": {
                item.segment_id: "Long translated subtitle" for item in items
            },
            "failed_ids": [],
        },
    )
    draft = service.repository.get_subtitle_workspace(workspace.id)
    task = service.submit(
        workspace.id, "render", SubtitleStageRequest(expected_revision=draft.revision)
    )
    font_path = Path(__file__).parent / "fixtures/subtitle_fonts/ABeeZee-Regular.ttf"
    content = font_path.read_bytes()
    font_requests = []
    original_client = httpx.Client
    loader = layout._load_font_resource
    loader.cache_clear()

    def respond(request):
        font_requests.append(str(request.url))
        return httpx.Response(200, content=content)

    monkeypatch.setattr(
        layout.httpx,
        "Client",
        lambda **kwargs: original_client(
            **kwargs, transport=httpx.MockTransport(respond)
        ),
    )
    client = SimpleNamespace(
        submit=AsyncMock(return_value=SimpleNamespace(task_id="role-provider")),
        poll=AsyncMock(
            return_value=SimpleNamespace(
                output_video_url="https://output.example/roles.mp4"
            )
        ),
    )
    service.mediakit_factory = lambda: client
    service.media = SimpleNamespace(
        store_output=AsyncMock(return_value=SimpleNamespace(id="role-output"))
    )
    extract = AsyncMock(side_effect=AssertionError("render must not rerun extraction"))
    translate = AsyncMock(side_effect=AssertionError("render must not rerun translation"))
    service.grounding = SimpleNamespace(extract=extract)
    service.translator = SimpleNamespace(translate=translate)
    try:
        asyncio.run(service.run(task.id))
        asyncio.run(service.run(task.id))
    finally:
        loader.cache_clear()

    saved = service.repository.get_subtitle_workspace(workspace.id)
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED
    assert saved.output_asset_id == "role-output"
    assert saved.revision == draft.revision
    assert saved.stage_task_ids == {
        "extract": extraction.id,
        "translate": translation.id,
        "render": task.id,
    }
    assert client.submit.await_count == client.poll.await_count == 1
    assert service.media.store_output.await_count == 1
    extract.assert_not_awaited()
    translate.assert_not_awaited()
    assert set(font_requests) == {
        layout.CENTURY_GOTHIC_BOLD_URL,
        layout.CENTURY_GOTHIC_URL,
    }
    submitted = client.submit.call_args.kwargs
    payload = MediaKitMultiTrackClient._normalize_submit_payload(**submitted)
    # Simultaneous lines share timing, so use the persisted track index per segment.
    for before, after in zip(draft.segments, saved.segments):
        summary = finished.input_snapshot["layouts"][after.segment_id]
        element = payload["track"][summary["track_index"]][0]
        expected_font = (
            layout.CENTURY_GOTHIC_BOLD_URL
            if before.visual_role == "headline"
            else layout.CENTURY_GOTHIC_URL
        )
        assert element["type"] == "image" and "bold" not in element
        assert after.font_type == expected_font
        assert "".join(run["text"] for run in summary["text_runs"]) == before.translated_text
        assert {run["font_type"] for run in summary["text_runs"]} == {expected_font}
        assert element["target_time"] == [before.start_ms, before.end_ms]
        assert {run["font_size_px"] for run in summary["text_runs"]} == {after.effective_font_size_px}
        assert after.effective_font_size_px == summary["effective_font_size_px"] != 999
        assert after.estimated_font_size_px == summary["estimated_font_size_px"]
        assert 0 < after.effective_font_size_px <= after.estimated_font_size_px
        assert after.font_sha256 == hashlib.sha256(content).hexdigest()
        assert after.render_bbox_pixels == tuple(summary["render_bbox_pixels"])
        assert (
            summary["measured_text_width_px"]
            <= after.render_bbox_pixels[2] - after.render_bbox_pixels[0]
        )
        assert after.warnings == summary["warnings"]
        for key in (
            "text",
            "translated_text",
            "start_ms",
            "end_ms",
            "bbox_normalized",
            "bbox_pixels",
            "visual_role",
            "block_id",
            "line_index",
            "style",
        ):
            assert getattr(after, key) == getattr(before, key)
    assert service.repository.get_tool_task(extraction.id).status == Status.SUCCEEDED
    assert service.repository.get_tool_task(translation.id).status == Status.SUCCEEDED


def test_precision_invalidation_and_stale_result_preserves_history(subtitle_service):
    service = subtitle_service
    workspace, extraction = extracted(service)
    task = service.submit(
        workspace.id,
        "render",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    segments = [s.model_copy(deep=True) for s in workspace.segments]
    segments[0].translated_text = "Edited"
    saved = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, segments=segments
        ),
    )
    service._complete(task.id, result={"output_asset_id": "historical-output"})
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.revision == saved.revision
    assert current.output_asset_id is None
    assert current.segments[0].translated_text == "Edited"
    assert current.stage_task_ids == {"extract": extraction.id}
    assert (
        service.repository.get_tool_task(task.id).input_snapshot["result"][
            "output_asset_id"
        ]
        == "historical-output"
    )
    changed = service.patch(
        current.id,
        SubtitleWorkspaceUpdate(
            expected_revision=current.revision, target_language="fr"
        ),
    )
    assert changed.segments[0].translated_text is None
    assert changed.stage_task_ids == {"extract": extraction.id}
    changed = service.patch(
        current.id,
        SubtitleWorkspaceUpdate(
            expected_revision=changed.revision, reference_video_asset_id="reference2"
        ),
    )
    assert changed.segments == []
    assert changed.stage_task_ids == {}


def test_clean_video_changes_only_render_and_original_text_is_immutable(
    subtitle_service,
):
    service = subtitle_service
    workspace, _ = extracted(service)
    updated = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, clean_video_asset_id=None
        ),
    )
    assert updated.segments[0].translated_text == "Ursprung"
    changed = updated.segments[0].model_copy(update={"text": "Corrupted"})
    with pytest.raises(ValueError, match="original"):
        service.patch(
            workspace.id,
            SubtitleWorkspaceUpdate(
                expected_revision=updated.revision, segments=[changed]
            ),
        )


def test_failure_retry_is_new_task_and_duplicate_retry_is_stable(subtitle_service):
    service = subtitle_service
    workspace, extraction = extracted(service)
    task = service.submit(
        workspace.id,
        "render",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    service._complete(task.id, error="failed render")
    retry = service.retry(task.id)
    assert retry.id != task.id
    assert retry.retry_of_task_id == task.id
    assert retry.input_snapshot["segments"] == task.input_snapshot["segments"]
    assert service.retry(task.id).id == retry.id
    assert (
        service.repository.get_subtitle_workspace(workspace.id).stage_task_ids[
            "extract"
        ]
        == extraction.id
    )


def test_restart_fails_model_stages_and_resumes_submitted_render(subtitle_service):
    service = subtitle_service
    workspace = service.create(
        SubtitleWorkspaceCreate(reference_video_asset_id="reference")
    )
    task = service.submit(
        workspace.id, "extract", SubtitleStageRequest(expected_revision=1)
    )
    service.repository.update_tool_task(task.id, status=Status.RUNNING)
    service.recover()
    assert service.repository.get_tool_task(task.id).status == Status.FAILED
    assert (
        service.repository.get_subtitle_workspace(workspace.id).stage.value == "failed"
    )
    workspace, _ = extracted(service)
    task = service.submit(
        workspace.id,
        "render",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    service.repository.update_tool_task(
        task.id, provider_task_id="provider1", status=Status.RUNNING
    )
    scheduled = []
    service.schedule = scheduled.append
    service.recover()
    assert scheduled == [task.id]
    assert service.repository.get_tool_task(task.id).status == Status.RUNNING


def test_failed_transaction_rolls_back_workspace_and_task(
    subtitle_service, monkeypatch
):
    service = subtitle_service
    workspace = service.create(
        SubtitleWorkspaceCreate(reference_video_asset_id="reference")
    )
    original = service.repository.mutate_subtitle_workspace

    def failing(workspace_id, callback):
        def mutate(current, tasks):
            callback(current, tasks)
            raise RuntimeError("forced transaction rollback")

        return original(workspace_id, mutate)

    monkeypatch.setattr(service.repository, "mutate_subtitle_workspace", failing)
    with pytest.raises(RuntimeError):
        service.submit(
            workspace.id, "extract", SubtitleStageRequest(expected_revision=1)
        )
    assert (
        service.repository.get_subtitle_workspace(workspace.id).active_task_id is None
    )
    assert service.repository.list_tool_tasks() == []


def test_clean_video_edit_rebases_unaffected_extraction_writeback(subtitle_service):
    service = subtitle_service
    workspace = service.create(
        SubtitleWorkspaceCreate(reference_video_asset_id="reference")
    )
    task = service.submit(
        workspace.id, "extract", SubtitleStageRequest(expected_revision=1)
    )
    saved = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(expected_revision=1, clean_video_asset_id="clean"),
    )
    assert saved.active_task_id == task.id
    assert saved.stage.value == "extracting"
    service._complete(task.id, result={"segments": [segment().model_dump(mode="json")]})
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.clean_video_asset_id == "clean"
    assert current.segments[0].segment_id == "s1"
    assert current.revision == saved.revision + 1
    assert service.repository.get_tool_task(task.id).input_snapshot["revision"] == 1


def test_inflight_translation_preserves_manual_text_and_updated_style(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    workspace.segments[0].translated_text = None
    workspace.segments[0].translation_status = "pending"

    def seed(current, tasks):
        current.segments = workspace.segments
        return current, None

    service.repository.mutate_subtitle_workspace(workspace.id, seed)
    task = service.submit(
        workspace.id,
        "translate",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    workspace.segments[0].translated_text = "Manual correction"
    workspace.segments[0].style.font_size_px = 24
    saved = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, segments=workspace.segments
        ),
    )
    assert saved.active_task_id == task.id
    service._complete(
        task.id, result={"translations": {"s1": "Late model"}, "failed_ids": []}
    )
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.segments[0].translated_text == "Manual correction"
    assert current.segments[0].style.font_size_px == 24
    assert current.revision == saved.revision + 1
