# Debug Session: local-text-empty-validation
- **Status**: [OPEN]
- **Issue**: 文本节点 `text-c998d23e-8ace-4be9-8dcb-d2087fd1a7a3` 执行失败，后端报告 `local text value is empty`。

## Reproduction Steps
1. 打开对应 AIGC 画布。
2. 执行包含目标文本节点的流程。
3. 目标文本节点在 validate 阶段失败。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Expected Signal |
|----|------------|------------|--------|-----------------|
| A | Run definition snapshot 中目标节点的 `config.text` 为空 | Confirmed | Low | Run #6 快照中 `text=""`，但有一条 BBox 引用。 |
| B | 节点已有文本上游，但执行器错误调用本地模态分支 | Rejected | Medium | 快照中目标文本节点无 incoming edge，确实是本地模式。 |
| C | `upstream_text_override` 或编辑器保存逻辑清空基础文本 | Rejected | Low | `upstream_text_override=null`；用户使用的是仅 BBox 说明的合法输入。 |
| D | 自动保存与创建 Run 竞态导致旧 revision 被执行 | Rejected | Medium | Run revision 265 的快照与报错节点内容一致。 |

## Log Evidence
失败 Run `00334bd1-a90d-4c6a-bbdb-e5bc569f8c42`：
- `pipeline_revision=265`
- `config.text=""`
- `bbox_references=[{instruction:"缩小人物尺寸"}]`
- 文本节点无上游连线
- 节点在 initialization 阶段失败

Pre-fix 插桩：
- `textLength=0`
- `referenceCount=1`
- `referenceInstructionLengths=[6]`
- 随后抛出 `local text value is empty`

## Verification Conclusion
根因是前后端有效输入规则不一致：前端允许基础文本为空、仅通过 BBox
坐标与引用说明构成提示词；后端 `_local_modality_result()` 却在
`_compile_bbox_prompt()` 前强制拒绝空基础文本。

修复后，仅当基础文本和 BBox 引用同时为空时才报错。Post-fix 日志确认
`textLength=0, referenceCount=1` 可继续执行，最终 BBox 编译测试通过。

验证：
- 仅 BBox 与普通文本两种编译场景：2 passed
- BBox 相关后端测试：7 passed
- 空文本且无引用仍拒绝：passed
- `git diff --check`：passed

等待用户重新执行该流程确认。
