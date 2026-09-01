# 任务

- [x] Task 1: 扩展模板与 Pipeline 删除仓储契约。
  - [x] SubTask 1.1: 在 Repository Protocol、MemoryRepository 和 MySQLRepository 中增加模板与 Pipeline 删除方法。
  - [x] SubTask 1.2: 保证 Memory/MySQL 行为一致：不存在返回未找到；无 Run 物理删除；仅有终态 Run 时软删除；存在活动 Run 时返回冲突。
  - [x] SubTask 1.3: 删除模板时保留由其创建的 Pipeline；归档有终态 Run 的 Pipeline，且禁止级联删除运行、任务、关联或资产数据。

- [x] Task 2: 实现模板与 Pipeline 删除 API。
  - [x] SubTask 2.1: 增加 `DELETE /api/aigc/templates/{template_id}`，成功返回空响应 `204`，不存在返回 `404`。
  - [x] SubTask 2.2: 增加 `DELETE /api/aigc/pipelines/{pipeline_id}`，成功返回空响应 `204`，不存在返回 `404`。
  - [x] SubTask 2.3: Pipeline 存在 queued/running Run 时返回 `409`，并提供可供前端展示的稳定错误信息。

- [x] Task 3: 接入前端删除调用与列表刷新。
  - [x] SubTask 3.1: 在 API client 中增加模板和 Pipeline 删除方法，并正确处理 `204` 空响应及 `404`、`409` 错误。
  - [x] SubTask 3.2: 增加对应 mutation；仅在删除成功后使当前模板或画布列表查询失效并重新获取。
  - [x] SubTask 3.3: 删除失败时不乐观移除条目，保留当前视图、筛选条件、分页状态和列表内容。

- [x] Task 4: 实现条目级删除交互。
  - [x] SubTask 4.1: 在模板与画布条目上增加可访问的删除图标，并阻止点击事件触发卡片主操作。
  - [x] SubTask 4.2: 使用应用内确认弹窗展示条目名称、类型和删除后果，支持确认、取消、关闭及提交中防重复操作。
  - [x] SubTask 4.3: 成功后关闭弹窗并展示刷新后的当前列表；失败时保留条目并展示 `404`、`409` 或通用错误反馈。

- [x] Task 5: 完成测试与验收。
  - [x] SubTask 5.1: 增加 Memory/MySQL 参数化仓储测试，覆盖成功删除、`404`、历史 Run `409`、禁止级联及模板实例保留。
  - [x] SubTask 5.2: 增加 API 测试，覆盖两个删除接口的 `204` 空响应、`404`、`409` 和数据不变性。
  - [x] SubTask 5.3: 增加前端测试，覆盖删除图标、事件隔离、应用内确认/取消、成功刷新当前列表、失败保留和错误提示。
  - [x] SubTask 5.4: 运行后端 `.venv` 全量 pytest，以及前端 lint、typecheck、完整测试和 production build。
  - [x] SubTask 5.5: 使用浏览器验收模板与画布删除、确认弹窗、成功刷新、`404`/`409` 反馈、失败保留和既有画布不受模板删除影响。

- [x] Task 6: 修复独立验证发现的规格偏差与测试缺口。
  - [x] SubTask 6.1: 调整模板删除的数据模型与 Memory/MySQL 实现，使删除模板后既有 Pipeline（包括 `source_template_id`、来源版本、定义及其他字段）完全不被修改。
  - [x] SubTask 6.2: 修正仓储与 API 测试中将 `source_template_id` 置空视为正确行为的断言，验证模板删除前后既有 Pipeline 全量数据保持不变且仍可打开、编辑、保存和运行。
  - [x] SubTask 6.3: 扩充 Memory/MySQL 参数化仓储测试与 API 测试，在 Pipeline 删除返回 `409` 后逐项验证 Pipeline、Run、RunNode、Task、任务资产关联和结果资产均未被删除或修改。

- [x] Task 7: 将有终态历史 Run 的 Pipeline 删除策略改为软删除。
  - [x] SubTask 7.1: 增加 `pipelines.deleted_at` 字段、索引和幂等增量迁移。
  - [x] SubTask 7.2: 在 Memory/MySQL 仓储中隐藏软删除 Pipeline，同时保留历史 Run、Task 和任务资产。
  - [x] SubTask 7.3: 保留活动 Run 删除冲突，并补充仓储、API 和数据库迁移测试。

# 任务依赖

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 2。
- Task 4 依赖 Task 3。
- Task 5 依赖 Task 1 至 Task 4。
- Task 6 依赖独立验证结果，完成后需重新执行 Task 5.1、Task 5.2、Task 5.4 和 Task 5.5。
