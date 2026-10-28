import hashlib
import json

import pytest

from backend.app.repositories import RevisionConflictError
from backend.app.schemas import AssetCreate, AssetType, Status, ToolAssetRole
from backend.app.schemas.subtitle_translation import (
    SubtitleStageRequest,
    SubtitleTranslationSegment,
    SubtitleWorkspaceCreate,
    SubtitleWorkspaceUpdate,
)
from backend.app.services.subtitle_translation import SubtitleTranslationService


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
                    }
                },
            )
        )
    return SubtitleTranslationService(subtitle_repo, test_asset_storage)


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


def extracted(service):
    workspace = service.create(
        SubtitleWorkspaceCreate(
            reference_video_asset_id="reference",
            clean_video_asset_id="clean",
        )
    )
    task = service.submit(
        workspace.id, "extract", SubtitleStageRequest(expected_revision=1)
    )
    service._complete(task.id, result={"segments": [segment().model_dump(mode="json")]})
    return service.repository.get_subtitle_workspace(workspace.id), task


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
    workspace, _ = extracted(service)
    request = SubtitleStageRequest(expected_revision=workspace.revision)
    first = service.submit(workspace.id, "render", request)
    service._complete(first.id, result={"output_asset_id": "old-output"})
    monkeypatch.setattr(layout, "LAYOUT_VERSION", "next-layout-version")
    fresh = service.submit(workspace.id, "render", request)
    assert fresh.id != first.id
    assert fresh.input_snapshot["revision"] == first.input_snapshot["revision"]
    assert fresh.input_snapshot["segments"] == first.input_snapshot["segments"]
    assert fresh.input_snapshot["render_layout_version"] == "next-layout-version"
    assert service.submit(workspace.id, "render", request).id == fresh.id


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
