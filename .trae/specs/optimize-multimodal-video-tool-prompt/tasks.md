# Tasks

- [x] Task 1: 后端新增工具提示词优化 schema 与适配器契约: 定义请求/响应模型，并让真实与 mock 适配器实现同一优化契约。
  - [x] SubTask 1.1: 在 `backend/app/schemas/tool_task.py` 新增 `ToolVideoPromptOptimizeRequest`（`prompt` 必填、去空白、非空、`max_length=12000`；三个 `reference_*_count` 非负整数默认 0）与 `ToolVideoPromptOptimizeResponse`（`optimized_prompt`）。
  - [x] SubTask 1.2: 在 `backend/app/services/modelark.py` 为真实适配器与 mock 适配器新增 `optimize_tool_video_prompt`（新增 `ToolVideoPromptOptimizationRequest` 契约），系统指令覆盖“修改范围/时间戳/A→B/标准素材编号/仅输出 JSON”原则，并解析 `{"optimized_prompt": "..."}`。
- [x] Task 2: 后端优化服务方法与路由: 提供同步优化能力并对外暴露 REST 接口。
  - [x] SubTask 2.1: 在 `backend/app/services/generation.py` 新增 `optimize_tool_video_prompt(prompt, reference_counts)`，调用适配器、清理 Markdown 代码围栏与空白、校验非空与长度上限，失败抛出既有 `ModelArkProviderError`/`ModelArkTextParseError`。
  - [x] SubTask 2.2: 在 `backend/app/api/routes.py` 新增 `POST /tools/videos/optimize-prompt` 路由，返回 `ToolVideoPromptOptimizeResponse`，空白草稿返回 422，模型失败返回脱敏 502。
- [x] Task 3: 前端类型与 API 客户端: 打通前端调用。
  - [x] SubTask 3.1: 在 `frontend/lib/api-types.ts` 新增 `ToolVideoPromptOptimizeRequest` 与 `ToolVideoPromptOptimizeResponse` 类型。
  - [x] SubTask 3.2: 在 `frontend/lib/api-client.ts` 新增 `optimizeToolVideoPrompt(payload)` 方法，POST 到 `/api/tools/videos/optimize-prompt`。
- [x] Task 4: 前端五角星优化入口与交互: 在创作提示词编辑器实现按钮与优化流程。
  - [x] SubTask 4.1: 在 `frontend/components/workspace/tools-workspace.tsx` 的 `VideoGenerationPanel` 为“创作提示词”标题行右上角加入五角星（`Star`）按钮，`aria-label="优化提示词"`。
  - [x] SubTask 4.2: 新增 `isOptimizing` 状态；按钮在 `!prompt.trim()`、`isOptimizing` 或 `isSubmitting` 时禁用；生成按钮在 `isOptimizing` 时也禁用。
  - [x] SubTask 4.3: 实现 `optimize()`：调用 `apiClient.optimizeToolVideoPrompt`，成功后 `setPrompt(optimized_prompt)`，失败调用 `props.onFeedback(getUserFacingErrorMessage(error))`，加载态展示旋转图标。
- [x] Task 5: 测试与验证: 覆盖后端与前端行为并通过校验。
  - [x] SubTask 5.1: 后端在 `.venv` 下用 pytest 覆盖：成功优化、空白草稿 422、模型输出非法返回脱敏错误、不创建任务。
  - [x] SubTask 5.2: 前端在 `tests/tools-workspace.test.tsx` 覆盖：空提示词按钮禁用、非空可点击、优化成功替换文本、优化中禁用生成；并通过 `npm run lint`。

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4
