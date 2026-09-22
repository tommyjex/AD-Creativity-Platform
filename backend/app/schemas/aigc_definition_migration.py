from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping

from .aigc import (
    AIGC_DEFINITION_SCHEMA_VERSION,
    AIGC_LEGACY_DEFINITION_SCHEMA_VERSION,
    AudioConfig,
    AudioInputConfig,
    ImageConfig,
    ImageInputConfig,
    ImageOutputConfig,
    JsonParserConfig,
    TextConfig,
    TextInputConfig,
    TextOutputConfig,
    VideoConfig,
    VideoInputConfig,
    VideoOutputConfig,
)

LEGACY_MODALITY_TYPES = frozenset(
    {
        "text_input",
        "text_output",
        "image_input",
        "image_output",
        "video_input",
        "video_output",
        "audio_input",
    }
)
V2_MODALITY_TYPES = frozenset({"text", "image", "video", "audio"})


class AigcDefinitionMigrationError(ValueError):
    pass


def _mapping(value: object, field: str) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise AigcDefinitionMigrationError(f"{field} must be an object")
    return dict(value)


def _normalized_config(model: type[Any], value: object) -> dict[str, Any]:
    return model.model_validate(_mapping(value, "node config")).model_dump(
        mode="json"
    )


def _migrate_v1_node(node: dict[str, Any]) -> dict[str, Any]:
    node_type = node.get("type")
    config = node.get("config", {})
    migrated = deepcopy(node)
    migrated.setdefault("custom_name", None)

    if node_type == "text_input":
        source = _normalized_config(TextInputConfig, config)
        migrated["type"] = "text"
        migrated["config"] = _normalized_config(
            TextConfig,
            {**source, "title": None},
        )
    elif node_type == "text_output":
        source = _normalized_config(TextOutputConfig, config)
        migrated["type"] = "text"
        migrated["config"] = _normalized_config(
            TextConfig,
            {"text": "", "bbox_references": [], "title": source["title"]},
        )
    elif node_type == "image_input":
        source = _normalized_config(ImageInputConfig, config)
        migrated["type"] = "image"
        migrated["config"] = _normalized_config(
            ImageConfig,
            {**source, "title": None},
        )
    elif node_type == "image_output":
        source = _normalized_config(ImageOutputConfig, config)
        migrated["type"] = "image"
        migrated["config"] = _normalized_config(
            ImageConfig,
            {
                "asset_id": None,
                "bbox": None,
                "bbox_asset_id": None,
                "upstream_bbox": None,
                "upstream_bbox_asset_id": None,
                "title": source["title"],
            },
        )
    elif node_type == "video_input":
        source = _normalized_config(VideoInputConfig, config)
        migrated["type"] = "video"
        migrated["config"] = _normalized_config(
            VideoConfig,
            {**source, "title": None},
        )
    elif node_type == "video_output":
        source = _normalized_config(VideoOutputConfig, config)
        migrated["type"] = "video"
        migrated["config"] = _normalized_config(
            VideoConfig,
            {"asset_id": None, "title": source["title"]},
        )
    elif node_type == "audio_input":
        source = _normalized_config(AudioInputConfig, config)
        migrated["type"] = "audio"
        migrated["config"] = _normalized_config(
            AudioConfig,
            {**source, "title": None},
        )
    return migrated


def _normalize_v2_node(node: dict[str, Any]) -> dict[str, Any]:
    migrated = deepcopy(node)
    migrated.setdefault("custom_name", None)
    config_models = {
        "text": TextConfig,
        "image": ImageConfig,
        "video": VideoConfig,
        "audio": AudioConfig,
        "json_parser": JsonParserConfig,
    }
    config_model = config_models.get(node.get("type"))
    if config_model is not None:
        migrated["config"] = _normalized_config(
            config_model,
            node.get("config", {}),
        )
    return migrated


def migrate_aigc_definition_v2(
    definition: Mapping[str, Any],
) -> dict[str, Any]:
    source = _mapping(definition, "definition")
    version = source.get(
        "schemaVersion",
        AIGC_LEGACY_DEFINITION_SCHEMA_VERSION,
    )
    if isinstance(version, bool) or version not in {
        AIGC_LEGACY_DEFINITION_SCHEMA_VERSION,
        AIGC_DEFINITION_SCHEMA_VERSION,
    }:
        raise AigcDefinitionMigrationError(
            f"unsupported AIGC definition schemaVersion: {version!r}"
        )

    nodes = source.get("nodes", [])
    if not isinstance(nodes, list):
        raise AigcDefinitionMigrationError("definition nodes must be an array")
    copied_nodes = [_mapping(node, "node") for node in nodes]
    node_types = {node.get("type") for node in copied_nodes}
    if version == 1 and node_types & V2_MODALITY_TYPES:
        raise AigcDefinitionMigrationError("mixed_v1_v2_modality_types")
    if version == 2 and node_types & LEGACY_MODALITY_TYPES:
        raise AigcDefinitionMigrationError("mixed_v1_v2_modality_types")

    migrated = deepcopy(source)
    migrated["schemaVersion"] = AIGC_DEFINITION_SCHEMA_VERSION
    migrated["nodes"] = [
        _migrate_v1_node(node) if version == 1 else _normalize_v2_node(node)
        for node in copied_nodes
    ]
    migrated.setdefault("edges", [])
    migrated.setdefault("viewport", {"x": 0, "y": 0, "zoom": 1})

    return migrated


def migrate_aigc_run_snapshot_v2(
    definition_snapshot: Mapping[str, Any],
) -> dict[str, Any]:
    return migrate_aigc_definition_v2(definition_snapshot)
