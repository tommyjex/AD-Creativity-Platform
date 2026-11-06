"""Platform settings and TLS hooks for the independent translation adapter."""

from video_subtitle_grounding import translation as _translation
from video_subtitle_grounding.translation import (
    FORMAT,
    MODEL,
    SYSTEM,
    merge_translations,
    translation_batches,
)
from video_subtitle_grounding.translation import (
    ModelArkSubtitleTranslationAdapter as _Adapter,
)

from backend.app.core.config import get_settings
from backend.app.core.logging import emit_tls_only_event, log_event

__all__ = [
    "FORMAT", "MODEL", "SYSTEM", "ModelArkSubtitleTranslationAdapter",
    "merge_translations", "translation_batches",
]

_parse_records = _translation._parse_records
_record = _translation._record
_tokens = _translation._tokens


class ModelArkSubtitleTranslationAdapter(_Adapter):
    def __init__(self, settings=None, *, event_logger=None, tls_only_logger=None, **kwargs):
        super().__init__(
            settings or get_settings(),
            event_logger=event_logger or (lambda *args, **kw: log_event(*args, **kw)),
            tls_only_logger=tls_only_logger or (
                lambda *args, **kw: emit_tls_only_event(*args, **kw)
            ),
            **kwargs,
        )
