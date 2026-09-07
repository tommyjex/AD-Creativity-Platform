# Tasks

- [x] Task 1: 建立 AIGC 公开输出资产命名规则
  - [x] SubTask 1.1: 新增后端纯函数，根据 Pipeline 名称、Run definition、节点 ID、资产 MIME 类型和输出 ordinal 生成 `画布名-节点显示名-资产类型序号.扩展名`
  - [x] SubTask 1.2: 节点名优先使用自定义标题，否则按节点类型和 definition 顺序生成与前端一致的显示名
  - [x] SubTask 1.3: 实现确定性的非法字符替换、按“先画布名后节点名”截断的 180-byte 长度限制、固定空值回退及图片/视频 MIME 映射表
  - [x] SubTask 1.4: 添加单元测试，覆盖中文名称、重复节点、非法字符、多输出序号、不同媒体类型和边界长度

- [x] Task 2: 将统一名称写入所有 AIGC 公开输出归档路径
  - [x] SubTask 2.1: 在图片生成、图片编辑和公开图层合成输出创建时写入 `metadata.name`
  - [x] SubTask 2.2: 在视频生成、视频增强、人脸打码和多轨剪辑输出创建时写入 `metadata.name`
  - [x] SubTask 2.3: 所有新命名输出同时写入 `metadata.name_scheme="aigc_canvas_node_v1"` 并保留 pipeline/run/node/task 等既有追溯元数据；音频与字幕上传输入继续保留原文件名
  - [x] SubTask 2.4: 保持内部底图/拆分图层不可见，保持输入上传资产原始文件名
  - [x] SubTask 2.5: 确保资产库下载文件名使用 `metadata.name`，对象存储 key、引用关系和缓存键保持不变
  - [x] SubTask 2.6: 添加后端归档测试，验证名称方案标记、输出 ordinal、追溯元数据保留、失败清理和历史行为无回归

- [x] Task 3: 在资产库增加互斥的 AIGC 工作台来源
  - [x] SubTask 3.1: 将来源类型和 URL 参数扩展为 `all / projects / tools / aigc`
  - [x] SubTask 3.2: 按“项目优先，其次 AIGC，最后普通工具”的统一判定顺序分类，并将 `/api/tools/assets` 返回资产拆分为 AIGC 工作台资产与独立工具资产
  - [x] SubTask 3.3: 选择“AIGC工作台”时只展示 AIGC 公开输入与输出资产，并禁用、清除项目筛选
  - [x] SubTask 3.4: “全部资产”合并三类来源且按资产 ID 去重；“工具资产”排除 AIGC 资产
  - [x] SubTask 3.5: 更新来源计数、空态、卡片和预览详情中的来源/角色文案

- [x] Task 4: 补充前端行为与兼容性测试
  - [x] SubTask 4.1: 覆盖 `source=aigc` 解析、筛选提交、项目参数清除和未知来源回退
  - [x] SubTask 4.2: 覆盖 AIGC 输入/输出可见、冲突元数据按项目优先归类、工具来源排除 AIGC、三个来源两两互斥及全部来源无重复
  - [x] SubTask 4.3: 覆盖状态、分区、关键词与 AIGC 来源组合筛选，以及 AIGC 专属空态
  - [x] SubTask 4.4: 覆盖 `name_scheme` 新名称的卡片/预览展示、关键词搜索、下载文件名与无标记历史资产回退

- [x] Task 5: 完成回归与多视口验收
  - [x] SubTask 5.1: 运行后端相关测试和完整 pytest
  - [x] SubTask 5.2: 运行前端完整 Vitest、TypeScript、ESLint 和 production build
  - [x] SubTask 5.3: 使用包含项目资产、普通工具资产、AIGC 输入和 AIGC 输出的确定性 fixture 验证来源互斥
  - [x] SubTask 5.4: 在 1440x1000、1024x768、390x844 视口验证筛选、名称、搜索、下载和空态
  - [x] SubTask 5.5: 检查页面无控制台错误、横向溢出、控件重叠或媒体比例回归

- [x] Task 6: 修复浏览器验收运行环境并复验
  - [x] SubTask 6.1: 使用 `frontend/node_modules` 中现有的 Node `@playwright/test`，不依赖缺失的 Python `playwright`
  - [x] SubTask 6.2: 完成 Task 5.4 与 5.5 的三个视口验收并记录结果

- [x] Task 7: 修复资产库来源常量的运行时类型错误
  - [x] SubTask 7.1: 修复 `WORKSPACE_ASSET_SOURCES.includes is not a function`，确保来源常量运行时为可调用 `includes` 的稳定数组
  - [x] SubTask 7.2: 增加页面级回归测试，覆盖 `source=aigc` 与未知 source 参数解析，避免类型检查通过但运行时崩溃
  - [x] SubTask 7.3: 重跑相关前端测试、TypeScript、ESLint，并重新执行 Task 6.2

- [x] Task 8: 建立隔离的确定性浏览器验收环境
  - [x] SubTask 8.1: 在临时目录启动 Mock API 和独立 Next 实例，不修改业务数据或工作区源码
  - [x] SubTask 8.2: 注入项目、普通工具、AIGC 输入、历史 AIGC 输出和新命名 AIGC 输出资产
  - [x] SubTask 8.3: 完成来源互斥、新名称搜索/下载及三视口布局验收

# Task Dependencies

- Task 2 depends on Task 1.
- Task 4 depends on Tasks 2 and 3.
- Task 5 depends on Tasks 1-4.
- Task 6 depends on Task 5.1-5.3.
- Task 7 depends on Task 6.1; Task 6.2 depends on Task 7.
- Task 8 depends on Task 7.1-7.2; Task 6.2 depends on Task 8.
- Tasks 1 and 3 can be implemented in parallel.
