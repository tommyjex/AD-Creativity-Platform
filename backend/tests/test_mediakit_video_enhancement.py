import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr

from backend.app.core.config import Settings
from backend.app.services.mediakit_video_enhancement import (
    MediaKitVideoEnhancementClient,
    MediaKitVideoEnhancementError,
    VideoEnhancementTaskStatus,
)


API_KEY = "test-mediakit-video-enhancement-key"


def _client(handler) -> MediaKitVideoEnhancementClient:
    return MediaKitVideoEnhancementClient(
        Settings(mediakit_api_key=SecretStr(API_KEY)),
        transport=httpx.MockTransport(handler),
        request_timeout_seconds=5,
    )


def test_submit_standard_uses_whitelist_and_stable_client_token() -> None:
    requests: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/api/v1/tools/enhance-video"
        assert request.headers["Authorization"] == f"Bearer {API_KEY}"
        requests.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "success": True,
                "task_id": "amk-tool-enhance-video-1",
                "request_id": "request-1",
            },
        )

    client = _client(handler)
    first = asyncio.run(
        client.submit(
            video_url="https://media.example/input.mp4?signature=private",
            idempotency_key="run-1:node-1",
        )
    )
    second = asyncio.run(
        client.submit(
            video_url="https://media.example/input.mp4?signature=private",
            idempotency_key="run-1:node-1",
        )
    )

    expected_fields = {
        "video_url",
        "tool_version",
        "scene",
        "enhance_style",
        "resolution",
        "bitrate_level",
        "client_token",
    }
    assert set(requests[0]) == expected_fields
    assert requests[0]["tool_version"] == "standard"
    assert requests[0]["scene"] == "aigc"
    assert requests[0]["enhance_style"] == "hd"
    assert requests[0]["resolution"] == "1080p"
    assert requests[0]["bitrate_level"] == "medium"
    assert requests[0]["client_token"] == requests[1]["client_token"]
    token = str(requests[0]["client_token"])
    assert len(token) <= 64
    assert token.isascii() and token.isprintable()
    assert not {
        "callback_url",
        "callback_args",
        "queue_id",
        "media_output_destination",
        "bit_depth",
    }.intersection(requests[0])
    assert first.task_id == second.task_id == "amk-tool-enhance-video-1"
    assert first.request_id == "request-1"
    assert first.status is VideoEnhancementTaskStatus.QUEUED


def test_submit_professional_normalizes_mutually_exclusive_fields() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload == {
            "video_url": "https://media.example/input.mp4",
            "tool_version": "professional",
            "enhance_style": "natural",
            "client_token": MediaKitVideoEnhancementClient.build_client_token(
                "attempt-2"
            ),
            "resolution_limit": 2160,
            "fps": 60,
            "bit_depth": 10,
            "bitrate": 8000,
        }
        assert "scene" not in payload
        assert "resolution" not in payload
        assert "bitrate_level" not in payload
        return httpx.Response(
            200,
            headers={"x-request-id": "request-header-2"},
            json={"success": True, "task_id": "task-2"},
        )

    task = asyncio.run(
        _client(handler).submit(
            video_url="https://media.example/input.mp4",
            idempotency_key="attempt-2",
            tool_version="professional",
            scene="old_film",
            enhance_style="natural",
            resolution="8k",
            resolution_limit=2160,
            fps=60,
            bitrate_level="high",
            bitrate=8000,
            bit_depth=10,
        )
    )

    assert task.request_id == "request-header-2"


def test_submit_professional_16_bit_omits_all_bitrate_fields() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["bit_depth"] == 16
        assert "bitrate" not in payload
        assert "bitrate_level" not in payload
        assert "scene" not in payload
        return httpx.Response(200, json={"success": True, "task_id": "task-16"})

    asyncio.run(
        _client(handler).submit(
            video_url="https://media.example/input.mov",
            idempotency_key="attempt-16",
            tool_version="professional",
            bit_depth=16,
            bitrate=150000,
            bitrate_level="high",
        )
    )


@pytest.mark.parametrize(
    ("kwargs", "code"),
    [
        ({"video_url": "file:///private/input.mp4"}, "invalid_video_url"),
        ({"tool_version": "express"}, "invalid_tool_version"),
        ({"scene": "portrait"}, "invalid_scene"),
        ({"enhance_style": "strong"}, "invalid_enhance_style"),
        ({"resolution": "16k"}, "invalid_resolution"),
        ({"resolution_limit": 127}, "invalid_resolution_limit"),
        ({"fps": 121}, "invalid_fps"),
        ({"bitrate": 9}, "invalid_bitrate"),
        ({"bit_depth": 14}, "invalid_bit_depth"),
        (
            {"tool_version": "standard", "bit_depth": 10},
            "bit_depth_requires_professional",
        ),
    ],
)
def test_submit_rejects_invalid_parameters_before_http(
    kwargs: dict[str, object], code: str
) -> None:
    params: dict[str, object] = {
        "video_url": "https://media.example/input.mp4",
        "idempotency_key": "attempt-invalid",
    }
    params.update(kwargs)
    client = _client(lambda _: pytest.fail("invalid input must not call MediaKit"))

    with pytest.raises(MediaKitVideoEnhancementError) as exc_info:
        asyncio.run(client.submit(**params))

    assert exc_info.value.code == code
    assert exc_info.value.phase == "validate"


def test_get_task_normalizes_running_and_success_result() -> None:
    responses = iter(
        [
            {
                "success": True,
                "task_id": "task-3",
                "task_type": "enhance-video",
                "status": "running",
                "request_id": "request-running",
            },
            {
                "success": True,
                "task_id": "task-3",
                "task_type": "enhance-video",
                "status": "completed",
                "request_id": "request-completed",
                "result": {
                    "video_url": (
                        "https://media.example/output.mp4?auth_key=private"
                    ),
                    "duration": 12.5,
                    "fps": 59.94,
                    "resolution": "4k",
                    "tool_version": "professional",
                },
            },
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/api/v1/tasks/task-3"
        return httpx.Response(200, json=next(responses))

    client = _client(handler)
    running = asyncio.run(client.get_task(task_id="task-3"))
    succeeded = asyncio.run(client.get_task(task_id="task-3"))

    assert running.status is VideoEnhancementTaskStatus.RUNNING
    assert running.request_id == "request-running"
    assert succeeded.status is VideoEnhancementTaskStatus.SUCCEEDED
    assert succeeded.task_id == "task-3"
    assert succeeded.request_id == "request-completed"
    assert succeeded.output_video_url == (
        "https://media.example/output.mp4?auth_key=private"
    )
    assert succeeded.duration_seconds == 12.5
    assert succeeded.fps == 59.94
    assert succeeded.resolution == "4k"
    assert succeeded.tool_version == "professional"


def test_get_task_maps_failed_status_to_safe_error() -> None:
    private_url = "https://media.example/input.mp4?signature=private"

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "success": True,
                "task_id": "task-failed",
                "status": "failed",
                "request_id": "request-failed",
                "error": {
                    "code": "DownloadFailed",
                    "message": f"Could not download {private_url}",
                    "secret": API_KEY,
                },
            },
        )

    with pytest.raises(MediaKitVideoEnhancementError) as exc_info:
        asyncio.run(_client(handler).get_task(task_id="task-failed"))

    error = exc_info.value
    assert error.code == "provider_failed"
    assert error.phase == "query"
    assert error.provider_code == "DownloadFailed"
    assert error.request_id == "request-failed"
    assert error.task_id == "task-failed"
    assert API_KEY not in str(error)
    assert private_url not in str(error)
    assert "Could not download" not in str(error)


@pytest.mark.parametrize(
    ("response", "code"),
    [
        (
            httpx.Response(
                200,
                json={"success": True, "task_id": "task-4", "status": "waiting"},
            ),
            "unknown_status",
        ),
        (httpx.Response(200, content=b"not-json"), "invalid_json"),
        (httpx.Response(200, json=["unexpected"]), "invalid_payload"),
        (
            httpx.Response(
                200,
                json={
                    "success": True,
                    "task_id": "task-4",
                    "status": "completed",
                    "result": {"video_url": "http://media.example/output.mp4"},
                },
            ),
            "invalid_output_video_url",
        ),
        (
            httpx.Response(
                200,
                json={
                    "success": True,
                    "task_id": "different-task",
                    "status": "running",
                },
            ),
            "task_id_mismatch",
        ),
    ],
)
def test_get_task_rejects_unknown_status_and_illegal_responses(
    response: httpx.Response, code: str
) -> None:
    with pytest.raises(MediaKitVideoEnhancementError) as exc_info:
        asyncio.run(
            _client(lambda _: response).get_task(task_id="task-4")
        )

    assert exc_info.value.code == code
    assert exc_info.value.phase == "query"


@pytest.mark.parametrize(
    ("exception_factory", "code"),
    [
        (
            lambda request: httpx.ConnectError(
                "private network detail", request=request
            ),
            "network_error",
        ),
        (
            lambda request: httpx.ReadTimeout(
                "private timeout detail", request=request
            ),
            "request_timeout",
        ),
    ],
)
def test_http_failures_are_normalized_and_redacted(
    exception_factory, code: str
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise exception_factory(request)

    with pytest.raises(MediaKitVideoEnhancementError) as exc_info:
        asyncio.run(
            _client(handler).submit(
                video_url="https://media.example/input.mp4?secret=url-secret",
                idempotency_key="attempt-network",
            )
        )

    error = exc_info.value
    assert error.code == code
    assert error.phase == "submit"
    assert API_KEY not in str(error)
    assert "url-secret" not in str(error)
    assert "private" not in str(error)


def test_poll_returns_completed_task_after_running() -> None:
    responses = iter(
        [
            {
                "success": True,
                "task_id": "task-poll",
                "status": "running",
            },
            {
                "success": True,
                "task_id": "task-poll",
                "status": "completed",
                "result": {
                    "video_url": "https://media.example/output.mp4",
                },
            },
        ]
    )

    task = asyncio.run(
        _client(
            lambda _: httpx.Response(200, json=next(responses))
        ).poll(
            task_id="task-poll",
            timeout_seconds=1,
            poll_interval_seconds=0,
        )
    )

    assert task.status is VideoEnhancementTaskStatus.SUCCEEDED


def test_poll_raises_safe_timeout_for_running_task() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "success": True,
                "task_id": "task-timeout",
                "status": "running",
            },
        )

    with pytest.raises(MediaKitVideoEnhancementError) as exc_info:
        asyncio.run(
            _client(handler).poll(
                task_id="task-timeout",
                timeout_seconds=0,
                poll_interval_seconds=0,
            )
        )

    error = exc_info.value
    assert error.code == "poll_timeout"
    assert error.phase == "poll"
    assert error.task_id == "task-timeout"


def test_http_and_provider_errors_do_not_expose_response_body() -> None:
    private_url = "https://media.example/input.mp4?signature=private"
    responses = iter(
        [
            httpx.Response(
                400,
                json={"message": private_url, "secret": API_KEY},
            ),
            httpx.Response(
                200,
                json={
                    "success": False,
                    "request_id": "request-rejected",
                    "error": {
                        "code": "InvalidParameter",
                        "message": private_url,
                        "secret": API_KEY,
                    },
                },
            ),
        ]
    )
    client = _client(lambda _: next(responses))

    errors: list[MediaKitVideoEnhancementError] = []
    for idempotency_key in ("http-error", "provider-error"):
        with pytest.raises(MediaKitVideoEnhancementError) as exc_info:
            asyncio.run(
                client.submit(
                    video_url=private_url,
                    idempotency_key=idempotency_key,
                )
            )
        errors.append(exc_info.value)

    assert errors[0].code == "http_error"
    assert errors[0].status_code == 400
    assert errors[1].code == "provider_rejected"
    assert errors[1].provider_code == "InvalidParameter"
    assert errors[1].request_id == "request-rejected"
    rendered = " ".join(f"{error} {error.detail}" for error in errors)
    assert API_KEY not in rendered
    assert private_url not in rendered
