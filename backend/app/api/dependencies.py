from __future__ import annotations

from collections.abc import Callable
from functools import lru_cache
from weakref import WeakKeyDictionary

from fastapi import Depends

from backend.app.core.config import Settings, get_settings
from backend.app.db import init_database
from backend.app.repositories import MySQLRepository, Repository
from backend.app.services.generation import (
    ModelArkGenerationService,
    get_generation_service,
)
from backend.app.services.assets import AssetStorageService, get_asset_storage_service
from backend.app.services.media_inspector import MediaInspector, get_media_inspector
from backend.app.services.aigc_pipeline import AigcPipelineService
from backend.app.services.aigc_executor import AigcPipelineRuntime
from backend.app.services.aigc_gateway import AigcModelGateway
from backend.app.services.background import BackgroundTaskRunner
from backend.app.services.composer import VideoComposer, get_video_composer
from backend.app.services.mediakit import (
    AsrSubtitleClient,
    get_asr_subtitle_client as create_asr_subtitle_client,
)
from backend.app.services.mediakit_face_blur import FaceBlurVideoClient
from backend.app.services.video_normalizer import VideoNormalizer, get_video_normalizer
from backend.app.services.workflow import WorkflowService


_aigc_runtimes: WeakKeyDictionary[object, AigcPipelineRuntime] = WeakKeyDictionary()


@lru_cache
def get_repository() -> Repository:
    init_database()
    return MySQLRepository()


def get_workflow_service(
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> WorkflowService:
    return WorkflowService(repository, asset_storage)


def get_aigc_pipeline_service(
    repository: Repository = Depends(get_repository),
) -> AigcPipelineService:
    return AigcPipelineService(repository)


def get_modelark_generation_service() -> ModelArkGenerationService:
    return get_generation_service()


def get_media_inspector_service() -> MediaInspector:
    return get_media_inspector()


def get_aigc_pipeline_runtime(
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
    media_inspector: MediaInspector = Depends(get_media_inspector_service),
    settings: Settings = Depends(get_settings),
) -> AigcPipelineRuntime:
    runtime = _aigc_runtimes.get(repository)
    if runtime is None:
        runtime = AigcPipelineRuntime(
            repository,
            AigcModelGateway(
                repository,
                generation,
                asset_storage,
                media_inspector=media_inspector,
                video_timeout_seconds=settings.aigc_video_timeout_seconds,
            ),
            video_concurrency=settings.aigc_video_concurrency,
        )
        _aigc_runtimes[repository] = runtime
    return runtime


def discard_aigc_pipeline_runtime(repository: Repository) -> None:
    _aigc_runtimes.pop(repository, None)


def get_composer_service() -> VideoComposer:
    return get_video_composer()


def get_video_normalizer_service() -> VideoNormalizer:
    return get_video_normalizer()


def get_asr_subtitle_client() -> AsrSubtitleClient:
    return create_asr_subtitle_client()


def get_face_blur_video_client_factory() -> Callable[[], FaceBlurVideoClient]:
    return FaceBlurVideoClient


def get_background_task_runner() -> BackgroundTaskRunner:
    return BackgroundTaskRunner()
