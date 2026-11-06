"""Compatibility exports and platform defaults for independent video preparation."""

from video_subtitle_grounding.media import *  # noqa: F403
from video_subtitle_grounding.media import (
    FFprobeVideoPathInspector as _Inspector,
    SecureRemoteVideoDownloader as _Downloader,
    SecureRemoteVideoPreparer as _Preparer,
)

from backend.app.core.config import Settings, get_settings


class SecureRemoteVideoDownloader(_Downloader):
    def __init__(self, settings: Settings | None = None, **kwargs):
        super().__init__(settings or get_settings(), **kwargs)


class FFprobeVideoPathInspector(_Inspector):
    def __init__(self, settings: Settings | None = None, **kwargs):
        super().__init__(settings or get_settings(), **kwargs)


class SecureRemoteVideoPreparer(_Preparer):
    def __init__(self, downloader=None, inspector=None):
        super().__init__(
            downloader or SecureRemoteVideoDownloader(),
            inspector or FFprobeVideoPathInspector(),
        )
