from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.api.dependencies import (
    get_video_subtitle_grounding_service,
    require_admin,
)
from backend.app.core.config import Settings, get_settings
from backend.app.schemas.video_subtitle_grounding import (
    VideoSubtitleGroundingError,
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingRequest,
    VideoSubtitleGroundingResponse,
)
from backend.app.services.auth import SessionPrincipal
from backend.app.services.modelark_video_subtitle_grounding import (
    VideoSubtitleGroundingProviderError,
)
from backend.app.services.video_subtitle_grounding import (
    VideoSubtitleGroundingService,
)
from backend.app.services.video_subtitle_grounding_media import RemoteVideoError
from backend.app.services.video_subtitle_grounding_validation import (
    VideoSubtitleGroundingValidationError,
)

router = APIRouter()

_CLIENT_INPUT_CODES = {
    VideoSubtitleGroundingErrorCode.INVALID_VIDEO_URL,
    VideoSubtitleGroundingErrorCode.INVALID_VIDEO_INPUT,
    VideoSubtitleGroundingErrorCode.MEDIA_PROBE_FAILED,
}


def require_video_subtitle_grounding_enabled(
    settings: Settings = Depends(get_settings),
) -> Settings:
    if not settings.enable_experimental_video_subtitle_grounding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return settings


@router.post(
    "/experiments/video-subtitle-grounding",
    response_model=VideoSubtitleGroundingResponse,
    tags=["experiments"],
)
async def video_subtitle_grounding(
    payload: VideoSubtitleGroundingRequest,
    _: Settings = Depends(require_video_subtitle_grounding_enabled),
    __: SessionPrincipal = Depends(require_admin),
    service: VideoSubtitleGroundingService = Depends(
        get_video_subtitle_grounding_service
    ),
) -> VideoSubtitleGroundingResponse:
    try:
        return await service.run(payload)
    except (
        RemoteVideoError,
        VideoSubtitleGroundingProviderError,
        VideoSubtitleGroundingValidationError,
    ) as exc:
        error = VideoSubtitleGroundingError(
            code=exc.code,
            phase=exc.phase,
            message=str(exc),
        )
        status_code = (
            status.HTTP_422_UNPROCESSABLE_ENTITY
            if exc.code in _CLIENT_INPUT_CODES
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(
            status_code=status_code,
            detail=error.model_dump(mode="json"),
        ) from exc
