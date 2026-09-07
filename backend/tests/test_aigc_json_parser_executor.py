from __future__ import annotations

import asyncio
import hashlib
import logging

from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AigcPipelineCreate,
    AigcPipelineDefinitionV2,
    AigcPipelineRunCreate,
    AigcPipelineRunMode,
    AigcPipelineRunStatus,
    AigcPipelineUpdate,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskResult,
    AigcTaskStatus,
    AigcTaskType,
)
from backend.app.services.aigc_executor import AigcPipelineRuntime
from backend.app.services.aigc_pipeline import AigcPipelineService

from backend.tests.test_aigc_executor import FakeGateway, edge, node


def _definition(
    source_text: str = '{"items":["one","two"]}',
) -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                node("source", "text", 0, config={"text": source_text}),
                node(
                    "parser",
                    "json_parser",
                    300,
                    config={"json_path": "$.items"},
                ),
                node("independent-source", "text", 0, config={"text": "独立"}),
                node("independent", "llm", 300),
            ],
            "edges": [
                edge("source-parser", "source", "text", "parser", "text"),
                edge(
                    "independent-edge",
                    "independent-source",
                    "text",
                    "independent",
                    "prompt",
                ),
            ],
        }
    )


def _llm_definition() -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                node("prompt", "text", 0, config={"text": "Return JSON"}),
                node("source", "llm", 300),
                node(
                    "parser",
                    "json_parser",
                    600,
                    config={"json_path": "$.items"},
                ),
            ],
            "edges": [
                edge("prompt-source", "prompt", "text", "source", "prompt"),
                edge("source-parser", "source", "text", "parser", "text"),
            ],
        }
    )


def _run(coroutine):
    return asyncio.run(coroutine())


def test_json_parser_first_run_executes_locally_and_materializes_atomically() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(name="parser", definition=_definition())
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=pipeline.revision,
                    mode=AigcPipelineRunMode.FULL,
                ),
                idempotency_key="parser-first",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(created.run.id),
                repository.get_aigc_pipeline(pipeline.id),
                gateway,
            )
        finally:
            await runtime.stop()

    detail, pipeline, gateway = _run(scenario)
    by_id = {item.node_id: item for item in detail.nodes}
    parser = by_id["parser"]

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert parser.status == AigcRunNodeStatus.SUCCEEDED
    assert parser.attempts[0].type == AigcTaskType.JSON_PARSER
    assert parser.attempts[0].params == {
        "json_path": "$.items",
        "source_node_id": "source",
        "source_text_length": 23,
        "source_text_digest": hashlib.sha256(
            b'{"items":["one","two"]}'
        ).hexdigest(),
    }
    assert parser.result.kind == AigcResultKind.TEXT_ITEMS
    assert [item.text for item in parser.result.items] == ["one", "two"]
    assert parser.input_hash is not None
    assert gateway.calls == {"independent": 1}
    assert pipeline.revision == 1
    managed = [
        item
        for item in pipeline.definition.nodes
        if item.type.value == "text"
        and item.config.generated_by_parser_node_id == "parser"
    ]
    assert [item.config.generated_item_index for item in managed] == [0, 1]
    assert {item.node_id for item in detail.nodes} == {
        "source",
        "parser",
        "independent-source",
        "independent",
    }
    assert {
        item.id for item in detail.run.definition_snapshot.nodes
    } == {item.node_id for item in detail.nodes}


def test_json_parser_empty_array_succeeds_without_creating_managed_nodes() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(
                name="empty parser",
                definition=_definition('{"items":[]}'),
            )
        )
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="parser-empty",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(created.run.id),
                repository.get_aigc_pipeline(pipeline.id),
            )
        finally:
            await runtime.stop()

    detail, pipeline = _run(scenario)
    parser = next(item for item in detail.nodes if item.node_id == "parser")

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert parser.result.kind == AigcResultKind.TEXT_ITEMS
    assert parser.result.items == []
    assert pipeline.revision == 1
    assert not any(
        item.type.value == "text"
        and item.config.generated_by_parser_node_id == "parser"
        for item in pipeline.definition.nodes
    )


def test_json_parser_later_run_projects_by_index_and_blocks_missing_item() -> None:
    async def scenario():
        repository = InMemoryRepository()
        service = AigcPipelineService(repository)
        pipeline = service.create_pipeline(
            AigcPipelineCreate(name="parser projection", definition=_definition())
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            first = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="parser-projection-first",
            )
            await runtime.wait_until_idle()
            materialized = repository.get_aigc_pipeline(pipeline.id)
            payload = materialized.definition.model_dump(
                mode="json",
                by_alias=True,
            )
            source = next(item for item in payload["nodes"] if item["id"] == "source")
            source["config"]["text"] = '{"items":["updated"]}'
            managed = sorted(
                [
                    item
                    for item in payload["nodes"]
                    if item["config"].get("generated_by_parser_node_id") == "parser"
                ],
                key=lambda item: item["config"]["generated_item_index"],
            )
            payload["nodes"].append(node("consumer", "llm", 900))
            payload["edges"].append(
                edge(
                    "missing-consumer",
                    managed[1]["id"],
                    "text",
                    "consumer",
                    "prompt",
                )
            )
            saved = service.update_pipeline(
                pipeline.id,
                AigcPipelineUpdate(
                    name=materialized.name,
                    description=materialized.description,
                    definition=AigcPipelineDefinitionV2.model_validate(payload),
                    expected_revision=materialized.revision,
                ),
            )
            second = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=saved.revision,
                    mode="full",
                ),
                idempotency_key="parser-projection-second",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(second.run.id),
                repository.get_aigc_pipeline(pipeline.id),
                managed,
                gateway,
            )
        finally:
            await runtime.stop()

    first, second, pipeline, managed, gateway = _run(scenario)
    by_id = {item.node_id: item for item in second.nodes}

    assert first.run.definition_snapshot != second.run.definition_snapshot
    assert second.run.definition_snapshot.nodes[-1].id == "consumer"
    assert by_id[managed[0]["id"]].status == AigcRunNodeStatus.SUCCEEDED
    assert by_id[managed[0]["id"]].result.text == "updated"
    assert by_id[managed[1]["id"]].status == AigcRunNodeStatus.BLOCKED
    assert by_id[managed[1]["id"]].result.kind == AigcResultKind.UNAVAILABLE
    assert by_id[managed[1]["id"]].result.text is None
    assert by_id["consumer"].status == AigcRunNodeStatus.BLOCKED
    assert by_id["independent"].status == AigcRunNodeStatus.SUCCEEDED
    protected = next(
        item for item in pipeline.definition.nodes if item.id == managed[1]["id"]
    )
    assert protected.config.text == ""
    assert protected.config.generated_from_run_id is None
    assert gateway.calls == {"independent": 2}


def test_json_parser_failure_cache_retry_and_queued_cancellation() -> None:
    async def scenario():
        repository = InMemoryRepository()
        service = AigcPipelineService(repository)
        pipeline = service.create_pipeline(
            AigcPipelineCreate(
                name="parser failure",
                definition=_definition('{"other":[]}'),
            )
        )
        gateway = FakeGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            failed = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="parser-failed",
            )
            await runtime.wait_until_idle()
            payload = pipeline.definition.model_dump(mode="json", by_alias=True)
            payload["nodes"][0]["config"]["text"] = '{"items":["fixed"]}'
            fixed = service.update_pipeline(
                pipeline.id,
                AigcPipelineUpdate(
                    name=pipeline.name,
                    description=pipeline.description,
                    definition=AigcPipelineDefinitionV2.model_validate(payload),
                    expected_revision=0,
                ),
            )
            retried = await runtime.retry_node(
                failed.run.id,
                "parser",
                idempotency_key="parser-retry",
            )
            await runtime.wait_until_idle()
            fixed_run = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=fixed.revision,
                    mode="full",
                ),
                idempotency_key="parser-fixed",
            )
            await runtime.wait_until_idle()
            current = repository.get_aigc_pipeline(pipeline.id)
            managed_id = next(
                item.id
                for item in current.definition.nodes
                if item.type.value == "text"
                and item.config.generated_by_parser_node_id == "parser"
            )
            cached = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=current.revision,
                    mode="from_node",
                    start_node_id=managed_id,
                ),
                idempotency_key="parser-cache",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(failed.run.id),
                repository.get_aigc_run(retried.run.id),
                repository.get_aigc_run(fixed_run.run.id),
                repository.get_aigc_run(cached.run.id),
                gateway,
            )
        finally:
            await runtime.stop()

    failed, retried, fixed, cached, gateway = _run(scenario)
    failed_by_id = {item.node_id: item for item in failed.nodes}
    retried_parser = next(item for item in retried.nodes if item.node_id == "parser")
    fixed_parser = next(item for item in fixed.nodes if item.node_id == "parser")
    cached_parser = next(item for item in cached.nodes if item.node_id == "parser")

    assert failed.run.status == AigcPipelineRunStatus.FAILED
    assert failed_by_id["parser"].error is not None
    assert failed_by_id["parser"].error.code == "json_parser_path_not_found"
    assert failed_by_id["independent"].status == AigcRunNodeStatus.SUCCEEDED
    assert retried.run.definition_snapshot == failed.run.definition_snapshot
    assert retried_parser.status == AigcRunNodeStatus.FAILED
    assert retried_parser.input_hash == failed_by_id["parser"].input_hash
    assert fixed_parser.status == AigcRunNodeStatus.SUCCEEDED
    assert fixed_parser.input_hash != failed_by_id["parser"].input_hash
    assert cached_parser.status == AigcRunNodeStatus.REUSED
    assert cached_parser.reused_from_task_id == fixed_parser.current_task_id
    assert gateway.calls == {"independent": 2}

    async def cancel_scenario():
        repository = InMemoryRepository()
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(name="parser cancel", definition=_definition())
        )
        runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
            worker_count=0,
        )
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="parser-cancel",
            )
            canceled = await runtime.cancel_run(created.run.id)
            return canceled
        finally:
            await runtime.stop()

    canceled = _run(cancel_scenario)
    parser = next(item for item in canceled.nodes if item.node_id == "parser")
    assert canceled.run.status == AigcPipelineRunStatus.CANCELED
    assert parser.status == AigcRunNodeStatus.CANCELED
    assert parser.attempts[0].status == AigcTaskStatus.CANCELED


def test_json_parser_queued_task_survives_runtime_restart_without_source_params() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(name="parser restart", definition=_definition())
        )
        first_runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
            worker_count=0,
            lease_seconds=0,
        )
        created = await first_runtime.submit_run(
            pipeline.id,
            AigcPipelineRunCreate(expected_revision=0, mode="full"),
            idempotency_key="parser-restart",
        )
        queued = repository.get_aigc_run(created.run.id)
        parser_before = next(
            item for item in queued.nodes if item.node_id == "parser"
        )
        await first_runtime.stop()

        restarted_runtime = AigcPipelineRuntime(
            repository,
            FakeGateway(),  # type: ignore[arg-type]
        )
        try:
            assert "text" not in parser_before.attempts[0].params
            assert await restarted_runtime.start()
            await restarted_runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await restarted_runtime.stop()

    detail = _run(scenario)
    parser = next(item for item in detail.nodes if item.node_id == "parser")

    assert detail.run.status == AigcPipelineRunStatus.SUCCEEDED
    assert parser.status == AigcRunNodeStatus.SUCCEEDED
    assert [item.text for item in parser.result.items] == ["one", "two"]


def test_json_parser_failure_does_not_leak_llm_source(
    caplog,
) -> None:
    secret_source = 'not-json {"api_key":"sk-parser-secret"}'

    async def scenario():
        repository = InMemoryRepository()
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(
                name="parser redaction",
                definition=_llm_definition(),
            )
        )
        gateway = FakeGateway(
            results_by_node={
                "source": AigcTaskResult(
                    kind=AigcResultKind.TEXT,
                    text=secret_source,
                    text_digest=hashlib.sha256(
                        secret_source.encode("utf-8")
                    ).hexdigest(),
                )
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="parser-redaction",
            )
            await runtime.wait_until_idle()
            return repository.get_aigc_run(created.run.id)
        finally:
            await runtime.stop()

    with caplog.at_level(logging.DEBUG):
        detail = _run(scenario)

    by_id = {item.node_id: item for item in detail.nodes}
    source = by_id["source"]
    parser = by_id["parser"]
    parser_attempt = parser.attempts[0]

    assert source.result.text == secret_source
    assert parser_attempt.params == {
        "json_path": "$.items",
        "source_node_id": "source",
        "source_text_length": len(secret_source),
        "source_text_digest": hashlib.sha256(
            secret_source.encode("utf-8")
        ).hexdigest(),
    }
    assert parser.error is not None
    assert parser.error.code == "json_parser_invalid_json"
    assert secret_source not in parser_attempt.model_dump_json()
    assert secret_source not in parser.error.model_dump_json()
    assert secret_source not in detail.run.definition_snapshot.model_dump_json()
    assert secret_source not in str(detail.run.input_snapshot)
    assert secret_source not in caplog.text
