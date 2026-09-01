# Tasks

- [x] Task 1: 增加工具任务删除后端契约。
  - [x] SubTask 1.1: 在仓储接口及实现中增加按 ID 删除工具任务记录的方法。
  - [x] SubTask 1.2: 增加 `DELETE /api/tools/tasks/{task_id}`，删除不存在任务返回 404。
  - [x] SubTask 1.3: 保证删除任务不删除关联资产，并补充后端回归测试。

- [x] Task 2: 增加前端删除调用与全模态任务列表分页。
  - [x] SubTask 2.1: 在 API client 增加删除工具任务方法。
  - [x] SubTask 2.2: 全模态生成任务按创建时间倒序、每页 10 条展示，并实现分页控件。
  - [x] SubTask 2.3: 在任务条目增加带确认对话框的删除入口；成功后同步任务状态、页面和选中任务，失败显示反馈。

- [x] Task 3: 补充测试与验证。
  - [x] SubTask 3.1: 覆盖后端删除、404 和资产保留行为。
  - [x] SubTask 3.2: 覆盖前端分页、页间选择、新任务回到第一页、删除确认/取消/失败及选中任务回退。
  - [x] SubTask 3.3: 运行后端 `.venv` pytest、前端 Vitest、lint、typecheck，并使用浏览器验收分页和删除交互。

- [x] Task 4: 修复运行时删除路由未加载问题。
  - [x] SubTask 4.1: 重启当前后端服务，使运行进程加载源码中的 `DELETE /api/tools/tasks/{task_id}` 路由。
  - [x] SubTask 4.2: 验证运行时 OpenAPI 同一路径同时包含 `GET` 和 `DELETE`。
  - [x] SubTask 4.3: 使用不存在的任务 ID 验证删除请求返回 404 而非 405，避免误删真实任务。
  - [x] SubTask 4.4: 运行工具任务删除后端回归测试和前端删除调用测试。

# Task Dependencies

- Task 2.1 依赖 Task 1.2。
- Task 2.2 与 Task 2.3 可并行，均依赖 Task 2.1。
- Task 3 依赖 Task 1 和 Task 2。
- Task 4.2、Task 4.3 和 Task 4.4 依赖 Task 4.1。
