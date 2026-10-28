from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from contextlib import asynccontextmanager, suppress
from dataclasses import asdict
from fractions import Fraction
from pathlib import Path
from urllib.parse import urlsplit

from backend.app.core.config import ConfigurationError, get_settings
from backend.app.core.logging import log_event
from backend.app.schemas.asset import AssetCreate
from backend.app.schemas.enums import AssetRole, AssetType, Status, ToolAssetRole
from backend.app.schemas.subtitle_translation import SubtitleVideoMetadata
from backend.app.services.media_inspector import (
    MediaInspectionError,
    parse_video_display_metadata,
)
from backend.app.services.video_subtitle_grounding_media import (
    VIDEO_MIME_TYPES,
    FFprobeVideoPathInspector,
    PreparedRemoteVideo,
    SecureRemoteVideoDownloader,
)

logger = logging.getLogger(__name__)
MAX_BYTES = 512 * 1024 * 1024


def validate_video_asset(asset):
    if (
        asset.project_id is not None
        or asset.tool_asset_role is None
        or asset.status != Status.SUCCEEDED
        or asset.mime_type not in VIDEO_MIME_TYPES
        or asset.asset_role != AssetRole.PUBLIC
    ):
        raise ValueError("select an accessible tool video asset")
    if asset.size_bytes is not None and asset.size_bytes > MAX_BYTES:
        raise ValueError("video exceeds 512 MiB")


def metadata_for_asset(asset):
    validate_video_asset(asset)
    metadata = asset.metadata or {}
    values = metadata.get("subtitle_video")
    if isinstance(values, dict):
        return SubtitleVideoMetadata.model_validate(values)
    width = metadata.get("display_width", metadata.get("width"))
    height = metadata.get("display_height", metadata.get("height"))
    duration = metadata.get("duration_ms")
    if duration is None and metadata.get("duration_seconds"):
        duration = round(float(metadata["duration_seconds"]) * 1000)
    return SubtitleVideoMetadata(
        width=width,
        height=height,
        duration_ms=duration,
        rotation=metadata.get("rotation", 0),
        fps=metadata.get("fps"),
        has_audio=bool(metadata.get("audio_codec")),
    )


class SubtitleVideoPathInspector:
    def __init__(self, settings=None):
        self.settings = settings or get_settings()
        self.ffprobe_path = FFprobeVideoPathInspector(self.settings).ffprobe_path

    async def inspect(self, path, *, role):
        if not self.ffprobe_path:
            raise ConfigurationError("FFprobe is required for video imports.")
        process = await asyncio.create_subprocess_exec(
            self.ffprobe_path,
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(
                process.communicate(), self.settings.composer_timeout_seconds
            )
        except BaseException:
            if process.returncode is None:
                process.kill()
                await asyncio.shield(process.communicate())
            raise
        if process.returncode != 0:
            raise MediaInspectionError("video cannot be decoded; upload a valid video")
        payload = json.loads(stdout)
        display = parse_video_display_metadata(
            payload, max_duration_seconds=600 if role == "reference" else None
        )
        streams = payload.get("streams", [])
        stream = next(s for s in streams if s.get("codec_type") == "video")
        try:
            fps = float(
                Fraction(
                    stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "0"
                )
            )
        except (ValueError, ZeroDivisionError):
            fps = 0
        metadata = SubtitleVideoMetadata(
            width=display.display_width,
            height=display.display_height,
            duration_ms=display.duration_ms,
            rotation=display.rotation,
            fps=fps if fps > 0 else None,
            has_audio=any(s.get("codec_type") == "audio" for s in streams),
        )
        return display, metadata


class SubtitleTranslationMediaService:
    def __init__(self, repository, storage, *, downloader=None, inspector=None):
        self.repository = repository
        self.storage = storage
        self.downloader = downloader or SecureRemoteVideoDownloader(max_bytes=MAX_BYTES)
        self.inspector = inspector or SubtitleVideoPathInspector()

    async def ensure_metadata(self, asset_id, *, role):
        asset = self.repository.get_asset(asset_id)
        validate_video_asset(asset)
        try:
            metadata = metadata_for_asset(asset)
        except (ValueError, TypeError):
            async with self.open_asset(asset_id, role=role) as prepared:
                _, metadata = await self.inspector.inspect(prepared.path, role=role)
            self.repository.update_asset(
                asset_id,
                metadata={**asset.metadata, "subtitle_video": metadata.model_dump()},
            )
        if role == "reference" and metadata.duration_ms > 600_000:
            raise ValueError("reference video must be at most 600 seconds")
        return metadata

    @asynccontextmanager
    async def open_asset(self, asset_id, *, role="reference"):
        asset = self.repository.get_asset(asset_id)
        validate_video_asset(asset)
        url = self.storage.signed_access_url(asset)
        if not url:
            raise ValueError("video asset is not accessible")
        async with self.downloader.open(url) as downloaded:
            display, _ = await self.inspector.inspect(downloaded.path, role=role)
            yield PreparedRemoteVideo(
                downloaded.path, downloaded.mime_type, downloaded.size_bytes, display
            )

    async def import_video(self, url, *, role):
        async with self.downloader.open(url) as downloaded:
            display, metadata = await self.inspector.inspect(downloaded.path, role=role)
            asset = await self._store_path(
                downloaded.path,
                mime_type=downloaded.mime_type,
                size=downloaded.size_bytes,
                metadata=metadata,
                display=display,
                filename="subtitle-input.mp4",
            )
        log_event(
            logger,
            "subtitle_translation.imported",
            outcome="succeeded",
            asset_id=asset.id,
            operation=role,
            video_bytes=asset.size_bytes,
        )
        return asset

    async def upload_video(self, chunks, *, role, filename, mime_type):
        if mime_type not in VIDEO_MIME_TYPES:
            raise ValueError("upload a supported video MIME type")
        descriptor, name = tempfile.mkstemp(prefix="subtitle-upload-", suffix=".video")
        path = Path(name)
        size = 0
        try:
            os.chmod(path, 0o600)
            with os.fdopen(descriptor, "wb") as destination:
                async for chunk in chunks:
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise ValueError("video exceeds 512 MiB")
                    destination.write(chunk)
            if size == 0:
                raise ValueError("video upload is empty")
            display, metadata = await self.inspector.inspect(path, role=role)
            return await self._store_path(
                path,
                mime_type=mime_type,
                size=size,
                metadata=metadata,
                display=display,
                filename=Path(filename or "subtitle-input.mp4").name[:128],
            )
        finally:
            with suppress(OSError):
                path.unlink()

    async def store_output(self, url, *, task):
        if not url or urlsplit(url).scheme != "https":
            raise ValueError("provider output video is unavailable")
        # A restart after transfer but before completion reuses the existing asset.
        existing = next(
            (
                a
                for a in self.repository.list_assets()
                if a.tool_task_id in ({task.id, task.retry_of_task_id} - {None})
                and a.tool_asset_role == ToolAssetRole.OUTPUT
            ),
            None,
        )
        if existing is not None:
            return existing
        async with self.downloader.open(url) as downloaded:
            display, metadata = await self.inspector.inspect(
                downloaded.path, role="clean"
            )
            if display.container not in {
                "mov",
                "mp4",
            } and "mp4" not in display.container.split(","):
                raise ValueError("render output must be MP4")
            return await self._store_path(
                downloaded.path,
                mime_type="video/mp4",
                size=downloaded.size_bytes,
                metadata=metadata,
                display=display,
                filename="translated-video.mp4",
                task=task,
            )

    async def _store_path(
        self, path, *, mime_type, size, metadata, display, filename, task=None
    ):
        if self.storage.client is None:
            raise ConfigurationError("TOS storage is not configured.")
        data = AssetCreate(
            type=AssetType.STORYBOARD_VIDEO,
            status=Status.SUCCEEDED,
            asset_role=AssetRole.PUBLIC,
            tool_asset_role=ToolAssetRole.OUTPUT if task else ToolAssetRole.INPUT,
            tool_task_id=task.id if task else None,
            mime_type=mime_type,
            size_bytes=size,
            metadata={
                "name": filename,
                "tool_asset_kind": "video",
                "storage_provider": "tos",
                "subtitle_video": metadata.model_dump(),
                "video_display": asdict(display),
                **(
                    {
                        "workspace_id": task.input_snapshot["workspace_id"],
                        "revision": task.input_snapshot["revision"],
                        "operation": "render",
                    }
                    if task
                    else {}
                ),
            },
        )
        key = self.storage.generate_object_key(
            asset_id=data.id,
            asset_type=data.type,
            stage=data.stage,
            filename=filename,
            mime_type=mime_type,
        )
        try:
            upload = asyncio.create_task(
                asyncio.to_thread(
                    self.storage._put_object_from_file,
                    key=key,
                    file_path=str(path),
                    content_type=mime_type,
                    size_bytes=size,
                )
            )
            try:
                await asyncio.shield(upload)
            except asyncio.CancelledError:
                # Let the blocking upload finish before deleting its object and local source.
                with suppress(Exception):
                    await asyncio.shield(upload)
                raise
            create = (
                self.repository.create_subtitle_output_asset
                if task
                else self.repository.create_asset
            )
            asset = create(
                data.model_copy(
                    update={"object_key": key, "url": self.storage.url_for_key(key)}
                )
            )
        except BaseException:
            await asyncio.shield(self.storage._delete_uploaded_objects([key]))
            raise
        if asset.id != data.id:
            await asyncio.shield(self.storage._delete_uploaded_objects([key]))
        log_event(
            logger,
            "subtitle_translation.stored",
            outcome="succeeded",
            asset_id=asset.id,
            task_id=task.id if task else None,
            workspace_id=task.input_snapshot["workspace_id"] if task else None,
            revision=task.input_snapshot["revision"] if task else None,
            operation="render" if task else "import",
            video_bytes=size,
        )
        return asset

    def delete_asset(self, asset):
        self.storage.delete_asset_objects(asset)
        self.repository.delete_tool_asset(asset.id)
