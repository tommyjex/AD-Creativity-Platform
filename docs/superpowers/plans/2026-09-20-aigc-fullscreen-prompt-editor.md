# AIGC Fullscreen Prompt Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let AIGC text-node users inspect and edit complete long prompts in a responsive fullscreen dialog without changing prompt optimization behavior.

**Architecture:** Keep `AigcPromptEditor` responsible for deriving the effective prompt, editability, and the existing `updateNodeConfig` write path. Add a local controlled dialog component that owns a temporary draft and only invokes the supplied apply callback for a changed valid value. Replace the inline primary textarea with a compact read-only preview and explicit expand affordances while retaining BBox-reference editing and prompt optimization unchanged.

**Tech Stack:** React 19, TypeScript, Radix Dialog, Tailwind CSS, Lucide, Zustand, Vitest, Testing Library, Playwright.

---

## File Structure

- Modify: `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`
  - Derive an expanded-editor state, render the compact preview, and add the local `PromptFullscreenEditor` dialog.
- Modify: `frontend/tests/aigc-prompt-editor.test.tsx`
  - Replace obsolete inline-text assumptions and cover preview, draft application, cancellation, keyboard behavior, no-op behavior, and upstream read-only mode.
- Modify: `frontend/scripts/verify-aigc-prompt-optimization.mjs`
  - Extend its existing desktop and 390px Playwright loop with an editor-open, full-content, keyboard-apply, and viewport-bound check.

### Task 1: Define Fullscreen Editor Behavior in Component Tests

**Files:**
- Modify: `frontend/tests/aigc-prompt-editor.test.tsx`

- [ ] **Step 1: Replace the inline base-text expectation with compact-preview assertions**

  Update the initial render test to locate the `基础文本` preview by `data-testid="aigc-prompt-preview"` and assert that it:

  ```tsx
  expect(screen.getByTestId("aigc-prompt-preview")).toHaveTextContent("将");
  expect(
    screen.getByRole("button", { name: "展开编辑基础文本" })
  ).toBeEnabled();
  ```

  Keep the existing BBox token and reference-instruction assertions because those controls remain in the inspector.

- [ ] **Step 2: Add failing interaction tests for the editor contract**

  Add focused tests that render the normal provider tree and verify:

  ```tsx
  fireEvent.click(screen.getByTestId("aigc-prompt-preview"));
  const editor = screen.getByRole("dialog", { name: "编辑基础文本" });
  const textarea = within(editor).getByRole("textbox", {
    name: "完整基础文本"
  });
  fireEvent.change(textarea, { target: { value: "完整的新提示词" } });
  fireEvent.click(within(editor).getByRole("button", { name: "应用" }));
  expect(getV2Node(store, "prompt", "text").config.text).toBe(
    "完整的新提示词"
  );
  ```

  Cover all required branches in separate tests:
  - icon-button opening and preview clicking both open the dialog;
  - long content is present in the dialog textarea and the content uses `whitespace-pre-wrap`/scrollable preview classes without `truncate`;
  - `metaKey` and `ctrlKey` `Enter` apply;
  - cancel, close icon, and Escape preserve the original config;
  - applying an unchanged value closes the dialog while leaving `store.getState().past` unchanged;
  - an upstream text node with no editable successful projection opens a read-only textarea and has no `应用` button.

- [ ] **Step 3: Run the focused test file to verify the new tests fail**

  Run:

  ```bash
  cd frontend && npm test -- --run tests/aigc-prompt-editor.test.tsx
  ```

  Expected: the new tests fail because the compact preview and fullscreen dialog do not exist.

### Task 2: Implement Inspector Preview and Controlled Fullscreen Dialog

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-prompt-editor.tsx:1-610`

- [ ] **Step 1: Add explicit expanded-editor state and a guarded apply callback**

  Import `Expand` from `lucide-react`, add `isFullscreenEditorOpen` state, and retain a ref to the last triggering element. Add these functions adjacent to `updateText`:

  ```tsx
  function openFullscreenEditor(event?: React.MouseEvent<HTMLElement>) {
    fullscreenEditorTriggerRef.current = event?.currentTarget ?? null;
    setFullscreenEditorOpen(true);
  }

  function applyFullscreenText(value: string) {
    if (value === effectiveText) return;
    updateText(value);
  }
  ```

  Change `updateText` to return `boolean`: return `false` for a manually entered coordinate tag and `true` after dispatching the existing store update. The dialog uses that result to remain open on a validation failure.

- [ ] **Step 2: Replace the inline primary textarea with a bounded preview and expand button**

  Preserve the label, optimization button, and BBox reference area. Replace only the primary textarea with:

  ```tsx
  <button
    aria-label="展开编辑基础文本"
    className="min-h-24 w-full overflow-y-auto whitespace-pre-wrap px-3 py-2 text-left font-mono text-sm leading-6 text-foreground"
    data-testid="aigc-prompt-preview"
    onClick={openFullscreenEditor}
    type="button"
  >
    {effectiveText || "（空）"}
  </button>
  ```

  Constrain the surrounding preview to approximately six text lines (`max-h-40`), retain a visible character count and max-length count, and add a `Button size="icon"` using `Expand` with both `aria-label` and `title` set to `展开编辑基础文本`. When `canEditText` is false, leave preview opening enabled so the read-only dialog can show the effective content.

- [ ] **Step 3: Add a local `PromptFullscreenEditor` component**

  Define it below `AigcPromptEditor` in the same module with this contract:

  ```tsx
  function PromptFullscreenEditor({
    editable,
    nodeName,
    onApply,
    onOpenChange,
    open,
    value
  }: {
    editable: boolean;
    nodeName: string;
    onApply: (value: string) => boolean;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    value: string;
  }) { /* controlled draft dialog */ }
  ```

  On open, reset the draft from `value`, focus the textarea, and snapshot the opening value. Render:
  - `DialogContent` with `data-testid="aigc-fullscreen-prompt-editor"`, `grid h-[94dvh] w-[calc(100vw-1rem)] max-w-[96rem] grid-rows-[auto_minmax(0,1fr)_auto] p-0`, and mobile `sm:` sizing that stays within the viewport;
  - a fixed dark header with title `编辑基础文本`, node name, and character counter;
  - a `min-h-0` central section whose `Textarea` has `aria-label="完整基础文本"`, `autoFocus`, `font-mono`, `h-full`, `resize-none`, `overflow-y-auto`, and `readOnly={!editable}`;
  - a fixed footer with `取消` and, only for editable content, `应用`.

  Handle `Cmd/Ctrl+Enter` on the textarea by preventing the newline and applying the draft. Route Radix `onOpenChange(false)`, Escape, the close icon, and `取消` through the same close callback, so no draft writes until `应用`. On successful apply, close and restore focus to the original trigger; on an invalid coordinate-tag result, retain the dialog and surface the existing validation alert.

- [ ] **Step 4: Render the dialog from `AigcPromptEditor`**

  Pass `effectiveText`, `canEditText`, the derived text-node display name, `isFullscreenEditorOpen`, `applyFullscreenText`, and a close callback to `PromptFullscreenEditor`. The close callback must clear the open state and restore focus to the recorded preview/button only after the dialog has closed.

- [ ] **Step 5: Run focused component tests**

  Run:

  ```bash
  cd frontend && npm test -- --run tests/aigc-prompt-editor.test.tsx
  ```

  Expected: PASS.

### Task 3: Add Multi-Viewport Browser Acceptance

**Files:**
- Modify: `frontend/scripts/verify-aigc-prompt-optimization.mjs`

- [ ] **Step 1: Add an editor verification helper to the existing viewport scenario**

  After the normal prompt-optimization assertions in `verifyViewport`, call:

  ```js
  await verifyFullscreenPromptEditor(page, viewport);
  ```

  Implement the helper to select the fixture text node, open `[data-testid="aigc-prompt-preview"]`, and assert:

  ```js
  const dialog = page.getByTestId("aigc-fullscreen-prompt-editor");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "完整基础文本" })).toHaveValue(
    /.+/
  );
  ```

  Fill a unique long prompt, press `Meta+Enter` on macOS or `Control+Enter` elsewhere, then assert the inspector preview reflects the entire value. Open once more and use `Escape`; assert the just-applied value is preserved. Measure the dialog bounding box and assert its `x`, `y`, right edge, and bottom edge remain inside the active `viewport`.

- [ ] **Step 2: Run the fixture setup and browser acceptance in desktop and narrow viewports**

  Run:

  ```bash
  cd frontend && npm run acceptance:aigc && npm run acceptance:aigc-prompt-optimization
  ```

  Expected: `result: "PASS"` and artifacts under `frontend/test-results/aigc-prompt-optimization/` for both `desktop-1440x900` and `narrow-390x844`.

### Task 4: Validate Quality Gates

**Files:**
- Verify: `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`
- Verify: `frontend/tests/aigc-prompt-editor.test.tsx`
- Verify: `frontend/scripts/verify-aigc-prompt-optimization.mjs`

- [ ] **Step 1: Run ESLint on changed source and test files**

  Run:

  ```bash
  cd frontend && npx eslint components/workspace/aigc/aigc-prompt-editor.tsx tests/aigc-prompt-editor.test.tsx scripts/verify-aigc-prompt-optimization.mjs
  ```

  Expected: no errors or warnings.

- [ ] **Step 2: Inspect the final diff for scope and compatibility**

  Run:

  ```bash
  git diff --check -- frontend/components/workspace/aigc/aigc-prompt-editor.tsx frontend/tests/aigc-prompt-editor.test.tsx frontend/scripts/verify-aigc-prompt-optimization.mjs
  ```

  Expected: no whitespace errors; prompt optimization request construction and BBox-reference updates remain unchanged.

- [ ] **Step 3: Commit only task-owned files when the worktree allows it**

  Run:

  ```bash
  git add frontend/components/workspace/aigc/aigc-prompt-editor.tsx frontend/tests/aigc-prompt-editor.test.tsx frontend/scripts/verify-aigc-prompt-optimization.mjs docs/superpowers/plans/2026-09-20-aigc-fullscreen-prompt-editor.md
  git commit -m "feat: add AIGC fullscreen prompt editor"
  ```

  Expected: one focused feature commit. Do not stage unrelated pre-existing changes.

## Self-Review

- Spec coverage: inspector preview, icon and preview triggers, full responsive dialog, draft-only writes, keyboard and cancel semantics, no-op history behavior, upstream read-only behavior, accessibility labels, Vitest, ESLint, and two viewport Playwright checks each map to Tasks 1 through 4.
- Placeholder scan: no incomplete implementation or validation instructions remain.
- Type consistency: the dialog callback returns the boolean from `updateText`, preserving coordinate-tag validation without introducing a new store API.
