from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session, selectinload, sessionmaker

from backend.app.db.models import (
    AigcPipelineAssetORM,
    AigcPipelineORM,
    AigcPipelineRunNodeORM,
    AigcPipelineRunORM,
    AigcPipelineTaskAssetORM,
    AigcPipelineTaskORM,
    AigcPipelineTemplateORM,
    AigcPipelineWorkerLeaseORM,
    AssetORM,
    BriefORM,
    CanvasLayoutORM,
    CharacterCardORM,
    GenerationTaskORM,
    ImageLayerORM,
    ImageLayerSetORM,
    ImagePromptVersionORM,
    ProjectORM,
    StoryboardShotORM,
    TextArtifactORM,
    ToolTaskORM,
    ToolTaskInputAssetORM,
)
from backend.app.db.session import get_engine, make_session_factory
from backend.app.schemas import (
    AigcAssetDirection,
    AigcPipeline,
    AigcPipelineAssetReference,
    AigcPipelineCreate,
    AigcPipelineRun,
    AigcPipelineRunDetail,
    AigcPipelineRunMode,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
    AigcRunNodeStatus,
    AigcPipelineTaskAssetReference,
    AigcPipelineTaskAttempt,
    AigcPipelineTemplate,
    AigcPipelineTemplateCreate,
    AigcPipelineTemplateUpdate,
    AigcPipelineUpdate,
    AigcTaskError,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcTaskStatus,
    AigcWorkerLease,
    Asset,
    AssetCategory,
    AssetCreate,
    AssetRole,
    AssetType,
    CanvasLayout,
    CanvasNode,
    CharacterCard,
    CharacterCardCreate,
    GenerationTask,
    GenerationTaskCreate,
    ImagePromptVersion,
    ImagePromptVersionCreate,
    ImageLayer,
    ImageLayerCreate,
    ImageLayerSet,
    ImageLayerSetCreate,
    ImageLayerUpdate,
    ImageInputNode,
    Project,
    ProjectBase,
    ProjectCreate,
    ProjectListItem,
    ProjectUpdate,
    ReferenceAssetKind,
    StoryboardAtomicShotSnapshot,
    StoryboardShot,
    StoryboardShotCreate,
    StoryboardShotVideoConfigUpdate,
    TaskError,
    TargetLanguage,
    TextArtifact,
    TextArtifactCreate,
    ToolTask,
    ToolTaskCreate,
    ToolTaskError,
    ToolTaskInputAsset,
)
from backend.app.schemas.brief import Brief
from backend.app.schemas.common import utc_now
from backend.app.schemas.enums import Stage, Status, ToolTaskType
from backend.app.video_prompt import (
    build_merged_shot_video_prompt,
    expand_atomic_shots,
)

from .base import (
    ActiveRunConflictError,
    AssetReferenceConflictError,
    NotFoundError,
    PipelineRunConflictError,
    RevisionConflictError,
)


class MySQLRepository:
    """SQLAlchemy-backed repository compatible with InMemoryRepository."""

    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory or make_session_factory(get_engine())

    def create_aigc_template(
        self,
        data: AigcPipelineTemplateCreate,
    ) -> AigcPipelineTemplate:
        template = AigcPipelineTemplate(**data.model_dump())
        with self._session_factory.begin() as session:
            orm_template = AigcPipelineTemplateORM(
                id=template.id,
                name=template.name,
                description=template.description,
                definition_json=template.definition.model_dump(
                    mode="json", by_alias=True
                ),
                schema_version=template.definition.schema_version,
                revision=template.revision,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
            session.add(orm_template)
            session.flush()
            return self._aigc_template_from_orm(orm_template)

    def get_aigc_template(self, template_id: str) -> AigcPipelineTemplate:
        with self._session_factory() as session:
            template = session.get(AigcPipelineTemplateORM, template_id)
            if template is None:
                raise NotFoundError(f"AIGC template not found: {template_id}")
            return self._aigc_template_from_orm(template)

    def list_aigc_templates(
        self,
        q: str | None = None,
    ) -> list[AigcPipelineTemplate]:
        keyword = (q or "").strip()
        statement = select(AigcPipelineTemplateORM)
        if keyword:
            statement = statement.where(
                AigcPipelineTemplateORM.name.icontains(keyword, autoescape=True)
            )
        statement = statement.order_by(
            AigcPipelineTemplateORM.updated_at.desc(),
            AigcPipelineTemplateORM.id.asc(),
        )
        with self._session_factory() as session:
            return [
                self._aigc_template_from_orm(item)
                for item in session.scalars(statement).all()
            ]

    def update_aigc_template(
        self,
        template_id: str,
        data: AigcPipelineTemplateUpdate,
    ) -> AigcPipelineTemplate:
        with self._session_factory.begin() as session:
            result = session.execute(
                update(AigcPipelineTemplateORM)
                .where(
                    AigcPipelineTemplateORM.id == template_id,
                    AigcPipelineTemplateORM.revision == data.expected_revision,
                )
                .values(
                    name=data.name,
                    description=data.description,
                    definition_json=data.definition.model_dump(
                        mode="json", by_alias=True
                    ),
                    schema_version=data.definition.schema_version,
                    revision=data.expected_revision + 1,
                    updated_at=utc_now(),
                )
            )
            if result.rowcount != 1:
                if session.get(AigcPipelineTemplateORM, template_id) is None:
                    raise NotFoundError(f"AIGC template not found: {template_id}")
                raise RevisionConflictError("AIGC template revision conflict")
            template = session.get(AigcPipelineTemplateORM, template_id)
            assert template is not None
            return self._aigc_template_from_orm(template)

    def delete_aigc_template(self, template_id: str) -> None:
        with self._session_factory.begin() as session:
            template = session.get(AigcPipelineTemplateORM, template_id)
            if template is None:
                raise NotFoundError(f"AIGC template not found: {template_id}")
            session.delete(template)
            session.flush()

    def create_aigc_pipeline(self, data: AigcPipelineCreate) -> AigcPipeline:
        pipeline = AigcPipeline(**data.model_dump())
        with self._session_factory.begin() as session:
            if pipeline.source_template_id is not None:
                template = session.get(
                    AigcPipelineTemplateORM,
                    pipeline.source_template_id,
                )
                if template is None:
                    raise NotFoundError(
                        f"AIGC template not found: {pipeline.source_template_id}"
                    )
                if template.revision != pipeline.source_template_revision:
                    raise RevisionConflictError(
                        "AIGC source template revision conflict"
                    )
            references = self._aigc_asset_references_for_pipeline(
                session, pipeline
            )
            orm_pipeline = AigcPipelineORM(
                id=pipeline.id,
                name=pipeline.name,
                description=pipeline.description,
                source_template_id=pipeline.source_template_id,
                source_template_revision=pipeline.source_template_revision,
                definition_json=pipeline.definition.model_dump(
                    mode="json", by_alias=True
                ),
                schema_version=pipeline.definition.schema_version,
                revision=pipeline.revision,
                latest_run_status=pipeline.latest_run_status,
                created_at=pipeline.created_at,
                updated_at=pipeline.updated_at,
            )
            session.add(orm_pipeline)
            session.flush()
            self._replace_aigc_pipeline_assets(
                session,
                pipeline.id,
                references,
            )
            session.flush()
            return self._aigc_pipeline_from_orm(orm_pipeline)

    def get_aigc_pipeline(self, pipeline_id: str) -> AigcPipeline:
        with self._session_factory() as session:
            pipeline = session.scalar(
                select(AigcPipelineORM).where(
                    AigcPipelineORM.id == pipeline_id,
                    AigcPipelineORM.deleted_at.is_(None),
                )
            )
            if pipeline is None:
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            return self._aigc_pipeline_from_orm(pipeline)

    def list_aigc_pipelines(self, q: str | None = None) -> list[AigcPipeline]:
        keyword = (q or "").strip()
        statement = select(AigcPipelineORM).where(
            AigcPipelineORM.deleted_at.is_(None)
        )
        if keyword:
            statement = statement.where(
                AigcPipelineORM.name.icontains(keyword, autoescape=True)
            )
        statement = statement.order_by(
            AigcPipelineORM.updated_at.desc(),
            AigcPipelineORM.id.asc(),
        )
        with self._session_factory() as session:
            return [
                self._aigc_pipeline_from_orm(item)
                for item in session.scalars(statement).all()
            ]

    def update_aigc_pipeline(
        self,
        pipeline_id: str,
        data: AigcPipelineUpdate,
    ) -> AigcPipeline:
        with self._session_factory.begin() as session:
            pipeline = session.scalar(
                select(AigcPipelineORM)
                .where(
                    AigcPipelineORM.id == pipeline_id,
                    AigcPipelineORM.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if pipeline is None:
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            if pipeline.revision != data.expected_revision:
                raise RevisionConflictError("AIGC pipeline revision conflict")
            candidate = AigcPipeline(
                id=pipeline.id,
                name=data.name,
                description=data.description,
                source_template_id=pipeline.source_template_id,
                source_template_revision=pipeline.source_template_revision,
                definition=data.definition,
                revision=pipeline.revision + 1,
                latest_run_status=pipeline.latest_run_status,
                created_at=pipeline.created_at,
                updated_at=utc_now(),
            )
            references = self._aigc_asset_references_for_pipeline(
                session, candidate
            )
            pipeline.name = candidate.name
            pipeline.description = candidate.description
            pipeline.definition_json = candidate.definition.model_dump(
                mode="json", by_alias=True
            )
            pipeline.schema_version = candidate.definition.schema_version
            pipeline.revision = candidate.revision
            pipeline.updated_at = candidate.updated_at
            self._replace_aigc_pipeline_assets(
                session,
                pipeline_id,
                references,
            )
            session.flush()
            return self._aigc_pipeline_from_orm(pipeline)

    def delete_aigc_pipeline(self, pipeline_id: str) -> None:
        with self._session_factory.begin() as session:
            pipeline = session.scalar(
                select(AigcPipelineORM)
                .where(
                    AigcPipelineORM.id == pipeline_id,
                    AigcPipelineORM.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if pipeline is None:
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            runs = session.scalars(
                select(AigcPipelineRunORM)
                .where(AigcPipelineRunORM.pipeline_id == pipeline_id)
            ).all()
            if any(
                run.status
                in {
                    AigcPipelineRunStatus.QUEUED,
                    AigcPipelineRunStatus.RUNNING,
                }
                for run in runs
            ):
                raise PipelineRunConflictError(
                    f"AIGC pipeline has an active run: {pipeline_id}"
                )
            if runs:
                pipeline.deleted_at = utc_now()
                pipeline.updated_at = pipeline.deleted_at
                session.flush()
                return
            session.execute(
                delete(AigcPipelineAssetORM).where(
                    AigcPipelineAssetORM.pipeline_id == pipeline_id
                )
            )
            session.delete(pipeline)
            session.flush()

    def list_aigc_pipeline_assets(
        self,
        pipeline_id: str,
    ) -> list[AigcPipelineAssetReference]:
        with self._session_factory() as session:
            pipeline = session.scalar(
                select(AigcPipelineORM).where(
                    AigcPipelineORM.id == pipeline_id,
                    AigcPipelineORM.deleted_at.is_(None),
                )
            )
            if pipeline is None:
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            return [
                AigcPipelineAssetReference(
                    pipeline_id=item.pipeline_id,
                    node_id=item.node_id,
                    slot=item.slot,
                    asset_id=item.asset_id,
                )
                for item in session.scalars(
                    select(AigcPipelineAssetORM)
                    .where(AigcPipelineAssetORM.pipeline_id == pipeline_id)
                    .order_by(
                        AigcPipelineAssetORM.node_id,
                        AigcPipelineAssetORM.slot,
                    )
                ).all()
            ]

    def create_aigc_run(
        self,
        run: AigcPipelineRun,
        *,
        idempotency_key: str,
        nodes: Iterable[AigcPipelineRunNode],
    ) -> AigcPipelineRunDetail:
        run_nodes = list(nodes)
        with self._session_factory.begin() as session:
            pipeline = session.scalar(
                select(AigcPipelineORM)
                .where(
                    AigcPipelineORM.id == run.pipeline_id,
                    AigcPipelineORM.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if pipeline is None:
                raise NotFoundError(f"AIGC pipeline not found: {run.pipeline_id}")
            existing = session.scalar(
                select(AigcPipelineRunORM).where(
                    AigcPipelineRunORM.pipeline_id == run.pipeline_id,
                    AigcPipelineRunORM.idempotency_key == idempotency_key,
                )
            )
            if existing is not None:
                return self._aigc_run_detail_from_orm(session, existing)
            if (
                run.pipeline_revision != pipeline.revision
                and run.mode != AigcPipelineRunMode.RETRY_NODE
            ):
                raise RevisionConflictError("AIGC pipeline revision conflict")
            active = session.scalar(
                select(AigcPipelineRunORM)
                .where(
                    AigcPipelineRunORM.pipeline_id == run.pipeline_id,
                    AigcPipelineRunORM.status.in_(
                        [
                            AigcPipelineRunStatus.QUEUED,
                            AigcPipelineRunStatus.RUNNING,
                        ]
                    ),
                )
                .limit(1)
            )
            if active is not None:
                raise ActiveRunConflictError(
                    "AIGC pipeline already has an active run"
                )
            run_number = (
                session.scalar(
                    select(func.max(AigcPipelineRunORM.run_number)).where(
                        AigcPipelineRunORM.pipeline_id == run.pipeline_id
                    )
                )
                or 0
            ) + 1
            snapshot_ids = {node.id for node in run.definition_snapshot.nodes}
            if {node.node_id for node in run_nodes} != snapshot_ids:
                raise ValueError("AIGC run nodes must match the definition snapshot")
            now = utc_now()
            orm_run = AigcPipelineRunORM(
                id=run.id,
                pipeline_id=run.pipeline_id,
                run_number=run_number,
                idempotency_key=idempotency_key,
                pipeline_revision=run.pipeline_revision,
                mode=run.mode,
                start_node_id=run.start_node_id,
                source_run_id=run.source_run_id,
                source_node_id=run.source_node_id,
                status=run.status,
                definition_snapshot=run.definition_snapshot.model_dump(
                    mode="json", by_alias=True
                ),
                input_snapshot=run.input_snapshot,
                error_json=run.error.model_dump(mode="json") if run.error else None,
                cancellation_requested=run.cancellation_requested,
                created_at=run.created_at,
                updated_at=now,
                started_at=run.started_at,
                finished_at=run.finished_at,
            )
            session.add(orm_run)
            # No ORM relationship links these rows, so SQLAlchemy cannot infer
            # their insert dependency from object state. Persist the parent
            # before adding children to satisfy MySQL's immediate FK checks.
            session.flush()
            session.add_all(
                [
                    AigcPipelineRunNodeORM(
                        run_id=run.id,
                        node_id=node.node_id,
                        included_in_plan=node.included_in_plan,
                        status=node.status,
                        current_task_id=node.current_task_id,
                        reused_from_task_id=node.reused_from_task_id,
                        input_hash=node.input_hash,
                        result_json=node.result.model_dump(mode="json"),
                        error_json=(
                            node.error.model_dump(mode="json") if node.error else None
                        ),
                        updated_at=now,
                    )
                    for node in run_nodes
                ]
            )
            pipeline.latest_run_status = run.status
            pipeline.updated_at = now
            session.flush()
            return self._aigc_run_detail_from_orm(session, orm_run)

    def get_aigc_run(self, run_id: str) -> AigcPipelineRunDetail:
        with self._session_factory() as session:
            run = session.get(AigcPipelineRunORM, run_id)
            if run is None:
                raise NotFoundError(f"AIGC run not found: {run_id}")
            return self._aigc_run_detail_from_orm(session, run)

    def list_aigc_runs(self, pipeline_id: str) -> list[AigcPipelineRun]:
        with self._session_factory() as session:
            pipeline = session.scalar(
                select(AigcPipelineORM).where(
                    AigcPipelineORM.id == pipeline_id,
                    AigcPipelineORM.deleted_at.is_(None),
                )
            )
            if pipeline is None:
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            return [
                self._aigc_run_from_orm(item)
                for item in session.scalars(
                    select(AigcPipelineRunORM)
                    .where(AigcPipelineRunORM.pipeline_id == pipeline_id)
                    .order_by(AigcPipelineRunORM.run_number.desc())
                ).all()
            ]

    def get_aigc_run_asset(
        self,
        pipeline_id: str,
        run_id: str,
        asset_id: str,
    ) -> Asset:
        with self._session_factory() as session:
            asset = session.scalar(
                select(AssetORM)
                .join(
                    AigcPipelineTaskAssetORM,
                    AigcPipelineTaskAssetORM.asset_id == AssetORM.id,
                )
                .join(
                    AigcPipelineTaskORM,
                    AigcPipelineTaskORM.id == AigcPipelineTaskAssetORM.task_id,
                )
                .join(
                    AigcPipelineRunORM,
                    AigcPipelineRunORM.id == AigcPipelineTaskORM.run_id,
                )
                .where(
                    AigcPipelineRunORM.id == run_id,
                    AigcPipelineRunORM.pipeline_id == pipeline_id,
                    AssetORM.id == asset_id,
                )
                .limit(1)
            )
            if asset is None:
                raise NotFoundError(f"AIGC run asset not found: {asset_id}")
            return self._asset_from_orm(asset)

    def update_aigc_run(
        self,
        run_id: str,
        **changes: object,
    ) -> AigcPipelineRun:
        with self._session_factory.begin() as session:
            run = session.get(AigcPipelineRunORM, run_id)
            if run is None:
                raise NotFoundError(f"AIGC run not found: {run_id}")
            for key, value in changes.items():
                if key == "error":
                    run.error_json = (
                        value.model_dump(mode="json")
                        if isinstance(value, AigcTaskError)
                        else None
                    )
                elif hasattr(run, key):
                    setattr(run, key, value)
            run.updated_at = utc_now()
            pipeline = session.get(AigcPipelineORM, run.pipeline_id)
            assert pipeline is not None
            pipeline.latest_run_status = run.status
            pipeline.updated_at = run.updated_at
            session.flush()
            return self._aigc_run_from_orm(run)

    def update_aigc_run_node(
        self,
        run_id: str,
        node_id: str,
        **changes: object,
    ) -> AigcPipelineRunNode:
        with self._session_factory.begin() as session:
            node = session.get(AigcPipelineRunNodeORM, (run_id, node_id))
            if node is None:
                raise NotFoundError(f"AIGC run node not found: {run_id}:{node_id}")
            for key, value in changes.items():
                if key == "result" and isinstance(value, AigcTaskResult):
                    node.result_json = value.model_dump(mode="json")
                elif key == "error":
                    node.error_json = (
                        value.model_dump(mode="json")
                        if isinstance(value, AigcTaskError)
                        else None
                    )
                elif hasattr(node, key):
                    setattr(node, key, value)
            node.updated_at = utc_now()
            session.flush()
            return self._aigc_run_node_from_orm(session, node)

    def create_aigc_task_attempt(
        self,
        task: AigcPipelineTaskAttempt,
        *,
        idempotency_key: str,
        retry_of_task_id: str | None = None,
    ) -> AigcPipelineTaskAttempt:
        with self._session_factory.begin() as session:
            run_node = session.scalar(
                select(AigcPipelineRunNodeORM)
                .where(
                    AigcPipelineRunNodeORM.run_id == task.run_id,
                    AigcPipelineRunNodeORM.node_id == task.node_id,
                )
                .with_for_update()
            )
            if run_node is None:
                raise NotFoundError(
                    f"AIGC run node not found: {task.run_id}:{task.node_id}"
                )
            run = session.get(AigcPipelineRunORM, task.run_id)
            assert run is not None
            if run.pipeline_id != task.pipeline_id:
                raise ValueError("AIGC task belongs to another pipeline")
            existing = session.scalar(
                select(AigcPipelineTaskORM).where(
                    AigcPipelineTaskORM.run_id == task.run_id,
                    AigcPipelineTaskORM.node_id == task.node_id,
                    AigcPipelineTaskORM.idempotency_key == idempotency_key,
                )
            )
            if existing is not None:
                return self._aigc_task_from_orm(session, existing)
            active = session.scalar(
                select(AigcPipelineTaskORM)
                .where(
                    AigcPipelineTaskORM.run_id == task.run_id,
                    AigcPipelineTaskORM.node_id == task.node_id,
                    AigcPipelineTaskORM.status.in_(
                        [AigcTaskStatus.QUEUED, AigcTaskStatus.RUNNING]
                    ),
                )
                .limit(1)
            )
            if active is not None:
                raise ActiveRunConflictError(
                    "AIGC run node already has an active attempt"
                )
            if (
                retry_of_task_id is not None
                and session.get(AigcPipelineTaskORM, retry_of_task_id) is None
            ):
                raise NotFoundError(
                    f"AIGC retry task not found: {retry_of_task_id}"
                )
            attempt = (
                session.scalar(
                    select(func.max(AigcPipelineTaskORM.attempt)).where(
                        AigcPipelineTaskORM.run_id == task.run_id,
                        AigcPipelineTaskORM.node_id == task.node_id,
                    )
                )
                or 0
            ) + 1
            orm_task = AigcPipelineTaskORM(
                id=task.task_id,
                run_id=task.run_id,
                node_id=task.node_id,
                attempt=attempt,
                idempotency_key=idempotency_key,
                type=task.type,
                status=task.status,
                progress=task.progress,
                params_json=task.params,
                upstream_json=task.upstream,
                result_json=task.result.model_dump(mode="json"),
                error_json=task.error.model_dump(mode="json") if task.error else None,
                metrics_json=task.metrics.model_dump(mode="json"),
                retry_of_task_id=retry_of_task_id,
                created_at=task.created_at,
                updated_at=task.created_at,
                started_at=task.started_at,
                finished_at=task.finished_at,
            )
            session.add(orm_task)
            session.flush()
            run_node.current_task_id = task.task_id
            run_node.status = AigcRunNodeStatus(task.status.value)
            run_node.updated_at = utc_now()
            session.flush()
            return self._aigc_task_from_orm(session, orm_task)

    def get_aigc_task_attempt(
        self,
        task_id: str,
    ) -> AigcPipelineTaskAttempt:
        with self._session_factory() as session:
            task = session.get(AigcPipelineTaskORM, task_id)
            if task is None:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            return self._aigc_task_from_orm(session, task)

    def update_aigc_task_attempt(
        self,
        task_id: str,
        **changes: object,
    ) -> AigcPipelineTaskAttempt:
        with self._session_factory.begin() as session:
            task = session.get(AigcPipelineTaskORM, task_id)
            if task is None:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            for key, value in changes.items():
                if key == "result" and isinstance(value, AigcTaskResult):
                    task.result_json = value.model_dump(mode="json")
                elif key == "error":
                    task.error_json = (
                        value.model_dump(mode="json")
                        if isinstance(value, AigcTaskError)
                        else None
                    )
                elif key == "metrics" and isinstance(value, AigcTaskMetrics):
                    task.metrics_json = value.model_dump(mode="json")
                elif hasattr(task, key):
                    setattr(task, key, value)
            task.updated_at = utc_now()
            run_node = session.get(
                AigcPipelineRunNodeORM,
                (task.run_id, task.node_id),
            )
            assert run_node is not None
            if run_node.current_task_id == task.id:
                run_node.status = AigcRunNodeStatus(task.status.value)
                run_node.result_json = dict(task.result_json or {})
                run_node.updated_at = task.updated_at
            session.flush()
            return self._aigc_task_from_orm(session, task)

    def list_aigc_task_attempts(
        self,
        *,
        statuses: set[AigcTaskStatus] | None = None,
    ) -> list[AigcPipelineTaskAttempt]:
        statement = select(AigcPipelineTaskORM).order_by(
            AigcPipelineTaskORM.created_at,
            AigcPipelineTaskORM.id,
        )
        if statuses is not None:
            statement = statement.where(AigcPipelineTaskORM.status.in_(statuses))
        with self._session_factory() as session:
            return [
                self._aigc_task_from_orm(session, task)
                for task in session.scalars(statement).all()
            ]

    def claim_aigc_task_attempt(
        self,
        task_id: str,
        *,
        fencing_token: int,
    ) -> AigcPipelineTaskAttempt | None:
        with self._session_factory.begin() as session:
            lease = session.get(AigcPipelineWorkerLeaseORM, "aigc_scheduler")
            task = session.scalar(
                select(AigcPipelineTaskORM)
                .where(AigcPipelineTaskORM.id == task_id)
                .with_for_update()
            )
            if (
                lease is None
                or lease.fencing_token != fencing_token
                or self._as_utc(lease.lease_expires_at) <= utc_now()
                or task is None
                or task.status != AigcTaskStatus.QUEUED
            ):
                return None
            now = utc_now()
            task.status = AigcTaskStatus.RUNNING
            task.started_at = now
            task.updated_at = now
            task.fencing_token = fencing_token
            run_node = session.get(
                AigcPipelineRunNodeORM,
                (task.run_id, task.node_id),
            )
            assert run_node is not None
            run_node.status = AigcRunNodeStatus.RUNNING
            run_node.updated_at = now
            session.flush()
            return self._aigc_task_from_orm(session, task)

    def commit_aigc_task_attempt(
        self,
        task_id: str,
        *,
        fencing_token: int,
        status: AigcTaskStatus,
        result: AigcTaskResult,
        error: AigcTaskError | None,
        metrics: AigcTaskMetrics,
    ) -> tuple[AigcPipelineTaskAttempt, bool]:
        with self._session_factory.begin() as session:
            lease = session.get(AigcPipelineWorkerLeaseORM, "aigc_scheduler")
            task = session.scalar(
                select(AigcPipelineTaskORM)
                .where(AigcPipelineTaskORM.id == task_id)
                .with_for_update()
            )
            if task is None:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            if (
                lease is None
                or lease.fencing_token != fencing_token
                or task.fencing_token != fencing_token
                or task.status != AigcTaskStatus.RUNNING
            ):
                return self._aigc_task_from_orm(session, task), False
            run = session.scalar(
                select(AigcPipelineRunORM)
                .where(AigcPipelineRunORM.id == task.run_id)
                .with_for_update()
            )
            assert run is not None
            accepted = not run.cancellation_requested
            final_status = status if accepted else AigcTaskStatus.CANCELED
            final_result = result if accepted else AigcTaskResult()
            now = utc_now()
            task.status = final_status
            task.progress = 100 if final_status == AigcTaskStatus.SUCCEEDED else task.progress
            task.result_json = final_result.model_dump(mode="json")
            task.error_json = (
                error.model_dump(mode="json") if error is not None and accepted else None
            )
            task.metrics_json = metrics.model_dump(mode="json")
            task.finished_at = now
            task.updated_at = now
            run_node = session.get(
                AigcPipelineRunNodeORM,
                (task.run_id, task.node_id),
            )
            assert run_node is not None
            run_node.status = AigcRunNodeStatus(final_status.value)
            run_node.result_json = final_result.model_dump(mode="json")
            run_node.updated_at = now
            session.flush()
            return self._aigc_task_from_orm(session, task), accepted

    def add_aigc_task_assets(
        self,
        references: Iterable[AigcPipelineTaskAssetReference],
    ) -> list[AigcPipelineTaskAssetReference]:
        items = list(references)
        with self._session_factory.begin() as session:
            for reference in items:
                if session.get(AigcPipelineTaskORM, reference.task_id) is None:
                    raise NotFoundError(
                        f"AIGC task not found: {reference.task_id}"
                    )
                self._require_asset(session, reference.asset_id)
                session.add(
                    AigcPipelineTaskAssetORM(
                        task_id=reference.task_id,
                        direction=reference.direction,
                        slot=reference.slot,
                        ordinal=reference.ordinal,
                        asset_id=reference.asset_id,
                    )
                )
            session.flush()
            return [item.model_copy(deep=True) for item in items]

    def list_aigc_task_assets(
        self,
        task_id: str,
    ) -> list[AigcPipelineTaskAssetReference]:
        with self._session_factory() as session:
            if session.get(AigcPipelineTaskORM, task_id) is None:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            return [
                AigcPipelineTaskAssetReference(
                    task_id=item.task_id,
                    direction=item.direction,
                    slot=item.slot,
                    ordinal=item.ordinal,
                    asset_id=item.asset_id,
                )
                for item in session.scalars(
                    select(AigcPipelineTaskAssetORM)
                    .where(AigcPipelineTaskAssetORM.task_id == task_id)
                    .order_by(
                        AigcPipelineTaskAssetORM.direction,
                        AigcPipelineTaskAssetORM.slot,
                        AigcPipelineTaskAssetORM.ordinal,
                    )
                ).all()
            ]

    def remove_aigc_task_assets(
        self,
        task_id: str,
        *,
        direction: AigcAssetDirection | None = None,
    ) -> list[AigcPipelineTaskAssetReference]:
        with self._session_factory.begin() as session:
            if session.get(AigcPipelineTaskORM, task_id) is None:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            statement = select(AigcPipelineTaskAssetORM).where(
                AigcPipelineTaskAssetORM.task_id == task_id
            )
            if direction is not None:
                statement = statement.where(
                    AigcPipelineTaskAssetORM.direction == direction
                )
            rows = list(session.scalars(statement).all())
            removed = [
                AigcPipelineTaskAssetReference(
                    task_id=item.task_id,
                    direction=item.direction,
                    slot=item.slot,
                    ordinal=item.ordinal,
                    asset_id=item.asset_id,
                )
                for item in rows
            ]
            for row in rows:
                session.delete(row)
            session.flush()
            return removed

    def acquire_aigc_worker_lease(
        self,
        owner_id: str,
        *,
        now: datetime,
        lease_seconds: int,
    ) -> AigcWorkerLease | None:
        with self._session_factory.begin() as session:
            lease = session.scalar(
                select(AigcPipelineWorkerLeaseORM)
                .where(AigcPipelineWorkerLeaseORM.id == "aigc_scheduler")
                .with_for_update()
            )
            if lease is None:
                lease = AigcPipelineWorkerLeaseORM(
                    id="aigc_scheduler",
                    owner_id=owner_id,
                    fencing_token=1,
                    heartbeat_at=now,
                    lease_expires_at=now + timedelta(seconds=lease_seconds),
                )
                session.add(lease)
            elif (
                lease.owner_id != owner_id
                and self._as_utc(lease.lease_expires_at) > self._as_utc(now)
            ):
                return None
            else:
                if lease.owner_id != owner_id:
                    lease.fencing_token += 1
                lease.owner_id = owner_id
                lease.heartbeat_at = now
                lease.lease_expires_at = now + timedelta(seconds=lease_seconds)
            session.flush()
            return self._aigc_worker_lease_from_orm(lease)

    def renew_aigc_worker_lease(
        self,
        owner_id: str,
        fencing_token: int,
        *,
        now: datetime,
        lease_seconds: int,
    ) -> AigcWorkerLease | None:
        with self._session_factory.begin() as session:
            lease = session.scalar(
                select(AigcPipelineWorkerLeaseORM)
                .where(AigcPipelineWorkerLeaseORM.id == "aigc_scheduler")
                .with_for_update()
            )
            if (
                lease is None
                or lease.owner_id != owner_id
                or lease.fencing_token != fencing_token
                or self._as_utc(lease.lease_expires_at) <= self._as_utc(now)
            ):
                return None
            lease.heartbeat_at = now
            lease.lease_expires_at = now + timedelta(seconds=lease_seconds)
            session.flush()
            return self._aigc_worker_lease_from_orm(lease)

    def create_project(self, data: ProjectCreate) -> Project:
        brief = Brief(**data.brief.model_dump())
        project = Project(
            name=data.name or self._default_project_name(brief),
            project_type=data.project_type,
            brief=brief,
            current_stage=(
                Stage.IMAGE
                if data.project_type.value == "image_asset"
                else Stage.BRIEF
            ),
        )

        with self._session_factory.begin() as session:
            orm_project = ProjectORM(
                id=project.id,
                name=project.name,
                project_type=project.project_type,
                status=project.status,
                current_stage=project.current_stage,
                current_image_prompt_version_id=(
                    project.current_image_prompt_version_id
                ),
                image_prompt_status=project.image_prompt_status,
                current_image_asset_id=project.current_image_asset_id,
                image_revision=project.image_revision,
                image_reference_asset_ids=project.image_reference_asset_ids,
                created_at=project.created_at,
                updated_at=project.updated_at,
                deleted_at=None,
            )
            orm_project.brief = BriefORM(
                prompt=project.brief.prompt,
                target_language=project.brief.target_language,
                target_platform=project.brief.target_platform,
                aspect_ratio=project.brief.aspect_ratio,
                duration_seconds=project.brief.duration_seconds,
                image_purpose=project.brief.image_purpose,
                style=project.brief.style,
                audience=project.brief.audience,
                product_name=project.brief.product_name,
                summary=project.brief.summary,
                selling_points=project.brief.selling_points,
            )
            session.add(orm_project)
            session.flush()
            return self._project_from_orm(orm_project)

    def get_project(self, project_id: str) -> Project:
        with self._session_factory() as session:
            return self._project_from_orm(self._require_project(session, project_id))

    def list_projects(self) -> list[Project]:
        with self._session_factory() as session:
            projects = session.scalars(
                select(ProjectORM)
                .where(ProjectORM.deleted_at.is_(None))
                .order_by(ProjectORM.created_at)
            ).all()
            return [self._project_from_orm(project) for project in projects]

    def list_project_summaries(self, q: str | None = None) -> list[ProjectListItem]:
        # The list view only needs scalar columns plus the brief, so we batch
        # the brief with selectinload and skip hydrating the (potentially large)
        # child collections that _project_from_orm would lazy-load per project.
        keyword = (q or "").strip()
        conditions = [ProjectORM.deleted_at.is_(None)]
        if keyword:
            conditions.append(
                or_(
                    ProjectORM.name.icontains(keyword, autoescape=True),
                    BriefORM.product_name.icontains(keyword, autoescape=True),
                    BriefORM.prompt.icontains(keyword, autoescape=True),
                )
            )
        with self._session_factory() as session:
            projects = session.scalars(
                select(ProjectORM)
                .join(ProjectORM.brief)
                .options(selectinload(ProjectORM.brief))
                .where(*conditions)
                .order_by(ProjectORM.created_at)
            ).all()
            return [self._project_summary_from_orm(project) for project in projects]

    def delete_project(self, project_id: str) -> None:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            now = utc_now()
            project.deleted_at = now
            project.updated_at = now
            session.flush()

    def update_project(self, project_id: str, **changes: object) -> Project:
        if "project_type" in changes:
            raise ValueError("project_type cannot be updated")
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            for key, value in changes.items():
                if hasattr(project, key):
                    setattr(project, key, value)
            project.updated_at = utc_now()
            session.flush()
            return self._project_from_orm(project)

    def save_image_prompt_version(
        self,
        data: ImagePromptVersionCreate,
    ) -> ImagePromptVersion:
        with self._session_factory.begin() as session:
            project = session.scalar(
                select(ProjectORM)
                .where(
                    ProjectORM.id == data.project_id,
                    ProjectORM.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if project is None:
                raise NotFoundError(f"project not found: {data.project_id}")
            next_version = (
                session.scalar(
                    select(func.max(ImagePromptVersionORM.version)).where(
                        ImagePromptVersionORM.project_id == data.project_id
                    )
                )
                or 0
            ) + 1
            version = ImagePromptVersion(
                **data.model_dump(),
                version=next_version,
            )
            orm_version = ImagePromptVersionORM(
                id=version.id,
                project_id=version.project_id,
                version=version.version,
                prompt=version.prompt,
                aspect_ratio=version.aspect_ratio,
                target_language=version.target_language,
                image_purpose=version.image_purpose,
                created_at=version.created_at,
            )
            session.add(orm_version)
            project.current_image_prompt_version_id = version.id
            project.image_prompt_status = Status.SUCCEEDED
            project.current_stage = Stage.IMAGE
            project.updated_at = utc_now()
            session.flush()
            return self._image_prompt_version_from_orm(orm_version)

    def get_image_prompt_version(
        self,
        project_id: str,
        version_id: str,
    ) -> ImagePromptVersion:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            version = session.get(ImagePromptVersionORM, version_id)
            if version is None or version.project_id != project_id:
                raise NotFoundError(f"image prompt version not found: {version_id}")
            return self._image_prompt_version_from_orm(version)

    def list_image_prompt_versions(
        self,
        project_id: str,
    ) -> list[ImagePromptVersion]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            versions = session.scalars(
                select(ImagePromptVersionORM)
                .where(ImagePromptVersionORM.project_id == project_id)
                .order_by(ImagePromptVersionORM.version.desc())
            ).all()
            return [
                self._image_prompt_version_from_orm(version)
                for version in versions
            ]

    def mark_image_prompt_stale(self, project_id: str) -> Project:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            assets = session.scalars(
                select(AssetORM).where(
                    AssetORM.project_id == project_id,
                    AssetORM.asset_role == AssetRole.PUBLIC,
                    AssetORM.type == AssetType.GENERATED_IMAGE,
                )
            ).all()
            candidates = {asset.id: asset for asset in assets}
            stale_ids = {
                asset.id
                for asset in assets
                if asset.metadata_json.get("prompt_version_id")
            }
            pending = list(stale_ids)
            while pending:
                source_id = pending.pop()
                for asset in candidates.values():
                    if (
                        asset.id not in stale_ids
                        and asset.metadata_json.get("source_asset_id") == source_id
                    ):
                        stale_ids.add(asset.id)
                        pending.append(asset.id)
            now = utc_now()
            for asset_id in stale_ids:
                asset = candidates[asset_id]
                if asset.status != Status.STALE:
                    asset.status = Status.STALE
                    asset.updated_at = now
            project.image_prompt_status = Status.STALE
            project.current_stage = Stage.IMAGE
            project.updated_at = now
            session.flush()
            return self._project_from_orm(project)

    def set_image_reference_asset_ids(
        self,
        project_id: str,
        asset_ids: list[str],
    ) -> Project:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            project.image_reference_asset_ids = list(asset_ids)
            project.updated_at = utc_now()
            session.flush()
            return self._project_from_orm(project)

    def set_current_image_asset(
        self,
        project_id: str,
        asset_id: str,
        *,
        expected_revision: int,
    ) -> Project:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            asset = self._require_project_asset(session, project_id, asset_id)
            if (
                asset.asset_role != AssetRole.PUBLIC
                or asset.type not in {AssetType.GENERATED_IMAGE, AssetType.UPLOADED_IMAGE}
                or asset.status != Status.SUCCEEDED
            ):
                raise ValueError("asset is not an eligible current image")
            result = session.execute(
                update(ProjectORM)
                .where(
                    ProjectORM.id == project_id,
                    ProjectORM.deleted_at.is_(None),
                    ProjectORM.image_revision == expected_revision,
                )
                .values(
                    current_image_asset_id=asset_id,
                    image_revision=expected_revision + 1,
                    updated_at=utc_now(),
                )
            )
            if result.rowcount != 1:
                raise RevisionConflictError("image revision conflict")
            session.expire(project)
            session.flush()
            return self._project_from_orm(project)

    def update_project_details(
        self,
        project_id: str,
        data: ProjectUpdate,
    ) -> Project:
        if "project_type" in data.model_fields_set:
            raise ValueError("project_type cannot be updated")
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            if "name" in data.model_fields_set:
                project.name = data.name  # type: ignore[assignment]
            if data.brief is not None:
                brief_changes = data.brief.model_dump(exclude_unset=True)
                current = self._project_from_orm(project)
                candidate = ProjectBase(
                    name=project.name,
                    project_type=current.project_type,
                    brief={
                        **current.brief.model_dump(),
                        **brief_changes,
                    },
                    status=current.status,
                    current_stage=current.current_stage,
                )
                for key in brief_changes:
                    setattr(project.brief, key, getattr(candidate.brief, key))
            project.updated_at = utc_now()
            session.flush()
            return self._project_from_orm(project)

    def create_task(self, data: GenerationTaskCreate) -> GenerationTask:
        task = GenerationTask(**data.model_dump())
        with self._session_factory.begin() as session:
            self._require_project(session, task.project_id)
            orm_task = GenerationTaskORM(
                id=task.id,
                project_id=task.project_id,
                stage=task.stage,
                status=task.status,
                progress=task.progress,
                progress_message=task.progress_message,
                input_hash=task.input_hash,
                frozen_input=task.frozen_input,
                retry_of_task_id=task.retry_of_task_id,
                output_asset_ids=task.output_asset_ids,
                output_text_artifact_id=task.output_text_artifact_id,
                created_at=task.created_at,
                updated_at=task.updated_at,
                started_at=task.started_at,
                finished_at=task.finished_at,
            )
            self._set_task_error(orm_task, task.error)
            session.add(orm_task)
            self._touch_project(session, task.project_id)
            session.flush()
            return self._task_from_orm(orm_task)

    def create_task_if_no_active_hash(
        self,
        data: GenerationTaskCreate,
    ) -> tuple[GenerationTask, bool]:
        task = GenerationTask(**data.model_dump())
        with self._session_factory.begin() as session:
            project = session.scalar(
                select(ProjectORM)
                .where(
                    ProjectORM.id == task.project_id,
                    ProjectORM.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if project is None:
                raise NotFoundError(f"project not found: {task.project_id}")
            active = session.scalar(
                select(GenerationTaskORM)
                .where(
                    GenerationTaskORM.project_id == task.project_id,
                    GenerationTaskORM.stage == task.stage,
                    GenerationTaskORM.input_hash == task.input_hash,
                    GenerationTaskORM.status.in_(
                        [Status.QUEUED, Status.RUNNING]
                    ),
                )
                .order_by(GenerationTaskORM.created_at)
                .limit(1)
            )
            if active is not None:
                return self._task_from_orm(active), False
            orm_task = GenerationTaskORM(
                id=task.id,
                project_id=task.project_id,
                stage=task.stage,
                status=task.status,
                progress=task.progress,
                progress_message=task.progress_message,
                input_hash=task.input_hash,
                frozen_input=task.frozen_input,
                retry_of_task_id=task.retry_of_task_id,
                output_asset_ids=task.output_asset_ids,
                output_text_artifact_id=task.output_text_artifact_id,
                created_at=task.created_at,
                updated_at=task.updated_at,
                started_at=task.started_at,
                finished_at=task.finished_at,
            )
            self._set_task_error(orm_task, task.error)
            session.add(orm_task)
            project.updated_at = utc_now()
            session.flush()
            return self._task_from_orm(orm_task), True

    def get_task(self, task_id: str) -> GenerationTask:
        with self._session_factory() as session:
            return self._task_from_orm(self._require_task(session, task_id))

    def list_project_tasks(self, project_id: str) -> list[GenerationTask]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            tasks = session.scalars(
                select(GenerationTaskORM)
                .where(GenerationTaskORM.project_id == project_id)
                .order_by(GenerationTaskORM.created_at)
            ).all()
            return [self._task_from_orm(task) for task in tasks]

    def find_active_task(
        self,
        project_id: str,
        stage: Stage,
    ) -> GenerationTask | None:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            task = session.scalar(
                select(GenerationTaskORM)
                .where(
                    GenerationTaskORM.project_id == project_id,
                    GenerationTaskORM.stage == stage,
                    GenerationTaskORM.status.in_([Status.QUEUED, Status.RUNNING]),
                )
                .order_by(GenerationTaskORM.created_at)
                .limit(1)
            )
            return self._task_from_orm(task) if task is not None else None

    def update_task(self, task_id: str, **changes: object) -> GenerationTask:
        with self._session_factory.begin() as session:
            task = self._require_task(session, task_id)
            for key, value in changes.items():
                if key == "error":
                    self._set_task_error(
                        task,
                        value if isinstance(value, TaskError) else None,
                    )
                elif hasattr(task, key):
                    setattr(task, key, value)
            task.updated_at = utc_now()
            self._touch_project(session, task.project_id)
            session.flush()
            return self._task_from_orm(task)

    def create_tool_task(self, data: ToolTaskCreate) -> ToolTask:
        return self.create_tool_task_with_input_assets(data, [])

    def create_tool_task_with_input_assets(
        self,
        data: ToolTaskCreate,
        inputs: Iterable[ToolTaskInputAsset],
    ) -> ToolTask:
        task = ToolTask(**data.model_dump())
        task_inputs = [ToolTaskInputAsset(**item.model_dump()) for item in inputs]
        if any(item.task_id != task.id for item in task_inputs):
            raise ValueError("tool task input belongs to another task")
        if len({item.asset_id for item in task_inputs}) != len(task_inputs):
            raise ValueError("tool task input assets must be unique")
        with self._session_factory.begin() as session:
            for item in task_inputs:
                self._require_asset(session, item.asset_id)
            orm_task = ToolTaskORM(
                id=task.id,
                type=task.type,
                status=task.status,
                input_snapshot=task.input_snapshot,
                provider_task_id=task.provider_task_id,
                retry_of_task_id=task.retry_of_task_id,
                created_at=task.created_at,
                updated_at=task.updated_at,
                started_at=task.started_at,
                finished_at=task.finished_at,
            )
            self._set_tool_task_error(orm_task, task.error)
            session.add(orm_task)
            session.add_all(
                [
                    ToolTaskInputAssetORM(
                        task_id=item.task_id,
                        asset_id=item.asset_id,
                        kind=item.kind,
                        created_at=item.created_at,
                    )
                    for item in task_inputs
                ]
            )
            session.flush()
            return self._tool_task_from_orm(orm_task)

    def get_tool_task(self, task_id: str) -> ToolTask:
        with self._session_factory() as session:
            task = session.get(ToolTaskORM, task_id)
            if task is None:
                raise NotFoundError(f"tool task not found: {task_id}")
            return self._tool_task_from_orm(task)

    def list_tool_task_input_assets(
        self,
        task_id: str,
    ) -> list[ToolTaskInputAsset]:
        with self._session_factory() as session:
            if session.get(ToolTaskORM, task_id) is None:
                raise NotFoundError(f"tool task not found: {task_id}")
            return [
                ToolTaskInputAsset(
                    task_id=item.task_id,
                    asset_id=item.asset_id,
                    kind=item.kind,
                    created_at=item.created_at,
                )
                for item in session.scalars(
                    select(ToolTaskInputAssetORM)
                    .where(ToolTaskInputAssetORM.task_id == task_id)
                    .order_by(ToolTaskInputAssetORM.created_at, ToolTaskInputAssetORM.asset_id)
                ).all()
            ]

    def list_tool_tasks(
        self,
        *,
        task_type: ToolTaskType | None = None,
    ) -> list[ToolTask]:
        with self._session_factory() as session:
            statement = select(ToolTaskORM).order_by(
                ToolTaskORM.created_at.desc(), ToolTaskORM.id.desc()
            )
            if task_type is not None:
                statement = statement.where(ToolTaskORM.type == task_type)
            return [
                self._tool_task_from_orm(task)
                for task in session.scalars(statement).all()
            ]

    def update_tool_task(self, task_id: str, **changes: object) -> ToolTask:
        with self._session_factory.begin() as session:
            task = session.get(ToolTaskORM, task_id)
            if task is None:
                raise NotFoundError(f"tool task not found: {task_id}")
            for key, value in changes.items():
                if key == "error":
                    self._set_tool_task_error(
                        task, value if isinstance(value, ToolTaskError) else None
                    )
                elif hasattr(task, key):
                    setattr(task, key, value)
            task.updated_at = utc_now()
            session.flush()
            return self._tool_task_from_orm(task)

    def delete_tool_task(self, task_id: str) -> ToolTask:
        with self._session_factory.begin() as session:
            task = session.get(ToolTaskORM, task_id)
            if task is None:
                raise NotFoundError(f"tool task not found: {task_id}")
            deleted = self._tool_task_from_orm(task)
            session.execute(
                update(ToolTaskORM)
                .where(ToolTaskORM.retry_of_task_id == task_id)
                .values(retry_of_task_id=None)
            )
            session.execute(
                update(AssetORM)
                .where(AssetORM.tool_task_id == task_id)
                .values(tool_task_id=None)
            )
            session.flush()
            session.delete(task)
            session.flush()
            return deleted

    def create_asset(self, data: AssetCreate) -> Asset:
        return self.create_assets([data])[0]

    def create_assets(self, items: Iterable[AssetCreate]) -> list[Asset]:
        assets = [Asset(**item.model_dump()) for item in items]
        with self._session_factory.begin() as session:
            for project_id in {asset.project_id for asset in assets if asset.project_id}:
                self._require_project(session, project_id)
            for tool_task_id in {
                asset.tool_task_id for asset in assets if asset.tool_task_id
            }:
                if session.get(ToolTaskORM, tool_task_id) is None:
                    raise NotFoundError(f"tool task not found: {tool_task_id}")
            orm_assets = [
                AssetORM(
                    id=asset.id,
                    project_id=asset.project_id,
                    tool_task_id=asset.tool_task_id,
                    tool_asset_role=asset.tool_asset_role,
                    type=asset.type,
                    category=asset.category,
                    asset_role=asset.asset_role,
                    status=asset.status,
                    stage=asset.stage,
                    url=asset.url,
                    object_key=asset.object_key,
                    mime_type=asset.mime_type,
                    size_bytes=asset.size_bytes,
                    source_task_id=asset.source_task_id,
                    metadata_json=asset.metadata,
                    created_at=asset.created_at,
                    updated_at=asset.updated_at,
                )
                for asset in assets
            ]
            session.add_all(orm_assets)
            for project_id in {asset.project_id for asset in assets if asset.project_id}:
                self._touch_project(session, project_id)
            session.flush()
            return [self._asset_from_orm(asset) for asset in orm_assets]

    def create_asset_and_set_current_image(
        self,
        data: AssetCreate,
        *,
        expected_revision: int,
    ) -> Asset:
        asset = Asset(**data.model_dump())
        if (
            asset.asset_role != AssetRole.PUBLIC
            or asset.type != AssetType.GENERATED_IMAGE
            or asset.status != Status.SUCCEEDED
        ):
            raise ValueError("asset is not an eligible current image")
        with self._session_factory.begin() as session:
            self._require_project(session, asset.project_id)
            result = session.execute(
                update(ProjectORM)
                .where(
                    ProjectORM.id == asset.project_id,
                    ProjectORM.deleted_at.is_(None),
                    ProjectORM.image_revision == expected_revision,
                )
                .values(
                    current_image_asset_id=asset.id,
                    image_revision=expected_revision + 1,
                    updated_at=utc_now(),
                )
            )
            if result.rowcount != 1:
                raise RevisionConflictError("image revision conflict")
            orm_asset = AssetORM(
                id=asset.id,
                project_id=asset.project_id,
                type=asset.type,
                category=asset.category,
                asset_role=asset.asset_role,
                status=asset.status,
                stage=asset.stage,
                url=asset.url,
                object_key=asset.object_key,
                mime_type=asset.mime_type,
                size_bytes=asset.size_bytes,
                source_task_id=asset.source_task_id,
                metadata_json=asset.metadata,
                created_at=asset.created_at,
                updated_at=asset.updated_at,
            )
            session.add(orm_asset)
            session.flush()
            return self._asset_from_orm(orm_asset)

    def get_asset(self, asset_id: str) -> Asset:
        with self._session_factory() as session:
            return self._asset_from_orm(self._require_asset(session, asset_id))

    def delete_tool_asset(self, asset_id: str) -> Asset:
        with self._session_factory.begin() as session:
            asset = self._require_asset(session, asset_id)
            if asset.tool_asset_role is None:
                raise NotFoundError(f"tool asset not found: {asset_id}")
            self._prepare_aigc_asset_delete(session, asset_id)
            deleted = self._asset_from_orm(asset)
            session.delete(asset)
            session.flush()
            return deleted

    def create_image_layer_set(
        self,
        data: ImageLayerSetCreate,
        *,
        layers: Iterable[ImageLayerCreate],
        assets: Iterable[AssetCreate],
    ) -> ImageLayerSet:
        created_assets = [Asset(**item.model_dump()) for item in assets]
        created_layers = [ImageLayer(**item.model_dump()) for item in layers]
        asset_ids = {asset.id for asset in created_assets}
        if len(asset_ids) != len(created_assets):
            raise ValueError("image layer assets must be unique")
        if data.base_asset_id not in asset_ids:
            raise ValueError("base asset is missing from atomic create")
        base_asset = next(
            asset for asset in created_assets if asset.id == data.base_asset_id
        )
        if (
            data.status != Status.SUCCEEDED
            or base_asset.asset_role != AssetRole.INTERNAL_BASE
            or base_asset.status != Status.SUCCEEDED
        ):
            raise ValueError("image layer base must be an internal succeeded asset")
        if any(layer.set_id != data.id for layer in created_layers):
            raise ValueError("image layer belongs to another set")
        if any(layer.asset_id not in asset_ids for layer in created_layers):
            raise ValueError("image layer asset is missing from atomic create")
        layer_asset_ids = {layer.asset_id for layer in created_layers}
        if asset_ids != {data.base_asset_id, *layer_asset_ids}:
            raise ValueError("atomic create contains unrelated assets")
        if any(
            asset.asset_role != AssetRole.INTERNAL_LAYER
            or asset.status != Status.SUCCEEDED
            for asset in created_assets
            if asset.id in layer_asset_ids
        ):
            raise ValueError("image layers must use internal succeeded assets")
        layer_set = ImageLayerSet(**data.model_dump(), layers=created_layers)

        with self._session_factory.begin() as session:
            self._require_project(session, data.project_id)
            source = self._require_project_asset(
                session,
                data.project_id,
                data.source_asset_id,
            )
            if (
                source.asset_role != AssetRole.PUBLIC
                or source.type not in {AssetType.GENERATED_IMAGE, AssetType.UPLOADED_IMAGE}
                or source.status != Status.SUCCEEDED
            ):
                raise ValueError("source asset is not a succeeded public image")
            orm_assets = [self._asset_to_orm(asset) for asset in created_assets]
            session.add_all(orm_assets)
            session.flush()

            orm_set = ImageLayerSetORM(
                id=layer_set.id,
                project_id=layer_set.project_id,
                source_asset_id=layer_set.source_asset_id,
                base_asset_id=layer_set.base_asset_id,
                canvas_width=layer_set.canvas_width,
                canvas_height=layer_set.canvas_height,
                status=layer_set.status,
                revision=layer_set.revision,
                created_at=layer_set.created_at,
                updated_at=layer_set.updated_at,
            )
            orm_set.layers = [
                ImageLayerORM(
                    id=layer.id,
                    asset_id=layer.asset_id,
                    z_index=layer.z_index,
                    name=layer.name,
                    description=layer.description,
                    bbox_absolute=list(layer.bbox_absolute),
                    bbox_normalized=list(layer.bbox_normalized),
                    visible=layer.visible,
                    x=layer.x,
                    y=layer.y,
                    scale=layer.scale,
                )
                for layer in layer_set.layers
            ]
            session.add(orm_set)
            self._touch_project(session, data.project_id)
            session.flush()
            return self._image_layer_set_from_orm(orm_set)

    def get_image_layer_set(
        self,
        project_id: str,
        set_id: str,
    ) -> ImageLayerSet:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            layer_set = session.scalar(
                select(ImageLayerSetORM)
                .options(selectinload(ImageLayerSetORM.layers))
                .where(
                    ImageLayerSetORM.id == set_id,
                    ImageLayerSetORM.project_id == project_id,
                )
            )
            if layer_set is None:
                raise NotFoundError(f"image layer set not found: {set_id}")
            return self._image_layer_set_from_orm(layer_set)

    def list_image_layer_sets(self, project_id: str) -> list[ImageLayerSet]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            layer_sets = session.scalars(
                select(ImageLayerSetORM)
                .options(selectinload(ImageLayerSetORM.layers))
                .where(ImageLayerSetORM.project_id == project_id)
                .order_by(ImageLayerSetORM.created_at, ImageLayerSetORM.id)
            ).all()
            return [
                self._image_layer_set_from_orm(layer_set)
                for layer_set in layer_sets
            ]

    def update_image_layer_set(
        self,
        project_id: str,
        set_id: str,
        *,
        expected_revision: int,
        layers: Iterable[ImageLayerUpdate],
    ) -> ImageLayerSet:
        updates = list(layers)
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            layer_set = session.scalar(
                select(ImageLayerSetORM)
                .options(selectinload(ImageLayerSetORM.layers))
                .where(
                    ImageLayerSetORM.id == set_id,
                    ImageLayerSetORM.project_id == project_id,
                )
                .with_for_update()
            )
            if layer_set is None:
                raise NotFoundError(f"image layer set not found: {set_id}")
            if layer_set.revision != expected_revision:
                raise RevisionConflictError("image layer set revision conflict")
            if (
                len(updates) != len(layer_set.layers)
                or {item.id for item in updates}
                != {item.id for item in layer_set.layers}
            ):
                raise ValueError("all image layers must be updated exactly once")
            update_by_id = {item.id: item for item in updates}
            for offset, layer in enumerate(layer_set.layers, start=1):
                layer.z_index = -offset
            session.flush()
            for layer in layer_set.layers:
                item = update_by_id[layer.id]
                layer.z_index = item.z_index
                layer.visible = item.visible
                layer.x = item.x
                layer.y = item.y
                layer.scale = item.scale
            layer_set.revision += 1
            layer_set.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._image_layer_set_from_orm(layer_set)

    def replace_image_layer_asset(
        self, project_id: str, set_id: str, *, expected_revision: int,
        layer_id: str, asset: AssetCreate,
    ) -> ImageLayerSet:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            layer_set = session.scalar(
                select(ImageLayerSetORM).options(selectinload(ImageLayerSetORM.layers))
                .where(ImageLayerSetORM.id == set_id, ImageLayerSetORM.project_id == project_id)
                .with_for_update()
            )
            if layer_set is None:
                raise NotFoundError(f"image layer set not found: {set_id}")
            if layer_set.revision != expected_revision:
                raise RevisionConflictError("image layer set revision conflict")
            layer = next((item for item in layer_set.layers if item.id == layer_id), None)
            if layer is None:
                raise ValueError("image layer not found")
            if asset.project_id != project_id or asset.asset_role != AssetRole.INTERNAL_LAYER:
                raise ValueError("replacement must be an internal layer asset")
            orm_asset = session.get(AssetORM, asset.id)
            if orm_asset is None:
                orm_asset = self._asset_to_orm(Asset(**asset.model_dump()))
                session.add(orm_asset)
                session.flush()
            layer.asset_id = orm_asset.id
            layer_set.revision += 1
            layer_set.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._image_layer_set_from_orm(layer_set)

    def get_canvas_layout(self, project_id: str) -> CanvasLayout:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            layout = session.get(CanvasLayoutORM, project_id)
            if layout is None:
                return CanvasLayout(project_id=project_id, nodes=[], revision=0)
            return self._canvas_layout_from_orm(layout)

    def save_canvas_layout(
        self,
        project_id: str,
        *,
        expected_revision: int,
        nodes: Iterable[CanvasNode],
    ) -> CanvasLayout:
        serialized_nodes = [node.model_dump(mode="json") for node in nodes]
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            layout = session.get(CanvasLayoutORM, project_id, with_for_update=True)
            current_revision = layout.revision if layout is not None else 0
            if current_revision != expected_revision:
                raise RevisionConflictError("canvas layout revision conflict")
            now = utc_now()
            if layout is None:
                layout = CanvasLayoutORM(
                    project_id=project_id,
                    nodes=serialized_nodes,
                    revision=current_revision + 1,
                    updated_at=now,
                )
                session.add(layout)
            else:
                layout.nodes = serialized_nodes
                layout.revision = current_revision + 1
                layout.updated_at = now
            self._touch_project(session, project_id)
            session.flush()
            return self._canvas_layout_from_orm(layout)

    def list_project_assets(self, project_id: str) -> list[Asset]:
        return self.list_assets(project_id=project_id)

    def list_assets(
        self,
        *,
        project_id: str | None = None,
        category: AssetCategory | None = None,
        status: Status | None = None,
        asset_role: AssetRole | None = AssetRole.PUBLIC,
    ) -> list[Asset]:
        with self._session_factory() as session:
            if project_id is not None:
                self._require_project(session, project_id)
            conditions = []
            if project_id is not None:
                conditions.append(AssetORM.project_id == project_id)
            if category is not None:
                conditions.append(AssetORM.category == category)
            if status is not None:
                conditions.append(AssetORM.status == status)
            if asset_role is not None:
                conditions.append(AssetORM.asset_role == asset_role)
            assets = session.scalars(
                select(AssetORM)
                .outerjoin(ProjectORM, AssetORM.project_id == ProjectORM.id)
                .where(
                    or_(
                        AssetORM.project_id.is_(None),
                        ProjectORM.deleted_at.is_(None),
                    )
                )
                .where(*conditions)
                .order_by(AssetORM.created_at)
            ).all()
            return [self._asset_from_orm(asset) for asset in assets]

    def update_asset(self, asset_id: str, **changes: object) -> Asset:
        with self._session_factory.begin() as session:
            asset = self._require_asset(session, asset_id)
            for key, value in changes.items():
                if key == "metadata":
                    asset.metadata_json = value  # type: ignore[assignment]
                elif hasattr(asset, key):
                    setattr(asset, key, value)
            asset.updated_at = utc_now()
            if asset.project_id is not None:
                self._touch_project(session, asset.project_id)
            session.flush()
            return self._asset_from_orm(asset)

    def delete_asset(self, project_id: str, asset_id: str) -> Asset:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            asset = self._require_asset(session, asset_id)
            if asset.project_id != project_id:
                raise NotFoundError(f"asset not found: {asset_id}")
            self._prepare_aigc_asset_delete(session, asset_id)
            deleted = self._asset_from_orm(asset)

            shots = session.scalars(
                select(StoryboardShotORM).where(
                    StoryboardShotORM.project_id == project_id
                )
            ).all()
            for shot in shots:
                changed = False
                if shot.image_asset_id == asset_id:
                    shot.image_asset_id = None
                    changed = True
                if shot.first_frame_asset_id == asset_id:
                    shot.first_frame_asset_id = None
                    changed = True
                if shot.first_frame_source_video_asset_id == asset_id:
                    shot.first_frame_source_video_asset_id = None
                    changed = True
                if shot.video_asset_id == asset_id:
                    shot.video_asset_id = None
                    changed = True
                for field_name in (
                    "reference_image_asset_ids",
                    "reference_video_asset_ids",
                    "reference_audio_asset_ids",
                ):
                    current = list(getattr(shot, field_name) or [])
                    next_ids = [
                        existing_id
                        for existing_id in current
                        if existing_id != asset_id
                    ]
                    if next_ids != current:
                        setattr(shot, field_name, next_ids)
                        changed = True
                if changed:
                    shot.updated_at = utc_now()

            character_cards = session.scalars(
                select(CharacterCardORM).where(
                    CharacterCardORM.project_id == project_id,
                    CharacterCardORM.asset_id == asset_id,
                )
            ).all()
            for card in character_cards:
                card.asset_id = None
                card.updated_at = utc_now()

            tasks = session.scalars(
                select(GenerationTaskORM).where(
                    GenerationTaskORM.project_id == project_id
                )
            ).all()
            for task in tasks:
                output_ids = list(task.output_asset_ids or [])
                if asset_id in output_ids:
                    task.output_asset_ids = [
                        existing_id
                        for existing_id in output_ids
                        if existing_id != asset_id
                    ]
                    task.updated_at = utc_now()

            session.delete(asset)
            self._touch_project(session, project_id)
            session.flush()
            return deleted

    def create_character_card(self, data: CharacterCardCreate) -> CharacterCard:
        card = CharacterCard(**data.model_dump())
        with self._session_factory.begin() as session:
            self._require_project(session, card.project_id)
            self._require_project_asset(session, card.project_id, card.asset_id)
            orm_card = CharacterCardORM(
                id=card.id,
                project_id=card.project_id,
                name=card.name,
                description=card.description,
                sort_order=card.sort_order,
                asset_id=card.asset_id,
                status=card.status,
                created_at=card.created_at,
                updated_at=card.updated_at,
            )
            session.add(orm_card)
            self._touch_project(session, card.project_id)
            session.flush()
            return self._character_card_from_orm(orm_card)

    def get_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            return self._character_card_from_orm(
                self._require_character_card(session, project_id, card_id)
            )

    def list_project_character_cards(self, project_id: str) -> list[CharacterCard]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            cards = session.scalars(
                select(CharacterCardORM)
                .where(CharacterCardORM.project_id == project_id)
                .order_by(
                    CharacterCardORM.sort_order,
                    CharacterCardORM.created_at,
                    CharacterCardORM.id,
                )
            ).all()
            return [self._character_card_from_orm(card) for card in cards]

    def mark_character_cards_stale(self, project_id: str) -> list[CharacterCard]:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            cards = session.scalars(
                select(CharacterCardORM).where(
                    CharacterCardORM.project_id == project_id
                )
            ).all()
            for card in cards:
                card.status = Status.STALE
                card.updated_at = utc_now()
            if cards:
                self._touch_project(session, project_id)
            session.flush()
            return [self._character_card_from_orm(card) for card in cards]

    def update_character_card(
        self,
        project_id: str,
        card_id: str,
        **changes: object,
    ) -> CharacterCard:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            card = self._require_character_card(session, project_id, card_id)
            if "asset_id" in changes:
                asset_id = changes["asset_id"]
                if asset_id is not None and not isinstance(asset_id, str):
                    raise TypeError("asset_id must be a string or None")
                self._require_project_asset(session, project_id, asset_id)
            for key, value in changes.items():
                if hasattr(card, key):
                    setattr(card, key, value)
            card.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._character_card_from_orm(card)

    def delete_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            card = self._require_character_card(session, project_id, card_id)
            deleted = self._character_card_from_orm(card)
            session.delete(card)
            self._touch_project(session, project_id)
            session.flush()
            return deleted

    def replace_project_storyboard(
        self,
        project_id: str,
        shots: Iterable[StoryboardShotCreate],
    ) -> list[StoryboardShot]:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            session.execute(
                delete(StoryboardShotORM).where(
                    StoryboardShotORM.project_id == project_id
                )
            )
            created = [StoryboardShot(**shot.model_dump()) for shot in shots]
            for shot in created:
                session.add(
                    StoryboardShotORM(
                        id=shot.id,
                        project_id=shot.project_id,
                        index=shot.index,
                        title=shot.title,
                        description=shot.description,
                        visual_prompt=shot.visual_prompt,
                        narration=shot.narration,
                        duration_seconds=shot.duration_seconds,
                        status=shot.status,
                        image_asset_id=shot.image_asset_id,
                        first_frame_asset_id=shot.first_frame_asset_id,
                        first_frame_source_video_asset_id=(
                            shot.first_frame_source_video_asset_id
                        ),
                        video_asset_id=shot.video_asset_id,
                        video_prompt=shot.video_prompt,
                        reference_image_asset_ids=shot.reference_image_asset_ids,
                        reference_video_asset_ids=shot.reference_video_asset_ids,
                        reference_audio_asset_ids=shot.reference_audio_asset_ids,
                        merge_source_shots=[
                            snapshot.model_dump()
                            for snapshot in shot.merge_source_shots
                        ],
                        created_at=shot.created_at,
                        updated_at=shot.updated_at,
                    )
                )
            self._touch_project(session, project_id)
            session.flush()
            return sorted(created, key=lambda shot: shot.index)

    def list_project_storyboard(self, project_id: str) -> list[StoryboardShot]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            shots = session.scalars(
                select(StoryboardShotORM)
                .where(StoryboardShotORM.project_id == project_id)
                .order_by(StoryboardShotORM.index)
            ).all()
            return [self._storyboard_shot_from_orm(shot) for shot in shots]

    def mark_storyboard_shots_stale(self, project_id: str) -> list[StoryboardShot]:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            shots = session.scalars(
                select(StoryboardShotORM).where(
                    StoryboardShotORM.project_id == project_id
                )
            ).all()
            for shot in shots:
                shot.status = Status.STALE
                shot.updated_at = utc_now()
            if shots:
                self._touch_project(session, project_id)
            session.flush()
            return [self._storyboard_shot_from_orm(shot) for shot in shots]

    def get_storyboard_shot(self, project_id: str, shot_id: str) -> StoryboardShot:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            return self._storyboard_shot_from_orm(
                self._require_storyboard_shot(session, project_id, shot_id)
            )

    def get_storyboard_shot_by_index(
        self,
        project_id: str,
        shot_index: int,
    ) -> StoryboardShot:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            shot = session.scalar(
                select(StoryboardShotORM)
                .where(
                    StoryboardShotORM.project_id == project_id,
                    StoryboardShotORM.index == shot_index,
                )
                .limit(1)
            )
            if shot is None:
                raise NotFoundError(f"storyboard shot not found: {shot_index}")
            return self._storyboard_shot_from_orm(shot)

    def save_storyboard_shot_video_config(
        self,
        project_id: str,
        shot_id: str,
        data: StoryboardShotVideoConfigUpdate,
    ) -> StoryboardShot:
        changes: dict[str, object] = {}
        if "video_prompt" in data.model_fields_set:
            changes["video_prompt"] = data.video_prompt
        return self._update_storyboard_shot(project_id, shot_id, **changes)

    def attach_storyboard_shot_reference(
        self,
        project_id: str,
        shot_id: str,
        *,
        kind: ReferenceAssetKind,
        asset_id: str,
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            shot = self._require_storyboard_shot(session, project_id, shot_id)
            field_name = _reference_field_name(kind)
            existing = list(getattr(shot, field_name) or [])
            if asset_id not in existing:
                existing.append(asset_id)
            setattr(shot, field_name, existing)
            shot.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._storyboard_shot_from_orm(shot)

    def remove_storyboard_shot_reference(
        self,
        project_id: str,
        shot_id: str,
        *,
        kind: ReferenceAssetKind,
        asset_id: str,
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            shot = self._require_storyboard_shot(session, project_id, shot_id)
            field_name = _reference_field_name(kind)
            existing = [
                existing_id
                for existing_id in list(getattr(shot, field_name) or [])
                if existing_id != asset_id
            ]
            setattr(shot, field_name, existing)
            shot.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._storyboard_shot_from_orm(shot)

    def set_storyboard_shot_video_asset(
        self,
        project_id: str,
        shot_id: str,
        asset_id: str,
    ) -> StoryboardShot:
        return self._update_storyboard_shot(
            project_id,
            shot_id,
            video_asset_id=asset_id,
            status=Status.SUCCEEDED,
        )

    def set_storyboard_shot_first_frame(
        self,
        project_id: str,
        shot_id: str,
        *,
        asset_id: str | None,
        source_video_asset_id: str | None,
    ) -> StoryboardShot:
        return self._update_storyboard_shot(
            project_id,
            shot_id,
            first_frame_asset_id=asset_id,
            first_frame_source_video_asset_id=source_video_asset_id,
        )

    def delete_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            shot = self._require_storyboard_shot(session, project_id, shot_id)
            deleted = self._storyboard_shot_from_orm(shot)
            session.delete(shot)
            session.flush()

            remaining = session.scalars(
                select(StoryboardShotORM)
                .where(StoryboardShotORM.project_id == project_id)
                .order_by(StoryboardShotORM.index, StoryboardShotORM.created_at)
            ).all()
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = -index
            session.flush()
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = index
                remaining_shot.updated_at = utc_now()

            self._touch_project(session, project_id)
            session.flush()
            return deleted

    def merge_storyboard_shots(
        self,
        project_id: str,
        shot_ids: Iterable[str],
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            selected = [
                self._require_storyboard_shot(session, project_id, shot_id)
                for shot_id in shot_ids
            ]
            ordered = sorted(selected, key=lambda item: item.index)
            indices = [shot.index for shot in ordered]
            for earlier, later in zip(indices, indices[1:]):
                if later - earlier != 1:
                    raise ValueError("only adjacent shots can be merged")

            descriptions = [shot.description for shot in ordered if shot.description]
            visual_prompts = [
                shot.visual_prompt for shot in ordered if shot.visual_prompt
            ]
            narrations = [shot.narration for shot in ordered if shot.narration]
            selected_models = [
                self._storyboard_shot_from_orm(shot) for shot in ordered
            ]
            atomic_snapshots = [
                StoryboardAtomicShotSnapshot(
                    id=source.id,
                    title=source.title,
                    description=source.description,
                    visual_prompt=source.visual_prompt,
                    narration=source.narration,
                    duration_seconds=source.duration_seconds,
                    video_prompt=source.video_prompt,
                )
                for shot in selected_models
                for source in expand_atomic_shots(shot)
            ]
            merged_video_prompt = build_merged_shot_video_prompt(
                atomic_snapshots,
                target_language=project.brief.target_language,
            )

            primary = ordered[0]
            title_prefix = (
                "Shot"
                if project.brief.target_language == TargetLanguage.EN
                else "镜头"
            )
            primary.title = f"{title_prefix} {indices[0]}-{indices[-1]}"
            primary.description = "\n".join(descriptions)
            primary.visual_prompt = "\n".join(visual_prompts)
            primary.narration = "\n".join(narrations) if narrations else None
            primary.duration_seconds = sum(
                shot.duration_seconds for shot in ordered
            )
            primary.video_prompt = merged_video_prompt
            primary.reference_image_asset_ids = []
            primary.reference_video_asset_ids = []
            primary.reference_audio_asset_ids = []
            primary.merge_source_shots = [
                snapshot.model_dump() for snapshot in atomic_snapshots
            ]
            primary.first_frame_asset_id = None
            primary.first_frame_source_video_asset_id = None
            primary.video_asset_id = None
            primary.image_asset_id = None
            primary.status = Status.DRAFT
            primary.updated_at = utc_now()

            for shot in ordered[1:]:
                session.delete(shot)
            session.flush()

            remaining = session.scalars(
                select(StoryboardShotORM)
                .where(StoryboardShotORM.project_id == project_id)
                .order_by(StoryboardShotORM.index, StoryboardShotORM.created_at)
            ).all()
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = -index
            session.flush()
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = index
                remaining_shot.updated_at = utc_now()

            self._touch_project(session, project_id)
            session.flush()
            return self._storyboard_shot_from_orm(primary)

    def split_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
    ) -> list[StoryboardShot]:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            merged = self._require_storyboard_shot(session, project_id, shot_id)
            snapshots = [
                StoryboardAtomicShotSnapshot.model_validate(item)
                for item in (merged.merge_source_shots or [])
            ]
            if not snapshots:
                raise ValueError("storyboard shot does not have an atomic merge snapshot")

            merged_index = merged.index
            session.delete(merged)
            session.flush()

            remaining = session.scalars(
                select(StoryboardShotORM)
                .where(StoryboardShotORM.project_id == project_id)
                .order_by(StoryboardShotORM.index, StoryboardShotORM.created_at)
            ).all()
            original_indices = {
                remaining_shot.id: remaining_shot.index
                for remaining_shot in remaining
            }
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = -index
            session.flush()

            restored_orm: list[StoryboardShotORM] = []
            for offset, snapshot in enumerate(snapshots):
                restored = StoryboardShotORM(
                    id=snapshot.id,
                    project_id=project_id,
                    index=merged_index + offset,
                    title=snapshot.title,
                    description=snapshot.description,
                    visual_prompt=snapshot.visual_prompt,
                    narration=snapshot.narration,
                    duration_seconds=snapshot.duration_seconds,
                    status=Status.DRAFT,
                    image_asset_id=None,
                    first_frame_asset_id=None,
                    first_frame_source_video_asset_id=None,
                    video_asset_id=None,
                    video_prompt=snapshot.video_prompt,
                    reference_image_asset_ids=[],
                    reference_video_asset_ids=[],
                    reference_audio_asset_ids=[],
                    merge_source_shots=[],
                    created_at=utc_now(),
                    updated_at=utc_now(),
                )
                session.add(restored)
                restored_orm.append(restored)
            session.flush()

            shift = len(snapshots) - 1
            for remaining_shot in remaining:
                old_index = original_indices[remaining_shot.id]
                remaining_shot.index = (
                    old_index if old_index < merged_index else old_index + shift
                )
                remaining_shot.updated_at = utc_now()

            self._touch_project(session, project_id)
            session.flush()
            return [
                self._storyboard_shot_from_orm(shot)
                for shot in restored_orm
            ]

    def create_text_artifact(self, data: TextArtifactCreate) -> TextArtifact:
        artifact = TextArtifact(**data.model_dump())
        with self._session_factory.begin() as session:
            self._require_project(session, artifact.project_id)
            orm_artifact = TextArtifactORM(
                id=artifact.id,
                project_id=artifact.project_id,
                stage=artifact.stage,
                title=artifact.title,
                content=artifact.content,
                version=artifact.version,
                status=artifact.status,
                created_at=artifact.created_at,
                updated_at=artifact.updated_at,
            )
            session.add(orm_artifact)
            self._touch_project(session, artifact.project_id)
            session.flush()
            return self._text_artifact_from_orm(orm_artifact)

    def get_text_artifact(self, artifact_id: str) -> TextArtifact:
        with self._session_factory() as session:
            return self._text_artifact_from_orm(
                self._require_text_artifact(session, artifact_id)
            )

    def list_project_text_artifacts(self, project_id: str) -> list[TextArtifact]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            artifacts = session.scalars(
                select(TextArtifactORM)
                .where(TextArtifactORM.project_id == project_id)
                .order_by(TextArtifactORM.created_at)
            ).all()
            return [self._text_artifact_from_orm(artifact) for artifact in artifacts]

    def get_latest_text_artifact(
        self,
        project_id: str,
        stage: Stage,
        *,
        include_stale: bool = False,
    ) -> TextArtifact | None:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            conditions = [
                TextArtifactORM.project_id == project_id,
                TextArtifactORM.stage == stage,
            ]
            if not include_stale:
                conditions.append(TextArtifactORM.status != Status.STALE)
            artifact = session.scalar(
                select(TextArtifactORM)
                .where(*conditions)
                .order_by(TextArtifactORM.version.desc())
                .limit(1)
            )
            return (
                self._text_artifact_from_orm(artifact)
                if artifact is not None
                else None
            )

    def update_text_artifact(
        self,
        artifact_id: str,
        **changes: object,
    ) -> TextArtifact:
        with self._session_factory.begin() as session:
            artifact = self._require_text_artifact(session, artifact_id)
            for key, value in changes.items():
                if hasattr(artifact, key):
                    setattr(artifact, key, value)
            artifact.updated_at = utc_now()
            self._touch_project(session, artifact.project_id)
            session.flush()
            return self._text_artifact_from_orm(artifact)

    def delete_text_artifact(
        self,
        project_id: str,
        artifact_id: str,
    ) -> TextArtifact:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            artifact = self._require_text_artifact(session, artifact_id)
            if artifact.project_id != project_id:
                raise NotFoundError(f"text artifact not found: {artifact_id}")
            deleted = self._text_artifact_from_orm(artifact)
            tasks = session.scalars(
                select(GenerationTaskORM).where(
                    GenerationTaskORM.output_text_artifact_id == artifact_id
                )
            ).all()
            for task in tasks:
                task.output_text_artifact_id = None
                task.updated_at = utc_now()
            session.delete(artifact)
            self._touch_project(session, project_id)
            session.flush()
            return deleted

    def mark_text_artifacts_stale(
        self,
        project_id: str,
        stages: Iterable[Stage],
    ) -> list[TextArtifact]:
        stale_stages = set(stages)
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            if not stale_stages:
                return []
            artifacts = session.scalars(
                select(TextArtifactORM).where(
                    TextArtifactORM.project_id == project_id,
                    TextArtifactORM.stage.in_(stale_stages),
                )
            ).all()
            for artifact in artifacts:
                artifact.status = Status.STALE
                artifact.updated_at = utc_now()
            if artifacts:
                self._touch_project(session, project_id)
            session.flush()
            return [self._text_artifact_from_orm(artifact) for artifact in artifacts]

    def mark_assets_stale(
        self,
        project_id: str,
        stages: Iterable[Stage],
    ) -> list[Asset]:
        stale_stages = set(stages)
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            if not stale_stages:
                return []
            assets = session.scalars(
                select(AssetORM).where(
                    AssetORM.project_id == project_id,
                    AssetORM.stage.in_(stale_stages),
                )
            ).all()
            for asset in assets:
                if (
                    asset.metadata_json.get("usage")
                    == "storyboard_video_tail_frame_reference"
                ):
                    continue
                asset.status = Status.STALE
                asset.updated_at = utc_now()
            if assets:
                self._touch_project(session, project_id)
            session.flush()
            return [self._asset_from_orm(asset) for asset in assets]

    def mark_storyboard_video_assets_stale(
        self,
        project_id: str,
        shot_ids: Iterable[str],
        *,
        asset_ids: Iterable[str] | None = None,
    ) -> list[Asset]:
        affected_shot_ids = set(shot_ids)
        affected_asset_ids = set(asset_ids or [])
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            if not affected_shot_ids and not affected_asset_ids:
                return []
            assets = session.scalars(
                select(AssetORM).where(
                    AssetORM.project_id == project_id,
                    AssetORM.stage == Stage.VIDEO,
                    AssetORM.type == AssetType.STORYBOARD_VIDEO,
                )
            ).all()
            updated_assets = []
            for asset in assets:
                if asset.status == Status.STALE:
                    continue
                metadata = asset.metadata_json
                if (
                    asset.id in affected_asset_ids
                    or metadata.get("shot_id") in affected_shot_ids
                    or metadata.get("candidate_for_shot_id") in affected_shot_ids
                    or metadata.get("selected_for_shot_id") in affected_shot_ids
                ):
                    asset.status = Status.STALE
                    asset.updated_at = utc_now()
                    updated_assets.append(asset)
            if updated_assets:
                self._touch_project(session, project_id)
            session.flush()
            return [self._asset_from_orm(asset) for asset in updated_assets]

    @staticmethod
    def _require_project(session: Session, project_id: str) -> ProjectORM:
        project = session.get(ProjectORM, project_id)
        if project is None or project.deleted_at is not None:
            raise NotFoundError(f"project not found: {project_id}")
        return project

    @staticmethod
    def _require_task(session: Session, task_id: str) -> GenerationTaskORM:
        task = session.get(GenerationTaskORM, task_id)
        if task is None:
            raise NotFoundError(f"task not found: {task_id}")
        MySQLRepository._require_project(session, task.project_id)
        return task

    @staticmethod
    def _require_asset(session: Session, asset_id: str) -> AssetORM:
        asset = session.get(AssetORM, asset_id)
        if asset is None:
            raise NotFoundError(f"asset not found: {asset_id}")
        if asset.project_id is not None:
            MySQLRepository._require_project(session, asset.project_id)
        return asset

    @staticmethod
    def _require_project_asset(
        session: Session,
        project_id: str,
        asset_id: str | None,
    ) -> AssetORM | None:
        MySQLRepository._require_project(session, project_id)
        if asset_id is None:
            return None
        asset = MySQLRepository._require_asset(session, asset_id)
        if asset.project_id != project_id:
            raise NotFoundError(f"asset not found: {asset_id}")
        return asset

    @staticmethod
    def _require_character_card(
        session: Session,
        project_id: str,
        card_id: str,
    ) -> CharacterCardORM:
        card = session.get(CharacterCardORM, card_id)
        if card is None or card.project_id != project_id:
            raise NotFoundError(f"character card not found: {card_id}")
        return card

    @staticmethod
    def _require_text_artifact(session: Session, artifact_id: str) -> TextArtifactORM:
        artifact = session.get(TextArtifactORM, artifact_id)
        if artifact is None:
            raise NotFoundError(f"text artifact not found: {artifact_id}")
        MySQLRepository._require_project(session, artifact.project_id)
        return artifact

    @staticmethod
    def _require_storyboard_shot(
        session: Session,
        project_id: str,
        shot_id: str,
    ) -> StoryboardShotORM:
        MySQLRepository._require_project(session, project_id)
        shot = session.get(StoryboardShotORM, shot_id)
        if shot is None or shot.project_id != project_id:
            raise NotFoundError(f"storyboard shot not found: {shot_id}")
        return shot

    def _update_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
        **changes: object,
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            shot = self._require_storyboard_shot(session, project_id, shot_id)
            for key, value in changes.items():
                if hasattr(shot, key):
                    setattr(shot, key, value)
            shot.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._storyboard_shot_from_orm(shot)

    @staticmethod
    def _touch_project(session: Session, project_id: str) -> None:
        project = MySQLRepository._require_project(session, project_id)
        project.updated_at = utc_now()

    @staticmethod
    def _set_task_error(task: GenerationTaskORM, error: TaskError | None) -> None:
        task.error_code = error.code if error is not None else None
        task.error_message = error.message if error is not None else None
        task.error_detail = error.detail if error is not None else None

    @staticmethod
    def _aigc_template_from_orm(
        template: AigcPipelineTemplateORM,
    ) -> AigcPipelineTemplate:
        return AigcPipelineTemplate(
            id=template.id,
            name=template.name,
            description=template.description,
            definition=template.definition_json,
            revision=template.revision,
            created_at=template.created_at,
            updated_at=template.updated_at,
        )

    @staticmethod
    def _aigc_pipeline_from_orm(pipeline: AigcPipelineORM) -> AigcPipeline:
        return AigcPipeline(
            id=pipeline.id,
            name=pipeline.name,
            description=pipeline.description,
            source_template_id=pipeline.source_template_id,
            source_template_revision=pipeline.source_template_revision,
            definition=pipeline.definition_json,
            revision=pipeline.revision,
            latest_run_status=pipeline.latest_run_status,
            created_at=pipeline.created_at,
            updated_at=pipeline.updated_at,
        )

    @staticmethod
    def _aigc_run_from_orm(run: AigcPipelineRunORM) -> AigcPipelineRun:
        return AigcPipelineRun(
            id=run.id,
            pipeline_id=run.pipeline_id,
            run_number=run.run_number,
            pipeline_revision=run.pipeline_revision,
            mode=run.mode,
            start_node_id=run.start_node_id,
            source_run_id=run.source_run_id,
            source_node_id=run.source_node_id,
            status=run.status,
            definition_snapshot=run.definition_snapshot,
            input_snapshot=run.input_snapshot or {},
            error=(
                AigcTaskError.model_validate(run.error_json)
                if run.error_json
                else None
            ),
            cancellation_requested=run.cancellation_requested,
            created_at=run.created_at,
            updated_at=run.updated_at,
            started_at=run.started_at,
            finished_at=run.finished_at,
        )

    @classmethod
    def _aigc_task_from_orm(
        cls,
        session: Session,
        task: AigcPipelineTaskORM,
    ) -> AigcPipelineTaskAttempt:
        run = session.get(AigcPipelineRunORM, task.run_id)
        assert run is not None
        return AigcPipelineTaskAttempt(
            task_id=task.id,
            pipeline_id=run.pipeline_id,
            run_id=task.run_id,
            node_id=task.node_id,
            attempt=task.attempt,
            type=task.type,
            params=task.params_json or {},
            upstream=task.upstream_json or [],
            status=task.status,
            progress=task.progress,
            result=AigcTaskResult.model_validate(task.result_json or {}),
            error=(
                AigcTaskError.model_validate(task.error_json)
                if task.error_json
                else None
            ),
            metrics=AigcTaskMetrics.model_validate(task.metrics_json or {}),
            created_at=task.created_at,
            started_at=task.started_at,
            finished_at=task.finished_at,
        )

    @classmethod
    def _aigc_run_node_from_orm(
        cls,
        session: Session,
        node: AigcPipelineRunNodeORM,
    ) -> AigcPipelineRunNode:
        attempts = session.scalars(
            select(AigcPipelineTaskORM)
            .where(
                AigcPipelineTaskORM.run_id == node.run_id,
                AigcPipelineTaskORM.node_id == node.node_id,
            )
            .order_by(AigcPipelineTaskORM.attempt)
        ).all()
        return AigcPipelineRunNode(
            node_id=node.node_id,
            included_in_plan=node.included_in_plan,
            status=node.status,
            current_task_id=node.current_task_id,
            reused_from_task_id=node.reused_from_task_id,
            input_hash=node.input_hash,
            result=AigcTaskResult.model_validate(node.result_json or {}),
            error=(
                AigcTaskError.model_validate(node.error_json)
                if node.error_json
                else None
            ),
            attempts=[
                cls._aigc_task_from_orm(session, task) for task in attempts
            ],
        )

    @classmethod
    def _aigc_run_detail_from_orm(
        cls,
        session: Session,
        run: AigcPipelineRunORM,
    ) -> AigcPipelineRunDetail:
        nodes = session.scalars(
            select(AigcPipelineRunNodeORM).where(
                AigcPipelineRunNodeORM.run_id == run.id
            )
        ).all()
        order = {
            item["id"]: index
            for index, item in enumerate(
                (run.definition_snapshot or {}).get("nodes", [])
            )
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
        sorted_nodes = sorted(
            nodes,
            key=lambda item: (order.get(item.node_id, len(order)), item.node_id),
        )
        return AigcPipelineRunDetail(
            run=cls._aigc_run_from_orm(run),
            nodes=[
                cls._aigc_run_node_from_orm(session, node)
                for node in sorted_nodes
            ],
        )

    @staticmethod
    def _aigc_worker_lease_from_orm(
        lease: AigcPipelineWorkerLeaseORM,
    ) -> AigcWorkerLease:
        return AigcWorkerLease(
            owner_id=lease.owner_id,
            fencing_token=lease.fencing_token,
            lease_expires_at=lease.lease_expires_at,
            heartbeat_at=lease.heartbeat_at,
        )

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @staticmethod
    def _aigc_asset_references_for_pipeline(
        session: Session,
        pipeline: AigcPipeline,
    ) -> list[AigcPipelineAssetReference]:
        references = [
            AigcPipelineAssetReference(
                pipeline_id=pipeline.id,
                node_id=node.id,
                slot="image",
                asset_id=node.config.asset_id,
            )
            for node in pipeline.definition.nodes
            if isinstance(node, ImageInputNode) and node.config.asset_id is not None
        ]
        for reference in references:
            if session.get(AssetORM, reference.asset_id) is None:
                raise NotFoundError(f"asset not found: {reference.asset_id}")
        return references

    @staticmethod
    def _replace_aigc_pipeline_assets(
        session: Session,
        pipeline_id: str,
        references: Iterable[AigcPipelineAssetReference],
    ) -> None:
        session.execute(
            delete(AigcPipelineAssetORM).where(
                AigcPipelineAssetORM.pipeline_id == pipeline_id
            )
        )
        session.add_all(
            [
                AigcPipelineAssetORM(
                    pipeline_id=reference.pipeline_id,
                    node_id=reference.node_id,
                    slot=reference.slot,
                    asset_id=reference.asset_id,
                )
                for reference in references
            ]
        )

    @staticmethod
    def _prepare_aigc_asset_delete(session: Session, asset_id: str) -> None:
        pipeline_reference = session.scalar(
            select(AigcPipelineAssetORM)
            .where(AigcPipelineAssetORM.asset_id == asset_id)
            .limit(1)
        )
        if pipeline_reference is not None:
            raise AssetReferenceConflictError(
                f"asset is referenced by AIGC pipeline: "
                f"{pipeline_reference.pipeline_id}"
            )
        active_reference = session.scalar(
            select(AigcPipelineTaskAssetORM)
            .join(
                AigcPipelineTaskORM,
                AigcPipelineTaskORM.id == AigcPipelineTaskAssetORM.task_id,
            )
            .join(
                AigcPipelineRunORM,
                AigcPipelineRunORM.id == AigcPipelineTaskORM.run_id,
            )
            .where(
                AigcPipelineTaskAssetORM.asset_id == asset_id,
                AigcPipelineRunORM.status.in_(
                    [
                        AigcPipelineRunStatus.QUEUED,
                        AigcPipelineRunStatus.RUNNING,
                    ]
                ),
            )
            .limit(1)
        )
        if active_reference is not None:
            raise AssetReferenceConflictError(
                "asset is referenced by an active AIGC run"
            )
        session.execute(
            delete(AigcPipelineTaskAssetORM).where(
                AigcPipelineTaskAssetORM.asset_id == asset_id
            )
        )

    @classmethod
    def _project_summary_from_orm(cls, project: ProjectORM) -> ProjectListItem:
        return ProjectListItem(
            id=project.id,
            name=project.name,
            project_type=project.project_type,
            brief=cls._brief_from_orm(project.brief),
            status=project.status,
            current_stage=project.current_stage,
            current_image_prompt_version_id=project.current_image_prompt_version_id,
            image_prompt_status=project.image_prompt_status,
            current_image_asset_id=project.current_image_asset_id,
            image_revision=project.image_revision,
            image_reference_asset_ids=project.image_reference_asset_ids,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    @classmethod
    def _project_from_orm(cls, project: ProjectORM) -> Project:
        return Project(
            id=project.id,
            name=project.name,
            project_type=project.project_type,
            brief=cls._brief_from_orm(project.brief),
            status=project.status,
            current_stage=project.current_stage,
            current_image_prompt_version_id=project.current_image_prompt_version_id,
            image_prompt_status=project.image_prompt_status,
            current_image_asset_id=project.current_image_asset_id,
            image_revision=project.image_revision,
            image_reference_asset_ids=project.image_reference_asset_ids,
            text_artifacts=[
                cls._text_artifact_from_orm(artifact)
                for artifact in sorted(
                    project.text_artifacts,
                    key=lambda item: (item.created_at, item.id),
                )
            ],
            character_cards=[
                cls._character_card_from_orm(card)
                for card in sorted(
                    project.character_cards,
                    key=lambda item: (item.sort_order, item.created_at, item.id),
                )
            ],
            storyboard=[
                cls._storyboard_shot_from_orm(shot)
                for shot in sorted(
                    project.storyboard_shots,
                    key=lambda item: item.index,
                )
            ],
            tasks=[
                cls._task_from_orm(task)
                for task in sorted(
                    project.tasks,
                    key=lambda item: (item.created_at, item.id),
                )
            ],
            assets=[
                cls._asset_from_orm(asset)
                for asset in sorted(
                    project.assets,
                    key=lambda item: (item.created_at, item.id),
                )
                if asset.asset_role == AssetRole.PUBLIC
            ],
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    @staticmethod
    def _brief_from_orm(brief: BriefORM) -> Brief:
        return Brief(
            prompt=brief.prompt,
            target_language=brief.target_language,
            target_platform=brief.target_platform,
            aspect_ratio=brief.aspect_ratio,
            duration_seconds=brief.duration_seconds,
            image_purpose=brief.image_purpose,
            style=brief.style,
            audience=brief.audience,
            product_name=brief.product_name,
            summary=brief.summary,
            selling_points=brief.selling_points,
        )

    @staticmethod
    def _image_prompt_version_from_orm(
        version: ImagePromptVersionORM,
    ) -> ImagePromptVersion:
        return ImagePromptVersion(
            id=version.id,
            project_id=version.project_id,
            version=version.version,
            prompt=version.prompt,
            aspect_ratio=version.aspect_ratio,
            target_language=version.target_language,
            image_purpose=version.image_purpose,
            created_at=version.created_at,
        )

    @staticmethod
    def _task_from_orm(task: GenerationTaskORM) -> GenerationTask:
        error = (
            TaskError(
                code=task.error_code,
                message=task.error_message or "task failed",
                detail=task.error_detail,
            )
            if task.error_code is not None
            else None
        )
        return GenerationTask(
            id=task.id,
            project_id=task.project_id,
            stage=task.stage,
            status=task.status,
            progress=task.progress,
            progress_message=task.progress_message,
            error=error,
            input_hash=task.input_hash,
            frozen_input=task.frozen_input,
            retry_of_task_id=task.retry_of_task_id,
            output_asset_ids=task.output_asset_ids,
            output_text_artifact_id=task.output_text_artifact_id,
            created_at=task.created_at,
            updated_at=task.updated_at,
            started_at=task.started_at,
            finished_at=task.finished_at,
        )

    @staticmethod
    def _set_tool_task_error(
        task: ToolTaskORM,
        error: ToolTaskError | None,
    ) -> None:
        task.error_code = error.code if error else None
        task.error_message = error.message if error else None
        task.error_provider_request_id = error.provider_request_id if error else None
        task.error_provider_task_id = error.provider_task_id if error else None
        task.error_stage = error.stage if error else None

    @staticmethod
    def _tool_task_from_orm(task: ToolTaskORM) -> ToolTask:
        error = (
            ToolTaskError(
                code=task.error_code,
                message=task.error_message,
                provider_request_id=task.error_provider_request_id,
                provider_task_id=task.error_provider_task_id,
                stage=task.error_stage,
            )
            if task.error_code and task.error_message
            else None
        )
        return ToolTask(
            id=task.id,
            type=task.type,
            status=task.status,
            input_snapshot=dict(task.input_snapshot or {}),
            provider_task_id=task.provider_task_id,
            error=error,
            retry_of_task_id=task.retry_of_task_id,
            created_at=task.created_at,
            updated_at=task.updated_at,
            started_at=task.started_at,
            finished_at=task.finished_at,
            input_assets=[
                ToolTaskInputAsset(
                    task_id=item.task_id,
                    asset_id=item.asset_id,
                    kind=item.kind,
                    created_at=item.created_at,
                )
                for item in sorted(
                    task.input_assets,
                    key=lambda item: (item.created_at, item.asset_id),
                )
            ],
        )

    @staticmethod
    def _asset_from_orm(asset: AssetORM) -> Asset:
        return Asset(
            id=asset.id,
            project_id=asset.project_id,
            tool_task_id=asset.tool_task_id,
            tool_asset_role=asset.tool_asset_role,
            type=asset.type,
            category=asset.category,
            asset_role=asset.asset_role,
            status=asset.status,
            stage=asset.stage,
            url=asset.url,
            object_key=asset.object_key,
            mime_type=asset.mime_type,
            size_bytes=asset.size_bytes,
            source_task_id=asset.source_task_id,
            metadata=asset.metadata_json,
            created_at=asset.created_at,
            updated_at=asset.updated_at,
        )

    @staticmethod
    def _asset_to_orm(asset: Asset) -> AssetORM:
        return AssetORM(
            id=asset.id,
            project_id=asset.project_id,
            tool_task_id=asset.tool_task_id,
            tool_asset_role=asset.tool_asset_role,
            type=asset.type,
            category=asset.category,
            asset_role=asset.asset_role,
            status=asset.status,
            stage=asset.stage,
            url=asset.url,
            object_key=asset.object_key,
            mime_type=asset.mime_type,
            size_bytes=asset.size_bytes,
            source_task_id=asset.source_task_id,
            metadata_json=asset.metadata,
            created_at=asset.created_at,
            updated_at=asset.updated_at,
        )

    @classmethod
    def _image_layer_set_from_orm(
        cls,
        layer_set: ImageLayerSetORM,
    ) -> ImageLayerSet:
        return ImageLayerSet(
            id=layer_set.id,
            project_id=layer_set.project_id,
            source_asset_id=layer_set.source_asset_id,
            base_asset_id=layer_set.base_asset_id,
            canvas_width=layer_set.canvas_width,
            canvas_height=layer_set.canvas_height,
            status=layer_set.status,
            revision=layer_set.revision,
            layers=[
                ImageLayer(
                    id=layer.id,
                    set_id=layer.set_id,
                    asset_id=layer.asset_id,
                    z_index=layer.z_index,
                    name=layer.name,
                    description=layer.description,
                    bbox_absolute=tuple(layer.bbox_absolute),
                    bbox_normalized=tuple(layer.bbox_normalized),
                    visible=layer.visible,
                    x=layer.x,
                    y=layer.y,
                    scale=layer.scale,
                )
                for layer in sorted(
                    layer_set.layers,
                    key=lambda item: item.z_index,
                )
            ],
            created_at=layer_set.created_at,
            updated_at=layer_set.updated_at,
        )

    @staticmethod
    def _canvas_layout_from_orm(layout: CanvasLayoutORM) -> CanvasLayout:
        return CanvasLayout(
            project_id=layout.project_id,
            nodes=[CanvasNode.model_validate(item) for item in layout.nodes],
            revision=layout.revision,
            updated_at=layout.updated_at,
        )

    @staticmethod
    def _character_card_from_orm(card: CharacterCardORM) -> CharacterCard:
        return CharacterCard(
            id=card.id,
            project_id=card.project_id,
            name=card.name,
            description=card.description,
            sort_order=card.sort_order,
            asset_id=card.asset_id,
            status=card.status,
            created_at=card.created_at,
            updated_at=card.updated_at,
        )

    @staticmethod
    def _storyboard_shot_from_orm(shot: StoryboardShotORM) -> StoryboardShot:
        return StoryboardShot(
            id=shot.id,
            project_id=shot.project_id,
            index=shot.index,
            title=shot.title,
            description=shot.description,
            visual_prompt=shot.visual_prompt,
            narration=shot.narration,
            duration_seconds=shot.duration_seconds,
            status=shot.status,
            image_asset_id=shot.image_asset_id,
            first_frame_asset_id=shot.first_frame_asset_id,
            first_frame_source_video_asset_id=(
                shot.first_frame_source_video_asset_id
            ),
            video_asset_id=shot.video_asset_id,
            video_prompt=shot.video_prompt,
            reference_image_asset_ids=shot.reference_image_asset_ids or [],
            reference_video_asset_ids=shot.reference_video_asset_ids or [],
            reference_audio_asset_ids=shot.reference_audio_asset_ids or [],
            merge_source_shots=[
                StoryboardAtomicShotSnapshot.model_validate(item)
                for item in (shot.merge_source_shots or [])
            ],
            created_at=shot.created_at,
            updated_at=shot.updated_at,
        )

    @staticmethod
    def _text_artifact_from_orm(artifact: TextArtifactORM) -> TextArtifact:
        return TextArtifact(
            id=artifact.id,
            project_id=artifact.project_id,
            stage=artifact.stage,
            title=artifact.title,
            content=artifact.content,
            version=artifact.version,
            status=artifact.status,
            created_at=artifact.created_at,
            updated_at=artifact.updated_at,
        )

    @staticmethod
    def _default_project_name(brief: Brief) -> str:
        if brief.product_name:
            return brief.product_name
        prompt = " ".join(brief.prompt.split())
        return prompt[:60] or "Untitled project"


def _reference_field_name(kind: ReferenceAssetKind) -> str:
    return {
        ReferenceAssetKind.IMAGE: "reference_image_asset_ids",
        ReferenceAssetKind.VIDEO: "reference_video_asset_ids",
        ReferenceAssetKind.AUDIO: "reference_audio_asset_ids",
    }[kind]
