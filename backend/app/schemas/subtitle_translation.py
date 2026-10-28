from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import uuid4

from pydantic import Field, StrictInt, field_validator, model_validator

from .common import SchemaModel, utc_now
from .video_subtitle_grounding import VideoSubtitleGroundingSubtitle


class SubtitleTranslationStage(StrEnum):
    DRAFT = "draft"
    EXTRACTING = "extracting"
    EXTRACTED = "extracted"
    TRANSLATING = "translating"
    REVIEW_READY = "review_ready"
    RENDERING = "rendering"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


SubtitleOperation = Literal["extract", "translate", "render"]
SubtitleLanguage = Literal["en", "de", "fr", "es", "it", "pt", "zh", "ja"]


class SubtitleVideoMetadata(SchemaModel):
    width: StrictInt = Field(gt=0)
    height: StrictInt = Field(gt=0)
    duration_ms: StrictInt = Field(gt=0)
    rotation: Literal[0, 90, 180, 270] = 0
    fps: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    has_audio: bool = False


class SubtitleStyleOverride(SchemaModel):
    font: str | None = Field(default=None, min_length=1, max_length=128)
    font_size_px: float | None = Field(default=None, gt=0, le=4096, allow_inf_nan=False)
    text_color: str | None = None
    background_color: str | None = None
    alignment: Literal["left", "center", "right"] | None = None

    @field_validator("text_color", "background_color")
    @classmethod
    def color(cls, value: str | None) -> str | None:
        if value is not None:
            import re

            if not re.fullmatch(r"#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?", value):
                raise ValueError("color must be #RRGGBB or #RRGGBBAA")
        return value


class SubtitleTranslationSegment(VideoSubtitleGroundingSubtitle):
    segment_id: str = Field(
        default_factory=lambda: str(uuid4()), min_length=1, max_length=64
    )
    background_color: str | None = None
    translated_text: str | None = Field(default=None, max_length=4000)
    translation_status: Literal["pending", "succeeded", "failed"] = "pending"
    excluded: bool = False
    style: SubtitleStyleOverride = Field(default_factory=SubtitleStyleOverride)
    estimated_font_size_px: float | None = None
    recommended_text_color: str | None = None
    render_bbox_pixels: tuple[int, int, int, int] | None = None
    effective_font_size_px: float | None = None
    font_type: str | None = None
    font_sha256: str | None = None
    warnings: list[str] = Field(default_factory=list)

    @field_validator("translated_text")
    @classmethod
    def single_line(cls, value: str | None) -> str | None:
        if value is not None:
            if any(ord(c) < 32 or c in "\x7f\u2028\u2029" for c in value):
                raise ValueError("translated text must be a single line")
            value = value.strip()
            return value or None
        return value


class SubtitleWorkspaceCreate(SchemaModel):
    name: str = Field(default="Subtitle translation", min_length=1, max_length=128)
    reference_video_asset_id: str | None = None
    clean_video_asset_id: str | None = None
    source_language: SubtitleLanguage | Literal["auto"] = "auto"
    target_language: SubtitleLanguage = "de"


class SubtitleWorkspaceUpdate(SchemaModel):
    expected_revision: StrictInt = Field(ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=128)
    reference_video_asset_id: str | None = None
    clean_video_asset_id: str | None = None
    source_language: SubtitleLanguage | Literal["auto"] | None = None
    target_language: SubtitleLanguage | None = None
    segments: list[SubtitleTranslationSegment] | None = Field(
        default=None, max_length=500
    )

    @model_validator(mode="after")
    def required_values(self):
        for key in ("name", "source_language", "target_language", "segments"):
            if key in self.model_fields_set and getattr(self, key) is None:
                raise ValueError(f"{key} cannot be null")
        if self.segments is not None and len(
            {s.segment_id for s in self.segments}
        ) != len(self.segments):
            raise ValueError("segment IDs must be unique")
        return self


class SubtitleWorkspace(SubtitleWorkspaceCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    revision: StrictInt = Field(default=1, ge=1)
    stage: SubtitleTranslationStage = SubtitleTranslationStage.DRAFT
    reference_video: SubtitleVideoMetadata | None = None
    clean_video: SubtitleVideoMetadata | None = None
    segments: list[SubtitleTranslationSegment] = Field(default_factory=list)
    active_task_id: str | None = None
    stage_task_ids: dict[str, str] = Field(default_factory=dict)
    output_asset_id: str | None = None
    warnings: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SubtitleStageRequest(SchemaModel):
    expected_revision: StrictInt = Field(ge=1)
    segment_ids: list[str] | None = Field(default=None, max_length=500)


class SubtitleVideoImportRequest(SchemaModel):
    video_url: str = Field(min_length=1, max_length=8192)
    role: Literal["reference", "clean"] = "reference"
