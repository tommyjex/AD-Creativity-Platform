# Text Generation Validation TLS Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record raw ModelArk text responses and safe validation details only in TLS when story, script, or storyboard response validation fails.

**Architecture:** Extend the existing TLS-only emitter with explicitly bounded exception metadata, then centralize text-response validation evidence in the ModelArk adapter. Keep raw output in a Pydantic private attribute so storyboard business validation can emit the same event without serializing model content; use the existing dual-channel formatter for the separate task lifecycle failure event.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pytest, Ruff, Volcengine TLS structured logging.

---

## File Map

- Modify `backend/app/core/logging.py`: whitelist text-stage indexes and support a bounded TLS-only exception summary.
- Modify `backend/app/services/modelark.py`: summarize validation roots, emit one TLS-only event, and retain raw output as a private result attribute.
- Modify `backend/app/services/generation.py`: emit the same event for storyboard business validation failures.
- Modify `backend/app/api/routes.py`: replace the opaque stream `logger.error()` call with a structured lifecycle failure event.
- Modify `backend/tests/test_structured_logging.py`: prove TLS-only metadata and stdout isolation.
- Modify `backend/tests/test_modelark.py`: cover sync/stream parsing, all stages, private raw output, truncation, and storyboard business validation.
- Modify `backend/tests/test_api.py`: verify the stream failure event stays sanitized and indexed.

### Task 1: Extend the TLS-only event contract

**Files:**
- Modify: `backend/app/core/logging.py`
- Test: `backend/tests/test_structured_logging.py`

- [ ] **Step 1: Write failing TLS-only contract tests**

Add a capturing `TlsLogHandler` test that calls:

```python
emit_tls_only_event(
    "aigc.text_generation.response_validation_failed",
    outcome="failed",
    output_text='{"title":"raw-model-output"}',
    exception_message="storyboard_shots.1.duration_seconds: Input should be a number",
    stage="storyboard",
    phase="response_validation",
    error_type="ModelArkTextParseError",
    validation_error_type="ValidationError",
)
```

Assert the captured TLS event contains `stage`, `phase`, `error_type`,
`validation_error_type`, `exception_message`, `output_text`, and
`output_truncated=false`. Attach a stdout handler at the same time and assert none
of the raw output or exception summary is written there.

Add a second test with `"界" * (32 * 1024)` and a 600-character exception summary;
assert the UTF-8 output is at most 32 KiB, `output_truncated=true`, and
`exception_message` is exactly 500 characters.

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_structured_logging.py \
  -k "tls_only" -q
```

Expected: FAIL because `emit_tls_only_event()` does not accept
`exception_message`, and `stage` / `validation_error_type` are filtered out.

- [ ] **Step 3: Implement the bounded TLS-only metadata**

Add `stage` and `validation_error_type` to `_SAFE_CONTEXT_FIELDS`. Extend the
emitter without placing exception text in ordinary structured context:

```python
def emit_tls_only_event(
    event: str,
    *,
    outcome: Outcome,
    output_text: str,
    exception_message: str | None = None,
    **context: Any,
) -> None:
    encoded = output_text.encode("utf-8")
    encoded_output = encoded[:_TLS_RAW_OUTPUT_MAX_BYTES]
    raw_output = encoded_output.decode("utf-8", errors="ignore")
    payload = {
        "event": event,
        "outcome": outcome,
        **get_log_context(),
        **_filter_context(context),
        "output_text": raw_output,
        "output_truncated": len(encoded_output) < len(encoded),
    }
    if exception_message is not None:
        payload["exception_message"] = exception_message[
            :_TLS_EXCEPTION_MESSAGE_MAX_LENGTH
        ]
    for handler in logging.getLogger().handlers:
        if isinstance(handler, TlsLogHandler):
            handler.sink.emit(payload)
```

Keep the current behavior when no TLS handler is installed: silently discard the
event and never fall back to stdout.

- [ ] **Step 4: Run focused tests**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_structured_logging.py -q
```

Expected: all structured logging tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/logging.py backend/tests/test_structured_logging.py
git commit -m "feat(logging): enrich TLS-only validation events"
```

### Task 2: Capture adapter response validation evidence

**Files:**
- Modify: `backend/app/services/modelark.py`
- Test: `backend/tests/test_modelark.py`

- [ ] **Step 1: Write failing validation-summary and raw-output tests**

Add tests for a synchronous `story` response with a missing `content`, a streamed
`script` response containing invalid JSON, and a streamed `storyboard` response
with an invalid shot field. Capture TLS events and assert each failure emits
exactly one:

```python
{
    "event": "aigc.text_generation.response_validation_failed",
    "outcome": "failed",
    "stage": expected_stage,
    "phase": "response_validation",
    "error_type": "ModelArkTextParseError",
    "validation_error_type": expected_root_type,
}
```

Assert the Pydantic summary contains `content` or the shot field path and error
type, but does not contain an `input` key or the request Prompt. For invalid JSON,
assert the summary includes line and column. Assert the captured `output_text`
equals the provider response.

Add a successful response test:

```python
result = asyncio.run(adapter.generate_text(request))
assert result._raw_output == provider_json
assert "_raw_output" not in result.model_dump()
assert captured_tls_events == []
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run the new test node IDs:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_modelark.py \
  -k "text_response_validation_tls or generated_text_raw_output" -q
```

Expected: FAIL because no response-validation event or private raw-output
attribute exists.

- [ ] **Step 3: Add the private raw-output attribute**

Import `PrivateAttr` and update the result model:

```python
class GeneratedTextResult(SchemaModel):
    stage: Stage
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    storyboard_shots: list[StoryboardShotCreate] = Field(default_factory=list)
    metadata: dict[str, Optional[Union[str, int, float, bool]]] = Field(
        default_factory=dict
    )
    _raw_output: str = PrivateAttr(default="")
```

After constructing successful sync and stream results, assign the local provider
text to `result._raw_output`. Do not add the value to `metadata`.

- [ ] **Step 4: Add a safe validation summary helper**

Add helpers near the text parsing functions:

```python
def _root_exception(exc: BaseException) -> BaseException:
    current = exc
    seen: set[int] = set()
    while id(current) not in seen:
        seen.add(id(current))
        next_error = current.__cause__ or current.__context__
        if next_error is None:
            return current
        current = next_error
    return current


def _response_validation_summary(exc: BaseException) -> tuple[str, str]:
    root = _root_exception(exc)
    if isinstance(root, ValidationError):
        details = [
            {
                "loc": ".".join(str(part) for part in item["loc"]),
                "type": item["type"],
                "msg": item["msg"],
            }
            for item in root.errors(
                include_url=False,
                include_context=False,
                include_input=False,
            )
        ]
        return type(root).__name__, json.dumps(
            details,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    if isinstance(root, json.JSONDecodeError):
        return type(root).__name__, (
            f"{root.msg}; line={root.lineno}; column={root.colno}"
        )
    return type(root).__name__, str(root)
```

Create `emit_text_response_validation_failed(stage, output_text, exception)` as
the single event-construction helper. It must pass the outer exception type and
root validation type separately to `emit_tls_only_event()`.

- [ ] **Step 5: Emit once from sync and stream parsing**

Initialize the raw response variable before each Provider call. In
`generate_text()` and `stream_text()`:

- On `ModelArkTextParseError`, emit with the available raw response and re-raise.
- On `ValidationError`, create the existing `ModelArkTextParseError`, emit using
  the wrapped exception, and raise it from the validation error.
- On Provider or transport errors without a response, do not emit the
  response-validation event.

Use one local helper per catch branch so the event cannot be emitted twice.

- [ ] **Step 6: Run focused and existing adapter tests**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_modelark.py \
  -k "text_response_validation_tls or generated_text_raw_output or parses_storyboard_json" \
  -q
```

Expected: all selected tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/modelark.py backend/tests/test_modelark.py
git commit -m "feat(modelark): log text validation evidence to TLS"
```

### Task 3: Cover storyboard business validation and stream lifecycle errors

**Files:**
- Modify: `backend/app/services/generation.py`
- Modify: `backend/app/api/routes.py`
- Test: `backend/tests/test_modelark.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Write a failing storyboard business-validation test**

Create an adapter that returns a parsed `GeneratedTextResult` whose shots have a
non-positive duration, and set:

```python
result._raw_output = '{"title":"分镜","content":"正文","storyboard_shots":[...]}'
```

Run both `generate_storyboard()` and `stream_storyboard()`. Assert each call
raises `ModelArkTextParseError` and independently emits one TLS-only event with
`stage=storyboard`, `validation_error_type=ModelArkTextParseError`, and the exact
private raw response. Assert `_raw_output` is absent from every serialized
result.

- [ ] **Step 2: Write a failing route lifecycle logging test**

Patch `backend.app.api.routes.log_event`, trigger the existing failed storyboard
stream fixture, and assert one call uses:

```python
log_event(
    logger,
    "text_generation.stream_failed",
    outcome="failed",
    level=logging.ERROR,
    exception=error,
    project_id=project_id,
    task_id=task_id,
    stage="storyboard",
    error_code="generation_failed",
    error_stage="response_validation",
)
```

Keep existing assertions that the SSE payload and persisted task error expose
only `phase=response_validation`.

- [ ] **Step 3: Run the new tests and confirm failure**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_modelark.py \
  backend/tests/test_api.py \
  -k "storyboard_business_validation_tls or stream_failure_structured_log" -q
```

Expected: FAIL because business validation does not emit the raw response and the
route still uses opaque `logger.error()`.

- [ ] **Step 4: Centralize storyboard shot preparation**

Add a private service method used by both synchronous and streaming storyboard
paths:

```python
def _prepare_storyboard_shots(
    self,
    result: GeneratedTextResult,
    brief: Brief,
) -> list[StoryboardShotCreate]:
    try:
        shots = self._normalize_storyboard_shot_durations(
            result.storyboard_shots,
            brief,
        )
        self._validate_storyboard_shots(shots, brief)
        return shots
    except ModelArkTextParseError as exc:
        emit_text_response_validation_failed(
            Stage.STORYBOARD,
            result._raw_output,
            exc,
        )
        raise
```

Replace both duplicated normalization and validation blocks with this method.

- [ ] **Step 5: Emit a structured route failure event**

Import `log_event` in `backend/app/api/routes.py`. Replace the plain
`logger.error()` block with `log_event()`, passing the actual exception and stable
indexes. Derive `error_stage` from `_safe_stream_error_detail(exc)`:

```python
detail = _safe_stream_error_detail(exc)
error_stage = (
    detail.removeprefix("phase=")
    if detail.startswith("phase=")
    else "text_generation"
)
```

Do not include exception text, model output, Prompt, or JSON in ordinary context.

- [ ] **Step 6: Run focused tests**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_modelark.py \
  backend/tests/test_api.py \
  -k "storyboard or stream_failure" -q
```

Expected: all selected tests pass.

- [ ] **Step 7: Commit**

```bash
git add \
  backend/app/services/generation.py \
  backend/app/api/routes.py \
  backend/tests/test_modelark.py \
  backend/tests/test_api.py
git commit -m "feat(storyboard): expose validation failures in TLS"
```

### Task 4: Regression and quality verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run the targeted regression suite**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_structured_logging.py \
  backend/tests/test_modelark.py \
  backend/tests/test_api.py -q
```

Expected: all tests pass.

- [ ] **Step 2: Run Ruff**

```bash
.venv/bin/ruff check \
  backend/app/core/logging.py \
  backend/app/services/modelark.py \
  backend/app/services/generation.py \
  backend/app/api/routes.py \
  backend/tests/test_structured_logging.py \
  backend/tests/test_modelark.py \
  backend/tests/test_api.py
```

Expected: `All checks passed!`

- [ ] **Step 3: Run compile and diff checks**

```bash
.venv/bin/python -m compileall -q backend/app
git diff --check
git status --short
```

Expected: compile and diff checks exit zero; status contains only intentional
changes, or is clean if each task was committed.

- [ ] **Step 4: Review the final diff against the security boundary**

Confirm:

- `output_text` is emitted only through `TlsLogHandler`.
- validation summaries never include Pydantic `input`.
- `_raw_output` is a `PrivateAttr` and is absent from `model_dump()`.
- successful responses produce no TLS-only raw-output event.
- Provider failures without a response preserve existing behavior.
- API, task errors, stdout, and journal remain sanitized.

- [ ] **Step 5: Record verification results**

Update the task checklist statuses in this plan with the commands and observed
pass counts. Do not amend the design document unless implementation changes the
approved contract.
