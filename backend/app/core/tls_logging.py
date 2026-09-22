"""Best-effort TLS delivery for already-sanitized structured log events."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote, urlsplit

import httpx

from .config import Settings

MAX_REQUEST_BYTES = 5 * 1024 * 1024
MAX_LOG_BYTES = 1024 * 1024
MAX_LOGS_PER_GROUP = 10_000
_SIGNING_ALGORITHM = "HMAC-SHA256"
_SIGNING_SERVICE = "TLS"
_INTERNAL_SKIP_ATTRIBUTE = "tls_skip_delivery"


def encode_log_group_list(
    events: list[Mapping[str, Any]],
    *,
    source: str,
    now: datetime | None = None,
) -> bytes:
    """Encode TLS's minimal LogGroupList protobuf without a protobuf runtime."""

    timestamp_ms = int((now or datetime.now(UTC)).timestamp() * 1000)
    logs = [
        _encode_log(timestamp_ms, json.dumps(event, separators=(",", ":"), ensure_ascii=False))
        for event in events
    ]
    log_group = b"".join(_field_bytes(1, item) for item in logs)
    if source:
        log_group += _field_bytes(4, source.encode("utf-8"))
    return _field_bytes(1, log_group)


def _encode_log(timestamp_ms: int, message: str) -> bytes:
    contents = _field_bytes(
        2,
        _field_bytes(1, b"message") + _field_bytes(2, message.encode("utf-8")),
    )
    return _field_varint(1, timestamp_ms) + contents


def _field_varint(field_number: int, value: int) -> bytes:
    return _encode_varint((field_number << 3) | 0) + _encode_varint(value)


def _field_bytes(field_number: int, value: bytes) -> bytes:
    return _encode_varint((field_number << 3) | 2) + _encode_varint(len(value)) + value


def _encode_varint(value: int) -> bytes:
    encoded = bytearray()
    while value > 0x7F:
        encoded.append((value & 0x7F) | 0x80)
        value >>= 7
    encoded.append(value)
    return bytes(encoded)


def _sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sign(key: bytes, value: str) -> bytes:
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).digest()


def _encode_query(values: Mapping[str, str]) -> str:
    return "&".join(
        f"{quote(key, safe='~-._')}={quote(value, safe='~-._')}"
        for key, value in sorted(values.items())
    )


def sign_v4_request(
    *,
    method: str,
    endpoint: str,
    path: str,
    query: Mapping[str, str],
    headers: Mapping[str, str],
    body: bytes,
    access_key_id: str,
    secret_access_key: str,
    now: datetime | None = None,
) -> dict[str, str]:
    """Return the Volcengine V4 signing headers for a TLS PutLogs request."""

    timestamp = (now or datetime.now(UTC)).astimezone(UTC)
    x_date = timestamp.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = timestamp.strftime("%Y%m%d")
    host = urlsplit(endpoint).netloc
    region = _tls_region(host)
    payload_hash = _sha256(body)
    signed_values = {
        "host": host,
        "x-date": x_date,
    }
    canonical_headers = "".join(
        f"{key}:{' '.join(value.strip().split())}\n"
        for key, value in sorted(signed_values.items())
    )
    signed_headers = ";".join(sorted(signed_values))
    canonical_request = "\n".join(
        (
            method.upper(),
            path,
            _encode_query(query),
            canonical_headers,
            signed_headers,
            payload_hash,
        )
    )
    credential_scope = f"{date_stamp}/{region}/{_SIGNING_SERVICE}/request"
    string_to_sign = "\n".join(
        (
            _SIGNING_ALGORITHM,
            x_date,
            credential_scope,
            _sha256(canonical_request.encode("utf-8")),
        )
    )
    signing_key = _sign(
        _sign(
            _sign(
                _sign(secret_access_key.encode(), date_stamp),
                region,
            ),
            _SIGNING_SERVICE,
        ),
        "request",
    )
    signature = hmac.new(
        signing_key,
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "Authorization": (
            f"{_SIGNING_ALGORITHM} Credential={access_key_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        ),
        "X-Content-Sha256": payload_hash,
        "X-Date": x_date,
    }


def _tls_region(host: str) -> str:
    hostname = host.split(":", 1)[0]
    if hostname.startswith("tls-"):
        return hostname[4:].split(".", 1)[0]
    return "cn-beijing"


class TlsLogSink:
    """Non-blocking, bounded, retrying TLS log transport."""

    def __init__(
        self,
        settings: Settings,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings
        self._queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(
            maxsize=settings.tls_queue_capacity
        )
        self._client = client or httpx.AsyncClient(timeout=settings.tls_timeout_seconds)
        self._owns_client = client is None
        self._worker: asyncio.Task[None] | None = None
        self._closed = False
        self.dropped_count = 0
        self.retried_count = 0

    @classmethod
    def from_settings(
        cls,
        settings: Settings,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> TlsLogSink | None:
        if not settings.tls_enabled:
            return None
        if (
            not settings.tls_project_id
            or not settings.tls_topic_id
            or settings.tls_access_key_id is None
            or settings.tls_secret_access_key is None
        ):
            _log_internal("tls.sink.disabled", "skipped", logging.ERROR)
            return None
        return cls(settings, client=client)

    def start(self) -> None:
        if self._worker is None and not self._closed:
            self._worker = asyncio.create_task(self._run(), name="tls-log-sink")

    def emit(self, event: Mapping[str, Any]) -> None:
        """Queue a sanitized event without waiting for the TLS transport."""

        if self._closed:
            return
        try:
            self._queue.put_nowait(dict(event))
        except asyncio.QueueFull:
            self.dropped_count += 1
            _log_internal("tls.sink.dropped", "skipped", logging.WARNING)

    async def aclose(self) -> None:
        """Stop promptly; shutdown never waits for a pending TLS retry."""

        self._closed = True
        if self._worker is not None:
            self._worker.cancel()
            try:
                await self._worker
            except asyncio.CancelledError:
                pass
            self._worker = None
        if self._owns_client:
            await self._client.aclose()

    async def _run(self) -> None:
        try:
            while True:
                batch = await self._next_batch()
                await self._deliver_with_retries(batch)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - sink errors must not stop the service.
            _log_internal("tls.sink.worker_failed", "failed", logging.ERROR)

    async def _next_batch(self) -> list[dict[str, Any]]:
        first = await self._queue.get()
        events = [first]
        deadline = (
            asyncio.get_running_loop().time()
            + self._settings.tls_flush_interval_seconds
        )
        while len(events) < min(self._settings.tls_batch_size, MAX_LOGS_PER_GROUP):
            try:
                events.append(self._queue.get_nowait())
            except asyncio.QueueEmpty:
                remaining = deadline - asyncio.get_running_loop().time()
                if remaining <= 0:
                    break
                try:
                    events.append(
                        await asyncio.wait_for(self._queue.get(), timeout=remaining)
                    )
                except TimeoutError:
                    break
        return events

    async def _deliver_with_retries(self, events: list[dict[str, Any]]) -> None:
        for chunk in self._split_events(events):
            for attempt in range(self._settings.tls_max_retries + 1):
                try:
                    await self._put_logs(chunk)
                    _log_internal("tls.sink.upload", "succeeded", logging.INFO)
                    break
                except _PermanentTlsError:
                    self.dropped_count += len(chunk)
                    _log_internal("tls.sink.dropped", "failed", logging.ERROR)
                    break
                except (httpx.HTTPError, _RetryableTlsError):
                    if attempt >= self._settings.tls_max_retries:
                        self.dropped_count += len(chunk)
                        _log_internal("tls.sink.dropped", "failed", logging.ERROR)
                        break
                    self.retried_count += 1
                    _log_internal("tls.sink.retry", "retried", logging.WARNING)
                    await asyncio.sleep(
                        self._settings.tls_retry_initial_seconds * (2**attempt)
                    )

    def _split_events(self, events: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
        chunks: list[list[dict[str, Any]]] = []
        chunk: list[dict[str, Any]] = []
        for event in events:
            if len(encode_log_group_list([event], source=self._settings.app_name)) > MAX_LOG_BYTES:
                self.dropped_count += 1
                _log_internal("tls.sink.dropped", "failed", logging.ERROR)
                continue
            candidate = [*chunk, event]
            if chunk and len(
                encode_log_group_list(candidate, source=self._settings.app_name)
            ) > MAX_REQUEST_BYTES:
                chunks.append(chunk)
                chunk = [event]
            else:
                chunk = candidate
        if chunk:
            chunks.append(chunk)
        return chunks

    async def _put_logs(self, events: list[dict[str, Any]]) -> None:
        body = encode_log_group_list(events, source=self._settings.app_name)
        endpoint = self._settings.tls_endpoint.rstrip("/")
        query = {"TopicId": self._settings.tls_topic_id}
        unsigned_headers = {
            "content-type": "application/x-protobuf",
            "x-tls-bodyrawsize": str(len(body)),
        }
        try:
            credentials = (
                self._settings.tls_access_key_id.get_secret_value(),
                self._settings.tls_secret_access_key.get_secret_value(),
            )
            headers = {
                **unsigned_headers,
                **sign_v4_request(
                    method="POST",
                    endpoint=endpoint,
                    path="/PutLogs",
                    query=query,
                    headers=unsigned_headers,
                    body=body,
                    access_key_id=credentials[0],
                    secret_access_key=credentials[1],
                ),
            }
        except Exception as exc:
            raise _PermanentTlsError from exc
        response = await self._client.post(
            f"{endpoint}/PutLogs",
            params=query,
            content=body,
            headers=headers,
        )
        if response.status_code == 429 or response.status_code >= 500:
            raise _RetryableTlsError
        if response.is_error:
            raise _PermanentTlsError


class TlsLogHandler(logging.Handler):
    """Bridge logging records to a ``TlsLogSink`` without recursive delivery."""

    def __init__(self, sink: TlsLogSink, formatter: logging.Formatter) -> None:
        super().__init__()
        self.sink = sink
        self.setFormatter(formatter)

    def emit(self, record: logging.LogRecord) -> None:
        if getattr(record, _INTERNAL_SKIP_ATTRIBUTE, False):
            return
        try:
            self.sink.emit(json.loads(self.format(record)))
        except Exception:  # noqa: BLE001 - logging must not alter application flow.
            self.handleError(record)


class _RetryableTlsError(Exception):
    pass


class _PermanentTlsError(Exception):
    pass


def _log_internal(event: str, outcome: str, level: int) -> None:
    logging.getLogger("backend.app.core.tls_logging").log(
        level,
        event,
        extra={
            "structured_event": event,
            "structured_outcome": outcome,
            "structured_context": {},
            _INTERNAL_SKIP_ATTRIBUTE: True,
        },
    )
