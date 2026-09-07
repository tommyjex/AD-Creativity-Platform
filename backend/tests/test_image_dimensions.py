from __future__ import annotations

import pytest
from pydantic import TypeAdapter, ValidationError

from backend.app.schemas.image_dimensions import (
    SEEDREAM_COMMON_IMAGE_DIMENSIONS,
    SEEDREAM_MAX_IMAGE_PIXELS,
    SEEDREAM_MIN_IMAGE_PIXELS,
    SeedreamCustomImageSize,
    SeedreamImageDimensionError,
    SeedreamImageSize,
    is_seedream_image_preset_size,
    normalize_seedream_custom_image_size,
    normalize_seedream_image_size,
    parse_seedream_custom_image_size,
)


@pytest.mark.parametrize(
    ("value", "width", "height", "pixels", "normalized"),
    [
        ("960x960", 960, 960, SEEDREAM_MIN_IMAGE_PIXELS, "960x960"),
        (
            "1634x2830",
            1634,
            2830,
            SEEDREAM_MAX_IMAGE_PIXELS,
            "1634x2830",
        ),
        ("3840x240", 3840, 240, SEEDREAM_MIN_IMAGE_PIXELS, "3840x240"),
        ("240x3840", 240, 3840, SEEDREAM_MIN_IMAGE_PIXELS, "240x3840"),
        ("2048x1024", 2048, 1024, 2_097_152, "2048x1024"),
        ("000960x00960", 960, 960, SEEDREAM_MIN_IMAGE_PIXELS, "960x960"),
    ],
)
def test_parse_seedream_custom_image_size_accepts_closed_boundaries(
    value: str,
    width: int,
    height: int,
    pixels: int,
    normalized: str,
) -> None:
    dimensions = parse_seedream_custom_image_size(value)

    assert dimensions.width == width
    assert dimensions.height == height
    assert dimensions.pixels == pixels
    assert dimensions.size == normalized
    assert normalize_seedream_custom_image_size(value) == normalized


@pytest.mark.parametrize(
    "value",
    [
        "",
        "2048",
        "2048X1024",
        "2048 x1024",
        "2048x 1024",
        "+2048x1024",
        "-2048x1024",
        "2048.0x1024",
        "2048x1024.5",
        "widthxheight",
        2048,
        None,
    ],
)
def test_parse_seedream_custom_image_size_rejects_invalid_format(
    value: object,
) -> None:
    with pytest.raises(SeedreamImageDimensionError) as error:
        parse_seedream_custom_image_size(value)

    assert error.value.code == "invalid_format"


@pytest.mark.parametrize("value", ["0x960", "960x0", "000x960"])
def test_parse_seedream_custom_image_size_rejects_zero(value: str) -> None:
    with pytest.raises(SeedreamImageDimensionError) as error:
        parse_seedream_custom_image_size(value)

    assert error.value.code == "non_positive"


@pytest.mark.parametrize(
    "value",
    ["959x960", "1635x2830", "999999999999999999999x1"],
)
def test_parse_seedream_custom_image_size_rejects_pixel_bounds(
    value: str,
) -> None:
    with pytest.raises(SeedreamImageDimensionError) as error:
        parse_seedream_custom_image_size(value)

    assert error.value.code == "pixel_count_out_of_range"


@pytest.mark.parametrize("value", ["3841x240", "240x3841"])
def test_parse_seedream_custom_image_size_rejects_ratio_bounds(
    value: str,
) -> None:
    with pytest.raises(SeedreamImageDimensionError) as error:
        parse_seedream_custom_image_size(value)

    assert error.value.code == "aspect_ratio_out_of_range"


def test_seedream_image_size_union_accepts_presets_and_normalizes_custom() -> None:
    adapter = TypeAdapter(SeedreamImageSize)
    custom_adapter = TypeAdapter(SeedreamCustomImageSize)

    assert is_seedream_image_preset_size("1K")
    assert is_seedream_image_preset_size("1.5K")
    assert is_seedream_image_preset_size("2K")
    assert not is_seedream_image_preset_size("auto")
    assert not is_seedream_image_preset_size("2048x1024")
    assert normalize_seedream_image_size("1.5K") == "1.5K"
    assert normalize_seedream_image_size("02048x01024") == "2048x1024"
    assert adapter.validate_python("2K") == "2K"
    assert adapter.validate_python("02048x01024") == "2048x1024"
    assert custom_adapter.validate_python("2048x1024") == "2048x1024"

    with pytest.raises(ValidationError):
        adapter.validate_python("auto")
    with pytest.raises(ValidationError):
        custom_adapter.validate_python("2048X1024")


def test_seedream_common_dimensions_match_official_mapping() -> None:
    normalized_mapping = {
        preset: {
            aspect_ratio: dimensions.size
            for aspect_ratio, dimensions in ratios.items()
        }
        for preset, ratios in SEEDREAM_COMMON_IMAGE_DIMENSIONS.items()
    }

    assert normalized_mapping == {
        "1K": {
            "1:1": "1024x1024",
            "4:3": "1152x864",
            "3:4": "864x1152",
            "16:9": "1424x800",
            "9:16": "800x1424",
        },
        "1.5K": {
            "1:1": "1536x1536",
            "4:3": "1792x1344",
            "3:4": "1344x1792",
            "16:9": "2048x1152",
            "9:16": "1152x2048",
        },
        "2K": {
            "1:1": "2048x2048",
            "4:3": "2368x1776",
            "3:4": "1776x2368",
            "16:9": "2816x1584",
            "9:16": "1584x2816",
        },
    }
