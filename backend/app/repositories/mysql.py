from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session, selectinload, sessionmaker

from backend.app.db.models import (
    AssetORM,
    BriefORM,
    CharacterCardORM,
    GenerationTaskORM,
    ImageLayerORM,
    ImageLayerSetORM,
    ImagePromptVersionORM,
    ProjectORM,
    StoryboardShotORM,
    TextArtifactORM,
)
from backend.app.db.session import get_engine, make_session_factory
from backend.app.schemas import (
    Asset,
    AssetCategory,
    AssetCreate,
    AssetRole,
    AssetType,
    CharacterCard,
    CharacterCardCreate,
    GenerationTask,
    GenerationTaskCreate,
    ImagePromptVersion,
    ImagePromptVersionCreate,
    ImageLayer,
    ImageLayerCreate,
    ImageLayerSet,
    ImageLayerSetCreate,
    ImageLayerUpdate,
    Project,
    ProjectBase,
    ProjectCreate,
    ProjectListItem,
    ProjectUpdate,
    ReferenceAssetKind,
    StoryboardAtomicShotSnapshot,
    StoryboardShot,
    StoryboardShotCreate,
    StoryboardShotVideoConfigUpdate,
    TaskError,
    TargetLanguage,
    TextArtifact,
    TextArtifactCreate,
)
from backend.app.schemas.brief import Brief
from backend.app.schemas.common import utc_now
from backend.app.schemas.enums import Stage, Status
from backend.app.video_prompt import (
    build_merged_shot_video_prompt,
    expand_atomic_shots,
)

from .base import NotFoundError, RevisionConflictError


class MySQLRepository:
    """SQLAlchemy-backed repository compatible with InMemoryRepository."""

    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self._session_factory = session_factory or make_session_factory(get_engine())

    def create_project(self, data: ProjectCreate) -> Project:
        brief = Brief(**data.brief.model_dump())
        project = Project(
            name=data.name or self._default_project_name(brief),
            project_type=data.project_type,
            brief=brief,
            current_stage=(
                Stage.IMAGE
                if data.project_type.value == "image_asset"
                else Stage.BRIEF
            ),
        )

        with self._session_factory.begin() as session:
            orm_project = ProjectORM(
                id=project.id,
                name=project.name,
                project_type=project.project_type,
                status=project.status,
                current_stage=project.current_stage,
                current_image_prompt_version_id=(
                    project.current_image_prompt_version_id
                ),
                image_prompt_status=project.image_prompt_status,
                current_image_asset_id=project.current_image_asset_id,
                image_revision=project.image_revision,
                created_at=project.created_at,
                updated_at=project.updated_at,
                deleted_at=None,
            )
            orm_project.brief = BriefORM(
                prompt=project.brief.prompt,
                target_language=project.brief.target_language,
                target_platform=project.brief.target_platform,
                aspect_ratio=project.brief.aspect_ratio,
                duration_seconds=project.brief.duration_seconds,
                image_purpose=project.brief.image_purpose,
                style=project.brief.style,
                audience=project.brief.audience,
                product_name=project.brief.product_name,
                summary=project.brief.summary,
                selling_points=project.brief.selling_points,
            )
            session.add(orm_project)
            session.flush()
            return self._project_from_orm(orm_project)

    def get_project(self, project_id: str) -> Project:
        with self._session_factory() as session:
            return self._project_from_orm(self._require_project(session, project_id))

    def list_projects(self) -> list[Project]:
        with self._session_factory() as session:
            projects = session.scalars(
                select(ProjectORM)
                .where(ProjectORM.deleted_at.is_(None))
                .order_by(ProjectORM.created_at)
            ).all()
            return [self._project_from_orm(project) for project in projects]

    def list_project_summaries(self, q: str | None = None) -> list[ProjectListItem]:
        # The list view only needs scalar columns plus the brief, so we batch
        # the brief with selectinload and skip hydrating the (potentially large)
        # child collections that _project_from_orm would lazy-load per project.
        keyword = (q or "").strip()
        conditions = [ProjectORM.deleted_at.is_(None)]
        if keyword:
            conditions.append(
                or_(
                    ProjectORM.name.icontains(keyword, autoescape=True),
                    BriefORM.product_name.icontains(keyword, autoescape=True),
                    BriefORM.prompt.icontains(keyword, autoescape=True),
                )
            )
        with self._session_factory() as session:
            projects = session.scalars(
                select(ProjectORM)
                .join(ProjectORM.brief)
                .options(selectinload(ProjectORM.brief))
                .where(*conditions)
                .order_by(ProjectORM.created_at)
            ).all()
            return [self._project_summary_from_orm(project) for project in projects]

    def delete_project(self, project_id: str) -> None:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            now = utc_now()
            project.deleted_at = now
            project.updated_at = now
            session.flush()

    def update_project(self, project_id: str, **changes: object) -> Project:
        if "project_type" in changes:
            raise ValueError("project_type cannot be updated")
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            for key, value in changes.items():
                if hasattr(project, key):
                    setattr(project, key, value)
            project.updated_at = utc_now()
            session.flush()
            return self._project_from_orm(project)

    def save_image_prompt_version(
        self,
        data: ImagePromptVersionCreate,
    ) -> ImagePromptVersion:
        with self._session_factory.begin() as session:
            project = session.scalar(
                select(ProjectORM)
                .where(
                    ProjectORM.id == data.project_id,
                    ProjectORM.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if project is None:
                raise NotFoundError(f"project not found: {data.project_id}")
            next_version = (
                session.scalar(
                    select(func.max(ImagePromptVersionORM.version)).where(
                        ImagePromptVersionORM.project_id == data.project_id
                    )
                )
                or 0
            ) + 1
            version = ImagePromptVersion(
                **data.model_dump(),
                version=next_version,
            )
            orm_version = ImagePromptVersionORM(
                id=version.id,
                project_id=version.project_id,
                version=version.version,
                prompt=version.prompt,
                aspect_ratio=version.aspect_ratio,
                target_language=version.target_language,
                image_purpose=version.image_purpose,
                created_at=version.created_at,
            )
            session.add(orm_version)
            project.current_image_prompt_version_id = version.id
            project.image_prompt_status = Status.SUCCEEDED
            project.current_stage = Stage.IMAGE
            project.updated_at = utc_now()
            session.flush()
            return self._image_prompt_version_from_orm(orm_version)

    def get_image_prompt_version(
        self,
        project_id: str,
        version_id: str,
    ) -> ImagePromptVersion:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            version = session.get(ImagePromptVersionORM, version_id)
            if version is None or version.project_id != project_id:
                raise NotFoundError(f"image prompt version not found: {version_id}")
            return self._image_prompt_version_from_orm(version)

    def list_image_prompt_versions(
        self,
        project_id: str,
    ) -> list[ImagePromptVersion]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            versions = session.scalars(
                select(ImagePromptVersionORM)
                .where(ImagePromptVersionORM.project_id == project_id)
                .order_by(ImagePromptVersionORM.version.desc())
            ).all()
            return [
                self._image_prompt_version_from_orm(version)
                for version in versions
            ]

    def mark_image_prompt_stale(self, project_id: str) -> Project:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            assets = session.scalars(
                select(AssetORM).where(
                    AssetORM.project_id == project_id,
                    AssetORM.asset_role == AssetRole.PUBLIC,
                    AssetORM.type == AssetType.GENERATED_IMAGE,
                )
            ).all()
            candidates = {asset.id: asset for asset in assets}
            stale_ids = {
                asset.id
                for asset in assets
                if asset.metadata_json.get("prompt_version_id")
            }
            pending = list(stale_ids)
            while pending:
                source_id = pending.pop()
                for asset in candidates.values():
                    if (
                        asset.id not in stale_ids
                        and asset.metadata_json.get("source_asset_id") == source_id
                    ):
                        stale_ids.add(asset.id)
                        pending.append(asset.id)
            now = utc_now()
            for asset_id in stale_ids:
                asset = candidates[asset_id]
                if asset.status != Status.STALE:
                    asset.status = Status.STALE
                    asset.updated_at = now
            project.image_prompt_status = Status.STALE
            project.current_stage = Stage.IMAGE
            project.updated_at = now
            session.flush()
            return self._project_from_orm(project)

    def set_current_image_asset(
        self,
        project_id: str,
        asset_id: str,
        *,
        expected_revision: int,
    ) -> Project:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            asset = self._require_project_asset(session, project_id, asset_id)
            if (
                asset.asset_role != AssetRole.PUBLIC
                or asset.type != AssetType.GENERATED_IMAGE
                or asset.status != Status.SUCCEEDED
            ):
                raise ValueError("asset is not an eligible current image")
            result = session.execute(
                update(ProjectORM)
                .where(
                    ProjectORM.id == project_id,
                    ProjectORM.deleted_at.is_(None),
                    ProjectORM.image_revision == expected_revision,
                )
                .values(
                    current_image_asset_id=asset_id,
                    image_revision=expected_revision + 1,
                    updated_at=utc_now(),
                )
            )
            if result.rowcount != 1:
                raise RevisionConflictError("image revision conflict")
            session.expire(project)
            session.flush()
            return self._project_from_orm(project)

    def update_project_details(
        self,
        project_id: str,
        data: ProjectUpdate,
    ) -> Project:
        if "project_type" in data.model_fields_set:
            raise ValueError("project_type cannot be updated")
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            if "name" in data.model_fields_set:
                project.name = data.name  # type: ignore[assignment]
            if data.brief is not None:
                brief_changes = data.brief.model_dump(exclude_unset=True)
                current = self._project_from_orm(project)
                candidate = ProjectBase(
                    name=project.name,
                    project_type=current.project_type,
                    brief={
                        **current.brief.model_dump(),
                        **brief_changes,
                    },
                    status=current.status,
                    current_stage=current.current_stage,
                )
                for key in brief_changes:
                    setattr(project.brief, key, getattr(candidate.brief, key))
            project.updated_at = utc_now()
            session.flush()
            return self._project_from_orm(project)

    def create_task(self, data: GenerationTaskCreate) -> GenerationTask:
        task = GenerationTask(**data.model_dump())
        with self._session_factory.begin() as session:
            self._require_project(session, task.project_id)
            orm_task = GenerationTaskORM(
                id=task.id,
                project_id=task.project_id,
                stage=task.stage,
                status=task.status,
                progress=task.progress,
                progress_message=task.progress_message,
                input_hash=task.input_hash,
                frozen_input=task.frozen_input,
                retry_of_task_id=task.retry_of_task_id,
                output_asset_ids=task.output_asset_ids,
                output_text_artifact_id=task.output_text_artifact_id,
                created_at=task.created_at,
                updated_at=task.updated_at,
                started_at=task.started_at,
                finished_at=task.finished_at,
            )
            self._set_task_error(orm_task, task.error)
            session.add(orm_task)
            self._touch_project(session, task.project_id)
            session.flush()
            return self._task_from_orm(orm_task)

    def create_task_if_no_active_hash(
        self,
        data: GenerationTaskCreate,
    ) -> tuple[GenerationTask, bool]:
        task = GenerationTask(**data.model_dump())
        with self._session_factory.begin() as session:
            project = session.scalar(
                select(ProjectORM)
                .where(
                    ProjectORM.id == task.project_id,
                    ProjectORM.deleted_at.is_(None),
                )
                .with_for_update()
            )
            if project is None:
                raise NotFoundError(f"project not found: {task.project_id}")
            active = session.scalar(
                select(GenerationTaskORM)
                .where(
                    GenerationTaskORM.project_id == task.project_id,
                    GenerationTaskORM.stage == task.stage,
                    GenerationTaskORM.input_hash == task.input_hash,
                    GenerationTaskORM.status.in_(
                        [Status.QUEUED, Status.RUNNING]
                    ),
                )
                .order_by(GenerationTaskORM.created_at)
                .limit(1)
            )
            if active is not None:
                return self._task_from_orm(active), False
            orm_task = GenerationTaskORM(
                id=task.id,
                project_id=task.project_id,
                stage=task.stage,
                status=task.status,
                progress=task.progress,
                progress_message=task.progress_message,
                input_hash=task.input_hash,
                frozen_input=task.frozen_input,
                retry_of_task_id=task.retry_of_task_id,
                output_asset_ids=task.output_asset_ids,
                output_text_artifact_id=task.output_text_artifact_id,
                created_at=task.created_at,
                updated_at=task.updated_at,
                started_at=task.started_at,
                finished_at=task.finished_at,
            )
            self._set_task_error(orm_task, task.error)
            session.add(orm_task)
            project.updated_at = utc_now()
            session.flush()
            return self._task_from_orm(orm_task), True

    def get_task(self, task_id: str) -> GenerationTask:
        with self._session_factory() as session:
            return self._task_from_orm(self._require_task(session, task_id))

    def list_project_tasks(self, project_id: str) -> list[GenerationTask]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            tasks = session.scalars(
                select(GenerationTaskORM)
                .where(GenerationTaskORM.project_id == project_id)
                .order_by(GenerationTaskORM.created_at)
            ).all()
            return [self._task_from_orm(task) for task in tasks]

    def find_active_task(
        self,
        project_id: str,
        stage: Stage,
    ) -> GenerationTask | None:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            task = session.scalar(
                select(GenerationTaskORM)
                .where(
                    GenerationTaskORM.project_id == project_id,
                    GenerationTaskORM.stage == stage,
                    GenerationTaskORM.status.in_([Status.QUEUED, Status.RUNNING]),
                )
                .order_by(GenerationTaskORM.created_at)
                .limit(1)
            )
            return self._task_from_orm(task) if task is not None else None

    def update_task(self, task_id: str, **changes: object) -> GenerationTask:
        with self._session_factory.begin() as session:
            task = self._require_task(session, task_id)
            for key, value in changes.items():
                if key == "error":
                    self._set_task_error(
                        task,
                        value if isinstance(value, TaskError) else None,
                    )
                elif hasattr(task, key):
                    setattr(task, key, value)
            task.updated_at = utc_now()
            self._touch_project(session, task.project_id)
            session.flush()
            return self._task_from_orm(task)

    def create_asset(self, data: AssetCreate) -> Asset:
        return self.create_assets([data])[0]

    def create_assets(self, items: Iterable[AssetCreate]) -> list[Asset]:
        assets = [Asset(**item.model_dump()) for item in items]
        with self._session_factory.begin() as session:
            for project_id in {asset.project_id for asset in assets}:
                self._require_project(session, project_id)
            orm_assets = [
                AssetORM(
                    id=asset.id,
                    project_id=asset.project_id,
                    type=asset.type,
                    category=asset.category,
                    asset_role=asset.asset_role,
                    status=asset.status,
                    stage=asset.stage,
                    url=asset.url,
                    object_key=asset.object_key,
                    mime_type=asset.mime_type,
                    size_bytes=asset.size_bytes,
                    source_task_id=asset.source_task_id,
                    metadata_json=asset.metadata,
                    created_at=asset.created_at,
                    updated_at=asset.updated_at,
                )
                for asset in assets
            ]
            session.add_all(orm_assets)
            for project_id in {asset.project_id for asset in assets}:
                self._touch_project(session, project_id)
            session.flush()
            return [self._asset_from_orm(asset) for asset in orm_assets]

    def create_asset_and_set_current_image(
        self,
        data: AssetCreate,
        *,
        expected_revision: int,
    ) -> Asset:
        asset = Asset(**data.model_dump())
        if (
            asset.asset_role != AssetRole.PUBLIC
            or asset.type != AssetType.GENERATED_IMAGE
            or asset.status != Status.SUCCEEDED
        ):
            raise ValueError("asset is not an eligible current image")
        with self._session_factory.begin() as session:
            self._require_project(session, asset.project_id)
            result = session.execute(
                update(ProjectORM)
                .where(
                    ProjectORM.id == asset.project_id,
                    ProjectORM.deleted_at.is_(None),
                    ProjectORM.image_revision == expected_revision,
                )
                .values(
                    current_image_asset_id=asset.id,
                    image_revision=expected_revision + 1,
                    updated_at=utc_now(),
                )
            )
            if result.rowcount != 1:
                raise RevisionConflictError("image revision conflict")
            orm_asset = AssetORM(
                id=asset.id,
                project_id=asset.project_id,
                type=asset.type,
                category=asset.category,
                asset_role=asset.asset_role,
                status=asset.status,
                stage=asset.stage,
                url=asset.url,
                object_key=asset.object_key,
                mime_type=asset.mime_type,
                size_bytes=asset.size_bytes,
                source_task_id=asset.source_task_id,
                metadata_json=asset.metadata,
                created_at=asset.created_at,
                updated_at=asset.updated_at,
            )
            session.add(orm_asset)
            session.flush()
            return self._asset_from_orm(orm_asset)

    def get_asset(self, asset_id: str) -> Asset:
        with self._session_factory() as session:
            return self._asset_from_orm(self._require_asset(session, asset_id))

    def create_image_layer_set(
        self,
        data: ImageLayerSetCreate,
        *,
        layers: Iterable[ImageLayerCreate],
        assets: Iterable[AssetCreate],
    ) -> ImageLayerSet:
        created_assets = [Asset(**item.model_dump()) for item in assets]
        created_layers = [ImageLayer(**item.model_dump()) for item in layers]
        asset_ids = {asset.id for asset in created_assets}
        if len(asset_ids) != len(created_assets):
            raise ValueError("image layer assets must be unique")
        if data.base_asset_id not in asset_ids:
            raise ValueError("base asset is missing from atomic create")
        base_asset = next(
            asset for asset in created_assets if asset.id == data.base_asset_id
        )
        if (
            data.status != Status.SUCCEEDED
            or base_asset.asset_role != AssetRole.INTERNAL_BASE
            or base_asset.status != Status.SUCCEEDED
        ):
            raise ValueError("image layer base must be an internal succeeded asset")
        if any(layer.set_id != data.id for layer in created_layers):
            raise ValueError("image layer belongs to another set")
        if any(layer.asset_id not in asset_ids for layer in created_layers):
            raise ValueError("image layer asset is missing from atomic create")
        layer_asset_ids = {layer.asset_id for layer in created_layers}
        if asset_ids != {data.base_asset_id, *layer_asset_ids}:
            raise ValueError("atomic create contains unrelated assets")
        if any(
            asset.asset_role != AssetRole.INTERNAL_LAYER
            or asset.status != Status.SUCCEEDED
            for asset in created_assets
            if asset.id in layer_asset_ids
        ):
            raise ValueError("image layers must use internal succeeded assets")
        layer_set = ImageLayerSet(**data.model_dump(), layers=created_layers)

        with self._session_factory.begin() as session:
            self._require_project(session, data.project_id)
            source = self._require_project_asset(
                session,
                data.project_id,
                data.source_asset_id,
            )
            if (
                source.asset_role != AssetRole.PUBLIC
                or source.type != AssetType.GENERATED_IMAGE
                or source.status != Status.SUCCEEDED
            ):
                raise ValueError("source asset is not a succeeded public image")
            orm_assets = [self._asset_to_orm(asset) for asset in created_assets]
            session.add_all(orm_assets)
            session.flush()

            orm_set = ImageLayerSetORM(
                id=layer_set.id,
                project_id=layer_set.project_id,
                source_asset_id=layer_set.source_asset_id,
                base_asset_id=layer_set.base_asset_id,
                canvas_width=layer_set.canvas_width,
                canvas_height=layer_set.canvas_height,
                status=layer_set.status,
                revision=layer_set.revision,
                created_at=layer_set.created_at,
                updated_at=layer_set.updated_at,
            )
            orm_set.layers = [
                ImageLayerORM(
                    id=layer.id,
                    asset_id=layer.asset_id,
                    z_index=layer.z_index,
                    name=layer.name,
                    description=layer.description,
                    bbox_absolute=list(layer.bbox_absolute),
                    bbox_normalized=list(layer.bbox_normalized),
                    visible=layer.visible,
                    x=layer.x,
                    y=layer.y,
                    scale=layer.scale,
                )
                for layer in layer_set.layers
            ]
            session.add(orm_set)
            self._touch_project(session, data.project_id)
            session.flush()
            return self._image_layer_set_from_orm(orm_set)

    def get_image_layer_set(
        self,
        project_id: str,
        set_id: str,
    ) -> ImageLayerSet:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            layer_set = session.scalar(
                select(ImageLayerSetORM)
                .options(selectinload(ImageLayerSetORM.layers))
                .where(
                    ImageLayerSetORM.id == set_id,
                    ImageLayerSetORM.project_id == project_id,
                )
            )
            if layer_set is None:
                raise NotFoundError(f"image layer set not found: {set_id}")
            return self._image_layer_set_from_orm(layer_set)

    def list_image_layer_sets(self, project_id: str) -> list[ImageLayerSet]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            layer_sets = session.scalars(
                select(ImageLayerSetORM)
                .options(selectinload(ImageLayerSetORM.layers))
                .where(ImageLayerSetORM.project_id == project_id)
                .order_by(ImageLayerSetORM.created_at, ImageLayerSetORM.id)
            ).all()
            return [
                self._image_layer_set_from_orm(layer_set)
                for layer_set in layer_sets
            ]

    def update_image_layer_set(
        self,
        project_id: str,
        set_id: str,
        *,
        expected_revision: int,
        layers: Iterable[ImageLayerUpdate],
    ) -> ImageLayerSet:
        updates = list(layers)
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            layer_set = session.scalar(
                select(ImageLayerSetORM)
                .options(selectinload(ImageLayerSetORM.layers))
                .where(
                    ImageLayerSetORM.id == set_id,
                    ImageLayerSetORM.project_id == project_id,
                )
                .with_for_update()
            )
            if layer_set is None:
                raise NotFoundError(f"image layer set not found: {set_id}")
            if layer_set.revision != expected_revision:
                raise RevisionConflictError("image layer set revision conflict")
            if (
                len(updates) != len(layer_set.layers)
                or {item.id for item in updates}
                != {item.id for item in layer_set.layers}
            ):
                raise ValueError("all image layers must be updated exactly once")
            update_by_id = {item.id: item for item in updates}
            for offset, layer in enumerate(layer_set.layers, start=1):
                layer.z_index = -offset
            session.flush()
            for layer in layer_set.layers:
                item = update_by_id[layer.id]
                layer.z_index = item.z_index
                layer.visible = item.visible
                layer.x = item.x
                layer.y = item.y
                layer.scale = item.scale
            layer_set.revision += 1
            layer_set.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._image_layer_set_from_orm(layer_set)

    def list_project_assets(self, project_id: str) -> list[Asset]:
        return self.list_assets(project_id=project_id)

    def list_assets(
        self,
        *,
        project_id: str | None = None,
        category: AssetCategory | None = None,
        status: Status | None = None,
        asset_role: AssetRole | None = AssetRole.PUBLIC,
    ) -> list[Asset]:
        with self._session_factory() as session:
            if project_id is not None:
                self._require_project(session, project_id)
            conditions = []
            if project_id is not None:
                conditions.append(AssetORM.project_id == project_id)
            if category is not None:
                conditions.append(AssetORM.category == category)
            if status is not None:
                conditions.append(AssetORM.status == status)
            if asset_role is not None:
                conditions.append(AssetORM.asset_role == asset_role)
            assets = session.scalars(
                select(AssetORM)
                .join(ProjectORM, AssetORM.project_id == ProjectORM.id)
                .where(ProjectORM.deleted_at.is_(None))
                .where(*conditions)
                .order_by(AssetORM.created_at)
            ).all()
            return [self._asset_from_orm(asset) for asset in assets]

    def update_asset(self, asset_id: str, **changes: object) -> Asset:
        with self._session_factory.begin() as session:
            asset = self._require_asset(session, asset_id)
            for key, value in changes.items():
                if key == "metadata":
                    asset.metadata_json = value  # type: ignore[assignment]
                elif hasattr(asset, key):
                    setattr(asset, key, value)
            asset.updated_at = utc_now()
            self._touch_project(session, asset.project_id)
            session.flush()
            return self._asset_from_orm(asset)

    def delete_asset(self, project_id: str, asset_id: str) -> Asset:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            asset = self._require_asset(session, asset_id)
            if asset.project_id != project_id:
                raise NotFoundError(f"asset not found: {asset_id}")
            deleted = self._asset_from_orm(asset)

            shots = session.scalars(
                select(StoryboardShotORM).where(
                    StoryboardShotORM.project_id == project_id
                )
            ).all()
            for shot in shots:
                changed = False
                if shot.image_asset_id == asset_id:
                    shot.image_asset_id = None
                    changed = True
                if shot.first_frame_asset_id == asset_id:
                    shot.first_frame_asset_id = None
                    changed = True
                if shot.first_frame_source_video_asset_id == asset_id:
                    shot.first_frame_source_video_asset_id = None
                    changed = True
                if shot.video_asset_id == asset_id:
                    shot.video_asset_id = None
                    changed = True
                for field_name in (
                    "reference_image_asset_ids",
                    "reference_video_asset_ids",
                    "reference_audio_asset_ids",
                ):
                    current = list(getattr(shot, field_name) or [])
                    next_ids = [
                        existing_id
                        for existing_id in current
                        if existing_id != asset_id
                    ]
                    if next_ids != current:
                        setattr(shot, field_name, next_ids)
                        changed = True
                if changed:
                    shot.updated_at = utc_now()

            character_cards = session.scalars(
                select(CharacterCardORM).where(
                    CharacterCardORM.project_id == project_id,
                    CharacterCardORM.asset_id == asset_id,
                )
            ).all()
            for card in character_cards:
                card.asset_id = None
                card.updated_at = utc_now()

            tasks = session.scalars(
                select(GenerationTaskORM).where(
                    GenerationTaskORM.project_id == project_id
                )
            ).all()
            for task in tasks:
                output_ids = list(task.output_asset_ids or [])
                if asset_id in output_ids:
                    task.output_asset_ids = [
                        existing_id
                        for existing_id in output_ids
                        if existing_id != asset_id
                    ]
                    task.updated_at = utc_now()

            session.delete(asset)
            self._touch_project(session, project_id)
            session.flush()
            return deleted

    def create_character_card(self, data: CharacterCardCreate) -> CharacterCard:
        card = CharacterCard(**data.model_dump())
        with self._session_factory.begin() as session:
            self._require_project(session, card.project_id)
            self._require_project_asset(session, card.project_id, card.asset_id)
            orm_card = CharacterCardORM(
                id=card.id,
                project_id=card.project_id,
                name=card.name,
                description=card.description,
                sort_order=card.sort_order,
                asset_id=card.asset_id,
                status=card.status,
                created_at=card.created_at,
                updated_at=card.updated_at,
            )
            session.add(orm_card)
            self._touch_project(session, card.project_id)
            session.flush()
            return self._character_card_from_orm(orm_card)

    def get_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            return self._character_card_from_orm(
                self._require_character_card(session, project_id, card_id)
            )

    def list_project_character_cards(self, project_id: str) -> list[CharacterCard]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            cards = session.scalars(
                select(CharacterCardORM)
                .where(CharacterCardORM.project_id == project_id)
                .order_by(
                    CharacterCardORM.sort_order,
                    CharacterCardORM.created_at,
                    CharacterCardORM.id,
                )
            ).all()
            return [self._character_card_from_orm(card) for card in cards]

    def mark_character_cards_stale(self, project_id: str) -> list[CharacterCard]:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            cards = session.scalars(
                select(CharacterCardORM).where(
                    CharacterCardORM.project_id == project_id
                )
            ).all()
            for card in cards:
                card.status = Status.STALE
                card.updated_at = utc_now()
            if cards:
                self._touch_project(session, project_id)
            session.flush()
            return [self._character_card_from_orm(card) for card in cards]

    def update_character_card(
        self,
        project_id: str,
        card_id: str,
        **changes: object,
    ) -> CharacterCard:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            card = self._require_character_card(session, project_id, card_id)
            if "asset_id" in changes:
                asset_id = changes["asset_id"]
                if asset_id is not None and not isinstance(asset_id, str):
                    raise TypeError("asset_id must be a string or None")
                self._require_project_asset(session, project_id, asset_id)
            for key, value in changes.items():
                if hasattr(card, key):
                    setattr(card, key, value)
            card.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._character_card_from_orm(card)

    def delete_character_card(
        self,
        project_id: str,
        card_id: str,
    ) -> CharacterCard:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            card = self._require_character_card(session, project_id, card_id)
            deleted = self._character_card_from_orm(card)
            session.delete(card)
            self._touch_project(session, project_id)
            session.flush()
            return deleted

    def replace_project_storyboard(
        self,
        project_id: str,
        shots: Iterable[StoryboardShotCreate],
    ) -> list[StoryboardShot]:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            session.execute(
                delete(StoryboardShotORM).where(
                    StoryboardShotORM.project_id == project_id
                )
            )
            created = [StoryboardShot(**shot.model_dump()) for shot in shots]
            for shot in created:
                session.add(
                    StoryboardShotORM(
                        id=shot.id,
                        project_id=shot.project_id,
                        index=shot.index,
                        title=shot.title,
                        description=shot.description,
                        visual_prompt=shot.visual_prompt,
                        narration=shot.narration,
                        duration_seconds=shot.duration_seconds,
                        status=shot.status,
                        image_asset_id=shot.image_asset_id,
                        first_frame_asset_id=shot.first_frame_asset_id,
                        first_frame_source_video_asset_id=(
                            shot.first_frame_source_video_asset_id
                        ),
                        video_asset_id=shot.video_asset_id,
                        video_prompt=shot.video_prompt,
                        reference_image_asset_ids=shot.reference_image_asset_ids,
                        reference_video_asset_ids=shot.reference_video_asset_ids,
                        reference_audio_asset_ids=shot.reference_audio_asset_ids,
                        merge_source_shots=[
                            snapshot.model_dump()
                            for snapshot in shot.merge_source_shots
                        ],
                        created_at=shot.created_at,
                        updated_at=shot.updated_at,
                    )
                )
            self._touch_project(session, project_id)
            session.flush()
            return sorted(created, key=lambda shot: shot.index)

    def list_project_storyboard(self, project_id: str) -> list[StoryboardShot]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            shots = session.scalars(
                select(StoryboardShotORM)
                .where(StoryboardShotORM.project_id == project_id)
                .order_by(StoryboardShotORM.index)
            ).all()
            return [self._storyboard_shot_from_orm(shot) for shot in shots]

    def mark_storyboard_shots_stale(self, project_id: str) -> list[StoryboardShot]:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            shots = session.scalars(
                select(StoryboardShotORM).where(
                    StoryboardShotORM.project_id == project_id
                )
            ).all()
            for shot in shots:
                shot.status = Status.STALE
                shot.updated_at = utc_now()
            if shots:
                self._touch_project(session, project_id)
            session.flush()
            return [self._storyboard_shot_from_orm(shot) for shot in shots]

    def get_storyboard_shot(self, project_id: str, shot_id: str) -> StoryboardShot:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            return self._storyboard_shot_from_orm(
                self._require_storyboard_shot(session, project_id, shot_id)
            )

    def get_storyboard_shot_by_index(
        self,
        project_id: str,
        shot_index: int,
    ) -> StoryboardShot:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            shot = session.scalar(
                select(StoryboardShotORM)
                .where(
                    StoryboardShotORM.project_id == project_id,
                    StoryboardShotORM.index == shot_index,
                )
                .limit(1)
            )
            if shot is None:
                raise NotFoundError(f"storyboard shot not found: {shot_index}")
            return self._storyboard_shot_from_orm(shot)

    def save_storyboard_shot_video_config(
        self,
        project_id: str,
        shot_id: str,
        data: StoryboardShotVideoConfigUpdate,
    ) -> StoryboardShot:
        changes: dict[str, object] = {}
        if "video_prompt" in data.model_fields_set:
            changes["video_prompt"] = data.video_prompt
        return self._update_storyboard_shot(project_id, shot_id, **changes)

    def attach_storyboard_shot_reference(
        self,
        project_id: str,
        shot_id: str,
        *,
        kind: ReferenceAssetKind,
        asset_id: str,
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            shot = self._require_storyboard_shot(session, project_id, shot_id)
            field_name = _reference_field_name(kind)
            existing = list(getattr(shot, field_name) or [])
            if asset_id not in existing:
                existing.append(asset_id)
            setattr(shot, field_name, existing)
            shot.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._storyboard_shot_from_orm(shot)

    def remove_storyboard_shot_reference(
        self,
        project_id: str,
        shot_id: str,
        *,
        kind: ReferenceAssetKind,
        asset_id: str,
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            shot = self._require_storyboard_shot(session, project_id, shot_id)
            field_name = _reference_field_name(kind)
            existing = [
                existing_id
                for existing_id in list(getattr(shot, field_name) or [])
                if existing_id != asset_id
            ]
            setattr(shot, field_name, existing)
            shot.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._storyboard_shot_from_orm(shot)

    def set_storyboard_shot_video_asset(
        self,
        project_id: str,
        shot_id: str,
        asset_id: str,
    ) -> StoryboardShot:
        return self._update_storyboard_shot(
            project_id,
            shot_id,
            video_asset_id=asset_id,
            status=Status.SUCCEEDED,
        )

    def set_storyboard_shot_first_frame(
        self,
        project_id: str,
        shot_id: str,
        *,
        asset_id: str | None,
        source_video_asset_id: str | None,
    ) -> StoryboardShot:
        return self._update_storyboard_shot(
            project_id,
            shot_id,
            first_frame_asset_id=asset_id,
            first_frame_source_video_asset_id=source_video_asset_id,
        )

    def delete_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            shot = self._require_storyboard_shot(session, project_id, shot_id)
            deleted = self._storyboard_shot_from_orm(shot)
            session.delete(shot)
            session.flush()

            remaining = session.scalars(
                select(StoryboardShotORM)
                .where(StoryboardShotORM.project_id == project_id)
                .order_by(StoryboardShotORM.index, StoryboardShotORM.created_at)
            ).all()
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = -index
            session.flush()
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = index
                remaining_shot.updated_at = utc_now()

            self._touch_project(session, project_id)
            session.flush()
            return deleted

    def merge_storyboard_shots(
        self,
        project_id: str,
        shot_ids: Iterable[str],
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            project = self._require_project(session, project_id)
            selected = [
                self._require_storyboard_shot(session, project_id, shot_id)
                for shot_id in shot_ids
            ]
            ordered = sorted(selected, key=lambda item: item.index)
            indices = [shot.index for shot in ordered]
            for earlier, later in zip(indices, indices[1:]):
                if later - earlier != 1:
                    raise ValueError("only adjacent shots can be merged")

            descriptions = [shot.description for shot in ordered if shot.description]
            visual_prompts = [
                shot.visual_prompt for shot in ordered if shot.visual_prompt
            ]
            narrations = [shot.narration for shot in ordered if shot.narration]
            selected_models = [
                self._storyboard_shot_from_orm(shot) for shot in ordered
            ]
            atomic_snapshots = [
                StoryboardAtomicShotSnapshot(
                    id=source.id,
                    title=source.title,
                    description=source.description,
                    visual_prompt=source.visual_prompt,
                    narration=source.narration,
                    duration_seconds=source.duration_seconds,
                    video_prompt=source.video_prompt,
                )
                for shot in selected_models
                for source in expand_atomic_shots(shot)
            ]
            merged_video_prompt = build_merged_shot_video_prompt(
                atomic_snapshots,
                target_language=project.brief.target_language,
            )

            primary = ordered[0]
            title_prefix = (
                "Shot"
                if project.brief.target_language == TargetLanguage.EN
                else "镜头"
            )
            primary.title = f"{title_prefix} {indices[0]}-{indices[-1]}"
            primary.description = "\n".join(descriptions)
            primary.visual_prompt = "\n".join(visual_prompts)
            primary.narration = "\n".join(narrations) if narrations else None
            primary.duration_seconds = sum(
                shot.duration_seconds for shot in ordered
            )
            primary.video_prompt = merged_video_prompt
            primary.reference_image_asset_ids = []
            primary.reference_video_asset_ids = []
            primary.reference_audio_asset_ids = []
            primary.merge_source_shots = [
                snapshot.model_dump() for snapshot in atomic_snapshots
            ]
            primary.first_frame_asset_id = None
            primary.first_frame_source_video_asset_id = None
            primary.video_asset_id = None
            primary.image_asset_id = None
            primary.status = Status.DRAFT
            primary.updated_at = utc_now()

            for shot in ordered[1:]:
                session.delete(shot)
            session.flush()

            remaining = session.scalars(
                select(StoryboardShotORM)
                .where(StoryboardShotORM.project_id == project_id)
                .order_by(StoryboardShotORM.index, StoryboardShotORM.created_at)
            ).all()
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = -index
            session.flush()
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = index
                remaining_shot.updated_at = utc_now()

            self._touch_project(session, project_id)
            session.flush()
            return self._storyboard_shot_from_orm(primary)

    def split_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
    ) -> list[StoryboardShot]:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            merged = self._require_storyboard_shot(session, project_id, shot_id)
            snapshots = [
                StoryboardAtomicShotSnapshot.model_validate(item)
                for item in (merged.merge_source_shots or [])
            ]
            if not snapshots:
                raise ValueError("storyboard shot does not have an atomic merge snapshot")

            merged_index = merged.index
            session.delete(merged)
            session.flush()

            remaining = session.scalars(
                select(StoryboardShotORM)
                .where(StoryboardShotORM.project_id == project_id)
                .order_by(StoryboardShotORM.index, StoryboardShotORM.created_at)
            ).all()
            original_indices = {
                remaining_shot.id: remaining_shot.index
                for remaining_shot in remaining
            }
            for index, remaining_shot in enumerate(remaining, start=1):
                remaining_shot.index = -index
            session.flush()

            restored_orm: list[StoryboardShotORM] = []
            for offset, snapshot in enumerate(snapshots):
                restored = StoryboardShotORM(
                    id=snapshot.id,
                    project_id=project_id,
                    index=merged_index + offset,
                    title=snapshot.title,
                    description=snapshot.description,
                    visual_prompt=snapshot.visual_prompt,
                    narration=snapshot.narration,
                    duration_seconds=snapshot.duration_seconds,
                    status=Status.DRAFT,
                    image_asset_id=None,
                    first_frame_asset_id=None,
                    first_frame_source_video_asset_id=None,
                    video_asset_id=None,
                    video_prompt=snapshot.video_prompt,
                    reference_image_asset_ids=[],
                    reference_video_asset_ids=[],
                    reference_audio_asset_ids=[],
                    merge_source_shots=[],
                    created_at=utc_now(),
                    updated_at=utc_now(),
                )
                session.add(restored)
                restored_orm.append(restored)
            session.flush()

            shift = len(snapshots) - 1
            for remaining_shot in remaining:
                old_index = original_indices[remaining_shot.id]
                remaining_shot.index = (
                    old_index if old_index < merged_index else old_index + shift
                )
                remaining_shot.updated_at = utc_now()

            self._touch_project(session, project_id)
            session.flush()
            return [
                self._storyboard_shot_from_orm(shot)
                for shot in restored_orm
            ]

    def create_text_artifact(self, data: TextArtifactCreate) -> TextArtifact:
        artifact = TextArtifact(**data.model_dump())
        with self._session_factory.begin() as session:
            self._require_project(session, artifact.project_id)
            orm_artifact = TextArtifactORM(
                id=artifact.id,
                project_id=artifact.project_id,
                stage=artifact.stage,
                title=artifact.title,
                content=artifact.content,
                version=artifact.version,
                status=artifact.status,
                created_at=artifact.created_at,
                updated_at=artifact.updated_at,
            )
            session.add(orm_artifact)
            self._touch_project(session, artifact.project_id)
            session.flush()
            return self._text_artifact_from_orm(orm_artifact)

    def get_text_artifact(self, artifact_id: str) -> TextArtifact:
        with self._session_factory() as session:
            return self._text_artifact_from_orm(
                self._require_text_artifact(session, artifact_id)
            )

    def list_project_text_artifacts(self, project_id: str) -> list[TextArtifact]:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            artifacts = session.scalars(
                select(TextArtifactORM)
                .where(TextArtifactORM.project_id == project_id)
                .order_by(TextArtifactORM.created_at)
            ).all()
            return [self._text_artifact_from_orm(artifact) for artifact in artifacts]

    def get_latest_text_artifact(
        self,
        project_id: str,
        stage: Stage,
        *,
        include_stale: bool = False,
    ) -> TextArtifact | None:
        with self._session_factory() as session:
            self._require_project(session, project_id)
            conditions = [
                TextArtifactORM.project_id == project_id,
                TextArtifactORM.stage == stage,
            ]
            if not include_stale:
                conditions.append(TextArtifactORM.status != Status.STALE)
            artifact = session.scalar(
                select(TextArtifactORM)
                .where(*conditions)
                .order_by(TextArtifactORM.version.desc())
                .limit(1)
            )
            return (
                self._text_artifact_from_orm(artifact)
                if artifact is not None
                else None
            )

    def update_text_artifact(
        self,
        artifact_id: str,
        **changes: object,
    ) -> TextArtifact:
        with self._session_factory.begin() as session:
            artifact = self._require_text_artifact(session, artifact_id)
            for key, value in changes.items():
                if hasattr(artifact, key):
                    setattr(artifact, key, value)
            artifact.updated_at = utc_now()
            self._touch_project(session, artifact.project_id)
            session.flush()
            return self._text_artifact_from_orm(artifact)

    def delete_text_artifact(
        self,
        project_id: str,
        artifact_id: str,
    ) -> TextArtifact:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            artifact = self._require_text_artifact(session, artifact_id)
            if artifact.project_id != project_id:
                raise NotFoundError(f"text artifact not found: {artifact_id}")
            deleted = self._text_artifact_from_orm(artifact)
            tasks = session.scalars(
                select(GenerationTaskORM).where(
                    GenerationTaskORM.output_text_artifact_id == artifact_id
                )
            ).all()
            for task in tasks:
                task.output_text_artifact_id = None
                task.updated_at = utc_now()
            session.delete(artifact)
            self._touch_project(session, project_id)
            session.flush()
            return deleted

    def mark_text_artifacts_stale(
        self,
        project_id: str,
        stages: Iterable[Stage],
    ) -> list[TextArtifact]:
        stale_stages = set(stages)
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            if not stale_stages:
                return []
            artifacts = session.scalars(
                select(TextArtifactORM).where(
                    TextArtifactORM.project_id == project_id,
                    TextArtifactORM.stage.in_(stale_stages),
                )
            ).all()
            for artifact in artifacts:
                artifact.status = Status.STALE
                artifact.updated_at = utc_now()
            if artifacts:
                self._touch_project(session, project_id)
            session.flush()
            return [self._text_artifact_from_orm(artifact) for artifact in artifacts]

    def mark_assets_stale(
        self,
        project_id: str,
        stages: Iterable[Stage],
    ) -> list[Asset]:
        stale_stages = set(stages)
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            if not stale_stages:
                return []
            assets = session.scalars(
                select(AssetORM).where(
                    AssetORM.project_id == project_id,
                    AssetORM.stage.in_(stale_stages),
                )
            ).all()
            for asset in assets:
                if (
                    asset.metadata_json.get("usage")
                    == "storyboard_video_tail_frame_reference"
                ):
                    continue
                asset.status = Status.STALE
                asset.updated_at = utc_now()
            if assets:
                self._touch_project(session, project_id)
            session.flush()
            return [self._asset_from_orm(asset) for asset in assets]

    def mark_storyboard_video_assets_stale(
        self,
        project_id: str,
        shot_ids: Iterable[str],
        *,
        asset_ids: Iterable[str] | None = None,
    ) -> list[Asset]:
        affected_shot_ids = set(shot_ids)
        affected_asset_ids = set(asset_ids or [])
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            if not affected_shot_ids and not affected_asset_ids:
                return []
            assets = session.scalars(
                select(AssetORM).where(
                    AssetORM.project_id == project_id,
                    AssetORM.stage == Stage.VIDEO,
                    AssetORM.type == AssetType.STORYBOARD_VIDEO,
                )
            ).all()
            updated_assets = []
            for asset in assets:
                if asset.status == Status.STALE:
                    continue
                metadata = asset.metadata_json
                if (
                    asset.id in affected_asset_ids
                    or metadata.get("shot_id") in affected_shot_ids
                    or metadata.get("candidate_for_shot_id") in affected_shot_ids
                    or metadata.get("selected_for_shot_id") in affected_shot_ids
                ):
                    asset.status = Status.STALE
                    asset.updated_at = utc_now()
                    updated_assets.append(asset)
            if updated_assets:
                self._touch_project(session, project_id)
            session.flush()
            return [self._asset_from_orm(asset) for asset in updated_assets]

    @staticmethod
    def _require_project(session: Session, project_id: str) -> ProjectORM:
        project = session.get(ProjectORM, project_id)
        if project is None or project.deleted_at is not None:
            raise NotFoundError(f"project not found: {project_id}")
        return project

    @staticmethod
    def _require_task(session: Session, task_id: str) -> GenerationTaskORM:
        task = session.get(GenerationTaskORM, task_id)
        if task is None:
            raise NotFoundError(f"task not found: {task_id}")
        MySQLRepository._require_project(session, task.project_id)
        return task

    @staticmethod
    def _require_asset(session: Session, asset_id: str) -> AssetORM:
        asset = session.get(AssetORM, asset_id)
        if asset is None:
            raise NotFoundError(f"asset not found: {asset_id}")
        MySQLRepository._require_project(session, asset.project_id)
        return asset

    @staticmethod
    def _require_project_asset(
        session: Session,
        project_id: str,
        asset_id: str | None,
    ) -> AssetORM | None:
        MySQLRepository._require_project(session, project_id)
        if asset_id is None:
            return None
        asset = MySQLRepository._require_asset(session, asset_id)
        if asset.project_id != project_id:
            raise NotFoundError(f"asset not found: {asset_id}")
        return asset

    @staticmethod
    def _require_character_card(
        session: Session,
        project_id: str,
        card_id: str,
    ) -> CharacterCardORM:
        card = session.get(CharacterCardORM, card_id)
        if card is None or card.project_id != project_id:
            raise NotFoundError(f"character card not found: {card_id}")
        return card

    @staticmethod
    def _require_text_artifact(session: Session, artifact_id: str) -> TextArtifactORM:
        artifact = session.get(TextArtifactORM, artifact_id)
        if artifact is None:
            raise NotFoundError(f"text artifact not found: {artifact_id}")
        MySQLRepository._require_project(session, artifact.project_id)
        return artifact

    @staticmethod
    def _require_storyboard_shot(
        session: Session,
        project_id: str,
        shot_id: str,
    ) -> StoryboardShotORM:
        MySQLRepository._require_project(session, project_id)
        shot = session.get(StoryboardShotORM, shot_id)
        if shot is None or shot.project_id != project_id:
            raise NotFoundError(f"storyboard shot not found: {shot_id}")
        return shot

    def _update_storyboard_shot(
        self,
        project_id: str,
        shot_id: str,
        **changes: object,
    ) -> StoryboardShot:
        with self._session_factory.begin() as session:
            self._require_project(session, project_id)
            shot = self._require_storyboard_shot(session, project_id, shot_id)
            for key, value in changes.items():
                if hasattr(shot, key):
                    setattr(shot, key, value)
            shot.updated_at = utc_now()
            self._touch_project(session, project_id)
            session.flush()
            return self._storyboard_shot_from_orm(shot)

    @staticmethod
    def _touch_project(session: Session, project_id: str) -> None:
        project = MySQLRepository._require_project(session, project_id)
        project.updated_at = utc_now()

    @staticmethod
    def _set_task_error(task: GenerationTaskORM, error: TaskError | None) -> None:
        task.error_code = error.code if error is not None else None
        task.error_message = error.message if error is not None else None
        task.error_detail = error.detail if error is not None else None

    @classmethod
    def _project_summary_from_orm(cls, project: ProjectORM) -> ProjectListItem:
        return ProjectListItem(
            id=project.id,
            name=project.name,
            project_type=project.project_type,
            brief=cls._brief_from_orm(project.brief),
            status=project.status,
            current_stage=project.current_stage,
            current_image_prompt_version_id=project.current_image_prompt_version_id,
            image_prompt_status=project.image_prompt_status,
            current_image_asset_id=project.current_image_asset_id,
            image_revision=project.image_revision,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    @classmethod
    def _project_from_orm(cls, project: ProjectORM) -> Project:
        return Project(
            id=project.id,
            name=project.name,
            project_type=project.project_type,
            brief=cls._brief_from_orm(project.brief),
            status=project.status,
            current_stage=project.current_stage,
            current_image_prompt_version_id=project.current_image_prompt_version_id,
            image_prompt_status=project.image_prompt_status,
            current_image_asset_id=project.current_image_asset_id,
            image_revision=project.image_revision,
            text_artifacts=[
                cls._text_artifact_from_orm(artifact)
                for artifact in sorted(
                    project.text_artifacts,
                    key=lambda item: (item.created_at, item.id),
                )
            ],
            character_cards=[
                cls._character_card_from_orm(card)
                for card in sorted(
                    project.character_cards,
                    key=lambda item: (item.sort_order, item.created_at, item.id),
                )
            ],
            storyboard=[
                cls._storyboard_shot_from_orm(shot)
                for shot in sorted(
                    project.storyboard_shots,
                    key=lambda item: item.index,
                )
            ],
            tasks=[
                cls._task_from_orm(task)
                for task in sorted(
                    project.tasks,
                    key=lambda item: (item.created_at, item.id),
                )
            ],
            assets=[
                cls._asset_from_orm(asset)
                for asset in sorted(
                    project.assets,
                    key=lambda item: (item.created_at, item.id),
                )
                if asset.asset_role == AssetRole.PUBLIC
            ],
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    @staticmethod
    def _brief_from_orm(brief: BriefORM) -> Brief:
        return Brief(
            prompt=brief.prompt,
            target_language=brief.target_language,
            target_platform=brief.target_platform,
            aspect_ratio=brief.aspect_ratio,
            duration_seconds=brief.duration_seconds,
            image_purpose=brief.image_purpose,
            style=brief.style,
            audience=brief.audience,
            product_name=brief.product_name,
            summary=brief.summary,
            selling_points=brief.selling_points,
        )

    @staticmethod
    def _image_prompt_version_from_orm(
        version: ImagePromptVersionORM,
    ) -> ImagePromptVersion:
        return ImagePromptVersion(
            id=version.id,
            project_id=version.project_id,
            version=version.version,
            prompt=version.prompt,
            aspect_ratio=version.aspect_ratio,
            target_language=version.target_language,
            image_purpose=version.image_purpose,
            created_at=version.created_at,
        )

    @staticmethod
    def _task_from_orm(task: GenerationTaskORM) -> GenerationTask:
        error = (
            TaskError(
                code=task.error_code,
                message=task.error_message or "task failed",
                detail=task.error_detail,
            )
            if task.error_code is not None
            else None
        )
        return GenerationTask(
            id=task.id,
            project_id=task.project_id,
            stage=task.stage,
            status=task.status,
            progress=task.progress,
            progress_message=task.progress_message,
            error=error,
            input_hash=task.input_hash,
            frozen_input=task.frozen_input,
            retry_of_task_id=task.retry_of_task_id,
            output_asset_ids=task.output_asset_ids,
            output_text_artifact_id=task.output_text_artifact_id,
            created_at=task.created_at,
            updated_at=task.updated_at,
            started_at=task.started_at,
            finished_at=task.finished_at,
        )

    @staticmethod
    def _asset_from_orm(asset: AssetORM) -> Asset:
        return Asset(
            id=asset.id,
            project_id=asset.project_id,
            type=asset.type,
            category=asset.category,
            asset_role=asset.asset_role,
            status=asset.status,
            stage=asset.stage,
            url=asset.url,
            object_key=asset.object_key,
            mime_type=asset.mime_type,
            size_bytes=asset.size_bytes,
            source_task_id=asset.source_task_id,
            metadata=asset.metadata_json,
            created_at=asset.created_at,
            updated_at=asset.updated_at,
        )

    @staticmethod
    def _asset_to_orm(asset: Asset) -> AssetORM:
        return AssetORM(
            id=asset.id,
            project_id=asset.project_id,
            type=asset.type,
            category=asset.category,
            asset_role=asset.asset_role,
            status=asset.status,
            stage=asset.stage,
            url=asset.url,
            object_key=asset.object_key,
            mime_type=asset.mime_type,
            size_bytes=asset.size_bytes,
            source_task_id=asset.source_task_id,
            metadata_json=asset.metadata,
            created_at=asset.created_at,
            updated_at=asset.updated_at,
        )

    @classmethod
    def _image_layer_set_from_orm(
        cls,
        layer_set: ImageLayerSetORM,
    ) -> ImageLayerSet:
        return ImageLayerSet(
            id=layer_set.id,
            project_id=layer_set.project_id,
            source_asset_id=layer_set.source_asset_id,
            base_asset_id=layer_set.base_asset_id,
            canvas_width=layer_set.canvas_width,
            canvas_height=layer_set.canvas_height,
            status=layer_set.status,
            revision=layer_set.revision,
            layers=[
                ImageLayer(
                    id=layer.id,
                    set_id=layer.set_id,
                    asset_id=layer.asset_id,
                    z_index=layer.z_index,
                    name=layer.name,
                    description=layer.description,
                    bbox_absolute=tuple(layer.bbox_absolute),
                    bbox_normalized=tuple(layer.bbox_normalized),
                    visible=layer.visible,
                    x=layer.x,
                    y=layer.y,
                    scale=layer.scale,
                )
                for layer in sorted(
                    layer_set.layers,
                    key=lambda item: item.z_index,
                )
            ],
            created_at=layer_set.created_at,
            updated_at=layer_set.updated_at,
        )

    @staticmethod
    def _character_card_from_orm(card: CharacterCardORM) -> CharacterCard:
        return CharacterCard(
            id=card.id,
            project_id=card.project_id,
            name=card.name,
            description=card.description,
            sort_order=card.sort_order,
            asset_id=card.asset_id,
            status=card.status,
            created_at=card.created_at,
            updated_at=card.updated_at,
        )

    @staticmethod
    def _storyboard_shot_from_orm(shot: StoryboardShotORM) -> StoryboardShot:
        return StoryboardShot(
            id=shot.id,
            project_id=shot.project_id,
            index=shot.index,
            title=shot.title,
            description=shot.description,
            visual_prompt=shot.visual_prompt,
            narration=shot.narration,
            duration_seconds=shot.duration_seconds,
            status=shot.status,
            image_asset_id=shot.image_asset_id,
            first_frame_asset_id=shot.first_frame_asset_id,
            first_frame_source_video_asset_id=(
                shot.first_frame_source_video_asset_id
            ),
            video_asset_id=shot.video_asset_id,
            video_prompt=shot.video_prompt,
            reference_image_asset_ids=shot.reference_image_asset_ids or [],
            reference_video_asset_ids=shot.reference_video_asset_ids or [],
            reference_audio_asset_ids=shot.reference_audio_asset_ids or [],
            merge_source_shots=[
                StoryboardAtomicShotSnapshot.model_validate(item)
                for item in (shot.merge_source_shots or [])
            ],
            created_at=shot.created_at,
            updated_at=shot.updated_at,
        )

    @staticmethod
    def _text_artifact_from_orm(artifact: TextArtifactORM) -> TextArtifact:
        return TextArtifact(
            id=artifact.id,
            project_id=artifact.project_id,
            stage=artifact.stage,
            title=artifact.title,
            content=artifact.content,
            version=artifact.version,
            status=artifact.status,
            created_at=artifact.created_at,
            updated_at=artifact.updated_at,
        )

    @staticmethod
    def _default_project_name(brief: Brief) -> str:
        if brief.product_name:
            return brief.product_name
        prompt = " ".join(brief.prompt.split())
        return prompt[:60] or "Untitled project"


def _reference_field_name(kind: ReferenceAssetKind) -> str:
    return {
        ReferenceAssetKind.IMAGE: "reference_image_asset_ids",
        ReferenceAssetKind.VIDEO: "reference_video_asset_ids",
        ReferenceAssetKind.AUDIO: "reference_audio_asset_ids",
    }[kind]
