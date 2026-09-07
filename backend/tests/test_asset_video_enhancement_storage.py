from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import BinaryIO

import httpx
import pytest

from backend.app.repositories import InMemoryRepository
from backend.app.schemas import AssetRole, AssetType, Status
from backend.app.services.assets import (
    AigcVideoEnhancementAssetInput,
    AssetStorageService,
    HttpRemoteAssetDownloader,
    TosObjectStorageClient,
)
from backend.app.services.aigc_asset_naming import AigcAssetNamingContext


MP4_BYTES = b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00isommp42video"
MOV_BYTES = b"\x00\x00\x00\x18ftypqt  \x00\x00\x00\x00qt  videodata"


class StreamingObjectStorageClient:
    def __init__(self, *, fail_upload: bool = False) -> None:
        self.deletes: list[str] = []
        self.fail_upload = fail_upload
        self.puts: list[dict[str, object]] = []

    def put_object(
        self,
        *,
        key: str,
        content: bytes | BinaryIO,
        content_type: str | None = None,
    ) -> None:
        raise AssertionError("streaming uploads must not use the byte API")

    def put_object_from_file(
        self,
        *,
        key: str,
        file_path: str,
        content_type: str | None = None,
        size_bytes: int | None = None,
    ) -> None:
        if self.fail_upload:
            raise RuntimeError("simulated TOS stream failure")
        chunks: list[bytes] = []
        with open(file_path, "rb") as source:
            while chunk := source.read(7):
                chunks.append(chunk)
        self.puts.append(
            {
                "key": key,
                "content": b"".join(chunks),
                "content_type": content_type,
                "size_bytes": size_bytes,
            }
        )

    def delete_object(self, *, key: str) -> None:
        self.deletes.append(key)

    def get_object(self, *, key: str) -> bytes:
        raise FileNotFoundError(key)

    def signed_url(self, *, key: str, expires: int = 3600) -> str:
        return f"https://signed.example/{key}?expires={expires}"


class LegacyStreamingObjectStorageClient:
    def __init__(self) -> None:
        self.content = b""

    def put_object(
        self,
        *,
        key: str,
        content: bytes | BinaryIO,
        content_type: str | None = None,
    ) -> None:
        assert not isinstance(content, bytes)
        self.content = content.read()

    def delete_object(self, *, key: str) -> None:
        pass

    def get_object(self, *, key: str) -> bytes:
        raise FileNotFoundError(key)

    def signed_url(self, *, key: str, expires: int = 3600) -> str:
        return f"https://signed.example/{key}?expires={expires}"


class ChunkedStream(httpx.AsyncByteStream):
    def __init__(self, chunks: list[bytes], *, fail_after: int | None = None) -> None:
        self.chunks = chunks
        self.fail_after = fail_after

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for index, chunk in enumerate(self.chunks):
            if self.fail_after == index:
                raise httpx.ReadError("remote stream interrupted")
            yield chunk

    async def aclose(self) -> None:
        pass


class HangingStream(httpx.AsyncByteStream):
    async def __aiter__(self) -> AsyncIterator[bytes]:
        await asyncio.sleep(1)
        yield MP4_BYTES

    async def aclose(self) -> None:
        pass


def test_tos_client_uploads_file_as_stream(tmp_path) -> None:
    file_path = tmp_path / "enhanced.mp4"
    file_path.write_bytes(MP4_BYTES)
    captured: dict[str, object] = {}

    class Client:
        def put_object(self, **kwargs) -> None:
            content = kwargs["content"]
            assert not isinstance(content, bytes)
            captured.update(kwargs)
            captured["bytes"] = content.read()

    storage = TosObjectStorageClient.__new__(TosObjectStorageClient)
    storage._bucket = "bucket"
    storage._client = Client()

    storage.put_object_from_file(
        key="enhanced.mp4",
        file_path=str(file_path),
        content_type="video/mp4",
        size_bytes=len(MP4_BYTES),
    )

    assert captured["bucket"] == "bucket"
    assert captured["key"] == "enhanced.mp4"
    assert captured["content_length"] == len(MP4_BYTES)
    assert captured["content_type"] == "video/mp4"
    assert captured["bytes"] == MP4_BYTES


def _input(source_url: str) -> AigcVideoEnhancementAssetInput:
    return AigcVideoEnhancementAssetInput(
        source_url=source_url,
        pipeline_id="pipeline-1",
        run_id="run-1",
        node_id="enhance-1",
        task_id="task-1",
        input_asset_id="input-video-1",
        provider_task_id="mediakit-task-1",
        tool_version="professional",
        scene=None,
        enhance_style="natural",
        resolution_mode="preset",
        resolution="4k",
        fps=60,
        bitrate_mode="custom",
        bitrate=18000,
        bit_depth=10,
        duration_seconds=12.5,
        executor_version="video-enhancement-v1",
        naming_context=AigcAssetNamingContext(
            pipeline_name="广告画布",
            definition_snapshot={
                "schemaVersion": 2,
                "nodes": [
                    {
                        "id": "enhance-1",
                        "type": "video_enhancement",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 280, "height": 200},
                        "config": {},
                    }
                ],
                "edges": [],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
            node_id="enhance-1",
        ),
    )


def _service(
    handler,
    storage_client,
    *,
    max_bytes: int = 1024,
    timeout_seconds: float = 5,
) -> AssetStorageService:
    return AssetStorageService(
        bucket="assets",
        public_endpoint="https://assets.example",
        client=storage_client,
        downloader=HttpRemoteAssetDownloader(
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            transport=httpx.MockTransport(handler),
        ),
    )


@pytest.mark.parametrize(
    ("content_type", "content", "extension"),
    [
        ("video/mp4", MP4_BYTES, ".mp4"),
        ("video/quicktime", MOV_BYTES, ".mov"),
    ],
)
def test_store_aigc_video_enhancement_streams_and_registers_actual_format(
    monkeypatch: pytest.MonkeyPatch,
    content_type: str,
    content: bytes,
    extension: str,
) -> None:
    source_url = (
        "https://temporary.example/output"
        "?X-Tos-Expires=86400&X-Tos-Signature=secret"
    )
    repository = InMemoryRepository()
    references = []
    monkeypatch.setattr(
        repository,
        "add_aigc_task_assets",
        lambda items: references.extend(items) or items,
    )
    storage_client = StreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": content_type},
            stream=ChunkedStream([content[:9], content[9:17], content[17:]]),
        ),
        storage_client,
    )

    asset = asyncio.run(
        service.store_aigc_video_enhancement(repository, _input(source_url))
    )

    assert asset.type == AssetType.STORYBOARD_VIDEO
    assert asset.asset_role == AssetRole.PUBLIC
    assert asset.status == Status.SUCCEEDED
    assert asset.mime_type == content_type
    assert asset.object_key is not None and asset.object_key.endswith(extension)
    assert asset.size_bytes == len(content)
    assert storage_client.puts == [
        {
            "key": asset.object_key,
            "content": content,
            "content_type": content_type,
            "size_bytes": len(content),
        }
    ]
    assert [(item.task_id, item.slot, item.asset_id) for item in references] == [
        ("task-1", "video", asset.id)
    ]
    assert asset.metadata == {
        "origin": "aigc",
        "aigc_role": "output",
        "provider": "mediakit",
        "operation": "video_enhancement",
        "pipeline_id": "pipeline-1",
        "run_id": "run-1",
        "node_id": "enhance-1",
        "task_id": "task-1",
        "input_asset_id": "input-video-1",
        "provider_task_id": "mediakit-task-1",
        "tool_version": "professional",
        "enhance_style": "natural",
        "resolution_mode": "preset",
        "resolution": "4k",
        "fps": 60,
        "bitrate_mode": "custom",
        "bitrate": 18000,
        "bit_depth": 10,
        "duration_seconds": 12.5,
        "executor_version": "video-enhancement-v1",
        "name": f"广告画布-视频画质增强-视频1{extension}",
        "name_scheme": "aigc_canvas_node_v1",
        "storage_provider": "tos",
    }
    serialized_metadata = str(asset.metadata)
    assert "X-Tos-Signature" not in serialized_metadata
    assert "source_url" not in asset.metadata
    assert "api_key" not in asset.metadata
    assert "raw_response" not in asset.metadata


def test_store_aigc_video_enhancement_supports_legacy_stream_upload_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = InMemoryRepository()
    monkeypatch.setattr(repository, "add_aigc_task_assets", lambda items: items)
    storage_client = LegacyStreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            content=MP4_BYTES,
        ),
        storage_client,
    )

    asyncio.run(
        service.store_aigc_video_enhancement(
            repository,
            _input("https://temporary.example/video.mp4"),
        )
    )

    assert storage_client.content == MP4_BYTES


@pytest.mark.parametrize("status_code", [403, 500])
def test_store_aigc_video_enhancement_rejects_expired_or_failed_http_response(
    status_code: int,
) -> None:
    source_url = (
        "https://temporary.example/video.mp4"
        "?X-Tos-Expires=86400&X-Tos-Signature=expired"
    )
    repository = InMemoryRepository()
    storage_client = StreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            status_code,
            headers={"content-type": "text/plain"},
            content=b"expired",
        ),
        storage_client,
    )

    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(
            service.store_aigc_video_enhancement(repository, _input(source_url))
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.puts == []
    assert storage_client.deletes == []


def test_store_aigc_video_enhancement_rejects_mime_content_mismatch() -> None:
    repository = InMemoryRepository()
    storage_client = StreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            content=MOV_BYTES,
        ),
        storage_client,
    )

    with pytest.raises(ValueError, match="MIME type does not match content"):
        asyncio.run(
            service.store_aigc_video_enhancement(
                repository,
                _input("https://temporary.example/video"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.puts == []


def test_store_aigc_video_enhancement_stops_at_maximum_bytes() -> None:
    repository = InMemoryRepository()
    storage_client = StreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            stream=ChunkedStream([MP4_BYTES[:12], MP4_BYTES[12:]]),
        ),
        storage_client,
        max_bytes=16,
    )

    with pytest.raises(ValueError, match="maximum size"):
        asyncio.run(
            service.store_aigc_video_enhancement(
                repository,
                _input("https://temporary.example/video.mp4"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.puts == []


def test_store_aigc_video_enhancement_rolls_back_interrupted_download() -> None:
    repository = InMemoryRepository()
    storage_client = StreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            stream=ChunkedStream([MP4_BYTES[:12], MP4_BYTES[12:]], fail_after=1),
        ),
        storage_client,
    )

    with pytest.raises(httpx.ReadError, match="interrupted"):
        asyncio.run(
            service.store_aigc_video_enhancement(
                repository,
                _input("https://temporary.example/video.mp4"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.puts == []


def test_store_aigc_video_enhancement_times_out_download() -> None:
    repository = InMemoryRepository()
    storage_client = StreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            stream=HangingStream(),
        ),
        storage_client,
        timeout_seconds=0.01,
    )

    with pytest.raises(TimeoutError):
        asyncio.run(
            service.store_aigc_video_enhancement(
                repository,
                _input("https://temporary.example/video.mp4"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.puts == []


def test_store_aigc_video_enhancement_rolls_back_storage_failure() -> None:
    repository = InMemoryRepository()
    storage_client = StreamingObjectStorageClient(fail_upload=True)
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            content=MP4_BYTES,
        ),
        storage_client,
    )

    with pytest.raises(RuntimeError, match="TOS stream failure"):
        asyncio.run(
            service.store_aigc_video_enhancement(
                repository,
                _input("https://temporary.example/video.mp4"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert len(storage_client.deletes) == 1


def test_store_aigc_video_enhancement_rolls_back_database_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = InMemoryRepository()
    monkeypatch.setattr(
        repository,
        "create_asset",
        lambda _data: (_ for _ in ()).throw(RuntimeError("database unavailable")),
    )
    storage_client = StreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            content=MP4_BYTES,
        ),
        storage_client,
    )

    with pytest.raises(RuntimeError, match="database unavailable"):
        asyncio.run(
            service.store_aigc_video_enhancement(
                repository,
                _input("https://temporary.example/video.mp4"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.deletes == [storage_client.puts[0]["key"]]


def test_store_aigc_video_enhancement_rolls_back_reference_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = InMemoryRepository()
    monkeypatch.setattr(
        repository,
        "add_aigc_task_assets",
        lambda _items: (_ for _ in ()).throw(RuntimeError("reference failed")),
    )
    storage_client = StreamingObjectStorageClient()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            content=MP4_BYTES,
        ),
        storage_client,
    )

    with pytest.raises(RuntimeError, match="reference failed"):
        asyncio.run(
            service.store_aigc_video_enhancement(
                repository,
                _input("https://temporary.example/video.mp4"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.deletes == [storage_client.puts[0]["key"]]
