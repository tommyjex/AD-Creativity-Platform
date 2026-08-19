# Tasks

- [x] Task 1: 建立项目软删除数据模型与兼容迁移。
  - [x] SubTask 1.1: 为项目 ORM 增加可空 `deleted_at` 字段和活跃项目查询索引。
  - [x] SubTask 1.2: 扩展现有 additive migration，为旧数据库幂等补充字段和索引。
  - [x] SubTask 1.3: 为内存仓储与 SQLAlchemy 仓储建立一致的软删除状态表达。

- [x] Task 2: 扩展项目仓储的搜索、软删除与可见性规则。
  - [x] SubTask 2.1: 扩展仓储协议，支持项目摘要关键词查询和项目软删除。
  - [x] SubTask 2.2: 在两种仓储中实现项目名称、商品名称、广告需求的不区分大小写包含匹配。
  - [x] SubTask 2.3: 让常规项目读取、更新及项目级资源访问将已删除项目视为不存在。
  - [x] SubTask 2.4: 让全局资产查询排除属于已删除项目的素材和产物，同时保留底层数据。

- [x] Task 3: 提供项目搜索与删除 API。
  - [x] SubTask 3.1: 为 `GET /api/projects` 增加可选 `q` 参数并传递给仓储。
  - [x] SubTask 3.2: 新增 `DELETE /api/projects/{project_id}`，成功返回 204，不存在或重复删除返回统一 404。
  - [x] SubTask 3.3: 添加内存仓储与 SQLAlchemy 仓储的 API/契约测试，覆盖搜索字段、空关键词、软删除、重复删除、详情隐藏、资产隐藏与数据保留。

- [x] Task 4: 扩展前端 API client。
  - [x] SubTask 4.1: 让 `listProjects` 支持可选关键词并正确编码查询参数。
  - [x] SubTask 4.2: 新增 `deleteProject(projectId)`，发送 `DELETE` 并正确处理 204 响应。
  - [x] SubTask 4.3: 更新 API client 测试，验证 URL 编码、请求方法和无响应体处理。

- [x] Task 5: 在项目模块实现搜索与删除交互。
  - [x] SubTask 5.1: 在项目列表顶部增加搜索框，采用短延迟防抖请求后端，并处理加载、失败、空关键词和无结果状态。
  - [x] SubTask 5.2: 重构项目列表项操作区域，增加带工具提示的删除图标按钮，保持列表项选择键盘可访问。
  - [x] SubTask 5.3: 使用现有 Dialog 组件实现删除确认、提交中、失败重试和取消状态。
  - [x] SubTask 5.4: 删除成功后同步列表、当前选中项目、详情与计数；删除失败时不丢失当前 UI 状态。
  - [x] SubTask 5.5: 添加项目工作台交互测试，覆盖搜索、清空搜索、取消删除、删除当前/非当前项目及错误反馈。

- [x] Task 6: 完成回归验证。
  - [x] SubTask 6.1: 使用项目根目录 `.venv` 运行后端项目与数据库相关测试。
  - [x] SubTask 6.2: 运行前端 API client、项目工作台测试、TypeScript 检查和 ESLint。
  - [x] SubTask 6.3: 浏览器验证桌面与移动布局，确认搜索、删除确认、焦点状态和空状态无重叠或截断。

- [x] Task 7: 修复浏览器验收发现的运行时问题。
  - [x] SubTask 7.1: 修复项目搜索错误态中 `RotateCcw` 图标未导入导致的运行时异常。
  - [x] SubTask 7.2: 重启后端开发服务以加载项目删除路由，并确认 `DELETE /api/projects/{id}` 不再返回 405。
  - [x] SubTask 7.3: 重新验证搜索无结果、取消删除、确认删除、详情清空及桌面/移动布局。

- [x] Task 8: 清理全量前端 ESLint 阻塞项。
  - [x] SubTask 8.1: 以行为等价的最小改动修复 `workspace-creative-workflow.tsx` 的手工 memo 保留与 effect 内同步 setState 规则错误。
  - [x] SubTask 8.2: 重新运行前端全量测试、TypeScript 和全量 ESLint。

# Task Dependencies

- Task 2 depends on Task 1。
- Task 3 depends on Task 2。
- Task 4 can run in parallel with Task 1-3。
- Task 5 depends on Task 4 and the API contract defined by Task 3。
- Task 6 depends on Task 1-5。
- Task 7 depends on Task 5 and the first browser verification in Task 6。
- Task 8 depends on Task 6 checklist audit。
