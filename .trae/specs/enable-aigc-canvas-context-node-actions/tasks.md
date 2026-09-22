# AIGC 画布右键创建与节点重命名 Implementation Plan

> **For agentic workers:** 按任务顺序实施；先写失败测试，再做最小实现。无依赖任务可并行，但不得改动无关工作区文件。

**Goal:** 支持在 AIGC 画布右键搜索并按指针位置创建节点，同时允许所有节点通过原位编辑或配置栏持久化自定义名称。

**Architecture:** 在节点公共 schema 增加可选 `custom_name`，统一显示名解析后接入所有节点识别界面。编辑器状态层提供按坐标创建和单次提交重命名能力；UI 层分别管理画布节点选择面板与节点重命名菜单，不改变执行输入、缓存和 Provider 参数。

**Tech Stack:** Python 3.14、Pydantic v2、FastAPI、React 19、Next.js 16、TypeScript、Zustand、TanStack Query、React Flow、Vitest、Playwright

---

## File Map

- Modify `backend/app/schemas/aigc.py`: 为所有 v1/v2 节点增加并校验 `custom_name`。
- Verify/Modify `backend/app/services/aigc_pipeline.py`: 确保迁移、模板净化和 canonicalization 保留名称。
- Modify `backend/tests/test_aigc_schemas.py`: 覆盖名称规范化、无效输入和序列化。
- Modify `backend/tests/test_aigc_definition_migration_v2.py`: 覆盖旧定义兼容与 v1 -> v2 名称保留。
- Modify `backend/tests/test_aigc_executor.py`: 证明名称不影响 input hash 和 Provider 参数。
- Modify `frontend/lib/aigc/types.ts`: 增加节点公共 `custom_name` 类型。
- Modify `frontend/lib/aigc/editor-store.ts`: 支持指定坐标创建和单次提交节点名称。
- Modify `frontend/lib/aigc/node-display-name.ts`: 实现自定义名称优先级。
- Create `frontend/components/workspace/aigc/aigc-canvas-context-menu.tsx`: 实现搜索式节点选择面板与节点重命名菜单。
- Modify `frontend/components/workspace/aigc/aigc-editor.tsx`: 接入 React Flow 坐标转换、菜单状态、配置栏名称字段和自动保存。
- Modify `frontend/components/workspace/aigc/aigc-flow-node.tsx`: 接入原位标题编辑。
- Modify `frontend/tests/aigc-editor-store-v2.test.ts`: 覆盖坐标创建、重命名、撤销重做。
- Modify `frontend/tests/aigc-node-display-name.test.ts`: 覆盖名称优先级和重复名称。
- Modify `frontend/tests/aigc-flow-node.test.tsx`: 覆盖标题原位编辑键盘行为。
- Modify `frontend/tests/aigc-editor.test.tsx`: 覆盖两个右键菜单、搜索、创建位置和配置栏同步。
- Create `frontend/scripts/verify-aigc-node-context-actions.mjs`: Mock 多视口浏览器验收。
- Modify `frontend/package.json`: 注册 `acceptance:aigc-node-context-actions` 验收命令。

## Task 1: 建立通用节点名称数据契约

**Files:**
- Modify: `backend/app/schemas/aigc.py`
- Modify: `frontend/lib/aigc/types.ts`
- Test: `backend/tests/test_aigc_schemas.py`
- Test: `backend/tests/test_aigc_definition_migration_v2.py`

- [x] **Step 1: 写入后端失败测试**
  - 断言所有节点类型都接受顶层 `custom_name`。
  - 断言缺失、`null` 和纯空白名称归一化为 `None`。
  - 断言名称去除首尾空白并保留合法 Unicode。
  - 断言超过 120 字符、换行或控制字符被拒绝。
  - 断言不同节点允许相同名称。

- [x] **Step 2: 实现节点公共字段**
  - 在 `AigcNodeBase` 增加 `custom_name: str | None = None`。
  - 使用单个字段校验器执行 trim、空白转 `None`、单行与控制字符限制。
  - 不修改 definition schema version。

- [x] **Step 3: 更新前端公共类型**
  - 在泛型 `AigcNodeBase` 增加兼容历史 payload 的 `custom_name?: string | null`。
  - 现有手写 Fixture 缺失字段时通过迁移/normalize 补为 `null`，避免要求一次性改写全部旧测试数据。

- [x] **Step 4: 验证历史定义与迁移**
  - 历史 v1/v2 payload 缺失字段时正常读取。
  - v1 -> v2 migration 保留已有 `custom_name`。
  - `model_dump(..., by_alias=True)` 稳定输出 `custom_name`。

- [x] **Step 5: 运行数据契约测试**

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_schemas.py \
  backend/tests/test_aigc_definition_migration_v2.py -q
```

Expected: PASS。

## Task 2: 实现状态层坐标创建与重命名

**Files:**
- Modify: `frontend/lib/aigc/editor-store.ts`
- Test: `frontend/tests/aigc-editor-store-v2.test.ts`

- [x] **Step 1: 写入失败的 store 测试**
  - `addNode(type)` 保持左侧节点库默认位置。
  - `addNode(type, position)` 使用显式位置并按 16px 网格吸附。
  - 显式位置按节点默认尺寸居中，而不是把鼠标位置当节点左上角。
  - `setNodeCustomName(nodeId, value)` trim 后保存；空白保存为 `null`。
  - 一次提交只增加一个历史快照，撤销/重做恢复名称。
  - 未知节点 ID 不修改 definition。

- [x] **Step 2: 扩展 store API**
  - 将 `addNode` 签名改为 `addNode(type, centerPosition?)`。
  - 在 `createNode` 公共字段中初始化 `custom_name: null`。
  - 新增 `setNodeCustomName(nodeId, customName)`，只在归一化值变化时 `commit`。

- [x] **Step 3: 保持 normalize/rebase 兼容**
  - `normalizeDefinition` 为缺失字段补 `null`。
  - dirty draft 与服务端 revision 合并时按稳定节点 ID 保留本地名称。
  - JSON Parser 管理文本节点按 managed key 更新时保留现有 `custom_name`。

- [x] **Step 4: 运行 store 测试**

```bash
cd frontend
npx vitest run tests/aigc-editor-store-v2.test.ts
```

Expected: PASS。

## Task 3: 统一节点名称解析与展示

**Files:**
- Modify: `frontend/lib/aigc/node-display-name.ts`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`
- Test: `frontend/tests/aigc-node-display-name.test.ts`
- Test: `frontend/tests/aigc-prompt-editor.test.tsx`

- [x] **Step 1: 写入显示优先级测试**
  - `custom_name` 高于自动编号。
  - 管理文本节点无自定义名称时使用 item label。
  - 普通未命名节点沿用基础名称和连续编号。
  - 重复自定义名称原样显示且不追加编号。
  - 清空名称恢复原编号。

- [x] **Step 2: 扩展统一显示名结果**
  - 让显示名解析接受 managed item label 上下文，或提供统一的最终名称 helper。
  - 固定优先级为 `custom_name > item label > derived auto name`。
  - 自动编号继续按全部同类节点的 definition 顺序计算，自定义名称只覆盖对应节点的最终显示，避免其他节点因重命名而重新编号。

- [x] **Step 3: 接入全部节点识别界面**
  - 画布标题、配置栏分组、BBox token、精准框选列表、结果中的节点来源标题和可访问名称使用统一最终名称。
  - 删除各组件中绕过统一 helper 的 `managedSource?.itemLabel ?? displayName` 拼接。
  - 媒体预览、下载文件等内容标题继续使用 `config.title`。
  - 保留稳定节点 ID 作为内部键和操作参数。

- [x] **Step 4: 区分节点名称与内容标题**
  - 所有节点配置顶部增加“节点名称”字段。
  - 文本、图片、视频、音频节点现有“显示标题”标签改为“内容标题”。
  - 两个字段互不写入对方。

- [x] **Step 5: 运行名称相关测试**

```bash
cd frontend
npx vitest run \
  tests/aigc-node-display-name.test.ts \
  tests/aigc-prompt-editor.test.tsx \
  tests/aigc-editor.test.tsx
```

Expected: PASS。

## Task 4: 实现节点右键原位重命名

**Files:**
- Create: `frontend/components/workspace/aigc/aigc-canvas-context-menu.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Test: `frontend/tests/aigc-flow-node.test.tsx`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [x] **Step 1: 写入节点右键测试**
  - 右键节点阻止浏览器菜单并只打开节点菜单。
  - 节点菜单本期只有“重命名”。
  - 选择后标题输入自动聚焦并全选当前有效名称。
  - `Enter` 保存，`Escape` 取消，失焦保存。
  - 无变化、无效输入和取消操作不产生 store commit。

- [x] **Step 2: 建立上下文菜单组件**
  - 使用语义化 `role="menu"` / `role="menuitem"`。
  - 菜单位置限制在编辑器可视边界内。
  - 支持 `Escape`、点击外部、再次右键和选择操作关闭。
  - 不新增第三方菜单依赖。

- [x] **Step 3: 接入 React Flow 节点事件**
  - 使用 `onNodeContextMenu` 选择节点并打开节点菜单。
  - 调用 `preventDefault` / `stopPropagation`，避免同时打开空白菜单。
  - 点击“重命名”后只为目标节点进入编辑态。

- [x] **Step 4: 实现标题原位编辑**
  - `AigcFlowNode` 接收编辑态与提交/取消回调。
  - 输入使用本地草稿，限制 120 字符和单行文本。
  - 提交调用一次 `setNodeCustomName`；`Escape` 恢复旧值。
  - 编辑输入阻止节点拖拽、连线和快捷键删除事件。

- [x] **Step 5: 运行右键重命名测试**

```bash
cd frontend
npx vitest run \
  tests/aigc-flow-node.test.tsx \
  tests/aigc-editor.test.tsx
```

Expected: PASS。

## Task 5: 实现画布右键搜索创建

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-canvas-context-menu.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [x] **Step 1: 写入空白右键测试**
  - `onPaneContextMenu` 打开搜索面板并聚焦搜索框。
  - 面板列出注册表中的全部可添加 v2 节点并按 category 分组。
  - 中文名称和稳定 type 均可搜索。
  - 无结果、方向键、`Enter`、`Escape`、外部点击行为确定。
  - 节点右键不打开空白节点面板。

- [x] **Step 2: 捕获 React Flow 实例与目标坐标**
  - 通过 `onInit` 保存 `ReactFlowInstance`。
  - 调用 `screenToFlowPosition({ x: event.clientX, y: event.clientY })`。
  - 将转换后的中心位置传给 `addNode(type, position)`。

- [x] **Step 3: 实现搜索节点面板**
  - 使用 `AIGC_NODE_REGISTRY_BY_TYPE` 生成项目，不复制节点清单。
  - 展示分类、模态图标/颜色、节点中文名称。
  - 支持大小写不敏感 type 搜索和中文 label 搜索。
  - 在右侧/底部空间不足时向内避让，设置稳定最大高度和滚动区域。

- [x] **Step 4: 保持现有入口和关闭逻辑**
  - 左侧节点库继续调用无坐标 `addNode(type)`。
  - 画布普通点击继续关闭检查器，并额外关闭上下文菜单。
  - 拖拽、缩放、连线、Delete/Backspace 与现有行为不变。
  - 触摸端不增加长按监听。

- [x] **Step 5: 运行编辑器测试**

```bash
cd frontend
npx vitest run tests/aigc-editor.test.tsx
```

Expected: PASS。

## Task 6: 验证持久化与执行隔离

**Files:**
- Verify/Modify: `backend/app/services/aigc_pipeline.py`
- Test: `backend/tests/test_aigc_definition_migration_v2.py`
- Test: `backend/tests/test_aigc_executor.py`
- Test: `frontend/tests/aigc-editor-store-v2.test.ts`
- Test: `frontend/tests/aigc-editor.test.tsx`

- [x] **Step 1: 覆盖 Pipeline 与模板**
  - Pipeline 更新后名称随 definition 保存。
  - 模板保存、资产净化、实例化均保留名称。
  - Run `definition_snapshot` 保留提交时名称。

- [x] **Step 2: 覆盖自动保存与 revision 合并**
  - 原位和配置栏重命名触发既有 autosave。
  - 保存成功后 dirty 清除，刷新后名称保持。
  - 服务端新 revision 到达时不覆盖尚未保存的本地名称。

- [x] **Step 3: 证明执行输入不变**
  - 对只修改 `custom_name` 的两个 definition 计算相同 input hash。
  - Gateway task params 不包含 `custom_name`。
  - 名称变化不改变缓存候选、端口、边或资产绑定。

- [x] **Step 4: 运行持久化和执行测试**

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_definition_migration_v2.py \
  backend/tests/test_aigc_executor.py -q

cd frontend
npx vitest run \
  tests/aigc-editor-store-v2.test.ts \
  tests/aigc-editor.test.tsx
```

Expected: PASS。

## Task 7: Mock 浏览器验收与全量门禁

**Files:**
- Create/Modify: `frontend/scripts/verify-aigc-node-context-actions.mjs`
- Modify: `frontend/package.json`
- Modify: `.trae/specs/enable-aigc-canvas-context-node-actions/checklist.md`

- [x] **Step 1: 建立非计费 Fixture**
  - 创建包含未命名节点、已命名节点、媒体内容标题和 JSON Parser 管理文本节点的 Pipeline。
  - 所有 Run 和资产请求使用 Mock；不得执行生成按钮或调用 Provider。

- [x] **Step 2: 验证右键创建**
  - 在缩放和平移后的画布空白处右键。
  - 搜索并键盘创建一个节点。
  - 断言菜单在视口内，节点位置与右键 flow position 相符。
  - 验证中文 label/type 搜索、无结果和 Escape。

- [x] **Step 3: 验证重命名**
  - 右键节点并进入原位编辑。
  - 验证 `Escape` 取消、`Enter` 保存、失焦保存和清空恢复自动名。
  - 验证配置栏同步、内容标题不变、重复自定义名称可显示。
  - 验证自动保存请求中的 `custom_name` 及刷新恢复。

- [x] **Step 4: 运行后端全量测试**

```bash
.venv/bin/python -m pytest backend/tests -q
```

Expected: 全部 PASS。

- [x] **Step 5: 运行前端完整门禁**

```bash
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 全部 PASS，ESLint 0 warnings。

- [x] **Step 6: 运行多视口 Playwright**

```bash
cd frontend
npm run acceptance:aigc-node-context-actions
```

Expected: `1440x1000`、`1024x768`、`390x844` 通过；无真实生成请求、控制台错误、页面异常、横向溢出或控件重叠。

- [x] **Step 7: 核对验收清单**
  - 逐项验证 `checklist.md`。
  - 任一失败项先追加修复任务，修复后重新执行对应测试和验收。

## Task Dependencies

- Task 2 depends on Task 1。
- Task 3 depends on Task 1。
- Task 4 depends on Task 2 and Task 3。
- Task 5 depends on Task 2 and may proceed in parallel with Task 4 after the shared context-menu shell exists。
- Task 6 depends on Task 1-5。
- Task 7 depends on Task 6。
