# Tasks

- [x] Task 1: 建立统一的 AIGC 节点派生显示名能力。
  - [x] SubTask 1.1: 新增纯函数，根据节点类型、模式标题和 `definition.nodes` 顺序计算基础显示名、重复数量及 1-based 编号。
  - [x] SubTask 1.2: 为文本、图片、视频、音频输入节点使用“文本节点 / 图片节点 / 视频节点 / 音频节点”基础名称，其他节点复用注册表或现有模式标题。
  - [x] SubTask 1.3: 单个同名节点不加编号，多个同名节点连续编号；新增、删除和模式变化后重新派生，拖拽不改变编号。
  - [x] SubTask 1.4: 添加纯函数测试，覆盖单节点、重复节点、删除后重排、不同模式标题分组和稳定 ID 不变。

- [x] Task 2: 将派生显示名接入 AIGC 编辑器全部节点识别界面。
  - [x] SubTask 2.1: 画布节点标题使用统一派生显示名，保留现有 Seedream operation 标题语义。
  - [x] SubTask 2.2: 右侧配置分组标题使用与画布一致的派生显示名。
  - [x] SubTask 2.3: 精准框选弹窗中的可绑定文本节点使用“文本节点N”，BBox 引用来源使用“图片节点N”，移除操作保留稳定节点 ID 作为内部参数。
  - [x] SubTask 2.4: 更新可访问名称和相关测试，确保用户可见名称不再依赖截断 UUID。

- [x] Task 3: 将结构化 BBox 引用重组为统一提示词编辑面。
  - [x] SubTask 3.1: 重构 `AigcPromptEditor`，用一个统一边界和滚动容器承载基础文本、按序 BBox token 与各自说明输入，移除独立“框选引用”卡片区。
  - [x] SubTask 3.2: 将现有大型 `BboxReferenceCard` 替换为适合编辑器内的紧凑不可编辑 token，显示来源派生名、当前坐标、可选小缩略图及可访问移除按钮。
  - [x] SubTask 3.3: 新绑定引用按 `bbox_references` 顺序追加；加载中或失效引用在原位置显示紧凑状态 token，不阻断其他文本编辑。
  - [x] SubTask 3.4: 保持基础文本、引用说明、10 条上限、手工坐标标签拦截、单条删除、自动同步和 Zustand 历史操作的数据契约不变。
  - [x] SubTask 3.5: 保持提示词优化只更新基础文本与说明，优化期间统一禁用可编辑字段和删除操作，过期响应保护与一次撤销语义不变。

- [x] Task 4: 补充前端回归测试。
  - [x] SubTask 4.1: 更新 `aigc-prompt-editor` 测试，断言基础文本、token 和说明处于同一编辑面，不存在独立引用卡片区。
  - [x] SubTask 4.2: 覆盖 token 来源编号、坐标更新、说明编辑、单条删除、失效占位、禁止手工标签、优化和撤销。
  - [x] SubTask 4.3: 更新 `aigc-flow-node` 与 `aigc-editor` 测试，覆盖重复节点编号、单节点无编号、删除重排、拖拽不改编号及画布/配置/弹窗名称一致。
  - [x] SubTask 4.4: 保留节点增删、连线校验、BBox 生命周期同步、自动保存、模板净化和运行时 prompt 编译既有测试。

- [x] Task 5: 完成工程检查与多视口验收。
  - [x] SubTask 5.1: 运行节点显示名、提示词编辑器、AIGC 节点和编辑器定向 Vitest。
  - [x] SubTask 5.2: 运行前端完整 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 5.3: 使用 Playwright 在 `1440x900`、`1024x768` 和 `390x844` 验证重复节点编号、内嵌 token、说明编辑、移除操作、详情栏滚动及无文本/控件重叠。
  - [x] SubTask 5.4: 验证浏览器控制台无新增错误，普通工作区、单节点提示词和无 BBox 提示词无视觉或交互回归。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 可在 Task 1 完成后与 Task 2 并行。
- Task 4 依赖 Task 2 和 Task 3。
- Task 5 依赖 Task 4。
