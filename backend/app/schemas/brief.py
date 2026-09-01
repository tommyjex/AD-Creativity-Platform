from __future__ import annotations

from typing import Annotated, Optional

from pydantic import Field, model_validator

from .common import SchemaModel
from .enums import ImagePurpose, TargetLanguage


SellingPoint = Annotated[str, Field(min_length=1)]


class BriefBase(SchemaModel):
    prompt: str = Field(
        default="",
        min_length=1,
        description="Original user requirement.",
    )
    target_language: TargetLanguage = TargetLanguage.ZH
    target_platform: str = Field(default="douyin", min_length=1)
    aspect_ratio: str = Field(default="9:16", pattern=r"^(9:16|16:9|1:1|4:3|3:4)$")
    duration_seconds: Optional[int] = Field(default=30, gt=0, le=300)
    image_purpose: Optional[ImagePurpose] = None
    style: Optional[str] = None
    audience: Optional[str] = None
    product_name: Optional[str] = None
    selling_points: list[SellingPoint] = Field(default_factory=list)


class BriefCreate(BriefBase):
    pass


class BriefUpdate(SchemaModel):
    prompt: Optional[str] = Field(default=None, min_length=1)
    target_language: Optional[TargetLanguage] = None
    target_platform: Optional[str] = Field(default=None, min_length=1)
    aspect_ratio: Optional[str] = Field(
        default=None,
        pattern=r"^(9:16|16:9|1:1|4:3|3:4)$",
    )
    duration_seconds: Optional[int] = Field(default=None, gt=0, le=300)
    image_purpose: Optional[ImagePurpose] = None
    style: Optional[str] = None
    audience: Optional[str] = None
    product_name: Optional[str] = None
    summary: Optional[str] = None
    selling_points: Optional[list[SellingPoint]] = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> BriefUpdate:
        required_fields = {
            "prompt",
            "target_language",
            "target_platform",
            "aspect_ratio",
        }
        null_fields = required_fields & self.model_fields_set
        if any(getattr(self, field) is None for field in null_fields):
            raise ValueError("required brief fields cannot be null")
        return self


class Brief(BriefBase):
    prompt: str = ""
    summary: Optional[str] = None
