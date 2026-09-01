from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import Field, StrictInt, field_validator, model_validator

from .asset import Asset
from .common import SchemaModel, utc_now
from .enums import ImageGenerationSize, ImageLayerDecompositionSize, ImageOutputFormat, Status
from .image_generation import COORDINATE_TAG_PATTERN, ImageBboxAnnotation


BoundingBox = tuple[StrictInt, StrictInt, StrictInt, StrictInt]


class ImageLayerCreate(SchemaModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    set_id: str = Field(..., min_length=1)
    asset_id: str = Field(..., min_length=1)
    z_index: int = Field(..., ge=1, le=16)
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=4000)
    bbox_absolute: BoundingBox
    bbox_normalized: BoundingBox
    visible: bool = True
    x: float
    y: float
    scale: float = Field(default=1.0, ge=0.05, le=20)

    @model_validator(mode="after")
    def validate_bounding_boxes(self) -> "ImageLayerCreate":
        ax1, ay1, ax2, ay2 = self.bbox_absolute
        if not (0 <= ax1 < ax2 and 0 <= ay1 < ay2):
            raise ValueError("absolute bbox requires non-negative exclusive bounds")
        nx1, ny1, nx2, ny2 = self.bbox_normalized
        if not (
            0 <= nx1 < nx2 <= 1000
            and 0 <= ny1 < ny2 <= 1000
        ):
            raise ValueError("normalized bbox requires exclusive bounds from 0 to 1000")
        return self


class ImageLayer(ImageLayerCreate):
    pass


class ImageLayerUpdate(SchemaModel):
    id: str = Field(..., min_length=1)
    z_index: int = Field(..., ge=1, le=16)
    visible: bool
    x: float
    y: float
    scale: float = Field(..., ge=0.05, le=20)


class ImageLayerSetUpdate(SchemaModel):
    expected_revision: int = Field(..., ge=0)
    layers: list[ImageLayerUpdate] = Field(..., min_length=1, max_length=16)

    @model_validator(mode="after")
    def validate_layer_order(self) -> "ImageLayerSetUpdate":
        layer_ids = [layer.id for layer in self.layers]
        if len(layer_ids) != len(set(layer_ids)):
            raise ValueError("image layers must be unique")
        indexes = sorted(layer.z_index for layer in self.layers)
        if indexes != list(range(1, len(indexes) + 1)):
            raise ValueError("image layer z_index values must be unique and continuous")
        return self


class ImageLayerSetCreate(SchemaModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str = Field(..., min_length=1)
    source_asset_id: str = Field(..., min_length=1)
    base_asset_id: str = Field(..., min_length=1)
    canvas_width: int = Field(..., gt=0)
    canvas_height: int = Field(..., gt=0)
    status: Status = Status.SUCCEEDED
    revision: int = Field(default=0, ge=0)


class ImageLayerSet(ImageLayerSetCreate):
    layers: list[ImageLayer] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    @model_validator(mode="after")
    def validate_layer_order(self) -> "ImageLayerSet":
        indexes = sorted(layer.z_index for layer in self.layers)
        if indexes != list(range(1, len(indexes) + 1)):
            raise ValueError("image layer z_index values must be unique and continuous")
        if any(layer.set_id != self.id for layer in self.layers):
            raise ValueError("image layer belongs to another set")
        if any(
            layer.bbox_absolute[2] > self.canvas_width
            or layer.bbox_absolute[3] > self.canvas_height
            for layer in self.layers
        ):
            raise ValueError("absolute bbox exceeds the image layer canvas")
        return self


class ImageLayerSetDetail(ImageLayerSet):
    base_asset: Asset
    layers_assets: list[Asset]


class ImageLayerCompositionRequest(SchemaModel):
    layer_set_id: str = Field(..., min_length=1)
    expected_revision: int = Field(..., ge=0)
    set_current: bool = True


class ImageLayerContentEditRequest(SchemaModel):
    expected_revision: int = Field(..., ge=0)
    layer_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1, max_length=4000)
    size: ImageGenerationSize = ImageGenerationSize.TWO_K
    format: ImageOutputFormat = ImageOutputFormat.PNG

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        value = value.strip()
        if not value or COORDINATE_TAG_PATTERN.search(value):
            raise ValueError("coordinate tags are not accepted in layer edit prompts")
        return value


class FrozenImageLayerContentEditInput(SchemaModel):
    kind: Literal["layer_content_edit"] = "layer_content_edit"
    project_id: str = Field(..., min_length=1)
    layer_set_id: str = Field(..., min_length=1)
    layer_id: str = Field(..., min_length=1)
    expected_revision: int = Field(..., ge=0)
    source_asset_id: str = Field(..., min_length=1)
    source_object_key: str = Field(..., min_length=1)
    source_asset_created_at: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    size: ImageGenerationSize = ImageGenerationSize.TWO_K
    format: ImageOutputFormat = ImageOutputFormat.PNG
    model: str = Field(..., min_length=1)


class FrozenImageLayerCompositionInput(SchemaModel):
    kind: Literal["layer_composition"] = "layer_composition"
    project_id: str = Field(..., min_length=1)
    source_asset_id: str = Field(..., min_length=1)
    layer_set_id: str = Field(..., min_length=1)
    layer_revision: int = Field(..., ge=0)
    set_current: bool = True
    expected_image_revision: int = Field(..., ge=0)


class ImageLayerDecompositionRequest(SchemaModel):
    source_asset_id: str = Field(..., min_length=1)
    prompt: str | None = Field(default=None, max_length=4000)
    bbox: ImageBboxAnnotation | None = None
    size: ImageLayerDecompositionSize = ImageLayerDecompositionSize.AUTO
    format: ImageOutputFormat = ImageOutputFormat.PNG

    @field_validator("source_asset_id")
    @classmethod
    def strip_source_asset_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("source_asset_id must not be blank")
        return value

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if COORDINATE_TAG_PATTERN.search(value):
            raise ValueError("coordinate tags are not accepted in decomposition prompts")
        return value


class FrozenImageLayerDecompositionInput(SchemaModel):
    kind: Literal["layer_decomposition"] = "layer_decomposition"
    project_id: str = Field(..., min_length=1)
    source_asset_id: str = Field(..., min_length=1)
    source_object_key: str = Field(..., min_length=1)
    source_asset_created_at: str = Field(..., min_length=1)
    prompt: str | None = None
    bbox: ImageBboxAnnotation | None = None
    final_prompt: str | None = None
    size: ImageLayerDecompositionSize = ImageLayerDecompositionSize.AUTO
    format: ImageOutputFormat = ImageOutputFormat.PNG
    model: str = Field(..., min_length=1)
