# 生产环境通配 CORS 显式开关设计

## 背景

当前生产部署同时在部署脚本和后端配置层拒绝
`CORS_ORIGINS=*`。部分部署环境需要临时允许任意来源发起跨域请求，
但不能因此让所有生产环境默认失去 CORS 防护。

## 目标

- 允许生产环境通过显式开关使用 `CORS_ORIGINS=*`。
- 未显式开启时保持现有安全校验。
- 保留生产环境 HTTPS 站点来源和安全 Cookie 要求。
- 通配来源下继续禁止跨域凭证，避免浏览器携带认证 Cookie。

## 非目标

- 不自动启用通配 CORS。
- 不允许省略 `CORS_ORIGINS`。
- 不允许通过通配 CORS 携带跨域认证 Cookie。
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

默认值为 `false`。当 `CORS_ORIGINS` 包含 `*` 且开关不是严格的
`true` 时，部署预检和后端启动均失败。

## 后端行为

`Settings` 新增布尔字段 `allow_insecure_cors`，由
`ALLOW_INSECURE_CORS` 解析。

生产环境配置校验按以下规则执行：

1. `AUTH_COOKIE_SECURE` 仍必须启用。
2. `SITE_ORIGIN` 仍必须是 HTTPS Origin。
3. `CORS_ORIGINS` 不含 `*` 时，仍必须包含 `SITE_ORIGIN`。
4. `CORS_ORIGINS` 含 `*` 时，仅在 `allow_insecure_cors=true` 时通过，
   且不再要求列表包含 `SITE_ORIGIN`。

FastAPI 的现有中间件逻辑保持不变：通配来源时
`allow_credentials=false`。因此任意来源可以调用无凭证接口，但浏览器
不会获得携带 Cookie 的跨域授权。

## 部署预检

`deploy_server.sh` 读取 `ALLOW_INSECURE_CORS`，缺省视为 `false`。

- 非通配来源：保持现有来源包含关系校验。
- 通配来源且开关为 `true`：允许继续部署，并输出醒目的安全警告。
- 通配来源且开关缺失、为空或不是 `true`：部署失败并给出修复提示。
- `CORS_ORIGINS` 缺失或为空：仍然失败，避免隐式扩大访问范围。

## 文档与模板

`.env.example` 增加 `ALLOW_INSECURE_CORS=false`。部署文档说明：

- 推荐继续使用正式域名作为唯一来源。
- 通配模式只用于明确接受风险的部署。
- 通配模式不支持跨域 Cookie 认证。

## 测试

- 后端配置测试覆盖生产环境通配来源在开关关闭时失败。
- 后端配置测试覆盖开关开启时通配来源通过。
- 保留 HTTPS、Cookie 和非通配来源包含关系的回归测试。
- 部署脚本测试覆盖通配来源加显式开关成功。
- 部署脚本测试覆盖缺少显式开关时失败。
- 运行部署脚本测试、后端配置测试、Ruff 和 shell 语法检查。

## 风险与回滚

主要风险是公开无凭证接口被任意网站跨域调用。显式双配置降低误开启概率，
但不能消除该风险。认证接口仍受浏览器跨域凭证限制。

回滚时删除 `ALLOW_INSECURE_CORS` 支持并恢复生产环境对 `*` 的无条件拒绝；
使用正式 HTTPS 域名配置 `CORS_ORIGINS` 和 `SITE_ORIGIN`。
