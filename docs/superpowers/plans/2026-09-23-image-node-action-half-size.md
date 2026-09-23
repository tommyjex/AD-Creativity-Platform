# Image Node Action Half-Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the image node precise-edit action to exactly half of its current visual dimensions: 12px container, 10px trigger, and 6px icon.

**Architecture:** Keep the existing external action wrapper and `compactTrigger` API. Change only the compact Tailwind size classes and their unit/browser assertions; preserve the default dialog trigger, positioning, event isolation, and dialog behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright Python.

---

## File Map

- Modify `frontend/tests/aigc-flow-node.test.tsx`: update local image action assertions to 12px / 10px / 6px.
- Modify `frontend/tests/aigc-flow-node-v2.test.tsx`: update projected image action assertions to 12px / 10px / 6px.
- Modify `frontend/components/workspace/aigc/aigc-flow-node.tsx`: halve the external image action container.
- Modify `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`: halve only the compact trigger and icon.
- Modify `frontend/scripts/verify-aigc-modality-node-titles.py`: assert computed CSS dimensions and retain three-viewport overlap checks.

### Task 1: Lock the half-size contract

**Files:**
- Modify: `frontend/tests/aigc-flow-node.test.tsx`
- Modify: `frontend/tests/aigc-flow-node-v2.test.tsx`

- [ ] **Step 1: Change local image action expectations**

Update the existing assertions to:

```tsx
expect(externalActions).toHaveClass(
  "h-[12px]",
  "w-[12px]"
);
expect(preciseEdit).toHaveClass(
  "nodrag",
  "h-[10px]",
  "w-[10px]"
);
expect(preciseEdit.querySelector("svg")).toHaveClass(
  "h-[6px]",
  "w-[6px]"
);
```

- [ ] **Step 2: Change projected image action expectations**

Use the same exact arbitrary-value classes in `aigc-flow-node-v2.test.tsx` so both local and projected image nodes enforce the new visual contract.

- [ ] **Step 3: Run focused tests and verify failure**

Run:

```bash
cd frontend
npx vitest run tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx
```

Expected: FAIL because production code still renders `h-6 w-6`, `h-5 w-5`, and `h-3 w-3`.

### Task 2: Implement the half-size action

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`

- [ ] **Step 1: Halve the external container**

Replace the compact image action wrapper sizing with:

```tsx
className="nodrag absolute right-0 top-0 z-10 grid h-[12px] w-[12px] ..."
```

Keep its translation, border, background, shadow, `nodrag`, and propagation handlers unchanged.

- [ ] **Step 2: Halve the compact trigger**

Keep `compactTrigger` optional and retain default dimensions:

```tsx
compactTrigger ? "h-[10px] w-[10px]" : "h-6 w-6"
```

- [ ] **Step 3: Halve the compact icon**

Keep the default icon dimensions unchanged:

```tsx
compactTrigger ? "h-[6px] w-[6px]" : "h-3.5 w-3.5"
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd frontend
npx vitest run tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx
```

Expected: both test files PASS.

### Task 3: Update browser dimensions and verify quality

**Files:**
- Modify: `frontend/scripts/verify-aigc-modality-node-titles.py`
- Modify: `docs/superpowers/plans/2026-09-23-image-node-action-half-size.md`

- [ ] **Step 1: Update computed CSS size assertions**

Change the browser assertions to:

```python
assert image_action_size == {"width": 12, "height": 12}
assert image_button_size == {"width": 10, "height": 10}
assert image_icon_size == {"width": 6, "height": 6}
```

- [ ] **Step 2: Run complete frontend checks**

Run:

```bash
cd frontend
npm test
npm run typecheck
npm run lint
```

Expected: 887 tests PASS; TypeScript and ESLint exit 0.

- [ ] **Step 3: Run three-viewport Playwright acceptance**

Run:

```bash
cd frontend
../.venv/bin/python scripts/verify-aigc-modality-node-titles.py
```

Expected: desktop, tablet, and mobile PASS with four draggable modalities, five isolated controls, and zero console/page errors.

- [ ] **Step 4: Inspect screenshots**

Inspect:

```text
frontend/test-results/aigc-modality-node-titles/desktop-1440x900.png
frontend/test-results/aigc-modality-node-titles/tablet-1024x768.png
frontend/test-results/aigc-modality-node-titles/mobile-390x844.png
```

Confirm the 12px action remains right-aligned above the image node and does not overlap handles, card content, or resize controls.

- [ ] **Step 5: Record completion without committing product code**

Mark this plan complete and report all verification results. Do not commit product code unless the user explicitly requests it.
