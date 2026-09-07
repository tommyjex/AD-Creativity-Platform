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


def test_face_blur_client_uses_dedicated_request_timeout() -> None:
    settings = Settings(
        mediakit_api_key=SecretStr("test-mediakit-key"),
        mediakit_asr_timeout_seconds=17,
        mediakit_face_blur_timeout_seconds=29,
    )

    client = FaceBlurVideoClient(settings)
    overridden = FaceBlurVideoClient(settings, request_timeout_seconds=7.5)

    assert client.request_timeout_seconds == 29
    assert overridden.request_timeout_seconds == 7.5


def test_face_blur_client_compatible_submit_omits_client_token() -> None:
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


def test_face_blur_client_submits_stable_token_and_only_whitelisted_fields() -> None:
    requests: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={"success": True, "task_id": "face-task-123"},
        )

    client = _client(handler)
    for _ in range(2):
        asyncio.run(
            client.submit(
                video_url="https://media.example/input.mp4",
                mask_mode="mosaic",
                mask_strength="medium",
                client_token="aigc-run-1-node-2-attempt-3",
            )
        )

    assert requests == [
        {
            "video_url": "https://media.example/input.mp4",
            "mask_mode": "mosaic",
            "mask_strength": "medium",
            "client_token": "aigc-run-1-node-2-attempt-3",
        },
        {
            "video_url": "https://media.example/input.mp4",
            "mask_mode": "mosaic",
            "mask_strength": "medium",
            "client_token": "aigc-run-1-node-2-attempt-3",
        },
    ]
    forbidden_fields = {
        "face_confidence",
        "face_box_expand",
        "callback_url",
        "callback_args",
        "queue_id",
        "media_output_destination",
    }
    assert not forbidden_fields.intersection(requests[0])


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


@pytest.mark.parametrize(
    "client_token",
    [
        "",
        "a" * 65,
        "token\nwith-newline",
        "令牌",
    ],
)
def test_face_blur_client_rejects_invalid_client_token(
    client_token: str,
) -> None:
    client = _client(lambda _: pytest.fail("invalid input must not call MediaKit"))

    with pytest.raises(MediaKitFaceBlurError) as exc_info:
        asyncio.run(
            client.submit(
                video_url="https://media.example/input.mp4",
                mask_mode="blur",
                mask_strength="medium",
                client_token=client_token,
            )
        )

    assert exc_info.value.detail == (
        "phase=validate; reason=invalid_client_token"
    )


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


@pytest.mark.parametrize("status", ["paused", "unknown", ""])
def test_face_blur_client_rejects_unknown_task_status(status: str) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"success": True, "status": status})

    with pytest.raises(MediaKitFaceBlurError) as exc_info:
        asyncio.run(_client(handler).get_task(task_id="face-task-123"))

    assert exc_info.value.detail == "phase=query; reason=unexpected_status"


@pytest.mark.parametrize(
    ("response", "detail"),
    [
        (
            httpx.Response(200, content=b"not-json"),
            "phase=query; reason=invalid_json",
        ),
        (
            httpx.Response(200, json=["unexpected"]),
            "phase=query; reason=unexpected_payload",
        ),
        (
            httpx.Response(200, json={"success": True}),
            "phase=query; reason=missing_status",
        ),
    ],
)
def test_face_blur_client_rejects_invalid_task_response(
    response: httpx.Response,
    detail: str,
) -> None:
    with pytest.raises(MediaKitFaceBlurError) as exc_info:
        asyncio.run(
            _client(lambda _: response).get_task(task_id="face-task-123")
        )

    assert exc_info.value.detail == detail


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
