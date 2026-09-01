from __future__ import annotations

import hashlib
import json
from collections import defaultdict, deque
from dataclasses import dataclass
from enum import Enum
from typing import Iterable, Mapping

from backend.app.schemas import (
    AIGC_DEFAULT_IMAGE_MODEL,
    AIGC_MAX_EDGES,
    AIGC_MAX_NODES,
    AIGC_NODE_REGISTRY,
    AigcNode,
    AigcNodeType,
    AigcPipelineDefinition,
    AigcPipelineRunMode,
    AigcVideoGenerationMode,
    AudioInputNode,
    ImageInputNode,
    ImageToImageNode,
    LayerCanvasNode,
    TextInputNode,
    VideoGenerationNode,
    VideoInputNode,
)
from backend.app.schemas.seedance import SEEDANCE_CAPABILITIES, SEEDANCE_DEFAULT_MODEL


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


class AigcPlanAction(str, Enum):
    IDLE = "idle"
    RESOLVE = "resolve"
    EXECUTE = "execute"
    REUSE = "reuse"
    PROJECT = "project"


@dataclass(frozen=True)
class AigcCacheCandidate:
    node_id: str
    input_hash: str
    task_id: str
    output_available: bool


@dataclass(frozen=True)
class AigcUpstreamDigest:
    target_handle: str
    source_node_id: str
    source_handle: str
    digest: str
    ordinal: int | None = None


@dataclass(frozen=True)
class AigcExecutionPlan:
    topological_order: tuple[str, ...]
    actions: Mapping[str, AigcPlanAction]
    reused_from_task_ids: Mapping[str, str]

    @property
    def executable_node_ids(self) -> tuple[str, ...]:
        return tuple(
            node_id
            for node_id in self.topological_order
            if self.actions[node_id] == AigcPlanAction.EXECUTE
        )


NODE_REGISTRY_BY_TYPE = {item.type: item for item in AIGC_NODE_REGISTRY}
MODEL_NODE_TYPES = {
    AigcNodeType.LLM,
    AigcNodeType.TEXT_TO_IMAGE,
    AigcNodeType.IMAGE_TO_IMAGE,
    AigcNodeType.VIDEO_GENERATION,
}
EXECUTABLE_NODE_TYPES = MODEL_NODE_TYPES | {
    AigcNodeType.LAYER_CANVAS,
    AigcNodeType.LAYER_COMPOSITE,
}
INPUT_NODE_TYPES = {
    AigcNodeType.TEXT_INPUT,
    AigcNodeType.IMAGE_INPUT,
    AigcNodeType.VIDEO_INPUT,
    AigcNodeType.AUDIO_INPUT,
}
OUTPUT_NODE_TYPES = {
    AigcNodeType.TEXT_OUTPUT,
    AigcNodeType.IMAGE_OUTPUT,
    AigcNodeType.VIDEO_OUTPUT,
}

ASSET_INPUT_NODE_TYPES = (ImageInputNode, VideoInputNode, AudioInputNode)
VIDEO_REFERENCE_LIMIT_ATTRIBUTES = {
    "reference_images": "max_reference_images",
    "reference_videos": "max_reference_videos",
    "reference_audios": "max_reference_audios",
}


def validate_aigc_dag(
    definition: AigcPipelineDefinition,
    *,
    available_asset_ids: set[str] | None = None,
    require_complete: bool = True,
) -> tuple[str, ...]:
    if len(definition.nodes) > AIGC_MAX_NODES:
        raise AigcDagValidationError("too_many_nodes", "node limit exceeded")
    if len(definition.edges) > AIGC_MAX_EDGES:
        raise AigcDagValidationError("too_many_edges", "edge limit exceeded")
    if (
        require_complete
        and not any(node.type in MODEL_NODE_TYPES for node in definition.nodes)
    ):
        raise AigcDagValidationError(
            "model_node_required",
            "the graph must contain at least one model node",
        )

    node_by_id = {node.id: node for node in definition.nodes}
    incoming: dict[str, list[str]] = defaultdict(list)
    outgoing: dict[str, list[str]] = defaultdict(list)
    input_connection_counts: dict[tuple[str, str], int] = defaultdict(int)
    output_connection_counts: dict[tuple[str, str], int] = defaultdict(int)
    edge_connections: set[tuple[str, str, str, str]] = set()

    for node in definition.nodes:
        if require_complete and isinstance(node, ASSET_INPUT_NODE_TYPES):
            asset_id = node.config.asset_id
            if not asset_id:
                raise AigcDagValidationError(
                    "asset_required",
                    f"{node.type.value} requires an asset",
                    node_id=node.id,
                )
            if (
                available_asset_ids is not None
                and asset_id not in available_asset_ids
            ):
                raise AigcDagValidationError(
                    "asset_unavailable",
                    f"{node.type.value} asset is unavailable",
                    node_id=node.id,
                )

    for edge in definition.edges:
        connection = (
            edge.source_node_id,
            edge.source_handle,
            edge.target_node_id,
            edge.target_handle,
        )
        if connection in edge_connections:
            raise AigcDagValidationError(
                "duplicate_edge",
                "an identical edge connection already exists",
                node_id=edge.target_node_id,
                edge_id=edge.id,
            )
        edge_connections.add(connection)

        source = node_by_id.get(edge.source_node_id)
        target = node_by_id.get(edge.target_node_id)
        if source is None:
            raise AigcDagValidationError(
                "source_node_missing",
                "edge source node does not exist",
                edge_id=edge.id,
            )
        if target is None:
            raise AigcDagValidationError(
                "target_node_missing",
                "edge target node does not exist",
                edge_id=edge.id,
            )
        if source.id == target.id:
            raise AigcDagValidationError(
                "self_loop",
                "self loops are not allowed",
                node_id=source.id,
                edge_id=edge.id,
            )
        source_port = _port(source, edge.source_handle, output=True)
        target_port = _port(target, edge.target_handle, output=False)
        if source_port is None:
            raise AigcDagValidationError(
                "source_port_missing",
                "edge source port does not exist",
                node_id=source.id,
                edge_id=edge.id,
            )
        if target_port is None:
            raise AigcDagValidationError(
                "target_port_missing",
                "edge target port does not exist",
                node_id=target.id,
                edge_id=edge.id,
            )
        if not _image_port_enabled(source, source_port.id, output=True):
            raise AigcDagValidationError(
                "output_not_allowed_for_operation",
                (
                    f"{source_port.id} output is not enabled for "
                    f"{source.config.operation}"
                ),
                node_id=source.id,
                edge_id=edge.id,
            )
        if not _image_port_enabled(target, target_port.id, output=False):
            raise AigcDagValidationError(
                "input_not_allowed_for_operation",
                (
                    f"{target_port.id} input is not enabled for "
                    f"{target.config.operation}"
                ),
                node_id=target.id,
                edge_id=edge.id,
            )
        if source_port.type != target_port.type:
            raise AigcDagValidationError(
                "port_type_mismatch",
                "edge port types are incompatible",
                node_id=target.id,
                edge_id=edge.id,
            )
        if (
            isinstance(target, VideoGenerationNode)
            and target_port.modes
            and target.config.generation_mode not in target_port.modes
        ):
            raise AigcDagValidationError(
                "input_not_allowed_for_mode",
                (
                    f"{target_port.id} is not allowed for "
                    f"{target.config.generation_mode.value}"
                ),
                node_id=target.id,
                edge_id=edge.id,
            )
        input_key = (target.id, target_port.id)
        connection_count = input_connection_counts[input_key]
        max_connections = _max_input_connections(target, target_port.id)
        if connection_count >= max_connections:
            code = (
                "input_connection_limit_exceeded"
                if target_port.multiple
                else "input_already_connected"
            )
            raise AigcDagValidationError(
                code,
                (
                    f"input connection limit exceeded: "
                    f"{target_port.id} accepts at most "
                    f"{max_connections} edge(s)"
                ),
                node_id=target.id,
                edge_id=edge.id,
            )
        input_connection_counts[input_key] += 1
        output_connection_counts[(source.id, source_port.id)] += 1
        incoming[target.id].append(source.id)
        outgoing[source.id].append(target.id)

    _validate_bbox_prompt_references(definition, node_by_id)
    _validate_image_node_connections(
        definition,
        input_connection_counts,
        output_connection_counts,
        require_complete=require_complete,
    )
    _validate_layer_canvas_connections(
        definition,
        output_connection_counts,
    )
    if require_complete:
        _validate_video_generation_inputs(definition, input_connection_counts)

        for node in definition.nodes:
            registry = NODE_REGISTRY_BY_TYPE[node.type]
            for port in registry.inputs:
                if (
                    not isinstance(node, ImageToImageNode)
                    and port.required
                    and input_connection_counts[(node.id, port.id)] == 0
                ):
                    raise AigcDagValidationError(
                        "required_input_missing",
                        f"required input is not connected: {port.id}",
                        node_id=node.id,
                    )

    indegree = {node.id: len(incoming[node.id]) for node in definition.nodes}
    ready = deque(node.id for node in definition.nodes if indegree[node.id] == 0)
    order: list[str] = []
    while ready:
        node_id = ready.popleft()
        order.append(node_id)
        for target_id in outgoing[node_id]:
            indegree[target_id] -= 1
            if indegree[target_id] == 0:
                ready.append(target_id)
    if len(order) != len(definition.nodes):
        raise AigcDagValidationError("cycle_detected", "the graph contains a cycle")
    return tuple(order)


def validate_aigc_dag_structure(
    definition: AigcPipelineDefinition,
) -> tuple[str, ...]:
    """Validate persistable graph structure without requiring runnable inputs."""
    return validate_aigc_dag(definition, require_complete=False)


def _max_input_connections(node: AigcNode, port_id: str) -> int:
    port = _port(node, port_id, output=False)
    if port is None:
        return 0
    if (
        isinstance(node, ImageToImageNode)
        and node.config.operation == "layer_decomposition"
        and port_id == "image"
    ):
        return 1
    limit_attribute = VIDEO_REFERENCE_LIMIT_ATTRIBUTES.get(port_id)
    if not isinstance(node, VideoGenerationNode) or limit_attribute is None:
        return port.max_connections
    capabilities = SEEDANCE_CAPABILITIES[node.config.model]
    return int(getattr(capabilities, limit_attribute))


def _image_port_enabled(
    node: AigcNode,
    port_id: str,
    *,
    output: bool,
) -> bool:
    if not isinstance(node, ImageToImageNode):
        return True
    operation = node.config.operation
    enabled = (
        {
            "image_to_image": {"image"},
            "image_edit": {"image", "edited_layer"},
            "layer_decomposition": {"layers"},
        }
        if output
        else {
            "image_to_image": {"image", "prompt"},
            "image_edit": {"edit_image", "edit_layer", "prompt"},
            "layer_decomposition": {"image", "prompt"},
        }
    )
    return port_id in enabled[operation]


def _validate_image_node_connections(
    definition: AigcPipelineDefinition,
    input_counts: Mapping[tuple[str, str], int],
    output_counts: Mapping[tuple[str, str], int],
    *,
    require_complete: bool,
) -> None:
    for node in definition.nodes:
        if not isinstance(node, ImageToImageNode):
            continue
        counts = {
            handle: input_counts[(node.id, handle)]
            for handle in ("image", "edit_image", "edit_layer", "prompt")
        }
        operation = node.config.operation
        if (
            operation == "layer_decomposition"
            and node.config.model != AIGC_DEFAULT_IMAGE_MODEL
        ):
            raise AigcDagValidationError(
                "model_not_supported_for_operation",
                "layer_decomposition requires Seedream 5.0 Pro",
                node_id=node.id,
            )
        if operation == "image_edit":
            target_count = counts["edit_image"] + counts["edit_layer"]
            if target_count > 1:
                raise AigcDagValidationError(
                    "image_edit_target_conflict",
                    "image_edit requires exactly one of edit_image or edit_layer",
                    node_id=node.id,
                )
            if counts["edit_image"] and output_counts[(node.id, "edited_layer")]:
                raise AigcDagValidationError(
                    "output_not_allowed_for_operation",
                    "edit_image tasks only enable the image output",
                    node_id=node.id,
                )
            if counts["edit_layer"] and output_counts[(node.id, "image")]:
                raise AigcDagValidationError(
                    "output_not_allowed_for_operation",
                    "edit_layer tasks only enable the edited_layer output",
                    node_id=node.id,
                )
            if require_complete and target_count == 0:
                raise AigcDagValidationError(
                    "image_edit_target_required",
                    "image_edit requires exactly one of edit_image or edit_layer",
                    node_id=node.id,
                )
        if not require_complete:
            continue
        if operation == "image_to_image" and counts["image"] == 0:
            raise AigcDagValidationError(
                "required_input_missing",
                "image_to_image requires a connected image",
                node_id=node.id,
            )
        if operation == "layer_decomposition" and counts["image"] != 1:
            raise AigcDagValidationError(
                "required_input_missing",
                "layer_decomposition requires one connected image",
                node_id=node.id,
            )
        if operation != "layer_decomposition" and counts["prompt"] == 0:
            raise AigcDagValidationError(
                "required_input_missing",
                f"{operation} requires a connected prompt",
                node_id=node.id,
            )


def _validate_layer_canvas_connections(
    definition: AigcPipelineDefinition,
    output_counts: Mapping[tuple[str, str], int],
) -> None:
    for node in definition.nodes:
        if (
            isinstance(node, LayerCanvasNode)
            and output_counts[(node.id, "selected_layer")]
            and node.config.selected_layer_id is None
        ):
            raise AigcDagValidationError(
                "selected_layer_required",
                "selected_layer output requires a selected layer",
                node_id=node.id,
            )


def _validate_video_generation_inputs(
    definition: AigcPipelineDefinition,
    connection_counts: Mapping[tuple[str, str], int],
) -> None:
    for node in definition.nodes:
        if not isinstance(node, VideoGenerationNode):
            continue
        counts = {
            handle: connection_counts[(node.id, handle)]
            for handle in (
                "prompt",
                "first_frame",
                "last_frame",
                "reference_images",
                "reference_videos",
                "reference_audios",
            )
        }
        prompt_count = counts["prompt"]
        first_frame_count = counts["first_frame"]
        last_frame_count = counts["last_frame"]
        image_count = counts["reference_images"]
        video_count = counts["reference_videos"]
        audio_count = counts["reference_audios"]
        mode = node.config.generation_mode

        if (
            mode == AigcVideoGenerationMode.TEXT_TO_VIDEO
            and prompt_count == 0
        ):
            raise AigcDagValidationError(
                "required_input_missing",
                "text_to_video requires a connected prompt",
                node_id=node.id,
            )
        if (
            mode
            in {
                AigcVideoGenerationMode.FIRST_FRAME,
                AigcVideoGenerationMode.FIRST_LAST_FRAME,
            }
            and first_frame_count == 0
        ):
            raise AigcDagValidationError(
                "required_input_missing",
                f"{mode.value} requires a connected first_frame",
                node_id=node.id,
            )
        if (
            mode == AigcVideoGenerationMode.FIRST_LAST_FRAME
            and last_frame_count == 0
        ):
            raise AigcDagValidationError(
                "required_input_missing",
                "first_last_frame requires a connected last_frame",
                node_id=node.id,
            )
        if mode != AigcVideoGenerationMode.MULTIMODAL_REFERENCE:
            continue
        if prompt_count + image_count + video_count + audio_count == 0:
            raise AigcDagValidationError(
                "reference_input_required",
                "multimodal_reference requires a prompt or reference asset",
                node_id=node.id,
            )
        if (
            node.config.model != SEEDANCE_DEFAULT_MODEL
            and audio_count > 0
            and image_count + video_count == 0
        ):
            raise AigcDagValidationError(
                "audio_only_not_supported",
                f"{node.config.model} does not support audio-only input",
                node_id=node.id,
            )
        if (
            node.config.task_type in {"edit", "extend"}
            and video_count == 0
        ):
            raise AigcDagValidationError(
                "reference_video_required",
                f"{node.config.task_type} requires a reference video",
                node_id=node.id,
            )


def _validate_bbox_prompt_references(
    definition: AigcPipelineDefinition,
    node_by_id: Mapping[str, AigcNode],
) -> None:
    edges_by_source: dict[str, list] = defaultdict(list)
    for edge in definition.edges:
        edges_by_source[edge.source_node_id].append(edge)

    for node in definition.nodes:
        if not isinstance(node, TextInputNode) or not node.config.bbox_references:
            continue
        prompt_edges = edges_by_source[node.id]
        if not prompt_edges:
            raise AigcDagValidationError(
                "bbox_reference_downstream_invalid",
                "text input with bbox references requires an image_to_image downstream",
                node_id=node.id,
            )
        target_ids: list[str] = []
        for edge in prompt_edges:
            target = node_by_id[edge.target_node_id]
            if (
                not isinstance(target, ImageToImageNode)
                or target.config.operation != "image_to_image"
                or edge.source_handle != "text"
                or edge.target_handle != "prompt"
            ):
                raise AigcDagValidationError(
                    "bbox_reference_downstream_invalid",
                    "bbox references require only image_to_image prompt downstreams",
                    node_id=node.id,
                    edge_id=edge.id,
                )
            target_ids.append(target.id)

        for reference in node.config.bbox_references:
            source = node_by_id.get(reference.source_node_id)
            if source is None:
                raise AigcDagValidationError(
                    "bbox_reference_source_missing",
                    "bbox reference source node does not exist",
                    node_id=node.id,
                )
            if not isinstance(source, ImageInputNode):
                raise AigcDagValidationError(
                    "bbox_reference_source_invalid",
                    "bbox reference source must be an image input node",
                    node_id=node.id,
                )
            if source.config.bbox is None:
                raise AigcDagValidationError(
                    "bbox_reference_bbox_missing",
                    "bbox reference source has no selection",
                    node_id=node.id,
                )
            for target_id in target_ids:
                if not any(
                    edge.source_node_id == source.id
                    and edge.source_handle == "image"
                    and edge.target_node_id == target_id
                    and edge.target_handle == "image"
                    for edge in definition.edges
                ):
                    target_edge = next(
                        edge
                        for edge in prompt_edges
                        if edge.target_node_id == target_id
                    )
                    raise AigcDagValidationError(
                        "bbox_reference_downstream_invalid",
                        "referenced image is not connected to every image_to_image downstream",
                        node_id=node.id,
                        edge_id=target_edge.id,
                    )


def build_aigc_execution_plan(
    definition: AigcPipelineDefinition,
    *,
    mode: AigcPipelineRunMode,
    start_node_id: str | None = None,
    input_hashes: Mapping[str, str] | None = None,
    cache_candidates: Mapping[str, AigcCacheCandidate] | None = None,
    available_asset_ids: set[str] | None = None,
) -> AigcExecutionPlan:
    order = validate_aigc_dag(
        definition,
        available_asset_ids=available_asset_ids,
    )
    node_by_id = {node.id: node for node in definition.nodes}
    parents, children = _adjacency(definition)
    hashes = input_hashes or {}
    candidates = cache_candidates or {}

    if mode == AigcPipelineRunMode.FULL:
        actions = {
            node_id: _default_action(node_by_id[node_id], execute_models=True)
            for node_id in order
        }
        return AigcExecutionPlan(order, actions, {})
    if mode != AigcPipelineRunMode.FROM_NODE:
        raise ValueError("retry_node plans are created from a source run")
    if start_node_id is None or start_node_id not in node_by_id:
        raise AigcDagValidationError(
            "start_node_missing",
            "incremental execution requires a valid start node",
            node_id=start_node_id,
        )

    descendants = _walk(start_node_id, children)
    forced = descendants | {start_node_id}
    relevant = set(forced)
    pending = list(forced)
    while pending:
        node_id = pending.pop()
        for parent_id in parents[node_id]:
            if parent_id in relevant:
                continue
            relevant.add(parent_id)
            pending.append(parent_id)
    actions: dict[str, AigcPlanAction] = {}
    reused: dict[str, str] = {}

    for node_id in order:
        node = node_by_id[node_id]
        if node_id not in relevant:
            actions[node_id] = AigcPlanAction.IDLE
            continue
        if node.type in INPUT_NODE_TYPES:
            actions[node_id] = AigcPlanAction.RESOLVE
            continue
        if node.type in OUTPUT_NODE_TYPES:
            actions[node_id] = AigcPlanAction.PROJECT
            continue
        if node_id in forced:
            actions[node_id] = AigcPlanAction.EXECUTE
            continue
        if node.type not in MODEL_NODE_TYPES:
            actions[node_id] = AigcPlanAction.EXECUTE
            continue
        upstream_model_recomputed = any(
            actions.get(parent_id) == AigcPlanAction.EXECUTE
            for parent_id in parents[node_id]
            if node_by_id[parent_id].type in EXECUTABLE_NODE_TYPES
        )
        candidate = candidates.get(node_id)
        expected_hash = hashes.get(node_id)
        if (
            not upstream_model_recomputed
            and candidate is not None
            and candidate.output_available
            and expected_hash is not None
            and candidate.input_hash == expected_hash
        ):
            actions[node_id] = AigcPlanAction.REUSE
            reused[node_id] = candidate.task_id
        else:
            actions[node_id] = AigcPlanAction.EXECUTE

    return AigcExecutionPlan(order, actions, reused)


def canonical_aigc_input_hash(
    *,
    node_type: AigcNodeType,
    executor_version: str,
    model: str,
    config: Mapping[str, object],
    upstream: Iterable[AigcUpstreamDigest],
) -> str:
    normalized_upstream = [
        (
            {
                "targetHandle": item.target_handle,
                "sourceNodeId": item.source_node_id,
                "sourceHandle": item.source_handle,
                "digest": item.digest,
            }
            | ({"ordinal": item.ordinal} if item.ordinal is not None else {})
        )
        for item in sorted(
            upstream,
            key=lambda item: (
                item.target_handle,
                item.ordinal if item.ordinal is not None else -1,
                item.source_node_id,
                item.source_handle,
                item.digest,
            ),
        )
    ]
    payload = {
        "nodeType": node_type.value,
        "executorVersion": executor_version,
        "model": model,
        "config": config,
        "upstream": normalized_upstream,
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _port(node: AigcNode, handle: str, *, output: bool):
    registry = NODE_REGISTRY_BY_TYPE[node.type]
    ports = registry.outputs if output else registry.inputs
    return next((port for port in ports if port.id == handle), None)


def _default_action(
    node: AigcNode,
    *,
    execute_models: bool,
) -> AigcPlanAction:
    if node.type in INPUT_NODE_TYPES:
        return AigcPlanAction.RESOLVE
    if node.type in OUTPUT_NODE_TYPES:
        return AigcPlanAction.PROJECT
    return AigcPlanAction.EXECUTE if execute_models else AigcPlanAction.IDLE


def _adjacency(
    definition: AigcPipelineDefinition,
) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    parents = {node.id: set() for node in definition.nodes}
    children = {node.id: set() for node in definition.nodes}
    for edge in definition.edges:
        parents[edge.target_node_id].add(edge.source_node_id)
        children[edge.source_node_id].add(edge.target_node_id)
    return parents, children


def _walk(start_node_id: str, adjacency: Mapping[str, set[str]]) -> set[str]:
    visited: set[str] = set()
    pending = list(adjacency[start_node_id])
    while pending:
        node_id = pending.pop()
        if node_id in visited:
            continue
        visited.add(node_id)
        pending.extend(adjacency[node_id])
    return visited
