from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from pathlib import Path
from time import monotonic
from typing import Protocol

from backend.app.core.config import Settings, get_settings
from backend.app.core.logging import emit_tls_only_event, log_event
from backend.app.schemas.video_subtitle_grounding import (
    VIDEO_SUBTITLE_GROUNDING_DEFAULT_SAMPLING_FPS,
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
    VideoSubtitleGroundingRequest,
    VideoSubtitleGroundingResponse,
    VideoSubtitleGroundingVideoMetadata,
)
from backend.app.services.modelark_video_subtitle_grounding import (
    ModelArkVideoSubtitleGroundingAdapter,
    ModelArkVideoSubtitleGroundingResult,
    VideoSubtitleGroundingProviderError,
)
from backend.app.services.video_subtitle_grounding_media import (
    PreparedRemoteVideo,
    RemoteVideoError,
    SecureRemoteVideoPreparer,
)
from backend.app.services.video_subtitle_grounding_validation import (
    VideoSubtitleGroundingValidationError,
    validate_and_convert_subtitles,
)

logger = logging.getLogger(__name__)
_EVENT_PREFIX = "experiment.video_subtitle_grounding"


class VideoSubtitleGroundingPreparer(Protocol):
    def open(
        self,
        url: str,
    ) -> AbstractAsyncContextManager[PreparedRemoteVideo]: ...


class VideoSubtitleGroundingProvider(Protocol):
    async def ground_subtitles(
        self,
        video_path: Path,
        *,
        sampling_fps: float,
    ) -> ModelArkVideoSubtitleGroundingResult: ...


class VideoSubtitleGroundingService:
    def __init__(
        self,
        *,
        preparer: VideoSubtitleGroundingPreparer | None = None,
        provider: VideoSubtitleGroundingProvider | None = None,
        settings: Settings | None = None,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self.settings = settings or get_settings()
        self.preparer = preparer or SecureRemoteVideoPreparer()
        self.provider = provider or ModelArkVideoSubtitleGroundingAdapter(
            self.settings
        )
        self._clock = clock

    async def run(
        self,
        request: VideoSubtitleGroundingRequest,
    ) -> VideoSubtitleGroundingResponse:
        return await self._extract(
            self.preparer.open(request.video_url),
            sampling_fps=request.sampling_fps,
        )

    async def extract(
        self,
        prepared: PreparedRemoteVideo,
        *,
        sampling_fps: float = VIDEO_SUBTITLE_GROUNDING_DEFAULT_SAMPLING_FPS,
    ) -> VideoSubtitleGroundingResponse:
        """Extract an authorized, safely prepared video without owning its path.

        Callers enforce their route's permissions and input limits, prepare the
        display metadata, and retain local-file cleanup responsibility. Provider
        Files cleanup, validation, safe errors and logging remain shared here.
        """
        return await self._extract(
            _borrow_prepared_video(prepared),
            sampling_fps=sampling_fps,
        )

    async def _extract(
        self,
        source: AbstractAsyncContextManager[PreparedRemoteVideo],
        *,
        sampling_fps: float,
    ) -> VideoSubtitleGroundingResponse:
        started_at = self._clock()
        log_event(
            logger,
            f"{_EVENT_PREFIX}.started",
            outcome="started",
            sampling_fps=sampling_fps,
            model=self.settings.video_subtitle_grounding_model,
        )
        prepared: PreparedRemoteVideo | None = None
        result: ModelArkVideoSubtitleGroundingResult | None = None
        try:
            async with source as prepared:
                result = await self.provider.ground_subtitles(
                    prepared.path,
                    sampling_fps=sampling_fps,
                )
                validation = validate_and_convert_subtitles(
                    result,
                    prepared.metadata,
                )
            response = VideoSubtitleGroundingResponse(
                model=result.model,
                video=VideoSubtitleGroundingVideoMetadata(
                    width=prepared.metadata.display_width,
                    height=prepared.metadata.display_height,
                    duration_ms=prepared.metadata.duration_ms,
                    rotation=prepared.metadata.rotation,
                ),
                subtitles=list(validation.subtitles),
                usage=result.usage,
                latency_ms=_latency_ms(started_at, self._clock()),
            )
        except asyncio.CancelledError:
            log_event(
                logger,
                f"{_EVENT_PREFIX}.canceled",
                outcome="canceled",
                duration_ms=_latency_ms(started_at, self._clock()),
                sampling_fps=sampling_fps,
                model=self.settings.video_subtitle_grounding_model,
            )
            raise
        except (RemoteVideoError, VideoSubtitleGroundingProviderError) as exc:
            self._log_failure(
                exc,
                started_at=started_at,
                sampling_fps=sampling_fps,
                prepared=prepared,
                raw_output=getattr(exc, "raw_output", None),
            )
            self._emit_debug_output(
                raw_output=getattr(exc, "raw_output", None),
                error=exc,
            )
            raise
        except VideoSubtitleGroundingValidationError as exc:
            self._log_failure(
                exc,
                started_at=started_at,
                sampling_fps=sampling_fps,
                prepared=prepared,
                raw_output=result.raw_output if result is not None else None,
            )
            self._emit_debug_output(
                raw_output=result.raw_output if result is not None else None,
                error=exc,
            )
            raise

        assert prepared is not None
        assert result is not None
        self._log_cleanup_error(
            result.cleanup_error,
            sampling_fps=sampling_fps,
            prepared=prepared,
        )
        log_event(
            logger,
            f"{_EVENT_PREFIX}.completed",
            outcome="succeeded",
            duration_ms=response.latency_ms,
            sampling_fps=sampling_fps,
            model=response.model,
            video_bytes=prepared.size_bytes,
            display_width=response.video.width,
            display_height=response.video.height,
            video_duration_ms=response.video.duration_ms,
            subtitle_count=len(response.subtitles),
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            total_tokens=response.usage.total_tokens,
            provider_request_id=result.request_id,
            invalid_segment_count=validation.stats.invalid_segment_count,
            style_fallback_counts=validation.stats.style_fallback_counts,
        )
        return response

    def _log_failure(
        self,
        error: (
            RemoteVideoError
            | VideoSubtitleGroundingProviderError
            | VideoSubtitleGroundingValidationError
        ),
        *,
        started_at: float,
        sampling_fps: float,
        prepared: PreparedRemoteVideo | None,
        raw_output: str | None = None,
    ) -> None:
        log_event(
            logger,
            f"{_EVENT_PREFIX}.failed",
            outcome="failed",
            level=logging.WARNING,
            duration_ms=_latency_ms(started_at, self._clock()),
            sampling_fps=sampling_fps,
            model=self.settings.video_subtitle_grounding_model,
            phase=error.phase.value,
            error_code=error.code.value,
            error_stage=error.phase.value,
            error_type=type(error).__name__,
            provider_request_id=getattr(error, "request_id", None),
            provider_code=getattr(error, "provider_code", None),
            video_bytes=getattr(prepared, "size_bytes", None),
            display_width=getattr(
                getattr(prepared, "metadata", None),
                "display_width",
                None,
            ),
            display_height=getattr(
                getattr(prepared, "metadata", None),
                "display_height",
                None,
            ),
            video_duration_ms=getattr(
                getattr(prepared, "metadata", None),
                "duration_ms",
                None,
            ),
            response_length=len(raw_output) if raw_output is not None else None,
        )
        self._log_cleanup_error(
            getattr(error, "cleanup_error", None),
            sampling_fps=sampling_fps,
            prepared=prepared,
        )

    def _log_cleanup_error(
        self,
        error: VideoSubtitleGroundingProviderError | None,
        *,
        sampling_fps: float,
        prepared: PreparedRemoteVideo | None,
    ) -> None:
        if error is None:
            return
        log_event(
            logger,
            f"{_EVENT_PREFIX}.cleanup_failed",
            outcome="failed",
            level=logging.WARNING,
            sampling_fps=sampling_fps,
            model=self.settings.video_subtitle_grounding_model,
            phase=VideoSubtitleGroundingErrorPhase.CLEANUP.value,
            error_code=VideoSubtitleGroundingErrorCode.CLEANUP_FAILED.value,
            error_stage=VideoSubtitleGroundingErrorPhase.CLEANUP.value,
            error_type=type(error).__name__,
            video_bytes=getattr(prepared, "size_bytes", None),
        )

    def _emit_debug_output(
        self,
        *,
        raw_output: str | None,
        error: BaseException,
    ) -> None:
        if (
            not self.settings.enable_experimental_video_subtitle_grounding_debug
            or raw_output is None
        ):
            return
        emit_tls_only_event(
            f"{_EVENT_PREFIX}.response_validation_debug",
            outcome="failed",
            output_text=raw_output,
            exception_message=type(error).__name__,
            model=self.settings.video_subtitle_grounding_model,
            phase=VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION.value,
            error_type=type(error).__name__,
        )


@asynccontextmanager
async def _borrow_prepared_video(
    prepared: PreparedRemoteVideo,
) -> AsyncIterator[PreparedRemoteVideo]:
    yield prepared


def _latency_ms(started_at: float, finished_at: float) -> int:
    return max(0, round((finished_at - started_at) * 1000))
