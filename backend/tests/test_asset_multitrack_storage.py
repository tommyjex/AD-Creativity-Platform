from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import BinaryIO

import httpx
import pytest

from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.schemas import (
    AigcAssetDirection,
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineRun,
    AigcPipelineRunNode,
    AigcPipelineTaskAssetReference,
    AigcPipelineTaskAttempt,
    AigcRunNodeStatus,
    AigcTaskType,
    AssetCreate,
    AssetRole,
    AssetType,
    Stage,
    Status,
    ToolAssetRole,
)
from backend.app.services.assets import (
    AigcMultiTrackAssetInput,
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
            if index == self.fail_after:
                raise httpx.ReadError("remote stream interrupted")
            yield chunk

    async def aclose(self) -> None:
        pass


class StreamingStorage:
    def __init__(self, *, fail_upload: bool = False) -> None:
        self.fail_upload = fail_upload
        self.puts: list[dict[str, object]] = []
        self.deletes: list[str] = []

    def put_object(
        self,
        *,
        key: str,
        content: bytes | BinaryIO,
        content_type: str | None = None,
    ) -> None:
        raise AssertionError("multi-track output must use streaming upload")

    def put_object_from_file(
        self,
        *,
        key: str,
        file_path: str,
        content_type: str | None = None,
        size_bytes: int | None = None,
    ) -> None:
        if self.fail_upload:
            raise RuntimeError("simulated object storage failure")
        with open(file_path, "rb") as source:
            content = source.read()
        self.puts.append(
            {
                "key": key,
                "content": content,
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


def _input(source_url: str) -> AigcMultiTrackAssetInput:
    return AigcMultiTrackAssetInput(
        source_url=source_url,
        pipeline_id="pipeline-1",
        run_id="run-1",
        node_id="multitrack-1",
        task_id="task-1",
        input_asset_ids={
            "video": ("video-1",),
            "image": ("image-1",),
            "audio": ("audio-1",),
            "subtitle": ("subtitle-1",),
        },
        provider_task_id="mediakit-task-1",
        provider_request_id="mediakit-request-1",
        canvas={
            "mode": "custom",
            "width": 1920,
            "height": 1080,
            "background_color": "#000000FF",
            "signed_url": "must-not-persist",
        },
        tracks=[
            {
                "id": "track-video",
                "name": "Video",
                "type": "video",
                "order": 0,
                "hidden": False,
                "muted": False,
                "elements": [
                    {
                        "id": "element-video",
                        "type": "video",
                        "source": {
                            "source_node_id": "source-video",
                            "source_handle": "video",
                            "url": "https://secret.example/video",
                        },
                        "target_time": {"start_ms": 0, "end_ms": 5000},
                        "provider_only": "drop",
                    }
                ],
                "provider_only": "drop",
            },
            {
                "id": "track-text",
                "name": "Text",
                "type": "text",
                "order": 1,
                "hidden": False,
                "muted": False,
                "elements": [
                    {
                        "id": "element-text",
                        "type": "text",
                        "target_time": {"start_ms": 0, "end_ms": 5000},
                        "inline_text": "Title",
                        "style": {
                            "font_type": (
                                "https://fonts.example.com/title.ttf?version=1"
                            ),
                            "font_size": 48,
                            "color": "#FFFFFFFF",
                            "provider_only": "drop",
                        },
                    }
                ],
            },
        ],
        duration_ms=5000,
        width=1920,
        height=1080,
        fps=30,
        executor_version="aigc-multitrack-v1",
    )


def _service(
    handler,
    storage: StreamingStorage,
    *,
    max_bytes: int = 1024,
) -> AssetStorageService:
    downloader = HttpRemoteAssetDownloader(
        timeout_seconds=5,
        max_bytes=max_bytes,
        transport=httpx.MockTransport(handler),
    )
    return AssetStorageService(
        bucket="assets",
        public_endpoint="https://assets.example",
        client=storage,
        downloader=downloader,
        multitrack_downloader=downloader,
        multitrack_transfer_timeout_seconds=5,
        multitrack_transfer_max_bytes=max_bytes,
    )


def test_store_aigc_multitrack_video_streams_registers_and_traces_all_inputs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = InMemoryRepository()
    captured_references: list[AigcPipelineTaskAssetReference] = []
    original = repository.create_aigc_output_asset

    def capture(data, references):
        captured_references.extend(references)
        return original(data, references=references)

    monkeypatch.setattr(repository, "create_aigc_output_asset", capture)
    _seed_task_and_inputs(repository)
    storage = StreamingStorage()
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            stream=ChunkedStream([MP4_BYTES[:9], MP4_BYTES[9:17], MP4_BYTES[17:]]),
        ),
        storage,
    )

    asset = asyncio.run(
        service.store_aigc_multitrack_video(
            repository,
            _input(
                "https://temporary.example/output.mp4"
                "?X-Tos-Signature=secret&api_key=must-not-persist"
            ),
        )
    )

    assert asset.type == AssetType.STORYBOARD_VIDEO
    assert asset.asset_role == AssetRole.PUBLIC
    assert asset.status == Status.SUCCEEDED
    assert asset.mime_type == "video/mp4"
    assert asset.size_bytes == len(MP4_BYTES)
    assert storage.puts[0]["content"] == MP4_BYTES
    assert [
        (item.direction.value, item.slot, item.ordinal, item.asset_id)
        for item in captured_references
    ] == [
        ("input", "video", 0, "video-1"),
        ("input", "image", 0, "image-1"),
        ("input", "audio", 0, "audio-1"),
        ("input", "subtitle", 0, "subtitle-1"),
        ("output", "video", 0, asset.id),
    ]
    assert asset.metadata == {
        "origin": "aigc",
        "aigc_role": "output",
        "provider": "mediakit",
        "operation": "multi_track_edit",
        "pipeline_id": "pipeline-1",
        "run_id": "run-1",
        "node_id": "multitrack-1",
        "task_id": "task-1",
        "provider_task_id": "mediakit-task-1",
        "provider_request_id": "mediakit-request-1",
        "track_count": 2,
        "element_count": 2,
        "canvas": {
            "mode": "custom",
            "width": 1920,
            "height": 1080,
            "background_color": "#000000FF",
        },
        "tracks": [
            {
                "id": "track-video",
                "name": "Video",
                "type": "video",
                "order": 0,
                "hidden": False,
                "muted": False,
                "elements": [
                    {
                        "id": "element-video",
                        "type": "video",
                        "source": {
                            "source_node_id": "source-video",
                            "source_handle": "video",
                        },
                        "target_time": {"start_ms": 0, "end_ms": 5000},
                    }
                ],
            },
            {
                "id": "track-text",
                "name": "Text",
                "type": "text",
                "order": 1,
                "hidden": False,
                "muted": False,
                "elements": [
                    {
                        "id": "element-text",
                        "type": "text",
                        "target_time": {"start_ms": 0, "end_ms": 5000},
                        "inline_text": "Title",
                        "style": {
                            "font_type": (
                                "https://fonts.example.com/title.ttf?version=1"
                            ),
                            "font_size": 48,
                            "color": "#FFFFFFFF",
                        },
                    }
                ],
            },
        ],
        "duration_ms": 5000,
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "executor_version": "aigc-multitrack-v1",
        "storage_provider": "tos",
    }
    serialized = str(asset.metadata)
    assert "Signature" not in serialized
    assert "api_key" not in serialized
    assert "signed_url" not in serialized
    assert "provider_only" not in serialized


@pytest.mark.parametrize(
    ("handler", "error_type", "message", "max_bytes"),
    [
        (
            lambda _request: httpx.Response(403, content=b"expired"),
            httpx.HTTPStatusError,
            None,
            1024,
        ),
        (
            lambda _request: httpx.Response(
                200,
                headers={"content-type": "text/html"},
                content=b"expired",
            ),
            ValueError,
            "not a video",
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
                content=b"not-a-video",
            ),
            ValueError,
            "not an MP4 or MOV",
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
def test_store_aigc_multitrack_video_rejects_remote_failures_without_residue(
    handler,
    error_type: type[Exception],
    message: str | None,
    max_bytes: int,
) -> None:
    repository = InMemoryRepository()
    storage = StreamingStorage()
    service = _service(handler, storage, max_bytes=max_bytes)

    with pytest.raises(error_type, match=message):
        asyncio.run(
            service.store_aigc_multitrack_video(
                repository,
                _input("https://temporary.example/output"),
            )
        )

    assert repository.list_assets(asset_role=None) == []
    assert storage.puts == []
    assert storage.deletes == []


def test_store_aigc_multitrack_video_rejects_non_https_url_before_download() -> None:
    requests: list[httpx.Request] = []
    storage = StreamingStorage()
    service = _service(
        lambda request: requests.append(request) or httpx.Response(200),
        storage,
    )

    with pytest.raises(ValueError, match="must use HTTPS"):
        asyncio.run(
            service.store_aigc_multitrack_video(
                InMemoryRepository(),
                _input("http://temporary.example/output.mp4"),
            )
        )

    assert requests == []


@pytest.mark.parametrize("failure", ["storage", "database"])
def test_store_aigc_multitrack_video_cleans_object_and_database_on_failure(
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    repository = InMemoryRepository()
    _seed_task_and_inputs(repository)
    storage = StreamingStorage(fail_upload=failure == "storage")
    service = _service(
        lambda _request: httpx.Response(
            200,
            headers={"content-type": "video/mp4"},
            content=MP4_BYTES,
        ),
        storage,
    )
    if failure == "database":
        monkeypatch.setattr(
            repository,
            "create_aigc_output_asset",
            lambda *_args, **_kwargs: (_ for _ in ()).throw(
                RuntimeError("simulated database failure")
            ),
        )

    with pytest.raises(RuntimeError):
        asyncio.run(
            service.store_aigc_multitrack_video(
                repository,
                _input("https://temporary.example/output.mp4"),
            )
        )

    assert {
        asset.id for asset in repository.list_assets(asset_role=None)
    } == {"video-1", "image-1", "audio-1", "subtitle-1"}
    assert repository.list_aigc_task_assets("task-1") == []
    assert len(storage.deletes) == 1


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_create_aigc_output_asset_is_atomic_for_asset_and_references(
    request: pytest.FixtureRequest,
    repository_fixture: str,
) -> None:
    repository = request.getfixturevalue(repository_fixture)
    _seed_task_and_inputs(repository)
    output = _output_asset("output-1")
    references = _references(output.id)

    created = repository.create_aigc_output_asset(output, references=references)

    assert created.id == output.id
    assert repository.get_asset(output.id).id == output.id
    assert {
        (item.direction, item.slot, item.ordinal, item.asset_id)
        for item in repository.list_aigc_task_assets("task-1")
    } == {
        (item.direction, item.slot, item.ordinal, item.asset_id)
        for item in references
    }


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_create_aigc_output_asset_accepts_matching_pre_recorded_inputs(
    request: pytest.FixtureRequest,
    repository_fixture: str,
) -> None:
    repository = request.getfixturevalue(repository_fixture)
    _seed_task_and_inputs(repository)
    output = _output_asset("output-with-existing-input")
    references = _references(output.id)
    repository.add_aigc_task_assets(references[:4])

    created = repository.create_aigc_output_asset(output, references=references)

    assert created.id == output.id
    assert len(repository.list_aigc_task_assets("task-1")) == 5


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_create_aigc_output_asset_rolls_back_on_conflicting_existing_input(
    request: pytest.FixtureRequest,
    repository_fixture: str,
) -> None:
    repository = request.getfixturevalue(repository_fixture)
    _seed_task_and_inputs(repository)
    existing = _references("unused-output")[0]
    repository.add_aigc_task_assets([existing])
    output = _output_asset("output-conflict")
    conflicting = existing.model_copy(update={"asset_id": "image-1"})

    with pytest.raises(ValueError, match="already exists"):
        repository.create_aigc_output_asset(
            output,
            references=[
                conflicting,
                _references(output.id)[-1],
            ],
        )

    with pytest.raises(Exception):
        repository.get_asset(output.id)
    assert repository.list_aigc_task_assets("task-1") == [existing]


@pytest.mark.parametrize("repository_fixture", ["repository", "mysql_repository"])
def test_create_aigc_output_asset_rolls_back_when_any_reference_is_invalid(
    request: pytest.FixtureRequest,
    repository_fixture: str,
) -> None:
    repository = request.getfixturevalue(repository_fixture)
    _seed_task_and_inputs(repository)
    output = _output_asset("output-rollback")
    references = [
        *_references(output.id),
        AigcPipelineTaskAssetReference(
            task_id="task-1",
            direction=AigcAssetDirection.INPUT,
            slot="video",
            ordinal=99,
            asset_id="missing-input",
        ),
    ]

    with pytest.raises(Exception):
        repository.create_aigc_output_asset(output, references=references)

    with pytest.raises(Exception):
        repository.get_asset(output.id)
    assert repository.list_aigc_task_assets("task-1") == []


def _output_asset(asset_id: str) -> AssetCreate:
    return AssetCreate(
        id=asset_id,
        tool_asset_role=ToolAssetRole.OUTPUT,
        type=AssetType.STORYBOARD_VIDEO,
        asset_role=AssetRole.PUBLIC,
        status=Status.SUCCEEDED,
        stage=Stage.VIDEO,
        object_key=f"aigc/{asset_id}.mp4",
        mime_type="video/mp4",
        size_bytes=len(MP4_BYTES),
    )


def _references(output_asset_id: str) -> list[AigcPipelineTaskAssetReference]:
    return [
        AigcPipelineTaskAssetReference(
            task_id="task-1",
            direction=AigcAssetDirection.INPUT,
            slot=slot,
            ordinal=0,
            asset_id=f"{slot}-1",
        )
        for slot in ("video", "image", "audio", "subtitle")
    ] + [
        AigcPipelineTaskAssetReference(
            task_id="task-1",
            direction=AigcAssetDirection.OUTPUT,
            slot="video",
            ordinal=0,
            asset_id=output_asset_id,
        )
    ]


def _seed_task_and_inputs(repository) -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                {
                    "id": "model",
                    "type": "text_to_image",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {},
                }
            ],
            "edges": [],
        }
    )
    pipeline = repository.create_aigc_pipeline(
        AigcPipelineCreate(name="Multi-track", definition=definition)
    )
    run = repository.create_aigc_run(
        AigcPipelineRun(
            id="run-1",
            pipeline_id=pipeline.id,
            run_number=1,
            pipeline_revision=pipeline.revision,
            mode="full",
            definition_snapshot=definition,
        ),
        idempotency_key="run-1",
        nodes=[
            AigcPipelineRunNode(
                node_id="model",
                included_in_plan=True,
                status=AigcRunNodeStatus.READY,
            )
        ],
    )
    repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            task_id="task-1",
            pipeline_id=pipeline.id,
            run_id=run.run.id,
            node_id="model",
            type=AigcTaskType.MULTI_TRACK_EDIT,
            params={},
        ),
        idempotency_key="task-1",
    )
    for slot, asset_type, mime_type in (
        ("video", AssetType.UPLOADED_VIDEO, "video/mp4"),
        ("image", AssetType.UPLOADED_IMAGE, "image/png"),
        ("audio", AssetType.UPLOADED_AUDIO, "audio/mpeg"),
        ("subtitle", AssetType.SUBTITLE, "application/x-subrip"),
    ):
        repository.create_asset(
            AssetCreate(
                id=f"{slot}-1",
                tool_asset_role=ToolAssetRole.INPUT,
                type=asset_type,
                asset_role=AssetRole.PUBLIC,
                status=Status.SUCCEEDED,
                mime_type=mime_type,
            )
        )
