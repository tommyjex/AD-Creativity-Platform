# 图片素材项目与 Seedream 编辑工作流 Spec

## Why
当前项目只支持广告视频创作，无法承载电商主图、商品海报等静态图片需求，也缺少面向成品图片的提示词、图生图和图层编辑流程。需要在不破坏现有视频项目的前提下，增加独立的图片素材项目类型，并复用现有 Seedream、TOS、任务和资产库能力完成图片生产闭环。

## What Changes
- 项目新增 `project_type`，仅允许 `video_ad`（广告视频）和 `image_asset`（图片素材）；历史项目默认迁移为 `video_ad`。
- 图片素材项目新增用途 `image_purpose`，首期支持 `ecommerce_main`（电商主图）和 `poster`（海报）。
- 新建项目先选择项目类型；图片项目复用商品名、卖点、目标受众、广告需求、风格、画面比例和目标语言等 Brief 字段，视频时长不参与图片工作流。
- 图片项目使用独立工作台，不展示故事、角色、剧本、分镜和视频合成流程。
- 图片工作流提供不可变、可版本化的图片生成提示词，并使用 `doubao-seedream-5-0-pro-260628` 进行文生图。
- 图片编辑支持整图图生图，以及可选的点选/框选交互编辑；坐标由前端转换为 0–999 归一化 `<point>` / `<bbox>` 标签。
- 图层编辑支持 Seedream 图层拆分、图层画布编辑和合成导出；拆分结果最多包含 1 张底图和 16 个透明 PNG 图层。
- 所有远程图片先下载并转存 TOS，再写入项目资产；生成候选、编辑候选和合成成品保留来源与版本关系。
- 图片成品进入资产库，内部底图和拆分图层不作为普通成品展示。
- 不包含 **BREAKING** 变更；旧客户端未传项目类型时继续创建广告视频项目。

## Impact
- Affected specs: 项目创建与 Brief、项目工作台、ModelArk/Seedream 适配、任务系统、对象存储、资产库、项目搜索与软删除
- Affected code:
  - `backend/app/schemas/project.py`
  - `backend/app/schemas/brief.py`
  - `backend/app/schemas/enums.py`
  - `backend/app/schemas/asset.py`
  - `backend/app/db/models.py`
  - `backend/app/db/session.py`
  - `backend/app/repositories/*`
  - `backend/app/services/modelark.py`
  - `backend/app/services/generation.py`
  - `backend/app/services/assets.py`
  - `backend/app/services/workflow.py`
  - `backend/app/api/routes.py`
  - `frontend/lib/api-types.ts`
  - `frontend/lib/api-client.ts`
  - `frontend/components/workspace/project-workspace.tsx`
  - `frontend/components/workspace/workspace-asset-library.tsx`
  - 新增图片创作工作台与图层编辑组件

## ADDED Requirements

### Requirement: 项目类型
The system SHALL 为每个项目保存 `project_type`，其值只能为 `video_ad` 或 `image_asset`。

#### Scenario: 创建广告视频项目
- **WHEN** 用户选择“广告视频”并提交有效 Brief
- **THEN** 后端应保存 `project_type: "video_ad"`，项目继续使用现有六阶段视频创作流程

#### Scenario: 创建图片素材项目
- **WHEN** 用户选择“图片素材”并提交有效 Brief
- **THEN** 后端应保存 `project_type: "image_asset"`，项目应进入图片创作工作台

#### Scenario: 旧客户端未提交类型
- **WHEN** 创建项目请求未包含 `project_type`
- **THEN** 后端应默认使用 `video_ad`

#### Scenario: 非法项目类型
- **WHEN** 客户端提交未支持的项目类型或显式空值
- **THEN** 后端应返回统一参数校验错误，不创建或更新项目

#### Scenario: 项目类型不可变
- **WHEN** 项目创建完成后客户端尝试修改 `project_type`
- **THEN** 后端应拒绝更新；用户需要新建另一类型项目，避免两套工作流数据互相污染

#### Scenario: 历史项目迁移
- **WHEN** 既有数据库缺少 `project_type`
- **THEN** 迁移应先增加带默认值的字段、幂等回填全部历史项目为 `video_ad`，再建立非空约束

### Requirement: 图片用途
The system SHALL 在 Brief 中保存 `image_purpose`，并要求图片素材项目选择 `ecommerce_main` 或 `poster`。

#### Scenario: 创建电商主图项目
- **WHEN** 用户选择图片素材与“电商主图”
- **THEN** 项目 Brief 应保存 `image_purpose: "ecommerce_main"`，并在工作台和项目列表显示“电商主图”

#### Scenario: 创建海报项目
- **WHEN** 用户选择图片素材与“海报”
- **THEN** 项目 Brief 应保存 `image_purpose: "poster"`，并在工作台和项目列表显示“海报”

#### Scenario: 视频项目忽略图片用途
- **WHEN** 项目类型为 `video_ad`
- **THEN** `image_purpose` 应为空且不得影响现有视频工作流

### Requirement: 图片项目 Brief
The system SHALL 允许图片项目保存商品名、卖点、目标受众、广告需求、视觉风格、画面比例和目标语言，并将其作为提示词编辑上下文。

字段矩阵如下：

| Brief 字段 | 广告视频 `video_ad` | 图片素材 `image_asset` |
|---|---|---|
| `prompt` 广告需求 | 必填 | 必填 |
| `product_name` 商品名 | 可选 | 必填 |
| `selling_points` 卖点 | 可选 | 至少 1 项 |
| `audience` 目标受众 | 可选 | 必填 |
| `target_platform` 投放平台 | 必填 | 必填，增加电商与内容平台选项 |
| `aspect_ratio` 画面比例 | 必填 | 必填 |
| `style` 视觉风格 | 可选 | 可选 |
| `target_language` 目标语言 | 必填，默认 `zh` | 必填，默认 `zh` |
| `duration_seconds` 视频时长 | 必填 | 禁止提交并持久化为 `null` |
| `image_purpose` 图片用途 | 必须为 `null` | 必填 |

前端平台选项 SHALL 使用稳定值：

- 现有内容平台：`douyin`、`xiaohongshu`、`tiktok`、`bilibili`、`youtube`
- 新增电商平台：`taobao`、`tmall`、`jd`、`pinduoduo`、`douyin_shop`
- 兜底：`other`

后端继续接受历史项目中已有的非空平台字符串，避免把旧自定义值迁移失败；新建与编辑界面只提交上述稳定值。

#### Scenario: 提交图片 Brief
- **WHEN** 用户填写商品名、卖点、目标受众和广告需求并创建图片项目
- **THEN** 后端应原子保存完整 Brief，前端应在图片工作台展示这些字段

#### Scenario: 图片项目不使用视频时长
- **WHEN** 当前项目为图片素材
- **THEN** 新建与编辑界面不应显示视频时长
- **AND** 客户端提交非空 `duration_seconds` 时后端应拒绝，数据库应保存为 `null`

#### Scenario: 编辑影响图片提示词
- **WHEN** 用户修改会影响图片内容的 Brief 字段
- **THEN** `product_name`、`selling_points`、`audience`、`prompt`、`target_platform`、`aspect_ratio`、`style`、`target_language` 或 `image_purpose` 的实际值变化应触发失效
- **AND** 项目级 `image_prompt_status` 应复用现有 `Status.STALE`，不可变 `ImagePromptVersion` 本身不得被修改
- **AND** 由当前提示词版本派生的 public 图片资产及其后代应把现有 `Asset.status` 从 `SUCCEEDED` 更新为 `STALE`，不新增 freshness 字段或迁移；上传参考图不受影响
- **AND** stale 图片仍可作为历史版本预览，但不得被设为当前成品；重新生成应创建新的 `SUCCEEDED` 资产
- **AND** 历史提示词版本与图片资产不得删除

### Requirement: 项目列表与工作台路由
The system SHALL 在项目列表中显示项目类型与图片用途，并按项目类型进入对应工作台。

#### Scenario: 查看混合项目列表
- **WHEN** 用户同时拥有视频和图片项目
- **THEN** 每个项目卡片应显示“广告视频”“电商主图”或“海报”标签，现有关键词搜索和软删除对两类项目一致生效

#### Scenario: 打开图片项目
- **WHEN** 用户选择图片素材项目
- **THEN** 页面应展示 Brief、图片提示词、生成结果和编辑能力，不应展示视频六阶段流程

### Requirement: 图片生成提示词
The system SHALL 为图片素材项目提供独立的图片提示词编辑、保存和版本记录能力。

`ImagePromptVersion` SHALL 至少包含 `id`、`project_id`、单调递增 `version`、`prompt`、`aspect_ratio`、`target_language`、`image_purpose`、`created_at`。版本创建后不可修改，项目通过 `current_image_prompt_version_id` 指向当前版本。

项目 SHALL 同时保存 `image_prompt_status`、`current_image_asset_id` 和单调递增的 `image_revision`；这些字段表达当前工作状态，不写回不可变提示词版本。

#### Scenario: 创建提示词
- **WHEN** 用户根据 Brief 输入图片生成提示词并保存
- **THEN** 系统应保存提示词版本、目标画幅、图片用途、目标语言和更新时间

#### Scenario: 提示词长度建议
- **WHEN** 用户输入中文或英文提示词
- **THEN** 前端应显示中文 300 字、英文 600 词的官方建议计数
- **AND** 超过建议值时显示警告但仍允许用户确认提交，不把官方建议误作接口硬限制

#### Scenario: 切换提示词版本
- **WHEN** 用户修改并再次保存提示词
- **THEN** 系统应保留旧版本，并让最新版本成为下一次生成的默认输入

#### Scenario: 任务冻结提示词
- **WHEN** 用户提交文生图任务
- **THEN** 任务应冻结 `prompt_version_id`、提示词全文、画面比例、尺寸和格式；任务运行期间切换当前提示词不得改变已排队任务

#### Scenario: 编辑提示词快照
- **WHEN** 用户执行图生图或坐标交互编辑
- **THEN** 资产应保存独立 `edit_prompt` 快照和源资产 ID，并可选关联基础 `prompt_version_id`

### Requirement: Seedream 文生图
The system SHALL 使用 `doubao-seedream-5-0-pro-260628` 根据当前图片提示词生成单张图片。

四类操作参数矩阵如下：

| 操作 | `image` | `size` | `output_format` | 特殊参数 |
|---|---|---|---|---|
| 文生图 | 不传 | `1K/1.5K/2K`，默认 `2K` | `png/jpeg`，默认 `png` | 非流式、单图 |
| 图片/坐标编辑 | 单张源图 URL | `1K/1.5K/2K`，默认 `2K` | `png/jpeg`，默认 `png` | Prompt 可含服务端组装的 point/bbox |
| 图层拆分 | 单张 PNG/JPEG URL | `auto/1K/1.5K/2K`，默认 `auto` | 仅控制底图，默认 `png` | `layer_decomposition=true` |
| 图层合成 | 不调用 Seedream | 保持底图像素尺寸 | 固定 `png` | 服务端本地合成 |

#### Scenario: 文生图成功
- **WHEN** 用户提交有效提示词、画面比例和分辨率档位
- **THEN** 后端应调用 `POST /api/v3/images/generations`，使用 Seedream 5.0 Pro、非流式单图模式、`response_format=url`、`watermark=false`
- **AND** 默认使用 `size: "2K"` 与 `output_format: "png"`

#### Scenario: 支持的分辨率
- **WHEN** 用户选择分辨率档位
- **THEN** 图片生成模式仅允许 `1K`、`1.5K`、`2K`，不得发送 Seedream 5.0 Pro 不支持的 `3K`、`4K`

#### Scenario: 画面比例传递
- **WHEN** 用户选择画面比例和分辨率档位
- **THEN** 后端应在送模 Prompt 末尾追加规范化的目标比例/用途约束；不得误把比例值当作 `size`

#### Scenario: 生成结果持久化
- **WHEN** Seedream 返回远程图片 URL
- **THEN** 后端应下载图片、校验 MIME 与大小、上传 TOS、创建成功图片资产，并在 metadata 中记录模型、提示词版本、用途、尺寸、操作类型和来源

#### Scenario: 调用失败
- **WHEN** 模型调用、响应解析、远程下载、TOS 上传或数据库写入失败
- **THEN** 任务应失败并返回脱敏错误，不得留下可见的半成品资产

### Requirement: 图片版本与当前成品
The system SHALL 为文生图、图片编辑和图层合成结果保留不可变版本，并允许用户选择当前成品。

#### Scenario: 生成多个候选
- **WHEN** 用户多次生成或编辑同一图片项目
- **THEN** 每次成功结果都应创建新资产，并通过 `operation`、`source_asset_id` 和 `prompt_version` 形成可追溯关系

#### Scenario: 设为当前成品
- **WHEN** 用户选择某个成功图片版本为当前成品
- **THEN** 请求应携带项目当前 `image_revision`
- **AND** 后端应以乐观锁更新 `current_image_asset_id` 与递增后的 `image_revision`
- **AND** 项目工作台应突出该版本，资产库仍保留其他成功版本

### Requirement: 图片编辑模式
The system SHALL 支持基于一个成功图片资产执行整图图生图编辑。

#### Scenario: 普通图生图
- **WHEN** 用户选择“图片编辑”、输入编辑提示词并提交
- **THEN** 后端应将当前图片的可访问 URL 作为单张 `image` 输入，调用 Seedream 5.0 Pro 生成新图片资产

#### Scenario: 点选精修
- **WHEN** 用户在图片上选择一个点并输入编辑指令
- **THEN** 前端应基于图片实际内容区而非包含留白的容器计算相对位置
- **AND** 使用 `clamp(round(relative / length * 1000), 0, 999)` 转换整数坐标
- **AND** 后端应使用结构化坐标组装 `图1<point>x y</point>` 后再调用模型

#### Scenario: 框选精修
- **WHEN** 用户框选图片区域并输入编辑指令
- **THEN** 前端应生成合法的 `图1<bbox>x1 y1 x2 y2</bbox>`，其中所有坐标处于 0–999 且 `x1 < x2`、`y1 < y2`

#### Scenario: 服务端不信任坐标标签
- **WHEN** 客户端提交编辑请求
- **THEN** 客户端应提交结构化点或框数据，后端负责校验并组装模型标签，不得直接信任任意 `<point>` / `<bbox>` 字符串
- **AND** 用户自然语言中直接包含 point/bbox 标签时后端应拒绝

### Requirement: 图层拆分
The system SHALL 使用 Seedream 5.0 Pro 的 `layer_decomposition=true` 将单张图片原子拆分为底图和图层集合。

#### Scenario: 自动拆分
- **WHEN** 用户进入图层编辑并选择自动拆分
- **THEN** 后端应只提交一张 PNG/JPEG 图片，可省略 prompt，使用 `size: "auto"` 和 `layer_decomposition: true`

#### Scenario: 指定拆分对象
- **WHEN** 用户输入待拆分元素或结构化框选区域
- **THEN** 后端应将自然语言与经过校验的 `<bbox>` 标签组装为可选 prompt

#### Scenario: 输入文件校验
- **WHEN** 用户请求图层拆分
- **THEN** 输入必须为单张 PNG/JPEG、不超过 30MB、总像素在 262144 至 36000000 之间、宽高比在 1/16 至 16 之间

#### Scenario: 拆分响应解析
- **WHEN** Seedream 返回图层拆分结果
- **THEN** 系统应以响应携带的 `z_index` 为准，要求恰好一个 `z_index=0` 底图
- **AND** 图层 `z_index` 应从 1 开始唯一连续递增
- **AND** 每个图层必须包含 `url`、`name`、`description` 与 `bounding_box`
- **AND** `bounding_box.absolute` 和 `bounding_box.normalized` 均为 `[x1,y1,x2,y2]` 四整数，满足 `x1<x2`、`y1<y2`
- **AND** absolute 使用右/下排他边界：`0 <= x1 < x2 <= width`、`0 <= y1 < y2 <= height`，图层目标尺寸为 `x2-x1` × `y2-y1`
- **AND** normalized 坐标位于 0–1000，并使用相同的右/下排他语义

#### Scenario: 拆分原子性
- **WHEN** 任一底图或图层缺失、下载失败、上传失败或字段非法
- **THEN** 后端应先将全部对象写入不可公开访问的最终对象键并完成校验，数据库记录直接引用这些最终键
- **AND** 仅在全部成功后于单个数据库事务创建集合、图层与内部资产记录并将集合标为 succeeded
- **AND** 数据库失败或任一对象失败时应补偿删除本次已上传的最终对象键，不得暴露部分成功集合
- **AND** 数据库提交成功后对象键长期保留，不执行重命名或二次复制

#### Scenario: 拆分数量限制
- **WHEN** 模型返回图层拆分结果
- **THEN** 系统最多接受 1 张底图和 16 个图层，超出上限应视为无效响应

#### Scenario: 禁用不兼容参数
- **WHEN** 执行图层拆分
- **THEN** 请求不得包含 `sequential_image_generation`、`sequential_image_generation_options`、`tools` 或 `stream`

### Requirement: 图层数据模型
The system SHALL 使用结构化图层集合保存源图片、底图、各图层资产和可编辑布局状态。

#### Scenario: 保存图层集合
- **WHEN** 图层拆分成功
- **THEN** 系统应保存集合 ID、项目 ID、源图片资产 ID、底图资产 ID、画布尺寸、状态、`revision` 及创建时间

#### Scenario: 保存图层
- **WHEN** 图层集合包含独立图层
- **THEN** 每层应保存资产 ID、`z_index`、名称、描述、绝对/归一化边界框、可见性和当前变换参数

#### Scenario: 隐藏内部图层
- **WHEN** 用户打开普通资产库
- **THEN** 普通资产列表、搜索、详情和内容接口只允许 `asset_role=public`
- **AND** 底图使用 `asset_role=internal_base`，透明层使用 `asset_role=internal_layer`
- **AND** 内部资产仅可通过所属项目的图层集合接口获得临时访问 URL

`asset_role` SHALL 为非空字段，值为 `public`、`internal_base` 或 `internal_layer`。新库默认 `public`；旧库迁移应先增加默认值、幂等回填所有历史资产为 `public`，再建立非空约束。

### Requirement: 图层编辑工作台
The system SHALL 提供可视化图层画布和图层面板，支持非破坏性编辑。

首期图层操作仅包含显隐、移动、等比缩放和调整顺序，不支持删除、旋转、裁剪、调色或直接替换图层。

图层变换 SHALL 使用底图像素坐标 `{x, y, scale}`：`x/y` 表示图层左上角，`scale` 以图层原始尺寸和左上角为锚点等比缩放，合法范围为 `0.05` 至 `20`。

#### Scenario: 还原初始构图
- **WHEN** 用户打开刚拆分完成的图层集合
- **THEN** 前端应根据底图坐标系、`z_index` 和绝对 `bounding_box` 还原原始合成效果

#### Scenario: 图层基础操作
- **WHEN** 用户选中一个图层
- **THEN** 用户应能切换显隐、移动、等比缩放和调整叠放顺序，底图不可删除

#### Scenario: 保存编辑状态
- **WHEN** 用户保存图层布局
- **THEN** 请求应携带当前集合 `revision`
- **AND** 后端应使用乐观锁校验并保存图层可见性、顺序和变换参数，成功后递增 `revision`
- **AND** revision 冲突应返回 409 并保留服务端最新状态，刷新页面后应可恢复

#### Scenario: 画布适配
- **WHEN** 用户在桌面或移动设备打开图层编辑器
- **THEN** 画布应保持底图比例且不与工具栏、图层面板重叠；移动端图层面板应使用抽屉或折叠区域

### Requirement: 图层合成导出
The system SHALL 将当前底图和可见图层按保存状态合成为新的 PNG 成品。

#### Scenario: 导出合成图
- **WHEN** 用户点击“导出成品”
- **THEN** 请求应携带已保存的图层集合 `revision`
- **AND** 后端应拒绝过期 revision，不得导出仅存在于浏览器但尚未保存的布局
- **AND** 后端应按画布坐标、变换和 `z_index` 合成透明 PNG 图层，上传 TOS，并创建新的成功图片资产

#### Scenario: 合成失败
- **WHEN** 任一图层不可访问、解码失败或变换参数非法
- **THEN** 导出任务应失败且不得覆盖当前成品

### Requirement: 图片资产库归档
The system SHALL 在资产库中展示图片项目的成功候选和最终成品，并提供来源信息。

#### Scenario: 查看图片成品
- **WHEN** 用户打开资产库的商品/产物区域
- **THEN** 应看到 `asset_role=public` 的文生图、图片编辑和图层合成图片，并可按项目筛选

#### Scenario: 查看版本来源
- **WHEN** 用户查看图片资产详情
- **THEN** 页面应展示项目、用途、操作类型、提示词摘要、来源图片、尺寸、格式、模型和创建时间

#### Scenario: 项目软删除
- **WHEN** 图片项目被软删除
- **THEN** 其图片成品、图层集合和对象存储文件应继续保留在后端，但不再出现在前端项目与资产查询中

### Requirement: 任务与并发控制
The system SHALL 将图片生成、图片编辑、图层拆分和图层合成作为可观察任务执行。

#### Scenario: 任务状态
- **WHEN** 图片操作开始、完成或失败
- **THEN** 前端应显示 queued/running/succeeded/failed 状态并支持失败重试

#### Scenario: 重复提交
- **WHEN** 同一项目对同一源资产和相同输入存在运行中的同类任务
- **THEN** 后端应返回现有 running/queued 任务，不创建新任务

任务去重哈希 SHALL 包含 `operation`、项目 ID、源资产 ID、提示词版本或编辑提示词快照、模型参数，以及图层合成时的集合 revision。

#### Scenario: 失败重试
- **WHEN** 用户重试一个失败任务
- **THEN** 后端应创建新的 attempt，并通过 `retry_of_task_id` 关联原任务；失败任务本身保持不可变
- **AND** 新 attempt 必须复制原任务冻结的完整输入、参数和 `input_hash`，不得重新读取当前提示词、当前资产或最新图层 revision
- **AND** 用户希望使用新提示词、源资产或 revision 时应发起普通新任务，而不是重试原任务

## MODIFIED Requirements

### Requirement: 项目创建与列表
The system SHALL 在项目创建、详情、列表、搜索和软删除契约中包含不可变 `project_type`，并在图片项目 Brief 中包含 `image_purpose`。

### Requirement: Seedream 适配层
The system SHALL 扩展现有 ModelArk 图片适配器，支持文生图、单图图生图、结构化交互编辑和图层拆分响应，不得把图层模式发送给不支持的模型。

### Requirement: 资产持久化
The system SHALL 对所有可见图片成品执行远程下载、内容校验、TOS 上传和数据库写入；对内部图层使用独立可查询但默认隐藏的存储关系。

### Requirement: 工作流展示
The system SHALL 根据 `project_type` 选择视频六阶段工作流或图片创作工作流，不得在图片项目中暴露无效的视频操作。

## REMOVED Requirements

### Requirement: 所有项目都使用广告视频六阶段流程
**Reason**: 图片素材项目只需要 Brief、提示词、图片生成和编辑，不应产生故事、角色、剧本、分镜或成片视频任务。

**Migration**: 历史项目统一迁移为 `video_ad`，继续使用原有六阶段流程；只有明确创建为 `image_asset` 的项目进入图片工作流。

## External Contracts

- Seedream 5.0 Pro 模型：`doubao-seedream-5-0-pro-260628`
- 图片生成接口：`POST https://ark.cn-beijing.volces.com/api/v3/images/generations`
- 文生图/图生图默认：`size="2K"`、`output_format="png"`、`response_format="url"`、`watermark=false`
- 图层拆分默认：单张 PNG/JPEG、`layer_decomposition=true`、`size="auto"`、非流式
- 交互坐标：`<point>x y</point>` / `<bbox>x1 y1 x2 y2</bbox>`，坐标归一化到 0–999
- 图层响应：第一项底图 `z_index=0`，其余图层携带绝对与归一化边界框、名称和描述
- 参考文档：
  - `https://docs.volcengine.com/docs/82379/2582774?lang=zh`
  - `https://docs.volcengine.com/docs/82379/2582775?lang=zh`
  - `https://docs.volcengine.com/docs/82379/1541523?lang=zh`
  - `https://bytedance.larkoffice.com/docx/QRT0dBht0oOkDexrdrpcPv1ynGf`
