# 精简顶部导航与工作台侧边栏 Spec

## Why
当前顶部导航的“创作中枢 / 平台能力 / 端到端流程”只是首页锚点跳转，信息密度低且与实际工作流脱节；创作工作台又单独维护一套左侧边栏来放“项目 / 资产库”，导致导航分裂、占用横向空间。将工作台入口上收到顶部导航，可统一导航心智、简化界面。

## What Changes
- 顶部导航删除“创作中枢”“平台能力”“端到端流程”三个锚点导航项。
- 顶部导航新增“项目”“资产库”两个导航项，分别指向 `/workspace/projects` 与 `/workspace/assets`，并根据当前路由高亮当前项。
- 创作工作台删除左侧边栏（桌面端 `aside` 与移动端顶部横向模块条），“项目 / 资产库”不再由工作台内部导航承载。
- 工作台主内容区移除为侧边栏预留的 `lg:ml-64` 左侧偏移。
- **BREAKING**（仅前端结构）：`WorkspaceNavigation` 组件不再渲染工作台内导航，相关测试同步调整。

## Impact
- Affected specs: 前端工作台导航结构、首页顶部导航
- Affected code:
  - [frontend/components/layout/app-shell.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/layout/app-shell.tsx)
  - [frontend/components/workspace/workspace-navigation.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/workspace-navigation.tsx)
  - [frontend/app/workspace/layout.tsx](file:///Users/bytedance/AD-Creativity/frontend/app/workspace/layout.tsx)
  - [frontend/tests/workspace-navigation.test.tsx](file:///Users/bytedance/AD-Creativity/frontend/tests/workspace-navigation.test.tsx)

## ADDED Requirements

### Requirement: 顶部导航承载工作台入口
系统 SHALL 在全局顶部导航中提供“项目”和“资产库”两个入口，分别链接到 `/workspace/projects` 与 `/workspace/assets`，并对当前所在路由的入口进行视觉高亮。

#### Scenario: 从任意页面进入项目
- **WHEN** 用户在顶部导航点击“项目”
- **THEN** 页面跳转到 `/workspace/projects`

#### Scenario: 从任意页面进入资产库
- **WHEN** 用户在顶部导航点击“资产库”
- **THEN** 页面跳转到 `/workspace/assets`

#### Scenario: 当前入口高亮
- **WHEN** 用户当前路径位于 `/workspace/assets` 或其子路径
- **THEN** 顶部导航的“资产库”入口标记为当前项（`aria-current="page"`），“项目”入口不标记

## MODIFIED Requirements

### Requirement: 顶部导航项集合
顶部导航 SHALL 仅包含品牌标识、工作台入口（项目 / 资产库）与既有的“进入工作台”操作，不再包含“创作中枢”“平台能力”“端到端流程”锚点导航项。

### Requirement: 创作工作台布局
创作工作台 SHALL 使用全宽单栏主内容布局，不再渲染左侧边栏，也不再为侧边栏保留横向偏移；工作台内部不再重复提供“项目 / 资产库”导航。

## REMOVED Requirements

### Requirement: 顶部锚点导航（创作中枢 / 平台能力 / 端到端流程）
**Reason**: 仅为首页锚点跳转，价值低且与工作流脱节。
**Migration**: 首页各区块的 `id`（`brief` / `capabilities` / `pipeline`）与页面内 CTA（如 `#pipeline`）保持不变，仅移除顶部导航中的入口，不影响页面内容与页内跳转。

### Requirement: 工作台左侧边栏导航
**Reason**: 与顶部导航职责重复，占用横向空间。
**Migration**: “项目 / 资产库”入口迁移至顶部导航，路由地址保持不变。
