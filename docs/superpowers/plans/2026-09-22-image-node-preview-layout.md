# Image Node Preview Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the image node precise-edit action outside the card at the top-right and make the card interior a gray, aspect-ratio-safe image preview.

**Architecture:** Keep the existing image data projection and precise-edit dialog unchanged. Split the image action from the shared in-card `NodeActions`, render it as an absolutely positioned sibling of the card, and update only `NodeImageMedia` surface styling. Preserve the title-row rename path and all non-image node behavior.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright

---

## File Structure

- Modify `frontend/components/workspace/aigc/aigc-flow-node.tsx`: separate the image action from in-card actions, render the external action, and update image preview colors.
- Modify `frontend/tests/aigc-flow-node.test.tsx`: test external placement, gray preview surface, disabled state, preserved badges, and dialog behavior.
- Modify `frontend/tests/aigc-flow-node-v2.test.tsx`: protect projected image output and non-image modality actions.
- Modify `frontend/scripts/verify-aigc-modality-node-titles.py`: extend the existing three-viewport acceptance test with image action placement and preview color assertions.

### Task 1: Add Failing Component Tests

**Files:**
- Modify: `frontend/tests/aigc-flow-node.test.tsx:680-840`
- Modify: `frontend/tests/aigc-flow-node-v2.test.tsx:630-655`

- [ ] **Step 1: Assert that precise edit is outside the card**

Update the disabled precise-edit test to capture the rendered card and assert the external action relationship:

```tsx
const { container } = renderNode({
  id: "input-image",
  type: "image",
  position: { x: 0, y: 0 },
  size: { width: 240, height: 160 },
  config: {
    asset_id: null,
    bbox: null,
    bbox_asset_id: null,
    title: null
  }
});

const card = screen.getByRole("group", { name: "图片节点" });
const externalActions = screen.getByTestId("aigc-image-node-actions");
const preciseEdit = screen.getByRole("button", {
  name: "精准编辑：图片输入"
});

expect(container).toContainElement(externalActions);
expect(card).not.toContainElement(externalActions);
expect(externalActions).toContainElement(preciseEdit);
expect(externalActions).toHaveClass("absolute", "right-0", "top-0");
expect(screen.queryByTestId("aigc-node-actions")).toBeNull();
```

- [ ] **Step 2: Assert gray preview and preserved status badges**

Add a test id to the expected preview contract and extend the image load test:

```tsx
const preview = screen.getByTestId("aigc-image-preview");
expect(preview).toHaveClass("bg-card");
expect(preview).not.toHaveClass("bg-slate-950");
expect(image).toHaveClass("object-contain");

Object.defineProperty(image, "naturalWidth", { value: 1920 });
Object.defineProperty(image, "naturalHeight", { value: 1080 });
fireEvent.load(image);
expect(screen.getByText("1920 × 1080")).toBeInTheDocument();
```

For an image node with a valid BBox, retain:

```tsx
expect(screen.getByText("已框选")).toBeInTheDocument();
```

- [ ] **Step 3: Protect V2 projected-image behavior**

Replace the V2 expectation that the precise-edit button is inside shared node actions:

```tsx
expect(screen.queryByTestId("aigc-node-actions")).toBeNull();
expect(screen.getByTestId("aigc-image-node-actions")).toContainElement(
  screen.getByRole("button", { name: "精准编辑：海报成片" })
);
expect(screen.getByTestId("aigc-image-preview")).toHaveClass("bg-card");
```

- [ ] **Step 4: Run focused tests and verify the new assertions fail**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx
```

Expected: failures for the missing `aigc-image-node-actions` and `aigc-image-preview` elements and the old in-card action placement.

### Task 2: Implement the External Image Action and Gray Preview

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx:309-720`
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx:1390-1495`

- [ ] **Step 1: Restrict shared in-card actions to actual downloads**

Replace the image-inclusive action condition:

```tsx
const hasNodeActions = Boolean(outputDownload);
```

Do not pass `AigcPreciseEditDialog` through `NodeActions`; use `imageAction={null}` in title-row and compact shared-action calls. This keeps downloads unchanged for model, audio, and control nodes.

- [ ] **Step 2: Render precise edit as a card sibling**

Wrap the existing return value in a fragment and append the external action after the card:

```tsx
return (
  <>
    <div
      aria-label={resolvedDisplayName}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-md",
        selected && "ring-2 ring-primary/20"
      )}
      role="group"
    >
      {/* Existing resizer, handles, title row, and body remain here. */}
    </div>
    {data.node.type === "image" ? (
      <div
        className="nodrag absolute right-0 top-0 z-10 -translate-y-[calc(100%+0.375rem)]"
        data-testid="aigc-image-node-actions"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <AigcPreciseEditDialog
          assetId={preciseEditAssetId}
          assetName={preciseEditName}
          bboxState={imageBboxBinding?.state ?? "none"}
          node={data.node}
          sourceMode={currentModalityMode}
          url={preciseEditUrl}
        />
      </div>
    ) : null}
  </>
);
```

Use a top-right offset that leaves the right-side output port and NodeResizer handles unobstructed. Preserve the current dialog props and event isolation.

- [ ] **Step 3: Make the preview surface match the text node**

Update `NodeImageMedia`:

```tsx
<div
  className="nodrag min-h-0 min-w-0 flex-1 overflow-hidden bg-card p-1.5"
  data-testid="aigc-image-preview"
>
```

Update empty-state text from slate-specific colors to semantic colors:

```tsx
<div className="grid h-full min-h-0 w-full place-items-center px-3 text-center text-[10px] text-muted-foreground">
  {emptyText}
</div>
```

Keep the image class exactly aspect-ratio-safe:

```tsx
className="absolute inset-0 block h-full w-full select-none object-contain"
```

Keep the resolution and `已框选` overlays unchanged.

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx
```

Expected: both files pass with no failed tests.

### Task 3: Extend Multi-Viewport Acceptance and Run Quality Checks

**Files:**
- Modify: `frontend/scripts/verify-aigc-modality-node-titles.py:300-460`

- [ ] **Step 1: Add browser assertions for the external action**

For the image node in each viewport, evaluate bounding boxes:

```python
image_box = image_node.bounding_box()
action_box = image_node.locator(
    '[data-testid="aigc-image-node-actions"]'
).bounding_box()
preview = image_node.get_by_test_id("aigc-image-preview")

assert image_box is not None
assert action_box is not None
assert action_box["y"] + action_box["height"] <= image_box["y"]
assert action_box["x"] + action_box["width"] <= image_box["x"] + image_box["width"]
assert preview.evaluate(
    "(element) => getComputedStyle(element).backgroundColor"
) == text_node.evaluate(
    "(element) => getComputedStyle(element).backgroundColor"
)
```

Also assert that the button remains enabled when an image is available and opens the precise-edit dialog.

- [ ] **Step 2: Run component and static checks**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands exit with status 0.

- [ ] **Step 3: Run the existing three-viewport Playwright acceptance**

Run the repository’s established command for:

```bash
cd frontend
python3 scripts/verify-aigc-modality-node-titles.py
```

Expected:

- Desktop `1440x900` passes.
- Tablet `1024x768` passes.
- Mobile `390x844` passes.
- Precise-edit action is outside the image card and does not overlap ports or preview.
- Image and empty states use the same gray surface as the text node.
- Browser console errors and page errors are both zero.

- [ ] **Step 4: Inspect screenshots**

Open the generated desktop, tablet, and mobile screenshots and confirm:

- the external button is visually associated with the image node;
- the button does not overlap the output port, selection ring, or resize handles;
- the image is fully visible with `object-contain`;
- the preview surface is gray rather than navy;
- the resolution and BBox badges remain legible.

- [ ] **Step 5: Check the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the planned product, test, plan, and existing unrelated workspace changes are present. Do not delete or revert pre-existing `.next-*`, `next-env.d.ts`, or debugging artifacts.
