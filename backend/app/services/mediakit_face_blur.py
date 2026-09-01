from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
import re
from typing import Any
from urllib.parse import urlsplit

import httpx

from backend.app.core.config import Settings, get_settings

__all__ = [
    "FaceBlurTaskStatus",
    "FaceBlurVideoTask",
    "MediaKitFaceBlurError",
    "FaceBlurVideoClient",
]


class FaceBlurTaskStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass(frozen=True)
class FaceBlurVideoTask:
    """A normalized MediaKit face-blur task state."""

    task_id: str
    status: FaceBlurTaskStatus
    request_id: str | None = None
    output_video_url: str | None = None
    duration_seconds: float | None = None


class MediaKitFaceBlurError(RuntimeError):
    """A MediaKit face-blur failure with safe, redacted diagnostics."""

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.detail = detail


class FaceBlurVideoClient:
    """Isolated client for MediaKit's asynchronous face-blur video API."""

    _SUBMIT_PATH = "/api/v1/tools/face-blur-video"
    _TASK_PATH = "/api/v1/tasks/{task_id}"
    _SAFE_PROVIDER_VALUE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")

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

    async def submit(
        self,
        *,
        video_url: str,
        mask_mode: str,
        mask_strength: str,
    ) -> FaceBlurVideoTask:
        self._validate_video_url(video_url)
        if mask_mode not in {"mosaic", "blur"}:
            raise MediaKitFaceBlurError(
                "MediaKit face blur mask mode is invalid.",
                detail="phase=validate; reason=invalid_mask_mode",
            )
        if mask_strength not in {"low", "medium", "high"}:
            raise MediaKitFaceBlurError(
                "MediaKit face blur mask strength is invalid.",
                detail="phase=validate; reason=invalid_mask_strength",
            )

        async with self._client() as client:
            try:
                response = await client.post(
                    self._SUBMIT_PATH,
                    json={
                        "video_url": video_url,
                        "mask_mode": mask_mode,
                        "mask_strength": mask_strength,
                    },
                )
            except httpx.HTTPError:
                raise MediaKitFaceBlurError(
                    "Failed to submit the MediaKit face blur task.",
                    detail="phase=submit; reason=transport_error",
                ) from None

        if response.status_code >= 300:
            raise MediaKitFaceBlurError(
                "MediaKit face blur task submission was rejected.",
                detail=f"phase=submit; status_code={response.status_code}",
            )

        payload = self._json_or_error(response, phase="submit")
        if payload.get("success") is False:
            raise MediaKitFaceBlurError(
                "MediaKit face blur task submission was not accepted.",
                detail=self._provider_detail("submit", payload),
            )

        task_id = payload.get("task_id")
        if not isinstance(task_id, str) or not task_id.strip():
            raise MediaKitFaceBlurError(
                "MediaKit face blur submission response is missing a task id.",
                detail="phase=submit; reason=missing_task_id",
            )

        return FaceBlurVideoTask(
            task_id=task_id.strip(),
            status=FaceBlurTaskStatus.QUEUED,
            request_id=self._safe_provider_value(
                payload.get("request_id") or response.headers.get("x-request-id")
            ),
        )

    async def get_task(self, *, task_id: str) -> FaceBlurVideoTask:
        safe_task_id = self._require_task_id(task_id)
        async with self._client() as client:
            try:
                response = await client.get(
                    self._TASK_PATH.format(task_id=safe_task_id)
                )
            except httpx.HTTPError:
                raise MediaKitFaceBlurError(
                    "Failed to query the MediaKit face blur task.",
                    detail="phase=query; reason=transport_error",
                ) from None

        if response.status_code >= 300:
            raise MediaKitFaceBlurError(
                "MediaKit face blur task query was rejected.",
                detail=f"phase=query; status_code={response.status_code}",
            )

        payload = self._json_or_error(response, phase="query")
        if payload.get("success") is False:
            raise MediaKitFaceBlurError(
                "MediaKit face blur task query was not accepted.",
                detail=self._provider_detail("query", payload),
            )
        return self._parse_task(
            payload,
            task_id=safe_task_id,
            response_request_id=response.headers.get("x-request-id"),
        )

    def _client(self) -> httpx.AsyncClient:
        key = self.settings.mediakit_api_key.get_secret_value()
        return httpx.AsyncClient(
            base_url=self.settings.mediakit_base_url,
            timeout=httpx.Timeout(float(self.settings.mediakit_asr_timeout_seconds)),
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
    ) -> FaceBlurVideoTask:
        status = cls._parse_status(payload.get("status"))
        request_id = cls._safe_provider_value(
            payload.get("request_id") or response_request_id
        )
        if status is FaceBlurTaskStatus.FAILED:
            raise MediaKitFaceBlurError(
                "MediaKit face blur task failed.",
                detail=cls._provider_detail("query", payload, status="failed"),
            )

        result = payload.get("result")
        output_video_url: str | None = None
        duration_seconds: float | None = None
        if status is FaceBlurTaskStatus.SUCCEEDED:
            if not isinstance(result, dict):
                raise MediaKitFaceBlurError(
                    "MediaKit face blur completion response is missing a result.",
                    detail="phase=query; status=succeeded; reason=missing_result",
                )
            output_video_url = cls._parse_output_video_url(result)
            duration_seconds = cls._parse_duration_seconds(result)

        return FaceBlurVideoTask(
            task_id=task_id,
            status=status,
            request_id=request_id,
            output_video_url=output_video_url,
            duration_seconds=duration_seconds,
        )

    @staticmethod
    def _parse_status(value: object) -> FaceBlurTaskStatus:
        if not isinstance(value, str):
            raise MediaKitFaceBlurError(
                "MediaKit face blur task response is missing a status.",
                detail="phase=query; reason=missing_status",
            )
        normalized = value.strip().lower()
        if normalized in {"pending", "queued"}:
            return FaceBlurTaskStatus.QUEUED
        if normalized in {"processing", "running"}:
            return FaceBlurTaskStatus.RUNNING
        if normalized in {"completed", "succeeded", "success"}:
            return FaceBlurTaskStatus.SUCCEEDED
        if normalized in {"failed", "error", "cancelled", "canceled", "expired"}:
            return FaceBlurTaskStatus.FAILED
        raise MediaKitFaceBlurError(
            "MediaKit face blur task returned an unexpected status.",
            detail="phase=query; reason=unexpected_status",
        )

    @classmethod
    def _parse_output_video_url(cls, result: dict[str, Any]) -> str:
        value = result.get("video_url") or result.get("output_video_url")
        if not isinstance(value, str) or not cls._is_http_url(value):
            raise MediaKitFaceBlurError(
                "MediaKit face blur completion response is missing an output video URL.",
                detail="phase=query; status=succeeded; reason=missing_output_video_url",
            )
        return value

    @staticmethod
    def _parse_duration_seconds(result: dict[str, Any]) -> float | None:
        value = result.get("duration_seconds", result.get("duration"))
        if value is None:
            return None
        try:
            duration = float(value)
        except (TypeError, ValueError):
            return None
        return duration if duration >= 0 else None

    @staticmethod
    def _json_or_error(response: httpx.Response, *, phase: str) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError:
            raise MediaKitFaceBlurError(
                "MediaKit face blur returned a non-JSON response.",
                detail=f"phase={phase}; reason=invalid_json",
            ) from None
        if not isinstance(payload, dict):
            raise MediaKitFaceBlurError(
                "MediaKit face blur returned an unexpected response shape.",
                detail=f"phase={phase}; reason=unexpected_payload",
            )
        return payload

    @classmethod
    def _provider_detail(
        cls,
        phase: str,
        payload: dict[str, Any],
        *,
        status: str | None = None,
    ) -> str:
        parts = [f"phase={phase}"]
        if status is not None:
            parts.append(f"status={status}")
        for name in ("code", "request_id", "task_id"):
            value = cls._safe_provider_value(payload.get(name))
            if value:
                parts.append(f"{name}={value}")
        return "; ".join(parts)

    @classmethod
    def _safe_provider_value(cls, value: object) -> str | None:
        if isinstance(value, str) and cls._SAFE_PROVIDER_VALUE.fullmatch(value):
            return value
        return None

    @classmethod
    def _require_task_id(cls, task_id: str) -> str:
        if not cls._safe_provider_value(task_id):
            raise MediaKitFaceBlurError(
                "MediaKit face blur task id is invalid.",
                detail="phase=validate; reason=invalid_task_id",
            )
        return task_id

    @classmethod
    def _validate_video_url(cls, video_url: str) -> None:
        if not cls._is_http_url(video_url):
            raise MediaKitFaceBlurError(
                "MediaKit face blur requires an HTTP or HTTPS video URL.",
                detail="phase=validate; reason=invalid_video_url",
            )

    @staticmethod
    def _is_http_url(value: str) -> bool:
        parsed = urlsplit(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
