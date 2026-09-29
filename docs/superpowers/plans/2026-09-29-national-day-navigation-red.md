# National Day Navigation Red Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global navigation star-map background with a locally stored, high-saturation National Day red composition and align navigation-only accents to warm gold.

**Architecture:** Keep `AppShell` structure and routing untouched. Generate one source image through Ark, crop it to a stable `2048x256` WebP asset, then update only navigation-local Tailwind classes and existing unit/Playwright assertions.

**Tech Stack:** Next.js, React, Tailwind CSS, Vitest, Playwright, ArkCLI/Seedream, FFmpeg, cwebp

---

## File Structure

- Create `frontend/public/images/navigation-national-day-red.webp`: production navigation background.
- Modify `frontend/components/layout/app-shell.tsx`: asset reference, fallback red, overlays, and navigation-local gold accents.
- Modify `frontend/tests/workspace-navigation.test.tsx`: component contract for the new asset and local theme classes.
- Modify `frontend/scripts/verify-global-navigation-background.mjs`: asset loading, fallback color, accent, and screenshot assertions.

### Task 1: Lock The New Navigation Contract With Tests

**Files:**
- Modify: `frontend/tests/workspace-navigation.test.tsx`
- Modify: `frontend/scripts/verify-global-navigation-background.mjs`

- [ ] **Step 1: Update the component background assertion**

Replace the old asset and fallback expectations with:

```tsx
expect(background.style.backgroundImage).toContain(
  "/images/navigation-national-day-red.webp"
);
expect(screen.getByRole("banner")).toHaveClass("bg-[#b61519]");
expect(screen.getByTestId("app-shell-brand-mark")).toHaveClass(
  "border-[#ffc348]/60",
  "bg-[#8c0000]/35"
);
```

- [ ] **Step 2: Add local gold current-state assertions**

Assert that the current desktop navigation link contains:

```tsx
"bg-[linear-gradient(180deg,#ffe0a3_0%,#f0b433_100%)]",
"text-[#6f110b]"
```

Keep existing route, mobile-menu, and immersive-shell assertions unchanged.

- [ ] **Step 3: Update browser asset and fallback checks**

Change the intercepted asset to `navigation-national-day-red.webp`, require a single local
asset request, assert fallback `rgb(182, 21, 25)`, and check the current navigation item has
a CSS gradient background and dark-red text.

- [ ] **Step 4: Run the focused component test and confirm failure**

Run:

```bash
cd frontend
npm test -- workspace-navigation.test.tsx
```

Expected: FAIL because `AppShell` still references the constellation asset and old classes.

### Task 2: Generate And Prepare The Navigation Asset

**Files:**
- Create: `frontend/public/images/navigation-national-day-red.webp`

- [ ] **Step 1: Verify ArkCLI authentication and list image resources**

Run:

```bash
arkcli auth status
arkcli resources list --modality image
```

Select the default image model ID as `MODEL`. If it is a model name rather than `ep-*`, inspect
supported parameters:

```bash
arkcli models get "$MODEL" --transform supported_params
```

- [ ] **Step 2: Generate the approved composition**

Run `arkcli +gen --model "$MODEL" --open --save-to /tmp/ad-creativity-national-day` with this
prompt:

```text
Ultra-wide website navigation background for a premium Chinese creative-production platform during National Day. Bright saturated Chinese flag red and vermilion palette, a broad flowing red silk ribbon sweeping horizontally through the center, realistic fine fabric folds, sparse warm-gold five-point star light motifs and a soft orange-gold sunrise glow concentrated near the middle. Keep the far left and far right low-detail and darker for white interface text. Refined ceremonial atmosphere, confident and festive, not wine red, not purple, no blue, no people, no buildings, no fireworks, no text, no logo, no watermark.
```

Use only parameters reported as supported. Prefer a `2048x2048` or larger output because the final
asset is cropped from the center.

- [ ] **Step 3: Crop and encode a deterministic WebP**

Run:

```bash
ffmpeg -y -i "$SOURCE_IMAGE" \
  -vf "scale=2048:-2,crop=2048:256:(iw-2048)/2:(ih-256)/2" \
  -frames:v 1 /tmp/navigation-national-day-red.png
cwebp -quiet -q 88 -m 6 \
  /tmp/navigation-national-day-red.png \
  -o frontend/public/images/navigation-national-day-red.webp
```

- [ ] **Step 4: Verify image dimensions and visual content**

Run:

```bash
sips -g pixelWidth -g pixelHeight \
  frontend/public/images/navigation-national-day-red.webp
```

Expected: width `2048`, height `256`. Inspect the image and confirm that both edges remain
low-detail, the center contains red silk and sparse warm-gold light, and no text or watermark exists.

### Task 3: Apply The Navigation-Local Theme

**Files:**
- Modify: `frontend/components/layout/app-shell.tsx`
- Test: `frontend/tests/workspace-navigation.test.tsx`

- [ ] **Step 1: Switch the background and fallback**

Use:

```tsx
const navigationBackgroundUrl = "/images/navigation-national-day-red.webp";
```

Set the header fallback to `bg-[#b61519]`, retaining fixed positioning, `h-16`, border, and
text semantics.

- [ ] **Step 2: Apply the red contrast overlays**

Use a vertical red-darkening layer plus a horizontal gradient with dark-red edges and a lighter
center. Keep the background layer `bg-cover bg-center`, decorative, and non-interactive.

- [ ] **Step 3: Apply warm-gold navigation accents**

Add `data-testid="app-shell-brand-mark"` to `BrandMark`. Use local classes:

```tsx
border-[#ffc348]/60 bg-[#8c0000]/35
bg-[linear-gradient(180deg,#ffe0a3_0%,#f0b433_100%)] text-[#6f110b]
```

Apply matching deep-red translucent surfaces and warm-gold borders to desktop navigation, the
mobile menu button, and the mobile menu. Do not change global CSS variables.

- [ ] **Step 4: Run the focused component test**

Run:

```bash
cd frontend
npm test -- workspace-navigation.test.tsx
```

Expected: PASS.

### Task 4: Verify Quality And Responsive Rendering

**Files:**
- Modify: `frontend/scripts/verify-global-navigation-background.mjs`

- [ ] **Step 1: Run static checks**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
npm test
```

Expected: all commands exit zero.

- [ ] **Step 2: Run the dedicated Playwright acceptance**

With frontend `http://127.0.0.1:3000` and backend `http://127.0.0.1:8000` running:

```bash
cd frontend
npm run acceptance:navigation-background
```

Expected: PASS at `1920x1080`, `1440x900`, `820x1180`, and `390x844`, including the blocked-image fallback.

- [ ] **Step 3: Inspect screenshots**

Inspect:

```text
frontend/test-results/global-navigation-background/desktop-wide.png
frontend/test-results/global-navigation-background/desktop.png
frontend/test-results/global-navigation-background/tablet.png
frontend/test-results/global-navigation-background/mobile.png
frontend/test-results/global-navigation-background/mobile-image-fallback.png
```

Confirm no overlap or clipping, the red remains saturated rather than wine-colored, and gold accents
stay readable without dominating the content.

- [ ] **Step 4: Check the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: only the navigation implementation, tests, asset, plan, and the user's pre-existing staged
`frontend/package-lock.json` change are present.

### Task 5: Commit The Implementation

**Files:**
- Create: `frontend/public/images/navigation-national-day-red.webp`
- Modify: `frontend/components/layout/app-shell.tsx`
- Modify: `frontend/tests/workspace-navigation.test.tsx`
- Modify: `frontend/scripts/verify-global-navigation-background.mjs`
- Create: `docs/superpowers/plans/2026-09-29-national-day-navigation-red.md`

- [ ] **Step 1: Commit only scoped files**

Run:

```bash
git add \
  frontend/public/images/navigation-national-day-red.webp \
  frontend/components/layout/app-shell.tsx \
  frontend/tests/workspace-navigation.test.tsx \
  frontend/scripts/verify-global-navigation-background.mjs \
  docs/superpowers/plans/2026-09-29-national-day-navigation-red.md
git commit -m "feat(frontend): add National Day navigation theme" -- \
  frontend/public/images/navigation-national-day-red.webp \
  frontend/components/layout/app-shell.tsx \
  frontend/tests/workspace-navigation.test.tsx \
  frontend/scripts/verify-global-navigation-background.mjs \
  docs/superpowers/plans/2026-09-29-national-day-navigation-red.md
```

Expected: the existing staged `frontend/package-lock.json` remains outside the commit.
