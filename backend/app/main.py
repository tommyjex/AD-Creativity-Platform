import logging
from collections.abc import Callable
from contextlib import asynccontextmanager
from inspect import isawaitable
from time import perf_counter
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.dependencies import (
    discard_aigc_pipeline_runtime,
    get_aigc_pipeline_runtime,
    get_asset_storage_service,
    get_face_blur_video_client_factory,
    get_media_inspector_service,
    get_modelark_generation_service,
    get_multitrack_client_factory,
    get_repository,
    get_video_enhancement_client_factory,
)
from .api.router import api_router
from .core.config import get_settings
from .core.logging import (
    bind_log_context,
    configure_structured_logging,
    detach_tls_sink,
    log_event,
    reset_log_context,
)

APP_NAME = "AD Creativity Backend"
APP_VERSION = "0.1.0"


async def _resolve_dependency(
    application: FastAPI,
    dependency: Callable[..., Any],
) -> Any:
    provider = application.dependency_overrides.get(dependency, dependency)
    value = provider()
    return await value if isawaitable(value) else value


@asynccontextmanager
async def _lifespan(application: FastAPI):
    logger = logging.getLogger(__name__)
    tls_sink = application.state.tls_log_sink
    if tls_sink is not None:
        tls_sink.start()
    log_event(logger, "application.lifecycle", outcome="started", phase="startup")
    repository = None
    runtime_override = application.dependency_overrides.get(
        get_aigc_pipeline_runtime
    )
    if runtime_override is not None:
        runtime = await _resolve_dependency(
            application,
            get_aigc_pipeline_runtime,
        )
    else:
        repository = await _resolve_dependency(application, get_repository)
        runtime = get_aigc_pipeline_runtime(
            repository=repository,
            asset_storage=await _resolve_dependency(
                application,
                get_asset_storage_service,
            ),
            generation=await _resolve_dependency(
                application,
                get_modelark_generation_service,
            ),
            media_inspector=await _resolve_dependency(
                application,
                get_media_inspector_service,
            ),
            video_enhancement_client_factory=await _resolve_dependency(
                application,
                get_video_enhancement_client_factory,
            ),
            face_blur_client_factory=await _resolve_dependency(
                application,
                get_face_blur_video_client_factory,
            ),
            multitrack_client_factory=await _resolve_dependency(
                application,
                get_multitrack_client_factory,
            ),
            settings=await _resolve_dependency(application, get_settings),
        )
    application.state.aigc_pipeline_runtime = runtime
    try:
        await runtime.start()
    except Exception as exc:
        log_event(
            logger,
            "application.lifecycle",
            outcome="failed",
            level=logging.ERROR,
            phase="startup",
            exception=exc,
        )
        if tls_sink is not None:
            detach_tls_sink(tls_sink)
            await tls_sink.aclose()
        if repository is not None:
            discard_aigc_pipeline_runtime(repository)
        raise
    try:
        yield
    finally:
        try:
            await runtime.stop()
            log_event(
                logger,
                "application.lifecycle",
                outcome="succeeded",
                phase="shutdown",
            )
        except Exception as exc:
            log_event(
                logger,
                "application.lifecycle",
                outcome="failed",
                level=logging.ERROR,
                phase="shutdown",
                exception=exc,
            )
            raise
        finally:
            if tls_sink is not None:
                detach_tls_sink(tls_sink)
                await tls_sink.aclose()
            if repository is not None:
                discard_aigc_pipeline_runtime(repository)


def create_app() -> FastAPI:
    settings = get_settings()
    tls_sink = configure_structured_logging(settings)
    application = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        lifespan=_lifespan,
    )
    application.state.tls_log_sink = tls_sink

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.middleware("http")
    async def add_request_headers(request: Request, call_next):
        started_at = perf_counter()
        request_id = request.headers.get(
            "X-Request-ID",
            str(uuid4()),
        )
        token = bind_log_context(request_id=request_id)
        logger = logging.getLogger(__name__)
        route = request.url.path
        log_event(
            logger,
            "http.request",
            outcome="started",
            method=request.method,
            route=route,
        )
        try:
            response = await call_next(request)
        except Exception as exc:
            log_event(
                logger,
                "http.request",
                outcome="failed",
                level=logging.ERROR,
                duration_ms=(perf_counter() - started_at) * 1000,
                method=request.method,
                route=route,
                exception=exc,
            )
            raise
        else:
            duration_seconds = perf_counter() - started_at
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = f"{duration_seconds:.6f}"
            log_event(
                logger,
                "http.request",
                outcome="succeeded",
                duration_ms=duration_seconds * 1000,
                method=request.method,
                route=route,
                status_code=response.status_code,
            )
            return response
        finally:
            reset_log_context(token)

    @application.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {
            "status": "ok",
            "name": APP_NAME,
            "version": APP_VERSION,
        }

    application.include_router(api_router, prefix="/api")

    return application


app = create_app()
