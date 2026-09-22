# Debug Session: prompt-optimization-unavailable
- **Status**: [OPEN]
- **Issue**: AIGC prompt optimization reports "AIGC prompt optimization failed" and must not surface validation-related failures to users.
- **Debug Server**: Pending startup
- **Log File**: `.dbg/trae-debug-log-prompt-optimization-unavailable.ndjson`

## Reproduction Steps
1. Open an AIGC prompt optimization dialog.
2. Submit a prompt for optimization.
3. Observe the unavailable-service error or returned validation failure.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Model output fails parse or protected-literal validation and becomes a 502. | High | Low | Pending |
| B | Safety-preservation validation rejects a model result. | Medium | Low | Pending |
| C | Pipeline/image context validation fails before generation. | Medium | Low | Pending |
| D | Model provider has a transport, auth, timeout, or rate-limit failure. | Medium | Low | Pending |
| E | The restarted backend has stale configuration or code. | Low | Low | Pending |

## Log Evidence
- `trae-debug-log-prompt-optimization-unavailable.ndjson:1`: `video_generation` optimization request entered with 468 characters.
- `trae-debug-log-prompt-optimization-unavailable.ndjson:2`: request entered the `ModelArkTextParseError` branch.
- `trae-debug-log-prompt-optimization-unavailable.ndjson:3`: a subsequent request entered and completed without a parse, safety, or provider-error event.

## Verification Conclusion
- A is confirmed: the observed unavailable-service response was a parse/validation rejection, not an observed provider failure.
- B, C, D, and E are not observed in this reproduction.

## Video Reference Marker Change
- Standard `(参考@图N)`、`(参考@视频N)`、`(参考@音频N)` markers are not matched
  by the existing protected-literal extractor, so they are already non-blocking
  in `validate_prompt_optimization_result`.
- The video optimizer system instruction now treats those markers as a soft
  preservation preference: preserve existing markers when possible, never
  generate new markers, and do not use marker changes to judge output validity.
- The AIGC editor now shows this behavior only when the selected target is
  `video_generation`.

## Post-Fix Verification
- Backend unit tests passed for marker changes, soft-preservation instructions,
  and the full prompt-optimization suite.
- Frontend prompt-editor tests and target-file ESLint passed.
- Keep instrumentation and the debug server active until a real canvas retry
  confirms that the parse-error path is not entered for this scenario.
