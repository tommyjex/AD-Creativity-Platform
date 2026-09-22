# AIGC Toolbar Star Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved four-color star-map decoration across the AIGC canvas toolbar without affecting layout or interaction.

**Architecture:** Keep the local presentational `ToolbarStarMap` component inside `aigc-editor.tsx`, but render 12 percentage-positioned dots using the existing modality color variables in a repeating text/image/video/audio sequence and 11 low-contrast connector lines. The layer spans the toolbar background, remains absolute, non-interactive, accessibility-hidden, and visible only at `xl` widths.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright

---

### Task 1: Add component coverage

**Files:**
- Test: `frontend/tests/aigc-editor.test.tsx`

- [x] Add assertions that the toolbar renders an `aria-hidden` star-map layer with `pointer-events-none`, `hidden`, and `xl:block`.
- [x] Assert 12 points expose the ordered `text|image|video|audio` color cycle and use the corresponding `var(--aigc-modality-*)` background color.
- [x] Assert 11 connector lines are present and decorative only.
- [x] Run `npm test -- --run tests/aigc-editor.test.tsx` and confirm the new assertions fail before implementation.

### Task 2: Implement the decorative layer

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`

- [x] Add `relative` positioning to the existing toolbar header and `relative z-10` to the title and action groups.
- [x] Render `<ToolbarStarMap />` between the hidden autosave live region and the action group.
- [x] Replace the centered fixed-width container with an `inset-x` full-width background layer.
- [x] Render 12 dots at stable percentage positions with alternating vertical coordinates and four-color cycling.
- [x] Render 11 connector lines aligned between adjacent points.
- [x] Keep all dots at `5px`, connector lines at `1px`, and the complete decoration behind toolbar content.
- [x] Run the targeted editor test and confirm it passes.

### Task 3: Extend browser acceptance

**Files:**
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [x] At `1440px`, assert the star map is visible, spans the toolbar, has 12 color-cycled points and 11 lines, and is `aria-hidden`.
- [x] At `1024px`, `768px`, and `390px`, assert the star map is hidden.
- [x] Retain existing overflow, toolbar height, command target, and console-error assertions.
- [x] Run `npm run typecheck`, targeted ESLint, and `npm run acceptance:aigc-workbench` with a generated fixture.
- [x] Confirm screenshots pass at `1440x900`, `1024x768`, `768x1024`, and `390x844`.
