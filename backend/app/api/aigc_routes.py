from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, status

from backend.app.api.dependencies import (
    get_aigc_pipeline_service,
    get_aigc_pipeline_runtime,
    get_asset_storage_service,
    get_media_inspector_service,
    get_modelark_generation_service,
    get_repository,
    get_video_normalizer_service,
)
from backend.app.core.config import ConfigurationError
from backend.app.repositories import (
    ActiveRunConflictError,
    NotFoundError,
    PipelineRunConflictError,
    Repository,
    RevisionConflictError,
)
from backend.app.schemas import (
    AigcNodeRegistryResponse,
    AigcPage,
    AigcPipeline,
    AigcPipelineCreate,
    AigcPipelineRun,
    AigcPipelineRunCreate,
    AigcPipelineRunDetail,
    AigcPipelineTemplate,
    AigcPipelineTemplateCreate,
    AigcPipelineTemplateUpdate,
    AigcPipelineUpdate,
    AigcPromptOptimizeRequest,
    AigcPromptOptimizeResponse,
    AigcSaveAsTemplateRequest,
    AigcTemplateInstantiateRequest,
    Asset,
    AssetRole,
    AssetType,
    ErrorCode,
    ReferenceAssetKind,
    Status,
    ToolAssetRole,
)
from backend.app.services.aigc_pipeline import AigcPipelineService
from backend.app.services.aigc_dag import AigcDagValidationError
from backend.app.services.aigc_executor import AigcPipelineRuntime
from backend.app.services.assets import AssetStorageService, StoredAssetInput
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.modelark import ModelArkProviderError, ModelArkTextParseError
from backend.app.services.media_inspector import MediaInspector
from backend.app.services.video_normalizer import (
    VideoNormalizationError,
    VideoNormalizer,
)

router = APIRouter(prefix="/aigc", tags=["aigc"])
logger = logging.getLogger(__name__)


@router.get("/node-registry", response_model=AigcNodeRegistryResponse)
def get_aigc_node_registry(
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> AigcNodeRegistryResponse:
    return service.node_registry()


@router.post(
    "/prompts/optimize",
    response_model=AigcPromptOptimizeResponse,
)
async def optimize_aigc_image_prompt(
    payload: AigcPromptOptimizeRequest,
    generation: ModelArkGenerationService = Depends(
        get_modelark_generation_service
    ),
) -> AigcPromptOptimizeResponse:
    try:
        return await generation.optimize_aigc_image_prompt(
            text=payload.text,
            reference_instructions=payload.reference_instructions,
            generation_modes=payload.generation_modes,
            reference_image_count=payload.reference_image_count,
        )
    except (ModelArkProviderError, ModelArkTextParseError) as exc:
        logger.warning(
            "AIGC image prompt optimization failed",
            extra=exc.safe_log_fields(),
        )
        raise _error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            "AIGC image prompt optimization failed",
        ) from exc


@router.get("/templates", response_model=AigcPage[AigcPipelineTemplate])
def list_aigc_templates(
    q: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    repository: Repository = Depends(get_repository),
) -> AigcPage[AigcPipelineTemplate]:
    return _page(repository.list_aigc_templates(q), page=page, page_size=page_size)


@router.post(
    "/templates",
    response_model=AigcPipelineTemplate,
    status_code=status.HTTP_201_CREATED,
)
def create_aigc_template(
    payload: AigcPipelineTemplateCreate,
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> AigcPipelineTemplate:
    try:
        return service.create_template(payload)
    except AigcDagValidationError as exc:
        raise _aigc_validation_error(exc) from exc


@router.get(
    "/templates/{template_id}",
    response_model=AigcPipelineTemplate,
)
def get_aigc_template(
    template_id: str,
    repository: Repository = Depends(get_repository),
) -> AigcPipelineTemplate:
    try:
        return repository.get_aigc_template(template_id)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC template not found",
        ) from exc


@router.put(
    "/templates/{template_id}",
    response_model=AigcPipelineTemplate,
)
def update_aigc_template(
    template_id: str,
    payload: AigcPipelineTemplateUpdate,
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> AigcPipelineTemplate:
    try:
        return service.update_template(template_id, payload)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC template not found",
        ) from exc
    except RevisionConflictError as exc:
        raise _error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            "AIGC template revision conflict",
        ) from exc
    except AigcDagValidationError as exc:
        raise _aigc_validation_error(exc) from exc


@router.delete(
    "/templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_aigc_template(
    template_id: str,
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> None:
    try:
        service.delete_template(template_id)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC template not found",
        ) from exc


@router.post(
    "/templates/{template_id}/instantiate",
    response_model=AigcPipeline,
    status_code=status.HTTP_201_CREATED,
)
def instantiate_aigc_template(
    template_id: str,
    payload: AigcTemplateInstantiateRequest,
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> AigcPipeline:
    try:
        return service.instantiate_template(template_id, payload)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC template not found",
        ) from exc
    except RevisionConflictError as exc:
        raise _error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            "AIGC template revision conflict",
        ) from exc
    except AigcDagValidationError as exc:
        raise _aigc_validation_error(exc) from exc


@router.get("/pipelines", response_model=AigcPage[AigcPipeline])
def list_aigc_pipelines(
    q: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    repository: Repository = Depends(get_repository),
) -> AigcPage[AigcPipeline]:
    return _page(repository.list_aigc_pipelines(q), page=page, page_size=page_size)


@router.post(
    "/pipelines",
    response_model=AigcPipeline,
    status_code=status.HTTP_201_CREATED,
)
def create_aigc_pipeline(
    payload: AigcPipelineCreate,
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> AigcPipeline:
    try:
        return service.create_pipeline(payload)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC pipeline asset or source template not found",
        ) from exc
    except AigcDagValidationError as exc:
        raise _aigc_validation_error(exc) from exc


@router.get("/pipelines/{pipeline_id}", response_model=AigcPipeline)
def get_aigc_pipeline(
    pipeline_id: str,
    repository: Repository = Depends(get_repository),
) -> AigcPipeline:
    try:
        return repository.get_aigc_pipeline(pipeline_id)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC pipeline not found",
        ) from exc


@router.put("/pipelines/{pipeline_id}", response_model=AigcPipeline)
def update_aigc_pipeline(
    pipeline_id: str,
    payload: AigcPipelineUpdate,
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> AigcPipeline:
    try:
        return service.update_pipeline(pipeline_id, payload)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC pipeline or referenced asset not found",
        ) from exc
    except RevisionConflictError as exc:
        raise _error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            "AIGC pipeline revision conflict",
        ) from exc
    except AigcDagValidationError as exc:
        raise _aigc_validation_error(exc) from exc


@router.delete(
    "/pipelines/{pipeline_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_aigc_pipeline(
    pipeline_id: str,
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> None:
    try:
        service.delete_pipeline(pipeline_id)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC pipeline not found",
        ) from exc
    except PipelineRunConflictError as exc:
        raise _error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            "AIGC pipeline has an active run",
        ) from exc


@router.post(
    "/pipelines/{pipeline_id}/templates",
    response_model=AigcPipelineTemplate,
    status_code=status.HTTP_201_CREATED,
)
def save_aigc_pipeline_as_template(
    pipeline_id: str,
    payload: AigcSaveAsTemplateRequest,
    service: AigcPipelineService = Depends(get_aigc_pipeline_service),
) -> AigcPipelineTemplate:
    try:
        return service.save_pipeline_as_template(pipeline_id, payload)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC pipeline not found",
        ) from exc
    except AigcDagValidationError as exc:
        raise _aigc_validation_error(exc) from exc


@router.post(
    "/assets/{media_kind}",
    response_model=Asset,
    status_code=status.HTTP_201_CREATED,
)
async def upload_aigc_media(
    media_kind: Literal["images", "videos", "audios"],
    filename: str | None = Query(default=None),
    mime_type: str | None = Query(default=None),
    content: bytes = Body(..., media_type="application/octet-stream"),
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
    media_inspector: MediaInspector = Depends(get_media_inspector_service),
    video_normalizer: VideoNormalizer = Depends(get_video_normalizer_service),
) -> Asset:
    kind = {
        "images": ReferenceAssetKind.IMAGE,
        "videos": ReferenceAssetKind.VIDEO,
        "audios": ReferenceAssetKind.AUDIO,
    }[media_kind]
    try:
        inspection = await media_inspector.inspect(
            kind,
            content,
            filename=filename,
            mime_type=mime_type,
        )
        normalized_mime_type = inspection.mime_type
        stored_filename = filename
        metadata: dict[str, object] = {
            "origin": "aigc",
            "aigc_role": "input",
            "name": filename or f"aigc-{kind.value}",
            **inspection.metadata(),
        }
        if kind == ReferenceAssetKind.VIDEO:
            normalized_video = await video_normalizer.normalize_if_needed(content)
            content = normalized_video.content
            if normalized_video.normalized:
                normalized_mime_type = "video/mp4"
                stored_filename = _normalized_aigc_video_filename(filename)
            metadata.update(
                {
                    "name": stored_filename or filename or "aigc-video",
                    "original_filename": filename or "aigc-video",
                    "source_container": normalized_video.source_format,
                    "video_normalized": normalized_video.normalized,
                }
            )
        asset = asset_storage.upload_asset(
            repository,
            StoredAssetInput(
                type={
                    ReferenceAssetKind.IMAGE: AssetType.UPLOADED_IMAGE,
                    ReferenceAssetKind.VIDEO: AssetType.UPLOADED_VIDEO,
                    ReferenceAssetKind.AUDIO: AssetType.UPLOADED_AUDIO,
                }[kind],
                tool_asset_role=ToolAssetRole.INPUT,
                status=Status.SUCCEEDED,
                mime_type=normalized_mime_type,
                size_bytes=len(content),
                filename=stored_filename,
                metadata=metadata,
            ),
            content=content,
        )
        return asset_storage.with_access_url(asset)
    except VideoNormalizationError as exc:
        raise _error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            ErrorCode.VALIDATION_ERROR,
            "video could not be normalized to MP4",
        ) from exc
    except ValueError as exc:
        raise _error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            ErrorCode.VALIDATION_ERROR,
            str(exc),
        ) from exc
    except ConfigurationError as exc:
        raise _error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            f"AIGC {kind.value} upload is unavailable",
        ) from exc
    except Exception as exc:
        raise _error(
            status.HTTP_502_BAD_GATEWAY,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            f"AIGC {kind.value} upload failed",
        ) from exc


@router.post(
    "/pipelines/{pipeline_id}/runs",
    response_model=AigcPipelineRunDetail,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_aigc_run(
    pipeline_id: str,
    payload: AigcPipelineRunCreate,
    idempotency_key: str = Header(
        ...,
        alias="Idempotency-Key",
        min_length=1,
        max_length=255,
    ),
    runtime: AigcPipelineRuntime = Depends(get_aigc_pipeline_runtime),
) -> AigcPipelineRunDetail:
    try:
        return await runtime.submit_run(
            pipeline_id,
            payload,
            idempotency_key=idempotency_key,
        )
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC pipeline or asset not found",
        ) from exc
    except (RevisionConflictError, ActiveRunConflictError) as exc:
        raise _error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            str(exc),
        ) from exc
    except AigcDagValidationError as exc:
        location = exc.node_id or exc.edge_id
        message = f"{exc}: {location}" if location else str(exc)
        raise _error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            ErrorCode.VALIDATION_ERROR,
            message,
        ) from exc


@router.get(
    "/pipelines/{pipeline_id}/runs",
    response_model=AigcPage[AigcPipelineRun],
)
def list_aigc_runs(
    pipeline_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    repository: Repository = Depends(get_repository),
) -> AigcPage[AigcPipelineRun]:
    try:
        return _page(
            repository.list_aigc_runs(pipeline_id),
            page=page,
            page_size=page_size,
        )
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC pipeline not found",
        ) from exc


@router.get("/runs/{run_id}", response_model=AigcPipelineRunDetail)
def get_aigc_run(
    run_id: str,
    repository: Repository = Depends(get_repository),
) -> AigcPipelineRunDetail:
    try:
        return repository.get_aigc_run(run_id)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC run not found",
        ) from exc


@router.get(
    "/pipelines/{pipeline_id}/runs/{run_id}/assets/{asset_id}",
    response_model=Asset,
)
def get_aigc_internal_run_asset(
    pipeline_id: str,
    run_id: str,
    asset_id: str,
    repository: Repository = Depends(get_repository),
    asset_storage: AssetStorageService = Depends(get_asset_storage_service),
) -> Asset:
    try:
        asset = repository.get_aigc_run_asset(pipeline_id, run_id, asset_id)
        if (
            asset.asset_role
            not in {AssetRole.INTERNAL_BASE, AssetRole.INTERNAL_LAYER}
            or asset.status != Status.SUCCEEDED
        ):
            raise NotFoundError(f"AIGC internal run asset not found: {asset_id}")
        access_url = asset_storage.signed_access_url(asset)
        if not access_url:
            raise NotFoundError(f"AIGC internal run asset unavailable: {asset_id}")
        return asset.model_copy(update={"url": access_url}, deep=True)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC internal run asset not found",
        ) from exc


@router.post(
    "/runs/{run_id}/nodes/{node_id}/retry",
    response_model=AigcPipelineRunDetail,
    status_code=status.HTTP_202_ACCEPTED,
)
async def retry_aigc_run_node(
    run_id: str,
    node_id: str,
    idempotency_key: str = Header(
        ...,
        alias="Idempotency-Key",
        min_length=1,
        max_length=255,
    ),
    runtime: AigcPipelineRuntime = Depends(get_aigc_pipeline_runtime),
) -> AigcPipelineRunDetail:
    try:
        return await runtime.retry_node(
            run_id,
            node_id,
            idempotency_key=idempotency_key,
        )
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC run or node not found",
        ) from exc
    except ActiveRunConflictError as exc:
        raise _error(
            status.HTTP_409_CONFLICT,
            ErrorCode.INVALID_STATE,
            str(exc),
        ) from exc
    except (AigcDagValidationError, ValueError) as exc:
        raise _error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            ErrorCode.VALIDATION_ERROR,
            str(exc),
        ) from exc


@router.post(
    "/runs/{run_id}/cancel",
    response_model=AigcPipelineRunDetail,
)
async def cancel_aigc_run(
    run_id: str,
    runtime: AigcPipelineRuntime = Depends(get_aigc_pipeline_runtime),
) -> AigcPipelineRunDetail:
    try:
        return await runtime.cancel_run(run_id)
    except NotFoundError as exc:
        raise _error(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.NOT_FOUND,
            "AIGC run not found",
        ) from exc


def _page(items: list, *, page: int, page_size: int) -> AigcPage:
    start = (page - 1) * page_size
    return AigcPage(
        items=items[start : start + page_size],
        page=page,
        page_size=page_size,
        total=len(items),
    )


def _normalized_aigc_video_filename(filename: str | None) -> str:
    if not filename:
        return "aigc-video.mp4"
    stem = Path(filename).stem.strip()
    return f"{stem or 'aigc-video'}.mp4"


def _error(status_code: int, code: ErrorCode, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code.value, "message": message},
    )


def _aigc_validation_error(exc: AigcDagValidationError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail={
            "code": ErrorCode.VALIDATION_ERROR.value,
            "message": str(exc),
            "validation_code": exc.code,
            "node_id": exc.node_id,
            "edge_id": exc.edge_id,
        },
    )
