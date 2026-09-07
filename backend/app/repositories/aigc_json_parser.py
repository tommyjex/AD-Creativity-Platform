from __future__ import annotations

from uuid import uuid4

from pydantic import ValidationError

from backend.app.schemas import (
    AigcEdge,
    AigcNodeType,
    AigcPipelineDefinitionV2,
    AigcPoint,
    AigcSize,
    AigcTaskResult,
    TextNode,
)


class JsonParserMaterializationError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def detach_removed_json_parser_edges(
    candidate: AigcPipelineDefinitionV2,
) -> AigcPipelineDefinitionV2:
    candidate_edges = {
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
        if isinstance(node, TextNode)
        and node.config.generated_by_parser_node_id is not None
        and (
            node.config.generated_by_parser_node_id,
            "items",
            node.id,
            "text",
        )
        not in candidate_edges
    }
    if not detached_node_ids:
        return candidate
    nodes = [
        (
            node.model_copy(
                update={
                    "config": node.config.model_copy(
                        update={
                            "generated_by_parser_node_id": None,
                            "generated_item_index": None,
                            "generated_from_run_id": None,
                        }
                    )
                },
                deep=True,
            )
            if isinstance(node, TextNode) and node.id in detached_node_ids
            else node
        )
        for node in candidate.nodes
    ]
    return candidate.model_copy(update={"nodes": nodes}, deep=True)


def materialize_json_parser_definition(
    definition: AigcPipelineDefinitionV2,
    *,
    parser_node_id: str,
    run_id: str,
    result: AigcTaskResult,
) -> AigcPipelineDefinitionV2:
    definition = detach_removed_json_parser_edges(definition)
    parser = next(
        (node for node in definition.nodes if node.id == parser_node_id),
        None,
    )
    if parser is None or parser.type != AigcNodeType.JSON_PARSER:
        raise JsonParserMaterializationError(
            "json_parser_source_changed",
            "JSON parser source changed before materialization",
        )
    if result.kind.value != "text_items":
        raise JsonParserMaterializationError(
            "json_parser_materialization_failed",
            "JSON parser result does not contain text items",
        )

    nodes = list(definition.nodes)
    edges = list(definition.edges)
    managed_by_index = {
        node.config.generated_item_index: node
        for node in nodes
        if isinstance(node, TextNode)
        and node.config.generated_by_parser_node_id == parser_node_id
        and node.config.generated_item_index is not None
    }
    item_count = len(result.items)
    removed_node_ids: set[str] = set()

    for index, node in managed_by_index.items():
        if index < item_count:
            item = result.items[index]
            updated_config = node.config.model_copy(
                update={
                    "text": item.text,
                    "upstream_text_override": None,
                    "generated_from_run_id": run_id,
                },
                deep=True,
            )
            _replace_node(
                nodes,
                node.model_copy(update={"config": updated_config}, deep=True),
            )
            _ensure_system_edge(edges, parser_node_id, node.id)
            continue

        has_downstream = any(edge.source_node_id == node.id for edge in edges)
        if has_downstream:
            unavailable_config = node.config.model_copy(
                update={
                    "text": "",
                    "upstream_text_override": None,
                    "generated_from_run_id": None,
                },
                deep=True,
            )
            _replace_node(
                nodes,
                node.model_copy(
                    update={"config": unavailable_config},
                    deep=True,
                ),
            )
            _ensure_system_edge(edges, parser_node_id, node.id)
        else:
            removed_node_ids.add(node.id)

    if removed_node_ids:
        nodes = [node for node in nodes if node.id not in removed_node_ids]
        edges = [
            edge
            for edge in edges
            if edge.source_node_id not in removed_node_ids
            and edge.target_node_id not in removed_node_ids
        ]

    for item in result.items:
        if item.index in managed_by_index:
            continue
        position = _new_node_position(
            parser_position=parser.position,
            parser_size=parser.size,
            item_index=item.index,
            nodes=nodes,
        )
        node = TextNode.model_validate(
            {
                "id": f"text-{uuid4()}",
                "type": "text",
                "position": position.model_dump(),
                "size": {"width": 240, "height": 160},
                "config": {
                    "text": item.text,
                    "title": f"JSON 项 {item.index + 1}",
                    "generated_by_parser_node_id": parser_node_id,
                    "generated_item_index": item.index,
                    "generated_from_run_id": run_id,
                },
            }
        )
        nodes.append(node)
        _ensure_system_edge(edges, parser_node_id, node.id)

    payload = definition.model_dump(mode="json", by_alias=True)
    payload["nodes"] = [
        node.model_dump(mode="json", by_alias=True) for node in nodes
    ]
    payload["edges"] = [
        edge.model_dump(mode="json", by_alias=True) for edge in edges
    ]
    try:
        return AigcPipelineDefinitionV2.model_validate(payload)
    except ValidationError as exc:
        raise JsonParserMaterializationError(
            "json_parser_materialization_failed",
            "JSON parser materialization produced an invalid definition",
        ) from exc


def _replace_node(nodes: list, replacement: TextNode) -> None:
    for index, node in enumerate(nodes):
        if node.id == replacement.id:
            nodes[index] = replacement
            return
    raise AssertionError(f"managed node disappeared: {replacement.id}")


def _ensure_system_edge(
    edges: list[AigcEdge],
    parser_node_id: str,
    target_node_id: str,
) -> None:
    matching_indexes = [
        index
        for index, edge in enumerate(edges)
        if (
            edge.source_node_id == parser_node_id
            and edge.source_handle == "items"
            and edge.target_node_id == target_node_id
            and edge.target_handle == "text"
        )
    ]
    if matching_indexes:
        for index in reversed(matching_indexes[1:]):
            del edges[index]
        return
    edges.append(
        AigcEdge(
            id=f"parser-item-{uuid4()}",
            sourceNodeId=parser_node_id,
            sourceHandle="items",
            targetNodeId=target_node_id,
            targetHandle="text",
        )
    )


def _new_node_position(
    *,
    parser_position: AigcPoint,
    parser_size: AigcSize,
    item_index: int,
    nodes: list,
) -> AigcPoint:
    width = 240.0
    height = 160.0
    x = parser_position.x + parser_size.width + 80.0
    y = parser_position.y + item_index * 200.0
    while any(
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
        y += 200.0
    return AigcPoint(x=x, y=y)


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
