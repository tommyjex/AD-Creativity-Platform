from contextlib import asynccontextmanager
from inspect import isawaitable
from time import perf_counter
from typing import Any, Callable
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
    get_repository,
    get_video_enhancement_client_factory,
)
from .api.router import api_router
from .core.config import get_settings

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
            settings=await _resolve_dependency(application, get_settings),
        )
    application.state.aigc_pipeline_runtime = runtime
    await runtime.start()
    try:
        yield
    finally:
        await runtime.stop()
        if repository is not None:
            discard_aigc_pipeline_runtime(repository)


def create_app() -> FastAPI:
    application = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
        lifespan=_lifespan,
    )

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
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.headers.get(
            "X-Request-ID",
            str(uuid4()),
        )
        response.headers["X-Process-Time"] = f"{perf_counter() - started_at:.6f}"
        return response

    @application.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        # #region debug-point A-D:queued-task-runtime-state
        try:
            import json
            import time
            import urllib.request

            runtime = application.state.aigc_pipeline_runtime
            task = runtime.repository.get_aigc_task_attempt(
                "e609612d-ccc9-4c3f-8465-6a0ff6fb26e9"
            )
            urllib.request.urlopen(
                urllib.request.Request(
                    "http://127.0.0.1:7780/event",
                    data=json.dumps(
                        {
                            "sessionId": "aigc-task-stuck-queued",
                            "runId": "post-fix",
                            "hypothesisId": "A-D",
                            "location": "main.py:health_check",
                            "msg": "[DEBUG] Queued task runtime state",
                            "data": {
                                "taskId": task.task_id,
                                "taskStatus": task.status.value,
                                "taskCreatedAt": task.created_at.isoformat(),
                                "taskStartedAt": (
                                    task.started_at.isoformat()
                                    if task.started_at
                                    else None
                                ),
                                "taskRunId": task.run_id,
                                "queueSize": runtime.queue.qsize(),
                                "isEnqueued": task.task_id in runtime._enqueued,
                                "leaseToken": runtime._lease_token,
                                "workerCount": len(runtime._workers),
                                "workerDone": [
                                    worker.done()
                                    for worker in runtime._workers
                                ],
                            },
                            "traceId": task.task_id,
                            "ts": int(time.time() * 1000),
                        }
                    ).encode(),
                    headers={"Content-Type": "application/json"},
                ),
                timeout=0.2,
            ).read()
        except Exception:
            pass
        # #endregion
        return {
            "status": "ok",
            "name": APP_NAME,
            "version": APP_VERSION,
        }

    application.include_router(api_router, prefix="/api")

    return application


app = create_app()
