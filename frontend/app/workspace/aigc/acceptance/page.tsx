import { notFound } from "next/navigation";
import { AigcEditor } from "@/components/workspace/aigc/aigc-editor";
import { AigcUpstreamPreciseEditAcceptance } from "@/components/workspace/aigc/aigc-upstream-precise-edit-acceptance";
import { AigcVideoFaceBlurAcceptance } from "@/components/workspace/aigc/aigc-video-face-blur-acceptance";
import { AigcVideoFullscreenAcceptance } from "@/components/workspace/aigc/aigc-video-fullscreen-acceptance";
import { AigcVideoEnhancementAcceptance } from "@/components/workspace/aigc/aigc-video-enhancement-acceptance";
import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";
import { getUserFacingErrorMessage } from "@/lib/api-client";
import { getAigcVideoDownload } from "@/lib/aigc/download";
import type { AigcPipeline, AigcResultAsset } from "@/lib/aigc/types";
import { getSafeAssetContentUrl } from "@/lib/asset-display";
import { createServerApiClient } from "@/lib/auth/server-api-client";

const MOCK_VIDEO_ASSET: AigcResultAsset = {
  asset_id: "acceptance-video",
  ordinal: 0,
  mime_type: "video/mp4",
  download_url: "/api/assets/acceptance-video/content",
  available: true
};
const MOCK_VIDEO_TITLE = "验收 Mock 成片";
const VIDEO_LAST_FRAME_PIPELINE: AigcPipeline = {
  id: "acceptance-video-last-frame",
  name: "视频尾帧结果页验收",
  description: "仅使用本地确定性 Run 和媒体响应。",
  definition: {
    schemaVersion: 1,
    nodes: [
      {
        id: "video-model",
        type: "video_generation",
        custom_name: "秋日新品「鎏金」✨超长名称用于验证不会溢出容器",
        position: { x: 80, y: 100 },
        size: { width: 260, height: 190 },
        config: {
          model: "doubao-seedance-2-5-260628",
          generation_mode: "text_to_video",
          resolution: "1080p",
          aspect_ratio: "16:9",
          duration_seconds: 12,
          generate_audio: true
        }
      },
      {
        id: "video-output",
        type: "video_output",
        position: { x: 440, y: 100 },
        size: { width: 260, height: 190 },
        config: { title: "下游成片" }
      }
    ],
    edges: [
      {
        id: "video-edge",
        sourceNodeId: "video-model",
        sourceHandle: "video",
        targetNodeId: "video-output",
        targetHandle: "video"
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  },
  source_template_id: null,
  source_template_revision: null,
  revision: 1,
  latest_run_status: "succeeded",
  thumbnail_asset_id: null,
  thumbnail: null,
  created_at: "2026-10-22T00:00:00Z",
  updated_at: "2026-10-22T00:00:00Z"
};
const MATERIALIZED_OUTPUT_PIPELINE: AigcPipeline = {
  id: "acceptance-materialized-output",
  name: "Mock 自动物化验收",
  description: "浏览器路由提供确定性 Run 与媒体，不调用 Provider 或 TOS。",
  definition: {
    schemaVersion: 2,
    nodes: [
      {
        id: "shared-prompt",
        type: "text",
        custom_name: "Mock 提示词",
        position: { x: -280, y: 340 },
        size: { width: 240, height: 180 },
        config: {
          text: "deterministic mock materialization",
          bbox_references: [],
          title: null
        }
      },
      {
        id: "image-model",
        type: "text_to_image",
        custom_name: "终端图片模型",
        position: { x: 40, y: 40 },
        size: { width: 240, height: 180 },
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: "2K",
          format: "png"
        }
      },
      {
        id: "auto-image",
        type: "image",
        custom_name: "自动图片",
        position: { x: 360, y: 40 },
        size: { width: 260, height: 220 },
        config: {
          asset_id: "acceptance-materialized-image",
          bbox: null,
          bbox_asset_id: null,
          title: null,
          generated_by_model_node_id: "image-model",
          generated_output_handle: "image",
          generated_from_run_id: "acceptance-materialized-run"
        }
      },
      {
        id: "video-model",
        type: "video_generation",
        custom_name: "终端视频模型",
        position: { x: 40, y: 340 },
        size: { width: 240, height: 180 },
        config: {
          model: "doubao-seedance-2-5-260628",
          generation_mode: "text_to_video",
          resolution: "1080p",
          aspect_ratio: "16:9",
          duration_seconds: 5,
          generate_audio: true
        }
      },
      {
        id: "auto-video",
        type: "video",
        custom_name: "自动视频",
        position: { x: 360, y: 340 },
        size: { width: 260, height: 220 },
        config: {
          asset_id: "acceptance-materialized-video",
          title: null,
          generated_by_model_node_id: "video-model",
          generated_output_handle: "video",
          generated_from_run_id: "acceptance-materialized-run"
        }
      },
      {
        id: "connected-model",
        type: "text_to_image",
        custom_name: "已有下游模型",
        position: { x: 40, y: 640 },
        size: { width: 240, height: 180 },
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: "2K",
          format: "png"
        }
      },
      {
        id: "manual-output",
        type: "image",
        custom_name: "手工下游",
        position: { x: 360, y: 640 },
        size: { width: 260, height: 220 },
        config: {
          asset_id: "acceptance-manual-image",
          bbox: null,
          bbox_asset_id: null,
          title: null
        }
      },
      {
        id: "reused-model",
        type: "text_to_image",
        custom_name: "缓存复用模型",
        position: { x: 40, y: 940 },
        size: { width: 240, height: 180 },
        config: {
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: "2K",
          format: "png"
        }
      },
      {
        id: "auto-reused-image",
        type: "image",
        custom_name: "复用自动图片",
        position: { x: 360, y: 940 },
        size: { width: 260, height: 220 },
        config: {
          asset_id: "acceptance-reused-image",
          bbox: null,
          bbox_asset_id: null,
          title: null,
          generated_by_model_node_id: "reused-model",
          generated_output_handle: "image",
          generated_from_run_id: "acceptance-materialized-run"
        }
      }
    ],
    edges: [
      {
        id: "prompt-image-edge",
        sourceNodeId: "shared-prompt",
        sourceHandle: "text",
        targetNodeId: "image-model",
        targetHandle: "prompt"
      },
      {
        id: "prompt-video-edge",
        sourceNodeId: "shared-prompt",
        sourceHandle: "text",
        targetNodeId: "video-model",
        targetHandle: "prompt"
      },
      {
        id: "prompt-connected-edge",
        sourceNodeId: "shared-prompt",
        sourceHandle: "text",
        targetNodeId: "connected-model",
        targetHandle: "prompt"
      },
      {
        id: "prompt-reused-edge",
        sourceNodeId: "shared-prompt",
        sourceHandle: "text",
        targetNodeId: "reused-model",
        targetHandle: "prompt"
      },
      {
        id: "auto-image-edge",
        sourceNodeId: "image-model",
        sourceHandle: "image",
        targetNodeId: "auto-image",
        targetHandle: "image"
      },
      {
        id: "auto-video-edge",
        sourceNodeId: "video-model",
        sourceHandle: "video",
        targetNodeId: "auto-video",
        targetHandle: "video"
      },
      {
        id: "manual-edge",
        sourceNodeId: "connected-model",
        sourceHandle: "image",
        targetNodeId: "manual-output",
        targetHandle: "image"
      },
      {
        id: "auto-reused-edge",
        sourceNodeId: "reused-model",
        sourceHandle: "image",
        targetNodeId: "auto-reused-image",
        targetHandle: "image"
      }
    ],
    viewport: { x: 80, y: 30, zoom: 0.72 }
  },
  source_template_id: null,
  source_template_revision: null,
  revision: 4,
  latest_run_status: "succeeded",
  thumbnail_asset_id: "acceptance-materialized-image",
  thumbnail: null,
  created_at: "2026-10-23T00:00:00Z",
  updated_at: "2026-10-23T00:00:04Z"
};

export default async function AigcAcceptancePage({
  searchParams
}: {
  searchParams: Promise<{
    pipelineId?: string;
    scenario?: string;
  }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { pipelineId, scenario } = await searchParams;
  if (scenario === "mock-results") {
    return <MockMediaResults />;
  }
  if (scenario === "video-last-frame-result") {
    return (
      <AigcEditor
        allowExecution={false}
        entity={VIDEO_LAST_FRAME_PIPELINE}
        mode="pipeline"
      />
    );
  }
  if (scenario === "materialized-output") {
    return (
      <AigcEditor
        allowExecution={false}
        entity={MATERIALIZED_OUTPUT_PIPELINE}
        mode="pipeline"
      />
    );
  }
  if (scenario === "video-fullscreen") {
    return <AigcVideoFullscreenAcceptance />;
  }
  if (scenario === "video-enhancement") {
    return <AigcVideoEnhancementAcceptance />;
  }
  if (scenario === "video-face-blur") {
    return <AigcVideoFaceBlurAcceptance />;
  }
  if (scenario === "upstream-precise-edit") {
    return <AigcUpstreamPreciseEditAcceptance />;
  }
  if (!pipelineId) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-xl font-semibold">AIGC 浏览器验收</h1>
        <p className="text-sm text-muted-foreground">
          先在 frontend 目录运行 npm run acceptance:aigc，再打开命令输出的
          URL。该 fixture 只创建和保存画布，不会创建生成任务。
        </p>
        <code className="block rounded-md bg-muted p-3 text-xs">
          npm run acceptance:aigc
        </code>
      </main>
    );
  }

  const api = await createServerApiClient();
  let pipeline;
  let loadError: unknown;
  try {
    pipeline = await api.getAigcPipeline(pipelineId, {
      cache: "no-store"
    });
  } catch (error) {
    loadError = error;
  }
  if (!pipeline) {
    return (
      <main className="grid h-[calc(100dvh-4rem)] place-items-center px-6">
        <p className="text-sm text-destructive">
          {getUserFacingErrorMessage(loadError)}
        </p>
      </main>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-3 top-16 z-50 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm">
        验收模式：真实执行已禁用
      </div>
      <AigcEditor
        allowExecution={false}
        entity={pipeline}
        mode="pipeline"
      />
    </div>
  );
}

function MockMediaResults() {
  const videoUrl = getSafeAssetContentUrl(MOCK_VIDEO_ASSET.download_url);
  const videoDownload = getAigcVideoDownload(
    MOCK_VIDEO_ASSET,
    MOCK_VIDEO_TITLE
  );

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-5xl gap-6 p-4 sm:grid-cols-2 sm:p-8">
      <section className="min-w-0 space-y-3">
        <h1 className="text-base font-semibold">Mock 视频结果</h1>
        <AigcVideoPlayer
          audioState
          initialMetadata={{ duration: 12, height: 1080, width: 1920 }}
          mimeType={MOCK_VIDEO_ASSET.mime_type}
          name={`${MOCK_VIDEO_TITLE}.mp4`}
          resolutionLabel="1080p"
          url={videoUrl}
          variant="panel"
        />
        {videoDownload ? (
          <a
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            download={videoDownload.filename}
            href={videoDownload.url}
          >
            下载 Mock 视频
          </a>
        ) : null}
      </section>
      <section className="min-w-0 space-y-3">
        <h2 className="text-base font-semibold">媒体空态</h2>
        <AigcVideoPlayer
          audioState={null}
          initialMetadata={{ duration: null, height: null, width: null }}
          mimeType={null}
          name="不可用视频"
          unavailableText="Mock 结果已失效"
          url={null}
          variant="panel"
        />
      </section>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        此页面只渲染本地 Mock 元数据，不请求运行或生成 API。
      </p>
    </main>
  );
}
