# Task 6 验收记录

验收日期：2026-10-23

## 真实冒烟状态

- 未设置 `RUN_PAID_MODELARK_SMOKE=true`。
- 未执行真实 ModelArk Files API 或 Responses API 调用。
- 未验证真实 `doubao-seed-evolving` 模型效果。
- 真实冒烟测试默认跳过；只有开关为 `true`，且视频 URL、ModelArk
  凭据、默认模型和 FFprobe 均配置完整时才会构造下载器和 Provider Client。
- 冒烟成功输出仅包含模型、视频宽高/时长、片段数、Token、延迟和边界校验，
  不包含 URL、密钥或字幕全文。

## 自动化结果

- 功能与配置套件：`220 passed, 1 skipped, 4 warnings`。
- ModelArk、媒体探测、MediaKit 字幕、认证与路由回归：
  `368 passed, 7 warnings`。
- 两组测试均在进程级 TCP 外联守卫下执行：
  `external_socket_attempts=0`。
- 付费冒烟单文件：`3 passed, 1 skipped, 1 warning`。
- Ruff 致命错误检查：
  `.venv/bin/python -m ruff check --select E9,F63,F7,F82 backend` 通过。
- 编译检查：
  `.venv/bin/python -m compileall -q backend/app backend/tests` 通过。
- 空白错误检查：`git diff --check` 通过。

## 全量后端测试

- 结果：`1898 passed, 1 skipped, 1 failed, 41 warnings`。
- 唯一失败：
  `backend/tests/test_structured_logging.py::test_business_code_has_no_local_debug_reporting_dependencies`。
- 失败原因：
  `backend/app/services/aigc_gateway.py` 包含指向 `127.0.0.1:7777` 的临时调试上报。
- `git status` 和 `git diff` 确认该文件当前无未提交改动；`git blame` 确认相关代码
  来自 2026-10-11 已提交的 commit `6bbf9ce`，早于本轮 Task 6。
- 本轮未回滚该既有代码。该失败属于独立的全仓日志守卫残余风险，不影响上述
  字幕定位功能、相关回归和离线调用守卫的通过结论。

## 字幕样式契约

- API 响应新增 `visual_role`、`font_height_ratio`、`alignment`、
  `block_id` 和 `line_index`。
- 模型输出约束支持 `headline`、`body`、`footnote` 三级视觉角色，并要求保留
  小号说明、脚注及多行字幕分组。
- 非法样式字段逐项降级，合法文字、时间和 BBox 不受影响。
- 非法核心片段会被计数并跳过；非空响应中的全部片段均无效时保持失败。
- 历史结果缺少样式字段时使用确定性默认值和 BBox 字高回退。
- 完成事件仅记录无内容的聚合统计，不记录字幕文字、BBox 或块 ID。
- 字幕范围非计费回归：`152 passed, 1 skipped, 4 warnings`。
- 新增日志白名单测试通过；结构化日志全文件仍受上文既有
  `127.0.0.1:7777` 调试依赖失败影响。
- 本轮全量后端回归：`1913 passed, 1 skipped, 1 failed, 41 warnings`；唯一失败
  仍为上文既有本地调试依赖守卫。
- Ruff、`.venv/bin/python -m compileall -q backend/app` 和
  `git diff --check` 均通过。
- 实现阶段未设置 `RUN_PAID_MODELARK_SMOKE=true`，自动化测试未产生真实模型
  调用费用。

## 字幕样式真实验证：英文字幕测试 7

- 用户明确要求使用本地视频执行真实字幕提取后，调用
  `doubao-seed-evolving` Files API 和 Responses API。
- 视频：1920x1080，40.92 秒，75 MB；`sampling_fps=2.0`。
- 结果：12 条字幕，0 条无效片段，无样式字段降级。
- 角色：`headline=1`、`body=11`、`footnote=0`。
- Token：输入 33,538，输出 1,059，总计 34,597。
- 多行字幕均按视觉行拆分，并通过 `block_id` 和 `line_index` 保持关联。
- 完整规范化结果：
  `real-test-result-2026-10-23-test7.md`。
