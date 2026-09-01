# 图生图节点多参考图 Spec

## Why

当前 AIGC 画布中的图生图节点仅允许一条图片输入连线，无法组合商品、人物、风格和场景等多张参考图。需要将单图输入扩展为最多 10 张有序参考图，并让节点清晰反馈已连接数量和超限原因。

## What Changes

- 图生图节点的图片输入端口由单值端口调整为多值端口，最少 1 张、最多 10 张。
- 每张参考图仍由独立的图片输入节点或其他 `image_asset` 输出节点提供，不把图片输入节点改造成多资产容器。
- 参考图顺序按画布 `definition.edges` 中指向该图片端口的顺序确定，并以图 1 至图 10 的语义传给模型。
- 前端连线阶段拒绝第 11 张参考图及完全重复的连线，并给出明确反馈。
- 图生图节点卡片展示 `参考图 n/10`，运行前可直观看到当前输入数量。
- 后端 DAG 校验独立执行 1–10 张约束，不能依赖前端校验。
- 任务参数快照由单个 `source_asset_id` 升级为有序 `reference_asset_ids`；旧的单图 `source_asset_id` 快照继续兼容。
- 模型调用以第一张参考图作为主图，其余最多 9 张作为附加参考图；临时签名 URL 仅在调用时生成，不写入持久化数据。
- 所有输入图片都写入任务资产关联，使用 `slot=image` 和从 0 开始的 `ordinal` 保存顺序。
- 图片顺序参与 `inputHash`；图片执行器版本升级，避免错误复用旧的单图缓存。

## Impact

- Affected specs:
  - AIGC 节点注册表与端口约束
  - DAG 校验和输入解析
  - 图生图任务参数快照与增量缓存
  - 模型网关与任务资产追踪
  - AIGC 画布连线交互和节点展示
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/generation.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/node-registry.ts`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - 对应前后端测试

## ADDED Requirements

### Requirement: 图生图节点接受最多 10 张参考图

系统 SHALL 允许一个图生图节点的图片输入端口同时接收 1 至 10 条 `image_asset` 连线。

#### Scenario: 连接多张参考图

- **WHEN** 用户将多个图片输入节点或图片模型节点连接到同一图生图节点的图片端口
- **THEN** 前 10 条类型合法且不重复的连线均创建成功
- **AND** 原有提示词端口仍保持单值输入
- **AND** 其他单值端口行为不变

#### Scenario: 超过数量上限

- **WHEN** 图生图节点已有 10 条图片输入连线，用户尝试连接第 11 条
- **THEN** 前端不创建该连线
- **AND** 页面提示“图生图节点最多支持 10 张参考图”
- **AND** 后端对绕过前端提交的同类 definition 返回可定位到目标节点的校验错误

#### Scenario: 缺少参考图

- **WHEN** 图生图节点没有任何图片输入连线
- **THEN** 运行前 DAG 校验失败
- **AND** 错误定位到该图生图节点的图片输入端口

#### Scenario: 重复连接

- **WHEN** 用户尝试再次创建相同 source node、source handle、target node、target handle 的连线
- **THEN** 前端拒绝重复连线
- **AND** 后端同样拒绝重复边

### Requirement: 参考图具有稳定顺序

系统 SHALL 按 `definition.edges` 中指向目标图生图节点图片端口的出现顺序解析参考图。

#### Scenario: 解析参考图顺序

- **WHEN** 三条图片连线在 definition 中依次来自节点 A、B、C
- **THEN** 任务参数快照中的 `reference_asset_ids` 顺序为 A、B、C 对应的资产
- **AND** 模型调用中 A 为主图，B、C 为附加参考图
- **AND** 任务资产关联分别记录 `ordinal=0,1,2`
- **AND** 每条连线只贡献一张图片；上游结果包含多个资产时沿用现有规则选取第一张可用图片

#### Scenario: 不静默去重资产

- **WHEN** 两个不同上游节点最终解析到同一个资产 ID
- **THEN** 两条连线仍按各自顺序占用两个参考图位置
- **AND** 系统不在执行阶段静默删除或重排用户建立的输入

#### Scenario: 删除后重新连接

- **WHEN** 用户删除一条图片连线后重新连接
- **THEN** 新连线追加到该图片端口现有参考图顺序末尾
- **AND** 下一次保存和运行使用更新后的顺序

#### Scenario: 顺序变化影响缓存

- **WHEN** 两次运行使用相同图片集合但连接顺序不同
- **THEN** 两次任务生成不同的 `inputHash`
- **AND** 系统不得复用顺序不同的历史图生图结果

### Requirement: 节点显示参考图连接状态

系统 SHALL 在图生图节点卡片中展示图片输入数量，帮助用户在不打开检查器的情况下确认连接状态。

#### Scenario: 展示连接计数

- **WHEN** 图生图节点连接了 3 张参考图
- **THEN** 节点卡片显示 `参考图 3/10`
- **AND** 原有模型、画幅和尺寸摘要保持可见

#### Scenario: 达到上限

- **WHEN** 图生图节点连接了 10 张参考图
- **THEN** 节点卡片显示 `参考图 10/10`
- **AND** 图片输入端口的可访问名称或提示表明已达到上限

### Requirement: 多参考图任务快照与模型调用

系统 SHALL 将图生图输入解析为有序资产 ID 列表，并完整传递给模型服务。

#### Scenario: 创建多图任务

- **WHEN** 包含 1 至 10 张参考图的图生图节点进入可执行状态
- **THEN** 不可变任务参数快照保存 `reference_asset_ids`
- **AND** 快照只保存资产 ID，不保存签名 URL
- **AND** `upstream` 保留所有上游节点 ID

#### Scenario: 调用图片模型

- **WHEN** Worker 执行多参考图任务
- **THEN** 网关逐一校验所有资产均为可用的公开图片
- **AND** 为每项资产生成临时访问 URL
- **AND** 第一项作为 `source_image_url`
- **AND** 后续项目作为 `reference_image_urls`
- **AND** 模型收到的图片总数不超过 10

#### Scenario: 某张参考图不可用

- **WHEN** 任一参考资产不存在、非公开、状态不可用或无法生成访问 URL
- **THEN** 整个图生图任务失败
- **AND** 不向模型发送部分参考图请求
- **AND** 对外错误不泄露对象存储签名信息

#### Scenario: 记录任务资产

- **WHEN** 图生图任务开始调用模型
- **THEN** 每张输入图均记录一条 input 方向任务资产关联
- **AND** 关联顺序与 `reference_asset_ids` 一致
- **AND** 输出图继续记录为 output 方向资产并进入资产库

### Requirement: 兼容现有单图画布和任务

系统 SHALL 保持现有单图画布可编辑、可保存和可运行，并允许恢复升级前已持久化的任务。

#### Scenario: 运行现有单图画布

- **WHEN** 旧画布仅有一条图片输入连线
- **THEN** 该连线被解析为仅含一项的 `reference_asset_ids`
- **AND** 用户无需迁移或重新连接节点

#### Scenario: 恢复旧任务快照

- **WHEN** Worker 恢复的历史任务参数仅包含 `source_asset_id`
- **THEN** 网关将其规范化为单项参考图列表后继续执行
- **AND** 新创建的任务只写入 `reference_asset_ids`

#### Scenario: Definition 版本兼容

- **WHEN** 保存包含多图片连线的画布
- **THEN** definition 仍使用 `schemaVersion=1`
- **AND** 节点和边的数据结构保持不变
- **AND** 不需要新增或迁移数据库表

## MODIFIED Requirements

### Requirement: AIGC 端口定义

端口定义 SHALL 增加明确的 `max_connections` 数量约束。默认值为 1；图生图节点的 `image` 输入端口设置为 `multiple=true`、`max_connections=10`，其余现有端口保持 `multiple=false`、`max_connections=1`。前后端注册表 SHALL 保持一致。

### Requirement: 输入解析与缓存摘要

执行器 SHALL 对多值端口聚合所有输入，而不是覆盖同名端口的前一项。图片输入顺序 SHALL 进入任务参数、上游摘要和 `inputHash`；图片执行器版本 SHALL 升级，使旧执行器生成的缓存不被错误复用。

### Requirement: 资产删除保护

每个图片输入节点仍通过现有 `pipeline_assets` 关系保护其单个资产。多条图片连线不引入新的 Pipeline 资产表结构；运行任务通过现有带 `ordinal` 的 `pipeline_task_assets` 记录全部输入图片。

## REMOVED Requirements

无。
