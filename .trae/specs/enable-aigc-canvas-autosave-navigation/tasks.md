# Tasks

- [x] Task 1: 让工作台列表视图可通过 URL 定位。
  - [x] SubTask 1.1: 解析 `view=templates|pipelines`，无效或缺失时回退 `templates`。
  - [x] SubTask 1.2: Pipeline 编辑器返回 `/workspace/aigc?view=pipelines`，模板编辑器返回 `/workspace/aigc?view=templates`。
  - [x] SubTask 1.3: 补充列表初始视图、无效参数及返回链接测试。

- [x] Task 2: 建立可测试的自动保存协调器。
  - [x] SubTask 2.1: 定义 `idle / pending / saving / saved / failed / conflict / invalid` 状态和已保存快照标识。
  - [x] SubTask 2.2: 实现 `800ms` 防抖、单飞串行、保存期间 latest-wins 续存及不可变提交快照。
  - [x] SubTask 2.3: 实现瞬时错误 `1s / 2s / 4s` 最多 3 次重试、`online` 恢复和 `409` 停止覆盖。
  - [x] SubTask 2.4: 实现 `flush()`，返回最新保存 revision 或结构化失败结果。

- [x] Task 3: 将 Pipeline 和模板编辑器接入自动保存。
  - [x] SubTask 3.1: 将名称、描述、节点、连线、位置、尺寸、配置和视口纳入持久化变更检测。
  - [x] SubTask 3.2: 仅在提交快照仍是最新草稿时清除 dirty，避免旧响应覆盖新编辑状态。
  - [x] SubTask 3.3: 使用自动保存状态替换“未保存”和常驻保存按钮，并提供明确失败、冲突和无效提示。
  - [x] SubTask 3.4: 保留 dirty 草稿的 `beforeunload` 保护，成功保存后取消保护。

- [x] Task 4: 串联依赖保存 revision 的操作。
  - [x] SubTask 4.1: 返回列表前 flush，失败时阻止导航。
  - [x] SubTask 4.2: 完整执行与“从此节点继续”前 flush，并使用最新 revision 创建 Run。
  - [x] SubTask 4.3: 另存为模板和打开图层编辑器前 flush，移除“请先手动保存”路径。
  - [x] SubTask 4.4: 校验失败、保存失败和冲突时不得继续后续命令。

- [x] Task 5: 完成回归与浏览器验收。
  - [x] SubTask 5.1: 单元测试覆盖防抖合并、单飞、保存中继续编辑、重试、冲突、无效草稿和 flush。
  - [x] SubTask 5.2: 组件测试覆盖无保存按钮、状态文案、返回目标、命令前保存、离开保护和模板模式。
  - [x] SubTask 5.3: 运行前端完整 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 5.4: 在桌面和窄屏浏览器验证自动保存、返回“我的画布”、错误状态及命令可达性。

# Task Dependencies

- Task 2 可与 Task 1 并行。
- Task 3 依赖 Task 2。
- Task 4 依赖 Task 1、Task 2 和 Task 3。
- Task 5 依赖 Task 1 至 Task 4。
