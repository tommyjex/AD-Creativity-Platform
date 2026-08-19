# Tasks

- [x] Task 1: 定义 AI 提示词优化请求、响应和模型适配契约。
  - [x] SubTask 1.1: 在 `backend/app/schemas/storyboard.py` 新增优化 API 请求/响应 schema，支持可空草稿和 12000 字符限制。
  - [x] SubTask 1.2: 在 `backend/app/services/modelark.py` 新增视频提示词优化请求、结构化响应和 adapter 协议方法。
  - [x] SubTask 1.3: 为真实 ModelArk adapter 实现同步 JSON 文本优化调用，为 mock adapter 实现确定性优化结果。

- [x] Task 2: 实现后端优化上下文、提示词规则和输出校验。
  - [x] SubTask 2.1: 在生成服务中基于项目 brief、当前分镜、合并原子快照、当前草稿及参考素材编号构建安全优化上下文。
  - [x] SubTask 2.2: 编写优化 system/user 指令，限制为结构增强，不得改动剧情、台词含义、时长、原子区间、镜头顺序或参考关系。
  - [x] SubTask 2.3: 复用并扩展 `backend/app/video_prompt.py` 校验固定章节、单/合并分镜时间轴、总时长和 12000 字符上限。
  - [x] SubTask 2.4: 对非法、空、超长或时间轴错误的模型输出返回脱敏生成错误，不产生持久化副作用。

- [x] Task 3: 新增同步 AI 优化 API。
  - [x] SubTask 3.1: 在 `backend/app/api/routes.py` 新增 `POST /projects/{project_id}/storyboard/shots/{shot_id}/optimize-video-prompt`。
  - [x] SubTask 3.2: 后端从仓库读取项目、分镜和配置；草稿为空时使用 `effective_video_prompt`，不信任客户端上下文。
  - [x] SubTask 3.3: API 成功仅返回 `optimized_prompt`，不得保存配置、创建任务、触发视频生成或标记下游 stale。
  - [x] SubTask 3.4: 处理项目/分镜不存在、模型失败和输出校验失败，保持现有错误脱敏规范。

- [x] Task 4: 接入前端类型、API client 和 AI 优化交互。
  - [x] SubTask 4.1: 在 `frontend/lib/api-types.ts` 新增优化请求/响应类型。
  - [x] SubTask 4.2: 在 `frontend/lib/api-client.ts` 新增 `optimizeStoryboardShotVideoPrompt(projectId, shotId, videoPrompt)`。
  - [x] SubTask 4.3: 在 `storyboard-video-workspace.tsx` 实现 `pendingAction="optimize:{shotId}"`、过期响应保护、成功替换草稿和失败保留原草稿。
  - [x] SubTask 4.4: 在 `storyboard-shot-editor-dialog.tsx` 的提示词标题旁增加“AI 优化”按钮，优化中显示 loading，其他操作进行中时禁用。
  - [x] SubTask 4.5: 优化成功不修改 `savedPrompt`，复用现有未保存关闭确认和显式保存流程。

- [x] Task 5: 添加后端自动化测试。
  - [x] SubTask 5.1: 测试真实/mock adapter 的请求上下文和结构化响应解析。
  - [x] SubTask 5.2: 测试普通分镜优化保留剧情、时长、唯一时间区间及语音字幕规则。
  - [x] SubTask 5.3: 测试合并分镜优化保留全部原子区间、顺序和边界。
  - [x] SubTask 5.4: 测试空草稿回退默认提示词、参考素材标准编号和敏感 URL/凭据不进入上下文。
  - [x] SubTask 5.5: 测试模型非法输出、超长、缺少章节或错误时间轴时 API 失败且分镜数据与下游状态不变。

- [x] Task 6: 添加前端自动化测试并完成验证。
  - [x] SubTask 6.1: API client 测试覆盖优化接口 URL、POST 方法、草稿和空草稿请求体。
  - [x] SubTask 6.2: 组件测试覆盖按钮展示、优化 loading、成功替换草稿但不自动保存、关闭未保存确认和失败保留原草稿。
  - [x] SubTask 6.3: 组件测试覆盖分镜切换或弹窗关闭后的过期响应不覆盖当前草稿。
  - [x] SubTask 6.4: 使用项目根目录 `.venv` 运行后端全量测试。
  - [x] SubTask 6.5: 运行前端 Vitest、TypeScript 类型检查和本地优化流程 smoke test。

# Task Dependencies

- Task 2 depends on Task 1。
- Task 3 depends on Task 1 and Task 2。
- Task 4 depends on Task 3。
- Task 5 depends on Task 1、Task 2 and Task 3。
- Task 6 depends on Task 4 and Task 5。
