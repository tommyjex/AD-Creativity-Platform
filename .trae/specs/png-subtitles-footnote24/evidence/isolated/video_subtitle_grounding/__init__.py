"""Platform-independent subtitle extraction, translation and rendering."""

__version__ = "0.3.6"

from .config import Settings
from .schemas import VideoSubtitleGroundingRequest, VideoSubtitleGroundingResponse
from .service import VideoSubtitleGroundingService
from .translation import ModelArkSubtitleTranslationAdapter
from .render import SubtitleRenderService
from .layout import compile_subtitle_project, compile_text_subtitle_project, SubtitleLayoutError
from .mediakit import MediaKitMultiTrackClient, MediaKitMultiTrackError

__all__ = [
    "Settings",
    "VideoSubtitleGroundingRequest",
    "VideoSubtitleGroundingResponse",
    "VideoSubtitleGroundingService",
    "ModelArkSubtitleTranslationAdapter",
    "SubtitleRenderService",
    "compile_subtitle_project",
    "compile_text_subtitle_project",
    "SubtitleLayoutError",
    "MediaKitMultiTrackClient",
    "MediaKitMultiTrackError",
    "__version__",
]
