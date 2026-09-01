from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from .common import SchemaModel, utc_now
from .image_generation import ImageBboxAnnotation


CanvasNodeKind = Literal["reference", "output"]


class CanvasNode(SchemaModel):
    id: str = Field(..., min_length=1)
    kind: CanvasNodeKind
    x: float
    y: float
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    z: int = Field(..., ge=0)

    # Reference node fields.
    asset_id: str | None = None
    order_index: int | None = Field(default=None, ge=1)
    bbox: ImageBboxAnnotation | None = None

    # Output node fields.
    task_id: str | None = None
    source: (
        Literal["text_to_image", "image_to_image", "layer_decomposition"] | None
    ) = None

    @model_validator(mode="after")
    def validate_kind_requirements(self) -> "CanvasNode":
        if self.kind == "reference":
            if self.asset_id is None:
                raise ValueError("reference node requires asset_id")
            if self.order_index is None:
                raise ValueError("reference node requires order_index")
        elif self.kind == "output":
            if self.asset_id is None and self.task_id is None:
                raise ValueError("output node requires asset_id or task_id")
        return self


class CanvasLayout(SchemaModel):
    project_id: str = Field(..., min_length=1)
    nodes: list[CanvasNode] = Field(default_factory=list, max_length=100)
    revision: int = Field(default=0, ge=0)
    updated_at: datetime = Field(default_factory=utc_now)

    @model_validator(mode="after")
    def validate_unique_node_ids(self) -> "CanvasLayout":
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("canvas node ids must be unique")
        return self


class CanvasLayoutUpdate(SchemaModel):
    expected_revision: int = Field(..., ge=0)
    nodes: list[CanvasNode] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_unique_node_ids(self) -> "CanvasLayoutUpdate":
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("canvas node ids must be unique")
        return self
