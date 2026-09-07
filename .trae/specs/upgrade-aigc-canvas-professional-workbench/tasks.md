# Tasks

- [x] Task 1: 建立专业工作台的可测试布局状态。
  - [x] SubTask 1.1: 将现有 `mobilePanel` 收敛为统一的节点库与详情栏可见状态，明确桌面默认值和窄屏互斥规则。
  - [x] SubTask 1.2: 实现选择节点时打开“配置”、运行记录入口打开“运行”、关闭详情栏保留上下文的状态转换。
  - [x] SubTask 1.3: 增加顶部详情、运行记录和面板关闭入口，并将 Inspector 改为按状态条件渲染。
  - [x] SubTask 1.4: 更新依赖默认常驻 Inspector 的既有测试，使其先通过用户入口打开所需标签。
  - [x] SubTask 1.5: 保持面板状态位于组件本地，不写入 editor store、Pipeline definition 或自动保存快照。
  - [x] SubTask 1.6: 定义 `1023px ↔ 1024px` 切换规则：节点浮层进入桌面时清除，详情栏及其标签在停靠与覆盖形态间保留。
  - [x] SubTask 1.7: 增加状态转换测试，覆盖默认收起、节点选择、运行入口、详情按钮二次点击、显式关闭、三个标签下的空白取消选择和断点切换。

- [x] Task 2: 重组桌面顶部栏和工作台骨架。
  - [x] SubTask 2.1: 将桌面节点库宽度调整为 `184px`，保留分类、完整标签、模态图标、独立滚动和添加行为。
  - [x] SubTask 2.2: 完成顶部详情与运行记录图标入口的视觉样式，复用 Lucide 图标、`aria-label` 和 `title`。
  - [x] SubTask 2.3: 保持 Pipeline 与模板的命令差异，并让执行继续作为 Pipeline 主命令。
  - [x] SubTask 2.4: 将 Inspector 增加关闭入口并改为仅在需要时渲染的 `320px` 右侧面板。
  - [x] SubTask 2.5: 约束标题、描述、自动保存状态和命令区宽度，保证长文本截断且按钮不被挤出。
  - [x] SubTask 2.6: 保持模板详情栏三个标签，并明确结果未执行和运行不可执行空状态。
  - [x] SubTask 2.7: 增加桌面布局测试，覆盖尺寸、默认可见性、面板入口、模板与 Pipeline 差异和长文本。
  - [x] SubTask 2.8: 在 `768px` 验证顶部单行、紧凑命令仅显示图标且名称可访问。

- [x] Task 3: 将 React Flow 视图控制收敛为底部工具坞。
  - [x] SubTask 3.1: 为共享 `NodeCanvas` 增加可选的 Controls 展示参数，默认行为保持现有调用方兼容。
  - [x] SubTask 3.2: AIGC 编辑器将 Controls 设为底部中央、横向排列，并通过参数内 Tailwind 类提供稳定尺寸和工作台视觉样式。
  - [x] SubTask 3.3: 确认工具坞不参与业务 definition、不修改节点坐标，仍使用现有视口更新回调。
  - [x] SubTask 3.4: 增加共享画布默认行为和 AIGC 定制位置测试。

- [x] Task 4: 完成窄屏互斥面板和命令适配。
  - [x] SubTask 4.1: 小于 `1024px` 时将节点库渲染为左侧 `240px` 覆盖层，添加节点后自动关闭。
  - [x] SubTask 4.2: 将详情栏渲染为右侧最大 `320px`、不超过视口宽度的覆盖层。
  - [x] SubTask 4.3: 打开任一窄屏面板时关闭另一面板，节点选择、详情入口和运行入口使用同一状态规则。
  - [x] SubTask 4.4: 监听桌面断点变化，按既定规则清除节点浮层或保留详情上下文。
  - [x] SubTask 4.5: 保持 `390px` 顶部两行布局和 `minZoom=0.25`，验证全部关键命令可达且无文本重叠。
  - [x] SubTask 4.6: 增加窄屏节点添加、面板互斥、详情标签和 `1023px ↔ 1024px` 切换测试。

- [x] Task 5: 保护自动保存、运行和节点编辑回归。
  - [x] SubTask 5.1: 验证面板开合、标签切换和 Run 选择不触发 `updateAigcPipeline` 或 `updateAigcTemplate`。
  - [x] SubTask 5.2: 验证名称、描述、节点、连线、位置、尺寸、配置和视口仍触发既有 `800ms` 自动保存。
  - [x] SubTask 5.3: 验证返回、执行、从节点继续、另存模板和打开图层编辑器仍使用 `flush()` 后的最新 revision。
  - [x] SubTask 5.4: 验证完整执行和“从此节点继续”成功后打开运行栏并选择新 Run。
  - [x] SubTask 5.5: 验证节点添加、删除、拖拽、缩放、连线校验、结果投影、运行取消与重试行为无回归。

- [x] Task 6: 完成工程检查与浏览器验收。
  - [x] SubTask 6.1: 在 `frontend` 目录运行 `npm test -- tests/aigc-editor.test.tsx`。
  - [x] SubTask 6.2: 运行前端完整 `npm test`、`npm run typecheck`、`npm run lint` 和 `npm run build`。
  - [x] SubTask 6.3: 新增 `frontend/scripts/verify-aigc-workbench-layout.mjs` 和 npm script，使用固定 Pipeline/模板 fixture 自动验收四个视口。
  - [x] SubTask 6.4: Playwright 脚本断言布局、面板交互、顶部命令、工具坞和控制台错误，并将截图写入固定 artifacts 目录。
  - [x] SubTask 6.5: 运行脚本并确认 `1440x900`、`1024x768`、`768x1024` 和 `390x844` 全部通过。
  - [x] SubTask 6.6: 按验收结果更新本目录 `checklist.md`，仅在证据通过后勾选对应项。

# Task Dependencies

- Task 2 和 Task 4 依赖 Task 1。
- Task 3 可在 Task 1 后与 Task 2 并行。
- Task 5 依赖 Task 1 至 Task 4。
- Task 6 依赖 Task 1 至 Task 5。
