# Tasks

- [x] Task 1: 重构参考素材选择器为“输入 + 下方列表”交互。
  - [x] SubTask 1.1: 调整 `AssetPicker`，将上传/资产库选择入口与已选素材列表分离，使三种模态每次上传或选择的素材都以独立条目展示在输入控件下方。
  - [x] SubTask 1.2: 为每个已选素材条目提供独立删除控件，删除仅同步移除当前配置中的引用，不触发资产或对象文件删除。
  - [x] SubTask 1.3: 保留原有上传、从资产库选择、名称展示与兼容资产过滤能力，确保 `imageIds`/`videoIds`/`audioIds` 与提交请求映射不变。

- [x] Task 2: 将“生成参考视频”按钮移动至卡片右上角。
  - [x] SubTask 2.1: 调整 `VideoGenerationPanel` 卡片布局，将主操作按钮从 `CardContent` 底部移动到 `CardHeader` 右上角空白处。
  - [x] SubTask 2.2: 保留按钮的禁用条件（提示词为空或时长非法）、加载态与提交逻辑。

- [x] Task 3: 验证交互调整。
  - [x] SubTask 3.1: 更新/补充前端单元测试，覆盖上传后条目展示、从资产库选择后条目展示、逐项删除与按钮右上角提交。
  - [x] SubTask 3.2: 在前端运行相关 Vitest、lint 与 typecheck。
  - [x] SubTask 3.3: 使用浏览器验证三种模态素材上传/选择后在下方展示、逐项删除以及右上角按钮提交。

# Task Dependencies

- Task 1 与 Task 2 可并行。
- Task 3 依赖 Task 1 和 Task 2。
