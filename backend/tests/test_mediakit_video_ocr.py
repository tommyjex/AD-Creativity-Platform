import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr

from backend.app.core.config import Settings
from backend.app.services.mediakit_video_ocr import (
    MediaKitVideoOcrClient,
    MediaKitVideoOcrError,
    VideoOcrTaskStatus,
)


def _client(handler) -> MediaKitVideoOcrClient:
    return MediaKitVideoOcrClient(
        Settings(mediakit_api_key=SecretStr("test-mediakit-key")),
        transport=httpx.MockTransport(handler),
    )


def test_video_ocr_submits_only_whitelisted_fields() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/tools/video-ocr"
        assert request.headers["Authorization"] == "Bearer test-mediakit-key"
        assert json.loads(request.content) == {
            "video_url": "https://media.example/input.mp4?signature=private",
            "mode": "Subtitle",
            "client_token": "aigc-video-ocr-token",
        }
        return httpx.Response(
            200,
            json={
                "success": True,
                "task_id": "ocr-task-1",
                "request_id": "request-1",
            },
        )

    task = asyncio.run(
        _client(handler).submit(
            video_url="https://media.example/input.mp4?signature=private",
            mode="Subtitle",
            client_token="aigc-video-ocr-token",
        )
    )

    assert task.status is VideoOcrTaskStatus.QUEUED
    assert task.task_id == "ocr-task-1"
    assert task.request_id == "request-1"


def test_video_ocr_parses_sorts_and_discards_invalid_segments() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "success": True,
                "status": "completed",
                "request_id": "request-2",
                "result": {
                    "duration": 12.5,
                    "subtitles": [
                        {
                            "start_time": 4,
                            "end_time": 6,
                            "subtitle_text": "第二句",
                        },
                        {
                            "start_time": 1,
                            "end_time": 2,
                            "subtitle_text": "第一句",
                        },
                        {
                            "start_time": 8,
                            "end_time": 7,
                            "subtitle_text": "非法",
                        },
                    ],
                },
            },
        )

    task = asyncio.run(_client(handler).get_task(task_id="ocr-task-1"))

    assert task.status is VideoOcrTaskStatus.SUCCEEDED
    assert [segment.text for segment in task.segments] == ["第一句", "第二句"]
    assert task.duration_seconds == 12.5
    assert task.discarded_segment_count == 1


def test_video_ocr_accepts_empty_subtitles() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "success": True,
                "status": "completed",
                "result": {"duration": 5, "subtitles": []},
            },
        )

    task = asyncio.run(_client(handler).get_task(task_id="ocr-task-1"))

    assert task.segments == ()
    assert task.duration_seconds == 5


@pytest.mark.parametrize("mode", ["Detailed", "subtitle", ""])
def test_video_ocr_rejects_non_subtitle_mode(mode: str) -> None:
    client = _client(lambda _: pytest.fail("invalid input must not call provider"))

    with pytest.raises(MediaKitVideoOcrError, match="mode is invalid"):
        asyncio.run(
            client.submit(
                video_url="https://media.example/input.mp4",
                mode=mode,
                client_token="token",
            )
        )


def test_video_ocr_error_does_not_leak_url_or_key() -> None:
    private_url = "https://media.example/input.mp4?secret=private"

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            text=f"test-mediakit-key {private_url}",
        )

    with pytest.raises(MediaKitVideoOcrError) as exc_info:
        asyncio.run(
            _client(handler).submit(
                video_url=private_url,
                client_token="token",
            )
        )

    rendered = f"{exc_info.value} {exc_info.value.detail}"
    assert "test-mediakit-key" not in rendered
    assert "secret=private" not in rendered
