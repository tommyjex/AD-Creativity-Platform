# Tasks

- [ ] Task 1: 定义 BBox 与结构化提示词引用契约。
  - [ ] SubTask 1.1: 在前后端图片输入配置中增加可选单个 BBox 与 `bbox_asset_id`，复用 0–999 归一化坐标校验并强制资产绑定一致。
  - [ ] SubTask 1.2: 在文本输入配置中增加有序 `bbox_references`，校验数量、来源唯一性和按 Unicode code points 计算的说明文字长度。
  - [ ] SubTask 1.3: 为旧 definition 提供空 BBox/空引用默认值，保持 `schemaVersion=1`。
  - [ ] SubTask 1.4: 增加前后端契约测试。

- [ ] Task 2: 实现严格关联校验、同步清理和模板净化。
  - [ ] SubTask 2.1: 后端 DAG 使用统一判定式校验引用源存在、类型、资产、BBox，以及文本节点所有直接下游的严格共同图生图关系，并返回稳定错误码。
  - [ ] SubTask 2.2: 前端使用相同判定式推导可引用目标；新增不兼容下游边时拒绝连接。
  - [ ] SubTask 2.3: Zustand 增加原子更新操作，处理弹窗确认、重新框选、清除、换图、删除图片节点和删除关联边时的引用同步。
  - [ ] SubTask 2.4: 保存为模板时清除图片资产、BBox 和文本 BBox 引用，保留普通文本和拓扑。
  - [ ] SubTask 2.5: 增加校验、同步、撤销重做和模板清理测试。

- [ ] Task 3: 实现目标相关的提示词编译和缓存隔离。
  - [ ] SubTask 3.1: 在图生图任务解析时保持 definition 边数组顺序，按规范化算法将结构化引用编译为 `图N<bbox>…</bbox>`。
  - [ ] SubTask 3.2: 以大小写不敏感坐标标签模式拒绝基础文本和引用说明中的手工标签，返回 `coordinate_tag_forbidden`。
  - [ ] SubTask 3.3: 将基础文本、引用顺序、引用说明、BBox 和解析后的图片编号纳入任务快照与 `inputHash`。
  - [ ] SubTask 3.4: 升级图片执行器版本，增加精确字符串、单引用、多引用、空说明、不同目标顺序、失效引用和缓存测试。

- [ ] Task 4: 构建图片输入节点精准编辑弹窗。
  - [ ] SubTask 4.1: 在图片输入节点增加独立精准编辑按钮，并保持缩略图点击预览行为不变。
  - [ ] SubTask 4.2: 复用 `BboxCanvas` 构建宽屏弹窗，支持绘制、调整、重置、原图预览和单框替换。
  - [ ] SubTask 4.3: 在弹窗中展示严格关联的文本节点列表，支持多选并以一次历史操作确认绑定；无合法目标时禁用确认；满 10 条时仅禁用尚未引用当前图片的目标。
  - [ ] SubTask 4.4: 模板模式、无资产和不可访问资产禁用精准编辑。
  - [ ] SubTask 4.5: 增加弹窗交互、坐标换算和目标筛选测试。

- [ ] Task 5: 构建文本输入节点结构化提示词编辑器。
  - [ ] SubTask 5.1: 从现有 `VisualPromptEditor` 抽取可复用的 BBox 缩略图和防篡改引用卡片。
  - [ ] SubTask 5.2: 文本节点编辑器展示基础文本、按序引用卡片及每条引用后的说明输入。
  - [ ] SubTask 5.3: 支持删除单个引用，并在节点卡片摘要中显示引用数量。
  - [ ] SubTask 5.4: 增加引用展示、编辑、防篡改、删除和自动同步测试。

- [ ] Task 6: 完成回归与浏览器验收。
  - [ ] SubTask 6.1: 在仓库根目录使用 `PYTHONPATH=. .venv/bin/pytest` 运行后端完整回归。
  - [ ] SubTask 6.2: 在 `frontend` 运行 lint、typecheck、完整 Vitest 和 production build。
  - [ ] SubTask 6.3: 在桌面浏览器验证大图框选、严格目标多选、文本引用卡片、重新框选同步、清除同步、保存恢复和实际图生图任务。
  - [ ] SubTask 6.4: 在窄屏验证弹窗内容可达、图片完整显示、文字和控件无重叠。

# Task Dependencies

- Task 2、Task 3 依赖 Task 1，可并行。
- Task 4 依赖 Task 1、Task 2。
- Task 5 依赖 Task 1、Task 2，可与 Task 3 并行。
- Task 6 依赖 Task 2、Task 3、Task 4、Task 5。
