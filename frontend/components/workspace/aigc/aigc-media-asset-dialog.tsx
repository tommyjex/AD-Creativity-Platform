"use client";

import {
  AudioLines,
  Check,
  ImageIcon,
  Search,
  Video
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Asset, ReferenceAssetKind } from "@/lib/api-types";
import type { MediaCompatibility } from "@/lib/aigc/media-validation";
import { getSafePreviewUrl } from "@/lib/asset-display";
import { cn } from "@/lib/utils";

export function AigcMediaAssetDialog({
  assets,
  currentAssetId,
  isLoading,
  kind,
  label,
  getCompatibility,
  onSelect
}: {
  assets: Asset[];
  currentAssetId: string | null;
  isLoading: boolean;
  kind: ReferenceAssetKind;
  label: string;
  getCompatibility?: (asset: Asset) => MediaCompatibility;
  onSelect: (assetId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  const currentAsset = assets.find((asset) => asset.id === currentAssetId);
  const pendingAsset = assets.find((asset) => asset.id === pendingAssetId);
  const pendingCompatibility = pendingAsset && getCompatibility
    ? getCompatibility(pendingAsset)
    : null;
  const filteredAssets = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    const sorted = [...assets].sort(
      (left, right) =>
        Date.parse(right.created_at) - Date.parse(left.created_at)
    );
    if (!keyword) return sorted;
    return sorted.filter((asset) =>
      [
        mediaAssetName(asset),
        asset.id,
        asset.mime_type ?? "",
        mediaAssetSource(asset)
      ].some((value) => value.toLocaleLowerCase().includes(keyword))
    );
  }, [assets, query]);

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setPendingAssetId(currentAsset?.id ?? null);
      setQuery("");
      return;
    }
    setPendingAssetId(null);
  }

  function confirmSelection() {
    if (!pendingAssetId) return;
    onSelect(pendingAssetId);
    changeOpen(false);
  }

  return (
    <>
      <Button
        className="mt-1.5 w-full justify-start"
        disabled={isLoading}
        onClick={() => changeOpen(true)}
        type="button"
        variant="outline"
      >
        <Search className="h-4 w-4" />
        {isLoading ? "正在加载资产..." : `从资产库选择${label}`}
      </Button>
      <div
        className={cn(
          "mt-2 rounded-md border px-3 py-2 text-xs",
          currentAsset
            ? "border-border bg-secondary/25"
            : currentAssetId
              ? "border-amber-400/45 bg-amber-50 text-amber-900"
              : "border-dashed border-border text-muted-foreground"
        )}
      >
        {currentAsset ? (
          <>
            <p className="truncate font-medium text-foreground">
              {mediaAssetName(currentAsset)}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {mediaAssetDetails(currentAsset)}
            </p>
          </>
        ) : currentAssetId ? (
          <p className="break-all">当前资产不可用 · {currentAssetId}</p>
        ) : (
          <p>尚未选择{label}</p>
        )}
      </div>
      <Dialog onOpenChange={changeOpen} open={open}>
        <DialogContent className="grid h-[min(82dvh,760px)] w-[min(94vw,1100px)] max-w-[1100px] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5 pr-16">
            <DialogTitle>选择资产库{label}</DialogTitle>
            <DialogDescription>
              通过缩略图和素材信息确认内容。选择仅在点击“确认选择”后生效。
            </DialogDescription>
          </DialogHeader>
          <div className="border-b border-border px-6 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label={`搜索资产库${label}`}
                className="pl-9"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="搜索名称、文件名或资产 ID"
                value={query}
              />
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto px-6 py-5">
            {filteredAssets.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAssets.map((asset) => {
                  const selected = pendingAssetId === asset.id;
                  const compatibility = getCompatibility?.(asset);
                  const incompatible = compatibility?.state === "incompatible";
                  return (
                    <button
                      aria-label={`选择${label}：${mediaAssetName(asset)}`}
                      aria-pressed={selected}
                      disabled={incompatible}
                      className={cn(
                        "overflow-hidden rounded-md border bg-card text-left transition-colors hover:border-primary/40 hover:bg-secondary/20",
                        incompatible && "cursor-not-allowed opacity-55",
                        selected
                          ? "border-primary ring-2 ring-primary/15"
                          : "border-border"
                      )}
                      key={asset.id}
                      onClick={() => setPendingAssetId(asset.id)}
                      type="button"
                    >
                      <MediaAssetPreview asset={asset} kind={kind} />
                      <div className="space-y-2 p-3">
                        <div className="flex items-start gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                            {mediaAssetName(asset)}
                          </p>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {selected ? <Check className="h-3 w-3" /> : null}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {mediaAssetDetails(asset)}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 gap-1">
                            <Badge variant="secondary">
                              {mediaAssetSource(asset)}
                            </Badge>
                            {compatibility ? (
                              <Badge
                                className={cn(
                                  compatibility.state === "available" &&
                                    "border-success/35 text-success",
                                  compatibility.state === "pending" &&
                                    "border-amber-400/45 text-amber-700",
                                  incompatible &&
                                    "border-destructive/35 text-destructive"
                                )}
                                variant="outline"
                              >
                                {compatibility.message}
                              </Badge>
                            ) : null}
                          </div>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {formatAssetTime(asset.created_at)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-border bg-secondary/15 px-6 text-center">
                <div>
                  <MediaKindIcon
                    className="mx-auto h-10 w-10 text-muted-foreground"
                    kind={kind}
                  />
                  <p className="mt-3 font-medium text-foreground">
                    {assets.length === 0
                      ? `暂无可选${label}`
                      : "没有匹配的素材"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {assets.length === 0
                      ? `关闭弹窗后可使用“本地上传”添加${label}。`
                      : "请尝试搜索其他名称、文件名或资产 ID。"}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-border px-6 py-4">
            <div className="min-w-0 text-left text-xs text-muted-foreground">
              {pendingAsset ? (
                <span className="block max-w-80 truncate">
                  已选择：{mediaAssetName(pendingAsset)}
                </span>
              ) : (
                "请选择一个素材"
              )}
            </div>
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                onClick={() => changeOpen(false)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button
                disabled={
                  !pendingAssetId ||
                  pendingCompatibility?.state === "incompatible"
                }
                onClick={confirmSelection}
                type="button"
              >
                确认选择
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MediaAssetPreview({
  asset,
  kind
}: {
  asset: Asset;
  kind: ReferenceAssetKind;
}) {
  const previewUrl = getSafePreviewUrl(asset);
  return (
    <div className="relative grid aspect-video place-items-center overflow-hidden bg-slate-950">
      {kind === "image" && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={mediaAssetName(asset)}
          className="absolute inset-0 block h-full w-full object-contain"
          loading="lazy"
          src={previewUrl}
        />
      ) : kind === "video" && previewUrl ? (
        <video
          aria-label={`视频缩略图：${mediaAssetName(asset)}`}
          className="absolute inset-0 block h-full w-full object-contain"
          muted
          playsInline
          preload="metadata"
          src={previewUrl}
        />
      ) : (
        <div className="grid place-items-center gap-2 text-slate-300">
          <MediaKindIcon className="h-8 w-8" kind={kind} />
          <span className="text-xs">{mediaKindLabel(kind)}</span>
        </div>
      )}
      {kind === "video" ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-950/75 text-white">
            <Video className="h-4 w-4" />
          </span>
        </span>
      ) : null}
      <span className="absolute bottom-2 right-2 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-white">
        {mediaAssetMetric(asset)}
      </span>
    </div>
  );
}

function MediaKindIcon({
  className,
  kind
}: {
  className?: string;
  kind: ReferenceAssetKind;
}) {
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "audio") return <AudioLines className={className} />;
  return <Video className={className} />;
}

export function mediaAssetName(asset: Asset): string {
  for (const key of ["name", "filename", "file_name", "title"]) {
    const value = asset.metadata?.[key];
    if (
      typeof value === "string" &&
      value.trim() &&
      !looksLikeOpaqueId(value.trim())
    ) {
      return value.trim();
    }
  }
  const kind = mediaKindLabelFromAsset(asset);
  const time = formatAssetTime(asset.created_at);
  return time === "时间未知" ? `${kind}素材` : `${kind}素材 · ${time}`;
}

function mediaAssetDetails(asset: Asset): string {
  const values = [
    mediaKindLabelFromAsset(asset),
    ...mediaAssetMetrics(asset),
    `ID ${asset.id.slice(0, 8)}`
  ];
  if (asset.mime_type) values.push(asset.mime_type);
  return values.filter(Boolean).join(" · ");
}

function mediaAssetMetric(asset: Asset): string {
  return mediaAssetMetrics(asset)[0] ?? "规格未知";
}

function mediaAssetMetrics(asset: Asset): string[] {
  const values: string[] = [];
  const width = metadataNumber(asset, "width");
  const height = metadataNumber(asset, "height");
  if (width && height) values.push(`${width} × ${height}`);
  const duration =
    metadataNumber(asset, "duration_seconds") ??
    metadataNumber(asset, "duration");
  if (duration !== null) values.push(formatDuration(duration));
  if (asset.size_bytes) values.push(formatBytes(asset.size_bytes));
  return values;
}

function mediaKindLabel(kind: ReferenceAssetKind): string {
  if (kind === "image") return "图片";
  if (kind === "audio") return "音频";
  return "视频";
}

function mediaKindLabelFromAsset(asset: Asset): string {
  if (asset.mime_type?.startsWith("image/")) return "图片";
  if (asset.mime_type?.startsWith("audio/")) return "音频";
  return "视频";
}

function mediaAssetSource(asset: Asset): string {
  if (asset.project_id) return "项目资产";
  if (asset.tool_task_id) return "工具资产";
  if (asset.metadata?.origin === "aigc") return "AIGC 资产";
  return "公共资产";
}

function metadataNumber(asset: Asset, key: string): number | null {
  const value = asset.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(2, "0")}`
    : `${rounded}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatAssetTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(timestamp);
}

function looksLikeOpaqueId(value: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    ) || /^[0-9a-f]{24,}$/i.test(value)
  );
}
