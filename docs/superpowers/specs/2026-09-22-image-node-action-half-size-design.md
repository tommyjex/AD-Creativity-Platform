# 图片节点精准编辑按钮二次缩小设计

## 背景

图片节点右上角的精准编辑按钮当前使用 `24px` 外圈、`20px` 按钮和 `12px` 图标。根据画布实际显示效果，按钮仍然偏大，需要在现有基础上整体缩小为二分之一。

## 已确认尺寸

- 外置圆形容器：`24px → 12px`
- 内部按钮：`20px → 10px`
- `ScanSearch` 图标：`12px → 6px`

使用 Tailwind 任意值类表达精确尺寸，避免受默认间距刻度限制：

- 外圈：`h-[12px] w-[12px]`
- 按钮：`h-[10px] w-[10px]`
- 图标：`h-[6px] w-[6px]`

## 行为保持

- 继续位于图片节点右上角外侧。
- 右边缘继续与图片卡片右边缘对齐。
- 保留圆形边框、背景和阴影。
- 保留 `aria-label`、Tooltip、禁用态和精准编辑弹窗行为。
- 保留 `nodrag`、点击阻止冒泡和指针按下阻止冒泡。
- 不修改图片节点端口、缩放控点、预览区或拖拽逻辑。
- `AigcPreciseEditDialog` 的默认触发器尺寸保持不变，仅紧凑触发器继续缩小。

## 修改范围

- `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- `frontend/components/workspace/aigc/aigc-precise-edit-dialog.tsx`
- 相关 Vitest 尺寸断言
- `frontend/scripts/verify-aigc-modality-node-titles.py` 中的实际 CSS 尺寸断言

## 验收标准

- 图片节点外置操作容器计算尺寸精确为 `12 × 12px`。
- 精准编辑按钮计算尺寸精确为 `10 × 10px`。
- `ScanSearch` 图标计算尺寸精确为 `6 × 6px`。
- 按钮仍可点击并打开精准编辑弹窗。
- 按钮不遮挡端口、连线、卡片或缩放控点。
- 桌面、平板和手机视口截图无重叠或裁切。
- 相关 Vitest、完整 Vitest、TypeScript、ESLint 和三视口 Playwright 验收全部通过。
