# 优化资产库网格与资产重命名 Spec

## Why
资产库原分页每页固定展示 6 项，但不同分区的桌面网格最多只有 4 或 5 列，导致 6 张图片被排成“4+2”或“5+1”，浪费空间且不利于快速浏览。资产名称目前只能由上传或生成链路写入，用户无法在资产库中修正和整理名称。

本次变更统一资产库桌面网格为每行 6 张缩略图，并为所有独立资产增加持久化重命名能力。

## What Changes
- 资产库所有资产分区统一使用响应式缩略图网格：桌面宽屏每行 6 项，窄屏按可用宽度降为 1/2/3 列。
- 每页展示 30 项；桌面宽屏每行 6 项、一页 5 行，修复当前“第二行只剩 1～2 张”的布局问题。
- 图片缩略图继续保持原始宽高比并使用 `object-contain`；点击缩略图打开既有放大预览弹窗。
- 项目、工具与 AIGC 工作台的独立资产卡片增加铅笔图标按钮。
- 点击铅笔按钮打开重命名弹窗，保存后立即更新卡片、搜索结果、预览标题和默认下载文件名。
- 派生尾帧图不是独立资产，不提供单独重命名入口；其宿主分镜视频仍可重命名。
- 新增通用资产重命名 API，只更新 `metadata.name` 和名称方案标记，不修改对象存储 key、URL、归属、引用或生成追溯元数据。

## Impact
- Affected specs:
  - 资产库网格与分页展示
  - 资产预览交互
  - 资产名称管理
  - AIGC 资产命名兼容
- Affected code:
  - `frontend/components/workspace/workspace-asset-library.tsx`
  - `frontend/lib/asset-display.ts`
  - `frontend/lib/api-client.ts`
  - `frontend/lib/api-types.ts`
  - `frontend/tests/workspace-asset-library.test.tsx`
  - `frontend/tests/asset-display.test.ts`
  - `frontend/tests/api-client.test.ts`
  - `backend/app/api/routes.py`
  - `backend/app/schemas/asset.py`
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `backend/tests/test_api.py` 或对应资产 API 测试
  - `backend/tests/test_aigc_repository.py`
- Not changed:
  - 不新增数据库列或迁移。
  - 不重命名或复制对象存储文件。
  - 不改变资产 ID、项目/工具归属、删除保护、Pipeline 引用或缓存语义。
  - 分页容量由每页 6 项调整为每页 30 项。

## ADDED Requirements

### Requirement: 六列缩略图网格
资产库 SHALL 对角色、场景、图片成品、产物、工具资产和 AIGC 工作台资产使用一致的响应式网格，并在内容区域达到宽屏断点时每行展示 6 张资产卡片。

响应式列数 SHALL 按浏览器 viewport 宽度固定为：`<640px` 为 1 列，`640～1023px` 为 2 列，`1024～1279px` 为 3 列，`>=1280px` 为 6 列。网格容器保持 `min-width: 0`，卡片内容不得反向撑宽页面。

#### Scenario: 宽屏展示 6 项
- **WHEN** 用户在宽度至少 1280px 的桌面视口打开任一包含至少 6 项资产的分区
- **THEN** 当前页前 6 项在同一行展示
- **AND** 不出现“第一行 4～5 项、第二行只剩 1～2 项”的布局

#### Scenario: 窄屏响应式降列
- **WHEN** 内容宽度不足以容纳 6 张可读卡片
- **THEN** 网格按断点降为 1、2 或 3 列
- **AND** 卡片不产生横向溢出、文字遮挡或控件重叠
- **AND** 每页仍最多展示 30 项

#### Scenario: 多于 30 项分页
- **WHEN** 当前分区存在超过 30 项资产
- **THEN** 第一页展示 30 项并显示分页控件
- **AND** 后续资产在下一页展示

### Requirement: 缩略图放大预览
资产库 SHALL 允许用户点击可预览的图片缩略图打开现有资产预览弹窗。

#### Scenario: 点击图片缩略图
- **WHEN** 用户点击具有可用预览 URL 的图片缩略图
- **THEN** 系统打开放大预览弹窗
- **AND** 大图使用 `object-contain` 完整展示，不裁切、不拉伸
- **AND** 弹窗显示资产名称、来源、类型、状态和创建时间

#### Scenario: 不可用预览
- **WHEN** 资产没有可用预览 URL
- **THEN** 卡片展示不可用占位
- **AND** 不提供无效的放大交互

### Requirement: 资产重命名入口
资产库 SHALL 为每个独立项目、工具和 AIGC 资产提供重命名入口。

#### Scenario: 打开重命名弹窗
- **WHEN** 用户点击资产卡片上的铅笔图标按钮
- **THEN** 系统打开小型重命名弹窗
- **AND** 输入框预填当前资产展示名
- **AND** 弹窗提供“取消”和“保存”操作
- **AND** 铅笔与删除按钮具有独立点击区域、可访问名称和悬浮提示，不遮挡缩略图主要内容

#### Scenario: 派生尾帧
- **WHEN** 卡片是由分镜视频派生的尾帧图
- **THEN** 不显示重命名入口
- **AND** 用户可通过宿主分镜视频卡片修改宿主资产名称
- **AND** 尾帧卡片与预览标题继续显示固定名称“尾帧图”
- **AND** 尾帧搜索仍可匹配“尾帧图”或宿主资产的新名称
- **AND** 尾帧下载名不因宿主资产重命名而改变

### Requirement: 资产名称校验
系统 SHALL 对重命名请求进行前后端一致校验。

#### Scenario: 有效名称
- **WHEN** 用户输入去除首尾空白后长度为 1～120 个 Unicode code points 的名称
- **AND** 名称不包含 ASCII 控制字符
- **THEN** 系统允许提交并保存去除首尾空白后的值

#### Scenario: 空名称
- **WHEN** 用户提交空字符串或纯空白名称
- **THEN** 前端阻止提交
- **AND** 后端在绕过前端调用时返回 `422`

#### Scenario: 名称过长
- **WHEN** 名称超过 120 个 Unicode code points
- **THEN** 前端显示长度错误并阻止提交
- **AND** 后端在绕过前端调用时返回 `422`

#### Scenario: 控制字符
- **WHEN** 名称包含 U+0000～U+001F 或 U+007F
- **THEN** 后端返回 `422`
- **AND** 不更新任何资产元数据

### Requirement: 通用资产重命名 API
系统 SHALL 提供 `PATCH /api/assets/{asset_id}`，请求体为 `{ "name": string }`，并返回更新后的 Asset。

响应 Asset SHALL 经过现有资产访问 URL 装饰逻辑，具有与资产列表响应一致的可预览/可下载 URL；前端可以用响应整体替换旧资产而不丢失即时预览能力。

#### Scenario: 重命名项目资产
- **WHEN** 目标资产具有 `project_id`
- **THEN** API 更新该资产 `metadata.name`
- **AND** 保留 metadata 中除名称方案外的所有既有字段

#### Scenario: 重命名工具或 AIGC 资产
- **WHEN** 目标资产没有项目归属但具有 `tool_asset_role`
- **THEN** API 更新该资产 `metadata.name`
- **AND** 不改变 `tool_task_id`、`tool_asset_role` 或 AIGC 追溯信息

#### Scenario: 资产不存在
- **WHEN** `asset_id` 不存在
- **THEN** API 返回 `404`

#### Scenario: 非公开内部资产
- **WHEN** 目标资产的 `asset_role` 不是 `public`
- **THEN** API 返回 `404`
- **AND** 不允许通过普通资产库 API 探测或重命名内部资产

#### Scenario: 元数据合并
- **WHEN** 重命名成功
- **THEN** 系统仅覆盖 `metadata.name`
- **AND** 将 `metadata.name_scheme` 设置为 `user_defined_v1`
- **AND** 其他 metadata、对象 key、URL、归属和引用保持不变

### Requirement: 重命名后的即时一致性
资产库 SHALL 在重命名成功后立即以服务端返回的 Asset 更新本地状态。

#### Scenario: 保存成功
- **WHEN** 重命名 API 返回更新资产
- **THEN** 弹窗关闭
- **AND** 卡片名称立即更新，无需刷新页面
- **AND** 卡片与预览继续使用响应中的有效访问 URL
- **AND** 搜索使用新名称，旧名称不再命中
- **AND** 后续打开预览弹窗时标题使用新名称
- **AND** 默认下载文件名使用新名称

#### Scenario: 保存失败
- **WHEN** 重命名 API 返回错误或网络失败
- **THEN** 弹窗保持打开并展示用户可理解的错误
- **AND** 卡片继续显示原名称
- **AND** 用户可修改后重试或取消

#### Scenario: 重复提交
- **WHEN** 保存请求正在进行
- **THEN** 输入框和保存按钮进入禁用状态
- **AND** 不发送第二个重命名请求

### Requirement: 用户命名优先级
资产展示层 SHALL 将 `metadata.name_scheme === "user_defined_v1"` 的 `metadata.name` 视为最高优先级名称。

#### Scenario: 重命名项目资产
- **WHEN** 项目资产同时存在 description、prompt 和用户名称
- **THEN** 卡片、搜索、预览和下载优先使用用户名称

#### Scenario: 重命名 AIGC 自动命名资产
- **WHEN** 原 `aigc_canvas_node_v1` 资产被用户重命名
- **THEN** 名称方案更新为 `user_defined_v1`
- **AND** 用户名称覆盖自动生成名称
- **AND** 后续画布或节点改名不追溯修改该资产

#### Scenario: 同名资产
- **WHEN** 多个资产被设置为相同名称
- **THEN** 系统允许保存
- **AND** 资产仍通过稳定 asset ID 区分

## MODIFIED Requirements

### Requirement: 资产分页展示
资产库各分区 SHALL 每页固定展示 30 项。宽屏视口下每行 6 项、一页 5 行；窄屏下可响应式换行，但分页边界仍为 30 项。

### Requirement: 资产显示名称
资产显示名称 SHALL 按以下优先级解析：
1. `name_scheme=user_defined_v1` 的用户名称。
2. `name_scheme=aigc_canvas_node_v1` 的 AIGC 自动名称。
3. 既有 description、name、prompt_summary、prompt 和默认文案回退。

下载接口 SHALL 对 `user_defined_v1` 与 `aigc_canvas_node_v1` 保留合法 Unicode；未包含扩展名时继续依据资产 MIME 类型补充扩展名。

## REMOVED Requirements

无。

## Constraints
- 重命名是元数据更新，不是对象存储重命名。
- 首期不提供批量重命名、名称唯一性约束或历史版本。
- 重命名采用最后一次成功请求生效的简单语义，不引入资产 revision。
- 交互复用现有 Dialog、Input、Button 和 Lucide `Pencil` 图标。
