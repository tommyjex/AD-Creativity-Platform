from __future__ import annotations

import asyncio
import io
import math
from dataclasses import dataclass
from typing import Protocol, Sequence

from PIL import Image, UnidentifiedImageError

from backend.app.core.config import ConfigurationError
from backend.app.repositories import Repository
from backend.app.schemas import (
    Asset,
    AssetCreate,
    AssetRole,
    AssetType,
    ImageLayerCreate,
    ImageLayerSet,
    ImageLayerSetCreate,
    Stage,
    Status,
)
from backend.app.services.assets import (
    AssetStorageService,
    DownloadedAsset,
    _validate_image_content,
)
from backend.app.services.modelark import (
    DecomposedImageLayer,
    LayerDecompositionResult,
)


MAX_LAYER_IMAGE_BYTES = 30 * 1024 * 1024
MIN_LAYER_IMAGE_PIXELS = 262_144
MAX_LAYER_IMAGE_PIXELS = 36_000_000


@dataclass(frozen=True)
class ImageContentInfo:
    mime_type: str
    width: int
    height: int
    has_transparency: bool


@dataclass(frozen=True)
class ImageLayerCompositionResult:
    content: bytes
    width: int
    height: int
    mime_type: str = "image/png"


class ComposableImageLayer(Protocol):
    id: str
    asset_id: str
    z_index: int
    bbox_absolute: tuple[int, int, int, int]
    visible: bool
    x: float
    y: float
    scale: float


class ImageLayerCompositionService:
    def compose(
        self,
        *,
        layer_set: ImageLayerSet,
        base_content: bytes,
        layer_contents: dict[str, bytes],
    ) -> ImageLayerCompositionResult:
        if layer_set.status != Status.SUCCEEDED:
            raise ValueError("image layer set is not ready for composition")
        return self.compose_pixels(
            canvas_width=layer_set.canvas_width,
            canvas_height=layer_set.canvas_height,
            layers=layer_set.layers,
            base_content=base_content,
            layer_contents=layer_contents,
        )

    def compose_pixels(
        self,
        *,
        canvas_width: int,
        canvas_height: int,
        layers: Sequence[ComposableImageLayer],
        base_content: bytes,
        layer_contents: dict[str, bytes],
    ) -> ImageLayerCompositionResult:
        if canvas_width <= 0 or canvas_height <= 0:
            raise ValueError("image layer canvas dimensions are invalid")

        canvas = self._decode(base_content, label="base").convert("RGBA")
        if canvas.size != (canvas_width, canvas_height):
            raise ValueError("base image dimensions do not match the canvas")

        ordered = sorted(layers, key=lambda item: item.z_index)
        if [item.z_index for item in ordered] != list(range(1, len(ordered) + 1)):
            raise ValueError("image layer order is invalid")

        for layer in ordered:
            if (
                not math.isfinite(layer.x)
                or not math.isfinite(layer.y)
                or not math.isfinite(layer.scale)
                or not 0.05 <= layer.scale <= 20
            ):
                raise ValueError("image layer transform is invalid")
            content = layer_contents.get(layer.asset_id)
            if content is None:
                raise ValueError("image layer content is missing")
            image = self._decode(content, label=layer.id).convert("RGBA")
            x1, y1, x2, y2 = layer.bbox_absolute
            expected_size = (x2 - x1, y2 - y1)
            if image.size != expected_size:
                raise ValueError("image layer dimensions do not match its bbox")
            if not layer.visible:
                continue
            target_size = (
                max(1, round(image.width * layer.scale)),
                max(1, round(image.height * layer.scale)),
            )
            if image.size != target_size:
                image = image.resize(target_size, Image.Resampling.LANCZOS)
            self._composite_clipped(
                canvas,
                image,
                x=round(layer.x),
                y=round(layer.y),
            )

        output = io.BytesIO()
        canvas.save(output, format="PNG", optimize=True)
        return ImageLayerCompositionResult(
            content=output.getvalue(),
            width=canvas.width,
            height=canvas.height,
        )

    @staticmethod
    def _decode(content: bytes, *, label: str) -> Image.Image:
        if not content or len(content) > MAX_LAYER_IMAGE_BYTES:
            raise ValueError(f"{label} image content is invalid")
        try:
            image = Image.open(io.BytesIO(content))
            image.load()
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise ValueError(f"{label} image cannot be decoded") from exc
        if image.width <= 0 or image.height <= 0:
            raise ValueError(f"{label} image dimensions are invalid")
        return image

    @staticmethod
    def _composite_clipped(
        canvas: Image.Image,
        layer: Image.Image,
        *,
        x: int,
        y: int,
    ) -> None:
        left = max(0, x)
        top = max(0, y)
        right = min(canvas.width, x + layer.width)
        bottom = min(canvas.height, y + layer.height)
        if left >= right or top >= bottom:
            return
        source = layer.crop((left - x, top - y, right - x, bottom - y))
        canvas.alpha_composite(source, dest=(left, top))


async def read_layer_set_contents(
    *,
    repository: Repository,
    asset_storage: AssetStorageService,
    layer_set: ImageLayerSet,
) -> tuple[bytes, dict[str, bytes]]:
    if asset_storage.client is None:
        raise ConfigurationError("TOS client is not configured for layer composition.")
    base_asset = repository.get_asset(layer_set.base_asset_id)
    if (
        base_asset.project_id != layer_set.project_id
        or base_asset.asset_role != AssetRole.INTERNAL_BASE
        or base_asset.status != Status.SUCCEEDED
        or not base_asset.object_key
    ):
        raise ValueError("image layer base asset is invalid")
    base_content = await asyncio.to_thread(
        asset_storage.client.get_object,
        key=base_asset.object_key,
    )
    layer_contents: dict[str, bytes] = {}
    for layer in layer_set.layers:
        asset = repository.get_asset(layer.asset_id)
        if (
            asset.project_id != layer_set.project_id
            or asset.asset_role != AssetRole.INTERNAL_LAYER
            or asset.status != Status.SUCCEEDED
            or not asset.object_key
        ):
            raise ValueError("image layer asset is invalid")
        layer_contents[asset.id] = await asyncio.to_thread(
            asset_storage.client.get_object,
            key=asset.object_key,
        )
    return base_content, layer_contents


async def persist_layer_composition(
    *,
    repository: Repository,
    asset_storage: AssetStorageService,
    layer_set: ImageLayerSet,
    source_asset_id: str,
    task_id: str,
    result: ImageLayerCompositionResult,
    set_current: bool,
    expected_image_revision: int,
) -> Asset:
    if asset_storage.client is None:
        raise ConfigurationError("TOS client is not configured for layer composition.")
    project = repository.get_project(layer_set.project_id)
    source_asset = repository.get_asset(source_asset_id)
    asset = AssetCreate(
        project_id=layer_set.project_id,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.PUBLIC,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        mime_type=result.mime_type,
        size_bytes=len(result.content),
        source_task_id=task_id,
        metadata={
            "operation": "layer_composite",
            "source_asset_id": source_asset_id,
            "layer_set_id": layer_set.id,
            "layer_revision": layer_set.revision,
            "width": result.width,
            "height": result.height,
            "size": f"{result.width}x{result.height}",
            "format": "png",
            "model": f"Pillow {Image.__version__}",
            "image_purpose": (
                project.brief.image_purpose.value
                if project.brief.image_purpose is not None
                else None
            ),
            "prompt_summary": source_asset.metadata.get("prompt_summary"),
            "storage_provider": "tos",
        },
    )
    object_key = asset_storage.generate_object_key(
        project_id=asset.project_id,
        asset_id=asset.id,
        asset_type=asset.type,
        stage=asset.stage,
        mime_type=asset.mime_type,
    )
    prepared = asset.model_copy(
        update={
            "object_key": object_key,
            "url": asset_storage.url_for_key(object_key),
        },
        deep=True,
    )
    await asyncio.to_thread(
        asset_storage.client.put_object,
        key=object_key,
        content=result.content,
        content_type=result.mime_type,
    )
    try:
        if set_current:
            return repository.create_asset_and_set_current_image(
                prepared,
                expected_revision=expected_image_revision,
            )
        return repository.create_asset(prepared)
    except Exception:
        await asset_storage.delete_object_keys([object_key])
        raise


def inspect_layer_image_content(
    downloaded: DownloadedAsset,
    *,
    require_transparency: bool = False,
    enforce_input_limits: bool = False,
) -> ImageContentInfo:
    _validate_image_content(downloaded)
    if len(downloaded.content) > MAX_LAYER_IMAGE_BYTES:
        raise ValueError("image exceeds 30 MB")
    if downloaded.mime_type == "image/png":
        width, height, has_transparency = _png_info(downloaded.content)
    else:
        width, height = _jpeg_dimensions(downloaded.content)
        has_transparency = False
    if enforce_input_limits:
        pixels = width * height
        if not MIN_LAYER_IMAGE_PIXELS <= pixels <= MAX_LAYER_IMAGE_PIXELS:
            raise ValueError("image pixel count is outside the supported range")
        ratio = width / height
        if not 1 / 16 <= ratio <= 16:
            raise ValueError("image aspect ratio is outside the supported range")
    if require_transparency and not has_transparency:
        raise ValueError("decomposed layers must be transparent PNG images")
    return ImageContentInfo(
        mime_type=downloaded.mime_type,
        width=width,
        height=height,
        has_transparency=has_transparency,
    )


def normalize_layer_image_content(
    downloaded: DownloadedAsset,
    *,
    target_width: int,
    target_height: int,
) -> DownloadedAsset:
    info = inspect_layer_image_content(downloaded, require_transparency=True)
    if (info.width, info.height) == (target_width, target_height):
        return downloaded

    image = Image.open(io.BytesIO(downloaded.content)).convert("RGBA")
    resized = image.resize(
        (target_width, target_height),
        Image.Resampling.LANCZOS,
    )
    output = io.BytesIO()
    resized.save(output, format="PNG", optimize=True)
    normalized = DownloadedAsset(output.getvalue(), "image/png")
    normalized_info = inspect_layer_image_content(
        normalized,
        require_transparency=True,
    )
    if (normalized_info.width, normalized_info.height) != (
        target_width,
        target_height,
    ):
        raise ValueError("decomposed layer could not be normalized to its bbox")
    return normalized


async def persist_layer_decomposition(
    *,
    repository: Repository,
    asset_storage: AssetStorageService,
    source_asset: Asset,
    task_id: str,
    result: LayerDecompositionResult,
    canvas_width: int,
    canvas_height: int,
    base_mime_type: str,
) -> ImageLayerSet:
    if asset_storage.client is None:
        raise ConfigurationError("TOS client is not configured for layer storage.")

    base_download = await asset_storage.downloader.fetch(
        result.base_url,
        expected_mime_type=base_mime_type,
    )
    base_info = inspect_layer_image_content(base_download)
    if (base_info.width, base_info.height) != (canvas_width, canvas_height):
        raise ValueError("decomposed base dimensions do not match the source canvas")

    layer_downloads: list[tuple[DecomposedImageLayer, DownloadedAsset]] = []
    for layer in result.layers:
        downloaded = await asset_storage.downloader.fetch(
            layer.url,
            expected_mime_type="image/png",
        )
        info = inspect_layer_image_content(
            downloaded,
            require_transparency=True,
        )
        x1, y1, x2, y2 = layer.bbox_absolute
        if (info.width, info.height) != (x2 - x1, y2 - y1):
            downloaded = normalize_layer_image_content(
                downloaded,
                target_width=x2 - x1,
                target_height=y2 - y1,
            )
        layer_downloads.append((layer, downloaded))

    layer_set_data = ImageLayerSetCreate(
        project_id=source_asset.project_id,
        source_asset_id=source_asset.id,
        base_asset_id="placeholder",
        canvas_width=canvas_width,
        canvas_height=canvas_height,
        status=Status.SUCCEEDED,
    )
    base_asset = _internal_asset(
        asset_storage=asset_storage,
        project_id=source_asset.project_id,
        role=AssetRole.INTERNAL_BASE,
        task_id=task_id,
        mime_type=base_download.mime_type,
        size_bytes=len(base_download.content),
        metadata={
            "layer_set_id": layer_set_data.id,
            "source_asset_id": source_asset.id,
            "z_index": 0,
        },
    )
    layer_set_data = layer_set_data.model_copy(
        update={"base_asset_id": base_asset.id}
    )
    assets = [base_asset]
    layers: list[ImageLayerCreate] = []
    uploads: list[tuple[AssetCreate, bytes]] = [(base_asset, base_download.content)]
    for raw_layer, downloaded in layer_downloads:
        layer_asset = _internal_asset(
            asset_storage=asset_storage,
            project_id=source_asset.project_id,
            role=AssetRole.INTERNAL_LAYER,
            task_id=task_id,
            mime_type=downloaded.mime_type,
            size_bytes=len(downloaded.content),
            metadata={
                "layer_set_id": layer_set_data.id,
                "source_asset_id": source_asset.id,
                "z_index": raw_layer.z_index,
            },
        )
        x1, y1, _, _ = raw_layer.bbox_absolute
        assets.append(layer_asset)
        uploads.append((layer_asset, downloaded.content))
        layers.append(
            ImageLayerCreate(
                set_id=layer_set_data.id,
                asset_id=layer_asset.id,
                z_index=raw_layer.z_index,
                name=raw_layer.name,
                description=raw_layer.description,
                bbox_absolute=raw_layer.bbox_absolute,
                bbox_normalized=raw_layer.bbox_normalized,
                visible=True,
                x=float(x1),
                y=float(y1),
                scale=1.0,
            )
        )

    uploaded_keys: list[str] = []
    try:
        for asset, content in uploads:
            assert asset.object_key is not None
            await asyncio.to_thread(
                asset_storage.client.put_object,
                key=asset.object_key,
                content=content,
                content_type=asset.mime_type,
            )
            uploaded_keys.append(asset.object_key)
        return repository.create_image_layer_set(
            layer_set_data,
            layers=layers,
            assets=assets,
        )
    except Exception:
        await asset_storage.delete_object_keys(uploaded_keys)
        raise


def _internal_asset(
    *,
    asset_storage: AssetStorageService,
    project_id: str,
    role: AssetRole,
    task_id: str,
    mime_type: str,
    size_bytes: int,
    metadata: dict[str, object],
) -> AssetCreate:
    asset = AssetCreate(
        project_id=project_id,
        type=AssetType.GENERATED_IMAGE,
        asset_role=role,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        mime_type=mime_type,
        size_bytes=size_bytes,
        source_task_id=task_id,
        metadata={
            **metadata,
            "storage_provider": "tos",
        },
    )
    object_key = asset_storage.generate_object_key(
        project_id=project_id,
        asset_id=asset.id,
        asset_type=asset.type,
        stage=asset.stage,
        mime_type=mime_type,
    )
    return asset.model_copy(update={"object_key": object_key, "url": None})


def _png_info(content: bytes) -> tuple[int, int, bool]:
    if (
        len(content) < 45
        or content[12:16] != b"IHDR"
        or b"IEND" not in content[-16:]
    ):
        raise ValueError("PNG is missing a valid IHDR chunk")
    width = int.from_bytes(content[16:20], "big")
    height = int.from_bytes(content[20:24], "big")
    if width <= 0 or height <= 0:
        raise ValueError("PNG dimensions must be positive")
    color_type = content[25]
    has_transparency = color_type in {4, 6} or b"tRNS" in content
    return width, height, has_transparency


def _jpeg_dimensions(content: bytes) -> tuple[int, int]:
    if not content.endswith(b"\xff\xd9"):
        raise ValueError("JPEG is missing its end marker")
    offset = 2
    while offset + 4 <= len(content):
        if content[offset] != 0xFF:
            offset += 1
            continue
        marker = content[offset + 1]
        offset += 2
        if marker in {0xD8, 0xD9} or 0xD0 <= marker <= 0xD7:
            continue
        if offset + 2 > len(content):
            break
        length = int.from_bytes(content[offset : offset + 2], "big")
        if length < 2 or offset + length > len(content):
            break
        if marker in {
            0xC0,
            0xC1,
            0xC2,
            0xC3,
            0xC5,
            0xC6,
            0xC7,
            0xC9,
            0xCA,
            0xCB,
            0xCD,
            0xCE,
            0xCF,
        }:
            if length < 7:
                break
            height = int.from_bytes(content[offset + 3 : offset + 5], "big")
            width = int.from_bytes(content[offset + 5 : offset + 7], "big")
            if width > 0 and height > 0:
                return width, height
            break
        offset += length
    raise ValueError("JPEG dimensions could not be decoded")
