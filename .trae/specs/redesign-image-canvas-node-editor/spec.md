# 图片编辑画布节点化重构 Spec

## Why
当前 `/projects/[projectId]/canvas` 画布页是「目标图 + 参考图侧栏 + 右侧指令面板」的固定三栏结构（见 `image-canvas-editor.tsx`），参考图与输出被约束在预设槽位里，无法自由排布、缩放，也不能表达「多个参考图对象 + 多次输出结果」并存的创作过程。用户希望把整页改造成一块可自由布局的**节点画布**：参考图与输出以可拖拽、可缩放的节点存在，提示词与图片配置固定停靠，从而支撑更自由、可回溯的图片创作工作流。

> 本次任务范围：**只产出设计方案（spec / tasks / checklist）**，不写实现代码。实现在方案确认后的 apply 阶段进行。

## What Changes
- **整页画布化**：画布页正文区改为一块无限画布（支持平移 pan、缩放 zoom），节点在画布上自由摆放。
- **引入成熟画布库**：采用 React Flow（`@xyflow/react`）承载节点拖拽、缩放、平移、自定义节点渲染（用户已确认「引入成熟画布库」）。
- **新增两类节点**：
  - **参考图节点**：承载单张参考图；支持本地上传或从资产库添加；可自由拖拽位置与缩放大小；按添加顺序编号为「图1、图2…」；可在图上画框提取 `bbox`，提取后自动引用到右侧提示词编辑器。
  - **输出节点**：展示生成结果（参考图生图 / 文生图 / 图层拆分产物）；提供下载、设为参考图、查看原图、图层拆分入口等操作。
- **固定右侧停靠面板**：提示词编辑器与图片配置（画幅 / 分辨率 / 格式）固定在画布右侧 dock，随画布常驻、不随节点移动（用户已确认「固定右侧停靠面板」）。
- **布局持久化到后端**：新增项目级画布布局文档，持久化节点类型、位置、尺寸、参考图引用与 `bbox`、输出引用；刷新或换设备后可恢复，使用 revision 乐观锁（用户已确认「需要持久化到后端」）。**BREAKING**：现有固定三栏 `ImageCanvasEditor` 作为画布页主体的用法被节点画布取代（组件本身在弹窗形态下的其它用法保留）。

## 非目标（Out of Scope）
- 不改动后端模型调用契约：文生图、参考图生图、图层拆分仍复用既有 `generateProjectImage` / `editProjectImage` / `decomposeImageLayers` 接口与冻结输入语义。
- 不改造图层编辑页（`/canvas/layers/[layerSetId]`）自身交互；画布仍通过路由跳转进入图层编辑。
- 不引入节点间连线（edge）语义作为功能依赖；如需连线仅作可选的视觉溯源，本期不做。
- 不改造 `/workspace/projects` 详情页只读展示与「进入画布」入口。

## Impact
- 影响能力：图片项目画布编辑（本 spec 取代 `extract-image-canvas-editing-pages` / `fill-canvas-editing-page` 中画布主体的三栏形态）、图片项目详情入口（不变）、图层编辑（跳转不变）。
- 影响代码（前端）：
  - `frontend/components/workspace/image-canvas-page.tsx`（编排改为节点画布 + 右侧 dock）
  - 新增 `frontend/components/workspace/canvas/*`（画布容器、参考图节点、输出节点、右侧 dock 面板、节点内 bbox 画框组件）
  - 复用/抽取 `image-canvas-editor.tsx` 内的 `BboxCanvas`、`VisualPromptEditor`、区域引用逻辑
  - `frontend/lib/api-client.ts`、`frontend/lib/api-types.ts`（新增画布布局读写方法与类型）
  - `frontend/package.json`（新增 `@xyflow/react` 依赖）
- 影响代码（后端）：
  - `backend/app/schemas/*`（画布布局 schema）
  - `backend/app/api/routes.py`（画布布局 GET/PUT 路由）
  - `backend/app/services/*` 与仓储层（布局读写、revision 乐观锁）
- 数据预取：画布页服务端在 `getProject` 之外并行拉取画布布局；无布局时返回默认空布局。

## ADDED Requirements

### Requirement: 节点画布工作区
系统 SHALL 将图片画布编辑页正文区呈现为一块可平移、可缩放的无限画布，节点在其上自由摆放，画布铺满顶部导航下方区域且四周无留白。

#### Scenario: 进入画布
- **WHEN** 用户访问 `/projects/{projectId}/canvas`
- **THEN** 页面在服务端预取项目与画布布局后，渲染节点画布与固定右侧停靠面板
- **AND THEN** 画布支持鼠标拖拽平移、滚轮/手势缩放，节点按持久化布局还原位置与尺寸

#### Scenario: 空画布引导
- **WHEN** 项目尚无任何节点
- **THEN** 画布显示空态引导（添加参考图节点 / 直接在右侧输入提示词生成），不阻塞后续操作

### Requirement: 参考图节点
系统 SHALL 支持在画布中添加参考图节点，每个节点承载单张参考图，支持自由拖拽、缩放，并按添加顺序编号为「图N」。

#### Scenario: 添加参考图节点并载入图片
- **WHEN** 用户新增参考图节点并选择「本地上传」或「从资产库添加」
- **THEN** 本地上传复用既有参考图上传链路，资产库添加复用资产库选择器返回的资产
- **AND THEN** 节点显示该参考图与编号徽标「图N」（N 按项目内参考图节点的添加顺序递增）

#### Scenario: 自由拖拽与缩放
- **WHEN** 用户拖拽参考图节点或拖拽其缩放手柄
- **THEN** 节点位置/尺寸实时更新，并在操作结束后随画布布局持久化到后端
- **AND THEN** 缩放保持参考图原始宽高比，不拉伸不裁切

#### Scenario: 画框提取 bbox 并自动引用
- **WHEN** 用户在参考图节点内的图片上框选一个有效区域
- **THEN** 系统按归一化坐标记录该参考图的 `bbox`
- **AND THEN** 右侧提示词编辑器自动出现该参考图的区域引用条目（含「图N」编号与 `bbox`），引用条目不可手工篡改坐标

#### Scenario: 清除区域与移除节点
- **WHEN** 用户清除某参考图节点的框选或删除该节点
- **THEN** 右侧提示词编辑器中对应的区域引用同步移除
- **AND THEN** 移除节点仅解除画布引用与项目参考选择，不删除后端原始资产文件；删除前进行二次确认

### Requirement: 输出节点
系统 SHALL 以输出节点承载生成结果，覆盖参考图生图、文生图与图层拆分产物的展示与后续操作。

#### Scenario: 生成产生输出节点
- **WHEN** 用户在右侧面板提交生成（文生图或参考图生图）
- **THEN** 画布新增一个输出节点，展示任务进行中的状态并轮询结果，成功后展示生成图片
- **AND THEN** 输出节点位置/尺寸可拖拽、缩放并随布局持久化，图片严格保持原始宽高比

#### Scenario: 输出节点操作
- **WHEN** 用户在成功的输出节点上操作
- **THEN** 可执行下载、查看原图、设为参考图（加入参考并可作为新参考图节点）等动作
- **AND THEN** 触发「图层拆分」时，沿用既有拆分链路，完成后导航到 `/projects/{projectId}/canvas/layers/{layerSetId}`

### Requirement: 固定右侧停靠面板
系统 SHALL 在画布右侧提供固定停靠面板，承载提示词编辑器与图片配置（画幅、分辨率、格式）及生成操作，面板随画布常驻，不随节点平移/缩放移动。

#### Scenario: 配置与提示词常驻
- **WHEN** 用户平移或缩放画布
- **THEN** 右侧停靠面板保持固定位置与尺寸，配置项（画幅/分辨率/格式）与提示词编辑器可随时访问

#### Scenario: 生成模式判定
- **WHEN** 用户提交生成
- **THEN** 若存在被引用的参考图区域则走参考图生图链路，否则走文生图链路；输入不完整时生成保持禁用并给出可恢复提示

### Requirement: 画布布局持久化
系统 SHALL 提供项目级画布布局的读取与保存接口，持久化节点类型、位置、尺寸、参考图引用与 `bbox`、输出引用，并以 revision 乐观锁避免并发覆盖。

#### Scenario: 读取与恢复
- **WHEN** 画布页加载
- **THEN** 服务端返回该项目的画布布局（含 revision）；无布局时返回默认空布局
- **AND THEN** 前端据此还原节点位置、尺寸、编号、参考图与 `bbox`、输出引用

#### Scenario: 保存与乐观锁
- **WHEN** 用户对节点进行拖拽/缩放/增删或框选等布局变更
- **THEN** 前端以防抖方式携带 `expected_revision` 保存布局，成功后 revision 递增
- **AND THEN** 当 `expected_revision` 与服务端不一致时，不覆盖远端状态并提示用户刷新

## MODIFIED Requirements

### Requirement: 图片画布编辑独立页面
系统 SHALL 保留 `/(projects)/[projectId]/canvas` 独立路由与服务端预取范式，但正文区由固定三栏编辑器改为**节点画布 + 固定右侧停靠面板**；关闭仍导航回上一页，项目不存在或加载失败仍按既有范式返回未找到/错误提示。

## REMOVED Requirements

### Requirement: 画布页固定三栏编辑器主体
**Reason**: 固定「目标图 / 参考图侧栏 / 指令面板」三栏无法满足参考图与输出自由排布、缩放、并存的节点化诉求。
**Migration**: 画布页主体改用节点画布；`BboxCanvas`、`VisualPromptEditor` 与区域引用逻辑抽取复用；`ImageCanvasEditor` 组件的弹窗形态用法（如有其它入口）保留不受影响。
