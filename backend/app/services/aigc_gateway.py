from __future__ import annotations

import asyncio
import hashlib
import io
import json
import re
import time
import urllib.request
from dataclasses import dataclass
from time import perf_counter
from typing import Literal
from urllib.parse import urlsplit
from uuid import uuid4

from PIL import Image, ImageChops, UnidentifiedImageError
from pydantic import Field, field_validator, model_validator

from backend.app.repositories import NotFoundError, Repository
from backend.app.schemas import (
    AIGC_DEFAULT_IMAGE_MODEL,
    AIGC_DEFAULT_TEXT_MODEL,
    AigcAssetDirection,
    AigcEditedLayer,
    AigcImageLayer,
    AigcLayer,
    AigcLayerSet,
    AigcPipelineTaskAssetReference,
    AigcPipelineTaskAttempt,
    AigcResultAsset,
    AigcResultKind,
    AigcTaskError,
    AigcTaskMetrics,
    AigcTaskResult,
    AigcTaskType,
    Asset,
    AssetCreate,
    AssetRole,
    AssetType,
    ImageGenerationOperation,
    ImageGenerationSize,
    ImageLayerDecompositionSize,
    ImageOutputFormat,
    Stage,
    Status,
    ToolAssetRole,
    ReferenceAssetKind,
)
from backend.app.schemas.common import SchemaModel
from backend.app.schemas.seedance import (
    SEEDANCE_DEFAULT_ASPECT_RATIO,
    SEEDANCE_DEFAULT_DURATION_SECONDS,
    SEEDANCE_DEFAULT_GENERATE_AUDIO,
    SEEDANCE_DEFAULT_MODEL,
    SEEDANCE_DEFAULT_TASK_TYPE,
    SeedanceAspectRatio,
    SeedanceGenerationMode,
    SeedanceModel,
    SeedanceResolution,
    SeedanceTaskType,
)
from backend.app.services.assets import (
    AssetStorageService,
    DownloadedAsset,
    StoredAssetInput,
)
from backend.app.services.generation import ModelArkGenerationService
from backend.app.services.image_layers import (
    ImageLayerCompositionService,
    MAX_LAYER_IMAGE_BYTES,
    MAX_LAYER_IMAGE_PIXELS,
    MIN_LAYER_IMAGE_PIXELS,
    normalize_layer_image_content,
)
from backend.app.services.media_inspector import (
    MediaInspection,
    MediaInspectionError,
    MediaInspector,
    validate_seedance_media_inputs,
)
from backend.app.services.modelark import (
    DecomposedImageLayer,
    LayerDecompositionResult,
    ModelArkProviderError,
    SeedanceVideoGenerationRequest,
)

AIGC_LLM_EXECUTOR_VERSION = "aigc-llm-v1"
AIGC_IMAGE_EXECUTOR_VERSION = "aigc-image-v3"
AIGC_VIDEO_EXECUTOR_VERSION = "aigc-video-v2"
AIGC_LAYER_EXECUTOR_VERSION = "aigc-layer-v1"
AIGC_LLM_TIMEOUT_SECONDS = 120
AIGC_IMAGE_TIMEOUT_SECONDS = 300
AIGC_VIDEO_TIMEOUT_SECONDS = 1800


# #region debug-point A-E:reporter
def _debug_layer_asset_transfer(
    hypothesis_id: str,
    location: str,
    message: str,
    data: dict[str, object],
) -> None:
    try:
        debug_url = "http://127.0.0.1:7777/event"
        session_id = "aigc-layer-asset-transfer"
        try:
            with open(
                ".dbg/aigc-layer-asset-transfer.env",
                encoding="utf-8",
            ) as env_file:
                env_values = dict(
                    line.split("=", 1)
                    for line in env_file.read().splitlines()
                    if "=" in line
                )
            debug_url = env_values.get("DEBUG_SERVER_URL", debug_url)
            session_id = env_values.get("DEBUG_SESSION_ID", session_id)
        except Exception:
            pass
        urllib.request.urlopen(
            urllib.request.Request(
                debug_url,
                data=json.dumps(
                    {
                        "sessionId": session_id,
                        "runId": "post-fix",
                        "hypothesisId": hypothesis_id,
                        "location": location,
                        "msg": f"[DEBUG] {message}",
                        "data": data,
                        "ts": int(time.time() * 1000),
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            ),
            timeout=0.2,
        ).read()
    except Exception:
        pass
# #endregion


class AigcLlmExecutionParams(SchemaModel):
    model: str = AIGC_DEFAULT_TEXT_MODEL
    prompt: str = Field(..., min_length=1, max_length=20000)
    system_prompt: str = Field(default="", max_length=12000)
    temperature: float = Field(default=0.7, ge=0, le=2)


class AigcImageExecutionParams(SchemaModel):
    model: str = AIGC_DEFAULT_IMAGE_MODEL
    prompt: str = Field(..., min_length=1, max_length=20000)
    aspect_ratio: str = Field(default="1:1", pattern=r"^(1:1|16:9|9:16|4:3|3:4)$")
    size: ImageGenerationSize = ImageGenerationSize.TWO_K
    format: ImageOutputFormat = ImageOutputFormat.PNG
    reference_asset_ids: list[str] = Field(default_factory=list, max_length=10)
    source_asset_id: str | None = None
    operation: Literal["image_to_image"] = "image_to_image"

    @field_validator("reference_asset_ids")
    @classmethod
    def validate_reference_asset_ids(cls, value: list[str]) -> list[str]:
        normalized = [asset_id.strip() for asset_id in value]
        if any(not asset_id for asset_id in normalized):
            raise ValueError("reference asset IDs must not be blank")
        return normalized

    @field_validator("source_asset_id")
    @classmethod
    def strip_source_asset_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("source_asset_id must not be blank")
        return stripped

    @model_validator(mode="after")
    def normalize_legacy_source_asset_id(self) -> "AigcImageExecutionParams":
        if self.source_asset_id is None:
            return self
        if self.reference_asset_ids:
            raise ValueError(
                "source_asset_id cannot be combined with reference_asset_ids"
            )
        self.reference_asset_ids = [self.source_asset_id]
        return self


class AigcImageEditExecutionParams(SchemaModel):
    model: str = AIGC_DEFAULT_IMAGE_MODEL
    operation: Literal["image_edit"]
    prompt: str = Field(..., min_length=1, max_length=20000)
    aspect_ratio: str = Field(default="1:1", pattern=r"^(1:1|16:9|9:16|4:3|3:4)$")
    size: ImageGenerationSize = ImageGenerationSize.TWO_K
    format: ImageOutputFormat = ImageOutputFormat.PNG
    edit_image_asset_id: str | None = None
    edit_layer: AigcImageLayer | None = None

    @field_validator("edit_image_asset_id")
    @classmethod
    def strip_edit_image_asset_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("edit_image_asset_id must not be blank")
        return stripped

    @model_validator(mode="after")
    def validate_edit_target(self) -> "AigcImageEditExecutionParams":
        if (self.edit_image_asset_id is None) == (self.edit_layer is None):
            raise ValueError(
                "image_edit requires exactly one of edit_image_asset_id or edit_layer"
            )
        return self


class AigcLayerDecompositionExecutionParams(SchemaModel):
    model: str = AIGC_DEFAULT_IMAGE_MODEL
    operation: Literal["layer_decomposition"]
    prompt: str = Field(default="", max_length=20000)
    size: ImageLayerDecompositionSize = ImageLayerDecompositionSize.AUTO
    format: ImageOutputFormat = ImageOutputFormat.PNG
    source_asset_id: str = Field(..., min_length=1)
    aspect_ratio: str = "1:1"

    @field_validator("source_asset_id")
    @classmethod
    def strip_source_asset_id(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("source_asset_id must not be blank")
        return stripped


class AigcLayerCompositeExecutionParams(SchemaModel):
    input_layer_set: AigcLayerSet
    replacement: AigcEditedLayer


class AigcVideoExecutionParams(SchemaModel):
    model: SeedanceModel = SEEDANCE_DEFAULT_MODEL
    generation_mode: SeedanceGenerationMode
    task_type: SeedanceTaskType = SEEDANCE_DEFAULT_TASK_TYPE
    prompt: str = Field(default="", max_length=12000)
    first_frame_asset_id: str | None = None
    last_frame_asset_id: str | None = None
    reference_image_asset_ids: list[str] = Field(default_factory=list, max_length=30)
    reference_video_asset_ids: list[str] = Field(default_factory=list, max_length=10)
    reference_audio_asset_ids: list[str] = Field(default_factory=list, max_length=10)
    duration_seconds: int = Field(
        default=SEEDANCE_DEFAULT_DURATION_SECONDS,
        strict=True,
    )
    resolution: SeedanceResolution
    aspect_ratio: SeedanceAspectRatio = SEEDANCE_DEFAULT_ASPECT_RATIO
    generate_audio: bool = Field(
        default=SEEDANCE_DEFAULT_GENERATE_AUDIO,
        strict=True,
    )

    @field_validator(
        "first_frame_asset_id",
        "last_frame_asset_id",
        mode="before",
    )
    @classmethod
    def normalize_optional_asset_id(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None

    @field_validator(
        "reference_image_asset_ids",
        "reference_video_asset_ids",
        "reference_audio_asset_ids",
    )
    @classmethod
    def validate_asset_ids(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values]
        if any(not value for value in normalized):
            raise ValueError("reference asset IDs must not be blank")
        return normalized


@dataclass(frozen=True)
class AigcGatewayExecution:
    result: AigcTaskResult
    metrics: AigcTaskMetrics
    executor_version: str


class AigcGatewayError(RuntimeError):
    def __init__(self, error: AigcTaskError, *, retryable: bool = False) -> None:
        super().__init__(error.message)
        self.error = error
        self.retryable = retryable


class AigcModelGateway:
    def __init__(
        self,
        repository: Repository,
        generation: ModelArkGenerationService,
        asset_storage: AssetStorageService,
        *,
        media_inspector: MediaInspector | None = None,
        video_timeout_seconds: float = AIGC_VIDEO_TIMEOUT_SECONDS,
    ) -> None:
        self.repository = repository
        self.generation = generation
        self.asset_storage = asset_storage
        self.media_inspector = media_inspector
        if video_timeout_seconds <= 0:
            raise ValueError("video_timeout_seconds must be positive")
        self.video_timeout_seconds = video_timeout_seconds

    async def execute(
        self,
        task: AigcPipelineTaskAttempt,
    ) -> AigcGatewayExecution:
        started = perf_counter()
        try:
            if task.type == AigcTaskType.LLM:
                async with asyncio.timeout(AIGC_LLM_TIMEOUT_SECONDS):
                    result = await self._execute_llm(task)
                executor_version = AIGC_LLM_EXECUTOR_VERSION
            elif task.type in {
                AigcTaskType.TEXT_TO_IMAGE,
                AigcTaskType.IMAGE_TO_IMAGE,
            }:
                async with asyncio.timeout(AIGC_IMAGE_TIMEOUT_SECONDS):
                    result = await self._execute_image(task)
                executor_version = AIGC_IMAGE_EXECUTOR_VERSION
            elif task.type == AigcTaskType.IMAGE_EDIT:
                async with asyncio.timeout(AIGC_IMAGE_TIMEOUT_SECONDS):
                    result = await self._execute_image_edit(task)
                executor_version = AIGC_IMAGE_EXECUTOR_VERSION
            elif task.type == AigcTaskType.LAYER_DECOMPOSITION:
                async with asyncio.timeout(AIGC_IMAGE_TIMEOUT_SECONDS):
                    result = await self._execute_layer_decomposition(task)
                executor_version = AIGC_IMAGE_EXECUTOR_VERSION
            elif task.type == AigcTaskType.LAYER_COMPOSITE:
                async with asyncio.timeout(AIGC_IMAGE_TIMEOUT_SECONDS):
                    result = await self._execute_layer_composite(task)
                executor_version = AIGC_LAYER_EXECUTOR_VERSION
            elif task.type == AigcTaskType.VIDEO_GENERATION:
                async with asyncio.timeout(self.video_timeout_seconds):
                    result = await self._execute_video(task)
                executor_version = AIGC_VIDEO_EXECUTOR_VERSION
            else:
                raise AigcGatewayError(
                    AigcTaskError(
                        code="unsupported_node_type",
                        message="AIGC node type is not supported",
                        stage="dispatch",
                    )
                )
        except TimeoutError as exc:
            raise AigcGatewayError(
                AigcTaskError(
                    code="timeout",
                    message="AIGC model request timed out",
                    stage="provider_call",
                ),
                retryable=True,
            ) from exc
        except ModelArkProviderError as exc:
            fields = exc.safe_log_fields()
            provider_code = fields.get("provider_code")
            raw_code = (
                str(provider_code)
                if isinstance(provider_code, str) and provider_code
                else "provider_error"
            )
            code = _normalized_provider_error_code(raw_code)
            message = exc.safe_detail() or "AIGC model request failed"
            retryable = _is_retryable_provider_code(code)
            raise AigcGatewayError(
                AigcTaskError(
                    code=code,
                    message=message[:500],
                    request_id=(
                        str(fields["request_id"])
                        if fields.get("request_id")
                        else None
                    ),
                    stage=(
                        str(fields["phase"]) if fields.get("phase") else "provider_call"
                    ),
                ),
                retryable=retryable,
            ) from exc
        except AigcGatewayError:
            raise
        except MediaInspectionError as exc:
            raise AigcGatewayError(
                AigcTaskError(
                    code="invalid_media_input",
                    message=str(exc)[:500],
                    stage="input_resolution",
                )
            ) from exc
        except (NotFoundError, ValueError) as exc:
            raise AigcGatewayError(
                AigcTaskError(
                    code="invalid_input",
                    message="AIGC node input is invalid or unavailable",
                    stage="input_resolution",
                )
            ) from exc

        return AigcGatewayExecution(
            result=result,
            metrics=AigcTaskMetrics(
                duration_ms=max(0, round((perf_counter() - started) * 1000))
            ),
            executor_version=executor_version,
        )

    async def _execute_llm(
        self,
        task: AigcPipelineTaskAttempt,
    ) -> AigcTaskResult:
        params = AigcLlmExecutionParams.model_validate(task.params)
        if params.model != AIGC_DEFAULT_TEXT_MODEL:
            raise ValueError("LLM model is not enabled")
        text = await self.generation.generate_aigc_text(
            model=params.model,
            prompt=params.prompt,
            system_prompt=params.system_prompt,
            temperature=params.temperature,
        )
        return AigcTaskResult(
            kind=AigcResultKind.TEXT,
            text=text,
            text_digest=_text_digest(text),
        )

    async def _execute_image(
        self,
        task: AigcPipelineTaskAttempt,
    ) -> AigcTaskResult:
        params = AigcImageExecutionParams.model_validate(task.params)
        if params.model != AIGC_DEFAULT_IMAGE_MODEL:
            raise ValueError("image model is not enabled")
        source_url: str | None = None
        reference_urls: list[str] = []
        if task.type == AigcTaskType.IMAGE_TO_IMAGE:
            if not params.reference_asset_ids:
                raise ValueError("image_to_image requires reference_asset_ids")
            resolved_inputs = []
            for asset_id in params.reference_asset_ids:
                asset = self.repository.get_asset(asset_id)
                if (
                    asset.asset_role != AssetRole.PUBLIC
                    or asset.status != Status.SUCCEEDED
                    or asset.type
                    not in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
                ):
                    raise ValueError(
                        "reference asset is not an available public image"
                    )
                access_url = self.asset_storage.signed_access_url(asset)
                if not access_url:
                    raise ValueError("reference asset has no accessible object")
                resolved_inputs.append((asset, access_url))

            self.repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.INPUT,
                        slot="image",
                        ordinal=ordinal,
                        asset_id=asset.id,
                    )
                    for ordinal, (asset, _) in enumerate(resolved_inputs)
                ]
            )
            source_url = resolved_inputs[0][1]
            reference_urls = [
                access_url for _, access_url in resolved_inputs[1:]
            ]
        operation = (
            ImageGenerationOperation.IMAGE_TO_IMAGE
            if task.type == AigcTaskType.IMAGE_TO_IMAGE
            else ImageGenerationOperation.TEXT_TO_IMAGE
        )
        generated = await self.generation.generate_aigc_image(
            pipeline_id=task.pipeline_id,
            model=params.model,
            operation=operation,
            prompt=f"{params.prompt}\n画幅比例：{params.aspect_ratio}",
            size=params.size,
            output_format=params.format,
            source_image_url=source_url,
            reference_image_urls=reference_urls,
        )
        assets = await self.asset_storage.upload_assets_from_sources(
            self.repository,
            [
                StoredAssetInput(
                    type=generated.type,
                    tool_asset_role=ToolAssetRole.OUTPUT,
                    status=Status.SUCCEEDED,
                    source_url=generated.url,
                    mime_type=generated.mime_type,
                    metadata={
                        **generated.metadata,
                        "origin": "aigc",
                        "aigc_role": "output",
                        "pipeline_id": task.pipeline_id,
                        "run_id": task.run_id,
                        "task_id": task.task_id,
                        "node_id": task.node_id,
                        "aspect_ratio": params.aspect_ratio,
                        "executor_version": AIGC_IMAGE_EXECUTOR_VERSION,
                    },
                    validate_image_content=True,
                )
            ],
        )
        asset = assets[0]
        try:
            self.repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.OUTPUT,
                        slot="image",
                        ordinal=0,
                        asset_id=asset.id,
                    )
                ]
            )
        except Exception:
            self.asset_storage.delete_asset_objects(asset)
            self.repository.delete_tool_asset(asset.id)
            raise
        visible = self.asset_storage.with_access_url(asset)
        return AigcTaskResult(
            kind=AigcResultKind.ASSETS,
            assets=[
                AigcResultAsset(
                    asset_id=asset.id,
                    ordinal=0,
                    mime_type=asset.mime_type,
                    download_url=visible.url,
                    available=True,
                )
            ],
        )

    async def _execute_image_edit(
        self,
        task: AigcPipelineTaskAttempt,
    ) -> AigcTaskResult:
        params = AigcImageEditExecutionParams.model_validate(task.params)
        if params.model != AIGC_DEFAULT_IMAGE_MODEL:
            raise ValueError("image edit model is not enabled")
        if params.edit_layer is not None:
            return await self._execute_layer_image_edit(task, params)
        assert params.edit_image_asset_id is not None
        return await self._execute_plain_image_edit(task, params)

    async def _execute_plain_image_edit(
        self,
        task: AigcPipelineTaskAttempt,
        params: AigcImageEditExecutionParams,
    ) -> AigcTaskResult:
        assert params.edit_image_asset_id is not None
        source = self.repository.get_asset(params.edit_image_asset_id)
        if (
            source.asset_role != AssetRole.PUBLIC
            or source.status != Status.SUCCEEDED
            or source.type
            not in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
        ):
            raise ValueError("image edit source is not an available public image")
        source_url = self.asset_storage.signed_access_url(source)
        if not source_url:
            raise ValueError("image edit source has no accessible object")
        self.repository.add_aigc_task_assets(
            [
                AigcPipelineTaskAssetReference(
                    task_id=task.task_id,
                    direction=AigcAssetDirection.INPUT,
                    slot="edit_image",
                    ordinal=0,
                    asset_id=source.id,
                )
            ]
        )
        generated = await self.generation.generate_aigc_image(
            pipeline_id=task.pipeline_id,
            model=params.model,
            operation=ImageGenerationOperation.IMAGE_TO_IMAGE,
            prompt=params.prompt,
            size=params.size,
            output_format=params.format,
            source_image_url=source_url,
        )
        assets = await self.asset_storage.upload_assets_from_sources(
            self.repository,
            [
                StoredAssetInput(
                    type=generated.type,
                    tool_asset_role=ToolAssetRole.OUTPUT,
                    status=Status.SUCCEEDED,
                    source_url=generated.url,
                    mime_type=generated.mime_type,
                    metadata={
                        **generated.metadata,
                        "origin": "aigc",
                        "aigc_role": "output",
                        "pipeline_id": task.pipeline_id,
                        "run_id": task.run_id,
                        "task_id": task.task_id,
                        "node_id": task.node_id,
                        "operation": "image_edit",
                        "source_asset_id": source.id,
                        "executor_version": AIGC_IMAGE_EXECUTOR_VERSION,
                    },
                    validate_image_content=True,
                )
            ],
        )
        asset = assets[0]
        try:
            self.repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.OUTPUT,
                        slot="image",
                        ordinal=0,
                        asset_id=asset.id,
                    )
                ]
            )
        except Exception:
            self.asset_storage.delete_asset_objects(asset)
            self.repository.delete_tool_asset(asset.id)
            raise
        visible = self.asset_storage.with_access_url(asset)
        return AigcTaskResult(
            kind=AigcResultKind.ASSETS,
            assets=[
                AigcResultAsset(
                    asset_id=asset.id,
                    ordinal=0,
                    mime_type=asset.mime_type,
                    download_url=visible.url,
                    available=True,
                )
            ],
        )

    async def _execute_layer_image_edit(
        self,
        task: AigcPipelineTaskAttempt,
        params: AigcImageEditExecutionParams,
    ) -> AigcTaskResult:
        layer = params.edit_layer
        assert layer is not None
        source = self.repository.get_asset(layer.asset_id)
        if (
            source.asset_role != AssetRole.INTERNAL_LAYER
            or source.status != Status.SUCCEEDED
            or source.type != AssetType.GENERATED_IMAGE
            or source.mime_type != "image/png"
        ):
            raise ValueError("image layer source is not an available internal PNG")
        try:
            source_content = await self.asset_storage.read_asset_content(source)
        except Exception as exc:
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="AIGC image layer could not be downloaded",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc
        target_width = layer.bbox_absolute[2] - layer.bbox_absolute[0]
        target_height = layer.bbox_absolute[3] - layer.bbox_absolute[1]
        _source_layer_alpha(
            source_content,
            target_width=target_width,
            target_height=target_height,
        )
        source_url = self.asset_storage.signed_access_url(source)
        if not source_url:
            raise ValueError("image layer source has no accessible object")
        self.repository.add_aigc_task_assets(
            [
                AigcPipelineTaskAssetReference(
                    task_id=task.task_id,
                    direction=AigcAssetDirection.INPUT,
                    slot="edit_layer",
                    ordinal=0,
                    asset_id=source.id,
                )
            ]
        )
        try:
            generated = await self.generation.generate_aigc_image(
                pipeline_id=task.pipeline_id,
                model=params.model,
                operation=ImageGenerationOperation.IMAGE_TO_IMAGE,
                prompt=params.prompt,
                size=params.size,
                output_format=ImageOutputFormat.PNG,
                source_image_url=source_url,
            )
            downloaded = await self.asset_storage.downloader.fetch(
                generated.url,
                expected_mime_type=generated.mime_type,
            )
            normalized = _normalize_edited_layer_content(
                downloaded,
                source_content=source_content,
                target_width=target_width,
                target_height=target_height,
            )
            asset = _aigc_edited_layer_asset(
                asset_storage=self.asset_storage,
                task=task,
                layer=layer,
                source_asset_id=source.id,
                content=normalized.content,
                provider_metadata=generated.metadata,
            )
            await self._store_edited_layer_asset(task, asset, normalized.content)
        except (AigcGatewayError, ModelArkProviderError, ValueError):
            self.repository.remove_aigc_task_assets(task.task_id)
            raise
        except Exception as exc:
            self.repository.remove_aigc_task_assets(task.task_id)
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="Edited image layer could not be stored",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc
        return AigcTaskResult(
            kind=AigcResultKind.EDITED_LAYER,
            edited_layer=AigcEditedLayer(
                **{
                    **layer.model_dump(mode="python"),
                    "asset_id": asset.id,
                },
            ),
        )

    async def _store_edited_layer_asset(
        self,
        task: AigcPipelineTaskAttempt,
        asset: AssetCreate,
        content: bytes,
    ) -> None:
        if self.asset_storage.client is None or asset.object_key is None:
            raise ValueError("object storage is unavailable for layer assets")
        uploaded = False
        created = False
        try:
            await asyncio.to_thread(
                self.asset_storage.client.put_object,
                key=asset.object_key,
                content=content,
                content_type="image/png",
            )
            uploaded = True
            self.repository.create_assets([asset])
            created = True
            self.repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.OUTPUT,
                        slot="edited_layer",
                        ordinal=0,
                        asset_id=asset.id,
                    )
                ]
            )
        except Exception as exc:
            self.repository.remove_aigc_task_assets(
                task.task_id,
                direction=AigcAssetDirection.OUTPUT,
            )
            if created:
                try:
                    self.repository.delete_tool_asset(asset.id)
                except Exception:
                    pass
            if uploaded:
                await self.asset_storage.delete_object_keys([asset.object_key])
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="Edited image layer could not be stored",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc

    async def _execute_layer_decomposition(
        self,
        task: AigcPipelineTaskAttempt,
    ) -> AigcTaskResult:
        params = AigcLayerDecompositionExecutionParams.model_validate(task.params)
        if params.model != AIGC_DEFAULT_IMAGE_MODEL:
            raise ValueError("layer decomposition model is not enabled")

        source = self.repository.get_asset(params.source_asset_id)
        if (
            source.asset_role != AssetRole.PUBLIC
            or source.status != Status.SUCCEEDED
            or source.type
            not in {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
            or source.mime_type not in {"image/png", "image/jpeg"}
        ):
            raise ValueError(
                "layer decomposition source is not an available PNG or JPEG"
            )
        try:
            source_content = await self.asset_storage.read_asset_content(source)
        except Exception as exc:
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="AIGC layer source could not be downloaded",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc
        source_info = _inspect_decomposition_image(
            DownloadedAsset(source_content, source.mime_type),
            label="source",
            enforce_input_limits=True,
        )
        source_url = self.asset_storage.signed_access_url(source)
        if not source_url:
            raise ValueError("layer decomposition source has no accessible object")

        try:
            self.repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.INPUT,
                        slot="image",
                        ordinal=0,
                        asset_id=source.id,
                    )
                ]
            )
        except Exception as exc:
            self.repository.remove_aigc_task_assets(
                task.task_id,
                direction=AigcAssetDirection.INPUT,
            )
            raise AigcGatewayError(
                AigcTaskError(
                    code="input_recording_failed",
                    message="AIGC layer input could not be recorded",
                    stage="input_recording",
                ),
                retryable=True,
            ) from exc

        try:
            provider_result = await self.generation.decompose_aigc_image_layers(
                pipeline_id=task.pipeline_id,
                model=params.model,
                source_image_url=source_url,
                canvas_width=source_info.width,
                canvas_height=source_info.height,
                prompt=params.prompt.strip() or None,
                size=params.size,
                output_format=params.format,
            )
            # #region debug-point A:provider-result
            _debug_layer_asset_transfer(
                "A",
                "aigc_gateway.py:_execute_layer_decomposition",
                "Provider layer result metadata",
                {
                    "result_count": len(provider_result.layers),
                    "base_host": urlsplit(provider_result.base_url).hostname,
                    "layers": [
                        {
                            "index": layer.z_index,
                            "host": urlsplit(layer.url).hostname,
                        }
                        for layer in provider_result.layers
                    ],
                },
            )
            # #endregion
            return await self._persist_layer_decomposition(
                task=task,
                source_asset_id=source.id,
                source_info=source_info,
                result=provider_result,
                base_mime_type=(
                    "image/png"
                    if params.format == ImageOutputFormat.PNG
                    else "image/jpeg"
                ),
            )
        except (AigcGatewayError, ModelArkProviderError, ValueError) as exc:
            # #region debug-point E:transfer-exception
            _debug_layer_asset_transfer(
                "E",
                "aigc_gateway.py:_execute_layer_decomposition",
                "Layer asset transfer failed",
                {
                    "stage": "provider_or_persistence",
                    "index": None,
                    "exception_type": type(exc).__name__,
                    "message": re.sub(
                        r"https?://[^\s]+",
                        "[redacted-url]",
                        str(exc),
                    )[:200],
                },
            )
            # #endregion
            self.repository.remove_aigc_task_assets(task.task_id)
            raise
        except Exception as exc:
            # #region debug-point E:unexpected-transfer-exception
            _debug_layer_asset_transfer(
                "E",
                "aigc_gateway.py:_execute_layer_decomposition",
                "Unexpected layer asset transfer failure",
                {
                    "stage": "provider_or_persistence",
                    "index": None,
                    "exception_type": type(exc).__name__,
                    "message": re.sub(
                        r"https?://[^\s]+",
                        "[redacted-url]",
                        str(exc),
                    )[:200],
                },
            )
            # #endregion
            self.repository.remove_aigc_task_assets(task.task_id)
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="AIGC layer assets could not be transferred",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc

    async def _persist_layer_decomposition(
        self,
        *,
        task: AigcPipelineTaskAttempt,
        source_asset_id: str,
        source_info: "_DecompositionImageInfo",
        result: LayerDecompositionResult,
        base_mime_type: str,
    ) -> AigcTaskResult:
        _validate_decomposition_result(result)
        base_download = await self.asset_storage.downloader.fetch(
            result.base_url,
            expected_mime_type=base_mime_type,
        )
        # #region debug-point A:download-result
        _debug_layer_asset_transfer(
            "A",
            "aigc_gateway.py:_persist_layer_decomposition",
            "Layer asset download result",
            {
                "index": 0,
                "host": urlsplit(result.base_url).hostname,
                "status": "ok",
                "size": len(base_download.content),
                "mime": base_download.mime_type,
            },
        )
        # #endregion
        base_info = _inspect_decomposition_image(base_download, label="base")
        # #region debug-point B:decode-alpha-validation
        _debug_layer_asset_transfer(
            "B",
            "aigc_gateway.py:_persist_layer_decomposition",
            "Layer asset decode and alpha validation",
            {
                "index": 0,
                "status": "ok",
                "mime": base_download.mime_type,
                "width": base_info.width,
                "height": base_info.height,
                "has_alpha": base_info.has_alpha,
            },
        )
        # #endregion
        if (base_info.width, base_info.height) != (
            source_info.width,
            source_info.height,
        ):
            raise ValueError(
                "layer decomposition base dimensions do not match the source"
            )

        downloads: list[tuple[DecomposedImageLayer, DownloadedAsset]] = []
        for layer in result.layers:
            downloaded = await self.asset_storage.downloader.fetch(
                layer.url,
                expected_mime_type="image/png",
            )
            # #region debug-point A:download-result
            _debug_layer_asset_transfer(
                "A",
                "aigc_gateway.py:_persist_layer_decomposition",
                "Layer asset download result",
                {
                    "index": layer.z_index,
                    "host": urlsplit(layer.url).hostname,
                    "status": "ok",
                    "size": len(downloaded.content),
                    "mime": downloaded.mime_type,
                },
            )
            # #endregion
            info = _inspect_decomposition_image(
                downloaded,
                label=f"layer {layer.z_index}",
                require_alpha=True,
            )
            # #region debug-point B:decode-alpha-validation
            _debug_layer_asset_transfer(
                "B",
                "aigc_gateway.py:_persist_layer_decomposition",
                "Layer asset decode and alpha validation",
                {
                    "index": layer.z_index,
                    "status": "ok",
                    "mime": downloaded.mime_type,
                    "width": info.width,
                    "height": info.height,
                    "has_alpha": info.has_alpha,
                },
            )
            # #endregion
            x1, y1, x2, y2 = layer.bbox_absolute
            expected_size = (x2 - x1, y2 - y1)
            if (info.width, info.height) != expected_size:
                downloaded = normalize_layer_image_content(
                    downloaded,
                    target_width=expected_size[0],
                    target_height=expected_size[1],
                )
                _inspect_decomposition_image(
                    downloaded,
                    label=f"layer {layer.z_index}",
                    require_alpha=True,
                )
            downloads.append((layer, downloaded))

        layer_set_id = str(uuid4())
        prepared: list[tuple[AssetCreate, bytes]] = []
        base_asset = _aigc_internal_layer_asset(
            asset_storage=self.asset_storage,
            task=task,
            layer_set_id=layer_set_id,
            source_asset_id=source_asset_id,
            z_index=0,
            mime_type=base_download.mime_type,
            content=base_download.content,
        )
        prepared.append((base_asset, base_download.content))

        layer_models: list[AigcLayer] = []
        for raw_layer, downloaded in downloads:
            layer_asset = _aigc_internal_layer_asset(
                asset_storage=self.asset_storage,
                task=task,
                layer_set_id=layer_set_id,
                source_asset_id=source_asset_id,
                z_index=raw_layer.z_index,
                mime_type="image/png",
                content=downloaded.content,
            )
            prepared.append((layer_asset, downloaded.content))
            x1, y1, _, _ = raw_layer.bbox_absolute
            layer_models.append(
                AigcLayer(
                    id=str(uuid4()),
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

        layer_set = AigcLayerSet(
            id=layer_set_id,
            parent_layer_set_id=None,
            source_asset_id=source_asset_id,
            base_asset_id=base_asset.id,
            canvas_width=source_info.width,
            canvas_height=source_info.height,
            version=0,
            digest=_layer_set_digest(
                source_asset_id=source_asset_id,
                base_asset_id=base_asset.id,
                canvas_width=source_info.width,
                canvas_height=source_info.height,
                layers=layer_models,
            ),
            layers=tuple(layer_models),
        )
        await self._store_layer_assets(task, prepared)
        return AigcTaskResult(
            kind=AigcResultKind.LAYER_SET,
            layer_set=layer_set,
        )

    async def _store_layer_assets(
        self,
        task: AigcPipelineTaskAttempt,
        prepared: list[tuple[AssetCreate, bytes]],
    ) -> None:
        if self.asset_storage.client is None:
            raise ValueError("object storage is unavailable for layer assets")
        uploaded_keys: list[str] = []
        created_asset_ids: list[str] = []
        debug_stage = "upload"
        debug_index: int | None = None
        try:
            for debug_index, (asset, content) in enumerate(prepared):
                assert asset.object_key is not None
                await asyncio.to_thread(
                    self.asset_storage.client.put_object,
                    key=asset.object_key,
                    content=content,
                    content_type=asset.mime_type,
                )
                uploaded_keys.append(asset.object_key)
                # #region debug-point C:storage-upload
                _debug_layer_asset_transfer(
                    "C",
                    "aigc_gateway.py:_store_layer_assets",
                    "Layer asset storage upload",
                    {
                        "index": debug_index,
                        "status": "ok",
                        "size": len(content),
                        "mime": asset.mime_type,
                    },
                )
                # #endregion
            debug_stage = "asset_records"
            debug_index = None
            created = self.repository.create_assets(
                [asset for asset, _ in prepared]
            )
            created_asset_ids = [asset.id for asset in created]
            debug_stage = "task_relationships"
            self.repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.OUTPUT,
                        slot="base" if ordinal == 0 else "layers",
                        ordinal=0 if ordinal == 0 else ordinal - 1,
                        asset_id=asset.id,
                    )
                    for ordinal, asset in enumerate(created)
                ]
            )
            # #region debug-point D:task-relationships
            _debug_layer_asset_transfer(
                "D",
                "aigc_gateway.py:_store_layer_assets",
                "Layer task relationships persisted",
                {
                    "status": "ok",
                    "asset_count": len(created),
                    "relationship_count": len(created),
                },
            )
            # #endregion
        except Exception as exc:
            # #region debug-point E:storage-exception
            _debug_layer_asset_transfer(
                "E",
                "aigc_gateway.py:_store_layer_assets",
                "Layer asset storage failed",
                {
                    "stage": debug_stage,
                    "index": debug_index,
                    "exception_type": type(exc).__name__,
                    "message": re.sub(
                        r"https?://[^\s]+",
                        "[redacted-url]",
                        str(exc),
                    )[:200],
                },
            )
            # #endregion
            self.repository.remove_aigc_task_assets(
                task.task_id,
                direction=AigcAssetDirection.OUTPUT,
            )
            for asset_id in reversed(created_asset_ids):
                try:
                    self.repository.delete_tool_asset(asset_id)
                except Exception:
                    pass
            await self.asset_storage.delete_object_keys(uploaded_keys)
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="AIGC layer assets could not be stored",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc

    async def _execute_layer_composite(
        self,
        task: AigcPipelineTaskAttempt,
    ) -> AigcTaskResult:
        params = AigcLayerCompositeExecutionParams.model_validate(task.params)
        layer_set = params.input_layer_set
        replacement = params.replacement
        source_layer = _validate_layer_composite_source(layer_set, replacement)

        base_asset = self.repository.get_asset(layer_set.base_asset_id)
        layer_assets = {
            layer.asset_id: self.repository.get_asset(layer.asset_id)
            for layer in layer_set.layers
        }
        replacement_asset = self.repository.get_asset(replacement.asset_id)
        _validate_composite_asset(base_asset, base=True)
        for asset in layer_assets.values():
            _validate_composite_asset(asset)
        _validate_composite_asset(replacement_asset)

        try:
            base_content = await self.asset_storage.read_asset_content(base_asset)
            layer_contents = {
                asset_id: await self.asset_storage.read_asset_content(asset)
                for asset_id, asset in layer_assets.items()
            }
            replacement_content = await self.asset_storage.read_asset_content(
                replacement_asset
            )
        except Exception as exc:
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="AIGC layer assets could not be downloaded",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc

        input_references = [
            AigcPipelineTaskAssetReference(
                task_id=task.task_id,
                direction=AigcAssetDirection.INPUT,
                slot="base",
                ordinal=0,
                asset_id=base_asset.id,
            ),
            *[
                AigcPipelineTaskAssetReference(
                    task_id=task.task_id,
                    direction=AigcAssetDirection.INPUT,
                    slot="layers",
                    ordinal=ordinal,
                    asset_id=layer.asset_id,
                )
                for ordinal, layer in enumerate(
                    sorted(layer_set.layers, key=lambda item: item.z_index)
                )
            ],
            AigcPipelineTaskAssetReference(
                task_id=task.task_id,
                direction=AigcAssetDirection.INPUT,
                slot="replacement",
                ordinal=0,
                asset_id=replacement_asset.id,
            ),
        ]
        try:
            self.repository.add_aigc_task_assets(input_references)
        except Exception as exc:
            self.repository.remove_aigc_task_assets(task.task_id)
            raise AigcGatewayError(
                AigcTaskError(
                    code="input_recording_failed",
                    message="AIGC layer composite inputs could not be recorded",
                    stage="input_recording",
                ),
                retryable=True,
            ) from exc

        derived_layers = [
            layer.model_copy(
                update={"asset_id": replacement.asset_id},
                deep=True,
            )
            if layer.id == source_layer.id
            else layer
            for layer in layer_set.layers
        ]
        derived = AigcLayerSet(
            id=str(uuid4()),
            parent_layer_set_id=layer_set.id,
            source_asset_id=layer_set.source_asset_id,
            base_asset_id=layer_set.base_asset_id,
            canvas_width=layer_set.canvas_width,
            canvas_height=layer_set.canvas_height,
            version=layer_set.version + 1,
            digest=_layer_set_digest(
                source_asset_id=layer_set.source_asset_id,
                base_asset_id=layer_set.base_asset_id,
                canvas_width=layer_set.canvas_width,
                canvas_height=layer_set.canvas_height,
                layers=derived_layers,
            ),
            layers=tuple(derived_layers),
        )
        layer_contents[replacement.asset_id] = replacement_content

        created_asset_id: str | None = None
        uploaded_key: str | None = None
        try:
            composition = ImageLayerCompositionService().compose_pixels(
                canvas_width=derived.canvas_width,
                canvas_height=derived.canvas_height,
                layers=derived.layers,
                base_content=base_content,
                layer_contents=layer_contents,
            )
            output_asset = _aigc_layer_composite_asset(
                asset_storage=self.asset_storage,
                task=task,
                layer_set=derived,
                content=composition.content,
            )
            if self.asset_storage.client is None or output_asset.object_key is None:
                raise ValueError("object storage is unavailable for layer composition")
            await asyncio.to_thread(
                self.asset_storage.client.put_object,
                key=output_asset.object_key,
                content=composition.content,
                content_type=composition.mime_type,
            )
            uploaded_key = output_asset.object_key
            created = self.repository.create_asset(output_asset)
            created_asset_id = created.id
            self.repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.OUTPUT,
                        slot="base",
                        ordinal=0,
                        asset_id=derived.base_asset_id,
                    ),
                    *[
                        AigcPipelineTaskAssetReference(
                            task_id=task.task_id,
                            direction=AigcAssetDirection.OUTPUT,
                            slot="layers",
                            ordinal=ordinal,
                            asset_id=layer.asset_id,
                        )
                        for ordinal, layer in enumerate(
                            sorted(derived.layers, key=lambda item: item.z_index)
                        )
                    ],
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.OUTPUT,
                        slot="image",
                        ordinal=0,
                        asset_id=created.id,
                    ),
                ]
            )
        except Exception as exc:
            self.repository.remove_aigc_task_assets(task.task_id)
            if created_asset_id is not None:
                try:
                    self.repository.delete_tool_asset(created_asset_id)
                except Exception:
                    pass
            if uploaded_key is not None:
                await self.asset_storage.delete_object_keys([uploaded_key])
            if isinstance(exc, ValueError):
                raise
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="AIGC layer composite output could not be stored",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc

        visible = self.asset_storage.with_access_url(created)
        return AigcTaskResult(
            kind=AigcResultKind.LAYER_COMPOSITE,
            layer_set=derived,
            assets=[
                AigcResultAsset(
                    asset_id=created.id,
                    ordinal=0,
                    mime_type=created.mime_type,
                    download_url=visible.url,
                    available=True,
                )
            ],
        )

    async def _execute_video(
        self,
        task: AigcPipelineTaskAttempt,
    ) -> AigcTaskResult:
        params = AigcVideoExecutionParams.model_validate(task.params)
        input_specs = [
            (
                "first_frame",
                [params.first_frame_asset_id] if params.first_frame_asset_id else [],
                {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE},
                "image",
            ),
            (
                "last_frame",
                [params.last_frame_asset_id] if params.last_frame_asset_id else [],
                {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE},
                "image",
            ),
            (
                "reference_images",
                params.reference_image_asset_ids,
                {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE},
                "image",
            ),
            (
                "reference_videos",
                params.reference_video_asset_ids,
                {
                    AssetType.UPLOADED_VIDEO,
                    AssetType.STORYBOARD_VIDEO,
                    AssetType.FINAL_VIDEO,
                },
                "video",
            ),
            (
                "reference_audios",
                params.reference_audio_asset_ids,
                {AssetType.UPLOADED_AUDIO},
                "audio",
            ),
        ]
        urls_by_slot: dict[str, list[str]] = {}
        inspections_by_slot: dict[str, list[MediaInspection]] = {}
        references: list[AigcPipelineTaskAssetReference] = []
        for slot, asset_ids, allowed_types, mime_family in input_specs:
            resolved_urls: list[str] = []
            slot_inspections: list[MediaInspection] = []
            for ordinal, asset_id in enumerate(asset_ids):
                asset = self.repository.get_asset(asset_id)
                if (
                    asset.asset_role != AssetRole.PUBLIC
                    or asset.status != Status.SUCCEEDED
                    or asset.type not in allowed_types
                    or not asset.mime_type
                    or asset.mime_type.split("/", 1)[0].lower() != mime_family
                ):
                    raise ValueError(
                        f"{slot} asset is not an available public {mime_family}"
                    )
                access_url = self.asset_storage.signed_access_url(asset)
                if not access_url:
                    raise ValueError(f"{slot} asset has no accessible object")
                inspection = await self._ensure_media_inspection(
                    asset,
                    ReferenceAssetKind(mime_family),
                )
                if inspection is not None:
                    slot_inspections.append(inspection)
                resolved_urls.append(access_url)
                references.append(
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.INPUT,
                        slot=slot,
                        ordinal=ordinal,
                        asset_id=asset.id,
                    )
                )
            urls_by_slot[slot] = resolved_urls
            inspections_by_slot[slot] = slot_inspections

        if self.media_inspector is not None:
            validate_seedance_media_inputs(
                model=params.model,
                task_type=params.task_type,
                videos=inspections_by_slot["reference_videos"],
                audios=inspections_by_slot["reference_audios"],
            )

        request = SeedanceVideoGenerationRequest(
            model=params.model,
            generation_mode=params.generation_mode,
            task_type=params.task_type,
            prompt=params.prompt,
            first_frame_url=_first_or_none(urls_by_slot["first_frame"]),
            last_frame_url=_first_or_none(urls_by_slot["last_frame"]),
            reference_image_urls=urls_by_slot["reference_images"],
            reference_video_urls=urls_by_slot["reference_videos"],
            reference_audio_urls=urls_by_slot["reference_audios"],
            duration_seconds=params.duration_seconds,
            resolution=params.resolution,
            aspect_ratio=params.aspect_ratio,
            generate_audio=params.generate_audio,
        )
        if references:
            try:
                self.repository.add_aigc_task_assets(references)
            except Exception as exc:
                raise AigcGatewayError(
                    AigcTaskError(
                        code="input_recording_failed",
                        message="AIGC input references could not be recorded",
                        stage="input_recording",
                    ),
                    retryable=True,
                ) from exc

        generated = await self.generation.generate_seedance_video(request)
        if (
            generated.type
            not in {
                AssetType.UPLOADED_VIDEO,
                AssetType.STORYBOARD_VIDEO,
                AssetType.FINAL_VIDEO,
            }
            or not generated.mime_type.lower().startswith("video/")
        ):
            raise ValueError("Seedance output is not a video")
        try:
            assets = await self.asset_storage.upload_assets_from_sources(
                self.repository,
                [
                    StoredAssetInput(
                        type=AssetType.STORYBOARD_VIDEO,
                        tool_asset_role=ToolAssetRole.OUTPUT,
                        status=Status.SUCCEEDED,
                        stage=generated.stage,
                        source_url=generated.url,
                        mime_type=generated.mime_type,
                        filename="generated-aigc-video.mp4",
                        metadata={
                            **_safe_video_metadata(generated.metadata),
                            "origin": "aigc",
                            "aigc_role": "output",
                            "pipeline_id": task.pipeline_id,
                            "run_id": task.run_id,
                            "task_id": task.task_id,
                            "node_id": task.node_id,
                            "model": params.model,
                            "generation_mode": params.generation_mode,
                            "task_type": params.task_type,
                            "resolution": params.resolution,
                            "aspect_ratio": params.aspect_ratio,
                            "duration_seconds": params.duration_seconds,
                            "generate_audio": params.generate_audio,
                            "prompt_sha256": hashlib.sha256(
                                params.prompt.encode("utf-8")
                            ).hexdigest(),
                            "executor_version": AIGC_VIDEO_EXECUTOR_VERSION,
                        },
                    )
                ],
            )
        except ValueError:
            raise
        except Exception as exc:
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="Generated video could not be stored",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc
        asset = assets[0]
        try:
            self.repository.add_aigc_task_assets(
                [
                    AigcPipelineTaskAssetReference(
                        task_id=task.task_id,
                        direction=AigcAssetDirection.OUTPUT,
                        slot="video",
                        ordinal=0,
                        asset_id=asset.id,
                    )
                ]
            )
        except Exception as exc:
            self.asset_storage.delete_asset_objects(asset)
            self.repository.delete_tool_asset(asset.id)
            raise AigcGatewayError(
                AigcTaskError(
                    code="asset_transfer_failed",
                    message="Generated video could not be recorded",
                    stage="asset_transfer",
                ),
                retryable=True,
            ) from exc
        visible = self.asset_storage.with_access_url(asset)
        return AigcTaskResult(
            kind=AigcResultKind.ASSETS,
            assets=[
                AigcResultAsset(
                    asset_id=asset.id,
                    ordinal=0,
                    mime_type=asset.mime_type,
                    download_url=visible.url,
                    available=True,
                )
            ],
        )

    async def _ensure_media_inspection(
        self,
        asset,
        kind: ReferenceAssetKind,
    ) -> MediaInspection | None:
        if self.media_inspector is None:
            return None
        existing = MediaInspection.from_metadata(
            kind,
            asset.mime_type,
            asset.metadata,
        )
        if existing is not None:
            return existing
        content = await self.asset_storage.read_asset_content(asset)
        filename = asset.metadata.get("name")
        inspection = await self.media_inspector.inspect(
            kind,
            content,
            filename=filename if isinstance(filename, str) else None,
            mime_type=asset.mime_type,
        )
        self.repository.update_asset(
            asset.id,
            mime_type=inspection.mime_type,
            size_bytes=len(content),
            metadata={**asset.metadata, **inspection.metadata()},
        )
        return inspection


@dataclass(frozen=True)
class _DecompositionImageInfo:
    width: int
    height: int
    mime_type: str
    has_alpha: bool


def _validate_layer_composite_source(
    layer_set: AigcLayerSet,
    replacement: AigcEditedLayer,
) -> AigcLayer:
    if (
        replacement.layer_set_id != layer_set.id
        or replacement.layer_set_version != layer_set.version
        or replacement.layer_set_digest != layer_set.digest
    ):
        raise ValueError("edited layer source does not match the layer set")
    source_layer = next(
        (layer for layer in layer_set.layers if layer.id == replacement.layer_id),
        None,
    )
    if source_layer is None:
        raise ValueError("edited layer does not exist in the layer set")
    source_size = (
        source_layer.bbox_absolute[2] - source_layer.bbox_absolute[0],
        source_layer.bbox_absolute[3] - source_layer.bbox_absolute[1],
    )
    replacement_size = (
        replacement.bbox_absolute[2] - replacement.bbox_absolute[0],
        replacement.bbox_absolute[3] - replacement.bbox_absolute[1],
    )
    if source_size != replacement_size:
        raise ValueError("edited layer pixel dimensions do not match")
    return source_layer


def _validate_composite_asset(asset: Asset, *, base: bool = False) -> None:
    allowed_roles = (
        {AssetRole.INTERNAL_BASE, AssetRole.INTERNAL_LAYER}
        if base
        else {AssetRole.INTERNAL_LAYER}
    )
    allowed_mime_types = {"image/png", "image/jpeg"} if base else {"image/png"}
    if (
        asset.asset_role not in allowed_roles
        or asset.status != Status.SUCCEEDED
        or asset.type != AssetType.GENERATED_IMAGE
        or asset.mime_type not in allowed_mime_types
        or not asset.object_key
    ):
        raise ValueError("layer composite asset is invalid or unavailable")


def _aigc_layer_composite_asset(
    *,
    asset_storage: AssetStorageService,
    task: AigcPipelineTaskAttempt,
    layer_set: AigcLayerSet,
    content: bytes,
) -> AssetCreate:
    asset = AssetCreate(
        tool_asset_role=ToolAssetRole.OUTPUT,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.PUBLIC,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        mime_type="image/png",
        size_bytes=len(content),
        source_task_id=None,
        metadata={
            "origin": "aigc",
            "aigc_role": "layer_composite",
            "operation": "layer_composite",
            "pipeline_id": task.pipeline_id,
            "run_id": task.run_id,
            "task_id": task.task_id,
            "node_id": task.node_id,
            "layer_set_id": layer_set.id,
            "parent_layer_set_id": layer_set.parent_layer_set_id,
            "layer_set_version": layer_set.version,
            "layer_set_digest": layer_set.digest,
            "width": layer_set.canvas_width,
            "height": layer_set.canvas_height,
            "size": f"{layer_set.canvas_width}x{layer_set.canvas_height}",
            "format": "png",
            "model": f"Pillow {Image.__version__}",
            "executor_version": AIGC_LAYER_EXECUTOR_VERSION,
            "storage_provider": "tos",
        },
    )
    object_key = asset_storage.generate_object_key(
        asset_id=asset.id,
        asset_type=asset.type,
        stage=asset.stage,
        mime_type=asset.mime_type,
    )
    return asset.model_copy(
        update={
            "object_key": object_key,
            "url": asset_storage.url_for_key(object_key),
        },
        deep=True,
    )


def _source_layer_alpha(
    content: bytes,
    *,
    target_width: int,
    target_height: int,
) -> Image.Image:
    if target_width <= 0 or target_height <= 0:
        raise ValueError("image layer bbox dimensions are invalid")
    try:
        with Image.open(io.BytesIO(content)) as source:
            source.load()
            if source.format != "PNG":
                raise ValueError("image layer source must be PNG")
            if "A" not in source.getbands() and "transparency" not in source.info:
                raise ValueError("image layer source must contain alpha")
            if source.size != (target_width, target_height):
                raise ValueError("image layer source dimensions do not match its bbox")
            return source.convert("RGBA").getchannel("A")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("image layer source cannot be decoded") from exc


def _normalize_edited_layer_content(
    downloaded: DownloadedAsset,
    *,
    source_content: bytes,
    target_width: int,
    target_height: int,
) -> DownloadedAsset:
    source_alpha = _source_layer_alpha(
        source_content,
        target_width=target_width,
        target_height=target_height,
    )
    try:
        with Image.open(io.BytesIO(downloaded.content)) as generated:
            generated.load()
            if generated.format not in {"PNG", "JPEG"}:
                raise ValueError("edited image must be PNG or JPEG")
            has_alpha = (
                "A" in generated.getbands() or "transparency" in generated.info
            )
            resized = generated.convert("RGBA").resize(
                (target_width, target_height),
                Image.Resampling.LANCZOS,
            )
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("edited image cannot be decoded") from exc

    if has_alpha:
        resized.putalpha(
            ImageChops.multiply(resized.getchannel("A"), source_alpha)
        )
    else:
        resized.putalpha(source_alpha)
    output = io.BytesIO()
    resized.save(output, format="PNG", optimize=True)
    normalized = DownloadedAsset(output.getvalue(), "image/png")
    info = _inspect_decomposition_image(
        normalized,
        label="edited layer",
        require_alpha=True,
    )
    if (info.width, info.height) != (target_width, target_height):
        raise ValueError("edited image could not be normalized to its bbox")
    return normalized


def _aigc_edited_layer_asset(
    *,
    asset_storage: AssetStorageService,
    task: AigcPipelineTaskAttempt,
    layer: AigcImageLayer,
    source_asset_id: str,
    content: bytes,
    provider_metadata: dict[str, str | int | float | bool | None],
) -> AssetCreate:
    asset = AssetCreate(
        tool_asset_role=ToolAssetRole.OUTPUT,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.INTERNAL_LAYER,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        mime_type="image/png",
        size_bytes=len(content),
        source_task_id=None,
        metadata={
            **provider_metadata,
            "origin": "aigc",
            "aigc_role": "edited_layer",
            "pipeline_id": task.pipeline_id,
            "run_id": task.run_id,
            "task_id": task.task_id,
            "node_id": task.node_id,
            "layer_set_id": layer.layer_set_id,
            "layer_set_version": layer.layer_set_version,
            "layer_set_digest": layer.layer_set_digest,
            "layer_id": layer.layer_id,
            "source_asset_id": source_asset_id,
            "executor_version": AIGC_IMAGE_EXECUTOR_VERSION,
            "storage_provider": "tos",
        },
    )
    object_key = asset_storage.generate_object_key(
        asset_id=asset.id,
        asset_type=asset.type,
        stage=asset.stage,
        mime_type="image/png",
    )
    return asset.model_copy(
        update={
            "object_key": object_key,
            "url": asset_storage.url_for_key(object_key),
        },
        deep=True,
    )


def _inspect_decomposition_image(
    downloaded: DownloadedAsset,
    *,
    label: str,
    require_alpha: bool = False,
    enforce_input_limits: bool = False,
) -> _DecompositionImageInfo:
    if not downloaded.content or len(downloaded.content) >= MAX_LAYER_IMAGE_BYTES:
        raise ValueError(f"{label} image must be smaller than 30 MB")
    if downloaded.mime_type not in {"image/png", "image/jpeg"}:
        raise ValueError(f"{label} image must be PNG or JPEG")
    try:
        with Image.open(io.BytesIO(downloaded.content)) as image:
            image.load()
            width, height = image.size
            actual_format = (image.format or "").upper()
            has_alpha = "A" in image.getbands() or "transparency" in image.info
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError(f"{label} image cannot be decoded") from exc
    expected_format = "PNG" if downloaded.mime_type == "image/png" else "JPEG"
    if actual_format != expected_format:
        raise ValueError(f"{label} image content does not match its MIME type")
    if width <= 0 or height <= 0:
        raise ValueError(f"{label} image dimensions are invalid")
    if enforce_input_limits:
        pixels = width * height
        if not MIN_LAYER_IMAGE_PIXELS <= pixels <= MAX_LAYER_IMAGE_PIXELS:
            raise ValueError(
                "source image pixel count is outside the supported range"
            )
        ratio = width / height
        if not 1 / 16 <= ratio <= 16:
            raise ValueError(
                "source image aspect ratio is outside the supported range"
            )
    if require_alpha and (
        downloaded.mime_type != "image/png" or not has_alpha
    ):
        raise ValueError("decomposed layers must be PNG images with alpha")
    return _DecompositionImageInfo(
        width=width,
        height=height,
        mime_type=downloaded.mime_type,
        has_alpha=has_alpha,
    )


def _validate_decomposition_result(result: LayerDecompositionResult) -> None:
    if not 1 <= len(result.layers) <= 16:
        raise ValueError("layer decomposition requires between 1 and 16 layers")
    indexes = [layer.z_index for layer in result.layers]
    if indexes != list(range(1, len(result.layers) + 1)):
        raise ValueError(
            "layer decomposition layers must have continuous z_index values"
        )


def _aigc_internal_layer_asset(
    *,
    asset_storage: AssetStorageService,
    task: AigcPipelineTaskAttempt,
    layer_set_id: str,
    source_asset_id: str,
    z_index: int,
    mime_type: str,
    content: bytes,
) -> AssetCreate:
    asset = AssetCreate(
        tool_asset_role=ToolAssetRole.OUTPUT,
        type=AssetType.GENERATED_IMAGE,
        asset_role=AssetRole.INTERNAL_LAYER,
        status=Status.SUCCEEDED,
        stage=Stage.IMAGE,
        mime_type=mime_type,
        size_bytes=len(content),
        source_task_id=None,
        metadata={
            "origin": "aigc",
            "aigc_role": "layer_base" if z_index == 0 else "layer",
            "pipeline_id": task.pipeline_id,
            "run_id": task.run_id,
            "task_id": task.task_id,
            "node_id": task.node_id,
            "layer_set_id": layer_set_id,
            "source_asset_id": source_asset_id,
            "z_index": z_index,
            "executor_version": AIGC_IMAGE_EXECUTOR_VERSION,
            "storage_provider": "tos",
        },
    )
    object_key = asset_storage.generate_object_key(
        asset_id=asset.id,
        asset_type=asset.type,
        stage=asset.stage,
        mime_type=mime_type,
    )
    return asset.model_copy(
        update={
            "object_key": object_key,
            "url": asset_storage.url_for_key(object_key),
        },
        deep=True,
    )


def _layer_set_digest(
    *,
    source_asset_id: str,
    base_asset_id: str,
    canvas_width: int,
    canvas_height: int,
    layers: list[AigcLayer],
) -> str:
    payload = {
        "source_asset_id": source_asset_id,
        "base_asset_id": base_asset_id,
        "canvas_width": canvas_width,
        "canvas_height": canvas_height,
        "layers": [
            layer.model_dump(mode="json")
            for layer in sorted(layers, key=lambda item: item.z_index)
        ],
    }
    return hashlib.sha256(
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()


def _text_digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _first_or_none(values: list[str]) -> str | None:
    return values[0] if values else None


def _is_retryable_provider_code(code: str) -> bool:
    normalized = code.replace("-", "_").casefold()
    return (
        normalized
        in {
            "429",
            "rate_limit",
            "ratelimit",
            "internal_error",
            "timeout",
            "tasktimeout",
            "service_unavailable",
            "serviceunavailable",
        }
        or normalized.startswith("5")
    )


def _normalized_provider_error_code(code: str) -> str:
    if code.replace("-", "_").casefold() == "tasktimeout":
        return "timeout"
    return code


def _safe_video_metadata(
    metadata: dict[str, str | int | float | bool | None],
) -> dict[str, str | int | float | bool | None]:
    allowed = {
        "provider",
        "provider_task_id",
        "provider_request_id",
        "model",
        "generation_mode",
        "duration_seconds",
        "aspect_ratio",
        "resolution",
        "generate_audio",
        "uses_first_frame",
        "uses_last_frame",
        "reference_image_count",
        "reference_video_count",
        "reference_audio_count",
        "status",
    }
    return {key: value for key, value in metadata.items() if key in allowed}
