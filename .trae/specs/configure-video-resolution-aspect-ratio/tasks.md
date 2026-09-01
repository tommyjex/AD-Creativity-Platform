# Tasks

- [x] Task 1: 扩展后端 schema 的分辨率与宽高比契约及校验。
  - [x] SubTask 1.1: 在 `backend/app/schemas/tool_task.py` 新增按模型的合法分辨率映射（2.5→480p/720p/1080p、2.0→480p/720p/1080p/4k、2.0 fast/mini→480p/720p）与校验函数，参照现有 `TOOL_VIDEO_MODEL_DURATION_RANGES` 与 `validate_tool_video_duration` 的模式，作为单一数据源。
  - [x] SubTask 1.2: 在 schema 层 `ToolVideoGenerationRequest` 新增 `resolution` 字段并将 `aspect_ratio` 的 `Literal` 扩展为 16:9/4:3/1:1/3:4/9:16/21:9/adaptive；在 `model_validator` 中校验模型与分辨率组合。
  - [x] SubTask 1.3: 在 `backend/app/services/modelark.py` 服务层 `ToolVideoGenerationRequest` 同步新增 `resolution` 字段并扩展 `aspect_ratio` Literal。

- [x] Task 2: 打通后端路由与 ModelArk 供应商映射。
  - [x] SubTask 2.1: 在 `backend/app/api/routes.py` 创建与重试两处构造 `ModelArkToolVideoGenerationRequest` 时补传 `resolution=payload.resolution`（重试从快照读取）。
  - [x] SubTask 2.2: 在 `modelark.py` 真实 adapter 将 `resolution="720p"` 改为 `resolution=request.resolution`，`ratio=request.aspect_ratio` 保持，并同步 metadata 中的 `resolution`/`aspect_ratio`。
  - [x] SubTask 2.3: 在 `modelark.py` Mock adapter 同步 metadata 的 `resolution`/`aspect_ratio` 为实际请求值。

- [x] Task 3: 补充后端测试。
  - [x] SubTask 3.1: 覆盖各模型合法/非法分辨率、扩展后合法/非法宽高比（含 adaptive 合法、旧被拒值现放行的更新）、创建与重试快照透传，以及供应商 `create` 调用参数与 metadata 的 `resolution`/`ratio` 断言。

- [x] Task 4: 更新前端类型、常量与工作台。
  - [x] SubTask 4.1: 在 `frontend/lib/api-types.ts` 的 `ToolVideoGenerationRequest` 新增 `resolution` 字段并扩展 `aspect_ratio` 联合类型。
  - [x] SubTask 4.2: 在 `tools-workspace.tsx` 新增按模型的合法分辨率映射与默认值 720p，新增 `resolution` state 与选择器，扩展宽高比 options，移除“固定 720p”文案。
  - [x] SubTask 4.3: 实现切换模型时分辨率收敛为默认值的逻辑，并在 `submit()` 中将 `resolution` 与扩展后的 `aspect_ratio` 映射进请求。

- [x] Task 5: 补充前端测试并完成验证。
  - [x] SubTask 5.1: 更新/补充前端单元测试，覆盖分辨率选择器按模型展示、默认 720p、切换模型收敛、宽高比扩展选项与提交 payload 携带 `resolution`。
  - [x] SubTask 5.2: 在根目录 `.venv` 运行相关后端 pytest；在前端运行相关 Vitest、lint 与 typecheck。
  - [x] SubTask 5.3: 使用浏览器验证分辨率与宽高比选择、切换模型收敛及提交请求。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1 和 Task 2。
- Task 4 依赖 Task 1（契约字段）；可与 Task 3 并行。
- Task 5 依赖 Task 3 和 Task 4。
