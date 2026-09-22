# Persist Hidden AIGC Node Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop AIGC node palette hidden by default and persist the user's explicit visibility choice without affecting narrow-screen overlays or editor data.

**Architecture:** Keep the preference as component-local UI state initialized from a versioned `localStorage` key. Desktop rendering reads that state, while the existing `openPanel` state remains solely responsible for narrow-screen overlays. The palette receives an optional close callback so the docked desktop instance can expose an accessible hide control without changing narrow-screen behavior.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Next.js, Playwright

---

### Task 1: Lock preference behavior with component tests

**Files:**
- Modify: `frontend/tests/aigc-editor.test.tsx`

- [ ] **Step 1: Reset `localStorage` in the editor test setup**

Add `window.localStorage.clear()` to the `AIGC editor modes` `beforeEach` so each test starts without a desktop palette preference.

- [ ] **Step 2: Add failing preference tests**

Cover these exact cases:

```tsx
expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
expect(screen.getByRole("button", { name: "打开节点库" })).toHaveAttribute(
  "aria-expanded",
  "false"
);

window.localStorage.setItem("aigc.node-palette.visible.v1", "true");
expect(screen.getByTestId("aigc-node-palette")).toHaveClass("w-[184px]");

window.localStorage.setItem("aigc.node-palette.visible.v1", "invalid");
expect(screen.queryByTestId("aigc-node-palette")).toBeNull();
```

Also mock throwing `getItem` and `setItem` calls and verify the editor remains usable.

- [ ] **Step 3: Add failing interaction and isolation tests**

Click “打开节点库”, verify the value becomes `"true"`, add two nodes while the palette remains visible, then click “隐藏节点库” and verify the value becomes `"false"`. Advance fake timers beyond 800ms and assert neither update API was called for visibility-only changes.

- [ ] **Step 4: Add failing responsive tests**

Exercise `1023px -> 1024px -> 1023px -> 1024px`: the narrow overlay must close on desktop entry, never reopen automatically on narrow entry, and the docked palette must follow the stored desktop preference.

- [ ] **Step 5: Run the focused tests and confirm failure**

Run:

```bash
cd frontend
npx vitest run tests/aigc-editor.test.tsx
```

Expected: failures for the missing “打开节点库” and “隐藏节点库” controls and the old always-visible desktop palette.

### Task 2: Implement the desktop preference and controls

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`

- [ ] **Step 1: Add strict storage helpers**

Define the key and safe helpers near the editor UI types:

```tsx
const NODE_PALETTE_VISIBILITY_KEY = "aigc.node-palette.visible.v1";

function readNodePaletteVisibility(): boolean {
  try {
    return window.localStorage.getItem(NODE_PALETTE_VISIBILITY_KEY) === "true";
  } catch {
    return false;
  }
}

function writeNodePaletteVisibility(visible: boolean): void {
  try {
    window.localStorage.setItem(
      NODE_PALETTE_VISIBILITY_KEY,
      String(visible)
    );
  } catch {
    // The UI state remains usable when storage is unavailable.
  }
}
```

- [ ] **Step 2: Add isolated desktop UI state**

Initialize `desktopNodePaletteVisible` with the safe reader and expose a callback that updates component state and writes the strict boolean string. Do not place this value in the editor store or autosave draft.

- [ ] **Step 3: Render accessible desktop controls**

Render the docked palette only when `isDesktop && desktopNodePaletteVisible`. When hidden, render an absolute canvas control with:

```tsx
aria-controls="aigc-node-palette"
aria-expanded={false}
aria-label="打开节点库"
title="打开节点库"
```

Pass an `onClose` callback to the docked palette and render a `PanelLeftClose` icon button in its title row with matching `aria-controls`, `aria-expanded`, `aria-label`, and `title`.

- [ ] **Step 4: Keep narrow behavior independent**

Do not read the desktop preference when deciding `openPanel === "nodes"`. Keep narrow add behavior as `addNode(type); setOpenPanel(null);` and do not pass the desktop close callback to the narrow palette.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd frontend
npx vitest run tests/aigc-editor.test.tsx
```

Expected: all AIGC editor tests pass.

### Task 3: Update browser acceptance coverage

**Files:**
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [ ] **Step 1: Start each viewport without a stored preference**

Clear `localStorage` before navigation so desktop assertions prove the default-hidden state.

- [ ] **Step 2: Verify desktop show, hide, and persistence**

At `1440x900` and `1024x768`, assert the palette is absent, click “打开节点库”, assert its width is 184px, reload and assert it remains visible, click “隐藏节点库”, reload and assert it remains hidden.

- [ ] **Step 3: Verify narrow overlays and breakpoint restoration**

At `768x1024` and `390x844`, keep the existing 240px temporary overlay and Inspector mutual-exclusion assertions. In the desktop run, resize across 1023/1024 and assert the narrow overlay does not auto-open and the saved desktop state returns.

- [ ] **Step 4: Capture acceptance screenshots**

Write separate hidden, visible, and narrow-overlay screenshots to the configured artifacts directory.

### Task 4: Complete regression checks and specification tracking

**Files:**
- Modify: `.trae/specs/persist-hidden-aigc-node-palette/tasks.md`
- Modify: `.trae/specs/persist-hidden-aigc-node-palette/checklist.md`

- [ ] **Step 1: Run focused and full checks**

```bash
cd frontend
npx vitest run tests/aigc-editor.test.tsx
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits with status 0.

- [ ] **Step 2: Run Playwright acceptance**

Create an AIGC fixture, pass its JSON as `AIGC_WORKBENCH_FIXTURE`, then run:

```bash
cd frontend
npm run acceptance:aigc-workbench
```

Expected: `result: "PASS"` and screenshots for all required viewports and palette states.

- [ ] **Step 3: Inspect screenshots**

Open the desktop hidden/visible and tablet/mobile overlay screenshots and verify there is no overlap, clipping, text overflow, or stretched media.

- [ ] **Step 4: Mark completed specification items**

Check only the task and checklist entries demonstrated by passing automated checks and screenshot inspection.
