"""Atomic workspace and stage-task persistence for both repository backends."""

from __future__ import annotations

from copy import deepcopy

from sqlalchemy import select, update

from backend.app.db.models import (
    AssetORM,
    SubtitleWorkspaceORM,
    ToolTaskInputAssetORM,
    ToolTaskORM,
)
from backend.app.repositories.base import NotFoundError, RevisionConflictError
from backend.app.schemas.asset import Asset
from backend.app.schemas.common import utc_now
from backend.app.schemas.enums import ReferenceAssetKind, ToolAssetRole, ToolTaskType
from backend.app.schemas.subtitle_translation import SubtitleWorkspace
from backend.app.schemas.tool_task import ToolTask, ToolTaskCreate, ToolTaskInputAsset


def _inputs(task):
    ids = {
        task.input_snapshot.get("reference_video_asset_id"),
        task.input_snapshot.get("clean_video_asset_id"),
    } - {None, ""}
    return [
        ToolTaskInputAsset(
            task_id=task.id, asset_id=asset_id, kind=ReferenceAssetKind.VIDEO
        )
        for asset_id in sorted(ids)
    ]


class MemorySubtitleWorkspaceRepository:
    def create_subtitle_output_asset(self, data):
        with self._lock:
            task = self.get_tool_task(data.tool_task_id)
            self.get_subtitle_workspace(task.input_snapshot["workspace_id"])
            existing = next(
                (
                    a
                    for a in self._assets.values()
                    if a.tool_task_id == task.id
                    and a.tool_asset_role == ToolAssetRole.OUTPUT
                ),
                None,
            )
            return (
                existing.model_copy(deep=True) if existing else self.create_asset(data)
            )

    def create_subtitle_workspace(
        self, workspace: SubtitleWorkspace
    ) -> SubtitleWorkspace:
        with self._lock:
            if not hasattr(self, "_subtitle_workspaces"):
                self._subtitle_workspaces = {}
                self._subtitle_history = {}
            if workspace.id in self._subtitle_workspaces:
                raise ValueError("workspace already exists")
            self._subtitle_workspaces[workspace.id] = workspace.model_copy(deep=True)
            self._subtitle_history[workspace.id] = [workspace.model_dump(mode="json")]
            return workspace.model_copy(deep=True)

    def get_subtitle_workspace(self, workspace_id: str) -> SubtitleWorkspace:
        with self._lock:
            workspace = getattr(self, "_subtitle_workspaces", {}).get(workspace_id)
            if workspace is None:
                raise NotFoundError("subtitle workspace not found")
            return workspace.model_copy(deep=True)

    def list_subtitle_workspaces(self) -> list[SubtitleWorkspace]:
        with self._lock:
            return sorted(
                [
                    w.model_copy(deep=True)
                    for w in getattr(self, "_subtitle_workspaces", {}).values()
                ],
                key=lambda w: w.updated_at,
                reverse=True,
            )

    def list_subtitle_workspace_history(self, workspace_id: str) -> list[dict]:
        with self._lock:
            self.get_subtitle_workspace(workspace_id)
            return deepcopy(self._subtitle_history[workspace_id])

    def mutate_subtitle_workspace(self, workspace_id, mutation):
        with self._lock:
            current = self.get_subtitle_workspace(workspace_id)
            tasks = [
                t.model_copy(deep=True)
                for t in self._tool_tasks.values()
                if t.input_snapshot.get("workspace_id") == workspace_id
            ]
            workspace, changed_task = mutation(current.model_copy(deep=True), tasks)
            if changed_task is not None:
                if isinstance(changed_task, ToolTaskCreate):
                    # Validate before changing either aggregate.
                    inputs = _inputs(changed_task)
                    for item in inputs:
                        self.get_asset(item.asset_id)
                    self.create_tool_task_with_input_assets(changed_task, inputs)
                else:
                    self._tool_tasks[changed_task.id] = changed_task.model_copy(
                        deep=True
                    )
            if workspace != current:
                workspace.updated_at = utc_now()
                self._subtitle_history[workspace_id].append(
                    workspace.model_dump(mode="json")
                )
                self._subtitle_workspaces[workspace_id] = workspace.model_copy(
                    deep=True
                )
            return workspace.model_copy(deep=True)


class SQLSubtitleWorkspaceRepository:
    def create_subtitle_output_asset(self, data):
        with self._session_factory.begin() as session:
            task = session.get(ToolTaskORM, data.tool_task_id)
            if task is None:
                raise NotFoundError("subtitle task not found")
            workspace = session.scalar(
                select(SubtitleWorkspaceORM)
                .where(SubtitleWorkspaceORM.id == task.input_snapshot["workspace_id"])
                .with_for_update()
            )
            if workspace is None:
                raise NotFoundError("subtitle workspace not found")
            existing = session.scalar(
                select(AssetORM).where(
                    AssetORM.tool_task_id == task.id,
                    AssetORM.tool_asset_role == ToolAssetRole.OUTPUT,
                )
            )
            if existing is not None:
                return self._asset_from_orm(existing)
            asset = Asset(**data.model_dump())
            session.add(self._asset_to_orm(asset))
            session.flush()
            return asset

    def create_subtitle_workspace(
        self, workspace: SubtitleWorkspace
    ) -> SubtitleWorkspace:
        with self._session_factory.begin() as session:
            session.add(
                SubtitleWorkspaceORM(
                    id=workspace.id,
                    revision=workspace.revision,
                    payload=workspace.model_dump(mode="json"),
                    history=[workspace.model_dump(mode="json")],
                    created_at=workspace.created_at,
                    updated_at=workspace.updated_at,
                )
            )
        return workspace.model_copy(deep=True)

    def get_subtitle_workspace(self, workspace_id: str) -> SubtitleWorkspace:
        with self._session_factory() as session:
            row = session.get(SubtitleWorkspaceORM, workspace_id)
            if row is None:
                raise NotFoundError("subtitle workspace not found")
            return SubtitleWorkspace.model_validate(row.payload)

    def list_subtitle_workspaces(self) -> list[SubtitleWorkspace]:
        with self._session_factory() as session:
            # Keep accumulated history out of list reads and MySQL filesort.
            # Sort row references locally so large JSON drafts cannot exhaust
            # the database's fixed-size sort buffer either.
            rows = session.execute(
                select(
                    SubtitleWorkspaceORM.payload,
                    SubtitleWorkspaceORM.updated_at,
                )
            ).all()
            return [
                SubtitleWorkspace.model_validate(row.payload)
                for row in sorted(
                    rows, key=lambda row: row.updated_at, reverse=True
                )
            ]

    def list_subtitle_workspace_history(self, workspace_id: str) -> list[dict]:
        with self._session_factory() as session:
            row = session.get(SubtitleWorkspaceORM, workspace_id)
            if row is None:
                raise NotFoundError("subtitle workspace not found")
            return deepcopy(row.history)

    def mutate_subtitle_workspace(self, workspace_id, mutation):
        with self._session_factory.begin() as session:
            row = session.scalar(
                select(SubtitleWorkspaceORM)
                .where(SubtitleWorkspaceORM.id == workspace_id)
                .with_for_update()
            )
            if row is None:
                raise NotFoundError("subtitle workspace not found")
            current = SubtitleWorkspace.model_validate(row.payload)
            persistence_version = row.persistence_version
            orm_tasks = list(
                session.scalars(
                    select(ToolTaskORM).where(
                        ToolTaskORM.type == ToolTaskType.VIDEO_SUBTITLE_TRANSLATION
                    )
                )
            )
            tasks = [
                self._tool_task_from_orm(t)
                for t in orm_tasks
                if t.input_snapshot.get("workspace_id") == workspace_id
            ]
            workspace, changed_task = mutation(current.model_copy(deep=True), tasks)
            changed = workspace != current
            if changed:
                workspace.updated_at = utc_now()
            if changed or changed_task is not None:
                updated = session.execute(
                    update(SubtitleWorkspaceORM)
                    .where(
                        SubtitleWorkspaceORM.id == workspace_id,
                        SubtitleWorkspaceORM.persistence_version == persistence_version,
                    )
                    .values(
                        payload=workspace.model_dump(mode="json"),
                        revision=workspace.revision,
                        persistence_version=persistence_version + 1,
                        updated_at=workspace.updated_at,
                        history=[*row.history, workspace.model_dump(mode="json")]
                        if changed
                        else row.history,
                    )
                )
                if updated.rowcount != 1:
                    raise RevisionConflictError("workspace changed concurrently")
            if changed_task is not None:
                if isinstance(changed_task, ToolTaskCreate):
                    task = ToolTask(**changed_task.model_dump())
                    inputs = _inputs(task)
                    for item in inputs:
                        self._require_asset(session, item.asset_id)
                    target = ToolTaskORM(
                        id=task.id,
                        type=task.type,
                        status=task.status,
                        input_snapshot=task.input_snapshot,
                        provider_task_id=task.provider_task_id,
                        retry_of_task_id=task.retry_of_task_id,
                        created_at=task.created_at,
                        updated_at=task.updated_at,
                        input_assets=[
                            ToolTaskInputAssetORM(**i.model_dump()) for i in inputs
                        ],
                    )
                    session.add(target)
                else:
                    target = next(t for t in orm_tasks if t.id == changed_task.id)
                    for key in (
                        "status",
                        "provider_task_id",
                        "input_snapshot",
                        "started_at",
                        "finished_at",
                    ):
                        setattr(target, key, getattr(changed_task, key))
                    target.updated_at = utc_now()
                    self._set_tool_task_error(target, changed_task.error)
            session.flush()
            return workspace.model_copy(deep=True)
