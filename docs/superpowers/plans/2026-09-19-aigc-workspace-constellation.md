# AIGC Workspace Constellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AIGC canvas list into a dark constellation-style workspace while preserving its current data contracts and all list actions.

**Architecture:** Keep `AigcWorkspace` as the owner of list queries, mutation state, search, pagination, and navigation. Move deterministic preview metadata and topology calculations into a small pure helper so the component can render the new card layout without duplicating modality rules. The visual layer remains Tailwind/CSS-only and consumes existing pipeline/template data.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query, Vitest with Testing Library, Playwright.

---

## File Structure

- Create: `frontend/lib/aigc/workspace-preview.ts`
  - Pure functions that classify normalized AIGC nodes into text, image, video, audio, or neutral preview tones; calculate model counts using the node registry; calculate bounded thumbnail coordinates.
- Create: `frontend/tests/aigc-workspace-preview.test.ts`
  - Unit tests for tone classification, model counting, unknown-node fallback, and coordinate normalization.
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx`
  - Replace the current light list presentation with the constellation workspace shell, use the pure preview helper, preserve current callbacks and accessibility semantics, and add stable test selectors for visual assertions.
- Modify: `frontend/tests/aigc-workspace.test.tsx`
  - Retain existing behavior coverage and add rendered-layout, fallback-copy, metadata, and card-accessibility assertions.
- Create: `frontend/scripts/verify-aigc-workspace.mjs`
  - Run Playwright checks against a seeded local AIGC workspace at desktop, tablet, and mobile dimensions; store screenshots and fail on viewport overflow or missing core controls.
- Modify: `frontend/package.json`
  - Expose the new Playwright workspace verification command without changing existing scripts.

`frontend/lib/aigc/modality-colors.ts` is intentionally out of scope because it has unrelated uncommitted work. The new helper uses the existing node registry and CSS custom properties rather than editing that file.

### Task 1: Add deterministic workspace-preview metadata

**Files:**
- Create: `frontend/lib/aigc/workspace-preview.ts`
- Create: `frontend/tests/aigc-workspace-preview.test.ts`

- [ ] **Step 1: Write failing tests for the preview helper**

```ts
import { describe, expect, it } from "vitest";
import {
  countWorkspacePreviewModels,
  getWorkspacePreviewNodeTone,
  normalizeWorkspaceTopology
} from "@/lib/aigc/workspace-preview";

describe("AIGC workspace preview metadata", () => {
  it("maps text, image, video, and audio output nodes to the shared modality tones", () => {
    expect(getWorkspacePreviewNodeTone({ type: "text" } as never)).toBe("text");
    expect(getWorkspacePreviewNodeTone({ type: "text_to_image" } as never)).toBe("image");
    expect(getWorkspacePreviewNodeTone({ type: "video_generation" } as never)).toBe("video");
    expect(getWorkspacePreviewNodeTone({ type: "audio" } as never)).toBe("audio");
  });

  it("uses a neutral tone for a node missing from the registry", () => {
    expect(getWorkspacePreviewNodeTone({ type: "unknown" } as never)).toBe(
      "neutral"
    );
  });

  it("counts only executable model nodes", () => {
    expect(
      countWorkspacePreviewModels([
        { type: "text" },
        { type: "text_to_image" },
        { type: "layer_canvas" },
        { type: "video_generation" }
      ] as never[])
    ).toBe(2);
  });

  it("keeps a single-node topology centered and bounds all normalized points", () => {
    const layout = normalizeWorkspaceTopology([
      { id: "single", position: { x: 200, y: 100 } }
    ] as never[]);
    expect(layout).toEqual([
      expect.objectContaining({ id: "single", x: 50, y: 50 })
    ]);
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
cd frontend && npx vitest run tests/aigc-workspace-preview.test.ts
```

Expected: FAIL because `@/lib/aigc/workspace-preview` does not yet exist.

- [ ] **Step 3: Implement the pure helper**

```ts
import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import type { AigcV2Node } from "@/lib/aigc/types";

export type WorkspacePreviewTone =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "neutral";

export type WorkspacePreviewPoint = {
  id: string;
  node: AigcV2Node;
  x: number;
  y: number;
};

const TONE_BY_PORT_TYPE = {
  audio_asset: "audio",
  image_asset: "image",
  subtitle_asset: "video",
  text: "text",
  video_asset: "video"
} as const;

export function getWorkspacePreviewNodeTone(
  node: AigcV2Node
): WorkspacePreviewTone {
  const outputType = AIGC_NODE_REGISTRY_BY_TYPE.get(node.type)?.outputs[0]?.type;
  return outputType && outputType in TONE_BY_PORT_TYPE
    ? TONE_BY_PORT_TYPE[outputType as keyof typeof TONE_BY_PORT_TYPE]
    : "neutral";
}

export function countWorkspacePreviewModels(nodes: AigcV2Node[]): number {
  return nodes.filter(
    (node) => AIGC_NODE_REGISTRY_BY_TYPE.get(node.type)?.category === "model"
  ).length;
}

export function normalizeWorkspaceTopology(
  nodes: AigcV2Node[]
): WorkspacePreviewPoint[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [{ id: nodes[0].id, node: nodes[0], x: 50, y: 50 }];
  }
  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(Math.max(...xs) - minX, 1);
  const height = Math.max(Math.max(...ys) - minY, 1);

  return nodes.map((node) => ({
    id: node.id,
    node,
    x: 12 + ((node.position.x - minX) / width) * 76,
    y: 16 + ((node.position.y - minY) / height) * 68
  }));
}
```

Keep the exact imports and types valid for the repository's `AigcV2Node` definition. If an output port is `image_layer`, `edited_layer`, or `layer_set`, map it to `image` in `TONE_BY_PORT_TYPE`; do not classify it as neutral.

- [ ] **Step 4: Run the helper tests and verify they pass**

Run:

```bash
cd frontend && npx vitest run tests/aigc-workspace-preview.test.ts
```

Expected: PASS with four tests.

- [ ] **Step 5: Commit the isolated helper**

```bash
git add frontend/lib/aigc/workspace-preview.ts frontend/tests/aigc-workspace-preview.test.ts
git commit -m "feat: add aigc workspace preview metadata"
```

### Task 2: Render the dark constellation workspace and dense cards

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx`
- Modify: `frontend/tests/aigc-workspace.test.tsx`

- [ ] **Step 1: Extend component tests before changing the presentation**

Add these tests to `frontend/tests/aigc-workspace.test.tsx`:

```ts
it("renders the constellation workspace shell and responsive card grid", () => {
  renderWorkspace();

  expect(screen.getByTestId("aigc-workspace")).toHaveClass(
    "bg-[#0b0f14]",
    "text-slate-100"
  );
  expect(screen.getByText("星图创作台")).toBeInTheDocument();
  expect(screen.getByText("1 个模板")).toBeInTheDocument();
  expect(screen.getByTestId("aigc-card-grid")).toHaveClass(
    "grid-cols-2",
    "md:grid-cols-4",
    "xl:grid-cols-5"
  );
});

it("renders preview metadata and a deterministic missing-description fallback", () => {
  renderWorkspace({
    initialTemplates: page([{ ...template, description: "" }])
  });

  expect(screen.getByText("未填写说明")).toBeInTheDocument();
  expect(screen.getByText("2 节点")).toBeInTheDocument();
  expect(screen.getByText("1 模型")).toBeInTheDocument();
  expect(screen.getByTestId("aigc-topology-preview")).toBeInTheDocument();
  expect(screen.getByTestId("aigc-preview-node-image")).toBeInTheDocument();
});
```

Keep every existing test. Update the existing five-column assertion to the approved breakpoints: `grid-cols-2`, `md:grid-cols-4`, and `xl:grid-cols-5`.

- [ ] **Step 2: Run the workspace tests and verify the new assertions fail**

Run:

```bash
cd frontend && npx vitest run tests/aigc-workspace.test.tsx
```

Expected: FAIL because the constellation shell selectors, heading, count label, fallback copy, and preview node selectors are absent.

- [ ] **Step 3: Update the component presentation without changing behavior**

In `frontend/components/workspace/aigc/aigc-workspace.tsx`:

1. Import `countWorkspacePreviewModels`, `getWorkspacePreviewNodeTone`, and `normalizeWorkspaceTopology` from the new helper.
2. Add `data-testid="aigc-workspace"` to `<main>` and use a locally scoped dark background:

```tsx
<main
  className="relative isolate w-full max-w-none overflow-hidden bg-[#0b0f14] px-3 py-6 text-slate-100 sm:px-4 sm:py-8 lg:px-5"
  data-testid="aigc-workspace"
>
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_12%_14%,rgba(66,153,255,0.18)_0_1px,transparent_1.5px),radial-gradient(circle_at_83%_20%,rgba(255,130,73,0.15)_0_1px,transparent_1.5px),linear-gradient(rgba(116,142,171,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(116,142,171,0.08)_1px,transparent_1px)] [background-size:auto,auto,36px_36px,36px_36px]"
  />
</main>
```

Wrap the existing `<header>`, controls `<section>`, error block, loading/list/empty branch, pagination, and both dialogs in one sibling `<div className="relative z-10">` after the decorative `<div>`. Do not move any callback, state declaration, query, mutation, or conditional branch outside its current owner.

3. Replace the current header copy with `星图创作台`, retain the English kicker, and render the current total as:

```tsx
<span className="font-mono text-xs text-slate-400">
  {activeData?.total ?? 0} 个{view === "templates" ? "模板" : "画布"}
</span>
```

4. Convert the view tabs, form controls, alerts, empty state, pagination, and dialogs to dark local utility classes. Keep all current roles, labels, callbacks, disabled conditions, dialog classes required by existing tests, and `Button` variants.
5. Change the card grid to:

```tsx
className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5"
```

6. In `AigcCard`, use `countWorkspacePreviewModels(normalized.nodes)` after migrating the definition once. Display `未填写说明` when the description is empty. Keep template edit links, delete-button accessible labels, status badges, and existing primary action strings unchanged.
7. In `TopologyPreview`, use `normalizeWorkspaceTopology(normalized.nodes)` and `getWorkspacePreviewNodeTone(node)`. Render each node with a stable selector and the approved color classes:

```tsx
const previewToneClasses = {
  audio: "border-pink-400/60 bg-pink-400/25 shadow-[0_0_14px_rgba(244,114,182,0.22)]",
  image: "border-emerald-400/60 bg-emerald-400/25 shadow-[0_0_14px_rgba(52,211,153,0.22)]",
  neutral: "border-slate-500/60 bg-slate-500/25",
  text: "border-sky-400/60 bg-sky-400/25 shadow-[0_0_14px_rgba(56,189,248,0.22)]",
  video: "border-orange-400/60 bg-orange-400/25 shadow-[0_0_14px_rgba(251,146,60,0.22)]"
} satisfies Record<WorkspacePreviewTone, string>;

<span
  className={cn(
    "absolute h-5 w-8 -translate-x-1/2 -translate-y-1/2 border",
    previewToneClasses[tone]
  )}
  data-testid={`aigc-preview-node-${tone}`}
  key={point.id}
  style={{ left: `${point.x}%`, top: `${point.y}%` }}
/>
```

8. Keep the preview SVG and background decorative-only with `aria-hidden="true"`. Do not add a visual-only action or any client state outside the existing state machine.

- [ ] **Step 4: Run workspace behavior and presentation tests**

Run:

```bash
cd frontend && npx vitest run tests/aigc-workspace.test.tsx tests/aigc-workspace-preview.test.ts
```

Expected: PASS. Existing template creation, filtering, instantiation, deletion, and pipeline navigation assertions must remain green.

- [ ] **Step 5: Run type and lint validation**

Run:

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit the presentation change**

```bash
git add frontend/components/workspace/aigc/aigc-workspace.tsx frontend/tests/aigc-workspace.test.tsx
git commit -m "feat: restyle aigc workspace as constellation desk"
```

Do not stage `frontend/lib/aigc/modality-colors.ts`; it is unrelated, pre-existing work.

### Task 3: Automate multi-viewport visual acceptance

**Files:**
- Create: `frontend/scripts/verify-aigc-workspace.mjs`
- Modify: `frontend/package.json`

- [ ] **Step 1: Write the Playwright verifier**

Create `frontend/scripts/verify-aigc-workspace.mjs` with these assertions:

```js
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const url = process.env.AIGC_WORKSPACE_URL;
if (!url) {
  throw new Error("AIGC_WORKSPACE_URL must point to a seeded /workspace/aigc page");
}

const artifactsPath =
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||
  "test-results/aigc-workspace";
const viewports = [
  { name: "desktop", width: 1440, height: 900, columns: 5 },
  { name: "tablet", width: 900, height: 1024, columns: 4 },
  { name: "mobile", width: 390, height: 844, columns: 2 }
];

await mkdir(artifactsPath, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByTestId("aigc-workspace").waitFor();
    await page.getByRole("tab", { name: "画布模板" }).waitFor();
    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}.png`
    });

    const measurements = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="aigc-workspace"]');
      const grid = document.querySelector('[data-testid="aigc-card-grid"]');
      const cards = [...document.querySelectorAll('[data-testid="aigc-card"]')];
      const firstRow = cards.filter(
        (card) =>
          card.getBoundingClientRect().top === cards[0]?.getBoundingClientRect().top
      );
      return {
        gridColumns: firstRow.length,
        rootWidth: root?.scrollWidth ?? 0,
        viewportWidth: document.documentElement.clientWidth,
        visibleCardCount: cards.length
      };
    });

    if (
      measurements.rootWidth > measurements.viewportWidth ||
      measurements.gridColumns !== viewport.columns ||
      measurements.visibleCardCount === 0 ||
      errors.length > 0
    ) {
      throw new Error(
        `${viewport.name}: ${JSON.stringify({ errors, measurements })}`
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
}
```

During Task 2, add `data-testid="aigc-card"` to each card `<article>` so this verifier has a stable, nonvisual selector.

- [ ] **Step 2: Add the package script**

Add this entry under `scripts` in `frontend/package.json`:

```json
"acceptance:aigc-workspace": "node scripts/verify-aigc-workspace.mjs"
```

- [ ] **Step 3: Run the verifier with a seeded local route**

Start the existing local backend and frontend using the repository's normal seeded AIGC setup. Then run:

```bash
cd frontend && AIGC_WORKSPACE_URL=http://localhost:3000/workspace/aigc npm run acceptance:aigc-workspace
```

Expected: exit `0`, with `desktop.png`, `tablet.png`, and `mobile.png` in `frontend/test-results/aigc-workspace/`. Confirm each screenshot shows the dark workbench, usable controls, no horizontal overflow, and a five/four/two card-column layout.

- [ ] **Step 4: Run the complete targeted validation**

Run:

```bash
cd frontend && npx vitest run tests/aigc-workspace.test.tsx tests/aigc-workspace-preview.test.ts && npm run typecheck && npm run lint
```

Expected: all commands exit `0`. Re-run `acceptance:aigc-workspace` after any visual correction.

- [ ] **Step 5: Commit the acceptance coverage**

```bash
git add frontend/scripts/verify-aigc-workspace.mjs frontend/package.json
git commit -m "test: verify aigc workspace responsive layout"
```

## Implementation Notes

- Keep `frontend/app/workspace/aigc/page.tsx` unchanged. Its initial parallel data loading and `parseAigcView` contract already meet the design.
- Do not modify APIs, backend models, global color mode, or the application shell. The dark presentation is scoped to the AIGC list main element.
- Preserve `data-testid="aigc-card-grid"` and all current accessible names because the behavior tests and assistive technology rely on them.
- The visual verifier requires seeded data because a grid-column count cannot be inferred from an empty state. Its explicit environment variable makes that dependency visible rather than silently passing against an empty workspace.
