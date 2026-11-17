"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { SubtitleSegment } from "@/lib/api-types";
import { containedVideoRect, subtitleColors, subtitlePreviewBox, subtitlePreviewFont, SUBTITLE_FONTS } from "@/lib/subtitle-translation";

const fontCss = SUBTITLE_FONTS.map((font) =>
  `@font-face{font-family:subtitle-${font.id};src:url("${font.url}");font-weight:400;font-style:normal;font-display:swap;}`
).join("\n");

function SubtitleLayer({ segment, panel }: { segment: SubtitleSegment; panel: string }) {
  const [failed, setFailed] = useState(false);
  const source = segment.render_layer_url;
  // Only accept our authenticated content route, never a model-supplied external URL.
  const safe = source?.startsWith("/api/tools/subtitle-translation/workspaces/") &&
    /\/layers\/[a-f0-9]{64}\.png$/.test(source);
  if (safe && !failed) return <Image data-subtitle-layer={segment.segment_id} src={source!} alt="" fill unoptimized className="object-contain" onError={() => setFailed(true)} />;
  return <span data-subtitle-panel={segment.segment_id} className="shrink-0" style={{ backgroundColor: panel, lineHeight: "normal" }}>{segment.translated_text}{failed ? <span className="sr-only">产品图层加载失败</span> : null}</span>;
}

export function SubtitleVideoPreview({
  url, segments = [], selectedId, seekMs = 0, seekRequest = 0, label, enlarged = false, layoutSize
}: {
  url: string;
  segments?: SubtitleSegment[];
  selectedId?: string;
  seekMs?: number;
  seekRequest?: number;
  label: string;
  enlarged?: boolean;
  targetLanguage?: string;
  layoutSize?: { width: number; height: number } | null;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [media, setMedia] = useState({ width: 0, height: 0 });
  const [time, setTime] = useState(0);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = video.current;
    if (element && element.readyState >= 1) element.currentTime = seekMs / 1000;
  }, [seekMs, selectedId, seekRequest]);

  const rect = containedVideoRect(dimensions.width, dimensions.height, media.width, media.height);
  const outputSize = layoutSize ?? media;
  const visible = segments.filter((segment) =>
    !segment.excluded && segment.start_ms <= time && time < segment.end_ms
  );
  return (
    <figure className="min-w-0">
      {segments.length ? <style>{fontCss}</style> : null}
      <div ref={container} className={`relative w-full overflow-hidden rounded-xl bg-black ${enlarged ? "h-[65dvh]" : "h-64 sm:h-80"}`}>
        <video
          key={url}
          ref={video}
          aria-label={label}
          className="absolute inset-0 h-full w-full object-contain"
          controls
          playsInline
          preload="metadata"
          src={url}
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            setMedia({ width: element.videoWidth, height: element.videoHeight });
            element.currentTime = seekMs / 1000;
            setTime(seekMs);
          }}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime * 1000)}
        />
        {rect ? (
          <div aria-hidden="true" className="pointer-events-none absolute" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
            {visible.map((segment) => {
              const box = subtitlePreviewBox(segment, outputSize.width, outputSize.height);
              const colors = subtitleColors(segment);
              return (
                <div
                  key={segment.segment_id}
                  data-subtitle-box={segment.segment_id}
                  className="absolute flex items-center overflow-hidden whitespace-nowrap border"
                  style={{
                    left: `${box.left}%`, top: `${box.top}%`,
                    width: `${box.width}%`, height: `${box.height}%`,
                    borderColor: segment.segment_id === selectedId ? "#fbbf24" : "#ffffff66",
                    justifyContent: ({ left: "flex-start", center: "center", right: "flex-end" } as const)[segment.style.alignment ?? segment.alignment ?? "center"],
                    color: colors.text,
                    fontFamily: `subtitle-${subtitlePreviewFont(segment).id}, sans-serif`,
                    fontWeight: 400,
                    fontSynthesis: "none",
                    fontSize: Math.max(1, (segment.effective_font_size_px ?? segment.style.font_size_px ?? segment.estimated_font_size_px ?? 16) * rect.width / outputSize.width)
                  }}
                >
                  <SubtitleLayer key={segment.render_layer_asset_id ?? "text"} segment={segment} panel={colors.panel} />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{label}{segments.length ? " · 排版示意，最终以 MediaKit 成片为准" : ""}</figcaption>
    </figure>
  );
}
