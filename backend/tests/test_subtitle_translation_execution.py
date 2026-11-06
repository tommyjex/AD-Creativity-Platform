import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.app.schemas import Status
from backend.app.schemas.subtitle_translation import (
    SubtitleStageRequest,
    SubtitleWorkspaceUpdate,
    SubtitleWorkspaceCreate,
)
from backend.tests.test_subtitle_translation_workspace import (
    extracted,
    segment,
    subtitle_repo,
    subtitle_service,
)

__all__ = ["subtitle_repo", "subtitle_service"]


def render_task(service):
    workspace, _ = extracted(service)
    task = service.submit(
        workspace.id,
        "render",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    service.compiler = lambda segments, video: {
        "project": {"canvas": {"width": video["width"]}},
        "layouts": {"s1": {"effective_font_size_px": 22}},
        "warnings": ["fps_fallback"],
    }
    client = SimpleNamespace(
        submit=AsyncMock(return_value=SimpleNamespace(task_id="provider-id")),
        poll=AsyncMock(
            return_value=SimpleNamespace(
                output_video_url="https://output.example/video.mp4"
            )
        ),
    )
    service.mediakit_factory = lambda: client
    service.media = SimpleNamespace(
        store_output=AsyncMock(return_value=SimpleNamespace(id="stored-output"))
    )
    return workspace, task, client


def test_render_runs_only_once_and_persists_task_and_layout(subtitle_service):
    service = subtitle_service
    workspace, task, client = render_task(service)
    asyncio.run(service.run(task.id))
    asyncio.run(service.run(task.id))
    saved = service.repository.get_subtitle_workspace(workspace.id)
    assert saved.output_asset_id == "stored-output"
    assert saved.stage.value == "succeeded"
    assert saved.segments[0].effective_font_size_px == 22
    assert "fps_fallback" in saved.warnings
    finished = service.repository.get_tool_task(task.id)
    assert finished.status == Status.SUCCEEDED
    assert finished.provider_task_id == "provider-id"
    assert client.submit.await_count == client.poll.await_count == 1
    assert (
        client.submit.call_args.kwargs["idempotency_key"]
        == task.input_snapshot["idempotency_key"]
    )
    assert service._running == set()


@pytest.mark.parametrize("failure", ["poll", "transfer"])
def test_render_retry_resumes_provider_without_recompiling(subtitle_service, failure):
    service = subtitle_service
    workspace, task, client = render_task(service)
    component = client.poll if failure == "poll" else service.media.store_output
    component.side_effect = RuntimeError("signed secret output")
    asyncio.run(service.run(task.id))
    failed = service.repository.get_tool_task(task.id)
    assert failed.status == Status.FAILED
    assert "secret" not in failed.error.message
    retry = service.retry(task.id)
    component.side_effect = None
    service.compiler = lambda *args: pytest.fail("retry must not recompile")
    asyncio.run(service.run(retry.id))
    assert client.submit.await_count == 1
    assert client.poll.call_args.kwargs["task_id"] == "provider-id"
    saved = service.repository.get_subtitle_workspace(workspace.id)
    assert saved.output_asset_id == "stored-output"
    assert saved.stage_task_ids["extract"] == workspace.stage_task_ids["extract"]


def test_provider_failure_retry_creates_new_provider_task(subtitle_service):
    service = subtitle_service
    _, task, client = render_task(service)

    class ProviderFailure(RuntimeError):
        code = "provider_failed"

    client.poll.side_effect = ProviderFailure("private response")
    asyncio.run(service.run(task.id))
    retry = service.retry(task.id)
    assert retry.provider_task_id is None
    client.poll.side_effect = None
    asyncio.run(service.run(retry.id))
    assert client.submit.await_count == 2
    assert (
        client.submit.call_args.kwargs["idempotency_key"]
        != task.input_snapshot["idempotency_key"]
    )


def test_running_render_restart_only_polls_existing_task(subtitle_service):
    service = subtitle_service
    workspace, task, client = render_task(service)
    service.repository.update_tool_task(
        task.id,
        status=Status.RUNNING,
        provider_task_id="previous-provider",
        input_snapshot={
            **task.input_snapshot,
            "layouts": {"s1": {"effective_font_size_px": 33}},
        },
    )
    service.compiler = lambda *args: pytest.fail("restart must not recompile")
    asyncio.run(service.run(task.id))
    assert client.submit.await_count == 0
    assert client.poll.call_args.kwargs["task_id"] == "previous-provider"
    assert (
        service.repository.get_subtitle_workspace(workspace.id)
        .segments[0]
        .effective_font_size_px
        == 33
    )


def test_render_late_completion_is_history_only(subtitle_service):
    service = subtitle_service
    workspace, task, client = render_task(service)

    async def poll(**kwargs):
        service.patch(
            workspace.id,
            SubtitleWorkspaceUpdate(
                expected_revision=workspace.revision, target_language="fr"
            ),
        )
        return SimpleNamespace(output_video_url="https://output.example/video.mp4")

    client.poll.side_effect = poll
    asyncio.run(service.run(task.id))
    current = service.repository.get_subtitle_workspace(workspace.id)
    assert current.output_asset_id is None
    assert current.target_language == "fr"
    assert current.segments[0].translated_text is None
    completed = service.repository.get_tool_task(task.id)
    assert completed.status == Status.SUCCEEDED
    assert completed.input_snapshot["result"]["output_asset_id"] == "stored-output"


def test_link_transaction_failure_preserves_durable_output_for_retry(
    subtitle_service, monkeypatch
):
    service = subtitle_service
    _, task, _ = render_task(service)
    complete = service._complete

    def fail_success(task_id, **kwargs):
        if kwargs.get("result"):
            raise RuntimeError("database unavailable during link")
        return complete(task_id, **kwargs)

    monkeypatch.setattr(service, "_complete", fail_success)
    asyncio.run(service.run(task.id))
    assert service.repository.get_tool_task(task.id).status == Status.FAILED
    assert service.media.store_output.await_count == 1
    assert not hasattr(service.media, "delete_asset")


def test_partial_translation_retry_and_manual_completion(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    items = [segment("s1"), segment("s2")]
    for item in items:
        item.translated_text = None
        item.translation_status = "pending"

    def seed(current, tasks):
        current.segments = items
        return current, None

    service.repository.mutate_subtitle_workspace(workspace.id, seed)
    service.translator = SimpleNamespace(
        translate=AsyncMock(
            return_value={
                "translations": {"s1": "First"},
                "failed_ids": ["s2"],
                "usage": {},
            }
        )
    )
    task = service.submit(
        workspace.id,
        "translate",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    asyncio.run(service.run(task.id))
    saved = service.repository.get_subtitle_workspace(workspace.id)
    assert saved.segments[0].translated_text == "First"
    assert saved.segments[1].translation_status == "failed"
    assert service.repository.get_tool_task(task.id).status == Status.FAILED
    retry = service.retry(task.id)
    assert retry.input_snapshot["segment_ids"] == ["s2"]
    service.translator.translate.return_value = {
        "translations": {},
        "failed_ids": ["s2"],
        "usage": {},
    }
    asyncio.run(service.run(retry.id))
    saved = service.repository.get_subtitle_workspace(workspace.id)
    saved.segments[1].translated_text = "Manual"
    edited = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(
            expected_revision=saved.revision, segments=saved.segments
        ),
    )
    assert [s.translated_text for s in edited.segments] == ["First", "Manual"]
    assert all(s.translation_status == "succeeded" for s in edited.segments)
    switched = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(
            expected_revision=edited.revision, target_language="fr"
        ),
    )
    assert all(s.translated_text is None for s in switched.segments)


def test_layout_error_remains_actionable_without_provider_request(subtitle_service):
    from backend.app.services.subtitle_translation_layout import SubtitleLayoutError

    service = subtitle_service
    _, task, client = render_task(service)

    def capacity_error(*args):
        raise SubtitleLayoutError("text_capacity_exceeded")

    service.compiler = capacity_error
    asyncio.run(service.run(task.id))
    failed = service.repository.get_tool_task(task.id)
    assert "4000 characters" in failed.error.message
    assert "text_capacity_exceeded" in failed.input_snapshot["failure_reason"]
    assert (
        "not a provider capacity guarantee" in failed.input_snapshot["failure_reason"]
    )
    assert client.submit.await_count == 0


def tracked_extraction(service, tmp_path, *, response_failure=None):
    """Use the real service/provider boundary with offline Files/Responses."""
    from backend.app.services.video_subtitle_grounding import (
        VideoSubtitleGroundingService,
    )
    from backend.app.services.video_subtitle_grounding_media import PreparedRemoteVideo
    from backend.tests.test_video_subtitle_grounding_service import _metadata
    from backend.tests.test_modelark_video_subtitle_grounding import (
        FakeFilesClient, FakeRawResponse, _adapter, _payload,
    )

    workspace = service.create(
        SubtitleWorkspaceCreate(reference_video_asset_id="reference")
    )
    task = service.submit(
        workspace.id, "extract", SubtitleStageRequest(expected_revision=1)
    )
    path = tmp_path / "input.mp4"
    path.write_bytes(b"video")
    files = FakeFilesClient(
        create_result=SimpleNamespace(id="file-original", status="processing"),
        retrieve_results=[SimpleNamespace(id="file-original", status="active")],
    )
    adapter, responses = _adapter(
        files=files,
        response=response_failure
        if response_failure is not None
        else FakeRawResponse(_payload()),
    )

    retrieve = files.retrieve

    def assert_saved_before_processing(file_id, **kwargs):
        current_id = service.repository.get_subtitle_workspace(workspace.id).active_task_id
        saved = service.repository.get_tool_task(current_id)
        assert saved.input_snapshot["provider_file_id"] == file_id
        assert datetime.fromisoformat(
            saved.input_snapshot["provider_file_uploaded_at"]
        ).tzinfo is not None
        assert saved.status == Status.RUNNING
        return retrieve(file_id, **kwargs)

    files.retrieve = assert_saved_before_processing
    service.grounding = VideoSubtitleGroundingService(
        settings=adapter.settings, provider=adapter
    )

    @asynccontextmanager
    async def open_asset(*args, **kwargs):
        yield PreparedRemoteVideo(
            path=path, mime_type="video/mp4", size_bytes=5, metadata=_metadata()
        )

    service.media = SimpleNamespace(open_asset=open_asset)
    return workspace, task, files, responses


@pytest.mark.parametrize("failure", ["none", "responses", "cancel"])
def test_extraction_upload_association_survives_completion(
    subtitle_service, tmp_path, failure, caplog,
):
    error = (
        asyncio.CancelledError() if failure == "cancel"
        else RuntimeError("private provider payload") if failure == "responses"
        else None
    )
    service = subtitle_service
    workspace, task, files, _ = tracked_extraction(
        service, tmp_path, response_failure=error
    )
    caplog.set_level("INFO")
    if failure == "cancel":
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(service.run(task.id))
    else:
        asyncio.run(service.run(task.id))
    saved = service.repository.get_tool_task(task.id)
    assert saved.input_snapshot["provider_file_id"] == "file-original"
    assert saved.status == (Status.SUCCEEDED if failure == "none" else Status.FAILED)
    assert files.delete_calls[0][0] == "file-original"
    events = [
        r.structured_context for r in caplog.records
        if getattr(r, "structured_event", None) == "subtitle_translation.file_uploaded"
    ]
    assert events == [{
        "workspace_id": workspace.id, "task_id": task.id,
        "operation": "extract", "provider_file_id": "file-original",
    }]
    assert "private provider payload" not in caplog.text


def test_extraction_retry_tracks_new_file_without_overwriting_original(
    subtitle_service, tmp_path,
):
    service = subtitle_service
    _, task, files, responses = tracked_extraction(
        service, tmp_path, response_failure=RuntimeError("model failed")
    )
    asyncio.run(service.run(task.id))
    retry = service.retry(task.id)
    assert "provider_file_id" not in retry.input_snapshot
    from backend.tests.test_modelark_video_subtitle_grounding import FakeRawResponse, _payload
    responses.result = FakeRawResponse(_payload())
    files.create_result = SimpleNamespace(id="file-retry", status="processing")
    files.retrieve_results = [SimpleNamespace(id="file-retry", status="active")]
    asyncio.run(service.run(retry.id))
    assert service.repository.get_tool_task(task.id).input_snapshot["provider_file_id"] == "file-original"
    assert service.repository.get_tool_task(retry.id).input_snapshot["provider_file_id"] == "file-retry"
    assert service.repository.get_tool_task(retry.id).status == Status.SUCCEEDED


def test_upload_tracking_preserves_inflight_draft_revision_and_latest_snapshot(
    subtitle_service, tmp_path, monkeypatch,
):
    service = subtitle_service
    workspace, task, _, _ = tracked_extraction(service, tmp_path)
    record = service._record_uploaded_file
    revised = []

    def edit_then_record(task_id, file_id):
        revised.append(service.patch(
            workspace.id,
            SubtitleWorkspaceUpdate(expected_revision=1, clean_video_asset_id="clean"),
        ))
        record(task_id, file_id)
        saved = service.repository.get_subtitle_workspace(workspace.id)
        assert saved.revision == revised[0].revision
        assert saved.clean_video_asset_id == "clean"
        assert saved.active_task_id == task.id

    monkeypatch.setattr(service, "_record_uploaded_file", edit_then_record)
    asyncio.run(service.run(task.id))
    saved = service.repository.get_tool_task(task.id)
    assert saved.input_snapshot["writeback_revision"] == revised[0].revision
    assert saved.input_snapshot["provider_file_id"] == "file-original"
    assert saved.status == Status.SUCCEEDED


def test_upload_persistence_failure_prevents_inference_and_cleans_file(
    subtitle_service, tmp_path, monkeypatch,
):
    service = subtitle_service
    _, task, files, responses = tracked_extraction(service, tmp_path)
    mutate = service.repository.mutate_subtitle_workspace

    def fail_upload_save(workspace_id, callback):
        def fail_if_upload(workspace, tasks):
            result = callback(workspace, tasks)
            changed = result[1]
            if changed and "provider_file_id" in changed.input_snapshot:
                raise RuntimeError("database unavailable")
            return result
        return mutate(workspace_id, fail_if_upload)

    monkeypatch.setattr(service.repository, "mutate_subtitle_workspace", fail_upload_save)
    asyncio.run(service.run(task.id))
    saved = service.repository.get_tool_task(task.id)
    assert saved.status == Status.FAILED
    assert "provider_file_id" not in saved.input_snapshot
    assert files.retrieve_calls == responses.calls == []
    assert files.delete_calls[0][0] == "file-original"


def test_restart_retains_uploaded_file_for_interrupted_task(subtitle_service, tmp_path):
    service = subtitle_service
    workspace, task, _, _ = tracked_extraction(service, tmp_path)
    service.repository.update_tool_task(task.id, status=Status.RUNNING)
    service._record_uploaded_file(task.id, "file-before-restart")
    assert service.repository.get_subtitle_workspace(workspace.id).revision == 1
    service.recover()
    saved = service.repository.get_tool_task(task.id)
    assert saved.status == Status.FAILED
    assert saved.input_snapshot["provider_file_id"] == "file-before-restart"


def test_late_upload_record_updates_history_without_reviving_stale_task(
    subtitle_service, tmp_path,
):
    service = subtitle_service
    workspace, task, _, _ = tracked_extraction(service, tmp_path)
    revised = service.patch(
        workspace.id,
        SubtitleWorkspaceUpdate(
            expected_revision=1, reference_video_asset_id="reference2"
        ),
    )
    service._complete(task.id, error="stale extraction")
    service._record_uploaded_file(task.id, "file-late-upload")
    saved = service.repository.get_tool_task(task.id)
    assert saved.status == Status.FAILED
    assert saved.error.message == "stale extraction"
    assert saved.input_snapshot["provider_file_id"] == "file-late-upload"
    assert service.repository.get_subtitle_workspace(workspace.id) == revised
