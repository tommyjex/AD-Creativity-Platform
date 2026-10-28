# 实施与验收记录

实现完成，未提交或部署。保留实施前 `modelark.py` 的既有导入调整。

## 行为

- 共享 Seedance 请求显式发送 `return_last_frame=true`，解析并传递非空尾帧 URL。
- AIGC 视频生成在视频主资产之后创建独立公共尾帧图片，通过解码内容识别 PNG、JPEG、WebP 及实际尺寸和扩展名。
- 输出关系为 `video:0` 和 `last_frame:0`，结果 ordinal 为 `0` 和 `1`。视频端口投影与摘要只包含视频。
- 双仓储原子提交角色命名与结果元数据；下载遵循当前视频显示节点名称、冻结名称和用户显式名称的优先级。
- 尾帧失败时保留视频，清理尾帧对象、登记和输出关系，只记录脱敏错误类型。结构化日志沿用集中 TLS 路由。
- 视频执行版本为 `aigc-video-v3`。旧视频结果仍可查看，新缓存不能复用旧版本结果。
- 资产库支持专用类型标签、图片分类、搜索和受控下载；独立尾帧不派生旧式虚拟卡片。
- 预览弹窗采用独立媒体区和可滚动详情区，图片使用绝对定位与 `object-contain`。

## 自动化证据

- 后端：534 项测试通过，覆盖 ModelArk、网关、双仓储、执行器、命名、存储、工具和资产重命名。
- 新增尾帧测试覆盖实际格式、AI 成功与失败命名、节点改名、Unicode、显式资产重命名、缺失 URL、下载/解码/上传/登记失败、部分写入、取消、晚到结果及双资产清理。
- 缓存回归确认复用视频和尾帧两个资产，下游视频节点只获得视频。
- 前端：4 个定向测试文件，共 78 项通过；TypeScript、ESLint 和 production build 通过。
- Ruff `E9,F63,F7,F82`、`compileall` 和 `git diff --check` 通过。
- Playwright：`1440x900`、`834x1112`、`390x844` 均通过，验证分类、类型标签、搜索、完整比例预览、下载文件名和下载按钮可点击；页面无水平溢出。
- 浏览器报告与截图：`frontend/test-results/video-last-frame/`。

## 复现

后端命令：

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/test_video_last_frame.py backend/tests/test_modelark.py backend/tests/test_aigc_gateway.py backend/tests/test_aigc_executor.py backend/tests/test_aigc_repository.py backend/tests/test_aigc_asset_naming.py backend/tests/test_assets.py backend/tests/test_tool_assets.py backend/tests/test_asset_rename.py -q
.venv/bin/ruff check backend/app backend/tests/test_video_last_frame.py backend/mock_video_last_frame_acceptance_app.py --select E9,F63,F7,F82
.venv/bin/python -m compileall -q backend/app
git diff --check
```

前端命令（在 `frontend` 下）：

```bash
npm run test -- tests/asset-display.test.ts tests/aigc-download.test.ts tests/workspace-asset-library.test.tsx tests/workspace-assets-page.test.tsx
npm run typecheck
npm run lint
npm run build
```

浏览器 fixture：`backend/mock_video_last_frame_acceptance_app.py`（端口 `8040`），使用本地对象接口经真实资产内容代理提供图片。前端端口 `3040`，设置 `BACKEND_INTERNAL_BASE_URL=http://127.0.0.1:8040`、空 `NEXT_PUBLIC_BACKEND_BASE_URL`，再运行 `.venv/bin/python frontend/scripts/verify-video-last-frame.py`。

浏览器 fixture 显式关闭 TLS 外部发送，并替换 Provider 和对象存储；验证命名调用一次，不调用真实生成、命名或 TOS 服务。以上为 Mock 集成验收，未执行生产生成或真实云存储验收。

## Task 6/7 增量验证

- 修复 `ResultPanel` 只识别 schema v2 Run snapshot 的缺陷，统一通过 `migrateAigcRunSnapshotV2` 分类 schema v1/v2 视频生成节点。
- 修正新增测试中的无效 Radix 遮罩事件模拟、下游标题假设和 TypeScript 空值收窄；真实遮罩关闭由 Playwright 覆盖。
- 为通过 Next 16 路由类型检查，将既有页面导出 `parseAigcView` 移至 `lib/aigc/workspace-view.ts`，行为及测试不变。
- 定向首轮 `npm run test -- tests/aigc-editor.test.tsx` 暴露缺陷后，修复复跑为 93/93。
- 最终相关回归：

```bash
npm run test -- tests/aigc-editor.test.tsx tests/aigc-download.test.ts tests/aigc-result-projection.test.ts tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx tests/aigc-acceptance.test.tsx tests/aigc-workspace.test.tsx
# 7 files passed, 190 tests passed
npm run typecheck
# passed
npm run lint
# passed, 0 warnings
npm run build
# passed; compile, TypeScript, 13/13 static pages
```

- 浏览器命令：

```bash
NEXT_DIST_DIR=.next-task67 npm run dev -- --hostname 127.0.0.1 --port 3041
AIGC_ACCEPTANCE_URL=http://127.0.0.1:3041 node scripts/verify-aigc-video-last-frame-result.mjs
```

- Playwright 结果：`1440x900`、`834x1112`、`390x844` 共 3/3 通过，`providerCalls=0`。资产数组以尾帧在前的逆序返回，仍按 `name_variant=video_last_frame` 与图片 MIME 分类；验证视频在前、尾帧在后、明确角色标题、固定 `object-contain` 媒体区、缩略图/按钮打开 Dialog、关闭按钮/Escape/遮罩关闭后上下文保持、结果区和 Dialog 两处下载链接及受控端点响应、长 Unicode 文件名与 `Content-Disposition` 一致、下游无重复尾帧、无操作重叠或水平溢出。
- 确定性 fixture 仅拦截本地认证、Run 和受控资产内容端点；未调用 Provider、命名、真实 TOS 或其他外部 API。报告和截图位于 `frontend/test-results/video-last-frame-result/`。
