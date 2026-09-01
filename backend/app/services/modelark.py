from __future__ import annotations

import asyncio
import hashlib
import json
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from time import monotonic
from typing import Any, Literal, Optional, Protocol, Union

import httpx
from pydantic import Field, ValidationError, field_validator, model_validator

from ..core.config import Settings, get_settings
from ..schemas import (
    AssetType,
    Brief,
    CharacterAssetIterationOperation,
    ImageGenerationOperation,
    ImageGenerationSize,
    ImagePromptSuggestion,
    ImageLayerDecompositionSize,
    ImageOutputFormat,
    Stage,
    Status,
    StoryboardShotCreate,
    TargetLanguage,
    validate_visible_selling_copy,
)
from ..schemas.common import SchemaModel
from ..schemas.seedance import (
    SEEDANCE_DEFAULT_TASK_TYPE,
    SeedanceAspectRatio,
    SeedanceGenerationMode,
    SeedanceModel,
    SeedanceResolution,
    SeedanceTaskType,
    validate_seedance_duration,
    validate_seedance_reference_counts,
    validate_seedance_resolution,
)
from ..schemas.tool_task import (
    ToolVideoAspectRatio,
    ToolVideoModel,
    ToolVideoResolution,
    validate_tool_video_duration,
    validate_tool_video_resolution,
)
from ..video_prompt import MAX_VIDEO_PROMPT_LENGTH
from .text_streaming import IncrementalJsonStringExtractor


TEXT_GENERATION_STAGES = {Stage.STORY, Stage.SCRIPT, Stage.STORYBOARD}
SEED_THINKING_DISABLED = {"type": "disabled"}
SEEDREAM_5_PRO_MODEL = "doubao-seedream-5-0-pro-260628"
_SAFE_PROVIDER_VALUE = re.compile(r"^[A-Za-z0-9._:/-]{1,200}$")
_REQUEST_ID_PATTERN = re.compile(
    r"(?:request[\s_-]*id)[:=\s]+([A-Za-z0-9._:/-]{6,200})",
    flags=re.IGNORECASE,
)


def _safe_provider_value(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if _SAFE_PROVIDER_VALUE.fullmatch(text) else None


def _provider_field(source: object, name: str) -> str | None:
    if source is None:
        return None
    if isinstance(source, dict):
        return _safe_provider_value(source.get(name))
    return _safe_provider_value(getattr(source, name, None))


def _provider_request_id(source: object) -> str | None:
    direct = _provider_field(source, "request_id")
    if direct:
        return direct
    message = (
        source.get("message")
        if isinstance(source, dict)
        else getattr(source, "message", None)
    )
    if not isinstance(message, str):
        return None
    match = _REQUEST_ID_PATTERN.search(message)
    return _safe_provider_value(match.group(1)) if match else None


def _provider_error_from_exception(
    exc: Exception,
    *,
    phase: str,
    provider_task_id: str | None = None,
) -> "ModelArkProviderError":
    body = getattr(exc, "body", None)
    error = body.get("error") if isinstance(body, dict) else None
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None)
    request_id = (
        _provider_field(exc, "request_id")
        or _provider_request_id(error)
        or _provider_request_id(exc)
    )
    if request_id is None and headers is not None:
        for name in ("x-request-id", "x-tt-logid", "x-tt-trace-id"):
            request_id = _safe_provider_value(headers.get(name))
            if request_id:
                break
    return ModelArkProviderError(
        "video generation failed",
        phase=phase,
        provider_code=(
            _provider_field(error, "code")
            or _provider_field(exc, "code")
            or type(exc).__name__
        ),
        request_id=request_id,
        provider_task_id=provider_task_id,
    )


def _chat_stream_text(chunk: object) -> str:
    choices = (
        chunk.get("choices")
        if isinstance(chunk, dict)
        else getattr(chunk, "choices", None)
    )
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0]
    delta = (
        first.get("delta")
        if isinstance(first, dict)
        else getattr(first, "delta", None)
    )
    content = (
        delta.get("content")
        if isinstance(delta, dict)
        else getattr(delta, "content", None)
    )
    return content if isinstance(content, str) else ""


class ModelArkProviderError(RuntimeError):
    """Safe provider error that does not retain credentials or raw responses."""

    def __init__(
        self,
        message: str,
        *,
        phase: str | None = None,
        provider_code: str | None = None,
        request_id: str | None = None,
        provider_task_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.phase = _safe_provider_value(phase)
        self.provider_code = _safe_provider_value(provider_code)
        self.request_id = _safe_provider_value(request_id)
        self.provider_task_id = _safe_provider_value(provider_task_id)

    def safe_detail(self) -> str:
        fields = {
            "provider_code": self.provider_code or "UnknownProviderError",
            "request_id": self.request_id,
            "provider_task_id": self.provider_task_id,
            "phase": self.phase,
        }
        return "; ".join(
            f"{key}={value}" for key, value in fields.items() if value
        )

    def safe_log_fields(self) -> dict[str, str]:
        return {
            "provider_code": self.provider_code or "UnknownProviderError",
            **({"request_id": self.request_id} if self.request_id else {}),
            **(
                {"provider_task_id": self.provider_task_id}
                if self.provider_task_id
                else {}
            ),
            **({"phase": self.phase} if self.phase else {}),
        }


class ModelArkTextParseError(ModelArkProviderError):
    """Safe text parsing error for model responses that failed validation."""


class TextGenerationRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    stage: Stage
    brief: Brief
    upstream_content: Optional[str] = None
    image_urls: list[str] = Field(default_factory=list)


class AigcTextGenerationRequest(SchemaModel):
    model: str = Field(..., min_length=1, max_length=255)
    prompt: str = Field(..., min_length=1, max_length=20000)
    system_prompt: str = Field(default="", max_length=12000)
    temperature: float = Field(default=0.7, ge=0, le=2)


class ImageGenerationRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    shot: StoryboardShotCreate
    aspect_ratio: str = "9:16"


class ImagePromptGenerationRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    brief: Brief
    current_prompt: str | None = Field(default=None, max_length=12000)


class ProjectImageGenerationRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    operation: ImageGenerationOperation
    prompt: str = Field(..., min_length=1)
    size: ImageGenerationSize = ImageGenerationSize.TWO_K
    output_format: ImageOutputFormat = ImageOutputFormat.PNG
    source_image_url: str | None = Field(default=None, min_length=1)
    reference_image_urls: list[str] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def validate_source_image(self) -> "ProjectImageGenerationRequest":
        if (
            self.operation == ImageGenerationOperation.IMAGE_TO_IMAGE
            and not self.source_image_url
        ):
            raise ValueError("image_to_image requires source_image_url")
        if (
            self.operation == ImageGenerationOperation.TEXT_TO_IMAGE
            and self.source_image_url is not None
        ):
            raise ValueError("text_to_image must not include source_image_url")
        return self


class LayerDecompositionRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    model: Literal["doubao-seedream-5-0-pro-260628"] = SEEDREAM_5_PRO_MODEL
    image_url: str = Field(..., min_length=1)
    canvas_width: int = Field(..., gt=0)
    canvas_height: int = Field(..., gt=0)
    prompt: str | None = None
    size: ImageLayerDecompositionSize = ImageLayerDecompositionSize.AUTO
    output_format: ImageOutputFormat = ImageOutputFormat.PNG


class DecomposedImageLayer(SchemaModel):
    z_index: int = Field(..., ge=1, le=16)
    url: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=4000)
    bbox_absolute: tuple[int, int, int, int]
    bbox_normalized: tuple[int, int, int, int]


class LayerDecompositionResult(SchemaModel):
    base_url: str = Field(..., min_length=1)
    layers: list[DecomposedImageLayer] = Field(..., min_length=1, max_length=16)


class CharacterGenerationRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    brief: Brief
    story_content: str = Field(..., min_length=1)


class GeneratedCharacterCardResult(SchemaModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=4000)
    sort_order: int = Field(default=0, ge=0)


class CharacterExtractionPayload(SchemaModel):
    characters: list[GeneratedCharacterCardResult] = Field(default_factory=list)


class CharacterImageEditRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    source_image_url: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)


class CharacterImageRegenerateRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)


class VideoGenerationRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    shot: StoryboardShotCreate
    image_url: Optional[str] = None
    video_prompt: Optional[str] = None
    aspect_ratio: str = "9:16"
    reference_image_urls: list[str] = Field(default_factory=list)
    reference_video_urls: list[str] = Field(default_factory=list)
    reference_audio_urls: list[str] = Field(default_factory=list)
    brief_summary: Optional[str] = None

    @model_validator(mode="after")
    def validate_input_mode(self) -> "VideoGenerationRequest":
        has_reference_media = any(
            (
                self.reference_image_urls,
                self.reference_video_urls,
                self.reference_audio_urls,
            )
        )
        if self.image_url and has_reference_media:
            raise ValueError(
                "first frame cannot be combined with reference media"
            )
        return self


class ToolVideoGenerationRequest(SchemaModel):
    """Independent Seedance request for a tool task with no storyboard inputs."""

    model: ToolVideoModel
    prompt: str = Field(..., min_length=1, max_length=12000)
    reference_image_urls: list[str] = Field(default_factory=list, max_length=30)
    reference_video_urls: list[str] = Field(default_factory=list, max_length=10)
    reference_audio_urls: list[str] = Field(default_factory=list, max_length=10)
    duration_seconds: int = Field(..., strict=True)
    resolution: ToolVideoResolution
    aspect_ratio: ToolVideoAspectRatio

    @model_validator(mode="after")
    def validate_duration_for_model(self) -> "ToolVideoGenerationRequest":
        validate_tool_video_duration(self.model, self.duration_seconds)
        validate_tool_video_resolution(self.model, self.resolution)
        validate_seedance_reference_counts(
            self.model,
            reference_image_count=len(self.reference_image_urls),
            reference_video_count=len(self.reference_video_urls),
            reference_audio_count=len(self.reference_audio_urls),
        )
        return self


class SeedanceVideoGenerationRequest(SchemaModel):
    """Domain-neutral, fully validated Seedance provider request."""

    model: SeedanceModel
    generation_mode: SeedanceGenerationMode
    task_type: SeedanceTaskType = SEEDANCE_DEFAULT_TASK_TYPE
    prompt: str | None = Field(default=None, max_length=12000)
    first_frame_url: str | None = Field(default=None, min_length=1)
    last_frame_url: str | None = Field(default=None, min_length=1)
    reference_image_urls: list[str] = Field(default_factory=list, max_length=30)
    reference_video_urls: list[str] = Field(default_factory=list, max_length=10)
    reference_audio_urls: list[str] = Field(default_factory=list, max_length=10)
    duration_seconds: int = Field(..., strict=True)
    resolution: SeedanceResolution
    aspect_ratio: SeedanceAspectRatio
    generate_audio: bool = Field(default=True, strict=True)

    @field_validator(
        "prompt",
        "first_frame_url",
        "last_frame_url",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        return stripped or None

    @field_validator(
        "reference_image_urls",
        "reference_video_urls",
        "reference_audio_urls",
    )
    @classmethod
    def validate_reference_urls(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values]
        if any(not value for value in normalized):
            raise ValueError("reference URLs must not be blank")
        return normalized

    @model_validator(mode="after")
    def validate_seedance_request(self) -> "SeedanceVideoGenerationRequest":
        validate_seedance_duration(self.model, self.duration_seconds)
        validate_seedance_resolution(self.model, self.resolution)
        validate_seedance_reference_counts(
            self.model,
            reference_image_count=len(self.reference_image_urls),
            reference_video_count=len(self.reference_video_urls),
            reference_audio_count=len(self.reference_audio_urls),
        )
        has_references = any(
            (
                self.reference_image_urls,
                self.reference_video_urls,
                self.reference_audio_urls,
            )
        )
        if self.task_type in {"edit", "extend"}:
            if self.generation_mode != "multimodal_reference":
                raise ValueError(
                    "edit and extend require multimodal_reference mode"
                )
            if not self.reference_video_urls:
                raise ValueError(
                    "edit and extend require at least one reference video"
                )
        if self.generation_mode == "text_to_video":
            if not self.prompt:
                raise ValueError("text_to_video requires prompt")
            if self.first_frame_url or self.last_frame_url or has_references:
                raise ValueError("text_to_video must not include media")
        elif self.generation_mode == "first_frame":
            if not self.first_frame_url:
                raise ValueError("first_frame requires first_frame_url")
            if self.last_frame_url or has_references:
                raise ValueError("first_frame must not include other media")
        elif self.generation_mode == "first_last_frame":
            if not self.first_frame_url or not self.last_frame_url:
                raise ValueError(
                    "first_last_frame requires first_frame_url and last_frame_url"
                )
            if has_references:
                raise ValueError(
                    "first_last_frame must not include reference media"
                )
        else:
            if self.first_frame_url or self.last_frame_url:
                raise ValueError(
                    "multimodal_reference must not include frame media"
                )
            if not self.prompt and not has_references:
                raise ValueError(
                    "multimodal_reference requires prompt or reference media"
                )
            if (
                self.model != "doubao-seedance-2-5-260628"
                and self.reference_audio_urls
                and not (
                    self.reference_image_urls or self.reference_video_urls
                )
            ):
                raise ValueError(
                    f"{self.model} audio references require an image or video"
                )
        return self


class VideoEditRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    shot: StoryboardShotCreate
    source_video_url: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1, max_length=4000)
    aspect_ratio: str = "9:16"


class VideoPromptOptimizationShotContext(SchemaModel):
    title: Optional[str] = None
    description: str = Field(..., min_length=1)
    visual_prompt: str = Field(..., min_length=1)
    narration: Optional[str] = None
    duration_seconds: float = Field(..., gt=0)
    timeline_start_seconds: float = Field(..., ge=0)
    timeline_end_seconds: float = Field(..., gt=0)


class VideoPromptOptimizationRequest(SchemaModel):
    project_id: str = Field(..., min_length=1)
    brief: Brief
    shot: VideoPromptOptimizationShotContext
    atomic_shots: list[VideoPromptOptimizationShotContext] = Field(
        ...,
        min_length=1,
    )
    video_prompt: str = Field(
        ...,
        min_length=1,
        max_length=MAX_VIDEO_PROMPT_LENGTH,
    )
    baseline_prompt: str = Field(
        ...,
        min_length=1,
        max_length=MAX_VIDEO_PROMPT_LENGTH,
    )
    uses_first_frame: bool = False
    uses_previous_shot_last_frame: bool = False
    reference_asset_labels: list[str] = Field(default_factory=list)


class VideoPromptOptimizationResult(SchemaModel):
    optimized_prompt: str = Field(
        ...,
        min_length=1,
        max_length=MAX_VIDEO_PROMPT_LENGTH,
    )


class ToolVideoPromptOptimizationRequest(SchemaModel):
    """Lightweight edit-oriented prompt optimization request for tool videos."""

    prompt: str = Field(..., min_length=1, max_length=12000)
    reference_image_count: int = Field(default=0, ge=0)
    reference_video_count: int = Field(default=0, ge=0)
    reference_audio_count: int = Field(default=0, ge=0)


class AigcImagePromptOptimizationRequest(SchemaModel):
    text: str = Field(default="", max_length=20000)
    reference_instructions: list[str] = Field(default_factory=list, max_length=10)
    generation_modes: list[Literal["text_to_image", "image_to_image"]] = Field(
        min_length=1,
        max_length=2,
    )
    reference_image_count: int = Field(default=0, ge=0, le=10)


class AigcImagePromptOptimizationResult(SchemaModel):
    optimized_text: str = Field(default="", max_length=20000)
    optimized_reference_instructions: list[str] = Field(
        default_factory=list,
        max_length=10,
    )


class GeneratedTextResult(SchemaModel):
    stage: Stage
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    storyboard_shots: list[StoryboardShotCreate] = Field(default_factory=list)
    metadata: dict[str, Optional[Union[str, int, float, bool]]] = Field(
        default_factory=dict
    )


class TextGenerationPayload(SchemaModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    storyboard_shots: list[StoryboardShotCreate] = Field(default_factory=list)


@dataclass(frozen=True)
class ModelArkStreamEvent:
    kind: Literal["delta", "completed"]
    delta: str = ""
    result: GeneratedTextResult | VideoPromptOptimizationResult | None = None


class GeneratedAssetResult(SchemaModel):
    type: AssetType
    stage: Stage
    url: str = Field(..., min_length=1)
    mime_type: str = Field(..., min_length=1)
    last_frame_url: Optional[str] = None
    metadata: dict[str, Optional[Union[str, int, float, bool]]] = Field(
        default_factory=dict
    )


def _seedance_metadata(
    request: SeedanceVideoGenerationRequest,
    *,
    provider: str,
    provider_task_id: str,
    provider_request_id: str | None,
) -> dict[str, Optional[Union[str, int, float, bool]]]:
    return {
        "model": request.model,
        "generation_mode": request.generation_mode,
        "provider": provider,
        "provider_task_id": provider_task_id,
        "provider_request_id": provider_request_id,
        "prompt": request.prompt,
        "duration_seconds": request.duration_seconds,
        "aspect_ratio": request.aspect_ratio,
        "resolution": request.resolution,
        "generate_audio": request.generate_audio,
        "uses_first_frame": request.first_frame_url is not None,
        "uses_last_frame": request.last_frame_url is not None,
        "reference_image_count": len(request.reference_image_urls),
        "reference_video_count": len(request.reference_video_urls),
        "reference_audio_count": len(request.reference_audio_urls),
        "status": Status.SUCCEEDED.value,
    }


def _seedance_request_from_tool(
    request: ToolVideoGenerationRequest,
) -> SeedanceVideoGenerationRequest:
    generation_mode: SeedanceGenerationMode = (
        "multimodal_reference"
        if any(
            (
                request.reference_image_urls,
                request.reference_video_urls,
                request.reference_audio_urls,
            )
        )
        else "text_to_video"
    )
    return SeedanceVideoGenerationRequest(
        model=request.model,
        generation_mode=generation_mode,
        task_type=SEEDANCE_DEFAULT_TASK_TYPE,
        prompt=request.prompt,
        reference_image_urls=request.reference_image_urls,
        reference_video_urls=request.reference_video_urls,
        reference_audio_urls=request.reference_audio_urls,
        duration_seconds=request.duration_seconds,
        resolution=request.resolution,
        aspect_ratio=request.aspect_ratio,
        generate_audio=True,
    )


class ModelArkAdapter(Protocol):
    async def generate_aigc_text(
        self,
        request: AigcTextGenerationRequest,
    ) -> str:
        """Generate unstructured text for an AIGC pipeline node."""

    async def generate_text(
        self,
        request: TextGenerationRequest,
    ) -> GeneratedTextResult:
        """Generate story, script, or storyboard text."""

    def stream_text(
        self,
        request: TextGenerationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        """Stream visible text and finish with a validated result."""

    async def generate_image_prompt(
        self,
        request: ImagePromptGenerationRequest,
    ) -> ImagePromptSuggestion:
        """Generate one directly usable image prompt suggestion."""

    async def generate_image(
        self,
        request: ImageGenerationRequest,
    ) -> GeneratedAssetResult:
        """Generate one image asset for a storyboard shot."""

    async def generate_project_image(
        self,
        request: ProjectImageGenerationRequest,
    ) -> GeneratedAssetResult:
        """Generate one image-project result from text or one source image."""

    async def decompose_image_layers(
        self,
        request: LayerDecompositionRequest,
    ) -> LayerDecompositionResult:
        """Decompose one image into one base and ordered transparent layers."""

    async def generate_characters(
        self,
        request: CharacterGenerationRequest,
    ) -> list[GeneratedCharacterCardResult]:
        """Extract character cards from a story."""

    async def edit_character_image(
        self,
        request: CharacterImageEditRequest,
    ) -> GeneratedAssetResult:
        """Edit a single character image using a reference image URL and prompt."""

    async def regenerate_character_image(
        self,
        request: CharacterImageRegenerateRequest,
    ) -> GeneratedAssetResult:
        """Regenerate a single character image from an adjusted prompt."""

    async def generate_video(
        self,
        request: VideoGenerationRequest,
    ) -> GeneratedAssetResult:
        """Generate one storyboard video asset for a storyboard shot."""

    async def generate_tool_video(
        self,
        request: ToolVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        """Generate one independent tool video with multimodal references."""

    async def generate_seedance_video(
        self,
        request: SeedanceVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        """Generate one video through the shared Seedance provider chain."""

    async def edit_video(
        self,
        request: VideoEditRequest,
    ) -> GeneratedAssetResult:
        """Edit one storyboard video using the existing video as reference."""

    async def optimize_video_prompt(
        self,
        request: VideoPromptOptimizationRequest,
    ) -> VideoPromptOptimizationResult:
        """Optimize one storyboard video prompt without persisting it."""

    async def optimize_tool_video_prompt(
        self,
        request: ToolVideoPromptOptimizationRequest,
    ) -> VideoPromptOptimizationResult:
        """Optimize one tool video edit prompt without persisting it."""

    async def optimize_aigc_image_prompt(
        self,
        request: AigcImagePromptOptimizationRequest,
    ) -> AigcImagePromptOptimizationResult:
        """Optimize one structured AIGC image prompt without persisting it."""

    def stream_video_prompt_optimization(
        self,
        request: VideoPromptOptimizationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        """Stream one optimized prompt without persisting it."""


class BytePlusModelArkAdapter:
    """Real BytePlus ModelArk adapter for text, image, and video generation."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        *,
        client: Any | None = None,
        async_client: Any | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.settings.require_modelark_config()

        if client is None:
            from byteplussdkarkruntime import Ark, AsyncArk

            assert self.settings.ark_api_key is not None
            self._http_client = httpx.Client(
                timeout=httpx.Timeout(float(self.settings.ark_image_timeout_seconds))
            )
            client = Ark(
                api_key=self.settings.ark_api_key.get_secret_value(),
                base_url=self.settings.ark_base_url,
                timeout=float(self.settings.ark_image_timeout_seconds),
                max_retries=0,
                http_client=self._http_client,
            )
            self._async_http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(float(self.settings.ark_image_timeout_seconds))
            )
            async_client = AsyncArk(
                api_key=self.settings.ark_api_key.get_secret_value(),
                base_url=self.settings.ark_base_url,
                timeout=float(self.settings.ark_image_timeout_seconds),
                max_retries=0,
                http_client=self._async_http_client,
            )
        self.client = client
        self.async_client = async_client or client

    async def generate_text(
        self,
        request: TextGenerationRequest,
    ) -> GeneratedTextResult:
        if request.stage not in TEXT_GENERATION_STAGES:
            raise ModelArkProviderError(
                f"unsupported text generation stage: {request.stage.value}"
            )

        prompt = MockModelArkAdapter.build_text_prompt(request)
        try:
            if request.image_urls:
                response = await asyncio.to_thread(
                    self.client.responses.create,
                    model=self.settings.ark_text_model,
                    input=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": prompt,
                                },
                                *[
                                    {
                                        "type": "input_image",
                                        "image_url": image_url,
                                        "detail": "auto",
                                    }
                                    for image_url in request.image_urls
                                ],
                            ],
                        }
                    ],
                    text={"format": {"type": "json_object"}},
                    thinking=SEED_THINKING_DISABLED,
                    temperature=0.2,
                    max_output_tokens=4096,
                )
                text = self._response_output_text(response)
            else:
                response = await asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=self.settings.ark_text_model,
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                    response_format={"type": "json_object"},
                    thinking=SEED_THINKING_DISABLED,
                    temperature=0.2,
                    max_tokens=4096,
                )
                text = self._chat_output_text(response)
            payload = self._parse_text_payload(text)
        except (ModelArkProviderError, ModelArkTextParseError):
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                f"{request.stage.value} text generation response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError(
                f"text generation failed for stage {request.stage.value}"
            ) from exc

        return GeneratedTextResult(
            stage=request.stage,
            title=payload.title,
            content=payload.content,
            storyboard_shots=payload.storyboard_shots,
            metadata={
                "model": self.settings.ark_text_model,
                "provider": "volcengine-modelark",
                "artifact_kind": request.stage.value,
                "has_upstream": bool(request.upstream_content),
                "image_input_count": len(request.image_urls),
                "prompt_summary": prompt[:240],
            },
        )

    async def generate_aigc_text(
        self,
        request: AigcTextGenerationRequest,
    ) -> str:
        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=request.model,
                messages=messages,
                thinking=SEED_THINKING_DISABLED,
                temperature=request.temperature,
            )
            return self._chat_output_text(response)
        except ModelArkProviderError:
            raise
        except Exception as exc:
            raise _provider_error_from_exception(
                exc,
                phase="aigc_text_generate",
            ) from exc

    async def generate_image_prompt(
        self,
        request: ImagePromptGenerationRequest,
    ) -> ImagePromptSuggestion:
        system_prompt, user_prompt = MockModelArkAdapter.build_image_prompt_messages(
            request
        )
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.settings.ark_text_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                thinking=SEED_THINKING_DISABLED,
                temperature=0.2,
                max_tokens=1200,
            )
            prompt = self._plain_text_output(self._chat_output_text(response))
            try:
                prompt = validate_visible_selling_copy(prompt)
            except ValueError as exc:
                raise ModelArkTextParseError(
                    "image prompt generation returned invalid visible copy"
                ) from exc
        except (ModelArkProviderError, ModelArkTextParseError):
            raise
        except Exception as exc:
            raise ModelArkProviderError("image prompt generation failed") from exc
        return ImagePromptSuggestion(
            prompt=prompt,
            model=self.settings.ark_text_model,
        )

    async def stream_text(
        self,
        request: TextGenerationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        if request.stage not in TEXT_GENERATION_STAGES:
            raise ModelArkProviderError(
                f"unsupported text generation stage: {request.stage.value}"
            )
        prompt = MockModelArkAdapter.build_text_prompt(request)
        extractor = IncrementalJsonStringExtractor("content")
        try:
            if request.image_urls:
                stream = await self.async_client.responses.create(
                    model=self.settings.ark_text_model,
                    input=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "input_text", "text": prompt},
                                *[
                                    {
                                        "type": "input_image",
                                        "image_url": image_url,
                                        "detail": "auto",
                                    }
                                    for image_url in request.image_urls
                                ],
                            ],
                        }
                    ],
                    text={"format": {"type": "json_object"}},
                    thinking=SEED_THINKING_DISABLED,
                    temperature=0.2,
                    max_output_tokens=4096,
                    stream=True,
                )
                async for provider_event in stream:
                    if (
                        getattr(provider_event, "type", None)
                        != "response.output_text.delta"
                    ):
                        continue
                    chunk = getattr(provider_event, "delta", "")
                    if not isinstance(chunk, str):
                        continue
                    extracted = extractor.feed(chunk)
                    if extracted.delta:
                        yield ModelArkStreamEvent(
                            kind="delta",
                            delta=extracted.delta,
                        )
            else:
                stream = await self.async_client.chat.completions.create(
                    model=self.settings.ark_text_model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    thinking=SEED_THINKING_DISABLED,
                    temperature=0.2,
                    max_tokens=4096,
                    stream=True,
                )
                async for chunk_event in stream:
                    chunk = _chat_stream_text(chunk_event)
                    if not chunk:
                        continue
                    extracted = extractor.feed(chunk)
                    if extracted.delta:
                        yield ModelArkStreamEvent(
                            kind="delta",
                            delta=extracted.delta,
                        )
            payload = self._parse_text_payload(extractor.raw_json)
        except (ModelArkProviderError, ModelArkTextParseError):
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                f"{request.stage.value} text generation response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError(
                f"text generation failed for stage {request.stage.value}"
            ) from exc

        result = GeneratedTextResult(
            stage=request.stage,
            title=payload.title,
            content=payload.content,
            storyboard_shots=payload.storyboard_shots,
            metadata={
                "model": self.settings.ark_text_model,
                "provider": "volcengine-modelark",
                "artifact_kind": request.stage.value,
                "has_upstream": bool(request.upstream_content),
                "image_input_count": len(request.image_urls),
                "prompt_summary": prompt[:240],
            },
        )
        yield ModelArkStreamEvent(kind="completed", result=result)

    async def optimize_video_prompt(
        self,
        request: VideoPromptOptimizationRequest,
    ) -> VideoPromptOptimizationResult:
        system_prompt, user_prompt = (
            MockModelArkAdapter.build_video_prompt_optimization_messages(request)
        )
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.settings.ark_text_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                thinking=SEED_THINKING_DISABLED,
                temperature=0.1,
                max_tokens=16_384,
            )
            return self._parse_video_prompt_optimization_payload(
                self._chat_output_text(response)
            )
        except (ModelArkProviderError, ModelArkTextParseError):
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                "video prompt optimization response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError("video prompt optimization failed") from exc

    async def optimize_tool_video_prompt(
        self,
        request: ToolVideoPromptOptimizationRequest,
    ) -> VideoPromptOptimizationResult:
        system_prompt, user_prompt = (
            MockModelArkAdapter.build_tool_video_prompt_optimization_messages(request)
        )
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.settings.ark_text_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                thinking=SEED_THINKING_DISABLED,
                temperature=0.1,
                max_tokens=8_192,
            )
            return self._parse_video_prompt_optimization_payload(
                self._chat_output_text(response)
            )
        except (ModelArkProviderError, ModelArkTextParseError):
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                "tool video prompt optimization response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError(
                "tool video prompt optimization failed"
            ) from exc

    async def optimize_aigc_image_prompt(
        self,
        request: AigcImagePromptOptimizationRequest,
    ) -> AigcImagePromptOptimizationResult:
        system_prompt, user_prompt = (
            MockModelArkAdapter.build_aigc_image_prompt_optimization_messages(request)
        )
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.settings.ark_text_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                thinking=SEED_THINKING_DISABLED,
                temperature=0.1,
                max_tokens=32_768,
            )
            return self._parse_aigc_image_prompt_optimization_payload(
                self._chat_output_text(response)
            )
        except (ModelArkProviderError, ModelArkTextParseError):
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                "AIGC image prompt optimization response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError(
                "AIGC image prompt optimization failed"
            ) from exc

    async def stream_video_prompt_optimization(
        self,
        request: VideoPromptOptimizationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        system_prompt, user_prompt = (
            MockModelArkAdapter.build_video_prompt_optimization_messages(request)
        )
        extractor = IncrementalJsonStringExtractor("optimized_prompt")
        try:
            stream = await self.async_client.chat.completions.create(
                model=self.settings.ark_text_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                thinking=SEED_THINKING_DISABLED,
                temperature=0.1,
                max_tokens=16_384,
                stream=True,
            )
            async for chunk_event in stream:
                chunk = _chat_stream_text(chunk_event)
                if not chunk:
                    continue
                extracted = extractor.feed(chunk)
                if extracted.delta:
                    yield ModelArkStreamEvent(
                        kind="delta",
                        delta=extracted.delta,
                    )
            result = self._parse_video_prompt_optimization_payload(
                extractor.raw_json
            )
        except (ModelArkProviderError, ModelArkTextParseError):
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                "video prompt optimization response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError("video prompt optimization failed") from exc
        yield ModelArkStreamEvent(kind="completed", result=result)

    async def generate_image(
        self,
        request: ImageGenerationRequest,
    ) -> GeneratedAssetResult:
        raise ModelArkProviderError("real storyboard image generation is not enabled")

    async def generate_project_image(
        self,
        request: ProjectImageGenerationRequest,
    ) -> GeneratedAssetResult:
        kwargs: dict[str, object] = {
            "model": request.model,
            "prompt": request.prompt,
            "size": request.size.value,
            "output_format": request.output_format.value,
            "response_format": "url",
            "watermark": False,
            "stream": False,
        }
        image_urls = [
            *( [request.source_image_url] if request.source_image_url else [] ),
            *request.reference_image_urls,
        ]
        if image_urls:
            kwargs["image"] = (
                image_urls[0] if len(image_urls) == 1 else image_urls
            )
        try:
            response = await asyncio.to_thread(
                self.client.images.generate,
                **kwargs,
            )
            url = self._first_image_url(response)
        except ModelArkProviderError:
            raise
        except Exception as exc:
            raise _provider_error_from_exception(
                exc,
                phase="image_generate",
            ) from exc

        mime_type = (
            "image/png"
            if request.output_format == ImageOutputFormat.PNG
            else "image/jpeg"
        )
        return GeneratedAssetResult(
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.IMAGE,
            url=url,
            mime_type=mime_type,
            metadata={
                "model": request.model,
                "provider": "byteplus-modelark",
                "operation": request.operation.value,
                "size": request.size.value,
                "format": request.output_format.value,
                "status": Status.SUCCEEDED.value,
            },
        )

    async def decompose_image_layers(
        self,
        request: LayerDecompositionRequest,
    ) -> LayerDecompositionResult:
        kwargs: dict[str, object] = {
            "model": request.model,
            "image": request.image_url,
            "prompt": request.prompt,
            "size": request.size.value,
            "output_format": request.output_format.value,
            "response_format": "url",
            "watermark": False,
            "extra_body": {"layer_decomposition": True},
        }
        try:
            response = await asyncio.to_thread(
                self.client.images.generate,
                **kwargs,
            )
            return self._parse_layer_decomposition_response(
                response,
                width=request.canvas_width,
                height=request.canvas_height,
            )
        except ModelArkProviderError:
            raise
        except Exception as exc:
            raise _provider_error_from_exception(
                exc,
                phase="layer_decomposition",
            ) from exc

    async def generate_characters(
        self,
        request: CharacterGenerationRequest,
    ) -> list[GeneratedCharacterCardResult]:
        prompt = MockModelArkAdapter.build_character_extraction_prompt(request)
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.settings.ark_text_model,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                response_format={"type": "json_object"},
                thinking=SEED_THINKING_DISABLED,
                temperature=0.1,
                max_tokens=4096,
            )
            payload = self._parse_character_payload(self._chat_output_text(response))
        except (ModelArkProviderError, ModelArkTextParseError):
            raise
        except ValidationError as exc:
            raise ModelArkTextParseError(
                "character extraction response could not be parsed"
            ) from exc
        except Exception as exc:
            raise ModelArkProviderError("character extraction failed") from exc

        if not payload.characters:
            raise ModelArkTextParseError("character extraction returned no characters")
        return [
            character.model_copy(update={"sort_order": index}, deep=True)
            for index, character in enumerate(payload.characters, start=1)
        ]

    async def edit_character_image(
        self,
        request: CharacterImageEditRequest,
    ) -> GeneratedAssetResult:
        try:
            response = await asyncio.to_thread(
                self.client.images.generate,
                model=self.settings.ark_image_model,
                prompt=request.prompt,
                image=request.source_image_url,
                size="2K",
                output_format="png",
                response_format="url",
                watermark=False,
            )
            url = self._first_image_url(response)
        except ModelArkProviderError:
            raise
        except Exception as exc:
            raise ModelArkProviderError("character image edit failed") from exc

        return self._character_iteration_result(
            url=url,
            prompt=request.prompt,
            operation_type=CharacterAssetIterationOperation.EDIT,
        )

    async def regenerate_character_image(
        self,
        request: CharacterImageRegenerateRequest,
    ) -> GeneratedAssetResult:
        try:
            response = await asyncio.to_thread(
                self.client.images.generate,
                model=self.settings.ark_image_model,
                prompt=request.prompt,
                size="2K",
                output_format="png",
                response_format="url",
                watermark=False,
            )
            url = self._first_image_url(response)
        except ModelArkProviderError:
            raise
        except Exception as exc:
            raise ModelArkProviderError("character image regeneration failed") from exc

        return self._character_iteration_result(
            url=url,
            prompt=request.prompt,
            operation_type=CharacterAssetIterationOperation.REGENERATE,
        )

    async def generate_video(
        self,
        request: VideoGenerationRequest,
    ) -> GeneratedAssetResult:
        return await self._generate_video(request)

    async def generate_tool_video(
        self,
        request: ToolVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        return await self.generate_seedance_video(_seedance_request_from_tool(request))

    async def generate_seedance_video(
        self,
        request: SeedanceVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        content: list[dict[str, object]] = []
        if request.prompt:
            content.append({"type": "text", "text": request.prompt})
        for url, role in (
            (request.first_frame_url, "first_frame"),
            (request.last_frame_url, "last_frame"),
        ):
            if url:
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": url},
                        "role": role,
                    }
                )
        content.extend(
            {
                "type": "image_url",
                "image_url": {"url": url},
                "role": "reference_image",
            }
            for url in request.reference_image_urls
        )
        content.extend(
            {
                "type": "video_url",
                "video_url": {"url": url},
                "role": "reference_video",
            }
            for url in request.reference_video_urls
        )
        content.extend(
            {
                "type": "audio_url",
                "audio_url": {"url": url},
                "role": "reference_audio",
            }
            for url in request.reference_audio_urls
        )

        try:
            created = await asyncio.to_thread(
                self.client.content_generation.tasks.create,
                model=request.model,
                content=content,
                resolution=request.resolution,
                ratio=request.aspect_ratio,
                duration=request.duration_seconds,
                generate_audio=request.generate_audio,
                watermark=False,
            )
        except Exception as exc:
            raise _provider_error_from_exception(exc, phase="create") from exc

        try:
            task_id = getattr(created, "id", None)
            if not isinstance(task_id, str) or not task_id.strip():
                raise ModelArkProviderError(
                    "video generation task returned no task ID",
                    phase="create",
                )
            completed = await self._wait_for_video_task(task_id.strip())
            video_url = getattr(getattr(completed, "content", None), "video_url", None)
            if not isinstance(video_url, str) or not video_url.strip():
                raise ModelArkProviderError(
                    "video generation succeeded without a video URL",
                    phase="poll",
                    provider_task_id=task_id.strip(),
                )
        except ModelArkProviderError:
            raise
        except Exception as exc:
            raise _provider_error_from_exception(
                exc,
                phase="poll",
                provider_task_id=task_id.strip(),
            ) from exc

        return GeneratedAssetResult(
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            url=video_url.strip(),
            mime_type="video/mp4",
            metadata=_seedance_metadata(
                request,
                provider="volcengine-modelark",
                provider_task_id=task_id.strip(),
                provider_request_id=(
                    _provider_request_id(created)
                    or _provider_request_id(completed)
                ),
            ),
        )

    async def _generate_video(
        self,
        request: VideoGenerationRequest,
        *,
        task_ratio_override: str | None = None,
        task_duration_override: int | None = None,
    ) -> GeneratedAssetResult:
        content: list[dict[str, object]] = [
            {
                "type": "text",
                "text": request.video_prompt or request.shot.description,
            }
        ]
        if request.image_url:
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": request.image_url},
                    "role": "first_frame",
                }
            )
        content.extend(
                {
                    "type": "image_url",
                    "image_url": {"url": url},
                    "role": "reference_image",
                }
                for url in request.reference_image_urls
            )
        content.extend(
            {
                "type": "video_url",
                "video_url": {"url": url},
                "role": "reference_video",
            }
            for url in request.reference_video_urls
        )
        content.extend(
            {
                "type": "audio_url",
                "audio_url": {"url": url},
                "role": "reference_audio",
            }
            for url in request.reference_audio_urls
        )
        requested_duration = request.shot.duration_seconds
        duration = (
            task_duration_override
            if task_duration_override is not None
            else min(30, max(4, round(requested_duration)))
        )
        task_ratio = (
            task_ratio_override
            if task_ratio_override is not None
            else "adaptive"
            if request.image_url
            else request.aspect_ratio
        )

        try:
            created = await asyncio.to_thread(
                self.client.content_generation.tasks.create,
                model=self.settings.ark_video_model,
                content=content,
                resolution="720p",
                ratio=task_ratio,
                duration=duration,
                generate_audio=True,
                return_last_frame=True,
                watermark=False,
            )
        except Exception as exc:
            raise _provider_error_from_exception(exc, phase="create") from exc

        try:
            task_id = getattr(created, "id", None)
            if not isinstance(task_id, str) or not task_id.strip():
                raise ModelArkProviderError(
                    "video generation task returned no task ID",
                    phase="create",
                )
            completed = await self._wait_for_video_task(task_id.strip())
            video_url = getattr(getattr(completed, "content", None), "video_url", None)
            if not isinstance(video_url, str) or not video_url.strip():
                raise ModelArkProviderError(
                    "video generation succeeded without a video URL",
                    phase="poll",
                    provider_task_id=task_id.strip(),
                )
            last_frame_url = getattr(
                getattr(completed, "content", None),
                "last_frame_url",
                None,
            )
            if not isinstance(last_frame_url, str) or not last_frame_url.strip():
                last_frame_url = None
        except ModelArkProviderError:
            raise
        except Exception as exc:
            raise _provider_error_from_exception(
                exc,
                phase="poll",
                provider_task_id=task_id.strip(),
            ) from exc

        return GeneratedAssetResult(
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            url=video_url.strip(),
            mime_type="video/mp4",
            last_frame_url=last_frame_url.strip() if last_frame_url else None,
            metadata={
                "model": self.settings.ark_video_model,
                "provider": "volcengine-modelark",
                "provider_task_id": task_id.strip(),
                "shot_index": request.shot.index,
                "requested_duration_seconds": requested_duration,
                "duration_seconds": duration,
                "aspect_ratio": task_ratio,
                "resolution": "720p",
                "generate_audio": True,
                "reference_image_count": len(request.reference_image_urls),
                "reference_video_count": len(request.reference_video_urls),
                "reference_audio_count": len(request.reference_audio_urls),
                "uses_first_frame": bool(request.image_url),
                "status": Status.SUCCEEDED.value,
            },
        )

    async def edit_video(
        self,
        request: VideoEditRequest,
    ) -> GeneratedAssetResult:
        instruction = "\n".join(
            [
                "基于参考视频进行定向编辑。保持原视频时长、画幅、主体身份、"
                "人物外观、场景空间、动作连续性和叙事顺序，仅执行以下修改：",
                request.prompt,
            ]
        )
        generated = await self._generate_video(
            VideoGenerationRequest(
                project_id=request.project_id,
                shot=request.shot,
                video_prompt=instruction,
                aspect_ratio=request.aspect_ratio,
                reference_video_urls=[request.source_video_url],
            ),
            task_ratio_override="adaptive",
            task_duration_override=-1,
        )
        return generated.model_copy(
            update={
                "metadata": {
                    **generated.metadata,
                    "operation": "video_edit",
                    "edit_prompt": request.prompt,
                }
            }
        )

    async def _wait_for_video_task(self, task_id: str) -> Any:
        deadline = monotonic() + self.settings.ark_video_timeout_seconds
        while True:
            task = await asyncio.to_thread(
                self.client.content_generation.tasks.get,
                task_id=task_id,
            )
            task_status = str(getattr(task, "status", "")).lower()
            if task_status == "succeeded":
                return task
            if task_status in {"failed", "cancelled", "expired"}:
                error = getattr(task, "error", None)
                raise ModelArkProviderError(
                    f"video generation task {task_status}",
                    phase="poll",
                    provider_code=_provider_field(error, "code"),
                    request_id=_provider_request_id(error),
                    provider_task_id=task_id,
                )
            if monotonic() >= deadline:
                raise ModelArkProviderError(
                    "video generation task timed out",
                    phase="poll",
                    provider_code="TaskTimeout",
                    provider_task_id=task_id,
                )
            await asyncio.sleep(self.settings.ark_video_poll_interval_seconds)

    def _character_iteration_result(
        self,
        *,
        url: str,
        prompt: str,
        operation_type: CharacterAssetIterationOperation,
    ) -> GeneratedAssetResult:
        return GeneratedAssetResult(
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.CHARACTER,
            url=url,
            mime_type="image/png",
            metadata={
                "model": self.settings.ark_image_model,
                "provider": "byteplus-modelark",
                "aspect_ratio": "1:1",
                "prompt_summary": prompt[:240],
                "current_prompt": prompt,
                "operation_type": operation_type.value,
                "status": Status.SUCCEEDED.value,
            },
        )

    @staticmethod
    def _first_image_url(response: Any) -> str:
        data = getattr(response, "data", None)
        if not data:
            raise ModelArkProviderError("character image generation returned no data")
        url = getattr(data[0], "url", None)
        if not isinstance(url, str) or not url.strip():
            raise ModelArkProviderError("character image generation returned no URL")
        return url.strip()

    @classmethod
    def _parse_layer_decomposition_response(
        cls,
        response: Any,
        *,
        width: int,
        height: int,
    ) -> LayerDecompositionResult:
        data = cls._value(response, "data")
        if not isinstance(data, (list, tuple)) or not data:
            raise ModelArkProviderError(
                "layer decomposition returned no data",
                phase="layer_decomposition_parse",
            )
        parsed: list[dict[str, object]] = []
        for raw in data:
            z_index = cls._value(raw, "z_index")
            url = cls._value(raw, "url")
            if (
                type(z_index) is not int
                or not isinstance(url, str)
                or not url.strip().startswith(("http://", "https://"))
            ):
                raise ModelArkProviderError(
                    "layer decomposition item is missing z_index or url",
                    phase="layer_decomposition_parse",
                )
            item: dict[str, object] = {
                "z_index": z_index,
                "url": url.strip(),
            }
            if z_index != 0:
                name = cls._value(raw, "name")
                description = cls._value(raw, "description")
                bounding_box = cls._value(raw, "bounding_box")
                absolute = cls._value(bounding_box, "absolute")
                normalized = cls._value(bounding_box, "normalized")
                item.update(
                    name=name,
                    description=description,
                    bbox_absolute=cls._validate_response_bbox(
                        absolute,
                        maximum_x=width,
                        maximum_y=height,
                        label="absolute",
                    ),
                    bbox_normalized=cls._validate_response_bbox(
                        normalized,
                        maximum_x=1000,
                        maximum_y=1000,
                        label="normalized",
                    ),
                )
            parsed.append(item)

        indexes = [int(item["z_index"]) for item in parsed]
        if indexes[0] != 0 or indexes.count(0) != 1:
            raise ModelArkProviderError(
                "layer decomposition requires the first item to be the unique base",
                phase="layer_decomposition_parse",
            )
        layer_items = parsed[1:]
        if not 1 <= len(layer_items) <= 16:
            raise ModelArkProviderError(
                "layer decomposition requires between 1 and 16 layers",
                phase="layer_decomposition_parse",
            )
        if indexes[1:] != list(range(1, len(layer_items) + 1)):
            raise ModelArkProviderError(
                "layer decomposition items must follow continuous z_index order",
                phase="layer_decomposition_parse",
            )
        try:
            layers = [
                DecomposedImageLayer.model_validate(item)
                for item in layer_items
            ]
        except ValidationError as exc:
            raise ModelArkProviderError(
                "layer decomposition response has invalid layer metadata",
                phase="layer_decomposition_parse",
            ) from exc
        return LayerDecompositionResult(
            base_url=str(parsed[0]["url"]),
            layers=layers,
        )

    @staticmethod
    def _validate_response_bbox(
        value: object,
        *,
        maximum_x: int,
        maximum_y: int,
        label: str,
    ) -> tuple[int, int, int, int]:
        if (
            not isinstance(value, (list, tuple))
            or len(value) != 4
            or any(type(coordinate) is not int for coordinate in value)
        ):
            raise ModelArkProviderError(
                f"layer decomposition {label} bbox must contain four integers",
                phase="layer_decomposition_parse",
            )
        x1, y1, x2, y2 = value
        if not (0 <= x1 < x2 <= maximum_x and 0 <= y1 < y2 <= maximum_y):
            raise ModelArkProviderError(
                f"layer decomposition {label} bbox is out of bounds",
                phase="layer_decomposition_parse",
            )
        return x1, y1, x2, y2

    @staticmethod
    def _value(value: object, key: str) -> object:
        if isinstance(value, dict):
            return value.get(key)
        return getattr(value, key, None)

    @staticmethod
    def _chat_output_text(response: Any) -> str:
        choices = getattr(response, "choices", None)
        if not choices:
            raise ModelArkTextParseError("text generation returned no choices")
        message = getattr(choices[0], "message", None)
        content = getattr(message, "content", None)
        if not isinstance(content, str) or not content.strip():
            raise ModelArkTextParseError("text generation returned empty content")
        return content.strip()

    @staticmethod
    def _response_output_text(response: Any) -> str:
        output = getattr(response, "output", None)
        if not output:
            raise ModelArkTextParseError("text generation returned no output")

        parts: list[str] = []
        for item in output:
            for content in getattr(item, "content", []) or []:
                text = getattr(content, "text", None)
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())

        text = "\n".join(parts).strip()
        if not text:
            raise ModelArkTextParseError("text generation returned empty output")
        return text

    @staticmethod
    def _parse_text_payload(text: str) -> TextGenerationPayload:
        stripped = text.strip()
        fence_match = re.search(r"```(?:json)?\s*(.*?)```", stripped, flags=re.DOTALL)
        if fence_match:
            stripped = fence_match.group(1).strip()
        try:
            raw = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ModelArkTextParseError(
                "text generation response is not valid JSON"
            ) from exc
        if not isinstance(raw, dict):
            raise ModelArkTextParseError(
                "text generation response must be a JSON object"
            )
        return TextGenerationPayload.model_validate(raw)

    @staticmethod
    def _parse_character_payload(text: str) -> CharacterExtractionPayload:
        stripped = text.strip()
        fence_match = re.search(r"```(?:json)?\s*(.*?)```", stripped, flags=re.DOTALL)
        if fence_match:
            stripped = fence_match.group(1).strip()
        try:
            raw = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ModelArkTextParseError(
                "character extraction response is not valid JSON"
            ) from exc
        if not isinstance(raw, dict):
            raise ModelArkTextParseError(
                "character extraction response must be a JSON object"
            )
        return CharacterExtractionPayload.model_validate(raw)

    @staticmethod
    def _parse_video_prompt_optimization_payload(
        text: str,
    ) -> VideoPromptOptimizationResult:
        stripped = text.strip()
        fence_match = re.search(r"```(?:json)?\s*(.*?)```", stripped, flags=re.DOTALL)
        if fence_match:
            stripped = fence_match.group(1).strip()
        try:
            raw = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ModelArkTextParseError(
                "video prompt optimization response is not valid JSON"
            ) from exc
        if not isinstance(raw, dict):
            raise ModelArkTextParseError(
                "video prompt optimization response must be a JSON object"
            )
        try:
            return VideoPromptOptimizationResult.model_validate(raw)
        except ValidationError as exc:
            raise ModelArkTextParseError(
                "video prompt optimization response has an invalid structure"
            ) from exc

    @staticmethod
    def _parse_aigc_image_prompt_optimization_payload(
        text: str,
    ) -> AigcImagePromptOptimizationResult:
        stripped = text.strip()
        fence_match = re.search(r"```(?:json)?\s*(.*?)```", stripped, flags=re.DOTALL)
        if fence_match:
            stripped = fence_match.group(1).strip()
        try:
            raw = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ModelArkTextParseError(
                "AIGC image prompt optimization response is not valid JSON"
            ) from exc
        if not isinstance(raw, dict):
            raise ModelArkTextParseError(
                "AIGC image prompt optimization response must be a JSON object"
            )
        try:
            return AigcImagePromptOptimizationResult.model_validate(raw)
        except ValidationError as exc:
            raise ModelArkTextParseError(
                "AIGC image prompt optimization response has an invalid structure"
            ) from exc

    @staticmethod
    def _plain_text_output(text: str) -> str:
        stripped = text.strip()
        fence_match = re.fullmatch(
            r"```(?:text|markdown)?\s*(.*?)```",
            stripped,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if fence_match:
            stripped = fence_match.group(1).strip()
        if not stripped:
            raise ModelArkTextParseError(
                "image prompt generation returned empty text"
            )
        return stripped


class MockModelArkAdapter:
    """Deterministic local ModelArk adapter for tests and frontend integration."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    async def generate_text(
        self,
        request: TextGenerationRequest,
    ) -> GeneratedTextResult:
        if request.stage not in TEXT_GENERATION_STAGES:
            raise ValueError(f"Unsupported text generation stage: {request.stage}")

        if request.stage == Stage.STORY:
            return self._generate_story(request)
        if request.stage == Stage.SCRIPT:
            return self._generate_script(request)
        return self._generate_storyboard(request)

    async def generate_aigc_text(
        self,
        request: AigcTextGenerationRequest,
    ) -> str:
        digest = hashlib.sha256(
            json.dumps(
                request.model_dump(mode="json"),
                sort_keys=True,
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()[:12]
        return f"{request.prompt.strip()}\n\n[mock:{digest}]"

    async def generate_image_prompt(
        self,
        request: ImagePromptGenerationRequest,
    ) -> ImagePromptSuggestion:
        brief = request.brief
        product = brief.product_name or (
            "Brief 中描述的主体"
            if brief.target_language == TargetLanguage.ZH
            else "the subject described in the brief"
        )
        selling_points = "、".join(brief.selling_points)
        visible_copies = [
            point.replace('"', "").strip()
            for point in brief.selling_points[:4]
            if point.replace('"', "").strip()
        ]
        if brief.target_language == TargetLanguage.EN:
            purpose = (
                brief.image_purpose.value
                if brief.image_purpose
                else "commercial"
            )
            details = [
                f"Create a polished {purpose} image of {product}.",
                (
                    f"Use a clear focal composition for {brief.target_platform} "
                    f"in {brief.aspect_ratio}."
                ),
                (
                    "Render realistic materials, controlled studio lighting, "
                    "a cohesive color palette, and production-ready commercial "
                    "photography."
                ),
            ]
            if brief.audience:
                details.append(f"Shape the visual tone for {brief.audience}.")
            if brief.style:
                details.append(f"Visual style: {brief.style}.")
            if brief.selling_points:
                details.append(
                    "Show only these supplied benefits: "
                    f"{', '.join(brief.selling_points)}."
                )
                if visible_copies:
                    details.append(
                        "Add clear visible selling-point copy with strong contrast: "
                        + ", ".join(f'"{copy}"' for copy in visible_copies)
                        + "."
                    )
            if request.current_prompt:
                details.append(
                    "Refine while preserving this draft: "
                    f"{request.current_prompt.strip()}"
                )
        else:
            purpose = {
                "ecommerce_main": "电商主图",
                "poster": "海报",
            }.get(
                brief.image_purpose.value if brief.image_purpose else "",
                "商业图片",
            )
            details = [
                f"为{product}创作精致的{purpose}，主体清晰突出。",
                (
                    f"采用适合{brief.target_platform}的视觉构图，"
                    f"画面比例{brief.aspect_ratio}。"
                ),
                (
                    "呈现真实材质、可控商业摄影光线、统一色彩与专业"
                    "成片质感。"
                ),
            ]
            if brief.audience:
                details.append(f"视觉调性面向{brief.audience}。")
            if brief.style:
                details.append(f"视觉风格：{brief.style}。")
            if selling_points:
                details.append(f"仅表现已提供卖点：{selling_points}。")
                if visible_copies:
                    details.append(
                        "画面加入清晰易读、对比鲜明的卖点文案："
                        + "、".join(f'"{copy}"' for copy in visible_copies)
                        + "。"
                    )
            if request.current_prompt:
                details.append(
                    "在保留以下草稿事实的基础上优化："
                    f"{request.current_prompt.strip()}"
                )
        return ImagePromptSuggestion(
            prompt=" ".join(details),
            model=self.settings.ark_text_model,
        )

    async def stream_text(
        self,
        request: TextGenerationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        result = await self.generate_text(request)
        for start in range(0, len(result.content), 16):
            await asyncio.sleep(0)
            yield ModelArkStreamEvent(
                kind="delta",
                delta=result.content[start : start + 16],
            )
        yield ModelArkStreamEvent(kind="completed", result=result)

    async def optimize_video_prompt(
        self,
        request: VideoPromptOptimizationRequest,
    ) -> VideoPromptOptimizationResult:
        if request.brief.target_language == TargetLanguage.EN:
            enhancement = (
                "Optimization enhancement: clarify shot size, camera position, "
                "camera movement, action continuity, blocking, pacing, and "
                "transitions while keeping subject identity, appearance, product, "
                "setting, and spatial relationships continuous and generatable."
            )
            marker = "[Continuous Timeline]"
        else:
            enhancement = (
                "优化增强：明确景别、机位、运镜、动作衔接、镜头调度、节奏与转场，"
                "保持主体身份、外形、商品、场景和空间关系连续且可生成。"
            )
            marker = "【连续时间轴】"
        optimized = request.baseline_prompt.replace(
            marker,
            f"{enhancement}\n\n{marker}",
            1,
        )
        return VideoPromptOptimizationResult(optimized_prompt=optimized)

    async def optimize_tool_video_prompt(
        self,
        request: ToolVideoPromptOptimizationRequest,
    ) -> VideoPromptOptimizationResult:
        references: list[str] = []
        for label, count in (
            ("视频", request.reference_video_count),
            ("图片", request.reference_image_count),
            ("音频", request.reference_audio_count),
        ):
            if count > 0:
                references.append(
                    "、".join(f"{label}{index}" for index in range(1, count + 1))
                )
        reference_line = (
            "；".join(references) if references else "无参考素材，仅基于文本进行编辑"
        )
        optimized = "\n".join(
            [
                f"编辑任务：{request.prompt}",
                "【编辑要求】",
                "1. 明确需要修改的范围与内容，可配合时间戳（如“4-6 秒”）进行部分编辑。",
                "2. 尽可能说明修改内容从 A→B 的过程，未被要求修改的内容保持不变。",
                f"3. 可引用的标准素材编号：{reference_line}。",
            ]
        )
        optimized = optimized[:12000]
        return VideoPromptOptimizationResult(optimized_prompt=optimized)

    async def optimize_aigc_image_prompt(
        self,
        request: AigcImagePromptOptimizationRequest,
    ) -> AigcImagePromptOptimizationResult:
        suffix = "，主体明确，场景完整，构图与光影清晰，保持用户指定内容不变"

        def enhance(value: str, limit: int) -> str:
            stripped = value.strip()
            if not stripped:
                return ""
            return f"{stripped}{suffix}"[:limit]

        return AigcImagePromptOptimizationResult(
            optimized_text=enhance(request.text, 20000),
            optimized_reference_instructions=[
                enhance(value, 4000) for value in request.reference_instructions
            ],
        )

    async def stream_video_prompt_optimization(
        self,
        request: VideoPromptOptimizationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        result = await self.optimize_video_prompt(request)
        for start in range(0, len(result.optimized_prompt), 16):
            await asyncio.sleep(0)
            yield ModelArkStreamEvent(
                kind="delta",
                delta=result.optimized_prompt[start : start + 16],
            )
        yield ModelArkStreamEvent(kind="completed", result=result)

    async def generate_image(
        self,
        request: ImageGenerationRequest,
    ) -> GeneratedAssetResult:
        slug = self._slug(request.project_id)
        shot_index = request.shot.index
        return GeneratedAssetResult(
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.IMAGE,
            url=f"mock://modelark/{slug}/images/shot-{shot_index:02d}.png",
            mime_type="image/png",
            metadata={
                "model": self.settings.ark_image_model,
                "provider": "mock-modelark",
                "shot_index": shot_index,
                "aspect_ratio": request.aspect_ratio,
                "source_prompt": request.shot.visual_prompt,
                "status": Status.SUCCEEDED.value,
            },
        )

    async def generate_project_image(
        self,
        request: ProjectImageGenerationRequest,
    ) -> GeneratedAssetResult:
        digest = hashlib.sha256(
            json.dumps(
                request.model_dump(mode="json"),
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()[:20]
        extension = request.output_format.value
        mime_type = (
            "image/png"
            if request.output_format == ImageOutputFormat.PNG
            else "image/jpeg"
        )
        return GeneratedAssetResult(
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.IMAGE,
            url=(
                f"mock://modelark/{self._slug(request.project_id)}/"
                f"project-images/{digest}.{extension}"
            ),
            mime_type=mime_type,
            metadata={
                "model": request.model,
                "provider": "mock-modelark",
                "operation": request.operation.value,
                "size": request.size.value,
                "format": request.output_format.value,
                "status": Status.SUCCEEDED.value,
            },
        )

    @staticmethod
    def build_image_prompt_messages(
        request: ImagePromptGenerationRequest,
    ) -> tuple[str, str]:
        language = request.brief.target_language
        length_limit = (
            "不超过 300 个中文字符"
            if language == TargetLanguage.ZH
            else "no more than 600 English words"
        )
        system_prompt = (
            "You are an expert commercial image prompt writer. Return only one "
            "prompt that can be sent directly to an image generation model. Do "
            "not include explanations, headings, Markdown, JSON, or code fences. "
            "Use only facts supplied in the brief and current draft; never invent "
            "product specifications, benefits, certifications, prices, or brand "
            "claims. Describe the subject, composition, background, lighting, "
            "materials, colors, commercial style, and aspect ratio. When visible "
            "selling-point copy benefits the composition, select up to four supplied "
            "selling points and polish their wording without adding any new facts; "
            "the prompt may also contain no visible copy. Wrap each exact piece of "
            'visible copy in paired ASCII double quotes ("copy"). When copy is used, '
            "describe its hierarchy, placement, readability, contrast, and visual "
            "integration. Do not request any other captions, subtitles, labels, "
            "badges, prices, logos, certifications, calls to action, or visible "
            "text. If a current draft is supplied, preserve its factual and "
            "composition intent while repairing or adding compliant quoted copy. "
            f"Write in {'Chinese' if language == TargetLanguage.ZH else 'English'} "
            f"and keep the result {length_limit}."
        )
        brief = request.brief
        user_prompt = json.dumps(
            {
                "project_id": request.project_id,
                "brief": {
                    "product_name": brief.product_name,
                    "selling_points": brief.selling_points,
                    "audience": brief.audience,
                    "advertising_requirement": brief.prompt,
                    "image_purpose": (
                        brief.image_purpose.value if brief.image_purpose else None
                    ),
                    "target_platform": brief.target_platform,
                    "aspect_ratio": brief.aspect_ratio,
                    "style": brief.style,
                    "language": brief.target_language.value,
                },
                "current_prompt": request.current_prompt,
                "task": (
                    "Optimize the current prompt without losing supplied facts."
                    if request.current_prompt
                    else "Create a new prompt from the supplied brief."
                ),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        return system_prompt, user_prompt

    async def decompose_image_layers(
        self,
        request: LayerDecompositionRequest,
    ) -> LayerDecompositionResult:
        digest = hashlib.sha256(
            json.dumps(
                request.model_dump(mode="json"),
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()[:20]
        prefix = (
            f"mock://modelark/{self._slug(request.project_id)}/"
            f"layer-decompositions/{digest}"
        )
        return LayerDecompositionResult(
            base_url=f"{prefix}/base.{request.output_format.value}",
            layers=[
                DecomposedImageLayer(
                    z_index=1,
                    url=f"{prefix}/layer-01.png",
                    name="Foreground",
                    description="Deterministic mock foreground layer",
                    bbox_absolute=(
                        0,
                        0,
                        request.canvas_width,
                        request.canvas_height,
                    ),
                    bbox_normalized=(0, 0, 1000, 1000),
                )
            ],
        )

    async def generate_characters(
        self,
        request: CharacterGenerationRequest,
    ) -> list[GeneratedCharacterCardResult]:
        names = self._extract_character_names(request.story_content)
        if not names:
            raise ModelArkTextParseError("character extraction returned no characters")
        characters = []
        for index, source_name in enumerate(names, start=1):
            name = self._localized_character_name(
                source_name,
                request.brief.target_language,
                index,
            )
            characters.append(
                GeneratedCharacterCardResult(
                    name=name,
                    description=self._character_description(
                        name,
                        request.brief,
                        request.story_content,
                    ),
                    sort_order=index,
                )
            )
        return characters

    async def edit_character_image(
        self,
        request: CharacterImageEditRequest,
    ) -> GeneratedAssetResult:
        slug = self._slug(request.project_id)
        return GeneratedAssetResult(
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.CHARACTER,
            url=f"mock://modelark/{slug}/characters/edited.png",
            mime_type="image/png",
            metadata={
                "model": self.settings.ark_image_model,
                "provider": "mock-modelark",
                "aspect_ratio": "1:1",
                "current_prompt": request.prompt,
                "operation_type": CharacterAssetIterationOperation.EDIT.value,
                "status": Status.SUCCEEDED.value,
            },
        )

    async def regenerate_character_image(
        self,
        request: CharacterImageRegenerateRequest,
    ) -> GeneratedAssetResult:
        slug = self._slug(request.project_id)
        return GeneratedAssetResult(
            type=AssetType.GENERATED_IMAGE,
            stage=Stage.CHARACTER,
            url=f"mock://modelark/{slug}/characters/regenerated.png",
            mime_type="image/png",
            metadata={
                "model": self.settings.ark_image_model,
                "provider": "mock-modelark",
                "aspect_ratio": "1:1",
                "current_prompt": request.prompt,
                "operation_type": CharacterAssetIterationOperation.REGENERATE.value,
                "status": Status.SUCCEEDED.value,
            },
        )

    async def generate_video(
        self,
        request: VideoGenerationRequest,
    ) -> GeneratedAssetResult:
        slug = self._slug(request.project_id)
        shot_index = request.shot.index
        return GeneratedAssetResult(
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            url=f"mock://modelark/{slug}/videos/shot-{shot_index:02d}.mp4",
            mime_type="video/mp4",
            metadata={
                "model": self.settings.ark_video_model,
                "provider": "mock-modelark",
                "shot_index": shot_index,
                "duration_seconds": request.shot.duration_seconds,
                "aspect_ratio": request.aspect_ratio,
                "source_image_url": request.image_url,
                "motion_prompt": request.video_prompt or request.shot.description,
                "reference_image_count": len(request.reference_image_urls),
                "reference_video_count": len(request.reference_video_urls),
                "reference_audio_count": len(request.reference_audio_urls),
                "brief_summary": request.brief_summary,
                "status": Status.SUCCEEDED.value,
            },
        )

    async def generate_tool_video(
        self,
        request: ToolVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        return await self.generate_seedance_video(_seedance_request_from_tool(request))

    async def generate_seedance_video(
        self,
        request: SeedanceVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        digest = hashlib.sha256(
            request.model_dump_json().encode("utf-8")
        ).hexdigest()[:20]
        return GeneratedAssetResult(
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            url=f"mock://modelark/tools/videos/{digest}.mp4",
            mime_type="video/mp4",
            metadata=_seedance_metadata(
                request,
                provider="mock-modelark",
                provider_task_id=f"mock-seedance-{digest}",
                provider_request_id=f"mock-request-{digest}",
            ),
        )

    async def edit_video(
        self,
        request: VideoEditRequest,
    ) -> GeneratedAssetResult:
        slug = self._slug(request.project_id)
        return GeneratedAssetResult(
            type=AssetType.STORYBOARD_VIDEO,
            stage=Stage.VIDEO,
            url=(
                f"mock://modelark/{slug}/videos/"
                f"shot-{request.shot.index:02d}-edited.mp4"
            ),
            mime_type="video/mp4",
            metadata={
                "model": self.settings.ark_video_model,
                "provider": "mock-modelark",
                "shot_index": request.shot.index,
                "duration_seconds": request.shot.duration_seconds,
                "aspect_ratio": request.aspect_ratio,
                "operation": "video_edit",
                "edit_prompt": request.prompt,
                "status": Status.SUCCEEDED.value,
            },
        )

    def _generate_story(self, request: TextGenerationRequest) -> GeneratedTextResult:
        brief = request.brief
        product = self._product_name(brief)
        style = self._style(brief)
        audience = brief.audience or "高意向用户"
        protagonist = "小微店主" if "business" in audience.lower() else "真实用户"
        title = f"{product}的{style}广告故事"
        content = "\n".join(
            [
                f"# {title}",
                "",
                f"目标平台：{brief.target_platform}",
                f"核心受众：{audience}",
                f"主角：{protagonist}正在为「{brief.prompt}」寻找更高效的解决方式。",
                f"广告主张：用{style}方式呈现{product}，回应「{brief.prompt}」。",
                "",
                "故事结构：",
                "1. 开场用真实使用场景建立痛点。",
                f"2. 中段让{product}自然介入，突出稳定、直观、可复用的卖点。",
                "3. 结尾给出清晰行动号召，形成可转化的短视频闭环。",
            ]
        )
        return GeneratedTextResult(
            stage=Stage.STORY,
            title=title,
            content=content,
            metadata={
                "model": self.settings.ark_text_model,
                "provider": "mock-modelark",
                "artifact_kind": Stage.STORY.value,
            },
        )

    def _generate_script(self, request: TextGenerationRequest) -> GeneratedTextResult:
        if request.brief.target_language == TargetLanguage.EN:
            return self._generate_english_script(request)
        brief = request.brief
        product = self._product_name(brief)
        style = self._style(brief)
        audience = brief.audience or "高意向目标用户"
        story_excerpt = self._excerpt(
            request.upstream_content,
            fallback="未提供上游故事",
        )
        selling_points = (
            "、".join(brief.selling_points)
            if brief.selling_points
            else "核心卖点"
        )
        title = f"{product} {brief.duration_seconds}秒广告剧本"
        content = "\n".join(
            [
                f"# {title}",
                "",
                "## Brief 约束",
                f"- 商品：{product}",
                f"- 平台：{brief.target_platform}",
                f"- 比例：{brief.aspect_ratio}",
                f"- 时长：{brief.duration_seconds}s",
                f"- 风格：{style}",
                f"- 受众：{audience}",
                f"- 卖点：{selling_points}",
                "",
                "## 故事依据",
                story_excerpt,
                "",
                "## 场次 1｜痛点开场",
                (
                    f"- 画面描述：{brief.target_platform} {brief.aspect_ratio} "
                    f"画幅中，{audience}进入真实使用场景，呼应故事里的核心矛盾。"
                ),
                (
                    f"- 人物动作：主角停顿、皱眉、快速查看现有方案，"
                    f"表现「{brief.prompt}」带来的压力。"
                ),
                f"- 台词/旁白：你是否也遇到过这样的时刻，想把事情做快，却总被复杂步骤拖住？",
                f"- 商品露出：先不硬露出，只用场景中的问题为{product}埋钩子。",
                "- 节奏说明：前段用快切建立问题，镜头停留在主角表情上形成共鸣。",
                f"- 转化号召：继续看，找到更适合{audience}的解决方式。",
                "",
                "## 场次 2｜产品介入",
                (
                    f"- 画面描述：{product}以{style}视觉自然出现，"
                    "界面、包装或使用动作清晰占据画面中心。"
                ),
                f"- 人物动作：主角开始使用{product}，从迟疑转为顺畅操作。",
                f"- 台词/旁白：{product}把关键步骤整理成清楚路径，让第一次尝试也能马上上手。",
                f"- 商品露出：展示商品名称、关键功能和「{selling_points}」相关利益点。",
                "- 节奏说明：从问题切到解决方案，节奏由紧张转为稳定。",
                f"- 转化号召：现在记住{product}，把复杂流程先交给它。",
                "",
                "## 场次 3｜效果证明",
                f"- 画面描述：延续故事结果，用前后对比展示{product}带来的效率、体验或成果变化。",
                "- 人物动作：主角完成任务后松一口气，并向镜头展示结果。",
                f"- 台词/旁白：从临时应付到稳定复用，{product}让结果更可控。",
                f"- 商品露出：商品与成果同框，强调{brief.target_platform}用户能直接理解的价值。",
                "- 节奏说明：用对比镜头和结果特写建立可信度。",
                f"- 转化号召：如果你也是{audience}，现在就可以开始尝试。",
                "",
                "## 场次 4｜品牌收束",
                f"- 画面描述：{brief.aspect_ratio} 终帧突出{product}品牌、核心利益点和明确按钮。",
                "- 人物动作：主角面向镜头确认选择，动作简洁有记忆点。",
                f"- 台词/旁白：现在就试试{product}，让好创意更快落地。",
                f"- 商品露出：完整展示{product}名称、核心卖点和品牌视觉。",
                f"- 节奏说明：最后 3 秒收束为强 CTA，适配 {brief.duration_seconds}s 总时长。",
                f"- 转化号召：立即体验{product}。",
            ]
        )
        return GeneratedTextResult(
            stage=Stage.SCRIPT,
            title=title,
            content=content,
            metadata={
                "model": self.settings.ark_text_model,
                "provider": "mock-modelark",
                "artifact_kind": Stage.SCRIPT.value,
                "has_upstream": bool(request.upstream_content),
                "prompt_summary": self.build_script_prompt(request)[:240],
            },
        )

    def _generate_english_script(
        self,
        request: TextGenerationRequest,
    ) -> GeneratedTextResult:
        brief = request.brief
        product = self._product_name(brief)
        style = self._english_value(brief.style, "brief-aligned commercial")
        audience = self._english_value(
            brief.audience,
            "high-intent target customers",
        )
        story_excerpt = self._english_source_excerpt(
            request.upstream_content,
            fallback="No upstream story was provided.",
        )
        selling_points = (
            ", ".join(
                point
                for point in brief.selling_points
                if not self._contains_han(point)
            )
            or "the core product benefits"
        )
        title = f"{product} {brief.duration_seconds}-Second Ad Script"
        content = "\n".join(
            [
                f"# {title}",
                "",
                "## Brief Constraints",
                f"- Product: {product}",
                f"- Platform: {brief.target_platform}",
                f"- Aspect Ratio: {brief.aspect_ratio}",
                f"- Duration: {brief.duration_seconds}s",
                f"- Style: {style}",
                f"- Audience: {audience}",
                f"- Selling Points: {selling_points}",
                "",
                "## Story Basis",
                story_excerpt,
                "",
                "## Scene 1 | Problem Hook",
                (
                    f"- Visual Description: In a {brief.target_platform} "
                    f"{brief.aspect_ratio} frame, the target customer enters a "
                    "realistic use case that establishes the story's core problem."
                ),
                "- Character Action: The protagonist pauses, checks the current "
                "solution, and reacts to the inefficient process.",
                "- Dialogue / Voice-over: Have you ever needed a faster result, "
                "only to be slowed down by unnecessary steps?",
                f"- Product Placement: Build curiosity before revealing {product}.",
                "- Pacing: Use quick cuts to establish the problem, then hold on "
                "the protagonist for recognition.",
                "- Call to Action: Keep watching for a clearer solution.",
                "",
                "## Scene 2 | Product Introduction",
                f"- Visual Description: {product} enters naturally in a {style} presentation.",
                f"- Character Action: The protagonist starts using {product} and "
                "moves from hesitation to a smooth workflow.",
                f"- Dialogue / Voice-over: {product} turns the key steps into a "
                "clear path that is easy to start.",
                f"- Product Placement: Show {product} and benefits related to {selling_points}.",
                "- Pacing: Shift from tension to a stable, confident rhythm.",
                f"- Call to Action: Remember {product} and simplify the process now.",
                "",
                "## Scene 3 | Proof of Benefit",
                f"- Visual Description: Show a clear before-and-after result created with {product}.",
                "- Character Action: The protagonist completes the task and presents the result.",
                f"- Dialogue / Voice-over: {product} makes repeatable results easier to control.",
                f"- Product Placement: Keep {product} in frame with the finished result.",
                "- Pacing: Use comparison shots and a result close-up to build trust.",
                "- Call to Action: Start improving your own workflow today.",
                "",
                "## Scene 4 | Brand Close",
                f"- Visual Description: End on a {brief.aspect_ratio} brand frame for {product}.",
                "- Character Action: The protagonist faces the camera and confirms the choice.",
                f"- Dialogue / Voice-over: Try {product} now and turn good ideas into results faster.",
                f"- Product Placement: Show the complete {product} identity and core benefit.",
                f"- Pacing: Resolve into a strong call to action within {brief.duration_seconds}s.",
                f"- Call to Action: Try {product} now.",
            ]
        )
        return GeneratedTextResult(
            stage=Stage.SCRIPT,
            title=title,
            content=content,
            metadata={
                "model": self.settings.ark_text_model,
                "provider": "mock-modelark",
                "artifact_kind": Stage.SCRIPT.value,
                "has_upstream": bool(request.upstream_content),
                "prompt_summary": self.build_script_prompt(request)[:240],
            },
        )

    def _generate_storyboard(self, request: TextGenerationRequest) -> GeneratedTextResult:
        if request.brief.target_language == TargetLanguage.EN:
            return self._generate_english_storyboard(request)
        brief = request.brief
        product = self._product_name(brief)
        style = self._style(brief)
        audience = brief.audience or "高意向目标用户"
        script_excerpt = self._excerpt(
            request.upstream_content,
            fallback="缺少剧本正文",
            limit=520,
        )
        durations = self._storyboard_durations(brief.duration_seconds, 4)
        shots = [
            StoryboardShotCreate(
                project_id=request.project_id,
                index=1,
                title="痛点开场",
                description=(
                    f"主体/场景：{audience}在{brief.target_platform} {brief.aspect_ratio}"
                    f"真实场景中遇到需求「{brief.prompt}」。剧本依据：{script_excerpt}"
                    "。运镜：手持跟拍到表情特写；音效/转场：环境声叠加轻微停顿。"
                ),
                visual_prompt=(
                    f"{style}广告开场，{brief.aspect_ratio}画幅，"
                    f"{product}面向{audience}的真实用户场景，"
                    "手持镜头缓慢推近，光线干净自然"
                ),
                narration=f"旁白：你是否也想更快完成：{brief.prompt}？",
                duration_seconds=durations[0],
                status=Status.DRAFT,
            ),
            StoryboardShotCreate(
                project_id=request.project_id,
                index=2,
                title="产品介入",
                description=(
                    f"主体/场景：{product}自然进入画面，承接剧本中的解决方案段落。"
                    f"商品露出需清晰体现{product}和{brief.target_platform}用户能理解的利益点。"
                    "运镜：从操作手部平移到产品/界面中心；音效/转场：提示音接顺滑擦除转场。"
                ),
                visual_prompt=(
                    f"{style}商品揭示镜头，突出{product}，主体构图集中，"
                    f"{brief.aspect_ratio}画幅，向{audience}清晰呈现核心利益点"
                ),
                narration=f"旁白：{product}让复杂步骤变得清楚。",
                duration_seconds=durations[1],
                status=Status.DRAFT,
            ),
            StoryboardShotCreate(
                project_id=request.project_id,
                index=3,
                title="效果证明",
                description=(
                    "主体/场景：延续剧本中的人物动作和结果证明，用前后对比展示效率、体验和成果提升。"
                    f"需保持{style}视觉，并面向{audience}强化可信结果。"
                    "运镜：左右对比切分后推近结果特写；音效/转场：节奏鼓点加对比闪切。"
                ),
                visual_prompt=(
                    f"{style}前后效果对比，用户获得满意结果，"
                    f"成果真实可信，短视频广告质感，{brief.aspect_ratio}画幅"
                ),
                narration=f"旁白：从尝试到复用，{product}让每一步都更省心。",
                duration_seconds=durations[2],
                status=Status.DRAFT,
            ),
            StoryboardShotCreate(
                project_id=request.project_id,
                index=4,
                title="行动号召",
                description=(
                    f"主体/场景：{product}品牌终帧、核心卖点和明确 CTA 同屏，完成剧本转化号召。"
                    f"适配{brief.target_platform}、{brief.aspect_ratio}和{brief.duration_seconds}s总时长。"
                    "运镜：稳定定格到品牌按钮；音效/转场：收束音效后干净淡出。"
                ),
                visual_prompt=(
                    f"{style}品牌收束镜头，突出{product}和行动号召，"
                    f"{brief.aspect_ratio}画幅，精致品牌视觉构图"
                ),
                narration=f"旁白：现在就试试{product}。",
                duration_seconds=durations[3],
                status=Status.DRAFT,
            ),
        ]
        content = "\n".join(
            [
                f"# {product} 分镜脚本",
                "",
                "## Brief 约束",
                f"- 商品：{product}",
                f"- 平台：{brief.target_platform}",
                f"- 比例：{brief.aspect_ratio}",
                f"- 总时长：{brief.duration_seconds}s",
                f"- 风格：{style}",
                f"- 受众：{audience}",
                "",
                "## 剧本依据",
                script_excerpt,
                "",
                "## 镜头列表",
                *[
                    (
                        f"{shot.index}. {shot.title}｜{shot.duration_seconds}s｜"
                        f"{shot.description}｜{shot.narration}｜"
                        f"视觉提示：{shot.visual_prompt}"
                    )
                    for shot in shots
                ],
            ]
        )
        return GeneratedTextResult(
            stage=Stage.STORYBOARD,
            title=f"{product} 分镜脚本",
            content=content,
            storyboard_shots=shots,
            metadata={
                "model": self.settings.ark_text_model,
                "provider": "mock-modelark",
                "artifact_kind": Stage.STORYBOARD.value,
                "shot_count": len(shots),
                "has_upstream": bool(request.upstream_content),
                "prompt_summary": self.build_storyboard_prompt(request)[:240],
            },
        )

    def _generate_english_storyboard(
        self,
        request: TextGenerationRequest,
    ) -> GeneratedTextResult:
        brief = request.brief
        product = self._product_name(brief)
        style = self._english_value(brief.style, "brief-aligned commercial")
        audience = self._english_value(
            brief.audience,
            "high-intent target customers",
        )
        script_excerpt = self._english_source_excerpt(
            request.upstream_content,
            fallback="No script content was provided.",
            limit=520,
        )
        durations = self._storyboard_durations(brief.duration_seconds, 4)
        shots = [
            StoryboardShotCreate(
                project_id=request.project_id,
                index=1,
                title="Problem Hook",
                description=(
                    f"Subject / Setting: Establish the target customer's problem "
                    f"in a realistic {brief.target_platform} {brief.aspect_ratio} "
                    f"commercial. Script basis: {script_excerpt} Camera: handheld "
                    "follow into an expression close-up. Sound / Transition: "
                    "natural ambience with a brief pause."
                ),
                visual_prompt=(
                    f"{style} opening for {product}, realistic customer scenario, "
                    f"{brief.aspect_ratio}, handheld push-in, clean lighting"
                ),
                narration="Voice-over: What if the result could be faster and simpler?",
                duration_seconds=durations[0],
                status=Status.DRAFT,
            ),
            StoryboardShotCreate(
                project_id=request.project_id,
                index=2,
                title="Product Introduction",
                description=(
                    f"Subject / Setting: {product} enters naturally as the solution. "
                    "Keep the product and its customer benefit clearly visible. "
                    "Camera: track from the user's hands to the product. "
                    "Sound / Transition: a clean cue into a smooth wipe."
                ),
                visual_prompt=(
                    f"{style} product reveal for {product}, focused composition, "
                    f"{brief.aspect_ratio}, clear customer benefit"
                ),
                narration=f"Voice-over: {product} makes every key step clear.",
                duration_seconds=durations[1],
                status=Status.DRAFT,
            ),
            StoryboardShotCreate(
                project_id=request.project_id,
                index=3,
                title="Benefit Proof",
                description=(
                    f"Subject / Setting: Show a credible before-and-after result "
                    f"for {audience}. Camera: split comparison followed by a result "
                    "close-up. Sound / Transition: rhythmic beat with a comparison cut."
                ),
                visual_prompt=(
                    f"{style} before-and-after comparison for {product}, satisfied "
                    f"customer, credible result, {brief.aspect_ratio}"
                ),
                narration=f"Voice-over: {product} makes repeatable results easier.",
                duration_seconds=durations[2],
                status=Status.DRAFT,
            ),
            StoryboardShotCreate(
                project_id=request.project_id,
                index=4,
                title="Call to Action",
                description=(
                    f"Subject / Setting: Finish with {product}, its core benefit, "
                    f"and a clear call to action, formatted for {brief.target_platform} "
                    f"and {brief.aspect_ratio}. Camera: stable final frame. "
                    "Sound / Transition: resolving cue and clean fade."
                ),
                visual_prompt=(
                    f"{style} final brand frame for {product}, call to action, "
                    f"{brief.aspect_ratio}, polished commercial composition"
                ),
                narration=f"Voice-over: Try {product} now.",
                duration_seconds=durations[3],
                status=Status.DRAFT,
            ),
        ]
        content = "\n".join(
            [
                f"# {product} Storyboard",
                "",
                "## Brief Constraints",
                f"- Product: {product}",
                f"- Platform: {brief.target_platform}",
                f"- Aspect Ratio: {brief.aspect_ratio}",
                f"- Total Duration: {brief.duration_seconds}s",
                f"- Style: {style}",
                f"- Audience: {audience}",
                "",
                "## Script Basis",
                script_excerpt,
                "",
                "## Shot List",
                *[
                    (
                        f"{shot.index}. {shot.title} | {shot.duration_seconds}s | "
                        f"{shot.description} | {shot.narration} | "
                        f"Visual Prompt: {shot.visual_prompt}"
                    )
                    for shot in shots
                ],
            ]
        )
        return GeneratedTextResult(
            stage=Stage.STORYBOARD,
            title=f"{product} Storyboard",
            content=content,
            storyboard_shots=shots,
            metadata={
                "model": self.settings.ark_text_model,
                "provider": "mock-modelark",
                "artifact_kind": Stage.STORYBOARD.value,
                "shot_count": len(shots),
                "has_upstream": bool(request.upstream_content),
                "prompt_summary": self.build_storyboard_prompt(request)[:240],
            },
        )

    @staticmethod
    def _product_name(brief: Brief) -> str:
        if brief.product_name:
            return brief.product_name
        return "Product" if brief.target_language == TargetLanguage.EN else "产品"

    @staticmethod
    def _style(brief: Brief) -> str:
        if brief.style:
            return brief.style
        return (
            "natural and realistic"
            if brief.target_language == TargetLanguage.EN
            else "真实自然"
        )

    @classmethod
    def build_text_prompt(cls, request: TextGenerationRequest) -> str:
        if request.stage == Stage.STORY:
            return cls.build_story_prompt(request)
        if request.stage == Stage.SCRIPT:
            return cls.build_script_prompt(request)
        if request.stage == Stage.STORYBOARD:
            return cls.build_storyboard_prompt(request)
        raise ValueError(f"Unsupported text generation stage: {request.stage}")

    @staticmethod
    def build_video_prompt_optimization_messages(
        request: VideoPromptOptimizationRequest,
    ) -> tuple[str, str]:
        if request.brief.target_language == TargetLanguage.EN:
            system_prompt = "\n".join(
                [
                    "You optimize Seedance 2.5 advertising video prompts.",
                    "Optimize only prompt structure and generatability; do not "
                    "creatively rewrite the content.",
                    "Preserve character identity and appearance, product, plot events, "
                    "dialogue meaning, call to action, shot duration, atomic timeline "
                    "boundaries, shot order, and reference relationships.",
                    "Only improve shot size, camera position and movement, action "
                    "continuity, blocking, pacing, transitions, subject consistency, "
                    "and generation constraints.",
                    "Output one JSON object containing only optimized_prompt.",
                    "optimized_prompt must be one complete prompt without explanations, "
                    "analysis, alternatives, or Markdown fences.",
                    "The prompt must contain [Overall Requirements], "
                    "[Continuous Timeline], [Voice], and [Negative Constraints] "
                    "exactly once and in that order.",
                    "Preserve every atomic shot's plot, visual intent, and narration "
                    "verbatim, with the exact supplied timeline ranges and no gaps, "
                    "overlaps, or reordering.",
                    "When narration exists, generate natural, clear English speech. "
                    "Otherwise retain only ambient and action sounds and add no dialogue.",
                    "Use only complete reference asset tokens listed in the input. Do "
                    "not infer asset content or invent indexes. Preserve parentheses "
                    "and @ in every token exactly.",
                    "Do not include subtitles, captions, or on-screen text instructions.",
                    "The result must not exceed 12000 characters.",
                ]
            )
            user_intro = [
                "Optimize the current draft using the authoritative backend context below.",
                "contract_baseline defines fixed sections and hard constraints; "
                "current_draft is the primary optimization input.",
            ]
        else:
            system_prompt = "\n".join(
                [
                    "你是 Seedance 2.5 广告视频提示词优化器。",
                    "只优化提示词结构和可生成性，不进行创意改写。",
                    "必须保持人物身份与外形、商品、剧情事件、台词含义、行动号召、"
                    "分镜时长、原子时间边界、镜头顺序和参考素材关系不变。",
                    "只增强景别、机位、运镜、动作连续性、镜头调度、节奏、转场、"
                    "主体一致性和生成约束。",
                    "输出必须是单个 JSON 对象，且只能包含 optimized_prompt 字段。",
                    "optimized_prompt 必须是完整提示词，不得输出解释、分析、多个候选或"
                    " Markdown 代码围栏。",
                    "完整提示词必须依次且仅一次包含【整体要求】、【连续时间轴】、"
                    "【语音】、【负向约束】。",
                    "必须逐字保留每个原子分镜的剧情、视觉意图和旁白文本，并严格保留"
                    "给定时间区间，不得产生空洞、重叠或调换。",
                    "有旁白时生成自然、清晰的普通话语音；无旁白时只保留环境音和动作音，"
                    "不新增对白。",
                    "只能使用输入中列出的参考素材完整 token，不得猜测素材内容或新增编号；"
                    "token 中的半角括号和 @ 必须原样保留，不得改回旧式引用。",
                    "不得包含字幕、画面文字或文案叠加指令。",
                    "结果不得超过 12000 字符。",
                ]
            )
            user_intro = [
                "请根据以下后端权威上下文优化当前草稿。",
                "contract_baseline 仅用于确认固定章节和硬约束；current_draft 是主要优化对象。",
            ]
        context = {
            "project_brief": request.brief.model_dump(mode="json"),
            "current_shot": request.shot.model_dump(mode="json"),
            "atomic_shots": [
                shot.model_dump(mode="json") for shot in request.atomic_shots
            ],
            "current_draft": request.video_prompt,
            "contract_baseline": request.baseline_prompt,
            "references": {
                "uses_first_frame": request.uses_first_frame,
                "uses_previous_shot_last_frame": (
                    request.uses_previous_shot_last_frame
                ),
                "asset_labels": request.reference_asset_labels,
            },
        }
        user_prompt = "\n".join(
            [
                *user_intro,
                json.dumps(
                    context,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ),
            ]
        )
        return system_prompt, user_prompt

    @staticmethod
    def build_tool_video_prompt_optimization_messages(
        request: ToolVideoPromptOptimizationRequest,
    ) -> tuple[str, str]:
        system_prompt = "\n".join(
            [
                "你是全模态参考生视频（Seedance）编辑类提示词优化器。",
                "只输出一个 JSON 对象 {\"optimized_prompt\": \"...\"}，"
                "不要 markdown 代码围栏、不要解释、不要多个候选。",
                "优化原则：明确需要修改的范围和内容，可配合时间戳（如“4-6 秒”）"
                "进行部分编辑；尽可能说明修改内容从 A→B 的过程；"
                "未被要求修改的内容保持不变。",
                "使用与工具一致的标准素材编号（视频1..N / 图片1..N / 音频1..N，"
                "编号数量由 reference_*_count 决定），不得臆造不存在的素材编号。",
                "示范写法（仅作参考，不要把示例写进结果）：",
                "示例1：仅编辑视频 1 中男人的台词，修改为“你不要过来啊”，"
                "口音调整为东北口音。",
                "示例2：把视频 1 中 4-6 秒男人喝咖啡的动作改变为拖地，其余内容不要变化。",
                "示例3：编辑任务：把视频 1 中右侧的亚洲女生改为图片 1 中的黑人女生。",
                "结果不得超过 12000 字符。",
            ]
        )
        context = {
            "current_draft": request.prompt,
            "reference_counts": {
                "reference_video_count": request.reference_video_count,
                "reference_image_count": request.reference_image_count,
                "reference_audio_count": request.reference_audio_count,
            },
        }
        user_prompt = "\n".join(
            [
                "请根据以下当前草稿和已选参考素材数量，优化为可直接使用的编辑类提示词。",
                json.dumps(
                    context,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ),
            ]
        )
        return system_prompt, user_prompt

    @staticmethod
    def build_aigc_image_prompt_optimization_messages(
        request: AigcImagePromptOptimizationRequest,
    ) -> tuple[str, str]:
        system_prompt = "\n".join(
            [
                "你是 Seedream 4.0-5.0 生图提示词优化器。",
                "只输出一个 JSON 对象，且只能包含 optimized_text 和 "
                "optimized_reference_instructions 两个字段；不得输出 Markdown、"
                "解释、分析过程或多个候选。",
                "optimized_reference_instructions 必须是字符串数组，长度和输入数组"
                "完全一致，逐项对应且不得合并、拆分或重排。",
                "使用简洁连贯的自然语言，避免关键词机械堆叠。",
                "文生图提示词应明确主体、行为、环境和用途，并按需补充风格、色彩、"
                "光影和构图；需要生成的画面文字必须放在双引号中。",
                "图生图提示词应明确参考对象、编辑动作、必须保持不变的内容；多图输入"
                "应明确不同参考图的替换、组合或风格迁移关系。",
                "必须保留用户明确表达的主体、品牌、产品、文字内容、数量、颜色、"
                "画幅和否定约束，不得新增用户未要求的品牌、文字、主体或创意目标。",
                "不得生成 <bbox>、<point> 或固定的图N标签；引用坐标与图片编号由系统"
                "在运行时编译。",
                "optimized_text 不得超过 20000 字符；每条引用说明不得超过 4000 字符。",
            ]
        )
        context = {
            "current_text": request.text,
            "reference_instructions": request.reference_instructions,
            "generation_modes": request.generation_modes,
            "reference_image_count": request.reference_image_count,
        }
        user_prompt = "\n".join(
            [
                "请在不改变用户意图和硬约束的前提下优化以下结构化生图提示词。",
                json.dumps(
                    context,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ),
            ]
        )
        return system_prompt, user_prompt

    @classmethod
    def build_character_extraction_prompt(
        cls,
        request: CharacterGenerationRequest,
    ) -> str:
        brief = request.brief
        product = cls._product_name(brief)
        style = cls._style(brief)
        story = cls._excerpt(
            request.story_content,
            fallback="",
            limit=2600,
        )
        if brief.target_language == TargetLanguage.EN:
            audience = brief.audience or "high-intent target customers"
            return "\n".join(
                [
                    "You are an advertising character designer. Extract only "
                    "characters who actually appear or are explicitly identified "
                    "in the upstream story, then create character cards.",
                    "",
                    "Required inputs:",
                    f"- Story: {story}",
                    f"- Product: {product}",
                    f"- Platform: {brief.target_platform}",
                    f"- Aspect ratio: {brief.aspect_ratio}",
                    f"- Style: {style}",
                    f"- Target audience: {audience}",
                    f"- Original requirement: {brief.prompt}",
                    "",
                    "Output requirements:",
                    "- Output JSON only. Do not use Markdown or reveal internal reasoning.",
                    "- The top-level JSON object must contain characters.",
                    "- characters must be an array whose length is determined "
                    "only by the concrete characters in the story.",
                    "- Do not invent fallback roles such as a brand ambassador, "
                    "target customer, narrator, viewer, or generic user group.",
                    "- If the story has no concrete extractable character, "
                    "characters must be an empty array.",
                    "- Every character object must contain name and description.",
                    "- Write name and description in English. Preserve proper "
                    "names, brand names, and product names exactly when needed.",
                    "- name must use the story's designation or a short readable "
                    "English name.",
                    "- description is an image-generation prompt for a character "
                    "design sheet and must describe only the human or animal character.",
                    "- description must require front, side, and back turnaround "
                    "views displayed side by side on a pure white background.",
                    "- description must include identity, appearance and demeanor, "
                    "clothing or age range, a static relationship to the product "
                    "or story, and alignment with the brief's visual style.",
                    "- description must contain the standalone text "
                    f"'Aspect ratio: {brief.aspect_ratio}'.",
                    "- description must not include a specific scene, "
                    "environmental props, narrative action, performed facial "
                    "expressions, or performed body actions.",
                    "- Do not expose model, API, credential, signed URL, or raw error details.",
                    "",
                    '{"characters":[{"name":"Character name","description":'
                    '"Character design / image-generation prompt"}]}',
                ]
            )
        audience = brief.audience or "高意向目标用户"
        return "\n".join(
            [
                "你是广告角色设定师。请只从上游故事正文中提取真实出现或明确指代的角色，生成角色卡片。",
                "",
                "必须使用的输入：",
                f"- 故事正文：{story}",
                f"- 商品：{product}",
                f"- 平台：{brief.target_platform}",
                f"- 画幅比例：{brief.aspect_ratio}",
                f"- 风格：{style}",
                f"- 目标受众：{audience}",
                f"- 原始需求：{brief.prompt}",
                "",
                "输出要求：",
                "- 只输出 JSON，不要使用 Markdown，不要包含内部推理。",
                "- JSON 顶层必须包含 characters。",
                "- characters 是数组，数组长度必须完全由故事正文中的角色决定。",
                "- 不要创建品牌体验官、目标用户、旁白、观众、用户群体等兜底角色。",
                "- 如果故事没有可提取的具体角色，characters 必须是空数组。",
                "- 每个角色对象必须包含 name 和 description。",
                "- name 使用故事中的称谓或可读的短中文名。",
                "- description 是角色形象图/角色设定图提示词，只描述人物或动物角色本体。",
                "- description 必须要求人物或动物三视图（正面、侧面、背面）并列展示，白底背景。",
                "- description 必须包含身份、外观气质、服饰/年龄段、与商品或故事的静态关系，并适配 brief 风格。",
                "- description 必须包含独立字段文本：画面比例："
                f"{brief.aspect_ratio}",
                "- description 禁止输出具体场景、环境道具、剧情化画面、表情演绎或肢体动作演绎。",
                "- 不要暴露模型、接口、密钥、签名 URL 或原始错误。",
                "",
                '{"characters":[{"name":"角色名","description":"角色描述/生图提示词"}]}',
            ]
        )

    @classmethod
    def build_story_prompt(cls, request: TextGenerationRequest) -> str:
        brief = request.brief
        product = cls._product_name(brief)
        style = cls._style(brief)
        audience = brief.audience or "高意向目标用户"
        selling_points = (
            "、".join(brief.selling_points)
            if brief.selling_points
            else "请从 brief 和图片输入中提炼核心卖点"
        )
        image_instruction = (
            f"- 已提供 {len(request.image_urls)} 张参考图片，请结合图片中的商品、场景、"
            "人物、包装、视觉风格或使用环境生成故事，不要虚构图片中不存在的品牌信息。"
            if request.image_urls
            else "- 未提供参考图片，请仅基于 brief 文本生成故事。"
        )
        return "\n".join(
            [
                "你是资深短视频广告创意策划。请基于 brief 和可选参考图片生成可进入角色与剧本阶段的广告故事。",
                "",
                "必须使用的输入：",
                f"- 商品：{product}",
                f"- 平台：{brief.target_platform}",
                f"- 画幅比例：{brief.aspect_ratio}",
                f"- 总时长：{brief.duration_seconds}s",
                f"- 风格：{style}",
                f"- 目标受众：{audience}",
                f"- 原始需求：{brief.prompt}",
                f"- 补充摘要：{brief.summary or '无'}",
                f"- 商品卖点：{selling_points}",
                image_instruction,
                "",
                "输出要求：",
                "- 只输出 JSON，不要使用 Markdown，不要包含内部推理。",
                "- JSON 顶层必须包含 title 和 content。",
                "- title 是简洁中文标题。",
                "- content 是完整中文故事正文，必须包含背景、冲突/需求、卖点解决方案、行动号召。",
                "- 故事需适配目标平台、画幅比例、总时长、视觉风格和目标受众。",
                "- 不要暴露模型、接口、密钥、签名 URL 或原始错误。",
                "",
                '输出 JSON 示例：{"title":"标题","content":"故事正文"}',
            ]
        )

    @classmethod
    def build_script_prompt(cls, request: TextGenerationRequest) -> str:
        brief = request.brief
        product = cls._product_name(brief)
        style = cls._style(brief)
        if brief.target_language == TargetLanguage.EN:
            audience = brief.audience or "high-intent target customers"
            selling_points = (
                ", ".join(brief.selling_points)
                if brief.selling_points
                else "derive the core selling points from the brief and story"
            )
            story = cls._excerpt(
                request.upstream_content,
                fallback=(
                    "The upstream story is missing. State the missing dependency "
                    "instead of inventing story details."
                ),
                limit=1600,
            )
            return "\n".join(
                [
                    "You are a senior short-form advertising scriptwriter. Create "
                    "an ad script from the upstream story and brief that can move "
                    "directly into storyboarding.",
                    "",
                    "Required inputs:",
                    f"- Upstream story: {story}",
                    f"- Product: {product}",
                    f"- Platform: {brief.target_platform}",
                    f"- Aspect ratio: {brief.aspect_ratio}",
                    f"- Total duration: {brief.duration_seconds}s",
                    f"- Style: {style}",
                    f"- Target audience: {audience}",
                    f"- Original requirement: {brief.prompt}",
                    f"- Additional summary: {brief.summary or 'None'}",
                    f"- Selling points: {selling_points}",
                    "",
                    "Output requirements:",
                    "- Output JSON only. Do not use Markdown or reveal internal reasoning.",
                    "- The top-level JSON object must contain title and content.",
                    "- Write the title and complete content in English. Preserve "
                    "proper names, brand names, product names, and required quoted "
                    "text exactly when needed.",
                    "- Organize content into scenes. Every scene must contain "
                    "Visual Description, Character Action, Dialogue / Voice-over, "
                    "Product Placement, Pacing, and Call to Action.",
                    "- Scene pacing must fit the total duration, target platform, "
                    "and aspect ratio.",
                    "- Integrate the product naturally into the upstream story; "
                    "do not replace it with a generic advertisement.",
                    "- Do not expose model, API, credential, signed URL, or raw error details.",
                    "",
                    '{"title":"English title","content":"Complete English ad script"}',
                ]
            )
        audience = brief.audience or "高意向目标用户"
        selling_points = (
            "、".join(brief.selling_points)
            if brief.selling_points
            else "请从 brief 和故事中提炼核心卖点"
        )
        story = cls._excerpt(
            request.upstream_content,
            fallback="缺少上游故事时，不要编造故事细节，先输出依赖缺失说明。",
            limit=1600,
        )
        return "\n".join(
            [
                "你是资深短视频广告编剧。请基于上游故事和 brief 生成可直接进入分镜阶段的广告剧本。",
                "",
                "必须使用的输入：",
                f"- 上游故事：{story}",
                f"- 商品：{product}",
                f"- 平台：{brief.target_platform}",
                f"- 画幅比例：{brief.aspect_ratio}",
                f"- 总时长：{brief.duration_seconds}s",
                f"- 风格：{style}",
                f"- 目标受众：{audience}",
                f"- 原始需求：{brief.prompt}",
                f"- 补充摘要：{brief.summary or '无'}",
                f"- 商品卖点：{selling_points}",
                "",
                "输出要求：",
                "- 只输出 JSON，不要使用 Markdown，不要包含内部推理。",
                "- JSON 顶层必须包含 title 和 content。",
                "- title 是简洁中文标题。",
                "- content 是完整中文剧本正文。",
                "- 使用中文。",
                "- 必须按场次组织，每个场次包含：画面描述、人物动作、台词/旁白、商品露出、节奏说明、转化号召。",
                "- 场次节奏需服务总时长，并适配目标平台和画幅比例。",
                "- 商品露出要自然嵌入故事，不要脱离上游故事重写成泛泛广告。",
                "- 不要暴露模型、接口、密钥、签名 URL 或原始错误。",
                "",
                '输出 JSON 示例：{"title":"标题","content":"剧本正文"}',
            ]
        )

    @classmethod
    def build_storyboard_prompt(cls, request: TextGenerationRequest) -> str:
        brief = request.brief
        product = cls._product_name(brief)
        style = cls._style(brief)
        if brief.target_language == TargetLanguage.EN:
            audience = brief.audience or "high-intent target customers"
            selling_points = (
                ", ".join(brief.selling_points)
                if brief.selling_points
                else "derive the core selling points from the brief and script"
            )
            script = cls._excerpt(
                request.upstream_content,
                fallback=(
                    "The script is missing. Return a missing-dependency result "
                    "instead of generating placeholder shots."
                ),
                limit=2200,
            )
            return "\n".join(
                [
                    "You are an advertising director and storyboard artist. Create "
                    "an executable storyboard from the complete script and brief.",
                    "",
                    "Required inputs:",
                    f"- Script: {script}",
                    f"- Product: {product}",
                    f"- Platform: {brief.target_platform}",
                    f"- Aspect ratio: {brief.aspect_ratio}",
                    f"- Total duration: {brief.duration_seconds}s",
                    f"- Style: {style}",
                    f"- Target audience: {audience}",
                    f"- Original requirement: {brief.prompt}",
                    f"- Additional summary: {brief.summary or 'None'}",
                    f"- Selling points: {selling_points}",
                    "",
                    "Output requirements:",
                    "- Output JSON only. Do not use Markdown or reveal internal reasoning.",
                    "- The top-level JSON object must contain title, content, and "
                    "storyboard_shots.",
                    "- Write title and content in English. Preserve proper names, "
                    "brand names, product names, and required quoted text exactly "
                    "when needed.",
                    "- storyboard_shots must be an array. Every shot object must "
                    "contain project_id, index, title, description, visual_prompt, "
                    "narration, and duration_seconds.",
                    "- Write every shot title, description, visual_prompt, and "
                    "narration in English, with the same proper-name exception.",
                    "- Number shots consecutively from 1.",
                    "- Every shot must include duration, visual description, "
                    "subject / setting, camera movement, narration, sound, and a "
                    "transition recommendation.",
                    "- The sum of all shot durations must match the brief duration "
                    "within 0.5 seconds, and every shot duration must be greater than 0.",
                    "- Inherit the script's scenes, character actions, product "
                    "placement, dialogue / voice-over, and call to action.",
                    "- Do not generate unrelated placeholder shots or expose model, "
                    "API, credential, signed URL, or raw error details.",
                    "",
                    (
                        '{"title":"English title","content":"English storyboard",'
                        '"storyboard_shots":[{"project_id":"'
                        f"{request.project_id}"
                        '","index":1,"title":"Shot title","description":'
                        '"Visual description","visual_prompt":"Visual prompt",'
                        '"narration":"Voice-over","duration_seconds":3.0}]}'
                    ),
                ]
            )
        audience = brief.audience or "高意向目标用户"
        selling_points = (
            "、".join(brief.selling_points)
            if brief.selling_points
            else "请从 brief 和剧本中提炼核心卖点"
        )
        script = cls._excerpt(
            request.upstream_content,
            fallback="缺少剧本正文时必须返回依赖缺失，不要生成占位分镜。",
            limit=2200,
        )
        return "\n".join(
            [
                "你是广告导演和分镜师。请基于完整剧本和 brief 生成可执行分镜脚本。",
                "",
                "必须使用的输入：",
                f"- 剧本正文：{script}",
                f"- 商品：{product}",
                f"- 平台：{brief.target_platform}",
                f"- 画幅比例：{brief.aspect_ratio}",
                f"- 总时长：{brief.duration_seconds}s",
                f"- 风格：{style}",
                f"- 目标受众：{audience}",
                f"- 原始需求：{brief.prompt}",
                f"- 补充摘要：{brief.summary or '无'}",
                f"- 商品卖点：{selling_points}",
                "",
                "输出要求：",
                "- 只输出 JSON，不要使用 Markdown，不要包含内部推理。",
                "- JSON 顶层必须包含 title、content 和 storyboard_shots。",
                "- title 是简洁中文标题。",
                "- content 是完整中文分镜脚本文本。",
                "- storyboard_shots 是数组，每个镜头对象必须包含 project_id、index、title、description、visual_prompt、narration、duration_seconds。",
                "- 使用中文。",
                "- 逐镜头输出，编号必须从 1 连续递增。",
                "- 每个镜头必须包含：镜头时长、画面描述、主体/场景、运镜、旁白、音效和转场建议。",
                "- 全部镜头时长总和必须匹配 brief 总时长，容差不超过 0.5 秒，每个镜头时长必须大于 0。",
                "- 分镜必须继承剧本中的场次、人物动作、商品露出、台词/旁白和转化号召。",
                "- 不要生成与剧本无关的占位镜头，不要暴露模型、接口、密钥或原始错误。",
                "",
                (
                    '{"title":"标题","content":"分镜正文","storyboard_shots":['
                    '{"project_id":"'
                    f"{request.project_id}"
                    '","index":1,"title":"镜头标题","description":"画面描述",'
                    '"visual_prompt":"视觉提示词","narration":"旁白",'
                    '"duration_seconds":3.0}]}'
                ),
            ]
        )

    @staticmethod
    def _storyboard_durations(total_seconds: int, shot_count: int) -> list[float]:
        base = round(total_seconds / shot_count, 2)
        durations = [base for _ in range(shot_count)]
        durations[-1] = round(total_seconds - sum(durations[:-1]), 2)
        return durations

    @staticmethod
    def _excerpt(
        value: str | None,
        *,
        fallback: str,
        limit: int = 360,
    ) -> str:
        text = " ".join((value or "").split())
        if not text:
            return fallback
        if len(text) <= limit:
            return text
        return f"{text[:limit].rstrip()}..."

    @staticmethod
    def _contains_han(value: str) -> bool:
        return bool(re.search(r"[\u4e00-\u9fff]", value))

    @classmethod
    def _english_value(cls, value: str | None, fallback: str) -> str:
        text = " ".join((value or "").split())
        if not text or cls._contains_han(text):
            return fallback
        return text

    @classmethod
    def _english_source_excerpt(
        cls,
        value: str | None,
        *,
        fallback: str,
        limit: int = 360,
    ) -> str:
        excerpt = cls._excerpt(value, fallback=fallback, limit=limit)
        if cls._contains_han(excerpt):
            return (
                "Use the supplied upstream source as the authoritative narrative "
                "basis, preserving its events and proper names."
            )
        return excerpt

    @staticmethod
    def _slug(value: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-").lower()
        return slug or "project"

    @staticmethod
    def _extract_character_names(story_content: str) -> list[str]:
        text = story_content.strip()
        if not text:
            return []

        explicit_pattern = (
            r"(?:主角|主人公|角色|人物)[：:]\s*"
            r"([\u4e00-\u9fa5A-Za-z0-9·_-]{2,12}?)(?=正在|在|是|，|。|；|:|：|\s|$)"
        )
        candidates = re.findall(explicit_pattern, text)
        candidates.extend(
            re.findall(
                r"(?:protagonist|main character|character|person)"
                r"\s*(?:is|:)\s*([A-Z][A-Za-z0-9'._-]*(?:\s+[A-Z][A-Za-z0-9'._-]*)?)",
                text,
                flags=re.IGNORECASE,
            )
        )
        if not candidates:
            patterns = [
                r"([\u4e00-\u9fa5A-Za-z0-9·_-]{2,12})(?:是一位|是一个|作为|正在|需要|遇到|使用)",
                r"(?:让|由|围绕)([\u4e00-\u9fa5A-Za-z0-9·_-]{2,12})(?:在|完成|开始|使用|解决)",
                r"\b([A-Z][A-Za-z0-9'._-]+)(?:\s+is|\s+uses|\s+needs|\s+discovers)",
            ]
            for pattern in patterns:
                candidates.extend(re.findall(pattern, text))

        stop_words = {
            "故事结构",
            "目标平台",
            "核心受众",
            "广告主张",
            "开场用",
            "中段让",
            "结尾给",
            "行动号召",
            "商品",
            "产品",
            "用户",
            "目标用户",
            "品牌体验官",
        }
        names: list[str] = []
        for candidate in candidates:
            name = candidate.strip(" ，。；：:、\n\t")
            if name in stop_words or len(name) < 2:
                continue
            if name not in names:
                names.append(name)
        return names[:8]

    @staticmethod
    def _localized_character_name(
        name: str,
        target_language: TargetLanguage,
        index: int,
    ) -> str:
        if target_language != TargetLanguage.EN or not re.search(
            r"[\u4e00-\u9fff]",
            name,
        ):
            return name
        return f"Character {index}"

    @classmethod
    def _character_description(
        cls,
        name: str,
        brief: Brief,
        story_content: str,
    ) -> str:
        product = cls._product_name(brief)
        if brief.target_language == TargetLanguage.EN:
            return (
                f"{name}, a specific human or animal character identified in the "
                "source story. Match the advertising visual style specified in "
                "the brief. Character turnaround sheet with front, side, and back "
                "views displayed side by side on a pure white background. Describe "
                "only the character's identity, appearance and demeanor, clothing "
                f"or age range, and static relationship to {product} or the story. "
                "Do not include a specific scene, environmental props, narrative "
                "action, performed facial expressions, or performed body actions. "
                f"Aspect ratio: {brief.aspect_ratio}"
            )
        style = cls._style(brief)
        story_excerpt = cls._excerpt(story_content, fallback="", limit=240)
        return (
            f"{name}，来自故事正文的具体人物或动物角色。{style}广告片质感，"
            "人物或动物三视图（正面、侧面、背面）并列展示，白底背景；"
            f"只描述身份、外观气质、服饰/年龄段，以及与{product}或故事的静态关系。"
            "禁止具体场景、环境道具、剧情化画面、表情演绎或肢体动作演绎。"
            f"故事依据：{story_excerpt} 画面比例：{brief.aspect_ratio}"
        )


class HybridModelArkAdapter:
    """Routes supported generation to BytePlus and keeps storyboard images on Mock."""

    def __init__(
        self,
        *,
        character_adapter: ModelArkAdapter,
        fallback_adapter: ModelArkAdapter,
    ) -> None:
        self.character_adapter = character_adapter
        self.fallback_adapter = fallback_adapter

    async def generate_text(
        self,
        request: TextGenerationRequest,
    ) -> GeneratedTextResult:
        return await self.character_adapter.generate_text(request)

    async def generate_aigc_text(
        self,
        request: AigcTextGenerationRequest,
    ) -> str:
        return await self.character_adapter.generate_aigc_text(request)

    async def generate_image_prompt(
        self,
        request: ImagePromptGenerationRequest,
    ) -> ImagePromptSuggestion:
        return await self.character_adapter.generate_image_prompt(request)

    async def stream_text(
        self,
        request: TextGenerationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        async for event in self.character_adapter.stream_text(request):
            yield event

    async def optimize_video_prompt(
        self,
        request: VideoPromptOptimizationRequest,
    ) -> VideoPromptOptimizationResult:
        return await self.character_adapter.optimize_video_prompt(request)

    async def optimize_tool_video_prompt(
        self,
        request: ToolVideoPromptOptimizationRequest,
    ) -> VideoPromptOptimizationResult:
        return await self.character_adapter.optimize_tool_video_prompt(request)

    async def optimize_aigc_image_prompt(
        self,
        request: AigcImagePromptOptimizationRequest,
    ) -> AigcImagePromptOptimizationResult:
        return await self.character_adapter.optimize_aigc_image_prompt(request)

    async def stream_video_prompt_optimization(
        self,
        request: VideoPromptOptimizationRequest,
    ) -> AsyncIterator[ModelArkStreamEvent]:
        async for event in self.character_adapter.stream_video_prompt_optimization(
            request
        ):
            yield event

    async def generate_image(
        self,
        request: ImageGenerationRequest,
    ) -> GeneratedAssetResult:
        return await self.fallback_adapter.generate_image(request)

    async def generate_project_image(
        self,
        request: ProjectImageGenerationRequest,
    ) -> GeneratedAssetResult:
        return await self.character_adapter.generate_project_image(request)

    async def decompose_image_layers(
        self,
        request: LayerDecompositionRequest,
    ) -> LayerDecompositionResult:
        return await self.character_adapter.decompose_image_layers(request)

    async def generate_characters(
        self,
        request: CharacterGenerationRequest,
    ) -> list[GeneratedAssetResult]:
        return await self.character_adapter.generate_characters(request)

    async def edit_character_image(
        self,
        request: CharacterImageEditRequest,
    ) -> GeneratedAssetResult:
        return await self.character_adapter.edit_character_image(request)

    async def regenerate_character_image(
        self,
        request: CharacterImageRegenerateRequest,
    ) -> GeneratedAssetResult:
        return await self.character_adapter.regenerate_character_image(request)

    async def generate_video(
        self,
        request: VideoGenerationRequest,
    ) -> GeneratedAssetResult:
        return await self.character_adapter.generate_video(request)

    async def generate_tool_video(
        self,
        request: ToolVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        return await self.character_adapter.generate_tool_video(request)

    async def generate_seedance_video(
        self,
        request: SeedanceVideoGenerationRequest,
    ) -> GeneratedAssetResult:
        return await self.character_adapter.generate_seedance_video(request)

    async def edit_video(
        self,
        request: VideoEditRequest,
    ) -> GeneratedAssetResult:
        return await self.character_adapter.edit_video(request)
