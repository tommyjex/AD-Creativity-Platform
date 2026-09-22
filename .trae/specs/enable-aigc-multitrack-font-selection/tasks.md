# AIGC Multi-Track Font Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MediaKit preset and custom HTTPS TTF/OTF font selection to text and subtitle elements in the AIGC multi-track editor.

**Architecture:** Store the optional Provider value in the existing shared text style as `font_type`. Keep preset metadata and frontend validation in a focused pure module, isolate browser `FontFace` loading in a client-only helper, and map the internal style value to MediaKit's element-level `font_type` only at the Gateway boundary.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, Playwright, Python 3.14, Pydantic v2, pytest, MediaKit multi-track API.

---

## File Map

- Create `frontend/lib/aigc/multitrack-fonts.ts`: official preset catalog and pure font value classification/validation.
- Create `frontend/lib/aigc/multitrack-font-preview.ts`: cached browser `FontFace` loading and React preview state.
- Modify `frontend/lib/aigc/types.ts`: add nullable `font_type` to `MultiTrackTextStyle`.
- Modify `frontend/lib/aigc/multitrack.ts`: normalize and validate font values.
- Modify `frontend/components/workspace/aigc/aigc-multitrack-inspector.tsx`: add preset/custom controls and preview status.
- Modify `frontend/components/workspace/aigc/aigc-multitrack-preview.tsx`: apply loaded custom fonts to visible text.
- Modify `frontend/components/workspace/aigc/aigc-multitrack-editor.tsx`: include the nullable default in newly created text/subtitle elements.
- Modify `frontend/lib/aigc/definition-migration.ts`: preserve compatibility for missing style fields.
- Modify `backend/app/schemas/aigc.py`: add the field and server-side validation.
- Modify `backend/app/services/assets.py`: preserve the field in sanitized persisted definitions.
- Modify `backend/app/services/aigc_gateway.py`: emit MediaKit element-level `font_type`.
- Modify focused frontend/backend tests and `frontend/scripts/verify-aigc-multitrack.mjs`.

### Task 1: Add Shared Font Contracts and Validation

**Files:**
- Create: `frontend/lib/aigc/multitrack-fonts.ts`
- Modify: `frontend/lib/aigc/types.ts`
- Modify: `frontend/lib/aigc/multitrack.ts`
- Modify: `frontend/lib/aigc/definition-migration.ts`
- Modify: `backend/app/schemas/aigc.py`
- Modify: `backend/app/services/assets.py`
- Test: `frontend/tests/aigc-multitrack.test.ts`
- Test: `backend/tests/test_aigc_schemas.py`
- Test: `backend/tests/test_aigc_routes.py`

- [x] **Step 1: Write failing frontend contract tests**

Add cases asserting that preset IDs, the approved `.ttf` URL, `.otf` URLs with query parameters, and `null` pass validation, while HTTP, relative, credential-bearing, wrong-extension, unknown-ID, and over-2048-character values emit `invalid_font_type`.

```typescript
expect(fontTypeIssue("SY_Black")).toBeNull();
expect(
  fontTypeIssue(
    "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf"
  )
).toBeNull();
expect(fontTypeIssue("http://example.com/font.ttf")).toBe(
  "invalid_font_type"
);
```

- [x] **Step 2: Run the frontend contract test and verify failure**

Run:

```bash
cd frontend
npx vitest run tests/aigc-multitrack.test.ts
```

Expected: FAIL because `font_type` and `fontTypeIssue` do not exist.

- [x] **Step 3: Implement the frontend catalog and validator**

Define the official presets and pure helpers:

```typescript
export const MEDIAKIT_FONT_PRESETS = [
  { id: "1187225", label: "站酷意大利体", supportsChinese: false },
  { id: "1187223", label: "站酷仓耳渔阳体", supportsChinese: true },
  { id: "1187221", label: "站酷高端黑", supportsChinese: true },
  { id: "1187219", label: "站酷酷黑体", supportsChinese: true },
  { id: "1187217", label: "站酷快乐体", supportsChinese: true },
  { id: "1187213", label: "站酷文艺体", supportsChinese: true },
  { id: "1187211", label: "站酷小薇 LOGO 体", supportsChinese: true },
  { id: "SY_Black", label: "思源黑体", supportsChinese: true },
  { id: "ALi_PuHui", label: "阿里巴巴普惠体", supportsChinese: true },
  { id: "PM_ZhengDao", label: "庞门正道标题体", supportsChinese: true }
] as const;
```

Add `font_type: string | null` to `MultiTrackTextStyle`. Normalize missing values to `null`; preserve valid values unchanged. Call the pure validator from `validateTextStyle` and emit `invalid_font_type` at `${path}.style.font_type`.

- [x] **Step 4: Write failing backend schema and persistence tests**

Cover both text and subtitle elements, legacy payloads without `font_type`, valid preset/URL values, invalid values, and the asset sanitization whitelist.

```python
assert text.style.font_type == "SY_Black"
assert subtitle.style.font_type == custom_font_url
assert "invalid_font_type" in issue_codes(invalid_project)
```

- [x] **Step 5: Run the backend contract tests and verify failure**

Run:

```bash
cd backend
pytest tests/test_aigc_schemas.py tests/test_aigc_routes.py -q
```

Expected: FAIL because the strict Pydantic model rejects `font_type` and sanitization drops it.

- [x] **Step 6: Implement backend schema, validation, and sanitization**

Add:

```python
class MultiTrackTextStyle(SchemaModel):
    font_type: str | None = None
    font_size: float = 48
    # existing fields unchanged
```

Use the same ten-ID allowlist as the frontend. Accept only absolute HTTPS URLs with no credentials, at most 2048 characters, and `.ttf`/`.otf` path suffixes. Add `"font_type"` to the nested style allowlist in `_sanitize_multitrack_element`.

- [x] **Step 7: Run contract tests**

Run:

```bash
cd frontend
npx vitest run tests/aigc-multitrack.test.ts
cd ../backend
pytest tests/test_aigc_schemas.py tests/test_aigc_routes.py -q
```

Expected: PASS.

- [x] **Step 8: Defer the contract commit because shared files contain pre-existing work**

```bash
git add frontend/lib/aigc/multitrack-fonts.ts frontend/lib/aigc/types.ts frontend/lib/aigc/multitrack.ts frontend/lib/aigc/definition-migration.ts frontend/tests/aigc-multitrack.test.ts backend/app/schemas/aigc.py backend/app/services/assets.py backend/tests/test_aigc_schemas.py backend/tests/test_aigc_routes.py
git commit -m "feat(aigc): add multi-track font contracts"
```

### Task 2: Add Font Controls to the Inspector

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-inspector.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-editor.tsx`
- Test: `frontend/tests/aigc-multitrack-editor.test.tsx`

- [x] **Step 1: Write failing inspector interaction tests**

Test text and subtitle selections independently. Verify the “预置字体 / 自定义 URL” segmented control, all official options, default `null`, preset persistence, custom URL persistence, clearing back to `null`, invalid URL feedback, and the Chinese-support warning for `1187225`.

```typescript
fireEvent.click(screen.getByRole("button", { name: "自定义 URL" }));
fireEvent.change(screen.getByLabelText("字体文件 URL"), {
  target: { value: CUSTOM_FONT_URL }
});
expect(screen.getByDisplayValue(CUSTOM_FONT_URL)).toBeInTheDocument();
```

- [x] **Step 2: Run the component test and verify failure**

Run:

```bash
cd frontend
npx vitest run tests/aigc-multitrack-editor.test.tsx
```

Expected: FAIL because the font controls are absent.

- [x] **Step 3: Implement the shared font control**

Extend `TextStyleSection` with:

- a two-option segmented control;
- a preset `<select>` containing “默认字体” and all official IDs;
- a labeled custom URL input;
- inline validation and preview limitation text.

Use the existing `updateStyle` path so each completed selection remains one history operation. Initialize new text and subtitle styles with `font_type: null`.

- [x] **Step 4: Run the component tests**

Run:

```bash
cd frontend
npx vitest run tests/aigc-multitrack-editor.test.tsx tests/aigc-timeline-editor-shell.test.tsx
```

Expected: PASS.

- [x] **Step 5: Defer the inspector commit because shared files contain pre-existing work**

```bash
git add frontend/components/workspace/aigc/aigc-multitrack-inspector.tsx frontend/components/workspace/aigc/aigc-multitrack-editor.tsx frontend/tests/aigc-multitrack-editor.test.tsx frontend/tests/aigc-timeline-editor-shell.test.tsx
git commit -m "feat(aigc): add multi-track font controls"
```

### Task 3: Add Custom Font Preview Loading

**Files:**
- Create: `frontend/lib/aigc/multitrack-font-preview.ts`
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-preview.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-inspector.tsx`
- Test: `frontend/tests/aigc-multitrack-editor.test.tsx`

- [x] **Step 1: Write failing preview tests**

Mock `FontFace`, `document.fonts.add`, success, rejection, and repeated URL loads. Verify:

- one cached load per URL;
- loaded custom family is assigned to visible text;
- loading and failure use the system font;
- failure warning appears without creating a validation issue;
- preset IDs do not trigger browser font loading.

```typescript
expect(MockFontFace).toHaveBeenCalledWith(
  expect.stringMatching(/^aigc-custom-font-/),
  `url("${CUSTOM_FONT_URL}")`
);
expect(screen.getByTestId("preview-element-text-1")).toHaveStyle({
  fontFamily: expect.stringContaining("aigc-custom-font-")
});
```

- [x] **Step 2: Run the preview test and verify failure**

Run:

```bash
cd frontend
npx vitest run tests/aigc-multitrack-editor.test.tsx
```

Expected: FAIL because no browser font loader exists.

- [x] **Step 3: Implement the cached browser loader**

Expose a hook with a stable result:

```typescript
type PreviewFontState =
  | { status: "default"; family: null }
  | { status: "preset"; family: null }
  | { status: "loading"; family: null }
  | { status: "loaded"; family: string }
  | { status: "failed"; family: null };

export function useMultitrackPreviewFont(
  fontType: string | null
): PreviewFontState;
```

Derive a deterministic family name from the URL, cache the load promise by URL, add successful faces to `document.fonts`, and ignore stale async completion after the selected element changes.

- [x] **Step 4: Apply font state to preview and inspector**

For text elements, set `fontFamily` only when status is `loaded`. In the inspector, show the approved soft warning for `failed` and the MediaKit-only note for `preset`. Do not change validation or clear the configured URL after a load failure.

- [x] **Step 5: Run preview and inspector tests**

Run:

```bash
cd frontend
npx vitest run tests/aigc-multitrack-editor.test.tsx tests/aigc-multitrack-preview.test.ts
```

Expected: PASS.

- [x] **Step 6: Defer the preview commit because shared files contain pre-existing work**

```bash
git add frontend/lib/aigc/multitrack-font-preview.ts frontend/components/workspace/aigc/aigc-multitrack-preview.tsx frontend/components/workspace/aigc/aigc-multitrack-inspector.tsx frontend/tests/aigc-multitrack-editor.test.tsx frontend/tests/aigc-multitrack-preview.test.ts
git commit -m "feat(aigc): preview custom multi-track fonts"
```

### Task 4: Map Fonts to the MediaKit Contract

**Files:**
- Modify: `backend/app/services/aigc_gateway.py`
- Test: `backend/tests/test_aigc_gateway.py`

- [x] **Step 1: Write failing Provider payload tests**

Extend the existing multi-track Gateway fixture with:

- text using `SY_Black`;
- subtitle using the approved custom TTF URL;
- another text element using `null`.

Assert:

```python
assert provider_text["font_type"] == "SY_Black"
assert provider_subtitle["font_type"] == custom_font_url
assert "font_type" not in provider_default_text
assert "font_type" not in provider_text.get("style", {})
```

- [x] **Step 2: Run the Gateway test and verify failure**

Run:

```bash
cd backend
pytest tests/test_aigc_gateway.py::test_gateway_resolves_multi_track_assets_and_uses_mock_mediakit -q
```

Expected: FAIL because `font_type` remains internal or is absent from the Provider element.

- [x] **Step 3: Implement boundary mapping**

After serializing each text/subtitle element:

```python
if element.type in {"text", "subtitle"}:
    style = rendered.get("style")
    if isinstance(style, dict):
        font_type = style.pop("font_type", None)
        if font_type:
            rendered["font_type"] = font_type
```

Keep the complete internal style in persisted metadata. Do not add the font URL to diagnostic logs.

- [x] **Step 4: Run Gateway and client tests**

Run:

```bash
cd backend
pytest tests/test_aigc_gateway.py tests/test_mediakit_multitrack.py -q
```

Expected: PASS with zero real Provider calls.

- [x] **Step 5: Defer the Provider commit because shared files contain pre-existing work**

```bash
git add backend/app/services/aigc_gateway.py backend/tests/test_aigc_gateway.py
git commit -m "feat(aigc): map fonts to MediaKit requests"
```

### Task 5: Complete Regression and Browser Acceptance

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-acceptance.tsx`
- Modify: `frontend/scripts/verify-aigc-multitrack.mjs`
- Modify: `.trae/specs/enable-aigc-multitrack-font-selection/checklist.md`

- [x] **Step 1: Extend the non-billable acceptance fixture**

Add one preset-font text element and expose the custom font control. Keep execution routed to the existing local Mock path.

- [x] **Step 2: Extend Playwright assertions**

Verify on desktop, tablet, and mobile:

- selecting `阿里巴巴普惠体` stores `ALi_PuHui`;
- entering the approved TTF URL survives save and reload;
- invalid URL feedback is visible;
- preset limitation text is visible;
- the inspector has no clipped labels or horizontal overflow;
- `forbiddenRequests` remains empty.

- [x] **Step 3: Run focused frontend and backend tests**

Run:

```bash
cd frontend
npx vitest run tests/aigc-multitrack.test.ts tests/aigc-multitrack-editor.test.tsx tests/aigc-multitrack-preview.test.ts tests/aigc-timeline-editor-shell.test.tsx
cd ../backend
pytest tests/test_aigc_schemas.py tests/test_aigc_routes.py tests/test_aigc_gateway.py tests/test_mediakit_multitrack.py -q
```

Expected: PASS.

- [x] **Step 4: Run all frontend gates**

Run:

```bash
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit `0`.

- [x] **Step 5: Run Playwright acceptance**

Run:

```bash
cd frontend
npm run acceptance:aigc-multitrack
```

Expected: desktop `1440x900`, tablet `1023x768`, and mobile `390x844` pass with no console errors, page errors, overlap, clipping, or real MediaKit requests.

- [x] **Step 6: Complete the acceptance checklist**

Mark every verified item in `.trae/specs/enable-aigc-multitrack-font-selection/checklist.md`.

- [x] **Step 7: Defer the acceptance commit because shared files contain pre-existing work**

```bash
git add frontend/components/workspace/aigc/aigc-multitrack-acceptance.tsx frontend/scripts/verify-aigc-multitrack.mjs .trae/specs/enable-aigc-multitrack-font-selection/checklist.md
git commit -m "test(aigc): cover multi-track font selection"
```
