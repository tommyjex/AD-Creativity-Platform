from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from pydantic import ConfigDict, Field, field_validator

from .common import SchemaModel, utc_now
from .enums import ImagePurpose, TargetLanguage


VISIBLE_SELLING_COPY_ERROR = (
    'image prompt may contain 0-4 non-empty selling-point copy items; '
    'visible copy must be wrapped in paired ASCII double quotes (")'
)


def extract_visible_selling_copies(prompt: str) -> tuple[str, ...]:
    if "“" in prompt or "”" in prompt:
        raise ValueError(VISIBLE_SELLING_COPY_ERROR)
    quote_count = prompt.count('"')
    if quote_count not in {0, 2, 4, 6, 8}:
        raise ValueError(VISIBLE_SELLING_COPY_ERROR)
    if quote_count == 0:
        return ()

    parts = prompt.split('"')
    if len(parts) != quote_count + 1:
        raise ValueError(VISIBLE_SELLING_COPY_ERROR)

    copies = tuple(parts[index].strip() for index in range(1, len(parts), 2))
    if not 1 <= len(copies) <= 4 or any(not copy for copy in copies):
        raise ValueError(VISIBLE_SELLING_COPY_ERROR)
    return copies


def validate_visible_selling_copy(prompt: str) -> str:
    stripped = prompt.strip()
    if not stripped:
        raise ValueError("image prompt must not be blank")
    extract_visible_selling_copies(stripped)
    return stripped


class ImagePromptVersionCreate(SchemaModel):
    project_id: str
    prompt: str = Field(..., min_length=1)
    aspect_ratio: str = Field(..., pattern=r"^(9:16|16:9|1:1|4:3|3:4)$")
    target_language: TargetLanguage
    image_purpose: ImagePurpose

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        return validate_visible_selling_copy(value)


class ImagePromptVersionSave(SchemaModel):
    prompt: str = Field(..., min_length=1)

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        return validate_visible_selling_copy(value)


class ImagePromptSuggestionRequest(SchemaModel):
    current_prompt: str | None = Field(default=None, max_length=12000)


class ImagePromptSuggestion(SchemaModel):
    prompt: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)


class ImagePromptVersion(SchemaModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        populate_by_name=True,
    )

    id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str
    version: int = Field(..., ge=1)
    prompt: str
    aspect_ratio: str
    target_language: TargetLanguage
    image_purpose: ImagePurpose
    created_at: datetime = Field(default_factory=utc_now)
