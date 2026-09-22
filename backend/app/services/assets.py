from __future__ import annotations

import asyncio
import logging
import mimetypes
import os
import re
import tempfile
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from typing import BinaryIO, Protocol
from urllib.parse import quote, urlsplit

import httpx
from PIL import Image, UnidentifiedImageError

from backend.app.core.config import ConfigurationError, Settings, get_settings
from backend.app.core.logging import log_event
from backend.app.repositories import NotFoundError, Repository
from backend.app.schemas import (
    AigcAssetDirection,
    AigcImagePromptOptimizationMode,
    AigcNodeType,
    AigcPipelineTaskAssetReference,
    AigcPromptOptimizeRequest,
    AigcRunNodeStatus,
    Asset,
    AssetCategory,
    AssetCreate,
    AssetRole,
    AssetType,
    Project,
    Stage,
    Status,
    ToolAssetRole,
)
from backend.app.services.aigc_asset_naming import (
    AigcAssetNamingContext,
    aigc_output_name_metadata,
)

logger = logging.getLogger(__name__)


class ObjectStorageClient(Protocol):
    def put_object(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str | None = None,
    ) -> None:
        """Upload object bytes under the given object key."""

    def delete_object(self, *, key: str) -> None:
        """Delete one object during best-effort rollback."""

    def get_object(self, *, key: str) -> bytes:
        """Read one private object into memory."""

    def signed_url(self, *, key: str, expires: int = 3600) -> str:
        """Create a temporary read URL for a private object."""


@dataclass(frozen=True)
class DownloadedAsset:
    content: bytes
    mime_type: str


class GeneratedImageValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


class PromptOptimizationContextError(ValueError):
    """The prompt optimization source context failed provenance validation."""


class PromptOptimizationRevisionConflictError(PromptOptimizationContextError):
    """The submitted editor snapshot no longer matches the persisted pipeline."""


@dataclass(frozen=True)
class PromptOptimizationImageContext:
    source_image_url: str | None
    reference_image_count: int

    @property
    def allowed_mode(self) -> AigcImagePromptOptimizationMode:
        return "local_edit" if self.source_image_url else "full_design"


@dataclass(frozen=True)
class StreamedAsset:
    mime_type: str
    size_bytes: int


@dataclass(frozen=True)
class AigcVideoEnhancementAssetInput:
    source_url: str
    pipeline_id: str
    run_id: str
    node_id: str
    task_id: str
    input_asset_id: str
    provider_task_id: str
    tool_version: str
    enhance_style: str
    resolution_mode: str
    executor_version: str
    provider_request_id: str | None = None
    scene: str | None = None
    resolution: str | None = None
    resolution_limit: int | None = None
    fps: float | None = None
    bitrate_mode: str | None = None
    bitrate_level: str | None = None
    bitrate: int | None = None
    bit_depth: int | None = None
    duration_seconds: float | None = None
    naming_context: AigcAssetNamingContext | None = None


@dataclass(frozen=True)
class AigcVideoFaceBlurAssetInput:
    source_url: str
    pipeline_id: str
    run_id: str
    node_id: str
    task_id: str
    input_asset_id: str
    provider_task_id: str
    mask_mode: str
    mask_strength: str
    executor_version: str
    provider_request_id: str | None = None
    duration_seconds: float | None = None
    naming_context: AigcAssetNamingContext | None = None


@dataclass(frozen=True)
class AigcVideoSubtitleAssetInput:
    srt_text: str
    pipeline_id: str
    run_id: str
    node_id: str
    task_id: str
    input_asset_id: str
    provider_task_id: str
    segment_count: int
    executor_version: str
    provider_request_id: str | None = None
    duration_seconds: float | None = None
    naming_context: AigcAssetNamingContext | None = None


@dataclass(frozen=True)
class AigcMultiTrackAssetInput:
    source_url: str
    pipeline_id: str
    run_id: str
    node_id: str
    task_id: str
    input_asset_ids: Mapping[str, Sequence[str]]
    provider_task_id: str
    executor_version: str
    canvas: Mapping[str, object]
    tracks: Sequence[Mapping[str, object]]
    duration_ms: int
    width: int
    height: int
    fps: int | float
    provider_request_id: str | None = None
    naming_context: AigcAssetNamingContext | None = None


class RemoteAssetDownloader(Protocol):
    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        """Download and validate one generated asset."""


class HttpRemoteAssetDownloader:
    def __init__(
        self,
        *,
        timeout_seconds: float,
        max_bytes: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.max_bytes = max_bytes
        self.transport = transport

    async def stream_to_file(
        self,
        url: str,
        destination: BinaryIO,
        *,
        expected_mime_type: str | None = None,
    ) -> StreamedAsset:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("generated asset URL must use HTTP or HTTPS")

        timeout = httpx.Timeout(float(self.timeout_seconds))
        async with asyncio.timeout(float(self.timeout_seconds)):
            async with httpx.AsyncClient(
                follow_redirects=True,
                timeout=timeout,
                transport=self.transport,
            ) as client:
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    mime_type = _validated_response_mime_type(
                        response.headers.get("content-type"),
                        expected_mime_type=expected_mime_type,
                    )
                    content_length = response.headers.get("content-length")
                    if content_length is not None:
                        try:
                            declared_size = int(content_length)
                        except ValueError as exc:
                            raise ValueError(
                                "generated asset response has invalid content length"
                            ) from exc
                        if declared_size < 0:
                            raise ValueError(
                                "generated asset response has invalid content length"
                            )
                        if declared_size > self.max_bytes:
                            raise ValueError(
                                "generated asset exceeds maximum size"
                            )

                    size = 0
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > self.max_bytes:
                            raise ValueError(
                                "generated asset exceeds maximum size"
                            )
                        destination.write(chunk)

        if size == 0:
            raise ValueError("generated asset response is empty")
        destination.flush()
        return StreamedAsset(mime_type=mime_type, size_bytes=size)

    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        with tempfile.TemporaryFile() as destination:
            streamed = await self.stream_to_file(
                url,
                destination,
                expected_mime_type=expected_mime_type,
            )
            destination.seek(0)
            return DownloadedAsset(
                content=destination.read(),
                mime_type=streamed.mime_type,
            )


class TosObjectStorageClient:
    """Thin adapter around the Volcengine TOS SDK."""

    def __init__(self, settings: Settings) -> None:
        settings.require_tos_config()
        assert settings.tos_access_key is not None
        assert settings.tos_secret_key is not None
        assert settings.tos_endpoint is not None
        assert settings.tos_region is not None
        assert settings.tos_bucket is not None

        import tos

        self._bucket = settings.tos_bucket
        self._client = tos.TosClientV2(
            settings.tos_access_key.get_secret_value(),
            settings.tos_secret_key.get_secret_value(),
            settings.tos_endpoint,
            settings.tos_region,
        )

    def put_object(
        self,
        *,
        key: str,
        content: bytes,
        content_type: str | None = None,
    ) -> None:
        self._client.put_object(
            bucket=self._bucket,
            key=key,
            content=content,
            content_type=content_type,
        )

    def put_object_from_file(
        self,
        *,
        key: str,
        file_path: str,
        content_type: str | None = None,
        size_bytes: int | None = None,
    ) -> None:
        with open(file_path, "rb") as content:
            self._client.put_object(
                bucket=self._bucket,
                key=key,
                content=content,
                content_length=size_bytes,
                content_type=content_type,
            )

    def delete_object(self, *, key: str) -> None:
        self._client.delete_object(bucket=self._bucket, key=key)

    def get_object(self, *, key: str) -> bytes:
        response = self._client.get_object(bucket=self._bucket, key=key)
        try:
            return response.read()
        finally:
            for candidate in (
                response,
                getattr(response, "content", None),
                getattr(response, "resp", None),
            ):
                close = getattr(candidate, "close", None)
                if callable(close):
                    close()
                    break

    def signed_url(self, *, key: str, expires: int = 3600) -> str:
        import tos

        result = self._client.pre_signed_url(
            tos.HttpMethodType.Http_Method_Get,
            bucket=self._bucket,
            key=key,
            expires=expires,
        )
        return result.signed_url


@dataclass(frozen=True)
class StoredAssetInput:
    type: AssetType
    project_id: str | None = None
    tool_task_id: str | None = None
    tool_asset_role: ToolAssetRole | None = None
    category: AssetCategory | None = None
    asset_role: AssetRole = AssetRole.PUBLIC
    stage: Stage | None = None
    status: Status = Status.SUCCEEDED
    source_url: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    source_task_id: str | None = None
    metadata: dict[str, str | int | float | bool | None] | None = None
    filename: str | None = None
    validate_image_content: bool = False
    expected_image_dimensions: tuple[int, int] | None = None
    naming_context: AigcAssetNamingContext | None = None


class AssetStorageService:
    """Creates stable object keys/URLs and persists asset records."""

    def __init__(
        self,
        *,
        bucket: str,
        public_endpoint: str | None = None,
        client: ObjectStorageClient | None = None,
        downloader: RemoteAssetDownloader | None = None,
        video_enhancement_downloader: RemoteAssetDownloader | None = None,
        face_blur_downloader: RemoteAssetDownloader | None = None,
        multitrack_downloader: RemoteAssetDownloader | None = None,
        key_prefix: str = "projects",
        download_timeout_seconds: float = 30,
        download_max_bytes: int = 30 * 1024 * 1024,
        video_enhancement_transfer_timeout_seconds: float | None = None,
        video_enhancement_transfer_max_bytes: int | None = None,
        face_blur_transfer_timeout_seconds: float | None = None,
        face_blur_transfer_max_bytes: int | None = None,
        multitrack_transfer_timeout_seconds: float | None = None,
        multitrack_transfer_max_bytes: int | None = None,
    ) -> None:
        self.bucket = bucket
        self.public_endpoint = public_endpoint
        self.client = client
        self.download_timeout_seconds = download_timeout_seconds
        self.download_max_bytes = download_max_bytes
        self.video_enhancement_transfer_timeout_seconds = (
            video_enhancement_transfer_timeout_seconds
            if video_enhancement_transfer_timeout_seconds is not None
            else download_timeout_seconds
        )
        self.video_enhancement_transfer_max_bytes = (
            video_enhancement_transfer_max_bytes
            if video_enhancement_transfer_max_bytes is not None
            else download_max_bytes
        )
        self.face_blur_transfer_timeout_seconds = (
            face_blur_transfer_timeout_seconds
            if face_blur_transfer_timeout_seconds is not None
            else download_timeout_seconds
        )
        self.face_blur_transfer_max_bytes = (
            face_blur_transfer_max_bytes
            if face_blur_transfer_max_bytes is not None
            else download_max_bytes
        )
        self.multitrack_transfer_timeout_seconds = (
            multitrack_transfer_timeout_seconds
            if multitrack_transfer_timeout_seconds is not None
            else download_timeout_seconds
        )
        self.multitrack_transfer_max_bytes = (
            multitrack_transfer_max_bytes
            if multitrack_transfer_max_bytes is not None
            else download_max_bytes
        )
        self.downloader = downloader or HttpRemoteAssetDownloader(
            timeout_seconds=download_timeout_seconds,
            max_bytes=download_max_bytes,
        )
        self.video_enhancement_downloader = (
            video_enhancement_downloader
            or (
                HttpRemoteAssetDownloader(
                    timeout_seconds=self.video_enhancement_transfer_timeout_seconds,
                    max_bytes=self.video_enhancement_transfer_max_bytes,
                )
                if video_enhancement_transfer_timeout_seconds is not None
                or video_enhancement_transfer_max_bytes is not None
                else self.downloader
            )
        )
        self.face_blur_downloader = (
            face_blur_downloader
            or (
                HttpRemoteAssetDownloader(
                    timeout_seconds=self.face_blur_transfer_timeout_seconds,
                    max_bytes=self.face_blur_transfer_max_bytes,
                )
                if face_blur_transfer_timeout_seconds is not None
                or face_blur_transfer_max_bytes is not None
                else self.downloader
            )
        )
        self.multitrack_downloader = (
            multitrack_downloader
            or (
                HttpRemoteAssetDownloader(
                    timeout_seconds=self.multitrack_transfer_timeout_seconds,
                    max_bytes=self.multitrack_transfer_max_bytes,
                )
                if multitrack_transfer_timeout_seconds is not None
                or multitrack_transfer_max_bytes is not None
                else self.downloader
            )
        )
        self.key_prefix = key_prefix.strip("/")

    @classmethod
    def from_settings(cls, settings: Settings | None = None) -> "AssetStorageService":
        settings = settings or get_settings()
        has_tos_config = all(
            [
                settings.tos_access_key,
                settings.tos_secret_key,
                settings.tos_endpoint,
                settings.tos_region,
                settings.tos_bucket,
            ]
        )
        bucket = settings.tos_bucket or "local-assets"
        client = TosObjectStorageClient(settings) if has_tos_config else None
        return cls(
            bucket=bucket,
            public_endpoint=settings.tos_public_endpoint,
            client=client,
            download_timeout_seconds=settings.asset_download_timeout_seconds,
            download_max_bytes=settings.asset_download_max_bytes,
            video_enhancement_transfer_timeout_seconds=(
                settings.mediakit_video_enhancement_transfer_timeout_seconds
            ),
            video_enhancement_transfer_max_bytes=(
                settings.mediakit_video_enhancement_transfer_max_bytes
            ),
            face_blur_transfer_timeout_seconds=(
                settings.mediakit_face_blur_transfer_timeout_seconds
            ),
            face_blur_transfer_max_bytes=(
                settings.mediakit_face_blur_transfer_max_bytes
            ),
            multitrack_transfer_timeout_seconds=(
                settings.mediakit_multitrack_transfer_timeout_seconds
            ),
            multitrack_transfer_max_bytes=(
                settings.mediakit_multitrack_transfer_max_bytes
            ),
        )

    def generate_object_key(
        self,
        *,
        project_id: str | None = None,
        tool_task_id: str | None = None,
        asset_id: str,
        asset_type: AssetType,
        stage: Stage | None = None,
        filename: str | None = None,
        mime_type: str | None = None,
    ) -> str:
        extension = _extension_for(filename=filename, mime_type=mime_type)
        stage_or_type = _slug(stage.value if stage is not None else asset_type.value)
        if project_id and tool_task_id:
            raise ValueError("object key cannot have both project and tool task owners")
        owner_prefix = (
            [self.key_prefix, _slug(project_id or "")]
            if project_id
            else ["tools", _slug(tool_task_id or "library")]
        )
        return "/".join(
            part
            for part in [
                *owner_prefix,
                stage_or_type,
                f"{_slug(asset_id)}{extension}",
            ]
            if part
        )

    def url_for_key(self, object_key: str) -> str:
        quoted_key = quote(object_key, safe="/")
        if self.public_endpoint:
            endpoint = self.public_endpoint.rstrip("/")
            if not endpoint.startswith(("http://", "https://")):
                endpoint = f"https://{self.bucket}.{endpoint}"
            return f"{endpoint}/{quoted_key}"
        return f"https://{self.bucket}.tos.local/{quoted_key}"

    def companion_object_key(
        self,
        asset: Asset,
        *,
        suffix: str,
        mime_type: str,
    ) -> str:
        if not asset.object_key:
            raise ValueError("parent asset object key is required")
        extension = _extension_for(filename=None, mime_type=mime_type)
        stem = asset.object_key.rsplit(".", 1)[0]
        return f"{stem}-{_slug(suffix)}{extension}"

    def register_asset(
        self,
        repository: Repository,
        data: StoredAssetInput,
    ) -> Asset:
        asset = AssetCreate(
            project_id=data.project_id,
            tool_task_id=data.tool_task_id,
            tool_asset_role=data.tool_asset_role,
            type=data.type,
            category=data.category,
            asset_role=data.asset_role,
            status=data.status,
            stage=data.stage,
            mime_type=data.mime_type,
            size_bytes=data.size_bytes,
            source_task_id=data.source_task_id,
            metadata={
                **(data.metadata or {}),
                "storage_provider": "tos",
                **({"source_url": data.source_url} if data.source_url else {}),
            },
        )
        object_key = self.generate_object_key(
            project_id=data.project_id,
            tool_task_id=data.tool_task_id,
            asset_id=asset.id,
            asset_type=data.type,
            stage=data.stage,
            filename=data.filename,
            mime_type=data.mime_type,
        )
        persisted = repository.create_asset(
            asset.model_copy(
                update={
                    "object_key": object_key,
                    "url": self.url_for_key(object_key),
                },
                deep=True,
            )
        )
        log_event(
            logger,
            "asset.persistence",
            outcome="succeeded",
            operation="register",
            asset_type=persisted.type.value,
        )
        return persisted

    def upload_asset(
        self,
        repository: Repository,
        data: StoredAssetInput,
        *,
        content: bytes,
    ) -> Asset:
        if self.client is None:
            raise ConfigurationError("TOS client is not configured for asset upload.")

        asset = AssetCreate(
            project_id=data.project_id,
            tool_task_id=data.tool_task_id,
            tool_asset_role=data.tool_asset_role,
            type=data.type,
            category=data.category,
            asset_role=data.asset_role,
            status=data.status,
            stage=data.stage,
            mime_type=data.mime_type,
            size_bytes=data.size_bytes if data.size_bytes is not None else len(content),
            source_task_id=data.source_task_id,
            metadata={
                **(data.metadata or {}),
                "storage_provider": "tos",
            },
        )
        object_key = self.generate_object_key(
            project_id=data.project_id,
            tool_task_id=data.tool_task_id,
            asset_id=asset.id,
            asset_type=data.type,
            stage=data.stage,
            filename=data.filename,
            mime_type=data.mime_type,
        )
        self.client.put_object(
            key=object_key,
            content=content,
            content_type=data.mime_type,
        )
        try:
            persisted = repository.create_asset(
                asset.model_copy(
                    update={
                        "object_key": object_key,
                        "url": self.url_for_key(object_key),
                    },
                    deep=True,
                )
            )
            log_event(
                logger,
                "asset.persistence",
                outcome="succeeded",
                operation="upload",
                asset_type=persisted.type.value,
            )
            return persisted
        except Exception:
            try:
                self.client.delete_object(key=object_key)
            except Exception:
                pass
            raise

    def with_access_url(self, asset: Asset) -> Asset:
        metadata = dict(asset.metadata)
        last_frame_object_key = metadata.pop("last_frame_object_key", None)
        if isinstance(last_frame_object_key, str) and last_frame_object_key:
            metadata["last_frame_url"] = (
                f"/api/assets/{quote(asset.id, safe='')}/last-frame"
            )
        if self.client is None or not asset.object_key:
            return asset.model_copy(update={"metadata": metadata}, deep=True)
        return asset.model_copy(
            update={
                "url": f"/api/assets/{quote(asset.id, safe='')}/content",
                "metadata": metadata,
            },
            deep=True,
        )

    async def read_asset_content(self, asset: Asset) -> bytes:
        if self.client is not None and asset.object_key:
            return await asyncio.to_thread(
                self.client.get_object,
                key=asset.object_key,
            )
        if asset.url:
            downloaded = await self.downloader.fetch(
                asset.url,
                expected_mime_type=asset.mime_type,
            )
            return downloaded.content
        raise ValueError("asset has no readable object")

    def signed_access_url(self, asset: Asset) -> str | None:
        if self.client is None or not asset.object_key:
            return asset.url
        return self.client.signed_url(key=asset.object_key)

    async def resolve_prompt_optimization_image(
        self,
        repository: Repository,
        request: AigcPromptOptimizeRequest,
    ) -> PromptOptimizationImageContext:
        context = request.pipeline_context
        if context is None:
            return PromptOptimizationImageContext(
                source_image_url=None,
                reference_image_count=_prompt_reference_image_count(request),
            )
        try:
            pipeline = repository.get_aigc_pipeline(context.pipeline_id)
        except NotFoundError as exc:
            raise PromptOptimizationContextError(
                "pipeline context is invalid"
            ) from exc

        snapshot = context.definition_snapshot
        if pipeline.revision != context.base_revision and (
            pipeline.definition.model_dump(mode="json", by_alias=True)
            != snapshot.model_dump(mode="json", by_alias=True)
        ):
            raise PromptOptimizationRevisionConflictError(
                "pipeline definition revision conflict"
            )

        target = next(
            (node for node in snapshot.nodes if node.id == request.target_node_id),
            None,
        )
        if target is None or target.type != AigcNodeType.IMAGE_TO_IMAGE:
            raise PromptOptimizationContextError(
                "prompt target does not match the pipeline snapshot"
            )
        target_config = request.target_config.model_dump(mode="json")
        node_config = target.config.model_dump(mode="json")
        for field in ("model", "operation", "aspect_ratio", "size"):
            if target_config.get(field) != node_config.get(field):
                raise PromptOptimizationContextError(
                    "prompt target config does not match the pipeline snapshot"
                )

        operation = target_config["operation"]
        target_handle = "edit_image" if operation == "image_edit" else "image"
        ordinary_reference_edges = [
            edge
            for edge in snapshot.edges
            if edge.target_node_id == request.target_node_id
            and edge.target_handle == "image"
        ]
        direct_edges = [
            edge
            for edge in snapshot.edges
            if edge.target_node_id == request.target_node_id
            and edge.target_handle == target_handle
        ]
        image_input_edges = [
            edge
            for edge in snapshot.edges
            if edge.target_node_id == request.target_node_id
            and edge.target_handle in {"edit_image", "edit_layer", "image"}
        ]
        reference_count = len(ordinary_reference_edges)
        if target_config["reference_image_count"] != reference_count:
            raise PromptOptimizationContextError(
                "reference image count does not match the pipeline snapshot"
            )

        descriptor = context.source_image
        eligible_single_source = (
            (
                operation == "image_to_image"
                and len(direct_edges) == 1
                and len(image_input_edges) == 1
            )
            or (
                operation == "image_edit"
                and len(direct_edges) == 1
                and len(image_input_edges) == 1
            )
        )
        if descriptor is None:
            return PromptOptimizationImageContext(
                source_image_url=None,
                reference_image_count=reference_count,
            )
        if not eligible_single_source or descriptor.target_handle != target_handle:
            raise PromptOptimizationContextError(
                "source image is not eligible for local editing"
            )
        matching_edges = [
            edge
            for edge in direct_edges
            if edge.source_node_id == descriptor.source_node_id
            and edge.source_handle == descriptor.source_handle
        ]
        if len(matching_edges) != 1:
            raise PromptOptimizationContextError(
                "source image does not match a unique direct edge"
            )
        source_node = next(
            (
                node
                for node in snapshot.nodes
                if node.id == descriptor.source_node_id
            ),
            None,
        )
        if source_node is None:
            raise PromptOptimizationContextError(
                "source image node is missing from the pipeline snapshot"
            )

        if descriptor.run_id is None:
            if (
                source_node.type != AigcNodeType.IMAGE
                or getattr(source_node.config, "asset_id", None)
                != descriptor.asset_id
            ):
                raise PromptOptimizationContextError(
                    "local source image provenance is invalid"
                )
        else:
            try:
                run_detail = repository.get_aigc_run(descriptor.run_id)
            except NotFoundError as exc:
                raise PromptOptimizationContextError(
                    "source image run provenance is invalid"
                ) from exc
            if run_detail.run.pipeline_id != context.pipeline_id or not any(
                node.id == descriptor.source_node_id
                for node in run_detail.run.definition_snapshot.nodes
            ):
                raise PromptOptimizationContextError(
                    "source image run provenance is invalid"
                )
            run_node = next(
                (
                    node
                    for node in run_detail.nodes
                    if node.node_id == descriptor.source_node_id
                ),
                None,
            )
            if (
                run_node is None
                or run_node.status
                not in {
                    AigcRunNodeStatus.SUCCEEDED,
                    AigcRunNodeStatus.REUSED,
                }
                or not any(
                    result.asset_id == descriptor.asset_id
                    and result.available
                    for result in run_node.result.assets
                )
            ):
                raise PromptOptimizationContextError(
                    "source image RunNode provenance is invalid"
                )

        try:
            asset = repository.get_asset(descriptor.asset_id)
        except NotFoundError:
            return PromptOptimizationImageContext(
                source_image_url=None,
                reference_image_count=reference_count,
            )
        if (
            asset.status != Status.SUCCEEDED
            or asset.asset_role != AssetRole.PUBLIC
            or asset.type
            not in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
            or not (asset.mime_type or "").casefold().startswith("image/")
        ):
            return PromptOptimizationImageContext(
                source_image_url=None,
                reference_image_count=reference_count,
            )
        try:
            await self.read_asset_content(asset)
            source_image_url = self.signed_access_url(asset)
        except Exception:
            source_image_url = None
        return PromptOptimizationImageContext(
            source_image_url=source_image_url,
            reference_image_count=reference_count,
        )

    def signed_url_for_key(self, object_key: str) -> str | None:
        if self.client is None:
            return self.url_for_key(object_key)
        return self.client.signed_url(key=object_key)

    def with_project_access_urls(self, project: Project) -> Project:
        return project.model_copy(
            update={
                "assets": [
                    self.with_access_url(asset)
                    for asset in project.assets
                ]
            },
            deep=True,
        )

    async def upload_assets_from_sources(
        self,
        repository: Repository,
        items: list[StoredAssetInput],
    ) -> list[Asset]:
        if self.client is None:
            raise ConfigurationError("TOS client is not configured for asset upload.")
        if not items:
            return []
        log_event(
            logger,
            "asset.persistence",
            outcome="started",
            operation="provider_transfer",
        )

        downloaded: list[
            tuple[StoredAssetInput, DownloadedAsset, tuple[int, int] | None]
        ] = []
        for item in items:
            if not item.source_url:
                raise ValueError("generated asset source URL is required")
            content = await self.downloader.fetch(
                item.source_url,
                expected_mime_type=item.mime_type,
            )
            actual_dimensions = None
            if item.expected_image_dimensions is not None:
                actual_dimensions = _validate_image_dimensions(
                    content,
                    expected=item.expected_image_dimensions,
                )
            elif item.validate_image_content:
                _validate_image_content(content)
            downloaded.append((item, content, actual_dimensions))

        prepared: list[tuple[AssetCreate, bytes]] = []
        for item, download, actual_dimensions in downloaded:
            source_host = urlsplit(item.source_url or "").hostname
            asset = AssetCreate(
                project_id=item.project_id,
                tool_task_id=item.tool_task_id,
                tool_asset_role=item.tool_asset_role,
                type=item.type,
                category=item.category,
                asset_role=item.asset_role,
                status=item.status,
                stage=item.stage,
                mime_type=download.mime_type,
                size_bytes=len(download.content),
                source_task_id=item.source_task_id,
                metadata={
                    **(item.metadata or {}),
                    **(
                        aigc_output_name_metadata(
                            item.naming_context,
                            mime_type=download.mime_type,
                        )
                        if item.naming_context is not None
                        else {}
                    ),
                    "storage_provider": "tos",
                    **({"source_host": source_host} if source_host else {}),
                    **(
                        {
                            "width": actual_dimensions[0],
                            "height": actual_dimensions[1],
                        }
                        if actual_dimensions is not None
                        else {}
                    ),
                },
            )
            object_key = self.generate_object_key(
                project_id=item.project_id,
                tool_task_id=item.tool_task_id,
                asset_id=asset.id,
                asset_type=item.type,
                stage=item.stage,
                filename=item.filename,
                mime_type=download.mime_type,
            )
            prepared.append(
                (
                    asset.model_copy(
                        update={
                            "object_key": object_key,
                            "url": self.url_for_key(object_key),
                        },
                        deep=True,
                    ),
                    download.content,
                )
            )

        uploaded_keys: list[str] = []
        try:
            for asset, content in prepared:
                assert asset.object_key is not None
                await asyncio.to_thread(
                    self.client.put_object,
                    key=asset.object_key,
                    content=content,
                    content_type=asset.mime_type,
                )
                uploaded_keys.append(asset.object_key)
            try:
                persisted = repository.create_assets(
                    [asset for asset, _ in prepared]
                )
                log_event(
                    logger,
                    "asset.persistence",
                    outcome="succeeded",
                    operation="provider_transfer",
                )
                return persisted
            except Exception:
                for asset, _ in prepared:
                    try:
                        repository.delete_tool_asset(asset.id)
                    except Exception:
                        pass
                raise
        except Exception as exc:
            await self._delete_uploaded_objects(uploaded_keys)
            log_event(
                logger,
                "asset.persistence",
                outcome="failed",
                level=logging.WARNING,
                operation="provider_transfer",
                exception=exc,
            )
            raise

    async def store_aigc_video_enhancement(
        self,
        repository: Repository,
        data: AigcVideoEnhancementAssetInput,
    ) -> Asset:
        """Stream, validate, persist, and link one MediaKit enhancement output."""
        return await self._store_aigc_video_output(
            repository,
            source_url=data.source_url,
            task_id=data.task_id,
            filename_stem="enhanced-video",
            temporary_prefix="aigc-video-enhancement-",
            operation_label="video enhancement",
            metadata=_video_enhancement_metadata(data),
            naming_context=data.naming_context,
            timeout_seconds=self.video_enhancement_transfer_timeout_seconds,
            max_bytes=self.video_enhancement_transfer_max_bytes,
            downloader=self.video_enhancement_downloader,
        )

    async def store_aigc_video_face_blur(
        self,
        repository: Repository,
        data: AigcVideoFaceBlurAssetInput,
    ) -> Asset:
        """Stream, validate, persist, and link one MediaKit face-blur output."""
        return await self._store_aigc_video_output(
            repository,
            source_url=data.source_url,
            task_id=data.task_id,
            filename_stem="face-blurred-video",
            temporary_prefix="aigc-video-face-blur-",
            operation_label="video face blur",
            metadata=_video_face_blur_metadata(data),
            naming_context=data.naming_context,
            timeout_seconds=self.face_blur_transfer_timeout_seconds,
            max_bytes=self.face_blur_transfer_max_bytes,
            downloader=self.face_blur_downloader,
        )

    def store_aigc_video_subtitles(
        self,
        repository: Repository,
        data: AigcVideoSubtitleAssetInput,
    ) -> Asset:
        content = data.srt_text.encode("utf-8")
        if not content:
            raise ValueError("extracted subtitle content must not be empty")
        metadata = _video_subtitle_metadata(data)
        if data.naming_context is not None:
            metadata.update(
                aigc_output_name_metadata(
                    data.naming_context,
                    mime_type="application/x-subrip",
                )
            )
        asset = self.upload_asset(
            repository,
            StoredAssetInput(
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.SUBTITLE,
                asset_role=AssetRole.PUBLIC,
                status=Status.SUCCEEDED,
                mime_type="application/x-subrip",
                size_bytes=len(content),
                filename="extracted-subtitles.srt",
                metadata=metadata,
            ),
            content=content,
        )
        try:
            repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=data.task_id,
                        direction=AigcAssetDirection.OUTPUT,
                        slot="subtitle",
                        ordinal=0,
                        asset_id=asset.id,
                    )
                ]
            )
        except Exception:
            self.delete_asset_objects(asset)
            repository.delete_tool_asset(asset.id)
            raise
        return asset

    async def store_aigc_multitrack_video(
        self,
        repository: Repository,
        data: AigcMultiTrackAssetInput,
    ) -> Asset:
        """Stream and atomically register one MediaKit multi-track output."""
        references = _multitrack_asset_references(data)
        return await self._store_aigc_video_output(
            repository,
            source_url=data.source_url,
            task_id=data.task_id,
            filename_stem="multi-track-video",
            temporary_prefix="aigc-multitrack-",
            operation_label="multi-track output",
            metadata=_multitrack_metadata(data),
            naming_context=data.naming_context,
            timeout_seconds=self.multitrack_transfer_timeout_seconds,
            max_bytes=self.multitrack_transfer_max_bytes,
            downloader=self.multitrack_downloader,
            references=references,
        )

    async def _store_aigc_video_output(
        self,
        repository: Repository,
        *,
        source_url: str,
        task_id: str,
        filename_stem: str,
        temporary_prefix: str,
        operation_label: str,
        metadata: dict[str, object],
        naming_context: AigcAssetNamingContext | None,
        timeout_seconds: float,
        max_bytes: int,
        downloader: RemoteAssetDownloader,
        references: list[AigcPipelineTaskAssetReference] | None = None,
    ) -> Asset:
        if self.client is None:
            raise ConfigurationError("TOS client is not configured for asset upload.")
        parsed_url = urlsplit(source_url)
        if parsed_url.scheme != "https" or not parsed_url.netloc:
            raise ValueError(f"{operation_label} URL must use HTTPS")

        temporary_path: str | None = None
        object_key: str | None = None
        asset: Asset | None = None
        object_uploaded = False
        try:
            with tempfile.NamedTemporaryFile(
                prefix=temporary_prefix,
                suffix=".part",
                delete=False,
            ) as destination:
                temporary_path = destination.name
                streamed = await self._stream_to_file(
                    source_url,
                    destination,
                    expected_mime_type="video/*",
                    timeout_seconds=timeout_seconds,
                    max_bytes=max_bytes,
                    downloader=downloader,
                )

            actual_mime_type = _video_mime_type_for_file(temporary_path)
            declared_mime_type = _canonical_video_mime_type(streamed.mime_type)
            if declared_mime_type != actual_mime_type:
                raise ValueError("generated video MIME type does not match content")

            extension = ".mov" if actual_mime_type == "video/quicktime" else ".mp4"
            prepared = AssetCreate(
                tool_asset_role=ToolAssetRole.OUTPUT,
                type=AssetType.STORYBOARD_VIDEO,
                asset_role=AssetRole.PUBLIC,
                status=Status.SUCCEEDED,
                stage=Stage.VIDEO,
                mime_type=actual_mime_type,
                size_bytes=streamed.size_bytes,
                metadata={
                    **metadata,
                    **(
                        aigc_output_name_metadata(
                            naming_context,
                            mime_type=actual_mime_type,
                        )
                        if naming_context is not None
                        else {}
                    ),
                    "storage_provider": "tos",
                },
            )
            object_key = self.generate_object_key(
                asset_id=prepared.id,
                asset_type=prepared.type,
                stage=prepared.stage,
                filename=f"{filename_stem}{extension}",
                mime_type=actual_mime_type,
            )
            prepared = prepared.model_copy(
                update={
                    "object_key": object_key,
                    "url": self.url_for_key(object_key),
                },
                deep=True,
            )
            object_uploaded = True
            await asyncio.to_thread(
                self._put_object_from_file,
                key=object_key,
                file_path=temporary_path,
                content_type=actual_mime_type,
                size_bytes=streamed.size_bytes,
            )
            try:
                output_reference = AigcPipelineTaskAssetReference(
                    task_id=task_id,
                    direction=AigcAssetDirection.OUTPUT,
                    slot="video",
                    ordinal=0,
                    asset_id=prepared.id,
                )
                if references is None:
                    asset = repository.create_asset(prepared)
                    repository.add_aigc_task_assets(
                        [
                            output_reference,
                        ]
                    )
                else:
                    asset = repository.create_aigc_output_asset(
                        prepared,
                        references=[
                            *references,
                            output_reference,
                        ],
                    )
            except Exception:
                if asset is not None:
                    try:
                        repository.delete_tool_asset(asset.id)
                    except Exception:
                        pass
                await self._delete_uploaded_objects([object_key])
                object_uploaded = False
                raise
            assert asset is not None
            return asset
        except Exception:
            if object_key is not None and object_uploaded:
                await self._delete_uploaded_objects([object_key])
            raise
        finally:
            if temporary_path is not None:
                try:
                    os.unlink(temporary_path)
                except FileNotFoundError:
                    pass

    async def _stream_to_file(
        self,
        url: str,
        destination: BinaryIO,
        *,
        expected_mime_type: str,
        timeout_seconds: float,
        max_bytes: int,
        downloader: RemoteAssetDownloader,
    ) -> StreamedAsset:
        stream_to_file = getattr(downloader, "stream_to_file", None)
        async with asyncio.timeout(float(timeout_seconds)):
            if callable(stream_to_file):
                streamed = await stream_to_file(
                    url,
                    destination,
                    expected_mime_type=expected_mime_type,
                )
                actual_size = destination.tell()
                if actual_size > max_bytes:
                    raise ValueError("generated asset exceeds maximum size")
                if actual_size == 0:
                    raise ValueError("generated asset response is empty")
                return StreamedAsset(
                    mime_type=streamed.mime_type,
                    size_bytes=actual_size,
                )

            downloaded = await downloader.fetch(
                url,
                expected_mime_type=expected_mime_type,
            )
            if len(downloaded.content) > max_bytes:
                raise ValueError("generated asset exceeds maximum size")
            destination.write(downloaded.content)
            destination.flush()
            return StreamedAsset(
                mime_type=downloaded.mime_type,
                size_bytes=len(downloaded.content),
            )

    def _put_object_from_file(
        self,
        *,
        key: str,
        file_path: str,
        content_type: str,
        size_bytes: int,
    ) -> None:
        assert self.client is not None
        put_object_from_file = getattr(self.client, "put_object_from_file", None)
        if callable(put_object_from_file):
            put_object_from_file(
                key=key,
                file_path=file_path,
                content_type=content_type,
                size_bytes=size_bytes,
            )
            return

        with open(file_path, "rb") as content:
            self.client.put_object(
                key=key,
                content=content,  # type: ignore[arg-type]
                content_type=content_type,
            )

    async def upload_asset_companion_from_source(
        self,
        repository: Repository,
        asset: Asset,
        *,
        source_url: str,
        suffix: str,
        expected_mime_type: str,
        metadata_prefix: str,
    ) -> Asset:
        if self.client is None:
            raise ConfigurationError("TOS client is not configured for asset upload.")

        downloaded = await self.downloader.fetch(
            source_url,
            expected_mime_type=expected_mime_type,
        )
        object_key = self.companion_object_key(
            asset,
            suffix=suffix,
            mime_type=downloaded.mime_type,
        )
        await asyncio.to_thread(
            self.client.put_object,
            key=object_key,
            content=downloaded.content,
            content_type=downloaded.mime_type,
        )
        try:
            return repository.update_asset(
                asset.id,
                metadata={
                    **asset.metadata,
                    f"{metadata_prefix}_object_key": object_key,
                    f"{metadata_prefix}_mime_type": downloaded.mime_type,
                    f"{metadata_prefix}_size_bytes": len(downloaded.content),
                    f"{metadata_prefix}_status": "available",
                },
            )
        except Exception:
            await self._delete_uploaded_objects([object_key])
            raise

    def delete_asset_objects(self, asset: Asset) -> None:
        if self.client is None:
            return
        keys = [asset.object_key]
        last_frame_object_key = asset.metadata.get("last_frame_object_key")
        if isinstance(last_frame_object_key, str):
            keys.append(last_frame_object_key)
        for key in keys:
            if not key:
                continue
            try:
                self.client.delete_object(key=key)
            except Exception:
                pass

    async def _delete_uploaded_objects(self, keys: list[str]) -> None:
        if self.client is None:
            return
        for key in reversed(keys):
            try:
                await asyncio.to_thread(self.client.delete_object, key=key)
            except Exception:
                pass

    async def delete_object_keys(self, keys: list[str]) -> None:
        await self._delete_uploaded_objects(keys)


def _prompt_reference_image_count(request: AigcPromptOptimizeRequest) -> int:
    if request.target_type != "image_to_image":
        return 0
    return request.target_config.reference_image_count


@lru_cache
def get_asset_storage_service() -> AssetStorageService:
    return AssetStorageService.from_settings()


def _extension_for(*, filename: str | None, mime_type: str | None) -> str:
    if filename and "." in filename:
        suffix = filename.rsplit(".", 1)[-1].strip().lower()
        if suffix:
            return f".{_slug(suffix)}"
    if mime_type:
        guessed = mimetypes.guess_extension(mime_type.split(";", 1)[0].strip())
        if guessed:
            return guessed
    return ""


def _validated_response_mime_type(
    content_type: str | None,
    *,
    expected_mime_type: str | None,
) -> str:
    mime_type = (content_type or "").split(";", 1)[0].strip().lower()
    actual_family = mime_type.split("/", 1)[0]
    expected_family = (
        expected_mime_type.split("/", 1)[0] if expected_mime_type else None
    )
    if expected_family in {"image", "video", "audio"}:
        article = "an" if expected_family in {"image", "audio"} else "a"
        if actual_family != expected_family:
            raise ValueError(
                f"generated asset response is not {article} {expected_family}"
            )
    elif actual_family not in {"image", "video", "audio"}:
        raise ValueError("generated asset response is not a supported media type")
    expects_exact_mime = (
        expected_mime_type is not None and not expected_mime_type.endswith("/*")
    )
    if expects_exact_mime and mime_type != expected_mime_type:
        raise ValueError("generated asset MIME type does not match")
    return mime_type


def _video_mime_type_for_file(file_path: str) -> str:
    with open(file_path, "rb") as content:
        header = content.read(32)
    if len(header) < 12 or header[4:8] != b"ftyp":
        raise ValueError("generated video is not an MP4 or MOV file")
    return "video/quicktime" if header[8:12] == b"qt  " else "video/mp4"


def _canonical_video_mime_type(mime_type: str) -> str:
    if mime_type == "video/mp4":
        return mime_type
    if mime_type in {"video/quicktime", "video/mov"}:
        return "video/quicktime"
    raise ValueError("generated video must use MP4 or MOV MIME type")


def _video_enhancement_metadata(
    data: AigcVideoEnhancementAssetInput,
) -> dict[str, str | int | float | bool | None]:
    metadata: dict[str, str | int | float | bool | None] = {
        "origin": "aigc",
        "aigc_role": "output",
        "provider": "mediakit",
        "operation": "video_enhancement",
        "pipeline_id": data.pipeline_id,
        "run_id": data.run_id,
        "node_id": data.node_id,
        "task_id": data.task_id,
        "input_asset_id": data.input_asset_id,
        "provider_task_id": data.provider_task_id,
        "provider_request_id": data.provider_request_id,
        "tool_version": data.tool_version,
        "scene": data.scene,
        "enhance_style": data.enhance_style,
        "resolution_mode": data.resolution_mode,
        "resolution": data.resolution,
        "resolution_limit": data.resolution_limit,
        "fps": data.fps,
        "bitrate_mode": data.bitrate_mode,
        "bitrate_level": data.bitrate_level,
        "bitrate": data.bitrate,
        "bit_depth": data.bit_depth,
        "duration_seconds": data.duration_seconds,
        "executor_version": data.executor_version,
    }
    return {key: value for key, value in metadata.items() if value is not None}


def _video_face_blur_metadata(
    data: AigcVideoFaceBlurAssetInput,
) -> dict[str, str | int | float | bool | None]:
    metadata: dict[str, str | int | float | bool | None] = {
        "origin": "aigc",
        "aigc_role": "output",
        "provider": "mediakit",
        "operation": "face_blur_video",
        "pipeline_id": data.pipeline_id,
        "run_id": data.run_id,
        "node_id": data.node_id,
        "task_id": data.task_id,
        "input_asset_id": data.input_asset_id,
        "provider_task_id": data.provider_task_id,
        "provider_request_id": data.provider_request_id,
        "mask_mode": data.mask_mode,
        "mask_strength": data.mask_strength,
        "duration_seconds": data.duration_seconds,
        "executor_version": data.executor_version,
    }
    return {key: value for key, value in metadata.items() if value is not None}


def _video_subtitle_metadata(
    data: AigcVideoSubtitleAssetInput,
) -> dict[str, str | int | float | bool | None]:
    metadata: dict[str, str | int | float | bool | None] = {
        "origin": "aigc",
        "aigc_role": "output",
        "provider": "mediakit",
        "operation": "video_ocr",
        "mode": "Subtitle",
        "pipeline_id": data.pipeline_id,
        "run_id": data.run_id,
        "node_id": data.node_id,
        "task_id": data.task_id,
        "input_asset_id": data.input_asset_id,
        "provider_task_id": data.provider_task_id,
        "provider_request_id": data.provider_request_id,
        "segment_count": data.segment_count,
        "duration_seconds": data.duration_seconds,
        "executor_version": data.executor_version,
    }
    return {key: value for key, value in metadata.items() if value is not None}


def _multitrack_asset_references(
    data: AigcMultiTrackAssetInput,
) -> list[AigcPipelineTaskAssetReference]:
    slot_aliases = {
        "video": "video",
        "videos": "video",
        "image": "image",
        "images": "image",
        "audio": "audio",
        "audios": "audio",
        "subtitle": "subtitle",
        "subtitles": "subtitle",
        "srt": "subtitle",
    }
    grouped: dict[str, list[str]] = {
        "video": [],
        "image": [],
        "audio": [],
        "subtitle": [],
    }
    seen: set[str] = set()
    for raw_slot, asset_ids in data.input_asset_ids.items():
        slot = slot_aliases.get(raw_slot)
        if slot is None:
            raise ValueError(f"unsupported multi-track asset slot: {raw_slot}")
        for asset_id in asset_ids:
            normalized_id = asset_id.strip()
            if not normalized_id:
                raise ValueError("multi-track input asset ID must not be blank")
            if normalized_id in seen:
                continue
            seen.add(normalized_id)
            grouped[slot].append(normalized_id)

    return [
        AigcPipelineTaskAssetReference(
            task_id=data.task_id,
            direction=AigcAssetDirection.INPUT,
            slot=slot,
            ordinal=ordinal,
            asset_id=asset_id,
        )
        for slot in ("video", "image", "audio", "subtitle")
        for ordinal, asset_id in enumerate(grouped[slot])
    ]


def _multitrack_metadata(data: AigcMultiTrackAssetInput) -> dict[str, object]:
    canvas = _copy_allowed_mapping(
        data.canvas,
        {"mode", "width", "height", "background_color"},
    )
    tracks = [_sanitize_multitrack_track(track) for track in data.tracks]
    element_count = sum(len(track["elements"]) for track in tracks)
    metadata: dict[str, object] = {
        "origin": "aigc",
        "aigc_role": "output",
        "provider": "mediakit",
        "operation": "multi_track_edit",
        "pipeline_id": data.pipeline_id,
        "run_id": data.run_id,
        "node_id": data.node_id,
        "task_id": data.task_id,
        "provider_task_id": data.provider_task_id,
        "track_count": len(tracks),
        "element_count": element_count,
        "canvas": canvas,
        "tracks": tracks,
        "duration_ms": data.duration_ms,
        "width": data.width,
        "height": data.height,
        "fps": data.fps,
        "executor_version": data.executor_version,
    }
    if data.provider_request_id is not None:
        metadata["provider_request_id"] = data.provider_request_id
    return metadata


def _sanitize_multitrack_track(track: Mapping[str, object]) -> dict[str, object]:
    sanitized = _copy_allowed_mapping(
        track,
        {"id", "name", "type", "order", "hidden", "muted"},
    )
    elements = track.get("elements")
    sanitized["elements"] = (
        [
            _sanitize_multitrack_element(element)
            for element in elements
            if isinstance(element, Mapping)
        ]
        if isinstance(elements, Sequence)
        and not isinstance(elements, (str, bytes, bytearray))
        else []
    )
    return sanitized


def _sanitize_multitrack_element(
    element: Mapping[str, object],
) -> dict[str, object]:
    scalar_keys = {
        "id",
        "type",
        "loop",
        "speed",
        "volume",
        "fade_in_ms",
        "fade_out_ms",
        "inline_text",
        "asset_id",
    }
    sanitized = _copy_allowed_mapping(element, scalar_keys)
    nested_keys = {
        "source": {"source_node_id", "source_handle"},
        "target_time": {"start_ms", "end_ms"},
        "source_trim": {"start_ms", "end_ms"},
        "transform": {"x", "y", "width", "height", "rotation"},
        "transition": {"type", "duration_ms"},
        "style": {
            "font_type",
            "font_size",
            "color",
            "bold",
            "italic",
            "underline",
            "background_color",
        },
    }
    for key, allowed in nested_keys.items():
        value = element.get(key)
        if isinstance(value, Mapping):
            sanitized[key] = _copy_allowed_mapping(value, allowed)
    return sanitized


def _copy_allowed_mapping(
    value: Mapping[str, object],
    allowed: set[str],
) -> dict[str, object]:
    return {key: value[key] for key in allowed if key in value}


def _validate_image_content(downloaded: DownloadedAsset) -> None:
    if downloaded.mime_type == "image/png":
        if not downloaded.content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("generated image content does not match PNG MIME type")
        return
    if downloaded.mime_type == "image/jpeg":
        if not downloaded.content.startswith(b"\xff\xd8\xff"):
            raise ValueError("generated image content does not match JPEG MIME type")
        return
    raise ValueError("generated image must be PNG or JPEG")


def _validate_image_dimensions(
    downloaded: DownloadedAsset,
    *,
    expected: tuple[int, int],
) -> tuple[int, int]:
    try:
        with Image.open(BytesIO(downloaded.content)) as image:
            image.load()
            actual_format = image.format
            actual = image.size
    except (OSError, UnidentifiedImageError, ValueError) as exc:
        raise GeneratedImageValidationError(
            "output_image_decode_failed",
            "Generated image could not be decoded as PNG or JPEG",
        ) from exc

    expected_format = {
        "image/png": "PNG",
        "image/jpeg": "JPEG",
    }.get(downloaded.mime_type)
    if expected_format is None or actual_format != expected_format:
        raise GeneratedImageValidationError(
            "output_image_decode_failed",
            "Generated image could not be decoded as the declared PNG or JPEG format",
        )
    if actual != expected:
        raise GeneratedImageValidationError(
            "output_dimensions_mismatch",
            (
                f"Generated image dimensions {actual[0]}x{actual[1]} "
                f"do not match requested {expected[0]}x{expected[1]}"
            ),
        )
    return actual


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-").lower()
    return slug or "asset"
