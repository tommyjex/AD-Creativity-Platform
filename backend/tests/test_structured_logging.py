import asyncio
import json
import logging
from io import StringIO
from pathlib import Path

from backend.app.core.logging import (
    JsonStdoutFormatter,
    bind_log_context,
    log_event,
    reset_log_context,
    sanitize_value,
)


def _logger_with_output() -> tuple[logging.Logger, StringIO]:
    output = StringIO()
    handler = logging.StreamHandler(output)
    handler.setFormatter(
        JsonStdoutFormatter(
            service="ad-creativity-test",
            environment="test",
        )
    )
    logger = logging.getLogger("structured-logging-test")
    logger.handlers[:] = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger, output


def test_log_event_serializes_stable_json_contract_and_context() -> None:
    logger, output = _logger_with_output()
    token = bind_log_context(request_id="request-123", ignored="not-logged")
    try:
        log_event(
            logger,
            "provider.call.completed",
            outcome="succeeded",
            duration_ms=12.3456,
            run_id="run-123",
            prompt="never emit this",
        )
    finally:
        reset_log_context(token)

    event = json.loads(output.getvalue())

    assert event["event"] == "provider.call.completed"
    assert event["level"] == "info"
    assert event["service"] == "ad-creativity-test"
    assert event["environment"] == "test"
    assert event["outcome"] == "succeeded"
    assert event["request_id"] == "request-123"
    assert event["run_id"] == "run-123"
    assert event["duration_ms"] == 12.346
    assert event["timestamp"].endswith("Z")
    assert "ignored" not in event
    assert "prompt" not in event


def test_formatter_redacts_sensitive_values_and_strips_url_queries() -> None:
    assert sanitize_value("authorization", "Bearer top-secret") == "[REDACTED]"
    assert sanitize_value("download_url", "https://example.test/file?signature=secret") == (
        "https://example.test/file"
    )
    assert sanitize_value("details", {"secret_key": "value"}) == {
        "secret_key": "[REDACTED]"
    }
    assert sanitize_value("details", "x" * 300).endswith("...[truncated]")


def test_exception_logging_keeps_only_safe_exception_metadata() -> None:
    logger, output = _logger_with_output()
    error = RuntimeError(
        "Authorization=super-secret https://example.test/request?signature=secret"
    )
    error.code = "ProviderRejected"  # type: ignore[attr-defined]

    log_event(
        logger,
        "provider.call.failed",
        outcome="failed",
        level=logging.ERROR,
        exception=error,
    )

    event = json.loads(output.getvalue())

    assert event["error_type"] == "RuntimeError"
    assert event["error_code"] == "ProviderRejected"
    assert "super-secret" not in output.getvalue()
    assert "signature=secret" not in output.getvalue()
    assert "Traceback" not in output.getvalue()


def test_tls_formatter_adds_raw_exception_summary_without_leaking_to_stdout() -> None:
    try:
        raise RuntimeError("Authorization=raw-provider-value")
    except RuntimeError as error:
        record = logging.LogRecord(
            "test",
            logging.ERROR,
            __file__,
            1,
            "provider failed",
            (),
            (type(error), error, error.__traceback__),
        )

    stdout_event = json.loads(
        JsonStdoutFormatter(
            service="test",
            environment="test",
        ).format(record)
    )
    tls_event = json.loads(
        JsonStdoutFormatter(
            service="test",
            environment="test",
            include_tls_exception_details=True,
        ).format(record)
    )

    assert stdout_event["error_type"] == "RuntimeError"
    assert "exception_message" not in stdout_event
    assert "raw-provider-value" not in json.dumps(stdout_event)
    assert tls_event["exception_message"] == "Authorization=raw-provider-value"
    assert len(tls_event["traceback_fingerprint"]) == 64
    assert len(tls_event["stack_frames"]) <= 3


def test_explicit_error_fields_override_inference_and_tls_message_is_bounded() -> None:
    stdout = StringIO()
    tls = StringIO()
    logger = logging.getLogger("structured-logging-dual-channel-test")
    logger.handlers[:] = []
    logger.setLevel(logging.INFO)
    logger.propagate = False
    for output, include_tls_details in ((stdout, False), (tls, True)):
        handler = logging.StreamHandler(output)
        handler.setFormatter(
            JsonStdoutFormatter(
                service="test",
                environment="test",
                include_tls_exception_details=include_tls_details,
            )
        )
        logger.addHandler(handler)

    try:
        raise ValueError("x" * 600)
    except ValueError as error:
        log_event(
            logger,
            "provider.call.failed",
            outcome="failed",
            level=logging.ERROR,
            exception=error,
            error_code="provider_rejected",
            error_stage="provider_response",
            error_type="GatewayError",
        )

    stdout_event = json.loads(stdout.getvalue())
    tls_event = json.loads(tls.getvalue())
    for event in (stdout_event, tls_event):
        assert event["error_code"] == "provider_rejected"
        assert event["error_stage"] == "provider_response"
        assert event["error_type"] == "GatewayError"
    assert "exception_message" not in stdout_event
    assert tls_event["exception_message"] == "x" * 500


def test_async_contexts_do_not_cross_contaminate() -> None:
    logger, output = _logger_with_output()

    async def emit(request_id: str) -> None:
        token = bind_log_context(request_id=request_id)
        try:
            await asyncio.sleep(0)
            log_event(logger, "request.completed", outcome="succeeded")
        finally:
            reset_log_context(token)

    async def run_emissions() -> None:
        await asyncio.gather(emit("request-a"), emit("request-b"))

    asyncio.run(run_emissions())

    events = [json.loads(line) for line in output.getvalue().splitlines()]
    assert {event["request_id"] for event in events} == {"request-a", "request-b"}


def test_business_code_has_no_local_debug_reporting_dependencies() -> None:
    app_root = Path(__file__).parents[1] / "app"
    source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in app_root.rglob("*.py")
    )

    assert ".dbg/" not in source
    assert "DEBUG_SERVER_URL" not in source
    assert "127.0.0.1:7777" not in source
    assert "127.0.0.1:7779" not in source
    assert "127.0.0.1:7780" not in source
