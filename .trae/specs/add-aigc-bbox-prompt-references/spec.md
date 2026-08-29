# AIGC 画布精准框选与提示词引用 Spec

## Why

AIGC 工作台的图片输入节点目前只能提供整张参考图，无法指定需要重点理解或修改的主体区域。项目图片画布已经具备归一化 BBox 框选和防篡改引用能力，需要将这套交互以符合 DAG 语义的方式引入 AIGC 画布。

## What Changes

- 图片输入节点增加“精准编辑”入口，通过大图弹窗框选主体。
- 首期每个图片输入节点最多保存一个归一化 BBox；重新框选替换旧框。
- 框选后可多选严格关联的文本输入节点，将结构化 BBox 引用加入其提示词编辑器。
- 文本节点只保存图片节点引用和引用后的说明文字，不保存可手工修改的坐标标签。
- 运行时根据目标图生图节点的参考图连线顺序，将结构化引用编译为 `图N<bbox>x1 y1 x2 y2</bbox>`。
- BBox 更新时所有引用自动显示新坐标；清除 BBox、更换图片或删除图片节点时自动移除全部关联引用。
- 复用现有 `BboxCanvas` 的 0–1000 归一化坐标、图片内容区测量和缩放对齐逻辑。
- 模板不保存具体资产、BBox 或 BBox 提示词引用。

## Impact

- Affected specs:
  - AIGC Pipeline definition
  - AIGC DAG 语义校验
  - 图生图任务参数解析与 inputHash
  - AIGC 图片输入节点与文本输入节点编辑体验
  - 模板清理与画布历史
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_pipeline.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/canvas/bbox-canvas.tsx`
  - `frontend/components/workspace/canvas/visual-prompt-editor.tsx`
  - 对应前后端测试

## ADDED Requirements

### Requirement: 图片输入节点精准框选

系统 SHALL 为已有图片资产的图片输入节点提供大图精准编辑弹窗，并保存一个归一化 BBox。

#### Scenario: 打开精准编辑

- **WHEN** 用户点击图片输入节点的“精准编辑”
- **THEN** 系统打开不超过视口的宽屏弹窗
- **AND** 左侧完整展示原图，不拉伸、不裁切
- **AND** 用户可绘制、移动边角调整或重置 BBox
- **AND** BBox 坐标基于实际图片内容区归一化到 0–1000

#### Scenario: 单框替换

- **WHEN** 图片节点已有 BBox 且用户重新框选
- **THEN** 新 BBox 替换旧 BBox
- **AND** 节点只保留一个 BBox
- **AND** 该修改作为一次 Zustand 历史操作支持撤销和重做

#### Scenario: 图片不可编辑

- **WHEN** 图片输入节点没有资产、资产不可访问或处于模板模式
- **THEN** 精准编辑入口禁用
- **AND** 不创建空 BBox 或失效引用

### Requirement: 严格关联的目标文本节点

系统 SHALL 只允许将 BBox 引用写入与图片节点共同直接连接到同一图生图节点的文本输入节点。

合法目标使用唯一判定式：文本节点至少有一个直接下游；其所有直接下游边都必须连接到图生图节点的 `prompt` 端口；被引用图片节点必须同时连接到每个下游图生图节点的 `image` 端口。只满足部分共同下游的文本节点不是合法目标。

#### Scenario: 发现可引用文本节点

- **WHEN** 文本节点至少有一个直接下游，且所有下游均为图生图节点并同时接收该图片节点
- **THEN** 该文本节点出现在精准编辑弹窗的目标列表
- **AND** 用户可以一次选择一个或多个符合条件的文本节点

#### Scenario: 排除不兼容文本节点

- **WHEN** 文本节点没有下游、存在非图生图下游，或任一图生图下游未连接该图片节点
- **THEN** 该文本节点不可选择
- **AND** 页面明确显示其不满足共同下游规则

#### Scenario: 多下游保持严格有效

- **WHEN** 一个带 BBox 引用的文本节点连接到多个下游
- **THEN** 每个下游都必须是图生图节点
- **AND** 被引用的图片节点必须连接到每个下游的 `image` 端口
- **AND** 任一条件不满足时，前端阻止保存该绑定，后端 DAG 校验也拒绝运行

#### Scenario: 拓扑变更矩阵

- **WHEN** 用户尝试给带引用的文本节点新增非图生图下游，或新增未连接引用图片的图生图下游
- **THEN** 前端拒绝该新连线并说明引用关系冲突
- **WHEN** 用户删除图片到图生图的共享边、删除文本到图生图的最后一条边，或删除相关节点
- **THEN** 前端在同一次历史操作中移除不再满足判定式的引用
- **AND** 后端不自动净化 API 提交的非法 definition，而是拒绝保存或运行并返回定位错误

### Requirement: 文本节点结构化引用编辑器

系统 SHALL 在文本输入节点中以不可篡改引用卡片展示 BBox，并允许用户编辑引用前后的自然语言。

#### Scenario: 写入引用

- **WHEN** 用户在精准编辑弹窗确认 BBox 并选择目标文本节点
- **THEN** 每个目标文本节点追加一条 BBox 引用
- **AND** 同一文本节点对同一图片节点最多保留一条引用
- **AND** 已存在的同源引用保持原顺序和说明文字，不重复追加
- **AND** 新引用在现有引用列表末尾追加，初始说明为空
- **AND** 引用卡片展示框选缩略图、图片节点名称和当前坐标
- **AND** 引用后的说明文字可以编辑

#### Scenario: 引用数量或说明超限

- **WHEN** 目标文本节点已有 10 条其他图片引用
- **THEN** 该目标在弹窗中不可选择并显示已达上限
- **AND** 若目标已包含当前图片引用，则即使总数为 10 也保持可选，以便幂等保留或取消绑定
- **WHEN** 用户输入超过 4000 个 Unicode code points 的引用说明
- **THEN** 前端限制继续输入，后端拒绝绕过前端的提交

#### Scenario: 防止伪造坐标

- **WHEN** 用户编辑基础提示词或引用说明
- **THEN** 用户不能直接编辑引用卡片中的图片编号和 BBox 坐标
- **AND** 后端以大小写不敏感的 `</?\s*(bbox|point)\b` 模式拒绝基础文本或引用说明中的手工坐标标签
- **AND** 错误码为 `coordinate_tag_forbidden` 并定位到文本节点

#### Scenario: 删除单个引用

- **WHEN** 用户在文本节点编辑器删除某张图片的引用卡片
- **THEN** 仅移除该文本节点中的结构化引用
- **AND** 不清除图片节点的 BBox
- **AND** 不影响其他文本节点对该 BBox 的引用

### Requirement: BBox 引用自动同步

系统 SHALL 以图片节点 ID 作为引用源，保证引用随源 BBox 生命周期同步。

#### Scenario: 重新框选

- **WHEN** 已被引用的图片节点 BBox 发生变化
- **THEN** 所有文本节点引用卡片立即展示新的框选缩略图和坐标
- **AND** 不复制或手工更新坐标文本

#### Scenario: 清除或失效

- **WHEN** 用户清除 BBox、更换图片资产或删除图片输入节点
- **THEN** 所有文本节点中指向该图片节点的引用自动移除
- **AND** 更新源节点和清理引用合并为一次可撤销历史操作

#### Scenario: 删除图连接

- **WHEN** 图片节点不再与某个引用文本节点共享严格关联的图生图下游
- **THEN** 该文本节点中的对应引用自动移除
- **AND** 其他仍满足严格关联的文本节点引用保持不变

#### Scenario: 弹窗事务边界

- **WHEN** 用户在精准编辑弹窗绘制或重置草稿但尚未确认
- **THEN** Pipeline definition 和历史栈不发生变化
- **WHEN** 用户确认框选和目标集合
- **THEN** BBox 更新、目标引用新增和取消勾选目标的引用移除合并为一次历史操作
- **AND** 取消弹窗不保存任何草稿

### Requirement: 目标相关的提示词编译

系统 SHALL 在图生图任务参数解析阶段根据目标模型节点编译结构化 BBox 引用。

图片编号的唯一来源为 Pipeline definition 中 `edges` 数组的持久化顺序：过滤出指向当前图生图节点 `image` 端口的边后，以数组下标加 1 作为 `图N`。连接新图片时边追加到数组末尾；删除后重连会获得新的末尾顺序；禁止对该数组做 canonical 重排，完全重复边沿用现有校验拒绝。

最终 prompt 使用以下确定性算法编译：

1. 对基础 `text` 调用 `strip()`，非空则作为第一段。
2. 按 `bbox_references` 数组顺序处理每条引用。
3. 解析该图片节点在当前目标图生图节点中的 1-based 图片编号。
4. 生成无额外空格的标签 `图N<bbox>x1 y1 x2 y2</bbox>` 并作为一段。
5. 对引用 `instruction` 调用 `strip()`，非空则作为下一段。
6. 所有非空段使用单个 ASCII 空格连接，不附加换行或尾随空格。

#### Scenario: 编译图片编号

- **WHEN** 文本节点引用图片节点 A，且 A 在目标图生图节点的有序图片输入中为第 3 张
- **THEN** 最终任务 `prompt` 包含 `图3<bbox>x1 y1 x2 y2</bbox>`
- **AND** 坐标取自运行快照中的图片节点 BBox
- **AND** 引用后的说明文字紧随该结构化标签

#### Scenario: 精确编译样例

- **WHEN** 基础文本为 `将`，第一条引用指向目标中的图 2、BBox 为 `100 200 700 800`、说明为 `替换为红色包装`，第二条引用指向图 1、BBox 为 `10 20 300 400` 且说明为空
- **THEN** 最终 prompt 精确等于 `将 图2<bbox>100 200 700 800</bbox> 替换为红色包装 图1<bbox>10 20 300 400</bbox>`

#### Scenario: 不同目标顺序

- **WHEN** 同一文本节点服务于多个合法图生图节点，且参考图顺序不同
- **THEN** 系统针对每个目标节点分别解析 `图N`
- **AND** 不在 Pipeline definition 中持久化固定图片编号

#### Scenario: 任务冻结与缓存

- **WHEN** 创建图生图任务
- **THEN** 任务参数快照保存编译后的最终 prompt
- **AND** BBox 坐标、引用顺序、基础文本或引用说明变化都会改变 `inputHash`
- **AND** 图片执行器版本升级，旧缓存不会错误复用

### Requirement: 模板与旧画布兼容

系统 SHALL 保持旧画布可读写，并防止模板携带实例化资产相关的区域引用。

#### Scenario: 加载旧画布

- **WHEN** 旧图片输入配置没有 BBox，旧文本输入配置没有结构化引用
- **THEN** 系统按空 BBox 和空引用列表加载
- **AND** 原有纯文本提示词行为不变

#### Scenario: 保存为模板

- **WHEN** 用户将包含 BBox 和提示词引用的 Pipeline 保存为模板
- **THEN** 图片输入节点的 `asset_id` 和 BBox 被清空
- **AND** 文本输入节点中的 BBox 引用及对应说明被移除
- **AND** 普通提示词文本和节点拓扑保留

## MODIFIED Requirements

### Requirement: AIGC 图片输入配置

`ImageInputConfig` SHALL 增加 `bbox` 和 `bbox_asset_id` 字段，缺省和无框选时均序列化为 `null`。非空 `bbox` 精确为 `{type:"bbox",x1:int,y1:int,x2:int,y2:int}`，复用现有 `ImageBboxAnnotation`：四个坐标均为整数且位于 0–999，满足 `x1 < x2`、`y1 < y2`；不接受小数或数值字符串。非空 BBox 必须同时满足 `bbox_asset_id == asset_id`，否则后端以 `bbox_asset_mismatch` 拒绝 definition；`bbox` 与 `bbox_asset_id` 必须同时为空或同时非空。前端更换 `asset_id` 时原子清空两者及全部引用，重新框选时写入当前 `asset_id`，因此允许换图和重新框选后一次性保存。

### Requirement: AIGC 文本输入配置

`TextInputConfig` SHALL 保留现有 `text` 作为引用前的基础提示词，并增加 `bbox_references` 数组，缺省序列化为空数组。数组最多 10 项且顺序即编辑器顺序；每项精确为 `{source_node_id:string,instruction:string}`。`source_node_id` 为 1–120 字符且同一数组内唯一；`instruction` 最多 4000 个 Unicode code points，前端使用 `Array.from(value).length` 与 Python/Pydantic 长度语义对齐。达到 10 项时只允许幂等保留或删除已有引用，不允许新增第 11 项。

### Requirement: DAG 校验

DAG validator SHALL 校验 BBox 来源节点存在、类型为图片输入、具有有效资产和 BBox，并校验文本节点的所有直接下游均满足严格关联规则。错误必须携带相关 `node_id`，可定位时携带 `edge_id`。

### Requirement: AIGC 节点交互

图片输入节点 SHALL 在预览与删除之外提供独立“精准编辑”命令；文本输入节点配置 SHALL 使用结构化提示词编辑器替代单一 Textarea，并在节点摘要中显示区域引用数量。

## REMOVED Requirements

无。
