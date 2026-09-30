# 用户认证与角色权限任务

- [x] Task 1: 建立认证领域模型与数据库结构。
  - [x] SubTask 1.1: 在 `backend/app/schemas/auth.py` 定义 `UserRole`（`admin`、`creator`、`viewer`）、用户公开 DTO、初始化、登录、改密、创建用户、改角色、改状态和重置密码请求模型，并落实用户名与密码校验边界。
  - [x] SubTask 1.2: 在 `backend/app/db/models.py` 新增用户、会话和登录失败限流 ORM；用户名规范值唯一，会话令牌摘要唯一，并为会话过期、用户会话查询和限流窗口查询建立索引。
  - [x] SubTask 1.3: 在 `backend/app/db/session.py` 的数据库初始化/加法迁移路径中确保新表可安全创建，旧项目、资产、任务和 Pipeline 数据不发生回填、删除或所有权迁移。
  - [x] SubTask 1.4: 扩展 `backend/app/repositories/base.py`、`memory.py`、`mysql.py`，实现用户 CRUD、首个管理员原子创建、会话创建/查询/轮换/撤销、最后一个启用 admin 保护和登录失败窗口计数。
  - [x] SubTask 1.5: 在 `backend/tests/test_auth_repository.py` 对内存与 MySQL/SQLite 测试仓储执行同一组契约测试，覆盖大小写用户名唯一、并发/重复初始化、会话生命周期、角色与状态变更、最后一个 admin 保护和旧数据保留。

- [x] Task 2: 实现密码、会话和登录安全服务。
  - [x] SubTask 2.1: 在 `backend/pyproject.toml` 增加 Argon2 密码哈希依赖，在 `backend/app/services/auth.py` 封装密码哈希/校验、随机会话令牌生成、SHA-256 令牌摘要、12 小时空闲过期和 7 天绝对过期。
  - [x] SubTask 2.2: 实现统一登录失败响应和按规范化用户名加来源 IP 的持久化限流：15 分钟内 5 次失败后返回 `429`，成功后清除对应失败记录。
  - [x] SubTask 2.3: 实现登录、退出、改密、角色变更、禁用和重置密码的会话撤销/轮换规则，确保权限和账号状态在下一次请求立即生效。
  - [x] SubTask 2.4: 在 `backend/app/core/config.py` 增加站点源、Cookie Secure 策略和会话期限配置；生产环境拒绝凭据模式下的通配 CORS 配置。
  - [x] SubTask 2.5: 在 `backend/tests/test_auth_service.py` 覆盖密码不落明文、令牌只存摘要、错误信息不泄露账号状态、过期规则、限流窗口、会话撤销和密码轮换。

- [x] Task 3: 提供认证与管理员用户管理 API。
  - [x] SubTask 3.1: 新增 `backend/app/api/auth_routes.py`，提供 `GET /api/auth/setup-status`、`POST /api/auth/setup`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me` 和 `POST /api/auth/change-password`。
  - [x] SubTask 3.2: 新增 admin 用户接口：`GET/POST /api/admin/users`、`PATCH /api/admin/users/{user_id}/role`、`PATCH /api/admin/users/{user_id}/status`、`POST /api/admin/users/{user_id}/reset-password`。
  - [x] SubTask 3.3: 在 `backend/app/api/dependencies.py` 实现当前用户、要求已登录、要求可创作和要求 admin 的依赖，并统一输出 `401`、`403`、`409`、`429` 错误契约。
  - [x] SubTask 3.4: 在 `backend/app/api/router.py` 与 `backend/app/main.py` 注册认证路由、设置/清除 `ad_session` Cookie、校验状态变更请求的同源信息，并保留 `/health`、初始化状态、初始化、登录和 `OPTIONS` 的匿名访问。
  - [x] SubTask 3.5: 在 `backend/tests/test_auth_api.py` 覆盖首次初始化、初始化关闭、登录/退出、强制改密、用户管理、Cookie 属性、来源校验和 admin-only 边界。

- [x] Task 4: 将现有业务 API 纳入统一权限控制。
  - [x] SubTask 4.1: 盘点 `backend/app/api/routes.py` 与 `backend/app/api/aigc_routes.py` 的全部路由，建立读取、下载、状态变更和外部任务触发分类清单，避免遗漏新旧接口。
  - [x] SubTask 4.2: 在 `/api` 业务路由层统一要求有效会话；读取与下载允许三种角色，所有 POST/PUT/PATCH/DELETE 业务能力及生成、重试、取消操作仅允许 `admin`、`creator`。
  - [x] SubTask 4.3: 强制改密用户只能调用 `me`、改密和退出接口；viewer 的被拒绝请求必须在仓储写入、对象存储操作、模型调用或后台任务创建之前终止。
  - [x] SubTask 4.4: 更新现有后端测试夹具，为原有业务测试注入明确的 admin/creator 会话；新增 `backend/tests/test_role_permissions.py` 参数化验证三角色对代表性读取、下载、创建、编辑、删除、生成、重试和取消接口的权限矩阵。
  - [x] SubTask 4.5: 添加路由覆盖测试，枚举 FastAPI 路由并断言除明确匿名白名单外均具备认证与角色策略，防止后续新增未保护接口。

- [x] Task 5: 增加认证审计日志与敏感信息防护。
  - [x] SubTask 5.1: 复用 `backend/app/core/logging.py` 和 TLS sink，为初始化、登录、限流、退出、改密、用户创建、角色变更、启停账号和密码重置写入结构化安全事件。
  - [x] SubTask 5.2: 审计事件只记录操作者 ID、目标用户 ID、脱敏用户名标识、操作、结果、来源摘要和请求 ID；禁止记录密码、密码哈希、Cookie、会话原文及完整认证请求体。
  - [x] SubTask 5.3: 在 `backend/tests/test_auth_logging.py` 验证成功和失败事件字段，并用敏感值哨兵断言 Stdout、普通结构化日志和 TLS 载荷均不包含凭据。

- [x] Task 6: 建立前端认证状态、路由守卫和 API 契约。
  - [x] SubTask 6.1: 在 `frontend/lib/api-types.ts` 增加认证、用户和角色类型，在 `frontend/lib/api-client.ts` 增加初始化、登录、退出、me、改密及 admin 用户管理方法，并对同源请求携带 Cookie。
  - [x] SubTask 6.2: 新增 `frontend/lib/auth/permissions.ts`，集中定义 `canView`、`canCreate`、`canManageUsers` 等权限判断；禁止各页面自行拼接角色字符串。
  - [x] SubTask 6.3: 新增认证 Provider/Guard，在渲染受保护内容前查询初始化状态和当前用户；未初始化跳转 `/setup`，未登录跳转 `/login`，强制改密跳转 `/change-password`，并保留合法的原目标路径。
  - [x] SubTask 6.4: 统一处理 API `401` 与 `403`：`401` 清理认证状态并跳转登录且不重试，`403` 保持会话并显示权限不足提示。
  - [x] SubTask 6.5: 在 `frontend/tests/auth-state.test.tsx` 与 `frontend/tests/api-client-auth.test.ts` 覆盖路由判定、重定向、Cookie 请求、目标路径恢复、401/403 分流和无无限重试。

- [x] Task 7: 实现初始化、登录和强制改密页面。
  - [x] SubTask 7.1: 创建 `frontend/app/setup/page.tsx` 与表单组件，只在未初始化时展示首个管理员用户名、显示名称、密码和确认密码字段，成功后进入工作区。
  - [x] SubTask 7.2: 创建 `frontend/app/login/page.tsx` 与登录表单，使用统一失败信息，不展示账号存在性，并在成功后按强制改密状态跳转。
  - [x] SubTask 7.3: 创建 `frontend/app/change-password/page.tsx`，要求当前密码、新密码和确认密码，成功后使用轮换会话进入原目标页或默认工作区。
  - [x] SubTask 7.4: 认证页面沿用现有深色、高对比视觉语言，不渲染工作区导航；表单具备加载、禁用、校验、错误和键盘提交状态，并在手机、平板和桌面宽度下无溢出。
  - [x] SubTask 7.5: 新增前端组件测试，覆盖初始化关闭、表单校验、提交中防重复、通用登录错误、强制改密和成功跳转。

- [x] Task 8: 实现 admin 用户管理界面与账号入口。
  - [x] SubTask 8.1: 创建 `frontend/app/workspace/admin/users/page.tsx`，以紧凑列表展示用户名、显示名称、角色、启用状态、强制改密状态、最近登录和创建时间。
  - [x] SubTask 8.2: 使用 Dialog 实现创建用户、修改角色、启停账号和重置临时密码；提交期间防重复，冲突和最后 admin 保护错误可读。
  - [x] SubTask 8.3: 更新 `frontend/components/layout/app-shell.tsx`，展示当前用户、角色、退出操作，并仅对 admin 展示“用户管理”入口；移动导航和沉浸式 AIGC 编辑器均保留可访问的账号/退出入口。
  - [x] SubTask 8.4: 非 admin 直接访问用户管理页时显示无权限或跳回工作区，且不能触发用户管理 API。
  - [x] SubTask 8.5: 新增前端测试覆盖列表、创建、分配角色、启停、重置密码、最后 admin 错误、角色入口可见性和退出。

- [x] Task 9: 将 viewer 模式落实到全部前端业务入口。
  - [x] SubTask 9.1: 盘点项目、资产、工具、图片画布、AIGC 工作台及沉浸式编辑器中的创建、编辑、删除、上传、执行、重试和取消入口，并统一使用权限工具控制。
  - [x] SubTask 9.2: viewer 保留导航、列表、详情、预览、历史结果和下载；隐藏或禁用所有写操作，并提供简洁的只读状态反馈。
  - [x] SubTask 9.3: 确保 creator 与 admin 的现有创作流程行为不变，权限 UI 不改变媒体 `object-contain`、画布交互、原生视频控件和移动布局约束。
  - [x] SubTask 9.4: 新增代表性前端测试，覆盖 viewer 在项目、资产、工具和 AIGC 页面可读不可写，以及 creator/admin 仍可发起操作。

- [x] Task 10: 完成端到端验证与部署说明校验。
  - [x] SubTask 10.1: 使用 Playwright 在桌面、平板、手机视口验证首次初始化、admin 登录、创建 creator/viewer、首次改密、角色切换、账号禁用、viewer 只读和退出流程。
  - [x] SubTask 10.2: 验证浏览器 Cookie 属性、未登录 `401`、viewer `403`、角色/禁用即时失效、最后一个 admin 保护和状态变更同源校验。
  - [x] SubTask 10.3: 运行后端认证专项与完整测试、Ruff 致命错误检查、前端 Vitest、ESLint、TypeScript、生产构建及 `git diff --check`。
  - [x] SubTask 10.4: 核对 `scripts/deploy_server.sh` 在数据库建表后可正常启动服务，并明确升级后首次打开 `/setup` 完成 admin 初始化；不得在脚本、环境样例或日志中写入默认管理员密码。

# Task Dependencies

- Task 2 depends on Task 1.
- Task 3 depends on Task 1 and Task 2.
- Task 4 and Task 5 depend on Task 3，可并行实施。
- Task 6 depends on Task 3 的 API 契约。
- Task 7 depends on Task 6.
- Task 8 depends on Task 6，可与 Task 7 并行实施。
- Task 9 depends on Task 6，可与 Task 7、Task 8 并行实施。
- Task 10 depends on Task 4、Task 5、Task 7、Task 8、Task 9.
