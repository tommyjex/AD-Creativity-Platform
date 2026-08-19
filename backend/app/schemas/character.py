from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import Field, field_validator, model_validator

from .common import SchemaModel, utc_now
from .enums import Status
from .asset import Asset
from .task import GenerationTask


class CharacterCardBase(SchemaModel):
    project_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=4000)
    sort_order: int = Field(default=0, ge=0)
    asset_id: Optional[str] = Field(default=None, min_length=1)
    status: Status = Status.DRAFT

    @field_validator("project_id", "name", "description", "asset_id")
    @classmethod
    def strip_non_empty_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("value must not be blank")
        return stripped


class CharacterCardCreate(CharacterCardBase):
    id: str = Field(default_factory=lambda: str(uuid4()))


class CharacterCardUpdate(SchemaModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, min_length=1, max_length=4000)
    sort_order: Optional[int] = Field(default=None, ge=0)
    asset_id: Optional[str] = Field(default=None, min_length=1)
    status: Optional[Status] = None

    @field_validator("name", "description", "asset_id")
    @classmethod
    def strip_non_empty_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("value must not be blank")
        return stripped

    @model_validator(mode="after")
    def require_changes(self) -> CharacterCardUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one character card field must be provided")
        return self


class CharacterCard(CharacterCardCreate):
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class CharacterCardImageGenerationResponse(SchemaModel):
    character_card: CharacterCard
    task: GenerationTask
    asset: Asset
