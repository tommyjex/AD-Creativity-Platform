# Tasks

- [x] Task 1: 建立统一的画布标题呈现判定。
  - [x] SubTask 1.1: 基于现有节点注册表分类识别 `modality`、`model` 和 `control`，避免在组件中重复维护文本、图片、视频、音频类型清单。
  - [x] SubTask 1.2: 为标题行拆分“可见标题”“临时重命名输入”和“节点操作”三种呈现条件。

- [x] Task 2: 调整模态节点画布布局。
  - [x] SubTask 2.1: 文本、图片、视频和音频节点常态不渲染标题文字。
  - [x] SubTask 2.2: 无标题栏操作且未重命名时移除固定标题行占位，让主体内容使用释放空间。
  - [x] SubTask 2.3: 下载、精准编辑等既有操作改为不依赖标题文字的紧凑操作区，保持可访问标签、禁用态和事件隔离。
  - [x] SubTask 2.4: 模态节点显式重命名时临时显示输入框，提交或取消后恢复无标题状态。

- [x] Task 3: 保护模型、控制和名称语义。
  - [x] SubTask 3.1: 确认所有 `model` 与 `control` 节点继续显示标题，并保留名称优先级、编号和原位重命名。
  - [x] SubTask 3.2: 确认 `custom_name`、`config.title`、配置栏、BBox 引用、结果来源、下载命名和可访问名称不受影响。
  - [x] SubTask 3.3: 确认节点持久化尺寸、端口位置、连线、运行投影、自动保存和后端契约不变。

- [x] Task 4: 补充组件回归测试。
  - [x] SubTask 4.1: 覆盖四类模态节点常态无标题、无空白标题占位及主体空间释放。
  - [x] SubTask 4.2: 覆盖模态节点下载、图片精准编辑和临时原位重命名。
  - [x] SubTask 4.3: 覆盖代表性模型节点与控制节点标题继续可见。
  - [x] SubTask 4.4: 覆盖可访问名称、名称持久化和既有标题相关行为无回归。

- [x] Task 5: 完成前端质量与多视口验收。
  - [x] SubTask 5.1: 运行相关 Vitest、完整 Vitest、TypeScript 和 ESLint。
  - [x] SubTask 5.2: 使用 Playwright 在桌面、平板和手机视口验证四类模态节点无标题，模型与控制节点保留标题。
  - [x] SubTask 5.3: 验证节点操作、媒体内容、文本内容、端口和重命名输入无重叠或溢出，且浏览器无新增错误。

# Task Dependencies

- Task 2 depends on Task 1.
- Task 3 depends on Task 1 and can be verified in parallel with Task 2.
- Task 4 depends on Tasks 2 and 3.
- Task 5 depends on Task 4.

- [x] Task 6: 收敛本次差异范围并重新验收。
  - [x] SubTask 6.1: 从本次变更中移除 `.next-acceptance/**`、`.next-home-gallery-acceptance/**` 等 Next 构建/缓存产物、自动生成的 `next-env.d.ts` 漂移，以及与本规格无关的 `debug-frontend-page-unavailable.md`。
  - [x] SubTask 6.2: 将 `frontend/eslint.config.mjs` 的 `.next*/**` 宽泛忽略改为仅覆盖仓库实际使用的已知 Next 构建目录，避免任意 `.next` 前缀目录绕过 ESLint。
  - [x] SubTask 6.3: 清理后重新检查 git diff，并重跑相关 Vitest、完整 Vitest、TypeScript、ESLint 与三视口 Playwright，确认功能证据仍全部通过且浏览器错误为 0。
