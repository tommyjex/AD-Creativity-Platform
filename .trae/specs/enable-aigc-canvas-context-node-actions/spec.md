# AIGC 画布右键创建与节点重命名 Spec

## Why

当前 AIGC 画布只能通过左侧节点库添加节点，用户在大型流程中需要频繁跨越画布操作，效率较低。节点标题又主要依赖系统派生名称，除部分媒体节点外无法表达节点在具体流程中的业务职责。

## What Changes

- 在 AIGC 画布空白处右键打开光标旁的可搜索节点选择面板。
- 节点选择面板复用现有节点注册表，支持分类、搜索、键盘导航，并在右键位置对应的画布坐标创建节点。
- 在节点上右键打开节点菜单，提供“重命名”操作。
- 重命名采用节点标题原位编辑：`Enter` 或失焦保存，`Escape` 取消。
- 所有节点在右侧配置栏显示同一个“节点名称”字段。
- 为 v1/v2 节点增加可选通用字段 `custom_name`，与媒体内容标题 `config.title` 分离。
- 自定义名称优先于系统自动编号；清空后恢复自动名称。
- 自定义名称参与 Pipeline、模板、自动保存、撤销重做和 Run 快照，但不影响执行输入哈希、缓存、端口、连线或资产关系。
- 保留现有左侧节点库；本次不增加移动端长按菜单。

## Impact

- Affected specs:
  - AIGC 工作台节点创建
  - AIGC 节点显示名
  - AIGC Pipeline/模板定义持久化
  - AIGC 自动保存与历史操作
- Affected code:
  - `backend/app/schemas/aigc.py`
  - `backend/app/services/aigc_pipeline.py`
  - `backend/tests/test_aigc_schemas.py`
  - `backend/tests/test_aigc_definition_migration_v2.py`
  - `frontend/lib/aigc/types.ts`
  - `frontend/lib/aigc/editor-store.ts`
  - `frontend/lib/aigc/node-display-name.ts`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - 新增 `frontend/components/workspace/aigc/aigc-canvas-context-menu.tsx`
  - `frontend/tests/aigc-editor-store-v2.test.ts`
  - `frontend/tests/aigc-node-display-name.test.ts`
  - `frontend/tests/aigc-flow-node.test.tsx`
  - `frontend/tests/aigc-editor.test.tsx`
  - 新增或扩展 Playwright Mock 验收脚本

## ADDED Requirements

### Requirement: 画布右键节点选择面板

系统 SHALL 在 Pipeline 和模板编辑器的画布空白区域响应鼠标右键，并在指针附近打开可搜索的节点选择面板。面板 SHALL 阻止该区域的浏览器原生上下文菜单，但不得影响应用外部区域。

面板 SHALL 复用 `AIGC_NODE_REGISTRY_BY_TYPE` 中当前可添加的 v2 节点类型、名称、分类和模态色，不维护第二份节点目录。节点按“模态 / 模型 / 控制”分类展示，搜索同时匹配中文显示名和稳定节点类型。

#### Scenario: 在空白处打开节点选择面板

- **WHEN** 用户在画布空白处右键
- **THEN** 系统在指针附近打开节点选择面板
- **AND** 搜索输入自动获得焦点
- **AND** 不显示浏览器原生右键菜单

#### Scenario: 搜索节点

- **WHEN** 用户输入“文生图”或 `text_to_image`
- **THEN** 面板只展示匹配的节点类型
- **AND** 匹配结果继续显示所属分类和模态色

#### Scenario: 搜索无结果

- **WHEN** 搜索词无法匹配任何节点
- **THEN** 面板显示明确的空结果状态
- **AND** 不创建节点

#### Scenario: 键盘选择节点

- **WHEN** 面板打开且用户使用上/下方向键移动高亮项
- **THEN** 高亮在当前过滤结果中循环或受边界约束移动
- **WHEN** 用户按 `Enter`
- **THEN** 创建当前高亮节点并关闭面板
- **WHEN** 用户按 `Escape`
- **THEN** 关闭面板且不创建节点

### Requirement: 按右键位置创建节点

系统 SHALL 使用 React Flow 的屏幕坐标转画布坐标能力，将右键事件的 `clientX/clientY` 转换为当前缩放和平移状态下的 flow position。新节点 SHALL 以该位置为中心并遵循现有 16px 网格吸附规则。

菜单视觉位置 SHALL 保持在编辑器可视区域内；菜单避让不得改变节点的目标画布坐标。

#### Scenario: 缩放和平移后创建节点

- **WHEN** 用户缩放或平移画布后在某处右键并选择节点
- **THEN** 新节点中心出现在对应的画布位置
- **AND** 其持久化坐标不是未经转换的屏幕坐标

#### Scenario: 在视口边缘打开面板

- **WHEN** 用户在画布右侧或底部边缘右键
- **THEN** 面板向可视区内避让且全部操作可达
- **AND** 新节点仍创建在原始右键对应的画布位置

#### Scenario: 保留左侧节点库

- **WHEN** 用户通过现有左侧节点库添加节点
- **THEN** 节点继续使用现有默认排布行为
- **AND** 右键创建能力不改变节点库、模板模式或移动端既有流程

### Requirement: 通用节点自定义名称

每个 AIGC 节点 SHALL 提供可选顶层字段 `custom_name`。该字段 SHALL 与节点 `config` 分离，适用于 v1/v2 全部节点类型，最大长度为 120 个 Unicode 字符。

服务端 SHALL 去除名称首尾空白；缺失、`null` 或纯空白名称统一视为未命名。名称为单行文本，不接受换行或控制字符。不同节点可以使用相同自定义名称。

旧 Pipeline、模板和 Run 快照缺少该字段时 SHALL 正常读取并按 `custom_name = null` 处理，不升级 definition schema 版本。

#### Scenario: 保存自定义名称

- **WHEN** 用户将节点名称设为“商品主视觉生成”
- **THEN** Pipeline definition 在该节点顶层保存 `custom_name: "商品主视觉生成"`
- **AND** 不修改节点 ID、类型或 `config.title`

#### Scenario: 清空自定义名称

- **WHEN** 用户清空名称或只输入空白字符
- **THEN** 系统保存 `custom_name: null`
- **AND** 节点恢复系统派生名称

#### Scenario: 读取历史定义

- **WHEN** 系统读取不含 `custom_name` 的历史 Pipeline、模板或 Run 快照
- **THEN** 定义校验和迁移正常完成
- **AND** 节点显示原有自动名称

#### Scenario: 名称长度或格式无效

- **WHEN** 名称超过 120 字符或包含换行/控制字符
- **THEN** 前端阻止提交无效值
- **AND** 后端 schema 拒绝绕过前端的无效定义

### Requirement: 自定义名称显示优先级

系统 SHALL 通过统一节点显示名函数解析名称，优先级固定为：

1. 非空 `custom_name`；
2. JSON Parser 管理文本节点的 item label；
3. 现有基础名称和重复节点自动编号。

自定义名称 SHALL 原样显示，不追加自动编号。基础名称分组和编号仍按全部同类节点的 definition 顺序计算，自定义名称只覆盖该节点的最终显示，不使其他节点重新编号。画布标题、右侧配置标题、BBox 来源/目标、结果中的节点来源标题、精准框选列表和相关可访问名称 SHALL 使用同一解析结果；媒体预览、下载文件等内容标题继续使用 `config.title`。

#### Scenario: 自定义名称覆盖自动编号

- **WHEN** “文生图1”节点设置 `custom_name = "商品主视觉生成"`
- **THEN** 所有节点识别界面显示“商品主视觉生成”
- **AND** 同组其他未命名节点继续使用其原有自动编号，不因该节点被命名而重排

#### Scenario: 允许名称重复

- **WHEN** 两个节点均命名为“备选方案”
- **THEN** 两个节点均显示该名称
- **AND** 系统仍使用稳定节点 ID 区分配置、连线和运行状态

#### Scenario: 媒体内容标题保持独立

- **WHEN** 图片节点的 `custom_name` 为“商品参考图”且 `config.title` 为“白底产品图”
- **THEN** 画布节点名称使用“商品参考图”
- **AND** 内容预览、下载或资产语义仍可使用“白底产品图”

### Requirement: 节点右键原位重命名

系统 SHALL 在节点右键时选择该节点、阻止画布空白菜单，并打开节点上下文菜单。该菜单本期仅提供“重命名”，不新增删除、运行或复制行为。

选择“重命名”后，节点标题 SHALL 替换为单行输入框并全选当前有效名称。`Enter` 或失焦提交一个重命名操作，`Escape` 恢复编辑前值。提交后焦点返回节点或画布。

#### Scenario: 原位重命名

- **WHEN** 用户右键节点并选择“重命名”
- **THEN** 节点标题进入原位编辑且当前名称被选中
- **WHEN** 用户输入新名称并按 `Enter`
- **THEN** 名称保存、编辑态关闭并触发既有自动保存

#### Scenario: 取消重命名

- **WHEN** 用户编辑名称后按 `Escape`
- **THEN** 编辑态关闭且节点定义不变
- **AND** 不产生撤销历史或自动保存请求

#### Scenario: 失焦提交

- **WHEN** 用户输入有效名称后点击画布其他位置
- **THEN** 系统提交一次重命名并关闭编辑态
- **AND** 同一次编辑只生成一个撤销历史项

### Requirement: 配置栏节点名称

系统 SHALL 在所有节点类型的右侧配置栏顶部提供“节点名称”输入，与原位编辑操作同一 `custom_name` 字段。配置栏输入采用本地草稿并在 `Enter` 或失焦时提交，`Escape` 恢复当前持久值。

媒体节点现有“显示标题” SHALL 改用“内容标题”标签以明确其仍绑定 `config.title`，不得自动迁移为 `custom_name`。

#### Scenario: 从配置栏重命名

- **WHEN** 用户在任意节点的配置栏修改“节点名称”
- **THEN** 画布标题和其他名称引用同步更新
- **AND** 一次确认产生一个撤销历史项

#### Scenario: 两个名称字段互不覆盖

- **WHEN** 用户修改媒体节点的“节点名称”
- **THEN** `config.title` 保持不变
- **WHEN** 用户修改“内容标题”
- **THEN** `custom_name` 保持不变

### Requirement: 持久化与执行隔离

`custom_name` SHALL 通过现有 Pipeline/模板定义、自动保存、服务端 revision、Run definition snapshot 和 JSON Parser 节点合并流程持久化。模板资产净化 SHALL 保留名称。

名称变化属于编辑器历史操作，但 SHALL 被执行输入哈希、Provider 参数和缓存命中逻辑忽略。仅修改名称不得改变端口、边、资产绑定或节点执行结果。

#### Scenario: 自动保存与刷新

- **WHEN** 用户确认节点重命名并等待自动保存完成
- **THEN** 刷新页面后名称保持
- **AND** Pipeline revision 按现有规则递增

#### Scenario: 撤销与重做

- **WHEN** 用户完成一次重命名
- **THEN** 一次撤销恢复旧名称
- **AND** 一次重做恢复新名称

#### Scenario: 模板与 Run 快照

- **WHEN** 用户保存模板、实例化模板或创建 Run
- **THEN** `custom_name` 保留在对应 definition 或 snapshot
- **AND** 模板资产净化只清理资产相关字段，不清理节点名称

#### Scenario: 名称不影响执行缓存

- **WHEN** 两次定义仅有 `custom_name` 不同而节点配置与输入相同
- **THEN** 节点 input hash 保持相同
- **AND** Provider 请求参数不包含 `custom_name`

## MODIFIED Requirements

### Requirement: AIGC 节点标题

AIGC 节点标题 SHALL 优先显示通用 `custom_name`。未设置时，JSON Parser 管理文本节点继续显示 item label，其他节点继续使用基础显示名和重复节点自动编号。所有引用节点名称的界面复用同一解析函数。

### Requirement: AIGC 节点创建

AIGC 编辑器 SHALL 同时支持左侧节点库创建和画布空白处右键搜索创建。两种入口创建相同节点类型和默认配置；左侧节点库使用既有默认位置，右键入口使用转换后的指针画布位置。

### Requirement: 媒体节点显示标题

文本、图片、视频和音频节点现有 `config.title` SHALL 继续表示内容、预览或资产标题，并在配置栏标记为“内容标题”。节点身份名称由顶层 `custom_name` 独立提供。

## REMOVED Requirements

无。
