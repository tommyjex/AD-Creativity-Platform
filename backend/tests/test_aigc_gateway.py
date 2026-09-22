from __future__ import annotations

import asyncio
import hashlib
import json
from io import BytesIO

import pytest
from PIL import Image

from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AigcAssetDirection,
    AigcGeneratedMediaName,
    AigcGeneratedMediaNamingRequest,
    AigcPipelineCreate,
    AigcPipelineDefinition,
    AigcPipelineRun,
    AigcPipelineRunNode,
    AigcPipelineTaskAssetReference,
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
    ReferenceAssetKind,
)
from backend.app.services.aigc_gateway import (
    AIGC_DEFAULT_IMAGE_MODEL,
    AIGC_DEFAULT_TEXT_MODEL,
    AIGC_IMAGE_EXECUTOR_VERSION,
    AIGC_LLM_EXECUTOR_VERSION,
    AIGC_VIDEO_FACE_BLUR_EXECUTOR_VERSION,
    AIGC_VIDEO_SUBTITLE_EXTRACTION_EXECUTOR_VERSION,
    AIGC_VIDEO_ENHANCEMENT_EXECUTOR_VERSION,
    AIGC_VIDEO_EXECUTOR_VERSION,
    AigcGatewayError,
    AigcModelGateway,
)
from backend.app.services.assets import (
    AigcMultiTrackAssetInput,
    AigcVideoFaceBlurAssetInput,
    AigcVideoSubtitleAssetInput,
    AigcVideoEnhancementAssetInput,
    AssetStorageService,
    DownloadedAsset,
)
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import (
    AigcTextGenerationRequest,
    DecomposedImageLayer,
    GeneratedAssetResult,
    LayerDecompositionResult,
    MockModelArkAdapter,
    ModelArkProviderError,
    ModelArkTextParseError,
    SeedanceVideoGenerationRequest,
)
from backend.app.services.mediakit_video_enhancement import (
    MediaKitVideoEnhancementError,
    VideoEnhancementTask,
    VideoEnhancementTaskStatus,
)
from backend.app.services.mediakit_face_blur import (
    FaceBlurTaskStatus,
    FaceBlurVideoTask,
    MediaKitFaceBlurError,
)
from backend.app.services.mediakit_multitrack import (
    MultiTrackTask,
    MultiTrackTaskStatus,
)
from backend.app.services.mediakit import SubtitleSegment
from backend.app.services.mediakit_video_ocr import (
    VideoOcrTask,
    VideoOcrTaskStatus,
)


class FakeAigcGeneration:
    def __init__(self) -> None:
        self.text_requests: list[dict[str, object]] = []
        self.image_requests: list[dict[str, object]] = []
        self.layer_requests: list[dict[str, object]] = []
        self.video_requests: list[SeedanceVideoGenerationRequest] = []
        self.naming_requests: list[AigcGeneratedMediaNamingRequest] = []
        self.text_error: Exception | None = None
        self.image_error: Exception | None = None
        self.video_error: Exception | None = None
        self.naming_error: Exception | None = None
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

    async def generate_aigc_media_name(
        self,
        request: AigcGeneratedMediaNamingRequest,
    ) -> AigcGeneratedMediaName:
        self.naming_requests.append(request)
        if self.naming_error is not None:
            raise self.naming_error
        return AigcGeneratedMediaName(name="雨夜霓虹跑车")

    async def generate_aigc_image(self, **kwargs) -> GeneratedAssetResult:
        self.image_requests.append(kwargs)
        if self.image_error is not None:
            raise self.image_error
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


class CoordinatedAigcGeneration(FakeAigcGeneration):
    def __init__(self) -> None:
        super().__init__()
        self.image_started = asyncio.Event()
        self.naming_started = asyncio.Event()
        self.image_release = asyncio.Event()
        self.naming_release = asyncio.Event()
        self.naming_cancelled = False

    async def generate_aigc_image(self, **kwargs) -> GeneratedAssetResult:
        self.image_started.set()
        await self.image_release.wait()
        return await super().generate_aigc_image(**kwargs)

    async def generate_aigc_media_name(
        self,
        request: AigcGeneratedMediaNamingRequest,
    ) -> AigcGeneratedMediaName:
        self.naming_requests.append(request)
        self.naming_started.set()
        try:
            await self.naming_release.wait()
        except asyncio.CancelledError:
            self.naming_cancelled = True
            raise
        return AigcGeneratedMediaName(name="并发命名")


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
    if task_type == AigcTaskType.VIDEO_ENHANCEMENT:
        return AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    {
                        "id": "source",
                        "type": "video_input",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 240, "height": 180},
                        "config": {"asset_id": "source-video"},
                    },
                    {
                        "id": "model",
                        "type": "video_enhancement",
                        "position": {"x": 320, "y": 0},
                        "size": {"width": 280, "height": 200},
                        "config": {},
                    },
                ],
                "edges": [
                    {
                        "id": "edge-video",
                        "sourceNodeId": "source",
                        "sourceHandle": "video",
                        "targetNodeId": "model",
                        "targetHandle": "video",
                    }
                ],
            }
        )
    if task_type == AigcTaskType.VIDEO_FACE_BLUR:
        return AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    {
                        "id": "source",
                        "type": "video_input",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 240, "height": 180},
                        "config": {"asset_id": "source-video"},
                    },
                    {
                        "id": "model",
                        "type": "video_face_blur",
                        "position": {"x": 320, "y": 0},
                        "size": {"width": 280, "height": 200},
                        "config": {},
                    },
                ],
                "edges": [
                    {
                        "id": "edge-video",
                        "sourceNodeId": "source",
                        "sourceHandle": "video",
                        "targetNodeId": "model",
                        "targetHandle": "video",
                    }
                ],
            }
        )
    if task_type == AigcTaskType.VIDEO_SUBTITLE_EXTRACTION:
        return AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    {
                        "id": "source",
                        "type": "video_input",
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 240, "height": 180},
                        "config": {"asset_id": "source-video"},
                    },
                    {
                        "id": "model",
                        "type": "video_subtitle_extraction",
                        "position": {"x": 320, "y": 0},
                        "size": {"width": 280, "height": 200},
                        "config": {"mode": "Subtitle"},
                    },
                ],
                "edges": [
                    {
                        "id": "edge-video",
                        "sourceNodeId": "source",
                        "sourceHandle": "video",
                        "targetNodeId": "model",
                        "targetHandle": "video",
                    }
                ],
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
    def __init__(
        self,
        *,
        base_size: tuple[int, int] = (512, 512),
        layer_alpha: bool = True,
        layer_size: tuple[int, int] = (256, 256),
    ) -> None:
        self.base_size = base_size
        self.layer_alpha = layer_alpha
        self.layer_size = layer_size

    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        if url.endswith("base.png"):
            return DownloadedAsset(png_bytes(self.base_size), "image/png")
        return DownloadedAsset(
            png_bytes(self.layer_size, alpha=self.layer_alpha),
            "image/png",
        )


class GeneratedImageDownloader:
    def __init__(
        self,
        *,
        content: bytes,
        mime_type: str = "image/png",
    ) -> None:
        self.content = content
        self.mime_type = mime_type

    async def fetch(
        self,
        _url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        assert expected_mime_type == self.mime_type
        return DownloadedAsset(self.content, self.mime_type)


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


def video_enhancement_params(**changes: object) -> dict[str, object]:
    params: dict[str, object] = {
        "input_asset_id": "source-video",
        "tool_version": "standard",
        "scene": "aigc",
        "enhance_style": "hd",
        "resolution_mode": "preset",
        "resolution": "1080p",
        "resolution_limit": None,
        "fps": None,
        "bitrate_mode": "level",
        "bitrate_level": "medium",
        "bitrate": None,
        "bit_depth": 8,
    }
    params.update(changes)
    return params


def video_face_blur_params(**changes: object) -> dict[str, object]:
    params: dict[str, object] = {
        "input_asset_id": "source-video",
        "mask_mode": "mosaic",
        "mask_strength": "medium",
    }
    params.update(changes)
    return params


def video_subtitle_params(**changes: object) -> dict[str, object]:
    params: dict[str, object] = {
        "input_asset_id": "source-video",
        "mode": "Subtitle",
    }
    params.update(changes)
    return params


class FakeVideoOcrClient:
    def __init__(self, *, segments: tuple[SubtitleSegment, ...]) -> None:
        self.segments = segments
        self.submit_calls: list[dict[str, object]] = []
        self.poll_calls: list[dict[str, object]] = []

    async def submit(self, **kwargs) -> VideoOcrTask:
        self.submit_calls.append(kwargs)
        return VideoOcrTask(
            task_id="ocr-task-safe",
            status=VideoOcrTaskStatus.QUEUED,
            request_id="submit-request-safe",
        )

    async def poll(self, **kwargs) -> VideoOcrTask:
        self.poll_calls.append(kwargs)
        return VideoOcrTask(
            task_id="ocr-task-safe",
            status=VideoOcrTaskStatus.SUCCEEDED,
            request_id="poll-request-safe",
            duration_seconds=8.5,
            segments=self.segments,
        )


class FakeFaceBlurVideoClient:
    def __init__(
        self,
        *,
        states: list[FaceBlurVideoTask] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.error = error
        self.submit_calls: list[dict[str, object]] = []
        self.get_calls: list[str] = []
        self.states = states or [
            FaceBlurVideoTask(
                task_id="face-blur-task-safe",
                status=FaceBlurTaskStatus.QUEUED,
                request_id="submit-request-safe",
            ),
            FaceBlurVideoTask(
                task_id="face-blur-task-safe",
                status=FaceBlurTaskStatus.RUNNING,
                request_id="poll-request-safe",
            ),
            FaceBlurVideoTask(
                task_id="face-blur-task-safe",
                status=FaceBlurTaskStatus.SUCCEEDED,
                request_id="poll-request-safe",
                output_video_url="https://provider.example/face-blur.mp4",
                duration_seconds=12.5,
            ),
        ]

    async def submit(self, **kwargs) -> FaceBlurVideoTask:
        self.submit_calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.states.pop(0)

    async def get_task(self, *, task_id: str) -> FaceBlurVideoTask:
        self.get_calls.append(task_id)
        if self.error is not None:
            raise self.error
        return self.states.pop(0)


class FakeVideoEnhancementClient:
    def __init__(self, *, error: Exception | None = None) -> None:
        self.error = error
        self.submit_calls: list[dict[str, object]] = []
        self.poll_calls: list[dict[str, object]] = []

    async def submit(self, **kwargs) -> VideoEnhancementTask:
        self.submit_calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return VideoEnhancementTask(
            task_id="enhancement-task-safe",
            request_id="submit-request-safe",
            status=VideoEnhancementTaskStatus.QUEUED,
        )

    async def poll(self, **kwargs) -> VideoEnhancementTask:
        self.poll_calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return VideoEnhancementTask(
            task_id="enhancement-task-safe",
            request_id="poll-request-safe",
            status=VideoEnhancementTaskStatus.SUCCEEDED,
            output_video_url="https://provider.example/enhanced.mp4?signature=secret",
            duration_seconds=12.5,
            fps=60,
            resolution="1920x1080",
            tool_version="standard",
        )


class FakeMultiTrackClient:
    def __init__(self) -> None:
        self.submit_calls: list[dict[str, object]] = []
        self.poll_calls: list[dict[str, object]] = []

    async def submit(self, **kwargs) -> MultiTrackTask:
        self.submit_calls.append(kwargs)
        return MultiTrackTask(
            task_id="multitrack-task-safe",
            request_id="submit-request-safe",
            status=MultiTrackTaskStatus.QUEUED,
        )

    async def poll(self, **kwargs) -> MultiTrackTask:
        self.poll_calls.append(kwargs)
        return MultiTrackTask(
            task_id="multitrack-task-safe",
            request_id="poll-request-safe",
            status=MultiTrackTaskStatus.SUCCEEDED,
            output_video_url=(
                "https://provider.example/multitrack.mp4?signature=secret"
            ),
        )


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
    assert generation.text_requests[0]["image_url"] is None
    assert generation.naming_requests == []


def test_gateway_resolves_llm_image_only_for_the_provider_call(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_media_asset(
        repository,
        "llm-image",
        AssetType.UPLOADED_IMAGE,
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LLM,
        {
            "model": AIGC_DEFAULT_TEXT_MODEL,
            "prompt": "分析这张图片",
            "input_image_asset_id": "llm-image",
        },
    )

    execution = asyncio.run(gateway.execute(task))

    provider_url = generation.text_requests[0]["image_url"]
    assert isinstance(provider_url, str)
    assert provider_url.startswith("https://")
    assert "image_url" not in task.params
    assert provider_url not in str(task.params)
    assert provider_url not in execution.result.model_dump_json()
    assert [
        (reference.direction.value, reference.slot, reference.asset_id)
        for reference in repository.list_aigc_task_assets(task.task_id)
    ] == [("input", "image", "llm-image")]


def test_gateway_rejects_unavailable_llm_image_without_provider_call(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_media_asset(
        repository,
        "unavailable-image",
        AssetType.UPLOADED_IMAGE,
        status=Status.FAILED,
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(repository, generation, test_asset_storage)  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LLM,
        {
            "model": AIGC_DEFAULT_TEXT_MODEL,
            "prompt": "不应调用",
            "input_image_asset_id": "unavailable-image",
        },
    )

    with pytest.raises(AigcGatewayError, match="invalid or unavailable"):
        asyncio.run(gateway.execute(task))
    assert generation.text_requests == []


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
    assert saved.metadata["name"] == "Gateway-test-文生图-图片1.png"
    assert saved.metadata["name_scheme"] == "aigc_canvas_node_v1"
    assert output.download_url == f"/api/assets/{saved.id}/content"
    references = repository.list_aigc_task_assets(task.task_id)
    assert [(item.direction.value, item.asset_id) for item in references] == [
        ("output", saved.id)
    ]
    assert generation.image_requests[0]["size"] == "2K"
    assert "画幅比例：16:9" in generation.image_requests[0]["prompt"]
    naming_request = generation.naming_requests[0]
    assert naming_request.prompt == generation.image_requests[0]["prompt"]
    assert naming_request.visual_inputs == ()
    assert saved.metadata["size"] == "2K"
    assert saved.metadata["aspect_ratio"] == "16:9"
    assert "target_width" not in saved.metadata


def test_gateway_starts_generation_and_naming_concurrently(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = CoordinatedAigcGeneration()
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.TEXT_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "并发测试",
            "size": "2K",
            "format": "png",
        },
    )

    async def run():
        execution_task = asyncio.create_task(gateway.execute(task))
        await asyncio.wait_for(generation.image_started.wait(), timeout=0.2)
        await asyncio.wait_for(generation.naming_started.wait(), timeout=0.2)
        assert not execution_task.done()
        generation.naming_release.set()
        generation.image_release.set()
        return await execution_task

    execution = asyncio.run(run())

    assert len(generation.image_requests) == 1
    assert len(generation.naming_requests) == 1
    assert execution.result.naming is not None
    assert execution.result.naming.status.value == "succeeded"
    assert execution.result.naming.name == "并发命名"


def test_gateway_naming_timeout_does_not_block_successful_generation(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = CoordinatedAigcGeneration()
    generation.image_release.set()
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
        naming_timeout_seconds=0.01,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.TEXT_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "命名超时测试",
            "size": "2K",
            "format": "png",
        },
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.result.kind == AigcResultKind.ASSETS
    assert execution.result.naming is not None
    assert execution.result.naming.status.value == "timeout"
    assert execution.result.naming.name is None
    assert generation.naming_cancelled is True


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (
            ModelArkProviderError(
                "secret provider body",
                phase="media_naming",
                provider_code="429",
            ),
            "provider_error",
        ),
        (
            ModelArkTextParseError(
                "raw invalid response",
                phase="media_naming",
            ),
            "invalid_response",
        ),
    ],
)
def test_gateway_naming_failure_is_non_blocking(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    error: Exception,
    expected_status: str,
) -> None:
    generation = FakeAigcGeneration()
    generation.naming_error = error
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.TEXT_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "降级测试",
            "size": "2K",
            "format": "png",
        },
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.result.kind == AigcResultKind.ASSETS
    assert execution.result.naming is not None
    assert execution.result.naming.status.value == expected_status
    assert execution.result.naming.name is None
    assert len(generation.naming_requests) == 1


def test_gateway_generation_failure_cancels_and_discards_naming(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = CoordinatedAigcGeneration()

    async def fail_after_naming_starts(**kwargs):
        generation.image_requests.append(kwargs)
        await generation.naming_started.wait()
        raise ModelArkProviderError(
            "generation failed",
            phase="image_generate",
            provider_code="InternalError",
        )

    generation.generate_aigc_image = fail_after_naming_starts  # type: ignore[method-assign]
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.TEXT_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "主生成失败",
            "size": "2K",
            "format": "png",
        },
    )

    with pytest.raises(AigcGatewayError):
        asyncio.run(gateway.execute(task))

    assert len(generation.naming_requests) == 1
    assert generation.naming_cancelled is True
    assert repository.list_aigc_task_assets(task.task_id) == []


def test_gateway_cancellation_cancels_naming(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = CoordinatedAigcGeneration()
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.TEXT_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "取消测试",
            "size": "2K",
            "format": "png",
        },
    )

    async def run() -> None:
        execution_task = asyncio.create_task(gateway.execute(task))
        await generation.image_started.wait()
        await generation.naming_started.wait()
        execution_task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await execution_task

    asyncio.run(run())

    assert generation.naming_cancelled is True
    assert repository.list_aigc_task_assets(task.task_id) == []


def test_gateway_new_retry_attempt_can_name_once_again(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    first = create_persisted_task(
        repository,
        AigcTaskType.TEXT_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "自动重试测试",
            "size": "2K",
            "format": "png",
        },
    )
    asyncio.run(gateway.execute(first))
    repository.update_aigc_task_attempt(first.task_id, status="failed")
    retry = repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=first.pipeline_id,
            run_id=first.run_id,
            node_id=first.node_id,
            type=first.type,
            params=first.params,
        ),
        idempotency_key="retry-generated-media-naming",
        retry_of_task_id=first.task_id,
    )

    retry_execution = asyncio.run(gateway.execute(retry))

    assert (first.attempt, retry.attempt) == (1, 2)
    assert retry_execution.result.naming is not None
    assert retry_execution.result.naming.status.value == "succeeded"
    assert len(generation.naming_requests) == 2


@pytest.mark.parametrize(
    ("task_type", "reference_asset_ids"),
    [
        (AigcTaskType.TEXT_TO_IMAGE, []),
        (AigcTaskType.IMAGE_TO_IMAGE, ["source-image"]),
        (
            AigcTaskType.IMAGE_TO_IMAGE,
            ["source-image", "reference-1", "reference-2"],
        ),
    ],
)
def test_gateway_forwards_custom_size_without_aspect_ratio_prompt(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    task_type: AigcTaskType,
    reference_asset_ids: list[str],
) -> None:
    for asset_id in reference_asset_ids:
        create_image_asset(repository, asset_id)
    test_asset_storage.downloader = GeneratedImageDownloader(
        content=png_bytes((2048, 1024)),
    )
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    params: dict[str, object] = {
        "model": AIGC_DEFAULT_IMAGE_MODEL,
        "prompt": "保持精确构图",
        "aspect_ratio": "9:16",
        "size": "02048x01024",
        "format": "png",
    }
    if reference_asset_ids:
        params["reference_asset_ids"] = reference_asset_ids
    task = create_persisted_task(repository, task_type, params)

    execution = asyncio.run(gateway.execute(task))

    request = generation.image_requests[0]
    assert request["size"] == "2048x1024"
    assert request["prompt"] == "保持精确构图"
    assert "画幅比例" not in str(request["prompt"])
    if reference_asset_ids:
        assert str(request["source_image_url"]).startswith(
            "https://local-assets.tos.local/"
        )
    else:
        assert request["source_image_url"] is None
    assert len(request["reference_image_urls"]) == max(
        0,
        len(reference_asset_ids) - 1,
    )
    assert [
        item.url for item in generation.naming_requests[0].visual_inputs
    ] == (
        [
            request["source_image_url"],
            *request["reference_image_urls"],
        ]
        if reference_asset_ids
        else []
    )
    saved = repository.get_asset(execution.result.assets[0].asset_id)
    assert saved.metadata["size"] == "2048x1024"
    assert saved.metadata["target_width"] == 2048
    assert saved.metadata["target_height"] == 1024
    assert saved.metadata["width"] == 2048
    assert saved.metadata["height"] == 1024
    assert "aspect_ratio" not in saved.metadata


@pytest.mark.parametrize(
    ("content", "expected_code", "message"),
    [
        (
            png_bytes((1024, 1024)),
            "output_dimensions_mismatch",
            "1024x1024",
        ),
        (
            b"not-a-decodable-image",
            "output_image_decode_failed",
            "could not be decoded",
        ),
    ],
)
def test_gateway_rejects_invalid_custom_size_output_without_residue(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    content: bytes,
    expected_code: str,
    message: str,
) -> None:
    create_image_asset(repository, "source-image")
    test_asset_storage.downloader = GeneratedImageDownloader(content=content)
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "保持精确尺寸",
            "size": "2048x1024",
            "format": "png",
            "reference_asset_ids": ["source-image"],
        },
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == expected_code
    assert error.value.error.stage == "output_validation"
    assert message in error.value.error.message
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert [asset.id for asset in repository.list_assets()] == ["source-image"]
    storage_client = test_asset_storage.client
    assert storage_client is not None
    assert storage_client.puts == []  # type: ignore[attr-defined]
    assert storage_client.objects == {}  # type: ignore[attr-defined]


def test_gateway_cleans_custom_image_relations_after_upload_failure(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_image_asset(repository, "source-image")
    test_asset_storage.downloader = GeneratedImageDownloader(
        content=png_bytes((2048, 1024)),
    )
    storage_client = test_asset_storage.client
    assert storage_client is not None
    storage_client.fail_uploads = True  # type: ignore[attr-defined]
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "上传失败清理",
            "size": "2048x1024",
            "format": "png",
            "reference_asset_ids": ["source-image"],
        },
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_persistence_failed"
    assert error.value.error.stage == "asset_persistence"
    assert error.value.retryable is True
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert [asset.id for asset in repository.list_assets()] == ["source-image"]
    assert storage_client.objects == {}  # type: ignore[attr-defined]


def test_gateway_cleans_custom_image_object_asset_and_relations_on_db_failure(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_image_asset(repository, "source-image")
    test_asset_storage.downloader = GeneratedImageDownloader(
        content=png_bytes((2048, 1024)),
    )
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.IMAGE_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "数据库失败清理",
            "size": "2048x1024",
            "format": "png",
            "reference_asset_ids": ["source-image"],
        },
    )
    original_create_assets = repository.create_assets

    def partially_fail_create_assets(items):
        original_create_assets(items)
        raise RuntimeError("simulated DB failure")

    monkeypatch.setattr(repository, "create_assets", partially_fail_create_assets)

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_persistence_failed"
    assert error.value.error.stage == "asset_persistence"
    assert repository.list_aigc_task_assets(task.task_id) == []
    assert [asset.id for asset in repository.list_assets()] == ["source-image"]
    storage_client = test_asset_storage.client
    assert storage_client is not None
    assert storage_client.objects == {}  # type: ignore[attr-defined]
    assert storage_client.deletes == [  # type: ignore[attr-defined]
        storage_client.puts[0]["key"]  # type: ignore[attr-defined]
    ]


@pytest.mark.parametrize(
    "size",
    ["2048X1024", "512x512", "2048x1024 "],
)
def test_gateway_revalidates_image_size_before_provider_call(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    size: str,
) -> None:
    generation = FakeAigcGeneration()
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.TEXT_TO_IMAGE,
        {
            "model": AIGC_DEFAULT_IMAGE_MODEL,
            "prompt": "非法尺寸不得执行",
            "size": size,
        },
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert error.value.error.stage == "input_resolution"
    assert generation.image_requests == []


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
    assert [
        item.url for item in generation.naming_requests[0].visual_inputs
    ] == [generation.image_requests[0]["source_image_url"]]
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
    assert generation.naming_requests[0].prompt == "移除背景文字"
    assert [
        item.url for item in generation.naming_requests[0].visual_inputs
    ] == [generation.image_requests[0]["source_image_url"]]
    output = execution.result.assets[0]
    saved = repository.get_asset(output.asset_id)
    assert saved.asset_role == AssetRole.PUBLIC
    assert saved.metadata["name"] == "Gateway-test-图片编辑-图片1.png"
    assert saved.metadata["name_scheme"] == "aigc_canvas_node_v1"
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
    assert "name" not in saved.metadata
    assert "name_scheme" not in saved.metadata
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


def test_gateway_uses_provider_canvas_dimensions_for_scaled_layer_result(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_layer_source(
        repository,
        test_asset_storage,
        size=(1464, 600),
    )
    test_asset_storage.downloader = LayerResultDownloader(
        base_size=(1600, 656),
        layer_size=(478, 75),
    )
    generation = FakeAigcGeneration()
    generation.layer_result = LayerDecompositionResult(
        base_url="https://provider.example/layers/base.png",
        layers=[
            DecomposedImageLayer(
                z_index=1,
                url="https://provider.example/layers/layer-1.png",
                name="Headline",
                description="Foreground headline",
                bbox_absolute=(128, 170, 606, 245),
                bbox_normalized=(80, 259, 378, 372),
            )
        ],
    )
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    layer_set = execution.result.layer_set
    assert layer_set is not None
    assert (layer_set.canvas_width, layer_set.canvas_height) == (1600, 656)
    assert layer_set.layers[0].bbox_absolute == (128, 170, 606, 245)
    assert generation.layer_requests[0]["canvas_width"] == 1464
    assert generation.layer_requests[0]["canvas_height"] == 600


def test_gateway_rejects_layer_bbox_outside_provider_canvas(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_layer_source(repository, test_asset_storage)
    test_asset_storage.downloader = LayerResultDownloader()
    generation = FakeAigcGeneration()
    generation.layer_result = LayerDecompositionResult(
        base_url="https://provider.example/layers/base.png",
        layers=[
            DecomposedImageLayer(
                z_index=1,
                url="https://provider.example/layers/layer-1.png",
                name="Invalid",
                description="Outside the provider canvas",
                bbox_absolute=(0, 0, 513, 512),
                bbox_normalized=(0, 0, 1000, 1000),
            )
        ],
    )
    gateway = AigcModelGateway(
        repository,
        generation,
        test_asset_storage,
    )  # type: ignore[arg-type]
    task = create_persisted_task(
        repository,
        AigcTaskType.LAYER_DECOMPOSITION,
        layer_decomposition_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert repository.list_aigc_task_assets(task.task_id) == []


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


def test_gateway_resolves_multi_track_assets_and_uses_mock_mediakit(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    custom_font_url = (
        "https://xujianhua-utils.tos-cn-beijing.volces.com/"
        "ECOVACS/centurygothic.ttf"
    )
    for asset_id, asset_type in (
        ("video-input", AssetType.UPLOADED_VIDEO),
        ("image-input", AssetType.UPLOADED_IMAGE),
        ("audio-input", AssetType.UPLOADED_AUDIO),
    ):
        create_media_asset(
            repository,
            asset_id,
            asset_type,
            metadata=(
                {"duration_seconds": 2}
                if asset_type
                in {AssetType.UPLOADED_VIDEO, AssetType.UPLOADED_AUDIO}
                else None
            ),
        )
    repository.create_asset(
        AssetCreate(
            id="subtitle-input",
            tool_asset_role=ToolAssetRole.INPUT,
            type=AssetType.SUBTITLE,
            status=Status.SUCCEEDED,
            object_key="aigc/subtitle-input.srt",
            mime_type="application/x-subrip",
        )
    )
    params = {
        "project": {
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
                    "order": 0,
                    "hidden": False,
                    "muted": False,
                    "elements": [
                        {
                            "id": "video-element",
                            "type": "video",
                            "source": {
                                "source_node_id": "video",
                                "source_handle": "video",
                            },
                            "target_time": {"start_ms": 0, "end_ms": 2000},
                            "loop": False,
                            "transform": {
                                "x": 0.4,
                                "y": 0.6,
                                "width": 1919.6,
                                "height": 1079.4,
                                "rotation": 0.4,
                            },
                            "speed": 1,
                            "volume": 1,
                            "fade_in_ms": 0,
                            "fade_out_ms": 0,
                            "transition": None,
                            "source_trim": {"start_ms": 0, "end_ms": 2000},
                        }
                    ],
                },
                {
                    "id": "text-track",
                    "name": "文字",
                    "type": "text",
                    "order": 1,
                    "hidden": False,
                    "muted": False,
                    "elements": [
                        {
                            "id": "text-element",
                            "type": "text",
                            "source": {
                                "source_node_id": "text",
                                "source_handle": "text",
                            },
                            "inline_text": None,
                            "target_time": {"start_ms": 0, "end_ms": 2000},
                            "loop": False,
                            "transform": {
                                "x": 100.4,
                                "y": 100.6,
                                "width": 600.4,
                                "height": 100.6,
                                "rotation": 1.6,
                            },
                            "style": {
                                "font_type": "SY_Black",
                                "font_size": 48.6,
                                "color": "#FFFFFFFF",
                                "bold": False,
                                "italic": False,
                                "underline": False,
                                "background_color": "#00000000",
                            },
                        },
                        {
                            "id": "default-text-element",
                            "type": "text",
                            "inline_text": "默认字体文本",
                            "target_time": {"start_ms": 2000, "end_ms": 3000},
                            "loop": False,
                            "transform": {
                                "x": 100,
                                "y": 220,
                                "width": 600,
                                "height": 100,
                                "rotation": 0,
                            },
                            "style": {
                                "font_type": None,
                                "font_size": 48,
                                "color": "#FFFFFFFF",
                                "bold": False,
                                "italic": False,
                                "underline": False,
                                "background_color": "#00000000",
                            },
                        }
                    ],
                },
                {
                    "id": "image-track",
                    "name": "图片",
                    "type": "image",
                    "order": 2,
                    "hidden": False,
                    "muted": False,
                    "elements": [
                        {
                            "id": "image-element",
                            "type": "image",
                            "source": {
                                "source_node_id": "image",
                                "source_handle": "image",
                            },
                            "target_time": {"start_ms": 0, "end_ms": 2000},
                            "loop": False,
                            "transform": {
                                "x": 0,
                                "y": 0,
                                "width": 640,
                                "height": 360,
                                "rotation": 0,
                            },
                        }
                    ],
                },
                {
                    "id": "audio-track",
                    "name": "音频",
                    "type": "audio",
                    "order": 3,
                    "hidden": False,
                    "muted": False,
                    "elements": [
                        {
                            "id": "audio-element",
                            "type": "audio",
                            "source": {
                                "source_node_id": "audio",
                                "source_handle": "audio",
                            },
                            "target_time": {"start_ms": 0, "end_ms": 2000},
                            "loop": False,
                            "speed": 1,
                            "volume": 1,
                            "fade_in_ms": 0,
                            "fade_out_ms": 0,
                            "source_trim": {"start_ms": 0, "end_ms": 2000},
                        }
                    ],
                },
                {
                    "id": "subtitle-track",
                    "name": "字幕",
                    "type": "subtitle",
                    "order": 4,
                    "hidden": False,
                    "muted": False,
                    "elements": [
                        {
                            "id": "subtitle-element",
                            "type": "subtitle",
                            "asset_id": "subtitle-input",
                            "target_time": {"start_ms": 0, "end_ms": 2000},
                            "loop": False,
                            "transform": {
                                "x": 100,
                                "y": 900,
                                "width": 1720,
                                "height": 100,
                                "rotation": 0,
                            },
                            "style": {
                                "font_type": custom_font_url,
                                "font_size": 48,
                                "color": "#FFFFFFFF",
                                "bold": False,
                                "italic": False,
                                "underline": False,
                                "background_color": "#00000000",
                            },
                        }
                    ],
                },
            ],
        },
        "resolved_sources": {
            "video-element": {"type": "video", "asset_id": "video-input"},
            "image-element": {"type": "image", "asset_id": "image-input"},
            "audio-element": {"type": "audio", "asset_id": "audio-input"},
            "text-element": {"type": "text", "text": "当前 Run 文本"},
            "default-text-element": {
                "type": "text",
                "text": "默认字体文本",
            },
            "subtitle-element": {
                "type": "subtitle",
                "asset_id": "subtitle-input",
            },
        },
    }
    definition = pipeline_definition(AigcTaskType.LLM)
    pipeline = repository.create_aigc_pipeline(
        AigcPipelineCreate(name="Multi-track gateway", definition=definition)
    )
    run = repository.create_aigc_run(
        AigcPipelineRun(
            pipeline_id=pipeline.id,
            run_number=1,
            pipeline_revision=0,
            mode="full",
            definition_snapshot=definition,
        ),
        idempotency_key="multi-track-gateway-run",
        nodes=[
            AigcPipelineRunNode(
                node_id=item.id,
                included_in_plan=item.id == "model",
                status=(
                    AigcRunNodeStatus.READY
                    if item.id == "model"
                    else AigcRunNodeStatus.SUCCEEDED
                ),
            )
            for item in definition.nodes
        ],
    )
    task = repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=run.run.id,
            node_id="model",
            type=AigcTaskType.MULTI_TRACK_EDIT,
            params=params,
        ),
        idempotency_key="multi-track-gateway-task",
    )
    client = FakeMultiTrackClient()
    captured: list[AigcMultiTrackAssetInput] = []

    async def store_multitrack(repo, data):
        captured.append(data)
        return repo.create_asset(
            AssetCreate(
                id="multitrack-output",
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.STORYBOARD_VIDEO,
                asset_role=AssetRole.PUBLIC,
                status=Status.SUCCEEDED,
                object_key="aigc/multitrack-output.mp4",
                mime_type="video/mp4",
                metadata={
                    "provider": "mediakit",
                    "operation": "multi_track_edit",
                    "track_count": len(data.tracks),
                    "element_count": sum(
                        len(track["elements"]) for track in data.tracks
                    ),
                    "duration_ms": data.duration_ms,
                    "width": data.width,
                    "height": data.height,
                    "fps": data.fps,
                    "provider_task_id": data.provider_task_id,
                    "provider_request_id": data.provider_request_id,
                        "executor_version": data.executor_version,
                },
            )
        )

    monkeypatch.setattr(
        test_asset_storage,
        "store_aigc_multitrack_video",
        store_multitrack,
    )
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),  # type: ignore[arg-type]
        test_asset_storage,
        multitrack_client_factory=lambda: client,
        multitrack_poll_interval_seconds=7,
        multitrack_timeout_seconds=99,
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.executor_version == "aigc-multitrack-v1"
    assert execution.result.kind == AigcResultKind.ASSETS
    assert execution.result.assets[0].asset_id == "multitrack-output"
    assert execution.result.assets[0].metadata == {
        "provider": "mediakit",
        "operation": "multi_track_edit",
        "provider_task_id": "multitrack-task-safe",
        "provider_request_id": "poll-request-safe",
        "track_count": 5,
        "element_count": 6,
        "duration_ms": 3000,
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "executor_version": "aigc-multitrack-v1",
    }
    assert execution.provider_output_url is None
    assert client.poll_calls == [
        {
            "task_id": "multitrack-task-safe",
            "timeout_seconds": 99,
            "poll_interval_seconds": 7,
        }
    ]
    submit = client.submit_calls[0]
    assert submit["idempotency_key"] == task.task_id
    provider_project = submit["project"]
    assert isinstance(provider_project, dict)
    assert set(provider_project) == {"canvas", "track", "output"}
    assert provider_project["canvas"] == {
        "width": 1920,
        "height": 1080,
        "background_color": "#000000FF",
    }
    provider_tracks = provider_project["track"]
    assert isinstance(provider_tracks, list)
    assert [track[0]["type"] for track in provider_tracks] == [
        "subtitle",
        "audio",
        "image",
        "text",
        "video",
    ]
    assert provider_tracks[4][0]["source"].startswith(
        "https://"
    )
    provider_text_track = provider_tracks[3]
    assert [element["text"] for element in provider_text_track] == [
        "当前 Run 文本",
        "默认字体文本",
    ]
    provider_text = provider_text_track[0]
    provider_default_text = provider_text_track[1]
    provider_subtitle = provider_tracks[0][0]
    provider_image = provider_tracks[2][0]
    provider_video = provider_tracks[4][0]

    def assert_transform(
        provider_element: dict[str, object],
        expected: dict[str, object],
    ) -> None:
        assert provider_element["extra"] == [
            {"type": "transform", **expected}
        ]
        assert "transform" not in provider_element

    assert_transform(
        provider_video,
        {
            "pos_x": 0,
            "pos_y": 1,
            "width": 1920,
            "height": 1079,
            "rotation": 0,
        },
    )
    assert_transform(
        provider_image,
        {
            "pos_x": 0,
            "pos_y": 0,
            "width": 640,
            "height": 360,
            "rotation": 0,
        },
    )
    assert_transform(
        provider_text,
        {
            "pos_x": 100,
            "pos_y": 101,
            "width": 600,
            "height": 101,
            "rotation": 2,
        },
    )
    assert_transform(
        provider_subtitle,
        {
            "pos_x": 100,
            "pos_y": 900,
            "width": 1720,
            "height": 100,
            "rotation": 0,
        },
    )
    assert {
        key: provider_text[key]
        for key in (
            "font_type",
            "font_size",
            "font_color",
            "bold",
            "italic",
            "underline",
            "background_color",
        )
    } == {
        "font_type": "SY_Black",
        "font_size": 49,
        "font_color": "#FFFFFFFF",
        "bold": False,
        "italic": False,
        "underline": False,
        "background_color": "#00000000",
    }
    assert {
        key: provider_subtitle[key]
        for key in (
            "font_type",
            "font_size",
            "font_color",
            "bold",
            "italic",
            "underline",
            "background_color",
        )
    } == {
        "font_type": custom_font_url,
        "font_size": 48,
        "font_color": "#FFFFFFFF",
        "bold": False,
        "italic": False,
        "underline": False,
        "background_color": "#00000000",
    }
    assert "font_type" not in provider_default_text
    for provider_element in (
        provider_text,
        provider_default_text,
        provider_subtitle,
    ):
        assert "style" not in provider_element
        assert "asset_id" not in provider_element
        assert "inline_text" not in provider_element
    assert task.params["project"]["tracks"][1]["elements"][0]["style"][  # type: ignore[index]
        "font_type"
    ] == "SY_Black"
    assert task.params["project"]["tracks"][1]["elements"][0]["transform"][  # type: ignore[index]
        "x"
    ] == 100.4
    assert task.params["project"]["tracks"][4]["elements"][0]["style"][  # type: ignore[index]
        "font_type"
    ] == custom_font_url
    assert [
        track["type"]  # type: ignore[index]
        for track in task.params["project"]["tracks"]  # type: ignore[index]
    ] == ["video", "text", "image", "audio", "subtitle"]
    assert "/subtitle-input.srt?" in provider_subtitle["text"]
    assert "source" not in provider_subtitle
    assert "url" not in provider_video
    assert provider_video["target_time"] == [0, 2000]
    assert provider_video["source_trim"] == [0, 2000]
    assert provider_tracks[3][0]["target_time"] == [0, 2000]
    assert captured[0].input_asset_ids == {
        "video": ("video-input",),
        "image": ("image-input",),
        "audio": ("audio-input",),
        "subtitle": ("subtitle-input",),
    }
    assert captured[0].duration_ms == 3000
    assert captured[0].width == 1920
    assert captured[0].height == 1080
    assert captured[0].fps == 30
    assert captured[0].provider_task_id == "multitrack-task-safe"
    assert captured[0].provider_request_id == "poll-request-safe"
    assert captured[0].naming_context is not None
    assert captured[0].naming_context.pipeline_name == "Multi-track gateway"
    assert captured[0].naming_context.node_id == task.node_id
    assert "signature=secret" not in repr(task.params)
    assert "signature=secret" not in repr(execution.result)
    assert "signature=secret" not in repr(
        repository.get_asset("multitrack-output").metadata
    )


@pytest.mark.parametrize(
    ("kind", "asset_type", "metadata"),
    [
        ("video", AssetType.UPLOADED_VIDEO, {"duration_seconds": 2}),
        ("audio", AssetType.UPLOADED_AUDIO, {"duration_ms": 2000}),
    ],
)
def test_gateway_rejects_multi_track_source_trim_past_asset_duration_before_submit(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    kind: str,
    asset_type: AssetType,
    metadata: dict[str, object],
) -> None:
    asset_id = f"{kind}-trim-input"
    create_media_asset(
        repository,
        asset_id,
        asset_type,
        metadata=metadata,
    )
    transform = (
        {
            "transform": {
                "x": 0,
                "y": 0,
                "width": 1920,
                "height": 1080,
                "rotation": 0,
            },
            "transition": None,
        }
        if kind == "video"
        else {}
    )
    params = {
        "project": {
            "canvas": {
                "mode": "custom",
                "width": 1920,
                "height": 1080,
                "background_color": "#000000FF",
            },
            "output": {"format": "mp4", "fps": 30},
            "tracks": [
                {
                    "id": f"{kind}-track",
                    "name": kind,
                    "type": kind,
                    "elements": [
                        {
                            "id": f"{kind}-element",
                            "type": kind,
                            "source": {
                                "source_node_id": kind,
                                "source_handle": kind,
                            },
                            "target_time": {"start_ms": 0, "end_ms": 2001},
                            "source_trim": {"start_ms": 0, "end_ms": 2001},
                            "speed": 1,
                            "volume": 1,
                            "fade_in_ms": 0,
                            "fade_out_ms": 0,
                            **transform,
                        }
                    ],
                }
            ],
        },
        "resolved_sources": {
            f"{kind}-element": {"type": kind, "asset_id": asset_id}
        },
    }
    task = create_persisted_task(
        repository,
        AigcTaskType.LLM,
        params,
    ).model_copy(update={"type": AigcTaskType.MULTI_TRACK_EDIT})
    client = FakeMultiTrackClient()
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),  # type: ignore[arg-type]
        test_asset_storage,
        multitrack_client_factory=lambda: client,
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert error.value.error.stage == "input_resolution"
    assert client.submit_calls == []
    assert client.poll_calls == []


@pytest.mark.parametrize("speed", [0, -1, 0.000001])
def test_gateway_rejects_invalid_multi_track_speed_before_submit(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    speed: float,
) -> None:
    create_media_asset(
        repository,
        "audio-speed-input",
        AssetType.UPLOADED_AUDIO,
        metadata={"duration_seconds": 2},
    )
    params = {
        "project": {
            "canvas": {
                "mode": "custom",
                "width": 1920,
                "height": 1080,
                "background_color": "#000000FF",
            },
            "output": {"format": "mp4", "fps": 30},
            "tracks": [
                {
                    "id": "audio-track",
                    "name": "audio",
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
                            "source_trim": {"start_ms": 0, "end_ms": 2000},
                            "speed": speed,
                            "volume": 1,
                            "fade_in_ms": 0,
                            "fade_out_ms": 0,
                        }
                    ],
                }
            ],
        },
        "resolved_sources": {
            "audio-element": {
                "type": "audio",
                "asset_id": "audio-speed-input",
            }
        },
    }
    task = create_persisted_task(
        repository,
        AigcTaskType.LLM,
        params,
    ).model_copy(update={"type": AigcTaskType.MULTI_TRACK_EDIT})
    client = FakeMultiTrackClient()
    gateway = AigcModelGateway(
        repository,
        FakeAigcGeneration(),  # type: ignore[arg-type]
        test_asset_storage,
        multitrack_client_factory=lambda: client,
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_speed"
    assert error.value.error.stage == "validate"
    assert client.submit_calls == []
    assert client.poll_calls == []


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


def test_gateway_flattens_layer_set_without_replacement(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    params = _layer_composite_params(repository, test_asset_storage)
    params.pop("replacement")
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
    output_layer_set = execution.result.layer_set
    assert output_layer_set is not None
    assert output_layer_set.model_dump(mode="json") == params["input_layer_set"]

    output = execution.result.assets[0]
    saved = repository.get_asset(output.asset_id)
    client = test_asset_storage.client
    assert client is not None
    assert saved.object_key is not None
    with Image.open(BytesIO(client.get_object(key=saved.object_key))) as image:
        rgba = image.convert("RGBA")
        assert rgba.getpixel((0, 0)) == (255, 0, 0, 255)
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
        ("output", "base", 0, "base-asset"),
        ("output", "image", 0, saved.id),
        ("output", "layers", 0, "layer-old"),
        ("output", "layers", 1, "layer-other"),
        ("output", "layers", 2, "layer-hidden"),
    ]
    assert all(item.slot != "replacement" for item in references)


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
    assert saved.metadata["name"] == "Gateway-test-图层合成-图片1.png"
    assert saved.metadata["name_scheme"] == "aigc_canvas_node_v1"
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
    naming_request = generation.naming_requests[0]
    assert naming_request.prompt == task.params["prompt"]
    assert [item.type for item in naming_request.visual_inputs] == [
        "image",
        "image",
        "video",
    ]
    assert [item.url for item in naming_request.visual_inputs] == [
        *request.reference_image_urls,
        *request.reference_video_urls,
    ]
    assert naming_request.visual_inputs[-1].fps == 0.3
    assert request.reference_audio_urls[0] not in {
        item.url for item in naming_request.visual_inputs
    }
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
    assert saved.metadata["name"] == "Gateway-test-生视频-视频1.mp4"
    assert saved.metadata["name_scheme"] == "aigc_canvas_node_v1"
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
    assert [
        item.url for item in generation.naming_requests[0].visual_inputs
    ] == [request.first_frame_url, request.last_frame_url]
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


def test_gateway_extracts_video_subtitles_to_srt_asset(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1920,
            "height": 1080,
            "duration_seconds": 8.5,
            "fps": 30,
            "video_codec": "h264",
        },
    )
    client = FakeVideoOcrClient(
        segments=(
            SubtitleSegment(1, 2, "第一句"),
            SubtitleSegment(3, 4.5, "Second line"),
        )
    )
    captured: list[AigcVideoSubtitleAssetInput] = []

    def store_subtitles(repo, data):
        captured.append(data)
        output = repo.create_asset(
            AssetCreate(
                id="subtitle-output",
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.SUBTITLE,
                asset_role=AssetRole.PUBLIC,
                status=Status.SUCCEEDED,
                object_key="aigc/subtitle-output.srt",
                mime_type="application/x-subrip",
                metadata={
                    "provider": "mediakit",
                    "operation": "video_ocr",
                    "mode": "Subtitle",
                    "segment_count": data.segment_count,
                    "duration_seconds": data.duration_seconds,
                },
            )
        )
        repo.add_aigc_task_assets(
            [
                AigcPipelineTaskAssetReference(
                    task_id=data.task_id,
                    direction=AigcAssetDirection.OUTPUT,
                    slot="subtitle",
                    ordinal=0,
                    asset_id=output.id,
                )
            ]
        )
        return output

    monkeypatch.setattr(
        test_asset_storage,
        "store_aigc_video_subtitles",
        store_subtitles,
    )
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        video_ocr_client_factory=lambda: client,
        video_ocr_poll_interval_seconds=0.001,
        video_ocr_timeout_seconds=1,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_SUBTITLE_EXTRACTION,
        video_subtitle_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    assert (
        execution.executor_version
        == AIGC_VIDEO_SUBTITLE_EXTRACTION_EXECUTOR_VERSION
    )
    assert execution.result.kind == AigcResultKind.ASSETS
    assert execution.result.assets[0].asset_id == "subtitle-output"
    assert captured[0].srt_text == (
        "1\n00:00:01,000 --> 00:00:02,000\n第一句\n\n"
        "2\n00:00:03,000 --> 00:00:04,500\nSecond line\n"
    )
    assert captured[0].segment_count == 2
    assert client.submit_calls[0]["mode"] == "Subtitle"
    assert str(client.submit_calls[0]["client_token"]).startswith(
        "aigc-video-ocr-"
    )


def test_gateway_video_subtitle_empty_result_succeeds_without_asset(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1280,
            "height": 720,
            "duration_seconds": 5,
            "fps": 30,
            "video_codec": "h264",
        },
    )
    client = FakeVideoOcrClient(segments=())
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        video_ocr_client_factory=lambda: client,
        video_ocr_poll_interval_seconds=0.001,
        video_ocr_timeout_seconds=1,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_SUBTITLE_EXTRACTION,
        video_subtitle_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.result.kind == AigcResultKind.NONE
    assert execution.result.assets == []
    assert execution.result.metadata["empty"] is True
    assert execution.result.metadata["segment_count"] == 0


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


def test_gateway_executes_video_enhancement_and_streams_result(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1920,
            "height": 1080,
            "duration_seconds": 12,
            "fps": 30,
            "video_codec": "h264",
            "audio_codec": "aac",
        },
    )
    client = FakeVideoEnhancementClient()
    captured: list[AigcVideoEnhancementAssetInput] = []

    async def store_enhancement(repo, data):
        captured.append(data)
        output = repo.create_asset(
            AssetCreate(
                id="enhancement-output",
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.STORYBOARD_VIDEO,
                asset_role=AssetRole.PUBLIC,
                status=Status.SUCCEEDED,
                object_key="aigc/enhancement-output.mp4",
                mime_type="video/mp4",
                metadata={
                    "provider": "mediakit",
                    "provider_task_id": data.provider_task_id,
                    "resolution": data.resolution,
                    "fps": data.fps,
                    "duration_seconds": data.duration_seconds,
                    "tool_version": data.tool_version,
                    "bit_depth": data.bit_depth,
                },
            )
        )
        repo.add_aigc_task_assets(
            [
                AigcPipelineTaskAssetReference(
                    task_id=data.task_id,
                    direction=AigcAssetDirection.OUTPUT,
                    slot="video",
                    ordinal=0,
                    asset_id=output.id,
                )
            ]
        )
        return output

    monkeypatch.setattr(
        test_asset_storage,
        "store_aigc_video_enhancement",
        store_enhancement,
    )
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),  # cached inspection avoids probing
        video_enhancement_client_factory=lambda: client,
        video_enhancement_poll_interval_seconds=7,
        video_enhancement_timeout_seconds=90,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_ENHANCEMENT,
        video_enhancement_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.executor_version == AIGC_VIDEO_ENHANCEMENT_EXECUTOR_VERSION
    assert client.submit_calls[0]["video_url"].startswith("https://")
    assert client.submit_calls[0]["idempotency_key"] == (
        f"{task.pipeline_id}:{task.run_id}:{task.node_id}"
    )
    assert client.poll_calls == [
        {
            "task_id": "enhancement-task-safe",
            "timeout_seconds": 90,
            "poll_interval_seconds": 7,
        }
    ]
    assert captured[0].source_url.startswith(
        "https://provider.example/enhanced.mp4"
    )
    assert captured[0].provider_task_id == "enhancement-task-safe"
    assert captured[0].provider_request_id == "poll-request-safe"
    assert captured[0].input_asset_id == "source-video"
    assert captured[0].naming_context is not None
    assert captured[0].naming_context.pipeline_name == "Gateway test"
    assert captured[0].naming_context.node_id == task.node_id
    assert execution.result.assets[0].asset_id == "enhancement-output"
    assert execution.result.assets[0].metadata == {
        "resolution": "1920x1080",
        "fps": 60,
        "duration_seconds": 12.5,
        "tool_version": "standard",
        "bit_depth": 8,
    }
    assert [
        (item.direction.value, item.slot, item.ordinal, item.asset_id)
        for item in repository.list_aigc_task_assets(task.task_id)
    ] == [
        ("input", "video", 0, "source-video"),
        ("output", "video", 0, "enhancement-output"),
    ]


@pytest.mark.parametrize(
    ("width", "height", "duration", "params", "message"),
    [
        (359, 640, 12, {}, "short edge"),
        (1440, 2561, 12, {}, "long edge"),
        (
            1920,
            1080,
            40.01,
            {
                "tool_version": "professional",
                "scene": None,
                "bit_depth": 16,
                "bitrate_mode": None,
                "bitrate_level": None,
                "bitrate": None,
            },
            "40 seconds",
        ),
    ],
)
def test_gateway_rejects_invalid_video_enhancement_media_before_provider(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    width: int,
    height: int,
    duration: float,
    params: dict[str, object],
    message: str,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": width,
            "height": height,
            "duration_seconds": duration,
            "fps": 30,
            "video_codec": "h264",
        },
    )
    client = FakeVideoEnhancementClient()
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        video_enhancement_client_factory=lambda: client,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_ENHANCEMENT,
        video_enhancement_params(**params),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_media_input"
    assert error.value.error.stage == "input_resolution"
    assert message in error.value.error.message
    assert client.submit_calls == []
    assert repository.list_aigc_task_assets(task.task_id) == []


def test_gateway_maps_mediakit_timeout_without_leaking_provider_detail(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1280,
            "height": 720,
            "duration_seconds": 12,
            "fps": 30,
            "video_codec": "h264",
        },
    )

    class TimeoutClient(FakeVideoEnhancementClient):
        async def poll(self, **kwargs) -> VideoEnhancementTask:
            self.poll_calls.append(kwargs)
            raise MediaKitVideoEnhancementError(
                "MediaKit video enhancement polling timed out.",
                code="poll_timeout",
                phase="poll",
                request_id="request-safe",
                task_id="task-safe",
            )

    client = TimeoutClient()
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        video_enhancement_client_factory=lambda: client,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_ENHANCEMENT,
        video_enhancement_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "timeout"
    assert error.value.error.stage == "poll"
    assert error.value.error.request_id == "request-safe"
    assert error.value.retryable is True
    assert "signature" not in error.value.error.message


def test_gateway_marks_video_enhancement_transfer_failure_retryable(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1280,
            "height": 720,
            "duration_seconds": 12,
            "fps": 30,
            "video_codec": "h264",
        },
    )

    async def fail_transfer(*_args, **_kwargs):
        raise RuntimeError("temporary storage failure")

    monkeypatch.setattr(
        test_asset_storage,
        "store_aigc_video_enhancement",
        fail_transfer,
    )
    client = FakeVideoEnhancementClient()
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        video_enhancement_client_factory=lambda: client,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_ENHANCEMENT,
        video_enhancement_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_transfer_failed"
    assert error.value.error.stage == "asset_transfer"
    assert error.value.error.request_id == "poll-request-safe"
    assert error.value.retryable is True


def test_gateway_executes_video_face_blur_with_stable_token_and_trace(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 3840,
            "height": 2160,
            "duration_seconds": 600,
            "fps": 25,
            "video_codec": "h264",
        },
    )
    client = FakeFaceBlurVideoClient()
    captured: list[AigcVideoFaceBlurAssetInput] = []

    async def store_face_blur(repo, data):
        captured.append(data)
        output = repo.create_asset(
            AssetCreate(
                id="face-blur-output",
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.STORYBOARD_VIDEO,
                asset_role=AssetRole.PUBLIC,
                status=Status.SUCCEEDED,
                object_key="aigc/face-blur-output.mp4",
                mime_type="video/mp4",
                metadata={
                    "provider": "mediakit",
                    "operation": "face_blur_video",
                    "provider_task_id": data.provider_task_id,
                    "provider_request_id": data.provider_request_id,
                    "duration_seconds": data.duration_seconds,
                    "mask_mode": data.mask_mode,
                    "mask_strength": data.mask_strength,
                },
            )
        )
        repo.add_aigc_task_assets(
            [
                AigcPipelineTaskAssetReference(
                    task_id=data.task_id,
                    direction=AigcAssetDirection.OUTPUT,
                    slot="video",
                    ordinal=0,
                    asset_id=output.id,
                )
            ]
        )
        return output

    monkeypatch.setattr(
        test_asset_storage,
        "store_aigc_video_face_blur",
        store_face_blur,
    )
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        face_blur_client_factory=lambda: client,
        face_blur_poll_interval_seconds=0.001,
        face_blur_timeout_seconds=1,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_FACE_BLUR,
        video_face_blur_params(),
    )

    execution = asyncio.run(gateway.execute(task))

    assert execution.executor_version == AIGC_VIDEO_FACE_BLUR_EXECUTOR_VERSION
    assert len(client.submit_calls) == 1
    assert str(client.submit_calls[0]["video_url"]).startswith("https://")
    assert client.submit_calls[0]["mask_mode"] == "mosaic"
    assert client.submit_calls[0]["mask_strength"] == "medium"
    token = str(client.submit_calls[0]["client_token"])
    assert token.startswith("aigc-face-blur-")
    assert len(token) <= 64
    identity = (
        f"{task.pipeline_id}:{task.run_id}:{task.node_id}:attempt:{task.attempt}"
    )
    assert token == (
        f"aigc-face-blur-{hashlib.sha256(identity.encode()).hexdigest()[:40]}"
    )
    assert client.get_calls == ["face-blur-task-safe", "face-blur-task-safe"]
    assert captured[0].provider_task_id == "face-blur-task-safe"
    assert captured[0].provider_request_id == "poll-request-safe"
    assert captured[0].input_asset_id == "source-video"
    assert captured[0].naming_context is not None
    assert captured[0].naming_context.pipeline_name == "Gateway test"
    assert captured[0].naming_context.node_id == task.node_id
    assert execution.result.assets[0].asset_id == "face-blur-output"
    assert execution.result.assets[0].metadata == {
        "provider_task_id": "face-blur-task-safe",
        "provider_request_id": "poll-request-safe",
        "duration_seconds": 12.5,
        "mask_mode": "mosaic",
        "mask_strength": "medium",
    }
    assert [
        (item.direction.value, item.slot, item.ordinal, item.asset_id)
        for item in repository.list_aigc_task_assets(task.task_id)
    ] == [
        ("input", "video", 0, "source-video"),
        ("output", "video", 0, "face-blur-output"),
    ]
    assert repository.get_aigc_task_attempt(task.task_id).progress == 50


def test_gateway_cleans_references_after_face_blur_transfer_failure(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1920,
            "height": 1080,
            "duration_seconds": 12,
            "fps": 30,
            "video_codec": "h264",
        },
    )

    async def fail_transfer(*_args, **_kwargs):
        raise RuntimeError("temporary storage failure")

    monkeypatch.setattr(
        test_asset_storage,
        "store_aigc_video_face_blur",
        fail_transfer,
    )
    client = FakeFaceBlurVideoClient(
        states=[
            FaceBlurVideoTask(
                task_id="face-blur-task-safe",
                status=FaceBlurTaskStatus.SUCCEEDED,
                request_id="request-safe",
                output_video_url="https://provider.example/face-blur.mp4",
            )
        ]
    )
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        face_blur_client_factory=lambda: client,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_FACE_BLUR,
        video_face_blur_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "asset_transfer_failed"
    assert error.value.error.stage == "asset_transfer"
    assert error.value.error.request_id == "request-safe"
    assert error.value.retryable is True
    assert repository.list_aigc_task_assets(task.task_id) == []


@pytest.mark.parametrize(
    ("width", "height", "duration", "fps", "message"),
    [
        (4097, 2160, 600, 25, "long edge"),
        (4096, 2161, 600, 60, "short edge"),
        (1920, 1080, 600.01, 30, "600 seconds"),
        (1920, 1080, 600, 24.99, "between 25 and 60"),
        (1920, 1080, 600, 60.01, "between 25 and 60"),
    ],
)
def test_gateway_rejects_invalid_video_face_blur_media_before_provider(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    width: int,
    height: int,
    duration: float,
    fps: float,
    message: str,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": width,
            "height": height,
            "duration_seconds": duration,
            "fps": fps,
            "video_codec": "h264",
        },
    )
    client = FakeFaceBlurVideoClient()
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        face_blur_client_factory=lambda: client,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_FACE_BLUR,
        video_face_blur_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_media_input"
    assert error.value.error.stage == "input_resolution"
    assert message in error.value.error.message
    assert client.submit_calls == []
    assert repository.list_aigc_task_assets(task.task_id) == []


@pytest.mark.parametrize("invalid_input", ["status", "mime", "access"])
def test_gateway_rejects_unavailable_video_face_blur_asset(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
    monkeypatch: pytest.MonkeyPatch,
    invalid_input: str,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        status=(
            Status.FAILED
            if invalid_input == "status"
            else Status.SUCCEEDED
        ),
        mime_type=(
            "image/png"
            if invalid_input == "mime"
            else "video/mp4"
        ),
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1920,
            "height": 1080,
            "duration_seconds": 12,
            "fps": 30,
            "video_codec": "h264",
        },
    )
    if invalid_input == "access":
        monkeypatch.setattr(
            test_asset_storage,
            "signed_access_url",
            lambda _asset: None,
        )
    client = FakeFaceBlurVideoClient()
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        face_blur_client_factory=lambda: client,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_FACE_BLUR,
        video_face_blur_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "invalid_input"
    assert error.value.error.stage == "input_resolution"
    assert client.submit_calls == []


def test_gateway_maps_face_blur_provider_error_without_leaking_detail(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1920,
            "height": 1080,
            "duration_seconds": 12,
            "fps": 30,
            "video_codec": "h264",
        },
    )
    client = FakeFaceBlurVideoClient(
        error=MediaKitFaceBlurError(
            "MediaKit face blur task failed.",
            detail=(
                "phase=query; status=failed; code=InternalError; "
                "request_id=request-safe; task_id=task-safe; "
                "signature=must-not-leak"
            ),
        )
    )
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        face_blur_client_factory=lambda: client,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_FACE_BLUR,
        video_face_blur_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "provider_error"
    assert error.value.error.stage == "query"
    assert error.value.error.request_id == "request-safe"
    assert error.value.error.message == "MediaKit face blur task failed."
    assert error.value.retryable is True


def test_gateway_times_out_face_blur_polling(
    repository: InMemoryRepository,
    test_asset_storage: AssetStorageService,
) -> None:
    create_media_asset(
        repository,
        "source-video",
        AssetType.UPLOADED_VIDEO,
        metadata={
            "inspection_version": 1,
            "container": "mp4",
            "width": 1920,
            "height": 1080,
            "duration_seconds": 12,
            "fps": 30,
            "video_codec": "h264",
        },
    )

    class RunningClient(FakeFaceBlurVideoClient):
        async def get_task(self, *, task_id: str) -> FaceBlurVideoTask:
            self.get_calls.append(task_id)
            return FaceBlurVideoTask(
                task_id=task_id,
                status=FaceBlurTaskStatus.RUNNING,
                request_id="request-safe",
            )

    client = RunningClient()
    gateway = AigcModelGateway(  # type: ignore[arg-type]
        repository,
        FakeAigcGeneration(),
        test_asset_storage,
        media_inspector=object(),
        face_blur_client_factory=lambda: client,
        face_blur_poll_interval_seconds=0.001,
        face_blur_timeout_seconds=0.005,
    )
    task = create_persisted_task(
        repository,
        AigcTaskType.VIDEO_FACE_BLUR,
        video_face_blur_params(),
    )

    with pytest.raises(AigcGatewayError) as error:
        asyncio.run(gateway.execute(task))

    assert error.value.error.code == "timeout"
    assert error.value.error.stage == "poll"
    assert error.value.retryable is True
