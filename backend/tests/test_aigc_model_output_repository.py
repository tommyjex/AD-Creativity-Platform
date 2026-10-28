from __future__ import annotations

from typing import Protocol

import pytest

from backend.app.repositories import (
    InMemoryRepository,
    MySQLRepository,
    RevisionConflictError,
)
from backend.app.schemas import (
    AigcPipelineCreate,
    AigcPipelineDefinitionV2,
    AigcPipelineUpdate,
    AigcResultAsset,
    AigcResultKind,
    AigcTaskResult,
    AssetCreate,
    AssetType,
    Status,
    ToolAssetRole,
)


class ModelOutputRepository(Protocol):
    def create_asset(self, data): ...

    def create_aigc_pipeline(self, data): ...

    def get_aigc_pipeline(self, pipeline_id: str): ...

    def update_aigc_pipeline(self, pipeline_id: str, data): ...

    def list_aigc_pipeline_assets(self, pipeline_id: str): ...

    def materialize_aigc_model_output(
        self,
        pipeline_id: str,
        *,
        source_node_id: str,
        run_id: str,
        result: AigcTaskResult,
    ): ...


@pytest.fixture(params=["memory", "mysql"])
def model_output_repository(
    request: pytest.FixtureRequest,
    repository: InMemoryRepository,
    mysql_repository: MySQLRepository,
) -> ModelOutputRepository:
    return repository if request.param == "memory" else mysql_repository


def _definition() -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                {
                    "id": "model",
                    "type": "text_to_image",
                    "position": {"x": 300, "y": 0},
                    "size": {"width": 240, "height": 160},
                    "config": {},
                }
            ],
            "edges": [],
        }
    )


def _result(asset_id: str) -> AigcTaskResult:
    return AigcTaskResult(
        kind=AigcResultKind.ASSETS,
        assets=[
            AigcResultAsset(
                asset_id=asset_id,
                ordinal=0,
                mime_type="image/png",
            )
        ],
    )


def _asset(asset_id: str) -> AssetCreate:
    return AssetCreate(
        id=asset_id,
        tool_asset_role=ToolAssetRole.OUTPUT,
        type=AssetType.GENERATED_IMAGE,
        status=Status.SUCCEEDED,
        object_key=f"aigc/{asset_id}.png",
        mime_type="image/png",
        size_bytes=100,
    )


def test_repository_materializes_latest_revision_and_backup_reference(
    model_output_repository: ModelOutputRepository,
) -> None:
    model_output_repository.create_asset(_asset("primary"))
    pipeline = model_output_repository.create_aigc_pipeline(
        AigcPipelineCreate(name="materialize", definition=_definition())
    )
    payload = pipeline.definition.model_dump(mode="json", by_alias=True)
    payload["nodes"][0]["position"] = {"x": 444, "y": 123}
    latest = model_output_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            name="latest name",
            definition=AigcPipelineDefinitionV2.model_validate(payload),
            expected_revision=pipeline.revision,
        ),
    )

    first = model_output_repository.materialize_aigc_model_output(
        pipeline.id,
        source_node_id="model",
        run_id="run-1",
        result=_result("primary"),
    )
    materialized = model_output_repository.get_aigc_pipeline(pipeline.id)
    duplicate = model_output_repository.materialize_aigc_model_output(
        pipeline.id,
        source_node_id="model",
        run_id="run-1",
        result=_result("primary"),
    )
    unchanged = model_output_repository.get_aigc_pipeline(pipeline.id)

    assert first.reason == "created"
    assert materialized.revision == latest.revision + 1
    assert materialized.name == "latest name"
    assert materialized.definition.nodes[0].position.x == 444
    generated = next(
        node
        for node in materialized.definition.nodes
        if node.id == first.node_id
    )
    assert generated.config.asset_id == "primary"
    assert duplicate.changed is False
    assert unchanged.revision == materialized.revision
    assert [
        (reference.node_id, reference.slot, reference.asset_id)
        for reference in model_output_repository.list_aigc_pipeline_assets(
            pipeline.id
        )
    ] == [(generated.id, "image", "primary")]


def test_repository_detaches_deleted_edge_but_keeps_backup_asset(
    model_output_repository: ModelOutputRepository,
) -> None:
    model_output_repository.create_asset(_asset("primary"))
    pipeline = model_output_repository.create_aigc_pipeline(
        AigcPipelineCreate(name="detach", definition=_definition())
    )
    created = model_output_repository.materialize_aigc_model_output(
        pipeline.id,
        source_node_id="model",
        run_id="run-1",
        result=_result("primary"),
    )
    materialized = model_output_repository.get_aigc_pipeline(pipeline.id)
    payload = materialized.definition.model_dump(mode="json", by_alias=True)
    payload["edges"] = []

    detached = model_output_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            name=materialized.name,
            definition=AigcPipelineDefinitionV2.model_validate(payload),
            expected_revision=materialized.revision,
        ),
    )

    old = next(node for node in detached.definition.nodes if node.id == created.node_id)
    assert old.config.asset_id == "primary"
    assert old.config.generated_by_model_node_id is None
    assert old.config.generated_output_handle is None
    assert old.config.generated_from_run_id is None
    assert [
        reference.asset_id
        for reference in model_output_repository.list_aigc_pipeline_assets(
            pipeline.id
        )
    ] == ["primary"]


def test_repository_materialization_advances_revision_without_losing_updates(
    model_output_repository: ModelOutputRepository,
) -> None:
    model_output_repository.create_asset(_asset("primary"))
    pipeline = model_output_repository.create_aigc_pipeline(
        AigcPipelineCreate(name="concurrent revision", definition=_definition())
    )
    materialized = model_output_repository.materialize_aigc_model_output(
        pipeline.id,
        source_node_id="model",
        run_id="run-1",
        result=_result("primary"),
    )

    stale_payload = pipeline.definition.model_dump(mode="json", by_alias=True)
    stale_payload["nodes"][0]["position"] = {"x": 999, "y": 999}
    with pytest.raises(RevisionConflictError):
        model_output_repository.update_aigc_pipeline(
            pipeline.id,
            AigcPipelineUpdate(
                name=pipeline.name,
                definition=AigcPipelineDefinitionV2.model_validate(
                    stale_payload
                ),
                expected_revision=pipeline.revision,
            ),
        )

    current = model_output_repository.get_aigc_pipeline(pipeline.id)
    assert current.revision == pipeline.revision + 1
    assert current.definition.nodes[0].position.x == 300
    assert any(node.id == materialized.node_id for node in current.definition.nodes)


def test_repository_materialization_write_rolls_back_atomically(
    model_output_repository: ModelOutputRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model_output_repository.create_asset(_asset("primary"))
    pipeline = model_output_repository.create_aigc_pipeline(
        AigcPipelineCreate(name="rollback", definition=_definition())
    )

    def fail_write(*args, **kwargs):
        raise RuntimeError("forced materialization failure")

    monkeypatch.setattr(
        model_output_repository,
        "_replace_aigc_pipeline_assets",
        fail_write,
    )
    with pytest.raises(RuntimeError, match="forced materialization failure"):
        model_output_repository.materialize_aigc_model_output(
            pipeline.id,
            source_node_id="model",
            run_id="run-1",
            result=_result("primary"),
        )

    after = model_output_repository.get_aigc_pipeline(pipeline.id)
    assert after.revision == pipeline.revision
    assert after.definition == pipeline.definition
    assert model_output_repository.list_aigc_pipeline_assets(pipeline.id) == []
