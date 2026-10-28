# 最终验收复核

日期：2026-10-26。仅验收测试、脚本和文档所有权；不修改产品代码，不提交或部署。
本记录优先于 `validation.md` 中的历史运行结论；历史失败不删除。

## 当前状态

- 后端最终全量通过：`2174 passed, 1 skipped, 42 warnings`，153.20秒，退出码0。
  命令：`PYTHONPATH=.:backend .venv/bin/python scripts/verify-subtitle-translation-offline.py backend/tests -q --tb=short`。
  无 `-k`、无日志守卫排除；唯一skip为禁用的计费冒烟，42条为既有Starlette弃用警告。
  `paid_smoke_enabled=false`、`tcp_connections_allowed=0`、`blocked_tcp_attempts=0`。
  含日志守卫、TLS-only/stdout隔离、初始化失败清理、字幕/工具/RBAC/双仓储、
  MediaKit恢复/转存/幂等与全量既有功能回归；不另行重复这些已通过测试。
- 全 backend Ruff 致命检查 `E9,F63,F7,F82`、app/tests compileall、
  `git diff --check` 本次通过。
- 前端收尾代理 `arun_6adee07b81abfce530954d9d` 已完成任务7/9/10并勾选交接。
  所有者最终定向6文件84项通过，含font-contract；tsc/lint/build/diff通过，
  隔离构建后恢复标准生成引用并再次tsc通过。按主会话要求不重复这些命令。
- 本次独立前端最终全量：`83 files passed, 1021 tests passed`，18.75秒，退出码0。
  命令（frontend）：`npm run test -- --reporter=dot`，无排除，包含CN/JP固定
  revision/font-contract、warning中文、字号/实际字体元数据、上传与既有工具回归。
  既有React act警告不属于失败；未修改相关无关产品/测试。
- 本次最终Mock浏览器六场景全部通过：1440x900、834x1112、390x844，
  每档Creator 68次、Viewer 8次业务请求；debug=0、未知API/外部请求=0。
  字体请求各档Creator/Viewer为1/1、2/1、2/1，均返回本地OFL夹具。
  仅允许固定CN/JP/世纪哥特体字体URL，SC不再在Mock允许列表中。
  新增中文缩字号警告断言通过；原文保护、未保存preview、冲突/刷新、局部重试、
  render重试、结果隔离、原生controls/object-contain与无水平溢出均通过。
- 两个辅助服务退出码0并全部停止；8058/3058无监听。
  `git diff -- frontend/tsconfig.json frontend/next-env.d.ts`为空；
  本次没有手工修改或回滚产品代码、Next配置或其他dirty。
- 清单42/43项通过，仅第32项未勾；任务3及上传子项、任务11第三项及整体已完成。
  任务8的自动化子项全部完成，但当前规格下整体严格验收仍未通过，不能称全部验收通过。

## 第 32 项证据分层

规格的容量、字形锚点和纯文本解释要求保持不变，不以警告或 Mock 降低要求。

| 子范围 | 证据状态 | 可证明的事实 |
| --- | --- | --- |
| 官方字段契约已核对 | 已核对文档 | 官方 API `https://docs.volcengine.com/docs/6448/2673861` 与用法 `https://docs.volcengine.com/docs/6448/2673939`；文字 font URL、整数像素字号、RGBA、transform 显示区域左上角、横排对齐、`line_max_width=-1`、轨道时间互斥；详见 `task5-validation.md` |
| 已公开限制与本地映射 | 文档及离线测试证据，不是实渲 | canvas 160..8192；十条限制针对 subtitle 文件轨，不能套到 text/general tracks；编译器不机械套用编辑器 20 轨/200 元素、不静默截断；500/4000 仅为工具边界 |
| text/general 容量 | 供应商未公开，未验证 | 没有已确认的字符/元素/general-track 上限；201 text/202 track 编译通过不证明服务接收；需供应商书面契约与显式授权容量验证 |
| vertical glyph anchor | 供应商未公开，未验证 | display-region 左上角不等于字形 baseline/padding/垂直锚点；Pillow 测量不证明供应商最终字形位置；需契约澄清及真实成片比对 |
| literal grammar | 供应商未公开，未验证 | JSON roundtrip 仅证明本地字符串未改变，不证明 ASS/HTML 外观文本被供应商按字面解释；需契约澄清及授权真实渲染 |

主会话最新决定：如实交付已完成实现和验证缺口，第32项继续未勾，不再请求审批或
付费调用。规格范围未降低；在当前批准规格下，第32项及任务8整体严格验收不通过。
上述“需真实验证”仅描述缺口消除所需证据，不是本轮执行或授权请求。
未获得真实Seed/MediaKit授权，不发起提交、轮询或其他真实供应商调用。

## 证据边界

SQL 使用 SQLite 夹具执行 MySQLRepository，不代表生产 MySQL 多进程锁/部署已验证。
512 MiB/600 秒为配置、流式协议与离线边界测试，未真实传输 512 MiB。
真实 Seed 识别/翻译/背景色、供应商非 30 FPS、字形/音轨/旋转最终效果、
云存储与实际供应商任务恢复仍未验证。普通 Mock 成功不替代这些事实。

## 前端复现与归属

`SY_Black` 已为后端同一固定提交的CN文件，JP/版本一致。以下full/browser为本次
独立执行；定向/tsc/lint/build沿用任务7/9/10所有者最终证据，不冒称本次重复执行。

```sh
npm --prefix frontend run test -- --reporter=dot
NEXT_TELEMETRY_DISABLED=1 .venv/bin/python /Users/bytedance/.trae-cn/skills/webapp-testing/scripts/with_server.py --server '.venv/bin/python scripts/verify-subtitle-translation-browser.py --serve-fixture' --port 8058 --server 'env NEXT_TELEMETRY_DISABLED=1 BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8058 NEXT_DIST_DIR=.next npm --prefix frontend run dev -- --webpack --hostname 127.0.0.1 --port 3058' --port 3058 --timeout 120 -- .venv/bin/python scripts/verify-subtitle-translation-browser.py
```

三视口为1440x900、834x1112、390x844；六个Creator/Viewer场景必须真实通过，
未知API/外部请求/debug均为0。字体请求只返回本地夹具，不连接供应商或生产后端。
本次使用既有`.next`，没有新增tsconfig验收目录include，也未与实施代理并行
运行Next生成命令。原独立dist历史启动流程见`validation.md`。
脚本py_compile及Ruff致命检查通过；最终diff空白检查通过，
复选框核对为42通过/1未验证，任务3/11完成、任务8整体未通过。
