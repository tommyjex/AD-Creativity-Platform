# Debug Session: aigc-text-attribute
- **Status**: [OPEN]
- **Issue**: An AIGC LLM node fails with `provider_code=AttributeError` in phase `aigc_text_generate`.
- **Debug Server**: http://127.0.0.1:7778/event
- **Log File**: `.dbg/trae-debug-log-aigc-text-attribute.ndjson`

## Reproduction Steps
1. Run AIGC node `llm-0f294de2-c86a-4215-94ff-50b8b6df8b02`.
2. Inspect the provider failure reported as `AttributeError` during `aigc_text_generate`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | The chat-completions response shape is incompatible with `_chat_output_text`. | High | Low | Rejected |
| B | The image-input responses request uses an unsupported payload or response shape. | Medium | Low | Confirmed |
| C | A ModelArk client sub-client is unavailable after backend initialization. | Medium | Low | Rejected |
| D | A model or request parameter is read through a missing SDK attribute. | Low | Low | Rejected |

## Log Evidence
TLS event `aigc.text_generate.provider_exception` confirms that image input selected
the Responses API and the SDK failed while parsing its typed response:
`'typing.Union' object has no attribute '__discriminator__' and no __dict__ for setting
new attributes`. The request did not reach application-level response parsing.

## Verification Conclusion
The image-input branch now calls `responses.with_raw_response.create` and parses the
JSON payload directly, avoiding the incompatible SDK typed-response parser. Automated
regression tests pass; user verification is pending.
