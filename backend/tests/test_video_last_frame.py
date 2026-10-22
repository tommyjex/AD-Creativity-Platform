from __future__ import annotations

import asyncio
import json
from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image

from backend.app.api.routes import _asset_download_filename
from backend.app.repositories import NotFoundError
from backend.app.schemas import (
    AigcTaskMetrics, AigcTaskType, AssetType, Status,
)
from backend.app.schemas.common import utc_now
from backend.app.services.aigc_executor import (
    AigcPipelineRuntime, _project_result_for_port, _result_value_for_port,
)
from backend.app.services.aigc_gateway import AigcModelGateway
from backend.app.services.aigc_asset_naming import (
    build_aigc_download_filename, build_aigc_generated_asset_name,
)
from backend.app.services.assets import AssetStorageService, DownloadedAsset
from backend.tests.conftest import FakeObjectStorageClient
from backend.tests.test_aigc_gateway import FakeAigcGeneration, create_persisted_task


class TailGeneration(FakeAigcGeneration):
    tail_url: str | None = "https://provider.example/tail?signature=private-secret"

    async def generate_seedance_video(self, request):
        result = await super().generate_seedance_video(request)
        return result.model_copy(update={"last_frame_url": self.tail_url})


class TailDownloader:
    failure: str | None = None
    format = "PNG"

    async def fetch(self, url, *, expected_mime_type=None):
        if expected_mime_type.startswith("video/"):
            return DownloadedAsset(b"mock-video", "video/mp4")
        if self.failure == "download":
            raise RuntimeError("https://provider.example/tail?signature=private-secret")
        if self.failure == "invalid":
            return DownloadedAsset(b"broken-image", "image/png")
        output = BytesIO()
        Image.new("RGB", (120, 240), "blue").save(output, format=self.format)
        # Deliberately inaccurate header: storage must derive MIME from bytes.
        return DownloadedAsset(output.getvalue(), "image/png")


def params():
    return {
        "model": "doubao-seedance-2-5-260628",
        "generation_mode": "text_to_video",
        "prompt": "test video",
        "duration_seconds": 5,
        "resolution": "720p",
        "aspect_ratio": "16:9",
    }


def setup(repository, *, image_format="PNG"):
    downloader = TailDownloader()
    downloader.format = image_format
    client = FakeObjectStorageClient()
    storage = AssetStorageService(
        bucket="test", public_endpoint="https://storage.example",
        client=client, downloader=downloader,
    )
    generation = TailGeneration()
    gateway = AigcModelGateway(repository, generation, storage)
    task = create_persisted_task(repository, AigcTaskType.VIDEO_GENERATION, params())
    return gateway, task, generation, downloader, client


@pytest.mark.parametrize("repo_kind", ["memory", "mysql"])
@pytest.mark.parametrize(
    ("image_format", "extension", "mime"),
    [("PNG", "png", "image/png"), ("JPEG", "jpg", "image/jpeg"), ("WEBP", "webp", "image/webp")],
)
@pytest.mark.parametrize("naming_failure", [False, True])
def test_tail_assets_commit_download_and_cleanup(
    repo_kind, image_format, extension, mime, naming_failure,
    repository, mysql_repository,
):
    repo = repository if repo_kind == "memory" else mysql_repository
    gateway, task, generation, _, client = setup(repo, image_format=image_format)
    if naming_failure:
        generation.naming_error = TimeoutError("naming deadline")
    lease = repo.acquire_aigc_worker_lease("tail-test", now=utc_now(), lease_seconds=30)
    assert lease and repo.claim_aigc_task_attempt(task.task_id, fencing_token=lease.fencing_token)
    execution = asyncio.run(gateway.execute(task))
    assert [item.ordinal for item in execution.result.assets] == [0, 1]
    video_id, tail_id = [item.asset_id for item in execution.result.assets]
    assert _result_value_for_port(execution.result, "video", "model") == video_id
    assert [a.asset_id for a in _project_result_for_port(execution.result, "video").assets] == [video_id]
    refs = repo.list_aigc_task_assets(task.task_id)
    assert {(ref.slot, ref.ordinal) for ref in refs} == {("video", 0), ("last_frame", 0)}
    committed, accepted = repo.commit_aigc_generated_media_task_attempt(
        task.task_id, fencing_token=lease.fencing_token,
        result=execution.result, metrics=AigcTaskMetrics(),
    )
    assert accepted
    video, tail = repo.get_asset(video_id), repo.get_asset(tail_id)
    basename = "生视频" if naming_failure else "雨夜霓虹跑车"
    assert video.metadata["name"] == f"{basename}.mp4"
    assert tail.metadata["name"] == f"{basename}视频尾帧.{extension}"
    assert committed.result.assets[1].metadata["name"] == tail.metadata["name"]
    assert tail.type == AssetType.GENERATED_IMAGE and tail.status == Status.SUCCEEDED
    assert tail.mime_type == mime and tail.object_key.endswith(f".{extension}")
    assert tail.metadata["width"] == 120 and tail.metadata["height"] == 240
    assert tail.metadata["source_video_asset_id"] == video_id
    assert tail.metadata["operation"] == tail.metadata["aigc_role"] == "video_last_frame"
    assert video.metadata["last_frame_asset_id"] == tail_id
    assert video.metadata["last_frame_status"] == "available"
    assert "private-secret" not in json.dumps(committed.model_dump(mode="json"))
    assert len(generation.naming_requests) == 1
    assert _asset_download_filename(tail, repository=repo) == tail.metadata["name"]
    repo.patch_aigc_pipeline_node_custom_name(task.pipeline_id, "model", "厨房😀清洁")
    assert _asset_download_filename(tail, repository=repo) == f"厨房😀清洁视频尾帧.{extension}"
    assert _asset_download_filename(tail, repository=None) == tail.metadata["name"]
    renamed = repo.rename_asset(tail.id, name="我的尾帧")
    assert _asset_download_filename(renamed, repository=repo) == f"我的尾帧.{extension}"
    # All companion assets are handled by the worker's normal cleanup.
    runtime = AigcPipelineRuntime(repo, gateway)
    asyncio.run(runtime._cleanup_task_outputs(task.task_id))
    assert not client.objects and not repo.list_aigc_task_assets(task.task_id)
    for asset_id in (video_id, tail_id):
        with pytest.raises(NotFoundError):
            repo.get_asset(asset_id)


@pytest.mark.parametrize("repo_kind", ["memory", "mysql"])
@pytest.mark.parametrize("failure", [
    "missing", "empty", "download", "invalid", "upload",
    "persistence", "partial_persistence", "record", "partial_record",
])
def test_tail_failure_preserves_video_and_removes_residue(
    repo_kind, failure, repository, mysql_repository, monkeypatch, caplog,
):
    repo = repository if repo_kind == "memory" else mysql_repository
    gateway, task, generation, downloader, client = setup(repo)
    if failure in {"missing", "empty"}:
        generation.tail_url = None if failure == "missing" else " "
    downloader.failure = failure
    original_put = client.put_object
    original_add = repo.add_aigc_task_assets
    original_create = repo.create_assets

    def put(**kwargs):
        if failure == "upload" and kwargs["content_type"].startswith("image/"):
            raise RuntimeError("private-secret")
        original_put(**kwargs)

    def add(refs):
        if failure in {"record", "partial_record"} and refs[0].slot == "last_frame":
            if failure == "partial_record":
                original_add(refs)
            raise RuntimeError("private-secret")
        return original_add(refs)

    def create(items):
        if failure in {"persistence", "partial_persistence"} and items[0].type == AssetType.GENERATED_IMAGE:
            if failure == "partial_persistence":
                original_create(items)
            raise RuntimeError("private-secret")
        return original_create(items)

    monkeypatch.setattr(client, "put_object", put)
    monkeypatch.setattr(repo, "add_aigc_task_assets", add)
    monkeypatch.setattr(repo, "create_assets", create)
    with caplog.at_level("INFO"):
        execution = asyncio.run(gateway.execute(task))
    assert len(execution.result.assets) == 1
    asset = repo.get_asset(execution.result.assets[0].asset_id)
    assert asset.metadata["last_frame_status"] == "unavailable"
    assert "last_frame_asset_id" not in asset.metadata
    if failure in {"missing", "empty"}:
        assert asset.metadata["last_frame_error_type"] == "MissingProviderUrl"
    assert len(client.objects) == 1
    assert [ref.slot for ref in repo.list_aigc_task_assets(task.task_id)] == ["video"]
    assert "private-secret" not in caplog.text
    assert "aigc.video_generation.last_frame_failed" in caplog.text
    assert all("private-secret" not in str(record.__dict__) for record in caplog.records)
    if failure in {"persistence", "partial_persistence", "record", "partial_record"}:
        assert len(client.deletes) == 1


@pytest.mark.parametrize("url", [None, "", "  "])
def test_seedance_missing_tail_is_normalized(url):
    from backend.app.services.modelark import BytePlusModelArkAdapter, SeedanceVideoGenerationRequest
    from backend.tests.test_modelark import FakeArkClient, _settings

    client = FakeArkClient(
        video_create_responses=[SimpleNamespace(id="mock")],
        video_get_responses=[SimpleNamespace(status="succeeded", content=SimpleNamespace(
            video_url="https://provider.example/video.mp4", last_frame_url=url,
        ))],
    )
    result = asyncio.run(BytePlusModelArkAdapter(_settings(), client=client).generate_seedance_video(
        SeedanceVideoGenerationRequest(**params())
    ))
    assert result.last_frame_url is None
    assert client.content_generation.tasks.create_calls[0]["return_last_frame"] is True


@pytest.mark.parametrize("repo_kind", ["memory", "mysql"])
@pytest.mark.parametrize("rejection", ["cancel", "late"])
def test_rejected_dual_asset_result_cleans_both_outputs(
    repo_kind, rejection, repository, mysql_repository,
):
    repo = repository if repo_kind == "memory" else mysql_repository
    gateway, task, _, _, client = setup(repo)
    lease = repo.acquire_aigc_worker_lease("tail-test", now=utc_now(), lease_seconds=30)
    assert lease and repo.claim_aigc_task_attempt(task.task_id, fencing_token=lease.fencing_token)
    result = asyncio.run(gateway.execute(task)).result
    if rejection == "cancel":
        repo.update_aigc_run(task.run_id, cancellation_requested=True)
    _, accepted = repo.commit_aigc_generated_media_task_attempt(
        task.task_id,
        fencing_token=lease.fencing_token + (rejection == "late"),
        result=result,
        metrics=AigcTaskMetrics(),
    )
    assert not accepted
    assert all(repo.get_asset(a.asset_id).status == Status.DRAFT for a in result.assets)
    asyncio.run(AigcPipelineRuntime(repo, gateway)._cleanup_task_outputs(task.task_id))
    assert not client.objects and not repo.list_aigc_task_assets(task.task_id)


def test_unicode_tail_names_reserve_suffix_and_extension_budget():
    name = build_aigc_generated_asset_name(
        node_name="厨房😀" * 90, mime_type="image/webp", output_ordinal=1,
        name_variant="video_last_frame",
    )
    assert name.endswith("视频尾帧.webp") and len(name.encode("utf-8")) <= 180
    assert build_aigc_download_filename(
        basename="厨房/清洁", mime_type="image/jpeg", output_ordinal=1,
        name_variant="video_last_frame",
    ) == "厨房-清洁视频尾帧.jpg"
