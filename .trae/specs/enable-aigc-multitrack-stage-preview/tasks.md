# Tasks

- [x] Task 1: 扩展时间线素材预览数据
  - [x] 为 `AigcTimelineSource` 增加可选的安全预览 URL 和素材元数据
  - [x] 让 Loader 并行读取视频与图片资产，并保留现有视频时长解析
  - [x] 补充图片、视频、缺失资产和加载失败测试

- [x] Task 2: 实现可交互预览舞台
  - [x] 按播放头、轨道可见性和轨道顺序计算当前可见视觉元素
  - [x] 实现暂停静音的视频当前帧定位与素材失败占位
  - [x] 使用画布坐标和 `object-contain` 渲染文字、图片
  - [x] 实现文字/图片选择、拖拽、中心线/边缘吸附
  - [x] 实现四角等比缩放与对齐参考线

- [x] Task 3: 接通编辑器状态与原子历史
  - [x] 将时间线选中状态传入预览舞台
  - [x] 将舞台选择同步回时间线和属性检查器
  - [x] 在手势结束时一次性提交 Transform，确保一次撤销可恢复

- [x] Task 4: 完成回归与浏览器验收
  - [x] 补齐舞台寻帧、选择、拖拽、缩放、隐藏轨道和不可用素材组件测试
  - [x] 运行相关 Vitest、TypeScript、ESLint 和 production build
  - [x] 使用 Playwright 验证桌面与移动视口，确认无重叠、无裁切和无真实 Provider 调用

# Task Dependencies

- Task 2 depends on Task 1.
- Task 3 depends on Task 2.
- Task 4 depends on Tasks 1-3.
