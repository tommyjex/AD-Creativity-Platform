# AIGC Layer Composite Optional Replacement Design

## Background

The layer canvas applies saved position, scale, visibility, deletion, and
z-order patches to an upstream `layer_set`. Running the canvas produces an
immutable derived `layer_set`.

The layer composite node currently requires two inputs:

- `layers`: the layer set to composite.
- `replacement`: one edited layer whose pixels replace a layer in that set.

This contract only supports the "edit one selected layer, then composite"
workflow. A user who only rearranges, scales, hides, or deletes layers in the
layer canvas cannot flatten the saved layer set because the DAG rejects the
unconnected `replacement` port before execution.

## Goal

Allow a layer composite node to flatten a saved layer set directly while
preserving the existing optional layer-replacement workflow.

## Compatibility Decision

This design supersedes the requirement in
`2026-08-30-aigc-seedream-layer-workflow-design.md` that every layer composite
must receive one `edited_layer`.

The `layers` input remains required. The `replacement` input becomes optional.
Existing pipelines that connect both inputs retain their current behavior.

## Node Contract

The layer composite node has:

- Required input `layers: layer_set`.
- Optional input `replacement: edited_layer`.
- Output `image: image_asset`.
- Output `layers: layer_set`.

The frontend registry and backend registry must expose the same required flag.
Connection type compatibility and the one-connection limit remain unchanged.

## Execution Modes

### Flatten-Only Mode

When `replacement` is not connected:

1. Resolve and validate the input `layer_set`.
2. Read the base image and every layer asset referenced by the set.
3. Composite visible layers using the saved `x`, `y`, `scale`, and `z_index`.
4. Store a new flattened image asset.
5. Return the input `layer_set` unchanged through the `layers` output.

No new layer-set ID, version, digest, or parent relationship is created. A
flatten operation changes the image representation, not the immutable layer
state.

### Replacement Mode

When `replacement` is connected, preserve the current behavior:

1. Validate that `layer_set_id`, version, digest, layer ID, and pixel dimensions
   match the input layer set.
2. Replace that layer's asset with the edited asset.
3. Create a new immutable derived layer set.
4. Composite and store the flattened image.
5. Return both the flattened image and the derived layer set.

## Data Flow

Recommended flatten-only graph:

```text
图层拆分.layers
  -> 图层画布.layers
  -> 图层合成.layers
  -> 图片输出.image
```

Existing replacement graph:

```text
图层画布.layers ---------------------> 图层合成.layers
图层画布.selected_layer
  -> 图片编辑.edit_layer
  -> 图片编辑.edited_layer ----------> 图层合成.replacement
图层合成.image ----------------------> 图片输出.image
```

Saving the layer canvas updates node configuration but does not itself create
an image. The canvas must run so its derived `layer_set` is available to the
composite node.

## Runtime Resolution

The executor always resolves `values["layers"]`.

It reads `values.get("replacement")`:

- When absent, task parameters contain `input_layer_set` and omit
  `replacement`.
- When present, it is parsed as `AigcEditedLayer`, validated against the layer
  set, and added to task parameters.

The execution parameter schema accepts:

```python
replacement: AigcEditedLayer | None = None
```

Because resolved task parameters differ between the two modes, the existing
structured task input hash distinguishes flatten-only and replacement runs.

## Composition and Versioning

The gateway selects the output layer set before reading or composing pixels:

- No replacement: `output_layer_set = input_layer_set`.
- Replacement present: `output_layer_set` is the current derived replacement
  snapshot.

The composition service always receives `output_layer_set.layers`.

In flatten-only mode, no replacement asset is loaded and no replacement bytes
are inserted into the layer-content map. In replacement mode, current
validation and substitution behavior is unchanged.

## Asset Lineage

Both modes record these inputs:

- Base asset in slot `base`.
- Every layer asset in slot `layers`, ordered by `z_index`.

Replacement mode additionally records:

- Edited asset in slot `replacement`.

Both modes record these outputs:

- Base asset in slot `base`.
- Every asset from the returned layer set in slot `layers`.
- Flattened image asset in slot `image`.

Flatten-only mode therefore references the same layer assets as both inputs and
outputs without cloning them.

## Error Handling

- Missing `layers` remains a pre-execution DAG error.
- Missing `replacement` is valid.
- A connected but invalid replacement still fails.
- A replacement from a different layer-set ID, version, or digest still fails.
- A replacement targeting a missing layer or mismatched pixel dimensions still
  fails.
- Missing, unavailable, or invalid base/layer assets retain current failures.

The optional behavior must not catch or downgrade replacement validation
errors.

## UI Behavior

The node continues to show the `replacement` connector with the label
"替换图层", but it is visually optional and no longer blocks execution.

No new controls or mode selector are added. Whether the node performs
flatten-only or replacement mode is determined solely by whether the
`replacement` port is connected.

## Testing

Schema and registry tests will assert:

- `layers` remains required.
- `replacement` is optional in backend and frontend registries.

DAG and executor tests will assert:

- A graph with only `layers` connected is valid and resolves parameters without
  `replacement`.
- A graph missing `layers` is invalid.
- Existing replacement resolution and mismatch checks still pass.
- Flatten-only and replacement parameter payloads remain distinct.

Gateway tests will assert:

- Flatten-only mode creates an image and returns the exact input layer-set
  identity, version, and digest.
- Flatten-only mode does not read or record a replacement asset.
- Replacement mode still creates a derived layer set and records replacement
  lineage.
- Existing rollback behavior remains valid in both modes.

Frontend tests will assert that the replacement port is rendered as optional
and does not produce a required-input validation issue.

## Acceptance Criteria

- Connecting `图层画布.layers` directly to `图层合成.layers` is runnable.
- The saved canvas layout is reflected in the flattened output image.
- Flatten-only mode reuses the input layer-set snapshot.
- Replacement mode behaves exactly as before.
- Missing required `layers` remains blocked.
- Relevant backend and frontend tests pass.
