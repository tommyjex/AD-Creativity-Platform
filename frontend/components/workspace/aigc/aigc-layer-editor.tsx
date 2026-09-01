"use client";

import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  EyeOff,
  Grip,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Redo2,
  Scan,
  Save,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  apiClient,
  getUserFacingErrorMessage,
  isApiError
} from "@/lib/api-client";
import {
  applyLayerCanvasConfig,
  createLayerTransformPatches,
  layerCanvasSourceIsCurrent,
  layerSetSummary
} from "@/lib/aigc/layers";
import type {
  AigcLayer,
  AigcLayerSet,
  AigcPipeline,
  LayerCanvasConfig
} from "@/lib/aigc/types";
import { getSafePreviewUrl } from "@/lib/asset-display";
import {
  clampLayerScale,
  getLayerFrame,
  MAX_LAYER_SCALE,
  MIN_LAYER_SCALE,
  moveLayer,
  positionFromDrag,
  scaleFromResize
} from "@/lib/layer-editor-geometry";
import { cn } from "@/lib/utils";

interface Draft {
  layers: AigcLayer[];
  selectedId: string | null;
}

interface History {
  future: Draft[];
  past: Draft[];
  present: Draft;
}

interface DragState {
  clientX: number;
  clientY: number;
  draft: Draft;
  layerId: string;
  x: number;
  y: number;
}

interface ResizeState {
  clientX: number;
  clientY: number;
  draft: Draft;
  layerHeight: number;
  layerId: string;
  layerWidth: number;
  scale: number;
}

export function AigcLayerEditor({
  layerSet,
  nodeId,
  pipeline,
  runId
}: {
  layerSet: AigcLayerSet;
  nodeId: string;
  pipeline: AigcPipeline;
  runId: string;
}) {
  const router = useRouter();
  const node = pipeline.definition.nodes.find(
    (candidate) => candidate.id === nodeId && candidate.type === "layer_canvas"
  );
  if (!node || node.type !== "layer_canvas") {
    return <LayerEditorError message="目标节点不是图层画布节点。" />;
  }
  return (
    <AigcLayerEditorContent
      layerSet={layerSet}
      node={node}
      pipeline={pipeline}
      runId={runId}
      returnToPipeline={() =>
        router.push(`/workspace/aigc/pipelines/${pipeline.id}` as Route)
      }
    />
  );
}

function AigcLayerEditorContent({
  layerSet,
  node,
  pipeline,
  runId,
  returnToPipeline
}: {
  layerSet: AigcLayerSet;
  node: Extract<AigcPipeline["definition"]["nodes"][number], { type: "layer_canvas" }>;
  pipeline: AigcPipeline;
  runId: string;
  returnToPipeline: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const sourceCurrent = layerCanvasSourceIsCurrent(node.config, layerSet);
  const initialDraft = useMemo(
    () => ({
      layers: applyLayerCanvasConfig(layerSet, node.config),
      selectedId: sourceCurrent ? node.config.selected_layer_id : null
    }),
    [layerSet, node.config, sourceCurrent]
  );
  const [history, setHistory] = useState<History>({
    future: [],
    past: [],
    present: initialDraft
  });
  const [baselineSignature, setBaselineSignature] = useState(() =>
    draftSignature(initialDraft)
  );
  const [sourceStale, setSourceStale] = useState(!sourceCurrent);
  const [zoom, setZoom] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(
    sourceCurrent
      ? null
      : "上游图层集已变化，旧选择和布局未套用。请确认当前图层后保存。"
  );
  const assetIds = useMemo(
    () => [
      layerSet.base_asset_id,
      ...layerSet.layers.map((layer) => layer.asset_id)
    ],
    [layerSet]
  );
  const assetsQuery = useQuery({
    queryFn: () =>
      Promise.allSettled(
        assetIds.map((assetId) =>
          apiClient.getAigcInternalRunAsset(pipeline.id, runId, assetId)
        )
      ),
    queryKey: ["aigc", "layer-editor-assets", runId, layerSet.digest]
  });
  const assetUrls = useMemo(
    () =>
      new Map(
        (assetsQuery.data ?? []).flatMap((result) => {
          if (result.status === "rejected") return [];
          const url = getSafePreviewUrl(result.value);
          return url ? [[result.value.id, url] as const] : [];
        })
      ),
    [assetsQuery.data]
  );
  const failedAssetIds = useMemo(
    () =>
      (assetsQuery.data ?? []).flatMap((result, index) =>
        result.status === "rejected" ? [assetIds[index]] : []
      ),
    [assetIds, assetsQuery.data]
  );
  const draft = history.present;
  const selected =
    draft.layers.find((layer) => layer.id === draft.selectedId) ?? null;
  const dirty =
    sourceStale || draftSignature(draft) !== baselineSignature;
  const canvasRatio = layerSet.canvas_width / layerSet.canvas_height;

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  function commit(next: Draft) {
    setHistory((current) =>
      draftSignature(current.present) === draftSignature(next)
        ? current
        : {
            future: [],
            past: [...current.past.slice(-29), current.present],
            present: next
          }
    );
    setConflict(false);
    setFeedback(null);
  }

  function updateLayer(
    layerId: string,
    changes: Partial<Pick<AigcLayer, "scale" | "visible" | "x" | "y">>,
    record = true
  ) {
    const update = (current: History) => ({
      ...current,
      present: {
        ...current.present,
        layers: current.present.layers.map((layer) =>
          layer.id === layerId ? { ...layer, ...changes } : layer
        )
      }
    });
    if (record) {
      const next = update(history).present;
      commit(next);
    } else {
      setHistory(update);
    }
  }

  function finishGesture(start: Draft | undefined) {
    if (!start) return;
    setHistory((current) =>
      draftSignature(start) === draftSignature(current.present)
        ? current
        : {
            future: [],
            past: [...current.past.slice(-29), start],
            present: current.present
          }
    );
  }

  function requestReturn() {
    if (
      dirty &&
      !window.confirm("存在未保存的图层修改，确定返回并放弃这些修改吗？")
    ) {
      return;
    }
    returnToPipeline();
  }

  function undo() {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        future: [current.present, ...current.future],
        past: current.past.slice(0, -1),
        present: previous
      };
    });
    setConflict(false);
  }

  function redo() {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        future: current.future.slice(1),
        past: [...current.past, current.present],
        present: next
      };
    });
    setConflict(false);
  }

  async function save() {
    if (!dirty || isSaving) return;
    const config: LayerCanvasConfig = {
      selected_layer_id: selected?.id ?? null,
      source_layer_set: layerSetSummary(layerSet),
      transform_patches: createLayerTransformPatches(
        layerSet.layers,
        draft.layers
      )
    };
    const definition = {
      ...pipeline.definition,
      nodes: pipeline.definition.nodes.map((candidate) =>
        candidate.id === node.id && candidate.type === "layer_canvas"
          ? { ...candidate, config }
          : candidate
      )
    };
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await apiClient.updateAigcPipeline(pipeline.id, {
        definition,
        description: pipeline.description,
        expected_revision: pipeline.revision,
        name: pipeline.name
      });
      setBaselineSignature(draftSignature(draft));
      setSourceStale(false);
      setFeedback(`已保存到节点，Pipeline Revision ${saved.revision}。`);
      returnToPipeline();
    } catch (error) {
      if (isApiError(error) && error.status === 409) {
        setConflict(true);
        setFeedback("保存冲突：Pipeline 已被更新，本地图层草稿已保留。");
      } else {
        setFeedback(getUserFacingErrorMessage(error));
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 sm:flex-nowrap sm:gap-3">
        <Button
          aria-label="返回 AIGC 画布"
          onClick={requestReturn}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-auto">
          <h1 className="truncate text-sm font-semibold">图层画布编辑器</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {pipeline.name} · {layerSet.canvas_width} × {layerSet.canvas_height} · Pipeline Revision {pipeline.revision}
          </p>
        </div>
        <Button
          className="flex-1 sm:flex-none"
          disabled={isSaving}
          onClick={requestReturn}
          type="button"
          variant="outline"
        >
          放弃修改
        </Button>
        <Button
          className="flex-1 sm:flex-none"
          disabled={!dirty || isSaving}
          onClick={save}
          type="button"
        >
          {isSaving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          保存到节点
        </Button>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[3.25rem_minmax(0,1fr)_20rem] lg:overflow-hidden"
        data-testid="aigc-layer-editor-workspace"
      >
        <aside
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:flex-col lg:border-b-0 lg:border-r lg:px-0 lg:py-3"
          data-testid="aigc-layer-editor-toolbar"
        >
          <ToolButton icon={Layers3} label="选择图层" onClick={() => undefined} pressed />
          <div className="mx-1 h-7 w-px shrink-0 bg-border lg:my-1 lg:h-px lg:w-7" />
          <ToolButton
            icon={ZoomIn}
            label="放大视图"
            onClick={() => setZoom((value) => Math.min(2, value + 0.1))}
          />
          <ToolButton
            icon={ZoomOut}
            label="缩小视图"
            onClick={() => setZoom((value) => Math.max(0.4, value - 0.1))}
          />
          <ToolButton icon={Scan} label="适应画布" onClick={() => setZoom(1)} />
          <div className="mx-1 h-7 w-px shrink-0 bg-border lg:my-1 lg:h-px lg:w-7" />
          <ToolButton
            disabled={history.past.length === 0}
            icon={Undo2}
            label="撤销"
            onClick={undo}
          />
          <ToolButton
            disabled={history.future.length === 0}
            icon={Redo2}
            label="重做"
            onClick={redo}
          />
        </aside>

        <section
          className="relative grid min-h-[24rem] w-full shrink-0 place-items-center overflow-auto bg-[radial-gradient(circle_at_center,hsl(var(--secondary))_0,hsl(var(--background))_72%)] p-3 sm:min-h-[32rem] sm:p-6 lg:min-h-0 lg:shrink"
          data-testid="aigc-layer-editor-canvas-region"
        >
          <div
            className="relative isolate max-h-full max-w-full shrink-0 touch-none overflow-hidden bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
            data-testid="aigc-layer-canvas"
            ref={canvasRef}
            style={{
              aspectRatio: `${layerSet.canvas_width} / ${layerSet.canvas_height}`,
              transform: `scale(${zoom})`,
              width: `min(100%, calc(${canvasRatio * 100}dvh - ${canvasRatio * 13}rem))`
            }}
          >
            {assetUrls.get(layerSet.base_asset_id) ? (
              // Internal asset URLs are resolved by the backend.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="锁定底图"
                className="absolute inset-0 h-full w-full select-none object-fill"
                draggable={false}
                src={assetUrls.get(layerSet.base_asset_id)}
              />
            ) : null}
            {draft.layers
              .filter((layer) => layer.visible)
              .toSorted((a, b) => a.z_index - b.z_index)
              .map((layer) => {
                const frame = getLayerFrame(
                  layer,
                  layerSet.canvas_width,
                  layerSet.canvas_height
                );
                const url = assetUrls.get(layer.asset_id);
                return (
                  <div
                    aria-label={`画布图层：${layer.name}`}
                    className={cn(
                      "absolute cursor-move select-none",
                      selected?.id === layer.id &&
                        "outline outline-2 outline-offset-2 outline-primary"
                    )}
                    data-testid={`aigc-canvas-layer-${layer.id}`}
                    key={layer.id}
                    onPointerDown={(event) => {
                      dragRef.current = {
                        clientX: event.clientX,
                        clientY: event.clientY,
                        draft: structuredClone(draft),
                        layerId: layer.id,
                        x: layer.x,
                        y: layer.y
                      };
                      setHistory((current) => ({
                        ...current,
                        present: { ...current.present, selectedId: layer.id }
                      }));
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                      event.preventDefault();
                    }}
                    onPointerMove={(event) => {
                      const drag = dragRef.current;
                      const canvas = canvasRef.current;
                      if (!drag || !canvas) return;
                      const bounds = canvas.getBoundingClientRect();
                      updateLayer(
                        drag.layerId,
                        positionFromDrag(
                          drag,
                          event.clientX - drag.clientX,
                          event.clientY - drag.clientY,
                          bounds.width,
                          bounds.height,
                          layerSet.canvas_width,
                          layerSet.canvas_height
                        ),
                        false
                      );
                    }}
                    onPointerUp={(event) => {
                      const start = dragRef.current?.draft;
                      dragRef.current = null;
                      finishGesture(start);
                      event.currentTarget.releasePointerCapture?.(event.pointerId);
                    }}
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
                    {selected?.id === layer.id ? (
                      <span
                        aria-label={`等比缩放图层 ${layer.name}`}
                        aria-valuemax={MAX_LAYER_SCALE}
                        aria-valuemin={MIN_LAYER_SCALE}
                        aria-valuenow={layer.scale}
                        className="absolute -bottom-2 -right-2 z-10 h-4 w-4 cursor-nwse-resize rounded-[3px] border-2 border-primary bg-background shadow"
                        onPointerDown={(event) => {
                          const [x1, y1, x2, y2] = layer.bbox_absolute;
                          dragRef.current = null;
                          resizeRef.current = {
                            clientX: event.clientX,
                            clientY: event.clientY,
                            draft: structuredClone(draft),
                            layerHeight: y2 - y1,
                            layerId: layer.id,
                            layerWidth: x2 - x1,
                            scale: layer.scale
                          };
                          event.currentTarget.setPointerCapture?.(event.pointerId);
                          event.stopPropagation();
                          event.preventDefault();
                        }}
                        onPointerMove={(event) => {
                          const resize = resizeRef.current;
                          const canvas = canvasRef.current;
                          if (!resize || !canvas) return;
                          const bounds = canvas.getBoundingClientRect();
                          updateLayer(
                            resize.layerId,
                            {
                              scale: scaleFromResize(
                                resize,
                                event.clientX - resize.clientX,
                                event.clientY - resize.clientY,
                                bounds.width,
                                bounds.height,
                                layerSet.canvas_width,
                                layerSet.canvas_height
                              )
                            },
                            false
                          );
                          event.stopPropagation();
                        }}
                        onPointerUp={(event) => {
                          const start = resizeRef.current?.draft;
                          resizeRef.current = null;
                          finishGesture(start);
                          event.currentTarget.releasePointerCapture?.(event.pointerId);
                          event.stopPropagation();
                        }}
                        role="slider"
                        tabIndex={0}
                      />
                    ) : null}
                  </div>
                );
              })}
          </div>
          <span className="absolute bottom-3 left-3 rounded border bg-card/90 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
        </section>

        <aside
          className="flex shrink-0 flex-col border-t border-border bg-card lg:min-h-0 lg:border-l lg:border-t-0"
          data-testid="aigc-layer-editor-sidebar"
        >
          <div className="p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Layer Stack
              </p>
              <span className="font-mono text-[10px] text-muted-foreground">
                {draft.layers.length + 1} 层
              </span>
            </div>
            <div className="space-y-2">
              {draft.layers
                .toSorted((a, b) => b.z_index - a.z_index)
                .map((layer) => (
                  <LayerRow
                    assetUrl={assetUrls.get(layer.asset_id) ?? null}
                    isBottom={layer.z_index === 1}
                    isTop={layer.z_index === draft.layers.length}
                    key={layer.id}
                    layer={layer}
                    onDelete={() => {
                      const remaining = draft.layers
                        .filter((candidate) => candidate.id !== layer.id)
                        .toSorted((a, b) => a.z_index - b.z_index)
                        .map((candidate, index) => ({
                          ...candidate,
                          z_index: index + 1
                        }));
                      commit({
                        layers: remaining,
                        selectedId:
                          draft.selectedId === layer.id
                            ? remaining.at(-1)?.id ?? null
                            : draft.selectedId
                      });
                    }}
                    onMove={(direction) =>
                      commit({
                        ...draft,
                        layers: moveLayer(draft.layers, layer.id, direction)
                      })
                    }
                    onSelect={() =>
                      commit({ ...draft, selectedId: layer.id })
                    }
                    onVisibility={() =>
                      updateLayer(layer.id, { visible: !layer.visible })
                    }
                    selected={selected?.id === layer.id}
                  />
                ))}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/35 p-2.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border bg-card">
                  <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">底图</p>
                  <p className="text-xs text-muted-foreground">Z 0 · 已锁定</p>
                </div>
                <LockKeyhole aria-label="底图锁定" className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
          <TransformControls
            layer={selected}
            onChange={(changes) =>
              selected && updateLayer(selected.id, changes)
            }
          />
          <div className="border-t border-border p-3">
            {failedAssetIds.length > 0 ? (
              <p className="mb-2 text-xs font-semibold leading-5 text-destructive" role="alert">
                图层资产加载失败：{failedAssetIds.join("、")}
              </p>
            ) : null}
            <p
              className={cn(
                "text-xs leading-5",
                conflict ? "font-semibold text-destructive" : "text-muted-foreground"
              )}
              role="status"
            >
              {feedback ??
                (dirty
                  ? "修改仅保存在当前页面，保存后写入节点配置。"
                  : "图层草稿与 Pipeline 已同步。")}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function LayerRow({
  assetUrl,
  isBottom,
  isTop,
  layer,
  onDelete,
  onMove,
  onSelect,
  onVisibility,
  selected
}: {
  assetUrl: string | null;
  isBottom: boolean;
  isTop: boolean;
  layer: AigcLayer;
  onDelete: () => void;
  onMove: (direction: "down" | "up") => void;
  onSelect: () => void;
  onVisibility: () => void;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2",
        selected ? "border-primary/50 bg-primary/[0.07]" : "bg-background"
      )}
    >
      <button
        aria-label={`选择图层 ${layer.name}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onSelect}
        type="button"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md border bg-secondary/50">
          {assetUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="h-full w-full object-contain" src={assetUrl} />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{layer.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Z {layer.z_index} · {layer.visible ? "可见" : "隐藏"}
          </span>
        </span>
      </button>
      <div className="grid shrink-0 grid-cols-2 gap-0.5">
        <ToolButton
          icon={layer.visible ? Eye : EyeOff}
          label={`${layer.visible ? "隐藏" : "显示"}图层 ${layer.name}`}
          onClick={onVisibility}
          small
        />
        <ToolButton icon={Grip} label={`图层层级 ${layer.z_index}`} onClick={onSelect} small />
        <ToolButton disabled={isTop} icon={ArrowUp} label={`上移图层 ${layer.name}`} onClick={() => onMove("up")} small />
        <ToolButton disabled={isBottom} icon={ArrowDown} label={`下移图层 ${layer.name}`} onClick={() => onMove("down")} small />
        <ToolButton icon={Trash2} label={`删除图层 ${layer.name}`} onClick={onDelete} small />
      </div>
    </div>
  );
}

function TransformControls({
  layer,
  onChange
}: {
  layer: AigcLayer | null;
  onChange: (changes: Partial<Pick<AigcLayer, "scale" | "x" | "y">>) => void;
}) {
  return (
    <div className="border-t border-border bg-secondary/25 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Transform
      </p>
      {layer ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["X", "Y"] as const).map((axis) => (
              <label className="space-y-1 text-xs font-medium" key={axis}>
                <span>{axis}（底图像素）</span>
                <Input
                  aria-label={`${axis} 坐标`}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value)) {
                      onChange(axis === "X" ? { x: value } : { y: value });
                    }
                  }}
                  type="number"
                  value={axis === "X" ? layer.x : layer.y}
                />
              </label>
            ))}
          </div>
          <label className="block text-xs font-medium" htmlFor="aigc-layer-scale">
            等比缩放
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2">
            <input
              aria-label="图层缩放滑杆"
              className="w-full accent-primary"
              id="aigc-layer-scale"
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
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">选择一个非底图图层后调整。</p>
      )}
    </div>
  );
}

function ToolButton({
  disabled = false,
  icon: Icon,
  label,
  onClick,
  pressed = false,
  small = false
}: {
  disabled?: boolean;
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  small?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed || undefined}
      className={cn(
        "grid place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-25",
        small ? "h-7 w-7" : "h-9 w-9",
        pressed && "bg-primary/10 text-primary"
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}

export function LayerEditorError({ message }: { message: string }) {
  return (
    <main className="grid h-[calc(100dvh-4rem)] place-items-center px-6">
      <div className="max-w-lg rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
        <p className="text-sm font-semibold text-destructive">{message}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={"/workspace/aigc" as Route}>返回 AIGC 工作台</Link>
        </Button>
      </div>
    </main>
  );
}

function draftSignature(draft: Draft) {
  return JSON.stringify({
    layers: draft.layers
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map(({ id, scale, visible, x, y, z_index }) => ({
        id,
        scale,
        visible,
        x,
        y,
        z_index
      })),
    selectedId: draft.selectedId
  });
}
