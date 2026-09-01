from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from typing import Protocol

from backend.app.schemas import (
    AigcAssetDirection,
    AigcPipeline,
    AigcPipelineAssetReference,
    AigcPipelineCreate,
    AigcPipelineRun,
    AigcPipelineRunDetail,
    AigcPipelineRunNode,
    AigcPipelineTaskAssetReference,
    AigcPipelineTaskAttempt,
    AigcPipelineTemplate,
    AigcPipelineTemplateCreate,
    AigcPipelineTemplateUpdate,
    AigcPipelineUpdate,
    AigcTaskError,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcTaskStatus,
    AigcWorkerLease,
    Asset,
    AssetCategory,
    AssetCreate,
    AssetRole,
    CanvasLayout,
    CanvasNode,
    CharacterCard,
    CharacterCardCreate,
    GenerationTask,
    GenerationTaskCreate,
    ImagePromptVersion,
    ImagePromptVersionCreate,
    ImageLayerCreate,
    ImageLayerSet,
    ImageLayerSetCreate,
    ImageLayerUpdate,
    Project,
    ProjectCreate,
    ProjectListItem,
    ProjectUpdate,
    StoryboardShot,
    StoryboardShotCreate,
    StoryboardShotVideoConfigUpdate,
    TextArtifact,
    TextArtifactCreate,
    ToolTask,
    ToolTaskCreate,
    ToolTaskInputAsset,
)
from backend.app.schemas.enums import ReferenceAssetKind, Stage, Status, ToolTaskType


class NotFoundError(KeyError):
    """Raised when a requested repository entity is not present."""


class RevisionConflictError(RuntimeError):
    """Raised when an optimistic-lock revision no longer matches."""


class ActiveRunConflictError(RuntimeError):
    """Raised when a pipeline already has an active run."""


class AssetReferenceConflictError(RuntimeError):
    """Raised when an asset is still referenced by an active AIGC entity."""


class PipelineRunConflictError(RuntimeError):
    """Raised when a pipeline is still referenced by an AIGC run."""


class Repository(Protocol):
    def create_aigc_template(
        self,
        data: AigcPipelineTemplateCreate,
    ) -> AigcPipelineTemplate: ...

    def get_aigc_template(self, template_id: str) -> AigcPipelineTemplate: ...

    def list_aigc_templates(
        self,
        q: str | None = None,
    ) -> list[AigcPipelineTemplate]: ...

    def update_aigc_template(
        self,
        template_id: str,
        data: AigcPipelineTemplateUpdate,
    ) -> AigcPipelineTemplate: ...

    def delete_aigc_template(self, template_id: str) -> None: ...

    def create_aigc_pipeline(self, data: AigcPipelineCreate) -> AigcPipeline: ...

    def get_aigc_pipeline(self, pipeline_id: str) -> AigcPipeline: ...

    def list_aigc_pipelines(self, q: str | None = None) -> list[AigcPipeline]: ...

    def update_aigc_pipeline(
        self,
        pipeline_id: str,
        data: AigcPipelineUpdate,
    ) -> AigcPipeline: ...

    def delete_aigc_pipeline(self, pipeline_id: str) -> None: ...

    def list_aigc_pipeline_assets(
        self,
        pipeline_id: str,
    ) -> list[AigcPipelineAssetReference]: ...

    def create_aigc_run(
        self,
        run: AigcPipelineRun,
        *,
        idempotency_key: str,
        nodes: Iterable[AigcPipelineRunNode],
    ) -> AigcPipelineRunDetail: ...

    def get_aigc_run(self, run_id: str) -> AigcPipelineRunDetail: ...

    def list_aigc_runs(self, pipeline_id: str) -> list[AigcPipelineRun]: ...

    def get_aigc_run_asset(
        self,
        pipeline_id: str,
        run_id: str,
        asset_id: str,
    ) -> Asset: ...

    def update_aigc_run(
        self,
        run_id: str,
        **changes: object,
    ) -> AigcPipelineRun: ...

    def update_aigc_run_node(
        self,
        run_id: str,
        node_id: str,
        **changes: object,
    ) -> AigcPipelineRunNode: ...

    def create_aigc_task_attempt(
        self,
        task: AigcPipelineTaskAttempt,
        *,
        idempotency_key: str,
        retry_of_task_id: str | None = None,
    ) -> AigcPipelineTaskAttempt: ...

    def get_aigc_task_attempt(
        self,
        task_id: str,
    ) -> AigcPipelineTaskAttempt: ...

    def update_aigc_task_attempt(
        self,
        task_id: str,
        **changes: object,
    ) -> AigcPipelineTaskAttempt: ...

    def list_aigc_task_attempts(
        self,
        *,
        statuses: set[AigcTaskStatus] | None = None,
    ) -> list[AigcPipelineTaskAttempt]: ...

    def claim_aigc_task_attempt(
        self,
        task_id: str,
        *,
        fencing_token: int,
    ) -> AigcPipelineTaskAttempt | None: ...

    def commit_aigc_task_attempt(
        self,
        task_id: str,
        *,
        fencing_token: int,
        status: AigcTaskStatus,
        result: AigcTaskResult,
        error: AigcTaskError | None,
        metrics: AigcTaskMetrics,
    ) -> tuple[AigcPipelineTaskAttempt, bool]: ...

    def add_aigc_task_assets(
        self,
        references: Iterable[AigcPipelineTaskAssetReference],
    ) -> list[AigcPipelineTaskAssetReference]: ...

    def list_aigc_task_assets(
        self,
        task_id: str,
    ) -> list[AigcPipelineTaskAssetReference]: ...

    def remove_aigc_task_assets(
        self,
        task_id: str,
        *,
        direction: AigcAssetDirection | None = None,
    ) -> list[AigcPipelineTaskAssetReference]: ...

    def acquire_aigc_worker_lease(
        self,
        owner_id: str,
        *,
        now: datetime,
        lease_seconds: int,
    ) -> AigcWorkerLease | None: ...

    def renew_aigc_worker_lease(
        self,
        owner_id: str,
        fencing_token: int,
        *,
        now: datetime,
        lease_seconds: int,
    ) -> AigcWorkerLease | None: ...

    def create_project(self, data: ProjectCreate) -> Project: ...

    def get_project(self, project_id: str) -> Project: ...

    def list_projects(self) -> list[Project]: ...

    def list_project_summaries(self, q: str | None = None) -> list[ProjectListItem]: ...

    def delete_project(self, project_id: str) -> None: ...

    def update_project(self, project_id: str, **changes: object) -> Project: ...

    def update_project_details(
        self,
        project_id: str,
        data: ProjectUpdate,
    ) -> Project: ...

    def save_image_prompt_version(
        self,
        data: ImagePromptVersionCreate,
    ) -> ImagePromptVersion: ...

    def get_image_prompt_version(
        self,
        project_id: str,
        version_id: str,
    ) -> ImagePromptVersion: ...

    def list_image_prompt_versions(
        self,
        project_id: str,
    ) -> list[ImagePromptVersion]: ...

    def mark_image_prompt_stale(self, project_id: str) -> Project: ...

    def set_image_reference_asset_ids(
        self,
        project_id: str,
        asset_ids: list[str],
    ) -> Project: ...

    def set_current_image_asset(
        self,
        project_id: str,
        asset_id: str,
        *,
        expected_revision: int,
    ) -> Project: ...

    def create_task(self, data: GenerationTaskCreate) -> GenerationTask: ...

    def create_task_if_no_active_hash(
        self,
        data: GenerationTaskCreate,
    ) -> tuple[GenerationTask, bool]: ...

    def get_task(self, task_id: str) -> GenerationTask: ...

    def list_project_tasks(self, project_id: str) -> list[GenerationTask]: ...

    def find_active_task(
        self,
        project_id: str,
        stage: Stage,
    ) -> GenerationTask | None: ...

    def update_task(self, task_id: str, **changes: object) -> GenerationTask: ...

    def create_tool_task(self, data: ToolTaskCreate) -> ToolTask: ...

    def create_tool_task_with_input_assets(
        self,
        data: ToolTaskCreate,
        inputs: Iterable[ToolTaskInputAsset],
    ) -> ToolTask: ...

    def get_tool_task(self, task_id: str) -> ToolTask: ...

    def list_tool_task_input_assets(
        self,
        task_id: str,
    ) -> list[ToolTaskInputAsset]: ...

    def list_tool_tasks(
        self,
        *,
        task_type: ToolTaskType | None = None,
    ) -> list[ToolTask]: ...

    def update_tool_task(self, task_id: str, **changes: object) -> ToolTask: ...

    def delete_tool_task(self, task_id: str) -> ToolTask: ...

    def create_asset(self, data: AssetCreate) -> Asset: ...

    def create_assets(self, items: Iterable[AssetCreate]) -> list[Asset]: ...

    def create_asset_and_set_current_image(
        self,
        data: AssetCreate,
        *,
        expected_revision: int,
    ) -> Asset: ...

    def get_asset(self, asset_id: str) -> Asset: ...

    def list_project_assets(self, project_id: str) -> list[Asset]: ...

    def list_assets(
        self,
        *,
        project_id: str | None = None,
        category: AssetCategory | None = None,
        status: Status | None = None,
        asset_role: AssetRole | None = AssetRole.PUBLIC,
    ) -> list[Asset]: ...

    def update_asset(self, asset_id: str, **changes: object) -> Asset: ...

    def delete_asset(self, project_id: str, asset_id: str) -> Asset: ...

    def delete_tool_asset(self, asset_id: str) -> Asset: ...

    def create_image_layer_set(
        self,
        data: ImageLayerSetCreate,
        *,
        layers: Iterable[ImageLayerCreate],
        assets: Iterable[AssetCreate],
    ) -> ImageLayerSet: ...

    def get_image_layer_set(
        self,
        project_id: str,
        set_id: str,
    ) -> ImageLayerSet: ...

    def list_image_layer_sets(self, project_id: str) -> list[ImageLayerSet]: ...

    def update_image_layer_set(
        self,
        project_id: str,
        set_id: str,
        *,
        expected_revision: int,
        layers: Iterable[ImageLayerUpdate],
    ) -> ImageLayerSet: ...

    def replace_image_layer_asset(
        self,
        project_id: str,
        set_id: str,
        *,
        expected_revision: int,
        layer_id: str,
        asset: AssetCreate,
    ) -> ImageLayerSet: ...

    def get_canvas_layout(self, project_id: str) -> CanvasLayout: ...

    def save_canvas_layout(
        self,
        project_id: str,
        *,
        expected_revision: int,
        nodes: Iterable[CanvasNode],
    ) -> CanvasLayout: ...

    def create_character_card(self, data: CharacterCardCreate) -> CharacterCard: ...

    def get_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard: ...

    def list_project_character_cards(self, project_id: str) -> list[CharacterCard]: ...

    def mark_character_cards_stale(
        self,
        project_id: str,
    ) -> list[CharacterCard]: ...

    def update_character_card(
        self,
        project_id: str,
        card_id: str,
        **changes: object,
    ) -> CharacterCard: ...

    def delete_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard: ...

    def replace_project_storyboard(
        self,
        project_id: str,
        shots: Iterable[StoryboardShotCreate],
    ) -> list[StoryboardShot]: ...

    def list_project_storyboard(self, project_id: str) -> list[StoryboardShot]: ...

    def mark_storyboard_shots_stale(
        self,
        project_id: str,
    ) -> list[StoryboardShot]: ...

    def get_storyboard_shot(self, project_id: str, shot_id: str) -> StoryboardShot: ...

    def get_storyboard_shot_by_index(
        self,
        project_id: str,
        shot_index: int,
    ) -> StoryboardShot: ...

    def save_storyboard_shot_video_config(
        self,
        project_id: str,
        shot_id: str,
        data: StoryboardShotVideoConfigUpdate,
    ) -> StoryboardShot: ...

    def attach_storyboard_shot_reference(
        self,
        project_id: str,
        shot_id: str,
        *,
        kind: ReferenceAssetKind,
        asset_id: str,
    ) -> StoryboardShot: ...

    def remove_storyboard_shot_reference(
        self,
        project_id: str,
        shot_id: str,
        *,
        kind: ReferenceAssetKind,
        asset_id: str,
    ) -> StoryboardShot: ...

    def set_storyboard_shot_first_frame(
        self,
        project_id: str,
        shot_id: str,
        *,
        asset_id: str | None,
        source_video_asset_id: str | None,
    ) -> StoryboardShot: ...

    def set_storyboard_shot_video_asset(
        self,
        project_id: str,
        shot_id: str,
        asset_id: str,
    ) -> StoryboardShot: ...

    def delete_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
    ) -> StoryboardShot: ...

    def merge_storyboard_shots(
        self,
        project_id: str,
        shot_ids: Iterable[str],
    ) -> StoryboardShot: ...

    def split_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
    ) -> list[StoryboardShot]: ...

    def create_text_artifact(self, data: TextArtifactCreate) -> TextArtifact: ...

    def get_text_artifact(self, artifact_id: str) -> TextArtifact: ...

    def list_project_text_artifacts(self, project_id: str) -> list[TextArtifact]: ...

    def get_latest_text_artifact(
        self,
        project_id: str,
        stage: Stage,
        *,
        include_stale: bool = False,
    ) -> TextArtifact | None: ...

    def update_text_artifact(
        self,
        artifact_id: str,
        **changes: object,
    ) -> TextArtifact: ...

    def delete_text_artifact(
        self,
        project_id: str,
        artifact_id: str,
    ) -> TextArtifact: ...

    def mark_text_artifacts_stale(
        self,
        project_id: str,
        stages: Iterable[Stage],
    ) -> list[TextArtifact]: ...

    def mark_assets_stale(
        self,
        project_id: str,
        stages: Iterable[Stage],
    ) -> list[Asset]: ...

    def mark_storyboard_video_assets_stale(
        self,
        project_id: str,
        shot_ids: Iterable[str],
        *,
        asset_ids: Iterable[str] | None = None,
    ) -> list[Asset]: ...
