from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

from pydantic import Field, field_validator

from .common import SchemaModel, utc_now
from .enums import (
    AssetCategory,
    AssetRole,
    AssetType,
    CharacterAssetIterationOperation,
    Stage,
    Status,
)
from .task import GenerationTask


class AssetBase(SchemaModel):
    project_id: str = Field(..., min_length=1)
    type: AssetType
    category: Optional[AssetCategory] = None
    asset_role: AssetRole = AssetRole.PUBLIC
    status: Status = Status.QUEUED
    stage: Optional[Stage] = None
    url: Optional[str] = None
    object_key: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = Field(default=None, ge=0)
    source_task_id: Optional[str] = None
    metadata: dict[str, object] = Field(default_factory=dict)


class AssetCreate(AssetBase):
    id: str = Field(default_factory=lambda: str(uuid4()))


class Asset(AssetCreate):
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class CharacterAssetIterationRequest(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1, max_length=4000)
    operation_type: CharacterAssetIterationOperation

    @field_validator("asset_id", "prompt")
    @classmethod
    def strip_non_empty_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("value must not be blank")
        return stripped


class CharacterAssetEditRequest(CharacterAssetIterationRequest):
    operation_type: Literal[CharacterAssetIterationOperation.EDIT] = (
        CharacterAssetIterationOperation.EDIT
    )


class CharacterAssetRegenerateRequest(CharacterAssetIterationRequest):
    operation_type: Literal[CharacterAssetIterationOperation.REGENERATE] = (
        CharacterAssetIterationOperation.REGENERATE
    )


class CharacterAssetIterationResponse(SchemaModel):
    source_asset_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    operation_type: CharacterAssetIterationOperation
    task: GenerationTask
    asset: Asset


class TextGenerationInputRequest(SchemaModel):
    reference_asset_ids: list[str] = Field(default_factory=list)

    @field_validator("reference_asset_ids")
    @classmethod
    def strip_and_dedupe_asset_ids(cls, value: list[str]) -> list[str]:
        deduped: list[str] = []
        for item in value:
            stripped = item.strip()
            if stripped and stripped not in deduped:
                deduped.append(stripped)
        return deduped
