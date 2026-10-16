# 画布列表卡片信息精简 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除画布列表卡片的描述、节点与模型统计及底部主按钮，只保留更新时间，同时保持缩略图、标题和管理操作可用。

**Architecture:** 仅调整 `AigcCard` 的呈现与对应组件测试，不改变数据模型、查询、分页或路由。缩略图和标题继续调用既有 `onOpen`，只读模板的缩略图无障碍名称按权限显示“查看模板”。

**Tech Stack:** React 19、Next.js、TypeScript、Tailwind CSS、Vitest、Testing Library、Playwright

---

## File Structure

- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx`
  - 精简 `AigcCard` 元数据区，清理不再使用的图标和模型统计依赖。
- Modify: `frontend/tests/aigc-workspace.test.tsx`
  - 固化精简后的渲染、更新时间和打开入口行为。

### Task 1: 固化紧凑卡片行为

**Files:**
- Modify: `frontend/tests/aigc-workspace.test.tsx:170-190`
- Modify: `frontend/tests/aigc-workspace.test.tsx:257-268`

- [ ] **Step 1: 更新只读模板入口测试**

将只读模板测试改为点击缩略图主入口，并继续验证不会实例化模板：

```tsx
const viewTemplate = screen.getByRole("button", {
  name: "查看模板：商品主图模板"
});
expect(viewTemplate).toBeInTheDocument();

fireEvent.click(viewTemplate);
expect(apiMocks.instantiateAigcTemplate).not.toHaveBeenCalled();
expect(navigationMocks.push).toHaveBeenCalledWith(
  "/workspace/aigc/templates/template-1"
);
```

- [ ] **Step 2: 将元数据测试改为紧凑卡片断言**

用更新时间保留和冗余内容移除断言替换旧描述与统计断言：

```tsx
it("renders only the updated time below the card title", () => {
  renderWorkspace({
    initialTemplates: page([{ ...template, description: "" }])
  });

  expect(screen.getByText(/更新于/)).toBeInTheDocument();
  expect(screen.queryByText("未填写说明")).toBeNull();
  expect(screen.queryByText(/2 节点/)).toBeNull();
  expect(screen.queryByText(/1 模型/)).toBeNull();
  expect(screen.queryByRole("button", { name: "使用模板" })).toBeNull();
  expect(screen.getByTestId("aigc-topology-preview")).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行定向测试并确认失败**

Run:

```bash
cd frontend
npx vitest run tests/aigc-workspace.test.tsx
```

Expected: FAIL；仍能找到“未填写说明”、节点/模型统计或底部“使用模板”按钮，且只读缩略图仍名为“使用模板”。

- [ ] **Step 4: 提交测试基线**

```bash
git add frontend/tests/aigc-workspace.test.tsx
git commit -m "test(aigc): define compact canvas card behavior"
```

### Task 2: 精简画布卡片

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx:4-50`
- Modify: `frontend/components/workspace/aigc/aigc-workspace.tsx:570-715`

- [ ] **Step 1: 清理不再使用的依赖**

从 Lucide 导入中删除 `ArrowRight` 和 `GitFork`，并从
`@/lib/aigc/workspace-preview` 的分组导入中删除
`countWorkspacePreviewModels`。保留同组的
`getWorkspacePreviewNodeTone`、`normalizeWorkspaceTopology` 和
`WorkspacePreviewTone`，它们仍供拓扑预览使用。

```tsx
import {
  getWorkspacePreviewNodeTone,
  normalizeWorkspaceTopology,
  type WorkspacePreviewTone
} from "@/lib/aigc/workspace-preview";
```

删除 `AigcCard` 中不再需要的：

```tsx
const modelCount = countWorkspacePreviewModels(normalizedDefinition.nodes);
```

- [ ] **Step 2: 修正主入口无障碍名称**

在 `AigcCard` 中计算入口动作：

```tsx
const openAction =
  kind === "template"
    ? canWrite
      ? "使用模板"
      : "查看模板"
    : "打开画布";
```

缩略图按钮使用该动作：

```tsx
aria-label={`${openAction}：${item.name}`}
```

- [ ] **Step 3: 用更新时间替换卡片底部内容**

删除描述、节点与模型统计以及底部 `Button`，在标题行后保留：

```tsx
<time
  className="mt-2 block text-xs text-slate-500"
  dateTime={item.updated_at}
  suppressHydrationWarning
>
  更新于 {formatDate(item.updated_at)}
</time>
```

保留现有标题按钮、状态、模板编辑、缩略图选择和删除操作。

- [ ] **Step 4: 运行定向测试**

Run:

```bash
cd frontend
npx vitest run tests/aigc-workspace.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 运行静态检查**

Run:

```bash
cd frontend
npm run lint
npx tsc --noEmit
```

Expected: 两条命令均退出码 0，无未使用导入和类型错误。

- [ ] **Step 6: 提交实现**

```bash
git add frontend/components/workspace/aigc/aigc-workspace.tsx
git commit -m "refactor(aigc): simplify canvas list cards"
```

### Task 3: 回归与视觉验收

**Files:**
- Verify: `frontend/components/workspace/aigc/aigc-workspace.tsx`
- Verify: `frontend/tests/aigc-workspace.test.tsx`

- [ ] **Step 1: 运行前端测试**

Run:

```bash
cd frontend
npm test -- --run
```

Expected: 全部前端测试通过。

- [ ] **Step 2: 运行生产构建**

Run:

```bash
cd frontend
npm run build
```

Expected: Next.js 生产构建成功。

- [ ] **Step 3: 多视口检查**

使用本地 HTTPS 服务检查 `/workspace/aigc?view=pipelines` 和模板视图，视口为 `1440x1000`、`768x1024`、`390x844`。确认：

- 卡片标题下方只有更新时间。
- 缩略图和标题可进入画布或模板。
- 状态、缩略图选择、编辑及删除按钮无重叠。
- 卡片网格仍为桌面四列、平板两列、移动端一列。

- [ ] **Step 4: 检查工作树和差异**

Run:

```bash
git diff --check
git status --short
```

Expected: 无空白错误；只包含计划内文件或用户已有改动。
