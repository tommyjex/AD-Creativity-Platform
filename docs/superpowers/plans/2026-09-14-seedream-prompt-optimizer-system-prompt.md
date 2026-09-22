# Seedream Prompt Optimizer System Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace canvas image prompt optimization with the supplied Seedream 5.0 system prompt and a parsed Chinese three-section response protocol.

**Architecture:** Package the product prompt with the backend, parse provider text into a typed Seedream result, and render it through a protocol-specific safety layer while preserving reference instructions. Extend the existing API response and frontend success feedback without changing non-image optimization paths.

**Tech Stack:** Python 3.14, FastAPI, Pydantic v2, ModelArk Responses API, React 19, TypeScript, pytest, Vitest

---

## File Map

- Create `backend/app/prompts/__init__.py`: package marker and cached prompt loader.
- Create `backend/app/prompts/seedream_image_prompt_optimizer.md`: runtime copy of the supplied product prompt.
- Modify `backend/app/schemas/aigc.py`: Seedream generation type/result and API response fields.
- Modify `backend/app/schemas/__init__.py`: export new schema types.
- Modify `backend/app/services/modelark.py`: tagged parser, image text response mode, compatible mock result.
- Modify `backend/app/services/prompt_optimization.py`: Seedream safety renderer.
- Modify `backend/app/services/generation.py`: route canvas image results through the new renderer.
- Modify `frontend/lib/aigc/types.ts`: expose generation type and explanation.
- Modify `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`: display parsed type and explanation.
- Modify `backend/tests/test_modelark.py`: resource, parser, provider, and mock tests.
- Modify `backend/tests/test_prompt_optimization.py`: safety rendering and reference preservation tests.
- Modify `backend/tests/test_aigc_schemas.py`: API schema tests.
- Modify `backend/tests/test_aigc_routes.py`: route response fields.
- Modify `frontend/tests/aigc-prompt-editor.test.tsx`: application and feedback tests.
- Modify `frontend/tests/api-client.test.ts`: response contract test where applicable.

### Task 1: Add Packaged Prompt and Typed Contract

**Files:**
- Create: `backend/app/prompts/__init__.py`
- Create: `backend/app/prompts/seedream_image_prompt_optimizer.md`
- Modify: `backend/app/schemas/aigc.py`
- Modify: `backend/app/schemas/__init__.py`
- Test: `backend/tests/test_modelark.py`
- Test: `backend/tests/test_aigc_schemas.py`

- [x] **Step 1: Add failing prompt-resource and schema tests**

Assert that the runtime prompt matches the product document exactly:

```python
def test_seedream_prompt_resource_matches_product_specification() -> None:
    source = (
        Path(__file__).parents[2]
        / "docs"
        / "Seedream生图提示词生成规范.md"
    ).read_text(encoding="utf-8")
    assert load_seedream_image_prompt() == source
```

Validate:

```python
result = AigcSeedreamPromptOptimizationResult(
    generation_type="图像编辑",
    optimized_text="去掉帽子，保持其他内容不变。",
    optimization_explanation="明确了编辑对象。",
)
assert result.generation_type == "图像编辑"
```

Verify `AigcPromptOptimizeResponse` accepts the two new fields and defaults
them for non-image callers.

- [x] **Step 2: Run tests and confirm failure**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_modelark.py -k "seedream_prompt_resource" \
  backend/tests/test_aigc_schemas.py -k "prompt_optimize_response" \
  -q
```

Expected: imports or assertions fail because the loader and fields do not
exist.

- [x] **Step 3: Add the prompt package**

Implement:

```python
from functools import lru_cache
from pathlib import Path

@lru_cache(maxsize=1)
def load_seedream_image_prompt() -> str:
    value = (
        Path(__file__).with_name("seedream_image_prompt_optimizer.md")
        .read_text(encoding="utf-8")
    )
    if not value.strip():
        raise RuntimeError("Seedream image prompt resource is empty")
    return value
```

Copy `docs/Seedream生图提示词生成规范.md` byte-for-byte into the packaged
Markdown resource.

- [x] **Step 4: Add schema types**

Add:

```python
AigcSeedreamGenerationType: TypeAlias = Literal[
    "文生图",
    "图像编辑",
    "参考图生图",
]

class AigcSeedreamPromptOptimizationResult(SchemaModel):
    generation_type: AigcSeedreamGenerationType
    optimized_text: str = Field(..., min_length=1, max_length=20000)
    optimization_explanation: str = Field(..., min_length=1, max_length=2000)
```

Extend:

```python
class AigcPromptOptimizeResponse(SchemaModel):
    ...
    generation_type: AigcSeedreamGenerationType | None = None
    optimization_explanation: str = Field(default="", max_length=2000)
```

Export the result and generation type from `backend.app.schemas`.

- [x] **Step 5: Run focused tests**

Run the Step 2 command again.

Expected: all selected tests pass.

### Task 2: Implement Tagged Parser and Provider Text Mode

**Files:**
- Modify: `backend/app/services/modelark.py`
- Test: `backend/tests/test_modelark.py`

- [x] **Step 1: Add failing parser tests**

Cover all generation types and format variants:

```python
result = BytePlusModelArkAdapter._parse_seedream_prompt_payload(
    """【生图类型】：图像编辑
【优化后提示词】
去掉帽子，保持其他内容不变。
【优化说明】
明确了编辑对象。"""
)
assert result.generation_type == "图像编辑"
```

Add parametrized failures for missing, duplicate, reordered, empty, unknown,
and trailing sections. Assert the exception contains only the stable sanitized
message.

- [x] **Step 2: Run parser tests and confirm failure**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_modelark.py -k "seedream_prompt_payload" \
  -q
```

Expected: failure because `_parse_seedream_prompt_payload` does not exist.

- [x] **Step 3: Implement the parser**

Use exact line labels and one optional outer fence:

```python
_SEEDREAM_SECTION_LABELS = (
    "【生图类型】",
    "【优化后提示词】",
    "【优化说明】",
)

@staticmethod
def _parse_seedream_prompt_payload(
    text: str,
) -> AigcSeedreamPromptOptimizationResult:
    stripped = _strip_outer_text_fence(text)
    if any(stripped.count(label) != 1 for label in _SEEDREAM_SECTION_LABELS):
        raise ModelArkTextParseError(SEEDREAM_PARSE_ERROR)
    # Locate labels in order, reject outside content, and slice values.
    return AigcSeedreamPromptOptimizationResult(...)
```

Permit `:` or `：` after a label, and permit type values on the label line or
the next line. Do not include raw output in exceptions.

- [x] **Step 4: Add provider-call tests**

For an image target, return tagged text from the fake Responses API and assert:

```python
assert "Seedream 生图提示词优化器" in system_prompt
assert "text" not in call or call["text"] != {
    "format": {"type": "json_object"}
}
assert result.generation_type == "文生图"
```

Retain the existing LLM test assertion that JSON mode is used.

- [x] **Step 5: Switch the real image provider path**

In `optimize_aigc_prompt`:

- Build image messages with `load_seedream_image_prompt()`.
- Omit JSON text formatting for image targets.
- Parse image output with `_parse_seedream_prompt_payload`.
- Keep generic JSON parsing for LLM and video targets.
- Validate generation type against target type and `source_image_url`.

- [x] **Step 6: Run focused provider tests**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_modelark.py \
  -k "seedream or aigc_prompt_optimizer_uses_responses_without_thinking" \
  -q
```

Expected: all selected tests pass.

### Task 3: Replace Canvas Image Rendering and Preserve References

**Files:**
- Modify: `backend/app/services/prompt_optimization.py`
- Modify: `backend/app/services/generation.py`
- Test: `backend/tests/test_prompt_optimization.py`

- [x] **Step 1: Add failing renderer tests**

Create a Seedream result with Chinese text, missing brand/color/copy facts, and
one unchanged BBox instruction. Assert:

```python
rendered = render_seedream_prompt_with_warnings(request, result)
assert rendered.response.generation_type == "图像编辑"
assert rendered.response.optimization_explanation == "明确编辑对象。"
assert rendered.response.optimized_reference_instructions == (
    request.reference_instructions
)
assert "ACME" in rendered.response.optimized_text
assert "红色" in rendered.response.optimized_text
assert "新品" in rendered.response.optimized_text
```

Add tests that explicit exclusion reversal remains blocked and that Chinese
text does not trigger English/sections/local-edit errors.

- [x] **Step 2: Run renderer tests and confirm failure**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_prompt_optimization.py \
  -k "seedream" \
  -q
```

Expected: import or assertion failures because the renderer does not exist.

- [x] **Step 3: Implement the Seedream renderer**

Implement:

```python
def render_seedream_prompt_with_warnings(
    request: AigcPromptOptimizeRequest,
    result: AigcSeedreamPromptOptimizationResult,
) -> PromptOptimizationRenderResult:
    warnings: list[str] = []
    optimized_text = _normalize_preserving_literals(result.optimized_text)
    _enforce_safety(lambda: _validate_bbox_literals(...))
    optimized_text, fact_warnings = _repair_recoverable_facts(
        request.text,
        optimized_text,
    )
    warnings.extend(fact_warnings)
    _enforce_safety(
        lambda: _validate_no_direct_exclusion_reversal(request, optimized_text)
    )
    references = list(request.reference_instructions)
    return PromptOptimizationRenderResult(
        response=AigcPromptOptimizeResponse(
            optimized_text=optimized_text,
            optimized_reference_instructions=references,
            generation_type=result.generation_type,
            optimization_explanation=result.optimization_explanation.strip(),
        ),
        warnings=tuple(dict.fromkeys(warnings)),
    )
```

Retain warning-only required-term and unrequested-object checks. Do not invoke
English, section, canonical-anchor, or rewritten-reference validation.

- [x] **Step 4: Switch the generation service**

For image targets, require
`AigcSeedreamPromptOptimizationResult`, call the new renderer, log
`generation_type`, and reject old mode results. Keep non-image conversion
unchanged.

- [x] **Step 5: Run prompt optimization tests**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_prompt_optimization.py \
  -k "seedream or generation_service" \
  -q
```

Expected: selected tests pass after replacing old service expectations.

### Task 4: Update Mock, Route, and API Contract

**Files:**
- Modify: `backend/app/services/modelark.py`
- Modify: `backend/tests/test_modelark.py`
- Modify: `backend/tests/test_aigc_routes.py`
- Modify: `backend/tests/test_aigc_schemas.py`

- [x] **Step 1: Add failing mock classification tests**

Assert:

```python
assert no_source.generation_type == "文生图"
assert bounded_edit.generation_type == "图像编辑"
assert new_scene.generation_type == "参考图生图"
```

Each mock result must include non-empty prompt and explanation.

- [x] **Step 2: Implement deterministic mock classification**

Use existing local-edit token detection for bounded edits. Add reference/new
scene tokens for `参考图生图`, otherwise classify a source-image request as
`图像编辑`. Return `AigcSeedreamPromptOptimizationResult` without changing
reference instructions.

- [x] **Step 3: Update route contract tests**

Mock the generation service response:

```python
AigcPromptOptimizeResponse(
    optimized_text="...",
    optimized_reference_instructions=["保留商标"],
    generation_type="参考图生图",
    optimization_explanation="明确了参考范围。",
)
```

Assert the JSON response contains both new fields.

- [x] **Step 4: Run schema, route, and mock tests**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_routes.py \
  backend/tests/test_modelark.py \
  -k "prompt or seedream" \
  -q
```

Expected: all selected tests pass.

### Task 5: Update Frontend Feedback

**Files:**
- Modify: `frontend/lib/aigc/types.ts`
- Modify: `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`
- Modify: `frontend/tests/aigc-prompt-editor.test.tsx`
- Modify: `frontend/tests/api-client.test.ts`

- [x] **Step 1: Add failing UI test**

Return:

```typescript
{
  optimized_text: "去掉女生的帽子，保持其他内容不变。",
  optimized_reference_instructions: ["保持商标位置"],
  generation_type: "图像编辑",
  optimization_explanation: "明确了编辑对象和保持范围。"
}
```

Assert the prompt is applied, reference instruction stays unchanged, and the
success message includes `图像编辑` and the explanation.

- [x] **Step 2: Run the UI test and confirm failure**

Run:

```bash
cd frontend
npm test -- tests/aigc-prompt-editor.test.tsx
```

Expected: type or text assertion fails because new fields are not exposed.

- [x] **Step 3: Extend the frontend type**

Add:

```typescript
export type AigcSeedreamGenerationType =
  | "文生图"
  | "图像编辑"
  | "参考图生图";

export interface AigcPromptOptimizeResponse {
  optimized_text: string;
  optimized_reference_instructions: string[];
  generation_type: AigcSeedreamGenerationType | null;
  optimization_explanation: string;
}
```

- [x] **Step 4: Display structured success feedback**

After `status === "updated"`, format:

```typescript
const detail = [
  result.generation_type,
  result.optimization_explanation.trim()
].filter(Boolean).join("：");
setOptimizationMessage({
  kind: "success",
  text: detail ? `提示词已优化（${detail}）` : "提示词已优化，可撤销恢复。"
});
```

Do not append explanation to the text-node prompt.

- [x] **Step 5: Run frontend tests and checks**

Run:

```bash
cd frontend
npm test -- tests/aigc-prompt-editor.test.tsx tests/api-client.test.ts
npm run typecheck
npm run lint
```

Expected: all commands pass.

### Task 6: Full Verification and Service Restart

**Files:**
- Verify all files listed above.

- [x] **Step 1: Run backend prompt suites**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_modelark.py \
  backend/tests/test_prompt_optimization.py \
  backend/tests/test_aigc_routes.py \
  -q
```

Expected: all tests pass.

- [x] **Step 2: Run complete frontend tests**

Run:

```bash
cd frontend
npm test
npm run typecheck
npm run lint
```

Expected: all tests and checks pass. If an existing timeout fails only in the
parallel full suite, rerun that exact test independently and report both
results.

- [x] **Step 3: Run static checks**

Run:

```bash
.venv/bin/python -m py_compile \
  backend/app/prompts/__init__.py \
  backend/app/schemas/aigc.py \
  backend/app/services/modelark.py \
  backend/app/services/prompt_optimization.py \
  backend/app/services/generation.py
git diff --check
```

Expected: both commands complete without errors.

- [x] **Step 4: Restart and verify services**

Restart backend and frontend, then run:

```bash
curl -sS http://127.0.0.1:8000/health
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000
```

Expected: backend status `ok` and frontend HTTP `200`.
