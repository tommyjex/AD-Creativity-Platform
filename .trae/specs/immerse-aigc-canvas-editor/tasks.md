# Tasks

- [x] Task 1: 扩展 AIGC 沉浸式路由 Shell。
  - [x] SubTask 1.1: 在 `AppShell` 中识别 Pipeline 与模板主画布路由，并与既有图层、时间线编辑器共用无全局导航的沉浸式 Shell。
  - [x] SubTask 1.2: 保持 `/workspace/aigc` 列表页及其他工作台页面的全局导航、路由高亮和移动导航行为不变。
  - [x] SubTask 1.3: 将 Pipeline、模板编辑器及其加载错误态从 `100dvh - 4rem` 调整为完整 `100dvh`。
  - [x] SubTask 1.4: 增加路由边界测试，覆盖 Pipeline、模板、AIGC 列表、普通工作台、图层和时间线编辑器。

- [x] Task 2: 重构高级画布工具栏的信息层级。
  - [x] SubTask 2.1: 将工具栏组织为画布身份区和命令区，展示返回入口、当前名称及“画布 / 模板”身份。
  - [x] SubTask 2.2: 移除自动保存状态的可见图标与文案，仅保留 `aria-live` 播报和完整错误说明。
  - [x] SubTask 2.3: 按面板、文档和执行语义重组现有命令；Pipeline 保留详情、另存模板和执行，模板仅保留适用命令。
  - [x] SubTask 2.4: 使用中性石墨背景、低对比边框、轻量阴影、稳定控件尺寸和单一蓝色主命令完成视觉样式。
  - [x] SubTask 2.5: 为仅图标命令保留 Lucide 图标、`aria-label`、`title`、键盘焦点和不小于 `40px` 的点击目标。
  - [x] SubTask 2.6: 增加组件测试，覆盖模式差异、长名称、隐藏保存状态、命令可访问性和稳定高度。

- [x] Task 3: 完成工具栏响应式收缩与布局保护。
  - [x] SubTask 3.1: 在不小于 `1024px` 的桌面视口展示完整画布身份、保存反馈和分组命令。
  - [x] SubTask 3.2: 在 `768px` 至 `1023px` 视口隐藏次要命令文字，保留图标、工具提示和执行入口。
  - [x] SubTask 3.3: 在 `390px` 窄屏按优先级收缩身份标识与低优先级状态文案，确保返回、详情和 Pipeline 执行始终可达。
  - [x] SubTask 3.4: 验证长标题、保存失败文案、运行中状态和面板切换不会造成水平溢出、文本覆盖或工具栏高度跳变。

- [x] Task 4: 保护保存、运行和画布交互回归。
  - [x] SubTask 4.1: 验证工具栏重组不触发额外自动保存，也不修改 Pipeline definition、节点坐标或 viewport。
  - [x] SubTask 4.2: 验证返回、另存模板、执行和进入深层编辑器继续使用现有 `flush()`、revision 与冲突保护。
  - [x] SubTask 4.3: 验证节点库显隐、详情栏开合、节点编辑、底部视图工具坞和模板不可执行规则无回归。

- [x] Task 5: 完成工程检查与多视口浏览器验收。
  - [x] SubTask 5.1: 运行 `workspace-navigation.test.tsx` 与 `aigc-editor.test.tsx` 定向测试。
  - [x] SubTask 5.2: 运行前端完整 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 5.3: 更新可重复执行的 Playwright 工作台验收脚本，断言无全局导航、完整视口高度、工具栏层级和关键命令可达。
  - [x] SubTask 5.4: 在 `1440x900`、`1024x768`、`768x1024` 和 `390x844` 视口完成截图与布局断言，并检查控制台错误。
  - [x] SubTask 5.5: 按实际验证证据逐项更新 `checklist.md`。

# Task Dependencies

- Task 2 可与 Task 1 并行。
- Task 3 依赖 Task 2。
- Task 4 依赖 Task 1 至 Task 3。
- Task 5 依赖 Task 1 至 Task 4。
