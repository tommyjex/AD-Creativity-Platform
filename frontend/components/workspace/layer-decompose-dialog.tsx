"use client";

import { BoxSelect, Layers3, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSafePreviewUrl } from "@/lib/asset-display";
import type {
  Asset,
  ImageLayerDecompositionRequest
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

type Bbox = NonNullable<ImageLayerDecompositionRequest["bbox"]>;

const DEFAULT_BBOX: Bbox = {
  type: "bbox",
  x1: 100,
  x2: 900,
  y1: 100,
  y2: 900
};

export function LayerDecomposeDialog({
  asset,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open
}: {
  asset: Asset | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { bbox: Bbox | null; prompt: string | null }) => void;
  open: boolean;
}) {
  const [mode, setMode] = useState<"auto" | "prompt">("auto");
  const [prompt, setPrompt] = useState("");
  const [useBbox, setUseBbox] = useState(false);
  const [bbox, setBbox] = useState<Bbox>(DEFAULT_BBOX);
  const previewUrl = asset ? getSafePreviewUrl(asset) : null;
  const bboxValid =
    bbox.x1 >= 0 &&
    bbox.y1 >= 0 &&
    bbox.x2 <= 999 &&
    bbox.y2 <= 999 &&
    bbox.x1 < bbox.x2 &&
    bbox.y1 < bbox.y2;

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader className="border-b border-border px-4 py-4 pr-14 sm:px-6">
          <DialogTitle>创建可编辑图层</DialogTitle>
          <DialogDescription>
            自动识别画面元素，或用自然语言和可选区域指定拆分对象。
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(18rem,1.1fr)] sm:p-6">
          <div className="grid min-h-56 place-items-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="待拆分图片"
                className="max-h-[52dvh] w-full object-contain"
                src={previewUrl}
              />
            ) : (
              <p className="text-sm text-slate-300">图片暂不可预览</p>
            )}
          </div>
          <section className="min-w-0">
            <div className="grid grid-cols-2 gap-2">
              <ModeButton
                active={mode === "auto"}
                icon={Sparkles}
                label="自动拆分"
                onClick={() => setMode("auto")}
              />
              <ModeButton
                active={mode === "prompt"}
                icon={Layers3}
                label="指定对象"
                onClick={() => setMode("prompt")}
              />
            </div>
            {mode === "prompt" ? (
              <div className="mt-4">
                <label className="text-sm font-semibold" htmlFor="layer-prompt">
                  拆分说明
                </label>
                <Textarea
                  className="mt-2 min-h-28 resize-y"
                  id="layer-prompt"
                  maxLength={4000}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="例如：将商品、投影和前景装饰分别拆成独立图层。"
                  value={prompt}
                />
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-border bg-secondary/35 p-3 text-xs leading-5 text-muted-foreground">
                自动模式不附加提示词，由模型识别适合独立编辑的主体和元素。
              </p>
            )}
            <label className="mt-4 flex items-center gap-2 text-sm font-medium">
              <input
                checked={useBbox}
                className="h-4 w-4 accent-primary"
                onChange={(event) => setUseBbox(event.target.checked)}
                type="checkbox"
              />
              <BoxSelect className="h-4 w-4 text-primary" />
              限定拆分区域（0–999）
            </label>
            {useBbox ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["x1", "y1", "x2", "y2"] as const).map((key) => (
                  <label className="space-y-1 text-xs font-medium" key={key}>
                    <span>{key.toUpperCase()}</span>
                    <Input
                      aria-label={`拆分区域 ${key.toUpperCase()}`}
                      max={999}
                      min={0}
                      onChange={(event) =>
                        setBbox((current) => ({
                          ...current,
                          [key]: Number(event.target.value)
                        }))
                      }
                      type="number"
                      value={bbox[key]}
                    />
                  </label>
                ))}
                {!bboxValid ? (
                  <p className="col-span-2 text-xs text-destructive" role="alert">
                    坐标需在 0–999，且 X1&lt;X2、Y1&lt;Y2。
                  </p>
                ) : null}
              </div>
            ) : null}
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
              !previewUrl ||
              (mode === "prompt" && !prompt.trim()) ||
              (useBbox && !bboxValid)
            }
            onClick={() =>
              onSubmit({
                bbox: useBbox ? bbox : null,
                prompt: mode === "prompt" ? prompt.trim() : null
              })
            }
            type="button"
          >
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Layers3 className="h-4 w-4" />
            )}
            {isSubmitting ? "正在提交" : "开始拆分"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon: typeof Layers3;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition",
        active
          ? "border-primary/40 bg-primary/[0.08] text-primary"
          : "border-border bg-card hover:bg-secondary/45"
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
