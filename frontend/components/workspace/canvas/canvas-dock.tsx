"use client";

import { LoaderCircle, Sparkles } from "lucide-react";

import type { Bbox } from "@/components/workspace/canvas/bbox-canvas";
import { VisualPromptEditor } from "@/components/workspace/canvas/visual-prompt-editor";
import { Button } from "@/components/ui/button";
import type {
  Asset,
  Brief,
  ImageGenerationSize,
  ImageOutputFormat
} from "@/lib/api-types";

/** Generation link the dock will trigger, derived from referenced regions. */
export type GenerationMode = "image_to_image" | "text_to_image";

/**
 * Fixed right dock: hosts the prompt editor and image configuration (aspect
 * ratio / resolution / format) plus the generate action. It stays pinned inside
 * the canvas container, so panning/zooming the node canvas does not move it.
 */
export function CanvasDock({
  aspectRatio,
  bboxOrder,
  disabled,
  feedback,
  format,
  isSubmitting,
  mode,
  onAspectRatioChange,
  onFormatChange,
  onPromptChange,
  onRemoveReference,
  onSerializedPromptChange,
  onSizeChange,
  onSubmit,
  prompt,
  referenceAssets,
  referenceBboxes,
  selectedReferenceAssets,
  size,
  validationMessage
}: {
  aspectRatio: Brief["aspect_ratio"];
  bboxOrder: string[];
  disabled: boolean;
  feedback: string | null;
  format: ImageOutputFormat;
  isSubmitting: boolean;
  mode: GenerationMode;
  onAspectRatioChange: (aspectRatio: Brief["aspect_ratio"]) => void;
  onFormatChange: (format: ImageOutputFormat) => void;
  onPromptChange: (prompt: string) => void;
  onRemoveReference?: (assetId: string) => void;
  onSerializedPromptChange: (prompt: string) => void;
  onSizeChange: (size: ImageGenerationSize) => void;
  onSubmit: () => void;
  prompt: string;
  referenceAssets: Asset[];
  referenceBboxes: Record<string, Bbox>;
  selectedReferenceAssets: Asset[];
  size: ImageGenerationSize;
  validationMessage: string | null;
}) {
  const canSubmit = validationMessage === null && !disabled && !isSubmitting;

  return (
    <aside className="pointer-events-auto absolute inset-y-4 right-4 z-20 flex w-72 flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:w-80">
      <div>
        <h2 className="text-sm font-semibold text-foreground">生成配置</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {mode === "image_to_image"
            ? "已引用参考图区域，将走参考图生图链路。"
            : "尚未引用参考图区域，将走文生图链路。"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-secondary/40 p-2">
        <label className="min-w-0 text-[11px] font-medium text-muted-foreground">
          画幅
          <select
            aria-label="画幅"
            className="mt-1 h-8 w-full rounded border border-input bg-card px-1 text-xs text-foreground"
            disabled={isSubmitting}
            onChange={(event) =>
              onAspectRatioChange(event.target.value as Brief["aspect_ratio"])
            }
            value={aspectRatio}
          >
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
            <option value="3:4">3:4</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>
        </label>
        <label className="min-w-0 text-[11px] font-medium text-muted-foreground">
          分辨率
          <select
            aria-label="画布分辨率"
            className="mt-1 h-8 w-full rounded border border-input bg-card px-1 text-xs text-foreground"
            disabled={isSubmitting}
            onChange={(event) =>
              onSizeChange(event.target.value as ImageGenerationSize)
            }
            value={size}
          >
            <option value="1K">1K</option>
            <option value="1.5K">1.5K</option>
            <option value="2K">2K</option>
          </select>
        </label>
        <label className="min-w-0 text-[11px] font-medium text-muted-foreground">
          格式
          <select
            aria-label="画布输出格式"
            className="mt-1 h-8 w-full rounded border border-input bg-card px-1 text-xs text-foreground"
            disabled={isSubmitting}
            onChange={(event) =>
              onFormatChange(event.target.value as ImageOutputFormat)
            }
            value={format}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </label>
      </div>
      <div>
        <label className="text-sm font-semibold" htmlFor="canvas-edit-prompt">
          图片提示词
        </label>
        <VisualPromptEditor
          bboxOrder={bboxOrder}
          disabled={isSubmitting}
          isInitialGeneration
          onPromptChange={onPromptChange}
          onRemoveReference={onRemoveReference}
          onSerializedPromptChange={onSerializedPromptChange}
          prompt={prompt}
          referenceAssets={referenceAssets}
          referenceBboxes={referenceBboxes}
          selectedReferenceAssets={selectedReferenceAssets}
          targetAsset={null}
          targetBbox={null}
        />
      </div>
      <div className="mt-auto space-y-3">
        {validationMessage ? (
          <p className="text-xs leading-5 text-muted-foreground" role="status">
            {validationMessage}
          </p>
        ) : null}
        {feedback ? (
          <p className="text-xs leading-5 text-muted-foreground">{feedback}</p>
        ) : null}
        <Button
          className="w-full"
          disabled={!canSubmit}
          onClick={() => {
            if (canSubmit) onSubmit();
          }}
          type="button"
        >
          {isSubmitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isSubmitting ? "生成中" : "生成图片"}
        </Button>
      </div>
    </aside>
  );
}
