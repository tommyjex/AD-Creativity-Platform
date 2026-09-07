# Debug Session: aigc-image-preview-broken
- **Status**: [OPEN]
- **Issue**: AIGC 画布运行中，原图片节点缩略图变为破图，无法预览；预期运行状态不影响原始输入资产预览。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-aigc-image-preview-broken.ndjson`

## Reproduction Steps
1. 打开包含多个本地图片节点的 AIGC 画布。
2. 点击运行，使下游图片模型进入运行中。
3. 观察原图片节点缩略图是否变为破图。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Run 投影用缺少访问 URL 的快照资产覆盖原图片资产 | Confirmed | Low | 三个本地图片节点均从 Run 投影取得 TOS 原始 URL，并触发 `onError`。 |
| B | 节点仍使用运行前签名 URL，运行期间签名失效 | Rejected | Low | 失败 URL 不是签名 URL，而是数据库中的永久对象地址；直接请求返回 403。 |
| C | URL 安全过滤或相对地址拼接产生无效 src | Rejected | Low | URL 未被过滤或错误拼接；同资产 API 代理返回 200，TOS 原始地址返回 403。 |
| D | 运行轮询导致节点在本地资产和运行资产之间错误切换 | Partially confirmed | Medium | Run 投影确实覆盖了本地查询结果，但失败不依赖轮询切换，根因是投影持久化了原始 URL。 |

## Log Evidence
Pre-fix 日志记录到三个本地图片节点的最终 `mediaUrl` 均为
`https://xujianhua-utils.tos-cn-beijing.volces.com/...`，随后全部触发
`NodeImageMedia:onError`。同页上游结果使用
`http://localhost:8000/api/assets/{id}/content`，成功触发 `onLoad`。

独立 HTTP 探测确认同一资产：
- `/api/assets/{id}/content` 返回 `200 image/png`
- TOS 原始对象 URL 返回 `403 application/json`

根因位于 `AigcPipelineRuntime._local_modality_result()`：本地模态结果将
`asset.url` 原样写入 Run 快照，遗漏了其他生成路径使用的
`asset_storage.with_access_url()`。

## Instrumentation Plan
1. `AigcFlowNodeComponent`: 上报图片节点运行投影、本地资产和最终 media URL。
2. `NodeImageMedia onLoad`: 上报成功加载的最终 URL 与图片尺寸。
3. `NodeImageMedia onError`: 上报失败 URL、浏览器 currentSrc 和节点标题。

## Verification Conclusion
已实施双层修复：
1. 后端新 Run 的本地模态结果通过 `with_access_url()` 写入代理 URL。
2. 前端按 Run 结果的 `asset_id` 构造内容代理 URL，兼容已落库的旧 Run。

Post-fix 浏览器验证：
- 三个本地图片节点最终 URL 均为
  `http://localhost:8000/api/assets/{asset_id}/content`
- 三个本地图片节点及一个上游图片节点全部触发 `onLoad`
- 图片自然尺寸分别为 `2196x1200`、`2196x1200`、`1180x1500`、
  `2196x1200`
- 未记录任何 `onError` 或图片网络请求失败

Pre-fix 对比：3 个本地节点使用 TOS 原始 URL并全部 `onError`；
post-fix 使用资产代理 URL，4 个图片节点全部 `onLoad`。

自动化检查：
- Frontend Vitest: 23 passed
- Frontend TypeScript: passed
- Backend pytest: 2 passed
- `git diff --check`: passed
- Browser screenshot: `/tmp/aigc-image-preview-post-fix.png`

等待用户确认修复结果后清理插桩与调试环境。
