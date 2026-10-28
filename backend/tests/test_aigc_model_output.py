from __future__ import annotations

from pydantic import ValidationError
import pytest

from backend.app.repositories.aigc_model_output import (
    detach_removed_model_output_edges,
    materialize_model_output_definition,
)
from backend.app.schemas import (
    AIGC_MODEL_OUTPUT_MATERIALIZATION,
    AigcPipelineDefinitionV2,
    AigcResultAsset,
    AigcResultKind,
    AigcTaskResult,
    ImageConfig,
    VideoConfig,
)


def _node(
    node_id: str,
    node_type: str,
    x: float,
    y: float = 0,
    *,
    config: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": x, "y": y},
        "size": {"width": 240, "height": 160},
        "config": config or {},
    }


def _definition(
    source_type: str = "text_to_image",
    *,
    extra_nodes: list[dict[str, object]] | None = None,
    edges: list[dict[str, object]] | None = None,
) -> AigcPipelineDefinitionV2:
    return AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                _node("model", source_type, 300),
                *(extra_nodes or []),
            ],
            "edges": edges or [],
        }
    )


def _result(
    *assets: tuple[str, int, str, bool],
) -> AigcTaskResult:
    return AigcTaskResult(
        kind=AigcResultKind.ASSETS,
        assets=[
            AigcResultAsset(
                asset_id=asset_id,
                ordinal=ordinal,
                mime_type=mime_type,
                available=available,
            )
            for asset_id, ordinal, mime_type, available in assets
        ],
    )


def test_contract_requires_complete_generated_source_fields() -> None:
    with pytest.raises(
        ValidationError,
        match="generated model source fields must be provided together",
    ):
        ImageConfig(generated_by_model_node_id="model")
    with pytest.raises(
        ValidationError,
        match="generated model source fields must be provided together",
    ):
        VideoConfig(
            generated_by_model_node_id="model",
            generated_output_handle="video",
        )

    assert {
        node_type.value: (target.value, handle)
        for node_type, (target, handle) in AIGC_MODEL_OUTPUT_MATERIALIZATION.items()
    } == {
        "text_to_image": ("image", "image"),
        "image_to_image": ("image", "image"),
        "video_generation": ("video", "video"),
        "video_enhancement": ("video", "video"),
        "video_face_blur": ("video", "video"),
    }


def test_definition_rejects_duplicate_or_mismatched_generated_sources() -> None:
    config = {
        "asset_id": "asset",
        "generated_by_model_node_id": "model",
        "generated_output_handle": "image",
        "generated_from_run_id": "run",
    }
    with pytest.raises(
        ValidationError,
        match="generated model output keys must be unique",
    ):
        _definition(
            extra_nodes=[
                _node("one", "image", 600, config=config),
                _node("two", "image", 900, config=config),
            ]
        )
    with pytest.raises(
        ValidationError,
        match="generated model output source is invalid",
    ):
        _definition(
            extra_nodes=[
                _node(
                    "wrong",
                    "video",
                    600,
                    config={
                        **config,
                        "generated_output_handle": "video",
                    },
                )
            ]
        )


def test_materialization_creates_one_primary_image_in_nearest_free_slot() -> None:
    definition = _definition(
        extra_nodes=[_node("blocker", "image", 620)]
    )

    materialized = materialize_model_output_definition(
        definition,
        source_node_id="model",
        run_id="run-1",
        result=_result(
            ("primary", 0, "image/png", True),
            ("secondary", 1, "image/png", True),
        ),
    )

    assert materialized.changed is True
    assert materialized.reason == "created"
    generated = next(
        node
        for node in materialized.definition.nodes
        if node.id == materialized.node_id
    )
    assert generated.type.value == "image"
    assert generated.config.asset_id == "primary"
    assert generated.position.x == 620
    assert generated.position.y == 200
    assert len(materialized.definition.edges) == 1


def test_materialization_skips_other_outgoing_edge_and_unavailable_result() -> None:
    connected = _definition(
        extra_nodes=[_node("manual", "image", 620)],
        edges=[
            {
                "id": "manual-edge",
                "sourceNodeId": "model",
                "sourceHandle": "image",
                "targetNodeId": "manual",
                "targetHandle": "image",
            }
        ],
    )
    skipped = materialize_model_output_definition(
        connected,
        source_node_id="model",
        run_id="run-1",
        result=_result(("primary", 0, "image/png", True)),
    )
    unavailable = materialize_model_output_definition(
        _definition(),
        source_node_id="model",
        run_id="run-1",
        result=AigcTaskResult(
            kind=AigcResultKind.UNAVAILABLE,
            assets=[
                AigcResultAsset(
                    asset_id="primary",
                    ordinal=0,
                    mime_type="image/png",
                    available=False,
                )
            ],
        ),
    )

    assert skipped.changed is False
    assert skipped.reason == "output_connected"
    assert unavailable.changed is False
    assert unavailable.reason == "result_unavailable"


def test_rerun_reuses_node_and_preserves_user_fields_and_downstream() -> None:
    first = materialize_model_output_definition(
        _definition(),
        source_node_id="model",
        run_id="run-1",
        result=_result(("first", 0, "image/png", True)),
    )
    payload = first.definition.model_dump(mode="json", by_alias=True)
    generated = next(
        node for node in payload["nodes"] if node["id"] == first.node_id
    )
    generated["position"] = {"x": 999, "y": 321}
    generated["size"] = {"width": 333, "height": 222}
    generated["custom_name"] = "kept"
    payload["nodes"].append(_node("consumer", "image_to_image", 1400))
    payload["edges"].append(
        {
            "id": "downstream",
            "sourceNodeId": first.node_id,
            "sourceHandle": "image",
            "targetNodeId": "consumer",
            "targetHandle": "image",
        }
    )

    rerun = materialize_model_output_definition(
        AigcPipelineDefinitionV2.model_validate(payload),
        source_node_id="model",
        run_id="run-2",
        result=_result(("second", 0, "image/jpeg", True)),
    )

    updated = next(
        node for node in rerun.definition.nodes if node.id == first.node_id
    )
    assert rerun.reason == "updated"
    assert updated.position.x == 999
    assert updated.size.width == 333
    assert updated.custom_name == "kept"
    assert updated.config.asset_id == "second"
    assert updated.config.generated_from_run_id == "run-2"
    assert any(edge.id == "downstream" for edge in rerun.definition.edges)


def test_rerun_skips_when_source_output_has_another_downstream() -> None:
    first = materialize_model_output_definition(
        _definition(),
        source_node_id="model",
        run_id="run-1",
        result=_result(("first", 0, "image/png", True)),
    )
    payload = first.definition.model_dump(mode="json", by_alias=True)
    payload["nodes"].append(_node("manual", "image", 900))
    payload["edges"].append(
        {
            "id": "manual-edge",
            "sourceNodeId": "model",
            "sourceHandle": "image",
            "targetNodeId": "manual",
            "targetHandle": "image",
        }
    )

    rerun = materialize_model_output_definition(
        AigcPipelineDefinitionV2.model_validate(payload),
        source_node_id="model",
        run_id="run-2",
        result=_result(("second", 0, "image/jpeg", True)),
    )

    generated = next(
        node for node in rerun.definition.nodes if node.id == first.node_id
    )
    assert rerun.changed is False
    assert rerun.reason == "output_connected"
    assert generated.config.asset_id == "first"
    assert generated.config.generated_from_run_id == "run-1"


def test_materialization_skips_when_source_is_deleted_or_changes_type() -> None:
    deleted = materialize_model_output_definition(
        AigcPipelineDefinitionV2(
            schemaVersion=2,
            nodes=[],
            edges=[],
        ),
        source_node_id="model",
        run_id="run-1",
        result=_result(("primary", 0, "image/png", True)),
    )
    changed = materialize_model_output_definition(
        _definition("llm"),
        source_node_id="model",
        run_id="run-1",
        result=_result(("primary", 0, "image/png", True)),
    )

    assert deleted.changed is False
    assert deleted.reason == "source_changed"
    assert changed.changed is False
    assert changed.reason == "source_changed"


def test_deleted_managed_edge_detaches_and_video_tail_never_creates_image() -> None:
    first = materialize_model_output_definition(
        _definition(),
        source_node_id="model",
        run_id="run-1",
        result=_result(("image", 0, "image/png", True)),
    )
    detached = detach_removed_model_output_edges(
        first.definition.model_copy(update={"edges": []}, deep=True)
    )
    old = next(node for node in detached.nodes if node.id == first.node_id)
    assert old.config.asset_id == "image"
    assert old.config.generated_by_model_node_id is None
    assert old.config.generated_output_handle is None
    assert old.config.generated_from_run_id is None

    video = materialize_model_output_definition(
        _definition("video_generation"),
        source_node_id="model",
        run_id="run-video",
        result=_result(
            ("video", 0, "video/mp4", True),
            ("tail", 1, "image/jpeg", True),
        ),
    )
    generated = [
        node for node in video.definition.nodes if node.id != "model"
    ]
    assert len(generated) == 1
    assert generated[0].type.value == "video"
    assert generated[0].config.asset_id == "video"

    recreated = materialize_model_output_definition(
        detached,
        source_node_id="model",
        run_id="run-2",
        result=_result(("replacement", 0, "image/png", True)),
    )
    assert recreated.reason == "created"
    assert recreated.node_id != first.node_id
    old_after = next(
        node for node in recreated.definition.nodes if node.id == first.node_id
    )
    new_after = next(
        node for node in recreated.definition.nodes if node.id == recreated.node_id
    )
    assert old_after.config.asset_id == "image"
    assert old_after.config.generated_by_model_node_id is None
    assert new_after.config.asset_id == "replacement"
