from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.app.services.mediakit import SubtitleSegment


def segments_to_srt(segments: Sequence["SubtitleSegment"]) -> str:
    """Convert ordered subtitle segments into standard SRT text.

    Returns an empty string when there are no renderable segments so the
    caller can skip the ffmpeg subtitle-burn step entirely. Input order is
    preserved (the MediaKit client already sorts segments by start time).
    """

    if not segments:
        return ""

    blocks: list[str] = []
    index = 1
    for segment in segments:
        text = _normalize_text(segment.text)
        if not text:
            continue

        start = float(segment.start_seconds)
        if start < 0:
            start = 0.0
        end = float(segment.end_seconds)
        # Guard against zero-length or inverted spans without reordering.
        end = max(end, start)

        blocks.append(
            f"{index}\n"
            f"{_format_srt_timestamp(start)} --> {_format_srt_timestamp(end)}\n"
            f"{text}"
        )
        index += 1

    if not blocks:
        return ""

    return "\n\n".join(blocks) + "\n"


def _format_srt_timestamp(seconds: float) -> str:
    """Format seconds as ``HH:MM:SS,mmm`` with millisecond precision."""

    if seconds < 0:
        seconds = 0.0
    total_milliseconds = int(round(seconds * 1000))
    hours, remainder = divmod(total_milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    whole_seconds, milliseconds = divmod(remainder, 1_000)
    return f"{hours:02d}:{minutes:02d}:{whole_seconds:02d},{milliseconds:03d}"


def _normalize_text(text: str) -> str:
    """Collapse internal whitespace/newlines to single spaces and trim."""

    if not text:
        return ""
    return " ".join(str(text).split())
