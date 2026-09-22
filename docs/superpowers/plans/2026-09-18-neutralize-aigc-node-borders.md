# Neutralize AIGC Node Borders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every AIGC canvas node use the same neutral outer border while preserving the existing selection ring and modality-colored ports.

**Architecture:** Keep the change inside the shared `AigcFlowNodeCard` root container so every node category receives the same border treatment. Update component tests to distinguish the neutral card border from modality-colored handles, then add a browser-level computed-style check to the existing workbench acceptance script.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright

---

### Task 1: Lock The Border Contract With Component Tests

**Files:**
- Modify: `frontend/tests/aigc-flow-node.test.tsx:307-443`
- Modify: `frontend/tests/aigc-flow-node.test.tsx:617-648`
- Modify: `frontend/tests/aigc-flow-node.test.tsx:1056-1121`

- [x] **Step 1: Replace modality-border expectations**

For text, image, video, audio, model, video enhancement, and face blur cards, assert:

```tsx
expect(card).toHaveClass("border-border");
expect(card.style.borderColor).toBe("");
```

Keep the existing video input/output handle assertions so the tests continue to prove that modality colors remain available for port identification.

- [x] **Step 2: Update the selected-node expectation**

Assert the selected card has both the neutral border and existing ring:

```tsx
expect(card).toHaveClass(
  "border-border",
  "ring-2",
  "ring-primary/20"
);
expect(card).not.toHaveClass("border-primary");
expect(card.style.borderColor).toBe("");
```

- [x] **Step 3: Run the focused test and verify the old implementation fails**

Run:

```bash
npm test -- --run tests/aigc-flow-node.test.tsx
```

Expected: FAIL because modality cards still have inline `borderColor`, and selected non-modality cards may still use `border-primary`.

### Task 2: Apply One Neutral Outer Border

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx:144-154`
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx:425-441`

- [x] **Step 1: Remove root-card modality color selection**

Delete the `category` and `inputModalityColors` variables. Keep `getAigcModalityColors` imported because input and output handles still use it.

- [x] **Step 2: Simplify the root card**

Use a permanent neutral border class and retain only the selected ring condition:

```tsx
<div
  className={cn(
    "flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-md",
    selected && "ring-2 ring-primary/20"
  )}
>
```

- [x] **Step 3: Run the focused test and verify it passes**

Run:

```bash
npm test -- --run tests/aigc-flow-node.test.tsx
```

Expected: PASS.

### Task 3: Add Browser-Level Visual Contract

**Files:**
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs:43-83`

- [x] **Step 1: Inspect all rendered node cards**

Evaluate the first child of each `.react-flow__node` and collect its computed border color, inline border color, and box shadow:

```js
const nodeCardStyles = await page.locator(".react-flow__node").evaluateAll(
  (nodes) =>
    nodes.map((node) => {
      const card = node.firstElementChild;
      const style = getComputedStyle(card);
      return {
        borderColor: style.borderColor,
        inlineBorderColor: card.style.borderColor
      };
    })
);
```

- [x] **Step 2: Assert one neutral computed border and no inline override**

Assert every card has an empty `inlineBorderColor` and that all computed `borderColor` values are identical. After selecting a node on desktop, assert its root card has a non-`none` box shadow so the selection ring remains visible.

- [x] **Step 3: Run the workbench acceptance flow**

Create the fixture and pass it to the verifier:

```bash
AIGC_WORKBENCH_FIXTURE="$(npm run acceptance:aigc -- --json)" \
  npm run acceptance:aigc-workbench
```

Expected: PASS at 1440x900, 1024x768, 768x1024, and 390x844, with screenshots written to the configured artifact directory.

### Task 4: Complete Regression Verification

**Files:**
- Modify: `.trae/specs/neutralize-aigc-node-borders/tasks.md`
- Modify: `.trae/specs/neutralize-aigc-node-borders/checklist.md`

- [x] **Step 1: Run static checks**

```bash
npm run typecheck
npm run lint
```

Expected: both commands exit successfully.

- [x] **Step 2: Run the complete frontend test suite**

```bash
npm test
```

Expected: all tests pass.

- [x] **Step 3: Build the production frontend**

```bash
npm run build
```

Expected: Next.js production build succeeds.

- [x] **Step 4: Inspect acceptance screenshots**

Open the generated desktop, threshold, tablet, and mobile screenshots. Confirm the outer borders are visually neutral, selected nodes retain a visible blue ring, media remains uncropped, and no controls overlap.

- [x] **Step 5: Mark the approved spec artifacts complete**

Check every completed item in:

```text
.trae/specs/neutralize-aigc-node-borders/tasks.md
.trae/specs/neutralize-aigc-node-borders/checklist.md
```
