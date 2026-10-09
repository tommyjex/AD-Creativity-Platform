import pytest
from fastapi import Response
from fastapi.testclient import TestClient

import backend.app.main as main_module
from backend.app.api.dependencies import (
    get_aigc_pipeline_runtime,
    get_asset_storage_service,
    get_media_inspector_service,
    get_modelark_generation_service,
    get_multitrack_client_factory,
    get_repository,
    get_video_ocr_client_factory,
)
from backend.app.core.config import Settings, get_settings
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.services.assets import AssetStorageService


class RuntimeLifecycleProbe:
    def __init__(self) -> None:
        self.start_calls = 0
        self.stop_calls = 0

    async def start(self) -> bool:
        self.start_calls += 1
        return True

    async def stop(self) -> None:
        self.stop_calls += 1


class FailingRuntimeLifecycleProbe(RuntimeLifecycleProbe):
    async def start(self) -> bool:
        await super().start()
        raise RuntimeError("startup failed")


class TlsSinkProbe:
    def __init__(self) -> None:
        self.start_calls = 0
        self.close_calls = 0

    def start(self) -> None:
        self.start_calls += 1

    async def aclose(self) -> None:
        self.close_calls += 1


def test_app_lifespan_starts_and_stops_aigc_runtime() -> None:
    runtime = RuntimeLifecycleProbe()
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = lambda: runtime

    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert runtime.start_calls == 1
        assert runtime.stop_calls == 0

    assert runtime.stop_calls == 1


def test_startup_failure_detaches_and_closes_tls_sink(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sink = TlsSinkProbe()
    detached: list[object] = []
    monkeypatch.setattr(main_module, "configure_structured_logging", lambda _: sink)
    monkeypatch.setattr(main_module, "detach_tls_sink", detached.append)
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = FailingRuntimeLifecycleProbe

    with pytest.raises(RuntimeError, match="startup failed"), TestClient(app):
        pass

    assert sink.start_calls == 1
    assert sink.close_calls == 1
    assert detached == [sink]


def test_http_logging_propagates_request_id_and_records_lifecycle(
    monkeypatch,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        main_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = RuntimeLifecycleProbe

    with TestClient(app) as client:
        response = client.get("/health", headers={"X-Request-ID": "request-123"})

    assert response.headers["X-Request-ID"] == "request-123"
    request_events = [
        context for event, context in events if event == "http.request"
    ]
    assert [event["outcome"] for event in request_events] == [
        "started",
        "succeeded",
    ]
    assert request_events[-1]["method"] == "GET"
    assert request_events[-1]["status_code"] == 200
    assert request_events[-1]["duration_ms"] >= 0
    assert any(
        event == "application.lifecycle" and context["outcome"] == "started"
        for event, context in events
    )


@pytest.mark.parametrize(
    ("status_code", "expected_outcome", "expected_level"),
    [
        (302, "succeeded", main_module.logging.INFO),
        (404, "failed", main_module.logging.WARNING),
        (503, "failed", main_module.logging.ERROR),
    ],
)
def test_http_logging_classifies_completed_responses(
    monkeypatch: pytest.MonkeyPatch,
    status_code: int,
    expected_outcome: str,
    expected_level: int,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        main_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = RuntimeLifecycleProbe

    @app.get(f"/status-{status_code}")
    async def status_route() -> Response:
        return Response(status_code=status_code)

    with TestClient(app) as client:
        response = client.get(f"/status-{status_code}", follow_redirects=False)

    assert response.status_code == status_code
    completed = [
        context
        for event, context in events
        if event == "http.request" and context["outcome"] != "started"
    ]
    assert len(completed) == 1
    assert completed[0]["outcome"] == expected_outcome
    assert completed[0]["level"] == expected_level
    assert completed[0]["status_code"] == status_code


def test_origin_guard_logs_forbidden_request_as_completed_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    settings = Settings(
        cors_origins=["https://app.example.com"],
        site_origin="https://app.example.com",
    )
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        main_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = RuntimeLifecycleProbe

    with TestClient(app) as client:
        response = client.post(
            "/api/blocked",
            headers={"Origin": "https://untrusted.example.com"},
        )

    assert response.status_code == 403
    completed = [
        context
        for event, context in events
        if event == "http.request" and context["outcome"] == "failed"
    ]
    assert len(completed) == 1
    assert completed[0]["level"] == main_module.logging.WARNING
    assert completed[0]["status_code"] == 403
    assert completed[0]["error_code"] == "origin_forbidden"
    assert completed[0]["error_stage"] == "origin_guard"
    assert completed[0]["error_type"] == "OriginForbidden"


def test_insecure_production_cookie_emits_startup_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    settings = Settings(
        environment="production",
        cors_origins=["*"],
        allow_insecure_cors=True,
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=False,
    )
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        main_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = RuntimeLifecycleProbe

    with TestClient(app):
        pass

    warnings = [
        context
        for event, context in events
        if event == "security.insecure_auth_cookie_enabled"
    ]
    assert len(warnings) == 1
    assert warnings[0]["outcome"] == "started"
    assert warnings[0]["level"] == main_module.logging.WARNING


def test_secure_production_cookie_does_not_emit_insecure_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    settings = Settings(
        environment="production",
        cors_origins=["https://app.example.com"],
        site_origin="https://app.example.com",
        allow_insecure_auth_cookie=True,
        auth_cookie_secure=True,
    )
    monkeypatch.setattr(main_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        main_module,
        "log_event",
        lambda _logger, event, **_context: events.append(event),
    )
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = RuntimeLifecycleProbe

    with TestClient(app):
        pass

    assert "security.insecure_auth_cookie_enabled" not in events


def test_app_lifespan_resolves_multitrack_client_factory() -> None:
    app = create_app()
    repository = InMemoryRepository()
    multitrack_client = object()
    multitrack_factory = lambda: multitrack_client
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: (
        AssetStorageService(bucket="test")
    )
    app.dependency_overrides[get_modelark_generation_service] = object
    app.dependency_overrides[get_media_inspector_service] = object
    app.dependency_overrides[get_multitrack_client_factory] = lambda: (
        multitrack_factory
    )
    app.dependency_overrides[get_settings] = Settings

    with TestClient(app):
        runtime = app.state.aigc_pipeline_runtime
        assert runtime.gateway.multitrack_client_factory is multitrack_factory
        assert runtime.gateway.multitrack_client_factory() is multitrack_client


def test_app_lifespan_resolves_video_ocr_client_factory() -> None:
    app = create_app()
    repository = InMemoryRepository()
    video_ocr_client = object()
    video_ocr_factory = lambda: video_ocr_client
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_asset_storage_service] = lambda: (
        AssetStorageService(bucket="test")
    )
    app.dependency_overrides[get_modelark_generation_service] = object
    app.dependency_overrides[get_media_inspector_service] = object
    app.dependency_overrides[get_video_ocr_client_factory] = lambda: (
        video_ocr_factory
    )
    app.dependency_overrides[get_settings] = Settings

    with TestClient(app):
        runtime = app.state.aigc_pipeline_runtime
        assert runtime.gateway.video_ocr_client_factory is video_ocr_factory
        assert runtime.gateway.video_ocr_client_factory() is video_ocr_client
