# AIGC Pane Click Dismisses Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点击 AIGC 画布空白区域时，取消节点选择并关闭任意标签状态下的右侧详情栏。

**Architecture:** 保持面板状态位于 `AigcEditorContent` 本地 React 状态。将 React Flow 的 `onPaneClick` 统一绑定到一个同时调用 `selectNode(null)` 和 `setOpenPanel(null)` 的回调，不修改 Zustand store、Pipeline definition 或自动保存契约。

**Tech Stack:** React 19、TypeScript、React Flow、Vitest、Testing Library、Playwright

---

### Task 1: 固化空白点击关闭契约

**Files:**
- Modify: `frontend/tests/aigc-editor.test.tsx`

- [x] **Step 1: 将旧的运行标签保留断言改为关闭断言**

在现有桌面工作台测试中，打开“运行”标签后点击 `点击画布空白`，断言 `aigc-inspector` 不存在：

```tsx
fireEvent.click(screen.getByRole("button", { name: "点击画布空白" }));
expect(screen.queryByTestId("aigc-inspector")).toBeNull();
```

- [x] **Step 2: 覆盖配置、运行和结果标签**

依次通过节点点击或顶部详情入口打开详情栏，切换至目标标签，点击画布空白并断言详情栏关闭。最后再次点击节点，断言详情栏重新打开且“配置”标签被选中。

- [x] **Step 3: 运行测试并确认失败**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: FAIL，当前 `onPaneClick` 只取消节点选择，不关闭 `openPanel`。

### Task 2: 实现统一关闭行为

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`

- [x] **Step 1: 增加空白点击回调**

在 `AigcEditorContent` 中增加：

```tsx
const dismissInspectorFromPane = useCallback(() => {
  selectNode(null);
  setOpenPanel(null);
}, [selectNode]);
```

- [x] **Step 2: 绑定 React Flow**

将 `reactFlowProps.onPaneClick` 改为 `dismissInspectorFromPane`。不得重置 `inspectorTab` 或 `selectedRunId`。

- [x] **Step 3: 运行定向测试**

Run:

```bash
cd frontend && npm test -- tests/aigc-editor.test.tsx
```

Expected: PASS。

### Task 3: 浏览器与工程回归

**Files:**
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [x] **Step 1: 增加空白点击关闭详情栏的浏览器断言**

在桌面和窄屏流程中打开详情栏后点击 `.react-flow__pane` 的安全空白位置，断言 `aigc-inspector` 隐藏；不得点击节点、连接线或工具坞。

- [x] **Step 2: 运行工程检查**

Run:

```bash
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 所有命令退出码为 0。

- [x] **Step 3: 运行四视口验收**

Run:

```bash
cd frontend
AIGC_WORKBENCH_FIXTURE="$(node scripts/create-aigc-acceptance-fixture.mjs --json)" \
  npm run acceptance:aigc-workbench
```

Expected: `result: PASS`，桌面、1024px、平板和移动端均通过。
