# Tasks

- [x] Task 1: 为全模态生视频面板提供预览数据。
  - [x] SubTask 1.1: 从当前 `videoIds` 和工具资产列表解析第一个可播放参考视频。
  - [x] SubTask 1.2: 从当前全模态生视频任务及其输出资产解析第一个可播放生成结果视频。

- [x] Task 2: 实现并排对照播放器区域。
  - [x] SubTask 2.1: 在全模态参考生视频卡片页加入“参考视频”和“生成结果视频”双窗口区域，宽屏并排、窄屏纵向。
  - [x] SubTask 2.2: 复用或提炼现有 `VideoPreviewCard`，确保播放控件、放大预览与 `object-contain` 行为一致。
  - [x] SubTask 2.3: 为无参考视频、任务未提交、任务处理中、任务失败及无输出结果提供独立空状态。

- [x] Task 3: 补充回归测试。
  - [x] SubTask 3.1: 覆盖参考视频添加后显示左侧播放器、成功任务输出后显示右侧播放器、移除参考视频后回退空状态。
  - [x] SubTask 3.2: 覆盖无任务、处理中和失败任务的结果侧空状态。

- [x] Task 4: 验证交互与布局。
  - [x] SubTask 4.1: 运行相关 Vitest、lint 与 typecheck。
  - [x] SubTask 4.2: 使用浏览器确认并排布局、移动端纵向布局、播放器播放和放大预览不裁切视频。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 2。
- Task 4 依赖 Task 3。
