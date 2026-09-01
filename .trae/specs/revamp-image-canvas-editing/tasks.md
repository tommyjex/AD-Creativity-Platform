# Tasks

- [x] Task 1: 定义多参考图区域编辑的数据契约与任务冻结输入。
  - [x] SubTask 1.1: 扩展图片编辑请求，区分目标图 bbox、按顺序的参考图 bbox 和单图编辑模式。
  - [x] SubTask 1.2: 校验最多 10 张参考图、同项目归属、可访问状态、图片编号唯一性和 bbox 合法性。
  - [x] SubTask 1.3: 扩展冻结输入、输入 hash、重试与产物 metadata，完整保留多图顺序和区域快照。

- [x] Task 2: 实现 Seedream 多参考图对象替换与单图区域编辑服务。
  - [x] SubTask 2.1: 将结构化区域引用编译为模型最终指令，自动带入图片编号和 bbox 标签。
  - [x] SubTask 2.2: 为多参考图编辑生成签名 URL 列表并调用 Seedream 5.0 Pro 的多图输入参数。
  - [x] SubTask 2.3: 保持单图 bbox 精准编辑和历史失败任务重试兼容。

- [x] Task 3: 改造图片编辑前端为画布优先工作区。
  - [x] SubTask 3.1: 用目标图画布、参考图素材区和指令侧栏替代主要单图编辑弹窗流程。
  - [x] SubTask 3.2: 实现框选、图片编号、目标/参考区域槽位和自动区域引用条目。
  - [x] SubTask 3.3: 实现单图编辑与参考图对象替换模式切换、禁用状态、任务反馈和新版本刷新。
  - [x] SubTask 3.4: 实现桌面宽屏与移动端堆叠布局。

- [ ] Task 4: 将图层拆分后的操作整合至画布编辑器。
  - [ ] SubTask 4.1: 在画布中加载图层集合并复用已有移动、等比缩放、显隐和排序状态。
  - [ ] SubTask 4.2: 为选中非底图图层增加 Seedream 内容编辑入口，并以 revision 保护资产替换。
  - [ ] SubTask 4.3: 保留原图层资产追溯、冲突处理和图层合成兼容性。

- [ ] Task 5: 补齐自动化验证与视觉验收。
  - [x] SubTask 5.1: 添加后端 schema、API、冻结、hash、重试、Seedream 参数和资产校验测试。
  - [x] SubTask 5.2: 添加前端模式切换、坐标换算、区域引用和响应式布局测试。
  - [x] SubTask 5.3: 在 `.venv` 运行后端 pytest；运行前端 lint、typecheck、相关测试与构建。
  - [ ] SubTask 5.4: 使用浏览器在桌面和移动视口检查画布、框选、图层变换和文本布局。

- [x] Task 6: 修复只读详情合并验收失败。
  - [x] SubTask 6.1: 移除图片项目详情中的旧编辑 Brief 和可编辑提示词工作区，确保只读组件为唯一详情内容。
  - [x] SubTask 6.2: 修复 `image-project-read-only-detail` Vitest 导入解析，并运行相关测试。
  - [x] SubTask 6.3: 移动端验收按用户决定不执行。

# Task Dependencies

- Task 2 depends on Task 1。
- Task 3 depends on Task 1。
- Task 4 depends on Task 3。
- Task 5 depends on Task 1-4。
