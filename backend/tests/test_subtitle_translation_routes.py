from types import SimpleNamespace
from unittest.mock import AsyncMock

from backend.app.api.dependencies import get_subtitle_translation_service
from backend.app.schemas.auth import UserRole
from backend.app.schemas.enums import Status
from backend.app.services.subtitle_translation_media import MAX_BYTES
from backend.tests.auth_helpers import authenticate_test_client
from backend.tests.test_subtitle_translation_workspace import (
    extracted,
    subtitle_repo,
    subtitle_service,
)

__all__ = ["subtitle_repo", "subtitle_service"]
BASE = "/api/tools/subtitle-translation"


def test_creator_crud_task_query_and_retry_dispatch(
    anonymous_client, repository, subtitle_service
):
    client = anonymous_client
    authenticate_test_client(client, repository, role=UserRole.CREATOR)
    service = subtitle_service
    service.media = SimpleNamespace(ensure_metadata=AsyncMock())
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    created = client.post(
        BASE + "/workspaces",
        json={"reference_video_asset_id": "reference", "clean_video_asset_id": "clean"},
    )
    assert created.status_code == 201
    workspace = created.json()
    assert client.get(BASE + "/workspaces").json()[0]["id"] == workspace["id"]
    assert client.get(BASE + "/workspaces/missing").status_code == 404
    task = client.post(
        BASE + f"/workspaces/{workspace['id']}/extract", json={"expected_revision": 1}
    )
    assert task.status_code == 201
    task_id = task.json()["id"]
    # Query/retry use the same repository as this stage service.
    from backend.app.api.dependencies import get_repository

    client.app.dependency_overrides[get_repository] = lambda: service.repository
    if service.repository is not repository:
        authenticate_test_client(client, service.repository, role=UserRole.CREATOR)
    assert (
        client.get("/api/tools/tasks/" + task_id).json()["type"]
        == "video_subtitle_translation"
    )
    assert (
        client.get("/api/tools/tasks?type=video_subtitle_translation").json()[0]["id"]
        == task_id
    )
    service._complete(task_id, error="interrupted")
    retry = client.post("/api/tools/tasks/" + task_id + "/retry")
    assert retry.status_code == 200
    assert retry.json()["retry_of_task_id"] == task_id
    assert (
        client.post("/api/tools/tasks/" + task_id + "/retry").json()["id"]
        == retry.json()["id"]
    )


def test_reference_visibility_rejected_before_any_task(client, subtitle_service):
    service = subtitle_service
    service.media = SimpleNamespace(
        ensure_metadata=AsyncMock(side_effect=ValueError("not accessible"))
    )
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    response = client.post(
        BASE + "/workspaces", json={"reference_video_asset_id": "reference"}
    )
    assert response.status_code == 422
    assert service.repository.list_subtitle_workspaces() == []
    assert service.repository.list_tool_tasks() == []


def test_upload_http_length_and_streaming_contract(client, subtitle_service):
    service = subtitle_service
    asset = service.repository.get_asset("reference")
    service.media = SimpleNamespace(upload_video=AsyncMock(return_value=asset))
    client.app.dependency_overrides[get_subtitle_translation_service] = lambda: service
    too_large = client.post(
        BASE + "/upload-video",
        content=b"x",
        headers={"content-length": str(MAX_BYTES + 1)},
    )
    assert too_large.status_code == 413
    assert service.media.upload_video.await_count == 0
    response = client.post(
        BASE + "/upload-video?role=clean&filename=video.mp4",
        content=b"raw-video",
        headers={"content-type": "application/octet-stream"},
    )
    assert response.status_code == 201
    call = service.media.upload_video.call_args
    assert call.kwargs["role"] == "clean"
    assert hasattr(call.args[0], "__aiter__")


def test_generic_tool_creation_cannot_fabricate_managed_snapshot(client, repository):
    response = client.post(
        "/api/tools/tasks",
        json={
            "type": "video_subtitle_translation",
            "input_snapshot": {"operation": "render", "workspace_id": "forged"},
        },
    )
    assert response.status_code == 422
    assert repository.list_tool_tasks() == []


def test_measured_fields_do_not_invalidate_render_or_enter_revision(subtitle_service):
    from backend.app.schemas.subtitle_translation import (
        SubtitleStageRequest,
        SubtitleWorkspaceUpdate,
    )

    service = subtitle_service
    workspace, _ = extracted(service)
    task = service.submit(
        workspace.id,
        "render",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    measured = workspace.segments[0].model_copy(
        update={
            "estimated_font_size_px": 40,
            "effective_font_size_px": 22,
            "warnings": ["derived-warning"],
        }
    )
    saved = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(
            expected_revision=workspace.revision, segments=[measured]
        ),
    )
    assert saved.active_task_id == task.id
    assert saved.stage.value == "rendering"
    assert saved.segments[0].effective_font_size_px is None
    assert "derived-warning" not in saved.segments[0].warnings


def test_application_startup_recovers_interrupted_stage(repository, test_asset_storage):
    from fastapi.testclient import TestClient

    from backend.app.api.dependencies import (
        get_aigc_pipeline_runtime,
        get_asset_storage_service,
        get_repository,
    )
    from backend.app.main import create_app
    from backend.app.schemas.enums import ToolTaskType
    from backend.app.schemas.subtitle_translation import SubtitleWorkspace
    from backend.app.schemas.tool_task import ToolTaskCreate

    workspace = repository.create_subtitle_workspace(SubtitleWorkspace())

    def queued(current, tasks):
        current.active_task_id = "startup-task"
        return current, ToolTaskCreate(
            id="startup-task",
            type=ToolTaskType.VIDEO_SUBTITLE_TRANSLATION,
            input_snapshot={
                "workspace_id": workspace.id,
                "operation": "translate",
                "revision": 1,
            },
        )

    repository.mutate_subtitle_workspace(workspace.id, queued)
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: test_asset_storage
    app.dependency_overrides[get_aigc_pipeline_runtime] = lambda: SimpleNamespace(
        start=AsyncMock(),
        stop=AsyncMock(),
    )
    with TestClient(app):
        assert repository.get_tool_task("startup-task").status == Status.FAILED
