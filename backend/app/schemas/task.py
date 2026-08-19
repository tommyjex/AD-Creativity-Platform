from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import Field

from .common import SchemaModel, utc_now
from .enums import ErrorCode, Stage, Status


class TaskError(SchemaModel):
    code: ErrorCode
    message: str = Field(..., min_length=1)
    detail: Optional[str] = None


class GenerationTaskBase(SchemaModel):
    project_id: str = Field(..., min_length=1)
    stage: Stage
    status: Status = Status.QUEUED
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    progress_message: Optional[str] = None
    error: Optional[TaskError] = None
    input_hash: Optional[str] = None
    frozen_input: Optional[dict[str, object]] = None
    retry_of_task_id: Optional[str] = None
    output_asset_ids: list[str] = Field(default_factory=list)
    output_text_artifact_id: Optional[str] = None


class GenerationTaskCreate(GenerationTaskBase):
    pass


class GenerationTask(GenerationTaskBase):
    id: str = Field(default_factory=lambda: str(uuid4()))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
