# Seedream Flash Model Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `doubao-seedream-5-0-flash-260915` as an optional Seedream image-node model while keeping Pro as the default and exclusive layer-decomposition model.

**Architecture:** Define explicit Pro/Flash model contracts in the backend and a matching frontend capability registry. Persist the selected model through the existing `config.model` field, validate model-operation compatibility on both sides, and pass the selected model unchanged to Ark.

**Tech Stack:** Python 3.11+, Pydantic 2, FastAPI service layer, React 19, Next.js 16, TypeScript 5, Zustand, Vitest, Pytest.

---

## File Structure

- Modify `backend/app/schemas/aigc.py`: define supported image model IDs and validate persisted node configurations.
- Modify `backend/app/services/aigc_dag.py`: enforce operation-specific model capabilities.
- Modify `backend/app/services/aigc_gateway.py`: allow both models for normal generation/edit while retaining Pro-only decomposition.
- Modify `backend/tests/test_aigc_schemas.py`: test accepted and rejected model IDs.
- Modify `backend/tests/test_aigc_dag.py`: test the model-operation capability matrix.
- Modify `backend/tests/test_aigc_gateway.py`: test Flash propagation to Ark requests.
- Create `frontend/lib/aigc/seedream-models.ts`: own model IDs, labels, defaults, and supported-operation helpers.
- Modify `frontend/lib/aigc/node-registry.ts`: expose both models to the node registry without changing the default.
- Modify `frontend/lib/aigc/types.ts`: type image-node model fields with the supported model union.
- Modify `frontend/lib/aigc/seedream-image.ts`: normalize Flash to Pro when entering layer decomposition.
- Modify `frontend/components/workspace/aigc/aigc-editor.tsx`: render model selectors for both `text_to_image` and Seedream multi-operation nodes, plus the current-model description.
- Modify `frontend/tests/aigc-image-config.test.ts`: test normalization during operation changes.
- Modify `frontend/tests/aigc-editor.test.tsx`: test selector behavior and persisted model ID.

Do not stage or modify the pre-existing cleanup changes in
`backend/app/services/assets.py` and `debug-video-generation-invalid-input.md`
as part of this feature's commits.

### Task 1: Backend Supported Model Contract

**Files:**
- Modify: `backend/app/schemas/aigc.py:49-55,940-975`
- Test: `backend/tests/test_aigc_schemas.py`

- [ ] **Step 1: Write schema tests for the supported model set**

Add parameterized tests that validate both model IDs and reject an unknown ID:

```python
@pytest.mark.parametrize(
    "model",
    [
        "doubao-seedream-5-0-pro-260628",
        "doubao-seedream-5-0-flash-260915",
    ],
)
def test_image_model_config_accepts_supported_seedream_models(model: str) -> None:
    config = ImageModelConfig(model=model)
    assert config.model == model


def test_image_model_config_rejects_unknown_model() -> None:
    with pytest.raises(ValidationError):
        ImageModelConfig(model="unknown-image-model")
```

- [ ] **Step 2: Run the schema tests and verify the unknown model test fails**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_aigc_schemas.py::test_image_model_config_accepts_supported_seedream_models \
  backend/tests/test_aigc_schemas.py::test_image_model_config_rejects_unknown_model -q
```

Expected: supported-model cases pass; unknown-model case fails because `model` is currently an unrestricted string.

- [ ] **Step 3: Add the backend model type and constants**

In `backend/app/schemas/aigc.py`, define the model IDs once and use a literal type:

```python
AIGC_SEEDREAM_PRO_MODEL = "doubao-seedream-5-0-pro-260628"
AIGC_SEEDREAM_FLASH_MODEL = "doubao-seedream-5-0-flash-260915"
AIGC_DEFAULT_IMAGE_MODEL = AIGC_SEEDREAM_PRO_MODEL
AigcImageModel = Literal[
    "doubao-seedream-5-0-pro-260628",
    "doubao-seedream-5-0-flash-260915",
]
```

Update `ImageModelConfig`:

```python
class ImageModelConfig(SchemaModel):
    model: AigcImageModel = AIGC_DEFAULT_IMAGE_MODEL
    aspect_ratio: AigcImageAspectRatio = "1:1"
    size: AigcImageSize = "2K"
    format: AigcImageFormat = "png"
```

- [ ] **Step 4: Run the schema tests**

Run the command from Step 2.

Expected: all selected tests pass.

- [ ] **Step 5: Commit the backend model contract**

```bash
git add backend/app/schemas/aigc.py backend/tests/test_aigc_schemas.py
git commit -m "feat(aigc): define supported Seedream image models"
```

### Task 2: Backend Capability and Gateway Execution

**Files:**
- Modify: `backend/app/services/aigc_dag.py:430-450`
- Modify: `backend/app/services/aigc_gateway.py:790-805,980-990,1260-1270`
- Test: `backend/tests/test_aigc_dag.py`
- Test: `backend/tests/test_aigc_gateway.py`

- [ ] **Step 1: Write DAG capability tests**

Extend the existing layer-decomposition test and add supported Flash operations:

```python
@pytest.mark.parametrize(
    "operation",
    ["image_to_image", "image_edit"],
)
def test_flash_model_is_supported_for_standard_image_operations(
    operation: str,
) -> None:
    definition = image_workflow_definition(operation=operation)
    model = next(item for item in definition.nodes if item.id == "model")
    model.config.model = "doubao-seedream-5-0-flash-260915"

    validate_aigc_dag_structure(definition)


def test_layer_decomposition_rejects_seedream_flash() -> None:
    definition = layer_workflow_definition()
    model = next(item for item in definition.nodes if item.id == "decompose")
    model.config.model = "doubao-seedream-5-0-flash-260915"

    with pytest.raises(AigcDagValidationError) as error:
        validate_aigc_dag_structure(definition)

    assert error.value.code == "model_not_supported_for_operation"
```

Use the existing test factories and correct node IDs in
`backend/tests/test_aigc_dag.py`; do not introduce duplicate graph builders.

- [ ] **Step 2: Write Gateway tests for Flash propagation**

For normal image generation and plain image editing, create tasks whose params
contain the Flash ID and assert:

```python
assert generation.image_requests[0]["model"] == (
    "doubao-seedream-5-0-flash-260915"
)
```

Retain the existing assertion that layer decomposition rejects any model other
than `AIGC_DEFAULT_IMAGE_MODEL`.

- [ ] **Step 3: Run the new DAG and Gateway tests and verify failure**

Run:

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_aigc_dag.py \
  backend/tests/test_aigc_gateway.py -q
```

Expected: Flash Gateway tests fail with `image model is not enabled` or
`image edit model is not enabled`.

- [ ] **Step 4: Add operation-aware backend model checks**

Import the supported model constants from `backend.app.schemas.aigc` and define:

```python
AIGC_ENABLED_IMAGE_MODELS = frozenset(
    {AIGC_SEEDREAM_PRO_MODEL, AIGC_SEEDREAM_FLASH_MODEL}
)
```

In `_execute_image` and `_execute_image_edit`, replace equality-to-default
checks with membership in `AIGC_ENABLED_IMAGE_MODELS`. Keep
`_execute_layer_decomposition` restricted to `AIGC_SEEDREAM_PRO_MODEL`.

Keep the existing DAG rule but compare against the named Pro constant and retain
the error code `model_not_supported_for_operation`.

- [ ] **Step 5: Run the backend feature tests**

Run the command from Step 3.

Expected: all DAG and Gateway tests pass.

- [ ] **Step 6: Commit backend execution support**

```bash
git add \
  backend/app/services/aigc_dag.py \
  backend/app/services/aigc_gateway.py \
  backend/tests/test_aigc_dag.py \
  backend/tests/test_aigc_gateway.py
git commit -m "feat(aigc): execute Seedream Flash image tasks"
```

### Task 3: Frontend Model Capability Registry

**Files:**
- Create: `frontend/lib/aigc/seedream-models.ts`
- Modify: `frontend/lib/aigc/types.ts`
- Modify: `frontend/lib/aigc/node-registry.ts`
- Modify: `frontend/lib/aigc/seedream-image.ts`
- Test: `frontend/tests/aigc-image-config.test.ts`

- [ ] **Step 1: Write frontend model-normalization tests**

Add tests proving Flash is retained for supported operations and replaced when
entering layer decomposition:

```typescript
it("keeps Flash for image generation and editing operations", () => {
  for (const operation of ["image_to_image", "image_edit"] as const) {
    expect(
      normalizeSeedreamImageConfig({
        ...baseConfig,
        model: "doubao-seedream-5-0-flash-260915",
        operation
      })
    ).toMatchObject({
      model: "doubao-seedream-5-0-flash-260915",
      operation
    });
  }
});

it("switches Flash to Pro when entering layer decomposition", () => {
  expect(
    normalizeSeedreamImageConfig(
      {
        ...baseConfig,
        model: "doubao-seedream-5-0-flash-260915",
        operation: "layer_decomposition"
      },
      "image_to_image"
    )
  ).toMatchObject({
    model: "doubao-seedream-5-0-pro-260628",
    operation: "layer_decomposition",
    size: "auto"
  });
});
```

- [ ] **Step 2: Run the focused frontend test and verify failure**

Run:

```bash
cd frontend && npm test -- --run tests/aigc-image-config.test.ts
```

Expected: the layer-decomposition test fails because model normalization does
not yet enforce capabilities.

- [ ] **Step 3: Create the frontend model registry**

Create `frontend/lib/aigc/seedream-models.ts`:

```typescript
export type SeedreamOperation =
  | "text_to_image"
  | "image_to_image"
  | "image_edit"
  | "layer_decomposition";

export const SEEDREAM_PRO_MODEL =
  "doubao-seedream-5-0-pro-260628" as const;
export const SEEDREAM_FLASH_MODEL =
  "doubao-seedream-5-0-flash-260915" as const;

export const SEEDREAM_MODELS = [
  {
    id: SEEDREAM_PRO_MODEL,
    label: "Seedream 5.0 Pro",
    operations: [
      "text_to_image",
      "image_to_image",
      "image_edit",
      "layer_decomposition"
    ]
  },
  {
    id: SEEDREAM_FLASH_MODEL,
    label: "Seedream 5.0 Flash",
    operations: ["text_to_image", "image_to_image", "image_edit"]
  }
] as const satisfies readonly {
  id: string;
  label: string;
  operations: readonly SeedreamOperation[];
}[];

export type SeedreamModel = (typeof SEEDREAM_MODELS)[number]["id"];
export const SEEDREAM_DEFAULT_MODEL: SeedreamModel = SEEDREAM_PRO_MODEL;

export function seedreamModelSupportsOperation(
  model: SeedreamModel,
  operation: SeedreamOperation
): boolean {
  return SEEDREAM_MODELS.some(
    (item) => item.id === model && item.operations.includes(operation)
  );
}
```

If TypeScript rejects `includes(operation)` due to narrowed tuples, use
`(item.operations as readonly SeedreamOperation[]).includes(operation)`.

- [ ] **Step 4: Apply the typed model contract**

Update image model config interfaces in `frontend/lib/aigc/types.ts` so their
`model` field is `SeedreamModel`. Replace
`AIGC_DEFAULT_IMAGE_MODEL` in `frontend/lib/aigc/node-registry.ts` with an alias
of `SEEDREAM_DEFAULT_MODEL`, and list both IDs in the image model registry
entries:

```typescript
models: SEEDREAM_MODELS.map((model) => model.id)
```

Update `normalizeSeedreamImageConfig` to set:

```typescript
const model = seedreamModelSupportsOperation(config.model, operation)
  ? config.model
  : SEEDREAM_DEFAULT_MODEL;
```

Return the normalized `model` together with `operation` and `size`.

- [ ] **Step 5: Run the frontend model tests**

Run the command from Step 2.

Expected: all selected tests pass.

- [ ] **Step 6: Commit the frontend model contract**

```bash
git add \
  frontend/lib/aigc/seedream-models.ts \
  frontend/lib/aigc/types.ts \
  frontend/lib/aigc/node-registry.ts \
  frontend/lib/aigc/seedream-image.ts \
  frontend/tests/aigc-image-config.test.ts
git commit -m "feat(aigc): define Seedream model capabilities"
```

### Task 4: Text-to-Image and Seedream Model Selectors

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:2123-2255`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [ ] **Step 1: Write editor interaction tests**

Add a test that selects the Seedream node and verifies:

```typescript
const modelSelect = screen.getByLabelText("模型");
expect(modelSelect).toHaveValue("doubao-seedream-5-0-pro-260628");
expect(
  within(modelSelect).getByRole("option", { name: "Seedream 5.0 Flash" })
).toBeInTheDocument();

fireEvent.change(modelSelect, {
  target: { value: "doubao-seedream-5-0-flash-260915" }
});
expect(modelSelect).toHaveValue("doubao-seedream-5-0-flash-260915");
expect(screen.getByText("Seedream 5.0 Flash")).toBeInTheDocument();

fireEvent.click(screen.getByRole("button", { name: "图层拆分" }));
expect(modelSelect).toHaveValue("doubao-seedream-5-0-pro-260628");
expect(
  within(modelSelect).queryByRole("option", { name: "Seedream 5.0 Flash" })
).not.toBeInTheDocument();
```

Assert the store's node config contains the full selected ID before and after
the operation switch.

Add a separate editor test for a `text_to_image` node:

```typescript
act(() => store.getState().selectNode("text-to-image"));
const textToImageModel = screen.getByLabelText("模型");
fireEvent.change(textToImageModel, {
  target: { value: "doubao-seedream-5-0-flash-260915" }
});
expect(
  store.getState().definition.nodes.find(
    (node) => node.id === "text-to-image"
  )
).toMatchObject({
  config: { model: "doubao-seedream-5-0-flash-260915" }
});
```

- [ ] **Step 2: Run the editor tests and verify failure**

Run:

```bash
cd frontend && npm test -- --run tests/aigc-editor.test.tsx
```

Expected: fails because neither image configuration renders a model selector.

- [ ] **Step 3: Render the text-to-image model selector**

In the `node.type === "text_to_image"` branch, render `SelectField` before
`AigcImageDimensionsField`:

```tsx
<SelectField
  label="模型"
  onChange={(value) =>
    update(node.id, {
      ...node.config,
      model: value as SeedreamModel
    })
  }
  options={seedreamModelOptions("text_to_image")}
  value={node.config.model}
/>
```

Export a helper from `seedream-models.ts`:

```typescript
export function seedreamModelOptions(operation: SeedreamOperation) {
  return SEEDREAM_MODELS
    .filter((model) =>
      (model.operations as readonly SeedreamOperation[]).includes(operation)
    )
    .map((model) => ({ label: model.label, value: model.id }));
}
```

- [ ] **Step 4: Render operation-aware Seedream model options**

In `SeedreamImageConfig`, derive:

```typescript
const modelOptions = seedreamModelOptions(operation);
const selectedModel = SEEDREAM_MODELS.find(
  (model) => model.id === node.config.model
);
```

Render a `SelectField` before the operation description:

```tsx
<SelectField
  label="模型"
  onChange={(value) =>
    update(node.id, {
      ...node.config,
      model: value as SeedreamModel
    })
  }
  options={modelOptions}
  value={node.config.model}
/>
```

When changing operation, call `normalizeSeedreamImageConfig` before `update` so
the model and size transition are atomic:

```typescript
update(
  node.id,
  normalizeSeedreamImageConfig(
    { ...node.config, operation: option.value },
    operation
  )
);
```

Replace the hard-coded heading with:

```tsx
<p className="font-medium text-foreground">
  {selectedModel?.label ?? node.config.model}
</p>
```

- [ ] **Step 5: Run the editor and serialization tests**

Run:

```bash
cd frontend && npm test -- --run \
  tests/aigc-editor.test.tsx \
  tests/aigc-image-config.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit the selectors**

```bash
git add \
  frontend/components/workspace/aigc/aigc-editor.tsx \
  frontend/tests/aigc-editor.test.tsx
git commit -m "feat(aigc): add Seedream model selector"
```

### Task 5: Final Verification

**Files:**
- Verify all files changed in Tasks 1-4.

- [ ] **Step 1: Run backend focused tests**

```bash
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_dag.py \
  backend/tests/test_aigc_gateway.py -q
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend focused tests**

```bash
cd frontend && npm test -- --run \
  tests/aigc-image-config.test.ts \
  tests/aigc-editor.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Run frontend static checks**

```bash
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: lint exits successfully and the production build completes.

- [ ] **Step 4: Run backend quality checks**

```bash
.venv/bin/ruff check \
  backend/app/schemas/aigc.py \
  backend/app/services/aigc_dag.py \
  backend/app/services/aigc_gateway.py \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_dag.py \
  backend/tests/test_aigc_gateway.py
PYTHONPATH=. .venv/bin/pytest \
  backend/tests/test_structured_logging.py::test_business_code_has_no_local_debug_reporting_dependencies \
  -q
```

Expected: Ruff and the debug-dependency guard pass.

- [ ] **Step 5: Review the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only Seedream feature files plus the known,
pre-existing video-debug cleanup changes are present.
