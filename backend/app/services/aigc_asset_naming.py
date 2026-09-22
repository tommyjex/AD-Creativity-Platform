from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel

from backend.app.schemas.aigc_definition_migration import (
    migrate_aigc_run_snapshot_v2,
)

AIGC_ASSET_NAME_SCHEME = "aigc_canvas_node_v1"
AIGC_GENERATED_ASSET_NAME_SCHEME = "aigc_generated_node_v2"
AIGC_ASSET_NAME_MAX_BYTES = 180

_MIME_NAME_PARTS = {
    "image/png": ("图片", ".png"),
    "image/jpeg": ("图片", ".jpg"),
    "image/jpg": ("图片", ".jpg"),
    "image/webp": ("图片", ".webp"),
    "video/mp4": ("视频", ".mp4"),
    "video/quicktime": ("视频", ".mov"),
    "video/mov": ("视频", ".mov"),
    "video/mpeg": ("视频", ".mpeg"),
    "video/webm": ("视频", ".webm"),
}
_NODE_BASE_NAMES = {
    "llm": "LLM",
    "text_to_image": "文生图",
    "video_generation": "生视频",
    "video_enhancement": "视频画质增强",
    "video_face_blur": "视频人脸打码",
    "video_subtitle_extraction": "视频字幕提取",
    "multi_track_edit": "多轨剪辑",
    "layer_canvas": "图层画布",
    "layer_composite": "图层合成",
    "text": "文本节点",
    "image": "图片节点",
    "video": "视频节点",
    "audio": "音频节点",
}
_IMAGE_OPERATION_BASE_NAMES = {
    "image_to_image": "图生图",
    "image_edit": "图片编辑",
    "layer_decomposition": "图层拆分",
}
_INVALID_FILENAME_CHARACTERS = re.compile(r'[\x00-\x1f\x7f/\\:*?"<>|]')
_SEPARATOR_RUN = re.compile(r"[\s-]+")


@dataclass(frozen=True)
class AigcAssetNamingContext:
    pipeline_name: str
    definition_snapshot: Mapping[str, Any]
    node_id: str
    output_ordinal: int = 0


def build_aigc_output_asset_name(
    *,
    pipeline_name: str | None,
    definition_snapshot: Mapping[str, Any] | BaseModel,
    node_id: str,
    mime_type: str,
    output_ordinal: int,
) -> str:
    """Build the stable display name for one public AIGC output."""
    if (
        isinstance(output_ordinal, bool)
        or not isinstance(output_ordinal, int)
        or output_ordinal < 0
    ):
        raise ValueError("output ordinal must be a non-negative integer")

    normalized_mime_type = mime_type.strip().lower()
    try:
        asset_type, extension = _MIME_NAME_PARTS[normalized_mime_type]
    except KeyError as exc:
        raise ValueError(
            f"unsupported AIGC output MIME type: {mime_type!r}"
        ) from exc

    snapshot = (
        definition_snapshot.model_dump(mode="json", by_alias=True)
        if isinstance(definition_snapshot, BaseModel)
        else definition_snapshot
    )
    migrated = migrate_aigc_run_snapshot_v2(snapshot)
    canvas_name = _sanitize_filename_part(
        pipeline_name,
        fallback="AIGC画布",
    )
    node_name = _sanitize_filename_part(
        _node_display_name(migrated, node_id),
        fallback="AIGC节点",
    )
    suffix = f"-{asset_type}{output_ordinal + 1}{extension}"
    return _truncate_name(canvas_name, node_name, suffix)


def aigc_output_name_metadata(
    context: AigcAssetNamingContext,
    *,
    mime_type: str,
) -> dict[str, str]:
    return {
        "name": build_aigc_output_asset_name(
            pipeline_name=context.pipeline_name,
            definition_snapshot=context.definition_snapshot,
            node_id=context.node_id,
            mime_type=mime_type,
            output_ordinal=context.output_ordinal,
        ),
        "name_scheme": AIGC_ASSET_NAME_SCHEME,
    }


def build_aigc_generated_asset_name(
    *,
    node_name: str | None,
    mime_type: str,
    output_ordinal: int,
) -> str:
    if (
        isinstance(output_ordinal, bool)
        or not isinstance(output_ordinal, int)
        or output_ordinal < 0
    ):
        raise ValueError("output ordinal must be a non-negative integer")
    try:
        _, extension = _MIME_NAME_PARTS[mime_type.strip().lower()]
    except KeyError as exc:
        raise ValueError(
            f"unsupported AIGC output MIME type: {mime_type!r}"
        ) from exc
    basename = _sanitize_filename_part(node_name, fallback="AIGC节点")
    suffix = extension if output_ordinal == 0 else f"-{output_ordinal + 1}{extension}"
    return _truncate_basename(basename, suffix)


def build_aigc_download_filename(
    *,
    basename: str | None,
    mime_type: str,
    output_ordinal: int | None = None,
) -> str:
    """Build a MIME-correct, Unicode-safe AIGC download filename."""
    try:
        _, extension = _MIME_NAME_PARTS[
            mime_type.split(";", 1)[0].strip().lower()
        ]
    except KeyError as exc:
        raise ValueError(
            f"unsupported AIGC output MIME type: {mime_type!r}"
        ) from exc
    sanitized = _sanitize_filename_part(basename, fallback="AIGC节点")
    for known_extension in {
        name_extension
        for _, name_extension in _MIME_NAME_PARTS.values()
    }:
        if sanitized.lower().endswith(known_extension):
            sanitized = sanitized[: -len(known_extension)].rstrip(" .-")
            break
    ordinal_suffix = (
        ""
        if output_ordinal in {None, 0}
        else f"-{output_ordinal + 1}"
    )
    return _truncate_basename(
        sanitized or "AIGC节点",
        f"{ordinal_suffix}{extension}",
    )


def aigc_generated_output_metadata(
    *,
    node_name: str | None,
    generated_name: str | None,
    display_node_id: str | None = None,
    naming_model: str,
    naming_status: str,
    mime_type: str,
    output_ordinal: int,
) -> dict[str, object]:
    metadata: dict[str, object] = {
        "name": build_aigc_generated_asset_name(
            node_name=node_name,
            mime_type=mime_type,
            output_ordinal=output_ordinal,
        ),
        "name_scheme": AIGC_GENERATED_ASSET_NAME_SCHEME,
        "generated_name": generated_name,
        "name_source": "ai" if generated_name is not None else "fallback",
        "naming_model": naming_model,
        "naming_status": naming_status,
        "output_ordinal": output_ordinal,
    }
    if display_node_id is not None:
        metadata["display_node_id"] = display_node_id
    return metadata


def aigc_node_display_name(
    definition: Mapping[str, Any] | BaseModel,
    node_id: str,
) -> str | None:
    snapshot = (
        definition.model_dump(mode="json", by_alias=True)
        if isinstance(definition, BaseModel)
        else definition
    )
    return _node_display_name(migrate_aigc_run_snapshot_v2(snapshot), node_id)


def aigc_generated_media_name_target_node_ids(
    definition: Mapping[str, Any] | BaseModel,
    source_node_id: str,
) -> tuple[str, ...]:
    """Return direct media output nodes, falling back to the generator node."""
    snapshot = (
        definition.model_dump(mode="json", by_alias=True)
        if isinstance(definition, BaseModel)
        else definition
    )
    migrated = migrate_aigc_run_snapshot_v2(snapshot)
    raw_nodes = migrated.get("nodes")
    raw_edges = migrated.get("edges")
    if not isinstance(raw_nodes, list) or not isinstance(raw_edges, list):
        return (source_node_id,)
    media_node_ids = {
        node.get("id")
        for node in raw_nodes
        if isinstance(node, Mapping)
        and node.get("type") in {"image", "video"}
        and isinstance(node.get("id"), str)
    }
    targets: list[str] = []
    for edge in raw_edges:
        if not isinstance(edge, Mapping):
            continue
        source_id = edge.get("sourceNodeId", edge.get("source_node_id"))
        target_id = edge.get("targetNodeId", edge.get("target_node_id"))
        if (
            source_id == source_node_id
            and isinstance(target_id, str)
            and target_id in media_node_ids
            and target_id not in targets
        ):
            targets.append(target_id)
    return tuple(targets) or (source_node_id,)


def _node_display_name(
    definition: Mapping[str, Any],
    node_id: str,
) -> str | None:
    raw_nodes = definition.get("nodes")
    if not isinstance(raw_nodes, list):
        return None

    nodes = [node for node in raw_nodes if isinstance(node, Mapping)]
    base_names = [_node_base_name(node) for node in nodes]
    counts = {
        base_name: base_names.count(base_name)
        for base_name in set(base_names)
    }
    seen: dict[str, int] = {}
    for node, base_name in zip(nodes, base_names):
        index = seen.get(base_name, 0) + 1
        seen[base_name] = index
        if node.get("id") == node_id:
            custom_name = node.get("custom_name")
            if isinstance(custom_name, str) and custom_name.strip():
                return custom_name.strip()
            return base_name if counts[base_name] == 1 else f"{base_name}{index}"
    return None


def _node_base_name(node: Mapping[str, Any]) -> str:
    config = node.get("config")
    if isinstance(config, Mapping):
        title = config.get("title")
        if isinstance(title, str) and title.strip():
            return title.strip()

    node_type = node.get("type")
    if node_type == "image_to_image":
        operation = (
            config.get("operation")
            if isinstance(config, Mapping)
            else None
        )
        return _IMAGE_OPERATION_BASE_NAMES.get(
            operation if isinstance(operation, str) else "image_to_image",
            "图生图",
        )
    if isinstance(node_type, str):
        return _NODE_BASE_NAMES.get(node_type, node_type)
    return "AIGC节点"


def _sanitize_filename_part(value: str | None, *, fallback: str) -> str:
    normalized = _INVALID_FILENAME_CHARACTERS.sub("-", value or "")
    normalized = _SEPARATOR_RUN.sub("-", normalized)
    normalized = normalized.strip(" .-")
    return normalized or fallback


def _truncate_name(canvas_name: str, node_name: str, suffix: str) -> str:
    filename = f"{canvas_name}-{node_name}{suffix}"
    if len(filename.encode("utf-8")) <= AIGC_ASSET_NAME_MAX_BYTES:
        return filename

    fixed_bytes = len(f"-{node_name}{suffix}".encode("utf-8"))
    canvas_budget = max(
        len(canvas_name[0].encode("utf-8")),
        AIGC_ASSET_NAME_MAX_BYTES - fixed_bytes,
    )
    canvas_name = _utf8_prefix(canvas_name, canvas_budget)
    filename = f"{canvas_name}-{node_name}{suffix}"
    if len(filename.encode("utf-8")) <= AIGC_ASSET_NAME_MAX_BYTES:
        return filename

    fixed_bytes = len(f"{canvas_name}--{suffix.lstrip('-')}".encode("utf-8"))
    node_budget = max(
        len(node_name[0].encode("utf-8")),
        AIGC_ASSET_NAME_MAX_BYTES - fixed_bytes,
    )
    node_name = _utf8_prefix(node_name, node_budget)
    return f"{canvas_name}-{node_name}{suffix}"


def _truncate_basename(basename: str, suffix: str) -> str:
    budget = AIGC_ASSET_NAME_MAX_BYTES - len(suffix.encode("utf-8"))
    truncated = _utf8_prefix(basename, max(1, budget)).rstrip(" .-")
    return f"{truncated or 'AIGC节点'}{suffix}"


def _utf8_prefix(value: str, max_bytes: int) -> str:
    used = 0
    characters: list[str] = []
    for character in value:
        encoded_size = len(character.encode("utf-8"))
        if used + encoded_size > max_bytes:
            break
        characters.append(character)
        used += encoded_size
    return "".join(characters)
