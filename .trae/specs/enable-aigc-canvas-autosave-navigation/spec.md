# AIGC 画布自动保存与返回导航 Spec

## Why

当前 AIGC 画布返回按钮进入工作台默认的“画布模板”视图，用户需要再次切换才能找到刚编辑的画布；同时画布依赖手动保存，容易在执行、进入图层编辑器或离开页面前遗漏保存。本变更让 Pipeline 画布返回“我的画布”，并以可观测、串行且保留 revision 冲突保护的自动保存替代常驻手动保存。

## What Changes

- Pipeline 画布的返回按钮导航到 `/workspace/aigc?view=pipelines`，列表页据此默认选中“我的画布”。
- 模板编辑器返回 `/workspace/aigc?view=templates`，保持模板编辑语义。
- Pipeline 与模板编辑器对可持久化变更执行 `800ms` 防抖自动保存。
- 自动保存使用单飞串行队列和最新草稿续存，禁止并发提交相同 revision。
- 执行、从节点继续、另存为模板、进入图层编辑器及返回列表前 flush 最新草稿。
- 用“等待自动保存 / 正在保存 / 已保存 Revision N / 自动保存失败 / 保存冲突”状态替代常驻保存按钮。
- 保存失败时保留 dirty 与离开保护；网络或服务端瞬时失败自动重试，revision 冲突不静默覆盖。
- **BREAKING（交互）**：移除 Pipeline 和模板编辑器顶部常驻“保存”按钮，用户不再以手动保存作为正常工作流。

## Impact

- Affected specs: `build-aigc-workbench` 的“模板与我的画布列表”“画布定义与编辑”“画布交互布局”“模板、画布与运行持久化”
- Affected code:
  - `frontend/app/workspace/aigc/page.tsx`
  - `frontend/components/workspace/aigc/aigc-workspace.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/lib/aigc/editor-store.ts`
  - AIGC workspace/editor/store tests
- Backend API 与数据库结构不变，继续复用现有 revision 乐观锁更新接口。

## Design Decision

- **采用：防抖单飞自动保存。** 兼顾编辑响应性、请求数量与 revision 顺序，并能在命令前通过 `flush()` 获得确定的已保存版本。
- 未采用“每次状态变更立即保存”：拖动节点、文本输入和视口变化会形成请求风暴，且容易产生 revision 乱序。
- 未采用“固定周期保存”：空闲时仍会轮询，并在返回或执行时留下不确定的未保存窗口。
- 返回目标使用显式 `view` 查询参数，不依赖浏览器 history 或本地存储，保证刷新、深链接和新标签页行为一致。

## ADDED Requirements

### Requirement: 可寻址的工作台视图

系统 SHALL 允许 `/workspace/aigc` 通过 `view` 查询参数选择初始列表视图。

#### Scenario: 返回我的画布

- **WHEN** 用户在 Pipeline 画布点击返回按钮
- **THEN** 系统导航到 `/workspace/aigc?view=pipelines`
- **AND** 工作台默认选中“我的画布”
- **AND** 展示 Pipeline 列表而不是模板列表

#### Scenario: 返回画布模板

- **WHEN** 用户在模板编辑器点击返回按钮
- **THEN** 系统导航到 `/workspace/aigc?view=templates`
- **AND** 工作台默认选中“画布模板”

#### Scenario: 无效视图参数

- **WHEN** 用户访问 `/workspace/aigc` 且 `view` 缺失或不是 `templates / pipelines`
- **THEN** 系统沿用既有默认值 `templates`

### Requirement: 防抖自动保存

系统 SHALL 在 Pipeline 和模板编辑器中自动持久化名称、描述、节点、连线、节点位置与尺寸、节点配置以及视口等画布定义。

#### Scenario: 编辑后自动保存

- **WHEN** 可持久化状态发生变更
- **AND** 连续 `800ms` 没有新的可持久化变更
- **THEN** 客户端提交当前最新草稿、规范化 definition 和当前 `expected_revision`
- **AND** 保存成功后更新本地 revision
- **AND** 仅当已保存快照仍等于当前草稿时清除 dirty

#### Scenario: 高频连续编辑

- **WHEN** 用户连续输入、拖动、缩放或配置多个节点
- **THEN** 每次新变更重置尚未开始的 `800ms` 防抖计时
- **AND** 客户端不得为每一个中间状态立即发送保存请求

#### Scenario: 保存期间继续编辑

- **WHEN** 一个保存请求正在执行
- **AND** 用户产生新的可持久化变更
- **THEN** 当前请求继续使用其提交时的不可变快照
- **AND** 客户端不并发发送第二个保存请求
- **AND** 当前请求成功并更新 revision 后，继续保存最新草稿
- **AND** 旧请求成功不得把保存后产生的新变更错误标记为已保存

#### Scenario: 无有效变更

- **WHEN** 当前草稿与已保存基线一致
- **THEN** 客户端不发送更新请求
- **AND** 选择节点、切换右侧标签或查看历史 Run 等非持久化 UI 状态不得触发自动保存

### Requirement: 自动保存状态

系统 SHALL 在画布标题区域持续展示准确的持久化状态，并移除常驻手动保存按钮。

#### Scenario: 等待与保存

- **WHEN** 草稿正在等待防抖
- **THEN** 显示“等待自动保存”
- **WHEN** 保存请求进行中
- **THEN** 显示“正在保存”
- **WHEN** 最新草稿保存成功
- **THEN** 显示“已保存 Revision N”

#### Scenario: 自动保存失败

- **WHEN** 保存因网络错误或 `5xx` 失败
- **THEN** 客户端按 `1s / 2s / 4s` 退避最多自动重试 3 次
- **AND** 重试期间保持 dirty，不显示“已保存”
- **AND** 重试耗尽后显示可读的“自动保存失败”原因
- **AND** 后续新变更或浏览器 `online` 事件重新启动自动保存

#### Scenario: revision 冲突

- **WHEN** 保存接口返回 `409`
- **THEN** 自动保存停止继续提交
- **AND** 显示持久的“保存冲突：服务端已有更新，请刷新后重新编辑”
- **AND** 保留本地草稿和 dirty 状态
- **AND** 不使用新 revision 静默覆盖服务端内容

#### Scenario: 草稿暂时无效

- **WHEN** 名称为空或画布 definition 当前不能通过保存校验
- **THEN** 不提交无效更新
- **AND** 显示具体校验原因
- **AND** 保留 dirty
- **AND** 用户修正草稿后重新进入自动保存流程

### Requirement: 离开与命令前 flush

系统 SHALL 在依赖持久化 revision 的导航或命令前等待最新草稿保存完成。

#### Scenario: 返回列表

- **WHEN** 用户点击返回按钮且存在等待保存或正在保存的变更
- **THEN** 客户端立即取消防抖等待并 flush 最新草稿
- **AND** 保存成功后再导航到目标列表
- **AND** 保存失败或冲突时停留在画布并展示错误

#### Scenario: 执行与从节点继续

- **WHEN** 用户执行完整画布或选择“从此节点继续”
- **THEN** 客户端先 flush 最新有效草稿
- **AND** 使用保存返回的最新 revision 创建 Run
- **AND** 保存失败、校验失败或冲突时不得创建 Run

#### Scenario: 另存为模板或进入图层编辑器

- **WHEN** 用户另存为模板或打开图层编辑器
- **THEN** 客户端先 flush 最新草稿
- **AND** 保存成功后继续原操作
- **AND** 不再提示用户先点击手动保存

#### Scenario: 浏览器级离开

- **WHEN** 页面仍存在等待保存、正在保存、失败或冲突的 dirty 草稿
- **THEN** 保留 `beforeunload` 离开保护
- **WHEN** 最新草稿已经成功保存
- **THEN** 不触发未保存离开提示

## MODIFIED Requirements

### Requirement: 模板与我的画布列表

系统 SHALL 在 AIGC 列表页提供“画布模板”和“我的画布”两个视图；直接进入工作台时默认展示画布模板，通过合法 `view` 查询参数进入时展示指定视图。

### Requirement: 画布定义与编辑

系统 SHALL 使用版本化的画布定义保存节点、端口、连线、位置、尺寸、配置和视口，不在定义中保存运行时任务状态；可持久化变更通过自动保存提交，不要求用户点击手动保存。

### Requirement: 画布交互布局

系统 SHALL 在独立画布页提供返回列表、画布名称、自动保存状态、撤销/重做、另存为模板和执行命令；顶部不再提供常驻手动保存按钮。

### Requirement: revision 与运行一致性

系统 SHALL 继续使用 `expected_revision` 乐观锁。自动保存必须串行提交，依赖 Pipeline revision 的执行、增量执行、图层编辑器跳转和另存模板必须使用成功保存后的最新 revision。

## REMOVED Requirements

### Requirement: 常驻手动保存

**Reason**: 自动保存成为标准持久化路径，继续保留常驻“保存”按钮会产生双重状态与不一致预期。

**Migration**: 既有更新 API、revision 字段与后端校验保持不变；前端将原手动 `save()` 能力收敛为自动保存协调器与命令前 `flush()`。

### Requirement: 正常返回时的未保存确认

**Reason**: 返回命令应先 flush 自动保存，成功后直接离开，不再要求用户判断是否丢弃正常可保存草稿。

**Migration**: 保存失败、校验失败、正在保存或 revision 冲突时仍阻止导航；浏览器级关闭继续使用 `beforeunload` 保护。
