# 画布编辑页去弹窗满屏 Spec

## Why
`/projects/{projectId}/canvas` 虽已是独立路由，但画布编辑器仍以 Radix `Dialog`（含遮罩、浮层卡片、模态焦点陷阱，并 portal 到 `body` 覆盖顶部导航）形式渲染，看起来仍是“弹窗”，且四周有弹窗外观留白。用户希望在这个独立页面上，画布编辑直接布满页面正文区域、四周无留白，不再是弹窗。

## What Changes
- 为 `ImageCanvasEditor` 增加渲染形态开关 `variant?: "dialog" | "page"`，默认 `"dialog"`，保持既有弹窗用法不变。
- 当 `variant="page"` 时：不再包裹 `Dialog` / `DialogOverlay`，去掉遮罩、浮层卡片圆角与模态行为；编辑器作为普通页内元素，铺满页面正文区（顶部固定导航下方），四周无留白。
- 页内形态仍提供一个关闭控件（`aria-label="关闭"`），点击调用 `onOpenChange(false)`，沿用现有“返回上一页”逻辑。
- `image-canvas-page.tsx` 传入 `variant="page"`，并让编辑器铺满 `main`（去除会产生留白的内边距/居中），保持既有的关闭返回与图层拆分跳转逻辑不变。
- 画布内“查看原图”预览仍保留为独立弹窗（它本就是临时浮层），`LayerDecomposeDialog` 参数弹窗保持不变。
- **BREAKING**（仅限画布页内呈现方式）：画布编辑页不再以模态弹窗/遮罩形式出现，而是页面级布局。

## 非目标（Out of Scope）
- 不改变任何画布编辑功能、模型调用、参数、校验、任务轮询或后端契约。
- 不改动 `image-project-workspace.tsx` 中以弹窗方式打开画布编辑的用法（继续走默认 `variant="dialog"`）。
- 不改动图层编辑页（`/canvas/layers/[layerSetId]`）的弹窗呈现（本次仅针对画布页）。

## Impact
- 影响能力：图片项目画布编辑页呈现方式。
- 影响代码：
  - 修改 `frontend/components/workspace/image-canvas-editor.tsx`（新增 `variant`，页内形态渲染分支与关闭控件）。
  - 修改 `frontend/components/workspace/image-canvas-page.tsx`（传 `variant="page"`，铺满正文、去留白）。
  - 测试：更新/新增 `tests/image-canvas-page.test.tsx` 断言（无弹窗遮罩、铺满、关闭仍可用）；保持 `tests/image-canvas-editor.test.tsx`（默认弹窗形态）通过。

## ADDED Requirements

### Requirement: 画布编辑页满屏内联呈现
系统 SHALL 在 `/projects/{projectId}/canvas` 页面以页面级内联布局渲染画布编辑器，铺满顶部导航下方的正文区域，四周无留白，且不以模态弹窗/遮罩形式呈现。

#### Scenario: 直达画布页为满屏页面
- **WHEN** 用户访问 `/projects/{projectId}/canvas`
- **THEN** 画布编辑器作为页面正文内联渲染，铺满可用区域、四周无留白，页面上不存在弹窗遮罩层

#### Scenario: 页内关闭返回上一页
- **WHEN** 用户在画布页点击关闭控件（`aria-label="关闭"`）
- **THEN** 系统调用关闭回调并导航回上一页，交互与原弹窗关闭一致

#### Scenario: 编辑功能保持不变
- **WHEN** 用户在满屏画布页进行生成/编辑/上传参考图/设为目标图/图层拆分等操作
- **THEN** 所有功能、参数与任务反馈与改造前完全一致

## MODIFIED Requirements

### Requirement: 画布编辑器渲染形态
`ImageCanvasEditor` SHALL 支持 `variant`（`"dialog"` 默认 / `"page"`）：默认沿用现有全屏对话框（含遮罩、圆角、模态、内建关闭按钮）；`"page"` 形态下以无遮罩、无浮层圆角的页面级容器渲染，并提供等效关闭控件；两种形态的编辑功能完全一致。

#### Scenario: 默认弹窗形态不受影响
- **WHEN** 其他入口（如 `image-project-workspace.tsx`）以默认形态使用 `ImageCanvasEditor`
- **THEN** 仍表现为原有全屏对话框，行为与外观不变
