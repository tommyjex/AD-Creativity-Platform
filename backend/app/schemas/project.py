from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import Field, RootModel, model_validator

from .asset import Asset
from .brief import Brief, BriefCreate, BriefUpdate
from .character import CharacterCard
from .common import SchemaModel, utc_now
from .enums import ProjectType, Stage, Status
from .storyboard import StoryboardShot
from .task import GenerationTask
from .text_artifact import TextArtifact


class ProjectCreate(SchemaModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    project_type: ProjectType = ProjectType.VIDEO_AD
    brief: BriefCreate = Field(default_factory=BriefCreate)

    @model_validator(mode="after")
    def validate_brief_matrix(self) -> ProjectCreate:
        if self.project_type == ProjectType.IMAGE_ASSET:
            self.brief.duration_seconds = None
        _validate_brief_matrix(self.project_type, self.brief)
        return self


class ProjectUpdate(SchemaModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    brief: Optional[BriefUpdate] = None

    @model_validator(mode="after")
    def require_changes(self) -> ProjectUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one project field must be provided")
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null")
        if "brief" in self.model_fields_set:
            if self.brief is None:
                raise ValueError("brief cannot be null")
            if not self.brief.model_fields_set:
                raise ValueError("at least one brief field must be provided")
        return self


class ProjectBase(SchemaModel):
    name: str
    project_type: ProjectType = ProjectType.VIDEO_AD
    brief: Brief
    status: Status = Status.DRAFT
    current_stage: Stage = Stage.BRIEF
    current_image_prompt_version_id: Optional[str] = None
    image_prompt_status: Status = Status.DRAFT
    current_image_asset_id: Optional[str] = None
    image_revision: int = Field(default=0, ge=0)
    image_reference_asset_ids: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_brief_matrix(self) -> ProjectBase:
        _validate_brief_matrix(self.project_type, self.brief)
        return self


class Project(ProjectBase):
    id: str = Field(default_factory=lambda: str(uuid4()))
    text_artifacts: list[TextArtifact] = Field(default_factory=list)
    character_cards: list[CharacterCard] = Field(default_factory=list)
    storyboard: list[StoryboardShot] = Field(default_factory=list)
    tasks: list[GenerationTask] = Field(default_factory=list)
    assets: list[Asset] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProjectListItem(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(RootModel[list[ProjectListItem]]):
    pass


def _validate_brief_matrix(
    project_type: ProjectType,
    brief: Brief | BriefCreate,
) -> None:
    if project_type == ProjectType.VIDEO_AD:
        if not brief.prompt.strip():
            raise ValueError("video_ad brief requires a non-empty prompt")
        if brief.duration_seconds is None:
            raise ValueError("video_ad brief requires duration_seconds")
        if brief.image_purpose is not None:
            raise ValueError("video_ad brief requires image_purpose to be null")
        return

    if brief.duration_seconds is not None:
        raise ValueError("image_asset brief requires duration_seconds to be null")
