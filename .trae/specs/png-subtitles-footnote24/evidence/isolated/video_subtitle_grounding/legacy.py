"""Frozen pre-brand execution policy for already queued platform tasks only."""

from .provider import (
    LEGACY_VIDEO_SUBTITLE_GROUNDING_PROMPT,
    ModelArkVideoSubtitleGroundingAdapter,
)
from .service import VideoSubtitleGroundingService
from .translation import ModelArkSubtitleTranslationAdapter


class LegacyGroundingAdapter(ModelArkVideoSubtitleGroundingAdapter):
    extraction_prompt = LEGACY_VIDEO_SUBTITLE_GROUNDING_PROMPT


class LegacyGroundingService(VideoSubtitleGroundingService):
    brand_rules_enabled = False
    provider_class = LegacyGroundingAdapter


class LegacyTranslationAdapter(ModelArkSubtitleTranslationAdapter):
    brand_rules_enabled = False
