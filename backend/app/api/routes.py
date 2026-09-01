from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import mimetypes
import os
import re
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit
from uuid import uuid4

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import ValidationError

from backend.app.core.config import ConfigurationError
from backend.app.api.dependencies import (
    get_background_task_runner,
    get_asr_subtitle_client,
    get_asset_storage_service,
    get_composer_service,
    get_face_blur_video_client_factory,
    get_modelark_generation_service,
    get_repository,
    get_video_normalizer_service,
    get_workflow_service,
)
from backend.app.repositories import (
    AssetReferenceConflictError,
    NotFoundError,
    Repository,
    RevisionConflictError,
)
from backend.app.schemas import (
    Asset,
    AssetCategory,
    AssetRole,
    AssetType,
    CharacterAssetIterationOperation,
    CharacterAssetIterationRequest,
    CharacterAssetIterationResponse,
    CharacterCard,
    CharacterCardImageGenerationResponse,
    CharacterCardUpdate,
    CanvasLayout,
    CanvasLayoutUpdate,
    ErrorCode,
    FaceBlurVideoRequest,
    GenerationTask,
    GenerationTaskCreate,
    FrozenImageGenerationInput,
    FrozenImageReference,
    FrozenImageReferenceRegion,
    FrozenImageLayerCompositionInput,
    FrozenImageLayerContentEditInput,
    FrozenImageLayerDecompositionInput,
    ImageGenerationOperation,
    ImageReferenceSelectionUpdate,
    ImagePromptSuggestion,
    ImagePromptSuggestionRequest,
    ImageLayerDecompositionRequest,
    ImageLayerCompositionRequest,
    ImageLayerContentEditRequest,
    ImageLayerSet,
    ImageLayerSetDetail,
    ImageLayerSetUpdate,
    ImageToImageGenerationRequest,
    ImagePromptVersion,
    ImagePromptVersionCreate,
    ImagePromptVersionSave,
    Project,
    ProjectCreate,
    ProjectListResponse,
    ProjectUpdate,
    ProjectType,
    SetCurrentImageRequest,
    Stage,
    Status,
    StoryboardShot,
    StoryboardShotCreate,
    StoryboardShotFirstFrameRequest,
    StoryboardShotGenerateVideoRequest,
    StoryboardShotMergeRequest,
    StoryboardShotReferenceRequest,
    StoryboardShotReferenceUploadResponse,
    StoryboardTailFrameReferenceApplyResponse,
    StoryboardTailFrameReferenceSkip,
    StoryboardShotVideoConfig,
    StoryboardShotVideoConfigUpdate,
    StoryboardShotVideoEditRequest,
    StoryboardShotVideoPromptOptimizeRequest,
    StoryboardShotVideoSelectionRequest,
    TextArtifactCreate,
    TextArtifactUpdate,
    TextToImageGenerationRequest,
    TextGenerationInputRequest,
    ReferenceAssetKind,
    ToolAssetRole,
    ToolTask,
    ToolTaskCreate,
    ToolTaskError,
    ToolTaskInputAsset,
    ToolTaskType,
    ToolVideoGenerationRequest,
    ToolVideoPromptOptimizeRequest,
    ToolVideoPromptOptimizeResponse,
    validate_visible_selling_copy,
)
from backend.app.services.assets import AssetStorageService, StoredAssetInput
from backend.app.services.background import BackgroundTaskRunner
from backend.app.services.composer import (
    CompositionSource,
    VideoComposer,
    VideoCompositionError,
)
from backend.app.services.generation import (
    GenerationStreamEvent,
    ModelArkGenerationService,
    StoryboardGenerationResult,
)
from backend.app.services.modelark import (
    ModelArkProviderError,
    ModelArkTextParseError,
    SEEDREAM_5_PRO_MODEL,
    ToolVideoGenerationRequest as ModelArkToolVideoGenerationRequest,
)
from backend.app.services.mediakit_face_blur import (
    FaceBlurTaskStatus,
    FaceBlurVideoClient,
    MediaKitFaceBlurError,
)
from backend.app.services.video_normalizer import VideoNormalizationError, VideoNormalizer
from backend.app.schemas.common import utc_now
from backend.app.services.image_layers import (
    ImageLayerCompositionService,
    inspect_layer_image_content,
    persist_layer_composition,
    persist_layer_decomposition,
    read_layer_set_contents,
)
from backend.app.services.mediakit import AsrSubtitleClient, MediaKitAsrError
from backend.app.services.subtitles import segments_to_srt
from backend.app.services.text_streaming import SSE_HEADERS, encode_sse
from backend.app.services.workflow import WorkflowError, WorkflowService
from backend.app.video_prompt import (
    is_known_structured_video_prompt,
    is_legacy_structured_video_prompt,
    is_structured_video_prompt,
    normalize_video_prompt,
    validate_merged_prompt_timeline,
)

router = APIRouter()
logger = logging.getLogger(__name__)

IMAGE_BRIEF_CONTENT_FIELDS = {
    "product_name",
    "selling_points",
    "audience",
    "prompt",
    "target_platform",
    "aspect_ratio",
    "style",
    "target_language",
    "image_purpose",
}
ImageProjectGenerationRequest = (
    TextToImageGenerationRequest | ImageToImageGenerationRequest
)


def _image_brief_content_changed(
    project: Project,
    payload: ProjectUpdate,
) -> bool:
    if payload.brief is None:
        return False
    return any(
        field in payload.brief.model_fields_set
        and getattr(payload.brief, field) != getattr(project.brief, field)
        for field in IMAGE_BRIEF_CONTENT_FIELDS
    )


def _require_image_project(project: Project) -> None:
    if project.project_type != ProjectType.IMAGE_ASSET:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            "image prompt versions are only available for image projects",
        )


@router.post(
    "/projects",
    response_model=Project,
    status_code=status.HTTP_201_CREATED,
    tags=["projects"],
)
def create_project(
    payload: ProjectCreate,
    repository: Repository = Depends(get_repository),
) -> Project:
    return repository.create_project(payload)


@router.get("/projects", response_model=ProjectListResponse, tags=["projects"])
def list_projects(
    q: str | None = None,
    repository: Repository = Depends(get_repository),
) -> ProjectListResponse:
    return ProjectListResponse(root=repository.list_project_summaries(q))


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["projects"],
)
def delete_project(
    project_id: str,
    repository: Repository = Depends(get_repository),
) -> None:
    try:
        repository.delete_project(project_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.get("/projects/{project_id}", response_model=Project, tags=["projects"])
def get_project(
    project_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        return asset_storage.with_project_access_urls(
            repository.get_project(project_id)
        )
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.patch("/projects/{project_id}", response_model=Project, tags=["projects"])
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        existing = repository.get_project(project_id)
        language_changed = (
            payload.brief is not None
            and "target_language" in payload.brief.model_fields_set
            and payload.brief.target_language != existing.brief.target_language
        )
        image_brief_changed = (
            existing.project_type == ProjectType.IMAGE_ASSET
            and _image_brief_content_changed(existing, payload)
        )
        repository.update_project_details(project_id, payload)
        if language_changed and existing.project_type == ProjectType.VIDEO_AD:
            workflow.mark_language_dependents_stale(project_id)
        if image_brief_changed:
            repository.mark_image_prompt_stale(project_id)
        return asset_storage.with_project_access_urls(
            repository.get_project(project_id)
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except ValidationError as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            ErrorCode.VALIDATION_ERROR,
            str(exc),
        ) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.get(
    "/projects/{project_id}/image-prompt-versions",
    response_model=list[ImagePromptVersion],
    tags=["image-prompts"],
)
def list_image_prompt_versions(
    project_id: str,
    repository: Repository = Depends(get_repository),
) -> list[ImagePromptVersion]:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        return repository.list_image_prompt_versions(project_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.get(
    "/projects/{project_id}/image-prompt-versions/{version_id}",
    response_model=ImagePromptVersion,
    tags=["image-prompts"],
)
def get_image_prompt_version(
    project_id: str,
    version_id: str,
    repository: Repository = Depends(get_repository),
) -> ImagePromptVersion:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        return repository.get_image_prompt_version(project_id, version_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image prompt version not found",
        ) from exc


@router.post(
    "/projects/{project_id}/image-prompt-versions",
    response_model=ImagePromptVersion,
    status_code=status.HTTP_201_CREATED,
    tags=["image-prompts"],
)
def save_image_prompt_version(
    project_id: str,
    payload: ImagePromptVersionSave,
    repository: Repository = Depends(get_repository),
) -> ImagePromptVersion:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        assert project.brief.image_purpose is not None
        return repository.save_image_prompt_version(
            ImagePromptVersionCreate(
                project_id=project.id,
                prompt=payload.prompt,
                aspect_ratio=project.brief.aspect_ratio,
                target_language=project.brief.target_language,
                image_purpose=project.brief.image_purpose,
            )
        )
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/image-prompts/generate",
    response_model=ImagePromptSuggestion,
    tags=["image-prompts"],
)
async def generate_image_prompt_suggestion(
    project_id: str,
    payload: ImagePromptSuggestionRequest,
    repository: Repository = Depends(get_repository),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> ImagePromptSuggestion:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        return await generation.generate_image_prompt(
            project_id,
            project.brief,
            current_prompt=payload.current_prompt,
        )
    except HTTPException:
        raise
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc
    except ModelArkProviderError as exc:
        logger.warning(
            "image prompt generation provider failure",
            extra=exc.safe_log_fields(),
        )
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "image prompt generation failed",
            exc.safe_detail(),
        ) from exc


@router.post(
    "/projects/{project_id}/image-references/upload",
    response_model=Asset,
    status_code=status.HTTP_201_CREATED,
    tags=["image-generation"],
)
async def upload_image_project_reference(
    project_id: str,
    filename: str | None = Query(default=None),
    mime_type: str | None = Query(default=None),
    content: bytes = Body(..., media_type="application/octet-stream"),
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Asset:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        normalized_mime_type = _validate_uploaded_image_reference(
            filename=filename,
            mime_type=mime_type,
            content=content,
        )
        asset = asset_storage.upload_asset(
            repository,
            StoredAssetInput(
                project_id=project_id,
                type=AssetType.UPLOADED_IMAGE,
                category=AssetCategory.REFERENCE,
                asset_role=AssetRole.PUBLIC,
                stage=Stage.IMAGE,
                status=Status.SUCCEEDED,
                mime_type=normalized_mime_type,
                size_bytes=len(content),
                filename=filename,
                metadata={
                    "reference_kind": "image",
                    "usage": "image_generation_reference",
                    "name": filename,
                },
            ),
            content=content,
        )
        return asset_storage.with_access_url(asset)
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "reference asset upload failed",
        ) from exc


@router.put(
    "/projects/{project_id}/image-reference-selection",
    response_model=Project,
    tags=["image-generation"],
)
def set_image_project_reference_selection(
    project_id: str,
    payload: ImageReferenceSelectionUpdate,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        for asset_id in payload.asset_ids:
            asset = repository.get_asset(asset_id)
            _validate_image_generation_reference(asset, project_id=project_id)
            if asset.type != AssetType.UPLOADED_IMAGE:
                raise _http_error(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    ErrorCode.VALIDATION_ERROR,
                    "project reference selection only accepts uploaded images",
                )
        updated = repository.set_image_reference_asset_ids(
            project_id,
            payload.asset_ids,
        )
        return asset_storage.with_project_access_urls(updated)
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project or reference asset not found: {project_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/image-generations",
    response_model=GenerationTask,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["image-generation"],
)
async def submit_image_generation(
    project_id: str,
    payload: ImageProjectGenerationRequest,
    repository: Repository = Depends(get_repository),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
    workflow: WorkflowService = Depends(get_workflow_service),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
) -> GenerationTask:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        version_id = (
            payload.prompt_version_id
            or project.current_image_prompt_version_id
        )
        if not version_id:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.DEPENDENCY_MISSING,
                "image generation requires a saved prompt version",
            )
        prompt_version = repository.get_image_prompt_version(
            project_id,
            version_id,
        )
        try:
            validate_visible_selling_copy(prompt_version.prompt)
        except ValueError as exc:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.INVALID_STATE,
                (
                    "当前提示词版本中的画面卖点文案格式无效；"
                    "允许不设置文字，如有文字请使用英文双引号包裹且最多 4 条。"
                ),
            ) from exc
        source_asset: Asset | None = None
        reference_assets: list[Asset] = []
        reference_regions: list[FrozenImageReferenceRegion] = []
        prompt = prompt_version.prompt
        annotation = None
        if isinstance(payload, ImageToImageGenerationRequest):
            source_asset = repository.get_asset(payload.source_asset_id)
            if (
                source_asset.project_id != project_id
                or source_asset.asset_role != AssetRole.PUBLIC
                or source_asset.type
                not in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
                or source_asset.status not in {Status.SUCCEEDED, Status.STALE}
            ):
                raise _http_error(
                    status.HTTP_409_CONFLICT,
                    ErrorCode.INVALID_STATE,
                    "source image asset is not editable",
                )
            prompt = payload.prompt
            annotation = payload.annotation
            if payload.edit_mode == "reference_replace":
                assert payload.target_bbox is not None
                for region in payload.reference_regions:
                    if region.asset_id == source_asset.id:
                        raise _http_error(
                            status.HTTP_422_UNPROCESSABLE_CONTENT,
                            ErrorCode.VALIDATION_ERROR,
                            "reference region must not use the target image",
                        )
                    reference_asset = repository.get_asset(region.asset_id)
                    _validate_image_generation_reference(
                        reference_asset,
                        project_id=project_id,
                    )
                    reference_assets.append(reference_asset)
                    reference_regions.append(
                        FrozenImageReferenceRegion(
                            asset_id=reference_asset.id,
                            object_key=reference_asset.object_key or "",
                            created_at=reference_asset.created_at.isoformat(),
                            image_index=region.image_index,
                            bbox=region.bbox,
                        )
                    )
        else:
            for asset_id in payload.reference_asset_ids:
                reference_asset = repository.get_asset(asset_id)
                _validate_image_generation_reference(
                    reference_asset,
                    project_id=project_id,
                )
                reference_assets.append(reference_asset)

        prompt_with_annotation = generation.build_image_edit_prompt(
            prompt,
            annotation=annotation,
            target_bbox=(
                payload.target_bbox
                if isinstance(payload, ImageToImageGenerationRequest)
                else None
            ),
            reference_regions=reference_regions,
            target_language=prompt_version.target_language,
        )
        final_prompt = generation.normalize_project_image_prompt(
            prompt_with_annotation,
            aspect_ratio=prompt_version.aspect_ratio,
            image_purpose=prompt_version.image_purpose,
        )

        frozen = FrozenImageGenerationInput(
            operation=payload.operation,
            project_id=project_id,
            source_asset_id=source_asset.id if source_asset else None,
            source_object_key=source_asset.object_key if source_asset else None,
            source_asset_created_at=(
                source_asset.created_at.isoformat() if source_asset else None
            ),
            reference_asset_id=reference_assets[0].id if reference_assets else None,
            reference_object_key=(
                reference_assets[0].object_key if reference_assets else None
            ),
            reference_asset_created_at=(
                reference_assets[0].created_at.isoformat()
                if reference_assets
                else None
            ),
            reference_assets=[
                {
                    "asset_id": asset.id,
                    "object_key": asset.object_key,
                    "created_at": asset.created_at.isoformat(),
                }
                for asset in reference_assets
            ],
            edit_mode=(
                payload.edit_mode
                if isinstance(payload, ImageToImageGenerationRequest)
                else "single_region"
            ),
            target_bbox=(
                payload.target_bbox
                if isinstance(payload, ImageToImageGenerationRequest)
                else None
            ),
            reference_regions=reference_regions,
            prompt_version_id=prompt_version.id,
            prompt_version=prompt_version.version,
            prompt=prompt,
            base_prompt=prompt_version.prompt,
            normalized_prompt=final_prompt,
            final_prompt=final_prompt,
            annotation=annotation,
            aspect_ratio=prompt_version.aspect_ratio,
            target_language=prompt_version.target_language,
            image_purpose=prompt_version.image_purpose,
            size=payload.size,
            format=payload.format,
            model=generation.settings.ark_image_model,
        )
        input_hash = _image_generation_input_hash(frozen)
        task, created = repository.create_task_if_no_active_hash(
            GenerationTaskCreate(
                project_id=project_id,
                stage=Stage.IMAGE,
                input_hash=input_hash,
                frozen_input=frozen.model_dump(mode="json"),
            )
        )
        if not created:
            return task
        background_runner.schedule(
            _run_image_generation_task(
                task_id=task.id,
                frozen=frozen,
                repository=repository,
                workflow=workflow,
                generation=generation,
            )
        )
        return task
    except HTTPException:
        raise
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image project, prompt version, source asset, or reference asset not found",
        ) from exc


@router.patch(
    "/projects/{project_id}/current-image",
    response_model=Project,
    tags=["image-generation"],
)
def set_current_image(
    project_id: str,
    payload: SetCurrentImageRequest,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        updated = repository.set_current_image_asset(
            project_id,
            payload.asset_id,
            expected_revision=payload.expected_image_revision,
        )
        return asset_storage.with_project_access_urls(updated)
    except RevisionConflictError as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.TASK_CONFLICT,
            "image revision conflict",
        ) from exc
    except ValueError as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            "only a succeeded public image can be current",
        ) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "project or image asset not found",
        ) from exc


@router.post(
    "/projects/{project_id}/image-layer-sets",
    response_model=GenerationTask,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["image-layers"],
)
async def submit_image_layer_decomposition(
    project_id: str,
    payload: ImageLayerDecompositionRequest,
    repository: Repository = Depends(get_repository),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
    workflow: WorkflowService = Depends(get_workflow_service),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
) -> GenerationTask:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        source = repository.get_asset(payload.source_asset_id)
        if (
            source.project_id != project_id
            or source.asset_role != AssetRole.PUBLIC
            or source.type not in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
            or source.status != Status.SUCCEEDED
            or not source.object_key
        ):
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.INVALID_STATE,
                "layer decomposition requires a succeeded public image",
            )
        final_prompt = generation.build_layer_decomposition_prompt(
            payload.prompt,
            bbox=payload.bbox,
        )
        frozen = FrozenImageLayerDecompositionInput(
            project_id=project_id,
            source_asset_id=source.id,
            source_object_key=source.object_key,
            source_asset_created_at=source.created_at.isoformat(),
            prompt=payload.prompt,
            bbox=payload.bbox,
            final_prompt=final_prompt,
            size=payload.size,
            format=payload.format,
            model=SEEDREAM_5_PRO_MODEL,
        )
        input_hash = _frozen_input_hash(frozen.model_dump(mode="json"))
        task, created = repository.create_task_if_no_active_hash(
            GenerationTaskCreate(
                project_id=project_id,
                stage=Stage.IMAGE,
                input_hash=input_hash,
                frozen_input=frozen.model_dump(mode="json"),
            )
        )
        if not created:
            return task
        background_runner.schedule(
            _run_image_layer_decomposition_task(
                task_id=task.id,
                frozen=frozen,
                repository=repository,
                workflow=workflow,
                generation=generation,
            )
        )
        return task
    except HTTPException:
        raise
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image project or source asset not found",
        ) from exc


@router.post(
    "/projects/{project_id}/image-layer-sets/{set_id}/content-edits",
    response_model=GenerationTask,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["image-layers"],
)
async def submit_image_layer_content_edit(
    project_id: str,
    set_id: str,
    payload: ImageLayerContentEditRequest,
    repository: Repository = Depends(get_repository),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
    workflow: WorkflowService = Depends(get_workflow_service),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
) -> GenerationTask:
    try:
        _require_image_project(repository.get_project(project_id))
        layer_set = repository.get_image_layer_set(project_id, set_id)
        layer = next((item for item in layer_set.layers if item.id == payload.layer_id), None)
        if layer is None or layer_set.revision != payload.expected_revision:
            raise _http_error(status.HTTP_409_CONFLICT, ErrorCode.TASK_CONFLICT, "image layer set revision conflict")
        source = repository.get_asset(layer.asset_id)
        if source.asset_role != AssetRole.INTERNAL_LAYER or not source.object_key:
            raise _http_error(status.HTTP_409_CONFLICT, ErrorCode.INVALID_STATE, "image layer is not editable")
        frozen = FrozenImageLayerContentEditInput(
            project_id=project_id, layer_set_id=set_id, layer_id=layer.id,
            expected_revision=layer_set.revision, source_asset_id=source.id,
            source_object_key=source.object_key, source_asset_created_at=source.created_at.isoformat(),
            prompt=payload.prompt, size=payload.size, format=payload.format,
            model=SEEDREAM_5_PRO_MODEL,
        )
        task, created = repository.create_task_if_no_active_hash(
            GenerationTaskCreate(project_id=project_id, stage=Stage.IMAGE,
                input_hash=_frozen_input_hash(frozen.model_dump(mode="json")),
                frozen_input=frozen.model_dump(mode="json"))
        )
        if created:
            background_runner.schedule(_run_image_layer_content_edit_task(
                task_id=task.id, frozen=frozen, repository=repository,
                workflow=workflow, generation=generation))
        return task
    except HTTPException:
        raise
    except NotFoundError as exc:
        raise _http_error(status.HTTP_404_NOT_FOUND, ErrorCode.NOT_FOUND, "image layer set not found") from exc


@router.get(
    "/projects/{project_id}/image-layer-sets",
    response_model=list[ImageLayerSetDetail],
    tags=["image-layers"],
)
def list_image_layer_sets(
    project_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> list[ImageLayerSetDetail]:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        return [
            _image_layer_set_detail(item, repository, asset_storage)
            for item in repository.list_image_layer_sets(project_id)
        ]
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image project not found",
        ) from exc


@router.get(
    "/projects/{project_id}/image-layer-sets/{set_id}",
    response_model=ImageLayerSetDetail,
    tags=["image-layers"],
)
def get_image_layer_set(
    project_id: str,
    set_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> ImageLayerSetDetail:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        return _image_layer_set_detail(
            repository.get_image_layer_set(project_id, set_id),
            repository,
            asset_storage,
        )
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image layer set not found",
        ) from exc


@router.patch(
    "/projects/{project_id}/image-layer-sets/{set_id}",
    response_model=ImageLayerSetDetail,
    tags=["image-layers"],
)
def update_image_layer_set(
    project_id: str,
    set_id: str,
    payload: ImageLayerSetUpdate,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> ImageLayerSetDetail:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        updated = repository.update_image_layer_set(
            project_id,
            set_id,
            expected_revision=payload.expected_revision,
            layers=payload.layers,
        )
        return _image_layer_set_detail(updated, repository, asset_storage)
    except RevisionConflictError as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.TASK_CONFLICT,
            "image layer set revision conflict",
        ) from exc
    except ValueError as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            "all image layers must be updated exactly once",
        ) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image layer set not found",
        ) from exc


@router.get(
    "/projects/{project_id}/canvas-layout",
    response_model=CanvasLayout,
    tags=["image-canvas"],
)
def get_canvas_layout(
    project_id: str,
    repository: Repository = Depends(get_repository),
) -> CanvasLayout:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        return repository.get_canvas_layout(project_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image project not found",
        ) from exc


@router.put(
    "/projects/{project_id}/canvas-layout",
    response_model=CanvasLayout,
    tags=["image-canvas"],
)
def save_canvas_layout(
    project_id: str,
    payload: CanvasLayoutUpdate,
    repository: Repository = Depends(get_repository),
) -> CanvasLayout:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        return repository.save_canvas_layout(
            project_id,
            expected_revision=payload.expected_revision,
            nodes=payload.nodes,
        )
    except RevisionConflictError as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.TASK_CONFLICT,
            "canvas layout revision conflict",
        ) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image project not found",
        ) from exc


@router.post(
    "/projects/{project_id}/image-layer-compositions",
    response_model=GenerationTask,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["image-layers"],
)
async def submit_image_layer_composition(
    project_id: str,
    payload: ImageLayerCompositionRequest,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
) -> GenerationTask:
    try:
        project = repository.get_project(project_id)
        _require_image_project(project)
        layer_set = repository.get_image_layer_set(
            project_id,
            payload.layer_set_id,
        )
        if (
            layer_set.status != Status.SUCCEEDED
            or layer_set.revision != payload.expected_revision
        ):
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.TASK_CONFLICT,
                "image layer set revision conflict",
            )
        frozen = FrozenImageLayerCompositionInput(
            project_id=project_id,
            source_asset_id=layer_set.source_asset_id,
            layer_set_id=layer_set.id,
            layer_revision=layer_set.revision,
            set_current=payload.set_current,
            expected_image_revision=project.image_revision,
        )
        input_hash = _frozen_input_hash(frozen.model_dump(mode="json"))
        task, created = repository.create_task_if_no_active_hash(
            GenerationTaskCreate(
                project_id=project_id,
                stage=Stage.IMAGE,
                input_hash=input_hash,
                frozen_input=frozen.model_dump(mode="json"),
            )
        )
        if not created:
            return task
        background_runner.schedule(
            _run_image_layer_composition_task(
                task_id=task.id,
                frozen=frozen,
                repository=repository,
                workflow=workflow,
            )
        )
        return task
    except HTTPException:
        raise
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "image project or layer set not found",
        ) from exc


@router.get(
    "/projects/{project_id}/assets",
    response_model=list[Asset],
    tags=["projects"],
)
def list_project_assets(
    project_id: str,
    category: AssetCategory | None = None,
    status_filter: Status | None = Query(default=None, alias="status"),
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> list[Asset]:
    try:
        return [
            asset_storage.with_access_url(asset)
            for asset in repository.list_assets(
                project_id=project_id,
                category=category,
                status=status_filter,
            )
        ]
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.delete(
    "/projects/{project_id}/text-artifacts/{artifact_id}",
    response_model=Project,
    tags=["projects"],
)
def delete_text_artifact(
    project_id: str,
    artifact_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        deleted = repository.delete_text_artifact(project_id, artifact_id)
        workflow.mark_downstream_stale(project_id, deleted.stage)
        return asset_storage.with_project_access_urls(
            repository.get_project(project_id)
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "text artifact not found",
        ) from exc


@router.delete(
    "/projects/{project_id}/assets/{asset_id}",
    response_model=Project,
    tags=["projects"],
)
def delete_asset(
    project_id: str,
    asset_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        asset = repository.get_asset(asset_id)
        if asset.asset_role != AssetRole.PUBLIC:
            raise NotFoundError(f"asset not found: {asset_id}")
        deleted = repository.delete_asset(project_id, asset_id)
        asset_storage.delete_asset_objects(asset)
        if deleted.stage is not None:
            workflow.mark_downstream_stale(project_id, deleted.stage)
        return asset_storage.with_project_access_urls(
            repository.get_project(project_id)
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "asset not found",
        ) from exc


@router.get("/assets/{asset_id}", response_model=Asset, tags=["assets"])
def get_asset(
    asset_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Asset:
    try:
        asset = repository.get_asset(asset_id)
        if asset.asset_role != AssetRole.PUBLIC:
            raise NotFoundError(f"asset not found: {asset_id}")
        return asset_storage.with_access_url(asset)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "asset not found",
        ) from exc


@router.get("/assets", response_model=list[Asset], tags=["assets"])
def list_assets(
    project_id: str | None = None,
    category: AssetCategory | None = None,
    status_filter: Status | None = Query(default=None, alias="status"),
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> list[Asset]:
    try:
        return [
            asset_storage.with_access_url(asset)
            for asset in repository.list_assets(
                project_id=project_id,
                category=category,
                status=status_filter,
            )
        ]
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.get("/assets/{asset_id}/content", tags=["assets"])
async def get_asset_content(
    asset_id: str,
    request: Request,
    download: bool = False,
    filename: str | None = Query(default=None, max_length=180),
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
):
    try:
        asset = repository.get_asset(asset_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "asset not found",
        ) from exc
    if asset.asset_role != AssetRole.PUBLIC:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "asset not found",
        )

    access_url = asset_storage.signed_access_url(asset)
    if not access_url:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "asset content is not available",
        )

    if asset_storage.client is None and not download:
        return RedirectResponse(access_url)

    content_type = asset.mime_type or mimetypes.guess_type(asset.object_key or "")[0]
    request_headers: dict[str, str] = {}
    if range_header := request.headers.get("range"):
        request_headers["Range"] = range_header

    client = httpx.AsyncClient(follow_redirects=True, timeout=30.0)
    try:
        upstream = await client.send(
            client.build_request("GET", access_url, headers=request_headers),
            stream=True,
        )
        upstream.raise_for_status()
    except Exception as exc:
        await client.aclose()
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "asset content could not be loaded",
        ) from exc

    headers = {"Cache-Control": "private, max-age=300"}
    if content_type:
        headers["Content-Type"] = content_type
    if download:
        download_filename = _asset_download_filename(asset, preferred=filename)
        headers["Content-Disposition"] = _asset_content_disposition(
            download_filename
        )
    for header in (
        "Accept-Ranges",
        "Content-Length",
        "Content-Range",
        "ETag",
        "Last-Modified",
    ):
        if value := upstream.headers.get(header):
            headers[header] = value

    async def stream_content():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(
        stream_content(),
        status_code=upstream.status_code,
        headers=headers,
    )


@router.post(
    "/tools/tasks",
    response_model=ToolTask,
    status_code=status.HTTP_201_CREATED,
    tags=["tools"],
)
def create_tool_task(
    payload: ToolTaskCreate,
    repository: Repository = Depends(get_repository),
) -> ToolTask:
    try:
        return repository.create_tool_task(payload)
    except ValueError as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.TASK_CONFLICT,
            "tool task could not be created",
        ) from exc


@router.get("/tools/tasks", response_model=list[ToolTask], tags=["tools"])
def list_tool_tasks(
    task_type: ToolTaskType | None = Query(default=None, alias="type"),
    repository: Repository = Depends(get_repository),
) -> list[ToolTask]:
    return repository.list_tool_tasks(task_type=task_type)


@router.delete(
    "/tools/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["tools"],
)
def delete_tool_task(
    task_id: str,
    repository: Repository = Depends(get_repository),
) -> None:
    try:
        repository.delete_tool_task(task_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "tool task not found",
        ) from exc


@router.get("/tools/tasks/{task_id}", response_model=ToolTask, tags=["tools"])
async def get_tool_task(
    task_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    face_blur_client_factory: Callable[[], FaceBlurVideoClient] = Depends(
        get_face_blur_video_client_factory
    ),
) -> ToolTask:
    try:
        task = repository.get_tool_task(task_id)
        if (
            task.type == ToolTaskType.FACE_BLUR_VIDEO
            and task.status in {Status.QUEUED, Status.RUNNING}
        ):
            return await _refresh_face_blur_tool_task(
                task,
                repository=repository,
                asset_storage=asset_storage,
                face_blur_client_factory=face_blur_client_factory,
            )
        return task
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "tool task not found",
        ) from exc


@router.post(
    "/tools/face-blur-video",
    response_model=ToolTask,
    status_code=status.HTTP_201_CREATED,
    tags=["tools"],
)
async def submit_face_blur_video(
    payload: FaceBlurVideoRequest,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    face_blur_client_factory: Callable[[], FaceBlurVideoClient] = Depends(
        get_face_blur_video_client_factory
    ),
) -> ToolTask:
    try:
        input_asset = repository.get_asset(payload.video_asset_id)
        _validate_tool_asset_reference(input_asset, ReferenceAssetKind.VIDEO)
        video_url = asset_storage.signed_access_url(input_asset)
        if not video_url:
            raise WorkflowError(ErrorCode.INVALID_STATE, "tool video is not accessible")
        task_data = ToolTaskCreate(
            type=ToolTaskType.FACE_BLUR_VIDEO,
            input_snapshot={
                "video_asset_id": input_asset.id,
                "mask_mode": payload.mask_mode,
                "mask_strength": payload.mask_strength,
            },
        )
        task = repository.create_tool_task_with_input_assets(
            task_data,
            [
                ToolTaskInputAsset(
                    task_id=task_data.id,
                    asset_id=input_asset.id,
                    kind=ReferenceAssetKind.VIDEO,
                )
            ],
        )
        return await _submit_face_blur_tool_task(
            task,
            video_url=video_url,
            repository=repository,
            face_blur_client_factory=face_blur_client_factory,
        )
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "tool video not found",
        ) from exc
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc


@router.post(
    "/tools/videos",
    response_model=ToolTask,
    status_code=status.HTTP_201_CREATED,
    tags=["tools"],
)
async def generate_tool_video(
    payload: ToolVideoGenerationRequest,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
) -> ToolTask:
    try:
        reference_urls = _tool_reference_urls(
            payload, repository=repository, asset_storage=asset_storage
        )
        task_data = ToolTaskCreate(
            type=ToolTaskType.MULTIMODAL_VIDEO_GENERATION,
            input_snapshot=payload.model_dump(),
        )
        task = repository.create_tool_task_with_input_assets(
            task_data,
            _tool_task_inputs(task_data.id, payload),
        )
        background_runner.schedule(
            _run_tool_video_generation(
                task_id=task.id,
                request=ModelArkToolVideoGenerationRequest(
                    model=payload.model,
                    prompt=payload.prompt,
                    duration_seconds=payload.duration_seconds,
                    resolution=payload.resolution,
                    aspect_ratio=payload.aspect_ratio,
                    **reference_urls,
                ),
                repository=repository,
                asset_storage=asset_storage,
                generation=generation,
            )
        )
        return task
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND, ErrorCode.NOT_FOUND, "tool reference asset not found"
        ) from exc
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc


@router.post(
    "/tools/videos/optimize-prompt",
    response_model=ToolVideoPromptOptimizeResponse,
    tags=["tools"],
)
async def optimize_tool_video_prompt(
    payload: ToolVideoPromptOptimizeRequest,
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> ToolVideoPromptOptimizeResponse:
    try:
        optimized_prompt = await generation.optimize_tool_video_prompt(
            prompt=payload.prompt,
            reference_image_count=payload.reference_image_count,
            reference_video_count=payload.reference_video_count,
            reference_audio_count=payload.reference_audio_count,
        )
        return ToolVideoPromptOptimizeResponse(optimized_prompt=optimized_prompt)
    except (ModelArkProviderError, ModelArkTextParseError) as exc:
        logger.warning(
            "tool video prompt optimization provider failure",
            extra=exc.safe_log_fields(),
        )
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "tool video prompt optimization failed",
            exc.safe_detail(),
        ) from exc


@router.post(
    "/tools/tasks/{task_id}/retry",
    response_model=ToolTask,
    tags=["tools"],
)
async def retry_tool_task(
    task_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
    face_blur_client_factory: Callable[[], FaceBlurVideoClient] = Depends(
        get_face_blur_video_client_factory
    ),
) -> ToolTask:
    try:
        failed = repository.get_tool_task(task_id)
        if failed.status != Status.FAILED:
            raise WorkflowError(ErrorCode.INVALID_STATE, "tool task is not retryable")
        video_payload = (
            ToolVideoGenerationRequest.model_validate(failed.input_snapshot)
            if failed.type == ToolTaskType.MULTIMODAL_VIDEO_GENERATION
            else None
        )
        video_url: str | None = None
        reference_urls: dict[str, list[str]] | None = None
        if failed.type == ToolTaskType.FACE_BLUR_VIDEO:
            input_asset = repository.get_asset(
                str(failed.input_snapshot["video_asset_id"])
            )
            _validate_tool_asset_reference(input_asset, ReferenceAssetKind.VIDEO)
            video_url = asset_storage.signed_access_url(input_asset)
            if not video_url:
                raise WorkflowError(ErrorCode.INVALID_STATE, "tool video is not accessible")
        else:
            assert video_payload is not None
            reference_urls = _tool_reference_urls(
                video_payload,
                repository=repository,
                asset_storage=asset_storage,
            )
        retry_data = ToolTaskCreate(
            type=failed.type,
            input_snapshot=failed.input_snapshot,
            retry_of_task_id=failed.id,
        )
        retry = repository.create_tool_task_with_input_assets(
            retry_data,
            [
                ToolTaskInputAsset(
                    task_id=retry_data.id,
                    asset_id=item.asset_id,
                    kind=item.kind,
                )
                for item in failed.input_assets
            ],
        )
        if retry.type == ToolTaskType.FACE_BLUR_VIDEO:
            assert video_url is not None
            return await _submit_face_blur_tool_task(
                retry,
                video_url=video_url,
                repository=repository,
                face_blur_client_factory=face_blur_client_factory,
            )

        assert video_payload is not None
        assert reference_urls is not None
        background_runner.schedule(
            _run_tool_video_generation(
                task_id=retry.id,
                request=ModelArkToolVideoGenerationRequest(
                    model=video_payload.model,
                    prompt=video_payload.prompt,
                    duration_seconds=video_payload.duration_seconds,
                    resolution=video_payload.resolution,
                    aspect_ratio=video_payload.aspect_ratio,
                    **reference_urls,
                ),
                repository=repository,
                asset_storage=asset_storage,
                generation=generation,
            )
        )
        return retry
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND, ErrorCode.NOT_FOUND, "tool task or asset not found"
        ) from exc
    except (KeyError, ValidationError) as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            "tool task has no valid retry input",
        ) from exc
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc


@router.post(
    "/tools/assets/upload",
    response_model=Asset,
    status_code=status.HTTP_201_CREATED,
    tags=["tools"],
)
async def upload_tool_asset(
    kind: ReferenceAssetKind,
    filename: str | None = Query(default=None),
    mime_type: str | None = Query(default=None),
    content: bytes = Body(..., media_type="application/octet-stream"),
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    video_normalizer: VideoNormalizer = Depends(get_video_normalizer_service),
) -> Asset:
    try:
        normalized_mime_type = _validate_uploaded_reference(
            kind,
            filename=filename,
            mime_type=mime_type,
            content_size=len(content),
        )
        metadata = {
            "tool_asset_kind": kind.value,
            "name": filename or f"tool-{kind.value}",
        }
        stored_filename = filename
        if kind == ReferenceAssetKind.VIDEO:
            normalized_video = await video_normalizer.normalize_if_needed(content)
            content = normalized_video.content
            normalized_mime_type = "video/mp4"
            stored_filename = _normalized_video_filename(filename)
            metadata["name"] = stored_filename
            metadata["original_filename"] = filename or f"tool-{kind.value}"
            metadata["source_container"] = normalized_video.source_format
            metadata["video_normalized"] = normalized_video.normalized
        asset = asset_storage.upload_asset(
            repository,
            StoredAssetInput(
                type=_uploaded_asset_type(kind),
                tool_asset_role=ToolAssetRole.INPUT,
                status=Status.SUCCEEDED,
                mime_type=normalized_mime_type,
                filename=stored_filename,
                metadata=metadata,
            ),
            content=content,
        )
        return asset_storage.with_access_url(asset)
    except VideoNormalizationError as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            ErrorCode.VALIDATION_ERROR,
            "uploaded video could not be normalized to MP4",
        ) from exc
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except (ConfigurationError, ValueError) as exc:
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            ErrorCode.VALIDATION_ERROR,
            "tool asset upload is invalid",
        ) from exc
    except Exception as exc:
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "tool asset upload failed",
        ) from exc


@router.get("/tools/assets", response_model=list[Asset], tags=["tools"])
def list_tool_assets(
    kind: ReferenceAssetKind | None = None,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> list[Asset]:
    assets: list[Asset] = []
    for asset in repository.list_assets(status=Status.SUCCEEDED):
        if asset.project_id is not None or asset.tool_asset_role is None:
            continue
        if asset.asset_role != AssetRole.PUBLIC:
            continue
        if kind is None and not any(
            _tool_asset_matches_kind(asset, candidate)
            for candidate in ReferenceAssetKind
        ):
            continue
        if kind is not None and not _tool_asset_matches_kind(asset, kind):
            continue
        if asset_storage.signed_access_url(asset) is None:
            continue
        assets.append(asset_storage.with_access_url(asset))
    return assets


@router.delete("/tools/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["tools"])
def delete_tool_asset(
    asset_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> None:
    try:
        asset = repository.get_asset(asset_id)
        deleted = repository.delete_tool_asset(asset_id)
        asset_storage.delete_asset_objects(asset)
        assert deleted.id == asset.id
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "tool asset not found",
        ) from exc
    except AssetReferenceConflictError as exc:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            str(exc),
        ) from exc


def _tool_reference_urls(
    payload: ToolVideoGenerationRequest,
    *,
    repository: Repository,
    asset_storage: AssetStorageService,
) -> dict[str, list[str]]:
    references = (
        ("reference_image_asset_ids", payload.reference_image_asset_ids, ReferenceAssetKind.IMAGE),
        ("reference_video_asset_ids", payload.reference_video_asset_ids, ReferenceAssetKind.VIDEO),
        ("reference_audio_asset_ids", payload.reference_audio_asset_ids, ReferenceAssetKind.AUDIO),
    )
    urls: dict[str, list[str]] = {}
    for field, asset_ids, kind in references:
        resolved: list[str] = []
        for asset_id in asset_ids:
            asset = repository.get_asset(asset_id)
            _validate_tool_reference_asset(asset, kind)
            access_url = asset_storage.signed_access_url(asset)
            if not access_url:
                raise WorkflowError(ErrorCode.INVALID_STATE, "tool reference is not accessible")
            resolved.append(access_url)
        urls[field.replace("_asset_ids", "_urls")] = resolved
    return urls


def _tool_task_inputs(
    task_id: str,
    payload: ToolVideoGenerationRequest,
) -> list[ToolTaskInputAsset]:
    inputs: list[ToolTaskInputAsset] = []
    for asset_ids, kind in (
        (payload.reference_image_asset_ids, ReferenceAssetKind.IMAGE),
        (payload.reference_video_asset_ids, ReferenceAssetKind.VIDEO),
        (payload.reference_audio_asset_ids, ReferenceAssetKind.AUDIO),
    ):
        inputs.extend(
            ToolTaskInputAsset(task_id=task_id, asset_id=asset_id, kind=kind)
            for asset_id in asset_ids
        )
    return inputs


async def _submit_face_blur_tool_task(
    task: ToolTask,
    *,
    video_url: str,
    repository: Repository,
    face_blur_client_factory: Callable[[], FaceBlurVideoClient],
) -> ToolTask:
    try:
        submitted = await face_blur_client_factory().submit(
            video_url=video_url,
            mask_mode=str(task.input_snapshot["mask_mode"]),
            mask_strength=str(task.input_snapshot["mask_strength"]),
        )
        return repository.update_tool_task(
            task.id,
            status=Status.QUEUED,
            provider_task_id=submitted.task_id,
            started_at=utc_now(),
            error=None,
        )
    except MediaKitFaceBlurError as exc:
        return _fail_tool_task(
            task,
            repository=repository,
            message="人物打码提交失败",
            stage="submit",
            provider_task_id=task.provider_task_id,
            safe_detail=exc.detail,
        )
    except Exception as exc:
        logger.warning("face blur submission failed", extra={"task_id": task.id, "error_type": type(exc).__name__})
        return _fail_tool_task(
            task,
            repository=repository,
            message="人物打码提交失败",
            stage="submit",
        )


async def _refresh_face_blur_tool_task(
    task: ToolTask,
    *,
    repository: Repository,
    asset_storage: AssetStorageService,
    face_blur_client_factory: Callable[[], FaceBlurVideoClient],
) -> ToolTask:
    if not task.provider_task_id:
        return _fail_tool_task(
            task,
            repository=repository,
            message="人物打码任务缺少供应商标识",
            stage="query",
        )
    try:
        remote = await face_blur_client_factory().get_task(task_id=task.provider_task_id)
        if remote.status == FaceBlurTaskStatus.QUEUED:
            return repository.update_tool_task(task.id, status=Status.QUEUED)
        if remote.status == FaceBlurTaskStatus.RUNNING:
            return repository.update_tool_task(task.id, status=Status.RUNNING)
        assert remote.output_video_url is not None
        assets = await asset_storage.upload_assets_from_sources(
            repository,
            [
                StoredAssetInput(
                    tool_task_id=task.id,
                    tool_asset_role=ToolAssetRole.OUTPUT,
                    type=AssetType.FINAL_VIDEO,
                    stage=Stage.VIDEO,
                    status=Status.SUCCEEDED,
                    source_url=remote.output_video_url,
                    mime_type="video/mp4",
                    filename="face-blur-video.mp4",
                    metadata={
                        "provider": "mediakit",
                        "operation": "face_blur_video",
                        "provider_task_id": remote.task_id,
                        "mask_mode": task.input_snapshot.get("mask_mode"),
                        "mask_strength": task.input_snapshot.get("mask_strength"),
                        "duration_seconds": remote.duration_seconds,
                    },
                )
            ],
        )
        assert assets
        return repository.update_tool_task(
            task.id,
            status=Status.SUCCEEDED,
            finished_at=utc_now(),
            error=None,
        )
    except MediaKitFaceBlurError as exc:
        return _fail_tool_task(
            task,
            repository=repository,
            message="人物打码处理失败",
            stage="query",
            provider_task_id=task.provider_task_id,
            safe_detail=exc.detail,
        )
    except Exception as exc:
        logger.warning("face blur task refresh failed", extra={"task_id": task.id, "error_type": type(exc).__name__})
        return _fail_tool_task(
            task,
            repository=repository,
            message="人物打码结果转存失败",
            stage="transfer",
            provider_task_id=task.provider_task_id,
        )


async def _run_tool_video_generation(
    *,
    task_id: str,
    request: ModelArkToolVideoGenerationRequest,
    repository: Repository,
    asset_storage: AssetStorageService,
    generation: ModelArkGenerationService,
) -> None:
    task = repository.get_tool_task(task_id)
    try:
        repository.update_tool_task(task_id, status=Status.RUNNING, started_at=utc_now())
        generated = await generation.generate_tool_video(request)
        provider_task_id = generated.metadata.get("provider_task_id")
        assets = await asset_storage.upload_assets_from_sources(
            repository,
            [
                StoredAssetInput(
                    tool_task_id=task_id,
                    tool_asset_role=ToolAssetRole.OUTPUT,
                    type=AssetType.FINAL_VIDEO,
                    stage=Stage.VIDEO,
                    status=Status.SUCCEEDED,
                    source_url=generated.url,
                    mime_type=generated.mime_type,
                    filename="generated-tool-video.mp4",
                    metadata=generated.metadata,
                )
            ],
        )
        assert assets
        repository.update_tool_task(
            task_id,
            status=Status.SUCCEEDED,
            provider_task_id=provider_task_id if isinstance(provider_task_id, str) else None,
            finished_at=utc_now(),
            error=None,
        )
    except ModelArkProviderError as exc:
        _fail_tool_task(
            task,
            repository=repository,
            message="视频生成失败",
            stage=exc.phase or "generate",
            provider_task_id=exc.provider_task_id,
            provider_request_id=exc.request_id,
            provider_code=exc.provider_code,
        )
    except Exception as exc:
        logger.warning("tool video generation failed", extra={"task_id": task_id, "error_type": type(exc).__name__})
        _fail_tool_task(
            task,
            repository=repository,
            message="视频生成或结果转存失败",
            stage="transfer",
        )


def _fail_tool_task(
    task: ToolTask,
    *,
    repository: Repository,
    message: str,
    stage: str,
    provider_task_id: str | None = None,
    provider_request_id: str | None = None,
    provider_code: str | None = None,
    safe_detail: str | None = None,
) -> ToolTask:
    code = (
        ErrorCode.EXTERNAL_SERVICE_ERROR
        if provider_code or safe_detail is not None
        else ErrorCode.GENERATION_FAILED
    )
    return repository.update_tool_task(
        task.id,
        status=Status.FAILED,
        finished_at=utc_now(),
        error=ToolTaskError(
            code=code,
            message=message,
            provider_request_id=provider_request_id,
            provider_task_id=provider_task_id,
            stage=stage,
        ),
    )


def _asset_download_filename(asset: Asset, *, preferred: str | None = None) -> str:
    metadata_name = asset.metadata.get("name")
    if preferred and preferred.strip():
        candidate = preferred.strip()
        preserve_unicode = True
    elif isinstance(metadata_name, str) and metadata_name.strip():
        candidate = metadata_name.strip()
        preserve_unicode = False
    elif asset.object_key:
        candidate = os.path.basename(urlsplit(asset.object_key).path)
        preserve_unicode = False
    else:
        candidate = asset.id
        preserve_unicode = False

    candidate = re.sub(r"[\x00-\x1f<>:\"/\\|?*]+", "-", candidate).strip(
        ". -_"
    )
    if not preserve_unicode:
        candidate = re.sub(r"[^A-Za-z0-9._-]+", "-", candidate).strip(". -_")
    if not candidate:
        candidate = asset.id
    candidate = candidate[:180]

    stem, extension = os.path.splitext(candidate)
    if not extension:
        guessed = mimetypes.guess_extension(asset.mime_type or "") or ""
        candidate = f"{candidate}{guessed}"
    elif not stem:
        candidate = f"{asset.id}{extension}"
    return candidate


def _asset_content_disposition(filename: str) -> str:
    ascii_name = re.sub(r"[^A-Za-z0-9._-]+", "-", filename).strip(". -_")
    _, extension = os.path.splitext(filename)
    if not ascii_name or not os.path.splitext(ascii_name)[0]:
        ascii_name = f"download{extension}"
    if ascii_name == filename:
        return f'attachment; filename="{ascii_name}"'
    encoded = quote(filename, safe="")
    return (
        f'attachment; filename="{ascii_name}"; '
        f"filename*=UTF-8''{encoded}"
    )


@router.get("/assets/{asset_id}/last-frame", tags=["assets"])
async def get_asset_last_frame(
    asset_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
):
    try:
        asset = repository.get_asset(asset_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "asset not found",
        ) from exc

    object_key = asset.metadata.get("last_frame_object_key")
    if not isinstance(object_key, str) or not object_key:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "asset last frame is not available",
        )
    access_url = asset_storage.signed_url_for_key(object_key)
    if not access_url:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "asset last frame is not available",
        )

    if asset_storage.client is None:
        return RedirectResponse(access_url)

    headers = {
        "Cache-Control": "private, max-age=300",
        "Content-Type": "image/png",
    }

    async def stream_content():
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            async with client.stream("GET", access_url) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream_content(), headers=headers)


@router.post(
    "/projects/{project_id}/story",
    tags=["generation"],
)
async def generate_story(
    project_id: str,
    payload: TextGenerationInputRequest | None = Body(default=None),
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> StreamingResponse:
    image_urls = _text_generation_image_urls(
        payload,
        repository,
        asset_storage,
        project_id,
    )
    task = _start_stream_task(project_id, Stage.STORY, workflow)
    return _sse_response(
        _stream_story_task(
            task,
            repository,
            workflow,
            generation,
            image_urls=image_urls,
        )
    )


@router.patch(
    "/projects/{project_id}/story",
    response_model=Project,
    tags=["generation"],
)
def update_story(
    project_id: str,
    payload: TextArtifactUpdate,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        workflow.edit_text_artifact(
            project_id,
            Stage.STORY,
            content=payload.content,
            title=payload.title,
        )
        return asset_storage.with_project_access_urls(
            repository.get_project(project_id)
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/characters",
    response_model=GenerationTask,
    tags=["generation"],
)
async def generate_characters(
    project_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> GenerationTask:
    return await _run_stage(
        project_id,
        Stage.CHARACTER,
        repository,
        workflow,
        lambda task: _generate_characters(task, repository, workflow, generation),
    )


@router.post(
    "/projects/{project_id}/characters/skip",
    response_model=GenerationTask,
    tags=["generation"],
)
def skip_characters(
    project_id: str,
    workflow: WorkflowService = Depends(get_workflow_service),
) -> GenerationTask:
    try:
        return workflow.skip_stage(project_id, Stage.CHARACTER)
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc


@router.patch(
    "/projects/{project_id}/character-cards/{card_id}",
    response_model=CharacterCard,
    tags=["characters"],
)
def update_character_card(
    project_id: str,
    card_id: str,
    payload: CharacterCardUpdate,
    workflow: WorkflowService = Depends(get_workflow_service),
) -> CharacterCard:
    try:
        return workflow.update_character_card(
            project_id,
            card_id,
            **payload.model_dump(exclude_unset=True),
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc


@router.delete(
    "/projects/{project_id}/character-cards/{card_id}",
    response_model=Project,
    tags=["characters"],
)
def delete_character_card(
    project_id: str,
    card_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        workflow.delete_character_card(project_id, card_id)
        return asset_storage.with_project_access_urls(repository.get_project(project_id))
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/character-cards/{card_id}/generate-image",
    response_model=CharacterCardImageGenerationResponse,
    tags=["generation"],
)
async def generate_character_card_image(
    project_id: str,
    card_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> CharacterCardImageGenerationResponse:
    task: GenerationTask | None = None
    try:
        brief = repository.get_project(project_id).brief
        task, card = workflow.begin_character_card_image_generation(project_id, card_id)
        prompt = generation.build_character_card_image_prompt(
            card.name,
            card.description,
            brief.aspect_ratio,
            brief.target_language,
        )
        generated = await generation.generate_character_card_image(
            project_id,
            aspect_ratio=brief.aspect_ratio,
            target_language=brief.target_language,
            character_name=card.name,
            character_description=card.description,
            metadata=workflow.build_character_card_image_metadata(
                card,
                prompt=prompt,
            ),
        )
        created_assets = await workflow.create_assets_from_sources(
            project_id,
            [
                StoredAssetInput(
                    project_id=project_id,
                    type=generated.type,
                    category=AssetCategory.CHARACTER,
                    stage=Stage.CHARACTER,
                    status=generated.status,
                    source_url=generated.url,
                    mime_type=generated.mime_type,
                    source_task_id=task.id,
                    metadata=generated.metadata,
                )
            ],
            stage=Stage.CHARACTER,
        )
        completed_task, updated_card = workflow.complete_character_card_image_generation(
            project_id,
            card_id,
            task.id,
            created_assets[0].id,
        )
        task = completed_task
        return CharacterCardImageGenerationResponse(
            character_card=updated_card,
            task=completed_task,
            asset=workflow.asset_storage.with_access_url(created_assets[0]),
        )
    except WorkflowError as exc:
        if task is not None and task.status in {Status.QUEUED, Status.RUNNING}:
            workflow.fail_task(
                task.id,
                message="character image generation failed",
                detail=exc.code.value,
            )
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        if task is not None and task.status in {Status.QUEUED, Status.RUNNING}:
            workflow.fail_task(
                task.id,
                message="character image generation failed",
                detail=ErrorCode.NOT_FOUND.value,
            )
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc
    except Exception as exc:
        if task is not None and task.status in {Status.QUEUED, Status.RUNNING}:
            workflow.fail_task(
                task.id,
                message="character image generation failed",
                detail=type(exc).__name__,
            )
        raise _http_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.GENERATION_FAILED,
            "character image generation failed",
        ) from exc


@router.post(
    "/projects/{project_id}/character-assets/iterations",
    response_model=CharacterAssetIterationResponse,
    tags=["generation"],
)
async def submit_character_asset_iteration(
    project_id: str,
    payload: CharacterAssetIterationRequest,
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
) -> CharacterAssetIterationResponse:
    task: GenerationTask | None = None
    try:
        task, source_asset = workflow.begin_character_asset_iteration(
            project_id,
            asset_id=payload.asset_id,
            prompt=payload.prompt,
            operation_type=payload.operation_type,
        )
        background_runner.schedule(
            _run_character_asset_iteration_task(
                project_id=project_id,
                task_id=task.id,
                source_asset=source_asset,
                prompt=payload.prompt,
                operation_type=payload.operation_type,
                workflow=workflow,
                generation=generation,
            )
        )
        return CharacterAssetIterationResponse(
            source_asset_id=payload.asset_id,
            prompt=payload.prompt,
            operation_type=payload.operation_type,
            task=task,
            asset=_character_iteration_placeholder_asset(
                project_id=project_id,
                task=task,
                source_asset=source_asset,
                prompt=payload.prompt,
                operation_type=payload.operation_type,
                workflow=workflow,
            ),
        )
    except WorkflowError as exc:
        if task is not None and task.status in {Status.QUEUED, Status.RUNNING}:
            workflow.fail_task(
                task.id,
                message="character asset iteration failed",
                detail=exc.code.value,
            )
        raise _workflow_http_error(exc) from exc
    except Exception as exc:
        if task is not None and task.status in {Status.QUEUED, Status.RUNNING}:
            workflow.fail_task(
                task.id,
                message="character asset iteration failed",
                detail=type(exc).__name__,
            )
        raise _http_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.GENERATION_FAILED,
            "character asset iteration failed",
        ) from exc


async def _run_character_asset_iteration_task(
    *,
    project_id: str,
    task_id: str,
    source_asset: Asset,
    prompt: str,
    operation_type: CharacterAssetIterationOperation,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> None:
    try:
        source_image_url = workflow.asset_storage.signed_access_url(source_asset)
        if not source_image_url:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                "source character asset has no accessible URL",
                detail=f"asset_id={source_asset.id}",
            )

        generated = await generation.generate_character_asset_iteration(
            project_id,
            source_image_url=source_image_url,
            prompt=prompt,
            operation_type=operation_type,
            metadata=workflow.build_character_iteration_metadata(
                source_asset,
                prompt=prompt,
                operation_type=operation_type,
            ),
        )
        created_assets = await workflow.create_assets_from_sources(
            project_id,
            [
                StoredAssetInput(
                    project_id=project_id,
                    type=generated.type,
                    category=AssetCategory.CHARACTER,
                    stage=Stage.CHARACTER,
                    status=generated.status,
                    source_url=generated.url,
                    mime_type=generated.mime_type,
                    source_task_id=task_id,
                    metadata=generated.metadata,
                )
            ],
            stage=Stage.CHARACTER,
        )
        workflow.complete_task(task_id, output_asset_ids=[created_assets[0].id])
    except WorkflowError as exc:
        workflow.fail_task(
            task_id,
            message="character asset iteration failed",
            detail=exc.code.value,
        )
    except Exception as exc:
        workflow.fail_task(
            task_id,
            message="character asset iteration failed",
            detail=type(exc).__name__,
        )


def _character_iteration_placeholder_asset(
    *,
    project_id: str,
    task: GenerationTask,
    source_asset: Asset,
    prompt: str,
    operation_type: CharacterAssetIterationOperation,
    workflow: WorkflowService,
) -> Asset:
    return Asset(
        project_id=project_id,
        type=AssetType.GENERATED_IMAGE,
        category=AssetCategory.CHARACTER,
        status=task.status,
        stage=Stage.CHARACTER,
        mime_type=source_asset.mime_type or "image/png",
        source_task_id=task.id,
        metadata=workflow.build_character_iteration_metadata(
            source_asset,
            prompt=prompt,
            operation_type=operation_type,
        ),
    )


@router.post(
    "/projects/{project_id}/script",
    tags=["generation"],
)
async def generate_script(
    project_id: str,
    payload: TextGenerationInputRequest | None = Body(default=None),
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> StreamingResponse:
    image_urls = _text_generation_image_urls(
        payload,
        repository,
        asset_storage,
        project_id,
    )
    task = _start_stream_task(project_id, Stage.SCRIPT, workflow)
    return _sse_response(
        _stream_script_task(
            task,
            repository,
            workflow,
            generation,
            image_urls=image_urls,
        )
    )


@router.patch(
    "/projects/{project_id}/script",
    response_model=Project,
    tags=["generation"],
)
def update_script(
    project_id: str,
    payload: TextArtifactUpdate,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        workflow.edit_text_artifact(
            project_id,
            Stage.SCRIPT,
            content=payload.content,
            title=payload.title,
        )
        return asset_storage.with_project_access_urls(
            repository.get_project(project_id)
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/storyboard",
    tags=["generation"],
)
async def generate_storyboard(
    project_id: str,
    payload: TextGenerationInputRequest | None = Body(default=None),
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> StreamingResponse:
    image_urls = _text_generation_image_urls(
        payload,
        repository,
        asset_storage,
        project_id,
    )
    task = _start_stream_task(project_id, Stage.STORYBOARD, workflow)
    return _sse_response(
        _stream_storyboard_task(
            task,
            repository,
            workflow,
            generation,
            image_urls=image_urls,
        )
    )


@router.patch(
    "/projects/{project_id}/storyboard",
    response_model=Project,
    tags=["generation"],
)
def update_storyboard(
    project_id: str,
    payload: TextArtifactUpdate,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        workflow.edit_text_artifact(
            project_id,
            Stage.STORYBOARD,
            content=payload.content,
            title=payload.title,
        )
        return asset_storage.with_project_access_urls(
            repository.get_project(project_id)
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.get(
    "/projects/{project_id}/storyboard/shots/{shot_id}/video-config",
    response_model=StoryboardShotVideoConfig,
    tags=["storyboard-video"],
)
def get_storyboard_shot_video_config(
    project_id: str,
    shot_id: str,
    repository: Repository = Depends(get_repository),
) -> StoryboardShotVideoConfig:
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
        return _shot_video_config(shot, project.brief.target_language)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"storyboard shot not found: {shot_id}",
        ) from exc


@router.patch(
    "/projects/{project_id}/storyboard/shots/{shot_id}/video-config",
    response_model=StoryboardShotVideoConfig,
    tags=["storyboard-video"],
)
def update_storyboard_shot_video_config(
    project_id: str,
    shot_id: str,
    payload: StoryboardShotVideoConfigUpdate,
    repository: Repository = Depends(get_repository),
) -> StoryboardShotVideoConfig:
    try:
        project = repository.get_project(project_id)
        existing = repository.get_storyboard_shot(project_id, shot_id)
        if existing.merge_source_shots and payload.video_prompt is not None:
            validate_merged_prompt_timeline(
                payload.video_prompt,
                existing.merge_source_shots,
                target_language=project.brief.target_language,
            )
        shot = repository.save_storyboard_shot_video_config(
            project_id,
            shot_id,
            payload,
        )
        return _shot_video_config(shot, project.brief.target_language)
    except ValueError as exc:
        raise _http_error(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.VALIDATION_ERROR,
            str(exc),
        ) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"storyboard shot not found: {shot_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/optimize-video-prompt",
    tags=["storyboard-video"],
)
async def optimize_storyboard_shot_video_prompt(
    project_id: str,
    shot_id: str,
    payload: StoryboardShotVideoPromptOptimizeRequest,
    repository: Repository = Depends(get_repository),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> StreamingResponse:
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "project or storyboard shot not found",
        ) from exc

    return _sse_response(
        _stream_video_prompt_optimization(
            generation.stream_storyboard_shot_video_prompt_optimization(
                project_id,
                project.brief,
                shot,
                payload.video_prompt,
            ),
            project_id,
            shot_id,
        )
    )


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/first-frame",
    response_model=StoryboardShotVideoConfig,
    tags=["storyboard-video"],
)
def set_storyboard_shot_first_frame(
    project_id: str,
    shot_id: str,
    payload: StoryboardShotFirstFrameRequest,
    repository: Repository = Depends(get_repository),
) -> StoryboardShotVideoConfig:
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
        _validate_storyboard_video_input_mode(shot, adding_first_frame=True)
        if payload.asset_id is not None:
            _validate_reference_asset(
                repository.get_asset(payload.asset_id),
                project_id=project_id,
                kind=ReferenceAssetKind.IMAGE,
            )
        else:
            assert payload.source_video_asset_id is not None
            _previous_shot_last_frame_asset(
                repository,
                project_id=project_id,
                shot=shot,
                source_video_asset_id=payload.source_video_asset_id,
            )
        return _shot_video_config(
            repository.set_storyboard_shot_first_frame(
                project_id,
                shot_id,
                asset_id=payload.asset_id,
                source_video_asset_id=payload.source_video_asset_id,
            ),
            project.brief.target_language,
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "first frame asset or storyboard shot not found",
        ) from exc


@router.delete(
    "/projects/{project_id}/storyboard/shots/{shot_id}/first-frame",
    response_model=StoryboardShotVideoConfig,
    tags=["storyboard-video"],
)
def clear_storyboard_shot_first_frame(
    project_id: str,
    shot_id: str,
    repository: Repository = Depends(get_repository),
) -> StoryboardShotVideoConfig:
    try:
        project = repository.get_project(project_id)
        return _shot_video_config(
            repository.set_storyboard_shot_first_frame(
                project_id,
                shot_id,
                asset_id=None,
                source_video_asset_id=None,
            ),
            project.brief.target_language,
        )
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"storyboard shot not found: {shot_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/references",
    response_model=StoryboardShotVideoConfig,
    tags=["storyboard-video"],
)
def attach_storyboard_shot_reference(
    project_id: str,
    shot_id: str,
    payload: StoryboardShotReferenceRequest,
    repository: Repository = Depends(get_repository),
) -> StoryboardShotVideoConfig:
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
        _validate_storyboard_video_input_mode(shot, adding_reference_media=True)
        _validate_reference_asset(
            repository.get_asset(payload.asset_id),
            project_id=project_id,
            kind=payload.kind,
        )
        shot = repository.attach_storyboard_shot_reference(
            project_id,
            shot_id,
            kind=payload.kind,
            asset_id=payload.asset_id,
        )
        return _shot_video_config(shot, project.brief.target_language)
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "reference asset or storyboard shot not found",
        ) from exc
    except Exception as exc:
        raise _http_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "reference asset could not be attached",
        ) from exc


@router.delete(
    "/projects/{project_id}/storyboard/shots/{shot_id}/references",
    response_model=StoryboardShotVideoConfig,
    tags=["storyboard-video"],
)
def remove_storyboard_shot_reference(
    project_id: str,
    shot_id: str,
    payload: StoryboardShotReferenceRequest,
    repository: Repository = Depends(get_repository),
) -> StoryboardShotVideoConfig:
    try:
        project = repository.get_project(project_id)
        shot = repository.remove_storyboard_shot_reference(
            project_id,
            shot_id,
            kind=payload.kind,
            asset_id=payload.asset_id,
        )
        return _shot_video_config(shot, project.brief.target_language)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"storyboard shot not found: {shot_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/last-frame-reference",
    response_model=StoryboardTailFrameReferenceApplyResponse,
    tags=["storyboard-video"],
)
def apply_storyboard_shot_last_frame_reference(
    project_id: str,
    shot_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> StoryboardTailFrameReferenceApplyResponse:
    try:
        repository.get_project(project_id)
        source_shot = repository.get_storyboard_shot(project_id, shot_id)
        source_video, last_frame_object_key = _source_shot_last_frame_asset(
            repository,
            project_id=project_id,
            shot=source_shot,
        )
        ordered_shots = sorted(
            repository.list_project_storyboard(project_id),
            key=lambda item: item.index,
        )
        subsequent_shots = [
            shot for shot in ordered_shots if shot.index > source_shot.index
        ]
        if not subsequent_shots:
            raise WorkflowError(
                ErrorCode.VALIDATION_ERROR,
                "the storyboard shot has no subsequent shots",
            )

        reference_asset = _copy_last_frame_to_reference_asset(
            repository,
            asset_storage,
            project_id=project_id,
            source_shot=source_shot,
            source_video_asset=source_video,
            last_frame_object_key=last_frame_object_key,
        )
        applied_shot_ids: list[str] = []
        skipped: list[StoryboardTailFrameReferenceSkip] = []

        for target_shot in subsequent_shots:
            if (
                target_shot.first_frame_asset_id
                or target_shot.first_frame_source_video_asset_id
            ):
                skipped.append(
                    StoryboardTailFrameReferenceSkip(
                        shot_id=target_shot.id,
                        shot_index=target_shot.index,
                        reason="has_first_frame",
                    )
                )
                continue
            if reference_asset.id in target_shot.reference_image_asset_ids:
                skipped.append(
                    StoryboardTailFrameReferenceSkip(
                        shot_id=target_shot.id,
                        shot_index=target_shot.index,
                        reason="already_attached",
                    )
                )
                continue

            repository.attach_storyboard_shot_reference(
                project_id,
                target_shot.id,
                kind=ReferenceAssetKind.IMAGE,
                asset_id=reference_asset.id,
            )
            applied_shot_ids.append(target_shot.id)

        return StoryboardTailFrameReferenceApplyResponse(
            source_shot_id=source_shot.id,
            source_video_asset_id=source_video.id,
            reference_asset_id=reference_asset.id,
            applied_shot_ids=applied_shot_ids,
            skipped=skipped,
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "project, storyboard shot, or video asset not found",
        ) from exc


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/last-frame-reference-asset",
    response_model=Asset,
    tags=["storyboard-video"],
)
def ensure_storyboard_shot_last_frame_reference_asset(
    project_id: str,
    shot_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Asset:
    try:
        repository.get_project(project_id)
        source_shot = repository.get_storyboard_shot(project_id, shot_id)
        source_video, last_frame_object_key = _source_shot_last_frame_asset(
            repository,
            project_id=project_id,
            shot=source_shot,
        )
        reference_asset = _copy_last_frame_to_reference_asset(
            repository,
            asset_storage,
            project_id=project_id,
            source_shot=source_shot,
            source_video_asset=source_video,
            last_frame_object_key=last_frame_object_key,
        )
        return asset_storage.with_access_url(reference_asset)
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "project, storyboard shot, or video asset not found",
        ) from exc


@router.delete(
    "/projects/{project_id}/storyboard/shots/{shot_id}",
    response_model=Project,
    tags=["storyboard-video"],
)
def delete_storyboard_shot(
    project_id: str,
    shot_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        repository.delete_storyboard_shot(project_id, shot_id)
        workflow.mark_downstream_stale(project_id, Stage.STORYBOARD)
        return asset_storage.with_project_access_urls(
            repository.get_project(project_id)
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"storyboard shot not found: {shot_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/storyboard/shots/merge",
    response_model=Project,
    tags=["storyboard-video"],
)
def merge_storyboard_shots(
    project_id: str,
    payload: StoryboardShotMergeRequest,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        shots = repository.list_project_storyboard(project_id)
        shots_by_id = {shot.id: shot for shot in shots}

        for shot_id in payload.shot_ids:
            if shot_id not in shots_by_id:
                raise _http_error(
                    status.HTTP_404_NOT_FOUND,
                    ErrorCode.NOT_FOUND,
                    f"storyboard shot not found: {shot_id}",
                )

        selected = sorted(
            (shots_by_id[shot_id] for shot_id in payload.shot_ids),
            key=lambda item: item.index,
        )

        for previous, current in zip(selected, selected[1:]):
            if current.index - previous.index != 1:
                raise _http_error(
                    status.HTTP_400_BAD_REQUEST,
                    ErrorCode.VALIDATION_ERROR,
                    "only adjacent storyboard shots can be merged",
                )

        total = sum(shot.duration_seconds for shot in selected)
        if total > 30:
            raise _http_error(
                status.HTTP_400_BAD_REQUEST,
                ErrorCode.VALIDATION_ERROR,
                f"merged shot duration must not exceed 30 seconds (current {total:g}s)",
            )

        affected_shot_ids = [shot.id for shot in selected]
        affected_video_asset_ids = [
            shot.video_asset_id for shot in selected if shot.video_asset_id
        ]
        try:
            merged = repository.merge_storyboard_shots(project_id, payload.shot_ids)
        except ValueError as exc:
            raise _http_error(
                status.HTTP_400_BAD_REQUEST,
                ErrorCode.VALIDATION_ERROR,
                str(exc),
            ) from exc

        return _finalize_storyboard_structure_change(
            project_id,
            affected_shot_ids=[*affected_shot_ids, merged.id],
            affected_video_asset_ids=affected_video_asset_ids,
            repository=repository,
            asset_storage=asset_storage,
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"project not found: {project_id}",
        ) from exc


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/split",
    response_model=Project,
    tags=["storyboard-video"],
)
def split_storyboard_shot(
    project_id: str,
    shot_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Project:
    try:
        merged = repository.get_storyboard_shot(project_id, shot_id)
        affected_shot_ids = [
            shot_id,
            *(source.id for source in merged.merge_source_shots),
        ]
        affected_video_asset_ids = (
            [merged.video_asset_id] if merged.video_asset_id else []
        )
        try:
            repository.split_storyboard_shot(project_id, shot_id)
        except ValueError as exc:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.INVALID_STATE,
                str(exc),
            ) from exc
        return _finalize_storyboard_structure_change(
            project_id,
            affected_shot_ids=affected_shot_ids,
            affected_video_asset_ids=affected_video_asset_ids,
            repository=repository,
            asset_storage=asset_storage,
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"storyboard shot not found: {shot_id}",
        ) from exc


def _finalize_storyboard_structure_change(
    project_id: str,
    *,
    affected_shot_ids: Iterable[str],
    affected_video_asset_ids: Iterable[str] | None = None,
    repository: Repository,
    asset_storage: AssetStorageService,
) -> Project:
    artifact = repository.get_latest_text_artifact(
        project_id,
        Stage.STORYBOARD,
        include_stale=True,
    )
    if artifact is not None:
        updated_shots = repository.list_project_storyboard(project_id)
        repository.update_text_artifact(
            artifact.id,
            content=_storyboard_content_from_shots(updated_shots),
            title=artifact.title,
            version=artifact.version + 1,
            status=Status.SUCCEEDED,
        )
    repository.mark_storyboard_video_assets_stale(
        project_id,
        affected_shot_ids,
        asset_ids=affected_video_asset_ids,
    )
    repository.mark_assets_stale(project_id, [Stage.COMPOSE])
    return asset_storage.with_project_access_urls(
        repository.get_project(project_id)
    )


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/references/upload",
    response_model=StoryboardShotReferenceUploadResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["storyboard-video"],
)
async def upload_storyboard_shot_reference(
    project_id: str,
    shot_id: str,
    kind: ReferenceAssetKind = Query(...),
    filename: str | None = Query(default=None),
    mime_type: str | None = Query(default=None),
    content: bytes = Body(..., media_type="application/octet-stream"),
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> StoryboardShotReferenceUploadResponse:
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
        _validate_storyboard_video_input_mode(
            shot,
            adding_reference_media=True,
        )
        normalized_mime_type = _validate_uploaded_reference(
            kind,
            filename=filename,
            mime_type=mime_type,
            content_size=len(content),
        )
        asset = asset_storage.upload_asset(
            repository,
            StoredAssetInput(
                project_id=project_id,
                type=_uploaded_asset_type(kind),
                category=AssetCategory.REFERENCE,
                stage=Stage.VIDEO,
                status=Status.SUCCEEDED,
                mime_type=normalized_mime_type,
                size_bytes=len(content),
                filename=filename,
                metadata={
                    "reference_kind": kind.value,
                    "usage": "storyboard_video_reference",
                    "shot_id": shot_id,
                },
            ),
            content=content,
        )
        shot = repository.attach_storyboard_shot_reference(
            project_id,
            shot_id,
            kind=kind,
            asset_id=asset.id,
        )
        return StoryboardShotReferenceUploadResponse(
            asset_id=asset.id,
            config=_shot_video_config(shot, project.brief.target_language),
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"storyboard shot not found: {shot_id}",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "reference asset upload failed",
        ) from exc


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/first-frame/upload",
    response_model=StoryboardShotReferenceUploadResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["storyboard-video"],
)
async def upload_storyboard_shot_first_frame(
    project_id: str,
    shot_id: str,
    filename: str | None = Query(default=None),
    mime_type: str | None = Query(default=None),
    content: bytes = Body(..., media_type="application/octet-stream"),
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> StoryboardShotReferenceUploadResponse:
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
        _validate_storyboard_video_input_mode(shot, adding_first_frame=True)
        normalized_mime_type = _validate_uploaded_reference(
            ReferenceAssetKind.IMAGE,
            filename=filename,
            mime_type=mime_type,
            content_size=len(content),
        )
        asset = asset_storage.upload_asset(
            repository,
            StoredAssetInput(
                project_id=project_id,
                type=AssetType.UPLOADED_IMAGE,
                category=AssetCategory.REFERENCE,
                stage=Stage.VIDEO,
                status=Status.SUCCEEDED,
                mime_type=normalized_mime_type,
                size_bytes=len(content),
                filename=filename,
                metadata={
                    "reference_kind": "image",
                    "usage": "storyboard_video_first_frame",
                    "shot_id": shot_id,
                    "name": filename,
                },
            ),
            content=content,
        )
        shot = repository.set_storyboard_shot_first_frame(
            project_id,
            shot_id,
            asset_id=asset.id,
            source_video_asset_id=None,
        )
        return StoryboardShotReferenceUploadResponse(
            asset_id=asset.id,
            config=_shot_video_config(shot, project.brief.target_language),
        )
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"storyboard shot not found: {shot_id}",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "first frame upload failed",
        ) from exc


@router.post(
    "/projects/{project_id}/images",
    response_model=GenerationTask,
    tags=["generation"],
)
async def generate_images(
    project_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> GenerationTask:
    return await _run_stage(
        project_id,
        Stage.IMAGE,
        repository,
        workflow,
        lambda task: _generate_images(task, repository, workflow, generation),
    )


@router.post(
    "/projects/{project_id}/videos",
    response_model=GenerationTask,
    tags=["generation"],
)
async def generate_videos(
    project_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> GenerationTask:
    return await _run_stage(
        project_id,
        Stage.VIDEO,
        repository,
        workflow,
        lambda task: _generate_videos(task, repository, workflow, generation),
    )


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/generate-video",
    response_model=GenerationTask,
    tags=["storyboard-video"],
)
async def generate_storyboard_shot_video(
    project_id: str,
    shot_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> GenerationTask:
    return await _generate_single_storyboard_shot_video(
        project_id=project_id,
        shot_id=shot_id,
        repository=repository,
        workflow=workflow,
        generation=generation,
    )


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/edit-video",
    response_model=GenerationTask,
    tags=["storyboard-video"],
)
async def edit_storyboard_shot_video(
    project_id: str,
    shot_id: str,
    payload: StoryboardShotVideoEditRequest,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> GenerationTask:
    return await _edit_single_storyboard_shot_video(
        project_id=project_id,
        shot_id=shot_id,
        prompt=payload.prompt,
        repository=repository,
        workflow=workflow,
        generation=generation,
    )


@router.post(
    "/projects/{project_id}/storyboard/shots/{shot_id}/select-video",
    response_model=StoryboardShotVideoConfig,
    tags=["storyboard-video"],
)
def select_storyboard_shot_video(
    project_id: str,
    shot_id: str,
    payload: StoryboardShotVideoSelectionRequest,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
) -> StoryboardShotVideoConfig:
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
        candidate = repository.get_asset(payload.asset_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "storyboard shot or video candidate not found",
        ) from exc

    is_edit_candidate = (
        candidate.metadata.get("operation") == "video_edit"
        and candidate.metadata.get("source_shot_id") == shot.id
    )
    is_shot_video = candidate.metadata.get("shot_id") == shot.id
    if (
        candidate.project_id != project_id
        or candidate.type != AssetType.STORYBOARD_VIDEO
        or candidate.stage != Stage.VIDEO
        or candidate.status != Status.SUCCEEDED
        or not (is_edit_candidate or is_shot_video)
    ):
        raise _http_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            ErrorCode.VALIDATION_ERROR,
            "video candidate is not valid for this storyboard shot",
        )

    updated = repository.set_storyboard_shot_video_asset(
        project_id,
        shot.id,
        candidate.id,
    )
    workflow.mark_downstream_stale(project_id, Stage.VIDEO)
    return _shot_video_config(updated, project.brief.target_language)


@router.post(
    "/projects/{project_id}/storyboard/generate-video",
    response_model=GenerationTask,
    tags=["storyboard-video"],
)
async def generate_storyboard_shot_video_by_locator(
    project_id: str,
    payload: StoryboardShotGenerateVideoRequest,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
) -> GenerationTask:
    try:
        shot = (
            repository.get_storyboard_shot(project_id, payload.shot_id)
            if payload.shot_id is not None
            else repository.get_storyboard_shot_by_index(project_id, payload.shot_index or 0)
        )
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "storyboard shot not found",
        ) from exc
    return await _generate_single_storyboard_shot_video(
        project_id=project_id,
        shot_id=shot.id,
        repository=repository,
        workflow=workflow,
        generation=generation,
    )


@router.post(
    "/projects/{project_id}/compose",
    response_model=GenerationTask,
    tags=["generation"],
)
async def compose_video(
    project_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    composer: VideoComposer = Depends(get_composer_service),
    subtitle_client: AsrSubtitleClient = Depends(get_asr_subtitle_client),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
) -> GenerationTask:
    task: GenerationTask | None = None
    try:
        task = workflow.create_task(project_id, Stage.COMPOSE)
        if task.status == Status.RUNNING:
            return task
        if task.status == Status.SUCCEEDED:
            return task
        task = workflow.start_task(task.id)
        workflow.update_task_progress(
            task.id,
            progress=0.05,
            message="正在合成基础视频",
        )
        background_runner.schedule(
            _run_composition_task(
                task_id=task.id,
                repository=repository,
                workflow=workflow,
                composer=composer,
                subtitle_client=subtitle_client,
            )
        )
        return repository.get_task(task.id)
    except WorkflowError as exc:
        if task is not None and task.status in {Status.QUEUED, Status.RUNNING}:
            workflow.fail_task(
                task.id,
                code=exc.code,
                message=exc.message,
                detail=exc.detail,
            )
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            str(exc),
        ) from exc
    except Exception as exc:
        if task is not None and task.status in {Status.QUEUED, Status.RUNNING}:
            workflow.fail_task(
                task.id,
                message="composition failed",
                detail=type(exc).__name__,
            )
        raise _http_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.GENERATION_FAILED,
            "composition failed",
        ) from exc


@router.get("/tasks/{task_id}", response_model=GenerationTask, tags=["tasks"])
def get_task(
    task_id: str,
    repository: Repository = Depends(get_repository),
) -> GenerationTask:
    try:
        return repository.get_task(task_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"task not found: {task_id}",
        ) from exc


@router.post(
    "/tasks/{task_id}/retry",
    response_model=None,
    tags=["tasks"],
)
async def retry_task(
    task_id: str,
    repository: Repository = Depends(get_repository),
    workflow: WorkflowService = Depends(get_workflow_service),
    generation: ModelArkGenerationService = Depends(get_modelark_generation_service),
    composer: VideoComposer = Depends(get_composer_service),
    subtitle_client: AsrSubtitleClient = Depends(get_asr_subtitle_client),
    background_runner: BackgroundTaskRunner = Depends(get_background_task_runner),
) -> GenerationTask | StreamingResponse:
    try:
        failed_task = repository.get_task(task_id)
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            f"task not found: {task_id}",
        ) from exc

    if failed_task.status != Status.FAILED:
        raise _http_error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            f"task {task_id} is not failed and cannot be retried",
        )

    if (
        failed_task.stage == Stage.IMAGE
        and failed_task.frozen_input is not None
        and failed_task.frozen_input.get("kind") == "layer_composition"
    ):
        try:
            frozen_composition = FrozenImageLayerCompositionInput.model_validate(
                failed_task.frozen_input
            )
        except ValidationError as exc:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.INVALID_STATE,
                "failed layer composition task has no valid frozen input",
            ) from exc
        assert failed_task.input_hash is not None
        retry, created = repository.create_task_if_no_active_hash(
            GenerationTaskCreate(
                project_id=failed_task.project_id,
                stage=Stage.IMAGE,
                input_hash=failed_task.input_hash,
                frozen_input=failed_task.frozen_input,
                retry_of_task_id=failed_task.id,
            )
        )
        if not created:
            return retry
        background_runner.schedule(
            _run_image_layer_composition_task(
                task_id=retry.id,
                frozen=frozen_composition,
                repository=repository,
                workflow=workflow,
            )
        )
        return retry

    if (
        failed_task.stage == Stage.IMAGE
        and failed_task.frozen_input is not None
        and failed_task.frozen_input.get("kind") == "layer_decomposition"
    ):
        try:
            frozen_layers = FrozenImageLayerDecompositionInput.model_validate(
                failed_task.frozen_input
            )
        except ValidationError as exc:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.INVALID_STATE,
                "failed layer decomposition task has no valid frozen input",
            ) from exc
        assert failed_task.input_hash is not None
        retry, created = repository.create_task_if_no_active_hash(
            GenerationTaskCreate(
                project_id=failed_task.project_id,
                stage=Stage.IMAGE,
                input_hash=failed_task.input_hash,
                frozen_input=failed_task.frozen_input,
                retry_of_task_id=failed_task.id,
            )
        )
        if not created:
            return retry
        background_runner.schedule(
            _run_image_layer_decomposition_task(
                task_id=retry.id,
                frozen=frozen_layers,
                repository=repository,
                workflow=workflow,
                generation=generation,
            )
        )
        return retry

    if failed_task.stage == Stage.IMAGE and failed_task.frozen_input is not None:
        try:
            frozen = FrozenImageGenerationInput.model_validate(
                failed_task.frozen_input
            )
        except ValidationError as exc:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.INVALID_STATE,
                "failed image task has no valid frozen input",
            ) from exc
        assert failed_task.input_hash is not None
        retry, created = repository.create_task_if_no_active_hash(
            GenerationTaskCreate(
                project_id=failed_task.project_id,
                stage=Stage.IMAGE,
                input_hash=failed_task.input_hash,
                frozen_input=failed_task.frozen_input,
                retry_of_task_id=failed_task.id,
            )
        )
        if not created:
            return retry
        background_runner.schedule(
            _run_image_generation_task(
                task_id=retry.id,
                frozen=frozen,
                repository=repository,
                workflow=workflow,
                generation=generation,
            )
        )
        return retry

    if failed_task.stage in {Stage.STORY, Stage.SCRIPT, Stage.STORYBOARD}:
        task = _start_stream_task(
            failed_task.project_id,
            failed_task.stage,
            workflow,
        )
        if failed_task.stage == Stage.STORY:
            return _sse_response(
                _stream_story_task(task, repository, workflow, generation)
            )
        if failed_task.stage == Stage.SCRIPT:
            return _sse_response(
                _stream_script_task(task, repository, workflow, generation)
            )
        return _sse_response(
            _stream_storyboard_task(task, repository, workflow, generation)
        )

    return await _dispatch_stage(
        failed_task.project_id,
        failed_task.stage,
        repository,
        workflow,
        generation,
        composer,
        subtitle_client,
    )


async def _dispatch_stage(
    project_id: str,
    stage: Stage,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
    composer: VideoComposer,
    subtitle_client: AsrSubtitleClient | None = None,
) -> GenerationTask:
    if stage == Stage.STORY:
        return await _run_stage(
            project_id,
            stage,
            repository,
            workflow,
            lambda task: _generate_story(task, repository, workflow, generation),
        )
    if stage == Stage.CHARACTER:
        return await _run_stage(
            project_id,
            stage,
            repository,
            workflow,
            lambda task: _generate_characters(task, repository, workflow, generation),
        )
    if stage == Stage.SCRIPT:
        return await _run_stage(
            project_id,
            stage,
            repository,
            workflow,
            lambda task: _generate_script(task, repository, workflow, generation),
        )
    if stage == Stage.STORYBOARD:
        return await _run_stage(
            project_id,
            stage,
            repository,
            workflow,
            lambda task: _generate_storyboard(task, repository, workflow, generation),
        )
    if stage == Stage.IMAGE:
        return await _run_stage(
            project_id,
            stage,
            repository,
            workflow,
            lambda task: _generate_images(task, repository, workflow, generation),
        )
    if stage == Stage.VIDEO:
        return await _run_stage(
            project_id,
            stage,
            repository,
            workflow,
            lambda task: _generate_videos(task, repository, workflow, generation),
        )
    if stage == Stage.COMPOSE:
        return await _run_stage(
            project_id,
            stage,
            repository,
            workflow,
            lambda task: _generate_composition(
                task,
                repository,
                workflow,
                composer,
                subtitle_client=subtitle_client,
            ),
        )

    raise _http_error(
        status.HTTP_409_CONFLICT,
        ErrorCode.INVALID_STATE,
        f"{stage.value} is not a retryable generation stage",
    )


def _sse_response(content: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(
        content,
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


def _start_stream_task(
    project_id: str,
    stage: Stage,
    workflow: WorkflowService,
) -> GenerationTask:
    try:
        task = workflow.create_task(project_id, stage)
        if task.status == Status.RUNNING:
            raise WorkflowError(
                ErrorCode.TASK_CONFLICT,
                f"{stage.value} generation task is already active",
                detail=f"task_id={task.id}",
            )
        return workflow.start_task(task.id)
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc


async def _stream_story_task(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
    *,
    image_urls: list[str] | None = None,
) -> AsyncIterator[str]:
    project = repository.get_project(task.project_id)
    if hasattr(generation, "stream_story"):
        events = generation.stream_story(
            task.project_id,
            project.brief,
            image_urls=image_urls,
        )
    else:
        async def legacy_story_events() -> AsyncIterator[GenerationStreamEvent]:
            result = await generation.generate_story(
                task.project_id,
                project.brief,
                image_urls=image_urls,
            )
            yield GenerationStreamEvent(kind="delta", delta=result.content)
            yield GenerationStreamEvent(kind="completed", result=result)

        events = legacy_story_events()

    def complete(result: object) -> GenerationTask:
        if not isinstance(result, TextArtifactCreate):
            raise ModelArkTextParseError("story stream returned no artifact")
        workflow.write_text_artifact(
            task.project_id,
            Stage.STORY,
            content=result.content,
            title=result.title,
            task_id=task.id,
        )
        return repository.get_task(task.id)

    async for chunk in _stream_generation_task(task, events, complete, repository, workflow):
        yield chunk


async def _stream_script_task(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
    *,
    image_urls: list[str] | None = None,
) -> AsyncIterator[str]:
    project = repository.get_project(task.project_id)
    story = workflow.require_fresh_text_artifact(task.project_id, Stage.STORY)
    if hasattr(generation, "stream_script"):
        events = generation.stream_script(
            task.project_id,
            project.brief,
            story.content,
            image_urls=image_urls,
        )
    else:
        async def legacy_script_events() -> AsyncIterator[GenerationStreamEvent]:
            result = await generation.generate_script(
                task.project_id,
                project.brief,
                story.content,
                image_urls=image_urls,
            )
            yield GenerationStreamEvent(kind="delta", delta=result.content)
            yield GenerationStreamEvent(kind="completed", result=result)

        events = legacy_script_events()

    def complete(result: object) -> GenerationTask:
        if not isinstance(result, TextArtifactCreate):
            raise ModelArkTextParseError("script stream returned no artifact")
        workflow.write_text_artifact(
            task.project_id,
            Stage.SCRIPT,
            content=result.content,
            title=result.title,
            task_id=task.id,
        )
        return repository.get_task(task.id)

    async for chunk in _stream_generation_task(task, events, complete, repository, workflow):
        yield chunk


async def _stream_storyboard_task(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
    *,
    image_urls: list[str] | None = None,
) -> AsyncIterator[str]:
    project = repository.get_project(task.project_id)
    script = workflow.require_fresh_text_artifact(task.project_id, Stage.SCRIPT)
    if hasattr(generation, "stream_storyboard"):
        events = generation.stream_storyboard(
            task.project_id,
            project.brief,
            script.content,
            image_urls=image_urls,
        )
    else:
        async def legacy_storyboard_events() -> AsyncIterator[GenerationStreamEvent]:
            result = await generation.generate_storyboard(
                task.project_id,
                project.brief,
                script.content,
                image_urls=image_urls,
            )
            yield GenerationStreamEvent(
                kind="delta",
                delta=result.artifact.content,
            )
            yield GenerationStreamEvent(kind="completed", result=result)

        events = legacy_storyboard_events()

    def complete(result: object) -> GenerationTask:
        if not isinstance(result, StoryboardGenerationResult):
            raise ModelArkTextParseError("storyboard stream returned no result")
        artifact = workflow.write_text_artifact(
            task.project_id,
            Stage.STORYBOARD,
            content=result.artifact.content,
            title=result.artifact.title,
        )
        repository.replace_project_storyboard(task.project_id, result.shots)
        return workflow.complete_task(
            task.id,
            output_text_artifact_id=artifact.id,
        )

    async for chunk in _stream_generation_task(task, events, complete, repository, workflow):
        yield chunk


async def _stream_generation_task(
    task: GenerationTask,
    events: AsyncIterator[GenerationStreamEvent],
    complete: Callable[[object], GenerationTask],
    repository: Repository,
    workflow: WorkflowService,
) -> AsyncIterator[str]:
    yield encode_sse("task", {"task": task.model_dump(mode="json")})
    completed = False
    try:
        async for event in events:
            if event.kind == "delta":
                if event.delta:
                    yield encode_sse("delta", {"text": event.delta})
                continue
            completed_task = complete(event.result)
            completed = True
            yield encode_sse(
                "complete",
                {"task": completed_task.model_dump(mode="json")},
            )
        if not completed:
            raise ModelArkTextParseError("generation stream ended without a result")
    except asyncio.CancelledError:
        _fail_active_stream_task(
            task.id,
            repository,
            workflow,
            detail="client_disconnected",
        )
        raise
    except Exception as exc:
        failed = _fail_active_stream_task(
            task.id,
            repository,
            workflow,
            detail=_safe_stream_error_detail(exc),
        )
        logger.error(
            "text_generation_stream_failed %s",
            json.dumps(
                {
                    "project_id": task.project_id,
                    "stage": task.stage.value,
                    "task_id": task.id,
                    "error_type": type(exc).__name__,
                },
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        yield encode_sse(
            "error",
            _stream_error_payload(
                failed.error.code if failed.error else ErrorCode.GENERATION_FAILED,
                failed.error.message if failed.error else "generation failed",
                failed.error.detail if failed.error else None,
            ),
        )


async def _stream_video_prompt_optimization(
    events: AsyncIterator[GenerationStreamEvent],
    project_id: str,
    shot_id: str,
) -> AsyncIterator[str]:
    completed = False
    try:
        async for event in events:
            if event.kind == "delta":
                if event.delta:
                    yield encode_sse("delta", {"text": event.delta})
                continue
            if not isinstance(event.result, str):
                raise ModelArkTextParseError(
                    "video prompt optimization returned no prompt"
                )
            completed = True
            yield encode_sse(
                "complete",
                {"optimized_prompt": event.result},
            )
        if not completed:
            raise ModelArkTextParseError(
                "video prompt optimization stream ended without a result"
            )
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.error(
            "video_prompt_optimization_stream_failed %s",
            json.dumps(
                {
                    "project_id": project_id,
                    "shot_id": shot_id,
                    "error_type": type(exc).__name__,
                },
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        yield encode_sse(
            "error",
            _stream_error_payload(
                ErrorCode.GENERATION_FAILED,
                "storyboard video prompt optimization failed",
                _safe_stream_error_detail(exc),
            ),
        )


def _fail_active_stream_task(
    task_id: str,
    repository: Repository,
    workflow: WorkflowService,
    *,
    detail: str | None,
) -> GenerationTask:
    current = repository.get_task(task_id)
    if current.status in {Status.QUEUED, Status.RUNNING}:
        return workflow.fail_task(
            task_id,
            message="generation failed",
            detail=detail,
        )
    return current


def _safe_stream_error_detail(exc: Exception) -> str:
    if isinstance(exc, ModelArkProviderError):
        return exc.safe_detail()
    if isinstance(exc, WorkflowError):
        return exc.detail or type(exc).__name__
    return type(exc).__name__


def _stream_error_payload(
    code: ErrorCode,
    message: str,
    detail: str | None,
) -> dict[str, str]:
    payload = {"code": code.value, "message": message}
    if detail:
        payload["detail"] = detail
    return payload


async def _run_stage(
    project_id: str,
    stage: Stage,
    repository: Repository,
    workflow: WorkflowService,
    handler: Callable[[GenerationTask], Awaitable[GenerationTask]],
) -> GenerationTask:
    task: GenerationTask | None = None
    try:
        task = workflow.create_task(project_id, stage)
        if task.status == Status.RUNNING:
            return task
        if task.status == Status.SUCCEEDED:
            return task
        task = workflow.start_task(task.id)
        return await handler(task)
    except WorkflowError as exc:
        try:
            failed_task = repository.get_task(task.id) if task is not None else None
        except NotFoundError:
            failed_task = None
        if (
            failed_task is not None
            and failed_task.status in {Status.QUEUED, Status.RUNNING}
        ):
            workflow.fail_task(
                failed_task.id,
                code=exc.code,
                message=exc.message,
                detail=exc.detail,
            )
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            str(exc),
        ) from exc
    except Exception as exc:
        try:
            failed_task = repository.get_task(task.id) if task is not None else None
        except NotFoundError:
            failed_task = None
        if (
            failed_task is not None
            and failed_task.status in {Status.QUEUED, Status.RUNNING}
        ):
            workflow.fail_task(
                failed_task.id,
                message="generation failed",
                detail=type(exc).__name__,
            )
        raise _http_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.GENERATION_FAILED,
            "generation failed",
        ) from exc


async def _generate_story(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
    *,
    image_urls: list[str] | None = None,
) -> GenerationTask:
    project = repository.get_project(task.project_id)
    artifact = await generation.generate_story(
        task.project_id,
        project.brief,
        image_urls=image_urls,
    )
    workflow.write_text_artifact(
        task.project_id,
        Stage.STORY,
        content=artifact.content,
        title=artifact.title,
        task_id=task.id,
    )
    return repository.get_task(task.id)


async def _generate_characters(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> GenerationTask:
    project = repository.get_project(task.project_id)
    story = workflow.require_fresh_text_artifact(task.project_id, Stage.STORY)
    try:
        result = await generation.generate_character_cards(
            task.project_id,
            project.brief,
            story.content,
        )
    except ModelArkTextParseError as exc:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "当前故事未识别到角色，请先在故事内容中补充具体人物后再生成角色。",
            detail=type(exc).__name__,
        ) from exc
    if not result.cards:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "当前故事未识别到角色，请先在故事内容中补充具体人物后再生成角色。",
            detail="empty_character_list",
        )
    existing_cards = repository.list_project_character_cards(task.project_id)
    created_cards: list[CharacterCard] = []
    try:
        for card in existing_cards:
            repository.delete_character_card(task.project_id, card.id)
        for card in result.cards:
            created_cards.append(repository.create_character_card(card))
    except Exception:
        for card in created_cards:
            try:
                repository.delete_character_card(task.project_id, card.id)
            except Exception:
                pass
        raise
    return workflow.complete_task(task.id, output_asset_ids=[])


async def _generate_script(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
    *,
    image_urls: list[str] | None = None,
) -> GenerationTask:
    project = repository.get_project(task.project_id)
    story = workflow.require_fresh_text_artifact(task.project_id, Stage.STORY)
    artifact = await generation.generate_script(
        task.project_id,
        project.brief,
        story.content,
        image_urls=image_urls,
    )
    workflow.write_text_artifact(
        task.project_id,
        Stage.SCRIPT,
        content=artifact.content,
        title=artifact.title,
        task_id=task.id,
    )
    return repository.get_task(task.id)


async def _generate_storyboard(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
    *,
    image_urls: list[str] | None = None,
) -> GenerationTask:
    project = repository.get_project(task.project_id)
    script = workflow.require_fresh_text_artifact(task.project_id, Stage.SCRIPT)
    result = await generation.generate_storyboard(
        task.project_id,
        project.brief,
        script.content,
        image_urls=image_urls,
    )
    artifact = workflow.write_text_artifact(
        task.project_id,
        Stage.STORYBOARD,
        content=result.artifact.content,
        title=result.artifact.title,
    )
    repository.replace_project_storyboard(task.project_id, result.shots)
    workflow.complete_task(task.id, output_text_artifact_id=artifact.id)
    return repository.get_task(task.id)


async def _generate_images(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> GenerationTask:
    project = repository.get_project(task.project_id)
    shots = repository.list_project_storyboard(task.project_id)
    if not shots:
        raise WorkflowError(
            ErrorCode.DEPENDENCY_MISSING,
            "missing storyboard shots",
            detail=f"project_id={task.project_id}",
        )

    result = await generation.generate_image_assets(
        task.project_id,
        project.brief,
        _to_shot_create_list(shots),
    )
    asset_ids = [
        workflow.create_asset(
            task.project_id,
            asset.type,
            stage=Stage.IMAGE,
            category=AssetCategory.SCENE,
            status=asset.status,
            url=asset.url,
            mime_type=asset.mime_type,
            source_task_id=task.id,
            metadata=asset.metadata,
        ).id
        for asset in result.assets
    ]
    return workflow.complete_task(task.id, output_asset_ids=asset_ids)


async def _generate_videos(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> GenerationTask:
    project = repository.get_project(task.project_id)
    shots = repository.list_project_storyboard(task.project_id)
    image_assets = [
        asset
        for asset in repository.list_project_assets(task.project_id)
        if asset.stage == Stage.IMAGE and asset.status == Status.SUCCEEDED
    ]
    result = await generation.generate_video_assets(
        task.project_id,
        project.brief,
        _to_shot_create_list(shots),
        image_assets,
    )
    asset_ids = [
        workflow.create_asset(
            task.project_id,
            asset.type,
            stage=Stage.VIDEO,
            status=asset.status,
            url=asset.url,
            mime_type=asset.mime_type,
            source_task_id=task.id,
            metadata=asset.metadata,
        ).id
        for asset in result.assets
    ]
    return workflow.complete_task(task.id, output_asset_ids=asset_ids)


async def _edit_single_storyboard_shot_video(
    *,
    project_id: str,
    shot_id: str,
    prompt: str,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> GenerationTask:
    task: GenerationTask | None = None
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
        if not shot.video_asset_id:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                "storyboard shot has no video to edit",
            )
        source = repository.get_asset(shot.video_asset_id)
        if (
            source.project_id != project_id
            or source.type != AssetType.STORYBOARD_VIDEO
            or source.stage != Stage.VIDEO
            or source.status != Status.SUCCEEDED
        ):
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                "current storyboard video is not editable",
            )
        source_url = workflow.asset_storage.signed_access_url(source)
        if source_url is None:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                "current storyboard video is not accessible",
            )

        input_hash = hashlib.sha256(
            json.dumps(
                {
                    "operation": "video_edit",
                    "project_id": project_id,
                    "shot_id": shot.id,
                    "source_asset": _asset_hash_payload(source),
                    "prompt": prompt,
                    "aspect_ratio": project.brief.aspect_ratio,
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        active_task = repository.find_active_task(project_id, Stage.VIDEO)
        if active_task is not None:
            if active_task.input_hash == input_hash:
                return active_task
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.TASK_CONFLICT,
                "another storyboard video task is already active",
            )

        task = repository.create_task(
            GenerationTaskCreate(
                project_id=project_id,
                stage=Stage.VIDEO,
                input_hash=input_hash,
                frozen_input={
                    "kind": "storyboard_shot_video_edit",
                    "shot_id": shot.id,
                },
            )
        )
        workflow.start_task(task.id)
        generated = await generation.edit_storyboard_shot_video_asset(
            project_id,
            project.brief,
            StoryboardShotCreate(
                **shot.model_dump(
                    exclude={"id", "created_at", "updated_at"},
                    exclude_computed_fields=True,
                )
            ),
            source_video_url=source_url,
            prompt=prompt,
        )
        created_assets = await workflow.create_assets_from_sources(
            project_id,
            [
                StoredAssetInput(
                    project_id=project_id,
                    type=generated.asset.type,
                    stage=Stage.VIDEO,
                    status=generated.asset.status,
                    source_url=generated.asset.url,
                    mime_type=generated.asset.mime_type,
                    source_task_id=task.id,
                    metadata={
                        **generated.asset.metadata,
                        "operation": "video_edit",
                        "source_asset_id": source.id,
                        "source_shot_id": shot.id,
                        "shot_id": shot.id,
                        "shot_index": shot.index,
                        "edit_prompt": prompt,
                    },
                )
            ],
            stage=Stage.VIDEO,
        )
        created = created_assets[0]
        if generated.last_frame_url:
            try:
                created = (
                    await workflow.asset_storage.upload_asset_companion_from_source(
                        repository,
                        created,
                        source_url=generated.last_frame_url,
                        suffix="last-frame",
                        expected_mime_type="image/*",
                        metadata_prefix="last_frame",
                    )
                )
                _copy_available_last_frame_to_reference_asset(
                    repository,
                    workflow.asset_storage,
                    project_id=project_id,
                    source_shot=shot,
                    source_video_asset=created,
                )
            except Exception as exc:
                created = repository.update_asset(
                    created.id,
                    metadata={
                        **created.metadata,
                        "last_frame_status": "unavailable",
                        "last_frame_error_type": type(exc).__name__,
                    },
                )
        return workflow.complete_task(task.id, output_asset_ids=[created.id])
    except HTTPException:
        if task is not None:
            _fail_running_task(workflow, repository, task.id)
        raise
    except NotFoundError as exc:
        if task is not None:
            _fail_running_task(workflow, repository, task.id, detail="NotFoundError")
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "storyboard shot or current video not found",
        ) from exc
    except WorkflowError as exc:
        if task is not None:
            _fail_running_task(
                workflow,
                repository,
                task.id,
                code=exc.code,
                detail=exc.detail or exc.code.value,
            )
        raise _workflow_http_error(exc) from exc
    except Exception as exc:
        safe_detail = type(exc).__name__
        if isinstance(exc, ModelArkProviderError):
            safe_detail = exc.safe_detail()
            logger.error(
                "modelark_video_edit_failed %s",
                json.dumps(
                    {
                        "local_task_id": task.id if task is not None else None,
                        "project_id": project_id,
                        "shot_id": shot_id,
                        **exc.safe_log_fields(),
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                ),
            )
        if task is not None:
            _fail_running_task(
                workflow,
                repository,
                task.id,
                detail=safe_detail,
            )
        raise _http_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.GENERATION_FAILED,
            "storyboard shot video edit failed",
            safe_detail if isinstance(exc, ModelArkProviderError) else None,
        ) from exc


async def _generate_single_storyboard_shot_video(
    *,
    project_id: str,
    shot_id: str,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> GenerationTask:
    task: GenerationTask | None = None
    try:
        project = repository.get_project(project_id)
        shot = repository.get_storyboard_shot(project_id, shot_id)
        _validate_storyboard_video_input_mode(shot)
        reference_image_assets = _reference_assets(
            repository,
            project_id,
            ReferenceAssetKind.IMAGE,
            shot.reference_image_asset_ids,
        )
        reference_video_assets = _reference_assets(
            repository,
            project_id,
            ReferenceAssetKind.VIDEO,
            shot.reference_video_asset_ids,
        )
        reference_audio_assets = _reference_assets(
            repository,
            project_id,
            ReferenceAssetKind.AUDIO,
            shot.reference_audio_asset_ids,
        )
        first_frame_asset = (
            repository.get_asset(shot.first_frame_asset_id)
            if shot.first_frame_asset_id
            else None
        )
        first_frame_source_video_asset: Asset | None = None
        first_frame_source_object_key: str | None = None
        if first_frame_asset is not None:
            _validate_reference_asset(
                first_frame_asset,
                project_id=project_id,
                kind=ReferenceAssetKind.IMAGE,
            )
        elif shot.first_frame_source_video_asset_id is not None:
            (
                first_frame_source_video_asset,
                first_frame_source_object_key,
            ) = _previous_shot_last_frame_asset(
                repository,
                project_id=project_id,
                shot=shot,
                source_video_asset_id=shot.first_frame_source_video_asset_id,
            )
        if first_frame_asset is not None:
            first_frame_url = workflow.asset_storage.signed_access_url(
                first_frame_asset
            )
        elif first_frame_source_object_key is not None:
            first_frame_url = workflow.asset_storage.signed_url_for_key(
                first_frame_source_object_key
            )
        else:
            first_frame_url = None
        if (
            shot.first_frame_asset_id is not None
            or shot.first_frame_source_video_asset_id is not None
        ) and first_frame_url is None:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                "first frame is not accessible",
            )
        accessible_reference_image_urls = [
            url
            for asset in reference_image_assets
            if (url := workflow.asset_storage.signed_access_url(asset)) is not None
        ]
        accessible_reference_video_urls = [
            url
            for asset in reference_video_assets
            if (url := workflow.asset_storage.signed_access_url(asset)) is not None
        ]
        accessible_reference_audio_urls = [
            url
            for asset in reference_audio_assets
            if (url := workflow.asset_storage.signed_access_url(asset)) is not None
        ]
        resolved_video_prompt = normalize_video_prompt(
            shot,
            shot.video_prompt,
            target_language=project.brief.target_language,
        )
        input_hash = _single_shot_video_input_hash(
            project_id=project_id,
            shot=shot,
            brief=project.brief.model_dump(mode="json"),
            resolved_video_prompt=resolved_video_prompt,
            reference_image_assets=reference_image_assets,
            reference_video_assets=reference_video_assets,
            reference_audio_assets=reference_audio_assets,
            first_frame_asset=first_frame_asset,
            first_frame_source_video_asset=first_frame_source_video_asset,
        )

        active_task = repository.find_active_task(project_id, Stage.VIDEO)
        if active_task is not None:
            if active_task.input_hash == input_hash:
                return active_task
            raise _http_error(
                status.HTTP_409_CONFLICT,
                ErrorCode.TASK_CONFLICT,
                "another storyboard video task is already active",
            )

        task = repository.create_task(
            GenerationTaskCreate(
                project_id=project_id,
                stage=Stage.VIDEO,
                input_hash=input_hash,
                frozen_input={
                    "kind": "storyboard_shot_video_generation",
                    "shot_id": shot.id,
                },
            )
        )
        workflow.start_task(task.id)
        generated = await generation.generate_storyboard_shot_video_asset(
            project_id,
            project.brief,
            StoryboardShotCreate(
                **shot.model_dump(
                    exclude={"id", "created_at", "updated_at"},
                    exclude_computed_fields=True,
                )
            ),
            first_frame_url=first_frame_url,
            video_prompt=resolved_video_prompt,
            reference_image_urls=accessible_reference_image_urls,
            reference_video_urls=accessible_reference_video_urls,
            reference_audio_urls=accessible_reference_audio_urls,
        )
        created_assets = await workflow.create_assets_from_sources(
            project_id,
            [
                StoredAssetInput(
                    project_id=project_id,
                    type=generated.asset.type,
                    stage=Stage.VIDEO,
                    status=generated.asset.status,
                    source_url=generated.asset.url,
                    mime_type=generated.asset.mime_type,
                    source_task_id=task.id,
                    metadata={
                        **generated.asset.metadata,
                        "shot_id": shot.id,
                        "shot_index": shot.index,
                        "video_prompt": resolved_video_prompt,
                        "first_frame_asset_id": shot.first_frame_asset_id,
                        "first_frame_source_video_asset_id": (
                            shot.first_frame_source_video_asset_id
                        ),
                        "uses_first_frame": bool(first_frame_url),
                        "reference_image_asset_ids": ",".join(
                            shot.reference_image_asset_ids
                        ),
                        "reference_video_asset_ids": ",".join(
                            shot.reference_video_asset_ids
                        ),
                        "reference_audio_asset_ids": ",".join(
                            shot.reference_audio_asset_ids
                        ),
                        "reference_image_count": len(
                            shot.reference_image_asset_ids
                        ),
                        "reference_video_count": len(
                            shot.reference_video_asset_ids
                        ),
                        "reference_audio_count": len(
                            shot.reference_audio_asset_ids
                        ),
                    },
                )
            ],
            stage=Stage.VIDEO,
        )
        created = created_assets[0]
        repository.set_storyboard_shot_video_asset(project_id, shot.id, created.id)
        if generated.last_frame_url:
            try:
                created = await workflow.asset_storage.upload_asset_companion_from_source(
                    repository,
                    created,
                    source_url=generated.last_frame_url,
                    suffix="last-frame",
                    expected_mime_type="image/*",
                    metadata_prefix="last_frame",
                )
                _copy_available_last_frame_to_reference_asset(
                    repository,
                    workflow.asset_storage,
                    project_id=project_id,
                    source_shot=shot,
                    source_video_asset=created,
                )
            except Exception as exc:
                created = repository.update_asset(
                    created.id,
                    metadata={
                        **created.metadata,
                        "last_frame_status": "unavailable",
                        "last_frame_error_type": type(exc).__name__,
                    },
                )
        else:
            created = repository.update_asset(
                created.id,
                metadata={
                    **created.metadata,
                    "last_frame_status": "unavailable",
                    "last_frame_error_type": "MissingProviderUrl",
                },
            )
        return workflow.complete_task(task.id, output_asset_ids=[created.id])
    except HTTPException:
        if task is not None:
            _fail_running_task(workflow, repository, task.id)
        raise
    except NotFoundError as exc:
        if task is not None:
            _fail_running_task(workflow, repository, task.id, detail="NotFoundError")
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "storyboard shot not found",
        ) from exc
    except WorkflowError as exc:
        if task is not None:
            _fail_running_task(
                workflow,
                repository,
                task.id,
                code=exc.code,
                detail=exc.code.value,
            )
        raise _workflow_http_error(exc) from exc
    except Exception as exc:
        safe_detail = type(exc).__name__
        if isinstance(exc, ModelArkProviderError):
            safe_detail = exc.safe_detail()
            logger.error(
                "modelark_video_generation_failed %s",
                json.dumps(
                    {
                        "local_task_id": task.id if task is not None else None,
                        "project_id": project_id,
                        "shot_id": shot_id,
                        **exc.safe_log_fields(),
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                ),
            )
        if task is not None:
            _fail_running_task(
                workflow,
                repository,
                task.id,
                detail=safe_detail,
            )
        raise _http_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.GENERATION_FAILED,
            "storyboard shot video generation failed",
            safe_detail if isinstance(exc, ModelArkProviderError) else None,
        ) from exc


async def _generate_composition(
    task: GenerationTask,
    repository: Repository,
    workflow: WorkflowService,
    composer: VideoComposer,
    *,
    subtitle_client: AsrSubtitleClient | None = None,
) -> GenerationTask:
    project = repository.get_project(task.project_id)
    video_assets = _current_storyboard_video_assets(
        repository,
        task.project_id,
        project.storyboard,
    )
    if not video_assets:
        raise WorkflowError(
            ErrorCode.DEPENDENCY_MISSING,
            "no storyboard videos are available for composition",
            "source_video_count=0",
        )

    sources: list[CompositionSource] = []
    for shot_index, shot_id, asset in video_assets:
        source_url = workflow.asset_storage.signed_access_url(asset)
        if not source_url:
            raise WorkflowError(
                ErrorCode.DEPENDENCY_MISSING,
                "storyboard video is not available for composition",
                f"shot_id={shot_id}; asset_id={asset.id}",
            )
        sources.append(
            CompositionSource(
                asset_id=asset.id,
                url=source_url,
                index=shot_index,
            )
        )

    temp_object_key: str | None = None
    try:
        workflow.update_task_progress(
            task.id,
            progress=0.12,
            message="正在合成基础视频",
        )
        composed = await composer.compose(
            project_id=task.project_id,
            brief=project.brief,
            sources=sources,
        )

        srt_text = ""
        subtitle_metadata: dict[str, str | int | float | bool | None] = {
            "provider": "mediakit-asr",
            "subtitle_status": "skipped",
            "segment_count": 0,
        }
        if subtitle_client is not None:
            workflow.update_task_progress(
                task.id,
                progress=0.45,
                message="视频字幕提取中",
            )
            temp_object_key, asr_source_url = _upload_temporary_asr_source(
                workflow,
                project_id=task.project_id,
                task_id=task.id,
                content=composed.content,
                mime_type=composed.mime_type,
            )
            segments = await subtitle_client.transcribe(video_url=asr_source_url)
            srt_text = segments_to_srt(segments)
            subtitle_metadata = {
                "provider": "mediakit-asr",
                "subtitle_status": "available" if srt_text else "empty",
                "segment_count": len(segments),
            }

        workflow.update_task_progress(
            task.id,
            progress=0.68,
            message=(
                "字幕 SRT 文件提取完成"
                if srt_text
                else "未检测到语音字幕，跳过字幕压制"
            ),
        )
        if srt_text:
            workflow.update_task_progress(
                task.id,
                progress=0.82,
                message="字幕压制中",
            )
        final_composed = await composer.burn_subtitles(
            base_video=composed.content,
            srt_text=srt_text,
            brief=project.brief,
        )
    except ConfigurationError as exc:
        raise WorkflowError(
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            str(exc),
            "provider=ffmpeg-composer; phase=configure",
        ) from exc
    except VideoCompositionError as exc:
        raise WorkflowError(
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            str(exc),
            exc.detail,
        ) from exc
    except MediaKitAsrError as exc:
        raise WorkflowError(
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "MediaKit ASR subtitle extraction failed",
            exc.detail,
        ) from exc
    finally:
        if temp_object_key and workflow.asset_storage.client is not None:
            try:
                workflow.asset_storage.client.delete_object(key=temp_object_key)
            except Exception:
                pass

    created_video = workflow.asset_storage.upload_asset(
        repository,
        StoredAssetInput(
            project_id=task.project_id,
            type=AssetType.FINAL_VIDEO,
            stage=Stage.COMPOSE,
            status=Status.SUCCEEDED,
            mime_type=final_composed.mime_type,
            filename="final-video.mp4",
            source_task_id=task.id,
            metadata={
                **composed.metadata,
                **final_composed.metadata,
            },
        ),
        content=final_composed.content,
    )
    created_subtitle = workflow.asset_storage.upload_asset(
        repository,
        StoredAssetInput(
            project_id=task.project_id,
            type=AssetType.SUBTITLE,
            stage=Stage.COMPOSE,
            status=Status.SUCCEEDED,
            mime_type="application/x-subrip",
            filename="final-video.srt",
            source_task_id=task.id,
            metadata={
                **subtitle_metadata,
                "final_video_asset_id": created_video.id,
            },
        ),
        content=srt_text.encode("utf-8"),
    )
    workflow.update_task_progress(
        task.id,
        progress=0.92,
        message="剪辑完成",
    )
    return workflow.complete_task(
        task.id,
        output_asset_ids=[created_video.id, created_subtitle.id],
    )


async def _run_composition_task(
    *,
    task_id: str,
    repository: Repository,
    workflow: WorkflowService,
    composer: VideoComposer,
    subtitle_client: AsrSubtitleClient,
) -> None:
    try:
        task = repository.get_task(task_id)
        await _generate_composition(
            task,
            repository,
            workflow,
            composer,
            subtitle_client=subtitle_client,
        )
    except WorkflowError as exc:
        workflow.fail_task(
            task_id,
            code=exc.code,
            message=exc.message,
            detail=exc.detail,
        )
    except NotFoundError:
        workflow.fail_task(
            task_id,
            code=ErrorCode.NOT_FOUND,
            message="composition failed",
            detail="NotFoundError",
        )
    except Exception as exc:
        workflow.fail_task(
            task_id,
            message="composition failed",
            detail=type(exc).__name__,
        )


def _upload_temporary_asr_source(
    workflow: WorkflowService,
    *,
    project_id: str,
    task_id: str,
    content: bytes,
    mime_type: str,
) -> tuple[str, str]:
    if workflow.asset_storage.client is None:
        raise ConfigurationError("TOS client is not configured for ASR source upload.")
    object_key = workflow.asset_storage.generate_object_key(
        project_id=project_id,
        asset_id=f"{task_id}-asr-source-{uuid4().hex[:8]}",
        asset_type=AssetType.FINAL_VIDEO,
        stage=Stage.COMPOSE,
        filename="asr-source.mp4",
        mime_type=mime_type,
    )
    workflow.asset_storage.client.put_object(
        key=object_key,
        content=content,
        content_type=mime_type,
    )
    signed_url = workflow.asset_storage.signed_url_for_key(object_key)
    if not signed_url:
        raise ConfigurationError("ASR source video is not accessible.")
    return object_key, signed_url


def _current_storyboard_video_assets(
    repository: Repository,
    project_id: str,
    storyboard: list[StoryboardShot],
) -> list[tuple[int, str, Asset]]:
    video_assets: list[tuple[int, str, Asset]] = []
    for shot in sorted(storyboard, key=lambda item: item.index):
        if not shot.video_asset_id:
            continue
        try:
            asset = repository.get_asset(shot.video_asset_id)
        except NotFoundError:
            continue
        if asset.stage == Stage.VIDEO and asset.status == Status.SUCCEEDED:
            video_assets.append((shot.index, shot.id, asset))
    if video_assets:
        return video_assets

    shot_by_id = {shot.id: shot for shot in storyboard}
    shot_by_index = {shot.index: shot for shot in storyboard}
    matched_assets: list[tuple[int, str, Asset]] = []
    seen_asset_ids: set[str] = set()
    for asset in repository.list_project_assets(project_id):
        if asset.stage != Stage.VIDEO or asset.status != Status.SUCCEEDED:
            continue
        shot = None
        shot_id = asset.metadata.get("shot_id")
        if isinstance(shot_id, str):
            shot = shot_by_id.get(shot_id)
        if shot is None:
            shot_index = _metadata_int(asset.metadata.get("shot_index"))
            if shot_index is not None:
                shot = shot_by_index.get(shot_index)
        if shot is None or asset.id in seen_asset_ids:
            continue
        seen_asset_ids.add(asset.id)
        matched_assets.append((shot.index, shot.id, asset))
    return sorted(matched_assets, key=lambda item: item[0])


def _metadata_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _shot_video_config(
    shot: StoryboardShot,
    target_language: str,
) -> StoryboardShotVideoConfig:
    resolved_prompt = normalize_video_prompt(
        shot,
        shot.video_prompt,
        target_language=target_language,
    )
    has_other_contract = (
        is_known_structured_video_prompt(
            shot.video_prompt,
            target_language=target_language,
        )
        and not is_structured_video_prompt(
            shot.video_prompt,
            target_language=target_language,
        )
    )
    stored_prompt = (
        None
        if (
            is_legacy_structured_video_prompt(shot.video_prompt)
            or has_other_contract
        )
        else shot.video_prompt
    )
    return StoryboardShotVideoConfig(
        shot_id=shot.id,
        shot_index=shot.index,
        video_prompt=stored_prompt,
        effective_video_prompt=resolved_prompt,
        first_frame_asset_id=shot.first_frame_asset_id,
        first_frame_source_video_asset_id=(
            shot.first_frame_source_video_asset_id
        ),
        reference_image_asset_ids=shot.reference_image_asset_ids,
        reference_video_asset_ids=shot.reference_video_asset_ids,
        reference_audio_asset_ids=shot.reference_audio_asset_ids,
        video_asset_id=shot.video_asset_id,
    )


def _validate_uploaded_reference(
    kind: ReferenceAssetKind,
    *,
    filename: str | None,
    mime_type: str | None,
    content_size: int,
) -> str:
    if content_size <= 0:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "reference file is empty",
        )

    limits = {
        ReferenceAssetKind.IMAGE: 20 * 1024 * 1024,
        ReferenceAssetKind.VIDEO: 200 * 1024 * 1024,
        ReferenceAssetKind.AUDIO: 50 * 1024 * 1024,
    }
    if content_size > limits[kind]:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "reference file exceeds maximum size",
        )

    normalized = (
        (mime_type or mimetypes.guess_type(filename or "")[0] or "")
        .split(";", 1)[0]
        .strip()
        .lower()
    )
    if not normalized:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "reference file MIME type is required",
        )
    if kind == ReferenceAssetKind.IMAGE and normalized in {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    }:
        return normalized
    if kind == ReferenceAssetKind.VIDEO and normalized in {
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "video/webm",
    }:
        return normalized
    if kind == ReferenceAssetKind.AUDIO and normalized in {
        "audio/aac",
        "audio/mpeg",
        "audio/mp4",
        "audio/ogg",
        "audio/wav",
        "audio/x-wav",
    }:
        return normalized
    raise WorkflowError(
        ErrorCode.VALIDATION_ERROR,
        f"reference file MIME type is not valid for {kind.value}",
    )


def _normalized_video_filename(filename: str | None) -> str:
    if not filename:
        return "tool-video.mp4"
    stem = Path(filename).stem.strip()
    return f"{stem or 'tool-video'}.mp4"


def _validate_uploaded_image_reference(
    *,
    filename: str | None,
    mime_type: str | None,
    content: bytes,
) -> str:
    normalized = _validate_uploaded_reference(
        ReferenceAssetKind.IMAGE,
        filename=filename,
        mime_type=mime_type,
        content_size=len(content),
    )
    if normalized not in {"image/png", "image/jpeg", "image/webp"}:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "image reference must be PNG, JPEG, or WebP",
        )
    signatures = {
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/webp": (
            len(content) >= 12
            and content.startswith(b"RIFF")
            and content[8:12] == b"WEBP"
        ),
    }
    if not signatures[normalized]:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "image reference content does not match its MIME type",
        )
    return normalized


def _validate_image_generation_reference(
    asset: Asset,
    *,
    project_id: str,
) -> None:
    if asset.project_id != project_id:
        raise WorkflowError(ErrorCode.NOT_FOUND, "reference asset not found")
    if asset.asset_role != AssetRole.PUBLIC:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "reference asset must be public",
        )
    if asset.status != Status.SUCCEEDED:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "reference asset must be succeeded",
        )
    if (
        asset.type not in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
        or (asset.mime_type or "").lower()
        not in {"image/png", "image/jpeg", "image/webp"}
    ):
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "reference asset must be a supported image",
        )
    if not asset.object_key:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "reference asset has no stored object",
        )


def _uploaded_asset_type(kind: ReferenceAssetKind) -> AssetType:
    return {
        ReferenceAssetKind.IMAGE: AssetType.UPLOADED_IMAGE,
        ReferenceAssetKind.VIDEO: AssetType.UPLOADED_VIDEO,
        ReferenceAssetKind.AUDIO: AssetType.UPLOADED_AUDIO,
    }[kind]


def _tool_asset_matches_kind(asset: Asset, kind: ReferenceAssetKind) -> bool:
    type_matches = {
        ReferenceAssetKind.IMAGE: asset.type
        in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE},
        ReferenceAssetKind.VIDEO: asset.type
        in {
            AssetType.UPLOADED_VIDEO,
            AssetType.STORYBOARD_VIDEO,
            AssetType.FINAL_VIDEO,
        },
        ReferenceAssetKind.AUDIO: asset.type == AssetType.UPLOADED_AUDIO,
    }[kind]
    mime_type = (asset.mime_type or "").lower()
    return type_matches and mime_type.startswith(f"{kind.value}/")


def _validate_tool_asset_reference(
    asset: Asset,
    kind: ReferenceAssetKind,
) -> None:
    if asset.tool_asset_role is None:
        raise WorkflowError(ErrorCode.NOT_FOUND, "tool asset not found")
    if asset.asset_role != AssetRole.PUBLIC or asset.status != Status.SUCCEEDED:
        raise WorkflowError(ErrorCode.INVALID_STATE, "tool asset is not available")
    if not _tool_asset_matches_kind(asset, kind):
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            f"tool asset is not a valid {kind.value}",
        )


def _validate_tool_reference_asset(
    asset: Asset,
    kind: ReferenceAssetKind,
) -> None:
    if asset.asset_role != AssetRole.PUBLIC or asset.status != Status.SUCCEEDED:
        raise WorkflowError(ErrorCode.INVALID_STATE, "tool reference is not available")
    if not _tool_asset_matches_kind(asset, kind):
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            f"tool reference is not a valid {kind.value}",
        )


def _validate_reference_asset(
    asset: Asset,
    *,
    project_id: str,
    kind: ReferenceAssetKind,
) -> None:
    if asset.project_id != project_id:
        raise WorkflowError(
            ErrorCode.NOT_FOUND,
            "reference asset not found",
        )
    if asset.status != Status.SUCCEEDED:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "reference asset must be succeeded",
            detail=f"asset_id={asset.id}",
        )
    mime_type = (asset.mime_type or "").lower()
    valid = False
    if kind == ReferenceAssetKind.IMAGE:
        valid = asset.type in {
            AssetType.UPLOADED_IMAGE,
            AssetType.GENERATED_IMAGE,
        } or mime_type.startswith("image/")
    elif kind == ReferenceAssetKind.VIDEO:
        valid = asset.type in {
            AssetType.UPLOADED_VIDEO,
            AssetType.STORYBOARD_VIDEO,
            AssetType.FINAL_VIDEO,
        } or mime_type.startswith("video/")
    elif kind == ReferenceAssetKind.AUDIO:
        valid = asset.type == AssetType.UPLOADED_AUDIO or mime_type.startswith("audio/")

    if not valid:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            f"reference asset is not a valid {kind.value}",
            detail=f"asset_id={asset.id}",
        )


def _text_generation_image_urls(
    payload: TextGenerationInputRequest | None,
    repository: Repository,
    asset_storage: AssetStorageService,
    project_id: str,
) -> list[str]:
    if payload is None or not payload.reference_asset_ids:
        return []
    try:
        assets = _reference_assets(
            repository,
            project_id,
            ReferenceAssetKind.IMAGE,
            payload.reference_asset_ids,
        )
        urls: list[str] = []
        for asset in assets:
            asset_url = asset_storage.signed_access_url(asset)
            if not asset_url:
                raise WorkflowError(
                    ErrorCode.INVALID_STATE,
                    "reference image asset has no accessible URL",
                    detail=f"asset_id={asset.id}",
                )
            urls.append(asset_url)
        return urls
    except WorkflowError as exc:
        raise _workflow_http_error(exc) from exc
    except NotFoundError as exc:
        raise _http_error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "reference asset not found",
        ) from exc


def _reference_assets(
    repository: Repository,
    project_id: str,
    kind: ReferenceAssetKind,
    asset_ids: list[str],
) -> list[Asset]:
    assets: list[Asset] = []
    for asset_id in asset_ids:
        asset = repository.get_asset(asset_id)
        _validate_reference_asset(asset, project_id=project_id, kind=kind)
        assets.append(asset)
    return assets


STORYBOARD_VIDEO_INPUT_CONFLICT_MESSAGE = (
    "首帧控制不能与参考图、参考视频或参考音频同时使用，"
    "请移除其中一类素材后重试。"
)


def _validate_storyboard_video_input_mode(
    shot: StoryboardShot,
    *,
    adding_first_frame: bool = False,
    adding_reference_media: bool = False,
) -> None:
    has_first_frame = bool(
        shot.first_frame_asset_id
        or shot.first_frame_source_video_asset_id
        or adding_first_frame
    )
    has_reference_media = bool(
        shot.reference_image_asset_ids
        or shot.reference_video_asset_ids
        or shot.reference_audio_asset_ids
        or adding_reference_media
    )
    if has_first_frame and has_reference_media:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            STORYBOARD_VIDEO_INPUT_CONFLICT_MESSAGE,
            detail=STORYBOARD_VIDEO_INPUT_CONFLICT_MESSAGE,
        )


def _previous_shot_last_frame_asset(
    repository: Repository,
    *,
    project_id: str,
    shot: StoryboardShot,
    source_video_asset_id: str,
) -> tuple[Asset, str]:
    ordered_shots = sorted(
        repository.list_project_storyboard(project_id),
        key=lambda item: item.index,
    )
    current_position = next(
        (
            position
            for position, candidate in enumerate(ordered_shots)
            if candidate.id == shot.id
        ),
        None,
    )
    if current_position is None or current_position == 0:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "the storyboard shot has no previous shot",
        )

    previous_shot = ordered_shots[current_position - 1]
    if previous_shot.video_asset_id != source_video_asset_id:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "first frame source must be the previous shot's current video",
        )

    asset = repository.get_asset(source_video_asset_id)
    if (
        asset.project_id != project_id
        or asset.type != AssetType.STORYBOARD_VIDEO
        or asset.status != Status.SUCCEEDED
    ):
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "previous shot video is not available",
        )
    object_key = asset.metadata.get("last_frame_object_key")
    if (
        asset.metadata.get("last_frame_status") != "available"
        or not isinstance(object_key, str)
        or not object_key
    ):
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "previous shot video has no available last frame",
        )
    return asset, object_key


def _source_shot_last_frame_asset(
    repository: Repository,
    *,
    project_id: str,
    shot: StoryboardShot,
) -> tuple[Asset, str]:
    if shot.video_asset_id is None:
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "source shot video is not available",
        )

    asset = repository.get_asset(shot.video_asset_id)
    if (
        asset.project_id != project_id
        or asset.type != AssetType.STORYBOARD_VIDEO
        or asset.status not in {Status.SUCCEEDED, Status.STALE}
    ):
        raise WorkflowError(
            ErrorCode.VALIDATION_ERROR,
            "source shot video is not available",
        )
    object_key = asset.metadata.get("last_frame_object_key")
    if (
        asset.metadata.get("last_frame_status") != "available"
        or not isinstance(object_key, str)
        or not object_key
    ):
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "source shot video has no available last frame",
        )
    return asset, object_key


def _copy_last_frame_to_reference_asset(
    repository: Repository,
    asset_storage: AssetStorageService,
    *,
    project_id: str,
    source_shot: StoryboardShot,
    source_video_asset: Asset,
    last_frame_object_key: str,
) -> Asset:
    existing = _find_tail_frame_reference_asset(
        repository,
        project_id=project_id,
        source_video_asset_id=source_video_asset.id,
    )
    if existing is not None:
        return existing

    if asset_storage.client is None:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "asset storage is not configured",
        )

    try:
        content = asset_storage.client.get_object(key=last_frame_object_key)
    except Exception as exc:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "source shot last frame could not be loaded",
        ) from exc

    mime_type = source_video_asset.metadata.get("last_frame_mime_type")
    if not isinstance(mime_type, str) or not mime_type.startswith("image/"):
        mime_type = "image/png"

    try:
        return asset_storage.upload_asset(
            repository,
            StoredAssetInput(
                project_id=project_id,
                type=AssetType.GENERATED_IMAGE,
                category=AssetCategory.REFERENCE,
                stage=Stage.VIDEO,
                status=Status.SUCCEEDED,
                mime_type=mime_type,
                size_bytes=len(content),
                filename=f"shot-{source_shot.index}-last-frame-reference.png",
                metadata={
                    "reference_kind": "image",
                    "usage": "storyboard_video_tail_frame_reference",
                    "source_shot_id": source_shot.id,
                    "source_video_asset_id": source_video_asset.id,
                    "source_last_frame_object_key": last_frame_object_key,
                    "name": f"分镜 {source_shot.index} 尾帧参考图",
                },
            ),
            content=content,
        )
    except Exception as exc:
        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            "source shot last frame could not be copied",
        ) from exc


def _copy_available_last_frame_to_reference_asset(
    repository: Repository,
    asset_storage: AssetStorageService,
    *,
    project_id: str,
    source_shot: StoryboardShot,
    source_video_asset: Asset,
) -> Asset | None:
    object_key = source_video_asset.metadata.get("last_frame_object_key")
    if (
        source_video_asset.metadata.get("last_frame_status") != "available"
        or not isinstance(object_key, str)
        or not object_key
    ):
        return None
    try:
        return _copy_last_frame_to_reference_asset(
            repository,
            asset_storage,
            project_id=project_id,
            source_shot=source_shot,
            source_video_asset=source_video_asset,
            last_frame_object_key=object_key,
        )
    except Exception as exc:
        logger.warning(
            "storyboard_tail_frame_reference_asset_copy_failed %s",
            json.dumps(
                {
                    "project_id": project_id,
                    "shot_id": source_shot.id,
                    "source_video_asset_id": source_video_asset.id,
                    "error_type": type(exc).__name__,
                },
                sort_keys=True,
                separators=(",", ":"),
            ),
        )
        return None


def _find_tail_frame_reference_asset(
    repository: Repository,
    *,
    project_id: str,
    source_video_asset_id: str,
) -> Asset | None:
    for asset in repository.list_project_assets(project_id):
        if (
            asset.status in {Status.SUCCEEDED, Status.STALE}
            and asset.type == AssetType.GENERATED_IMAGE
            and asset.metadata.get("usage") == "storyboard_video_tail_frame_reference"
            and asset.metadata.get("source_video_asset_id") == source_video_asset_id
        ):
            if asset.status == Status.STALE:
                return repository.update_asset(asset.id, status=Status.SUCCEEDED)
            return asset
    return None


def _single_shot_video_input_hash(
    *,
    project_id: str,
    shot: StoryboardShot,
    brief: dict[str, object],
    resolved_video_prompt: str,
    reference_image_assets: list[Asset],
    reference_video_assets: list[Asset],
    reference_audio_assets: list[Asset],
    first_frame_asset: Asset | None,
    first_frame_source_video_asset: Asset | None,
) -> str:
    payload: dict[str, object] = {
        "project_id": project_id,
        "stage": Stage.VIDEO.value,
        "mode": "single_storyboard_shot",
        "brief": brief,
        "shot": {
            "id": shot.id,
            "index": shot.index,
            "duration_seconds": shot.duration_seconds,
            "video_prompt": resolved_video_prompt,
            "updated_at": shot.updated_at.isoformat(),
        },
        "references": {
            "first_frame": (
                _asset_hash_payload(first_frame_asset)
                if first_frame_asset is not None
                else (
                    {
                        **_asset_hash_payload(first_frame_source_video_asset),
                        "last_frame_object_key": (
                            first_frame_source_video_asset.metadata.get(
                                "last_frame_object_key"
                            )
                        ),
                    }
                    if first_frame_source_video_asset is not None
                    else None
                )
            ),
            "image": [_asset_hash_payload(asset) for asset in reference_image_assets],
            "video": [_asset_hash_payload(asset) for asset in reference_video_assets],
            "audio": [_asset_hash_payload(asset) for asset in reference_audio_assets],
        },
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )
    return hashlib.sha256(encoded).hexdigest()


def _image_generation_input_hash(
    frozen: FrozenImageGenerationInput,
) -> str:
    return _frozen_input_hash(frozen.model_dump(mode="json"))


def _frozen_input_hash(frozen_input: dict[str, object]) -> str:
    encoded = json.dumps(
        frozen_input,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


async def _run_image_layer_composition_task(
    *,
    task_id: str,
    frozen: FrozenImageLayerCompositionInput,
    repository: Repository,
    workflow: WorkflowService,
) -> None:
    try:
        workflow.start_task(task_id)
        layer_set = repository.get_image_layer_set(
            frozen.project_id,
            frozen.layer_set_id,
        )
        if (
            layer_set.status != Status.SUCCEEDED
            or layer_set.source_asset_id != frozen.source_asset_id
            or layer_set.revision != frozen.layer_revision
        ):
            raise RevisionConflictError("frozen layer revision no longer matches")
        base_content, layer_contents = await read_layer_set_contents(
            repository=repository,
            asset_storage=workflow.asset_storage,
            layer_set=layer_set,
        )
        result = await asyncio.to_thread(
            ImageLayerCompositionService().compose,
            layer_set=layer_set,
            base_content=base_content,
            layer_contents=layer_contents,
        )
        latest = repository.get_image_layer_set(
            frozen.project_id,
            frozen.layer_set_id,
        )
        if latest.revision != frozen.layer_revision:
            raise RevisionConflictError("frozen layer revision no longer matches")
        asset = await persist_layer_composition(
            repository=repository,
            asset_storage=workflow.asset_storage,
            layer_set=layer_set,
            source_asset_id=frozen.source_asset_id,
            task_id=task_id,
            result=result,
            set_current=frozen.set_current,
            expected_image_revision=frozen.expected_image_revision,
        )
        workflow.complete_task(task_id, output_asset_ids=[asset.id])
    except Exception as exc:
        logger.warning(
            "image layer composition task failed",
            extra={"error_type": type(exc).__name__, "task_id": task_id},
        )
        workflow.fail_task(
            task_id,
            message="image layer composition failed",
            detail=type(exc).__name__,
        )


async def _run_image_layer_content_edit_task(
    *,
    task_id: str,
    frozen: FrozenImageLayerContentEditInput,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> None:
    try:
        workflow.start_task(task_id)
        source = repository.get_asset(frozen.source_asset_id)
        if (
            source.object_key != frozen.source_object_key
            or source.created_at.isoformat() != frozen.source_asset_created_at
            or source.asset_role != AssetRole.INTERNAL_LAYER
        ):
            raise ValueError("frozen layer source snapshot no longer matches")
        source_url = workflow.asset_storage.signed_access_url(source)
        if not source_url:
            raise ValueError("layer source image is not accessible")
        generated = await generation.edit_layer_image(
            project_id=frozen.project_id, source_image_url=source_url,
            prompt=frozen.prompt, size=frozen.size, output_format=frozen.format)
        assets = await workflow.asset_storage.upload_assets_from_sources(
            repository,
            [StoredAssetInput(
                project_id=frozen.project_id, type=AssetType.GENERATED_IMAGE,
                asset_role=AssetRole.INTERNAL_LAYER, stage=Stage.IMAGE,
                status=Status.SUCCEEDED, source_url=generated.url,
                mime_type=generated.mime_type, source_task_id=task_id,
                validate_image_content=True,
                metadata={**generated.metadata, "replaced_layer_asset_id": source.id,
                    "layer_set_id": frozen.layer_set_id, "layer_id": frozen.layer_id,
                    "final_prompt": frozen.prompt, "model": frozen.model})],
        )
        replacement = assets[0]
        repository.replace_image_layer_asset(
            frozen.project_id, frozen.layer_set_id,
            expected_revision=frozen.expected_revision, layer_id=frozen.layer_id,
            asset=replacement)
        workflow.complete_task(task_id, output_asset_ids=[replacement.id])
    except RevisionConflictError:
        workflow.fail_task(task_id, code=ErrorCode.TASK_CONFLICT,
                           message="image layer set revision conflict", detail=None)
    except ModelArkProviderError as exc:
        workflow.fail_task(task_id, code=ErrorCode.EXTERNAL_SERVICE_ERROR,
                           message="layer content edit failed", detail=exc.safe_detail())
    except Exception as exc:
        logger.warning("image layer content edit failed", extra={"task_id": task_id, "error_type": type(exc).__name__})
        workflow.fail_task(task_id, message="layer content edit failed", detail=type(exc).__name__)


async def _run_image_layer_decomposition_task(
    *,
    task_id: str,
    frozen: FrozenImageLayerDecompositionInput,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> None:
    try:
        workflow.start_task(task_id)
        source = repository.get_asset(frozen.source_asset_id)
        if (
            source.project_id != frozen.project_id
            or source.asset_role != AssetRole.PUBLIC
            or source.type not in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
            or source.status != Status.SUCCEEDED
            or source.object_key != frozen.source_object_key
            or source.created_at.isoformat() != frozen.source_asset_created_at
        ):
            raise ValueError("frozen layer source asset snapshot no longer matches")
        source_url = workflow.asset_storage.signed_access_url(source)
        if not source_url:
            raise ValueError("layer source image is not accessible")
        source_download = await workflow.asset_storage.downloader.fetch(
            source_url,
            expected_mime_type="image/*",
        )
        source_info = inspect_layer_image_content(
            source_download,
            enforce_input_limits=True,
        )
        result = await generation.decompose_image_layers(
            frozen,
            source_image_url=source_url,
            canvas_width=source_info.width,
            canvas_height=source_info.height,
        )
        layer_set = await persist_layer_decomposition(
            repository=repository,
            asset_storage=workflow.asset_storage,
            source_asset=source,
            task_id=task_id,
            result=result,
            canvas_width=source_info.width,
            canvas_height=source_info.height,
            base_mime_type=(
                "image/png" if frozen.format.value == "png" else "image/jpeg"
            ),
        )
        output_asset_ids = [
            layer_set.base_asset_id,
            *[layer.asset_id for layer in layer_set.layers],
        ]
        workflow.complete_task(task_id, output_asset_ids=output_asset_ids)
    except ModelArkProviderError as exc:
        logger.warning(
            "layer decomposition provider failure",
            extra=exc.safe_log_fields(),
        )
        workflow.fail_task(
            task_id,
            code=ErrorCode.EXTERNAL_SERVICE_ERROR,
            message="layer decomposition failed",
            detail=exc.safe_detail(),
        )
    except Exception as exc:
        logger.warning(
            "layer decomposition task failed",
            extra={"error_type": type(exc).__name__, "task_id": task_id},
        )
        workflow.fail_task(
            task_id,
            message="layer decomposition failed",
            detail=type(exc).__name__,
        )


def _image_layer_set_detail(
    layer_set: ImageLayerSet,
    repository: Repository,
    asset_storage: AssetStorageService,
) -> ImageLayerSetDetail:
    base_asset = repository.get_asset(layer_set.base_asset_id)
    layer_assets = [
        repository.get_asset(layer.asset_id)
        for layer in layer_set.layers
    ]

    def with_signed_url(asset: Asset) -> Asset:
        return asset.model_copy(
            update={"url": asset_storage.signed_access_url(asset)},
            deep=True,
        )

    return ImageLayerSetDetail(
        **layer_set.model_dump(),
        base_asset=with_signed_url(base_asset),
        layers_assets=[with_signed_url(asset) for asset in layer_assets],
    )


async def _run_image_generation_task(
    *,
    task_id: str,
    frozen: FrozenImageGenerationInput,
    repository: Repository,
    workflow: WorkflowService,
    generation: ModelArkGenerationService,
) -> None:
    try:
        workflow.start_task(task_id)
        source_url: str | None = None
        reference_urls: list[str] = []
        if frozen.operation == ImageGenerationOperation.IMAGE_TO_IMAGE:
            if not frozen.source_asset_id:
                raise ValueError("frozen source asset is missing")
            source = repository.get_asset(frozen.source_asset_id)
            if (
                source.project_id != frozen.project_id
                or source.object_key != frozen.source_object_key
                or source.created_at.isoformat() != frozen.source_asset_created_at
            ):
                raise ValueError("frozen source asset snapshot no longer matches")
            source_url = workflow.asset_storage.signed_access_url(source)
            if not source_url:
                raise ValueError("source image asset is not accessible")
        reference_snapshots = list(frozen.reference_assets)
        if not reference_snapshots and frozen.reference_asset_id is not None:
            reference_snapshots = [
                FrozenImageReference(
                    asset_id=frozen.reference_asset_id,
                    object_key=frozen.reference_object_key or "",
                    created_at=frozen.reference_asset_created_at or "",
                )
            ]
        for snapshot in reference_snapshots:
            reference = repository.get_asset(snapshot.asset_id)
            if (
                reference.project_id != frozen.project_id
                or reference.object_key != snapshot.object_key
                or reference.created_at.isoformat() != snapshot.created_at
            ):
                raise ValueError(
                    "frozen reference asset snapshot no longer matches"
                )
            reference_url = workflow.asset_storage.signed_access_url(reference)
            if not reference_url:
                raise ValueError("reference image asset is not accessible")
            reference_urls.append(reference_url)

        generated = await generation.generate_project_image(
            frozen,
            source_image_url=source_url,
            reference_image_urls=reference_urls,
        )
        prompt_digest = hashlib.sha256(
            frozen.prompt.encode("utf-8")
        ).hexdigest()
        assets = await workflow.asset_storage.upload_assets_from_sources(
            repository,
            [
                StoredAssetInput(
                    project_id=frozen.project_id,
                    type=AssetType.GENERATED_IMAGE,
                    asset_role=AssetRole.PUBLIC,
                    stage=Stage.IMAGE,
                    status=Status.SUCCEEDED,
                    source_url=generated.url,
                    mime_type=generated.mime_type,
                    source_task_id=task_id,
                    validate_image_content=True,
                    metadata={
                        **generated.metadata,
                        "operation": frozen.operation.value,
                        "source_asset_id": frozen.source_asset_id,
                        "generation_mode": (
                            "reference_replace"
                            if frozen.edit_mode == "reference_replace"
                            else "reference_guided"
                            if reference_urls
                            else (
                                "text_only"
                                if frozen.operation
                                == ImageGenerationOperation.TEXT_TO_IMAGE
                                else "image_edit"
                            )
                        ),
                        "reference_asset_id": frozen.reference_asset_id,
                        "reference_asset_ids": [
                            snapshot.asset_id
                            for snapshot in frozen.reference_assets
                        ]
                        or (
                            [frozen.reference_asset_id]
                            if frozen.reference_asset_id is not None
                            else []
                        ),
                        "reference_image_count": len(reference_urls),
                        "edit_mode": frozen.edit_mode,
                        "target_bbox": (
                            frozen.target_bbox.model_dump(mode="json")
                            if frozen.target_bbox is not None
                            else None
                        ),
                        "reference_regions": [
                            region.model_dump(mode="json")
                            for region in frozen.reference_regions
                        ],
                        "prompt_version_id": frozen.prompt_version_id,
                        "prompt_version": frozen.prompt_version,
                        "prompt_summary": frozen.prompt[:240],
                        "prompt_sha256": prompt_digest,
                        "final_prompt": frozen.final_prompt,
                        "annotation": (
                            frozen.annotation.model_dump(mode="json")
                            if frozen.annotation is not None
                            else None
                        ),
                        "size": frozen.size.value,
                        "format": frozen.format.value,
                        "model": frozen.model,
                        "aspect_ratio": frozen.aspect_ratio,
                        "image_purpose": frozen.image_purpose.value,
                    },
                )
            ],
        )
        created = assets[0]
        project = repository.get_project(frozen.project_id)
        if project.current_image_asset_id is None:
            repository.set_current_image_asset(
                frozen.project_id,
                created.id,
                expected_revision=project.image_revision,
            )
        workflow.complete_task(task_id, output_asset_ids=[created.id])
    except ModelArkProviderError as exc:
        logger.warning(
            "image generation provider failure",
            extra=exc.safe_log_fields(),
        )
        workflow.fail_task(
            task_id,
            code=ErrorCode.EXTERNAL_SERVICE_ERROR,
            message="image generation failed",
            detail=exc.safe_detail(),
        )
    except Exception as exc:
        logger.warning(
            "image generation task failed",
            extra={"error_type": type(exc).__name__, "task_id": task_id},
        )
        workflow.fail_task(
            task_id,
            message="image generation failed",
            detail=type(exc).__name__,
        )


def _asset_hash_payload(asset: Asset) -> dict[str, object]:
    return {
        "id": asset.id,
        "type": asset.type.value,
        "status": asset.status.value,
        "updated_at": asset.updated_at.isoformat(),
    }


def _fail_running_task(
    workflow: WorkflowService,
    repository: Repository,
    task_id: str,
    *,
    code: ErrorCode = ErrorCode.GENERATION_FAILED,
    detail: str | None = None,
) -> None:
    try:
        task = repository.get_task(task_id)
    except NotFoundError:
        return
    if task.status in {Status.QUEUED, Status.RUNNING}:
        workflow.fail_task(
            task_id,
            code=code,
            message="storyboard shot video generation failed",
            detail=detail,
        )


def _workflow_http_error(exc: WorkflowError) -> HTTPException:
    status_code = {
        ErrorCode.NOT_FOUND: status.HTTP_404_NOT_FOUND,
        ErrorCode.DEPENDENCY_MISSING: status.HTTP_409_CONFLICT,
        ErrorCode.TASK_CONFLICT: status.HTTP_409_CONFLICT,
        ErrorCode.INVALID_STATE: status.HTTP_409_CONFLICT,
        ErrorCode.VALIDATION_ERROR: status.HTTP_422_UNPROCESSABLE_ENTITY,
        ErrorCode.GENERATION_FAILED: status.HTTP_500_INTERNAL_SERVER_ERROR,
        ErrorCode.EXTERNAL_SERVICE_ERROR: status.HTTP_502_BAD_GATEWAY,
    }.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR)
    return _http_error(status_code, exc.code, exc.message, exc.detail)


def _http_error(
    status_code: int,
    code: ErrorCode,
    message: str,
    detail: str | None = None,
) -> HTTPException:
    sanitized_message = _sanitize_error_text(message)
    sanitized_detail = _sanitize_error_text(detail) if detail is not None else None
    payload: dict[str, str] = {
        "code": code.value,
        "message": sanitized_message,
    }
    if sanitized_detail is not None:
        payload["detail"] = sanitized_detail
    return HTTPException(status_code=status_code, detail=payload)


def _sanitize_error_text(value: str) -> str:
    sanitized = _redact_signed_url_query(value)
    sanitized = re.sub(
        r"(?i)\b(ark[_-]?(?:api[_-]?)?key|tos[_-]?(?:ak|sk|access[_-]?key|secret[_-]?key)|password|passwd|pwd|secret|token|signature)\b\s*[:=]\s*[^,\s;]+",
        r"\1=[redacted]",
        sanitized,
    )
    sanitized = re.sub(
        r"(?i)\b(sk-[a-z0-9][a-z0-9._-]{8,}|ak-[a-z0-9][a-z0-9._-]{8,}|ark-[a-z0-9][a-z0-9._-]{8,})\b",
        "[redacted-key]",
        sanitized,
    )
    sanitized = re.sub(
        r"(?i)\b(mysql|postgres(?:ql)?)://([^:\s/@]+):([^@\s]+)@",
        r"\1://\2:[redacted]@",
        sanitized,
    )
    if re.search(r"(?i)\b(provider|vendor|upstream)\b", sanitized) and re.search(
        r"(?i)\b(sensitive|secret|signature|token|password|sk-|ark[_-]?key|tos[_-]?(?:ak|sk))\b",
        sanitized,
    ):
        return "external provider error was redacted"
    return sanitized


def _redact_signed_url_query(value: str) -> str:
    def replace_url(match: re.Match[str]) -> str:
        raw_url = match.group(0)
        parsed = urlsplit(raw_url)
        if not parsed.query:
            return raw_url
        if re.search(r"(?i)(^|&)(x-tos-|signature|x-amz-|expires|token)", parsed.query):
            return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
        return raw_url

    return re.sub(r"https?://[^\s\"'<>]+", replace_url, value)


def _to_shot_create_list(shots: list[StoryboardShot]) -> list[StoryboardShotCreate]:
    return [
        StoryboardShotCreate(
            **shot.model_dump(
                exclude={
                    "id",
                    "created_at",
                    "updated_at",
                },
                exclude_computed_fields=True,
            )
        )
        for shot in shots
    ]


def _storyboard_content_from_shots(shots: list[StoryboardShot]) -> str:
    blocks: list[str] = []
    for shot in sorted(shots, key=lambda item: item.index):
        title = shot.title or f"镜头 {shot.index}"
        lines = [
            f"镜头 {shot.index}：{title}（{shot.duration_seconds:g}秒）",
            f"画面描述：{shot.description}",
            f"视觉提示：{shot.visual_prompt}",
        ]
        if shot.narration:
            lines.append(f"旁白：{shot.narration}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)
