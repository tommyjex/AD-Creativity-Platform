# Debug Session: prompt-optimization-502
- **Status**: [OPEN]
- **Issue**: AIGC prompt optimization returned HTTP 502 after ModelArk processing.
- **Debug Server**: Pending startup
- **Log File**: `.dbg/trae-debug-log-prompt-optimization-502.ndjson`

## Reproduction Steps
1. Open an AIGC text node in the canvas.
2. Select an image-generation target and start prompt optimization.
3. Observe the HTTP 502 response.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | ModelArk returned empty or truncated output. | Medium | Low | Pending |
| B | ModelArk output is not valid JSON. | High | Low | Pending |
| C | JSON is valid but does not match the required Seedream schema or generation type. | Medium | Low | Pending |
| D | The ModelArk request or image-context resolution failed before parsing. | Low | Low | Pending |

## Log Evidence

The TLS request summary for `request_id=6e198391-d91e-4f46-ae36-a3b022b6fce5` shows `POST /api/aigc/prompts/optimize` returned 502 after 12526.898 ms. It does not include the safe provider failure category.

## Verification Conclusion

Pending runtime instrumentation and reproduction.
