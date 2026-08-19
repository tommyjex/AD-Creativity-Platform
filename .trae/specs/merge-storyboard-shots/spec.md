# 分镜合并（Merge Storyboard Shots）Spec

## Why
分镜视频工作台目前只能逐个分镜生成视频。当创作者希望把相邻的几个短镜头合成为一个连续、时长更长的镜头（以获得更连贯的运镜与叙事）时，缺少「合并」能力。由于底层视频模型 Seedance 2.5 单次生成最长 30s，合并需要在时长约束下进行，并保证合并后分镜脚本、参考素材、视频状态一致收敛。

## What Changes
- 在「分镜视频工作台」左侧镜头列表新增多选与「合并所选分镜」操作。
- 合并仅允许选择**相邻**分镜（index 连续），且所选分镜 `duration_seconds` 之和**不超过 30s**，否则禁用/拦截并给出原因。
- 合并生成一个新分镜，占据被选分镜中最靠前的 index 位置，其余分镜删除并对整个分镜序列重新连续编号（1..N）。
- 合并后新分镜的脚本字段按镜头顺序**分段拼接**：`description`、`visual_prompt`、`narration` 分别换行拼接；`title` 合并为「镜头 X-Y」形式；`duration_seconds` 为各镜头之和。
- 合并后新分镜的 `video_prompt` **清空**（后续由拼接后的字段重新生成默认提示词）。
- 合并后新分镜的**参考素材清空**（`reference_image_asset_ids` / `reference_video_asset_ids` / `reference_audio_asset_ids`）、**首帧控制清空**（`first_frame_asset_id` / `first_frame_source_video_asset_id`）、**视频清空**（`video_asset_id` 置空，`status` 重置为 `draft`/待生成），需要用户在工作台重新选择素材并手动点击「生成当前分镜视频」。
- 合并操作触发 `mark_downstream_stale(STORYBOARD)`，与删除分镜保持一致的下游失效语义。
- 同步更新 STORYBOARD 文本产物（storyboard text artifact）以反映合并后的镜头列表，保证脚本与结构化分镜一致。

## Impact
- Affected specs: 分镜视频工作台（storyboard video workspace）、分镜脚本产物（storyboard text artifact）。
- Affected code:
  - 后端 schema：[storyboard.py](file:///Users/bytedance/AD-Creativity/backend/app/schemas/storyboard.py)（新增合并请求模型）。
  - 后端仓库：[mysql.py](file:///Users/bytedance/AD-Creativity/backend/app/repositories/mysql.py)、[memory.py](file:///Users/bytedance/AD-Creativity/backend/app/repositories/memory.py)、[base.py](file:///Users/bytedance/AD-Creativity/backend/app/repositories/base.py)（新增 `merge_storyboard_shots`）。
  - 后端路由：[routes.py](file:///Users/bytedance/AD-Creativity/backend/app/api/routes.py)（新增合并端点，含 30s/相邻校验与下游失效）。
  - 前端类型与客户端：[api-types.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/api-types.ts)、[api-client.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/api-client.ts)（新增 `mergeStoryboardShots`）。
  - 前端工作台：[storyboard-video-workspace.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/storyboard-video-workspace.tsx)（多选 UI、合并按钮、校验提示、状态收敛）。
  - 前端校验辅助：新增 `lib/storyboard-merge.ts`（相邻/时长校验、脚本拼接工具）。

## ADDED Requirements

### Requirement: 相邻分镜合并
系统 SHALL 允许用户在分镜视频工作台选择两个及以上**相邻**（index 连续）分镜并将其合并为一个新分镜。

#### Scenario: 合并两个相邻分镜
- **WHEN** 用户勾选 index 连续的分镜（如 Shot 02、Shot 03），且它们的 `duration_seconds` 之和 ≤ 30
- **THEN** 系统创建一个占据最小 index 位置的新分镜，删除原被选分镜，并将全部分镜重新连续编号

#### Scenario: 选择非相邻分镜被拒绝
- **WHEN** 用户勾选 index 不连续的分镜（如 Shot 02、Shot 04）
- **THEN** 系统禁用「合并所选分镜」操作，并提示「仅支持合并相邻分镜」

#### Scenario: 只选择一个分镜
- **WHEN** 用户仅勾选一个分镜或未勾选
- **THEN** 「合并所选分镜」操作不可用

### Requirement: 30 秒时长约束
系统 SHALL 在合并前校验所选分镜 `duration_seconds` 之和不超过 30 秒（Seedance 2.5 单次生成上限）。

#### Scenario: 合并总时长超过 30 秒被拒绝
- **WHEN** 用户勾选的相邻分镜时长之和 > 30
- **THEN** 系统拦截合并并提示「合并后镜头总时长不能超过 30 秒（当前 Xs）」，前端禁用合并按钮，后端返回校验错误

#### Scenario: 合并总时长恰为 30 秒
- **WHEN** 所选分镜时长之和恰为 30
- **THEN** 合并被允许，新分镜 `duration_seconds` 为 30

### Requirement: 合并后脚本组合
系统 SHALL 将被合并分镜的脚本字段按镜头顺序分段拼接生成新分镜脚本，并同步更新 STORYBOARD 文本产物。

#### Scenario: 脚本分段拼接
- **WHEN** 合并发生
- **THEN** 新分镜的 `description`、`visual_prompt`、`narration` 分别按原镜头顺序换行拼接（空字段跳过），`title` 为「镜头 X-Y」，`duration_seconds` 为各镜头之和，`video_prompt` 置空

#### Scenario: 分镜文本产物同步
- **WHEN** 合并完成
- **THEN** STORYBOARD 文本产物内容反映合并后的镜头序列（镜头数量与编号一致）

### Requirement: 合并后素材与视频重置
系统 SHALL 在合并后清空新分镜的参考素材、首帧控制与已生成视频，要求用户重新选择素材并手动生成视频。

#### Scenario: 参考素材与首帧清空
- **WHEN** 合并发生
- **THEN** 新分镜的 `reference_image_asset_ids`、`reference_video_asset_ids`、`reference_audio_asset_ids` 为空，`first_frame_asset_id`、`first_frame_source_video_asset_id` 为空

#### Scenario: 视频重置为待生成
- **WHEN** 合并发生
- **THEN** 新分镜 `video_asset_id` 为空、`status` 为待生成状态，工作台显示「待生成」，需用户手动点击「生成当前分镜视频」

#### Scenario: 下游产物失效
- **WHEN** 合并完成
- **THEN** 系统调用 `mark_downstream_stale(STORYBOARD)`，使依赖分镜的下游产物（成片等）标记为 STALE

#### Scenario: 资产库文件保留
- **WHEN** 合并清空参考素材关联
- **THEN** 仅解除当前分镜与素材的关联，资产库中的原始文件不被删除
