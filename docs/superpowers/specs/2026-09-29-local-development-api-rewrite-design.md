# 本地开发 API Rewrite 修复设计

## 背景

浏览器 API 和媒体地址已统一为同源 `/api/...` 路径。生产环境由 Nginx 将该
路径转发到 FastAPI，但本地开发仅运行 Next.js 3000 端口和 FastAPI 8000
端口，没有同源代理。

因此本地浏览器请求 `/api/assets/{id}/content` 时会进入 Next.js 并返回 404。
服务端渲染仍通过 `BACKEND_INTERNAL_BASE_URL` 访问 FastAPI，所以页面和画布
数据可以加载，但图片节点显示“图片暂不可预览”。

## 目标

- 本地 Next.js 开发服务器将所有 `/api/...` 请求转发到 FastAPI。
- 浏览器继续使用同源相对 URL，不恢复浏览器端 `localhost:8000` 硬编码。
- 复用 `BACKEND_INTERNAL_BASE_URL`，未设置时默认使用
  `http://127.0.0.1:8000`。
- 保持生产 Nginx 同源转发架构不变。
- 支持图片 Range 请求以及现有 API 的 GET、POST、PUT、DELETE 等方法。

## 方案

在 `frontend/next.config.mjs` 中增加异步 `rewrites()`：

```text
/api/:path*
  -> {BACKEND_INTERNAL_BASE_URL}/api/:path*
```

目标基地址会去除末尾斜杠，避免生成双斜杠。环境变量为空时使用
`http://127.0.0.1:8000`。

Next.js rewrite 由开发服务器代理请求，浏览器始终访问 3000 端口，因此不需要
本地 CORS 配置。生产环境中 Nginx 会在请求到达 Next.js 前处理 `/api/`；rewrite
只作为后备路径，不改变既有部署拓扑。分域部署若配置
`NEXT_PUBLIC_BACKEND_BASE_URL`，浏览器直接请求该地址，也不会经过 rewrite。

## 数据流

```text
本地浏览器
  -> http://localhost:3000/api/...
  -> Next.js rewrite
  -> http://127.0.0.1:8000/api/...
  -> FastAPI

生产浏览器
  -> https://站点域名/api/...
  -> Nginx
  -> http://127.0.0.1:8000/api/...
  -> FastAPI
```

## 错误与边界

- `BACKEND_INTERNAL_BASE_URL` 必须指向 FastAPI 根地址，不能包含 `/api`。
- FastAPI 未启动时，Next.js 返回代理失败；不回退到外部地址。
- rewrite 不代理 `/health`，本次仅修复浏览器使用的 `/api/...` 契约。
- 不修改资产 URL 安全校验、媒体比例展示或缓存逻辑。

## 测试

1. 配置单测断言默认 rewrite 目标为
   `http://127.0.0.1:8000/api/:path*`。
2. 配置单测断言 `BACKEND_INTERNAL_BASE_URL` 覆盖值生效且末尾斜杠被清理。
3. 重启本地 Next.js 后，验证同一资产：
   - `8000/api/assets/{id}/content` 返回图片。
   - `3000/api/assets/{id}/content` 通过 rewrite 返回相同图片响应。
4. 使用 Playwright 验证本地资产页面及 AIGC 图片预览不再出现 404。
5. 运行前端完整单测、类型检查、源码 ESLint、生产构建和
   `git diff --check`。

## 文档

更新根目录 `README.md`：本地开发默认通过 Next.js rewrite 代理到 8000 端口；
只有后端位于其他地址时才设置 `BACKEND_INTERNAL_BASE_URL`。不再声称浏览器默认
直连 `localhost:8000`。
