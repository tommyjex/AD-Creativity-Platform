from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.schemas.common import utc_now
from backend.app.schemas.aigc import (
    AigcAssetDirection,
    AigcPipelineRunMode,
    AigcPipelineRunStatus,
    AigcRunNodeStatus,
    AigcTaskStatus,
    AigcTaskType,
)
from backend.app.schemas.enums import (
    AssetCategory,
    AssetRole,
    AssetType,
    ErrorCode,
    ImagePurpose,
    ProjectType,
    ReferenceAssetKind,
    Stage,
    Status,
    TargetLanguage,
    ToolAssetRole,
    ToolTaskType,
)

from .session import Base


def enum_column(
    enum_type: type,
    *,
    length: int | None = None,
):
    return SqlEnum(
        enum_type,
        values_callable=lambda enum: [item.value for item in enum],
        native_enum=False,
        validate_strings=True,
        **({"length": length} if length is not None else {}),
    )


class ProjectORM(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    project_type: Mapped[ProjectType] = mapped_column(
        enum_column(ProjectType),
        nullable=False,
        default=ProjectType.VIDEO_AD,
        server_default=ProjectType.VIDEO_AD.value,
    )
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.DRAFT,
    )
    current_stage: Mapped[Stage] = mapped_column(
        enum_column(Stage),
        nullable=False,
        default=Stage.BRIEF,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    current_image_prompt_version_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
    )
    image_prompt_status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.DRAFT,
        server_default=Status.DRAFT.value,
    )
    current_image_asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
    )
    image_revision: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    image_reference_asset_ids: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        server_default="[]",
    )

    brief: Mapped[BriefORM] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        uselist=False,
    )
    text_artifacts: Mapped[list[TextArtifactORM]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    character_cards: Mapped[list[CharacterCardORM]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="CharacterCardORM.sort_order",
    )
    storyboard_shots: Mapped[list[StoryboardShotORM]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="StoryboardShotORM.index",
    )
    tasks: Mapped[list[GenerationTaskORM]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    assets: Mapped[list[AssetORM]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
    image_prompt_versions: Mapped[list[ImagePromptVersionORM]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ImagePromptVersionORM.version",
    )
    image_layer_sets: Mapped[list[ImageLayerSetORM]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )


class BriefORM(Base):
    __tablename__ = "project_briefs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    target_language: Mapped[TargetLanguage] = mapped_column(
        enum_column(TargetLanguage),
        nullable=False,
        default=TargetLanguage.ZH,
        server_default=TargetLanguage.ZH.value,
    )
    target_platform: Mapped[str] = mapped_column(String(64), nullable=False, default="douyin")
    aspect_ratio: Mapped[str] = mapped_column(String(16), nullable=False, default="9:16")
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    image_purpose: Mapped[Optional[ImagePurpose]] = mapped_column(
        enum_column(ImagePurpose),
        nullable=True,
    )
    style: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    audience: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    product_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    selling_points: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    project: Mapped[ProjectORM] = relationship(back_populates="brief")


class ImagePromptVersionORM(Base):
    __tablename__ = "image_prompt_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    aspect_ratio: Mapped[str] = mapped_column(String(16), nullable=False)
    target_language: Mapped[TargetLanguage] = mapped_column(
        enum_column(TargetLanguage),
        nullable=False,
    )
    image_purpose: Mapped[ImagePurpose] = mapped_column(
        enum_column(ImagePurpose),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    project: Mapped[ProjectORM] = relationship(back_populates="image_prompt_versions")

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "version",
            name="uq_image_prompt_versions_project_version",
        ),
    )


class TextArtifactORM(Base):
    __tablename__ = "text_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage: Mapped[Stage] = mapped_column(enum_column(Stage), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.SUCCEEDED,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    project: Mapped[ProjectORM] = relationship(back_populates="text_artifacts")

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "stage",
            "version",
            name="uq_text_artifacts_project_stage_version",
        ),
    )


class CharacterCardORM(Base):
    __tablename__ = "character_cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.DRAFT,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    project: Mapped[ProjectORM] = relationship(back_populates="character_cards")
    asset: Mapped[Optional[AssetORM]] = relationship(foreign_keys=[asset_id])

class StoryboardShotORM(Base):
    __tablename__ = "storyboard_shots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    index: Mapped[int] = mapped_column("shot_index", Integer, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    visual_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False, default=3.0)
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.DRAFT,
    )
    image_asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    first_frame_asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    first_frame_source_video_asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    video_asset_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    video_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_image_asset_ids: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    reference_video_asset_ids: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    reference_audio_asset_ids: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    merge_source_shots: Mapped[list[dict[str, object]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    project: Mapped[ProjectORM] = relationship(back_populates="storyboard_shots")
    image_asset: Mapped[Optional[AssetORM]] = relationship(
        foreign_keys=[image_asset_id],
        post_update=True,
    )
    first_frame_asset: Mapped[Optional[AssetORM]] = relationship(
        foreign_keys=[first_frame_asset_id],
        post_update=True,
    )
    first_frame_source_video_asset: Mapped[Optional[AssetORM]] = relationship(
        foreign_keys=[first_frame_source_video_asset_id],
        post_update=True,
    )
    video_asset: Mapped[Optional[AssetORM]] = relationship(
        foreign_keys=[video_asset_id],
        post_update=True,
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "shot_index",
            name="uq_storyboard_shots_project_index",
        ),
    )


class GenerationTaskORM(Base):
    __tablename__ = "generation_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage: Mapped[Stage] = mapped_column(enum_column(Stage), nullable=False, index=True)
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.QUEUED,
    )
    progress: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    progress_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_code: Mapped[Optional[ErrorCode]] = mapped_column(
        enum_column(ErrorCode),
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    input_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    frozen_input: Mapped[Optional[dict[str, object]]] = mapped_column(
        JSON,
        nullable=True,
    )
    retry_of_task_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("generation_tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    output_asset_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    output_text_artifact_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("text_artifacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    project: Mapped[ProjectORM] = relationship(back_populates="tasks")
    output_text_artifact: Mapped[Optional[TextArtifactORM]] = relationship()


class ToolTaskORM(Base):
    __tablename__ = "tool_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    type: Mapped[ToolTaskType] = mapped_column(
        enum_column(ToolTaskType),
        nullable=False,
        index=True,
    )
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.QUEUED,
        index=True,
    )
    input_snapshot: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    provider_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    error_code: Mapped[Optional[ErrorCode]] = mapped_column(
        enum_column(ErrorCode),
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    error_provider_request_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    error_provider_task_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    error_stage: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    retry_of_task_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tool_tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    assets: Mapped[list[AssetORM]] = relationship(back_populates="tool_task")
    input_assets: Mapped[list[ToolTaskInputAssetORM]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
    )


class ToolTaskInputAssetORM(Base):
    __tablename__ = "tool_task_input_assets"

    task_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tool_tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    kind: Mapped[ReferenceAssetKind] = mapped_column(
        enum_column(ReferenceAssetKind),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    task: Mapped[ToolTaskORM] = relationship(back_populates="input_assets")
    asset: Mapped[AssetORM] = relationship()


class AssetORM(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    tool_task_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tool_tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    tool_asset_role: Mapped[Optional[ToolAssetRole]] = mapped_column(
        enum_column(ToolAssetRole),
        nullable=True,
    )
    type: Mapped[AssetType] = mapped_column(enum_column(AssetType), nullable=False)
    category: Mapped[Optional[AssetCategory]] = mapped_column(
        enum_column(AssetCategory),
        nullable=True,
        index=True,
    )
    asset_role: Mapped[AssetRole] = mapped_column(
        enum_column(AssetRole),
        nullable=False,
        default=AssetRole.PUBLIC,
        server_default=AssetRole.PUBLIC.value,
        index=True,
    )
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.QUEUED,
    )
    stage: Mapped[Optional[Stage]] = mapped_column(enum_column(Stage), nullable=True)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    object_key: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True, index=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source_task_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("generation_tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    metadata_json: Mapped[dict[str, object]] = mapped_column(
        "metadata",
        JSON,
        nullable=False,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    project: Mapped[ProjectORM] = relationship(back_populates="assets")
    tool_task: Mapped[Optional[ToolTaskORM]] = relationship(back_populates="assets")

    __table_args__ = (
        CheckConstraint(
            "(project_id IS NOT NULL AND tool_task_id IS NULL AND tool_asset_role IS NULL) "
            "OR (project_id IS NULL AND tool_asset_role IS NOT NULL)",
            name="ck_assets_one_owner",
        ),
    )
    source_task: Mapped[Optional[GenerationTaskORM]] = relationship()


class AigcPipelineTemplateORM(Base):
    __tablename__ = "pipeline_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    definition_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    __table_args__ = (
        CheckConstraint("revision >= 0", name="ck_pipeline_templates_revision"),
    )


class AigcPipelineORM(Base):
    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    source_template_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )
    source_template_revision: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    definition_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latest_run_status: Mapped[Optional[AigcPipelineRunStatus]] = mapped_column(
        enum_column(AigcPipelineRunStatus),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    __table_args__ = (
        CheckConstraint("revision >= 0", name="ck_pipelines_revision"),
    )


class AigcPipelineAssetORM(Base):
    __tablename__ = "pipeline_assets"

    pipeline_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pipelines.id", ondelete="CASCADE"),
        primary_key=True,
    )
    node_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    slot: Mapped[str] = mapped_column(String(80), primary_key=True)
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )


class AigcPipelineRunORM(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    pipeline_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pipelines.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    run_number: Mapped[int] = mapped_column(Integer, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    pipeline_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    mode: Mapped[AigcPipelineRunMode] = mapped_column(
        enum_column(AigcPipelineRunMode), nullable=False
    )
    start_node_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    source_run_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_node_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    status: Mapped[AigcPipelineRunStatus] = mapped_column(
        enum_column(AigcPipelineRunStatus),
        nullable=False,
        default=AigcPipelineRunStatus.QUEUED,
        index=True,
    )
    definition_snapshot: Mapped[dict[str, object]] = mapped_column(
        JSON, nullable=False
    )
    input_snapshot: Mapped[dict[str, object]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    error_json: Mapped[Optional[dict[str, object]]] = mapped_column(JSON, nullable=True)
    cancellation_requested: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint(
            "pipeline_id", "run_number", name="uq_pipeline_runs_number"
        ),
        UniqueConstraint(
            "pipeline_id", "idempotency_key", name="uq_pipeline_runs_idempotency"
        ),
        CheckConstraint("run_number >= 1", name="ck_pipeline_runs_number"),
        CheckConstraint("pipeline_revision >= 0", name="ck_pipeline_runs_revision"),
    )


class AigcPipelineRunNodeORM(Base):
    __tablename__ = "pipeline_run_nodes"

    run_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pipeline_runs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    node_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    included_in_plan: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status: Mapped[AigcRunNodeStatus] = mapped_column(
        enum_column(AigcRunNodeStatus),
        nullable=False,
        default=AigcRunNodeStatus.IDLE,
        index=True,
    )
    current_task_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )
    reused_from_task_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )
    input_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    result_json: Mapped[dict[str, object]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    error_json: Mapped[Optional[dict[str, object]]] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["current_task_id"],
            ["pipeline_tasks.id"],
            ondelete="SET NULL",
            use_alter=True,
            name="fk_pipeline_run_nodes_current_task",
        ),
        ForeignKeyConstraint(
            ["reused_from_task_id"],
            ["pipeline_tasks.id"],
            ondelete="SET NULL",
            use_alter=True,
            name="fk_pipeline_run_nodes_reused_task",
        ),
    )


class AigcPipelineTaskORM(Base):
    __tablename__ = "pipeline_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), primary_key=False)
    node_id: Mapped[str] = mapped_column(String(120), primary_key=False)
    attempt: Mapped[int] = mapped_column(Integer, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[AigcTaskType] = mapped_column(
        enum_column(AigcTaskType, length=32), nullable=False, index=True
    )
    status: Mapped[AigcTaskStatus] = mapped_column(
        enum_column(AigcTaskStatus),
        nullable=False,
        default=AigcTaskStatus.QUEUED,
        index=True,
    )
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    params_json: Mapped[dict[str, object]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    upstream_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    result_json: Mapped[dict[str, object]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    error_json: Mapped[Optional[dict[str, object]]] = mapped_column(JSON, nullable=True)
    metrics_json: Mapped[dict[str, object]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    retry_of_task_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("pipeline_tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    fencing_token: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        ForeignKeyConstraint(
            ["run_id", "node_id"],
            ["pipeline_run_nodes.run_id", "pipeline_run_nodes.node_id"],
            ondelete="CASCADE",
            name="fk_pipeline_tasks_run_node",
        ),
        UniqueConstraint(
            "run_id",
            "node_id",
            "attempt",
            name="uq_pipeline_tasks_attempt",
        ),
        UniqueConstraint(
            "run_id",
            "node_id",
            "idempotency_key",
            name="uq_pipeline_tasks_idempotency",
        ),
        CheckConstraint("attempt >= 1", name="ck_pipeline_tasks_attempt"),
        CheckConstraint(
            "progress >= 0 AND progress <= 100",
            name="ck_pipeline_tasks_progress",
        ),
    )


class AigcPipelineTaskAssetORM(Base):
    __tablename__ = "pipeline_task_assets"

    task_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("pipeline_tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    direction: Mapped[AigcAssetDirection] = mapped_column(
        enum_column(AigcAssetDirection), primary_key=True
    )
    slot: Mapped[str] = mapped_column(String(80), primary_key=True)
    ordinal: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    __table_args__ = (
        CheckConstraint("ordinal >= 0", name="ck_pipeline_task_assets_ordinal"),
    )


class AigcPipelineWorkerLeaseORM(Base):
    __tablename__ = "pipeline_worker_lease"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(120), nullable=False)
    fencing_token: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    lease_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    heartbeat_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "fencing_token >= 1", name="ck_pipeline_worker_lease_fencing"
        ),
    )


class ImageLayerSetORM(Base):
    __tablename__ = "image_layer_sets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    base_asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    canvas_width: Mapped[int] = mapped_column(Integer, nullable=False)
    canvas_height: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[Status] = mapped_column(
        enum_column(Status),
        nullable=False,
        default=Status.SUCCEEDED,
    )
    revision: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    project: Mapped[ProjectORM] = relationship(back_populates="image_layer_sets")
    source_asset: Mapped[AssetORM] = relationship(foreign_keys=[source_asset_id])
    base_asset: Mapped[AssetORM] = relationship(foreign_keys=[base_asset_id])
    layers: Mapped[list[ImageLayerORM]] = relationship(
        back_populates="layer_set",
        cascade="all, delete-orphan",
        order_by="ImageLayerORM.z_index",
    )


class ImageLayerORM(Base):
    __tablename__ = "image_layers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    set_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("image_layer_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    z_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    bbox_absolute: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    bbox_normalized: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    visible: Mapped[bool] = mapped_column(nullable=False, default=True)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    scale: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    layer_set: Mapped[ImageLayerSetORM] = relationship(back_populates="layers")
    asset: Mapped[AssetORM] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "set_id",
            "z_index",
            name="uq_image_layers_set_z_index",
        ),
    )


class CanvasLayoutORM(Base):
    __tablename__ = "canvas_layouts"

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    nodes: Mapped[list[dict[str, object]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    revision: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
