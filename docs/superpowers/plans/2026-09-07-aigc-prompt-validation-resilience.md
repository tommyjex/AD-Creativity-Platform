# AIGC Prompt Validation Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent low-risk formatting and language deviations from making AIGC prompt optimization unavailable while retaining hard protection for references and explicit user facts.

**Architecture:** Provider parsing remains in `modelark.py`; deterministic section repair runs before schema validation. `prompt_optimization.py` returns a rendered response plus warning codes, while unsafe output raises a dedicated error. `generation.py` logs warnings and `aigc_routes.py` maps unsafe output to 422 while preserving 502 for provider failures.

**Tech Stack:** Python 3.14, FastAPI, Pydantic v2, pytest, ModelArk Responses API

---

### Task 1: Introduce Validation Outcomes

**Files:**
- Modify: `backend/app/services/prompt_optimization.py`
- Modify: `backend/app/services/modelark.py`
- Test: `backend/tests/test_prompt_optimization.py`

- [ ] **Step 1: Write failing tests for warning acceptance and hard failures**

Add tests proving non-English prose, subject keyword misses, negative-prompt
heuristics, and non-object numeric additions return a response with warning codes.
Keep tests proving BBox/reference cardinality, protected brands/models/visible copy,
canonical quantity anchors, and explicit exclusions still raise.
When the input has no reference instructions, provider-authored extras are discarded
with a warning because they have no valid write-back target.

```python
result = render_image_prompt_sections_with_warnings(
    request,
    image_sections(subject="Create a red 产品 image."),
)
assert result.response.optimized_text
assert "non_english_content" in result.warnings
```

Run:

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_prompt_optimization.py -q
```

Expected: new warning tests fail because the detailed result API does not exist.

- [ ] **Step 2: Add internal result and safety error types**

Define:

```python
@dataclass(frozen=True)
class PromptOptimizationRenderResult:
    response: AigcPromptOptimizeResponse
    warnings: tuple[str, ...] = ()


class PromptOptimizationSafetyError(ModelArkTextParseError):
    """Model output violated a non-negotiable user-data constraint."""
```

Keep `render_image_prompt_sections()` as a compatibility wrapper returning only
`.response`.

- [ ] **Step 3: Run focused tests**

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_prompt_optimization.py -q
```

Expected: outcome API tests pass; existing hard-failure tests remain green.

### Task 2: Normalize Provider Structure

**Files:**
- Modify: `backend/app/schemas/aigc.py`
- Modify: `backend/app/services/modelark.py`
- Test: `backend/tests/test_aigc_schemas.py`
- Test: `backend/tests/test_modelark.py`

- [ ] **Step 1: Write failing parser tests**

Cover:

```python
payload = {
    "sections": [
        {"label": "Subject:", "content": "Show the product."},
        {"label": "Lighting", "content": "Use soft light."},
        {"label": "Negative Prompt", "content": "Avoid blur."},
    ],
    "optimized_reference_instructions": [],
}
```

Assert trailing label punctuation is normalized, missing `Composition` remains
renderable, and a unique `Negative Prompt` is moved last. Malformed JSON, non-list
sections, empty content, and more than 20 sections must still fail parsing.

- [ ] **Step 2: Relax the internal section schema**

Allow 1-20 sections and remove model-level requirements that force exactly one
`Composition`, exactly one final `Negative Prompt`, and case-insensitive unique
labels. Keep non-empty labels/content and length limits.

- [ ] **Step 3: Extend deterministic normalization**

Before Pydantic validation:

```python
label = re.sub(r"\s+", " ", label).strip().rstrip(":")
```

Move unique `Composition` and `Negative Prompt` to their preferred final positions.
Do not generate missing creative sections.

- [ ] **Step 4: Run parser and schema tests**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_modelark.py -q -k "prompt or section"
```

Expected: parser normalization passes and malformed structures remain rejected.

### Task 3: Split Hard Rules from Warnings

**Files:**
- Modify: `backend/app/services/prompt_optimization.py`
- Modify: `backend/app/services/generation.py`
- Test: `backend/tests/test_prompt_optimization.py`

- [ ] **Step 1: Keep hard validation direct**

Raise `PromptOptimizationSafetyError` for:

```python
hard_checks = (
    reference_count,
    nonempty_reference_instructions,
    bbox_and_protected_reference_literals,
    explicit_identity_quantity_and_exclusion_anchors,
    protected_brand_model_url_visible_copy,
    output_length,
)
```

Exclude unbound bare numbers from image prompt literal-count checks; explicit object
quantities remain protected by canonical quantity anchors.

- [ ] **Step 2: Collect quality warnings**

Convert these validators to warning collection:

```python
soft_checks = {
    "non_english_content": validate_english,
    "required_subject_term_missing": validate_required_terms,
    "reference_action_wording_changed": validate_reference_actions,
    "negative_prompt_possible_conflict": validate_negative_prompt,
    "unrequested_non_object_number": validate_no_unrequested_quantities,
}
```

Strip outer code fences and leading Markdown list/header markers before rendering.
Do not drop section content.

- [ ] **Step 3: Log warnings in the orchestration layer**

Use the existing module logger:

```python
for warning in rendered.warnings:
    logger.warning(
        "AIGC prompt optimization accepted with warning",
        extra={"warning_code": warning, "target_type": request.target_type},
    )
```

Return `rendered.response`.

- [ ] **Step 4: Run service tests**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_prompt_optimization.py \
  backend/tests/test_modelark.py -q
```

Expected: warning scenarios return usable prompts; hard constraints still fail.

### Task 4: Distinguish 422 from 502

**Files:**
- Modify: `backend/app/api/aigc_routes.py`
- Test: `backend/tests/test_aigc_routes.py`

- [ ] **Step 1: Add failing route tests**

Inject one adapter that raises `PromptOptimizationSafetyError` and one that raises
`ModelArkProviderError`.

```python
assert unsafe_response.status_code == 422
assert unsafe_response.json()["detail"]["code"] == "validation_error"
assert provider_response.status_code == 502
assert provider_response.json()["detail"]["code"] == "external_service_error"
```

- [ ] **Step 2: Add ordered exception mapping**

Catch `PromptOptimizationSafetyError` before `ModelArkProviderError`:

```python
except PromptOptimizationSafetyError as exc:
    raise _error(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        ErrorCode.VALIDATION_ERROR,
        "Optimized prompt could not safely preserve required constraints",
    ) from exc
except ModelArkProviderError as exc:
    raise _error(
        status.HTTP_502_BAD_GATEWAY,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        "AIGC prompt optimization failed",
    ) from exc
```

- [ ] **Step 3: Run route tests**

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_aigc_routes.py -q -k "prompt"
```

Expected: unsafe output is 422, provider failure is 502, warning output is 200.

### Task 5: Regression and Runtime Verification

**Files:**
- Modify: `debug-prompt-validation-fragility.md`
- Retain temporarily: instrumentation in `backend/app/services/generation.py`

- [ ] **Step 1: Run the complete focused backend suite**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_prompt_optimization.py \
  backend/tests/test_modelark.py \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_routes.py -q
```

Expected: all focused tests pass.

- [ ] **Step 2: Restart backend and clear post-fix debug logs**

Start the backend with `.venv/bin/python -m uvicorn ...`, keep the debug server
running, clear `.dbg/trae-debug-log-prompt-validation-fragility.ndjson`, and use
`runId="post-fix"` in retained instrumentation.

- [ ] **Step 3: Execute the current pipeline request ten times**

Each request must return HTTP 200 unless the provider itself fails. Inspect the NDJSON
file directly and verify warning acceptance rather than validation failure.

- [ ] **Step 4: Request user confirmation**

Keep instrumentation, debug record, env file, and debug server until the user confirms
the browser workflow is fixed. On confirmation, remove instrumentation and all debug
artifacts required by the debugger workflow.
