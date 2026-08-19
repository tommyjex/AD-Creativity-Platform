# 后端模块开发 Spec

## Why
现有 PRD 和技术方案已经定义广告创造力平台的产品链路与后端架构。本次需要启动后端模块开发，先交付一个可运行、可测试、边界清晰的 FastAPI 后端基础切片，为后续接入数据库、队列、对象存储和真实 ModelArk 调用打基础。

## What Changes
- 新增 Python + FastAPI 后端应用骨架，提供健康检查、项目、任务、资产和生成阶段 API。
- 新增 Pydantic schema，覆盖 Project、Brief、TextArtifact、StoryboardShot、GenerationTask、Asset 等核心对象。
- 新增内存仓储与工作流服务，支持首版本地开发和自动化测试，不引入持久化数据库。
- 新增 ModelArk 适配层接口与本地 mock 实现，保留 `doubao-seed-evolving`、`doubao-seedream-5-0-pro-260628`、`doubao-seedance-2-5-260628` 配置入口。
- 新增基础测试，验证 API、状态流转、失败重试和 schema 约束。
- 不包含 **BREAKING** 变更。

## Impact
- Affected specs: `write-technical-solution` 中的 FastAPI 后端、API 草案、数据模型、异步任务机制、ModelArk 适配层、资产服务、视频服务和测试策略。
- Affected code: 预计新增 `backend/` 后端目录、FastAPI 应用入口、API 路由、schema、service、repository、worker/mock、测试和依赖配置。

## ADDED Requirements

### Requirement: FastAPI 后端应用骨架
The system SHALL provide 一个可启动的 FastAPI 后端应用，包含应用入口、路由注册、CORS 配置和健康检查接口。

#### Scenario: 健康检查
- **WHEN** 调用 `GET /health`
- **THEN** 系统应返回服务状态、应用名称和版本信息

#### Scenario: 应用可导入
- **WHEN** 测试或 ASGI Server 导入后端应用对象
- **THEN** 应能从稳定路径导入 FastAPI `app`

### Requirement: 核心 Schema
The system SHALL provide Pydantic schema，用于描述广告视频项目、brief、故事/剧本/分镜文本产物、分镜镜头、生成任务和资产。

#### Scenario: 创建项目请求校验
- **WHEN** 用户提交创建项目请求
- **THEN** 后端应校验文字需求不能为空，并校验目标平台、视频比例、时长和风格等字段

#### Scenario: 统一状态枚举
- **WHEN** 系统返回项目、任务、镜头或资产状态
- **THEN** 状态应来自统一枚举，至少包含 `queued`、`running`、`succeeded`、`failed`、`cancelled`、`expired`、`stale`

### Requirement: 项目 API
The system SHALL provide 项目创建、项目详情和资产列表 API，支持前端工作台读取项目状态。

#### Scenario: 创建项目
- **WHEN** 调用 `POST /api/projects` 并提交文字需求
- **THEN** 系统应创建项目、生成结构化 brief 初稿，并返回项目 ID、当前阶段和初始资产列表

#### Scenario: 获取项目详情
- **WHEN** 调用 `GET /api/projects/{project_id}`
- **THEN** 系统应返回项目、brief、文本产物、分镜、任务和资产摘要

#### Scenario: 查询项目资产
- **WHEN** 调用 `GET /api/projects/{project_id}/assets`
- **THEN** 系统应返回该项目下的上传图片、生成图片、分镜视频和最终视频资产列表

### Requirement: 生成阶段 API
The system SHALL provide 故事、剧本、分镜、生图、生视频和剪辑阶段的任务创建 API。

#### Scenario: 触发故事生成
- **WHEN** 调用 `POST /api/projects/{project_id}/story`
- **THEN** 系统应创建 `story` 阶段任务，并通过 mock ModelArk 适配层生成故事文本产物

#### Scenario: 触发剧本和分镜生成
- **WHEN** 调用 `POST /api/projects/{project_id}/script` 或 `POST /api/projects/{project_id}/storyboard`
- **THEN** 系统应基于上游产物创建任务并写入对应文本产物或分镜镜头

#### Scenario: 触发生图、生视频和剪辑
- **WHEN** 调用 `POST /api/projects/{project_id}/images`、`POST /api/projects/{project_id}/videos` 或 `POST /api/projects/{project_id}/compose`
- **THEN** 系统应创建对应阶段任务，并生成可测试的 mock 资产记录

### Requirement: 任务状态与重试 API
The system SHALL provide 任务查询和失败重试 API。

#### Scenario: 查询任务
- **WHEN** 调用 `GET /api/tasks/{task_id}`
- **THEN** 系统应返回任务状态、阶段、进度、错误摘要和关联项目

#### Scenario: 重试失败任务
- **WHEN** 调用 `POST /api/tasks/{task_id}/retry` 且原任务处于 `failed`
- **THEN** 系统应创建同阶段的新任务并保留原任务错误信息

#### Scenario: 幂等保护
- **WHEN** 同一项目同一阶段已有 `queued` 或 `running` 任务
- **THEN** 系统应返回现有任务，不重复创建新任务

### Requirement: 工作流服务
The system SHALL provide 工作流服务，负责阶段依赖、任务创建、任务执行、产物写入和下游 stale 标记。

#### Scenario: 阶段依赖校验
- **WHEN** 用户跳过必要上游阶段直接触发下游阶段
- **THEN** 系统应返回明确错误，不创建无效任务

#### Scenario: 上游产物变更
- **WHEN** 用户保存编辑后的故事
- **THEN** 系统应更新故事版本，并将依赖该故事的剧本、分镜、生图、生视频和成片标记为 `stale`

### Requirement: ModelArk 适配层
The system SHALL provide ModelArk 适配层接口和 mock 实现，隔离真实 SDK 调用细节。

#### Scenario: 文本 mock 生成
- **WHEN** 工作流请求生成故事、剧本或分镜
- **THEN** mock 适配层应返回结构化、可预测的文本结果，便于测试

#### Scenario: 图像和视频 mock 生成
- **WHEN** 工作流请求生图或生视频
- **THEN** mock 适配层应返回可预测的资产 URL 和元数据，便于前端联调

#### Scenario: 模型配置存在
- **WHEN** 后端读取配置
- **THEN** 应包含 `ARK_TEXT_MODEL`、`ARK_IMAGE_MODEL`、`ARK_VIDEO_MODEL` 默认值

### Requirement: 测试与本地运行
The system SHALL provide 后端依赖配置和自动化测试，确保首版模块可本地运行。

#### Scenario: 运行测试
- **WHEN** 执行后端测试命令
- **THEN** 项目 API、任务 API、工作流服务和 schema 校验测试应通过

#### Scenario: 本地启动说明可推导
- **WHEN** 研发查看后端依赖和应用入口
- **THEN** 应能通过常规 Python/FastAPI 方式安装依赖并启动服务

## MODIFIED Requirements

### Requirement: 技术方案后端落地
`write-technical-solution` 中定义的后端模块 SHALL 先以最小可运行切片落地；数据库、Redis 队列、对象存储和真实 ModelArk 调用 SHALL 通过接口预留，不在本次首版强制接入。

## REMOVED Requirements

### Requirement: 首版真实外部依赖强制接入
**Reason**: 为降低首个后端切片的集成风险，本次开发先使用内存仓储和 mock ModelArk 适配层，确保 API 与模块边界可测试。
**Migration**: 后续规格中将内存仓储替换为数据库，将 mock 适配层替换为真实 ModelArk SDK 调用，将进程内执行替换为队列/Worker。
