import backend.app.main as main_module
import pytest
from backend.app.api.dependencies import (
    get_aigc_pipeline_runtime,
    get_asset_storage_service,
    get_media_inspector_service,
    get_modelark_generation_service,
    get_multitrack_client_factory,
    get_repository,
)
from backend.app.core.config import Settings, get_settings
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.services.assets import AssetStorageService
from fastapi.testclient import TestClient


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
