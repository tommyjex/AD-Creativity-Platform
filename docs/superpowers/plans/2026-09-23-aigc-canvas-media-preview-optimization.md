# AIGC Canvas Media Preview Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过画布级批量 Preview Manifest、轻量图片/视频派生物、交互后原始媒体加载和可视优先调度，让 12 个可见多模态节点在 2 秒内完成可辨认预览。

**Architecture:** 后端新增独立的预览契约、持久化记录和派生服务，由批量 Manifest 接口返回规范化状态并幂等调度缺失派生物；预览内容通过稳定代理 URL、应用级 HTTP 连接池和版本缓存提供。前端由 `CanvasPreviewCoordinator` 汇总 Pipeline 定义与运行投影中的资产 ID，将结果写入按资产规范化的 React Query 缓存，再按 React Flow 视口分三级、最多并发 6 个文件加载；节点仅在用户点击后挂载原始 `<video>` 或 `<audio>`。

**Tech Stack:** FastAPI、Pydantic 2、SQLAlchemy 2、Pillow、FFmpeg、httpx、React 19、Next.js 16、TanStack Query 5、React Flow 12、Vitest、Testing Library、Playwright、火山引擎 TLS。

---

## 实施前提

- 设计基线：`docs/superpowers/specs/2026-09-23-aigc-canvas-media-preview-optimization-design.md`
- 从提交 `cb91cbf` 创建专用 worktree 后执行，避免把当前工作区尚未确认的调试埋点带入功能提交。
- 不修改 Pipeline、节点或运行快照结构；预览数据只存在于新表、API 响应和前端查询缓存。
- 原始媒体接口继续负责播放、下载和精准编辑；画布初始化不得请求视频或音频原始内容。
- 每个提交前运行 `git diff --check` 和对应定向测试，并只暂存本任务列出的文件。

## 文件结构

### 后端新增

- `backend/app/schemas/asset_preview.py`：Preview Manifest、预览记录及状态契约。
- `backend/app/services/asset_previews.py`：版本计算、Manifest 组装、派生生成、重试、幂等与指标。
- `backend/tests/test_asset_previews.py`：预览服务、图片/视频派生和重试测试。

### 后端修改

- `backend/app/schemas/__init__.py`：导出预览契约。
- `backend/app/db/models.py`：新增 `AssetPreviewORM`。
- `backend/app/db/__init__.py`：导出 `AssetPreviewORM`。
- `backend/app/repositories/base.py`：增加预览记录仓储协议。
- `backend/app/repositories/memory.py`：实现内存预览记录仓储。
- `backend/app/repositories/mysql.py`：实现 MySQL/SQLite 预览记录仓储。
- `backend/app/api/dependencies.py`：提供共享预览服务和应用级 `httpx.AsyncClient`。
- `backend/app/api/routes.py`：新增 Manifest 与预览内容接口。
- `backend/app/main.py`：应用关闭时释放共享 HTTP 客户端。
- `backend/app/services/assets.py`：成功写入公开媒体后主动调度预览。
- `backend/tests/test_database.py`：覆盖新表、外键及唯一约束。
- `backend/tests/test_assets.py`：覆盖 Manifest、缓存、条件请求和连接池复用。
- `backend/tests/conftest.py`：注入可控预览服务和共享 HTTP 客户端。

### 前端新增

- `frontend/lib/aigc/asset-preview.ts`：资产 ID 收集、缓存 key、优先级和并发调度纯逻辑。
- `frontend/components/workspace/aigc/aigc-preview-context.tsx`：画布级协调器与节点消费 Context。
- `frontend/tests/aigc-asset-preview.test.ts`：收集、去重、优先级和调度测试。
- `frontend/tests/aigc-preview-context.test.tsx`：Manifest 合并、有限刷新和缓存共享测试。
- `frontend/scripts/verify-aigc-canvas-previews.py`：三视口网络、性能和视觉验收。

### 前端修改

- `frontend/lib/api-types.ts`：新增 Preview Manifest 类型。
- `frontend/lib/api-client.ts`：新增批量 Manifest 客户端。
- `frontend/components/workspace/aigc/aigc-editor.tsx`：挂载协调器并传入定义、运行投影、视口。
- `frontend/components/workspace/aigc/aigc-flow-node.tsx`：移除节点级 `getAsset`，使用预览缓存和交互式播放器。
- `frontend/components/workspace/aigc/aigc-video-player.tsx`：支持 poster 状态与点击后加载原视频。
- `frontend/components/workspace/aigc/aigc-audio-player.tsx`：支持元数据占位与点击后加载原音频。
- `frontend/tests/api-client.test.ts`：覆盖 Manifest 请求。
- `frontend/tests/aigc-editor.test.tsx`：覆盖画布级单次请求和新增运行资产。
- `frontend/tests/aigc-flow-node.test.tsx`：覆盖节点预览来源及无 N+1。
- `frontend/tests/aigc-video-player.test.tsx`：覆盖点击前无 `<video src>`。
- `frontend/tests/aigc-audio-player.test.tsx`：覆盖点击前无 `<audio src>`。
- `frontend/package.json`：登记预览验收命令。

## 第一阶段：请求收敛

### Task 1: 定义 Preview Manifest 前后端契约

**Files:**
- Create: `backend/app/schemas/asset_preview.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `frontend/lib/api-types.ts`
- Modify: `frontend/lib/api-client.ts`
- Test: `frontend/tests/api-client.test.ts`

- [ ] **Step 1: 写 API 客户端失败测试**

在 `frontend/tests/api-client.test.ts` 增加：

```ts
it("posts a deduplicated canvas preview manifest request", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [
          {
            asset_id: "asset-image",
            duration_seconds: null,
            height: 360,
            kind: "image",
            mime_type: "image/webp",
            preview_url:
              "/api/assets/asset-image/preview/canvas_node?v=source-v1",
            status: "ready",
            version: "source-v1",
            width: 640
          }
        ]
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    )
  );
  const api = createApiClient({ baseUrl: "http://localhost:8000", fetcher });

  const result = await api.getAssetPreviewManifest(
    {
      asset_ids: ["asset-image"],
      variant: "canvas_node"
    },
    "pipeline-1"
  );

  expect(result.items[0]?.status).toBe("ready");
  expect(fetcher).toHaveBeenCalledWith(
    "http://localhost:8000/api/assets/preview-manifest",
    expect.objectContaining({
      body: JSON.stringify({
        asset_ids: ["asset-image"],
        variant: "canvas_node"
      }),
      method: "POST"
    })
  );
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && npm test -- tests/api-client.test.ts`

Expected: FAIL，提示 `getAssetPreviewManifest` 不存在。

- [ ] **Step 3: 增加后端 Pydantic 契约**

在 `backend/app/schemas/asset_preview.py` 定义完整契约：

```python
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import Field, field_validator

from .common import SchemaModel, utc_now
from .enums import ReferenceAssetKind


class AssetPreviewStatus(str, Enum):
    READY = "ready"
    PENDING = "pending"
    UNAVAILABLE = "unavailable"


class AssetPreviewRecord(SchemaModel):
    asset_id: str
    variant: Literal["canvas_node"] = "canvas_node"
    source_version: str
    status: AssetPreviewStatus
    object_key: str | None = None
    mime_type: str | None = None
    width: int | None = Field(default=None, ge=1)
    height: int | None = Field(default=None, ge=1)
    size_bytes: int | None = Field(default=None, ge=0)
    error_code: str | None = None
    attempt_count: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class AssetPreviewManifestRequest(SchemaModel):
    asset_ids: list[str] = Field(..., min_length=1, max_length=100)
    variant: Literal["canvas_node"] = "canvas_node"

    @field_validator("asset_ids")
    @classmethod
    def normalize_asset_ids(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.strip() for value in values))
        if any(not value for value in normalized):
            raise ValueError("asset_ids must not contain blank values")
        if len(normalized) > 100:
            raise ValueError("asset_ids must contain at most 100 unique values")
        return normalized


class AssetPreviewManifestItem(SchemaModel):
    asset_id: str
    kind: ReferenceAssetKind | None
    status: AssetPreviewStatus
    version: str | None
    preview_url: str | None
    mime_type: str | None
    width: int | None
    height: int | None
    duration_seconds: float | None


class AssetPreviewManifestResponse(SchemaModel):
    items: list[AssetPreviewManifestItem]
```

从 `backend/app/schemas/__init__.py` 导出这五个类型。

- [ ] **Step 4: 增加前端类型与客户端方法**

在 `frontend/lib/api-types.ts` 增加：

```ts
export type AssetPreviewStatus = "ready" | "pending" | "unavailable";
export type AssetPreviewVariant = "canvas_node";

export interface AssetPreviewManifestRequest {
  asset_ids: string[];
  variant: AssetPreviewVariant;
}

export interface AssetPreviewManifestItem {
  asset_id: string;
  duration_seconds: number | null;
  height: number | null;
  kind: ReferenceAssetKind | null;
  mime_type: string | null;
  preview_url: string | null;
  status: AssetPreviewStatus;
  version: string | null;
  width: number | null;
}

export interface AssetPreviewManifestResponse {
  items: AssetPreviewManifestItem[];
}

export interface CanvasPreviewClientMetrics {
  all_visible_ms: number | null;
  bytes: number;
  cache_hit_count: number;
  first_visible_ms: number | null;
  original_fallback_count: number;
  pipeline_id: string;
  visible_asset_count: number;
}
```

将请求与响应类型加入 `frontend/lib/api-client.ts` 的类型导入，并在客户端对象中增加：

```ts
getAssetPreviewManifest(
  payload: AssetPreviewManifestRequest,
  pipelineId: string,
  requestOptions?: RequestOptions
) {
  return request<AssetPreviewManifestResponse>(
    fetcher,
    baseUrl,
    "/api/assets/preview-manifest",
    {
      ...requestOptions,
      body: {
        ...payload,
        asset_ids: [...new Set(payload.asset_ids)]
      },
      headers: mergeHeaders(
        defaultHeaders,
        { "X-Pipeline-ID": pipelineId },
        requestOptions?.headers
      ),
      method: "POST"
    }
  );
},
```

- [ ] **Step 5: 运行契约测试**

Run: `cd frontend && npm test -- tests/api-client.test.ts && npm run typecheck`

Expected: API 客户端测试与 TypeScript 检查通过。

- [ ] **Step 6: 提交**

```bash
git add backend/app/schemas/asset_preview.py backend/app/schemas/__init__.py frontend/lib/api-types.ts frontend/lib/api-client.ts frontend/tests/api-client.test.ts
git diff --cached --check
git commit -m "feat(preview): define canvas preview manifest contract"
```

### Task 2: 实现第一阶段 Manifest 与节点共享缓存

**Files:**
- Create: `backend/app/services/asset_previews.py`
- Modify: `backend/app/api/dependencies.py`
- Modify: `backend/app/api/routes.py`
- Test: `backend/tests/test_assets.py`
- Create: `frontend/lib/aigc/asset-preview.ts`
- Create: `frontend/components/workspace/aigc/aigc-preview-context.tsx`
- Create: `frontend/tests/aigc-asset-preview.test.ts`
- Create: `frontend/tests/aigc-preview-context.test.tsx`

- [ ] **Step 1: 写 Manifest 路由失败测试**

在 `backend/tests/test_assets.py` 增加三个测试：

```python
def test_preview_manifest_deduplicates_and_preserves_first_seen_order(
    client,
    repository: InMemoryRepository,
) -> None:
    project_id = _create_project(repository)
    image = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.UPLOADED_IMAGE,
            status=Status.SUCCEEDED,
            object_key=f"projects/{project_id}/image/source.png",
            mime_type="image/png",
            size_bytes=1024,
            metadata={"width": 1280, "height": 720},
        )
    )
    audio = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.UPLOADED_AUDIO,
            status=Status.SUCCEEDED,
            object_key=f"projects/{project_id}/audio/source.mp3",
            mime_type="audio/mpeg",
            size_bytes=2048,
            metadata={"duration_seconds": 8.4},
        )
    )

    response = client.post(
        "/api/assets/preview-manifest",
        json={
            "asset_ids": [audio.id, image.id, audio.id],
            "variant": "canvas_node",
        },
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert [item["asset_id"] for item in items] == [audio.id, image.id]
    assert items[0]["kind"] == "audio"
    assert items[0]["duration_seconds"] == 8.4
    assert items[0]["preview_url"] is None
    assert items[1]["kind"] == "image"
    assert items[1]["preview_url"].endswith(f"/assets/{image.id}/content")


def test_preview_manifest_returns_unavailable_per_missing_or_private_asset(
    client,
    repository: InMemoryRepository,
) -> None:
    project_id = _create_project(repository)
    private = repository.create_asset(
        AssetCreate(
            project_id=project_id,
            type=AssetType.GENERATED_IMAGE,
            asset_role=AssetRole.INTERNAL_LAYER,
            status=Status.SUCCEEDED,
            object_key="private/layer.png",
            mime_type="image/png",
        )
    )

    response = client.post(
        "/api/assets/preview-manifest",
        json={
            "asset_ids": ["missing", private.id],
            "variant": "canvas_node",
        },
    )

    assert response.status_code == 200
    assert [item["status"] for item in response.json()["items"]] == [
        "unavailable",
        "unavailable",
    ]


def test_preview_manifest_rejects_more_than_one_hundred_assets(client) -> None:
    response = client.post(
        "/api/assets/preview-manifest",
        json={
            "asset_ids": [f"asset-{index}" for index in range(101)],
            "variant": "canvas_node",
        },
    )
    assert response.status_code == 422
```

- [ ] **Step 2: 运行后端测试并确认失败**

Run: `.venv/bin/pytest backend/tests/test_assets.py -k preview_manifest -q`

Expected: FAIL，Manifest 路由返回 404。

- [ ] **Step 3: 实现第一阶段服务与路由**

在 `backend/app/services/asset_previews.py` 增加：

```python
from __future__ import annotations

from hashlib import sha256
from urllib.parse import quote

from backend.app.repositories import NotFoundError, Repository
from backend.app.schemas import (
    Asset,
    AssetPreviewManifestItem,
    AssetPreviewManifestResponse,
    AssetPreviewStatus,
    AssetRole,
    AssetType,
    ReferenceAssetKind,
    Status,
)
from backend.app.services.assets import AssetStorageService


IMAGE_TYPES = {AssetType.UPLOADED_IMAGE, AssetType.GENERATED_IMAGE}
VIDEO_TYPES = {AssetType.UPLOADED_VIDEO, AssetType.STORYBOARD_VIDEO, AssetType.FINAL_VIDEO}
AUDIO_TYPES = {AssetType.UPLOADED_AUDIO}


def asset_preview_kind(asset: Asset) -> ReferenceAssetKind | None:
    if asset.type in IMAGE_TYPES:
        return ReferenceAssetKind.IMAGE
    if asset.type in VIDEO_TYPES:
        return ReferenceAssetKind.VIDEO
    if asset.type in AUDIO_TYPES:
        return ReferenceAssetKind.AUDIO
    return None


def asset_source_version(asset: Asset) -> str:
    etag = asset.metadata.get("storage_etag")
    if isinstance(etag, str) and etag.strip():
        return etag.strip().strip('"')[:64]
    source = "\0".join(
        [
            asset.object_key or asset.url or "",
            str(asset.size_bytes or 0),
            asset.mime_type or "",
        ]
    )
    return sha256(source.encode("utf-8")).hexdigest()[:16]


class AssetPreviewService:
    def __init__(
        self,
        repository: Repository,
        asset_storage: AssetStorageService,
    ) -> None:
        self.repository = repository
        self.asset_storage = asset_storage

    def manifest(self, asset_ids: list[str]) -> AssetPreviewManifestResponse:
        items: list[AssetPreviewManifestItem] = []
        for asset_id in dict.fromkeys(asset_ids):
            try:
                asset = self.repository.get_asset(asset_id)
            except NotFoundError:
                items.append(self._unavailable(asset_id))
                continue
            kind = asset_preview_kind(asset)
            if (
                asset.asset_role != AssetRole.PUBLIC
                or asset.status != Status.SUCCEEDED
                or kind is None
            ):
                items.append(self._unavailable(asset_id))
                continue
            version = asset_source_version(asset)
            metadata = asset.metadata
            items.append(
                AssetPreviewManifestItem(
                    asset_id=asset.id,
                    kind=kind,
                    status=AssetPreviewStatus.READY
                    if kind in {ReferenceAssetKind.IMAGE, ReferenceAssetKind.AUDIO}
                    else AssetPreviewStatus.PENDING,
                    version=version,
                    preview_url=(
                        f"/api/assets/{quote(asset.id, safe='')}/content"
                        if kind == ReferenceAssetKind.IMAGE
                        else None
                    ),
                    mime_type=asset.mime_type,
                    width=_metadata_number(metadata, "width"),
                    height=_metadata_number(metadata, "height"),
                    duration_seconds=_metadata_number(
                        metadata,
                        "duration_seconds",
                    ),
                )
            )
        return AssetPreviewManifestResponse(items=items)

    @staticmethod
    def _unavailable(asset_id: str) -> AssetPreviewManifestItem:
        return AssetPreviewManifestItem(
            asset_id=asset_id,
            kind=None,
            status=AssetPreviewStatus.UNAVAILABLE,
            version=None,
            preview_url=None,
            mime_type=None,
            width=None,
            height=None,
            duration_seconds=None,
        )


def _metadata_number(metadata: dict[str, object], key: str) -> float | int | None:
    value = metadata.get(key)
    return value if isinstance(value, (int, float)) and value >= 0 else None
```

在 `backend/app/api/dependencies.py` 增加基于 `get_repository` 和
`get_asset_storage_service` 的 `get_asset_preview_service`，在
`backend/app/api/routes.py` 注册：

```python
@router.post(
    "/assets/preview-manifest",
    response_model=AssetPreviewManifestResponse,
    tags=["assets"],
)
def get_asset_preview_manifest(
    payload: AssetPreviewManifestRequest,
    preview_service: AssetPreviewService = Depends(get_asset_preview_service),
) -> AssetPreviewManifestResponse:
    return preview_service.manifest(payload.asset_ids)
```

- [ ] **Step 4: 运行后端测试**

Run: `.venv/bin/pytest backend/tests/test_assets.py -k preview_manifest -q`

Expected: 3 passed。

- [ ] **Step 5: 写前端收集与缓存失败测试**

在 `frontend/tests/aigc-asset-preview.test.ts` 验证本地模态资产与运行结果资产去重：

```ts
it("collects local and projected media asset ids once", () => {
  expect(
    collectCanvasPreviewAssetIds({
      definition: definitionWithLocalAssets(["image-a", "video-a", "image-a"]),
      projectedAssets: [
        { asset_id: "video-a", available: true },
        { asset_id: "audio-b", available: true }
      ]
    })
  ).toEqual(["image-a", "video-a", "audio-b"]);
});
```

在 `frontend/tests/aigc-preview-context.test.tsx` 使用测试 QueryClient 和
`PreviewProbe` 验证同一资产被两个消费者引用时只发一次批量请求：

```tsx
it("loads one manifest and shares normalized entries", async () => {
  apiMocks.getAssetPreviewManifest.mockResolvedValue({
    items: [readyImagePreview("image-a")]
  });

  render(
    <TestQueryProvider>
      <CanvasPreviewCoordinator
        assetIds={["image-a", "image-a"]}
        pipelineId="pipeline-1"
        priorities={new Map([["image-a", 0]])}
      >
        <PreviewProbe assetId="image-a" />
        <PreviewProbe assetId="image-a" />
      </CanvasPreviewCoordinator>
    </TestQueryProvider>
  );

  expect(await screen.findAllByText("ready")).toHaveLength(2);
  expect(apiMocks.getAssetPreviewManifest).toHaveBeenCalledOnce();
  expect(apiMocks.getAssetPreviewManifest).toHaveBeenCalledWith(
    {
      asset_ids: ["image-a"],
      variant: "canvas_node"
    },
    "pipeline-1",
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
});
```

- [ ] **Step 6: 运行前端测试并确认失败**

Run: `cd frontend && npm test -- tests/aigc-asset-preview.test.ts tests/aigc-preview-context.test.tsx`

Expected: FAIL，模块不存在。

- [ ] **Step 7: 实现收集器与协调器**

在 `frontend/lib/aigc/asset-preview.ts` 导出稳定 key 与收集函数：

```ts
export const assetPreviewKey = (assetId: string) =>
  ["asset-preview", assetId, "canvas_node"] as const;

export function collectCanvasPreviewAssetIds({
  definition,
  projectedAssets
}: {
  definition: AigcPipelineDefinitionV2;
  projectedAssets: ReadonlyArray<Pick<AigcResultAsset, "asset_id" | "available">>;
}): string[] {
  const local = definition.nodes.flatMap((node) => {
    if (!["image", "video", "audio"].includes(node.type)) return [];
    const assetId = (node.config as { asset_id?: string | null }).asset_id;
    return assetId ? [assetId] : [];
  });
  return [
    ...new Set([
      ...local,
      ...projectedAssets.flatMap((asset) =>
        asset.available ? [asset.asset_id] : []
      )
    ])
  ];
}
```

在 `frontend/components/workspace/aigc/aigc-preview-context.tsx`：

- 用 Context 暴露 `useCanvasAssetPreview(assetId)`。
- 用 `queryClient.getQueryData(assetPreviewKey(id))` 排除已缓存 ID。
- 单次调用 `apiClient.getAssetPreviewManifest` 获取缺失 ID，并以
  `X-Pipeline-ID` 请求头传递当前 Pipeline ID；模板模式不发请求。
- 用 `queryClient.setQueryData(assetPreviewKey(item.asset_id), item)` 逐项写入。
- Query 默认值固定为 `staleTime: 300_000`、`gcTime: 1_800_000`、
  `refetchOnWindowFocus: false`，网络错误仅重试一次。
- `pending` 项只在 500ms 和 1500ms 两个时点重新请求，组件卸载时清除 timer
  并通过 `AbortController` 取消请求。

- [ ] **Step 8: 运行前端测试**

Run: `cd frontend && npm test -- tests/aigc-asset-preview.test.ts tests/aigc-preview-context.test.tsx`

Expected: 收集、去重、共享缓存和有限刷新测试通过。

- [ ] **Step 9: 提交**

```bash
git add backend/app/schemas/asset_preview.py backend/app/schemas/__init__.py backend/app/services/asset_previews.py backend/app/api/dependencies.py backend/app/api/routes.py backend/tests/test_assets.py frontend/lib/aigc/asset-preview.ts frontend/components/workspace/aigc/aigc-preview-context.tsx frontend/tests/aigc-asset-preview.test.ts frontend/tests/aigc-preview-context.test.tsx
git diff --cached --check
git commit -m "feat(preview): batch canvas asset metadata"
```

### Task 3: 将视频和音频改为交互后加载

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-video-player.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-audio-player.tsx`
- Test: `frontend/tests/aigc-video-player.test.tsx`
- Test: `frontend/tests/aigc-audio-player.test.tsx`

- [ ] **Step 1: 写点击前不加载原媒体的失败测试**

在两个播放器测试中分别增加：

```tsx
it("does not mount the original video until the user starts playback", () => {
  render(
    <AigcVideoPlayer
      initialMetadata={{ duration: 8.4, height: 1080, width: 1920 }}
      mimeType="video/mp4"
      name="成片"
      posterUrl="/api/assets/video-1/preview/canvas_node?v=v1"
      url="/api/assets/video-1/content"
    />
  );

  expect(screen.queryByLabelText("播放视频：成片")).toBeNull();
  expect(screen.getByRole("img", { name: "成片视频预览" })).toHaveAttribute(
    "src",
    "/api/assets/video-1/preview/canvas_node?v=v1"
  );
  fireEvent.click(screen.getByRole("button", { name: "播放视频：成片" }));
  expect(screen.getByLabelText("播放视频：成片")).toHaveAttribute(
    "src",
    "/api/assets/video-1/content"
  );
});
```

```tsx
it("does not mount the original audio until the user starts playback", () => {
  render(
    <AigcAudioPlayer
      duration={8.4}
      mimeType="audio/mpeg"
      name="旁白"
      url="/api/assets/audio-1/content"
    />
  );

  expect(screen.queryByLabelText("播放音频：旁白")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "播放音频：旁白" }));
  expect(screen.getByLabelText("播放音频：旁白")).toHaveAttribute(
    "src",
    "/api/assets/audio-1/content"
  );
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && npm test -- tests/aigc-video-player.test.tsx tests/aigc-audio-player.test.tsx`

Expected: FAIL，播放器初始即挂载媒体元素或不支持 `posterUrl`。

- [ ] **Step 3: 实现交互门控**

给 `AigcVideoPlayer` 增加 `posterUrl?: string | null` 和
`eager?: boolean`，默认 `eager = variant === "panel"`。节点模式在未激活时渲染固定尺寸
`button`、`img.object-contain`、播放图标和现有元数据；点击后设置
`activated=true` 并挂载当前 `<video controls preload="metadata" src={url}>`。

给 `AigcAudioPlayer` 增加相同的 `eager` 规则。节点模式未激活时渲染名称、传入时长、
MIME 和播放按钮，不创建 `<audio>`；点击后才挂载现有播放器。面板模式保持立即可播放，
避免改变检查器和全屏预览行为。

- [ ] **Step 4: 运行播放器回归**

Run: `cd frontend && npm test -- tests/aigc-video-player.test.tsx tests/aigc-audio-player.test.tsx`

Expected: 所有播放器测试通过，节点模式点击前 DOM 中不存在带原始 URL 的媒体元素。

- [ ] **Step 5: 提交**

```bash
git add frontend/components/workspace/aigc/aigc-video-player.tsx frontend/components/workspace/aigc/aigc-audio-player.tsx frontend/tests/aigc-video-player.test.tsx frontend/tests/aigc-audio-player.test.tsx
git diff --cached --check
git commit -m "perf(aigc): defer original media loading"
```

### Task 4: 接入画布协调器并移除节点级 N+1

**Files:**
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-flow-node.tsx`
- Modify: `frontend/tests/aigc-editor.test.tsx`
- Modify: `frontend/tests/aigc-flow-node.test.tsx`

- [ ] **Step 1: 写编辑器单次批量请求失败测试**

扩展 `frontend/tests/aigc-editor.test.tsx` 的 API mock，加入
`getAssetPreviewManifest`，并增加：

```tsx
it("requests one manifest for local and projected media assets", async () => {
  apiMocks.getAssetPreviewManifest.mockResolvedValue({
    items: [
      readyImagePreview("local-image"),
      pendingVideoPreview("run-video")
    ]
  });
  const pipeline = pipelineWithLocalImageAndProjectedVideo();

  renderEditor(pipeline);

  await waitFor(() =>
    expect(apiMocks.getAssetPreviewManifest).toHaveBeenCalledWith(
      {
        asset_ids: ["local-image", "run-video"],
        variant: "canvas_node"
      },
      pipeline.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  );
  expect(apiMocks.getAssetPreviewManifest).toHaveBeenCalledOnce();
});
```

在 `frontend/tests/aigc-flow-node.test.tsx` 增加：

```tsx
it("reads a local image from preview context without fetching asset detail", async () => {
  renderNodeWithPreview(
    imageNode("image-node", "asset-image"),
    readyImagePreview("asset-image")
  );

  expect(
    await screen.findByRole("img", { name: "图片输入" })
  ).toHaveAttribute(
    "src",
    "/api/assets/asset-image/preview/canvas_node?v=v1"
  );
  expect(apiMocks.getAsset).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && npm test -- tests/aigc-editor.test.tsx tests/aigc-flow-node.test.tsx`

Expected: FAIL，编辑器未挂载 Preview Context，节点仍调用 `getAsset`。

- [ ] **Step 3: 在编辑器中汇总资产**

在 `AigcEditorContent` 中从 `runDetails` 提取当前投影涉及的可用
`AigcResultAsset`，调用 `collectCanvasPreviewAssetIds`，并在
`AigcRunProvider` 内、`NodeCanvas` 外包裹：

```tsx
<CanvasPreviewCoordinator
  assetIds={previewAssetIds}
  nodes={definition.nodes}
  pipelineId={entity.id}
  viewport={definition.viewport}
  viewportSize={canvasViewportSize}
>
  <NodeCanvas<AigcFlowNode> {...canvasProps} />
</CanvasPreviewCoordinator>
```

用 `ResizeObserver` 从 `canvasContainerRef` 维护 `canvasViewportSize`。
`onMoveEnd` 同时更新 store viewport，保证协调器能重新计算优先级。

- [ ] **Step 4: 节点改用预览缓存**

在 `AigcFlowNodeComponent` 中：

- 删除 `inputAssetQuery` 及 `apiClient.getAsset`。
- 依据本地 `config.asset_id` 或运行投影 `asset_id` 调用
  `useCanvasAssetPreview`。
- 图片首屏只给 `NodeImageMedia` 传 `preview_url`，保持固定媒体区、
  绝对定位和 `object-contain`。
- 精准编辑 URL 始终由 `getAssetContentUrlById(assetId)` 构造，不复用 WebP。
- 视频把 `preview_url` 传给 `AigcVideoPlayer.posterUrl`，原始
  `download_url` 仅作为点击后的 `url`。
- 音频只把 Manifest 的时长、MIME 和原始 `download_url` 传给
  `AigcAudioPlayer`。
- `pending` 显示“预览生成中”；图片两次刷新后仍未就绪时才以
  `getAssetContentUrlById(assetId)` 低优先级回退，视频和音频不得自动回退原文件。

- [ ] **Step 5: 运行定向回归**

Run: `cd frontend && npm test -- tests/aigc-editor.test.tsx tests/aigc-flow-node.test.tsx tests/aigc-flow-node-v2.test.tsx`

Expected: 测试通过；同一资产只进入一个 Manifest；节点不再调用 `getAsset`。

- [ ] **Step 6: 静态确认无旧查询**

Run: `rg -n 'input-asset|getAsset\\(inputAssetId' frontend/components/workspace/aigc/aigc-flow-node.tsx`

Expected: 无输出。

- [ ] **Step 7: 提交**

```bash
git add frontend/components/workspace/aigc/aigc-editor.tsx frontend/components/workspace/aigc/aigc-flow-node.tsx frontend/tests/aigc-editor.test.tsx frontend/tests/aigc-flow-node.test.tsx
git diff --cached --check
git commit -m "perf(aigc): share canvas preview metadata"
```

## 第二阶段：轻量派生物

### Task 5: 增加预览记录持久化

**Files:**
- Modify: `backend/app/db/models.py`
- Modify: `backend/app/db/__init__.py`
- Modify: `backend/app/repositories/base.py`
- Modify: `backend/app/repositories/memory.py`
- Modify: `backend/app/repositories/mysql.py`
- Modify: `backend/tests/test_database.py`
- Create: `backend/tests/test_asset_previews.py`

- [ ] **Step 1: 写数据库与仓储失败测试**

在 `backend/tests/test_database.py` 的期望表集合中加入 `asset_previews`，
并断言：

```python
preview_unique_constraints = {
    constraint["name"]
    for constraint in inspector.get_unique_constraints("asset_previews")
}
assert preview_unique_constraints == {"uq_asset_previews_source"}
assert any(
    foreign_key["constrained_columns"] == ["asset_id"]
    and foreign_key["referred_table"] == "assets"
    and foreign_key["options"].get("ondelete") == "CASCADE"
    for foreign_key in inspector.get_foreign_keys("asset_previews")
)
```

在 `backend/tests/test_asset_previews.py` 参数化
`InMemoryRepository` 与 SQLite `MySQLRepository`，验证相同
`(asset_id, variant, source_version)` 的 upsert 更新状态而不新增第二条记录。

- [ ] **Step 2: 运行测试并确认失败**

Run: `.venv/bin/pytest backend/tests/test_database.py backend/tests/test_asset_previews.py -q`

Expected: FAIL，缺少 `asset_previews` 表与仓储方法。

- [ ] **Step 3: 增加 ORM 与仓储协议**

在 `backend/app/db/models.py` 增加：

```python
class AssetPreviewORM(Base):
    __tablename__ = "asset_previews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    variant: Mapped[str] = mapped_column(String(32), nullable=False)
    source_version: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    object_key: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    attempt_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    __table_args__ = (
        UniqueConstraint(
            "asset_id",
            "variant",
            "source_version",
            name="uq_asset_previews_source",
        ),
    )
```

在 `Repository` 协议增加：

```python
def get_asset_preview(
    self,
    asset_id: str,
    variant: str,
    source_version: str,
) -> AssetPreviewRecord | None: ...

def upsert_asset_preview(
    self,
    preview: AssetPreviewRecord,
) -> AssetPreviewRecord: ...
```

- [ ] **Step 4: 实现两种仓储**

内存仓储使用
`dict[tuple[str, str, str], AssetPreviewRecord]` 并在锁内复制返回。
MySQL 仓储先按三列查询，缺失时新增 `AssetPreviewORM`，存在时更新状态、
对象键、媒体字段、错误码、次数和 `updated_at`；数据库唯一约束作为并发兜底。

- [ ] **Step 5: 运行数据库与仓储测试**

Run: `.venv/bin/pytest backend/tests/test_database.py backend/tests/test_asset_previews.py -q`

Expected: 新表、级联外键、唯一约束和两种仓储实现全部通过。

- [ ] **Step 6: 提交**

```bash
git add backend/app/db/models.py backend/app/db/__init__.py backend/app/repositories/base.py backend/app/repositories/memory.py backend/app/repositories/mysql.py backend/tests/test_database.py backend/tests/test_asset_previews.py
git diff --cached --check
git commit -m "feat(preview): persist asset preview records"
```

### Task 6: 生成图片 WebP 与视频海报帧

**Files:**
- Modify: `backend/app/services/asset_previews.py`
- Modify: `backend/app/services/assets.py`
- Modify: `backend/tests/test_asset_previews.py`

- [ ] **Step 1: 写图片派生失败测试**

```python
@pytest.mark.asyncio
async def test_image_preview_preserves_ratio_and_does_not_upscale(
    repository,
    asset_storage,
) -> None:
    source = create_public_image(repository, asset_storage, size=(1200, 1800))
    service = AssetPreviewService(repository, asset_storage)

    record = await service.generate(source.id, "canvas_node")

    assert record.status == AssetPreviewStatus.READY
    assert (record.width, record.height) == (427, 640)
    assert record.mime_type == "image/webp"
    content = asset_storage.client.get_object(key=record.object_key)
    with Image.open(BytesIO(content)) as preview:
        assert preview.size == (427, 640)
        assert preview.format == "WEBP"
```

同时增加 320x200 小图不放大、RGBA 透明通道保留测试。

- [ ] **Step 2: 写视频派生失败测试**

给服务注入 `frame_extractor: VideoFrameExtractor`，使用 fake extractor 返回
1280x720 PNG，断言生成 640x360 WebP；再让 fake 连续失败三次，断言
`attempt_count == 3` 且状态为 `unavailable`。

- [ ] **Step 3: 运行派生测试并确认失败**

Run: `.venv/bin/pytest backend/tests/test_asset_previews.py -k 'image_preview or video_preview or retries' -q`

Expected: FAIL，缺少 `generate`、缩放和视频帧提取。

- [ ] **Step 4: 实现图片派生**

在 `AssetPreviewService.generate` 中：

1. 读取源内容。
2. 对图片使用 `ImageOps.exif_transpose`。
3. 使用 `thumbnail((640, 640), Image.Resampling.LANCZOS)`，不放大小图。
4. RGBA/LA 保留 alpha，其余转 RGB。
5. 以 `quality=82, method=6` 写入 WebP。
6. 对象键固定为
   `previews/{asset_id}/canvas_node/{source_version}.webp`。
7. 成功上传后 upsert `ready`；失败时递增次数，前两次重新调度，第三次写
   `unavailable`。

- [ ] **Step 5: 实现视频帧提取**

在同文件增加 `FfmpegVideoFrameExtractor`：

```python
class FfmpegVideoFrameExtractor:
    def __init__(self, ffmpeg_path: str | None = None) -> None:
        self.ffmpeg_path = ffmpeg_path or shutil.which("ffmpeg")

    async def extract(self, content: bytes) -> bytes:
        if not self.ffmpeg_path:
            raise AssetPreviewGenerationError("ffmpeg_unavailable")
        with TemporaryDirectory(prefix="asset-preview-") as directory:
            source = Path(directory) / "source"
            output = Path(directory) / "frame.png"
            await asyncio.to_thread(source.write_bytes, content)
            process = await asyncio.create_subprocess_exec(
                self.ffmpeg_path,
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                "0.1",
                "-i",
                str(source),
                "-frames:v",
                "1",
                "-vf",
                "thumbnail=30",
                "-y",
                str(output),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await process.communicate()
            if process.returncode != 0 or not output.exists():
                raise AssetPreviewGenerationError(
                    f"video_frame_failed:{process.returncode}"
                )
            return await asyncio.to_thread(output.read_bytes)
```

将提取的 PNG 交给同一个 WebP 缩放函数。异常日志只记录错误类型、资产 ID 和请求 ID，
不记录签名 URL 或媒体内容。

- [ ] **Step 6: 让 Manifest 使用持久化记录并幂等调度**

`manifest` 对图片和视频读取当前版本记录：

- `ready` 返回版本化 `/api/assets/{id}/preview/canvas_node?v={version}`。
- 无记录时先 upsert `pending`，再通过 `BackgroundTaskRunner.schedule` 调用生成。
- 已是 `pending` 时不得再次调度。
- 音频写入无 `object_key` 的 `ready` 记录并返回元数据。
- 失败次数达到 3 时返回 `unavailable`。

在成功写入公开图片、视频或音频的 `AssetStorageService.upload_asset` 和
`register_asset` 调用点，通过注入的预览调度回调主动执行
`schedule(asset.id, "canvas_node")`；旧资产仍由 Manifest 懒补。

- [ ] **Step 7: 运行派生服务测试**

Run: `.venv/bin/pytest backend/tests/test_asset_previews.py backend/tests/test_assets.py -k preview -q`

Expected: 图片比例、透明度、视频海报、幂等、两次重试和版本变化测试通过。

- [ ] **Step 8: 提交**

```bash
git add backend/app/services/asset_previews.py backend/app/services/assets.py backend/tests/test_asset_previews.py backend/tests/test_assets.py
git diff --cached --check
git commit -m "feat(preview): generate lightweight media derivatives"
```

### Task 7: 提供版本化预览内容与共享连接池

**Files:**
- Modify: `backend/app/api/dependencies.py`
- Modify: `backend/app/api/routes.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_assets.py`

- [ ] **Step 1: 写内容代理失败测试**

在 `backend/tests/test_assets.py` 增加：

```python
def test_preview_content_proxies_cache_headers_and_conditional_request(
    client,
    ready_preview,
    preview_http_requests,
) -> None:
    response = client.get(
        f"/api/assets/{ready_preview.asset_id}/preview/canvas_node"
        f"?v={ready_preview.source_version}",
        headers={"If-None-Match": '"preview-etag"'},
    )

    assert response.status_code == 304
    assert response.headers["cache-control"] == (
        "private, max-age=86400, immutable"
    )
    assert preview_http_requests[0].headers["if-none-match"] == '"preview-etag"'
```

再增加以下断言：

- 版本不匹配返回 404。
- 非公开资产返回 404。
- Range 请求透传并返回 206、`Content-Range`。
- 两次请求使用 fixture 注入的同一 `httpx.AsyncClient` 实例。
- 透传 `Content-Type`、`Content-Length`、`ETag`、`Last-Modified`。

- [ ] **Step 2: 运行内容测试并确认失败**

Run: `.venv/bin/pytest backend/tests/test_assets.py -k preview_content -q`

Expected: FAIL，预览内容路由返回 404。

- [ ] **Step 3: 增加共享客户端依赖**

在 `backend/app/api/dependencies.py` 增加：

```python
@lru_cache
def get_asset_proxy_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(follow_redirects=True, timeout=30.0)


async def close_asset_proxy_http_client() -> None:
    if get_asset_proxy_http_client.cache_info().currsize:
        await get_asset_proxy_http_client().aclose()
        get_asset_proxy_http_client.cache_clear()
```

让原始内容接口和新预览内容接口都通过
`Depends(get_asset_proxy_http_client)` 使用该客户端，移除路由内部
`httpx.AsyncClient(...)` 创建与关闭逻辑。

- [ ] **Step 4: 实现预览内容路由**

```python
@router.get(
    "/assets/{asset_id}/preview/{variant}",
    tags=["assets"],
)
async def get_asset_preview_content(
    asset_id: str,
    variant: Literal["canvas_node"],
    request: Request,
    v: str = Query(..., min_length=1, max_length=64),
    preview_service: AssetPreviewService = Depends(get_asset_preview_service),
    http_client: httpx.AsyncClient = Depends(get_asset_proxy_http_client),
):
    preview = preview_service.get_ready_preview(asset_id, variant, v)
    access_url = preview_service.signed_preview_url(preview)
    forwarded = {
        name: value
        for name in ("Range", "If-None-Match", "If-Modified-Since")
        if (value := request.headers.get(name))
    }
    upstream = await http_client.send(
        http_client.build_request("GET", access_url, headers=forwarded),
        stream=True,
    )
    headers = preview_response_headers(upstream.headers)
    headers["Cache-Control"] = "private, max-age=86400, immutable"
    if upstream.status_code == status.HTTP_304_NOT_MODIFIED:
        await upstream.aclose()
        return Response(status_code=304, headers=headers)
    upstream.raise_for_status()
    return StreamingResponse(
        close_after_stream(upstream),
        status_code=upstream.status_code,
        headers=headers,
        media_type=preview.mime_type,
    )
```

`preview_response_headers` 只复制
`Accept-Ranges`、`Content-Length`、`Content-Range`、`ETag` 和
`Last-Modified`。错误统一转换为现有结构化 404/502。

- [ ] **Step 5: 在生命周期中关闭连接池**

在 `backend/app/main.py` 的 lifespan `finally` 中调用
`await close_asset_proxy_http_client()`；测试 app 用 dependency override 注入
`httpx.MockTransport` 客户端，避免真实网络。

- [ ] **Step 6: 运行代理与既有 Range 回归**

Run: `.venv/bin/pytest backend/tests/test_assets.py -k 'preview_content or asset_content_proxy_preserves_video_range_response' -q`

Expected: 条件请求、Range、缓存头和连接池测试全部通过。

- [ ] **Step 7: 提交**

```bash
git add backend/app/api/dependencies.py backend/app/api/routes.py backend/app/main.py backend/tests/conftest.py backend/tests/test_assets.py
git diff --cached --check
git commit -m "perf(assets): reuse preview proxy connections"
```

## 第三阶段：调度与度量

### Task 8: 实现三级可视优先队列

**Files:**
- Modify: `frontend/lib/aigc/asset-preview.ts`
- Modify: `frontend/components/workspace/aigc/aigc-preview-context.tsx`
- Modify: `frontend/components/workspace/aigc/aigc-editor.tsx`
- Modify: `frontend/tests/aigc-asset-preview.test.ts`
- Modify: `frontend/tests/aigc-preview-context.test.tsx`

- [ ] **Step 1: 写优先级失败测试**

```ts
it("orders visible, near, then offscreen previews without duplicates", () => {
  const priorities = rankCanvasPreviewAssets({
    nodes: [
      mediaNode("visible", "asset-visible", { x: 100, y: 100 }),
      mediaNode("near", "asset-near", { x: 900, y: 100 }),
      mediaNode("far", "asset-far", { x: 2500, y: 100 }),
      mediaNode("duplicate", "asset-visible", { x: 2600, y: 100 })
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    viewportSize: { height: 600, width: 800 }
  });

  expect(priorities).toEqual([
    { assetId: "asset-visible", priority: 0 },
    { assetId: "asset-near", priority: 1 },
    { assetId: "asset-far", priority: 2 }
  ]);
});

it("runs at most six preview file loads concurrently", async () => {
  const gate = createDeferred<void>();
  const loader = vi.fn(() => gate.promise);
  const queue = new PreviewLoadQueue({ concurrency: 6, loader });
  const promises = Array.from({ length: 8 }, (_, index) =>
    queue.load(`/preview/${index}`, index < 2 ? 0 : 1)
  );

  await Promise.resolve();
  expect(loader).toHaveBeenCalledTimes(6);
  gate.resolve();
  await Promise.all(promises);
  expect(loader).toHaveBeenCalledTimes(8);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && npm test -- tests/aigc-asset-preview.test.ts tests/aigc-preview-context.test.tsx`

Expected: FAIL，缺少分级与并发队列。

- [ ] **Step 3: 实现空间分级**

`rankCanvasPreviewAssets` 将节点矩形转换为屏幕坐标：

```ts
const screenRect = {
  left: node.position.x * viewport.zoom + viewport.x,
  top: node.position.y * viewport.zoom + viewport.y,
  right:
    (node.position.x + node.size.width) * viewport.zoom + viewport.x,
  bottom:
    (node.position.y + node.size.height) * viewport.zoom + viewport.y
};
```

与当前视口相交为优先级 0；与上下左右各扩一屏后的矩形相交为优先级 1；
其余为优先级 2。同一资产取其所有节点中的最高优先级。

- [ ] **Step 4: 实现并发队列**

`PreviewLoadQueue` 按 `(priority, sequence)` 排序，URL 作为共享 key：

- 同一 URL 已完成时直接返回。
- 同一 URL 正在加载时返回同一 Promise。
- 活跃任务不超过 6。
- `cancelUnstarted(validUrls)` 删除离开 Pipeline 且尚未开始的任务。
- 媒体节点总数大于 24 时，优先级 2 使用
  `requestIdleCallback`；无该 API 时使用 200ms `setTimeout`。

协调器通过 `new Image()` 预加载 ready 图片和视频 poster，加载完成后才将
`displayable=true` 暴露给节点，防止所有 `<img>` 同时抢占网络。预览文件
`onerror` 时删除对应 `assetPreviewKey`，只重新请求一次 Manifest；再次失败则将
图片标记为可回退原图、视频标记为可交互占位，避免无限重试。

- [ ] **Step 5: 运行调度测试**

Run: `cd frontend && npm test -- tests/aigc-asset-preview.test.ts tests/aigc-preview-context.test.tsx`

Expected: 排序、并发上限、共享 URL、取消和 idle 调度测试通过。

- [ ] **Step 6: 提交**

```bash
git add frontend/lib/aigc/asset-preview.ts frontend/components/workspace/aigc/aigc-preview-context.tsx frontend/components/workspace/aigc/aigc-editor.tsx frontend/tests/aigc-asset-preview.test.ts frontend/tests/aigc-preview-context.test.tsx
git diff --cached --check
git commit -m "perf(aigc): prioritize visible canvas previews"
```

### Task 9: 接入后端 TLS 与前端性能指标

**Files:**
- Modify: `backend/app/schemas/asset_preview.py`
- Modify: `backend/app/schemas/__init__.py`
- Modify: `backend/app/services/asset_previews.py`
- Modify: `backend/app/api/routes.py`
- Modify: `backend/tests/test_asset_previews.py`
- Modify: `backend/tests/test_assets.py`
- Modify: `frontend/lib/api-client.ts`
- Modify: `frontend/components/workspace/aigc/aigc-preview-context.tsx`
- Modify: `frontend/tests/aigc-preview-context.test.tsx`
- Modify: `frontend/tests/api-client.test.ts`

- [ ] **Step 1: 写结构化指标失败测试**

后端使用 `caplog` 验证 Manifest、派生事件和浏览器指标接收：

```python
def test_manifest_logs_privacy_safe_tls_metrics(
    caplog,
    preview_service,
) -> None:
    preview_service.manifest(["asset-image"], pipeline_id="pipeline-1")

    record = next(
        item
        for item in caplog.records
        if getattr(item, "structured_event", None)
        == "canvas_preview.manifest"
    )
    context = record.structured_context
    assert context["pipeline_id"] == "pipeline-1"
    assert context["asset_count"] == 1
    assert context["duration_ms"] >= 0
    assert "signed_url" not in context
```

在 `backend/tests/test_assets.py` 增加：

```python
def test_canvas_preview_client_metrics_are_validated_and_logged(
    client,
    caplog,
) -> None:
    response = client.post(
        "/api/telemetry/canvas-preview",
        json={
            "all_visible_ms": 1240.5,
            "bytes": 281230,
            "cache_hit_count": 5,
            "first_visible_ms": 340.2,
            "original_fallback_count": 0,
            "pipeline_id": "pipeline-1",
            "visible_asset_count": 12,
        },
    )

    assert response.status_code == 204
    record = next(
        item
        for item in caplog.records
        if getattr(item, "structured_event", None)
        == "canvas_preview.client_metrics"
    )
    assert record.structured_context["pipeline_id"] == "pipeline-1"
    assert record.structured_context["all_visible_ms"] == 1240.5
```

前端 mock `performance.mark` 和 `performance.measure`，验证第一个可视预览及
全部可视预览只记录一次、调用一次 `reportCanvasPreviewMetrics`，并在 Pipeline
切换后重置。

- [ ] **Step 2: 运行指标测试并确认失败**

Run: `.venv/bin/pytest backend/tests/test_asset_previews.py backend/tests/test_assets.py -k metrics -q && cd frontend && npm test -- tests/aigc-preview-context.test.tsx tests/api-client.test.ts`

Expected: FAIL，尚未发出预览指标。

- [ ] **Step 3: 增加后端结构化事件**

使用 `log_event` 发出：

- `canvas_preview.manifest`：`pipeline_id`、`asset_count`、`duration_ms`。
- `canvas_preview.derivative`：`asset_id`、`asset_kind`、`preview_variant`、
  `source_version`、`status`、`duration_ms`、`size_bytes`。
- `canvas_preview.content`：`asset_id`、`preview_variant`、`source_version`、
  `status`、`size_bytes`、`cache_hit`。

Manifest 路由读取已校验的 `X-Pipeline-ID` 请求头并传给服务。上下文依赖现有
middleware 自动附加 `request_id`。不得记录签名 URL、媒体内容或模型原文。

- [ ] **Step 4: 增加浏览器指标接收契约与路由**

在 `backend/app/schemas/asset_preview.py` 增加边界明确的请求模型：

```python
class CanvasPreviewClientMetrics(SchemaModel):
    pipeline_id: str = Field(..., min_length=1, max_length=36)
    visible_asset_count: int = Field(..., ge=0, le=100)
    first_visible_ms: float | None = Field(default=None, ge=0, le=300_000)
    all_visible_ms: float | None = Field(default=None, ge=0, le=300_000)
    bytes: int = Field(default=0, ge=0)
    cache_hit_count: int = Field(default=0, ge=0, le=100)
    original_fallback_count: int = Field(default=0, ge=0, le=100)
```

在 `backend/app/api/routes.py` 增加：

```python
@router.post(
    "/telemetry/canvas-preview",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["telemetry"],
)
def report_canvas_preview_metrics(
    payload: CanvasPreviewClientMetrics,
) -> Response:
    log_event(
        logger,
        "canvas_preview.client_metrics",
        outcome="succeeded",
        **payload.model_dump(),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

在 `frontend/lib/api-client.ts` 增加：

```ts
reportCanvasPreviewMetrics(
  payload: CanvasPreviewClientMetrics,
  requestOptions?: RequestOptions
) {
  return request<void>(
    fetcher,
    baseUrl,
    "/api/telemetry/canvas-preview",
    {
      ...requestOptions,
      body: payload,
      headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
      method: "POST"
    }
  );
},
```

- [ ] **Step 5: 增加前端 Performance Marks**

在 `AigcEditorContent` 首次完成画布挂载与 React Flow `onInit` 时记录
`performance.mark("aigc_editor_interactive")`。协调器以该 mark 为计时起点，
记录：

```ts
performance.mark("canvas_preview_first_visible");
performance.measure(
  "canvas_preview_first_visible_ms",
  "aigc_editor_interactive",
  "canvas_preview_first_visible"
);

performance.mark("canvas_preview_all_visible");
performance.measure(
  "canvas_preview_all_visible_ms",
  "aigc_editor_interactive",
  "canvas_preview_all_visible"
);
```

同时统计预览资源 `transferSize`、缓存命中和图片原图回退次数，通过
`apiClient.reportCanvasPreviewMetrics` 发送不含媒体 URL 的结构化 JSON；单个
Pipeline 会话只发送一次。

- [ ] **Step 6: 运行指标测试**

Run: `.venv/bin/pytest backend/tests/test_asset_previews.py backend/tests/test_assets.py -k metrics -q && cd frontend && npm test -- tests/aigc-preview-context.test.tsx tests/api-client.test.ts`

Expected: 后端字段、前端 mark/measure、去重与重置测试通过。

- [ ] **Step 7: 提交**

```bash
git add backend/app/schemas/asset_preview.py backend/app/schemas/__init__.py backend/app/services/asset_previews.py backend/app/api/routes.py backend/tests/test_asset_previews.py backend/tests/test_assets.py frontend/lib/api-client.ts frontend/components/workspace/aigc/aigc-preview-context.tsx frontend/tests/aigc-preview-context.test.tsx frontend/tests/api-client.test.ts
git diff --cached --check
git commit -m "feat(preview): record canvas preview metrics"
```

### Task 10: 增加三视口 Playwright 验收

**Files:**
- Create: `frontend/scripts/verify-aigc-canvas-previews.py`
- Modify: `frontend/package.json`

- [ ] **Step 1: 编写可重复验收脚本**

脚本复用现有 acceptance Pipeline 入口，准备至少 12 个混合图片、视频和音频节点；
对桌面 `1440x900`、平板 `900x1024`、手机 `390x844` 分别：

```python
manifest_requests: list[str] = []
original_media_requests: list[str] = []
preview_requests: list[str] = []

def record_request(request) -> None:
    url = request.url
    if "/api/assets/preview-manifest" in url:
        manifest_requests.append(url)
    elif "/api/assets/" in url and "/preview/canvas_node" in url:
        preview_requests.append(url)
    elif "/api/assets/" in url and "/content" in url:
        original_media_requests.append(url)

page.on("request", record_request)
page.goto(pipeline_url, wait_until="domcontentloaded")
page.get_by_test_id("aigc-editor-shell").wait_for()
page.wait_for_function(
    """
    () => performance.getEntriesByName(
      "canvas_preview_all_visible_ms"
    ).length === 1
    """
)

assert len(manifest_requests) == 1
assert not [
    url for url in original_media_requests
    if any(asset_id in url for asset_id in video_and_audio_asset_ids)
]
assert len(preview_requests) == len(set(preview_requests))
```

再读取两个 Performance Measure，断言首个可见预览不超过 800ms、12 个可见节点
全部预览不超过 2000ms。检查每个媒体元素的 `naturalWidth/naturalHeight` 与
`getBoundingClientRect()`，确认 `object-fit: contain`、没有裁切、没有页面横向溢出
和控件重叠，并为三个视口各保存截图及 JSON evidence。

- [ ] **Step 2: 登记命令**

在 `frontend/package.json` 的 scripts 增加：

```json
"acceptance:aigc-canvas-previews": "../.venv/bin/python scripts/verify-aigc-canvas-previews.py"
```

- [ ] **Step 3: 启动服务并验证**

Run: `cd backend && ../.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`

Expected: `/health` 返回 200，启动日志确认 TLS Sink 状态。

Run: `cd frontend && npm run dev -- --hostname 127.0.0.1 --port 3000`

Expected: Next.js ready，`http://127.0.0.1:3000/workspace/aigc/acceptance` 可访问。

Run: `cd frontend && AIGC_WORKSPACE_URL=http://127.0.0.1:3000/workspace/aigc/acceptance npm run acceptance:aigc-canvas-previews`

Expected: 三视口全部 PASS；evidence 包含请求计数、两个时延、资源字节数和截图路径。

- [ ] **Step 4: 提交脚本，不提交运行产物**

```bash
git add frontend/scripts/verify-aigc-canvas-previews.py frontend/package.json
git diff --cached --check
git commit -m "test(preview): verify canvas preview performance"
```

## 最终验证

### Task 11: 完整回归与真实 Pipeline P75 验收

**Files:**
- Verify only

- [ ] **Step 1: 运行后端完整测试**

Run: `.venv/bin/pytest backend/tests -q`

Expected: 全部通过。

- [ ] **Step 2: 运行前端完整测试**

Run: `cd frontend && npm test`

Expected: 全部通过。

- [ ] **Step 3: 运行类型与 lint**

Run: `cd frontend && npm run typecheck && npm run lint`

Expected: TypeScript 无错误，ESLint 零 warning。

- [ ] **Step 4: 重启服务并确认 TLS**

完整停止旧的 Next.js 与 FastAPI 进程组，再按 Task 10 的命令启动。确认后端启动日志无
TLS 配置错误，`curl -fsS http://127.0.0.1:8000/health` 返回
`{"status":"ok",...}`。

- [ ] **Step 5: 运行三视口验收**

Run: `cd frontend && AIGC_WORKSPACE_URL=http://127.0.0.1:3000/workspace/aigc/acceptance npm run acceptance:aigc-canvas-previews`

Expected: 桌面、平板、手机全部通过；初始化只有一次 Manifest；没有视频/音频原始内容请求；
重复资产只传输一次预览；图片与 poster 无裁切、拉伸或节点布局跳动。

- [ ] **Step 6: 真实 Pipeline 连续采样**

对至少包含 12 个可见混合媒体节点的真实 Pipeline 连续刷新 20 次，导出
`canvas_preview_first_visible_ms` 与 `canvas_preview_all_visible_ms`，
按升序取第 15 个样本作为 P75：

```text
canvas_preview_first_visible_ms P75 <= 800
canvas_preview_all_visible_ms P75 <= 2000
```

同时在 TLS 查询
`canvas_preview.manifest`、`canvas_preview.derivative` 和
`canvas_preview.content`，确认 `pipeline_id`、`asset_id`、`asset_kind`、
`preview_variant`、`source_version`、`status`、`duration_ms`、
`size_bytes`、`request_id` 字段齐全，且不存在签名 URL 或媒体内容。

- [ ] **Step 7: 检查最终差异**

Run: `git status --short && git diff --check && git log --oneline -11`

Expected: 仅存在已知的用户改动或验收产物；本功能代码均已提交，差异检查无错误。

- [ ] **Step 8: 提交必要的验收阈值修正**

仅当真实数据要求调整并发数、WebP 尺寸或缓存时间时，修改对应常量并重跑步骤 1-6：

```bash
git add backend/app/services/asset_previews.py frontend/lib/aigc/asset-preview.ts frontend/components/workspace/aigc/aigc-preview-context.tsx
git diff --cached --check
git commit -m "perf(preview): tune canvas preview thresholds"
```

若无需调整，不创建空提交。

## 完成判定

- Manifest 对最多 100 个公开资产去重并保持首次出现顺序，单项失败不拖垮整批。
- 历史资产可懒生成，新成功资产会主动调度；同版本任务幂等，失败最多重试两次。
- 图片与视频派生物最长边 640px、保持方向和比例、不放大小图，图片透明度保留。
- 预览 URL 带内容版本；内容代理支持 ETag、Last-Modified、304、Range 和共享连接池。
- 节点不再执行 `getAsset` N+1；同一资产共享 React Query 记录和浏览器预览缓存。
- 视频与音频点击前没有原始媒体请求，点击后播放、下载和精准编辑仍使用原始地址。
- 三级视口优先级、6 并发上限、超过 24 节点的 idle 调度和离开 Pipeline 取消均有测试。
- TLS 指标和前端 Performance Measure 可查询，敏感 URL 和媒体内容不进入本地日志。
- 后端测试、Vitest、TypeScript、ESLint、三视口 Playwright 与真实 Pipeline P75 全部达标。
