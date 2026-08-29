# AIGC 生图提示词优化与图片下载 Spec

## Why

AIGC 画布的文本输入节点目前只能手工编写提示词，用户难以稳定遵循 Seedream 5.0 的最佳实践；图片输出节点虽能预览结果，却缺少明确的本地下载操作。需要补齐提示词编辑辅助和结果交付闭环。

## What Changes

- 文本输入节点新增“优化生图提示词”操作。
- 新增无持久化副作用的同步提示词优化 API。
- 一次优化基础文本和全部 BBox 引用说明，但严格保持引用 ID、顺序与 BBox 不变。
- 优化规则遵循火山引擎《Seedream 4.0-5.0 提示词指南》。
- 优化结果直接替换当前节点草稿，作为一次可撤销操作，不自动保存画布。
- 图片输出节点和右侧结果面板增加本地下载入口。

## Impact

- Affected specs:
  - AIGC 文本输入节点
  - AIGC 结构化 BBox 提示词
  - AIGC 图片输出节点
  - ModelArk 文本生成能力
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/modelark.py`
  - `backend/app/services/generation.py`
  - `backend/app/api/aigc_routes.py`
  - `backend/app/api/dependencies.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/api-client.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - 对应前后端测试

## ADDED Requirements

### Requirement: 文本节点提示词优化入口

系统 SHALL 在 AIGC 文本输入节点的配置面板中提供可访问的“优化生图提示词”按钮。

#### Scenario: 可优化内容

- **WHEN** 基础文本或任一 BBox 引用说明包含非空内容
- **THEN** 优化按钮可用
- **AND** 点击后发起一次同步优化请求

#### Scenario: 空内容

- **WHEN** 基础文本和全部 BBox 引用说明均为空白
- **THEN** 优化按钮禁用
- **AND** 不发送请求

#### Scenario: 优化进行中

- **WHEN** 优化请求尚未结束
- **THEN** 按钮显示 loading 并禁用
- **AND** 基础文本、引用说明和删除引用操作禁用
- **AND** 不允许并发提交第二次优化

### Requirement: 结构化提示词优化 API

系统 SHALL 提供 `POST /api/aigc/prompts/optimize`，接收：

```json
{
  "text": "基础提示词",
  "reference_instructions": ["第一条 BBox 说明"],
  "generation_modes": ["text_to_image", "image_to_image"],
  "reference_image_count": 2
}
```

成功返回：

```json
{
  "optimized_text": "优化后的基础提示词",
  "optimized_reference_instructions": ["优化后的第一条 BBox 说明"]
}
```

`text` 最大 20000 个 Unicode code points；`reference_instructions` 最多 10 条，每条最大 4000 个 Unicode code points；`generation_modes` 仅允许 `text_to_image`、`image_to_image`，去重后最多两项；`reference_image_count` 为 0–10。

#### Scenario: 推导优化模式

- **WHEN** 文本节点存在直接下游图片模型
- **THEN** 前端按当前未保存 definition 收集文生图/图生图模式和最大参考图数量
- **WHEN** 文本节点尚未连接图片模型
- **THEN** 使用 `text_to_image` 作为默认模式
- **AND** 非图片模型下游不进入优化上下文

#### Scenario: 无持久化副作用

- **WHEN** API 成功或失败
- **THEN** 后端不保存 Pipeline、不创建 Run/Task、不生成图片
- **AND** 不修改资产、revision 或缓存

### Requirement: Seedream 提示词优化规则

系统 SHALL 使用现有文本模型，以低随机性返回一个结构化 JSON 对象，并遵循以下规则：

- 使用简洁、连贯的自然语言，避免关键词机械堆叠。
- 文生图明确主体、行为、环境和用途；按需补充风格、色彩、光影、构图。
- 需要生成的文字内容放在双引号中。
- 图生图明确参考对象、编辑动作和必须保持不变的内容。
- 多图输入明确不同参考图之间的替换、组合或风格迁移关系。
- 不改变用户明确表达的主体、品牌、产品、文字内容、数量、颜色、画幅或否定约束。
- 不增加用户未要求的品牌、文字、主体或创意目标。
- 不输出 Markdown、解释、分析过程或多个候选。
- 不生成 `<bbox>`、`<point>` 或固定 `图N` 标签。

#### Scenario: 优化结构化 BBox 提示词

- **WHEN** 请求包含 N 条 BBox 引用说明
- **THEN** 响应必须包含恰好 N 条优化说明
- **AND** 响应数组顺序与请求一致
- **AND** 图片节点 ID、BBox 坐标和引用顺序不发送给模型修改

#### Scenario: 模型输出非法

- **WHEN** 模型返回非法 JSON、空结果、字段缺失、引用说明数量变化、超长内容或坐标标签
- **THEN** API 返回脱敏错误
- **AND** 不返回部分优化结果

### Requirement: 优化结果应用与并发保护

系统 SHALL 将合法优化结果作为一次 Zustand 历史操作应用到当前文本节点。

#### Scenario: 优化成功

- **WHEN** 响应合法且节点内容自请求发出后未变化
- **THEN** 基础文本和每条引用说明一次性替换
- **AND** 引用 `source_node_id`、数组顺序和 BBox 保持不变
- **AND** 画布进入未保存状态
- **AND** 一次撤销恢复优化前的完整节点配置

#### Scenario: 无变化

- **WHEN** 优化结果与当前内容完全相同
- **THEN** 显示“当前提示词无需调整”
- **AND** 不新增历史记录、不改变 dirty 状态

#### Scenario: 过期响应

- **WHEN** 请求期间文本配置、引用集合或节点已变化
- **THEN** 丢弃该响应
- **AND** 保留当前内容并提示用户重新优化

#### Scenario: 优化失败

- **WHEN** 网络、模型或输出校验失败
- **THEN** 保留原始内容
- **AND** 显示可恢复的脱敏错误

### Requirement: 图片结果本地下载

系统 SHALL 为 AIGC 图片输出提供明确的本地下载操作。

#### Scenario: 输出节点下载

- **WHEN** 当前选中 Run 的图片输出节点存在可用结果和受控 `download_url`
- **THEN** 节点标题栏显示下载图标按钮
- **AND** 点击后通过 `/api/assets/{asset_id}/content?download=1` 受控下载端点下载原始图片

#### Scenario: 结果面板下载

- **WHEN** 右侧结果面板展示一个或多个可用图片结果
- **THEN** 每张图片下方显示“下载图片”按钮
- **AND** 每个按钮下载对应 ordinal 的原始图片

#### Scenario: 文件名

- **WHEN** 用户下载图片
- **THEN** 文件名使用 `{输出节点标题}-{ordinal}.{extension}`
- **AND** ordinal 从 1 开始
- **AND** extension 根据 MIME 类型映射为 `png`、`jpg` 或 `webp`，未知类型回退为 `png`
- **AND** 文件名中的路径分隔符和非法字符被替换
- **AND** 后端 `Content-Disposition` 为最终文件名权威来源，前端 `download` 属性提供一致的建议文件名

#### Scenario: 结果不可用

- **WHEN** 结果缺失、`available=false` 或 `download_url` 不安全
- **THEN** 不显示可点击下载入口
- **AND** 保留现有不可用提示

## MODIFIED Requirements

### Requirement: AIGC 文本输入节点配置

文本输入节点配置 SHALL 在现有基础文本与 BBox 引用编辑器上增加优化状态和反馈。优化状态仅保存在组件内，不进入 Pipeline definition。

### Requirement: AIGC 图片输出节点

图片输出节点 SHALL 在保持等比完整预览、原图弹窗和分辨率展示的基础上增加下载命令。下载不修改资产状态、Run、Pipeline 或当前选择。

## REMOVED Requirements

无。
