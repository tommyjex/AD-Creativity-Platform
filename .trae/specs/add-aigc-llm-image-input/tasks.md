# Tasks

- [x] Task 1: 扩展 LLM 图片输入领域契约与 DAG 校验。
  - [x] SubTask 1.1: 在前后端 LLM 节点注册表中加入可选、单值 `image` 图片端口，并保持 `prompt` 文本端口的既有约束。
  - [x] SubTask 1.2: 更新 schema、definition 序列化和 DAG 校验，拒绝类型不符、重复图片输入和环路，保持历史 definition 兼容。
  - [x] SubTask 1.3: 增加节点注册与 DAG 测试，覆盖纯文本、合法图片、本地/上游图片、重复输入和非法连接。

- [x] Task 2: 将 LLM 图片输入接入运行参数、缓存与模型调用。
  - [x] SubTask 2.1: 解析本地或上游模式图片节点的有效 Run 资产，禁止回退至未生效的本地备用资产。
  - [x] SubTask 2.2: 将图片资产身份与可用性摘要纳入 LLM `inputHash` 和任务安全参数，不记录 URL 或二进制内容。
  - [x] SubTask 2.3: 在 Gateway/ModelArk 适配层使用短期受控 URL 构造 `input_text + input_image` 多模态请求；无图时保持现有文本调用。
  - [x] SubTask 2.4: 处理不可用资产和上游异常的阻塞/失败传播，确保 Provider 不会被调用。
  - [x] SubTask 2.5: 添加执行器、Gateway 与 Provider 测试，覆盖请求内容、缓存命中/失效、资产来源和 URL 不泄露。

- [x] Task 3: 实现前端图片输入交互与状态展示。
  - [x] SubTask 3.1: 更新 LLM 节点端口渲染、连接校验、卡片摘要和检查器，展示图片已连接、来源与不可用状态。
  - [x] SubTask 3.2: 保持断开图片后纯文本执行、提示词编辑、系统提示词配置及现有文本输出不受影响。
  - [x] SubTask 3.3: 添加 Store/组件测试，覆盖连线、断开、上游图片、运行状态和窄屏检查器。

- [x] Task 4: 完成回归与浏览器验收。
  - [x] SubTask 4.1: 运行后端 schema、DAG、执行器和 Gateway 定向测试及相关回归。
  - [x] SubTask 4.2: 运行前端 Vitest、TypeScript、ESLint 与 production build。
  - [x] SubTask 4.3: 使用 Playwright 在 `1440x900` 与 `390x844` 验证“文本 + 图片 → LLM → 文本”流程、纯文本回退、图片断开和失败状态，无控件重叠或控制台错误。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1，可与 Task 2 并行。
- Task 4 依赖 Task 1 至 Task 3。
