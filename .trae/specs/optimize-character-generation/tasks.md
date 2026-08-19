# Tasks
- [x] Task 1: 设计并补齐角色卡片数据契约。
  - [x] SubTask 1.1: 明确角色卡片字段，包括角色 ID、项目 ID、名字、描述/生图提示词、排序、关联图片资产 ID、状态、创建时间和更新时间。
  - [x] SubTask 1.2: 在后端 schema 和 repository 协议中增加角色卡片的创建、查询、更新、删除能力。
  - [x] SubTask 1.3: 为 MySQL 和内存仓储实现角色卡片持久化，并保证项目详情能返回角色卡片列表。

- [x] Task 2: 实现从故事文本提取角色卡片。
  - [x] SubTask 2.1: 在 ModelArk/Seed 文本适配层新增“从故事提取角色”的结构化输出能力。
  - [x] SubTask 2.2: 修改 `POST /api/projects/{project_id}/characters`，使其创建角色卡片而不是直接生成固定角色图片。
  - [x] SubTask 2.3: 处理无故事、无可提取角色、模型失败等异常，并返回脱敏错误信息。

- [x] Task 3: 实现角色卡片编辑、删除与单角色形象生成 API。
  - [x] SubTask 3.1: 新增角色卡片更新接口，支持编辑角色名字和描述/生图提示词。
  - [x] SubTask 3.2: 新增角色卡片删除接口，删除后项目详情不再展示该卡片。
  - [x] SubTask 3.3: 新增单角色“形象生成”接口，调用 Seedream 生成图片、上传 TOS、写入角色资产并关联到角色卡片。
  - [x] SubTask 3.4: 复用或调整现有“重新生成”能力，使其基于角色卡片的当前名字和描述生成新图。

- [x] Task 4: 改造角色页前端交互。
  - [x] SubTask 4.1: 角色页根据角色卡片列表渲染卡片；无卡片时显示初始空态。
  - [x] SubTask 4.2: 每张角色卡顶部展示图片预占位或已生成图片，样式保持当前卡片风格。
  - [x] SubTask 4.3: 支持双击角色名字和描述区域进入编辑态，并保存到后端。
  - [x] SubTask 4.4: 在角色名字右侧提供“形象生成”“重新生成”“删除”按钮，并展示角色更新时间。
  - [x] SubTask 4.5: 形象生成成功后刷新项目详情并加载 TOS 图片；失败时保留卡片和预占位。

- [x] Task 5: 添加自动化测试与验证。
  - [x] SubTask 5.1: 添加后端测试，覆盖角色提取、无角色文本、卡片编辑、删除、形象生成成功和失败回滚。
  - [x] SubTask 5.2: 添加前端测试，覆盖空态、角色卡片展示、双击编辑、形象生成、重新生成和删除。
  - [x] SubTask 5.3: 运行 `.venv` 后端测试、前端 lint、typecheck 和 test。

# Task Dependencies
- Task 2 depends on Task 1。
- Task 3 depends on Task 1 and Task 2。
- Task 4 depends on Task 1 and Task 3。
- Task 5 depends on Task 2、Task 3 and Task 4。

- [x] Task 6: 修复 checklist 验证未通过项。
  - [x] SubTask 6.1: 当角色提取返回空列表或无法识别具体角色时，`POST /api/projects/{project_id}/characters` 返回可理解提示，明确说明当前故事未识别到角色，同时继续保证不创建“品牌体验官”“目标用户”等兜底固定角色。
  - [x] SubTask 6.2: 调整 API 响应和前端错误展示，避免暴露完整 TOS 签名 URL query；保留图片预览所需能力，并补充覆盖 Ark Key、TOS Key、数据库密码、完整签名 URL query 和供应商原始敏感错误不外泄的测试。
