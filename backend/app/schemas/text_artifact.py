from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import Field

from .common import SchemaModel, utc_now
from .enums import Stage, Status


class TextArtifactBase(SchemaModel):
    project_id: str = Field(..., min_length=1)
    stage: Stage
    title: Optional[str] = None
    content: str = Field(..., min_length=1)
    version: int = Field(default=1, ge=1)
    status: Status = Status.SUCCEEDED


class TextArtifactCreate(TextArtifactBase):
    pass


class TextArtifactUpdate(SchemaModel):
    content: str = Field(..., min_length=1)
    title: Optional[str] = None


class TextArtifact(TextArtifactBase):
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
