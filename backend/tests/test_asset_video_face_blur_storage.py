from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import BinaryIO

import httpx
import pytest

from backend.app.repositories import InMemoryRepository
from backend.app.schemas import AssetRole, AssetType, Status
from backend.app.services.assets import (
    AigcVideoFaceBlurAssetInput,
    AssetStorageService,
    HttpRemoteAssetDownloader,
)


MP4_BYTES = b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00isommp42video"
MOV_BYTES = b"\x00\x00\x00\x18ftypqt  \x00\x00\x00\x00qt  videodata"


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
        raise AssertionError("face-blur videos must not use the byte upload API")

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


def _input(source_url: str) -> AigcVideoFaceBlurAssetInput:
    return AigcVideoFaceBlurAssetInput(
        source_url=source_url,
        pipeline_id="pipeline-1",
        run_id="run-1",
        node_id="face-blur-1",
        task_id="task-1",
        input_asset_id="input-video-1",
        provider_task_id="mediakit-task-1",
        provider_request_id="mediakit-request-1",
        mask_mode="mosaic",
        mask_strength="high",
        duration_seconds=12.5,
        executor_version="aigc-video-face-blur-v1",
    )


def _service(
    handler,
    storage_client: StreamingObjectStorageClient,
    *,
    max_bytes: int = 1024,
) -> AssetStorageService:
    face_blur_downloader = HttpRemoteAssetDownloader(
        timeout_seconds=5,
        max_bytes=max_bytes,
        transport=httpx.MockTransport(handler),
    )
    return AssetStorageService(
        bucket="assets",
        public_endpoint="https://assets.example",
        client=storage_client,
        downloader=HttpRemoteAssetDownloader(
            timeout_seconds=5,
            max_bytes=1,
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(500)
            ),
        ),
        face_blur_downloader=face_blur_downloader,
        face_blur_transfer_timeout_seconds=5,
        face_blur_transfer_max_bytes=max_bytes,
    )


@pytest.mark.parametrize(
    ("content_type", "content", "extension"),
    [
        ("video/mp4", MP4_BYTES, ".mp4"),
        ("video/quicktime", MOV_BYTES, ".mov"),
    ],
)
def test_store_aigc_video_face_blur_streams_and_registers_actual_format(
    monkeypatch: pytest.MonkeyPatch,
    content_type: str,
    content: bytes,
    extension: str,
) -> None:
    source_url = (
        "https://temporary.example/output"
        "?X-Tos-Signature=secret&api_key=must-not-persist"
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
        service.store_aigc_video_face_blur(repository, _input(source_url))
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
        "operation": "face_blur_video",
        "pipeline_id": "pipeline-1",
        "run_id": "run-1",
        "node_id": "face-blur-1",
        "task_id": "task-1",
        "input_asset_id": "input-video-1",
        "provider_task_id": "mediakit-task-1",
        "provider_request_id": "mediakit-request-1",
        "mask_mode": "mosaic",
        "mask_strength": "high",
        "duration_seconds": 12.5,
        "executor_version": "aigc-video-face-blur-v1",
        "storage_provider": "tos",
    }
    serialized_metadata = str(asset.metadata)
    assert "X-Tos-Signature" not in serialized_metadata
    assert "must-not-persist" not in serialized_metadata
    assert "source_url" not in asset.metadata
    assert "raw_response" not in asset.metadata


@pytest.mark.parametrize(
    ("handler", "error_type", "message", "max_bytes"),
    [
        (
            lambda _request: httpx.Response(
                403,
                headers={"content-type": "text/plain"},
                content=b"expired",
            ),
            httpx.HTTPStatusError,
            None,
            1024,
        ),
        (
            lambda _request: httpx.Response(
                200,
                headers={"content-type": "video/mp4"},
                content=MOV_BYTES,
            ),
            ValueError,
            "MIME type does not match content",
            1024,
        ),
        (
            lambda _request: httpx.Response(
                200,
                headers={"content-type": "video/mp4"},
                stream=ChunkedStream([MP4_BYTES[:12], MP4_BYTES[12:]]),
            ),
            ValueError,
            "maximum size",
            16,
        ),
        (
            lambda _request: httpx.Response(
                200,
                headers={"content-type": "video/mp4"},
                stream=ChunkedStream(
                    [MP4_BYTES[:12], MP4_BYTES[12:]],
                    fail_after=1,
                ),
            ),
            httpx.ReadError,
            "interrupted",
            1024,
        ),
    ],
)
def test_store_aigc_video_face_blur_rejects_invalid_remote_result_without_residue(
    handler,
    error_type: type[Exception],
    message: str | None,
    max_bytes: int,
) -> None:
    repository = InMemoryRepository()
    storage_client = StreamingObjectStorageClient()
    service = _service(handler, storage_client, max_bytes=max_bytes)

    with pytest.raises(error_type, match=message):
        asyncio.run(
            service.store_aigc_video_face_blur(
                repository,
                _input("https://temporary.example/video.mp4?signature=secret"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.puts == []
    assert storage_client.deletes == []


def test_store_aigc_video_face_blur_rolls_back_storage_failure() -> None:
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
            service.store_aigc_video_face_blur(
                repository,
                _input("https://temporary.example/video.mp4"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert len(storage_client.deletes) == 1


@pytest.mark.parametrize("failure_stage", ["asset", "reference"])
def test_store_aigc_video_face_blur_rolls_back_database_failure(
    monkeypatch: pytest.MonkeyPatch,
    failure_stage: str,
) -> None:
    repository = InMemoryRepository()
    if failure_stage == "asset":
        monkeypatch.setattr(
            repository,
            "create_asset",
            lambda _data: (_ for _ in ()).throw(
                RuntimeError("asset registration failed")
            ),
        )
    else:
        monkeypatch.setattr(
            repository,
            "add_aigc_task_assets",
            lambda _items: (_ for _ in ()).throw(
                RuntimeError("reference registration failed")
            ),
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

    with pytest.raises(RuntimeError, match="registration failed"):
        asyncio.run(
            service.store_aigc_video_face_blur(
                repository,
                _input("https://temporary.example/video.mp4"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage_client.deletes == [storage_client.puts[0]["key"]]
