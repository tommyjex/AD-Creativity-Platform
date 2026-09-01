import { notFound } from "next/navigation";
import { AigcEditor } from "@/components/workspace/aigc/aigc-editor";
import { AigcVideoFullscreenAcceptance } from "@/components/workspace/aigc/aigc-video-fullscreen-acceptance";
import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";
import { createApiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import { getAigcVideoDownload } from "@/lib/aigc/download";
import type { AigcResultAsset } from "@/lib/aigc/types";
import { getSafeAssetContentUrl } from "@/lib/asset-display";

const MOCK_VIDEO_ASSET: AigcResultAsset = {
  asset_id: "acceptance-video",
  ordinal: 0,
  mime_type: "video/mp4",
  download_url: "/api/assets/acceptance-video/content",
  available: true
};
const MOCK_VIDEO_TITLE = "验收 Mock 成片";

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
  if (scenario === "video-fullscreen") {
    return <AigcVideoFullscreenAcceptance />;
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

  const api = createApiClient();
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
