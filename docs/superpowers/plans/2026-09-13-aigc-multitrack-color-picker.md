# AIGC Multi-Track Color Picker Implementation Plan

**Goal:** Add an accessible visual RGBA color picker for text and subtitle
foreground/background colors with live preview and one undo entry per gesture.

**Architecture:** A reusable inspector field owns popover and draft state.
`react-colorful` supplies color controls and Radix supplies popover behavior.
The editor store separates transient gesture previews from atomic history
commits while preserving the existing canonical `#RRGGBBAA` configuration.

**Tech Stack:** React 19, TypeScript, Zustand, Radix Popover, react-colorful,
Vitest, Testing Library, Playwright.

---

### Task 1: Add color utilities and dependencies

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/lib/aigc/multitrack-colors.ts`
- Test: `frontend/tests/aigc-multitrack-colors.test.ts`

1. Write failing tests for strict `#RRGGBBAA` validation, uppercase
   normalization, and alpha percentage conversion.
2. Run the focused test and verify it fails.
3. Install `react-colorful` and `@radix-ui/react-popover`.
4. Implement the minimal color utilities.
5. Run the focused test and verify it passes.

### Task 2: Add atomic transient history support

**Files:**
- Modify: `frontend/lib/aigc/multitrack-editor-store.ts`
- Modify: `frontend/tests/aigc-multitrack-editor-store.test.ts`

1. Write failing reducer tests for gesture begin, repeated transient config
   replacement, gesture commit, and gesture cancel.
2. Verify that transient updates do not append history.
3. Add explicit color gesture actions carrying the initial configuration.
4. Commit one initial snapshot only when the final config differs.
5. Ensure cancel restores the initial configuration without history changes.
6. Run the focused store tests.

### Task 3: Build the visual color field

**Files:**
- Create:
  `frontend/components/workspace/aigc/aigc-multitrack-color-field.tsx`
- Test: `frontend/tests/aigc-multitrack-color-field.test.tsx`

1. Write failing tests for swatch rendering, popover dismissal, live picker
   updates, alpha synchronization, valid hex commit, and invalid draft.
2. Implement the Radix popover and `HexAlphaColorPicker`.
3. Preserve a local hex draft and commit on Enter or blur.
4. Expose gesture start, transient change, commit, and cancel callbacks.
5. Add accessible labels, invalid state, and compact dark styling.
6. Run the focused component tests.

### Task 4: Integrate text and subtitle controls

**Files:**
- Modify:
  `frontend/components/workspace/aigc/aigc-multitrack-inspector.tsx`
- Modify:
  `frontend/components/workspace/aigc/aigc-multitrack-editor.tsx`
- Modify: `frontend/tests/aigc-multitrack-editor.test.tsx`

1. Write failing editor tests for text and subtitle foreground/background
   selection and one-step undo.
2. Replace the two plain text fields in `TextInspector` with the visual field.
3. Route gesture previews through transient store actions and final changes
   through one atomic commit.
4. Keep canvas background on the existing compact input.
5. Run the focused editor tests.

### Task 5: Verify quality gates and responsive behavior

**Files:**
- Modify: `frontend/scripts/verify-aigc-multitrack.mjs`

1. Add Playwright checks for opening the picker, changing hue/alpha, preview
   synchronization, one-step undo, and viewport collision handling.
2. Run focused tests for color utilities, store, field, and editor.
3. Run `npm run typecheck`.
4. Run `npm run lint`.
5. Run `npm test`.
6. Run `npm run build`.
7. Run `npm run acceptance:aigc-multitrack` across desktop, tablet, and mobile.
8. Confirm no real MediaKit request is sent by the acceptance flow.
