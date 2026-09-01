from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

from pydantic import Field, field_validator, model_validator

from .common import SchemaModel, utc_now
from .enums import (
    AssetCategory,
    AssetRole,
    AssetType,
    CharacterAssetIterationOperation,
    Stage,
    Status,
    ToolAssetRole,
)
from .task import GenerationTask


class AssetBase(SchemaModel):
    project_id: Optional[str] = Field(default=None, min_length=1)
    tool_task_id: Optional[str] = Field(default=None, min_length=1)
    tool_asset_role: Optional[ToolAssetRole] = None
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

    @field_validator("tool_task_id")
    @classmethod
    def strip_tool_task_id(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value else value

    @field_validator("project_id")
    @classmethod
    def strip_project_id(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value else value

    @model_validator(mode="after")
    def validate_ownership(self) -> "AssetBase":
        if self.project_id and self.tool_task_id:
            raise ValueError("asset cannot belong to both a project and tool task")
        if self.tool_task_id and self.tool_asset_role is None:
            raise ValueError("tool assets require a tool_asset_role")
        if self.project_id and self.tool_asset_role is not None:
            raise ValueError("project assets cannot have a tool_asset_role")
        if not self.project_id and not self.tool_task_id and self.tool_asset_role is None:
            raise ValueError("unowned tool assets require a tool_asset_role")
        return self


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
