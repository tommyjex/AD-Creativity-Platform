# 资产库增加 AIGC 工作台来源 Spec

## Why
当前资产库将 `metadata.origin=aigc` 的资产混在“工具资产”来源中，用户无法快速定位 AIGC 工作台画布上传和生成的素材；生成资产也缺少统一、可搜索的业务名称。

本次变更为资产库新增独立的“AIGC工作台”来源，并统一新生成公开资产的展示与下载命名。

## What Changes
- 资产库“来源”筛选新增“AIGC工作台”。
- 选择“AIGC工作台”后，仅展示 `metadata.origin === "aigc"` 且符合现有公开资产可见性规则的输入与输出资产。
- “工具资产”来源调整为只展示非 AIGC 的独立工具资产，避免同一资产同时归入两个来源。
- “全部资产”继续展示项目资产、独立工具资产和 AIGC 工作台资产，且每个资产只出现一次。
- AIGC 来源资产卡片明确展示“AIGC工作台”来源及“AIGC 输入 / AIGC 输出”角色。
- AIGC 工作台新生成的公开输出资产使用 `画布名-节点名-资产类型序号.扩展名` 作为 `metadata.name` 和默认下载文件名，并写入 `metadata.name_scheme="aigc_canvas_node_v1"`。
- AIGC 工作台上传的输入资产保留用户原始文件名，不强制改名。
- 历史 AIGC 资产不回填名称；无新命名元数据时沿用现有展示回退规则。
- 不修改对象存储 key，不复制或迁移既有对象。

## Impact
- Affected specs:
  - 资产库来源筛选与展示
  - AIGC 工作台资产归档
  - AIGC 资产展示名与下载名
- Affected code:
  - `frontend/app/workspace/assets/page.tsx`
  - `frontend/components/workspace/workspace-asset-library.tsx`
  - `frontend/lib/asset-display.ts`
  - `frontend/lib/aigc/download.ts`
  - `frontend/tests/workspace-asset-library.test.tsx`
  - `frontend/tests/api-client.test.ts`
  - `backend/app/api/aigc_routes.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/assets.py`
  - AIGC 节点显示名/资产命名辅助模块及对应测试
- Not changed:
  - 不新增数据库列或迁移。
  - 不改变 `Asset.project_id`、`tool_asset_role`、`asset_role` 或 AIGC 引用保护语义。
  - 不改变 TOS 对象 key 和已有资产 URL。
  - 不将内部底图、拆分图层等非公开资产暴露到普通资产库。

## ADDED Requirements

### Requirement: AIGC 工作台来源筛选
资产库 SHALL 在“来源”筛选中提供“AIGC工作台”选项。来源判定先应用现有公开可见性规则，再按以下顺序归类：
1. `project_id !== null` 归为“项目资产”。
2. `project_id === null`、`tool_asset_role !== null` 且 `metadata.origin === "aigc"` 归为“AIGC工作台”。
3. `project_id === null`、`tool_asset_role !== null` 且 `metadata.origin !== "aigc"` 归为“工具资产”。
4. 不满足以上条件的资产不因本次变更新增展示。

该顺序确保历史异常数据即使同时带有 `project_id` 和 `origin=aigc`，仍稳定归入项目资产；三个来源集合互斥。

#### Scenario: 筛选 AIGC 工作台资产
- **WHEN** 用户将来源设置为“AIGC工作台”并提交筛选
- **THEN** 资产库只展示 `project_id === null`、`tool_asset_role !== null`、`metadata.origin === "aigc"` 的公开资产
- **AND** 同时包含 `aigc_role=input` 的画布上传素材和公开输出资产
- **AND** 不展示项目资产或非 AIGC 的独立工具资产

#### Scenario: AIGC 来源筛选与其他条件组合
- **WHEN** 用户选择“AIGC工作台”并同时设置状态、资产分区或搜索关键词
- **THEN** 系统先限定 AIGC 来源，再应用其他筛选条件
- **AND** 项目筛选不可用且不携带 `project_id`，因为 AIGC 工作台资产不属于项目

#### Scenario: AIGC 来源空态
- **WHEN** 当前条件下没有可见的 AIGC 工作台资产
- **THEN** 页面展示仅针对 AIGC 工作台来源的空态
- **AND** 不回退展示项目资产或独立工具资产

### Requirement: 来源集合互斥
资产库 SHALL 将非项目资产拆分为“工具资产”和“AIGC工作台”两个互斥来源。

#### Scenario: 筛选独立工具资产
- **WHEN** 用户选择“工具资产”
- **THEN** 系统仅展示具有工具资产角色且 `metadata.origin !== "aigc"` 的公开资产

#### Scenario: 查看全部资产
- **WHEN** 用户选择“全部资产”
- **THEN** 系统展示项目资产、独立工具资产和 AIGC 工作台资产
- **AND** 每个资产按资产 ID 只展示一次

#### Scenario: 解析来源查询参数
- **WHEN** URL 中 `source=aigc`
- **THEN** 服务端页面将其识别为有效来源并稳定渲染 AIGC 结果
- **WHEN** URL 中来源值未知
- **THEN** 系统回退到现有默认来源行为

### Requirement: AIGC 资产来源信息
资产库 SHALL 在 AIGC 资产卡片和预览详情中明确展示来源与角色，使用户可以区分画布输入和生成输出。

#### Scenario: 展示 AIGC 输入
- **WHEN** AIGC 资产的 `tool_asset_role=input`
- **THEN** 卡片显示来源“AIGC工作台”和角色“AIGC 输入”

#### Scenario: 展示 AIGC 输出
- **WHEN** AIGC 资产的 `tool_asset_role=output`
- **THEN** 卡片显示来源“AIGC工作台”和角色“AIGC 输出”
- **AND** 现有预览、下载、删除和引用保护能力保持不变

#### Scenario: 来源元数据异常
- **WHEN** 公开 AIGC 资产的 `metadata.aigc_role` 缺失或为历史扩展值
- **THEN** 来源仍由 `metadata.origin` 判定
- **AND** 输入/输出角色由强类型 `tool_asset_role` 判定，不依赖自由格式 metadata

#### Scenario: 隐藏内部资产
- **WHEN** AIGC 任务产生 `asset_role` 非 `public` 的底图或拆分图层
- **THEN** 这些内部资产不因新增来源筛选而出现在普通资产库

### Requirement: AIGC 输出资产命名
系统 SHALL 为 AIGC 工作台新生成的公开媒体输出写入可读名称，格式为 `画布名-节点显示名-资产类型序号.扩展名`。

名称字段 SHALL 按以下规则取值：
- 画布名取输出资产落库时 Pipeline 的当前名称。
- 节点显示名取产生该资产的 Run 不可变 `definition_snapshot`，使用与前端画布一致的节点显示名算法。
- 资产类型按最终 MIME 类型映射为 `图片`或`视频`。
- 序号取任务输出引用的 `ordinal + 1`；单输出仍保留序号 `1`。
- 扩展名按最终校验后的 MIME 类型生成。

节点默认基础名固定为：`llm → LLM`、`text_to_image → 文生图`、`video_generation → 生视频`、`video_enhancement → 视频画质增强`、`video_face_blur → 视频人脸打码`、`multi_track_edit → 多轨剪辑`、`layer_canvas → 图层画布`、`layer_composite → 图层合成`、`text/image/video/audio → 文本节点/图片节点/视频节点/音频节点`。`image_to_image` 按 operation 映射为 `图生图 / 图片编辑 / 图层拆分`。兼容 v1 definition 时先使用既有迁移规则规范为 v2。节点配置存在 `config.title` 且 trim 后非空时优先使用标题；否则使用基础名。同一基础名在 definition 中只有一个时不追加节点序号，存在多个时按节点数组顺序追加 1-based 序号。

本期 MIME 映射固定为：

| 最终 MIME 类型 | 资产类型 | 扩展名 |
| --- | --- | --- |
| `image/png` | 图片 | `.png` |
| `image/jpeg` | 图片 | `.jpg` |
| `image/webp` | 图片 | `.webp` |
| `video/mp4` | 视频 | `.mp4` |
| `video/quicktime`、`video/mov` | 视频 | `.mov` |

AIGC 工作台当前没有创建公开音频或字幕输出的执行器；上传的音频和字幕属于输入资产，保留原始文件名，不进入本期统一输出命名范围。

#### Scenario: 命名单个图片输出
- **WHEN** 名为“商品主图”的画布中，“图生图1”节点生成第一个 PNG 输出
- **THEN** 资产 `metadata.name` 为 `商品主图-图生图1-图片1.png`
- **AND** 资产库卡片、搜索和默认下载文件名使用该名称

#### Scenario: 命名多个同类输出
- **WHEN** 同一节点的一次任务产生多个同类公开输出
- **THEN** 序号按任务输出 ordinal 从 1 开始稳定递增
- **AND** 名称依次使用 `图片1`、`图片2`，或对应的 `视频N`、`音频N`

#### Scenario: 解析节点显示名
- **WHEN** 节点配置了非空自定义标题
- **THEN** 命名使用该标题作为节点名
- **WHEN** 节点未配置标题
- **THEN** 后端按画布 definition 中的节点顺序和节点类型，生成与前端一致的默认显示名
- **AND** 同类节点仅有一个时不加节点序号，同类节点有多个时按 definition 顺序使用 1-based 序号

#### Scenario: 文件名安全规范化
- **WHEN** 画布名或节点名包含路径分隔符、控制字符、首尾空白或文件系统非法字符
- **THEN** 系统将 ASCII 控制字符、DEL 和 `/ \ : * ? " < > |` 替换为 `-`
- **AND** 将连续空白或 `-` 折叠为单个 `-`，并移除首尾空白、点和 `-`
- **AND** 保留合法中文、英文、数字
- **AND** 在保留完整扩展名和 UTF-8 字符边界的前提下，将最终文件名限制为 180 bytes
- **AND** 超长时始终完整保留 `-资产类型序号.扩展名`，先截断画布名，再在仍超限时截断节点名
- **AND** 画布名规范化后为空时使用 `AIGC画布`，节点名规范化后为空时使用 `AIGC节点`

#### Scenario: 确定扩展名
- **WHEN** 输出资产完成持久化
- **THEN** 扩展名依据已验证的最终 MIME 类型确定
- **AND** 图片和视频使用映射表中与实际内容一致的扩展名
- **AND** 无法映射的 MIME 类型视为归档失败，沿用现有失败清理路径且不得留下孤儿对象或资产记录

#### Scenario: 上传输入资产
- **WHEN** 用户在 AIGC 工作台上传输入图片、视频、音频或字幕
- **THEN** 资产仍归入“AIGC工作台”来源
- **AND** 展示名保留用户原始文件名，不套用生成输出命名规则

#### Scenario: 画布后续改名
- **WHEN** 已生成资产所属画布或节点后续改名
- **THEN** 已生成资产名称保持创建时的值，不做追溯重命名
- **AND** 后续新 Run 使用输出落库时的当前画布名及该 Run 快照中的节点名

#### Scenario: 历史资产兼容
- **WHEN** AIGC 资产没有 `metadata.name_scheme="aigc_canvas_node_v1"`
- **THEN** 系统继续使用现有 description、name、prompt 摘要或默认文案回退
- **AND** 不执行数据库回填或对象存储重命名

#### Scenario: 新命名资产的展示优先级
- **WHEN** AIGC 资产具有 `metadata.name_scheme="aigc_canvas_node_v1"`
- **THEN** 资产库卡片、搜索和下载优先使用 `metadata.name`
- **AND** Provider 返回的 description 或 prompt 不覆盖该统一名称

## MODIFIED Requirements

### Requirement: 资产库来源展示
现有资产库 SHALL 将来源集合扩展为“全部资产 / 项目资产 / 工具资产 / AIGC工作台”。AIGC 工作台来源展示所有无项目归属、具有工具资产角色、`metadata.origin === "aigc"` 且符合现有公开可见性规则的输入与输出资产；工具资产来源排除这些 AIGC 资产。

### Requirement: AIGC 输出归档
AIGC 工作台在保存公开媒体输出时 SHALL 保留现有 `origin`、`aigc_role`、pipeline、run、node、task 和输入输出引用元数据，并额外写入符合本规格的 `metadata.name` 与 `metadata.name_scheme`。命名失败不得留下仅上传未落库的孤儿对象。

## REMOVED Requirements

无。

## Constraints
- 来源筛选优先复用现有 `/api/tools/assets` 返回数据并在资产库聚合层互斥分组；本期不要求新增来源查询 API。
- 名称是展示与下载语义，不替代资产 ID，不参与引用关系或缓存键计算。
- 仅对带有新命名方案标记的 AIGC 资产，资产库展示和搜索优先使用 `metadata.name`；历史 AIGC 与非 AIGC 资产保持现有描述优先级。
- 新名称仅适用于本变更上线后创建的公开 AIGC 输出资产。
