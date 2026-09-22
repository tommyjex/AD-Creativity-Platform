"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Film,
  ImageIcon,
  Maximize2,
  Play,
  RefreshCw,
  Search,
  X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  buildHomeMediaItems,
  type HomeMediaItem,
  type HomeMediaKind
} from "@/lib/home-media-gallery";
import type { Asset } from "@/lib/api-types";
import { formatDate } from "@/lib/project-display";
import { cn } from "@/lib/utils";

interface HomeGeneratedMediaGalleryProps {
  assets: Asset[];
  error?: string;
}

export function HomeGeneratedMediaGallery({
  assets,
  error
}: HomeGeneratedMediaGalleryProps) {
  const items = useMemo(() => buildHomeMediaItems(assets), [assets]);
  const [activeKind, setActiveKind] = useState<HomeMediaKind>("image");
  const [keyword, setKeyword] = useState("");
  const [previewItem, setPreviewItem] = useState<HomeMediaItem | null>(null);

  const imageCount = items.filter((item) => item.kind === "image").length;
  const videoCount = items.length - imageCount;
  const normalizedKeyword = keyword.trim().toLocaleLowerCase("zh-CN");
  const visibleItems = items.filter(
    (item) =>
      item.kind === activeKind &&
      (normalizedKeyword.length === 0 ||
        item.name.toLocaleLowerCase("zh-CN").includes(normalizedKeyword))
  );
  const columnCount = useResponsiveColumnCount();
  const mediaColumns = distributeMediaItems(visibleItems, columnCount);

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#080a0d] text-slate-100">
      <section className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="mb-6 flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Generated outputs
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              创意产物
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
              汇总项目、工具与 AIGC 工作台生成的公开图片和视频。
            </p>
          </div>
          <p className="font-mono text-xs text-slate-500">
            图片 {imageCount} · 视频 {videoCount}
          </p>
        </header>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            aria-label="产物类型"
            className="grid w-full grid-cols-2 gap-1 rounded-[6px] border border-white/10 bg-white/[0.035] p-1 sm:w-[18rem]"
            role="tablist"
          >
            <MediaTab
              active={activeKind === "image"}
              count={imageCount}
              icon={ImageIcon}
              kind="image"
              label="图片"
              onSelect={setActiveKind}
            />
            <MediaTab
              active={activeKind === "video"}
              count={videoCount}
              icon={Film}
              kind="video"
              label="视频"
              onSelect={setActiveKind}
            />
          </div>

          <div className="relative w-full sm:w-64">
            <label className="sr-only" htmlFor="home-gallery-search">
              搜索产物
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            />
            <input
              aria-label="搜索产物"
              className="h-10 w-full rounded-[6px] border border-white/10 bg-white/[0.035] pl-9 pr-10 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10"
              id="home-gallery-search"
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索名称"
              type="search"
              value={keyword}
            />
            {keyword ? (
              <button
                aria-label="清空搜索"
                className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white"
                onClick={() => setKeyword("")}
                title="清空搜索"
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <GalleryMessage
            action={
              <Button
                onClick={() => window.location.reload()}
                size="sm"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                重新加载
              </Button>
            }
            description={error}
            title="产物加载失败"
          />
        ) : visibleItems.length > 0 ? (
          <div
            className="grid items-start gap-3"
            data-column-count={columnCount}
            data-testid="home-media-masonry"
            id="home-media-panel"
            role="tabpanel"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`
            }}
          >
            {mediaColumns.map((column, index) => (
              <div className="grid min-w-0 gap-3" key={`column-${index}`}>
                {column.map((item, itemIndex) => (
                  <MediaTile
                    eager={itemIndex === 0}
                    item={item}
                    key={item.id}
                    onPreview={setPreviewItem}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <GalleryMessage
            description={
              keyword
                ? "请尝试其他名称，或清空当前搜索条件。"
                : "生成任务完成后，公开产物会自动出现在这里。"
            }
            title={
              keyword
                ? `没有匹配的${activeKind === "image" ? "图片" : "视频"}`
                : `还没有${activeKind === "image" ? "图片" : "视频"}产物`
            }
          />
        )}
      </section>

      <MediaPreviewDialog
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </main>
  );
}

function MediaTab({
  active,
  count,
  icon: Icon,
  kind,
  label,
  onSelect
}: {
  active: boolean;
  count: number;
  icon: typeof ImageIcon;
  kind: HomeMediaKind;
  label: string;
  onSelect: (kind: HomeMediaKind) => void;
}) {
  const isImage = kind === "image";
  return (
    <button
      aria-controls="home-media-panel"
      aria-selected={active}
      className={cn(
        "flex h-9 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition",
        active && isImage && "bg-emerald-500 text-white shadow-sm",
        active && !isImage && "bg-orange-500 text-white shadow-sm",
        !active && "text-slate-400 hover:bg-white/[0.06] hover:text-white"
      )}
      onClick={() => onSelect(kind)}
      role="tab"
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label} {count}
    </button>
  );
}

function MediaTile({
  eager,
  item,
  onPreview
}: {
  eager: boolean;
  item: HomeMediaItem;
  onPreview: (item: HomeMediaItem) => void;
}) {
  const isVideo = item.kind === "video";
  return (
    <article className="min-w-0 overflow-hidden rounded-[6px] border border-white/10 bg-[#11151b] transition duration-200 hover:border-white/25 hover:bg-[#141920]">
      <button
        aria-label={`放大查看 ${item.name}`}
        className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
        onClick={() => onPreview(item)}
        type="button"
      >
        <div className="relative bg-black">
          <MediaTileVisual eager={eager} item={item} />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/55 via-transparent to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
            <span className="grid h-8 w-8 place-items-center rounded border border-white/25 bg-black/60 text-white backdrop-blur">
              {isVideo ? (
                <Play aria-hidden="true" className="h-4 w-4 fill-current" />
              ) : (
                <Maximize2 aria-hidden="true" className="h-4 w-4" />
              )}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5">
          <p className="min-w-0 truncate text-sm font-medium text-slate-100">
            {item.name}
          </p>
          <time
            className="shrink-0 font-mono text-[0.65rem] text-slate-500"
            dateTime={item.updatedAt}
          >
            {formatDate(item.updatedAt)}
          </time>
        </div>
      </button>
    </article>
  );
}

function useResponsiveColumnCount(): number {
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      setColumnCount(
        width >= 1536 ? 6 : width >= 1280 ? 5 : width >= 1024 ? 4 : width >= 768 ? 3 : 2
      );
    };
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  return columnCount;
}

function distributeMediaItems(
  items: HomeMediaItem[],
  columnCount: number
): HomeMediaItem[][] {
  const columns = Array.from({ length: columnCount }, () => [] as HomeMediaItem[]);
  const estimatedHeights = Array.from({ length: columnCount }, () => 0);

  for (const item of items) {
    let targetIndex = 0;
    for (let index = 1; index < columnCount; index += 1) {
      if (estimatedHeights[index] < estimatedHeights[targetIndex]) {
        targetIndex = index;
      }
    }
    columns[targetIndex].push(item);
    estimatedHeights[targetIndex] += 1 / getInitialAspectRatio(item) + 0.18;
  }

  return columns;
}

function MediaTileVisual({
  eager,
  item
}: {
  eager: boolean;
  item: HomeMediaItem;
}) {
  const [aspectRatio, setAspectRatio] = useState(() =>
    getInitialAspectRatio(item)
  );
  const isVideo = item.kind === "video";
  const updateAspectRatio = (width: number, height: number) => {
    if (width > 0 && height > 0) {
      setAspectRatio(width / height);
    }
  };

  return (
    <div
      className="relative grid w-full place-items-center overflow-hidden bg-white/[0.035]"
      style={{ aspectRatio }}
    >
      <span className="absolute text-slate-700">
        {isVideo ? (
          <Film aria-hidden="true" className="h-6 w-6" />
        ) : (
          <ImageIcon aria-hidden="true" className="h-6 w-6" />
        )}
      </span>
      {isVideo ? (
        <video
          aria-hidden="true"
          className="relative h-full w-full object-contain"
          muted
          onLoadedMetadata={(event) =>
            updateAspectRatio(
              event.currentTarget.videoWidth,
              event.currentTarget.videoHeight
            )
          }
          playsInline
          preload="metadata"
          src={item.previewUrl}
        />
      ) : (
        // Asset URLs are dynamic signed/backend URLs and cannot use next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="relative h-full w-full object-contain"
          loading={eager ? "eager" : "lazy"}
          onLoad={(event) =>
            updateAspectRatio(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight
            )
          }
          src={item.previewUrl}
        />
      )}
    </div>
  );
}

function getInitialAspectRatio(item: HomeMediaItem): number {
  const width = item.asset.metadata.width;
  const height = item.asset.metadata.height;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0
  ) {
    return width / height;
  }

  const ratio = item.asset.metadata.aspect_ratio;
  if (typeof ratio === "string") {
    const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(ratio.trim());
    if (match) {
      const ratioWidth = Number(match[1]);
      const ratioHeight = Number(match[2]);
      if (ratioWidth > 0 && ratioHeight > 0) {
        return ratioWidth / ratioHeight;
      }
    }
  }

  return item.kind === "video" ? 16 / 9 : 4 / 3;
}

function GalleryMessage({
  action,
  description,
  title
}: {
  action?: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="grid min-h-72 place-items-center border-y border-white/10 px-6 py-12 text-center">
      <div className="max-w-md">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

function MediaPreviewDialog({
  item,
  onClose
}: {
  item: HomeMediaItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open={item !== null}
    >
      <DialogContent
        className="grid h-[min(92dvh,64rem)] w-[min(96vw,88rem)] max-w-[88rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[8px] border-white/15 bg-[#0b0e12] p-0 text-white sm:rounded-[8px]"
        closeButtonClassName="rounded border-white/15 bg-black/55 text-white hover:bg-white/10"
      >
        {item ? (
          <>
            <DialogHeader className="border-b border-white/10 px-5 py-4 pr-16">
              <DialogTitle className="truncate text-base text-white sm:text-lg">
                {item.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {item.kind === "image" ? "图片产物" : "视频产物"} ·{" "}
                {formatDate(item.updatedAt)}
              </DialogDescription>
            </DialogHeader>
            <div
              className="relative grid min-h-0 min-w-0 place-items-center overflow-hidden bg-black"
              data-testid="home-media-preview-stage"
            >
              {item.kind === "video" ? (
                <video
                  aria-label={`${item.name}播放`}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                  src={item.previewUrl}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${item.name}大图`}
                  className="absolute inset-0 block h-full w-full object-contain"
                  src={item.previewUrl}
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-3">
              <span className="text-xs text-slate-500">
                原始比例 · 完整显示
              </span>
              <Button asChild size="sm" variant="outline">
                <a download href={item.downloadUrl}>
                  <Download aria-hidden="true" className="h-4 w-4" />
                  下载资产
                </a>
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
