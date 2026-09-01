# Tasks

- [x] Task 1: 实现 AIGC 媒体资产卡片选择弹窗。
  - [x] SubTask 1.1: 为图片、视频和音频提供统一的单选弹窗组件。
  - [x] SubTask 1.2: 展示媒体预览、可读名称、规格、来源、创建时间和短 ID。
  - [x] SubTask 1.3: 支持名称、文件名、资产 ID、MIME 类型和来源搜索。
  - [x] SubTask 1.4: 实现临时选择、确认生效及取消不修改节点。

- [x] Task 2: 接入 AIGC 媒体输入节点。
  - [x] SubTask 2.1: 将图片、视频和音频资产原生下拉框替换为卡片弹窗入口。
  - [x] SubTask 2.2: 保留当前资产摘要、不可用资产提示和本地上传流程。
  - [x] SubTask 2.3: 为 UUID 等不透明名称生成媒体类型与北京时间名称。

- [x] Task 3: 完成测试与视觉验收。
  - [x] SubTask 3.1: 覆盖模态过滤、搜索、取消、确认、上传及不可读名称测试。
  - [x] SubTask 3.2: 运行完整前端 Vitest、lint、typecheck 和 production build。
  - [x] SubTask 3.3: 在桌面和 390px 窄屏验证卡片网格、操作区及无横向溢出。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1 和 Task 2。
