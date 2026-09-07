from __future__ import annotations

from typing import Protocol

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app.repositories import InMemoryRepository, MySQLRepository, NotFoundError
from backend.app.schemas import (
    AssetCreate,
    AssetRenameRequest,
    AssetRole,
    AssetType,
    ProjectCreate,
    ReferenceAssetKind,
    Stage,
    Status,
    ToolAssetRole,
    ToolTaskCreate,
    ToolTaskInputAsset,
    ToolTaskType,
)


class AssetRenameRepository(Protocol):
    def create_project(self, data: ProjectCreate): ...

    def create_asset(self, data: AssetCreate): ...

    def get_asset(self, asset_id: str): ...

    def rename_asset(self, asset_id: str, *, name: str): ...

    def create_tool_task_with_input_assets(self, data, inputs): ...

    def get_tool_task(self, task_id: str): ...


@pytest.fixture(params=["memory", "mysql"])
def asset_repository(
    request: pytest.FixtureRequest,
    repository: InMemoryRepository,
    mysql_repository: MySQLRepository,
) -> AssetRenameRepository:
    return repository if request.param == "memory" else mysql_repository


def _create_project(repository: AssetRenameRepository) -> str:
    return repository.create_project(
        ProjectCreate.model_validate(
            {
                "name": "Asset rename",
                "brief": {"prompt": "Verify asset rename behavior"},
            }
        )
    ).id


@pytest.mark.parametrize(
    ("raw_name", "expected"),
    [
        (" 商品主图 ", "商品主图"),
        ("😀", "😀"),
        ("界" * 120, "界" * 120),
        ("名称\x80", "名称\x80"),
        ("名称\x9f", "名称\x9f"),
    ],
)
def test_asset_rename_request_trims_and_counts_unicode_code_points(
    raw_name: str,
    expected: str,
) -> None:
    assert AssetRenameRequest(name=raw_name).name == expected


@pytest.mark.parametrize(
    "name",
    [
        "",
        " \t ",
        "界" * 121,
        "bad\x00name",
        "bad\x1fname",
        "bad\x7fname",
        "\nvalid",
    ],
)
def test_asset_rename_request_rejects_invalid_names(name: str) -> None:
    with pytest.raises(ValidationError):
        AssetRenameRequest(name=name)


def test_repository_rename_preserves_asset_fields_and_metadata(
    asset_repository: AssetRenameRepository,
) -> None:
    project_id = _create_project(asset_repository)
    asset = asset_repository.create_asset(
        AssetCreate(
            id="project-asset",
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            category="scene",
            asset_role=AssetRole.PUBLIC,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            url="https://origin.example/project-asset.png",
            object_key="projects/project-asset.png",
            mime_type="image/png",
            size_bytes=1234,
            source_task_id=None,
            metadata={
                "name": "旧名称",
                "name_scheme": "aigc_canvas_node_v1",
                "pipeline_id": "pipeline-1",
                "node_id": "node-1",
                "nested": {"kept": True},
            },
        )
    )

    renamed = asset_repository.rename_asset(asset.id, name="新名称")

    assert renamed.metadata == {
        "name": "新名称",
        "name_scheme": "user_defined_v1",
        "pipeline_id": "pipeline-1",
        "node_id": "node-1",
        "nested": {"kept": True},
    }
    for field in (
        "id",
        "project_id",
        "tool_task_id",
        "tool_asset_role",
        "type",
        "category",
        "asset_role",
        "status",
        "stage",
        "url",
        "object_key",
        "mime_type",
        "size_bytes",
        "source_task_id",
        "created_at",
    ):
        assert getattr(renamed, field) == getattr(asset, field)
    assert asset_repository.get_asset(asset.id).metadata == renamed.metadata


def test_repository_rename_rejects_internal_asset_as_not_found(
    asset_repository: AssetRenameRepository,
) -> None:
    project_id = _create_project(asset_repository)
    asset = asset_repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            asset_role=AssetRole.INTERNAL_LAYER,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            metadata={"name": "internal", "trace": "kept"},
        )
    )

    with pytest.raises(NotFoundError):
        asset_repository.rename_asset(asset.id, name="hidden")

    assert asset_repository.get_asset(asset.id).metadata == {
        "name": "internal",
        "trace": "kept",
    }


def test_repository_rename_preserves_asset_references(
    asset_repository: AssetRenameRepository,
) -> None:
    asset = asset_repository.create_asset(
        AssetCreate(
            id="referenced-tool-asset",
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.UPLOADED_IMAGE,
            status=Status.SUCCEEDED,
            metadata={"name": "before"},
        )
    )
    task_data = ToolTaskCreate(type=ToolTaskType.FACE_BLUR_VIDEO)
    task = asset_repository.create_tool_task_with_input_assets(
        task_data,
        [
            ToolTaskInputAsset(
                task_id=task_data.id,
                asset_id=asset.id,
                kind=ReferenceAssetKind.IMAGE,
            )
        ],
    )

    asset_repository.rename_asset(asset.id, name="after")

    persisted_task = asset_repository.get_tool_task(task.id)
    assert [item.asset_id for item in persisted_task.input_assets] == [asset.id]


def test_patch_asset_renames_project_asset_and_decorates_access_url(
    client: TestClient,
    repository: InMemoryRepository,
) -> None:
    project_id = _create_project(repository)
    asset = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            category="character",
            status=Status.SUCCEEDED,
            stage=Stage.CHARACTER,
            url="https://origin.example/project.png",
            object_key="projects/project.png",
            mime_type="image/png",
            metadata={"name": "旧名称", "prompt": "保留提示词"},
        )
    )

    response = client.patch(
        f"/api/assets/{asset.id}",
        json={"name": "  用户名称  "},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["url"] == f"/api/assets/{asset.id}/content"
    assert payload["object_key"] == asset.object_key
    assert payload["project_id"] == project_id
    assert payload["metadata"] == {
        "name": "用户名称",
        "name_scheme": "user_defined_v1",
        "prompt": "保留提示词",
    }


@pytest.mark.parametrize(
    ("asset_id", "asset_kwargs"),
    [
        (
            "tool-asset",
            {
                "tool_asset_role": ToolAssetRole.INPUT,
                "metadata": {"origin": "tool", "tool_task_id": "trace-task"},
            },
        ),
        (
            "aigc-asset",
            {
                "tool_asset_role": ToolAssetRole.OUTPUT,
                "metadata": {
                    "origin": "aigc",
                    "pipeline_id": "pipeline-1",
                    "run_id": "run-1",
                    "node_id": "node-1",
                    "task_id": "task-1",
                },
            },
        ),
    ],
)
def test_patch_asset_renames_standalone_tool_and_aigc_assets(
    client: TestClient,
    repository: InMemoryRepository,
    asset_id: str,
    asset_kwargs: dict[str, object],
) -> None:
    asset = repository.create_asset(
        AssetCreate(
            id=asset_id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            object_key=f"tools/library/{asset_id}.png",
            mime_type="image/png",
            **asset_kwargs,
        )
    )
    original_metadata = dict(asset.metadata)

    response = client.patch(f"/api/assets/{asset.id}", json={"name": "新名字"})

    assert response.status_code == 200
    assert response.json()["metadata"] == {
        **original_metadata,
        "name": "新名字",
        "name_scheme": "user_defined_v1",
    }
    persisted = repository.get_asset(asset.id)
    assert persisted.object_key == asset.object_key
    assert persisted.tool_asset_role == asset.tool_asset_role


@pytest.mark.parametrize("name", ["", " ", "x" * 121, "bad\x00name", "bad\x7fname"])
def test_patch_asset_rejects_invalid_name_without_updating_metadata(
    client: TestClient,
    repository: InMemoryRepository,
    name: str,
) -> None:
    asset = repository.create_asset(
        AssetCreate(
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            metadata={"name": "original", "trace": "kept"},
        )
    )

    response = client.patch(f"/api/assets/{asset.id}", json={"name": name})

    assert response.status_code == 422
    assert repository.get_asset(asset.id).metadata == {
        "name": "original",
        "trace": "kept",
    }


def test_patch_asset_returns_same_404_for_missing_and_internal_assets(
    client: TestClient,
    repository: InMemoryRepository,
) -> None:
    project_id = _create_project(repository)
    internal = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            asset_role=AssetRole.INTERNAL_BASE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
        )
    )

    missing_response = client.patch(
        "/api/assets/missing-asset",
        json={"name": "rename"},
    )
    internal_response = client.patch(
        f"/api/assets/{internal.id}",
        json={"name": "rename"},
    )

    assert missing_response.status_code == 404
    assert internal_response.status_code == 404
    assert missing_response.json() == internal_response.json()
