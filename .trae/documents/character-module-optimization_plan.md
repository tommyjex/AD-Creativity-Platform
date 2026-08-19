# 角色模块优化计划

## 需求分析

1. **角色卡片缩小**：当前卡片为 `sm:grid-cols-2`（一行2个），卡片图片为 `aspect-square`（正方形），整体偏大。需改为一行4个，缩小卡片尺寸。
2. **图片点击放大**：点击角色图片弹出灯箱（Lightbox）大图预览。
3. **描述旁加编辑按钮**：当前角色描述（`description` 字段，即"角色提示词"）仅支持双击编辑，需在描述文字旁增加一个可见的编辑图标按钮。

## 代码研究结论

- 角色卡片渲染逻辑位于 [project-detail-tabs.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/project-detail-tabs.tsx) 的 `CharacterSection` 组件中（约 L1092–L1257）。
- 网格布局：`<div className="grid gap-5 sm:grid-cols-2">`（L1106）。
- 图片区域：`aspect-square` 容器 + `<img>`（L1128–L1158）。
- 描述编辑已通过 `beginEdit(card, "description")` + `InlineCharacterEdit` 实现双击编辑（L1220–L1241）。
- 已有 `PencilLine` 图标导入（L10）但未被使用，可直接用于编辑按钮。
- 已有 [Dialog](file:///Users/bytedance/AD-Creativity/frontend/components/ui/dialog.tsx) 组件（基于 `@radix-ui/react-dialog`），可复用来实现图片灯箱。
- 数据模型 `CharacterCard` 仅有 `name` 和 `description` 字段，"角色提示词"即 `description`。

## 修改文件

仅修改一个文件：

- [project-detail-tabs.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/project-detail-tabs.tsx)

## 实施步骤

### 步骤1：缩小卡片网格布局

将 L1106 的网格从 `sm:grid-cols-2` 改为响应式4列：

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
```

同时适当缩减卡片内边距和间距：
- 卡片内容区 `p-5` → `p-4`
- 网格间距 `gap-5` → `gap-4`
- 描述文字在小卡片中限制行数（`line-clamp-3`），保持卡片高度一致

### 步骤2：实现图片点击放大（灯箱）

1. 在文件顶部引入 Dialog 相关组件：
   ```tsx
   import {
     Dialog,
     DialogContent,
     DialogTitle
   } from "@/components/ui/dialog";
   ```
2. 在 `CharacterSection` 组件中新增状态：
   ```tsx
   const [previewImage, setPreviewImage] = useState<{
     url: string;
     name: string;
   } | null>(null);
   ```
3. 在图片 `<img>` 外层包裹可点击元素，添加 `cursor-zoom-in` 和点击事件：
   ```tsx
   <button
     type="button"
     className="block h-full w-full cursor-zoom-in"
     onClick={() => setPreviewImage({ url: previewUrl, name: card.name })}
   >
     <img ... />
   </button>
   ```
4. 在网格 `</div>` 之后添加灯箱 Dialog：
   ```tsx
   <Dialog open={previewImage !== null} onOpenChange={() => setPreviewImage(null)}>
     <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
       <DialogTitle className="sr-only">{previewImage?.name} 角色预览</DialogTitle>
       {/* eslint-disable-next-line @next/next/no-img-element */}
       <img
         src={previewImage?.url}
         alt={previewImage ? `${previewImage.name}角色设定` : ""}
         className="max-h-[85vh] w-full rounded-2xl object-contain"
       />
     </DialogContent>
   </Dialog>
   ```

### 步骤3：描述旁加编辑按钮

在描述区域（L1220–L1241），当非编辑态时，将描述文字与一个小图标按钮并排显示：

```tsx
<div className="mt-3 flex items-start gap-2">
  <p
    className="cursor-text flex-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground line-clamp-3"
    onDoubleClick={() => beginEdit(card, "description")}
    title="双击编辑角色描述"
  >
    {card.description}
  </p>
  {!isEditingDescription ? (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      onClick={() => beginEdit(card, "description")}
      disabled={isGenerating || isDeleting || isSaving}
      aria-label="编辑角色描述"
      title="编辑角色描述"
    >
      <PencilLine className="h-3.5 w-3.5" />
    </Button>
  ) : null}
</div>
```

## 注意事项

- `PencilLine` 图标已在 imports 中（L10），无需新增导入。
- 保持双击编辑功能不变（向后兼容）。
- 卡片缩小时，描述文字可能较长，使用 `line-clamp-3` 限制显示行数，避免卡片高度参差。
- 图片灯箱复用现有 Dialog 组件，不引入新依赖。
- 按钮区域（重新生成/删除）在小卡片中可能需要调整为图标按钮以节省空间，但根据"最小改动"原则，保留文字按钮，让其自动换行。

## 风险与回退

- **风险低**：所有改动集中在单文件，布局调整和功能新增互不依赖。
- **回退方式**：通过 git revert 该文件的单次提交即可完全恢复。
- **测试影响**：现有测试通过 `getByRole("heading", { name: ... })`、`getByRole("img")`、`getByRole("button", { name: "重新生成" })` 等定位元素，改动不影响这些选择器。新增的图片按钮和编辑按钮均有 `aria-label`，不会破坏现有断言。
