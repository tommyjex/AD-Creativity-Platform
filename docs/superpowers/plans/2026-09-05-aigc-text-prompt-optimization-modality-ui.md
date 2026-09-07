# AIGC 文本提示词优化与模态节点 UI 实施计划

**目标：** 将文本节点提示词优化升级为目标感知流程，并实现上游文本节点级覆盖，同时简化模态节点来源与下载 UI。

**范围：** 严格遵循 `.trae/specs/enhance-aigc-text-prompt-optimization-modality-ui/`。保持 Pipeline schema v2，不新增数据库迁移，不改变模型生成接口，不调用真实计费 Provider 进行测试。

## 1. 契约与迁移

- 在后端 `TextConfig` 和前端 `TextConfig` 增加 `upstream_text_override`，仅 `null` 表示无覆盖，保留空字符串和纯空白。
- 扩展 definition migration、新节点默认值、共享 fixture 和 API 往返测试。
- 将 `/api/aigc/prompts/optimize` 改为按 `target_type` 判别的统一请求：
  - `llm`：模型和 system prompt。
  - `text_to_image` / `image_to_image`：模型、操作模式、尺寸、参考图数量和 BBox 引用说明。
  - `video_generation`：模型、生成模式、`task_type`、时长、画幅、音频开关和稳定排序的素材摘要。
- 固定响应为 `optimized_text` 与 `optimized_reference_instructions`。

## 2. 后端优化策略与校验

- 在 `modelark.py` 定义统一优化 Provider 请求和 LLM、Seedream、Seedance 三类消息构造器。
- Mock adapter 返回确定性、可测试结果；BytePlus adapter 继续使用结构化 JSON 输出。
- 在独立服务模块实现受保护字面量提取：
  - BBox token、成对引号、反引号、URL、宽高比、带单位数字。
  - 按起点、最长匹配和类别优先级确定结果，保留重复次数与原始 code point。
- Provider 响应在写回前校验：
  - 目标类型与响应数组形状。
  - 生图 BBox 引用数量、顺序和安全 token。
  - 原文本及每条引用说明的受保护字面量。
- 路由统一映射 Provider/解析失败，不持久化 Pipeline 或创建任务。

## 3. 上游文本覆盖运行时

- 在模态投影阶段先验证上游结果成功可用，再用 override 替换文本结果和 digest。
- `_expected_input_hashes` 对有入边且 override 非 `null` 的文本使用 override digest；无入边仍使用本地 `text`。
- 执行计划传播“存在重算中的可执行祖先”，防止跨文本中继错误复用下游缓存。
- 新增前端有效文本投影，当前 override 覆盖所有 Run 视图；清除后恢复当前所选 Run 的直接上游结果。
- 保持上游失败、取消、超时和 unavailable 的阻塞语义，不以 override 回退。

## 4. 前端优化弹窗

- 从当前未保存 definition 中推导直接连接到 `prompt` 的支持目标，按节点显示名称逐项列出。
- 弹窗包含只读文本摘要、优化方向、目标选择、错误与 loading 状态。
- 请求快照覆盖文本、override、所选 Run、方向、目标配置、相关边、BBox 和素材摘要；任一变化时丢弃响应。
- 生图将文本和 BBox 引用说明原子写回；LLM/视频仅写回文本。
- 本地模式写入 `text`，上游模式写入 `upstream_text_override`；无变化不创建历史。

## 5. 模态详情与下载 UI

- 移除卡片和详情中的“本地 / 上游”可见标签及来源说明。
- 上游文本显示有效文本并允许编辑；有 override 时提供“恢复上游文本”。
- 上游图片、视频、音频不显示上传和资产库编辑操作。
- 从图片和视频节点标题栏移除下载按钮；详情栏保留安全下载。音频节点与结果面板行为不变。

## 6. 验证

- 后端：schema、migration、route、ModelArk、DAG、executor、pipeline 定向测试，再运行完整 pytest。
- 前端：migration、store、projection、prompt editor、editor、flow node、API client 定向测试，再运行 Vitest、TypeScript、ESLint 和 production build。
- Playwright：使用 Mock Provider 在 `1440x900`、`1023x768`、`390x844` 验证目标选择、覆盖恢复、媒体禁用、详情下载、无标签和无重叠；审计网络无真实计费请求。
