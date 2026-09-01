"use client";

import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import {
  Download,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Maximize2,
  TriangleAlert
} from "lucide-react";
import { memo } from "react";

import {
  useCanvasHandlers,
  type OutputNodeData
} from "@/components/workspace/canvas/canvas-context";
import { cn } from "@/lib/utils";

export type OutputFlowNode = Node<OutputNodeData, "output">;

const SOURCE_LABELS: Record<OutputNodeData["source"], string> = {
  image_to_image: "参考图生图",
  layer_decomposition: "图层拆分",
  text_to_image: "文生图"
};

/**
 * Output node: shows a generation result (text-to-image / image-to-image /
 * layer decomposition). While the task runs it renders a pending state; on
 * success it shows the image at its intrinsic aspect ratio plus download,
 * preview, set-as-reference and layer-decomposition actions.
 */
function OutputNodeComponent({ data, id, selected }: NodeProps<OutputFlowNode>) {
  const handlers = useCanvasHandlers();
  const downloadUrl = handlers.getOutputDownloadUrl(id);

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition",
        selected ? "border-primary ring-1 ring-primary/30" : "border-border"
      )}
    >
      <NodeResizer
        color="hsl(var(--primary))"
        isVisible={selected}
        keepAspectRatio
        minHeight={140}
        minWidth={140}
      />
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {SOURCE_LABELS[data.source]}
          </span>
        </span>
      </div>
      <div className="nodrag relative min-h-0 flex-1 bg-slate-950">
        {data.status === "pending" ? (
          <div
            aria-live="polite"
            className="grid h-full w-full place-items-center gap-2 p-4 text-center text-xs text-slate-300"
            role="status"
          >
            <LoaderCircle className="h-5 w-5 text-primary" />
            <span>生成中，请留在画布查看结果。</span>
          </div>
        ) : data.status === "failed" ? (
          <div className="grid h-full w-full place-items-center gap-2 p-4 text-center text-xs text-destructive">
            <TriangleAlert className="h-5 w-5" />
            <span>{data.errorMessage ?? "生成失败，可在右侧重试。"}</span>
          </div>
        ) : data.url ? (
          <div className="grid h-full w-full place-items-center overflow-hidden p-1">
            {/* Signed asset URLs must be passed through without image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={data.name}
              className="block h-full w-full select-none object-contain"
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget;
                handlers.onOutputImageLoad(
                  id,
                  image.naturalWidth,
                  image.naturalHeight
                );
              }}
              src={data.url}
            />
          </div>
        ) : (
          <div className="grid h-full w-full place-items-center p-4 text-center text-xs text-slate-300">
            结果暂不可预览。
          </div>
        )}
      </div>
      {data.status === "succeeded" && data.url ? (
        <div className="flex h-10 shrink-0 items-center gap-1 border-t border-border bg-card/80 px-2">
          {downloadUrl ? (
            <a
              aria-label={`下载：${data.name}`}
              className="nodrag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              download={data.name}
              href={downloadUrl}
              rel="noreferrer"
              title="下载"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <button
            aria-label={`查看原图：${data.name}`}
            className="nodrag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            onClick={() => handlers.onOutputPreview(id)}
            title="查看原图"
            type="button"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label={`设为参考图：${data.name}`}
            className="nodrag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
            disabled={data.disabled}
            onClick={() => handlers.onOutputSetAsReference(id)}
            title="设为参考图"
            type="button"
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label={`图层拆分：${data.name}`}
            className="nodrag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
            disabled={data.disabled || data.layerBusy}
            onClick={() => handlers.onOutputLayerDecompose(id)}
            title="图层拆分"
            type="button"
          >
            {data.layerBusy ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Layers3 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
