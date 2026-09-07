"use client";

import { ImageIcon, Video } from "lucide-react";

import type {
  MultiTrackEditConfig,
  MultiTrackElement
} from "@/lib/aigc/types";
import { cn } from "@/lib/utils";

export function AigcMultitrackPreview({
  config,
  playheadMs
}: {
  config: MultiTrackEditConfig;
  playheadMs: number;
}) {
  const visible = config.tracks
    .filter((track) => !track.hidden)
    .flatMap((track) => track.elements)
    .filter(
      (element) =>
        element.target_time.start_ms <= playheadMs &&
        element.target_time.end_ms > playheadMs &&
        element.type !== "audio" &&
        element.type !== "subtitle"
    );
  const aspectRatio =
    config.canvas.mode === "custom" &&
    config.canvas.width &&
    config.canvas.height
      ? `${config.canvas.width} / ${config.canvas.height}`
      : "16 / 9";

  return (
    <section
      aria-label="结构预览"
      className="relative flex min-h-0 flex-col bg-[#090b0e]"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
        <div
          className="relative max-h-full max-w-full overflow-hidden border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.5)]"
          style={{
            aspectRatio,
            backgroundColor: rgbaToCss(config.canvas.background_color),
            height: "100%"
          }}
        >
          {visible.length === 0 ? (
            <div className="absolute inset-0 grid place-items-center text-xs text-zinc-600">
              当前播放头无可见画面
            </div>
          ) : null}
          {visible.map((element) => (
            <PreviewElement
              canvasHeight={config.canvas.height ?? 1080}
              canvasWidth={config.canvas.width ?? 1920}
              element={element}
              key={element.id}
            />
          ))}
        </div>
      </div>
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/[0.07] px-3 text-[10px] text-zinc-500">
        <span>结构预览 · {formatTime(playheadMs)}</span>
        <span>最终效果以 MediaKit 合成为准</span>
      </div>
    </section>
  );
}

function PreviewElement({
  canvasHeight,
  canvasWidth,
  element
}: {
  canvasHeight: number;
  canvasWidth: number;
  element: MultiTrackElement;
}) {
  if (
    element.type === "audio" ||
    element.type === "subtitle"
  ) {
    return null;
  }
  const transform = element.transform;
  const style = {
    height: `${(Math.max(1, transform.height) / canvasHeight) * 100}%`,
    left: `${(transform.x / canvasWidth) * 100}%`,
    top: `${(transform.y / canvasHeight) * 100}%`,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: "center",
    width: `${(Math.max(1, transform.width) / canvasWidth) * 100}%`
  };

  if (element.type === "text") {
    return (
      <div
        className="absolute flex items-center justify-center overflow-hidden px-2 text-center leading-tight"
        style={{
          ...style,
          backgroundColor: rgbaToCss(element.style.background_color),
          color: rgbaToCss(element.style.color),
          fontSize: `${Math.max(8, Math.min(48, element.style.font_size / 3))}px`,
          fontStyle: element.style.italic ? "italic" : "normal",
          fontWeight: element.style.bold ? 700 : 400,
          textDecoration: element.style.underline ? "underline" : "none"
        }}
      >
        {element.inline_text?.trim() || "上游文字"}
      </div>
    );
  }

  const Icon = element.type === "video" ? Video : ImageIcon;
  return (
    <div
      className={cn(
        "absolute grid place-items-center overflow-hidden border",
        element.type === "video"
          ? "border-orange-400/50 bg-orange-950/70"
          : "border-emerald-400/50 bg-emerald-950/70"
      )}
      style={style}
    >
      <div className="flex items-center gap-2 text-[10px] text-zinc-300">
        <Icon className="h-4 w-4" />
        <span className="max-w-40 truncate">
          {element.source.source_node_id}
        </span>
      </div>
    </div>
  );
}

function rgbaToCss(value: string) {
  if (!/^#[0-9a-f]{8}$/i.test(value)) return "#000000";
  const alpha = Number.parseInt(value.slice(7, 9), 16) / 255;
  return `rgba(${Number.parseInt(value.slice(1, 3), 16)}, ${Number.parseInt(
    value.slice(3, 5),
    16
  )}, ${Number.parseInt(value.slice(5, 7), 16)}, ${alpha})`;
}

function formatTime(value: number) {
  const seconds = Math.max(0, value) / 1000;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${(seconds % 60)
    .toFixed(2)
    .padStart(5, "0")}`;
}
