# Debug Session: prompt-optimization-failure
- **Status**: [OPEN]
- **Issue**: AIGC prompt optimization consistently reports "服务暂时不可用。AIGC prompt optimization failed" instead of returning optimized text.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-prompt-optimization-failure.ndjson`

## Reproduction Steps
1. Open an AIGC canvas containing a text node connected to an image-generation node.
2. Open the prompt optimization dialog from the text node.
3. Select "图生图" as the target model.
4. Click "开始优化".
5. Observe the generic service-unavailable error.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The upstream model gateway rejects the request because of endpoint, credential, model, or service availability problems. | High | Low | Rejected: provider returned HTTP 200 with a complete response. |
| B | The model call succeeds but response parsing or prompt validation rejects the returned content. | High | Low | Confirmed: all three output labels parsed, then generation-type compatibility validation rejected `参考图生图`. |
| C | Frontend target model or downstream context does not match the backend request contract. | Medium | Low | Partially confirmed: request correctly declares `image_to_image` and three references, but backend compatibility logic ignores the reference count. |
| D | Reference image retrieval or multimodal payload construction fails. | Medium | Medium | Rejected as direct cause: multi-reference resolution intentionally has no unique `source_image_url`; reference count resolved to three. |
| E | The frontend request fails or times out before backend optimization executes. | Low | Low | Rejected: route, provider request, and provider response events all executed. |

## Log Evidence
Instrumentation added for:
- Route entry and parsed request shape (`C-E`)
- Resolved source-image context (`C-D`)
- Provider request and response structure (`A-B-C-D`)
- Known provider/parser failures (`A-B`)
- Parsed provider result and service-layer failures (`A-B`)

Pre-fix evidence from `.dbg/trae-debug-log-prompt-optimization-failure.ndjson`:
- Line 1: `targetType=image_to_image`, `configuredReferenceImageCount=3`.
- Line 2: context resolved with `resolvedReferenceImageCount=3` and `hasSourceImageUrl=false`.
- Line 4: provider returned HTTP 200, all three required labels were present.
- Line 5: parsed `generationType=参考图生图`.
- Lines 6-7: local validation raised `AIGC Seedream prompt optimization returned an incompatible generation type`.

## Verification Conclusion
Root cause confirmed. Both the adapter and generation service derive allowed output
types from `source_image_url is not None`. That field only represents one eligible
source image for local editing; it is intentionally null when an image-to-image node
has multiple reference images. The request and system prompt still correctly describe
three reference images, so the model returns `参考图生图`, while the backend permits only
`文生图` and converts the deterministic local validation failure into HTTP 502.

Post-fix evidence:
- The same Pipeline snapshot and request returned HTTP 200.
- Post-fix log line 5 still records `generationType=参考图生图`,
  `hasSourceImage=false`, and `configuredReferenceImageCount=3`.
- Post-fix log line 6 records a parsed `AigcSeedreamPromptOptimizationResult`;
  no compatibility-error event follows.
- Focused prompt-optimization tests: 280 passed.
- Complete backend suite: 1511 passed.

The debug session remains open until the user confirms the UI behavior.
