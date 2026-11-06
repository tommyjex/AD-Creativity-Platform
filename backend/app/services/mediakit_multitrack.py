"""Preserve platform settings at the existing MediaKit import path."""

from video_subtitle_grounding.mediakit import MediaKitMultiTrackClient as _Client
from video_subtitle_grounding.mediakit import (
    MediaKitMultiTrackError,
    MultiTrackTask,
    MultiTrackTaskStatus,
)

from backend.app.core.config import get_settings

__all__ = [
    "MediaKitMultiTrackClient", "MediaKitMultiTrackError", "MultiTrackTask",
    "MultiTrackTaskStatus",
]


class MediaKitMultiTrackClient(_Client):
    def __init__(self, settings=None, **kwargs):
        super().__init__(settings or get_settings(), **kwargs)
