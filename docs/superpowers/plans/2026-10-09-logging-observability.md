# Logging Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HTTP and AIGC failures consistently searchable while preserving raw exception summaries only in TLS and draining queued TLS events during normal shutdown.

**Architecture:** Keep the existing structured logging API, but render each `LogRecord` through separate stdout and TLS formatter modes. Centralize HTTP status classification and AIGC task failure emission, then give the TLS transport a bounded sentinel-based shutdown path so events queued before shutdown are delivered when possible.

**Tech Stack:** Python 3.12, FastAPI, asyncio, standard-library logging/traceback/hashlib, httpx, Pydantic Settings, pytest, Ruff

---

## File Map

- Modify `backend/app/core/logging.py`: error-field contract, TLS-only exception summary, channel-aware formatting.
- Modify `backend/app/main.py`: HTTP completion classification and TLS lifecycle use.
- Modify `backend/app/core/tls_logging.py`: sentinel-based bounded queue drain.
- Modify `backend/app/core/config.py`: shutdown timeout setting.
- Modify `.env.example`: document the shutdown timeout.
- Modify `backend/app/services/aigc_executor.py`: one task-failure logging path and removal of temporary debug reporting.
- Modify `backend/tests/test_structured_logging.py`: stdout/TLS isolation and exception-summary tests.
- Modify `backend/tests/test_main.py`: HTTP 2xx/4xx/5xx and origin-guard logging tests.
- Modify `backend/tests/test_tls_logging.py`: graceful drain and timeout tests.
- Modify `backend/tests/test_config.py`: shutdown timeout defaults and environment parsing.
- Modify `backend/tests/test_aigc_executor.py`: uniform task failure field tests.

### Task 1: Channel-aware structured exception summaries

**Files:**
- Modify: `backend/app/core/logging.py:20-305`
- Test: `backend/tests/test_structured_logging.py`

- [ ] **Step 1: Write failing stdout/TLS isolation tests**

Add a helper that formats the same record in both modes and verify explicit error
fields are shared while raw exception details remain TLS-only:

```python
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
    assert tls_event["exception_message"] == "Authorization=raw-provider-value"
    assert len(tls_event["traceback_fingerprint"]) == 64
    assert len(tls_event["stack_frames"]) <= 3
```

Add a second test using `log_event()` with explicit `error_code`,
`error_stage`, and `error_type`, asserting the explicit type overrides the
automatic wrapper type and a 600-character message is truncated to 500
characters only in TLS mode.

- [ ] **Step 2: Run the new tests and confirm failure**

Run:

```bash
.venv/bin/pytest \
  backend/tests/test_structured_logging.py::test_tls_formatter_adds_raw_exception_summary_without_leaking_to_stdout \
  -q
```

Expected: failure because `JsonStdoutFormatter` does not accept
`include_tls_exception_details` and does not serialize exception summaries.

- [ ] **Step 3: Implement the channel-aware formatter contract**

In `backend/app/core/logging.py`:

```python
import hashlib
import traceback
from pathlib import Path

_TLS_EXCEPTION_MESSAGE_MAX_LENGTH = 500
_TLS_STACK_FRAME_LIMIT = 3
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
```

Add `error_stage` to `_SAFE_CONTEXT_FIELDS`. Add helpers with these exact
interfaces:

```python
def _root_exception(exc: BaseException) -> BaseException:
    current = exc
    seen: set[int] = set()
    while id(current) not in seen:
        seen.add(id(current))
        next_exc = current.__cause__ or current.__context__
        if next_exc is None:
            break
        current = next_exc
    return current


def _tls_exception_summary(exc: BaseException) -> dict[str, Any]:
    root = _root_exception(exc)
    frames: list[dict[str, Any]] = []
    for frame in traceback.extract_tb(root.__traceback__):
        path = Path(frame.filename).resolve()
        try:
            relative = path.relative_to(_PROJECT_ROOT)
        except ValueError:
            continue
        if not relative.parts or relative.parts[0] != "backend":
            continue
        frames.append({
            "path": relative.as_posix(),
            "function": frame.name,
            "line": frame.lineno,
        })
    frames = frames[-_TLS_STACK_FRAME_LIMIT:]
    fingerprint_source = json.dumps(
        {
            "types": [
                type(item).__name__
                for item in _exception_chain(exc)
            ],
            "frames": frames,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return {
        "exception_message": str(root)[:_TLS_EXCEPTION_MESSAGE_MAX_LENGTH],
        "traceback_fingerprint": hashlib.sha256(
            fingerprint_source.encode("utf-8")
        ).hexdigest(),
        "stack_frames": frames,
    }
```

Store the summary on the record as `tls_exception_summary`, outside
`structured_context`. Change `JsonStdoutFormatter.__init__` to accept:

```python
def __init__(
    self,
    *,
    service: str,
    environment: str,
    include_tls_exception_details: bool = False,
) -> None:
```

When `record.exc_info` exists, add safe `error_type` to both channels and add
the summary only when `include_tls_exception_details` is true. In
`configure_structured_logging()`, keep the default formatter on stdout and
construct a second formatter with `include_tls_exception_details=True` for
`TlsLogHandler`.

Make explicit structured `error_type` win over automatic inference by merging
automatic exception metadata first, then sanitized explicit context.

- [ ] **Step 4: Run structured logging tests**

Run:

```bash
.venv/bin/pytest backend/tests/test_structured_logging.py backend/tests/test_auth_logging.py -q
```

Expected: all tests pass; stdout assertions contain no exception message or
Traceback, while TLS-mode tests contain the approved summary.

- [ ] **Step 5: Commit the structured logging contract**

```bash
git add backend/app/core/logging.py \
  backend/tests/test_structured_logging.py \
  backend/tests/test_auth_logging.py
git commit -m "feat(logging): add TLS-only exception summaries"
```

### Task 2: Correct HTTP failure semantics

**Files:**
- Modify: `backend/app/main.py:175-252`
- Test: `backend/tests/test_main.py`

- [ ] **Step 1: Write status-classification tests**

Add temporary test routes returning 302, 404, and 503, capture `log_event`,
and assert the completion contexts:

```python
assert completed[302]["outcome"] == "succeeded"
assert completed[302]["level"] == logging.INFO
assert completed[404]["outcome"] == "failed"
assert completed[404]["level"] == logging.WARNING
assert completed[503]["outcome"] == "failed"
assert completed[503]["level"] == logging.ERROR
```

Add an origin-guard test asserting its direct `403` produces
`outcome="failed"`, `level=logging.WARNING`, `status_code=403`, and
`error_code="origin_forbidden"`.

- [ ] **Step 2: Run the new HTTP tests and confirm failure**

Run:

```bash
.venv/bin/pytest backend/tests/test_main.py -q
```

Expected: 404 and 503 completion events are currently `succeeded`; the direct
origin-guard 403 has no completion log.

- [ ] **Step 3: Add centralized HTTP completion classification**

Add:

```python
def _http_completion(status_code: int) -> tuple[str, int]:
    if status_code >= 500:
        return "failed", logging.ERROR
    if status_code >= 400:
        return "failed", logging.WARNING
    return "succeeded", logging.INFO
```

Use this helper for every completed Response. Before returning the origin
guard response, emit the same completion shape with:

```python
log_event(
    logger,
    "http.request",
    outcome="failed",
    level=logging.WARNING,
    duration_ms=(perf_counter() - started_at) * 1000,
    method=request.method,
    route=route,
    status_code=403,
    error_code="origin_forbidden",
    error_stage="origin_guard",
    error_type="OriginForbidden",
)
```

- [ ] **Step 4: Run HTTP logging tests**

Run:

```bash
.venv/bin/pytest backend/tests/test_main.py backend/tests/test_auth_api.py -q
```

Expected: all tests pass, including CORS/origin behavior regressions.

- [ ] **Step 5: Commit HTTP semantics**

```bash
git add backend/app/main.py backend/tests/test_main.py
git commit -m "feat(logging): classify HTTP error responses"
```

### Task 3: Gracefully drain TLS on shutdown

**Files:**
- Modify: `backend/app/core/tls_logging.py:166-365`
- Modify: `backend/app/core/config.py:190-201,482-521`
- Modify: `.env.example:64-77`
- Test: `backend/tests/test_tls_logging.py`
- Test: `backend/tests/test_config.py`

- [ ] **Step 1: Write graceful shutdown transport tests**

Add a test with `tls_batch_size=100` and `tls_flush_interval_seconds=60` that
emits one event and immediately calls `aclose()`. Assert one request contains
the event, proving close interrupts the batch wait and drains it.

Add a second test whose mock transport never completes. Configure
`tls_shutdown_timeout_seconds=1`, call `aclose()`, and assert it returns within
the timeout budget, closes the owned worker, and increments
`dropped_count`.

Update config tests:

```python
assert settings.tls_shutdown_timeout_seconds == 5
monkeypatch.setenv("TLS_SHUTDOWN_TIMEOUT_SECONDS", "7")
assert Settings.from_env().tls_shutdown_timeout_seconds == 7
```

- [ ] **Step 2: Run TLS/config tests and confirm failure**

Run:

```bash
.venv/bin/pytest backend/tests/test_tls_logging.py backend/tests/test_config.py -q
```

Expected: immediate close drops the partial batch and the new setting does not
exist.

- [ ] **Step 3: Add configuration and sentinel-based shutdown**

Add to `Settings` and `Settings.from_env()`:

```python
tls_shutdown_timeout_seconds: int = Field(default=5, gt=0)

tls_shutdown_timeout_seconds=_parse_positive_int_env(
    "TLS_SHUTDOWN_TIMEOUT_SECONDS",
    cls.model_fields["tls_shutdown_timeout_seconds"].default,
),
```

Add `TLS_SHUTDOWN_TIMEOUT_SECONDS=5` to `.env.example`.

In `tls_logging.py`, define a private sentinel:

```python
_STOP = object()
```

Change the queue type to `asyncio.Queue[dict[str, Any] | object]`.
Make `_next_batch()` return `(events, stop_after_batch)`, ending its wait as
soon as `_STOP` is read. Make `_run()` deliver a non-empty final batch and
return when `stop_after_batch` is true.

Implement bounded close:

```python
async def aclose(self) -> None:
    self._closed = True
    worker = self._worker
    if worker is not None:
        async def stop_and_wait() -> None:
            await self._queue.put(_STOP)
            await worker

        try:
            await asyncio.wait_for(
                stop_and_wait(),
                timeout=self._settings.tls_shutdown_timeout_seconds,
            )
        except TimeoutError:
            self.dropped_count += sum(
                1 for item in list(self._queue._queue) if item is not _STOP
            )
            worker.cancel()
            with suppress(asyncio.CancelledError):
                await worker
            _log_internal(
                "tls.sink.shutdown_timeout",
                "failed",
                logging.ERROR,
            )
        self._worker = None
    if self._owns_client:
        await self._client.aclose()
```

Do not expose the queue internals outside `TlsLogSink`; if counting queued
items requires a helper, keep it private. Preserve queue-full, retry, size
limit, and recursion behavior.

- [ ] **Step 4: Run TLS/config tests**

Run:

```bash
.venv/bin/pytest \
  backend/tests/test_tls_logging.py \
  backend/tests/test_config.py \
  backend/tests/test_main.py -q
```

Expected: all tests pass, including startup-failure and normal lifespan close.

- [ ] **Step 5: Commit graceful shutdown**

```bash
git add backend/app/core/tls_logging.py \
  backend/app/core/config.py \
  .env.example \
  backend/tests/test_tls_logging.py \
  backend/tests/test_config.py
git commit -m "feat(logging): drain TLS events on shutdown"
```

### Task 4: Normalize all AIGC task failure events

**Files:**
- Modify: `backend/app/services/aigc_executor.py:1600-2075`
- Test: `backend/tests/test_aigc_executor.py`
- Test: `backend/tests/test_structured_logging.py`

- [ ] **Step 1: Write failure-event contract tests**

Capture `executor_module.log_event` in three focused runtime scenarios:

1. Gateway failure with `AigcTaskError(code="provider_error",
   stage="provider_call", request_id="provider-1")`.
2. Worker cancellation while a blocking gateway is active.
3. Recovery of a pre-existing RUNNING attempt.

For every final `aigc.task` failure event assert:

```python
assert context["outcome"] == "failed"
assert context["error_code"]
assert context["error_stage"]
assert context["error_type"]
```

For the provider scenario additionally assert
`provider_request_id == "provider-1"`. Add a source scan assertion proving
`127.0.0.1:7777`, `video-ocr-worker-error`, and `#region debug-point` are absent
from `backend/app/services/aigc_executor.py`.

- [ ] **Step 2: Run focused AIGC tests and confirm failure**

Run:

```bash
.venv/bin/pytest \
  backend/tests/test_aigc_executor.py -k \
  "failure_event or interrupted or recovery" -q
```

Expected: cancellation/recovery events lack uniform error fields and stale
debug reporting markers remain in the source.

- [ ] **Step 3: Add one task failure emitter**

Add module-level helpers:

```python
def _task_log_context(task: AigcPipelineTaskAttempt) -> dict[str, str]:
    return {
        "pipeline_id": task.pipeline_id,
        "run_id": task.run_id,
        "node_id": task.node_id,
        "task_id": task.task_id,
        "attempt_id": str(task.attempt),
        "task_type": task.type.value,
    }


def _log_task_failure(
    task: AigcPipelineTaskAttempt,
    error: AigcTaskError,
    *,
    exception: BaseException | None = None,
    error_type: str,
    level: int = logging.WARNING,
) -> None:
    log_event(
        logger,
        "aigc.task",
        outcome="failed",
        level=level,
        exception=exception,
        error_code=error.code,
        error_stage=error.stage or "worker",
        error_type=error_type,
        provider_request_id=error.request_id,
        **_task_log_context(task),
    )
```

Use it after accepted persistence in every final failure path:

- cancellation: `error_type="CancelledError"`;
- recovery: `error_type="WorkerInterrupted"`;
- parser: `error_type=type(exc).__name__`;
- gateway: root cause type, with `AigcGatewayError` as fallback;
- unknown worker error: `type(exc).__name__`, level ERROR;
- isolated worker item: pass the original exception into
  `_isolate_worker_item_failure(task_id, exc)` and use its type.

Keep retry events separate. Do not log a final failure when fencing rejects a
commit. Replace the local `task_context` construction with
`_task_log_context(task)`.

Delete all temporary blocks marked `#region debug-point` and their inline
`urllib.request` imports. Do not alter task status, retry, cleanup, scheduling,
or finalization behavior.

- [ ] **Step 4: Run AIGC and structured logging tests**

Run:

```bash
.venv/bin/pytest \
  backend/tests/test_aigc_executor.py \
  backend/tests/test_structured_logging.py -q
```

Expected: all tests pass and the source scan finds no debug reporting
dependencies.

- [ ] **Step 5: Commit AIGC failure normalization**

```bash
git add backend/app/services/aigc_executor.py \
  backend/tests/test_aigc_executor.py \
  backend/tests/test_structured_logging.py
git commit -m "feat(logging): normalize AIGC task failures"
```

### Task 5: Integrated verification

**Files:**
- Verify all files changed in Tasks 1-4.

- [ ] **Step 1: Run the focused observability suite**

```bash
.venv/bin/pytest \
  backend/tests/test_structured_logging.py \
  backend/tests/test_auth_logging.py \
  backend/tests/test_tls_logging.py \
  backend/tests/test_config.py \
  backend/tests/test_main.py \
  backend/tests/test_auth_api.py \
  backend/tests/test_aigc_executor.py -q
```

Expected: all selected tests pass.

- [ ] **Step 2: Run static checks**

```bash
.venv/bin/ruff check \
  backend/app/core/logging.py \
  backend/app/core/tls_logging.py \
  backend/app/core/config.py \
  backend/app/main.py \
  backend/app/services/aigc_executor.py \
  backend/tests/test_structured_logging.py \
  backend/tests/test_tls_logging.py \
  backend/tests/test_config.py \
  backend/tests/test_main.py \
  backend/tests/test_aigc_executor.py
```

Expected: no Ruff violations.

- [ ] **Step 3: Verify channel separation with targeted assertions**

Run:

```bash
.venv/bin/pytest backend/tests/test_structured_logging.py -q
```

Expected: tests prove raw exception messages appear in TLS mode and never in
stdout mode.

- [ ] **Step 4: Inspect final diff and worktree isolation**

```bash
git status --short
git diff --check HEAD~4..HEAD
git log -5 --oneline
```

Expected: implementation commits contain only backend logging, configuration,
tests, `.env.example`, and plan documentation. Pre-existing
`frontend/lib/api-client.ts` and debug-session files remain untouched.
