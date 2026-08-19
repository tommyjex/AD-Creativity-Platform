# Debug Session: command-execution-hang
- **Status**: [OPEN]
- **Issue**: TRAE 中执行简单只读命令时经常长时间显示执行中，预期命令应快速结束并正确回收终端会话。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-command-execution-hang.ndjson`

## Reproduction Steps
1. 在项目根目录执行截图中的受限 `rg` 搜索命令。
2. 记录 shell 启动、`rg` 进程启动/退出、管道退出码和总耗时。
3. 同时检查是否有残留长驻进程、特殊文件或异常目录参与扫描。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 命令已结束，但客户端未正确收尾或渲染完成状态 | High | Low | Confirmed：截图命令 0.052 秒完成，工具卡片仍是用户感知的停滞点 |
| B | `rg` 命中特殊文件、符号链接或异常大文件，导致真实扫描阻塞 | Medium | Low | Rejected：仅 40 个 Python 文件、合计 684 KB，无符号链接；复测 0.019 秒 |
| C | `zsh` 启动配置或环境初始化耗时 | Medium | Low | Rejected：non-login 0.01 秒，login/interactive-login 均 0.05 秒 |
| D | 长驻进程或共享终端占用导致命令等待/被打断 | High | Low | Rejected for this command：服务进程已脱离为 PPID 1，分别监听 3000/3011/8000；无残留 `rg` |
| E | PTY/输出通道异常，进程退出状态未传回 UI | Medium | Medium | Supported：命令退出码 0，但 TRAE 工具端到端固定约 1.55 秒，慢点位于命令外的沙箱/工具编排层 |

## Log Evidence
- `.dbg/trae-debug-log-command-execution-hang.ndjson:1-2`：截图中的准确命令从开始到返回仅 0.052342 秒，pipeline exit 0。
- 独立复测：237 条匹配经 `head -80` 正常退出，`rgExit=0`、`headExit=0`，耗时 0.019228 秒。
- 后端搜索范围：40 个 `*.py` 文件，总计 684366 bytes，最大文件约 162 KB，无符号链接。
- shell 启动：`zsh -c` 0.01 秒，`zsh -lc` 与 `zsh -lic` 均 0.05 秒。
- 每个 TRAE `exec_command` 调用端到端均约 1.55 秒，显著高于命令内部耗时；进程树显示固定经过 `trae-sandbox -> bash -> bash -> command` 包装。
- 当前长驻服务：Next dev `127.0.0.1:3000`、Next start `127.0.0.1:3011`、Uvicorn `127.0.0.1:8000`，均为独立监听进程，不占用本次命令会话。
- Post-fix：改用受限目录、直接限制匹配数并设置 10 秒工具超时后，命令 0.023460 秒完成，exit 0。

## Verification Conclusion
根因不在截图中的 `rg`，也不在项目文件规模。用户看到的“卡住”发生于 TRAE 的沙箱/PTY/工具结果回传或 Agent 编排阶段；截图标题“命令已执行”本身表示 shell 已结束。此前将开发服务器作为前台命令启动会留下长期运行的统一 exec session，这会放大此类感知，但现存服务已脱离终端，并非本次 `rg` 的阻塞源。

执行侧规避策略：
1. 所有短命令设置 10–30 秒工具超时并限制搜索目录/文件类型。
2. 长驻服务只在独立 PTY 会话启动，拿到 session ID 后不等待其结束。
3. 不重复启动已有端口服务；先检查监听端口。
4. 一个工具调用只做一类任务，避免将长驻服务与短命令混在同一调用。
