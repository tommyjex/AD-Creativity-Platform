import Link from "next/link";
import { AlertTriangle, Download, Film, HardDrive, RadioTower } from "lucide-react";
import type { ReactNode } from "react";
import {
  BackToWorkflowButton,
  ProjectEmptyState
} from "@/components/project-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { Asset, Project } from "@/lib/api-types";
import {
  formatBytes,
  formatDate,
  getStageLabel,
  statusVariant
} from "@/lib/project-display";
import { getViewportBoundPreviewStyle } from "@/lib/media-layout";

export function ExportPreview({
  assets,
  project
}: {
  assets: Asset[];
  project: Project;
}) {
  const finalVideos = assets
    .filter((asset) => asset.type === "final_video")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  const finalVideo =
    finalVideos.find((asset) => asset.status === "succeeded") ?? finalVideos[0];

  return (
    <main className="min-h-screen">
      <section className="container py-12 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Badge className="w-fit" variant="signal">
              DELIVERY TRACK
            </Badge>
            <div className="space-y-4">
              <p className="ad-kicker">成片预览与导出 / Task 6</p>
              <h1 className="ad-display max-w-5xl">{project.name}</h1>
              <p className="ad-copy max-w-3xl">
                检查最终视频、成片元信息和下载地址。剪辑合成完成后，这里作为交付前的最后一站。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-2xl" variant="outline">
                <Link href={`/projects/${project.id}`}>返回创作流程</Link>
              </Button>
              <Button asChild className="rounded-2xl" variant="signal">
                <Link href={`/projects/${project.id}/assets`}>打开资产库</Link>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-2xl">Delivery Readiness</CardTitle>
              <CardDescription>
                当前阶段 {getStageLabel(project.current_stage)} · 最终成片记录{" "}
                {finalVideos.length} 条
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
              <Metric label="Project Status" value={project.status} />
              <Metric label="Aspect Ratio" value={project.brief.aspect_ratio} />
              <Metric
                label="Duration"
                value={`${project.brief.duration_seconds} seconds`}
              />
              <Metric
                label="Updated"
                value={finalVideo ? formatDate(finalVideo.updated_at) : "待合成"}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container pb-16">
        {finalVideo ? (
          <FinalVideoPanel asset={finalVideo} project={project} />
        ) : (
          <ProjectEmptyState
            action={<BackToWorkflowButton href={`/projects/${project.id}`} />}
            description="当前项目还没有 final_video 资产。请先回到项目详情页完成生视频与剪辑合成阶段。"
            title="尚未生成最终成片"
          />
        )}
      </section>
    </main>
  );
}

function FinalVideoPanel({ asset, project }: { asset: Asset; project: Project }) {
  const sourceVideoCount = asset.metadata.source_video_count;
  const duration = asset.metadata.duration_seconds ?? project.brief.duration_seconds;
  const downloadUrl =
    typeof asset.url === "string" && asset.url.length > 0 ? asset.url : null;
  const previewStyle = getViewportBoundPreviewStyle(
    project.brief.aspect_ratio,
    48,
    32
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <Badge variant={statusVariant(asset.status)}>{asset.status}</Badge>
              <CardTitle className="mt-4 text-2xl md:text-3xl">
                Final Video Preview
              </CardTitle>
              <CardDescription>
                {asset.mime_type ?? "video/mp4"} · {formatBytes(asset.size_bytes)}
              </CardDescription>
            </div>
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3 text-primary shadow-energy-line">
              <Film className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid min-h-48 place-items-center overflow-hidden rounded-[2rem] border border-border bg-secondary/50 shadow-glass">
            {downloadUrl ? (
              <div
                className="grid max-w-full place-items-center overflow-hidden bg-black"
                data-testid="export-video-preview-frame"
                style={previewStyle}
              >
                <video
                  className="h-full w-full bg-black object-contain"
                  controls
                  preload="metadata"
                  src={downloadUrl}
                />
              </div>
            ) : (
              <div className="grid aspect-video w-full place-items-center bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.18),transparent_62%)]">
                <div className="text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-border bg-secondary/60 text-warning">
                    <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-foreground">
                    成片记录存在，但缺少可预览 URL。
                  </p>
                </div>
              </div>
            )}
          </div>

          {downloadUrl ? (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-2xl" size="lg" variant="cinematic">
                <a download href={downloadUrl}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  下载最终视频
                </a>
              </Button>
              <Button asChild className="rounded-2xl" size="lg" variant="outline">
                <a href={downloadUrl} rel="noreferrer" target="_blank">
                  新窗口打开
                </a>
              </Button>
            </div>
          ) : (
            <div
              className="mt-5 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-6 text-warning"
              role="alert"
            >
              后端返回的 final_video 没有 URL。请检查资产存储配置或重新执行剪辑合成。
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-2xl">Final Asset Info</CardTitle>
            <CardDescription>最终视频资产、来源任务和存储定位信息。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            <InfoRow label="Asset ID" value={asset.id} />
            <InfoRow
              label="Stage"
              value={asset.stage ? getStageLabel(asset.stage) : "未绑定"}
            />
            <InfoRow label="Updated" value={formatDate(asset.updated_at)} />
            <InfoRow label="Source Task" value={asset.source_task_id ?? "unknown"} />
            <InfoRow label="Object Key" value={asset.object_key ?? "未写入"} />
            <InfoRow label="URL" value={asset.url ?? "未返回"} />
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-2xl">Render Metadata</CardTitle>
            <CardDescription>后端资产 metadata 中可用于交付核对的字段。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            <SignalRow
              icon={<RadioTower className="h-4 w-4" aria-hidden="true" />}
              label="Provider"
              value={stringifyMetadataValue(asset.metadata.provider)}
            />
            <SignalRow
              icon={<HardDrive className="h-4 w-4" aria-hidden="true" />}
              label="Model"
              value={stringifyMetadataValue(asset.metadata.model)}
            />
            <SignalRow
              icon={<Film className="h-4 w-4" aria-hidden="true" />}
              label="Duration"
              value={`${duration} seconds`}
            />
            <SignalRow
              icon={<Film className="h-4 w-4" aria-hidden="true" />}
              label="Source Clips"
              value={stringifyMetadataValue(sourceVideoCount)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-3">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 break-words font-mono text-xs leading-5 text-foreground">
        {value}
      </div>
    </div>
  );
}

function SignalRow({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function stringifyMetadataValue(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return `${value}`;
  }

  return "unknown";
}
