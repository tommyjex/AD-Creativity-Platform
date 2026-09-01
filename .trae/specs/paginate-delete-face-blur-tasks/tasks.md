# Tasks

- [ ] Task 1: 增加工具任务删除后端契约。
  - [ ] SubTask 1.1: 在仓储接口及实现中增加按 ID 删除工具任务记录的方法。
  - [ ] SubTask 1.2: 增加 `DELETE /api/tools/tasks/{task_id}`，删除不存在任务返回 404。
  - [ ] SubTask 1.3: 保证删除任务不删除关联资产，并补充后端回归测试。

- [ ] Task 2: 增加前端删除调用与人物任务列表分页。
  - [ ] SubTask 2.1: 在 API client 增加删除工具任务方法。
  - [ ] SubTask 2.2: 人物打码任务按创建时间倒序、每页 10 条展示，并实现分页控件。
  - [ ] SubTask 2.3: 在任务条目增加带确认对话框的删除入口；成功后同步任务状态、页面和选中任务，失败显示反馈。

- [ ] Task 3: 补充测试与验证。
  - [ ] SubTask 3.1: 覆盖后端删除、404 和资产保留行为。
  - [ ] SubTask 3.2: 覆盖前端分页、页间选择、新任务回到第一页、删除确认/取消/失败及选中任务回退。
  - [ ] SubTask 3.3: 运行后端 `.venv` pytest、前端 Vitest、lint、typecheck，并使用浏览器验收分页和删除交互。

# Task Dependencies

- Task 2.1 依赖 Task 1.2。
- Task 2.2 与 Task 2.3 可并行，均依赖 Task 2.1。
- Task 3 依赖 Task 1 和 Task 2。
