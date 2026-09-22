from __future__ import annotations

import asyncio
from collections.abc import Mapping
from copy import deepcopy
from dataclasses import dataclass
from enum import StrEnum
import hashlib
import math
import re
import time
from typing import Any, NoReturn
from urllib.parse import urlsplit

import httpx

from backend.app.core.config import Settings, get_settings

__all__ = [
    "MediaKitMultiTrackClient",
    "MediaKitMultiTrackError",
    "MultiTrackTask",
    "MultiTrackTaskStatus",
]

class MultiTrackTaskStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"


@dataclass(frozen=True)
class MultiTrackTask:
    """A normalized MediaKit multi-track task state."""

    task_id: str
    status: MultiTrackTaskStatus
    request_id: str | None = None
    output_video_url: str | None = None


class MediaKitMultiTrackError(RuntimeError):
    """A MediaKit multi-track failure with redacted diagnostics."""

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
        if self.provider_code is not None:
            parts.append(f"provider_code={self.provider_code}")
        if self.request_id is not None:
            parts.append(f"request_id={self.request_id}")
        if self.task_id is not None:
            parts.append(f"task_id={self.task_id}")
        return "; ".join(parts)


class MediaKitMultiTrackClient:
    """Isolated client for MediaKit's asynchronous multi-track edit API."""

    _SUBMIT_PATH = "/api/v1/tools/multi-track-edit"
    _TASK_PATH = "/api/v1/tasks/{task_id}"
    _SAFE_PROVIDER_VALUE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
    _TASK_TYPES = {"multi-track-edit", "multi_track_edit"}

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
        self.request_timeout_seconds = (
            float(request_timeout_seconds)
            if request_timeout_seconds is not None
            else float(self.settings.mediakit_multitrack_timeout_seconds)
        )
        if (
            not math.isfinite(self.request_timeout_seconds)
            or self.request_timeout_seconds <= 0
        ):
            self._raise_validation("invalid_request_timeout")

    @staticmethod
    def build_client_token(idempotency_key: str) -> str:
        if not isinstance(idempotency_key, str) or not idempotency_key:
            raise MediaKitMultiTrackError(
                "MediaKit multi-track idempotency key is invalid.",
                code="invalid_idempotency_key",
                phase="validate",
            )
        digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:40]
        return f"aigc-multitrack-{digest}"

    async def submit(
        self,
        *,
        project: Mapping[str, object],
        idempotency_key: str,
    ) -> MultiTrackTask:
        payload = self._normalize_submit_payload(
            project=project,
            idempotency_key=idempotency_key,
        )
        async with self._client() as client:
            response = await self._request(
                client,
                "POST",
                self._SUBMIT_PATH,
                phase="submit",
                json=payload,
            )
        response_payload = self._accepted_payload(response, phase="submit")
        task_id = self._safe_provider_value(response_payload.get("task_id"))
        if task_id is None:
            self._raise_response("submit", "missing_task_id")
        return MultiTrackTask(
            task_id=task_id,
            status=MultiTrackTaskStatus.QUEUED,
            request_id=self._request_id(response_payload, response),
        )

    async def get_task(self, *, task_id: str) -> MultiTrackTask:
        safe_task_id = self._require_task_id(task_id)
        async with self._client() as client:
            response = await self._request(
                client,
                "GET",
                self._TASK_PATH.format(task_id=safe_task_id),
                phase="poll",
            )
        payload = self._accepted_payload(response, phase="poll")
        response_task_id = payload.get("task_id")
        if response_task_id is not None:
            parsed_task_id = self._safe_provider_value(response_task_id)
            if parsed_task_id is None or parsed_task_id != safe_task_id:
                self._raise_response("poll", "task_id_mismatch")
        task_type = payload.get("task_type")
        if task_type is not None and task_type not in self._TASK_TYPES:
            self._raise_response("poll", "unexpected_task_type")
        return self._parse_task(
            payload,
            task_id=safe_task_id,
            request_id=self._request_id(payload, response),
        )

    async def poll(
        self,
        *,
        task_id: str,
        timeout_seconds: float | None = None,
        poll_interval_seconds: float | None = None,
    ) -> MultiTrackTask:
        timeout = (
            float(self.settings.mediakit_multitrack_timeout_seconds)
            if timeout_seconds is None
            else timeout_seconds
        )
        interval = (
            float(self.settings.mediakit_multitrack_poll_interval_seconds)
            if poll_interval_seconds is None
            else poll_interval_seconds
        )
        if not math.isfinite(timeout) or timeout < 0:
            self._raise_validation("invalid_poll_timeout")
        if not math.isfinite(interval) or interval < 0:
            self._raise_validation("invalid_poll_interval")

        deadline = time.monotonic() + timeout
        while True:
            task = await self.get_task(task_id=task_id)
            if task.status is MultiTrackTaskStatus.SUCCEEDED:
                return task
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise MediaKitMultiTrackError(
                    "MediaKit multi-track polling timed out.",
                    code="poll_timeout",
                    phase="poll",
                    task_id=self._safe_provider_value(task_id),
                )
            await asyncio.sleep(min(interval, remaining))

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

    async def _request(
        self,
        client: httpx.AsyncClient,
        method: str,
        path: str,
        *,
        phase: str,
        **kwargs: Any,
    ) -> httpx.Response:
        try:
            response = await client.request(method, path, **kwargs)
        except httpx.TimeoutException:
            raise MediaKitMultiTrackError(
                "MediaKit multi-track request timed out.",
                code="request_timeout",
                phase=phase,
            ) from None
        except httpx.HTTPError:
            raise MediaKitMultiTrackError(
                "MediaKit multi-track request failed.",
                code="network_error",
                phase=phase,
            ) from None
        if response.status_code >= 300:
            raise MediaKitMultiTrackError(
                "MediaKit multi-track request was rejected.",
                code="http_error",
                phase=phase,
                status_code=response.status_code,
            )
        return response

    @classmethod
    def _normalize_submit_payload(
        cls,
        *,
        project: Mapping[str, object],
        idempotency_key: str,
    ) -> dict[str, object]:
        if not isinstance(project, Mapping):
            cls._raise_validation("invalid_project")
        for name in ("canvas", "track", "output"):
            if name not in project:
                cls._raise_validation(f"missing_{name}")

        canvas = project["canvas"]
        track = project["track"]
        output = project["output"]
        if not isinstance(canvas, Mapping):
            cls._raise_validation("invalid_canvas")
        if not isinstance(track, list):
            cls._raise_validation("invalid_track")
        if not track:
            cls._raise_validation("empty_track")
        if any(not isinstance(row, list) for row in track):
            cls._raise_validation("invalid_track_row")
        if not isinstance(output, Mapping):
            cls._raise_validation("invalid_output")

        return {
            "canvas": deepcopy(dict(canvas)),
            "track": deepcopy(track),
            "output": deepcopy(dict(output)),
            "client_token": cls.build_client_token(idempotency_key),
        }

    @classmethod
    def _parse_task(
        cls,
        payload: dict[str, Any],
        *,
        task_id: str,
        request_id: str | None,
    ) -> MultiTrackTask:
        status = payload.get("status")
        if status in {"pending", "queued"}:
            return MultiTrackTask(
                task_id=task_id,
                status=MultiTrackTaskStatus.QUEUED,
                request_id=request_id,
            )
        if status in {"processing", "running"}:
            return MultiTrackTask(
                task_id=task_id,
                status=MultiTrackTaskStatus.RUNNING,
                request_id=request_id,
            )
        if status in {"failed", "error", "cancelled", "canceled", "expired"}:
            error = payload.get("error")
            provider_code = (
                cls._safe_provider_value(error.get("code"))
                if isinstance(error, dict)
                else cls._safe_provider_value(payload.get("code"))
            )
            raise MediaKitMultiTrackError(
                "MediaKit multi-track task failed.",
                code="provider_failed",
                phase="poll",
                provider_code=provider_code,
                request_id=request_id,
                task_id=task_id,
            )
        if status not in {"completed", "succeeded", "success"}:
            cls._raise_response("poll", "unknown_status")

        result = payload.get("result")
        if not isinstance(result, dict):
            cls._raise_response("poll", "missing_result")
        output_video_url = result.get("video_url")
        if not isinstance(output_video_url, str) or not cls._is_https_url(
            output_video_url
        ):
            cls._raise_response("poll", "invalid_output_video_url")
        return MultiTrackTask(
            task_id=task_id,
            status=MultiTrackTaskStatus.SUCCEEDED,
            request_id=request_id,
            output_video_url=output_video_url,
        )

    @classmethod
    def _accepted_payload(
        cls,
        response: httpx.Response,
        *,
        phase: str,
    ) -> dict[str, Any]:
        try:
            payload = response.json()
        except ValueError:
            cls._raise_response(phase, "invalid_json")
        if not isinstance(payload, dict):
            cls._raise_response(phase, "invalid_payload")
        if payload.get("success") is not True:
            error = payload.get("error")
            provider_code = (
                cls._safe_provider_value(error.get("code"))
                if isinstance(error, dict)
                else cls._safe_provider_value(payload.get("code"))
            )
            raise MediaKitMultiTrackError(
                "MediaKit multi-track request was not accepted.",
                code="provider_rejected",
                phase=phase,
                provider_code=provider_code,
                request_id=cls._safe_provider_value(payload.get("request_id")),
                task_id=cls._safe_provider_value(payload.get("task_id")),
            )
        return payload

    @classmethod
    def _request_id(
        cls,
        payload: dict[str, Any],
        response: httpx.Response,
    ) -> str | None:
        return cls._safe_provider_value(
            payload.get("request_id") or response.headers.get("x-request-id")
        )

    @classmethod
    def _require_task_id(cls, task_id: str) -> str:
        safe_task_id = cls._safe_provider_value(task_id)
        if safe_task_id is None:
            cls._raise_validation("invalid_task_id")
        return safe_task_id

    @classmethod
    def _safe_provider_value(cls, value: object) -> str | None:
        if isinstance(value, str) and cls._SAFE_PROVIDER_VALUE.fullmatch(value):
            return value
        return None

    @staticmethod
    def _is_https_url(value: str) -> bool:
        parsed = urlsplit(value)
        return parsed.scheme == "https" and bool(parsed.netloc)

    @staticmethod
    def _raise_validation(code: str) -> NoReturn:
        raise MediaKitMultiTrackError(
            "MediaKit multi-track parameters are invalid.",
            code=code,
            phase="validate",
        )

    @staticmethod
    def _raise_response(phase: str, code: str) -> NoReturn:
        raise MediaKitMultiTrackError(
            "MediaKit multi-track returned an invalid response.",
            code=code,
            phase=phase,
        )
