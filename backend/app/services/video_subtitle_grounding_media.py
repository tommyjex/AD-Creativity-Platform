from __future__ import annotations

import asyncio
import ipaddress
import json
import os
import shutil
import socket
import tempfile
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.parse import urljoin, urlsplit

import httpx

from backend.app.core.config import ConfigurationError, Settings, get_settings
from backend.app.schemas.video_subtitle_grounding import (
    VIDEO_SUBTITLE_GROUNDING_MAX_VIDEO_DURATION_MS,
    VideoSubtitleGroundingErrorCode,
    VideoSubtitleGroundingErrorPhase,
)
from backend.app.services.media_inspector import (
    MediaInspectionError,
    VideoDisplayMetadata,
    parse_video_display_metadata,
)

VIDEO_MIME_TYPES = frozenset(
    {
        "video/3gpp",
        "video/avi",
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "video/webm",
        "video/x-matroska",
        "video/x-msvideo",
    }
)
REDIRECT_STATUS_CODES = frozenset({301, 302, 303, 307, 308})
METADATA_HOSTNAMES = frozenset(
    {
        "metadata",
        "metadata.google.internal",
        "metadata.google.com",
    }
)

DnsResolver = Callable[[str, int], Awaitable[Iterable[str]]]


class RemoteVideoError(ValueError):
    def __init__(
        self,
        *,
        code: VideoSubtitleGroundingErrorCode,
        phase: VideoSubtitleGroundingErrorPhase,
        message: str,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.phase = phase


@dataclass(frozen=True)
class DownloadedRemoteVideo:
    path: Path
    mime_type: str
    size_bytes: int


@dataclass(frozen=True)
class PreparedRemoteVideo:
    path: Path
    mime_type: str
    size_bytes: int
    metadata: VideoDisplayMetadata


class VideoPathInspector(Protocol):
    async def inspect(self, path: Path) -> VideoDisplayMetadata:
        """Inspect one local video without taking ownership of its path."""


class SecureRemoteVideoDownloader:
    def __init__(
        self,
        settings: Settings | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        resolver: DnsResolver | None = None,
        temp_dir: Path | None = None,
        max_bytes: int | None = None,
        connect_timeout_seconds: float | None = None,
        read_timeout_seconds: float | None = None,
        total_timeout_seconds: float | None = None,
        max_redirects: int | None = None,
    ) -> None:
        settings = settings or get_settings()
        self.transport = transport
        self.resolver = resolver or _resolve_host
        self.temp_dir = temp_dir
        self.max_bytes = (
            max_bytes
            if max_bytes is not None
            else settings.video_subtitle_grounding_download_max_bytes
        )
        self.connect_timeout_seconds = (
            connect_timeout_seconds
            if connect_timeout_seconds is not None
            else settings.video_subtitle_grounding_download_connect_timeout_seconds
        )
        self.read_timeout_seconds = (
            read_timeout_seconds
            if read_timeout_seconds is not None
            else settings.video_subtitle_grounding_download_read_timeout_seconds
        )
        self.total_timeout_seconds = (
            total_timeout_seconds
            if total_timeout_seconds is not None
            else settings.video_subtitle_grounding_download_total_timeout_seconds
        )
        self.max_redirects = (
            max_redirects
            if max_redirects is not None
            else settings.video_subtitle_grounding_max_redirects
        )

    @asynccontextmanager
    async def open(self, url: str) -> AsyncIterator[DownloadedRemoteVideo]:
        downloaded: DownloadedRemoteVideo | None = None
        try:
            try:
                async with asyncio.timeout(self.total_timeout_seconds):
                    downloaded = await self._download(url)
            except TimeoutError as exc:
                raise RemoteVideoError(
                    code=VideoSubtitleGroundingErrorCode.VIDEO_DOWNLOAD_FAILED,
                    phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
                    message="The video download timed out.",
                ) from exc
            yield downloaded
        finally:
            if downloaded is not None:
                with suppress(OSError):
                    downloaded.path.unlink()

    async def _download(self, url: str) -> DownloadedRemoteVideo:
        timeout = httpx.Timeout(
            connect=self.connect_timeout_seconds,
            read=self.read_timeout_seconds,
            write=self.read_timeout_seconds,
            pool=self.connect_timeout_seconds,
        )
        path: Path | None = None
        try:
            async with httpx.AsyncClient(
                follow_redirects=False,
                timeout=timeout,
                transport=self.transport,
                trust_env=False,
            ) as client:
                current_url = url
                redirects = 0
                while True:
                    await validate_public_https_url(
                        current_url,
                        resolver=self.resolver,
                    )
                    try:
                        request = client.build_request("GET", current_url)
                        response = await client.send(request, stream=True)
                    except httpx.TimeoutException as exc:
                        raise RemoteVideoError(
                            code=(
                                VideoSubtitleGroundingErrorCode.VIDEO_DOWNLOAD_FAILED
                            ),
                            phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
                            message="The video download timed out.",
                        ) from exc
                    except httpx.HTTPError as exc:
                        raise RemoteVideoError(
                            code=(
                                VideoSubtitleGroundingErrorCode.VIDEO_DOWNLOAD_FAILED
                            ),
                            phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
                            message="The video could not be downloaded.",
                        ) from exc

                    try:
                        if response.status_code in REDIRECT_STATUS_CODES:
                            location = response.headers.get("location")
                            if not location or redirects >= self.max_redirects:
                                raise _invalid_url(
                                    "The video URL has an invalid redirect."
                                )
                            current_url = urljoin(current_url, location)
                            redirects += 1
                            continue

                        try:
                            response.raise_for_status()
                        except httpx.HTTPStatusError as exc:
                            raise RemoteVideoError(
                                code=(
                                    VideoSubtitleGroundingErrorCode
                                    .VIDEO_DOWNLOAD_FAILED
                                ),
                                phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
                                message="The video could not be downloaded.",
                            ) from exc

                        mime_type = _validate_video_response(
                            response,
                            max_bytes=self.max_bytes,
                        )
                        descriptor, raw_path = tempfile.mkstemp(
                            prefix="ad-video-grounding-",
                            suffix=_suffix_for_mime(mime_type),
                            dir=self.temp_dir,
                        )
                        path = Path(raw_path)
                        os.chmod(path, 0o600)
                        size = 0
                        with os.fdopen(descriptor, "wb") as destination:
                            try:
                                async for chunk in response.aiter_bytes():
                                    size += len(chunk)
                                    if size > self.max_bytes:
                                        raise _invalid_input(
                                            "The video exceeds the maximum size."
                                        )
                                    destination.write(chunk)
                            except httpx.TimeoutException as exc:
                                raise RemoteVideoError(
                                    code=(
                                        VideoSubtitleGroundingErrorCode
                                        .VIDEO_DOWNLOAD_FAILED
                                    ),
                                    phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
                                    message="The video download timed out.",
                                ) from exc
                            except httpx.HTTPError as exc:
                                raise RemoteVideoError(
                                    code=(
                                        VideoSubtitleGroundingErrorCode
                                        .VIDEO_DOWNLOAD_FAILED
                                    ),
                                    phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
                                    message="The video could not be downloaded.",
                                ) from exc
                        if size == 0:
                            raise _invalid_input("The video response is empty.")
                        return DownloadedRemoteVideo(
                            path=path,
                            mime_type=mime_type,
                            size_bytes=size,
                        )
                    finally:
                        await response.aclose()
        except OSError as exc:
            if path is not None:
                with suppress(OSError):
                    path.unlink()
            raise RemoteVideoError(
                code=VideoSubtitleGroundingErrorCode.VIDEO_DOWNLOAD_FAILED,
                phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
                message="The video could not be downloaded.",
            ) from exc
        except BaseException:
            if path is not None:
                with suppress(OSError):
                    path.unlink()
            raise


class FFprobeVideoPathInspector:
    def __init__(
        self,
        settings: Settings | None = None,
        *,
        ffprobe_path: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        settings = settings or get_settings()
        self.ffprobe_path = (
            ffprobe_path
            or (
                str(Path(settings.composer_ffmpeg_path).with_name("ffprobe"))
                if settings.composer_ffmpeg_path
                else shutil.which("ffprobe")
            )
        )
        self.timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else settings.composer_timeout_seconds
        )

    async def inspect(self, path: Path) -> VideoDisplayMetadata:
        if not self.ffprobe_path:
            raise ConfigurationError("FFprobe is required to inspect remote video.")
        process = await asyncio.create_subprocess_exec(
            self.ffprobe_path,
            "-v",
            "error",
            "-show_entries",
            (
                "format=format_name,duration:format_tags=major_brand:"
                "stream=codec_type,codec_name,width,height,duration:stream_tags=rotate:"
                "stream_side_data=rotation,displaymatrix"
            ),
            "-of",
            "json",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.timeout_seconds,
            )
        except TimeoutError as exc:
            process.kill()
            await process.communicate()
            raise MediaInspectionError("media inspection timed out") from exc
        except BaseException:
            if process.returncode is None:
                process.kill()
                await asyncio.shield(process.communicate())
            raise
        if process.returncode != 0:
            raise MediaInspectionError("video content could not be inspected")
        try:
            payload = json.loads(stdout)
        except json.JSONDecodeError as exc:
            raise MediaInspectionError(
                "media inspection returned invalid metadata"
            ) from exc
        if not isinstance(payload, dict):
            raise MediaInspectionError("media inspection returned invalid metadata")
        return parse_video_display_metadata(
            payload,
            max_duration_seconds=(
                VIDEO_SUBTITLE_GROUNDING_MAX_VIDEO_DURATION_MS / 1000
            ),
        )


class SecureRemoteVideoPreparer:
    def __init__(
        self,
        downloader: SecureRemoteVideoDownloader | None = None,
        inspector: VideoPathInspector | None = None,
    ) -> None:
        self.downloader = downloader or SecureRemoteVideoDownloader()
        self.inspector = inspector or FFprobeVideoPathInspector()

    @asynccontextmanager
    async def open(self, url: str) -> AsyncIterator[PreparedRemoteVideo]:
        async with self.downloader.open(url) as downloaded:
            try:
                metadata = await self.inspector.inspect(downloaded.path)
            except (ConfigurationError, MediaInspectionError, OSError) as exc:
                raise RemoteVideoError(
                    code=VideoSubtitleGroundingErrorCode.MEDIA_PROBE_FAILED,
                    phase=VideoSubtitleGroundingErrorPhase.MEDIA_PROBE,
                    message="The video metadata could not be inspected.",
                ) from exc
            yield PreparedRemoteVideo(
                path=downloaded.path,
                mime_type=downloaded.mime_type,
                size_bytes=downloaded.size_bytes,
                metadata=metadata,
            )


async def validate_public_https_url(
    url: str,
    *,
    resolver: DnsResolver | None = None,
) -> None:
    try:
        parsed = urlsplit(url)
        port = parsed.port or 443
    except (TypeError, ValueError) as exc:
        raise _invalid_url("The video URL is invalid.") from exc
    if parsed.scheme.lower() != "https":
        raise _invalid_url("The video URL must use HTTPS.")
    if not parsed.hostname:
        raise _invalid_url("The video URL must include a host.")
    if parsed.username is not None or parsed.password is not None:
        raise _invalid_url("The video URL must not include user information.")
    if parsed.fragment or "#" in url:
        raise _invalid_url("The video URL must not include a fragment.")

    hostname = parsed.hostname.rstrip(".").lower()
    if hostname in METADATA_HOSTNAMES:
        raise _invalid_url("The video URL host is not allowed.")
    try:
        literal_address = ipaddress.ip_address(hostname)
    except ValueError:
        try:
            addresses = await (resolver or _resolve_host)(hostname, port)
        except RemoteVideoError:
            raise
        except OSError as exc:
            raise _invalid_url(
                "The video URL host could not be resolved."
            ) from exc
    else:
        addresses = (str(literal_address),)

    resolved = list(addresses)
    if not resolved:
        raise _invalid_url("The video URL host could not be resolved.")
    for raw_address in resolved:
        try:
            address = ipaddress.ip_address(raw_address)
        except ValueError as exc:
            raise _invalid_url("The video URL host could not be resolved.") from exc
        if (
            not address.is_global
            or address.is_loopback
            or address.is_private
            or address.is_link_local
            or address.is_multicast
            or address.is_reserved
            or address.is_unspecified
        ):
            raise _invalid_url("The video URL host is not public.")


async def _resolve_host(hostname: str, port: int) -> Iterable[str]:
    try:
        records = await asyncio.get_running_loop().getaddrinfo(
            hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise _invalid_url("The video URL host could not be resolved.") from exc
    return {record[4][0] for record in records}


def _validate_video_response(
    response: httpx.Response,
    *,
    max_bytes: int,
) -> str:
    content_type = response.headers.get("content-type", "")
    mime_type = content_type.split(";", 1)[0].strip().lower()
    if mime_type not in VIDEO_MIME_TYPES:
        raise _invalid_input("The response is not a supported video.")

    content_length = response.headers.get("content-length")
    if content_length is not None:
        try:
            declared_size = int(content_length)
        except ValueError as exc:
            raise _invalid_input("The video response size is invalid.") from exc
        if declared_size < 0:
            raise _invalid_input("The video response size is invalid.")
        if declared_size > max_bytes:
            raise _invalid_input("The video exceeds the maximum size.")
    return mime_type


def _invalid_url(message: str) -> RemoteVideoError:
    return RemoteVideoError(
        code=VideoSubtitleGroundingErrorCode.INVALID_VIDEO_URL,
        phase=VideoSubtitleGroundingErrorPhase.URL_VALIDATION,
        message=message,
    )


def _invalid_input(message: str) -> RemoteVideoError:
    return RemoteVideoError(
        code=VideoSubtitleGroundingErrorCode.INVALID_VIDEO_INPUT,
        phase=VideoSubtitleGroundingErrorPhase.DOWNLOAD,
        message=message,
    )


def _suffix_for_mime(mime_type: str) -> str:
    return {
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/webm": ".webm",
        "video/x-matroska": ".mkv",
        "video/mpeg": ".mpeg",
        "video/x-msvideo": ".avi",
    }.get(mime_type, ".video")
