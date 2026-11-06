"""Compatibility imports for the separately versioned extraction package."""

from video_subtitle_grounding.provider import *  # noqa: F403
from video_subtitle_grounding.provider import (
    ModelArkVideoSubtitleGroundingAdapter as _Adapter,
)

from backend.app.core.config import Settings, get_settings


class ModelArkVideoSubtitleGroundingAdapter(_Adapter):
    """Keep platform configuration injection at the original import path."""

    def __init__(self, settings: Settings | None = None, **kwargs):
        super().__init__(settings or get_settings(), **kwargs)
