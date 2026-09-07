import asyncio
from copy import deepcopy
import json

import httpx
import pytest
from pydantic import SecretStr

from backend.app.core.config import Settings
from backend.app.services.mediakit_multitrack import (
    MediaKitMultiTrackClient,
    MediaKitMultiTrackError,
    MultiTrackTaskStatus,
)


API_KEY = "test-mediakit-multitrack-key"


def _client(handler, **settings_overrides: object) -> MediaKitMultiTrackClient:
    return MediaKitMultiTrackClient(
        Settings(
            mediakit_api_key=SecretStr(API_KEY),
            **settings_overrides,
        ),
        transport=httpx.MockTransport(handler),
        request_timeout_seconds=5,
    )


def _project() -> dict[str, object]:
    return {
        "canvas": {
            "width": 1080,
            "height": 1920,
            "background_color": "#000000FF",
        },
        "track": [
            [
                {
                    "type": "video",
                    "source": "https://media.example/video.mp4?signature=private",
                    "target_time": [0, 2000],
                }
            ],
            [
                {
                    "type": "text",
                    "text": "headline",
                    "target_time": [0, 2000],
                    "extra": [
                        {
                            "type": "transform",
                            "pos_x": 20,
                            "pos_y": 40,
                            "width": 800,
                            "height": 200,
                        }
                    ],
                }
            ],
        ],
        "output": {"format": "mp4", "fps": 30},
        "callback_url": "https://forbidden.example/callback",
        "callback_args": "forbidden",
        "queue_id": "forbidden",
        "media_output_destination": "tos://forbidden",
        "extra_param": {"forbidden": True},
    }


def test_submit_uses_whitelist_and_stable_client_token() -> None:
    requests: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/api/v1/tools/multi-track-edit"
        assert request.headers["Authorization"] == f"Bearer {API_KEY}"
        requests.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "success": True,
                "task_id": "multitrack-task-1",
                "request_id": "request-1",
            },
        )

    project = _project()
    original = deepcopy(project)
    client = _client(handler)
    first = asyncio.run(
        client.submit(project=project, idempotency_key="run-1:node-1:attempt-1")
    )
    second = asyncio.run(
        client.submit(project=project, idempotency_key="run-1:node-1:attempt-1")
    )

    assert project == original
    assert set(requests[0]) == {"canvas", "track", "output", "client_token"}
    assert requests[0]["canvas"] == project["canvas"]
    assert requests[0]["track"] == project["track"]
    assert requests[0]["output"] == project["output"]
    assert requests[0]["client_token"] == requests[1]["client_token"]
    token = str(requests[0]["client_token"])
    assert len(token) <= 64
    assert token.isascii() and token.isprintable()
    assert first.task_id == second.task_id == "multitrack-task-1"
    assert first.request_id == "request-1"
    assert first.status is MultiTrackTaskStatus.QUEUED


@pytest.mark.parametrize(
    ("project", "code"),
    [
        ({"track": [[]], "output": {}}, "missing_canvas"),
        ({"canvas": {}, "output": {}}, "missing_track"),
        ({"canvas": {}, "track": [[]]}, "missing_output"),
        ({"canvas": [], "track": [[]], "output": {}}, "invalid_canvas"),
        ({"canvas": {}, "track": {}, "output": {}}, "invalid_track"),
        ({"canvas": {}, "track": [], "output": {}}, "empty_track"),
        ({"canvas": {}, "track": [{}], "output": {}}, "invalid_track_row"),
        ({"canvas": {}, "track": [[]], "output": []}, "invalid_output"),
    ],
)
def test_submit_rejects_invalid_project_before_http(
    project: dict[str, object],
    code: str,
) -> None:
    client = _client(lambda _: pytest.fail("invalid input must not call MediaKit"))

    with pytest.raises(MediaKitMultiTrackError) as exc_info:
        asyncio.run(
            client.submit(project=project, idempotency_key="attempt-invalid")
        )

    assert exc_info.value.phase == "validate"
    assert exc_info.value.code == code


@pytest.mark.parametrize("idempotency_key", ["", 42])
def test_submit_rejects_invalid_idempotency_key(
    idempotency_key: object,
) -> None:
    client = _client(lambda _: pytest.fail("invalid input must not call MediaKit"))

    with pytest.raises(MediaKitMultiTrackError) as exc_info:
        asyncio.run(
            client.submit(
                project=_project(),
                idempotency_key=idempotency_key,  # type: ignore[arg-type]
            )
        )

    assert exc_info.value.phase == "validate"
    assert exc_info.value.code == "invalid_idempotency_key"


def test_get_task_normalizes_queued_running_and_success() -> None:
    responses = iter(
        [
            {"success": True, "task_id": "task-2", "status": "pending"},
            {"success": True, "task_id": "task-2", "status": "processing"},
            {
                "success": True,
                "task_id": "task-2",
                "task_type": "multi-track-edit",
                "status": "completed",
                "request_id": "request-completed",
                "result": {
                    "video_url": (
                        "https://media.example/output.mp4?auth_key=private"
                    )
                },
            },
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url.path == "/api/v1/tasks/task-2"
        return httpx.Response(200, json=next(responses))

    client = _client(handler)
    queued = asyncio.run(client.get_task(task_id="task-2"))
    running = asyncio.run(client.get_task(task_id="task-2"))
    succeeded = asyncio.run(client.get_task(task_id="task-2"))

    assert queued.status is MultiTrackTaskStatus.QUEUED
    assert running.status is MultiTrackTaskStatus.RUNNING
    assert succeeded.status is MultiTrackTaskStatus.SUCCEEDED
    assert succeeded.request_id == "request-completed"
    assert succeeded.output_video_url == (
        "https://media.example/output.mp4?auth_key=private"
    )


@pytest.mark.parametrize(
    ("response", "code"),
    [
        (
            httpx.Response(
                200,
                json={"success": True, "task_id": "task-3", "status": "paused"},
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
                    "task_id": "task-3",
                    "status": "completed",
                    "result": {},
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
        (
            httpx.Response(
                200,
                json={
                    "success": True,
                    "task_id": "task-3",
                    "task_type": "enhance-video",
                    "status": "running",
                },
            ),
            "unexpected_task_type",
        ),
    ],
)
def test_get_task_rejects_unknown_status_and_invalid_responses(
    response: httpx.Response,
    code: str,
) -> None:
    with pytest.raises(MediaKitMultiTrackError) as exc_info:
        asyncio.run(_client(lambda _: response).get_task(task_id="task-3"))

    assert exc_info.value.phase == "poll"
    assert exc_info.value.code == code


def test_failed_task_exposes_only_safe_identifiers() -> None:
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

    with pytest.raises(MediaKitMultiTrackError) as exc_info:
        asyncio.run(_client(handler).get_task(task_id="task-failed"))

    error = exc_info.value
    assert error.phase == "poll"
    assert error.code == "provider_failed"
    assert error.provider_code == "DownloadFailed"
    assert error.request_id == "request-failed"
    assert error.task_id == "task-failed"
    rendered = f"{error} {error.detail}"
    assert API_KEY not in rendered
    assert private_url not in rendered
    assert "Could not download" not in rendered


@pytest.mark.parametrize(
    ("exception_factory", "code"),
    [
        (
            lambda request: httpx.ConnectError(
                "private network detail",
                request=request,
            ),
            "network_error",
        ),
        (
            lambda request: httpx.ReadTimeout(
                "private timeout detail",
                request=request,
            ),
            "request_timeout",
        ),
    ],
)
def test_http_failures_are_normalized_and_redacted(
    exception_factory,
    code: str,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise exception_factory(request)

    with pytest.raises(MediaKitMultiTrackError) as exc_info:
        asyncio.run(
            _client(handler).submit(
                project=_project(),
                idempotency_key="attempt-network",
            )
        )

    error = exc_info.value
    assert error.phase == "submit"
    assert error.code == code
    rendered = f"{error} {error.detail}"
    assert API_KEY not in rendered
    assert "signature=private" not in rendered
    assert "private network detail" not in rendered


def test_provider_rejection_does_not_expose_response_body() -> None:
    private_url = "https://media.example/input.mp4?signature=private"

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
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
        )

    with pytest.raises(MediaKitMultiTrackError) as exc_info:
        asyncio.run(
            _client(handler).submit(
                project=_project(),
                idempotency_key="attempt-rejected",
            )
        )

    error = exc_info.value
    assert error.code == "provider_rejected"
    assert error.provider_code == "InvalidParameter"
    assert error.request_id == "request-rejected"
    rendered = f"{error} {error.detail}"
    assert API_KEY not in rendered
    assert private_url not in rendered


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
                "result": {"video_url": "https://media.example/output.mp4"},
            },
        ]
    )
    client = _client(
        lambda _: httpx.Response(200, json=next(responses)),
        mediakit_multitrack_poll_interval_seconds=1,
        mediakit_multitrack_timeout_seconds=5,
    )

    task = asyncio.run(
        client.poll(
            task_id="task-poll",
            poll_interval_seconds=0,
            timeout_seconds=1,
        )
    )

    assert task.status is MultiTrackTaskStatus.SUCCEEDED


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

    with pytest.raises(MediaKitMultiTrackError) as exc_info:
        asyncio.run(
            _client(handler).poll(
                task_id="task-timeout",
                timeout_seconds=0,
                poll_interval_seconds=0,
            )
        )

    error = exc_info.value
    assert error.phase == "poll"
    assert error.code == "poll_timeout"
    assert error.task_id == "task-timeout"
