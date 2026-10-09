# 生产环境通配 CORS 显式开关设计

## 背景

当前生产部署同时在部署脚本和后端配置层拒绝
`CORS_ORIGINS=*`。部分部署环境需要临时允许任意来源发起跨域请求，
但不能因此让所有生产环境默认失去 CORS 防护。

## 目标

- 允许生产环境通过显式开关使用 `CORS_ORIGINS=*`。
- 未显式开启时保持现有安全校验。
- 非通配生产配置保留 HTTPS 站点来源要求；所有生产配置保留安全 Cookie
  要求。
- 通配来源下不返回 credentialed CORS 授权，避免浏览器脚本读取带凭证的
  跨域响应。

## 非目标

- 不自动启用通配 CORS。
- 不允许省略 `CORS_ORIGINS`。
- 不允许普通生产配置省略 `SITE_ORIGIN`。
- 不为通配来源返回 credentialed CORS 授权。
- 不改变本地开发环境的 CORS 行为。

## 配置契约

新增环境变量：

```dotenv
ALLOW_INSECURE_CORS=false
```

生产环境使用通配来源时必须同时配置：

```dotenv
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
```

默认值为 `false`。环境值去除首尾空白后仅接受精确小写 `true` 或
`false`；`1`、`yes`、`on`、`TRUE` 等别名或大小写变体均无效。当
`CORS_ORIGINS` 包含 `*` 且开关不是精确小写 `true` 时，部署预检和
后端启动均失败。

## 后端行为

`Settings` 新增布尔字段 `allow_insecure_cors`，由
`ALLOW_INSECURE_CORS` 解析。

生产环境配置校验按以下规则执行：

1. `AUTH_COOKIE_SECURE` 仍必须启用。
2. `CORS_ORIGINS` 不含 `*` 时，`SITE_ORIGIN` 仍为必填 HTTPS Origin，
   且必须包含在 `CORS_ORIGINS` 中。
3. `CORS_ORIGINS` 含 `*` 时，仅在 `allow_insecure_cors=true` 时通过；
   此时允许环境中不设置 `SITE_ORIGIN`，并跳过生产 HTTPS 和来源包含校验。
4. 通配显式开关模式下，`Settings` 保留本地默认 `site_origin` 作为内部
   兜底值，但运行时 Origin guard 不读取该值。

FastAPI 的 `CORSMiddleware` 逻辑保持
`allow_credentials=false`（通配来源时）。这表示响应不会返回
credentialed CORS 授权；即使请求包含认证 Cookie，浏览器脚本也不能读取
带凭证的跨域响应。该设置不能描述为浏览器一定不会发送 Cookie。

`backend/app/main.py` 的非安全方法 Origin guard 同步识别该双配置：

- `CORS_ORIGINS` 包含 `*` 且 `allow_insecure_cors=true` 时，`POST`、
  `PUT`、`PATCH`、`DELETE` 等非安全方法放行任意来源，交由路由继续处理。
- 其他配置下保持原有 guard；Origin/Referer 不匹配 `SITE_ORIGIN` 的非安全
  方法仍返回 `403 origin_forbidden`。
- `GET`、`HEAD`、`OPTIONS` 的现有处理不变。

## 部署预检

`deploy_server.sh` 读取 `ALLOW_INSECURE_CORS`，缺省视为 `false`。

- 非通配来源：保持现有来源包含关系校验。
- 通配来源且开关为 `true`：允许省略 `SITE_ORIGIN` 并继续部署，同时输出
  醒目的安全警告。
- 通配来源且开关缺失、为空或不是精确小写 `true`：部署失败并给出修复
  提示。
- `CORS_ORIGINS` 缺失或为空：仍然失败，避免隐式扩大访问范围。
- 非通配来源下 `SITE_ORIGIN` 缺失、为空或不是 HTTPS Origin：仍然失败。

## 文档与模板

`.env.example` 增加 `ALLOW_INSECURE_CORS=false`。部署文档说明：

- 推荐继续使用正式域名作为唯一来源。
- 通配模式只用于明确接受风险且暂时没有正式站点来源的部署。
- 通配模式不返回 credentialed CORS 授权；浏览器脚本不能读取带凭证的
  跨域响应。

## 测试

- 后端配置测试覆盖生产环境通配来源在开关关闭时失败。
- 后端配置测试覆盖开关开启时通配来源通过。
- 后端配置测试覆盖通配显式开关模式未设置 `SITE_ORIGIN` 时通过，以及普通
  生产模式未设置时仍失败。
- `backend/tests/test_config.py` 覆盖环境值仅接受精确小写 `true`/`false`，
  并拒绝布尔别名和大小写变体。
- `backend/tests/test_auth_api.py` 覆盖双配置启用后任意 Origin 的 `POST`
  通过、返回 `Access-Control-Allow-Origin: *` 且不返回
  `Access-Control-Allow-Credentials`。
- `backend/tests/test_auth_api.py` 覆盖非通配配置即使开关为 `true`，跨来源
  `POST` 仍返回 `403 origin_forbidden`。
- 保留 HTTPS、Cookie 和非通配来源包含关系的回归测试。
- 部署脚本测试覆盖通配来源加显式开关成功。
- 部署脚本测试覆盖通配显式开关模式缺少 `SITE_ORIGIN` 时成功。
- 部署脚本测试覆盖缺少显式开关、`false` 和大写 `TRUE` 时失败。
- 运行部署脚本测试、后端配置与认证 API 测试、Ruff 和 shell 语法检查。

## 风险与回滚

主要风险是任意网站可以跨域调用公开接口以及非安全方法端点。显式双配置
降低误开启概率，但不能消除该风险。`allow_credentials=false` 只限制浏览器
脚本读取带凭证的跨域响应，不应被视为服务端拒收凭证或完整的 CSRF 防护。

回滚时删除 `ALLOW_INSECURE_CORS` 支持并恢复生产环境对 `*` 的无条件拒绝；
使用正式 HTTPS 域名配置 `CORS_ORIGINS` 和 `SITE_ORIGIN`。
