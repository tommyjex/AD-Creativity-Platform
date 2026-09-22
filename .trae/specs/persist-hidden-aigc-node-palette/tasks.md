# Tasks

- [x] Task 1: 建立桌面节点库可见性偏好
  - [x] SubTask 1.1: 在 AIGC 编辑器中定义版本化 `localStorage` 键及严格的 `"true"` / `"false"` 解析逻辑，缺失、非法或访问失败时回退为隐藏。
  - [x] SubTask 1.2: 将桌面节点库可见性作为独立本地 UI 状态，首次默认隐藏，并在用户主动显示或隐藏时持久化。
  - [x] SubTask 1.3: 保证该状态不进入 editor store、Pipeline/模板 definition、revision 或自动保存快照。
  - [x] SubTask 1.4: 增加单元测试，覆盖默认隐藏、合法偏好恢复、非法值回退、存储读写失败和跨实体复用。

- [x] Task 2: 实现桌面节点库显示与隐藏交互
  - [x] SubTask 2.1: 桌面节点库隐藏时，在画布左上角显示带 Lucide 图标、`aria-label`、`title` 和状态语义的“打开节点库”按钮。
  - [x] SubTask 2.2: 扩展 `NodePalette`，在标题栏加入“隐藏节点库”图标按钮，同时保留现有分类、完整名称、滚动和添加行为。
  - [x] SubTask 2.3: 桌面节点库显示时继续使用 `184px` 停靠宽度；隐藏时让画布占用释放空间。
  - [x] SubTask 2.4: 隐藏节点库时保留当前节点选择、Inspector 标签、Run 选择、视口和编辑上下文。
  - [x] SubTask 2.5: 增加组件测试，覆盖显示、隐藏、连续添加节点、控制按钮语义和上下文保持。

- [x] Task 3: 保持窄屏面板与断点行为
  - [x] SubTask 3.1: 小于 `1024px` 时继续使用现有 `240px` 临时覆盖节点面板，并保持与 Inspector 互斥。
  - [x] SubTask 3.2: 窄屏添加节点后继续自动关闭节点面板，且不修改桌面持久化偏好。
  - [x] SubTask 3.3: 桌面切换至窄屏时不自动打开节点浮层；返回桌面后按持久化偏好恢复节点库。
  - [x] SubTask 3.4: 增加 `1023px ↔ 1024px` 状态转换测试，覆盖桌面显示与隐藏两种偏好及 Inspector 状态保留。

- [x] Task 4: 保护自动保存和既有画布能力
  - [x] SubTask 4.1: 验证节点库显示、隐藏及偏好恢复不调用 `updateAigcPipeline` 或 `updateAigcTemplate`。
  - [x] SubTask 4.2: 验证名称、描述、节点、连线、位置、尺寸、配置和视口仍按既有规则自动保存。
  - [x] SubTask 4.3: 验证运行、撤销、重做、节点添加、拖拽、连线、删除、右键添加与详情栏交互无回归。

- [x] Task 5: 完成工程检查和多视口验收
  - [x] SubTask 5.1: 更新 `frontend/scripts/verify-aigc-workbench-layout.mjs`，验证首次默认隐藏、显示/隐藏、刷新恢复及跨断点恢复。
  - [x] SubTask 5.2: 在 `1440x900`、`1024x768`、`768x1024` 和 `390x844` 检查按钮可达、布局无重叠且节点添加可用。
  - [x] SubTask 5.3: 运行 AIGC 编辑器定向 Vitest、完整 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 5.4: 执行 Playwright 验收并输出节点库隐藏、显示及窄屏浮层截图。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1 和 Task 2。
- Task 4 可在 Task 2 完成后与 Task 3 并行。
- Task 5 依赖 Task 1 至 Task 4。
