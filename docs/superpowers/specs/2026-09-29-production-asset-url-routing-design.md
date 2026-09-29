# 生产环境资产 URL 路由修复设计

## 背景

当前 `getBackendBaseUrl()` 同时服务于两类请求：

1. Next.js 服务端渲染时访问 FastAPI。
2. 浏览器发起交互 API 请求，以及加载图片、视频和资产下载。

默认值 `http://localhost:8000` 适合服务器内部访问，但被写入浏览器媒体 URL
后会指向访问者本机。若构建时改为服务器公网地址，Next.js 服务端又会绕行
Nginx，可能被 Basic Auth 或回环网络阻断，导致首页资产列表加载失败。

## 目标

- Next.js 服务端 API 请求继续使用内部 FastAPI 地址。
- 浏览器 API、资产内容与下载请求使用同源相对路径。
- 不依赖构建时写入公网 IP 或域名。
- 保留合法外部 HTTP/HTTPS 媒体地址的现有行为。
- 覆盖首页图片、视频、预览弹窗和下载入口。

## 方案

### API 基地址

`createApiClient()` 根据运行环境选择基地址：

- Next.js 服务端使用仅服务端可见的 `BACKEND_INTERNAL_BASE_URL`，默认值为
  `http://localhost:8000`。
- 浏览器使用 `NEXT_PUBLIC_BACKEND_BASE_URL`；未设置时使用空基地址，使请求
  保持为 `/api/...` 同源路径。

这使服务端渲染不经过公网 Nginx，同时让浏览器中的上传、删除、生成和查询等
交互请求统一经过当前站点的 `/api/` 代理。

### 浏览器资产地址

`frontend/lib/asset-display.ts` 中由资产 ID 构造的内容和下载地址改为同源相对
路径：

- 内容：`/api/assets/{assetId}/content`
- 下载：`/api/assets/{assetId}/content?download=1...`

后端返回的 `/api/assets/.../content` 和 `/last-frame` 相对地址使用浏览器公开
基地址；同源生产部署未配置公开基地址时保持相对形式。

后端返回的完整 `http://` 或 `https://` URL 继续通过协议白名单校验并原样使用。
其他协议和非法 URL 继续返回 `null`。

## 数据流

```text
Next.js 服务端
  -> BACKEND_INTERNAL_BASE_URL（默认 http://localhost:8000）
  -> FastAPI

用户浏览器
  -> /api/... -> 当前站点 Nginx
  -> http://127.0.0.1:8000/api/... -> FastAPI
```

这样服务端不绕公网，浏览器也不会访问自身的 `localhost:8000`。

## 兼容性

- 本地开发前后端分别运行在 3000 和 8000 端口时，继续设置
  `NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8000`。
- 前后端分域部署时显式设置 `NEXT_PUBLIC_BACKEND_BASE_URL`，并配置严格的
  CORS 允许源。
- 完整 TOS 或其他外部媒体 URL 不受影响。
- Nginx 继续按现有配置代理 `/api/`，无需放宽 Basic Auth 或 CORS。

## 测试

更新并运行以下验证：

1. `api-client` 单元测试分别覆盖服务端内部基地址和浏览器同源基地址。
2. `asset-display` 单元测试断言内容、下载和尾帧地址保持相对路径。
3. 首页媒体画廊测试断言下载链接为相对路径。
4. 现有前端测试、TypeScript、ESLint 和生产构建。
5. Playwright 桌面、平板和手机视口验证首页资产加载与图片完整显示。
6. 生产验收确认浏览器 Network 中不存在 `localhost:8000`，媒体请求命中
   `/api/assets/...`。

## 部署

代码发布后，同源生产环境不设置 `NEXT_PUBLIC_BACKEND_BASE_URL`。可选设置
`BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8000`；不设置时使用默认值。
然后执行：

```bash
cd ~/AD-Creativity-Platform/frontend
npm ci
npm run build
sudo systemctl restart ad-creativity-frontend
```

发布后检查首页资产数量、图片和视频预览，并确认 Nginx `/api/assets/` 返回
成功状态。
