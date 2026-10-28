from __future__ import annotations

import re
import unicodedata
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from math import isfinite

from pydantic import ValidationError

from backend.app.schemas.video_subtitle_grounding import (
    VIDEO_SUBTITLE_GROUNDING_BACKGROUND_COLOR_PATTERN,
    VIDEO_SUBTITLE_GROUNDING_MAX_SEGMENTS,
    VIDEO_SUBTITLE_GROUNDING_MAX_TEXT_LENGTH,
    NormalizedBoundingBox,
    PixelBoundingBox,
    VideoSubtitleAlignment,
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
    VideoSubtitleGroundingSubtitle,
    VideoSubtitleVisualRole,
)
from backend.app.services.media_inspector import VideoDisplayMetadata
from backend.app.services.modelark_video_subtitle_grounding import (
    ModelArkSubtitleGroundingSegment,
    ModelArkVideoSubtitleGroundingResult,
)

VIDEO_SUBTITLE_GROUNDING_DURATION_TOLERANCE_MS = 250

_BBOX_PATTERN = re.compile(
    r"<bbox>([0-9]+) ([0-9]+) ([0-9]+) ([0-9]+)</bbox>"
)
_SAFE_BLOCK_ID_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,64}")


@dataclass(frozen=True)
class VideoSubtitleGroundingValidationStats:
    invalid_segment_count: int
    style_fallback_counts: dict[str, int]


@dataclass(frozen=True)
class VideoSubtitleGroundingValidationResult:
    subtitles: tuple[VideoSubtitleGroundingSubtitle, ...]
    stats: VideoSubtitleGroundingValidationStats

    def __iter__(self) -> Iterator[VideoSubtitleGroundingSubtitle]:
        return iter(self.subtitles)

    def __len__(self) -> int:
        return len(self.subtitles)

    def __getitem__(self, index: int) -> VideoSubtitleGroundingSubtitle:
        return self.subtitles[index]


class VideoSubtitleGroundingValidationError(ValueError):
    """A safe, stage-specific failure for invalid model subtitle output."""

    code = VideoSubtitleGroundingErrorCode.INVALID_MODEL_OUTPUT
    phase = VideoSubtitleGroundingErrorPhase.RESPONSE_VALIDATION

    def __init__(self, message: str = "The model subtitle output was invalid.") -> None:
        super().__init__(message)


def validate_and_convert_subtitles(
    result: ModelArkVideoSubtitleGroundingResult,
    video: VideoDisplayMetadata,
) -> VideoSubtitleGroundingValidationResult:
    """Validate Provider segments and convert normalized boxes to display pixels."""

    subtitles = result.subtitles
    if not isinstance(subtitles, (list, tuple)):
        raise VideoSubtitleGroundingValidationError()
    if len(subtitles) > VIDEO_SUBTITLE_GROUNDING_MAX_SEGMENTS:
        raise VideoSubtitleGroundingValidationError()
    if (
        not _is_strict_positive_int(video.display_width)
        or not _is_strict_positive_int(video.display_height)
        or not _is_strict_positive_int(video.duration_ms)
    ):
        raise VideoSubtitleGroundingValidationError()

    validated: list[
        tuple[
            int,
            tuple[str, int, int, NormalizedBoundingBox],
            VideoSubtitleGroundingSubtitle,
        ]
    ] = []
    seen: set[tuple[str, int, int, NormalizedBoundingBox]] = set()
    invalid_segment_count = 0
    fallback_counts: Counter[str] = Counter()

    for original_index, segment in enumerate(subtitles):
        try:
            text, start_ms, end_ms, normalized = _validate_segment(
                segment,
                duration_ms=video.duration_ms,
            )
            pixels = _to_pixel_bbox(
                normalized,
                display_width=video.display_width,
                display_height=video.display_height,
            )
        except VideoSubtitleGroundingValidationError:
            invalid_segment_count += 1
            continue

        duplicate_key = (text, start_ms, end_ms, normalized)
        if duplicate_key in seen:
            continue
        seen.add(duplicate_key)

        visual_role, font_height_ratio, alignment, block_id, line_index = (
            _normalize_style(
                segment,
                normalized,
                original_index=original_index,
                fallback_counts=fallback_counts,
            )
        )
        try:
            subtitle = VideoSubtitleGroundingSubtitle(
                text=text,
                start_ms=start_ms,
                end_ms=end_ms,
                bbox_normalized=normalized,
                bbox_pixels=pixels,
                visual_role=visual_role,
                font_height_ratio=font_height_ratio,
                alignment=alignment,
                block_id=block_id,
                line_index=line_index,
                background_color=_normalize_background_color(segment, fallback_counts),
            )
        except ValidationError:
            invalid_segment_count += 1
            continue
        validated.append((original_index, duplicate_key, subtitle))

    if subtitles and not validated:
        raise VideoSubtitleGroundingValidationError()

    validated.sort(
        key=lambda item: (
            item[2].start_ms,
            item[2].end_ms,
            item[0],
        )
    )
    return VideoSubtitleGroundingValidationResult(
        subtitles=tuple(item[2] for item in validated),
        stats=VideoSubtitleGroundingValidationStats(
            invalid_segment_count=invalid_segment_count,
            style_fallback_counts=dict(sorted(fallback_counts.items())),
        ),
    )


def _normalize_background_color(
    segment: ModelArkSubtitleGroundingSegment,
    fallback_counts: Counter[str],
) -> str | None:
    value = getattr(segment, "background_color", None)
    if isinstance(value, str) and re.fullmatch(
        VIDEO_SUBTITLE_GROUNDING_BACKGROUND_COLOR_PATTERN, value
    ):
        return value.upper()
    fallback_counts["background_color"] += 1
    return None


def _normalize_style(
    segment: ModelArkSubtitleGroundingSegment,
    normalized: NormalizedBoundingBox,
    *,
    original_index: int,
    fallback_counts: Counter[str],
) -> tuple[
    VideoSubtitleVisualRole,
    float,
    VideoSubtitleAlignment,
    str,
    int,
]:
    role_value = getattr(segment, "visual_role", None)
    try:
        visual_role = VideoSubtitleVisualRole(role_value)
    except (TypeError, ValueError):
        visual_role = VideoSubtitleVisualRole.BODY
        fallback_counts["visual_role"] += 1

    ratio_value = getattr(segment, "font_height_ratio", None)
    if (
        isinstance(ratio_value, (int, float))
        and not isinstance(ratio_value, bool)
        and isfinite(ratio_value)
        and 0 < ratio_value <= 1
    ):
        font_height_ratio = float(ratio_value)
    else:
        font_height_ratio = (normalized[3] - normalized[1]) / 1000
        fallback_counts["font_height_ratio"] += 1

    alignment_value = getattr(segment, "alignment", None)
    try:
        alignment = VideoSubtitleAlignment(alignment_value)
    except (TypeError, ValueError):
        center_x = (normalized[0] + normalized[2]) / 2
        alignment = (
            VideoSubtitleAlignment.LEFT
            if center_x <= 350
            else VideoSubtitleAlignment.RIGHT
            if center_x >= 650
            else VideoSubtitleAlignment.CENTER
        )
        fallback_counts["alignment"] += 1

    block_value = getattr(segment, "block_id", None)
    if (
        isinstance(block_value, str)
        and _SAFE_BLOCK_ID_PATTERN.fullmatch(block_value)
    ):
        block_id = block_value
    else:
        block_id = f"segment_{original_index}"
        fallback_counts["block_id"] += 1

    line_value = getattr(segment, "line_index", None)
    if _is_strict_int(line_value) and line_value >= 0:
        line_index = line_value
    else:
        line_index = 0
        fallback_counts["line_index"] += 1

    return (
        visual_role,
        font_height_ratio,
        alignment,
        block_id,
        line_index,
    )


def _validate_segment(
    segment: ModelArkSubtitleGroundingSegment,
    *,
    duration_ms: int,
) -> tuple[str, int, int, NormalizedBoundingBox]:
    text = getattr(segment, "text", None)
    if not isinstance(text, str):
        raise VideoSubtitleGroundingValidationError()
    text = text.strip()
    if (
        not 1 <= len(text) <= VIDEO_SUBTITLE_GROUNDING_MAX_TEXT_LENGTH
        or any(unicodedata.category(character) == "Cc" for character in text)
    ):
        raise VideoSubtitleGroundingValidationError()

    start_ms = getattr(segment, "start_ms", None)
    end_ms = getattr(segment, "end_ms", None)
    if (
        not _is_strict_int(start_ms)
        or not _is_strict_int(end_ms)
        or start_ms < 0
        or start_ms >= end_ms
        or end_ms > duration_ms + VIDEO_SUBTITLE_GROUNDING_DURATION_TOLERANCE_MS
    ):
        raise VideoSubtitleGroundingValidationError()

    normalized = _parse_bbox(getattr(segment, "bbox", None))
    return text, start_ms, end_ms, normalized


def _parse_bbox(value: object) -> NormalizedBoundingBox:
    if not isinstance(value, str):
        raise VideoSubtitleGroundingValidationError()
    match = _BBOX_PATTERN.fullmatch(value)
    if match is None:
        raise VideoSubtitleGroundingValidationError()

    coordinates = tuple(int(part) for part in match.groups())
    x_min, y_min, x_max, y_max = coordinates
    if (
        not 0 <= x_min < x_max <= 999
        or not 0 <= y_min < y_max <= 999
    ):
        raise VideoSubtitleGroundingValidationError()
    return coordinates


def _to_pixel_bbox(
    normalized: NormalizedBoundingBox,
    *,
    display_width: int,
    display_height: int,
) -> PixelBoundingBox:
    x_min, y_min, x_max, y_max = normalized
    pixels = (
        int(x_min * display_width / 1000),
        int(y_min * display_height / 1000),
        int(x_max * display_width / 1000),
        int(y_max * display_height / 1000),
    )
    pixel_x_min, pixel_y_min, pixel_x_max, pixel_y_max = pixels
    if (
        not 0 <= pixel_x_min < pixel_x_max <= display_width
        or not 0 <= pixel_y_min < pixel_y_max <= display_height
    ):
        raise VideoSubtitleGroundingValidationError()
    return pixels


def _is_strict_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _is_strict_positive_int(value: object) -> bool:
    return _is_strict_int(value) and value > 0
