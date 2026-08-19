# 前端页面开发 Spec

## Why
PRD 已定义广告创造力平台从图文需求到广告视频成片的端到端产品链路，技术方案已明确前端使用 React + Next.js + Tailwind + shadcn/ui。当前项目已有后端 API 与存储能力，需要推进前端页面开发，让用户可以通过具有科技感、大气的创作工作台完成项目创建、阶段生成、进度查看、资产预览和成片导出。

## What Changes
- 新增前端应用，使用 React + Next.js App Router + Tailwind CSS + shadcn/ui。
- 新增科技感、大气的视觉系统：深色底、精密网格、玻璃拟态面板、高亮能量线、电影级层次和克制动效。
- 新增首页创作工作台、项目详情页、资产库页和导出预览页。
- 新增与现有 FastAPI 后端对接的 API client，覆盖项目创建、详情查询、阶段生成、任务轮询、失败重试和资产列表。
- 新增核心 UI 组件：Brief 表单、阶段进度、文本产物展示、分镜表、资产网格、任务状态面板、视频预览。
- 新增前端测试与基础质量校验。
- 不包含 **BREAKING** 变更；后端 API 不在本次任务中重构。

## Impact
- Affected specs: `create-ad-video-prd` 的需求输入、故事、剧本、分镜、生图、生视频、剪辑成片、资产管理；`write-technical-solution` 的前端页面、组件、状态管理和 API 交互方案。
- Affected code: 新增 `frontend/` Next.js 应用；可能新增前端配置、组件、API 类型、测试用例和 README 级运行说明。

## ADDED Requirements

### Requirement: 前端应用骨架
The system SHALL 提供基于 React + Next.js + Tailwind + shadcn/ui 的前端应用骨架。

#### Scenario: 启动前端开发服务
- **WHEN** 开发者安装依赖并启动前端
- **THEN** 应能访问首页创作工作台，并看到广告创造力平台的科技感界面

#### Scenario: 基础样式可复用
- **WHEN** 新增页面或组件
- **THEN** 应能复用 Tailwind 主题变量、shadcn/ui 组件和平台级视觉样式

### Requirement: 科技感大气 UI 风格
The system SHALL 使用具有科技感、大气、专业广告创作平台气质的 UI 设计。

#### Scenario: 用户进入首页
- **WHEN** 用户打开平台首页
- **THEN** 页面应呈现深色电影级背景、精密网格/光晕、清晰主标题、平台价值说明和创作入口

#### Scenario: 用户操作创作流程
- **WHEN** 用户在项目详情页查看阶段和资产
- **THEN** UI 应通过层级、动效、状态色和空间布局强调从 brief 到成片的生产流水线感

### Requirement: Brief 创建工作台
The system SHALL 提供文字需求输入和基础项目参数表单，用于创建广告视频项目。

#### Scenario: 创建项目成功
- **WHEN** 用户填写广告需求、平台、比例、时长、风格、受众和商品名称并提交
- **THEN** 前端应调用 `POST /api/projects` 创建项目，并跳转到项目详情页

#### Scenario: 表单校验失败
- **WHEN** 用户未填写必要广告需求
- **THEN** 前端应阻止提交并展示清晰错误提示

### Requirement: 项目详情创作流程
The system SHALL 在项目详情页展示项目状态、阶段进度、文本产物、分镜、资产和下一步生成入口。

#### Scenario: 查看项目详情
- **WHEN** 用户打开 `/projects/[projectId]`
- **THEN** 前端应调用 `GET /api/projects/{project_id}` 并展示 brief、当前阶段、任务状态、文本产物、分镜和资产摘要

#### Scenario: 触发阶段生成
- **WHEN** 用户点击故事、剧本、分镜、生图、生视频或剪辑生成按钮
- **THEN** 前端应调用对应后端阶段 API，并在任务面板中展示返回的 `task_id` 和状态

### Requirement: 任务轮询与失败重试
The system SHALL 提供生成任务状态轮询和失败重试入口。

#### Scenario: 任务运行中
- **WHEN** 阶段生成任务处于 `queued` 或 `running`
- **THEN** 前端应轮询 `GET /api/tasks/{task_id}`，并展示进度、阶段和等待提示

#### Scenario: 任务成功
- **WHEN** 任务状态变为 `succeeded`
- **THEN** 前端应刷新项目详情和资产列表，展示新产物

#### Scenario: 任务失败
- **WHEN** 任务状态变为 `failed`
- **THEN** 前端应展示错误摘要，并提供 `POST /api/tasks/{task_id}/retry` 的重试入口

### Requirement: 资产库页面
The system SHALL 提供项目资产库页面，展示上传图片、生成图片、分镜视频和最终成片。

#### Scenario: 查看资产列表
- **WHEN** 用户打开 `/projects/[projectId]/assets`
- **THEN** 前端应调用 `GET /api/projects/{project_id}/assets`，按资产类型和阶段展示预览卡片

#### Scenario: 资产为空
- **WHEN** 项目暂未生成任何资产
- **THEN** 前端应展示空状态和返回创作流程的行动入口

### Requirement: 导出预览页面
The system SHALL 提供成片预览与导出页面。

#### Scenario: 成片已生成
- **WHEN** 项目存在 `final_video` 资产
- **THEN** 前端应展示视频预览、资产信息和下载入口

#### Scenario: 成片未生成
- **WHEN** 项目尚无最终成片
- **THEN** 前端应提示用户返回项目详情完成生视频和剪辑阶段

### Requirement: 前端 API 类型与错误处理
The system SHALL 定义前端类型、API client 和统一错误反馈。

#### Scenario: API 请求失败
- **WHEN** 后端返回 4xx 或 5xx 错误
- **THEN** 前端应展示可理解错误消息，不暴露内部堆栈或敏感配置

#### Scenario: 后端地址配置
- **WHEN** 前端运行在开发环境
- **THEN** 应通过环境变量配置 FastAPI 后端 base URL，并提供合理默认值

### Requirement: 前端质量验证
The system SHALL 提供可运行的前端构建、类型检查和测试验证。

#### Scenario: 执行前端验证
- **WHEN** 开发者运行前端验证命令
- **THEN** 应通过 lint/typecheck/test/build 中适合当前项目依赖的检查

## MODIFIED Requirements

### Requirement: 技术方案前端落地
`write-technical-solution` 中定义的前端页面、核心组件、状态展示和任务轮询 SHALL 由本次新增的 Next.js 前端应用落地；首版聚焦工作台闭环，不实现复杂多轨编辑器、模板市场或用户体系。

## REMOVED Requirements

### Requirement: 无前端实现
**Reason**: 当前项目只有后端模块，无法让用户可视化使用广告创造力平台。
**Migration**: 新增 `frontend/` 应用，通过现有后端 API 完成用户可见创作流程。
