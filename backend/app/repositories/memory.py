from __future__ import annotations

from datetime import datetime, timedelta
from threading import RLock
from typing import Iterable, TypeVar

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
    AigcTaskStatus,
    AigcTaskError,
    AigcTaskMetrics,
    AigcTaskResult,
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
    Status,
    StoryboardAtomicShotSnapshot,
    StoryboardShot,
    StoryboardShotCreate,
    StoryboardShotVideoConfigUpdate,
    TargetLanguage,
    TextArtifact,
    TextArtifactCreate,
    ToolTask,
    ToolTaskCreate,
    ToolTaskInputAsset,
)
from backend.app.schemas.brief import Brief
from backend.app.schemas.common import utc_now
from backend.app.schemas.enums import Stage, ToolTaskType
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


ModelT = TypeVar(
    "ModelT",
    AigcPipeline,
    AigcPipelineAssetReference,
    AigcPipelineRun,
    AigcPipelineRunDetail,
    AigcPipelineRunNode,
    AigcPipelineTaskAssetReference,
    AigcPipelineTaskAttempt,
    AigcPipelineTemplate,
    AigcWorkerLease,
    Asset,
    CanvasLayout,
    CharacterCard,
    GenerationTask,
    ImagePromptVersion,
    ImageLayer,
    ImageLayerSet,
    Project,
    StoryboardShot,
    TextArtifact,
    ToolTask,
)


class InMemoryRepository:
    """Process-local repository for the first backend slice.

    The repository keeps project aggregates in sync with the normalized maps so
    API code can later return a single Project payload without manual joins.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._projects: dict[str, Project] = {}
        self._project_deleted_at: dict[str, datetime | None] = {}
        self._tasks: dict[str, GenerationTask] = {}
        self._tool_tasks: dict[str, ToolTask] = {}
        self._tool_task_input_assets: dict[str, list[ToolTaskInputAsset]] = {}
        self._assets: dict[str, Asset] = {}
        self._character_cards: dict[str, CharacterCard] = {}
        self._storyboard_shots: dict[str, StoryboardShot] = {}
        self._text_artifacts: dict[str, TextArtifact] = {}
        self._image_prompt_versions: dict[str, ImagePromptVersion] = {}
        self._image_layer_sets: dict[str, ImageLayerSet] = {}
        self._canvas_layouts: dict[str, CanvasLayout] = {}
        self._aigc_templates: dict[str, AigcPipelineTemplate] = {}
        self._aigc_pipelines: dict[str, AigcPipeline] = {}
        self._aigc_pipeline_deleted_at: dict[str, datetime | None] = {}
        self._aigc_pipeline_assets: dict[
            tuple[str, str, str], AigcPipelineAssetReference
        ] = {}
        self._aigc_runs: dict[str, AigcPipelineRun] = {}
        self._aigc_run_nodes: dict[
            tuple[str, str], AigcPipelineRunNode
        ] = {}
        self._aigc_run_idempotency: dict[tuple[str, str], str] = {}
        self._aigc_tasks: dict[str, AigcPipelineTaskAttempt] = {}
        self._aigc_task_idempotency: dict[tuple[str, str, str], str] = {}
        self._aigc_task_retry_of: dict[str, str | None] = {}
        self._aigc_task_fencing: dict[str, int | None] = {}
        self._aigc_task_assets: dict[
            tuple[str, str, str, int], AigcPipelineTaskAssetReference
        ] = {}
        self._aigc_worker_lease: AigcWorkerLease | None = None

    def create_aigc_template(
        self,
        data: AigcPipelineTemplateCreate,
    ) -> AigcPipelineTemplate:
        template = AigcPipelineTemplate(**data.model_dump())
        with self._lock:
            self._aigc_templates[template.id] = template
            return self._copy(template)

    def get_aigc_template(self, template_id: str) -> AigcPipelineTemplate:
        with self._lock:
            template = self._aigc_templates.get(template_id)
            if template is None:
                raise NotFoundError(f"AIGC template not found: {template_id}")
            return self._copy(template)

    def list_aigc_templates(
        self,
        q: str | None = None,
    ) -> list[AigcPipelineTemplate]:
        keyword = (q or "").strip().casefold()
        with self._lock:
            items = [
                template
                for template in self._aigc_templates.values()
                if not keyword or keyword in template.name.casefold()
            ]
            items.sort(key=lambda item: item.id)
            items.sort(key=lambda item: item.updated_at, reverse=True)
            return [self._copy(item) for item in items]

    def update_aigc_template(
        self,
        template_id: str,
        data: AigcPipelineTemplateUpdate,
    ) -> AigcPipelineTemplate:
        with self._lock:
            current = self._aigc_templates.get(template_id)
            if current is None:
                raise NotFoundError(f"AIGC template not found: {template_id}")
            if current.revision != data.expected_revision:
                raise RevisionConflictError("AIGC template revision conflict")
            updated = AigcPipelineTemplate.model_validate(
                {
                    **current.model_dump(),
                    **data.model_dump(exclude={"expected_revision"}),
                    "revision": current.revision + 1,
                    "updated_at": utc_now(),
                }
            )
            self._aigc_templates[template_id] = updated
            return self._copy(updated)

    def delete_aigc_template(self, template_id: str) -> None:
        with self._lock:
            if template_id not in self._aigc_templates:
                raise NotFoundError(f"AIGC template not found: {template_id}")
            del self._aigc_templates[template_id]

    def create_aigc_pipeline(self, data: AigcPipelineCreate) -> AigcPipeline:
        pipeline = AigcPipeline(**data.model_dump())
        with self._lock:
            if pipeline.source_template_id is not None:
                template = self._aigc_templates.get(pipeline.source_template_id)
                if template is None:
                    raise NotFoundError(
                        f"AIGC template not found: {pipeline.source_template_id}"
                    )
                if pipeline.source_template_revision != template.revision:
                    raise RevisionConflictError(
                        "AIGC source template revision conflict"
                    )
            references = self._aigc_asset_references_for_pipeline(pipeline)
            self._aigc_pipelines[pipeline.id] = pipeline
            self._aigc_pipeline_deleted_at[pipeline.id] = None
            self._replace_aigc_pipeline_assets(pipeline.id, references)
            return self._copy(pipeline)

    def get_aigc_pipeline(self, pipeline_id: str) -> AigcPipeline:
        with self._lock:
            pipeline = self._aigc_pipelines.get(pipeline_id)
            if (
                pipeline is None
                or self._aigc_pipeline_deleted_at.get(pipeline_id) is not None
            ):
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            return self._copy(pipeline)

    def list_aigc_pipelines(self, q: str | None = None) -> list[AigcPipeline]:
        keyword = (q or "").strip().casefold()
        with self._lock:
            items = [
                pipeline
                for pipeline in self._aigc_pipelines.values()
                if self._aigc_pipeline_deleted_at.get(pipeline.id) is None
                and (not keyword or keyword in pipeline.name.casefold())
            ]
            items.sort(key=lambda item: item.id)
            items.sort(key=lambda item: item.updated_at, reverse=True)
            return [self._copy(item) for item in items]

    def update_aigc_pipeline(
        self,
        pipeline_id: str,
        data: AigcPipelineUpdate,
    ) -> AigcPipeline:
        with self._lock:
            current = self._aigc_pipelines.get(pipeline_id)
            if (
                current is None
                or self._aigc_pipeline_deleted_at.get(pipeline_id) is not None
            ):
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            if current.revision != data.expected_revision:
                raise RevisionConflictError("AIGC pipeline revision conflict")
            updated = AigcPipeline.model_validate(
                {
                    **current.model_dump(),
                    **data.model_dump(exclude={"expected_revision"}),
                    "revision": current.revision + 1,
                    "updated_at": utc_now(),
                }
            )
            references = self._aigc_asset_references_for_pipeline(updated)
            self._aigc_pipelines[pipeline_id] = updated
            self._replace_aigc_pipeline_assets(pipeline_id, references)
            return self._copy(updated)

    def delete_aigc_pipeline(self, pipeline_id: str) -> None:
        with self._lock:
            if (
                pipeline_id not in self._aigc_pipelines
                or self._aigc_pipeline_deleted_at.get(pipeline_id) is not None
            ):
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            runs = [
                run
                for run in self._aigc_runs.values()
                if run.pipeline_id == pipeline_id
            ]
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
                self._aigc_pipeline_deleted_at[pipeline_id] = utc_now()
                return
            del self._aigc_pipelines[pipeline_id]
            self._aigc_pipeline_deleted_at.pop(pipeline_id, None)
            for key in [
                key
                for key in self._aigc_pipeline_assets
                if key[0] == pipeline_id
            ]:
                del self._aigc_pipeline_assets[key]

    def list_aigc_pipeline_assets(
        self,
        pipeline_id: str,
    ) -> list[AigcPipelineAssetReference]:
        with self._lock:
            if (
                pipeline_id not in self._aigc_pipelines
                or self._aigc_pipeline_deleted_at.get(pipeline_id) is not None
            ):
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            return [
                self._copy(reference)
                for key, reference in sorted(self._aigc_pipeline_assets.items())
                if key[0] == pipeline_id
            ]

    def create_aigc_run(
        self,
        run: AigcPipelineRun,
        *,
        idempotency_key: str,
        nodes: Iterable[AigcPipelineRunNode],
    ) -> AigcPipelineRunDetail:
        with self._lock:
            pipeline = self._aigc_pipelines.get(run.pipeline_id)
            if (
                pipeline is None
                or self._aigc_pipeline_deleted_at.get(run.pipeline_id) is not None
            ):
                raise NotFoundError(f"AIGC pipeline not found: {run.pipeline_id}")
            existing_id = self._aigc_run_idempotency.get(
                (run.pipeline_id, idempotency_key)
            )
            if existing_id is not None:
                return self.get_aigc_run(existing_id)
            if (
                run.pipeline_revision != pipeline.revision
                and run.mode != AigcPipelineRunMode.RETRY_NODE
            ):
                raise RevisionConflictError("AIGC pipeline revision conflict")
            if any(
                item.pipeline_id == run.pipeline_id
                and item.status
                in {
                    AigcPipelineRunStatus.QUEUED,
                    AigcPipelineRunStatus.RUNNING,
                }
                for item in self._aigc_runs.values()
            ):
                raise ActiveRunConflictError("AIGC pipeline already has an active run")
            run_number = (
                max(
                    (
                        item.run_number
                        for item in self._aigc_runs.values()
                        if item.pipeline_id == run.pipeline_id
                    ),
                    default=0,
                )
                + 1
            )
            created = AigcPipelineRun.model_validate(
                {
                    **run.model_dump(),
                    "run_number": run_number,
                    "updated_at": utc_now(),
                }
            )
            created_nodes = [self._copy(node) for node in nodes]
            if len({node.node_id for node in created_nodes}) != len(created_nodes):
                raise ValueError("AIGC run node ids must be unique")
            snapshot_ids = {node.id for node in created.definition_snapshot.nodes}
            if {node.node_id for node in created_nodes} != snapshot_ids:
                raise ValueError("AIGC run nodes must match the definition snapshot")
            self._aigc_runs[created.id] = created
            self._aigc_run_idempotency[
                (created.pipeline_id, idempotency_key)
            ] = created.id
            for node in created_nodes:
                self._aigc_run_nodes[(created.id, node.node_id)] = node
            self._aigc_pipelines[pipeline.id] = pipeline.model_copy(
                update={
                    "latest_run_status": created.status,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return self.get_aigc_run(created.id)

    def get_aigc_run(self, run_id: str) -> AigcPipelineRunDetail:
        with self._lock:
            run = self._aigc_runs.get(run_id)
            if run is None:
                raise NotFoundError(f"AIGC run not found: {run_id}")
            nodes_by_id = {
                node_id: node
                for (candidate_run_id, node_id), node in self._aigc_run_nodes.items()
                if candidate_run_id == run_id
            }
            nodes = [
                nodes_by_id[definition_node.id].model_copy(
                    update={
                        "attempts": [
                            self._copy(task)
                            for task in sorted(
                                self._aigc_tasks.values(),
                                key=lambda item: item.attempt,
                            )
                            if task.run_id == run_id
                            and task.node_id == definition_node.id
                        ]
                    },
                    deep=True,
                )
                for definition_node in run.definition_snapshot.nodes
            ]
            return AigcPipelineRunDetail(
                run=self._copy(run),
                nodes=nodes,
            )

    def list_aigc_runs(self, pipeline_id: str) -> list[AigcPipelineRun]:
        with self._lock:
            if (
                pipeline_id not in self._aigc_pipelines
                or self._aigc_pipeline_deleted_at.get(pipeline_id) is not None
            ):
                raise NotFoundError(f"AIGC pipeline not found: {pipeline_id}")
            return [
                self._copy(run)
                for run in sorted(
                    self._aigc_runs.values(),
                    key=lambda item: item.run_number,
                    reverse=True,
                )
                if run.pipeline_id == pipeline_id
            ]

    def get_aigc_run_asset(
        self,
        pipeline_id: str,
        run_id: str,
        asset_id: str,
    ) -> Asset:
        with self._lock:
            run = self._aigc_runs.get(run_id)
            if run is None or run.pipeline_id != pipeline_id:
                raise NotFoundError(f"AIGC run not found: {run_id}")
            referenced = any(
                reference.asset_id == asset_id
                and self._aigc_tasks.get(reference.task_id) is not None
                and self._aigc_tasks[reference.task_id].run_id == run_id
                for reference in self._aigc_task_assets.values()
            )
            if not referenced or asset_id not in self._assets:
                raise NotFoundError(f"AIGC run asset not found: {asset_id}")
            return self._copy(self._assets[asset_id])

    def update_aigc_run(
        self,
        run_id: str,
        **changes: object,
    ) -> AigcPipelineRun:
        with self._lock:
            current = self._aigc_runs.get(run_id)
            if current is None:
                raise NotFoundError(f"AIGC run not found: {run_id}")
            updated = AigcPipelineRun.model_validate(
                {
                    **current.model_dump(),
                    **changes,
                    "updated_at": utc_now(),
                }
            )
            self._aigc_runs[run_id] = updated
            pipeline = self._aigc_pipelines[updated.pipeline_id]
            self._aigc_pipelines[pipeline.id] = pipeline.model_copy(
                update={
                    "latest_run_status": updated.status,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return self._copy(updated)

    def update_aigc_run_node(
        self,
        run_id: str,
        node_id: str,
        **changes: object,
    ) -> AigcPipelineRunNode:
        with self._lock:
            key = (run_id, node_id)
            current = self._aigc_run_nodes.get(key)
            if current is None:
                raise NotFoundError(f"AIGC run node not found: {run_id}:{node_id}")
            updated = AigcPipelineRunNode.model_validate(
                {**current.model_dump(), **changes}
            )
            self._aigc_run_nodes[key] = updated
            return self._copy(updated)

    def create_aigc_task_attempt(
        self,
        task: AigcPipelineTaskAttempt,
        *,
        idempotency_key: str,
        retry_of_task_id: str | None = None,
    ) -> AigcPipelineTaskAttempt:
        with self._lock:
            run = self._aigc_runs.get(task.run_id)
            if run is None:
                raise NotFoundError(f"AIGC run not found: {task.run_id}")
            if run.pipeline_id != task.pipeline_id:
                raise ValueError("AIGC task belongs to another pipeline")
            run_node_key = (task.run_id, task.node_id)
            run_node = self._aigc_run_nodes.get(run_node_key)
            if run_node is None:
                raise NotFoundError(
                    f"AIGC run node not found: {task.run_id}:{task.node_id}"
                )
            key = (task.run_id, task.node_id, idempotency_key)
            existing_id = self._aigc_task_idempotency.get(key)
            if existing_id is not None:
                return self._copy(self._aigc_tasks[existing_id])
            if any(
                item.run_id == task.run_id
                and item.node_id == task.node_id
                and item.status in {AigcTaskStatus.QUEUED, AigcTaskStatus.RUNNING}
                for item in self._aigc_tasks.values()
            ):
                raise ActiveRunConflictError("AIGC run node already has an active attempt")
            attempt = (
                max(
                    (
                        item.attempt
                        for item in self._aigc_tasks.values()
                        if item.run_id == task.run_id
                        and item.node_id == task.node_id
                    ),
                    default=0,
                )
                + 1
            )
            created = AigcPipelineTaskAttempt.model_validate(
                {
                    **task.model_dump(),
                    "attempt": attempt,
                }
            )
            if created.task_id in self._aigc_tasks:
                raise ValueError(f"AIGC task already exists: {created.task_id}")
            if retry_of_task_id is not None and retry_of_task_id not in self._aigc_tasks:
                raise NotFoundError(f"AIGC retry task not found: {retry_of_task_id}")
            self._aigc_tasks[created.task_id] = created
            self._aigc_task_idempotency[key] = created.task_id
            self._aigc_task_retry_of[created.task_id] = retry_of_task_id
            self._aigc_task_fencing[created.task_id] = None
            self._aigc_run_nodes[run_node_key] = run_node.model_copy(
                update={
                    "current_task_id": created.task_id,
                    "status": AigcRunNodeStatus(created.status.value),
                },
                deep=True,
            )
            return self._copy(created)

    def get_aigc_task_attempt(
        self,
        task_id: str,
    ) -> AigcPipelineTaskAttempt:
        with self._lock:
            task = self._aigc_tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            return self._copy(task)

    def update_aigc_task_attempt(
        self,
        task_id: str,
        **changes: object,
    ) -> AigcPipelineTaskAttempt:
        with self._lock:
            current = self._aigc_tasks.get(task_id)
            if current is None:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            updated = AigcPipelineTaskAttempt.model_validate(
                {**current.model_dump(), **changes}
            )
            self._aigc_tasks[task_id] = updated
            run_node_key = (updated.run_id, updated.node_id)
            run_node = self._aigc_run_nodes[run_node_key]
            if run_node.current_task_id == task_id:
                self._aigc_run_nodes[run_node_key] = run_node.model_copy(
                    update={
                        "status": AigcRunNodeStatus(updated.status.value),
                        "result": updated.result,
                    },
                    deep=True,
                )
            return self._copy(updated)

    def list_aigc_task_attempts(
        self,
        *,
        statuses: set[AigcTaskStatus] | None = None,
    ) -> list[AigcPipelineTaskAttempt]:
        with self._lock:
            return [
                self._copy(task)
                for task in sorted(
                    self._aigc_tasks.values(),
                    key=lambda item: (item.created_at, item.task_id),
                )
                if statuses is None or task.status in statuses
            ]

    def claim_aigc_task_attempt(
        self,
        task_id: str,
        *,
        fencing_token: int,
    ) -> AigcPipelineTaskAttempt | None:
        with self._lock:
            lease = self._aigc_worker_lease
            task = self._aigc_tasks.get(task_id)
            if (
                lease is None
                or lease.fencing_token != fencing_token
                or lease.lease_expires_at <= utc_now()
                or task is None
                or task.status != AigcTaskStatus.QUEUED
            ):
                return None
            claimed = AigcPipelineTaskAttempt.model_validate(
                {
                    **task.model_dump(),
                    "status": AigcTaskStatus.RUNNING,
                    "started_at": utc_now(),
                }
            )
            self._aigc_tasks[task_id] = claimed
            self._aigc_task_fencing[task_id] = fencing_token
            run_node_key = (claimed.run_id, claimed.node_id)
            run_node = self._aigc_run_nodes[run_node_key]
            self._aigc_run_nodes[run_node_key] = run_node.model_copy(
                update={"status": AigcRunNodeStatus.RUNNING},
                deep=True,
            )
            return self._copy(claimed)

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
        with self._lock:
            task = self._aigc_tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            lease = self._aigc_worker_lease
            if (
                lease is None
                or lease.fencing_token != fencing_token
                or self._aigc_task_fencing.get(task_id) != fencing_token
                or task.status != AigcTaskStatus.RUNNING
            ):
                return self._copy(task), False
            run = self._aigc_runs[task.run_id]
            accepted = not run.cancellation_requested
            final_status = status if accepted else AigcTaskStatus.CANCELED
            final_result = result if accepted else AigcTaskResult()
            committed = AigcPipelineTaskAttempt.model_validate(
                {
                    **task.model_dump(),
                    "status": final_status,
                    "progress": 100 if final_status == AigcTaskStatus.SUCCEEDED else task.progress,
                    "result": final_result,
                    "error": error if accepted else None,
                    "metrics": metrics,
                    "finished_at": utc_now(),
                }
            )
            self._aigc_tasks[task_id] = committed
            run_node_key = (committed.run_id, committed.node_id)
            run_node = self._aigc_run_nodes[run_node_key]
            self._aigc_run_nodes[run_node_key] = run_node.model_copy(
                update={
                    "status": AigcRunNodeStatus(final_status.value),
                    "result": final_result,
                },
                deep=True,
            )
            return self._copy(committed), accepted

    def add_aigc_task_assets(
        self,
        references: Iterable[AigcPipelineTaskAssetReference],
    ) -> list[AigcPipelineTaskAssetReference]:
        items = [self._copy(reference) for reference in references]
        with self._lock:
            for reference in items:
                if reference.task_id not in self._aigc_tasks:
                    raise NotFoundError(
                        f"AIGC task not found: {reference.task_id}"
                    )
                if reference.asset_id not in self._assets:
                    raise NotFoundError(f"asset not found: {reference.asset_id}")
                key = (
                    reference.task_id,
                    reference.direction.value,
                    reference.slot,
                    reference.ordinal,
                )
                if key in self._aigc_task_assets:
                    raise ValueError("AIGC task asset reference already exists")
            for reference in items:
                key = (
                    reference.task_id,
                    reference.direction.value,
                    reference.slot,
                    reference.ordinal,
                )
                self._aigc_task_assets[key] = reference
            return [self._copy(reference) for reference in items]

    def list_aigc_task_assets(
        self,
        task_id: str,
    ) -> list[AigcPipelineTaskAssetReference]:
        with self._lock:
            if task_id not in self._aigc_tasks:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            return [
                self._copy(reference)
                for key, reference in sorted(self._aigc_task_assets.items())
                if key[0] == task_id
            ]

    def remove_aigc_task_assets(
        self,
        task_id: str,
        *,
        direction: AigcAssetDirection | None = None,
    ) -> list[AigcPipelineTaskAssetReference]:
        with self._lock:
            if task_id not in self._aigc_tasks:
                raise NotFoundError(f"AIGC task not found: {task_id}")
            keys = [
                key
                for key, reference in self._aigc_task_assets.items()
                if reference.task_id == task_id
                and (direction is None or reference.direction == direction)
            ]
            removed = [self._copy(self._aigc_task_assets[key]) for key in keys]
            for key in keys:
                del self._aigc_task_assets[key]
            return removed

    def acquire_aigc_worker_lease(
        self,
        owner_id: str,
        *,
        now: datetime,
        lease_seconds: int,
    ) -> AigcWorkerLease | None:
        with self._lock:
            current = self._aigc_worker_lease
            if (
                current is not None
                and current.owner_id != owner_id
                and current.lease_expires_at > now
            ):
                return None
            token = (
                current.fencing_token
                if current is not None and current.owner_id == owner_id
                else (current.fencing_token + 1 if current is not None else 1)
            )
            lease = AigcWorkerLease(
                owner_id=owner_id,
                fencing_token=token,
                heartbeat_at=now,
                lease_expires_at=now + timedelta(seconds=lease_seconds),
            )
            self._aigc_worker_lease = lease
            return self._copy(lease)

    def renew_aigc_worker_lease(
        self,
        owner_id: str,
        fencing_token: int,
        *,
        now: datetime,
        lease_seconds: int,
    ) -> AigcWorkerLease | None:
        with self._lock:
            current = self._aigc_worker_lease
            if (
                current is None
                or current.owner_id != owner_id
                or current.fencing_token != fencing_token
                or current.lease_expires_at <= now
            ):
                return None
            lease = current.model_copy(
                update={
                    "heartbeat_at": now,
                    "lease_expires_at": now + timedelta(seconds=lease_seconds),
                },
                deep=True,
            )
            self._aigc_worker_lease = lease
            return self._copy(lease)

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

        with self._lock:
            self._projects[project.id] = project
            self._project_deleted_at[project.id] = None

        return self._copy(project)

    def get_project(self, project_id: str) -> Project:
        with self._lock:
            project = self._require_project(project_id)
            return self._copy(
                project.model_copy(
                    update={
                        "assets": [
                            asset
                            for asset in project.assets
                            if asset.asset_role == AssetRole.PUBLIC
                        ]
                    },
                    deep=True,
                )
            )

    def list_projects(self) -> list[Project]:
        with self._lock:
            return [
                self._copy(project)
                for project in self._projects.values()
                if self._project_deleted_at.get(project.id) is None
            ]

    def list_project_summaries(self, q: str | None = None) -> list[ProjectListItem]:
        keyword = (q or "").strip().casefold()
        with self._lock:
            return [
                ProjectListItem(
                    id=project.id,
                    name=project.name,
                    project_type=project.project_type,
                    brief=project.brief,
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
                )
                for project in self._projects.values()
                if self._project_deleted_at.get(project.id) is None
                and (
                    not keyword
                    or keyword in project.name.casefold()
                    or keyword in (project.brief.product_name or "").casefold()
                    or keyword in project.brief.prompt.casefold()
                )
            ]

    def delete_project(self, project_id: str) -> None:
        with self._lock:
            self._require_project(project_id)
            self._project_deleted_at[project_id] = utc_now()

    def update_project(self, project_id: str, **changes: object) -> Project:
        if "project_type" in changes:
            raise ValueError("project_type cannot be updated")
        with self._lock:
            project = self._require_project(project_id)
            updated = project.model_copy(
                update={
                    **changes,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._projects[project_id] = updated
            return self._copy(updated)

    def save_image_prompt_version(
        self,
        data: ImagePromptVersionCreate,
    ) -> ImagePromptVersion:
        with self._lock:
            project = self._require_project(data.project_id)
            versions = [
                version
                for version in self._image_prompt_versions.values()
                if version.project_id == data.project_id
            ]
            version = ImagePromptVersion(
                **data.model_dump(),
                version=max((item.version for item in versions), default=0) + 1,
            )
            self._image_prompt_versions[version.id] = version
            self._projects[data.project_id] = project.model_copy(
                update={
                    "current_image_prompt_version_id": version.id,
                    "image_prompt_status": Status.SUCCEEDED,
                    "current_stage": Stage.IMAGE,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return self._copy(version)

    def get_image_prompt_version(
        self,
        project_id: str,
        version_id: str,
    ) -> ImagePromptVersion:
        with self._lock:
            self._require_project(project_id)
            version = self._image_prompt_versions.get(version_id)
            if version is None or version.project_id != project_id:
                raise NotFoundError(f"image prompt version not found: {version_id}")
            return self._copy(version)

    def list_image_prompt_versions(
        self,
        project_id: str,
    ) -> list[ImagePromptVersion]:
        with self._lock:
            self._require_project(project_id)
            return [
                self._copy(version)
                for version in sorted(
                    self._image_prompt_versions.values(),
                    key=lambda item: item.version,
                    reverse=True,
                )
                if version.project_id == project_id
            ]

    def mark_image_prompt_stale(self, project_id: str) -> Project:
        with self._lock:
            project = self._require_project(project_id)
            candidates = {
                asset.id: asset
                for asset in self._assets.values()
                if asset.project_id == project_id
                and asset.asset_role == AssetRole.PUBLIC
                and asset.type.value == "generated_image"
            }
            stale_ids = {
                asset.id
                for asset in candidates.values()
                if asset.metadata.get("prompt_version_id")
            }
            pending = list(stale_ids)
            while pending:
                source_id = pending.pop()
                for asset in candidates.values():
                    if (
                        asset.id not in stale_ids
                        and asset.metadata.get("source_asset_id") == source_id
                    ):
                        stale_ids.add(asset.id)
                        pending.append(asset.id)
            for asset_id in stale_ids:
                self.update_asset(asset_id, status=Status.STALE)
            project = self._require_project(project_id)
            updated = project.model_copy(
                update={
                    "image_prompt_status": Status.STALE,
                    "current_stage": Stage.IMAGE,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._projects[project_id] = updated
            return self._copy(updated)

    def set_image_reference_asset_ids(
        self,
        project_id: str,
        asset_ids: list[str],
    ) -> Project:
        with self._lock:
            project = self._require_project(project_id)
            updated = project.model_copy(
                update={
                    "image_reference_asset_ids": list(asset_ids),
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._projects[project_id] = updated
            return self._copy(updated)

    def set_current_image_asset(
        self,
        project_id: str,
        asset_id: str,
        *,
        expected_revision: int,
    ) -> Project:
        with self._lock:
            project = self._require_project(project_id)
            asset = self._require_project_asset(project_id, asset_id)
            assert asset is not None
            if (
                asset.asset_role != AssetRole.PUBLIC
                or asset.type.value not in {"generated_image", "uploaded_image"}
                or asset.status != Status.SUCCEEDED
            ):
                raise ValueError("asset is not an eligible current image")
            if project.image_revision != expected_revision:
                raise RevisionConflictError("image revision conflict")
            updated = project.model_copy(
                update={
                    "current_image_asset_id": asset_id,
                    "image_revision": project.image_revision + 1,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._projects[project_id] = updated
            return self._copy(updated)

    def update_project_details(
        self,
        project_id: str,
        data: ProjectUpdate,
    ) -> Project:
        if "project_type" in data.model_fields_set:
            raise ValueError("project_type cannot be updated")
        with self._lock:
            project = self._require_project(project_id)
            changes: dict[str, object] = {}
            if "name" in data.model_fields_set:
                changes["name"] = data.name
            if data.brief is not None:
                changes["brief"] = project.brief.model_copy(
                    update=data.brief.model_dump(exclude_unset=True),
                    deep=True,
                )

            validated = ProjectBase(
                name=changes.get("name", project.name),
                project_type=project.project_type,
                brief=changes.get("brief", project.brief),
                status=project.status,
                current_stage=project.current_stage,
            )
            updated = project.model_copy(
                update={
                    **changes,
                    "brief": validated.brief,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._projects[project_id] = updated
            return self._copy(updated)

    def create_task(self, data: GenerationTaskCreate) -> GenerationTask:
        with self._lock:
            self._require_project(data.project_id)
            task = GenerationTask(**data.model_dump())
            self._tasks[task.id] = task
            self._projects[data.project_id].tasks.append(task)
            self._touch_project(data.project_id)
            return self._copy(task)

    def create_task_if_no_active_hash(
        self,
        data: GenerationTaskCreate,
    ) -> tuple[GenerationTask, bool]:
        with self._lock:
            self._require_project(data.project_id)
            for task in self._tasks.values():
                if (
                    task.project_id == data.project_id
                    and task.stage == data.stage
                    and task.input_hash == data.input_hash
                    and task.status in {Status.QUEUED, Status.RUNNING}
                ):
                    return self._copy(task), False
            return self.create_task(data), True

    def get_task(self, task_id: str) -> GenerationTask:
        with self._lock:
            if task_id not in self._tasks:
                raise NotFoundError(f"task not found: {task_id}")
            task = self._tasks[task_id]
            self._require_project(task.project_id)
            return self._copy(task)

    def list_project_tasks(self, project_id: str) -> list[GenerationTask]:
        with self._lock:
            self._require_project(project_id)
            return [
                self._copy(task)
                for task in self._tasks.values()
                if task.project_id == project_id
            ]

    def find_active_task(self, project_id: str, stage: Stage) -> GenerationTask | None:
        with self._lock:
            self._require_project(project_id)
            for task in self._tasks.values():
                if (
                    task.project_id == project_id
                    and task.stage == stage
                    and task.status in {Status.QUEUED, Status.RUNNING}
                ):
                    return self._copy(task)
            return None

    def update_task(self, task_id: str, **changes: object) -> GenerationTask:
        with self._lock:
            if task_id not in self._tasks:
                raise NotFoundError(f"task not found: {task_id}")

            task = self._tasks[task_id]
            self._require_project(task.project_id)
            updated = task.model_copy(
                update={
                    **changes,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._tasks[task_id] = updated
            self._replace_project_item(task.project_id, "tasks", updated)
            self._touch_project(task.project_id)
            return self._copy(updated)

    def create_tool_task(self, data: ToolTaskCreate) -> ToolTask:
        return self.create_tool_task_with_input_assets(data, [])

    def create_tool_task_with_input_assets(
        self,
        data: ToolTaskCreate,
        inputs: Iterable[ToolTaskInputAsset],
    ) -> ToolTask:
        with self._lock:
            if data.id in self._tool_tasks:
                raise ValueError(f"tool task already exists: {data.id}")
            task_inputs = [ToolTaskInputAsset(**item.model_dump()) for item in inputs]
            if any(item.task_id != data.id for item in task_inputs):
                raise ValueError("tool task input belongs to another task")
            if len({item.asset_id for item in task_inputs}) != len(task_inputs):
                raise ValueError("tool task input assets must be unique")
            for item in task_inputs:
                if item.asset_id not in self._assets:
                    raise NotFoundError(f"asset not found: {item.asset_id}")
            task = ToolTask(**data.model_dump(), input_assets=task_inputs)
            self._tool_tasks[task.id] = task
            self._tool_task_input_assets[task.id] = task_inputs
            return self._copy(task)

    def get_tool_task(self, task_id: str) -> ToolTask:
        with self._lock:
            task = self._tool_tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"tool task not found: {task_id}")
            return self._copy(
                task.model_copy(
                    update={"input_assets": self._tool_task_input_assets.get(task_id, [])},
                    deep=True,
                )
            )

    def list_tool_task_input_assets(
        self,
        task_id: str,
    ) -> list[ToolTaskInputAsset]:
        with self._lock:
            if task_id not in self._tool_tasks:
                raise NotFoundError(f"tool task not found: {task_id}")
            return self._copy(self._tool_task_input_assets.get(task_id, []))

    def list_tool_tasks(
        self,
        *,
        task_type: ToolTaskType | None = None,
    ) -> list[ToolTask]:
        with self._lock:
            return [
                self._copy(
                    task.model_copy(
                        update={
                            "input_assets": self._tool_task_input_assets.get(task.id, [])
                        },
                        deep=True,
                    )
                )
                for task in sorted(
                    self._tool_tasks.values(),
                    key=lambda item: (item.created_at, item.id),
                    reverse=True,
                )
                if task_type is None or task.type == task_type
            ]

    def update_tool_task(self, task_id: str, **changes: object) -> ToolTask:
        with self._lock:
            task = self._tool_tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"tool task not found: {task_id}")
            updated = task.model_copy(
                update={**changes, "updated_at": utc_now()},
                deep=True,
            )
            self._tool_tasks[task_id] = updated
            return self._copy(updated)

    def delete_tool_task(self, task_id: str) -> ToolTask:
        with self._lock:
            task = self._tool_tasks.pop(task_id, None)
            if task is None:
                raise NotFoundError(f"tool task not found: {task_id}")
            self._tool_task_input_assets.pop(task_id, None)
            for asset_id, asset in self._assets.items():
                if asset.tool_task_id == task_id:
                    self._assets[asset_id] = asset.model_copy(
                        update={"tool_task_id": None},
                        deep=True,
                    )
            for retry_id, retry in self._tool_tasks.items():
                if retry.retry_of_task_id == task_id:
                    self._tool_tasks[retry_id] = retry.model_copy(
                        update={"retry_of_task_id": None},
                        deep=True,
                    )
            return self._copy(task)

    def create_asset(self, data: AssetCreate) -> Asset:
        return self.create_assets([data])[0]

    def create_assets(self, items: Iterable[AssetCreate]) -> list[Asset]:
        with self._lock:
            assets = [Asset(**item.model_dump()) for item in items]
            for asset in assets:
                if asset.project_id is not None:
                    self._require_project(asset.project_id)
                elif (
                    asset.tool_task_id is not None
                    and asset.tool_task_id not in self._tool_tasks
                ):
                    raise NotFoundError(f"tool task not found: {asset.tool_task_id}")
                if asset.id in self._assets:
                    raise ValueError(f"asset already exists: {asset.id}")
            for asset in assets:
                self._assets[asset.id] = asset
                if asset.project_id is not None:
                    self._projects[asset.project_id].assets.append(asset)
            for project_id in {asset.project_id for asset in assets if asset.project_id}:
                self._touch_project(project_id)
            return [self._copy(asset) for asset in assets]

    def create_asset_and_set_current_image(
        self,
        data: AssetCreate,
        *,
        expected_revision: int,
    ) -> Asset:
        asset = Asset(**data.model_dump())
        if (
            asset.asset_role != AssetRole.PUBLIC
            or asset.type.value != "generated_image"
            or asset.status != Status.SUCCEEDED
        ):
            raise ValueError("asset is not an eligible current image")
        with self._lock:
            project = self._require_project(asset.project_id)
            if project.image_revision != expected_revision:
                raise RevisionConflictError("image revision conflict")
            if asset.id in self._assets:
                raise ValueError(f"asset already exists: {asset.id}")
            self._assets[asset.id] = asset
            project.assets.append(asset)
            self._projects[project.id] = project.model_copy(
                update={
                    "current_image_asset_id": asset.id,
                    "image_revision": expected_revision + 1,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return self._copy(asset)

    def get_asset(self, asset_id: str) -> Asset:
        with self._lock:
            if asset_id not in self._assets:
                raise NotFoundError(f"asset not found: {asset_id}")
            asset = self._assets[asset_id]
            if asset.project_id is not None:
                self._require_project(asset.project_id)
            return self._copy(asset)

    def create_image_layer_set(
        self,
        data: ImageLayerSetCreate,
        *,
        layers: Iterable[ImageLayerCreate],
        assets: Iterable[AssetCreate],
    ) -> ImageLayerSet:
        with self._lock:
            self._require_project(data.project_id)
            source = self._require_project_asset(
                data.project_id,
                data.source_asset_id,
            )
            if (
                source.asset_role != AssetRole.PUBLIC
                or source.type.value not in {"generated_image", "uploaded_image"}
                or source.status != Status.SUCCEEDED
            ):
                raise ValueError("source asset is not a succeeded public image")

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
            if any(asset.project_id != data.project_id for asset in created_assets):
                raise ValueError("image layer asset belongs to another project")
            if any(asset.id in self._assets for asset in created_assets):
                raise ValueError("image layer asset already exists")
            if data.id in self._image_layer_sets:
                raise ValueError("image layer set already exists")

            layer_set = ImageLayerSet(
                **data.model_dump(),
                layers=created_layers,
            )
            for asset in created_assets:
                self._assets[asset.id] = asset
                self._projects[data.project_id].assets.append(asset)
            self._image_layer_sets[layer_set.id] = layer_set
            self._touch_project(data.project_id)
            return self._copy(layer_set)

    def get_image_layer_set(
        self,
        project_id: str,
        set_id: str,
    ) -> ImageLayerSet:
        with self._lock:
            self._require_project(project_id)
            layer_set = self._image_layer_sets.get(set_id)
            if layer_set is None or layer_set.project_id != project_id:
                raise NotFoundError(f"image layer set not found: {set_id}")
            return self._copy(layer_set)

    def list_image_layer_sets(self, project_id: str) -> list[ImageLayerSet]:
        with self._lock:
            self._require_project(project_id)
            return [
                self._copy(layer_set)
                for layer_set in sorted(
                    self._image_layer_sets.values(),
                    key=lambda item: (item.created_at, item.id),
                )
                if layer_set.project_id == project_id
            ]

    def update_image_layer_set(
        self,
        project_id: str,
        set_id: str,
        *,
        expected_revision: int,
        layers: Iterable[ImageLayerUpdate],
    ) -> ImageLayerSet:
        with self._lock:
            current = self.get_image_layer_set(project_id, set_id)
            if current.revision != expected_revision:
                raise RevisionConflictError("image layer set revision conflict")
            updates = list(layers)
            if (
                len(updates) != len(current.layers)
                or {item.id for item in updates}
                != {item.id for item in current.layers}
            ):
                raise ValueError("all image layers must be updated exactly once")
            update_by_id = {item.id: item for item in updates}
            next_layers = [
                layer.model_copy(
                    update=update_by_id[layer.id].model_dump(exclude={"id"}),
                    deep=True,
                )
                for layer in current.layers
            ]
            now = utc_now()
            updated = ImageLayerSet(
                **current.model_dump(exclude={"layers", "revision", "updated_at"}),
                layers=sorted(next_layers, key=lambda item: item.z_index),
                revision=current.revision + 1,
                updated_at=now,
            )
            self._image_layer_sets[set_id] = updated
            self._touch_project(project_id)
            return self._copy(updated)

    def replace_image_layer_asset(
        self, project_id: str, set_id: str, *, expected_revision: int,
        layer_id: str, asset: AssetCreate,
    ) -> ImageLayerSet:
        with self._lock:
            current = self.get_image_layer_set(project_id, set_id)
            if current.revision != expected_revision:
                raise RevisionConflictError("image layer set revision conflict")
            if asset.project_id != project_id or asset.asset_role != AssetRole.INTERNAL_LAYER:
                raise ValueError("replacement must be an internal layer asset")
            if not any(layer.id == layer_id for layer in current.layers):
                raise ValueError("image layer not found")
            created = self._assets.get(asset.id) or Asset(**asset.model_dump())
            if created.id not in self._assets:
                self._assets[created.id] = created
                self._replace_project_item(project_id, "assets", created)
            updated = ImageLayerSet(
                **current.model_dump(exclude={"layers", "revision", "updated_at"}),
                layers=[
                    layer.model_copy(update={"asset_id": created.id}, deep=True)
                    if layer.id == layer_id else layer
                    for layer in current.layers
                ],
                revision=current.revision + 1,
                updated_at=utc_now(),
            )
            self._image_layer_sets[set_id] = updated
            self._touch_project(project_id)
            return self._copy(updated)

    def get_canvas_layout(self, project_id: str) -> CanvasLayout:
        with self._lock:
            self._require_project(project_id)
            layout = self._canvas_layouts.get(project_id)
            if layout is None:
                return CanvasLayout(project_id=project_id, nodes=[], revision=0)
            return self._copy(layout)

    def save_canvas_layout(
        self,
        project_id: str,
        *,
        expected_revision: int,
        nodes: Iterable[CanvasNode],
    ) -> CanvasLayout:
        with self._lock:
            self._require_project(project_id)
            current = self._canvas_layouts.get(project_id)
            current_revision = current.revision if current is not None else 0
            if current_revision != expected_revision:
                raise RevisionConflictError("canvas layout revision conflict")
            updated = CanvasLayout(
                project_id=project_id,
                nodes=list(nodes),
                revision=current_revision + 1,
                updated_at=utc_now(),
            )
            self._canvas_layouts[project_id] = updated
            self._touch_project(project_id)
            return self._copy(updated)

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
        with self._lock:
            if project_id is not None:
                self._require_project(project_id)
            return [
                self._copy(asset)
                for asset in self._assets.values()
                if (project_id is None or asset.project_id == project_id)
                and (
                    asset.project_id is None
                    or self._project_deleted_at.get(asset.project_id) is None
                )
                and (category is None or asset.category == category)
                and (status is None or asset.status == status)
                and (asset_role is None or asset.asset_role == asset_role)
            ]

    def update_asset(self, asset_id: str, **changes: object) -> Asset:
        with self._lock:
            if asset_id not in self._assets:
                raise NotFoundError(f"asset not found: {asset_id}")

            asset = self._assets[asset_id]
            if asset.project_id is not None:
                self._require_project(asset.project_id)
            updated = asset.model_copy(
                update={
                    **changes,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._assets[asset_id] = updated
            if asset.project_id is not None:
                self._replace_project_item(asset.project_id, "assets", updated)
                self._touch_project(asset.project_id)
            return self._copy(updated)

    def delete_tool_asset(self, asset_id: str) -> Asset:
        with self._lock:
            asset = self._assets.get(asset_id)
            if asset is None or asset.tool_asset_role is None:
                raise NotFoundError(f"tool asset not found: {asset_id}")
            self._prepare_aigc_asset_delete(asset_id)
            del self._assets[asset_id]
            return self._copy(asset)

    def delete_asset(self, project_id: str, asset_id: str) -> Asset:
        with self._lock:
            self._require_project(project_id)
            if asset_id not in self._assets:
                raise NotFoundError(f"asset not found: {asset_id}")
            asset = self._assets[asset_id]
            if asset.project_id != project_id:
                raise NotFoundError(f"asset not found: {asset_id}")
            self._prepare_aigc_asset_delete(asset_id)

            for shot in list(self._storyboard_shots.values()):
                if shot.project_id != project_id:
                    continue
                changes: dict[str, object] = {}
                if shot.image_asset_id == asset_id:
                    changes["image_asset_id"] = None
                if shot.first_frame_asset_id == asset_id:
                    changes["first_frame_asset_id"] = None
                if shot.first_frame_source_video_asset_id == asset_id:
                    changes["first_frame_source_video_asset_id"] = None
                if shot.video_asset_id == asset_id:
                    changes["video_asset_id"] = None
                for field_name in (
                    "reference_image_asset_ids",
                    "reference_video_asset_ids",
                    "reference_audio_asset_ids",
                ):
                    current = list(getattr(shot, field_name))
                    next_ids = [
                        existing_id
                        for existing_id in current
                        if existing_id != asset_id
                    ]
                    if next_ids != current:
                        changes[field_name] = next_ids
                if changes:
                    self._update_storyboard_shot(project_id, shot.id, **changes)

            for card in list(self._character_cards.values()):
                if card.project_id == project_id and card.asset_id == asset_id:
                    self.update_character_card(project_id, card.id, asset_id=None)

            deleted = self._assets.pop(asset_id)
            project = self._require_project(project_id)
            self._projects[project_id] = project.model_copy(
                update={
                    "assets": [
                        existing
                        for existing in project.assets
                        if existing.id != asset_id
                    ],
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return self._copy(deleted)

    def create_character_card(self, data: CharacterCardCreate) -> CharacterCard:
        with self._lock:
            self._require_project(data.project_id)
            self._require_project_asset(data.project_id, data.asset_id)
            card = CharacterCard(**data.model_dump())
            if card.id in self._character_cards:
                raise ValueError(f"character card already exists: {card.id}")
            self._character_cards[card.id] = card
            self._sync_project_character_cards(data.project_id)
            self._touch_project(data.project_id)
            return self._copy(card)

    def get_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard:
        with self._lock:
            return self._copy(self._require_character_card(project_id, card_id))

    def list_project_character_cards(self, project_id: str) -> list[CharacterCard]:
        with self._lock:
            self._require_project(project_id)
            return [
                self._copy(card)
                for card in sorted(
                    self._character_cards.values(),
                    key=lambda item: (item.sort_order, item.created_at, item.id),
                )
                if card.project_id == project_id
            ]

    def mark_character_cards_stale(self, project_id: str) -> list[CharacterCard]:
        with self._lock:
            self._require_project(project_id)
            return [
                self.update_character_card(
                    project_id,
                    card.id,
                    status=Status.STALE,
                )
                for card in list(self._character_cards.values())
                if card.project_id == project_id
            ]

    def update_character_card(
        self,
        project_id: str,
        card_id: str,
        **changes: object,
    ) -> CharacterCard:
        with self._lock:
            card = self._require_character_card(project_id, card_id)
            if "asset_id" in changes:
                asset_id = changes["asset_id"]
                if asset_id is not None and not isinstance(asset_id, str):
                    raise TypeError("asset_id must be a string or None")
                self._require_project_asset(project_id, asset_id)
            updated = card.model_copy(
                update={**changes, "updated_at": utc_now()},
                deep=True,
            )
            self._character_cards[card_id] = updated
            self._sync_project_character_cards(project_id)
            self._touch_project(project_id)
            return self._copy(updated)

    def delete_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard:
        with self._lock:
            self._require_project(project_id)
            self._require_character_card(project_id, card_id)
            deleted = self._character_cards.pop(card_id)
            self._sync_project_character_cards(project_id)
            self._touch_project(project_id)
            return self._copy(deleted)

    def replace_project_storyboard(
        self,
        project_id: str,
        shots: Iterable[StoryboardShotCreate],
    ) -> list[StoryboardShot]:
        with self._lock:
            self._require_project(project_id)
            old_shot_ids = [
                shot_id
                for shot_id, shot in self._storyboard_shots.items()
                if shot.project_id == project_id
            ]
            for shot_id in old_shot_ids:
                del self._storyboard_shots[shot_id]

            created = [StoryboardShot(**shot.model_dump()) for shot in shots]
            for shot in created:
                self._storyboard_shots[shot.id] = shot

            self._projects[project_id] = self._projects[project_id].model_copy(
                update={
                    "storyboard": created,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return [self._copy(shot) for shot in created]

    def list_project_storyboard(self, project_id: str) -> list[StoryboardShot]:
        with self._lock:
            self._require_project(project_id)
            return [
                self._copy(shot)
                for shot in sorted(
                    self._storyboard_shots.values(),
                    key=lambda item: item.index,
                )
                if shot.project_id == project_id
            ]

    def mark_storyboard_shots_stale(self, project_id: str) -> list[StoryboardShot]:
        with self._lock:
            self._require_project(project_id)
            return [
                self._update_storyboard_shot(
                    project_id,
                    shot.id,
                    status=Status.STALE,
                )
                for shot in list(self._storyboard_shots.values())
                if shot.project_id == project_id
            ]

    def get_storyboard_shot(self, project_id: str, shot_id: str) -> StoryboardShot:
        with self._lock:
            self._require_project(project_id)
            shot = self._require_storyboard_shot(project_id, shot_id)
            return self._copy(shot)

    def get_storyboard_shot_by_index(
        self,
        project_id: str,
        shot_index: int,
    ) -> StoryboardShot:
        with self._lock:
            self._require_project(project_id)
            for shot in self._storyboard_shots.values():
                if shot.project_id == project_id and shot.index == shot_index:
                    return self._copy(shot)
            raise NotFoundError(f"storyboard shot not found: {shot_index}")

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
        with self._lock:
            shot = self._require_storyboard_shot(project_id, shot_id)
            field_name = _reference_field_name(kind)
            existing = list(getattr(shot, field_name))
            if asset_id not in existing:
                existing.append(asset_id)
            return self._update_storyboard_shot(
                project_id,
                shot_id,
                **{field_name: existing},
            )

    def remove_storyboard_shot_reference(
        self,
        project_id: str,
        shot_id: str,
        *,
        kind: ReferenceAssetKind,
        asset_id: str,
    ) -> StoryboardShot:
        with self._lock:
            shot = self._require_storyboard_shot(project_id, shot_id)
            field_name = _reference_field_name(kind)
            existing = [
                existing_id
                for existing_id in getattr(shot, field_name)
                if existing_id != asset_id
            ]
            return self._update_storyboard_shot(
                project_id,
                shot_id,
                **{field_name: existing},
            )

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
        with self._lock:
            self._require_project(project_id)
            self._require_storyboard_shot(project_id, shot_id)
            deleted = self._storyboard_shots.pop(shot_id)
            remaining = [
                existing
                for existing in sorted(
                    self._storyboard_shots.values(),
                    key=lambda item: (item.index, item.created_at, item.id),
                )
                if existing.project_id == project_id
            ]
            reindexed = []
            for index, existing in enumerate(remaining, start=1):
                updated = existing.model_copy(
                    update={"index": index, "updated_at": utc_now()},
                    deep=True,
                )
                self._storyboard_shots[updated.id] = updated
                reindexed.append(updated)

            project = self._require_project(project_id)
            self._projects[project_id] = project.model_copy(
                update={
                    "storyboard": reindexed,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return self._copy(deleted)

    def merge_storyboard_shots(
        self,
        project_id: str,
        shot_ids: Iterable[str],
    ) -> StoryboardShot:
        with self._lock:
            project = self._require_project(project_id)
            selected = [
                self._require_storyboard_shot(project_id, shot_id)
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
                for shot in ordered
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
            merged = primary.model_copy(
                update={
                    "title": f"{title_prefix} {indices[0]}-{indices[-1]}",
                    "description": "\n".join(descriptions),
                    "visual_prompt": "\n".join(visual_prompts),
                    "narration": "\n".join(narrations) if narrations else None,
                    "duration_seconds": sum(
                        shot.duration_seconds for shot in ordered
                    ),
                    "video_prompt": merged_video_prompt,
                    "reference_image_asset_ids": [],
                    "reference_video_asset_ids": [],
                    "reference_audio_asset_ids": [],
                    "merge_source_shots": atomic_snapshots,
                    "first_frame_asset_id": None,
                    "first_frame_source_video_asset_id": None,
                    "video_asset_id": None,
                    "image_asset_id": None,
                    "status": Status.DRAFT,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._storyboard_shots[merged.id] = merged
            for shot in ordered[1:]:
                del self._storyboard_shots[shot.id]

            remaining = [
                existing
                for existing in sorted(
                    self._storyboard_shots.values(),
                    key=lambda item: (item.index, item.created_at, item.id),
                )
                if existing.project_id == project_id
            ]
            reindexed = []
            merged_result = merged
            for index, existing in enumerate(remaining, start=1):
                updated = existing.model_copy(
                    update={"index": index, "updated_at": utc_now()},
                    deep=True,
                )
                self._storyboard_shots[updated.id] = updated
                reindexed.append(updated)
                if updated.id == merged.id:
                    merged_result = updated

            self._projects[project_id] = project.model_copy(
                update={
                    "storyboard": reindexed,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return self._copy(merged_result)

    def split_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
    ) -> list[StoryboardShot]:
        with self._lock:
            self._require_project(project_id)
            merged = self._require_storyboard_shot(project_id, shot_id)
            if not merged.merge_source_shots:
                raise ValueError("storyboard shot does not have an atomic merge snapshot")

            remaining = [
                existing
                for existing in self._storyboard_shots.values()
                if existing.project_id == project_id and existing.id != merged.id
            ]
            restored = [
                StoryboardShot(
                    id=snapshot.id,
                    project_id=project_id,
                    index=merged.index + offset,
                    title=snapshot.title,
                    description=snapshot.description,
                    visual_prompt=snapshot.visual_prompt,
                    narration=snapshot.narration,
                    duration_seconds=snapshot.duration_seconds,
                    status=Status.DRAFT,
                    video_prompt=snapshot.video_prompt,
                )
                for offset, snapshot in enumerate(merged.merge_source_shots)
            ]
            ordered = [
                *sorted(
                    (
                        shot
                        for shot in remaining
                        if shot.index < merged.index
                    ),
                    key=lambda item: item.index,
                ),
                *restored,
                *sorted(
                    (
                        shot
                        for shot in remaining
                        if shot.index > merged.index
                    ),
                    key=lambda item: item.index,
                ),
            ]
            reindexed: list[StoryboardShot] = []
            self._storyboard_shots.pop(merged.id)
            for index, shot in enumerate(ordered, start=1):
                updated = shot.model_copy(
                    update={"index": index, "updated_at": utc_now()},
                    deep=True,
                )
                self._storyboard_shots[updated.id] = updated
                reindexed.append(updated)

            project = self._require_project(project_id)
            self._projects[project_id] = project.model_copy(
                update={
                    "storyboard": reindexed,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            restored_ids = {shot.id for shot in restored}
            return [
                self._copy(shot)
                for shot in reindexed
                if shot.id in restored_ids
            ]

    def create_text_artifact(self, data: TextArtifactCreate) -> TextArtifact:
        with self._lock:
            self._require_project(data.project_id)
            artifact = TextArtifact(**data.model_dump())
            self._text_artifacts[artifact.id] = artifact
            self._projects[data.project_id].text_artifacts.append(artifact)
            self._touch_project(data.project_id)
            return self._copy(artifact)

    def get_text_artifact(self, artifact_id: str) -> TextArtifact:
        with self._lock:
            if artifact_id not in self._text_artifacts:
                raise NotFoundError(f"text artifact not found: {artifact_id}")
            artifact = self._text_artifacts[artifact_id]
            self._require_project(artifact.project_id)
            return self._copy(artifact)

    def list_project_text_artifacts(self, project_id: str) -> list[TextArtifact]:
        with self._lock:
            self._require_project(project_id)
            return [
                self._copy(artifact)
                for artifact in self._text_artifacts.values()
                if artifact.project_id == project_id
            ]

    def get_latest_text_artifact(
        self,
        project_id: str,
        stage: Stage,
        *,
        include_stale: bool = False,
    ) -> TextArtifact | None:
        with self._lock:
            self._require_project(project_id)
            artifacts = [
                artifact
                for artifact in self._text_artifacts.values()
                if artifact.project_id == project_id
                and artifact.stage == stage
                and (include_stale or artifact.status != Status.STALE)
            ]
            if not artifacts:
                return None

            latest = max(artifacts, key=lambda artifact: artifact.version)
            return self._copy(latest)

    def update_text_artifact(self, artifact_id: str, **changes: object) -> TextArtifact:
        with self._lock:
            if artifact_id not in self._text_artifacts:
                raise NotFoundError(f"text artifact not found: {artifact_id}")

            artifact = self._text_artifacts[artifact_id]
            self._require_project(artifact.project_id)
            updated = artifact.model_copy(
                update={
                    **changes,
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            self._text_artifacts[artifact_id] = updated
            self._replace_project_item(artifact.project_id, "text_artifacts", updated)
            self._touch_project(artifact.project_id)
            return self._copy(updated)

    def delete_text_artifact(
        self,
        project_id: str,
        artifact_id: str,
    ) -> TextArtifact:
        with self._lock:
            self._require_project(project_id)
            if artifact_id not in self._text_artifacts:
                raise NotFoundError(f"text artifact not found: {artifact_id}")
            artifact = self._text_artifacts[artifact_id]
            if artifact.project_id != project_id:
                raise NotFoundError(f"text artifact not found: {artifact_id}")
            deleted = self._text_artifacts.pop(artifact_id)
            project = self._require_project(project_id)
            self._projects[project_id] = project.model_copy(
                update={
                    "text_artifacts": [
                        existing
                        for existing in project.text_artifacts
                        if existing.id != artifact_id
                    ],
                    "updated_at": utc_now(),
                },
                deep=True,
            )
            return self._copy(deleted)

    def mark_text_artifacts_stale(
        self,
        project_id: str,
        stages: Iterable[Stage],
    ) -> list[TextArtifact]:
        with self._lock:
            self._require_project(project_id)
            stale_stages = set(stages)
            updated_artifacts = []

            for artifact in list(self._text_artifacts.values()):
                if artifact.project_id == project_id and artifact.stage in stale_stages:
                    updated_artifacts.append(
                        self.update_text_artifact(artifact.id, status=Status.STALE)
                    )

            return updated_artifacts

    def mark_assets_stale(self, project_id: str, stages: Iterable[Stage]) -> list[Asset]:
        with self._lock:
            self._require_project(project_id)
            stale_stages = set(stages)
            updated_assets = []

            for asset in list(self._assets.values()):
                if (
                    asset.project_id == project_id
                    and asset.stage in stale_stages
                    and asset.metadata.get("usage")
                    != "storyboard_video_tail_frame_reference"
                ):
                    updated_assets.append(self.update_asset(asset.id, status=Status.STALE))

            return updated_assets

    def mark_storyboard_video_assets_stale(
        self,
        project_id: str,
        shot_ids: Iterable[str],
        *,
        asset_ids: Iterable[str] | None = None,
    ) -> list[Asset]:
        with self._lock:
            self._require_project(project_id)
            affected_shot_ids = set(shot_ids)
            affected_asset_ids = set(asset_ids or [])
            updated_assets = []

            for asset in list(self._assets.values()):
                if (
                    asset.project_id != project_id
                    or asset.stage != Stage.VIDEO
                    or asset.type != AssetType.STORYBOARD_VIDEO
                    or asset.status == Status.STALE
                ):
                    continue
                metadata = asset.metadata
                if (
                    asset.id in affected_asset_ids
                    or metadata.get("shot_id") in affected_shot_ids
                    or metadata.get("candidate_for_shot_id") in affected_shot_ids
                    or metadata.get("selected_for_shot_id") in affected_shot_ids
                ):
                    updated_assets.append(
                        self.update_asset(asset.id, status=Status.STALE)
                    )

            return updated_assets

    def clear(self) -> None:
        with self._lock:
            self._projects.clear()
            self._project_deleted_at.clear()
            self._tasks.clear()
            self._assets.clear()
            self._character_cards.clear()
            self._storyboard_shots.clear()
            self._text_artifacts.clear()
            self._image_prompt_versions.clear()
            self._image_layer_sets.clear()
            self._canvas_layouts.clear()
            self._aigc_templates.clear()
            self._aigc_pipelines.clear()
            self._aigc_pipeline_deleted_at.clear()
            self._aigc_pipeline_assets.clear()
            self._aigc_runs.clear()
            self._aigc_run_nodes.clear()
            self._aigc_run_idempotency.clear()
            self._aigc_tasks.clear()
            self._aigc_task_idempotency.clear()
            self._aigc_task_retry_of.clear()
            self._aigc_task_fencing.clear()
            self._aigc_task_assets.clear()
            self._aigc_worker_lease = None

    def _aigc_asset_references_for_pipeline(
        self,
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
            if reference.asset_id not in self._assets:
                raise NotFoundError(f"asset not found: {reference.asset_id}")
        return references

    def _replace_aigc_pipeline_assets(
        self,
        pipeline_id: str,
        references: Iterable[AigcPipelineAssetReference],
    ) -> None:
        for key in [
            key for key in self._aigc_pipeline_assets if key[0] == pipeline_id
        ]:
            del self._aigc_pipeline_assets[key]
        for reference in references:
            self._aigc_pipeline_assets[
                (reference.pipeline_id, reference.node_id, reference.slot)
            ] = self._copy(reference)

    def _prepare_aigc_asset_delete(self, asset_id: str) -> None:
        pipeline_reference = next(
            (
                reference
                for reference in self._aigc_pipeline_assets.values()
                if reference.asset_id == asset_id
            ),
            None,
        )
        if pipeline_reference is not None:
            raise AssetReferenceConflictError(
                f"asset is referenced by AIGC pipeline: "
                f"{pipeline_reference.pipeline_id}"
            )
        terminal_runs = {
            AigcPipelineRunStatus.SUCCEEDED,
            AigcPipelineRunStatus.FAILED,
            AigcPipelineRunStatus.CANCELED,
        }
        referenced_keys = [
            key
            for key, reference in self._aigc_task_assets.items()
            if reference.asset_id == asset_id
        ]
        for key in referenced_keys:
            task = self._aigc_tasks[key[0]]
            run = self._aigc_runs[task.run_id]
            if run.status not in terminal_runs:
                raise AssetReferenceConflictError(
                    f"asset is referenced by active AIGC run: {run.id}"
                )
        for key in referenced_keys:
            del self._aigc_task_assets[key]

    def _require_project(self, project_id: str) -> Project:
        if (
            project_id not in self._projects
            or self._project_deleted_at.get(project_id) is not None
        ):
            raise NotFoundError(f"project not found: {project_id}")
        return self._projects[project_id]

    def _require_project_asset(
        self,
        project_id: str,
        asset_id: str | None,
    ) -> Asset | None:
        self._require_project(project_id)
        if asset_id is None:
            return None
        if asset_id not in self._assets or self._assets[asset_id].project_id != project_id:
            raise NotFoundError(f"asset not found: {asset_id}")
        return self._assets[asset_id]

    def _require_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard:
        self._require_project(project_id)
        if card_id not in self._character_cards:
            raise NotFoundError(f"character card not found: {card_id}")
        card = self._character_cards[card_id]
        if card.project_id != project_id:
            raise NotFoundError(f"character card not found: {card_id}")
        return card

    def _require_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
    ) -> StoryboardShot:
        self._require_project(project_id)
        if shot_id not in self._storyboard_shots:
            raise NotFoundError(f"storyboard shot not found: {shot_id}")
        shot = self._storyboard_shots[shot_id]
        if shot.project_id != project_id:
            raise NotFoundError(f"storyboard shot not found: {shot_id}")
        return shot

    def _update_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
        **changes: object,
    ) -> StoryboardShot:
        with self._lock:
            self._require_project(project_id)
            shot = self._require_storyboard_shot(project_id, shot_id)
            updated = shot.model_copy(
                update={**changes, "updated_at": utc_now()},
                deep=True,
            )
            self._storyboard_shots[shot_id] = updated
            self._replace_project_item(project_id, "storyboard", updated)
            self._touch_project(project_id)
            return self._copy(updated)

    def _touch_project(self, project_id: str) -> None:
        project = self._require_project(project_id)
        self._projects[project_id] = project.model_copy(
            update={"updated_at": utc_now()},
            deep=True,
        )

    def _sync_project_character_cards(self, project_id: str) -> None:
        project = self._require_project(project_id)
        self._projects[project_id] = project.model_copy(
            update={
                "character_cards": [
                    card
                    for card in sorted(
                        self._character_cards.values(),
                        key=lambda item: (item.sort_order, item.created_at, item.id),
                    )
                    if card.project_id == project_id
                ],
            },
            deep=True,
        )

    def _replace_project_item(
        self,
        project_id: str,
        collection_name: str,
        item: Asset | CharacterCard | GenerationTask | StoryboardShot | TextArtifact,
    ) -> None:
        project = self._require_project(project_id)
        collection = getattr(project, collection_name)
        for index, existing in enumerate(collection):
            if existing.id == item.id:
                collection[index] = item
                break

    @staticmethod
    def _default_project_name(brief: Brief) -> str:
        if brief.product_name:
            return brief.product_name
        prompt = " ".join(brief.prompt.split())
        return prompt[:60] or "Untitled project"

    @staticmethod
    def _copy(model: ModelT) -> ModelT:
        return model.model_copy(deep=True)


def _reference_field_name(kind: ReferenceAssetKind) -> str:
    return {
        ReferenceAssetKind.IMAGE: "reference_image_asset_ids",
        ReferenceAssetKind.VIDEO: "reference_video_asset_ids",
        ReferenceAssetKind.AUDIO: "reference_audio_asset_ids",
    }[kind]
