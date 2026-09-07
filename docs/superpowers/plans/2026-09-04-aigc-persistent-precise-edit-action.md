# AIGC Persistent Precise Edit Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让图片输入节点的精准编辑按钮始终可见，同时保持下载按钮仅在标题栏悬停或聚焦时显示。

**Architecture:** 保持 `AigcPreciseEditDialog` 的按钮、禁用条件和弹窗逻辑不变，只在 `AigcFlowNode` 标题栏中拆分常驻操作与按需操作的可见性容器。测试直接约束 Tailwind 可见性类，避免 jsdom 无法计算悬停样式的问题。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、Vitest、Testing Library

---

### Task 1: 固化精准编辑按钮的常驻可见性

**Files:**
- Modify: `frontend/tests/aigc-flow-node.test.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx:369-393`

- [x] **Step 1: 写无图片状态的失败测试**

在 `frontend/tests/aigc-flow-node.test.tsx` 增加用例，渲染未绑定资产的图片输入节点，验证按钮保持可见但禁用，其直接操作容器没有隐藏类：

```tsx
it("keeps precise editing visible and disabled before an image is selected", () => {
  renderNode({
    id: "input-image",
    type: "image_input",
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 },
    config: { asset_id: null, bbox: null, bbox_asset_id: null }
  });

  const preciseEdit = screen.getByRole("button", {
    name: "精准编辑：图片输入"
  });
  expect(preciseEdit).toBeDisabled();
  expect(preciseEdit.parentElement).not.toHaveClass("opacity-0");
});
```

- [x] **Step 2: 扩展下载按钮的显隐测试**

在现有图片输出下载测试中补充：

```tsx
expect(download.parentElement).toHaveClass(
  "opacity-0",
  "group-hover/title:opacity-100",
  "group-focus-within/title:opacity-100"
);
```

- [x] **Step 3: 运行测试并确认失败**

Run:

```bash
cd frontend && npm test -- tests/aigc-flow-node.test.tsx
```

Expected: 精准编辑可见性断言失败，因为其父容器仍包含 `opacity-0`。

- [x] **Step 4: 拆分标题栏操作容器**

将输出下载操作包裹在独立的悬停容器中，并让精准编辑按钮直接位于常驻操作容器：

```tsx
<div className="nodrag flex shrink-0 items-center gap-0.5">
  {outputDownload ? (
    <div className="opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-within/title:opacity-100">
      <a
        aria-label={`下载${data.node.type === "video_output" ? "视频" : "图片"}：${outputTitle}`}
        className="nodrag grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-card hover:text-foreground"
        download={outputDownload.filename}
        href={outputDownload.url}
        onClick={(event) => event.stopPropagation()}
        title={`下载${data.node.type === "video_output" ? "视频" : "图片"}`}
      >
        <Download className="h-3.5 w-3.5" />
      </a>
    </div>
  ) : null}
  {data.node.type === "image_input" ? (
    <AigcPreciseEditDialog
      asset={inputAsset}
      node={data.node}
      url={inputAsset ? getSafePreviewUrl(inputAsset) : null}
    />
  ) : null}
</div>
```

- [x] **Step 5: 运行定向测试**

Run:

```bash
cd frontend && npm test -- tests/aigc-flow-node.test.tsx
```

Expected: PASS。

### Task 2: 完成前端静态验证

**Files:**
- Verify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Verify: `frontend/tests/aigc-flow-node.test.tsx`

- [x] **Step 1: 运行 TypeScript 检查**

Run:

```bash
cd frontend && npm run typecheck
```

Expected: 退出码为 0。

- [x] **Step 2: 运行 ESLint**

Run:

```bash
cd frontend && npm run lint
```

Expected: 退出码为 0，且无 warning。

- [x] **Step 3: 检查变更范围**

Run:

```bash
git diff --check -- frontend/components/workspace/aigc/aigc-flow-node.tsx frontend/tests/aigc-flow-node.test.tsx
```

Expected: 退出码为 0。
