from __future__ import annotations

import asyncio
import io
import json
import shutil
import tempfile
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Literal

from PIL import Image, ImageOps, UnidentifiedImageError

from backend.app.core.config import ConfigurationError, Settings, get_settings
from backend.app.schemas import ReferenceAssetKind
from backend.app.schemas.seedance import (
    SeedanceModel,
    SeedanceTaskType,
    seedance_input_duration_limit,
    seedance_video_input_minimum,
)

MediaContainer = Literal[
    "bmp",
    "gif",
    "heic",
    "heif",
    "jpeg",
    "mov",
    "mp3",
    "mp4",
    "png",
    "tiff",
    "wav",
    "webp",
]

IMAGE_MAX_BYTES = 30 * 1024 * 1024
VIDEO_MAX_BYTES = 200 * 1024 * 1024
AUDIO_MAX_BYTES = 15 * 1024 * 1024
MIN_MEDIA_DIMENSION = 300
MAX_MEDIA_DIMENSION = 6000
MIN_MEDIA_ASPECT_RATIO = 0.4
MAX_MEDIA_ASPECT_RATIO = 2.5
MIN_VIDEO_PIXELS = 407_696
MAX_VIDEO_PIXELS = 8_295_044
MIN_VIDEO_FPS = 24.0
MAX_VIDEO_FPS = 60.0
MEDIA_INSPECTION_VERSION = 1


class MediaInspectionError(ValueError):
    pass


@dataclass(frozen=True)
class MediaInspection:
    kind: ReferenceAssetKind
    mime_type: str
    container: MediaContainer
    width: int | None = None
    height: int | None = None
    duration_seconds: float | None = None
    fps: float | None = None
    video_codec: str | None = None
    audio_codec: str | None = None

    def metadata(self) -> dict[str, object]:
        values: dict[str, object] = {
            "container": self.container,
            "inspection_version": MEDIA_INSPECTION_VERSION,
        }
        for key, value in (
            ("width", self.width),
            ("height", self.height),
            ("duration_seconds", self.duration_seconds),
            ("fps", self.fps),
            ("video_codec", self.video_codec),
            ("audio_codec", self.audio_codec),
        ):
            if value is not None:
                values[key] = value
        return values

    @classmethod
    def from_metadata(
        cls,
        kind: ReferenceAssetKind,
        mime_type: str | None,
        metadata: dict[str, object],
    ) -> "MediaInspection | None":
        if metadata.get("inspection_version") != MEDIA_INSPECTION_VERSION:
            return None
        container = metadata.get("container")
        if not isinstance(container, str):
            return None
        return cls(
            kind=kind,
            mime_type=mime_type or "",
            container=container,  # type: ignore[arg-type]
            width=_optional_number(metadata.get("width"), integer=True),
            height=_optional_number(metadata.get("height"), integer=True),
            duration_seconds=_optional_number(metadata.get("duration_seconds")),
            fps=_optional_number(metadata.get("fps")),
            video_codec=_optional_text(metadata.get("video_codec")),
            audio_codec=_optional_text(metadata.get("audio_codec")),
        )


class MediaInspector:
    def __init__(self, settings: Settings | None = None) -> None:
        settings = settings or get_settings()
        self.ffprobe_path = (
            str(Path(settings.composer_ffmpeg_path).with_name("ffprobe"))
            if settings.composer_ffmpeg_path
            else shutil.which("ffprobe")
        )
        self.timeout_seconds = settings.composer_timeout_seconds

    async def inspect(
        self,
        kind: ReferenceAssetKind,
        content: bytes,
        *,
        filename: str | None,
        mime_type: str | None,
    ) -> MediaInspection:
        _validate_file_size(kind, len(content))
        if kind == ReferenceAssetKind.IMAGE:
            return inspect_image(content)
        return await self._inspect_av(
            kind,
            content,
            filename=filename,
            mime_type=mime_type,
        )

    async def _inspect_av(
        self,
        kind: ReferenceAssetKind,
        content: bytes,
        *,
        filename: str | None,
        mime_type: str | None,
    ) -> MediaInspection:
        if not self.ffprobe_path:
            raise ConfigurationError("FFprobe is required to inspect media uploads.")
        suffix = Path(filename or "").suffix or _suffix_for_mime(mime_type)
        with tempfile.TemporaryDirectory(prefix="ad-media-inspect-") as tmp:
            source_path = Path(tmp) / f"source{suffix}"
            source_path.write_bytes(content)
            payload = await self._run_ffprobe(source_path)
        if kind == ReferenceAssetKind.VIDEO:
            return _parse_video_probe(payload, filename=filename, mime_type=mime_type)
        return _parse_audio_probe(payload, filename=filename, mime_type=mime_type)

    async def _run_ffprobe(self, source_path: Path) -> dict[str, object]:
        process = await asyncio.create_subprocess_exec(
            self.ffprobe_path,
            "-v",
            "error",
            "-show_entries",
            (
                "format=format_name,duration:format_tags=major_brand:"
                "stream=codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,duration"
            ),
            "-of",
            "json",
            str(source_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.timeout_seconds,
            )
        except TimeoutError as exc:
            process.kill()
            await process.communicate()
            raise MediaInspectionError("media inspection timed out") from exc
        if process.returncode != 0:
            message = stderr.decode(errors="replace")[-300:]
            raise MediaInspectionError(
                f"media content could not be inspected: {message}"
            )
        try:
            parsed = json.loads(stdout)
        except json.JSONDecodeError as exc:
            raise MediaInspectionError(
                "media inspection returned invalid metadata"
            ) from exc
        if not isinstance(parsed, dict):
            raise MediaInspectionError("media inspection returned invalid metadata")
        return parsed


def inspect_image(content: bytes) -> MediaInspection:
    try:
        try:
            from pillow_heif import register_heif_opener

            register_heif_opener()
        except ImportError:
            pass
        with Image.open(io.BytesIO(content)) as raw_image:
            image = ImageOps.exif_transpose(raw_image)
            image.load()
            detected_format = (raw_image.format or "").upper()
            width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise MediaInspectionError(
            "image content is not a supported image"
        ) from exc
    formats: dict[str, tuple[MediaContainer, str]] = {
        "BMP": ("bmp", "image/bmp"),
        "GIF": ("gif", "image/gif"),
        "HEIC": ("heic", "image/heic"),
        "HEIF": ("heif", "image/heif"),
        "JPEG": ("jpeg", "image/jpeg"),
        "PNG": ("png", "image/png"),
        "TIFF": ("tiff", "image/tiff"),
        "WEBP": ("webp", "image/webp"),
    }
    if detected_format not in formats:
        raise MediaInspectionError(
            f"unsupported image format: {detected_format or 'unknown'}"
        )
    _validate_dimensions(width, height, label="image")
    container, mime_type = formats[detected_format]
    return MediaInspection(
        kind=ReferenceAssetKind.IMAGE,
        mime_type=mime_type,
        container=container,
        width=width,
        height=height,
    )


def _parse_video_probe(
    payload: dict[str, object],
    *,
    filename: str | None,
    mime_type: str | None,
) -> MediaInspection:
    streams = _streams(payload)
    video = next(
        (stream for stream in streams if stream.get("codec_type") == "video"),
        None,
    )
    if video is None:
        raise MediaInspectionError("video file has no video stream")
    container = _video_container(payload, filename=filename, mime_type=mime_type)
    video_codec = str(video.get("codec_name") or "").lower()
    if video_codec not in {"h264", "hevc"}:
        raise MediaInspectionError(
            "video codec must be H.264/AVC or H.265/HEVC"
        )
    audio = next(
        (stream for stream in streams if stream.get("codec_type") == "audio"),
        None,
    )
    audio_codec = str(audio.get("codec_name") or "").lower() if audio else None
    allowed_audio = (
        {"aac", "mp3"}
        if container == "mp4"
        else {"aac", "mp3", "pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le"}
    )
    if audio_codec and audio_codec not in allowed_audio:
        raise MediaInspectionError(
            f"{container.upper()} audio codec is not supported: {audio_codec}"
        )
    width = _positive_int(video.get("width"), "video width")
    height = _positive_int(video.get("height"), "video height")
    _validate_dimensions(width, height, label="video")
    pixels = width * height
    if not MIN_VIDEO_PIXELS <= pixels <= MAX_VIDEO_PIXELS:
        raise MediaInspectionError(
            f"video pixel count {pixels} must be between "
            f"{MIN_VIDEO_PIXELS} and {MAX_VIDEO_PIXELS}"
        )
    fps = _frame_rate(video)
    if not MIN_VIDEO_FPS <= fps <= MAX_VIDEO_FPS:
        raise MediaInspectionError(
            f"video frame rate {fps:g} FPS must be between "
            f"{MIN_VIDEO_FPS:g} and {MAX_VIDEO_FPS:g} FPS"
        )
    duration = _duration(payload, video)
    return MediaInspection(
        kind=ReferenceAssetKind.VIDEO,
        mime_type="video/mp4" if container == "mp4" else "video/quicktime",
        container=container,
        width=width,
        height=height,
        duration_seconds=duration,
        fps=fps,
        video_codec=video_codec,
        audio_codec=audio_codec,
    )


def _parse_audio_probe(
    payload: dict[str, object],
    *,
    filename: str | None,
    mime_type: str | None,
) -> MediaInspection:
    streams = _streams(payload)
    audio = next(
        (stream for stream in streams if stream.get("codec_type") == "audio"),
        None,
    )
    if audio is None:
        raise MediaInspectionError("audio file has no audio stream")
    format_names = _format_names(payload)
    suffix = Path(filename or "").suffix.lower()
    normalized_mime = (mime_type or "").split(";", 1)[0].strip().lower()
    if "mp3" in format_names and (
        suffix in {"", ".mp3"} or normalized_mime in {"", "audio/mpeg"}
    ):
        container: MediaContainer = "mp3"
        resolved_mime = "audio/mpeg"
    elif "wav" in format_names and (
        suffix in {"", ".wav"} or normalized_mime in {"", "audio/wav", "audio/x-wav"}
    ):
        container = "wav"
        resolved_mime = "audio/wav"
    else:
        raise MediaInspectionError("audio format must be WAV or MP3")
    return MediaInspection(
        kind=ReferenceAssetKind.AUDIO,
        mime_type=resolved_mime,
        container=container,
        duration_seconds=_duration(payload, audio),
        audio_codec=str(audio.get("codec_name") or "").lower() or None,
    )


def _validate_file_size(kind: ReferenceAssetKind, size: int) -> None:
    if size <= 0:
        raise MediaInspectionError(f"{kind.value} file is empty")
    maximum = {
        ReferenceAssetKind.IMAGE: IMAGE_MAX_BYTES,
        ReferenceAssetKind.VIDEO: VIDEO_MAX_BYTES,
        ReferenceAssetKind.AUDIO: AUDIO_MAX_BYTES,
    }[kind]
    if kind == ReferenceAssetKind.IMAGE:
        if size >= maximum:
            raise MediaInspectionError("image file must be smaller than 30 MB")
    elif size > maximum:
        raise MediaInspectionError(
            f"{kind.value} file exceeds {maximum // 1024 // 1024} MB"
        )


def _validate_dimensions(width: int, height: int, *, label: str) -> None:
    if not (
        MIN_MEDIA_DIMENSION <= width <= MAX_MEDIA_DIMENSION
        and MIN_MEDIA_DIMENSION <= height <= MAX_MEDIA_DIMENSION
    ):
        raise MediaInspectionError(
            f"{label} width and height must be between "
            f"{MIN_MEDIA_DIMENSION} and {MAX_MEDIA_DIMENSION} px"
        )
    ratio = width / height
    if not MIN_MEDIA_ASPECT_RATIO <= ratio <= MAX_MEDIA_ASPECT_RATIO:
        raise MediaInspectionError(
            f"{label} aspect ratio {ratio:.3f} must be between "
            f"{MIN_MEDIA_ASPECT_RATIO} and {MAX_MEDIA_ASPECT_RATIO}"
        )


def _video_container(
    payload: dict[str, object],
    *,
    filename: str | None,
    mime_type: str | None,
) -> Literal["mp4", "mov"]:
    format_names = _format_names(payload)
    if not format_names.intersection({"mov", "mp4"}):
        raise MediaInspectionError("video container must be MP4 or MOV")
    suffix = Path(filename or "").suffix.lower()
    normalized_mime = (mime_type or "").split(";", 1)[0].strip().lower()
    major_brand = str(
        (payload.get("format") or {}).get("tags", {}).get("major_brand", "")
        if isinstance(payload.get("format"), dict)
        else ""
    ).strip().lower()
    if suffix == ".mov" or normalized_mime == "video/quicktime" or major_brand == "qt":
        return "mov"
    if suffix not in {"", ".mp4"} or normalized_mime not in {"", "video/mp4"}:
        raise MediaInspectionError("video filename and MIME must identify MP4 or MOV")
    return "mp4"


def _streams(payload: dict[str, object]) -> list[dict[str, object]]:
    streams = payload.get("streams")
    if not isinstance(streams, list):
        return []
    return [item for item in streams if isinstance(item, dict)]


def _format_names(payload: dict[str, object]) -> set[str]:
    format_value = payload.get("format")
    if not isinstance(format_value, dict):
        return set()
    raw = str(format_value.get("format_name") or "")
    return {part.strip().lower() for part in raw.split(",") if part.strip()}


def _positive_int(value: object, label: str) -> int:
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise MediaInspectionError(f"{label} is unavailable") from exc
    if parsed <= 0:
        raise MediaInspectionError(f"{label} is unavailable")
    return parsed


def _duration(
    payload: dict[str, object],
    stream: dict[str, object],
) -> float:
    format_value = payload.get("format")
    candidates = [
        stream.get("duration"),
        format_value.get("duration") if isinstance(format_value, dict) else None,
    ]
    for value in candidates:
        try:
            parsed = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        if parsed > 0:
            return parsed
    raise MediaInspectionError("media duration is unavailable")


def _frame_rate(stream: dict[str, object]) -> float:
    for key in ("avg_frame_rate", "r_frame_rate"):
        raw = stream.get(key)
        if not isinstance(raw, str) or raw in {"", "0/0"}:
            continue
        try:
            value = float(Fraction(raw))
        except (ValueError, ZeroDivisionError):
            continue
        if value > 0:
            return value
    raise MediaInspectionError("video frame rate is unavailable")


def _suffix_for_mime(mime_type: str | None) -> str:
    return {
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
    }.get((mime_type or "").split(";", 1)[0].strip().lower(), "")


def _optional_number(
    value: object,
    *,
    integer: bool = False,
) -> int | float | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    if not value > 0:
        return None
    return int(value) if integer else float(value)


def _optional_text(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def get_media_inspector() -> MediaInspector:
    return MediaInspector()


def validate_seedance_media_inputs(
    *,
    model: SeedanceModel,
    task_type: SeedanceTaskType,
    videos: list[MediaInspection],
    audios: list[MediaInspection],
) -> None:
    maximum = seedance_input_duration_limit(model)
    video_minimum = seedance_video_input_minimum(model, task_type)
    for index, media in enumerate(videos, start=1):
        duration = media.duration_seconds
        if duration is None or not video_minimum <= duration <= maximum:
            actual = "unknown" if duration is None else f"{duration:g}"
            raise MediaInspectionError(
                f"reference video {index} duration {actual}s must be between "
                f"{video_minimum} and {maximum}s"
            )
    total_video_duration = sum(
        media.duration_seconds or 0 for media in videos
    )
    if total_video_duration > maximum:
        raise MediaInspectionError(
            f"reference video total duration {total_video_duration:g}s "
            f"exceeds {maximum}s"
        )
    for index, media in enumerate(audios, start=1):
        duration = media.duration_seconds
        if duration is None or not 2 <= duration <= maximum:
            actual = "unknown" if duration is None else f"{duration:g}"
            raise MediaInspectionError(
                f"reference audio {index} duration {actual}s must be between "
                f"2 and {maximum}s"
            )
    total_audio_duration = sum(
        media.duration_seconds or 0 for media in audios
    )
    if total_audio_duration > maximum:
        raise MediaInspectionError(
            f"reference audio total duration {total_audio_duration:g}s "
            f"exceeds {maximum}s"
        )
