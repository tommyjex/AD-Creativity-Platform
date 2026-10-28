from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from pydantic import ValidationError

from backend.app.schemas import (
    AIGC_MODEL_OUTPUT_MATERIALIZATION,
    AigcEdge,
    AigcNodeType,
    AigcPipelineDefinitionV2,
    AigcPoint,
    AigcResultAsset,
    AigcResultKind,
    AigcTaskResult,
    ImageNode,
    VideoNode,
)


@dataclass(frozen=True)
class ModelOutputMaterialization:
    definition: AigcPipelineDefinitionV2
    changed: bool
    reason: str
    node_id: str | None = None


def detach_removed_model_output_edges(
    candidate: AigcPipelineDefinitionV2,
) -> AigcPipelineDefinitionV2:
    edge_keys = {
        (
            edge.source_node_id,
            edge.source_handle,
            edge.target_node_id,
            edge.target_handle,
        )
        for edge in candidate.edges
    }
    detached_node_ids = {
        node.id
        for node in candidate.nodes
        if isinstance(node, (ImageNode, VideoNode))
        and node.config.generated_by_model_node_id is not None
        and node.config.generated_output_handle is not None
        and (
            node.config.generated_by_model_node_id,
            node.config.generated_output_handle,
            node.id,
            node.config.generated_output_handle,
        )
        not in edge_keys
    }
    if not detached_node_ids:
        return candidate
    nodes = [
        (
            node.model_copy(
                update={
                    "config": node.config.model_copy(
                        update={
                            "generated_by_model_node_id": None,
                            "generated_output_handle": None,
                            "generated_from_run_id": None,
                        }
                    )
                },
                deep=True,
            )
            if isinstance(node, (ImageNode, VideoNode))
            and node.id in detached_node_ids
            else node
        )
        for node in candidate.nodes
    ]
    return candidate.model_copy(update={"nodes": nodes}, deep=True)


def materialize_model_output_definition(
    definition: AigcPipelineDefinitionV2,
    *,
    source_node_id: str,
    run_id: str,
    result: AigcTaskResult,
) -> ModelOutputMaterialization:
    definition = detach_removed_model_output_edges(definition)
    source = next(
        (node for node in definition.nodes if node.id == source_node_id),
        None,
    )
    mapping = (
        AIGC_MODEL_OUTPUT_MATERIALIZATION.get(source.type)
        if source is not None
        else None
    )
    if mapping is None:
        return ModelOutputMaterialization(
            definition=definition,
            changed=False,
            reason="source_changed",
        )
    target_type, output_handle = mapping
    primary = _primary_asset(result, output_handle)
    if primary is None:
        return ModelOutputMaterialization(
            definition=definition,
            changed=False,
            reason="result_unavailable",
        )

    managed = next(
        (
            node
            for node in definition.nodes
            if isinstance(node, (ImageNode, VideoNode))
            and node.config.generated_by_model_node_id == source_node_id
            and node.config.generated_output_handle == output_handle
        ),
        None,
    )
    nodes = list(definition.nodes)
    edges = list(definition.edges)
    if managed is not None:
        if any(
            edge.source_node_id == source_node_id
            and edge.source_handle == output_handle
            and edge.target_node_id != managed.id
            for edge in edges
        ):
            return ModelOutputMaterialization(
                definition=definition,
                changed=False,
                reason="output_connected",
                node_id=managed.id,
            )
        updated = managed.model_copy(
            update={
                "config": managed.config.model_copy(
                    update={
                        "asset_id": primary.asset_id,
                        "generated_from_run_id": run_id,
                    }
                )
            },
            deep=True,
        )
        nodes = [
            updated if node.id == managed.id else node
            for node in nodes
        ]
        _ensure_managed_edge(
            edges,
            source_node_id=source_node_id,
            output_handle=output_handle,
            target_node_id=managed.id,
        )
        updated_definition = _validated_definition(definition, nodes, edges)
        return ModelOutputMaterialization(
            definition=updated_definition,
            changed=updated_definition != definition,
            reason="updated",
            node_id=managed.id,
        )

    if any(
        edge.source_node_id == source_node_id
        and edge.source_handle == output_handle
        for edge in edges
    ):
        return ModelOutputMaterialization(
            definition=definition,
            changed=False,
            reason="output_connected",
        )

    position = _new_node_position(source, nodes)
    node_id = f"{target_type.value}-{uuid4()}"
    node_payload = {
        "id": node_id,
        "type": target_type.value,
        "position": position.model_dump(),
        "size": {"width": 240, "height": 160},
        "config": {
            "asset_id": primary.asset_id,
            "title": None,
            "generated_by_model_node_id": source_node_id,
            "generated_output_handle": output_handle,
            "generated_from_run_id": run_id,
        },
    }
    if target_type == AigcNodeType.IMAGE:
        created = ImageNode.model_validate(node_payload)
    else:
        created = VideoNode.model_validate(node_payload)
    nodes.append(created)
    _ensure_managed_edge(
        edges,
        source_node_id=source_node_id,
        output_handle=output_handle,
        target_node_id=node_id,
    )
    return ModelOutputMaterialization(
        definition=_validated_definition(definition, nodes, edges),
        changed=True,
        reason="created",
        node_id=node_id,
    )


def _primary_asset(
    result: AigcTaskResult,
    output_handle: str,
) -> AigcResultAsset | None:
    if result.kind != AigcResultKind.ASSETS:
        return None
    return next(
        (
            asset
            for asset in result.assets
            if asset.available
            and asset.ordinal == 0
            and asset.mime_type is not None
            and asset.mime_type.lower().startswith(f"{output_handle}/")
        ),
        None,
    )


def _ensure_managed_edge(
    edges: list[AigcEdge],
    *,
    source_node_id: str,
    output_handle: str,
    target_node_id: str,
) -> None:
    matching = [
        index
        for index, edge in enumerate(edges)
        if edge.source_node_id == source_node_id
        and edge.source_handle == output_handle
        and edge.target_node_id == target_node_id
        and edge.target_handle == output_handle
    ]
    if matching:
        for index in reversed(matching[1:]):
            del edges[index]
        return
    edges.append(
        AigcEdge(
            id=f"model-output-{uuid4()}",
            sourceNodeId=source_node_id,
            sourceHandle=output_handle,
            targetNodeId=target_node_id,
            targetHandle=output_handle,
        )
    )


def _new_node_position(source, nodes: list) -> AigcPoint:
    width = 240.0
    height = 160.0
    x = source.position.x + source.size.width + 80.0
    slot = 0
    while True:
        if slot == 0:
            y = source.position.y
        else:
            distance = ((slot + 1) // 2) * 200.0
            y = source.position.y + (distance if slot % 2 else -distance)
        if not any(
            _rectangles_overlap(
                x,
                y,
                width,
                height,
                node.position.x,
                node.position.y,
                node.size.width,
                node.size.height,
            )
            for node in nodes
        ):
            return AigcPoint(x=x, y=y)
        slot += 1


def _rectangles_overlap(
    left_x: float,
    left_y: float,
    left_width: float,
    left_height: float,
    right_x: float,
    right_y: float,
    right_width: float,
    right_height: float,
) -> bool:
    gap = 20.0
    return not (
        left_x + left_width + gap <= right_x
        or right_x + right_width + gap <= left_x
        or left_y + left_height + gap <= right_y
        or right_y + right_height + gap <= left_y
    )


def _validated_definition(
    original: AigcPipelineDefinitionV2,
    nodes: list,
    edges: list[AigcEdge],
) -> AigcPipelineDefinitionV2:
    payload = original.model_dump(mode="json", by_alias=True)
    payload["nodes"] = [
        node.model_dump(mode="json", by_alias=True) for node in nodes
    ]
    payload["edges"] = [
        edge.model_dump(mode="json", by_alias=True) for edge in edges
    ]
    try:
        return AigcPipelineDefinitionV2.model_validate(payload)
    except ValidationError as exc:
        raise RuntimeError(
            "model output materialization produced an invalid definition"
        ) from exc
