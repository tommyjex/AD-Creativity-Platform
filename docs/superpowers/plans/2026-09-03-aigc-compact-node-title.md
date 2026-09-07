# AIGC Compact Node Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AIGC 节点浅色标题栏改为仅显示名称的无底色紧凑标题行。

**Architecture:** 只调整 `AigcFlowNodeCard` 的标题区域，不改变节点主体、端口、尺寸、运行状态或数据契约。删除改用 React Flow 已有键盘行为，下载和精准编辑入口改为按需显现。

**Tech Stack:** React 19、TypeScript、Tailwind CSS、React Flow、Vitest、Playwright

---

### Task 1: 固定标题行视觉与交互契约

**Files:**
- Modify: `frontend/tests/aigc-flow-node.test.tsx`

- [x] 将模态测试改为只验证节点外框颜色。
- [x] 断言标题行高度为 28px、无背景、无底部边框且不显示类型图标。
- [x] 断言节点不再渲染删除按钮，下载和精准编辑入口仍存在。
- [x] 运行 `cd frontend && npm test -- tests/aigc-flow-node.test.tsx` 并确认测试先失败。

### Task 2: 实现紧凑标题行

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`

- [x] 移除标题背景、分隔线、类型图标与删除按钮。
- [x] 将标题行调整为 `h-7 px-2.5`，保留名称截断和拖拽行为。
- [x] 将下载与精准编辑入口设置为悬停或键盘聚焦时显示。
- [x] 清理不再使用的图标、store selector 和 `nodeIcon` 辅助函数。
- [x] 运行节点定向测试并确认通过。

### Task 3: 回归与视觉验收

**Files:**
- Modify if needed: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [x] 运行 `npm test`、`npm run typecheck`、`npm run lint` 和 `npm run build`。
- [x] 运行 AIGC 工作台 Playwright 验收。
- [x] 检查桌面与移动截图，确认标题行无浅色块且无内容重叠。

### Task 4: 缩小标题并移除节点底栏

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Modify: `frontend/tests/aigc-flow-node.test.tsx`
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [x] 将标题文本改为 `text-[11px] font-medium`。
- [x] 删除显示类型/状态和节点 ID 的 28px 底栏。
- [x] 更新单测与 Playwright 断言，固定标题字号并确认底栏不存在。
- [x] 运行前端全量测试、类型检查、Lint、构建和四视口验收。
