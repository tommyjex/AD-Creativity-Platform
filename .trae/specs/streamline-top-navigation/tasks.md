# Tasks

- [x] Task 1: 顶部导航改造：删除三个锚点导航项，改为“项目 / 资产库”工作台入口
  - [x] SubTask 1.1: 在 [app-shell.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/layout/app-shell.tsx) 中移除 `navItems`（创作中枢 / 平台能力 / 端到端流程）
  - [x] SubTask 1.2: 新增“项目”“资产库”两个链接项（`/workspace/projects`、`/workspace/assets`），保持现有导航胶囊样式
  - [x] SubTask 1.3: 使用 `usePathname` 对当前路由入口做高亮（`aria-current="page"`），组件需转为 client 组件（`"use client"`）
  - [x] SubTask 1.4: 保留品牌标识与“进入工作台”按钮不变

- [x] Task 2: 删除创作工作台左侧边栏并调整布局
  - [x] SubTask 2.1: 在 [workspace-navigation.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/workspace-navigation.tsx) 中移除桌面端 `aside` 侧边栏与移动端横向模块条（删除组件或改为不渲染导航）
  - [x] SubTask 2.2: 更新 [workspace/layout.tsx](file:///Users/bytedance/AD-Creativity/frontend/app/workspace/layout.tsx)，移除 `WorkspaceNavigation` 引用与 `lg:ml-64` 偏移，改为全宽主内容布局

- [x] Task 3: 同步测试
  - [x] SubTask 3.1: 更新 [workspace-navigation.test.tsx](file:///Users/bytedance/AD-Creativity/frontend/tests/workspace-navigation.test.tsx)，调整/移除依赖旧侧边栏的断言，改为验证顶部导航中的“项目 / 资产库”入口与高亮行为
  - [x] SubTask 3.2: 运行前端测试与类型检查（`npm test`、`npm run typecheck`、`npm run lint`）确保通过

# Task Dependencies
- Task 3 depends on Task 1 和 Task 2
