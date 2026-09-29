# AIGC Toolbar National Day Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the existing red-silk and warm-gold image only to the AIGC editor's top toolbar while preserving the dark canvas and all toolbar behavior.

**Architecture:** Keep the editor structure and shared canvas component unchanged. Add a local background image and fallback color to `aigc-editor-header`, place one non-interactive contrast overlay below existing toolbar content, and extend the existing Vitest and Playwright contracts.

**Tech Stack:** Next.js, React, Tailwind CSS, Vitest, Testing Library, Playwright

---

## File Structure

- Modify `frontend/components/workspace/aigc/aigc-editor.tsx`: toolbar background image, fallback color, and contrast overlay.
- Modify `frontend/tests/aigc-editor.test.tsx`: component contract for the toolbar image and overlay while retaining the dark-canvas contract.
- Modify `frontend/scripts/verify-aigc-workbench-layout.mjs`: computed-style, asset-loading, and four-viewport visual checks.
- Create `docs/superpowers/plans/2026-09-29-aigc-toolbar-national-day-background.md`: implementation and verification sequence.

### Task 1: Lock The Toolbar Theme Contract

**Files:**
- Modify: `frontend/tests/aigc-editor.test.tsx`
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [ ] **Step 1: Replace the component toolbar background assertion**

Update the existing `aigc-editor-header` assertion to require:

```tsx
expect(screen.getByTestId("aigc-editor-header")).toHaveClass(
  "bg-[#b61519]",
  "bg-[url('/images/navigation-national-day-red.webp')]",
  "bg-cover",
  "bg-center",
  "bg-no-repeat",
  "border-[#6f171b]",
  "h-14",
  "overflow-hidden",
  "shadow-[0_3px_12px_rgba(0,0,0,0.22)]"
);
```

- [ ] **Step 2: Add the decorative overlay assertion**

Add:

```tsx
expect(screen.getByTestId("aigc-toolbar-background-overlay")).toHaveClass(
  "pointer-events-none",
  "absolute",
  "inset-0",
  "z-0",
  "bg-[linear-gradient(180deg,rgba(82,0,4,0.18)_0%,rgba(78,0,4,0.48)_100%)]"
);
expect(
  screen.getByTestId("aigc-toolbar-background-overlay")
).toHaveAttribute("aria-hidden", "true");
```

Keep the existing `node-canvas` `bg-[#101318]` assertion unchanged.

- [ ] **Step 3: Add the Playwright toolbar style checks**

Inside `verifyImmersiveToolbar`, read the toolbar and overlay computed styles:

```js
const toolbarTheme = await header.evaluate((element) => {
  const style = getComputedStyle(element);
  return {
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundImage,
    backgroundPosition: style.backgroundPosition,
    backgroundRepeat: style.backgroundRepeat,
    backgroundSize: style.backgroundSize
  };
});
const toolbarOverlay = page.getByTestId("aigc-toolbar-background-overlay");
```

Assert:

```js
assert(
  toolbarTheme.backgroundColor === "rgb(182, 21, 25)" &&
    toolbarTheme.backgroundImage.includes(
      "/images/navigation-national-day-red.webp"
    ) &&
    toolbarTheme.backgroundPosition === "50% 50%" &&
    toolbarTheme.backgroundRepeat === "no-repeat" &&
    toolbarTheme.backgroundSize === "cover",
  `${prefix}: 工具栏使用正红丝绸与暖金星光底图`,
  toolbarTheme
);
assert(
  (await toolbarOverlay.getAttribute("aria-hidden")) === "true" &&
    (await toolbarOverlay.evaluate(
      (element) => getComputedStyle(element).pointerEvents
    )) === "none",
  `${prefix}: 工具栏对比度遮罩不拦截交互`
);
```

- [ ] **Step 4: Confirm the reused local asset loads**

After each editor page opens, inspect resource timing:

```js
const toolbarAssetLoaded = await page.evaluate(() =>
  performance
    .getEntriesByType("resource")
    .some((entry) =>
      entry.name.includes("/images/navigation-national-day-red.webp")
    )
);
assert(
  toolbarAssetLoaded,
  `${viewport.name}: 工具栏正红底图资源加载成功`
);
```

- [ ] **Step 5: Run the focused test and confirm failure**

Run:

```bash
cd frontend
npm test -- aigc-editor.test.tsx
```

Expected: FAIL because the toolbar still uses `bg-[#171a1f]` and has no overlay.

### Task 2: Apply The Toolbar-Only Background

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [ ] **Step 1: Set the toolbar image and fallback**

Change the header classes to:

```tsx
className="relative flex h-14 shrink-0 flex-row items-center gap-1 overflow-hidden border-b border-[#6f171b] bg-[#b61519] bg-[url('/images/navigation-national-day-red.webp')] bg-cover bg-center bg-no-repeat px-2 shadow-[0_3px_12px_rgba(0,0,0,0.22)] sm:px-3"
```

Do not change the editor shell or `NodeCanvas` background classes.

- [ ] **Step 2: Add the contrast overlay**

Insert as the first child of the header:

```tsx
<div
  aria-hidden="true"
  className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(82,0,4,0.18)_0%,rgba(78,0,4,0.48)_100%)]"
  data-testid="aigc-toolbar-background-overlay"
/>
```

Keep the existing title and action regions at `relative z-10`.

- [ ] **Step 3: Run the focused component test**

Run:

```bash
cd frontend
npm test -- aigc-editor.test.tsx
```

Expected: PASS.

### Task 3: Verify Responsive Rendering And Scope

**Files:**
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [ ] **Step 1: Run static checks**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
```

Expected: both commands exit zero.

- [ ] **Step 2: Run the complete frontend test suite**

Run:

```bash
cd frontend
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Start or reuse the local services**

Confirm the frontend is available at `http://127.0.0.1:3000` and the backend at
`http://127.0.0.1:8000`. Start missing services with the repository's existing development
commands without replacing an occupied port.

- [ ] **Step 4: Run the dedicated four-viewport Playwright acceptance**

Create the fixture and run:

```bash
cd frontend
npm run acceptance:aigc
AIGC_WORKBENCH_FIXTURE='<fixture-json>' npm run acceptance:aigc-workbench
```

Expected: PASS at `1440x900`, `1024x768`, `768x1024`, and `390x844`.

- [ ] **Step 5: Inspect screenshots**

Inspect the generated desktop, threshold, tablet, and mobile images. Confirm that the top toolbar
shows saturated red silk with warm-gold light, toolbar content remains readable, and the canvas,
node palette, and inspector remain dark.

- [ ] **Step 6: Check the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: only the scoped implementation, tests, plan, and the user's pre-existing staged
`frontend/package-lock.json` change are present.

### Task 4: Commit The Implementation

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/tests/aigc-editor.test.tsx`
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`
- Create: `docs/superpowers/plans/2026-09-29-aigc-toolbar-national-day-background.md`

- [ ] **Step 1: Commit only scoped files**

Run:

```bash
git add \
  frontend/components/workspace/aigc/aigc-editor.tsx \
  frontend/tests/aigc-editor.test.tsx \
  frontend/scripts/verify-aigc-workbench-layout.mjs \
  docs/superpowers/plans/2026-09-29-aigc-toolbar-national-day-background.md
git commit -m "feat(frontend): theme AIGC toolbar for National Day" -- \
  frontend/components/workspace/aigc/aigc-editor.tsx \
  frontend/tests/aigc-editor.test.tsx \
  frontend/scripts/verify-aigc-workbench-layout.mjs \
  docs/superpowers/plans/2026-09-29-aigc-toolbar-national-day-background.md
```

Expected: the existing staged `frontend/package-lock.json` remains outside the commit.
