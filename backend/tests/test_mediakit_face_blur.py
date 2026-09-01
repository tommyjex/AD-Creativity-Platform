import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr

from backend.app.core.config import Settings
from backend.app.services.mediakit_face_blur import (
    FaceBlurTaskStatus,
    FaceBlurVideoClient,
    MediaKitFaceBlurError,
)


def _client(handler) -> FaceBlurVideoClient:
    return FaceBlurVideoClient(
        Settings(mediakit_api_key=SecretStr("test-mediakit-key")),
        transport=httpx.MockTransport(handler),
    )


def test_face_blur_client_submits_only_supported_request_fields() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/api/v1/tools/face-blur-video"
        assert request.headers["Authorization"] == "Bearer test-mediakit-key"
        assert json.loads(request.content) == {
            "video_url": "https://media.example/input.mp4?signature=private",
            "mask_mode": "blur",
            "mask_strength": "high",
        }
        return httpx.Response(
            200,
            headers={"x-request-id": "request-123"},
            json={"success": True, "task_id": "face-task-123"},
        )

    task = asyncio.run(
        _client(handler).submit(
            video_url="https://media.example/input.mp4?signature=private",
            mask_mode="blur",
            mask_strength="high",
        )
    )

    assert task.task_id == "face-task-123"
    assert task.status is FaceBlurTaskStatus.QUEUED
    assert task.request_id == "request-123"
    assert task.output_video_url is None


def test_face_blur_client_queries_and_normalizes_task_statuses() -> None:
    responses = iter(
        [
            {"success": True, "status": "pending"},
            {"success": True, "status": "processing"},
            {
                "success": True,
                "status": "completed",
                "request_id": "request-456",
                "result": {
                    "output_video_url": "https://media.example/output.mp4?signature=private",
                    "duration_seconds": "12.5",
                },
            },
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/api/v1/tasks/face-task-123"
        return httpx.Response(200, json=next(responses))

    client = _client(handler)
    queued = asyncio.run(client.get_task(task_id="face-task-123"))
    running = asyncio.run(client.get_task(task_id="face-task-123"))
    succeeded = asyncio.run(client.get_task(task_id="face-task-123"))

    assert queued.status is FaceBlurTaskStatus.QUEUED
    assert running.status is FaceBlurTaskStatus.RUNNING
    assert succeeded.status is FaceBlurTaskStatus.SUCCEEDED
    assert succeeded.output_video_url == (
        "https://media.example/output.mp4?signature=private"
    )
    assert succeeded.duration_seconds == 12.5
    assert succeeded.request_id == "request-456"


def test_face_blur_client_accepts_video_url_and_duration_aliases() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "success": True,
                "status": "succeeded",
                "result": {
                    "video_url": "https://media.example/output.mp4",
                    "duration": 8,
                },
            },
        )

    task = asyncio.run(_client(handler).get_task(task_id="face-task-123"))

    assert task.status is FaceBlurTaskStatus.SUCCEEDED
    assert task.output_video_url == "https://media.example/output.mp4"
    assert task.duration_seconds == 8.0


@pytest.mark.parametrize(
    ("kwargs", "detail"),
    [
        (
            {
                "video_url": "file:///private/input.mp4",
                "mask_mode": "blur",
                "mask_strength": "medium",
            },
            "phase=validate; reason=invalid_video_url",
        ),
        (
            {
                "video_url": "https://media.example/input.mp4",
                "mask_mode": "redact",
                "mask_strength": "medium",
            },
            "phase=validate; reason=invalid_mask_mode",
        ),
        (
            {
                "video_url": "https://media.example/input.mp4",
                "mask_mode": "blur",
                "mask_strength": "maximum",
            },
            "phase=validate; reason=invalid_mask_strength",
        ),
    ],
)
def test_face_blur_client_rejects_invalid_submission_input(
    kwargs: dict[str, str], detail: str
) -> None:
    client = _client(lambda _: pytest.fail("invalid input must not call MediaKit"))

    with pytest.raises(MediaKitFaceBlurError) as exc_info:
        asyncio.run(client.submit(**kwargs))

    assert exc_info.value.detail == detail


def test_face_blur_client_redacts_provider_failure_details() -> None:
    private_video_url = "https://media.example/input.mp4?X-Tos-Signature=private"

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            json={
                "code": "InvalidInput",
                "message": f"Failed to download {private_video_url}",
                "secret": "test-mediakit-key",
            },
        )

    with pytest.raises(MediaKitFaceBlurError) as exc_info:
        asyncio.run(
            _client(handler).submit(
                video_url=private_video_url,
                mask_mode="mosaic",
                mask_strength="medium",
            )
        )

    error = exc_info.value
    assert error.detail == "phase=submit; status_code=400"
    assert "test-mediakit-key" not in str(error)
    assert private_video_url not in str(error)
    assert "InvalidInput" not in str(error)


def test_face_blur_client_raises_safe_error_for_failed_task() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "success": True,
                "status": "failed",
                "code": "FaceNotDetected",
                "request_id": "request-789",
                "message": "provider response that must not be exposed",
            },
        )

    with pytest.raises(MediaKitFaceBlurError) as exc_info:
        asyncio.run(_client(handler).get_task(task_id="face-task-123"))

    assert exc_info.value.detail == (
        "phase=query; status=failed; code=FaceNotDetected; request_id=request-789"
    )
    assert "provider response" not in str(exc_info.value)


def test_face_blur_client_rejects_malformed_completion_result() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "success": True,
                "status": "completed",
                "result": {"video_url": "file:///private/output.mp4"},
            },
        )

    with pytest.raises(MediaKitFaceBlurError) as exc_info:
        asyncio.run(_client(handler).get_task(task_id="face-task-123"))

    assert exc_info.value.detail == (
        "phase=query; status=succeeded; reason=missing_output_video_url"
    )
