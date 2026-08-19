# 视频提示词原子时间轴与分镜可逆合并/拆分实施计划

## Summary

本次优化同时解决两个问题：

1. 合并分镜的视频提示词必须始终按合并前的原子分镜推进，不允许退化为单个整体区间。例如原子时长为 3、5、4 秒时，必须生成连续的 `[0s-3s]`、`[3s-8s]`、`[8s-12s]`，每个区间分别描述剧情、镜头、语音和字幕。
2. 新合并的分镜支持一次拆回全部最初原子分镜，恢复合并前的脚本与提示词；参考素材、首帧和视频关联不恢复，拆分后重新选择并生成。

已确认的产品决策：

- 时间轴使用连续的半开区间边界，后一段起点等于前一段终点；不采用 `0-3s` 后接 `4-8s` 这种存在空洞的表达。
- 示例中的 `<video1>`、`<pic>` 仅用于说明提示词结构；本次不新增参考素材自动编号或用途配置。
- 嵌套合并始终扁平保存最初叶子镜头，拆分一次恢复全部原子分镜。
- 拆分恢复标题、剧情、视觉提示、旁白、时长和原自定义提示词。
- 拆分后的参考素材、首帧、图片/视频关联全部为空，状态为 `draft`。
- 合并态提示词修改和已生成视频不分摊回原子镜头；拆分确认弹窗明确提示这些内容将被丢弃。
- 旧版本已经合并且没有原子快照的镜头不支持拆分，不做启发式推测或回填。
- 合并提示词允许编辑剧情和镜头内容，但保存时必须保留全部原子时间区间；区间缺失、调换、重叠、出现空洞或边界变化时拒绝保存。
- 拆分入口放在可拆分镜头卡片上的图标按钮，并使用二次确认弹窗。

## Current State Analysis

### 当前提示词构建

文件：

- `backend/app/video_prompt.py`
- `backend/app/schemas/storyboard.py`
- `backend/app/services/generation.py`

现状：

- `build_merged_shot_video_prompt(shots)` 在合并发生时可以按传入镜头生成多个连续区间。
- 合并提示词被保存到 `StoryboardShot.video_prompt`。
- `normalize_video_prompt()` 对包含固定章节的结构化提示词直接返回，不重新验证时间段。
- `StoryboardShot.effective_video_prompt` 只持有当前聚合镜头；一旦合并来源被删除，后续无法从当前镜头重新构建原子时间轴。
- 用户可通过视频配置 PATCH 保存任意结构化文本，当前没有合并时间轴完整性校验。

因此当前实现只能保证“合并当下”生成多段提示词，不能保证：

- 原子分镜信息持久保存。
- 合并镜头重新编辑后仍保留原子时间轴。
- 合并镜头可逆拆分。
- 嵌套合并后仍能恢复最初叶子镜头。

### 当前合并持久化

文件：

- `backend/app/repositories/base.py`
- `backend/app/repositories/memory.py`
- `backend/app/repositories/mysql.py`
- `backend/app/db/models.py`
- `backend/app/db/session.py`

现状：

- Memory/MySQL 合并逻辑将第一个镜头原地更新为聚合镜头，删除其余镜头。
- 只保留拼接后的 description、visual_prompt、narration、总时长和生成后的 video_prompt。
- 原镜头 ID、单镜头字段和单镜头提示词没有持久化快照。
- MySQL 已有 additive migration 机制，可为 `storyboard_shots` 增加 JSON 列。
- `storyboard_shots` 对 `(project_id, shot_index)` 有唯一约束，拆分插入和重编号必须使用事务内两阶段临时索引。

### 当前 API 与前端

文件：

- `backend/app/api/routes.py`
- `frontend/lib/api-types.ts`
- `frontend/lib/api-client.ts`
- `frontend/components/workspace/storyboard-video-workspace.tsx`
- `frontend/lib/storyboard-merge.ts`

现状：

- 合并端点为 `POST /api/projects/{project_id}/storyboard/shots/merge`，返回更新后的 `Project`。
- 合并成功后同步 STORYBOARD 文本产物并使下游产物失效。
- 前端有合并模式、相邻/30 秒校验和确认弹窗。
- 镜头响应没有 `is_merged`、原子数量或可拆分标记。
- 没有拆分 API、客户端方法和 UI。

## Proposed Changes

### 1. 新增原子分镜快照模型与合并元数据

**文件：`backend/app/schemas/storyboard.py`**

新增内部快照模型 `StoryboardAtomicShotSnapshot`，字段固定为：

- `id: str`：保留原镜头 ID，拆分时恢复。
- `title: str | None`
- `description: str`
- `visual_prompt: str`
- `narration: str | None`
- `duration_seconds: float`
- `video_prompt: str | None`

明确不保存：

- `status`
- `image_asset_id`
- `first_frame_asset_id`
- `first_frame_source_video_asset_id`
- `video_asset_id`
- 三类 reference asset IDs
- 原创建/更新时间

在 `StoryboardShotBase` 增加内部字段：

- `merge_source_shots: list[StoryboardAtomicShotSnapshot] = []`
- 该字段用于仓库和提示词构建，但从 API 序列化中排除，避免把完整恢复快照暴露给前端和扩大项目响应。

在 `StoryboardShot` 增加两个 API 可见的派生字段：

- `is_merged: bool`：`merge_source_shots` 非空。
- `merge_source_count: int`：原子快照数量。

使用 Pydantic `computed_field` 实现这两个只读派生字段，并通过 API 测试确保 FastAPI 的 `Project` 响应稳定包含它们。

兼容规则：

- 普通分镜：`merge_source_shots=[]`、`is_merged=false`、`merge_source_count=0`。
- 历史合并镜头无快照：仍视为不可拆分，不通过标题或提示词猜测。

### 2. 增加 MySQL/SQLite 原子快照存储

**文件：`backend/app/db/models.py`**

在 `StoryboardShotORM` 增加：

- `merge_source_shots JSON NOT NULL DEFAULT []`（ORM 默认 `list`）。

JSON 中只保存 `StoryboardAtomicShotSnapshot` 的字段。

**文件：`backend/app/db/session.py`**

在 `_apply_additive_migrations()` 的 storyboard 补列逻辑中增加：

- MySQL：`merge_source_shots JSON NULL`
- SQLite：`merge_source_shots JSON NOT NULL DEFAULT '[]'`

读取时统一将历史 `NULL` 转为空数组，不做数据回填。迁移是 additive，不删除或重写现有数据。

**文件：`backend/app/repositories/mysql.py`**

- `_storyboard_shot_from_orm()` 将 JSON 校验为 `StoryboardAtomicShotSnapshot` 列表并写入 schema。
- 创建/替换 storyboard 时同步该字段；普通新分镜写空数组。
- JSON 不合法时不得静默生成错误分镜；按现有持久化错误路径失败并记录可诊断异常。

### 3. 将提示词构建器改为以原子快照为权威时间轴

**文件：`backend/app/video_prompt.py`**

新增/调整以下能力：

#### 原子镜头展开

- `expand_atomic_shots(shot)`：
  - `merge_source_shots` 非空时返回该扁平快照列表。
  - 普通镜头返回由自身脚本字段构造的单个临时原子段。
- 合并多个镜头时，对每个已合并镜头展开其原子快照，再与普通镜头按当前 index 顺序拼接。
- 不保留嵌套快照层级，最终合并镜头只保存一层叶子原子列表。

#### 时间轴生成

- `build_merged_shot_video_prompt()` 改为接收扁平原子序列。
- 起点从 `0` 开始，终点按每个原子时长累加。
- 使用连续区间：
  - 3 秒、5 秒、4 秒 -> `[0s-3s]`、`[3s-8s]`、`[8s-12s]`
- 每个区间独立输出：
  - 剧情
  - 镜头/运镜/景别
  - 原自定义创作意图（存在时）
  - 普通话语音
  - 同步中文字幕
- 总时长、字幕样式、负向约束沿用现有固定章节。
- 保持 12000 字符上限和“优先保留时间戳与旁白”的压缩策略。

#### 合并时间轴解析与校验

新增纯函数：

- `extract_timeline_ranges(prompt) -> list[tuple[float, float]]`
- `expected_timeline_ranges(atomic_shots) -> list[tuple[float, float]]`
- `validate_merged_prompt_timeline(prompt, atomic_shots) -> None`

解析范围只限定在 `【连续时间轴】` 与下一固定章节之间，支持：

- `[0s-3s]`
- `0-3s`
- `0-3秒`

校验规则：

- 时间段数量等于原子快照数量。
- 第一段从 0 开始。
- 每段起止值与原子时长累积结果一致，浮点容差 0.001 秒。
- 后一段起点等于前一段终点。
- 不允许缺失、调换、重叠、空洞、负数或结束时间小于等于开始时间。

`normalize_video_prompt()` 对合并镜头始终基于 `merge_source_shots`：

- `video_prompt=None` 时重建标准原子时间轴。
- 已有结构化提示词通过上述校验后原样使用。
- 非结构化自定义文本作为整体创作意图嵌入标准原子时间轴，不把聚合镜头当作单个 `[0s-Ns]`。

### 4. 合并时持久保存扁平原子快照

**文件：`backend/app/repositories/base.py`**

保留现有：

- `merge_storyboard_shots(project_id, shot_ids) -> StoryboardShot`

新增：

- `split_storyboard_shot(project_id, shot_id) -> list[StoryboardShot]`

**文件：`backend/app/repositories/memory.py`**

合并时：

1. 校验所选镜头存在且相邻。
2. 按 index 排序。
3. 对已合并镜头使用其 `merge_source_shots`，对普通镜头创建快照。
4. 扁平拼成 `atomic_snapshots`。
5. 用该序列构建合并提示词。
6. 将 `atomic_snapshots` 保存到合并镜头。
7. 继续清空媒体关联并重编号。

拆分时：

1. 要求目标镜头 `merge_source_shots` 非空，否则抛出明确的 invalid state。
2. 删除合并镜头。
3. 在原合并镜头位置依次恢复全部原子镜头。
4. 恢复快照中的 ID、标题、description、visual_prompt、narration、duration 和 video_prompt。
5. 所有恢复镜头：
   - `status=draft`
   - 图片、首帧、视频和 reference IDs 全部为空
   - `merge_source_shots=[]`
   - 使用新的 created/updated 时间
6. 后续镜头整体后移，最终 index 连续为 `1..N`。
7. 同步项目聚合并返回恢复列表。

**文件：`backend/app/repositories/mysql.py`**

实现与 Memory 完全相同的语义。

拆分事务处理：

- 在单个 `session.begin()` 中读取并校验 JSON 快照。
- 删除合并镜头并 flush，释放第一个原子镜头原 ID。
- 将剩余镜头 index 临时改为负数并 flush，避开唯一约束。
- 插入恢复原子镜头。
- 按最终顺序统一写回正 index。
- 任一步失败时整个事务回滚，不留下半拆分状态。

嵌套合并测试必须证明最终 JSON 只保存叶子快照，不保存嵌套聚合镜头。

### 5. 保存合并提示词时强校验原子时间轴

**文件：`backend/app/api/routes.py`**

修改：

- `PATCH /projects/{project_id}/storyboard/shots/{shot_id}/video-config`

行为：

- 普通分镜沿用现有保存逻辑。
- 合并分镜且 `video_prompt` 非空时，调用 `validate_merged_prompt_timeline()`。
- 校验失败返回 `400 validation_error`，错误信息说明：
  - 需要保留的原子时间区间列表。
  - 当前错误属于数量、顺序、边界、空洞或重叠中的哪一种。
- 保存 `null` 允许清除手动版本；`effective_video_prompt` 随即根据快照重建标准时间轴。

生成视频前仍再次执行规范化/校验，防止旧数据或绕过配置接口的数据发送错误时间轴。

### 6. 新增拆分 API 并复用下游失效逻辑

**文件：`backend/app/api/routes.py`**

新增：

- `POST /api/projects/{project_id}/storyboard/shots/{shot_id}/split`
- 请求体为空。
- 响应为更新后的 `Project`。

错误语义：

- 项目或镜头不存在：`404 not_found`。
- 镜头没有原子快照（普通镜头或历史合并镜头）：`409 invalid_state`。
- 快照损坏或无法恢复：事务回滚，返回明确的持久化/校验错误，不部分写入。

成功后：

1. 调用 `repository.split_storyboard_shot()`。
2. 使用 `_storyboard_content_from_shots()` 重建 STORYBOARD 文本产物。
3. 与合并一致调用/触发 `mark_downstream_stale(project_id, Stage.STORYBOARD)`。
4. 返回带安全资产 URL 的完整 Project。

将“同步 storyboard 文本产物 + 下游失效 + 返回项目”的重复逻辑提取为私有 helper，供合并和拆分复用，避免两条路径漂移。

拆分不删除任何 Asset 文件。合并态视频和历史原子视频继续作为项目资产保留，但不关联到恢复镜头，并处于现有下游失效策略控制下。

### 7. 前端类型与 API 客户端

**文件：`frontend/lib/api-types.ts`**

在 `StoryboardShot` 增加：

- `is_merged: boolean`
- `merge_source_count: number`

不暴露完整 `merge_source_shots`。

**文件：`frontend/lib/api-client.ts`**

新增：

- `splitStoryboardShot(projectId, shotId, requestOptions?) -> Promise<Project>`
- 调用 `POST /api/projects/{projectId}/storyboard/shots/{shotId}/split`
- 不发送请求体。

### 8. 镜头卡片拆分入口与确认弹窗

**文件：`frontend/components/workspace/storyboard-video-workspace.tsx`**

状态与操作：

- 新增 `splitTargetShotId: string | null` 受控状态，并从当前 `shots` 派生目标镜头。
- `pendingAction` 使用 `split:{shotId}`，与保存、合并和生成操作互斥。
- `handleSplitShot()` 调用 API 后：
  - 刷新 shots、assets 和 configs。
  - 清空该镜头相关本地 task/config 缓存。
  - 选中恢复后的第一个原子分镜。
  - 调用 `onProjectUpdated(updatedProject)`。
  - 显示成功提示：“已恢复 N 个原子分镜，参考素材与视频需重新选择并生成。”

镜头卡片：

- 仅 `shot.is_merged && shot.merge_source_count > 1` 时显示 `Split` 图标按钮。
- 按钮使用 `aria-label="拆分为 N 个原子分镜"` 和 tooltip/title。
- 点击图标只打开确认弹窗，不触发卡片选中或编辑弹窗。
- 合并模式下禁用拆分图标，避免同时操作选择集。
- 历史合并镜头没有快照，不显示拆分入口。

确认弹窗：

- 标题：“确认拆分合并分镜？”
- 显示将恢复的原子分镜数量。
- 明确说明：
  - 恢复合并前的脚本、时长和提示词。
  - 合并态提示词修改不会分摊回原子分镜。
  - 参考素材、首帧和已生成视频不会恢复。
  - 下游成片会标记为待更新。
- 使用“取消”和“确认拆分”按钮，处理中显示 loading。

合并确认文案同步补充：

- “将保存 N 个原子分镜，可稍后拆分恢复。”

### 9. 测试

#### 后端提示词单元测试

文件：

- 修改 `backend/tests/test_video_prompt.py`

覆盖：

- 普通分镜仍生成单个 `[0s-Ns]`。
- 5 个原子分镜生成 5 个连续区间，不出现整体 `[0s-total]` 作为唯一剧情段。
- 小数时长累积准确，容差规则稳定。
- 嵌套合并展开为叶子原子顺序。
- `extract_timeline_ranges()` 支持三种允许格式。
- 时间段缺失、调换、重叠、空洞、边界变化均被拒绝。
- 合法编辑可保存且规范化幂等。
- 非结构化整体创作意图不会破坏原子时间轴。
- 长提示词压缩不删除任一时间段。

#### 后端仓库/API 测试

文件：

- 修改 `backend/tests/test_storyboard_video_workspace.py`
- 修改 `backend/tests/test_database.py`（如现有迁移测试位于该文件）

Memory 与 MySQL 均覆盖：

- 合并保存原子快照并暴露 `is_merged/count`。
- 合并包含已合并镜头时快照扁平化。
- 拆分恢复原 ID、脚本字段、时长和自定义提示词。
- 拆分后媒体关联为空、状态为 draft、index 连续。
- 普通镜头和历史无快照镜头返回 409。
- 拆分失败事务回滚。
- 拆分后 STORYBOARD 文本产物同步、下游资产 stale。
- 合并态生成视频后拆分不删除 Asset 文件。
- PATCH 合并提示词执行强时间轴校验。
- additive migration 为旧表补充 JSON 列，旧行按空数组读取。

#### 前端测试

文件：

- 修改 `frontend/tests/api-client.test.ts`
- 修改 `frontend/tests/project-workspace.test.tsx`
- 更新受 `StoryboardShot` 新字段影响的 fixtures。

覆盖：

- split API URL、POST 方法和空请求体。
- 普通镜头不显示拆分入口。
- 历史无快照合并镜头不显示入口。
- 可拆分镜头显示原子数量和图标按钮。
- 点击图标不会打开编辑弹窗。
- 确认弹窗展示丢弃/清空说明。
- 确认后调用正确 shot ID，刷新项目并选中第一个恢复镜头。
- 拆分中按钮禁用并显示 loading。
- API 失败显示用户可理解错误且不改变本地镜头。
- 合并确认文案包含可恢复原子数量。

## Assumptions & Decisions

- “原子分镜”定义为本次可逆快照链中的叶子镜头，而不是按固定秒数重新切割。
- 快照捕获合并发生时的当前脚本与提示词；不会追溯到项目第一次生成 storyboard 时的历史版本。
- 拆分恢复原镜头 ID，便于保持稳定身份；媒体关联仍按已确认规则清空。
- 拆分是一次性恢复：恢复出的镜头都是普通原子镜头，不保留新的可拆分标记。
- 重新合并恢复出的镜头会创建新的快照，仍可再次拆分。
- 时间轴采用连续边界，官方示例语义为 `[0,3)` 后接 `[3,8)`；显示文本仍使用易读的 `0-3s`/`[0s-3s]`。
- 参考素材继续通过 Seedance request role 传递；不在提示词中自动猜测“白模”“关键帧”“角色”用途。
- 不删除或复制任何资产文件。
- 不为旧合并数据做启发式迁移；无快照即不可拆分。
- Python 测试和验证全部使用项目根目录 `.venv`。

## Verification

按以下顺序执行：

1. 后端提示词测试：

   ```bash
   .venv/bin/python -m pytest backend/tests/test_video_prompt.py -q
   ```

2. 后端分镜工作台与数据库测试：

   ```bash
   .venv/bin/python -m pytest \
     backend/tests/test_storyboard_video_workspace.py \
     backend/tests/test_database.py -q
   ```

3. 后端全量测试：

   ```bash
   .venv/bin/python -m pytest backend/tests/ -q
   ```

4. 前端测试：

   ```bash
   cd frontend && npm test
   ```

5. 前端类型检查：

   ```bash
   cd frontend && npm run typecheck
   ```

6. 运行态 API 验证：

   - 新建 3 个不同时长的相邻镜头并合并。
   - GET video config，确认包含 3 个连续原子区间而不是单个整体区间。
   - 删除或修改任一时间区间后 PATCH，确认返回 validation error。
   - 合法修改每段剧情后 PATCH，确认保存成功。
   - POST split，确认恢复 3 个原子镜头、ID/脚本/时长/提示词正确、媒体字段为空、index 连续。
   - 再次合并并与相邻镜头二次合并，确认拆分一次恢复全部叶子原子镜头。

7. UI 验收：

   - 普通和历史无快照镜头无拆分按钮。
   - 新合并镜头显示拆分图标和原子数量。
   - 拆分确认弹窗准确说明丢弃与清空范围。
   - 拆分成功后自动选中第一个恢复镜头并显示成功反馈。
   - 合并、拆分、编辑提示词和视频生成操作不会并发冲突。
