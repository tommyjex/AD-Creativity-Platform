# AIGC Seedream 图层工作流 Spec

## Why

AIGC 工作台的 Seedream 图生图节点尚不能使用 Seedream 5.0 Pro 的图层拆分能力，也无法在 DAG 中选择、变换、编辑指定图层并显式合成为新图片。需要在不重复增加模型节点、不修改上游运行结果的前提下，建立可追溯、可重试的图层数据流。

## What Changes

- 保留单一 Seedream 图片模型节点，为现有 `image_to_image` 节点增加 `image_to_image`、`image_edit`、`layer_decomposition` 三种显式模式。
- 不新增独立“图层拆分模型节点”；节点卡片根据模式动态显示名称。
- 新增 `layer_set`、`image_layer`、`edited_layer` 三种端口类型及模式感知的静态端口。
- 新增图层画布节点，用于组合预览、选择图层、移动、等比缩放、排序、显隐和删除。
- 新增独立图层编辑路由，将图层草稿保存到 Pipeline definition，不修改上游 Run 结果且不自动运行。
- 新增图层合成节点，将一个编辑图层显式替换回派生图层集，输出新图层集和扁平图片。
- AIGC 图层集使用独立的不可变 Run 快照，不绑定图片项目 `project_id` 图层表。
- 复用图片项目现有的图层坐标换算、拖拽缩放、透明 PNG 校验和像素合成逻辑。

## Impact

- Affected specs:
  - AIGC 节点注册表、端口与 DAG 校验
  - Seedream 图片任务参数与模型网关
  - AIGC Run 结果、缓存摘要与任务资产关联
  - AIGC 图层画布和独立编辑路由
  - 图片图层合成与透明通道规范化
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/modelark.py`
  - `backend/app/services/image_layers.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/node-registry.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/components/workspace/aigc/*`
  - `frontend/app/workspace/aigc/pipelines/[pipelineId]/nodes/[nodeId]/layers/*`
  - 对应前后端测试

## ADDED Requirements

### Requirement: Seedream 图片模型提供三种互斥模式

系统 SHALL 在单一 `image_to_image` 节点上提供 `image_to_image`、`image_edit`、`layer_decomposition` 三种模式，并根据模式启用固定命名端口。

#### Scenario: 图生图模式

- **WHEN** 节点模式为 `image_to_image`
- **THEN** `image` 端口允许 1 至 10 个 `image_asset` 输入
- **AND** `prompt` 为必填文本输入
- **AND** 仅启用 `image: image_asset` 输出

#### Scenario: 普通图片编辑模式

- **WHEN** 节点模式为 `image_edit` 且连接 `edit_image: image_asset`
- **THEN** `edit_image` 仅允许一个输入
- **AND** `edit_layer` 必须未连接
- **AND** `prompt` 为必填文本输入
- **AND** 仅启用 `image: image_asset` 输出

#### Scenario: 指定图层编辑模式

- **WHEN** 节点模式为 `image_edit` 且连接 `edit_layer: image_layer`
- **THEN** `edit_layer` 仅允许一个输入
- **AND** `edit_image` 必须未连接
- **AND** `prompt` 为必填文本输入
- **AND** 仅启用 `edited_layer: edited_layer` 输出
- **AND** 输出保留来源图层集和图层身份

#### Scenario: 图层拆分模式

- **WHEN** 节点模式为 `layer_decomposition`
- **THEN** `image` 仅允许一个 `image_asset` 输入
- **AND** `prompt` 为可选输入
- **AND** 仅启用 `layers: layer_set` 输出
- **AND** 请求使用 Seedream 5.0 Pro 且设置 `layer_decomposition=true`

#### Scenario: 切换模式后存在不兼容连线

- **WHEN** 用户切换模式后已有连线不再适用于新模式
- **THEN** 系统保留这些连线并明确标记错误
- **AND** 不自动删除用户连线
- **AND** Pipeline 在修复前不可运行

### Requirement: 图层拆分输入和输出符合官方约束

系统 SHALL 对图层拆分输入执行前端预检和后端权威校验，并仅持久化完整有效的拆分结果。

#### Scenario: 合法拆分输入

- **WHEN** 输入为单张 PNG/JPEG，宽高比在 `[1/16,16]`，总像素数在 `[262144,36000000]`，文件小于 30 MB
- **THEN** 系统允许使用 `auto`、`1K`、`1.5K` 或 `2K` 发起拆分
- **AND** 空提示词表示自动识别主要元素

#### Scenario: Provider 返回完整图层

- **WHEN** Provider 返回第一项底图和 1 至 16 个连续 `z_index` 的图层
- **THEN** 系统保存底图和每个透明 PNG 图层为内部资产
- **AND** 返回根 `layer_set` 不可变快照
- **AND** 所有资产写入任务资产关联

#### Scenario: 拆分结果不完整或非法

- **WHEN** 任一图层失败、缺失元数据、没有透明通道或层级不连续
- **THEN** 整项任务失败
- **AND** 不返回部分 `layer_set`
- **AND** 已上传的部分资产被清理

### Requirement: AIGC 图层集是不可变快照

系统 SHALL 使用独立于图片项目的数据结构表达 AIGC `layer_set`，每次变换或合成都创建新快照。

#### Scenario: 创建根快照

- **WHEN** 图层拆分成功
- **THEN** 新快照具有唯一 `id`
- **AND** `parent_layer_set_id` 为 `null`
- **AND** `version=0`
- **AND** `digest` 覆盖底图、图层资产、顺序、变换和可见性

#### Scenario: 创建派生快照

- **WHEN** 图层画布或图层合成节点运行
- **THEN** 结果使用新的快照 ID
- **AND** `parent_layer_set_id` 指向输入快照
- **AND** `version` 比父快照增加 1
- **AND** 不修改父快照及其资产

#### Scenario: 缓存与可用性

- **WHEN** 图层资产、布局补丁、选择或顺序发生变化
- **THEN** 对应节点的 `inputHash` 发生变化
- **AND** 不复用不匹配的历史图层结果
- **AND** 任一必要内部资产不可用时缓存不可用

### Requirement: 图层画布节点提供非破坏性布局编辑

系统 SHALL 提供 `layer_canvas` 节点，接收一个 `layer_set`，保存图层选择和布局补丁，并输出派生图层集及选中图层。

#### Scenario: 节点组合预览

- **WHEN** 上游存在成功的 `layer_set`
- **THEN** 节点卡片按画布坐标叠加所有可见图层
- **AND** 展示图层总数、当前选中图层和布局修改数量

#### Scenario: 编辑图层布局

- **WHEN** 用户打开独立图层编辑页
- **THEN** 页面允许选择非底图图层、移动、等比缩放、排序、显隐和删除
- **AND** 底图保持锁定
- **AND** 编辑页支持保存前撤销和重做

#### Scenario: 保存到节点

- **WHEN** 用户保存图层草稿
- **THEN** 系统只更新对应 `layer_canvas` 节点的选择和变换补丁
- **AND** 通过现有 Pipeline PUT 接口携带 `expected_revision` 立即持久化完整 definition
- **AND** Pipeline revision 递增
- **AND** 不触发运行
- **AND** 保存后的修改不进入主画布本地撤销栈

#### Scenario: 上游图层集变化

- **WHEN** 最新成功上游 `layer_set.digest` 与节点草稿绑定的 digest 不同
- **THEN** 旧选择和布局补丁标记为过期
- **AND** 系统禁止自动套用
- **AND** 用户必须重新进入编辑器确认

### Requirement: 独立图层编辑路由

系统 SHALL 提供 `/workspace/aigc/pipelines/{pipelineId}/nodes/{nodeId}/layers` 路由承载图层画布编辑。

#### Scenario: 进入编辑器

- **WHEN** Pipeline 已保存、目标节点为 `layer_canvas` 且存在成功上游图层集
- **THEN** 路由加载已持久化 Pipeline 和最新成功的上游 `layer_set`
- **AND** 显示左侧工具栏、中央图层画布、右侧图层列表和属性区

#### Scenario: 主画布有未保存修改

- **WHEN** 用户从存在未保存修改的 AIGC 主画布打开图层编辑器
- **THEN** 系统要求先保存 Pipeline
- **AND** 不丢失或隐式持久化其他主画布草稿

#### Scenario: 保存冲突

- **WHEN** 保存时 Pipeline revision 已变化
- **THEN** 返回并展示冲突反馈
- **AND** 保留本地图层草稿
- **AND** 不覆盖服务端 definition

### Requirement: 指定图层编辑保持几何和透明边界

系统 SHALL 在 `image_edit` 模式接收 `image_layer` 时生成新的内部图层资产，并保持原图层几何上下文。

#### Scenario: 编辑指定图层

- **WHEN** 图层画布输出一个有效 `selected_layer`
- **THEN** 图片编辑节点使用该图层资产调用 Seedream
- **AND** 返回 `edited_layer`，携带完全相同的 `layer_set_id`、version、digest、`layer_id`、bbox 和变换

#### Scenario: 规范化编辑结果

- **WHEN** Provider 返回编辑图片
- **THEN** 系统将结果缩放为原图层 bbox 像素尺寸并强制保存为 PNG
- **AND** 无透明通道时应用原图层 alpha 蒙版
- **AND** 有透明通道时将结果 alpha 与原蒙版相乘
- **AND** 编辑内容不能溢出原图层形状

#### Scenario: 规范化失败

- **WHEN** 图片无法解码、尺寸无效或透明蒙版无法应用
- **THEN** 图片编辑任务失败
- **AND** 原图层集和原图层资产保持不变

### Requirement: 图层合成显式替换一个图层

系统 SHALL 提供 `layer_composite` 节点，接收一个 `layer_set` 和一个 `edited_layer`，输出新的图层集和扁平图片。

#### Scenario: 成功替换并合成

- **WHEN** `edited_layer` 的图层集 ID、version、digest 和 `layer_id` 与输入 `layer_set` 完全匹配
- **THEN** 系统仅替换该图层的资产
- **AND** 保留其他图层资产及所有布局属性
- **AND** 创建新的派生 `layer_set`
- **AND** 按可见性和层级合成为新的公共图片资产

#### Scenario: 来源不匹配

- **WHEN** 图层集 ID、version、digest、`layer_id` 或像素尺寸任一不匹配
- **THEN** 合成任务失败
- **AND** 不生成部分结果
- **AND** 不修改任一输入快照

#### Scenario: 连续编辑多个图层

- **WHEN** 用户需要编辑多个图层
- **THEN** 用户串联多组图层画布、图片编辑和图层合成节点
- **AND** 后一组使用前一组输出的 `layer_set`

## MODIFIED Requirements

### Requirement: AIGC 节点注册表和端口

节点注册表 SHALL 增加 `layer_set`、`image_layer`、`edited_layer` 端口类型，以及 `layer_canvas`、`layer_composite` 节点。Seedream 图片模型 SHALL 固定声明 `image`、`edit_image`、`edit_layer`、`prompt` 输入和 `image`、`edited_layer`、`layers` 输出，由 `operation` 控制启用状态。前后端注册表和连接校验 SHALL 保持一致。

### Requirement: AIGC 任务结果和资产生命周期

AIGC 任务结果 SHALL 能表达 `layer_set`、`image_layer` 和 `edited_layer` 结构化结果。底图、内部图层、编辑图层和最终图片均 SHALL 通过现有任务资产关系记录；内部资产不进入普通资产选择列表，失败、拒绝提交或失效缓存的清理不得删除仍被其他历史任务引用的资产。

### Requirement: 旧图生图画布兼容

缺少 `operation` 的现有 `image_to_image` 节点 SHALL 按 `operation=image_to_image` 读取。现有 `image` 和 `prompt` 连线、单图/多参考图执行、任务快照和历史结果 SHALL 无需迁移即可继续使用。

## REMOVED Requirements

### Requirement: 独立图层拆分模型节点

**Reason**: 图层拆分与图生图、图片编辑使用相同 Seedream 5.0 Pro 图片模型和 API；重复节点会造成能力与配置重叠。

**Migration**: 不创建该节点类型。界面仅根据 Seedream 图片模型节点的 `operation=layer_decomposition` 动态显示“图层拆分”名称和对应端口。
