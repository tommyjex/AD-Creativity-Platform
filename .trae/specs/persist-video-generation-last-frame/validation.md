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
