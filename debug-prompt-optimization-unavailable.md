# Debug Session: prompt-optimization-unavailable
- **Status**: [OPEN]
- **Issue**: Pipeline `7a58cf32-215e-4449-b87c-db5e62971e54` reports `AIGC prompt optimization failed`.

## Reproduction Steps
1. Open the affected AIGC pipeline.
2. Select a text prompt node.
3. Trigger prompt optimization.
4. Observe the generic service-unavailable error.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Expected Signal |
|----|------------|------------|--------|-----------------|
| A | Responses API/provider returns a concrete upstream error | Rejected | Low | Provider returned parseable optimized content. |
| B | Prompt optimization request contains invalid or empty text | Rejected | Low | Request contained 672 characters and passed request validation. |
| C | Backend configuration/credential is missing after restart | Rejected | Low | Real Responses API calls completed successfully. |
| D | Frontend maps a specific backend response to a generic message | Confirmed | Medium | Backend exposed only a generic 502 after response validation failed. |

## Log Evidence
Pre-fix reproduction:
- Target: `image_to_image-e67a0355-e73a-40e8-b23c-f949210b1d2b`
- Input text length: 672
- BBox reference instruction count: 0
- Ordinary reference image count: 4
- Provider output reference instruction count: 4
- Service rejected the response with
  `AIGC prompt optimization changed reference count`.

A second provider response used the observed misspelled field
`optim_reference_instructions`, which failed strict structure parsing before
service validation.

## Verification Conclusion
Root cause: the model inferred four reference instructions from the target's
ordinary reference image count even though the input had no BBox reference
instructions. It can also emit the observed shortened field name. Both cases
were converted to a generic 502.

Fix:
- Accept the observed `optim_reference_instructions` alias during parsing.
- When the input BBox instruction list is empty, discard model-invented
  reference instructions.
- Keep strict cardinality validation for every non-empty input list.

Post-fix evidence:
- Real Responses API call returned optimized content.
- Pre-normalization output reference count: 4.
- Final output reference count: 0.
- HTTP endpoint returned 200 with optimized text length 746.

Verification:
- Prompt optimization service/route tests: 12 passed.
- Responses adapter tests: 2 passed.
- `git diff --check`: passed.

Waiting for user confirmation before removing instrumentation and debug files.
