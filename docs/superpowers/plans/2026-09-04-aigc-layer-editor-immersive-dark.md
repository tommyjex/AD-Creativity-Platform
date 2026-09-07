# AIGC Layer Editor Immersive Dark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the standalone AIGC layer editor a full-viewport black-gray workspace while preserving all existing editing and persistence behavior.

**Architecture:** `AppShell` detects only the canonical AIGC layer-editor route and removes its global navigation, atmosphere, and top offset. The layer editor owns a scoped dark token set so its header, toolbar, stage, sidebar, loading state, and error state remain visually consistent without changing global workspace pages.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright

---

### Task 1: Lock the route-shell behavior with tests

**Files:**
- Modify: `frontend/tests/workspace-navigation.test.tsx`
- Modify: `frontend/components/layout/app-shell.tsx`

- [ ] **Step 1: Write the failing route-shell tests**

Add tests that set `navigationState.pathname` to
`/workspace/aigc/pipelines/pipeline-1/nodes/node-1/layers`, render `AppShell`,
and assert that the branded header is absent, the shell has the immersive
near-black class, and the child container does not have `pt-16`. Keep an
assertion that a normal pipeline route still renders the global navigation.

- [ ] **Step 2: Run the route-shell test and verify it fails**

Run:

```bash
cd frontend && npm test -- workspace-navigation.test.tsx
```

Expected: the new immersive-route assertions fail against the current shell.

- [ ] **Step 3: Implement exact route detection**

Add an anchored route matcher for
`/workspace/aigc/pipelines/{pipelineId}/nodes/{nodeId}/layers`. Render a
minimal `min-h-[100dvh] bg-[#0b0d10]` shell for that path; retain the current
header, atmosphere, and `pt-16` wrapper for every other route.

- [ ] **Step 4: Re-run the route-shell test**

Run:

```bash
cd frontend && npm test -- workspace-navigation.test.tsx
```

Expected: all `workspace-navigation` tests pass.

### Task 2: Lock the editor visual hierarchy with tests

**Files:**
- Modify: `frontend/tests/aigc-layer-editor.test.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-layer-editor.tsx`

- [ ] **Step 1: Write the failing editor style contract**

Extend the responsive editor test to assert that the root is `h-[100dvh]`
with a near-black background, the stage is `bg-[#0d1014]` and contains no
`radial-gradient`, and the toolbar/sidebar use their specified black-gray
surface colors.

- [ ] **Step 2: Run the editor test and verify it fails**

Run:

```bash
cd frontend && npm test -- aigc-layer-editor.test.tsx
```

Expected: the new full-height and black-gray hierarchy assertions fail.

- [ ] **Step 3: Apply the scoped dark workbench theme**

Give the editor root `100dvh` height, near-black background, light foreground,
and scoped semantic color variables. Apply explicit topbar, toolbar, stage,
sidebar, item, input, selected, hover, disabled, canvas-shadow, and zoom-chip
styles. Preserve the current responsive classes and all event/data handlers.

- [ ] **Step 4: Re-run the editor test**

Run:

```bash
cd frontend && npm test -- aigc-layer-editor.test.tsx
```

Expected: all layer-editor interaction and style tests pass.

### Task 3: Align loading and error states

**Files:**
- Modify: `frontend/app/workspace/aigc/pipelines/[pipelineId]/nodes/[nodeId]/layers/loading.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-layer-editor.tsx`

- [ ] **Step 1: Make loading occupy the full dark viewport**

Change the loading root to `h-[100dvh] bg-[#0b0d10]`, use the same desktop
three-column breakpoint behavior as the editor, and replace generic light
surfaces with `#14171b`, `#0d1014`, `#171a1f`, and `#1d2127`.

- [ ] **Step 2: Make the error state occupy the full dark viewport**

Use the same scoped dark tokens and `100dvh` root in `LayerEditorError`; retain
the existing message and return action.

- [ ] **Step 3: Run focused regression tests**

Run:

```bash
cd frontend && npm test -- workspace-navigation.test.tsx aigc-layer-editor.test.tsx
```

Expected: all focused tests pass.

### Task 4: Verify the complete frontend

**Files:**
- Verify only

- [ ] **Step 1: Run TypeScript and ESLint**

Run:

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: both commands exit with status 0.

- [ ] **Step 2: Run the full Vitest suite**

Run:

```bash
cd frontend && npm test
```

Expected: the full suite passes.

- [ ] **Step 3: Run the production build**

Run:

```bash
cd frontend && npm run build
```

Expected: Next.js production build exits with status 0.

- [ ] **Step 4: Verify desktop and mobile in Playwright**

Start the frontend on a free local port, open a valid layer-editor fixture at
desktop and mobile sizes, and check full-viewport occupation, dark backgrounds,
reachable controls, non-overlapping header actions, preserved image aspect
ratio, and no new browser console errors.
