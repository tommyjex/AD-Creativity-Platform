# Debug Session: layer-decomposition-parse
- **Status**: [OPEN]
- **Issue**: `image_to_image-bc25075c-bd1d-4e69-a45f-4848d36f1ded` 在首次尝试后以 `provider_code=UnknownProviderError; phase=layer_decomposition_parse` 失败。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-layer-decomposition-parse.ndjson`

## Reproduction Steps
1. 在 AIGC Pipeline 中执行包含图层拆分的 `image_to_image` 节点。
2. 等待 Provider 任务完成并进入图层拆分结果解析阶段。
3. 观察节点在 `layer_decomposition_parse` 阶段失败。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Provider 成功响应中没有可识别的图片 URL | High | Low | Rejected: 17 项均有 HTTP(S) URL |
| B | Provider 返回的名称、描述或边界框元数据不符合严格校验 | High | Medium | Confirmed: 绝对坐标基于 Provider 输出尺寸，而解析器使用输入尺寸校验 |
| C | Provider 只返回一张图片，不满足底图加图层契约 | Medium | Low | Rejected: 返回 1 张底图和 16 个连续图层 |
| D | Provider 返回明确错误，但错误码提取失败 | Medium | Low | Rejected: Provider 返回成功对象，错误由本地解析器生成 |
| E | 下载或后处理异常被错误归类到解析阶段 | Low | Medium | Rejected: 失败发生在下载前的响应解析 |

## Log Evidence
- Persisted run `9ee33076-dcca-4aed-8554-5ead88ea47f8` failed on task `e193b373-69de-4a55-9ed2-5784f861750f`.
- Provider execution ran from `2026-09-04T01:13:40Z` to `2026-09-04T01:16:27Z`.
- Persisted error contains only `provider_code=UnknownProviderError; phase=layer_decomposition_parse`; request ID is absent.
- Existing application logs do not contain the parser branch or a sanitized response-shape summary.
- Pre-fix log line 1: Provider 返回 `ImagesResponse`，`data` 为 17 项列表；`z_index` 为连续整数 0-16，所有 URL 均为 HTTP(S)，16 个前景项均包含字典型 `bounding_box`。
- 第二次 pre-fix 复现返回 16 项；名称、描述、URL、连续层级和归一化框均有效。
- 输入资产为 `1464×600`，Provider 绝对框最高达到 `1507×656`；归一化坐标对应的 Provider 输出画布约为 `1600×656`。当前解析器错误地以输入尺寸限制绝对框，导致合法的等比例输出被判定越界。

## Verification Conclusion
根因已确认：`size=auto` 时 Provider 会保持宽高比但将拆层画布缩放到模型输出尺寸；解析器和持久化层错误地要求输出像素坐标及底图尺寸与输入资产完全一致。

Pre-fix 与 post-fix 对照：

- Pre-fix：输入 `1464×600`，Provider 返回约 `1600×656` 坐标系，任务在 `layer_decomposition_parse` 失败。
- Post-fix：运行 `f9f14167-c977-4f32-988b-58d4b7e2c914` 成功，生成 `1600×656` 图层集及 15 个前景图层。
- 修复后仍按下载后的真实底图尺寸检查绝对框边界，并要求输出与源图宽高比误差不超过 1%。
- 定向回归：`backend/tests/test_image_layers.py` 55 项通过，`backend/tests/test_aigc_gateway.py` 62 项通过。
- 全量回归：959 项中 958 项通过；`test_last_frame_content_endpoint_redirects_and_returns_not_found` 因测试环境未配置 `ARK_API_KEY` 失败，与本次图层改动无关。加载真实 `.env` 会让测试生命周期连接实际运行环境并挂起，因此已终止该不隔离的复跑。
