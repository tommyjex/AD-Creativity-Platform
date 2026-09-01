# Tasks

- [x] Task 1: 搭建画布编辑独立路由与编排组件。
  - [x] SubTask 1.1: 新增 `app/projects/[projectId]/canvas/page.tsx`（async server component），沿用既有范式用 `createApiClient().getProject(projectId)` 预取，404 走 `notFound()`，加载失败渲染错误块，并新增同级 `loading.tsx`。
  - [x] SubTask 1.2: 新增客户端组件 `components/workspace/image-canvas-page.tsx`，把 `ImageProjectReadOnlyDetail` 中与画布相关的 state 与函数（目标图/参考图/候选图计算、`handleCanvasSubmit`、`generateFirstImage`、`handleReferenceFiles`、`handleSetReferenceAsTarget`、`handleSelectCanvasTarget`、`handleRemoveReference`、activeTask 轮询、layerTask 轮询、layerSets 加载）原样迁入，功能保持不变。
  - [x] SubTask 1.3: 将 `ImageCanvasEditor` 挂载改为页面级：`open` 恒为 true，`onOpenChange(false)` 改为 `router.back()`（或回退到 `/workspace/projects`），保留 `LayerDecomposeDialog` 的内联渲染。

- [x] Task 2: 搭建图层编辑独立路由与包装组件。
  - [x] SubTask 2.1: 新增 `app/projects/[projectId]/canvas/layers/[layerSetId]/page.tsx`（async server component），用 `createApiClient().getImageLayerSet(projectId, layerSetId)` 预取，缺失走 `notFound()`，并新增同级 `loading.tsx`。
  - [x] SubTask 2.2: 新增客户端组件 `components/workspace/layer-editor-page.tsx`，包裹现有 `LayerEditorDialog`：`open` 恒为 true，`onOpenChange(false)` 改为导航回 `/projects/{projectId}/canvas`；`onLayerSetChange` 可保留为本地无副作用回调（功能不变）。

- [x] Task 3: 画布到图层编辑改为路由跳转。
  - [x] SubTask 3.1: 在画布页把 `handleLayerDecomposeFromCanvas` 命中已存在图层集的分支由 `setEditorSet` 改为 `router.push` 到图层编辑路由。
  - [x] SubTask 3.2: 把图层拆分任务成功后的 `setEditorSet(created)` 改为 `router.push` 到新图层集路由，保留任务反馈提示文案。

- [x] Task 4: 改造图片项目详情入口。
  - [x] SubTask 4.1: 在 `image-project-read-only-detail.tsx` 中把「进入画布」按钮改为使用 `Link`/`router.push` 跳转到 `/projects/{project.id}/canvas`。
  - [x] SubTask 4.2: 移除详情页内联渲染的 `ImageCanvasEditor`、`LayerDecomposeDialog`、`LayerEditorDialog` 及其专属 state/编排（迁移到画布页后清理未用 import 与死代码），保留只读信息展示与版本/参考图加载。

- [x] Task 5: 测试与验证。
  - [x] SubTask 5.1: 更新 `tests/image-project-read-only-detail.test.tsx`，断言「进入画布」为导航链接、详情不再挂载编辑对话框。
  - [x] SubTask 5.2: 新增/复用画布页与图层页的组件测试（沿用 `image-canvas-editor.test.tsx`、`layer-editor-dialog.test.tsx` 已有断言，验证关闭改为路由返回、跳转到图层路由）。
  - [x] SubTask 5.3: 运行前端 `npm run lint`、`typecheck`、相关 `vitest` 与 `build`，全部通过。

# Task Dependencies

- Task 2 依赖 Task 1（画布页跳转目标为图层路由）。
- Task 3 依赖 Task 1、Task 2。
- Task 4 依赖 Task 1（编排已迁出后方可清理详情页）。
- Task 5 依赖 Task 1-4。
