"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Grip,
  ImageDown,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Save,
  X
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useMemo,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSafePreviewUrl } from "@/lib/asset-display";
import {
  apiClient,
  getUserFacingErrorMessage,
  isApiError
} from "@/lib/api-client";
import {
  clampLayerScale,
  getLayerFrame,
  MAX_LAYER_SCALE,
  MIN_LAYER_SCALE,
  moveLayer,
  positionFromDrag,
  scaleFromResize
} from "@/lib/layer-editor-geometry";
import type {
  Asset,
  GenerationTask,
  ImageLayer,
  ImageLayerSetDetail,
  ImageLayerUpdate
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

interface DragState {
  clientX: number;
  clientY: number;
  layerId: string;
  x: number;
  y: number;
}

interface ResizeState {
  clientX: number;
  clientY: number;
  layerHeight: number;
  layerId: string;
  layerWidth: number;
  scale: number;
}

export {
  clampLayerScale,
  getLayerFrame,
  moveLayer,
  positionFromDrag,
  scaleFromResize,
  type LayerFrame
} from "@/lib/layer-editor-geometry";

export function toLayerUpdates(layers: ImageLayer[]): ImageLayerUpdate[] {
  return layers
    .toSorted((a, b) => a.z_index - b.z_index)
    .map(({ id, scale, visible, x, y, z_index }) => ({
      id,
      scale,
      visible,
      x,
      y,
      z_index
    }));
}

export function LayerEditorDialog({
  initialLayerSet,
  onLayerSetChange,
  onOpenChange,
  open
}: {
  initialLayerSet: ImageLayerSetDetail;
  onLayerSetChange: (layerSet: ImageLayerSetDetail) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const [layerSet, setLayerSet] = useState(initialLayerSet);
  const [layers, setLayers] = useState(() =>
    initialLayerSet.layers.toSorted((a, b) => a.z_index - b.z_index)
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLayerSet.layers.toSorted((a, b) => b.z_index - a.z_index)[0]?.id ??
      null
  );
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [exportTask, setExportTask] = useState<GenerationTask | null>(null);
  const [exportedAsset, setExportedAsset] = useState<Asset | null>(null);
  const [contentEditPrompt, setContentEditPrompt] = useState("");
  const [contentEditTask, setContentEditTask] = useState<GenerationTask | null>(null);

  const assetById = useMemo(
    () =>
      new Map(
        layerSet.layers_assets.map((asset) => [
          asset.id,
          getSafePreviewUrl(asset)
        ])
      ),
    [layerSet.layers_assets]
  );
  const selectedLayer =
    layers.find((layer) => layer.id === selectedId) ?? null;
  const savedState = JSON.stringify(toLayerUpdates(layerSet.layers));
  const draftState = JSON.stringify(toLayerUpdates(layers));
  const dirty = savedState !== draftState;
  const isExporting =
    exportTask?.status === "queued" || exportTask?.status === "running";
  const isContentEditing =
    contentEditTask?.status === "queued" || contentEditTask?.status === "running";
  const baseUrl = getSafePreviewUrl(layerSet.base_asset);
  const canvasRatio = layerSet.canvas_width / layerSet.canvas_height;

  function requestClose() {
    if (
      dirty &&
      !window.confirm("存在未保存的图层修改，确定关闭并放弃这些修改吗？")
    ) {
      return;
    }
    onOpenChange(false);
  }

  function updateLayer(
    layerId: string,
    changes: Partial<Pick<ImageLayer, "scale" | "visible" | "x" | "y">>
  ) {
    setLayers((current) =>
      current.map((layer) =>
        layer.id === layerId ? { ...layer, ...changes } : layer
      )
    );
    setConflict(false);
    setFeedback(null);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    layer: ImageLayer
  ) {
    if (!layer.visible) return;
    setSelectedId(layer.id);
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      layerId: layer.id,
      x: layer.x,
      y: layer.y
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const position = positionFromDrag(
      drag,
      event.clientX - drag.clientX,
      event.clientY - drag.clientY,
      bounds.width,
      bounds.height,
      layerSet.canvas_width,
      layerSet.canvas_height
    );
    updateLayer(drag.layerId, position);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleResizePointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
    layer: ImageLayer
  ) {
    const [x1, y1, x2, y2] = layer.bbox_absolute;
    setSelectedId(layer.id);
    dragRef.current = null;
    resizeRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      layerHeight: y2 - y1,
      layerId: layer.id,
      layerWidth: x2 - x1,
      scale: layer.scale
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  }

  function handleResizePointerMove(
    event: ReactPointerEvent<HTMLSpanElement>
  ) {
    const resize = resizeRef.current;
    const canvas = canvasRef.current;
    if (!resize || !canvas) return;
    const bounds = canvas.getBoundingClientRect();
    updateLayer(resize.layerId, {
      scale: scaleFromResize(
        resize,
        event.clientX - resize.clientX,
        event.clientY - resize.clientY,
        bounds.width,
        bounds.height,
        layerSet.canvas_width,
        layerSet.canvas_height
      )
    });
    event.stopPropagation();
  }

  function handleResizePointerEnd(
    event: ReactPointerEvent<HTMLSpanElement>
  ) {
    resizeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    event.stopPropagation();
  }

  async function persistLayout(): Promise<ImageLayerSetDetail | null> {
    setIsSaving(true);
    try {
      const updated = await apiClient.updateImageLayerSet(
        layerSet.project_id,
        layerSet.id,
        {
          expected_revision: layerSet.revision,
          layers: toLayerUpdates(layers)
        }
      );
      setLayerSet(updated);
      setLayers(updated.layers.toSorted((a, b) => a.z_index - b.z_index));
      setConflict(false);
      onLayerSetChange(updated);
      return updated;
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setConflict(true);
        setFeedback("保存冲突：服务端已有更新，请重新加载最新图层。");
      } else {
        setFeedback(getUserFacingErrorMessage(error));
      }
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    if (!dirty || isSaving) return;
    setFeedback(null);
    const updated = await persistLayout();
    if (updated) {
      setFeedback(`图层布局已保存，Revision ${updated.revision}。`);
    }
  }

  async function handleReload() {
    setIsReloading(true);
    setFeedback(null);
    try {
      const updated = await apiClient.getImageLayerSet(
        layerSet.project_id,
        layerSet.id,
        { cache: "no-store" }
      );
      setLayerSet(updated);
      setLayers(updated.layers.toSorted((a, b) => a.z_index - b.z_index));
      setSelectedId(
        updated.layers.toSorted((a, b) => b.z_index - a.z_index)[0]?.id ??
          null
      );
      setConflict(false);
      setFeedback(`已重新加载 Revision ${updated.revision}。`);
      onLayerSetChange(updated);
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsReloading(false);
    }
  }

  async function finishExportTask(task: GenerationTask) {
    setExportTask(task);
    if (task.status === "failed") {
      setFeedback(task.error?.message ?? "导出失败，可重试冻结的图层版本。");
      return;
    }
    const assetId = task.output_asset_ids[0];
    if (!assetId) {
      setFeedback("导出任务已完成，但未返回成品资产。");
      return;
    }
    const asset = await apiClient.getAsset(assetId, { cache: "no-store" });
    setExportedAsset(asset);
    setFeedback("成品已导出并设为当前图片。");
  }

  async function pollExportTask(initialTask: GenerationTask) {
    let task = initialTask;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      setExportTask(task);
      if (["failed", "succeeded"].includes(task.status)) {
        await finishExportTask(task);
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      task = await apiClient.getTask(task.id, { cache: "no-store" });
    }
    throw new Error("layer composition polling timed out");
  }

  async function handleExport() {
    if (dirty || isExporting) return;
    setFeedback("正在导出已保存的图层版本…");
    setExportedAsset(null);
    try {
      const task = await apiClient.composeImageLayers(layerSet.project_id, {
        expected_revision: layerSet.revision,
        layer_set_id: layerSet.id,
        set_current: true
      });
      await pollExportTask(task);
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function handleRetryExport() {
    if (!exportTask || exportTask.status !== "failed") return;
    setFeedback("正在重试导出…");
    try {
      await pollExportTask(await apiClient.retryTask(exportTask.id));
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function handleContentEdit() {
    if (!selectedLayer || !contentEditPrompt.trim() || isContentEditing || isSaving) {
      return;
    }
    setFeedback(null);
    let activeRevision = layerSet.revision;
    if (dirty) {
      const saved = await persistLayout();
      if (!saved) return;
      activeRevision = saved.revision;
    }
    try {
      let task = await apiClient.editImageLayerContent(layerSet.project_id, layerSet.id, {
        expected_revision: activeRevision,
        layer_id: selectedLayer.id,
        prompt: contentEditPrompt.trim(),
        size: "2K",
        format: "png"
      });
      for (let attempt = 0; attempt < 120; attempt += 1) {
        setContentEditTask(task);
        if (task.status === "succeeded") {
          await handleReload();
          setContentEditPrompt("");
          setFeedback("图层内容已替换。");
          return;
        }
        if (task.status === "failed") {
          setFeedback(task.error?.message ?? "图层内容编辑失败。");
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        task = await apiClient.getTask(task.id, { cache: "no-store" });
      }
      throw new Error("layer content edit polling timed out");
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setConflict(true);
        setFeedback("图层内容替换冲突：请重新加载最新图层。");
      } else {
        setFeedback(getUserFacingErrorMessage(error));
      }
    }
  }

  return (
    <Dialog onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())} open={open}>
      <DialogContent
        className="h-[calc(100dvh-1rem)] max-w-[96rem] grid-rows-[auto_minmax(0,1fr)_auto] sm:h-[calc(100dvh-2rem)]"
        hideCloseButton
      >
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-primary" />
                图层编辑
              </DialogTitle>
              <DialogDescription className="mt-1">
                {layerSet.canvas_width} × {layerSet.canvas_height} · Revision{" "}
                {layerSet.revision}
                {dirty ? " · 有未保存修改" : ""}
              </DialogDescription>
            </div>
            <Button
              aria-label="关闭图层编辑器"
              disabled={isSaving}
              onClick={requestClose}
              size="icon"
              title="关闭"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1">
          <section className="relative grid min-h-0 place-items-center overflow-auto bg-[radial-gradient(circle_at_center,hsl(var(--secondary))_0,hsl(var(--background))_70%)] p-3 sm:p-5">
            <div
              className="relative isolate max-h-full max-w-full touch-none overflow-hidden bg-white shadow-[0_22px_70px_rgba(15,23,42,0.24)]"
              data-testid="layer-canvas"
              ref={canvasRef}
              style={{
                aspectRatio: `${layerSet.canvas_width} / ${layerSet.canvas_height}`,
                width: `min(100%, calc(${canvasRatio * 100}dvh - ${canvasRatio * 11}rem))`
              }}
            >
              {baseUrl ? (
                // Signed internal assets must retain their backend URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="锁定底图"
                  className="absolute inset-0 h-full w-full select-none object-fill"
                  draggable={false}
                  src={baseUrl}
                />
              ) : null}
              {layers
                .toSorted((a, b) => a.z_index - b.z_index)
                .map((layer) => {
                  const frame = getLayerFrame(
                    layer,
                    layerSet.canvas_width,
                    layerSet.canvas_height
                  );
                  const url = assetById.get(layer.asset_id);
                  return (
                    <div
                      aria-label={`画布图层：${layer.name}`}
                      className={cn(
                        "absolute select-none",
                        layer.visible ? "cursor-move" : "pointer-events-none hidden",
                        selectedId === layer.id &&
                          "outline outline-2 outline-offset-2 outline-primary"
                      )}
                      data-testid={`canvas-layer-${layer.id}`}
                      key={layer.id}
                      onPointerDown={(event) => handlePointerDown(event, layer)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      role="button"
                      style={{
                        height: `${frame.heightPercent}%`,
                        left: `${frame.leftPercent}%`,
                        top: `${frame.topPercent}%`,
                        width: `${frame.widthPercent}%`,
                        zIndex: layer.z_index
                      }}
                      tabIndex={0}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={layer.name}
                          className="pointer-events-none h-full w-full object-fill"
                          draggable={false}
                          src={url}
                        />
                      ) : null}
                      {selectedId === layer.id && layer.visible ? (
                        <span
                          aria-label={`等比缩放图层 ${layer.name}`}
                          aria-valuemax={MAX_LAYER_SCALE}
                          aria-valuemin={MIN_LAYER_SCALE}
                          aria-valuenow={layer.scale}
                          className="absolute -bottom-2 -right-2 z-10 h-4 w-4 touch-none cursor-nwse-resize rounded-[3px] border-2 border-primary bg-background shadow-[0_1px_5px_rgba(15,23,42,0.35)]"
                          data-testid={`resize-handle-${layer.id}`}
                          onPointerCancel={handleResizePointerEnd}
                          onPointerDown={(event) =>
                            handleResizePointerDown(event, layer)
                          }
                          onPointerMove={handleResizePointerMove}
                          onPointerUp={handleResizePointerEnd}
                          role="slider"
                          tabIndex={0}
                          title={`拖拽等比缩放 ${layer.name}`}
                        />
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </section>

          <aside
            className="min-h-0 border-t border-border bg-card lg:border-l lg:border-t-0"
            data-testid="layer-panel"
          >
            <button
              aria-expanded={isPanelOpen}
              className="flex w-full items-center gap-2 px-4 py-3 text-left lg:hidden"
              onClick={() => setIsPanelOpen((current) => !current)}
              type="button"
            >
              <Layers3 className="h-4 w-4 text-primary" />
              <span className="font-semibold">图层与变换</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {layers.length + 1} 层
              </span>
              {isPanelOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
            <div
              className={cn(
                "min-h-0 flex-col overflow-hidden border-t border-border lg:flex lg:h-full lg:border-t-0",
                isPanelOpen ? "flex max-h-[45dvh]" : "hidden"
              )}
            >
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Layer Stack
                  </p>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    TOP FIRST
                  </span>
                </div>
                <div className="space-y-2">
                  {layers
                    .toSorted((a, b) => b.z_index - a.z_index)
                    .map((layer) => (
                      <LayerRow
                        assetUrl={assetById.get(layer.asset_id) ?? null}
                        isBottom={layer.z_index === 1}
                        isTop={layer.z_index === layers.length}
                        key={layer.id}
                        layer={layer}
                        onMove={(direction) =>
                          setLayers((current) =>
                            moveLayer(current, layer.id, direction)
                          )
                        }
                        onSelect={() => setSelectedId(layer.id)}
                        onVisibility={() =>
                          updateLayer(layer.id, { visible: !layer.visible })
                        }
                        selected={selectedId === layer.id}
                      />
                    ))}
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/35 p-2.5">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-border bg-card">
                      <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">底图</p>
                      <p className="text-xs text-muted-foreground">
                        Z 0 · 已锁定
                      </p>
                    </div>
                    <LockKeyhole
                      aria-label="底图锁定"
                      className="h-4 w-4 text-muted-foreground"
                    />
                  </div>
                </div>
              </div>

              <TransformControls
                layer={selectedLayer}
                onChange={(changes) =>
                  selectedLayer && updateLayer(selectedLayer.id, changes)
                }
              />
              {selectedLayer ? (
                <div className="border-t border-border p-3">
                  <label className="text-xs font-semibold" htmlFor="layer-content-edit">
                    编辑图层内容
                  </label>
                  <Textarea
                    className="mt-2 min-h-20 text-xs"
                    disabled={isContentEditing || isSaving}
                    id="layer-content-edit"
                    maxLength={4000}
                    onChange={(event) => setContentEditPrompt(event.target.value)}
                    placeholder={`例如：将${selectedLayer.name}改为深蓝色磨砂材质。`}
                    value={contentEditPrompt}
                  />
                  <Button
                    className="mt-2 w-full"
                    disabled={isContentEditing || isSaving || !contentEditPrompt.trim()}
                    onClick={handleContentEdit}
                    size="sm"
                    type="button"
                  >
                    {isContentEditing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    {isContentEditing ? "正在生成替换图层" : "生成替换图层"}
                  </Button>
                  {dirty ? (
                    <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                      提交内容编辑前会先自动保存当前图层布局改动。
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
          <p
            className={cn(
              "min-w-0 flex-1 text-xs",
              conflict ? "font-semibold text-destructive" : "text-muted-foreground"
            )}
            role="status"
          >
            {feedback ?? (dirty ? "修改仅保存在本地，保存后才会持久化。" : "所有修改已保存。")}
          </p>
          {conflict ? (
            <Button
              disabled={isReloading}
              onClick={handleReload}
              type="button"
              variant="outline"
            >
              <RefreshCw
                className={cn("h-4 w-4", isReloading && "animate-spin")}
              />
              重新加载
            </Button>
          ) : null}
          {exportedAsset ? (
            <Button asChild type="button" variant="outline">
              <a
                download
                href={getSafePreviewUrl(exportedAsset) ?? undefined}
                rel="noreferrer"
                target="_blank"
              >
                查看成品
              </a>
            </Button>
          ) : null}
          {exportTask?.status === "failed" ? (
            <Button onClick={handleRetryExport} type="button" variant="outline">
              <RefreshCw className="h-4 w-4" />
              重试导出
            </Button>
          ) : null}
          <Button
            disabled={dirty || isSaving || isReloading || isExporting}
            onClick={handleExport}
            title={dirty ? "请先保存图层修改再导出" : "导出已保存的图层版本"}
            type="button"
            variant="outline"
          >
            {isExporting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ImageDown className="h-4 w-4" />
            )}
            导出成品
          </Button>
          <Button
            disabled={!dirty || isSaving || isReloading}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存图层
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LayerRow({
  assetUrl,
  isBottom,
  isTop,
  layer,
  onMove,
  onSelect,
  onVisibility,
  selected
}: {
  assetUrl: string | null;
  isBottom: boolean;
  isTop: boolean;
  layer: ImageLayer;
  onMove: (direction: "down" | "up") => void;
  onSelect: () => void;
  onVisibility: () => void;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border p-2 transition",
        selected
          ? "border-primary/45 bg-primary/[0.07]"
          : "border-border bg-background"
      )}
    >
      <button
        aria-label={`选择图层 ${layer.name}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onSelect}
        type="button"
      >
        <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:10px_10px]">
          {assetUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="h-full w-full object-contain"
              src={assetUrl}
            />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {layer.name}
          </span>
          <span className="block line-clamp-2 text-[11px] leading-4 text-muted-foreground">
            {layer.description}
          </span>
        </span>
      </button>
      <div className="grid shrink-0 grid-cols-2 gap-0.5">
        <LayerIconButton
          disabled={false}
          icon={layer.visible ? Eye : EyeOff}
          label={`${layer.visible ? "隐藏" : "显示"}图层 ${layer.name}`}
          onClick={onVisibility}
        />
        <LayerIconButton
          disabled={false}
          icon={Grip}
          label={`图层层级 ${layer.z_index}`}
          onClick={onSelect}
        />
        <LayerIconButton
          disabled={isTop}
          icon={ArrowUp}
          label={`上移图层 ${layer.name}`}
          onClick={() => onMove("up")}
        />
        <LayerIconButton
          disabled={isBottom}
          icon={ArrowDown}
          label={`下移图层 ${layer.name}`}
          onClick={() => onMove("down")}
        />
      </div>
    </div>
  );
}

function TransformControls({
  layer,
  onChange
}: {
  layer: ImageLayer | null;
  onChange: (
    changes: Partial<Pick<ImageLayer, "scale" | "x" | "y">>
  ) => void;
}) {
  return (
    <div className="border-t border-border bg-secondary/25 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Transform
      </p>
      {layer ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <CoordinateInput
              label="X"
              onChange={(x) => onChange({ x })}
              value={layer.x}
            />
            <CoordinateInput
              label="Y"
              onChange={(y) => onChange({ y })}
              value={layer.y}
            />
          </div>
          <label className="block text-xs font-medium" htmlFor="layer-scale">
            等比缩放
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2">
            <input
              aria-label="图层缩放滑杆"
              className="w-full accent-primary"
              id="layer-scale"
              max={MAX_LAYER_SCALE}
              min={MIN_LAYER_SCALE}
              onChange={(event) =>
                onChange({ scale: clampLayerScale(Number(event.target.value)) })
              }
              step="0.05"
              type="range"
              value={layer.scale}
            />
            <Input
              aria-label="图层缩放数值"
              max={MAX_LAYER_SCALE}
              min={MIN_LAYER_SCALE}
              onChange={(event) =>
                onChange({ scale: clampLayerScale(Number(event.target.value)) })
              }
              step="0.05"
              type="number"
              value={layer.scale}
            />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            SCALE 0.05–20 · 锚点为左上角
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">选择一个图层后调整。</p>
      )}
    </div>
  );
}

function CoordinateInput({
  label,
  onChange,
  value
}: {
  label: "X" | "Y";
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="space-y-1 text-xs font-medium">
      <span>{label}（底图像素）</span>
      <Input
        aria-label={`${label} 坐标`}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        step="1"
        type="number"
        value={value}
      />
    </label>
  );
}

function LayerIconButton({
  disabled,
  icon: Icon,
  label,
  onClick
}: {
  disabled: boolean;
  icon: typeof Eye;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}
