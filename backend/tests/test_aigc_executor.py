from __future__ import annotations

import asyncio

import pytest

import backend.app.services.aigc_executor as executor_module
from backend.app.repositories import (
    ActiveRunConflictError,
    InMemoryRepository,
    NotFoundError,
)
from backend.app.schemas import (
    AigcAssetDirection,
    AigcEditedLayer,
    AigcImageLayer,
    AigcLayerSet,
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineDefinitionV2,
    AigcPipelineRun,
    AigcPipelineRunCreate,
    AigcPipelineRunMode,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
    AigcPipelineUpdate,
    AigcPipelineTaskAttempt,
    AigcPipelineTaskAssetReference,
    AigcResultAsset,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskError,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcTaskStatus,
    AigcTaskType,
    AssetCreate,
    AssetType,
    Status,
    ToolAssetRole,
)
from backend.app.services.aigc_executor import (
    AIGC_LAYER_EXECUTOR_VERSION,
    AIGC_VIDEO_EXECUTOR_VERSION,
    AigcPipelineRuntime,
    AigcResolvedInputError,
    _compile_bbox_prompt,
    _execute_layer_canvas,
    _project_result_for_port,
    _task_type,
    _validate_layer_composite_source,
)
from backend.app.services.aigc_gateway import (
    AIGC_IMAGE_EXECUTOR_VERSION,
    AIGC_VIDEO_FACE_BLUR_EXECUTOR_VERSION,
    AIGC_VIDEO_ENHANCEMENT_EXECUTOR_VERSION,
    AigcGatewayError,
    AigcGatewayExecution,
)
from backend.app.services.aigc_pipeline import canonicalize_aigc_definition


def node(node_id: str, node_type: str, x: int, *, config=None):
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": x, "y": 0},
        "size": {"width": 240, "height": 180},
        "config": config or {},
    }


def edge(edge_id: str, source: str, source_handle: str, target: str, target_handle: str):
    return {
        "id": edge_id,
        "sourceNodeId": source,
        "sourceHandle": source_handle,
        "targetNodeId": target,
        "targetHandle": target_handle,
    }


def chain_definition(
    *,
    image_size: str = "2K",
) -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("input", "text_input", 0, config={"text": "商品"}),
                node("llm", "llm", 300),
                node(
                    "image",
                    "text_to_image",
                    600,
                    config={"size": image_size},
                ),
                node("output", "image_output", 900),
            ],
            "edges": [
                edge("e1", "input", "text", "llm", "prompt"),
                edge("e2", "llm", "text", "image", "prompt"),
                edge("e3", "image", "image", "output", "image"),
            ],
        }
    )


def branching_definition() -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("input", "text_input", 0, config={"text": "商品"}),
                node("first", "llm", 300),
                node("second", "llm", 300),
            ],
            "edges": [
                edge("e1", "input", "text", "first", "prompt"),
                edge("e2", "input", "text", "second", "prompt"),
            ],
        }
    )


def disconnected_llm_definition() -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("flow-a-input", "text_input", 0, config={"text": "流程 A"}),
                node("flow-a-model", "llm", 300),
                node("flow-b-input", "text_input", 0, config={"text": "流程 B"}),
                node("flow-b-model", "llm", 300),
            ],
            "edges": [
                edge(
                    "flow-a-edge",
                    "flow-a-input",
                    "text",
                    "flow-a-model",
                    "prompt",
                ),
                edge(
                    "flow-b-edge",
                    "flow-b-input",
                    "text",
                    "flow-b-model",
                    "prompt",
                ),
            ],
        }
    )


def shared_upstream_llm_definition() -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("shared-input", "text_input", 0, config={"text": "共享"}),
                node("shared-model", "llm", 300),
                node("branch-a-model", "llm", 600),
                node("branch-b-model", "llm", 600),
            ],
            "edges": [
                edge(
                    "shared-input-model",
                    "shared-input",
                    "text",
                    "shared-model",
                    "prompt",
                ),
                edge(
                    "shared-branch-a",
                    "shared-model",
                    "text",
                    "branch-a-model",
                    "prompt",
                ),
                edge(
                    "shared-branch-b",
                    "shared-model",
                    "text",
                    "branch-b-model",
                    "prompt",
                ),
            ],
        }
    )


class FakeGateway:
    def __init__(
        self,
        *,
        retry_first: bool = False,
        fail_node: str | None = None,
        error_code_by_node: dict[str, str] | None = None,
        results_by_node: dict[str, AigcTaskResult] | None = None,
        result_assets_by_node: dict[str, list[AigcResultAsset]] | None = None,
    ):
        self.retry_first = retry_first
        self.fail_node = fail_node
        self.error_code_by_node = error_code_by_node or {}
        self.results_by_node = results_by_node or {}
        self.result_assets_by_node = result_assets_by_node or {}
        self.calls: dict[str, int] = {}
        self.tasks = []
        self.active = 0
        self.max_active = 0
        self.asset_storage = _NoopAssetStorage()

    async def execute(self, task) -> AigcGatewayExecution:
        self.tasks.append(task)
        self.calls[task.node_id] = self.calls.get(task.node_id, 0) + 1
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        await asyncio.sleep(0.01)
        self.active -= 1
        error_code = self.error_code_by_node.get(task.node_id)
        if task.node_id == self.fail_node or error_code is not None:
            raise AigcGatewayError(
                AigcTaskError(
                    code=error_code or "invalid_input",
                    message="permanent failure",
                    stage="test",
                )
            )
        if self.retry_first and self.calls[task.node_id] == 1:
            raise AigcGatewayError(
                AigcTaskError(
                    code="429",
                    message="retry",
                    stage="test",
                ),
                retryable=True,
            )
        if task.node_id in self.results_by_node:
            result = self.results_by_node[task.node_id].model_copy(deep=True)
            version = (
                AIGC_VIDEO_EXECUTOR_VERSION
                if task.type == AigcTaskType.VIDEO_GENERATION
                else AIGC_IMAGE_EXECUTOR_VERSION
            )
        elif task.type == AigcTaskType.LLM:
            result = AigcTaskResult(
                kind=AigcResultKind.TEXT,
                text=f"result:{task.node_id}",
                text_digest="a" * 64,
            )
            version = "aigc-llm-v1"
        else:
            result = AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=self.result_assets_by_node.get(
                    task.node_id,
                    [
                        AigcResultAsset(
                            asset_id=f"asset-{task.task_id}",
                            ordinal=0,
                            mime_type="image/png",
                            download_url=f"/api/assets/asset-{task.task_id}/content",
                        )
                    ],
                ),
            )
            version = (
                AIGC_VIDEO_EXECUTOR_VERSION
                if task.type == AigcTaskType.VIDEO_GENERATION
                else (
                    AIGC_VIDEO_FACE_BLUR_EXECUTOR_VERSION
                    if task.type == AigcTaskType.VIDEO_FACE_BLUR
                    else (
                        AIGC_VIDEO_ENHANCEMENT_EXECUTOR_VERSION
                        if task.type == AigcTaskType.VIDEO_ENHANCEMENT
                        else AIGC_IMAGE_EXECUTOR_VERSION
                    )
                )
            )
        return AigcGatewayExecution(
            result=result,
            metrics=AigcTaskMetrics(duration_ms=10),
            executor_version=version,
        )


class FlakyLeaseRepository(InMemoryRepository):
    def __init__(
        self,
        *,
        acquire_failures: int = 0,
        renew_failures: int = 0,
    ) -> None:
        super().__init__()
        self.acquire_failures = acquire_failures
        self.renew_failures = renew_failures
        self.acquire_calls = 0
        self.renew_calls = 0
        self.renew_failed = asyncio.Event()

    def acquire_aigc_worker_lease(self, owner_id, *, now, lease_seconds):
        self.acquire_calls += 1
        if self.acquire_calls <= self.acquire_failures:
            return None
        return super().acquire_aigc_worker_lease(
            owner_id,
            now=now,
            lease_seconds=lease_seconds,
        )

    def renew_aigc_worker_lease(
        self,
        owner_id,
        fencing_token,
        *,
        now,
        lease_seconds,
    ):
        self.renew_calls += 1
        if self.renew_calls <= self.renew_failures:
            self.renew_failed.set()
            return None
        return super().renew_aigc_worker_lease(
            owner_id,
            fencing_token,
            now=now,
            lease_seconds=lease_seconds,
        )


class FailingLeaseRecoveryRepository(FlakyLeaseRepository):
    def __init__(self) -> None:
        super().__init__(renew_failures=1)
        self.recovery_list_failures = 1

    def list_aigc_task_attempts(self, *, statuses=None):
        if self.renew_failed.is_set() and self.recovery_list_failures > 0:
            self.recovery_list_failures -= 1
            raise RuntimeError("simulated recovery database outage")
        return super().list_aigc_task_attempts(statuses=statuses)


class _NoopAssetStorage:
    def __init__(self) -> None:
        self.deleted_asset_ids: list[str] = []

    def delete_asset_objects(self, asset) -> None:
        self.deleted_asset_ids.append(asset.id)

    def with_access_url(self, asset):
        return asset


class FailingTaskCreationRepository(InMemoryRepository):
    def __init__(self, *, fail_on_call: int) -> None:
        super().__init__()
        self.fail_on_call = fail_on_call
        self.task_creation_calls = 0

    def create_aigc_task_attempt(
        self,
        task: AigcPipelineTaskAttempt,
        *,
        idempotency_key: str,
        retry_of_task_id: str | None = None,
    ) -> AigcPipelineTaskAttempt:
        self.task_creation_calls += 1
        if self.task_creation_calls == self.fail_on_call:
            raise RuntimeError("simulated task persistence failure")
        return super().create_aigc_task_attempt(
            task,
            idempotency_key=idempotency_key,
            retry_of_task_id=retry_of_task_id,
        )


class BlockingGateway(FakeGateway):
    def __init__(self) -> None:
        super().__init__()
        self.started = asyncio.Event()
        self.release = asyncio.Event()

    async def execute(self, task) -> AigcGatewayExecution:
        self.started.set()
        await self.release.wait()
        return await super().execute(task)


class GatedLlmGateway(FakeGateway):
    def __init__(self) -> None:
        super().__init__()
        self.started: asyncio.Queue[str] = asyncio.Queue()
        self.release = asyncio.Event()

    async def execute(self, task) -> AigcGatewayExecution:
        self.tasks.append(task)
        self.calls[task.node_id] = self.calls.get(task.node_id, 0) + 1
        await self.started.put(task.node_id)
        await self.release.wait()
        return AigcGatewayExecution(
            result=AigcTaskResult(
                kind=AigcResultKind.TEXT,
                text=f"result:{task.node_id}",
                text_digest="a" * 64,
            ),
            metrics=AigcTaskMetrics(duration_ms=10),
            executor_version="aigc-llm-v1",
        )


class PersistingBlockingVideoGateway(FakeGateway):
    def __init__(self, repository: InMemoryRepository) -> None:
        super().__init__()
        self.repository = repository
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.created_asset_id: str | None = None

    async def execute(self, task) -> AigcGatewayExecution:
        self.created_asset_id = f"late-{task.task_id}"
        self.repository.create_asset(
            AssetCreate(
                id=self.created_asset_id,
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.STORYBOARD_VIDEO,
                status=Status.SUCCEEDED,
                object_key=f"aigc/{self.created_asset_id}.mp4",
                mime_type="video/mp4",
            )
        )
        self.repository.add_aigc_task_assets(
            [
                AigcPipelineTaskAssetReference(
                    task_id=task.task_id,
                    direction=AigcAssetDirection.OUTPUT,
                    slot="video",
                    ordinal=0,
                    asset_id=self.created_asset_id,
                )
            ]
        )
        self.started.set()
        await self.release.wait()
        return AigcGatewayExecution(
            result=AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[
                    AigcResultAsset(
                        asset_id=self.created_asset_id,
                        ordinal=0,
                        mime_type="video/mp4",
                    )
                ],
            ),
            metrics=AigcTaskMetrics(duration_ms=10),
            executor_version=AIGC_VIDEO_EXECUTOR_VERSION,
        )


def run_runtime_scenario(coroutine_factory):
    return asyncio.run(coroutine_factory())


def v2_definition(
    nodes: list[dict[str, object]],
    edges: list[dict[str, object]] | None = None,
) -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": nodes,
            "edges": edges or [],
        }
    )


def create_v2_runtime_pipeline(
    repository: InMemoryRepository,
    definition: AigcPipelineDefinitionV2,
    *,
    name: str,
):
    stored = repository.create_aigc_pipeline(
        AigcPipelineCreate(name=name, definition=AigcPipelineDefinition())
    )
    return stored.model_copy(update={"definition": definition}, deep=True)


async def submit_v2_run(
    runtime: AigcPipelineRuntime,
    pipeline,
    *,
    mode: AigcPipelineRunMode = AigcPipelineRunMode.FULL,
    start_node_id: str | None = None,
    idempotency_key: str,
):
    return await runtime._submit(
        pipeline,
        definition=pipeline.definition,
        persisted_mode=mode,
        planning_mode=mode,
        start_node_id=start_node_id,
        source_run_id=None,
        source_node_id=None,
        idempotency_key=idempotency_key,
    )


def create_image_asset(repository: InMemoryRepository, asset_id: str) -> None:
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.UPLOADED_IMAGE,
            status=Status.SUCCEEDED,
            object_key=f"aigc/{asset_id}.png",
            mime_type="image/png",
            size_bytes=100,
        )
    )


def create_media_asset(
    repository: InMemoryRepository,
    asset_id: str,
    asset_type: AssetType,
) -> None:
    extension, mime_type = {
        AssetType.UPLOADED_IMAGE: ("png", "image/png"),
        AssetType.UPLOADED_VIDEO: ("mp4", "video/mp4"),
        AssetType.UPLOADED_AUDIO: ("mp3", "audio/mpeg"),
    }[asset_type]
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            tool_asset_role=ToolAssetRole.INPUT,
            type=asset_type,
            status=Status.SUCCEEDED,
            object_key=f"aigc/{asset_id}.{extension}",
            mime_type=mime_type,
            size_bytes=100,
        )
    )


def video_reference_definition(
    reference_order: list[tuple[str, str, str]],
    *,
    generate_audio: bool = True,
    prompt: str = "延长并调整节奏",
) -> AigcPipelineDefinition:
    input_nodes = [
        node(
            node_id,
            {
                "reference_images": "image_input",
                "reference_videos": "video_input",
                "reference_audios": "audio_input",
            }[target_handle],
            index * 100,
            config={"asset_id": asset_id},
        )
        for index, (node_id, asset_id, target_handle) in enumerate(reference_order)
    ]
    source_handles = {
        "reference_images": "image",
        "reference_videos": "video",
        "reference_audios": "audio",
    }
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                *input_nodes,
                node("prompt", "text_input", 0, config={"text": prompt}),
                node(
                    "video-model",
                    "video_generation",
                    800,
                    config={
                        "model": "doubao-seedance-2-5-260628",
                        "generation_mode": "multimodal_reference",
                        "task_type": "generate",
                        "resolution": "1080p",
                        "aspect_ratio": "16:9",
                        "duration_seconds": 12,
                        "generate_audio": generate_audio,
                    },
                ),
            ],
            "edges": [
                *[
                    edge(
                        f"edge-{index}",
                        node_id,
                        source_handles[target_handle],
                        "video-model",
                        target_handle,
                    )
                    for index, (node_id, _, target_handle) in enumerate(
                        reference_order
                    )
                ],
                edge("prompt-edge", "prompt", "text", "video-model", "prompt"),
            ],
        }
    )


def text_to_video_definition(
    *,
    model_node_id: str = "video-model",
    prompt_node_id: str = "prompt",
) -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(prompt_node_id, "text_input", 0, config={"text": "生成广告视频"}),
                node(model_node_id, "video_generation", 300),
                node("video-output", "video_output", 600),
            ],
            "edges": [
                edge(
                    "prompt-edge",
                    prompt_node_id,
                    "text",
                    model_node_id,
                    "prompt",
                ),
                edge(
                    "video-output-edge",
                    model_node_id,
                    "video",
                    "video-output",
                    "video",
                ),
            ],
        }
    )


def video_enhancement_definition(
    *,
    input_asset_id: str = "enhancement-input",
    enhance_style: str = "hd",
    include_output: bool = True,
) -> AigcPipelineDefinition:
    nodes = [
        node(
            "video-input",
            "video_input",
            0,
            config={"asset_id": input_asset_id},
        ),
        node(
            "enhance",
            "video_enhancement",
            300,
            config={"enhance_style": enhance_style},
        ),
    ]
    edges = [
        edge(
            "enhancement-input-edge",
            "video-input",
            "video",
            "enhance",
            "video",
        )
    ]
    if include_output:
        nodes.append(node("video-output", "video_output", 600))
        edges.append(
            edge(
                "enhancement-output-edge",
                "enhance",
                "video",
                "video-output",
                "video",
            )
        )
    return AigcPipelineDefinition.model_validate(
        {"nodes": nodes, "edges": edges}
    )


def video_face_blur_definition(
    *,
    input_asset_id: str = "face-blur-input",
    mask_mode: str = "mosaic",
    mask_strength: str = "medium",
    include_output: bool = True,
) -> AigcPipelineDefinition:
    nodes = [
        node(
            "video-input",
            "video_input",
            0,
            config={"asset_id": input_asset_id},
        ),
        node(
            "face-blur",
            "video_face_blur",
            300,
            config={
                "mask_mode": mask_mode,
                "mask_strength": mask_strength,
            },
        ),
    ]
    edges = [
        edge(
            "face-blur-input-edge",
            "video-input",
            "video",
            "face-blur",
            "video",
        )
    ]
    if include_output:
        nodes.append(node("video-output", "video_output", 600))
        edges.append(
            edge(
                "face-blur-output-edge",
                "face-blur",
                "video",
                "video-output",
                "video",
            )
        )
    return AigcPipelineDefinition.model_validate(
        {"nodes": nodes, "edges": edges}
    )


def image_reference_definition(
    image_edges: list[tuple[str, str]],
) -> AigcPipelineDefinition:
    image_nodes = {
        node_id: node(
            node_id,
            "image_input",
            index * 200,
            config={"asset_id": asset_id},
        )
        for index, (node_id, asset_id) in enumerate(image_edges)
    }
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                *image_nodes.values(),
                node("prompt", "text_input", 0, config={"text": "调整背景"}),
                node("model", "image_to_image", 800),
            ],
            "edges": [
                *[
                    edge(f"edge-{index}", node_id, "image", "model", "image")
                    for index, (node_id, _) in enumerate(image_edges)
                ],
                edge("prompt-edge", "prompt", "text", "model", "prompt"),
            ],
        }
    )


def test_runtime_executes_dependency_chain_and_projects_output(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[tuple[str, dict[str, object]]] = []
    monkeypatch.setattr(
        executor_module,
        "log_event",
        lambda _logger, event, **context: events.append((event, context)),
    )

    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="chain", definition=chain_definition())
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="chain-run",
            )
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()
        return detail, gateway

    detail, gateway = run_runtime_scenario(scenario)

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    by_id = {node.node_id: node for node in detail.nodes}
    assert by_id["llm"].status == AigcRunNodeStatus.SUCCEEDED
    assert by_id["image"].status == AigcRunNodeStatus.SUCCEEDED
    assert by_id["output"].status == AigcRunNodeStatus.SUCCEEDED
    assert by_id["output"].result.kind == AigcResultKind.ASSETS
    assert gateway.calls == {"llm": 1, "image": 1}
    task_events = [context for event, context in events if event == "aigc.task"]
    assert any(
        event["outcome"] == "started" and event["phase"] == "queued"
        for event in task_events
    )
    assert sum(event["outcome"] == "succeeded" for event in task_events) == 2
    assert {
        event["task_type"] for event in task_events if event["outcome"] == "succeeded"
    } == {"llm", "text_to_image"}
    assert any(
        event == "aigc.run" and context["outcome"] == "succeeded"
        for event, context in events
    )


def test_llm_resolves_local_and_upstream_image_assets_without_urls() -> None:
    repository = InMemoryRepository()
    create_image_asset(repository, "local-image")
    create_image_asset(repository, "run-image")
    definition = canonicalize_aigc_definition(
        v2_definition(
            [
                node("prompt", "text", 0, config={"text": "分析图片"}),
                node(
                    "upstream-image",
                    "image",
                    0,
                    config={"asset_id": "local-image"},
                ),
                node("image", "image", 0, config={"asset_id": "local-image"}),
                node("llm", "llm", 300),
            ],
            [
                edge(
                    "upstream-image-edge",
                    "upstream-image",
                    "image",
                    "image",
                    "image",
                ),
                edge("prompt-edge", "prompt", "text", "llm", "prompt"),
                edge("image-edge", "image", "image", "llm", "image"),
            ],
        )
    )
    node_by_id = {item.id: item for item in definition.nodes}
    run_node_by_id = {
        "prompt": AigcPipelineRunNode(
            node_id="prompt",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(kind=AigcResultKind.TEXT, text="分析图片"),
        ),
        "image": AigcPipelineRunNode(
            node_id="image",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[
                    AigcResultAsset(
                        asset_id="run-image",
                        ordinal=0,
                        mime_type="image/png",
                        available=True,
                    )
                ],
            ),
        ),
    }
    runtime = AigcPipelineRuntime(
        repository,
        FakeGateway(),  # type: ignore[arg-type]
    )
    llm_edges = [
        item for item in definition.edges if item.target_node_id == "llm"
    ]

    params, _ = runtime._resolve_task_params(
        node_by_id["llm"],
        llm_edges,
        node_by_id,
        run_node_by_id,
        all_edges=definition.edges,
    )
    upstream_hash = runtime._hash_resolved_task(
        node_by_id["llm"],
        params,
        llm_edges,
        node_by_id,
        run_node_by_id,
        all_edges=definition.edges,
    )
    run_node_by_id["image"] = run_node_by_id["image"].model_copy(
        update={
            "result": AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[
                    AigcResultAsset(
                        asset_id="local-image",
                        ordinal=0,
                        mime_type="image/png",
                        available=True,
                    )
                ],
            )
        }
    )
    fallback_params, _ = runtime._resolve_task_params(
        node_by_id["llm"],
        llm_edges,
        node_by_id,
        run_node_by_id,
        all_edges=definition.edges,
    )
    fallback_hash = runtime._hash_resolved_task(
        node_by_id["llm"],
        fallback_params,
        llm_edges,
        node_by_id,
        run_node_by_id,
        all_edges=definition.edges,
    )

    assert params["input_image_asset_id"] == "run-image"
    assert "url" not in params
    assert fallback_params["input_image_asset_id"] == "local-image"
    assert upstream_hash != fallback_hash


def test_v2_local_modalities_create_frozen_results_without_attempts() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(repository, "local-image", AssetType.UPLOADED_IMAGE)
        create_media_asset(repository, "local-video", AssetType.UPLOADED_VIDEO)
        create_media_asset(repository, "local-audio", AssetType.UPLOADED_AUDIO)
        definition = v2_definition(
            [
                node("text", "text", 0, config={"text": "商品文案"}),
                node("llm", "llm", 250),
                node("image", "image", 0, config={"asset_id": "local-image"}),
                node("video", "video", 0, config={"asset_id": "local-video"}),
                node("audio", "audio", 0, config={"asset_id": "local-audio"}),
            ],
            [edge("text-llm", "text", "text", "llm", "prompt")],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 local snapshots",
        )
        runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="v2-local-snapshots",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert by_id["text"].result.text == "商品文案"
    assert by_id["text"].result.text_digest is not None
    assert {
        node_id: by_id[node_id].result.assets[0].asset_id
        for node_id in ("image", "video", "audio")
    } == {
        "image": "local-image",
        "video": "local-video",
        "audio": "local-audio",
    }
    for node_id in ("text", "image", "video", "audio"):
        assert by_id[node_id].status == AigcRunNodeStatus.SUCCEEDED
        assert by_id[node_id].current_task_id is None
        assert by_id[node_id].attempts == []


@pytest.mark.parametrize("asset_id", [None, "missing-image"])
def test_v2_consumed_empty_or_unavailable_media_fails_before_model_task(
    asset_id: str | None,
) -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = v2_definition(
            [
                node("image", "image", 0, config={"asset_id": asset_id}),
                node("prompt", "text", 0, config={"text": "调整背景"}),
                node("image-model", "image_to_image", 300),
                node("independent-prompt", "text", 0, config={"text": "独立分支"}),
                node("independent-llm", "llm", 300),
                node("empty-terminal", "audio", 600),
            ],
            [
                edge("image-model-image", "image", "image", "image-model", "image"),
                edge("image-model-prompt", "prompt", "text", "image-model", "prompt"),
                edge(
                    "independent",
                    "independent-prompt",
                    "text",
                    "independent-llm",
                    "prompt",
                ),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 invalid local media",
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key=f"v2-invalid-media-{asset_id}",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway
        finally:
            await runtime.stop()

    detail, gateway = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert by_id["image"].status == AigcRunNodeStatus.FAILED
    assert by_id["image"].error is not None
    assert by_id["image"].error.code == "invalid_input"
    assert by_id["image-model"].status == AigcRunNodeStatus.BLOCKED
    assert by_id["image-model"].attempts == []
    assert by_id["independent-llm"].status == AigcRunNodeStatus.SUCCEEDED
    assert by_id["empty-terminal"].status == AigcRunNodeStatus.IDLE
    assert not by_id["empty-terminal"].included_in_plan
    assert gateway.calls == {"independent-llm": 1}


def test_v2_text_modality_chain_projects_immediately_and_supports_from_node() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = v2_definition(
            [
                node("source", "text", 0, config={"text": "商品"}),
                node("producer", "llm", 200),
                node("relay-one", "text", 400, config={"text": "备用一"}),
                node(
                    "relay-two",
                    "text",
                    600,
                    config={
                        "text": "备用二",
                        "upstream_text_override": "人工覆盖",
                    },
                ),
                node("consumer", "llm", 800),
                node("terminal", "text", 1000),
            ],
            [
                edge("source-producer", "source", "text", "producer", "prompt"),
                edge("producer-relay-one", "producer", "text", "relay-one", "text"),
                edge("relay-one-two", "relay-one", "text", "relay-two", "text"),
                edge("relay-two-consumer", "relay-two", "text", "consumer", "prompt"),
                edge("consumer-terminal", "consumer", "text", "terminal", "text"),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 relay chain",
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            first = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="v2-relay-first",
            )
            await runtime.wait_until_idle()
            second = await submit_v2_run(
                runtime,
                pipeline,
                mode=AigcPipelineRunMode.FROM_NODE,
                start_node_id="relay-one",
                idempotency_key="v2-relay-second",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(second.run.id),
                gateway,
            )
        finally:
            await runtime.stop()

    first, second, gateway = run_runtime_scenario(scenario)
    first_by_id = {item.node_id: item for item in first.nodes}
    second_by_id = {item.node_id: item for item in second.nodes}

    assert first.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert first_by_id["relay-one"].result.text == "result:producer"
    assert first_by_id["relay-two"].result.text == "人工覆盖"
    for node_id in ("relay-one", "relay-two"):
        assert first_by_id[node_id].status == AigcRunNodeStatus.SUCCEEDED
        assert first_by_id[node_id].attempts == []
    assert first_by_id["consumer"].attempts[0].params["prompt"] == "人工覆盖"
    assert first_by_id["terminal"].result.text == "result:consumer"
    assert first_by_id["terminal"].attempts == []

    assert second.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert second_by_id["producer"].status == AigcRunNodeStatus.REUSED
    assert second_by_id["relay-one"].result.text == "result:producer"
    assert second_by_id["relay-two"].result.text == "人工覆盖"
    assert second_by_id["relay-one"].attempts == []
    assert second_by_id["relay-two"].attempts == []
    assert second_by_id["terminal"].result.text == "result:consumer"
    assert second_by_id["terminal"].attempts == []
    assert gateway.calls == {"producer": 1, "consumer": 2}


def test_v2_media_relay_passes_same_asset_id_without_task_or_backup_fallback() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = v2_definition(
            [
                node("source-prompt", "text", 0, config={"text": "商品图"}),
                node("producer", "text_to_image", 200),
                node(
                    "relay",
                    "image",
                    400,
                    config={"asset_id": "missing-local-backup"},
                ),
                node("edit-prompt", "text", 400, config={"text": "调整背景"}),
                node("consumer", "image_to_image", 600),
            ],
            [
                edge(
                    "source-prompt-producer",
                    "source-prompt",
                    "text",
                    "producer",
                    "prompt",
                ),
                edge("producer-relay", "producer", "image", "relay", "image"),
                edge("relay-consumer", "relay", "image", "consumer", "image"),
                edge(
                    "edit-prompt-consumer",
                    "edit-prompt",
                    "text",
                    "consumer",
                    "prompt",
                ),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 media relay",
        )
        gateway = FakeGateway(
            result_assets_by_node={
                "producer": [
                    AigcResultAsset(
                        asset_id="upstream-image",
                        ordinal=0,
                        mime_type="image/png",
                    )
                ]
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="v2-media-relay",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert by_id["relay"].result.assets[0].asset_id == "upstream-image"
    assert by_id["relay"].current_task_id is None
    assert by_id["relay"].attempts == []
    assert by_id["consumer"].attempts[0].params["reference_asset_ids"] == [
        "upstream-image"
    ]


@pytest.mark.parametrize(
    ("base_text", "expected_prompt"),
    [
        (
            "替换包装",
            "替换包装 图1<bbox>100 200 700 800</bbox> 保留商标位置",
        ),
        (
            "",
            "图1<bbox>100 200 700 800</bbox> 保留商标位置",
        ),
    ],
)
def test_v2_local_text_compiles_bbox_for_plain_image_to_image(
    base_text: str,
    expected_prompt: str,
) -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_image_asset(repository, "bbox-image")
        definition = v2_definition(
            [
                node(
                    "image",
                    "image",
                    0,
                    config={
                        "asset_id": "bbox-image",
                        "bbox_asset_id": "bbox-image",
                        "bbox": {
                            "type": "bbox",
                            "x1": 100,
                            "y1": 200,
                            "x2": 700,
                            "y2": 800,
                        },
                    },
                ),
                node(
                    "prompt",
                    "text",
                    0,
                    config={
                        "text": base_text,
                        "bbox_references": [
                            {
                                "source_node_id": "image",
                                "instruction": "保留商标位置",
                            }
                        ],
                    },
                ),
                node("model", "image_to_image", 300),
            ],
            [
                edge("image-model", "image", "image", "model", "image"),
                edge("prompt-model", "prompt", "text", "model", "prompt"),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 bbox prompt",
        )
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
        )
        expected_hash = runtime._expected_input_hashes(definition, {})["model"]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="v2-bbox-prompt",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), expected_hash
        finally:
            await runtime.stop()

    detail, expected_hash = run_runtime_scenario(scenario)
    model = next(item for item in detail.nodes if item.node_id == "model")
    task = model.attempts[0]

    assert task.params["prompt"] == expected_prompt
    assert model.input_hash == expected_hash


def test_v2_local_text_rejects_when_text_and_bbox_references_are_empty() -> None:
    repository = InMemoryRepository()
    definition = v2_definition(
        [node("prompt", "text", 0, config={"text": "", "bbox_references": []})],
        [],
    )
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="local text value is empty"):
        runtime._local_modality_result(definition.nodes[0])  # type: ignore[arg-type]


def test_v2_bbox_reference_pauses_while_image_uses_upstream() -> None:
    definition = v2_definition(
        [
            node("producer", "text_to_image", 0),
            node(
                "image",
                "image",
                300,
                config={
                    "asset_id": "local-backup",
                    "bbox_asset_id": "local-backup",
                    "bbox": {
                        "type": "bbox",
                        "x1": 100,
                        "y1": 200,
                        "x2": 700,
                        "y2": 800,
                    },
                },
            ),
            node(
                "prompt",
                "text",
                300,
                config={
                    "text": "替换包装",
                    "bbox_references": [
                        {
                            "source_node_id": "image",
                            "instruction": "保留商标位置",
                        }
                    ],
                },
            ),
            node("model", "image_to_image", 600),
        ],
        [
            edge("producer-image", "producer", "image", "image", "image"),
            edge("image-model", "image", "image", "model", "image"),
            edge("prompt-model", "prompt", "text", "model", "prompt"),
        ],
    )
    node_by_id = {item.id: item for item in definition.nodes}

    assert _compile_bbox_prompt(
        node_by_id["prompt"],  # type: ignore[arg-type]
        target_node_id="model",
        edges=definition.edges,
        node_by_id=node_by_id,
    ) == "替换包装"

    local_edges = [
        item for item in definition.edges if item.id != "producer-image"
    ]
    assert _compile_bbox_prompt(
        node_by_id["prompt"],  # type: ignore[arg-type]
        target_node_id="model",
        edges=local_edges,
        node_by_id=node_by_id,
    ) == "替换包装 图1<bbox>100 200 700 800</bbox> 保留商标位置"


def test_v2_upstream_bbox_compiles_only_for_bound_result_asset() -> None:
    definition = v2_definition(
        [
            node("producer", "text_to_image", 0),
            node(
                "image",
                "image",
                300,
                config={
                    "asset_id": "local-backup",
                    "upstream_bbox_asset_id": "upstream-image",
                    "upstream_bbox": {
                        "type": "bbox",
                        "x1": 100,
                        "y1": 200,
                        "x2": 700,
                        "y2": 800,
                    },
                },
            ),
            node(
                "prompt",
                "text",
                300,
                config={
                    "text": "替换包装",
                    "bbox_references": [
                        {
                            "source_node_id": "image",
                            "instruction": "保留商标位置",
                        }
                    ],
                },
            ),
            node("model", "image_to_image", 600),
        ],
        [
            edge("producer-image", "producer", "image", "image", "image"),
            edge("image-model", "image", "image", "model", "image"),
            edge("prompt-model", "prompt", "text", "model", "prompt"),
        ],
    )
    node_by_id = {item.id: item for item in definition.nodes}

    def image_run_node(asset_id: str) -> AigcPipelineRunNode:
        return AigcPipelineRunNode(
            node_id="image",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[
                    AigcResultAsset(
                        asset_id=asset_id,
                        ordinal=0,
                        mime_type="image/png",
                    )
                ],
            ),
        )

    assert _compile_bbox_prompt(
        node_by_id["prompt"],  # type: ignore[arg-type]
        target_node_id="model",
        edges=definition.edges,
        node_by_id=node_by_id,
        run_node_by_id={"image": image_run_node("upstream-image")},
    ) == "替换包装 图1<bbox>100 200 700 800</bbox> 保留商标位置"

    with pytest.raises(AigcResolvedInputError) as raised:
        _compile_bbox_prompt(
            node_by_id["prompt"],  # type: ignore[arg-type]
            target_node_id="model",
            edges=definition.edges,
            node_by_id=node_by_id,
            run_node_by_id={"image": image_run_node("new-upstream-image")},
        )
    assert raised.value.code == "bbox_reference_asset_changed"
    assert "image node 'image'" in str(raised.value)
    assert "text node 'prompt'" in str(raised.value)


def test_v2_changed_upstream_bbox_asset_fails_before_provider_call() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = v2_definition(
            [
                node(
                    "source",
                    "text",
                    0,
                    config={"text": "生成商品图"},
                ),
                node("producer", "text_to_image", 300),
                node(
                    "image",
                    "image",
                    600,
                    config={
                        "upstream_bbox_asset_id": "previous-upstream-image",
                        "upstream_bbox": {
                            "type": "bbox",
                            "x1": 100,
                            "y1": 200,
                            "x2": 700,
                            "y2": 800,
                        },
                    },
                ),
                node(
                    "prompt",
                    "text",
                    600,
                    config={
                        "text": "替换包装",
                        "bbox_references": [
                            {
                                "source_node_id": "image",
                                "instruction": "保留商标位置",
                            }
                        ],
                    },
                ),
                node("model", "image_to_image", 900),
            ],
            [
                edge("source-producer", "source", "text", "producer", "prompt"),
                edge("producer-image", "producer", "image", "image", "image"),
                edge("image-model", "image", "image", "model", "image"),
                edge("prompt-model", "prompt", "text", "model", "prompt"),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 stale upstream bbox",
        )
        gateway = FakeGateway(
            result_assets_by_node={
                "producer": [
                    AigcResultAsset(
                        asset_id="new-upstream-image",
                        ordinal=0,
                        mime_type="image/png",
                    )
                ]
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="v2-stale-upstream-bbox",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway
        finally:
            await runtime.stop()

    detail, gateway = run_runtime_scenario(scenario)
    model = next(item for item in detail.nodes if item.node_id == "model")

    assert model.status == AigcRunNodeStatus.FAILED
    assert model.error is not None
    assert model.error.code == "bbox_reference_asset_changed"
    assert gateway.calls == {"producer": 1}


def test_v2_modality_hash_uses_effective_value_and_ignores_upstream_backup() -> None:
    repository = InMemoryRepository()
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]

    def local_definition(text: str) -> AigcPipelineDefinitionV2:
        return v2_definition(
            [
                node("prompt", "text", 0, config={"text": text}),
                node("consumer", "llm", 300),
            ],
            [edge("prompt-consumer", "prompt", "text", "consumer", "prompt")],
        )

    def upstream_definition(
        backup: str,
        override: str | None = None,
    ) -> AigcPipelineDefinitionV2:
        return v2_definition(
            [
                node("source", "text", 0, config={"text": "有效输入"}),
                node("producer", "llm", 200),
                node(
                    "relay",
                    "text",
                    400,
                    config={
                        "text": backup,
                        "upstream_text_override": override,
                    },
                ),
                node("consumer", "llm", 600),
            ],
            [
                edge("source-producer", "source", "text", "producer", "prompt"),
                edge("producer-relay", "producer", "text", "relay", "text"),
                edge("relay-consumer", "relay", "text", "consumer", "prompt"),
            ],
        )

    first_local = runtime._expected_input_hashes(local_definition("第一版"), {})
    second_local = runtime._expected_input_hashes(local_definition("第二版"), {})
    cached_producer = AigcPipelineRunNode(
        node_id="producer",
        included_in_plan=True,
        status=AigcRunNodeStatus.SUCCEEDED,
        result=AigcTaskResult(
            kind=AigcResultKind.TEXT,
            text="上游结果",
            text_digest="b" * 64,
        ),
    )
    first_upstream = runtime._expected_input_hashes(
        upstream_definition("备用一"),
        {"producer": cached_producer},
    )
    second_upstream = runtime._expected_input_hashes(
        upstream_definition("备用二"),
        {"producer": cached_producer},
    )

    assert first_local["consumer"] != second_local["consumer"]
    assert first_upstream["consumer"] == second_upstream["consumer"]
    first_override = runtime._expected_input_hashes(
        upstream_definition("备用", "覆盖一"),
        {"producer": cached_producer},
    )
    second_override = runtime._expected_input_hashes(
        upstream_definition("备用", "覆盖二"),
        {"producer": cached_producer},
    )
    assert first_override["consumer"] != second_override["consumer"]

    changed_upstream = cached_producer.model_copy(
        update={
            "result": AigcTaskResult(
                kind=AigcResultKind.TEXT,
                text="新的上游结果",
                text_digest="c" * 64,
            )
        },
        deep=True,
    )
    stable_override = runtime._expected_input_hashes(
        upstream_definition("备用", "覆盖一"),
        {"producer": changed_upstream},
    )
    assert first_override["consumer"] == stable_override["consumer"]


def test_v2_media_relay_preserves_model_task_asset_trace_without_relay_relation() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_image_asset(repository, "trace-input")
        definition = v2_definition(
            [
                node("source", "image", 0, config={"asset_id": "trace-input"}),
                node("relay", "image", 200, config={"asset_id": "unused-backup"}),
                node("prompt", "text", 200, config={"text": "调整背景"}),
                node("model", "image_to_image", 400),
            ],
            [
                edge("source-relay", "source", "image", "relay", "image"),
                edge("relay-model", "relay", "image", "model", "image"),
                edge("prompt-model", "prompt", "text", "model", "prompt"),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 asset trace",
        )
        runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="v2-asset-trace",
            )
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
            model = next(item for item in detail.nodes if item.node_id == "model")
            task = model.attempts[0]
            repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.INPUT,
                        slot="image",
                        ordinal=0,
                        asset_id=task.params["reference_asset_ids"][0],
                    )
                ]
            )
            return detail, repository.list_aigc_task_assets(task.task_id)
        finally:
            await runtime.stop()

    detail, references = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert by_id["relay"].attempts == []
    assert by_id["relay"].result.assets[0].asset_id == "trace-input"
    assert [
        (item.direction, item.slot, item.ordinal, item.asset_id)
        for item in references
    ] == [(AigcAssetDirection.INPUT, "image", 0, "trace-input")]


@pytest.mark.parametrize(
    ("error_code", "producer_status"),
    [
        ("invalid_input", AigcRunNodeStatus.FAILED),
        ("timeout", AigcRunNodeStatus.TIMED_OUT),
    ],
)
def test_v2_upstream_failure_or_timeout_blocks_relay_without_local_fallback(
    error_code: str,
    producer_status: AigcRunNodeStatus,
) -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = v2_definition(
            [
                node("source", "text", 0, config={"text": "商品"}),
                node("producer", "llm", 200),
                node(
                    "relay",
                    "text",
                    400,
                    config={
                        "text": "不得回退",
                        "upstream_text_override": "覆盖也不得绕过失败",
                    },
                ),
                node("consumer", "llm", 600),
                node("independent", "text", 0, config={"text": "独立"}),
                node("independent-llm", "llm", 200),
            ],
            [
                edge("source-producer", "source", "text", "producer", "prompt"),
                edge("producer-relay", "producer", "text", "relay", "text"),
                edge("relay-consumer", "relay", "text", "consumer", "prompt"),
                edge(
                    "independent-model",
                    "independent",
                    "text",
                    "independent-llm",
                    "prompt",
                ),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 failed relay",
        )
        gateway = FakeGateway(error_code_by_node={"producer": error_code})
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key=f"v2-relay-{error_code}",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway
        finally:
            await runtime.stop()

    detail, gateway = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert by_id["producer"].status == producer_status
    assert by_id["relay"].status == AigcRunNodeStatus.BLOCKED
    assert by_id["relay"].result.kind == AigcResultKind.NONE
    assert by_id["relay"].attempts == []
    assert by_id["consumer"].status == AigcRunNodeStatus.BLOCKED
    assert by_id["consumer"].attempts == []
    assert by_id["independent-llm"].status == AigcRunNodeStatus.SUCCEEDED
    assert gateway.calls == {"producer": 1, "independent-llm": 1}


def test_v2_unavailable_upstream_blocks_media_relay_without_asset_copy() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = v2_definition(
            [
                node("prompt", "text", 0, config={"text": "商品图"}),
                node("producer", "text_to_image", 200),
                node("relay", "image", 400, config={"asset_id": "local-backup"}),
                node("edit-prompt", "text", 400, config={"text": "调整背景"}),
                node("consumer", "image_to_image", 600),
            ],
            [
                edge("prompt-producer", "prompt", "text", "producer", "prompt"),
                edge("producer-relay", "producer", "image", "relay", "image"),
                edge("relay-consumer", "relay", "image", "consumer", "image"),
                edge(
                    "edit-prompt-consumer",
                    "edit-prompt",
                    "text",
                    "consumer",
                    "prompt",
                ),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 unavailable relay",
        )
        unavailable = AigcTaskResult(
            kind=AigcResultKind.UNAVAILABLE,
            assets=[
                AigcResultAsset(
                    asset_id="deleted-output",
                    ordinal=0,
                    mime_type="image/png",
                    available=False,
                )
            ],
        )
        gateway = FakeGateway(results_by_node={"producer": unavailable})
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="v2-unavailable-relay",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway
        finally:
            await runtime.stop()

    detail, gateway = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert by_id["producer"].status == AigcRunNodeStatus.SUCCEEDED
    assert by_id["relay"].status == AigcRunNodeStatus.BLOCKED
    assert by_id["relay"].result.kind == AigcResultKind.UNAVAILABLE
    assert by_id["relay"].result.assets[0].asset_id == "deleted-output"
    assert not by_id["relay"].result.assets[0].available
    assert by_id["relay"].attempts == []
    assert by_id["consumer"].status == AigcRunNodeStatus.BLOCKED
    assert gateway.calls == {"producer": 1}


def test_v2_cancellation_never_resolves_relay_from_backup_value() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = v2_definition(
            [
                node("source", "text", 0, config={"text": "商品"}),
                node("producer", "llm", 200),
                node("relay", "text", 400, config={"text": "不得回退"}),
                node("consumer", "llm", 600),
            ],
            [
                edge("source-producer", "source", "text", "producer", "prompt"),
                edge("producer-relay", "producer", "text", "relay", "text"),
                edge("relay-consumer", "relay", "text", "consumer", "prompt"),
            ],
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            definition,
            name="v2 canceled relay",
        )
        gateway = BlockingGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="v2-canceled-relay",
            )
            await asyncio.wait_for(gateway.started.wait(), timeout=1)
            await runtime.cancel_run(created.run.id)
            gateway.release.set()
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.CANCELED
    assert by_id["relay"].status == AigcRunNodeStatus.CANCELED
    assert by_id["relay"].result.kind == AigcResultKind.NONE
    assert by_id["relay"].attempts == []
    assert by_id["consumer"].status == AigcRunNodeStatus.CANCELED
    assert by_id["consumer"].attempts == []


def test_custom_image_size_is_normalized_in_snapshot_params_and_hash() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = chain_definition(image_size="02048x01024")
        changed_width = chain_definition(image_size="1920x1024")
        changed_height = chain_definition(image_size="2048x1080")
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
        )
        hashes = {
            runtime._expected_input_hashes(item, {})["image"]
            for item in (definition, changed_width, changed_height)
        }
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="custom size snapshot", definition=definition)
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="custom-size-snapshot",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), hashes
        finally:
            await runtime.stop()

    detail, hashes = run_runtime_scenario(scenario)
    image_node = next(item for item in detail.nodes if item.node_id == "image")
    frozen_config = next(
        item.config
        for item in detail.run.definition_snapshot.nodes
        if item.id == "image"
    )

    assert frozen_config.size == "2048x1024"
    assert image_node.attempts[0].params["size"] == "2048x1024"
    assert len(hashes) == 3


def test_manual_retry_uses_frozen_custom_image_size_after_pipeline_change() -> None:
    async def scenario():
        repository = InMemoryRepository()
        original = chain_definition(image_size="2048x1024")
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="frozen custom size", definition=original)
        )
        gateway = FakeGateway(fail_node="image")
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
        )
        try:
            first = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="frozen-custom-size-first",
            )
            await runtime.wait_until_idle()
            repository.update_aigc_pipeline(
                pipeline.id,
                AigcPipelineUpdate(
                    expected_revision=0,
                    name=pipeline.name,
                    definition=chain_definition(image_size="1920x1080"),
                ),
            )
            gateway.fail_node = None
            retry = await runtime.retry_node(
                first.run.id,
                "image",
                idempotency_key="frozen-custom-size-retry",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(retry.run.id),
            )
        finally:
            await runtime.stop()

    first, retry = run_runtime_scenario(scenario)
    first_image = next(item for item in first.nodes if item.node_id == "image")
    retry_image = next(item for item in retry.nodes if item.node_id == "image")

    assert first_image.attempts[0].params["size"] == "2048x1024"
    assert retry_image.attempts[0].params["size"] == "2048x1024"
    assert retry_image.input_hash == first_image.input_hash


def test_image_to_image_task_preserves_definition_edge_order_and_duplicates() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_image_asset(repository, "asset-a")
        create_image_asset(repository, "asset-b")
        definition = image_reference_definition(
            [
                ("image-b", "asset-b"),
                ("image-a", "asset-a"),
                ("image-a-again", "asset-a"),
            ]
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="ordered references", definition=definition)
        )
        runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="ordered-references",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    model = next(item for item in detail.nodes if item.node_id == "model")
    task = model.attempts[0]

    assert task.params["reference_asset_ids"] == [
        "asset-b",
        "asset-a",
        "asset-a",
    ]
    assert "source_asset_id" not in task.params
    assert task.upstream == [
        "image-b",
        "image-a",
        "image-a-again",
        "prompt",
    ]


def test_image_to_image_task_uses_first_available_model_asset_in_mixed_inputs() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_image_asset(repository, "static-asset")
        definition = AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node(
                        "producer-prompt",
                        "text_input",
                        0,
                        config={"text": "生成参考图"},
                    ),
                    node("producer", "text_to_image", 200),
                    node(
                        "static",
                        "image_input",
                        200,
                        config={"asset_id": "static-asset"},
                    ),
                    node(
                        "target-prompt",
                        "text_input",
                        400,
                        config={"text": "混合编辑"},
                    ),
                    node("target", "image_to_image", 600),
                ],
                "edges": [
                    edge(
                        "producer-prompt-edge",
                        "producer-prompt",
                        "text",
                        "producer",
                        "prompt",
                    ),
                    edge("generated-edge", "producer", "image", "target", "image"),
                    edge(
                        "target-prompt-edge",
                        "target-prompt",
                        "text",
                        "target",
                        "prompt",
                    ),
                    edge("static-edge", "static", "image", "target", "image"),
                ],
            }
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="mixed references", definition=definition)
        )
        gateway = FakeGateway(
            result_assets_by_node={
                "producer": [
                    AigcResultAsset(
                        asset_id="unavailable-generated",
                        ordinal=0,
                        available=False,
                    ),
                    AigcResultAsset(
                        asset_id="available-generated",
                        ordinal=1,
                        available=True,
                    ),
                ]
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="mixed-references",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    target = next(item for item in detail.nodes if item.node_id == "target")
    task = target.attempts[0]

    assert task.params["reference_asset_ids"] == [
        "available-generated",
        "static-asset",
    ]
    assert task.upstream == ["producer", "target-prompt", "static"]


def test_image_reference_order_changes_expected_input_hash() -> None:
    repository = InMemoryRepository()
    create_image_asset(repository, "asset-a")
    create_image_asset(repository, "asset-b")
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]

    first = image_reference_definition(
        [("image-a", "asset-a"), ("image-b", "asset-b")]
    )
    reversed_order = image_reference_definition(
        [("image-b", "asset-b"), ("image-a", "asset-a")]
    )

    first_hash = runtime._expected_input_hashes(first, {})["model"]
    reversed_hash = runtime._expected_input_hashes(reversed_order, {})["model"]

    assert first_hash != reversed_hash
    assert AIGC_IMAGE_EXECUTOR_VERSION == "aigc-image-v3"


def test_local_modality_result_uses_storage_access_url() -> None:
    repository = InMemoryRepository()
    create_image_asset(repository, "asset-a")
    definition = canonicalize_aigc_definition(
        image_reference_definition([("image-a", "asset-a")])
    )
    gateway = FakeGateway()
    gateway.asset_storage.with_access_url = lambda asset: asset.model_copy(
        update={"url": f"/api/assets/{asset.id}/content"}
    )
    runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
    image_node = next(item for item in definition.nodes if item.id == "image-a")

    result = runtime._local_modality_result(image_node)

    assert result.assets[0].download_url == "/api/assets/asset-a/content"


def test_video_task_snapshot_preserves_material_order_and_parameters() -> None:
    repository = InMemoryRepository()
    references = [
        ("video-b", "asset-video-b", "reference_videos"),
        ("image-a", "asset-image-a", "reference_images"),
        ("video-a", "asset-video-a", "reference_videos"),
        ("audio-a", "asset-audio-a", "reference_audios"),
        ("image-a-again", "asset-image-a", "reference_images"),
    ]
    created_asset_ids: set[str] = set()
    for _, asset_id, handle in references:
        if asset_id in created_asset_ids:
            continue
        create_media_asset(
            repository,
            asset_id,
            {
                "reference_images": AssetType.UPLOADED_IMAGE,
                "reference_videos": AssetType.UPLOADED_VIDEO,
                "reference_audios": AssetType.UPLOADED_AUDIO,
            }[handle],
        )
        created_asset_ids.add(asset_id)
    definition = canonicalize_aigc_definition(
        video_reference_definition(references)
    )
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
    node_by_id = {item.id: item for item in definition.nodes}
    run_node_by_id = {
        item.id: AigcPipelineRunNode(
            node_id=item.id,
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=(
                runtime._local_modality_result(item)
                if item.type.value in {"text", "image", "video", "audio"}
                else AigcTaskResult()
            ),
        )
        for item in definition.nodes
    }
    video_node = node_by_id["video-model"]
    incoming = [
        item for item in definition.edges if item.target_node_id == "video-model"
    ]

    params, upstream = runtime._resolve_task_params(
        video_node,
        incoming,
        node_by_id,
        run_node_by_id,
    )

    assert params == {
        "model": "doubao-seedance-2-5-260628",
        "generation_mode": "multimodal_reference",
        "task_type": "generate",
        "resolution": "1080p",
        "aspect_ratio": "16:9",
        "duration_seconds": 12,
        "generate_audio": True,
        "prompt": "延长并调整节奏",
        "first_frame_asset_id": None,
        "last_frame_asset_id": None,
        "reference_image_asset_ids": ["asset-image-a", "asset-image-a"],
        "reference_video_asset_ids": ["asset-video-b", "asset-video-a"],
        "reference_audio_asset_ids": ["asset-audio-a"],
    }
    assert upstream == [
        "video-b",
        "image-a",
        "video-a",
        "audio-a",
        "image-a-again",
        "prompt",
    ]


def test_video_input_snapshot_and_hash_include_all_cache_inputs() -> None:
    repository = InMemoryRepository()
    references = [
        ("video-a", "asset-video-a", "reference_videos"),
        ("video-b", "asset-video-b", "reference_videos"),
        ("audio-a", "asset-audio-a", "reference_audios"),
    ]
    create_media_asset(repository, "asset-video-a", AssetType.UPLOADED_VIDEO)
    create_media_asset(repository, "asset-video-b", AssetType.UPLOADED_VIDEO)
    create_media_asset(repository, "asset-audio-a", AssetType.UPLOADED_AUDIO)
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
    first = video_reference_definition(references)
    reordered = video_reference_definition(
        [references[1], references[0], references[2]]
    )
    audio_disabled = video_reference_definition(references, generate_audio=False)

    first_hash = runtime._expected_input_hashes(first, {})["video-model"]
    reordered_hash = runtime._expected_input_hashes(reordered, {})["video-model"]
    audio_disabled_hash = runtime._expected_input_hashes(
        audio_disabled,
        {},
    )["video-model"]
    snapshot = runtime._input_snapshot(first)

    assert first_hash != reordered_hash
    assert first_hash != audio_disabled_hash
    assert len(first_hash) == 64
    assert AIGC_VIDEO_EXECUTOR_VERSION == "aigc-video-v2"
    assert snapshot["video-a"] == {
        "asset_id": "asset-video-a",
        "title": None,
    }
    assert snapshot["audio-a"] == {
        "asset_id": "asset-audio-a",
        "title": None,
    }


def test_video_task_snapshot_rejects_empty_resolved_text_prompt() -> None:
    definition = canonicalize_aigc_definition(
        AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node("prompt", "text_input", 0, config={"text": "   "}),
                    node("video-model", "video_generation", 300),
                ],
                "edges": [
                    edge(
                        "prompt-edge",
                        "prompt",
                        "text",
                        "video-model",
                        "prompt",
                    )
                ],
            }
        )
    )
    node_by_id = {item.id: item for item in definition.nodes}
    run_node_by_id = {
        item.id: AigcPipelineRunNode(
            node_id=item.id,
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=(
                AigcTaskResult(
                    kind=AigcResultKind.TEXT,
                    text="   ",
                )
                if item.id == "prompt"
                else AigcTaskResult()
            ),
        )
        for item in definition.nodes
    }
    runtime = AigcPipelineRuntime(
        InMemoryRepository(),
        FakeGateway(),  # type: ignore[arg-type]
    )

    with pytest.raises(ValueError, match="non-empty prompt"):
        runtime._resolve_task_params(
            node_by_id["video-model"],
            definition.edges,
            node_by_id,
            run_node_by_id,
        )


def test_runtime_creates_video_attempt_and_projects_video_output() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="video",
                definition=text_to_video_definition(),
            )
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="video-run",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway
        finally:
            await runtime.stop()

    detail, gateway = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}
    attempt = by_id["video-model"].attempts[0]

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert attempt.type == AigcTaskType.VIDEO_GENERATION
    assert attempt.params["prompt"] == "生成广告视频"
    assert attempt.params["generation_mode"] == "text_to_video"
    assert by_id["video-output"].status == AigcRunNodeStatus.SUCCEEDED
    assert by_id["video-output"].result == by_id["video-model"].result
    assert gateway.calls == {"video-model": 1}


def test_runtime_video_semaphore_is_independent_from_llm_semaphore() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node("llm-prompt", "text_input", 0, config={"text": "文案"}),
                    node("video-prompt", "text_input", 0, config={"text": "视频"}),
                    node("llm", "llm", 300),
                    node("video", "video_generation", 300),
                ],
                "edges": [
                    edge("llm-edge", "llm-prompt", "text", "llm", "prompt"),
                    edge(
                        "video-edge",
                        "video-prompt",
                        "text",
                        "video",
                        "prompt",
                    ),
                ],
            }
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="mixed concurrency", definition=definition)
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=2,
            llm_concurrency=1,
            image_concurrency=1,
            video_concurrency=1,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="mixed-concurrency-run",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway.max_active
        finally:
            await runtime.stop()

    detail, max_active = run_runtime_scenario(scenario)

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert max_active == 2


def test_runtime_limits_concurrent_video_tasks() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node("prompt-a", "text_input", 0, config={"text": "视频 A"}),
                    node("prompt-b", "text_input", 0, config={"text": "视频 B"}),
                    node("video-a", "video_generation", 300),
                    node("video-b", "video_generation", 300),
                ],
                "edges": [
                    edge("edge-a", "prompt-a", "text", "video-a", "prompt"),
                    edge("edge-b", "prompt-b", "text", "video-b", "prompt"),
                ],
            }
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="video concurrency", definition=definition)
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=2,
            video_concurrency=1,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="video-concurrency-run",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway.max_active
        finally:
            await runtime.stop()

    detail, max_active = run_runtime_scenario(scenario)

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert max_active == 1


def test_runtime_retries_transient_video_failure() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="video retry",
                definition=text_to_video_definition(),
            )
        )
        gateway = FakeGateway(retry_first=True)
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="video-retry-run",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    video = next(item for item in detail.nodes if item.node_id == "video-model")

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert [attempt.status for attempt in video.attempts] == [
        AigcTaskStatus.FAILED,
        AigcTaskStatus.SUCCEEDED,
    ]


def test_runtime_video_failure_blocks_only_its_output_branch() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = text_to_video_definition()
        payload = definition.model_dump(mode="json", by_alias=True)
        payload["nodes"].extend(
            [
                node("llm-prompt", "text_input", 0, config={"text": "独立文案"}),
                node("llm", "llm", 300),
            ]
        )
        payload["edges"].append(
            edge("llm-edge", "llm-prompt", "text", "llm", "prompt")
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="video branch failure",
                definition=AigcPipelineDefinition.model_validate(payload),
            )
        )
        gateway = FakeGateway(fail_node="video-model")
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="video-branch-failure-run",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert by_id["video-model"].status == AigcRunNodeStatus.FAILED
    assert by_id["video-output"].status == AigcRunNodeStatus.BLOCKED
    assert by_id["llm"].status == AigcRunNodeStatus.SUCCEEDED


@pytest.mark.parametrize(
    ("fail_on_call", "failed_node_id", "completed_node_ids"),
    [
        (1, "llm", set()),
        (2, "image", {"llm"}),
    ],
)
def test_runtime_task_creation_failure_reaches_visible_failed_terminal_state(
    fail_on_call: int,
    failed_node_id: str,
    completed_node_ids: set[str],
) -> None:
    async def scenario():
        repository = FailingTaskCreationRepository(fail_on_call=fail_on_call)
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="task creation failure",
                definition=chain_definition(),
            )
        )
        runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key=f"task-creation-failure-{fail_on_call}",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert detail.run.finished_at is not None
    assert detail.run.error is not None
    assert detail.run.error.code == "task_creation_failed"
    assert detail.run.error.stage == "scheduling"
    assert by_id[failed_node_id].status == AigcRunNodeStatus.FAILED
    assert by_id[failed_node_id].current_task_id is None
    assert by_id[failed_node_id].attempts == []
    assert by_id[failed_node_id].error == detail.run.error
    assert {
        node_id
        for node_id, run_node in by_id.items()
        if run_node.status == AigcRunNodeStatus.SUCCEEDED
        and node_id in {"llm", "image"}
    } == completed_node_ids
    assert all(
        run_node.status not in {AigcRunNodeStatus.READY, AigcRunNodeStatus.RUNNING}
        for run_node in detail.nodes
    )


def test_incremental_run_reuses_available_video_result() -> None:
    async def scenario():
        repository = InMemoryRepository()
        reusable_asset_id = "reusable-video"
        create_media_asset(
            repository,
            reusable_asset_id,
            AssetType.UPLOADED_VIDEO,
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="video cache",
                definition=text_to_video_definition(),
            )
        )
        gateway = FakeGateway(
            result_assets_by_node={
                "video-model": [
                    AigcResultAsset(
                        asset_id=reusable_asset_id,
                        ordinal=0,
                        mime_type="video/mp4",
                    )
                ]
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            first = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="video-cache-first",
            )
            await runtime.wait_until_idle()
            second = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=0,
                    mode="from_node",
                    start_node_id="video-output",
                ),
                idempotency_key="video-cache-second",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(second.run.id),
                gateway,
            )
        finally:
            await runtime.stop()

    first, second, gateway = run_runtime_scenario(scenario)
    first_video = next(item for item in first.nodes if item.node_id == "video-model")
    second_video = next(item for item in second.nodes if item.node_id == "video-model")

    assert second.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert second_video.status == AigcRunNodeStatus.REUSED
    assert second_video.reused_from_task_id == first_video.current_task_id
    assert gateway.calls["video-model"] == 1


def test_video_enhancement_snapshot_hash_and_cache_reuse() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(
            repository,
            "enhancement-input",
            AssetType.UPLOADED_VIDEO,
        )
        create_media_asset(
            repository,
            "enhancement-output",
            AssetType.UPLOADED_VIDEO,
        )
        definition = video_enhancement_definition()
        changed_config = video_enhancement_definition(enhance_style="natural")
        create_media_asset(
            repository,
            "enhancement-input-2",
            AssetType.UPLOADED_VIDEO,
        )
        changed_input = video_enhancement_definition(
            input_asset_id="enhancement-input-2"
        )
        gateway = FakeGateway(
            result_assets_by_node={
                "enhance": [
                    AigcResultAsset(
                        asset_id="enhancement-output",
                        ordinal=0,
                        mime_type="video/mp4",
                    )
                ]
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        hashes = (
            runtime._expected_input_hashes(definition, {})["enhance"],
            runtime._expected_input_hashes(changed_config, {})["enhance"],
            runtime._expected_input_hashes(changed_input, {})["enhance"],
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="enhancement cache",
                definition=definition,
            )
        )
        try:
            first = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="enhancement-cache-first",
            )
            await runtime.wait_until_idle()
            second = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=0,
                    mode="from_node",
                    start_node_id="video-output",
                ),
                idempotency_key="enhancement-cache-second",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(second.run.id),
                gateway,
                hashes,
            )
        finally:
            await runtime.stop()

    first, second, gateway, hashes = run_runtime_scenario(scenario)
    first_node = next(item for item in first.nodes if item.node_id == "enhance")
    second_node = next(item for item in second.nodes if item.node_id == "enhance")
    attempt = first_node.attempts[0]

    assert attempt.type == AigcTaskType.VIDEO_ENHANCEMENT
    assert attempt.upstream == ["video-input"]
    assert attempt.params == {
        "tool_version": "standard",
        "scene": "aigc",
        "enhance_style": "hd",
        "resolution_mode": "preset",
        "resolution": "1080p",
        "bitrate_mode": "level",
        "bitrate_level": "medium",
        "bit_depth": 8,
        "input_asset_id": "enhancement-input",
    }
    assert len(set(hashes)) == 3
    assert second_node.status == AigcRunNodeStatus.REUSED
    assert second_node.reused_from_task_id == first_node.current_task_id
    assert gateway.calls == {"enhance": 1}


def test_video_enhancement_has_independent_seedance_concurrency() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(
            repository,
            "enhancement-input",
            AssetType.UPLOADED_VIDEO,
        )
        enhancement = video_enhancement_definition(include_output=False)
        seedance = text_to_video_definition()
        payload = enhancement.model_dump(mode="json", by_alias=True)
        payload["nodes"].extend(
            item.model_dump(mode="json", by_alias=True)
            for item in seedance.nodes
            if item.id != "video-output"
        )
        payload["edges"].extend(
            item.model_dump(mode="json", by_alias=True)
            for item in seedance.edges
            if item.target_node_id != "video-output"
        )
        definition = AigcPipelineDefinition.model_validate(payload)
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="independent video limits", definition=definition)
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=2,
            video_concurrency=1,
            video_enhancement_concurrency=1,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="independent-video-limits",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway.max_active
        finally:
            await runtime.stop()

    detail, max_active = run_runtime_scenario(scenario)

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert max_active == 2


def test_video_enhancement_retry_and_independent_branch_converge() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(
            repository,
            "enhancement-input",
            AssetType.UPLOADED_VIDEO,
        )
        enhancement = video_enhancement_definition(include_output=False)
        branch = branching_definition()
        payload = enhancement.model_dump(mode="json", by_alias=True)
        payload["nodes"].extend(
            item.model_dump(mode="json", by_alias=True)
            for item in branch.nodes
        )
        payload["edges"].extend(
            item.model_dump(mode="json", by_alias=True)
            for item in branch.edges
        )
        definition = AigcPipelineDefinition.model_validate(payload)
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="enhancement retry branches", definition=definition)
        )
        gateway = FakeGateway(retry_first=True)
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=3,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="enhancement-retry-branches",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    enhancement = next(item for item in detail.nodes if item.node_id == "enhance")

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert [attempt.status for attempt in enhancement.attempts] == [
        AigcTaskStatus.FAILED,
        AigcTaskStatus.SUCCEEDED,
    ]
    assert all(
        next(item for item in detail.nodes if item.node_id == node_id).status
        == AigcRunNodeStatus.SUCCEEDED
        for node_id in ("first", "second")
    )


def test_video_enhancement_cancellation_rejects_late_result() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(
            repository,
            "enhancement-input",
            AssetType.UPLOADED_VIDEO,
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="cancel enhancement",
                definition=video_enhancement_definition(),
            )
        )
        gateway = PersistingBlockingVideoGateway(repository)
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="cancel-enhancement-run",
            )
            await asyncio.wait_for(gateway.started.wait(), timeout=1)
            await runtime.cancel_run(created.run.id)
            gateway.release.set()
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
            assert gateway.created_asset_id is not None
            with pytest.raises(NotFoundError):
                repository.get_asset(gateway.created_asset_id)
            return detail
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    enhancement = next(item for item in detail.nodes if item.node_id == "enhance")

    assert detail.run.status == AigcPipelineRunStatus.CANCELED
    assert enhancement.status == AigcRunNodeStatus.CANCELED
    assert enhancement.result.kind == AigcResultKind.NONE


def test_video_face_blur_snapshot_hash_cache_and_from_node_reuse() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(
            repository,
            "face-blur-input",
            AssetType.UPLOADED_VIDEO,
        )
        create_media_asset(
            repository,
            "face-blur-input-2",
            AssetType.UPLOADED_VIDEO,
        )
        create_media_asset(
            repository,
            "face-blur-output",
            AssetType.UPLOADED_VIDEO,
        )
        definition = video_face_blur_definition()
        gateway = FakeGateway(
            result_assets_by_node={
                "face-blur": [
                    AigcResultAsset(
                        asset_id="face-blur-output",
                        ordinal=0,
                        mime_type="video/mp4",
                    )
                ]
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        hashes = {
            runtime._expected_input_hashes(definition, {})["face-blur"],
            runtime._expected_input_hashes(
                video_face_blur_definition(mask_strength="high"),
                {},
            )["face-blur"],
            runtime._expected_input_hashes(
                video_face_blur_definition(
                    input_asset_id="face-blur-input-2"
                ),
                {},
            )["face-blur"],
        }
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="face blur cache", definition=definition)
        )
        try:
            first = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="face-blur-cache-first",
            )
            await runtime.wait_until_idle()
            second = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=0,
                    mode="from_node",
                    start_node_id="video-output",
                ),
                idempotency_key="face-blur-cache-second",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(second.run.id),
                gateway,
                hashes,
            )
        finally:
            await runtime.stop()

    first, second, gateway, hashes = run_runtime_scenario(scenario)
    first_node = next(item for item in first.nodes if item.node_id == "face-blur")
    second_node = next(item for item in second.nodes if item.node_id == "face-blur")
    attempt = first_node.attempts[0]

    assert attempt.type == AigcTaskType.VIDEO_FACE_BLUR
    assert attempt.upstream == ["video-input"]
    assert attempt.params == {
        "mask_mode": "mosaic",
        "mask_strength": "medium",
        "input_asset_id": "face-blur-input",
    }
    assert len(hashes) == 3
    assert second_node.status == AigcRunNodeStatus.REUSED
    assert second_node.reused_from_task_id == first_node.current_task_id
    assert gateway.calls == {"face-blur": 1}


def test_video_face_blur_has_independent_video_concurrency() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(
            repository,
            "face-blur-input",
            AssetType.UPLOADED_VIDEO,
        )
        create_media_asset(
            repository,
            "enhancement-input",
            AssetType.UPLOADED_VIDEO,
        )
        definition = AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node(
                        "face-input",
                        "video_input",
                        0,
                        config={"asset_id": "face-blur-input"},
                    ),
                    node("face-blur", "video_face_blur", 300),
                    node(
                        "enhancement-input-node",
                        "video_input",
                        0,
                        config={"asset_id": "enhancement-input"},
                    ),
                    node("enhance", "video_enhancement", 300),
                    node("prompt", "text_input", 0, config={"text": "生成视频"}),
                    node("video-model", "video_generation", 300),
                ],
                "edges": [
                    edge("face-edge", "face-input", "video", "face-blur", "video"),
                    edge(
                        "enhance-edge",
                        "enhancement-input-node",
                        "video",
                        "enhance",
                        "video",
                    ),
                    edge("seedance-edge", "prompt", "text", "video-model", "prompt"),
                ],
            }
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="isolated face blur limit", definition=definition)
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=3,
            video_concurrency=1,
            video_enhancement_concurrency=1,
            video_face_blur_concurrency=1,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="isolated-face-blur-limit",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway.max_active
        finally:
            await runtime.stop()

    detail, max_active = run_runtime_scenario(scenario)

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert max_active == 3


def test_video_face_blur_retry_and_independent_branch_converge() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(
            repository,
            "face-blur-input",
            AssetType.UPLOADED_VIDEO,
        )
        face_blur = video_face_blur_definition(include_output=False)
        branch = branching_definition()
        payload = face_blur.model_dump(mode="json", by_alias=True)
        payload["nodes"].extend(
            item.model_dump(mode="json", by_alias=True)
            for item in branch.nodes
        )
        payload["edges"].extend(
            item.model_dump(mode="json", by_alias=True)
            for item in branch.edges
        )
        definition = AigcPipelineDefinition.model_validate(payload)
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="face blur retry branches", definition=definition)
        )
        gateway = FakeGateway(retry_first=True)
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=3,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="face-blur-retry-branches",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    face_blur = next(item for item in detail.nodes if item.node_id == "face-blur")

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert [attempt.status for attempt in face_blur.attempts] == [
        AigcTaskStatus.FAILED,
        AigcTaskStatus.SUCCEEDED,
    ]
    assert all(
        next(item for item in detail.nodes if item.node_id == node_id).status
        == AigcRunNodeStatus.SUCCEEDED
        for node_id in ("first", "second")
    )


def test_video_face_blur_cancellation_rejects_late_result() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_media_asset(
            repository,
            "face-blur-input",
            AssetType.UPLOADED_VIDEO,
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="cancel face blur",
                definition=video_face_blur_definition(),
            )
        )
        gateway = PersistingBlockingVideoGateway(repository)
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="cancel-face-blur-run",
            )
            await asyncio.wait_for(gateway.started.wait(), timeout=1)
            await runtime.cancel_run(created.run.id)
            gateway.release.set()
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
            assert gateway.created_asset_id is not None
            with pytest.raises(NotFoundError):
                repository.get_asset(gateway.created_asset_id)
            return detail
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    face_blur = next(item for item in detail.nodes if item.node_id == "face-blur")

    assert detail.run.status == AigcPipelineRunStatus.CANCELED
    assert face_blur.status == AigcRunNodeStatus.CANCELED
    assert face_blur.result.kind == AigcResultKind.NONE


def test_runtime_cancellation_rejects_and_cleans_late_video_result() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="cancel video",
                definition=text_to_video_definition(),
            )
        )
        gateway = PersistingBlockingVideoGateway(repository)
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="cancel-video-run",
            )
            await asyncio.wait_for(gateway.started.wait(), timeout=1)
            await runtime.cancel_run(created.run.id)
            gateway.release.set()
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
            assert gateway.created_asset_id is not None
            with pytest.raises(NotFoundError):
                repository.get_asset(gateway.created_asset_id)
            task = next(
                item
                for item in detail.nodes
                if item.node_id == "video-model"
            ).attempts[0]
            return detail, repository.list_aigc_task_assets(task.task_id)
        finally:
            await runtime.stop()

    detail, references = run_runtime_scenario(scenario)
    video = next(item for item in detail.nodes if item.node_id == "video-model")

    assert detail.run.status == AigcPipelineRunStatus.CANCELED
    assert video.status == AigcRunNodeStatus.CANCELED
    assert video.result.kind == AigcResultKind.NONE
    assert references == []


def test_bbox_prompt_compiles_against_each_target_image_order() -> None:
    definition = canonicalize_aigc_definition(
        AigcPipelineDefinition.model_validate({
            "nodes": [
                node(
                    "image-a",
                    "image_input",
                    0,
                    config={
                        "asset_id": "asset-a",
                        "bbox_asset_id": "asset-a",
                        "bbox": {
                            "type": "bbox",
                            "x1": 10,
                            "y1": 20,
                            "x2": 300,
                            "y2": 400,
                        },
                    },
                ),
                node(
                    "image-b",
                    "image_input",
                    0,
                    config={
                        "asset_id": "asset-b",
                        "bbox_asset_id": "asset-b",
                        "bbox": {
                            "type": "bbox",
                            "x1": 100,
                            "y1": 200,
                            "x2": 700,
                            "y2": 800,
                        },
                    },
                ),
                node(
                    "prompt",
                    "text_input",
                    300,
                    config={
                        "text": "  将  ",
                        "bbox_references": [
                            {
                                "source_node_id": "image-b",
                                "instruction": "  替换为红色包装  ",
                            },
                            {
                                "source_node_id": "image-a",
                                "instruction": "",
                            },
                        ],
                    },
                ),
                node("target", "image_to_image", 600),
                node("target-reversed", "image_to_image", 900),
            ],
            "edges": [
                edge("image-a-edge", "image-a", "image", "target", "image"),
                edge("image-b-edge", "image-b", "image", "target", "image"),
                edge("prompt-edge", "prompt", "text", "target", "prompt"),
                edge(
                    "image-b-reversed-edge",
                    "image-b",
                    "image",
                    "target-reversed",
                    "image",
                ),
                edge(
                    "image-a-reversed-edge",
                    "image-a",
                    "image",
                    "target-reversed",
                    "image",
                ),
                edge(
                    "prompt-reversed-edge",
                    "prompt",
                    "text",
                    "target-reversed",
                    "prompt",
                ),
            ],
        })
    )
    node_by_id = {item.id: item for item in definition.nodes}
    prompt = node_by_id["prompt"]

    assert _compile_bbox_prompt(
        prompt,  # type: ignore[arg-type]
        target_node_id="target",
        edges=definition.edges,
        node_by_id=node_by_id,
    ) == (
        "将 图2<bbox>100 200 700 800</bbox> 替换为红色包装 "
        "图1<bbox>10 20 300 400</bbox>"
    )
    assert _compile_bbox_prompt(
        prompt,  # type: ignore[arg-type]
        target_node_id="target-reversed",
        edges=definition.edges,
        node_by_id=node_by_id,
    ) == (
        "将 图1<bbox>100 200 700 800</bbox> 替换为红色包装 "
        "图2<bbox>10 20 300 400</bbox>"
    )

    repository = InMemoryRepository()
    create_image_asset(repository, "asset-a")
    create_image_asset(repository, "asset-b")
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
    changed_payload = definition.model_dump(mode="json", by_alias=True)
    changed_image = next(
        item for item in changed_payload["nodes"] if item["id"] == "image-b"
    )
    changed_image["config"]["bbox"]["x1"] = 101
    changed_definition = AigcPipelineDefinitionV2.model_validate(
        changed_payload
    )

    first_hash = runtime._expected_input_hashes(definition, {})["target"]
    changed_hash = runtime._expected_input_hashes(changed_definition, {})["target"]

    assert first_hash != changed_hash


def test_runtime_retries_transient_errors_and_keeps_attempt_history() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node("input", "text_input", 0, config={"text": "商品"}),
                    node("llm", "llm", 300),
                ],
                "edges": [edge("e1", "input", "text", "llm", "prompt")],
            }
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="retry", definition=definition)
        )
        gateway = FakeGateway(retry_first=True)
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="retry-run",
            )
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()
        return detail

    detail = run_runtime_scenario(scenario)
    llm = next(node for node in detail.nodes if node.node_id == "llm")

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert [attempt.status.value for attempt in llm.attempts] == [
        "failed",
        "succeeded",
    ]


def test_runtime_runs_independent_branches_concurrently() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="parallel", definition=branching_definition())
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=2,
            llm_concurrency=2,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="parallel-run",
            )
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()
        return detail, gateway.max_active

    detail, max_active = run_runtime_scenario(scenario)

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert max_active == 2


def test_runtime_blocks_only_failed_descendants() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="branches", definition=branching_definition())
        )
        gateway = FakeGateway(fail_node="first")
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="failed-branch-run",
            )
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()
        return detail

    detail = run_runtime_scenario(scenario)
    by_id = {node.node_id: node for node in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert by_id["first"].status == AigcRunNodeStatus.FAILED
    assert by_id["second"].status == AigcRunNodeStatus.SUCCEEDED


def test_runtime_rescans_queued_tasks_when_in_memory_queue_is_full() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="bounded", definition=branching_definition())
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            queue_capacity=1,
            worker_count=1,
            lease_seconds=3,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="bounded-run",
            )
            for _ in range(30):
                await asyncio.sleep(0.1)
                detail = repository.get_aigc_run(created.run.id)
                if detail.run.status != AigcPipelineRunStatus.RUNNING:
                    return detail, gateway
            return detail, gateway
        finally:
            await runtime.stop()

    detail, gateway = run_runtime_scenario(scenario)

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert gateway.calls == {"first": 1, "second": 1}


def test_runtime_retries_initial_lease_acquisition_and_drains_queue() -> None:
    async def scenario():
        repository = FlakyLeaseRepository(acquire_failures=1)
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="lease-retry", definition=chain_definition())
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            lease_retry_seconds=0.01,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="lease-retry-run",
            )
            await asyncio.wait_for(runtime.wait_until_idle(), timeout=1)
            return repository.get_aigc_run(created.run.id), repository, gateway
        finally:
            await runtime.stop()

    detail, repository, gateway = run_runtime_scenario(scenario)

    assert repository.acquire_calls >= 2
    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert gateway.calls == {"llm": 1, "image": 1}


def test_runtime_start_drains_task_queued_before_process_start() -> None:
    async def scenario():
        repository = InMemoryRepository()
        for asset_id in {"base-asset", "layer-asset"}:
            create_image_asset(repository, asset_id)
        task = _create_layer_canvas_task(
            repository,
            AigcLayerSet.model_validate(layer_set_payload()),
        )
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
            worker_count=1,
        )
        try:
            assert await runtime.start()
            await asyncio.wait_for(runtime.wait_until_idle(), timeout=1)
            return repository.get_aigc_task_attempt(task.task_id)
        finally:
            await runtime.stop()

    recovered = run_runtime_scenario(scenario)

    assert recovered.status == AigcTaskStatus.SUCCEEDED


def test_runtime_restarts_workers_after_heartbeat_loses_lease() -> None:
    async def scenario():
        repository = FlakyLeaseRepository(renew_failures=1)
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
            worker_count=1,
            lease_seconds=3,
            lease_retry_seconds=0.01,
        )
        processed: list[str] = []

        async def process(task_id: str) -> None:
            processed.append(task_id)

        runtime._process_task = process  # type: ignore[method-assign]
        try:
            assert await runtime.start()
            await asyncio.wait_for(repository.renew_failed.wait(), timeout=2)
            for _ in range(100):
                if (
                    repository.acquire_calls >= 2
                    and runtime._lease_token is not None
                    and runtime._workers
                ):
                    break
                await asyncio.sleep(0.01)
            await runtime._enqueue("after-reacquire")
            await asyncio.wait_for(runtime.wait_until_idle(), timeout=1)
            return repository.acquire_calls, processed, runtime._workers[0].done()
        finally:
            await runtime.stop()

    acquire_calls, processed, worker_done = run_runtime_scenario(scenario)

    assert acquire_calls >= 2
    assert processed == ["after-reacquire"]
    assert worker_done is False


def test_runtime_retries_lease_when_recovery_database_query_fails() -> None:
    async def scenario():
        repository = FailingLeaseRecoveryRepository()
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
            worker_count=1,
            lease_seconds=3,
            lease_retry_seconds=0.01,
        )
        try:
            assert await runtime.start()
            await asyncio.wait_for(repository.renew_failed.wait(), timeout=2)
            for _ in range(100):
                if (
                    repository.acquire_calls >= 2
                    and runtime._lease_token is not None
                    and runtime._workers
                ):
                    break
                await asyncio.sleep(0.01)
            return (
                repository.acquire_calls,
                runtime._lease_token,
                len(runtime._workers),
                runtime._workers[0].done(),
            )
        finally:
            await runtime.stop()

    acquire_calls, lease_token, worker_count, worker_done = run_runtime_scenario(
        scenario
    )

    assert acquire_calls >= 2
    assert lease_token is not None
    assert worker_count == 1
    assert worker_done is False


def test_runtime_finalizes_task_interrupted_by_lease_loss() -> None:
    async def scenario():
        repository = FlakyLeaseRepository(renew_failures=1)
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="lease-loss", definition=chain_definition())
        )
        gateway = BlockingGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=1,
            lease_seconds=3,
            lease_retry_seconds=0.01,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="lease-loss-run",
            )
            await asyncio.wait_for(gateway.started.wait(), timeout=1)
            await asyncio.wait_for(repository.renew_failed.wait(), timeout=2)
            for _ in range(100):
                detail = repository.get_aigc_run(created.run.id)
                if detail.run.status != AigcPipelineRunStatus.RUNNING:
                    return detail
                await asyncio.sleep(0.01)
            return detail
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    llm = next(node for node in detail.nodes if node.node_id == "llm")

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert llm.status == AigcRunNodeStatus.FAILED
    assert llm.attempts[0].error is not None
    assert llm.attempts[0].error.code == "worker_interrupted"


def test_runtime_cancellation_rejects_late_result() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node("input", "text_input", 0, config={"text": "商品"}),
                    node("llm", "llm", 300),
                ],
                "edges": [edge("e1", "input", "text", "llm", "prompt")],
            }
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="cancel", definition=definition)
        )
        gateway = BlockingGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="cancel-run",
            )
            await asyncio.wait_for(gateway.started.wait(), timeout=1)
            await runtime.cancel_run(created.run.id)
            gateway.release.set()
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    llm = next(node for node in detail.nodes if node.node_id == "llm")

    assert detail.run.status == AigcPipelineRunStatus.CANCELED
    assert llm.status == AigcRunNodeStatus.CANCELED
    assert llm.result.kind == AigcResultKind.NONE


def test_disconnected_flows_run_and_cancel_independently() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="disconnected flows",
                definition=disconnected_llm_definition(),
            )
        )
        gateway = GatedLlmGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=2,
            llm_concurrency=2,
        )
        try:
            run_a = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=0,
                    mode="from_node",
                    start_node_id="flow-a-model",
                ),
                idempotency_key="flow-a",
            )
            run_b = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=0,
                    mode="from_node",
                    start_node_id="flow-b-model",
                ),
                idempotency_key="flow-b",
            )

            started = {
                await asyncio.wait_for(gateway.started.get(), timeout=1),
                await asyncio.wait_for(gateway.started.get(), timeout=1),
            }
            assert started == {"flow-a-model", "flow-b-model"}

            with pytest.raises(ActiveRunConflictError):
                await runtime.submit_run(
                    pipeline.id,
                    AigcPipelineRunCreate(
                        expected_revision=0,
                        mode="from_node",
                        start_node_id="flow-a-input",
                    ),
                    idempotency_key="flow-a-conflict",
                )
            with pytest.raises(ActiveRunConflictError):
                await runtime.submit_run(
                    pipeline.id,
                    AigcPipelineRunCreate(expected_revision=0, mode="full"),
                    idempotency_key="full-while-partial-active",
                )

            await runtime.cancel_run(run_a.run.id)
            gateway.release.set()
            await asyncio.wait_for(runtime.wait_until_idle(), timeout=1)
            return (
                repository.get_aigc_run(run_a.run.id),
                repository.get_aigc_run(run_b.run.id),
            )
        finally:
            gateway.release.set()
            await runtime.stop()

    run_a, run_b = run_runtime_scenario(scenario)

    assert run_a.run.status == AigcPipelineRunStatus.CANCELED
    assert run_b.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert next(
        item for item in run_a.nodes if item.node_id == "flow-a-model"
    ).status == AigcRunNodeStatus.CANCELED
    assert next(
        item for item in run_b.nodes if item.node_id == "flow-b-model"
    ).status == AigcRunNodeStatus.SUCCEEDED


def test_shared_upstream_branches_run_without_cache_and_isolate_tasks() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="shared upstream branches",
                definition=shared_upstream_llm_definition(),
            )
        )
        gateway = GatedLlmGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=2,
            llm_concurrency=2,
        )
        try:
            run_a = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=0,
                    mode="from_node",
                    start_node_id="branch-a-model",
                ),
                idempotency_key="shared-branch-a",
            )
            run_b = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=0,
                    mode="from_node",
                    start_node_id="branch-b-model",
                ),
                idempotency_key="shared-branch-b",
            )

            started = [
                await asyncio.wait_for(gateway.started.get(), timeout=1),
                await asyncio.wait_for(gateway.started.get(), timeout=1),
            ]
            assert started == ["shared-model", "shared-model"]

            await runtime.cancel_run(run_a.run.id)
            gateway.release.set()
            await asyncio.wait_for(runtime.wait_until_idle(), timeout=1)
            return (
                repository.get_aigc_run(run_a.run.id),
                repository.get_aigc_run(run_b.run.id),
                gateway.tasks,
            )
        finally:
            gateway.release.set()
            await runtime.stop()

    run_a, run_b, tasks = run_runtime_scenario(scenario)
    shared_tasks = [task for task in tasks if task.node_id == "shared-model"]

    assert run_a.run.status == AigcPipelineRunStatus.CANCELED
    assert run_b.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert len(shared_tasks) == 2
    assert {task.run_id for task in shared_tasks} == {
        run_a.run.id,
        run_b.run.id,
    }
    assert len({task.task_id for task in shared_tasks}) == 2


def test_incremental_run_reuses_valid_ancestor() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="incremental", definition=chain_definition())
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            first = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="first-run",
            )
            await runtime.wait_until_idle()
            second = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=0,
                    mode="from_node",
                    start_node_id="image",
                ),
                idempotency_key="incremental-run",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(second.run.id),
                gateway,
            )
        finally:
            await runtime.stop()

    first, second, gateway = run_runtime_scenario(scenario)
    first_llm = next(node for node in first.nodes if node.node_id == "llm")
    second_llm = next(node for node in second.nodes if node.node_id == "llm")

    assert first.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert second.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert second_llm.status == AigcRunNodeStatus.REUSED
    assert second_llm.reused_from_task_id == first_llm.current_task_id
    assert second_llm.attempts == []
    assert gateway.calls["llm"] == 1
    assert gateway.calls["image"] == 2


def test_manual_retry_creates_a_new_run() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node("input", "text_input", 0, config={"text": "商品"}),
                    node("llm", "llm", 300),
                ],
                "edges": [edge("e1", "input", "text", "llm", "prompt")],
            }
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="manual retry", definition=definition)
        )
        gateway = FakeGateway(fail_node="llm")
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            first = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="failed-run",
            )
            await runtime.wait_until_idle()
            gateway.fail_node = None
            retry = await runtime.retry_node(
                first.run.id,
                "llm",
                idempotency_key="manual-retry",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(retry.run.id),
            )
        finally:
            await runtime.stop()

    first, retry = run_runtime_scenario(scenario)

    assert first.run.status == AigcPipelineRunStatus.FAILED
    assert retry.run.id != first.run.id
    assert retry.run.mode.value == "retry_node"
    assert retry.run.source_run_id == first.run.id
    assert retry.run.status == AigcPipelineRunStatus.SUCCEEDED


def layer_set_payload(
    *,
    digest: str = "a" * 64,
    layer_asset_id: str = "layer-asset",
) -> dict[str, object]:
    return {
        "id": "layer-set-1",
        "parent_layer_set_id": None,
        "source_asset_id": "source-asset",
        "base_asset_id": "base-asset",
        "canvas_width": 1000,
        "canvas_height": 800,
        "version": 0,
        "digest": digest,
        "layers": [
            {
                "id": "layer-1",
                "asset_id": layer_asset_id,
                "z_index": 1,
                "name": "商品",
                "description": "",
                "bbox_absolute": [100, 100, 500, 500],
                "bbox_normalized": [100, 125, 500, 625],
                "visible": True,
                "x": 100,
                "y": 100,
                "scale": 1,
            }
        ],
    }


def image_layer_payload(
    *,
    asset_id: str = "layer-asset",
    digest: str = "a" * 64,
) -> dict[str, object]:
    layer = layer_set_payload(
        digest=digest,
        layer_asset_id=asset_id,
    )["layers"][0]
    assert isinstance(layer, dict)
    return {
        "asset_id": asset_id,
        "layer_set_id": "layer-set-1",
        "layer_set_version": 0,
        "layer_set_digest": digest,
        "layer_id": "layer-1",
        "bbox_absolute": layer["bbox_absolute"],
        "bbox_normalized": layer["bbox_normalized"],
        "x": layer["x"],
        "y": layer["y"],
        "scale": layer["scale"],
        "z_index": layer["z_index"],
    }


def test_operation_specific_task_types_keep_legacy_default() -> None:
    legacy = AigcPipelineDefinition.model_validate(
        {"nodes": [node("legacy", "image_to_image", 0)]}
    ).nodes[0]
    image_edit = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "edit",
                    "image_to_image",
                    0,
                    config={"operation": "image_edit"},
                )
            ]
        }
    ).nodes[0]
    decomposition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "decompose",
                    "image_to_image",
                    0,
                    config={"operation": "layer_decomposition"},
                )
            ]
        }
    ).nodes[0]
    canvas = AigcPipelineDefinition.model_validate(
        {"nodes": [node("canvas", "layer_canvas", 0)]}
    ).nodes[0]
    composite = AigcPipelineDefinition.model_validate(
        {"nodes": [node("composite", "layer_composite", 0)]}
    ).nodes[0]

    assert legacy.config.operation == "image_to_image"  # type: ignore[union-attr]
    assert _task_type(legacy) == AigcTaskType.IMAGE_TO_IMAGE
    assert _task_type(image_edit) == AigcTaskType.IMAGE_EDIT
    assert _task_type(decomposition) == AigcTaskType.LAYER_DECOMPOSITION
    assert decomposition.config.size == "auto"  # type: ignore[union-attr]
    assert _task_type(canvas) == AigcTaskType.LAYER_CANVAS
    assert _task_type(composite) == AigcTaskType.LAYER_COMPOSITE
    assert AIGC_LAYER_EXECUTOR_VERSION == "aigc-layer-v1"


def test_resolve_plain_edit_and_decomposition_params_by_operation() -> None:
    runtime = AigcPipelineRuntime(
        InMemoryRepository(),
        FakeGateway(),  # type: ignore[arg-type]
    )
    definition = canonicalize_aigc_definition(
        AigcPipelineDefinition.model_validate({
            "nodes": [
                node(
                    "image",
                    "image_input",
                    0,
                    config={"asset_id": "asset-1"},
                ),
                node("prompt", "text_input", 0, config={"text": "移除文字"}),
                node(
                    "edit",
                    "image_to_image",
                    300,
                    config={"operation": "image_edit"},
                ),
                node(
                    "decompose",
                    "image_to_image",
                    300,
                    config={
                        "operation": "layer_decomposition",
                        "size": "auto",
                    },
                ),
            ],
            "edges": [
                edge("edit-image", "image", "image", "edit", "edit_image"),
                edge("edit-prompt", "prompt", "text", "edit", "prompt"),
                edge(
                    "decomposition-image",
                    "image",
                    "image",
                    "decompose",
                    "image",
                ),
            ],
        })
    )
    node_by_id = {item.id: item for item in definition.nodes}
    run_nodes = {
        item.id: AigcPipelineRunNode(
            node_id=item.id,
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=(
                AigcTaskResult(
                    kind=AigcResultKind.ASSETS,
                    assets=[
                        AigcResultAsset(
                            asset_id="asset-1",
                            ordinal=0,
                            available=True,
                        )
                    ],
                )
                if item.id == "image"
                else (
                    AigcTaskResult(
                        kind=AigcResultKind.TEXT,
                        text="移除文字",
                    )
                    if item.id == "prompt"
                    else AigcTaskResult()
                )
            ),
        )
        for item in definition.nodes
    }

    edit_params, _ = runtime._resolve_task_params(
        node_by_id["edit"],
        definition.edges[:2],
        node_by_id,
        run_nodes,
    )
    decomposition_params, _ = runtime._resolve_task_params(
        node_by_id["decompose"],
        definition.edges[2:],
        node_by_id,
        run_nodes,
    )

    assert edit_params["edit_image_asset_id"] == "asset-1"
    assert edit_params["prompt"] == "移除文字"
    assert "reference_asset_ids" not in edit_params
    assert decomposition_params["source_asset_id"] == "asset-1"
    assert decomposition_params["prompt"] == ""
    assert decomposition_params["size"] == "auto"


def test_resolve_layer_canvas_and_composite_params_preserves_snapshot_source() -> None:
    layer_set = AigcLayerSet.model_validate(layer_set_payload())
    selected = AigcImageLayer.model_validate(image_layer_payload())
    replacement = AigcEditedLayer.model_validate(
        image_layer_payload(asset_id="edited-asset")
    )
    definition = canonicalize_aigc_definition(
        AigcPipelineDefinition.model_validate({
            "nodes": [
                node(
                    "producer",
                    "image_to_image",
                    0,
                    config={"operation": "layer_decomposition"},
                ),
                node(
                    "canvas",
                    "layer_canvas",
                    200,
                    config={
                        "selected_layer_id": "layer-1",
                        "source_layer_set": {
                            "id": layer_set.id,
                            "version": layer_set.version,
                            "digest": layer_set.digest,
                        },
                    },
                ),
                node(
                    "edit",
                    "image_to_image",
                    400,
                    config={"operation": "image_edit"},
                ),
                node("edit-prompt", "text_input", 400, config={"text": "改红"}),
                node("composite", "layer_composite", 600),
            ],
            "edges": [
                edge("layers", "producer", "layers", "canvas", "layers"),
                edge(
                    "selected",
                    "canvas",
                    "selected_layer",
                    "edit",
                    "edit_layer",
                ),
                edge(
                    "edit-prompt-edge",
                    "edit-prompt",
                    "text",
                    "edit",
                    "prompt",
                ),
                edge(
                    "composite-layers",
                    "canvas",
                    "layers",
                    "composite",
                    "layers",
                ),
                edge(
                    "replacement",
                    "edit",
                    "edited_layer",
                    "composite",
                    "replacement",
                ),
            ],
        })
    )
    node_by_id = {item.id: item for item in definition.nodes}
    run_node_by_id = {
        "producer": AigcPipelineRunNode(
            node_id="producer",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.LAYER_SET,
                layer_set=layer_set,
            ),
        ),
        "canvas": AigcPipelineRunNode(
            node_id="canvas",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.LAYER_CANVAS,
                layer_set=layer_set,
                image_layer=selected,
            ),
        ),
        "edit": AigcPipelineRunNode(
            node_id="edit",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.EDITED_LAYER,
                edited_layer=replacement,
            ),
        ),
        "edit-prompt": AigcPipelineRunNode(
            node_id="edit-prompt",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
                result=AigcTaskResult(
                    kind=AigcResultKind.TEXT,
                    text="改红",
                ),
        ),
        "composite": AigcPipelineRunNode(
            node_id="composite",
            included_in_plan=True,
            status=AigcRunNodeStatus.IDLE,
        ),
    }
    runtime = AigcPipelineRuntime(
        InMemoryRepository(),
        FakeGateway(),  # type: ignore[arg-type]
    )

    canvas_params, _ = runtime._resolve_task_params(
        node_by_id["canvas"],
        [definition.edges[0]],
        node_by_id,
        run_node_by_id,
    )
    edit_params, _ = runtime._resolve_task_params(
        node_by_id["edit"],
        definition.edges[1:3],
        node_by_id,
        run_node_by_id,
    )
    composite_params, _ = runtime._resolve_task_params(
        node_by_id["composite"],
        definition.edges[3:],
        node_by_id,
        run_node_by_id,
    )

    assert canvas_params["input_layer_set"]["digest"] == "a" * 64
    assert canvas_params["upstream_layer_set"] == {
        "id": "layer-set-1",
        "version": 0,
        "digest": "a" * 64,
    }
    assert edit_params["edit_layer"]["layer_id"] == "layer-1"
    assert composite_params["replacement"]["asset_id"] == "edited-asset"
    assert composite_params["input_layer_set"]["id"] == "layer-set-1"


def test_resolve_layer_composite_params_without_replacement() -> None:
    layer_set = AigcLayerSet.model_validate(layer_set_payload())
    definition = canonicalize_aigc_definition(
        AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node(
                        "producer",
                        "image_to_image",
                        0,
                        config={"operation": "layer_decomposition"},
                    ),
                    node(
                        "canvas",
                        "layer_canvas",
                        200,
                        config={
                            "source_layer_set": {
                                "id": layer_set.id,
                                "version": layer_set.version,
                                "digest": layer_set.digest,
                            },
                        },
                    ),
                    node("composite", "layer_composite", 400),
                ],
                "edges": [
                    edge("layers", "producer", "layers", "canvas", "layers"),
                    edge(
                        "composite-layers",
                        "canvas",
                        "layers",
                        "composite",
                        "layers",
                    ),
                ],
            }
        )
    )
    node_by_id = {item.id: item for item in definition.nodes}
    run_node_by_id = {
        "producer": AigcPipelineRunNode(
            node_id="producer",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.LAYER_SET,
                layer_set=layer_set,
            ),
        ),
        "canvas": AigcPipelineRunNode(
            node_id="canvas",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.LAYER_CANVAS,
                layer_set=layer_set,
            ),
        ),
        "composite": AigcPipelineRunNode(
            node_id="composite",
            included_in_plan=True,
            status=AigcRunNodeStatus.IDLE,
        ),
    }
    runtime = AigcPipelineRuntime(
        InMemoryRepository(),
        FakeGateway(),  # type: ignore[arg-type]
    )

    params, _ = runtime._resolve_task_params(
        node_by_id["composite"],
        [definition.edges[1]],
        node_by_id,
        run_node_by_id,
    )

    assert params["input_layer_set"]["id"] == layer_set.id
    assert "replacement" not in params


def test_layer_canvas_rejects_stale_source_and_composite_rejects_mismatch() -> None:
    layer_set = AigcLayerSet.model_validate(layer_set_payload())
    stale_definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("producer", "image_to_image", 0),
                node(
                    "canvas",
                    "layer_canvas",
                    200,
                    config={
                        "source_layer_set": {
                            "id": layer_set.id,
                            "version": 0,
                            "digest": "b" * 64,
                        }
                    },
                ),
            ],
            "edges": [edge("layers", "producer", "layers", "canvas", "layers")],
        }
    )
    node_by_id = {item.id: item for item in stale_definition.nodes}
    run_nodes = {
        "producer": AigcPipelineRunNode(
            node_id="producer",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.LAYER_SET,
                layer_set=layer_set,
            ),
        ),
        "canvas": AigcPipelineRunNode(
            node_id="canvas",
            included_in_plan=True,
        ),
    }
    runtime = AigcPipelineRuntime(
        InMemoryRepository(),
        FakeGateway(),  # type: ignore[arg-type]
    )

    with pytest.raises(ValueError, match="source is stale"):
        runtime._resolve_task_params(
            node_by_id["canvas"],
            stale_definition.edges,
            node_by_id,
            run_nodes,
        )

    mismatched = AigcEditedLayer.model_validate(
        {
            **image_layer_payload(asset_id="edited-asset"),
            "layer_set_digest": "c" * 64,
        }
    )
    with pytest.raises(ValueError, match="does not match"):
        _validate_layer_composite_source(layer_set, mismatched)


def test_stale_layer_canvas_scheduling_failure_converges_run() -> None:
    async def scenario():
        repository = InMemoryRepository()
        create_image_asset(repository, "source-asset")
        layer_set = AigcLayerSet.model_validate(layer_set_payload())
        definition = AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    node(
                        "source",
                        "image_input",
                        0,
                        config={"asset_id": "source-asset"},
                    ),
                    node(
                        "decompose",
                        "image_to_image",
                        200,
                        config={"operation": "layer_decomposition"},
                    ),
                    node(
                        "canvas",
                        "layer_canvas",
                        400,
                        config={
                            "source_layer_set": {
                                "id": layer_set.id,
                                "version": layer_set.version,
                                "digest": "b" * 64,
                            }
                        },
                    ),
                    node("output", "image_output", 600),
                ],
                "edges": [
                    edge("source-edge", "source", "image", "decompose", "image"),
                    edge("layers-edge", "decompose", "layers", "canvas", "layers"),
                    edge("output-edge", "canvas", "layers", "output", "image"),
                ],
            }
        )
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="stale canvas", definition=definition)
        )
        created = repository.create_aigc_run(
            AigcPipelineRun(
                pipeline_id=pipeline.id,
                run_number=1,
                pipeline_revision=0,
                mode="full",
                status=AigcPipelineRunStatus.RUNNING,
                definition_snapshot=definition,
            ),
            idempotency_key="stale-canvas",
            nodes=[
                AigcPipelineRunNode(
                    node_id="source",
                    included_in_plan=True,
                    status=AigcRunNodeStatus.SUCCEEDED,
                ),
                AigcPipelineRunNode(
                    node_id="decompose",
                    included_in_plan=True,
                    status=AigcRunNodeStatus.SUCCEEDED,
                    input_hash="d" * 64,
                    result=AigcTaskResult(
                        kind=AigcResultKind.LAYER_SET,
                        layer_set=layer_set,
                    ),
                ),
                AigcPipelineRunNode(
                    node_id="canvas",
                    included_in_plan=True,
                ),
                AigcPipelineRunNode(
                    node_id="output",
                    included_in_plan=True,
                ),
            ],
        )
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
        )

        await runtime._schedule_ready_nodes(created.run.id)
        await runtime._finalize_run(created.run.id)
        return repository.get_aigc_run(created.run.id)

    detail = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert detail.run.finished_at is not None
    assert detail.run.error is not None
    assert detail.run.error.code == "invalid_input"
    assert detail.run.error.stage == "scheduling"
    assert by_id["canvas"].status == AigcRunNodeStatus.FAILED
    assert by_id["canvas"].error == detail.run.error
    assert by_id["output"].status == AigcRunNodeStatus.BLOCKED


def test_plan_node_with_excluded_idle_dependency_fails_and_finalizes() -> None:
    async def scenario():
        repository = InMemoryRepository()
        definition = chain_definition()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="unsatisfied execution plan",
                definition=definition,
            )
        )
        created = repository.create_aigc_run(
            AigcPipelineRun(
                pipeline_id=pipeline.id,
                run_number=1,
                pipeline_revision=0,
                mode="from_node",
                start_node_id="llm",
                status=AigcPipelineRunStatus.RUNNING,
                definition_snapshot=definition,
            ),
            idempotency_key="unsatisfied-execution-plan",
            nodes=[
                AigcPipelineRunNode(
                    node_id="input",
                    included_in_plan=False,
                ),
                AigcPipelineRunNode(
                    node_id="llm",
                    included_in_plan=True,
                ),
                AigcPipelineRunNode(
                    node_id="image",
                    included_in_plan=True,
                ),
                AigcPipelineRunNode(
                    node_id="output",
                    included_in_plan=True,
                ),
            ],
        )
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
        )

        await runtime._schedule_ready_nodes(created.run.id)
        await runtime._finalize_run(created.run.id)
        return repository.get_aigc_run(created.run.id)

    detail = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert detail.run.finished_at is not None
    assert detail.run.error is not None
    assert detail.run.error.code == "invalid_input"
    assert "excludes required upstream node(s): input" in detail.run.error.message
    assert by_id["input"].status == AigcRunNodeStatus.IDLE
    assert by_id["llm"].status == AigcRunNodeStatus.FAILED
    assert by_id["image"].status == AigcRunNodeStatus.BLOCKED
    assert by_id["output"].status == AigcRunNodeStatus.BLOCKED


def test_worker_isolates_unhandled_item_error_and_keeps_consuming() -> None:
    async def scenario():
        repository = InMemoryRepository()
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
            worker_count=1,
        )
        processed: list[str] = []

        async def unstable_process(task_id: str) -> None:
            processed.append(task_id)
            if task_id == "broken":
                raise RuntimeError("unexpected scheduling failure")

        async def isolated(_task_id: str) -> None:
            return None

        runtime._process_task = unstable_process  # type: ignore[method-assign]
        runtime._isolate_worker_item_failure = isolated  # type: ignore[method-assign]
        try:
            assert await runtime.start()
            await runtime._enqueue("broken")
            await runtime._enqueue("next")
            await asyncio.wait_for(runtime.wait_until_idle(), timeout=1)
            assert runtime._workers
            return processed, runtime._workers[0].done()
        finally:
            await runtime.stop()

    processed, worker_done = run_runtime_scenario(scenario)

    assert processed == ["broken", "next"]
    assert worker_done is False


def test_layer_canvas_creates_immutable_derived_snapshot_and_selected_layer() -> None:
    payload = layer_set_payload()
    layers = payload["layers"]
    assert isinstance(layers, list)
    layers.extend(
        [
            {
                **layers[0],
                "id": "layer-2",
                "asset_id": "layer-asset-2",
                "z_index": 2,
                "name": "阴影",
            },
            {
                **layers[0],
                "id": "layer-3",
                "asset_id": "layer-asset-3",
                "z_index": 3,
                "name": "文案",
            },
        ]
    )
    source = AigcLayerSet.model_validate(payload)
    source_dump = source.model_dump(mode="json")
    task = AigcPipelineTaskAttempt(
        pipeline_id="pipeline-1",
        run_id="run-1",
        node_id="canvas",
        type=AigcTaskType.LAYER_CANVAS,
        params={
            "selected_layer_id": "layer-1",
            "source_layer_set": {
                "id": source.id,
                "version": source.version,
                "digest": source.digest,
            },
            "transform_patches": [
                {
                    "layer_id": "layer-1",
                    "x": 240,
                    "y": 160,
                    "scale": 1.5,
                    "z_index": 3,
                    "visible": False,
                },
                {"layer_id": "layer-2", "deleted": True},
                {"layer_id": "layer-3", "z_index": 1},
            ],
            "input_layer_set": source_dump,
            "upstream_layer_set": {
                "id": source.id,
                "version": source.version,
                "digest": source.digest,
            },
        },
    )

    execution = _execute_layer_canvas(task)

    derived = execution.result.layer_set
    selected = execution.result.image_layer
    assert derived is not None
    assert selected is not None
    assert source.model_dump(mode="json") == source_dump
    assert derived.id != source.id
    assert derived.parent_layer_set_id == source.id
    assert derived.version == source.version + 1
    assert derived.digest != source.digest
    assert [layer.id for layer in derived.layers] == ["layer-3", "layer-1"]
    assert [layer.z_index for layer in derived.layers] == [1, 2]
    assert derived.layers[1].x == 240
    assert derived.layers[1].y == 160
    assert derived.layers[1].scale == 1.5
    assert derived.layers[1].visible is False
    assert selected.layer_set_id == derived.id
    assert selected.layer_set_version == derived.version
    assert selected.layer_set_digest == derived.digest
    assert selected.layer_id == "layer-1"
    assert selected.z_index == 2


def execute_layer_canvas_patches(
    patches: list[dict[str, object]],
    *,
    selected_layer_id: str | None = "layer-1",
) -> tuple[AigcLayerSet, dict[str, object], AigcGatewayExecution]:
    payload = layer_set_payload()
    layers = payload["layers"]
    assert isinstance(layers, list)
    layers.extend(
        [
            {
                **layers[0],
                "id": "layer-2",
                "asset_id": "layer-asset-2",
                "z_index": 2,
                "name": "阴影",
            },
            {
                **layers[0],
                "id": "layer-3",
                "asset_id": "layer-asset-3",
                "z_index": 3,
                "name": "文案",
            },
        ]
    )
    source = AigcLayerSet.model_validate(payload)
    source_dump = source.model_dump(mode="json")
    task = AigcPipelineTaskAttempt(
        pipeline_id="pipeline-1",
        run_id="run-1",
        node_id="canvas",
        type=AigcTaskType.LAYER_CANVAS,
        params={
            "selected_layer_id": selected_layer_id,
            "transform_patches": patches,
            "input_layer_set": source_dump,
        },
    )
    return source, source_dump, _execute_layer_canvas(task)


def test_layer_canvas_move_and_scale_patch_preserves_null_fields() -> None:
    _, _, execution = execute_layer_canvas_patches(
        [
            {
                "layer_id": "layer-1",
                "x": 240,
                "y": 160,
                "scale": 1.5,
                "z_index": None,
                "visible": None,
                "deleted": None,
            }
        ]
    )

    derived = execution.result.layer_set
    assert derived is not None
    changed = derived.layers[0]
    assert (changed.x, changed.y, changed.scale) == (240, 160, 1.5)
    assert changed.visible is True
    assert changed.z_index == 1


def test_layer_canvas_visibility_patch_preserves_other_null_fields() -> None:
    _, _, execution = execute_layer_canvas_patches(
        [
            {
                "layer_id": "layer-1",
                "x": None,
                "y": None,
                "scale": None,
                "z_index": None,
                "visible": False,
                "deleted": None,
            }
        ]
    )

    derived = execution.result.layer_set
    assert derived is not None
    changed = derived.layers[0]
    assert (changed.x, changed.y, changed.scale) == (100, 100, 1)
    assert changed.visible is False
    assert changed.z_index == 1


def test_layer_canvas_z_index_patch_preserves_other_null_fields() -> None:
    _, _, execution = execute_layer_canvas_patches(
        [
            {
                "layer_id": "layer-3",
                "x": None,
                "y": None,
                "scale": None,
                "z_index": 1,
                "visible": None,
                "deleted": None,
            }
        ]
    )

    derived = execution.result.layer_set
    assert derived is not None
    assert [layer.id for layer in derived.layers] == [
        "layer-3",
        "layer-1",
        "layer-2",
    ]
    assert [layer.z_index for layer in derived.layers] == [1, 2, 3]
    moved = derived.layers[0]
    assert (moved.x, moved.y, moved.scale, moved.visible) == (100, 100, 1, True)


@pytest.mark.parametrize(
    ("deleted", "expected_ids"),
    [
        (True, ["layer-1", "layer-3"]),
        (False, ["layer-1", "layer-2", "layer-3"]),
        (None, ["layer-1", "layer-2", "layer-3"]),
    ],
)
def test_layer_canvas_only_deletes_when_deleted_is_true(
    deleted: bool | None,
    expected_ids: list[str],
) -> None:
    patch: dict[str, object] = {"layer_id": "layer-2", "deleted": deleted}
    if deleted is not True:
        patch["x"] = 125

    _, _, execution = execute_layer_canvas_patches(
        [patch],
        selected_layer_id=None,
    )

    derived = execution.result.layer_set
    assert derived is not None
    assert [layer.id for layer in derived.layers] == expected_ids


def test_layer_canvas_applies_mixed_partial_patches() -> None:
    _, _, execution = execute_layer_canvas_patches(
        [
            {
                "layer_id": "layer-1",
                "x": 240,
                "y": None,
                "scale": 1.5,
                "z_index": None,
                "visible": False,
                "deleted": False,
            },
            {"layer_id": "layer-2", "deleted": True},
            {
                "layer_id": "layer-3",
                "x": None,
                "y": 220,
                "scale": None,
                "z_index": 1,
                "visible": None,
                "deleted": None,
            },
        ]
    )

    derived = execution.result.layer_set
    assert derived is not None
    assert [layer.id for layer in derived.layers] == ["layer-3", "layer-1"]
    assert [layer.z_index for layer in derived.layers] == [1, 2]
    assert (derived.layers[0].x, derived.layers[0].y) == (100, 220)
    assert (
        derived.layers[1].x,
        derived.layers[1].y,
        derived.layers[1].scale,
        derived.layers[1].visible,
    ) == (240, 100, 1.5, False)


def test_layer_canvas_partial_patch_produces_valid_pydantic_result() -> None:
    _, _, execution = execute_layer_canvas_patches(
        [
            {
                "layer_id": "layer-1",
                "x": 240,
                "y": 160,
                "scale": 1.5,
                "z_index": None,
                "visible": None,
                "deleted": None,
            }
        ]
    )

    validated = AigcTaskResult.model_validate(
        execution.result.model_dump(mode="json")
    )

    assert validated == execution.result


def test_layer_canvas_partial_patch_does_not_mutate_input_snapshot() -> None:
    source, source_dump, _ = execute_layer_canvas_patches(
        [
            {
                "layer_id": "layer-1",
                "x": 240,
                "y": None,
                "scale": None,
                "z_index": None,
                "visible": None,
                "deleted": None,
            }
        ]
    )

    assert source.model_dump(mode="json") == source_dump


@pytest.mark.parametrize(
    ("selected_layer_id", "patches", "message"),
    [
        ("base-asset", [], "base layer cannot be selected"),
        (
            "layer-1",
            [{"layer_id": "layer-1", "deleted": True}],
            "selected layer is unavailable",
        ),
        (
            None,
            [{"layer_id": "base-asset", "visible": False}],
            "base layer cannot be transformed",
        ),
    ],
)
def test_layer_canvas_rejects_base_and_deleted_layer_operations(
    selected_layer_id,
    patches,
    message,
) -> None:
    task = AigcPipelineTaskAttempt(
        pipeline_id="pipeline-1",
        run_id="run-1",
        node_id="canvas",
        type=AigcTaskType.LAYER_CANVAS,
        params={
            "selected_layer_id": selected_layer_id,
            "transform_patches": patches,
            "input_layer_set": layer_set_payload(),
        },
    )

    with pytest.raises(ValueError, match=message):
        _execute_layer_canvas(task)


def test_structured_result_projection_is_port_specific() -> None:
    layer_set = AigcLayerSet.model_validate(layer_set_payload())
    selected = AigcImageLayer.model_validate(image_layer_payload())
    result = AigcTaskResult(
        kind=AigcResultKind.LAYER_CANVAS,
        layer_set=layer_set,
        image_layer=selected,
    )

    layers = _project_result_for_port(result, "layers")
    selected_layer = _project_result_for_port(result, "selected_layer")

    assert layers.kind == AigcResultKind.LAYER_SET
    assert layers.layer_set == layer_set
    assert layers.image_layer is None
    assert selected_layer.kind == AigcResultKind.IMAGE_LAYER
    assert selected_layer.image_layer == selected
    assert selected_layer.layer_set is None


def test_layer_input_hash_and_cache_availability_cover_snapshot_assets() -> None:
    repository = InMemoryRepository()
    runtime = AigcPipelineRuntime(
        repository,
        FakeGateway(),  # type: ignore[arg-type]
    )
    first_set = AigcLayerSet.model_validate(layer_set_payload(digest="a" * 64))
    changed_set = AigcLayerSet.model_validate(layer_set_payload(digest="b" * 64))
    new_identity_set = AigcLayerSet.model_validate(
        {
            **layer_set_payload(digest="a" * 64),
            "id": "layer-set-2",
        }
    )
    canvas = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("producer", "image_to_image", 0),
                node("canvas", "layer_canvas", 200),
            ],
            "edges": [edge("layers", "producer", "layers", "canvas", "layers")],
        }
    )
    node_by_id = {item.id: item for item in canvas.nodes}
    source_run_node = AigcPipelineRunNode(
        node_id="producer",
        included_in_plan=True,
        status=AigcRunNodeStatus.SUCCEEDED,
        result=AigcTaskResult(
            kind=AigcResultKind.LAYER_SET,
            layer_set=first_set,
        ),
    )
    run_nodes = {
        "producer": source_run_node,
        "canvas": AigcPipelineRunNode(
            node_id="canvas",
            included_in_plan=True,
        ),
    }
    params = {"input_layer_set": first_set.model_dump(mode="json")}
    first_hash = runtime._hash_resolved_task(
        node_by_id["canvas"],
        params,
        canvas.edges,
        node_by_id,
        run_nodes,
    )
    run_nodes["producer"].result = AigcTaskResult(
        kind=AigcResultKind.LAYER_SET,
        layer_set=changed_set,
    )
    changed_hash = runtime._hash_resolved_task(
        node_by_id["canvas"],
        {"input_layer_set": changed_set.model_dump(mode="json")},
        canvas.edges,
        node_by_id,
        run_nodes,
    )
    run_nodes["producer"].result = AigcTaskResult(
        kind=AigcResultKind.LAYER_SET,
        layer_set=new_identity_set,
    )
    new_identity_hash = runtime._hash_resolved_task(
        node_by_id["canvas"],
        {"input_layer_set": new_identity_set.model_dump(mode="json")},
        canvas.edges,
        node_by_id,
        run_nodes,
    )
    configured_canvas = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("producer", "image_to_image", 0),
                node(
                    "canvas",
                    "layer_canvas",
                    200,
                    config={
                        "selected_layer_id": "layer-1",
                        "source_layer_set": {
                            "id": first_set.id,
                            "version": first_set.version,
                            "digest": first_set.digest,
                        },
                        "transform_patches": [
                            {"layer_id": "layer-1", "x": 101}
                        ],
                    },
                ),
            ],
            "edges": [
                edge("layers", "producer", "layers", "canvas", "layers")
            ],
        }
    )
    configured_nodes = {item.id: item for item in configured_canvas.nodes}
    run_nodes["producer"].result = AigcTaskResult(
        kind=AigcResultKind.LAYER_SET,
        layer_set=first_set,
    )
    configured_hash = runtime._hash_resolved_task(
        configured_nodes["canvas"],
        {"input_layer_set": first_set.model_dump(mode="json")},
        configured_canvas.edges,
        configured_nodes,
        run_nodes,
    )

    assert first_hash != changed_hash
    assert first_hash != new_identity_hash
    assert first_hash != configured_hash
    assert runtime._result_available(source_run_node.result) is False
    for asset_id in {"base-asset", "layer-asset"}:
        create_image_asset(repository, asset_id)
    assert runtime._result_available(source_run_node.result) is True


@pytest.mark.parametrize(
    ("case", "asset_id", "status"),
    [
        ("failed", "layer-asset", Status.FAILED),
        ("pending", "base-asset", Status.QUEUED),
        ("deleted", "layer-asset", None),
        ("missing", "layer-asset", None),
    ],
)
def test_structured_result_cache_rejects_unavailable_required_assets(
    case: str,
    asset_id: str,
    status: Status | None,
) -> None:
    repository = InMemoryRepository()
    runtime = AigcPipelineRuntime(
        repository,
        FakeGateway(),  # type: ignore[arg-type]
    )
    result = AigcTaskResult(
        kind=AigcResultKind.LAYER_SET,
        layer_set=AigcLayerSet.model_validate(layer_set_payload()),
    )
    for required_id in {"base-asset", "layer-asset"}:
        if case == "missing" and required_id == asset_id:
            continue
        create_image_asset(repository, required_id)
    if case == "deleted":
        repository.delete_tool_asset(asset_id)
    elif status is not None:
        repository.update_asset(asset_id, status=status)

    assert runtime._result_available(result) is False


def _create_layer_canvas_task(
    repository: InMemoryRepository,
    layer_set: AigcLayerSet,
) -> AigcPipelineTaskAttempt:
    definition = AigcPipelineDefinition.model_validate(
        {"nodes": [node("canvas", "layer_canvas", 0)]}
    )
    pipeline = repository.create_aigc_pipeline(
        AigcPipelineCreate(name="layer trace", definition=definition)
    )
    run = repository.create_aigc_run(
        AigcPipelineRun(
            pipeline_id=pipeline.id,
            run_number=1,
            pipeline_revision=pipeline.revision,
            mode="full",
            definition_snapshot=definition,
        ),
        idempotency_key="layer-trace-run",
        nodes=[
            AigcPipelineRunNode(
                node_id="canvas",
                included_in_plan=True,
                status=AigcRunNodeStatus.QUEUED,
            )
        ],
    )
    return repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=run.run.id,
            node_id="canvas",
            type=AigcTaskType.LAYER_CANVAS,
            params={
                "selected_layer_id": "layer-1",
                "transform_patches": [],
                "input_layer_set": layer_set.model_dump(mode="json"),
            },
        ),
        idempotency_key="layer-trace-task",
    )


def test_layer_canvas_records_complete_input_and_output_asset_trace() -> None:
    repository = InMemoryRepository()
    for asset_id in {"base-asset", "layer-asset"}:
        create_image_asset(repository, asset_id)
    layer_set = AigcLayerSet.model_validate(layer_set_payload())
    task = _create_layer_canvas_task(repository, layer_set)
    runtime = AigcPipelineRuntime(
        repository,
        FakeGateway(),  # type: ignore[arg-type]
    )

    execution = _execute_layer_canvas(task)
    runtime._record_layer_canvas_assets(task, execution.result)

    references = repository.list_aigc_task_assets(task.task_id)
    assert {
        (
            reference.direction,
            reference.slot,
            reference.ordinal,
            reference.asset_id,
        )
        for reference in references
    } == {
        (AigcAssetDirection.INPUT, "base", 0, "base-asset"),
        (AigcAssetDirection.INPUT, "layers", 0, "layer-asset"),
        (AigcAssetDirection.OUTPUT, "base", 0, "base-asset"),
        (AigcAssetDirection.OUTPUT, "layers", 0, "layer-asset"),
    }


def test_layer_canvas_cancellation_cleanup_preserves_shared_assets() -> None:
    async def scenario() -> None:
        repository = InMemoryRepository()
        for asset_id in {"base-asset", "layer-asset"}:
            create_image_asset(repository, asset_id)
            repository.update_asset(
                asset_id,
                metadata={"task_id": "upstream-layer-task"},
            )
        layer_set = AigcLayerSet.model_validate(layer_set_payload())
        task = _create_layer_canvas_task(repository, layer_set)
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
        )
        execution = _execute_layer_canvas(task)
        runtime._record_layer_canvas_assets(task, execution.result)
        repository.update_aigc_task_attempt(
            task.task_id,
            status=AigcTaskStatus.CANCELED,
        )

        await runtime._cleanup_task_outputs(task.task_id)

        references = repository.list_aigc_task_assets(task.task_id)
        assert {reference.direction for reference in references} == {
            AigcAssetDirection.INPUT
        }
        assert repository.get_asset("base-asset").id == "base-asset"
        assert repository.get_asset("layer-asset").id == "layer-asset"

    run_runtime_scenario(scenario)


def test_generated_media_cleanup_compensates_object_storage_and_draft_asset() -> None:
    async def scenario() -> None:
        repository = InMemoryRepository()
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(
                name="generated cleanup",
                definition=chain_definition(),
            )
        )
        run = repository.create_aigc_run(
            AigcPipelineRun(
                pipeline_id=pipeline.id,
                run_number=1,
                pipeline_revision=pipeline.revision,
                mode=AigcPipelineRunMode.FULL,
                definition_snapshot=pipeline.definition,
            ),
            idempotency_key="generated-cleanup-run",
            nodes=[
                AigcPipelineRunNode(
                    node_id=node.id,
                    included_in_plan=True,
                    status=AigcRunNodeStatus.READY,
                )
                for node in pipeline.definition.nodes
            ],
        )
        task = repository.create_aigc_task_attempt(
            AigcPipelineTaskAttempt(
                pipeline_id=pipeline.id,
                run_id=run.run.id,
                node_id="image",
                type=AigcTaskType.TEXT_TO_IMAGE,
            ),
            idempotency_key="generated-cleanup-attempt",
        )
        asset = repository.create_asset(
            AssetCreate(
                id="generated-cleanup-asset",
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.GENERATED_IMAGE,
                status=Status.DRAFT,
                object_key="aigc/generated-cleanup-asset.png",
                mime_type="image/png",
                metadata={"task_id": task.task_id},
            )
        )
        repository.add_aigc_task_assets(
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
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
        )

        await runtime._cleanup_task_outputs(task.task_id)

        assert repository.list_aigc_task_assets(task.task_id) == []
        assert gateway.asset_storage.deleted_asset_ids == [asset.id]
        with pytest.raises(NotFoundError):
            repository.get_asset(asset.id)

    run_runtime_scenario(scenario)


def _multi_track_config(
    *,
    video_source: str = "video",
    video_source_handle: str = "video",
    subtitle_asset_id: str = "subtitle",
    inline_text: str | None = None,
) -> dict[str, object]:
    text_source = (
        None
        if inline_text is not None
        else {"source_node_id": "text", "source_handle": "text"}
    )
    return {
        "canvas": {
            "mode": "custom",
            "width": 1920,
            "height": 1080,
            "background_color": "#000000FF",
        },
        "output": {"format": "mp4", "fps": 30},
        "tracks": [
            {
                "id": "video-track",
                "name": "视频",
                "type": "video",
                "elements": [
                    {
                        "id": "video-element",
                        "type": "video",
                        "source": {
                            "source_node_id": video_source,
                            "source_handle": video_source_handle,
                        },
                        "target_time": {"start_ms": 0, "end_ms": 2000},
                        "transform": {
                            "x": 0,
                            "y": 0,
                            "width": 1920,
                            "height": 1080,
                        },
                    }
                ],
            },
            {
                "id": "image-track",
                "name": "图片",
                "type": "image",
                "elements": [
                    {
                        "id": "image-element",
                        "type": "image",
                        "source": {
                            "source_node_id": "image",
                            "source_handle": "image",
                        },
                        "target_time": {"start_ms": 0, "end_ms": 2000},
                        "transform": {
                            "x": 0,
                            "y": 0,
                            "width": 1920,
                            "height": 1080,
                        },
                    }
                ],
            },
            {
                "id": "audio-track",
                "name": "音频",
                "type": "audio",
                "elements": [
                    {
                        "id": "audio-element",
                        "type": "audio",
                        "source": {
                            "source_node_id": "audio",
                            "source_handle": "audio",
                        },
                        "target_time": {"start_ms": 0, "end_ms": 2000},
                    }
                ],
            },
            {
                "id": "text-track",
                "name": "文字",
                "type": "text",
                "elements": [
                    {
                        "id": "text-element",
                        "type": "text",
                        "source": text_source,
                        "inline_text": inline_text,
                        "target_time": {"start_ms": 0, "end_ms": 2000},
                        "transform": {
                            "x": 100,
                            "y": 100,
                            "width": 600,
                            "height": 100,
                        },
                    }
                ],
            },
            {
                "id": "subtitle-track",
                "name": "字幕",
                "type": "subtitle",
                "elements": [
                    {
                        "id": "subtitle-element",
                        "type": "subtitle",
                        "asset_id": subtitle_asset_id,
                        "target_time": {"start_ms": 0, "end_ms": 2000},
                        "transform": {
                            "x": 100,
                            "y": 900,
                            "width": 1720,
                            "height": 100,
                        },
                    }
                ],
            },
        ],
    }


def _multi_track_definition(
    *,
    config: dict[str, object] | None = None,
) -> AigcPipelineDefinitionV2:
    return v2_definition(
        [
            node("video", "video", 0, config={"asset_id": "video-local"}),
            node("image", "image", 0, config={"asset_id": "image-local"}),
            node("audio", "audio", 0, config={"asset_id": "audio-local"}),
            node("text", "text", 0, config={"text": "本地备用文字"}),
            node(
                "edit",
                "multi_track_edit",
                300,
                config=config or _multi_track_config(),
            ),
        ],
        [
            edge("video-edit", "video", "video", "edit", "videos"),
            edge("image-edit", "image", "image", "edit", "images"),
            edge("audio-edit", "audio", "audio", "edit", "audios"),
            edge("text-edit", "text", "text", "edit", "texts"),
        ],
    )


def _create_subtitle_asset(
    repository: InMemoryRepository,
    asset_id: str,
    *,
    size_bytes: int = 100,
) -> None:
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.SUBTITLE,
            status=Status.SUCCEEDED,
            object_key=f"aigc/{asset_id}.srt",
            mime_type="application/x-subrip",
            size_bytes=size_bytes,
        )
    )


def test_multi_track_resolves_current_run_values_into_stable_snapshot() -> None:
    repository = InMemoryRepository()
    for asset_id, asset_type in (
        ("run-video", AssetType.UPLOADED_VIDEO),
        ("run-image", AssetType.UPLOADED_IMAGE),
        ("run-audio", AssetType.UPLOADED_AUDIO),
    ):
        create_media_asset(repository, asset_id, asset_type)
    _create_subtitle_asset(repository, "subtitle")
    definition = _multi_track_definition()
    node_by_id = {item.id: item for item in definition.nodes}
    run_nodes = {
        "video": AigcPipelineRunNode(
            node_id="video",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[AigcResultAsset(asset_id="run-video", ordinal=0)],
            ),
        ),
        "image": AigcPipelineRunNode(
            node_id="image",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[AigcResultAsset(asset_id="run-image", ordinal=0)],
            ),
        ),
        "audio": AigcPipelineRunNode(
            node_id="audio",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.ASSETS,
                assets=[AigcResultAsset(asset_id="run-audio", ordinal=0)],
            ),
        ),
        "text": AigcPipelineRunNode(
            node_id="text",
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=AigcTaskResult(
                kind=AigcResultKind.TEXT,
                text="当前 Run 文本",
                text_digest="a" * 64,
            ),
        ),
        "edit": AigcPipelineRunNode(
            node_id="edit",
            included_in_plan=True,
        ),
    }
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
    incoming = [
        item for item in definition.edges if item.target_node_id == "edit"
    ]

    params, upstream = runtime._resolve_task_params(
        node_by_id["edit"],
        incoming,
        node_by_id,
        run_nodes,
        all_edges=definition.edges,
    )

    assert params["resolved_sources"] == {
        "video-element": {"type": "video", "asset_id": "run-video"},
        "image-element": {"type": "image", "asset_id": "run-image"},
        "audio-element": {"type": "audio", "asset_id": "run-audio"},
        "text-element": {"type": "text", "text": "当前 Run 文本"},
        "subtitle-element": {"type": "subtitle", "asset_id": "subtitle"},
    }
    assert params["project"] == node_by_id["edit"].config.model_dump(mode="json")
    assert upstream == ["video", "image", "audio", "text"]
    assert "http" not in repr(params)


@pytest.mark.parametrize(
    ("config", "message"),
    [
        (_multi_track_config(video_source="missing"), "direct input edge"),
        (
            _multi_track_config(
                video_source="image",
                video_source_handle="image",
            ),
            "matching videos input edge",
        ),
    ],
)
def test_multi_track_rejects_missing_or_wrong_direct_source(
    config: dict[str, object],
    message: str,
) -> None:
    repository = InMemoryRepository()
    for asset_id, asset_type in (
        ("run-video", AssetType.UPLOADED_VIDEO),
        ("run-image", AssetType.UPLOADED_IMAGE),
        ("run-audio", AssetType.UPLOADED_AUDIO),
    ):
        create_media_asset(repository, asset_id, asset_type)
    _create_subtitle_asset(repository, "subtitle")
    definition = _multi_track_definition(config=config)
    node_by_id = {item.id: item for item in definition.nodes}
    run_nodes = {
        item.id: AigcPipelineRunNode(
            node_id=item.id,
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
            result=(
                AigcTaskResult(
                    kind=AigcResultKind.TEXT,
                    text="当前 Run 文本",
                    text_digest="a" * 64,
                )
                if item.id == "text"
                else AigcTaskResult(
                    kind=AigcResultKind.ASSETS,
                    assets=[AigcResultAsset(asset_id=f"run-{item.id}", ordinal=0)],
                )
            ),
        )
        for item in definition.nodes
        if item.id != "edit"
    }
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]

    with pytest.raises(ValueError, match=message):
        runtime._resolve_task_params(
            node_by_id["edit"],
            [
                item
                for item in definition.edges
                if item.target_node_id == "edit"
            ],
            node_by_id,
            run_nodes,
            all_edges=definition.edges,
        )


def test_multi_track_hash_changes_with_project_upstream_and_subtitle() -> None:
    repository = InMemoryRepository()
    for asset_id, asset_type in (
        ("video-local", AssetType.UPLOADED_VIDEO),
        ("video-other", AssetType.UPLOADED_VIDEO),
        ("image-local", AssetType.UPLOADED_IMAGE),
        ("audio-local", AssetType.UPLOADED_AUDIO),
    ):
        create_media_asset(repository, asset_id, asset_type)
    _create_subtitle_asset(repository, "subtitle", size_bytes=100)
    _create_subtitle_asset(repository, "subtitle-other", size_bytes=101)
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
    original = _multi_track_definition()
    changed_project = _multi_track_definition()
    changed_project.nodes[-1].config.output.fps = 60  # type: ignore[union-attr]
    changed_upstream = _multi_track_definition()
    changed_upstream.nodes[0].config.asset_id = "video-other"  # type: ignore[union-attr]
    changed_subtitle = _multi_track_definition(
        config=_multi_track_config(subtitle_asset_id="subtitle-other")
    )

    hashes = {
        runtime._expected_input_hashes(definition, {})["edit"]
        for definition in (
            original,
            changed_project,
            changed_upstream,
            changed_subtitle,
        )
    }

    assert len(hashes) == 4


def _create_multi_track_assets(repository: InMemoryRepository) -> None:
    for asset_id, asset_type in (
        ("video-local", AssetType.UPLOADED_VIDEO),
        ("image-local", AssetType.UPLOADED_IMAGE),
        ("audio-local", AssetType.UPLOADED_AUDIO),
        ("multi-track-output", AssetType.UPLOADED_VIDEO),
    ):
        create_media_asset(repository, asset_id, asset_type)
    _create_subtitle_asset(repository, "subtitle")


def _multi_track_runtime_definition() -> AigcPipelineDefinitionV2:
    definition = _multi_track_definition()
    payload = definition.model_dump(mode="json", by_alias=True)
    payload["nodes"].append(node("output", "video", 600))
    payload["edges"].append(
        edge("edit-output", "edit", "video", "output", "video")
    )
    return AigcPipelineDefinitionV2.model_validate(payload)


def test_multi_track_runtime_snapshot_cache_and_frozen_retry() -> None:
    async def scenario():
        repository = InMemoryRepository()
        _create_multi_track_assets(repository)
        pipeline = create_v2_runtime_pipeline(
            repository,
            _multi_track_runtime_definition(),
            name="multi-track runtime",
        )
        gateway = FakeGateway(
            fail_node="edit",
            result_assets_by_node={
                "edit": [
                    AigcResultAsset(
                        asset_id="multi-track-output",
                        ordinal=0,
                        mime_type="video/mp4",
                    )
                ]
            },
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            failed = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="multi-track-failed",
            )
            await runtime.wait_until_idle()
            gateway.fail_node = None
            retry = await runtime.retry_node(
                failed.run.id,
                "edit",
                idempotency_key="multi-track-retry",
            )
            await runtime.wait_until_idle()
            cached = await submit_v2_run(
                runtime,
                pipeline,
                mode=AigcPipelineRunMode.FROM_NODE,
                start_node_id="output",
                idempotency_key="multi-track-cache",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(failed.run.id),
                repository.get_aigc_run(retry.run.id),
                repository.get_aigc_run(cached.run.id),
                gateway,
            )
        finally:
            await runtime.stop()

    failed, retry, cached, gateway = run_runtime_scenario(scenario)
    failed_edit = next(item for item in failed.nodes if item.node_id == "edit")
    retry_edit = next(item for item in retry.nodes if item.node_id == "edit")
    cached_edit = next(item for item in cached.nodes if item.node_id == "edit")

    assert failed_edit.attempts[0].type == AigcTaskType.MULTI_TRACK_EDIT
    assert retry.run.definition_snapshot == failed.run.definition_snapshot
    assert retry_edit.attempts[0].params == failed_edit.attempts[0].params
    assert retry_edit.input_hash == failed_edit.input_hash
    assert cached_edit.status == AigcRunNodeStatus.REUSED
    assert cached_edit.reused_from_task_id == retry_edit.current_task_id
    assert gateway.calls == {"edit": 2}


def test_multi_track_has_independent_concurrency_and_failure_branch() -> None:
    async def scenario():
        repository = InMemoryRepository()
        _create_multi_track_assets(repository)
        definition = _multi_track_definition()
        payload = definition.model_dump(mode="json", by_alias=True)
        second = node(
            "edit-second",
            "multi_track_edit",
            600,
            config=_multi_track_config(inline_text="内联文字"),
        )
        payload["nodes"].extend(
            [
                second,
                node("prompt", "text", 0, config={"text": "独立分支"}),
                node("llm", "llm", 300),
            ]
        )
        payload["edges"].extend(
            [
                edge("video-second", "video", "video", "edit-second", "videos"),
                edge("image-second", "image", "image", "edit-second", "images"),
                edge("audio-second", "audio", "audio", "edit-second", "audios"),
                edge("prompt-llm", "prompt", "text", "llm", "prompt"),
            ]
        )
        pipeline = create_v2_runtime_pipeline(
            repository,
            AigcPipelineDefinitionV2.model_validate(payload),
            name="multi-track concurrency",
        )
        gateway = FakeGateway(fail_node="edit")
        runtime = AigcPipelineRuntime(
            repository,
            gateway,  # type: ignore[arg-type]
            worker_count=3,
            llm_concurrency=1,
            multitrack_concurrency=1,
        )
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="multi-track-concurrency",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id), gateway
        finally:
            await runtime.stop()

    detail, gateway = run_runtime_scenario(scenario)
    by_id = {item.node_id: item for item in detail.nodes}

    assert detail.run.status == AigcPipelineRunStatus.FAILED
    assert by_id["edit"].status == AigcRunNodeStatus.FAILED
    assert by_id["edit-second"].status == AigcRunNodeStatus.SUCCEEDED
    assert by_id["llm"].status == AigcRunNodeStatus.SUCCEEDED
    assert gateway.max_active == 2


def test_multi_track_cancellation_rejects_late_result_and_cleans_output() -> None:
    async def scenario():
        repository = InMemoryRepository()
        _create_multi_track_assets(repository)
        pipeline = create_v2_runtime_pipeline(
            repository,
            _multi_track_runtime_definition(),
            name="cancel multi-track",
        )
        gateway = PersistingBlockingVideoGateway(repository)
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await submit_v2_run(
                runtime,
                pipeline,
                idempotency_key="cancel-multi-track",
            )
            await asyncio.wait_for(gateway.started.wait(), timeout=1)
            await runtime.cancel_run(created.run.id)
            gateway.release.set()
            await runtime.wait_until_idle()
            detail = repository.get_aigc_run(created.run.id)
            assert gateway.created_asset_id is not None
            with pytest.raises(NotFoundError):
                repository.get_asset(gateway.created_asset_id)
            return detail
        finally:
            await runtime.stop()

    detail = run_runtime_scenario(scenario)
    edit = next(item for item in detail.nodes if item.node_id == "edit")

    assert detail.run.status == AigcPipelineRunStatus.CANCELED
    assert edit.status == AigcRunNodeStatus.CANCELED
    assert edit.result.kind == AigcResultKind.NONE
