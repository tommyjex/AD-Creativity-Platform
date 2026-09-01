from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .common import SchemaModel
from .enums import (
    ImageGenerationOperation,
    ImageGenerationSize,
    ImagePurpose,
    ImageOutputFormat,
    TargetLanguage,
)

COORDINATE_TAG_PATTERN = re.compile(r"</?\s*(?:point|bbox)\b", re.IGNORECASE)


class ImageAnnotationBase(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ImagePointAnnotation(ImageAnnotationBase):
    type: Literal["point"]
    x: int = Field(..., ge=0, le=999)
    y: int = Field(..., ge=0, le=999)


class ImageBboxAnnotation(ImageAnnotationBase):
    type: Literal["bbox"]
    x1: int = Field(..., ge=0, le=999)
    y1: int = Field(..., ge=0, le=999)
    x2: int = Field(..., ge=0, le=999)
    y2: int = Field(..., ge=0, le=999)

    @model_validator(mode="after")
    def validate_order(self) -> "ImageBboxAnnotation":
        if self.x1 >= self.x2 or self.y1 >= self.y2:
            raise ValueError("bbox requires x1 < x2 and y1 < y2")
        return self


ImageEditAnnotation = Annotated[
    ImagePointAnnotation | ImageBboxAnnotation,
    Field(discriminator="type"),
]


class ImageReferenceRegion(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    image_index: int = Field(..., ge=2, le=11)
    bbox: ImageBboxAnnotation

    @field_validator("asset_id")
    @classmethod
    def strip_asset_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("reference asset ID must not be blank")
        return stripped


class ImageReferenceSelectionUpdate(SchemaModel):
    asset_ids: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("asset_ids")
    @classmethod
    def validate_asset_ids(cls, value: list[str]) -> list[str]:
        normalized = [asset_id.strip() for asset_id in value]
        if any(not asset_id for asset_id in normalized):
            raise ValueError("reference asset IDs must not be blank")
        if len(set(normalized)) != len(normalized):
            raise ValueError("reference asset IDs must be unique")
        return normalized


class TextToImageGenerationRequest(SchemaModel):
    operation: Literal[ImageGenerationOperation.TEXT_TO_IMAGE] = (
        ImageGenerationOperation.TEXT_TO_IMAGE
    )
    prompt_version_id: str | None = Field(default=None, min_length=1)
    reference_asset_ids: list[str] = Field(default_factory=list, max_length=10)
    reference_asset_id: str | None = Field(default=None, min_length=1)
    size: ImageGenerationSize = ImageGenerationSize.TWO_K
    format: ImageOutputFormat = ImageOutputFormat.PNG

    @field_validator("reference_asset_ids")
    @classmethod
    def validate_reference_asset_ids(cls, value: list[str]) -> list[str]:
        normalized = [asset_id.strip() for asset_id in value]
        if any(not asset_id for asset_id in normalized):
            raise ValueError("reference asset IDs must not be blank")
        if len(set(normalized)) != len(normalized):
            raise ValueError("reference asset IDs must be unique")
        return normalized

    @field_validator("reference_asset_id")
    @classmethod
    def strip_reference_asset_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("reference_asset_id must not be blank")
        return stripped

    @model_validator(mode="after")
    def normalize_legacy_reference_asset_id(
        self,
    ) -> "TextToImageGenerationRequest":
        if self.reference_asset_id is None:
            return self
        if self.reference_asset_ids:
            raise ValueError(
                "reference_asset_id cannot be combined with reference_asset_ids"
            )
        self.reference_asset_ids = [self.reference_asset_id]
        return self


class ImageToImageGenerationRequest(SchemaModel):
    operation: Literal[ImageGenerationOperation.IMAGE_TO_IMAGE] = (
        ImageGenerationOperation.IMAGE_TO_IMAGE
    )
    source_asset_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1, max_length=4000)
    prompt_version_id: str | None = Field(default=None, min_length=1)
    annotation: ImageEditAnnotation | None = None
    edit_mode: Literal["single_region", "reference_replace"] = "single_region"
    target_bbox: ImageBboxAnnotation | None = None
    reference_regions: list[ImageReferenceRegion] = Field(
        default_factory=list,
        max_length=10,
    )
    size: ImageGenerationSize = ImageGenerationSize.TWO_K
    format: ImageOutputFormat = ImageOutputFormat.PNG

    @field_validator("source_asset_id")
    @classmethod
    def strip_source_asset_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("value must not be blank")
        return stripped

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("value must not be blank")
        if COORDINATE_TAG_PATTERN.search(stripped):
            raise ValueError("coordinate tags are not accepted in edit prompts")
        return stripped

    @model_validator(mode="after")
    def validate_edit_mode(self) -> "ImageToImageGenerationRequest":
        if self.edit_mode == "single_region":
            if self.target_bbox is not None or self.reference_regions:
                raise ValueError(
                    "single_region must not include target_bbox or reference_regions"
                )
            return self
        if self.target_bbox is None:
            raise ValueError("reference_replace requires target_bbox")
        if not self.reference_regions:
            raise ValueError("reference_replace requires reference_regions")
        asset_ids = [region.asset_id for region in self.reference_regions]
        image_indexes = [region.image_index for region in self.reference_regions]
        if len(set(asset_ids)) != len(asset_ids):
            raise ValueError("reference region asset IDs must be unique")
        if len(set(image_indexes)) != len(image_indexes):
            raise ValueError("reference region image indexes must be unique")
        return self


class SetCurrentImageRequest(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    expected_image_revision: int = Field(..., ge=0)

    @field_validator("asset_id")
    @classmethod
    def strip_asset_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("asset_id must not be blank")
        return stripped


class FrozenImageReference(SchemaModel):
    asset_id: str = Field(..., min_length=1)
    object_key: str = Field(..., min_length=1)
    created_at: str = Field(..., min_length=1)


class FrozenImageReferenceRegion(FrozenImageReference):
    image_index: int = Field(..., ge=2, le=11)
    bbox: ImageBboxAnnotation


class FrozenImageGenerationInput(SchemaModel):
    operation: ImageGenerationOperation
    project_id: str = Field(..., min_length=1)
    source_asset_id: str | None = None
    source_object_key: str | None = None
    source_asset_created_at: str | None = None
    reference_asset_id: str | None = None
    reference_object_key: str | None = None
    reference_asset_created_at: str | None = None
    reference_assets: list[FrozenImageReference] = Field(
        default_factory=list,
        max_length=10,
    )
    edit_mode: Literal["single_region", "reference_replace"] = "single_region"
    target_bbox: ImageBboxAnnotation | None = None
    reference_regions: list[FrozenImageReferenceRegion] = Field(
        default_factory=list,
        max_length=10,
    )
    prompt_version_id: str = Field(..., min_length=1)
    prompt_version: int = Field(..., ge=1)
    prompt: str = Field(..., min_length=1)
    base_prompt: str = Field(..., min_length=1)
    normalized_prompt: str = Field(..., min_length=1)
    final_prompt: str = Field(..., min_length=1)
    annotation: ImageEditAnnotation | None = None
    aspect_ratio: str = Field(..., min_length=1)
    target_language: TargetLanguage
    image_purpose: ImagePurpose
    size: ImageGenerationSize = ImageGenerationSize.TWO_K
    format: ImageOutputFormat = ImageOutputFormat.PNG
    model: str = Field(..., min_length=1)
