"""Structured, privacy-safe operational logging primitives."""

from __future__ import annotations

import json
import logging
import re
import sys
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal
from urllib.parse import urlsplit, urlunsplit

from .config import Settings
from .tls_logging import TlsLogHandler, TlsLogSink

Outcome = Literal["started", "succeeded", "failed", "canceled", "retried", "skipped"]

_DEFAULT_MAX_VALUE_LENGTH = 256
_TLS_RAW_OUTPUT_MAX_BYTES = 32 * 1024
_SENSITIVE_FIELD_PATTERN = re.compile(
    r"(?:api[_-]?key|access[_-]?key|secret|authorization|cookie|password|token|"
    r"signature|credential|prompt|request[_-]?body|response[_-]?body|raw|"
    r"object[_-]?key)",
    re.IGNORECASE,
)
_SAFE_CONTEXT_FIELDS = frozenset(
    {
        "request_id",
        "trace_id",
        "project_id",
        "pipeline_id",
        "template_id",
        "run_id",
        "node_id",
        "task_id",
        "attempt_id",
        "task_type",
        "asset_type",
        "worker_id",
        "provider",
        "provider_request_id",
        "provider_task_id",
        "model",
        "phase",
        "operation",
        "route",
        "method",
        "status_code",
        "duration_ms",
        "error_type",
        "error_code",
    }
)

_log_context: ContextVar[dict[str, Any] | None] = ContextVar(
    "structured_log_context",
    default=None,
)


def bind_log_context(**values: Any) -> Token[dict[str, Any] | None]:
    """Bind whitelisted correlation fields for the current async context."""

    context = get_log_context()
    context.update(_filter_context(values))
    return _log_context.set(context)


def reset_log_context(token: Token[dict[str, Any] | None]) -> None:
    """Restore the context present before ``bind_log_context``."""

    _log_context.reset(token)


@contextmanager
def log_context(**values: Any) -> Iterator[None]:
    token = bind_log_context(**values)
    try:
        yield
    finally:
        reset_log_context(token)


def get_log_context() -> dict[str, Any]:
    context = _log_context.get()
    return context.copy() if context is not None else {}


def normalize_exception(exc: BaseException) -> dict[str, str]:
    """Return the safe, stable subset of an exception for an event."""

    result = {"error_type": type(exc).__name__}
    code = getattr(exc, "code", None) or getattr(exc, "error_code", None)
    if isinstance(code, (str, int)) and str(code):
        result["error_code"] = sanitize_value("error_code", str(code))
    return result


def sanitize_value(
    key: str,
    value: Any,
    *,
    max_length: int = _DEFAULT_MAX_VALUE_LENGTH,
) -> Any:
    """Redact sensitive values and normalize values accepted by JSON logging."""

    if _SENSITIVE_FIELD_PATTERN.search(key):
        return "[REDACTED]"
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        if _looks_like_url(value):
            return _strip_url_query(value)
        return _truncate(_redact_embedded_secrets(value), max_length)
    if isinstance(value, Mapping):
        return {
            str(item_key): sanitize_value(
                str(item_key),
                item_value,
                max_length=max_length,
            )
            for item_key, item_value in value.items()
        }
    if isinstance(value, (list, tuple, set, frozenset)):
        return [
            sanitize_value(key, item, max_length=max_length)
            for item in value
        ]
    return _truncate(str(value), max_length)


def _filter_context(values: Mapping[str, Any]) -> dict[str, Any]:
    return {
        key: sanitize_value(key, value)
        for key, value in values.items()
        if key in _SAFE_CONTEXT_FIELDS and value is not None
    }


def _looks_like_url(value: str) -> bool:
    return value.startswith(("http://", "https://"))


def _strip_url_query(value: str) -> str:
    parsed = urlsplit(value)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def _redact_embedded_secrets(value: str) -> str:
    return re.sub(
        r"(?i)\b(?:api[_-]?key|access[_-]?key|secret|password|token|"
        r"authorization)\s*[:=]\s*[^\s,;]+",
        "[REDACTED]",
        value,
    )


def _truncate(value: str, max_length: int) -> str:
    return value if len(value) <= max_length else f"{value[:max_length]}...[truncated]"


@dataclass(frozen=True)
class LogEvent:
    event: str
    outcome: Outcome
    level: int = logging.INFO
    duration_ms: float | None = None
    context: Mapping[str, Any] = field(default_factory=dict)
    exception: BaseException | None = None

    def as_extra(self) -> dict[str, Any]:
        values = _filter_context(self.context)
        if self.duration_ms is not None:
            values["duration_ms"] = round(max(self.duration_ms, 0), 3)
        if self.exception is not None:
            values.update(normalize_exception(self.exception))
        return {
            "structured_event": self.event,
            "structured_outcome": self.outcome,
            "structured_context": values,
        }


def log_event(
    logger: logging.Logger,
    event: str,
    *,
    outcome: Outcome,
    level: int = logging.INFO,
    duration_ms: float | None = None,
    exception: BaseException | None = None,
    **context: Any,
) -> None:
    """Emit a stable operational event without exposing arbitrary record data."""

    logger.log(
        level,
        event,
        extra=LogEvent(
            event=event,
            outcome=outcome,
            level=level,
            duration_ms=duration_ms,
            context=context,
            exception=exception,
        ).as_extra(),
    )


def emit_tls_only_event(
    event: str,
    *,
    outcome: Outcome,
    output_text: str,
    **context: Any,
) -> None:
    """Queue a TLS-only audit event without mirroring its raw output locally."""

    encoded_output = output_text.encode("utf-8")[:_TLS_RAW_OUTPUT_MAX_BYTES]
    raw_output = encoded_output.decode("utf-8", errors="ignore")
    payload = {
        "event": event,
        "outcome": outcome,
        **get_log_context(),
        **_filter_context(context),
        "output_text": raw_output,
        "output_truncated": len(encoded_output) < len(output_text.encode("utf-8")),
    }
    for handler in logging.getLogger().handlers:
        if isinstance(handler, TlsLogHandler):
            handler.sink.emit(payload)


class JsonStdoutFormatter(logging.Formatter):
    """Render every logging record as one privacy-safe JSON object."""

    def __init__(self, *, service: str, environment: str) -> None:
        super().__init__()
        self.service = service
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        context = get_log_context()
        context.update(
            _filter_context(getattr(record, "structured_context", {}))
        )
        event = getattr(record, "structured_event", None)
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(timespec="milliseconds").replace(
                "+00:00",
                "Z",
            ),
            "level": record.levelname.lower(),
            "event": event or f"log.{record.levelname.lower()}",
            "service": self.service,
            "environment": self.environment,
            "outcome": getattr(
                record,
                "structured_outcome",
                "failed" if record.levelno >= logging.ERROR else "succeeded",
            ),
        }
        payload.update(context)
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str)


def configure_structured_logging(settings: Settings) -> TlsLogSink | None:
    """Install JSON stdout logging and, when configured, its TLS mirror."""

    root_logger = logging.getLogger()
    for existing_handler in tuple(root_logger.handlers):
        if getattr(existing_handler, "_ad_creativity_structured_logging", False):
            root_logger.removeHandler(existing_handler)
    handler = logging.StreamHandler(sys.stdout)
    handler._ad_creativity_structured_logging = True  # type: ignore[attr-defined]
    formatter = JsonStdoutFormatter(
        service=settings.app_name,
        environment=settings.environment,
    )
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    if root_logger.level == logging.NOTSET or root_logger.level > logging.INFO:
        root_logger.setLevel(logging.INFO)
    tls_sink = TlsLogSink.from_settings(settings)
    if tls_sink is not None:
        tls_handler = TlsLogHandler(tls_sink, formatter)
        tls_handler._ad_creativity_structured_logging = True  # type: ignore[attr-defined]
        root_logger.addHandler(tls_handler)
    return tls_sink


def detach_tls_sink(sink: TlsLogSink) -> None:
    """Remove handlers that deliver to a sink before it is closed."""

    root_logger = logging.getLogger()
    for handler in tuple(root_logger.handlers):
        if isinstance(handler, TlsLogHandler) and handler.sink is sink:
            root_logger.removeHandler(handler)
