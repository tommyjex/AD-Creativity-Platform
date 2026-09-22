import asyncio
import json
from datetime import UTC, datetime

import httpx
from backend.app.core.config import Settings
from backend.app.core.logging import JsonStdoutFormatter
from backend.app.core.tls_logging import (
    TlsLogHandler,
    TlsLogSink,
    encode_log_group_list,
    sign_v4_request,
)


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_name": "ad-creativity-test",
        "environment": "test",
        "tls_enabled": True,
        "tls_endpoint": "https://tls-cn-beijing.volces.com",
        "tls_project_id": "project-1",
        "tls_topic_id": "topic-1",
        "tls_access_key_id": "access-key-id",
        "tls_secret_access_key": "secret-access-key",
        "tls_batch_size": 1,
        "tls_queue_capacity": 10,
        "tls_flush_interval_seconds": 60,
        "tls_max_retries": 1,
        "tls_retry_initial_seconds": 1,
        "tls_timeout_seconds": 5,
    }
    values.update(overrides)
    return Settings(**values)


def test_minimal_log_group_list_contains_tls_message_and_millisecond_time() -> None:
    payload = encode_log_group_list(
        [{"event": "http.request", "request_id": "request-1"}],
        source="ad-creativity-test",
        now=datetime(2026, 9, 20, tzinfo=UTC),
    )

    assert b"message" in payload
    assert b"http.request" in payload
    assert b"request-1" in payload
    assert b"ad-creativity-test" in payload
    assert b"\x22\x12ad-creativity-test" in payload


def test_v4_signing_is_deterministic_and_never_embeds_the_secret() -> None:
    headers = sign_v4_request(
        method="POST",
        endpoint="https://tls-cn-beijing.volces.com",
        path="/PutLogs",
        query={"TopicId": "topic 1"},
        headers={
            "content-type": "application/x-protobuf",
            "x-tls-bodyrawsize": "3",
        },
        body=b"abc",
        access_key_id="access-key-id",
        secret_access_key="secret-access-key",
        now=datetime(2026, 9, 20, 12, 34, 56, tzinfo=UTC),
    )

    assert headers["X-Date"] == "20260920T123456Z"
    assert headers["X-Content-Sha256"] == (
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
    assert "Credential=access-key-id/20260920/cn-beijing/TLS/request" in headers[
        "Authorization"
    ]
    assert "topic 1" not in headers["Authorization"]
    assert "secret-access-key" not in json.dumps(headers)


def test_sink_posts_signed_protobuf_and_handler_does_not_recurse() -> None:
    captured: list[httpx.Request] = []

    async def run() -> None:
        async def receive(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return httpx.Response(200)

        async with httpx.AsyncClient(transport=httpx.MockTransport(receive)) as client:
            sink = TlsLogSink(_settings(), client=client)
            sink.start()
            sink.emit({"event": "http.request", "request_id": "request-1"})
            await _wait_for(lambda: len(captured) == 1)

            handler = TlsLogHandler(
                sink,
                JsonStdoutFormatter(service="test", environment="test"),
            )
            record = __import__("logging").LogRecord(
                "tls-test",
                20,
                __file__,
                1,
                "internal",
                (),
                None,
            )
            record.tls_skip_delivery = True
            handler.emit(record)
            await asyncio.sleep(0)
            assert len(captured) == 1
            await sink.aclose()

    asyncio.run(run())

    request = captured[0]
    assert request.url.path == "/PutLogs"
    assert request.url.params["TopicId"] == "topic-1"
    assert request.headers["content-type"] == "application/x-protobuf"
    assert request.headers["x-tls-bodyrawsize"] == str(len(request.content))
    assert "HMAC-SHA256 Credential=access-key-id/" in request.headers["authorization"]
    assert "secret-access-key" not in str(request.headers)
    assert b"http.request" in request.content


def test_sink_retries_rate_limits_then_drops_when_queue_is_full() -> None:
    requests = 0

    async def run() -> TlsLogSink:
        nonlocal requests

        async def receive(request: httpx.Request) -> httpx.Response:
            nonlocal requests
            requests += 1
            return httpx.Response(429 if requests == 1 else 200)

        async with httpx.AsyncClient(transport=httpx.MockTransport(receive)) as client:
            sink = TlsLogSink(
                _settings(tls_queue_capacity=1, tls_retry_initial_seconds=1),
                client=client,
            )
            sink.emit({"event": "first"})
            sink.emit({"event": "discarded"})
            assert sink.dropped_count == 1
            sink.start()
            await _wait_for(lambda: requests == 2, timeout_seconds=2.5)
            assert sink.retried_count == 1
            await sink.aclose()
            return sink

    sink = asyncio.run(run())

    assert requests == 2
    assert sink.dropped_count == 1


def test_sink_batches_until_the_configured_threshold() -> None:
    captured: list[httpx.Request] = []

    async def run() -> None:
        async def receive(request: httpx.Request) -> httpx.Response:
            captured.append(request)
            return httpx.Response(200)

        async with httpx.AsyncClient(transport=httpx.MockTransport(receive)) as client:
            sink = TlsLogSink(
                _settings(tls_batch_size=2, tls_flush_interval_seconds=60),
                client=client,
            )
            sink.start()
            sink.emit({"event": "first"})
            await asyncio.sleep(0)
            assert captured == []
            sink.emit({"event": "second"})
            await _wait_for(lambda: len(captured) == 1)
            await sink.aclose()

    asyncio.run(run())

    assert b"first" in captured[0].content
    assert b"second" in captured[0].content


def test_disabled_or_incomplete_tls_never_creates_a_sink() -> None:
    assert TlsLogSink.from_settings(Settings()) is None
    assert TlsLogSink.from_settings(_settings(tls_access_key_id=None)) is None


async def _wait_for(
    predicate,
    *,
    timeout_seconds: float = 1,
) -> None:
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    while not predicate():
        if asyncio.get_running_loop().time() >= deadline:
            raise AssertionError("timed out waiting for TLS transport")
        await asyncio.sleep(0.01)
