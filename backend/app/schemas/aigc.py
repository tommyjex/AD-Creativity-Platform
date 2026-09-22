from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from enum import Enum
from ipaddress import ip_address
import math
import re
from typing import Annotated, Generic, Literal, TypeAlias, TypeVar
import unicodedata
from urllib.parse import urlsplit
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
from .image_dimensions import (
    SeedreamImagePresetSize,
    SeedreamImageSize,
    is_seedream_image_preset_size,
)
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

AIGC_DEFINITION_SCHEMA_VERSION = 2
AIGC_LEGACY_DEFINITION_SCHEMA_VERSION = 1
AIGC_MAX_NODES = 100
AIGC_MAX_EDGES = 200
AIGC_DEFAULT_TEXT_MODEL = "doubao-seed-evolving"
AIGC_DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-pro-260628"
AIGC_GENERATED_MEDIA_NAMING_MODEL = "doubao-seed-2-0-mini-260428"
AIGC_JSON_PARSER_DEFAULT_PATH = "$.items"
AIGC_JSON_PARSER_MAX_ITEMS = 20
VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS = 40
VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT = "mov"
MULTI_TRACK_MAX_TRACKS = 20
MULTI_TRACK_MAX_ELEMENTS = 200
MULTI_TRACK_MAX_SUBTITLE_TRACKS = 10
MULTI_TRACK_CANVAS_MIN_SIZE = 160
MULTI_TRACK_CANVAS_MAX_SIZE = 8192
MULTI_TRACK_RGBA_PATTERN = re.compile(r"^#[0-9A-Fa-f]{8}$")
MULTI_TRACK_FONT_TYPE_MAX_LENGTH = 2048
MULTI_TRACK_FONT_FILE_PATTERN = re.compile(r"\.(?:ttf|otf)$", re.IGNORECASE)
MULTI_TRACK_FONT_CONTROL_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
MULTI_TRACK_NUMERIC_HOST_LABEL_PATTERN = re.compile(
    r"^(?:\d+|0x[0-9a-f]+)$",
    re.IGNORECASE,
)
MULTI_TRACK_LOCAL_HOST_SUFFIXES = (".local", ".internal", ".lan", ".home")
MEDIAKIT_FONT_PRESET_IDS = frozenset(
    {
        "1187225",
        "1187223",
        "1187221",
        "1187219",
        "1187217",
        "1187213",
        "1187211",
        "SY_Black",
        "ALi_PuHui",
        "PM_ZhengDao",
    }
)


def _is_multitrack_numeric_hostname(hostname: str) -> bool:
    labels = hostname.removesuffix(".").split(".")
    return bool(labels) and all(
        MULTI_TRACK_NUMERIC_HOST_LABEL_PATTERN.fullmatch(label)
        for label in labels
    )


class AigcNodeCategory(str, Enum):
    MODALITY = "modality"
    INPUT = "input"
    MODEL = "model"
    CONTROL = "control"
    OUTPUT = "output"


class AigcNodeType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT_INPUT = "text_input"
    IMAGE_INPUT = "image_input"
    VIDEO_INPUT = "video_input"
    AUDIO_INPUT = "audio_input"
    LLM = "llm"
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_TO_IMAGE = "image_to_image"
    VIDEO_GENERATION = "video_generation"
    VIDEO_ENHANCEMENT = "video_enhancement"
    VIDEO_FACE_BLUR = "video_face_blur"
    VIDEO_SUBTITLE_EXTRACTION = "video_subtitle_extraction"
    MULTI_TRACK_EDIT = "multi_track_edit"
    JSON_PARSER = "json_parser"
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
    SUBTITLE_ASSET = "subtitle_asset"
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
    VIDEO_ENHANCEMENT = "video_enhancement"
    VIDEO_FACE_BLUR = "video_face_blur"
    VIDEO_SUBTITLE_EXTRACTION = "video_subtitle_extraction"
    MULTI_TRACK_EDIT = "multi_track_edit"
    JSON_PARSER = "json_parser"


class AigcResultKind(str, Enum):
    NONE = "none"
    TEXT = "text"
    TEXT_ITEMS = "text_items"
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


class AigcGeneratedMediaNamingStatus(str, Enum):
    SUCCEEDED = "succeeded"
    TIMEOUT = "timeout"
    PROVIDER_ERROR = "provider_error"
    INVALID_RESPONSE = "invalid_response"
    SKIPPED = "skipped"


class AigcGeneratedMediaVisualInput(SchemaModel):
    type: Literal["image", "video"]
    url: str = Field(..., min_length=1)
    fps: float | None = None

    @model_validator(mode="after")
    def validate_media_options(self) -> "AigcGeneratedMediaVisualInput":
        if self.type == "video" and self.fps != 0.3:
            raise ValueError("generated media naming videos require fps=0.3")
        if self.type == "image" and self.fps is not None:
            raise ValueError("generated media naming images must not include fps")
        return self


class AigcGeneratedMediaNamingRequest(SchemaModel):
    prompt: str = Field(default="", max_length=20000)
    visual_inputs: tuple[AigcGeneratedMediaVisualInput, ...] = Field(
        default_factory=tuple,
        max_length=50,
    )

    @model_validator(mode="after")
    def require_effective_input(self) -> "AigcGeneratedMediaNamingRequest":
        if not self.prompt.strip() and not self.visual_inputs:
            raise ValueError("generated media naming requires prompt or visual input")
        return self


class AigcGeneratedMediaName(SchemaModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not 1 <= len(normalized) <= 10:
            raise ValueError(
                "generated media name must contain 1-10 Unicode code points"
            )
        if any(
            unicodedata.category(character) == "Cc"
            or character in "\u2028\u2029"
            for character in normalized
        ):
            raise ValueError(
                "generated media name must not contain control characters"
            )
        if "/" in normalized or "\\" in normalized:
            raise ValueError(
                "generated media name must not contain path separators"
            )
        if re.search(r"\.[^\s.]{1,10}$", normalized):
            raise ValueError(
                "generated media name must not contain a file extension"
            )
        if normalized[0] in "\"'“”‘’" or normalized[-1] in "\"'“”‘’":
            raise ValueError(
                "generated media name must not contain surrounding quotes"
            )
        if (
            re.match(r"^(?:\d+[\.\)、:：]|[-*#•`])", normalized)
            or any(character in "#`" for character in normalized)
            or ":" in normalized
            or "：" in normalized
        ):
            raise ValueError(
                "generated media name must not contain numbering or Markdown"
            )
        return normalized


class AigcGeneratedMediaNamingResult(SchemaModel):
    status: AigcGeneratedMediaNamingStatus
    model: Literal["doubao-seed-2-0-mini-260428"] = (
        AIGC_GENERATED_MEDIA_NAMING_MODEL
    )
    name: str | None = None

    @model_validator(mode="after")
    def validate_status_name(self) -> "AigcGeneratedMediaNamingResult":
        if self.status == AigcGeneratedMediaNamingStatus.SUCCEEDED:
            if self.name is None:
                raise ValueError("successful generated media naming requires name")
            validated = AigcGeneratedMediaName(name=self.name)
            self.name = validated.name
        elif self.name is not None:
            raise ValueError("failed generated media naming must not include name")
        return self


AigcImageAspectRatio: TypeAlias = Literal["1:1", "16:9", "9:16", "4:3", "3:4"]
AigcImagePresetSize: TypeAlias = SeedreamImagePresetSize
AigcImageSize: TypeAlias = SeedreamImageSize
AigcImageToImageSize: TypeAlias = Literal["auto"] | SeedreamImageSize
AigcImageFormat: TypeAlias = Literal["png", "jpeg"]
AigcImageOperation: TypeAlias = Literal[
    "image_to_image",
    "image_edit",
    "layer_decomposition",
]
AigcPromptOptimizationMode: TypeAlias = Literal[
    "llm",
    "text_to_image",
    "image_to_image",
    "video_generation",
]
AigcPromptOptimizationTargetType: TypeAlias = AigcPromptOptimizationMode
AigcImagePromptOptimizationMode: TypeAlias = Literal["local_edit", "full_design"]
AigcSeedreamGenerationType: TypeAlias = Literal[
    "文生图",
    "图像编辑",
    "参考图生图",
]
AigcVideoEnhancementToolVersion: TypeAlias = Literal["standard", "professional"]
AigcVideoEnhancementScene: TypeAlias = Literal[
    "common",
    "ugc",
    "short_series",
    "aigc",
    "old_film",
]
AigcVideoEnhancementStyle: TypeAlias = Literal["hd", "natural"]
AigcVideoEnhancementResolutionMode: TypeAlias = Literal["preset", "short_edge"]
AigcVideoEnhancementResolution: TypeAlias = Literal[
    "240p",
    "360p",
    "480p",
    "540p",
    "720p",
    "1080p",
    "2k",
    "4k",
    "8k",
]
AigcVideoEnhancementBitrateMode: TypeAlias = Literal["level", "custom"]
AigcVideoEnhancementBitrateLevel: TypeAlias = Literal["low", "medium", "high"]
AigcVideoEnhancementBitDepth: TypeAlias = Literal[8, 10, 12, 16]
AigcVideoFaceBlurMaskMode: TypeAlias = Literal["mosaic", "blur"]
AigcVideoFaceBlurMaskStrength: TypeAlias = Literal["low", "medium", "high"]


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


class AigcPromptLlmTargetConfig(SchemaModel):
    model: str = Field(..., min_length=1, max_length=255)
    system_prompt: str = Field(default="", max_length=12000)


class AigcPromptTextToImageTargetConfig(SchemaModel):
    model: str = Field(..., min_length=1, max_length=255)
    aspect_ratio: AigcImageAspectRatio
    size: AigcImageSize
    reference_image_count: Literal[0] = 0


class AigcPromptImageToImageTargetConfig(SchemaModel):
    model: str = Field(..., min_length=1, max_length=255)
    operation: AigcImageOperation
    aspect_ratio: AigcImageAspectRatio
    size: AigcImageToImageSize
    reference_image_count: int = Field(..., ge=0, le=10)


class AigcPromptVideoReferenceSummary(SchemaModel):
    source_node_id: str = Field(..., min_length=1, max_length=120)
    source_handle: Literal["image", "video", "audio"]
    target_handle: Literal[
        "first_frame",
        "last_frame",
        "reference_images",
        "reference_videos",
        "reference_audios",
    ]
    media_type: Literal["image", "video", "audio"]
    role: Literal[
        "first_frame",
        "last_frame",
        "reference_image",
        "reference_video",
        "reference_audio",
    ]
    ordinal: int = Field(..., ge=1, le=30)

    @model_validator(mode="after")
    def validate_role_mapping(self) -> "AigcPromptVideoReferenceSummary":
        expected = {
            "first_frame": ("image", "first_frame"),
            "last_frame": ("image", "last_frame"),
            "reference_images": ("image", "reference_image"),
            "reference_videos": ("video", "reference_video"),
            "reference_audios": ("audio", "reference_audio"),
        }[self.target_handle]
        if (
            self.source_handle != self.media_type
            or (self.media_type, self.role) != expected
        ):
            raise ValueError("video reference role does not match target_handle")
        return self


class AigcPromptVideoTargetConfig(SchemaModel):
    model: SeedanceModel
    generation_mode: AigcVideoGenerationMode
    task_type: SeedanceTaskType = SEEDANCE_DEFAULT_TASK_TYPE
    duration_seconds: int = Field(..., strict=True)
    aspect_ratio: SeedanceAspectRatio
    generate_audio: bool
    references: list[AigcPromptVideoReferenceSummary] = Field(
        default_factory=list,
        max_length=50,
    )

    @model_validator(mode="after")
    def validate_reference_order(self) -> "AigcPromptVideoTargetConfig":
        handle_order = {
            "first_frame": 0,
            "last_frame": 1,
            "reference_images": 2,
            "reference_videos": 3,
            "reference_audios": 4,
        }
        keys = [
            (handle_order[item.target_handle], item.ordinal)
            for item in self.references
        ]
        if keys != sorted(keys):
            raise ValueError("video references must use stable target order")
        for handle in handle_order:
            ordinals = [
                item.ordinal
                for item in self.references
                if item.target_handle == handle
            ]
            if ordinals != list(range(1, len(ordinals) + 1)):
                raise ValueError("video reference ordinals must be contiguous")
        validate_seedance_duration(self.model, self.duration_seconds)
        return self


AigcPromptTargetConfig: TypeAlias = (
    AigcPromptLlmTargetConfig
    | AigcPromptTextToImageTargetConfig
    | AigcPromptImageToImageTargetConfig
    | AigcPromptVideoTargetConfig
)


class AigcPromptSourceImage(SchemaModel):
    source_node_id: str = Field(..., min_length=1, max_length=120)
    source_handle: Literal["image"]
    target_handle: Literal["image", "edit_image"]
    asset_id: str = Field(..., min_length=1)
    run_id: str | None = Field(default=None, min_length=1)


class AigcPromptPipelineContext(SchemaModel):
    pipeline_id: str = Field(..., min_length=1)
    base_revision: int = Field(..., ge=0)
    definition_snapshot: "AigcPipelineDefinitionV2"
    source_image: AigcPromptSourceImage | None = None


class AigcPromptOptimizeRequest(SchemaModel):
    target_node_id: str = Field(..., min_length=1, max_length=120)
    target_type: AigcPromptOptimizationTargetType
    target_config: AigcPromptTargetConfig
    optimization_direction: str = Field(default="", max_length=2000)
    text: str = Field(default="", max_length=20000)
    reference_instructions: list[str] = Field(default_factory=list, max_length=10)
    pipeline_context: AigcPromptPipelineContext | None = None

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
        return values

    @model_validator(mode="after")
    def validate_prompt_context(self) -> "AigcPromptOptimizeRequest":
        if not self.text.strip() and not any(
            value.strip() for value in self.reference_instructions
        ):
            raise ValueError("prompt content must not be blank")
        expected_config = {
            "llm": AigcPromptLlmTargetConfig,
            "text_to_image": AigcPromptTextToImageTargetConfig,
            "image_to_image": AigcPromptImageToImageTargetConfig,
            "video_generation": AigcPromptVideoTargetConfig,
        }[self.target_type]
        if not isinstance(self.target_config, expected_config):
            raise ValueError("target_config does not match target_type")
        if self.target_type not in {"text_to_image", "image_to_image"}:
            if self.reference_instructions:
                raise ValueError(
                    "reference_instructions are only supported for image targets"
                )
        if self.pipeline_context is not None and self.target_type != "image_to_image":
            raise ValueError(
                "pipeline_context is only supported for image_to_image targets"
            )
        return self


class AigcImagePromptSection(SchemaModel):
    label: str = Field(..., min_length=1, max_length=80)
    content: str = Field(..., min_length=1, max_length=20000)

    @field_validator("label")
    @classmethod
    def validate_label(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("image prompt section label must not be blank")
        return normalized

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("image prompt section content must not be blank")
        return normalized


class AigcImagePromptSections(SchemaModel):
    sections: list[AigcImagePromptSection] = Field(..., min_length=1, max_length=20)


class AigcImagePromptLocalEditResult(SchemaModel):
    optimization_mode: Literal["local_edit"]
    optimized_text: str = Field(..., min_length=1, max_length=20000)
    optimized_reference_instructions: list[str] = Field(
        default_factory=list,
        max_length=10,
    )


class AigcImagePromptFullDesignResult(AigcImagePromptSections):
    optimization_mode: Literal["full_design"]
    optimized_reference_instructions: list[str] = Field(
        default_factory=list,
        max_length=10,
    )


AigcImagePromptOptimizationResult: TypeAlias = (
    AigcImagePromptLocalEditResult | AigcImagePromptFullDesignResult
)


class AigcSeedreamPromptOptimizationResult(SchemaModel):
    generation_type: AigcSeedreamGenerationType
    optimized_text: str = Field(..., min_length=1, max_length=20000)
    optimization_explanation: str = Field(..., min_length=1, max_length=2000)


class AigcPromptOptimizeResponse(SchemaModel):
    optimized_text: str = Field(default="", max_length=20000)
    optimized_reference_instructions: list[str] = Field(
        default_factory=list,
        max_length=10,
    )
    generation_type: AigcSeedreamGenerationType | None = None
    optimization_explanation: str = Field(default="", max_length=2000)

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
        return values

    @field_validator("optimization_explanation")
    @classmethod
    def reject_explanation_coordinate_tags(cls, value: str) -> str:
        if COORDINATE_TAG_PATTERN.search(value):
            raise ValueError("coordinate_tag_forbidden")
        return value


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


class TextConfig(TextInputConfig):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    upstream_text_override: str | None = Field(default=None, max_length=20000)
    generated_by_parser_node_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
        exclude_if=lambda value: value is None,
    )
    generated_item_index: int | None = Field(
        default=None,
        ge=0,
        lt=AIGC_JSON_PARSER_MAX_ITEMS,
        exclude_if=lambda value: value is None,
    )
    generated_from_run_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
        exclude_if=lambda value: value is None,
    )

    @field_validator("upstream_text_override")
    @classmethod
    def reject_override_coordinate_tags(cls, value: str | None) -> str | None:
        if value is not None and COORDINATE_TAG_PATTERN.search(value):
            raise ValueError("coordinate_tag_forbidden")
        return value

    @field_validator(
        "generated_by_parser_node_id",
        "generated_from_run_id",
    )
    @classmethod
    def strip_managed_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("managed text ids must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_managed_fields(self) -> "TextConfig":
        has_parser = self.generated_by_parser_node_id is not None
        has_index = self.generated_item_index is not None
        if has_parser != has_index:
            raise ValueError(
                "managed text parser id and item index must be provided together"
            )
        if self.generated_from_run_id is not None and not has_parser:
            raise ValueError("managed text run id requires a managed parser key")
        return self


class ImageConfig(ImageInputConfig):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    upstream_bbox: ImageBboxAnnotation | None = None
    upstream_bbox_asset_id: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def validate_upstream_bbox_asset_binding(self) -> "ImageConfig":
        if (self.upstream_bbox is None) != (
            self.upstream_bbox_asset_id is None
        ):
            raise ValueError("upstream_bbox_asset_mismatch")
        return self


class VideoConfig(VideoInputConfig):
    title: str | None = Field(default=None, min_length=1, max_length=120)


class AudioConfig(AudioInputConfig):
    title: str | None = Field(default=None, min_length=1, max_length=120)


class LlmConfig(SchemaModel):
    model: str = Field(default=AIGC_DEFAULT_TEXT_MODEL, min_length=1, max_length=255)
    system_prompt: str = Field(default="", max_length=12000)
    temperature: float = Field(default=0.7, ge=0, le=2)


class JsonParserConfig(SchemaModel):
    json_path: str = Field(
        default=AIGC_JSON_PARSER_DEFAULT_PATH,
        min_length=1,
        max_length=500,
    )

    @field_validator("json_path")
    @classmethod
    def validate_json_path(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("json_parser_invalid_path")
        from backend.app.services.aigc_json_parser import compile_json_path

        compile_json_path(normalized)
        return normalized


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
        if self.operation == "image_to_image":
            if self.size == "auto":
                raise ValueError("auto size is only supported for layer_decomposition")
            return self
        if self.operation == "layer_decomposition" and self.size == "auto":
            return self
        if not is_seedream_image_preset_size(self.size):
            raise ValueError(
                f"{self.operation} only supports 1K, 1.5K, or 2K image sizes"
            )
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


class VideoEnhancementConfig(SchemaModel):
    tool_version: AigcVideoEnhancementToolVersion = "standard"
    scene: AigcVideoEnhancementScene | None = "aigc"
    enhance_style: AigcVideoEnhancementStyle = "hd"
    resolution_mode: AigcVideoEnhancementResolutionMode = "preset"
    resolution: AigcVideoEnhancementResolution | None = "1080p"
    resolution_limit: StrictInt | None = Field(default=None, ge=128, le=4320)
    fps: StrictInt | None = Field(default=None, ge=15, le=120)
    bitrate_mode: AigcVideoEnhancementBitrateMode | None = "level"
    bitrate_level: AigcVideoEnhancementBitrateLevel | None = "medium"
    bitrate: StrictInt | None = Field(default=None, ge=10, le=150000)
    bit_depth: AigcVideoEnhancementBitDepth = 8

    @model_validator(mode="before")
    @classmethod
    def default_mode_specific_fields(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        if normalized.get("tool_version") == "professional":
            normalized.setdefault("scene", None)
        if normalized.get("resolution_mode") == "short_edge":
            normalized.setdefault("resolution", None)
        if normalized.get("bitrate_mode") == "custom":
            normalized.setdefault("bitrate_level", None)
        if normalized.get("bit_depth") == 16:
            normalized.setdefault("bitrate_mode", None)
            normalized.setdefault("bitrate_level", None)
            normalized.setdefault("bitrate", None)
        return normalized

    @model_validator(mode="after")
    def validate_parameter_combinations(self) -> "VideoEnhancementConfig":
        if self.resolution_mode == "preset":
            if self.resolution is None or self.resolution_limit is not None:
                raise ValueError(
                    "preset resolution mode requires resolution only"
                )
        elif self.resolution is not None or self.resolution_limit is None:
            raise ValueError(
                "short_edge resolution mode requires resolution_limit only"
            )

        if self.tool_version == "standard":
            if self.scene is None:
                raise ValueError("standard tool version requires scene")
            if self.bit_depth != 8:
                raise ValueError("bit_depth above 8 requires professional")
        elif self.scene is not None:
            raise ValueError("professional tool version does not accept scene")

        if self.bit_depth == 16:
            if self.tool_version != "professional":
                raise ValueError("16-bit output requires professional")
            if any(
                value is not None
                for value in (
                    self.bitrate_mode,
                    self.bitrate_level,
                    self.bitrate,
                )
            ):
                raise ValueError("16-bit output does not accept bitrate settings")
        elif self.bitrate_mode == "level":
            if self.bitrate_level is None or self.bitrate is not None:
                raise ValueError("level bitrate mode requires bitrate_level only")
        elif self.bitrate_mode == "custom":
            if self.bitrate_level is not None or self.bitrate is None:
                raise ValueError("custom bitrate mode requires bitrate only")
        else:
            raise ValueError("bitrate_mode is required for non-16-bit output")
        return self

    def validate_input_duration(self, duration_seconds: float) -> None:
        if (
            self.bit_depth == 16
            and duration_seconds > VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS
        ):
            raise ValueError("16-bit input duration must not exceed 40 seconds")


class VideoFaceBlurConfig(SchemaModel):
    mask_mode: AigcVideoFaceBlurMaskMode = "mosaic"
    mask_strength: AigcVideoFaceBlurMaskStrength = "medium"


class VideoSubtitleExtractionConfig(SchemaModel):
    mode: Literal["Subtitle"] = "Subtitle"


MultiTrackKind: TypeAlias = Literal["video", "audio", "image", "text", "subtitle"]
MultiTrackFrameRate: TypeAlias = Literal[24, 25, 30, 50, 60]


class MultiTrackCanvas(SchemaModel):
    mode: Literal["auto", "custom"] = "auto"
    width: int | None = None
    height: int | None = None
    background_color: str = "#000000FF"


class MultiTrackOutput(SchemaModel):
    format: Literal["mp4"] = "mp4"
    fps: MultiTrackFrameRate = 30


class MultiTrackSource(SchemaModel):
    source_node_id: str
    source_handle: str


class MultiTrackTimeRange(SchemaModel):
    start_ms: int
    end_ms: int


class MultiTrackTransform(SchemaModel):
    x: float
    y: float
    width: float
    height: float
    rotation: float = 0


class MultiTrackTextStyle(SchemaModel):
    font_type: str | None = None
    font_size: float = 48
    color: str = "#FFFFFFFF"
    bold: bool = False
    italic: bool = False
    underline: bool = False
    background_color: str = "#00000000"

    @field_validator("font_type")
    @classmethod
    def validate_font_type(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if (
            len(value) > MULTI_TRACK_FONT_TYPE_MAX_LENGTH
            or value != value.strip()
            or "\\" in value
            or MULTI_TRACK_FONT_CONTROL_PATTERN.search(value)
        ):
            raise ValueError("invalid_font_type")
        if value in MEDIAKIT_FONT_PRESET_IDS:
            return value
        try:
            parsed = urlsplit(value)
            _ = parsed.port
        except ValueError as exc:
            raise ValueError("invalid_font_type") from exc
        hostname = (parsed.hostname or "").lower().removesuffix(".")
        try:
            ip_address(hostname)
        except ValueError:
            is_ip_literal = False
        else:
            is_ip_literal = True
        is_local_hostname = (
            hostname == "localhost"
            or hostname.endswith(".localhost")
            or hostname.endswith(MULTI_TRACK_LOCAL_HOST_SUFFIXES)
        )
        if (
            parsed.scheme.lower() != "https"
            or not hostname
            or is_ip_literal
            or _is_multitrack_numeric_hostname(hostname)
            or is_local_hostname
            or "@" in parsed.netloc
            or not MULTI_TRACK_FONT_FILE_PATTERN.search(parsed.path)
        ):
            raise ValueError("invalid_font_type")
        return value


class MultiTrackTransition(SchemaModel):
    type: Literal["fade"] = "fade"
    duration_ms: int


class MultiTrackElementBase(SchemaModel):
    id: str
    target_time: MultiTrackTimeRange
    loop: bool = False


class MultiTrackVideoElement(MultiTrackElementBase):
    type: Literal["video"]
    source: MultiTrackSource
    source_trim: MultiTrackTimeRange | None = None
    transform: MultiTrackTransform
    speed: float = 1
    volume: float = 1
    fade_in_ms: int = 0
    fade_out_ms: int = 0
    transition: MultiTrackTransition | None = None


class MultiTrackAudioElement(MultiTrackElementBase):
    type: Literal["audio"]
    source: MultiTrackSource
    source_trim: MultiTrackTimeRange | None = None
    speed: float = 1
    volume: float = 1
    fade_in_ms: int = 0
    fade_out_ms: int = 0


class MultiTrackImageElement(MultiTrackElementBase):
    type: Literal["image"]
    source: MultiTrackSource
    transform: MultiTrackTransform


class MultiTrackTextElement(MultiTrackElementBase):
    type: Literal["text"]
    source: MultiTrackSource | None = None
    inline_text: str | None = None
    transform: MultiTrackTransform
    style: MultiTrackTextStyle = Field(default_factory=MultiTrackTextStyle)


class MultiTrackSubtitleElement(MultiTrackElementBase):
    type: Literal["subtitle"]
    asset_id: str | None = None
    transform: MultiTrackTransform
    style: MultiTrackTextStyle = Field(default_factory=MultiTrackTextStyle)


MultiTrackElement: TypeAlias = (
    MultiTrackVideoElement
    | MultiTrackAudioElement
    | MultiTrackImageElement
    | MultiTrackTextElement
    | MultiTrackSubtitleElement
)


class MultiTrackTrack(SchemaModel):
    id: str
    name: str
    type: MultiTrackKind
    order: int = 0
    hidden: bool = False
    muted: bool = False
    elements: list[MultiTrackElement] = Field(default_factory=list)


class MultiTrackValidationIssue(SchemaModel):
    code: str
    path: str
    message: str
    track_id: str | None = None
    element_id: str | None = None


class MultiTrackEditConfig(SchemaModel):
    canvas: MultiTrackCanvas = Field(default_factory=MultiTrackCanvas)
    output: MultiTrackOutput = Field(default_factory=MultiTrackOutput)
    tracks: list[MultiTrackTrack] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_project(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        return _normalize_multi_track_payload(value)


def _round_milliseconds(value: object) -> object:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return value
    return math.floor(value + 0.5)


def _normalize_multi_track_payload(value: dict[str, object]) -> dict[str, object]:
    normalized = deepcopy(value)
    tracks = normalized.get("tracks")
    if not isinstance(tracks, list):
        return normalized
    for track_index, track in enumerate(tracks):
        if not isinstance(track, dict):
            continue
        if isinstance(track.get("id"), str):
            track["id"] = track["id"].strip()
        if isinstance(track.get("name"), str):
            track["name"] = track["name"].strip()
        track["order"] = track_index
        elements = track.get("elements")
        if not isinstance(elements, list):
            continue
        for element in elements:
            if not isinstance(element, dict):
                continue
            if isinstance(element.get("id"), str):
                element["id"] = element["id"].strip()
            for range_key in ("target_time", "source_trim"):
                time_range = element.get(range_key)
                if not isinstance(time_range, dict):
                    continue
                for field in ("start_ms", "end_ms"):
                    if field in time_range:
                        time_range[field] = _round_milliseconds(time_range[field])
            for field in ("fade_in_ms", "fade_out_ms"):
                if field in element:
                    element[field] = _round_milliseconds(element[field])
            transition = element.get("transition")
            if isinstance(transition, dict) and "duration_ms" in transition:
                transition["duration_ms"] = _round_milliseconds(
                    transition["duration_ms"]
                )
    return normalized


def normalize_multi_track_edit_config(
    config: MultiTrackEditConfig | dict[str, object],
) -> MultiTrackEditConfig:
    payload = (
        config.model_dump(mode="python")
        if isinstance(config, MultiTrackEditConfig)
        else config
    )
    return MultiTrackEditConfig.model_validate(payload)


def validate_multi_track_edit_config(
    config: MultiTrackEditConfig | dict[str, object],
) -> list[MultiTrackValidationIssue]:
    project = normalize_multi_track_edit_config(config)
    issues: list[MultiTrackValidationIssue] = []

    def add(
        code: str,
        path: str,
        message: str,
        *,
        track: MultiTrackTrack | None = None,
        element: MultiTrackElement | None = None,
    ) -> None:
        issues.append(
            MultiTrackValidationIssue(
                code=code,
                path=path,
                message=message,
                track_id=track.id if track else None,
                element_id=element.id if element else None,
            )
        )

    canvas = project.canvas
    if canvas.mode == "custom" and (
        canvas.width is None
        or canvas.height is None
        or not MULTI_TRACK_CANVAS_MIN_SIZE
        <= canvas.width
        <= MULTI_TRACK_CANVAS_MAX_SIZE
        or not MULTI_TRACK_CANVAS_MIN_SIZE
        <= canvas.height
        <= MULTI_TRACK_CANVAS_MAX_SIZE
    ):
        add("invalid_canvas_size", "canvas", "custom canvas size is invalid")
    if not MULTI_TRACK_RGBA_PATTERN.fullmatch(canvas.background_color):
        add(
            "invalid_background_color",
            "canvas.background_color",
            "background color must be #RRGGBBAA",
        )
    if len(project.tracks) > MULTI_TRACK_MAX_TRACKS:
        add("track_limit_exceeded", "tracks", "track count exceeds 20")

    track_ids = [track.id for track in project.tracks]
    if len(track_ids) != len(set(track_ids)):
        add("duplicate_track_id", "tracks", "track ids must be unique")
    all_elements = [
        element for track in project.tracks for element in track.elements
    ]
    if len(all_elements) > MULTI_TRACK_MAX_ELEMENTS:
        add("element_limit_exceeded", "tracks", "element count exceeds 200")
    element_ids = [element.id for element in all_elements]
    if len(element_ids) != len(set(element_ids)):
        add("duplicate_element_id", "tracks", "element ids must be unique")
    visible_tracks = [track for track in project.tracks if not track.hidden]
    if not visible_tracks:
        add(
            "visible_track_required",
            "tracks",
            "at least one non-hidden track is required",
        )
    subtitle_tracks = [
        track for track in project.tracks if track.type == "subtitle"
    ]
    if len(subtitle_tracks) > MULTI_TRACK_MAX_SUBTITLE_TRACKS:
        add(
            "subtitle_track_limit_exceeded",
            "tracks",
            "subtitle track count exceeds 10",
        )

    valid_visible_elements = 0
    for track_index, track in enumerate(project.tracks):
        track_path = f"tracks.{track_index}"
        if track.type == "subtitle" and len(track.elements) > 1:
            add(
                "subtitle_track_element_limit",
                f"{track_path}.elements",
                "subtitle tracks allow one element",
                track=track,
            )
        sorted_elements = sorted(
            track.elements,
            key=lambda item: (item.target_time.start_ms, item.target_time.end_ms),
        )
        element_issue_counts: dict[str, int] = {}
        for element_index, element in enumerate(track.elements):
            before = len(issues)
            element_path = f"{track_path}.elements.{element_index}"
            if element.type != track.type:
                add(
                    "track_element_type_mismatch",
                    f"{element_path}.type",
                    "element type must match track type",
                    track=track,
                    element=element,
                )
            _validate_multi_track_element(
                project,
                track,
                element,
                element_path,
                add,
            )
            element_issue_counts[element.id] = len(issues) - before
        for previous, current in zip(sorted_elements, sorted_elements[1:]):
            overlap = previous.target_time.end_ms - current.target_time.start_ms
            if overlap <= 0:
                continue
            transition = (
                previous.transition
                if isinstance(previous, MultiTrackVideoElement)
                else None
            )
            legal_transition = (
                isinstance(current, MultiTrackVideoElement)
                and transition is not None
                and transition.duration_ms >= overlap
                and _transition_is_valid(previous, current)
            )
            if not legal_transition:
                add(
                    "track_overlap",
                    f"{track_path}.elements",
                    "elements on the same track overlap",
                    track=track,
                    element=previous,
                )
        if not track.hidden:
            valid_visible_elements += sum(
                element_issue_counts.get(element.id, 0) == 0
                for element in track.elements
            )
    if valid_visible_elements == 0:
        add(
            "valid_element_required",
            "tracks",
            "at least one valid element on a visible track is required",
        )
    return issues


def _validate_multi_track_element(
    project: MultiTrackEditConfig,
    track: MultiTrackTrack,
    element: MultiTrackElement,
    path: str,
    add: object,
) -> None:
    emit = add
    target = element.target_time
    duration = target.end_ms - target.start_ms
    if target.start_ms < 0 or target.end_ms <= target.start_ms:
        emit(
            "invalid_target_time",
            f"{path}.target_time",
            "target time must be a non-negative increasing integer range",
            track=track,
            element=element,
        )
    if isinstance(element, (MultiTrackVideoElement, MultiTrackAudioElement)):
        speed_is_valid = math.isfinite(element.speed) and 0.1 <= element.speed <= 4
        if not speed_is_valid:
            emit(
                "invalid_speed",
                f"{path}.speed",
                "speed must be between 0.1 and 4",
                track=track,
                element=element,
            )
        if element.volume < 0:
            emit(
                "invalid_volume",
                f"{path}.volume",
                "volume must be non-negative",
                track=track,
                element=element,
            )
        if (
            element.fade_in_ms < 0
            or element.fade_out_ms < 0
            or element.fade_in_ms > duration
            or element.fade_out_ms > duration
        ):
            emit(
                "invalid_fade",
                path,
                "fade duration must fit within the element",
                track=track,
                element=element,
            )
        trim = element.source_trim
        if trim is not None:
            trim_duration = trim.end_ms - trim.start_ms
            if trim.start_ms < 0 or trim.end_ms <= trim.start_ms:
                emit(
                    "invalid_source_trim",
                    f"{path}.source_trim",
                    "source trim must be a non-negative increasing range",
                    track=track,
                    element=element,
                )
            elif (
                speed_is_valid
                and not element.loop
                and abs(trim_duration / element.speed - duration) > 1
            ):
                emit(
                    "duration_mismatch",
                    path,
                    "source trim adjusted by speed must match target duration",
                    track=track,
                    element=element,
                )
    if isinstance(
        element,
        (
            MultiTrackVideoElement,
            MultiTrackImageElement,
            MultiTrackTextElement,
            MultiTrackSubtitleElement,
        ),
    ):
        _validate_multi_track_transform(project, track, element, path, emit)
    if isinstance(element, MultiTrackTextElement):
        has_source = (
            element.source is not None
            and bool(element.source.source_node_id.strip())
            and bool(element.source.source_handle.strip())
        )
        if not has_source and not (element.inline_text or "").strip():
            emit(
                "text_source_required",
                path,
                "text requires an upstream source or inline text",
                track=track,
                element=element,
            )
        _validate_multi_track_style(track, element, path, emit)
    if isinstance(element, MultiTrackSubtitleElement):
        if not (element.asset_id or "").strip():
            emit(
                "subtitle_asset_required",
                f"{path}.asset_id",
                "subtitle requires an SRT asset",
                track=track,
                element=element,
            )
        _validate_multi_track_style(track, element, path, emit)
    if isinstance(element, MultiTrackVideoElement) and element.transition is not None:
        if (
            element.transition.duration_ms <= 0
            or element.transition.duration_ms > duration
        ):
            emit(
                "invalid_transition",
                f"{path}.transition",
                "transition duration must be positive",
                track=track,
                element=element,
            )


def _validate_multi_track_transform(
    project: MultiTrackEditConfig,
    track: MultiTrackTrack,
    element: (
        MultiTrackVideoElement
        | MultiTrackImageElement
        | MultiTrackTextElement
        | MultiTrackSubtitleElement
    ),
    path: str,
    emit: object,
) -> None:
    value = element.transform
    invalid = value.width <= 0 or value.height <= 0 or value.x < 0 or value.y < 0
    canvas = project.canvas
    if (
        not invalid
        and canvas.mode == "custom"
        and canvas.width is not None
        and canvas.height is not None
    ):
        invalid = (
            value.x + value.width > canvas.width
            or value.y + value.height > canvas.height
        )
    if invalid:
        emit(
            "transform_out_of_canvas",
            f"{path}.transform",
            "transform must fit within the canvas",
            track=track,
            element=element,
        )


def _validate_multi_track_style(
    track: MultiTrackTrack,
    element: MultiTrackTextElement | MultiTrackSubtitleElement,
    path: str,
    emit: object,
) -> None:
    style = element.style
    if (
        style.font_size <= 0
        or not MULTI_TRACK_RGBA_PATTERN.fullmatch(style.color)
        or not MULTI_TRACK_RGBA_PATTERN.fullmatch(style.background_color)
    ):
        emit(
            "invalid_text_style",
            f"{path}.style",
            "text style values are invalid",
            track=track,
            element=element,
        )


def _transition_is_valid(
    previous: MultiTrackVideoElement,
    current: MultiTrackVideoElement,
) -> bool:
    transition = previous.transition
    if transition is None or transition.duration_ms <= 0:
        return False
    return transition.duration_ms <= min(
        previous.target_time.end_ms - previous.target_time.start_ms,
        current.target_time.end_ms - current.target_time.start_ms,
    )


class TextOutputConfig(SchemaModel):
    title: str = Field(default="文本结果", min_length=1, max_length=120)


class ImageOutputConfig(SchemaModel):
    title: str = Field(default="图片结果", min_length=1, max_length=120)


class VideoOutputConfig(SchemaModel):
    title: str = Field(default="视频结果", min_length=1, max_length=120)


class AigcNodeBase(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str = Field(..., min_length=1, max_length=120)
    custom_name: str | None = Field(default=None, max_length=120)
    position: AigcPoint
    size: AigcSize

    @field_validator("id")
    @classmethod
    def strip_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("node id must not be blank")
        return stripped

    @field_validator("custom_name", mode="before")
    @classmethod
    def normalize_custom_name(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            return None
        if any(character in "\r\n" or ord(character) < 32 for character in stripped):
            raise ValueError("custom_name must be a single line without control characters")
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


class TextNode(AigcNodeBase):
    type: Literal[AigcNodeType.TEXT]
    config: TextConfig = Field(default_factory=TextConfig)


class ImageNode(AigcNodeBase):
    type: Literal[AigcNodeType.IMAGE]
    config: ImageConfig = Field(default_factory=ImageConfig)


class VideoNode(AigcNodeBase):
    type: Literal[AigcNodeType.VIDEO]
    config: VideoConfig = Field(default_factory=VideoConfig)


class AudioNode(AigcNodeBase):
    type: Literal[AigcNodeType.AUDIO]
    config: AudioConfig = Field(default_factory=AudioConfig)


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


class VideoEnhancementNode(AigcNodeBase):
    type: Literal[AigcNodeType.VIDEO_ENHANCEMENT]
    config: VideoEnhancementConfig = Field(default_factory=VideoEnhancementConfig)


class VideoFaceBlurNode(AigcNodeBase):
    type: Literal[AigcNodeType.VIDEO_FACE_BLUR]
    config: VideoFaceBlurConfig = Field(default_factory=VideoFaceBlurConfig)


class VideoSubtitleExtractionNode(AigcNodeBase):
    type: Literal[AigcNodeType.VIDEO_SUBTITLE_EXTRACTION]
    config: VideoSubtitleExtractionConfig = Field(
        default_factory=VideoSubtitleExtractionConfig
    )


class MultiTrackEditNode(AigcNodeBase):
    type: Literal[AigcNodeType.MULTI_TRACK_EDIT]
    config: MultiTrackEditConfig = Field(default_factory=MultiTrackEditConfig)


class JsonParserNode(AigcNodeBase):
    type: Literal[AigcNodeType.JSON_PARSER]
    config: JsonParserConfig = Field(default_factory=JsonParserConfig)


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
    | VideoEnhancementNode
    | VideoFaceBlurNode
    | VideoSubtitleExtractionNode
    | LayerCanvasNode
    | LayerCompositeNode
    | TextOutputNode
    | ImageOutputNode
    | VideoOutputNode,
    Field(discriminator="type"),
]

AigcV2Node: TypeAlias = Annotated[
    TextNode
    | ImageNode
    | VideoNode
    | AudioNode
    | LlmNode
    | TextToImageNode
    | ImageToImageNode
    | VideoGenerationNode
    | VideoEnhancementNode
    | VideoFaceBlurNode
    | VideoSubtitleExtractionNode
    | MultiTrackEditNode
    | JsonParserNode
    | LayerCanvasNode
    | LayerCompositeNode,
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
        default=AIGC_LEGACY_DEFINITION_SCHEMA_VERSION,
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


class AigcPipelineDefinitionV2(SchemaModel):
    schema_version: Literal[2] = Field(
        default=AIGC_DEFINITION_SCHEMA_VERSION,
        alias="schemaVersion",
    )
    nodes: list[AigcV2Node] = Field(default_factory=list, max_length=AIGC_MAX_NODES)
    edges: list[AigcEdge] = Field(default_factory=list, max_length=AIGC_MAX_EDGES)
    viewport: AigcViewport = Field(default_factory=AigcViewport)

    @model_validator(mode="after")
    def validate_unique_ids_and_endpoints(self) -> "AigcPipelineDefinitionV2":
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
        managed_keys = [
            (
                node.config.generated_by_parser_node_id,
                node.config.generated_item_index,
            )
            for node in self.nodes
            if isinstance(node, TextNode)
            and node.config.generated_by_parser_node_id is not None
            and node.config.generated_item_index is not None
        ]
        if len(managed_keys) != len(set(managed_keys)):
            raise ValueError("managed text keys must be unique")
        return self


class AigcPortDefinition(SchemaModel):
    id: str
    label: str
    type: AigcPortType
    required: bool = True
    multiple: bool = False
    max_connections: int = Field(default=1, ge=1)
    system_only: bool = False
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
    system_only: bool = False,
    modes: tuple[AigcVideoGenerationMode, ...] = (),
) -> AigcPortDefinition:
    return AigcPortDefinition(
        id=port_id,
        label=label,
        type=port_type,
        required=required,
        multiple=multiple,
        max_connections=max_connections,
        system_only=system_only,
        modes=list(modes),
    )


AIGC_V2_MODALITY_NODE_REGISTRY: tuple[AigcNodeRegistryItem, ...] = (
    AigcNodeRegistryItem(
        type=AigcNodeType.TEXT,
        label="文本节点",
        category=AigcNodeCategory.MODALITY,
        executable=False,
        inputs=[
            _port(
                "text",
                "文本",
                AigcPortType.TEXT,
                required=False,
            )
        ],
        outputs=[_port("text", "文本", AigcPortType.TEXT)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.IMAGE,
        label="图片节点",
        category=AigcNodeCategory.MODALITY,
        executable=False,
        inputs=[
            _port(
                "image",
                "图片",
                AigcPortType.IMAGE_ASSET,
                required=False,
            )
        ],
        outputs=[_port("image", "图片", AigcPortType.IMAGE_ASSET)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.VIDEO,
        label="视频节点",
        category=AigcNodeCategory.MODALITY,
        executable=False,
        inputs=[
            _port(
                "video",
                "视频",
                AigcPortType.VIDEO_ASSET,
                required=False,
            )
        ],
        outputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.AUDIO,
        label="音频节点",
        category=AigcNodeCategory.MODALITY,
        executable=False,
        inputs=[
            _port(
                "audio",
                "音频",
                AigcPortType.AUDIO_ASSET,
                required=False,
            )
        ],
        outputs=[_port("audio", "音频", AigcPortType.AUDIO_ASSET)],
    ),
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
        inputs=[
            _port("prompt", "提示词", AigcPortType.TEXT),
            _port(
                "image",
                "图片",
                AigcPortType.IMAGE_ASSET,
                required=False,
            ),
        ],
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
        type=AigcNodeType.VIDEO_ENHANCEMENT,
        label="视频画质增强",
        category=AigcNodeCategory.MODEL,
        executable=True,
        inputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
        outputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.VIDEO_FACE_BLUR,
        label="视频人脸打码",
        category=AigcNodeCategory.MODEL,
        executable=True,
        inputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
        outputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
    ),
    AigcNodeRegistryItem(
        type=AigcNodeType.VIDEO_SUBTITLE_EXTRACTION,
        label="视频字幕提取",
        category=AigcNodeCategory.MODEL,
        executable=True,
        inputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
        outputs=[_port("subtitle", "字幕", AigcPortType.SUBTITLE_ASSET)],
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
            _port(
                "replacement",
                "替换图层",
                AigcPortType.EDITED_LAYER,
                required=False,
            ),
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

MULTI_TRACK_EDIT_NODE_REGISTRY_ITEM = AigcNodeRegistryItem(
    type=AigcNodeType.MULTI_TRACK_EDIT,
    label="多轨剪辑",
    category=AigcNodeCategory.CONTROL,
    executable=True,
    inputs=[
        _port(
            "videos",
            "视频",
            AigcPortType.VIDEO_ASSET,
            required=False,
            multiple=True,
            max_connections=30,
        ),
        _port(
            "images",
            "图片",
            AigcPortType.IMAGE_ASSET,
            required=False,
            multiple=True,
            max_connections=50,
        ),
        _port(
            "audios",
            "音频",
            AigcPortType.AUDIO_ASSET,
            required=False,
            multiple=True,
            max_connections=30,
        ),
        _port(
            "texts",
            "文本",
            AigcPortType.TEXT,
            required=False,
            multiple=True,
            max_connections=30,
        ),
        _port(
            "subtitles",
            "字幕",
            AigcPortType.SUBTITLE_ASSET,
            required=False,
            multiple=True,
            max_connections=10,
        ),
    ],
    outputs=[_port("video", "视频", AigcPortType.VIDEO_ASSET)],
)

JSON_PARSER_NODE_REGISTRY_ITEM = AigcNodeRegistryItem(
    type=AigcNodeType.JSON_PARSER,
    label="JSON 解析器",
    category=AigcNodeCategory.CONTROL,
    executable=True,
    inputs=[_port("text", "文本", AigcPortType.TEXT)],
    outputs=[
        _port(
            "items",
            "文本项",
            AigcPortType.TEXT,
            required=False,
            multiple=True,
            max_connections=AIGC_JSON_PARSER_MAX_ITEMS,
            system_only=True,
        )
    ],
)

AIGC_V2_NODE_REGISTRY: tuple[AigcNodeRegistryItem, ...] = (
    *AIGC_V2_MODALITY_NODE_REGISTRY,
    *(
        item
        for item in AIGC_NODE_REGISTRY
        if item.category in {AigcNodeCategory.MODEL, AigcNodeCategory.CONTROL}
    ),
    MULTI_TRACK_EDIT_NODE_REGISTRY_ITEM,
    JSON_PARSER_NODE_REGISTRY_ITEM,
)


class AigcNodeRegistryResponse(SchemaModel):
    schema_version: Literal[2] = AIGC_DEFINITION_SCHEMA_VERSION
    nodes: list[AigcNodeRegistryItem] = Field(
        default_factory=lambda: deepcopy(list(AIGC_V2_NODE_REGISTRY))
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
    definition: AigcPipelineDefinition | AigcPipelineDefinitionV2 = Field(
        default_factory=AigcPipelineDefinitionV2
    )


class AigcPipelineTemplateUpdate(AigcPipelineTemplateCreate):
    expected_revision: int = Field(..., ge=0)


class AigcPipelineTemplate(AigcPipelineTemplateCreate):
    definition: AigcPipelineDefinitionV2
    id: str = Field(default_factory=lambda: str(uuid4()))
    revision: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @field_validator("definition", mode="before")
    @classmethod
    def normalize_active_definition(cls, value: object) -> object:
        return _normalize_active_aigc_definition(value)


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
    definition: AigcPipelineDefinition | AigcPipelineDefinitionV2 = Field(
        default_factory=AigcPipelineDefinitionV2
    )
    source_template_id: str | None = None
    source_template_revision: int | None = Field(default=None, ge=0)


class AigcPipelineUpdate(SchemaModel):
    expected_revision: int = Field(..., ge=0)
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    definition: AigcPipelineDefinition | AigcPipelineDefinitionV2

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


class AigcThumbnailMediaKind(str, Enum):
    IMAGE = "image"
    VIDEO = "video"


class AigcPipelineThumbnailSource(str, Enum):
    PINNED = "pinned"
    LATEST_OUTPUT = "latest_output"


class AigcPipelineThumbnail(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    mime_type: str = Field(..., min_length=1)
    kind: AigcThumbnailMediaKind
    source: AigcPipelineThumbnailSource
    url: str = Field(..., min_length=1)


class AigcPipelineThumbnailCandidate(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    run_id: str = Field(..., min_length=1)
    node_id: str = Field(..., min_length=1)
    mime_type: str = Field(..., min_length=1)
    kind: AigcThumbnailMediaKind
    url: str = Field(..., min_length=1)
    created_at: datetime


class AigcPipelineThumbnailUpdate(SchemaModel):
    asset_id: str | None = Field(default=None, min_length=1)

    @field_validator("asset_id", mode="before")
    @classmethod
    def strip_asset_id(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        if not stripped:
            raise ValueError("asset_id must not be blank")
        return stripped


class AigcPipeline(AigcPipelineCreate):
    definition: AigcPipelineDefinitionV2
    id: str = Field(default_factory=lambda: str(uuid4()))
    revision: int = Field(default=0, ge=0)
    latest_run_status: AigcPipelineRunStatus | None = None
    thumbnail_asset_id: str | None = None
    thumbnail: AigcPipelineThumbnail | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @field_validator("definition", mode="before")
    @classmethod
    def normalize_active_definition(cls, value: object) -> object:
        return _normalize_active_aigc_definition(value)


def _normalize_active_aigc_definition(value: object) -> object:
    from .aigc_definition_migration import migrate_aigc_definition_v2

    if isinstance(value, BaseModel):
        value = value.model_dump(mode="json", by_alias=True)
    if isinstance(value, dict):
        value = dict(value)
        if "schema_version" in value and "schemaVersion" not in value:
            value["schemaVersion"] = value.pop("schema_version")
        edges = value.get("edges")
        if isinstance(edges, list):
            for edge in edges:
                if not isinstance(edge, dict):
                    continue
                for source, target in (
                    ("source_node_id", "sourceNodeId"),
                    ("source_handle", "sourceHandle"),
                    ("target_node_id", "targetNodeId"),
                    ("target_handle", "targetHandle"),
                ):
                    if source in edge and target not in edge:
                        edge[target] = edge.pop(source)
        return migrate_aigc_definition_v2(value)
    return value


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
    metadata: dict[str, JsonValue] = Field(default_factory=dict)


class AigcJsonParserItem(SchemaModel):
    index: int = Field(..., ge=0, lt=AIGC_JSON_PARSER_MAX_ITEMS)
    text: str
    summary: str = Field(..., min_length=64, max_length=64)


class AigcTaskResult(SchemaModel):
    kind: AigcResultKind = AigcResultKind.NONE
    metadata: dict[str, JsonValue] = Field(default_factory=dict)
    naming: AigcGeneratedMediaNamingResult | None = None
    text: str | None = None
    text_digest: str | None = Field(default=None, min_length=64, max_length=64)
    items: list[AigcJsonParserItem] = Field(
        default_factory=list,
        max_length=AIGC_JSON_PARSER_MAX_ITEMS,
    )
    assets: list[AigcResultAsset] = Field(default_factory=list)
    layer_set: AigcLayerSet | None = None
    image_layer: AigcImageLayer | None = None
    edited_layer: AigcEditedLayer | None = None

    @model_validator(mode="after")
    def validate_result_shape(self) -> "AigcTaskResult":
        if self.kind == AigcResultKind.TEXT and self.text is None:
            raise ValueError("text results require text")
        if self.kind == AigcResultKind.TEXT_ITEMS:
            if [item.index for item in self.items] != list(range(len(self.items))):
                raise ValueError("text item indexes must be contiguous")
        elif self.items:
            raise ValueError("only text item results can include items")
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
    definition_snapshot: AigcPipelineDefinition | AigcPipelineDefinitionV2
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


AigcPromptPipelineContext.model_rebuild()
AigcPromptOptimizeRequest.model_rebuild()
