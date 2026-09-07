# AIGC Dark Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AIGC 编辑器切换为层级黑灰画布，并将 Pipeline 顶部栏精简为返回、详情、另存为模板和执行。

**Architecture:** 深色样式通过 `AigcEditorContent` 的局部容器和 `NodeCanvas` 可选类名注入，不修改全局主题。现有面板状态、自动保存协调器、运行流程和模板能力保持原有数据契约。

**Tech Stack:** React 19、Next.js 16、TypeScript、Tailwind CSS、React Flow、Lucide React、Vitest、Playwright

---

### Task 1: 固定深色外壳与顶部命令契约

**Files:**
- Modify: `frontend/tests/aigc-editor.test.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`

- [x] 写测试，断言 Pipeline 顶部只有返回、详情、另存为模板和执行，模板顶部只有返回和详情。
- [x] 写测试，断言编辑器、顶部栏、节点库、详情栏和画布带有 AIGC 局部深色样式。
- [x] 运行 `cd frontend && npm test -- tests/aigc-editor.test.tsx`，确认测试先失败。
- [x] 移除顶部撤销、重做、运行记录、标题与视觉自动保存 Badge，保留自动保存屏幕阅读器播报。
- [x] 为 AIGC 外壳、顶部栏、节点库和详情栏添加方案 B 的层级黑灰样式。
- [x] 运行定向测试并确认通过。

### Task 2: 为共享画布增加局部样式入口

**Files:**
- Modify: `frontend/components/workspace/canvas/node-canvas.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/tests/node-canvas.test.tsx`
- Modify: `frontend/tests/aigc-editor.test.tsx`

- [x] 为 `NodeCanvas` 增加可选 `className`，默认不改变其他画布。
- [x] 在 AIGC 编辑器传入近黑背景、灰色点阵和深色 Controls 样式。
- [x] 更新测试，验证默认共享画布不带 AIGC 深色类，AIGC 画布带局部深色类。
- [x] 运行 `cd frontend && npm test -- tests/node-canvas.test.tsx tests/aigc-editor.test.tsx`。

### Task 3: 更新浏览器验收并完成工程检查

**Files:**
- Modify: `frontend/scripts/verify-aigc-workbench-layout.mjs`

- [x] 更新 Playwright 断言：不再寻找运行记录按钮，改为通过详情进入运行标签。
- [x] 断言四个视口中的画布背景为近黑色、顶部命令不溢出。
- [x] 运行 `npm test`、`npm run typecheck`、`npm run lint` 和 `npm run build`。
- [x] 复用本地前后端运行四视口 Playwright 验收并检查截图。
