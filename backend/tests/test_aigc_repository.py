from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from typing import Protocol

import pytest
from sqlalchemy import event, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import ORMExecuteState

from backend.app.repositories import (
    ActiveRunConflictError,
    AssetReferenceConflictError,
    InMemoryRepository,
    MySQLRepository,
    NotFoundError,
    PipelineRunConflictError,
    RevisionConflictError,
)
from backend.app.schemas import (
    AigcAssetDirection,
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineDefinitionV2,
    AigcPipelineRun,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
    AigcPipelineTaskAssetReference,
    AigcPipelineTaskAttempt,
    AigcPipelineTemplateCreate,
    AigcPipelineTemplateUpdate,
    AigcPipelineUpdate,
    AigcResultAsset,
    AigcRunNodeStatus,
    AigcTaskError,
    AigcTaskStatus,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcResultKind,
    AigcTaskType,
    AssetCreate,
    AssetType,
    GenerationTaskCreate,
    ProjectCreate,
    Stage,
    Status,
    ToolAssetRole,
)
from backend.app.schemas.common import utc_now


class AigcRepositoryContract(Protocol):
    def create_asset(self, data: AssetCreate): ...

    def get_asset(self, asset_id: str): ...

    def delete_tool_asset(self, asset_id: str): ...

    def create_aigc_template(self, data): ...

    def get_aigc_template(self, template_id: str): ...

    def list_aigc_templates(self, q: str | None = None): ...

    def update_aigc_template(self, template_id: str, data): ...

    def delete_aigc_template(self, template_id: str): ...

    def create_aigc_pipeline(self, data): ...

    def get_aigc_pipeline(self, pipeline_id: str): ...

    def update_aigc_pipeline(self, pipeline_id: str, data): ...

    def delete_aigc_pipeline(self, pipeline_id: str): ...

    def list_aigc_pipeline_assets(self, pipeline_id: str): ...

    def create_aigc_run(self, run, *, idempotency_key: str, nodes): ...

    def get_aigc_run(self, run_id: str): ...

    def update_aigc_run(self, run_id: str, **changes): ...

    def update_aigc_run_node(self, run_id: str, node_id: str, **changes): ...

    def create_aigc_task_attempt(
        self,
        task,
        *,
        idempotency_key: str,
        retry_of_task_id: str | None = None,
    ): ...

    def get_aigc_task_attempt(self, task_id: str): ...

    def update_aigc_task_attempt(self, task_id: str, **changes): ...

    def claim_aigc_task_attempt(self, task_id: str, *, fencing_token: int): ...

    def commit_aigc_task_attempt(
        self,
        task_id: str,
        *,
        fencing_token: int,
        status,
        result,
        error,
        metrics,
    ): ...

    def add_aigc_task_assets(self, references): ...

    def list_aigc_task_assets(self, task_id: str): ...

    def acquire_aigc_worker_lease(
        self,
        owner_id: str,
        *,
        now,
        lease_seconds: int,
    ): ...

    def renew_aigc_worker_lease(
        self,
        owner_id: str,
        fencing_token: int,
        *,
        now,
        lease_seconds: int,
    ): ...


@pytest.fixture(params=["memory", "mysql"])
def aigc_repository(
    request: pytest.FixtureRequest,
    repository: InMemoryRepository,
    mysql_repository: MySQLRepository,
) -> AigcRepositoryContract:
    return repository if request.param == "memory" else mysql_repository


def definition(*, image_asset_id: str | None = None) -> AigcPipelineDefinition:
    nodes: list[dict[str, object]] = [
        {
            "id": "prompt",
            "type": "text_input",
            "position": {"x": 0, "y": 0},
            "size": {"width": 240, "height": 160},
            "config": {"text": "生成商品海报"},
        },
        {
            "id": "model",
            "type": "text_to_image",
            "position": {"x": 320, "y": 0},
            "size": {"width": 280, "height": 200},
            "config": {},
        },
    ]
    edges = [
        {
            "id": "edge-prompt-model",
            "sourceNodeId": "prompt",
            "sourceHandle": "text",
            "targetNodeId": "model",
            "targetHandle": "prompt",
        }
    ]
    if image_asset_id is not None:
        nodes.append(
            {
                "id": "reference",
                "type": "image_input",
                "position": {"x": 0, "y": 240},
                "size": {"width": 240, "height": 200},
                "config": {"asset_id": image_asset_id},
            }
        )
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": nodes,
            "edges": edges,
        }
    )


def disconnected_definition() -> AigcPipelineDefinition:
    nodes = [
        {
            "id": f"flow-{flow}-{node_type}",
            "type": schema_type,
            "position": {"x": x, "y": y},
            "size": {"width": 240, "height": 160},
            "config": config,
        }
        for flow, y in (("a", 0), ("b", 240))
        for node_type, schema_type, x, config in (
            ("input", "text_input", 0, {"text": f"流程 {flow.upper()}"}),
            ("model", "text_to_image", 320, {}),
        )
    ]
    edges = [
        {
            "id": f"flow-{flow}-edge",
            "sourceNodeId": f"flow-{flow}-input",
            "sourceHandle": "text",
            "targetNodeId": f"flow-{flow}-model",
            "targetHandle": "prompt",
        }
        for flow in ("a", "b")
    ]
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": nodes,
            "edges": edges,
        }
    )


def multitrack_subtitle_definition(
    asset_ids: tuple[str, ...],
) -> AigcPipelineDefinitionV2:
    tracks = [
        {
            "id": f"subtitle-track-{index}",
            "name": f"字幕 {index}",
            "type": "subtitle",
            "elements": [
                {
                    "id": f"subtitle-element-{index}",
                    "type": "subtitle",
                    "asset_id": asset_id,
                    "target_time": {"start_ms": 0, "end_ms": 2000},
                    "transform": {
                        "x": 100,
                        "y": 800,
                        "width": 1720,
                        "height": 180,
                    },
                }
            ],
        }
        for index, asset_id in enumerate(asset_ids)
    ]
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                {
                    "id": "edit",
                    "type": "multi_track_edit",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 320, "height": 240},
                    "config": {
                        "canvas": {
                            "mode": "custom",
                            "width": 1920,
                            "height": 1080,
                            "background_color": "#000000FF",
                        },
                        "output": {"format": "mp4", "fps": 30},
                        "tracks": tracks,
                    },
                }
            ],
            "edges": [],
        }
    )


def create_pipeline(
    repository: AigcRepositoryContract,
    *,
    pipeline_definition: AigcPipelineDefinition | None = None,
):
    return repository.create_aigc_pipeline(
        AigcPipelineCreate(
            name="商品海报工作流",
            description="测试画布",
            definition=pipeline_definition or definition(),
        )
    )


def create_run(repository: AigcRepositoryContract, pipeline):
    run = AigcPipelineRun(
        pipeline_id=pipeline.id,
        run_number=1,
        pipeline_revision=pipeline.revision,
        mode="full",
        definition_snapshot=pipeline.definition,
    )
    nodes = [
        AigcPipelineRunNode(
            node_id=node.id,
            included_in_plan=node.id == "model",
            status=(
                AigcRunNodeStatus.READY
                if node.id == "model"
                else AigcRunNodeStatus.SUCCEEDED
            ),
        )
        for node in pipeline.definition.nodes
    ]
    return repository.create_aigc_run(
        run,
        idempotency_key="run-request-1",
        nodes=nodes,
    )


def create_scoped_run(
    repository: AigcRepositoryContract,
    pipeline,
    *,
    idempotency_key: str,
    mode: str = "from_node",
    start_node_id: str | None = None,
):
    run = AigcPipelineRun(
        pipeline_id=pipeline.id,
        run_number=1,
        pipeline_revision=pipeline.revision,
        mode=mode,
        start_node_id=start_node_id,
        definition_snapshot=pipeline.definition,
    )
    nodes = [
        AigcPipelineRunNode(
            node_id=node.id,
            included_in_plan=mode == "full" or node.id.startswith(
                (start_node_id or "").rsplit("-", 1)[0]
            ),
            status=AigcRunNodeStatus.READY,
        )
        for node in pipeline.definition.nodes
    ]
    return repository.create_aigc_run(
        run,
        idempotency_key=idempotency_key,
        nodes=nodes,
    )


def test_mysql_flushes_run_parent_before_run_nodes(
    mysql_repository: MySQLRepository,
) -> None:
    pipeline = create_pipeline(mysql_repository)
    statements: list[str] = []
    with mysql_repository._session_factory() as session:
        engine = session.get_bind()

    def record_statement(_conn, _cursor, statement, _parameters, _context, _many):
        statements.append(statement.lower())

    event.listen(engine, "before_cursor_execute", record_statement)
    try:
        create_run(mysql_repository, pipeline)
    finally:
        event.remove(engine, "before_cursor_execute", record_statement)

    run_insert = next(
        index
        for index, statement in enumerate(statements)
        if statement.startswith("insert into pipeline_runs")
    )
    node_insert = next(
        index
        for index, statement in enumerate(statements)
        if statement.startswith("insert into pipeline_run_nodes")
    )
    assert run_insert < node_insert


def test_sql_repository_persists_long_aigc_task_type(
    mysql_repository: MySQLRepository,
) -> None:
    pipeline = create_pipeline(mysql_repository)
    detail = create_run(mysql_repository, pipeline)

    created = mysql_repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=detail.run.id,
            node_id="model",
            type=AigcTaskType.LAYER_DECOMPOSITION,
            params={"prompt": {"text": "split layers"}},
            upstream=["prompt"],
        ),
        idempotency_key="long-task-type",
    )

    persisted = mysql_repository.get_aigc_task_attempt(created.task_id)
    assert persisted.type == AigcTaskType.LAYER_DECOMPOSITION

    error = AigcTaskError(
        code="task_creation_failed",
        message="Failed to create AIGC task",
        stage="scheduling",
    )
    mysql_repository.update_aigc_run(detail.run.id, error=error)
    mysql_repository.update_aigc_run_node(
        detail.run.id,
        "model",
        status=AigcRunNodeStatus.FAILED,
        error=error,
    )
    failed = mysql_repository.get_aigc_run(detail.run.id)
    failed_node = next(node for node in failed.nodes if node.node_id == "model")
    assert failed.run.error == error
    assert failed_node.error == error


def test_sql_repository_separates_generation_source_fk_from_aigc_provenance(
    mysql_repository: MySQLRepository,
    mysql_session_factory,
) -> None:
    with mysql_session_factory() as session:
        engine = session.get_bind()
    source_task_fk = next(
        foreign_key
        for foreign_key in inspect(engine).get_foreign_keys("assets")
        if foreign_key["constrained_columns"] == ["source_task_id"]
    )
    assert source_task_fk["referred_table"] == "generation_tasks"

    if engine.dialect.name == "sqlite":
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")

    pipeline = create_pipeline(mysql_repository)
    detail = create_run(mysql_repository, pipeline)
    pipeline_task = mysql_repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=detail.run.id,
            node_id="model",
            type=AigcTaskType.TEXT_TO_IMAGE,
        ),
        idempotency_key="asset-provenance-task",
    )

    with pytest.raises(IntegrityError):
        mysql_repository.create_asset(
            AssetCreate(
                id="invalid-pipeline-source-fk",
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.GENERATED_IMAGE,
                status=Status.SUCCEEDED,
                object_key="aigc/invalid-source.png",
                mime_type="image/png",
                source_task_id=pipeline_task.task_id,
            )
        )
    with pytest.raises(NotFoundError):
        mysql_repository.get_asset("invalid-pipeline-source-fk")

    aigc_asset = mysql_repository.create_asset(
        AssetCreate(
            id="aigc-output-with-relationship",
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            object_key="aigc/output-with-relationship.png",
            mime_type="image/png",
            metadata={
                "origin": "aigc",
                "pipeline_id": pipeline.id,
                "run_id": detail.run.id,
                "task_id": pipeline_task.task_id,
            },
        )
    )
    mysql_repository.add_aigc_task_assets(
        [
            AigcPipelineTaskAssetReference(
                task_id=pipeline_task.task_id,
                direction=AigcAssetDirection.OUTPUT,
                slot="image",
                ordinal=0,
                asset_id=aigc_asset.id,
            )
        ]
    )

    persisted_aigc_asset = mysql_repository.get_asset(aigc_asset.id)
    assert persisted_aigc_asset.source_task_id is None
    assert persisted_aigc_asset.metadata["task_id"] == pipeline_task.task_id
    assert mysql_repository.list_aigc_task_assets(pipeline_task.task_id) == [
        AigcPipelineTaskAssetReference(
            task_id=pipeline_task.task_id,
            direction=AigcAssetDirection.OUTPUT,
            slot="image",
            ordinal=0,
            asset_id=aigc_asset.id,
        )
    ]

    project = mysql_repository.create_project(
        ProjectCreate.model_validate(
            {
                "name": "Generation source FK",
                "brief": {"prompt": "Verify generation task provenance"},
            }
        )
    )
    generation_task = mysql_repository.create_task(
        GenerationTaskCreate(
            project_id=project.id,
            stage=Stage.IMAGE,
        )
    )
    generation_asset = mysql_repository.create_asset(
        AssetCreate(
            project_id=project.id,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            stage=Stage.IMAGE,
            object_key="projects/generation-source.png",
            mime_type="image/png",
            source_task_id=generation_task.id,
        )
    )
    assert generation_asset.source_task_id == generation_task.id


def test_template_and_pipeline_revision_contract(
    aigc_repository: AigcRepositoryContract,
) -> None:
    template = aigc_repository.create_aigc_template(
        AigcPipelineTemplateCreate(
            name="商品海报模板",
            description="首期模板",
            definition=definition(),
        )
    )
    assert aigc_repository.list_aigc_templates("海报")[0].id == template.id

    updated = aigc_repository.update_aigc_template(
        template.id,
        AigcPipelineTemplateUpdate(
            name="商品海报模板 v2",
            description="更新",
            definition=template.definition,
            expected_revision=0,
        ),
    )
    assert updated.revision == 1
    with pytest.raises(RevisionConflictError):
        aigc_repository.update_aigc_template(
            template.id,
            AigcPipelineTemplateUpdate(
                name="冲突",
                definition=template.definition,
                expected_revision=0,
            ),
        )

    pipeline = aigc_repository.create_aigc_pipeline(
        AigcPipelineCreate(
            name="模板实例",
            definition=updated.definition,
            source_template_id=updated.id,
            source_template_revision=updated.revision,
        )
    )
    saved = aigc_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            expected_revision=0,
            name="模板实例 v2",
            definition=pipeline.definition,
        ),
    )
    assert saved.revision == 1
    assert aigc_repository.get_aigc_template(template.id).name == "商品海报模板 v2"


def test_template_delete_preserves_instantiated_pipeline(
    aigc_repository: AigcRepositoryContract,
) -> None:
    template = aigc_repository.create_aigc_template(
        AigcPipelineTemplateCreate(
            name="可删除模板",
            definition=definition(),
        )
    )
    pipeline = aigc_repository.create_aigc_pipeline(
        AigcPipelineCreate(
            name="独立实例",
            definition=template.definition,
            source_template_id=template.id,
            source_template_revision=template.revision,
        )
    )

    aigc_repository.delete_aigc_template(template.id)

    with pytest.raises(NotFoundError):
        aigc_repository.get_aigc_template(template.id)
    persisted = aigc_repository.get_aigc_pipeline(pipeline.id)
    assert persisted == pipeline

    updated = aigc_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            expected_revision=pipeline.revision,
            name="删除模板后更新",
            description="来源快照仍保留",
            definition=definition(),
        ),
    )
    assert updated.source_template_id == template.id
    assert updated.source_template_revision == template.revision
    run = create_run(aigc_repository, updated)
    assert run.run.pipeline_id == pipeline.id


def test_pipeline_delete_cleans_drafts_and_soft_deletes_completed_runs(
    aigc_repository: AigcRepositoryContract,
) -> None:
    input_asset = aigc_repository.create_asset(
        AssetCreate(
            id="deletable-pipeline-input",
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.UPLOADED_IMAGE,
            status=Status.SUCCEEDED,
            object_key="aigc/deletable-input.png",
            mime_type="image/png",
        )
    )
    draft = create_pipeline(
        aigc_repository,
        pipeline_definition=definition(image_asset_id=input_asset.id),
    )

    aigc_repository.delete_aigc_pipeline(draft.id)

    with pytest.raises(NotFoundError):
        aigc_repository.get_aigc_pipeline(draft.id)
    assert aigc_repository.delete_tool_asset(input_asset.id).id == input_asset.id
    with pytest.raises(NotFoundError):
        aigc_repository.delete_aigc_pipeline(draft.id)

    result_asset = aigc_repository.create_asset(
        AssetCreate(
            id="protected-pipeline-output",
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            object_key="aigc/protected-output.png",
            mime_type="image/png",
        )
    )
    executed = create_pipeline(aigc_repository)
    run = create_run(aigc_repository, executed)
    task = aigc_repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=executed.id,
            run_id=run.run.id,
            node_id="model",
            type=AigcTaskType.TEXT_TO_IMAGE,
        ),
        idempotency_key="protected-attempt",
    )
    result = AigcTaskResult(
        kind=AigcResultKind.ASSETS,
        assets=[
            AigcResultAsset(
                asset_id=result_asset.id,
                ordinal=0,
                mime_type=result_asset.mime_type,
            )
        ],
    )
    aigc_repository.update_aigc_task_attempt(
        task.task_id,
        status=AigcTaskStatus.SUCCEEDED,
        progress=100,
        result=result,
    )
    aigc_repository.add_aigc_task_assets(
        [
            AigcPipelineTaskAssetReference(
                task_id=task.task_id,
                direction=AigcAssetDirection.OUTPUT,
                slot="image",
                ordinal=0,
                asset_id=result_asset.id,
            )
        ]
    )
    aigc_repository.update_aigc_run(
        run.run.id,
        status=AigcPipelineRunStatus.SUCCEEDED,
    )
    run_before = aigc_repository.get_aigc_run(run.run.id)
    task_before = aigc_repository.get_aigc_task_attempt(task.task_id)
    associations_before = aigc_repository.list_aigc_task_assets(task.task_id)
    result_asset_before = aigc_repository.get_asset(result_asset.id)

    aigc_repository.delete_aigc_pipeline(executed.id)

    run_after = aigc_repository.get_aigc_run(run.run.id)
    with pytest.raises(NotFoundError):
        aigc_repository.get_aigc_pipeline(executed.id)
    assert executed.id not in {
        pipeline.id for pipeline in aigc_repository.list_aigc_pipelines()
    }
    with pytest.raises(NotFoundError):
        aigc_repository.list_aigc_runs(executed.id)
    with pytest.raises(NotFoundError):
        aigc_repository.delete_aigc_pipeline(executed.id)
    assert run_after.run == run_before.run
    assert run_after.nodes == run_before.nodes
    assert aigc_repository.get_aigc_task_attempt(task.task_id) == task_before
    assert aigc_repository.list_aigc_task_assets(task.task_id) == associations_before
    assert aigc_repository.get_asset(result_asset.id) == result_asset_before


def test_pipeline_delete_rejects_active_run(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_pipeline(aigc_repository)
    create_run(aigc_repository, pipeline)

    with pytest.raises(PipelineRunConflictError):
        aigc_repository.delete_aigc_pipeline(pipeline.id)

    assert aigc_repository.get_aigc_pipeline(pipeline.id).id == pipeline.id


def test_pipeline_asset_references_protect_current_inputs(
    aigc_repository: AigcRepositoryContract,
) -> None:
    asset = aigc_repository.create_asset(
        AssetCreate(
            id="aigc-input-asset",
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.UPLOADED_IMAGE,
            status=Status.SUCCEEDED,
            object_key="aigc/input.png",
            mime_type="image/png",
        )
    )
    pipeline = create_pipeline(
        aigc_repository,
        pipeline_definition=definition(image_asset_id=asset.id),
    )

    references = aigc_repository.list_aigc_pipeline_assets(pipeline.id)
    assert [(item.node_id, item.slot, item.asset_id) for item in references] == [
        ("reference", "image", asset.id)
    ]
    with pytest.raises(AssetReferenceConflictError):
        aigc_repository.delete_tool_asset(asset.id)

    aigc_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            expected_revision=0,
            name=pipeline.name,
            description=pipeline.description,
            definition=definition(),
        ),
    )
    assert aigc_repository.delete_tool_asset(asset.id).id == asset.id


def test_pipeline_asset_references_protect_all_multitrack_subtitles(
    aigc_repository: AigcRepositoryContract,
) -> None:
    asset_ids = ("subtitle-asset-a", "subtitle-asset-b")
    for asset_id in asset_ids:
        aigc_repository.create_asset(
            AssetCreate(
                id=asset_id,
                tool_asset_role=ToolAssetRole.INPUT,
                type=AssetType.SUBTITLE,
                status=Status.SUCCEEDED,
                object_key=f"aigc/{asset_id}.srt",
                mime_type="application/x-subrip",
            )
        )
    pipeline = create_pipeline(
        aigc_repository,
        pipeline_definition=multitrack_subtitle_definition(asset_ids),
    )

    references = aigc_repository.list_aigc_pipeline_assets(pipeline.id)
    assert {item.asset_id for item in references} == set(asset_ids)
    slots = [item.slot for item in references]
    assert len(slots) == len(set(slots)) == 2
    assert all(slot.startswith("subtitle:") for slot in slots)
    unchanged = aigc_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            expected_revision=pipeline.revision,
            name=pipeline.name,
            description=pipeline.description,
            definition=multitrack_subtitle_definition(asset_ids),
        ),
    )
    assert [
        item.slot
        for item in aigc_repository.list_aigc_pipeline_assets(pipeline.id)
    ] == slots
    for asset_id in asset_ids:
        with pytest.raises(AssetReferenceConflictError):
            aigc_repository.delete_tool_asset(asset_id)

    aigc_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            expected_revision=unchanged.revision,
            name=pipeline.name,
            description=pipeline.description,
            definition=multitrack_subtitle_definition(()),
        ),
    )

    assert aigc_repository.list_aigc_pipeline_assets(pipeline.id) == []
    for asset_id in asset_ids:
        assert aigc_repository.delete_tool_asset(asset_id).id == asset_id


def test_v2_pipeline_asset_references_include_upstream_mode_local_backups(
    aigc_repository: AigcRepositoryContract,
) -> None:
    asset_types = {
        "local-image": AssetType.UPLOADED_IMAGE,
        "local-video": AssetType.UPLOADED_VIDEO,
        "local-audio": AssetType.UPLOADED_AUDIO,
    }
    for asset_id, asset_type in asset_types.items():
        aigc_repository.create_asset(
            AssetCreate(
                id=asset_id,
                tool_asset_role=ToolAssetRole.INPUT,
                type=asset_type,
                status=Status.SUCCEEDED,
                object_key=f"aigc/{asset_id}",
            )
        )
    stored = create_pipeline(aigc_repository)

    def v2_node(
        node_id: str,
        node_type: str,
        x: int,
        *,
        config: dict[str, object] | None = None,
    ) -> dict[str, object]:
        return {
            "id": node_id,
            "type": node_type,
            "position": {"x": x, "y": 0},
            "size": {"width": 240, "height": 160},
            "config": config or {},
        }

    v2_definition = AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                v2_node(
                    "image",
                    "image",
                    0,
                    config={"asset_id": "local-image"},
                ),
                v2_node(
                    "video",
                    "video",
                    0,
                    config={"asset_id": "local-video"},
                ),
                v2_node(
                    "audio",
                    "audio",
                    0,
                    config={"asset_id": "local-audio"},
                ),
                v2_node("image-producer", "text_to_image", 300),
                v2_node("video-producer", "video_generation", 300),
            ],
            "edges": [
                {
                    "id": "image-upstream",
                    "sourceNodeId": "image-producer",
                    "sourceHandle": "image",
                    "targetNodeId": "image",
                    "targetHandle": "image",
                },
                {
                    "id": "video-upstream",
                    "sourceNodeId": "video-producer",
                    "sourceHandle": "video",
                    "targetNodeId": "video",
                    "targetHandle": "video",
                },
            ],
        }
    )
    pipeline = stored.model_copy(
        update={"definition": v2_definition},
        deep=True,
    )

    if isinstance(aigc_repository, InMemoryRepository):
        references = aigc_repository._aigc_asset_references_for_pipeline(
            pipeline
        )
    else:
        assert isinstance(aigc_repository, MySQLRepository)
        with aigc_repository._session_factory() as session:
            references = aigc_repository._aigc_asset_references_for_pipeline(
                session,
                pipeline,
            )

    assert sorted(
        (item.node_id, item.slot, item.asset_id) for item in references
    ) == [
        ("audio", "audio", "local-audio"),
        ("image", "image", "local-image"),
        ("video", "video", "local-video"),
    ]


def test_run_and_attempt_idempotency_and_snapshot_isolation(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_pipeline(aigc_repository)
    detail = create_run(aigc_repository, pipeline)
    duplicate = create_run(aigc_repository, pipeline)

    assert duplicate.run.id == detail.run.id
    assert len(detail.nodes) == 2

    with pytest.raises(ActiveRunConflictError):
        aigc_repository.create_aigc_run(
            AigcPipelineRun(
                pipeline_id=pipeline.id,
                run_number=1,
                pipeline_revision=pipeline.revision,
                mode="full",
                definition_snapshot=pipeline.definition,
            ),
            idempotency_key="run-request-2",
            nodes=detail.nodes,
        )

    params = {"prompt": {"text": "first"}}
    task = AigcPipelineTaskAttempt(
        pipeline_id=pipeline.id,
        run_id=detail.run.id,
        node_id="model",
        type=AigcTaskType.TEXT_TO_IMAGE,
        params=params,
        upstream=["prompt"],
    )
    created = aigc_repository.create_aigc_task_attempt(
        task,
        idempotency_key="attempt-request-1",
    )
    duplicate_task = aigc_repository.create_aigc_task_attempt(
        task,
        idempotency_key="attempt-request-1",
    )
    params["prompt"] = {"text": "changed"}

    assert created.task_id == duplicate_task.task_id
    assert created.attempt == 1
    assert aigc_repository.get_aigc_run(detail.run.id).nodes[1].attempts[0].params == {
        "prompt": {"text": "first"}
    }

    aigc_repository.update_aigc_task_attempt(
        created.task_id,
        status=AigcTaskStatus.FAILED,
    )
    failed_node = next(
        node
        for node in aigc_repository.get_aigc_run(detail.run.id).nodes
        if node.node_id == "model"
    )
    assert failed_node.status == AigcRunNodeStatus.FAILED
    retry = aigc_repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=detail.run.id,
            node_id="model",
            type=AigcTaskType.TEXT_TO_IMAGE,
            params={"prompt": {"text": "first"}},
            upstream=["prompt"],
        ),
        idempotency_key="attempt-request-2",
        retry_of_task_id=created.task_id,
    )
    assert retry.attempt == 2


def test_disjoint_flow_runs_can_be_active_together(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_pipeline(
        aigc_repository,
        pipeline_definition=disconnected_definition(),
    )

    flow_a = create_scoped_run(
        aigc_repository,
        pipeline,
        start_node_id="flow-a-model",
        idempotency_key="flow-a-request",
    )
    flow_b = create_scoped_run(
        aigc_repository,
        pipeline,
        start_node_id="flow-b-model",
        idempotency_key="flow-b-request",
    )

    assert flow_a.run.status == AigcPipelineRunStatus.QUEUED
    assert flow_b.run.status == AigcPipelineRunStatus.QUEUED
    assert flow_b.run.run_number == flow_a.run.run_number + 1


def test_in_memory_concurrent_overlapping_flow_creates_only_one_run(
    repository: InMemoryRepository,
) -> None:
    pipeline = create_pipeline(
        repository,
        pipeline_definition=disconnected_definition(),
    )
    ready = Barrier(2)

    def create(index: int):
        ready.wait()
        try:
            return create_scoped_run(
                repository,
                pipeline,
                start_node_id="flow-a-model",
                idempotency_key=f"concurrent-flow-a-{index}",
            )
        except ActiveRunConflictError as error:
            return error

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(create, range(2)))

    created = [item for item in outcomes if not isinstance(item, Exception)]
    conflicts = [
        item for item in outcomes if isinstance(item, ActiveRunConflictError)
    ]
    assert len(created) == 1
    assert len(conflicts) == 1
    assert len(repository.list_aigc_runs(pipeline.id)) == 1


def test_overlapping_flow_run_is_rejected(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_pipeline(
        aigc_repository,
        pipeline_definition=disconnected_definition(),
    )
    create_scoped_run(
        aigc_repository,
        pipeline,
        start_node_id="flow-a-model",
        idempotency_key="flow-a-request",
    )

    with pytest.raises(ActiveRunConflictError):
        create_scoped_run(
            aigc_repository,
            pipeline,
            start_node_id="flow-a-input",
            idempotency_key="flow-a-request-2",
        )


@pytest.mark.parametrize("full_first", [True, False])
def test_full_and_partial_active_runs_conflict_in_both_directions(
    aigc_repository: AigcRepositoryContract,
    full_first: bool,
) -> None:
    pipeline = create_pipeline(
        aigc_repository,
        pipeline_definition=disconnected_definition(),
    )
    first = (
        {"mode": "full", "start_node_id": None}
        if full_first
        else {"mode": "from_node", "start_node_id": "flow-a-model"}
    )
    second = (
        {"mode": "from_node", "start_node_id": "flow-b-model"}
        if full_first
        else {"mode": "full", "start_node_id": None}
    )
    create_scoped_run(
        aigc_repository,
        pipeline,
        idempotency_key="first-request",
        **first,
    )

    with pytest.raises(ActiveRunConflictError):
        create_scoped_run(
            aigc_repository,
            pipeline,
            idempotency_key="second-request",
            **second,
        )


def test_run_idempotency_takes_precedence_over_active_scope_conflict(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_pipeline(
        aigc_repository,
        pipeline_definition=disconnected_definition(),
    )
    created = create_scoped_run(
        aigc_repository,
        pipeline,
        start_node_id="flow-a-model",
        idempotency_key="same-request",
    )

    duplicate = create_scoped_run(
        aigc_repository,
        pipeline,
        start_node_id="flow-b-model",
        idempotency_key="same-request",
    )

    assert duplicate.run.id == created.run.id
    assert duplicate.run.start_node_id == "flow-a-model"


def test_older_run_completion_does_not_replace_latest_status(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_pipeline(
        aigc_repository,
        pipeline_definition=disconnected_definition(),
    )
    older = create_scoped_run(
        aigc_repository,
        pipeline,
        start_node_id="flow-a-model",
        idempotency_key="flow-a-request",
    )
    newer = create_scoped_run(
        aigc_repository,
        pipeline,
        start_node_id="flow-b-model",
        idempotency_key="flow-b-request",
    )

    aigc_repository.update_aigc_run(
        newer.run.id,
        status=AigcPipelineRunStatus.RUNNING,
    )
    latest_pipeline = aigc_repository.get_aigc_pipeline(pipeline.id)
    aigc_repository.update_aigc_run(
        older.run.id,
        status=AigcPipelineRunStatus.SUCCEEDED,
    )

    unchanged_pipeline = aigc_repository.get_aigc_pipeline(pipeline.id)
    assert unchanged_pipeline.latest_run_status == AigcPipelineRunStatus.RUNNING
    assert unchanged_pipeline.updated_at == latest_pipeline.updated_at


def test_mysql_update_locks_pipeline_before_latest_run_query(
    mysql_repository: MySQLRepository,
) -> None:
    """SQLite checks order; MySQL atomicity relies on pipeline FOR UPDATE."""
    pipeline = create_pipeline(
        mysql_repository,
        pipeline_definition=disconnected_definition(),
    )
    detail = create_scoped_run(
        mysql_repository,
        pipeline,
        start_node_id="flow-a-model",
        idempotency_key="lock-order-flow-a",
    )
    statements: list[tuple[str, bool]] = []

    def record_statement(state: ORMExecuteState) -> None:
        statement = state.statement
        statements.append(
            (
                str(statement).lower(),
                getattr(statement, "_for_update_arg", None) is not None,
            )
        )

    session_class = mysql_repository._session_factory.class_
    event.listen(session_class, "do_orm_execute", record_statement)
    try:
        mysql_repository.update_aigc_run(
            detail.run.id,
            status=AigcPipelineRunStatus.RUNNING,
        )
    finally:
        event.remove(session_class, "do_orm_execute", record_statement)

    run_read = next(
        index
        for index, (statement, _locked) in enumerate(statements)
        if "from pipeline_runs" in statement
        and "pipeline_runs.id =" in statement
        and "order by" not in statement
    )
    pipeline_lock = next(
        index
        for index, (statement, locked) in enumerate(statements)
        if "from pipelines" in statement and locked
    )
    latest_run_query = next(
        index
        for index, (statement, _locked) in enumerate(statements)
        if "from pipeline_runs" in statement
        and "order by pipeline_runs.run_number desc" in statement
    )

    assert run_read < pipeline_lock < latest_run_query


def test_terminal_task_asset_links_are_removed_on_asset_delete(
    aigc_repository: AigcRepositoryContract,
) -> None:
    asset = aigc_repository.create_asset(
        AssetCreate(
            id="aigc-output-asset",
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.GENERATED_IMAGE,
            status=Status.SUCCEEDED,
            object_key="aigc/output.png",
            mime_type="image/png",
        )
    )
    pipeline = create_pipeline(aigc_repository)
    detail = create_run(aigc_repository, pipeline)
    task = aigc_repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=detail.run.id,
            node_id="model",
            type=AigcTaskType.TEXT_TO_IMAGE,
        ),
        idempotency_key="attempt-output",
    )
    aigc_repository.add_aigc_task_assets(
        [
            AigcPipelineTaskAssetReference(
                task_id=task.task_id,
                direction=AigcAssetDirection.OUTPUT,
                slot="image",
                ordinal=0,
                asset_id=asset.id,
            )
        ]
    )

    with pytest.raises(AssetReferenceConflictError):
        aigc_repository.delete_tool_asset(asset.id)

    aigc_repository.update_aigc_run(
        detail.run.id,
        status=AigcPipelineRunStatus.FAILED,
    )
    assert aigc_repository.delete_tool_asset(asset.id).id == asset.id
    assert aigc_repository.list_aigc_task_assets(task.task_id) == []


def test_worker_lease_uses_monotonic_fencing_tokens(
    aigc_repository: AigcRepositoryContract,
) -> None:
    now = utc_now()
    first = aigc_repository.acquire_aigc_worker_lease(
        "worker-a",
        now=now,
        lease_seconds=30,
    )
    assert first is not None
    assert first.fencing_token == 1
    assert (
        aigc_repository.acquire_aigc_worker_lease(
            "worker-b",
            now=now + timedelta(seconds=10),
            lease_seconds=30,
        )
        is None
    )

    takeover = aigc_repository.acquire_aigc_worker_lease(
        "worker-b",
        now=now + timedelta(seconds=31),
        lease_seconds=30,
    )
    assert takeover is not None
    assert takeover.fencing_token == 2
    assert (
        aigc_repository.renew_aigc_worker_lease(
            "worker-a",
            first.fencing_token,
            now=now + timedelta(seconds=32),
            lease_seconds=30,
        )
        is None
    )


def test_task_claim_and_commit_require_current_fencing_token(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_pipeline(aigc_repository)
    detail = create_run(aigc_repository, pipeline)
    task = aigc_repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=detail.run.id,
            node_id="model",
            type=AigcTaskType.TEXT_TO_IMAGE,
        ),
        idempotency_key="claim-attempt",
    )
    now = utc_now()
    lease = aigc_repository.acquire_aigc_worker_lease(
        "worker-a",
        now=now,
        lease_seconds=30,
    )
    assert lease is not None
    assert (
        aigc_repository.claim_aigc_task_attempt(
            task.task_id,
            fencing_token=lease.fencing_token + 1,
        )
        is None
    )
    claimed = aigc_repository.claim_aigc_task_attempt(
        task.task_id,
        fencing_token=lease.fencing_token,
    )
    assert claimed is not None
    assert claimed.status == AigcTaskStatus.RUNNING

    committed, accepted = aigc_repository.commit_aigc_task_attempt(
        task.task_id,
        fencing_token=lease.fencing_token,
        status=AigcTaskStatus.SUCCEEDED,
        result=AigcTaskResult(
            kind=AigcResultKind.TEXT,
            text="done",
            text_digest="a" * 64,
        ),
        error=None,
        metrics=AigcTaskMetrics(duration_ms=50),
    )
    assert accepted is True
    assert committed.status == AigcTaskStatus.SUCCEEDED
    node = next(
        item
        for item in aigc_repository.get_aigc_run(detail.run.id).nodes
        if item.node_id == "model"
    )
    assert node.status == AigcRunNodeStatus.SUCCEEDED
    assert node.result.text == "done"
