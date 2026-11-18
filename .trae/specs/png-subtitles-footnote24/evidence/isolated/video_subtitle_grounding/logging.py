"""Aggregate operational events; raw provider output goes only to a TLS sink."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from .tls_logging import TlsLogSink

_FIELDS = frozenset({
    "duration_ms", "sampling_fps", "model", "video_bytes", "display_width",
    "display_height", "video_duration_ms", "subtitle_count", "input_tokens",
    "output_tokens", "total_tokens", "provider_request_id", "invalid_segment_count",
    "style_fallback_counts", "phase", "error_code", "error_stage", "error_type",
    "provider_code", "response_length", "segment_count", "failed_count",
    "provider_task_id", "operation",
    "brand_rule_version", "brand_filtered_count", "brand_filter_counts",
})


def log_event(
    logger: logging.Logger, event: str, *, outcome: str,
    level: int = logging.INFO, **context: Any,
) -> None:
    logger.log(level, event, extra={
        "structured_event": event, "structured_outcome": outcome,
        "structured_context": {k: v for k, v in context.items() if k in _FIELDS},
    })


def emit_tls_only_event(*args: Any, **kwargs: Any) -> None:
    """SDK default discards raw output; an embedding application must inject TLS."""


def tls_only_logger(sink: TlsLogSink | None):
    def emit(event: str, *, outcome: str, output_text: str, **context: Any) -> None:
        if sink is None:
            return
        encoded = output_text.encode("utf-8")
        truncated = encoded[:256 * 1024].decode("utf-8", errors="ignore")
        sink.emit({
            "event": event, "outcome": outcome,
            "timestamp": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(),
            **{k: v for k, v in context.items() if k in _FIELDS},
            "output_text": truncated, "output_truncated": len(encoded) > 256 * 1024,
        })
    return emit


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "timestamp": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(),
            "event": getattr(record, "structured_event", record.name),
            "outcome": getattr(record, "structured_outcome", "unknown"),
            "level": record.levelname,
            **{k: v for k, v in getattr(record, "structured_context", {}).items() if k in _FIELDS},
        }, ensure_ascii=False)
