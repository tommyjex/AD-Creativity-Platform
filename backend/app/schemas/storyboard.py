from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

from pydantic import Field, computed_field, field_validator, model_validator

from ..video_prompt import (
    MAX_VIDEO_PROMPT_LENGTH,
    build_single_shot_video_prompt,
    normalize_video_prompt,
)
from .common import SchemaModel, utc_now
from .enums import ReferenceAssetKind, Status


def default_video_prompt_for_shot(shot: "StoryboardShotBase") -> str:
    return build_single_shot_video_prompt(shot)


class StoryboardAtomicShotSnapshot(SchemaModel):
    id: str = Field(..., min_length=1)
    title: Optional[str] = None
    description: str = Field(..., min_length=1)
    visual_prompt: str = Field(..., min_length=1)
    narration: Optional[str] = None
    duration_seconds: float = Field(..., gt=0)
    video_prompt: Optional[str] = Field(
        default=None,
        max_length=MAX_VIDEO_PROMPT_LENGTH,
    )


class StoryboardShotBase(SchemaModel):
    project_id: str = Field(..., min_length=1)
    index: int = Field(..., ge=1)
    title: Optional[str] = None
    description: str = Field(..., min_length=1)
    visual_prompt: str = Field(..., min_length=1)
    narration: Optional[str] = None
    duration_seconds: float = Field(default=3.0, gt=0)
    status: Status = Status.DRAFT
    image_asset_id: Optional[str] = None
    first_frame_asset_id: Optional[str] = None
    first_frame_source_video_asset_id: Optional[str] = None
    video_asset_id: Optional[str] = None
    video_prompt: Optional[str] = Field(
        default=None,
        max_length=MAX_VIDEO_PROMPT_LENGTH,
    )
    reference_image_asset_ids: list[str] = Field(default_factory=list)
    reference_video_asset_ids: list[str] = Field(default_factory=list)
    reference_audio_asset_ids: list[str] = Field(default_factory=list)
    merge_source_shots: list[StoryboardAtomicShotSnapshot] = Field(
        default_factory=list,
        exclude=True,
    )

    @field_validator("video_prompt")
    @classmethod
    def strip_optional_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator(
        "reference_image_asset_ids",
        "reference_video_asset_ids",
        "reference_audio_asset_ids",
    )
    @classmethod
    def dedupe_reference_ids(cls, value: list[str]) -> list[str]:
        deduped: list[str] = []
        for item in value:
            stripped = item.strip()
            if stripped and stripped not in deduped:
                deduped.append(stripped)
        return deduped


class StoryboardShotCreate(StoryboardShotBase):
    pass


class StoryboardShot(StoryboardShotBase):
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @property
    def effective_video_prompt(self) -> str:
        return normalize_video_prompt(self, self.video_prompt)

    @computed_field
    @property
    def is_merged(self) -> bool:
        return bool(self.merge_source_shots)

    @computed_field
    @property
    def merge_source_count(self) -> int:
        return len(self.merge_source_shots)


class StoryboardShotVideoConfigUpdate(SchemaModel):
    video_prompt: Optional[str] = Field(
        default=None,
        max_length=MAX_VIDEO_PROMPT_LENGTH,
    )

    @field_validator("video_prompt")
    @classmethod
    def strip_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class StoryboardShotVideoPromptOptimizeRequest(SchemaModel):
    video_prompt: Optional[str] = Field(
        default=None,
        max_length=MAX_VIDEO_PROMPT_LENGTH,
    )

    @field_validator("video_prompt")
    @classmethod
    def strip_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class StoryboardShotVideoPromptOptimizeResponse(SchemaModel):
    optimized_prompt: str = Field(
        ...,
        min_length=1,
        max_length=MAX_VIDEO_PROMPT_LENGTH,
    )


class StoryboardShotVideoEditRequest(SchemaModel):
    prompt: str = Field(..., min_length=1, max_length=4000)

    @field_validator("prompt")
    @classmethod
    def strip_prompt(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("video edit prompt must not be blank")
        return stripped


class StoryboardShotVideoSelectionRequest(SchemaModel):
    asset_id: str = Field(..., min_length=1)

    @field_validator("asset_id")
    @classmethod
    def strip_asset_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("asset_id must not be blank")
        return stripped


class StoryboardShotVideoConfig(SchemaModel):
    shot_id: str = Field(..., min_length=1)
    shot_index: int = Field(..., ge=1)
    video_prompt: Optional[str] = None
    effective_video_prompt: str = Field(..., min_length=1)
    first_frame_asset_id: Optional[str] = None
    first_frame_source_video_asset_id: Optional[str] = None
    reference_image_asset_ids: list[str] = Field(default_factory=list)
    reference_video_asset_ids: list[str] = Field(default_factory=list)
    reference_audio_asset_ids: list[str] = Field(default_factory=list)
    video_asset_id: Optional[str] = None


class StoryboardShotFirstFrameRequest(SchemaModel):
    asset_id: Optional[str] = Field(default=None, min_length=1)
    source_video_asset_id: Optional[str] = Field(default=None, min_length=1)

    @field_validator("asset_id", "source_video_asset_id")
    @classmethod
    def strip_asset_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("first frame source id must not be blank")
        return stripped

    @model_validator(mode="after")
    def require_exactly_one_source(self) -> "StoryboardShotFirstFrameRequest":
        if (self.asset_id is None) == (self.source_video_asset_id is None):
            raise ValueError(
                "exactly one of asset_id or source_video_asset_id is required"
            )
        return self


class StoryboardShotReferenceRequest(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    kind: ReferenceAssetKind

    @field_validator("asset_id")
    @classmethod
    def strip_asset_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("asset_id must not be blank")
        return stripped


class StoryboardShotMergeRequest(SchemaModel):
    shot_ids: list[str] = Field(..., min_length=2)

    @field_validator("shot_ids")
    @classmethod
    def dedupe_shot_ids(cls, value: list[str]) -> list[str]:
        deduped: list[str] = []
        for item in value:
            stripped = item.strip()
            if stripped and stripped not in deduped:
                deduped.append(stripped)
        if len(deduped) < 2:
            raise ValueError(
                "at least two distinct shot ids are required for merge"
            )
        return deduped


class StoryboardShotReferenceUploadResponse(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    config: StoryboardShotVideoConfig


class StoryboardTailFrameReferenceSkip(SchemaModel):
    shot_id: str = Field(..., min_length=1)
    shot_index: int = Field(..., ge=1)
    reason: Literal["has_first_frame", "already_attached"]


class StoryboardTailFrameReferenceApplyResponse(SchemaModel):
    source_shot_id: str = Field(..., min_length=1)
    source_video_asset_id: str = Field(..., min_length=1)
    reference_asset_id: str = Field(..., min_length=1)
    applied_shot_ids: list[str] = Field(default_factory=list)
    skipped: list[StoryboardTailFrameReferenceSkip] = Field(default_factory=list)


class StoryboardShotGenerateVideoRequest(SchemaModel):
    shot_id: Optional[str] = Field(default=None, min_length=1)
    shot_index: Optional[int] = Field(default=None, ge=1)

    @model_validator(mode="after")
    def require_one_locator(self) -> "StoryboardShotGenerateVideoRequest":
        if self.shot_id is None and self.shot_index is None:
            raise ValueError("shot_id or shot_index is required")
        return self
