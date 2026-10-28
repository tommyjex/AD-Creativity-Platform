from __future__ import annotations

import asyncio
import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from pathlib import Path
from time import monotonic
from typing import Any

from pydantic import Field, ValidationError

from ..core.config import Settings, get_settings
from ..schemas.common import SchemaModel
from ..schemas.video_subtitle_grounding import (
    VIDEO_SUBTITLE_GROUNDING_BACKGROUND_COLOR_PATTERN,
    VIDEO_SUBTITLE_GROUNDING_MAX_SEGMENTS,
    VIDEO_SUBTITLE_GROUNDING_MAX_TEXT_LENGTH,
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
    VideoSubtitleGroundingUsage,
)

VIDEO_SUBTITLE_GROUNDING_PROMPT = (
    "逐帧检查整个视频画面，穷举识别所有后期叠加或用于解释画面内容的可见文字，"
    "并返回每段文字连续可见的时间区间和位置。目标文字包括对话字幕、标题、说明文字、"
    "产品名称、功能卖点，以及放置在产品、部件或物体附近的标注标签。文字可能同时出现"
    "在画面顶部、底部、四角、中央或任意物体附近；同一画面存在多个产品或部件标签时，"
    "必须逐个提取，每个独立文字区域分别返回一条结果及其自身的 bbox，不得只返回最显眼"
    "或最接近传统底部字幕的文字。不要根据音轨补全或转写内容，也不要把品牌 Logo、"
    "水印、商品包装上的印刷文字、界面按钮、装饰性角标或无关场景文字识别为目标文字。"
    "当文字用于指向、命名或解释画面中的产品或部件时，即使不在底部，也属于目标文字。"
    "如果一个字幕或说明文字在画面中分成两行或多行显示，必须严格按视觉行拆分，每一行"
    "分别输出为一条独立字幕；各行可以使用相同的 start_ms 和 end_ms，但必须使用对应"
    "单行文字区域的独立 bbox，禁止将多行文字合并到同一个 text 字段，也禁止在 text "
    "字段中使用换行符。"
    "文字内容变化、位置明显变化或中间不可见时拆分为不同片段。没有目标文字时返回空"
    " subtitles 数组。"
    "每条字幕必须包含 text、整数毫秒 start_ms、整数毫秒 end_ms 和 bbox。"
    "bbox 必须使用完整字符串 <bbox>x_min y_min x_max y_max</bbox>，四个坐标"
    "是基于 1000x1000 比例空间的 0 到 999 整数，以单个空格分隔。"
    "不得因为文字较小而忽略符合目标定义的小号说明或脚注。"
    "每条字幕还必须输出 visual_role、font_height_ratio、alignment、block_id 和 "
    "line_index。visual_role 根据相对视觉字号只能是 headline、body 或 footnote；"
    "font_height_ratio 是可见字形高度除以视频展示高度且大于 0、不超过 1 的浮点数；"
    "alignment "
    "只能是 left、center 或 right。同一视觉文字块共享 block_id，多行按从上到下"
    "顺序设置从 0 开始的 line_index。无法可靠判断的样式值使用 null，不得猜测固定"
    "字号。"
    "每条字幕还必须输出 background_color，使用 #RRGGBB 六位十六进制颜色字符串"
    "或 null，表示该文字区域背后的代表性画面颜色；估计时排除文字字形和描边。"
    "它不是文字颜色，也不是待绘制的字幕底板颜色。同一片段背景变化时取代表值，"
    "复杂或无法可靠估计时返回 null，不强行伪造颜色。"
    "最多返回 500 条。严格按 JSON Schema 输出，不要输出 Markdown、解释或额外字段。"
)

_BBOX_JSON_PATTERN = r"^<bbox>[0-9]{1,3} [0-9]{1,3} [0-9]{1,3} [0-9]{1,3}</bbox>$"
VIDEO_SUBTITLE_GROUNDING_JSON_SCHEMA = {
    "type": "json_schema",
    "name": "video_subtitle_grounding",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "subtitles": {
                "type": "array",
                "maxItems": VIDEO_SUBTITLE_GROUNDING_MAX_SEGMENTS,
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": VIDEO_SUBTITLE_GROUNDING_MAX_TEXT_LENGTH,
                        },
                        "start_ms": {"type": "integer", "minimum": 0},
                        "end_ms": {"type": "integer", "minimum": 1},
                        "bbox": {
                            "type": "string",
                            "pattern": _BBOX_JSON_PATTERN,
                        },
                        "visual_role": {
                            "anyOf": [
                                {
                                    "type": "string",
                                    "enum": ["headline", "body", "footnote"],
                                },
                                {"type": "null"},
                            ]
                        },
                        "font_height_ratio": {
                            "anyOf": [
                                {
                                    "type": "number",
                                    "exclusiveMinimum": 0,
                                    "maximum": 1,
                                },
                                {"type": "null"},
                            ]
                        },
                        "alignment": {
                            "anyOf": [
                                {
                                    "type": "string",
                                    "enum": ["left", "center", "right"],
                                },
                                {"type": "null"},
                            ]
                        },
                        "block_id": {
                            "anyOf": [
                                {
                                    "type": "string",
                                    "minLength": 1,
                                    "maxLength": 64,
                                    "pattern": "^[A-Za-z0-9_-]+$",
                                },
                                {"type": "null"},
                            ]
                        },
                        "line_index": {
                            "anyOf": [
                                {"type": "integer", "minimum": 0},
                                {"type": "null"},
                            ]
                        },
                        "background_color": {
                            "anyOf": [
                                {
                                    "type": "string",
                                    "pattern": VIDEO_SUBTITLE_GROUNDING_BACKGROUND_COLOR_PATTERN,
                                },
                                {"type": "null"},
                            ]
                        },
                    },
                    "required": [
                        "text",
                        "start_ms",
                        "end_ms",
                        "bbox",
                        "visual_role",
                        "font_height_ratio",
                        "alignment",
                        "block_id",
                        "line_index",
                        "background_color",
                    ],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["subtitles"],
        "additionalProperties": False,
    },
}

_SAFE_PROVIDER_VALUE = re.compile(r"^[A-Za-z0-9._:/-]{1,200}$")
_REQUEST_ID_HEADERS = ("x-request-id", "x-tt-logid", "x-tt-trace-id")


class _SubtitlePayload(SchemaModel):
    text: object | None = None
    start_ms: object | None = None
    end_ms: object | None = None
    bbox: object | None = None
    visual_role: object | None = None
    font_height_ratio: object | None = None
    alignment: object | None = None
    block_id: object | None = None
    line_index: object | None = None
    background_color: object | None = None


class _ResponsePayload(SchemaModel):
    subtitles: list[_SubtitlePayload] = Field(
        max_length=VIDEO_SUBTITLE_GROUNDING_MAX_SEGMENTS
    )


@dataclass(frozen=True)
class ModelArkSubtitleGroundingSegment:
    text: object | None
    start_ms: object | None
    end_ms: object | None
    bbox: object | None
    visual_role: object | None = None
    font_height_ratio: object | None = None
    alignment: object | None = None
    block_id: object | None = None
    line_index: object | None = None
    background_color: object | None = None


@dataclass(frozen=True)
class ModelArkVideoSubtitleGroundingResult:
    model: str
    subtitles: tuple[ModelArkSubtitleGroundingSegment, ...]
    usage: VideoSubtitleGroundingUsage
    request_id: str | None
    raw_output: str | None = None
    cleanup_error: VideoSubtitleGroundingProviderError | None = None


class VideoSubtitleGroundingProviderError(RuntimeError):
    """A stage-specific Provider error that contains only safe metadata."""

    def __init__(
        self,
        message: str,
        *,
        code: VideoSubtitleGroundingErrorCode,
        phase: VideoSubtitleGroundingErrorPhase,
        provider_code: str | None = None,
        request_id: str | None = None,
        raw_output: str | None = None,
        cleanup_error: VideoSubtitleGroundingProviderError | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.phase = phase
        self.provider_code = _safe_provider_value(provider_code)
        self.request_id = _safe_provider_value(request_id)
        self.raw_output = raw_output
        self.cleanup_error = cleanup_error


class ModelArkVideoSubtitleGroundingAdapter:
    """Isolated Files/Responses adapter for the subtitle grounding experiment."""

    def __init__(
        self,
        settings: Settings | None = None,
        *,
        client: Any | None = None,
        poll_interval_seconds: float = 0.5,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        if client is None:
            self.settings.require_modelark_config()
            from byteplussdkarkruntime import Ark

            assert self.settings.ark_api_key is not None
            client = Ark(
                api_key=self.settings.ark_api_key.get_secret_value(),
                base_url=self.settings.ark_base_url,
                timeout=float(
                    self.settings.video_subtitle_grounding_model_timeout_seconds
                ),
                max_retries=0,
            )
        self.client = client
        self.poll_interval_seconds = poll_interval_seconds
        self._sleep = sleep
        self._clock = clock or monotonic

    async def ground_subtitles(
        self,
        video_path: Path,
        *,
        sampling_fps: float,
    ) -> ModelArkVideoSubtitleGroundingResult:
        provider_file_id: str | None = None
        primary_error: BaseException | None = None
        result: ModelArkVideoSubtitleGroundingResult | None = None

        try:
            uploaded = await self._upload(video_path, sampling_fps=sampling_fps)
            provider_file_id = self._required_file_id(uploaded)
            await self._wait_until_active(uploaded, provider_file_id)
            raw_response = await self._create_response(provider_file_id)
            result = self._parse_response(raw_response)
        except asyncio.CancelledError as exc:
            primary_error = exc
        except Exception as exc:  # noqa: BLE001 - cleanup runs after any stage failure.
            primary_error = exc

        cleanup_error = (
            await self._delete_file(provider_file_id) if provider_file_id else None
        )

        if primary_error is not None:
            if isinstance(primary_error, VideoSubtitleGroundingProviderError):
                primary_error.cleanup_error = cleanup_error
            raise primary_error

        assert result is not None
        return replace(result, cleanup_error=cleanup_error)

    async def _upload(self, video_path: Path, *, sampling_fps: float) -> object:
        def upload() -> object:
            with video_path.open("rb") as video_file:
                return self.client.files.create(
                    file=video_file,
                    purpose="user_data",
                    preprocess_configs={
                        "video": {
                            "model": self.settings.video_subtitle_grounding_model,
                            "fps": sampling_fps,
                        }
                    },
                    timeout=float(
                        self.settings.video_subtitle_grounding_file_processing_timeout_seconds
                    ),
                )

        try:
            return await asyncio.to_thread(upload)
        except Exception as exc:
            raise self._error_from_exception(
                exc,
                message="Provider video upload failed.",
                code=VideoSubtitleGroundingErrorCode.MODEL_FILE_UPLOAD_FAILED,
                phase=VideoSubtitleGroundingErrorPhase.FILES_UPLOAD,
            ) from exc

    def _required_file_id(self, uploaded: object) -> str:
        file_id = self._value(uploaded, "id")
        if isinstance(file_id, str) and file_id.strip():
            return file_id.strip()
        raise VideoSubtitleGroundingProviderError(
            "Provider video upload returned no file identifier.",
            code=VideoSubtitleGroundingErrorCode.MODEL_FILE_UPLOAD_FAILED,
            phase=VideoSubtitleGroundingErrorPhase.FILES_UPLOAD,
            provider_code="MissingFileId",
        )

    async def _wait_until_active(
        self,
        uploaded: object,
        file_id: str,
    ) -> None:
        timeout = float(
            self.settings.video_subtitle_grounding_file_processing_timeout_seconds
        )
        deadline = self._clock() + timeout
        current = uploaded

        while True:
            status = self._value(current, "status")
            if status == "active":
                return
            if status == "failed":
                error = self._value(current, "error")
                raise VideoSubtitleGroundingProviderError(
                    "Provider video processing failed.",
                    code=(VideoSubtitleGroundingErrorCode.MODEL_FILE_PROCESSING_FAILED),
                    phase=VideoSubtitleGroundingErrorPhase.FILES_PROCESSING,
                    provider_code=self._field(error, "code") or "FileProcessingFailed",
                    request_id=self._request_id(current),
                )
            if status != "processing":
                raise VideoSubtitleGroundingProviderError(
                    "Provider video processing returned an invalid status.",
                    code=(VideoSubtitleGroundingErrorCode.MODEL_FILE_PROCESSING_FAILED),
                    phase=VideoSubtitleGroundingErrorPhase.FILES_PROCESSING,
                    provider_code="InvalidFileStatus",
                    request_id=self._request_id(current),
                )
            if self._clock() >= deadline:
                raise VideoSubtitleGroundingProviderError(
                    "Provider video processing timed out.",
                    code=(VideoSubtitleGroundingErrorCode.MODEL_FILE_PROCESSING_FAILED),
                    phase=VideoSubtitleGroundingErrorPhase.FILES_PROCESSING,
                    provider_code="TimeoutError",
                    request_id=self._request_id(current),
                )

            await self._sleep(self.poll_interval_seconds)
            try:
                current = await asyncio.to_thread(
                    self.client.files.retrieve,
                    file_id,
                    timeout=timeout,
                )
            except Exception as exc:
                raise self._error_from_exception(
                    exc,
                    message="Provider video processing status check failed.",
                    code=(VideoSubtitleGroundingErrorCode.MODEL_FILE_PROCESSING_FAILED),
                    phase=VideoSubtitleGroundingErrorPhase.FILES_PROCESSING,
                ) from exc

    async def _create_response(self, file_id: str) -> object:
        timeout = float(self.settings.video_subtitle_grounding_model_timeout_seconds)
        try:
            return await asyncio.to_thread(
                self.client.responses.with_raw_response.create,
                model=self.settings.video_subtitle_grounding_model,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": VIDEO_SUBTITLE_GROUNDING_PROMPT,
                            },
                            {
                                "type": "input_video",
                                "file_id": file_id,
                            },
                        ],
                    }
                ],
                text={"format": VIDEO_SUBTITLE_GROUNDING_JSON_SCHEMA},
                thinking={"type": "disabled"},
                temperature=0,
                max_output_tokens=(
                    self.settings.video_subtitle_grounding_max_output_tokens
                ),
                timeout=timeout,
            )
        except Exception as exc:
            raise self._error_from_exception(
                exc,
                message="Provider subtitle grounding request failed.",
                code=VideoSubtitleGroundingErrorCode.MODEL_REQUEST_FAILED,
                phase=VideoSubtitleGroundingErrorPhase.RESPONSES,
            ) from exc

    def _parse_response(
        self,
        response: object,
    ) -> ModelArkVideoSubtitleGroundingResult:
        output_text: str | None = None
        try:
            payload = (
                response.json()
                if callable(getattr(response, "json", None))
                else response
            )
            output_text = self._output_text(payload)
            decoded = json.loads(output_text)
            parsed = _ResponsePayload.model_validate(decoded)
            usage = self._usage(payload)
            request_id = self._request_id(response) or self._request_id(payload)
        except (json.JSONDecodeError, TypeError, ValidationError, ValueError) as exc:
            raise VideoSubtitleGroundingProviderError(
                "Provider subtitle grounding response was invalid.",
                code=VideoSubtitleGroundingErrorCode.INVALID_MODEL_OUTPUT,
                phase=VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION,
                provider_code=type(exc).__name__,
                request_id=self._request_id(response),
                raw_output=output_text,
            ) from exc
        except Exception as exc:
            raise self._error_from_exception(
                exc,
                message="Provider subtitle grounding response could not be parsed.",
                code=VideoSubtitleGroundingErrorCode.INVALID_MODEL_OUTPUT,
                phase=VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION,
            ) from exc

        return ModelArkVideoSubtitleGroundingResult(
            model=self.settings.video_subtitle_grounding_model,
            subtitles=tuple(
                ModelArkSubtitleGroundingSegment(
                    text=subtitle.text,
                    start_ms=subtitle.start_ms,
                    end_ms=subtitle.end_ms,
                    bbox=subtitle.bbox,
                    visual_role=subtitle.visual_role,
                    font_height_ratio=subtitle.font_height_ratio,
                    alignment=subtitle.alignment,
                    block_id=subtitle.block_id,
                    line_index=subtitle.line_index,
                    background_color=subtitle.background_color,
                )
                for subtitle in parsed.subtitles
            ),
            usage=usage,
            request_id=request_id,
            raw_output=output_text,
        )

    async def _delete_file(
        self,
        file_id: str,
    ) -> VideoSubtitleGroundingProviderError | None:
        try:
            await asyncio.to_thread(
                self.client.files.delete,
                file_id,
                timeout=float(
                    self.settings.video_subtitle_grounding_model_timeout_seconds
                ),
            )
        except Exception as exc:  # noqa: BLE001 - cleanup must remain best-effort.
            return self._error_from_exception(
                exc,
                message="Provider file cleanup failed.",
                code=VideoSubtitleGroundingErrorCode.CLEANUP_FAILED,
                phase=VideoSubtitleGroundingErrorPhase.CLEANUP,
            )
        return None

    @classmethod
    def _output_text(cls, payload: object) -> str:
        direct = cls._value(payload, "output_text")
        if isinstance(direct, str) and direct:
            return direct

        output = cls._value(payload, "output")
        if not isinstance(output, (list, tuple)):
            raise TypeError("response output is missing")
        parts: list[str] = []
        for item in output:
            content_items = cls._value(item, "content")
            if not isinstance(content_items, (list, tuple)):
                continue
            for content in content_items:
                text = cls._value(content, "text")
                if isinstance(text, str) and text:
                    parts.append(text)
        if not parts:
            raise ValueError("response output text is empty")
        return "\n".join(parts)

    @classmethod
    def _usage(cls, payload: object) -> VideoSubtitleGroundingUsage:
        usage = cls._value(payload, "usage")
        input_tokens = cls._token_count(
            cls._value(usage, "input_tokens") if usage is not None else None
        )
        if input_tokens == 0 and usage is not None:
            input_tokens = cls._token_count(cls._value(usage, "prompt_tokens"))
        output_tokens = cls._token_count(
            cls._value(usage, "output_tokens") if usage is not None else None
        )
        if output_tokens == 0 and usage is not None:
            output_tokens = cls._token_count(cls._value(usage, "completion_tokens"))
        total_value = cls._value(usage, "total_tokens") if usage is not None else None
        total_tokens = cls._token_count(total_value)
        if total_value is None:
            total_tokens = input_tokens + output_tokens
        return VideoSubtitleGroundingUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )

    @staticmethod
    def _token_count(value: object) -> int:
        return (
            value
            if isinstance(value, int) and not isinstance(value, bool) and value >= 0
            else 0
        )

    @classmethod
    def _request_id(cls, source: object) -> str | None:
        direct = cls._field(source, "request_id")
        if direct:
            return direct
        headers = cls._value(source, "headers")
        if headers is not None:
            for name in _REQUEST_ID_HEADERS:
                try:
                    value = headers.get(name)
                except (AttributeError, TypeError):
                    break
                safe_value = _safe_provider_value(value)
                if safe_value:
                    return safe_value
        return None

    @classmethod
    def _error_from_exception(
        cls,
        exc: Exception,
        *,
        message: str,
        code: VideoSubtitleGroundingErrorCode,
        phase: VideoSubtitleGroundingErrorPhase,
    ) -> VideoSubtitleGroundingProviderError:
        body = getattr(exc, "body", None)
        provider_error = cls._value(body, "error")
        return VideoSubtitleGroundingProviderError(
            message,
            code=code,
            phase=phase,
            provider_code=(
                cls._field(provider_error, "code")
                or cls._field(exc, "code")
                or type(exc).__name__
            ),
            request_id=(
                cls._request_id(exc)
                or cls._request_id(provider_error)
                or cls._request_id(getattr(exc, "response", None))
            ),
        )

    @staticmethod
    def _value(source: object, key: str) -> object:
        if source is None:
            return None
        if isinstance(source, dict):
            return source.get(key)
        return getattr(source, key, None)

    @classmethod
    def _field(cls, source: object, key: str) -> str | None:
        return _safe_provider_value(cls._value(source, key))


def _safe_provider_value(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if _SAFE_PROVIDER_VALUE.fullmatch(text) else None
