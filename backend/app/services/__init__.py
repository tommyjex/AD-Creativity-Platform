from .assets import (
    AssetStorageService,
    DownloadedAsset,
    HttpRemoteAssetDownloader,
    ObjectStorageClient,
    RemoteAssetDownloader,
    StoredAssetInput,
    TosObjectStorageClient,
    get_asset_storage_service,
)
from .composer import (
    CompositionResult,
    CompositionSource,
    FfmpegVideoComposer,
    VideoComposer,
    VideoCompositionError,
    get_video_composer,
)
from .generation import (
    AssetBatchGenerationResult,
    ModelArkGenerationService,
    StoryboardGenerationResult,
    get_generation_service,
)
from .modelark import (
    BytePlusModelArkAdapter,
    GeneratedAssetResult,
    GeneratedTextResult,
    HybridModelArkAdapter,
    ImageGenerationRequest,
    MockModelArkAdapter,
    ModelArkAdapter,
    TextGenerationRequest,
    ToolVideoGenerationRequest,
    VideoGenerationRequest,
)
from .video_normalizer import (
    NormalizedVideo,
    VideoNormalizationError,
    VideoNormalizer,
    get_video_normalizer,
)

__all__ = [
    "AssetStorageService",
    "AssetBatchGenerationResult",
    "BytePlusModelArkAdapter",
    "CompositionResult",
    "CompositionSource",
    "DownloadedAsset",
    "FfmpegVideoComposer",
    "GeneratedAssetResult",
    "GeneratedTextResult",
    "ImageGenerationRequest",
    "HybridModelArkAdapter",
    "HttpRemoteAssetDownloader",
    "MockModelArkAdapter",
    "ModelArkAdapter",
    "ModelArkGenerationService",
    "ObjectStorageClient",
    "RemoteAssetDownloader",
    "StoryboardGenerationResult",
    "StoredAssetInput",
    "TextGenerationRequest",
    "TosObjectStorageClient",
    "ToolVideoGenerationRequest",
    "VideoComposer",
    "NormalizedVideo",
    "VideoNormalizationError",
    "VideoNormalizer",
    "VideoCompositionError",
    "VideoGenerationRequest",
    "WorkflowError",
    "WorkflowService",
    "get_asset_storage_service",
    "get_generation_service",
    "get_video_normalizer",
    "get_video_composer",
]


def __getattr__(name: str):
    if name in {"WorkflowError", "WorkflowService"}:
        from .workflow import WorkflowError, WorkflowService

        return {
            "WorkflowError": WorkflowError,
            "WorkflowService": WorkflowService,
        }[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
