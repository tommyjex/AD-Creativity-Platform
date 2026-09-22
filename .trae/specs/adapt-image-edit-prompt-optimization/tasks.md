# Tasks

- [x] Task 1: 定义局部编辑与完整设计的内部判别联合。
  - [x] SubTask 1.1: 新增 `optimization_mode=local_edit/full_design` 判别字段及两种互斥响应 schema。
  - [x] SubTask 1.2: `local_edit` 定义单段 `optimized_text`，`full_design` 继续定义 `sections`，两者保留引用说明数组。
  - [x] SubTask 1.3: 校验 `local_edit` 仅允许单图图生图或 `image_edit`，文生图、多参考图和其他 operation 不允许。
  - [x] SubTask 1.4: 保持公开 API 只返回 `optimized_text + optimized_reference_instructions`。
  - [x] SubTask 1.5: 增加合法联合、缺失模式、混合字段、非法目标和旧完整分层兼容测试。

- [x] Task 2: 建立被编辑原图的安全来源上下文。
  - [x] SubTask 2.1: 为图生图请求增加可选 `pipeline_context` schema，包含 `pipeline_id`、`base_revision`、当前 `definition_snapshot` 和可空 `source_image`，保持旧请求兼容。
  - [x] SubTask 2.2: 前端从当前 Pipeline 快照解析唯一合格入边：普通图生图使用唯一 `image`，`image_edit` 使用唯一 `edit_image`；多图、图层拆分和无效结果不提交来源图。
  - [x] SubTask 2.3: 本地图片提交当前节点资产；上游结果提交 Run ID 与成功投影资产；客户端不提交 URL、对象 Key、签名参数或二进制。
  - [x] SubTask 2.4: 后端校验 Pipeline 访问权限、快照 schema、目标配置、operation、参考图数量、直接入边和来源 descriptor。
  - [x] SubTask 2.5: 兼容未保存画布与自动保存竞态：当前 revision 等于基准 revision 时接受快照；revision 已推进但服务端 definition 与快照相等时接受；其余返回 revision conflict。
  - [x] SubTask 2.6: 分别验证本地资产访问范围，或验证 Run、Run definition、成功 RunNode 与结果资产关系，再验证资产状态、公开性、图片类型和对象可访问性。
  - [x] SubTask 2.7: 仅在全部验证通过后生成短期受控 URL；请求快照和来源上下文不持久化。
  - [x] SubTask 2.8: 增加本地图片、上游 Run、未保存快照、自动保存竞态、真实 revision 冲突、伪造资产、不可访问图片、模板调用和多参考图测试。

- [x] Task 3: 实现单次多模态 Provider 调用内的保守语义判别。
  - [x] SubTask 3.1: 更新生图系统指令，结合用户文本、目标配置和唯一被编辑原图判断局部编辑或完整设计，并按联合结构返回。
  - [x] SubTask 3.2: 合法来源存在时，将受控 URL 作为唯一一项 `input_image` 加入 user content；文本 JSON 上下文不包含 URL。
  - [x] SubTask 3.3: 定义局部编辑正例：加字、改色、局部增删、属性微调、保留主体的背景替换。
  - [x] SubTask 3.4: 定义完整设计反例：整体换风格、重新构图、重建场景、主体身份变化、多参考图组合。
  - [x] SubTask 3.5: 模糊或可能影响整体画面的请求保守返回 `full_design`；没有合法 `input_image` 时禁止返回 `local_edit`。
  - [x] SubTask 3.6: 保持 BBox 引用说明单独返回英文单段，并保持数量、顺序、token 和坐标。
  - [x] SubTask 3.7: 增加真实适配器请求/解析测试，确认每次优化只有一次 Provider 调用、最多一张输入图，且日志、JSON 上下文和错误不含 URL。

- [x] Task 4: 实现局部编辑单段规范化与安全校验。
  - [x] SubTask 4.1: 规范化单段空白，拒绝换行、section label、Markdown、JSON、编号、解释和代码围栏。
  - [x] SubTask 4.2: 要求单段包含明确编辑动作、原图锚定和未编辑内容保持语义。
  - [x] SubTask 4.3: 复用现有受保护字面量、品牌、产品、型号、画面文字、颜色、数量、比例和否定条件校验。
  - [x] SubTask 4.4: 复用 BBox 引用数量、顺序、ID、token、坐标和英文说明校验。
  - [x] SubTask 4.5: 拒绝将局部修改扩大到未请求的主体、背景、姿态、构图、光影或整体风格。
  - [x] SubTask 4.6: 局部模式不执行 section、`Composition` 或 `Negative Prompt` 校验；显式否定条件保留在同一段中。
  - [x] SubTask 4.7: 增加合法加字/改色/换背景、缺少保持语义、范围扩大、硬约束遗漏和原子失败测试。

- [x] Task 5: 保持完整分层、校验韧性与公开响应兼容。
  - [x] SubTask 5.1: `full_design` 继续走现有 sections 规范化、warning、4–10 层、`Composition` 和末尾 `Negative Prompt`。
  - [x] SubTask 5.2: 文生图固定使用 `full_design`，LLM 与生视频路径不进入新判别。
  - [x] SubTask 5.3: 在 generation service 中按 `optimization_mode` 分派渲染与校验，再统一输出公开响应。
  - [x] SubTask 5.4: 为结构错误、非法局部资格和校验失败保留脱敏错误与无部分写回语义。
  - [x] SubTask 5.5: 记录不含原文、输出、URL、资产 ID、Run ID 或密钥的模式诊断字段。
  - [x] SubTask 5.6: 增加完整分层、校验 warning、错误映射、公开 API、旧请求兼容和无持久化副作用回归测试。

- [x] Task 6: 更新 Mock Provider 与前端兼容回归。
  - [x] SubTask 6.1: Mock Provider 对固定局部编辑语料和合法单图上下文确定性返回单段模式。
  - [x] SubTask 6.2: Mock Provider 对无合法图片、整体重设计、多参考图和文生图确定性返回完整分层模式。
  - [x] SubTask 6.3: 验证前端无需识别内部模式即可原子写回单段或多行结果。
  - [x] SubTask 6.4: 将 `pipeline_context` 和来源图身份纳入请求快照，保持 loading、取消、过期响应、无变化、单次撤销和不自动保存语义。
  - [x] SubTask 6.5: 增加来源解析、单段显示、完整分层显示、失败保留、撤销和上游文本覆盖回归测试。

- [x] Task 7: 完成回归与非计费浏览器验收。
  - [x] SubTask 7.1: 运行后端 schema、ModelArk、提示词服务、路由定向测试及完整 pytest。
  - [x] SubTask 7.2: 运行前端提示词编辑定向测试、完整 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 7.3: 使用 Mock Provider 验证单图加字、改色、背景替换显示单段英文指令。
  - [x] SubTask 7.4: 使用 Mock Provider 验证无图、整体换风格、重新构图、多参考图和文生图继续显示完整分层。
  - [x] SubTask 7.5: 验证品牌、画面文字、颜色、数量、BBox、否定条件和引用说明在两种模式下保持。
  - [x] SubTask 7.6: 在桌面与窄屏验证单段/多行文本可读，无溢出、重叠或不可达操作。
  - [x] SubTask 7.7: 审计网络、日志与持久化，确认一次点击只有一次优化 Provider 调用、最多发送一张受控图片，且未泄露 URL、未创建 Run/Task、未调用图片生成。

# Task Dependencies

- Task 2 depends on Task 1。
- Task 3 depends on Task 1 and Task 2。
- Task 4 depends on Task 1 and Task 3。
- Task 5 depends on Task 1 and Task 4。
- Task 6 depends on Task 1 and Task 2，可与 Task 3 至 Task 5 的后端工作部分并行。
- Task 7 depends on Task 1 至 Task 6。
