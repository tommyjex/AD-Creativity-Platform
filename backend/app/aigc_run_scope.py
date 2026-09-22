from __future__ import annotations

from collections import deque
from typing import TypeAlias

from backend.app.schemas import (
    AigcPipelineDefinition,
    AigcPipelineDefinitionV2,
    AigcPipelineRunMode,
)
from backend.app.schemas.aigc_definition_migration import (
    migrate_aigc_definition_v2,
)


AigcGraphDefinition: TypeAlias = (
    AigcPipelineDefinition | AigcPipelineDefinitionV2
)


class AigcDagValidationError(ValueError):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        node_id: str | None = None,
        edge_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.node_id = node_id
        self.edge_id = edge_id


def aigc_connected_node_ids(
    definition: AigcGraphDefinition,
    start_node_id: str,
) -> frozenset[str]:
    definition = _canonical_graph(definition)
    node_ids = {node.id for node in definition.nodes}
    if start_node_id not in node_ids:
        raise AigcDagValidationError(
            "start_node_missing",
            "incremental execution requires a valid start node",
            node_id=start_node_id,
        )

    adjacency = {node_id: set() for node_id in node_ids}
    for edge in definition.edges:
        adjacency[edge.source_node_id].add(edge.target_node_id)
        adjacency[edge.target_node_id].add(edge.source_node_id)

    visited = {start_node_id}
    pending = deque([start_node_id])
    while pending:
        current = pending.popleft()
        for neighbor in adjacency[current] - visited:
            visited.add(neighbor)
            pending.append(neighbor)
    return frozenset(visited)


def aigc_downstream_node_ids(
    definition: AigcGraphDefinition,
    start_node_id: str,
) -> frozenset[str]:
    definition = _canonical_graph(definition)
    node_ids = {node.id for node in definition.nodes}
    _require_start_node(node_ids, start_node_id)

    children = {node_id: set() for node_id in node_ids}
    for edge in definition.edges:
        children[edge.source_node_id].add(edge.target_node_id)
    return _walk(start_node_id, children)


def aigc_projection_node_ids(
    definition: AigcGraphDefinition,
    start_node_id: str,
) -> frozenset[str]:
    definition = _canonical_graph(definition)
    node_ids = {node.id for node in definition.nodes}
    _require_start_node(node_ids, start_node_id)

    children = {node_id: set() for node_id in node_ids}
    parents = {node_id: set() for node_id in node_ids}
    for edge in definition.edges:
        children[edge.source_node_id].add(edge.target_node_id)
        parents[edge.target_node_id].add(edge.source_node_id)

    downstream = _walk(start_node_id, children)
    projected = set(downstream)
    pending = deque(downstream)
    while pending:
        current = pending.popleft()
        for parent in parents[current] - projected:
            projected.add(parent)
            pending.append(parent)
    return frozenset(projected)


def aigc_run_conflict_node_ids(
    definition: AigcGraphDefinition,
    *,
    mode: AigcPipelineRunMode,
    start_node_id: str | None,
) -> frozenset[str]:
    definition = _canonical_graph(definition)
    if mode == AigcPipelineRunMode.FULL:
        return frozenset(node.id for node in definition.nodes)
    if start_node_id is None:
        raise AigcDagValidationError(
            "start_node_missing",
            "incremental execution requires a valid start node",
        )
    return aigc_downstream_node_ids(definition, start_node_id)


def aigc_run_projection_node_ids(
    definition: AigcGraphDefinition,
    *,
    mode: AigcPipelineRunMode,
    start_node_id: str | None,
) -> frozenset[str]:
    definition = _canonical_graph(definition)
    if mode == AigcPipelineRunMode.FULL:
        return frozenset(node.id for node in definition.nodes)
    if start_node_id is None:
        raise AigcDagValidationError(
            "start_node_missing",
            "incremental execution requires a valid start node",
        )
    return aigc_projection_node_ids(definition, start_node_id)


def aigc_run_scope_node_ids(
    definition: AigcGraphDefinition,
    *,
    mode: AigcPipelineRunMode,
    start_node_id: str | None,
) -> frozenset[str]:
    """Compatibility alias for the Run projection scope."""
    return aigc_run_projection_node_ids(
        definition,
        mode=mode,
        start_node_id=start_node_id,
    )


def _require_start_node(node_ids: set[str], start_node_id: str) -> None:
    if start_node_id not in node_ids:
        raise AigcDagValidationError(
            "start_node_missing",
            "incremental execution requires a valid start node",
            node_id=start_node_id,
        )


def _walk(
    start_node_id: str,
    adjacency: dict[str, set[str]],
) -> frozenset[str]:
    visited = {start_node_id}
    pending = deque([start_node_id])
    while pending:
        current = pending.popleft()
        for neighbor in adjacency[current] - visited:
            visited.add(neighbor)
            pending.append(neighbor)
    return frozenset(visited)


def _canonical_graph(
    definition: AigcGraphDefinition,
) -> AigcPipelineDefinitionV2:
    if isinstance(definition, AigcPipelineDefinitionV2):
        return definition
    return AigcPipelineDefinitionV2.model_validate(
        migrate_aigc_definition_v2(
            definition.model_dump(mode="json", by_alias=True)
        )
    )
