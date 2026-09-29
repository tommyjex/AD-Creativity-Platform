# HTTP-Compatible Client ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent AIGC editor actions from failing before their API request when the application is served from an HTTP origin where `crypto.randomUUID` is unavailable.

**Architecture:** Add one dependency-free `createClientId()` utility under `frontend/lib`. It prefers the platform UUID implementation, falls back to an RFC 4122 version 4 UUID generated with `crypto.getRandomValues`, and uses a non-cryptographic collision-resistant fallback only when Web Crypto is unavailable. Replace every direct `crypto.randomUUID()` call in the AIGC frontend with this utility.

**Tech Stack:** TypeScript, React/Next.js, Vitest, jsdom

---

### Task 1: Specify Client ID Behavior

**Files:**
- Create: `frontend/tests/client-id.test.ts`

- [ ] **Step 1: Write tests for the native implementation**

Mock `globalThis.crypto.randomUUID`, call `createClientId()`, and assert that the native value is returned unchanged.

- [ ] **Step 2: Write tests for the Web Crypto fallback**

Supply a crypto-like object without `randomUUID`, mock `getRandomValues` with deterministic bytes, and assert UUID v4 syntax plus the version and variant bits.

- [ ] **Step 3: Write tests for the final fallback**

Supply no crypto implementation, call the helper twice, and assert both values match UUID v4 syntax and differ.

- [ ] **Step 4: Run the focused test and verify it fails**

Run: `npm test -- --run tests/client-id.test.ts`

Expected: FAIL because `@/lib/client-id` does not exist.

### Task 2: Implement the Client ID Utility

**Files:**
- Create: `frontend/lib/client-id.ts`
- Test: `frontend/tests/client-id.test.ts`

- [ ] **Step 1: Implement native UUID preference**

Read `globalThis.crypto` defensively and call `randomUUID` only when it is a function.

- [ ] **Step 2: Implement the random-byte UUID v4 fallback**

Fill 16 bytes with `getRandomValues`, set byte 6 to version 4 and byte 8 to the RFC 4122 variant, then format the bytes as `8-4-4-4-12` hexadecimal groups.

- [ ] **Step 3: Implement the no-Web-Crypto fallback**

Mix timestamp, monotonic counter, and `Math.random()` into 16 bytes, apply the same UUID v4 bits, and format through the shared byte formatter.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- --run tests/client-id.test.ts`

Expected: all client ID tests pass.

### Task 3: Migrate AIGC Call Sites

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/lib/aigc/editor-store.ts`
- Modify: `frontend/lib/aigc/queries.ts`
- Modify: `frontend/lib/aigc/timeline-actions.ts`

- [ ] **Step 1: Import `createClientId` in each consumer**

Use the existing `@/lib/client-id` alias.

- [ ] **Step 2: Replace all five direct UUID calls**

Use `createClientId()` for edge IDs, node IDs, run idempotency keys, retry idempotency keys, and timeline execution defaults.

- [ ] **Step 3: Confirm no direct calls remain**

Run: `rg -n "crypto\\.randomUUID|randomUUID\\(" frontend --glob '!package-lock.json'`

Expected: only the compatibility utility and its tests reference `randomUUID`.

- [ ] **Step 4: Run affected tests**

Run: `npm test -- --run tests/client-id.test.ts tests/aigc-editor-store-v2.test.ts tests/aigc-queries.test.ts tests/aigc-timeline-route.test.ts tests/aigc-editor.test.tsx`

Expected: all affected tests pass.

### Task 4: Verify and Commit

**Files:**
- Verify all task files above
- Exclude: `frontend/package-lock.json`

- [ ] **Step 1: Run the full frontend test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run static and production checks**

Run: `npm run typecheck`, `npm run lint`, and `npm run build`.

Expected: every command exits successfully.

- [ ] **Step 3: Check patch integrity**

Run: `git diff --check` and inspect `git diff --` for task files.

Expected: no whitespace errors or unrelated changes.

- [ ] **Step 4: Commit only task files**

Stage the plan, helper, test, and four migrated consumers explicitly. Do not stage or commit `frontend/package-lock.json`.

Commit message: `fix(frontend): support client ids on insecure origins`
