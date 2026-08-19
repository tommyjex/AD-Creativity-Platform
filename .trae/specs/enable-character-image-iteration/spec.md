# 角色图片编辑与重新生成 Spec

## Why
当前项目详情页角色选项卡只能查看已生成角色图，用户对局部细节不满意或整体风格不满意时缺少可控迭代入口。需要在保留已生成资产可追溯性的前提下，支持基于 Seedream 5.0 Pro 的角色图片微调和完整重新生成。

## What Changes
- 在工作台项目详情的“角色”选项卡中，为成功生成的角色图片增加“编辑”和“重新生成”操作。
- “编辑”支持用户输入文本提示词，后端调用 Seedream 5.0 Pro 图生图能力，以当前角色图片为参考进行微调。
- “重新生成”支持用户基于历史生成提示词进行修改，后端调用 Seedream 5.0 Pro 重新生成新的角色图。
- 新生成的编辑图或重生成图均上传到 TOS，并作为新的角色资产写入 MySQL，保留来源资产、提示词、操作类型和任务信息。
- 角色选项卡刷新后展示最新成功角色资产，同时保留可追溯元数据，失败时提供可理解错误和重试入口。
- **BREAKING**：无；现有角色查看、角色生成、资产库筛选和旧资产展示继续兼容。

## Impact
- Affected specs: `restructure-creative-workspace` 的角色选项卡与角色资产管理；`write-technical-solution` 的 Seedream 生图/图生图和资产存储方案；`introduce-backend-storage` 的 TOS/MySQL 资产持久化。
- Affected code: `backend/app/api/routes.py`、`backend/app/services/modelark.py`、`backend/app/services/generation.py`、`backend/app/services/assets.py`、`backend/app/services/workflow.py`、repository/schema 层、`frontend/components/workspace/project-detail-tabs.tsx`、前端 API client 和相关测试。

## ADDED Requirements
### Requirement: 角色图片编辑
The system SHALL allow users to edit an existing succeeded character image from the project detail character tab using a text prompt and Seedream 5.0 Pro image-to-image generation.

#### Scenario: 提交角色图片编辑
- **WHEN** 用户在角色选项卡点击某个成功角色图片的“编辑”，输入微调提示词并提交
- **THEN** 前端应调用后端角色图片编辑接口，并展示任务提交、执行中、成功或失败状态

#### Scenario: 图生图微调成功
- **WHEN** 后端收到角色图片编辑请求
- **THEN** 系统应使用当前角色图片的可访问 URL 作为参考图，结合用户输入提示词调用 Seedream 5.0 Pro 图生图
- **AND** 系统应将生成结果下载并上传到 TOS
- **AND** 系统应在 MySQL 中创建新的角色资产，记录 `operation=edit`、来源资产 ID、编辑提示词、模型名、来源任务 ID 和 TOS object key

#### Scenario: 编辑失败
- **WHEN** Seedream 调用、图片下载、TOS 上传或数据库写入失败
- **THEN** 系统应将任务标记为失败，返回脱敏错误信息，不创建不完整资产，并允许用户重新提交编辑

### Requirement: 角色图片重新生成
The system SHALL allow users to regenerate a character image when the existing image style is not acceptable, while pre-filling the historical generation prompt for user adjustment.

#### Scenario: 打开重新生成面板
- **WHEN** 用户在角色选项卡点击某个成功角色图片的“重新生成”
- **THEN** 前端应展示可编辑的历史提示词，允许用户基于原提示词调整角色外观、风格或画面要求

#### Scenario: 重新生成成功
- **WHEN** 用户提交调整后的提示词
- **THEN** 后端应调用 Seedream 5.0 Pro 生图能力重新生成角色图片
- **AND** 系统应将生成结果上传到 TOS，并在 MySQL 中创建新的角色资产，记录 `operation=regenerate`、来源资产 ID、历史提示词、用户调整后的提示词、模型名和来源任务 ID

#### Scenario: 历史提示词缺失
- **WHEN** 角色资产没有可用历史提示词
- **THEN** 前端应使用角色名称、描述、项目 Brief 和已有元数据生成可编辑的提示词初稿，并提示用户该提示词为系统补全

### Requirement: 角色资产版本与展示
The system SHALL keep character image iterations traceable and display the latest usable character image in the character tab.

#### Scenario: 展示最新角色图
- **WHEN** 一个角色存在原始生成图、编辑图或重新生成图
- **THEN** 角色选项卡应优先展示同一角色最新成功且非 stale 的资产

#### Scenario: 保留历史资产
- **WHEN** 新的编辑或重新生成资产创建成功
- **THEN** 系统不得删除历史角色资产，并应通过元数据保留来源关系，便于审计和回溯

### Requirement: 任务状态与安全
The system SHALL handle character image iteration as backend-controlled generation tasks without exposing provider credentials or raw provider errors.

#### Scenario: 任务查询
- **WHEN** 前端提交编辑或重新生成任务后轮询任务状态
- **THEN** 后端应返回统一任务状态、进度、失败摘要和输出资产 ID

#### Scenario: 敏感信息保护
- **WHEN** 模型、TOS 或下载链路报错
- **THEN** API 响应、日志和前端错误提示不得包含 Ark API Key、TOS Key、签名 URL query、数据库密码或供应商原始敏感响应

## MODIFIED Requirements
### Requirement: 角色选项卡查看
The system SHALL 在工作台项目详情“角色”选项卡中展示成功角色资产，并为每个可用角色图片提供查看、编辑和重新生成入口。编辑用于保留当前图主体进行微调；重新生成用于用户不接受整体风格时基于历史提示词创建新图。

### Requirement: Seedream 生图能力
The system SHALL 使用 `doubao-seedream-5-0-pro-260628` 支持角色首轮生图、角色图生图编辑和角色重新生成，并将所有生成结果通过后端转存到 TOS 后再写入 MySQL。

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次变更为增量能力，不移除现有角色生成、查看、跳过或资产库能力。
**Migration**: 无需迁移历史资产；缺少历史提示词的旧资产在重新生成时由系统生成可编辑提示词初稿。
