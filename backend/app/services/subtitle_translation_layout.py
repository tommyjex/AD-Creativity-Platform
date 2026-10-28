"""Compile reviewed subtitles directly to the MediaKit wire contract.

Evidence: https://docs.volcengine.com/docs/6448/2673861 and /2673939,
checked 2026-10-26. Text transform is a display region with a top-left
origin; font_size controls glyph size, align_type controls horizontal alignment,
and line_max_width=-1 disables wrapping. No text/track maximum is published.
The provider's vertical glyph anchor and literal syntax edge cases still need
an explicitly authorized real render; do not present Pillow as that validation.
"""

from __future__ import annotations

import hashlib
import math
import re
import struct
import unicodedata
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from urllib.parse import urlsplit

import httpx
from PIL import ImageFont

__all__ = ["FONT_RESOURCES", "SubtitleLayoutError", "compile_subtitle_project"]

SOURCE_HAN_REVISION = "a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2"
_SOURCE_HAN_ROOT = (
    "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/"
    f"{SOURCE_HAN_REVISION}/SubsetOTF"
)
CENTURY_GOTHIC_URL = (
    "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf"
)
CENTURY_GOTHIC_BOLD_URL = "https://xujianhua-utils.tos-cn-beijing.volces.com/CenturyGothic/centurygothic_bold.ttf"
DEFAULT_FONT = "CenturyGothicBold"
FALLBACK_FONT_ID = "ALi_PuHui"
DEFAULT_PANEL_COLOR = "#33333359"  # 35% opacity, 65% transparent.
# Bump when automatic rendering changes so unchanged drafts can be rendered anew.
LAYOUT_VERSION = "single-line-adaptive-panel35-v1"
# SY_Black is the existing editor's Source Han Sans preset. Send an explicit,
# versioned file URL, not the opaque preset ID whose binary version is unknown.
FONT_RESOURCES = {
    "SY_Black": f"{_SOURCE_HAN_ROOT}/CN/SourceHanSansCN-Regular.otf",
    "SY_Black_JP": f"{_SOURCE_HAN_ROOT}/JP/SourceHanSansJP-Regular.otf",
    "CenturyGothic": CENTURY_GOTHIC_URL,
    "CenturyGothicBold": CENTURY_GOTHIC_BOLD_URL,
}
MAX_SEGMENTS = 500  # Application/workspace boundary, NOT provider capacity.
MAX_TEXT_LENGTH = 4000  # Same reviewed-draft boundary.
MAX_FONT_BYTES = 32 * 1024 * 1024
CAPACITY_NOTICE = (
    "Tool limit: 500 subtitles, 4000 characters per subtitle. "
    "MediaKit publishes no text/track capacity limit; these tool limits are "
    "not a provider capacity guarantee."
)
_RGBA = re.compile(r"^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$")
_ALIGNMENT = {"left": 0, "center": 1, "right": 2}
# Local MediaKit adapter contract (MultiTrackFrameRate), not an inferred range.
SUPPORTED_FPS = (24, 25, 30, 50, 60)


class SubtitleLayoutError(ValueError):
    """Stable, text/URL-free compiler failure suitable for API diagnostics."""

    def __init__(self, code: str, segment_id: str | None = None):
        self.code = code
        self.segment_id = segment_id
        message = (
            f"{code}: {CAPACITY_NOTICE}"
            if code in {"segment_capacity_exceeded", "text_capacity_exceeded"}
            else code
        )
        super().__init__(message)


@dataclass(frozen=True)
class _FontResource:
    url: str
    content: bytes
    sha256: str
    codepoints: frozenset[int]

    def font(self, size: int) -> ImageFont.FreeTypeFont:
        return ImageFont.truetype(BytesIO(self.content), size=size)


def _font_codepoints(content: bytes) -> frozenset[int]:
    """Read Unicode cmap formats 4/12/13 from actual sfnt TTF/OTF bytes."""
    supported: set[int] = set()
    table_count = struct.unpack_from(">H", content, 4)[0]
    cmap_offset = None
    for index in range(table_count):
        tag, _, offset, _ = struct.unpack_from(">4sIII", content, 12 + index * 16)
        if tag == b"cmap":
            cmap_offset = offset
            break
    if cmap_offset is None:
        raise SubtitleLayoutError("font_unicode_cmap_missing")
    count = struct.unpack_from(">H", content, cmap_offset + 2)[0]
    for index in range(count):
        platform, encoding, offset = struct.unpack_from(
            ">HHI", content, cmap_offset + 4 + index * 8
        )
        if platform != 0 and not (platform == 3 and encoding in {1, 10}):
            continue
        base = cmap_offset + offset
        fmt = struct.unpack_from(">H", content, base)[0]
        if fmt in {12, 13}:
            groups = struct.unpack_from(">I", content, base + 12)[0]
            for group in range(groups):
                start, end, glyph = struct.unpack_from(
                    ">III", content, base + 16 + group * 12
                )
                if start > end or end > 0x10FFFF:
                    raise SubtitleLayoutError("invalid_font_cmap")
                first = start + (1 if glyph == 0 and fmt == 12 else 0)
                if glyph != 0 or fmt == 12:
                    supported.update(range(first, end + 1))
        elif fmt == 4:
            segments = struct.unpack_from(">H", content, base + 6)[0] // 2
            ends = base + 14
            starts = ends + segments * 2 + 2
            deltas = starts + segments * 2
            ranges = deltas + segments * 2
            for segment in range(segments):
                end = struct.unpack_from(">H", content, ends + segment * 2)[0]
                start = struct.unpack_from(">H", content, starts + segment * 2)[0]
                delta = struct.unpack_from(">h", content, deltas + segment * 2)[0]
                range_offset = struct.unpack_from(">H", content, ranges + segment * 2)[
                    0
                ]
                for codepoint in range(start, min(end, 0xFFFE) + 1):
                    if range_offset:
                        glyph_offset = (
                            ranges
                            + segment * 2
                            + range_offset
                            + (codepoint - start) * 2
                        )
                        glyph = struct.unpack_from(">H", content, glyph_offset)[0]
                        glyph = (glyph + delta) & 0xFFFF if glyph else 0
                    else:
                        glyph = (codepoint + delta) & 0xFFFF
                    if glyph:
                        supported.add(codepoint)
    if not supported:
        raise SubtitleLayoutError("font_unicode_cmap_missing")
    return frozenset(supported)


def _allowed_font_url(url: str) -> bool:
    # This compiler does not download arbitrary user URLs. New resources must
    # be registered by the server; this prevents a new SSRF fetch path.
    return url in FONT_RESOURCES.values()


@lru_cache(maxsize=8)
def _load_font_resource(url: str) -> _FontResource:
    if not _allowed_font_url(url):
        raise SubtitleLayoutError("font_resource_unavailable")
    try:
        with (
            httpx.Client(timeout=30, follow_redirects=False) as client,
            client.stream("GET", url) as response,
        ):
            response.raise_for_status()
            chunks: list[bytes] = []
            size = 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > MAX_FONT_BYTES:
                    raise SubtitleLayoutError("font_resource_too_large")
                chunks.append(chunk)
        content = b"".join(chunks)
        resource = _FontResource(
            url, content, hashlib.sha256(content).hexdigest(), _font_codepoints(content)
        )
        resource.font(16)
        return resource
    except SubtitleLayoutError:
        raise
    except (httpx.HTTPError, OSError, ValueError, struct.error, OverflowError):
        raise SubtitleLayoutError("font_resource_unavailable") from None


def _number(value: object, code: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise SubtitleLayoutError(code)
    result = float(value)
    if not math.isfinite(result):
        raise SubtitleLayoutError(code)
    return result


def _integer(value: object, code: str) -> int:
    result = _number(value, code)
    if result != int(result):
        raise SubtitleLayoutError(code)
    return int(result)


def _display_size(video: dict) -> tuple[int, int]:
    # SubtitleVideoMetadata.width/height are ALREADY display-oriented, matching
    # grounding metadata. Raw probe callers must supply encoded_* explicitly.
    if "display_width" in video and "display_height" in video:
        width, height = video["display_width"], video["display_height"]
    elif "encoded_width" in video and "encoded_height" in video:
        width, height = video["encoded_width"], video["encoded_height"]
        if video.get("rotation", 0) in {90, 270}:
            width, height = height, width
    else:
        width, height = video.get("width"), video.get("height")
    width = _integer(width, "invalid_video_dimensions")
    height = _integer(height, "invalid_video_dimensions")
    if not (160 <= width <= 8192 and 160 <= height <= 8192):
        raise SubtitleLayoutError("unsupported_canvas_dimensions")
    return width, height


def _bbox(segment: dict, width: int, height: int) -> tuple[int, int, int, int]:
    raw = segment.get("bbox_normalized")
    if not isinstance(raw, (list, tuple)) or len(raw) != 4:
        raise SubtitleLayoutError("invalid_bbox")
    values = [_number(value, "invalid_bbox") for value in raw]
    x1, y1, x2, y2 = values
    if not (0 <= x1 < x2 <= 999 and 0 <= y1 < y2 <= 999):
        raise SubtitleLayoutError("invalid_bbox")
    result = tuple(
        round(value / 999 * size)
        for value, size in zip(values, (width, height, width, height), strict=True)
    )
    if result[0] >= result[2] or result[1] >= result[3]:
        raise SubtitleLayoutError("bbox_below_pixel_resolution")
    return result


def _color(value: object) -> str | None:
    return value.upper() if isinstance(value, str) and _RGBA.fullmatch(value) else None


def _rgba(value: str) -> str:
    return value + "FF" if len(value) == 7 else value


def _luminance(color: str) -> float:
    channels = [int(color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [
        c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels
    ]
    return sum(
        c * weight for c, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True)
    )


def _contrast(first: str, second: str) -> float:
    high, low = sorted((_luminance(first), _luminance(second)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def _composite(foreground: str, background: str) -> str:
    rgba = _rgba(foreground)
    alpha = int(rgba[7:9], 16) / 255
    channels = [
        round(
            int(rgba[i : i + 2], 16) * alpha
            + int(background[i : i + 2], 16) * (1 - alpha)
        )
        for i in (1, 3, 5)
    ]
    return "#" + "".join(f"{channel:02X}" for channel in channels)


def _colors(segment: dict, style: dict, warnings: list[str]) -> tuple[str, str, str]:
    background = _color(segment.get("background_color"))
    if background is not None and len(background) != 7:
        background = None
    if background is None:
        warnings.append("background_unknown")
        recommended, panel = "#FFFFFF", DEFAULT_PANEL_COLOR
    else:
        channels = [int(background[i : i + 2], 16) for i in (1, 3, 5)]
        if min(channels) >= 245:
            recommended, panel = "#000000", "#00000000"
        elif max(channels) <= 16:
            recommended, panel = "#FFFFFF", "#00000000"
        else:
            recommended, panel = "#FFFFFF", DEFAULT_PANEL_COLOR
    text = recommended
    if style.get("background_color") is not None:
        panel = _color(style["background_color"])
        if panel is None:
            raise SubtitleLayoutError("invalid_panel_color")
        if _rgba(panel)[7:9] != "00":
            text = "#FFFFFF"
    if style.get("text_color") is not None:
        text = _color(style["text_color"])
        if text is None:
            raise SubtitleLayoutError("invalid_text_color")
    if background is not None:
        backdrop = _composite(panel, background)
        if _contrast(_composite(text, backdrop), backdrop) < 4.5:
            warnings.append("low_contrast")
    elif (
        style.get("text_color") is not None or style.get("background_color") is not None
    ):
        warnings.append("contrast_unverified")
    return recommended, _rgba(text), _rgba(panel)


def _text_width(font: ImageFont.FreeTypeFont, text: str) -> float:
    left, _, right, _ = font.getbbox(text)
    # Include overhangs as well as the advance, including trailing spaces.
    return max(font.getlength(text), right) - min(0, left)


def _largest_size(resource: _FontResource, upper: int, fits) -> int:
    low, high, answer = 1, upper, 0
    while low <= high:
        middle = (low + high) // 2
        if fits(resource.font(middle)):
            answer, low = middle, middle + 1
        else:
            high = middle - 1
    return answer


def _horizontal_limits(
    entries: list[tuple[int, int, int, dict, tuple[int, int, int, int]]],
    width: int,
) -> dict[str, tuple[int, int, bool]]:
    """Reserve half each original gap for simultaneous, vertically adjacent boxes."""
    limits = {}
    margin = math.ceil(width * 0.05)
    for start, end, _, segment, box in entries:
        left, right = min(box[0], margin), max(box[2], width - margin)
        overlap = False
        for other_start, other_end, _, other, neighbor in entries:
            if other["segment_id"] == segment["segment_id"]:
                continue
            if start >= other_end or other_start >= end:
                continue
            if box[1] >= neighbor[3] or neighbor[1] >= box[3]:
                continue
            if neighbor[2] <= box[0]:
                left = max(left, math.ceil((neighbor[2] + box[0]) / 2))
            elif box[2] <= neighbor[0]:
                right = min(right, math.floor((box[2] + neighbor[0]) / 2))
            else:
                overlap = True
        limits[segment["segment_id"]] = (
            box[0] if overlap else left,
            box[2] if overlap else right,
            overlap,
        )
    return limits


def _expand_box(
    box: tuple[int, int, int, int],
    desired: int,
    alignment: str,
    limits: tuple[int, int, bool],
) -> tuple[int, int, int, int]:
    left, right, _ = limits
    original_width = box[2] - box[0]
    if desired <= original_width:
        return box
    if alignment == "left":
        return (box[0], box[1], min(right, box[0] + desired), box[3])
    if alignment == "right":
        return (max(left, box[2] - desired), box[1], box[2], box[3])
    # Integer, equal expansion preserves even half-pixel original centers.
    growth = min(
        math.ceil((desired - original_width) / 2),
        box[0] - left,
        right - box[2],
    )
    return (box[0] - growth, box[1], box[2] + growth, box[3])


def _layout(
    segment: dict,
    video: dict,
    width: int,
    height: int,
    limits: tuple[int, int, bool],
) -> tuple[dict, dict]:
    warnings: list[str] = []
    text = segment.get("translated_text")
    if not isinstance(text, str) or not text.strip():
        raise SubtitleLayoutError("missing_translation")
    if len(text) > MAX_TEXT_LENGTH:
        raise SubtitleLayoutError("text_capacity_exceeded")
    if any(unicodedata.category(c) in {"Cc", "Zl", "Zp"} for c in text):
        raise SubtitleLayoutError("text_must_be_single_line")
    style = segment.get("style") or {}
    if not isinstance(style, Mapping):
        raise SubtitleLayoutError("invalid_style")
    alignment = style.get("alignment") or segment.get("alignment") or "center"
    if not isinstance(alignment, str) or alignment not in _ALIGNMENT:
        alignment = "center"
        warnings.append("alignment_defaulted")
    bbox = _bbox(segment, width, height)
    original_bbox = bbox
    box_height = bbox[3] - bbox[1]
    selected = style.get("font") or DEFAULT_FONT
    if not isinstance(selected, str):
        raise SubtitleLayoutError("font_resource_unavailable")
    url = FONT_RESOURCES.get(selected, selected)
    if not isinstance(url, str) or not _allowed_font_url(url):
        raise SubtitleLayoutError("font_resource_unavailable")
    resource = _load_font_resource(url)
    missing = sorted(
        {ord(c) for c in text if not c.isspace() and ord(c) not in resource.codepoints}
    )
    render_font = resource.url
    if missing:
        # MediaKit resolves this preset itself: never download an external
        # fallback font or claim that the preset matches our local font bytes.
        render_font = FALLBACK_FONT_ID
        warnings.extend(
            [
                "missing_glyphs",
                "font_fallback",
                "font_metrics_unverified",
                "preset_glyph_coverage_unverified",
            ]
        )
    if render_font in {CENTURY_GOTHIC_URL, CENTURY_GOTHIC_BOLD_URL}:
        warnings.append("font_url_version_unverified")
    estimated = _largest_size(
        resource,
        max(1, box_height * 4),
        lambda font: sum(font.getmetrics()) <= box_height,
    )
    if estimated < 1:
        raise SubtitleLayoutError("bbox_below_font_minimum")
    upper = estimated
    if style.get("font_size_px") is not None:
        requested = _number(style["font_size_px"], "invalid_font_size")
        if requested <= 0:
            raise SubtitleLayoutError("invalid_font_size")
        if requested < 1:
            warnings.append("font_size_minimum_applied")
        upper = min(upper, max(1, math.floor(requested)))
    desired_width = math.ceil(_text_width(resource.font(upper), text)) + 2
    bbox = _expand_box(bbox, desired_width, alignment, limits)
    box_width = bbox[2] - bbox[0]
    if limits[2]:
        warnings.append("original_bbox_overlap")
    if bbox != original_bbox:
        warnings.extend(["bbox_expanded", "expanded_background_unverified"])
    if (
        desired_width > box_width
        and desired_width > original_bbox[2] - original_bbox[0]
    ):
        warnings.append("bbox_expansion_limited")
    effective = _largest_size(
        resource,
        upper,
        lambda font: (
            _text_width(font, text) <= box_width
            and sum(font.getmetrics()) <= box_height
        ),
    )
    if effective < 1:
        # Never truncate, wrap or stretch to conceal text that cannot fit at 1px.
        raise SubtitleLayoutError("text_cannot_fit_at_minimum_font")
    font = resource.font(effective)
    if effective < upper or (
        style.get("font_size_px") is not None and effective < style["font_size_px"]
    ):
        warnings.append("font_size_reduced")
    if effective < 12:
        warnings.append("font_size_small")
    recommended, color, panel = _colors(segment, style, warnings)
    transform = {
        "type": "transform",
        "pos_x": bbox[0],
        "pos_y": bbox[1],
        "width": box_width,
        "height": box_height,
        "rotation": 0,
    }
    # Plain text stays literal in the JSON string. No ASS/SRT conversion,
    # XML/HTML interpretation, manual backslash escaping or text_res effects.
    element = {
        "type": "text",
        "text": text,
        "font_type": render_font,
        "font_size": effective,
        "font_color": color,
        "background_color": panel,
        "bold": False,
        "italic": False,
        "underline": False,
        "line_max_width": -1,
        "typesetting": 0,
        "align_type": _ALIGNMENT[alignment],
        "extra": [transform],
    }
    summary = {
        "segment_id": segment["segment_id"],
        "original_bbox_pixels": list(original_bbox),
        "render_bbox_pixels": list(bbox),
        "target_font_size_px": upper,
        "desired_text_width_px": desired_width,
        "estimated_font_size_px": estimated,
        "effective_font_size_px": effective,
        "recommended_text_color": recommended,
        "text_color": color,
        "background_color": panel,
        "alignment": alignment,
        "font_type": render_font,
        "font_sha256": resource.sha256 if not missing else None,
        "measurement_font_type": resource.url,
        "measurement_font_sha256": resource.sha256,
        "measured_text_width_px": _text_width(font, text),
        "ascent_px": font.getmetrics()[0],
        "descent_px": font.getmetrics()[1],
        "missing_glyphs": [f"U+{c:04X}" for c in missing],
        "fallback_fonts": [FALLBACK_FONT_ID] if missing else [],
        "warnings": warnings,
    }
    return element, summary


def compile_subtitle_project(segments: list[dict], video: dict) -> dict:
    """Return ``{project, layouts, warnings}``, without mutating input.

    video uses SubtitleVideoMetadata's display width/height, duration_ms, fps,
    rotation, has_audio, plus runtime-only source_url (signed clean asset URL).
    Optional reference_duration_ms enables timeline mismatch diagnostics and
    Missing glyphs use the MediaKit ALi_PuHui preset; its local metrics and
    coverage are unverified, so the selected font supplies estimates only.
    Never persist project source
    URLs into the workspace; refresh them at submission. layouts is a dict keyed
    by stable segment_id, compatible with the stage service's summary lookup.
    Both layouts and warnings are JSON-safe. Warnings are stable strings, with segment
    warnings also attached to their layout. Run this synchronous compiler in a
    worker thread because cold font retrieval and FreeType measurement block.
    """
    if not isinstance(segments, list) or not isinstance(video, dict):
        raise SubtitleLayoutError("invalid_compiler_input")
    if len(segments) > MAX_SEGMENTS:
        raise SubtitleLayoutError("segment_capacity_exceeded")
    width, height = _display_size(video)
    duration = _integer(video.get("duration_ms"), "invalid_video_duration")
    if duration <= 0:
        raise SubtitleLayoutError("invalid_video_duration")
    source = video.get("source_url") or video.get("url")
    parsed = urlsplit(source) if isinstance(source, str) else None
    if (
        parsed is None
        or parsed.scheme != "https"
        or not parsed.netloc
        or parsed.username
        or parsed.password
    ):
        raise SubtitleLayoutError("invalid_video_source")
    rotation = video.get("rotation", 0)
    if rotation not in {0, 90, 180, 270}:
        raise SubtitleLayoutError("unsupported_video_rotation")
    warnings = [
        "provider_text_capacity_unverified",
        CAPACITY_NOTICE,
        "provider_vertical_anchor_unverified",
        "provider_literal_escaping_unverified",
        "real_render_unverified",
    ]
    fps = video.get("fps")
    if fps not in SUPPORTED_FPS or isinstance(fps, bool):
        fps = 30
        warnings.append("fps_fallback_30")
    elif fps != 30:
        warnings.append("fps_support_local_contract_only")
    if rotation:
        # Do not rotate the source twice. MediaKit decodes the source's display
        # matrix; canvas coordinates already use its display orientation.
        warnings.append("source_rotation_real_render_unverified")
    has_audio = video.get("has_audio")
    if not isinstance(has_audio, bool):
        raise SubtitleLayoutError("video_audio_metadata_required")
    if not has_audio:
        warnings.append("source_has_no_audio")
    reference_duration = video.get("reference_duration_ms")
    if (
        reference_duration is not None
        and abs(_number(reference_duration, "invalid_reference_duration") - duration)
        > 250
    ):
        warnings.append("video_duration_mismatch")
    timed: list[tuple[int, int, int, dict, dict]] = []
    layouts: list[dict] = []
    entries: list[tuple[int, int, int, dict, tuple[int, int, int, int]]] = []
    identifiers: set[str] = set()
    for index, segment in enumerate(segments):
        if not isinstance(segment, dict):
            raise SubtitleLayoutError("invalid_segment")
        segment_id = segment.get("segment_id")
        if (
            not isinstance(segment_id, str)
            or not segment_id
            or segment_id in identifiers
        ):
            raise SubtitleLayoutError("invalid_segment_id")
        identifiers.add(segment_id)
        if segment.get("excluded"):
            layouts.append({"segment_id": segment_id, "excluded": True, "warnings": []})
            continue
        start = _integer(segment.get("start_ms"), "invalid_segment_time")
        end = _integer(segment.get("end_ms"), "invalid_segment_time")
        if start >= end:
            raise SubtitleLayoutError("invalid_segment_time", segment_id)
        if end <= 0 or start >= duration:
            layouts.append(
                {
                    "segment_id": segment_id,
                    "excluded": True,
                    "warnings": ["time_outside_video"],
                }
            )
            warnings.append(f"{segment_id}:time_outside_video")
            continue
        clipped_start, clipped_end = max(0, start), min(duration, end)
        try:
            box = _bbox(segment, width, height)
        except SubtitleLayoutError as exc:
            raise SubtitleLayoutError(exc.code, segment_id) from None
        entries.append((clipped_start, clipped_end, index, segment, box))
    limits = _horizontal_limits(entries, width)
    for clipped_start, clipped_end, index, segment, _ in entries:
        segment_id = segment["segment_id"]
        try:
            element, summary = _layout(
                segment, video, width, height, limits[segment_id]
            )
        except SubtitleLayoutError as exc:
            raise SubtitleLayoutError(exc.code, segment_id) from None
        if (segment["start_ms"], segment["end_ms"]) != (clipped_start, clipped_end):
            summary["warnings"].append("time_clipped")
        element["target_time"] = [clipped_start, clipped_end]
        summary["target_time"] = [clipped_start, clipped_end]
        layouts.append(summary)
        timed.append((clipped_start, clipped_end, index, element, summary))
        warnings.extend(f"{segment_id}:{warning}" for warning in summary["warnings"])
    if not timed:
        raise SubtitleLayoutError("no_renderable_subtitles")
    tracks: list[list[dict]] = [
        [
            {
                "type": "video",
                "source": source,
                "target_time": [0, duration],
            }
        ]
    ]
    ends: list[int] = []
    for start, end, _, element, summary in sorted(timed, key=lambda row: row[:3]):
        track_index = next(
            (i for i, previous_end in enumerate(ends) if previous_end <= start),
            len(ends),
        )
        if track_index == len(ends):
            tracks.append([])
            ends.append(end)
        else:
            ends[track_index] = end
        tracks[track_index + 1].append(element)
        summary["track_index"] = track_index + 1
    summaries_by_id = {summary["segment_id"]: summary for summary in layouts}
    return {
        "project": {
            "canvas": {
                "width": width,
                "height": height,
                "background_color": "#000000FF",
            },
            "track": tracks,
            "output": {
                "format": "mp4",
                "fps": int(fps),
                "disable_audio": not has_audio,
            },
        },
        "layouts": {
            segment["segment_id"]: summaries_by_id[segment["segment_id"]]
            for segment in segments
        },
        "warnings": warnings,
    }
