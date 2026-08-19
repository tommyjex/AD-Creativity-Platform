from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router

APP_NAME = "AD Creativity Backend"
APP_VERSION = "0.1.0"


def create_app() -> FastAPI:
    application = FastAPI(
        title=APP_NAME,
        version=APP_VERSION,
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
        return {
            "status": "ok",
            "name": APP_NAME,
            "version": APP_VERSION,
        }

    application.include_router(api_router, prefix="/api")

    return application


app = create_app()
