"use client";

import Link from "next/link";
import { FileImage, ImageIcon, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSafePreviewUrl } from "@/lib/asset-display";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import type { Asset, ImagePromptVersion, Project } from "@/lib/api-types";
import { formatDate, statusVariant } from "@/lib/project-display";

export function ImageProjectReadOnlyDetail({
  project
}: {
  onProjectUpdated: (project: Project) => void;
  project: Project;
}) {
  const [versions, setVersions] = useState<ImagePromptVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const referenceAssets = imageReferenceAssets(project);
  const currentPrompt =
    versions.find(
      (version) => version.id === project.current_image_prompt_version_id
    )?.prompt ??
    versions[0]?.prompt ??
    null;

  useEffect(() => {
    let active = true;
    apiClient
      .listImagePromptVersions(project.id, { cache: "no-store" })
      .then((items) => {
        if (active) setVersions(items);
      })
      .catch((error) => {
        if (active) setFeedback(getUserFacingErrorMessage(error));
      })
      .finally(() => {
        if (active) setIsLoadingVersions(false);
      });

    return () => {
      active = false;
    };
  }, [project.id]);

  return (
    <section aria-label="图片项目详情" className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-border bg-card shadow-glass">
        <div className="flex flex-col gap-5 p-6 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />
                图片素材
              </Badge>
              <Badge variant={statusVariant(project.image_prompt_status)}>
                提示词 {project.image_prompt_status}
              </Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-3xl">
              {project.name}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              {project.brief.summary ?? project.brief.prompt}
            </p>
          </div>
          <Button asChild>
            <Link href={`/projects/${project.id}/canvas`}>
              <Sparkles className="h-4 w-4" />
              进入画布
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <ReadOnlyPanel title="Brief">
          <DetailList
            items={[
              ["投放平台", project.brief.target_platform],
              ["目标语言", project.brief.target_language === "zh" ? "中文" : "英文"],
              ["画面规格", project.brief.aspect_ratio],
              ["图片用途", imagePurposeLabel(project.brief.image_purpose)],
              ["商品名称", project.brief.product_name ?? "未填写"],
              ["风格", project.brief.style ?? "未填写"]
            ]}
          />
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {project.brief.prompt || "未填写项目需求。"}
          </p>
        </ReadOnlyPanel>

        <ReadOnlyPanel title="图片提示词">
          {isLoadingVersions ? (
            <p className="text-sm text-muted-foreground">正在加载提示词...</p>
          ) : currentPrompt ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
              {currentPrompt}
            </p>
          ) : (
            <EmptyCopy>尚未保存图片提示词。</EmptyCopy>
          )}
        </ReadOnlyPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <ReadOnlyPanel title={`参考图 · ${referenceAssets.length}`}>
          {referenceAssets.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {referenceAssets.map((asset) => (
                <ReferencePreview asset={asset} key={asset.id} />
              ))}
            </div>
          ) : (
            <EmptyCopy>尚未添加项目参考图。</EmptyCopy>
          )}
        </ReadOnlyPanel>

        <ReadOnlyPanel title={`版本 · ${versions.length}`}>
          {isLoadingVersions ? (
            <p className="text-sm text-muted-foreground">正在加载版本...</p>
          ) : versions.length > 0 ? (
            <ol className="space-y-2">
              {versions.map((version) => (
                <li
                  className="rounded-xl border border-border bg-secondary/20 px-3 py-2.5"
                  key={version.id}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">V{version.version}</span>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={version.created_at}
                    >
                      {formatDate(version.created_at)}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {version.prompt}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyCopy>尚无提示词版本。</EmptyCopy>
          )}
        </ReadOnlyPanel>
      </div>

      {feedback ? (
        <p className="text-sm text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}

function ReadOnlyPanel({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-glass sm:p-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReferencePreview({ asset }: { asset: Asset }) {
  const previewUrl = getSafePreviewUrl(asset);
  const name =
    typeof asset.metadata.name === "string" ? asset.metadata.name : "已上传参考图";

  return (
    <article className="min-w-0">
      <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-border bg-slate-950">
        {previewUrl ? (
          // Signed assets intentionally retain the backend proxy URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={name} className="h-full w-full object-cover" src={previewUrl} />
        ) : (
          <FileImage className="h-5 w-5 text-slate-300" />
        )}
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{name}</p>
    </article>
  );
}

function EmptyCopy({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-secondary/20 px-3 py-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function imageReferenceAssets(project: Project) {
  const assetsById = new Map(
    project.assets
      .filter(
        (asset) =>
          asset.type === "uploaded_image" &&
          asset.asset_role === "public" &&
          asset.status === "succeeded"
      )
      .map((asset) => [asset.id, asset])
  );
  return (project.image_reference_asset_ids ?? [])
    .map((assetId) => assetsById.get(assetId))
    .filter((asset): asset is Asset => asset !== undefined);
}

function imagePurposeLabel(purpose: Project["brief"]["image_purpose"]) {
  if (purpose === "ecommerce_main") return "电商主图";
  if (purpose === "poster") return "营销海报";
  return "未填写";
}
