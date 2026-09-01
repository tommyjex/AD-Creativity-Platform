# Tasks

- [x] Task 1: 参考图节点按图片宽高比自适应。在节点创建路径测量图片原始宽高比并写入节点初始尺寸，`NodeResizer` 依该比例保持缩放。
  - [x] SubTask 1.1: 在 `image-canvas-page.tsx` 的 `addReferenceNode`（及初始节点构建 `buildInitialNodes` 的兜底）中，按图片原始宽高比在 `DEFAULT_NODE_SIZE` 基准内计算初始 `width/height`；尺寸不可得时回退方形默认值。
  - [x] SubTask 1.2: 在 `reference-node.tsx` 中让 `NodeResizer` 依据当前节点宽高比保持缩放（延续 `keepAspectRatio`），确保图片 `object-contain` 无明显黑边。

- [x] Task 2: 修复移除参考图确认弹窗内边距。为该 `Dialog` 的内容容器补足四周 padding，标题/描述/按钮不贴边，行为不变。
  - [x] SubTask 2.1: 在 `image-canvas-page.tsx` 的“移除参考图节点”`DialogContent` 上补内边距与合理间距。

- [x] Task 3: 收窄右侧“生成配置”面板。调小 `canvas-dock.tsx` 的固定宽度类，保持内部配置项与提示词编辑器可用。
  - [x] SubTask 3.1: 收窄 `CanvasDock` 的 `aside` 宽度（如由 `w-80 sm:w-[22rem]` 调整为更窄档位）。

- [x] Task 4: 引用卡片支持删除。为提示词编辑器的框选卡片新增可选删除回调，删除即清除对应参考图的 bbox。
  - [x] SubTask 4.1: 在 `visual-prompt-editor.tsx` 新增可选 `onRemoveReference?(assetId)`，在 `BboxReferenceCard` 上渲染删除按钮（仅当回调存在时）。
  - [x] SubTask 4.2: `canvas-dock.tsx` 透传该回调；`image-canvas-page.tsx` 实现回调：将对应参考图节点的 `bbox` 置空并触发 `scheduleSave`，从而同步移除提示词引用与节点框选覆盖层。

- [x] Task 5: 测试与验证。
  - [x] SubTask 5.1: 更新/新增 `image-canvas-page.test.tsx` 断言：非方形图片节点初始比例、删除引用卡片后引用与 bbox 清除、面板存在（收窄不破坏可用性）。
  - [x] SubTask 5.2: 前端 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 全部通过；如触及后端则在 `.venv` 下跑 pytest（预期本次不涉及后端）。

- [x] Task 6: 修复参考图节点媒体区显示不完整。
  - [x] SubTask 6.1: 将参考图尺寸计算拆分为媒体内容尺寸与节点外框尺寸，节点总高度明确计入标题栏、边框和媒体区内边距。
  - [x] SubTask 6.2: 调整参考图媒体内容盒与图片约束，使用确定的可用宽高配合 `object-contain`，保证横图、超宽图、竖图和方图均完整显示。
  - [x] SubTask 6.3: 调整节点缩放约束，使缩放后的媒体内容区保持图片比例，并确保 bbox 坐标继续基于实际渲染图片区域。
  - [x] SubTask 6.4: 在图片自然尺寸加载后识别并一次性校正旧版持久化节点尺寸，通过现有防抖保存链路持久化，避免每次刷新重复扩张。

- [x] Task 7: 补充回归测试与视觉验证。
  - [x] SubTask 7.1: 添加尺寸计算测试，覆盖横图、超宽图、竖图、方图、无效自然尺寸和标题栏/内边距占位。
  - [x] SubTask 7.2: 添加组件测试，验证媒体图片使用完整内容盒 `object-contain`、旧布局只迁移一次、缩放后 bbox 仍对应实际图片区域。
  - [x] SubTask 7.3: 使用浏览器在桌面视口验证截图所示横向 logo 图片四边完整可见，并检查节点缩放及 bbox 框选。
  - [x] SubTask 7.4: 运行前端 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`。

- [x] Task 8: 修复真实 React Flow 中旧参考图节点尺寸回写未生效。
  - [x] SubTask 8.1: 深入检查 Task 6 的图片 `onLoad`、旧布局判定及 React Flow `width`/`height`、`style.width`/`style.height`、`measured` 的尺寸优先级，定位测试通过但真实受控节点未迁移的根因。
  - [x] SubTask 8.2: 以 `@xyflow/react` 实际生效的受控节点字段回写迁移尺寸，确保节点总高度至少覆盖标题栏、边框、媒体区内边距和按自然比例计算的媒体高度，并保持迁移幂等、避免重复扩张。
  - [x] SubTask 8.3: 补充接近真实 React Flow 节点形态的回归测试，验证旧节点加载后有效外框尺寸确实更新且第二次加载不再扩张，不只断言尺寸 helper 返回值。
  - [x] SubTask 8.4: 运行定向 Vitest、`npm run typecheck`、`npm run lint` 和 diff check，确认不勾选 Task 7、SubTask 7.3 或 checklist。

- [x] Task 9: 修复旧尺寸迁移时序与 React Flow 受控尺寸优先级。
  - [x] SubTask 9.1: 删除迁移时手写的 `measured`，并让尺寸读取依次优先使用顶层 `width`/`height`、`style` 尺寸和内部只读派生的 `measured`。
  - [x] SubTask 9.2: 在 `setNodes(current => ...)` 内基于最新节点幂等判定旧尺寸迁移，仅在真实迁移后记录完成状态并触发 `scheduleSave`，避免缓存图片或 StrictMode 首次 load 读取滞后快照后永久跳过。
  - [x] SubTask 9.3: 修正旧尺寸判定，使 1472×542 图片对应的 520×190 旧媒体尺寸可迁移，同时避免已迁移的 540×242 外框再次扩张。
  - [x] SubTask 9.4: 增加真实 React Flow 节点形态回归测试，覆盖首次 load 读取滞后快照后第二次仍可迁移，以及显式尺寸覆盖旧 `measured` 并正确序列化，不依赖修改 `measured` 使 mock 通过。
  - [x] SubTask 9.5: 运行定向 Vitest、`npm run typecheck`、`npm run lint` 和 diff check，确认不勾选 Task 7、SubTask 7.3 或 checklist。

# Task Dependencies
- Task 4 依赖 Task 3（同为 dock/editor 改动，串行避免冲突）。
- Task 5 依赖 Task 1-4。
- Task 1、Task 2、Task 3 之间相互独立，可并行。
- Task 7 依赖 Task 6。
- Task 8 依赖 Task 6，并独立于尚未完成的 SubTask 7.3。
- Task 9 依赖 Task 8，并独立于尚未完成的 SubTask 7.3。
