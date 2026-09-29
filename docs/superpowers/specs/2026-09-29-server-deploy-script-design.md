# 服务端一键部署脚本设计

## 目标

在运维人员手动完成 `git pull` 或检出目标版本后，通过仓库内脚本完成：

1. 安装后端和前端依赖。
2. 执行后端编译检查并构建前端。
3. 仅在所有安装和构建步骤成功后重启 systemd 服务。
4. 检查后端和前端本机地址，确认新版本可用。
5. 失败时输出服务状态和近期日志，并以非零状态退出。

脚本不拉取代码、不修改 Git 工作区、不执行数据库命令，也不自动回滚。

## 文件边界

- `scripts/deploy_server.sh`：生产服务器部署入口。
- `scripts/tests/test_deploy_server.sh`：使用临时目录和命令桩验证流程，不安装真实依赖、不操作真实服务。
- `docs/deployment/application-server-first-deployment.md`：记录日常更新步骤、参数和失败处理方式。

## 执行流程

脚本从自身路径推导仓库根目录，也允许通过 `APP_ROOT` 显式覆盖。启动后按以下顺序执行：

1. 使用 `flock` 获取非阻塞部署锁，避免并发部署。
2. 校验 `.env`、虚拟环境、依赖清单、前端清单和必要命令。
3. 校验 Node.js 主版本不低于 22。
4. 使用 `.venv/bin/python -m pip install -r requirements.txt` 安装后端依赖。
5. 使用 `.venv/bin/python -m compileall -q backend` 检查后端语法。
6. 在 `frontend` 中运行 `npm ci`。
7. 显式移除 `NEXT_PUBLIC_BACKEND_BASE_URL` 后运行 `npm run build`，保证同域部署使用 `/api/...`。
8. 通过 systemd 同时重启后端和前端服务。
9. 确认两个服务处于 active 状态。
10. 轮询后端 `/health` 和前端根路径，直到成功或超时。

依赖安装或构建失败时，运行中的旧服务保持不变。服务重启开始后发生错误时，脚本输出两个服务的 `systemctl status` 和近期 `journalctl` 日志。

## 配置

以下环境变量允许适配不同服务器：

| 变量 | 默认值 |
| --- | --- |
| `APP_ROOT` | 脚本父目录的父目录 |
| `BACKEND_SERVICE` | `ad-creativity-backend` |
| `FRONTEND_SERVICE` | `ad-creativity-frontend` |
| `BACKEND_HEALTH_URL` | `http://127.0.0.1:8000/health` |
| `FRONTEND_HEALTH_URL` | `http://127.0.0.1:3000/` |
| `HEALTH_CHECK_ATTEMPTS` | `30` |
| `HEALTH_CHECK_INTERVAL_SECONDS` | `2` |
| `DEPLOY_LOCK_FILE` | `/tmp/ad-creativity-deploy.lock` |

脚本由具备免交互 sudo 权限的部署用户运行；root 用户直接调用 `systemctl`。

## 失败和恢复

- 使用 Bash 严格模式，任何未处理错误都会终止部署。
- 失败退出码保持非零，便于 SSH、CI 或发布平台识别。
- 进入服务重启阶段后才输出 systemd 诊断，避免构建失败时产生无关日志。
- 不自动执行 `git reset` 或切换版本。后端启动会执行 `init_database()`，自动回滚代码可能与已变更的数据库结构不兼容。
- 健康检查失败后服务保持当前状态，由运维人员根据日志决定修复或手动切回已验证版本。

## 验证

测试脚本通过临时 `APP_ROOT` 和临时 `PATH` 注入 `node`、`npm`、`curl`、`sudo`、
`systemctl`、`flock` 命令桩，覆盖：

- 成功部署的命令顺序和健康检查。
- 前端构建时清除公开后端地址。
- 构建失败时不重启服务。
- 健康检查超时时输出诊断并失败。
- Node.js 版本不满足要求时在安装前终止。

最终执行 Bash 语法检查、测试脚本和 `git diff --check`。
