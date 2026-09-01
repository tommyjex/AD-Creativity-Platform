from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from collections import defaultdict
from contextlib import suppress
from dataclasses import dataclass
from uuid import uuid4

from backend.app.repositories import NotFoundError, Repository
from backend.app.schemas import (
    AigcAssetDirection,
    AigcEdge,
    AigcEditedLayer,
    AigcImageLayer,
    AigcLayer,
    AigcLayerSet,
    AigcNode,
    AigcPipeline,
    AigcPipelineRun,
    AigcPipelineRunCreate,
    AigcPipelineRunDetail,
    AigcPipelineRunMode,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
    AigcPipelineTaskAttempt,
    AigcPipelineTaskAssetReference,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskError,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcTaskStatus,
    AigcTaskType,
    AigcVideoGenerationMode,
    AudioInputNode,
    ImageInputNode,
    ImageToImageNode,
    LayerCanvasNode,
    LayerCompositeNode,
    LlmNode,
    Status,
    TextInputNode,
    VideoGenerationNode,
    VideoInputNode,
)
from backend.app.schemas.common import utc_now
from backend.app.schemas.seedance import (
    SEEDANCE_DEFAULT_MODEL,
    validate_seedance_reference_counts,
)
from backend.app.services.aigc_dag import (
    AigcCacheCandidate,
    AigcExecutionPlan,
    AigcPlanAction,
    AigcUpstreamDigest,
    build_aigc_execution_plan,
    canonical_aigc_input_hash,
    validate_aigc_dag,
)
from backend.app.services.aigc_gateway import (
    AIGC_IMAGE_EXECUTOR_VERSION,
    AIGC_LAYER_EXECUTOR_VERSION,
    AIGC_LLM_EXECUTOR_VERSION,
    AIGC_VIDEO_EXECUTOR_VERSION,
    AigcGatewayExecution,
    AigcGatewayError,
    AigcModelGateway,
)

logger = logging.getLogger(__name__)


# #region debug-point A-E:layer-canvas-reporter
def _debug_layer_canvas_worker(
    hypothesis_id: str,
    location: str,
    message: str,
    data: dict[str, object],
) -> None:
    try:
        import time
        import urllib.request

        debug_url = "http://127.0.0.1:7777/event"
        session_id = "aigc-layer-asset-transfer"
        try:
            with open(
                ".dbg/aigc-layer-asset-transfer.env",
                encoding="utf-8",
            ) as env_file:
                env_values = dict(
                    line.split("=", 1)
                    for line in env_file.read().splitlines()
                    if "=" in line
                )
            debug_url = env_values.get("DEBUG_SERVER_URL", debug_url)
            session_id = env_values.get("DEBUG_SESSION_ID", session_id)
        except Exception:
            pass
        urllib.request.urlopen(
            urllib.request.Request(
                debug_url,
                data=json.dumps(
                    {
                        "sessionId": session_id,
                        "runId": "canvas-post-fix",
                        "hypothesisId": hypothesis_id,
                        "location": location,
                        "msg": f"[DEBUG] {message}",
                        "data": data,
                        "ts": int(time.time() * 1000),
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            ),
            timeout=0.2,
        ).read()
    except Exception:
        pass
# #endregion


TERMINAL_RUN_STATUSES = {
    AigcPipelineRunStatus.SUCCEEDED,
    AigcPipelineRunStatus.FAILED,
    AigcPipelineRunStatus.CANCELED,
}
SUCCESS_NODE_STATUSES = {
    AigcRunNodeStatus.SUCCEEDED,
    AigcRunNodeStatus.REUSED,
}
FAILED_NODE_STATUSES = {
    AigcRunNodeStatus.FAILED,
    AigcRunNodeStatus.TIMED_OUT,
    AigcRunNodeStatus.BLOCKED,
    AigcRunNodeStatus.CANCELED,
}
STATIC_TASK_TYPES = {
    "llm": AigcTaskType.LLM,
    "text_to_image": AigcTaskType.TEXT_TO_IMAGE,
    "video_generation": AigcTaskType.VIDEO_GENERATION,
    "layer_canvas": AigcTaskType.LAYER_CANVAS,
    "layer_composite": AigcTaskType.LAYER_COMPOSITE,
}
EXECUTABLE_NODE_TYPES = set(STATIC_TASK_TYPES) | {"image_to_image"}
HASHABLE_NODE_TYPES = set(EXECUTABLE_NODE_TYPES)
ASSET_INPUT_NODE_TYPES = (ImageInputNode, VideoInputNode, AudioInputNode)
ORDERED_MULTI_INPUT_HANDLES = {
    "image_to_image": {"image"},
    "video_generation": {
        "reference_images",
        "reference_videos",
        "reference_audios",
    },
}
@dataclass(frozen=True)
class _CacheState:
    candidates: dict[str, AigcCacheCandidate]
    nodes: dict[str, AigcPipelineRunNode]


class AigcPipelineRuntime:
    def __init__(
        self,
        repository: Repository,
        gateway: AigcModelGateway,
        *,
        queue_capacity: int = 100,
        worker_count: int = 4,
        llm_concurrency: int = 2,
        image_concurrency: int = 2,
        video_concurrency: int = 1,
        lease_seconds: int = 30,
        lease_retry_seconds: float = 1.0,
    ) -> None:
        self.repository = repository
        self.gateway = gateway
        self.queue: asyncio.Queue[str] = asyncio.Queue(maxsize=queue_capacity)
        self.worker_count = worker_count
        self.lease_seconds = lease_seconds
        self.lease_retry_seconds = lease_retry_seconds
        self.owner_id = f"aigc-worker-{uuid4()}"
        self._lease_token: int | None = None
        self._workers: list[asyncio.Task[None]] = []
        self._heartbeat: asyncio.Task[None] | None = None
        self._lease_retry: asyncio.Task[None] | None = None
        self._enqueued: set[str] = set()
        self._start_lock = asyncio.Lock()
        self._stopping = False
        self._llm_semaphore = asyncio.Semaphore(llm_concurrency)
        self._image_semaphore = asyncio.Semaphore(image_concurrency)
        self._video_semaphore = asyncio.Semaphore(video_concurrency)

    async def start(self) -> bool:
        async with self._start_lock:
            self._stopping = False
            self._workers = [task for task in self._workers if not task.done()]
            if self._workers and self._lease_token is not None:
                return True
            try:
                lease = self.repository.acquire_aigc_worker_lease(
                    self.owner_id,
                    now=utc_now(),
                    lease_seconds=self.lease_seconds,
                )
            except Exception:
                logger.exception(
                    "Failed to acquire AIGC worker lease",
                    extra={"aigc_worker_owner_id": self.owner_id},
                )
                self._ensure_lease_retry()
                return False
            if lease is None:
                self._ensure_lease_retry()
                return False
            self._lease_token = lease.fencing_token
            await self._recover_interrupted_tasks()
            await self._enqueue_queued_tasks()
            self._workers = [
                asyncio.create_task(self._worker(index))
                for index in range(self.worker_count)
            ]
            self._heartbeat = asyncio.create_task(self._heartbeat_loop())
            return True

    async def stop(self) -> None:
        self._stopping = True
        tasks = [*self._workers]
        if self._heartbeat is not None:
            tasks.append(self._heartbeat)
        if self._lease_retry is not None:
            tasks.append(self._lease_retry)
        for task in tasks:
            task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError):
                await task
        self._workers.clear()
        self._heartbeat = None
        self._lease_retry = None
        self._lease_token = None
        self._enqueued.clear()

    async def wait_until_idle(self) -> None:
        await self.queue.join()

    async def submit_run(
        self,
        pipeline_id: str,
        request: AigcPipelineRunCreate,
        *,
        idempotency_key: str,
    ) -> AigcPipelineRunDetail:
        pipeline = self.repository.get_aigc_pipeline(pipeline_id)
        if pipeline.revision != request.expected_revision:
            from backend.app.repositories import RevisionConflictError

            raise RevisionConflictError("AIGC pipeline revision conflict")
        return await self._submit(
            pipeline,
            definition=pipeline.definition,
            persisted_mode=request.mode,
            planning_mode=request.mode,
            start_node_id=request.start_node_id,
            source_run_id=None,
            source_node_id=None,
            idempotency_key=idempotency_key,
        )

    async def retry_node(
        self,
        run_id: str,
        node_id: str,
        *,
        idempotency_key: str,
    ) -> AigcPipelineRunDetail:
        source = self.repository.get_aigc_run(run_id)
        source_node = next(
            (node for node in source.nodes if node.node_id == node_id),
            None,
        )
        if source.run.status != AigcPipelineRunStatus.FAILED or source_node is None:
            raise ValueError("only failed run nodes can be retried")
        if source_node.status not in {
            AigcRunNodeStatus.FAILED,
            AigcRunNodeStatus.TIMED_OUT,
            AigcRunNodeStatus.BLOCKED,
        }:
            raise ValueError("AIGC run node is not retryable")
        pipeline = self.repository.get_aigc_pipeline(source.run.pipeline_id)
        return await self._submit(
            pipeline,
            definition=source.run.definition_snapshot,
            pipeline_revision=source.run.pipeline_revision,
            persisted_mode=AigcPipelineRunMode.RETRY_NODE,
            planning_mode=AigcPipelineRunMode.FROM_NODE,
            start_node_id=node_id,
            source_run_id=source.run.id,
            source_node_id=node_id,
            idempotency_key=idempotency_key,
        )

    async def cancel_run(self, run_id: str) -> AigcPipelineRunDetail:
        detail = self.repository.get_aigc_run(run_id)
        if detail.run.status in TERMINAL_RUN_STATUSES:
            return detail
        self.repository.update_aigc_run(
            run_id,
            cancellation_requested=True,
        )
        for node in detail.nodes:
            for task in node.attempts:
                if task.status == AigcTaskStatus.QUEUED:
                    self.repository.update_aigc_task_attempt(
                        task.task_id,
                        status=AigcTaskStatus.CANCELED,
                        finished_at=utc_now(),
                    )
            if node.status in {
                AigcRunNodeStatus.IDLE,
                AigcRunNodeStatus.READY,
                AigcRunNodeStatus.QUEUED,
            }:
                self.repository.update_aigc_run_node(
                    run_id,
                    node.node_id,
                    status=AigcRunNodeStatus.CANCELED,
                )
        await self._finalize_run(run_id)
        return self.repository.get_aigc_run(run_id)

    async def _submit(
        self,
        pipeline: AigcPipeline,
        *,
        definition,
        persisted_mode: AigcPipelineRunMode,
        planning_mode: AigcPipelineRunMode,
        start_node_id: str | None,
        source_run_id: str | None,
        source_node_id: str | None,
        idempotency_key: str,
        pipeline_revision: int | None = None,
    ) -> AigcPipelineRunDetail:
        available_assets = {
            asset.id
            for asset in self.repository.list_assets(status=None)
            if asset.status.value == "succeeded"
        }
        validate_aigc_dag(
            definition,
            available_asset_ids=available_assets,
        )
        cache = self._cache_state(pipeline.id)
        input_hashes = self._expected_input_hashes(definition, cache.nodes)
        plan = build_aigc_execution_plan(
            definition,
            mode=planning_mode,
            start_node_id=start_node_id,
            input_hashes=input_hashes,
            cache_candidates=cache.candidates,
            available_asset_ids=available_assets,
        )
        run = AigcPipelineRun(
            pipeline_id=pipeline.id,
            run_number=1,
            pipeline_revision=(
                pipeline.revision if pipeline_revision is None else pipeline_revision
            ),
            mode=persisted_mode,
            start_node_id=start_node_id,
            source_run_id=source_run_id,
            source_node_id=source_node_id,
            definition_snapshot=definition,
            input_snapshot=self._input_snapshot(definition),
        )
        run_nodes = self._run_nodes(definition, plan, input_hashes, cache.nodes)
        created = self.repository.create_aigc_run(
            run,
            idempotency_key=idempotency_key,
            nodes=run_nodes,
        )
        if created.run.status == AigcPipelineRunStatus.QUEUED:
            self.repository.update_aigc_run(
                created.run.id,
                status=AigcPipelineRunStatus.RUNNING,
                started_at=utc_now(),
            )
        await self.start()
        await self._schedule_ready_nodes(created.run.id)
        await self._finalize_run(created.run.id)
        return self.repository.get_aigc_run(created.run.id)

    def _cache_state(self, pipeline_id: str) -> _CacheState:
        candidates: dict[str, AigcCacheCandidate] = {}
        nodes_by_id: dict[str, AigcPipelineRunNode] = {}
        for run in self.repository.list_aigc_runs(pipeline_id):
            if run.status not in {
                AigcPipelineRunStatus.SUCCEEDED,
                AigcPipelineRunStatus.FAILED,
            }:
                continue
            detail = self.repository.get_aigc_run(run.id)
            for node in detail.nodes:
                if node.node_id in candidates or node.input_hash is None:
                    continue
                source_task_id = node.current_task_id or node.reused_from_task_id
                if source_task_id is None:
                    continue
                output_available = self._result_available(node.result)
                candidates[node.node_id] = AigcCacheCandidate(
                    node_id=node.node_id,
                    input_hash=node.input_hash,
                    task_id=source_task_id,
                    output_available=output_available,
                )
                nodes_by_id[node.node_id] = node
        return _CacheState(candidates, nodes_by_id)

    def _expected_input_hashes(
        self,
        definition,
        cached_nodes: dict[str, AigcPipelineRunNode],
    ) -> dict[str, str]:
        order = validate_aigc_dag(
            definition,
            available_asset_ids={
                asset.id
                for asset in self.repository.list_assets(status=None)
                if asset.status.value == "succeeded"
            },
        )
        node_by_id = {node.id: node for node in definition.nodes}
        incoming = defaultdict(list)
        for edge in definition.edges:
            incoming[edge.target_node_id].append(edge)
        digests: dict[str, str] = {}
        hashes: dict[str, str] = {}
        for node_id in order:
            node = node_by_id[node_id]
            if isinstance(node, TextInputNode):
                digests[node_id] = _sha256(node.config.text)
                continue
            if isinstance(node, ASSET_INPUT_NODE_TYPES):
                digests[node_id] = self._asset_digest(node.config.asset_id or "")
                continue
            if node.type.value not in HASHABLE_NODE_TYPES:
                continue
            upstream = []
            target_ordinals: dict[str, int] = defaultdict(int)
            for edge in incoming[node_id]:
                source = node_by_id[edge.source_node_id]
                digest = (
                    _sha256(
                        _compile_bbox_prompt(
                            source,
                            target_node_id=node.id,
                            edges=incoming[node_id],
                            node_by_id=node_by_id,
                        )
                    )
                    if isinstance(source, TextInputNode)
                    and isinstance(node, ImageToImageNode)
                    and node.config.operation == "image_to_image"
                    else digests.get(edge.source_node_id)
                )
                if digest is None:
                    cached = cached_nodes.get(edge.source_node_id)
                    digest = (
                        _result_port_digest(
                            cached.result,
                            edge.source_handle,
                        )
                        if cached is not None
                        else f"pending:{edge.source_node_id}"
                    )
                upstream.append(
                    AigcUpstreamDigest(
                        target_handle=edge.target_handle,
                        source_node_id=edge.source_node_id,
                        source_handle=edge.source_handle,
                        digest=digest,
                        ordinal=(
                            target_ordinals[edge.target_handle]
                            if edge.target_handle
                            in ORDERED_MULTI_INPUT_HANDLES.get(
                                node.type.value,
                                set(),
                            )
                            else None
                        ),
                    )
                )
                target_ordinals[edge.target_handle] += 1
            config = node.config.model_dump(mode="json")
            model = str(config.get("model", ""))
            executor_version = _executor_version(node)
            hashes[node_id] = canonical_aigc_input_hash(
                node_type=node.type,
                executor_version=executor_version,
                model=model,
                config=config,
                upstream=upstream,
            )
        return hashes

    @staticmethod
    def _input_snapshot(definition) -> dict[str, object]:
        return {
            node.id: node.config.model_dump(mode="json")
            for node in definition.nodes
            if isinstance(node, (TextInputNode, *ASSET_INPUT_NODE_TYPES))
        }

    @staticmethod
    def _run_nodes(
        definition,
        plan: AigcExecutionPlan,
        input_hashes: dict[str, str],
        cached_nodes: dict[str, AigcPipelineRunNode],
    ) -> list[AigcPipelineRunNode]:
        nodes = []
        for node in definition.nodes:
            action = plan.actions[node.id]
            cached = cached_nodes.get(node.id)
            if action == AigcPlanAction.RESOLVE:
                status = AigcRunNodeStatus.SUCCEEDED
            elif action == AigcPlanAction.REUSE:
                status = AigcRunNodeStatus.REUSED
            else:
                status = AigcRunNodeStatus.IDLE
            nodes.append(
                AigcPipelineRunNode(
                    node_id=node.id,
                    included_in_plan=action != AigcPlanAction.IDLE,
                    status=status,
                    reused_from_task_id=plan.reused_from_task_ids.get(node.id),
                    input_hash=input_hashes.get(node.id),
                    result=(
                        cached.result
                        if action == AigcPlanAction.REUSE and cached is not None
                        else AigcTaskResult()
                    ),
                )
            )
        return nodes

    async def _schedule_ready_nodes(self, run_id: str) -> None:
        detail = self.repository.get_aigc_run(run_id)
        node_by_id = {
            node.id: node for node in detail.run.definition_snapshot.nodes
        }
        run_node_by_id = {node.node_id: node for node in detail.nodes}
        incoming = defaultdict(list)
        for edge in detail.run.definition_snapshot.edges:
            incoming[edge.target_node_id].append(edge)

        for node_id, node in node_by_id.items():
            run_node = run_node_by_id[node_id]
            if (
                node.type.value not in EXECUTABLE_NODE_TYPES
                or not run_node.included_in_plan
                or run_node.status
                not in {AigcRunNodeStatus.IDLE, AigcRunNodeStatus.READY}
            ):
                continue
            upstream_nodes = [
                run_node_by_id[edge.source_node_id] for edge in incoming[node_id]
            ]
            unavailable_dependencies = [
                item
                for item in upstream_nodes
                if not item.included_in_plan
                and item.status not in SUCCESS_NODE_STATUSES
            ]
            if unavailable_dependencies:
                dependency_ids = ", ".join(
                    sorted(item.node_id for item in unavailable_dependencies)
                )
                self._record_scheduling_failure(
                    run_id,
                    node_id,
                    ValueError(
                        "execution plan excludes required upstream "
                        f"node(s): {dependency_ids}"
                    ),
                )
                run_node_by_id = {
                    item.node_id: item
                    for item in self.repository.get_aigc_run(run_id).nodes
                }
                continue
            if any(item.status in FAILED_NODE_STATUSES for item in upstream_nodes):
                self.repository.update_aigc_run_node(
                    run_id,
                    node_id,
                    status=AigcRunNodeStatus.BLOCKED,
                )
                continue
            if not all(item.status in SUCCESS_NODE_STATUSES for item in upstream_nodes):
                continue
            try:
                params, upstream_ids = self._resolve_task_params(
                    node,
                    incoming[node_id],
                    node_by_id,
                    run_node_by_id,
                )
                input_hash = self._hash_resolved_task(
                    node,
                    params,
                    incoming[node_id],
                    node_by_id,
                    run_node_by_id,
                )
                self.repository.update_aigc_run_node(
                    run_id,
                    node_id,
                    status=AigcRunNodeStatus.READY,
                    input_hash=input_hash,
                )
                task = self.repository.create_aigc_task_attempt(
                    AigcPipelineTaskAttempt(
                        pipeline_id=detail.run.pipeline_id,
                        run_id=run_id,
                        node_id=node_id,
                        type=_task_type(node),
                        params=params,
                        upstream=upstream_ids,
                    ),
                    idempotency_key=f"{run_id}:{node_id}:attempt:1",
                )
            except Exception as exc:
                self._record_scheduling_failure(run_id, node_id, exc)
                run_node_by_id = {
                    item.node_id: item
                    for item in self.repository.get_aigc_run(run_id).nodes
                }
                continue
            await self._enqueue(task.task_id)
        await self._project_outputs(run_id)

    def _record_scheduling_failure(
        self,
        run_id: str,
        node_id: str,
        exc: Exception,
    ) -> None:
        if isinstance(exc, ValueError):
            error = AigcTaskError(
                code="invalid_input",
                message=f"Invalid input for AIGC node '{node_id}': {exc}",
                stage="scheduling",
            )
        else:
            error = AigcTaskError(
                code="task_creation_failed",
                message=(
                    f"Failed to create AIGC task for node '{node_id}' "
                    f"({type(exc).__name__})"
                ),
                stage="scheduling",
            )
        self.repository.update_aigc_run_node(
            run_id,
            node_id,
            status=AigcRunNodeStatus.FAILED,
            error=error,
        )
        detail = self.repository.get_aigc_run(run_id)
        children: dict[str, set[str]] = defaultdict(set)
        for edge in detail.run.definition_snapshot.edges:
            children[edge.source_node_id].add(edge.target_node_id)
        descendants: set[str] = set()
        pending = list(children[node_id])
        while pending:
            descendant_id = pending.pop()
            if descendant_id in descendants:
                continue
            descendants.add(descendant_id)
            pending.extend(children[descendant_id])
        for node in detail.nodes:
            if (
                node.node_id in descendants
                and node.included_in_plan
                and node.status
                in {AigcRunNodeStatus.IDLE, AigcRunNodeStatus.READY}
            ):
                self.repository.update_aigc_run_node(
                    run_id,
                    node.node_id,
                    status=AigcRunNodeStatus.BLOCKED,
                )
        self.repository.update_aigc_run(run_id, error=error)

    def _resolve_task_params(
        self,
        node,
        edges,
        node_by_id,
        run_node_by_id,
    ) -> tuple[dict[str, object], list[str]]:
        values: dict[str, object] = {}
        asset_ids_by_handle: dict[str, list[str]] = defaultdict(list)
        upstream_ids: list[str] = []
        for edge in edges:
            source = node_by_id[edge.source_node_id]
            source_run_node = run_node_by_id[source.id]
            upstream_ids.append(source.id)
            if isinstance(source, TextInputNode):
                value = (
                    _compile_bbox_prompt(
                        source,
                        target_node_id=node.id,
                        edges=edges,
                        node_by_id=node_by_id,
                    )
                    if node.type.value == "image_to_image"
                    else source.config.text
                )
            elif isinstance(source, ASSET_INPUT_NODE_TYPES):
                value = source.config.asset_id
            else:
                value = _result_value_for_port(
                    source_run_node.result,
                    edge.source_handle,
                    source.id,
                )
            if edge.target_handle in ORDERED_MULTI_INPUT_HANDLES.get(
                node.type.value,
                set(),
            ):
                asset_ids_by_handle[edge.target_handle].append(str(value))
            else:
                values[edge.target_handle] = value
        params = node.config.model_dump(mode="json")
        if isinstance(node, ImageToImageNode):
            operation = node.config.operation
            params["prompt"] = str(values.get("prompt") or "")
            if operation == "image_to_image":
                params["reference_asset_ids"] = asset_ids_by_handle["image"]
            elif operation == "image_edit":
                if "edit_image" in values:
                    params["edit_image_asset_id"] = str(values["edit_image"])
                else:
                    edit_layer = AigcImageLayer.model_validate(
                        values["edit_layer"]
                    )
                    params["edit_layer"] = edit_layer.model_dump(mode="json")
            else:
                params["source_asset_id"] = asset_ids_by_handle["image"][0]
            _validate_resolved_image_params(params)
        elif isinstance(node, LayerCanvasNode):
            layer_set = AigcLayerSet.model_validate(values["layers"])
            _validate_layer_canvas_source(node, layer_set)
            params["input_layer_set"] = layer_set.model_dump(mode="json")
            params["upstream_layer_set"] = _layer_set_summary(layer_set)
        elif isinstance(node, LayerCompositeNode):
            layer_set = AigcLayerSet.model_validate(values["layers"])
            replacement = AigcEditedLayer.model_validate(values["replacement"])
            _validate_layer_composite_source(layer_set, replacement)
            params["input_layer_set"] = layer_set.model_dump(mode="json")
            params["replacement"] = replacement.model_dump(mode="json")
        elif isinstance(node, VideoGenerationNode):
            params.update(
                {
                    "prompt": str(values.get("prompt") or ""),
                    "first_frame_asset_id": values.get("first_frame"),
                    "last_frame_asset_id": values.get("last_frame"),
                    "reference_image_asset_ids": asset_ids_by_handle[
                        "reference_images"
                    ],
                    "reference_video_asset_ids": asset_ids_by_handle[
                        "reference_videos"
                    ],
                    "reference_audio_asset_ids": asset_ids_by_handle[
                        "reference_audios"
                    ],
                }
            )
            _validate_resolved_video_params(params)
        else:
            params["prompt"] = values["prompt"]
        return params, upstream_ids

    def _hash_resolved_task(
        self,
        node,
        params,
        edges,
        node_by_id,
        run_node_by_id,
    ) -> str:
        upstream = []
        target_ordinals: dict[str, int] = defaultdict(int)
        for edge in edges:
            source = node_by_id[edge.source_node_id]
            if isinstance(source, TextInputNode):
                digest = _sha256(
                    str(params.get("prompt", source.config.text))
                    if edge.target_handle == "prompt"
                    else source.config.text
                )
            elif isinstance(source, ASSET_INPUT_NODE_TYPES):
                digest = self._asset_digest(source.config.asset_id or "")
            else:
                digest = _result_port_digest(
                    run_node_by_id[source.id].result,
                    edge.source_handle,
                )
            upstream.append(
                AigcUpstreamDigest(
                    target_handle=edge.target_handle,
                    source_node_id=edge.source_node_id,
                    source_handle=edge.source_handle,
                    digest=digest,
                    ordinal=(
                        target_ordinals[edge.target_handle]
                        if edge.target_handle
                        in ORDERED_MULTI_INPUT_HANDLES.get(
                            node.type.value,
                            set(),
                        )
                        else None
                    ),
                )
            )
            target_ordinals[edge.target_handle] += 1
        config = node.config.model_dump(mode="json")
        if (
            isinstance(node, VideoGenerationNode)
            and node.config.generation_mode
            != AigcVideoGenerationMode.MULTIMODAL_REFERENCE
        ):
            config["task_type"] = "generate"
        return canonical_aigc_input_hash(
            node_type=node.type,
            executor_version=_executor_version(node),
            model=str(params.get("model", "")),
            config=config,
            upstream=upstream,
        )

    def _asset_digest(self, asset_id: str) -> str:
        asset = self.repository.get_asset(asset_id)
        return _sha256(
            "|".join(
                [
                    asset.id,
                    asset.object_key or "",
                    str(asset.size_bytes or 0),
                    asset.updated_at.isoformat(),
                ]
            )
        )

    async def _project_outputs(self, run_id: str) -> None:
        detail = self.repository.get_aigc_run(run_id)
        node_by_id = {
            node.id: node for node in detail.run.definition_snapshot.nodes
        }
        run_node_by_id = {node.node_id: node for node in detail.nodes}
        incoming = defaultdict(list)
        for edge in detail.run.definition_snapshot.edges:
            incoming[edge.target_node_id].append(edge)
        for node_id, node in node_by_id.items():
            if node.type.value not in {
                "text_output",
                "image_output",
                "video_output",
            }:
                continue
            run_node = run_node_by_id[node_id]
            if not run_node.included_in_plan or run_node.status != AigcRunNodeStatus.IDLE:
                continue
            source_edges = incoming[node_id]
            sources = [
                run_node_by_id[edge.source_node_id] for edge in source_edges
            ]
            unavailable_dependencies = [
                source
                for source in sources
                if not source.included_in_plan
                and source.status not in SUCCESS_NODE_STATUSES
            ]
            if unavailable_dependencies:
                dependency_ids = ", ".join(
                    sorted(source.node_id for source in unavailable_dependencies)
                )
                error = AigcTaskError(
                    code="invalid_input",
                    message=(
                        f"Invalid input for AIGC node '{node_id}': execution plan "
                        f"excludes required upstream node(s): {dependency_ids}"
                    ),
                    stage="scheduling",
                )
                self.repository.update_aigc_run_node(
                    run_id,
                    node_id,
                    status=AigcRunNodeStatus.BLOCKED,
                    error=error,
                )
                self.repository.update_aigc_run(run_id, error=error)
            elif any(source.status in FAILED_NODE_STATUSES for source in sources):
                self.repository.update_aigc_run_node(
                    run_id,
                    node_id,
                    status=AigcRunNodeStatus.BLOCKED,
                )
            elif sources and all(
                source.status in SUCCESS_NODE_STATUSES for source in sources
            ):
                self.repository.update_aigc_run_node(
                    run_id,
                    node_id,
                    status=AigcRunNodeStatus.SUCCEEDED,
                    result=_project_result_for_port(
                        sources[0].result,
                        source_edges[0].source_handle,
                    ),
                )

    async def _finalize_run(self, run_id: str) -> None:
        detail = self.repository.get_aigc_run(run_id)
        planned = [
            node
            for node in detail.nodes
            if node.included_in_plan
        ]
        if any(
            node.status
            in {
                AigcRunNodeStatus.IDLE,
                AigcRunNodeStatus.READY,
                AigcRunNodeStatus.QUEUED,
                AigcRunNodeStatus.RUNNING,
            }
            for node in planned
        ):
            return
        if detail.run.cancellation_requested:
            status = AigcPipelineRunStatus.CANCELED
        elif any(node.status in FAILED_NODE_STATUSES for node in planned):
            status = AigcPipelineRunStatus.FAILED
        else:
            status = AigcPipelineRunStatus.SUCCEEDED
        if detail.run.status != status:
            self.repository.update_aigc_run(
                run_id,
                status=status,
                finished_at=utc_now(),
            )

    async def _enqueue(self, task_id: str) -> None:
        if task_id in self._enqueued:
            return
        try:
            self.queue.put_nowait(task_id)
        except asyncio.QueueFull:
            return
        self._enqueued.add(task_id)

    async def _enqueue_queued_tasks(self) -> None:
        for task in self.repository.list_aigc_task_attempts(
            statuses={AigcTaskStatus.QUEUED}
        ):
            await self._enqueue(task.task_id)

    async def _recover_interrupted_tasks(self) -> None:
        affected_run_ids: set[str] = set()
        for task in self.repository.list_aigc_task_attempts(
            statuses={AigcTaskStatus.RUNNING}
        ):
            self.repository.update_aigc_task_attempt(
                task.task_id,
                status=AigcTaskStatus.FAILED,
                error=AigcTaskError(
                    code="worker_interrupted",
                    message="AIGC worker stopped before completing the task",
                    stage="recovery",
                ),
                finished_at=utc_now(),
            )
            affected_run_ids.add(task.run_id)
        for run_id in affected_run_ids:
            await self._schedule_ready_nodes(run_id)
            await self._finalize_run(run_id)

    async def _heartbeat_loop(self) -> None:
        lease_lost = False
        try:
            while True:
                await asyncio.sleep(max(1, self.lease_seconds // 3))
                token = self._lease_token
                if token is None:
                    lease_lost = True
                    return
                lease = self.repository.renew_aigc_worker_lease(
                    self.owner_id,
                    token,
                    now=utc_now(),
                    lease_seconds=self.lease_seconds,
                )
                if lease is None:
                    lease_lost = True
                    return
                await self._enqueue_queued_tasks()
        except asyncio.CancelledError:
            raise
        except Exception:
            lease_lost = True
            logger.exception(
                "AIGC worker lease heartbeat failed",
                extra={"aigc_worker_owner_id": self.owner_id},
            )
        finally:
            if self._heartbeat is asyncio.current_task():
                self._heartbeat = None
            if lease_lost and not self._stopping:
                await self._handle_lease_loss()

    async def _handle_lease_loss(self) -> None:
        async with self._start_lock:
            self._lease_token = None
            workers = [task for task in self._workers if not task.done()]
            for task in workers:
                task.cancel()
            for task in workers:
                with suppress(asyncio.CancelledError):
                    await task
            self._workers.clear()
            self._ensure_lease_retry()

    def _ensure_lease_retry(self) -> None:
        if self._stopping:
            return
        if self._lease_retry is not None and not self._lease_retry.done():
            return
        self._lease_retry = asyncio.create_task(self._lease_retry_loop())

    async def _lease_retry_loop(self) -> None:
        try:
            while not self._stopping:
                await asyncio.sleep(self.lease_retry_seconds)
                if await self.start():
                    return
        except asyncio.CancelledError:
            raise
        finally:
            if self._lease_retry is asyncio.current_task():
                self._lease_retry = None

    async def _worker(self, _index: int) -> None:
        while True:
            task_id = await self.queue.get()
            self._enqueued.discard(task_id)
            try:
                try:
                    await self._process_task(task_id)
                except Exception:
                    logger.exception(
                        "Unhandled AIGC worker item error",
                        extra={"aigc_task_id": task_id},
                    )
                    await self._isolate_worker_item_failure(task_id)
            finally:
                self.queue.task_done()

    async def _isolate_worker_item_failure(self, task_id: str) -> None:
        try:
            task = self.repository.get_aigc_task_attempt(task_id)
            if task.status in {
                AigcTaskStatus.QUEUED,
                AigcTaskStatus.RUNNING,
            }:
                self.repository.update_aigc_task_attempt(
                    task_id,
                    status=AigcTaskStatus.FAILED,
                    error=AigcTaskError(
                        code="worker_error",
                        message="AIGC worker failed",
                        stage="worker",
                    ),
                    finished_at=utc_now(),
                )
            await self._schedule_ready_nodes(task.run_id)
            await self._finalize_run(task.run_id)
        except Exception:
            logger.exception(
                "Failed to converge AIGC worker item after an unhandled error",
                extra={"aigc_task_id": task_id},
            )

    async def _process_task(self, task_id: str) -> None:
        token = self._lease_token
        if token is None:
            return
        task = self.repository.claim_aigc_task_attempt(
            task_id,
            fencing_token=token,
        )
        if task is None:
            return
        semaphore = (
            self._llm_semaphore
            if task.type == AigcTaskType.LLM
            else (
                self._video_semaphore
                if task.type == AigcTaskType.VIDEO_GENERATION
                else self._image_semaphore
            )
        )
        try:
            async with semaphore:
                if task.type == AigcTaskType.LAYER_CANVAS:
                    execution = _execute_layer_canvas(task)
                    self._record_layer_canvas_assets(task, execution.result)
                else:
                    execution = await self.gateway.execute(task)
            committed, accepted = self.repository.commit_aigc_task_attempt(
                task.task_id,
                fencing_token=token,
                status=AigcTaskStatus.SUCCEEDED,
                result=execution.result,
                error=None,
                metrics=execution.metrics,
            )
            if not accepted:
                await self._cleanup_task_outputs(task.task_id)
        except AigcGatewayError as exc:
            committed, accepted = self.repository.commit_aigc_task_attempt(
                task.task_id,
                fencing_token=token,
                status=(
                    AigcTaskStatus.TIMED_OUT
                    if exc.error.code == "timeout"
                    else AigcTaskStatus.FAILED
                ),
                result=AigcTaskResult(),
                error=exc.error,
                metrics=AigcTaskMetrics(),
            )
            if accepted and exc.retryable and task.attempt < 3:
                try:
                    retry = self.repository.create_aigc_task_attempt(
                        AigcPipelineTaskAttempt(
                            pipeline_id=task.pipeline_id,
                            run_id=task.run_id,
                            node_id=task.node_id,
                            type=task.type,
                            params=task.params,
                            upstream=task.upstream,
                        ),
                        idempotency_key=(
                            f"{task.run_id}:{task.node_id}:attempt:{task.attempt + 1}"
                        ),
                        retry_of_task_id=task.task_id,
                    )
                except Exception as create_exc:
                    self._record_scheduling_failure(
                        task.run_id,
                        task.node_id,
                        create_exc,
                    )
                else:
                    await self._enqueue(retry.task_id)
        except Exception as exc:
            # #region debug-point E:worker-exception
            import re

            debug_traceback = exc.__traceback__
            while debug_traceback is not None and debug_traceback.tb_next is not None:
                debug_traceback = debug_traceback.tb_next
            _debug_layer_canvas_worker(
                "E",
                "aigc_executor.py:_process_task",
                "Worker caught an unexpected task exception",
                {
                    "run_id": task.run_id,
                    "task_id": task.task_id,
                    "task_type": task.type.value,
                    "exception_type": type(exc).__name__,
                    "message": re.sub(
                        r"https?://\S+|(?i:(?:password|token|secret|authorization)=\S+)",
                        "[redacted]",
                        str(exc),
                    )[:240],
                    "exception_location": (
                        f"{debug_traceback.tb_frame.f_code.co_name}:"
                        f"{debug_traceback.tb_lineno}"
                        if debug_traceback is not None
                        else None
                    ),
                },
            )
            # #endregion
            self.repository.commit_aigc_task_attempt(
                task.task_id,
                fencing_token=token,
                status=AigcTaskStatus.FAILED,
                result=AigcTaskResult(),
                error=AigcTaskError(
                    code="worker_error",
                    message="AIGC worker failed",
                    stage="worker",
                ),
                metrics=AigcTaskMetrics(),
            )
        await self._schedule_ready_nodes(task.run_id)
        await self._finalize_run(task.run_id)

    async def _cleanup_task_outputs(self, task_id: str) -> None:
        task = self.repository.get_aigc_task_attempt(task_id)
        references = self.repository.remove_aigc_task_assets(
            task_id,
            direction=AigcAssetDirection.OUTPUT,
        )
        if task.type == AigcTaskType.LAYER_CANVAS:
            return
        for reference in references:
            with suppress(NotFoundError):
                asset = self.repository.get_asset(reference.asset_id)
                owner_task_id = asset.metadata.get("task_id") or asset.source_task_id
                if owner_task_id is not None and owner_task_id != task_id:
                    continue
                self.gateway.asset_storage.delete_asset_objects(asset)
                self.repository.delete_tool_asset(asset.id)

    def _record_layer_canvas_assets(
        self,
        task: AigcPipelineTaskAttempt,
        result: AigcTaskResult,
    ) -> None:
        source = AigcLayerSet.model_validate(task.params["input_layer_set"])
        derived = result.layer_set
        if derived is None:
            raise ValueError("layer canvas result requires a layer set")
        references = [
            *_layer_set_asset_references(
                task.task_id,
                source,
                direction=AigcAssetDirection.INPUT,
            ),
            *_layer_set_asset_references(
                task.task_id,
                derived,
                direction=AigcAssetDirection.OUTPUT,
            ),
        ]
        self.repository.add_aigc_task_assets(references)
        # #region debug-point D:layer-canvas-task-relationships
        _debug_layer_canvas_worker(
            "D",
            "aigc_executor.py:_record_layer_canvas_assets",
            "Layer canvas task asset relationships persisted",
            {
                "run_id": task.run_id,
                "task_id": task.task_id,
                "relationship_count": len(references),
                "input_count": sum(
                    reference.direction == AigcAssetDirection.INPUT
                    for reference in references
                ),
                "output_count": sum(
                    reference.direction == AigcAssetDirection.OUTPUT
                    for reference in references
                ),
            },
        )
        # #endregion

    def _result_available(self, result: AigcTaskResult) -> bool:
        if result.kind == AigcResultKind.TEXT:
            return result.text is not None
        asset_ids = _result_asset_ids(result)
        if not asset_ids:
            return False
        for asset_id in asset_ids:
            try:
                asset = self.repository.get_asset(asset_id)
            except NotFoundError:
                return False
            if asset.status != Status.SUCCEEDED:
                return False
        return True


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _executor_version(node: AigcNode) -> str:
    if isinstance(node, LlmNode):
        return AIGC_LLM_EXECUTOR_VERSION
    if isinstance(node, VideoGenerationNode):
        return AIGC_VIDEO_EXECUTOR_VERSION
    if isinstance(node, (LayerCanvasNode, LayerCompositeNode)):
        return AIGC_LAYER_EXECUTOR_VERSION
    return AIGC_IMAGE_EXECUTOR_VERSION


def _task_type(node: AigcNode) -> AigcTaskType:
    if isinstance(node, ImageToImageNode):
        return {
            "image_to_image": AigcTaskType.IMAGE_TO_IMAGE,
            "image_edit": AigcTaskType.IMAGE_EDIT,
            "layer_decomposition": AigcTaskType.LAYER_DECOMPOSITION,
        }[node.config.operation]
    return STATIC_TASK_TYPES[node.type.value]


def _validate_resolved_image_params(params: dict[str, object]) -> None:
    operation = str(params["operation"])
    prompt = str(params.get("prompt") or "").strip()
    if operation != "layer_decomposition" and not prompt:
        raise ValueError(f"{operation} requires a non-empty prompt")
    if operation == "image_to_image":
        references = list(params.get("reference_asset_ids") or [])
        if not 1 <= len(references) <= 10:
            raise ValueError("image_to_image requires 1 to 10 reference assets")
    elif operation == "image_edit":
        has_image = bool(params.get("edit_image_asset_id"))
        has_layer = bool(params.get("edit_layer"))
        if has_image == has_layer:
            raise ValueError(
                "image_edit requires exactly one of edit_image or edit_layer"
            )
    elif not params.get("source_asset_id"):
        raise ValueError("layer_decomposition requires a source asset")


def _validate_layer_canvas_source(
    node: LayerCanvasNode,
    layer_set: AigcLayerSet,
) -> None:
    source = node.config.source_layer_set
    if source is not None and (
        source.id != layer_set.id
        or source.version != layer_set.version
        or source.digest != layer_set.digest
    ):
        raise ValueError("layer canvas draft source is stale")
    selected_layer_id = node.config.selected_layer_id
    if selected_layer_id is None:
        selected = None
    elif selected_layer_id == layer_set.base_asset_id:
        raise ValueError("base layer cannot be selected")
    else:
        selected = next(
            (layer for layer in layer_set.layers if layer.id == selected_layer_id),
            None,
        )
    deleted = any(
        patch.layer_id == selected_layer_id and patch.deleted is True
        for patch in node.config.transform_patches
    )
    if selected_layer_id is not None and (selected is None or deleted):
        raise ValueError("selected layer is unavailable")
    layer_ids = {layer.id for layer in layer_set.layers}
    for patch in node.config.transform_patches:
        if patch.layer_id == layer_set.base_asset_id:
            raise ValueError("base layer cannot be transformed")
        if patch.layer_id not in layer_ids:
            raise ValueError("layer transform target is unavailable")


def _execute_layer_canvas(
    task: AigcPipelineTaskAttempt,
) -> AigcGatewayExecution:
    # #region debug-point C:layer-canvas-entry
    _debug_layer_canvas_worker(
        "C",
        "aigc_executor.py:_execute_layer_canvas",
        "Entered local layer canvas execution",
        {
            "run_id": task.run_id,
            "task_id": task.task_id,
        },
    )
    # #endregion
    layer_set = AigcLayerSet.model_validate(task.params["input_layer_set"])
    patch_payloads = task.params.get("transform_patches") or []
    layer_ids = {layer.id for layer in layer_set.layers}
    selected_layer_id = task.params.get("selected_layer_id")
    # #region debug-point A-B:layer-canvas-source
    _debug_layer_canvas_worker(
        "A-B",
        "aigc_executor.py:_execute_layer_canvas",
        "Parsed layer canvas source and selection",
        {
            "run_id": task.run_id,
            "task_id": task.task_id,
            "source_id": layer_set.id,
            "source_version": layer_set.version,
            "source_digest": layer_set.digest,
            "selected_layer_id": selected_layer_id,
            "patch_count": len(patch_payloads),
            "patches": [
                {
                    "layer_id": str(patch.get("layer_id")),
                    "fields": sorted(
                        key
                        for key in patch
                        if key
                        in {"x", "y", "scale", "z_index", "visible", "deleted"}
                    ),
                    "deleted": patch.get("deleted") is True,
                }
                for patch in patch_payloads
                if isinstance(patch, dict)
            ][:50],
        },
    )
    # #endregion
    if selected_layer_id == layer_set.base_asset_id:
        raise ValueError("base layer cannot be selected")
    patches = {
        str(patch["layer_id"]): patch
        for patch in patch_payloads
        if isinstance(patch, dict)
    }
    for layer_id, patch in patches.items():
        if layer_id == layer_set.base_asset_id:
            raise ValueError("base layer cannot be transformed")
        if layer_id not in layer_ids:
            raise ValueError("layer transform target is unavailable")
        if layer_id == selected_layer_id and patch.get("deleted") is True:
            raise ValueError("selected layer is unavailable")
    if selected_layer_id is not None and selected_layer_id not in layer_ids:
        raise ValueError("selected layer is unavailable")

    ordered_layers = list(layer_set.layers)
    for patch_payload in patch_payloads:
        if not isinstance(patch_payload, dict):
            raise ValueError("layer transform patch must be an object")
        layer_id = str(patch_payload["layer_id"])
        if patch_payload.get("deleted") is True:
            ordered_layers = [
                layer for layer in ordered_layers if layer.id != layer_id
            ]
            continue
        target_index = patch_payload.get("z_index")
        if target_index is None:
            continue
        current_index = next(
            (
                index
                for index, layer in enumerate(ordered_layers)
                if layer.id == layer_id
            ),
            None,
        )
        if current_index is None:
            raise ValueError("layer transform target is unavailable")
        moved = ordered_layers.pop(current_index)
        ordered_layers.insert(
            min(int(target_index) - 1, len(ordered_layers)),
            moved,
        )

    derived_layers: list[AigcLayer] = []
    for z_index, layer in enumerate(ordered_layers, start=1):
        patch = patches.get(layer.id, {})
        derived_layers.append(
            layer.model_copy(
                update={
                    "x": layer.x if patch.get("x") is None else patch["x"],
                    "y": layer.y if patch.get("y") is None else patch["y"],
                    "scale": (
                        layer.scale
                        if patch.get("scale") is None
                        else patch["scale"]
                    ),
                    "visible": (
                        layer.visible
                        if patch.get("visible") is None
                        else patch["visible"]
                    ),
                    "z_index": z_index,
                },
                deep=True,
            )
        )

    digest = _layer_set_digest(
        source_asset_id=layer_set.source_asset_id,
        base_asset_id=layer_set.base_asset_id,
        canvas_width=layer_set.canvas_width,
        canvas_height=layer_set.canvas_height,
        layers=derived_layers,
    )
    derived = AigcLayerSet(
        id=str(uuid4()),
        parent_layer_set_id=layer_set.id,
        source_asset_id=layer_set.source_asset_id,
        base_asset_id=layer_set.base_asset_id,
        canvas_width=layer_set.canvas_width,
        canvas_height=layer_set.canvas_height,
        version=layer_set.version + 1,
        digest=digest,
        layers=tuple(derived_layers),
    )
    selected = next(
        (
            layer
            for layer in derived.layers
            if layer.id == selected_layer_id
        ),
        None,
    )
    image_layer = (
        AigcImageLayer(
            asset_id=selected.asset_id,
            layer_set_id=derived.id,
            layer_set_version=derived.version,
            layer_set_digest=derived.digest,
            layer_id=selected.id,
            bbox_absolute=selected.bbox_absolute,
            bbox_normalized=selected.bbox_normalized,
            x=selected.x,
            y=selected.y,
            scale=selected.scale,
            z_index=selected.z_index,
        )
        if selected is not None
        else None
    )
    # #region debug-point C:layer-canvas-exit
    _debug_layer_canvas_worker(
        "C",
        "aigc_executor.py:_execute_layer_canvas",
        "Exited local layer canvas execution",
        {
            "run_id": task.run_id,
            "task_id": task.task_id,
            "derived_id": derived.id,
            "derived_version": derived.version,
            "derived_digest": derived.digest,
            "derived_layer_count": len(derived.layers),
            "selected_layer_id": selected.id if selected is not None else None,
        },
    )
    # #endregion
    return AigcGatewayExecution(
        result=AigcTaskResult(
            kind=AigcResultKind.LAYER_CANVAS,
            layer_set=derived,
            image_layer=image_layer,
        ),
        metrics=AigcTaskMetrics(),
        executor_version=AIGC_LAYER_EXECUTOR_VERSION,
    )


def _layer_set_digest(
    *,
    source_asset_id: str,
    base_asset_id: str,
    canvas_width: int,
    canvas_height: int,
    layers: list[AigcLayer],
) -> str:
    return _structured_digest(
        {
            "source_asset_id": source_asset_id,
            "base_asset_id": base_asset_id,
            "canvas_width": canvas_width,
            "canvas_height": canvas_height,
            "layers": [
                layer.model_dump(mode="json")
                for layer in layers
            ],
        }
    )


def _layer_set_summary(layer_set: AigcLayerSet) -> dict[str, object]:
    return {
        "id": layer_set.id,
        "version": layer_set.version,
        "digest": layer_set.digest,
    }


def _layer_set_summary_digest(layer_set: AigcLayerSet) -> str:
    return _structured_digest(_layer_set_summary(layer_set))


def _validate_layer_composite_source(
    layer_set: AigcLayerSet,
    replacement: AigcEditedLayer,
) -> None:
    if (
        replacement.layer_set_id != layer_set.id
        or replacement.layer_set_version != layer_set.version
        or replacement.layer_set_digest != layer_set.digest
    ):
        raise ValueError("edited layer source does not match the layer set")
    source_layer = next(
        (layer for layer in layer_set.layers if layer.id == replacement.layer_id),
        None,
    )
    if source_layer is None:
        raise ValueError("edited layer does not exist in the layer set")
    source_width = source_layer.bbox_absolute[2] - source_layer.bbox_absolute[0]
    source_height = source_layer.bbox_absolute[3] - source_layer.bbox_absolute[1]
    replacement_width = (
        replacement.bbox_absolute[2] - replacement.bbox_absolute[0]
    )
    replacement_height = (
        replacement.bbox_absolute[3] - replacement.bbox_absolute[1]
    )
    if (source_width, source_height) != (replacement_width, replacement_height):
        raise ValueError("edited layer pixel dimensions do not match")


def _validate_resolved_video_params(params: dict[str, object]) -> None:
    mode = AigcVideoGenerationMode(str(params["generation_mode"]))
    prompt = str(params.get("prompt") or "").strip()
    first_frame = params.get("first_frame_asset_id")
    last_frame = params.get("last_frame_asset_id")
    reference_images = list(params.get("reference_image_asset_ids") or [])
    reference_videos = list(params.get("reference_video_asset_ids") or [])
    reference_audios = list(params.get("reference_audio_asset_ids") or [])
    model = str(params["model"])
    task_type = str(params.get("task_type") or "generate")

    if mode == AigcVideoGenerationMode.TEXT_TO_VIDEO:
        if not prompt:
            raise ValueError("text_to_video requires a non-empty prompt")
        if (
            first_frame
            or last_frame
            or reference_images
            or reference_videos
            or reference_audios
        ):
            raise ValueError("text_to_video does not accept media inputs")
    elif mode == AigcVideoGenerationMode.FIRST_FRAME:
        if not first_frame:
            raise ValueError("first_frame requires a first frame asset")
        if last_frame or reference_images or reference_videos or reference_audios:
            raise ValueError("first_frame contains incompatible media inputs")
    elif mode == AigcVideoGenerationMode.FIRST_LAST_FRAME:
        if not first_frame or not last_frame:
            raise ValueError("first_last_frame requires first and last frame assets")
        if reference_images or reference_videos or reference_audios:
            raise ValueError("first_last_frame contains reference media inputs")
    else:
        if first_frame or last_frame:
            raise ValueError("multimodal_reference does not accept frame inputs")
        if not prompt and not (
            reference_images or reference_videos or reference_audios
        ):
            raise ValueError(
                "multimodal_reference requires a prompt or reference asset"
            )
        if (
            model != SEEDANCE_DEFAULT_MODEL
            and reference_audios
            and not (reference_images or reference_videos)
        ):
            raise ValueError(f"{model} does not support audio-only input")
        if task_type in {"edit", "extend"} and not reference_videos:
            raise ValueError(
                f"{task_type} requires at least one reference video"
            )

    if mode != AigcVideoGenerationMode.MULTIMODAL_REFERENCE:
        params["task_type"] = "generate"

    validate_seedance_reference_counts(
        model,  # type: ignore[arg-type]
        reference_image_count=len(reference_images),
        reference_video_count=len(reference_videos),
        reference_audio_count=len(reference_audios),
    )


def _compile_bbox_prompt(
    source: TextInputNode,
    *,
    target_node_id: str,
    edges: list[AigcEdge],
    node_by_id: dict[str, AigcNode],
) -> str:
    if not source.config.bbox_references:
        return source.config.text

    image_ordinals = {
        edge.source_node_id: index
        for index, edge in enumerate(
            edge
            for edge in edges
            if edge.target_node_id == target_node_id
            and edge.target_handle == "image"
        )
    }
    segments = [source.config.text.strip()]
    for reference in source.config.bbox_references:
        image = node_by_id[reference.source_node_id]
        if not isinstance(image, ImageInputNode) or image.config.bbox is None:
            raise ValueError(
                f"bbox reference source is unavailable: {reference.source_node_id}"
            )
        ordinal = image_ordinals.get(image.id)
        if ordinal is None:
            raise ValueError(
                f"bbox reference source is not connected: {reference.source_node_id}"
            )
        bbox = image.config.bbox
        segments.append(
            f"图{ordinal + 1}<bbox>"
            f"{bbox.x1} {bbox.y1} {bbox.x2} {bbox.y2}</bbox>"
        )
        instruction = reference.instruction.strip()
        if instruction:
            segments.append(instruction)
    return " ".join(segment for segment in segments if segment)


def _result_digest(result: AigcTaskResult) -> str:
    if result.kind == AigcResultKind.TEXT and result.text_digest:
        return result.text_digest
    if result.layer_set is not None:
        return result.layer_set.digest
    if result.image_layer is not None:
        return _structured_digest(result.image_layer.model_dump(mode="json"))
    if result.edited_layer is not None:
        return _structured_digest(result.edited_layer.model_dump(mode="json"))
    if result.assets:
        return _sha256(
            "|".join(
                item.asset_id
                for item in sorted(result.assets, key=lambda item: item.ordinal)
                if item.available
            )
        )
    return _sha256(result.kind.value)


def _result_port_digest(result: AigcTaskResult, source_handle: str) -> str:
    if source_handle == "layers" and result.layer_set is not None:
        return _layer_set_summary_digest(result.layer_set)
    if source_handle == "selected_layer" and result.image_layer is not None:
        return _structured_digest(result.image_layer.model_dump(mode="json"))
    if source_handle == "edited_layer" and result.edited_layer is not None:
        return _structured_digest(result.edited_layer.model_dump(mode="json"))
    try:
        projected = _project_result_for_port(result, source_handle)
    except ValueError:
        return _sha256(f"{result.kind.value}:{source_handle}:unavailable")
    return _result_digest(projected)


def _structured_digest(value: dict[str, object]) -> str:
    return _sha256(
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
    )


def _result_value_for_port(
    result: AigcTaskResult,
    source_handle: str,
    source_node_id: str,
) -> object:
    if source_handle == "text" and result.text is not None:
        return result.text
    if source_handle in {"image", "video"}:
        available = next(
            (item for item in result.assets if item.available),
            None,
        )
        if available is not None:
            return available.asset_id
    if source_handle == "layers" and result.layer_set is not None:
        return result.layer_set.model_dump(mode="json")
    if source_handle == "selected_layer" and result.image_layer is not None:
        return result.image_layer.model_dump(mode="json")
    if source_handle == "edited_layer" and result.edited_layer is not None:
        return result.edited_layer.model_dump(mode="json")
    raise ValueError(f"upstream result is unavailable: {source_node_id}")


def _project_result_for_port(
    result: AigcTaskResult,
    source_handle: str,
) -> AigcTaskResult:
    if source_handle == "text" and result.text is not None:
        return AigcTaskResult(
            kind=AigcResultKind.TEXT,
            text=result.text,
            text_digest=result.text_digest,
        )
    if source_handle in {"image", "video"}:
        return AigcTaskResult(
            kind=AigcResultKind.ASSETS,
            assets=[item for item in result.assets if item.available],
        )
    if source_handle == "layers" and result.layer_set is not None:
        return AigcTaskResult(
            kind=AigcResultKind.LAYER_SET,
            layer_set=result.layer_set,
        )
    if source_handle == "selected_layer" and result.image_layer is not None:
        return AigcTaskResult(
            kind=AigcResultKind.IMAGE_LAYER,
            image_layer=result.image_layer,
        )
    if source_handle == "edited_layer" and result.edited_layer is not None:
        return AigcTaskResult(
            kind=AigcResultKind.EDITED_LAYER,
            edited_layer=result.edited_layer,
        )
    raise ValueError(f"result does not contain output port {source_handle}")


def _result_asset_ids(result: AigcTaskResult) -> set[str]:
    asset_ids = {
        item.asset_id for item in result.assets if item.available
    }
    if result.layer_set is not None:
        asset_ids.add(result.layer_set.base_asset_id)
        asset_ids.update(layer.asset_id for layer in result.layer_set.layers)
    if result.image_layer is not None:
        asset_ids.add(result.image_layer.asset_id)
    if result.edited_layer is not None:
        asset_ids.add(result.edited_layer.asset_id)
    return asset_ids


def _layer_set_asset_references(
    task_id: str,
    layer_set: AigcLayerSet,
    *,
    direction: AigcAssetDirection,
) -> list[AigcPipelineTaskAssetReference]:
    return [
        AigcPipelineTaskAssetReference(
            task_id=task_id,
            direction=direction,
            slot="base",
            ordinal=0,
            asset_id=layer_set.base_asset_id,
        ),
        *[
            AigcPipelineTaskAssetReference(
                task_id=task_id,
                direction=direction,
                slot="layers",
                ordinal=ordinal,
                asset_id=layer.asset_id,
            )
            for ordinal, layer in enumerate(
                sorted(layer_set.layers, key=lambda item: item.z_index)
            )
        ],
    ]
