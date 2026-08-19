# 六阶段流程图与七标签创作详情改造计划

## Summary

本次改造目标是减少项目详情页上方“六阶段创作流程”6 张大卡片占用的空间，将其浓缩为一个横向流程图/步骤条；同时把下方详情标签扩展为 7 个标签：`Brief`、`故事`、`角色`、`剧本`、`分镜脚本`、`分镜视频`、`剪辑成片`。生成、编辑、删除指定元素的主要操作入口下沉到各标签页内，顶部流程图只负责展示阶段状态、依赖关系和快速跳转。

已确认的产品决策：
- 详情区使用 7 个标签：`Brief` + 完整六阶段。
- 删除能力要求细粒度删除：可删除具体文本产物、角色资产、分镜镜头、单个分镜视频/参考素材、最终成片等阶段内元素。
- 保持现有蓝白、简洁、企业级 UI 风格，不做大规模视觉重构。

## Current State Analysis

### 前端现状

- `frontend/components/workspace/project-workspace.tsx`
  - `ProjectDetail` 当前顺序为：项目摘要卡片 → `WorkspaceCreativeWorkflow` → `StoryboardVideoWorkspace` → `ProjectDetailTabs`。
  - `ProjectDetailTabs` 当前接收 `briefPanel` 并展示项目内容。

- `frontend/components/workspace/workspace-creative-workflow.tsx`
  - 当前“六阶段创作流程”由 6 张 `StageCard` 大卡片组成，阶段为：
    - `故事`
    - `角色`
    - `剧本`
    - `分镜脚本`
    - `分镜视频`
    - `剪辑成片`
  - 每张卡包含描述、依赖提示、状态、进度条、生成/重试按钮，导致占用高度较大。
  - 该组件已有任务轮询、生成、重试、角色跳过逻辑。

- `frontend/components/workspace/project-detail-tabs.tsx`
  - 当前标签只有 5 个：`Brief`、`故事`、`剧本`、`分镜脚本`、`角色`。
  - `故事`、`剧本`、`分镜脚本` 使用 `EditableTextArtifactPanel` 支持编辑保存。
  - `角色` 支持角色图编辑和重新生成，但不支持删除。
  - `分镜视频` 的细节操作目前在独立组件 `StoryboardVideoWorkspace` 中，不在标签页内。
  - `剪辑成片` 没有对应标签。

- `frontend/components/workspace/storyboard-video-workspace.tsx`
  - 当前提供分镜视频工作区：
    - 左侧分镜列表
    - 视频提示词编辑
    - 参考图片/视频/音频添加、上传、移除
    - 单镜头视频生成
    - 右侧视频查看
  - 该组件适合迁入 `ProjectDetailTabs` 的 `分镜视频` 标签，避免页面上再多占一块独立区域。

- `frontend/lib/api-client.ts`
  - 已有 `generateStage`、`skipCharacters`、`retryTask`、`updateTextArtifact`、角色图迭代、分镜视频配置和参考素材增删接口。
  - 缺少删除文本产物、资产、分镜镜头、最终成片等细粒度删除方法。

- `frontend/lib/api-types.ts`
  - `Stage` 包含 `brief`、`story`、`character`、`script`、`storyboard`、`image`、`video`、`compose`。
  - `GenerationStage` 为除 `brief` 外所有阶段。
  - `TextArtifactUpdateStage` 仅包含 `story`、`script`、`storyboard`。

### 后端现状

- `backend/app/api/routes.py`
  - 已有生成接口：
    - `POST /api/projects/{project_id}/story`
    - `POST /api/projects/{project_id}/characters`
    - `POST /api/projects/{project_id}/script`
    - `POST /api/projects/{project_id}/storyboard`
    - `POST /api/projects/{project_id}/images`
    - `POST /api/projects/{project_id}/videos`
    - `POST /api/projects/{project_id}/compose`
  - 已有编辑接口：
    - `PATCH /api/projects/{project_id}` 用于 Brief/项目字段编辑
    - `PATCH /api/projects/{project_id}/story`
    - `PATCH /api/projects/{project_id}/script`
    - `PATCH /api/projects/{project_id}/storyboard`
    - `PATCH /api/projects/{project_id}/storyboard/shots/{shot_id}/video-config`
  - 已有删除接口仅覆盖分镜参考素材：
    - `DELETE /api/projects/{project_id}/storyboard/shots/{shot_id}/references`
  - 缺少通用细粒度删除接口。

- `backend/app/repositories/base.py`
  - `Repository` 协议没有删除文本产物、资产、分镜镜头的方法。

- `backend/app/repositories/memory.py`
  - 内存仓储有 update 和 replace 能力，没有显式 delete 方法。

- `backend/app/repositories/mysql.py`
  - MySQL/SQLAlchemy 仓储可通过 `delete(...)` 实现删除，但当前没有对外 repository 方法。

- `backend/app/services/workflow.py`
  - 已有依赖校验和 `mark_downstream_stale`。
  - 删除上游元素后应复用或补充 workflow 逻辑，让下游阶段进入 stale，避免后续继续使用失效产物。

### 测试现状

- 后端：
  - `backend/tests/test_api.py`
  - `backend/tests/test_workflow.py`
  - `backend/tests/test_database.py`
  - `backend/tests/test_storyboard_video_workspace.py`
  - `backend/tests/test_character_workflow.py`
- 前端：
  - `frontend/tests/workspace-creative-workflow.test.tsx`
  - `frontend/tests/project-workspace.test.tsx`
  - `frontend/tests/api-client.test.ts`
  - `frontend/tests/workspace-asset-library.test.tsx`

## Proposed Changes

### 1. 压缩顶部六阶段流程为流程图

文件：`frontend/components/workspace/workspace-creative-workflow.tsx`

改造方式：
- 保留 `STAGE_DEFINITIONS`、`buildStageViewModels`、任务轮询、生成、重试、角色跳过核心逻辑。
- 用新的 `StageFlowDiagram` 或重构后的主体替代当前 `StageCard` 网格。
- 横向展示 6 个节点，节点内容保持轻量：
  - 阶段序号
  - 阶段名称
  - 状态徽标
  - 简短依赖/状态提示
  - 进行中进度条或小型进度环
- 节点之间用连接线表达顺序和完成状态。
- 每个节点支持点击跳转到对应标签页：
  - 故事 → `story`
  - 角色 → `characters`
  - 剧本 → `script`
  - 分镜脚本 → `storyboard`
  - 分镜视频 → `storyboardVideo`
  - 剪辑成片 → `compose`
- 顶部流程图不再承载主要生成按钮，只保留必要的轻量操作：
  - 失败阶段可展示“重试”小按钮，或在提示中引导到标签页操作。
  - 角色跳过入口迁移到 `角色` 标签页。

组件接口调整：
- 给 `WorkspaceCreativeWorkflow` 增加：
  - `activeDetailTab`
  - `onDetailTabChange`
- 或在 `ProjectDetail` 中统一管理标签状态，把流程图和详情标签联动。

### 2. 将详情区扩展为 7 个标签

文件：`frontend/components/workspace/project-detail-tabs.tsx`

改造方式：
- `DetailTab` 从当前 5 项扩展为：
  - `brief`
  - `story`
  - `characters`
  - `script`
  - `storyboard`
  - `storyboardVideo`
  - `compose`
- `TABS` 顺序与产品确认一致：`Brief`、`故事`、`角色`、`剧本`、`分镜脚本`、`分镜视频`、`剪辑成片`。
- `ProjectDetailTabs` 改为受控或半受控组件：
  - `activeTab`
  - `onActiveTabChange`
  - 这样顶部流程图可以定位到指定标签。
- 保持键盘可访问性：
  - `role="tablist"`
  - `role="tab"`
  - `role="tabpanel"`
  - ArrowLeft/ArrowRight/Home/End 逻辑随 7 个标签自动工作。

### 3. 各标签页支持生成、编辑、删除

#### Brief 标签

文件：`frontend/components/workspace/project-workspace.tsx`

能力：
- 保留现有查看/编辑态。
- 不提供删除 Brief，因为 Brief 是项目创建和生成依赖的根数据。
- 在标签页内显示说明：Brief 不可删除，只能编辑；编辑后下游阶段按现有 workflow 标记 stale。

#### 故事标签

文件：`frontend/components/workspace/project-detail-tabs.tsx`

能力：
- 空状态中提供“生成故事”按钮，调用 `apiClient.generateStage(project.id, "story")`。
- 有产物时提供：
  - 编辑故事：沿用 `updateTextArtifact`
  - 重新生成故事：调用 `generateStage("story")`
  - 删除故事：调用新增 `deleteTextArtifact(project.id, "story", artifact.id)` 或阶段级删除接口
- 删除故事后：
  - 故事产物从当前项目返回中移除或标记为 stale/deleted。
  - 下游 `角色`、`剧本`、`分镜脚本`、`分镜视频`、`剪辑成片` 进入 stale 或不可继续状态。

#### 角色标签

文件：`frontend/components/workspace/project-detail-tabs.tsx`

能力：
- 空状态中提供：
  - “生成角色”
  - “无角色需求，跳过”
- 有角色时提供：
  - 编辑角色图：保留当前 seedream 图生图入口
  - 重新生成角色图：保留历史提示词入口
  - 删除单个角色资产：新增按钮调用 `deleteAsset(project.id, asset.id)`
- 删除角色资产后：
  - 该角色图从列表移除。
  - 如果删除后无成功角色资产，角色阶段状态回到未完成或 stale。
  - 剧本及下游阶段应按 workflow 规则变为不可继续或 stale。

#### 剧本标签

文件：`frontend/components/workspace/project-detail-tabs.tsx`

能力：
- 空状态中提供“生成剧本”，依赖故事和角色决策。
- 有产物时提供：
  - 编辑剧本
  - 重新生成剧本
  - 删除剧本
- 删除剧本后：
  - 分镜脚本、分镜视频、剪辑成片 stale。

#### 分镜脚本标签

文件：`frontend/components/workspace/project-detail-tabs.tsx`

能力：
- 空状态中提供“生成分镜脚本”。
- 有产物时提供：
  - 编辑分镜脚本文本
  - 重新生成分镜脚本
  - 删除分镜脚本文本
  - 删除指定分镜镜头
- 分镜镜头删除：
  - 调用新增 `DELETE /api/projects/{project_id}/storyboard/shots/{shot_id}`。
  - 删除后对剩余镜头重新排序或保留原 index，需要后端保持一致；本计划采用“删除后按当前排序重排为 1..N”，避免 UI 出现断号。
  - 删除关联镜头后，该镜头的 image/video 关联不再在 storyboard 中引用；资产记录可保留在资产库，必要时由用户单独删除。

#### 分镜视频标签

文件：
- `frontend/components/workspace/project-detail-tabs.tsx`
- `frontend/components/workspace/storyboard-video-workspace.tsx`
- `frontend/components/workspace/project-workspace.tsx`

改造方式：
- 将 `StoryboardVideoWorkspace` 从 `ProjectDetail` 独立区域迁入 `ProjectDetailTabs` 的 `storyboardVideo` 标签。
- 保留当前两栏式布局。
- 支持：
  - 编辑单镜头视频提示词
  - 添加/移除参考图、参考视频、参考音频
  - 上传本地参考素材
  - 生成/重新生成单个分镜视频
  - 删除指定分镜视频资产：新增按钮调用 `deleteAsset(project.id, videoAssetId)`，并清空对应 shot 的 `video_asset_id`
- 已有“移除参考素材”接口继续使用，不等同于删除资产本体。

#### 剪辑成片标签

文件：`frontend/components/workspace/project-detail-tabs.tsx`

能力：
- 空状态中提供“生成剪辑成片”，调用 `generateStage("compose")`。
- 有最终视频资产时展示：
  - 成片预览
  - 资产元信息
  - 重新生成/重新剪辑
  - 删除最终成片资产
- 删除最终成片后：
  - `compose` 阶段回到未完成或 stale。
  - 不影响上游分镜视频资产。

### 4. 抽取可复用的阶段操作逻辑

文件：
- `frontend/components/workspace/project-detail-tabs.tsx`
- 可选新增：`frontend/components/workspace/stage-action-controls.tsx`

原因：
- 生成、轮询、刷新项目、错误脱敏提示会在多个标签中重复。

实现建议：
- 在 `ProjectDetailTabs` 内实现一个轻量 `useStageAction` 或局部函数：
  - `generate(stage)`
  - `retry(task)`
  - `deleteTextArtifact(...)`
  - `deleteAsset(...)`
  - `deleteStoryboardShot(...)`
  - 成功后调用 `apiClient.getProject(project.id, { cache: "no-store" })` 刷新。
- 如果组件过长，再拆分子组件：
  - `TextStagePanel`
  - `CharacterStagePanel`
  - `StoryboardScriptPanel`
  - `ComposePanel`

### 5. 扩展前端 API 客户端和类型

文件：
- `frontend/lib/api-client.ts`
- `frontend/lib/api-types.ts`

新增方法：
- `deleteTextArtifact(projectId, stage, artifactId?)`
- `deleteAsset(projectId, assetId)`
- `deleteStoryboardShot(projectId, shotId)`

建议接口路径：
- `DELETE /api/projects/{project_id}/text-artifacts/{artifact_id}`
- `DELETE /api/projects/{project_id}/assets/{asset_id}`
- `DELETE /api/projects/{project_id}/storyboard/shots/{shot_id}`

说明：
- 文本删除使用 artifact id，避免误删历史版本。
- UI 默认删除当前最新版本；如果未来展示版本列表，可复用同一接口。

### 6. 补后端细粒度删除 API

文件：
- `backend/app/api/routes.py`
- `backend/app/repositories/base.py`
- `backend/app/repositories/memory.py`
- `backend/app/repositories/mysql.py`
- `backend/app/services/workflow.py`

新增 Repository 方法：
- `delete_text_artifact(project_id: str, artifact_id: str) -> TextArtifact`
- `delete_asset(project_id: str, asset_id: str) -> Asset`
- `delete_storyboard_shot(project_id: str, shot_id: str) -> StoryboardShot`

后端接口：
- `DELETE /api/projects/{project_id}/text-artifacts/{artifact_id}`
  - 校验 artifact 属于 project。
  - 删除后按 artifact.stage 调用 workflow 标记下游 stale。
  - 返回带签名 URL 的最新 Project。

- `DELETE /api/projects/{project_id}/assets/{asset_id}`
  - 校验 asset 属于 project。
  - 删除数据库记录。
  - 如果 asset 被某个 storyboard shot 的 `image_asset_id` 或 `video_asset_id` 引用，需要清空引用。
  - 如果 asset 出现在 `reference_*_asset_ids`，需要移除引用。
  - 如果 asset 有 `object_key` 且 TOS client 可用，可删除远端对象；如果远端删除失败，不应留下数据库半删除。建议第一版先删除数据库引用和记录，TOS 删除失败记录为内部错误并返回 502，不暴露 key。
  - 按 asset.stage 标记下游 stale。
  - 返回最新 Project。

- `DELETE /api/projects/{project_id}/storyboard/shots/{shot_id}`
  - 校验 shot 属于 project。
  - 删除 shot。
  - 剩余 shot 按 index 升序重排为 1..N。
  - 标记 `image`、`video`、`compose` 下游 stale。
  - 返回最新 Project。

Workflow 处理：
- 删除 story → 标记 `character`、`script`、`storyboard`、`image`、`video`、`compose` stale。
- 删除 character asset → 若无剩余成功角色且角色阶段未 skipped，则标记 `script`、`storyboard`、`image`、`video`、`compose` stale。
- 删除 script → 标记 `storyboard`、`image`、`video`、`compose` stale。
- 删除 storyboard text 或 shot → 标记 `image`、`video`、`compose` stale。
- 删除 image asset → 标记 `video`、`compose` stale。
- 删除 video asset → 标记 `compose` stale。
- 删除 compose asset → 不影响上游。

### 7. 布局整合

文件：`frontend/components/workspace/project-workspace.tsx`

调整：
- 将 `ProjectDetail` 的结构改为：
  - 项目摘要卡片
  - 压缩版 `WorkspaceCreativeWorkflow`
  - `ProjectDetailTabs`
- 移除 `ProjectDetail` 中独立的 `StoryboardVideoWorkspace` 渲染。
- `StoryboardVideoWorkspace` 只在 `ProjectDetailTabs` 的 `分镜视频` 标签中渲染。
- 在 `ProjectDetail` 管理 `activeDetailTab` 状态，实现流程图点击标签跳转。

## Assumptions & Decisions

- `Brief` 是根输入，只支持编辑，不支持删除。
- 详情标签为 7 个，而不是 6 个：`Brief` + 完整六阶段。
- 顶部六阶段流程图主要用于状态概览和跳转，不再承担主要创作操作，避免和标签页重复。
- 生成、编辑、删除的主入口都放在对应标签页中。
- “删除指定元素”采用细粒度：
  - 文本阶段删除当前文本产物版本。
  - 角色阶段删除单个角色资产。
  - 分镜脚本阶段删除单个分镜镜头。
  - 分镜视频阶段删除单个镜头视频资产或移除参考素材。
  - 剪辑成片阶段删除最终成片资产。
- 删除后返回最新 Project，前端统一刷新状态。
- 删除真实 TOS 对象需要谨慎处理；第一版应确保数据库状态一致，远端对象删除失败时不暴露 object key、签名 URL 或密钥。
- 不引入新的全局状态库，沿用当前组件内 state + API client 模式。

## Verification Steps

后端验证：
- `.venv/bin/python -m pytest backend/tests/test_api.py backend/tests/test_workflow.py backend/tests/test_database.py backend/tests/test_storyboard_video_workspace.py -q`
- `.venv/bin/python -m pytest backend/tests -q`

前端验证：
- `cd frontend && npm run typecheck`
- `cd frontend && npm run lint`
- `cd frontend && npm run test -- workspace-creative-workflow project-workspace api-client`
- `cd frontend && npm run test`

交互验收：
- 项目详情页顶部不再出现 6 张大卡片，改为紧凑流程图。
- 点击流程图的故事/角色/剧本/分镜脚本/分镜视频/剪辑成片节点，可以切到对应标签。
- 详情区显示 7 个标签：`Brief`、`故事`、`角色`、`剧本`、`分镜脚本`、`分镜视频`、`剪辑成片`。
- 空状态下可在对应标签直接发起生成。
- 已生成状态下可在对应标签编辑或重新生成。
- 可删除：
  - 某个角色资产
  - 某个分镜镜头
  - 某个分镜视频资产
  - 最终成片资产
  - 当前故事/剧本/分镜脚本文本产物
- 删除后 UI 立即刷新，相关下游阶段显示为待更新或不可继续。
- 后端错误不暴露密钥、签名 URL、object key 或 traceback。

