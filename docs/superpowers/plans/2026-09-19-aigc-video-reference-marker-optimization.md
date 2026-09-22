# AIGC 视频参考标记优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AIGC 画布视频提示词优化优先保留参考媒体标记，但绝不因标记变化而阻断结果。

**Architecture:** 现有通用字面量提取器不会匹配标准视频参考标记，测试将这一非阻断
边界固定下来，保留其他结果解析和空内容保护。模型指令追加明确的软保留要求；
前端在视频目标被选中时显示非阻断说明。

**Tech Stack:** Python 3、FastAPI 服务层、Pydantic、pytest、React、TypeScript、Vitest、
Testing Library。

---

### Task 1: 放宽视频参考标记的结果校验

**Files:**
- Modify: `backend/app/services/prompt_optimization.py:1-1450`
- Test: `backend/tests/test_prompt_optimization.py:50-150`

- [ ] **Step 1: 写出标记删改不应失败的测试**

```python
def test_video_reference_marker_changes_are_not_a_hard_validation_error() -> None:
    request = video_request(
        "主体登场（参考@图1），沿用节奏（参考@视频1），"
        "音效参考（参考@音频1）。"
    )

    validate_prompt_optimization_result(
        request,
        AigcPromptOptimizeResponse(
            optimized_text="主体登场并以连续运镜推进，使用环境音增强节奏。",
            optimized_reference_instructions=[],
        ),
    )
```

- [ ] **Step 2: 运行测试确认当前行为符合非阻断边界**

Run: `cd backend && pytest tests/test_prompt_optimization.py::test_video_reference_marker_changes_are_not_a_hard_validation_error -q`

Expected: PASS，证明标准标记不参与当前受保护字面量的硬校验。

- [ ] **Step 3: 保留现有校验实现**

不新增无行为差异的剥离函数。保留 `validate_prompt_optimization_result` 当前的图片、
LLM、时长改写和空结果保护逻辑，仅将本测试作为回归边界。

- [ ] **Step 4: 运行目标测试确认通过**

Run: `cd backend && pytest tests/test_prompt_optimization.py -q`

Expected: PASS，且既有“无时长改写时保留时间轴端点”测试仍然通过。

### Task 2: 在模型指令中加入软保留要求

**Files:**
- Modify: `backend/app/services/modelark.py:4875-4975`
- Test: `backend/tests/test_modelark.py`

- [ ] **Step 1: 写出视频模型消息断言**

在 `backend/tests/test_modelark.py` 新增测试，构造
`target_type="video_generation"` 的 `AigcPromptOptimizeRequest` 并调用
`MockModelArkAdapter.build_aigc_prompt_optimization_messages`：

```python
def test_aigc_video_prompt_optimizer_requests_reference_marker_preservation() -> None:
    system_prompt, _ = MockModelArkAdapter.build_aigc_prompt_optimization_messages(
        AigcPromptOptimizeRequest.model_validate(
            {
                "target_node_id": "video-model",
                "target_type": "video_generation",
                "target_config": {
                    "aspect_ratio": "16:9",
                    "duration_seconds": 5,
                    "generate_audio": False,
                    "generation_mode": "text_to_video",
                    "model": "doubao-seedance-2-5-260628",
                    "references": [],
                    "task_type": "generate",
                },
                "text": "主体出现（参考@图1）",
            }
        )
    )

    assert "原样保留" in system_prompt
    assert "(参考@图N)" in system_prompt
    assert "(参考@视频N)" in system_prompt
    assert "(参考@音频N)" in system_prompt
```

- [ ] **Step 2: 运行测试确认当前行为失败**

Run: `cd backend && pytest tests/test_modelark.py::test_aigc_video_prompt_optimizer_requests_reference_marker_preservation -q`

Expected: FAIL，因为当前视频策略只泛化要求保留结构化引用 token。

- [ ] **Step 3: 仅为视频策略添加软保留指令**

在 `build_aigc_prompt_optimization_messages` 的 `video_generation` `strategy` 中加入：

```python
"若原文含 (参考@图N)、(参考@视频N) 或 (参考@音频N)，"
"优先原样保留这些参考媒体标记；这是保留要求，不生成新标记。",
```

不要改变 JSON 响应字段、`references` 的连接语义或任何执行时参考媒体校验。

- [ ] **Step 4: 运行目标测试确认通过**

Run: `cd backend && pytest tests/test_modelark.py::test_aigc_video_prompt_optimizer_requests_reference_marker_preservation -q`

Expected: PASS。

### Task 3: 在视频目标的优化弹窗显示软提示

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-prompt-editor.tsx:520-670`
- Test: `frontend/tests/aigc-prompt-editor.test.tsx:540-650`

- [ ] **Step 1: 写出目标类型切换的组件测试**

添加一个 V2 定义，文本节点同时连接 LLM 和 `video_generation` 节点。打开优化弹窗后，
断言默认视频目标显示说明；将下拉框切换到 LLM 后断言说明消失：

```tsx
expect(
  screen.getByText("优化会尽量保留提示词中的参考媒体标记。")
).toBeInTheDocument();

fireEvent.change(screen.getByRole("combobox", { name: "目标模型" }), {
  target: { value: "llm-target" }
});

expect(
  screen.queryByText("优化会尽量保留提示词中的参考媒体标记。")
).not.toBeInTheDocument();
```

- [ ] **Step 2: 运行测试确认当前行为失败**

Run: `cd frontend && npm test -- --run tests/aigc-prompt-editor.test.tsx`

Expected: FAIL，找不到软提示文本。

- [ ] **Step 3: 根据当前选中目标条件渲染说明**

在 `AigcPromptEditor` 中派生：

```tsx
const selectedOptimizationTarget = targets.find(
  (target) => target.id === targetNodeId
);
const showsVideoReferenceMarkerHint =
  selectedOptimizationTarget?.node.type === "video_generation";
```

在目标模型选择器之后插入：

```tsx
{showsVideoReferenceMarkerHint ? (
  <p className="text-xs leading-5 text-zinc-400" role="status">
    优化会尽量保留提示词中的参考媒体标记。
  </p>
) : null}
```

不得修改提交请求、禁用态、优化成功写回或错误显示逻辑。

- [ ] **Step 4: 运行前端测试确认通过**

Run: `cd frontend && npm test -- --run tests/aigc-prompt-editor.test.tsx`

Expected: PASS。

### Task 4: 集成回归与运行时验证

**Files:**
- Modify: `debug-prompt-optimization-unavailable.md`
- Runtime: `.dbg/trae-debug-log-prompt-optimization-unavailable.ndjson`

- [ ] **Step 1: 运行受影响的后端测试集**

Run: `cd backend && pytest tests/test_prompt_optimization.py tests/test_modelark.py -q`

Expected: PASS。

- [ ] **Step 2: 运行受影响的前端测试与静态检查**

Run: `cd frontend && npm test -- --run tests/aigc-prompt-editor.test.tsx && npm run lint -- --file components/workspace/aigc/aigc-prompt-editor.tsx`

Expected: PASS。

- [ ] **Step 3: 重启后端并检查健康状态**

Run:

```bash
pkill -f 'uvicorn backend.app.main:app' || true
nohup uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 \
  > /tmp/ad-creativity-backend.log 2>&1 &
curl -fsS http://127.0.0.1:8000/health
```

Expected: 返回 `{"status":"ok",...}`。

- [ ] **Step 4: 清空当前调试会话日志并记录后修复验证边界**

Run:

```bash
curl -fsS -X DELETE http://127.0.0.1:7777/logs
```

在 `debug-prompt-optimization-unavailable.md` 追加：修复后应观察到请求进入并完成，且不因
参考标记变化进入 `ModelArkTextParseError` 分支。保留所有调试埋点、环境文件和调试服务，
直至用户实际复测确认。

- [ ] **Step 5: Commit**

```bash
git add \
  backend/app/services/modelark.py \
  backend/app/services/prompt_optimization.py \
  backend/tests/test_modelark.py \
  backend/tests/test_prompt_optimization.py \
  frontend/components/workspace/aigc/aigc-prompt-editor.tsx \
  frontend/tests/aigc-prompt-editor.test.tsx \
  debug-prompt-optimization-unavailable.md
git commit -m "fix: soften video reference marker optimization"
```
