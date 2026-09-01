"use client";

import {
  BoxSelect,
  Download,
  Eraser,
  ImageIcon,
  Layers3,
  LoaderCircle,
  Sparkles,
  Trash2,
  Upload,
  X
} from "lucide-react";
import {
  type ReactNode,
  useMemo,
  useRef,
  useState
} from "react";

import { BboxCanvas, type Bbox } from "@/components/workspace/canvas/bbox-canvas";
import {
  TARGET_BBOX_ORDER_KEY,
  VisualPromptEditor
} from "@/components/workspace/canvas/visual-prompt-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { getAssetDownloadUrl, getSafePreviewUrl } from "@/lib/asset-display";
import type {
  Asset,
  Brief,
  ImageEditMode,
  ImageGenerationSize,
  ImageOutputFormat,
  ImageReferenceRegion
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

export interface CanvasEditInput {
  annotation: Bbox | null;
  editMode: ImageEditMode;
  prompt: string;
  referenceAssetIds: string[];
  referenceRegions: ImageReferenceRegion[];
  targetBbox: Bbox | null;
}

export function ImageCanvasEditor({
  aspectRatio = "1:1",
  candidateTargetAssets,
  currentTargetAssetId,
  format,
  isUploadingReference,
  isLayerActionBusy,
  isSelectingTarget = false,
  isSubmitting,
  onAspectRatioChange,
  onFormatChange,
  onLayerDecompose,
  onOpenChange,
  onReferenceFiles,
  onRemoveReference,
  onSelectTargetAsset,
  onSetReferenceAsTarget,
  onSizeChange,
  onSubmit,
  open,
  referenceAssets,
  size,
  targetAsset,
  variant = "dialog"
}: {
  aspectRatio?: Brief["aspect_ratio"];
  candidateTargetAssets?: Asset[];
  currentTargetAssetId?: string | null;
  format: ImageOutputFormat;
  isLayerActionBusy?: boolean;
  isSelectingTarget?: boolean;
  isUploadingReference?: boolean;
  isSubmitting: boolean;
  onAspectRatioChange?: (aspectRatio: Brief["aspect_ratio"]) => void;
  onFormatChange?: (format: ImageOutputFormat) => void;
  onLayerDecompose?: () => void;
  onOpenChange: (open: boolean) => void;
  onReferenceFiles?: (files: File[]) => void;
  onRemoveReference?: (asset: Asset) => void;
  onSelectTargetAsset?: (asset: Asset) => void;
  onSetReferenceAsTarget?: (asset: Asset) => void;
  onSizeChange?: (size: ImageGenerationSize) => void;
  onSubmit: (input: CanvasEditInput) => void;
  open: boolean;
  referenceAssets: Asset[];
  size: ImageGenerationSize;
  targetAsset: Asset | null;
  variant?: "dialog" | "page";
}) {
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [serializedPrompt, setSerializedPrompt] = useState("");
  const [targetBbox, setTargetBbox] = useState<Bbox | null>(null);
  const [targetBboxAssetId, setTargetBboxAssetId] = useState<string | null>(
    targetAsset?.id ?? null
  );
  const [referenceBboxes, setReferenceBboxes] = useState<Record<string, Bbox>>(
    {}
  );
  const [bboxOrder, setBboxOrder] = useState<string[]>([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const previewAssetName = previewAsset
    ? assetDisplayName(previewAsset, "目标图")
    : "目标图";
  const previewUrl = previewAsset ? getSafePreviewUrl(previewAsset) : null;
  const targetDownloadUrl = targetAsset ? getAssetDownloadUrl(targetAsset) : null;
  const targetAssetId = targetAsset?.id ?? null;
  const effectiveTargetBbox =
    targetBboxAssetId === targetAssetId ? targetBbox : null;
  const resolvedCurrentTargetId = currentTargetAssetId ?? targetAsset?.id ?? null;
  const targetCandidates = useMemo(() => {
    const source = candidateTargetAssets ?? (targetAsset ? [targetAsset] : []);
    const seen = new Set<string>();
    return source.filter((asset) => {
      if (seen.has(asset.id)) return false;
      seen.add(asset.id);
      return true;
    });
  }, [candidateTargetAssets, targetAsset]);
  const selectedReferenceAssets = useMemo(
    () => {
      const assetsById = new Map(referenceAssets.map((asset) => [asset.id, asset]));
      return selectedReferenceIds
        .map((assetId) => assetsById.get(assetId))
        .filter((asset): asset is Asset => asset !== undefined);
    },
    [referenceAssets, selectedReferenceIds]
  );
  const referenceRegions = useMemo(
    () => {
      const selectedIds = new Set(selectedReferenceIds);
      const regionAssetIds = bboxOrder.filter(
        (assetId) =>
          assetId !== TARGET_BBOX_ORDER_KEY &&
          selectedIds.has(assetId) &&
          referenceBboxes[assetId]
      );
      return regionAssetIds.flatMap((assetId) => {
        const asset = referenceAssets.find((candidate) => candidate.id === assetId);
        if (!asset) return [];
        const bbox = referenceBboxes[asset.id];
        if (!bbox) return [];
        const imageIndex = referenceAssets.findIndex(
          (candidate) => candidate.id === asset.id
        );
        return [{ asset_id: asset.id, bbox, image_index: imageIndex + 2 }];
      });
    },
    [bboxOrder, referenceAssets, referenceBboxes, selectedReferenceIds]
  );
  const validationMessage = getValidationMessage({
    prompt,
    targetAsset,
    targetBbox: effectiveTargetBbox
  });
  const canSubmit =
    validationMessage === null && !isSubmitting && !isUploadingReference;
  const isInitialGeneration = targetAsset === null;
  const referenceUploadDisabled =
    isSubmitting ||
    isUploadingReference ||
    !onReferenceFiles ||
    referenceAssets.length >= 10;
  const layerButtonDisabled =
    !targetAsset || isSubmitting || isUploadingReference || isLayerActionBusy;

  function toggleReference(assetId: string) {
    if (isSubmitting || isUploadingReference) return;
    setSelectedReferenceIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    );
  }

  function recordBboxOrder(key: string, bbox: Bbox | null) {
    setBboxOrder((current) => {
      if (bbox) {
        return current.includes(key) ? current : [...current, key];
      }
      return current.filter((item) => item !== key);
    });
  }

  function clearReferenceSelection(assetId: string) {
    setReferenceBboxes((current) => {
      if (!current[assetId]) return current;
      const next = { ...current };
      delete next[assetId];
      return next;
    });
    setSelectedReferenceIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : current
    );
    recordBboxOrder(assetId, null);
  }

  const editorBody = (
    <>
      {variant === "page" ? (
        <div className="flex flex-col gap-1.5 border-b border-border px-5 py-4 pr-14 text-left sm:px-6">
          <h1 className="text-lg font-semibold tracking-[-0.025em] text-foreground">
            图片编辑画布
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            在目标图和参考图上框选区域，系统会自动添加图片编号和坐标上下文。
          </p>
        </div>
      ) : (
        <DialogHeader className="border-b border-border px-5 py-4 pr-14 sm:px-6">
          <DialogTitle>图片编辑画布</DialogTitle>
          <DialogDescription>
            在目标图和参考图上框选区域，系统会自动添加图片编号和坐标上下文。
          </DialogDescription>
        </DialogHeader>
      )}

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-secondary/20">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3 sm:px-5">
            {onReferenceFiles ? (
              <input
                accept="image/png,image/jpeg,image/webp"
                aria-label="上传参考图"
                className="sr-only"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length > 0) onReferenceFiles(files);
                }}
                ref={referenceInputRef}
                type="file"
              />
            ) : null}
            <Button
              disabled={referenceUploadDisabled}
              onClick={() => referenceInputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isUploadingReference ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              添加参考图
            </Button>
            <Button
              aria-pressed
              disabled={!targetAsset || isSubmitting || isUploadingReference}
              size="sm"
              type="button"
              variant="default"
            >
              <BoxSelect className="h-4 w-4" />
              单图编辑
            </Button>
            <Button
              disabled={layerButtonDisabled}
              onClick={onLayerDecompose}
              size="sm"
              title={!targetAsset ? "需要先生成或设置目标图" : "图层拆分"}
              type="button"
              variant="outline"
            >
              {isLayerActionBusy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Layers3 className="h-4 w-4" />
              )}
              {isLayerActionBusy ? "拆分中" : "图层拆分"}
            </Button>
            <Button
              aria-label="清除目标区域"
              disabled={!effectiveTargetBbox || isSubmitting || isUploadingReference}
              onClick={() => {
                setTargetBbox(null);
                setTargetBboxAssetId(null);
                recordBboxOrder(TARGET_BBOX_ORDER_KEY, null);
              }}
              size="icon"
              title="清除目标区域"
              type="button"
              variant="ghost"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            {isInitialGeneration ? (
              <span className="rounded-md border border-primary/25 bg-primary/[0.06] px-2.5 py-1.5 text-xs font-medium text-primary">
                新建图片
              </span>
            ) : null}
          </div>

          <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[18rem_minmax(0,1fr)_24rem] lg:overflow-hidden">
            <aside className="min-h-0 border-b border-border bg-card/70 p-4 sm:p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">参考图</h3>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {selectedReferenceAssets.length} / {referenceAssets.length}
                </span>
              </div>
              {referenceAssets.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {referenceAssets.map((asset) => {
                    const selected = selectedReferenceIds.includes(asset.id);
                    const displayIndex =
                      referenceAssets.findIndex(
                        (candidate) => candidate.id === asset.id
                      ) + 1;
                    return (
                      <article
                        className={cn(
                          "min-w-0 rounded-lg border bg-card p-2 transition",
                          selected
                            ? "border-primary ring-1 ring-primary/20"
                            : "border-border"
                        )}
                        key={asset.id}
                      >
                        <button
                          aria-pressed={selected}
                          className="mb-2 flex w-full items-center justify-between gap-2 text-left text-xs font-medium"
                          disabled={isSubmitting || isUploadingReference}
                          onClick={() => toggleReference(asset.id)}
                          type="button"
                        >
                          <span className="truncate">{referenceName(asset)}</span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            图{displayIndex}
                          </span>
                        </button>
                        <BboxCanvas
                          alt={`参考图：${referenceName(asset)}`}
                          bbox={referenceBboxes[asset.id] ?? null}
                          className="min-h-28"
                          disabled={isSubmitting || Boolean(isUploadingReference)}
                          onChange={(bbox) => {
                            setReferenceBboxes((current) => {
                              const next = { ...current };
                              if (bbox) {
                                next[asset.id] = bbox;
                              } else {
                                delete next[asset.id];
                              }
                              return next;
                            });
                            recordBboxOrder(asset.id, bbox);
                            setSelectedReferenceIds((current) => {
                              if (bbox) {
                                return current.includes(asset.id)
                                  ? current
                                  : [...current, asset.id];
                              }
                              return current.filter((id) => id !== asset.id);
                            });
                          }}
                          url={getSafePreviewUrl(asset)}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {!targetAsset && onSetReferenceAsTarget ? (
                            <Button
                              disabled={isSubmitting || isUploadingReference}
                              onClick={() => onSetReferenceAsTarget(asset)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              设为目标图
                            </Button>
                          ) : null}
                          {selected ? (
                            <Button
                              disabled={
                                !referenceBboxes[asset.id] ||
                                isSubmitting ||
                                isUploadingReference
                              }
                              onClick={() => {
                                clearReferenceSelection(asset.id);
                              }}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              <Eraser className="h-3.5 w-3.5" />
                              清除区域
                            </Button>
                          ) : null}
                          <Button
                            aria-label={`移除参考图：${referenceName(asset)}`}
                            disabled={
                              isSubmitting ||
                              isUploadingReference ||
                              !onRemoveReference
                            }
                            onClick={() => {
                              clearReferenceSelection(asset.id);
                              onRemoveReference?.(asset);
                            }}
                            size="icon"
                            title={`移除参考图：${referenceName(asset)}`}
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
                  暂无参考图。可直接生成，也可添加参考图作为创作依据。
                </p>
              )}
            </aside>

            <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 bg-secondary/20 p-4 sm:p-5 lg:overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">目标图</h3>
                {!isInitialGeneration && targetAsset ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      当前目标
                    </span>
                    {targetDownloadUrl ? (
                      <a
                        aria-label="下载目标图"
                        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
                        download={assetDisplayName(targetAsset, "目标图")}
                        href={targetDownloadUrl}
                        rel="noreferrer"
                        title="下载目标图"
                      >
                        <Download aria-hidden="true" className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <HorizontalDragScroll className="min-h-0">
                <div className="flex h-[42dvh] min-h-64 w-max max-w-none gap-3 lg:h-full lg:min-h-0">
                  <BboxCanvas
                    alt="目标图"
                    bbox={effectiveTargetBbox}
                    className="h-full shrink-0"
                    disabled={isSubmitting || Boolean(isUploadingReference)}
                    fitToImageAspect
                    onChange={(bbox) => {
                      setTargetBbox(bbox);
                      setTargetBboxAssetId(bbox ? targetAssetId : null);
                      recordBboxOrder(TARGET_BBOX_ORDER_KEY, bbox);
                    }}
                    onPreview={
                      targetAsset ? () => setPreviewAsset(targetAsset) : undefined
                    }
                    url={targetAsset ? getSafePreviewUrl(targetAsset) : null}
                  />
                  {targetAsset && targetCandidates.length > 1 ? (
                    <TargetCandidateStrip
                      currentTargetAssetId={resolvedCurrentTargetId}
                      disabled={
                        isSubmitting ||
                        Boolean(isUploadingReference) ||
                        isSelectingTarget
                      }
                      isSelectingTarget={isSelectingTarget}
                      onPreviewAsset={setPreviewAsset}
                      onSelectTargetAsset={onSelectTargetAsset}
                      targetAssets={targetCandidates}
                    />
                  ) : null}
                </div>
              </HorizontalDragScroll>
            </section>

            <aside className="flex min-h-0 flex-col gap-4 border-t border-border bg-card p-4 sm:p-5 lg:overflow-y-auto lg:border-l lg:border-t-0">
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-secondary/40 p-2">
                <label className="min-w-0 text-[11px] font-medium text-muted-foreground">
                  画幅
                  <select
                    aria-label="画幅"
                    className="mt-1 h-8 w-full rounded border border-input bg-card px-1 text-xs text-foreground"
                    disabled={isSubmitting || !onAspectRatioChange}
                    onChange={(event) =>
                      onAspectRatioChange?.(
                        event.target.value as Brief["aspect_ratio"]
                      )
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
                    disabled={isSubmitting || !onSizeChange}
                    onChange={(event) =>
                      onSizeChange?.(event.target.value as ImageGenerationSize)
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
                    disabled={isSubmitting || !onFormatChange}
                    onChange={(event) =>
                      onFormatChange?.(event.target.value as ImageOutputFormat)
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
                {isInitialGeneration ? "图片提示词" : "编辑指令"}
              </label>
              <VisualPromptEditor
                disabled={isSubmitting || Boolean(isUploadingReference)}
                bboxOrder={bboxOrder}
                isInitialGeneration={isInitialGeneration}
                onPromptChange={setPrompt}
                onSerializedPromptChange={setSerializedPrompt}
                prompt={prompt}
                referenceAssets={referenceAssets}
                referenceBboxes={referenceBboxes}
                selectedReferenceAssets={selectedReferenceAssets}
                targetAsset={targetAsset}
                targetBbox={effectiveTargetBbox}
              />
            </div>
            <div className="mt-auto space-y-3">
              {validationMessage ? (
                <p className="text-xs leading-5 text-muted-foreground" role="status">
                  {validationMessage}
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={!canSubmit}
                onClick={() => {
                  if (!canSubmit || (!isInitialGeneration && !effectiveTargetBbox)) return;
                  onSubmit({
                    annotation: effectiveTargetBbox,
                    editMode: "single_region",
                    prompt: (
                      isInitialGeneration ? serializedPrompt || prompt : prompt
                    ).trim(),
                    referenceAssetIds: isInitialGeneration
                      ? selectedReferenceAssets.map((asset) => asset.id)
                      : [],
                    referenceRegions: isInitialGeneration ? referenceRegions : [],
                    targetBbox: effectiveTargetBbox
                  });
                }}
                type="button"
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isSubmitting
                  ? "生成中"
                  : isInitialGeneration
                    ? "生成首张图片"
                    : "生成编辑版本"}
              </Button>
            </div>
          </aside>
        </div>
        </div>
    </>
  );

  return (
    <>
      {variant === "page" ? (
        <div className="relative grid h-[calc(100dvh-4rem)] w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-card">
          {editorBody}
          <button
            aria-label="关闭"
            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
            onClick={() => {
              if (!isSubmitting) onOpenChange(false);
            }}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Dialog
          onOpenChange={(nextOpen) => {
            if (!isSubmitting) onOpenChange(nextOpen);
          }}
          open={open}
        >
          <DialogContent className="grid h-[100dvh] max-h-[100dvh] w-[100vw] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-none p-0 sm:rounded-none">
            {editorBody}
          </DialogContent>
        </Dialog>
      )}
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewAsset(null);
        }}
        open={Boolean(previewAsset)}
      >
        <DialogContent className="grid h-[92dvh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-slate-700 bg-slate-950 p-0 text-white sm:rounded-xl">
          <DialogHeader className="border-b border-white/10 px-5 py-4 pr-14">
            <DialogTitle>查看原图</DialogTitle>
            <DialogDescription className="text-slate-300">
              {previewAssetName}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-hidden">
            {previewUrl ? (
              <ImagePreviewCanvas
                alt={`${previewAssetName} 原图预览`}
                url={previewUrl}
              />
            ) : (
              <p className="grid h-full place-items-center text-sm text-slate-300">
                图片暂不可预览
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HorizontalDragScroll({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    scrollLeft: number;
    startX: number;
  } | null>(null);

  return (
    <div
      className={cn(
        "overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-lg",
        "cursor-grab active:cursor-grabbing",
        className
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const interactive = (event.target as HTMLElement).closest(
          "button,a,input,select,textarea"
        );
        if (interactive) return;
        const element = scrollRef.current;
        if (!element || element.scrollWidth <= element.clientWidth) return;
        dragRef.current = {
          pointerId: event.pointerId,
          scrollLeft: element.scrollLeft,
          startX: event.clientX
        };
        element.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        const element = scrollRef.current;
        if (!drag || !element || drag.pointerId !== event.pointerId) return;
        element.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
      }}
      onPointerUp={(event) => {
        const element = scrollRef.current;
        if (dragRef.current?.pointerId === event.pointerId) {
          dragRef.current = null;
          element?.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={(event) => {
        const element = scrollRef.current;
        if (dragRef.current?.pointerId === event.pointerId) {
          dragRef.current = null;
          element?.releasePointerCapture(event.pointerId);
        }
      }}
      ref={scrollRef}
    >
      {children}
    </div>
  );
}

function TargetCandidateStrip({
  currentTargetAssetId,
  disabled,
  isSelectingTarget,
  onPreviewAsset,
  onSelectTargetAsset,
  targetAssets
}: {
  currentTargetAssetId: string | null;
  disabled: boolean;
  isSelectingTarget: boolean;
  onPreviewAsset: (asset: Asset) => void;
  onSelectTargetAsset?: (asset: Asset) => void;
  targetAssets: Asset[];
}) {
  return (
    <div className="h-full min-w-[18rem] rounded-lg border border-border bg-card/80 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">目标候选</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {targetAssets.length} 张
        </span>
      </div>
      <div className="grid auto-cols-[8.5rem] grid-flow-col grid-rows-2 items-start gap-2 overflow-x-visible overflow-y-hidden pr-1">
        {targetAssets.map((asset, index) => {
          const previewUrl = getSafePreviewUrl(asset);
          const current = asset.id === currentTargetAssetId;
          const name = assetDisplayName(asset, `图片版本 ${index + 1}`);
          return (
            <article
              className={cn(
                "min-w-0 rounded-md border bg-background p-2 transition",
                current ? "border-primary ring-1 ring-primary/20" : "border-border"
              )}
              key={asset.id}
            >
              <TargetCandidatePreview
                asset={asset}
                name={name}
                onPreviewAsset={onPreviewAsset}
                previewUrl={previewUrl}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                  {name}
                </span>
                {current ? (
                  <span className="shrink-0 rounded border border-primary/30 bg-primary/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    当前目标
                  </span>
                ) : (
                  <Button
                    aria-label={`设为目标图：${name}`}
                    disabled={disabled || !onSelectTargetAsset}
                    onClick={() => onSelectTargetAsset?.(asset)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {isSelectingTarget ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    设为目标图
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TargetCandidatePreview({
  asset,
  name,
  onPreviewAsset,
  previewUrl
}: {
  asset: Asset;
  name: string;
  onPreviewAsset: (asset: Asset) => void;
  previewUrl: string | null;
}) {
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<string | null>(
    null
  );

  return (
    <button
      aria-label={`放大预览：${name}`}
      className="grid w-full place-items-center overflow-hidden rounded bg-slate-950"
      onDoubleClick={() => onPreviewAsset(asset)}
      style={{
        aspectRatio: naturalAspectRatio ?? "1 / 1"
      }}
      type="button"
    >
      {previewUrl ? (
        /* Signed asset URLs must be passed through without image optimization. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          alt={`目标候选：${name}`}
          className="h-full w-full object-contain"
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setNaturalAspectRatio(
                `${image.naturalWidth} / ${image.naturalHeight}`
              );
            }
          }}
          src={previewUrl}
        />
      ) : (
        <ImageIcon className="h-4 w-4 text-slate-300" />
      )}
    </button>
  );
}

function ImagePreviewCanvas({
  alt,
  url
}: {
  alt: string;
  url: string;
}) {
  return (
    <div className="grid h-full min-h-0 w-full place-items-center overflow-hidden p-4">
      {/* Signed asset URLs must be passed through without image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        className="block h-auto w-auto max-h-[calc(92dvh-7rem)] max-w-[calc(96vw-2rem)] object-contain"
        draggable={false}
        src={url}
      />
    </div>
  );
}

function getValidationMessage({
  prompt,
  targetAsset,
  targetBbox
}: {
  prompt: string;
  targetAsset: Asset | null;
  targetBbox: Bbox | null;
}) {
  if (!targetAsset) return prompt.trim() ? null : "请输入图片提示词。";
  if (!targetBbox) return "请在目标图上框选编辑区域。";
  if (!prompt.trim()) return "请输入编辑指令。";
  return null;
}

function referenceName(asset: Asset) {
  return typeof asset.metadata.name === "string" ? asset.metadata.name : "参考图";
}

function assetDisplayName(asset: Asset, fallback: string) {
  return typeof asset.metadata.name === "string" ? asset.metadata.name : fallback;
}
