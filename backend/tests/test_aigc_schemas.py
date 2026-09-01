from __future__ import annotations

from pydantic import ValidationError
import pytest

from backend.app.schemas.aigc import (
    AIGC_NODE_REGISTRY,
    AigcEditedLayer,
    AigcImageLayer,
    AigcLayer,
    AigcLayerSet,
    AigcLayerSetSummary,
    AigcLayerTransformPatch,
    AigcNodeType,
    AigcPipelineDefinition,
    AigcPipelineRunCreate,
    AigcPipelineTaskSnapshot,
    AigcPipelineTemplateCreate,
    AigcPortDefinition,
    AigcPortType,
    AigcPromptOptimizeRequest,
    AigcResultAsset,
    AigcResultKind,
    AigcTaskType,
    AigcTaskResult,
    ImageToImageConfig,
    LayerCanvasConfig,
    VideoGenerationConfig,
    aigc_node_run_key,
)
from backend.app.schemas.seedance import (
    SEEDANCE_CAPABILITIES,
    SEEDANCE_DEFAULT_MODEL,
)
from backend.app.schemas.tool_task import (
    TOOL_VIDEO_MODEL_DURATION_RANGES,
    TOOL_VIDEO_MODEL_RESOLUTIONS,
    ToolVideoGenerationRequest,
)


def text_input_node(node_id: str = "input-1") -> dict[str, object]:
    return {
        "id": node_id,
        "type": "text_input",
        "position": {"x": 20, "y": 40},
        "size": {"width": 260, "height": 180},
        "config": {"text": "画一张产品海报"},
    }


def llm_node(node_id: str = "llm-1") -> dict[str, object]:
    return {
        "id": node_id,
        "type": "llm",
        "position": {"x": 360, "y": 40},
        "size": {"width": 280, "height": 220},
        "config": {
            "model": "doubao-seed-evolving",
            "system_prompt": "优化提示词",
            "temperature": 0.7,
        },
    }


def test_node_registry_contains_all_schema_version_one_nodes() -> None:
    default_port = AigcPortDefinition(
        id="default",
        label="默认端口",
        type=AigcPortType.TEXT,
    )
    assert default_port.max_connections == 1

    assert [item.type for item in AIGC_NODE_REGISTRY] == [
        AigcNodeType.TEXT_INPUT,
        AigcNodeType.IMAGE_INPUT,
        AigcNodeType.VIDEO_INPUT,
        AigcNodeType.AUDIO_INPUT,
        AigcNodeType.LLM,
        AigcNodeType.TEXT_TO_IMAGE,
        AigcNodeType.IMAGE_TO_IMAGE,
        AigcNodeType.VIDEO_GENERATION,
        AigcNodeType.LAYER_CANVAS,
        AigcNodeType.LAYER_COMPOSITE,
        AigcNodeType.TEXT_OUTPUT,
        AigcNodeType.IMAGE_OUTPUT,
        AigcNodeType.VIDEO_OUTPUT,
    ]
    image_to_image = next(
        item
        for item in AIGC_NODE_REGISTRY
        if item.type == AigcNodeType.IMAGE_TO_IMAGE
    )
    assert image_to_image.executable is True
    assert [port.id for port in image_to_image.inputs] == [
        "image",
        "edit_image",
        "edit_layer",
        "prompt",
    ]
    image_to_image_input = image_to_image.inputs[0]
    assert image_to_image_input.multiple is True
    assert image_to_image_input.max_connections == 10
    assert {
        port.id: port.type for port in image_to_image.outputs
    } == {
        "image": AigcPortType.IMAGE_ASSET,
        "edited_layer": AigcPortType.EDITED_LAYER,
        "layers": AigcPortType.LAYER_SET,
    }

    layer_canvas = next(
        item
        for item in AIGC_NODE_REGISTRY
        if item.type == AigcNodeType.LAYER_CANVAS
    )
    assert [port.type for port in layer_canvas.outputs] == [
        AigcPortType.IMAGE_LAYER,
        AigcPortType.LAYER_SET,
    ]
    layer_composite = next(
        item
        for item in AIGC_NODE_REGISTRY
        if item.type == AigcNodeType.LAYER_COMPOSITE
    )
    assert [port.type for port in layer_composite.inputs] == [
        AigcPortType.LAYER_SET,
        AigcPortType.EDITED_LAYER,
    ]

    video_generation = next(
        item
        for item in AIGC_NODE_REGISTRY
        if item.type == AigcNodeType.VIDEO_GENERATION
    )
    assert video_generation.models == list(SEEDANCE_CAPABILITIES)
    assert {
        port.id: (port.type, port.max_connections, [mode.value for mode in port.modes])
        for port in video_generation.inputs
    } == {
        "prompt": (
            AigcPortType.TEXT,
            1,
            [
                "text_to_video",
                "first_frame",
                "first_last_frame",
                "multimodal_reference",
            ],
        ),
        "first_frame": (
            AigcPortType.IMAGE_ASSET,
            1,
            ["first_frame", "first_last_frame"],
        ),
        "last_frame": (
            AigcPortType.IMAGE_ASSET,
            1,
            ["first_last_frame"],
        ),
        "reference_images": (
            AigcPortType.IMAGE_ASSET,
            30,
            ["multimodal_reference"],
        ),
        "reference_videos": (
            AigcPortType.VIDEO_ASSET,
            10,
            ["multimodal_reference"],
        ),
        "reference_audios": (
            AigcPortType.AUDIO_ASSET,
            10,
            ["multimodal_reference"],
        ),
    }


def test_seedance_capabilities_are_shared_with_tool_contract() -> None:
    assert SEEDANCE_CAPABILITIES[SEEDANCE_DEFAULT_MODEL].display_name == "Seedance 2.5"
    assert TOOL_VIDEO_MODEL_DURATION_RANGES[SEEDANCE_DEFAULT_MODEL] == (4, 30)
    assert TOOL_VIDEO_MODEL_RESOLUTIONS[SEEDANCE_DEFAULT_MODEL] == (
        "480p",
        "720p",
        "1080p",
    )

    request = ToolVideoGenerationRequest(
        model=SEEDANCE_DEFAULT_MODEL,
        prompt="生成视频",
        duration_seconds=-1,
        resolution="720p",
        aspect_ratio="adaptive",
        reference_image_asset_ids=[f"image-{index}" for index in range(30)],
    )
    assert len(request.reference_image_asset_ids) == 30

    with pytest.raises(ValidationError, match="at most 9 reference images"):
        ToolVideoGenerationRequest(
            model="doubao-seedance-2-0-260128",
            prompt="生成视频",
            duration_seconds=4,
            resolution="720p",
            aspect_ratio="16:9",
            reference_image_asset_ids=[
                f"image-{index}" for index in range(10)
            ],
        )


def test_video_generation_config_defaults_and_validates_model_parameters() -> None:
    config = VideoGenerationConfig()
    assert config.model == SEEDANCE_DEFAULT_MODEL
    assert config.generation_mode.value == "text_to_video"
    assert config.resolution == "720p"
    assert config.aspect_ratio == "adaptive"
    assert config.duration_seconds == -1
    assert config.generate_audio is True

    with pytest.raises(ValidationError, match="resolution must be one of"):
        VideoGenerationConfig(
            model="doubao-seedance-2-0-fast-260128",
            resolution="1080p",
        )
    with pytest.raises(ValidationError, match="duration_seconds"):
        VideoGenerationConfig(
            model="doubao-seedance-2-0-mini-260615",
            duration_seconds=16,
        )


def test_pipeline_definition_accepts_video_contract_nodes_at_schema_version_one(
) -> None:
    node_types = (
        "video_input",
        "audio_input",
        "video_generation",
        "video_output",
    )
    definition = AigcPipelineDefinition.model_validate(
        {
            "schemaVersion": 1,
            "nodes": [
                {
                    "id": node_type,
                    "type": node_type,
                    "position": {"x": index * 280, "y": 0},
                    "size": {"width": 240, "height": 180},
                    "config": {},
                }
                for index, node_type in enumerate(node_types)
            ],
        }
    )

    assert definition.schema_version == 1
    assert [node.type.value for node in definition.nodes] == list(node_types)
    assert AigcTaskType.VIDEO_GENERATION.value == "video_generation"


def test_pipeline_definition_validates_discriminated_node_configs() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "schemaVersion": 1,
            "nodes": [text_input_node(), llm_node()],
            "edges": [
                {
                    "id": "edge-1",
                    "sourceNodeId": "input-1",
                    "sourceHandle": "text",
                    "targetNodeId": "llm-1",
                    "targetHandle": "prompt",
                }
            ],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        }
    )

    dumped = definition.model_dump(mode="json", by_alias=True)

    assert definition.nodes[1].type == AigcNodeType.LLM
    assert dumped["schemaVersion"] == 1
    assert dumped["edges"][0]["sourceNodeId"] == "input-1"


def test_legacy_image_to_image_definition_defaults_and_serializes_operation() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                {
                    "id": "seedream",
                    "type": "image_to_image",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {
                        "model": "doubao-seedream-5-0-pro-260628",
                        "aspect_ratio": "1:1",
                        "size": "2K",
                        "format": "png",
                    },
                }
            ]
        }
    )

    node = definition.nodes[0]
    assert isinstance(node.config, ImageToImageConfig)
    assert node.config.operation == "image_to_image"
    assert (
        definition.model_dump(mode="json", by_alias=True)["nodes"][0]["config"][
            "operation"
        ]
        == "image_to_image"
    )


def test_layer_nodes_have_serializable_default_configs() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                {
                    "id": node_type,
                    "type": node_type,
                    "position": {"x": index * 280, "y": 0},
                    "size": {"width": 240, "height": 180},
                    "config": {},
                }
                for index, node_type in enumerate(
                    ("layer_canvas", "layer_composite")
                )
            ]
        }
    )

    dumped = definition.model_dump(mode="json", by_alias=True)
    assert dumped["nodes"][0]["config"] == {
        "selected_layer_id": None,
        "source_layer_set": None,
        "transform_patches": [],
    }
    assert dumped["nodes"][1]["config"] == {}


def test_layer_snapshot_context_and_patch_contracts_are_immutable() -> None:
    digest = "a" * 64
    layer = AigcLayer(
        id="layer-1",
        asset_id="asset-layer-1",
        z_index=1,
        name="主体",
        bbox_absolute=(100, 50, 500, 450),
        bbox_normalized=(100, 100, 500, 900),
        x=100,
        y=50,
    )
    root = AigcLayerSet(
        id="set-1",
        source_asset_id="asset-source",
        base_asset_id="asset-base",
        canvas_width=1000,
        canvas_height=500,
        version=0,
        digest=digest,
        layers=(layer,),
    )
    summary = AigcLayerSetSummary(
        id=root.id,
        version=root.version,
        digest=root.digest,
    )
    patch = AigcLayerTransformPatch(layer_id=layer.id, x=120, visible=False)
    config = LayerCanvasConfig(
        selected_layer_id=layer.id,
        source_layer_set=summary,
        transform_patches=(patch,),
    )
    context = AigcImageLayer(
        asset_id=layer.asset_id,
        layer_set_id=root.id,
        layer_set_version=root.version,
        layer_set_digest=root.digest,
        layer_id=layer.id,
        bbox_absolute=layer.bbox_absolute,
        bbox_normalized=layer.bbox_normalized,
        x=layer.x,
        y=layer.y,
        scale=layer.scale,
        z_index=layer.z_index,
    )
    edited = AigcEditedLayer.model_validate(
        {**context.model_dump(), "asset_id": "asset-edited-layer-1"}
    )

    assert root.parent_layer_set_id is None
    assert root.layers == (layer,)
    assert config.model_dump(mode="json")["transform_patches"] == [
        {
            "layer_id": "layer-1",
            "x": 120.0,
            "y": None,
            "scale": None,
            "z_index": None,
            "visible": False,
            "deleted": None,
        }
    ]
    assert edited.layer_set_digest == root.digest
    with pytest.raises(ValidationError, match="frozen"):
        root.version = 1


@pytest.mark.parametrize(
    "payload,error",
    [
        (
            {"version": 0, "parent_layer_set_id": "set-parent"},
            "root layer sets require",
        ),
        (
            {"version": 1, "parent_layer_set_id": None},
            "root layer sets require",
        ),
        (
            {"version": 0, "parent_layer_set_id": None, "digest": "not-a-digest"},
            "at least 64 characters",
        ),
    ],
)
def test_layer_snapshot_rejects_invalid_identity(
    payload: dict[str, object],
    error: str,
) -> None:
    with pytest.raises(ValidationError, match=error):
        AigcLayerSet(
            id="set-1",
            source_asset_id="asset-source",
            base_asset_id="asset-base",
            canvas_width=1000,
            canvas_height=500,
            version=payload["version"],
            parent_layer_set_id=payload["parent_layer_set_id"],
            digest=payload.get("digest", "a" * 64),
        )


def test_layer_canvas_draft_requires_source_and_unique_patches() -> None:
    with pytest.raises(ValidationError, match="requires a source layer set"):
        LayerCanvasConfig(selected_layer_id="layer-1")
    with pytest.raises(ValidationError, match="unique layer ids"):
        LayerCanvasConfig(
            source_layer_set=AigcLayerSetSummary(
                id="set-1",
                version=0,
                digest="a" * 64,
            ),
            transform_patches=(
                AigcLayerTransformPatch(layer_id="layer-1", x=1),
                AigcLayerTransformPatch(layer_id="layer-1", y=1),
            ),
        )


def test_input_configs_support_bound_bbox_references_and_legacy_defaults() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                text_input_node(),
                {
                    "id": "image-1",
                    "type": "image_input",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 240, "height": 180},
                    "config": {
                        "asset_id": "asset-1",
                        "bbox_asset_id": "asset-1",
                        "bbox": {
                            "type": "bbox",
                            "x1": 100,
                            "y1": 200,
                            "x2": 700,
                            "y2": 800,
                        },
                    },
                },
                {
                    **text_input_node("prompt-with-reference"),
                    "config": {
                        "text": "将",
                        "bbox_references": [
                            {
                                "source_node_id": "image-1",
                                "instruction": "替换为红色包装",
                            }
                        ],
                    },
                },
            ]
        }
    )

    legacy_text = definition.nodes[0]
    image = definition.nodes[1]
    assert legacy_text.config.bbox_references == []
    assert image.config.bbox_asset_id == "asset-1"
    assert image.config.bbox.x1 == 100


def test_video_generation_task_type_defaults_and_validates() -> None:
    legacy = AigcPipelineDefinition.model_validate(
        {
            "nodes": [
                {
                    "id": "video-model",
                    "type": "video_generation",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {
                        "model": "doubao-seedance-2-5-260628",
                        "generation_mode": "multimodal_reference",
                        "resolution": "720p",
                        "aspect_ratio": "adaptive",
                        "duration_seconds": -1,
                        "generate_audio": True,
                    },
                }
            ]
        }
    )

    assert legacy.nodes[0].config.task_type == "generate"
    payload = legacy.model_dump(mode="json", by_alias=True)
    payload["nodes"][0]["config"]["task_type"] = "edit"
    edited = AigcPipelineDefinition.model_validate(payload)
    assert edited.nodes[0].config.task_type == "edit"

    payload["nodes"][0]["config"]["task_type"] = "unknown"
    with pytest.raises(ValidationError):
        AigcPipelineDefinition.model_validate(payload)


@pytest.mark.parametrize(
    "config,error",
    [
        (
            {
                "asset_id": "asset-2",
                "bbox_asset_id": "asset-1",
                "bbox": {
                    "type": "bbox",
                    "x1": 100,
                    "y1": 200,
                    "x2": 700,
                    "y2": 800,
                },
            },
            "bbox_asset_mismatch",
        ),
        (
            {
                "text": "edit <BBOX>1 2 3 4</bbox>",
                "bbox_references": [],
            },
            "coordinate_tag_forbidden",
        ),
        (
            {
                "text": "edit",
                "bbox_references": [
                    {"source_node_id": "image-1", "instruction": ""},
                    {"source_node_id": "image-1", "instruction": ""},
                ],
            },
            "must be unique",
        ),
    ],
)
def test_input_configs_reject_invalid_bbox_state(
    config: dict[str, object],
    error: str,
) -> None:
    node_type = "image_input" if "asset_id" in config else "text_input"
    with pytest.raises(ValidationError, match=error):
        AigcPipelineDefinition.model_validate(
            {
                "nodes": [
                    {
                        "id": "input",
                        "type": node_type,
                        "position": {"x": 0, "y": 0},
                        "size": {"width": 240, "height": 180},
                        "config": config,
                    }
                ]
            }
        )


def test_prompt_optimization_request_validates_structured_content() -> None:
    request = AigcPromptOptimizeRequest(
        text="  红色包装产品主图  ",
        reference_instructions=["保留商标位置"],
        generation_modes=["text_to_image", "image_to_image"],
        reference_image_count=2,
    )

    assert request.text == "  红色包装产品主图  "
    assert request.reference_instructions == ["保留商标位置"]

    with pytest.raises(ValidationError, match="must not be blank"):
        AigcPromptOptimizeRequest(text=" ", reference_instructions=[""])
    with pytest.raises(ValidationError, match="must be unique"):
        AigcPromptOptimizeRequest(
            text="产品图",
            generation_modes=["text_to_image", "text_to_image"],
        )
    with pytest.raises(ValidationError, match="coordinate_tag_forbidden"):
        AigcPromptOptimizeRequest(text="<bbox>1 2 3 4</bbox>")


def test_pipeline_definition_rejects_duplicate_nodes_and_missing_endpoints() -> None:
    with pytest.raises(ValidationError, match="node ids must be unique"):
        AigcPipelineDefinition.model_validate(
            {"nodes": [text_input_node(), text_input_node()]}
        )

    with pytest.raises(ValidationError, match="target node does not exist"):
        AigcPipelineDefinition.model_validate(
            {
                "nodes": [text_input_node()],
                "edges": [
                    {
                        "id": "edge-1",
                        "sourceNodeId": "input-1",
                        "sourceHandle": "text",
                        "targetNodeId": "missing",
                        "targetHandle": "prompt",
                    }
                ],
            }
        )


def test_pipeline_definition_rejects_config_for_a_different_node_type() -> None:
    payload = llm_node()
    payload["config"] = {"asset_id": "asset-1"}

    with pytest.raises(ValidationError):
        AigcPipelineDefinition.model_validate({"nodes": [payload]})


def test_template_names_are_trimmed_and_blank_names_are_rejected() -> None:
    template = AigcPipelineTemplateCreate(
        name="  商品海报  ",
        description="  首期模板  ",
    )

    assert template.name == "商品海报"
    assert template.description == "首期模板"

    with pytest.raises(ValidationError):
        AigcPipelineTemplateCreate(name="   ")


def test_from_node_run_requires_start_node_and_full_run_rejects_it() -> None:
    with pytest.raises(ValidationError, match="require start_node_id"):
        AigcPipelineRunCreate(expected_revision=2, mode="from_node")

    with pytest.raises(ValidationError, match="must not include start_node_id"):
        AigcPipelineRunCreate(
            expected_revision=2,
            mode="full",
            start_node_id="llm-1",
        )


def test_task_snapshot_deep_copies_params_and_upstream() -> None:
    payload: dict[str, object] = {
        "params": {"nested": {"prompt": "first"}},
        "upstream": ["input-1"],
    }
    snapshot = AigcPipelineTaskSnapshot.model_validate(payload)

    nested = payload["params"]
    assert isinstance(nested, dict)
    nested["nested"] = {"prompt": "changed"}
    upstream = payload["upstream"]
    assert isinstance(upstream, list)
    upstream.append("input-2")

    assert snapshot.params == {"nested": {"prompt": "first"}}
    assert snapshot.upstream == ["input-1"]


def test_task_result_enforces_text_and_asset_shapes() -> None:
    with pytest.raises(ValidationError, match="text results require text"):
        AigcTaskResult(kind=AigcResultKind.TEXT)

    with pytest.raises(ValidationError, match="require an available asset"):
        AigcTaskResult(
            kind=AigcResultKind.ASSETS,
            assets=[
                AigcResultAsset(
                    asset_id="asset-1",
                    ordinal=0,
                    available=False,
                )
            ],
        )

    unavailable = AigcTaskResult(
        kind=AigcResultKind.UNAVAILABLE,
        assets=[
            AigcResultAsset(
                asset_id="asset-1",
                ordinal=0,
                available=False,
            )
        ],
    )
    assert unavailable.assets[0].available is False


def test_node_run_key_uses_unambiguous_separator() -> None:
    assert aigc_node_run_key("run-1", "node-2") == "run-1:node-2"
