from __future__ import annotations

import asyncio
import json
import time
import urllib.request
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.parse import urlsplit

import httpx

from backend.app.core.config import Settings, get_settings

__all__ = [
    "SubtitleSegment",
    "MediaKitAsrError",
    "AsrSubtitleClient",
    "MediaKitAsrSubtitleClient",
    "MockAsrSubtitleClient",
    "get_asr_subtitle_client",
]


@dataclass(frozen=True)
class SubtitleSegment:
    """One transcribed subtitle span with second-precision timestamps."""

    start_seconds: float
    end_seconds: float
    text: str
    speaker: str | None = None


class MediaKitAsrError(RuntimeError):
    """Raised when MediaKit ASR fails with safe, redacted diagnostics.

    ``message`` and ``detail`` MUST NOT include the API key, the raw
    provider response body, or the input (signed) video URL. ``detail``
    may only carry phase plus status/HTTP-code style breadcrumbs.
    """

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.detail = detail


class AsrSubtitleClient(Protocol):
    async def transcribe(self, *, video_url: str) -> list[SubtitleSegment]:
        """Transcribe speech in the given video into ordered subtitles.

        Returns subtitle segments sorted by ``start_seconds`` (empty list
        when the video contains no recognizable speech).
        """


class MediaKitAsrSubtitleClient:
    """MediaKit speech-to-subtitle client (submit task + poll result).

    Uses an ``httpx.AsyncClient`` with an injectable transport so the
    two-step flow can be exercised without real network access.
    """

    _SUBMIT_PATH = "/api/v1/tools/asr-subtitles"

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.settings.require_mediakit_config()
        assert self.settings.mediakit_api_key is not None
        self.transport = transport

    def _auth_headers(self) -> dict[str, str]:
        key = self.settings.mediakit_api_key.get_secret_value()
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    async def transcribe(self, *, video_url: str) -> list[SubtitleSegment]:
        parsed = urlsplit(video_url)
        if parsed.scheme not in {"http", "https"}:
            raise MediaKitAsrError(
                "MediaKit ASR requires an HTTP or HTTPS video URL.",
                detail="phase=validate; reason=invalid_scheme",
            )

        timeout_seconds = self.settings.mediakit_asr_timeout_seconds
        poll_interval = self.settings.mediakit_asr_poll_interval_seconds

        async with httpx.AsyncClient(
            base_url=self.settings.mediakit_base_url,
            timeout=httpx.Timeout(float(timeout_seconds)),
            transport=self.transport,
            headers=self._auth_headers(),
        ) as client:
            task_id = await self._submit(client, video_url=video_url)
            result = await self._poll(
                client,
                task_id=task_id,
                poll_interval=poll_interval,
                timeout_seconds=timeout_seconds,
            )

        return self._parse_subtitles(result)

    async def _submit(self, client: httpx.AsyncClient, *, video_url: str) -> str:
        body: dict[str, Any] = {"video_url": video_url}
        language = self.settings.mediakit_asr_language
        if language:
            body["language"] = language

        # #region debug-point A-B-E:submit-request
        exec("try:\n urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:7777/event',data=json.dumps({'sessionId':'mediakit-asr-failure','runId':'post-fix','hypothesisId':'A-B-E','location':'mediakit.py:_submit','msg':'[DEBUG] MediaKit submit request','data':{'base_host':urlsplit(str(client.base_url)).hostname,'video_scheme':urlsplit(video_url).scheme,'video_host':urlsplit(video_url).hostname,'has_query':bool(urlsplit(video_url).query),'language_set':bool(language)},'ts':int(time.time()*1000)}).encode(),headers={'Content-Type':'application/json'}),timeout=0.2).read()\nexcept Exception:\n pass")
        # #endregion
        try:
            response = await client.post(self._SUBMIT_PATH, json=body)
        except httpx.HTTPError:
            raise MediaKitAsrError(
                "Failed to submit the MediaKit ASR task.",
                detail="phase=submit; reason=transport_error",
            ) from None

        if response.status_code >= 300:
            raise MediaKitAsrError(
                "MediaKit ASR task submission was rejected.",
                detail=f"phase=submit; status_code={response.status_code}",
            )

        payload = self._json_or_error(response, phase="submit")
        # #region debug-point A-B:submit-response
        exec("try:\n urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:7777/event',data=json.dumps({'sessionId':'mediakit-asr-failure','runId':'post-fix','hypothesisId':'A-B','location':'mediakit.py:_submit','msg':'[DEBUG] MediaKit submit response','data':{'http_status':response.status_code,'payload_keys':sorted(payload.keys()),'success':payload.get('success'),'task_id_present':bool(payload.get('task_id')),'provider_code':payload.get('code')},'ts':int(time.time()*1000)}).encode(),headers={'Content-Type':'application/json'}),timeout=0.2).read()\nexcept Exception:\n pass")
        # #endregion
        if not payload.get("success"):
            raise MediaKitAsrError(
                "MediaKit ASR task submission was not accepted.",
                detail="phase=submit; reason=not_successful",
            )

        task_id = payload.get("task_id")
        if not isinstance(task_id, str) or not task_id:
            raise MediaKitAsrError(
                "MediaKit ASR submission response is missing a task id.",
                detail="phase=submit; reason=missing_task_id",
            )
        return task_id

    async def _poll(
        self,
        client: httpx.AsyncClient,
        *,
        task_id: str,
        poll_interval: int,
        timeout_seconds: int,
    ) -> dict[str, Any]:
        deadline = time.monotonic() + float(timeout_seconds)
        path = f"/api/v1/tasks/{task_id}"

        while True:
            await asyncio.sleep(poll_interval)

            if time.monotonic() >= deadline:
                raise MediaKitAsrError(
                    "MediaKit ASR polling timed out.",
                    detail="phase=poll; reason=timeout",
                )

            try:
                response = await client.get(path)
            except httpx.HTTPError:
                raise MediaKitAsrError(
                    "Failed to poll the MediaKit ASR task.",
                    detail="phase=poll; reason=transport_error",
                ) from None

            if response.status_code >= 300:
                raise MediaKitAsrError(
                    "MediaKit ASR task polling was rejected.",
                    detail=f"phase=poll; status_code={response.status_code}",
                )

            payload = self._json_or_error(response, phase="poll")
            status = payload.get("status")
            # #region debug-point C-D-E:poll-response
            exec("try:\n urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:7777/event',data=json.dumps({'sessionId':'mediakit-asr-failure','runId':'post-fix','hypothesisId':'C-D-E','location':'mediakit.py:_poll','msg':'[DEBUG] MediaKit poll response','data':{'http_status':response.status_code,'payload_keys':sorted(payload.keys()),'provider_status':str(status),'result_type':type(payload.get('result')).__name__,'provider_code':payload.get('code'),'provider_message':str(payload.get('message',''))[:200]},'ts':int(time.time()*1000)}).encode(),headers={'Content-Type':'application/json'}),timeout=0.2).read()\nexcept Exception:\n pass")
            # #endregion

            if status == "completed":
                result = payload.get("result")
                if not isinstance(result, dict):
                    raise MediaKitAsrError(
                        "MediaKit ASR completion response is missing a result.",
                        detail="phase=poll; status=completed; reason=missing_result",
                    )
                return result
            if status == "failed":
                raise MediaKitAsrError(
                    "MediaKit ASR task failed.",
                    detail="phase=poll; status=failed",
                )
            if status not in {"pending", "processing", "running"}:
                raise MediaKitAsrError(
                    "MediaKit ASR task returned an unexpected status.",
                    detail="phase=poll; reason=unexpected_status",
                )

    @staticmethod
    def _json_or_error(response: httpx.Response, *, phase: str) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError:
            raise MediaKitAsrError(
                "MediaKit ASR returned a non-JSON response.",
                detail=f"phase={phase}; reason=invalid_json",
            ) from None
        if not isinstance(payload, dict):
            raise MediaKitAsrError(
                "MediaKit ASR returned an unexpected response shape.",
                detail=f"phase={phase}; reason=unexpected_payload",
            )
        return payload

    @staticmethod
    def _parse_subtitles(result: dict[str, Any]) -> list[SubtitleSegment]:
        raw_items = result.get("subtitles")
        # #region debug-point D:parse-result
        exec("try:\n urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:7777/event',data=json.dumps({'sessionId':'mediakit-asr-failure','runId':'post-fix','hypothesisId':'D','location':'mediakit.py:_parse_subtitles','msg':'[DEBUG] MediaKit parse result','data':{'result_keys':sorted(result.keys()),'subtitles_type':type(raw_items).__name__,'subtitle_count':len(raw_items) if isinstance(raw_items,list) else None},'ts':int(time.time()*1000)}).encode(),headers={'Content-Type':'application/json'}),timeout=0.2).read()\nexcept Exception:\n pass")
        # #endregion
        if raw_items is None:
            return []
        if not isinstance(raw_items, list):
            raise MediaKitAsrError(
                "MediaKit ASR result subtitles are malformed.",
                detail="phase=parse; reason=subtitles_not_list",
            )

        segments: list[SubtitleSegment] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            if (
                "start_time" not in item
                or "end_time" not in item
                or "subtitle_text" not in item
            ):
                continue
            try:
                start_seconds = float(item["start_time"])
                end_seconds = float(item["end_time"])
            except (TypeError, ValueError):
                continue

            text = str(item["subtitle_text"]).strip()
            if not text:
                continue

            speaker_raw = item.get("speaker")
            speaker = speaker_raw if isinstance(speaker_raw, str) else None

            segments.append(
                SubtitleSegment(
                    start_seconds=start_seconds,
                    end_seconds=end_seconds,
                    text=text,
                    speaker=speaker,
                )
            )

        segments.sort(key=lambda segment: segment.start_seconds)
        return segments


class MockAsrSubtitleClient:
    """Deterministic in-memory ASR client used when no API key is set."""

    def __init__(self, segments: list[SubtitleSegment] | None = None) -> None:
        self._segments = segments

    async def transcribe(self, *, video_url: str) -> list[SubtitleSegment]:
        if self._segments is not None:
            return sorted(self._segments, key=lambda segment: segment.start_seconds)
        return [
            SubtitleSegment(
                start_seconds=0.5,
                end_seconds=2.8,
                text="欢迎观看本期产品介绍",
            ),
            SubtitleSegment(
                start_seconds=3.1,
                end_seconds=5.7,
                text="现在就来了解它的核心亮点",
            ),
        ]


def get_asr_subtitle_client(settings: Settings | None = None) -> AsrSubtitleClient:
    resolved = settings or get_settings()
    if resolved.mediakit_api_key is not None:
        return MediaKitAsrSubtitleClient(resolved)
    return MockAsrSubtitleClient()
