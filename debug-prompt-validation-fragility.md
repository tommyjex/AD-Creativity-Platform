# Debug Session: prompt-validation-fragility
- **Status**: [OPEN]
- **Issue**: AIGC prompt optimization repeatedly returns 502 because valid or low-risk model output is rejected by strict backend validation.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-prompt-validation-fragility.ndjson

## Reproduction Steps
1. Open the affected AIGC pipeline in the local frontend.
2. Select a text node connected to an image generation node.
3. Run prompt optimization.
4. Observe "AIGC prompt optimization failed" when backend validation rejects the model output.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | A low-risk preservation rule rejects a semantically valid rewrite | High | Low | Confirmed by prior failures on section order and equivalent measurement wording |
| B | All validation classes are treated as hard failures, making one deviation fail the entire request | High | Low | Confirmed: all content validators raise `ModelArkTextParseError`, mapped to HTTP 502 |
| C | Current error logging hides the exact failed rule and output summary | High | Low | Confirmed: API log exposes only `AIGC prompt optimization failed` |
| D | The current pipeline input/config introduces a new uncovered edge case | Medium | Low | Not reproduced on revision 32; six identical requests returned 200 |
| E | Only identity, explicit count, BBox, and reference ownership constraints require hard rejection | Medium | Medium | Design recommendation pending approval |

## Log Evidence
Instrumentation points:
- `generation.py:ModelArkGenerationService.optimize_aigc_prompt:model-result`
  records target type, section labels, and numeric token summaries.
- `generation.py:ModelArkGenerationService.optimize_aigc_prompt:failure`
  records the exact validation exception and target configuration.

Pre-fix evidence:
- Lines 1-6 of the NDJSON log show six model results with valid section order.
- All six controlled requests for pipeline revision 32 returned HTTP 200.
- Static audit found that English purity, literal ordering, colors, subject terms,
  reference verbs, negative-prompt heuristics, any new numeric token, and
  canonical-anchor placement all raise the same hard parse error.
- Previous confirmed incidents rejected valid output because Composition was not
  penultimate and because `180 度`, `180 degrees`, and `180-degree` were treated
  inconsistently.

Post-fix evidence:
- Lines 1-10 of the NDJSON log contain ten `post-fix` model-result events with
  valid, renderable sections and no validation-failure event.
- The same current pipeline request returned HTTP 200 ten consecutive times.
- Focused prompt/schema/adapter/route tests passed before the full backend suite.
- Full backend suite passed: 1337 tests.
- Backend health remained OK on port 8000 after restart.
- A later browser retry exposed a distinct hard failure: the input contained zero
  reference instructions, but the provider randomly returned extra reference
  instructions. The numeric content (`180`, `10-15cm`, and `1:1`) was unchanged.
- The renderer now discards provider-authored reference instructions only when the
  input reference list is empty. Non-empty reference cardinality remains a hard
  constraint.
- The exact 2327-character browser input subsequently returned HTTP 200 ten
  consecutive times, with zero reference instructions in every response.

## Verification Conclusion
Pre-fix, quality heuristics and data-integrity constraints shared the same hard-failure
path and were surfaced as an external-service outage. Post-fix, deterministic
structure differences are normalized, quality heuristics produce warnings and return
HTTP 200, unsafe changes to protected user facts return HTTP 422, and provider failures
remain HTTP 502. Browser confirmation is pending before cleanup.
