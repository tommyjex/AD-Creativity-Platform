import asyncio

import httpx
from pydantic import SecretStr

from backend.app.core.config import Settings
from backend.app.services.mediakit import (
    MediaKitAsrError,
    MediaKitAsrSubtitleClient,
    MockAsrSubtitleClient,
    SubtitleSegment,
    get_asr_subtitle_client,
)
from backend.app.services.subtitles import segments_to_srt


def test_segments_to_srt_formats_timestamps_and_skips_empty_text() -> None:
    srt = segments_to_srt(
        [
            SubtitleSegment(0.32, 2.1, "  第一行\n第二行  "),
            SubtitleSegment(3.2, 2.5, "反向时间会被夹紧"),
            SubtitleSegment(4.0, 5.0, "   "),
        ]
    )

    assert srt == (
        "1\n"
        "00:00:00,320 --> 00:00:02,100\n"
        "第一行 第二行\n"
        "\n"
        "2\n"
        "00:00:03,200 --> 00:00:03,200\n"
        "反向时间会被夹紧\n"
    )
    assert segments_to_srt([]) == ""


def test_mediakit_client_submits_polls_and_sorts_segments(monkeypatch) -> None:
    calls: list[str] = []

    async def no_sleep(_: int) -> None:
        return None

    monkeypatch.setattr("backend.app.services.mediakit.asyncio.sleep", no_sleep)

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.method} {request.url.path}")
        assert request.headers["Authorization"] == "Bearer test-key"
        if request.method == "POST":
            assert request.url.path == "/api/v1/tools/asr-subtitles"
            assert request.read()
            return httpx.Response(200, json={"success": True, "task_id": "task-1"})
        if len(calls) == 2:
            return httpx.Response(200, json={"success": True, "status": "running"})
        return httpx.Response(
            200,
            json={
                "success": True,
                "status": "completed",
                "result": {
                    "subtitles": [
                        {
                            "start_time": 3.1,
                            "end_time": 5.7,
                            "subtitle_text": "第二句",
                        },
                        {
                            "start_time": 0.5,
                            "end_time": 2.8,
                            "subtitle_text": "第一句",
                            "speaker": "speaker_0",
                        },
                    ]
                },
            },
        )

    client = MediaKitAsrSubtitleClient(
        Settings(
            mediakit_api_key=SecretStr("test-key"),
            mediakit_asr_poll_interval_seconds=1,
            mediakit_asr_timeout_seconds=5,
        ),
        transport=httpx.MockTransport(handler),
    )

    segments = asyncio.run(client.transcribe(video_url="https://example.com/video.mp4"))

    assert calls == [
        "POST /api/v1/tools/asr-subtitles",
        "GET /api/v1/tasks/task-1",
        "GET /api/v1/tasks/task-1",
    ]
    assert segments == [
        SubtitleSegment(0.5, 2.8, "第一句", "speaker_0"),
        SubtitleSegment(3.1, 5.7, "第二句"),
    ]


def test_mediakit_client_redacts_failures(monkeypatch) -> None:
    async def no_sleep(_: int) -> None:
        return None

    monkeypatch.setattr("backend.app.services.mediakit.asyncio.sleep", no_sleep)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"secret": "raw-provider-response"})

    client = MediaKitAsrSubtitleClient(
        Settings(mediakit_api_key=SecretStr("secret-key")),
        transport=httpx.MockTransport(handler),
    )

    try:
        asyncio.run(client.transcribe(video_url="https://example.com/video.mp4"))
    except MediaKitAsrError as exc:
        assert exc.detail == "phase=submit; status_code=500"
        assert "secret-key" not in str(exc)
        assert "raw-provider-response" not in str(exc)
    else:
        raise AssertionError("MediaKitAsrError was not raised")


def test_mediakit_factory_uses_mock_without_api_key() -> None:
    client = get_asr_subtitle_client(Settings(mediakit_api_key=None))

    assert isinstance(client, MockAsrSubtitleClient)
    segments = asyncio.run(client.transcribe(video_url="mock://local"))
    assert segments
