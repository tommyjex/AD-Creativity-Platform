# 上游图片精准编辑 Spec

## Why

统一图片节点连接上游后只能预览和下载结果，现有“精准编辑”入口被隐藏且 BBox 仅能绑定本地资产。用户需要直接对当前所选 Run 的上游图片结果画框，并将该区域安全地用于后续图生图提示词；框选必须绑定具体结果资产，避免上游换图后误用旧坐标。

## What Changes

- 连接上游的图片节点在当前所选 Run 存在成功、可用的图片结果时，常驻显示可用的“精准编辑”按钮。
- 点击按钮复用现有图片画框编辑弹窗，弹窗展示当前上游结果图片，而不是节点保留的本地备用图片。
- 图片节点新增独立的上游 BBox 与绑定资产字段；本地 `asset_id / bbox / bbox_asset_id` 保持不变，断开上游后仍可恢复。
- 上游框选绑定当前有效结果的 `asset_id`。切换 Run 或重新执行导致结果资产变化后，旧框选自动进入失效状态，必须重新框选。
- BBox 引用资格允许上游图片节点与本地文本节点共同连接普通图生图节点；编译前校验框选绑定资产与本次实际输入资产一致。
- 失效框选不会静默沿用或被忽略；依赖该引用执行时，在调用模型前返回可定位错误。
- 模板清理上游 BBox 及其文本引用，避免模板携带实例 Run 的资产绑定。

## Impact

- Affected specs:
  - `unify-aigc-modality-nodes`
  - `add-aigc-bbox-prompt-references`
- Affected code:
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/lib/aigc/bbox-references.ts`
  - `frontend/lib/aigc/result-projection.ts`
  - `frontend/lib/aigc/types.ts`
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_dag.py`
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_pipeline.py`
  - 对应前后端单元测试与 Playwright 验收

## ADDED Requirements

### Requirement: 上游图片精准编辑入口

系统 SHALL 为连接上游的图片节点提供“精准编辑”按钮。按钮是否可用必须由当前所选 Run 中该节点的有效图片结果决定，不得读取本地备用资产冒充上游结果。

#### Scenario: 打开上游图片画框弹窗

- **WHEN** 图片节点存在上游连线，且当前所选 Run 中该节点状态为成功或复用，并具有可访问的图片资产
- **THEN** 节点标题栏常驻显示可用的“精准编辑”按钮
- **AND** 点击按钮打开现有图片画框编辑弹窗
- **AND** 弹窗名称、预览地址和画框坐标均对应当前上游结果资产
- **AND** 图片按原始宽高比完整显示，不拉伸或裁切

#### Scenario: 上游结果暂不可编辑

- **WHEN** 未选择 Run、上游仍在运行、上游失败或取消、结果不可用，或结果没有安全及下载地址
- **THEN** “精准编辑”按钮保持可见但禁用
- **AND** 提示准确说明等待、失败或不可用状态
- **AND** 不显示或使用本地备用图片

#### Scenario: 非 Pipeline 编辑模式

- **WHEN** 用户查看模板或历史只读快照
- **THEN** 可以按现有规则预览上游图片
- **AND** 不允许打开可写的精准编辑弹窗

### Requirement: 上游 BBox 独立资产绑定

图片节点配置 SHALL 增加一组独立于本地框选的可选字段：

- `upstream_bbox`：归一化到 `0..999` 的单个 BBox；
- `upstream_bbox_asset_id`：创建该 BBox 时当前有效上游图片的资产 ID。

两字段必须同时为空或同时非空。上游框选不得覆盖本地 `asset_id / bbox / bbox_asset_id`。

#### Scenario: 保存上游框选

- **WHEN** 用户在弹窗中对当前上游图片完成有效框选并确认
- **THEN** 系统将坐标写入 `upstream_bbox`
- **AND** 将弹窗打开时的上游结果 `asset_id` 写入 `upstream_bbox_asset_id`
- **AND** 根据用户选择同步更新符合资格的文本节点 BBox 引用
- **AND** 本地 `asset_id / bbox / bbox_asset_id` 保持原值

#### Scenario: 弹窗打开期间上游结果变化

- **WHEN** 用户打开弹窗后，当前有效上游资产在确认前发生变化
- **THEN** 系统拒绝提交基于旧图片的框选
- **AND** 关闭或刷新弹窗并提示“上游图片已更新，请重新框选”
- **AND** 不修改节点配置或文本引用

#### Scenario: 清除上游框选

- **WHEN** 用户在上游图片精准编辑弹窗中清除框选并确认
- **THEN** `upstream_bbox` 与 `upstream_bbox_asset_id` 同时清空
- **AND** 删除文本节点中指向该图片节点的 BBox 引用
- **AND** 本地框选保持不变

#### Scenario: 断开上游

- **WHEN** 用户删除图片节点的上游连线
- **THEN** 节点立即恢复本地资产和本地 BBox
- **AND** 上游 BBox 不作为本地 BBox 使用
- **AND** 再次连接上游时，仅当当前上游资产 ID 与已保存的 `upstream_bbox_asset_id` 一致时，上游框选才可恢复为有效状态

### Requirement: 上游换图后框选失效

系统 SHALL 以当前有效图片资产 ID 判断上游框选是否有效。`upstream_bbox_asset_id` 与当前所选 Run 的有效资产 ID 不一致时，框选为失效状态。

#### Scenario: 重新执行产生新资产

- **WHEN** 上游重新执行后图片节点投影到新的资产 ID
- **THEN** 旧上游 BBox 自动标记为失效
- **AND** 节点和弹窗不在新图片上显示旧框选
- **AND** 界面提示“上游图片已更新，请重新框选”
- **AND** 用户重新框选后，以新资产 ID 原子替换旧上游 BBox 绑定

#### Scenario: 切换历史 Run

- **WHEN** 用户切换到资产 ID 不同的历史 Run
- **THEN** 系统只按该 Run 的有效资产判断框选状态
- **AND** 切换 Run 本身不得修改 Pipeline definition
- **AND** 切回与 `upstream_bbox_asset_id` 匹配的 Run 时，原框选可重新显示

#### Scenario: 失效引用参与执行

- **WHEN** 文本节点仍引用该图片节点的上游 BBox，但本次执行解析到的实际图片资产 ID 与绑定资产 ID 不一致
- **THEN** 系统在调用图片模型前以 `bbox_reference_asset_changed` 拒绝该下游任务
- **AND** 错误包含图片节点 ID 和文本节点 ID
- **AND** 不得静默沿用旧坐标、移除引用或降级为无 BBox 提示词

### Requirement: 上游图片 BBox 引用与编译

上游图片节点 SHALL 可以作为 BBox 引用源，但文本节点仍须为无上游连线的本地文本节点，并与图片节点共同直接连接到同一个普通 `image_to_image` 节点。现有同源唯一、最多 10 条、顺序及安全标签规则保持不变。

#### Scenario: 编译有效上游 BBox

- **WHEN** 上游图片节点和本地文本节点共同连接普通图生图节点
- **AND** 图片节点的 `upstream_bbox_asset_id` 等于本次解析到的图片输入资产 ID
- **THEN** 系统按图片输入连线顺序编译 `图N<bbox>...</bbox>`
- **AND** 下游输入 Hash 包含实际图片资产摘要、上游 BBox、绑定资产 ID 和引用说明

#### Scenario: 上游框选尚未建立

- **WHEN** 上游图片节点没有有效的 `upstream_bbox`
- **THEN** 精准编辑弹窗仍允许用户选择符合共同下游规则的本地文本节点
- **AND** 文本节点不得保存指向无有效框选的新增引用

### Requirement: 模板与资产引用安全

模板创建、更新和实例化 SHALL 清除图片节点的 `upstream_bbox / upstream_bbox_asset_id`，并删除文本节点中指向该上游框选的引用。上游框选绑定不得使对应结果资产被登记为本地 `pipeline_assets`。

#### Scenario: 将包含上游框选的 Pipeline 保存为模板

- **WHEN** Pipeline 中存在上游图片 BBox 绑定
- **THEN** 模板保留节点和连线结构
- **AND** 清除上游 BBox 及其绑定资产 ID
- **AND** 同步删除相关文本引用、token 和引用说明
- **AND** 不复制或保护原 Run 的结果资产

## MODIFIED Requirements

### Requirement: 上游优先与本地内容保留

上游模式下，上游图片仍是唯一有效图片，上传、资产选择和本地框选编辑继续禁用；但系统 SHALL 允许用户针对当前有效上游结果创建独立的上游 BBox。该能力不得修改、覆盖或回退到本地备用内容。

### Requirement: 图片模态行为

图片节点在本地模式 SHALL 使用本地资产和本地 BBox；在上游模式 SHALL 展示当前所选 Run 的图片结果，并在结果可用时支持原图预览、下载和精准框选。两种模式分别使用各自的资产绑定 BBox。

### Requirement: BBox 引用节点类型

BBox 引用 SHALL 支持本地模式图片节点以及具有有效、资产匹配上游 BBox 的上游模式图片节点。引用文本节点仍必须处于本地模式。运行时必须根据图片节点模式选择本地或上游 BBox，并校验其绑定资产与实际输入资产一致。

### Requirement: 图片配置校验

本地 `bbox / bbox_asset_id` 继续要求绑定本地 `asset_id`。上游 `upstream_bbox / upstream_bbox_asset_id` 只做成对和坐标结构校验；其与实际上游资产的一致性 SHALL 在前端投影、DAG 资格判断和运行时参数解析阶段校验，因为 schema 层无法获知所选 Run 的有效资产。

## REMOVED Requirements

### Requirement: 上游图片节点禁止精准框选

**Reason**: 用户需要直接标注模型生成或其他上游节点输出的图片，并将区域引用继续传递给普通图生图节点。

**Migration**: 既有上游图片节点默认没有 `upstream_bbox / upstream_bbox_asset_id`，行为保持为仅预览和下载；用户首次对可用上游结果框选后才写入新字段。
