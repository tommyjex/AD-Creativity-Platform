from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Iterable

from pydantic import Field

from backend.app.repositories import NotFoundError, Repository
from backend.app.schemas import (
    Asset,
    AssetCategory,
    AssetCreate,
    AssetType,
    CharacterAssetIterationOperation,
    CharacterCard,
    ErrorCode,
    GenerationTask,
    GenerationTaskCreate,
    Project,
    Stage,
    Status,
    TaskError,
    TextArtifact,
    TextArtifactCreate,
)
from backend.app.schemas.common import SchemaModel, utc_now
from backend.app.services.assets import AssetStorageService, StoredAssetInput


PIPELINE_STAGES: tuple[Stage, ...] = (
    Stage.BRIEF,
    Stage.STORY,
    Stage.CHARACTER,
    Stage.SCRIPT,
    Stage.STORYBOARD,
    Stage.IMAGE,
    Stage.VIDEO,
    Stage.COMPOSE,
)

TASK_STAGES: frozenset[Stage] = frozenset(
    stage for stage in PIPELINE_STAGES if stage != Stage.BRIEF
)

TEXT_STAGES: frozenset[Stage] = frozenset(
    {
        Stage.STORY,
        Stage.SCRIPT,
        Stage.STORYBOARD,
    }
)

ACTIVE_TASK_STATUSES: frozenset[Status] = frozenset(
    {
        Status.QUEUED,
        Status.RUNNING,
    }
)

CHARACTER_CARD_IMAGE_TASK_PREFIX = "character_card_image:"


class WorkflowError(Exception):
    def __init__(self, code: ErrorCode, message: str, detail: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail

    def to_task_error(self) -> TaskError:
        return TaskError(code=self.code, message=self.message, detail=self.detail)


class StaleResult(SchemaModel):
    text_artifacts: list[TextArtifact] = Field(default_factory=list)
    assets: list[Asset] = Field(default_factory=list)


class WorkflowService:
    """Coordinates stage validation, task lifecycle and artifact freshness."""

    def __init__(
        self,
        repository: Repository,
        asset_storage: AssetStorageService | None = None,
    ) -> None:
        self.repository = repository
        self.asset_storage = asset_storage or AssetStorageService.from_settings()

    def create_task(
        self,
        project_id: str,
        stage: Stage,
        *,
        input_hash: str | None = None,
        reuse_active: bool = True,
    ) -> GenerationTask:
        self.validate_stage_dependencies(project_id, stage)

        if reuse_active:
            active_task = self.repository.find_active_task(project_id, stage)
            if active_task is not None:
                return active_task

        task = self.repository.create_task(
            GenerationTaskCreate(
                project_id=project_id,
                stage=stage,
                input_hash=input_hash or self.compute_input_hash(project_id, stage),
            )
        )
        self.repository.update_project(
            project_id,
            current_stage=stage,
            status=Status.QUEUED,
        )
        return task

    def validate_stage_dependencies(self, project_id: str, stage: Stage) -> None:
        self._require_project(project_id)

        if stage not in TASK_STAGES:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                f"{stage.value} is not a generation task stage",
            )

        if stage == Stage.STORY:
            return

        if stage == Stage.CHARACTER:
            self._require_fresh_text(project_id, Stage.STORY)
            return

        if stage == Stage.SCRIPT:
            self._require_fresh_text(project_id, Stage.STORY)
            self._require_character_resolution(project_id)
            return

        if stage == Stage.STORYBOARD:
            self._require_fresh_text(project_id, Stage.SCRIPT)
            return

        if stage == Stage.IMAGE:
            self._require_fresh_text(project_id, Stage.STORYBOARD)
            return

        if stage == Stage.VIDEO:
            self._require_succeeded_asset(project_id, Stage.IMAGE)
            return

        if stage == Stage.COMPOSE:
            self._require_succeeded_asset(project_id, Stage.VIDEO)
            return

        raise WorkflowError(
            ErrorCode.INVALID_STATE,
            f"unsupported stage: {stage.value}",
            detail=f"project_id={project_id}",
        )

    def require_fresh_text_artifact(
        self,
        project_id: str,
        stage: Stage,
    ) -> TextArtifact:
        return self._require_fresh_text(project_id, stage)

    def skip_stage(self, project_id: str, stage: Stage) -> GenerationTask:
        if stage != Stage.CHARACTER:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                f"{stage.value} cannot be skipped",
            )
        self.validate_stage_dependencies(project_id, stage)

        latest_task = self._latest_stage_task(project_id, stage)
        if latest_task is not None and latest_task.status == Status.SKIPPED:
            return latest_task
        if latest_task is not None and latest_task.status == Status.SUCCEEDED:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                "character stage already succeeded and cannot be skipped",
                detail=f"project_id={project_id}",
            )

        task = (
            latest_task
            if latest_task is not None and latest_task.status in ACTIVE_TASK_STATUSES
            else self.create_task(project_id, stage)
        )
        skipped = self.repository.update_task(
            task.id,
            status=Status.SKIPPED,
            progress=1.0,
            error=None,
            finished_at=utc_now(),
        )
        self.repository.update_project(
            project_id,
            current_stage=stage,
            status=Status.SKIPPED,
        )
        return skipped

    def update_character_card(
        self,
        project_id: str,
        card_id: str,
        **changes: object,
    ) -> CharacterCard:
        self._require_project(project_id)
        if not changes:
            raise WorkflowError(
                ErrorCode.VALIDATION_ERROR,
                "at least one character card field must be provided",
            )
        existing = self._require_character_card(project_id, card_id)
        try:
            updated = self.repository.update_character_card(
                project_id,
                card_id,
                **changes,
            )
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"character card not found: {card_id}",
                detail=f"project_id={project_id}",
            ) from None
        # Only a change to the character *image* (asset_id) alters the visual
        # inputs that downstream stages depend on. Pure metadata edits (name,
        # description, sort_order, status) do not change any already-generated
        # image, and downstream script/storyboard/video generation never reads
        # these fields, so editing them must not invalidate downstream assets.
        if updated.asset_id != existing.asset_id:
            self.mark_downstream_stale(project_id, Stage.CHARACTER)
            self.repository.update_project(
                project_id,
                current_stage=Stage.CHARACTER,
                status=Status.STALE,
            )
        return updated

    def delete_character_card(self, project_id: str, card_id: str) -> CharacterCard:
        self._require_project(project_id)
        try:
            deleted = self.repository.delete_character_card(project_id, card_id)
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"character card not found: {card_id}",
                detail=f"project_id={project_id}",
            ) from None
        self.mark_downstream_stale(project_id, Stage.CHARACTER)
        self.repository.update_project(
            project_id,
            current_stage=Stage.CHARACTER,
            status=Status.STALE,
        )
        return deleted

    def begin_character_card_image_generation(
        self,
        project_id: str,
        card_id: str,
    ) -> tuple[GenerationTask, CharacterCard]:
        card = self._require_character_card(project_id, card_id)
        input_hash = self._character_card_image_input_hash(project_id, card)
        for active_task in self._active_character_tasks(project_id):
            if active_task.input_hash == input_hash:
                raise WorkflowError(
                    ErrorCode.TASK_CONFLICT,
                    "character image generation task is already active",
                    detail=f"project_id={project_id}",
                )
            if self._is_character_card_image_task(active_task):
                continue
            raise WorkflowError(
                ErrorCode.TASK_CONFLICT,
                "another character task is already active",
                detail=f"project_id={project_id}",
            )

        task = self.create_task(
            project_id,
            Stage.CHARACTER,
            input_hash=input_hash,
            reuse_active=False,
        )
        return self.start_task(task.id), card

    def complete_character_card_image_generation(
        self,
        project_id: str,
        card_id: str,
        task_id: str,
        asset_id: str,
    ) -> tuple[GenerationTask, CharacterCard]:
        self._require_project(project_id)
        asset = self._get_asset(asset_id)
        if asset.project_id != project_id:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"asset not found: {asset_id}",
                detail=f"project_id={project_id}",
            )
        if (
            asset.stage != Stage.CHARACTER
            or asset.category != AssetCategory.CHARACTER
            or asset.status != Status.SUCCEEDED
        ):
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                "generated asset must be a succeeded character asset",
                detail=f"asset_id={asset_id}",
            )
        try:
            card = self.repository.update_character_card(
                project_id,
                card_id,
                asset_id=asset_id,
                status=Status.SUCCEEDED,
            )
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"character card not found: {card_id}",
                detail=f"project_id={project_id}",
            ) from None
        completed = self.complete_task(task_id, output_asset_ids=[asset_id])
        if not self._has_fresh_character_resolution(
            project_id,
            exclude_task_id=completed.id,
        ):
            completed = self.repository.update_task(
                completed.id,
                input_hash=self.compute_input_hash(project_id, Stage.CHARACTER),
            )
        self.mark_downstream_stale(project_id, Stage.CHARACTER)
        self.repository.update_project(
            project_id,
            current_stage=Stage.CHARACTER,
            status=Status.STALE,
        )
        return completed, card

    def begin_character_asset_iteration(
        self,
        project_id: str,
        *,
        asset_id: str,
        prompt: str,
        operation_type: CharacterAssetIterationOperation,
    ) -> tuple[GenerationTask, Asset]:
        source_asset = self._require_character_iteration_source(project_id, asset_id)
        input_hash = self._character_iteration_input_hash(
            project_id,
            source_asset,
            prompt=prompt,
            operation_type=operation_type,
        )

        active_task = self.repository.find_active_task(project_id, Stage.CHARACTER)
        if active_task is not None:
            if active_task.input_hash != input_hash:
                raise WorkflowError(
                    ErrorCode.TASK_CONFLICT,
                    "another character iteration task is already active",
                    detail=f"project_id={project_id}",
                )
            raise WorkflowError(
                ErrorCode.TASK_CONFLICT,
                "character iteration task is already active",
                detail=f"project_id={project_id}",
            )
        else:
            task = self.create_task(
                project_id,
                Stage.CHARACTER,
                input_hash=input_hash,
            )

        task = self.start_task(task.id)
        return task, source_asset

    def submit_character_asset_iteration(
        self,
        project_id: str,
        *,
        asset_id: str,
        prompt: str,
        operation_type: CharacterAssetIterationOperation,
    ) -> tuple[GenerationTask, Asset]:
        source_asset = self._require_character_iteration_source(project_id, asset_id)
        input_hash = self._character_iteration_input_hash(
            project_id,
            source_asset,
            prompt=prompt,
            operation_type=operation_type,
        )

        active_task = self.repository.find_active_task(project_id, Stage.CHARACTER)
        if active_task is not None:
            if active_task.input_hash != input_hash:
                raise WorkflowError(
                    ErrorCode.TASK_CONFLICT,
                    "another character iteration task is already active",
                    detail=f"project_id={project_id}",
                )
            if active_task.output_asset_ids:
                return active_task, self._get_asset(active_task.output_asset_ids[-1])
            task = active_task
        else:
            task = self.create_task(
                project_id,
                Stage.CHARACTER,
                input_hash=input_hash,
            )

        placeholder_asset = self.repository.create_asset(
            AssetCreate(
                project_id=project_id,
                type=AssetType.GENERATED_IMAGE,
                category=AssetCategory.CHARACTER,
                status=Status.QUEUED,
                stage=Stage.CHARACTER,
                mime_type="image/png",
                source_task_id=task.id,
                metadata=self.build_character_iteration_metadata(
                    source_asset,
                    prompt=prompt,
                    operation_type=operation_type,
                ),
            )
        )
        task = self.attach_task_outputs(task.id, asset_ids=[placeholder_asset.id])
        self.repository.update_project(
            project_id,
            current_stage=Stage.CHARACTER,
            status=Status.QUEUED,
        )
        return task, placeholder_asset

    def start_task(self, task_id: str) -> GenerationTask:
        task = self._get_task(task_id)
        if task.status not in ACTIVE_TASK_STATUSES:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                f"task {task_id} cannot start from status {task.status.value}",
            )

        started_at = task.started_at or utc_now()
        updated = self.repository.update_task(
            task_id,
            status=Status.RUNNING,
            progress=max(task.progress, 0.01),
            started_at=started_at,
        )
        self.repository.update_project(
            task.project_id,
            current_stage=task.stage,
            status=Status.RUNNING,
        )
        return updated

    def update_task_progress(
        self,
        task_id: str,
        *,
        progress: float,
        message: str | None = None,
    ) -> GenerationTask:
        task = self._get_task(task_id)
        if task.status not in ACTIVE_TASK_STATUSES:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                f"task {task_id} cannot update progress from status {task.status.value}",
            )
        return self.repository.update_task(
            task_id,
            progress=min(max(progress, 0.0), 1.0),
            progress_message=message,
        )

    def complete_task(
        self,
        task_id: str,
        *,
        output_asset_ids: Iterable[str] | None = None,
        output_text_artifact_id: str | None = None,
    ) -> GenerationTask:
        task = self._get_task(task_id)
        output_ids = list(output_asset_ids or task.output_asset_ids)
        updated = self.repository.update_task(
            task_id,
            status=Status.SUCCEEDED,
            progress=1.0,
            progress_message=task.progress_message,
            error=None,
            output_asset_ids=output_ids,
            output_text_artifact_id=output_text_artifact_id
            or task.output_text_artifact_id,
            finished_at=utc_now(),
        )
        self.repository.update_project(
            task.project_id,
            current_stage=task.stage,
            status=Status.SUCCEEDED,
        )
        return updated

    def fail_task(
        self,
        task_id: str,
        *,
        code: ErrorCode = ErrorCode.GENERATION_FAILED,
        message: str,
        detail: str | None = None,
    ) -> GenerationTask:
        task = self._get_task(task_id)
        updated = self.repository.update_task(
            task_id,
            status=Status.FAILED,
            error=TaskError(code=code, message=message, detail=detail),
            finished_at=utc_now(),
        )
        self.repository.update_project(
            task.project_id,
            current_stage=task.stage,
            status=Status.FAILED,
        )
        return updated

    def write_text_artifact(
        self,
        project_id: str,
        stage: Stage,
        *,
        content: str,
        title: str | None = None,
        task_id: str | None = None,
    ) -> TextArtifact:
        if stage not in TEXT_STAGES:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                f"{stage.value} does not produce a text artifact",
            )
        self._require_project(project_id)

        latest = self.repository.get_latest_text_artifact(
            project_id,
            stage,
            include_stale=True,
        )
        artifact = self.repository.create_text_artifact(
            TextArtifactCreate(
                project_id=project_id,
                stage=stage,
                title=title,
                content=content,
                version=(latest.version + 1) if latest else 1,
                status=Status.SUCCEEDED,
            )
        )
        self.repository.update_project(
            project_id,
            current_stage=stage,
            status=Status.SUCCEEDED,
        )

        if task_id is not None:
            self.complete_task(task_id, output_text_artifact_id=artifact.id)

        return artifact

    def edit_text_artifact(
        self,
        project_id: str,
        stage: Stage,
        *,
        content: str,
        title: str | None = None,
    ) -> TextArtifact:
        self._require_project(project_id)
        artifact = self.repository.get_latest_text_artifact(
            project_id,
            stage,
            include_stale=True,
        )
        if artifact is None:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"no text artifact found for stage {stage.value}",
                detail=f"project_id={project_id}",
            )

        update_fields: dict[str, object] = {
            "content": content,
            "version": artifact.version + 1,
            "status": Status.SUCCEEDED,
        }
        if title is not None:
            update_fields["title"] = title

        updated = self.repository.update_text_artifact(artifact.id, **update_fields)
        self.mark_downstream_stale(project_id, stage)
        self.repository.update_project(
            project_id,
            current_stage=stage,
            status=Status.STALE,
        )
        return updated

    def create_asset(
        self,
        project_id: str,
        asset_type: AssetType,
        *,
        stage: Stage,
        category: AssetCategory | None = None,
        status: Status = Status.SUCCEEDED,
        url: str | None = None,
        mime_type: str | None = None,
        size_bytes: int | None = None,
        source_task_id: str | None = None,
        metadata: dict[str, str | int | float | bool | None] | None = None,
    ) -> Asset:
        self._require_project(project_id)
        asset = self.asset_storage.register_asset(
            self.repository,
            StoredAssetInput(
                project_id=project_id,
                type=asset_type,
                category=category,
                status=status,
                stage=stage,
                source_url=url,
                mime_type=mime_type,
                size_bytes=size_bytes,
                source_task_id=source_task_id,
                metadata=metadata or {},
            )
        )
        self.repository.update_project(
            project_id,
            current_stage=stage,
            status=status,
        )
        return asset

    async def create_assets_from_sources(
        self,
        project_id: str,
        items: list[StoredAssetInput],
        *,
        stage: Stage,
        status: Status = Status.SUCCEEDED,
    ) -> list[Asset]:
        self._require_project(project_id)
        assets = await self.asset_storage.upload_assets_from_sources(
            self.repository,
            items,
        )
        self.repository.update_project(
            project_id,
            current_stage=stage,
            status=status,
        )
        return assets

    def attach_task_outputs(
        self,
        task_id: str,
        *,
        asset_ids: Iterable[str] | None = None,
        text_artifact_id: str | None = None,
    ) -> GenerationTask:
        task = self._get_task(task_id)
        merged_asset_ids = list(dict.fromkeys([*task.output_asset_ids, *(asset_ids or [])]))
        return self.repository.update_task(
            task_id,
            output_asset_ids=merged_asset_ids,
            output_text_artifact_id=text_artifact_id or task.output_text_artifact_id,
        )

    def mark_downstream_stale(self, project_id: str, stage: Stage) -> StaleResult:
        downstream = self.get_downstream_stages(stage)
        text_artifacts = self.repository.mark_text_artifacts_stale(
            project_id,
            [stage for stage in downstream if stage in TEXT_STAGES],
        )
        assets = self.repository.mark_assets_stale(
            project_id,
            [stage for stage in downstream if stage not in {Stage.BRIEF, Stage.STORY}],
        )
        return StaleResult(text_artifacts=text_artifacts, assets=assets)

    def mark_language_dependents_stale(self, project_id: str) -> StaleResult:
        stale_result = self.mark_downstream_stale(project_id, Stage.STORY)
        self.repository.mark_character_cards_stale(project_id)
        self.repository.mark_storyboard_shots_stale(project_id)
        self.repository.update_project(
            project_id,
            current_stage=Stage.CHARACTER,
            status=Status.STALE,
        )
        return stale_result

    def compute_input_hash(self, project_id: str, stage: Stage) -> str:
        project = self._require_project(project_id)
        payload: dict[str, object] = {
            "project_id": project_id,
            "stage": stage.value,
        }

        if stage == Stage.STORY:
            payload["brief"] = project.brief.model_dump(mode="json")
        elif stage == Stage.CHARACTER:
            artifact = self._require_fresh_text(project_id, Stage.STORY)
            payload["artifact"] = self._artifact_hash_payload(artifact)
            payload["target_language"] = project.brief.target_language.value
        elif stage == Stage.SCRIPT:
            artifact = self._require_fresh_text(project_id, Stage.STORY)
            payload["artifact"] = self._artifact_hash_payload(artifact)
            payload["character"] = self._character_dependency_payload(project_id)
        elif stage in {Stage.STORYBOARD, Stage.IMAGE}:
            upstream_stage = {
                Stage.STORYBOARD: Stage.SCRIPT,
                Stage.IMAGE: Stage.STORYBOARD,
            }[stage]
            artifact = self._require_fresh_text(project_id, upstream_stage)
            payload["artifact"] = self._artifact_hash_payload(artifact)
        elif stage in {Stage.VIDEO, Stage.COMPOSE}:
            upstream_stage = Stage.IMAGE if stage == Stage.VIDEO else Stage.VIDEO
            assets = self._succeeded_assets(project_id, upstream_stage)
            if not assets:
                self._raise_dependency_missing(project_id, upstream_stage, "asset")
            payload["assets"] = [
                self._asset_hash_payload(asset)
                for asset in sorted(assets, key=lambda item: item.id)
            ]
        else:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                f"cannot compute input hash for stage {stage.value}",
            )

        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
        return hashlib.sha256(encoded).hexdigest()

    def get_downstream_stages(self, stage: Stage) -> tuple[Stage, ...]:
        if stage not in PIPELINE_STAGES:
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                f"unsupported stage: {stage.value}",
            )
        stage_index = PIPELINE_STAGES.index(stage)
        return PIPELINE_STAGES[stage_index + 1 :]

    def _require_fresh_text(self, project_id: str, stage: Stage) -> TextArtifact:
        artifact = self.repository.get_latest_text_artifact(project_id, stage)
        if artifact is None or artifact.status != Status.SUCCEEDED:
            self._raise_dependency_missing(project_id, stage, "text artifact")
        return artifact

    def _require_succeeded_asset(self, project_id: str, stage: Stage) -> Asset:
        assets = self._succeeded_assets(project_id, stage)
        if not assets:
            self._raise_dependency_missing(project_id, stage, "asset")
        return assets[0]

    def _require_character_iteration_source(
        self,
        project_id: str,
        asset_id: str,
    ) -> Asset:
        try:
            asset = self.repository.get_asset(asset_id)
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"asset not found: {asset_id}",
            ) from None

        if asset.project_id != project_id:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"asset not found: {asset_id}",
                detail=f"project_id={project_id}",
            )
        if (
            asset.stage != Stage.CHARACTER
            or asset.category != AssetCategory.CHARACTER
            or asset.status != Status.SUCCEEDED
        ):
            raise WorkflowError(
                ErrorCode.INVALID_STATE,
                "source asset must be a succeeded character asset",
                detail=f"asset_id={asset_id}",
            )
        return asset

    def _require_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard:
        try:
            return self.repository.get_character_card(project_id, card_id)
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"character card not found: {card_id}",
                detail=f"project_id={project_id}",
            ) from None

    def _require_character_resolution(self, project_id: str) -> GenerationTask:
        expected_hash = self.compute_input_hash(project_id, Stage.CHARACTER)
        matching_tasks = self._fresh_character_resolution_tasks(
            project_id,
            expected_hash,
        )
        task = (
            max(matching_tasks, key=lambda item: (item.created_at, item.id))
            if matching_tasks
            else None
        )
        if task is None:
            task = self._latest_completed_character_card_image_task(project_id)
        cards = self._character_cards(project_id)
        if task is None:
            self._raise_dependency_missing(
                project_id,
                Stage.CHARACTER,
                "completed or skipped task",
            )
        if task.status == Status.SUCCEEDED and not cards:
            self._raise_dependency_missing(
                project_id,
                Stage.CHARACTER,
                "character card",
            )
        if (
            task.status == Status.SUCCEEDED
            and self._is_character_card_image_task(task)
            and not self._character_cards_are_resolved(cards)
        ):
            self._raise_dependency_missing(
                project_id,
                Stage.CHARACTER,
                "resolved character card",
            )
        return task

    def _has_fresh_character_resolution(
        self,
        project_id: str,
        *,
        exclude_task_id: str | None = None,
    ) -> bool:
        expected_hash = self.compute_input_hash(project_id, Stage.CHARACTER)
        return any(
            task.id != exclude_task_id
            for task in self._fresh_character_resolution_tasks(
                project_id,
                expected_hash,
            )
        )

    def _fresh_character_resolution_tasks(
        self,
        project_id: str,
        expected_hash: str,
    ) -> list[GenerationTask]:
        return [
            task
            for task in self.repository.list_project_tasks(project_id)
            if task.stage == Stage.CHARACTER
            and task.input_hash == expected_hash
            and task.status in {Status.SUCCEEDED, Status.SKIPPED}
        ]

    def _latest_completed_character_card_image_task(
        self,
        project_id: str,
    ) -> GenerationTask | None:
        tasks = [
            task
            for task in self.repository.list_project_tasks(project_id)
            if task.stage == Stage.CHARACTER
            and task.status == Status.SUCCEEDED
            and self._is_character_card_image_task(task)
        ]
        return max(tasks, key=lambda item: (item.created_at, item.id)) if tasks else None

    @staticmethod
    def _character_cards_are_resolved(cards: list[CharacterCard]) -> bool:
        return bool(cards) and all(
            card.status == Status.SUCCEEDED and card.asset_id for card in cards
        )

    def _character_dependency_payload(self, project_id: str) -> dict[str, object]:
        task = self._require_character_resolution(project_id)
        payload: dict[str, object] = {
            "task_id": task.id,
            "status": task.status.value,
        }
        if task.status == Status.SUCCEEDED:
            payload["cards"] = [
                self._character_card_hash_payload(card)
                for card in self._character_cards(project_id)
            ]
        return payload

    def _latest_stage_task(
        self,
        project_id: str,
        stage: Stage,
    ) -> GenerationTask | None:
        tasks = [
            task
            for task in self.repository.list_project_tasks(project_id)
            if task.stage == stage
        ]
        if not tasks:
            return None
        return max(tasks, key=lambda task: (task.created_at, task.id))

    def _succeeded_assets(self, project_id: str, stage: Stage) -> list[Asset]:
        try:
            assets = self.repository.list_project_assets(project_id)
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"project not found: {project_id}",
            ) from None

        return [
            asset
            for asset in assets
            if asset.stage == stage and asset.status == Status.SUCCEEDED
        ]

    def _character_cards(self, project_id: str) -> list[CharacterCard]:
        try:
            return self.repository.list_project_character_cards(project_id)
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"project not found: {project_id}",
            ) from None

    def _require_project(self, project_id: str) -> Project:
        try:
            return self.repository.get_project(project_id)
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"project not found: {project_id}",
            ) from None

    def _get_task(self, task_id: str) -> GenerationTask:
        try:
            return self.repository.get_task(task_id)
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"task not found: {task_id}",
            ) from None

    def _get_asset(self, asset_id: str) -> Asset:
        try:
            return self.repository.get_asset(asset_id)
        except NotFoundError:
            raise WorkflowError(
                ErrorCode.NOT_FOUND,
                f"asset not found: {asset_id}",
            ) from None

    def _character_iteration_input_hash(
        self,
        project_id: str,
        source_asset: Asset,
        *,
        prompt: str,
        operation_type: CharacterAssetIterationOperation,
    ) -> str:
        payload = {
            "project_id": project_id,
            "stage": Stage.CHARACTER.value,
            "operation_type": operation_type.value,
            "source_asset": self._asset_hash_payload(source_asset),
            "prompt": prompt,
            "model": self._character_asset_model(source_asset),
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
        return hashlib.sha256(encoded).hexdigest()

    def _character_card_image_input_hash(
        self,
        project_id: str,
        card: CharacterCard,
    ) -> str:
        del project_id
        return f"{CHARACTER_CARD_IMAGE_TASK_PREFIX}{card.id}"

    def _active_character_tasks(self, project_id: str) -> list[GenerationTask]:
        return [
            task
            for task in self.repository.list_project_tasks(project_id)
            if task.stage == Stage.CHARACTER and task.status in ACTIVE_TASK_STATUSES
        ]

    @staticmethod
    def _is_character_card_image_task(task: GenerationTask) -> bool:
        return bool(
            task.input_hash
            and task.input_hash.startswith(CHARACTER_CARD_IMAGE_TASK_PREFIX)
        )

    @staticmethod
    def build_character_iteration_metadata(
        source_asset: Asset,
        *,
        prompt: str,
        operation_type: CharacterAssetIterationOperation,
    ) -> dict[str, str | int | float | bool | None]:
        previous_prompt = _metadata_text(
            source_asset.metadata,
            "current_prompt",
            "prompt_summary",
            "source_prompt",
            "description",
        )
        return {
            "model": WorkflowService._character_asset_model(source_asset),
            "source_asset_id": source_asset.id,
            "operation_type": operation_type.value,
            "prompt_history": previous_prompt,
            "current_prompt": prompt,
        }

    @staticmethod
    def build_character_card_image_metadata(
        card: CharacterCard,
        *,
        prompt: str,
    ) -> dict[str, str | int | float | bool | None]:
        return {
            "character_card_id": card.id,
            "character_name": card.name,
            "character_description": card.description,
            "operation_type": "character_card_image",
            "current_prompt": prompt,
        }

    @staticmethod
    def _character_asset_model(source_asset: Asset) -> str | None:
        model = source_asset.metadata.get("model")
        return model if isinstance(model, str) and model.strip() else None

    @staticmethod
    def _artifact_hash_payload(artifact: TextArtifact) -> dict[str, object]:
        return {
            "id": artifact.id,
            "stage": artifact.stage.value,
            "version": artifact.version,
            "updated_at": _json_datetime(artifact.updated_at),
        }

    @staticmethod
    def _asset_hash_payload(asset: Asset) -> dict[str, object]:
        return {
            "id": asset.id,
            "type": asset.type.value,
            "stage": asset.stage.value if asset.stage else None,
            "updated_at": _json_datetime(asset.updated_at),
        }

    @staticmethod
    def _character_card_hash_payload(card: CharacterCard) -> dict[str, object]:
        return {
            "id": card.id,
            "name": card.name,
            "description": card.description,
            "sort_order": card.sort_order,
            "asset_id": card.asset_id,
            "status": card.status.value,
            "updated_at": _json_datetime(card.updated_at),
        }

    @staticmethod
    def _raise_dependency_missing(
        project_id: str,
        stage: Stage,
        dependency_kind: str,
    ) -> None:
        raise WorkflowError(
            ErrorCode.DEPENDENCY_MISSING,
            f"missing fresh {dependency_kind} from stage {stage.value}",
            detail=f"project_id={project_id}",
        )


def _json_datetime(value: datetime) -> str:
    return value.isoformat()


def _metadata_text(
    metadata: dict[str, str | int | float | bool | None],
    *keys: str,
) -> str | None:
    for key in keys:
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None
