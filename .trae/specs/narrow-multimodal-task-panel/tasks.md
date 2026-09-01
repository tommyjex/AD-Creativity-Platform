# Tasks

- [x] Task 1: 调整全模态工作台宽屏栅格比例。
  - [x] SubTask 1.1: 将左侧主工作区与右侧生成任务栏调整为 `1.2fr` / `0.8fr`，保留任务栏最小宽度和既有断点。
  - [x] SubTask 1.2: 更新或补充组件测试，断言新的宽屏栅格类名。

- [x] Task 2: 验证布局未回归。
  - [x] SubTask 2.1: 运行相关 Vitest、lint 和 typecheck。
  - [x] SubTask 2.2: 使用浏览器确认宽屏下任务栏收窄、任务内容不溢出，窄屏下仍纵向排列。

# Task Dependencies

- Task 2 依赖 Task 1。
