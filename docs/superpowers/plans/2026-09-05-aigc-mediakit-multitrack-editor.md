# AIGC MediaKit 多轨剪辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AIGC DAG 中提供可执行的 MediaKit 多轨剪辑节点，以及支持基础非线性编辑的全屏时间线编辑器。

**Architecture:** Pipeline v2 节点配置保存稳定、可校验的剪辑工程；执行器从当前 Run 解析直接上游素材并构造 MediaKit `track[][]`。全屏编辑器复用 Pipeline revision 保存机制，浏览器提供结构预览，最终输出由异步 MediaKit 任务生成并流式转存。

**Tech Stack:** FastAPI、Pydantic、SQLAlchemy、httpx、React 19、Next.js 16、Zustand、React Flow、Vitest、Playwright。

---

### Task 1: 契约与校验

**Files:**
- Create: `frontend/lib/aigc/multitrack.ts`
- Create: `frontend/tests/aigc-multitrack.test.ts`
- Modify: `frontend/lib/aigc/types.ts`
- Modify: `frontend/lib/aigc/node-registry.ts`
- Modify: `backend/app/schemas/aigc.py`
- Modify: `backend/tests/test_aigc_contracts.py`

- [ ] 先添加节点、轨道、元素、滤镜和校验边界的失败测试。
- [ ] 定义 `multi_track_edit`、四类多值输入和视频输出。
- [ ] 实现前后端等价的工程规范化与执行级校验。
- [ ] 运行：

```bash
.venv/bin/python -m pytest backend/tests/test_aigc_contracts.py -q
cd frontend && npm test -- --run tests/aigc-multitrack.test.ts
```

### Task 2: MediaKit 客户端

**Files:**
- Create: `backend/app/services/mediakit_multitrack.py`
- Create: `backend/tests/test_mediakit_multitrack.py`
- Modify: `backend/app/core/config.py`
- Modify: `.env.example`

- [ ] 添加 payload、幂等、轮询、失败、超时和脱敏失败测试。
- [ ] 实现 `MediaKitMultiTrackClient.submit/get_task/poll`。
- [ ] 只发送 `canvas / track / output / client_token`。
- [ ] 运行：

```bash
.venv/bin/python -m pytest backend/tests/test_mediakit_multitrack.py backend/tests/test_config.py -q
```

### Task 3: DAG 与执行器

**Files:**
- Modify: `backend/app/services/aigc_dag.py`
- Modify: `backend/app/services/aigc_executor.py`
- Modify: `backend/app/services/aigc_gateway.py`
- Modify: `backend/app/api/dependencies.py`
- Modify: `backend/tests/test_aigc_dag.py`
- Modify: `backend/tests/test_aigc_executor.py`
- Modify: `backend/tests/test_aigc_gateway.py`

- [ ] 添加四类多输入、来源绑定、快照、Hash 和失败传播测试。
- [ ] 将工程来源解析为当前 Run 文本/资产和受控 URL。
- [ ] 接入独立并发、缓存、重试、取消和租约。
- [ ] 运行：

```bash
.venv/bin/python -m pytest backend/tests/test_aigc_dag.py backend/tests/test_aigc_executor.py backend/tests/test_aigc_gateway.py -q
```

### Task 4: 结果转存与追溯

**Files:**
- Modify: `backend/app/services/assets.py`
- Modify: `backend/app/repositories/sqlalchemy.py`
- Create: `backend/tests/test_asset_multitrack_storage.py`

- [ ] 添加成功、URL 过期、类型、大小、下载、存储和事务回滚测试。
- [ ] 复用流式视频转存并登记输出及所有输入关系。
- [ ] 保存白名单元数据，清理部分对象和资产。
- [ ] 运行：

```bash
.venv/bin/python -m pytest backend/tests/test_asset_multitrack_storage.py backend/tests/test_aigc_gateway.py -q
```

### Task 5: 节点、路由与数据加载

**Files:**
- Create: `frontend/app/workspace/aigc/pipelines/[pipelineId]/nodes/[nodeId]/timeline/page.tsx`
- Create: `frontend/app/workspace/aigc/pipelines/[pipelineId]/nodes/[nodeId]/timeline/loading.tsx`
- Create: `frontend/lib/aigc/multitrack-editor-loader.ts`
- Modify: `frontend/components/layout/app-shell.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/lib/aigc/editor-store.ts`

- [ ] 添加节点创建、连线、卡片摘要、全屏 Shell 和 loader 失败测试。
- [ ] 实现节点入口和 revision 安全加载/保存/执行。
- [ ] 运行：

```bash
cd frontend && npm test -- --run tests/aigc-editor.test.tsx tests/app-shell.test.tsx
```

### Task 6: 时间线状态模型

**Files:**
- Create: `frontend/lib/aigc/multitrack-editor-store.ts`
- Create: `frontend/tests/aigc-multitrack-editor-store.test.ts`

- [ ] 添加轨道、片段、拖拽、裁切、分割、吸附和撤销重做失败测试。
- [ ] 实现纯 reducer 和校验派生状态。
- [ ] 保证时间值规范化为整数毫秒且无隐藏自动修复。
- [ ] 运行：

```bash
cd frontend && npm test -- --run tests/aigc-multitrack-editor-store.test.ts
```

### Task 7: 全屏编辑器 UI

**Files:**
- Create: `frontend/components/workspace/aigc/aigc-multitrack-editor.tsx`
- Create: `frontend/components/workspace/aigc/aigc-multitrack-preview.tsx`
- Create: `frontend/components/workspace/aigc/aigc-multitrack-timeline.tsx`
- Create: `frontend/components/workspace/aigc/aigc-multitrack-inspector.tsx`
- Create: `frontend/tests/aigc-multitrack-editor.test.tsx`

- [ ] 添加顶栏、预览、时间线、检查器和响应式失败测试。
- [ ] 实现轨道与片段交互、基础效果控件和 SRT 上传。
- [ ] 实现 `1023px` 抽屉及 `390px` 可用布局。
- [ ] 运行：

```bash
cd frontend && npm test -- --run tests/aigc-multitrack-editor.test.tsx
```

### Task 8: 结果、模板与验收

**Files:**
- Modify: `frontend/lib/aigc/result-projection.ts`
- Modify: `frontend/components/workspace/aigc/aigc-run-log.tsx`
- Modify: `backend/app/services/aigc_pipeline.py`
- Modify: `frontend/scripts/create-aigc-acceptance-fixture.mjs`
- Modify: relevant backend/frontend tests

- [ ] 添加结果播放、日志、模板字幕清理和历史 Run 测试。
- [ ] 更新 Mock acceptance fixture，禁止真实 MediaKit 网络请求。
- [ ] 运行完整工程门禁：

```bash
.venv/bin/python -m pytest backend/tests -q
cd frontend && npm test -- --run
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [ ] 使用 Playwright 验证 `1440x900`、`1023x768`、`390x844`。
