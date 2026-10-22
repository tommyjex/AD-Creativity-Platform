"""Deterministic local acceptance fixture; no provider or cloud requests."""

from urllib.parse import quote

from fastapi import Response

from backend.app.api.dependencies import get_aigc_pipeline_runtime, get_asset_storage_service, get_repository
from backend.app.main import create_app
from backend.app.repositories import InMemoryRepository
from backend.app.schemas import AigcTaskMetrics
from backend.app.schemas.common import utc_now
from backend.tests.test_video_last_frame import setup

repository = InMemoryRepository()
gateway, task, generation, _, objects = setup(repository)
objects.signed_url = lambda *, key, expires=3600: (
    f"http://127.0.0.1:8040/api/_acceptance/object?key={quote(key, safe='')}"
)
app = create_app()
app.dependency_overrides[get_repository] = lambda: repository
app.dependency_overrides[get_asset_storage_service] = lambda: gateway.asset_storage


class FixtureRuntime:
    async def start(self):
        lease = repository.acquire_aigc_worker_lease("tail-acceptance", now=utc_now(), lease_seconds=60)
        assert lease and repository.claim_aigc_task_attempt(task.task_id, fencing_token=lease.fencing_token)
        execution = await gateway.execute(task)
        _, accepted = repository.commit_aigc_generated_media_task_attempt(
            task.task_id, fencing_token=lease.fencing_token,
            result=execution.result, metrics=AigcTaskMetrics(),
        )
        assert accepted
        self.result = execution.result
        return True

    async def stop(self):
        return None


runtime = FixtureRuntime()
app.dependency_overrides[get_aigc_pipeline_runtime] = lambda: runtime


@app.get("/api/_acceptance/object")
def object_content(key: str):
    return Response(
        objects.get_object(key=key),
        media_type="image/png" if key.endswith(".png") else "video/mp4",
    )


@app.get("/api/_acceptance/last-frame")
def manifest():
    assets = [repository.get_asset(item.asset_id) for item in runtime.result.assets]
    return {
        "pipeline_id": task.pipeline_id,
        "video_id": assets[0].id,
        "tail_id": assets[1].id,
        "tail_name": assets[1].metadata["name"],
        "provider_calls": 0,
        "naming_calls": len(generation.naming_requests),
        "object_count": len(objects.objects),
    }
