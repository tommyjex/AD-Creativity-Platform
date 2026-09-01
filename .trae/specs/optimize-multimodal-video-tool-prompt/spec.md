# 全模态参考生视频 创作提示词 AI 优化 Spec

## Why

全模态参考生视频工具的“创作提示词”目前只能手工输入。用户往往写出模糊的编辑意图（例如“把男人的动作改一下”），缺少明确的修改范围、时间戳和 A→B 描述，导致 Seedance 参考生视频/编辑效果不稳定。在提示词编辑器右上角增加一个“五角星”优化入口，点击后调用 seed evolving（`doubao-seed-evolving` 文本模型）按“编辑类提示词”原则整理草稿，可帮助用户快速得到范围明确、可生成的提示词。

## What Changes

- 在“全模态参考生视频”面板的“创作提示词”标题行右上角新增一个五角星（`Star`）优化按钮。
- 提示词为空或全为空白时，优化按钮禁用，不能触发优化。
- 点击优化按钮时，前端调用新增的同步优化 API，将当前草稿与已选参考素材数量作为上下文提交。
- 新增同步提示词优化 API：`POST /api/tools/videos/optimize-prompt`，接收当前草稿并返回优化后的提示词，不创建任务、不触发视频生成。
- 优化通过 seed evolving（`settings.ark_text_model`）完成，系统指令要求：明确需要修改的范围和内容，可配合时间戳做部分编辑，尽可能说明修改内容从 A→B 的过程，并对齐工具已选参考素材的标准编号（视频1..N、图片1..N、音频1..N）。
- 优化成功后仅替换前端“创作提示词”文本框内容，用户仍可继续编辑或点击“生成视频”。
- 优化进行中优化按钮显示 loading、禁用；生成按钮与优化按钮互斥禁用，避免并发提交。
- 优化失败（网络、模型或输出校验失败）时保留原草稿并显示脱敏错误。
- 不新增数据库字段，不创建 ToolTask，不改动既有视频生成链路。

## Impact

- Affected specs:
  - 全模态参考生视频工具面板（`add-independent-video-tools` 系列）
  - ModelArk 文本生成能力（seed evolving）
- Affected code:
  - `backend/app/schemas/tools.py`（工具视频相关 schema）
  - `backend/app/services/modelark.py`（适配器优化方法 + mock）
  - `backend/app/services/generation.py`（工具提示词优化服务方法）
  - `backend/app/api/routes.py`（新增 `/tools/videos/optimize-prompt` 路由）
  - `frontend/lib/api-types.ts`
  - `frontend/lib/api-client.ts`
  - `frontend/components/workspace/tools-workspace.tsx`
  - 后端与前端相关测试

## ADDED Requirements

### Requirement: 创作提示词优化入口

系统 SHALL 在“全模态参考生视频”面板“创作提示词”标题行右上角提供一个五角星优化按钮，使用 lucide `Star` 图标，具备明确的可访问名称（例如“优化提示词”）。

#### Scenario: 用户看到优化入口

- **WHEN** 用户切换到“全模态参考生视频”工具面板
- **THEN** “创作提示词”标题旁显示五角星优化按钮
- **AND** 按钮具备可访问名称

#### Scenario: 提示词为空禁止优化

- **WHEN** 提示词输入框为空或仅包含空白字符
- **THEN** 五角星优化按钮处于禁用状态
- **AND** 点击不会发起优化请求

#### Scenario: 优化进行中或正在生成

- **WHEN** 当前正在执行提示词优化或正在提交视频生成
- **THEN** 五角星优化按钮禁用并展示 loading 状态
- **AND** 不允许并发发起第二次优化

### Requirement: 同步提示词优化 API

系统 SHALL 提供同步接口：

`POST /api/tools/videos/optimize-prompt`

请求体：

```json
{
  "prompt": "当前创作提示词草稿",
  "reference_image_count": 0,
  "reference_video_count": 0,
  "reference_audio_count": 0
}
```

- `prompt` 必填，首尾空白应被清理；清理后为空 SHALL 返回 `422 validation_error`，且不调用模型。
- `prompt` 最大长度为 12000 字符。
- `reference_image_count` / `reference_video_count` / `reference_audio_count` 为非负整数，默认 `0`，用于让模型对齐已选参考素材的标准编号。

成功响应：

```json
{
  "optimized_prompt": "优化后的创作提示词"
}
```

#### Scenario: 使用当前草稿优化

- **WHEN** 用户提交非空草稿
- **THEN** 后端以该草稿作为优化对象调用 seed evolving
- **AND** 返回符合优化原则的完整提示词

#### Scenario: 空白草稿被拒绝

- **WHEN** 请求 `prompt` 为空或全为空白
- **THEN** API 返回 `422 validation_error`
- **AND** 不调用模型

### Requirement: 优化遵循编辑类提示词原则

系统 SHALL 通过 seed evolving（`settings.ark_text_model`）生成一个 JSON 对象：

```json
{ "optimized_prompt": "..." }
```

系统指令 SHALL 要求优化结果：

- 明确需要修改的范围和内容。
- 可配合时间戳（如 `4-6 秒`）进行部分编辑。
- 尽可能说明修改内容从 A→B 的过程。
- 未被要求修改的内容保持不变。
- 使用与工具一致的标准素材编号（`视频1..N`、`图片1..N`、`音频1..N`），且不得臆造不存在的素材编号。

系统指令 SHALL 参考如下示例风格（仅作为写法示范，不写入结果）：

- 示例 1：仅编辑视频 1 中男人的台词，修改为「你不要过来啊」，口音调整为东北口音…
- 示例 2：把视频 1 中 4-6 秒男人喝咖啡的动作改变为拖地，其余内容不要变化。
- 示例 3：编辑任务：把视频 1 中右侧的亚洲女生改为图片 1 中的黑人女生。

优化结果 SHALL NOT：

- 输出 Markdown 代码围栏、解释、分析过程或多个候选版本。
- 超过 12000 字符。

真实适配器与 mock 适配器 SHALL 使用相同请求/响应契约。

#### Scenario: 模型输出合法

- **WHEN** 模型返回合法 JSON 且 `optimized_prompt` 非空、未超长
- **THEN** 清理首尾空白与 Markdown 代码围栏后返回该提示词

#### Scenario: 模型输出非法

- **WHEN** 模型返回非 JSON、空提示词或超长提示词
- **THEN** API 返回脱敏的外部服务/生成失败错误
- **AND** 不返回残缺结果

### Requirement: 优化结果仅替换前端草稿

系统 SHALL 在优化成功后将 `optimized_prompt` 写入“创作提示词”文本框，不创建任务，不触发视频生成。

#### Scenario: 优化成功

- **WHEN** 优化接口成功返回
- **THEN** 文本框内容替换为优化结果
- **AND** 用户可继续编辑或点击“生成视频”

#### Scenario: 优化失败

- **WHEN** 网络、模型或输出校验失败
- **THEN** 文本框保留优化前草稿
- **AND** 通过既有反馈区域显示可理解且脱敏的错误

### Requirement: 优化不产生持久化副作用

系统 SHALL 将优化视为草稿辅助操作。

#### Scenario: 仅点击优化

- **WHEN** 用户完成优化但未点击生成
- **THEN** 不创建 ToolTask
- **AND** 不生成或改动任何资产
- **AND** 不影响其他工具任务或面板状态

## MODIFIED Requirements

无。

## REMOVED Requirements

无。
