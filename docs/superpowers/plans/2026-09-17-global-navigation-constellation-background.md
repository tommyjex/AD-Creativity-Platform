# Global Navigation Constellation Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the runtime-generated navigation image with the approved Seedream generative-constellation artwork while preserving the existing 64px layout, readability fallback, responsive navigation, and fullscreen-editor exception.

**Architecture:** Preprocess the approved Seedream source into a local, center-cropped WebP asset under `frontend/public/images`. `AppShell` references that stable asset through CSS and retains a solid dark header plus layered gradients as its load-failure and contrast protection. Component tests lock the local asset contract, while the existing Playwright acceptance script verifies local loading, absence of runtime image-generation requests, responsive layout, and fallback behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright, macOS `sips`, WebP `cwebp`.

---

### Task 1: Create the approved local navigation asset

**Files:**
- Source: `.superpowers/brainstorm/55000-1789623248/generated/constellation/ark-gen.jpeg`
- Create: `frontend/public/images/navigation-generative-constellation.webp`

- [ ] **Step 1: Confirm the approved source dimensions**

Run:

```bash
sips -g pixelWidth -g pixelHeight \
  .superpowers/brainstorm/55000-1789623248/generated/constellation/ark-gen.jpeg
```

Expected: `pixelWidth: 2048` and `pixelHeight: 2048`.

- [ ] **Step 2: Crop the center band and encode WebP**

Run:

```bash
mkdir -p frontend/public/images
sips --cropToHeightWidth 256 2048 \
  .superpowers/brainstorm/55000-1789623248/generated/constellation/ark-gen.jpeg \
  --out /tmp/navigation-generative-constellation.png
cwebp -quiet -q 82 \
  /tmp/navigation-generative-constellation.png \
  -o frontend/public/images/navigation-generative-constellation.webp
```

Expected: a `2048px × 256px` WebP containing the central node network and no bottom-right generation mark.

- [ ] **Step 3: Verify asset metadata**

Run:

```bash
sips -g pixelWidth -g pixelHeight -g format \
  frontend/public/images/navigation-generative-constellation.webp
```

Expected: width `2048`, height `256`, format `webp`.

### Task 2: Lock the local background contract with a failing component test

**Files:**
- Modify: `frontend/tests/workspace-navigation.test.tsx`

- [ ] **Step 1: Replace the remote URL assertion**

Use this assertion in `renders the decorative dark navigation background`:

```tsx
expect(background.style.backgroundImage).toContain(
  "/images/navigation-generative-constellation.webp"
);
expect(background.style.backgroundImage).not.toContain(
  "copilot-cn.bytedance.net"
);
expect(background).toHaveClass("bg-cover", "bg-center");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd frontend
npm test -- tests/workspace-navigation.test.tsx
```

Expected: FAIL because `AppShell` still references the runtime `text_to_image` URL.

### Task 3: Apply the approved asset and contrast treatment

**Files:**
- Modify: `frontend/components/layout/app-shell.tsx`

- [ ] **Step 1: Replace the runtime URL constant**

Use a stable local path:

```tsx
const navigationBackgroundUrl =
  "/images/navigation-generative-constellation.webp";
```

- [ ] **Step 2: Keep the image layer centered and strengthen vertical protection**

Keep the image layer:

```tsx
<div
  aria-hidden="true"
  className="pointer-events-none absolute inset-0 bg-cover bg-center"
  data-testid="app-shell-navigation-background"
  style={{ backgroundImage: `url("${navigationBackgroundUrl}")` }}
/>
```

Use two overlay gradients:

```tsx
className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,11,0.12)_0%,rgba(3,7,11,0.34)_100%),linear-gradient(90deg,rgba(11,15,20,0.96)_0%,rgba(13,18,24,0.64)_52%,rgba(10,14,19,0.90)_100%)]"
```

- [ ] **Step 3: Run the focused component test**

Run:

```bash
cd frontend
npm test -- tests/workspace-navigation.test.tsx
```

Expected: all workspace navigation tests pass.

### Task 4: Update browser acceptance for local loading and fallback

**Files:**
- Modify: `frontend/scripts/verify-global-navigation-background.mjs`

- [ ] **Step 1: Track navigation asset and generation API requests**

Add request tracking before navigation:

```js
const navigationAssetRequests = [];
const generationRequests = [];
page.on("request", (request) => {
  if (request.url().includes("navigation-generative-constellation.webp")) {
    navigationAssetRequests.push(request.url());
  }
  if (request.url().includes("/api/ide/v1/text_to_image")) {
    generationRequests.push(request.url());
  }
});
```

After reading computed styles, assert:

```js
assert.match(
  backgroundImage,
  /navigation-generative-constellation\.webp/
);
assert.equal(navigationAssetRequests.length, 1);
assert.equal(generationRequests.length, 0);
```

- [ ] **Step 2: Make fallback verification abort the local asset**

Use:

```js
await context.route(
  "**/images/navigation-generative-constellation.webp",
  (route) => route.abort()
);
```

Keep the existing assertion that the header background is `rgb(20, 25, 31)` and the mobile menu remains usable.

- [ ] **Step 3: Run static verification**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
```

Expected: both commands exit `0`.

### Task 5: Run multi-viewport visual acceptance

**Files:**
- Verify: `frontend/test-results/global-navigation-background/desktop-wide.png`
- Verify: `frontend/test-results/global-navigation-background/desktop.png`
- Verify: `frontend/test-results/global-navigation-background/tablet.png`
- Verify: `frontend/test-results/global-navigation-background/mobile.png`
- Verify: `frontend/test-results/global-navigation-background/mobile-image-fallback.png`

- [ ] **Step 1: Confirm the frontend is available**

Run:

```bash
curl -fsS http://127.0.0.1:3000/workspace/aigc?view=pipelines >/dev/null
```

Expected: exit `0`. If unavailable, start `npm run dev` from `frontend`.

- [ ] **Step 2: Run the navigation acceptance script**

Run:

```bash
cd frontend
npm run acceptance:navigation-background
```

Expected: JSON output with `"result": "PASS"` for 1920px desktop, 1440px desktop, 820px tablet, and 390px mobile.

- [ ] **Step 3: Inspect generated screenshots**

Confirm:

- the star network remains visible around the center without becoming a bright stripe;
- brand and navigation text stay readable;
- no element overlaps or leaves the viewport;
- mobile fallback remains dark and usable;
- all images preserve their intended proportions with no stretching.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --check
git diff -- \
  frontend/components/layout/app-shell.tsx \
  frontend/tests/workspace-navigation.test.tsx \
  frontend/scripts/verify-global-navigation-background.mjs
git status --short frontend/public/images/navigation-generative-constellation.webp
```

Expected: no whitespace errors and only the intended navigation changes plus the new asset.
