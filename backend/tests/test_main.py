from fastapi.testclient import TestClient

from backend.app.api.dependencies import get_aigc_pipeline_runtime
from backend.app.main import create_app


class RuntimeLifecycleProbe:
    def __init__(self) -> None:
        self.start_calls = 0
        self.stop_calls = 0

    async def start(self) -> bool:
        self.start_calls += 1
        return True

    async def stop(self) -> None:
        self.stop_calls += 1


def test_app_lifespan_starts_and_stops_aigc_runtime() -> None:
    runtime = RuntimeLifecycleProbe()
    app = create_app()
    app.dependency_overrides[get_aigc_pipeline_runtime] = lambda: runtime

    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert runtime.start_calls == 1
        assert runtime.stop_calls == 0

    assert runtime.stop_calls == 1
