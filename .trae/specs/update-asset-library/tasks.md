# Tasks

- [x] Task 1: 扩展资产展示层的分区与产物聚合基础设施
  - [x] SubTask 1.1: 在 [asset-display.ts](file:///Users/bytedance/AD-Creativity/frontend/lib/asset-display.ts) 中新增分区枚举/常量（`character` / `scene` / `product` / `artifacts`）及分区中文标签
  - [x] SubTask 1.2: 新增“产物子类型”标签（分镜视频片段 / 尾帧图 / 视频编辑结果），以及从 `Asset[]` 派生尾帧图虚拟卡片的辅助函数（依据 `metadata.last_frame_status === "available"`，预览取自既有 `getSafeLastFrameUrl`）
  - [x] SubTask 1.3: 新增“产物归类”辅助：按 `asset.type`（`storyboard_video` / `final_video`）判定资产归入产物分区

- [x] Task 2: 资产库四分区重构（依赖 Task 1）
  - [x] SubTask 2.1: 在 [workspace-asset-library.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/workspace/workspace-asset-library.tsx) 中移除 `assets.filter((a) => a.category !== null)` 的无条件过滤，改为四分区聚合（角色 / 场景 / 商品 / 产物）
  - [x] SubTask 2.2: 产物分区渲染分镜视频片段、视频编辑结果卡片，并渲染派生的尾帧图卡片
  - [x] SubTask 2.3: 商品分区渲染空态占位（“商品资产上传能力即将开放”），不报错
  - [x] SubTask 2.4: 更新顶部“资产类型”筛选下拉为四选项；解析层 [assets/page.tsx](file:///Users/bytedance/AD-Creativity/frontend/app/workspace/assets/page.tsx) 中将 `product` / `artifacts` 作为前端聚合分区处理，不透传后端 `category`

- [x] Task 3: 资产删除交互（依赖 Task 2）
  - [x] SubTask 3.1: 拆出承载交互的 client component（`"use client"`），维护本地资产列表状态与删除中状态
  - [x] SubTask 3.2: 卡片新增删除入口（图标按钮），点击弹出二次确认弹窗（复用 [dialog.tsx](file:///Users/bytedance/AD-Creativity/frontend/components/ui/dialog.tsx)）
  - [x] SubTask 3.3: 确认后调用 `apiClient.deleteAsset(project_id, asset_id)`，成功后从列表移除；失败展示错误反馈
  - [x] SubTask 3.4: 尾帧图派生卡片删除时，确认弹窗提示“将同时删除对应分镜视频片段”，删除其宿主 `storyboard_video` 资产

- [x] Task 4: 分页展示（依赖 Task 2）
  - [x] SubTask 4.1: 为各分区实现客户端分页（每页固定条数阈值 `PAGE_SIZE=6`），超阈值时渲染翻页控制，未超阈值不渲染
  - [x] SubTask 4.2: 删除后重算分页边界（读时 clamp 页码，避免删空当前页后停留在空页）

- [x] Task 5: 同步测试与验证（依赖 Task 2/3/4）
  - [x] SubTask 5.1: 更新 [workspace-asset-library.test.tsx](file:///Users/bytedance/AD-Creativity/frontend/tests/workspace-asset-library.test.tsx)：新增四分区渲染、产物（分镜视频/尾帧图/成片）展示、商品空态断言
  - [x] SubTask 5.2: 新增删除交互（确认/取消、尾帧图删除宿主提示）与分页行为断言
  - [x] SubTask 5.3: 运行 `npm test`、`npm run typecheck`、`npm run lint` 全部通过

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 2
- Task 5 依赖 Task 2、Task 3、Task 4
