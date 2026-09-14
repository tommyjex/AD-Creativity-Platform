# Seedream Prompt Optimizer System Prompt Replacement Design

## Background

The canvas text-node prompt optimizer currently uses a backend-authored
Seedream system prompt and a JSON response contract. For image targets the
provider must choose `local_edit` or `full_design` and return either one English
paragraph or a collection of English sections. The downstream renderer then
performs mode-specific section, language, anchor, and reference-instruction
validation.

The project now has a product-owned Seedream 5.0 prompt specification:

```text
docs/Seedream生图提示词生成规范.md
```

That specification defines a different contract:

- The optimizer classifies the task as `文生图`, `图像编辑`, or `参考图生图`.
- It writes concise executable natural-language prompts, primarily in Chinese.
- It returns three labeled text sections instead of JSON.
- It includes a user-facing optimization explanation.

Replacing only the system prompt would leave the provider response format,
parser, safety renderer, API schema, and frontend behavior incompatible.

## Scope

This change applies to prompt optimization launched from a canvas text node
whose target is:

- `text_to_image`
- `image_to_image`

It does not change:

- LLM prompt optimization.
- Seedance video prompt optimization.
- Storyboard prompt optimization.
- The standalone legacy tools image prompt optimization endpoint.
- Image generation or image-edit execution.

## Goals

- Use the supplied Seedream 5.0 specification as the image optimizer system
  prompt.
- Parse the specification's three-section text response deterministically.
- Return the detected generation type and optimization explanation to the
  frontend.
- Preserve existing BBox reference bindings and instructions.
- Retain only safety checks that remain valid under the new Chinese
  natural-language protocol.
- Avoid runtime dependence on the repository `docs/` directory.

## Non-Goals

- Changing the text-node editor layout.
- Adding a prompt-history database.
- Asking the model to emit chain-of-thought or hidden reasoning.
- Rewriting individual BBox reference instructions.
- Supporting both the old image JSON protocol and the new tagged protocol
  indefinitely.
- Changing non-image prompt optimization response formats.

## Canonical Prompt Resource

Add a packaged backend resource:

```text
backend/app/prompts/seedream_image_prompt_optimizer.md
```

Its UTF-8 contents match:

```text
docs/Seedream生图提示词生成规范.md
```

The provider adapter loads the resource relative to the backend package, not
from the process working directory. A test compares the runtime resource with
the source document byte-for-byte so product documentation and runtime behavior
cannot silently diverge.

The resource is loaded once and cached. A missing or empty resource is a
startup/test failure rather than a provider fallback to the old prompt.

## Provider Request

For image targets, `build_aigc_prompt_optimization_messages` returns:

- System message: the packaged Seedream specification.
- User message: structured JSON context introduced by a short instruction to
  apply the system specification.

The context contains:

```json
{
  "target_node_id": "...",
  "target_type": "text_to_image",
  "target_config": {},
  "optimization_direction": "...",
  "current_text": "...",
  "reference_instructions": [],
  "has_source_image": false
}
```

The provider Responses call no longer requests `json_object` formatting for
image targets. LLM and video targets keep their existing JSON format.

The image request does not include backend canonical anchors. Exact facts are
protected and repaired after parsing instead of asking the provider to copy
opaque markers.

## Provider Result Model

Introduce an image-specific parsed result:

```python
AigcSeedreamGenerationType = Literal[
    "文生图",
    "图像编辑",
    "参考图生图",
]

class AigcSeedreamPromptOptimizationResult(SchemaModel):
    generation_type: AigcSeedreamGenerationType
    optimized_text: str
    optimization_explanation: str
```

The provider adapter returns this model only for canvas image targets.
Non-image targets continue returning the existing generic provider result.

The old `local_edit/full_design` discriminator and section result are no longer
part of the canvas image optimizer path.

## Tagged Text Protocol

Expected provider output:

```text
【生图类型】图像编辑
【优化后提示词】
去掉图中女生头上的粉色毛绒帽子，保持其他内容不变。
【优化说明】
明确了编辑对象和保持不变的范围。
```

### Parsing Rules

The parser:

1. Trims surrounding whitespace.
2. Removes one complete outer Markdown code fence when present.
3. Requires exactly one occurrence of each label:
   - `【生图类型】`
   - `【优化后提示词】`
   - `【优化说明】`
4. Requires labels in that order.
5. Accepts a value on the label line or on following lines.
6. Accepts an optional Chinese or ASCII colon immediately after a label.
7. Preserves internal newlines in the prompt and explanation.
8. Trims each extracted value.
9. Accepts only the three defined generation-type values.
10. Rejects empty prompt or explanation values.
11. Rejects unparsed non-whitespace content before the first or after the last
    section, except the optional outer code fence.

Missing, duplicate, out-of-order, empty, or unknown sections raise
`ModelArkTextParseError` with no raw provider output in logs or API messages.

## Task-Type Compatibility

The parsed type is checked against runtime context:

- `text_to_image` accepts `文生图`.
- `image_to_image` with one verified source image accepts `图像编辑` or
  `参考图生图`.
- An image target without a verified source image rejects `图像编辑` and
  `参考图生图`.
- Multiple/reference-image workflows accept `参考图生图`; bounded edits may
  return `图像编辑`.

Compatibility failures are parse errors because they indicate that the
provider did not follow the supplied task context.

## Reference Instructions

The new three-section format has no per-reference output collection. Existing
`reference_instructions` may contain BBox identity and coordinate bindings that
must not be merged, reordered, or translated.

Therefore:

- They are supplied to the provider as context.
- They are not parsed from provider output.
- The API returns the original request list unchanged.
- Existing frontend application logic continues receiving the same number,
  order, and exact strings.

The optimized main prompt may describe how references are used, but cannot
replace the structured reference instruction list.

## Safety Rendering

The new image renderer receives the request and parsed tagged result. It
normalizes whitespace conservatively and applies:

- Empty and length validation.
- Coordinate/BBox token protection.
- Direct explicit-exclusion reversal rejection.
- Recoverable fact repair for brands, products, visible text, colors, models,
  and explicit quantities.
- Warning-only checks for missing subject terms or unrequested object
  quantities.

It does not apply old protocol checks for:

- English-only text.
- `local_edit/full_design`.
- Fixed local-edit action, image-anchor, or preservation phrases.
- Four-to-ten section counts.
- English labels.
- Required Composition or final Negative Prompt sections.
- Provider-authored canonical anchor placement.
- Rewritten reference instructions.

The renderer returns deduplicated warnings through the existing internal
warning channel.

## API Contract

Extend the shared response:

```python
class AigcPromptOptimizeResponse(SchemaModel):
    optimized_text: str
    optimized_reference_instructions: list[str]
    generation_type: AigcSeedreamGenerationType | None = None
    optimization_explanation: str = ""
```

Image-target responses populate both new fields. LLM, video, and legacy routes
retain `null`/empty defaults, preserving backward compatibility.

The explanation is bounded to 2000 characters and cannot contain coordinate
tags. It is informational and never becomes part of the generated-image
prompt.

## Frontend Behavior

Extend `AigcPromptOptimizeResponse` with:

```typescript
generation_type: "文生图" | "图像编辑" | "参考图生图" | null;
optimization_explanation: string;
```

After a successful image optimization:

- Apply only `optimized_text` to the text node.
- Reapply the unchanged `optimized_reference_instructions`.
- Show a success message containing the generation type.
- Show the explanation in the success message, truncated visually rather than
  mutating the response value.

Stale response detection, undo, autosave, cancellation, and error handling
remain unchanged.

## Mock Behavior

The mock adapter emits all three generation types deterministically:

- No source image: `文生图`.
- Source image plus bounded edit language: `图像编辑`.
- Source image plus new-scene/style/identity reuse language: `参考图生图`.

Mock output passes through the same tagged-text parser and renderer used for
real provider output.

## Observability and Errors

Provider parse failures use stable sanitized messages:

- Missing or malformed sections:
  `AIGC Seedream prompt optimization response could not be parsed`
- Incompatible generation type:
  `AIGC Seedream prompt optimization returned an incompatible generation type`
- Empty prompt:
  `AIGC Seedream prompt optimization returned empty content`

Logs may record target type, parsed generation type, and failure category. They
must not record source prompts, provider output, BBox instructions, or image
URLs.

## Testing

### Prompt Resource

- Runtime prompt exactly matches the supplied document.
- UTF-8 loading works independently of the process working directory.
- Missing/empty resource fails explicitly.

### Parser

- Parses each of the three generation types.
- Supports same-line and next-line values.
- Supports one outer code fence and optional colons.
- Preserves multiline prompt text.
- Rejects missing, duplicate, reordered, empty, and unknown sections.
- Does not leak malformed provider content in errors.

### Provider Adapter

- Image target sends the packaged system prompt.
- Image target does not request JSON output.
- LLM and video targets retain JSON output.
- Type compatibility follows source-image context.

### Safety and API

- Optimized prompt retains or repairs protected facts.
- Explicit exclusion reversal remains blocked.
- Reference instructions are byte-for-byte unchanged.
- English/sections/local-edit wording is no longer required.
- API returns type and explanation.
- Non-image responses retain compatible defaults.

### Frontend

- Applies only optimized prompt text.
- Keeps BBox reference instructions unchanged.
- Displays generation type and explanation.
- Keeps stale-result, undo, autosave, and cancellation behavior.

## Acceptance Criteria

- Canvas text-node image optimization uses the supplied Seedream system prompt.
- Valid three-section Chinese output is parsed and applied successfully.
- The API and frontend expose the detected type and explanation.
- Existing reference bindings and instructions are unchanged.
- Old English JSON/sections requirements no longer reject valid output.
- Core fact, BBox, exclusion, empty-output, and parse safety remain enforced.
- Relevant backend and frontend tests pass.
