"use client";

import {
  BoxSelect,
  CircleDot,
  Eraser,
  ImageIcon,
  LoaderCircle,
  MousePointer2,
  WandSparkles
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getSafePreviewUrl } from "@/lib/asset-display";
import type {
  Asset,
  ImageEditAnnotation,
  ImageGenerationSize,
  ImageOutputFormat
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

export interface ImageRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

type EditMode = "whole" | "point" | "bbox";
type NormalizedPoint = { x: number; y: number };

export function getContainedImageRect(
  container: ImageRect,
  naturalWidth: number,
  naturalHeight: number
): ImageRect {
  if (
    container.width <= 0 ||
    container.height <= 0 ||
    naturalWidth <= 0 ||
    naturalHeight <= 0
  ) {
    return { ...container, height: 0, width: 0 };
  }
  const scale = Math.min(
    container.width / naturalWidth,
    container.height / naturalHeight
  );
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    height,
    left: container.left + (container.width - width) / 2,
    top: container.top + (container.height - height) / 2,
    width
  };
}

export function normalizeImagePoint(
  clientX: number,
  clientY: number,
  imageRect: ImageRect
): NormalizedPoint {
  return {
    x: normalizeCoordinate(clientX - imageRect.left, imageRect.width),
    y: normalizeCoordinate(clientY - imageRect.top, imageRect.height)
  };
}

export function createBboxAnnotation(
  start: NormalizedPoint,
  end: NormalizedPoint
): ImageEditAnnotation | null {
  const x1 = Math.min(start.x, end.x);
  const y1 = Math.min(start.y, end.y);
  const x2 = Math.max(start.x, end.x);
  const y2 = Math.max(start.y, end.y);
  return x1 < x2 && y1 < y2
    ? { type: "bbox", x1, x2, y1, y2 }
    : null;
}

function normalizeCoordinate(relative: number, length: number) {
  if (length <= 0) return 0;
  return Math.min(999, Math.max(0, Math.round((relative / length) * 1000)));
}

export function ImageEditDialog({
  asset,
  format,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  size
}: {
  asset: Asset | null;
  format: ImageOutputFormat;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    annotation: ImageEditAnnotation | null;
    prompt: string;
  }) => void;
  open: boolean;
  size: ImageGenerationSize;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<NormalizedPoint | null>(null);
  const [annotation, setAnnotation] = useState<ImageEditAnnotation | null>(null);
  const [mode, setMode] = useState<EditMode>("whole");
  const [prompt, setPrompt] = useState("");
  const previewUrl = asset ? getSafePreviewUrl(asset) : null;

  function contentRect(): ImageRect | null {
    const image = imageRef.current;
    if (!image) return null;
    const bounds = image.getBoundingClientRect();
    return getContainedImageRect(
      bounds,
      image.naturalWidth,
      image.naturalHeight
    );
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLImageElement>) {
    const rect = contentRect();
    return rect && rect.width > 0 && rect.height > 0
      ? normalizeImagePoint(event.clientX, event.clientY, rect)
      : null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLImageElement>) {
    if (mode === "whole") return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (mode === "point") {
      setAnnotation({ type: "point", ...point });
      return;
    }
    dragStartRef.current = point;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLImageElement>) {
    if (mode !== "bbox" || !dragStartRef.current) return;
    const point = pointFromEvent(event);
    if (!point) return;
    setAnnotation(createBboxAnnotation(dragStartRef.current, point));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLImageElement>) {
    if (mode !== "bbox" || !dragStartRef.current) return;
    const point = pointFromEvent(event);
    if (point) {
      setAnnotation(createBboxAnnotation(dragStartRef.current, point));
    }
    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function selectMode(nextMode: EditMode) {
    setMode(nextMode);
    dragStartRef.current = null;
    if (nextMode === "whole") setAnnotation(null);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="grid h-[min(94dvh,64rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader className="border-b border-border px-4 py-4 pr-14 sm:px-6">
          <DialogTitle>图片编辑</DialogTitle>
          <DialogDescription>
            整图重绘，或用点选/框选将编辑指令定位到具体区域。
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
          <section className="min-w-0">
            <div className="mb-3 flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/55 p-1">
              <ToolButton
                active={mode === "whole"}
                icon={ImageIcon}
                label="整图编辑"
                onClick={() => selectMode("whole")}
              />
              <ToolButton
                active={mode === "point"}
                icon={CircleDot}
                label="点选精修"
                onClick={() => selectMode("point")}
              />
              <ToolButton
                active={mode === "bbox"}
                icon={BoxSelect}
                label="框选精修"
                onClick={() => selectMode("bbox")}
              />
              <span className="mx-1 h-5 w-px shrink-0 bg-border" />
              <Button
                aria-label="清除标注"
                disabled={!annotation}
                onClick={() => setAnnotation(null)}
                size="icon"
                title="清除标注"
                type="button"
                variant="ghost"
              >
                <Eraser aria-hidden="true" className="h-4 w-4" />
              </Button>
              <p className="ml-auto hidden truncate px-2 font-mono text-[11px] text-muted-foreground sm:block">
                {annotation ? annotationLabel(annotation) : "NO ANNOTATION"}
              </p>
            </div>

            <div className="relative grid min-h-64 w-full place-items-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 sm:min-h-96 lg:h-full lg:max-h-[66dvh]">
              {previewUrl ? (
                <div className="relative inline-grid max-h-full max-w-full place-items-center">
                  {/* Signed source images must retain their original pixels and URL. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="待编辑源图"
                    className={cn(
                      "block h-auto max-h-[66dvh] w-auto max-w-full select-none object-contain",
                      mode === "point" && "cursor-crosshair",
                      mode === "bbox" && "cursor-crosshair touch-none"
                    )}
                    draggable={false}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    ref={imageRef}
                    src={previewUrl}
                  />
                  {annotation ? <AnnotationOverlay annotation={annotation} /> : null}
                </div>
              ) : (
                <p className="px-6 text-center text-sm text-slate-300">
                  源图暂不可预览
                </p>
              )}
            </div>
          </section>

          <section className="flex min-w-0 flex-col">
            <div className="rounded-xl border border-border bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">
              输出 {size} · {format.toUpperCase()}
            </div>
            <label
              className="mt-4 text-sm font-semibold"
              htmlFor="image-edit-prompt"
            >
              编辑指令
            </label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              只描述需要改变的内容。未标注时指令作用于整张图片。
            </p>
            <Textarea
              className="mt-3 min-h-40 flex-1 resize-y leading-6 lg:min-h-0"
              disabled={isSubmitting}
              id="image-edit-prompt"
              maxLength={4000}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：将背景改为暖灰色摄影棚，保留商品造型和光影。"
              value={prompt}
            />
            <p className="mt-2 text-right font-mono text-[11px] text-muted-foreground">
              {prompt.length} / 4000
            </p>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            取消
          </Button>
          <Button
            disabled={
              isSubmitting ||
              !prompt.trim() ||
              !previewUrl ||
              (mode !== "whole" && !annotation)
            }
            onClick={() => onSubmit({ annotation, prompt: prompt.trim() })}
            type="button"
          >
            {isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <WandSparkles aria-hidden="true" className="h-4 w-4" />
            )}
            {isSubmitting ? "正在提交" : "生成编辑版本"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon: typeof MousePointer2;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={cn(active && "border-primary/30 bg-card text-primary")}
      onClick={onClick}
      size="icon"
      title={label}
      type="button"
      variant={active ? "outline" : "ghost"}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </Button>
  );
}

function AnnotationOverlay({
  annotation
}: {
  annotation: ImageEditAnnotation;
}) {
  if (annotation.type === "point") {
    return (
      <span
        className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.35)]"
        style={{ left: `${annotation.x / 10}%`, top: `${annotation.y / 10}%` }}
      />
    );
  }
  return (
    <span
      className="pointer-events-none absolute border-2 border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]"
      style={{
        height: `${(annotation.y2 - annotation.y1) / 10}%`,
        left: `${annotation.x1 / 10}%`,
        top: `${annotation.y1 / 10}%`,
        width: `${(annotation.x2 - annotation.x1) / 10}%`
      }}
    />
  );
}

function annotationLabel(annotation: ImageEditAnnotation) {
  return annotation.type === "point"
    ? `POINT ${annotation.x},${annotation.y}`
    : `BBOX ${annotation.x1},${annotation.y1} → ${annotation.x2},${annotation.y2}`;
}
