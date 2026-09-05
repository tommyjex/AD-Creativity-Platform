# AIGC 连通子图运行隔离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让同一 AIGC 画布中的不同连通子图可以并行运行，并使状态、结果和操作权限严格限制在各自流程范围内。

**Architecture:** 前后端分别实现语义一致的无向连通子图范围计算。后端在 Repository 原子事务内按 Run 范围交集判定冲突；前端从 Run 列表加载所有活动 Run 和每个流程的最近相关 Run，通过节点级 Resolver 向画布、检查器和操作按钮提供投影。

**Tech Stack:** Python 3.14、FastAPI、Pydantic、SQLAlchemy、pytest、React 19、Next.js 16、TypeScript、TanStack Query、Vitest、Playwright

---

## File Map

- Create `frontend/lib/aigc/run-scope.ts`: 前端连通子图、Run 范围和每节点 Run 选择的纯函数。
- Create `frontend/tests/aigc-run-scope.test.ts`: 前端范围与投影优先级单元测试。
- Create `frontend/scripts/verify-aigc-flow-run-isolation.mjs`: Playwright 多视口验收脚本。
- Modify `frontend/scripts/create-aigc-acceptance-fixture.mjs`: 创建两个断开流程的无生成任务验收画布。
- Modify `backend/app/services/aigc_dag.py`: 后端连通子图与 Run 范围纯函数。
- Modify `backend/app/repositories/memory.py`: 内存 Repository 的范围冲突和最新状态维护。
- Modify `backend/app/repositories/mysql.py`: MySQL 事务内的范围冲突和最新状态维护。
- Modify `backend/tests/test_aigc_dag.py`: 后端范围算法单元测试。
- Modify `backend/tests/test_aigc_repository.py`: 两种 Repository 的并行、冲突、幂等和最新状态契约测试。
- Modify `backend/tests/test_aigc_executor.py`: Runtime 多流程并行、取消和完成隔离测试。
- Modify `frontend/lib/aigc/queries.ts`: 批量 Run 详情查询与轮询。
- Modify `frontend/components/workspace/aigc/aigc-run-context.tsx`: 节点级 Run Resolver 和流程级 pending 接口。
- Modify `frontend/components/workspace/aigc/aigc-editor.tsx`: 多 Run 选择、局部执行、结果与检查器接入。
- Modify `frontend/components/workspace/aigc/aigc-flow-node.tsx`: 每个节点消费自身流程的 Run。
- Modify `frontend/components/workspace/aigc/aigc-prompt-editor.tsx`: 从节点级 Context 获取对应 Run。
- Modify `frontend/tests/aigc-editor.test.tsx`: 多流程编辑器状态和操作测试。
- Modify `frontend/tests/aigc-flow-node.test.tsx`: 节点级 Resolver 测试。
- Modify `frontend/tests/aigc-prompt-editor.test.tsx`: 提示词编辑器 Run 隔离测试。
- Modify `frontend/package.json`: 注册 Playwright 验收命令。

### Task 1: 后端连通子图范围算法

**Files:**
- Modify: `backend/app/services/aigc_dag.py`
- Test: `backend/tests/test_aigc_dag.py`

- [ ] **Step 1: 写入失败的连通子图测试**

在 `backend/tests/test_aigc_dag.py` 增加覆盖两条独立链、分支、孤立节点、`full`、`from_node`、`retry_node` 和非法起始节点的测试。测试核心断言如下：

```python
def test_aigc_run_scope_uses_undirected_connected_component() -> None:
    definition = disconnected_definition()

    assert aigc_run_scope_node_ids(
        definition,
        mode=AigcPipelineRunMode.FROM_NODE,
        start_node_id="flow-a-output",
    ) == frozenset({"flow-a-input", "flow-a-model", "flow-a-output"})
    assert aigc_run_scope_node_ids(
        definition,
        mode=AigcPipelineRunMode.RETRY_NODE,
        start_node_id="flow-b-model",
    ) == frozenset({"flow-b-input", "flow-b-model"})


def test_aigc_full_run_scope_contains_every_node() -> None:
    definition = disconnected_definition()
    assert aigc_run_scope_node_ids(
        definition,
        mode=AigcPipelineRunMode.FULL,
        start_node_id=None,
    ) == frozenset(node.id for node in definition.nodes)


def test_aigc_run_scope_rejects_missing_start_node() -> None:
    with pytest.raises(AigcDagValidationError) as error:
        aigc_run_scope_node_ids(
            disconnected_definition(),
            mode=AigcPipelineRunMode.FROM_NODE,
            start_node_id="missing",
        )
    assert error.value.code == "start_node_missing"
```

- [ ] **Step 2: 运行范围测试并确认失败**

Run:

```bash
cd backend
.venv/bin/pytest tests/test_aigc_dag.py -k "run_scope or connected_component" -q
```

Expected: FAIL，提示 `aigc_run_scope_node_ids` 尚不存在。

- [ ] **Step 3: 实现最小范围算法**

在 `backend/app/services/aigc_dag.py` 增加纯函数，统一先 canonicalize，再构建无向邻接表：

```python
def aigc_connected_node_ids(
    definition: AigcGraphDefinition,
    start_node_id: str,
) -> frozenset[str]:
    graph = _canonical_graph(definition)
    node_ids = {node.id for node in graph.nodes}
    if start_node_id not in node_ids:
        raise AigcDagValidationError(
            "start_node_missing",
            "AIGC run start node does not exist",
            node_id=start_node_id,
        )
    adjacency: dict[str, set[str]] = {node_id: set() for node_id in node_ids}
    for edge in graph.edges:
        adjacency[edge.source_node_id].add(edge.target_node_id)
        adjacency[edge.target_node_id].add(edge.source_node_id)
    visited = {start_node_id}
    pending = deque([start_node_id])
    while pending:
        current = pending.popleft()
        for neighbor in adjacency[current] - visited:
            visited.add(neighbor)
            pending.append(neighbor)
    return frozenset(visited)


def aigc_run_scope_node_ids(
    definition: AigcGraphDefinition,
    *,
    mode: AigcPipelineRunMode,
    start_node_id: str | None,
) -> frozenset[str]:
    graph = _canonical_graph(definition)
    if mode == AigcPipelineRunMode.FULL:
        return frozenset(node.id for node in graph.nodes)
    if start_node_id is None:
        raise AigcDagValidationError(
            "start_node_missing",
            "AIGC partial run requires a start node",
        )
    return aigc_connected_node_ids(graph, start_node_id)
```

- [ ] **Step 4: 运行后端范围测试**

Run:

```bash
cd backend
.venv/bin/pytest tests/test_aigc_dag.py -q
```

Expected: PASS。

- [ ] **Step 5: 提交范围算法**

```bash
git add backend/app/services/aigc_dag.py backend/tests/test_aigc_dag.py
git commit -m "feat(aigc): derive connected flow run scopes"
```

### Task 2: Repository 原子并发与最新状态

**Files:**
- Modify: `backend/app/repositories/memory.py`
- Modify: `backend/app/repositories/mysql.py`
- Test: `backend/tests/test_aigc_repository.py`

- [ ] **Step 1: 写入 Repository 契约失败测试**

使用现有 `aigc_repository` 参数化 fixture，为同一 Pipeline 创建两个断开的流程 Run：

```python
def test_disjoint_flow_runs_can_be_active_together(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_disconnected_pipeline(aigc_repository)
    flow_a = create_partial_run(
        aigc_repository, pipeline, "flow-a-model", "flow-a-request"
    )
    flow_b = create_partial_run(
        aigc_repository, pipeline, "flow-b-model", "flow-b-request"
    )
    assert flow_a.run.status == AigcPipelineRunStatus.QUEUED
    assert flow_b.run.status == AigcPipelineRunStatus.QUEUED


def test_overlapping_flow_run_is_rejected(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_disconnected_pipeline(aigc_repository)
    create_partial_run(
        aigc_repository, pipeline, "flow-a-model", "flow-a-request"
    )
    with pytest.raises(ActiveRunConflictError):
        create_partial_run(
            aigc_repository, pipeline, "flow-a-output", "flow-a-request-2"
        )


def test_older_run_completion_does_not_replace_latest_status(
    aigc_repository: AigcRepositoryContract,
) -> None:
    pipeline = create_disconnected_pipeline(aigc_repository)
    older = create_partial_run(
        aigc_repository, pipeline, "flow-a-model", "flow-a-request"
    )
    newer = create_partial_run(
        aigc_repository, pipeline, "flow-b-model", "flow-b-request"
    )
    aigc_repository.update_aigc_run(newer.run.id, status="running")
    aigc_repository.update_aigc_run(older.run.id, status="succeeded")
    assert (
        aigc_repository.get_aigc_pipeline(pipeline.id).latest_run_status
        == AigcPipelineRunStatus.RUNNING
    )
```

同时保留并扩展现有测试，断言活动 `full` Run 与任何局部 Run 相互冲突、相同幂等键仍返回原 Run。

- [ ] **Step 2: 运行 Repository 契约测试并确认失败**

Run:

```bash
cd backend
.venv/bin/pytest tests/test_aigc_repository.py \
  -k "disjoint_flow or overlapping_flow or older_run_completion or idempotency" -q
```

Expected: 不相交流程创建因现有 Pipeline 全局锁而 FAIL。

- [ ] **Step 3: 修改内存 Repository 的冲突判断**

在锁内计算 candidate 与所有活动 Run 的范围交集：

```python
candidate_scope = aigc_run_scope_node_ids(
    run.definition_snapshot,
    mode=run.mode,
    start_node_id=run.start_node_id,
)
for active in self._aigc_runs.values():
    if active.pipeline_id != run.pipeline_id:
        continue
    if active.status not in ACTIVE_AIGC_RUN_STATUSES:
        continue
    active_scope = aigc_run_scope_node_ids(
        active.definition_snapshot,
        mode=active.mode,
        start_node_id=active.start_node_id,
    )
    if candidate_scope & active_scope:
        raise ActiveRunConflictError(
            "AIGC flow already has an active run"
        )
```

将活动状态集合提取为 Repository 文件内常量，避免 Memory 与 MySQL 分支复制枚举字面量。

- [ ] **Step 4: 修改 MySQL Repository 的事务冲突判断**

保持现有 Pipeline `FOR UPDATE` 行锁，在同一事务内读取全部活动 Run 并逐个比较范围：

```python
active_runs = session.scalars(
    select(AigcPipelineRunORM).where(
        AigcPipelineRunORM.pipeline_id == run.pipeline_id,
        AigcPipelineRunORM.status.in_(ACTIVE_AIGC_RUN_STATUSES),
    )
).all()
candidate_scope = aigc_run_scope_node_ids(
    run.definition_snapshot,
    mode=run.mode,
    start_node_id=run.start_node_id,
)
if any(
    candidate_scope
    & aigc_run_scope_node_ids(
        self._aigc_run_from_orm(active).definition_snapshot,
        mode=active.mode,
        start_node_id=active.start_node_id,
    )
    for active in active_runs
):
    raise ActiveRunConflictError("AIGC flow already has an active run")
```

Pipeline 行锁必须覆盖幂等检查、范围冲突检查和 `run_number` 分配。

- [ ] **Step 5: 只允许最新 Run 更新 Pipeline 摘要**

Memory 与 MySQL 的 `update_aigc_run` 都先定位该 Pipeline 最大 `run_number` 的 Run：

```python
latest = max(
    (
        item
        for item in pipeline_runs
        if item.pipeline_id == updated.pipeline_id
    ),
    key=lambda item: item.run_number,
)
if latest.id == updated.id:
    pipeline.latest_run_status = updated.status
    pipeline.updated_at = updated.updated_at
```

MySQL 使用按 `run_number DESC LIMIT 1` 的查询完成同样判断。创建新 Run 时仍直接写入新 Run 的 queued 状态，因为其 `run_number` 必然最大。

- [ ] **Step 6: 运行 Repository 契约和并发测试**

Run:

```bash
cd backend
.venv/bin/pytest tests/test_aigc_repository.py -q
```

Expected: Memory 与 MySQL 参数化用例全部 PASS。

- [ ] **Step 7: 提交 Repository 隔离**

```bash
git add backend/app/repositories/memory.py backend/app/repositories/mysql.py backend/tests/test_aigc_repository.py
git commit -m "feat(aigc): isolate active runs by connected flow"
```

### Task 3: Runtime 多流程并行行为

**Files:**
- Modify: `backend/app/services/aigc_executor.py`
- Test: `backend/tests/test_aigc_executor.py`

- [ ] **Step 1: 写入两个流程同时执行的失败测试**

创建包含两个断开 LLM 流程的定义，并使用带 `asyncio.Event` 闸门的 Fake Gateway：

```python
class GatedLlmGateway(FakeGateway):
    def __init__(self) -> None:
        super().__init__()
        self.started: asyncio.Queue[str] = asyncio.Queue()
        self.release = asyncio.Event()

    async def execute(self, request):
        await self.started.put(request.node_id)
        await self.release.wait()
        return await super().execute(request)


async def test_disconnected_flows_run_and_cancel_independently() -> None:
    runtime = AigcPipelineRuntime(
        repository,
        gateway,
        worker_count=2,
        llm_concurrency=2,
    )
    await runtime.start()
    try:
        run_a = await runtime.submit_run(
            pipeline.id,
            from_node_request(pipeline, "flow-a-model"),
            idempotency_key="flow-a",
        )
        run_b = await runtime.submit_run(
            pipeline.id,
            from_node_request(pipeline, "flow-b-model"),
            idempotency_key="flow-b",
        )
        assert {await gateway.started.get(), await gateway.started.get()} == {
            "flow-a-model",
            "flow-b-model",
        }
        await runtime.cancel_run(run_a.run.id)
        gateway.release.set()
        await runtime.wait_until_idle()
        assert repository.get_aigc_run(run_a.run.id).run.status == "canceled"
        assert repository.get_aigc_run(run_b.run.id).run.status == "succeeded"
    finally:
        await runtime.stop()
```

- [ ] **Step 2: 运行 Runtime 测试并确认当前失败模式**

Run:

```bash
cd backend
.venv/bin/pytest tests/test_aigc_executor.py \
  -k "disconnected_flows_run_and_cancel_independently" -q
```

Expected: 第二个 Run 在 Repository 冲突修复前失败；Task 2 完成后进入并行执行并暴露任何 Runtime 全局状态问题。

- [ ] **Step 3: 移除 Runtime 中残留的 Pipeline 全局假设**

若测试显示 Runtime 内部仍按 Pipeline 串行，所有 worker、enqueue 和 cancellation 数据结构 SHALL 以 `run_id` 为键。保留队列与模态 semaphore，仅移除 Pipeline 级互斥。目标结构：

```python
self.queue: asyncio.Queue[str]  # value is run_id
self._enqueued: set[str]        # contains run_id
self._workers: list[asyncio.Task[None]]
```

取消逻辑只更新目标 `run_id` 的节点与 attempt，不遍历或取消同 Pipeline 的其他 Run。

- [ ] **Step 4: 增加同流程冲突和 full 冲突的 Runtime 测试**

```python
with pytest.raises(ActiveRunConflictError):
    await runtime.submit_run(
        pipeline.id,
        from_node_request(pipeline, "flow-a-output"),
        idempotency_key="same-flow",
    )

with pytest.raises(ActiveRunConflictError):
    await runtime.submit_run(
        pipeline.id,
        full_request(pipeline),
        idempotency_key="full-while-partial-active",
    )
```

- [ ] **Step 5: 运行后端相关测试**

Run:

```bash
cd backend
.venv/bin/pytest tests/test_aigc_dag.py tests/test_aigc_repository.py tests/test_aigc_executor.py -q
```

Expected: PASS。

- [ ] **Step 6: 提交 Runtime 并行支持**

```bash
git add backend/app/services/aigc_executor.py backend/tests/test_aigc_executor.py
git commit -m "test(aigc): verify disconnected flow concurrency"
```

### Task 4: 前端流程范围与 Run 选择纯函数

**Files:**
- Create: `frontend/lib/aigc/run-scope.ts`
- Create: `frontend/tests/aigc-run-scope.test.ts`

- [ ] **Step 1: 写入前端范围和优先级失败测试**

```typescript
it("maps each node to its own active run", () => {
  const projection = createAigcRunProjection(
    disconnectedDefinition,
    [
      activeFlowA.run,
      activeFlowB.run,
      latestFlowA.run,
      latestFlowB.run
    ],
    new Map([
      [activeFlowA.run.id, activeFlowA],
      [activeFlowB.run.id, activeFlowB],
      [latestFlowA.run.id, latestFlowA],
      [latestFlowB.run.id, latestFlowB]
    ]),
    null
  );

  expect(projection.activeRunForNode("flow-a-model")?.run.id)
    .toBe(activeFlowA.run.id);
  expect(projection.activeRunForNode("flow-b-model")?.run.id)
    .toBe(activeFlowB.run.id);
});

it("applies selected history only to its connected flow", () => {
  const projection = createAigcRunProjection(
    disconnectedDefinition,
    [latestFlowB.run, selectedFlowA.run],
    details,
    selectedFlowA.run.id
  );
  expect(projection.displayRunForNode("flow-a-model")?.run.id)
    .toBe(selectedFlowA.run.id);
  expect(projection.displayRunForNode("flow-b-model")?.run.id)
    .toBe(latestFlowB.run.id);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-run-scope.test.ts
```

Expected: FAIL，模块 `@/lib/aigc/run-scope` 不存在。

- [ ] **Step 3: 实现前端范围函数**

`frontend/lib/aigc/run-scope.ts` 导出以下稳定接口：

```typescript
export const ACTIVE_AIGC_RUN_STATUSES = new Set(["queued", "running"]);

export function getConnectedAigcNodeIds(
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2,
  startNodeId: string
): ReadonlySet<string>;

export function getAigcRunScopeNodeIds(
  run: AigcPipelineRun
): ReadonlySet<string>;

export interface AigcRunProjection {
  activeRunForNode(nodeId: string): AigcPipelineRunDetail | null;
  displayRunForNode(nodeId: string): AigcPipelineRunDetail | null;
  latestSuccessfulRunForNode(nodeId: string): AigcPipelineRunDetail | null;
  hasAnyActiveRun: boolean;
}
```

算法要求：

```typescript
function scopeContainsNode(run: AigcPipelineRun, nodeId: string): boolean {
  return getAigcRunScopeNodeIds(run).has(nodeId);
}

// active 控制操作权限；selected 只控制所属流程的历史展示；
// 其余节点回退到该流程最新终态详情。
```

- [ ] **Step 4: 实现需要加载的 Run ID 选择**

仅请求所有活动 Run、用户选择的 Run，以及当前定义每个流程最新相关终态 Run：

```typescript
export function selectAigcProjectionRunIds(
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2,
  runs: readonly AigcPipelineRun[],
  selectedRunId: string | null
): string[] {
  const ids = new Set<string>();
  for (const run of runs) {
    if (ACTIVE_AIGC_RUN_STATUSES.has(run.status)) ids.add(run.id);
  }
  if (selectedRunId) ids.add(selectedRunId);
  // 按 runs 的新到旧顺序，为每个当前连通子图选中首个相关终态 Run。
  return [...ids];
}
```

- [ ] **Step 5: 运行范围测试和静态检查**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-run-scope.test.ts
npm run typecheck
```

Expected: PASS。

- [ ] **Step 6: 提交前端范围模块**

```bash
git add frontend/lib/aigc/run-scope.ts frontend/tests/aigc-run-scope.test.ts
git commit -m "feat(aigc): resolve runs by connected flow"
```

### Task 5: 多 Run 查询与节点级 Context

**Files:**
- Modify: `frontend/lib/aigc/queries.ts`
- Modify: `frontend/components/workspace/aigc/aigc-run-context.tsx`
- Modify: `frontend/tests/aigc-flow-node.test.tsx`
- Modify: `frontend/tests/aigc-prompt-editor.test.tsx`

- [ ] **Step 1: 写入节点级 Context 失败测试**

调整测试 helper，使 Provider 接收 Resolver，并验证两个节点分别读取不同 Run：

```tsx
const projection = {
  activeRunForNode: (nodeId: string) =>
    nodeId.startsWith("flow-a") ? activeFlowA : null,
  displayRunForNode: (nodeId: string) =>
    nodeId.startsWith("flow-a") ? activeFlowA : latestFlowB,
  latestSuccessfulRunForNode: (nodeId: string) =>
    nodeId.startsWith("flow-a") ? successfulFlowA : latestFlowB,
  hasAnyActiveRun: true
};

render(
  <AigcRunProvider value={projection}>
    <AigcFlowNodeCard {...nodeProps(flowBNode)} />
  </AigcRunProvider>
);
expect(screen.queryByText("运行中")).toBeNull();
expect(screen.getByText("流程 B 结果")).toBeInTheDocument();
```

- [ ] **Step 2: 运行组件测试并确认类型或断言失败**

Run:

```bash
cd frontend
npm test -- --run \
  tests/aigc-flow-node.test.tsx \
  tests/aigc-prompt-editor.test.tsx
```

Expected: FAIL，因为 Context 仍是单个 `AigcPipelineRunDetail`。

- [ ] **Step 3: 增加批量详情查询 Hook**

在 `frontend/lib/aigc/queries.ts` 使用 TanStack `useQueries`：

```typescript
export function useAigcRunDetails(runIds: readonly string[]) {
  return useQueries({
    queries: runIds.map((runId) => ({
      queryFn: () => apiClient.getAigcRun(runId),
      queryKey: aigcQueryKeys.run(runId),
      refetchInterval: (query: { state: { data?: AigcPipelineRunDetail } }) =>
        aigcRunPollingInterval(query.state.data)
    })),
    combine: (results) =>
      new Map(
        results.flatMap((result) =>
          result.data ? [[result.data.run.id, result.data] as const] : []
        )
      )
  });
}
```

`useAigcRuns` 请求页大小调整到 `100`，保证常见多流程画布能从最新记录中找到每个流程的最近 Run。

- [ ] **Step 4: 将 Run Context 改为 Resolver**

```typescript
const AigcRunContext = createContext<AigcRunProjection | null>(null);

export function useAigcRunProjection(nodeId: string) {
  return useContext(AigcRunContext)?.displayRunForNode(nodeId) ?? null;
}

export function useAigcActiveRun(nodeId: string) {
  return useContext(AigcRunContext)?.activeRunForNode(nodeId) ?? null;
}

interface AigcRunActions {
  continueFromNode: (nodeId: string) => void;
  openLayerEditor: (href: string) => void;
  pendingForNode: (nodeId: string) => boolean;
}
```

Layer preview SHALL 通过 `latestSuccessfulRunForNode(nodeId)` 解析，不再使用单个全局 fallback Run。

- [ ] **Step 5: 更新 Flow Node 与 Prompt Editor 消费方式**

```typescript
const runDetail = useAigcRunProjection(id);
const activeRun = useAigcActiveRun(id);
const pending = runActions?.pendingForNode(id) ?? false;
```

`AigcPromptEditor` 使用其 `activeNode.id` 获取 Run；显式 prop 仅保留给独立测试或历史详情组件，不得回退到其他流程 Run。

- [ ] **Step 6: 运行组件测试**

Run:

```bash
cd frontend
npm test -- --run \
  tests/aigc-flow-node.test.tsx \
  tests/aigc-prompt-editor.test.tsx
npm run typecheck
```

Expected: PASS。

- [ ] **Step 7: 提交多 Run Context**

```bash
git add \
  frontend/lib/aigc/queries.ts \
  frontend/components/workspace/aigc/aigc-run-context.tsx \
  frontend/components/workspace/aigc/aigc-flow-node.tsx \
  frontend/components/workspace/aigc/aigc-prompt-editor.tsx \
  frontend/tests/aigc-flow-node.test.tsx \
  frontend/tests/aigc-prompt-editor.test.tsx
git commit -m "feat(aigc): provide node-scoped run projections"
```

### Task 6: 编辑器多流程执行、历史与结果隔离

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/tests/aigc-editor.test.tsx`

- [ ] **Step 1: 写入编辑器多流程失败测试**

构造两个断开流程和两个活动 Run，断言状态及局部按钮互不影响：

```typescript
it("keeps disconnected flow controls and results independent", async () => {
  apiMocks.listAigcRuns.mockResolvedValue({
    items: [activeFlowA.run, successfulFlowB.run],
    page: 1,
    page_size: 100,
    total: 2
  });
  apiMocks.getAigcRun.mockImplementation(async (runId: string) =>
    runId === activeFlowA.run.id ? activeFlowA : successfulFlowB
  );
  renderEditor(disconnectedPipeline, "pipeline");

  fireEvent.click(
    screen.getByRole("button", { name: "选择节点 flow-b-model" })
  );
  expect(
    await screen.findByRole("button", { name: "从此节点运行" })
  ).toBeEnabled();
  expect(screen.getByText("流程 B 结果")).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "选择节点 flow-a-model" })
  );
  expect(screen.getByRole("button", { name: "从此节点运行" }))
    .toBeDisabled();
});
```

增加以下断言：

- 测试中的 `NodeCanvas` mock 为每个节点渲染
  `aria-label="选择节点 ${node.id}"` 的按钮，并通过
  `reactFlowProps.onNodeClick` 选择对应节点。
- 两个活动 Run 都被轮询。
- 选择流程 A 历史 Run 不改变流程 B。
- 取消流程 A 只调用其 Run ID。
- 顶部执行全部在任一活动 Run 存在时禁用。
- 流程 A 的 create mutation pending 时流程 B 仍可提交。

- [ ] **Step 2: 运行编辑器测试并确认失败**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-editor.test.tsx \
  -t "disconnected flow|multiple active runs|history only"
```

Expected: FAIL，因为编辑器仍只有 `visibleRunId` 和单一 `runDetail`。

- [ ] **Step 3: 在编辑器组装多 Run Projection**

替换 `preferredRun/visibleRunId/runQuery` 的全局画布投影：

```typescript
const runs = runsQuery.data?.items ?? [];
const projectionRunIds = useMemo(
  () => selectAigcProjectionRunIds(definition, runs, selectedRunId),
  [definition, runs, selectedRunId]
);
const runDetails = useAigcRunDetails(projectionRunIds);
const runProjection = useMemo(
  () => createAigcRunProjection(
    definition,
    runs,
    runDetails,
    selectedRunId
  ),
  [definition, runs, runDetails, selectedRunId]
);
const selectedRunDetail =
  (selectedRunId && runDetails.get(selectedRunId)) ??
  runDetails.get(runs[0]?.id ?? "");
```

Run Panel 使用 `selectedRunDetail`；画布 Provider 使用 `runProjection`。

- [ ] **Step 4: 将局部 pending 状态按流程隔离**

使用起始节点集合记录正在提交的局部 Run：

```typescript
const [pendingRunStarts, setPendingRunStarts] = useState<Set<string>>(
  () => new Set()
);

function pendingForNode(nodeId: string): boolean {
  const nodeScope = getConnectedAigcNodeIds(definition, nodeId);
  return [...pendingRunStarts].some((startId) =>
    nodeScope.has(startId)
  );
}
```

`execute(startNodeId)` 的 guard：

```typescript
if (startNodeId) {
  if (
    runProjection.activeRunForNode(startNodeId) ||
    pendingForNode(startNodeId)
  ) return;
} else if (
  runProjection.hasAnyActiveRun ||
  pendingRunStarts.size > 0
) {
  return;
}
```

局部请求只在自身 scope 标记 pending；`finally` 精确移除对应 `startNodeId`。顶部 full 请求使用保留键 `__full__` 并阻塞所有局部提交。

- [ ] **Step 5: 绑定检查器、结果和操作到选中节点流程**

```typescript
const selectedNodeRunDetail = selectedNode
  ? runProjection.displayRunForNode(selectedNode.id) ?? undefined
  : selectedRunDetail;
const selectedNodeActiveRun = selectedNode
  ? runProjection.activeRunForNode(selectedNode.id)
  : null;
```

- `NodeConfig`、`ResultPanel` 使用 `selectedNodeRunDetail`。
- “从此节点运行”只检查 `selectedNodeActiveRun` 和 `pendingForNode(node.id)`。
- Run Panel 继续展示完整运行历史，但选择历史仅更新该 Run 所属流程。
- Cancel/Retry 始终传入面板中明确选择的 `run.id`。

- [ ] **Step 6: 运行编辑器与全部前端单元测试**

Run:

```bash
cd frontend
npm test -- --run tests/aigc-editor.test.tsx
npm test
npm run typecheck
npm run lint
```

Expected: 所有命令 PASS，ESLint 为 0 warnings。

- [ ] **Step 7: 提交编辑器隔离**

```bash
git add \
  frontend/components/workspace/aigc/aigc-editor.tsx \
  frontend/tests/aigc-editor.test.tsx
git commit -m "feat(aigc): isolate canvas run state by flow"
```

### Task 7: 回归、构建与多视口验收

**Files:**
- Create: `frontend/scripts/verify-aigc-flow-run-isolation.mjs`
- Modify: `frontend/scripts/create-aigc-acceptance-fixture.mjs`
- Modify: `frontend/package.json`
- Modify: `.trae/specs/isolate-aigc-connected-flow-runs/checklist.md`

- [ ] **Step 1: 扩展验收 Fixture**

为 `create-aigc-acceptance-fixture.mjs` 增加 `--flow-isolation`，创建两条不相连的 `text -> llm -> text` 流程，节点 ID 固定为：

```javascript
function textNode(id, x, y, text) {
  return {
    id,
    type: "text",
    position: { x, y },
    size: { width: 240, height: 160 },
    config: { bbox_references: [], text, title: null }
  };
}

function llmNode(id, x, y, title) {
  return {
    id,
    type: "llm",
    position: { x, y },
    size: { width: 260, height: 180 },
    config: {
      model: "doubao-seed-evolving",
      system_prompt: "",
      temperature: 0.7,
      title
    }
  };
}

function textEdge(sourceNodeId, targetNodeId, id) {
  return {
    id,
    sourceNodeId,
    sourceHandle: "text",
    targetNodeId,
    targetHandle: "text"
  };
}

const flowIsolationDefinition = {
  schemaVersion: 2,
  nodes: [
    textNode("flow-a-input", 40, 80, "流程 A 输入"),
    llmNode("flow-a-model", 340, 80, "流程 A 模型"),
    textNode("flow-a-output", 640, 80, "流程 A 输出"),
    textNode("flow-b-input", 40, 400, "流程 B 输入"),
    llmNode("flow-b-model", 340, 400, "流程 B 模型"),
    textNode("flow-b-output", 640, 400, "流程 B 输出")
  ],
  edges: [
    textEdge("flow-a-input", "flow-a-model", "flow-a-in"),
    textEdge("flow-a-model", "flow-a-output", "flow-a-out"),
    textEdge("flow-b-input", "flow-b-model", "flow-b-in"),
    textEdge("flow-b-model", "flow-b-output", "flow-b-out")
  ],
  viewport: { x: 0, y: 0, zoom: 0.85 }
};
```

Fixture 只创建 Pipeline，不提交模型任务，并输出包含 `pipelineUrl`、`pipelineId` 和 definition 的 JSON。

- [ ] **Step 2: 编写 Playwright 验收脚本**

脚本读取 fixture JSON，在浏览器侧拦截 Run 列表和详情请求。SSR 的 Pipeline 请求继续访问真实后端，Run 数据使用确定性响应：

```javascript
function getConnectedIds(definition, startNodeId) {
  const adjacency = new Map(
    definition.nodes.map((node) => [node.id, new Set()])
  );
  for (const edge of definition.edges) {
    adjacency.get(edge.sourceNodeId).add(edge.targetNodeId);
    adjacency.get(edge.targetNodeId).add(edge.sourceNodeId);
  }
  const visited = new Set([startNodeId]);
  const pending = [startNodeId];
  while (pending.length > 0) {
    const current = pending.shift();
    for (const neighbor of adjacency.get(current)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  return visited;
}

function runDetail({
  id,
  mode,
  resultNodeId = null,
  resultText = null,
  runningNodeId = null,
  startNodeId,
  status
}) {
  const now = "2026-09-05T14:00:00Z";
  const run = {
    id,
    pipeline_id: fixture.pipelineId,
    run_number: id.endsWith("-a") ? 2 : 1,
    pipeline_revision: fixture.pipeline.revision,
    mode,
    start_node_id: startNodeId,
    source_run_id: null,
    source_node_id: null,
    status,
    definition_snapshot: fixture.definition,
    input_snapshot: {},
    error: null,
    cancellation_requested: false,
    created_at: now,
    updated_at: now,
    started_at: now,
    finished_at: status === "running" ? null : now
  };
  const nodes = fixture.definition.nodes.map((node) => ({
    node_id: node.id,
    included_in_plan: getConnectedIds(
      fixture.definition,
      startNodeId
    ).has(node.id),
    status:
      node.id === runningNodeId
        ? "running"
        : node.id === resultNodeId
          ? "succeeded"
          : "idle",
    current_task_id: null,
    reused_from_task_id: null,
    input_hash: null,
    result: {
      kind: node.id === resultNodeId ? "text" : "none",
      text: node.id === resultNodeId ? resultText : null,
      text_digest: null,
      assets: []
    },
    error: null,
    attempts: []
  }));
  return { nodes, run };
}

const activeFlowA = runDetail({
  id: "acceptance-run-a",
  mode: "from_node",
  startNodeId: "flow-a-model",
  status: "running",
  runningNodeId: "flow-a-model"
});
const successfulFlowB = runDetail({
  id: "acceptance-run-b",
  mode: "from_node",
  startNodeId: "flow-b-model",
  status: "succeeded",
  resultNodeId: "flow-b-output",
  resultText: "流程 B 独立结果"
});

async function installFlowIsolationRoutes(page, pipelineId) {
  await page.route(
    `**/api/aigc/pipelines/${pipelineId}/runs?*`,
    (route) => route.fulfill({
      contentType: "application/json",
      json: {
        items: [activeFlowA.run, successfulFlowB.run],
        page: 1,
        page_size: 100,
        total: 2
      }
    })
  );
  await page.route("**/api/aigc/runs/*", (route) => {
    const detail = route.request().url().includes(activeFlowA.run.id)
      ? activeFlowA
      : successfulFlowB;
    return route.fulfill({ contentType: "application/json", json: detail });
  });
}

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await installFlowIsolationRoutes(page, fixture.pipelineId);
  await page.goto(fixture.pipelineUrl, { waitUntil: "domcontentloaded" });

  const flowA = page.locator(
    '.react-flow__node[data-id="flow-a-model"]'
  );
  const flowB = page.locator(
    '.react-flow__node[data-id="flow-b-model"]'
  );
  await flowA.click();
  await expect(page.getByRole("button", { name: "从此节点运行" }))
    .toBeDisabled();
  await flowB.click();
  await expect(page.getByRole("button", { name: "从此节点运行" }))
    .toBeEnabled();
  await page.getByRole("tab", { name: "结果" }).click();
  await expect(page.getByText("流程 B 独立结果")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  if (overflow || errors.length > 0) {
    throw new Error(JSON.stringify({ errors, overflow, viewport }));
  }
  await context.close();
}
```

`runDetail`、`textNode`、`llmNode` 和 `textEdge` 在各自脚本中定义为返回完整契约对象的本地 helper，不从生产代码复制状态判断逻辑。脚本同时检查按钮 bounding box 位于视口内且互不重叠。图片/视频媒体继续使用 `object-contain`，不得改变现有宽高比规则。

- [ ] **Step 3: 注册验收命令**

在 `frontend/package.json` scripts 增加：

```json
"acceptance:aigc-flow-isolation:fixture": "node scripts/create-aigc-acceptance-fixture.mjs --flow-isolation",
"acceptance:aigc-flow-isolation": "node scripts/verify-aigc-flow-run-isolation.mjs"
```

- [ ] **Step 4: 运行完整后端测试**

Run:

```bash
cd backend
.venv/bin/pytest -q
```

Expected: 全部 PASS。

- [ ] **Step 5: 运行完整前端质量门禁**

Run:

```bash
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 全部 PASS，构建完成且 ESLint 为 0 warnings。

- [ ] **Step 6: 启动服务并运行 Playwright**

Run:

```bash
cd backend
.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Run in another terminal:

```bash
cd frontend
npm run dev -- --hostname 127.0.0.1 --port 3000
AIGC_FLOW_ISOLATION_FIXTURE="$(
  npm run --silent acceptance:aigc-flow-isolation:fixture
)" npm run acceptance:aigc-flow-isolation
```

Expected: 三个视口全部通过，无页面异常、控制台错误、状态串扰或布局重叠。

- [ ] **Step 7: 核对并勾选验收清单**

逐项验证 `.trae/specs/isolate-aigc-connected-flow-runs/checklist.md`。任何失败项先追加修复任务，不得直接勾选。

- [ ] **Step 8: 提交验收资产**

```bash
git add \
  frontend/scripts/create-aigc-acceptance-fixture.mjs \
  frontend/scripts/verify-aigc-flow-run-isolation.mjs \
  frontend/package.json \
  .trae/specs/isolate-aigc-connected-flow-runs/checklist.md
git commit -m "test(aigc): verify connected flow run isolation"
```

## Task Dependencies

- Task 2 depends on Task 1.
- Task 3 depends on Task 2.
- Task 5 depends on Task 4.
- Task 6 depends on Tasks 3 and 5.
- Task 7 depends on all previous tasks.
- Tasks 1 and 4 can be implemented in parallel.

## Implementation Constraints

- 工作区已有大量未提交改动；每次提交只能暂存当前 Task 明确列出的文件。
- 不新增数据库列或迁移，不持久化 `flow_id`。
- 不改变 Pipeline 删除、资产删除和画布保存的现有活动 Run 安全约束。
- 不修改单流程内部缓存、失败传播、重试和模态并发限制。
- 不以“计划中执行节点集合”代替连通子图范围，否则同一流程的不同分支会被错误允许并行。
