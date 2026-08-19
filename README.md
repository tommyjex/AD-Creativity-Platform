# AD Creativity

面向广告创意生产的 Web 应用，支持从 Brief 到故事、脚本、分镜、图片、视频和最终成片的工作流。

## 技术栈

- 后端：Python、FastAPI、SQLAlchemy、MySQL
- 前端：React、Next.js、TypeScript、Tailwind CSS
- 外部服务：火山方舟 Ark、对象存储 TOS、MediaKit
- 视频合成：FFmpeg

## 首次部署

以下步骤适用于本地开发或一台可运行前后端服务的服务器。项目当前未提供 Docker Compose 配置。

### 1. 安装前置软件

- Python 3.11 或更高版本
- Node.js 20 或更高版本
- npm
- MySQL 8.0 或兼容版本
- FFmpeg（需要生成最终成片或烧录字幕时）

macOS 可执行：

```bash
brew install python node mysql ffmpeg
```

确认版本：

```bash
python3 --version
node --version
npm --version
ffmpeg -version
```

### 2. 获取代码并创建 Python 虚拟环境

```bash
git clone <YOUR_REPOSITORY_URL> AD-Creativity
cd AD-Creativity

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```

### 3. 安装前端依赖

```bash
cd frontend
npm ci
cd ..
```

`frontend/package-lock.json` 已锁定依赖版本，应优先使用 `npm ci`。

### 4. 创建数据库

创建一个使用 `utf8mb4` 字符集的 MySQL 数据库，并为应用创建仅具备该库权限的账号：

```sql
CREATE DATABASE ad_creativity
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'ad_creativity'@'%' IDENTIFIED BY '<STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON ad_creativity.* TO 'ad_creativity'@'%';
FLUSH PRIVILEGES;
```

请按实际环境收紧用户来源 IP 和数据库权限。

### 5. 配置环境变量

从模板创建本地配置文件：

```bash
cp .env.example .env
```

编辑 `.env` 并填入对应凭据。`.env` 已被 Git 忽略，禁止提交。

#### 必填配置

| 配置项 | 用途 |
| --- | --- |
| `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME` | MySQL 连接 |
| `TOS_ACCESS_KEY`、`TOS_SECRET_KEY`、`TOS_ENDPOINT`、`TOS_REGION`、`TOS_BUCKET` | TOS 资产存储 |
| `ARK_API_KEY` | Ark 文本、图片和视频生成 |

#### 按需配置

| 配置项 | 用途 |
| --- | --- |
| `TOS_PUBLIC_ENDPOINT` | 对象存储公开访问域名；未设置时使用签名访问链接 |
| `ARK_BASE_URL` | Ark API 地址，默认使用北京区域 API 地址 |
| `ARK_TEXT_MODEL`、`ARK_IMAGE_MODEL`、`ARK_VIDEO_MODEL` | 覆盖默认模型 ID |
| `MEDIAKIT_API_KEY`、`MEDIAKIT_BASE_URL` | 使用视频转写/字幕能力时必填 |
| `COMPOSER_FFMPEG_PATH` | FFmpeg 不在 `PATH` 中时填写可执行文件绝对路径 |

TOS 仅使用 `TOS_ACCESS_KEY` 和 `TOS_SECRET_KEY`。旧的 `TOS_AK`、`TOS_SK` 仅为代码兼容别名，不建议配置。

环境变量模板：

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ad_creativity
DB_PASSWORD=<STRONG_PASSWORD>
DB_NAME=ad_creativity

TOS_ACCESS_KEY=<TOS_ACCESS_KEY>
TOS_SECRET_KEY=<TOS_SECRET_KEY>
TOS_ENDPOINT=<TOS_ENDPOINT>
TOS_REGION=<TOS_REGION>
TOS_BUCKET=<TOS_BUCKET>
TOS_PUBLIC_ENDPOINT=<OPTIONAL_PUBLIC_ENDPOINT>

ARK_API_KEY=<ARK_API_KEY>
MEDIAKIT_API_KEY=<OPTIONAL_MEDIAKIT_API_KEY>
```

### 6. 初始化数据库表

应用会在首次访问需要数据库的 API 时自动建表和执行增量迁移。部署时建议主动执行一次：

```bash
set -a
source .env
set +a
.venv/bin/python -c "from backend.app.db import init_database; init_database()"
```

### 7. 启动后端

在项目根目录执行：

```bash
.venv/bin/python -m uvicorn backend.app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --env-file .env
```

验证健康检查：

```bash
curl http://127.0.0.1:8000/health
```

预期响应：

```json
{
  "status": "ok",
  "name": "AD Creativity Backend",
  "version": "0.1.0"
}
```

### 8. 启动前端

本地开发时，前端默认请求 `http://localhost:8000`，无需额外配置：

```bash
cd frontend
npm run dev
```

打开 `http://localhost:3000`。

前后端不在同一主机时，在 `frontend/.env.local` 中设置后端公开地址：

```dotenv
NEXT_PUBLIC_BACKEND_BASE_URL=https://api.example.com
```

然后构建并启动生产前端：

```bash
npm run build
npm run start
```

## 验证与测试

后端测试：

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests -q
```

前端检查：

```bash
cd frontend
npm run typecheck
npm run lint
npm test
```

## 生产部署注意事项

- 不要提交或复制 `.env`、TOS AK/SK、Ark API Key、数据库密码。
- 生产环境应通过密钥管理系统或部署平台注入环境变量，而不是将 `.env` 放进镜像。
- 当前后端 CORS 配置允许任意来源。对公网部署前，应按实际前端域名收紧 CORS 策略。
- 在反向代理层启用 HTTPS、访问日志、请求大小限制和超时控制。
- 视频生成与合成可能耗时较长；建议使用进程守护工具管理后端服务，并根据负载配置工作进程。

## 常见问题

### 后端提示缺少数据库配置

确认 `.env` 中的 `DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_NAME` 已填写，并且启动命令带有 `--env-file .env`。

### 生成图片或视频时提示 TOS 配置缺失

确认已填写 `TOS_ACCESS_KEY`、`TOS_SECRET_KEY`、`TOS_ENDPOINT`、`TOS_REGION`、`TOS_BUCKET`。

### 最终成片失败，提示找不到 FFmpeg

安装 FFmpeg，或将 `COMPOSER_FFMPEG_PATH` 设置为 FFmpeg 可执行文件的绝对路径。

### 前端无法连接后端

确认后端健康检查可访问，并检查 `NEXT_PUBLIC_BACKEND_BASE_URL` 是否指向正确的协议、主机和端口。修改该变量后需重新构建前端。
