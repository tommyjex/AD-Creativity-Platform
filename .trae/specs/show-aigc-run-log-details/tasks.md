# Tasks

- [x] Task 1: 完善运行日志前端契约与展示辅助函数。
  - [x] SubTask 1.1: 在前端 AIGC Run 类型中补齐后端已返回的脱敏 `error` 字段，保持现有 API 契约不新增接口。
  - [x] SubTask 1.2: 实现 Run/Task 本地时间、进行中占位和耗时格式化函数。
  - [x] SubTask 1.3: 实现最新相关 attempt 与失败原因选择逻辑，覆盖 Run 级错误、Task 级错误、blocked 和缺少错误消息。

- [x] Task 2: 扩展 AIGC 运行日志界面。
  - [x] SubTask 2.1: 运行历史选项增加状态和创建时间，切换后保持所选 Run 数据隔离。
  - [x] SubTask 2.2: 当前 Run 摘要增加开始时间、结束时间和耗时。
  - [x] SubTask 2.3: Run 失败时展示脱敏错误消息，并按可用性展示错误码、阶段和 request ID。
  - [x] SubTask 2.4: 节点日志展示状态、attempt 数量、最新相关 attempt 时间与耗时。
  - [x] SubTask 2.5: 节点 failed/timed_out 时展示 Task 错误；blocked 时展示上游阻塞文案；无详情时展示稳定回退文案。
  - [x] SubTask 2.6: 保持现有取消、重试、轮询、历史选择和响应式布局行为不变。

- [x] Task 3: 增加自动化验证。
  - [x] SubTask 3.1: 增加时间和耗时格式化单元测试，覆盖活动、终态和缺失时间。
  - [x] SubTask 3.2: 增加 Run 级 scheduling 错误展示测试。
  - [x] SubTask 3.3: 增加 Task/Provider 错误、超时、blocked、自动重试和无错误消息测试。
  - [x] SubTask 3.4: 增加历史 Run 切换测试，确认状态、时间和错误不会跨 Run 混用。
  - [x] SubTask 3.5: 运行相关 Vitest、TypeScript typecheck 和 ESLint。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3.1 可与 Task 2 并行；Task 3.2-3.4 依赖 Task 2。
- Task 3.5 依赖 Task 1-3.4。
