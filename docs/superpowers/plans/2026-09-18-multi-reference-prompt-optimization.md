# Multi-Reference Prompt Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow valid `参考图生图` prompt-optimization results for image-to-image nodes with multiple references.

**Architecture:** Add one pure policy function in `modelark.py` that derives allowed Seedream generation types from `target_type`, `reference_image_count`, and source-image availability. Reuse it in both provider-response validation and generation-service validation.

**Tech Stack:** Python 3.14, FastAPI, Pydantic, pytest

---

### Task 1: Add Failing Policy Tests

**Files:**
- Modify: `backend/tests/test_modelark.py`
- Modify: `backend/tests/test_prompt_optimization.py`

- [x] Add an adapter test where `image_to_image`, `reference_image_count=3`, and no `source_image_url` accepts `参考图生图`.
- [x] Add a generation-service test for the same multi-reference contract.
- [x] Run the focused tests and verify they fail with `incompatible generation type`.

### Task 2: Centralize Generation-Type Policy

**Files:**
- Modify: `backend/app/services/modelark.py`
- Modify: `backend/app/services/generation.py`

- [x] Add `allowed_aigc_prompt_generation_types(request, has_source_image)` implementing:

```python
if request.target_type == "text_to_image":
    return {"文生图"}
if has_source_image:
    return {"图像编辑", "参考图生图"}
if request.target_config.reference_image_count > 0:
    return {"参考图生图"}
return {"文生图"}
```

- [x] Replace both duplicated inline `allowed_types` expressions with the helper.
- [x] Run focused tests and confirm they pass.

### Task 3: Runtime Comparison

**Files:**
- Update: `debug-prompt-optimization-failure.md`

- [x] Clear the session log and switch instrumentation to `runId=post-fix`.
- [x] Re-run the exact request for Pipeline `635ddb8b-48f0-4102-ae1d-8d6c08069683`.
- [x] Confirm HTTP 200 and logs showing `generationType=参考图生图` without compatibility errors.

### Task 4: Regression Verification

**Files:**
- Test: `backend/tests/test_modelark.py`
- Test: `backend/tests/test_prompt_optimization.py`
- Test: `backend/tests/test_aigc_routes.py`

- [x] Run focused prompt-optimization tests.
- [x] Run the complete backend test suite.
- [x] Run formatting/static validation used by the repository.
- [ ] Keep instrumentation and debug artifacts until user confirms the fix.
