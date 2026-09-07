from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path

from pydantic import ValidationError
import pytest

from backend.app.schemas.aigc import (
    AIGC_V2_NODE_REGISTRY,
    AigcNodeCategory,
    AigcNodeType,
    AigcPipelineDefinitionV2,
)
from backend.app.schemas.aigc_definition_migration import (
    AigcDefinitionMigrationError,
    migrate_aigc_definition_v2,
    migrate_aigc_run_snapshot_v2,
)

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "aigc-definition-v2-migration.json"
)
GOLDEN_CASES = json.loads(FIXTURE_PATH.read_text())["cases"]


def test_v2_registry_defines_four_non_executable_modality_nodes() -> None:
    assert [item.type.value for item in AIGC_V2_NODE_REGISTRY] == [
        "text",
        "image",
        "video",
        "audio",
        "llm",
        "text_to_image",
        "image_to_image",
        "video_generation",
        "video_enhancement",
        "video_face_blur",
        "layer_canvas",
        "layer_composite",
        "multi_track_edit",
        "json_parser",
    ]
    modality_items = [
        item
        for item in AIGC_V2_NODE_REGISTRY
        if item.category == AigcNodeCategory.MODALITY
    ]

    assert [item.type for item in modality_items] == [
        AigcNodeType.TEXT,
        AigcNodeType.IMAGE,
        AigcNodeType.VIDEO,
        AigcNodeType.AUDIO,
    ]
    assert all(item.executable is False for item in modality_items)
    for item in modality_items:
        assert len(item.inputs) == len(item.outputs) == 1
        assert item.inputs[0].id == item.outputs[0].id
        assert item.inputs[0].type == item.outputs[0].type
        assert item.inputs[0].required is False
        assert item.inputs[0].multiple is False
        assert item.inputs[0].max_connections == 1


@pytest.mark.parametrize(
    "case",
    GOLDEN_CASES,
    ids=[case["name"] for case in GOLDEN_CASES],
)
def test_v1_to_v2_migration_matches_shared_golden_fixture(
    case: dict[str, object],
) -> None:
    source = deepcopy(case["input"])

    migrated = migrate_aigc_definition_v2(source)

    assert migrated == case["expected"]
    assert source == case["input"]
    assert migrate_aigc_definition_v2(migrated) == migrated
    assert (
        AigcPipelineDefinitionV2.model_validate(migrated)
        .model_dump(mode="json", by_alias=True)
        == migrated
    )


@pytest.mark.parametrize("version", [0, 3, "2", True])
def test_migration_rejects_unknown_schema_versions(version: object) -> None:
    with pytest.raises(
        AigcDefinitionMigrationError,
        match="unsupported AIGC definition schemaVersion",
    ):
        migrate_aigc_definition_v2(
            {"schemaVersion": version, "nodes": [], "edges": []}
        )


@pytest.mark.parametrize(
    ("version", "node_types"),
    [
        (1, ["text_input", "image"]),
        (2, ["text", "image_output"]),
    ],
)
def test_migration_rejects_mixed_v1_v2_modality_types(
    version: int,
    node_types: list[str],
) -> None:
    nodes = [
        {
            "id": f"node-{index}",
            "type": node_type,
            "position": {"x": index * 300, "y": 0},
            "size": {"width": 240, "height": 160},
            "config": {},
        }
        for index, node_type in enumerate(node_types)
    ]

    with pytest.raises(
        AigcDefinitionMigrationError,
        match="mixed_v1_v2_modality_types",
    ):
        migrate_aigc_definition_v2(
            {"schemaVersion": version, "nodes": nodes, "edges": []}
        )


@pytest.mark.parametrize(
    "payload",
    [
        {
            "schemaVersion": 1,
            "nodes": [
                {
                    "id": "legacy",
                    "type": "text_input",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 240, "height": 160},
                    "config": {"text": "prompt", "unexpected": True},
                }
            ],
        },
        {
            "schemaVersion": 2,
            "nodes": [
                {
                    "id": "current",
                    "type": "video",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 240, "height": 160},
                    "config": {"asset_id": None, "unexpected": True},
                }
            ],
        },
    ],
)
def test_migration_rejects_unknown_modality_config_fields(
    payload: dict[str, object],
) -> None:
    with pytest.raises(ValidationError, match="unexpected"):
        migrate_aigc_definition_v2(payload)


def test_migration_preserves_invalid_graph_evidence_for_later_validation() -> None:
    source = {
        "schemaVersion": 1,
        "nodes": [
            {
                "id": "source-a",
                "type": "text_input",
                "position": {"x": 0, "y": 0},
                "size": {"width": 240, "height": 160},
                "config": {"text": "A"},
            },
            {
                "id": "source-b",
                "type": "text_input",
                "position": {"x": 0, "y": 200},
                "size": {"width": 240, "height": 160},
                "config": {"text": "B"},
            },
            {
                "id": "result",
                "type": "text_output",
                "position": {"x": 400, "y": 0},
                "size": {"width": 240, "height": 160},
                "config": {},
            },
        ],
        "edges": [
            {
                "id": "duplicate-input-a",
                "sourceNodeId": "source-a",
                "sourceHandle": "text",
                "targetNodeId": "result",
                "targetHandle": "text",
            },
            {
                "id": "duplicate-input-b",
                "sourceNodeId": "source-b",
                "sourceHandle": "text",
                "targetNodeId": "result",
                "targetHandle": "text",
            },
            {
                "id": "cycle",
                "sourceNodeId": "result",
                "sourceHandle": "text",
                "targetNodeId": "source-a",
                "targetHandle": "text",
            },
        ],
    }

    migrated = migrate_aigc_definition_v2(source)

    assert migrated["edges"] == source["edges"]
    assert [edge["id"] for edge in migrated["edges"]] == [
        "duplicate-input-a",
        "duplicate-input-b",
        "cycle",
    ]


def test_historical_snapshot_adapter_is_read_only() -> None:
    snapshot = deepcopy(GOLDEN_CASES[0]["input"])
    original = deepcopy(snapshot)

    migrated = migrate_aigc_run_snapshot_v2(snapshot)

    assert snapshot == original
    assert migrated == GOLDEN_CASES[0]["expected"]
    assert migrated is not snapshot


def test_v2_migration_preserves_json_parser_and_normalizes_managed_text() -> None:
    source = {
        "schemaVersion": 2,
        "nodes": [
            {
                "id": "parser",
                "type": "json_parser",
                "position": {"x": 0, "y": 0},
                "size": {"width": 280, "height": 180},
                "config": {},
            },
            {
                "id": "item",
                "type": "text",
                "position": {"x": 320, "y": 0},
                "size": {"width": 240, "height": 180},
                "config": {
                    "text": "value",
                    "generated_by_parser_node_id": " parser ",
                    "generated_item_index": 0,
                    "generated_from_run_id": " run-1 ",
                },
            },
        ],
        "edges": [],
    }

    migrated = migrate_aigc_definition_v2(source)

    assert migrated["nodes"][0]["config"] == {"json_path": "$.items"}
    assert migrated["nodes"][1]["config"][
        "generated_by_parser_node_id"
    ] == "parser"
    assert migrated["nodes"][1]["config"]["generated_from_run_id"] == "run-1"
    assert migrate_aigc_run_snapshot_v2(migrated) == migrated
    assert (
        AigcPipelineDefinitionV2.model_validate(migrated)
        .model_dump(mode="json", by_alias=True)
        == migrated
    )
