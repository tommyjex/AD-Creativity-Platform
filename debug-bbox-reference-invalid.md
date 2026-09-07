# Debug Session: bbox-reference-invalid
- **Status**: [OPEN]
- **Issue**: 文本节点中的图片框选引用显示“引用来源已失效”，但画布上对应图片节点仍存在且可预览。

## Reproduction Steps
1. 打开包含图片精准编辑引用的 AIGC 画布。
2. 选中文本节点。
3. 查看基础文本中的引用标签。
4. 观察图片节点仍存在，但标签显示“引用来源已失效”。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Evidence |
|----|------------|------------|----------|
| A | 引用保存的 source node ID 与当前图片节点 ID 不一致 | Rejected | 日志中引用 ID 与现存图片节点 ID 完全一致。 |
| B | 节点重新创建或定义迁移后 ID 变化，引用未同步迁移 | Rejected | 引用来源节点存在，类型为 `image`，共同下游连线仍存在。 |
| C | 引用校验只检查错误的节点集合或局部文本状态 | Confirmed | 来源节点 `bbox=null`，但 `upstream_bbox=(450,168)-(614,912)`；编辑器仅读取前者。 |
| D | Run 快照、编辑态定义或自动保存版本不一致 | Rejected | pre-fix 日志中的编辑态定义同时包含引用、来源节点及有效上游 BBox。 |

## Log Evidence
`pre-fix` 日志确认：
- `sourceExists=true`
- `sourceNodeId=image-2fe56daa-ef34-441d-a437-8430f1ea674a`
- `sourceType=image`
- `bbox=null`
- `upstreamBbox={x1:450,y1:168,x2:614,y2:912}`
- `upstreamBboxAssetId=b09e636d-a6e5-4b89-a6a6-2f0f421dd876`
- 来源图片节点存在上游图片连线

## Verification Conclusion
根因是提示词编辑器固定读取本地 `config.bbox`，没有根据图片节点的
local/upstream 模式读取对应 BBox 绑定，也没有结合当前 Run 资产 ID 校验
上游绑定。因此有效上游框选被误显示为“引用来源已失效”。

已实施修复：
- 提示词编辑器使用 `projectAigcImageBboxBinding()` 解析当前模式的 BBox。
- 上游模式结合当前 Run 的实际 `asset_id` 校验绑定，只有匹配时显示坐标。
- 仅文本节点接入上游时暂停引用；有效上游图片引用不再错误暂停。

Post-fix 日志确认：
- `bindingState=valid`
- `effectiveBbox={x1:450,y1:168,x2:614,y2:912}`
- UI 回归断言不再出现“引用来源已失效”或“已暂停”

验证结果：
- BBox/Prompt/Projection 定向测试：25 passed
- Post-fix 上游引用测试：1 passed
- TypeScript：passed
- 相关文件 ESLint：passed
- `git diff --check`：passed

等待用户确认后清理插桩与调试环境。
