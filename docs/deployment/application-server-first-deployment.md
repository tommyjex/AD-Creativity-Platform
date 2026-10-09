# AD Creativity 应用服务器首次部署方案

## 1. 文档目标

本文用于首次将 AD Creativity 部署到一台 Linux 应用服务器。

本方案假设：

- MySQL 8 已由云平台托管，数据库和数据表已经创建完成。
- 应用服务器可以通过私网连接云 MySQL。
- TOS、Ark、MediaKit 和 TLS 均使用云服务，不在应用服务器部署。
- 前端和后端使用同一个公网域名，由 Nginx 统一提供 HTTPS。
- 首次部署使用单台应用服务器和单个 FastAPI 进程。

本文不包含 MySQL 实例部署、数据库建库和建表操作。

## 2. 推荐架构

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

服务器安全组只开放：

- `22/tcp`：SSH，建议只允许办公网络或堡垒机。
- `80/tcp`：HTTP，仅用于跳转 HTTPS 和证书签发。
- `443/tcp`：HTTPS。

不要向公网开放 `3000`、`8000` 或 MySQL `3306`。

## 3. 部署前检查

### 3.1 服务器建议

首次部署建议：

- 操作系统：Ubuntu 22.04 LTS 或 24.04 LTS。
- CPU：至少 4 核，视频处理较多时建议 8 核。
- 内存：至少 8 GB，视频处理较多时建议 16 GB。
- 系统盘：至少 50 GB，并监控 `/tmp` 和日志占用。
- 网络：能够访问云 MySQL、TOS、Ark、MediaKit 和 TLS。

### 3.2 云 MySQL

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

### 3.3 域名和证书

准备一个域名，例如：

```text
ad.example.com
```

将域名 A 记录指向应用服务器公网 IP。建议前后端使用同一域名，避免额外的跨域配置。

### 3.4 公开部署安全要求

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
  git \
  nginx \
  python3 \
  python3-venv \
  python3-pip \
  ffmpeg \
  mysql-client
```

从公司批准的软件源或 NodeSource 安装 Node.js 22 LTS 或更高版本，然后确认：

```bash
python3 --version
node --version
npm --version
ffmpeg -version
nginx -v
```

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

未覆盖 Ark 模型时，不要写入值为空的 `ARK_TEXT_MODEL`、`ARK_IMAGE_MODEL`
或 `ARK_VIDEO_MODEL`，让应用使用代码中的默认模型。

设置权限：

```bash
sudo chown adcreative:adcreative /opt/ad-creativity/app/.env
sudo chmod 600 /opt/ad-creativity/app/.env
```

不要在 `.env` 中使用未经确认的 Shell 语法。systemd 的 `EnvironmentFile`
并不完整兼容 Bash。

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
| 上传返回 413 | Nginx `client_max_body_size` |
| 请求约 60 秒后断开 | Nginx 或上游负载均衡超时 |
| 图片或视频不可访问 | TOS 配置、对象权限、签名地址 |
| 最终成片失败 | `ffmpeg` 路径、磁盘空间、进程日志 |
| 浏览器出现 CORS 错误 | 前后端域名、协议、CORS 响应头 |
| TLS 没有日志 | TLS 开关、凭据、Project 和 Topic |

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

完成上述数据库门禁后，由部署用户手动拉取或检出已经确认的版本，再运行仓库内
部署脚本：

```bash
cd /opt/ad-creativity/app
sudo -u adcreative git pull --ff-only
sudo -u adcreative ./scripts/deploy_server.sh
```

脚本依次安装 Python 依赖、编译检查后端、执行 `npm ci`、构建前端、重启两个
systemd 服务，并检查 `127.0.0.1:8000/health` 和 `127.0.0.1:3000/`。安装或
构建失败时不会重启当前服务；重启后失败时会输出两个服务的状态和最近 100 行日志。

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
sudo -u adcreative \
  env \
  HEALTH_CHECK_ATTEMPTS=60 \
  HEALTH_CHECK_INTERVAL_SECONDS=3 \
  ./scripts/deploy_server.sh
```

脚本要求 Node.js 22 或更高版本、已有 `.venv` 和 `.env`，并要求部署用户可以通过
免交互 sudo 管理 systemd。部署失败后可继续检查：

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
