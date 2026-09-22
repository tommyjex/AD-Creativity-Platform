from __future__ import annotations

from pydantic import ValidationError
import pytest

from backend.app.schemas.aigc import (
    AIGC_NODE_REGISTRY,
    AIGC_V2_NODE_REGISTRY,
    AigcEditedLayer,
    AigcGeneratedMediaName,
    AigcGeneratedMediaNamingRequest,
    AigcGeneratedMediaNamingResult,
    AigcImageLayer,
    AigcImagePromptFullDesignResult,
    AigcImagePromptLocalEditResult,
    AigcImagePromptSections,
    AigcJsonParserItem,
    AigcLayer,
    AigcLayerSet,
    AigcLayerSetSummary,
    AigcLayerTransformPatch,
    AigcNodeType,
    AigcPipelineDefinition,
    AigcPipelineDefinitionV2,
    AigcPipelineRunCreate,
    AigcPipelineTaskSnapshot,
    AigcPipelineTemplateCreate,
    AigcPortDefinition,
    AigcPortType,
    AigcPromptOptimizeRequest,
    AigcPromptOptimizeResponse,
    AigcSeedreamPromptOptimizationResult,
    AigcResultAsset,
    AigcResultKind,
    AigcTaskType,
    AigcTaskResult,
    ImageConfig,
    ImageModelConfig,
    ImageToImageConfig,
    JsonParserConfig,
    LayerCanvasConfig,
    MultiTrackEditConfig,
    MultiTrackTextStyle,
    TextConfig,
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


def multitrack_text_element(
    *,
    element_type: str,
    font_type: str | None | object = None,
    include_font_type: bool = True,
) -> dict[str, object]:
    style: dict[str, object] = {
        "font_size": 48,
        "color": "#FFFFFFFF",
        "bold": False,
        "italic": False,
        "underline": False,
        "background_color": "#00000000",
    }
    if include_font_type:
        style["font_type"] = font_type
    element: dict[str, object] = {
        "id": f"{element_type}-1",
        "type": element_type,
        "target_time": {"start_ms": 0, "end_ms": 2000},
        "loop": False,
        "transform": {
            "x": 0,
            "y": 0,
            "width": 800,
            "height": 200,
            "rotation": 0,
        },
        "style": style,
    }
    if element_type == "text":
        element.update({"source": None, "inline_text": "标题"})
    else:
        element["asset_id"] = "subtitle-asset"
    return element


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
        AigcNodeType.VIDEO_ENHANCEMENT,
        AigcNodeType.VIDEO_FACE_BLUR,
        AigcNodeType.VIDEO_SUBTITLE_EXTRACTION,
        AigcNodeType.LAYER_CANVAS,
        AigcNodeType.LAYER_COMPOSITE,
        AigcNodeType.TEXT_OUTPUT,
        AigcNodeType.IMAGE_OUTPUT,
        AigcNodeType.VIDEO_OUTPUT,
    ]
    llm = next(item for item in AIGC_NODE_REGISTRY if item.type == AigcNodeType.LLM)
    assert [(port.id, port.type, port.required, port.multiple) for port in llm.inputs] == [
        ("prompt", AigcPortType.TEXT, True, False),
        ("image", AigcPortType.IMAGE_ASSET, False, False),
    ]


def test_generated_media_naming_contract_normalizes_unicode_name() -> None:
    response = AigcGeneratedMediaName(name="  雨夜霓虹跑车  ")
    result = AigcGeneratedMediaNamingResult(
        status="succeeded",
        name=response.name,
    )

    assert response.name == "雨夜霓虹跑车"
    assert len(response.name) == 6
    assert result.model == "doubao-seed-2-0-mini-260428"


@pytest.mark.parametrize(
    "name",
    [
        "",
        "   ",
        "一二三四五六七八九十甲",
        "第一行\n第二行",
        "控制\x00字符",
        "第一行\u2028第二行",
        "第一段\u2029第二段",
        "目录/名称",
        "目录\\名称",
        "雨夜跑车.png",
        "雨夜跑车.图片",
        '"雨夜跑车"',
        "“雨夜跑车”",
        "1.雨夜跑车",
        "#雨夜跑车",
        "名称：雨夜跑车",
    ],
)
def test_generated_media_naming_contract_rejects_invalid_names(name: str) -> None:
    with pytest.raises(ValidationError):
        AigcGeneratedMediaName(name=name)


def test_generated_media_naming_request_accepts_only_visual_inputs() -> None:
    request = AigcGeneratedMediaNamingRequest(
        prompt="城市汽车广告",
        visual_inputs=[
            {"type": "image", "url": "https://assets.example/image.png"},
            {
                "type": "video",
                "url": "https://assets.example/video.mp4",
                "fps": 0.3,
            },
        ],
    )

    assert [item.type for item in request.visual_inputs] == ["image", "video"]
    with pytest.raises(ValidationError):
        AigcGeneratedMediaNamingRequest(
            prompt="城市汽车广告",
            visual_inputs=[
                {
                    "type": "audio",
                    "url": "https://assets.example/audio.mp3",
                }
            ],
        )
    with pytest.raises(ValidationError, match="fps=0.3"):
        AigcGeneratedMediaNamingRequest(
            prompt="城市汽车广告",
            visual_inputs=[
                {
                    "type": "video",
                    "url": "https://assets.example/video.mp4",
                    "fps": 1,
                }
            ],
        )


def test_multitrack_font_contract_accepts_presets_urls_and_legacy_styles() -> None:
    custom_font_url = (
        "https://xujianhua-utils.tos-cn-beijing.volces.com/"
        "ECOVACS/centurygothic.ttf"
    )
    project = MultiTrackEditConfig.model_validate(
        {
            "tracks": [
                {
                    "id": "text-track",
                    "name": "文字",
                    "type": "text",
                    "elements": [
                        multitrack_text_element(
                            element_type="text",
                            font_type="SY_Black",
                        )
                    ],
                },
                {
                    "id": "subtitle-track",
                    "name": "字幕",
                    "type": "subtitle",
                    "elements": [
                        multitrack_text_element(
                            element_type="subtitle",
                            font_type=f"{custom_font_url}?version=1#regular",
                        )
                    ],
                },
                {
                    "id": "legacy-text-track",
                    "name": "旧文字",
                    "type": "text",
                    "elements": [
                        multitrack_text_element(
                            element_type="text",
                            include_font_type=False,
                        )
                    ],
                },
            ]
        }
    )

    text = project.tracks[0].elements[0]
    subtitle = project.tracks[1].elements[0]
    legacy = project.tracks[2].elements[0]
    assert text.style.font_type == "SY_Black"  # type: ignore[union-attr]
    assert subtitle.style.font_type == f"{custom_font_url}?version=1#regular"  # type: ignore[union-attr]
    assert legacy.style.font_type is None  # type: ignore[union-attr]
    numeric_label_domain = MultiTrackTextStyle(
        font_type="https://123.example.com/font.ttf"
    )
    assert numeric_label_domain.font_type == "https://123.example.com/font.ttf"


@pytest.mark.parametrize(
    "font_type",
    [
        "http://fonts.example.com/font.ttf",
        "/fonts/font.ttf",
        "https:fonts.example.com/font.ttf",
        "https:////fonts.example.com/font.ttf",
        " https://fonts.example.com/font.ttf",
        "https://fonts.example.com/font.ttf ",
        "https://user:secret@fonts.example.com/font.ttf",
        "https://fonts.example.com/font.woff2",
        "https://localhost/font.ttf",
        "https://fonts.localhost/font.ttf",
        "https://127.0.0.1/font.ttf",
        "https://10.0.0.1/font.ttf",
        "https://8.8.8.8/font.ttf",
        "https://2130706433/font.ttf",
        "https://0x7f000001/font.ttf",
        "https://127.1/font.ttf",
        "https://0177.0x0.0.01/font.ttf",
        "https://[::1]/font.ttf",
        "https://[2001:db8::1]/font.ttf",
        "https://fonts.local/font.ttf",
        "https://fonts.internal/font.ttf",
        "https://fonts.lan/font.ttf",
        "https://fonts.home/font.ttf",
        "https://fonts.example.com\\font.ttf",
        "https://fonts.example.com/font\x01.ttf",
        "unknown-font",
        f"https://fonts.example.com/{'a' * 2030}.ttf",
    ],
)
def test_multitrack_font_contract_rejects_invalid_values(font_type: str) -> None:
    with pytest.raises(ValidationError, match="invalid_font_type"):
        MultiTrackTextStyle(font_type=font_type)
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
    assert [
        (port.id, port.type, port.required)
        for port in layer_composite.inputs
    ] == [
        ("layers", AigcPortType.LAYER_SET, True),
        ("replacement", AigcPortType.EDITED_LAYER, False),
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


def test_json_parser_contract_and_registry_are_consistent() -> None:
    config = JsonParserConfig()
    assert config.json_path == "$.items"

    parser = next(
        item
        for item in AIGC_V2_NODE_REGISTRY
        if item.type == AigcNodeType.JSON_PARSER
    )
    assert parser.label == "JSON 解析器"
    assert parser.category.value == "control"
    assert parser.executable is True
    assert [
        (port.id, port.type, port.required, port.multiple, port.max_connections)
        for port in parser.inputs
    ] == [("text", AigcPortType.TEXT, True, False, 1)]
    assert [
        (
            port.id,
            port.type,
            port.required,
            port.multiple,
            port.max_connections,
            port.system_only,
        )
        for port in parser.outputs
    ] == [("items", AigcPortType.TEXT, False, True, 20, True)]

    definition = AigcPipelineDefinitionV2.model_validate(
        {
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
                    "position": {"x": 340, "y": 0},
                    "size": {"width": 240, "height": 180},
                    "config": {
                        "text": "first",
                        "generated_by_parser_node_id": "parser",
                        "generated_item_index": 0,
                        "generated_from_run_id": "run-1",
                    },
                },
            ],
        }
    )
    parser_node = definition.nodes[0]
    text_node = definition.nodes[1]
    assert parser_node.config.json_path == "$.items"  # type: ignore[union-attr]
    assert text_node.config.generated_item_index == 0  # type: ignore[union-attr]


def test_json_parser_contract_rejects_invalid_managed_text_fields_and_keys() -> None:
    with pytest.raises(ValidationError, match="json_parser_invalid_path"):
        JsonParserConfig(json_path="$[")

    with pytest.raises(ValidationError, match="managed text run id"):
        TextConfig.model_validate(
            {
                "generated_from_run_id": "run-1",
            }
        )

    base_text = {
        "id": "item-1",
        "type": "text",
        "position": {"x": 0, "y": 0},
        "size": {"width": 240, "height": 180},
        "config": {
            "text": "first",
            "generated_by_parser_node_id": "parser",
            "generated_item_index": 0,
            "generated_from_run_id": "run-1",
        },
    }
    duplicate = {
        **base_text,
        "id": "item-2",
        "position": {"x": 300, "y": 0},
    }
    with pytest.raises(ValidationError, match="managed text keys must be unique"):
        AigcPipelineDefinitionV2.model_validate(
            {
                "schemaVersion": 2,
                "nodes": [base_text, duplicate],
            }
        )


def test_json_parser_structured_result_requires_ordered_items() -> None:
    result = AigcTaskResult(
        kind="text_items",
        items=[
            AigcJsonParserItem(index=0, text="first", summary="a" * 64),
            AigcJsonParserItem(index=1, text='{"a":1}', summary="b" * 64),
        ],
    )
    assert [item.index for item in result.items] == [0, 1]

    assert AigcTaskResult(kind="text_items").items == []
    with pytest.raises(ValidationError, match="contiguous"):
        AigcTaskResult(
            kind="text_items",
            items=[
                AigcJsonParserItem(index=1, text="second", summary="a" * 64)
            ],
        )


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


def test_pipeline_nodes_normalize_and_validate_custom_names() -> None:
    definition = AigcPipelineDefinitionV2.model_validate(
        {
            "schemaVersion": 2,
            "nodes": [
                {
                    "id": "named",
                    "type": "llm",
                    "custom_name": "  商品主视觉生成  ",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 240, "height": 160},
                    "config": {},
                },
                {
                    "id": "blank",
                    "type": "llm",
                    "custom_name": "   ",
                    "position": {"x": 300, "y": 0},
                    "size": {"width": 240, "height": 160},
                    "config": {},
                },
            ],
        }
    )

    assert definition.nodes[0].custom_name == "商品主视觉生成"
    assert definition.nodes[1].custom_name is None
    assert definition.model_dump(mode="json", by_alias=True)["nodes"][0][
        "custom_name"
    ] == "商品主视觉生成"

    for invalid_name in ("line\nbreak", "control\x00name", "x" * 121):
        payload = definition.model_dump(mode="json", by_alias=True)
        payload["nodes"][0]["custom_name"] = invalid_name
        with pytest.raises(ValidationError):
            AigcPipelineDefinitionV2.model_validate(payload)


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


def test_schema_version_one_image_configs_normalize_and_serialize_custom_sizes() -> None:
    definition = AigcPipelineDefinition.model_validate(
        {
            "schemaVersion": 1,
            "nodes": [
                {
                    "id": "text-to-image",
                    "type": "text_to_image",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {"size": "02048x01024"},
                },
                {
                    "id": "image-to-image",
                    "type": "image_to_image",
                    "position": {"x": 320, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {
                        "operation": "image_to_image",
                        "size": "01920x01080",
                    },
                },
            ],
        }
    )

    dumped = definition.model_dump(mode="json", by_alias=True)

    assert dumped["schemaVersion"] == 1
    assert dumped["nodes"][0]["config"]["size"] == "2048x1024"
    assert dumped["nodes"][1]["config"]["size"] == "1920x1080"


@pytest.mark.parametrize(
    ("config_type", "payload"),
    [
        (ImageModelConfig, {"size": "512x512"}),
        (
            ImageToImageConfig,
            {"operation": "image_to_image", "size": "2048X1024"},
        ),
        (
            ImageToImageConfig,
            {"operation": "image_edit", "size": "2048x1024"},
        ),
        (
            ImageToImageConfig,
            {"operation": "layer_decomposition", "size": "2048x1024"},
        ),
        (
            ImageToImageConfig,
            {"operation": "image_edit", "size": "auto"},
        ),
        (
            ImageToImageConfig,
            {"operation": "image_to_image", "size": "auto"},
        ),
    ],
)
def test_image_configs_reject_invalid_or_mode_incompatible_sizes(
    config_type: type[ImageModelConfig],
    payload: dict[str, str],
) -> None:
    with pytest.raises(ValidationError):
        config_type.model_validate(payload)


@pytest.mark.parametrize(
    ("operation", "size"),
    [
        ("image_edit", "1K"),
        ("image_edit", "1.5K"),
        ("image_edit", "2K"),
        ("layer_decomposition", "auto"),
        ("layer_decomposition", "1K"),
        ("layer_decomposition", "1.5K"),
        ("layer_decomposition", "2K"),
    ],
)
def test_restricted_image_operations_keep_their_existing_size_sets(
    operation: str,
    size: str,
) -> None:
    config = ImageToImageConfig.model_validate(
        {"operation": operation, "size": size}
    )

    assert config.size == size


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


def test_image_config_requires_paired_upstream_bbox_binding() -> None:
    bbox = {
        "type": "bbox",
        "x1": 100,
        "y1": 200,
        "x2": 700,
        "y2": 800,
    }

    config = ImageConfig.model_validate(
        {
            "upstream_bbox": bbox,
            "upstream_bbox_asset_id": "upstream-image",
        }
    )
    assert config.upstream_bbox is not None
    assert config.upstream_bbox_asset_id == "upstream-image"

    with pytest.raises(ValidationError, match="upstream_bbox_asset_mismatch"):
        ImageConfig.model_validate({"upstream_bbox": bbox})


def test_prompt_optimization_request_validates_structured_content() -> None:
    request = AigcPromptOptimizeRequest(
        target_node_id="image-model",
        target_type="image_to_image",
        target_config={
            "model": "doubao-seedream-5-0-pro-260628",
            "operation": "image_to_image",
            "aspect_ratio": "1:1",
            "size": "2K",
            "reference_image_count": 2,
        },
        optimization_direction="强化产品质感",
        text="  红色包装产品主图  ",
        reference_instructions=["保留商标位置"],
    )

    assert request.text == "  红色包装产品主图  "
    assert request.reference_instructions == ["保留商标位置"]

    with pytest.raises(ValidationError, match="must not be blank"):
        AigcPromptOptimizeRequest(
            target_node_id="llm",
            target_type="llm",
            target_config={"model": "doubao-seed-evolving", "system_prompt": ""},
            text=" ",
        )
    with pytest.raises(ValidationError, match="coordinate_tag_forbidden"):
        AigcPromptOptimizeRequest(
            target_node_id="llm",
            target_type="llm",
            target_config={"model": "doubao-seed-evolving", "system_prompt": ""},
            text="<bbox>1 2 3 4</bbox>",
        )
    with pytest.raises(ValidationError, match="target_config does not match"):
        AigcPromptOptimizeRequest(
            target_node_id="llm",
            target_type="llm",
            target_config={
                "model": "doubao-seedream-5-0-pro-260628",
                "aspect_ratio": "1:1",
                "size": "2K",
                "reference_image_count": 0,
            },
            text="产品图",
        )


def test_image_prompt_sections_only_enforce_renderable_boundaries() -> None:
    base = [
        {"label": "Subject", "content": "Show the requested subject."},
        {"label": "Lighting", "content": "Use controlled lighting."},
        {"label": "Composition", "content": "Use balanced framing."},
        {"label": "Negative Prompt", "content": "No unrelated artifacts."},
    ]
    assert len(AigcImagePromptSections(sections=base).sections) == 4
    ten = [
        *[
            {"label": f"Layer {index}", "content": "Use relevant details."}
            for index in range(1, 9)
        ],
        {"label": "Composition", "content": "Use balanced framing."},
        {"label": "Negative Prompt", "content": "No unrelated artifacts."},
    ]
    assert len(AigcImagePromptSections(sections=ten).sections) == 10
    assert len(AigcImagePromptSections(sections=base[:3]).sections) == 3
    assert len(
        AigcImagePromptSections(
            sections=[
                *ten,
                *[
                    {
                        "label": f"Optional Layer {index}",
                        "content": "Use relevant details.",
                    }
                    for index in range(11, 21)
                ],
            ]
        ).sections
    ) == 20
    assert len(
        AigcImagePromptSections(
            sections=[
                base[0],
                {"label": "subject", "content": "Duplicate but renderable."},
                {"label": "Bad:Label", "content": "Still renderable."},
            ]
        ).sections
    ) == 3

    for sections, error in (
        ([], "at least 1"),
        (
            [
                {
                    "label": f"Layer {index}",
                    "content": "Use relevant details.",
                }
                for index in range(1, 22)
            ],
            "at most 20",
        ),
        ([{"label": " ", "content": "Invalid."}], "must not be blank"),
        ([{"label": "Subject", "content": " "}], "must not be blank"),
    ):
        with pytest.raises(ValidationError, match=error):
            AigcImagePromptSections(sections=sections)


def test_image_prompt_optimization_result_schemas_are_mutually_exclusive() -> None:
    local = AigcImagePromptLocalEditResult(
        optimization_mode="local_edit",
        optimized_text=(
            "Use the input image as the editing base. Change only the coat color "
            "and preserve every unspecified visual detail unchanged."
        ),
    )
    full = AigcImagePromptFullDesignResult(
        optimization_mode="full_design",
        sections=[
            {"label": "Subject", "content": "Show the requested subject."},
            {"label": "Composition", "content": "Use balanced framing."},
            {"label": "Negative Prompt", "content": "Avoid unrelated objects."},
        ],
    )

    assert local.optimization_mode == "local_edit"
    assert full.optimization_mode == "full_design"
    with pytest.raises(ValidationError):
        AigcImagePromptLocalEditResult.model_validate(
            {
                **local.model_dump(),
                "sections": full.model_dump()["sections"],
            }
        )
    with pytest.raises(ValidationError):
        AigcImagePromptFullDesignResult.model_validate(
            {
                **full.model_dump(),
                "optimized_text": local.optimized_text,
            }
        )
    with pytest.raises(ValidationError):
        AigcImagePromptLocalEditResult.model_validate(
            {"optimized_text": local.optimized_text}
        )


def test_prompt_optimization_pipeline_context_is_optional_and_image_only() -> None:
    definition = AigcPipelineDefinitionV2.model_validate(
        {
            "nodes": [
                {
                    "id": "image-model",
                    "type": "image_to_image",
                    "position": {"x": 0, "y": 0},
                    "size": {"width": 280, "height": 200},
                    "config": {},
                }
            ]
        }
    )
    request = AigcPromptOptimizeRequest(
        target_node_id="image-model",
        target_type="image_to_image",
        target_config={
            "model": "doubao-seedream-5-0-pro-260628",
            "operation": "image_to_image",
            "aspect_ratio": "1:1",
            "size": "2K",
            "reference_image_count": 0,
        },
        text="重新设计画面",
        pipeline_context={
            "pipeline_id": "pipeline-1",
            "base_revision": 0,
            "definition_snapshot": definition.model_dump(
                mode="json",
                by_alias=True,
            ),
            "source_image": None,
        },
    )

    assert request.pipeline_context is not None
    assert request.pipeline_context.definition_snapshot == definition
    with pytest.raises(ValidationError, match="only supported"):
        AigcPromptOptimizeRequest(
            target_node_id="llm-1",
            target_type="llm",
            target_config={"model": "doubao-seed-evolving", "system_prompt": ""},
            text="分析素材",
            pipeline_context=request.pipeline_context,
        )


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


def test_seedream_prompt_optimization_response_contract() -> None:
    parsed = AigcSeedreamPromptOptimizationResult(
        generation_type="图像编辑",
        optimized_text="去掉女生的帽子，保持其他内容不变。",
        optimization_explanation="明确了编辑对象。",
    )
    response = AigcPromptOptimizeResponse(
        optimized_text=parsed.optimized_text,
        optimized_reference_instructions=["保持商标位置"],
        generation_type=parsed.generation_type,
        optimization_explanation=parsed.optimization_explanation,
    )

    assert response.generation_type == "图像编辑"
    assert response.optimization_explanation == "明确了编辑对象。"
    assert AigcPromptOptimizeResponse().generation_type is None
    assert AigcPromptOptimizeResponse().optimization_explanation == ""

    with pytest.raises(ValidationError, match="coordinate_tag_forbidden"):
        AigcPromptOptimizeResponse(
            optimization_explanation="查看 <bbox>1 2 3 4</bbox>",
        )
