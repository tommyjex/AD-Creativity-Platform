# Tasks
- [x] Task 1: 补齐剧本生成后端输入与工作流。
  - [x] SubTask 1.1: 确认 `script` 阶段依赖最新成功故事，并在故事缺失时返回依赖错误。
  - [x] SubTask 1.2: 在剧本生成服务中传入项目 brief 和最新故事内容。
  - [x] SubTask 1.3: 将剧本结果保存为 `script` 阶段文本产物，并正确更新任务状态和项目状态。

- [x] Task 2: 实现剧本文本生成能力。
  - [x] SubTask 2.1: 扩展文本生成适配层的剧本 prompt，明确使用故事、商品、平台、比例、时长、风格和受众。
  - [x] SubTask 2.2: 保留测试可控的 mock 生成能力，同时让 mock 输出体现故事和 brief 关键字段。
  - [x] SubTask 2.3: 处理模型或解析失败，确保 API 和任务错误信息脱敏。

- [x] Task 3: 接入工作台剧本展示与任务刷新。
  - [x] SubTask 3.1: 确认项目详情工作台能触发剧本生成任务并轮询任务状态。
  - [x] SubTask 3.2: 在剧本阶段展示最新成功剧本标题、版本、更新时间和正文。
  - [x] SubTask 3.3: 剧本生成成功后刷新项目详情，失败时展示可理解错误和重试入口。

- [x] Task 4: 添加自动化测试。
  - [x] SubTask 4.1: 添加后端测试，覆盖故事缺失、剧本成功生成、brief 字段进入剧本、失败重试和下游 stale 标记。
  - [x] SubTask 4.2: 添加文本生成适配层测试，验证剧本 prompt 或 mock 输出包含故事与 brief 约束。
  - [x] SubTask 4.3: 添加前端测试，覆盖剧本生成触发、任务状态展示、成功刷新和剧本文本展示。

- [x] Task 5: 完成验证。
  - [x] SubTask 5.1: 在 `.venv` 中运行后端测试。
  - [x] SubTask 5.2: 运行前端 lint、typecheck、test 和 build。
  - [x] SubTask 5.3: 在本地前后端服务中执行一次“故事已生成 -> 触发剧本生成 -> 查看剧本结果”的 smoke test。

# Task Dependencies
- Task 2 depends on Task 1。
- Task 3 depends on Task 1。
- Task 4 depends on Task 1、Task 2 and Task 3。
- Task 5 depends on Task 4。
