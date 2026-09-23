"use client";

import { useState } from "react";
import { formatVideoDuration } from "@/components/workspace/aigc/aigc-video-player";
import { cn } from "@/lib/utils";

export function AigcAudioPlayer({
  className,
  duration = null,
  mimeType,
  name,
  unavailableText = "音频结果不可用",
  url,
  variant = "node"
}: {
  className?: string;
  duration?: number | null;
  mimeType: string | null;
  name: string;
  unavailableText?: string;
  url: string | null;
  variant?: "node" | "panel";
}) {
  const [loadedDuration, setLoadedDuration] = useState<number | null>(null);
  const resolvedDuration = loadedDuration ?? duration;

  if (!url) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-slate-950 px-3 text-center text-[10px] text-slate-300",
          variant === "node" ? "min-h-0 flex-1" : "h-24",
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

  const details = [
    resolvedDuration === null
      ? null
      : formatVideoDuration(resolvedDuration),
    mimeType
  ].filter((value): value is string => Boolean(value));

  return (
    <div
      className={cn(
        "flex flex-col justify-center gap-2 overflow-hidden bg-slate-950 p-3 text-white",
        variant === "node"
          ? "min-h-0 flex-1"
          : "rounded border border-slate-800",
        className
      )}
    >
      <p className="truncate text-[10px] font-medium" title={name}>
        {name}
      </p>
      <audio
        aria-label={`播放音频：${name}`}
        className={cn(
          "h-8 w-full",
          variant === "node" && "nodrag nowheel"
        )}
        controls
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setLoadedDuration(
            Number.isFinite(nextDuration) ? nextDuration : null
          );
        }}
        preload="metadata"
        src={url}
      />
      <p
        aria-label={`音频信息：${name}`}
        className="truncate font-mono text-[9px] text-slate-300"
      >
        {details.join(" · ") || "元数据读取中"}
      </p>
    </div>
  );
}
