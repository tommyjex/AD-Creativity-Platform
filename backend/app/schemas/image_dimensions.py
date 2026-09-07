from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Annotated, Literal, TypeAlias, cast

from pydantic import AfterValidator

SEEDREAM_IMAGE_PRESET_SIZES = ("1K", "1.5K", "2K")
SEEDREAM_IMAGE_ASPECT_RATIOS = ("1:1", "4:3", "3:4", "16:9", "9:16")

SEEDREAM_MIN_IMAGE_PIXELS = 921_600
SEEDREAM_MAX_IMAGE_PIXELS = 4_624_220
SEEDREAM_MAX_ASPECT_RATIO = 16

SeedreamImagePresetSize: TypeAlias = Literal["1K", "1.5K", "2K"]
SeedreamImageAspectRatio: TypeAlias = Literal[
    "1:1",
    "4:3",
    "3:4",
    "16:9",
    "9:16",
]

_CUSTOM_IMAGE_SIZE_PATTERN = re.compile(r"^([0-9]+)x([0-9]+)$")


class SeedreamImageDimensionError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True, slots=True)
class SeedreamImageDimensions:
    width: int
    height: int
    pixels: int
    size: str


def is_seedream_image_preset_size(
    value: object,
) -> bool:
    return isinstance(value, str) and value in SEEDREAM_IMAGE_PRESET_SIZES


def parse_seedream_custom_image_size(
    value: object,
) -> SeedreamImageDimensions:
    if not isinstance(value, str):
        raise SeedreamImageDimensionError(
            "invalid_format",
            "image size must use WIDTHxHEIGHT decimal notation",
        )
    match = _CUSTOM_IMAGE_SIZE_PATTERN.fullmatch(value)
    if match is None:
        raise SeedreamImageDimensionError(
            "invalid_format",
            "image size must use WIDTHxHEIGHT decimal notation",
        )

    width = int(match.group(1))
    height = int(match.group(2))
    if width == 0 or height == 0:
        raise SeedreamImageDimensionError(
            "non_positive",
            "image width and height must be positive integers",
        )

    pixels = width * height
    if not SEEDREAM_MIN_IMAGE_PIXELS <= pixels <= SEEDREAM_MAX_IMAGE_PIXELS:
        raise SeedreamImageDimensionError(
            "pixel_count_out_of_range",
            "image pixel count must be between "
            f"{SEEDREAM_MIN_IMAGE_PIXELS} and {SEEDREAM_MAX_IMAGE_PIXELS}",
        )
    if (
        width > SEEDREAM_MAX_ASPECT_RATIO * height
        or height > SEEDREAM_MAX_ASPECT_RATIO * width
    ):
        raise SeedreamImageDimensionError(
            "aspect_ratio_out_of_range",
            "image aspect ratio must be between 1:16 and 16:1",
        )

    return SeedreamImageDimensions(
        width=width,
        height=height,
        pixels=pixels,
        size=f"{width}x{height}",
    )


def normalize_seedream_custom_image_size(value: object) -> str:
    return parse_seedream_custom_image_size(value).size


def normalize_seedream_image_size(
    value: object,
) -> SeedreamImageSize:
    if is_seedream_image_preset_size(value):
        return cast(SeedreamImagePresetSize, value)
    return normalize_seedream_custom_image_size(value)


SeedreamCustomImageSize: TypeAlias = Annotated[
    str,
    AfterValidator(normalize_seedream_custom_image_size),
]
SeedreamImageSize: TypeAlias = SeedreamImagePresetSize | SeedreamCustomImageSize


def _dimensions(value: str) -> SeedreamImageDimensions:
    return parse_seedream_custom_image_size(value)


SEEDREAM_COMMON_IMAGE_DIMENSIONS: dict[
    SeedreamImagePresetSize,
    dict[SeedreamImageAspectRatio, SeedreamImageDimensions],
] = {
    "1K": {
        "1:1": _dimensions("1024x1024"),
        "4:3": _dimensions("1152x864"),
        "3:4": _dimensions("864x1152"),
        "16:9": _dimensions("1424x800"),
        "9:16": _dimensions("800x1424"),
    },
    "1.5K": {
        "1:1": _dimensions("1536x1536"),
        "4:3": _dimensions("1792x1344"),
        "3:4": _dimensions("1344x1792"),
        "16:9": _dimensions("2048x1152"),
        "9:16": _dimensions("1152x2048"),
    },
    "2K": {
        "1:1": _dimensions("2048x2048"),
        "4:3": _dimensions("2368x1776"),
        "3:4": _dimensions("1776x2368"),
        "16:9": _dimensions("2816x1584"),
        "9:16": _dimensions("1584x2816"),
    },
}
