# 关闭 Seed 思考模式并流式输出文本生成计划

## Summary

本次改造包含两个目标：

1. 所有“生成文本提示词/文本内容”的 Seed 模型调用显式关闭思考模式，统一传入：

   ```python
   thinking={"type": "disabled"}
   ```

2. 将故事、剧本、分镜脚本以及分镜视频提示词 AI 优化改为真正的流式输出，让用户在对应内容区域或提示词编辑框中实时看到生成文本，而不是等待完整 JSON 返回。

用户已确认以下产品决策：

- 流式中间内容仅用于前端展示，完整响应校验成功后才一次性写入数据库。
- 点击生成故事、剧本或分镜脚本后，自动切换到对应标签页。
- AI 优化结果直接流入提示词 textarea；失败时恢复点击前草稿。
- 原故事、剧本、分镜脚本、AI 优化接口直接改为 SSE，不保留原 JSON 响应，属于有意的破坏性接口变更。
- 文本阶段失败任务重试也采用流式输出。
- 默认分镜视频提示词继续使用本地模板即时生成；只有“AI 优化”调用 Seed 并流式输出。

## Current State Analysis

### Seed 调用

主要实现位于 `backend/app/services/modelark.py`：

- `BytePlusModelArkAdapter.generate_text()`
  - 无图片输入时调用 `client.chat.completions.create(...)`
  - 有图片输入时调用 `client.responses.create(...)`
  - 覆盖故事、剧本和分镜脚本
  - 当前未传 `thinking`，当前为非流式
- `BytePlusModelArkAdapter.generate_characters()`
  - 调用 `client.chat.completions.create(...)`
  - 模型输出角色名称与 `description`，该描述即角色形象/生图提示词
  - 当前未传 `thinking`，本需求只要求关闭思考，不要求该流程流式展示
- `BytePlusModelArkAdapter.optimize_video_prompt()`
  - 调用 `client.chat.completions.create(...)`
  - 当前未传 `thinking`，当前为非流式
- `edit_character_image()`、`regenerate_character_image()` 和 `generate_video()` 分别调用 Seedream/Seedance 生成接口，不属于 Seed 文本思考模式参数适用范围，不传 `thinking`。

本地安装的 `byteplus-python-sdk-v2 3.0.58` 已确认：

- Chat Completions 和 Responses API 均支持 `thinking`
- `thinking.type` 支持 `disabled`
- 两个接口均支持 `stream=True`
- SDK 提供 `AsyncArk`、`AsyncStream`
- Responses 流式文本事件类型为 `response.output_text.delta`
- Chat 流式文本位于 `chunk.choices[0].delta.content`

### 后端生成流程

位于 `backend/app/api/routes.py`：

- `POST /api/projects/{project_id}/story`
- `POST /api/projects/{project_id}/script`
- `POST /api/projects/{project_id}/storyboard`
- `POST /api/projects/{project_id}/storyboard/shots/{shot_id}/optimize-video-prompt`
- `POST /api/tasks/{task_id}/retry`

故事、剧本和分镜脚本当前通过 `_run_stage()` 同步等待 ModelArk 完成，最后返回 `GenerationTask` JSON。AI 优化直接等待并返回 `{optimized_prompt}` JSON。

模型被要求输出 JSON：

- 故事/剧本：`title`、`content`
- 分镜脚本：`title`、`content`、`storyboard_shots`
- AI 优化：`optimized_prompt`

因此不能把供应商原始 token 直接显示到前端，否则用户会看到半截 JSON。需要在后端流式解析目标 JSON 字符串字段，只向前端发送干净正文。

### 前端状态

- `frontend/lib/api-client.ts` 的 `generateStage()`、`retryTask()`、`optimizeStoryboardShotVideoPrompt()` 当前都按 JSON 响应处理。
- `frontend/components/workspace/project-workspace.tsx` 的 `ProjectDetail` 持有 `activeDetailTab`，适合作为文本流状态的上层协调点。
- `frontend/components/workspace/workspace-creative-workflow.tsx` 负责六阶段生成/重试入口。
- `frontend/components/workspace/project-detail-tabs.tsx` 负责故事、剧本、分镜脚本内容区及空状态生成按钮。
- `frontend/components/workspace/storyboard-video-workspace.tsx` 负责 AI 优化按钮和提示词 textarea。

## Proposed Changes

### 1. 建立统一流式事件协议

#### 后端事件格式

相关 POST 接口直接返回 `StreamingResponse(media_type="text/event-stream")`。事件统一使用 SSE：

```text
event: task
data: {"task": {...}}

event: delta
data: {"text": "增量正文"}

event: complete
data: {"task": {...}}

event: error
data: {"code": "...", "message": "...", "detail": "..."}
```

AI 优化不创建任务，使用：

```text
event: delta
data: {"text": "增量优化提示词"}

event: complete
data: {"optimized_prompt": "完整且已校验的提示词"}
```

响应头增加：

- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no`

所有事件数据通过 `json.dumps(..., ensure_ascii=False)` 编码，禁止手工拼 JSON。

#### 新文件：`backend/app/services/text_streaming.py`

新增以下职责：

- `StreamEvent`/事件序列化辅助函数
- `IncrementalJsonStringExtractor`
  - 接受任意边界的模型字符串 chunk
  - 从 JSON 中增量提取指定字符串字段
  - 正确处理 `\"`、`\\`、`\n`、`\uXXXX` 和跨 chunk 转义
  - 故事/剧本/分镜脚本提取 `content`
  - AI 优化提取 `optimized_prompt`
- 供应商异常转为脱敏 `error` 事件

不得把 API Key、签名 URL、供应商原始响应或 traceback 放入 SSE。

### 2. Seed 文本调用统一关闭思考

#### 文件：`backend/app/services/modelark.py`

定义共享常量：

```python
SEED_THINKING_DISABLED = {"type": "disabled"}
```

以下每个真实模型调用均显式传入 `thinking=SEED_THINKING_DISABLED`：

- `generate_text()` 的 Chat Completions 分支
- `generate_text()` 的 Responses 多模态分支
- `generate_characters()`
- `optimize_video_prompt()`
- 对应新增的流式 Chat Completions / Responses 调用

Mock 适配器无需模拟思考过程，但测试必须验证真实适配器调用参数。

### 3. 为 ModelArk 增加异步流式能力

#### 文件：`backend/app/services/modelark.py`

扩展 `ModelArkAdapter` Protocol：

- `stream_text(request) -> AsyncIterator[ModelArkStreamEvent]`
- `stream_video_prompt_optimization(request) -> AsyncIterator[ModelArkStreamEvent]`

新增内部事件模型，区分：

- `delta`
- `completed`，携带现有 `GeneratedTextResult` 或 `VideoPromptOptimizationResult`

生产适配器：

- 保留当前同步 `Ark` client，避免扩大图片/视频现有逻辑改动。
- 新增 `AsyncArk` client 专用于流式文本。
- Chat 分支使用：

  ```python
  await async_client.chat.completions.create(
      ...,
      thinking={"type": "disabled"},
      stream=True,
  )
  ```

- Responses 多模态分支使用：

  ```python
  await async_client.responses.create(
      ...,
      thinking={"type": "disabled"},
      stream=True,
  )
  ```

- 每次收到供应商文本 chunk：
  1. 追加到完整原始 JSON buffer
  2. 输入 `IncrementalJsonStringExtractor`
  3. 仅 yield 目标字段新增的可见正文
- 流结束后调用现有 `_parse_text_payload()` 或 `_parse_video_prompt_optimization_payload()`，继续使用现有 Pydantic 校验。
- 只有完整解析成功才 yield `completed`。

Mock 适配器：

- 将确定性结果按固定小片段 yield，供本地开发和自动化测试验证真实流式 UI。
- 最终仍 yield 与非流式方法相同的完整结果。

Hybrid 适配器：

- 流式调用委托给 `character_adapter`，与现有真实文本路由保持一致。

#### 文件：`backend/app/services/generation.py`

新增工作流层流式方法：

- `stream_story(...)`
- `stream_script(...)`
- `stream_storyboard(...)`
- `stream_storyboard_shot_video_prompt_optimization(...)`

职责：

- 构建现有 request schema
- 透传干净文本 delta
- 完成后执行现有业务校验：
  - 故事/剧本转 `TextArtifactCreate`
  - 分镜校验镜头索引、总时长并生成 `StoryboardGenerationResult`
  - AI 优化执行 `validate_optimized_video_prompt`
- 保留当前非流式方法供非流式内部逻辑或测试复用，但相关 HTTP 接口不再返回旧 JSON。

### 4. 改造生成与重试接口为 SSE

#### 文件：`backend/app/api/routes.py`

将以下接口移除 `response_model` 并返回 `StreamingResponse`：

- `POST /projects/{project_id}/story`
- `POST /projects/{project_id}/script`
- `POST /projects/{project_id}/storyboard`
- `POST /projects/{project_id}/storyboard/shots/{shot_id}/optimize-video-prompt`

文本阶段流式路由流程：

1. 在返回响应前完成项目、依赖阶段、参考图片等同步校验。
2. 创建并启动 `GenerationTask`。
3. SSE 首事件发送 `task`。
4. 遍历 generation service 流：
   - `delta` 立即发给前端。
   - `completed` 时才执行现有写库逻辑。
5. 写库和 `complete_task()` 成功后发送 `complete`。
6. 模型失败、JSON 解析失败、业务校验失败或写库失败：
   - 调用 `fail_task()`
   - 发送脱敏 `error`
   - 不写入任何半成品文本产物或分镜。
7. 客户端断开触发 `CancelledError`：
   - 关闭上游 SDK 流
   - 将运行中任务标记为 `failed`，错误 detail 使用固定值 `client_disconnected`，确保现有重试入口仍可用
   - 不持久化半成品。

AI 优化流程：

- 不创建 GenerationTask，保持“不自动保存提示词”的现有语义。
- 流式发送 `optimized_prompt` 字段增量。
- 完整校验成功后发送 `complete`。
- 校验/供应商失败发送脱敏 `error`。

#### 重试接口

`POST /tasks/{task_id}/retry` 根据失败任务 stage 返回不同内容类型：

- `story`、`script`、`storyboard`：返回同一 SSE 协议，使用新的任务 ID。
- 其他阶段：保持现有 JSON `GenerationTask` 行为。

这是已确认的有意接口分支；前端必须根据已知的原任务 stage 选择 SSE 或 JSON 解析方式。

### 5. 前端 SSE 客户端

#### 文件：`frontend/lib/api-types.ts`

新增流式类型：

- `TextStreamStage = "story" | "script" | "storyboard"`
- `GenerationStreamEvent`
- `PromptOptimizationStreamEvent`
- `TextGenerationStreamState`

事件 payload 与后端 SSE 契约保持一一对应。

#### 文件：`frontend/lib/api-client.ts`

实现可测试的 POST SSE 解析器：

- 使用现有 `fetcher`
- 支持 JSON body、鉴权/默认 headers
- 检查非 2xx 响应并沿用 `ApiError`
- 使用 `response.body.getReader()` + `TextDecoder`
- 正确处理：
  - SSE 行跨网络 chunk
  - 一个 chunk 包含多个事件
  - 多行 `data:`
  - 尾部无空行
  - `error` 事件
  - AbortSignal

将以下方法改为流式消费接口：

- 文本 stage 的 `generateStage`
- 文本 stage 的 `retryTask`
- `optimizeStoryboardShotVideoPrompt`

非文本 stage 继续使用 JSON request。TypeScript 使用明确的 stage 分支/重载，禁止调用方误把 SSE 当成 `GenerationTask` Promise。

### 6. 提升文本流状态并自动切换标签

#### 新文件：`frontend/lib/use-text-generation-stream.ts`

新增集中 hook，避免在流程图和三个内容面板重复管理流：

- 状态：
  - `stage`
  - `status: idle | streaming | completed | failed`
  - `text`
  - `task`
  - `error`
- `start(stage, options?)`
- `retry(task)`
- `cancel()`
- 同一项目同一时间只允许一个文本生成流。
- 启动时保存旧产物文本，仅作为失败恢复依据，不写服务端。
- 收到 `delta` 追加文本。
- 收到 `complete` 后拉取最新项目并调用 `onProjectUpdated`。
- 失败/中断时清理流式预览，恢复现有正式产物显示。
- 项目切换和组件卸载时通过 `AbortController` 取消请求。

#### 文件：`frontend/components/workspace/project-workspace.tsx`

在 `ProjectDetail` 中创建文本流 hook，因为这里同时控制：

- `activeDetailTab`
- `WorkspaceCreativeWorkflow`
- `ProjectDetailTabs`

启动故事/剧本/分镜脚本时：

1. 自动 `setActiveDetailTab(stage 对应 tab)`
2. 启动流
3. 将相同状态同时传给流程图与标签内容区

项目切换时取消旧项目流并重置状态。

#### 文件：`frontend/components/workspace/workspace-creative-workflow.tsx`

- 文本阶段生成/重试改为调用父级流控制器。
- 非文本阶段保留现有 JSON API 和任务轮询。
- 文本流进行中：
  - 对应节点显示“生成中”
  - 禁止重复生成/重试
  - 其他依赖该阶段的操作继续按现有规则禁用
- 失败时显示脱敏错误。

#### 文件：`frontend/components/workspace/project-detail-tabs.tsx`

故事、剧本和分镜脚本面板接收共享流状态：

- 空状态点击生成后，原空面板位置显示流式正文。
- 重新生成时，正文区域切换为流式新内容。
- 流式文本使用 `whitespace-pre-wrap`，并显示轻量生成状态，不使用新的嵌套卡片。
- 分镜脚本在流式阶段只展示正文；完整成功并刷新项目后再展示 `StoryboardShotList`。
- 失败时恢复旧 artifact，保留错误反馈。
- `StageGenerateButton` 和 `EditableTextArtifactPanel.handleRegenerate()` 统一调用父级流控制器，不再直接调用 JSON `generateStage()`。

### 7. AI 优化直接流入提示词编辑框

#### 文件：`frontend/components/workspace/storyboard-video-workspace.tsx`

修改 `handleOptimizePrompt()`：

1. 保存 `draftPrompt` 快照。
2. 清空 textarea。
3. 调用流式 AI 优化。
4. 每个 `delta` 追加到 `draftPrompt`，textarea 受控更新。
5. `complete` 后使用后端返回的完整 `optimized_prompt` 覆盖一次，避免增量拼接误差。
6. 失败或 Abort 时恢复快照。
7. 流式期间禁用保存、素材引用插入、关闭冲突操作。
8. 成功仍不自动保存，继续提示用户确认后点击“保存提示词”。

保留现有 session ID、shot ID 检查，忽略用户切换镜头后到达的旧流事件；切换镜头或关闭弹窗时主动 abort。

#### 文件：`frontend/components/workspace/storyboard-shot-editor-dialog.tsx`

- 保持 textarea 受控。
- 优化中显示“优化中”及加载图标。
- 增加 `aria-live="polite"` 状态文案，确保屏幕阅读器能感知流式状态。
- 不新增双栏或确认应用按钮。

## Assumptions & Decisions

- “角色形象提示词”指 `generate_characters()` 生成的角色 `description`；只关闭思考，不做流式展示。
- Seedream 图片生成和 Seedance 视频生成没有应用本次 `thinking` 参数。
- 默认分镜视频提示词继续本地构建，不产生 Seed 调用。
- AI 优化只改变前端草稿，不自动持久化。
- SSE 使用 POST + `fetch`，不使用浏览器 `EventSource`，因为接口需要 JSON body、参考图参数和 AbortSignal。
- 流式可见文本来自模型 JSON 中的目标字段，不显示供应商原始 JSON。
- 完整 JSON 校验是唯一提交点；部分内容永不写库。
- 不增加数据库字段或迁移。
- 原文本生成和 AI 优化 HTTP 响应格式改为 SSE，旧调用方必须同步更新。
- 非文本生成接口及非文本任务重试继续返回 JSON。

## Failure Modes

- **模型在首 token 前失败**：发送 task 后发送 error；任务标记 failed，前端恢复旧内容。
- **模型中途断流**：不解析/不持久化不完整 JSON；任务 failed。
- **JSON 字段缺失或结构非法**：已显示的临时文本被撤销，任务 failed。
- **分镜总时长或镜头结构非法**：不替换 storyboard，不写 artifact，任务 failed。
- **客户端关闭页面/切项目/切镜头**：Abort 上游请求；文本阶段任务标记为 failed 且不保留半成品，AI 优化恢复原草稿。
- **写库失败**：不发送 complete；任务 failed；沿用 repository 现有事务/补偿边界。
- **反向代理缓冲**：通过 SSE headers 禁用缓冲；测试验证首个事件可在模型完成前送达。
- **重复点击**：前端禁用；后端继续依赖 workflow active-task 去重。

## Verification

### 后端单元测试

修改/新增：

- `backend/tests/test_modelark.py`
  - Chat 故事/剧本/分镜调用含 `thinking={"type":"disabled"}`
  - Responses 多模态调用含相同 thinking
  - 角色描述生成调用含相同 thinking
  - AI 优化调用含相同 thinking
  - Chat 和 Responses 流 chunk 正确转换为 delta
- `backend/tests/test_text_streaming.py`
  - JSON 字符串字段跨 chunk 提取
  - 中文、换行、引号、反斜杠、Unicode 转义
  - 多字段和字段顺序变化
  - 不向前端泄漏 JSON 外壳
- `backend/tests/test_api.py`
  - story/script/storyboard 返回 `text/event-stream`
  - task → delta → complete 顺序
  - complete 后才有 artifact / storyboard
  - 流中失败无半成品且 task failed
  - 文本任务 retry 返回 SSE
  - 非文本 retry 仍返回 JSON
- `backend/tests/test_video_prompt_optimization.py`
  - AI 优化 delta 和 complete
  - 非法完整结果发 error
  - 不自动保存 video_prompt

### 前端单元/组件测试

修改/新增：

- `frontend/tests/api-client.test.ts`
  - SSE 跨 chunk、多事件、多行 data、error、Abort
  - 文本 stage 和文本 retry 使用 SSE
  - 非文本 stage 保持 JSON
- `frontend/tests/workspace-creative-workflow.test.tsx`
  - 点击文本生成自动切换对应标签
  - 文本节点显示 streaming 状态
  - 文本 retry 走流
- `frontend/tests/project-workspace.test.tsx`
  - 故事/剧本/分镜正文逐段增长
  - 完成后刷新项目
  - 失败恢复旧产物
  - 分镜完成前不展示未校验镜头列表
  - AI 优化直接流入 textarea
  - AI 优化失败恢复原草稿
  - 切换镜头后忽略并取消旧流

### 全量验证

按项目约定使用根目录 `.venv`：

```bash
cd backend
PYTHONPATH=.. ../.venv/bin/pytest -q

cd ../frontend
npm run test
npm run typecheck
```

### 手工验收

1. 点击“生成故事”，页面自动切到故事标签，正文逐字出现，完成后刷新为正式产物。
2. 生成剧本、分镜脚本行为一致。
3. 分镜流式过程中刷新页面，数据库中不存在半成品；对应任务为 failed，可流式重试。
4. 分镜完整成功后才同时出现正式脚本文本和镜头列表。
5. 点击视频提示词“AI 优化”，textarea 清空后逐字出现优化文本；不点击保存则数据库不变。
6. AI 优化中断时 textarea 恢复原草稿。
7. 使用 mock/fake client 检查所有目标 Seed 文本调用请求体均包含：

   ```json
   {"thinking":{"type":"disabled"}}
   ```
