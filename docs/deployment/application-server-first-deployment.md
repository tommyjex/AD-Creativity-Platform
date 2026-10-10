# AD Creativity 系统架构与部署手册

## 1. 文档目标

本文面向负责开发、测试、发布和运维的团队成员，用于：

- 快速理解 AD Creativity 的运行架构、技术栈和数据流。
- 准备应用服务器、云服务、网络和密钥等部署依赖。
- 将指定版本首次部署到一台 Linux 应用服务器。
- 完成发布验收、日常更新、故障排查和回滚。

本方案假设：

- MySQL 8 已由云平台托管，数据库实例、业务库和应用账号已经创建。
- 应用服务器可以通过私网连接云 MySQL。
- TOS、Ark、MediaKit 和 TLS 均使用云服务，不在应用服务器部署。
- 前端和后端使用同一个公网域名，由 Nginx 统一提供 HTTPS。
- 首次部署使用单台应用服务器和单个 FastAPI 进程。

本文不包含 MySQL 实例创建、云服务开通和 CI/CD 平台搭建。业务表由后端
`init_database()` 创建或增量更新，生产执行前必须遵循本文的数据库发布门禁。

> 当前仓库不提供 Dockerfile 或 Docker Compose。生产部署方式是
> `systemd + Nginx`，应用依赖直接安装在 Linux 主机。
>
> 文档最后按仓库代码与部署脚本校验于 2026-10-10。

## 2. 系统架构与技术栈

### 2.1 技术栈

| 层级 | 技术 | 当前约束与职责 |
| --- | --- | --- |
| Web 前端 | React 19、Next.js 16、TypeScript 5、Tailwind CSS 3 | 页面渲染、同源 API 访问、AIGC 画布和媒体工作台 |
| 前端状态与交互 | TanStack Query、Zustand、XYFlow、Radix UI | 服务端状态、客户端状态、节点画布和基础交互组件 |
| 后端 API | Python 3.11+、FastAPI、Uvicorn、Pydantic 2 | REST API、认证、工作流编排和服务集成 |
| 数据访问 | SQLAlchemy 2、PyMySQL、MySQL 8 | 用户、项目、资产、任务、Pipeline、Worker 租约和运行记录 |
| 媒体处理 | FFmpeg、FFprobe、Pillow、pillow-heif | 视频规范化、媒体探测、图片处理、字幕和成片合成 |
| AI 与媒体云服务 | 火山方舟 Ark、MediaKit | 文本/图片/视频生成、字幕提取、视频增强、人脸模糊和多轨处理 |
| 对象存储 | 火山引擎 TOS | 上传素材、生成产物和中间媒体文件 |
| 可观测性 | JSON 标准输出、systemd journal、火山引擎 TLS | 请求、认证、AIGC 任务与异常日志；敏感模型原文只允许进入 TLS |
| 接入与进程管理 | Nginx、systemd | HTTPS、反向代理、上传限制、长连接超时和进程守护 |

版本的最终事实来源分别是：

- Python：`backend/pyproject.toml` 和根目录 `requirements.txt`。
- Node.js：`scripts/deploy_server.sh`，当前要求 22 或更高版本。
- 前端依赖：`frontend/package.json` 和 `frontend/package-lock.json`。
- 系统配置：`.env.example` 和 `backend/app/core/config.py`。

### 2.2 运行拓扑

```text
用户浏览器
    |
    | HTTPS :443
    v
Nginx
    |-- /            -> Next.js  127.0.0.1:3000
    |-- /api/*       -> FastAPI  127.0.0.1:8000
    `-- /health      -> FastAPI  127.0.0.1:8000
                              |
                              | 私网
                              +-> 云 MySQL 8
                              +-> TOS
                              +-> Ark / MediaKit
                              `-> TLS
```

组件职责：

| 组件 | 部署位置 | 端口/协议 | 说明 |
| --- | --- | --- | --- |
| Nginx | 应用服务器 | 公网 `80/443` | 唯一公网入口；将页面请求转发到 Next.js，将 `/api/*` 和 `/health` 转发到 FastAPI |
| Next.js | 应用服务器 | `127.0.0.1:3000` | 生产前端；服务端通过 `BACKEND_INTERNAL_BASE_URL` 访问 FastAPI |
| FastAPI | 应用服务器 | `127.0.0.1:8000` | API、认证、数据库访问、云服务调用和进程内 AIGC Worker |
| MySQL 8 | 云数据库 | 私网 `3306` | 持久化业务数据、任务状态和 AIGC Worker 租约 |
| TOS | 火山引擎 | HTTPS `443` | 持久化媒体资产；数据库只保存资产元数据和对象引用 |
| Ark / MediaKit | 火山引擎 | HTTPS `443` | 模型推理和异步媒体处理 |
| TLS | 火山引擎 | HTTPS `443` | 集中式结构化操作日志 |

### 2.3 关键请求与任务流

同步页面/API 请求：

```text
浏览器 -> Nginx -> Next.js 页面
浏览器 -> Nginx /api/* -> FastAPI -> MySQL
```

上传与生成任务：

```text
浏览器上传 -> FastAPI -> FFprobe/FFmpeg 校验或规范化 -> TOS
任务提交 -> FastAPI -> MySQL 任务队列
进程内 AIGC Worker -> Ark/MediaKit -> TOS -> MySQL 状态更新
浏览器轮询 API <- FastAPI <- MySQL
```

FastAPI 启动时会执行 `init_database()`，随后启动进程内 AIGC Worker。Worker
通过 MySQL 中的全局租约保证同一时刻只有一个调度实例工作。首期部署必须使用
单个 Uvicorn worker；扩容前需要验证多实例租约接管、运行中任务恢复和滚动发布。
重启后端会中断当前进程内正在执行的任务，发布前应检查运行中任务并安排维护窗口。

### 2.4 网络与安全边界

服务器安全组只开放：

- `22/tcp`：SSH，建议只允许办公网络或堡垒机。
- `80/tcp`：HTTP，仅用于跳转 HTTPS 和证书签发。
- `443/tcp`：HTTPS。

不要向公网开放 `3000`、`8000` 或 MySQL `3306`。

应用服务器还必须允许以下出站访问：

- 云 MySQL 私网地址的 `3306/tcp`。
- TOS、Ark、MediaKit 和 TLS 域名的 `443/tcp`。
- 软件源、npm 源和 Python 包源的 `443/tcp`，仅在服务器执行依赖安装时需要。
- DNS 解析和系统时间同步；签名 URL 与云 API 鉴权依赖准确时间。

若生产网络限制出站域名，应在部署前由网络管理员加入白名单。不要在 Nginx、
前端或日志中暴露数据库密码、会话 Cookie、Ark API Key 或云服务 AK/SK。

## 3. 部署前检查

### 3.1 部署输入

开始操作前，发布负责人应收齐以下信息：

| 输入 | 提供方 | 验证方式 |
| --- | --- | --- |
| 固定的 Git tag 或 commit SHA | 开发/发布负责人 | `git rev-parse HEAD` 与发布记录一致 |
| 应用域名和 HTTPS 证书 | 域名/基础设施负责人 | DNS 已生效，证书覆盖目标域名 |
| MySQL 私网地址、库名和应用账号 | 数据库负责人 | 从应用服务器执行 `SELECT 1` |
| TOS bucket、endpoint、region 和凭据 | 云资源负责人 | 上传并读取一个测试对象 |
| Ark API Key 和模型访问权限 | AI 平台负责人 | 执行最小文本生成请求 |
| MediaKit 凭据 | 媒体能力负责人 | 仅在启用字幕、增强等能力时需要 |
| TLS Project、Topic 和写入凭据 | 可观测性负责人 | 部署后可按 `request_id` 查询日志 |

推荐按以下顺序完成首次部署：

1. 准备云资源、域名、证书和网络白名单。
2. 安装系统依赖，创建运行用户并检出固定代码版本。
3. 创建 Python 虚拟环境并安装前后端依赖。
4. 配置 `.env`，验证数据库和外部服务连通性。
5. 创建数据库快照，在预发布环境验证 `init_database()`。
6. 执行测试和生产构建。
7. 配置并启动 systemd 服务。
8. 配置 Nginx 和 HTTPS。
9. 初始化管理员，完成端到端验收并记录发布版本。

### 3.2 服务器建议

首次部署建议：

- 操作系统：推荐 Ubuntu 24.04 LTS。Ubuntu 22.04 LTS 仅在单独安装
  Python 3.11 或更高版本后使用，其系统默认 Python 3.10 不满足项目要求。
- CPU：至少 4 核，视频处理较多时建议 8 核。
- 内存：至少 8 GB，视频处理较多时建议 16 GB。
- 系统盘：至少 50 GB，并监控 `/tmp` 和日志占用。
- 网络：能够访问云 MySQL、TOS、Ark、MediaKit 和 TLS。

视频上传、转码和多轨任务会使用临时磁盘。磁盘告警不能只监控应用目录，还要
监控 `/tmp`、systemd journal 和 Nginx 日志。生产环境应为日志配置轮转和保留期。

### 3.3 云 MySQL

确认以下条件：

- 使用私网连接地址。
- MySQL 安全组或白名单允许应用服务器私网 IP。
- 数据库字符集为 `utf8mb4`。
- 应用账号可以读写业务表。
- 数据库表结构与待部署代码版本一致。

后端启动时会执行 `init_database()`，检查表结构并执行代码内置的增量迁移。
即使数据库已经建好，也应确保以下条件之一成立：

1. 应用账号具备必要的 DDL 权限；或
2. 已提前确认没有待执行的结构变更。

如果生产账号不允许 DDL，建议使用单独的迁移账号在发布窗口执行结构升级。

### 3.4 域名和证书

准备一个域名，例如：

```text
ad.example.com
```

将域名 A 记录指向应用服务器公网 IP。建议前后端使用同一域名，避免额外的跨域配置。

### 3.5 公开部署安全要求

正式开放公网前必须处理：

- 推荐使用正式 HTTPS 域名配置 `SITE_ORIGIN` 和 `CORS_ORIGINS`；生产环境默认拒绝通配来源，
  仅在明确接受风险时通过双配置显式启用。
- 普通生产配置必须设置 `SITE_ORIGIN`；仅当 `CORS_ORIGINS` 包含独立的
  `*` 条目且 `ALLOW_INSECURE_CORS=true` 时可以缺失、为空或仅包含空白。
  若该模式下设置非空值，则必须是结构合法的 HTTP(S) Origin。
- 启用 `AUTH_COOKIE_SECURE`，确保认证 Cookie 只通过 HTTPS 发送。
- 首次启动后通过 `/setup` 创建首个管理员；仓库、部署脚本和环境样例不得包含默认管理员密码。
- `.env`、数据库密码、TOS 密钥和 Ark API Key 不得提交到 Git。

## 4. 安装系统依赖

使用具备 sudo 权限的账号执行：

```bash
sudo apt update
sudo apt install -y \
  ca-certificates \
  curl \
  git \
  nginx \
  python3 \
  python3-venv \
  python3-pip \
  ffmpeg \
  mysql-client \
  util-linux
```

确认 `python3` 为 3.11 或更高版本。Ubuntu 22.04 需从公司批准的软件源安装
Python 3.11+，并在后续创建虚拟环境时将 `python3` 替换为对应命令，例如
`python3.11`。

从公司批准的软件源或 NodeSource 安装 Node.js 22 LTS 或更高版本，然后确认：

```bash
python3 --version
node --version
npm --version
ffmpeg -version
ffprobe -version
nginx -v
```

`scripts/deploy_server.sh` 还依赖 `flock`、`curl`、`systemctl` 和
`journalctl`。Ubuntu 中 `flock` 由 `util-linux` 提供。`ffprobe` 通常随
`ffmpeg` 包一起安装；媒体上传校验缺少它时会直接失败。

## 5. 创建运行用户和目录

应用不要使用 root 运行：

```bash
sudo useradd \
  --system \
  --create-home \
  --shell /bin/bash \
  adcreative

sudo mkdir -p /opt/ad-creativity
sudo chown adcreative:adcreative /opt/ad-creativity
```

## 6. 获取代码

```bash
sudo -u adcreative git clone \
  <REPOSITORY_URL> \
  /opt/ad-creativity/app

cd /opt/ad-creativity/app
sudo -u adcreative git fetch --tags
sudo -u adcreative git checkout <RELEASE_TAG_OR_COMMIT>
sudo -u adcreative git rev-parse HEAD
```

`<RELEASE_TAG_OR_COMMIT>` 是必填发布参数。生产环境不得直接部署未固定的默认分支。
私有仓库需提前为 `adcreative` 用户配置只读 Deploy Key，或由发布系统下发经过校验的代码包。

## 7. 安装应用依赖

### 7.1 后端

```bash
cd /opt/ad-creativity/app

sudo -u adcreative python3 -m venv .venv
sudo -u adcreative .venv/bin/python -m pip install --upgrade pip
sudo -u adcreative .venv/bin/pip install -r requirements.txt
```

### 7.2 前端

```bash
cd /opt/ad-creativity/app/frontend
sudo -u adcreative npm ci
```

必须使用 `npm ci`，以 `package-lock.json` 锁定的版本安装依赖。

## 8. 配置环境变量

创建 `/opt/ad-creativity/app/.env`：

```dotenv
APP_ENV=production

# 认证与同源策略
CORS_ORIGINS=https://ad.example.com
ALLOW_INSECURE_CORS=false
ALLOW_INSECURE_AUTH_COOKIE=false
SITE_ORIGIN=https://ad.example.com
AUTH_COOKIE_SECURE=true
AUTH_SESSION_IDLE_SECONDS=43200
AUTH_SESSION_ABSOLUTE_SECONDS=604800
AUTH_LOGIN_WINDOW_SECONDS=900
AUTH_LOGIN_MAX_FAILURES=5

# 已有云 MySQL
DB_HOST=<MYSQL_PRIVATE_HOST>
DB_PORT=3306
DB_USER=<MYSQL_APP_USER>
DB_PASSWORD=<MYSQL_PASSWORD>
DB_NAME=<MYSQL_DATABASE>

# TOS
TOS_ACCESS_KEY=<TOS_ACCESS_KEY>
TOS_SECRET_KEY=<TOS_SECRET_KEY>
TOS_ENDPOINT=<TOS_ENDPOINT>
TOS_REGION=<TOS_REGION>
TOS_BUCKET=<TOS_BUCKET>
TOS_PUBLIC_ENDPOINT=<OPTIONAL_PUBLIC_ENDPOINT>

# Ark
ARK_API_KEY=<ARK_API_KEY>
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# MediaKit，使用相关能力时配置
# MEDIAKIT_API_KEY=<MEDIAKIT_API_KEY>
# MEDIAKIT_BASE_URL=<MEDIAKIT_BASE_URL>

# FFmpeg
COMPOSER_FFMPEG_PATH=/usr/bin/ffmpeg

# TLS 结构化日志
TLS_ENABLED=true
TLS_ENDPOINT=https://tls-cn-beijing.volces.com
TLS_PROJECT_ID=<TLS_PROJECT_ID>
TLS_TOPIC_ID=<TLS_TOPIC_ID>
TLS_ACCESS_KEY_ID=<TLS_ACCESS_KEY_ID>
TLS_SECRET_ACCESS_KEY=<TLS_SECRET_ACCESS_KEY>
```

配置分组说明：

| 分组 | 是否必需 | 说明 |
| --- | --- | --- |
| `APP_ENV`、`CORS_ORIGINS`、`SITE_ORIGIN`、`AUTH_COOKIE_SECURE` | 是 | 生产安全门禁；推荐同域 HTTPS |
| `DB_*` | 是 | FastAPI 启动即连接 MySQL 并执行表结构初始化 |
| `TOS_*` | 是 | 素材上传和生成产物持久化 |
| `ARK_API_KEY` | 是 | Ark 模型调用；模型 ID 为空时使用代码默认值 |
| `MEDIAKIT_*` | 按功能 | 字幕、视频增强、人脸模糊和多轨能力需要 |
| `COMPOSER_FFMPEG_PATH` | 是 | 生产建议固定为 `/usr/bin/ffmpeg`；FFprobe 必须位于同目录 |
| `TLS_*` | 生产推荐 | 集中日志；启用后凭据、Project 和 Topic 必须有效 |
| `AIGC_*_CONCURRENCY`、各类 timeout | 按需 | 默认值适合单机起步，压测后再调整 |

不要直接复制其他环境的 `.env`。至少重新核对数据库名、域名、TOS bucket、
TLS Topic 和所有密钥，避免生产服务连接测试资源或把日志写入错误主题。

生产环境默认拒绝通配 CORS。只有明确接受任意来源发起跨域请求和非安全
方法调用的风险时，才同时配置：

```dotenv
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
SITE_ORIGIN=https://ad.example.com
```

`ALLOW_INSECURE_CORS` 去除首尾空白后仅接受精确小写 `true` 或 `false`；
不要使用 `1`、`yes`、`on`、`TRUE` 等别名或大小写变体。

即使启用通配模式，正式部署仍推荐配置正式 HTTPS `SITE_ORIGIN`。只有
`CORS_ORIGINS` 包含独立的 `*` 条目且 `ALLOW_INSECURE_CORS=true` 时，
`SITE_ORIGIN` 才可以缺失、为空或仅包含空白。若在该模式下提供非空值，
部署预检仍要求它是结构合法的 HTTP(S) Origin，但不强制使用 HTTPS：scheme
不区分大小写并会归一化，host 必须存在，端口必须合法，不允许 userinfo、
query、fragment 或内部空白，path 仅允许为空或 `/`。其他生产配置中，
该变量继续必填，归一化后必须使用 HTTPS，并包含在归一化后的
`CORS_ORIGINS` 中。

`CORS_ORIGINS` 按逗号拆分并去除每个条目的首尾空白。只有独立条目精确为
`*` 时才进入通配模式；例如 `https://ad.example.com/*` 是带 path 的非法
Origin，不会被视为 wildcard。

该模式下，服务端不会返回允许携带凭证的 CORS 授权；即使请求包含认证
Cookie，浏览器脚本也无法读取带凭证的跨域响应。需要跨域登录时，应配置
明确的 HTTPS 来源，而不是使用通配来源。

当前仅能通过 `http://<SERVER_PUBLIC_IP>/` 访问时，可临时使用以下公网 HTTP
兼容配置：

```dotenv
APP_ENV=production
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
ALLOW_INSECURE_AUTH_COOKIE=true
AUTH_COOKIE_SECURE=false
AUTH_SESSION_IDLE_SECONDS=1800
AUTH_SESSION_ABSOLUTE_SECONDS=28800
```

`ALLOW_INSECURE_CORS` 与 `ALLOW_INSECURE_AUTH_COOKIE` 是相互独立的授权
开关，前者不能替代后者。该配置会让密码、页面、API 响应和会话 Cookie
通过公网明文传输，可能被监听或篡改，只能作为获得域名和证书前的临时兼容
模式。部署预检和后端启动日志会分别输出不安全认证 Cookie 告警。

切换到 HTTPS 后，恢复安全配置：

```dotenv
ALLOW_INSECURE_AUTH_COOKIE=false
AUTH_COOKIE_SECURE=true
```

重新部署后，清除浏览器中旧的 `ad_session` Cookie，再重新登录，并确认登录
请求及紧随其后的 `GET /api/auth/me` 均返回 `200`。

未覆盖 Ark 模型时，不要写入值为空的 `ARK_TEXT_MODEL`、`ARK_IMAGE_MODEL`
或 `ARK_VIDEO_MODEL`，让应用使用代码中的默认模型。

设置权限：

```bash
sudo chown adcreative:adcreative /opt/ad-creativity/app/.env
sudo chmod 600 /opt/ad-creativity/app/.env
```

不要在 `.env` 中使用未经确认的 Shell 语法。systemd 的 `EnvironmentFile`
并不完整兼容 Bash。

保存配置后，在启动服务前执行只读校验：

```bash
sudo systemd-run \
  --wait \
  --pipe \
  --collect \
  --property=User=adcreative \
  --property=WorkingDirectory=/opt/ad-creativity/app \
  --property=EnvironmentFile=/opt/ad-creativity/app/.env \
  /opt/ad-creativity/app/.venv/bin/python -c \
  "from backend.app.core.config import get_settings; get_settings(); print('config ok')"

test -x /usr/bin/ffmpeg
test -x /usr/bin/ffprobe
```

该命令使用与正式服务相同的 systemd `EnvironmentFile` 语义，不通过 Shell
展开 `.env`。校验输出不得打印密钥值。

## 9. 验证数据库连接

仅验证连接，不创建数据库或表：

```bash
mysql \
  -h <MYSQL_PRIVATE_HOST> \
  -P 3306 \
  -u <MYSQL_APP_USER> \
  -p \
  <MYSQL_DATABASE> \
  -e "SELECT 1;"
```

如果云 MySQL 强制使用 SSL，需要先补充应用侧 SQLAlchemy/PyMySQL SSL 参数。
当前项目的数据库连接代码没有暴露 CA、证书和 SSL 模式环境变量。

### 9.1 数据库发布门禁

首次启动 FastAPI 前必须：

1. 创建云 MySQL 快照，并确认快照状态为可用。
2. 确认当前数据库结构对应 `<RELEASE_TAG_OR_COMMIT>`。
3. 在测试或预发布数据库执行过同版本的 `init_database()`。
4. 明确由应用账号还是独立迁移账号处理潜在 DDL。

当前代码会在应用启动时自动调用 `init_database()`，没有关闭自动迁移的配置项。
如果生产应用账号没有 DDL 权限且表结构并非当前版本，必须先补齐迁移流程，否则不要启动后端。
认证升级会新增 `users`、`auth_sessions` 和 `login_throttles` 表及索引，不会
修改或清空现有项目、资产、任务、Pipeline 和运行数据，也不会自动创建管理员。

## 10. 发布前检查和构建

全量测试应在 CI 或隔离的预发布环境执行，禁止让测试进程读取生产 `.env` 或连接生产数据库。

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests -q

cd frontend
npm run typecheck
npm run lint
npm test
```

生产服务器只执行不访问外部服务的安装和语法检查：

```bash
cd /opt/ad-creativity/app
sudo -u adcreative .venv/bin/python -m compileall -q backend
```

### 10.1 构建前端

同域部署时不要设置 `NEXT_PUBLIC_BACKEND_BASE_URL`。浏览器会使用 `/api/...`
同源请求，由 Nginx 转发至 FastAPI；Next.js 服务端默认通过
`http://localhost:8000` 直连 FastAPI：

```bash
cd /opt/ad-creativity/app/frontend
sudo -u adcreative npm run build
```

只有本地前后端分别使用 3000 和 8000 端口，或正式环境明确采用前后端分域时，
才设置 `NEXT_PUBLIC_BACKEND_BASE_URL`。该变量会在构建时写入前端产物，地址末尾
不要添加 `/api`，修改后必须重新构建。

Next.js 服务端连接 FastAPI 的地址可通过 `BACKEND_INTERNAL_BASE_URL` 覆盖。
同机部署通常无需设置；若 FastAPI 不监听默认的 `localhost:8000`，应在前端
systemd 服务中设置该变量。

## 11. 配置 systemd

### 11.1 FastAPI 后端

创建 `/etc/systemd/system/ad-creativity-backend.service`：

```ini
[Unit]
Description=AD Creativity FastAPI Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=adcreative
Group=adcreative
WorkingDirectory=/opt/ad-creativity/app
EnvironmentFile=/opt/ad-creativity/app/.env
ExecStart=/opt/ad-creativity/app/.venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=5
TimeoutStartSec=120
TimeoutStopSec=120
KillSignal=SIGINT
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

首次部署保持 `--workers 1`。后端包含进程内 AIGC worker 和后台任务，扩展进程数前应完成
并发调度、租约恢复和滚动发布验证。

### 11.2 Next.js 前端

创建 `/etc/systemd/system/ad-creativity-frontend.service`：

```ini
[Unit]
Description=AD Creativity Next.js Frontend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=adcreative
Group=adcreative
WorkingDirectory=/opt/ad-creativity/app/frontend
Environment=NODE_ENV=production
# Optional; defaults to http://localhost:8000
Environment=BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8000
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5
TimeoutStartSec=120
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

加载配置：

```bash
sudo systemctl daemon-reload
sudo systemctl enable ad-creativity-backend ad-creativity-frontend
sudo systemctl start ad-creativity-backend ad-creativity-frontend
```

查看状态：

```bash
sudo systemctl status ad-creativity-backend --no-pager
sudo systemctl status ad-creativity-frontend --no-pager
```

## 12. 配置 Nginx

创建 `/etc/nginx/sites-available/ad-creativity`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name ad.example.com;

    client_max_body_size 2g;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;

        proxy_connect_timeout 30s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location = /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用站点并检查配置：

```bash
sudo ln -s \
  /etc/nginx/sites-available/ad-creativity \
  /etc/nginx/sites-enabled/ad-creativity

sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 13. 配置 HTTPS

可以使用云负载均衡证书，也可以在服务器安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ad.example.com
sudo certbot renew --dry-run
```

确认 HTTP 自动跳转 HTTPS。

若由云负载均衡终止 TLS，应只允许负载均衡安全组访问应用服务器，并明确
“负载均衡 HTTPS -> Nginx HTTP”回源方式；不要同时让公网直接访问 Nginx。

## 14. 首次启动验收

### 14.1 进程和端口

```bash
sudo systemctl is-active ad-creativity-backend
sudo systemctl is-active ad-creativity-frontend
sudo systemctl is-active nginx

sudo ss -lntp | grep -E ':(3000|8000|80|443)\b'
```

`3000` 和 `8000` 应只监听 `127.0.0.1`。

### 14.2 健康检查

```bash
curl --fail http://127.0.0.1:8000/health
curl --fail https://ad.example.com/health
```

注意：`/health` 当前只代表 FastAPI 进程可用，不验证 MySQL、TOS 或 Ark。
预期响应包含 `"status":"ok"`。

### 14.3 首个管理员初始化

首次部署认证版本或升级后尚无用户时，在浏览器打开：

```text
https://ad.example.com/setup
```

页面应显示首次初始化表单。由管理员现场设置用户名、显示名称和密码；密码不得
写入部署脚本、环境文件、命令历史或日志。初始化成功后该入口永久关闭，并进入
共享工作区。

### 14.4 数据库链路

登录后在浏览器访问项目列表，并在开发者工具 Network 面板确认
`GET /api/projects` 返回 `200`。未登录请求应返回 `401`，viewer 的写请求应
返回 `403`。

### 14.5 浏览器验收

至少检查：

1. 未初始化系统跳转 `/setup`，初始化后该入口关闭。
2. 未登录访问工作区跳转 `/login`，登录后返回原目标页。
3. 首页可以打开，静态资源没有 404。
4. 项目列表能够读取，创建或打开项目正常。
5. 上传图片后能够预览。
6. Ark 文本或图片生成能够完成。
7. 视频生成和 FFmpeg 相关流程无超时。
8. 浏览器控制台没有 CORS、Mixed Content 或 5xx 错误。
9. TLS 中能够查询到认证审计和核心操作结构化日志。

## 15. 日志与排障

查看后端日志：

```bash
sudo journalctl \
  -u ad-creativity-backend \
  -n 200 \
  --no-pager
```

持续查看：

```bash
sudo journalctl -u ad-creativity-backend -f
sudo journalctl -u ad-creativity-frontend -f
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

常见问题：

| 现象 | 优先检查 |
| --- | --- |
| 后端启动失败 | `.env`、MySQL 私网连通性、表结构版本 |
| 浏览器请求 localhost:8000 | 构建环境错误设置了 `NEXT_PUBLIC_BACKEND_BASE_URL`，同域部署应移除后重新构建 |
| 首页显示“产物加载失败” | FastAPI 健康状态、前端服务的 `BACKEND_INTERNAL_BASE_URL` |
| 登录成功后又返回登录页 | 访问协议与 `AUTH_COOKIE_SECURE` 是否匹配；公网 HTTP 临时模式还需显式开启 `ALLOW_INSECURE_AUTH_COOKIE=true` |
| 上传返回 413 | Nginx `client_max_body_size` |
| 请求约 60 秒后断开 | Nginx 或上游负载均衡超时 |
| 图片或视频不可访问 | TOS 配置、对象权限、签名地址和对象 `Content-Type` |
| 视频上传或成片失败 | `/usr/bin/ffmpeg`、同目录 `ffprobe`、磁盘空间和进程日志 |
| AIGC 任务一直排队 | 后端进程状态、`pipeline_worker_lease` 租约持有者和 Worker 启动日志 |
| 发布期间任务变为 interrupted | 后端重启中断了进程内任务；确认服务稳定后重新提交 |
| 浏览器出现 CORS 错误 | 前后端域名、协议、CORS 响应头 |
| TLS 没有日志 | TLS 开关、凭据、Project 和 Topic |

后端标准输出只记录脱敏的单行 JSON。模型原文等敏感调试信息不得输出到
journal 或浏览器控制台，只能在已授权的 TLS Topic 中按最小权限和保留期查询。
排障时优先使用响应头中的 `X-Request-ID` 关联 Nginx、后端和 TLS 日志。

## 16. 日常发布流程

每次发布都必须复用“9.1 数据库发布门禁”，不能只在首次部署时执行：

1. 确认新版本是否修改 `backend/app/db/models.py` 或
   `backend/app/db/session.py` 中的迁移逻辑。
2. 有结构变更时，先创建可用快照，并在预发布数据库验证升级与应用回滚。
3. 无结构变更时，在发布记录中明确标记“无数据库变更”。
4. 准备对应版本的反向迁移步骤；无法反向迁移时，记录快照恢复步骤和预计恢复时间。

发布前记录当前 commit：

```bash
cd /opt/ad-creativity/app
sudo -u adcreative git rev-parse HEAD
```

完成上述数据库门禁后，先确认没有不可中断的 AIGC 任务，再由运行用户检出已经
确认的版本，由具备 systemd 管理权限的发布管理员运行仓库内部署脚本：

```bash
cd /opt/ad-creativity/app
sudo -u adcreative git fetch --tags
sudo -u adcreative git checkout <RELEASE_TAG_OR_COMMIT>
sudo -u adcreative git rev-parse HEAD
sudo ./scripts/deploy_server.sh
```

脚本依次安装 Python 依赖、编译检查后端、执行 `npm ci`、构建前端、重启两个
systemd 服务，并检查 `127.0.0.1:8000/health` 和 `127.0.0.1:3000/`。安装或
构建失败时不会重启当前服务；重启后失败时会输出两个服务的状态和最近 100 行日志。

当前脚本在非 root 模式下会执行 `sudo -n true`，要求调用账号具有免密 sudo。
不要为应用运行账号授予不受限的免密 sudo。默认由受控的发布管理员、堡垒机作业
或 CI Runner 以提权方式执行；若团队要采用最小权限发布账号，应先改造脚本和
sudoers/Polkit 规则，只允许管理这两个 systemd unit。

脚本不会执行以下操作：

- 拉取、切换或回滚 Git 版本。
- 停止服务后再构建。
- 运行完整测试套件。
- 重载 Nginx。
- 自动回滚应用或数据库。

需要覆盖默认配置时，在命令前设置环境变量：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `APP_ROOT` | 脚本推导的仓库根目录 | 应用目录 |
| `BACKEND_SERVICE` | `ad-creativity-backend` | 后端 systemd unit |
| `FRONTEND_SERVICE` | `ad-creativity-frontend` | 前端 systemd unit |
| `BACKEND_HEALTH_URL` | `http://127.0.0.1:8000/health` | 后端健康检查 |
| `FRONTEND_HEALTH_URL` | `http://127.0.0.1:3000/` | 前端健康检查 |
| `HEALTH_CHECK_ATTEMPTS` | `30` | 每个地址的最大尝试次数 |
| `HEALTH_CHECK_INTERVAL_SECONDS` | `2` | 尝试间隔秒数 |
| `DEPLOY_LOCK_FILE` | `/tmp/ad-creativity-deploy.lock` | 并发部署锁文件 |

例如，服务启动较慢时可增加重试次数：

```bash
sudo env \
  HEALTH_CHECK_ATTEMPTS=60 \
  HEALTH_CHECK_INTERVAL_SECONDS=3 \
  ./scripts/deploy_server.sh
```

脚本要求 Node.js 22 或更高版本、已有 `.venv` 和 `.env`。部署失败后可继续检查：

```bash
sudo systemctl status \
  ad-creativity-backend \
  ad-creativity-frontend \
  --no-pager
sudo journalctl -u ad-creativity-backend -n 200 --no-pager
sudo journalctl -u ad-creativity-frontend -n 200 --no-pager
```

该脚本属于原地部署，重启期间仍会有短暂不可用。需要无停机发布时，应升级为
反向代理下的双实例滚动发布。

## 17. 回滚方案

应用回滚：

```bash
sudo systemctl stop ad-creativity-frontend ad-creativity-backend

cd /opt/ad-creativity/app
sudo -u adcreative git checkout <PREVIOUS_COMMIT>
sudo -u adcreative python3 -m venv .venv.rollback
sudo -u adcreative .venv.rollback/bin/pip install -r requirements.txt
sudo -u adcreative mv .venv .venv.failed
sudo -u adcreative mv .venv.rollback .venv

cd frontend
sudo -u adcreative npm ci
sudo -u adcreative npm run build

sudo systemctl start ad-creativity-backend ad-creativity-frontend

curl --fail http://127.0.0.1:8000/health
```

随后通过浏览器重新登录，并确认 `GET /api/projects` 返回 `200`。

数据库回滚不能简单依赖应用代码回退。若发布包含不兼容的数据库变更，必须按以下顺序处理：

1. 保持前后端服务停止。
2. 在云数据库控制台执行经过验证的反向迁移，或将实例恢复至发布前快照。
3. 验证业务表结构和关键数据。
4. 回退应用代码、Python 虚拟环境和前端构建产物。
5. 启动服务并重新执行健康检查、数据库接口检查和核心业务验收。

未确认数据库恢复完成前，不要启动旧版本后端。

## 18. 上线检查清单

- [ ] 域名解析正确。
- [ ] HTTPS 证书有效且可自动续期。
- [ ] 安全组只开放必要端口。
- [ ] MySQL 使用私网地址并限制白名单。
- [ ] 数据库结构与部署 commit 匹配。
- [ ] 首次启动前已创建并验证云 MySQL 快照。
- [ ] `.env` 权限为 `600`，密钥未进入 Git。
- [ ] 推荐 `SITE_ORIGIN` 使用正式 HTTPS 域名；普通生产配置已将其设为
      `CORS_ORIGINS` 包含的 HTTPS Origin；`AUTH_COOKIE_SECURE=true`。
- [ ] `CORS_ORIGINS` 使用明确来源；若使用 `*`，已同时设置
      `ALLOW_INSECURE_CORS=true` 并接受任意来源跨域调用风险。
- [ ] 若临时使用公网 HTTP，已明确授权
      `ALLOW_INSECURE_AUTH_COOKIE=true` 与 `AUTH_COOKIE_SECURE=false`，
      并接受密码和会话明文传输风险。
- [ ] 公网 HTTP 模式部署时已核对部署输出和后端启动日志中的不安全认证
      Cookie 告警。
- [ ] 仅在 `CORS_ORIGINS` 包含独立的 `*` 条目且
      `ALLOW_INSECURE_CORS=true` 时让 `SITE_ORIGIN` 缺失或为空；若提供
      非空值，已确认它是合法 HTTP(S) Origin。
- [ ] `CORS_ORIGINS` 中仅使用独立的 `*` 条目表达 wildcard，未在 URL
      path 中使用伪 wildcard。
- [ ] 同域部署未设置 `NEXT_PUBLIC_BACKEND_BASE_URL`，浏览器 API 请求使用 `/api/`。
- [ ] 前端服务的 `BACKEND_INTERNAL_BASE_URL` 可访问 FastAPI。
- [ ] 后端和前端由 systemd 托管并设置自动启动。
- [ ] Nginx 上传大小和长任务超时已配置。
- [ ] `/health`、首次 `/setup` 初始化和登录后的数据库业务接口验证通过。
- [ ] 图片、视频上传及预览验证通过。
- [ ] Ark、TOS、MediaKit 和 TLS 链路验证通过。
- [ ] 仓库、部署脚本、环境文件和日志中不存在默认管理员密码。
- [ ] 已记录当前发布 commit 和回滚目标。
