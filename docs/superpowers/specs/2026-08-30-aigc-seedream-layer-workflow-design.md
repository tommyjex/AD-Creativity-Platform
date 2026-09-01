# AIGC Seedream 图层工作流设计

## 1. 背景

AIGC 工作台当前提供独立的文生图和图生图节点。Seedream 5.0 Pro 同时支持普通图生图、图片编辑和图层拆分；其中图层拆分通过图片生成 API 的 `layer_decomposition=true` 开启，返回一张底图和最多 16 个透明 PNG 图层。

本设计把这些能力收敛到同一个 Seedream 图片模型节点，并在 DAG 中增加图层画布和图层合成能力，使用户可以拆分图片、选择指定图层、通过下游 Seedream 节点编辑该图层，再将结果合并回原图层集合。

## 2. 核心决策

### 2.1 不新增独立的图层拆分模型节点

节点面板只提供一个 `Seedream 图片模型` 节点。该节点通过显式模式配置提供三种能力：

1. `图生图`：根据 1 至 10 张参考图和提示词生成一张新的扁平图片。
2. `图片编辑`：编辑一张目标图片或一个指定图层，生成新的图片或图层内容。
3. `图层拆分`：将一张 PNG/JPEG 图片拆分为底图和多个透明图层。

“图层拆分节点”仅是 Seedream 图片模型节点处于 `layer_decomposition` 模式时的动态显示名称，不是新的节点类型，不在节点面板重复展示。

### 2.2 图层变换归属于图层画布节点

新增 `图层画布` 节点，负责：

- 将上游 `layer_set` 中的底图和全部可见图层叠加预览。
- 选择一个目标图层。
- 移动、等比缩放、调整层级、切换显隐和删除非底图图层。
- 保存图层布局草稿。
- 输出选中图层上下文和应用布局草稿后的派生图层集合。

节点卡片只提供组合缩略预览、当前选中图层、修改数量和“打开图层编辑器”入口。复杂操作在独立全屏路由中完成，不在紧凑节点卡片内编辑。

### 2.3 图层替换和合成必须显式建模

不允许图片编辑节点隐式修改上游图层集合。完整数据流为：

```text
图片输入
  -> Seedream 图片模型（图层拆分）
  -> 图层画布
  -> Seedream 图片模型（图片编辑）
  -> 图层合成
  -> 图片输出
```

图层画布还需要将派生 `layer_set` 直接连接到图层合成节点。图层合成节点同时接收：

- 图层画布输出的派生 `layer_set`。
- 图片编辑节点输出的一个 `edited_layer`。

图层合成节点按 `layer_id` 替换图层内容，沿用图层画布中保存的 `x`、`y`、`scale`、`z_index` 和 `visible`，输出新的扁平图片资产和新的可继续编辑的 `layer_set`。

## 3. 节点与端口契约

### 3.1 Seedream 图片模型节点

节点类型继续使用现有 `image_to_image`，新增 `operation` 配置：

```text
image_to_image | image_edit | layer_decomposition
```

注册表固定声明以下端口，由 `operation` 控制启用状态：

- 输入：`image: image_asset`、`edit_image: image_asset`、`edit_layer: image_layer`、`prompt: text`。
- 输出：`image: image_asset`、`edited_layer: edited_layer`、`layers: layer_set`。
- `image_to_image` 只启用 `image`、`prompt` 和 `image` 输出。
- `image_edit` 启用 `edit_image`、`edit_layer`、`prompt`，并根据唯一目标输入启用对应的 `image` 或 `edited_layer` 输出。
- `layer_decomposition` 只启用 `image`、可选 `prompt` 和 `layers` 输出。

#### 图生图模式

- 输入：
  - `image`：`image_asset`，1 至 10 个。
  - `prompt`：`text`，必填。
- 输出：
  - `image`：`image_asset`。
- 用途：多参考图融合或生成新的扁平图片。

#### 图片编辑模式

- 输入：
  - `edit_image`：`image_asset`，最多 1 个。
  - `edit_layer`：`image_layer`，最多 1 个。
  - `prompt`：`text`，必填。
- 校验：
  - `edit_image` 和 `edit_layer` 必须且只能连接其中一个。
- 输出：
  - 连接 `edit_image` 时启用 `image` 输出，类型为 `image_asset`。
  - 连接 `edit_layer` 时启用 `edited_layer` 输出，类型为 `edited_layer`，并保留来源图层上下文。
- 用途：编辑单张图片，或修改图层画布中选中的指定图层。

节点注册表使用上述静态命名端口，不使用联合端口类型。前端根据 `operation` 和当前目标输入显示有效端口；后端按相同规则校验。切换模式后不兼容的既有连线保留并标记错误，但不能执行。

#### 图层拆分模式

- 输入：
  - `image`：`image_asset`，仅 1 个。
  - `prompt`：`text`，可选；为空时自动识别主要元素。
- 输出：
  - `layers`：`layer_set`。
- 固定约束：
  - 仅 Seedream 5.0 Pro 可用。
  - 输入格式仅 PNG、JPEG。
  - 输入宽高比范围 `[1/16, 16]`。
  - 输入总像素数（宽乘高）范围 `[262144, 36000000]`。
  - 单图不超过 30 MB。
  - `size` 可选 `auto`、`1K`、`1.5K`、`2K`，默认 `auto`。
  - 请求设置 `layer_decomposition=true`。
  - 任一图层生成失败时整项任务失败，不接受部分结果。

### 3.2 图层画布节点

节点类型：`layer_canvas`。

- 输入：
  - `layers`：`layer_set`，仅 1 个。
- 输出：
  - `selected_layer`：`image_layer`，仅当用户已选择有效的非底图图层。
  - `layers`：`layer_set`，应用节点布局草稿后的派生图层集合。
- 配置：
  - `selected_layer_id`。
  - 按 `layer_id` 保存的变换补丁：`x`、`y`、`scale`、`z_index`、`visible`、`deleted`。
- 规则：
  - 底图不可移动、缩放、隐藏、删除或作为图片编辑目标。
  - 删除只写入节点草稿，不删除上游资产。
  - 缩放始终保持图层原始宽高比，范围沿用现有 `[0.05, 20]`。
  - 从 AIGC 画布进入编辑器前，Pipeline 必须已保存；若画布存在未保存修改，先提示用户保存。
  - “保存到节点”只修改 `layer_canvas` 节点配置，并通过现有 Pipeline PUT 接口立即持久化完整 definition，携带 `expected_revision`。
  - 保存成功后 Pipeline revision 递增，但不触发 DAG 运行；编辑器中的撤销/重做只作用于本次尚未提交的图层草稿。

### 3.3 图层合成节点

节点类型：`layer_composite`。

- 输入：
  - `layers`：`layer_set`，仅 1 个。
  - `replacement`：`edited_layer`，仅 1 个。
- 输出：
  - `image`：合成后的 `image_asset`。
  - `layers`：完成替换后的新 `layer_set`。
- 规则：
  - 按 `edited_layer.layer_id` 替换对应图层资产。
  - 未被替换的图层沿用派生 `layer_set` 的资产和变换。
  - 输出为新版本，不覆盖拆分任务或图层画布节点的输入结果。

首期一次图层合成只替换一个指定图层。需要编辑多个图层时，用户串联多组“图层画布/图片编辑/图层合成”，下一组使用上一组输出的 `layer_set`。

## 4. 图层数据结构

`layer_set` 是 AIGC Run 结果中的不可变结构化快照，不依赖图片项目的 `project_id` 图层表。

```text
layer_set
  id
  parent_layer_set_id
  source_asset_id
  base_asset_id
  canvas_width
  canvas_height
  version
  digest
  layers[]
    id
    asset_id
    z_index
    name
    description
    bbox_absolute
    bbox_normalized
    visible
    x
    y
    scale
```

`image_layer` 和 `edited_layer` 除资产 ID 外，必须携带：

```text
layer_set_id
layer_set_version
layer_set_digest
layer_id
bbox_absolute
bbox_normalized
x
y
scale
z_index
```

图层图片使用内部资产保存，不出现在普通资产选择列表。底图和所有图层都写入 AIGC 任务资产关联，保证运行历史、清理和可用性检查完整。

每个 `layer_set` 都是不可变快照：

- 图层拆分创建新 `id`，`parent_layer_set_id=null`，`version=0`。
- 图层画布运行时创建新 `id`，父级为输入快照，`version=父级 version+1`。
- 图层合成创建新 `id`，父级为图层画布输出快照，`version=父级 version+1`。
- `digest` 由底图资产、按层级排序的图层资产、几何变换和可见性共同计算。
- 合成要求 `edited_layer` 携带的 `layer_set_id`、`layer_set_version` 和 `layer_set_digest` 与 `layers` 输入完全一致；不使用可变行 revision 推断来源。

## 5. 运行与版本语义

### 5.1 图层拆分

1. 校验单张输入图片。
2. 调用 Seedream，设置 `layer_decomposition=true`。
3. 校验返回第一项为唯一底图，后续 `z_index` 从 1 连续递增且不超过 16。
4. 下载并保存底图及透明 PNG 图层。
5. 返回新的根 `layer_set` 快照，`version=0`。

### 5.2 图层画布

图层画布不修改上游 Run 结果。运行时将节点配置中的变换补丁应用到输入 `layer_set`，生成派生快照：

- 被删除图层从派生集合移除并重新生成连续层级。
- 其他图层应用移动、缩放、显隐和排序。
- 派生集合创建新 ID，并记录上游快照为 `parent_layer_set_id`。
- 选中图层输出携带派生集合 ID、version、digest 和完整来源上下文。

节点配置、上游 `layer_set` 摘要和所有变换补丁共同参与 `inputHash`。

图层草稿绑定打开编辑器时使用的上游 `layer_set.digest`。如果重新执行拆分后上游 digest 改变，旧草稿和图层选择标记为过期，禁止自动套用到新图层；用户需要重新打开图层编辑器确认。

### 5.3 图片编辑与合成

图片编辑节点接收 `image_layer` 时：

1. 使用选中图层资产调用 Seedream 图片编辑。
2. 将结果保存为新的内部图层资产。
3. 将模型结果解码并缩放到原图层 bbox 的像素尺寸。
4. 输出强制保存为 PNG。若模型结果没有透明通道，应用原图层 alpha 蒙版；若模型结果已有透明通道，与原 alpha 蒙版相乘，禁止内容溢出原图层形状。
5. 返回 `edited_layer`，继承原 `layer_id`、bbox 和变换上下文；图片编辑不得改变几何信息。

图层合成节点使用输入 `layer_set` 和单个 `edited_layer` 创建新的图层集快照，再在后端完成像素合成。若 `layer_set_id`、digest、`layer_id` 或规范化后的图层像素尺寸不匹配，任务失败，不静默替换其他版本。

## 6. 前端交互

### 6.1 Seedream 节点配置

检查器顶部使用三段式控件切换：

```text
图生图 | 图片编辑 | 图层拆分
```

切换模式后动态调整端口、参数和节点摘要。存在不兼容连线时保留连线并显示明确错误，禁止保存为可运行状态；不自动删除用户连线。

### 6.2 图层画布节点卡片

节点卡片展示：

- 全部可见图层的合成缩略图。
- 当前选中图层名称。
- 图层总数和布局修改数量。
- `打开图层编辑器` 操作。
- `selected_layer` 与 `layers` 两个输出连接点。

### 6.3 独立图层编辑路由

路由：

```text
/workspace/aigc/pipelines/{pipelineId}/nodes/{nodeId}/layers
```

页面布局：

- 左侧窄工具栏：选择、缩放视图、适应画布、撤销、重做。
- 中央画布：按照原始画布坐标系叠加底图和全部可见图层。
- 右侧图层列表和属性区：选中、排序、显隐、删除，以及 `x/y/scale` 精确值。
- 顶部操作：返回、放弃修改、保存到节点。

点击画布或图层列表均可选中图层；拖拽移动，拖拽角点等比缩放。保存后更新 Pipeline definition 中对应图层画布节点的配置，遵循 Pipeline revision 乐观锁。成功后返回 AIGC 画布，但不自动运行、不自动保存其他未提交修改。

该路由始终从服务端读取已持久化的 Pipeline 和最新成功的上游 `layer_set`。AIGC 主画布存在未保存修改时，必须先保存 Pipeline 才能进入；因此“保存到节点”发送的 definition 只包含该页面基于最新持久化版本产生的图层画布配置修改，不会夹带主画布中的其他本地草稿。

## 7. 错误处理

- 图层拆分模式连接多张图片：运行前返回可定位到节点的输入数量错误。
- 输入格式、尺寸、像素或大小不合规：前端预检提示，后端权威校验并拒绝调用模型。
- Provider 返回部分图层或非法层级：整项任务失败，不持久化不完整 `layer_set`。
- 选中图层已被布局草稿删除：禁止输出 `selected_layer`。
- 图片编辑结果无法规范化为透明图层：任务失败，原图层集保持不变。
- 合成时图层集合 ID、version、digest 或 layer ID 不匹配：返回冲突错误，不覆盖其他分支。
- 保存图层画布时 Pipeline revision 冲突：保留本地草稿并提示重新加载，不自动覆盖远端。

## 8. 兼容性与迁移

- 现有 `image_to_image` 节点缺少 `operation` 时按 `image_to_image` 处理。
- 现有单图和多参考图画布无需迁移，端口和结果保持兼容。
- `layer_set`、`image_layer`、`edited_layer` 是新增端口类型，不与普通 `image_asset` 自动互连。
- 图片项目现有图层编辑器保持不变；复用其坐标换算、拖拽、等比缩放、排序和像素合成逻辑，但 AIGC 图层数据使用独立的 Run 快照，不要求绑定项目。

## 9. 非目标

- 不支持在一个图片编辑节点中同时编辑多个图层。
- 不支持一个图层合成节点同时替换多个图层。
- 不支持旋转、自由形变、蒙版绘制和混合模式。
- 不支持自动回写或覆盖上游拆分结果。
- 不将内部底图和透明图层暴露到普通资产库选择器。
- 不改变文生图节点和图片项目现有工作流。

## 10. 测试与验收

### 后端

- 三种模式的端口数量、必填项和格式校验。
- `layer_decomposition=true` 请求及底图、最多 16 个图层的响应解析。
- 内部图层资产、任务资产关联和失败回滚。
- 图层画布变换补丁、删除、排序和 `inputHash`。
- 指定图层编辑保留 `layer_id` 上下文。
- 单 replacement 合成、快照来源冲突和结果资产。
- 旧 `image_to_image` definition 兼容。

### 前端

- 三段式模式切换和动态端口。
- 图层画布节点组合预览、选层状态和双输出端口。
- 独立路由直达、刷新、返回和 Pipeline revision 冲突。
- 图层选择、移动、等比缩放、排序、显隐、删除、撤销和重做。
- 保存前可在独立图层编辑页内撤销和重做；保存到节点后立即形成新的 Pipeline revision，不进入主画布本地撤销栈，也不自动运行。

### 浏览器验收

- 完整连接并执行：

```text
图片输入
  -> Seedream（图层拆分）
  -> 图层画布
  -> Seedream（图片编辑）
  -> 图层合成
  -> 图片输出
```

- 验证图层组合预览与原图一致。
- 修改图层位置、缩放、层级、显隐和删除后保存，刷新可恢复。
- 编辑指定图层后合成结果只替换目标层，其余图层与布局保持不变。
- 原拆分结果和原图层资产仍可追溯。
