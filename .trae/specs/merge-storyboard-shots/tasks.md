# Tasks

- [x] Task 1: 后端合并请求模型与仓库能力：新增分镜合并的数据契约与持久化操作。
  - [x] SubTask 1.1: 在 [storyboard.py](file:///Users/bytedance/AD-Creativity/backend/app/schemas/storyboard.py) 新增 `StoryboardShotMergeRequest`（`shot_ids: list[str]`，至少 2 个，去重、非空校验）。
  - [x] SubTask 1.2: 在 [base.py](file:///Users/bytedance/AD-Creativity/backend/app/repositories/base.py) 抽象接口新增 `merge_storyboard_shots(project_id, shot_ids) -> StoryboardShot`。
  - [x] SubTask 1.3: 在 [memory.py](file:///Users/bytedance/AD-Creativity/backend/app/repositories/memory.py) 实现合并：校验相邻性与存在性，按顺序拼接 `description`/`visual_prompt`/`narration`，`title`=「镜头 X-Y」，`duration_seconds`=求和，`video_prompt`/参考素材/首帧/`video_asset_id` 清空，`status` 重置为待生成，删除其余分镜并重新连续编号。
  - [x] SubTask 1.4: 在 [mysql.py](file:///Users/bytedance/AD-Creativity/backend/app/repositories/mysql.py) 实现同等语义（复用 `delete_storyboard_shot` 的重编号模式，事务内完成）。

- [x] Task 2: 后端合并端点与业务校验：暴露 HTTP 接口并接入下游失效。
  - [x] SubTask 2.1: 在 [routes.py](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py) 新增 `POST /projects/{project_id}/storyboard/shots/merge`，接收 `StoryboardShotMergeRequest`，返回更新后的 `Project`。
  - [x] SubTask 2.2: 端点内校验：相邻性（index 连续）、时长之和 ≤ 30，违规返回 `VALIDATION_ERROR`（含当前总时长）。
  - [x] SubTask 2.3: 合并成功后调用 `workflow.mark_downstream_stale(project_id, Stage.STORYBOARD)`，并同步 STORYBOARD 文本产物内容以反映合并后镜头序列。
  - [x] SubTask 2.4: 复用 `asset_storage.with_project_access_urls` 返回带访问 URL 的项目。

- [x] Task 3: 前端类型与 API 客户端：打通合并调用链路。
  - [x] SubTask 3.1: 在 [api-types.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/api-types.ts) 新增 `StoryboardShotMergeRequest` 类型。
  - [x] SubTask 3.2: 在 [api-client.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/api-client.ts) 新增 `mergeStoryboardShots(projectId, shotIds)`，返回 `Project`。
  - [x] SubTask 3.3: 新增 `frontend/lib/storyboard-merge.ts`：`canMergeShots`（相邻校验）、`getMergeDurationTotal`、`getMergeBlockedReason`（相邻/时长/数量），并导出 30s 常量与提示文案。

- [x] Task 4: 前端工作台合并交互：多选、合并按钮、校验提示与状态收敛。
  - [x] SubTask 4.1: 在 [storyboard-video-workspace.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx) 的镜头列表新增多选（checkbox）与「合并所选分镜」按钮。
  - [x] SubTask 4.2: 依据 `storyboard-merge.ts` 实时校验并禁用/提示（非相邻、单选、超 30s）。
  - [x] SubTask 4.3: 合并成功后刷新项目、选中新分镜、清空多选，并给出「已合并，请重新选择参考素材并生成视频」提示。
  - [x] SubTask 4.4: 合并含二次确认弹窗（说明参考素材与视频将被清空），符合用户偏好的弹窗交互。

- [x] Task 5: 测试与验证。
  - [x] SubTask 5.1: 后端 pytest：相邻合并成功、非相邻拒绝、超 30s 拒绝、脚本拼接正确、素材/视频清空、重编号正确、下游 STALE（覆盖 memory 与 mysql，在 `.venv` 中运行）。
  - [x] SubTask 5.2: 前端 Vitest：`storyboard-merge.ts` 校验逻辑单测；工作台多选与合并按钮禁用/提示的组件测试。
  - [x] SubTask 5.3: 运行前后端相关测试套件确认通过。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 1, Task 2, Task 3, Task 4
