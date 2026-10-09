# 生产环境不安全认证 Cookie 显式开关设计

## 背景

当前生产配置在后端启动校验和部署预检两层强制
`AUTH_COOKIE_SECURE=true`。这是 HTTPS 部署的正确默认值，但当前线上只能通过
公网 HTTP IP `http://101.126.86.254/` 访问，尚无域名和证书。

登录接口在该环境中可以验证账号并创建服务端会话，也会在响应中设置
`Secure` Cookie；浏览器不会在后续 HTTP 请求中发送该 Cookie。因此前端会
短暂使用登录响应显示管理员状态，随后 `/api/auth/me` 返回 401 并将页面
重定向回登录页。

## 决策

新增独立显式开关 `ALLOW_INSECURE_AUTH_COOKIE`。生产环境默认继续强制安全
Cookie；只有同时配置以下组合时才允许 HTTP 会话：

```dotenv
ALLOW_INSECURE_AUTH_COOKIE=true
AUTH_COOKIE_SECURE=false
```

该模式只用于没有域名和证书、且明确接受公网明文会话风险的临时部署。获得
HTTPS 能力后必须恢复安全 Cookie。

## 目标

- 允许当前生产环境通过公网 HTTP IP 完成登录并保持会话。
- 使用专用显式开关限制安全降级，避免普通生产部署误配置。
- 保持后端启动校验和部署预检的配置契约一致。
- 保留 Cookie 的 `HttpOnly`、`SameSite=Lax`、`Path=/` 和有效期属性。
- 不安全模式生效时在后端启动日志和部署输出中记录明确警告。
- 为默认安全模式、不安全显式模式和非法组合提供自动化测试。

## 非目标

- 不为 HTTP 提供传输加密或抵御链路窃听。
- 不自动关闭 Cookie 的 `Secure` 属性。
- 不复用 `ALLOW_INSECURE_CORS` 控制认证 Cookie。
- 不改变 CORS、Origin guard、登录限流或服务端会话存储行为。
- 不改变现有会话空闲时间和绝对有效期默认值。
- 不移除生产环境对不安全 Cookie 的默认拒绝。

## 配置契约

`.env.example` 新增：

```dotenv
ALLOW_INSECURE_AUTH_COOKIE=false
```

该变量缺省为 `false`。读取环境变量时去除首尾空白，并且仅接受精确小写
`true` 或 `false`；`1`、`yes`、`on`、`TRUE` 等别名或大小写变体均无效。

生产环境配置矩阵：

| `ALLOW_INSECURE_AUTH_COOKIE` | `AUTH_COOKIE_SECURE` | 结果 |
|---|---|---|
| 缺失或 `false` | `true` | 允许，默认安全模式 |
| `true` | `false` | 允许，显式不安全 HTTP 模式 |
| 缺失或 `false` | `false` | 拒绝启动和部署 |
| `true` | `true` | 允许，Cookie 仍为安全模式，不输出不安全模式告警 |
| 非法布尔值 | 任意值 | 拒绝启动和部署 |

`AUTH_COOKIE_SECURE` 在部署预检中同样仅接受精确小写 `true` 或 `false`。
变量缺失或为空仍视为配置错误。

`ALLOW_INSECURE_AUTH_COOKIE` 与 `ALLOW_INSECURE_CORS` 相互独立。当前公网
HTTP IP 部署需要：

```dotenv
APP_ENV=production
CORS_ORIGINS=*
ALLOW_INSECURE_CORS=true
ALLOW_INSECURE_AUTH_COOKIE=true
AUTH_COOKIE_SECURE=false
```

`SITE_ORIGIN` 是否可以省略继续由现有通配 CORS 规则决定，不由认证 Cookie
开关决定。

## 后端配置与运行时行为

`backend/app/core/config.py` 的 `Settings` 新增：

```python
allow_insecure_auth_cookie: bool = False
```

`Settings.from_env()` 使用现有严格布尔解析方式读取
`ALLOW_INSECURE_AUTH_COOKIE`，并将 `AUTH_COOKIE_SECURE` 同步改为严格
布尔解析。两个变量均只接受精确小写 `true` 或 `false`；后端中
`AUTH_COOKIE_SECURE` 的缺省值继续按现有规则由环境类型决定。生产校验按
以下规则执行：

1. `auth_cookie_secure=true` 时保持现有行为，不要求显式开关。
2. `auth_cookie_secure=false` 且 `allow_insecure_auth_cookie=true` 时允许
   启动。
3. `auth_cookie_secure=false` 且开关缺失或为 `false` 时抛出
   `ConfigurationError`。
4. CORS 与 `SITE_ORIGIN` 的现有生产校验不变。

`backend/app/api/auth_routes.py` 不新增 Cookie 分支。现有
`_set_session_cookie()` 和 `_clear_session_cookie()` 继续统一读取
`settings.auth_cookie_secure`，因此登录、登出、密码修改和 401 清理 Cookie
保持相同属性。

不安全模式生效，即生产环境同时满足
`allow_insecure_auth_cookie=true` 和 `auth_cookie_secure=false` 时，后端
启动阶段通过现有结构化日志设施写入一次警告事件。事件不得包含 Cookie、
会话令牌、密码、用户信息或其他敏感值。事件名固定为：
`security.insecure_auth_cookie_enabled`。

## 部署预检

`scripts/deploy_server.sh` 新增读取和严格校验
`ALLOW_INSECURE_AUTH_COOKIE`：

- 缺失时视为 `false`。
- 仅接受精确小写 `true` 或 `false`。
- `AUTH_COOKIE_SECURE` 必须存在，且仅接受精确小写 `true` 或 `false`。
- `AUTH_COOKIE_SECURE=false` 时，只有
  `ALLOW_INSECURE_AUTH_COOKIE=true` 才能继续部署。
- 上述不安全组合生效时，预检输出醒目的警告，明确说明公网 HTTP 会话可能
  被窃听。
- 其他依赖、构建和服务重启流程不变。

预检必须在依赖安装、前端构建和服务重启之前失败，避免非法配置产生部分
部署。

## 安全边界

不安全模式只能解决浏览器不发送 `Secure` Cookie 导致的 401，不能保护
认证流量。由于站点直接暴露公网，攻击者只要能够观察客户端与服务器之间的
网络流量，就可能读取会话 Cookie 并冒用账号。

仍然有效的防护：

- `HttpOnly` 限制页面脚本读取 Cookie。
- `SameSite=Lax` 降低部分跨站请求携带 Cookie 的机会。
- 服务端会话过期、撤销、密码修改和登录限流保持有效。

不再具备的防护：

- Cookie 传输机密性。
- 页面、密码和 API 响应的传输机密性与完整性。
- 对中间人篡改前端代码或网络响应的防护。

临时运行建议将 `AUTH_SESSION_IDLE_SECONDS` 调整为 1800，将
`AUTH_SESSION_ABSOLUTE_SECONDS` 调整为 28800，并限制管理员账号使用范围。
这些值仅作为部署建议，不写入代码默认值。

## 文档与迁移

`.env.example` 和部署文档需说明：

- HTTPS 仍是唯一推荐的生产部署方式。
- 公网 HTTP 模式必须同时设置
  `ALLOW_INSECURE_AUTH_COOKIE=true` 和 `AUTH_COOKIE_SECURE=false`。
- `ALLOW_INSECURE_CORS` 不能替代认证 Cookie 开关。
- 获取域名和证书后，恢复：

```dotenv
ALLOW_INSECURE_AUTH_COOKIE=false
AUTH_COOKIE_SECURE=true
```

恢复 HTTPS 后重新部署，并清除浏览器中的旧 `ad_session` Cookie 后重新
登录。

## 测试

后端配置测试覆盖：

- 生产环境默认继续拒绝 `AUTH_COOKIE_SECURE=false`。
- 生产环境显式开启专用开关后允许 `AUTH_COOKIE_SECURE=false`。
- 开关为 `true` 且 Cookie 仍为 `Secure` 时允许启动。
- 环境变量缺失时默认关闭。
- 两个 Cookie 安全变量的严格布尔解析接受小写 `true`/`false`，拒绝别名
  和大小写变体。
- CORS 与 `SITE_ORIGIN` 的现有生产校验不受影响。

认证 API 测试覆盖：

- 不安全显式模式下登录响应的 `ad_session` 包含 `HttpOnly`、
  `SameSite=Lax` 和 `Path=/`，且不包含 `Secure`。
- 默认生产安全模式下登录响应继续包含 `Secure`。
- 401 清理 Cookie 与登录 Cookie 使用一致的 `Secure` 属性。

部署脚本测试覆盖：

- 默认安全组合部署成功。
- 显式不安全组合部署成功并输出警告。
- `AUTH_COOKIE_SECURE=false` 但缺少专用开关时，在安装和重启前失败。
- 专用开关为 `false` 时同样失败。
- 两个变量的大写值、布尔别名和非法值失败。
- 专用开关为 `true` 且 Cookie 仍安全时部署成功且不输出不安全模式告警。

验证命令包括后端配置与认证 API 测试、部署脚本测试、Ruff、shell 语法检查
和前端现有检查。完成部署后，通过公网 HTTP IP 登录，并验证
`POST /api/auth/login` 与紧随其后的 `GET /api/auth/me` 均返回 200。

## 发布与回滚

发布顺序：

1. 合入代码、测试、模板和文档。
2. 在生产 `.env` 中设置显式不安全组合。
3. 执行部署脚本，确认预检警告与健康检查通过。
4. 清除浏览器旧 Cookie，重新登录并验证 `/api/auth/me`。
5. 检查 TLS 中登录与认证请求状态，不记录会话令牌。

回滚时恢复 `AUTH_COOKIE_SECURE=true` 并重新部署。获得 HTTPS 后关闭
`ALLOW_INSECURE_AUTH_COOKIE`，保持默认安全模式；最终可删除临时开关支持，
但这不属于本次改动范围。
