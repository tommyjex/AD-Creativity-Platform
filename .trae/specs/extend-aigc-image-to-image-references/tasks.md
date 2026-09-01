# Tasks

- [x] Task 1: 扩展图生图端口契约与 DAG 校验。
  - [x] SubTask 1.1: 为前后端端口定义增加 `max_connections`，默认值为 1。
  - [x] SubTask 1.2: 将图生图节点 `image` 端口设为 `multiple=true`、`max_connections=10`，保持其他端口为单值。
  - [x] SubTask 1.3: 后端 DAG 校验允许 1–10 条图片输入边，拒绝第 11 条和完全重复的边，并返回可定位错误。
  - [x] SubTask 1.4: 增加注册表和 DAG 单元测试，覆盖 1、10、11 条图片输入及重复边。

- [x] Task 2: 实现有序多参考图任务解析与缓存隔离。
  - [x] SubTask 2.1: 按 definition 边顺序聚合图生图 `image` 输入，生成有序 `reference_asset_ids` 和完整 upstream 列表。
  - [x] SubTask 2.2: 调整上游摘要，使同一图片集合的不同顺序产生不同 `inputHash`。
  - [x] SubTask 2.3: 升级图片执行器版本，隔离升级前的单图缓存。
  - [x] SubTask 2.4: 增加任务解析和哈希测试，覆盖图片输入节点、上游模型输出、混合来源及顺序变化。

- [x] Task 3: 扩展模型网关和任务资产追踪。
  - [x] SubTask 3.1: 图生图参数使用最多 10 项的 `reference_asset_ids`，并兼容旧 `source_asset_id` 快照。
  - [x] SubTask 3.2: 在调用模型前完整校验全部图片资产并生成临时访问 URL；第一张映射为主图，其余映射为附加参考图。
  - [x] SubTask 3.3: 扩展 `generate_aigc_image` 以传递附加参考图 URL。
  - [x] SubTask 3.4: 为所有输入图片写入带顺序的任务资产关联，确保失败和重试不会遗留错误关联。
  - [x] SubTask 3.5: 增加网关测试，覆盖 1 张、10 张、旧快照、顺序、资产不可用和模型参数上限。

- [x] Task 4: 优化前端连线限制和图生图节点反馈。
  - [x] SubTask 4.1: 前端连线校验按端口 `max_connections` 计数，允许前 10 条图片边并拒绝第 11 条及重复边。
  - [x] SubTask 4.2: 超限时展示“图生图节点最多支持 10 张参考图”，端口达到上限后更新可访问提示。
  - [x] SubTask 4.3: 在图生图节点卡片中展示 `参考图 n/10`，同时保留模型、画幅和尺寸摘要。
  - [x] SubTask 4.4: 增加前端契约、连线和节点展示测试。

- [x] Task 5: 完成回归与浏览器验收。
  - [x] SubTask 5.1: 使用 `.venv/bin/pytest` 运行后端完整测试。
  - [x] SubTask 5.2: 运行前端 lint、typecheck、完整 Vitest 和 production build。
  - [x] SubTask 5.3: 在浏览器验证 1–10 张连线、计数展示、第 11 张拦截、保存恢复和多图执行结果。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 2。
- Task 4 依赖 Task 1，可与 Task 2、Task 3 的后端工作并行。
- Task 5 依赖 Task 1、Task 2、Task 3、Task 4。
