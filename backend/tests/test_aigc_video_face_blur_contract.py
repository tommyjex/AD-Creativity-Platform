from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.schemas import (
    AIGC_NODE_REGISTRY,
    AigcNodeType,
    AigcPipelineDefinition,
    AigcPortType,
    AigcTaskType,
    VideoFaceBlurConfig,
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
        "size": {"width": 240, "height": 160},
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


def test_video_face_blur_defaults_and_schema_version_one_contract() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "schemaVersion": 1,
            "nodes": [node("face-blur", "video_face_blur", 0)],
        }
    )

    assert definition.schema_version == 1
    assert definition.nodes[0].type == AigcNodeType.VIDEO_FACE_BLUR
    assert definition.nodes[0].config.model_dump(mode="json") == {
        "mask_mode": "mosaic",
        "mask_strength": "medium",
    }
    assert AigcTaskType.VIDEO_FACE_BLUR.value == "video_face_blur"

    registration = next(
        item
        for item in AIGC_NODE_REGISTRY
        if item.type == AigcNodeType.VIDEO_FACE_BLUR
    )
    assert registration.executable is True
    assert [
        (port.id, port.type, port.required, port.max_connections)
        for port in registration.inputs
    ] == [("video", AigcPortType.VIDEO_ASSET, True, 1)]
    assert [(port.id, port.type) for port in registration.outputs] == [
        ("video", AigcPortType.VIDEO_ASSET)
    ]


@pytest.mark.parametrize("mask_mode", ["mosaic", "blur"])
@pytest.mark.parametrize("mask_strength", ["low", "medium", "high"])
def test_video_face_blur_accepts_supported_enums(
    mask_mode: str,
    mask_strength: str,
) -> None:
    config = VideoFaceBlurConfig.model_validate(
        {"mask_mode": mask_mode, "mask_strength": mask_strength}
    )
    assert config.mask_mode == mask_mode
    assert config.mask_strength == mask_strength


@pytest.mark.parametrize(
    "config",
    [
        {"mask_mode": "pixelate"},
        {"mask_strength": "extreme"},
        {"face_confidence": 0.5},
    ],
)
def test_video_face_blur_rejects_invalid_or_unsupported_config(
    config: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        VideoFaceBlurConfig.model_validate(config)


def test_video_face_blur_dag_accepts_video_chaining() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "schemaVersion": 1,
            "nodes": [
                node(
                    "input",
                    "video_input",
                    0,
                    config={"asset_id": "video-asset"},
                ),
                node("first", "video_face_blur", 300),
                node("second", "video_face_blur", 600),
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


def test_video_face_blur_save_and_run_validation_cover_input_contract() -> None:
    incomplete = AigcPipelineDefinition.model_validate(
        {"nodes": [node("face-blur", "video_face_blur", 0)]}
    )
    saved = prepare_aigc_definition_for_save(incomplete)
    assert saved.schema_version == 2
    with pytest.raises(AigcDagValidationError) as missing:
        validate_aigc_dag(incomplete)
    assert missing.value.code == "required_input_missing"

    mismatch = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                node("image", "image_input", 0),
                node("face-blur", "video_face_blur", 300),
            ],
            "edges": [edge("e1", "image", "image", "face-blur", "video")],
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
                node("face-blur", "video_face_blur", 300),
            ],
            "edges": [
                edge("e1", "first", "video", "face-blur", "video"),
                edge("e2", "second", "video", "face-blur", "video"),
            ],
        }
    )
    with pytest.raises(AigcDagValidationError) as duplicated:
        prepare_aigc_definition_for_save(duplicate)
    assert duplicated.value.code == "input_already_connected"


def test_existing_schema_version_one_canvas_remains_compatible() -> None:
    legacy = AigcPipelineDefinition.model_validate(
        {
            "schemaVersion": 1,
            "nodes": [
                node("prompt", "text_input", 0, config={"text": "旧画布"}),
                node("model", "llm", 300),
            ],
            "edges": [edge("e1", "prompt", "text", "model", "prompt")],
        }
    )

    saved = prepare_aigc_definition_for_save(legacy)
    assert saved.schema_version == 2
    assert [item.type for item in saved.nodes] == [
        AigcNodeType.TEXT,
        AigcNodeType.LLM,
    ]
