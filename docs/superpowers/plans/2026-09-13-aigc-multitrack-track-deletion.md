# AIGC Multi-Track Track Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete any added timeline track from a discoverable track-header menu, with confirmation for non-empty tracks and one-step undo.

**Architecture:** The timeline renders an anchored Radix Popover per track and a Radix Dialog only when a non-empty deletion needs confirmation. The editor coordinates the existing `track/remove` action with local selection cleanup, while the existing Zustand history stores the removed track and clips as one snapshot.

**Tech Stack:** React 19, TypeScript, Zustand, Radix Popover/Dialog, Lucide icons, Vitest, Testing Library, Playwright.

---

### Task 1: Define the deletion callback and selection cleanup

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-editor.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-timeline.tsx`
- Test: `frontend/tests/aigc-multitrack-editor.test.tsx`

- [x] **Step 1: Write a failing editor test**

Add a test that selects a clip, requests deletion of its parent track, and
asserts that the track, selected clip inspector, and selected-track state are
cleared.

```tsx
fireEvent.click(screen.getByRole("button", { name: "选择片段 新品发布" }));
fireEvent.click(screen.getByRole("button", { name: "轨道操作：标题" }));
fireEvent.click(screen.getByRole("menuitem", { name: "删除轨道" }));
fireEvent.click(screen.getByRole("button", { name: "确认删除轨道" }));

expect(screen.queryByTitle("标题")).not.toBeInTheDocument();
expect(screen.queryByText("片段属性")).not.toBeInTheDocument();
```

- [x] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-editor.test.tsx
```

Expected: FAIL because `轨道操作：标题` does not exist.

- [x] **Step 3: Add the editor deletion coordinator**

Add this callback in `AigcMultitrackEditor`:

```tsx
function deleteTrack(track: MultiTrackTrack) {
  state.dispatch({ type: "track/remove", trackId: track.id });
  if (selectedTrackId === track.id) setSelectedTrackId(null);
  if (
    selectedElementId &&
    track.elements.some((element) => element.id === selectedElementId)
  ) {
    setSelectedElementId(null);
  }
}
```

Pass it to the timeline:

```tsx
<AigcMultitrackTimeline
  onDeleteTrack={deleteTrack}
  // existing props remain unchanged
/>
```

Extend the timeline props with:

```tsx
onDeleteTrack: (track: MultiTrackTrack) => void;
```

- [x] **Step 4: Run type checking**

Run:

```bash
cd frontend
npm run typecheck
```

Expected: PASS after all new props are wired.

### Task 2: Add the track action popover

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-timeline.tsx`
- Test: `frontend/tests/aigc-multitrack-editor.test.tsx`

- [x] **Step 1: Write failing menu behavior tests**

Cover:

```tsx
fireEvent.click(screen.getByRole("button", { name: "轨道操作：标题" }));
expect(screen.getByRole("menuitem", { name: "隐藏轨道" })).toBeVisible();
expect(screen.getByRole("menuitem", { name: "轨道静音" })).toBeVisible();
expect(screen.getByRole("menuitem", { name: "删除轨道" })).toBeVisible();
```

After activating hide or mute, reopen the menu and assert the labels become
`显示轨道` and `取消静音`.

- [x] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-editor.test.tsx
```

Expected: FAIL because the track action menu is not rendered.

- [x] **Step 3: Implement the anchored menu**

Import:

```tsx
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal } from "lucide-react";
```

Add `onDeleteTrack` to `TrackHeader` and replace the direct hide/mute buttons
with a popover:

```tsx
<Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
  <Popover.Trigger asChild>
    <MiniButton label={`轨道操作：${track.name}`}>
      <MoreHorizontal />
    </MiniButton>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      align="end"
      aria-label={`${track.name}轨道菜单`}
      className="z-[70] w-36 border border-[#3c424b] bg-[#1b1f25] p-1 shadow-xl"
      collisionPadding={8}
      role="menu"
      sideOffset={4}
    >
      <TrackMenuItem
        label={track.hidden ? "显示轨道" : "隐藏轨道"}
        onClick={() => dispatch({
          type: "track/toggle-hidden",
          trackId: track.id
        })}
      />
      <TrackMenuItem
        label={track.muted ? "取消静音" : "轨道静音"}
        onClick={() => dispatch({
          type: "track/toggle-muted",
          trackId: track.id
        })}
      />
      <TrackMenuItem destructive label="删除轨道" onClick={requestDelete} />
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
```

`TrackMenuItem` renders a full-width text button with `role="menuitem"` and
closes the popover after activation.

- [x] **Step 4: Run the focused menu tests**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-editor.test.tsx
```

Expected: menu tests PASS.

### Task 3: Confirm non-empty track deletion

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-timeline.tsx`
- Test: `frontend/tests/aigc-multitrack-editor.test.tsx`

- [x] **Step 1: Write failing empty and non-empty deletion tests**

For an empty track, assert one click on `删除轨道` removes it without a dialog.
For a non-empty track, assert:

```tsx
expect(
  screen.getByRole("dialog", { name: "删除轨道“标题”" })
).toBeVisible();
expect(screen.getByText("轨道内 1 个片段将一并删除。")).toBeVisible();
```

Verify `取消` and Escape preserve the track.

- [x] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-editor.test.tsx
```

Expected: FAIL because no confirmation dialog exists.

- [x] **Step 3: Implement confirmation state and dialog**

Track header state:

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);

function requestDelete() {
  setMenuOpen(false);
  if (track.elements.length === 0) {
    onDeleteTrack(track);
    return;
  }
  setConfirmOpen(true);
}
```

Render the existing dialog primitives:

```tsx
<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <DialogContent className="max-w-sm border-[#3c424b] bg-[#1b1f25] text-zinc-100">
    <DialogHeader>
      <DialogTitle>删除轨道“{track.name}”</DialogTitle>
      <DialogDescription>
        轨道内 {track.elements.length} 个片段将一并删除。
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setConfirmOpen(false)}>
        取消
      </Button>
      <Button
        aria-label="确认删除轨道"
        variant="destructive"
        onClick={() => {
          setConfirmOpen(false);
          onDeleteTrack(track);
        }}
      >
        删除轨道
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [x] **Step 4: Run focused component tests**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-editor.test.tsx
```

Expected: empty, confirm, cancel, and selection tests PASS.

### Task 4: Verify one-step undo

**Files:**
- Modify: `frontend/tests/aigc-multitrack-editor-store.test.ts`
- Modify: `frontend/tests/aigc-multitrack-editor.test.tsx`

- [x] **Step 1: Extend the reducer test**

Use the existing `track/remove` action and assert:

```ts
const removed = reduceAigcMultitrackEditor(initial, {
  type: "track/remove",
  trackId: "video-track"
});
expect(removed.config.tracks).toHaveLength(0);
expect(removed.past).toHaveLength(1);

const restored = reduceAigcMultitrackEditor(removed, {
  type: "history/undo"
});
expect(restored.config.tracks[0]).toEqual(initial.config.tracks[0]);
```

- [x] **Step 2: Extend the editor integration test**

Delete a non-empty track through the menu, click the top-level `撤销` button,
and assert the track title and all original clips return.

- [x] **Step 3: Run both focused suites**

Run:

```bash
cd frontend
npm test -- --run \
  tests/aigc-multitrack-editor-store.test.ts \
  tests/aigc-multitrack-editor.test.tsx
```

Expected: all tests PASS.

### Task 5: Add responsive browser acceptance

**Files:**
- Modify: `frontend/scripts/verify-aigc-multitrack.mjs`

- [x] **Step 1: Add deletion checks to the acceptance script**

For each viewport:

1. Create an empty text track and delete it directly.
2. Open the video track menu and request deletion.
3. Assert the confirmation dialog shows the clip count.
4. Cancel and assert the track remains.
5. Confirm deletion and assert the track disappears.
6. Undo and assert the track and clips return.
7. Confirm menu and dialog bounding boxes stay inside the viewport.

- [x] **Step 2: Validate script syntax**

Run:

```bash
cd frontend
node --check scripts/verify-aigc-multitrack.mjs
```

Expected: exit code `0`.

- [x] **Step 3: Run static gates**

Run:

```bash
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
```

Expected: all commands exit `0`.

- [x] **Step 4: Run multi-viewport acceptance**

Run:

```bash
cd frontend
PLAYWRIGHT_ARTIFACTS_PATH="$PWD/test-results/aigc-multitrack-track-deletion" \
  npm run acceptance:aigc-multitrack
```

Expected:

- desktop `1440x900`, tablet `1023x768`, and mobile `390x844` pass;
- console and page error arrays are empty;
- `forbiddenRequests` is empty;
- no real MediaKit request is sent.
