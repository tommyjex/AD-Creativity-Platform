# Tasks
- [x] Task 1: 扩展后端配置和依赖。
  - [x] SubTask 1.1: 在配置模块中读取 MySQL `DB_*` 和 TOS `TOS_*` 环境变量。
  - [x] SubTask 1.2: 在后端依赖中加入 MySQL ORM/驱动和 TOS SDK。
  - [x] SubTask 1.3: 确保配置错误不会输出数据库密码或 TOS 密钥。
- [x] Task 2: 实现 MySQL 数据模型和初始化。
  - [x] SubTask 2.1: 定义项目、文本产物、分镜、任务和资产的 ORM 表结构。
  - [x] SubTask 2.2: 提供数据库 engine/session 管理和初始化表结构能力。
  - [x] SubTask 2.3: 添加初始化幂等验证。
- [x] Task 3: 实现 MySQL 仓储并接入 workflow/API。
  - [x] SubTask 3.1: 实现与现有 `InMemoryRepository` 行为兼容的 MySQL repository。
  - [x] SubTask 3.2: 将默认依赖注入切换到 MySQL repository，并保留测试覆盖的替换能力。
  - [x] SubTask 3.3: 验证项目、任务、文本产物、分镜和资产可持久化读取。
- [x] Task 4: 实现 TOS 资产服务。
  - [x] SubTask 4.1: 初始化 TOS 客户端并支持 object key 生成。
  - [x] SubTask 4.2: 支持上传/登记图片、视频和成片资产，并写入 MySQL 资产记录。
  - [x] SubTask 4.3: 保证资产列表 API 返回稳定 URL 和元数据。
- [x] Task 5: 更新测试和验证。
  - [x] SubTask 5.1: 添加 MySQL repository、配置、数据库初始化和 TOS 资产服务测试。
  - [x] SubTask 5.2: 更新 API/workflow 测试，覆盖持久化仓储路径。
  - [x] SubTask 5.3: 使用 `.venv` 执行后端测试命令并记录结果。

# Task Dependencies
- Task 2 depends on Task 1。
- Task 3 depends on Task 2。
- Task 4 depends on Task 1 and Task 3。
- Task 5 depends on Task 3 and Task 4。
