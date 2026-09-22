# Debug Session: prompt-safety-rejection
- **Status**: [RESOLVED]
- **Issue**: 提示词优化返回 `Optimized prompt could not safely preserve required constraints`
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-prompt-safety-rejection.ndjson`

## Reproduction Steps
1. 在 AIGC 文本节点打开“优化提示词”。
2. 选择下游生图目标并提交优化。
3. API 返回 422，前端显示安全约束保留失败。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 局部编辑输出遗漏原图锚定、编辑动作或保持语义 | High | Low | Rejected: provider returned `full_design` |
| B | 受保护字面量、颜色、主体或 canonical anchor 被漏掉或改写 | High | Low | Confirmed: canonical anchor omitted or misplaced |
| C | 输出新增未请求的对象数量 | Medium | Low | Inconclusive: validation stopped before quantity checks |
| D | 模式联合或引用数量/顺序不合法 | Medium | Low | Rejected as primary cause: union was valid; extra reference is safely discardable |
| E | full_design 软校验被错误升级为硬失败 | Low | Medium | Rejected: canonical anchors are hard constraints |

## Log Evidence
Instrumentation added in `backend/app/services/generation.py`:

- D: Provider result type, mode, reference counts, and source-image availability.
- A-B-C-E: Successful render boundary and output sizes.
- A-B-C-D-E: Exception class and sanitized validation reason.

Pre-fix evidence:

- Line 1: `image_to_image`, `full_design`, valid discriminated result, source image present.
- Line 1: input references `0`, provider references `1`; this is not the thrown failure.
- Line 2: `PromptOptimizationSafetyError` with reason `AIGC image prompt omitted or misplaced canonical anchor`.

## Verification Conclusion
Root cause confirmed: the provider omitted or misplaced a backend-generated canonical
constraint anchor in a `full_design` response. The strict validator rejected the whole
optimization instead of deterministically restoring the server-owned anchor.

## Fix

- Normalize each expected server-owned canonical anchor into its required section.
- Identity and quantity anchors move to the preferred positive section.
- Exclusion anchors move to the final section.
- Missing brands, models, quoted copy, colors, ratios, and recoverable literals are
  deterministically restored with structured warnings.
- Added or rebound object quantities are accepted with
  `unrequested_object_quantity` warnings.
- BBox changes, forged references, unknown canonical markers, direct exclusion
  reversal, malformed output, and oversized output remain hard failures.
- Temporary HTTP instrumentation was removed after evidence collection.

## Final Verification

- Prompt optimization unit tests: `42 passed`.
- Prompt optimization, ModelArk, and route tests: `247 passed`.
- Backend full suite: `1384 passed`.
- Python compile check: passed.
- Ruff was unavailable in the project environment.
