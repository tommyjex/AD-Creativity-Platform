# AIGC 分支运行隔离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许共享上游的独立下游分支并行运行，并保证兄弟分支的历史成功结果不会被后发 Run 清空。

**Architecture:** 将旧的单一无向连通范围拆为两个有向范围。Repository 使用“起始节点及全部下游”的冲突范围；前端状态、结果和局部预检使用“下游范围加必要上游”的投影范围。历史 Run 继续从快照计算范围，不新增数据库字段。

**Tech Stack:** Python 3.14、FastAPI、Pydantic v2、SQLAlchemy、pytest、React 19、Next.js 16、TypeScript、TanStack Query、Vitest、Playwright

---

## File Map

- Modify `backend/app/aigc_run_scope.py`: 提供下游范围、投影范围及 Run 范围入口。
- Modify `backend/app/services/aigc_dag.py`: 将局部计划验证限制到投影范围。
- Modify `backend/app/services/aigc_executor.py`: 在提交与哈希计算中传递投影范围。
- Modify `backend/app/repositories/memory.py`: 使用冲突范围执行原子活动 Run 检查。
- Modify `backend/app/repositories/mysql.py`: 在 Pipeline 行锁事务中使用冲突范围。
- Modify `backend/tests/test_aigc_dag.py`: 覆盖共享上游的双范围算法。
- Modify `backend/tests/test_aigc_repository.py`: 覆盖共享上游无缓存并行与相交冲突。
- Modify `backend/tests/test_aigc_executor.py`: 覆盖两个兄弟分支并行、失败和取消隔离。
- Modify `frontend/lib/aigc/run-scope.ts`: 实现前端双范围和逐节点 Run 详情选择。
- Modify `frontend/components/workspace/aigc/aigc-editor.tsx`: 使用冲突范围处理 pending，使用投影范围处理预检。
- Modify `frontend/tests/aigc-run-scope.test.ts`: 覆盖逐节点投影和历史 Run 兼容。
- Modify `frontend/tests/aigc-editor.test.tsx`: 覆盖兄弟结果保留及并行提交。
- Modify `frontend/scripts/create-aigc-acceptance-fixture.mjs`: 增加共享 JSON Parser 的三生图分支 Fixture。
- Modify `frontend/scripts/verify-aigc-flow-run-isolation.mjs`: 验证并行、成功结果保留和失败隔离。

## Task 1: 后端有向双范围

**Files:**
- Modify: `backend/app/aigc_run_scope.py`
- Modify: `backend/app/services/aigc_dag.py`
- Test: `backend/tests/test_aigc_dag.py`

- [x] **Step 1: 写入失败的范围测试**
  - 构造 `root -> parser -> branch-a/branch-b -> output-a/output-b`。
  - 断言从 `branch-a` 开始时：
    - conflict scope 为 `{branch-a, output-a}`；
    - projection scope 为 `{root, parser, branch-a, output-a}`；
    - 两个范围均不含 branch B。
  - 断言从 `parser` 开始时 conflict scope 包含两个分支。
  - 断言 `full` 的两个范围均包含全部节点。
  - 断言非法起始节点和局部 Run 缺失起始节点均抛出 `start_node_missing`。

- [x] **Step 2: 运行范围测试并确认旧语义失败**

```bash
.venv/bin/python -m pytest backend/tests/test_aigc_dag.py -q
```

Expected: 共享上游兄弟分支测试因旧无向连通范围包含 branch B 而失败。

- [x] **Step 3: 实现范围纯函数**
  - 新增 `aigc_downstream_node_ids(definition, start_node_id)`：沿 source -> target 遍历。
  - 新增 `aigc_projection_node_ids(definition, start_node_id)`：先求下游闭包，再递归加入闭包中所有节点的上游依赖。
  - 新增 `aigc_run_conflict_node_ids(...)`：`full` 返回全部节点，局部 Run 返回下游闭包。
  - 新增 `aigc_run_projection_node_ids(...)`：`full` 返回全部节点，局部 Run 返回投影范围。
  - 保留 `aigc_connected_node_ids` 仅供兼容，不再用于 Run 冲突或投影。

- [x] **Step 4: 统一 DAG 导出**
  - 在 `backend/app/services/aigc_dag.py` 重新导出新函数，保持当前调用方的导入层次。
  - 使用相同的 v1 -> v2 canonicalization 和 `AigcDagValidationError`。

- [x] **Step 5: 运行范围测试**

```bash
.venv/bin/python -m pytest backend/tests/test_aigc_dag.py -q
```

Expected: PASS。

## Task 2: Repository 分支级并发冲突

**Files:**
- Modify: `backend/app/repositories/memory.py`
- Modify: `backend/app/repositories/mysql.py`
- Test: `backend/tests/test_aigc_repository.py`

- [x] **Step 1: 增加 Memory/MySQL 参数化契约测试**
  - 两个 Run 从共享 parser 的不同下游分支开始，冲突范围不相交，均可创建。
  - 两个 Run 投影范围共享 parser，但不得触发 409。
  - 同一分支重复提交只允许一个 Run。
  - 使用两个同步并发请求提交同一分支，断言只有一个创建成功，另一个收到活动冲突。
  - 从 parser 启动的 Run 与任一分支 Run 双向冲突。
  - `full` 与局部 Run 双向冲突。
  - 相同幂等键仍优先返回原 Run。

- [x] **Step 2: 确认旧 Repository 实现失败**

```bash
.venv/bin/python -m pytest backend/tests/test_aigc_repository.py -q
```

Expected: 共享上游分支并行用例因旧无向范围相交而失败。

- [x] **Step 3: 修改内存 Repository**
  - 将 candidate 与 active Run 的范围计算替换为 `aigc_run_conflict_node_ids`。
  - 保持幂等键检查先于冲突检查。
  - 保持锁内检查和创建，不增加先查后写窗口。

- [x] **Step 4: 修改 MySQL Repository**
  - 在现有 Pipeline `FOR UPDATE` 事务内使用 `aigc_run_conflict_node_ids`。
  - 不修改表结构或事务边界。
  - 保持 `latest_run_status` 只由最大 `run_number` 更新的现有规则。

- [x] **Step 5: 运行 Repository 契约**

```bash
.venv/bin/python -m pytest backend/tests/test_aigc_repository.py -q
```

Expected: PASS。

## Task 3: Runtime 依赖计算与局部预检

**Files:**
- Modify: `backend/app/services/aigc_dag.py`
- Modify: `backend/app/services/aigc_executor.py`
- Test: `backend/tests/test_aigc_executor.py`
- Test: `backend/tests/test_aigc_dag.py`

- [x] **Step 1: 写入共享上游无缓存并行测试**
  - 两个 Run 分别从 branch A、B 启动。
  - 不提供共享上游缓存候选。
  - 断言两个 Run 均可进入运行并各自创建共享上游任务。
  - 断言两个共享上游任务的 `run_id/task_id` 不同。
  - 断言 A 成功、B 失败或取消时互不改变状态和资产。

- [x] **Step 2: 写入局部预检测试**
  - branch A 及其依赖有效，兄弟 branch B 配置或资产无效。
  - 从 branch A 局部运行应通过。
  - `full` 运行仍应因 branch B 无效而失败。

- [x] **Step 3: 让 DAG 校验接受可选投影范围**
  - 全局继续校验节点 ID、边引用、端口、重复边和环。
  - 节点配置完整性、资产可用性和模态特定约束只对投影范围执行。
  - `full` 或未传范围时保持当前全画布校验。
  - 增加兄弟分支结构错误仍阻止局部 Run 的测试，避免“局部预检”被误解为允许非法快照。

- [x] **Step 4: 在局部提交路径传递投影范围**
  - `_submit` 根据 `planning_mode/start_node_id` 计算 projection scope。
  - 初始预检、输入哈希计算和执行计划均使用同一 projection scope。
  - Run 的 `definition_snapshot` 与 run-node 列表仍保存完整画布，范围外节点保持 `idle`。

- [x] **Step 5: 验证共享上游独立执行**
  - 不共享进行中任务。
  - 不读取另一活动 Run 的未完成结果。
  - 任务失败、取消和迟到结果仍按 `run_id` 隔离。

- [x] **Step 6: 运行 Runtime 测试**

```bash
.venv/bin/python -m pytest \
  backend/tests/test_aigc_dag.py \
  backend/tests/test_aigc_executor.py -q
```

Expected: PASS。

## Task 4: 前端逐节点 Run 投影

**Files:**
- Modify: `frontend/lib/aigc/run-scope.ts`
- Test: `frontend/tests/aigc-run-scope.test.ts`

- [x] **Step 1: 写入失败的前端范围测试**
  - 使用共享 parser 的三个分支定义。
  - 断言 branch A、B 的 conflict scope 不相交。
  - 断言 projection scope 共享上游但不包含兄弟分支。
  - 断言 parser Run 的 conflict scope 覆盖全部下游。

- [x] **Step 2: 写入结果保留测试**
  - Run #4 成功生成 branch A，Run #5 正在生成 branch B。
  - `displayRunForNode(branch-a-image)` 必须返回 Run #4。
  - `displayRunForNode(branch-b-model)` 必须返回 Run #5。
  - Run #6 在 branch C 失败时，A、B 仍分别返回 #4、#5。
  - `selectAigcProjectionRunIds` 必须同时选择这些 Run 的详情 ID。

- [x] **Step 3: 实现前端双范围**
  - 新增 `getDownstreamAigcNodeIds`。
  - 新增 `getAigcRunConflictNodeIds`。
  - 新增 `getAigcRunProjectionNodeIds`。
  - v1/v2 definition 使用同一边方向语义。

- [x] **Step 4: 改为逐节点选择详情**
  - 遍历当前 definition 的每个节点。
  - 为每个节点收集最新终态 Run 与最新成功 Run。
  - 依据 projection scope 判断 Run 是否与节点相关。
  - 只使用 Run summary 已包含的 `definition_snapshot/mode/start_node_id` 计算范围，不等待详情请求。
  - 将全部活动 Run 和显式历史 Run 加入集合后去重。

- [x] **Step 5: 修改节点 Resolver**
  - active、selected、terminal 和 latest-successful 均使用 projection scope。
  - 不再通过当前节点的无向连通范围寻找活动 Run。
  - 同一共享上游属于多个活动 Run 时，按 `run_number` 选择最新 Run。

- [x] **Step 6: 验证独立轮询和详情失败隔离**
  - 两个活动 Run 均创建独立详情查询并分别轮询。
  - Run A 进入终态后只停止 A 的轮询，Run B 继续。
  - Run B 详情请求失败时，Run A 的详情、状态和结果仍保留。
  - 详情失败时继续根据 summary 计算 B 的 projection scope，不回退到无向连通图，也不清空其他 scope。

- [x] **Step 7: 运行前端范围测试**

```bash
cd frontend
npx vitest run tests/aigc-run-scope.test.ts
```

Expected: PASS。

## Task 5: 编辑器并行提交与结果保留

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Test: `frontend/tests/aigc-editor.test.tsx`
- Test: `frontend/tests/aigc-flow-node.test.tsx`

- [x] **Step 1: 写入编辑器回归测试**
  - 渲染共享 parser 的两个文生图分支。
  - branch A 已成功且含图片资产，branch B 活动。
  - 断言 branch A 图片仍显示、可预览和下载。
  - 断言 branch A 不显示运行状态。
  - 断言 branch B 显示运行状态。

- [x] **Step 2: 写入 pending 并行测试**
  - branch A 的 create Run 请求保持 pending。
  - branch B 的“从此节点运行”保持可用并可发出第二个请求。
  - 从共同 parser 或 branch A 下游相交节点提交时保持禁用。
  - 任一 pending 请求存在时顶部“执行全部”保持禁用。

- [x] **Step 3: 修改 pending 冲突判断**
  - 将每个 pending start node 转为 conflict scope。
  - 当前节点的 conflict scope 与任一 pending scope 相交时才禁用。
  - `FULL_RUN_PENDING` 继续阻止全部局部运行。

- [x] **Step 4: 修改局部前端预检**
  - `definitionForNodeScope` 改用 projection scope。
  - 保留投影范围内部节点和边。
  - 不把无关兄弟分支纳入 Seedream、视频或资产预检。

- [x] **Step 5: 验证选中 Run 不污染兄弟分支**
  - 新 Run 返回后仍可 `setSelectedRunId` 打开运行面板。
  - `selectedRunForNode` 只在 selected Run 的 projection scope 内生效。
  - 切换选中节点时结果面板解析对应节点自己的 Run。

- [x] **Step 6: 运行编辑器相关测试**

```bash
cd frontend
npx vitest run \
  tests/aigc-run-scope.test.ts \
  tests/aigc-editor.test.tsx \
  tests/aigc-flow-node.test.tsx
```

Expected: PASS。

## Task 6: 三分支 Mock 验收与全量门禁

**Files:**
- Modify: `frontend/scripts/create-aigc-acceptance-fixture.mjs`
- Modify: `frontend/scripts/verify-aigc-flow-run-isolation.mjs`
- Modify: `.trae/specs/enable-aigc-branch-run-isolation/checklist.md`

- [x] **Step 1: 扩展验收 Fixture**
  - 创建共同上游 `text -> llm -> text -> json_parser`。
  - 创建三条 `generated text -> text_to_image -> image` 分支。
  - 使用固定节点 ID，便于断言 branch A/B/C。
  - Fixture 只创建 Pipeline，不调用 Provider。

- [x] **Step 2: Mock 三个 Run**
  - Run #4：branch A 成功并返回图片资产。
  - Run #5：branch B 为 running。
  - Run #6：branch C 为 failed。
  - 三个 Run 的快照相同，start node 分别位于 A/B/C。

- [x] **Step 3: Playwright 验证**
  - branch A 图片在 B 运行和 C 失败时保持可见。
  - branch A 下载按钮仍可用。
  - branch B 显示运行中且 branch A 不显示运行中。
  - branch C 只显示自身错误。
  - branch A 与 B 的局部运行按钮按 conflict scope 独立。
  - 顶部执行全部在活动 Run 存在时禁用。

- [x] **Step 4: 运行后端全量测试**

```bash
.venv/bin/python -m pytest backend/tests -q
```

Expected: 全部 PASS。

- [x] **Step 5: 运行前端质量门禁**

```bash
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 全部 PASS，ESLint 0 warnings。

- [x] **Step 6: 运行多视口验收**

```bash
cd frontend
AIGC_FLOW_ISOLATION_FIXTURE="$(
  npm run --silent acceptance:aigc-flow-isolation:fixture
)" npm run acceptance:aigc-flow-isolation
```

Expected: `1440x1000`、`1024x768`、`390x844` 全部通过；无页面异常、控制台错误、横向溢出或控件重叠。

- [x] **Step 7: 核对 checklist**
  - 逐项验证 `.trae/specs/enable-aigc-branch-run-isolation/checklist.md`。
  - 失败项先追加修复任务，再重新验收。

## Task Dependencies

- Task 2 depends on Task 1。
- Task 3 depends on Task 1 and Task 2。
- Task 4 depends on Task 1 的范围语义，可与 Task 2 并行。
- Task 5 depends on Task 4。
- Task 6 depends on Task 2、Task 3、Task 4 and Task 5。
