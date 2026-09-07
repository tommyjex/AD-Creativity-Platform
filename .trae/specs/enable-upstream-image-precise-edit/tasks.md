# Tasks

- [x] Task 1: 扩展图片节点的上游 BBox 数据契约。
  - [x] SubTask 1.1: 在前后端 `ImageConfig` 增加成对可空的 `upstream_bbox / upstream_bbox_asset_id`，复用现有 `0..999` 整数坐标校验，并保持本地 BBox 继续严格绑定本地 `asset_id`。
  - [x] SubTask 1.2: 为 v1→v2 迁移、v2 规范化、默认节点、序列化往返和历史快照只读适配补齐确定性空默认值。
  - [x] SubTask 1.3: 更新模板清理逻辑，清除上游 BBox 绑定及关联文本引用，且不把上游结果资产加入 `pipeline_assets`。
  - [x] SubTask 1.4: 添加 schema、迁移、API 往返和模板清理测试。

- [x] Task 2: 建立当前有效图片与 BBox 绑定投影。
  - [x] SubTask 2.1: 在结果投影层提供图片节点当前有效资产、模式、状态和 BBox 绑定状态（`none / valid / stale`），上游模式只读取所选 Run 的 RunNode 结果。
  - [x] SubTask 2.2: 本地模式以 `bbox_asset_id == asset_id` 判定有效；上游模式以 `upstream_bbox_asset_id == 当前结果 asset_id` 判定有效，切换 Run 不修改 definition。
  - [x] SubTask 2.3: 为等待、失败、取消、不可用、换图失效、切回匹配历史 Run 和本地恢复添加投影测试。

- [x] Task 3: 让精准编辑弹窗支持上游结果资产。
  - [x] SubTask 3.1: 图片节点无论本地或上游模式都渲染常驻“精准编辑”按钮；仅 Pipeline 编辑模式且当前有效图片可访问时启用。
  - [x] SubTask 3.2: 将有效图片资产、预览 URL、模式和期望资产 ID 显式传入弹窗，上游模式不得查询或展示本地备用资产。
  - [x] SubTask 3.3: 弹窗按当前模式加载对应 BBox，并在上游绑定失效时不绘制旧框、显示“上游图片已更新，请重新框选”。
  - [x] SubTask 3.4: 确认提交前比较弹窗打开时资产 ID 与当前投影资产 ID；不一致时拒绝写入并提示重新框选。
  - [x] SubTask 3.5: 添加按钮状态、上游弹窗预览、失效提示、竞态拒绝、清除和原始比例显示组件测试。

- [x] Task 4: 扩展 Store 与前端 BBox 引用资格。
  - [x] SubTask 4.1: 将框选提交动作扩展为携带来源模式和绑定资产 ID；本地写入本地字段，上游写入上游字段，禁止互相覆盖。
  - [x] SubTask 4.2: 允许有上游的图片节点成为 BBox 引用源，但继续要求文本节点处于本地模式，并保持共同普通图生图下游、最多 10 条及同源唯一规则。
  - [x] SubTask 4.3: 上游资产不匹配或无有效上游 BBox 时禁止新建引用；清除当前模式框选时同步移除相关文本引用。
  - [x] SubTask 4.4: 添加 Store、资格判断、断开恢复、本地/上游字段隔离和 undo/redo 回归测试。

- [x] Task 5: 扩展后端 DAG 校验、运行时编译与缓存语义。
  - [x] SubTask 5.1: DAG 校验允许上游图片节点参与 BBox 关系，同时继续拒绝上游文本节点、非普通图生图目标、缺失框选和不完整共同下游关系。
  - [x] SubTask 5.2: 运行时从本次 Run 解析图片节点实际有效资产；上游绑定匹配时编译对应 BBox，不再无条件跳过上游图片引用。
  - [x] SubTask 5.3: 实际资产与 `upstream_bbox_asset_id` 不一致时，在供应商调用前返回 `bbox_reference_asset_changed`，错误包含图片节点和文本节点 ID。
  - [x] SubTask 5.4: 将有效 BBox、绑定资产 ID 和引用说明纳入下游 `inputHash`；失效引用不得命中旧缓存或静默降级。
  - [x] SubTask 5.5: 添加有效编译、资产变化、缓存失效、失败不调用 Provider、本地行为不回归和增量执行测试。

- [x] Task 6: 完成前端与浏览器验收。
  - [x] SubTask 6.1: 运行前端 BBox、Store、结果投影和节点组件定向 Vitest。
  - [x] SubTask 6.2: 运行前端完整 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 6.3: 在 `.venv` 运行后端 schema、DAG、执行器、Pipeline 和 API 定向测试及完整 pytest。
  - [x] SubTask 6.4: 使用隔离 Pipeline 验证“上游生成图片 → 图片节点 → 普通图生图”的打开弹窗、画框、引用、执行、重新生成失效和重新框选恢复流程。
  - [x] SubTask 6.5: 使用 Playwright 在 `1440x900`、`1023x768` 和 `390x844` 验证按钮、弹窗、等比图片、失效提示和操作可达性，并确认控制台无新增错误。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 2。
- Task 4 依赖 Task 1、Task 2，可与 Task 3 并行。
- Task 5 依赖 Task 1、Task 4。
- Task 6 依赖 Task 1 至 Task 5。
