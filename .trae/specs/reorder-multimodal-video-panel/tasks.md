# Tasks

- [x] Task 1: 调整默认值与面板区域顺序: 在 `frontend/components/workspace/tools-workspace.tsx` 的 `VideoGenerationPanel` 中修改默认值并重排渲染顺序。
  - [x] SubTask 1.1: 将 `duration` 初始 state 由 `"4"` 改为 `"-1"`。
  - [x] SubTask 1.2: 将 `aspectRatio` 初始 state 由 `"16:9"` 改为 `"adaptive"`。
  - [x] SubTask 1.3: 在 `CardContent` 中将参数选择行（模型/分辨率/时长/画幅）与参考素材上传行（参考图/参考视频/参考音频）移动到“创作提示词”区块之上，最终顺序为：参数行 → 参考素材行 → 创作提示词，保持各控件属性与逻辑不变。
- [x] Task 2: 更新前端测试: 同步 `frontend/tests/tools-workspace.test.tsx` 中的断言。
  - [x] SubTask 2.1: 将默认值断言由时长 `4`、画幅 `16:9` 更新为时长 `-1`、画幅 `adaptive`。
  - [x] SubTask 2.2: 校验提交默认值相关用例在未显式修改时长/画幅时仍通过（如涉及则更新预期为 `duration_seconds: -1`、`aspect_ratio: "adaptive"`）。
- [x] Task 3: 验证: 运行前端 lint 与相关测试，确认结构与默认值符合 spec。
  - [x] SubTask 3.1: 在 `frontend` 下执行 `npm run lint`。
  - [x] SubTask 3.2: 在 `frontend` 下执行 `npm test`（vitest）覆盖 tools-workspace 用例。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1, Task 2
