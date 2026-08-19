from __future__ import annotations

import asyncio

import httpx
import pytest
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import Settings
from backend.app.repositories import InMemoryRepository
from backend.app.repositories.mysql import MySQLRepository
from backend.app.schemas import (
    Asset,
    AssetCategory,
    AssetCreate,
    AssetType,
    ProjectCreate,
    Stage,
    Status,
)
from backend.app.services.assets import (
    AssetStorageService,
    DownloadedAsset,
    HttpRemoteAssetDownloader,
    StoredAssetInput,
    TosObjectStorageClient,
)


class FakeObjectStorageClient:
    def __init__(self, *, fail_on_put: int | None = None) -> None:
        self.deletes: list[str] = []
        self.fail_on_put = fail_on_put
        self.puts: list[dict[str, object]] = []

    def put_object(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str | None = None,
    ) -> None:
        if self.fail_on_put == len(self.puts) + 1:
            raise RuntimeError("TOS upload failed")
        self.puts.append(
            {
                "key": key,
                "content": content,
                "content_type": content_type,
            }
        )

    def delete_object(self, *, key: str) -> None:
        self.deletes.append(key)

    def signed_url(self, *, key: str, expires: int = 3600) -> str:
        return f"https://signed.example.com/{key}?expires={expires}"


class FakeRemoteAssetDownloader:
    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        return DownloadedAsset(
            content=f"bytes:{url}".encode(),
            mime_type=expected_mime_type or "image/png",
        )


def test_tos_get_object_closes_nested_sdk_response() -> None:
    class Content:
        closed = False

        def close(self) -> None:
            self.closed = True

    class Output:
        def __init__(self) -> None:
            self.content = Content()
            self.resp = None

        def read(self) -> bytes:
            return b"object-bytes"

    output = Output()

    class Client:
        def get_object(self, *, bucket: str, key: str) -> Output:
            assert bucket == "bucket"
            assert key == "object-key"
            return output

    storage = TosObjectStorageClient.__new__(TosObjectStorageClient)
    storage._bucket = "bucket"
    storage._client = Client()

    assert storage.get_object(key="object-key") == b"object-bytes"
    assert output.content.closed is True


def _create_project(repository: InMemoryRepository) -> str:
    return repository.create_project(
        ProjectCreate.model_validate(
            {
                "name": "Launch Campaign",
                "brief": {
                    "prompt": "Create a conversion-focused short video ad.",
                    "product_name": "AdPilot",
                },
            }
        )
    ).id


def test_asset_content_proxy_preserves_video_range_response(
    client,
    repository: InMemoryRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_id = _create_project(repository)
    asset = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            stage=Stage.VIDEO,
            object_key=f"projects/{project_id}/video/range-test.mp4",
            mime_type="video/mp4",
        )
    )
    captured_headers: dict[str, str] = {}
    original_async_client = httpx.AsyncClient

    def handler(request: httpx.Request) -> httpx.Response:
        captured_headers.update(request.headers)
        return httpx.Response(
            status_code=206,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": "4",
                "Content-Range": "bytes 100-103/1000",
                "ETag": '"video-etag"',
            },
            content=b"moov",
        )

    monkeypatch.setattr(
        "backend.app.api.routes.httpx.AsyncClient",
        lambda **kwargs: original_async_client(
            transport=httpx.MockTransport(handler),
            follow_redirects=kwargs.get("follow_redirects", False),
            timeout=kwargs.get("timeout"),
        ),
    )

    response = client.get(
        f"/api/assets/{asset.id}/content",
        headers={"Range": "bytes=100-103"},
    )

    assert response.status_code == 206
    assert response.content == b"moov"
    assert captured_headers["range"] == "bytes=100-103"
    assert response.headers["accept-ranges"] == "bytes"
    assert response.headers["content-length"] == "4"
    assert response.headers["content-range"] == "bytes 100-103/1000"
    assert response.headers["etag"] == '"video-etag"'
    assert response.headers["content-type"] == "video/mp4"


def test_asset_storage_registers_generated_asset_with_stable_url_and_metadata() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
    )

    asset = service.register_asset(
        repository,
        StoredAssetInput(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.IMAGE,
            status=Status.SUCCEEDED,
            source_url="mock://modelark/project/images/shot-01.png",
            mime_type="image/png",
            source_task_id="task-1",
            metadata={"shot_index": 1},
        ),
    )

    assert asset.object_key is not None
    assert asset.object_key.startswith(f"projects/{project_id}/image/{asset.id}")
    assert asset.object_key.endswith(".png")
    assert asset.url == f"https://assets.example.com/{asset.object_key}"
    assert asset.source_task_id == "task-1"
    assert asset.metadata == {
        "shot_index": 1,
        "storage_provider": "tos",
        "source_url": "mock://modelark/project/images/shot-01.png",
    }

    listed = repository.list_project_assets(project_id)
    assert listed == [asset]
    assert listed[0].url == asset.url
    assert listed[0].metadata == asset.metadata


def test_asset_storage_upload_uses_client_and_persists_asset_record() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    client = FakeObjectStorageClient()
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=client,
    )

    asset = service.upload_asset(
        repository,
        StoredAssetInput(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            mime_type="video/mp4",
            filename="shot-01.mp4",
            source_task_id="task-2",
            metadata={"shot_index": 1},
        ),
        content=b"video-bytes",
    )

    assert client.puts == [
        {
            "key": asset.object_key,
            "content": b"video-bytes",
            "content_type": "video/mp4",
        }
    ]
    assert asset.object_key is not None
    assert asset.object_key.startswith(f"projects/{project_id}/video/{asset.id}")
    assert asset.object_key.endswith(".mp4")
    assert asset.url == f"https://assets.example.com/{asset.object_key}"
    assert asset.size_bytes == len(b"video-bytes")
    assert asset.source_task_id == "task-2"


def test_asset_storage_normalizes_schemeless_public_endpoint() -> None:
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="assets.example.com/",
    )

    assert service.url_for_key("projects/project/image.png") == (
        "https://ad-assets.assets.example.com/projects/project/image.png"
    )


def test_asset_storage_returns_proxy_urls_without_mutating_persisted_asset() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    storage_client = FakeObjectStorageClient()
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=storage_client,
    )
    persisted = service.register_asset(
        repository,
        StoredAssetInput(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            category=AssetCategory.CHARACTER,
            stage=Stage.CHARACTER,
            mime_type="image/png",
        ),
    )

    response_asset = service.with_access_url(persisted)
    response_project = service.with_project_access_urls(
        repository.get_project(project_id)
    )

    assert response_asset.url == f"/api/assets/{persisted.id}/content"
    assert "expires=3600" not in response_asset.url
    assert service.signed_access_url(persisted) == (
        f"https://signed.example.com/{persisted.object_key}?expires=3600"
    )
    assert response_project.assets == [response_asset]
    assert repository.get_asset(persisted.id).url == persisted.url


def test_asset_storage_uploads_last_frame_as_asset_companion() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    client = FakeObjectStorageClient()
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=client,
        downloader=FakeRemoteAssetDownloader(),
    )
    video = service.upload_asset(
        repository,
        StoredAssetInput(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            mime_type="video/mp4",
        ),
        content=b"video",
    )

    updated = asyncio.run(
        service.upload_asset_companion_from_source(
            repository,
            video,
            source_url="https://model.example/last-frame.png",
            suffix="last-frame",
            expected_mime_type="image/png",
            metadata_prefix="last_frame",
        )
    )

    assert len(repository.list_project_assets(project_id)) == 1
    assert len(client.puts) == 2
    assert client.puts[1]["key"] == (
        f"projects/{project_id}/video/{video.id}-last-frame.png"
    )
    assert client.puts[1]["content_type"] == "image/png"
    assert updated.metadata["last_frame_status"] == "available"
    assert updated.metadata["last_frame_mime_type"] == "image/png"
    assert updated.metadata["last_frame_size_bytes"] > 0
    response = service.with_access_url(updated)
    assert "last_frame_object_key" not in response.metadata
    assert response.metadata["last_frame_url"] == (
        f"/api/assets/{video.id}/last-frame"
    )
    assert "last_frame_url" not in repository.get_asset(video.id).metadata


def test_asset_storage_uses_actual_last_frame_mime_and_extension() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    client = FakeObjectStorageClient()

    class JpegDownloader:
        async def fetch(
            self,
            url: str,
            *,
            expected_mime_type: str | None = None,
        ) -> DownloadedAsset:
            assert expected_mime_type == "image/*"
            return DownloadedAsset(content=b"jpeg", mime_type="image/jpeg")

    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=client,
        downloader=JpegDownloader(),
    )
    video = service.upload_asset(
        repository,
        StoredAssetInput(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            mime_type="video/mp4",
        ),
        content=b"video",
    )

    updated = asyncio.run(
        service.upload_asset_companion_from_source(
            repository,
            video,
            source_url="https://model.example/last-frame",
            suffix="last-frame",
            expected_mime_type="image/*",
            metadata_prefix="last_frame",
        )
    )

    assert client.puts[1]["key"].endswith("-last-frame.jpg")
    assert client.puts[1]["content_type"] == "image/jpeg"
    assert updated.metadata["last_frame_mime_type"] == "image/jpeg"


def test_asset_storage_rolls_back_last_frame_when_metadata_update_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    client = FakeObjectStorageClient()
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=client,
        downloader=FakeRemoteAssetDownloader(),
    )
    video = service.upload_asset(
        repository,
        StoredAssetInput(
            project_id=project_id,
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            mime_type="video/mp4",
        ),
        content=b"video",
    )
    monkeypatch.setattr(
        repository,
        "update_asset",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            RuntimeError("metadata update failed")
        ),
    )

    with pytest.raises(RuntimeError, match="metadata update failed"):
        asyncio.run(
            service.upload_asset_companion_from_source(
                repository,
                video,
                source_url="https://model.example/last-frame.png",
                suffix="last-frame",
                expected_mime_type="image/png",
                metadata_prefix="last_frame",
            )
        )

    assert client.deletes == [
        f"projects/{project_id}/video/{video.id}-last-frame.png"
    ]


def test_asset_storage_deletes_video_and_last_frame_objects() -> None:
    client = FakeObjectStorageClient()
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=client,
    )
    asset = Asset(
        project_id="project-1",
        type=AssetType.STORYBOARD_VIDEO,
        status=Status.SUCCEEDED,
        stage=Stage.VIDEO,
        object_key="projects/project-1/video/video.mp4",
        metadata={
            "last_frame_object_key": (
                "projects/project-1/video/video-last-frame.png"
            )
        },
    )

    service.delete_asset_objects(asset)

    assert client.deletes == [
        "projects/project-1/video/video.mp4",
        "projects/project-1/video/video-last-frame.png",
    ]


def test_asset_storage_persists_tos_asset_records_with_mysql_repository(
    mysql_session_factory: sessionmaker[Session],
) -> None:
    repository = MySQLRepository(mysql_session_factory)
    project_id = _create_project(repository)
    client = FakeObjectStorageClient()
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=client,
    )

    registered = service.register_asset(
        repository,
        StoredAssetInput(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.IMAGE,
            source_url="mock://modelark/project/images/shot-01.png",
            mime_type="image/png",
            metadata={"shot_index": 1},
        ),
    )
    uploaded = service.upload_asset(
        repository,
        StoredAssetInput(
            project_id=project_id,
            type=AssetType.FINAL_VIDEO,
            stage=Stage.COMPOSE,
            mime_type="video/mp4",
            filename="final.mp4",
            metadata={"render": "final"},
        ),
        content=b"final-video-bytes",
    )

    persisted = MySQLRepository(mysql_session_factory)
    saved_assets = persisted.list_project_assets(project_id)

    assert [asset.id for asset in saved_assets] == [registered.id, uploaded.id]
    assert registered.url == f"https://assets.example.com/{registered.object_key}"
    assert registered.metadata == {
        "shot_index": 1,
        "storage_provider": "tos",
        "source_url": "mock://modelark/project/images/shot-01.png",
    }
    assert uploaded.url == f"https://assets.example.com/{uploaded.object_key}"
    assert uploaded.size_bytes == len(b"final-video-bytes")
    assert uploaded.metadata == {
        "render": "final",
        "storage_provider": "tos",
    }
    assert client.puts == [
        {
            "key": uploaded.object_key,
            "content": b"final-video-bytes",
            "content_type": "video/mp4",
        }
    ]


def test_asset_storage_uploads_character_batch_before_persisting() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    client = FakeObjectStorageClient()
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=client,
        downloader=FakeRemoteAssetDownloader(),
    )

    assets = asyncio.run(
        service.upload_assets_from_sources(
            repository,
            [
                StoredAssetInput(
                    project_id=project_id,
                    type=AssetType.GENERATED_IMAGE,
                    category=AssetCategory.CHARACTER,
                    stage=Stage.CHARACTER,
                    source_url=f"https://model.example/{key}.png?token=temporary",
                    mime_type="image/png",
                    metadata={"character_key": key},
                )
                for key in ["brand-guide", "target-customer"]
            ],
        )
    )

    assert len(assets) == 2
    assert len(client.puts) == 2
    assert repository.list_assets(
        project_id=project_id,
        category=AssetCategory.CHARACTER,
    ) == assets
    assert all(asset.size_bytes and asset.size_bytes > 0 for asset in assets)
    assert all(asset.metadata["source_host"] == "model.example" for asset in assets)
    assert all("source_url" not in asset.metadata for asset in assets)
    assert all(asset.object_key and asset.object_key.endswith(".png") for asset in assets)


def test_asset_storage_rolls_back_uploaded_objects_when_batch_fails() -> None:
    repository = InMemoryRepository()
    project_id = _create_project(repository)
    client = FakeObjectStorageClient(fail_on_put=2)
    service = AssetStorageService(
        bucket="ad-assets",
        public_endpoint="https://assets.example.com",
        client=client,
        downloader=FakeRemoteAssetDownloader(),
    )

    with pytest.raises(RuntimeError, match="TOS upload failed"):
        asyncio.run(
            service.upload_assets_from_sources(
                repository,
                [
                    StoredAssetInput(
                        project_id=project_id,
                        type=AssetType.GENERATED_IMAGE,
                        category=AssetCategory.CHARACTER,
                        stage=Stage.CHARACTER,
                        source_url=f"https://model.example/{index}.png",
                        mime_type="image/png",
                    )
                    for index in range(2)
                ],
            )
        )

    assert repository.list_project_assets(project_id) == []
    assert client.deletes == [client.puts[0]["key"]]


@pytest.mark.parametrize(
    ("url", "content_type", "content", "error"),
    [
        ("file:///tmp/image.png", "image/png", b"png", "HTTP or HTTPS"),
        ("https://model.example/image", "text/html", b"<html>", "not an image"),
        ("https://model.example/image", "image/png", b"", "empty"),
        ("https://model.example/image", "image/png", b"oversized", "maximum size"),
    ],
)
def test_http_downloader_validates_generated_images(
    url: str,
    content_type: str,
    content: bytes,
    error: str,
) -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(
            200,
            content=content,
            headers={"content-type": content_type},
        )
    )
    downloader = HttpRemoteAssetDownloader(
        timeout_seconds=5,
        max_bytes=4,
        transport=transport,
    )

    with pytest.raises(ValueError, match=error):
        asyncio.run(downloader.fetch(url, expected_mime_type="image/png"))


def test_http_downloader_returns_valid_image_bytes() -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(
            200,
            content=b"png",
            headers={"content-type": "image/png; charset=binary"},
        )
    )
    downloader = HttpRemoteAssetDownloader(
        timeout_seconds=5,
        max_bytes=10,
        transport=transport,
    )

    result = asyncio.run(
        downloader.fetch(
            "https://model.example/image.png",
            expected_mime_type="image/png",
        )
    )

    assert result == DownloadedAsset(content=b"png", mime_type="image/png")


def test_http_downloader_accepts_actual_image_mime_for_wildcard() -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(
            200,
            content=b"jpeg",
            headers={"content-type": "image/jpeg"},
        )
    )
    downloader = HttpRemoteAssetDownloader(
        timeout_seconds=5,
        max_bytes=10,
        transport=transport,
    )

    result = asyncio.run(
        downloader.fetch(
            "https://model.example/last-frame",
            expected_mime_type="image/*",
        )
    )

    assert result == DownloadedAsset(content=b"jpeg", mime_type="image/jpeg")


def test_http_downloader_returns_valid_video_bytes() -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(
            200,
            content=b"mp4",
            headers={"content-type": "video/mp4"},
        )
    )
    downloader = HttpRemoteAssetDownloader(
        timeout_seconds=5,
        max_bytes=10,
        transport=transport,
    )

    result = asyncio.run(
        downloader.fetch(
            "https://model.example/video.mp4",
            expected_mime_type="video/mp4",
        )
    )

    assert result == DownloadedAsset(content=b"mp4", mime_type="video/mp4")


def test_http_downloader_rejects_media_family_mismatch() -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(
            200,
            content=b"png",
            headers={"content-type": "image/png"},
        )
    )
    downloader = HttpRemoteAssetDownloader(
        timeout_seconds=5,
        max_bytes=10,
        transport=transport,
    )

    with pytest.raises(ValueError, match="not a video"):
        asyncio.run(
            downloader.fetch(
                "https://model.example/image.png",
                expected_mime_type="video/mp4",
            )
        )


def test_asset_storage_from_settings_uses_image_sized_download_timeout() -> None:
    service = AssetStorageService.from_settings(Settings())

    assert isinstance(service.downloader, HttpRemoteAssetDownloader)
    assert service.downloader.timeout_seconds == 600
    assert service.downloader.max_bytes == 30 * 1024 * 1024
