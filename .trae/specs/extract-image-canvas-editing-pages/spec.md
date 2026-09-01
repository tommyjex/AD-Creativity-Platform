# 图片项目画布编辑独立成页 Spec

## Why
当前图片项目的「进入画布」和「图层编辑器」都是叠加在 `/workspace/projects` 详情上的全屏对话框，URL 不变、无法直达或分享，且编排逻辑与只读详情高度耦合。用户希望把画布编辑拆成拥有真实路由的独立页面，功能先保持不变，为后续演进打基础。

## What Changes
- 新增两条真实路由（可通过 URL 直达/刷新/分享）：
  - `app/projects/[projectId]/canvas/page.tsx`：图片画布编辑页（承载 `ImageCanvasEditor` 的全部编排）。
  - `app/projects/[projectId]/canvas/layers/[layerSetId]/page.tsx`：图层编辑页（承载 `LayerEditorDialog`）。
- 把当前位于 `ImageProjectReadOnlyDetail` 内的画布编排（目标图/参考图/候选图计算、提交编辑、上传/移除参考图、设为目标图、图层拆分与轮询等）迁移到新的画布页客户端组件。
- 图片项目详情中的「进入画布」按钮由打开对话框改为**导航到画布路由**（**BREAKING**：详情页不再内联渲染画布/图层对话框）。
- 画布内的「图层拆分」（含已存在图层集直达、拆分任务完成后打开）由内联打开 `LayerEditorDialog` 改为**导航到图层编辑路由**。
- 编辑器组件 `ImageCanvasEditor`、`LayerEditorDialog`、`LayerDecomposeDialog` 的**交互与功能保持不变**；仅改变它们的挂载位置（由页面路由承载，`open` 恒为 true，关闭时改为路由返回）。

## 非目标（Out of Scope）
- 不改变任何编辑功能、模型调用、参数、校验或后端契约。
- 不改造 `/workspace/projects` 的项目选择机制（仍用组件 state 选中）。
- 不把对话框外壳（Dialog/遮罩）重写为原生页面外壳——保留现有全屏对话框外观，仅使其拥有独立路由。

## Impact
- 影响能力：图片项目画布编辑、图层编辑、图片项目详情入口。
- 影响代码：
  - 新增 `frontend/app/projects/[projectId]/canvas/page.tsx`、`.../canvas/loading.tsx`
  - 新增 `frontend/app/projects/[projectId]/canvas/layers/[layerSetId]/page.tsx`、同级 `loading.tsx`
  - 新增 `frontend/components/workspace/image-canvas-page.tsx`（画布编排客户端组件）
  - 新增 `frontend/components/workspace/layer-editor-page.tsx`（图层编辑客户端包装组件）
  - 修改 `frontend/components/workspace/image-project-read-only-detail.tsx`（入口改导航、移除内联编辑对话框与其编排）
  - 测试：更新 `tests/image-project-read-only-detail.test.tsx`；新增画布页/图层页测试
- 数据预取：画布页服务端 `createApiClient().getProject(projectId)`；图层页服务端 `getImageLayerSet(projectId, layerSetId)`，沿用 `app/projects/[projectId]/page.tsx` 既有范式。

## ADDED Requirements

### Requirement: 图片画布编辑独立页面
系统 SHALL 提供 `/(projects)/[projectId]/canvas` 路由，作为承载图片画布编辑（`ImageCanvasEditor`）的独立页面，并在服务端预取项目数据后渲染，功能与原对话框一致。

#### Scenario: 直达画布编辑页
- **WHEN** 用户访问 `/projects/{projectId}/canvas`
- **THEN** 页面在服务端加载该项目并渲染画布编辑界面（目标图、参考图区、指令面板、分辨率/格式选择、图层拆分入口），交互与原「进入画布」对话框完全一致

#### Scenario: 关闭画布返回项目
- **WHEN** 用户在画布页触发关闭
- **THEN** 系统导航回上一页（项目详情/列表），不再以对话框叠加形式存在

#### Scenario: 项目不存在
- **WHEN** `projectId` 不存在或加载失败
- **THEN** 页面按既有范式返回未找到/错误提示，不抛出未捕获异常

### Requirement: 图层编辑独立页面
系统 SHALL 提供 `/(projects)/[projectId]/canvas/layers/[layerSetId]` 路由，作为承载图层编辑（`LayerEditorDialog`）的独立页面，服务端预取图层集后渲染，功能与原对话框一致。

#### Scenario: 直达图层编辑页
- **WHEN** 用户访问 `/projects/{projectId}/canvas/layers/{layerSetId}`
- **THEN** 页面在服务端加载对应 `ImageLayerSetDetail` 并渲染图层编辑界面（拖拽、等比缩放、层级、显隐、保存、导出、AI 替换图层内容），交互与原图层编辑对话框完全一致

#### Scenario: 有未保存改动时关闭
- **WHEN** 用户在存在未保存图层改动时触发关闭
- **THEN** 系统沿用既有二次确认逻辑，确认后导航返回画布页；取消则停留

### Requirement: 画布到图层编辑的路由跳转
系统 SHALL 在画布页发起图层拆分或命中已存在图层集时，导航到对应的图层编辑路由，而非内联打开对话框。

#### Scenario: 目标图已存在图层集
- **WHEN** 用户在画布页点击「图层拆分」且该目标图已有图层集
- **THEN** 系统直接导航到该图层集的图层编辑页

#### Scenario: 图层拆分任务完成
- **WHEN** 图层拆分任务成功生成新的图层集
- **THEN** 系统导航到新图层集的图层编辑页，并保留原有任务反馈提示

## MODIFIED Requirements

### Requirement: 图片项目详情入口
图片项目只读详情页 SHALL 保留只读信息展示（Brief、提示词、参考图、版本），并将「进入画布」按钮改为跳转到画布编辑路由；详情页不再内联渲染 `ImageCanvasEditor` / `LayerDecomposeDialog` / `LayerEditorDialog`。

#### Scenario: 从详情进入画布
- **WHEN** 用户在图片项目详情点击「进入画布」
- **THEN** 系统导航到 `/projects/{project.id}/canvas`，只读详情内容保持不变
