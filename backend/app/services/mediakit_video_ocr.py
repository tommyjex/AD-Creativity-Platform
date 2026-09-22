from __future__ import annotations

import asyncio
from dataclasses import dataclass
from enum import StrEnum
import math
import re
import time
from typing import Any
from urllib.parse import urlsplit

import httpx

from backend.app.core.config import Settings, get_settings
from backend.app.services.mediakit import SubtitleSegment

__all__ = [
    "MediaKitVideoOcrClient",
    "MediaKitVideoOcrError",
    "VideoOcrTask",
    "VideoOcrTaskStatus",
]


class VideoOcrTaskStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"


@dataclass(frozen=True)
class VideoOcrTask:
    task_id: str
    status: VideoOcrTaskStatus
    request_id: str | None = None
    duration_seconds: float | None = None
    segments: tuple[SubtitleSegment, ...] = ()
    discarded_segment_count: int = 0


class MediaKitVideoOcrError(RuntimeError):
    """MediaKit OCR failure containing only safe diagnostics."""

    def __init__(
        self,
        message: str,
        *,
        code: str,
        phase: str,
        provider_code: str | None = None,
        request_id: str | None = None,
        task_id: str | None = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.phase = phase
        self.provider_code = provider_code
        self.request_id = request_id
        self.task_id = task_id
        self.status_code = status_code

    @property
    def detail(self) -> str:
        parts = [f"phase={self.phase}", f"reason={self.code}"]
        if self.status_code is not None:
            parts.append(f"status_code={self.status_code}")
        if self.provider_code:
            parts.append(f"provider_code={self.provider_code}")
        if self.request_id:
            parts.append(f"request_id={self.request_id}")
        if self.task_id:
            parts.append(f"task_id={self.task_id}")
        return "; ".join(parts)


class MediaKitVideoOcrClient:
    _SUBMIT_PATH = "/api/v1/tools/video-ocr"
    _TASK_PATH = "/api/v1/tasks/{task_id}"
    _SAFE_PROVIDER_VALUE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        request_timeout_seconds: float | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.settings.require_mediakit_config()
        assert self.settings.mediakit_api_key is not None
        self.transport = transport
        self.request_timeout_seconds = float(
            request_timeout_seconds
            if request_timeout_seconds is not None
            else self.settings.mediakit_video_ocr_timeout_seconds
        )
        if (
            not math.isfinite(self.request_timeout_seconds)
            or self.request_timeout_seconds <= 0
        ):
            raise ValueError("request_timeout_seconds must be positive")

    async def submit(
        self,
        *,
        video_url: str,
        mode: str = "Subtitle",
        client_token: str,
    ) -> VideoOcrTask:
        self._validate_video_url(video_url)
        if mode != "Subtitle":
            raise MediaKitVideoOcrError(
                "MediaKit video OCR mode is invalid.",
                code="invalid_mode",
                phase="validate",
            )
        self._validate_client_token(client_token)
        async with self._client() as client:
            try:
                response = await client.post(
                    self._SUBMIT_PATH,
                    json={
                        "video_url": video_url,
                        "mode": mode,
                        "client_token": client_token,
                    },
                )
            except httpx.HTTPError:
                raise MediaKitVideoOcrError(
                    "Failed to submit the MediaKit video OCR task.",
                    code="network_error",
                    phase="submit",
                ) from None
        payload = self._response_payload(response, phase="submit")
        if payload.get("success") is False:
            raise self._provider_error(
                "MediaKit video OCR task submission was rejected.",
                payload,
                phase="submit",
                status_code=response.status_code,
            )
        task_id = self._safe_provider_value(payload.get("task_id"))
        if task_id is None:
            raise MediaKitVideoOcrError(
                "MediaKit video OCR submission response is missing a task id.",
                code="missing_task_id",
                phase="submit",
                status_code=response.status_code,
            )
        return VideoOcrTask(
            task_id=task_id,
            status=VideoOcrTaskStatus.QUEUED,
            request_id=self._safe_provider_value(
                payload.get("request_id") or response.headers.get("x-request-id")
            ),
        )

    async def get_task(self, *, task_id: str) -> VideoOcrTask:
        safe_task_id = self._require_task_id(task_id)
        async with self._client() as client:
            try:
                response = await client.get(
                    self._TASK_PATH.format(task_id=safe_task_id)
                )
            except httpx.HTTPError:
                raise MediaKitVideoOcrError(
                    "Failed to query the MediaKit video OCR task.",
                    code="network_error",
                    phase="query",
                    task_id=safe_task_id,
                ) from None
        payload = self._response_payload(response, phase="query")
        if payload.get("success") is False:
            raise self._provider_error(
                "MediaKit video OCR task query was rejected.",
                payload,
                phase="query",
                status_code=response.status_code,
                task_id=safe_task_id,
            )
        return self._parse_task(
            payload,
            task_id=safe_task_id,
            response_request_id=response.headers.get("x-request-id"),
        )

    async def poll(
        self,
        *,
        task_id: str,
        timeout_seconds: float,
        poll_interval_seconds: float,
    ) -> VideoOcrTask:
        if timeout_seconds <= 0 or poll_interval_seconds <= 0:
            raise ValueError("poll timeout and interval must be positive")
        deadline = time.monotonic() + timeout_seconds
        while True:
            task = await self.get_task(task_id=task_id)
            if task.status is VideoOcrTaskStatus.SUCCEEDED:
                return task
            if time.monotonic() >= deadline:
                raise MediaKitVideoOcrError(
                    "MediaKit video OCR polling timed out.",
                    code="poll_timeout",
                    phase="poll",
                    task_id=task_id,
                )
            await asyncio.sleep(poll_interval_seconds)

    def _client(self) -> httpx.AsyncClient:
        key = self.settings.mediakit_api_key.get_secret_value()
        return httpx.AsyncClient(
            base_url=self.settings.mediakit_base_url,
            timeout=httpx.Timeout(self.request_timeout_seconds),
            transport=self.transport,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
        )

    @classmethod
    def _parse_task(
        cls,
        payload: dict[str, Any],
        *,
        task_id: str,
        response_request_id: str | None,
    ) -> VideoOcrTask:
        status = cls._parse_status(payload.get("status"))
        request_id = cls._safe_provider_value(
            payload.get("request_id") or response_request_id
        )
        if status is not VideoOcrTaskStatus.SUCCEEDED:
            return VideoOcrTask(
                task_id=task_id,
                status=status,
                request_id=request_id,
            )
        result = payload.get("result")
        if not isinstance(result, dict):
            raise MediaKitVideoOcrError(
                "MediaKit video OCR completion response is missing a result.",
                code="missing_result",
                phase="parse",
                task_id=task_id,
                request_id=request_id,
            )
        raw_subtitles = result.get("subtitles")
        if not isinstance(raw_subtitles, list):
            raise MediaKitVideoOcrError(
                "MediaKit video OCR result subtitles are malformed.",
                code="subtitles_not_list",
                phase="parse",
                task_id=task_id,
                request_id=request_id,
            )
        indexed_segments: list[tuple[int, SubtitleSegment]] = []
        discarded = 0
        for index, item in enumerate(raw_subtitles):
            segment = cls._parse_segment(item)
            if segment is None:
                discarded += 1
            else:
                indexed_segments.append((index, segment))
        indexed_segments.sort(
            key=lambda entry: (
                entry[1].start_seconds,
                entry[1].end_seconds,
                entry[0],
            )
        )
        duration = cls._finite_nonnegative(result.get("duration"))
        return VideoOcrTask(
            task_id=task_id,
            status=status,
            request_id=request_id,
            duration_seconds=duration,
            segments=tuple(segment for _, segment in indexed_segments),
            discarded_segment_count=discarded,
        )

    @staticmethod
    def _parse_segment(value: object) -> SubtitleSegment | None:
        if not isinstance(value, dict):
            return None
        text = value.get("subtitle_text")
        if not isinstance(text, str) or not text.strip():
            return None
        start = MediaKitVideoOcrClient._finite_nonnegative(
            value.get("start_time")
        )
        end = MediaKitVideoOcrClient._finite_nonnegative(value.get("end_time"))
        if start is None or end is None or end < start:
            return None
        return SubtitleSegment(
            start_seconds=start,
            end_seconds=end,
            text=" ".join(text.split()),
        )

    @classmethod
    def _parse_status(cls, value: object) -> VideoOcrTaskStatus:
        if not isinstance(value, str):
            raise MediaKitVideoOcrError(
                "MediaKit video OCR task response is missing a status.",
                code="missing_status",
                phase="query",
            )
        normalized = value.strip().lower()
        if normalized in {"pending", "queued"}:
            return VideoOcrTaskStatus.QUEUED
        if normalized in {"processing", "running"}:
            return VideoOcrTaskStatus.RUNNING
        if normalized in {"completed", "succeeded", "success"}:
            return VideoOcrTaskStatus.SUCCEEDED
        if normalized in {
            "failed",
            "error",
            "cancelled",
            "canceled",
            "expired",
        }:
            raise MediaKitVideoOcrError(
                "MediaKit video OCR task failed.",
                code="provider_failed",
                phase="query",
            )
        raise MediaKitVideoOcrError(
            "MediaKit video OCR task returned an unexpected status.",
            code="unexpected_status",
            phase="query",
        )

    @classmethod
    def _response_payload(
        cls,
        response: httpx.Response,
        *,
        phase: str,
    ) -> dict[str, Any]:
        if response.status_code >= 300:
            raise MediaKitVideoOcrError(
                "MediaKit video OCR request was rejected.",
                code="http_error",
                phase=phase,
                status_code=response.status_code,
            )
        try:
            payload = response.json()
        except ValueError:
            raise MediaKitVideoOcrError(
                "MediaKit video OCR returned a non-JSON response.",
                code="invalid_json",
                phase=phase,
                status_code=response.status_code,
            ) from None
        if not isinstance(payload, dict):
            raise MediaKitVideoOcrError(
                "MediaKit video OCR returned an unexpected response shape.",
                code="unexpected_payload",
                phase=phase,
                status_code=response.status_code,
            )
        return payload

    @classmethod
    def _provider_error(
        cls,
        message: str,
        payload: dict[str, Any],
        *,
        phase: str,
        status_code: int,
        task_id: str | None = None,
    ) -> MediaKitVideoOcrError:
        raw_error = payload.get("error")
        provider_code = (
            cls._safe_provider_value(raw_error.get("code"))
            if isinstance(raw_error, dict)
            else None
        )
        return MediaKitVideoOcrError(
            message,
            code="provider_rejected",
            phase=phase,
            provider_code=provider_code,
            request_id=cls._safe_provider_value(payload.get("request_id")),
            task_id=task_id,
            status_code=status_code,
        )

    @classmethod
    def _require_task_id(cls, value: str) -> str:
        task_id = cls._safe_provider_value(value)
        if task_id is None:
            raise MediaKitVideoOcrError(
                "MediaKit video OCR task id is invalid.",
                code="invalid_task_id",
                phase="validate",
            )
        return task_id

    @classmethod
    def _safe_provider_value(cls, value: object) -> str | None:
        if isinstance(value, str) and cls._SAFE_PROVIDER_VALUE.fullmatch(value):
            return value
        return None

    @staticmethod
    def _finite_nonnegative(value: object) -> float | None:
        if isinstance(value, bool):
            return None
        try:
            number = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
        return number if math.isfinite(number) and number >= 0 else None

    @staticmethod
    def _validate_video_url(value: str) -> None:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise MediaKitVideoOcrError(
                "MediaKit video OCR requires an HTTP or HTTPS video URL.",
                code="invalid_video_url",
                phase="validate",
            )

    @staticmethod
    def _validate_client_token(value: str) -> None:
        if (
            not isinstance(value, str)
            or not 1 <= len(value) <= 64
            or any(not 0x20 <= ord(character) <= 0x7E for character in value)
        ):
            raise MediaKitVideoOcrError(
                "MediaKit video OCR client token is invalid.",
                code="invalid_client_token",
                phase="validate",
            )
