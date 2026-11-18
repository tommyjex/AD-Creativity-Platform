"""Platform config/logging adapter; extraction lives in its own package."""

from video_subtitle_grounding.service import *  # noqa: F403
from video_subtitle_grounding.service import (
    VideoSubtitleGroundingService as _Service,
)

from backend.app.core.config import Settings, get_settings
from backend.app.core.logging import emit_tls_only_event, log_event


class VideoSubtitleGroundingService(_Service):
    def __init__(
        self, *, settings: Settings | None = None,
        event_logger=None, tls_only_logger=None, **kwargs,
    ):
        # Resolve hooks at call time so platform logging context remains intact.
        super().__init__(
            settings=settings or get_settings(),
            event_logger=event_logger or (lambda *args, **kw: log_event(*args, **kw)),
            tls_only_logger=tls_only_logger or (
                lambda *args, **kw: emit_tls_only_event(*args, **kw)
            ),
            **kwargs,
        )


class LegacyVideoSubtitleGroundingService(VideoSubtitleGroundingService):
    """Only used for tasks frozen before the brand rule was introduced."""
    from video_subtitle_grounding.legacy import LegacyGroundingAdapter

    brand_rules_enabled = False
    provider_class = LegacyGroundingAdapter
