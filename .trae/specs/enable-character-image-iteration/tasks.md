# Tasks
- [x] Task 1: 补齐角色迭代后端契约。
  - [x] SubTask 1.1: 新增角色图片编辑和重新生成请求/响应 schema，包含资产 ID、提示词、操作类型和任务信息。
  - [x] SubTask 1.2: 新增角色资产迭代 API，支持提交编辑任务和重新生成任务。
  - [x] SubTask 1.3: 为角色资产元数据规范化保存历史提示词、当前提示词、来源资产 ID、操作类型和模型名。

- [x] Task 2: 实现 Seedream 5.0 Pro 角色图片编辑与重新生成链路。
  - [x] SubTask 2.1: 在 ModelArk 适配层新增图生图编辑能力，使用当前角色图片 URL 和用户提示词调用 Seedream 5.0 Pro。
  - [x] SubTask 2.2: 在 ModelArk 适配层新增单角色重新生成能力，使用用户调整后的提示词调用 Seedream 5.0 Pro 生图。
  - [x] SubTask 2.3: 复用现有下载、TOS 上传和 MySQL 原子落库逻辑，失败时不保留不完整资产，并对错误脱敏。

- [x] Task 3: 实现角色选项卡交互。
  - [x] SubTask 3.1: 在每张成功角色图上增加“编辑”和“重新生成”操作入口。
  - [x] SubTask 3.2: 编辑面板支持输入微调提示词并展示提交、运行、成功、失败状态。
  - [x] SubTask 3.3: 重新生成面板带出历史提示词，允许用户调整后提交；历史提示词缺失时展示系统补全初稿。
  - [x] SubTask 3.4: 任务成功后刷新项目详情，角色选项卡展示最新成功角色图。

- [x] Task 4: 添加自动化测试。
  - [x] SubTask 4.1: 添加后端 API 和 workflow 测试，覆盖编辑成功、重新生成成功、TOS/模型失败回滚和错误脱敏。
  - [x] SubTask 4.2: 添加 ModelArk 适配层测试，验证 Seedream 图生图和重新生成参数。
  - [x] SubTask 4.3: 添加前端测试，覆盖编辑面板、重新生成历史提示词预填、任务成功刷新和失败提示。

- [x] Task 5: 完成验证与真实联调。
  - [x] SubTask 5.1: 在 `.venv` 中运行后端测试。
  - [x] SubTask 5.2: 运行前端 lint、typecheck、test 和 build。
  - [x] SubTask 5.3: 使用真实 `.env` 配置执行一次 Seedream 图生图编辑和一次重新生成联调，确认新图上传 TOS、写入 MySQL 并能在角色选项卡加载。

# Task Dependencies
- Task 2 depends on Task 1。
- Task 3 depends on Task 1。
- Task 4 depends on Task 1、Task 2 and Task 3。
- Task 5 depends on Task 4。
