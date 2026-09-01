"use client";

import { X } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  createBboxAnnotation,
  normalizeImagePoint,
  type ImageRect
} from "@/components/workspace/image-edit-dialog";
import type { ImageEditAnnotation } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/** Normalized (0-1000) bounding box shared across the canvas experience. */
export type Bbox = Extract<ImageEditAnnotation, { type: "bbox" }>;
export type ResizeHandle =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

/**
 * Reusable framing canvas: renders an image at its intrinsic aspect ratio and
 * lets the user draw / resize a normalized bbox on top of it. Extracted from
 * `image-canvas-editor.tsx` so the dialog form and the node canvas share one
 * implementation.
 */
export function BboxCanvas({
  alt,
  bbox,
  className,
  disabled,
  fillImageBox = false,
  fitToImageAspect,
  onChange,
  onImageLoad,
  onPreview,
  url
}: {
  alt: string;
  bbox: Bbox | null;
  className?: string;
  disabled: boolean;
  fillImageBox?: boolean;
  fitToImageAspect?: boolean;
  onChange: (bbox: Bbox | null) => void;
  onImageLoad?: (naturalWidth: number, naturalHeight: number) => void;
  onPreview?: () => void;
  url: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    moved: boolean;
    point: { x: number; y: number };
  } | null>(null);
  const resizeRef = useRef<{ bbox: Bbox; handle: ResizeHandle } | null>(null);
  const [naturalImageSize, setNaturalImageSize] = useState<{
    height: number;
    url: string;
    width: number;
  } | null>(null);
  const [renderedImageState, setRenderedImageState] = useState<{
    rect: ImageRect;
    url: string;
  } | null>(null);
  const renderedImageRect =
    renderedImageState?.url === url ? renderedImageState.rect : null;
  const naturalAspectRatio =
    naturalImageSize?.url === url &&
    naturalImageSize.width > 0 &&
    naturalImageSize.height > 0
      ? `${naturalImageSize.width} / ${naturalImageSize.height}`
      : undefined;

  function imageRect(): ImageRect | null {
    const image = imageRef.current;
    if (!image) return null;
    const bounds = image.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 ? bounds : null;
  }

  const updateRenderedImageRect = useCallback(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image || !url) return null;
    const containerBounds = container.getBoundingClientRect();
    const rect = imageRect();
    if (!rect) return null;
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    // `getBoundingClientRect` reports the *visual* size, so inside React Flow's
    // zoomed `transform: scale(zoom)` subtree it is already multiplied by the
    // current zoom. The overlay is positioned in local (unscaled) CSS px and
    // then re-scaled by the same transform, so we must divide the measurement
    // back into local space or the box double-scales and drifts off the region.
    // `offsetWidth` is a layout metric unaffected by ancestor transforms, so its
    // ratio to the visual width yields the cumulative scale (1 in the dialog).
    const scale = image.offsetWidth > 0 ? rect.width / image.offsetWidth : 1;
    const safeScale = scale > 0 ? scale : 1;
    const nextRect = {
      height: rect.height / safeScale,
      left: (rect.left - containerBounds.left) / safeScale,
      top: (rect.top - containerBounds.top) / safeScale,
      width: rect.width / safeScale
    };
    setRenderedImageState((current) => {
      const sameRect =
        current?.url === url &&
        Math.abs(current.rect.height - nextRect.height) < 0.5 &&
        Math.abs(current.rect.left - nextRect.left) < 0.5 &&
        Math.abs(current.rect.top - nextRect.top) < 0.5 &&
        Math.abs(current.rect.width - nextRect.width) < 0.5;
      return sameRect ? current : { rect: nextRect, url };
    });
    return nextRect;
  }, [url]);

  useEffect(() => {
    if (!url) return;

    updateRenderedImageRect();

    const container = containerRef.current;
    const image = imageRef.current;
    if (typeof ResizeObserver === "undefined" || (!container && !image)) {
      window.addEventListener("resize", updateRenderedImageRect);
      return () => {
        window.removeEventListener("resize", updateRenderedImageRect);
      };
    }

    const observer = new ResizeObserver(() => {
      updateRenderedImageRect();
    });
    if (container) observer.observe(container);
    if (image) observer.observe(image);

    return () => {
      observer.disconnect();
    };
  }, [updateRenderedImageRect, url]);

  function point(event: ReactPointerEvent<HTMLElement>) {
    updateRenderedImageRect();
    const rect = imageRect();
    return rect && rect.width > 0 && rect.height > 0
      ? normalizeImagePoint(event.clientX, event.clientY, rect)
      : null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLImageElement>) {
    if (disabled) return;
    if (resizeRef.current) return;
    const nextPoint = point(event);
    if (!nextPoint) return;
    dragStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
      point: nextPoint
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (disabled) return;
    const nextPoint = point(event);
    if (!nextPoint) return;
    if (resizeRef.current) {
      setBbox(resizeBbox(resizeRef.current.bbox, resizeRef.current.handle, nextPoint));
      return;
    }
    if (dragStartRef.current) {
      const distance = Math.hypot(
        event.clientX - dragStartRef.current.clientX,
        event.clientY - dragStartRef.current.clientY
      );
      if (distance < 4 && !dragStartRef.current.moved) return;
      dragStartRef.current.moved = true;
      setBbox(createBboxAnnotation(dragStartRef.current.point, nextPoint));
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (disabled) return;
    const nextPoint = point(event);
    if (nextPoint && resizeRef.current) {
      setBbox(resizeBbox(resizeRef.current.bbox, resizeRef.current.handle, nextPoint));
    } else if (nextPoint && dragStartRef.current) {
      const distance = Math.hypot(
        event.clientX - dragStartRef.current.clientX,
        event.clientY - dragStartRef.current.clientY
      );
      if (dragStartRef.current.moved || distance >= 4) {
        setBbox(createBboxAnnotation(dragStartRef.current.point, nextPoint));
      }
    }
    dragStartRef.current = null;
    resizeRef.current = null;
  }

  function setBbox(annotation: ReturnType<typeof createBboxAnnotation>) {
    onChange(annotation?.type === "bbox" ? annotation : null);
  }

  return (
    <div
      className={cn(
        "relative place-items-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950",
        fitToImageAspect && naturalAspectRatio
          ? "inline-grid w-auto justify-self-center"
          : "grid w-full",
        className
      )}
      ref={containerRef}
      style={
        fitToImageAspect && naturalAspectRatio
          ? { aspectRatio: naturalAspectRatio }
          : undefined
      }
    >
      {url ? (
        <div
          className="relative grid h-full w-full place-items-center"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Signed asset URLs must be passed through without image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={alt}
            className={cn(
              "block select-none object-contain touch-none",
              fillImageBox
                ? "absolute inset-0 h-full w-full"
                : "h-auto max-h-full w-auto max-w-full",
              !disabled && (onPreview ? "cursor-zoom-in" : "cursor-crosshair")
            )}
            draggable={false}
            onDoubleClick={() => {
              if (disabled || !onPreview) return;
              onPreview();
            }}
            onLoad={(event) => {
              const image = event.currentTarget;
              if (url) {
                setNaturalImageSize({
                  height: image.naturalHeight,
                  url,
                  width: image.naturalWidth
                });
              }
              onImageLoad?.(image.naturalWidth, image.naturalHeight);
              updateRenderedImageRect();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              handlePointerDown(event);
            }}
            ref={imageRef}
            src={url}
          />
          {bbox && renderedImageRect ? (
            <div
              className="pointer-events-none absolute"
              style={{
                height: `${renderedImageRect.height}px`,
                left: `${renderedImageRect.left}px`,
                top: `${renderedImageRect.top}px`,
                width: `${renderedImageRect.width}px`
              }}
            >
              <BboxOverlay
                bbox={bbox}
                disabled={disabled}
                onClear={() => onChange(null)}
                onResizeStart={(event, handle) => {
                  if (disabled) return;
                  resizeRef.current = { bbox, handle };
                  dragStartRef.current = null;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  event.stopPropagation();
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-4 text-center text-sm text-slate-300">
          尚未生成目标图。填写提示词后即可生成首张图片。
        </p>
      )}
    </div>
  );
}

function BboxOverlay({
  bbox,
  disabled,
  onClear,
  onResizeStart
}: {
  bbox: Bbox;
  disabled: boolean;
  onClear: () => void;
  onResizeStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: ResizeHandle
  ) => void;
}) {
  return (
    <span
      className="pointer-events-none absolute border-2 border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
      style={{
        height: `${(bbox.y2 - bbox.y1) / 10}%`,
        left: `${bbox.x1 / 10}%`,
        top: `${bbox.y1 / 10}%`,
        width: `${(bbox.x2 - bbox.x1) / 10}%`
      }}
    >
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map(
        (handle) => (
          <button
            aria-label={`调整框选区域：${handle}`}
            className={cn(
              "pointer-events-auto absolute h-3 w-3 rounded-full border-2 border-white bg-primary shadow-sm",
              handle.includes("top") ? "-top-1.5" : "-bottom-1.5",
              handle.includes("left") ? "-left-1.5" : "-right-1.5"
            )}
            disabled={disabled}
            key={handle}
            onPointerDown={(event) => onResizeStart(event, handle)}
            type="button"
          />
        )
      )}
      <button
        aria-label="删除框选区域"
        className="pointer-events-auto absolute -right-1.5 -top-1.5 grid h-3 w-3 place-items-center rounded-full border border-white bg-destructive text-destructive-foreground shadow-sm transition hover:scale-105"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onClear();
        }}
        type="button"
      >
        <X className="h-2 w-2" />
      </button>
    </span>
  );
}

export function resizeBbox(
  bbox: Bbox,
  handle: ResizeHandle,
  point: { x: number; y: number }
) {
  const start = {
    x: handle.includes("left") ? point.x : bbox.x1,
    y: handle.includes("top") ? point.y : bbox.y1
  };
  const end = {
    x: handle.includes("right") ? point.x : bbox.x2,
    y: handle.includes("bottom") ? point.y : bbox.y2
  };
  return createBboxAnnotation(start, end);
}
