# 后端存储引入 MySQL 和 TOS Spec

## Why
当前后端首版模块使用进程内内存仓储和 mock 资产 URL，服务重启后数据会丢失，资产也没有真实持久化位置。需要引入 MySQL 保存业务数据，并接入 TOS 保存上传文件、生成图片、分镜视频和最终成片等资产。

## What Changes
- 将后端仓储从 `InMemoryRepository` 扩展为可使用 MySQL 的持久化仓储。
- 新增数据库配置读取，使用 `.env` 中的 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`。
- 新增 TOS 配置读取，使用 `.env` 中的 `TOS_ACCESS_KEY`/`TOS_AK`、`TOS_SECRET_KEY`/`TOS_SK`、`TOS_ENDPOINT`、`TOS_PUBLIC_ENDPOINT`、`TOS_REGION`、`TOS_BUCKET`。
- 新增资产存储服务，将本地上传、mock 生成资产和后续模型生成结果统一抽象为 TOS object key 与可访问 URL。
- 保留测试可控性：单元测试可使用临时数据库或 SQLite 兼容路径，真实 MySQL/TOS 连接测试按环境变量启用。
- 不包含 **BREAKING** 变更；API 响应结构尽量保持兼容。

## Impact
- Affected specs: `implement-backend-modules` 中的内存仓储、资产 mock、任务与项目 API、测试策略。
- Affected code: `backend/app/core/config.py`、`backend/app/repositories/*`、`backend/app/services/assets.py`、`backend/app/api/dependencies.py`、`backend/app/schemas/*`、`backend/pyproject.toml`、`backend/tests/*`。

## ADDED Requirements

### Requirement: MySQL 配置读取
The system SHALL 从环境变量读取 MySQL 连接配置，并构造后端数据库连接。

#### Scenario: 配置存在
- **WHEN** 后端启动并加载 `.env` 中的数据库变量
- **THEN** 系统应能读取 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME` 并构造数据库连接配置

#### Scenario: 配置缺失
- **WHEN** 必要数据库配置缺失
- **THEN** 系统应返回清晰配置错误，不应打印数据库密码

### Requirement: MySQL 持久化仓储
The system SHALL 使用 MySQL 保存项目、brief、文本产物、分镜、任务和资产数据。

#### Scenario: 项目持久化
- **WHEN** 调用 `POST /api/projects` 创建项目
- **THEN** 项目、brief 和初始状态应写入 MySQL

#### Scenario: 重启后可读取
- **WHEN** 服务重启后调用 `GET /api/projects/{project_id}`
- **THEN** 系统应能从 MySQL 读取此前保存的项目聚合数据

#### Scenario: 任务和产物持久化
- **WHEN** 用户触发故事、剧本、分镜、生图、生视频或剪辑任务
- **THEN** 任务状态、文本产物、分镜和资产记录应持久化到 MySQL

### Requirement: 仓储抽象兼容
The system SHALL 保留仓储抽象，使 API 和 workflow 不直接依赖具体数据库实现。

#### Scenario: API 不直接访问 ORM
- **WHEN** 查看 API 路由和 workflow 服务
- **THEN** 业务逻辑应通过 repository 接口访问数据，而不是直接操作 SQLAlchemy session 或 SQL 文本

#### Scenario: 测试可替换仓储
- **WHEN** 运行单元测试
- **THEN** 测试应能使用隔离数据库或测试仓储，不依赖生产 MySQL 数据

### Requirement: 数据库初始化
The system SHALL 提供数据库表结构初始化能力。

#### Scenario: 初始化表结构
- **WHEN** 开发环境首次运行数据库初始化命令
- **THEN** 系统应创建项目、文本产物、分镜、任务和资产相关表

#### Scenario: 初始化幂等
- **WHEN** 重复运行数据库初始化命令
- **THEN** 系统不应破坏已有表和数据

### Requirement: TOS 配置读取
The system SHALL 从环境变量读取 TOS 配置，并初始化对象存储客户端。

#### Scenario: TOS 配置存在
- **WHEN** 后端加载 `.env` 中的 TOS 变量
- **THEN** 系统应能读取 access key、secret key、endpoint、region、bucket 和 public endpoint

#### Scenario: TOS 密钥保护
- **WHEN** 日志或错误响应输出配置错误
- **THEN** 系统不得输出完整 TOS access key 或 secret key

### Requirement: TOS 资产服务
The system SHALL 使用 TOS 保存资产文件，并在 MySQL 中保存资产元数据。

#### Scenario: 上传文件保存
- **WHEN** 用户上传图片或后端接收待保存文件
- **THEN** 系统应将文件写入 TOS，并在 MySQL `Asset` 记录中保存 object key、URL、文件类型、大小和来源任务

#### Scenario: 生成资产转存
- **WHEN** mock 或真实模型返回图片/视频 URL
- **THEN** 系统应通过资产服务保存或登记资产，并生成稳定的 TOS object key

#### Scenario: 获取资产列表
- **WHEN** 调用 `GET /api/projects/{project_id}/assets`
- **THEN** 系统应返回 MySQL 中记录的资产元数据和可访问 URL

### Requirement: 测试与验证
The system SHALL 在 `.venv` 虚拟环境中验证后端存储功能。

#### Scenario: 单元测试
- **WHEN** 执行 `.venv/bin/python -m pytest backend -q`
- **THEN** 数据库仓储、资产服务、API 和 workflow 测试应通过

#### Scenario: 可选集成测试
- **WHEN** `.env` 中 MySQL 和 TOS 配置可用且显式启用集成测试
- **THEN** 系统应能验证 MySQL 连接、表初始化和 TOS 写入/读取基础流程

## MODIFIED Requirements

### Requirement: 后端仓储实现
`implement-backend-modules` 中的进程内内存仓储 SHALL 保留为测试或本地 fallback，但默认后端运行路径 SHALL 使用 MySQL 持久化仓储。

### Requirement: 资产记录实现
`implement-backend-modules` 中的 mock 资产 URL SHALL 扩展为 TOS object key 和可访问 URL 记录；mock 模型仍可生成内容，但资产元数据应通过资产服务统一保存。

## REMOVED Requirements

### Requirement: 仅内存存储
**Reason**: 内存存储无法满足服务重启后的项目、任务和资产持久化需求。
**Migration**: 新增 MySQL 仓储并将默认依赖注入切换到 MySQL；内存仓储仅用于测试或显式本地 fallback。
