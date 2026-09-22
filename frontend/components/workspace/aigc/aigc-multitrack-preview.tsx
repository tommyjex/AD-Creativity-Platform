"use client";

import { ImageIcon, Move, Video } from "lucide-react";
import Image from "next/image";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { AigcTimelineSource } from "@/lib/aigc/multitrack-editor-store";
import { useMultitrackPreviewFont } from "@/lib/aigc/multitrack-font-preview";
import {
  getPreviewCanvasSize,
  getPreviewSourceKey,
  getPreviewVisualLayers,
  getVideoPreviewTimeSeconds,
  movePreviewTransform,
  type PreviewGuideState,
  type PreviewResizeHandle,
  resizePreviewTransform
} from "@/lib/aigc/multitrack-preview";
import { resolveMultitrackTextPreview } from "@/lib/aigc/multitrack-text-preview";
import type {
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackTransform
} from "@/lib/aigc/types";
import { cn } from "@/lib/utils";

type TransformablePreviewElement = Extract<
  MultiTrackElement,
  { type: "image" | "text" }
>;

interface PreviewDraft {
  elementId: string;
  transform: MultiTrackTransform;
}

interface PreviewGesture {
  draft: MultiTrackTransform;
  elementId: string;
  handle: PreviewResizeHandle | null;
  initial: MultiTrackTransform;
  mode: "move" | "resize";
  pointerId: number;
  stageRect: DOMRect;
  startClientX: number;
  startClientY: number;
}

const EMPTY_GUIDES: PreviewGuideState = {
  horizontal: null,
  vertical: null
};

export function AigcMultitrackPreview({
  config,
  onCommitTransform,
  onSelectElement,
  playheadMs,
  selectedElementId,
  sources
}: {
  config: MultiTrackEditConfig;
  onCommitTransform: (
    elementId: string,
    transform: MultiTrackTransform
  ) => void;
  onSelectElement: (elementId: string | null) => void;
  playheadMs: number;
  selectedElementId: string | null;
  sources: AigcTimelineSource[];
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<PreviewGesture | null>(null);
  const draftRef = useRef<PreviewDraft | null>(null);
  const [draft, setDraft] = useState<PreviewDraft | null>(null);
  const [guides, setGuides] = useState<PreviewGuideState>(EMPTY_GUIDES);
  const { height: canvasHeight, width: canvasWidth } =
    getPreviewCanvasSize(config);
  const visible = getPreviewVisualLayers(config, playheadMs);
  const sourceMap = useMemo(
    () =>
      new Map(
        sources.map((source) => [getPreviewSourceKey(source), source])
      ),
    [sources]
  );
  const aspectRatio = `${canvasWidth} / ${canvasHeight}`;

  function beginGesture(
    event: ReactPointerEvent<HTMLElement>,
    element: TransformablePreviewElement,
    mode: PreviewGesture["mode"],
    handle: PreviewResizeHandle | null
  ) {
    if (event.button !== 0 || !stageRef.current) return;
    const stageRect = stageRef.current.getBoundingClientRect();
    if (stageRect.width <= 0 || stageRect.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelectElement(element.id);
    const current =
      draftRef.current?.elementId === element.id
        ? draftRef.current.transform
        : element.transform;
    const gesture: PreviewGesture = {
      draft: { ...current },
      elementId: element.id,
      handle,
      initial: { ...current },
      mode,
      pointerId: event.pointerId,
      stageRect,
      startClientX: event.clientX,
      startClientY: event.clientY
    };
    gestureRef.current = gesture;
    setPreviewDraft({ elementId: element.id, transform: current });
  }

  function moveGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX =
      ((event.clientX - gesture.startClientX) * canvasWidth) /
      gesture.stageRect.width;
    const deltaY =
      ((event.clientY - gesture.startClientY) * canvasHeight) /
      gesture.stageRect.height;
    const snapThreshold = Math.max(
      (8 * canvasWidth) / gesture.stageRect.width,
      (8 * canvasHeight) / gesture.stageRect.height
    );
    const result =
      gesture.mode === "move"
        ? movePreviewTransform(
            gesture.initial,
            deltaX,
            deltaY,
            canvasWidth,
            canvasHeight,
            snapThreshold
          )
        : resizePreviewTransform(
            gesture.initial,
            gesture.handle ?? "se",
            deltaX,
            deltaY,
            canvasWidth,
            canvasHeight,
            snapThreshold
          );
    gesture.draft = result.transform;
    setPreviewDraft({
      elementId: gesture.elementId,
      transform: result.transform
    });
    setGuides(result.guides);
  }

  function finishGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (!sameTransform(gesture.initial, gesture.draft)) {
      onCommitTransform(gesture.elementId, gesture.draft);
    }
    clearGesture();
  }

  function cancelGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    clearGesture();
  }

  function setPreviewDraft(next: PreviewDraft) {
    draftRef.current = next;
    setDraft(next);
  }

  function clearGesture() {
    gestureRef.current = null;
    draftRef.current = null;
    setDraft(null);
    setGuides(EMPTY_GUIDES);
  }

  return (
    <section
      aria-label="画面预览"
      className="relative flex min-h-0 flex-col bg-[#090b0e]"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
        <div
          className="relative max-h-full max-w-full touch-none overflow-hidden border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.5)] [container-type:size]"
          data-testid="multitrack-preview-stage"
          onPointerCancel={cancelGesture}
          onPointerDown={(event) => {
            if (event.currentTarget === event.target) onSelectElement(null);
          }}
          onPointerMove={moveGesture}
          onPointerUp={finishGesture}
          ref={stageRef}
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
          {visible.map(({ element, zIndex }) => {
            const transform =
              draft?.elementId === element.id
                ? draft.transform
                : element.transform;
            const source =
              element.type === "text"
                ? null
                : sourceMap.get(getPreviewSourceKey(element.source));
            const textPreview =
              element.type === "text"
                ? resolveMultitrackTextPreview(element, sources).text
                : null;
            return (
              <PreviewElement
                beginGesture={beginGesture}
                canvasHeight={canvasHeight}
                canvasWidth={canvasWidth}
                element={element}
                isSelected={selectedElementId === element.id}
                key={element.id}
                onSelectElement={onSelectElement}
                playheadMs={playheadMs}
                previewUrl={source?.preview_url ?? null}
                textPreview={textPreview}
                transform={transform}
                zIndex={zIndex}
              />
            );
          })}
          <PreviewGuides
            canvasHeight={canvasHeight}
            canvasWidth={canvasWidth}
            guides={guides}
          />
        </div>
      </div>
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/[0.07] px-3 text-[10px] text-zinc-500">
        <span>画面预览 · {formatTime(playheadMs)}</span>
        <span>当前帧预览 · 最终效果以 MediaKit 合成为准</span>
      </div>
    </section>
  );
}

function PreviewElement({
  beginGesture,
  canvasHeight,
  canvasWidth,
  element,
  isSelected,
  onSelectElement,
  playheadMs,
  previewUrl,
  textPreview,
  transform,
  zIndex
}: {
  beginGesture: (
    event: ReactPointerEvent<HTMLElement>,
    element: TransformablePreviewElement,
    mode: PreviewGesture["mode"],
    handle: PreviewResizeHandle | null
  ) => void;
  canvasHeight: number;
  canvasWidth: number;
  element: Exclude<MultiTrackElement, { type: "audio" | "subtitle" }>;
  isSelected: boolean;
  onSelectElement: (elementId: string | null) => void;
  playheadMs: number;
  previewUrl: string | null;
  textPreview: string | null;
  transform: MultiTrackTransform;
  zIndex: number;
}) {
  const previewFont = useMultitrackPreviewFont(
    element.type === "text" ? element.style.font_type ?? null : null
  );
  const style = {
    ...previewBoxStyle(transform, canvasWidth, canvasHeight, zIndex),
    fontFamily:
      previewFont.status === "loaded" ? previewFont.family : undefined
  };

  if (element.type === "video") {
    return (
      <div
        className="pointer-events-none absolute overflow-hidden"
        data-testid={`preview-element-${element.id}`}
        style={style}
      >
        <PreviewVideo
          element={element}
          playheadMs={playheadMs}
          previewUrl={previewUrl}
        />
      </div>
    );
  }

  return (
    <div
      aria-label={`选择${element.type === "text" ? "文字" : "图片"} ${element.id}`}
      aria-pressed={isSelected}
      className={cn(
        "group absolute cursor-move overflow-visible outline-none",
        isSelected
          ? "ring-1 ring-blue-400 ring-offset-1 ring-offset-[#090b0e]"
          : "hover:ring-1 hover:ring-white/50"
      )}
      data-testid={`preview-element-${element.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelectElement(element.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectElement(element.id);
        }
      }}
      onPointerDown={(event) =>
        beginGesture(event, element, "move", null)
      }
      role="button"
      style={style}
      tabIndex={0}
    >
      {element.type === "text" ? (
        <div
          className="flex h-full w-full items-center justify-center overflow-hidden whitespace-pre-wrap px-2 text-center leading-tight"
          style={{
            backgroundColor: rgbaToCss(element.style.background_color),
            color: rgbaToCss(element.style.color),
            fontSize: `${Math.max(
              1,
              (element.style.font_size / canvasHeight) * 100
            )}cqh`,
            fontStyle: element.style.italic ? "italic" : "normal",
            fontWeight: element.style.bold ? 700 : 400,
            textDecoration: element.style.underline ? "underline" : "none"
          }}
        >
          {textPreview}
        </div>
      ) : (
        <PreviewImage
          elementId={element.id}
          previewUrl={previewUrl}
        />
      )}
      {isSelected ? (
        <>
          <div className="pointer-events-none absolute left-1 top-1 flex items-center gap-1 bg-black/65 px-1.5 py-1 text-[9px] text-white">
            <Move className="h-3 w-3" />
            {element.type === "text" ? "文字" : "图片"}
          </div>
          {(["nw", "ne", "sw", "se"] as const).map((handle) => (
            <button
              aria-label={`从${resizeHandleLabel(handle)}缩放 ${element.id}`}
              className={cn(
                "absolute z-20 h-3 w-3 border border-blue-300 bg-white shadow",
                handle.includes("n") ? "-top-1.5" : "-bottom-1.5",
                handle.includes("w") ? "-left-1.5" : "-right-1.5",
                handle === "nw" || handle === "se"
                  ? "cursor-nwse-resize"
                  : "cursor-nesw-resize"
              )}
              data-resize-handle={handle}
              key={handle}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) =>
                beginGesture(event, element, "resize", handle)
              }
              type="button"
            />
          ))}
        </>
      ) : null}
    </div>
  );
}

function PreviewVideo({
  element,
  playheadMs,
  previewUrl
}: {
  element: Extract<MultiTrackElement, { type: "video" }>;
  playheadMs: number;
  previewUrl: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const previewTime = getVideoPreviewTimeSeconds(element, playheadMs);
  const failed = previewUrl !== null && failedUrl === previewUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewUrl) return;
    const seek = () => {
      const maximum =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.max(0, video.duration - 0.001)
          : previewTime;
      video.pause();
      video.muted = true;
      video.currentTime = Math.min(previewTime, maximum);
    };
    if (video.readyState >= 1) {
      seek();
      return;
    }
    video.addEventListener("loadedmetadata", seek, { once: true });
    return () => video.removeEventListener("loadedmetadata", seek);
  }, [previewTime, previewUrl]);

  if (!previewUrl || failed) {
    return (
      <MediaUnavailable
        icon={Video}
        label={failed ? "视频预览加载失败" : "视频素材不可预览"}
      />
    );
  }

  return (
    <video
      aria-label={`背景视频 ${element.source.source_node_id}`}
      className="h-full w-full bg-black object-contain"
      data-preview-time-seconds={previewTime}
      muted
      onError={() => setFailedUrl(previewUrl)}
      playsInline
      preload="auto"
      ref={videoRef}
      src={previewUrl}
    />
  );
}

function PreviewImage({
  elementId,
  previewUrl
}: {
  elementId: string;
  previewUrl: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = previewUrl !== null && failedUrl === previewUrl;

  if (!previewUrl || failed) {
    return (
      <MediaUnavailable
        icon={ImageIcon}
        label={failed ? "图片预览加载失败" : "图片素材不可预览"}
      />
    );
  }
  return (
    <Image
      alt=""
      className="pointer-events-none h-full w-full bg-black/20 object-contain"
      draggable={false}
      fill
      onError={() => setFailedUrl(previewUrl)}
      src={previewUrl}
      title={elementId}
      unoptimized
    />
  );
}

function MediaUnavailable({
  icon: Icon,
  label
}: {
  icon: typeof Video;
  label: string;
}) {
  return (
    <div className="grid h-full w-full place-items-center border border-white/10 bg-zinc-900/90">
      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
    </div>
  );
}

function PreviewGuides({
  canvasHeight,
  canvasWidth,
  guides
}: {
  canvasHeight: number;
  canvasWidth: number;
  guides: PreviewGuideState;
}) {
  return (
    <>
      {guides.vertical !== null ? (
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-[1000] w-px bg-blue-400"
          data-testid="preview-guide-vertical"
          style={{ left: `${(guides.vertical / canvasWidth) * 100}%` }}
        />
      ) : null}
      {guides.horizontal !== null ? (
        <div
          className="pointer-events-none absolute left-0 right-0 z-[1000] h-px bg-blue-400"
          data-testid="preview-guide-horizontal"
          style={{ top: `${(guides.horizontal / canvasHeight) * 100}%` }}
        />
      ) : null}
    </>
  );
}

function previewBoxStyle(
  transform: MultiTrackTransform,
  canvasWidth: number,
  canvasHeight: number,
  zIndex: number
) {
  return {
    height: `${(Math.max(1, transform.height) / canvasHeight) * 100}%`,
    left: `${(transform.x / canvasWidth) * 100}%`,
    top: `${(transform.y / canvasHeight) * 100}%`,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: "center",
    width: `${(Math.max(1, transform.width) / canvasWidth) * 100}%`,
    zIndex
  };
}

function sameTransform(
  left: MultiTrackTransform,
  right: MultiTrackTransform
) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height &&
    left.rotation === right.rotation
  );
}

function resizeHandleLabel(handle: PreviewResizeHandle) {
  return {
    ne: "右上角",
    nw: "左上角",
    se: "右下角",
    sw: "左下角"
  }[handle];
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
