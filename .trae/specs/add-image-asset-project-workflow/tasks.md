# Tasks

- [x] Task 1: 扩展项目类型与图片 Brief 数据契约。
  - [x] SubTask 1.1: 定义 `ProjectType(video_ad/image_asset)` 和 `ImagePurpose(ecommerce_main/poster)`，旧请求默认 `video_ad`。
  - [x] SubTask 1.2: 扩展 Project/Brief schema、前端类型和字段矩阵校验；项目类型创建后不可变，图片用途唯一存于 Brief，图片项目拒绝视频时长。
  - [x] SubTask 1.3: 为项目表和 Brief 表增加兼容迁移，历史项目幂等回填为 `video_ad`。
  - [x] SubTask 1.4: 定义内容/电商平台稳定值和历史非空自定义值兼容策略，更新内存与 SQLAlchemy 仓储映射。
  - [x] SubTask 1.5: 添加 schema、迁移和双仓储契约测试。

- [x] Task 2: 改造项目创建、列表和类型路由。
  - [x] SubTask 2.1: 新建项目表单增加项目类型分段选择，图片项目增加电商主图/海报用途选择并隐藏视频时长。
  - [x] SubTask 2.2: 项目列表和详情摘要显示广告视频、电商主图或海报标签。
  - [x] SubTask 2.3: 根据项目类型进入视频工作台或图片工作台，图片项目不渲染六阶段视频流程。
  - [x] SubTask 2.4: 保持关键词搜索、软删除、加载和错误状态对两类项目一致。
  - [x] SubTask 2.5: 添加项目创建、编辑、列表标签和路由前端测试。

- [x] Task 3: 实现图片提示词保存与图片工作台基础界面。
  - [x] SubTask 3.1: 新增不可变 `ImagePromptVersion`，以及项目当前版本指针、image_prompt_status、current_image_asset_id 和 image_revision。
  - [x] SubTask 3.2: 新增图片工作台，包含 Brief 摘要、提示词编辑器、分辨率/格式控件、生成操作和任务状态。
  - [x] SubTask 3.3: 对中文 300 字、英文 600 词官方建议提供计数与警告，超出后允许用户确认保存。
  - [x] SubTask 3.4: 枚举内容相关 Brief 字段，实际变化时使用现有 Status.STALE 标记项目 image_prompt_status；不可变版本不改写，下游传播在图片资产链路完成后接入。
  - [x] SubTask 3.5: 添加提示词版本、表单交互和精准失效测试。

- [x] Task 4: 扩展 Seedream 5.0 Pro 文生图与图生图适配层。
  - [x] SubTask 4.1: 新增图片项目文生图、图生图请求/响应模型与四类操作参数矩阵，限制 Seedream 5.0 Pro 的尺寸、格式和单图输出参数。
  - [x] SubTask 4.2: 实现真实适配器调用与 mock 适配器确定性输出，使用 `response_format=url`、`watermark=false`、非流式。
  - [x] SubTask 4.3: 实现生成服务、后台任务、规范化输入哈希、返回现有运行任务的去重行为；重试复制原任务冻结输入和哈希并记录 retry_of_task_id。
  - [x] SubTask 4.4: 新增非空 asset_role 及历史 public 回填迁移；下载远程结果、校验内容、上传 TOS，并创建 public 不可变图片资产。
  - [x] SubTask 4.5: Brief 变化时将派生 public 图片的现有 Asset.status 更新为 STALE；历史仍可预览但不可设为当前，无需 freshness 迁移。
  - [x] SubTask 4.6: 添加真实请求参数、任务快照竞态、去重/重试、mock、失败回滚和存储测试。

- [x] Task 5: 实现图片生成与版本选择交互。
  - [x] SubTask 5.1: 在图片工作台接入文生图 API、任务轮询、成功刷新、失败重试和生成中禁用状态。
  - [x] SubTask 5.2: 以高密度响应式网格展示所有成功图片版本，支持预览、下载和设为当前成品。
  - [x] SubTask 5.3: 展示操作类型、来源版本、提示词摘要、尺寸、格式和创建时间。
  - [x] SubTask 5.4: 使用项目 `image_revision` 乐观锁更新当前成品。
  - [x] SubTask 5.5: 添加生成、轮询、并发版本选择和错误恢复前端测试。

- [x] Task 6: 实现整图与坐标交互编辑。
  - [x] SubTask 6.1: 新增图片编辑弹窗/工作区，支持普通图生图提示词和源图片预览。
  - [x] SubTask 6.2: 实现点选与框选工具，基于图片实际内容区执行 round/clamp 后转换为单图 0–999 归一化结构化数据。
  - [x] SubTask 6.3: 后端校验 point/bbox 范围与顺序并组装规范 `<point>` / `<bbox>` Prompt，拒绝用户文本中的原始坐标标签。
  - [x] SubTask 6.4: 编辑成功创建新图片版本，失败不覆盖当前成品。
  - [x] SubTask 6.5: 添加坐标换算、Prompt 组装、API、任务与响应式交互测试。

- [x] Task 7: 实现图层拆分领域模型与 Seedream 调用。
  - [x] SubTask 7.1: 新增图层集合与图层 schema/数据库表，保存源图、底图、图层资产、边界框、顺序、可见性、变换和 revision。
  - [x] SubTask 7.2: 实现兼容迁移和内存/SQLAlchemy 仓储原子创建、读取与更新契约。
  - [x] SubTask 7.3: 扩展 ModelArk 适配器调用 `layer_decomposition=true`，限制单张 PNG/JPEG、30MB、像素、比例、尺寸档位和不兼容参数。
  - [x] SubTask 7.4: 原子下载并转存底图与最多 16 个透明 PNG 图层，以响应 z_index 为准校验唯一连续顺序和右/下排他 bbox DTO；对象写最终私有键，使用 internal_base/internal_layer 角色并在 DB 失败时补偿删除。
  - [x] SubTask 7.5: 新增图层拆分任务/API，支持自动拆分、自然语言和结构化 bbox 指定拆分。
  - [x] SubTask 7.6: 添加接口参数、响应解析、数量上限、原子回滚和双仓储测试。

- [x] Task 8: 实现图层编辑器与状态持久化。
  - [x] SubTask 8.1: 新增保持底图比例的全屏/宽屏图层画布，按绝对边界框和 `z_index` 还原初始构图。
  - [x] SubTask 8.2: 实现图层选择、显隐、基于底图像素的左上角移动、0.05-20 等比缩放和上移/下移；底图保持锁定，首期不提供删除/旋转/裁剪/调色。
  - [x] SubTask 8.3: 使用集合 revision 乐观锁实现图层状态保存、409 冲突处理和刷新恢复。
  - [x] SubTask 8.4: 移动端将图层面板收纳为抽屉或折叠区域，避免画布与工具栏重叠。
  - [x] SubTask 8.5: 添加画布几何、图层操作、持久化、冲突和响应式测试。

- [x] Task 9: 实现图层合成与资产库归档。
  - [x] SubTask 9.1: 新增服务端 PNG 图层合成服务，只接受已保存的集合 revision，按底图坐标、变换、可见性和顺序生成成品。
  - [x] SubTask 9.2: 将合成结果上传 TOS、创建新图片版本并支持设为当前成品。
  - [x] SubTask 9.3: 扩展资产库展示 public 图片成品；普通资产列表、搜索、详情和内容接口拒绝 internal_base/internal_layer，图层集合接口按所属项目提供临时访问 URL。
  - [x] SubTask 9.4: 图片项目软删除后，项目资产、图层集合和对象存储文件继续保留但前端不可见。
  - [x] SubTask 9.5: 添加合成像素、失败保护、资产筛选、详情元数据和软删除测试。

- [x] Task 10: 完成全量与真实链路验证。
  - [x] SubTask 10.1: 使用项目根目录 `.venv` 运行后端全量测试，并验证迁移幂等。
  - [x] SubTask 10.2: 运行前端全量测试、TypeScript、ESLint 和构建。
  - [x] SubTask 10.3: 浏览器验证视频项目无回归，以及图片项目创建、提示词、生成、图片编辑、图层编辑和资产库归档。
  - [x] SubTask 10.4: 使用真实 Seedream 5.0 Pro 执行文生图、图生图、point/bbox 交互编辑和图层拆分 smoke test。
  - [x] SubTask 10.5: 验证桌面与移动视口无溢出、重叠、不可达控件或空白画布。

- [x] Task 11: 修复独立验收发现的数据完整性缺口。
  - [x] SubTask 11.1: 在内存与 SQLAlchemy 仓储层拒绝修改 `project_type`，并按加列、回填、非空约束顺序完善 SQLite/MySQL 迁移与测试。
  - [x] SubTask 11.2: Brief 变化时沿 `source_asset_id` 递归标记全部 public 图片后代 stale，覆盖图层合成资产。
  - [x] SubTask 11.3: 图层拆分响应必须满足 `data[0].z_index == 0`，后续图层从 1 连续递增。
  - [x] SubTask 11.4: 将图层合成资产创建与当前成品 revision CAS 放入同一仓储事务；冲突时不写资产并补偿删除 TOS 对象。
  - [x] SubTask 11.5: 补充双仓储、乱序响应、递归 stale 和并发合成测试，并运行后端全量与前端回归。

# Task Dependencies

- Task 2 and Task 3 depend on Task 1 and can run in parallel。
- Task 4 depends on Task 1 and Task 3。
- Task 5 depends on Task 2 and Task 4。
- Task 6 depends on Task 4 and Task 5。
- Task 7 depends on Task 1 and Task 4。
- Task 8 depends on Task 2 and Task 7。
- Task 9 depends on Task 5、Task 7 and Task 8。
- Task 10 depends on Task 1-9。
- Task 11 depends on Task 10。
