# 资产库左侧分区侧边栏 + 关键词搜索 实施计划

## Summary
在资产库页面（`/workspace/assets`）左侧新增一个分区侧边栏，可在 **全部 / 角色 / 场景 / 商品 / 产物** 之间切换；并新增关键词搜索框。两者均为**即时客户端交互**（无页面刷新、无后端往返）：
- 侧边栏切换分区改为组件本地状态，实时切换，各分区显示资产数量徽标；
- 关键词搜索**在当前分区范围内过滤**（选中"全部"时对四个分区各自过滤，选中具体分区时只过滤该分区）。

为支持即时切换，页面数据获取不再按 `category` 分区请求后端，而是一次性拉取当前项目/状态下的全部资产，分区归类与搜索全部在客户端完成。

## Current State Analysis

### 路由与组件
- 页面路由 [app/workspace/assets/page.tsx](file:///Users/bytedance/AD-Creativity/frontend/app/workspace/assets/page.tsx)（server component）解析 URL 筛选参数、拉取 `projects` + `assets`，渲染 `WorkspaceAssetLibrary`。
- 主组件 [components/workspace/workspace-asset-library.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/workspace-asset-library.tsx)（`"use client"`）：
  - 已实现四分区聚合（`characterAssets` / `sceneAssets` / `artifactItems` + 商品空态）、删除弹窗、客户端分页（`usePagedItems`，`PAGE_SIZE=6`）。
  - 顶部 `AssetFilters` 是一个 `method="get"` 表单，含 **项目 / 资产类型(section) / 状态** 三个下拉 + 筛选/重置按钮。其中"资产类型"下拉将被侧边栏取代。
  - `visibleSections`：当 `filters.section` 存在时只渲染该分区，否则渲染全部 `ASSET_SECTIONS`。
- 展示层 [lib/asset-display.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/asset-display.ts)：`ASSET_SECTIONS = [character, scene, product, artifacts]`、分区标签/描述、`buildArtifactItems`、`getWorkspaceAssetDescription`、`getArtifactKindLabel` 等。
- API 客户端 [lib/api-client.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/api-client.ts) 的 `listAssets` 只支持 `project_id` / `category` / `status` 查询参数，**无关键词搜索参数**（且 spec 明确不改后端）。→ 关键词搜索必须在客户端做。
- 布局 [app/workspace/layout.tsx](file:///Users/bytedance/AD-Creativity/frontend/app/workspace/layout.tsx) 为全宽 `main`，无侧边栏；顶部导航在 [components/layout/app-shell.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/layout/app-shell.tsx)。侧边栏应在资产库组件内部实现（局部 two-column），不改全局布局。

### 现有测试
[tests/workspace-asset-library.test.tsx](file:///Users/bytedance/AD-Creativity/frontend/tests/workspace-asset-library.test.tsx) 覆盖：`toApiFilters` 对 character 透传 `category`、对 artifacts 不透传、四分区渲染、产物/尾帧、删除、分页、空态。本次改动会影响 `toApiFilters` 行为与分区渲染入口，相关用例需更新。

### `Asset` 可搜索字段
`Asset`（[api-types.ts:249](file:///Users/bytedance/AD-Creativity/frontend/lib/api-types.ts#L249)）含 `metadata`（`description`/`name`/`prompt` 等文本）。搜索匹配以 `getWorkspaceAssetDescription(asset)` 为主，产物额外匹配 `getArtifactKindLabel(kind)`。

## Design Decisions（已与用户确认）
1. **侧边栏切换 = 即时客户端切换**：分区选择为组件本地 state，不走 URL 导航、不重新请求后端。
2. **搜索范围 = 当前分区内过滤**：搜索框对"当前可见分区"生效（全部→对每个分区各自过滤；具体分区→仅该分区）。
3. 为支持即时切换，`page.tsx` 拉取资产时**不再按 section 透传 `category`**，改为一次性拉取（仅受项目/状态影响），四分区归类在客户端完成。
4. 顶部筛选表单中的"资产类型"下拉**移除**（由侧边栏取代）；**项目 / 状态** 两个筛选保留为服务端 GET 表单（后端支持、可深链）。
5. URL `?section=` 仍被解析，仅用于**初始化**侧边栏选中项（向后兼容 & 深链），之后由本地 state 接管。

## Proposed Changes

### 1. [lib/asset-display.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/asset-display.ts)
新增侧边栏选项与搜索匹配辅助（纯函数，便于单测）：
- **新增** `ASSET_SIDEBAR_OPTIONS = ["all", "character", "scene", "product", "artifacts"] as const` 及类型 `AssetSidebarOption`。
- **新增** `getAssetSidebarLabel(option)`：`all → "全部"`，其余复用 `SECTION_LABELS`。
- **新增** `matchesKeyword(text, keyword): boolean` 内部工具：大小写不敏感、trim、空关键词返回 `true`。
- **新增** `assetMatchesKeyword(asset, keyword): boolean`：匹配 `getWorkspaceAssetDescription(asset)`。
- **新增** `artifactMatchesKeyword(item, keyword): boolean`：匹配 `getArtifactKindLabel(item.kind)` 或宿主资产的 `getWorkspaceAssetDescription(item.asset)`。
- 说明：`ASSET_SECTIONS`、`AssetSection`、既有标签函数保持不变，供分区渲染继续使用。

### 2. [components/workspace/workspace-asset-library.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/workspace-asset-library.tsx)
核心改造，保持现有删除/分页/卡片逻辑不动，只调整"分区选择 + 布局 + 搜索"：

- **本地状态新增**：
  - `activeOption: AssetSidebarOption`，初值 `filters.section ?? "all"`（兼容旧 URL）。
  - `keyword: string`，初值 `""`（受控搜索输入）。
- **分区数据 + 搜索过滤**（`useMemo`）：
  - 基于关键词得到 `filteredCharacter`、`filteredScene`（用 `assetMatchesKeyword`）、`filteredArtifacts`（用 `artifactMatchesKeyword`）。
  - 各分区**总量计数**（不受关键词影响）用于侧边栏徽标：`characterAssets.length` / `sceneAssets.length` / `artifactItems.length` / 商品固定 `0` / 全部 = 三者之和。
- **可见分区**：由 `activeOption` 决定——`"all"` → `ASSET_SECTIONS` 全部；否则 `[activeOption]`。移除原 `filters.section` 驱动逻辑。
- **布局改造为两栏**：外层 `flex`，左 `<AssetSidebar>`（桌面 `md:` 竖向、`w-52` 左右；移动端为横向可滚动 pill 行），右为原内容区。宽度沿用 `max-w-[96rem]` 容器。
  - `AssetSidebar`：渲染 5 个选项，每项 图标 + 中文标签 + 数量徽标；`activeOption` 高亮（复用现有 `SECTION_ICONS`，`all` 用合适图标如 `LayoutGrid`）。点击调用 `setActiveOption`。
- **搜索框**：在内容区顶部（筛选表单一行内或其下方）放置受控 `<input>` + `Search` 图标，`aria-label="搜索资产"`，`placeholder="按名称 / 描述搜索"`；`onChange` 更新 `keyword`。含"清除"按钮（有输入时显示）。
- **顶部筛选表单 `AssetFilters`**：删除"资产类型"(`section`) 下拉，仅保留 项目 / 状态 + 筛选/重置。
- **分区渲染入口**：`CategoryAssetSection` 传入 `filteredCharacter/Scene`，`ArtifactsSection` 传入 `filteredArtifacts`；分页 `usePagedItems` 天然对过滤后的数组重算（读时 clamp）。
- **空态**：
  - 关键词非空且当前可见分区过滤后均为空 → 显示"未找到匹配"提示（含清除搜索入口），不误报错误。
  - 保留原有无资产全局空态逻辑（关键词为空时）。
- 删除弹窗、`handleConfirmDelete`、`usePagedItems` 等**保持不变**。

### 3. [app/workspace/assets/page.tsx](file:///Users/bytedance/AD-Creativity/frontend/app/workspace/assets/page.tsx)
- `toApiFilters`：**移除**基于 section 的 `category` 透传，`category` 恒为 `undefined`（一次性拉取全部分区数据供客户端切换）。保留 `projectId` / `status`。
- `parseFilters`：保留解析 `section`（用于初始化侧边栏选中项）；`isAssetSection` 保持。
- 其余不变（仍向 `WorkspaceAssetLibrary` 传 `filters`）。

### 4. [tests/workspace-asset-library.test.tsx](file:///Users/bytedance/AD-Creativity/frontend/tests/workspace-asset-library.test.tsx)
更新/新增用例：
- 修改 `toApiFilters` 相关用例：断言 character section 下 **不再透传 category**（`category: undefined`），项目/状态仍透传。
- **新增** 侧边栏渲染：全部/角色/场景/商品/产物 五项可见，且显示数量徽标。
- **新增** 点击侧边栏"角色"仅渲染角色分区、点击"全部"渲染四分区（即时切换，无 API 调用）。
- **新增** 搜索：输入关键词后仅保留匹配卡片；清空后恢复；无匹配时显示"未找到匹配"。
- 保留并按需微调：产物/尾帧、删除、分页、空态用例（分区入口改由 `activeOption` 驱动，初值来自 `filters.section`，现有断言基本可沿用）。
- **新增**（可选）`asset-display` 纯函数单测：`assetMatchesKeyword` / `artifactMatchesKeyword` 命中与不命中。

## Assumptions & Decisions
- 商品分区维持空态占位，数量徽标恒为 `0`。
- 搜索为大小写不敏感的子串匹配，匹配范围为资产展示文案（描述/名称/提示词经 `getWorkspaceAssetDescription`）+ 产物子类型标签；不匹配 ID/项目名（避免误命中，范围最小可用）。
- 不改后端、不改 `listAssets` 签名、不新增删除/搜索端点。
- 侧边栏选择不写回 URL（符合"即时客户端切换"决策）；`?section=` 仅作初值兼容。
- 移动端侧边栏降级为横向 pill 行，保证小屏可用。

## Verification
1. `.venv` 不涉及（纯前端）。在 `frontend/` 下运行：
   - `npm test`（全部通过，含新增侧边栏/搜索用例）
   - `npm run typecheck`
   - `npm run lint`（`--max-warnings=0`）
2. 手动走查（可选）：`npm run dev` → `/workspace/assets`
   - 侧边栏五项切换即时生效、数量徽标正确；
   - 搜索在"全部"与具体分区下均按当前分区过滤；无匹配显示提示；
   - 删除、分页、项目/状态筛选、重置仍正常。
