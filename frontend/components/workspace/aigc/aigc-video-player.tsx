"use client";

import { Maximize2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface AigcVideoMetadata {
  duration: number | null;
  height: number | null;
  width: number | null;
}

type FullscreenSupport = "standard" | "unsupported" | "webkit";

interface WebkitFullscreenVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
}

export function AigcVideoPlayer({
  audioState = null,
  className,
  initialMetadata,
  mimeType,
  name,
  resolutionLabel = null,
  unavailableText = "视频结果不可用",
  url,
  variant = "node"
}: {
  audioState?: boolean | null;
  className?: string;
  initialMetadata: AigcVideoMetadata;
  mimeType: string | null;
  name: string;
  resolutionLabel?: string | null;
  unavailableText?: string;
  url: string | null;
  variant?: "node" | "panel";
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fullscreenSupport, setFullscreenSupport] =
    useState<FullscreenSupport>("unsupported");
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenFeedback, setFullscreenFeedback] = useState("");
  const [loadedMetadata, setLoadedMetadata] = useState<
    (AigcVideoMetadata & { source: string }) | null
  >(null);
  const fullscreenHelpId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const metadata =
    loadedMetadata?.source === url ? loadedMetadata : initialMetadata;
  const details = videoDetails({
    audioState,
    metadata,
    mimeType,
    resolutionLabel
  });

  useEffect(() => {
    const container = containerRef.current;
    const media = videoRef.current as WebkitFullscreenVideo | null;
    if (typeof container?.requestFullscreen === "function") {
      setFullscreenSupport("standard");
    } else if (typeof media?.webkitEnterFullscreen === "function") {
      setFullscreenSupport("webkit");
    } else {
      setFullscreenSupport("unsupported");
    }

    function handleFullscreenChange() {
      setFullscreenActive(document.fullscreenElement === container);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [url]);

  function readMetadata(media: HTMLVideoElement) {
    setLoadedMetadata({
      duration: Number.isFinite(media.duration) ? media.duration : null,
      height: media.videoHeight > 0 ? media.videoHeight : null,
      source: url || "",
      width: media.videoWidth > 0 ? media.videoWidth : null
    });
  }

  async function enterFullscreen() {
    const container = containerRef.current;
    const media = videoRef.current as WebkitFullscreenVideo | null;
    setFullscreenFeedback("");
    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
        return;
      }
      if (typeof container?.requestFullscreen === "function") {
        await container.requestFullscreen();
        return;
      }
      if (typeof media?.webkitEnterFullscreen === "function") {
        media.webkitEnterFullscreen();
        return;
      }
      setFullscreenFeedback("当前浏览器不支持页面全屏，请使用放大预览。");
    } catch {
      setFullscreenFeedback(
        "无法进入全屏，请使用浏览器原生全屏控件或放大预览。"
      );
    }
  }

  if (!url) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-slate-950 px-3 text-center text-[10px] text-slate-300",
          variant === "node" ? "nodrag min-h-0 flex-1" : "h-44",
          className
        )}
      >
        <div>
          <p>{unavailableText}</p>
          <p className="mt-1 text-[9px] text-amber-300">
            播放和下载已禁用
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden bg-slate-950 p-1.5 fullscreen:h-screen fullscreen:w-screen fullscreen:p-4",
          variant === "node" && "nodrag nopan nowheel",
          variant === "node" ? "min-h-0 flex-1" : "h-44",
          className
        )}
        ref={containerRef}
      >
        <video
          aria-label={`播放视频：${name}`}
          className="block h-full w-full object-contain"
          controls
          onLoadedMetadata={(event) => readMetadata(event.currentTarget)}
          playsInline
          preload="metadata"
          ref={videoRef}
          src={url}
        />
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            aria-describedby={fullscreenHelpId}
            aria-label={`${fullscreenActive ? "退出全屏" : "全屏播放"}：${name}`}
            className="grid h-7 w-7 place-items-center rounded bg-slate-950/80 text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={fullscreenSupport === "unsupported"}
            onClick={(event) => {
              event.stopPropagation();
              void enterFullscreen();
            }}
            title={
              fullscreenActive
                ? "退出全屏"
                : fullscreenSupport === "unsupported"
                ? "当前浏览器不支持页面全屏"
                : "全屏播放"
            }
            type="button"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label={`放大预览：${name}`}
            className="grid h-7 w-7 place-items-center rounded bg-slate-950/80 text-white hover:bg-slate-900"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewOpen(true);
            }}
            title="放大预览"
            type="button"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 bg-gradient-to-b from-slate-950/95 to-transparent px-1.5 pb-5 pt-1 pr-20 text-white">
          <p className="truncate text-[9px] font-medium">{name}</p>
          <p className="truncate font-mono text-[8px] text-slate-300">
            {details}
          </p>
        </div>
        <p
          aria-live="polite"
          className="sr-only"
          id={fullscreenHelpId}
          role="status"
        >
          {fullscreenFeedback ||
            (fullscreenSupport === "unsupported"
              ? "当前浏览器不支持页面全屏，仍可使用浏览器原生控件或放大预览。"
              : "使用 Fullscreen API 全屏播放；浏览器原生全屏控件仍然可用。")}
        </p>
      </div>
      <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
        <DialogContent className="grid h-[92dvh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-slate-700 bg-slate-950 p-0 text-white sm:rounded-xl">
          <DialogHeader className="border-b border-white/10 px-5 py-4 pr-14">
            <DialogTitle>视频预览</DialogTitle>
            <DialogDescription className="text-slate-300">
              {name} · {details}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 place-items-center overflow-hidden p-4">
            <video
              aria-label={`${name} 放大预览`}
              autoPlay
              className="block max-h-full max-w-full object-contain"
              controls
              playsInline
              src={url}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function formatVideoDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round((seconds % 60) * 10) / 10;
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(4, "0")}`
    : `${remainder}s`;
}

function videoDetails({
  audioState,
  metadata,
  mimeType,
  resolutionLabel
}: {
  audioState: boolean | null;
  metadata: AigcVideoMetadata;
  mimeType: string | null;
  resolutionLabel: string | null;
}): string {
  const values: string[] = [];
  if (metadata.width && metadata.height) {
    values.push(`${metadata.width} × ${metadata.height}`);
  } else if (resolutionLabel) {
    values.push(resolutionLabel);
  }
  if (metadata.duration !== null) {
    values.push(formatVideoDuration(metadata.duration));
  }
  if (audioState !== null) {
    values.push(audioState ? "有音频" : "无音频");
  }
  if (mimeType) values.push(mimeType);
  values.push("可用");
  return values.join(" · ");
}
