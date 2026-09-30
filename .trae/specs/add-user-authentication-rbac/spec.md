# 用户认证与角色权限 Spec

## Why

当前系统以无身份、单租户方式运行，任何能够访问服务的人都可以查看和修改全部创作数据，无法区分创作者与只读访客，也无法由管理员维护用户。需要建立最小但完整的本地账号、会话认证和角色权限体系，为共享创作空间提供访问控制。

## What Changes

- 新增首次访问初始化流程，仅在系统无用户时允许创建首个 `admin`。
- 新增用户名/密码登录、退出登录、当前用户查询和修改密码能力。
- 使用数据库会话与 HttpOnly Cookie，支持会话撤销、账号禁用和角色变更立即生效。
- 新增 `admin`、`creator`、`viewer` 三种平级角色。
- 全部现有项目、资产、工具和 AIGC 数据继续在共享工作区中可见，不增加数据所有者字段。
- `admin` 可创建用户、分配角色、启用/禁用账号和重置临时密码。
- 新用户使用临时密码首次登录，必须修改密码后才能进入工作区。
- 后端统一保护现有业务 API，前端新增登录、初始化、强制改密和用户管理页面，并根据权限隐藏或禁用写操作。
- 新增认证与用户管理安全审计日志，敏感凭据不得进入本地或云端日志。
- **BREAKING**：升级后，除健康检查和认证初始化相关接口外，现有页面与 API 均要求登录；首次部署升级必须先完成管理员初始化。

## Impact

- Affected specs: `build-aigc-workbench` 的无用户身份边界、`implement-frontend-pages` 的页面入口、`write-technical-solution` 的 API 权限校验、全部现有业务模块的读写访问规则。
- Affected backend:
  - `backend/app/db/models.py`
  - `backend/app/db/session.py`
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `backend/app/schemas/`
  - `backend/app/services/`
  - `backend/app/api/dependencies.py`
  - `backend/app/api/router.py`
  - `backend/app/api/routes.py`
  - `backend/app/api/aigc_routes.py`
  - `backend/app/main.py`
  - `backend/app/core/config.py`
- Affected frontend:
  - `frontend/app/layout.tsx`
  - `frontend/app/login/`
  - `frontend/app/setup/`
  - `frontend/app/change-password/`
  - `frontend/app/workspace/admin/users/`
  - `frontend/components/layout/app-shell.tsx`
  - `frontend/lib/api-client.ts`
  - `frontend/lib/api-types.ts`
  - 新增认证状态与权限工具。
- Affected operations: MySQL 新表、认证 Cookie 配置、同源/CORS 配置、部署后的首次初始化步骤。

## ADDED Requirements

### Requirement: 用户与角色模型

系统 SHALL 持久化用户账号，并使用 `admin`、`creator`、`viewer` 三种角色之一表示其全局权限。用户名使用去除首尾空白后的小写规范值进行唯一比较，允许长度 3 至 64 的字母、数字、点、下划线和连字符；显示名称长度为 1 至 80。

用户至少包含：稳定用户 ID、规范化用户名、显示名称、密码哈希、角色、启用状态、是否必须修改密码、创建时间、更新时间和最后登录时间。系统不得保存明文密码。

#### Scenario: 创建合法用户
- **WHEN** admin 提交唯一用户名、有效显示名称、符合密码策略的临时密码和合法角色
- **THEN** 系统创建启用用户
- **AND** 密码仅以强密码哈希保存
- **AND** 新用户被标记为必须修改密码

#### Scenario: 用户名重复
- **WHEN** admin 使用与现有用户大小写不同但规范值相同的用户名创建用户
- **THEN** 系统返回冲突错误
- **AND** 不创建重复账号

#### Scenario: 密码不符合策略
- **WHEN** 初始化管理员、创建用户、重置密码或修改密码时，密码少于 12 个字符、超过 128 个字符或与用户名相同
- **THEN** 系统拒绝请求并返回可理解的校验错误
- **AND** 不记录提交的密码内容

### Requirement: 首次管理员初始化

系统 SHALL 提供首次初始化状态查询和首个管理员创建能力。仅当用户表为空时允许初始化；初始化提交的账号固定获得 `admin` 角色、启用状态且无需再次强制修改密码。

#### Scenario: 首次初始化成功
- **WHEN** 系统中不存在任何用户，访问者提交合法用户名、显示名称和密码
- **THEN** 系统以事务方式创建首个 `admin`
- **AND** 创建登录会话
- **AND** 返回当前管理员信息

#### Scenario: 并发初始化
- **WHEN** 两个请求并发尝试创建首个管理员
- **THEN** 数据库约束与事务保证最多一个请求成功
- **AND** 另一个请求返回初始化已完成的冲突错误

#### Scenario: 初始化入口已关闭
- **WHEN** 系统中已存在任意用户
- **THEN** 初始化状态返回已完成
- **AND** 后续初始化请求均被拒绝

### Requirement: 数据库会话认证

系统 SHALL 在登录成功后生成不可预测的随机会话令牌，通过 HttpOnly Cookie 返回，并仅在数据库保存令牌摘要。会话具有 12 小时空闲过期和 7 天绝对过期；有效请求可更新最后活动时间，但不得延长绝对过期时间。

Cookie 名称 SHALL 为 `ad_session`，路径为 `/`，`SameSite=Lax`；生产 HTTPS 环境启用 `Secure`。状态变更请求 SHALL 验证请求来源与配置的站点源一致。生产环境不得使用通配 CORS 来源并同时启用凭据。

#### Scenario: 登录成功
- **WHEN** 启用用户提交正确用户名和密码
- **THEN** 系统创建新会话并设置安全 Cookie
- **AND** 更新最后登录时间
- **AND** 返回不含密码哈希的当前用户信息

#### Scenario: 登录失败
- **WHEN** 用户名不存在、密码错误或账号已禁用
- **THEN** 系统返回相同的通用认证失败信息
- **AND** 不泄露账号是否存在或被禁用

#### Scenario: 会话过期或撤销
- **WHEN** Cookie 对应会话已过期、被撤销或所属用户已禁用
- **THEN** 业务 API 返回 `401`
- **AND** 浏览器清除无效会话 Cookie

#### Scenario: 用户退出登录
- **WHEN** 已登录用户提交退出
- **THEN** 当前会话被撤销
- **AND** Cookie 被清除

### Requirement: 登录限流

系统 SHALL 按规范化用户名与来源 IP 对失败登录进行持久化限流。15 分钟窗口内达到 5 次失败后，后续登录在窗口结束前返回 `429`；成功登录清除对应失败计数。响应不得暴露账户存在性。

#### Scenario: 连续失败触发限流
- **WHEN** 同一用户名与来源 IP 在 15 分钟内发生第 5 次失败
- **THEN** 后续尝试返回 `429`
- **AND** 日志只记录脱敏用户名标识、来源摘要、结果和请求 ID

### Requirement: 首次登录强制修改密码

系统 SHALL 限制 `must_change_password=true` 用户只能访问当前用户信息、修改密码和退出登录接口。修改密码成功后，应撤销该用户其他会话、轮换当前会话并清除强制改密标记。

#### Scenario: 临时密码首次登录
- **WHEN** 新用户使用 admin 设置的临时密码登录
- **THEN** 前端跳转到修改密码页
- **AND** 业务页面与业务 API 在改密前不可访问

#### Scenario: 修改密码成功
- **WHEN** 用户提供正确当前密码和符合策略的新密码
- **THEN** 系统更新密码哈希并清除强制改密标记
- **AND** 撤销旧会话并建立新会话
- **AND** 用户进入共享工作区

### Requirement: 全局角色权限

系统 SHALL 以服务端最新用户状态和角色执行以下权限矩阵，前端可隐藏或禁用无权操作，但不得作为唯一权限边界。

| 能力 | admin | creator | viewer |
| --- | --- | --- | --- |
| 查看项目、资产、工具、AIGC 画布与运行结果 | 允许 | 允许 | 允许 |
| 下载可查看资产 | 允许 | 允许 | 允许 |
| 创建、编辑、删除业务数据 | 允许 | 允许 | 拒绝 |
| 发起、重试、取消生成或处理任务 | 允许 | 允许 | 拒绝 |
| 管理用户与角色 | 允许 | 拒绝 | 拒绝 |

现有数据继续属于共享工作区，所有已登录用户按上述权限访问全部数据。

#### Scenario: viewer 查看共享数据
- **WHEN** viewer 请求现有业务读取接口或下载有权查看的资产
- **THEN** 系统正常返回共享工作区数据

#### Scenario: viewer 尝试写操作
- **WHEN** viewer 调用任意会创建、修改、删除数据或触发任务的业务接口
- **THEN** 后端返回 `403`
- **AND** 不产生业务数据、外部模型调用或后台任务

#### Scenario: creator 尝试管理用户
- **WHEN** creator 访问用户管理 API 或页面
- **THEN** 后端返回 `403`
- **AND** 前端不展示用户管理入口

#### Scenario: 未登录访问
- **WHEN** 未登录访问者请求业务页面或业务 API
- **THEN** 页面跳转登录页
- **AND** API 返回 `401`

### Requirement: 管理员用户管理

系统 SHALL 允许 admin 列出用户、创建用户、修改角色、启用或禁用账号，并重置临时密码。本期不支持删除用户。

#### Scenario: admin 创建并分配角色
- **WHEN** admin 创建用户并选择 `creator` 或 `viewer`
- **THEN** 新用户获得所选角色
- **AND** 用户列表显示角色、状态、强制改密状态和最近登录时间

#### Scenario: 修改角色立即生效
- **WHEN** admin 修改其他用户的角色
- **THEN** 系统保存新角色并撤销该用户全部会话
- **AND** 用户下次请求需要重新登录并按新角色授权

#### Scenario: 禁用账号立即生效
- **WHEN** admin 禁用一个启用用户
- **THEN** 系统撤销该用户全部会话
- **AND** 该用户不能继续访问或重新登录

#### Scenario: 重置临时密码
- **WHEN** admin 为用户设置新的合法临时密码
- **THEN** 系统替换密码哈希、标记必须修改密码并撤销该用户全部会话

#### Scenario: 保护最后一个管理员
- **WHEN** 某操作会禁用最后一个启用的 admin 或把其角色改为非 admin
- **THEN** 系统返回冲突错误
- **AND** 至少保留一个启用的 admin

### Requirement: 前端认证体验

系统 SHALL 提供与现有深色视觉一致的登录、首次初始化、强制改密和用户管理页面。认证页面不展示工作区导航；登录后的导航展示当前用户、角色、退出入口，且仅 admin 可见用户管理入口。

#### Scenario: 系统尚未初始化
- **WHEN** 浏览器打开应用且初始化状态为未完成
- **THEN** 跳转 `/setup`
- **AND** 提供首个管理员用户名、显示名称、密码和确认密码表单

#### Scenario: 已初始化但未登录
- **WHEN** 浏览器打开任意受保护页面且无有效会话
- **THEN** 跳转 `/login`
- **AND** 登录成功后返回原目标页面或默认工作区

#### Scenario: viewer 使用工作区
- **WHEN** viewer 浏览项目、资产、工具或 AIGC 页面
- **THEN** 页面保留查看、预览和下载能力
- **AND** 创建、编辑、删除、执行、重试和取消入口不可操作

#### Scenario: 会话在使用中失效
- **WHEN** API 返回 `401`
- **THEN** 前端清理认证状态并跳转登录页
- **AND** 不无限重试原请求

#### Scenario: 权限不足
- **WHEN** API 返回 `403`
- **THEN** 前端保留当前登录状态
- **AND** 展示可理解的权限不足提示

### Requirement: 审计与敏感信息保护

系统 SHALL 将初始化、登录成功/失败/限流、退出、密码修改、用户创建、角色修改、启用/禁用和密码重置写入结构化审计日志，并沿用 TLS 日志链路。日志不得包含明文密码、密码哈希、Cookie、原始会话令牌或完整认证请求体。

#### Scenario: 记录管理操作
- **WHEN** admin 修改用户角色、状态或密码
- **THEN** 审计事件记录操作者 ID、目标用户 ID、操作类型、结果、请求 ID 和时间
- **AND** 不记录任何凭据

#### Scenario: TLS 不可用
- **WHEN** TLS 日志发送暂时失败
- **THEN** 认证和授权结果仍按安全策略完成
- **AND** 沿用现有有界队列与重试机制，不向 Stdout 输出敏感内容

## MODIFIED Requirements

### Requirement: 现有 API 访问边界

所有挂载于 `/api` 的现有业务 API SHALL 默认要求有效会话。`GET`、`HEAD` 类型的业务读取允许 `admin`、`creator`、`viewer`；所有会改变状态、触发任务或调用外部生成服务的业务请求仅允许 `admin`、`creator`。认证路由按各自场景匿名或登录访问，`OPTIONS` 预检与 `/health` 保持匿名。

### Requirement: 应用导航

现有顶部导航 SHALL 在已登录且无需强制改密时显示。导航增加当前用户菜单与退出操作，仅对 admin 展示“用户管理”；沉浸式 AIGC 编辑器仍须提供可访问的账号/退出入口，不能因隐藏标准导航而造成无法退出。

### Requirement: 数据库初始化

现有 `Base.metadata.create_all()` 与加法迁移流程 SHALL 创建用户、会话和登录限流所需表及索引，不修改或清空现有项目、资产、任务、Pipeline 和运行数据。升级过程中不得自动创建带默认密码的管理员。

## REMOVED Requirements

### Requirement: 无身份访问

**Reason**: 无身份访问无法区分创作与只读权限，也无法追踪管理员操作。

**Migration**: 部署新版本后保留全部业务数据，系统进入首次管理员初始化状态；管理员完成 `/setup` 后创建其他用户并分配角色。现有匿名书签访问将被引导至登录页。
