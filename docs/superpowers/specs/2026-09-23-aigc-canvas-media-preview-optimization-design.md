# AIGC 画布多模态节点快速预览设计

## 背景

当前 AIGC 画布中的图片、视频和音频节点直接依赖资产详情及原始媒体内容：

- 本地素材节点按资产 ID 分别调用详情接口，节点数量增加后形成 N 个请求。
- 节点配置面板和媒体校验逻辑会分别拉取完整项目资产与工具资产列表。
- 图片节点直接加载原图。
- 视频和音频节点挂载后立即通过 `preload="metadata"` 请求原始媒体。
- `/api/assets/{asset_id}/content` 会由 FastAPI 获取签名地址并代理回源媒体内容。
- React Query 只能去重相同 query key，无法合并不同节点的资产详情请求，也无法减少原始媒体体积。

这些行为叠加后，使画布打开时间同时受请求数量、原始文件大小、TOS 回源和浏览器媒体解析影响。节点越多、视频越多，预览出现越慢。

## 目标

本设计优先优化“打开画布后，所有可见多模态节点快速出现可辨认预览”。

验收目标：

- 首个可见媒体预览 P75 不超过 `800ms`。
- 12 个可见媒体节点全部出现预览的 P75 不超过 `2s`。
- 画布初始化阶段不请求视频或音频原始文件。
- 同一资产被多个节点引用时，只下载一次对应预览。
- 画布初始化阶段的资产元数据请求由 N 次降低为 1 次批量请求。
- 图片、视频预览继续保持原始宽高比，使用固定媒体区和 `object-contain`，禁止裁切或拉伸。
- 预览失败不阻塞画布编辑、执行、精准编辑或媒体下载。

## 非目标

- 本次不改造资产库页面的分页、搜索和瀑布流虚拟化。
- 本次不引入 HLS、自适应码率或完整媒体 CDN 平台。
- 本次不修改 Pipeline、节点或运行快照的数据结构。
- 本次不改变原始媒体下载、播放、精准编辑和 AIGC 执行使用的内容地址。
- 本次不为音频实现可编辑波形；首期只使用现有时长、格式等轻量信息。

## 方案选择

采用“预览专用链路”方案：

1. 画布级协调器收集所有节点当前引用的资产 ID。
2. 前端通过单次批量请求获取预览清单。
3. 后端为图片生成轻量 WebP，为视频生成首帧海报图，为音频返回轻量元数据。
4. 节点初始化只加载预览派生物。
5. 用户播放、放大、精准编辑或下载时再访问原始媒体。
6. 预览派生物使用内容版本 URL 和浏览器缓存。

该方案比单纯前端懒加载更能降低网络体积，也比建设完整媒体平台更适合当前范围。

## 总体架构

```text
Pipeline definition + run projection
                |
                v
CanvasPreviewCoordinator
  - collect/dedupe asset ids
  - visible-first scheduling
  - normalized preview cache
                |
                | one batch request
                v
POST /api/assets/preview-manifest
                |
                v
AssetPreviewService
  - validate public assets
  - read preview records
  - enqueue missing derivatives
                |
        +-------+--------+
        |                |
        v                v
asset_previews       TOS preview objects
metadata/status      image WebP / video poster
```

原始媒体仍通过现有内容接口访问，但不参与画布首屏预览。

## 后端设计

### 批量预览清单接口

新增：

```http
POST /api/assets/preview-manifest
Content-Type: application/json
```

请求：

```json
{
  "asset_ids": ["asset-a", "asset-b"],
  "variant": "canvas_node"
}
```

约束：

- `asset_ids` 去重后最多 100 个。
- 只返回 `asset_role=public` 的资产。
- 不存在或不可访问的 ID 以单项 `unavailable` 返回，避免整个请求失败。
- 返回顺序与请求顺序一致。

响应：

```json
{
  "items": [
    {
      "asset_id": "asset-a",
      "kind": "image",
      "status": "ready",
      "version": "8cecb5cf09c64f3a",
      "preview_url": "/api/assets/asset-a/preview/canvas_node?v=8cecb5cf09c64f3a",
      "mime_type": "image/webp",
      "width": 640,
      "height": 360,
      "duration_seconds": null
    },
    {
      "asset_id": "asset-b",
      "kind": "video",
      "status": "pending",
      "version": "739dae10b19329ae",
      "preview_url": null,
      "mime_type": null,
      "width": 1920,
      "height": 1080,
      "duration_seconds": 8.4
    }
  ]
}
```

`status` 取值：

- `ready`：预览可直接加载。
- `pending`：派生任务已存在或本次已触发。
- `unavailable`：资产不存在、不支持或派生失败达到重试上限。

### 预览内容接口

新增：

```http
GET /api/assets/{asset_id}/preview/{variant}?v={version}
```

行为：

- 校验资产为公开资产，并校验请求版本与当前预览记录一致。
- 使用稳定代理 URL，不向浏览器暴露 TOS 签名参数。
- 复用应用级 `httpx.AsyncClient` 连接池，不为每个预览请求创建新客户端。
- 透传 `Content-Type`、`Content-Length`、`ETag` 和 `Last-Modified`。
- 返回 `Cache-Control: private, max-age=86400, immutable`。
- 支持条件请求和 `304 Not Modified`。

### 预览派生物

首期只提供 `canvas_node` 变体：

| 资产类型 | 预览内容 | 规格 |
|---|---|---|
| 图片 | WebP 缩略图 | 最长边 640px，保持比例，不放大小图 |
| 视频 | WebP 海报帧 | 首个有效画面，最长边 640px |
| 音频 | 无媒体文件 | 返回时长、MIME 等已有元数据 |

图片和视频预览不得改变方向，不得裁切，并应保留透明背景信息；节点显示层继续使用 `object-contain`。

### 派生记录

新增 `asset_previews` 表：

- `asset_id`
- `variant`
- `source_version`
- `status`
- `object_key`
- `mime_type`
- `width`
- `height`
- `size_bytes`
- `error_code`
- `attempt_count`
- `created_at`
- `updated_at`

唯一约束为 `(asset_id, variant, source_version)`。

`source_version` 优先使用对象存储 ETag；没有 ETag 时由原始内容字段生成：

```text
storage_etag
or sha256(object_key + size_bytes + mime_type)[:16]
```

资产对象键必须保持内容不可变。资产重命名不会使预览失效；原始对象或
ETag 变化时会生成新版本。音频的元数据型预览记录允许 `object_key`
为空。

### 生成时机

- 新资产进入 `succeeded` 状态后主动调度预览派生。
- 旧资产首次出现在 Preview Manifest 中且没有预览时，幂等调度补生成。
- 同一 `(asset_id, variant, source_version)` 只能存在一个进行中的任务。
- 首期复用现有后台任务运行机制，不新增消息队列产品。
- 单次失败自动重试两次；此后标记 `unavailable`，等待源资产版本变化或人工重试。

## 前端设计

### 画布级预览协调器

新增 `CanvasPreviewCoordinator`，由 `AigcEditor` 创建并通过 Context 提供给节点。

职责：

- 从 Pipeline 定义中收集本地模态节点的 `config.asset_id`。
- 从运行投影中收集图片、视频和音频结果的 `asset_id`。
- 去重后调用一次 Preview Manifest。
- 将响应按 `asset_id` 写入规范化 React Query 缓存。
- 运行投影变化时只请求新增或版本未知的资产。
- 取消已离开当前 Pipeline 的未开始任务。

缓存 key：

```text
["asset-preview", assetId, "canvas_node"]
```

建议配置：

- `staleTime`: 5 分钟。
- `gcTime`: 30 分钟。
- `refetchOnWindowFocus`: false。
- `retry`: 仅网络错误重试 1 次。

### 加载优先级

预览加载分为三级：

1. 画布可视区域内的节点。
2. 可视区域外扩一个视口范围内的节点。
3. 其他节点。

最多同时加载 6 个预览文件。Pipeline 媒体节点不超过 24 个时仍会加载全部轻量预览，但保持上述优先级；超过 24 个时，第三级等待空闲时段。

可见性根据 React Flow viewport、节点 position 和 size 计算，不依赖节点 DOM 是否挂载。

### 节点渲染

图片节点：

- 首屏使用 Preview Manifest 的 WebP。
- 放大预览和精准编辑继续使用原始内容 URL。
- 预览加载完成前显示固定尺寸骨架，不改变节点布局。

视频节点：

- 首屏渲染海报图和播放图标，不创建带 `src` 的 `<video>`。
- 用户点击播放后再挂载现有 `AigcVideoPlayer` 并请求原始视频。
- 退出播放状态后可保留播放器，避免重复下载。

音频节点：

- 首屏显示名称、时长、格式和播放按钮，不创建带 `src` 的 `<audio>`。
- 用户点击播放后再挂载现有 `AigcAudioPlayer`。

文本节点不进入预览清单。

### 查询收敛

- 删除 `AigcFlowNode` 中每个本地节点独立执行的 `getAsset` 查询。
- 节点配置面板继续使用资产选择列表，但与画布预览缓存分离。
- `media-validation-assets` 继续服务执行校验，不作为节点显示数据源。
- 同一资产在多个节点中共享一份预览记录和浏览器缓存。

## 数据流

1. Pipeline 页面完成基础定义渲染。
2. 编辑器从定义和当前运行投影提取资产 ID。
3. 协调器立即请求 Preview Manifest。
4. 后端返回已就绪预览，并为缺失预览幂等调度派生。
5. 节点按照可见优先级请求预览文件。
6. `pending` 项在 `500ms` 和 `1500ms` 后最多刷新两次清单。
7. 用户与媒体交互时才加载原始文件。
8. 新运行结果到达后，协调器只追加解析新增资产。

## 降级与错误处理

- Preview Manifest 整体失败：节点保持轻量占位，网络错误自动重试一次。
- 单项 `pending`：显示“预览生成中”，不请求视频或音频原文件。
- 图片预览两次刷新后仍未就绪：仅可视图片节点低优先级回退原图。
- 视频或音频预览不可用：保留可交互占位，用户点击后仍可加载原始媒体。
- 预览文件请求失败：清除该项预览缓存并重新获取一次清单；仍失败则进入上述类型回退。
- 原始媒体加载失败：沿用现有播放器和节点错误状态，不把预览成功误判为原始媒体可用。
- Pipeline 切换和组件卸载时取消尚未开始的预览请求。

## 可观测性

新增结构化指标并推送至 TLS：

- `canvas_preview_manifest_duration_ms`
- `canvas_preview_manifest_asset_count`
- `canvas_preview_first_visible_ms`
- `canvas_preview_all_visible_ms`
- `canvas_preview_bytes`
- `canvas_preview_cache_hit`
- `canvas_preview_derivative_status`
- `canvas_preview_original_fallback_count`

日志字段至少包含：

- `pipeline_id`
- `asset_id`
- `asset_kind`
- `preview_variant`
- `source_version`
- `status`
- `duration_ms`
- `size_bytes`
- `request_id`

不在本地控制台输出签名 URL、媒体内容或模型原文。

## 兼容与迁移

- Preview Manifest 是新增接口，不修改现有 `Asset` 响应。
- 没有预览记录的历史资产通过首次访问触发补生成。
- 前端在灰度期间保留原始媒体回退。
- 预览表和对象可独立删除并重新生成，不影响原始资产。
- 现有下载 URL、精准编辑 URL 和执行输入 URL 保持不变。

## 实施阶段

### 第一阶段：请求收敛

- 新增 Preview Manifest 和前端画布级协调器。
- 批量返回资产类型、状态、尺寸、时长及当前可用预览 URL。
- 移除节点级资产详情 N+1 查询。
- 视频和音频改为用户交互后才挂载原始媒体元素。

第一阶段尚无派生物时，图片可返回现有原图代理 URL 作为临时预览；
视频和音频不返回原始媒体 URL，只返回已有元数据并等待用户交互。
即使派生物尚未完成，第一阶段也应显著减少请求和视频元数据加载。

### 第二阶段：轻量派生物

- 新增 `asset_previews` 表和派生服务。
- 图片生成 640px WebP。
- 视频生成 640px WebP 海报帧。
- 接入内容版本缓存和历史资产懒补生成。

### 第三阶段：调度与度量

- 按 React Flow viewport 实现三级优先队列。
- 接入 TLS 性能指标。
- 根据线上 P75 数据调整并发数、预览尺寸和缓存时间。

## 测试策略

后端：

- Preview Manifest 去重、顺序、100 项上限和权限过滤。
- `ready`、`pending`、`unavailable` 混合返回。
- 派生任务幂等、失败重试和版本变化。
- 图片与视频预览保持宽高比。
- 预览内容接口缓存头、ETag、304、Range 和错误响应。
- 连接池复用，不为每个请求创建新的 `AsyncClient`。

前端：

- 多个节点引用同一资产时只请求一次预览。
- Pipeline 初始资产和运行结果资产均进入批量清单。
- 图片节点使用预览 URL，精准编辑仍使用原始 URL。
- 视频和音频在用户点击前不产生原始媒体请求。
- `pending` 刷新次数有上限，不形成轮询风暴。
- Preview Manifest 或单项预览失败时正确降级。
- 节点骨架、预览和播放器切换不改变节点尺寸。

Playwright：

- 桌面、平板、手机视口下验证节点无重叠、裁切或拉伸。
- 以 `aigc_editor_interactive` 为起点，记录首个及全部可见预览完成的
  Performance Mark。
- 拦截网络请求，确认初始化阶段只有一次 Preview Manifest。
- 确认初始化阶段没有视频或音频原始内容请求。
- 验证同一资产被多个节点引用时只传输一次预览。

## 风险与控制

- 预览生成积压：使用幂等任务、并发限制和 `pending` 状态，不阻塞画布。
- 历史资产首次访问仍慢：后台批量预热最近使用的资产，保留懒生成兜底。
- WebP 解码兼容：当前目标浏览器均支持 WebP；服务端保留 MIME 校验。
- 海报帧全黑：从视频开头按小范围时间点选择首个有效帧，失败时使用现有尾帧或占位。
- 缓存陈旧：URL 包含内容版本，源对象变化即产生新 URL。
- 后端代理仍有开销：预览文件足够小且复用连接池；CDN 直出作为后续演进，不纳入本次范围。

## 完成定义

- 第一至第三阶段功能全部完成。
- 所有新增后端、前端和端到端测试通过。
- TypeScript、ESLint 和后端测试通过。
- Playwright 三视口验收通过。
- TLS 中可查询首个预览、全部可见预览、字节数和缓存命中指标。
- 在至少包含 12 个混合图片、视频和音频节点的真实 Pipeline 上达到既定 P75 指标。
