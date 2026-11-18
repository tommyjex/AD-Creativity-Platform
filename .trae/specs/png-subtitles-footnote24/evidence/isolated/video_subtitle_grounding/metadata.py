"""Display-oriented video metadata, independent of platform asset models."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Literal


class MediaInspectionError(ValueError):
    pass


@dataclass(frozen=True)
class VideoDisplayMetadata:
    encoded_width: int
    encoded_height: int
    display_width: int
    display_height: int
    duration_seconds: float
    rotation: Literal[0, 90, 180, 270]
    container: str
    codec: str
    video_bit_rate: int | None = None
    video_bit_rate_probed: bool = False

    @property
    def duration_ms(self) -> int:
        return round(self.duration_seconds * 1000)


def parse_video_display_metadata(
    payload: dict[str, object], *, max_duration_seconds: float | None = None
) -> VideoDisplayMetadata:
    raw_streams = payload.get("streams")
    streams = [s for s in raw_streams if isinstance(s, dict)] if isinstance(raw_streams, list) else []
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if video is None:
        raise MediaInspectionError("video file has no video stream")
    width = _positive_int(video.get("width"), "video width")
    height = _positive_int(video.get("height"), "video height")
    format_value = payload.get("format")
    format_data = format_value if isinstance(format_value, dict) else {}
    duration = _duration(video.get("duration"), format_data.get("duration"))
    if max_duration_seconds is not None and duration > max_duration_seconds:
        raise MediaInspectionError(f"video duration exceeds {max_duration_seconds:g} seconds")
    rotation = _video_rotation(video)
    format_tags = format_data.get("tags")
    major_brand = str(format_tags.get("major_brand") or "").strip().lower() if isinstance(format_tags, dict) else ""
    container = _normalized_video_container(
        str(format_data.get("format_name") or "").strip().lower(), major_brand=major_brand
    )
    codec = str(video.get("codec_name") or "").strip().lower()
    if not container:
        raise MediaInspectionError("video container is unavailable")
    if not codec:
        raise MediaInspectionError("video codec is unavailable")
    return VideoDisplayMetadata(
        encoded_width=width, encoded_height=height,
        display_width=height if rotation in {90, 270} else width,
        display_height=width if rotation in {90, 270} else height,
        duration_seconds=duration, rotation=rotation, container=container, codec=codec,
        video_bit_rate=parse_video_bit_rate(video.get("bit_rate")),
        video_bit_rate_probed=True,
    )


def parse_video_bit_rate(value: object) -> int | None:
    """FFprobe video stream bit_rate is bps; never substitute container bitrate."""
    if type(value) is int:
        return value if value > 0 else None
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        try:
            parsed = int(value)
        except ValueError:
            return None
        return parsed if parsed > 0 else None
    return None


def _positive_int(value: object, label: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise MediaInspectionError(f"{label} is unavailable") from exc
    if parsed <= 0:
        raise MediaInspectionError(f"{label} is unavailable")
    return parsed


def _duration(*candidates: object) -> float:
    for value in candidates:
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(parsed) and parsed > 0:
            return parsed
    raise MediaInspectionError("media duration is unavailable")


def _video_rotation(stream: dict[str, object]) -> Literal[0, 90, 180, 270]:
    raw_rotation = None
    side_data = stream.get("side_data_list")
    if isinstance(side_data, list):
        for entry in side_data:
            if not isinstance(entry, dict):
                continue
            if entry.get("rotation") is not None:
                raw_rotation = entry["rotation"]
                break
            matrix = entry.get("displaymatrix")
            if isinstance(matrix, str):
                match = re.search(r"rotation(?:\s+of)?\s+(-?\d+(?:\.\d+)?)", matrix, re.IGNORECASE)
                if match:
                    raw_rotation = match.group(1)
                    break
    if raw_rotation is None:
        tags = stream.get("tags")
        if isinstance(tags, dict):
            raw_rotation = tags.get("rotate")
    if raw_rotation is None:
        return 0
    try:
        numeric = float(raw_rotation)
    except (TypeError, ValueError) as exc:
        raise MediaInspectionError("video rotation metadata is invalid") from exc
    if not math.isfinite(numeric):
        raise MediaInspectionError("video rotation metadata is invalid")
    nearest = round(numeric / 90) * 90
    if not math.isclose(numeric, nearest, abs_tol=0.01):
        raise MediaInspectionError("video rotation must be a quarter turn")
    return nearest % 360


def _normalized_video_container(raw_container: str, *, major_brand: str) -> str:
    names = [name.strip() for name in raw_container.split(",") if name.strip()]
    if "mov" in names and major_brand == "qt":
        return "mov"
    if any(name in {"mov", "mp4"} for name in names):
        return "mp4"
    for candidate in ("webm", "matroska", "mpeg", "avi"):
        if candidate in names:
            return candidate
    return next(iter(names), "")
