# AIGC 画布模态配色 Spec

## Why

生视频节点同时包含文本、图片、视频和音频输入端口，当前所有输入端口使用同一种蓝色，用户难以快速判断连接目标。输入节点卡片也仅按“输入类”使用统一样式，无法通过视觉扫描识别不同模态。

## What Changes

- 建立文本、图片、视频、音频四种稳定的模态色语义。
- 生视频节点的四类输入端口按数据类型显示不同颜色。
- 文生图、图生图及其他已有节点的端口统一按数据类型着色。
- 文本、图片、视频和音频输入节点的边框、标题栏、图标使用对应模态色。
- 已建立的合法连线使用源端口模态色，非法连线仍使用红色错误语义。
- 颜色只作为辅助信息，端口标签、节点图标和无障碍名称继续保留。
- 不修改 AIGC definition、后端 DAG、端口类型或持久化数据。

## Impact

- Affected specs:
  - AIGC 画布节点视觉
  - 强类型端口与连线展示
  - 文生图、图生图、生视频节点
- Affected code:
  - `frontend/app/globals.css`
  - `frontend/lib/aigc/modality-colors.ts`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/tests/aigc-flow-node.test.tsx`
  - `frontend/tests/aigc-editor.test.tsx`

## 设计决策

### 模态色矩阵

| 模态 | 端口类型 | 主色 | 浅色背景 | 用途 |
| --- | --- | --- | --- | --- |
| 文本 | `text` | Blue `#2563EB` | `#EFF6FF` | 文本节点、提示词端口、文本连线 |
| 图片 | `image_asset` | Green `#16A34A` | `#F0FDF4` | 图片节点、首尾帧/参考图片端口、图片连线 |
| 视频 | `video_asset` | Orange `#EA580C` | `#FFF7ED` | 视频节点、参考视频端口、视频连线 |
| 音频 | `audio_asset` | Rose `#DB2777` | `#FDF2F8` | 音频节点、参考音频端口、音频连线 |

- 配色通过语义 CSS 变量表达，不在组件中散落十六进制颜色。
- 主色用于端口、图标和连线；浅色仅用于节点标题栏及轻量背景。
- 节点正文、媒体区域、配置内容和运行状态保持现有中性色。
- 选中状态继续使用现有 primary ring，运行状态继续使用 success/info/destructive，不与模态色复用。

### 节点与端口范围

- `text_input`、`image_input`、`video_input`、`audio_input` 卡片使用对应模态色边框和标题栏。
- 所有节点的输入和输出 Handle 均由 `AigcPortType` 决定颜色，而不是由 Handle 位于左侧或右侧决定。
- `video_generation`：
  - `prompt` 为文本色。
  - `first_frame`、`last_frame`、`reference_images` 为图片色。
  - `reference_videos` 为视频色。
  - `reference_audios` 为音频色。
  - 输出 Handle 为视频色。
- `text_to_image`：
  - `prompt` 为文本色。
  - 输出 Handle 为图片色。
- `image_to_image`：
  - `prompt` 为文本色。
  - 图片输入和输出 Handle 为图片色。
- LLM 和输出节点也沿用同一端口类型映射，保证全画布一致。

## ADDED Requirements

### Requirement: 统一模态色映射

系统 SHALL 以唯一的前端映射定义四种端口类型及对应视觉 token。

#### Scenario: 根据端口类型获取颜色

- **WHEN** 组件渲染 `text`、`image_asset`、`video_asset` 或 `audio_asset` 端口
- **THEN** 系统分别使用文本蓝、图片绿、视频橙、音频玫红
- **AND** 输入端口与输出端口对同一数据类型使用相同颜色
- **AND** 新增节点复用端口类型即可获得对应颜色，不需要重复判断节点类型

#### Scenario: 未知端口类型

- **WHEN** 运行时出现未识别端口类型
- **THEN** 系统回退到现有中性边框色
- **AND** 不影响节点渲染和连线校验

### Requirement: 生视频节点多模态端口

系统 SHALL 在生视频节点上使用四种模态色区分输入端口。

#### Scenario: 展示全模态端口

- **WHEN** 生视频节点处于全模态参考模式
- **THEN** 提示词、参考图片、参考视频和参考音频端口分别显示文本、图片、视频和音频颜色
- **AND** 端口标签和 tooltip 继续明确显示模态名称

#### Scenario: 展示首帧或首尾帧端口

- **WHEN** 生视频节点处于首帧或首尾帧模式
- **THEN** 首帧和尾帧端口使用图片色
- **AND** 提示词端口使用文本色

#### Scenario: 端口与当前模式不兼容

- **WHEN** 一个生视频输入端口不适用于当前模式
- **THEN** 端口保留所属模态色但降低透明度
- **AND** tooltip 与无障碍名称仍提示“与当前模式不兼容”
- **AND** 不使用红色表示普通的模式禁用

### Requirement: 生图节点多模态端口

系统 SHALL 对文生图和图生图节点应用相同的端口类型配色。

#### Scenario: 文生图端口

- **WHEN** 用户查看文生图节点
- **THEN** 提示词输入端口使用文本色
- **AND** 图片输出端口使用图片色

#### Scenario: 图生图端口

- **WHEN** 用户查看图生图节点
- **THEN** 提示词输入端口使用文本色
- **AND** 参考图片输入和图片输出端口使用图片色

### Requirement: 输入节点卡片模态色

系统 SHALL 通过克制的卡片配色区分四种输入节点。

#### Scenario: 展示输入节点

- **WHEN** 画布渲染文本、图片、视频或音频输入节点
- **THEN** 卡片外边框、标题栏背景和标题图标使用对应模态色
- **AND** 标题文字、正文和媒体区保持可读的中性色
- **AND** 卡片圆角、尺寸和布局不发生变化

#### Scenario: 选中输入节点

- **WHEN** 用户选中任一输入节点
- **THEN** 模态色边框继续可见
- **AND** 现有 primary ring 明确表达选中状态
- **AND** 节点尺寸不因边框或 ring 变化而跳动

### Requirement: 模态色连线

系统 SHALL 使用源端口的数据类型颜色展示已建立的合法连线。

#### Scenario: 展示合法连线

- **WHEN** 画布渲染一条合法连线
- **THEN** 连线颜色与源端口模态色一致
- **AND** 文本到模型、图片到模型、视频到模型和音频到模型可被快速区分

#### Scenario: 展示非法连线

- **WHEN** 现有连线与当前模式不兼容或被判定为错误
- **THEN** 错误连线继续使用 destructive 红色和现有动画/标签
- **AND** 错误语义优先于模态色

### Requirement: 可访问性与对比度

系统 SHALL 保证模态区分不只依赖颜色。

#### Scenario: 无法辨色或高缩放查看

- **WHEN** 用户无法可靠区分颜色或使用高缩放
- **THEN** 节点图标、端口标签、tooltip 和无障碍名称仍可识别模态
- **AND** Handle 与背景的图形对比度不低于 3:1
- **AND** 文本对比度遵循现有界面标准

## MODIFIED Requirements

### Requirement: AIGC 节点视觉语义

系统 SHALL 将“节点类别色”和“端口方向色”调整为“节点类别保持结构、端口与输入卡片表达数据模态”。模型节点保持中性 primary 风格，输出节点保持现有结果语义，仅四类输入节点卡片采用模态色。

### Requirement: AIGC 连线投影

系统 SHALL 在不改变 definition 的前提下，根据源节点注册表及 `sourceHandle` 查找 `AigcPortType`，为 React Flow Edge 派生模态色样式；找不到类型时使用默认样式。

## REMOVED Requirements

### Requirement: 所有输入 Handle 统一蓝色、所有输出 Handle 统一绿色

**Reason**: 方向色无法表达多模态数据类型，生视频和图生图节点难以快速识别连接目标。

**Migration**: 仅修改前端派生样式，无需迁移画布数据。
