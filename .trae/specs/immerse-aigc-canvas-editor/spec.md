# 沉浸式 AIGC 画布与高级工具栏 Spec

## Why

当前 Pipeline 与模板画布仍位于全局 `64px` 导航栏下方，实际编辑区只能使用 `100dvh - 4rem`，同时全局导航与画布工具栏形成两层顶栏，削弱创作专注度。画布工具栏目前缺少可见的画布身份，命令层级也不够清晰。

本变更让 AIGC Pipeline 与模板画布使用完整视口，并将画布工具栏升级为克制、专业的深色命令栏。目标是增加有效画布面积、强化当前画布的识别，同时保持保存、运行、面板和节点编辑语义不变。

## What Changes

- AIGC Pipeline 与模板画布路由进入沉浸式 Shell，不渲染全局导航栏或其 `64px` 顶部占位。
- 画布编辑器及其路由错误态使用完整 `100dvh` 高度；AIGC 列表页和其他工作台页面继续保留全局导航。
- 画布顶部工具栏升级为石墨黑工作台命令栏，使用清晰的左、中、右信息层级、细分隔线、轻量阴影与克制的蓝色主操作强调。
- 左侧展示返回入口、画布名称和 Pipeline/模板身份；右侧按面板操作、文档操作和执行操作分组。
- 自动保存状态不在工具栏中可见展示，仅保留屏幕阅读器使用的 `aria-live` 状态播报。
- 长标题和窄屏场景使用确定性的截断与渐进收缩规则，保证返回、详情和 Pipeline 执行命令始终可达。
- 保持现有节点库显隐、详情栏、运行记录、另存模板、执行、自动保存、`flush()`、冲突保护和模板不可执行规则。
- 不新增后端 API、数据字段、Pipeline definition 字段或持久化 UI 状态。

## Impact

- Affected specs:
  - AIGC 画布路由布局
  - AIGC 专业工作台顶部命令栏
  - 自动保存无障碍播报
  - 响应式画布布局
- Affected code:
  - `frontend/components/layout/app-shell.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/app/workspace/aigc/pipelines/[pipelineId]/page.tsx`
  - `frontend/app/workspace/aigc/templates/[templateId]/page.tsx`
  - `frontend/tests/workspace-navigation.test.tsx`
  - `frontend/tests/aigc-editor.test.tsx`
  - `frontend/scripts/verify-aigc-workbench-layout.mjs`
- Backend API、数据库、AIGC DTO、运行编排和画布 definition 不变。

## Design Decision

- **采用：路由级沉浸式 Shell + 单层专业命令栏。** 由 `AppShell` 根据画布路由移除全局导航，编辑器负责唯一顶栏，职责清晰且与现有图层、时间线全屏路由一致。
- 未采用浏览器 Fullscreen API：它需要用户手势、会改变浏览器退出语义且不适合作为页面默认布局。
- 未采用在普通 Shell 上用负边距或固定定位覆盖导航：该方案会保留隐藏占位并增加层级、滚动和移动端适配风险。
- 工具栏采用“精密控制台”视觉方向：中性石墨色、低对比边框、紧凑图标和单一蓝色主命令，不使用装饰渐变、发光色块或大面积品牌背景。
- 不增加新的编辑命令；本次只重组既有信息与操作，避免改变用户工作流和保存契约。

## ADDED Requirements

### Requirement: 画布路由使用沉浸式 Shell

系统 SHALL 仅为 AIGC Pipeline 与模板画布编辑页移除全局导航，并让编辑器占满浏览器动态视口。

#### Scenario: 打开 Pipeline 画布

- **WHEN** 用户打开 `/workspace/aigc/pipelines/[pipelineId]`
- **THEN** 页面不渲染全局导航栏、品牌标识或移动导航菜单
- **AND** `AppShell` 内容区不保留 `pt-16`
- **AND** AIGC 编辑器高度为 `100dvh`
- **AND** 页面不得产生由双层顶栏导致的纵向滚动

#### Scenario: 打开模板画布

- **WHEN** 用户打开 `/workspace/aigc/templates/[templateId]`
- **THEN** 页面使用与 Pipeline 画布一致的沉浸式 Shell
- **AND** 模板模式继续保持不可执行

#### Scenario: 打开非画布页面

- **WHEN** 用户打开 `/workspace/aigc`、项目、资产库或工具页面
- **THEN** 全局导航继续正常显示
- **AND** 现有导航高亮和移动导航行为不变

#### Scenario: 打开深层编辑器

- **WHEN** 用户打开现有图层编辑器或时间线编辑器路由
- **THEN** 继续使用现有沉浸式 Shell
- **AND** 本变更不得破坏其高度、背景或返回行为

#### Scenario: 画布数据加载失败

- **WHEN** Pipeline 或模板详情请求失败
- **THEN** 错误状态在无全局导航的完整 `100dvh` 内容区内居中
- **AND** 不保留 `100dvh - 4rem` 的旧高度计算

### Requirement: 高级画布工具栏

系统 SHALL 使用单一、稳定的深色命令栏承载画布身份、保存反馈和既有关键命令。

#### Scenario: 桌面端查看工具栏

- **WHEN** 视口宽度不小于 `1024px`
- **THEN** 工具栏横向分为画布身份区和命令区
- **AND** 工具栏高度稳定，不因标题、状态或运行状态变化而改变
- **AND** 使用中性石墨背景、`1px` 低对比底边、克制阴影和不超过 `8px` 的控件圆角
- **AND** 不使用渐变、装饰光球或高饱和大面积底色

#### Scenario: 识别当前画布

- **WHEN** 用户进入 Pipeline 或模板画布
- **THEN** 返回图标后展示当前画布名称
- **AND** 展示紧凑的“画布”或“模板”身份标识
- **AND** 名称过长时单行截断，完整名称可通过 `title` 或等价可访问说明读取
- **AND** 名称展示不新增独立保存或编辑状态

#### Scenario: 自动保存状态保持隐藏

- **WHEN** 自动保存状态为已保存、保存中、待保存、失败或冲突
- **THEN** 工具栏不展示状态文本或状态图标
- **AND** 状态变化通过隐藏的 `aria-live` 区域向辅助技术播报
- **AND** 状态展示不得改变自动保存时序、触发额外保存或绕过冲突保护

#### Scenario: Pipeline 命令分组

- **WHEN** 用户编辑 Pipeline
- **THEN** 详情、另存为模板和执行保持可访问
- **AND** 详情属于面板操作组，另存为模板属于文档操作组，执行作为最右侧主命令
- **AND** 各组之间使用间距或细分隔线形成层级
- **AND** 执行中的加载、禁用与文案继续使用现有业务规则

#### Scenario: 模板命令分组

- **WHEN** 用户编辑模板
- **THEN** 工具栏展示返回、画布身份和详情
- **AND** 不展示另存为模板或执行
- **AND** 命令缺失后不得留下无意义分隔线或空白占位

#### Scenario: 图标按钮可访问

- **WHEN** 工具栏使用仅图标按钮
- **THEN** 使用现有 Lucide 图标
- **AND** 按钮具有明确的 `aria-label` 和悬停 `title`
- **AND** 键盘焦点具有清晰可见的 focus ring
- **AND** 点击目标尺寸在桌面和触屏视口均不小于 `40px`

### Requirement: 工具栏响应式收缩

系统 SHALL 在桌面、平板和手机视口保持工具栏命令可达且文本不重叠。

#### Scenario: 平板宽度

- **WHEN** 视口宽度介于 `768px` 与 `1023px`
- **THEN** 工具栏保持单行
- **AND** 次要命令隐藏文字但保留图标、工具提示和可访问名称
- **AND** 画布名称在受限宽度内截断
- **AND** Pipeline 执行入口保持可见

#### Scenario: 手机宽度

- **WHEN** 视口宽度为 `390px` 或同等级窄屏
- **THEN** 工具栏仍保持稳定高度且不水平溢出
- **AND** 返回、详情和 Pipeline 执行入口始终可达
- **AND** 身份标识与低优先级状态文案可按既定优先级收缩为图标或隐藏
- **AND** 隐藏可见文案时仍保留辅助技术可读状态
- **AND** 任意文本不得覆盖相邻按钮或被按钮遮挡

### Requirement: 沉浸式布局不改变编辑行为

系统 SHALL 将本变更限制在路由 Shell 与工具栏表现层，不改变画布业务数据和交互语义。

#### Scenario: 使用画布能力

- **WHEN** 用户添加、选择、移动、缩放、连接或删除节点
- **THEN** 行为与变更前一致
- **AND** 节点库、详情栏和底部视图工具坞继续按既有规则工作

#### Scenario: 离开或执行画布

- **WHEN** 用户返回工作台、另存模板、执行或进入深层编辑器
- **THEN** 继续在命令前执行现有 `flush()`
- **AND** 保存失败、草稿无效或 `409` 冲突继续阻止依赖最新 revision 的操作

#### Scenario: 调整视口

- **WHEN** 用户在桌面、平板和手机尺寸间调整窗口
- **THEN** 工具栏与画布不发生不可恢复的重叠
- **AND** 不修改节点坐标、React Flow viewport 或节点库持久化偏好

## MODIFIED Requirements

### Requirement: AIGC 画布页面高度

系统 SHALL 将原“保留顶部全局导航，主体使用 `h-[calc(100dvh-4rem)]`”修改为“隐藏顶部全局导航，AIGC Pipeline 与模板画布主体使用 `h-[100dvh]`”。

#### Scenario: 首屏画布面积

- **WHEN** 用户打开任意 AIGC Pipeline 或模板画布
- **THEN** 画布编辑器从视口顶部开始
- **AND** 页面仅保留画布自身工具栏
- **AND** 工具栏以下的节点区使用全部剩余高度

### Requirement: AIGC 顶部命令信息

系统 SHALL 保持自动保存状态仅供屏幕阅读器通过 `aria-live` 读取，不在工具栏中显示状态图标或文案，并在工具栏中显示当前画布名称与模式身份。

#### Scenario: 保存成功

- **WHEN** 最新修改已成功保存
- **THEN** 工具栏不展示已保存状态
- **AND** 屏幕阅读器仍可读取最新保存状态
- **AND** 该状态不引入新的手动保存按钮

## REMOVED Requirements

### Requirement: AIGC 主画布保留全局导航

**Reason**: 双层顶栏压缩有效画布高度并削弱沉浸式创作体验。

**Migration**: Pipeline 与模板画布通过画布工具栏左侧返回入口回到 AIGC 工作台；AIGC 列表页及其他工作台页面继续使用全局导航。
