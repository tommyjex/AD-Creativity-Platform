from __future__ import annotations

import asyncio

import pytest

from backend.app.repositories import InMemoryRepository, NotFoundError
from backend.app.schemas import (
    AigcAssetDirection,
    AigcEditedLayer,
    AigcImageLayer,
    AigcLayerSet,
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineRun,
    AigcPipelineRunCreate,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
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
    _compile_bbox_prompt,
    _execute_layer_canvas,
    _project_result_for_port,
    _task_type,
    _validate_layer_composite_source,
)
from backend.app.services.aigc_gateway import (
    AIGC_IMAGE_EXECUTOR_VERSION,
    AigcGatewayError,
    AigcGatewayExecution,
)


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


def chain_definition() -> AigcPipelineDefinition:
    return AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("input", "text_input", 0, config={"text": "商品"}),
                node("llm", "llm", 300),
                node("image", "text_to_image", 600),
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


class FakeGateway:
    def __init__(
        self,
        *,
        retry_first: bool = False,
        fail_node: str | None = None,
        result_assets_by_node: dict[str, list[AigcResultAsset]] | None = None,
    ):
        self.retry_first = retry_first
        self.fail_node = fail_node
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
        if task.node_id == self.fail_node:
            raise AigcGatewayError(
                AigcTaskError(
                    code="invalid_input",
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
        if task.type == AigcTaskType.LLM:
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
                else AIGC_IMAGE_EXECUTOR_VERSION
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


class _NoopAssetStorage:
    def delete_asset_objects(self, _asset) -> None:
        return None


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


def test_runtime_executes_dependency_chain_and_projects_output() -> None:
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
    definition = video_reference_definition(references)
    runtime = AigcPipelineRuntime(repository, FakeGateway())  # type: ignore[arg-type]
    node_by_id = {item.id: item for item in definition.nodes}
    run_node_by_id = {
        item.id: AigcPipelineRunNode(
            node_id=item.id,
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
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
    assert snapshot["video-a"] == {"asset_id": "asset-video-a"}
    assert snapshot["audio-a"] == {"asset_id": "asset-audio-a"}


def test_video_task_snapshot_rejects_empty_resolved_text_prompt() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("prompt", "text_input", 0, config={"text": "   "}),
                node("video-model", "video_generation", 300),
            ],
            "edges": [
                edge("prompt-edge", "prompt", "text", "video-model", "prompt")
            ],
        }
    )
    node_by_id = {item.id: item for item in definition.nodes}
    run_node_by_id = {
        item.id: AigcPipelineRunNode(
            node_id=item.id,
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
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
    definition = AigcPipelineDefinition.model_validate(
        {
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
        }
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
    changed_definition = AigcPipelineDefinition.model_validate(changed_payload)

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
    definition = AigcPipelineDefinition.model_validate(
        {
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
        }
    )
    node_by_id = {item.id: item for item in definition.nodes}
    run_nodes = {
        item.id: AigcPipelineRunNode(
            node_id=item.id,
            included_in_plan=True,
            status=AigcRunNodeStatus.SUCCEEDED,
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
    definition = AigcPipelineDefinition.model_validate(
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
        }
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
