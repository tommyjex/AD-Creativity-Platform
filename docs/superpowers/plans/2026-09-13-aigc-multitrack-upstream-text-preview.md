# AIGC Multi-Track Upstream Text Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the actual latest successful upstream text consistently in the multi-track canvas, timeline, and inspector without changing persisted source bindings.

**Architecture:** The server-side timeline loader enriches editor-only source descriptors with text preview data from the newest successful branch-aware Run, then applies a static text-node fallback. A pure display resolver is shared by all three UI surfaces, while conversion to inline text remains an explicit, undoable editor action.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, existing AIGC Run APIs, Vitest, Testing Library, Playwright.

---

### Task 1: Define editor-only preview data and the shared resolver

**Files:**
- Modify: `frontend/lib/aigc/multitrack-editor-store.ts`
- Create: `frontend/lib/aigc/multitrack-text-preview.ts`
- Test: `frontend/tests/aigc-multitrack-text-preview.test.ts`

- [x] **Step 1: Write resolver tests**

Cover inline text, successful upstream text, static fallback text, and the
unresolved waiting label:

```ts
expect(resolveMultitrackTextPreview(inlineElement, [])).toMatchObject({
  text: "内联标题",
  status: "inline"
});
expect(resolveMultitrackTextPreview(upstreamElement, [{
  available: true,
  kind: "text",
  preview_text: "真实上游文案",
  text_preview_status: "resolved",
  source_handle: "text",
  source_node_id: "copy-node"
}])).toMatchObject({
  text: "真实上游文案",
  status: "resolved"
});
expect(resolveMultitrackTextPreview(upstreamElement, [])).toMatchObject({
  text: "等待上游运行",
  status: "unavailable"
});
```

- [x] **Step 2: Run the resolver test and verify failure**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-text-preview.test.ts
```

Expected: FAIL because the resolver module does not exist.

- [x] **Step 3: Add preview fields and resolver**

Extend `AigcTimelineSource`:

```ts
preview_text?: string | null;
text_preview_status?: "resolved" | "configured" | "unavailable";
```

Create:

```ts
export function resolveMultitrackTextPreview(
  element: MultiTrackTextElement,
  sources: readonly AigcTimelineSource[]
): MultitrackTextPreview {
  if (element.source === null) {
    return {
      text: element.inline_text?.trim() || "输入文字",
      status: "inline"
    };
  }
  const source = sources.find((candidate) =>
    candidate.source_node_id === element.source?.source_node_id &&
    candidate.source_handle === element.source?.source_handle
  );
  const text = source?.preview_text?.trim();
  return text
    ? { text, status: source?.text_preview_status ?? "resolved" }
    : { text: "等待上游运行", status: "unavailable" };
}
```

- [x] **Step 4: Run the resolver tests**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-text-preview.test.ts
```

Expected: PASS.

### Task 2: Load latest successful upstream text

**Files:**
- Modify: `frontend/lib/aigc/timeline-loader.ts`
- Test: `frontend/tests/aigc-timeline-route.test.ts`

- [x] **Step 1: Add failing loader tests**

Build a Pipeline with a text source connected to `texts`. Mock:

```ts
listAigcRuns.mockResolvedValue({
  items: [newestSucceededRun, olderSucceededRun],
  page: 1,
  page_size: 20,
  total: 2
});
getAigcRun.mockResolvedValue({
  run: newestSucceededRun,
  nodes: [{
    node_id: "copy-node",
    included_in_plan: true,
    status: "succeeded",
    result: { kind: "text", text: "最新真实文案" }
  }]
});
```

Assert the text source contains:

```ts
{
  preview_text: "最新真实文案",
  text_preview_status: "resolved"
}
```

Add separate tests for static `text.config.text`, dynamic waiting state, and a
rejected Run API call that still returns editor data.

- [x] **Step 2: Run loader tests and verify failure**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-timeline-route.test.ts
```

Expected: FAIL because text sources do not load Run results.

- [x] **Step 3: Implement bounded branch-aware lookup**

Update the API type to require:

```ts
Pick<
  AigcApiClient,
  "getAigcPipeline" | "getAsset" | "getAigcRun" | "listAigcRuns"
>
```

For unresolved text sources:

1. list Runs in pages of 20, newest first;
2. consider only `run.status === "succeeded"`;
3. use `getAigcRunProjectionNodeIds(run)` to identify candidate sources;
4. fetch each candidate Run detail once with a five-second timeout;
5. accept a node with status `succeeded` or `reused`, result kind `text`, and
   non-empty text;
6. stop once all text sources are resolved;
7. catch list/detail failures and continue to fallback.

- [x] **Step 4: Implement static fallback**

Use `text.config.text` only when:

```ts
node.type === "text" &&
node.config.generated_by_parser_node_id == null &&
!pipeline.definition.edges.some(
  (edge) =>
    edge.targetNodeId === node.id &&
    edge.targetHandle === "text"
)
```

Return `text_preview_status: "configured"` for this fallback and
`"unavailable"` otherwise.

- [x] **Step 5: Run loader tests**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-timeline-route.test.ts
```

Expected: PASS.

### Task 3: Render the same text on every editor surface

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-preview.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-timeline.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-editor.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-inspector.tsx`
- Test: `frontend/tests/aigc-multitrack-editor.test.tsx`

- [x] **Step 1: Write a failing integration test**

Provide a text source with `preview_text: "真实上游文案"` and assert:

```tsx
expect(
  screen.getByTestId("preview-element-title-upstream")
).toHaveTextContent("真实上游文案");
expect(
  screen.getByRole("button", { name: "选择片段 真实上游文案" })
).toBeInTheDocument();
expect(screen.getByLabelText("上游文字预览")).toHaveValue("真实上游文案");
```

- [x] **Step 2: Run the integration test and verify failure**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-editor.test.tsx
```

Expected: FAIL because each surface still uses `inline_text` directly.

- [x] **Step 3: Use the resolver in canvas and timeline**

Pass `state.sources` to `AigcMultitrackTimeline`. Resolve text before rendering
the canvas layer and before building the timeline clip label. Preserve newlines
on the canvas and collapse whitespace only for the compact timeline label.

- [x] **Step 4: Render upstream text read-only in the inspector**

For an upstream-bound text element render:

```tsx
<textarea
  aria-label="上游文字预览"
  readOnly
  value={preview.text}
/>
<Button
  disabled={preview.status === "unavailable"}
  onClick={() => updateElement((element) => ({
    ...element,
    inline_text: preview.text,
    source: null
  }))}
>
  转为内联文字
</Button>
```

Keep the existing editable `内联文字` field when `source === null`.

- [x] **Step 5: Verify explicit conversion and undo**

Extend the integration test to click `转为内联文字`, edit the textarea, and
undo. Assert conversion creates one history entry and no preview-only fields
appear inside the saved `MultiTrackEditConfig`.

- [x] **Step 6: Run component tests**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-multitrack-editor.test.tsx
```

Expected: PASS.

### Task 4: Browser acceptance and quality gates

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-multitrack-acceptance.tsx`
- Modify: `frontend/scripts/verify-aigc-multitrack.mjs`

- [x] **Step 1: Add an upstream text fixture**

Set the acceptance text element to `source` mode and provide:

```ts
{
  available: true,
  kind: "text",
  preview_text: "Task 9 上游真实文案",
  text_preview_status: "resolved",
  source_handle: "text",
  source_node_id: "acceptance-text-source"
}
```

- [x] **Step 2: Add browser assertions**

For desktop, tablet, and mobile assert:

- canvas contains `Task 9 上游真实文案`;
- timeline accessible name contains the same value;
- inspector read-only preview contains the same value;
- conversion to inline changes the inspector mode;
- one undo restores upstream mode;
- no Provider request is sent.

- [x] **Step 3: Run focused and static gates**

Run:

```bash
cd frontend
npm test -- --run \
  tests/aigc-multitrack-text-preview.test.ts \
  tests/aigc-timeline-route.test.ts \
  tests/aigc-multitrack-editor.test.tsx
npm run typecheck
npm run lint
node --check scripts/verify-aigc-multitrack.mjs
```

Expected: all commands exit `0`.

- [x] **Step 4: Run full tests and production build**

Run:

```bash
cd frontend
npm test
npm run build
```

Expected: all tests pass and Next.js builds all routes.

- [x] **Step 5: Run multi-viewport acceptance**

Run:

```bash
cd frontend
PLAYWRIGHT_ARTIFACTS_PATH="$PWD/test-results/aigc-multitrack-upstream-text" \
  npm run acceptance:aigc-multitrack
```

Expected: desktop `1440x900`, tablet `1023x768`, and mobile `390x844` pass
with empty console/page error arrays and zero real Provider requests.
