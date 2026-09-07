from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.schemas import (
    AIGC_NODE_REGISTRY,
    VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS,
    VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT,
    AigcNodeType,
    AigcPipelineDefinition,
    AigcPortType,
    AigcTaskType,
    VideoEnhancementConfig,
)
from backend.app.services.aigc_dag import (
    AigcDagValidationError,
    validate_aigc_dag,
)
from backend.app.services.aigc_pipeline import prepare_aigc_definition_for_save


def node(
    node_id: str,
    node_type: str,
    x: int,
    *,
    config: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": x, "y": 0},
        "size": {"width": 240, "height": 180},
        "config": config or {},
    }


def edge(
    edge_id: str,
    source: str,
    source_handle: str,
    target: str,
    target_handle: str,
) -> dict[str, str]:
    return {
        "id": edge_id,
        "sourceNodeId": source,
        "sourceHandle": source_handle,
        "targetNodeId": target,
        "targetHandle": target_handle,
    }


def test_video_enhancement_defaults_and_schema_version_one_contract() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "schemaVersion": 1,
            "nodes": [node("enhance", "video_enhancement", 0)],
        }
    )

    config = definition.nodes[0].config
    assert config.model_dump(mode="json") == {
        "tool_version": "standard",
        "scene": "aigc",
        "enhance_style": "hd",
        "resolution_mode": "preset",
        "resolution": "1080p",
        "resolution_limit": None,
        "fps": None,
        "bitrate_mode": "level",
        "bitrate_level": "medium",
        "bitrate": None,
        "bit_depth": 8,
    }
    assert definition.schema_version == 1
    assert definition.nodes[0].type == AigcNodeType.VIDEO_ENHANCEMENT
    assert AigcTaskType.VIDEO_ENHANCEMENT.value == "video_enhancement"

    registration = next(
        item
        for item in AIGC_NODE_REGISTRY
        if item.type == AigcNodeType.VIDEO_ENHANCEMENT
    )
    assert registration.executable is True
    assert [(port.id, port.type) for port in registration.inputs] == [
        ("video", AigcPortType.VIDEO_ASSET)
    ]
    assert [(port.id, port.type) for port in registration.outputs] == [
        ("video", AigcPortType.VIDEO_ASSET)
    ]
    assert registration.inputs[0].max_connections == 1


@pytest.mark.parametrize(
    "config",
    [
        {
            "resolution_mode": "short_edge",
            "resolution_limit": 128,
            "fps": 15,
            "bitrate_mode": "custom",
            "bitrate": 10,
        },
        {
            "resolution_mode": "short_edge",
            "resolution_limit": 4320,
            "fps": 120,
            "bitrate_mode": "custom",
            "bitrate": 150000,
        },
        {
            "tool_version": "professional",
            "bit_depth": 12,
        },
        {
            "tool_version": "professional",
            "bit_depth": 16,
        },
    ],
)
def test_video_enhancement_accepts_valid_boundaries_and_modes(
    config: dict[str, object],
) -> None:
    VideoEnhancementConfig.model_validate(config)


@pytest.mark.parametrize(
    ("config", "message"),
    [
        (
            {"resolution_limit": 1080},
            "preset resolution mode requires resolution only",
        ),
        (
            {"resolution_mode": "short_edge", "resolution_limit": 127},
            "greater than or equal to 128",
        ),
        ({"fps": 121}, "less than or equal to 120"),
        (
            {"bitrate_mode": "custom", "bitrate": 9},
            "greater than or equal to 10",
        ),
        (
            {"bitrate": 1000},
            "level bitrate mode requires bitrate_level only",
        ),
        (
            {"tool_version": "standard", "bit_depth": 10},
            "bit_depth above 8 requires professional",
        ),
        (
            {"tool_version": "professional", "scene": "aigc"},
            "professional tool version does not accept scene",
        ),
        (
            {
                "tool_version": "professional",
                "bit_depth": 16,
                "bitrate_mode": "level",
            },
            "16-bit output does not accept bitrate settings",
        ),
    ],
)
def test_video_enhancement_rejects_invalid_parameter_combinations(
    config: dict[str, object],
    message: str,
) -> None:
    with pytest.raises(ValidationError, match=message):
        VideoEnhancementConfig.model_validate(config)


def test_video_enhancement_expresses_16_bit_duration_constraint() -> None:
    config = VideoEnhancementConfig(
        tool_version="professional",
        bit_depth=16,
    )

    config.validate_input_duration(
        VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS
    )
    assert VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT == "mov"
    with pytest.raises(ValueError, match="must not exceed 40 seconds"):
        config.validate_input_duration(
            VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS + 0.01
        )


def test_video_enhancement_dag_accepts_single_video_input_and_output() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node(
                    "input",
                    "video_input",
                    0,
                    config={"asset_id": "video-asset"},
                ),
                node("first", "video_enhancement", 300),
                node("second", "video_enhancement", 600),
                node("output", "video_output", 900),
            ],
            "edges": [
                edge("e1", "input", "video", "first", "video"),
                edge("e2", "first", "video", "second", "video"),
                edge("e3", "second", "video", "output", "video"),
            ],
        }
    )

    assert validate_aigc_dag(
        definition,
        available_asset_ids={"video-asset"},
    ) == ("input", "first", "second", "output")


def test_video_enhancement_save_validation_rejects_illegal_connections() -> None:
    incomplete = AigcPipelineDefinition.model_validate(
        {"nodes": [node("enhance", "video_enhancement", 0)]}
    )
    saved = prepare_aigc_definition_for_save(incomplete)
    assert saved.schema_version == 2
    assert saved.nodes[0].type == AigcNodeType.VIDEO_ENHANCEMENT
    with pytest.raises(AigcDagValidationError) as missing:
        validate_aigc_dag(incomplete)
    assert missing.value.code == "required_input_missing"

    mismatch = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("image", "image_input", 0),
                node("enhance", "video_enhancement", 300),
            ],
            "edges": [edge("e1", "image", "image", "enhance", "video")],
        }
    )
    with pytest.raises(AigcDagValidationError) as mismatched:
        prepare_aigc_definition_for_save(mismatch)
    assert mismatched.value.code == "port_type_mismatch"

    duplicate = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("first", "video_input", 0),
                node("second", "video_input", 0),
                node("enhance", "video_enhancement", 300),
            ],
            "edges": [
                edge("e1", "first", "video", "enhance", "video"),
                edge("e2", "second", "video", "enhance", "video"),
            ],
        }
    )
    with pytest.raises(AigcDagValidationError) as duplicated:
        prepare_aigc_definition_for_save(duplicate)
    assert duplicated.value.code == "input_already_connected"
