# Debug Session: llm-prompt-parse
- **Status**: [OPEN]
- **Issue**: LLM prompt optimization returns valid JSON in TLS but the API reports `ModelArkTextParseError`.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-llm-prompt-parse.ndjson`

## Reproduction Steps
1. Submit an AIGC prompt optimization request for an `llm` node.
2. Observe the TLS-only `aigc.prompt_optimization.raw_output` event.
3. Compare the raw JSON with the API result.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The `llm` request uses the image-only discriminated parser. | High | Low | Rejected |
| B | The raw JSON is altered between extraction and parsing. | Medium | Low | Rejected |
| C | Missing image discriminator fields cause schema validation to fail. | High | Low | Rejected |
| D | A downstream service validation rejects a parsed generic result. | Low | Medium | Confirmed |
| E | The running backend does not match the workspace implementation. | Low | Medium | Rejected |

## Log Evidence
TLS event supplied by the user: the provider output is a JSON object with `optimized_text` and `optimized_reference_instructions`, then the request fails with `ModelArkTextParseError`.

`.dbg/trae-debug-log-llm-prompt-parse.ndjson` pre-fix evidence:
- `A-C` confirms a valid JSON object with only the generic response fields.
- `D` confirms the provider result was mapped to `AigcImagePromptOptimizationResult`.
- `D` identifies the failure: `AIGC prompt optimization changed protected literal in text`.

## Verification Conclusion
The parser and service mapping work. The generic protected-literal check rejected a usable LLM rewrite. The fix converts only this text-rewrite failure to a warning; empty output and non-image reference instructions remain hard errors. Post-fix user verification is pending.
