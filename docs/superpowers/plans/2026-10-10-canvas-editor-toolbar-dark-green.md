# Canvas Editor Toolbar Dark Green Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the AIGC canvas editor toolbar’s red holiday background with the same dark green surface used by the workspace list navigation.

**Architecture:** Keep the existing `AigcEditor` toolbar structure, controls, star map, responsive layout, and behavior intact. Change only the toolbar and decorative overlay classes, and lock the visual contract in the existing editor test.

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Replace the Toolbar Background Contract

**Files:**
- Modify: `frontend/tests/aigc-editor.test.tsx:3076-3102`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx:1185-1194`

- [ ] **Step 1: Write the failing dark-toolbar test**

Replace the red theme assertions in
`uses the professional workbench shell with an on-demand inspector`:

```tsx
expect(screen.getByTestId("aigc-editor-header")).toHaveClass(
  "bg-[#080c0b]/95",
  "border-white/10",
  "backdrop-blur-xl",
  "h-14",
  "overflow-hidden",
  "pr-[4.5rem]",
  "sm:pr-44",
  "shadow-[0_8px_28px_rgba(0,0,0,0.28)]"
);
expect(screen.getByTestId("aigc-editor-header")).not.toHaveClass(
  "bg-[#b61519]",
  "bg-[url('/images/navigation-national-day-red.webp')]"
);
expect(
  screen.getByTestId("aigc-toolbar-background-overlay")
).toHaveClass(
  "pointer-events-none",
  "absolute",
  "inset-0",
  "z-0",
  "bg-[linear-gradient(180deg,rgba(52,211,153,0.025)_0%,rgba(8,12,11,0.18)_100%)]"
);
```

Keep the existing `aria-hidden` assertion for the overlay.

- [ ] **Step 2: Verify the test fails for the red toolbar**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx -t "uses the professional workbench shell"
```

Expected: FAIL because the header still uses the holiday image, red background,
red border, and red overlay.

- [ ] **Step 3: Implement the dark green toolbar surface**

Replace only the header and overlay classes:

```tsx
<header
  className="relative flex h-14 shrink-0 flex-row items-center gap-1 overflow-hidden border-b border-white/10 bg-[#080c0b]/95 pl-2 pr-[4.5rem] shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:pl-3 sm:pr-44"
  data-testid="aigc-editor-header"
>
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(52,211,153,0.025)_0%,rgba(8,12,11,0.18)_100%)]"
    data-testid="aigc-toolbar-background-overlay"
  />
```

Do not modify any descendants, including `ToolbarStarMap`, account controls,
the execute button, save-template button, title, or responsive padding.

- [ ] **Step 4: Run focused editor tests**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx -t "professional workbench shell|contracts the toolbar"
```

Expected: PASS for the toolbar visual contract and narrow-screen command
retention.

- [ ] **Step 5: Run static validation**

Run:

```bash
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 6: Verify in the browser**

Open an authenticated pipeline route at desktop width and confirm:

- The toolbar is dark green-black and no red image remains.
- The red administrator control and blue/purple execute control are unchanged.
- The title, return button, panel button, save-template button, star map, and
  execute button remain aligned and usable.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/workspace/aigc/aigc-editor.tsx frontend/tests/aigc-editor.test.tsx
git commit -m "style(aigc): align canvas toolbar with workspace navigation"
```
