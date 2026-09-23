# Modality Node Dragging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore direct dragging from every non-interactive area of text, image, video, and audio nodes, while shrinking the image precise-edit action to the approved 24px / 20px / 12px dimensions.

**Architecture:** Keep React Flow's global drag configuration unchanged and narrow `nodrag` to true controls only. Modality containers become draggable surfaces, while copy, preview, precise-edit, audio, and video controls retain event isolation; the existing Playwright acceptance fixture verifies real coordinate changes and control behavior at three viewports.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@xyflow/react`, Tailwind CSS, Vitest, Testing Library, Playwright Python.

---

## File Map

- Modify `frontend/components/workspace/aigc/aigc-flow-node.tsx`: expose draggable modality body surfaces, retain `nodrag` on interactive descendants, and use the compact precise-edit trigger.
- Modify `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`: add an explicit compact trigger option without changing the default trigger.
- Modify `frontend/components/workspace/aigc/aigc-video-player.tsx`: make the node player wrapper draggable while isolating the native video control.
- Modify `frontend/components/workspace/aigc/aigc-audio-player.tsx`: make the node player wrapper draggable while isolating the native audio control.
- Modify `frontend/tests/aigc-flow-node.test.tsx`: cover local input modality drag boundaries and exact image action dimensions.
- Modify `frontend/tests/aigc-flow-node-v2.test.tsx`: cover projected modality drag boundaries and interactive controls.
- Modify `frontend/scripts/verify-aigc-modality-node-titles.py`: perform real four-modality drag operations and verify controls do not move nodes in desktop, tablet, and mobile viewports.

### Task 1: Lock the component interaction contract

**Files:**
- Modify: `frontend/tests/aigc-flow-node.test.tsx`
- Modify: `frontend/tests/aigc-flow-node-v2.test.tsx`

- [x] **Step 1: Add failing tests for local modality nodes**

In `frontend/tests/aigc-flow-node.test.tsx`, extend the representative modality coverage to assert:

```tsx
expect(textBody).not.toHaveClass("nodrag");
expect(imagePreview).not.toHaveClass("nodrag");
expect(screen.getByRole("button", { name: "查看原图：产品横图.png" }))
  .toHaveClass("nodrag");
expect(screen.getByLabelText("播放视频：产品演示.mp4"))
  .toHaveClass("nodrag", "nopan", "nowheel");
expect(screen.getByLabelText("播放音频：旁白.mp3"))
  .toHaveClass("nodrag", "nowheel");
```

Add stable test IDs only to modality body surfaces that cannot otherwise be selected unambiguously. Assert that rename inputs, copy buttons, and the external precise-edit action still have `nodrag`.

- [x] **Step 2: Add failing tests for projected modality nodes and compact action sizing**

In `frontend/tests/aigc-flow-node-v2.test.tsx`, assert that projected text/image/video/audio containers are draggable, while their real controls retain `nodrag`. In the image case, assert:

```tsx
expect(screen.getByTestId("aigc-image-node-actions")).toHaveClass("h-6", "w-6");
expect(screen.getByRole("button", { name: "精准编辑：海报成片" }))
  .toHaveClass("h-5", "w-5");
expect(
  screen.getByRole("button", { name: "精准编辑：海报成片" })
    .querySelector("svg")
).toHaveClass("h-3", "w-3");
```

- [x] **Step 3: Run focused tests and verify the new assertions fail**

Run:

```bash
cd frontend
npx vitest run tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx
```

Expected: FAIL because modality body wrappers still carry `nodrag`, interactive controls do not yet own all isolation classes, and the image action still uses 28px / 24px / 14px sizing.

### Task 2: Implement precise drag boundaries and compact image action

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-video-player.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-audio-player.tsx`

- [x] **Step 1: Add the explicit compact precise-edit trigger option**

Add `compactTrigger?: boolean` to `AigcPreciseEditDialog`. Keep the default unchanged and derive classes with `cn`:

```tsx
className={cn(
  "nodrag grid shrink-0 place-items-center rounded text-muted-foreground hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-40",
  compactTrigger ? "h-5 w-5" : "h-6 w-6"
)}
```

Render the icon with:

```tsx
<ScanSearch className={compactTrigger ? "h-3 w-3" : "h-3.5 w-3.5"} />
```

- [x] **Step 2: Shrink only the image node's external action**

In `aigc-flow-node.tsx`, change the external action container from `h-7 w-7` to `h-6 w-6` and pass `compactTrigger` to `AigcPreciseEditDialog`. Preserve `nodrag`, click/pointer propagation blocking, tooltip, disabled state, absolute positioning, and right-edge alignment.

- [x] **Step 3: Make text and image body surfaces draggable**

Remove `nodrag` from the `ModalityTextBody` outer container and `NodeImageMedia` preview container. Add `nodrag` to the text copy button and image original-preview button:

```tsx
className="nodrag ..."
```

Keep the rename input, external precise-edit action, and node action links isolated as they are.

- [x] **Step 4: Isolate only native video controls**

In `AigcVideoPlayer`, remove `nodrag nopan nowheel` from the node wrapper so its padding and overlay remain valid drag surfaces. Put those classes on the native video element:

```tsx
<video className="nodrag nopan nowheel block h-full w-full object-contain" ... />
```

For unavailable media, leave the non-interactive empty-state wrapper without `nodrag`.

- [x] **Step 5: Isolate only native audio controls**

In `AigcAudioPlayer`, remove `nodrag nowheel` from the node wrapper and put those classes on the native audio element:

```tsx
<audio className="nodrag nowheel h-8 w-full" ... />
```

Apply the same boundary to the local audio branch in `NodeInputMedia`: its wrapper, name, metadata, and empty state remain draggable; only the native audio element receives `nodrag nowheel`.

- [x] **Step 6: Run focused tests and verify they pass**

Run:

```bash
cd frontend
npx vitest run tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx
```

Expected: both files PASS with no new warnings.

### Task 3: Add real React Flow drag acceptance coverage

**Files:**
- Modify: `frontend/scripts/verify-aigc-modality-node-titles.py`

- [x] **Step 1: Add helpers for node position and safe drag points**

Add helpers that read the React Flow node transform or bounding box before and after a drag, and choose a visible non-interactive point from each modality card:

```python
def node_transform(target) -> str:
    return target.evaluate(
        "element => element.style.transform || "
        "getComputedStyle(element).transform"
    )


def drag_from_point(page, point: dict[str, float], dx: int = 36, dy: int = 24) -> None:
    page.mouse.move(point["x"], point["y"])
    page.mouse.down()
    page.mouse.move(point["x"] + dx, point["y"] + dy, steps=8)
    page.mouse.up()
```

Use body padding, text content, player wrapper padding, or metadata areas. Never start from a button, link, image preview button, native media element, handle, resizer, or node action.

- [x] **Step 2: Verify all four modalities move**

For each viewport and each of `text`, `image`, `video`, and `audio`:

1. Capture the node transform and bounding box.
2. Drag from the safe non-interactive point.
3. Assert the transform changed and the bounding box moved by a meaningful amount.
4. Re-fit the graph only if needed before continuing.

Expected: all four node coordinates change at desktop, tablet, and mobile sizes.

- [x] **Step 3: Verify interactive controls do not drag**

Capture the owning node position, then click or perform a short pointer interaction on:

- text copy button,
- image original-preview button,
- image precise-edit button,
- native video element,
- native audio element.

Close opened dialogs with Escape and assert each node's position is unchanged. Retain the existing download, rename, overflow, console-error, and screenshot checks.

- [x] **Step 4: Run the three-viewport acceptance test**

Run:

```bash
cd frontend
../.venv/bin/python scripts/verify-aigc-modality-node-titles.py
```

Expected: desktop, tablet, and mobile scenarios PASS; each reports four draggable modalities, no control-induced movement, no overflow, and zero console/page errors.

- [x] **Step 5: Inspect all generated screenshots**

Open every PNG under:

```text
frontend/test-results/aigc-modality-node-titles/
```

Confirm the 24px action remains above and right-aligned with the image card, does not overlap handles or resizers, media stays `object-contain`, and no labels or controls overlap.

### Task 4: Run the complete frontend quality gate

**Files:**
- Modify: `docs/superpowers/plans/2026-09-22-modality-node-dragging.md`

- [x] **Step 1: Run the complete Vitest suite**

Run:

```bash
cd frontend
npm test
```

Expected: all existing tests PASS, including the current 887-test baseline plus the new assertions.

- [x] **Step 2: Run TypeScript and ESLint**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
```

Expected: both commands exit 0 with no warnings.

- [x] **Step 3: Re-run the acceptance script after static checks**

Run:

```bash
cd frontend
../.venv/bin/python scripts/verify-aigc-modality-node-titles.py
```

Expected: all three viewports PASS again with zero browser errors.

- [x] **Step 4: Record completion without committing product code**

Mark completed checkboxes in this plan and summarize the exact test counts, viewport results, screenshots inspected, and any residual risk. Do not commit product code unless the user explicitly requests it.
