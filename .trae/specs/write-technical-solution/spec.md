# 广告创造力平台技术方案 Spec

## Why
上一个 PRD 已定义广告创造力平台从需求输入到广告视频成片的产品链路。本技术方案将 PRD 转化为可研发拆解的前后端架构、模型调用方案、异步任务流程、数据模型和验收边界。

## What Changes
- 新增广告创造力平台技术方案，覆盖 React + Next.js + Tailwind + shadcn/ui 前端、Python + FastAPI 后端。
- 明确 ModelArk 统一 SDK 接入方式，默认使用文本生成模型 `doubao-seed-evolving`、生图模型 `doubao-seedream-5-0-pro-260628`、生视频模型 `doubao-seedance-2-5-260628`。
- 明确故事生成、剧本拆分、分镜脚本、生图、生视频、剪辑成片的服务编排与异步状态流转。
- 明确用户上传图片、生成图片、分镜视频和最终成片的资产管理策略。
- 明确前端采用蓝白简洁的企业级创作控制台设计系统，并统一首页、项目详情、资产库和导出页。
- 不包含 **BREAKING** 变更。

## Impact
- Affected specs: `create-ad-video-prd` 中的需求输入、故事生成、剧本生成、分镜脚本、生图、生视频、剪辑成片、任务状态、资产管理。
- Affected code: 后续预计新增 Next.js 前端应用、FastAPI 后端服务、ModelArk SDK 适配层、任务编排模块、资产存储模块、视频剪辑模块、数据库模型和测试用例。

## 技术方案

### 1. 总体架构
系统采用前后端分离架构：

- 前端：React + Next.js + Tailwind CSS + shadcn/ui，负责广告需求输入、图片上传、创作流程展示、中间产物编辑、任务状态轮询、资产预览和成片导出。
- 后端：Python + FastAPI，负责业务 API、文件接收、任务编排、模型调用、资产落库、视频剪辑、失败重试和状态管理。
- 模型服务：通过 ModelArk Python SDK 统一调用文本生成、生图和生视频模型。
- 存储层：使用对象存储保存上传图片、生成图片、分镜视频和最终成片；使用关系型数据库保存项目、任务、阶段产物、分镜和资产元数据。
- 异步执行层：生图、生视频和剪辑任务通过后台任务队列执行，API 只负责创建任务、查询状态、提交重试和返回资产结果。

推荐的逻辑分层：

| 层级 | 职责 |
| --- | --- |
| Web UI | 表单、上传、预览、编辑、状态展示、导出入口 |
| API Layer | FastAPI 路由、鉴权、参数校验、响应格式 |
| Workflow Service | 广告项目状态机、阶段依赖、重试和版本管理 |
| Model Adapter | ModelArk SDK 客户端封装，屏蔽不同模型 API 细节 |
| Asset Service | 上传、下载、URL 转存、文件元数据、过期 URL 续存 |
| Video Service | 分镜视频合成、字幕/旁白/背景音乐处理、导出 |
| Persistence | 项目、brief、故事、剧本、分镜、任务、资产、错误记录 |

### 2. 前端技术方案
前端使用 Next.js App Router，并按功能域组织页面和组件。

#### 2.1 页面结构
- `/`：项目入口，展示创建广告视频项目的主工作台。
- `/projects/[projectId]`：项目详情页，展示从 brief 到成片的完整创作流程。
- `/projects/[projectId]/assets`：资产库页，展示上传图片、生成图片、分镜视频和成片。
- `/projects/[projectId]/export`：成片预览与导出页。

#### 2.2 核心组件
- `BriefForm`：文字需求输入、图片上传、目标平台、视频比例、时长和风格选择。
- `StageStepper`：展示 brief、故事、剧本、分镜、生图、生视频、剪辑各阶段状态。
- `EditableTextArtifact`：故事、剧本、分镜脚本文本编辑器。
- `StoryboardTable`：镜头编号、时长、画面、主体、场景、运镜、字幕、音效和状态。
- `AssetGrid`：角色图、商品图、场景图、分镜视频和最终视频预览。
- `TaskStatusPanel`：轮询展示排队、运行中、成功、失败、可重试状态。
- `VideoPreview`：分镜片段和最终成片播放。

#### 2.3 UI 设计系统
- 设计方向采用“企业级创作控制台”：浅蓝灰背景、白色内容面板、深蓝正文和单一品牌蓝操作色，强调专业、简洁和清晰。
- 基础色通过 CSS variables 管理：`background` 使用浅蓝灰，`card/popover` 使用白色，`foreground` 使用深蓝，`primary/ring` 使用品牌蓝，`border/input` 使用低对比蓝灰。
- 主按钮使用品牌蓝实心样式和轻量投影；次按钮使用白底蓝灰边框或浅蓝底；链接、焦点环和选中态统一使用品牌蓝。
- 卡片使用白底、细边框、适度圆角和轻量阴影，不使用厚重 backdrop blur；内容层级主要通过留白、字号、字重和边框建立。
- 页面背景允许使用低透明度蓝色光晕与稀疏网格作为轻量氛围层，但不得影响文本对比度或形成霓虹效果。
- 成功、警告、失败和信息状态保留独立语义色，用于任务状态和错误提示，不参与主品牌渐变。
- 首页、项目详情、资产库和导出页共享同一 `AppShell`、主题变量和基础组件样式，避免页面间视觉漂移。
- 明确禁止深色电影控制台、橙蓝双色渐变、霓虹高光、厚重玻璃拟态和高频扫描动画。
- 响应式布局以桌面创作流程为主，窄屏下表单、阶段状态、分镜表和媒体资产应重排为可滚动或单列结构。
- 交互元素应具备可见焦点态、足够文字对比度、禁用态和加载态，并遵守 `prefers-reduced-motion` 减少非必要动画。

#### 2.4 UI 与状态管理
- Tailwind 负责布局、间距、响应式和主题变量。
- shadcn/ui 负责表单、按钮、卡片、Tabs、Dialog、Table、Toast、Progress、Skeleton 等基础组件。
- 服务端权威状态保存在后端，Next.js Server Components 获取项目、阶段、资产和任务的首屏快照。
- 客户端状态按职责拆分：表单草稿使用 React Hook Form 管理；故事、剧本、分镜编辑使用组件本地 state 或 reducer 管理未保存变更；跨组件 UI 状态如当前阶段、选中镜头、打开的 Dialog 使用轻量 Zustand store 或 React Context 管理。
- 高频任务状态由客户端组件轮询后端 `/api/tasks/{taskId}`，成功后刷新项目详情和资产列表；失败时展示错误摘要、重试按钮和关联阶段。
- 表单提交、阶段保存、阶段生成和失败重试使用 Server Action 或客户端 `fetch`，以项目实际部署方式统一；所有写操作完成后以服务端返回结果覆盖客户端乐观状态。
- Toast 用于短反馈，`TaskStatusPanel` 和 `StageStepper` 用于长任务进度，Skeleton/Progress 用于排队和运行中状态。

### 3. 后端技术方案
后端使用 FastAPI 提供 REST API，核心目标是把用户输入转化为可追踪的创作工作流。

#### 3.1 模块划分
- `api/`：项目、生成阶段、任务、资产、导出相关路由。
- `schemas/`：Pydantic 请求/响应模型。
- `services/workflow.py`：阶段编排、状态机、版本依赖和重试。
- `services/modelark.py`：ModelArk SDK 统一客户端和模型适配器。
- `services/assets.py`：上传文件、生成资产、URL 转存和元数据管理。
- `services/video.py`：分镜视频合成、字幕与音频处理。
- `workers/`：后台任务执行入口。
- `repositories/`：数据库访问。

#### 3.2 API 草案
| Method | Path | 说明 |
| --- | --- | --- |
| `POST` | `/api/projects` | 创建广告视频项目，提交文字需求和图片 |
| `GET` | `/api/projects/{project_id}` | 获取项目详情、阶段状态和当前产物 |
| `POST` | `/api/projects/{project_id}/story` | 基于 brief 生成或重生成故事 |
| `PUT` | `/api/projects/{project_id}/story` | 保存用户编辑后的故事 |
| `POST` | `/api/projects/{project_id}/script` | 基于故事生成剧本 |
| `POST` | `/api/projects/{project_id}/storyboard` | 基于剧本生成分镜脚本 |
| `POST` | `/api/projects/{project_id}/images` | 根据分镜生成角色、广告主体和场景图 |
| `POST` | `/api/projects/{project_id}/videos` | 根据分镜脚本和图片资产生成分镜视频 |
| `POST` | `/api/projects/{project_id}/compose` | 将分镜视频剪辑为完整视频 |
| `GET` | `/api/tasks/{task_id}` | 查询异步任务状态和错误信息 |
| `POST` | `/api/tasks/{task_id}/retry` | 从失败阶段重试 |
| `GET` | `/api/projects/{project_id}/assets` | 查询项目资产 |

#### 3.3 数据模型草案
- `Project`：项目 ID、用户输入、目标平台、比例、时长、当前阶段、状态、创建时间。
- `Brief`：结构化商品/品牌、受众、卖点、风格、转化目标、引用图片。
- `TextArtifact`：故事、剧本、分镜脚本的内容、版本、来源阶段和编辑状态。
- `StoryboardShot`：镜头编号、时长、画面描述、主体、场景、运镜、台词/旁白、字幕、音效、转场、状态。
- `GenerationTask`：任务 ID、项目 ID、阶段、状态、模型、请求摘要、错误信息、重试次数、外部任务 ID。
- `Asset`：资产 ID、类型、URL、本地/对象存储 key、来源任务、关联镜头、过期时间、元数据。

#### 3.4 异步任务机制
- API 收到生成请求后只做权限、参数和阶段依赖校验，创建 `GenerationTask(status="queued")` 并返回 `task_id`。
- Worker 从任务队列读取任务，按阶段调用 `Workflow Service`、`ModelArkClient`、`Asset Service` 或 `Video Service`，并持续更新任务状态、进度、错误码和产物引用。
- 首版低并发场景可使用 FastAPI BackgroundTasks 或进程内轻量队列；生产环境使用 Celery/RQ/Arq + Redis，确保生图、生视频和剪辑任务可并发、可重试、可观测。
- 内部任务状态统一为 `queued`、`running`、`succeeded`、`failed`、`cancelled`、`expired`、`stale`；外部 ModelArk 生视频任务状态通过适配层映射到内部状态。
- 前端通过 `/api/tasks/{task_id}` 轮询任务状态；任务成功后再调用 `/api/projects/{project_id}` 和 `/api/projects/{project_id}/assets` 刷新阶段产物。
- 重试时复用原阶段输入和用户已保存版本，创建新的任务记录并保留旧任务错误详情；上游产物变更时，下游任务和资产标记为 `stale`，避免误用过期内容。

### 4. ModelArk SDK 接入方案

#### 4.1 SDK 安装与客户端
后端统一安装 ModelArk Python SDK：

```bash
pip install 'byteplus-python-sdk-v2[ark]'
```

基础环境变量：

```bash
ARK_API_KEY=<ModelArk API Key>
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_TEXT_MODEL=doubao-seed-evolving
ARK_IMAGE_MODEL=doubao-seedream-5-0-pro-260628
ARK_VIDEO_MODEL=doubao-seedance-2-5-260628
```

后端统一封装 `ModelArkClient`，集中处理：
- API Key 和 Base URL 初始化。
- 模型 ID 与 Endpoint ID 配置。
- 超时、重试、错误映射和日志脱敏。
- 生成请求与响应的结构化落库。
- 第三方 URL 过期前转存到自有对象存储。

#### 4.2 文本生成模型
默认文本生成模型：`doubao-seed-evolving`。

适用阶段：
- 图文 brief 解析。
- 广告故事生成。
- 故事拆分剧本。
- 剧本生成分镜脚本。
- 分镜提示词和生图/生视频 prompt 结构化。

调用方式：
- 纯文本输入优先使用 Chat Completions：`client.chat.completions.create(model=..., messages=[...])`。
- 包含图片输入时使用 Responses API 的多模态输入形式：`input_image` + `input_text`；后端接口接收项目资产 ID，校验为本项目成功图片资产后转换为 TOS 短期签名 URL 传给模型。
- 所有文本阶段要求输出 JSON，后端用 Pydantic 校验；校验失败时追加格式修复提示词重试。

输出约束：
- brief 输出结构化字段。
- 故事输出包含背景、冲突/需求、卖点解决方案、行动号召。
- 剧本输出包含场次、画面、动作、台词/旁白、商品露出、节奏说明。
- 分镜输出包含镜头编号、时长、画面、主体、场景、运镜、字幕、音效、转场建议。

#### 4.3 生图模型
默认生图模型：`doubao-seedream-5-0-pro-260628`。

适用阶段：
- 角色形象图。
- 广告主体/商品/品牌呈现图。
- 场景图。
- 必要时基于参考图做局部编辑或主体替换。

调用方式：
- 使用 Image Generation API：`client.images.generate(...)`。
- 文生图传入 `model`、`prompt`、`size`、`output_format`、`response_format`、`watermark`。
- 图生图或多参考图传入 `image`，参考图使用可访问 URL 或符合限制的 Base64。
- Seedream 5.0 pro 支持 `1K`、`2K` 分辨率档位，输出格式使用 `png` 或 `jpeg`，平台默认 `png`。
- 精确编辑场景使用 `<point>x y</point>` 或 `<bbox>x1 y1 x2 y2</bbox>` 坐标标记；前端将用户选区归一化到 `[0,999]` 坐标系后写入 prompt。

输出处理：
- 生图接口返回 URL 或 Base64；系统默认请求 URL 并立即转存到自有对象存储。
- 每张图记录模型、prompt、输入参考图、镜头关联关系和一致性描述。

#### 4.4 生视频模型
默认生视频模型：`doubao-seedance-2-5-260628`。

适用阶段：
- 基于单个分镜脚本生成镜头视频。
- 基于角色图、商品图、场景图作为参考进行图生视频。
- 必要时支持首帧/尾帧、参考视频、参考音频等多模态参考能力。

调用方式：
- 使用 ModelArk Video Generation API 的异步任务模式。
- 创建任务：`client.content_generation.tasks.create(...)` 或等价 REST `POST /contents/generations/tasks`。
- 查询任务：`client.content_generation.tasks.get(task_id)` 或等价 REST `GET /contents/generations/tasks/{id}`。
- 后端轮询外部任务状态，映射为内部状态：`queued`、`running`、`succeeded`、`failed`、`cancelled`、`expired`。
- 成功后读取 `content.video_url`；如请求返回 `last_frame_url`，也保存尾帧资产。

建议参数：
- `model="doubao-seedance-2-5-260628"`。
- `content` 包含分镜文本 prompt 和相关图片 URL。
- `ratio` 根据项目目标平台设置：竖版短视频默认 `9:16`，横版默认 `16:9`，未指定时使用 `adaptive`。
- `duration` 来自分镜时长，单镜头默认 5 秒，可按模型限制裁剪。
- `watermark=false`，除非业务要求保留 AI 水印。

约束与风险：
- 生视频为长耗时任务，必须后台执行并轮询状态。
- 外部视频 URL 通常有有效期，生成成功后应立即转存。
- 用户未提供生视频参考文档链接，本方案依据 ModelArk Video Generation API 的通用异步创建/查询模式设计；实际研发时需以 `doubao-seedance-2-5-260628` 控制台和最新 API 文档为准核对参数上限。

### 5. 创作工作流
平台以 `Project` 为中心驱动状态机：

1. `brief_ready`：用户提交文字/图片，后端生成结构化 brief。
2. `story_ready`：文本模型生成故事，用户可编辑。
3. `script_ready`：文本模型拆分剧本，用户可编辑。
4. `storyboard_ready`：文本模型生成分镜脚本，用户可编辑镜头。
5. `images_ready`：生图模型生成角色、主体和场景图。
6. `shot_videos_ready`：生视频模型为分镜生成视频片段。
7. `final_video_ready`：视频服务剪辑成完整广告视频。

每个阶段都有独立任务记录。用户编辑上游产物时，下游依赖产物标记为 `stale`，需要重新生成。

端到端数据流如下：

| 阶段 | 输入 | 后端处理 | 输出 |
| --- | --- | --- | --- |
| Brief | 用户文字需求、上传图片、平台/比例/时长/风格 | 保存项目和上传资产，调用文本模型解析结构化 brief | `Brief`、引用图片 `Asset` |
| 故事 | `Brief`、引用图片摘要 | 调用 `doubao-seed-evolving` 生成广告故事并校验 JSON | `TextArtifact(type="story")` |
| 剧本 | 已确认故事 | 调用文本模型拆分场次、画面、动作、台词和节奏 | `TextArtifact(type="script")` |
| 分镜 | 已确认剧本 | 调用文本模型生成镜头表和生图/生视频 prompt 基础字段 | `TextArtifact(type="storyboard")`、多条 `StoryboardShot` |
| 生图 | 分镜主体、场景、商品、参考图 | 调用 `doubao-seedream-5-0-pro-260628` 生成角色、主体和场景图，并转存 URL | `Asset(type="image")`，关联项目和镜头 |
| 生视频 | 分镜 prompt、镜头时长、比例、图片资产 | 调用 `doubao-seedance-2-5-260628` 创建异步视频任务，轮询并转存结果 | `Asset(type="shot_video")`，关联 `StoryboardShot` |
| 剪辑成片 | 全部分镜视频、字幕、音频、转场配置 | `Video Service` 按镜头顺序拼接、加字幕/音频/基础转场并导出 MP4 | `Asset(type="final_video")`、项目进入 `final_video_ready` |

### 6. 视频剪辑方案
剪辑阶段由后端 `Video Service` 处理：
- 按分镜顺序读取视频片段。
- 使用 FFmpeg 或等价媒体处理库完成拼接。
- 根据分镜字幕生成字幕轨或硬字幕。
- 可选添加背景音乐、旁白音频、音量归一化和转场。
- 输出统一格式 MP4，默认 H.264 + AAC。
- 生成成片后转存对象存储，并写入 `Asset(type="final_video")`。

首版实现保持剪辑能力克制：只做顺序拼接、基础转场、字幕和背景音乐，不做复杂非线性编辑。首版不支持多轨时间线、关键帧动画、复杂调色、自动口型对齐、精细音频混音、人工逐帧修片和模板市场；这些能力作为后续版本扩展，不进入首版验收范围。

### 7. 错误处理与重试
- 所有模型调用、资产处理和剪辑错误映射为统一错误码：鉴权失败、参数错误、限流、内容安全、模型任务失败、外部 URL 失效、超时、文件校验失败、剪辑失败。
- 失败任务保留输入版本、请求摘要、错误码、错误详情、重试次数和关联阶段，用户可从失败阶段重试；日志中不保存完整敏感原文和密钥。
- 对文本 JSON 解析失败执行一次格式修复重试；仍失败时任务进入 `failed`，前端提示用户检查输入或手动编辑文本产物。
- 对生图/生视频限流、超时和临时网络错误执行指数退避重试，并设置最大重试次数；内容安全、鉴权失败、上传文件校验失败等不可自动恢复错误不自动重试，只允许用户修改输入后重新提交。
- 对视频 URL 过期问题优先从外部任务重新拉取并转存；无法拉取时提示重新生成。
- 重试接口必须具备幂等保护，避免用户连续点击造成重复任务；同一阶段存在 `queued` 或 `running` 任务时，后端返回当前任务而不是创建新任务。
- 任务状态对用户可见：`queued` 显示排队中和预估提示，`running` 显示当前阶段和进度，`succeeded` 提供结果预览和下一步入口，`failed` 显示可理解原因、失败阶段和重试/修改入口，`stale` 提示上游已变更需重新生成。
- 前端通过 Toast 反馈短操作结果，通过 `TaskStatusPanel` 展示长任务状态、错误摘要、重试按钮和关联产物；任务失败不阻断用户查看已有成功产物。

### 8. 安全与合规
- `ARK_API_KEY` 只存在后端环境变量或密钥管理服务，不下发到前端，不写入构建产物、客户端日志、数据库明文字段或错误响应。
- 后端 ModelArk 适配层统一注入 API Key，所有模型请求从后端发起；前端只能访问平台业务 API 和短期有效的资产访问 URL。
- 上传文件做 MIME、大小、后缀、图片解码和基础内容校验；首版仅允许必要的图片格式，拒绝可执行文件、超大文件、损坏文件和伪装后缀文件。
- 上传和生成资产保存所有者、项目、来源类型、来源任务、原始文件名、文件哈希、模型、prompt 摘要、关联镜头和创建时间，支持后续素材审计和问题追溯。
- 生成请求和结果记录需要脱敏，避免日志输出用户敏感数据、完整 prompt 中的隐私信息、完整外部 URL 和完整 API Key。
- 对品牌、商品、人物肖像和用户上传参考素材保留来源记录；涉及第三方素材时在审计字段中标记用户上传来源，后续可接入授权声明或人工审核。
- 若模型返回内容安全拦截，前端展示可理解错误并允许用户修改输入后重试；不得展示供应商原始敏感策略细节。
- 对象存储默认使用私有桶，业务 API 生成短期签名 URL；资产删除、过期和访问权限以后端权限校验为准。

### 9. 测试策略
- 后端单元测试：Pydantic schema、状态机、任务重试、错误映射、prompt 输出解析。
- 后端集成测试：使用 Mock ModelArk Client 覆盖故事、剧本、分镜、生图、生视频、剪辑流程。
- 前端组件测试：BriefForm、StageStepper、StoryboardTable、TaskStatusPanel、AssetGrid。
- E2E 测试：创建项目、上传图片、生成故事、编辑分镜、触发任务、查看成片状态。
- 媒体处理测试：使用短视频样例验证拼接、字幕和导出格式。
- 安全与边界测试：覆盖 API Key 不出现在前端响应和日志、非法文件上传被拒绝、内容安全拦截可见反馈、重复重试不会创建重复任务。
- 任务状态测试：覆盖 `queued`、`running`、`succeeded`、`failed`、`cancelled`、`expired`、`stale` 的状态映射、轮询刷新和用户操作入口。
- 部署验证：开发、测试、生产环境至少验证环境变量、数据库迁移、对象存储读写、队列/Worker 启动、FFmpeg 可用性和健康检查接口。

### 10. 部署与配置
- 前端：Next.js 部署为 Node 服务或平台托管应用。
- 后端：FastAPI 使用 Uvicorn/Gunicorn 运行。
- 后台任务：首版可使用 FastAPI BackgroundTasks 或轻量任务队列；生产建议使用 Celery/RQ/Arq + Redis。
- 数据库：PostgreSQL。
- 对象存储：BytePlus TOS 或兼容 S3 的对象存储。
- 配置统一通过环境变量注入，区分开发、测试和生产环境。
- 必要配置包括 `ARK_API_KEY`、`ARK_BASE_URL`、文本/生图/生视频模型 ID、数据库连接、Redis/队列连接、对象存储 bucket 和凭证、签名 URL 过期时间、上传大小上限、任务超时和最大重试次数。
- 后端服务、Worker 和剪辑服务共享同一套配置规范，但按部署角色拆分进程；生产环境需配置健康检查、结构化日志、任务指标和错误告警。
- FFmpeg 或等价媒体处理依赖必须在部署镜像中固定版本，避免不同环境输出格式不一致。

## ADDED Requirements

### Requirement: 前后端技术架构
The system SHALL 使用 React + Next.js + Tailwind + shadcn/ui 构建前端，使用 Python + FastAPI 构建后端。

#### Scenario: 技术栈明确
- **WHEN** 研发阅读技术方案
- **THEN** 应能明确前端、后端、模型服务、存储层和异步任务层的职责边界

### Requirement: 蓝白简洁设计系统
The system SHALL 使用 Tailwind 主题变量和 shadcn/ui 基础组件实现统一的蓝白简洁企业级创作控制台。

#### Scenario: 应用主题变量
- **WHEN** 前端渲染首页、项目详情、资产库或导出页
- **THEN** 页面应统一使用浅蓝灰背景、白色面板、深蓝文字、品牌蓝主操作和蓝灰边框

#### Scenario: 复用基础组件
- **WHEN** 前端新增表单、按钮、卡片、徽章、状态面板或加载骨架
- **THEN** 组件应复用统一主题和 shadcn/ui 风格基础组件，不应在业务页面重复定义冲突色值

#### Scenario: 控制视觉复杂度
- **WHEN** 页面展示复杂创作流程和大量资产
- **THEN** 界面应通过留白、字号、边框和轻量阴影建立层级，不应使用深色霓虹、橙蓝双色渐变、厚重玻璃拟态或高频装饰动画

### Requirement: ModelArk 统一 SDK 接入
The system SHALL 通过 ModelArk Python SDK 统一接入文本生成、生图和生视频能力。

#### Scenario: SDK 安装方式明确
- **WHEN** 后端开发准备模型调用环境
- **THEN** 技术方案应提供 `pip install 'byteplus-python-sdk-v2[ark]'` 安装方式和必要环境变量

### Requirement: 文本生成方案
The system SHALL 使用 `doubao-seed-evolving` 支撑 brief 解析、故事生成、剧本拆分和分镜脚本生成。

#### Scenario: 文本阶段输出可校验
- **WHEN** 文本模型返回结果
- **THEN** 后端应使用结构化 JSON 和 Pydantic schema 校验输出，失败时允许格式修复重试

### Requirement: 生图方案
The system SHALL 使用 `doubao-seedream-5-0-pro-260628` 生成角色形象、广告主体和场景图。

#### Scenario: 图片资产生成并保存
- **WHEN** 生图任务成功
- **THEN** 系统应保存生成图片 URL 或转存后的对象存储地址，并关联项目、镜头和 prompt 元数据

### Requirement: 生视频方案
The system SHALL 使用 `doubao-seedance-2-5-260628` 按异步任务模式生成分镜视频。

#### Scenario: 生视频异步轮询
- **WHEN** 后端创建生视频任务
- **THEN** 系统应保存外部任务 ID，轮询任务状态，并在成功后转存 `content.video_url`

### Requirement: 剪辑合成方案
The system SHALL 将多个分镜视频按顺序剪辑为完整 MP4 成片。

#### Scenario: 成片生成
- **WHEN** 必要分镜视频均生成成功
- **THEN** 视频服务应拼接片段、应用基础字幕/音频/转场，并输出最终视频资产

### Requirement: 任务状态与重试
The system SHALL 为每个生成阶段提供内部任务状态、错误信息和重试入口。

#### Scenario: 失败后重试
- **WHEN** 任一模型调用或剪辑任务失败
- **THEN** 用户应能看到失败阶段、原因摘要，并从失败阶段重试

## MODIFIED Requirements

### Requirement: PRD 技术落地
广告视频生成 PRD 中的需求输入、故事、剧本、分镜、生图、生视频和剪辑成片链路 SHALL 由本技术方案定义的前端工作台、FastAPI 后端、ModelArk 适配层、异步任务和资产服务承接。

## REMOVED Requirements

### Requirement: 旧技术方案
**Reason**: 当前项目无既有技术方案需要移除。
**Migration**: 无需迁移。
