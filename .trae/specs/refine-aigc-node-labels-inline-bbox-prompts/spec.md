# AIGC 节点自动编号与内嵌 BBox 提示词 Spec

## Why

AIGC 画布存在多个同类节点时，节点标题相同，用户只能依赖位置或内部 ID 区分，框选引用中甚至直接展示截断的 UUID，难以理解引用来源。当前提示词配置又把基础文本与 BBox 引用卡片拆成两个独立区域，破坏了提示词的阅读顺序，也让结构化标签看起来像编辑器外部附件。

## What Changes

- 为 AIGC 画布中重复的同类节点生成连续、可读的显示编号，例如“图片节点1”“图片节点2”。
- 单个同类节点保持无编号名称；新增、删除或类型/模式变化后按当前 Pipeline definition 顺序重新计算连续编号。
- 节点编号只作为派生 UI 信息，不修改节点 ID、Pipeline definition、模板 schema、连线或运行快照。
- 画布节点标题、右侧配置标题、BBox 引用 token、精准框选目标列表及相关可访问名称统一使用同一套节点显示名。
- 将基础提示词、不可编辑 BBox token 和每条引用说明合并到同一个提示词编辑面，按最终提示词编译顺序展示。
- 保留现有精准框选绑定、结构化引用、删除、自动同步、提示词优化、撤销重做和运行时编译契约。
- 不提供手工输入或修改 `<bbox>` / `<point>` 坐标标签的入口。

## Impact

- Affected specs:
  - AIGC 工作台节点展示与配置
  - AIGC 画布精准框选与结构化提示词引用
  - AIGC 生图提示词优化
- Affected code:
  - `frontend/lib/aigc/node-registry.ts`
  - 新增 AIGC 节点显示名纯函数模块
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`
  - `frontend/tests/aigc-flow-node.test.tsx`
  - `frontend/tests/aigc-editor.test.tsx`
  - `frontend/tests/aigc-prompt-editor.test.tsx`

## ADDED Requirements

### Requirement: 节点派生显示名

系统 SHALL 根据当前 AIGC Pipeline definition 为节点生成统一的派生显示名。

输入节点的基础显示名固定为：

| 节点类型 | 基础显示名 |
| --- | --- |
| `text_input` | 文本节点 |
| `image_input` | 图片节点 |
| `video_input` | 视频节点 |
| `audio_input` | 音频节点 |

其他节点使用节点注册表或现有模式函数产生的当前标题作为基础显示名，例如“文生图”“图生图”“图片编辑”“生视频”“图片输出”。

同一基础显示名在当前 `definition.nodes` 中仅出现一次时不追加数字；出现多次时按 `definition.nodes` 的持久化数组顺序追加从 1 开始的连续编号。拖动画布只改变坐标，不改变编号；新增节点追加到对应编号末尾；删除节点后剩余同类节点重新连续编号。

#### Scenario: 多个图片输入节点自动编号

- **WHEN** 当前 definition 按顺序包含三个 `image_input` 节点
- **THEN** 三个节点的派生显示名依次为“图片节点1”“图片节点2”“图片节点3”
- **AND** 画布不再以截断节点 ID 作为用户区分节点的主要信息

#### Scenario: 单个节点不显示冗余编号

- **WHEN** 当前 definition 只有一个 `video_input` 节点
- **THEN** 该节点显示为“视频节点”
- **AND** 不显示“视频节点1”

#### Scenario: 删除后重新连续编号

- **WHEN** 用户从“图片节点1”“图片节点2”“图片节点3”中删除第二个节点
- **THEN** 剩余节点按 definition 顺序显示为“图片节点1”“图片节点2”
- **AND** 两个节点的稳定 ID、配置和连线保持不变

#### Scenario: 拖拽不改变编号

- **WHEN** 用户拖动画布节点改变其位置
- **THEN** 节点显示编号保持不变
- **AND** 编号不按画布横纵坐标重新排序

#### Scenario: 模式相关节点标题参与分组

- **WHEN** 多个 `image_to_image` 节点当前都显示为“图生图”
- **THEN** 它们按 definition 顺序显示为“图生图1”“图生图2”
- **WHEN** 同类型节点因 operation 不同分别显示为“图生图”和“图片编辑”
- **THEN** 不同基础显示名分别计数，不因底层 type 相同而互相占用编号

### Requirement: 节点显示名跨界面一致

系统 SHALL 在所有需要识别节点来源或目标的 AIGC 编辑界面复用同一个派生显示名函数，不得由各组件分别拼接节点 ID 或独立编号。

#### Scenario: 画布与配置栏名称一致

- **WHEN** 用户选择“文本节点2”
- **THEN** 画布节点标题和右侧配置分组标题均显示“文本节点2”

#### Scenario: BBox 引用显示来源节点名称

- **WHEN** 提示词引用来自“图片节点2”
- **THEN** 内嵌 BBox token 显示“图片节点2”
- **AND** 不显示 `image_input-...` UUID 作为主标签

#### Scenario: 精准框选目标名称一致

- **WHEN** 精准框选弹窗列出可绑定的文本节点
- **THEN** 目标列表使用“文本节点N”派生显示名
- **AND** 确认绑定后提示词编辑器中的来源和目标语义可对应

### Requirement: 统一提示词编辑面

系统 SHALL 将基础文本、BBox 引用 token 和引用说明呈现在一个有统一边界、焦点和滚动行为的提示词编辑面中，不再在基础文本编辑器下方渲染独立“框选引用”卡片区。

编辑面 SHALL 按现有运行时编译顺序展示：

1. 基础文本输入；
2. 第一条不可编辑 BBox token；
3. 第一条引用说明输入；
4. 后续 BBox token 与对应说明输入。

结构化数据继续保存为 `TextInputConfig.text` 与有序 `bbox_references`，不新增富文本 HTML、序列化光标位置或原始坐标标签字段。

#### Scenario: 引用在提示词编辑面内显示

- **WHEN** 文本节点包含一条有效 BBox 引用
- **THEN** 基础文本、引用 token 和引用说明均位于同一个提示词编辑面
- **AND** 页面不再显示独立的“框选引用”卡片容器

#### Scenario: 新绑定引用追加到编辑面

- **WHEN** 用户通过图片节点精准框选弹窗把新 BBox 绑定到该文本节点
- **THEN** 新引用 token 按 `bbox_references` 顺序追加到编辑面末尾
- **AND** 现有引用顺序和说明保持不变

#### Scenario: 空引用保持普通文本编辑

- **WHEN** 文本节点没有 BBox 引用
- **THEN** 统一编辑面只显示基础提示词输入
- **AND** 普通文生图或其他纯文本提示词行为不变

### Requirement: 内嵌 BBox token

每条 BBox 引用 SHALL 在统一编辑面中渲染为紧凑、不可编辑的 token。token SHALL 显示来源节点派生显示名和当前 `bbox x1 y1 x2 y2`，可保留小型框选缩略图，但不得使用当前大型独立卡片布局。

token SHALL 提供可访问的移除操作；移除只删除当前文本节点中的该条引用，不清除源图片 BBox，也不影响其他文本节点。坐标、来源节点 ID 和图片编号均不可直接编辑。

#### Scenario: 查看内嵌引用

- **WHEN** 引用来自“图片节点2”，当前坐标为 `100 200 700 800`
- **THEN** token 在编辑面内显示“图片节点2”和“bbox 100 200 700 800”
- **AND** token 可被键盘聚焦或由辅助技术识别

#### Scenario: 删除内嵌引用

- **WHEN** 用户点击 token 的移除按钮
- **THEN** 当前文本节点对应的结构化引用被删除
- **AND** 编辑面中的 token 与对应说明同时消失
- **AND** 源图片节点的 BBox 保持不变

#### Scenario: 引用加载或失效

- **WHEN** 引用资产正在加载或来源已失效
- **THEN** 编辑面在原引用顺序位置显示紧凑状态 token
- **AND** 其他基础文本和有效引用仍可读取
- **AND** 不以白屏或布局跳出编辑面失败

### Requirement: 内嵌说明编辑与安全限制

用户 SHALL 能在每个 BBox token 后编辑该引用的自然语言说明。基础文本与引用说明继续遵守现有长度、优化和坐标标签安全规则。

#### Scenario: 编辑 token 后说明

- **WHEN** 用户修改某个 token 后的引用说明
- **THEN** 系统只更新对应 `source_node_id` 的 `instruction`
- **AND** 引用来源、顺序和 BBox 坐标不变

#### Scenario: 阻止手工坐标标签

- **WHEN** 用户在基础文本或引用说明中输入 `<bbox>` 或 `<point>` 标签
- **THEN** 编辑器拒绝该修改并显示现有校验提示
- **AND** 不改变最后有效的结构化提示词

#### Scenario: 提示词优化

- **WHEN** 用户对包含内嵌 BBox token 的提示词执行优化
- **THEN** 优化只更新基础文本和引用说明
- **AND** token 的来源 ID、顺序、坐标与数量保持不变
- **AND** 一次撤销可恢复优化前的完整提示词

## MODIFIED Requirements

### Requirement: 文本节点结构化引用编辑器

系统 SHALL 在文本输入节点的统一提示词编辑面中，以不可篡改的内嵌 BBox token 展示引用，并允许用户编辑 token 前的基础文本及每个 token 后的自然语言说明。引用通过现有精准框选绑定流程创建；同一文本节点对同一图片节点最多保留一条引用，最多 10 条。编辑器 SHALL 使用派生节点显示名，不得以截断 UUID 作为主要来源名称。

### Requirement: AIGC 节点标题

AIGC 节点标题 SHALL 使用统一派生显示名。输入节点使用“文本节点 / 图片节点 / 视频节点 / 音频节点”基础名称；其他节点沿用现有注册表或模式标题。同一基础显示名重复时追加连续编号，编号仅用于显示且不得改变持久化数据、运行图或缓存语义。

## REMOVED Requirements

### Requirement: 独立框选引用卡片区

**Reason**: 独立卡片区割裂基础文本、结构化标签和引用说明的阅读顺序，占用过多详情栏纵向空间。

**Migration**: 继续读取现有 `text` 与 `bbox_references` 数据，在统一提示词编辑面内按原数组顺序渲染；无需数据迁移或 schema 版本升级。
