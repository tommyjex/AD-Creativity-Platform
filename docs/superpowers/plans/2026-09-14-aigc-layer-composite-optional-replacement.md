# AIGC Layer Composite Optional Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a layer composite node to flatten a layer canvas output without requiring an edited replacement layer.

**Architecture:** Mark the replacement port optional in both registries, omit replacement task parameters when no edge is connected, and branch in the gateway between reusing the input layer-set snapshot and creating the existing replacement-derived snapshot. Pixel composition remains centralized in `ImageLayerCompositionService`.

**Tech Stack:** Python 3.14, Pydantic v2, React/TypeScript registry metadata, pytest, Vitest

---

## File Map

- Modify `backend/app/schemas/aigc.py`: mark the backend replacement input optional.
- Modify `frontend/lib/aigc/node-registry.ts`: mark the frontend replacement input optional.
- Modify `backend/app/services/aigc_executor.py`: resolve replacement only when connected.
- Modify `backend/app/services/aigc_gateway.py`: support flatten-only execution and conditional replacement lineage.
- Modify `backend/tests/test_aigc_schemas.py`: verify backend port required flags.
- Modify `frontend/tests/aigc-contracts.test.tsx`: verify frontend port required flags.
- Modify `backend/tests/test_aigc_executor.py`: verify flatten-only task parameter resolution.
- Modify `backend/tests/test_aigc_gateway.py`: verify flatten-only pixels, snapshot reuse, and lineage.

### Task 1: Make the replacement port optional

**Files:**
- Modify: `backend/tests/test_aigc_schemas.py:267-275`
- Modify: `frontend/tests/aigc-contracts.test.tsx:95-110`
- Modify: `backend/app/schemas/aigc.py:2119-2131`
- Modify: `frontend/lib/aigc/node-registry.ts:263-276`

- [x] **Step 1: Update backend registry assertions**

Assert both input IDs, types, and required flags:

```python
    assert [
        (port.id, port.type, port.required)
        for port in layer_composite.inputs
    ] == [
        ("layers", AigcPortType.LAYER_SET, True),
        ("replacement", AigcPortType.EDITED_LAYER, False),
    ]
```

- [x] **Step 2: Update frontend registry assertions**

Expect:

```typescript
inputs: [
  { id: "layers", type: "layer_set", required: true },
  { id: "replacement", type: "edited_layer", required: false }
]
```

- [x] **Step 3: Run the contract tests and verify they fail**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_schemas.py::test_aigc_node_registry_declares_typed_ports \
  -q
cd frontend && npm test -- --run tests/aigc-contracts.test.tsx
```

Expected: both suites fail because replacement is currently required.

- [x] **Step 4: Change both registries**

Backend:

```python
_port(
    "replacement",
    "替换图层",
    AigcPortType.EDITED_LAYER,
    required=False,
)
```

Frontend:

```typescript
port("replacement", "替换图层", "edited_layer", {
  required: false
})
```

- [x] **Step 5: Run the contract tests**

Run the Step 3 commands again.

Expected: both suites pass.

### Task 2: Resolve flatten-only task parameters

**Files:**
- Modify: `backend/tests/test_aigc_executor.py:3949-4097`
- Modify: `backend/app/services/aigc_executor.py:1131-1136`

- [x] **Step 1: Add a flatten-only executor test**

Build a definition containing a successful canvas node, a composite node, and
only this edge:

```python
edge(
    "composite-layers",
    "canvas",
    "layers",
    "composite",
    "layers",
)
```

Resolve the composite parameters and assert:

```python
assert params["input_layer_set"]["id"] == layer_set.id
assert "replacement" not in params
```

- [x] **Step 2: Run the executor test and verify it fails**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_executor.py::test_resolve_layer_composite_params_without_replacement \
  -q
```

Expected: failure from `values["replacement"]`.

- [x] **Step 3: Make replacement resolution conditional**

Update the layer composite branch:

```python
        elif isinstance(node, LayerCompositeNode):
            layer_set = AigcLayerSet.model_validate(values["layers"])
            params["input_layer_set"] = layer_set.model_dump(mode="json")
            replacement_value = values.get("replacement")
            if replacement_value is not None:
                replacement = AigcEditedLayer.model_validate(replacement_value)
                _validate_layer_composite_source(layer_set, replacement)
                params["replacement"] = replacement.model_dump(mode="json")
```

- [x] **Step 4: Run focused executor tests**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_executor.py \
  -k "layer_canvas_and_composite or layer_composite_params_without_replacement or layer_canvas_rejects_stale" \
  -q
```

Expected: all selected tests pass.

### Task 3: Support flatten-only composition in the gateway

**Files:**
- Modify: `backend/tests/test_aigc_gateway.py:2686-2955`
- Modify: `backend/app/services/aigc_gateway.py:296-299`
- Modify: `backend/app/services/aigc_gateway.py:1564-1763`

- [x] **Step 1: Add a flatten-only gateway test**

Create params with the existing fixture and remove replacement:

```python
    params = _layer_composite_params(repository, test_asset_storage)
    params.pop("replacement")
```

Execute the task and assert:

```python
    output_layer_set = execution.result.layer_set
    assert output_layer_set is not None
    assert output_layer_set.model_dump(mode="json") == params["input_layer_set"]
```

Verify the rendered pixels use `layer-old`, `layer-other`, and omit the hidden
layer. Verify lineage has no `replacement` slot and output layer references
reuse the original asset IDs.

- [x] **Step 2: Run the gateway test and verify it fails**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_gateway.py::test_gateway_flattens_layer_set_without_replacement \
  -q
```

Expected: Pydantic validation fails because `replacement` is required.

- [x] **Step 3: Make execution parameters optional**

Change:

```python
class AigcLayerCompositeExecutionParams(SchemaModel):
    input_layer_set: AigcLayerSet
    replacement: AigcEditedLayer | None = None
```

- [x] **Step 4: Branch replacement validation and asset loading**

Use:

```python
        replacement = params.replacement
        source_layer = (
            _validate_layer_composite_source(layer_set, replacement)
            if replacement is not None
            else None
        )
        replacement_asset = (
            self.repository.get_asset(replacement.asset_id)
            if replacement is not None
            else None
        )
```

Validate and read the replacement asset only when present.

- [x] **Step 5: Build conditional input lineage**

Build base and layer references first. Append a `replacement` reference only
when `replacement_asset` exists:

```python
        if replacement_asset is not None:
            input_references.append(
                AigcPipelineTaskAssetReference(
                    task_id=task.task_id,
                    direction=AigcAssetDirection.INPUT,
                    slot="replacement",
                    ordinal=0,
                    asset_id=replacement_asset.id,
                )
            )
```

- [x] **Step 6: Select output layer-set semantics**

Use the input snapshot in flatten-only mode and retain existing derivation in
replacement mode:

```python
        if replacement is None:
            output_layer_set = layer_set
        else:
            assert source_layer is not None
            derived_layers = [...]
            output_layer_set = AigcLayerSet(...)
            layer_contents[replacement.asset_id] = replacement_content
```

Pass `output_layer_set` to composition, asset metadata, output lineage, and the
returned `AigcTaskResult`.

- [x] **Step 7: Run focused gateway tests**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_gateway.py \
  -k "layer_composite" \
  -q
```

Expected: flatten-only, replacement, mismatch, and rollback tests pass.

### Task 4: Full verification

**Files:**
- Verify all files listed above.

- [x] **Step 1: Run backend regression tests**

Run:

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_dag.py \
  backend/tests/test_aigc_executor.py \
  backend/tests/test_aigc_gateway.py \
  backend/tests/test_image_layers.py \
  -q
```

Expected: all selected tests pass.

- [x] **Step 2: Run frontend contract tests**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-contracts.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands pass.

- [x] **Step 3: Run static checks**

Run:

```bash
.venv/bin/python -m py_compile \
  backend/app/schemas/aigc.py \
  backend/app/services/aigc_executor.py \
  backend/app/services/aigc_gateway.py \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_executor.py \
  backend/tests/test_aigc_gateway.py
git diff --check
```

Expected: both commands complete without errors.

- [x] **Step 4: Restart services and verify health**

Restart the backend with `.env`, keep the existing frontend dev server, and
verify:

```bash
curl -sS http://127.0.0.1:8000/health
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000
```

Expected: backend status `ok` and frontend HTTP `200`.
