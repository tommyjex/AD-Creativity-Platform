from __future__ import annotations

import asyncio
import logging

from backend.app.repositories import InMemoryRepository
from backend.app.schemas import (
    AigcPipelineCreate,
    AigcPipelineDefinitionV2,
    AigcPipelineRunCreate,
    AigcResultAsset,
    AigcResultKind,
    AigcRunNodeStatus,
    AigcTaskResult,
    AigcTaskStatus,
    AssetCreate,
    AssetType,
    Status,
    ToolAssetRole,
)
from backend.app.services.aigc_executor import AigcPipelineRuntime
from backend.app.services.aigc_pipeline import AigcPipelineService

from backend.tests.test_aigc_executor import BlockingGateway, FakeGateway, edge, node


def _image_definition() -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                node("prompt", "text", 0, config={"text": "product"}),
                node("model", "text_to_image", 300),
            ],
            "edges": [
                edge("prompt-model", "prompt", "text", "model", "prompt")
            ],
        }
    )


def _video_definition() -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                node("prompt", "text", 0, config={"text": "product"}),
                node("model", "video_generation", 300),
            ],
            "edges": [
                edge("prompt-model", "prompt", "text", "model", "prompt")
            ],
        }
    )


def _create_asset(
    repository: InMemoryRepository,
    asset_id: str,
    asset_type: AssetType,
    mime_type: str,
) -> None:
    extension = "png" if mime_type.startswith("image/") else "mp4"
    repository.create_asset(
        AssetCreate(
            id=asset_id,
            tool_asset_role=ToolAssetRole.OUTPUT,
            type=asset_type,
            status=Status.SUCCEEDED,
            object_key=f"aigc/{asset_id}.{extension}",
            mime_type=mime_type,
            size_bytes=100,
        )
    )


def _run(coroutine):
    return asyncio.run(coroutine())


def test_executor_materializes_success_and_reuse_without_extra_attempt() -> None:
    async def scenario():
        repository = InMemoryRepository()
        _create_asset(
            repository,
            "primary",
            AssetType.GENERATED_IMAGE,
            "image/png",
        )
        _create_asset(
            repository,
            "secondary",
            AssetType.GENERATED_IMAGE,
            "image/png",
        )
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(
                name="image materialization",
                definition=_image_definition(),
            )
        )
        gateway = FakeGateway(
            results_by_node={
                "model": AigcTaskResult(
                    kind=AigcResultKind.ASSETS,
                    assets=[
                        AigcResultAsset(
                            asset_id="primary",
                            ordinal=0,
                            mime_type="image/png",
                        ),
                        AigcResultAsset(
                            asset_id="secondary",
                            ordinal=1,
                            mime_type="image/png",
                        ),
                    ],
                )
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            first = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="materialize-success",
            )
            await runtime.wait_until_idle()
            after_first = repository.get_aigc_pipeline(pipeline.id)
            generated_node = next(
                item
                for item in after_first.definition.nodes
                if item.type.value == "image" and item.id != "prompt"
            )
            second = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(
                    expected_revision=after_first.revision,
                    mode="from_node",
                    start_node_id=generated_node.id,
                ),
                idempotency_key="materialize-reuse",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(first.run.id),
                repository.get_aigc_run(second.run.id),
                after_first,
                repository.get_aigc_pipeline(pipeline.id),
                gateway,
            )
        finally:
            await runtime.stop()

    first, second, after_first, after_second, gateway = _run(scenario)
    generated = [
        item
        for item in after_second.definition.nodes
        if item.type.value == "image" and item.id != "prompt"
    ]
    second_model = next(item for item in second.nodes if item.node_id == "model")

    assert len(generated) == 1
    assert generated[0].config.asset_id == "primary"
    assert generated[0].config.generated_from_run_id == second.run.id
    assert after_first.revision == 1
    assert after_second.revision == 2
    assert {item.node_id for item in first.nodes} == {"prompt", "model"}
    assert second_model.status == AigcRunNodeStatus.REUSED
    assert second_model.attempts == []
    assert gateway.calls == {"model": 1}


def test_executor_video_uses_primary_video_and_ignores_tail_image() -> None:
    async def scenario():
        repository = InMemoryRepository()
        _create_asset(
            repository,
            "video",
            AssetType.STORYBOARD_VIDEO,
            "video/mp4",
        )
        _create_asset(
            repository,
            "tail",
            AssetType.GENERATED_IMAGE,
            "image/jpeg",
        )
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(
                name="video materialization",
                definition=_video_definition(),
            )
        )
        gateway = FakeGateway(
            results_by_node={
                "model": AigcTaskResult(
                    kind=AigcResultKind.ASSETS,
                    assets=[
                        AigcResultAsset(
                            asset_id="video",
                            ordinal=0,
                            mime_type="video/mp4",
                        ),
                        AigcResultAsset(
                            asset_id="tail",
                            ordinal=1,
                            mime_type="image/jpeg",
                        ),
                    ],
                )
            }
        )
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="materialize-video",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(created.run.id),
                repository.get_aigc_pipeline(pipeline.id),
            )
        finally:
            await runtime.stop()

    detail, pipeline = _run(scenario)
    generated = [
        item for item in pipeline.definition.nodes if item.id not in {"prompt", "model"}
    ]
    assert detail.run.status.value == "succeeded"
    assert [(item.type.value, item.config.asset_id) for item in generated] == [
        ("video", "video")
    ]


def test_executor_keeps_success_when_materialization_fails_and_logs_safely(
    caplog,
) -> None:
    async def scenario():
        repository = InMemoryRepository()
        _create_asset(
            repository,
            "primary",
            AssetType.GENERATED_IMAGE,
            "image/png",
        )
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(
                name="isolated failure",
                definition=_image_definition(),
            )
        )
        gateway = FakeGateway(
            results_by_node={
                "model": AigcTaskResult(
                    kind=AigcResultKind.ASSETS,
                    assets=[
                        AigcResultAsset(
                            asset_id="primary",
                            ordinal=0,
                            mime_type="image/png",
                            download_url=(
                                "https://signed.example/file?"
                                "signature=must-not-log"
                            ),
                        )
                    ],
                )
            }
        )

        def fail_materialization(*args, **kwargs):
            raise RuntimeError(
                "provider-body https://signed.example/file?signature=secret"
            )

        repository.materialize_aigc_model_output = fail_materialization  # type: ignore[method-assign]
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="materialize-failure",
            )
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(created.run.id),
                repository.get_aigc_pipeline(pipeline.id),
            )
        finally:
            await runtime.stop()

    with caplog.at_level(
        logging.ERROR,
        logger="backend.app.services.aigc_executor",
    ):
        detail, pipeline = _run(scenario)
    model = next(item for item in detail.nodes if item.node_id == "model")

    assert model.status == AigcRunNodeStatus.SUCCEEDED
    assert model.attempts[0].status == AigcTaskStatus.SUCCEEDED
    assert pipeline.revision == 0
    assert "materialization" in caplog.text
    assert "provider-body" not in caplog.text
    assert "signed.example" not in caplog.text
    assert "signature" not in caplog.text


def test_executor_does_not_materialize_failed_or_unavailable_results() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(
                name="no materialization",
                definition=_image_definition(),
            )
        )
        failed_gateway = FakeGateway(fail_node="model")
        failed_runtime = AigcPipelineRuntime(
            repository,
            failed_gateway,  # type: ignore[arg-type]
        )
        try:
            failed = await failed_runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="materialize-failed",
            )
            await failed_runtime.wait_until_idle()
        finally:
            await failed_runtime.stop()
        unavailable_gateway = FakeGateway(
            results_by_node={
                "model": AigcTaskResult(kind=AigcResultKind.UNAVAILABLE)
            }
        )
        unavailable_runtime = AigcPipelineRuntime(
            repository,
            unavailable_gateway,  # type: ignore[arg-type]
        )
        try:
            unavailable = await unavailable_runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="materialize-unavailable",
            )
            await unavailable_runtime.wait_until_idle()
        finally:
            await unavailable_runtime.stop()
        return (
            repository.get_aigc_run(failed.run.id),
            repository.get_aigc_run(unavailable.run.id),
            repository.get_aigc_pipeline(pipeline.id),
        )

    failed, unavailable, pipeline = _run(scenario)
    failed_model = next(item for item in failed.nodes if item.node_id == "model")
    unavailable_model = next(
        item for item in unavailable.nodes if item.node_id == "model"
    )
    assert failed_model.status == AigcRunNodeStatus.FAILED
    assert unavailable_model.status == AigcRunNodeStatus.SUCCEEDED
    assert unavailable_model.result.kind == AigcResultKind.UNAVAILABLE
    assert pipeline.revision == 0
    assert len(pipeline.definition.nodes) == 2


def test_executor_cancellation_rejects_late_materializable_result() -> None:
    async def scenario():
        repository = InMemoryRepository()
        pipeline = AigcPipelineService(repository).create_pipeline(
            AigcPipelineCreate(
                name="cancel materialization",
                definition=_image_definition(),
            )
        )
        gateway = BlockingGateway()
        runtime = AigcPipelineRuntime(repository, gateway)  # type: ignore[arg-type]
        try:
            created = await runtime.submit_run(
                pipeline.id,
                AigcPipelineRunCreate(expected_revision=0, mode="full"),
                idempotency_key="materialize-canceled",
            )
            await asyncio.wait_for(gateway.started.wait(), timeout=1)
            await runtime.cancel_run(created.run.id)
            gateway.release.set()
            await runtime.wait_until_idle()
            return (
                repository.get_aigc_run(created.run.id),
                repository.get_aigc_pipeline(pipeline.id),
            )
        finally:
            await runtime.stop()

    detail, pipeline = _run(scenario)
    model = next(item for item in detail.nodes if item.node_id == "model")
    assert model.status == AigcRunNodeStatus.CANCELED
    assert model.result.kind == AigcResultKind.NONE
    assert pipeline.revision == 0
    assert len(pipeline.definition.nodes) == 2
