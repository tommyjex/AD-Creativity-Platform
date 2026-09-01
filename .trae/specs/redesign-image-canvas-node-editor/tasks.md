# Tasks

> 本次为设计方案阶段。以下任务面向后续 apply 实现，按依赖顺序排列；apply 前需先获批。

- [x] Task 1: 画布布局数据模型与后端接口（持久化基础）。
  - [x] SubTask 1.1: 设计画布布局 schema：节点集合（`type: "reference" | "output"`、`id`、`x`、`y`、`width`、`height`、`z`）、参考图节点（`asset_id`、`order_index`、`bbox_normalized?`）、输出节点（`asset_id?`、`task_id?`、`source`）、文档级 `revision`。
  - [x] SubTask 1.2: 后端新增布局仓储与服务：读取（无则返回默认空布局）、保存（`expected_revision` 乐观锁，冲突返回 409/领域错误）。
  - [x] SubTask 1.3: 后端新增路由 `GET /projects/{project_id}/canvas-layout` 与 `PUT /projects/{project_id}/canvas-layout`，复用既有鉴权与项目校验。
  - [x] SubTask 1.4: 后端 pytest 覆盖读取默认空布局、保存回读、revision 递增、冲突不覆盖。

- [x] Task 2: 前端类型与 API 客户端 + 画布库接入。
  - [x] SubTask 2.1: 在 `lib/api-types.ts` 新增画布布局相关类型，`lib/api-client.ts` 新增 `getCanvasLayout` / `saveCanvasLayout`。
  - [x] SubTask 2.2: 引入 `@xyflow/react` 依赖并完成基础画布容器（平移/缩放/自定义节点注册），铺满正文区、四周无留白。
  - [x] SubTask 2.3: 画布页服务端并行预取项目与画布布局；新增 `loading.tsx` 骨架保持既有风格。

- [x] Task 3: 参考图节点。
  - [x] SubTask 3.1: 抽取现有 `BboxCanvas` 为可在节点内复用的框选组件（归一化坐标、保持宽高比）。
  - [x] SubTask 3.2: 实现参考图节点：本地上传（复用既有上传链路）与「从资产库添加」（复用资产库选择器）、编号「图N」、拖拽/缩放（保持宽高比）、二次确认删除（不删原始资产）。
  - [x] SubTask 3.3: 节点内框选提取 `bbox` 后，自动向右侧提示词编辑器写入不可篡改的区域引用；清除/删除时同步移除引用。

- [x] Task 4: 输出节点。
  - [x] SubTask 4.1: 实现输出节点：任务进行中状态与轮询、成功后展示图片（保持宽高比）。
  - [x] SubTask 4.2: 输出节点操作：下载、查看原图、设为参考图（新增参考图节点）、图层拆分入口（跳转 `/canvas/layers/{layerSetId}`）。

- [x] Task 5: 固定右侧停靠面板。
  - [x] SubTask 5.1: 抽取/复用 `VisualPromptEditor` 与配置项（画幅/分辨率/格式），置于固定右侧 dock，平移缩放画布时保持固定。
  - [x] SubTask 5.2: 生成模式判定（有参考图区域→参考图生图，否则文生图）、校验与禁用提示、提交后在画布创建输出节点。

- [x] Task 6: 布局持久化编排与并发保护。
  - [x] SubTask 6.1: 前端将节点增删/拖拽/缩放/框选变更以防抖聚合，携带 `expected_revision` 保存；成功后更新本地 revision。
  - [x] SubTask 6.2: 处理乐观锁冲突：不覆盖远端、提示刷新；未保存改动导航拦截二次确认（沿用既有约定）。

- [x] Task 7: 测试与验证。
  - [x] SubTask 7.1: 前端测试：画布铺满无留白、参考图节点编号与 bbox 自动引用、输出节点生成与操作、右侧 dock 固定、布局保存/恢复与冲突提示。
  - [x] SubTask 7.2: 后端 `.venv` 下 pytest 回归通过。
  - [x] SubTask 7.3: 前端 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 全部通过。

# Task Dependencies
- Task 2 依赖 Task 1（类型/接口对齐）。
- Task 3、Task 4、Task 5 依赖 Task 2（画布容器与 API 就绪），三者可并行。
- Task 6 依赖 Task 3、Task 4、Task 5（需有节点变更来源）。
- Task 7 依赖前述全部任务。
