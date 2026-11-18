"""Optional standalone HTTP API. Library imports do not require FastAPI."""

from __future__ import annotations

import asyncio
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import APIKeyHeader

from .config import Settings, get_settings
from . import __version__
from .layout import SubtitleLayoutError
from .mediakit import MediaKitMultiTrackError
from .render import SubtitleRenderService
from .translation import ModelArkSubtitleTranslationAdapter
from .translation_schemas import (
    SubtitleProductRecognitionRequest, SubtitleTranslateRequest, SubtitleRenderRequest,
)
from .logging import JsonFormatter, log_event, tls_only_logger
from .media import RemoteVideoError
from .provider import VideoSubtitleGroundingProviderError
from .schemas import (
    VideoSubtitleGroundingError, VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingRequest, VideoSubtitleGroundingResponse,
)
from .service import VideoSubtitleGroundingService
from .tls_logging import TlsLogHandler, TlsLogSink
from .validation import VideoSubtitleGroundingValidationError

_CLIENT_CODES = {
    VideoSubtitleGroundingErrorCode.INVALID_VIDEO_URL,
    VideoSubtitleGroundingErrorCode.INVALID_VIDEO_INPUT,
    VideoSubtitleGroundingErrorCode.MEDIA_PROBE_FAILED,
}
_api_key = APIKeyHeader(name="X-API-Key", auto_error=False)


def create_app(
    settings: Settings | None = None, *,
    service: VideoSubtitleGroundingService | None = None,
    translator: ModelArkSubtitleTranslationAdapter | None = None,
    renderer: SubtitleRenderService | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    if settings.service_api_key is None:
        from .config import ConfigurationError
        raise ConfigurationError("SERVICE_API_KEY is required.")
    if service is None:
        settings.require_server_config()
    logger = logging.getLogger("video_subtitle_grounding")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        sink = TlsLogSink.from_settings(settings)
        formatter = JsonFormatter()
        stdout_handler = logging.StreamHandler()
        stdout_handler.setFormatter(formatter)
        handlers = [stdout_handler]
        if sink is not None:
            handlers.append(TlsLogHandler(sink, formatter))
            sink.start()
        previous_level, previous_propagate = logger.level, logger.propagate
        logger.setLevel(logging.INFO)
        logger.propagate = False
        for handler in handlers:
            logger.addHandler(handler)
        owned_service = service is None
        active_service = None
        active_translator = translator
        try:
            active_service = service or VideoSubtitleGroundingService(
                settings=settings, tls_only_logger=tls_only_logger(sink),
            )
            app.state.service = active_service
            app.state.slots = asyncio.Semaphore(settings.max_concurrent_extractions)
            if active_translator is None and settings.ark_api_key is not None:
                active_translator = ModelArkSubtitleTranslationAdapter(
                    settings, tls_only_logger=tls_only_logger(sink),
                )
            app.state.translator = active_translator
            app.state.renderer = renderer
            if renderer is None and settings.mediakit_api_key is not None:
                app.state.renderer = SubtitleRenderService(settings)
            app.state.translation_slots = asyncio.Semaphore(settings.max_concurrent_translations)
            app.state.render_slots = asyncio.Semaphore(settings.max_concurrent_render_requests)
            log_event(logger, "service.lifecycle", outcome="started")
            yield
        finally:
            if owned_service and active_service is not None:
                client = active_service.provider.client
                await asyncio.to_thread(client.close)
            if translator is None and active_translator is not None:
                await asyncio.to_thread(active_translator.client.close)
            log_event(logger, "service.lifecycle", outcome="stopped")
            if sink is not None:
                await sink.aclose()
            for handler in handlers:
                logger.removeHandler(handler)
                handler.close()
            logger.setLevel(previous_level)
            logger.propagate = previous_propagate

    app = FastAPI(title="Video subtitles: extraction, translation and rendering",
                  version=__version__, lifespan=lifespan)

    def authorize(key: str | None = Depends(_api_key)) -> None:
        expected = settings.service_api_key.get_secret_value()
        if key is None or not secrets.compare_digest(key.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail="Invalid API key.")

    @app.get("/health")
    async def health():
        return {"status": "ok", "version": __version__}

    @app.post(
        "/v1/subtitles/extract", response_model=VideoSubtitleGroundingResponse,
        dependencies=[Depends(authorize)],
    )
    async def extract(payload: VideoSubtitleGroundingRequest):
        slots = app.state.slots
        if slots.locked():
            raise HTTPException(status_code=429, detail="Extraction capacity reached.", headers={"Retry-After": "5"})
        async with slots:
            try:
                return await app.state.service.run(payload)
            except (RemoteVideoError, VideoSubtitleGroundingProviderError, VideoSubtitleGroundingValidationError) as exc:
                raise HTTPException(
                    status_code=422 if exc.code in _CLIENT_CODES else 502,
                    detail=VideoSubtitleGroundingError(
                        code=exc.code, phase=exc.phase, message=str(exc),
                    ).model_dump(mode="json"),
                ) from exc
    def capacity(slots):
        if slots.locked():
            raise HTTPException(status_code=429, detail="Request capacity reached.",
                                headers={"Retry-After": "5"})

    @app.post("/v1/subtitles/translate", dependencies=[Depends(authorize)])
    async def translate(payload: SubtitleTranslateRequest):
        active = app.state.translator
        if active is None:
            raise HTTPException(status_code=503, detail="Translation is not configured.")
        slots = app.state.translation_slots
        capacity(slots)
        async with slots:
            return await active.translate(
                [record.model_dump() for record in payload.segments],
                segment_ids=payload.segment_ids if payload.segment_ids is not None else [
                    record.segment_id for record in payload.segments
                ],
                source_language=payload.source_language,
                target_language=payload.target_language,
            )

    @app.post("/v1/subtitles/recognize-products", dependencies=[Depends(authorize)])
    async def recognize_products(payload: SubtitleProductRecognitionRequest):
        active = app.state.translator
        if active is None:
            raise HTTPException(status_code=503, detail="Translation is not configured.")
        slots = app.state.translation_slots
        capacity(slots)
        async with slots:
            return await active.recognize_products(
                [record.model_dump() for record in payload.segments],
                segment_ids=payload.segment_ids if payload.segment_ids is not None else [
                    record.segment_id for record in payload.segments
                ],
            )

    def render_error(exc):
        if isinstance(exc, SubtitleLayoutError):
            return HTTPException(status_code=422, detail={
                "code": exc.code, "phase": "layout", "segment_id": exc.segment_id,
            })
        return HTTPException(status_code=422 if exc.phase == "validate" else 502, detail={
            "code": exc.code, "phase": exc.phase,
            "provider_code": exc.provider_code, "request_id": exc.request_id,
        })

    def active_renderer():
        if app.state.renderer is None:
            raise HTTPException(status_code=503, detail="Rendering is not configured.")
        return app.state.renderer

    @app.post("/v1/subtitles/render", dependencies=[Depends(authorize)])
    async def render(payload: SubtitleRenderRequest):
        active = active_renderer()
        slots = app.state.render_slots
        capacity(slots)
        async with slots:
            try:
                return await active.submit(
                    payload.segments, payload.video, idempotency_key=payload.idempotency_key,
                )
            except (SubtitleLayoutError, MediaKitMultiTrackError) as exc:
                raise render_error(exc) from exc

    @app.get("/v1/subtitles/render/{task_id}", dependencies=[Depends(authorize)])
    async def render_task(task_id: str):
        active = active_renderer()
        slots = app.state.render_slots
        capacity(slots)
        async with slots:
            try:
                return await active.get_task(task_id=task_id)
            except MediaKitMultiTrackError as exc:
                raise render_error(exc) from exc

    return app
