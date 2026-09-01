from __future__ import annotations

import asyncio
import json
from io import BytesIO

import pytest
from PIL import Image

from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AigcAssetDirection,
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineRun,
    AigcPipelineRunNode,
    AigcPipelineTaskAttempt,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskType,
    AssetCreate,
    AssetRole,
    AssetType,
    ImageGenerationOperation,
    ImageGenerationSize,
    ImageOutputFormat,
    Status,
    ToolAssetRole,
)
from backend.app.services.aigc_gateway import (
    AIGC_DEFAULT_IMAGE_MODEL,
    AIGC_DEFAULT_TEXT_MODEL,
    AIGC_IMAGE_EXECUTOR_VERSION,
    AIGC_LLM_EXECUTOR_VERSION,
    AIGC_VIDEO_EXECUTOR_VERSION,
    AigcGatewayError,
    AigcModelGateway,
)
from backend.app.services.assets import AssetStorageService, DownloadedAsset
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    AigcTextGenerationRequest,
    DecomposedImageLayer,
    GeneratedAssetResult,
    LayerDecompositionResult,
    MockModelArkAdapter,
    ModelArkProviderError,
    SeedanceVideoGenerationRequest,
)


class FakeAigcGeneration:
    def __init__(self) -> None:
        self.text_requests: list[dict[str, object]] = []
        self.image_requests: list[dict[str, object]] = []
        self.layer_requests: list[dict[str, object]] = []
        self.video_requests: list[SeedanceVideoGenerationRequest] = []
        self.text_error: Exception | None = None
        self.video_error: Exception | None = None
        self.image_url = "https://provider.example/generated.png"
        self.image_mime_type = "image/png"
        self.layer_result = LayerDecompositionResult(
            base_url="https://provider.example/layers/base.png",
            layers=[
                DecomposedImageLayer(
                    z_index=1,
                    url="https://provider.example/layers/layer-1.png",
                    name="Product",
                    description="Foreground product",
                    bbox_absolute=(0, 0, 256, 256),
                    bbox_normalized=(0, 0, 500, 500),
                )
            ],
        )

    async def generate_aigc_text(self, **kwargs) -> str:
        self.text_requests.append(kwargs)
        if self.text_error is not None:
            raise self.text_error
        return "优化后的商品海报提示词"

    async def generate_aigc_image(self, **kwargs) -> GeneratedAssetResult:
        self.image_requests.append(kwargs)
        return GeneratedAssetResult(
            type=AssetType.GENERATED_IMAGE,
            stage="image",
            url=self.image_url,
            mime_type=self.image_mime_type,
            metadata={"provider": "fake", "model": kwargs["model"]},
        )

    async def decompose_aigc_image_layers(
        self,
        **kwargs,
    ) -> LayerDecompositionResult:
        self.layer_requests.append(kwargs)
        return self.layer_result

    async def generate_seedance_video(
        self,
        request: SeedanceVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        self.video_requests.append(request)
        if self.video_error is not None:
            raise self.video_error
        return GeneratedAssetResult(
            type=AssetType.STORYBOARD_VIDEO,
            stage="video",
            url="https://provider.example/generated.mp4",
            mime_type="video/mp4",
            metadata={
                "provider": "fake",
                "provider_task_id": "provider-task-safe",
                "provider_request_id": "provider-request-safe",
                "model": request.model,
                "generation_mode": request.generation_mode,
                "prompt": request.prompt,
                "resolution": request.resolution,
                "aspect_ratio": request.aspect_ratio,
                "duration_seconds": request.duration_seconds,
                "generate_audio": request.generate_audio,
                "reference_image_count": len(request.reference_image_urls),
                "reference_video_count": len(request.reference_video_urls),
                "reference_audio_count": len(request.reference_audio_urls),
            },
        )


def pipeline_definition(task_type: AigcTaskType) -> AigcPipelineDefinition:
    if task_type == AigcTaskType.LAYER_COMPOSITE:
        return AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    {
                        "id": "model",
                        "type": "layer_composite",
                        "position": {"x": 320, "y": 0},
                        "size": {"width": 280, "height": 200},
                        "config": {},
                    }
                ]
            }
        )
    model_type = (
        "image_to_image"
        if task_type
        in {
            AigcTaskType.IMAGE_TO_IMAGE,
            AigcTaskType.IMAGE_EDIT,
            AigcTaskType.LAYER_DECOMPOSITION,
        }
        else task_type.value
    )
    model_config = (
        {"operation": "layer_decomposition"}
        if task_type == AigcTaskType.LAYER_DECOMPOSITION
        else (
            {"operation": "image_edit"}
            if task_type == AigcTaskType.IMAGE_EDIT
            else {}
        )
    )
    nodes: list[dict[str, object]] = [
        {
            "id": "prompt",
            "type": "text_input",
            "position": {"x": 0, "y": 0},
            "size": {"width": 240, "height": 160},
            "config": {"text": "商品海报"},
        },
        {
            "id": "model",
            "type": model_type,
            "position": {"x": 320, "y": 0},
            "size": {"width": 280, "height": 200},
            "config": model_config,
        },
    ]
    edges = [
        {
            "id": "edge-prompt",
            "sourceNodeId": "prompt",
            "sourceHandle": "text",
            "targetNodeId": "model",
            "targetHandle": "prompt",
        }
    ]
    if task_type in {
        AigcTaskType.IMAGE_TO_IMAGE,
        AigcTaskType.LAYER_DECOMPOSITION,
    }:
        nodes.append(
            {
                "id": "source",
                "type": "image_input",
                "position": {"x": 0, "y": 240},
                "size": {"width": 240, "height": 180},
                "config": {"asset_id": "source-image"},
            }
        )
        edges.append(
            {
                "id": "edge-image",
                "sourceNodeId": "source",
                "sourceHandle": "image",
                "targetNodeId": "model",
                "targetHandle": "image",
            }
        )
    return AigcPipelineDefinition.model_validate({"nodes": nodes, "edges": edges})


def create_persisted_task(
    repository: InMemoryRepository,
    task_type: AigcTaskType,
    params: dict[str, object],
) -> AigcPipelineTaskAttempt:
    definition = pipeline_definition(task_type)
    pipeline = repository.create_aigc_pipeline(
        AigcPipelineCreate(name="Gateway test", definition=definition)
    )
    run = repository.create_aigc_run(
        AigcPipelineRun(
            pipeline_id=pipeline.id,
            run_number=1,
            pipeline_revision=0,
            mode="full",
            definition_snapshot=definition,
        ),
        idempotency_key=f"run-{task_type.value}",
        nodes=[
            AigcPipelineRunNode(
                node_id=node.id,
                included_in_plan=node.id == "model",
                status=(
                    AigcRunNodeStatus.READY
                    if node.id == "model"
                    else AigcRunNodeStatus.SUCCEEDED
                ),
            )
            for node in definition.nodes
        ],
    )
    return repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=run.run.id,
            node_id="model",
            type=task_type,
            params=params,
        ),
        idempotency_key=f"task-{task_type.value}",
    )


def create_image_asset(
    repository: InMemoryRepository,
    asset_id: str,
    *,
    status: Status = Status.SUCCEEDED,
) -> None:
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.UPLOADED_IMAGE,
            status=status,
            object_key=f"aigc/{asset_id}.png",
            mime_type="image/png",
        )
    )


def create_media_asset(
    repository: InMemoryRepository,
    asset_id: str,
    asset_type: AssetType,
    *,
    status: Status = Status.SUCCEEDED,
    mime_type: str | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    extension, default_mime_type = {
        AssetType.UPLOADED_IMAGE: ("png", "image/png"),
        AssetType.GENERATED_IMAGE: ("png", "image/png"),
        AssetType.UPLOADED_VIDEO: ("mp4", "video/mp4"),
        AssetType.STORYBOARD_VIDEO: ("mp4", "video/mp4"),
        AssetType.FINAL_VIDEO: ("mp4", "video/mp4"),
        AssetType.UPLOADED_AUDIO: ("mp3", "audio/mpeg"),
    }[asset_type]
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            tool_asset_role=ToolAssetRole.INPUT,
            type=asset_type,
            status=status,
            object_key=f"aigc/{asset_id}.{extension}",
            mime_type=mime_type or default_mime_type,
            metadata=metadata or {},
        )
    )


def png_bytes(
    size: tuple[int, int],
    *,
    alpha: bool = False,
) -> bytes:
    output = BytesIO()
    mode = "RGBA" if alpha else "RGB"
    color = (255, 0, 0, 128) if alpha else (255, 0, 0)
    Image.new(mode, size, color).save(output, format="PNG")
    return output.getvalue()


class LayerResultDownloader:
    def __init__(self, *, layer_alpha: bool = True) -> None:
        self.layer_alpha = layer_alpha

    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        if url.endswith("base.png"):
            return DownloadedAsset(png_bytes((512, 512)), "image/png")
        return DownloadedAsset(
            png_bytes((256, 256), alpha=self.layer_alpha),
            "image/png",
        )


class ImageEditDownloader:
    def __init__(self, content: bytes, mime_type: str) -> None:
        self.content = content
        self.mime_type = mime_type

    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        return DownloadedAsset(self.content, self.mime_type)


def create_layer_source(
    repository: InMemoryRepository,
    storage: AssetStorageService,
    *,
    size: tuple[int, int] = (512, 512),
) -> None:
    content = png_bytes(size)
    create_image_asset(repository, "source-image")
    client = storage.client
    assert client is not None
    client.put_object(
        key="aigc/source-image.png",
        content=content,
        content_type="image/png",
    )


def video_params() -> dict[str, object]:
    return {
        "model": "doubao-seedance-2-5-260628",
        "generation_mode": "multimodal_reference",
        "task_type": "generate",
        "prompt": "延长视频并匹配配乐",
        "first_frame_asset_id": None,
        "last_frame_asset_id": None,
        "reference_image_asset_ids": ["image-b", "image-a"],
        "reference_video_asset_ids": ["video-a"],
        "reference_audio_asset_ids": ["audio-a"],
        "duration_seconds": 12,
        "resolution": "1080p",
        "aspect_ratio": "16:9",
        "generate_audio": False,
    }


def test_gateway_rejects_edit_video_shorter_than_four_seconds(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_media_asset(
        repository,
        "short-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1280,
            "height": 720,
            "duration_seconds": 3,
            "fps": 30,
            "video_codec": "h264",
            "audio_codec": "aac",
        },
    )
    params = video_params()
    params.update(
        {
            "task_type": "edit",
            "reference_image_asset_ids": [],
            "reference_video_asset_ids": ["short-video"],
            "reference_audio_asset_ids": [],
        }
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
        media_inspector=object(),  # type: ignore[arg-type]
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_GENERATION,
        params,
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_media_input"
    assert "between 4 and 30" in error.value.error.message
    assert generation.video_requests == []


def test_mock_adapter_supports_generic_aigc_text() -> None:
    adapter = MockModelArkAdapter()

    result = asyncio.run(
        adapter.generate_aigc_text(
            AigcTextGenerationRequest(
                model=AIGC_DEFAULT_TEXT_MODEL,
                prompt="优化这段提示词",
            )
        )
    )

    assert result.startswith("优化这段提示词")
    assert "[mock:" in result


def test_generation_service_forwards_aigc_reference_image_urls() -> None:
    class RecordingAdapter:
        def __init__(self) -> None:
            self.requests = []

        async def generate_project_image(self, request):
            self.requests.append(request)
            return GeneratedAssetResult(
                type=AssetType.GENERATED_IMAGE,
                stage="image",
                url="https://provider.example/generated.png",
                mime_type="image/png",
            )

    adapter = RecordingAdapter()
    generation = ModelArkGenerationService(adapter=adapter)  # type: ignore[arg-type]

    asyncio.run(
        generation.generate_aigc_image(
            pipeline_id="pipeline-1",
            model=AIGC_DEFAULT_IMAGE_MODEL,
            operation=ImageGenerationOperation.IMAGE_TO_IMAGE,
            prompt="融合参考图",
            size=ImageGenerationSize.TWO_K,
            output_format=ImageOutputFormat.PNG,
            source_image_url="https://assets.example.com/source.png",
            reference_image_urls=[
                "https://assets.example.com/reference-1.png",
                "https://assets.example.com/reference-2.png",
            ],
        )
    )

    assert adapter.requests[0].source_image_url.endswith("/source.png")
    assert adapter.requests[0].reference_image_urls == [
        "https://assets.example.com/reference-1.png",
        "https://assets.example.com/reference-2.png",
    ]


def test_generation_service_reuses_seedream_layer_decomposition_request() -> None:
    class RecordingAdapter:
        def __init__(self) -> None:
            self.requests = []

        async def decompose_image_layers(self, request):
            self.requests.append(request)
            return LayerDecompositionResult(
                base_url="https://provider.example/base.png",
                layers=[
                    DecomposedImageLayer(
                        z_index=1,
                        url="https://provider.example/layer.png",
                        name="Product",
                        description="Product layer",
                        bbox_absolute=(0, 0, 512, 512),
                        bbox_normalized=(0, 0, 1000, 1000),
                    )
                ],
            )

    adapter = RecordingAdapter()
    generation = ModelArkGenerationService(adapter=adapter)  # type: ignore[arg-type]

    asyncio.run(
        generation.decompose_aigc_image_layers(
            pipeline_id="pipeline-1",
            model=AIGC_DEFAULT_IMAGE_MODEL,
            source_image_url="https://assets.example.com/source.png",
            canvas_width=512,
            canvas_height=512,
            prompt=None,
            size="auto",  # type: ignore[arg-type]
            output_format=ImageOutputFormat.PNG,
        )
    )

    request = adapter.requests[0]
    assert request.project_id == "pipeline-1"
    assert request.model == AIGC_DEFAULT_IMAGE_MODEL
    assert request.image_url.endswith("/source.png")
    assert request.prompt is None
    assert request.size.value == "auto"
    assert request.output_format == ImageOutputFormat.PNG


def test_gateway_executes_llm_and_returns_text_digest(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LLM,
        {
            "model": AIGC_DEFAULT_TEXT_MODEL,
            "prompt": "优化商品卖点",
            "system_prompt": "简洁",
            "temperature": 0.3,
        },
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.executor_version == AIGC_LLM_EXECUTOR_VERSION
    assert execution.result.kind == AigcResultKind.TEXT
    assert execution.result.text == "优化后的商品海报提示词"
    assert execution.result.text_digest is not None
    assert len(execution.result.text_digest) == 64
    assert generation.text_requests[0]["model"] == AIGC_DEFAULT_TEXT_MODEL


def test_gateway_persists_text_to_image_output_asset(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.TEXT_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "橙色商品海报",
            "aspect_ratio": "16:9",
            "size": "2K",
            "format": "png",
        },
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.executor_version == AIGC_IMAGE_EXECUTOR_VERSION
    assert execution.result.kind == AigcResultKind.ASSETS
    output = execution.result.assets[0]
    saved = repository.get_asset(output.asset_id)
    assert saved.metadata["origin"] == "aigc"
    assert saved.metadata["pipeline_id"] == task.pipeline_id
    assert output.download_url == f"/api/assets/{saved.id}/content"
    references = repository.list_aigc_task_assets(task.task_id)
    assert [(item.direction.value, item.asset_id) for item in references] == [
        ("output", saved.id)
    ]
    assert "画幅比例：16:9" in generation.image_requests[0]["prompt"]


def test_gateway_resolves_img2img_asset_by_id(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    repository.create_asset(
        AssetCreate(
            id="source-image",
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.UPLOADED_IMAGE,
            status=Status.SUCCEEDED,
            object_key="aigc/source.png",
            mime_type="image/png",
        )
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "调整背景",
            "source_asset_id": "source-image",
        },
    )

    asyncio.run(gateway.execute(task))

    assert generation.image_requests[0]["source_image_url"].startswith(
        "https://local-assets.tos.local/"
    )
    assert generation.image_requests[0]["reference_image_urls"] == []
    references = repository.list_aigc_task_assets(task.task_id)
    assert [
        (item.direction.value, item.slot, item.ordinal, item.asset_id)
        for item in references
    ] == [
        ("input", "image", 0, "source-image"),
        ("output", "image", 0, references[1].asset_id),
    ]


def test_gateway_resolves_single_reference_asset(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_image_asset(repository, "source-image")
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "调整背景",
            "reference_asset_ids": ["source-image"],
        },
    )

    asyncio.run(gateway.execute(task))

    request = generation.image_requests[0]
    assert request["source_image_url"].startswith(
        "https://local-assets.tos.local/"
    )
    assert request["reference_image_urls"] == []


def layer_edit_params() -> dict[str, object]:
    return {
        "model": AIGC_DEFAULT_IMAGE_MODEL,
        "operation": "image_edit",
        "prompt": "将商品改为红色",
        "aspect_ratio": "1:1",
        "size": "2K",
        "format": "jpeg",
        "edit_layer": {
            "asset_id": "source-layer",
            "layer_set_id": "layer-set-1",
            "layer_set_version": 2,
            "layer_set_digest": "a" * 64,
            "layer_id": "layer-1",
            "bbox_absolute": [10, 20, 14, 23],
            "bbox_normalized": [100, 200, 140, 230],
            "x": 32.5,
            "y": 48.5,
            "scale": 1.25,
            "z_index": 3,
        },
    }


def create_internal_layer_source(
    repository: InMemoryRepository,
    storage: AssetStorageService,
    *,
    alpha: int = 128,
) -> bytes:
    output = BytesIO()
    Image.new("RGBA", (4, 3), (20, 40, 60, alpha)).save(
        output,
        format="PNG",
    )
    content = output.getvalue()
    repository.create_asset(
        AssetCreate(
            id="source-layer",
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=AssetType.GENERATED_IMAGE,
            asset_role=AssetRole.INTERNAL_LAYER,
            status=Status.SUCCEEDED,
            stage="image",
            object_key="aigc/source-layer.png",
            mime_type="image/png",
            size_bytes=len(content),
        )
    )
    client = storage.client
    assert client is not None
    client.put_object(
        key="aigc/source-layer.png",
        content=content,
        content_type="image/png",
    )
    return content


def encoded_image(
    mode: str,
    size: tuple[int, int],
    color,
    image_format: str,
) -> bytes:
    output = BytesIO()
    Image.new(mode, size, color).save(output, format=image_format)
    return output.getvalue()


def test_gateway_plain_image_edit_remains_compatible(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_image_asset(repository, "source-image")
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_EDIT,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "operation": "image_edit",
            "prompt": "移除背景文字",
            "size": "2K",
            "format": "png",
            "edit_image_asset_id": "source-image",
        },
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.result.kind == AigcResultKind.ASSETS
    assert generation.image_requests == [
        {
            "pipeline_id": task.pipeline_id,
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "operation": ImageGenerationOperation.IMAGE_TO_IMAGE,
            "prompt": "移除背景文字",
            "size": ImageGenerationSize.TWO_K,
            "output_format": ImageOutputFormat.PNG,
            "source_image_url": (
                "https://local-assets.tos.local/aigc/source-image.png"
                "?X-Tos-Expires=3600&X-Tos-Signature=test"
            ),
        }
    ]
    output = execution.result.assets[0]
    assert repository.get_asset(output.asset_id).asset_role == AssetRole.PUBLIC
    assert [
        (item.direction.value, item.slot, item.asset_id)
        for item in repository.list_aigc_task_assets(task.task_id)
    ] == [
        ("input", "edit_image", "source-image"),
        ("output", "image", output.asset_id),
    ]


def test_gateway_layer_edit_resizes_png_and_applies_original_alpha_mask(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_internal_layer_source(repository, test_asset_storage, alpha=96)
    generated_content = encoded_image("RGB", (8, 6), (230, 10, 20), "PNG")
    test_asset_storage.downloader = ImageEditDownloader(
        generated_content,
        "image/png",
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_EDIT,
        layer_edit_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    edited = execution.result.edited_layer
    assert execution.result.kind == AigcResultKind.EDITED_LAYER
    assert edited is not None
    expected_context = dict(layer_edit_params()["edit_layer"])  # type: ignore[arg-type]
    expected_context.pop("asset_id")
    assert edited.model_dump(mode="json") == {
        "asset_id": edited.asset_id,
        **expected_context,
    }
    saved = repository.get_asset(edited.asset_id)
    assert saved.asset_role == AssetRole.INTERNAL_LAYER
    assert saved.mime_type == "image/png"
    assert saved.source_task_id is None
    assert saved.metadata["aigc_role"] == "edited_layer"
    assert saved.metadata["task_id"] == task.task_id
    client = test_asset_storage.client
    assert client is not None
    assert saved.object_key is not None
    with Image.open(BytesIO(client.get_object(key=saved.object_key))) as image:
        assert image.format == "PNG"
        assert image.size == (4, 3)
        assert image.getchannel("A").getextrema() == (96, 96)
    assert generation.image_requests[0]["model"] == AIGC_DEFAULT_IMAGE_MODEL
    assert generation.image_requests[0]["output_format"] == ImageOutputFormat.PNG
    assert [
        (item.direction.value, item.slot, item.asset_id)
        for item in repository.list_aigc_task_assets(task.task_id)
    ] == [
        ("input", "edit_layer", "source-layer"),
        ("output", "edited_layer", edited.asset_id),
    ]


def test_gateway_layer_edit_multiplies_provider_alpha(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_internal_layer_source(repository, test_asset_storage, alpha=128)
    generated_content = encoded_image(
        "RGBA",
        (4, 3),
        (230, 10, 20, 128),
        "PNG",
    )
    test_asset_storage.downloader = ImageEditDownloader(
        generated_content,
        "image/png",
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_EDIT,
        layer_edit_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    edited = execution.result.edited_layer
    assert edited is not None
    saved = repository.get_asset(edited.asset_id)
    client = test_asset_storage.client
    assert client is not None
    assert saved.object_key is not None
    with Image.open(BytesIO(client.get_object(key=saved.object_key))) as image:
        assert image.getchannel("A").getextrema() == (64, 64)


def test_gateway_layer_edit_accepts_lossy_result_but_stores_png(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_internal_layer_source(repository, test_asset_storage, alpha=200)
    generated_content = encoded_image("RGB", (9, 7), (20, 180, 80), "JPEG")
    test_asset_storage.downloader = ImageEditDownloader(
        generated_content,
        "image/jpeg",
    )
    generation = FakeAigcGeneration()
    generation.image_url = "https://provider.example/generated.jpg"
    generation.image_mime_type = "image/jpeg"
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_EDIT,
        layer_edit_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    edited = execution.result.edited_layer
    assert edited is not None
    saved = repository.get_asset(edited.asset_id)
    client = test_asset_storage.client
    assert client is not None
    assert saved.object_key is not None
    with Image.open(BytesIO(client.get_object(key=saved.object_key))) as image:
        assert image.format == "PNG"
        assert image.size == (4, 3)
        assert image.getchannel("A").getextrema() == (200, 200)


def test_gateway_layer_edit_normalization_failure_keeps_source_unchanged(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    source_content = create_internal_layer_source(
        repository,
        test_asset_storage,
        alpha=128,
    )
    source_before = repository.get_asset("source-layer").model_dump(mode="json")
    test_asset_storage.downloader = ImageEditDownloader(
        b"not-an-image",
        "image/png",
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_EDIT,
        layer_edit_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert repository.get_asset("source-layer").model_dump(mode="json") == source_before
    client = test_asset_storage.client
    assert client is not None
    assert client.get_object(key="aigc/source-layer.png") == source_content
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert [
        asset.id for asset in repository.list_assets(asset_role=None)
    ] == ["source-layer"]


def test_gateway_passes_ten_img2img_assets_in_order(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_image_asset(repository, "source-image")
    asset_ids = [f"reference-{index}" for index in range(10)]
    for asset_id in asset_ids:
        create_image_asset(repository, asset_id)
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "融合全部参考图",
            "reference_asset_ids": asset_ids,
        },
    )

    asyncio.run(gateway.execute(task))

    request = generation.image_requests[0]
    assert f"/{asset_ids[0]}.png?" in request["source_image_url"]
    reference_urls = request["reference_image_urls"]
    assert isinstance(reference_urls, list)
    assert len(reference_urls) == 9
    assert [
        next(asset_id for asset_id in asset_ids if f"/{asset_id}.png?" in url)
        for url in reference_urls
    ] == asset_ids[1:]
    input_references = [
        item
        for item in repository.list_aigc_task_assets(task.task_id)
        if item.direction.value == "input"
    ]
    assert [
        (item.slot, item.ordinal, item.asset_id) for item in input_references
    ] == [
        ("image", ordinal, asset_id)
        for ordinal, asset_id in enumerate(asset_ids)
    ]


def test_gateway_rejects_unavailable_reference_before_recording_or_generation(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_image_asset(repository, "source-image")
    create_image_asset(repository, "available")
    create_image_asset(repository, "unavailable", status=Status.FAILED)
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "不应发送",
            "reference_asset_ids": ["available", "unavailable"],
        },
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert generation.image_requests == []
    assert repository.list_aigc_task_assets(task.task_id) == []


def test_gateway_rejects_more_than_ten_img2img_assets_before_generation(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_image_asset(repository, "source-image")
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "超过模型上限",
            "reference_asset_ids": [
                f"reference-{index}" for index in range(11)
            ],
        },
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert generation.image_requests == []
    assert repository.list_aigc_task_assets(task.task_id) == []


def layer_decomposition_params() -> dict[str, object]:
    return {
        "model": AIGC_DEFAULT_IMAGE_MODEL,
        "operation": "layer_decomposition",
        "prompt": "拆分商品主体",
        "aspect_ratio": "1:1",
        "size": "1.5K",
        "format": "png",
        "source_asset_id": "source-image",
    }


def test_gateway_decomposes_image_and_persists_internal_layer_snapshot(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_layer_source(repository, test_asset_storage)
    test_asset_storage.downloader = LayerResultDownloader()
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.executor_version == AIGC_IMAGE_EXECUTOR_VERSION
    assert execution.result.kind == AigcResultKind.LAYER_SET
    layer_set = execution.result.layer_set
    assert layer_set is not None
    assert layer_set.parent_layer_set_id is None
    assert layer_set.version == 0
    assert layer_set.canvas_width == 512
    assert layer_set.canvas_height == 512
    assert len(layer_set.digest) == 64
    assert [layer.z_index for layer in layer_set.layers] == [1]
    assert generation.layer_requests == [
        {
            "pipeline_id": task.pipeline_id,
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "source_image_url": (
                "https://local-assets.tos.local/aigc/source-image.png"
                "?X-Tos-Expires=3600&X-Tos-Signature=test"
            ),
            "canvas_width": 512,
            "canvas_height": 512,
            "prompt": "拆分商品主体",
            "size": "1.5K",
            "output_format": "png",
        }
    ]

    references = repository.list_aigc_task_assets(task.task_id)
    assert [
        (item.direction.value, item.slot, item.ordinal, item.asset_id)
        for item in references
    ] == [
        ("input", "image", 0, "source-image"),
        ("output", "base", 0, layer_set.base_asset_id),
        ("output", "layers", 0, layer_set.layers[0].asset_id),
    ]
    internal_assets = [
        repository.get_asset(layer_set.base_asset_id),
        repository.get_asset(layer_set.layers[0].asset_id),
    ]
    assert all(
        asset.asset_role == AssetRole.INTERNAL_LAYER
        and asset.tool_asset_role == ToolAssetRole.OUTPUT
        and asset.source_task_id is None
        and asset.metadata["task_id"] == task.task_id
        for asset in internal_assets
    )
    layer_asset = internal_assets[1]
    storage_client = test_asset_storage.client
    assert storage_client is not None
    assert layer_asset.object_key is not None
    with Image.open(BytesIO(storage_client.get_object(key=layer_asset.object_key))) as image:
        assert "A" in image.getbands()


@pytest.mark.parametrize(
    ("size", "pad_to_30mb"),
    [
        ((256, 256), False),
        ((4096, 128), False),
        ((512, 512), True),
    ],
)
def test_gateway_authoritatively_rejects_invalid_layer_source_before_provider(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    size: tuple[int, int],
    pad_to_30mb: bool,
) -> None:
    create_layer_source(repository, test_asset_storage, size=size)
    storage_client = test_asset_storage.client
    assert storage_client is not None
    if pad_to_30mb:
        content = storage_client.objects["aigc/source-image.png"]
        storage_client.objects["aigc/source-image.png"] = content + b"x" * (
            30 * 1024 * 1024 - len(content)
        )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert generation.layer_requests == []
    assert repository.list_aigc_task_assets(task.task_id) == []


def test_gateway_rejects_non_continuous_layer_response_and_cleans_relations(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_layer_source(repository, test_asset_storage)
    generation = FakeAigcGeneration()
    generation.layer_result = LayerDecompositionResult(
        base_url="https://provider.example/layers/base.png",
        layers=[
            DecomposedImageLayer(
                z_index=2,
                url="https://provider.example/layers/layer-2.png",
                name="Invalid",
                description="Missing z-index one",
                bbox_absolute=(0, 0, 256, 256),
                bbox_normalized=(0, 0, 500, 500),
            )
        ],
    )
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert [asset.id for asset in repository.list_assets(asset_role=None)] == [
        "source-image"
    ]


def test_gateway_rejects_layer_without_alpha_and_does_not_upload(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_layer_source(repository, test_asset_storage)
    test_asset_storage.downloader = LayerResultDownloader(layer_alpha=False)
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )
    storage_client = test_asset_storage.client
    assert storage_client is not None
    initial_put_count = len(storage_client.puts)

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert len(storage_client.puts) == initial_put_count
    assert repository.list_aigc_task_assets(task.task_id) == []


def test_gateway_rolls_back_layer_assets_when_output_relationship_fails(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_layer_source(repository, test_asset_storage)
    test_asset_storage.downloader = LayerResultDownloader()
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )
    original_add = repository.add_aigc_task_assets

    def fail_output_relationship(references):
        items = list(references)
        if any(item.direction.value == "output" for item in items):
            raise RuntimeError("relationship write failed")
        return original_add(items)

    monkeypatch.setattr(
        repository,
        "add_aigc_task_assets",
        fail_output_relationship,
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_transfer_failed"
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert [asset.id for asset in repository.list_assets(asset_role=None)] == [
        "source-image"
    ]
    storage_client = test_asset_storage.client
    assert storage_client is not None
    assert len(storage_client.deletes) == 2
    assert set(storage_client.deletes).isdisjoint(storage_client.objects)


def test_gateway_rolls_back_layer_objects_when_asset_record_creation_fails(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_layer_source(repository, test_asset_storage)
    test_asset_storage.downloader = LayerResultDownloader()
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )

    def fail_asset_records(_items):
        raise RuntimeError("asset record creation failed")

    monkeypatch.setattr(repository, "create_assets", fail_asset_records)

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_transfer_failed"
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert [asset.id for asset in repository.list_assets(asset_role=None)] == [
        "source-image"
    ]
    storage_client = test_asset_storage.client
    assert storage_client is not None
    assert len(storage_client.deletes) == 2
    assert set(storage_client.deletes).isdisjoint(storage_client.objects)


def test_gateway_rolls_back_partial_layer_upload(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_layer_source(repository, test_asset_storage)
    test_asset_storage.downloader = LayerResultDownloader()
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )
    storage_client = test_asset_storage.client
    assert storage_client is not None
    original_put = storage_client.put_object
    output_puts = 0

    def fail_second_output_put(**kwargs):
        nonlocal output_puts
        if kwargs["key"] != "aigc/source-image.png":
            output_puts += 1
            if output_puts == 2:
                raise RuntimeError("second layer upload failed")
        return original_put(**kwargs)

    monkeypatch.setattr(storage_client, "put_object", fail_second_output_put)

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_transfer_failed"
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert [asset.id for asset in repository.list_assets(asset_role=None)] == [
        "source-image"
    ]
    assert len(storage_client.deletes) == 1
    assert storage_client.deletes[0] not in storage_client.objects


def _solid_png(
    size: tuple[int, int],
    color: tuple[int, int, int, int],
) -> bytes:
    output = BytesIO()
    Image.new("RGBA", size, color).save(output, format="PNG")
    return output.getvalue()


def _layer_composite_params(
    repository: InMemoryRepository,
    storage: AssetStorageService,
) -> dict[str, object]:
    contents = {
        "base-asset": _solid_png((6, 4), (0, 0, 0, 255)),
        "layer-old": _solid_png((2, 2), (255, 0, 0, 255)),
        "layer-other": _solid_png((2, 2), (0, 255, 0, 255)),
        "layer-hidden": _solid_png((1, 1), (0, 0, 255, 255)),
        "layer-edited": _solid_png((2, 2), (255, 255, 0, 255)),
    }
    client = storage.client
    assert client is not None
    for asset_id, content in contents.items():
        repository.create_asset(
            AssetCreate(
                id=asset_id,
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.GENERATED_IMAGE,
                asset_role=AssetRole.INTERNAL_LAYER,
                status=Status.SUCCEEDED,
                stage="image",
                object_key=f"aigc/{asset_id}.png",
                mime_type="image/png",
                size_bytes=len(content),
                metadata={"task_id": "source-task"},
            )
        )
        client.put_object(
            key=f"aigc/{asset_id}.png",
            content=content,
            content_type="image/png",
        )
    layer_set = {
        "id": "layer-set-1",
        "parent_layer_set_id": None,
        "source_asset_id": "source-image",
        "base_asset_id": "base-asset",
        "canvas_width": 6,
        "canvas_height": 4,
        "version": 0,
        "digest": "a" * 64,
        "layers": [
            {
                "id": "target-layer",
                "asset_id": "layer-old",
                "z_index": 1,
                "name": "target",
                "description": "",
                "bbox_absolute": [0, 0, 2, 2],
                "bbox_normalized": [0, 0, 333, 500],
                "visible": True,
                "x": 0,
                "y": 0,
                "scale": 1,
            },
            {
                "id": "other-layer",
                "asset_id": "layer-other",
                "z_index": 2,
                "name": "other",
                "description": "",
                "bbox_absolute": [2, 1, 4, 3],
                "bbox_normalized": [333, 250, 667, 750],
                "visible": True,
                "x": 3,
                "y": 1,
                "scale": 1,
            },
            {
                "id": "hidden-layer",
                "asset_id": "layer-hidden",
                "z_index": 3,
                "name": "hidden",
                "description": "",
                "bbox_absolute": [5, 3, 6, 4],
                "bbox_normalized": [833, 750, 1000, 1000],
                "visible": False,
                "x": 5,
                "y": 3,
                "scale": 1,
            },
        ],
    }
    return {
        "input_layer_set": layer_set,
        "replacement": {
            "asset_id": "layer-edited",
            "layer_set_id": "layer-set-1",
            "layer_set_version": 0,
            "layer_set_digest": "a" * 64,
            "layer_id": "target-layer",
            "bbox_absolute": [0, 0, 2, 2],
            "bbox_normalized": [0, 0, 333, 500],
            "x": 0,
            "y": 0,
            "scale": 1,
            "z_index": 1,
        },
    }


def test_gateway_composites_replacement_into_immutable_derived_layer_set(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    params = _layer_composite_params(repository, test_asset_storage)
    parent_snapshot = dict(params["input_layer_set"])  # type: ignore[arg-type]
    parent_layers = [
        dict(layer)
        for layer in parent_snapshot["layers"]  # type: ignore[index]
    ]
    parent_snapshot["layers"] = parent_layers
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_COMPOSITE,
        params,
    )
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
    )  # type: ignore[arg-type]

    execution = asyncio.run(gateway.execute(task))

    assert execution.executor_version == "aigc-layer-v1"
    assert execution.result.kind == AigcResultKind.LAYER_COMPOSITE
    derived = execution.result.layer_set
    assert derived is not None
    assert derived.id != "layer-set-1"
    assert derived.parent_layer_set_id == "layer-set-1"
    assert derived.version == 1
    assert derived.digest != "a" * 64
    assert derived.layers[0].asset_id == "layer-edited"
    assert (
        derived.layers[0].model_dump(mode="json", exclude={"asset_id"})
        == {
            key: value
            for key, value in parent_layers[0].items()
            if key != "asset_id"
        }
    )
    assert derived.layers[1].model_dump(mode="json") == parent_layers[1]
    assert derived.layers[2].model_dump(mode="json") == parent_layers[2]
    assert params["input_layer_set"] == parent_snapshot
    assert repository.get_asset("layer-old").id == "layer-old"

    output = execution.result.assets[0]
    saved = repository.get_asset(output.asset_id)
    assert saved.asset_role == AssetRole.PUBLIC
    assert saved.mime_type == "image/png"
    assert saved.source_task_id is None
    assert saved.metadata["task_id"] == task.task_id
    client = test_asset_storage.client
    assert client is not None
    assert saved.object_key is not None
    with Image.open(BytesIO(client.get_object(key=saved.object_key))) as image:
        rgba = image.convert("RGBA")
        assert rgba.getpixel((0, 0)) == (255, 255, 0, 255)
        assert rgba.getpixel((3, 1)) == (0, 255, 0, 255)
        assert rgba.getpixel((5, 3)) == (0, 0, 0, 255)

    references = repository.list_aigc_task_assets(task.task_id)
    assert [
        (item.direction.value, item.slot, item.ordinal, item.asset_id)
        for item in references
    ] == [
        ("input", "base", 0, "base-asset"),
        ("input", "layers", 0, "layer-old"),
        ("input", "layers", 1, "layer-other"),
        ("input", "layers", 2, "layer-hidden"),
        ("input", "replacement", 0, "layer-edited"),
        ("output", "base", 0, "base-asset"),
        ("output", "image", 0, saved.id),
        ("output", "layers", 0, "layer-edited"),
        ("output", "layers", 1, "layer-other"),
        ("output", "layers", 2, "layer-hidden"),
    ]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("layer_set_id", "other-set"),
        ("layer_set_version", 1),
        ("layer_set_digest", "b" * 64),
        ("layer_id", "other-layer-id"),
        ("bbox_absolute", [0, 0, 3, 2]),
    ],
)
def test_gateway_rejects_every_layer_composite_source_conflict(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    field: str,
    value: object,
) -> None:
    params = _layer_composite_params(repository, test_asset_storage)
    replacement = params["replacement"]
    assert isinstance(replacement, dict)
    replacement[field] = value
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_COMPOSITE,
        params,
    )
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
    )  # type: ignore[arg-type]

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert len(repository.list_assets(asset_role=None)) == 5


def test_gateway_rolls_back_layer_composite_when_output_relationship_fails(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    params = _layer_composite_params(repository, test_asset_storage)
    parent_snapshot = json.dumps(params["input_layer_set"], sort_keys=True)
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_COMPOSITE,
        params,
    )
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
    )  # type: ignore[arg-type]
    original_add = repository.add_aigc_task_assets

    def fail_output_relationship(references):
        items = list(references)
        if any(item.direction == AigcAssetDirection.OUTPUT for item in items):
            raise RuntimeError("relationship write failed")
        return original_add(items)

    monkeypatch.setattr(
        repository,
        "add_aigc_task_assets",
        fail_output_relationship,
    )
    storage_client = test_asset_storage.client
    assert storage_client is not None
    initial_keys = set(storage_client.objects)

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_transfer_failed"
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert {asset.id for asset in repository.list_assets(asset_role=None)} == {
        "base-asset",
        "layer-old",
        "layer-other",
        "layer-hidden",
        "layer-edited",
    }
    assert set(storage_client.objects) == initial_keys
    assert json.dumps(params["input_layer_set"], sort_keys=True) == parent_snapshot


def test_gateway_rejects_unlisted_models_and_sanitizes_provider_errors(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    invalid_task = create_persisted_task(
        repository,
        AigcTaskType.LLM,
        {"model": "arbitrary-endpoint", "prompt": "hello"},
    )

    with pytest.raises(AigcGatewayError) as invalid_error:
        asyncio.run(gateway.execute(invalid_task))
    assert invalid_error.value.error.code == "invalid_input"

    failed_repository = InMemoryRepository()
    failed_generation = FakeAigcGeneration()
    failed_generation.text_error = ModelArkProviderError(
        "secret token=should-not-leak",
        provider_code="429",
        request_id="request-safe-123",
        phase="chat",
    )
    failed_gateway = AigcModelGateway(  # type: ignore[arg-type]
        failed_repository,
        failed_generation,
        test_asset_storage,
    )
    failed_task = create_persisted_task(
        failed_repository,
        AigcTaskType.LLM,
        {"model": AIGC_DEFAULT_TEXT_MODEL, "prompt": "hello"},
    )

    with pytest.raises(AigcGatewayError) as provider_error:
        asyncio.run(failed_gateway.execute(failed_task))
    assert provider_error.value.retryable is True
    assert provider_error.value.error.request_id == "request-safe-123"
    assert "should-not-leak" not in provider_error.value.error.message


def test_gateway_normalizes_timeout_as_retryable(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = FakeAigcGeneration()
    generation.text_error = TimeoutError("provider call exceeded deadline")
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LLM,
        {"model": AIGC_DEFAULT_TEXT_MODEL, "prompt": "hello"},
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "timeout"
    assert error.value.retryable is True


def test_gateway_executes_video_with_ordered_inputs_and_persists_output(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    for asset_id in ("image-a", "image-b"):
        create_media_asset(repository, asset_id, AssetType.UPLOADED_IMAGE)
    create_media_asset(repository, "video-a", AssetType.UPLOADED_VIDEO)
    create_media_asset(repository, "audio-a", AssetType.UPLOADED_AUDIO)
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_GENERATION,
        video_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.executor_version == AIGC_VIDEO_EXECUTOR_VERSION
    request = generation.video_requests[0]
    assert request.reference_image_urls[0].endswith(
        "/aigc/image-b.png?X-Tos-Expires=3600&X-Tos-Signature=test"
    )
    assert request.reference_image_urls[1].endswith(
        "/aigc/image-a.png?X-Tos-Expires=3600&X-Tos-Signature=test"
    )
    assert request.reference_video_urls[0].endswith(
        "/aigc/video-a.mp4?X-Tos-Expires=3600&X-Tos-Signature=test"
    )
    assert request.reference_audio_urls[0].endswith(
        "/aigc/audio-a.mp3?X-Tos-Expires=3600&X-Tos-Signature=test"
    )
    assert request.generate_audio is False
    references = repository.list_aigc_task_assets(task.task_id)
    assert [
        (item.direction.value, item.slot, item.ordinal, item.asset_id)
        for item in references
    ] == [
        ("input", "reference_audios", 0, "audio-a"),
        ("input", "reference_images", 0, "image-b"),
        ("input", "reference_images", 1, "image-a"),
        ("input", "reference_videos", 0, "video-a"),
        ("output", "video", 0, references[-1].asset_id),
    ]
    output = execution.result.assets[0]
    saved = repository.get_asset(output.asset_id)
    assert saved.type == AssetType.STORYBOARD_VIDEO
    assert saved.tool_asset_role == ToolAssetRole.OUTPUT
    assert saved.metadata["origin"] == "aigc"
    assert saved.metadata["pipeline_id"] == task.pipeline_id
    assert saved.metadata["run_id"] == task.run_id
    assert saved.metadata["node_id"] == task.node_id
    assert saved.metadata["task_id"] == task.task_id
    assert saved.metadata["generate_audio"] is False
    assert saved.metadata["prompt_sha256"]
    assert "prompt" not in saved.metadata
    assert "source_url" not in saved.metadata
    assert output.mime_type == "video/mp4"


def test_gateway_maps_first_and_last_frames_to_seedance_roles(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_media_asset(repository, "first", AssetType.GENERATED_IMAGE)
    create_media_asset(repository, "last", AssetType.UPLOADED_IMAGE)
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    params = video_params()
    params.update(
        {
            "generation_mode": "first_last_frame",
            "prompt": "",
            "first_frame_asset_id": "first",
            "last_frame_asset_id": "last",
            "reference_image_asset_ids": [],
            "reference_video_asset_ids": [],
            "reference_audio_asset_ids": [],
        }
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_GENERATION,
        params,
    )

    asyncio.run(gateway.execute(task))

    request = generation.video_requests[0]
    assert request.first_frame_url is not None
    assert "/aigc/first.png?" in request.first_frame_url
    assert request.last_frame_url is not None
    assert "/aigc/last.png?" in request.last_frame_url
    input_references = repository.list_aigc_task_assets(task.task_id)[:2]
    assert [
        (item.slot, item.ordinal, item.asset_id) for item in input_references
    ] == [
        ("first_frame", 0, "first"),
        ("last_frame", 0, "last"),
    ]


@pytest.mark.parametrize(
    ("asset_id", "asset_type", "mime_type"),
    [
        ("bad-image", AssetType.UPLOADED_IMAGE, "video/mp4"),
        ("bad-video", AssetType.UPLOADED_VIDEO, "image/png"),
        ("bad-audio", AssetType.UPLOADED_AUDIO, "application/octet-stream"),
    ],
)
def test_gateway_rejects_video_input_with_wrong_mime_before_recording(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    asset_id: str,
    asset_type: AssetType,
    mime_type: str,
) -> None:
    create_media_asset(
        repository,
        asset_id,
        asset_type,
        mime_type=mime_type,
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    params = video_params()
    params["reference_image_asset_ids"] = (
        [asset_id] if asset_type == AssetType.UPLOADED_IMAGE else []
    )
    params["reference_video_asset_ids"] = (
        [asset_id] if asset_type == AssetType.UPLOADED_VIDEO else []
    )
    params["reference_audio_asset_ids"] = (
        [asset_id] if asset_type == AssetType.UPLOADED_AUDIO else []
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_GENERATION,
        params,
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert generation.video_requests == []
    assert repository.list_aigc_task_assets(task.task_id) == []


def test_gateway_classifies_seedance_task_timeout_as_retryable(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = FakeAigcGeneration()
    generation.video_error = ModelArkProviderError(
        "video generation task timed out",
        provider_code="TaskTimeout",
        provider_task_id="provider-task-safe",
        phase="poll",
    )
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    params = video_params()
    params["reference_image_asset_ids"] = []
    params["reference_video_asset_ids"] = []
    params["reference_audio_asset_ids"] = []
    params["generation_mode"] = "text_to_video"
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_GENERATION,
        params,
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "timeout"
    assert error.value.error.stage == "poll"
    assert error.value.retryable is True


def test_gateway_applies_independent_video_timeout(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    class SlowVideoGeneration(FakeAigcGeneration):
        async def generate_seedance_video(
            self,
            request: SeedanceVideoGenerationRequest,
        ) -> GeneratedAssetResult:
            self.video_requests.append(request)
            await asyncio.sleep(1)
            raise AssertionError("video request should have timed out")

    generation = SlowVideoGeneration()
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        generation,
        test_asset_storage,
        video_timeout_seconds=0.01,
    )
    params = video_params()
    params.update(
        {
            "generation_mode": "text_to_video",
            "reference_image_asset_ids": [],
            "reference_video_asset_ids": [],
            "reference_audio_asset_ids": [],
        }
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_GENERATION,
        params,
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "timeout"
    assert error.value.retryable is True
    assert len(generation.video_requests) == 1


def test_gateway_marks_video_transfer_failure_as_retryable(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fail_transfer(*_args, **_kwargs):
        raise RuntimeError("temporary object storage failure")

    monkeypatch.setattr(
        test_asset_storage,
        "upload_assets_from_sources",
        fail_transfer,
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    params = video_params()
    params.update(
        {
            "generation_mode": "text_to_video",
            "reference_image_asset_ids": [],
            "reference_video_asset_ids": [],
            "reference_audio_asset_ids": [],
        }
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_GENERATION,
        params,
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_transfer_failed"
    assert error.value.error.stage == "asset_transfer"
    assert error.value.retryable is True
