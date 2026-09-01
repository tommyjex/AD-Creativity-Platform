from __future__ import annotations

from sqlalchemy import inspect

from backend.app.api.dependencies import get_asset_storage_service
from backend.app.db import create_database_engine, init_database, make_session_factory
from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.schemas import (
    AssetCreate,
    AssetType,
    ReferenceAssetKind,
    Status,
    ToolAssetRole,
    ToolTaskCreate,
    ToolTaskInputAsset,
    ToolTaskType,
)
from backend.app.services.assets import AssetStorageService
from backend.app.services.video_normalizer import NormalizedVideo


def test_standalone_tool_asset_and_input_reference_are_persisted_by_memory_repository() -> None:
    repository = InMemoryRepository()
    asset = repository.create_asset(
        AssetCreate(
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.UPLOADED_VIDEO,
            status=Status.SUCCEEDED,
            mime_type="video/mp4",
        )
    )

    assert repository.get_asset(asset.id).project_id is None
    assert repository.get_asset(asset.id).tool_task_id is None
    assert repository.list_assets() == [asset]
    task_data = ToolTaskCreate(type=ToolTaskType.MULTIMODAL_VIDEO_GENERATION)
    task = repository.create_tool_task_with_input_assets(
        task_data,
        [
            ToolTaskInputAsset(
                task_id=task_data.id,
                asset_id=asset.id,
                kind=ReferenceAssetKind.VIDEO,
            )
        ],
    )
    assert task.input_assets[0].asset_id == asset.id


def test_tool_task_input_reference_is_persisted_by_mysql_repository(tmp_path) -> None:
    engine = create_database_engine(f"sqlite:///{tmp_path / 'tools.sqlite'}")
    init_database(engine)
    repository = MySQLRepository(make_session_factory(engine))
    asset = repository.create_asset(
        AssetCreate(
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.UPLOADED_IMAGE,
            status=Status.SUCCEEDED,
            mime_type="image/png",
        )
    )

    task_data = ToolTaskCreate(type=ToolTaskType.FACE_BLUR_VIDEO)
    task = repository.create_tool_task_with_input_assets(
        task_data,
        [
            ToolTaskInputAsset(
                task_id=task_data.id,
                asset_id=asset.id,
                kind=ReferenceAssetKind.IMAGE,
            )
        ],
    )
    assert repository.get_tool_task(task.id).input_assets[0].asset_id == asset.id
    assert repository.get_asset(asset.id).tool_task_id is None
    assert repository.list_assets() == [asset]
    assert "tool_tasks" in inspect(engine).get_table_names()
    assert "tool_task_input_assets" in inspect(engine).get_table_names()
    asset_columns = {
        column["name"]: column for column in inspect(engine).get_columns("assets")
    }
    assert asset_columns["project_id"]["nullable"] is True
    assert "tool_task_id" in asset_columns


def test_tool_asset_upload_is_unowned_and_reusable(client, repository) -> None:
    upload = client.post(
        "/api/tools/assets/upload",
        params={
            "kind": "image",
            "filename": "reference.png",
            "mime_type": "image/png",
        },
        content=b"\x89PNG\r\n\x1a\nreference",
        headers={"content-type": "application/octet-stream"},
    )

    assert upload.status_code == 201
    asset = upload.json()
    assert asset["project_id"] is None
    assert asset["tool_task_id"] is None
    assert asset["tool_asset_role"] == "input"
    assert asset["object_key"].startswith("tools/library/uploaded_image/")

    listed = client.get("/api/tools/assets", params={"kind": "image"})
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [asset["id"]]


def test_tool_video_upload_persists_normalized_mp4(client, test_asset_storage, video_normalizer) -> None:
    async def normalize(content: bytes) -> NormalizedVideo:
        assert content == b"mpeg-program-stream"
        return NormalizedVideo(
            content=b"browser-compatible-mp4",
            normalized=True,
            source_format="mpeg",
        )

    video_normalizer.normalize_if_needed = normalize

    upload = client.post(
        "/api/tools/assets/upload",
        params={
            "kind": "video",
            "filename": "camera-export.mp4",
            "mime_type": "video/mpeg",
        },
        content=b"mpeg-program-stream",
        headers={"content-type": "application/octet-stream"},
    )

    assert upload.status_code == 201
    asset = upload.json()
    assert asset["mime_type"] == "video/mp4"
    assert asset["metadata"] == {
        "name": "camera-export.mp4",
        "original_filename": "camera-export.mp4",
        "source_container": "mpeg",
        "storage_provider": "tos",
        "tool_asset_kind": "video",
        "video_normalized": True,
    }
    storage_client = test_asset_storage.client
    assert storage_client is not None
    assert storage_client.puts[-1]["content"] == b"browser-compatible-mp4"
    assert storage_client.puts[-1]["key"].endswith(".mp4")


def test_tool_asset_upload_rolls_back_object_when_repository_write_fails(
    client,
    repository,
    test_asset_storage,
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        repository,
        "create_asset",
        lambda _asset: (_ for _ in ()).throw(RuntimeError("database write failed")),
    )
    client.app.dependency_overrides[get_asset_storage_service] = lambda: test_asset_storage

    response = client.post(
        "/api/tools/assets/upload",
        params={
            "kind": ReferenceAssetKind.AUDIO.value,
            "filename": "voice.mp3",
            "mime_type": "audio/mpeg",
        },
        content=b"audio",
        headers={"content-type": "application/octet-stream"},
    )

    assert response.status_code == 502
    storage_client = test_asset_storage.client
    assert storage_client is not None
    assert storage_client.deletes == [storage_client.puts[0]["key"]]
