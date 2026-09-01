from __future__ import annotations

import asyncio
import mimetypes
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol
from urllib.parse import quote, urlsplit

import httpx

from backend.app.core.config import ConfigurationError, Settings, get_settings
from backend.app.repositories import Repository
from backend.app.schemas import (
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
        timeout_seconds: int,
        max_bytes: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.max_bytes = max_bytes
        self.transport = transport

    async def fetch(
        self,
        url: str,
        *,
        expected_mime_type: str | None = None,
    ) -> DownloadedAsset:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("generated asset URL must use HTTP or HTTPS")

        timeout = httpx.Timeout(float(self.timeout_seconds))
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout,
            transport=self.transport,
        ) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                mime_type = (
                    response.headers.get("content-type", "")
                    .split(";", 1)[0]
                    .strip()
                    .lower()
                )
                actual_family = mime_type.split("/", 1)[0]
                expected_family = (
                    expected_mime_type.split("/", 1)[0]
                    if expected_mime_type
                    else None
                )
                if expected_family in {"image", "video", "audio"}:
                    article = "an" if expected_family in {"image", "audio"} else "a"
                    if actual_family != expected_family:
                        raise ValueError(
                            f"generated asset response is not {article} "
                            f"{expected_family}"
                        )
                elif actual_family not in {"image", "video", "audio"}:
                    raise ValueError(
                        "generated asset response is not a supported media type"
                    )
                expects_exact_mime = (
                    expected_mime_type is not None
                    and not expected_mime_type.endswith("/*")
                )
                if expects_exact_mime and mime_type != expected_mime_type:
                    raise ValueError("generated asset MIME type does not match")

                chunks: list[bytes] = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > self.max_bytes:
                        raise ValueError("generated asset exceeds maximum size")
                    chunks.append(chunk)

        content = b"".join(chunks)
        if not content:
            raise ValueError("generated asset response is empty")
        return DownloadedAsset(content=content, mime_type=mime_type)


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


class AssetStorageService:
    """Creates stable object keys/URLs and persists asset records."""

    def __init__(
        self,
        *,
        bucket: str,
        public_endpoint: str | None = None,
        client: ObjectStorageClient | None = None,
        downloader: RemoteAssetDownloader | None = None,
        key_prefix: str = "projects",
        download_timeout_seconds: int = 30,
        download_max_bytes: int = 30 * 1024 * 1024,
    ) -> None:
        self.bucket = bucket
        self.public_endpoint = public_endpoint
        self.client = client
        self.downloader = downloader or HttpRemoteAssetDownloader(
            timeout_seconds=download_timeout_seconds,
            max_bytes=download_max_bytes,
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
        return repository.create_asset(
            asset.model_copy(
                update={
                    "object_key": object_key,
                    "url": self.url_for_key(object_key),
                },
                deep=True,
            )
        )

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
            return repository.create_asset(
                asset.model_copy(
                    update={
                        "object_key": object_key,
                        "url": self.url_for_key(object_key),
                    },
                    deep=True,
                )
            )
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

        downloaded: list[tuple[StoredAssetInput, DownloadedAsset]] = []
        for item in items:
            if not item.source_url:
                raise ValueError("generated asset source URL is required")
            content = await self.downloader.fetch(
                item.source_url,
                expected_mime_type=item.mime_type,
            )
            if item.validate_image_content:
                _validate_image_content(content)
            downloaded.append((item, content))

        prepared: list[tuple[AssetCreate, bytes]] = []
        for item, download in downloaded:
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
                    "storage_provider": "tos",
                    **({"source_host": source_host} if source_host else {}),
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
            return repository.create_assets([asset for asset, _ in prepared])
        except Exception:
            await self._delete_uploaded_objects(uploaded_keys)
            raise

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


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-").lower()
    return slug or "asset"
