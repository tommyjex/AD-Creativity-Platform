from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, TypeAlias
from uuid import uuid4

from pydantic import Field, field_validator, model_validator

from .common import SchemaModel, utc_now
from .enums import ErrorCode, ReferenceAssetKind, Status, ToolAssetRole, ToolTaskType
from .seedance import (
    SEEDANCE_DEFAULT_RESOLUTION,
    SEEDANCE_MODEL_DURATION_RANGES,
    SEEDANCE_MODEL_RESOLUTIONS,
    SeedanceAspectRatio,
    SeedanceModel,
    SeedanceResolution,
    validate_seedance_duration,
    validate_seedance_reference_counts,
    validate_seedance_resolution,
)

# Compatibility aliases retained for existing tool API consumers.
ToolVideoModel: TypeAlias = SeedanceModel
ToolVideoResolution: TypeAlias = SeedanceResolution
ToolVideoAspectRatio: TypeAlias = SeedanceAspectRatio
TOOL_VIDEO_MODEL_DURATION_RANGES = SEEDANCE_MODEL_DURATION_RANGES
TOOL_VIDEO_MODEL_RESOLUTIONS = SEEDANCE_MODEL_RESOLUTIONS
TOOL_VIDEO_DEFAULT_RESOLUTION = SEEDANCE_DEFAULT_RESOLUTION
validate_tool_video_duration = validate_seedance_duration
validate_tool_video_resolution = validate_seedance_resolution


class ToolTaskError(SchemaModel):
    code: ErrorCode
    message: str = Field(..., min_length=1, max_length=255)
    provider_request_id: Optional[str] = Field(default=None, max_length=255)
    provider_task_id: Optional[str] = Field(default=None, max_length=255)
    stage: Optional[str] = Field(default=None, max_length=64)


class ToolTaskBase(SchemaModel):
    type: ToolTaskType
    status: Status = Status.QUEUED
    input_snapshot: dict[str, object] = Field(default_factory=dict)
    provider_task_id: Optional[str] = Field(default=None, max_length=255)
    error: Optional[ToolTaskError] = None
    retry_of_task_id: Optional[str] = None


class ToolTaskCreate(ToolTaskBase):
    id: str = Field(default_factory=lambda: str(uuid4()))


class ToolTaskInputAsset(SchemaModel):
    task_id: str = Field(..., min_length=1)
    asset_id: str = Field(..., min_length=1)
    kind: ReferenceAssetKind
    created_at: datetime = Field(default_factory=utc_now)


class ToolTask(ToolTaskBase):
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    input_assets: list[ToolTaskInputAsset] = Field(default_factory=list)


class ToolTaskInputReferenceRequest(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    kind: ReferenceAssetKind

    @field_validator("asset_id")
    @classmethod
    def strip_asset_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("asset_id must not be blank")
        return value


class FaceBlurVideoRequest(SchemaModel):
    video_asset_id: str = Field(..., min_length=1)
    mask_mode: Literal["mosaic", "blur"]
    mask_strength: Literal["low", "medium", "high"]


class ToolVideoGenerationRequest(SchemaModel):
    model: ToolVideoModel
    prompt: str = Field(..., min_length=1, max_length=12000)
    duration_seconds: int = Field(..., strict=True)
    resolution: ToolVideoResolution
    aspect_ratio: ToolVideoAspectRatio
    reference_image_asset_ids: list[str] = Field(default_factory=list, max_length=30)
    reference_video_asset_ids: list[str] = Field(default_factory=list, max_length=10)
    reference_audio_asset_ids: list[str] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def validate_duration_for_model(self) -> "ToolVideoGenerationRequest":
        validate_tool_video_duration(self.model, self.duration_seconds)
        validate_tool_video_resolution(self.model, self.resolution)
        validate_seedance_reference_counts(
            self.model,
            reference_image_count=len(self.reference_image_asset_ids),
            reference_video_count=len(self.reference_video_asset_ids),
            reference_audio_count=len(self.reference_audio_asset_ids),
        )
        return self


class ToolVideoPromptOptimizeRequest(SchemaModel):
    prompt: str = Field(..., min_length=1, max_length=12000)
    reference_image_count: int = Field(default=0, ge=0)
    reference_video_count: int = Field(default=0, ge=0)
    reference_audio_count: int = Field(default=0, ge=0)

    @field_validator("prompt")
    @classmethod
    def strip_prompt(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("prompt must not be blank")
        return stripped


class ToolVideoPromptOptimizeResponse(SchemaModel):
    optimized_prompt: str = Field(..., min_length=1, max_length=12000)


class ToolAssetUploadResponse(SchemaModel):
    asset_id: str
    asset_role: ToolAssetRole
