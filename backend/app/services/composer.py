from __future__ import annotations

import asyncio
import json
import mimetypes
import shlex
import shutil
import tempfile
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from backend.app.core.config import ConfigurationError, Settings, get_settings
from backend.app.schemas import Brief
from backend.app.services.assets import (
    DownloadedAsset,
    HttpRemoteAssetDownloader,
    RemoteAssetDownloader,
)


class VideoCompositionError(RuntimeError):
    """Raised when final video composition fails with safe diagnostics."""

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.detail = detail


@dataclass(frozen=True)
class CompositionSource:
    asset_id: str
    url: str
    index: int


@dataclass(frozen=True)
class CompositionResult:
    content: bytes
    mime_type: str
    duration_seconds: float | None
    metadata: dict[str, str | int | float | bool | None]


class VideoComposer(Protocol):
    async def compose(
        self,
        *,
        project_id: str,
        brief: Brief,
        sources: list[CompositionSource],
    ) -> CompositionResult:
        """Compose source videos into one final MP4."""

    async def burn_subtitles(
        self,
        *,
        base_video: bytes,
        srt_text: str,
        brief: Brief,
    ) -> CompositionResult:
        """Burn SRT subtitles into a base video as hard subs."""


class FfmpegVideoComposer:
    def __init__(
        self,
        settings: Settings | None = None,
        *,
        downloader: RemoteAssetDownloader | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.ffmpeg_path = self.settings.composer_ffmpeg_path or shutil.which("ffmpeg")
        self.downloader = downloader or HttpRemoteAssetDownloader(
            timeout_seconds=self.settings.asset_download_timeout_seconds,
            max_bytes=self.settings.asset_download_max_bytes,
        )
        self.timeout_seconds = self.settings.composer_timeout_seconds

    async def compose(
        self,
        *,
        project_id: str,
        brief: Brief,
        sources: list[CompositionSource],
    ) -> CompositionResult:
        if not sources:
            raise VideoCompositionError(
                "no storyboard videos are available for composition",
                detail="source_video_count=0",
            )
        if not self.ffmpeg_path:
            raise ConfigurationError(
                "FFmpeg is not installed or COMPOSER_FFMPEG_PATH is not configured."
            )

        target_width, target_height = _target_dimensions(brief.aspect_ratio)
        sorted_sources = sorted(sources, key=lambda source: source.index)

        with tempfile.TemporaryDirectory(prefix=f"ad-compose-{project_id}-") as tmp:
            tmp_dir = Path(tmp)
            normalized_paths: list[Path] = []
            for position, source in enumerate(sorted_sources, start=1):
                try:
                    downloaded = await self.downloader.fetch(
                        source.url,
                        expected_mime_type="video/*",
                    )
                except Exception as exc:
                    raise VideoCompositionError(
                        "source video could not be downloaded",
                        detail=_compose_detail(
                            phase="download",
                            asset_id=source.asset_id,
                            reason=type(exc).__name__,
                        ),
                    ) from exc
                source_path = _write_source_video(tmp_dir, position, downloaded)
                normalized_path = tmp_dir / f"normalized-{position:03d}.mp4"
                await self._run_ffmpeg(
                    [
                        self.ffmpeg_path,
                        "-y",
                        "-i",
                        str(source_path),
                        "-map",
                        "0:v:0",
                        "-map",
                        "0:a?",
                        "-vf",
                        (
                            f"scale={target_width}:{target_height}:"
                            "force_original_aspect_ratio=decrease,"
                            f"pad={target_width}:{target_height}:"
                            "(ow-iw)/2:(oh-ih)/2,setsar=1"
                        ),
                        "-r",
                        "24",
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
                        "-b:a",
                        "128k",
                        "-ar",
                        "48000",
                        "-ac",
                        "2",
                        str(normalized_path),
                    ],
                    phase="normalize",
                    asset_id=source.asset_id,
                )
                normalized_paths.append(normalized_path)

            list_path = tmp_dir / "concat.txt"
            list_path.write_text(
                "".join(
                    f"file {shlex.quote(str(path))}\n"
                    for path in normalized_paths
                ),
                encoding="utf-8",
            )
            output_path = tmp_dir / "final.mp4"
            await self._run_ffmpeg(
                [
                    self.ffmpeg_path,
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    str(list_path),
                    "-c",
                    "copy",
                    "-movflags",
                    "+faststart",
                    str(output_path),
                ],
                phase="concat",
            )
            content = output_path.read_bytes()

        if not content:
            raise VideoCompositionError(
                "composition produced an empty video",
                detail="output_size_bytes=0",
            )

        return CompositionResult(
            content=content,
            mime_type="video/mp4",
            duration_seconds=None,
            metadata={
                "provider": "ffmpeg-composer",
                "compose_mode": "concat",
                "target_platform": brief.target_platform,
                "aspect_ratio": brief.aspect_ratio,
                "duration_seconds": brief.duration_seconds,
                "source_video_count": len(sorted_sources),
                "source_asset_ids": ",".join(source.asset_id for source in sorted_sources),
                "target_width": target_width,
                "target_height": target_height,
            },
        )

    async def burn_subtitles(
        self,
        *,
        base_video: bytes,
        srt_text: str,
        brief: Brief,
    ) -> CompositionResult:
        if not srt_text.strip():
            return CompositionResult(
                content=base_video,
                mime_type="video/mp4",
                duration_seconds=None,
                metadata={
                    "provider": "ffmpeg-composer",
                    "subtitle_mode": "skipped",
                    "aspect_ratio": brief.aspect_ratio,
                },
            )

        if not self.ffmpeg_path:
            raise ConfigurationError(
                "FFmpeg is not installed or COMPOSER_FFMPEG_PATH is not configured."
            )

        with tempfile.TemporaryDirectory(prefix="ad-subtitles-") as tmp:
            tmp_dir = Path(tmp)
            base_path = tmp_dir / "base.mp4"
            base_path.write_bytes(base_video)
            srt_path = tmp_dir / "subs.srt"
            srt_path.write_text(srt_text, encoding="utf-8")

            output_path = tmp_dir / "final.mp4"
            escaped_srt = _escape_subtitles_path(str(srt_path))
            subtitle_filter = (
                f"subtitles=filename='{escaped_srt}':force_style="
                "'Alignment=2,FontSize=18,PrimaryColour=&H00FFFFFF&,"
                "OutlineColour=&H00000000&,Outline=2,Shadow=0,MarginV=40'"
            )
            await self._run_ffmpeg(
                [
                    self.ffmpeg_path,
                    "-y",
                    "-i",
                    str(base_path),
                    "-vf",
                    subtitle_filter,
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "23",
                    "-c:a",
                    "copy",
                    "-movflags",
                    "+faststart",
                    str(output_path),
                ],
                phase="subtitles",
            )
            content = output_path.read_bytes()

        if not content:
            raise VideoCompositionError(
                "subtitle burn produced an empty video",
                detail="output_size_bytes=0",
            )

        return CompositionResult(
            content=content,
            mime_type="video/mp4",
            duration_seconds=None,
            metadata={
                "provider": "ffmpeg-composer",
                "subtitle_mode": "burned",
                "aspect_ratio": brief.aspect_ratio,
                "target_platform": brief.target_platform,
                "output_size_bytes": len(content),
            },
        )

    async def _run_ffmpeg(
        self,
        command: list[str],
        *,
        phase: str,
        asset_id: str | None = None,
    ) -> None:
        # #region debug-point F1-F2-F5:ffmpeg-command
        if phase == "subtitles":
            exec("try:\n urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:7777/event',data=json.dumps({'sessionId':'mediakit-asr-failure','runId':'ffmpeg-post-fix','hypothesisId':'F1-F2-F5','location':'composer.py:_run_ffmpeg','msg':'[DEBUG] FFmpeg subtitle command','data':{'executable':command[0],'has_vf':'-vf' in command,'filter_name':'subtitles','argument_count':len(command)},'ts':int(time.time()*1000)}).encode(),headers={'Content-Type':'application/json'}),timeout=0.5).read()\nexcept Exception:\n pass")
        # #endregion
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.timeout_seconds,
            )
            # #region debug-point F1-F2-F3-F4-F5:ffmpeg-result
            if phase == "subtitles":
                exec("try:\n urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:7777/event',data=json.dumps({'sessionId':'mediakit-asr-failure','runId':'ffmpeg-post-fix','hypothesisId':'F1-F2-F3-F4-F5','location':'composer.py:_run_ffmpeg','msg':'[DEBUG] FFmpeg subtitle result','data':{'returncode':process.returncode,'stderr_tail':stderr.decode(errors='replace')[-2000:]},'ts':int(time.time()*1000)}).encode(),headers={'Content-Type':'application/json'}),timeout=0.5).read()\nexcept Exception:\n pass")
            # #endregion
        except TimeoutError as exc:
            raise VideoCompositionError(
                "FFmpeg composition timed out",
                detail=_compose_detail(phase=phase, asset_id=asset_id, reason="timeout"),
            ) from exc

        if process.returncode != 0:
            raise VideoCompositionError(
                "FFmpeg composition failed",
                detail=_compose_detail(
                    phase=phase,
                    asset_id=asset_id,
                    returncode=process.returncode,
                    stderr=stderr,
                ),
            )


def _write_source_video(
    tmp_dir: Path,
    position: int,
    downloaded: DownloadedAsset,
) -> Path:
    extension = mimetypes.guess_extension(downloaded.mime_type) or ".mp4"
    path = tmp_dir / f"source-{position:03d}{extension}"
    path.write_bytes(downloaded.content)
    return path


def _target_dimensions(aspect_ratio: str) -> tuple[int, int]:
    if aspect_ratio == "16:9":
        return (1280, 720)
    if aspect_ratio == "1:1":
        return (720, 720)
    if aspect_ratio == "4:3":
        return (960, 720)
    if aspect_ratio == "3:4":
        return (720, 960)
    return (720, 1280)


def _escape_subtitles_path(path: str) -> str:
    """Escape a filesystem path for use inside the ffmpeg subtitles filter.

    The subtitles filter treats backslashes, colons and single quotes as
    special characters, so they must be escaped when embedded in the filter
    string. Order matters: backslashes are escaped first.
    """

    escaped = path.replace("\\", "\\\\")
    escaped = escaped.replace(":", "\\:")
    escaped = escaped.replace("'", "\\'")
    return escaped


def _compose_detail(
    *,
    phase: str,
    asset_id: str | None = None,
    reason: str | None = None,
    returncode: int | None = None,
    stderr: bytes | None = None,
) -> str:
    parts = [f"phase={phase}"]
    if asset_id:
        parts.append(f"asset_id={asset_id}")
    if reason:
        parts.append(f"reason={reason}")
    if returncode is not None:
        parts.append(f"returncode={returncode}")
    if stderr:
        text = stderr.decode(errors="replace")
        text = " ".join(text.split())
        if len(text) > 500:
            text = f"{text[:500]}..."
        parts.append(f"stderr={text}")
    return "; ".join(parts)


def get_video_composer() -> VideoComposer:
    return FfmpegVideoComposer()
