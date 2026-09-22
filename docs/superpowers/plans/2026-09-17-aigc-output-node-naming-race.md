# AIGC Output Node Naming Race Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist AI-generated names on downstream image/video output nodes and prevent stale frontend autosaves from clearing them.

**Architecture:** The repository derives direct media-output targets from the frozen Run definition and patches all targets in the same generated-media commit with one Pipeline revision increment. The frontend carries concrete names from successful Run results through rebase, so it does not depend on a potentially overwritten remote value.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy, Pydantic, React, TypeScript, Zustand, TanStack Query, Vitest, pytest.

---

### Task 1: Reproduce backend output-node naming behavior

**Files:**
- Modify: `backend/tests/test_aigc_repository.py`
- Test: `backend/tests/test_aigc_repository.py`

- [x] **Step 1: Add a failing repository test**

Create a generated-media Run whose generator has a direct `image` output edge.
Commit a successful naming result and assert:

```python
assert output_node.custom_name == "CK棒球领夹克"
assert generator_node.custom_name is None
assert committed_pipeline.revision == initial_revision + 1
```

- [x] **Step 2: Cover fan-out and unrelated nodes**

Add a second direct media output and an unrelated node. Assert both direct outputs
receive the same name while unrelated nodes remain unchanged.

- [x] **Step 3: Run the tests and confirm the current implementation fails**

```bash
.venv/bin/python -m pytest -q backend/tests/test_aigc_repository.py -k generated_media
```

Expected: assertions for downstream output `custom_name` fail.

### Task 2: Patch downstream media outputs atomically

**Files:**
- Modify: `backend/app/repositories/memory.py`
- Modify: `backend/app/repositories/mysql.py`
- Modify: `backend/tests/test_aigc_repository.py`

- [x] **Step 1: Derive naming targets from the Run snapshot**

For a generated task, select direct outgoing edges from `task.node_id` whose target
node type matches the generated modality (`image` or `video`). Deduplicate target
IDs while retaining definition order.

- [x] **Step 2: Patch all target names in one repository update**

Replace the single-node private helper with a helper that accepts a set of target
IDs and updates the latest Pipeline definition once:

```python
nodes = [
    node.model_copy(update={"custom_name": generated_name}, deep=True)
    if node.id in target_node_ids
    else node
    for node in current.definition.nodes
]
```

Increment the Pipeline revision exactly once. Keep the public single-node patch API
by delegating with `{node_id}`.

- [x] **Step 3: Preserve fallback behavior**

When no direct media output exists, keep the generator node as the fallback naming
target so existing pipelines without explicit output nodes remain usable.

- [x] **Step 4: Run backend regression tests**

```bash
.venv/bin/python -m pytest -q backend/tests/test_aigc_repository.py -k "generated_media or node_custom_name"
.venv/bin/python -m pytest -q backend/tests/test_aigc_executor.py -k generated_media
```

Expected: all selected tests pass.

### Task 3: Make frontend rebase use the Run name directly

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/lib/aigc/editor-store.ts`
- Modify: `frontend/tests/aigc-editor-store-v2.test.ts`
- Modify: `frontend/tests/aigc-editor.test.tsx`

- [x] **Step 1: Add a failing race regression test**

Model the server Pipeline as already overwritten to `custom_name=null`, while the
successful Run still contains:

```ts
naming: {
  status: "succeeded",
  model: "doubao-seed-2-0-mini-260428",
  name: "CK棒球领夹克"
}
```

Assert the downstream image node becomes `CK棒球领夹克` and the next autosave sends
that value rather than `null`.

- [x] **Step 2: Carry an authoritative name map**

Replace the ID-only ref with `Map<string, string>`. Derive direct image/video output
node IDs from the current definition and successful Run node. Pass the map into
`mergeAigcServerRevision`.

- [x] **Step 3: Apply concrete names during merge**

For mapped nodes, use the name from the Run:

```ts
custom_name:
  authoritativeNodeNames.get(node.id) ??
  remoteNode?.custom_name ??
  node.custom_name ??
  null
```

Leave all other node fields and local edits under the existing merge policy.

- [x] **Step 4: Run frontend tests and static checks**

```bash
cd frontend
npm test -- tests/aigc-editor-store-v2.test.ts tests/aigc-editor.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands pass.

### Task 4: Verify the real canvas and retain debug evidence

**Files:**
- Modify: `debug-aigc-node-name-missing.md`

- [x] **Step 1: Run backend focused tests**

```bash
.venv/bin/python -m pytest -q backend/tests/test_aigc_repository.py backend/tests/test_aigc_gateway.py -k naming
```

- [x] **Step 2: Restart services with project tooling**

Use `.venv/bin/python` for every Python command. Do not use system `python` or
`python3`.

- [x] **Step 3: Verify the target canvas with its completed named Run**

Use the completed Run naming result to verify Pipeline and UI both persist
`CK棒球领夹克` on the downstream image node, refresh retains it, and the download
filename matches without another paid generation.

- [x] **Step 4: Compare debug evidence**

Record pre-fix and post-fix values for Run naming status, Pipeline revision,
downstream `custom_name`, asset `generated_name`, and download filename. Keep the
debug server and instrumentation until user confirmation.
