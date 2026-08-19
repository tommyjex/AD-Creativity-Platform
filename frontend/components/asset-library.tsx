import Link from "next/link";
import { Download, Film, ImageIcon, Layers3 } from "lucide-react";
import { BackToWorkflowButton, ProjectEmptyState } from "@/components/project-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { Asset, AssetType, Project, Stage } from "@/lib/api-types";
import {
  formatBytes,
  formatDate,
  getAssetTypeLabel,
  getStageLabel,
  statusVariant,
  summarizeAssets
} from "@/lib/project-display";

const ASSET_SECTIONS: Array<{
  copy: string;
  type: AssetType;
}> = [
  {
    copy: "用户上传或外部导入的素材，可作为后续生成链路的参考输入。",
    type: "uploaded_image"
  },
  {
    copy: "由分镜视觉提示生成的关键帧图片，主要来自 image 阶段。",
    type: "generated_image"
  },
  {
    copy: "每个分镜镜头推进得到的视频片段，主要来自 video 阶段。",
    type: "storyboard_video"
  },
  {
    copy: "剪辑合成后的最终广告成片，来自 compose 阶段。",
    type: "final_video"
  }
];

const STAGE_ORDER: Stage[] = [
  "brief",
  "story",
  "script",
  "storyboard",
  "image",
  "video",
  "compose"
];

export function AssetLibrary({
  assets,
  project
}: {
  assets: Asset[];
  project: Project;
}) {
  const stats = summarizeAssets(assets);
  const sortedAssets = [...assets].sort(compareAssets);

  return (
    <main className="min-h-screen">
      <section className="container py-12 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Badge className="w-fit" variant="signal">
              ASSET FOUNDRY
            </Badge>
            <div className="space-y-4">
              <p className="ad-kicker">项目资产库 / Task 6</p>
              <h1 className="ad-display max-w-5xl">{project.name}</h1>
              <p className="ad-copy max-w-3xl">
                汇总上传图片、生成图片、分镜视频和最终成片，按资产类型与生成阶段保持可追踪。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-2xl" variant="outline">
                <Link href={`/projects/${project.id}`}>返回创作流程</Link>
              </Button>
              <Button asChild className="rounded-2xl" variant="signal">
                <Link href={`/projects/${project.id}/export`}>查看导出预览</Link>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-2xl">Asset Telemetry</CardTitle>
              <CardDescription>
                当前阶段 {getStageLabel(project.current_stage)} · 更新时间{" "}
                {formatDate(project.updated_at)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
              <Metric label="Images" value={`${stats.images}`} />
              <Metric label="Storyboard Videos" value={`${stats.videos}`} />
              <Metric label="Final Videos" value={`${stats.finalVideos}`} />
              <Metric label="Total Assets" value={`${assets.length}`} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container space-y-6 pb-16">
        {assets.length === 0 ? (
          <ProjectEmptyState
            action={<BackToWorkflowButton href={`/projects/${project.id}`} />}
            description="当前项目还没有生成或上传任何资产。请先回到创作流程完成生图、生视频或剪辑阶段。"
            title="资产库暂时为空"
          />
        ) : (
          ASSET_SECTIONS.map((section) => {
            const sectionAssets = sortedAssets.filter(
              (asset) => asset.type === section.type
            );

            return (
              <AssetSection
                assets={sectionAssets}
                copy={section.copy}
                key={section.type}
                projectId={project.id}
                type={section.type}
              />
            );
          })
        )}
      </section>
    </main>
  );
}

function AssetSection({
  assets,
  copy,
  projectId,
  type
}: {
  assets: Asset[];
  copy: string;
  projectId: string;
  type: AssetType;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant={assets.length > 0 ? "info" : "secondary"}>
              {assets.length} ITEMS
            </Badge>
            <CardTitle className="mt-4 text-2xl">
              {getAssetTypeLabel(type)}
            </CardTitle>
            <CardDescription>{copy}</CardDescription>
          </div>
          {type === "final_video" ? (
            <Button asChild className="rounded-2xl" size="sm" variant="outline">
              <Link href={`/projects/${projectId}/export`}>打开成片预览</Link>
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {assets.length > 0 ? (
          <div className="space-y-6">
            {groupAssetsByStage(assets).map((group) => (
              <div className="space-y-3" key={group.stageKey}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {group.stage === null ? "未绑定阶段" : getStageLabel(group.stage)}
                    </h3>
                  </div>
                  <Badge variant="secondary">{group.assets.length} ASSETS</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.assets.map((asset) => (
                    <AssetCard asset={asset} key={asset.id} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ProjectEmptyState
            description={`${getAssetTypeLabel(type)}还未出现。对应阶段完成后，这里会自动归档可预览资产。`}
            title="此类型暂无资产"
          />
        )}
      </CardContent>
    </Card>
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  const isImage = asset.type === "generated_image" || asset.type === "uploaded_image";
  const isVideo = asset.type === "storyboard_video" || asset.type === "final_video";
  const displayUrl = asset.url ?? asset.object_key;

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-border bg-card">
      <div className="absolute right-[-3rem] top-[-3rem] h-32 w-32 rounded-full bg-primary/[0.06] blur-2xl" />
      <div className="relative aspect-video overflow-hidden border-b border-border bg-secondary/50">
        {isImage && asset.url ? (
          <div
            aria-label={`${getAssetTypeLabel(asset.type)}预览`}
            className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
            role="img"
            style={{ backgroundImage: `url(${asset.url})` }}
          />
        ) : isVideo && asset.url ? (
          <video
            className="h-full w-full object-cover"
            controls
            preload="metadata"
            src={asset.url}
          />
        ) : (
          <MediaPlaceholder isVideo={isVideo} />
        )}
      </div>

      <div className="relative space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(asset.status)}>{asset.status}</Badge>
          <Badge variant="outline">
            {asset.stage ? getStageLabel(asset.stage) : "未绑定阶段"}
          </Badge>
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.025em]">
            {getAssetTypeLabel(asset.type)}
          </h3>
          <p className="mt-2 line-clamp-2 font-mono text-[0.68rem] leading-5 text-muted-foreground">
            {displayUrl ?? asset.id}
          </p>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <InfoPill label="MIME" value={asset.mime_type ?? "unknown"} />
          <InfoPill label="Size" value={formatBytes(asset.size_bytes)} />
          <InfoPill label="Updated" value={formatDate(asset.updated_at)} />
          <InfoPill
            label="Task"
            value={asset.source_task_id ? asset.source_task_id.slice(0, 8) : "manual"}
          />
        </div>
        {asset.url ? (
          <Button asChild className="w-full rounded-2xl" size="sm" variant="signal">
            <a href={asset.url} rel="noreferrer" target="_blank">
              <Download className="h-4 w-4" aria-hidden="true" />
              打开 / 下载
            </a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function MediaPlaceholder({ isVideo }: { isVideo: boolean }) {
  const Icon = isVideo ? Film : ImageIcon;

  return (
    <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.18),transparent_60%)]">
      <div className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-secondary/60 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-3 font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground">
          Preview unavailable
        </p>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/40 px-3 py-2">
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-foreground">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </div>
    </div>
  );
}

function compareAssets(a: Asset, b: Asset): number {
  const stageDelta = stageIndex(a.stage) - stageIndex(b.stage);

  if (stageDelta !== 0) {
    return stageDelta;
  }

  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function stageIndex(stage: Stage | null): number {
  return stage === null ? -1 : STAGE_ORDER.indexOf(stage);
}

function groupAssetsByStage(assets: Asset[]) {
  const groups = new Map<Stage | null, Asset[]>();

  for (const asset of assets) {
    const group = groups.get(asset.stage) ?? [];
    group.push(asset);
    groups.set(asset.stage, group);
  }

  return [...groups.entries()]
    .map(([stage, groupAssets]) => ({
      assets: groupAssets.sort(compareAssets),
      stage,
      stageKey: stage ?? "unbound"
    }))
    .sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage));
}
