# Tasks

- [x] Task 1: 统一资产库六列缩略图布局
  - [x] SubTask 1.1: 提取所有资产分区共用的响应式网格样式，按 `<640=1、640～1023=2、1024～1279=3、>=1280=6` 列实现
  - [x] SubTask 1.2: 使用统一 `PAGE_SIZE` 控制各资产分区分页容量
  - [x] SubTask 1.3: 保持图片/视频 `object-contain` 和既有点击放大预览，调整卡片文字与操作区避免六列布局溢出
  - [x] SubTask 1.4: 更新前端测试，覆盖分页、缩略图放大及响应式网格类名

- [x] Task 2: 增加通用资产重命名 API
  - [x] SubTask 2.1: 新增资产重命名请求 schema，校验 trim 后 1～120 个 Unicode code points 且不含 ASCII 控制字符
  - [x] SubTask 2.2: 新增 `PATCH /api/assets/{asset_id}`，只允许更新公开的项目、工具或 AIGC 独立资产，并返回经过现有访问 URL 装饰的 Asset
  - [x] SubTask 2.3: 合并 metadata 并写入 `name` 与 `name_scheme=user_defined_v1`，保留其他元数据、对象 key、归属和引用
  - [x] SubTask 2.4: 更新下载文件名逻辑，使用户名称与 AIGC 自动名称均保留合法 Unicode
  - [x] SubTask 2.5: 添加 Memory/MySQL Repository 与 API 测试，覆盖项目、工具、AIGC、404、422、内部资产拒绝和 metadata 保留

- [x] Task 3: 接入资产卡片重命名弹窗
  - [x] SubTask 3.1: 扩展 API client 与类型，调用通用资产重命名接口
  - [x] SubTask 3.2: 在独立资产卡片增加带 tooltip/aria-label 的铅笔图标，并与删除按钮保持独立稳定布局
  - [x] SubTask 3.3: 实现重命名 Dialog，预填当前名称，提供一致校验、提交中状态、错误反馈和取消
  - [x] SubTask 3.4: 保存成功后用返回 Asset 更新本地列表，使卡片、搜索、预览与下载立即使用新名称
  - [x] SubTask 3.5: 派生尾帧不显示重命名入口且固定显示“尾帧图”；搜索可匹配宿主新名称，宿主分镜视频仍可重命名

- [x] Task 4: 完成回归与多视口验收
  - [x] SubTask 4.1: 运行后端相关测试和完整 pytest
  - [x] SubTask 4.2: 运行前端完整 Vitest、TypeScript、ESLint 和 production build
  - [x] SubTask 4.3: 使用确定性资产 fixture 验证六列网格、4+2 问题修复、点击放大、重命名成功/失败和刷新持久化
  - [x] SubTask 4.4: 在 1440x1000、1280x800、1024x768、390x844 视口检查布局、弹窗、文字、按钮与媒体比例
  - [x] SubTask 4.5: 验证无控制台错误、横向溢出、控件重叠或其他资产库回归

- [x] Task 5: 对齐名称控制字符验收边界
  - [x] SubTask 5.1: 将 checklist 的控制字符表述对齐批准规格中的 ASCII U+0000～U+001F 与 U+007F
  - [x] SubTask 5.2: 确认前后端测试覆盖 ASCII 控制字符拒绝，不将 C1 U+0080～U+009F 扩入本期范围

- [x] Task 6: 禁用无效名称的保存操作
  - [x] SubTask 6.1: 空白、超过 120 个 Unicode code points 或包含 ASCII 控制字符时禁用保存按钮
  - [x] SubTask 6.2: 补充弹窗测试并重新执行四视口浏览器验收

- [x] Task 7: 将资产库分页容量调整为五行
  - [x] SubTask 7.1: 将每个资产分区的 `PAGE_SIZE` 从 6 调整为 30
  - [x] SubTask 7.2: 更新测试，覆盖 30 项不分页和 32 项按 30+2 分页
  - [x] SubTask 7.3: 验证宽屏每行 6 项、一页 5 行，窄屏保持响应式且无溢出

# Task Dependencies

- Task 3 depends on Task 2.
- Task 4 depends on Tasks 1-3.
- Task 5 depends on Task 2 and Task 3.
- Task 6 depends on Task 3.
- Task 7 depends on Task 1.
- Tasks 1 and 2 can be implemented in parallel.
