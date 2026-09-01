from __future__ import annotations

from datetime import timedelta
from typing import Protocol

import pytest
from sqlalchemy import event, inspect
from sqlalchemy.exc import IntegrityError

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
