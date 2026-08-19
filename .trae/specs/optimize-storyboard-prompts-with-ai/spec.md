# 分镜视频提示词 AI 优化 Spec

## Why

当前分镜提示词编辑窗口只能手动编辑和保存，用户需要自行把剧情、镜头语言、连续时间轴、语音字幕和参考素材关系整理成适合 Seedance 2.5 的完整提示词。增加 AI 优化入口，可以在保留原剧情和时间边界的前提下，快速将草稿整理为符合现有视频提示词原则的可生成文本。

## What Changes

- 在分镜视频提示词编辑区域标题旁增加“AI 优化”按钮。
- 新增同步提示词优化 API，接收当前编辑草稿并返回优化后的提示词，不自动保存。
- AI 优化使用项目 brief、当前分镜字段、合并分镜原子时间轴、当前草稿及已选参考素材类型/编号作为上下文。
- 草稿为空时使用当前分镜的 `effective_video_prompt` 作为优化输入。
- 优化只增强结构、镜头语言、动作连续性、生成约束和语音字幕表达，不改变人物、剧情事件、台词、原子时间边界或参考素材关系。
- 优化结果必须满足现有视频提示词规则，并通过后端时长和时间轴校验。
- 优化成功后仅替换前端草稿并进入未保存状态；用户仍需点击“保存提示词”才写入数据库。
- AI 调用失败、输出非法或超长时保留原草稿并显示脱敏错误。
- 不新增数据库字段，不创建后台任务，不自动触发视频生成或下游失效。

## Impact

- Affected specs:
  - 分镜视频工作台提示词编辑
  - Seedance 视频提示词构建与校验
  - ModelArk 文本生成能力
- Affected code:
  - `backend/app/schemas/storyboard.py`
  - `backend/app/services/modelark.py`
  - `backend/app/services/generation.py`
  - `backend/app/video_prompt.py`
  - `backend/app/api/routes.py`
  - `frontend/lib/api-types.ts`
  - `frontend/lib/api-client.ts`
  - `frontend/components/workspace/storyboard-video-workspace.tsx`
  - `frontend/components/workspace/storyboard-shot-editor-dialog.tsx`
  - 后端与前端相关测试

## ADDED Requirements

### Requirement: 分镜提示词 AI 优化入口

系统 SHALL 在分镜提示词编辑区域标题旁提供“AI 优化”按钮，按钮使用简洁图标与文字，并与现有保存操作区分。

#### Scenario: 用户看到 AI 优化入口

- **WHEN** 用户打开某个分镜的提示词编辑弹窗且配置加载成功
- **THEN** “视频生成提示词”标题旁显示“AI 优化”按钮
- **AND** 按钮具备明确的可访问名称

#### Scenario: 其他操作进行中

- **WHEN** 当前分镜正在保存提示词、上传/关联素材或执行 AI 优化
- **THEN** AI 优化按钮禁用
- **AND** 不允许并发发起第二次优化

### Requirement: 同步提示词优化 API

系统 SHALL 提供同步接口：

`POST /api/projects/{project_id}/storyboard/shots/{shot_id}/optimize-video-prompt`

请求体：

```json
{
  "video_prompt": "当前编辑草稿，允许为 null"
}
```

成功响应：

```json
{
  "optimized_prompt": "优化后的完整视频生成提示词"
}
```

`video_prompt` 非空时最大长度为 12000 字符，首尾空白应被清理；空字符串按 `null` 处理。

#### Scenario: 使用当前草稿优化

- **WHEN** 用户提交非空草稿
- **THEN** 后端以该草稿作为主要优化对象
- **AND** 返回符合当前分镜约束的完整优化提示词

#### Scenario: 空白草稿优化

- **WHEN** 用户提交 `null` 或空白草稿
- **THEN** 后端使用当前分镜的 `effective_video_prompt` 作为优化输入
- **AND** 返回完整优化提示词

#### Scenario: 项目或分镜不存在

- **WHEN** 项目或分镜 ID 无效
- **THEN** API 返回 `404 not_found`
- **AND** 不调用模型

### Requirement: 完整但安全的优化上下文

系统 SHALL 从后端权威数据构建优化上下文，不接受客户端伪造项目、分镜或参考素材上下文。

上下文 SHALL 包含：

- 项目 brief：商品、原始需求、摘要、卖点、平台、画幅、总时长、风格、目标受众。
- 当前分镜：标题、剧情描述、视觉提示、旁白、分镜时长。
- 合并分镜：全部原子分镜的顺序、时长、剧情、视觉提示、旁白和期望连续时间区间。
- 当前编辑草稿；为空时使用 `effective_video_prompt`。
- 当前分镜已选参考素材摘要：
  - 是否使用首帧。
  - 是否使用上一分镜尾帧。
  - `参考图1..N`、`参考视频1..N`、`参考音频1..N` 的类型和编号。

上下文 SHALL NOT 包含：

- API Key、数据库凭据或内部错误。
- TOS 签名 URL、对象存储签名参数或原始供应商响应。
- 未被当前分镜选中的项目资产内容。

#### Scenario: 分镜带参考素材

- **WHEN** 当前分镜选择了多种参考素材
- **THEN** AI 指令包含与编辑器一致的标准编号
- **AND** AI 不得臆造不存在的参考素材编号或用途

### Requirement: AI 优化遵循现有视频提示词原则

系统 SHALL 复用 `backend/app/video_prompt.py` 中的现有提示词规则作为输出契约。

优化结果 SHALL：

- 包含 `【整体要求】`、`【连续时间轴】`、`【语音与字幕】`、`【负向约束】`。
- 保持指定画幅和当前分镜总时长。
- 单分镜保留唯一完整区间 `[0s-Ns]`。
- 合并分镜保留全部原子分镜时间区间，数量、顺序和边界不可改变。
- 后一时间段起点等于前一时间段终点，不得出现空洞、重叠或调换。
- 保留人物身份、角色外形、剧情事件、台词含义和参考素材关系。
- 仅增强景别、机位、运镜、动作连续性、镜头调度、节奏、转场、主体一致性及可生成性描述。
- 有旁白时要求自然清晰的普通话语音，并生成逐字一致的同步简体中文字幕。
- 字幕位于底部安全区，白字黑描边，最多两行；不得增加未指定字幕、说明文字或水印。
- 无旁白时仅保留环境音和动作音，不新增对白或字幕。
- 总长度不超过 12000 字符。

优化结果 SHALL NOT：

- 改写核心剧情或新增剧情事件。
- 改变人物、商品、台词含义或行动号召。
- 改变分镜时长、原子时间边界或镜头顺序。
- 自动新增参考素材编号或猜测素材内容。
- 输出 Markdown 代码围栏、解释、分析过程或多个候选版本。

#### Scenario: 优化普通分镜

- **WHEN** 普通分镜草稿发起 AI 优化
- **THEN** 返回结果包含 `[0s-Ns]`
- **AND** 剧情、旁白和时长保持不变
- **AND** 镜头语言及生成约束得到增强

#### Scenario: 优化合并分镜

- **WHEN** 含多个原子分镜的合并镜头发起 AI 优化
- **THEN** 返回结果保留全部原子时间区间
- **AND** 每个区间仍对应原来的原子剧情
- **AND** 结果通过 `validate_merged_prompt_timeline`

### Requirement: 模型适配与输出校验

系统 SHALL 通过现有 ModelArk 文本模型同步生成一个 JSON 对象：

```json
{
  "optimized_prompt": "..."
}
```

真实适配器与 mock 适配器 SHALL 使用相同请求/响应契约。

后端 SHALL 在返回前：

1. 校验 JSON 响应结构。
2. 清理首尾空白和 Markdown 代码围栏。
3. 校验非空及 12000 字符上限。
4. 校验固定章节。
5. 根据当前分镜或原子快照校验时间段数量、顺序和边界。
6. 校验结果总时长与当前分镜一致。

任何校验失败 SHALL 视为安全的生成失败，不返回残缺结果。

#### Scenario: 模型输出非法

- **WHEN** 模型返回非 JSON、空提示词、超长提示词或错误时间轴
- **THEN** API 返回脱敏的生成失败错误
- **AND** 不保存任何提示词
- **AND** 不改变当前分镜或下游状态

### Requirement: 优化结果仅替换前端草稿

系统 SHALL 在优化成功后将 `optimized_prompt` 写入当前编辑框草稿，不调用提示词保存 API。

#### Scenario: 优化成功

- **WHEN** AI 优化接口成功返回
- **THEN** 编辑框内容替换为优化结果
- **AND** `savedPrompt` 保持为优化前最后保存值
- **AND** 显示“AI 优化完成，请确认后保存”
- **AND** 用户可以继续编辑或点击“保存提示词”

#### Scenario: 优化后关闭弹窗

- **WHEN** 优化结果尚未保存且用户关闭编辑弹窗
- **THEN** 复用现有未保存内容确认弹窗
- **AND** 用户可继续编辑或放弃优化结果

#### Scenario: 优化失败

- **WHEN** 网络、模型或输出校验失败
- **THEN** 编辑框保留优化前草稿
- **AND** 显示可理解且脱敏的错误

### Requirement: 优化状态与竞争控制

系统 SHALL 使用 `pendingAction="optimize:{shot_id}"` 表示当前分镜正在优化。

#### Scenario: 优化进行中

- **WHEN** 优化请求尚未完成
- **THEN** AI 优化按钮显示 loading 和“优化中”
- **AND** 编辑框、保存、素材操作及关闭相关提交操作按现有串行锁规则禁用

#### Scenario: 分镜切换或响应过期

- **WHEN** 优化请求返回时当前编辑分镜已变化或弹窗已关闭
- **THEN** 过期结果不得覆盖其他分镜的草稿

### Requirement: 优化不产生持久化副作用

系统 SHALL 将 AI 优化视为草稿辅助操作。

#### Scenario: 仅点击 AI 优化

- **WHEN** 用户完成 AI 优化但未点击保存
- **THEN** `StoryboardShot.video_prompt` 不变
- **AND** 不创建 GenerationTask
- **AND** 不标记 storyboard、video 或 compose 产物 stale
- **AND** 不触发视频生成

## MODIFIED Requirements

### Requirement: 分镜提示词编辑

分镜提示词编辑弹窗 SHALL 同时支持手动编辑、参考素材标准引用插入、AI 优化和显式保存。AI 优化只改变本地草稿，只有“保存提示词”操作才能修改持久化配置。

### Requirement: 视频提示词规范

所有 AI 优化结果 SHALL 与默认提示词、手动提示词规范化和合并提示词使用相同的时间轴、语音字幕、长度及负向约束规则；AI 优化不得成为绕过合并原子时间轴强校验的路径。

## REMOVED Requirements

无。
