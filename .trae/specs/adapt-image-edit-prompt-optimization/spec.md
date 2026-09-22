# 图生图局部编辑轻量提示词优化 Spec

## Why

当前文生图与图生图共用 4–10 层英文结构，强制包含 `Composition` 和末尾 `Negative Prompt`。对于“在原图加一行字”“修改衣服颜色”“替换背景但保留主体”等以原图为编辑画布的任务，这种完整重构会引入无关设计描述、增加模型误改原图的风险，也降低提示词的直接可执行性。

## What Changes

- 仅对 `image_to_image` 目标增加 `local_edit / full_design` 内部语义判别。
- 使用一次 Provider 调用同时完成模式判别与提示词优化，不增加额外分类请求。
- 对具备唯一被编辑原图的请求，将该图作为单张多模态输入辅助判断修改范围。
- 前端只提交当前只读 definition snapshot、资产身份与来源证明，后端校验 Pipeline、Run、直接连线和资产归属后生成受控临时 URL；客户端不得提交图片 URL。
- `local_edit` 返回单段英文编辑指令，不再要求 4–10 个 section、`Composition` 或 `Negative Prompt`。
- `full_design` 完全沿用现有英文动态分层契约。
- 加字、局部增删、属性微调、颜色修改，以及明确保留主体的背景替换可进入 `local_edit`。
- 整体风格重塑、重新构图、重建场景、主体身份变化、多参考图组合和非图生图目标继续使用 `full_design`。
- 两种模式继续执行现有品牌、型号、画面文字、颜色、数量、BBox、否定条件和引用关系保护。
- 公开 API 仍返回 `optimized_text + optimized_reference_instructions`，前端交互和写回逻辑不变。

## Impact

- Affected specs:
  - `structure-english-image-prompts`
  - `enhance-aigc-text-prompt-optimization-modality-ui`
  - AIGC 提示词优化校验韧性
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/modelark.py`
  - `backend/app/services/generation.py`
  - `backend/app/services/prompt_optimization.py`
  - `backend/app/api/aigc_routes.py`
  - `backend/app/services/assets.py`
  - `backend/tests/test_aigc_schemas.py`
  - `backend/tests/test_modelark.py`
  - `backend/tests/test_prompt_optimization.py`
  - `backend/tests/test_aigc_routes.py`
  - `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/run-scope.ts`
  - `frontend/tests/aigc-prompt-editor.test.tsx`

## ADDED Requirements

### Requirement: 图生图优化模式判别

系统 SHALL 对每个 `image_to_image` 提示词优化请求执行一次语义判别，并在同一次 Provider 响应中返回以下内部模式之一：

- `local_edit`：以现有图像为编辑画布，只修改明确对象、区域或属性；
- `full_design`：需要重新组织画面、生成新视觉方案或参考多张图片进行组合创作。

模式判别 SHALL 基于原始文本、优化方向、目标 operation、参考图数量、BBox 引用上下文和经过后端验证的被编辑原图。后端关键词规则不得作为唯一判据，且不得只依赖图片内容而忽略用户指令。

`local_edit` 仅在以下前置条件同时成立时合法：

- 目标类型为 `image_to_image`；
- operation 为 `image_edit`，或 operation 为普通 `image_to_image` 且恰好存在一张普通参考图；
- 用户将参考图视为需要直接修改的原图，而不是仅作为风格、构图或主体参考；
- 请求包含一张经过后端来源校验且可供 Provider 读取的被编辑原图；
- 修改对象、区域或属性明确；
- 未要求组合多张参考图、重建整体构图、重塑整体风格或更换主体身份。

#### Scenario: 在原图添加文字

- **WHEN** 用户要求“在参考图底部加一行文字 `限时优惠`，其他内容不变”
- **THEN** Provider 返回 `local_edit`
- **AND** 优化结果使用单段编辑指令

#### Scenario: 修改衣服颜色

- **WHEN** 用户要求“把人物外套改成蓝色，保持人物、姿势、背景和光线不变”
- **THEN** Provider 返回 `local_edit`

#### Scenario: 替换背景并保留主体

- **WHEN** 用户明确要求替换背景且保持主体身份、姿态、产品外观或前景构图不变
- **THEN** Provider 可返回 `local_edit`
- **AND** 单段指令必须明确新背景和需要保持的主体特征

#### Scenario: 整体重新设计

- **WHEN** 用户要求重新构图、整体换风格、重建场景、改变主体身份或从参考图重新创作
- **THEN** Provider 返回 `full_design`
- **AND** 继续使用现有 4–10 层英文结构

#### Scenario: 多参考图组合

- **WHEN** 普通图生图目标包含两张或更多参考图
- **THEN** `local_edit` 不合法
- **AND** Provider 必须返回 `full_design`

#### Scenario: 非图生图目标

- **WHEN** 目标为 `text_to_image`、`llm` 或 `video_generation`
- **THEN** 不执行局部编辑判别
- **AND** 保持现有优化策略

#### Scenario: 被编辑原图不可用

- **WHEN** 请求文本看似局部编辑，但没有合法且可访问的被编辑原图
- **THEN** 本次请求不得返回 `local_edit`
- **AND** 继续使用 `full_design`

### Requirement: 被编辑原图来源与多模态输入

系统 SHALL 只为具备唯一被编辑原图的图生图优化构造多模态输入：

- 普通 `image_to_image`：目标节点 `image` 端口恰好存在一条有效直接入边；
- `image_edit`：目标节点 `edit_image` 端口恰好存在一条有效直接入边；
- 多参考图、`layer_decomposition`、文生图、LLM 和生视频不发送图片用于局部编辑判别。

图生图优化请求 SHALL 可选增加 `pipeline_context`：

- `pipeline_id`
- `base_revision`：编辑器加载并持续跟踪的服务端基准 revision
- `definition_snapshot`：点击优化时当前编辑器中的完整、只读 `AigcPipelineDefinitionV2`
- 可空 `source_image`：包含 `source_node_id`、`source_handle`、`target_handle`、`asset_id`、可空 `run_id`

`pipeline_context` 只适用于 Pipeline 编辑器中的 `image_to_image` 请求；模板编辑器、非图生图目标和现有无上下文调用可以省略。省略后请求仍可执行，但只允许 `full_design`。该字段为新增可选上下文，不改变现有请求字段的必填性和公开响应。

前端不得提交图片 URL、对象存储 Key、签名参数或图片二进制。`source_image` 必须来自 `definition_snapshot` 中唯一符合资格的直接图片入边，并使用当前界面有效值：

- 本地图片节点使用其当前 `asset_id`，`run_id=null`；
- 上游图片结果使用实际投影该结果的 Run ID 和结果资产 ID；
- 等待、失败、unavailable 或没有有效资产时不提交 `source_image`。

后端 SHALL 在调用 Provider 前：

1. 加载 `pipeline_id`，验证当前用户可访问该 Pipeline，并按现有 schema 校验 `definition_snapshot`；
2. 处理自动保存竞态：当服务端当前 revision 等于 `base_revision` 时接受该快照作为未保存编辑态；当 revision 已推进但服务端 definition 与快照规范化后相等时也接受；其余情况视为上下文过期；
3. 验证 `target_node_id` 在快照中存在、类型为 `image_to_image`，且 operation、参考图数量与请求目标配置一致；
4. 验证快照中存在与 descriptor 完全匹配的唯一直接入边，并按 operation 校验 `image` 或 `edit_image` 目标端口；
5. 本地来源验证来源节点配置、资产访问范围和当前用户资产权限，且 `asset_id` 等于快照中的有效图片资产；
6. 上游来源验证 Run 属于当前 Pipeline、Run definition 包含来源节点，且对应成功 RunNode 结果包含该图片资产；
7. 验证资产存在、成功、公开、类型为图片且对象可访问；
8. 仅在全部校验通过后生成短期受控访问 URL。

`definition_snapshot` 仅用于验证本次优化所见的目标节点、operation、直接入边和来源节点配置，不持久化、不创建 revision，也不得替代服务端对用户权限、RunNode 结果和资产归属的独立验证。

后端 SHALL 将该 URL 作为一项 `input_image` 与文本上下文一起发送给 ModelArk。受控 URL 只存在于本次 Provider 请求内，不写入 Provider JSON 上下文、公开 API 响应、Pipeline、Run、Task、日志或错误。

#### Scenario: 本地原图

- **WHEN** 唯一参考来源是当前 Pipeline 中设置了可用资产的本地图片节点
- **THEN** 前端提交该节点和资产身份
- **AND** 后端验证后向 Provider 发送一张受控图片

#### Scenario: 上游 Run 原图

- **WHEN** 唯一参考来源来自成功 RunNode 的图片结果
- **THEN** 前端同时提交来源 Run ID
- **AND** 后端验证 Run、节点和资产关系后向 Provider 发送该图

#### Scenario: 伪造资产

- **WHEN** 客户端提交的资产不属于声明的本地节点或 RunNode 合法结果
- **THEN** API 返回 `invalid_input`
- **AND** 不生成签名 URL，不调用 Provider

#### Scenario: Pipeline 在请求前变化

- **WHEN** 服务端 revision 已超过 `base_revision`，且服务端当前 definition 与请求快照不一致
- **THEN** API 返回 revision conflict
- **AND** 不调用 Provider

#### Scenario: 自动保存与优化并发

- **WHEN** 点击优化后自动保存先完成并推进 revision，但保存后的服务端 definition 与请求快照规范化后相同
- **THEN** 后端继续验证来源并允许本次优化
- **AND** 不因等价快照产生误报冲突

#### Scenario: 未保存画布

- **WHEN** 当前画布包含尚未自动保存的目标配置或连线，且服务端 revision 仍等于 `base_revision`
- **THEN** 后端使用请求中的只读快照验证本次优化上下文
- **AND** 优化接口不保存该快照

#### Scenario: 图片不可访问

- **WHEN** 来源关系合法但图片已删除、失败、非公开或对象不可访问
- **THEN** 后端不发送图片
- **AND** 仅允许 Provider 返回 `full_design`

#### Scenario: 多参考图

- **WHEN** 普通图生图有两张或更多直接图片输入
- **THEN** 前端不提交 `source_image`
- **AND** 后端不向优化 Provider 发送任何参考图片
- **AND** 本次优化固定使用 `full_design`

#### Scenario: 缺少 Pipeline 上下文

- **WHEN** 图生图请求来自模板编辑器、旧客户端或其他未提交 `pipeline_context` 的调用方
- **THEN** 请求保持兼容并继续执行
- **AND** 后端不发送图片且只允许 `full_design`

### Requirement: 局部编辑单段输出

`local_edit` 优化结果 SHALL 是一个非空英文段落，可直接作为 Seedream 图生图编辑提示词使用。

该段落 SHALL：

- 使用明确、可执行的编辑动作描述修改对象、位置、属性和目标值；
- 明确以输入图像为编辑基础；
- 明确保留所有未指定修改的主体身份、姿态、布局、视角、光影、纹理、文字和其他视觉内容；
- 原样保留用户要求渲染的文字、品牌、型号、URL、数值、比例、BBox token 和其他受保护字面量；
- 在用户存在明确否定条件时，用同一段中的英文否定子句保留该条件；
- 不增加用户未请求的人物、对象、文字、数量、材质、风格或构图变化。

该段落 SHALL NOT：

- 包含 `Edit Instructions:`、`Preserve:`、`Composition:`、`Negative Prompt:` 或其他 section label；
- 包含换行、Markdown、JSON、编号、解释、候选方案或评价；
- 为满足格式而补充通用镜头、画质、美学、构图或负面词；
- 将“保持不变”写成模糊的 `keep quality`，而不说明保留未编辑内容。

#### Scenario: 单段加字指令

- **WHEN** 原请求为“在海报顶部增加文字 `新品上市`，保持其余内容不变”
- **THEN** 优化结果为单段英文编辑指令
- **AND** 精确保留 `新品上市`
- **AND** 明确文字位置和其余图像不变
- **AND** 不出现 section label

#### Scenario: 单段颜色修改

- **WHEN** 原请求为“把衣服从红色改为绿色，不改变人物和背景”
- **THEN** 优化结果明确只修改衣服颜色
- **AND** 保留人物身份、姿势、背景、构图、光影和其他颜色
- **AND** 不新增产品摄影、镜头或场景描述

#### Scenario: 带否定条件的局部编辑

- **WHEN** 用户要求“替换成纯白背景，不要增加阴影，商品保持不变”
- **THEN** 单段结果包含纯白背景编辑、商品保持和禁止新增阴影的英文语义
- **AND** 不需要独立 `Negative Prompt` section

### Requirement: 完整设计输出保持不变

`full_design` SHALL 继续返回现有 `AigcImagePromptSectionsResult`：

- 4–10 个非空英文 section；
- 唯一且任务相关的 section label；
- 必须包含 `Composition`；
- 必须以 `Negative Prompt` 结束；
- 按现有动态分层、引用、硬约束和稳定渲染规则处理。

#### Scenario: 模糊请求保守回退

- **WHEN** 请求同时包含局部动作和可能改变整体画面的模糊要求
- **THEN** Provider 应返回 `full_design`
- **AND** 不因追求简短而遗漏整体设计信息

#### Scenario: Provider 返回完整设计

- **WHEN** Provider 判定为 `full_design`
- **THEN** 后端执行现有 sections 规范化、校验、warning 和渲染流程
- **AND** 不改变既有输出格式和安全边界

### Requirement: 内部判别联合响应

生图优化内部响应 SHALL 使用带 `optimization_mode` 判别字段的联合结构。

`local_edit` 结构：

```json
{
  "optimization_mode": "local_edit",
  "optimized_text": "Change only ... while preserving ...",
  "optimized_reference_instructions": []
}
```

`full_design` 结构：

```json
{
  "optimization_mode": "full_design",
  "sections": [
    {"label": "Subject", "content": "..."},
    {"label": "Composition", "content": "..."},
    {"label": "Negative Prompt", "content": "..."}
  ],
  "optimized_reference_instructions": []
}
```

- `local_edit` 不得包含 `sections`。
- `full_design` 不得包含 `optimized_text`。
- 两种模式的 `optimized_reference_instructions` 均继续与请求 BBox 引用说明一一对应。
- `text_to_image` 内部响应固定为 `full_design`。
- 未向 Provider 提供合法 `input_image` 时，内部响应只允许 `full_design`。
- 请求仅新增可选 `pipeline_context`；公开响应不新增字段，继续只暴露渲染后的 `optimized_text` 和引用说明数组。

#### Scenario: 混合结构响应

- **WHEN** Provider 同时返回 `optimized_text` 和 `sections`，或缺少 `optimization_mode`
- **THEN** 后端将其视为 Provider 响应结构错误
- **AND** 不部分写回任何文本或引用说明

#### Scenario: 非法局部模式

- **WHEN** Provider 对文生图、多参考图组合或图层拆分请求返回 `local_edit`
- **THEN** 后端拒绝该响应
- **AND** 返回脱敏优化失败，不调用图片生成

### Requirement: 局部编辑安全校验

后端 SHALL 为 `local_edit` 执行与完整设计相同的核心事实保护，但不执行 section 数量、标题、`Composition` 或末尾 `Negative Prompt` 校验。

硬校验继续覆盖：

- BBox token、坐标、引用数量和引用顺序；
- 引号内画面文字、品牌、产品、型号、URL、比例和带单位数字；
- 用户明确指定的颜色、对象数量和否定条件；
- 原图主体身份和用户明确要求保持的内容；
- 禁止将局部修改扩展为未请求的整体重设计。

轻量格式校验 SHALL 要求：

- 单段、非空且包含 ASCII 英文字母；
- 屏蔽受保护字面量后不包含中日韩文字；
- 不包含 section label、JSON、Markdown 标题或代码围栏；
- 不超过现有提示词长度上限；
- 包含明确编辑动作及保留未编辑内容的语义。

#### Scenario: Provider 扩大编辑范围

- **WHEN** 用户只要求修改衣服颜色，但结果同时改变背景、人物姿态或构图
- **THEN** 后端拒绝该结果
- **AND** 原提示词和引用说明保持不变

#### Scenario: 缺少保持语义

- **WHEN** `local_edit` 结果只有修改动作，没有表达未编辑内容保持不变
- **THEN** 后端拒绝该结果

#### Scenario: 合法局部编辑

- **WHEN** 单段结果完整保留硬约束、明确修改范围和保持范围
- **THEN** 后端通过校验并返回优化文本

### Requirement: BBox 与普通参考图语义

局部编辑 SHALL 保持现有 BBox 与普通参考图边界：

- `reference_instructions` 只对应 BBox 引用说明；
- BBox 引用说明继续单独优化为英文单段；
- BBox token、坐标、引用 ID、数量和顺序不得变化；
- 普通参考图只参与局部编辑资格和语义上下文，不写入引用说明数组；
- `local_edit` 主段可以引用 BBox 区域，但不得发明不存在的图片编号或区域。

#### Scenario: BBox 局部改色

- **WHEN** 用户要求修改 BBox 框选衣服的颜色
- **THEN** 主提示词使用单段局部编辑格式
- **AND** 对应引用说明使用英文单段
- **AND** token、坐标和引用顺序保持不变

### Requirement: 模式观测与无副作用

系统 SHALL 在脱敏结构化日志中记录 `target_type`、operation、参考图数量和最终 `optimization_mode`，不得记录完整原文、完整输出、系统提示词、图片 URL 或密钥。

日志可额外记录 `has_source_image` 布尔值，但不得记录资产 ID、Run ID、对象 Key、完整来源链或图片内容。

模式判别和优化 SHALL：

- 不保存 Pipeline；
- 不创建 Run、Task 或资产；
- 不调用图片生成接口；
- 继续遵循 loading、取消、过期响应、原子写回、无变化和单次撤销语义。

#### Scenario: 优化成功

- **WHEN** 局部编辑优化通过全部校验
- **THEN** 前端按现有流程一次性写回单段文本和全部引用说明
- **AND** 不需要识别或展示内部模式

#### Scenario: 优化失败

- **WHEN** 判别、Provider、解析或安全校验失败
- **THEN** 前端保留原文本和全部引用说明
- **AND** 显示脱敏错误并允许重试

## MODIFIED Requirements

### Requirement: 文生图和图生图优化策略

原要求“所有 `text_to_image` 和 `image_to_image` 优化结果均组织为 4–10 层英文 sections”修改为：

- `text_to_image` 始终使用 `full_design`；
- `image_to_image` 先按本 Spec 判别 `local_edit / full_design`；
- 只有后端向 Provider 提供经过来源校验的单张被编辑原图时，`local_edit` 才合法；
- `local_edit` 使用单段英文编辑指令；
- `full_design` 继续使用 4–10 层英文 sections。

品牌、产品、型号、画面文字、颜色、数量、比例、BBox、否定条件和引用关系保护在两种模式下均不降低。

### Requirement: 提示词优化响应校验

生图响应校验 SHALL 按内部 `optimization_mode` 分派：

- `local_edit`：校验单段格式、编辑范围、保持语义、英文和核心事实；
- `full_design`：执行现有 section 数量、标题、顺序、英文、`Composition`、`Negative Prompt`、warning 和稳定渲染校验。

公开 API 响应、前端原子写回和失败不改动语义保持不变。

### Requirement: Mock Provider

Mock Provider SHALL 对固定语料确定性判别模式：

- 加字、改色、删除小对象、明确保留主体的背景替换返回 `local_edit`；
- 整体换风格、重新构图、多参考图组合和文生图返回 `full_design`。

Mock 输出 SHALL 使用与真实 Provider 相同的内部判别联合，且不得依赖随机模型行为。

## REMOVED Requirements

### Requirement: 图生图无条件复杂分层

**Reason**: 对仅在原图上执行明确编辑的任务，强制复杂分层会引入无关设计信息并扩大修改范围。

**Migration**: 不迁移已保存文本或历史结果；仅新的提示词优化请求按本 Spec 判别。既有完整分层文本仍可继续编辑、保存和执行。

## Error Handling

- 内部判别字段缺失、联合结构混用或非法模式统一作为脱敏 Provider 解析错误。
- Pipeline 不可访问、快照非法、直接入边、RunNode 或资产归属不匹配时，在调用 Provider 前返回脱敏输入错误。
- 服务端 revision 已推进且当前 definition 与请求快照不一致时返回 revision conflict；自动保存后 definition 与快照相同不视为冲突。
- `local_edit` 资格不成立、格式不合法或核心事实不安全时整次拒绝，不自动降级为未经校验的文本。
- `full_design` 继续使用现有韧性校验、自动规范化和 warning 机制。
- Provider 超时、鉴权、限流和服务错误继续使用现有错误映射。
- 任一失败不得部分写回、保存 Pipeline、创建 Run/Task 或调用图片生成。

## Testing

- Schema 测试覆盖判别联合、缺失模式、混合字段和非法局部模式。
- Provider 测试覆盖加字、改色、删除小对象、背景替换、整体换风格、重新构图、多参考图和文生图。
- 来源解析测试覆盖本地图片、上游 Run 图片、未保存快照、自动保存竞态、真实 revision 冲突、伪造资产、unavailable、非图片和多参考图。
- 多模态适配器测试断言仅合法单图局部候选包含一个 `input_image`，且 JSON 上下文和日志不含图片 URL。
- 服务测试覆盖单段格式、保持语义、硬约束、BBox、否定条件、范围扩大、完整分层回归和原子失败。
- Mock Provider 使用固定语料确定性返回模式。
- 前端回归确认单段文本无需特殊解析即可写回、撤销和保存，完整分层显示不变。
- 浏览器使用 Mock Provider 验证局部编辑显示单段、完整设计显示分层，且未调用真实优化或图片生成接口。

## Non-Goals

- 不增加“局部编辑/完整设计”手动选择器。
- 不使用独立分类请求或关键词词表作为唯一判据。
- 不修改实际图生图生成接口、模型参数或计费逻辑。
- 不修改 LLM、生视频或文生图优化格式。
- 不在公开 API 或前端展示内部 `optimization_mode`。
- 不发送 BBox 引用图、风格参考图或多参考图做局部判别。
- 不迁移或重写已有提示词和历史 Run snapshot。
