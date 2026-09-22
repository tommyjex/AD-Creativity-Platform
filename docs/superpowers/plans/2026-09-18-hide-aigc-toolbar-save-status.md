# Hide AIGC Toolbar Save Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the visible autosave status from the AIGC canvas toolbar while preserving autosave behavior and accessible status announcements.

**Architecture:** Keep the existing autosave state machine unchanged. Replace the visible toolbar status block with an `sr-only` live region, remove presentation-only helpers, and update tests and browser assertions to verify absence from the visual layout.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, Playwright

---

### Task 1: Remove visible save status

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [x] Replace the visible status container with an `sr-only` `aria-live` region.
- [x] Remove presentation-only status icon and tone helpers.
- [x] Update component tests to assert accessibility without visible toolbar content.
- [x] Run `npm test -- --run tests/aigc-editor.test.tsx`.

### Task 2: Update browser acceptance

**Files:**
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [x] Remove autosave from toolbar geometry assertions.
- [x] Assert the live region is visually hidden and contains no icon.
- [x] Run typecheck, lint, and the workbench Playwright acceptance script.
