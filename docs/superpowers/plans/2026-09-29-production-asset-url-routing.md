# Production Asset URL Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate server-internal FastAPI routing from browser same-origin API and asset routing so production never sends browser requests to `localhost:8000` or server rendering through the public Nginx endpoint.

**Architecture:** `createApiClient()` selects an internal base URL on the server and a public base URL in the browser. Asset display helpers always use the public base, which is empty by default and therefore preserves `/api/...` as a same-origin path. Explicit public and internal environment variables remain available for split-origin development and nonstandard deployments.

**Tech Stack:** Next.js 16, TypeScript, Vitest/jsdom, React Testing Library, Playwright, Nginx

---

## File Map

- Modify `frontend/lib/api-client.ts`: define public and runtime-aware backend base URL resolution.
- Modify `frontend/lib/asset-display.ts`: construct browser-facing media URLs from the public base.
- Modify `frontend/tests/api-client.test.ts`: cover browser, server default, server override, and public override routing.
- Modify `frontend/tests/asset-display.test.ts`: require same-origin relative media and download URLs.
- Modify `frontend/tests/home-generated-media-gallery.test.tsx`: require a relative gallery download URL.
- Modify `frontend/tests/layer-editor-dialog.test.tsx`: require a relative generated-result preview URL.
- Modify `frontend/tests/aigc-flow-node-v2.test.tsx`: require relative canvas asset proxy URLs.
- Modify `frontend/tests/aigc-download.test.ts`: require relative generated-asset download URLs.
- Modify `frontend/tests/image-canvas-editor.test.tsx`: require a relative image download URL.
- Modify `frontend/tests/aigc-acceptance.test.tsx`: require relative acceptance asset URLs.
- Modify `docs/deployment/application-server-first-deployment.md`: document the internal/public split and remove the requirement to inject a public URL for same-origin builds.

### Task 1: Split Server And Browser API Routing

**Files:**
- Modify: `frontend/tests/api-client.test.ts`
- Modify: `frontend/lib/api-client.ts`

- [ ] **Step 1: Add failing runtime-routing tests**

Extend the `getBackendBaseUrl` test group to preserve and restore both environment
variables and the jsdom `window`. Cover these exact outcomes:

```ts
it("uses a same-origin base in the browser when the public base is blank", () => {
  delete process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  expect(getBackendBaseUrl()).toBe("");
});

it("uses the explicit public base in the browser", () => {
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL = "https://app.example.com/";
  expect(getBackendBaseUrl()).toBe("https://app.example.com/");
});

it("uses the internal backend base on the server", () => {
  vi.stubGlobal("window", undefined);
  process.env.BACKEND_INTERNAL_BASE_URL = "http://127.0.0.1:8100";
  expect(getBackendBaseUrl()).toBe("http://127.0.0.1:8100");
});

it("defaults the server backend base to localhost", () => {
  vi.stubGlobal("window", undefined);
  delete process.env.BACKEND_INTERNAL_BASE_URL;
  expect(getBackendBaseUrl()).toBe("http://localhost:8000");
});
```

Use `afterEach` to restore original environment values and call
`vi.unstubAllGlobals()`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```bash
cd frontend
npx vitest run tests/api-client.test.ts
```

Expected: the browser same-origin and internal override cases fail against the
current single-variable implementation.

- [ ] **Step 3: Implement runtime-aware base URL resolution**

Add a server-only environment name and a public resolver:

```ts
const DEFAULT_BACKEND_BASE_URL = "http://localhost:8000";

export function getPublicBackendBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_BASE_URL?.trim() || "";
}

export function getBackendBaseUrl(): string {
  if (typeof window !== "undefined") {
    return getPublicBackendBaseUrl();
  }
  return (
    process.env.BACKEND_INTERNAL_BASE_URL?.trim() ||
    DEFAULT_BACKEND_BASE_URL
  );
}
```

Keep `createApiClient()` and `normalizeBaseUrl()` unchanged. An empty browser
base produces `/api/...` through the existing `buildUrl()` function.

- [ ] **Step 4: Run the focused test and confirm success**

Run:

```bash
cd frontend
npx vitest run tests/api-client.test.ts
```

Expected: all `api-client` tests pass.

### Task 2: Route Browser Media Through The Public Base

**Files:**
- Modify: `frontend/tests/asset-display.test.ts`
- Modify: `frontend/tests/home-generated-media-gallery.test.tsx`
- Modify: `frontend/tests/layer-editor-dialog.test.tsx`
- Modify: `frontend/tests/aigc-flow-node-v2.test.tsx`
- Modify: `frontend/tests/aigc-download.test.ts`
- Modify: `frontend/tests/image-canvas-editor.test.tsx`
- Modify: `frontend/tests/aigc-acceptance.test.tsx`
- Modify: `frontend/lib/asset-display.ts`

- [ ] **Step 1: Change helper expectations to same-origin paths**

Update asset helper assertions from `http://localhost:8000/api/assets/...` to:

```ts
expect(getAssetDownloadUrl(asset)).toBe(
  "/api/assets/asset%2Fwith%20space/content?download=1"
);
expect(getSafeAssetContentUrl("/api/assets/result-1/content")).toBe(
  "/api/assets/result-1/content"
);
expect(getAssetContentUrlById("asset/with space")).toBe(
  "/api/assets/asset%2Fwith%20space/content"
);
```

Add an explicit public-base test by temporarily setting
`NEXT_PUBLIC_BACKEND_BASE_URL=https://media.example.com/` and asserting the
result is `https://media.example.com/api/assets/result-1/content`.

Update the home gallery download assertion to:

```ts
"/api/assets/image-1/content?download=1&filename=%E6%99%A8%E5%85%89%E6%B5%B7%E6%8A%A5"
```

- [ ] **Step 2: Run focused media tests and confirm failure**

Run:

```bash
cd frontend
npx vitest run \
  tests/asset-display.test.ts \
  tests/home-media-gallery.test.ts \
  tests/home-generated-media-gallery.test.tsx
```

Expected: URL assertions fail because asset helpers still prepend the runtime
backend base.

- [ ] **Step 3: Implement public media URL construction**

Replace the `getBackendBaseUrl` import in `asset-display.ts` with
`getPublicBackendBaseUrl`. Add one local normalized helper:

```ts
function getPublicBackendBase(): string {
  return getPublicBackendBaseUrl().replace(/\/+$/, "");
}
```

Use it in `getAssetContentUrlById`, `getAssetDownloadUrlById`, and the relative
branch of `getSafeMediaUrl`:

```ts
return `${getPublicBackendBase()}/api/assets/${encodeURIComponent(normalizedId)}/content`;
```

```ts
return `${getPublicBackendBase()}${value}`;
```

Keep absolute HTTP/HTTPS URL validation unchanged.

- [ ] **Step 4: Run all frontend unit tests and migrate intentional assertions**

Run:

```bash
cd frontend
npm test
```

For failures that assert browser-generated `http://localhost:8000/api/assets/...`,
change only the expected URL to `/api/assets/...`. Do not change fixture URLs
that intentionally model an already absolute provider URL or explicit player
input.

Expected: all Vitest tests pass.

### Task 3: Update Deployment Contract And Verify

**Files:**
- Modify: `docs/deployment/application-server-first-deployment.md`

- [ ] **Step 1: Update production environment instructions**

Replace same-origin build commands that inject
`NEXT_PUBLIC_BACKEND_BASE_URL=https://ad.example.com` with plain
`npm run build`. Document:

```dotenv
# Optional; defaults to http://localhost:8000
BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8000

# Set only for split-origin browser deployments or local frontend :3000 -> backend :8000
# NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8000
```

Update troubleshooting so browser `localhost:8000` requests indicate an
incorrect `NEXT_PUBLIC_BACKEND_BASE_URL`, while server asset-list failures
require checking `BACKEND_INTERNAL_BASE_URL` and FastAPI health.

- [ ] **Step 2: Run static and production checks**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
cd ..
git diff --check
```

Expected: every command exits with status 0. The existing user-owned
`frontend/package-lock.json` change remains untouched.

- [ ] **Step 3: Run multi-viewport acceptance**

Build the isolated acceptance frontend:

```bash
cd frontend
NEXT_DIST_DIR=.next-home-acceptance \
NEXT_PUBLIC_BACKEND_BASE_URL=http://127.0.0.1:8003 \
  npm run build
```

Start the existing acceptance backend from the repository root:

```bash
PYTHONPATH=. \
ACCEPTANCE_BASE_URL=http://127.0.0.1:8003 \
  .venv/bin/python -m uvicorn backend.mock_acceptance_app:app \
  --host 127.0.0.1 --port 8003
```

Start the isolated frontend in a second terminal:

```bash
cd frontend
NEXT_DIST_DIR=.next-home-acceptance \
  npm run start -- -H 127.0.0.1 -p 3001
```

Then run:

```bash
cd frontend
FRONTEND_BASE_URL=http://127.0.0.1:3001 \
  npm run acceptance:home-gallery
```

Expected: desktop, tablet, and mobile checks pass; screenshots contain loaded
media; no page errors or horizontal overflow are reported.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git status --short
git diff -- frontend/lib/api-client.ts frontend/lib/asset-display.ts frontend/tests docs/deployment/application-server-first-deployment.md
```

Expected: changes are limited to URL routing, affected assertions, and
deployment documentation. Do not stage or overwrite the pre-existing
`frontend/package-lock.json` modification.
