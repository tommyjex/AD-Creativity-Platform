# Debug Session: video-prompt-optimization-failure
- **Status**: [OPEN]
- **Issue**: 生视频目标的 AIGC 提示词优化返回“服务暂时不可用 / AIGC prompt optimization failed”。
- **Debug Server**: Pending startup
- **Log File**: `.dbg/trae-debug-log-video-prompt-optimization-failure.ndjson`

## Reproduction Steps
1. 在 AIGC 画布文本节点打开“优化提示词”。
2. 目标模型选择“生视频”，输入优化方向后点击“开始优化”。
3. 观察到统一 502 错误提示。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 视频优化模型的输出无法按当前结构解析 | High | Low | Pending |
| B | Provider 调用本身失败或被限流 | Medium | Low | Pending |
| C | 视频提示词结果在服务层校验时失败 | Medium | Low | Pending |
| D | 当前 8000 后端仍运行旧代码或读取了遗留调试配置 | Low | Low | Pending |

## Log Evidence
Pending runtime collection.

## Verification Conclusion
Pending.
