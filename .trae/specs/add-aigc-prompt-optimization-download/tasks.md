# Tasks

- [x] Task 1: 定义 AIGC 生图提示词优化契约。
  - [x] SubTask 1.1: 新增请求/响应 Pydantic schema，限制文本、引用说明、模式和参考图数量。
  - [x] SubTask 1.2: 新增同构 TypeScript 类型与 API client 方法。
  - [x] SubTask 1.3: 增加空内容、超长、非法模式和响应数量不匹配测试。

- [x] Task 2: 实现 Seedream 提示词优化服务与 API。
  - [x] SubTask 2.1: 为 ModelArk 适配器增加图片提示词优化结构化请求/响应，真实与 mock 适配器遵循同一契约。
  - [x] SubTask 2.2: 按官方指南构建文生图、图生图和多参考图优化指令，保持用户硬约束且禁止生成坐标标签。
  - [x] SubTask 2.3: 在生成服务中校验 JSON、非空、长度、引用说明数量和禁止标签。
  - [x] SubTask 2.4: 新增 `POST /api/aigc/prompts/optimize`，统一处理 provider failure 和输出校验错误且不产生持久化副作用。
  - [x] SubTask 2.5: 增加适配器、服务和路由测试。

- [x] Task 3: 接入文本输入节点优化交互。
  - [x] SubTask 3.1: 根据当前 definition 推导下游生图模式与参考图数量；无图片下游时默认文生图模式。
  - [x] SubTask 3.2: 在结构化提示词编辑器增加优化按钮、loading、禁用和错误反馈。
  - [x] SubTask 3.3: 捕获请求时配置快照，丢弃节点变化后的过期响应。
  - [x] SubTask 3.4: 新增一次性更新文本及全部引用说明的 Zustand action，确保单次撤销恢复且无变化时不写历史。
  - [x] SubTask 3.5: 增加成功、无变化、失败、空内容、重复点击、过期响应和撤销测试。

- [x] Task 4: 补齐图片输出下载。
  - [x] SubTask 4.1: 增加稳定的图片下载文件名生成函数。
  - [x] SubTask 4.2: 图片输出节点标题栏在结果可用时显示下载图标。
  - [x] SubTask 4.3: 右侧结果面板为每张可用图片增加“下载图片”按钮。
  - [x] SubTask 4.4: 增加单图、多图、不可用结果、安全 URL 和文件名测试。

- [x] Task 5: 完成回归与浏览器验收。
  - [x] SubTask 5.1: 使用根目录 `.venv` 运行后端完整 pytest。
  - [x] SubTask 5.2: 运行前端 lint、typecheck、完整 Vitest 和 production build。
  - [x] SubTask 5.3: 浏览器验证文本节点优化 loading、替换、不自动保存与撤销恢复。
  - [x] SubTask 5.4: 浏览器验证输出节点和结果面板下载入口、文件名及不可用状态。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1、Task 2。
- Task 4 与 Task 1、Task 2、Task 3 无依赖，可并行。
- Task 5 依赖 Task 2、Task 3、Task 4。
