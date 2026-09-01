# Checklist

- [x] “创作提示词”标题行右上角显示五角星优化按钮，具备可访问名称
- [x] 提示词为空或全空白时优化按钮禁用，且不发起请求
- [x] 优化进行中优化按钮禁用并展示 loading，生成按钮同时被禁用（互斥，无并发提交）
- [x] `POST /api/tools/videos/optimize-prompt` 接口存在，返回 `{ "optimized_prompt": string }`
- [x] 空白 `prompt` 请求返回 `422 validation_error` 且不调用模型
- [x] 优化系统指令包含：修改范围、时间戳部分编辑、A→B 过程、标准素材编号约束、仅输出 JSON
- [x] 后端在返回前清理 Markdown 代码围栏与首尾空白，并校验非空及 12000 字符上限
- [x] 模型输出非法/失败时返回脱敏错误，不返回残缺结果
- [x] 优化成功仅替换前端“创作提示词”文本，不创建 ToolTask、不触发视频生成
- [x] 优化失败保留原草稿并在反馈区域显示脱敏错误
- [x] 后端 pytest 在 `.venv` 下通过
- [x] 前端 `tests/tools-workspace.test.tsx` 覆盖新交互并通过，`npm run lint` 通过
