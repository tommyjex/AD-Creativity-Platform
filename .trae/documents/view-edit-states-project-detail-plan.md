# 项目详情内容模块查看/编辑态改造计划

## Summary
在工作台项目详情页的 `Brief / 故事 / 剧本 / 角色` 四个 Tab 中统一“默认查看态，点击编辑按钮后进入编辑态，编辑态可关闭”的交互。

已确认的产品决策：
- 故事和剧本保存后需要按现有工作流规则标记下游内容 `stale`。
- 角色模块复用现有角色图片“编辑 / 重新生成”能力，不新增角色名称、描述等 metadata 编辑。
- Brief 继续使用现有项目更新 API，但默认不再直接显示表单。

## Current State Analysis
- `frontend/components/workspace/project-detail-tabs.tsx`
  - 已提供 `Brief / 故事 / 剧本 / 角色` Tab。
  - `StoryPanel` 和 `ScriptPanel` 当前只有只读展示，没有编辑入口。
  - `CharacterPanel` 已有角色图片“编辑”和“重新生成”按钮，点击后展开 `CharacterIterationPanel`；这个面板已经可通过再次点击当前按钮关闭，但 UI 没有统一表达“查看态/编辑态”。
- `frontend/components/workspace/project-workspace.tsx`
  - `ProjectEditor` 当前在 Brief Tab 内直接渲染为编辑表单。
  - `ProjectEditor` 支持 `create` 和 `edit` 两种模式；`edit` 模式没有取消/关闭能力。
- `frontend/lib/api-client.ts` / `frontend/lib/api-types.ts`
  - 已有 `updateProject(projectId, payload)` 支持 Brief 保存。
  - 没有文本产物更新 API。
  - 已有 `iterateCharacterAsset(...)` 支持角色图片编辑/重新生成。
- `backend/app/services/workflow.py`
  - 已有 `edit_text_artifact(project_id, stage, content, title?)`，会更新最新文本产物、增加版本、将下游产物标记 `stale`，并更新项目状态。
- `backend/app/repositories/*`
  - 已有 `update_text_artifact(...)`，MySQL 和内存仓储均支持更新文本产物。
- `backend/app/api/routes.py`
  - 目前只有 `POST /api/projects/{project_id}/story`、`POST /api/projects/{project_id}/script` 生成接口，没有保存故事/剧本编辑内容的 API。

## Proposed Changes

### 1. 后端新增故事/剧本保存接口
文件：
- `backend/app/schemas/text_artifact.py`
- `backend/app/schemas/__init__.py`
- `backend/app/api/routes.py`
- 后端测试：优先放在 `backend/tests/test_api.py`，必要时补 `backend/tests/test_workflow.py`

计划：
- 新增 `TextArtifactUpdate` schema：
  - `content: str`，必填，最小长度 1。
  - `title: str | None`，可选；如果前端不传标题，则保留原标题。
- 新增 API：
  - `PATCH /api/projects/{project_id}/story`
  - `PATCH /api/projects/{project_id}/script`
- 两个接口都调用 `workflow.edit_text_artifact(...)`：
  - story 保存后标记 script、storyboard、image、video、compose 相关产物 stale。
  - script 保存后标记 storyboard、image、video、compose 相关产物 stale。
- 返回值使用 `Project`，并通过 `AssetStorageService.with_project_access_urls(...)` 包装，保持角色图片签名 URL 行为一致。
- 错误处理沿用 `_workflow_http_error`：
  - 没有对应文本产物时返回 `not_found`。
  - 空内容走 FastAPI/Pydantic 校验。
  - 不暴露堆栈、密钥或底层异常。

### 2. 前端 API client 增加文本产物保存能力
文件：
- `frontend/lib/api-types.ts`
- `frontend/lib/api-client.ts`
- `frontend/tests/api-client.test.ts`

计划：
- 新增类型：
  - `TextArtifactUpdateStage = "story" | "script"` 或直接复用受限的 `Stage` 子集。
  - `TextArtifactUpdate = { content: string; title?: string | null }`。
- 新增 client 方法：
  - `updateTextArtifact(projectId, stage, payload, options?)`
  - stage 只能为 `story` 或 `script`，分别映射到 `/api/projects/{id}/story` 和 `/api/projects/{id}/script`。
- 测试 URL 编码、PATCH method、payload 传递和响应解析。

### 3. Brief Tab 改为默认查看态，编辑态可关闭
文件：
- `frontend/components/workspace/project-workspace.tsx`
- `frontend/components/workspace/project-detail-tabs.tsx`
- `frontend/tests/project-workspace.test.tsx`

计划：
- 将 `ProjectDetailTabs` 的 `briefPanel` 改为更明确的 Brief 查看/编辑组件入口，避免默认直接显示表单。
- 新增或调整 `ProjectEditor` 支持编辑态关闭：
  - `edit` 模式增加 `onCancel`。
  - 点击“编辑 Brief”进入编辑态。
  - 编辑态显示“取消/关闭”按钮；点击后丢弃未保存改动，回到查看态。
  - 保存成功后刷新项目并回到查看态。
- Brief 查看态展示现有 8 个字段：
  - 项目名称、广告需求、投放平台、画面比例、视频时长、商品名称、视觉风格、目标受众。
  - 可保留 `summary` / `selling_points` 的只读摘要，但不作为本次编辑字段。
- 验证：
  - 默认看不到输入框，只看到字段摘要和“编辑 Brief”按钮。
  - 点击编辑后出现表单。
  - 取消后回到查看态并恢复原值。
  - 保存成功后调用现有 `updateProject`，刷新项目，回到查看态。

### 4. 故事/剧本 Tab 增加查看态和编辑态
文件：
- `frontend/components/workspace/project-detail-tabs.tsx`
- `frontend/tests/project-workspace.test.tsx`

计划：
- 抽出通用 `EditableTextArtifactPanel` 或在 `StoryPanel` / `ScriptPanel` 内复用同一小组件：
  - 查看态：展示标题、状态、版本、更新时间、正文和“编辑”按钮。
  - 编辑态：展示 textarea、保存按钮、取消/关闭按钮、保存状态和安全错误提示。
- 编辑入口：
  - 故事按钮文案：“编辑故事”。
  - 剧本按钮文案：“编辑剧本”。
- 保存行为：
  - 调用 `apiClient.updateTextArtifact(project.id, "story" | "script", { content })`。
  - 保存成功后调用 `onProjectUpdated(freshProject)` 或直接使用接口返回的 Project 更新父级状态。
  - 保存成功后退出编辑态。
- 取消/关闭行为：
  - 不调用 API。
  - 丢弃未保存编辑内容，回到查看态。
- 边界：
  - 无故事/无剧本时保持现有空状态，不显示编辑按钮。
  - 空内容前端提示，不提交 API。
  - 保存失败时保留编辑内容并显示 `getUserFacingErrorMessage(error)`。

### 5. 角色 Tab 统一查看/编辑态表达，复用现有图片迭代
文件：
- `frontend/components/workspace/project-detail-tabs.tsx`
- `frontend/tests/project-workspace.test.tsx`

计划：
- 角色默认查看态保持当前卡片展示：图片、名称、描述、状态、生成时间。
- 每张角色卡片保留“编辑”和“重新生成”按钮：
  - 点击“编辑”进入该角色图片编辑态，展开现有 `CharacterIterationPanel(operation="edit")`。
  - 点击“重新生成”进入该角色重生成编辑态，展开现有 `CharacterIterationPanel(operation="regenerate")`。
  - 当前操作再次点击或点击面板内“关闭/取消”后回到查看态。
- 给 `CharacterIterationPanel` 增加 `onClose`：
  - 忙碌状态下可以禁用关闭，或关闭只隐藏面板但不取消后端任务；推荐禁用提交中的关闭，避免用户误以为任务取消。
  - 非忙碌时关闭不提交、不刷新。
- 不新增角色 metadata 编辑 API。

### 6. 测试与验证
后端：
- `.venv/bin/python -m pytest backend/tests/test_api.py backend/tests/test_workflow.py -q`
- `.venv/bin/python -m pytest backend/tests -q`
- 覆盖：
  - `PATCH /story` 保存内容并返回 Project。
  - `PATCH /script` 保存内容并返回 Project。
  - 无文本产物时返回 `not_found`。
  - story 保存后下游 script/stale，script 保存后 storyboard/stale。
  - 空内容校验失败。

前端：
- `npm test -- --run frontend/tests/project-workspace.test.tsx frontend/tests/api-client.test.ts`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- 覆盖：
  - Brief 默认查看态、点击编辑进入编辑态、取消关闭、保存后回查看态。
  - 故事默认查看态、点击编辑、空内容阻止提交、取消关闭、保存成功刷新、失败保留输入。
  - 剧本同故事。
  - 角色默认查看态、点击编辑/重新生成展开面板、关闭面板回查看态。

Smoke test：
- 启动后端和前端。
- 打开 `http://127.0.0.1:3000/workspace/projects`。
- 选择已有项目：
  - Brief Tab 默认查看，点击编辑、取消、再次编辑并保存。
  - 故事 Tab 查看正文，编辑保存后确认剧本等下游标记过期。
  - 剧本 Tab 查看正文，编辑保存后确认分镜等下游标记过期。
  - 角色 Tab 查看图片，点击编辑展开，关闭后回到查看态。

## Assumptions & Decisions
- “查看/编辑两种状态”只作用于工作台项目详情页 `frontend/components/workspace/*`，不改旧版 `/projects/[projectId]` 页面。
- Brief 编辑仍保存项目名称和完整 Brief 字段，因为现有表单就是这 8 个字段。
- 故事/剧本编辑只编辑正文内容；标题保留原值。若后续需要标题可编辑，可在同一接口扩展 `title` 输入。
- 故事/剧本保存会触发现有 `mark_downstream_stale` 规则，这是用户已确认的行为。
- 角色模块只复用图片编辑/重新生成；不新增角色名称、描述、标签等 metadata 编辑。
- 不改变角色图片编辑/重新生成的后端 ModelArk/TOS 数据流。
- 关闭编辑态不等于取消已提交后端任务；提交前关闭只丢弃本地输入。角色图片任务提交后仍按现有轮询逻辑完成。

## Verification Steps
1. 运行后端局部测试：
   - `.venv/bin/python -m pytest backend/tests/test_api.py backend/tests/test_workflow.py -q`
2. 运行后端全量测试：
   - `.venv/bin/python -m pytest backend/tests -q`
3. 运行前端局部测试：
   - `cd frontend && npm test -- --run tests/project-workspace.test.tsx tests/api-client.test.ts`
4. 运行前端全量验证：
   - `cd frontend && npm run lint`
   - `cd frontend && npm run typecheck`
   - `cd frontend && npm test`
   - `cd frontend && npm run build`
5. 启动本地服务后进行浏览器 smoke test：
   - 后端：`PYTHONPATH=. .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`
   - 前端：`NEXT_PUBLIC_BACKEND_BASE_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000`
   - 访问 `http://127.0.0.1:3000/workspace/projects`，手工确认四个 Tab 的查看态、编辑态、关闭、保存和错误提示。
