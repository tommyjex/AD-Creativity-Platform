from __future__ import annotations

import asyncio
import json
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from backend.app.core.config import ConfigurationError, Settings, get_settings


class VideoNormalizationError(RuntimeError):
    """Raised when an uploaded video cannot be normalized for browser playback."""


@dataclass(frozen=True)
class NormalizedVideo:
    content: bytes
    normalized: bool
    source_format: str


class VideoNormalizer:
    """Normalizes non-MP4 video containers to browser-compatible MP4."""

    def __init__(self, settings: Settings | None = None) -> None:
        settings = settings or get_settings()
        self.ffmpeg_path = settings.composer_ffmpeg_path or shutil.which("ffmpeg")
        self.ffprobe_path = (
            str(Path(settings.composer_ffmpeg_path).with_name("ffprobe"))
            if settings.composer_ffmpeg_path
            else shutil.which("ffprobe")
        )
        self.timeout_seconds = settings.composer_timeout_seconds

    async def normalize_if_needed(self, content: bytes) -> NormalizedVideo:
        if not content:
            raise VideoNormalizationError("uploaded video is empty")
        if not self.ffmpeg_path or not self.ffprobe_path:
            raise ConfigurationError(
                "FFmpeg and FFprobe are required to normalize uploaded videos."
            )

        with tempfile.TemporaryDirectory(prefix="ad-video-normalize-") as tmp:
            tmp_dir = Path(tmp)
            source_path = tmp_dir / "source"
            output_path = tmp_dir / "normalized.mp4"
            source_path.write_bytes(content)
            source_format = await self._probe_format(source_path)
            if _is_standard_mp4(source_format):
                return NormalizedVideo(
                    content=content,
                    normalized=False,
                    source_format=source_format,
                )
            await self._run_ffmpeg(source_path, output_path)
            normalized_content = output_path.read_bytes()

        if not normalized_content:
            raise VideoNormalizationError("video normalization produced an empty file")
        return NormalizedVideo(
            content=normalized_content,
            normalized=True,
            source_format=source_format,
        )

    async def _probe_format(self, source_path: Path) -> str:
        stdout = await self._run_process(
            [
                self.ffprobe_path,
                "-v",
                "error",
                "-show_entries",
                "format=format_name",
                "-of",
                "json",
                str(source_path),
            ]
        )
        try:
            format_name = json.loads(stdout).get("format", {}).get("format_name")
        except (AttributeError, json.JSONDecodeError) as exc:
            raise VideoNormalizationError("uploaded video format could not be identified") from exc
        if not isinstance(format_name, str) or not format_name:
            raise VideoNormalizationError("uploaded video format could not be identified")
        return format_name

    async def _run_ffmpeg(self, source_path: Path, output_path: Path) -> None:
        await self._run_process(
            [
                self.ffmpeg_path,
                "-y",
                "-i",
                str(source_path),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                str(output_path),
            ]
        )

    async def _run_process(self, command: list[str]) -> str:
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.timeout_seconds,
            )
        except TimeoutError as exc:
            raise VideoNormalizationError("video normalization timed out") from exc
        except OSError as exc:
            raise VideoNormalizationError("video normalization could not start") from exc
        if process.returncode != 0:
            raise VideoNormalizationError(
                f"video normalization failed: {stderr.decode(errors='replace')[-500:]}"
            )
        return stdout.decode(errors="replace")


def _is_standard_mp4(source_format: str) -> bool:
    return any(
        part in {"mov", "mp4", "m4a", "3gp", "3g2", "mj2"}
        for part in source_format.lower().split(",")
    )


def get_video_normalizer() -> VideoNormalizer:
    return VideoNormalizer()
