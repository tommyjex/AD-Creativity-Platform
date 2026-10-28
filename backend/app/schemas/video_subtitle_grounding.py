import re
import unicodedata
from enum import StrEnum
from typing import Annotated, Literal, TypeAlias

from pydantic import Field, StrictInt, field_validator, model_validator

from .common import SchemaModel

VIDEO_SUBTITLE_GROUNDING_DEFAULT_MODEL = "doubao-seed-evolving"
VIDEO_SUBTITLE_GROUNDING_DEFAULT_SAMPLING_FPS = 2.0
VIDEO_SUBTITLE_GROUNDING_MIN_SAMPLING_FPS = 0.5
VIDEO_SUBTITLE_GROUNDING_MAX_SAMPLING_FPS = 5.0
VIDEO_SUBTITLE_GROUNDING_MAX_SEGMENTS = 500
VIDEO_SUBTITLE_GROUNDING_MAX_TEXT_LENGTH = 500
VIDEO_SUBTITLE_GROUNDING_MAX_VIDEO_DURATION_MS = 600_000
VIDEO_SUBTITLE_GROUNDING_BACKGROUND_COLOR_PATTERN = r"^#[0-9A-Fa-f]{6}$"

SceneBackgroundColor = Annotated[
    str, Field(strict=True, pattern=VIDEO_SUBTITLE_GROUNDING_BACKGROUND_COLOR_PATTERN)
]
NormalizedCoordinate = Annotated[StrictInt, Field(ge=0, le=999)]
PixelCoordinate = Annotated[StrictInt, Field(ge=0)]
NormalizedBoundingBox: TypeAlias = tuple[
    NormalizedCoordinate,
    NormalizedCoordinate,
    NormalizedCoordinate,
    NormalizedCoordinate,
]
PixelBoundingBox: TypeAlias = tuple[
    PixelCoordinate,
    PixelCoordinate,
    PixelCoordinate,
    PixelCoordinate,
]


class VideoSubtitleGroundingErrorCode(StrEnum):
    INVALID_VIDEO_URL = "invalid_video_url"
    INVALID_VIDEO_INPUT = "invalid_video_input"
    VIDEO_DOWNLOAD_FAILED = "video_download_failed"
    MEDIA_PROBE_FAILED = "media_probe_failed"
    MODEL_FILE_UPLOAD_FAILED = "model_file_upload_failed"
    MODEL_FILE_PROCESSING_FAILED = "model_file_processing_failed"
    MODEL_REQUEST_FAILED = "model_request_failed"
    INVALID_MODEL_OUTPUT = "invalid_model_output"
    CLEANUP_FAILED = "cleanup_failed"


class VideoSubtitleGroundingErrorPhase(StrEnum):
    URL_VALIDATION = "url_validation"
    DOWNLOAD = "download"
    MEDIA_PROBE = "media_probe"
    FILES_UPLOAD = "files_upload"
    FILES_PROCESSING = "files_processing"
    RESPONSES = "responses"
    RESPONSE_VALIDATION = "response_validation"
    CLEANUP = "cleanup"


class VideoSubtitleVisualRole(StrEnum):
    HEADLINE = "headline"
    BODY = "body"
    FOOTNOTE = "footnote"


class VideoSubtitleAlignment(StrEnum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"


class VideoSubtitleGroundingRequest(SchemaModel):
    video_url: str = Field(min_length=1, max_length=2048)
    sampling_fps: float = Field(
        default=VIDEO_SUBTITLE_GROUNDING_DEFAULT_SAMPLING_FPS,
        ge=VIDEO_SUBTITLE_GROUNDING_MIN_SAMPLING_FPS,
        le=VIDEO_SUBTITLE_GROUNDING_MAX_SAMPLING_FPS,
        allow_inf_nan=False,
    )


class VideoSubtitleGroundingVideoMetadata(SchemaModel):
    width: StrictInt = Field(gt=0)
    height: StrictInt = Field(gt=0)
    duration_ms: StrictInt = Field(
        gt=0,
        le=VIDEO_SUBTITLE_GROUNDING_MAX_VIDEO_DURATION_MS,
    )
    rotation: Literal[0, 90, 180, 270] = 0


class VideoSubtitleGroundingSubtitle(SchemaModel):
    text: str = Field(min_length=1, max_length=VIDEO_SUBTITLE_GROUNDING_MAX_TEXT_LENGTH)
    start_ms: StrictInt = Field(ge=0)
    end_ms: StrictInt = Field(gt=0)
    bbox_normalized: NormalizedBoundingBox
    bbox_pixels: PixelBoundingBox
    visual_role: VideoSubtitleVisualRole = VideoSubtitleVisualRole.BODY
    font_height_ratio: float = Field(
        default=0.1,
        gt=0,
        le=1,
        allow_inf_nan=False,
    )
    alignment: VideoSubtitleAlignment = VideoSubtitleAlignment.CENTER
    block_id: str = Field(default="legacy", min_length=1, max_length=64)
    line_index: StrictInt = Field(default=0, ge=0)
    background_color: SceneBackgroundColor | None = Field(
        default=None,
        description=(
            "Representative scene color behind the text, excluding glyphs and "
            "outlines; not the text color or a subtitle backplate color."
        ),
    )
    warnings: list[Literal["background_color_unavailable"]] = Field(default_factory=list)

    @field_validator("background_color")
    @classmethod
    def validate_background_color(cls, value: str | None) -> str | None:
        if value is not None and re.fullmatch(
            VIDEO_SUBTITLE_GROUNDING_BACKGROUND_COLOR_PATTERN, value
        ) is None:
            raise ValueError("background color must use six-digit hexadecimal RGB")
        return value

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("subtitle text must not be blank")
        if any(unicodedata.category(character) == "Cc" for character in normalized):
            raise ValueError("subtitle text must not contain control characters")
        return normalized

    @model_validator(mode="after")
    def validate_ranges(self) -> "VideoSubtitleGroundingSubtitle":
        if self.start_ms >= self.end_ms:
            raise ValueError("subtitle requires start_ms < end_ms")
        x1, y1, x2, y2 = self.bbox_normalized
        if x1 >= x2 or y1 >= y2:
            raise ValueError("normalized bbox must have positive area")
        pixel_x1, pixel_y1, pixel_x2, pixel_y2 = self.bbox_pixels
        if pixel_x1 >= pixel_x2 or pixel_y1 >= pixel_y2:
            raise ValueError("pixel bbox must have positive area")
        if (
            self.background_color is None
            and "background_color_unavailable" not in self.warnings
        ):
            self.warnings.append("background_color_unavailable")
        return self


class VideoSubtitleGroundingUsage(SchemaModel):
    input_tokens: StrictInt = Field(default=0, ge=0)
    output_tokens: StrictInt = Field(default=0, ge=0)
    total_tokens: StrictInt = Field(default=0, ge=0)


class VideoSubtitleGroundingResponse(SchemaModel):
    model: str = Field(min_length=1, max_length=255)
    video: VideoSubtitleGroundingVideoMetadata
    subtitles: list[VideoSubtitleGroundingSubtitle] = Field(
        default_factory=list,
        max_length=VIDEO_SUBTITLE_GROUNDING_MAX_SEGMENTS,
    )
    usage: VideoSubtitleGroundingUsage
    latency_ms: StrictInt = Field(ge=0)


class VideoSubtitleGroundingError(SchemaModel):
    code: VideoSubtitleGroundingErrorCode
    phase: VideoSubtitleGroundingErrorPhase
    message: str = Field(min_length=1, max_length=255)
