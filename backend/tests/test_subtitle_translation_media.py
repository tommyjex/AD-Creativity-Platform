import asyncio
import json
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from backend.app.core.config import Settings
from backend.app.schemas.asset import AssetCreate
from backend.app.schemas.enums import AssetRole, AssetType, Status, ToolAssetRole
from backend.app.schemas.subtitle_translation import SubtitleVideoMetadata
from backend.app.services.media_inspector import (
    MediaInspectionError,
    VideoDisplayMetadata,
)
from backend.app.services.subtitle_translation_media import (
    MAX_BYTES,
    SubtitleTranslationMediaService,
    SubtitleVideoPathInspector,
    validate_video_asset,
)
from backend.tests.test_subtitle_translation_workspace import (
    extracted,
    subtitle_repo,
    subtitle_service,
)
from backend.tests.test_video_subtitle_grounding_media import downloader

__all__ = ["subtitle_repo", "subtitle_service"]


class FakeInspector:
    def __init__(self, error=None):
        self.paths = []
        self.error = error

    async def inspect(self, path, *, role):
        self.paths.append(path)
        assert path.stat().st_mode & 0o777 == 0o600
        if self.error:
            raise self.error
        return (
            VideoDisplayMetadata(1280, 720, 720, 1280, 10, 90, "mp4", "h264"),
            SubtitleVideoMetadata(
                width=720,
                height=1280,
                duration_ms=10000,
                rotation=90,
                fps=25,
                has_audio=True,
            ),
        )


class FakeStorage:
    client = object()

    def __init__(self):
        self.uploads = []
        self.deleted = []

    def generate_object_key(self, **kwargs):
        return kwargs["asset_id"] + ".mp4"

    def _put_object_from_file(self, **kwargs):
        self.uploads.append(kwargs)

    async def _delete_uploaded_objects(self, keys):
        self.deleted.extend(keys)

    def url_for_key(self, key):
        return "https://storage.example/" + key


async def chunks():
    yield b"video"
    yield b"data"


def test_upload_streams_private_temp_and_persists_rotation_and_audio(repository):
    storage = FakeStorage()
    inspector = FakeInspector()
    media = SubtitleTranslationMediaService(repository, storage, inspector=inspector)
    asset = asyncio.run(
        media.upload_video(
            chunks(),
            role="reference",
            filename="../../video.mp4",
            mime_type="video/mp4",
        )
    )
    assert asset.size_bytes == 9
    assert asset.tool_asset_role == ToolAssetRole.INPUT
    assert asset.metadata["name"] == "video.mp4"
    assert asset.metadata["subtitle_video"]["rotation"] == 90
    assert asset.metadata["subtitle_video"]["has_audio"] is True
    assert asset.metadata["subtitle_video"]["fps"] == 25
    assert all(not path.exists() for path in inspector.paths)
    assert storage.uploads[0]["size_bytes"] == 9


@pytest.mark.parametrize("failure", ["probe", "storage", "database"])
def test_upload_failure_cleans_temp_and_partial_object(
    repository, monkeypatch, failure
):
    storage = FakeStorage()
    inspector = FakeInspector(
        MediaInspectionError("bad video") if failure == "probe" else None
    )
    media = SubtitleTranslationMediaService(repository, storage, inspector=inspector)
    if failure == "storage":

        def broken(**kwargs):
            raise OSError("partial upload")

        storage._put_object_from_file = broken
    if failure == "database":
        monkeypatch.setattr(
            repository,
            "create_asset",
            lambda *args: (_ for _ in ()).throw(RuntimeError("db")),
        )
    with pytest.raises((ValueError, RuntimeError, OSError)):
        asyncio.run(
            media.upload_video(
                chunks(), role="reference", filename=None, mime_type="video/mp4"
            )
        )
    assert all(not path.exists() for path in inspector.paths)
    assert repository.list_assets() == []
    assert len(storage.deleted) == (0 if failure == "probe" else 1)


def test_upload_limit_checked_while_streaming_and_empty_rejected(
    repository, monkeypatch
):
    import backend.app.services.subtitle_translation_media as module

    assert MAX_BYTES == 512 * 1024 * 1024
    monkeypatch.setattr(module, "MAX_BYTES", 6)
    storage = FakeStorage()
    inspector = FakeInspector()
    media = SubtitleTranslationMediaService(repository, storage, inspector=inspector)
    with pytest.raises(ValueError, match="512 MiB"):
        asyncio.run(
            media.upload_video(
                chunks(), role="reference", filename=None, mime_type="video/mp4"
            )
        )

    async def empty():
        if False:
            yield b""

    with pytest.raises(ValueError, match="empty"):
        asyncio.run(
            media.upload_video(
                empty(), role="reference", filename=None, mime_type="video/mp4"
            )
        )
    assert inspector.paths == []
    assert storage.uploads == []


@pytest.mark.parametrize("private", [True, False])
def test_import_uses_secure_downloader_and_never_persists_signed_url(
    repository, tmp_path, private
):
    secret = "signature-secret"

    def handler(request):
        if private:
            return httpx.Response(
                302, headers={"location": "https://127.0.0.1/video.mp4"}
            )
        return httpx.Response(
            200, headers={"content-type": "video/mp4"}, content=b"video"
        )

    storage = FakeStorage()
    media = SubtitleTranslationMediaService(
        repository,
        storage,
        inspector=FakeInspector(),
        downloader=downloader(tmp_path, handler),
    )
    url = "https://public.example/video.mp4?signature=" + secret
    if private:
        with pytest.raises(ValueError):
            asyncio.run(media.import_video(url, role="reference"))
        assert storage.uploads == []
    else:
        asset = asyncio.run(media.import_video(url, role="reference"))
        assert secret not in json.dumps(asset.model_dump(mode="json"))
        assert asset.url.startswith("https://storage.example/")
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    "change",
    [
        {"asset_role": AssetRole.INTERNAL_BASE},
        {"project_id": "project", "tool_asset_role": None},
        {"status": Status.FAILED},
        {"mime_type": "image/png"},
        {"size_bytes": MAX_BYTES + 1},
    ],
)
def test_video_visibility_and_size(change):
    asset = AssetCreate(
        type=AssetType.STORYBOARD_VIDEO,
        tool_asset_role=ToolAssetRole.INPUT,
        status=Status.SUCCEEDED,
        mime_type="video/mp4",
    ).model_copy(update=change)
    with pytest.raises(ValueError):
        validate_video_asset(asset)


@pytest.mark.parametrize(
    "role,duration,valid",
    [
        ("reference", 600, True),
        ("reference", 600.001, False),
        ("clean", 601, True),
    ],
)
def test_probe_rotation_fps_audio_and_duration_limit(
    monkeypatch, role, duration, valid
):
    payload = {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1280,
                "height": 720,
                "duration": str(duration),
                "avg_frame_rate": "30000/1001",
                "side_data_list": [{"rotation": -90}],
            },
            {"codec_type": "audio", "codec_name": "aac"},
        ],
        "format": {"format_name": "mov,mp4", "duration": str(duration)},
    }
    process = SimpleNamespace(
        returncode=0,
        communicate=AsyncMock(return_value=(json.dumps(payload).encode(), b"")),
    )
    monkeypatch.setattr(
        asyncio, "create_subprocess_exec", AsyncMock(return_value=process)
    )
    inspector = SubtitleVideoPathInspector(Settings())
    inspector.ffprobe_path = "/fake/ffprobe"
    if not valid:
        with pytest.raises(MediaInspectionError):
            asyncio.run(inspector.inspect("/fake/video", role=role))
    else:
        display, metadata = asyncio.run(inspector.inspect("/fake/video", role=role))
        assert metadata.width == 720 and metadata.height == 1280
        assert display.rotation == metadata.rotation == 270
        assert metadata.has_audio is True
        assert metadata.fps == pytest.approx(29.97, abs=0.001)


def test_output_is_atomic_and_losing_transfer_object_is_deleted(subtitle_service):
    service = subtitle_service
    workspace, _ = extracted(service)
    from backend.app.schemas.subtitle_translation import SubtitleStageRequest

    task = service.submit(
        workspace.id,
        "render",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    storage = FakeStorage()
    media = SubtitleTranslationMediaService(
        service.repository, storage, inspector=FakeInspector()
    )

    @asynccontextmanager
    async def open_video(url):
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "video"
            path.touch(mode=0o600)
            yield SimpleNamespace(path=path, size_bytes=1, mime_type="video/mp4")

    media.downloader = SimpleNamespace(open=open_video)

    async def race():
        ready = asyncio.Event()
        arrivals = 0
        inspect = media.inspector.inspect

        async def simultaneous(path, *, role):
            nonlocal arrivals
            arrivals += 1
            if arrivals == 2:
                ready.set()
            await ready.wait()
            return await inspect(path, role=role)

        media.inspector.inspect = simultaneous
        return await asyncio.gather(
            *(
                media.store_output("https://provider.example/video.mp4", task=task)
                for _ in range(2)
            )
        )

    results = asyncio.run(race())
    assert results[0].id == results[1].id
    assert (
        len([a for a in service.repository.list_assets() if a.tool_task_id == task.id])
        == 1
    )
    assert len(storage.deleted) == 1
    assert len(storage.uploads) == 2


def test_cancelled_upload_finishes_thread_before_object_and_file_cleanup(repository):
    import threading
    from pathlib import Path

    storage = FakeStorage()
    inspector = FakeInspector()
    media = SubtitleTranslationMediaService(repository, storage, inspector=inspector)
    started = threading.Event()
    release = threading.Event()
    finished = threading.Event()

    def blocking_upload(**kwargs):
        started.set()
        assert release.wait(timeout=5)
        assert Path(kwargs["file_path"]).exists()
        finished.set()

    async def deleted(keys):
        assert finished.is_set()
        storage.deleted.extend(keys)

    storage._put_object_from_file = blocking_upload
    storage._delete_uploaded_objects = deleted

    async def cancel():
        task = asyncio.create_task(
            media.upload_video(
                chunks(), role="reference", filename=None, mime_type="video/mp4"
            )
        )
        await asyncio.to_thread(started.wait, 5)
        task.cancel()
        await asyncio.sleep(0)
        release.set()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(cancel())
    assert len(storage.deleted) == 1
    assert all(not path.exists() for path in inspector.paths)
    assert repository.list_assets() == []


def test_output_database_failure_cleans_uploaded_object(
    subtitle_service, tmp_path, monkeypatch
):
    from backend.app.schemas.subtitle_translation import SubtitleStageRequest

    service = subtitle_service
    workspace, _ = extracted(service)
    task = service.submit(
        workspace.id,
        "render",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    storage = FakeStorage()
    inspector = FakeInspector()
    media = SubtitleTranslationMediaService(
        service.repository, storage, inspector=inspector
    )
    path = tmp_path / "output"
    path.touch(mode=0o600)
    monkeypatch.setattr(
        service.repository,
        "create_subtitle_output_asset",
        lambda data: (_ for _ in ()).throw(RuntimeError("database failure")),
    )

    async def store():
        display, metadata = await inspector.inspect(path, role="clean")
        await media._store_path(
            path,
            mime_type="video/mp4",
            size=1,
            metadata=metadata,
            display=display,
            filename="output.mp4",
            task=task,
        )

    with pytest.raises(RuntimeError, match="database"):
        asyncio.run(store())
    assert len(storage.deleted) == 1
    assert not any(a.tool_task_id == task.id for a in service.repository.list_assets())


def test_transfer_retry_reuses_previous_durable_output_without_downloading(
    subtitle_service,
):
    from backend.app.schemas.subtitle_translation import SubtitleStageRequest

    service = subtitle_service
    workspace, _ = extracted(service)
    task = service.submit(
        workspace.id,
        "render",
        SubtitleStageRequest(expected_revision=workspace.revision),
    )
    asset = service.repository.create_subtitle_output_asset(
        AssetCreate(
            type=AssetType.STORYBOARD_VIDEO,
            tool_task_id=task.id,
            tool_asset_role=ToolAssetRole.OUTPUT,
            status=Status.SUCCEEDED,
            mime_type="video/mp4",
            object_key="durable.mp4",
        )
    )
    service._complete(task.id, error="link interrupted")
    retry = service.retry(task.id)
    media = SubtitleTranslationMediaService(
        service.repository, FakeStorage(), inspector=FakeInspector()
    )

    def no_download(url):
        pytest.fail("durable output should not transfer again")

    media.downloader = SimpleNamespace(open=no_download)
    assert (
        asyncio.run(
            media.store_output("https://provider.example/output.mp4", task=retry)
        ).id
        == asset.id
    )
