# AIGC 视频字幕提取节点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AIGC 画布新增基于 MediaKit `video-ocr` 的硬字幕提取节点，输出可预览、下载并连接多轨剪辑的 SRT 资产。

**Architecture:** 新增独立 `MediaKitVideoOcrClient`，沿用人脸打码节点的提交/轮询/脱敏模式；AIGC Executor 负责快照、缓存和输入解析，Gateway 负责视频校验、供应商调用和 SRT 资产登记。前端新增强类型 `subtitle_asset` 端口、节点卡片和结果投影，多轨节点按稳定连接顺序接收上游 SRT。

**Tech Stack:** Python 3.14、FastAPI、Pydantic v2、httpx、React、TypeScript、Zustand、Vitest、pytest

---

### Task 1: 节点与端口契约

**Files:**
- Modify: `backend/app/schemas/aigc.py`
- Modify: `frontend/lib/aigc/types.ts`
- Modify: `frontend/lib/aigc/node-registry.ts`
- Modify: `frontend/lib/aigc/editor-store.ts`
- Test: `backend/tests/test_aigc_schemas.py`
- Test: `backend/tests/test_aigc_dag.py`
- Test: `frontend/tests/aigc-editor-store-v2.test.ts`

- [ ] 先增加失败测试，断言 `video_subtitle_extraction` 默认 `mode="Subtitle"`，端口为 `video_asset -> subtitle_asset`，多轨 `subtitles` 最多 10 条。
- [ ] 新增 `AigcNodeType.VIDEO_SUBTITLE_EXTRACTION`、`AigcTaskType.VIDEO_SUBTITLE_EXTRACTION`、`AigcPortType.SUBTITLE_ASSET` 和对应前端联合类型。
- [ ] 新增配置和节点：

```python
class VideoSubtitleExtractionConfig(SchemaModel):
    mode: Literal["Subtitle"] = "Subtitle"


class VideoSubtitleExtractionNode(AigcNodeBase):
    type: Literal[AigcNodeType.VIDEO_SUBTITLE_EXTRACTION]
    config: VideoSubtitleExtractionConfig = Field(
        default_factory=VideoSubtitleExtractionConfig
    )
```

- [ ] 在前后端注册表增加单视频输入、单字幕输出，并为多轨增加 `subtitles` 多输入。
- [ ] 运行契约与 DAG 测试，确认合法连接通过、错连与超限被拒绝。

### Task 2: MediaKit OCR 客户端

**Files:**
- Create: `backend/app/services/mediakit_video_ocr.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/api/dependencies.py`
- Test: `backend/tests/test_mediakit_video_ocr.py`
- Test: `backend/tests/test_config.py`

- [ ] 用 MockTransport 写提交、轮询、成功、空结果、非法片段、失败和脱敏的失败测试。
- [ ] 实现 `VideoOcrTaskStatus`、`VideoOcrTask`、`MediaKitVideoOcrError` 与客户端：

```python
submitted = await client.submit(
    video_url=access_url,
    mode="Subtitle",
    client_token=stable_token,
)
completed = await client.poll(
    task_id=submitted.task_id,
    timeout_seconds=timeout,
    poll_interval_seconds=interval,
)
```

- [ ] 严格白名单提交字段，归一化供应商状态，解析 `duration` 和排序后的 `SubtitleSegment`。
- [ ] 新增 `MEDIAKIT_VIDEO_OCR_POLL_INTERVAL_SECONDS`、`MEDIAKIT_VIDEO_OCR_TIMEOUT_SECONDS` 和 `AIGC_VIDEO_SUBTITLE_EXTRACTION_CONCURRENCY`。
- [ ] 运行 OCR 客户端与配置测试。

### Task 3: AIGC 执行与 SRT 资产

**Files:**
- Modify: `backend/app/services/aigc_executor.py`
- Modify: `backend/app/services/aigc_gateway.py`
- Modify: `backend/app/services/assets.py`
- Modify: `backend/app/api/dependencies.py`
- Test: `backend/tests/test_aigc_executor.py`
- Test: `backend/tests/test_aigc_gateway.py`
- Test: `backend/tests/test_asset_video_subtitle_storage.py`

- [ ] 写失败测试覆盖输入解析、240p–4K/600 秒校验、快照 Hash、非空 SRT、空成功结果、失败回滚和缓存。
- [ ] Executor 将节点映射到新 Task，解析唯一 `input_asset_id`，使用独立 semaphore。
- [ ] Gateway 校验视频并调用 OCR 客户端；非空片段调用：

```python
srt_text = segments_to_srt(completed.segments)
output = self.asset_storage.store_aigc_video_subtitles(
    repository,
    AigcVideoSubtitleAssetInput(..., srt_text=srt_text),
)
```

- [ ] 资产服务以 UTF-8 上传 `application/x-subrip`，登记 OUTPUT 引用及白名单 metadata。
- [ ] 空结果返回 `AigcTaskResult(kind=NONE)`，Task metrics 保存 `empty=true` 所需的安全信息，并可被缓存复用。
- [ ] 运行 Executor、Gateway、资产存储测试。

### Task 4: 多轨字幕输入

**Files:**
- Modify: `backend/app/services/aigc_executor.py`
- Modify: `backend/app/services/aigc_gateway.py`
- Modify: `frontend/lib/aigc/node-registry.ts`
- Test: `backend/tests/test_aigc_executor.py`
- Test: `backend/tests/test_aigc_gateway.py`
- Test: `frontend/tests/aigc-node-registry.test.ts`

- [ ] 写失败测试覆盖稳定顺序、资产去重、配置与上游合计 10 条、无效 SRT 及缓存失效。
- [ ] 将 `subtitles` 加入多输入顺序和允许资产类型，解析每条上游字幕资产。
- [ ] 为每个上游资产生成确定性的字幕 track/element，与配置 tracks 合并：

```python
track = MultiTrackTrack(
    id=f"upstream-subtitle-{ordinal}",
    name=f"字幕 {ordinal + 1}",
    type="subtitle",
    order=...,
    elements=[MultiTrackSubtitleElement(..., asset_id=asset.id)],
)
```

- [ ] Gateway 使用合并后的工程生成 Provider track，并记录 subtitle 输入引用。
- [ ] 运行多轨后端与注册表测试。

### Task 5: 前端节点与字幕结果

**Files:**
- Modify: `frontend/lib/aigc/result-projection.ts`
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/lib/api-client.ts`
- Test: `frontend/tests/aigc-result-projection.test.ts`
- Test: `frontend/tests/aigc-flow-node.test.tsx`
- Test: `frontend/tests/aigc-editor-v2.test.tsx`

- [ ] 写失败测试覆盖节点摘要、运行/空结果、字幕资产投影、历史 Run、不可用资产和下载名。
- [ ] 节点卡片显示 `硬字幕 OCR · SRT`，无额外配置控件。
- [ ] 新增字幕结果投影，读取 metadata，并通过受控资产内容接口加载、解析 SRT 预览。
- [ ] 结果面板显示片段数、时长、时间轴文本和下载图标；空结果显示 `未识别到字幕`。
- [ ] 运行相关 Vitest。

### Task 6: 完整验证与文档状态

**Files:**
- Modify: `.trae/specs/add-aigc-video-subtitle-extraction-node/tasks.md`
- Modify: `.trae/specs/add-aigc-video-subtitle-extraction-node/checklist.md`

- [ ] 运行后端聚焦测试与完整 `PYTHONPATH=. .venv/bin/pytest backend/tests -q`。
- [ ] 在 `frontend` 运行 `npm run test`、`npm run typecheck`、`npm run lint` 和 `npm run build`。
- [ ] 启动本地服务，用 Mock MediaKit 通过 Playwright 验证桌面/窄屏节点、连线、执行、预览、下载、空结果和多轨接入。
- [ ] 审计网络请求，确认未调用真实 `video-ocr` 计费接口。
- [ ] 按验证结果勾选 `tasks.md` 与 `checklist.md`。
