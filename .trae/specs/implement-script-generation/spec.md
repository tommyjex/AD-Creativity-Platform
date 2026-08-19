# 剧本生成功能 Spec

## Why
当前创作流程已有故事和剧本阶段入口，但剧本生成仍停留在首版 mock/占位能力，无法稳定根据最新故事和项目 brief 生成可用于下游分镜的广告剧本。需要补齐真实剧本生成链路，让用户在故事确认后获得结构化、可读、可追溯的剧本文本。

## What Changes
- 后端剧本生成阶段读取当前项目最新成功故事文本和完整 brief。
- 后端调用文本生成能力，基于故事、商品信息、投放平台、画面比例、视频时长、视觉风格和目标受众生成广告剧本。
- 剧本结果保存为 `script` 阶段文本产物，写入 MySQL，并通过项目详情 API 返回。
- 剧本生成任务支持依赖校验、运行状态、失败脱敏、重试和下游 stale 标记。
- 工作台项目详情在剧本阶段展示生成结果，任务成功后刷新项目详情。
- **BREAKING**：无；保留现有故事、角色、分镜、图片、视频和剪辑接口兼容。

## Impact
- Affected specs: `create-ad-video-prd` 的剧本拆分需求；`write-technical-solution` 的文本模型与工作流编排；`implement-backend-modules` 的剧本阶段 API；`restructure-creative-workspace` 的创作流程管理。
- Affected code: `backend/app/services/modelark.py`、`backend/app/services/generation.py`、`backend/app/services/workflow.py`、`backend/app/api/routes.py`、repository/schema 测试、`frontend/components/workspace/*`、前端 API client 和工作台测试。

## ADDED Requirements
### Requirement: 基于故事和 Brief 生成剧本
The system SHALL generate an advertising script from the latest succeeded story artifact and the project brief.

#### Scenario: 剧本生成成功
- **WHEN** 项目存在最新成功故事，且用户触发剧本生成
- **THEN** 后端应读取该故事和项目 brief，并生成包含场次、画面描述、人物动作、台词/旁白、商品露出、节奏说明和转化号召的剧本
- **AND** 系统应将剧本保存为 `script` 阶段文本产物，状态为 `succeeded`

#### Scenario: 保留 Brief 约束
- **WHEN** 系统生成剧本
- **THEN** 剧本应体现 brief 中的商品名称、广告需求、投放平台、画面比例、视频时长、视觉风格和目标受众

#### Scenario: 故事缺失
- **WHEN** 项目没有成功故事文本，且用户触发剧本生成
- **THEN** 后端应拒绝生成请求，返回可理解的依赖缺失错误，不创建剧本文本产物

### Requirement: 剧本生成任务状态
The system SHALL manage script generation as a stage task with clear status and retry behavior.

#### Scenario: 创建剧本任务
- **WHEN** 用户触发剧本生成
- **THEN** 系统应创建或复用 `script` 阶段任务，并暴露 `queued`、`running`、`succeeded` 或 `failed` 状态

#### Scenario: 剧本生成失败
- **WHEN** 文本生成、保存或工作流处理失败
- **THEN** 任务应进入 `failed`，错误信息应脱敏，并允许用户重试

#### Scenario: 重新生成剧本
- **WHEN** 用户在剧本任务失败后重试，或上游故事变更后重新触发剧本生成
- **THEN** 系统应基于最新成功故事和最新 brief 生成新的剧本文本版本

### Requirement: 剧本结果展示
The system SHALL display generated scripts in the project workspace and refresh after task completion.

#### Scenario: 查看剧本
- **WHEN** 剧本生成成功并返回项目详情
- **THEN** 工作台应在剧本阶段展示剧本标题、状态、版本、更新时间和正文内容

#### Scenario: 前端轮询刷新
- **WHEN** 用户触发剧本生成任务
- **THEN** 前端应展示运行状态并在任务成功后刷新项目详情，显示最新剧本

## MODIFIED Requirements
### Requirement: 创作流程管理
The system SHALL 在工作台项目详情中按“故事、角色、剧本、分镜脚本、分镜视频、剪辑成片”推进创作流程，其中剧本阶段基于最新故事和 brief 生成可供分镜阶段使用的文本产物。

### Requirement: 文本生成能力
The system SHALL 使用文本生成适配层支持故事生成、剧本生成和分镜脚本生成；剧本生成必须显式接收故事内容和 brief 约束，不得只返回固定占位文本。

## REMOVED Requirements
### Requirement: 无
**Reason**: 本次为增量实现，不移除现有 mock 测试能力、阶段 API 或工作台交互。
**Migration**: 无需迁移历史剧本；新触发的剧本任务按最新故事和 brief 生成新版本。
