# AIGC 画布 LLM 图片输入 Spec

## Why

当前 AIGC 画布的 LLM 节点只能接收文本提示词，无法直接理解画布中已有的图片资产或上游图片生成结果。需要让用户能将单张图片连入 LLM 节点，以完成识图、素材分析和基于图片的文本生成。

## What Changes

- LLM 节点保留必填、单值的 `prompt` 文本输入，新增可选、单值的 `image` 图片输入。
- LLM 节点执行时解析该图片输入，使用受控临时 URL 将图片作为 ModelArk Responses API 的 `input_image` 与文本提示词共同发送。
- 支持本地图片节点及上游图片节点的成功、可访问图片结果；图片不可用时阻塞 LLM 及其后代，不使用过期或本地备用图片。
- 图片内容参与任务输入摘要与缓存哈希，但图片 URL、原始二进制和签名信息不得进入公开响应、Pipeline definition、Run snapshot、Task 参数、日志或错误。
- 前端在节点端口、连接反馈、检查器和运行状态中明确展示可选图片输入及其来源。
- **BREAKING**：LLM 节点注册表增加 `image` 输入端口；历史 definition 不含该端口时保持合法且行为不变。

## Impact

- Affected specs: AIGC 画布节点注册、DAG 校验、模态结果投影、LLM 任务参数、缓存、资产访问与运行详情。
- Affected code: `frontend/lib/aigc/node-registry.ts`、`frontend/lib/aigc/types.ts`、`frontend/components/workspace/aigc/`、`backend/app/schemas/aigc.py`、`backend/app/services/aigc_dag.py`、`backend/app/services/aigc_executor.py`、`backend/app/services/aigc_gateway.py`、ModelArk 适配层与相关测试。

## ADDED Requirements

### Requirement: LLM 可选图片端口

系统 SHALL 为 `llm` 节点提供一个名为 `image` 的可选 `image_asset` 输入端口，并保持 `prompt` 文本输入必填且单值。

#### Scenario: 连接单张图片

- **WHEN** 用户将图片节点的 `image` 输出连接至 LLM 的 `image` 输入
- **THEN** 前后端接受该连线
- **AND** LLM 仍必须存在一条有效的 `prompt` 文本入边

#### Scenario: 图片端口为空

- **WHEN** LLM 节点仅连接文本提示词
- **THEN** 节点继续按既有纯文本链路执行
- **AND** 不向模型发送 `input_image`

#### Scenario: 非法图片连接

- **WHEN** 用户连接非图片端口、为 `image` 增加第二条入边、或造成环路
- **THEN** 前端连接交互和后端 definition 校验均拒绝该变更

### Requirement: LLM 多模态执行

系统 SHALL 在 LLM 图片输入有效时，以文本和单张图片共同调用模型。

#### Scenario: 本地图片输入

- **WHEN** LLM 的图片输入来自本地图片节点，且资产为成功、公开、可访问的图片
- **THEN** 运行期将该资产解析为短期受控 URL
- **AND** Provider 请求的用户内容包含一项 `input_text` 和一项 `input_image`
- **AND** LLM 输出仍为现有文本结果类型

#### Scenario: 上游图片输入

- **WHEN** 图片节点以上游模式透传成功或复用的图片结果
- **THEN** LLM 使用该 Run 中的有效图片资产
- **AND** 不读取图片节点的本地备用资产

#### Scenario: 图片不可用

- **WHEN** 图片输入对应的上游运行失败、取消、超时、不可用，或资产不再可访问
- **THEN** LLM 节点及其后代按现有依赖规则进入阻塞或失败状态
- **AND** 不调用 Provider

### Requirement: 图片输入的缓存与安全边界

系统 SHALL 将有效图片资产身份及其可用性摘要纳入 LLM 输入哈希，并将访问 URL 限制在本次 Provider 调用内。

#### Scenario: 图片变化触发重算

- **WHEN** LLM 的有效图片资产或文本提示词发生变化
- **THEN** LLM 输入哈希变化且不得复用旧任务结果

#### Scenario: 图片访问凭据保护

- **WHEN** 系统构造多模态模型请求
- **THEN** 受控图片 URL 仅存在于 Provider 请求对象
- **AND** 不写入 API 响应、Pipeline、Run、Task 参数、日志、错误或调试信息

### Requirement: LLM 图片输入界面

系统 SHALL 让用户可发现并管理 LLM 的图片输入，同时保持现有画布布局和窄屏编辑可用。

#### Scenario: 配置与运行展示

- **WHEN** 用户选中带图片输入的 LLM 节点
- **THEN** 节点卡片和检查器显示图片输入已连接及其来源状态
- **AND** 在等待、阻塞、失败和成功运行中展示准确状态，不把备用图片显示为运行输入

#### Scenario: 断开图片

- **WHEN** 用户断开 LLM 的图片输入连线
- **THEN** LLM 立即恢复纯文本执行语义
- **AND** 不影响提示词连线、系统提示词或既有文本输出

## MODIFIED Requirements

### Requirement: LLM 节点输入与执行

LLM 节点 SHALL 始终接收一条必填、单值的文本 `prompt` 输入，并可额外接收至多一条可选图片 `image` 输入。无图片时调用既有纯文本模型路径；有有效图片时调用多模态 Responses API 路径，输出均为文本。历史不含 `image` 输入连线的 Pipeline 无需迁移且保持原行为。

## REMOVED Requirements

无。
