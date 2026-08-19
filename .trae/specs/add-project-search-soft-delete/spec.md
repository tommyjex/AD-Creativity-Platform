# 项目关键词搜索与软删除 Spec

## Why
项目数量增长后，用户缺少快速定位目标项目和清理无效项目的能力。需要在项目模块增加关键词搜索与安全删除，同时保留项目关联素材、产物和生成记录，避免误删后端数据。

## What Changes
- 项目列表 API 新增可选关键词参数 `q`，按项目名称、Brief 商品名称和广告需求进行不区分大小写的包含匹配。
- 项目表新增可空的 `deleted_at` 字段，项目删除改为记录删除时间的软删除。
- 新增 `DELETE /api/projects/{project_id}`，成功返回 `204 No Content`，重复删除或访问已删除项目返回 `404`。
- 所有常规项目列表、项目详情和项目关联资产列表默认排除已删除项目；全局资产列表也不得展示已删除项目的素材与产物。
- 项目模块新增搜索框、搜索结果空状态、项目删除入口、二次确认弹窗及删除成功/失败反馈。
- 删除当前选中项目后，前端立即移除列表项并清空详情；后端不删除资产、文本产物、分镜、任务、角色卡或对象存储文件。
- 不新增回收站、恢复、永久删除、批量删除或分页能力。
- 不包含 **BREAKING** 变更；未传 `q` 时项目列表 API 保持现有行为，但仅返回未删除项目。

## Impact
- Affected specs: 项目管理、项目列表、资产库可见性、数据持久化
- Affected code:
  - `backend/app/api/routes.py`
  - `backend/app/db/models.py`
  - `backend/app/db/session.py`
  - `backend/app/repositories/base.py`
  - `backend/app/repositories/memory.py`
  - `backend/app/repositories/mysql.py`
  - `backend/app/schemas/project.py`
  - `frontend/lib/api-client.ts`
  - `frontend/components/workspace/project-workspace.tsx`
  - 前后端项目、仓储、API client 与工作台测试

## ADDED Requirements

### Requirement: 项目关键词搜索
The system SHALL 支持通过可选关键词查询未删除项目，关键词匹配项目名称、Brief 商品名称和广告需求。

#### Scenario: 按项目名称搜索
- **WHEN** 用户输入项目名称中的任意连续关键词
- **THEN** 系统应返回名称包含该关键词的未删除项目

#### Scenario: 按 Brief 内容搜索
- **WHEN** 用户输入商品名称或广告需求中的任意连续关键词
- **THEN** 系统应返回对应 Brief 字段包含该关键词的未删除项目

#### Scenario: 搜索忽略大小写和首尾空格
- **WHEN** 用户提交包含首尾空格或不同英文大小写的关键词
- **THEN** 系统应先去除首尾空格，再执行不区分大小写的包含匹配

#### Scenario: 空关键词
- **WHEN** `q` 缺失或去除首尾空格后为空
- **THEN** 系统应返回全部未删除项目，并保持现有项目排序规则

#### Scenario: 无匹配结果
- **WHEN** 搜索关键词没有匹配任何未删除项目
- **THEN** 项目模块应展示搜索无结果状态，并保留清空关键词的操作

### Requirement: 项目软删除
The system SHALL 通过记录 `deleted_at` 软删除项目，不物理删除项目及其关联数据。

#### Scenario: 删除有效项目
- **WHEN** 用户确认删除一个未删除项目
- **THEN** 后端应设置该项目的 `deleted_at`，返回 `204 No Content`，且不删除任何关联素材、产物、任务或存储文件

#### Scenario: 删除不存在或已删除项目
- **WHEN** 用户删除不存在或已经软删除的项目
- **THEN** 后端应返回统一的 `404 not_found` 错误

#### Scenario: 删除前二次确认
- **WHEN** 用户点击项目列表项的删除图标
- **THEN** 前端应打开确认弹窗，明确展示项目名称，并说明项目将从前端隐藏但后端素材与产物保留

#### Scenario: 取消删除
- **WHEN** 用户在确认弹窗中取消
- **THEN** 前端不得发送删除请求，项目列表和当前详情保持不变

#### Scenario: 删除成功
- **WHEN** 删除请求成功
- **THEN** 前端应关闭确认弹窗、从当前列表移除项目并展示成功反馈；若删除的是当前选中项目，还应清空其详情和选择状态

#### Scenario: 删除失败
- **WHEN** 删除请求失败
- **THEN** 前端应保留项目与当前详情，并在确认弹窗内展示可理解的错误信息，允许用户重试或取消

### Requirement: 已删除项目不可见
The system SHALL 在常规前端数据读取路径中隐藏已软删除项目及其关联素材和产物。

#### Scenario: 查询项目列表
- **WHEN** 调用 `GET /api/projects`
- **THEN** 响应不得包含 `deleted_at` 非空的项目

#### Scenario: 查询已删除项目详情
- **WHEN** 调用 `GET /api/projects/{project_id}` 查询已软删除项目
- **THEN** 后端应返回统一的 `404 not_found` 错误

#### Scenario: 查询已删除项目的关联资源
- **WHEN** 通过项目资产、分镜、任务或其他项目级接口访问已软删除项目
- **THEN** 后端应按项目不存在处理，且不得在常规前端接口中暴露该项目关联数据

#### Scenario: 查询全局资产列表
- **WHEN** 前端请求未限定项目的资产列表
- **THEN** 响应不得包含属于已软删除项目的素材或产物

#### Scenario: 后端数据保留
- **WHEN** 项目被软删除
- **THEN** 项目行、Brief、文本产物、角色卡、分镜、任务、资产元数据及对象存储文件应保持原样，仅项目行的 `deleted_at` 被更新

### Requirement: 数据库兼容升级
The system SHALL 为既有数据库以可重复执行的方式增加项目软删除字段。

#### Scenario: 初始化新数据库
- **WHEN** 系统初始化空数据库
- **THEN** `projects` 表应包含可空的 `deleted_at` 时间字段及支持活跃项目查询的索引

#### Scenario: 启动旧数据库
- **WHEN** 系统启动且既有 `projects` 表缺少 `deleted_at`
- **THEN** 增量迁移应补充该字段和索引，不影响已有项目与关联数据

#### Scenario: 重复执行初始化
- **WHEN** 数据库初始化或增量迁移被多次执行
- **THEN** 操作应保持幂等，不重复创建字段或索引

## MODIFIED Requirements

### Requirement: 项目列表 API
The system SHALL 通过 `GET /api/projects?q={keyword}` 返回符合关键词条件的未删除项目摘要；`q` 为可选参数，未提供时返回全部未删除项目。

#### Scenario: 保持轻量响应
- **WHEN** 项目列表 API 返回搜索结果
- **THEN** 每项仍应使用 `ProjectListItem`，不得加载或返回完整资产、任务、分镜和文本产物集合

### Requirement: 项目仓储可见性
The system SHALL 让内存仓储与 SQLAlchemy 仓储遵循一致的软删除语义。

#### Scenario: 仓储读取已删除项目
- **WHEN** 任一仓储通过常规 `get_project` 或项目级方法读取已删除项目
- **THEN** 仓储应抛出 `NotFoundError`

#### Scenario: 仓储搜索项目
- **WHEN** 任一仓储按关键词列出项目摘要
- **THEN** 两种仓储应返回字段、过滤结果与排序一致的未删除项目列表

## REMOVED Requirements

无。
