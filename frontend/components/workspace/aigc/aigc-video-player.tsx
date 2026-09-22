"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface AigcVideoMetadata {
  duration: number | null;
  height: number | null;
  width: number | null;
}

export function AigcVideoPlayer({
  audioState = null,
  bitDepth = null,
  className,
  fps = null,
  initialMetadata,
  mimeType,
  name,
  resolutionLabel = null,
  toolVersion = null,
  unavailableText = "视频结果不可用",
  url,
  variant = "node"
}: {
  audioState?: boolean | null;
  bitDepth?: number | null;
  className?: string;
  fps?: number | null;
  initialMetadata: AigcVideoMetadata;
  mimeType: string | null;
  name: string;
  resolutionLabel?: string | null;
  toolVersion?: "professional" | "standard" | null;
  unavailableText?: string;
  url: string | null;
  variant?: "node" | "panel";
}) {
  const [loadedMetadata, setLoadedMetadata] = useState<
    (AigcVideoMetadata & { source: string }) | null
  >(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const metadata =
    loadedMetadata?.source === url ? loadedMetadata : initialMetadata;
  const details = videoDetails({
    audioState,
    bitDepth,
    fps,
    metadata,
    mimeType,
    resolutionLabel,
    toolVersion
  });

  function readMetadata(media: HTMLVideoElement) {
    setLoadedMetadata({
      duration: Number.isFinite(media.duration) ? media.duration : null,
      height: media.videoHeight > 0 ? media.videoHeight : null,
      source: url || "",
      width: media.videoWidth > 0 ? media.videoWidth : null
    });
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
          "relative overflow-hidden bg-slate-950 p-1.5",
          variant === "node" && "nodrag nopan nowheel",
          variant === "node" ? "min-h-0 flex-1" : "h-44",
          className
        )}
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
        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 bg-gradient-to-b from-slate-950/95 to-transparent px-1.5 pb-5 pt-1 text-white">
          <p className="truncate text-[9px] font-medium">{name}</p>
          <p className="truncate font-mono text-[8px] text-slate-300">
            {details}
          </p>
        </div>
      </div>
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
  bitDepth,
  fps,
  metadata,
  mimeType,
  resolutionLabel,
  toolVersion
}: {
  audioState: boolean | null;
  bitDepth: number | null;
  fps: number | null;
  metadata: AigcVideoMetadata;
  mimeType: string | null;
  resolutionLabel: string | null;
  toolVersion: "professional" | "standard" | null;
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
  if (fps !== null) values.push(`${fps} fps`);
  if (toolVersion !== null) {
    values.push(toolVersion === "professional" ? "专业版" : "标准版");
  }
  if (bitDepth !== null) values.push(`${bitDepth}-bit`);
  if (audioState !== null) {
    values.push(audioState ? "有音频" : "无音频");
  }
  if (mimeType) values.push(mimeType);
  values.push("可用");
  return values.join(" · ");
}
