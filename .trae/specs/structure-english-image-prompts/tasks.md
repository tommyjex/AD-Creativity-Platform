# Tasks

- [x] Task 1: 定义生图英文分层内部契约。
  - [x] SubTask 1.1: 新增 Layer Section schema，约束 label、content、4–10 层、大小写不敏感唯一、`Composition` 和末尾 `Negative Prompt`。
  - [x] SubTask 1.2: 为真实与 Mock adapter 定义生图专属内部 sections 响应，同时保持公开优化 API 响应不变。
  - [x] SubTask 1.3: 增加 schema 测试，覆盖层数边界、标题字符、重复、必需层、顺序和旧格式拒绝。

- [x] Task 2: 实现英文动态分层 Provider 策略。
  - [x] SubTask 2.1: 更新文生图系统指令，根据用户文本、优化方向、尺寸和画幅动态选择 4–10 个相关层级。
  - [x] SubTask 2.2: 更新图生图策略，按普通图生图、图片编辑、多参考图和 operation 组织 `Reference Usage / Edit Instructions / Preserve` 等必要层级。
  - [x] SubTask 2.3: 要求 `Composition` 提供任务相关的构图信息，`Negative Prompt` 汇总明确否定条件并避免否定目标内容。
  - [x] SubTask 2.4: 要求基础提示词和 BBox 引用说明使用英文，同时原样保留受保护字面量、BBox token 和坐标。
  - [x] SubTask 2.5: 更新 Mock Provider，使固定语料可确定性返回动态 sections 和英文引用说明。
  - [x] SubTask 2.6: 添加真实/Mock adapter 测试，覆盖室内、商品、人物、动物、纯背景、图片编辑和多参考图。

- [x] Task 3: 实现后端分层校验与稳定渲染。
  - [x] SubTask 3.1: 实现 Layer Section 数量、标题、唯一性、必需层、顺序、非空和输出长度校验。
  - [x] SubTask 3.2: 实现英文校验：屏蔽受保护字面量后拒绝中日韩文字，并要求字段包含 ASCII 英文字母。
  - [x] SubTask 3.3: 实现 `Label: content` 稳定渲染，规范首尾及连续空白，不改变受保护字面量。
  - [x] SubTask 3.4: 扩展硬约束校验，拒绝遗漏或改写品牌、产品、型号、画面文字、颜色、数量、比例和否定条件。
  - [x] SubTask 3.5: 校验 Negative Prompt 不与用户明确要求、保留内容或参考图特征冲突。
  - [x] SubTask 3.6: 将生图 sections 渲染结果接入现有 `optimized_text`，保持 LLM/生视频结果路径不变。
  - [x] SubTask 3.7: 添加服务测试，覆盖合法渲染、语言失败、硬约束、负面冲突和旧 Provider 响应拒绝。

- [x] Task 4: 接入 BBox 英文引用说明与原子写回。
  - [x] SubTask 4.1: 要求每条生图引用说明返回单段英文，并保持数组长度、顺序和来源对应关系。
  - [x] SubTask 4.2: 保持 BBox 引用 ID、token、坐标和每条说明中的受保护字面量不变。
  - [x] SubTask 4.3: 任一主分层或引用说明失败时拒绝整个响应，禁止部分写回。
  - [x] SubTask 4.4: 添加引用数量、顺序、英文、token、坐标、受保护字面量和原子失败测试。

- [x] Task 5: 保持前端写回与展示兼容。
  - [x] SubTask 5.1: 确认现有 API client 继续消费 `optimized_text + optimized_reference_instructions`，不向前端暴露 sections。
  - [x] SubTask 5.2: 验证多行 `Label: content` 结果完整写回文本节点和上游覆盖值，不丢换行或冒号。
  - [x] SubTask 5.3: 保持 loading、取消、过期响应、无变化、不自动保存和单次撤销语义。
  - [x] SubTask 5.4: 增加文生图、图生图、BBox、多行展示、失败保留和撤销测试。

- [x] Task 6: 完成回归与浏览器验收。
  - [x] SubTask 6.1: 运行后端 schema、Provider、服务、路由定向测试及完整 pytest。
  - [x] SubTask 6.2: 运行前端定向测试、完整 Vitest、TypeScript、ESLint 和 production build。
  - [x] SubTask 6.3: 使用 Mock Provider 在浏览器验证室内、商品和图片编辑需求输出英文动态分层。
  - [x] SubTask 6.4: 验证中文画面文字、品牌/型号、BBox token 和坐标保持不变。
  - [x] SubTask 6.5: 在 `1440x900`、`1024x768`、`390x844` 验证多行文本可读、无溢出或控件重叠。
  - [x] SubTask 6.6: 审计网络和持久化，确认优化未创建 Run/Task、未生成图片且没有部分写回。

- [x] Task 7: 修复最终核验发现的生图硬约束漏检。
  - [x] SubTask 7.1: 扩展主提示词硬约束提取与校验，确保未加引号且未使用“品牌/型号”前缀的明确产品名不得遗漏或改写。
  - [x] SubTask 7.2: 泛化用户否定条件校验，确保 `Negative Prompt` 保留“不要出现水滴”等非固定词表的明确排除条件。
  - [x] SubTask 7.3: 校验数量约束的对象绑定与新增数量，拒绝在保留原数量的同时虚构未请求的额外数量或对象。
  - [x] SubTask 7.4: 增加产品名遗漏、一般否定条件遗漏和新增未请求数量的失败回归测试，并重新运行相关后端定向测试。
  - [x] SubTask 7.5: 修复后重新执行最终系统核验，只有反例均被拒绝时才勾选 checklist 剩余两项。

- [x] Task 8: 修复 Task 7.5 发现的 evidence 完整性与数量对象绑定绕过。
  - [x] SubTask 8.1: 后端独立识别未加引号产品名和任意明确否定条件，拒绝 Provider 通过省略对应 evidence 绕过校验。
  - [x] SubTask 8.2: 校验 quantity evidence 的源对象与输出对象语义绑定，拒绝 Provider 通过自洽 evidence 将原数量重绑到其他对象。
  - [x] SubTask 8.3: 增加空 evidence 产品名遗漏、空 evidence 否定条件遗漏和自洽 evidence 数量重绑反例测试。
  - [x] SubTask 8.4: 重新运行 Task 7.5 全部定向测试、后端完整 pytest 与 `git diff --check`。

- [x] Task 9: 修复最终核验发现的 Provider evidence 语义重绑与独立产品名提取缺口。
  - [x] SubTask 9.1: 后端独立校验任意用户否定条件与 `Negative Prompt` 的语义对应关系，拒绝 Provider 将“不要出现水滴”等源约束重绑为无关输出。
  - [x] SubTask 9.2: 扩展独立 identity 提取，覆盖不带“为…制作/展示…”固定句式和不带品牌/型号标签的明确品牌、产品及型号。
  - [x] SubTask 9.3: 增加伪造 exclusion evidence 与非固定句式产品名遗漏反例，并保留现有三个绕过反例和合法数量翻译正例。
  - [x] SubTask 9.4: 修复后重新运行定向测试、完整后端 pytest、前端全量校验、浏览器验收及 `git diff --check`，再勾选 checklist 剩余两项。

- [x] Task 10: 修复最终独立核验发现的 source anchor 代替语义校验绕过。
  - [x] SubTask 10.1: 在追加 `Source constraint` 前独立验证 Provider 输出已保留产品 identity，确保“青岚气泡水产品主图”被改写为泛化 product 且遗漏产品名时整次拒绝。
  - [x] SubTask 10.2: 在追加 `Source constraint` 前验证 `Negative Prompt` 已包含用户否定条件的对应英文语义，确保“不要出现水滴”被无关英文替代时整次拒绝。
  - [x] SubTask 10.3: 保持 Provider 伪造或省略 evidence 不可绕过、数量对象重绑和新增数量拒绝，同时接受合法英文翻译与后端不可篡改 source anchor。
  - [x] SubTask 10.4: 将当前遗漏产品名和遗漏否定语义的成功用例改为拒绝回归，并覆盖 source anchor 被语言校验安全屏蔽、最终逐行格式合法且 `Negative Prompt` 位于末尾。
  - [x] SubTask 10.5: 重新运行 Task 9/10 定向攻击、后端完整 pytest、前端完整 Vitest/TypeScript/ESLint/build、三视口浏览器报告及 `git diff --check`；全部通过后再勾选 checklist 剩余两项。

- [x] Task 11: 修正最终浏览器验收脚本对 canonical anchor 的旧契约假设。
  - [x] SubTask 11.1: 将脚本中的旧 `Source constraint` 屏蔽与可见性断言更新为 `Preserve exact identity`、`Honor exclusion exactly` 和 `Preserve exact quantity-object constraint`。
  - [x] SubTask 11.2: 使用 Mock Provider 重新完成室内、商品、图片编辑、BBox 与三视口验收，确认报告通过且无真实生成或计费请求。

# Task Dependencies

- Task 2 依赖 Task 1。
- Task 3 依赖 Task 1 和 Task 2。
- Task 4 依赖 Task 2 和 Task 3。
- Task 5 依赖 Task 1 和 Task 3，可与 Task 4 的测试并行。
- Task 6 依赖 Task 1 至 Task 5。
- Task 7 依赖 Task 3、Task 6 和 Task 8。
- Task 8 依赖 Task 3。
- Task 9 依赖 Task 8。
- Task 10 依赖 Task 9。
- Task 11 依赖 Task 10。
