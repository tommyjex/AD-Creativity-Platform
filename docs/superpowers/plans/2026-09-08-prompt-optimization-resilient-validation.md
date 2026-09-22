# Prompt Optimization Resilient Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make image prompt optimization return usable results by deterministically restoring recoverable facts and downgrading quantity/content quality conflicts to warnings, while retaining asset, BBox, explicit-negation, parsing, and size hard failures.

**Architecture:** Keep the existing normalization and validation pipeline in `prompt_optimization.py`, but insert a source-owned fact repair stage before hard validation. Both `full_design` and `local_edit` use the same extraction rules with mode-specific append locations; warnings continue through `PromptOptimizationRenderResult` and structured logs in `generation.py`.

**Tech Stack:** Python 3.14, FastAPI, Pydantic v2, pytest, existing ModelArk adapter and prompt anchor utilities.

---

## File Map

- Modify `backend/app/services/prompt_optimization.py`: fact extraction, deterministic repair, warning downgrade, remaining hard checks.
- Modify `backend/app/services/generation.py`: remove temporary TRAE debugger instrumentation and retain structured warning logging.
- Modify `backend/tests/test_prompt_optimization.py`: repair, warning, and hard-boundary unit/service tests.
- Modify `backend/tests/test_aigc_routes.py`: HTTP status regression tests where existing route fixtures cover prompt optimization.
- Update `debug-prompt-safety-rejection.md`: close the debugging session after post-fix verification.

### Task 1: Define Recoverable Facts and Preserve Hard Asset Literals

**Files:**
- Modify: `backend/app/services/prompt_optimization.py`
- Test: `backend/tests/test_prompt_optimization.py`

- [ ] **Step 1: Write failing tests for fact repair classification**

Add focused tests proving that brand/model, quoted copy, color, aspect ratio, and measurements are recoverable, while BBox-bearing literals remain hard constraints:

```python
def test_full_design_repairs_recoverable_source_facts() -> None:
    request = image_request([]).model_copy(
        update={
            "text": (
                '品牌：ACME，型号 X100，包装显示“家庭清洁专家”，'
                "使用红色，画幅 16:9"
            )
        }
    )
    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(subject="Create a clean product image."),
    )
    text = rendered.response.optimized_text
    assert "ACME" in text
    assert "X100" in text
    assert "“家庭清洁专家”" in text
    assert "red" in text
    assert "16:9" in text
    assert "protected_literal_repaired" in rendered.warnings
    assert "required_color_repaired" in rendered.warnings
```

```python
def test_bbox_literal_is_not_treated_as_recoverable_copy() -> None:
    request = image_request(
        ["Reduce Image 1<bbox>10 20 30 40</bbox> and keep the logo."]
    )
    with pytest.raises(PromptOptimizationSafetyError, match="BBox|protected literal"):
        render_image_prompt_sections(
            request,
            image_sections(references=["Reduce the selected region."]),
        )
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_prompt_optimization.py::test_full_design_repairs_recoverable_source_facts \
  backend/tests/test_prompt_optimization.py::test_bbox_literal_is_not_treated_as_recoverable_copy \
  -q
```

Expected: the recoverable-fact test fails because literals/colors are still hard validated or omitted; the BBox test continues to fail safely.

- [ ] **Step 3: Add a small repair model and helpers**

Add an internal immutable fact type and helpers near `PromptOptimizationRenderResult`:

```python
@dataclass(frozen=True)
class RecoverablePromptFact:
    kind: str
    value: str
    rendered_value: str


def _recoverable_facts(source: str) -> tuple[RecoverablePromptFact, ...]:
    facts: list[RecoverablePromptFact] = []
    for literal in extract_protected_literals(source):
        if _BBOX_TOKEN.fullmatch(literal):
            continue
        facts.append(
            RecoverablePromptFact(
                kind="literal",
                value=literal,
                rendered_value=literal,
            )
        )
    source_folded = source.casefold()
    for token, english in _COLOR_TERMS.items():
        present = (
            re.search(rf"\b{re.escape(token.casefold())}\b", source_folded)
            if token.isascii()
            else token.casefold() in source_folded
        )
        if present:
            facts.append(
                RecoverablePromptFact(
                    kind="color",
                    value=english,
                    rendered_value=english,
                )
            )
    return tuple(
        dict.fromkeys(
            (fact.kind, fact.value, fact.rendered_value) for fact in facts
        )
    )
```

Implement `_repair_recoverable_facts(source, output)` to return `(output, warning_codes)`. It appends missing values using stable phrases:

```python
Preserve exact literal: {literal}.
Preserve required color: {english_color}.
```

Do not repair `_BBOX_TOKEN`, reference image identifiers attached to BBox, or unknown canonical markers.

- [ ] **Step 4: Add a dedicated hard BBox validator**

Keep the existing source order semantics in a named check:

```python
def _validate_bbox_literals(source: str, output: str, *, field_name: str) -> None:
    required = tuple(match.group(0) for match in _BBOX_TOKEN.finditer(source))
    cursor = 0
    for literal in required:
        position = output.find(literal, cursor)
        if position < 0:
            raise ModelArkTextParseError(
                f"AIGC prompt optimization changed BBox literal in {field_name}"
            )
        cursor = position + len(literal)
```

Invoke this with `_enforce_safety` before any generic fact repair for each reference instruction.

- [ ] **Step 5: Run the focused tests**

Run:

```bash
.venv/bin/python -m pytest backend/tests/test_prompt_optimization.py \
  -k "recoverable_source_facts or bbox_literal" -q
```

Expected: both tests pass.

### Task 2: Integrate Repair and Warning Downgrades into `full_design`

**Files:**
- Modify: `backend/app/services/prompt_optimization.py`
- Test: `backend/tests/test_prompt_optimization.py`

- [ ] **Step 1: Write failing `full_design` behavior tests**

Add tests for main prompt repair, indexed reference repair, no duplicate repair, and quantity warning:

```python
def test_full_design_warns_and_allows_added_or_rebound_quantity() -> None:
    request = image_request([]).model_copy(
        update={"text": "画面中展示 2 瓶青岚气泡水"}
    )
    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(
            subject="Show the requested product beside 3 glasses."
        ),
    )
    assert "3 glasses" in rendered.response.optimized_text
    assert "unrequested_object_quantity" in rendered.warnings
```

```python
def test_full_design_repairs_only_the_matching_reference_index() -> None:
    request = image_request(['Keep "ACME".', 'Keep "X100".'])
    rendered = render_image_prompt_sections_with_warnings(
        request,
        image_sections(references=["Keep the logo.", "Keep the model."]),
    )
    references = rendered.response.optimized_reference_instructions
    assert '"ACME"' in references[0]
    assert '"ACME"' not in references[1]
    assert '"X100"' in references[1]
    assert "reference_constraint_repaired" in rendered.warnings
```

- [ ] **Step 2: Run the tests and confirm the current hard failures**

Run:

```bash
.venv/bin/python -m pytest backend/tests/test_prompt_optimization.py \
  -k "full_design_warns_and_allows_added or repairs_only_the_matching" -q
```

Expected: current `_enforce_safety` calls raise before a usable response is returned.

- [ ] **Step 3: Repair main `full_design` content before rendering**

After canonical-anchor normalization, select `positive_anchor_section_index(labels)`, run the repair helper against the combined positive output, and append only missing facts to that section. Add returned warning codes to `warnings`.

Preserve these invariants:

```python
assert all(
    fact not in contents[index]
    for index, fact in enumerate(repaired_facts)
    if index != positive_index
)
```

Do not insert positive facts into `Composition` or `Negative Prompt`.

- [ ] **Step 4: Repair each reference instruction independently**

Before generic literal/color validation:

```python
repaired_output, repair_warnings = _repair_recoverable_facts(source, output)
references[index] = repaired_output
if repair_warnings:
    warnings.append("reference_constraint_repaired")
warnings.extend(repair_warnings)
```

Retain the reference count and BBox order hard checks.

- [ ] **Step 5: Downgrade object quantity additions/rebinding to warnings**

Replace the current hard call:

```python
_enforce_safety(
    lambda: _validate_no_unrequested_object_quantities(
        request,
        contents,
        references,
        source_constraints,
    )
)
```

with:

```python
_collect_warning(
    warnings,
    "unrequested_object_quantity",
    lambda: _validate_no_unrequested_object_quantities(
        request,
        contents,
        references,
        source_constraints,
    ),
)
```

Keep `unrequested_non_object_number` as a warning.

- [ ] **Step 6: Keep direct exclusion reversal as a narrow hard check**

Add `_validate_no_direct_exclusion_reversal(request, output)` that rejects only explicit positive verbs directly bound to the original exclusion literal:

```python
_DIRECT_POSITIVE_ACTION = re.compile(
    r"\b(?:add|include|show|place|insert|retain|keep)\b",
    re.IGNORECASE,
)
```

For each exclusion `SourceConstraint`, inspect a bounded window preceding the exact `source_value`. Canonical anchor occurrences are removed before the scan. Do not infer translations or semantic similarity; uncertain conflicts remain warnings.

- [ ] **Step 7: Run `full_design` tests**

Run:

```bash
.venv/bin/python -m pytest backend/tests/test_prompt_optimization.py \
  -k "full_design or image_sections or reference" -q
```

Expected: all selected tests pass; quantity additions produce warnings, while BBox and direct exclusion reversal fail.

### Task 3: Apply the Same Policy to `local_edit`

**Files:**
- Modify: `backend/app/services/prompt_optimization.py`
- Test: `backend/tests/test_prompt_optimization.py`

- [ ] **Step 1: Write failing local-edit repair tests**

```python
def test_local_edit_repairs_brand_color_and_copy_in_one_paragraph() -> None:
    request = image_request([]).model_copy(
        update={
            "text": '把 ACME 外套改为红色并保留“新品”文案',
            "target_config": image_request([]).target_config.model_copy(
                update={"reference_image_count": 1}
            ),
        }
    )
    rendered = render_local_edit_prompt_with_warnings(
        request,
        AigcImagePromptLocalEditResult(
            optimization_mode="local_edit",
            optimized_text=(
                "Use the input image as the editing base. Modify only the coat. "
                "Keep everything else unchanged."
            ),
        ),
    )
    assert "\n" not in rendered.response.optimized_text
    assert "ACME" in rendered.response.optimized_text
    assert "red" in rendered.response.optimized_text
    assert "“新品”" in rendered.response.optimized_text
    assert "protected_literal_repaired" in rendered.warnings
```

- [ ] **Step 2: Introduce a warning-returning local renderer**

Rename the existing implementation declaration:

```python
def render_local_edit_prompt_with_warnings(
    request: AigcPromptOptimizeRequest,
    result: AigcImagePromptLocalEditResult,
) -> PromptOptimizationRenderResult:
    warnings: list[str] = []
```


Move the current `render_local_edit_prompt` body under that declaration without
changing its existing checks. Replace its final return with:

```python
return PromptOptimizationRenderResult(
    response=AigcPromptOptimizeResponse(
        optimized_text=optimized_text,
        optimized_reference_instructions=references,
    ),
    warnings=tuple(dict.fromkeys(warnings)),
)
```

Then add the compatibility wrapper immediately after it:

```python
def render_local_edit_prompt(
    request: AigcPromptOptimizeRequest,
    result: AigcImagePromptLocalEditResult,
) -> AigcPromptOptimizeResponse:
    return render_local_edit_prompt_with_warnings(request, result).response
```

Keep the one-paragraph, explicit edit action, input-image anchor, preservation semantics, output length, BBox, and direct exclusion reversal checks hard.

- [ ] **Step 3: Repair local main text and indexed references**

Apply canonical-anchor repair and recoverable-fact repair before literal/color checks. Append stable phrases at the end of the existing paragraph and normalize whitespace without adding labels or line breaks.

Change object quantity checks to:

```python
_collect_warning(
    warnings,
    "unrequested_object_quantity",
    lambda: _validate_no_unrequested_object_quantities(
        request,
        [optimized_text],
        references,
        source_constraints,
    ),
)
```

- [ ] **Step 4: Log local warnings in the generation service**

In `ModelArkGenerationService.optimize_aigc_prompt`, call the warning-returning local renderer and use the same structured logger loop as `full_design`:

```python
for warning in rendered.warnings:
    logger.warning(
        "AIGC prompt optimization accepted with warning",
        extra={
            "warning_code": warning,
            "target_type": request.target_type,
            "optimization_mode": "local_edit",
        },
    )
```

- [ ] **Step 5: Run local-edit tests**

Run:

```bash
.venv/bin/python -m pytest backend/tests/test_prompt_optimization.py \
  -k "local_edit" -q
```

Expected: local repair tests pass; malformed/empty paragraphs, missing image anchor, BBox changes, and direct exclusion reversal remain failures.

### Task 4: Route Regression, Debug Cleanup, and Full Verification

**Files:**
- Modify: `backend/app/services/generation.py`
- Modify: `backend/tests/test_aigc_routes.py`
- Modify: `debug-prompt-safety-rejection.md`
- Test: `backend/tests/test_prompt_optimization.py`
- Test: `backend/tests/test_modelark.py`
- Test: `backend/tests/test_aigc_routes.py`

- [ ] **Step 1: Add HTTP status regression tests**

Use the existing mocked adapter/route fixtures to verify:

```python
assert recoverable_fact_response.status_code == 200
assert quantity_conflict_response.status_code == 200
assert bbox_failure_response.status_code == 422
assert malformed_provider_response.status_code == 502
```

No test may call the real ModelArk service.

- [ ] **Step 2: Remove all temporary TRAE debugger instrumentation**

Delete every block between:

```python
# #region debug-point
# #endregion
```

from `backend/app/services/generation.py`. Confirm no debug endpoint, session ID, inline `urllib.request`, or raw failure reason remains:

```bash
rg -n "debug-point|prompt-safety-rejection|urllib\\.request" \
  backend/app/services/generation.py
```

Expected: no matches.

- [ ] **Step 3: Run formatting and targeted tests**

Run:

```bash
.venv/bin/python -m ruff check \
  backend/app/services/prompt_optimization.py \
  backend/app/services/generation.py \
  backend/tests/test_prompt_optimization.py \
  backend/tests/test_aigc_routes.py
.venv/bin/python -m pytest \
  backend/tests/test_prompt_optimization.py \
  backend/tests/test_modelark.py \
  backend/tests/test_aigc_routes.py \
  -q
```

Expected: Ruff passes and all targeted tests pass.

- [ ] **Step 4: Run the backend regression suite**

Run:

```bash
.venv/bin/python -m pytest backend/tests -q
```

Expected: all backend tests pass with no real paid API calls.

- [ ] **Step 5: Close and clean the debug session**

Update `debug-prompt-safety-rejection.md`:

```markdown
- **Status**: [RESOLVED]
```

Record pre-fix evidence, repair behavior, targeted/full test results, and final verification. Then stop the debug server and remove `.dbg/trae-debug-log-prompt-safety-rejection.ndjson`.

- [ ] **Step 6: Restart and health-check the backend**

Restart Uvicorn on port `8000`, then run:

```bash
curl -fsS http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok","name":"AD Creativity Backend","version":"0.1.0"}
```

## Commit Boundaries

The worktree already contains related uncommitted feature changes. Do not stage unrelated files. If commits are requested, use these logical groups:

1. `test(aigc): cover resilient prompt fact repair`
2. `fix(aigc): repair prompt facts and warn on quantity conflicts`
3. `chore(aigc): remove prompt validation debug instrumentation`
