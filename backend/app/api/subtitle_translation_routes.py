from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from backend.app.api.dependencies import (
    get_subtitle_translation_service,
    require_business_access,
)
from backend.app.repositories.base import NotFoundError, RevisionConflictError
from backend.app.schemas.asset import Asset
from backend.app.schemas.subtitle_translation import (
    SubtitleStageRequest,
    SubtitleVideoImportRequest,
    SubtitleWorkspace,
    SubtitleWorkspaceCreate,
    SubtitleWorkspaceUpdate,
)
from backend.app.schemas.tool_task import ToolTask
from backend.app.services.subtitle_translation import SubtitleTranslationService
from backend.app.services.subtitle_translation_media import (
    MAX_BYTES,
    SubtitleTranslationMediaService,
)
from backend.app.services.video_subtitle_grounding_media import RemoteVideoError

router = APIRouter(
    prefix="/tools/subtitle-translation",
    tags=["tools"],
    dependencies=[Depends(require_business_access)],
)
Service = Annotated[
    SubtitleTranslationService, Depends(get_subtitle_translation_service)
]
SAFE_INPUT_MESSAGES = {
    "reference video must be at most 600 seconds",
    "video exceeds 512 MiB",
    "video upload is empty",
    "upload a supported video MIME type",
    "select an accessible tool video asset",
    "select a reference video first",
    "select a clean video first",
    "another workspace stage is active",
    "no pending translations",
    "translation requires valid extracted segment IDs",
    "translation selection must not be empty",
    "complete or exclude every untranslated subtitle before rendering",
    "no renderable subtitle segments",
    "draft must preserve segment IDs; use excluded to omit a subtitle",
    "original subtitle text cannot be overwritten",
    "preview must preserve segment IDs and original text",
}


def _error(exc):
    if isinstance(exc, NotFoundError):
        return HTTPException(
            404,
            detail={
                "code": "not_found",
                "message": "Workspace or tool video not found.",
            },
        )
    if isinstance(exc, RevisionConflictError):
        return HTTPException(
            409, detail={"code": "revision_conflict", "message": str(exc)}
        )
    return HTTPException(
        422,
        detail={
            "code": "validation_error",
            "message": str(exc)
            if isinstance(exc, RemoteVideoError) or str(exc) in SAFE_INPUT_MESSAGES
            else "Invalid subtitle input; check the video, draft and stage requirements.",
        },
    )


async def _prepare_inputs(service, request):
    media = service.media or SubtitleTranslationMediaService(
        service.repository, service.asset_storage
    )
    for role in ("reference", "clean"):
        asset_id = getattr(request, f"{role}_video_asset_id", None)
        if asset_id:
            await media.ensure_metadata(asset_id, role=role)


@router.post("/workspaces", response_model=SubtitleWorkspace, status_code=201)
async def create_workspace(payload: SubtitleWorkspaceCreate, service: Service):
    try:
        await _prepare_inputs(service, payload)
        return service.create(payload)
    except (ValueError, NotFoundError) as exc:
        raise _error(exc) from exc


@router.get("/workspaces", response_model=list[SubtitleWorkspace])
async def list_workspaces(service: Service):
    return service.repository.list_subtitle_workspaces()


@router.get("/workspaces/{workspace_id}", response_model=SubtitleWorkspace)
async def get_workspace(workspace_id: str, service: Service):
    try:
        return await service.preview(
            service.repository.get_subtitle_workspace(workspace_id)
        )
    except NotFoundError as exc:
        raise _error(exc) from exc


@router.patch("/workspaces/{workspace_id}", response_model=SubtitleWorkspace)
async def update_workspace(
    workspace_id: str, payload: SubtitleWorkspaceUpdate, service: Service
):
    try:
        current = service.repository.get_subtitle_workspace(workspace_id)
        if current.revision != payload.expected_revision:
            raise RevisionConflictError(
                "workspace revision changed; reload before saving"
            )
        await _prepare_inputs(service, payload)
        return await service.preview(service.patch(workspace_id, payload))
    except (ValueError, NotFoundError, RevisionConflictError) as exc:
        raise _error(exc) from exc


@router.post("/workspaces/{workspace_id}/preview", response_model=SubtitleWorkspace)
async def preview_workspace(
    workspace_id: str, payload: SubtitleWorkspaceUpdate, service: Service
):
    try:
        workspace = service.repository.get_subtitle_workspace(workspace_id)
        await _prepare_inputs(service, payload)
        return await service.preview(workspace, payload)
    except (ValueError, NotFoundError, RevisionConflictError) as exc:
        raise _error(exc) from exc


@router.post(
    "/workspaces/{workspace_id}/{operation}", response_model=ToolTask, status_code=201
)
async def execute_stage(
    workspace_id: str,
    operation: Literal["extract", "translate", "render"],
    payload: SubtitleStageRequest,
    service: Service,
):
    try:
        return service.submit(workspace_id, operation, payload)
    except (ValueError, NotFoundError, RevisionConflictError) as exc:
        raise _error(exc) from exc


@router.post("/import-video", response_model=Asset, status_code=201)
async def import_video(payload: SubtitleVideoImportRequest, service: Service):
    try:
        media = service.media or SubtitleTranslationMediaService(
            service.repository, service.asset_storage
        )
        asset = await media.import_video(payload.video_url, role=payload.role)
        return service.asset_storage.with_access_url(asset)
    except (ValueError, OSError) as exc:
        raise _error(exc) from exc


@router.post("/upload-video", response_model=Asset, status_code=201)
async def upload_video(
    request: Request,
    service: Service,
    role: Literal["reference", "clean"] = "reference",
    filename: str | None = Query(default=None, max_length=255),
    mime_type: str = "video/mp4",
):
    length = request.headers.get("content-length")
    if length is not None:
        try:
            parsed_length = int(length)
            if parsed_length < 0:
                raise ValueError("negative length")
            if parsed_length > MAX_BYTES:
                raise HTTPException(
                    413,
                    detail={
                        "code": "validation_error",
                        "message": "Video exceeds 512 MiB.",
                    },
                )
        except ValueError:
            raise HTTPException(
                422,
                detail={
                    "code": "validation_error",
                    "message": "Invalid upload length.",
                },
            ) from None
    try:
        media = service.media or SubtitleTranslationMediaService(
            service.repository, service.asset_storage
        )
        asset = await media.upload_video(
            request.stream(), role=role, filename=filename, mime_type=mime_type
        )
        return service.asset_storage.with_access_url(asset)
    except (ValueError, OSError) as exc:
        raise _error(exc) from exc
