from __future__ import annotations

from functools import lru_cache

from fastapi import Depends

from backend.app.db import init_database
from backend.app.repositories import MySQLRepository, Repository
from backend.app.services.generation import (
    ModelArkGenerationService,
    get_generation_service,
)
from backend.app.services.assets import AssetStorageService, get_asset_storage_service
from backend.app.services.background import BackgroundTaskRunner
from backend.app.services.composer import VideoComposer, get_video_composer
from backend.app.services.mediakit import (
    AsrSubtitleClient,
    get_asr_subtitle_client as create_asr_subtitle_client,
)
from backend.app.services.workflow import WorkflowService


@lru_cache
def get_repository() -> Repository:
    init_database()
    return MySQLRepository()


def get_workflow_service(
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> WorkflowService:
    return WorkflowService(repository, asset_storage)


def get_modelark_generation_service() -> ModelArkGenerationService:
    return get_generation_service()


def get_composer_service() -> VideoComposer:
    return get_video_composer()


def get_asr_subtitle_client() -> AsrSubtitleClient:
    return create_asr_subtitle_client()


def get_background_task_runner() -> BackgroundTaskRunner:
    return BackgroundTaskRunner()
