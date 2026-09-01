# Tasks

- [x] Task 1: 为 `ImageCanvasEditor` 增加 `variant` 页面形态。
  - [x] SubTask 1.1: 在 `image-canvas-editor.tsx` 的 props 增加 `variant?: "dialog" | "page"`（默认 `"dialog"`），不改动现有编辑逻辑与内部结构。
  - [x] SubTask 1.2: 抽出编辑器主体（header + 工具栏 + 三栏内容）为可复用内容片段；`variant="dialog"` 时按原样包裹 `Dialog`/`DialogContent`，`variant="page"` 时改为无遮罩、无圆角的页面级容器（`h-[calc(100dvh-4rem)]`/铺满、`rounded-none`、无外留白），并渲染等效关闭控件（`aria-label="关闭"`，点击调用 `onOpenChange(false)`）。
  - [x] SubTask 1.3: 保持“查看原图”预览与其它交互不变；确认 `variant="page"` 下无 `DialogOverlay` 遮罩。

- [x] Task 2: 画布页启用页面形态并铺满去留白。
  - [x] SubTask 2.1: 在 `image-canvas-page.tsx` 给 `ImageCanvasEditor` 传 `variant="page"`。
  - [x] SubTask 2.2: 调整 `main` 容器铺满正文区（去除产生留白的内边距/容器居中），保持关闭返回、图层拆分跳转、任务轮询逻辑不变。

- [x] Task 3: 测试与验证。
  - [x] SubTask 3.1: 更新 `tests/image-canvas-page.test.tsx`：断言页面不含弹窗遮罩、编辑器内联铺满、关闭控件仍触发 `router.back()`；沿用既有导航/生成/图层用例。
  - [x] SubTask 3.2: 确认 `tests/image-canvas-editor.test.tsx`（默认弹窗形态）仍通过；必要时补充 `variant="page"` 的渲染断言。
  - [x] SubTask 3.3: 运行前端 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`，全部通过。

# Task Dependencies

- Task 2 依赖 Task 1（页面形态开关就绪后画布页才能启用）。
- Task 3 依赖 Task 1、Task 2。
