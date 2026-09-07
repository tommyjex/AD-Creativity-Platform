from __future__ import annotations

import asyncio
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
    "MediaKitVideoEnhancementClient",
    "MediaKitVideoEnhancementError",
    "VideoEnhancementTask",
    "VideoEnhancementTaskStatus",
]


class VideoEnhancementTaskStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"


@dataclass(frozen=True)
class VideoEnhancementTask:
    task_id: str
    status: VideoEnhancementTaskStatus
    request_id: str | None = None
    output_video_url: str | None = None
    duration_seconds: float | None = None
    fps: float | None = None
    resolution: str | None = None
    tool_version: str | None = None


class MediaKitVideoEnhancementError(RuntimeError):
    """A MediaKit failure containing only safe, structured diagnostics."""

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


class MediaKitVideoEnhancementClient:
    """Isolated client for MediaKit's asynchronous video enhancement API."""

    _SUBMIT_PATH = "/api/v1/tools/enhance-video"
    _TASK_PATH = "/api/v1/tasks/{task_id}"
    _SAFE_PROVIDER_VALUE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
    _TOOL_VERSIONS = {"standard", "professional"}
    _SCENES = {"common", "ugc", "short_series", "aigc", "old_film"}
    _ENHANCE_STYLES = {"hd", "natural"}
    _RESOLUTIONS = {
        "240p",
        "360p",
        "480p",
        "540p",
        "720p",
        "1080p",
        "2k",
        "4k",
        "8k",
    }
    _BITRATE_LEVELS = {"low", "medium", "high"}
    _BIT_DEPTHS = {8, 10, 12, 16}

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
            else float(self.settings.mediakit_video_enhancement_timeout_seconds)
        )
        if not math.isfinite(self.request_timeout_seconds) or (
            self.request_timeout_seconds <= 0
        ):
            self._raise_validation("invalid_request_timeout")

    @staticmethod
    def build_client_token(idempotency_key: str) -> str:
        if not isinstance(idempotency_key, str) or not idempotency_key:
            raise MediaKitVideoEnhancementError(
                "MediaKit video enhancement idempotency key is invalid.",
                code="invalid_idempotency_key",
                phase="validate",
            )
        digest = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()[:40]
        return f"aigc-video-enhancement-{digest}"

    async def submit(
        self,
        *,
        video_url: str,
        idempotency_key: str,
        tool_version: str = "standard",
        scene: str | None = "aigc",
        enhance_style: str = "hd",
        resolution: str | None = "1080p",
        resolution_limit: int | None = None,
        fps: int | float | None = None,
        bitrate_level: str | None = "medium",
        bitrate: int | None = None,
        bit_depth: int = 8,
    ) -> VideoEnhancementTask:
        payload = self._normalize_submit_payload(
            video_url=video_url,
            idempotency_key=idempotency_key,
            tool_version=tool_version,
            scene=scene,
            enhance_style=enhance_style,
            resolution=resolution,
            resolution_limit=resolution_limit,
            fps=fps,
            bitrate_level=bitrate_level,
            bitrate=bitrate,
            bit_depth=bit_depth,
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
        return VideoEnhancementTask(
            task_id=task_id,
            status=VideoEnhancementTaskStatus.QUEUED,
            request_id=self._request_id(response_payload, response),
        )

    async def get_task(self, *, task_id: str) -> VideoEnhancementTask:
        safe_task_id = self._require_task_id(task_id)
        async with self._client() as client:
            response = await self._request(
                client,
                "GET",
                self._TASK_PATH.format(task_id=safe_task_id),
                phase="query",
            )
        payload = self._accepted_payload(response, phase="query")
        response_task_id = payload.get("task_id")
        if response_task_id is not None:
            parsed_task_id = self._safe_provider_value(response_task_id)
            if parsed_task_id is None or parsed_task_id != safe_task_id:
                self._raise_response("query", "task_id_mismatch")
        task_type = payload.get("task_type")
        if task_type is not None and task_type != "enhance-video":
            self._raise_response("query", "unexpected_task_type")
        return self._parse_task(
            payload,
            task_id=safe_task_id,
            request_id=self._request_id(payload, response),
        )

    async def poll(
        self,
        *,
        task_id: str,
        timeout_seconds: float,
        poll_interval_seconds: float = 3,
    ) -> VideoEnhancementTask:
        if not math.isfinite(timeout_seconds) or timeout_seconds < 0:
            self._raise_validation("invalid_poll_timeout")
        if (
            not math.isfinite(poll_interval_seconds)
            or poll_interval_seconds < 0
        ):
            self._raise_validation("invalid_poll_interval")

        deadline = time.monotonic() + timeout_seconds
        while True:
            task = await self.get_task(task_id=task_id)
            if task.status is VideoEnhancementTaskStatus.SUCCEEDED:
                return task
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise MediaKitVideoEnhancementError(
                    "MediaKit video enhancement polling timed out.",
                    code="poll_timeout",
                    phase="poll",
                    task_id=self._safe_provider_value(task_id),
                )
            await asyncio.sleep(min(poll_interval_seconds, remaining))

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
            raise MediaKitVideoEnhancementError(
                "MediaKit video enhancement request timed out.",
                code="request_timeout",
                phase=phase,
            ) from None
        except httpx.HTTPError:
            raise MediaKitVideoEnhancementError(
                "MediaKit video enhancement request failed.",
                code="network_error",
                phase=phase,
            ) from None
        if response.status_code >= 300:
            raise MediaKitVideoEnhancementError(
                "MediaKit video enhancement request was rejected.",
                code="http_error",
                phase=phase,
                status_code=response.status_code,
            )
        return response

    def _normalize_submit_payload(
        self,
        *,
        video_url: str,
        idempotency_key: str,
        tool_version: str,
        scene: str | None,
        enhance_style: str,
        resolution: str | None,
        resolution_limit: int | None,
        fps: int | float | None,
        bitrate_level: str | None,
        bitrate: int | None,
        bit_depth: int,
    ) -> dict[str, object]:
        if not self._is_http_url(video_url):
            self._raise_validation("invalid_video_url")
        self._require_choice(tool_version, self._TOOL_VERSIONS, "tool_version")
        self._require_choice(enhance_style, self._ENHANCE_STYLES, "enhance_style")
        if resolution_limit is None:
            self._require_choice(resolution, self._RESOLUTIONS, "resolution")
        elif not self._is_int_in_range(resolution_limit, 128, 4320):
            self._raise_validation("invalid_resolution_limit")
        if fps is not None and (
            isinstance(fps, bool)
            or not isinstance(fps, (int, float))
            or not math.isfinite(float(fps))
            or not 15 <= float(fps) <= 120
        ):
            self._raise_validation("invalid_fps")
        if bitrate is not None and not self._is_int_in_range(
            bitrate, 10, 150000
        ):
            self._raise_validation("invalid_bitrate")
        if bit_depth not in self._BIT_DEPTHS or isinstance(bit_depth, bool):
            self._raise_validation("invalid_bit_depth")

        payload: dict[str, object] = {
            "video_url": video_url,
            "tool_version": tool_version,
            "enhance_style": enhance_style,
            "client_token": self.build_client_token(idempotency_key),
        }
        if resolution_limit is None:
            assert resolution is not None
            payload["resolution"] = resolution
        else:
            payload["resolution_limit"] = resolution_limit
        if fps is not None:
            payload["fps"] = fps

        if tool_version == "standard":
            self._require_choice(scene, self._SCENES, "scene")
            if bit_depth != 8:
                self._raise_validation("bit_depth_requires_professional")
            assert scene is not None
            payload["scene"] = scene
        else:
            payload["bit_depth"] = bit_depth

        if bit_depth != 16:
            if bitrate is not None:
                payload["bitrate"] = bitrate
            else:
                self._require_choice(
                    bitrate_level, self._BITRATE_LEVELS, "bitrate_level"
                )
                assert bitrate_level is not None
                payload["bitrate_level"] = bitrate_level
        return payload

    @classmethod
    def _parse_task(
        cls,
        payload: dict[str, Any],
        *,
        task_id: str,
        request_id: str | None,
    ) -> VideoEnhancementTask:
        status = payload.get("status")
        if status == "running":
            return VideoEnhancementTask(
                task_id=task_id,
                status=VideoEnhancementTaskStatus.RUNNING,
                request_id=request_id,
            )
        if status == "failed":
            error = payload.get("error")
            provider_code = (
                cls._safe_provider_value(error.get("code"))
                if isinstance(error, dict)
                else None
            )
            raise MediaKitVideoEnhancementError(
                "MediaKit video enhancement task failed.",
                code="provider_failed",
                phase="query",
                provider_code=provider_code,
                request_id=request_id,
                task_id=task_id,
            )
        if status != "completed":
            cls._raise_response("query", "unknown_status")

        result = payload.get("result")
        if not isinstance(result, dict):
            cls._raise_response("query", "missing_result")
        output_video_url = result.get("video_url")
        if not isinstance(output_video_url, str) or not cls._is_https_url(
            output_video_url
        ):
            cls._raise_response("query", "invalid_output_video_url")
        duration = cls._optional_number(
            result.get("duration"), field="duration", minimum=0
        )
        fps = cls._optional_number(result.get("fps"), field="fps", minimum=0)
        resolution = cls._optional_result_string(
            result.get("resolution"), field="resolution"
        )
        tool_version = result.get("tool_version")
        if tool_version is not None and tool_version not in cls._TOOL_VERSIONS:
            cls._raise_response("query", "invalid_tool_version")
        return VideoEnhancementTask(
            task_id=task_id,
            status=VideoEnhancementTaskStatus.SUCCEEDED,
            request_id=request_id,
            output_video_url=output_video_url,
            duration_seconds=duration,
            fps=fps,
            resolution=resolution,
            tool_version=tool_version,
        )

    @classmethod
    def _accepted_payload(
        cls, response: httpx.Response, *, phase: str
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
                else None
            )
            raise MediaKitVideoEnhancementError(
                "MediaKit video enhancement request was not accepted.",
                code="provider_rejected",
                phase=phase,
                provider_code=provider_code,
                request_id=cls._safe_provider_value(payload.get("request_id")),
                task_id=cls._safe_provider_value(payload.get("task_id")),
            )
        return payload

    @classmethod
    def _request_id(
        cls, payload: dict[str, Any], response: httpx.Response
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
    def _require_choice(
        cls, value: object, allowed: set[object], field: str
    ) -> None:
        if value not in allowed:
            cls._raise_validation(f"invalid_{field}")

    @staticmethod
    def _is_int_in_range(value: object, minimum: int, maximum: int) -> bool:
        return (
            isinstance(value, int)
            and not isinstance(value, bool)
            and minimum <= value <= maximum
        )

    @classmethod
    def _optional_number(
        cls, value: object, *, field: str, minimum: float
    ) -> float | None:
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            cls._raise_response("query", f"invalid_{field}")
        parsed = float(value)
        if not math.isfinite(parsed) or parsed < minimum:
            cls._raise_response("query", f"invalid_{field}")
        return parsed

    @classmethod
    def _optional_result_string(
        cls, value: object, *, field: str
    ) -> str | None:
        if value is None:
            return None
        if (
            not isinstance(value, str)
            or not value
            or len(value) > 64
            or not value.isascii()
            or not value.isprintable()
        ):
            cls._raise_response("query", f"invalid_{field}")
        return value

    @classmethod
    def _safe_provider_value(cls, value: object) -> str | None:
        if isinstance(value, str) and cls._SAFE_PROVIDER_VALUE.fullmatch(value):
            return value
        return None

    @staticmethod
    def _is_http_url(value: object) -> bool:
        if not isinstance(value, str):
            return False
        parsed = urlsplit(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)

    @staticmethod
    def _is_https_url(value: str) -> bool:
        parsed = urlsplit(value)
        return parsed.scheme == "https" and bool(parsed.netloc)

    @staticmethod
    def _raise_validation(code: str) -> NoReturn:
        raise MediaKitVideoEnhancementError(
            "MediaKit video enhancement parameters are invalid.",
            code=code,
            phase="validate",
        )

    @staticmethod
    def _raise_response(phase: str, code: str) -> NoReturn:
        raise MediaKitVideoEnhancementError(
            "MediaKit video enhancement returned an invalid response.",
            code=code,
            phase=phase,
        )
