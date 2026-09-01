from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

SeedanceModel: TypeAlias = Literal[
    "doubao-seedance-2-5-260628",
    "doubao-seedance-2-0-260128",
    "doubao-seedance-2-0-fast-260128",
    "doubao-seedance-2-0-mini-260615",
]
SeedanceResolution: TypeAlias = Literal["480p", "720p", "1080p", "4k"]
SeedanceAspectRatio: TypeAlias = Literal[
    "16:9",
    "4:3",
    "1:1",
    "3:4",
    "9:16",
    "21:9",
    "adaptive",
]
SeedanceGenerationMode: TypeAlias = Literal[
    "text_to_video",
    "first_frame",
    "first_last_frame",
    "multimodal_reference",
]
SeedanceTaskType: TypeAlias = Literal["generate", "edit", "extend"]

SEEDANCE_MODELS: tuple[SeedanceModel, ...] = (
    "doubao-seedance-2-5-260628",
    "doubao-seedance-2-0-260128",
    "doubao-seedance-2-0-fast-260128",
    "doubao-seedance-2-0-mini-260615",
)
SEEDANCE_ASPECT_RATIOS: tuple[SeedanceAspectRatio, ...] = (
    "16:9",
    "4:3",
    "1:1",
    "3:4",
    "9:16",
    "21:9",
    "adaptive",
)
SEEDANCE_DEFAULT_MODEL: SeedanceModel = "doubao-seedance-2-5-260628"
SEEDANCE_DEFAULT_RESOLUTION: SeedanceResolution = "720p"
SEEDANCE_DEFAULT_ASPECT_RATIO: SeedanceAspectRatio = "adaptive"
SEEDANCE_DEFAULT_DURATION_SECONDS = -1
SEEDANCE_DEFAULT_GENERATE_AUDIO = True
SEEDANCE_DEFAULT_TASK_TYPE: SeedanceTaskType = "generate"


@dataclass(frozen=True)
class SeedanceCapabilities:
    display_name: str
    max_reference_images: int
    max_reference_videos: int
    max_reference_audios: int
    max_input_duration_seconds: int
    prompt_languages: tuple[str, ...]
    resolutions: tuple[SeedanceResolution, ...]
    minimum_duration_seconds: int
    maximum_duration_seconds: int


SEEDANCE_CAPABILITIES: dict[SeedanceModel, SeedanceCapabilities] = {
    "doubao-seedance-2-5-260628": SeedanceCapabilities(
        display_name="Seedance 2.5",
        max_reference_images=30,
        max_reference_videos=10,
        max_reference_audios=10,
        max_input_duration_seconds=30,
        prompt_languages=(
            "zh",
            "en",
            "es",
            "id",
            "pt",
            "ja",
            "ms",
            "th",
            "ar",
            "vi",
            "ko",
        ),
        resolutions=("480p", "720p", "1080p"),
        minimum_duration_seconds=4,
        maximum_duration_seconds=30,
    ),
    "doubao-seedance-2-0-260128": SeedanceCapabilities(
        display_name="Seedance 2.0",
        max_reference_images=9,
        max_reference_videos=3,
        max_reference_audios=3,
        max_input_duration_seconds=15,
        prompt_languages=("zh", "en", "es", "id", "pt", "ja"),
        resolutions=("480p", "720p", "1080p", "4k"),
        minimum_duration_seconds=4,
        maximum_duration_seconds=15,
    ),
    "doubao-seedance-2-0-fast-260128": SeedanceCapabilities(
        display_name="Seedance 2.0 Fast",
        max_reference_images=9,
        max_reference_videos=3,
        max_reference_audios=3,
        max_input_duration_seconds=15,
        prompt_languages=("zh", "en", "es", "id", "pt", "ja"),
        resolutions=("480p", "720p"),
        minimum_duration_seconds=4,
        maximum_duration_seconds=15,
    ),
    "doubao-seedance-2-0-mini-260615": SeedanceCapabilities(
        display_name="Seedance 2.0 Mini",
        max_reference_images=9,
        max_reference_videos=3,
        max_reference_audios=3,
        max_input_duration_seconds=15,
        prompt_languages=("zh", "en", "es", "id", "pt", "ja"),
        resolutions=("480p", "720p"),
        minimum_duration_seconds=4,
        maximum_duration_seconds=15,
    ),
}

SEEDANCE_MODEL_DISPLAY_NAMES: dict[SeedanceModel, str] = {
    model: capabilities.display_name
    for model, capabilities in SEEDANCE_CAPABILITIES.items()
}
SEEDANCE_MODEL_DURATION_RANGES: dict[SeedanceModel, tuple[int, int]] = {
    model: (
        capabilities.minimum_duration_seconds,
        capabilities.maximum_duration_seconds,
    )
    for model, capabilities in SEEDANCE_CAPABILITIES.items()
}
SEEDANCE_MODEL_RESOLUTIONS: dict[
    SeedanceModel, tuple[SeedanceResolution, ...]
] = {
    model: capabilities.resolutions
    for model, capabilities in SEEDANCE_CAPABILITIES.items()
}


def validate_seedance_duration(
    model: SeedanceModel,
    duration_seconds: int,
) -> int:
    if duration_seconds == SEEDANCE_DEFAULT_DURATION_SECONDS:
        return duration_seconds
    capabilities = SEEDANCE_CAPABILITIES[model]
    minimum = capabilities.minimum_duration_seconds
    maximum = capabilities.maximum_duration_seconds
    if not minimum <= duration_seconds <= maximum:
        raise ValueError(
            f"{model} duration_seconds must be between {minimum} and {maximum}"
        )
    return duration_seconds


def validate_seedance_resolution(
    model: SeedanceModel,
    resolution: str,
) -> str:
    allowed = SEEDANCE_CAPABILITIES[model].resolutions
    if resolution not in allowed:
        raise ValueError(
            f"{model} resolution must be one of {', '.join(allowed)}"
        )
    return resolution


def validate_seedance_aspect_ratio(aspect_ratio: str) -> str:
    if aspect_ratio not in SEEDANCE_ASPECT_RATIOS:
        raise ValueError(
            "aspect_ratio must be one of "
            f"{', '.join(SEEDANCE_ASPECT_RATIOS)}"
        )
    return aspect_ratio


def validate_seedance_reference_counts(
    model: SeedanceModel,
    *,
    reference_image_count: int,
    reference_video_count: int,
    reference_audio_count: int,
) -> None:
    capabilities = SEEDANCE_CAPABILITIES[model]
    limits = (
        (
            "reference images",
            reference_image_count,
            capabilities.max_reference_images,
        ),
        (
            "reference videos",
            reference_video_count,
            capabilities.max_reference_videos,
        ),
        (
            "reference audios",
            reference_audio_count,
            capabilities.max_reference_audios,
        ),
    )
    for label, count, maximum in limits:
        if count > maximum:
            raise ValueError(f"{model} supports at most {maximum} {label}")


def seedance_input_duration_limit(model: SeedanceModel) -> int:
    return SEEDANCE_CAPABILITIES[model].max_input_duration_seconds


def seedance_video_input_minimum(
    model: SeedanceModel,
    task_type: SeedanceTaskType,
) -> int:
    if model == SEEDANCE_DEFAULT_MODEL and task_type in {"edit", "extend"}:
        return 4
    return 2
