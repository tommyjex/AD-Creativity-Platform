# 本地与生产环境 HTTPS 支持

## 1. 目标

为 AD Creativity 增加完整的 HTTPS 接入方式：

- 本地开发可通过 `https://localhost:3000` 访问应用。
- 生产环境可通过 `https://ad-creativity.tech` 访问应用。
- 保留现有本地 HTTP 开发方式，不强制所有开发者启用 HTTPS。
- 保持浏览器、前端和 API 同源，避免新增跨域认证复杂度。
- 正式证书、私钥和本地开发私钥均不进入 Git。

本次不调整应用服务器内部通信协议。Next.js 与 FastAPI 仍通过回环地址上的
HTTP 通信，TLS 只在浏览器入口终止。

## 2. 已确认输入

正式证书包：

```text
/Users/bytedance/Downloads/ad-creativity.tech_nginx.tar
```

证书包包含：

```text
ad-creativity.tech.pem
ad-creativity.tech.key
```

核验结果：

- 证书公用名和 SAN 均为 `ad-creativity.tech`。
- 证书不覆盖 `www.ad-creativity.tech`。
- 签发机构为 DigiCert Encryption Everywhere DV TLS CA - G2。
- 有效期为 2026-10-10 00:00:00 UTC 至 2027-04-26 23:59:59 UTC。
- 证书公钥与私钥匹配。

因此生产入口只配置 `ad-creativity.tech`。如需支持 `www`，必须先申请包含
`www.ad-creativity.tech` 的新证书。

## 3. 方案选择

### 3.1 采用方案

采用入口层 TLS：

- 本地由 Next.js 开发服务器终止 TLS。
- 生产由 Nginx 终止 TLS。
- FastAPI 不直接暴露 HTTPS 端口。
- 浏览器始终通过前端同源 `/api/...` 访问 API。

该方案与现有 `Nginx -> Next.js/FastAPI` 部署拓扑一致，改动范围小，并能继续
使用已有的同源 Cookie、Origin 防护和 Next.js rewrite。

### 3.2 未采用方案

本地和生产统一使用 Nginx，可获得更一致的入口结构，但会要求每位开发者在
macOS 上额外安装和维护 Nginx，不适合作为默认开发流程。

Next.js 与 FastAPI 分别直接启用 TLS，会引入两套证书配置、跨域访问和 Cookie
策略，同时削弱生产 Nginx 的统一安全边界，因此不采用。

## 4. 总体架构

### 4.1 本地 HTTPS

```text
浏览器
    |
    | HTTPS https://localhost:3000
    v
Next.js 开发服务器
    |
    | HTTP http://127.0.0.1:8000
    v
FastAPI
```

Next.js 使用 `mkcert` 生成并由本机信任的开发证书。证书仅覆盖：

- `localhost`
- `127.0.0.1`
- `::1`

浏览器 API 请求继续使用 `/api/...`。Next.js rewrite 使用
`BACKEND_INTERNAL_BASE_URL` 或默认的 `http://127.0.0.1:8000` 访问 FastAPI。

### 4.2 生产 HTTPS

```text
浏览器
    |
    | HTTPS https://ad-creativity.tech:443
    v
Nginx
    |-- /api/*  -> HTTP 127.0.0.1:8000
    |-- /health -> HTTP 127.0.0.1:8000
    `-- /*       -> HTTP 127.0.0.1:3000
```

端口 80 只用于将所有普通请求永久跳转到对应的 HTTPS URL。Next.js 和 FastAPI
继续仅监听 `127.0.0.1`，不直接暴露到公网。

## 5. 仓库改动

### 5.1 本地 HTTPS 工具

增加本地证书初始化脚本，职责为：

1. 检查 `mkcert` 是否可用；缺失时给出明确的 Homebrew 安装命令并退出。
2. 初始化本机开发 CA。
3. 在仓库的忽略目录中生成 localhost 证书和私钥。
4. 检查已存在证书是否仍有效且覆盖预期主机；满足条件时保持幂等。
5. 不输出私钥内容。

增加前端 `dev:https` 命令，使用生成的证书启动 Next.js HTTPS 开发服务器。
现有 `npm run dev` 保持不变，继续提供 HTTP 开发模式。

本地证书目录加入 `.gitignore`，避免开发证书或私钥被误提交。

### 5.2 生产 Nginx 配置

仓库增加可审查、可部署的 Nginx 站点配置，固定域名为
`ad-creativity.tech`，包含：

- IPv4 和 IPv6 的 80/443 监听。
- HTTP 到 HTTPS 的永久重定向。
- TLS 1.2 和 TLS 1.3。
- 正式证书及私钥的受控文件路径。
- `/api/`、`/health` 和 `/` 的反向代理。
- `Host`、客户端 IP、`X-Forwarded-Proto` 和请求 ID 转发。
- 2 GB 上传限制。
- AIGC 长任务所需的代理连接、发送和读取超时。
- API 请求与响应关闭代理缓冲，避免大文件和长任务被 Nginx 提前缓存。
- Next.js 开发或运行时升级连接所需的请求头。
- HSTS、禁止 MIME 嗅探和 Referrer Policy 等基础响应头。

HSTS 只在 HTTPS 虚拟主机返回，不使用 `includeSubDomains` 或 `preload`，避免
影响尚未纳入本证书管理的子域名。

### 5.3 正式证书安装

增加需要管理员权限执行的证书安装脚本。脚本接收外部证书 tar 包路径，不假设
证书位于仓库中，并执行以下门禁：

1. tar 包必须只包含预期的 PEM 证书和私钥文件。
2. 证书必须可被 OpenSSL 解析。
3. SAN 必须包含精确域名 `ad-creativity.tech`。
4. 证书不能已过期，并为临近到期提供失败或明确告警。
5. 证书和私钥必须匹配。
6. 私钥必须为未加密、可供 Nginx 非交互加载的有效私钥。
7. 安装过程使用临时目录，并在退出时清理。

通过校验后安装到：

```text
/etc/nginx/ssl/ad-creativity.tech/fullchain.pem
/etc/nginx/ssl/ad-creativity.tech/privkey.pem
```

目录由 `root` 管理。私钥权限为 `0600`，证书权限为 `0644`。若目标文件已经
存在，脚本先创建带时间戳的备份，再以原子替换方式安装新文件。

脚本随后执行 `nginx -t`。只有配置检查通过才 reload Nginx；失败时保留原服务
进程，并输出恢复备份所需的信息。

## 6. 环境配置

### 6.1 本地 HTTP

原有默认配置继续有效：

```dotenv
APP_ENV=local
CORS_ORIGINS=http://localhost:3000
SITE_ORIGIN=http://localhost:3000
AUTH_COOKIE_SECURE=false
```

### 6.2 本地 HTTPS

文档提供以下本地覆盖值：

```dotenv
APP_ENV=local
CORS_ORIGINS=https://localhost:3000
SITE_ORIGIN=https://localhost:3000
AUTH_COOKIE_SECURE=true
```

本地前端不设置 `NEXT_PUBLIC_BACKEND_BASE_URL`，浏览器继续使用同源 API。

### 6.3 生产 HTTPS

生产 `.env` 使用：

```dotenv
APP_ENV=production
CORS_ORIGINS=https://ad-creativity.tech
ALLOW_INSECURE_CORS=false
ALLOW_INSECURE_AUTH_COOKIE=false
SITE_ORIGIN=https://ad-creativity.tech
AUTH_COOKIE_SECURE=true
```

生产前端不设置 `NEXT_PUBLIC_BACKEND_BASE_URL`。Next.js 服务端仍使用
`BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8000`。

应用已有的生产配置校验会继续保证：

- `SITE_ORIGIN` 必须为 HTTPS。
- `CORS_ORIGINS` 必须包含 `SITE_ORIGIN`。
- 认证 Cookie 设置 `Secure`、`HttpOnly` 和 `SameSite=Lax`。

## 7. 证书安全边界

- 正式证书 tar 包只作为部署输入，不复制到仓库。
- 正式私钥只安装到生产服务器的受限目录。
- 本地 `mkcert` 根 CA 和私钥由开发机自行管理，不共享、不上传。
- 日志不得打印 PEM 内容、私钥摘要或私钥路径之外的敏感信息。
- Git 忽略规则覆盖约定的本地证书目录和常见私钥扩展名。
- 文档不得包含证书或私钥正文。

本次不自动将附件复制到服务器，也不把服务器登录、DNS 或云平台操作写入脚本。

## 8. 错误处理与回滚

### 8.1 本地

- `mkcert` 缺失：给出安装命令，不回退到浏览器不信任的自签名证书。
- 证书生成失败：保留原 HTTP 开发能力，并返回非零状态。
- 证书过期或 SAN 不匹配：重新生成，而不是继续启动 HTTPS。
- HTTPS 启动失败：输出证书路径和 Next.js 错误，但不输出私钥内容。

### 8.2 生产

- 证书包结构异常、域名不匹配、过期或密钥不匹配：安装前失败，不修改线上文件。
- `nginx -t` 失败：不 reload Nginx，并恢复或保留原证书。
- reload 失败：现有 Nginx worker 继续使用原配置；运维可恢复时间戳备份。
- 新证书部署后异常：恢复备份证书，重新执行 `nginx -t` 和 reload。

## 9. 测试与验收

### 9.1 静态和自动化检查

- Shell 脚本通过 `bash -n`。
- Nginx 配置在安装了 Nginx 的环境通过 `nginx -t`。
- 证书安装脚本的成功路径使用附件证书验证。
- 证书安装脚本覆盖错误 tar、缺文件、域名不匹配、过期和密钥不匹配场景。
- 后端配置与认证 Cookie 测试通过。
- 前端 typecheck、lint、单元测试和生产构建通过。

### 9.2 本地 HTTPS 验收

1. `mkcert` 证书受本机信任。
2. `https://localhost:3000` 无浏览器证书警告。
3. `GET /health` 可经同源入口访问。
4. 登录响应设置 `Secure` Cookie。
5. 登录后 `GET /api/auth/me` 返回 200。
6. 页面、API、媒体上传和 AIGC 长请求不出现 mixed content。
7. 原有 `http://localhost:3000` 开发命令仍可使用。

### 9.3 生产 HTTPS 验收

1. `http://ad-creativity.tech/...` 保留路径和查询参数跳转到 HTTPS。
2. `https://ad-creativity.tech/health` 返回 200 和预期 JSON。
3. 浏览器证书链有效，域名匹配且无安全警告。
4. TLS 1.0 和 TLS 1.1 不可用，TLS 1.2 和 TLS 1.3 可用。
5. 登录 Cookie 包含 `Secure`、`HttpOnly` 和 `SameSite=Lax`。
6. 页面导航、API、上传、媒体读取和长任务正常。
7. `3000` 和 `8000` 仍只监听回环地址。
8. 响应包含预期基础安全头，HTTPS 响应包含 HSTS。

## 10. 文档更新

更新根目录 README 和生产部署手册：

- 本地 HTTP 与 HTTPS 两套启动方式。
- `mkcert` 安装、初始化和证书更新步骤。
- 正式证书包的校验及安装命令。
- 生产 `.env` 的精确域名配置。
- Nginx 站点启用、语法检查、reload 和验收命令。
- 证书到期前替换流程与回滚方式。
- 明确当前证书不支持 `www.ad-creativity.tech`。

## 11. 非目标

- 不申请或自动续签新证书。
- 不支持 `www.ad-creativity.tech`。
- 不将 TLS 下沉到 Next.js 或 FastAPI 的生产进程。
- 不引入 Docker、Kubernetes、云负载均衡或 CDN。
- 不修改业务 API、数据库结构或 AIGC 工作流。
- 不自动变更 DNS、安全组或生产服务器文件。
