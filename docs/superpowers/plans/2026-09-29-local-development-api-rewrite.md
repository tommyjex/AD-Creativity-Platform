# Local Development API Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make same-origin `/api/...` browser requests work in local Next.js development by proxying them to the FastAPI backend.

**Architecture:** Add a Next.js rewrite from `/api/:path*` to the server-only `BACKEND_INTERNAL_BASE_URL`, defaulting to `http://127.0.0.1:8000`. Keep browser-facing URLs relative so local development and production use the same frontend contract, while Nginx remains the primary production proxy.

**Tech Stack:** Next.js 16 configuration, JavaScript, Vitest, Playwright, FastAPI

---

### Task 1: Specify Rewrite Behavior

**Files:**
- Create: `frontend/tests/next-config.test.mjs`
- Read: `frontend/next.config.mjs`

- [ ] **Step 1: Add a failing default-target test**

```js
import { afterEach, describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

const originalInternalBaseUrl = process.env.BACKEND_INTERNAL_BASE_URL;

afterEach(() => {
  if (originalInternalBaseUrl === undefined) {
    delete process.env.BACKEND_INTERNAL_BASE_URL;
  } else {
    process.env.BACKEND_INTERNAL_BASE_URL = originalInternalBaseUrl;
  }
});

describe("Next.js API rewrites", () => {
  it("proxies local same-origin API requests to FastAPI by default", async () => {
    delete process.env.BACKEND_INTERNAL_BASE_URL;

    await expect(nextConfig.rewrites()).resolves.toEqual([
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*"
      }
    ]);
  });
});
```

- [ ] **Step 2: Add an internal-base override test**

```js
it("uses the internal backend override without a trailing slash", async () => {
  process.env.BACKEND_INTERNAL_BASE_URL = " http://backend.internal:8100/ ";

  await expect(nextConfig.rewrites()).resolves.toEqual([
    {
      source: "/api/:path*",
      destination: "http://backend.internal:8100/api/:path*"
    }
  ]);
});
```

- [ ] **Step 3: Run the focused test and verify failure**

Run:

```bash
cd frontend
npx vitest run tests/next-config.test.mjs
```

Expected: FAIL because `nextConfig.rewrites` is not defined.

### Task 2: Implement The Next.js Rewrite

**Files:**
- Modify: `frontend/next.config.mjs`
- Test: `frontend/tests/next-config.test.mjs`

- [ ] **Step 1: Add the internal backend default**

```js
const DEFAULT_INTERNAL_BACKEND_BASE_URL = "http://127.0.0.1:8000";

function getInternalBackendBaseUrl() {
  return (
    process.env.BACKEND_INTERNAL_BASE_URL?.trim() ||
    DEFAULT_INTERNAL_BACKEND_BASE_URL
  ).replace(/\/+$/, "");
}
```

- [ ] **Step 2: Add the rewrite**

```js
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${getInternalBackendBaseUrl()}/api/:path*`
      }
    ];
  },
  typedRoutes: true
};
```

- [ ] **Step 3: Run the focused test and verify success**

Run:

```bash
cd frontend
npx vitest run tests/next-config.test.mjs
```

Expected: both rewrite tests pass.

### Task 3: Update Local Development Documentation

**Files:**
- Modify: `README.md:176-190`

- [ ] **Step 1: Replace the obsolete local routing statement**

Document that local browser requests use same-origin `/api/...` and Next.js
rewrites them to `http://127.0.0.1:8000`.

- [ ] **Step 2: Document a non-default backend**

Use this example:

```dotenv
BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8100
```

State that `NEXT_PUBLIC_BACKEND_BASE_URL` is only needed for a true split-origin
browser deployment with matching CORS configuration.

### Task 4: Verify Runtime Behavior

**Files:**
- Verify: `frontend/next.config.mjs`
- Verify: local Next.js server on port 3000
- Verify: local FastAPI server on port 8000

- [ ] **Step 1: Allow Next.js to reload its configuration**

Wait for the running development server to restart after `next.config.mjs`
changes. If it does not restart automatically, stop only that Next.js process
and launch:

```bash
cd frontend
npm run dev -- --hostname 0.0.0.0 --port 3000
```

- [ ] **Step 2: Compare direct and rewritten asset responses**

For a succeeded image asset ID, run:

```bash
curl -H 'Range: bytes=0-31' \
  http://127.0.0.1:8000/api/assets/{assetId}/content
curl -H 'Range: bytes=0-31' \
  http://127.0.0.1:3000/api/assets/{assetId}/content
```

Expected: both return `206` with an image content type and 32 response bytes.

- [ ] **Step 3: Verify in Chromium**

Open the local assets page and an AIGC pipeline containing an image asset.
Assert that image requests return 2xx, rendered images have nonzero
`naturalWidth`, and the browser reports no `/api/assets/...` 404 errors.

### Task 5: Run Quality Checks And Commit

**Files:**
- Verify all task files above
- Exclude: `frontend/package-lock.json`

- [ ] **Step 1: Run automated checks**

```bash
cd frontend
npm test
npm run typecheck
npm run lint -- --ignore-pattern .next-home-acceptance
npm run build
cd ..
git diff --check
```

Expected: all source checks pass. Existing React `act(...)` warnings may remain,
but no test may fail.

- [ ] **Step 2: Run multi-viewport Playwright acceptance**

Verify desktop, tablet, and mobile viewports against the running local app.
Expected: no image 404s, broken images, incoherent overlap, or horizontal
overflow.

- [ ] **Step 3: Commit only task files**

```bash
git add \
  frontend/next.config.mjs \
  frontend/tests/next-config.test.mjs \
  README.md \
  docs/superpowers/plans/2026-09-29-local-development-api-rewrite.md
git commit --only \
  frontend/next.config.mjs \
  frontend/tests/next-config.test.mjs \
  README.md \
  docs/superpowers/plans/2026-09-29-local-development-api-rewrite.md \
  -m "fix(frontend): proxy local API requests"
```

Do not include the existing staged `frontend/package-lock.json` change.
