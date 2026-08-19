# Tasks

- [x] Task 1: 扩展 Brief 语言数据契约与持久化。
  - [x] SubTask 1.1: 定义 `target_language` 的 `zh` / `en` 类型、默认值和创建/更新校验。
  - [x] SubTask 1.2: 为 `BriefORM` 增加非空语言字段，并扩展 additive migration 为历史 Brief 幂等回填 `zh`。
  - [x] SubTask 1.3: 更新内存与 SQLAlchemy 仓储的创建、读取、列表和原子更新映射。
  - [x] SubTask 1.4: 添加 schema、数据库迁移和双仓储契约测试。

- [x] Task 2: 在项目工作台接入目标语言。
  - [x] SubTask 2.1: 扩展前端 Brief 类型，新增 `target_language: "zh" | "en"`。
  - [x] SubTask 2.2: 在新建与编辑表单增加中文/英文选择，并正确提交、回显与校验。
  - [x] SubTask 2.3: 在项目摘要和 Brief 查看态展示目标语言标签。
  - [x] SubTask 2.4: 更新前端 API fixture、项目创建/编辑和展示测试。

- [x] Task 3: 让角色与角色生图提示词继承目标语言。
  - [x] SubTask 3.1: 修改角色提取 prompt，英文模式要求英文角色名称与 `description`，中文模式保持现有规范。
  - [x] SubTask 3.2: 扩展角色形象生图提示词组装接口，按目标语言输出三视图、白底、禁止场景/动作和画幅比例约束。
  - [x] SubTask 3.3: 确保真实适配器和 mock 适配器的英文角色结果遵守同一契约。
  - [x] SubTask 3.4: 添加中文兼容、英文输出约束和专有名词保留测试。

- [x] Task 4: 让剧本与分镜脚本继承目标语言。
  - [x] SubTask 4.1: 将剧本生成 prompt 中固定中文要求改为按 Brief 语言选择，英文模式覆盖标题、正文和全部场次字段。
  - [x] SubTask 4.2: 将分镜生成 prompt 中固定中文要求改为按 Brief 语言选择，英文模式覆盖文本产物与结构化镜头字段。
  - [x] SubTask 4.3: 更新 mock 剧本与 mock 分镜输出，使英文模式返回英文结果并保持时长/结构规则。
  - [x] SubTask 4.4: 添加真实 prompt、mock 输出、结构化解析和中文回归测试。

- [x] Task 5: 建立中英文分镜视频提示词契约。
  - [x] SubTask 5.1: 为单镜头、合并镜头和规范化函数增加目标语言参数，定义中英文固定章节、语音和负向约束模板。
  - [x] SubTask 5.2: 让项目级视频配置、镜头生成、合并/拆分及默认 `effective_video_prompt` 使用 Brief 语言。
  - [x] SubTask 5.3: 修改 AI 优化 system/user 指令与输出验证，按 Brief 语言生成并校验对应章节。
  - [x] SubTask 5.4: 保持字幕指令禁用、时间轴、引用 token、字符上限和编辑候选流程不变。
  - [x] SubTask 5.5: 添加中英文单镜头、合并、语音、AI 优化和非法混合章节测试。

- [x] Task 6: 实现目标语言变更的精准失效。
  - [x] SubTask 6.1: 在项目更新入口比较更新前后的 `target_language`。
  - [x] SubTask 6.2: 语言变化时将角色及下游阶段标记为需更新，保留故事与全部历史数据。
  - [x] SubTask 6.3: 相同语言重复保存时不得产生额外失效。
  - [x] SubTask 6.4: 添加中英双向切换、无变化和历史数据保留测试。

- [x] Task 7: 完成端到端验证。
  - [x] SubTask 7.1: 使用项目根目录 `.venv` 运行后端全量测试。
  - [x] SubTask 7.2: 运行前端全量测试、TypeScript 与 ESLint。
  - [x] SubTask 7.3: 浏览器验证新建英文项目、编辑语言、语言展示和表单响应式布局。
  - [x] SubTask 7.4: 执行英文项目 smoke test，验证角色描述、剧本、分镜结构字段及分镜视频有效提示词为英文，且不包含字幕指令。

- [x] Task 8: 修复独立验收发现的语言与视频提示词校验缺口。
  - [x] SubTask 8.1: 让内存与 SQLAlchemy 仓储按项目目标语言生成合并镜头标题，并补充英文双仓储测试。
  - [x] SubTask 8.2: 从 AI 优化输入草稿提取已有参考素材 token，要求优化输出完整保留且不得新增，并补充丢失 token 的拒绝测试。
  - [x] SubTask 8.3: 扩展中英文字幕/画面文字禁用规则，覆盖画面文字、文字或文案叠加、text overlay 等指令，并补充 normalize 与优化拒绝测试。
  - [x] SubTask 8.4: 运行后端相关测试与全量测试，重新执行失败 checkpoint 的反证用例。

# Task Dependencies

- Task 2 depends on Task 1。
- Task 3 and Task 4 depend on Task 1 and can run in parallel。
- Task 5 depends on Task 1 and Task 4。
- Task 6 depends on Task 1 and existing workflow invalidation behavior。
- Task 7 depends on Task 2-6。
- Task 8 depends on Task 5 and Task 7。
