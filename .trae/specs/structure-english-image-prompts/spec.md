# 生图提示词英文动态分层 Spec

## Why

文本节点当前会根据下游模型优化提示词，但文生图和图生图结果仍可能使用中文、单段堆砌或缺少清晰的信息层级，降低提示词可读性和模型执行稳定性。生图目标需要输出可直接写回文本节点的英文分层提示词，并根据具体创作需求动态选择结构。

## What Changes

- `text_to_image` 和 `image_to_image` 的提示词优化结果统一使用英文。
- 生图优化器根据用户需求动态设计 4–10 个非空层级，不使用固定场景模板。
- `Composition` 为必需层，`Negative Prompt` 为最后一个必需层。
- Provider 返回结构化 sections，后端完成数量、顺序、语言、硬约束和引用校验后渲染为多行文本。
- 文本节点继续保存现有 `optimized_text`，格式为每行一个 `Label: content`，不改变前端写回和撤销契约。
- BBox 引用说明同步优化为英文，同时保持 token、坐标、顺序、数量和受保护字面量不变。
- LLM 和生视频目标的优化语言与结构保持现状。

## Impact

- Affected specs:
  - AIGC 文本节点目标感知提示词优化
  - Seedream 文生图与图生图提示词策略
  - BBox 结构化引用说明
  - ModelArk Responses API 结构化响应
  - 提示词结果校验与原子写回
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/modelark.py`
  - `backend/app/services/generation.py`
  - `backend/app/services/prompt_optimization.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`
  - 后端适配器、服务、路由及前端提示词编辑器测试

## Definitions

### 生图目标

生图目标仅指：

- `text_to_image`
- `image_to_image`

`llm` 和 `video_generation` 不属于本规格的英文分层范围。

### Layer Section

一个 Layer Section 由以下字段组成：

- `label`：英文层级标题；
- `content`：该层对应的英文提示词内容。

Provider 输出 sections 数组，后端验证后按数组顺序渲染为：

```text
Label: content
Label: content
```

最终文本不包含 Markdown 标题、列表符号、代码块、JSON、解释或候选方案。

### 受保护字面量

受保护字面量沿用现有提示词优化规则，包括 BBox token、引号内文字、反引号内容、URL、画幅比例和带单位数字。现有品牌、产品、型号、颜色、数量和否定条件保护规则继续生效。

## ADDED Requirements

### Requirement: 生图目标英文输出

系统 SHALL 对 `text_to_image` 和 `image_to_image` 优化结果使用英文描述。以下内容除外：

- 受保护字面量；
- 必须原样出现在画面中的文字；
- 不应翻译的品牌、产品名和型号。

后端 SHALL 在移除受保护字面量后检查 `label`、`content` 和 BBox 引用说明，不允许剩余文本包含汉字、平假名、片假名或韩文字符，并要求每个非空字段至少包含一个 ASCII 英文字母。

#### Scenario: 中文需求优化为英文

- **WHEN** 用户输入中文室内场景需求并选择文生图目标
- **THEN** 优化结果的层级标题和描述使用英文
- **AND** 文本节点写回多行英文提示词

#### Scenario: 保留中文画面文字

- **WHEN** 用户要求包装上显示“家庭清洁专家”
- **THEN** 英文优化结果保留原字面量“家庭清洁专家”
- **AND** 其他可翻译描述仍使用英文

#### Scenario: 拒绝未翻译结果

- **WHEN** Provider 在非受保护内容中返回中日韩文字
- **THEN** 后端拒绝整个优化结果
- **AND** 原文本和引用说明保持不变

### Requirement: 动态分层结构

生图优化结果 SHALL 包含 4 至 10 个 Layer Section。系统 SHALL 根据以下上下文动态决定层级：

- 用户基础文本与 BBox 引用说明；
- 可选优化方向；
- 文生图或图生图目标；
- 图生图 operation；
- 输出尺寸和画幅；
- 普通参考图数量及顺序。

系统不得为所有请求套用同一固定层级，不得输出与需求无关的空层，也不得为了满足层数虚构人物、动物、产品、家具或其他对象。

#### Scenario: 室内场景

- **WHEN** 用户需求包含室内空间、家具、人物、动物和产品
- **THEN** 系统可选择 `Space / Furniture / Lighting / People / Animals / Product / Composition / Negative Prompt`
- **AND** 每层只描述与该层相关的内容

#### Scenario: 商品主图

- **WHEN** 用户需求以商品展示为核心且没有人物或动物
- **THEN** 系统选择商品相关层级，例如 `Product / Materials / Surface Details / Background / Lighting / Camera / Composition / Negative Prompt`
- **AND** 不输出 `People` 或 `Animals` 空层

#### Scenario: 简单背景

- **WHEN** 用户只要求生成简洁背景
- **THEN** 系统仍输出至少 4 个必要层级
- **AND** 不虚构主体或产品

### Requirement: 层级标题与顺序

每个 section SHALL 满足：

- `label` trim 后长度为 2 至 40 个 Unicode code point；
- 仅包含 ASCII 英文字母、数字、空格、`&`、`/` 和 `-`；
- 以 ASCII 英文字母开头；
- section label 大小写不敏感唯一；
- `content` trim 后非空；
- 不允许 `:`、换行或 Markdown 标记出现在 label；
- `Composition` 必须存在；
- `Negative Prompt` 必须存在且必须为最后一个 section。

除两个必需层外，其余 section 按“主体及关键对象 → 环境与材质 → 光影与镜头 → Composition → Negative Prompt”的逻辑排序；具体标题可按需求变化。

#### Scenario: 合法动态层级

- **WHEN** Provider 返回 6 个唯一英文层级，且末两层依次包含构图与负面提示
- **THEN** 后端按 Provider 顺序渲染全部层级

#### Scenario: 缺少必需层

- **WHEN** Provider 缺少 `Composition` 或 `Negative Prompt`
- **THEN** 后端拒绝结果并返回解析错误

#### Scenario: 重复层级

- **WHEN** Provider 同时返回 `Lighting` 和 `lighting`
- **THEN** 后端按大小写不敏感重复拒绝结果

#### Scenario: 负面层位置错误

- **WHEN** `Negative Prompt` 不是最后一层
- **THEN** 后端拒绝结果

### Requirement: Composition 层

`Composition` SHALL 说明与需求相关的画面组织，不得只使用无意义的通用质量词。可包括景别、机位、镜头、主体位置、空间关系、留白、视觉层次和画幅适配。

#### Scenario: 竖版商品广告

- **WHEN** 目标画幅为 `9:16` 且主体为商品
- **THEN** `Composition` 明确竖版主体位置、视觉层次和文案安全区域
- **AND** 保持用户给定画幅字面量

### Requirement: Negative Prompt 层

`Negative Prompt` SHALL：

- 汇总用户明确的否定条件；
- 补充与当前需求直接相关的常见失败模式；
- 不得否定用户明确要求保留或生成的主体、品牌、文字、颜色、数量、构图或参考图特征；
- 不得仅堆砌与场景无关的通用负面词。

#### Scenario: 用户明确排除条件

- **WHEN** 用户要求“不要出现多余人物，不改变包装文字”
- **THEN** `Negative Prompt` 包含对应英文排除约束
- **AND** 不否定目标商品或指定包装文字

#### Scenario: 无明确负面输入

- **WHEN** 用户没有提供负面条件
- **THEN** 系统只补充与当前场景直接相关的失败模式
- **AND** 不引入与需求无关的限制

### Requirement: 图生图专属分层

`image_to_image` 优化 SHALL 根据 operation 和参考图上下文选择必要层级：

- 普通图生图：明确 `Reference Usage`、目标变化和需保留特征；
- 图片编辑：明确 `Edit Instructions` 与 `Preserve`；
- 多参考图：明确每张参考图的对象、用途、保留特征和相互关系；
- 图层拆分等非普通 operation 沿用其现有目标约束，不得误写为文生图。

#### Scenario: 图片编辑

- **WHEN** 用户要求只替换背景且保留商品
- **THEN** 结果包含编辑动作与保持不变内容
- **AND** `Negative Prompt` 不得要求删除商品

#### Scenario: 多参考图

- **WHEN** 图生图目标有多张普通参考图
- **THEN** 分层内容按 definition edge 顺序稳定引用各参考图
- **AND** 不引用不存在的参考图

### Requirement: BBox 引用说明英文优化

生图目标的每条 `optimized_reference_instructions` SHALL 使用英文描述，并保持：

- 数组长度和顺序；
- 对应 BBox 引用 ID；
- BBox token 与坐标；
- 每条说明中的受保护字面量；
- 引用图片与目标图生图节点的关系。

BBox 引用说明不要求使用主提示词的 Layer Section 格式，但必须是单段、非空、可直接执行的英文说明。

#### Scenario: 优化中文 BBox 说明

- **WHEN** 某引用说明为“缩小框选人物，保持蓝色外套”
- **THEN** 对应优化说明使用英文
- **AND** BBox token、坐标与“蓝色”对应的明确颜色约束保持

#### Scenario: Provider 改变引用关系

- **WHEN** Provider 改变引用数量、顺序、token 或坐标
- **THEN** 整次优化失败
- **AND** 不部分写回主提示词或任一引用说明

### Requirement: Provider 结构化响应

真实与 Mock ModelArk adapter SHALL 对生图目标使用内部结构化响应：

```json
{
  "sections": [
    {"label": "Subject", "content": "..."},
    {"label": "Composition", "content": "..."},
    {"label": "Negative Prompt", "content": "..."}
  ],
  "optimized_reference_instructions": []
}
```

Provider 不再直接决定最终 `optimized_text` 格式。后端 SHALL 先解析和校验 sections，再以 `Label: content` 渲染最终文本。

公开 `POST /api/aigc/prompts/optimize` 响应 SHALL 继续使用：

- `optimized_text`
- `optimized_reference_instructions`

不得向前端暴露内部 sections 契约或要求前端重新拼接。

#### Scenario: 结构化响应成功

- **WHEN** Provider 返回合法 sections
- **THEN** 后端渲染为稳定多行 `optimized_text`
- **AND** 现有前端使用同一响应字段完成写回

#### Scenario: Provider 返回旧格式

- **WHEN** 生图 Provider 只返回旧版 `optimized_text` 而没有 sections
- **THEN** 后端拒绝该响应
- **AND** 不静默降级为无结构文本

### Requirement: 稳定渲染

后端 SHALL 使用确定性渲染器：

- 每个 section 独占一行；
- 使用 ASCII 冒号和一个空格连接 label 与 content；
- 去除 label 和 content 首尾空白；
- 将 content 内连续空白规范为单个空格，但不改变受保护字面量；
- section 之间不插入空行；
- 输出长度继续遵守现有 `optimized_text` 上限。

#### Scenario: 相同 sections

- **WHEN** 两次获得语义和字段完全相同的 sections
- **THEN** 渲染后的 `optimized_text` 字节一致

### Requirement: 结果原子写回

现有前端 SHALL 将渲染后的英文分层主提示词与英文 BBox 引用说明作为一次历史操作原子写回。现有 loading、取消、过期响应、无变化、撤销和不自动保存语义保持不变。

#### Scenario: 优化成功

- **WHEN** 后端返回合法英文分层结果
- **THEN** 文本节点显示多行 `Label: content`
- **AND** 一次撤销恢复优化前主文本和全部引用说明

#### Scenario: 任一校验失败

- **WHEN** 主提示词分层或任一 BBox 引用说明不合法
- **THEN** 前端保留全部原内容
- **AND** 显示脱敏错误

## MODIFIED Requirements

### Requirement: 文生图和图生图优化策略

原有文生图主体、行为、环境、用途、美学要素，以及图生图参考对象、编辑动作、保持内容和多图关系要求继续生效。对于生图目标，这些信息 SHALL 被组织为 4–10 层英文 sections，而不是单段自然语言。

### Requirement: 提示词优化响应校验

生图目标除现有非空、长度、引用数量、BBox token、坐标和受保护字面量校验外，还 SHALL 校验 section 数量、标题、唯一性、必需层、顺序、英文内容和稳定渲染。LLM 与生视频目标继续使用现有单文本响应校验。

### Requirement: Mock Provider

Mock Provider SHALL 根据输入内容和目标模式确定性选择动态层级，并返回与真实 Provider 相同的内部 sections 契约。测试不得依赖随机标题或不可复现顺序。

## Error Handling

- 内部 sections 缺失、字段非法、数量越界、重复标题、缺少必需层、顺序错误或语言错误统一作为脱敏的 ModelArk 文本解析错误处理。
- Provider 超时、鉴权、限流和服务错误继续使用现有错误映射。
- 错误响应不得包含 Provider 原始响应、完整系统提示词、密钥或堆栈。
- 任一错误不得保存 Pipeline、创建 Run/Task、调用图片生成或部分写回文本。

## Testing

- Schema 测试覆盖 4/10 合法边界、3/11 非法边界、标题字符、重复、必需层和顺序。
- 渲染测试覆盖空白规范化、稳定换行、长度和受保护字面量。
- 英文校验覆盖中文输入转英文、受保护中文保留、非受保护中日韩文字拒绝。
- Provider 测试覆盖文生图、普通图生图、图片编辑、多参考图及旧响应拒绝。
- 服务测试覆盖硬约束、Negative Prompt 冲突、BBox 英文转换和原子失败。
- 固定语料覆盖室内、商品、人物、动物、纯背景和包含画面文字的需求。
- 前端测试确认多行结果原子写回、一次撤销、失败不改动、过期响应和无变化。
- 浏览器在桌面和移动视口验证分层文本可读、编辑区不溢出且未调用图片生成接口。

## Non-Goals

- 不改变 LLM 和生视频提示词优化语言或格式。
- 不在前端提供手工增删、排序或折叠 Layer Section 的独立 UI。
- 不把优化结果保存为 JSON 对象。
- 不建立固定的室内、商品、人物等模板库。
- 不新增 Pipeline、Run、Task 或资产持久化。
- 不改变优化按钮、目标选择器、取消和撤销交互。

