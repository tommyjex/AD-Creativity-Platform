from __future__ import annotations

import hashlib
from datetime import timedelta
from typing import Protocol

import pytest

from backend.app.repositories import InMemoryRepository, MySQLRepository
from backend.app.schemas import (
    AigcJsonParserItem,
    AigcPipelineCreate,
    AigcPipelineDefinitionV2,
    AigcPipelineRun,
    AigcPipelineRunNode,
    AigcPipelineRunStatus,
    AigcPipelineTaskAttempt,
    AigcPipelineUpdate,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcTaskStatus,
    AigcTaskType,
)
from backend.app.schemas.common import utc_now


class JsonParserRepository(Protocol):
    def create_aigc_pipeline(self, data): ...

    def get_aigc_pipeline(self, pipeline_id: str): ...

    def update_aigc_pipeline(self, pipeline_id: str, data): ...

    def create_aigc_run(self, run, *, idempotency_key: str, nodes): ...

    def get_aigc_run(self, run_id: str): ...

    def update_aigc_run(self, run_id: str, **changes): ...

    def create_aigc_task_attempt(self, task, *, idempotency_key: str): ...

    def get_aigc_task_attempt(self, task_id: str): ...

    def acquire_aigc_worker_lease(
        self,
        owner_id: str,
        *,
        now,
        lease_seconds: int,
    ): ...

    def claim_aigc_task_attempt(self, task_id: str, *, fencing_token: int): ...

    def commit_aigc_json_parser_task_attempt(
        self,
        task_id: str,
        *,
        fencing_token: int,
        result: AigcTaskResult,
        metrics: AigcTaskMetrics,
    ): ...


@pytest.fixture(params=["memory", "mysql"])
def parser_repository(
    request: pytest.FixtureRequest,
    repository: InMemoryRepository,
    mysql_repository: MySQLRepository,
) -> JsonParserRepository:
    return repository if request.param == "memory" else mysql_repository


def _definition() -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                {
                    "id": "input",
                    "type": "text",
                    "position": {"x": 40, "y": 80},
                    "size": {"width": 240, "height": 160},
                    "config": {"text": '{"items":[]}'},
                },
                {
                    "id": "parser",
                    "type": "json_parser",
                    "position": {"x": 360, "y": 80},
                    "size": {"width": 240, "height": 160},
                    "config": {"json_path": "$.items"},
                },
            ],
            "edges": [
                {
                    "id": "input-parser",
                    "sourceNodeId": "input",
                    "sourceHandle": "text",
                    "targetNodeId": "parser",
                    "targetHandle": "text",
                }
            ],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        }
    )


def _items(*values: str) -> AigcTaskResult:
    return AigcTaskResult(
        kind=AigcResultKind.TEXT_ITEMS,
        items=[
            AigcJsonParserItem(index=index, text=value, summary=f"{index + 1:064x}")
            for index, value in enumerate(values)
        ],
    )


def _create_claimed_task(
    repository: JsonParserRepository,
    *,
    pipeline=None,
    idempotency_suffix: str = "1",
):
    if pipeline is None:
        pipeline = repository.create_aigc_pipeline(
            AigcPipelineCreate(name="JSON parser", definition=_definition())
        )
    run = AigcPipelineRun(
        pipeline_id=pipeline.id,
        run_number=int(idempotency_suffix),
        pipeline_revision=pipeline.revision,
        mode="full",
        status=AigcPipelineRunStatus.RUNNING,
        definition_snapshot=pipeline.definition,
    )
    detail = repository.create_aigc_run(
        run,
        idempotency_key=f"parser-run-{idempotency_suffix}",
        nodes=[
            AigcPipelineRunNode(
                node_id=node.id,
                included_in_plan=True,
                status=AigcRunNodeStatus.QUEUED,
            )
            for node in run.definition_snapshot.nodes
        ],
    )
    task = repository.create_aigc_task_attempt(
        AigcPipelineTaskAttempt(
            pipeline_id=pipeline.id,
            run_id=detail.run.id,
            node_id="parser",
            type=AigcTaskType.JSON_PARSER,
            params={
                "json_path": "$.items",
                "source_node_id": "input",
                "source_text_length": 12,
                "source_text_digest": hashlib.sha256(
                    b'{"items":[]}'
                ).hexdigest(),
            },
            upstream=["input"],
        ),
        idempotency_key=f"parser-task-{idempotency_suffix}",
    )
    now = utc_now()
    lease = repository.acquire_aigc_worker_lease(
        f"worker-{idempotency_suffix}",
        now=now,
        lease_seconds=300,
    )
    if lease is None:
        lease = repository.acquire_aigc_worker_lease(
            f"worker-{idempotency_suffix}",
            now=now + timedelta(seconds=301),
            lease_seconds=300,
        )
    assert lease is not None
    claimed = repository.claim_aigc_task_attempt(
        task.task_id,
        fencing_token=lease.fencing_token,
    )
    assert claimed is not None
    return pipeline, detail, claimed, lease


def _managed_nodes(pipeline) -> list:
    return sorted(
        [
            node
            for node in pipeline.definition.nodes
            if node.type.value == "text"
            and node.config.generated_by_parser_node_id == "parser"
        ],
        key=lambda node: node.config.generated_item_index,
    )


def test_parser_attempt_round_trip_persists_only_source_metadata(
    parser_repository: JsonParserRepository,
) -> None:
    _, _, task, _ = _create_claimed_task(parser_repository)

    persisted = parser_repository.get_aigc_task_attempt(task.task_id)

    assert persisted.params == {
        "json_path": "$.items",
        "source_node_id": "input",
        "source_text_length": 12,
        "source_text_digest": hashlib.sha256(b'{"items":[]}').hexdigest(),
    }
    assert "text" not in persisted.params


def test_parser_commit_materializes_latest_definition_atomically(
    parser_repository: JsonParserRepository,
) -> None:
    pipeline, detail, task, lease = _create_claimed_task(parser_repository)
    latest_payload = pipeline.definition.model_dump(mode="json", by_alias=True)
    latest_payload["nodes"][1]["position"] = {"x": 420, "y": 120}
    latest_payload["viewport"] = {"x": 20, "y": 30, "zoom": 0.8}
    latest = parser_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            name="JSON parser renamed",
            description="saved while parser was running",
            definition=AigcPipelineDefinitionV2.model_validate(latest_payload),
            expected_revision=pipeline.revision,
        ),
    )

    committed, accepted = (
        parser_repository.commit_aigc_json_parser_task_attempt(
            task.task_id,
            fencing_token=lease.fencing_token,
            result=_items("one", '{"two":2}', "三"),
            metrics=AigcTaskMetrics(duration_ms=12),
        )
    )

    assert accepted is True
    assert committed.status == AigcTaskStatus.SUCCEEDED
    materialized = parser_repository.get_aigc_pipeline(pipeline.id)
    assert materialized.revision == latest.revision + 1
    assert materialized.name == "JSON parser renamed"
    assert materialized.definition.viewport == latest.definition.viewport
    assert next(
        node for node in materialized.definition.nodes if node.id == "parser"
    ).position == latest.definition.nodes[1].position
    managed = _managed_nodes(materialized)
    assert [node.config.text for node in managed] == ["one", '{"two":2}', "三"]
    assert [node.config.title for node in managed] == [
        "JSON 项 1",
        "JSON 项 2",
        "JSON 项 3",
    ]
    assert all(
        node.config.generated_from_run_id == detail.run.id for node in managed
    )
    assert len(
        [
            edge
            for edge in materialized.definition.edges
            if edge.source_node_id == "parser" and edge.source_handle == "items"
        ]
    ) == 3
    current_run = parser_repository.get_aigc_run(detail.run.id)
    assert current_run.run.definition_snapshot == detail.run.definition_snapshot
    assert {node.node_id for node in current_run.nodes} == {"input", "parser"}


def test_parser_rerun_reuses_layout_and_protects_downstream_nodes(
    parser_repository: JsonParserRepository,
) -> None:
    pipeline, first_run, task, lease = _create_claimed_task(parser_repository)
    parser_repository.commit_aigc_json_parser_task_attempt(
        task.task_id,
        fencing_token=lease.fencing_token,
        result=_items("zero", "one", "two"),
        metrics=AigcTaskMetrics(),
    )
    first = parser_repository.get_aigc_pipeline(pipeline.id)
    first_managed = _managed_nodes(first)
    payload = first.definition.model_dump(mode="json", by_alias=True)
    payload["nodes"][0]["config"]["text"] = "user edit survives"
    payload["nodes"][2]["position"] = {"x": 901, "y": 377}
    payload["nodes"][2]["size"] = {"width": 333, "height": 222}
    payload["nodes"].append(
        {
            "id": "consumer",
            "type": "text",
            "position": {"x": 1200, "y": 400},
            "size": {"width": 240, "height": 160},
            "config": {"text": ""},
        }
    )
    payload["edges"].append(
        {
            "id": "user-downstream",
            "sourceNodeId": first_managed[1].id,
            "sourceHandle": "text",
            "targetNodeId": "consumer",
            "targetHandle": "text",
        }
    )
    saved = parser_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            name=first.name,
            description=first.description,
            definition=AigcPipelineDefinitionV2.model_validate(payload),
            expected_revision=first.revision,
        ),
    )
    parser_repository.update_aigc_run(
        first_run.run.id,
        status=AigcPipelineRunStatus.SUCCEEDED,
        finished_at=utc_now(),
    )
    _, _, rerun_task, rerun_lease = _create_claimed_task(
        parser_repository,
        pipeline=saved,
        idempotency_suffix="2",
    )

    parser_repository.commit_aigc_json_parser_task_attempt(
        rerun_task.task_id,
        fencing_token=rerun_lease.fencing_token,
        result=_items("updated"),
        metrics=AigcTaskMetrics(),
    )

    rerun = parser_repository.get_aigc_pipeline(pipeline.id)
    managed = _managed_nodes(rerun)
    assert [node.id for node in managed] == [
        first_managed[0].id,
        first_managed[1].id,
    ]
    assert managed[0].position.x == 901
    assert managed[0].position.y == 377
    assert managed[0].size.width == 333
    assert managed[0].size.height == 222
    assert managed[0].config.text == "updated"
    assert managed[1].config.text == ""
    assert managed[1].config.generated_from_run_id is None
    assert first_managed[2].id not in {node.id for node in rerun.definition.nodes}
    assert any(edge.id == "user-downstream" for edge in rerun.definition.edges)
    assert next(node for node in rerun.definition.nodes if node.id == "input").config.text == (
        "user edit survives"
    )


def test_deleting_system_edge_detaches_managed_text_and_next_run_recreates_it(
    parser_repository: JsonParserRepository,
) -> None:
    pipeline, first_run, task, lease = _create_claimed_task(parser_repository)
    parser_repository.commit_aigc_json_parser_task_attempt(
        task.task_id,
        fencing_token=lease.fencing_token,
        result=_items("kept"),
        metrics=AigcTaskMetrics(),
    )
    first = parser_repository.get_aigc_pipeline(pipeline.id)
    old_managed = _managed_nodes(first)[0]
    payload = first.definition.model_dump(mode="json", by_alias=True)
    payload["edges"] = [
        edge
        for edge in payload["edges"]
        if edge["targetNodeId"] != old_managed.id
    ]
    detached = parser_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            name=first.name,
            description=first.description,
            definition=AigcPipelineDefinitionV2.model_validate(payload),
            expected_revision=first.revision,
        ),
    )
    old_after_save = next(
        node for node in detached.definition.nodes if node.id == old_managed.id
    )
    assert old_after_save.config.text == "kept"
    assert old_after_save.config.generated_by_parser_node_id is None
    assert old_after_save.config.generated_item_index is None
    assert old_after_save.config.generated_from_run_id is None

    parser_repository.update_aigc_run(
        first_run.run.id,
        status=AigcPipelineRunStatus.SUCCEEDED,
        finished_at=utc_now(),
    )
    _, _, rerun_task, rerun_lease = _create_claimed_task(
        parser_repository,
        pipeline=detached,
        idempotency_suffix="2",
    )
    parser_repository.commit_aigc_json_parser_task_attempt(
        rerun_task.task_id,
        fencing_token=rerun_lease.fencing_token,
        result=_items("new"),
        metrics=AigcTaskMetrics(),
    )
    rerun = parser_repository.get_aigc_pipeline(pipeline.id)
    assert next(
        node for node in rerun.definition.nodes if node.id == old_managed.id
    ).config.text == "kept"
    replacement = _managed_nodes(rerun)
    assert len(replacement) == 1
    assert replacement[0].id != old_managed.id
    assert replacement[0].config.text == "new"


@pytest.mark.parametrize("change", ["deleted", "type_changed"])
def test_parser_source_change_fails_task_without_definition_mutation(
    parser_repository: JsonParserRepository,
    change: str,
) -> None:
    pipeline, _, task, lease = _create_claimed_task(parser_repository)
    payload = pipeline.definition.model_dump(mode="json", by_alias=True)
    if change == "deleted":
        payload["nodes"] = [node for node in payload["nodes"] if node["id"] != "parser"]
        payload["edges"] = []
    else:
        payload["nodes"][1] = {
            "id": "parser",
            "type": "text",
            "position": payload["nodes"][1]["position"],
            "size": payload["nodes"][1]["size"],
            "config": {"text": "now plain"},
        }
        payload["edges"][0]["targetHandle"] = "text"
    changed = parser_repository.update_aigc_pipeline(
        pipeline.id,
        AigcPipelineUpdate(
            name=pipeline.name,
            description=pipeline.description,
            definition=AigcPipelineDefinitionV2.model_validate(payload),
            expected_revision=pipeline.revision,
        ),
    )

    committed, accepted = (
        parser_repository.commit_aigc_json_parser_task_attempt(
            task.task_id,
            fencing_token=lease.fencing_token,
            result=_items("must not appear"),
            metrics=AigcTaskMetrics(),
        )
    )

    assert accepted is True
    assert committed.status == AigcTaskStatus.FAILED
    assert committed.error is not None
    assert committed.error.code == "json_parser_source_changed"
    after = parser_repository.get_aigc_pipeline(pipeline.id)
    assert after.revision == changed.revision
    assert after.definition == changed.definition


def test_parser_commit_honors_fencing_and_cancel_cas(
    parser_repository: JsonParserRepository,
) -> None:
    pipeline, detail, task, lease = _create_claimed_task(parser_repository)
    stale_task, stale_accepted = (
        parser_repository.commit_aigc_json_parser_task_attempt(
            task.task_id,
            fencing_token=lease.fencing_token + 1,
            result=_items("stale"),
            metrics=AigcTaskMetrics(),
        )
    )
    assert stale_accepted is False
    assert stale_task.status == AigcTaskStatus.RUNNING
    assert parser_repository.get_aigc_pipeline(pipeline.id).revision == 0

    parser_repository.update_aigc_run(
        detail.run.id,
        cancellation_requested=True,
    )
    canceled, accepted = parser_repository.commit_aigc_json_parser_task_attempt(
        task.task_id,
        fencing_token=lease.fencing_token,
        result=_items("canceled"),
        metrics=AigcTaskMetrics(),
    )
    assert accepted is False
    assert canceled.status == AigcTaskStatus.CANCELED
    assert parser_repository.get_aigc_pipeline(pipeline.id).revision == 0


def test_parser_materialization_exception_rolls_back_task_and_pipeline(
    parser_repository: JsonParserRepository,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pipeline, _, task, lease = _create_claimed_task(parser_repository)

    def fail_materialization_write(*args, **kwargs):
        raise RuntimeError("forced materialization failure")

    monkeypatch.setattr(
        parser_repository,
        "_replace_aigc_pipeline_assets",
        fail_materialization_write,
    )
    with pytest.raises(RuntimeError, match="forced materialization failure"):
        parser_repository.commit_aigc_json_parser_task_attempt(
            task.task_id,
            fencing_token=lease.fencing_token,
            result=_items("rollback"),
            metrics=AigcTaskMetrics(),
        )

    assert parser_repository.get_aigc_task_attempt(task.task_id).status == (
        AigcTaskStatus.RUNNING
    )
    after = parser_repository.get_aigc_pipeline(pipeline.id)
    assert after.revision == pipeline.revision
    assert after.definition == pipeline.definition
