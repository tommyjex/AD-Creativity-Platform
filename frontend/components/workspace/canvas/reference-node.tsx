"use client";

import { NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { memo } from "react";

import { BboxCanvas } from "@/components/workspace/canvas/bbox-canvas";
import {
  REFERENCE_MEDIA_MIN_SIZE,
  REFERENCE_NODE_HORIZONTAL_CHROME,
  REFERENCE_NODE_VERTICAL_CHROME,
  useCanvasHandlers,
  type ReferenceNodeData
} from "@/components/workspace/canvas/canvas-context";
import { cn } from "@/lib/utils";

export type ReferenceFlowNode = Node<ReferenceNodeData, "reference">;

/**
 * Reference image node: carries one project reference image, shows its「图N」
 * badge, supports media-ratio-normalized resize and in-node bbox framing.
 * Removal is confirmed and handled by the page (unlinks the reference without
 * deleting the backend asset).
 */
function ReferenceNodeComponent({ data, id, selected }: NodeProps<ReferenceFlowNode>) {
  const handlers = useCanvasHandlers();

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition",
        selected ? "border-primary ring-1 ring-primary/30" : "border-border"
      )}
    >
      <NodeResizer
        color="hsl(var(--primary))"
        isVisible={selected && !data.disabled}
        minHeight={REFERENCE_MEDIA_MIN_SIZE + REFERENCE_NODE_VERTICAL_CHROME}
        minWidth={REFERENCE_MEDIA_MIN_SIZE + REFERENCE_NODE_HORIZONTAL_CHROME}
      />
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
            {data.label}
          </span>
          <span className="max-w-[9rem] truncate">{data.name}</span>
        </span>
        <button
          aria-label={`移除参考图：${data.name}`}
          className="nodrag grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-destructive disabled:opacity-50"
          disabled={data.disabled}
          onClick={() => handlers.onRequestRemoveReference(id)}
          title={`移除参考图：${data.name}`}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="nodrag min-h-0 flex-1 p-2">
        <BboxCanvas
          alt={`参考图：${data.name}`}
          bbox={data.bbox}
          className="h-full w-full"
          disabled={data.disabled}
          fillImageBox
          onChange={(bbox) => handlers.onReferenceBboxChange(id, bbox)}
          onImageLoad={(naturalWidth, naturalHeight) =>
            handlers.onReferenceImageLoad(id, naturalWidth, naturalHeight)
          }
          onPreview={() => handlers.onReferencePreview(id)}
          url={data.url}
        />
      </div>
    </div>
  );
}

export const ReferenceNode = memo(ReferenceNodeComponent);
