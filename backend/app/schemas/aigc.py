from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from enum import Enum
from typing import Annotated, Generic, Literal, TypeAlias, TypeVar
from uuid import uuid4

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    StrictInt,
    field_validator,
    model_validator,
)

from .common import SchemaModel, utc_now
from .image_generation import COORDINATE_TAG_PATTERN, ImageBboxAnnotation
from .seedance import (
    SEEDANCE_DEFAULT_ASPECT_RATIO,
    SEEDANCE_DEFAULT_DURATION_SECONDS,
    SEEDANCE_DEFAULT_GENERATE_AUDIO,
    SEEDANCE_DEFAULT_MODEL,
    SEEDANCE_DEFAULT_RESOLUTION,
    SEEDANCE_DEFAULT_TASK_TYPE,
    SEEDANCE_MODELS,
    SeedanceAspectRatio,
    SeedanceModel,
    SeedanceResolution,
    SeedanceTaskType,
    validate_seedance_duration,
    validate_seedance_resolution,
)

AIGC_DEFINITION_SCHEMA_VERSION = 1
AIGC_MAX_NODES = 100
AIGC_MAX_EDGES = 200
AIGC_DEFAULT_TEXT_MODEL = "doubao-seed-evolving"
AIGC_DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-pro-260628"


class AigcNodeCategory(str, Enum):
    INPUT = "input"
    MODEL = "model"
    CONTROL = "control"
    OUTPUT = "output"


class AigcNodeType(str, Enum):
    TEXT_INPUT = "text_input"
    IMAGE_INPUT = "image_input"
    VIDEO_INPUT = "video_input"
    AUDIO_INPUT = "audio_input"
    LLM = "llm"
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_TO_IMAGE = "image_to_image"
    VIDEO_GENERATION = "video_generation"
    LAYER_CANVAS = "layer_canvas"
    LAYER_COMPOSITE = "layer_composite"
    TEXT_OUTPUT = "text_output"
    IMAGE_OUTPUT = "image_output"
    VIDEO_OUTPUT = "video_output"


class AigcPortType(str, Enum):
    TEXT = "text"
    IMAGE_ASSET = "image_asset"
    VIDEO_ASSET = "video_asset"
    AUDIO_ASSET = "audio_asset"
    LAYER_SET = "layer_set"
    IMAGE_LAYER = "image_layer"
    EDITED_LAYER = "edited_layer"


class AigcPipelineRunMode(str, Enum):
    FULL = "full"
    FROM_NODE = "from_node"
    RETRY_NODE = "retry_node"


class AigcPipelineRunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


class AigcRunNodeStatus(str, Enum):
    IDLE = "idle"
    READY = "ready"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    CANCELED = "canceled"
    BLOCKED = "blocked"
    REUSED = "reused"


class AigcTaskStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    CANCELED = "canceled"


class AigcTaskType(str, Enum):
    LLM = "llm"
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_TO_IMAGE = "image_to_image"
    IMAGE_EDIT = "image_edit"
    LAYER_DECOMPOSITION = "layer_decomposition"
    LAYER_CANVAS = "layer_canvas"
    LAYER_COMPOSITE = "layer_composite"
    VIDEO_GENERATION = "video_generation"


class AigcResultKind(str, Enum):
    NONE = "none"
    TEXT = "text"
    ASSETS = "assets"
    LAYER_SET = "layer_set"
    IMAGE_LAYER = "image_layer"
    EDITED_LAYER = "edited_layer"
    LAYER_CANVAS = "layer_canvas"
    LAYER_COMPOSITE = "layer_composite"
    UNAVAILABLE = "unavailable"


class AigcAssetDirection(str, Enum):
    INPUT = "input"
    OUTPUT = "output"


AigcImageAspectRatio: TypeAlias = Literal["1:1", "16:9", "9:16", "4:3", "3:4"]
AigcImageSize: TypeAlias = Literal["1K", "1.5K", "2K"]
AigcImageToImageSize: TypeAlias = Literal["auto", "1K", "1.5K", "2K"]
AigcImageFormat: TypeAlias = Literal["png", "jpeg"]
AigcImageOperation: TypeAlias = Literal[
    "image_to_image",
    "image_edit",
    "layer_decomposition",
]
AigcPromptOptimizationMode: TypeAlias = Literal[
    "text_to_image",
    "image_to_image",
]


class AigcVideoGenerationMode(str, Enum):
    TEXT_TO_VIDEO = "text_to_video"
    FIRST_FRAME = "first_frame"
    FIRST_LAST_FRAME = "first_last_frame"
    MULTIMODAL_REFERENCE = "multimodal_reference"


class AigcPoint(SchemaModel):
    x: float
    y: float


class AigcSize(SchemaModel):
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)


class AigcFrozenModel(SchemaModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        frozen=True,
    )


AigcBoundingBox: TypeAlias = tuple[StrictInt, StrictInt, StrictInt, StrictInt]
AigcDigest: TypeAlias = Annotated[
    str,
    Field(min_length=64, max_length=64, pattern=r"^[0-9a-f]{64}$"),
]


class AigcLayerSetSummary(AigcFrozenModel):
    id: str = Field(..., min_length=1)
    version: int = Field(..., ge=0)
    digest: AigcDigest


class AigcLayer(AigcFrozenModel):
    id: str = Field(..., min_length=1)
    asset_id: str = Field(..., min_length=1)
    z_index: int = Field(..., ge=1, le=16)
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=4000)
    bbox_absolute: AigcBoundingBox
    bbox_normalized: AigcBoundingBox
    visible: bool = True
    x: float
    y: float
    scale: float = Field(default=1.0, ge=0.05, le=20)

    @model_validator(mode="after")
    def validate_bounding_boxes(self) -> "AigcLayer":
        ax1, ay1, ax2, ay2 = self.bbox_absolute
        if not (0 <= ax1 < ax2 and 0 <= ay1 < ay2):
            raise ValueError("absolute bbox requires non-negative exclusive bounds")
        nx1, ny1, nx2, ny2 = self.bbox_normalized
        if not (0 <= nx1 < nx2 <= 1000 and 0 <= ny1 < ny2 <= 1000):
            raise ValueError(
                "normalized bbox requires exclusive bounds from 0 to 1000"
            )
        return self


class AigcLayerSet(AigcFrozenModel):
    id: str = Field(..., min_length=1)
    parent_layer_set_id: str | None = Field(default=None, min_length=1)
    source_asset_id: str = Field(..., min_length=1)
    base_asset_id: str = Field(..., min_length=1)
    canvas_width: int = Field(..., gt=0)
    canvas_height: int = Field(..., gt=0)
    version: int = Field(..., ge=0)
    digest: AigcDigest
    layers: tuple[AigcLayer, ...] = Field(default_factory=tuple, max_length=16)

    @model_validator(mode="after")
    def validate_snapshot_identity_and_layers(self) -> "AigcLayerSet":
        if (self.version == 0) != (self.parent_layer_set_id is None):
            raise ValueError(
                "root layer sets require version 0 and no parent; "
                "derived layer sets require a parent and positive version"
            )
        if self.parent_layer_set_id == self.id:
            raise ValueError("a layer set cannot be its own parent")
        layer_ids = [layer.id for layer in self.layers]
        if len(layer_ids) != len(set(layer_ids)):
            raise ValueError("layer ids must be unique within a layer set")
        indexes = sorted(layer.z_index for layer in self.layers)
        if indexes != list(range(1, len(indexes) + 1)):
            raise ValueError("layer z_index values must be unique and continuous")
        if any(
            layer.bbox_absolute[2] > self.canvas_width
            or layer.bbox_absolute[3] > self.canvas_height
            for layer in self.layers
        ):
            raise ValueError("absolute bbox exceeds the layer set canvas")
        return self


class AigcImageLayer(AigcFrozenModel):
    asset_id: str = Field(..., min_length=1)
    layer_set_id: str = Field(..., min_length=1)
    layer_set_version: int = Field(..., ge=0)
    layer_set_digest: AigcDigest
    layer_id: str = Field(..., min_length=1)
    bbox_absolute: AigcBoundingBox
    bbox_normalized: AigcBoundingBox
    x: float
    y: float
    scale: float = Field(..., ge=0.05, le=20)
    z_index: int = Field(..., ge=1, le=16)

    @model_validator(mode="after")
    def validate_bounding_boxes(self) -> "AigcImageLayer":
        ax1, ay1, ax2, ay2 = self.bbox_absolute
        if not (0 <= ax1 < ax2 and 0 <= ay1 < ay2):
            raise ValueError("absolute bbox requires non-negative exclusive bounds")
        nx1, ny1, nx2, ny2 = self.bbox_normalized
        if not (0 <= nx1 < nx2 <= 1000 and 0 <= ny1 < ny2 <= 1000):
            raise ValueError(
                "normalized bbox requires exclusive bounds from 0 to 1000"
            )
        return self


class AigcEditedLayer(AigcImageLayer):
    pass


class AigcLayerTransformPatch(AigcFrozenModel):
    layer_id: str = Field(..., min_length=1)
    x: float | None = None
    y: float | None = None
    scale: float | None = Field(default=None, ge=0.05, le=20)
    z_index: int | None = Field(default=None, ge=1, le=16)
    visible: bool | None = None
    deleted: bool | None = None

    @model_validator(mode="after")
    def require_a_change(self) -> "AigcLayerTransformPatch":
        if all(
            value is None
            for value in (
                self.x,
                self.y,
                self.scale,
                self.z_index,
                self.visible,
                self.deleted,
            )
        ):
            raise ValueError("layer transform patch must contain a change")
        return self


class AigcViewport(SchemaModel):
    x: float = 0
    y: float = 0
    zoom: float = Field(default=1, gt=0, le=4)


class AigcBboxPromptReference(SchemaModel):
    source_node_id: str = Field(..., min_length=1, max_length=120)
    instruction: str = Field(default="", max_length=4000)

    @field_validator("source_node_id")
    @classmethod
    def strip_source_node_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("source_node_id must not be blank")
        return stripped

    @field_validator("instruction")
    @classmethod
    def reject_coordinate_tags(cls, value: str) -> str:
        if COORDINATE_TAG_PATTERN.search(value):
            raise ValueError("coordinate_tag_forbidden")
        return value


class TextInputConfig(SchemaModel):
    text: str = Field(default="", max_length=20000)
    bbox_references: list[AigcBboxPromptReference] = Field(
        default_factory=list,
        max_length=10,
    )

    @field_validator("text")
    @classmethod
    def reject_coordinate_tags(cls, value: str) -> str:
        if COORDINATE_TAG_PATTERN.search(value):
            raise ValueError("coordinate_tag_forbidden")
        return value

    @model_validator(mode="after")
    def validate_unique_bbox_references(self) -> "TextInputConfig":
        source_ids = [item.source_node_id for item in self.bbox_references]
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("bbox reference source_node_id values must be unique")
        return self


class AigcPromptOptimizeRequest(SchemaModel):
    text: str = Field(default="", max_length=20000)
    reference_instructions: list[str] = Field(default_factory=list, max_length=10)
    generation_modes: list[AigcPromptOptimizationMode] = Field(
        default_factory=lambda: ["text_to_image"],
        min_length=1,
        max_length=2,
    )
    reference_image_count: int = Field(default=0, ge=0, le=10)

    @field_validator("text")
    @classmethod
    def reject_text_coordinate_tags(cls, value: str) -> str:
        if COORDINATE_TAG_PATTERN.search(value):
            raise ValueError("coordinate_tag_forbidden")
        return value

    @field_validator("reference_instructions")
    @classmethod
    def validate_reference_instructions(cls, values: list[str]) -> list[str]:
        for value in values:
            if len(value) > 4000:
                raise ValueError("reference instruction exceeds 4000 characters")
            if COORDINATE_TAG_PATTERN.search(value):
                raise ValueError("coordinate_tag_forbidden")
        return values

    @model_validator(mode="after")
    def validate_prompt_context(self) -> "AigcPromptOptimizeRequest":
        if len(set(self.generation_modes)) != len(self.generation_modes):
            raise ValueError("generation_modes must be unique")
        if not self.text.strip() and not any(
            value.strip() for value in self.reference_instructions
        ):
            raise ValueError("prompt content must not be blank")
        return self


class AigcPromptOptimizeResponse(SchemaModel):
    optimized_text: str = Field(default="", max_length=20000)
    optimized_reference_instructions: list[str] = Field(
        default_factory=list,
        max_length=10,
    )

    @field_validator("optimized_text")
    @classmethod
    def reject_text_coordinate_tags(cls, value: str) -> str:
        if COORDINATE_TAG_PATTERN.search(value):
            raise ValueError("coordinate_tag_forbidden")
        return value

    @field_validator("optimized_reference_instructions")
    @classmethod
    def validate_reference_instructions(cls, values: list[str]) -> list[str]:
        for value in values:
            if len(value) > 4000:
                raise ValueError("optimized reference instruction exceeds 4000 characters")
            if COORDINATE_TAG_PATTERN.search(value):
                raise ValueError("coordinate_tag_forbidden")
        return values


class ImageInputConfig(SchemaModel):
    asset_id: str | None = Field(default=None, min_length=1)
    bbox: ImageBboxAnnotation | None = None
    bbox_asset_id: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def validate_bbox_asset_binding(self) -> "ImageInputConfig":
        if (self.bbox is None) != (self.bbox_asset_id is None):
            raise ValueError("bbox_asset_mismatch")
        if self.bbox is not None and self.bbox_asset_id != self.asset_id:
            raise ValueError("bbox_asset_mismatch")
        return self


class VideoInputConfig(SchemaModel):
    asset_id: str | None = Field(default=None, min_length=1)


class AudioInputConfig(SchemaModel):
    asset_id: str | None = Field(default=None, min_length=1)


class LlmConfig(SchemaModel):
    model: str = Field(default=AIGC_DEFAULT_TEXT_MODEL, min_length=1, max_length=255)
    system_prompt: str = Field(default="", max_length=12000)
    temperature: float = Field(default=0.7, ge=0, le=2)


class ImageModelConfig(SchemaModel):
    model: str = Field(default=AIGC_DEFAULT_IMAGE_MODEL, min_length=1, max_length=255)
    aspect_ratio: AigcImageAspectRatio = "1:1"
    size: AigcImageSize = "2K"
    format: AigcImageFormat = "png"


class ImageToImageConfig(ImageModelConfig):
    operation: AigcImageOperation = "image_to_image"
    size: AigcImageToImageSize = "2K"

    @model_validator(mode="before")
    @classmethod
    def default_layer_decomposition_size(cls, value: object) -> object:
        if (
            isinstance(value, dict)
            and value.get("operation") == "layer_decomposition"
            and "size" not in value
        ):
            return {**value, "size": "auto"}
        return value

    @model_validator(mode="after")
    def validate_operation_size(self) -> "ImageToImageConfig":
        if self.operation != "layer_decomposition" and self.size == "auto":
            raise ValueError("auto size is only supported for layer_decomposition")
        return self


class LayerCanvasConfig(SchemaModel):
    selected_layer_id: str | None = Field(default=None, min_length=1)
    source_layer_set: AigcLayerSetSummary | None = None
    transform_patches: tuple[AigcLayerTransformPatch, ...] = Field(
        default_factory=tuple,
        max_length=16,
    )

    @model_validator(mode="after")
    def validate_unique_transform_patches(self) -> "LayerCanvasConfig":
        layer_ids = [patch.layer_id for patch in self.transform_patches]
        if len(layer_ids) != len(set(layer_ids)):
            raise ValueError("layer transform patches must have unique layer ids")
        if (
            self.source_layer_set is None
            and (self.selected_layer_id is not None or self.transform_patches)
        ):
            raise ValueError("layer canvas draft requires a source layer set")
        return self


class LayerCompositeConfig(SchemaModel):
    pass


class VideoGenerationConfig(SchemaModel):
    model: SeedanceModel = SEEDANCE_DEFAULT_MODEL
    generation_mode: AigcVideoGenerationMode = (
        AigcVideoGenerationMode.TEXT_TO_VIDEO
    )
    task_type: SeedanceTaskType = SEEDANCE_DEFAULT_TASK_TYPE
    resolution: SeedanceResolution = SEEDANCE_DEFAULT_RESOLUTION
    aspect_ratio: SeedanceAspectRatio = SEEDANCE_DEFAULT_ASPECT_RATIO
    duration_seconds: int = Field(
        default=SEEDANCE_DEFAULT_DURATION_SECONDS,
        strict=True,
    )
    generate_audio: bool = SEEDANCE_DEFAULT_GENERATE_AUDIO

    @model_validator(mode="after")
    def validate_model_parameters(self) -> "VideoGenerationConfig":
        validate_seedance_resolution(self.model, self.resolution)
        validate_seedance_duration(self.model, self.duration_seconds)
        return self


class TextOutputConfig(SchemaModel):
    title: str = Field(default="文本结果", min_length=1, max_length=120)


class ImageOutputConfig(SchemaModel):
    title: str = Field(default="图片结果", min_length=1, max_length=120)


class VideoOutputConfig(SchemaModel):
    title: str = Field(default="视频结果", min_length=1, max_length=120)


class AigcNodeBase(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str = Field(..., min_length=1, max_length=120)
    position: AigcPoint
    size: AigcSize

    @field_validator("id")
    @classmethod
    def strip_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("node id must not be blank")
        return stripped


class TextInputNode(AigcNodeBase):
    type: Literal[AigcNodeType.TEXT_INPUT]
    config: TextInputConfig = Field(default_factory=TextInputConfig)


class ImageInputNode(AigcNodeBase):
    type: Literal[AigcNodeType.IMAGE_INPUT]
    config: ImageInputConfig = Field(default_factory=ImageInputConfig)


class VideoInputNode(AigcNodeBase):
    type: Literal[AigcNodeType.VIDEO_INPUT]
    config: VideoInputConfig = Field(default_factory=VideoInputConfig)


class AudioInputNode(AigcNodeBase):
    type: Literal[AigcNodeType.AUDIO_INPUT]
    config: AudioInputConfig = Field(default_factory=AudioInputConfig)


class LlmNode(AigcNodeBase):
    type: Literal[AigcNodeType.LLM]
    config: LlmConfig = Field(default_factory=LlmConfig)


class TextToImageNode(AigcNodeBase):
    type: Literal[AigcNodeType.TEXT_TO_IMAGE]
    config: ImageModelConfig = Field(default_factory=ImageModelConfig)


class ImageToImageNode(AigcNodeBase):
    type: Literal[AigcNodeType.IMAGE_TO_IMAGE]
    config: ImageToImageConfig = Field(default_factory=ImageToImageConfig)


class VideoGenerationNode(AigcNodeBase):
    type: Literal[AigcNodeType.VIDEO_GENERATION]
    config: VideoGenerationConfig = Field(default_factory=VideoGenerationConfig)


class LayerCanvasNode(AigcNodeBase):
    type: Literal[AigcNodeType.LAYER_CANVAS]
    config: LayerCanvasConfig = Field(default_factory=LayerCanvasConfig)


class LayerCompositeNode(AigcNodeBase):
    type: Literal[AigcNodeType.LAYER_COMPOSITE]
    config: LayerCompositeConfig = Field(default_factory=LayerCompositeConfig)


class TextOutputNode(AigcNodeBase):
    type: Literal[AigcNodeType.TEXT_OUTPUT]
    config: TextOutputConfig = Field(default_factory=TextOutputConfig)


class ImageOutputNode(AigcNodeBase):
    type: Literal[AigcNodeType.IMAGE_OUTPUT]
    config: ImageOutputConfig = Field(default_factory=ImageOutputConfig)


class VideoOutputNode(AigcNodeBase):
    type: Literal[AigcNodeType.VIDEO_OUTPUT]
    config: VideoOutputConfig = Field(default_factory=VideoOutputConfig)


AigcNode: TypeAlias = Annotated[
    TextInputNode
    | ImageInputNode
    | VideoInputNode
    | AudioInputNode
    | LlmNode
    | TextToImageNode
    | ImageToImageNode
    | VideoGenerationNode
    | LayerCanvasNode
    | LayerCompositeNode
    | TextOutputNode
    | ImageOutputNode
    | VideoOutputNode,
    Field(discriminator="type"),
]


class AigcEdge(SchemaModel):
    id: str = Field(..., min_length=1, max_length=120)
    source_node_id: str = Field(..., alias="sourceNodeId", min_length=1, max_length=120)
    source_handle: str = Field(..., alias="sourceHandle", min_length=1, max_length=80)
    target_node_id: str = Field(..., alias="targetNodeId", min_length=1, max_length=120)
    target_handle: str = Field(..., alias="targetHandle", min_length=1, max_length=80)


class AigcPipelineDefinition(SchemaModel):
    schema_version: Literal[1] = Field(
        default=AIGC_DEFINITION_SCHEMA_VERSION,
        alias="schemaVersion",
    )
    nodes: list[AigcNode] = Field(default_factory=list, max_length=AIGC_MAX_NODES)
    edges: list[AigcEdge] = Field(default_factory=list, max_length=AIGC_MAX_EDGES)
    viewport: AigcViewport = Field(default_factory=AigcViewport)

    @model_validator(mode="after")
    def validate_unique_ids_and_endpoints(self) -> "AigcPipelineDefinition":
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("AIGC node ids must be unique")
        edge_ids = [edge.id for edge in self.edges]
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("AIGC edge ids must be unique")
        known_nodes = set(node_ids)
        for edge in self.edges:
            if edge.source_node_id not in known_nodes:
                raise ValueError(f"edge {edge.id} source node does not exist")
            if edge.target_node_id not in known_nodes:
                raise ValueError(f"edge {edge.id} target node does not exist")
        return self


class AigcPortDefinition(SchemaModel):
    id: str
    label: str
    type: AigcPortType
    required: bool = True
    multiple: bool = False
    max_connections: int = Field(default=1, ge=1)
    modes: list[AigcVideoGenerationMode] = Field(default_factory=list)


class AigcNodeRegistryItem(SchemaModel):
    type: AigcNodeType
    label: str
    category: AigcNodeCategory
    executable: bool
    inputs: list[AigcPortDefinition] = Field(default_factory=list)
    outputs: list[AigcPortDefinition] = Field(default_factory=list)
    models: list[str] = Field(default_factory=list)


def _port(
    port_id: str,
    label: str,
    port_type: AigcPortType,
    *,
    required: bool = True,
    multiple: bool = False,
    max_connections: int = 1,
    modes: tuple[AigcVideoGenerationMode, ...] = (),
) -> AigcPortDefinition:
    return AigcPortDefinition(
        id=port_id,
        label=label,
        type=port_type,
        required=required,
        multiple=multiple,
        max_connections=max_connections,
        modes=list(modes),
    )


AIGC_NODE_REGISTRY: tuple[AigcNodeRegistryItem, ...] = (
    AigcNodeRegistryItem(
        type=AigcNodeType.TEXT_INPUT,
        label="文本输入",
        category=AigcNodeCategory.INPUT,
        executable=False,
        outputs=[_port("text", "文本", AigcPortType.TEXT)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.IMAGE_INPUT,
        label="图片输入",
        category=AigcNodeCategory.INPUT,
        executable=False,
        outputs=[_port("image", "图片", AigcPortType.IMAGE_ASSET)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.VIDEO_INPUT,
        label="视频输入",
        category=AigcNodeCategory.INPUT,
        executable=False,
        outputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.AUDIO_INPUT,
        label="音频输入",
        category=AigcNodeCategory.INPUT,
        executable=False,
        outputs=[_port("audio", "音频", AigcPortType.AUDIO_ASSET)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.LLM,
        label="LLM",
        category=AigcNodeCategory.MODEL,
        executable=True,
        inputs=[_port("prompt", "提示词", AigcPortType.TEXT)],
        outputs=[_port("text", "文本", AigcPortType.TEXT)],
        models=[AIGC_DEFAULT_TEXT_MODEL],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.TEXT_TO_IMAGE,
        label="文生图",
        category=AigcNodeCategory.MODEL,
        executable=True,
        inputs=[_port("prompt", "提示词", AigcPortType.TEXT)],
        outputs=[_port("image", "图片", AigcPortType.IMAGE_ASSET)],
        models=[AIGC_DEFAULT_IMAGE_MODEL],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.IMAGE_TO_IMAGE,
        label="Seedream 图片模型",
        category=AigcNodeCategory.MODEL,
        executable=True,
        inputs=[
            _port(
                "image",
                "图片",
                AigcPortType.IMAGE_ASSET,
                multiple=True,
                max_connections=10,
            ),
            _port(
                "edit_image",
                "编辑图片",
                AigcPortType.IMAGE_ASSET,
                required=False,
            ),
            _port(
                "edit_layer",
                "编辑图层",
                AigcPortType.IMAGE_LAYER,
                required=False,
            ),
            _port("prompt", "提示词", AigcPortType.TEXT),
        ],
        outputs=[
            _port("image", "图片", AigcPortType.IMAGE_ASSET),
            _port("edited_layer", "编辑图层", AigcPortType.EDITED_LAYER),
            _port("layers", "图层集", AigcPortType.LAYER_SET),
        ],
        models=[AIGC_DEFAULT_IMAGE_MODEL],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.VIDEO_GENERATION,
        label="生视频",
        category=AigcNodeCategory.MODEL,
        executable=True,
        inputs=[
            _port(
                "prompt",
                "提示词",
                AigcPortType.TEXT,
                required=False,
                modes=tuple(AigcVideoGenerationMode),
            ),
            _port(
                "first_frame",
                "首帧",
                AigcPortType.IMAGE_ASSET,
                required=False,
                modes=(
                    AigcVideoGenerationMode.FIRST_FRAME,
                    AigcVideoGenerationMode.FIRST_LAST_FRAME,
                ),
            ),
            _port(
                "last_frame",
                "尾帧",
                AigcPortType.IMAGE_ASSET,
                required=False,
                modes=(AigcVideoGenerationMode.FIRST_LAST_FRAME,),
            ),
            _port(
                "reference_images",
                "参考图片",
                AigcPortType.IMAGE_ASSET,
                required=False,
                multiple=True,
                max_connections=30,
                modes=(AigcVideoGenerationMode.MULTIMODAL_REFERENCE,),
            ),
            _port(
                "reference_videos",
                "参考视频",
                AigcPortType.VIDEO_ASSET,
                required=False,
                multiple=True,
                max_connections=10,
                modes=(AigcVideoGenerationMode.MULTIMODAL_REFERENCE,),
            ),
            _port(
                "reference_audios",
                "参考音频",
                AigcPortType.AUDIO_ASSET,
                required=False,
                multiple=True,
                max_connections=10,
                modes=(AigcVideoGenerationMode.MULTIMODAL_REFERENCE,),
            ),
        ],
        outputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
        models=list(SEEDANCE_MODELS),
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.LAYER_CANVAS,
        label="图层画布",
        category=AigcNodeCategory.CONTROL,
        executable=True,
        inputs=[_port("layers", "图层集", AigcPortType.LAYER_SET)],
        outputs=[
            _port(
                "selected_layer",
                "选中图层",
                AigcPortType.IMAGE_LAYER,
                required=False,
            ),
            _port("layers", "图层集", AigcPortType.LAYER_SET),
        ],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.LAYER_COMPOSITE,
        label="图层合成",
        category=AigcNodeCategory.CONTROL,
        executable=True,
        inputs=[
            _port("layers", "图层集", AigcPortType.LAYER_SET),
            _port("replacement", "替换图层", AigcPortType.EDITED_LAYER),
        ],
        outputs=[
            _port("image", "图片", AigcPortType.IMAGE_ASSET),
            _port("layers", "图层集", AigcPortType.LAYER_SET),
        ],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.TEXT_OUTPUT,
        label="文本输出",
        category=AigcNodeCategory.OUTPUT,
        executable=False,
        inputs=[_port("text", "文本", AigcPortType.TEXT)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.IMAGE_OUTPUT,
        label="图片输出",
        category=AigcNodeCategory.OUTPUT,
        executable=False,
        inputs=[_port("image", "图片", AigcPortType.IMAGE_ASSET)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.VIDEO_OUTPUT,
        label="视频输出",
        category=AigcNodeCategory.OUTPUT,
        executable=False,
        inputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
    ),
)


class AigcNodeRegistryResponse(SchemaModel):
    schema_version: Literal[1] = AIGC_DEFINITION_SCHEMA_VERSION
    nodes: list[AigcNodeRegistryItem] = Field(
        default_factory=lambda: deepcopy(list(AIGC_NODE_REGISTRY))
    )


class AigcNamedEntity(SchemaModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AigcPipelineTemplateCreate(AigcNamedEntity):
    definition: AigcPipelineDefinition = Field(default_factory=AigcPipelineDefinition)


class AigcPipelineTemplateUpdate(AigcPipelineTemplateCreate):
    expected_revision: int = Field(..., ge=0)


class AigcPipelineTemplate(AigcPipelineTemplateCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    revision: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AigcTemplateInstantiateRequest(SchemaModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class AigcSaveAsTemplateRequest(AigcNamedEntity):
    pass


class AigcPipelineCreate(AigcNamedEntity):
    definition: AigcPipelineDefinition = Field(default_factory=AigcPipelineDefinition)
    source_template_id: str | None = None
    source_template_revision: int | None = Field(default=None, ge=0)


class AigcPipelineUpdate(SchemaModel):
    expected_revision: int = Field(..., ge=0)
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    definition: AigcPipelineDefinition

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class AigcPipeline(AigcPipelineCreate):
    id: str = Field(default_factory=lambda: str(uuid4()))
    revision: int = Field(default=0, ge=0)
    latest_run_status: AigcPipelineRunStatus | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AigcPipelineRunCreate(SchemaModel):
    expected_revision: int = Field(..., ge=0)
    mode: Literal[AigcPipelineRunMode.FULL, AigcPipelineRunMode.FROM_NODE]
    start_node_id: str | None = Field(default=None, min_length=1, max_length=120)

    @model_validator(mode="after")
    def validate_start_node(self) -> "AigcPipelineRunCreate":
        if self.mode == AigcPipelineRunMode.FROM_NODE and not self.start_node_id:
            raise ValueError("from_node runs require start_node_id")
        if self.mode == AigcPipelineRunMode.FULL and self.start_node_id is not None:
            raise ValueError("full runs must not include start_node_id")
        return self


class AigcTaskError(SchemaModel):
    code: str = Field(..., min_length=1, max_length=80)
    message: str = Field(..., min_length=1, max_length=500)
    request_id: str | None = Field(default=None, max_length=255)
    stage: str | None = Field(default=None, max_length=80)


class AigcTaskMetrics(SchemaModel):
    cost_tokens: int = Field(default=0, ge=0)
    duration_ms: int = Field(default=0, ge=0)


class AigcResultAsset(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    ordinal: int = Field(..., ge=0)
    mime_type: str | None = Field(default=None, max_length=120)
    download_url: str | None = None
    available: bool = True


class AigcTaskResult(SchemaModel):
    kind: AigcResultKind = AigcResultKind.NONE
    text: str | None = None
    text_digest: str | None = Field(default=None, min_length=64, max_length=64)
    assets: list[AigcResultAsset] = Field(default_factory=list)
    layer_set: AigcLayerSet | None = None
    image_layer: AigcImageLayer | None = None
    edited_layer: AigcEditedLayer | None = None

    @model_validator(mode="after")
    def validate_result_shape(self) -> "AigcTaskResult":
        if self.kind == AigcResultKind.TEXT and self.text is None:
            raise ValueError("text results require text")
        if self.kind == AigcResultKind.ASSETS and not any(
            asset.available for asset in self.assets
        ):
            raise ValueError("asset results require an available asset")
        if self.kind == AigcResultKind.UNAVAILABLE and any(
            asset.available for asset in self.assets
        ):
            raise ValueError("unavailable results cannot include available assets")
        if self.kind in {
            AigcResultKind.LAYER_SET,
            AigcResultKind.LAYER_CANVAS,
            AigcResultKind.LAYER_COMPOSITE,
        } and self.layer_set is None:
            raise ValueError("layer set results require layer_set")
        if (
            self.kind == AigcResultKind.IMAGE_LAYER
            and self.image_layer is None
        ):
            raise ValueError("image layer results require image_layer")
        if (
            self.kind == AigcResultKind.EDITED_LAYER
            and self.edited_layer is None
        ):
            raise ValueError("edited layer results require edited_layer")
        if (
            self.kind == AigcResultKind.LAYER_COMPOSITE
            and not any(asset.available for asset in self.assets)
        ):
            raise ValueError(
                "layer composite results require an available image asset"
            )
        return self


class AigcPipelineTaskSnapshot(SchemaModel):
    params: dict[str, JsonValue] = Field(default_factory=dict)
    upstream: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def deep_copy_inputs(cls, value: object) -> object:
        return deepcopy(value)


class AigcPipelineTaskAttempt(AigcPipelineTaskSnapshot):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    pipeline_id: str = Field(..., min_length=1)
    run_id: str = Field(..., min_length=1)
    node_id: str = Field(..., min_length=1, max_length=120)
    attempt: int = Field(default=1, ge=1)
    type: AigcTaskType
    status: AigcTaskStatus = AigcTaskStatus.QUEUED
    progress: int = Field(default=0, ge=0, le=100)
    result: AigcTaskResult = Field(default_factory=AigcTaskResult)
    error: AigcTaskError | None = None
    metrics: AigcTaskMetrics = Field(default_factory=AigcTaskMetrics)
    created_at: datetime = Field(default_factory=utc_now)
    started_at: datetime | None = None
    finished_at: datetime | None = None


class AigcPipelineRunNode(SchemaModel):
    node_id: str = Field(..., min_length=1, max_length=120)
    included_in_plan: bool
    status: AigcRunNodeStatus = AigcRunNodeStatus.IDLE
    current_task_id: str | None = None
    reused_from_task_id: str | None = None
    input_hash: str | None = Field(default=None, min_length=64, max_length=64)
    result: AigcTaskResult = Field(default_factory=AigcTaskResult)
    error: AigcTaskError | None = None
    attempts: list[AigcPipelineTaskAttempt] = Field(default_factory=list)


class AigcPipelineRun(SchemaModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    pipeline_id: str = Field(..., min_length=1)
    run_number: int = Field(..., ge=1)
    pipeline_revision: int = Field(..., ge=0)
    mode: AigcPipelineRunMode
    start_node_id: str | None = None
    source_run_id: str | None = None
    source_node_id: str | None = None
    status: AigcPipelineRunStatus = AigcPipelineRunStatus.QUEUED
    definition_snapshot: AigcPipelineDefinition
    input_snapshot: dict[str, JsonValue] = Field(default_factory=dict)
    error: AigcTaskError | None = None
    cancellation_requested: bool = False
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    started_at: datetime | None = None
    finished_at: datetime | None = None


class AigcPipelineRunDetail(SchemaModel):
    run: AigcPipelineRun
    nodes: list[AigcPipelineRunNode]


class AigcPipelineAssetReference(SchemaModel):
    pipeline_id: str = Field(..., min_length=1)
    node_id: str = Field(..., min_length=1, max_length=120)
    slot: str = Field(..., min_length=1, max_length=80)
    asset_id: str = Field(..., min_length=1)


class AigcPipelineTaskAssetReference(SchemaModel):
    task_id: str = Field(..., min_length=1)
    direction: AigcAssetDirection
    slot: str = Field(..., min_length=1, max_length=80)
    ordinal: int = Field(..., ge=0)
    asset_id: str = Field(..., min_length=1)


class AigcWorkerLease(SchemaModel):
    id: Literal["aigc_scheduler"] = "aigc_scheduler"
    owner_id: str = Field(..., min_length=1, max_length=120)
    fencing_token: int = Field(..., ge=1)
    lease_expires_at: datetime
    heartbeat_at: datetime


T = TypeVar("T")


class AigcPage(SchemaModel, Generic[T]):
    items: list[T]
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1, le=100)
    total: int = Field(..., ge=0)


def aigc_node_run_key(run_id: str, node_id: str) -> str:
    return f"{run_id}:{node_id}"
