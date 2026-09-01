"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Handle,
  NodeResizer,
  Position,
  type Node,
  type NodeProps
} from "@xyflow/react";
import {
  AudioLines,
  Download,
  FileOutput,
  ImageIcon,
  Layers3,
  MessageSquareText,
  Pencil,
  Play,
  Sparkles,
  Trash2,
  Type,
  Video
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { memo, useState } from "react";
import { AigcPreciseEditDialog } from "@/components/workspace/aigc/aigc-precise-edit-dialog";
import {
  useAigcLayerPreviewRun,
  useAigcRunActions,
  useAigcRunProjection
} from "@/components/workspace/aigc/aigc-run-context";
import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import {
  getAigcImageDownload,
  getAigcVideoDownload
} from "@/lib/aigc/download";
import { isSelectableMediaAsset } from "@/lib/aigc/media-assets";
import { getAigcModalityColors } from "@/lib/aigc/modality-colors";
import {
  applyLayerCanvasConfig,
  findUpstreamLayerSet,
  layerCanvasModificationCount,
  layerCanvasSourceIsCurrent
} from "@/lib/aigc/layers";
import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import {
  projectAigcLayerCompositeResult,
  projectAigcVideoResult
} from "@/lib/aigc/result-projection";
import {
  isSeedreamImageInputActive,
  isSeedreamImageOutputActive,
  seedreamImageInputCount,
  seedreamImageInputLimit,
  seedreamImageOperation,
  seedreamImageTitle
} from "@/lib/aigc/seedream-image";
import { useAigcEditorStore } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import type { AigcEditorState } from "@/lib/aigc/editor-store";
import {
  isVideoPortActive,
  videoInputCount,
  videoInputLimit
} from "@/lib/aigc/video-generation";
import type {
  AigcEdge,
  AigcNode,
  AigcPipelineRunDetail
} from "@/lib/aigc/types";
import type { Asset, ReferenceAssetKind } from "@/lib/api-types";
import {
  getSafeAssetContentUrl,
  getSafePreviewUrl
} from "@/lib/asset-display";
import { SEEDANCE_CAPABILITIES } from "@/lib/seedance";
import { getLayerFrame } from "@/lib/layer-editor-geometry";
import { cn } from "@/lib/utils";

interface AigcFlowNodeData extends Record<string, unknown> {
  node: AigcNode;
}

export type AigcFlowNode = Node<
  AigcFlowNodeData,
  AigcNode["type"]
>;

function AigcFlowNodeComponent({
  data,
  id,
  selected
}: NodeProps<AigcFlowNode>) {
  const removeNode = useAigcEditorStore((state) => state.removeNode);
  const resizeNode = useAigcEditorStore((state) => state.resizeNode);
  const definition = useAigcEditorStore((state) => state.definition);
  const edges = definition.edges;
  const runDetail = useAigcRunProjection();
  const layerPreviewRun = useAigcLayerPreviewRun();
  const runNode = runDetail?.nodes.find((item) => item.node_id === id);
  const layerCanvasRunDetail =
    data.node.type === "layer_canvas" &&
    runNode?.status !== "succeeded" &&
    layerPreviewRun
      ? layerPreviewRun
      : runDetail;
  const registration = AIGC_NODE_REGISTRY_BY_TYPE.get(data.node.type);
  const category = registration?.category ?? "model";
  const inputModalityColors =
    category === "input"
      ? getAigcModalityColors(registration?.outputs[0]?.type)
      : null;
  const imageInputPort = registration?.inputs.find(
    (port) => port.id === "image" && port.type === "image_asset"
  );
  const seedreamNode =
    data.node.type === "image_to_image" ? data.node : null;
  const referenceImageCount =
    seedreamNode && imageInputPort
      ? edges.filter(
          (edge) =>
            edge.targetNodeId === id && edge.targetHandle === imageInputPort.id
        ).length
      : 0;
  const imageInputFull = Boolean(
    seedreamNode &&
      imageInputPort &&
      referenceImageCount >= seedreamImageInputLimit(seedreamNode, imageInputPort)
  );
  const videoNode =
    data.node.type === "video_generation" ? data.node : null;
  const videoInputPorts =
    videoNode
      ? registration?.inputs.filter((port) => {
          const connected = videoInputCount(edges, id, port.id) > 0;
          return (
            isVideoPortActive(port, videoNode.config.generation_mode) ||
            connected
          );
        }) ?? []
      : null;
  const seedreamInputPorts =
    seedreamNode
      ? registration?.inputs.filter(
          (port) =>
            isSeedreamImageInputActive(seedreamNode, port.id, edges) ||
            seedreamImageInputCount(edges, id, port.id) > 0
        ) ?? []
      : null;
  const renderedInputPorts =
    videoInputPorts ?? seedreamInputPorts ?? registration?.inputs ?? [];
  const renderedOutputPorts =
    seedreamNode
      ? registration?.outputs.filter(
          (port) =>
            isSeedreamImageOutputActive(seedreamNode, port.id, edges) ||
            edges.some(
              (edge) =>
                edge.sourceNodeId === id && edge.sourceHandle === port.id
            )
        ) ?? []
      : registration?.outputs ?? [];
  const inputKind = mediaInputKind(data.node);
  const inputAssetId =
    data.node.type === "image_input" ||
    data.node.type === "video_input" ||
    data.node.type === "audio_input"
      ? data.node.config.asset_id
      : null;
  const inputAssetQuery = useQuery({
    enabled: Boolean(inputAssetId),
    queryKey: ["aigc", "input-asset", inputAssetId],
    queryFn: () => apiClient.getAsset(inputAssetId as string)
  });
  const inputAsset =
    inputKind &&
    inputAssetQuery.data &&
    isSelectableMediaAsset(inputAssetQuery.data, inputKind)
      ? inputAssetQuery.data
      : undefined;
  const outputAsset =
    (data.node.type === "image_output" ||
      data.node.type === "video_output") &&
    runNode?.result.kind === "assets"
      ? runNode.result.assets.find(
          (asset) => asset.available && asset.download_url
        )
      : undefined;
  const videoProjection =
    data.node.type === "video_output"
      ? projectAigcVideoResult(
          runDetail?.run.definition_snapshot,
          data.node.id,
          runNode?.result.assets ?? []
        )
      : null;
  const layerCompositeProjection =
    data.node.type === "layer_composite"
      ? projectAigcLayerCompositeResult(
          definition,
          data.node.id,
          runDetail?.nodes ?? []
        )
      : null;
  const outputDownload =
    data.node.type === "image_output"
      ? getAigcImageDownload(outputAsset, data.node.config.title)
      : data.node.type === "video_output"
        ? getAigcVideoDownload(videoProjection?.asset, data.node.config.title)
        : null;
  const outputTitle =
    data.node.type === "image_output" || data.node.type === "video_output"
      ? data.node.config.title
      : "";
  const media =
    data.node.type === "image_input"
      ? {
          alt: inputAsset
            ? assetName(inputAsset.metadata.name, inputAsset.id)
            : "图片输入",
          emptyText: !inputAssetId
            ? "选择或上传图片"
            : inputAssetQuery.isPending
              ? "正在加载图片"
              : "图片暂不可预览",
          url: inputAsset
            ? getSafePreviewUrl(inputAsset)
            : null
        }
      : data.node.type === "image_output"
        ? {
            alt: data.node.config.title || "图片输出",
            emptyText:
              runNode?.result.kind === "unavailable"
                ? "历史结果已不可用"
                : "执行后显示图片",
            url: getSafeAssetContentUrl(outputAsset?.download_url ?? null)
          }
        : null;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md border bg-card shadow-md",
        selected && "ring-2 ring-primary/20",
        inputModalityColors
          ? null
          : selected
            ? "border-primary"
            : "border-border"
      )}
      style={
        inputModalityColors
          ? { borderColor: inputModalityColors.cardBorderColor }
          : undefined
      }
    >
      <NodeResizer
        color="hsl(var(--primary))"
        isVisible={selected}
        minHeight={120}
        minWidth={190}
        onResizeEnd={(_, size) =>
          resizeNode(id, { height: size.height, width: size.width })
        }
      />
      {renderedInputPorts.map((port, index) => {
        const modalityColors = getAigcModalityColors(port.type);
        const count = videoInputCount(edges, id, port.id);
        const limit =
          data.node.type === "video_generation"
            ? videoInputLimit(data.node, port)
            : seedreamNode
              ? seedreamImageInputLimit(seedreamNode, port)
            : port.max_connections;
        const inactive =
          (data.node.type === "video_generation" &&
            !isVideoPortActive(port, data.node.config.generation_mode)) ||
          Boolean(
            seedreamNode &&
              !isSeedreamImageInputActive(seedreamNode, port.id, edges)
          );
        const full =
          (imageInputFull && port.id === imageInputPort?.id) || count >= limit;
        const stateText = inactive
          ? "，与当前模式不兼容"
          : full
            ? data.node.type === "image_to_image" &&
              port.type === "image_asset"
              ? `，已达到 ${limit} 张上限`
              : `，已达到 ${limit} 个连接上限`
            : "";
        return (
          <Handle
            aria-label={`${port.label}输入${stateText}`}
            className="!h-2.5 !w-2.5 !border-2 !border-card"
            id={port.id}
            isConnectable={!inactive && !full}
            key={port.id}
            position={Position.Left}
            style={{
              backgroundColor: modalityColors.handleColor,
              opacity: inactive ? 0.4 : 1,
              top: `${((index + 1) / (renderedInputPorts.length + 1)) * 100}%`
            }}
            title={
              inactive
                ? `${port.label}输入与当前模式不兼容，请断开连线`
                : full
                  ? data.node.type === "image_to_image" &&
                    port.type === "image_asset"
                    ? `${port.label}输入已满，最多支持 ${limit} 张参考图`
                    : `${port.label}输入已满，最多支持 ${limit} 个连接`
                  : `${port.label}输入`
            }
            type="target"
          />
        );
      })}
      {renderedOutputPorts.map((port, index) => {
        const inactive = Boolean(
          seedreamNode &&
            !isSeedreamImageOutputActive(seedreamNode, port.id, edges)
        );
        const stateText = inactive ? "，与当前模式或编辑目标不兼容" : "";
        return (
          <Handle
            aria-label={`${port.label}输出${stateText}`}
            className="!h-2.5 !w-2.5 !border-2 !border-card"
            id={port.id}
            isConnectable={!inactive}
            key={port.id}
            position={Position.Right}
            style={{
              backgroundColor: getAigcModalityColors(port.type).handleColor,
              opacity: inactive ? 0.4 : 1,
              top: `${((index + 1) / (renderedOutputPorts.length + 1)) * 100}%`
            }}
            title={
              inactive
                ? `${port.label}输出与当前模式或编辑目标不兼容，请断开连线`
                : `${port.label}输出`
            }
            type="source"
          />
        );
      })}

      <div
        className={cn(
          "flex h-9 shrink-0 items-center justify-between border-b px-2.5",
          category === "model" && "border-primary/25 bg-primary/[0.07]",
          category === "output" && "border-success/25 bg-success/[0.08]"
        )}
        style={
          inputModalityColors
            ? {
                backgroundColor:
                  inputModalityColors.cardHeaderBackgroundColor,
                borderBottomColor: inputModalityColors.cardBorderColor
              }
            : undefined
        }
      >
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          <span
            className="flex shrink-0"
            style={
              inputModalityColors
                ? { color: inputModalityColors.iconColor }
                : undefined
            }
          >
            {nodeIcon(data.node)}
          </span>
          <span className="truncate">
            {seedreamNode
              ? seedreamImageTitle(seedreamNode)
              : registration?.label ?? data.node.type}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {outputDownload ? (
            <a
              aria-label={`下载${data.node.type === "video_output" ? "视频" : "图片"}：${outputTitle}`}
              className="nodrag grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-card hover:text-foreground"
              download={outputDownload.filename}
              href={outputDownload.url}
              onClick={(event) => event.stopPropagation()}
              title={`下载${data.node.type === "video_output" ? "视频" : "图片"}`}
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {data.node.type === "image_input" ? (
            <AigcPreciseEditDialog
              asset={inputAsset}
              node={data.node}
              url={
                inputAsset
                  ? getSafePreviewUrl(inputAsset)
                  : null
              }
            />
          ) : null}
          <button
            aria-label={`删除节点：${registration?.label ?? data.node.type}`}
            className="nodrag grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-card hover:text-destructive"
            onClick={() => removeNode(id)}
            title="删除节点"
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {data.node.type === "video_input" || data.node.type === "audio_input" ? (
        <NodeInputMedia
          asset={inputAsset}
          kind={data.node.type === "video_input" ? "video" : "audio"}
          key={`${data.node.type}:${inputAssetId ?? "empty"}:${inputAsset?.updated_at ?? "loading"}`}
          loading={inputAssetQuery.isPending}
          referenced={Boolean(inputAssetId)}
        />
      ) : data.node.type === "video_output" ? (
        <AigcVideoPlayer
          audioState={videoProjection?.audioState}
          initialMetadata={{
            duration: videoProjection?.duration ?? null,
            height: null,
            width: null
          }}
          key={`${runDetail?.run.id ?? "none"}:${videoProjection?.asset?.asset_id ?? "unavailable"}`}
          mimeType={videoProjection?.asset?.mime_type ?? null}
          name={data.node.config.title || "视频结果"}
          resolutionLabel={videoProjection?.resolution}
          unavailableText={
            runNode?.result.kind === "unavailable" ||
            (runNode?.result.kind === "assets" && !videoProjection?.asset?.available)
              ? "历史视频结果已不可用，资产可能已删除或无权访问"
              : "执行后显示视频"
          }
          url={
            videoProjection?.asset?.available
              ? getSafeAssetContentUrl(videoProjection.asset.download_url)
              : null
          }
        />
      ) : media ? (
        <NodeImageMedia
          alt={media.alt}
          emptyText={media.emptyText}
          hasBbox={
            data.node.type === "image_input" && Boolean(data.node.config.bbox)
          }
          url={media.url}
        />
      ) : data.node.type === "layer_canvas" ? (
        <LayerCanvasNodeBody
          edges={edges}
          node={data.node}
          runDetail={layerCanvasRunDetail}
        />
      ) : data.node.type === "layer_composite" && layerCompositeProjection ? (
        <LayerCompositeNodeBody
          projection={layerCompositeProjection}
          status={runNode?.status ?? null}
        />
      ) : (
        <div className="nodrag min-h-0 flex-1 overflow-hidden p-3">
          {seedreamNode &&
          imageInputPort &&
          seedreamImageOperation(seedreamNode) === "image_to_image" ? (
            <p className="mb-1 text-xs font-medium text-foreground">
              参考图 {referenceImageCount}/{imageInputPort.max_connections}
            </p>
          ) : null}
          {data.node.type === "video_generation" ? (
            <VideoGenerationSummary
              edges={edges}
              node={data.node}
            />
          ) : null}
          <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
            {nodeSummary(data.node)}
          </p>
        </div>
      )}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-border px-2.5 font-mono text-[9px] text-muted-foreground">
        <span
          className={cn(
            runNode?.status === "succeeded" && "text-success",
            runNode?.status === "reused" && "text-info",
            ["failed", "timed_out"].includes(runNode?.status ?? "") &&
              "text-destructive",
            ["queued", "running"].includes(runNode?.status ?? "") &&
              "text-primary"
          )}
        >
          {runNode?.status?.toUpperCase() ?? category.toUpperCase()}
        </span>
        <span className="max-w-24 truncate">{id}</span>
      </div>
    </div>
  );
}

function LayerCompositeNodeBody({
  projection,
  status
}: {
  projection: ReturnType<typeof projectAigcLayerCompositeResult>;
  status: AigcPipelineRunDetail["nodes"][number]["status"] | null;
}) {
  const targetLabel =
    projection.targetLayer?.name ||
    projection.replacement?.layer_id ||
    (projection.replacementConnected ? "运行后识别" : "尚未连接");
  const outputState =
    status === "running" || status === "queued"
      ? "正在合成"
      : status === "failed" || status === "timed_out"
        ? "合成失败"
        : projection.imageAsset
          ? "扁平图片已生成"
          : "等待运行";

  return (
    <div className="nodrag flex min-h-0 flex-1 flex-col gap-2 p-3 text-[10px]">
      <div className="grid grid-cols-2 gap-1">
        <CompositeInputState
          connected={projection.layersConnected}
          label="图层集输入"
        />
        <CompositeInputState
          connected={projection.replacementConnected}
          label="替换图层输入"
        />
      </div>
      <div className="rounded border border-border bg-background px-2 py-1.5">
        <p className="text-muted-foreground">替换目标</p>
        <p className="mt-0.5 truncate font-medium text-foreground" title={targetLabel}>
          {targetLabel}
        </p>
      </div>
      <div className="mt-auto space-y-1 border-t border-border pt-2 text-muted-foreground">
        <p>
          图片输出：<span className="text-foreground">{outputState}</span>
        </p>
        <p>
          图层集输出：
          <span className="text-foreground">
            {projection.layerSet
              ? ` v${projection.layerSet.version} · ${projection.layerSet.layers.length + 1} 层`
              : " 等待运行"}
          </span>
        </p>
      </div>
    </div>
  );
}

function CompositeInputState({
  connected,
  label
}: {
  connected: boolean;
  label: string;
}) {
  return (
    <span
      aria-label={`${label}${connected ? "已连接" : "未连接"}`}
      className={cn(
        "rounded border px-1.5 py-1 text-center",
        connected
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      {label.replace("输入", "")} · {connected ? "已连接" : "未连接"}
    </span>
  );
}

function LayerCanvasNodeBody({
  edges,
  node,
  runDetail
}: {
  edges: readonly AigcEdge[];
  node: Extract<AigcNode, { type: "layer_canvas" }>;
  runDetail: AigcPipelineRunDetail | null | undefined;
}) {
  const dirty = useAigcEditorStore((state) => state.dirty);
  const runActions = useAigcRunActions();
  const pipelineId = useAigcEditorStore((state) => state.entityId);
  const mode = useAigcEditorStore((state) => state.mode);
  const [entryFeedback, setEntryFeedback] = useState<string | null>(null);
  const layerSet = runDetail
    ? findUpstreamLayerSet(edges, node.id, [runDetail])
    : null;
  const current = layerSet
    ? layerCanvasSourceIsCurrent(node.config, layerSet)
    : false;
  const layers = layerSet
    ? applyLayerCanvasConfig(layerSet, node.config)
    : [];
  const assetIds = layerSet
    ? [layerSet.base_asset_id, ...layers.map((layer) => layer.asset_id)]
    : [];
  const runPipelineId = runDetail?.run.pipeline_id ?? null;
  const runId = runDetail?.run.id ?? null;
  const assetQueries = useQueries({
    queries: assetIds.map((assetId) => ({
      enabled: Boolean(runPipelineId && runId),
      queryFn: () =>
        apiClient.getAigcInternalRunAsset(
          runPipelineId as string,
          runId as string,
          assetId
        ),
      queryKey: [
        "aigc",
        "layer-preview-asset",
        runPipelineId,
        runId,
        assetId
      ],
      retry: false,
      staleTime: 60_000
    }))
  });
  const assetUrls = new Map(
    assetIds.flatMap((assetId, index) => {
      const asset = assetQueries[index]?.data;
      const url = asset ? getSafePreviewUrl(asset) : null;
      return url ? [[assetId, url] as const] : [];
    })
  );
  const failedAssetLabels = assetIds.flatMap((assetId, index) => {
    if (!assetQueries[index]?.isError) return [];
    if (assetId === layerSet?.base_asset_id) return ["底图"];
    const layer = layers.find((candidate) => candidate.asset_id === assetId);
    return [layer ? `${layer.name || layer.id}（${layer.id}）` : assetId];
  });
  const selected = current
    ? layers.find((layer) => layer.id === node.config.selected_layer_id)
    : null;
  const modificationCount =
    layerSet && current
      ? layerCanvasModificationCount(layerSet.layers, layers)
      : node.config.transform_patches.length;
  const href =
    mode === "pipeline" && pipelineId
      ? (`/workspace/aigc/pipelines/${pipelineId}/nodes/${node.id}/layers` as Route)
      : null;

  return (
    <div className="nodrag flex min-h-0 flex-1 flex-col gap-2 p-2.5">
      <div
        aria-label="图层组合预览"
        className="relative min-h-20 flex-1 overflow-hidden rounded-md border border-border bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:12px_12px]"
      >
        {layerSet && assetUrls.get(layerSet.base_asset_id) ? (
          // Internal asset URLs are resolved by the backend.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="图层组合底图"
            className="absolute inset-0 h-full w-full object-fill"
            src={assetUrls.get(layerSet.base_asset_id)}
          />
        ) : null}
        {layerSet
          ? layers
              .filter((layer) => layer.visible)
              .toSorted((a, b) => a.z_index - b.z_index)
              .map((layer) => {
                const frame = getLayerFrame(
                  layer,
                  layerSet.canvas_width,
                  layerSet.canvas_height
                );
                const url = assetUrls.get(layer.asset_id);
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="absolute object-fill"
                    key={layer.id}
                    src={url}
                    style={{
                      height: `${frame.heightPercent}%`,
                      left: `${frame.leftPercent}%`,
                      top: `${frame.topPercent}%`,
                      width: `${frame.widthPercent}%`,
                      zIndex: layer.z_index
                    }}
                  />
                ) : null;
              })
          : null}
        {!layerSet ? (
          <div className="grid h-full min-h-20 place-items-center px-3 text-center text-[11px] text-muted-foreground">
            当前 Run 无成功图层集
          </div>
        ) : null}
      </div>
      {failedAssetLabels.length > 0 ? (
        <p
          className="text-[10px] font-medium text-destructive"
          role="alert"
          title={failedAssetLabels.join("、")}
        >
          {failedAssetLabels.length} 个图层预览加载失败：
          {failedAssetLabels.join("、")}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
        <span>图层 {layerSet ? layerSet.layers.length + 1 : 0}</span>
        <span className="text-right">修改 {modificationCount}</span>
        <span className="col-span-2 truncate">
          {current
            ? selected
              ? `已选：${selected.name}`
              : "尚未选择图层"
            : layerSet
              ? "上游已变化，需重新确认"
              : "暂无可编辑图层集"}
        </span>
      </div>
      {href ? (
        <Link
          className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-accent hover:text-accent-foreground"
          href={href}
          onClick={(event) => {
            event.stopPropagation();
            if (!dirty) return;
            event.preventDefault();
            setEntryFeedback("主画布有未保存修改，请先保存 Pipeline。");
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Pencil className="h-3 w-3" />
          打开图层编辑器
        </Link>
      ) : (
        <span className="text-center text-[10px] text-muted-foreground">
          Pipeline 实例中可编辑
        </span>
      )}
      {mode === "pipeline" && runActions ? (
        <button
          aria-label="从此节点继续"
          className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          disabled={runActions.pending}
          onClick={(event) => {
            event.stopPropagation();
            runActions.continueFromNode(node.id);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          title="复用可用的上游结果，从图层画布节点重新执行当前节点及下游"
          type="button"
        >
          <Play className="h-3 w-3" />
          {runActions.pending ? "正在执行" : "从此节点继续"}
        </button>
      ) : null}
      {entryFeedback ? (
        <p className="text-[10px] font-medium text-destructive" role="status">
          {entryFeedback}
        </p>
      ) : null}
    </div>
  );
}

function VideoGenerationSummary({
  edges,
  node
}: {
  edges: AigcEditorState["definition"]["edges"];
  node: Extract<AigcNode, { type: "video_generation" }>;
}) {
  const capabilities = SEEDANCE_CAPABILITIES[node.config.model];
  return (
    <div className="mb-2 grid grid-cols-3 gap-1 text-center text-[9px] font-medium text-muted-foreground">
      <span>
        图片 {videoInputCount(edges, node.id, "reference_images")}/
        {capabilities.maxReferenceImages}
      </span>
      <span>
        视频 {videoInputCount(edges, node.id, "reference_videos")}/
        {capabilities.maxReferenceVideos}
      </span>
      <span>
        音频 {videoInputCount(edges, node.id, "reference_audios")}/
        {capabilities.maxReferenceAudios}
      </span>
    </div>
  );
}

function NodeImageMedia({
  alt,
  emptyText,
  hasBbox,
  url
}: {
  alt: string;
  emptyText: string;
  hasBbox: boolean;
  url: string | null;
}) {
  const [dimensions, setDimensions] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const resolution = dimensions?.url === url
    ? `${dimensions.width} × ${dimensions.height}`
    : null;

  return (
    <>
      <div className="nodrag min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-950 p-1.5">
        {url ? (
          <button
            aria-label={`查看原图：${alt}`}
            className="group relative block h-full min-h-0 w-full min-w-0 cursor-zoom-in overflow-hidden"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewOpen(true);
            }}
            title="查看原图"
            type="button"
          >
            {/* Signed asset URLs must be passed through without image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={alt}
              className="absolute inset-0 block h-full w-full select-none object-contain"
              draggable={false}
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                  setDimensions({
                    height: image.naturalHeight,
                    url,
                    width: image.naturalWidth
                  });
                }
              }}
              src={url}
            />
            {resolution ? (
              <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[9px] text-white shadow-sm">
                {resolution}
              </span>
            ) : null}
            {hasBbox ? (
              <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-sm">
                已框选
              </span>
            ) : null}
          </button>
        ) : (
          <div className="grid h-full min-h-0 w-full place-items-center px-3 text-center text-[10px] text-slate-300">
            {emptyText}
          </div>
        )}
      </div>
      <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
        <DialogContent className="grid h-[92dvh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-slate-700 bg-slate-950 p-0 text-white sm:rounded-xl">
          <DialogHeader className="border-b border-white/10 px-5 py-4 pr-14">
            <DialogTitle>查看原图</DialogTitle>
            <DialogDescription className="text-slate-300">
              {alt}
              {resolution ? ` · ${resolution}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid h-full min-h-0 w-full place-items-center overflow-hidden p-4">
            {url ? (
              /* Signed asset URLs must be passed through without image optimization. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                alt={`${alt} 原图预览`}
                className="block h-auto max-h-[calc(92dvh-7rem)] w-auto max-w-[calc(96vw-2rem)] object-contain"
                draggable={false}
                src={url}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NodeInputMedia({
  asset,
  kind,
  loading,
  referenced
}: {
  asset: Asset | undefined;
  kind: "video" | "audio";
  loading: boolean;
  referenced: boolean;
}) {
  const [metadata, setMetadata] = useState<{
    duration: number | null;
    height: number | null;
    width: number | null;
  }>({
    duration: metadataNumber(asset, "duration_seconds"),
    height: metadataNumber(asset, "height"),
    width: metadataNumber(asset, "width")
  });
  const url = asset ? getSafePreviewUrl(asset) : null;
  const name = asset
    ? assetName(asset.metadata.name, asset.id)
    : kind === "video"
      ? "视频输入"
      : "音频输入";
  const details = mediaDetails(asset, metadata, kind);
  const emptyText = !referenced
    ? `选择或上传${kind === "video" ? "视频" : "音频"}`
    : loading
      ? `正在加载${kind === "video" ? "视频" : "音频"}`
      : "资产不可用，请替换";

  function readMediaMetadata(media: HTMLMediaElement) {
    setMetadata({
      duration: Number.isFinite(media.duration) ? media.duration : null,
      height:
        media instanceof HTMLVideoElement && media.videoHeight > 0
          ? media.videoHeight
          : null,
      width:
        media instanceof HTMLVideoElement && media.videoWidth > 0
          ? media.videoWidth
          : null
    });
  }

  if (!url) {
    return (
      <div className="nodrag grid min-h-0 flex-1 place-items-center bg-slate-950 px-3 text-center text-[10px] text-slate-300">
        <div>
          <p>{emptyText}</p>
          {referenced && !loading ? (
            <p className="mt-1 font-mono text-[9px] text-amber-300">
              {asset?.id ?? "引用已删除或无法访问"}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="nodrag nowheel flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-hidden bg-slate-950 p-2 text-white">
        <p className="truncate text-[10px] font-medium" title={name}>{name}</p>
        <audio
          aria-label={`播放音频：${name}`}
          className="h-8 w-full"
          controls
          onLoadedMetadata={(event) => readMediaMetadata(event.currentTarget)}
          preload="metadata"
          src={url}
        />
        <p className="truncate font-mono text-[9px] text-slate-300">{details}</p>
      </div>
    );
  }

  return (
    <AigcVideoPlayer
      initialMetadata={metadata}
      mimeType={asset?.mime_type ?? null}
      name={name}
      url={url}
    />
  );
}

function mediaDetails(
  asset: Asset | undefined,
  metadata: { duration: number | null; height: number | null; width: number | null },
  kind: "video" | "audio"
): string {
  const values: string[] = [];
  if (kind === "video" && metadata.width && metadata.height) {
    values.push(`${metadata.width} × ${metadata.height}`);
  }
  if (metadata.duration !== null) values.push(formatDuration(metadata.duration));
  if (asset?.mime_type) values.push(asset.mime_type);
  return values.join(" · ") || "元数据读取中";
}

function metadataNumber(asset: Asset | undefined, key: string): number | null {
  const value = asset?.metadata[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round((seconds % 60) * 10) / 10;
  return minutes > 0
    ? `${minutes}:${String(remainder).padStart(4, "0")}`
    : `${remainder}s`;
}

function mediaInputKind(node: AigcNode): ReferenceAssetKind | null {
  if (node.type === "image_input") return "image";
  if (node.type === "video_input") return "video";
  if (node.type === "audio_input") return "audio";
  return null;
}

function assetName(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nodeIcon(node: AigcNode) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (node.type === "text_input") return <Type className={className} />;
  if (node.type === "image_input") return <ImageIcon className={className} />;
  if (node.type === "video_input") return <Video className={className} />;
  if (node.type === "audio_input") return <AudioLines className={className} />;
  if (node.type === "llm") return <MessageSquareText className={className} />;
  if (node.type === "layer_canvas") return <Layers3 className={className} />;
  if (
    node.type === "text_output" ||
    node.type === "image_output" ||
    node.type === "video_output"
  ) {
    return <FileOutput className={className} />;
  }
  return <Sparkles className={className} />;
}

function nodeSummary(node: AigcNode): string {
  if (node.type === "text_input") {
    const referenceCount = node.config.bbox_references?.length ?? 0;
    const text = node.config.text || "配置输入文本";
    return referenceCount > 0
      ? `${text} · ${referenceCount} 个区域引用`
      : text;
  }
  if (node.type === "image_input") {
    return node.config.asset_id ? `资产 ${node.config.asset_id}` : "选择或上传图片";
  }
  if (node.type === "video_input" || node.type === "audio_input") {
    return node.config.asset_id ? `资产 ${node.config.asset_id}` : "尚未选择素材";
  }
  if (node.type === "llm") return node.config.model;
  if (node.type === "text_output" || node.type === "image_output") {
    return node.config.title;
  }
  if (node.type === "video_generation") {
    const taskType =
      node.config.generation_mode === "multimodal_reference"
        ? ` · ${node.config.task_type ?? "generate"}`
        : "";
    return `${node.config.model} · ${node.config.generation_mode}${taskType}`;
  }
  if (node.type === "layer_canvas") {
    return node.config.selected_layer_id
      ? `已选择图层 ${node.config.selected_layer_id}`
      : "尚未选择图层";
  }
  if (node.type === "layer_composite") return "替换指定图层并合成图片";
  if (node.type === "video_output") return node.config.title;
  if (node.type === "image_to_image") {
    return `${seedreamImageTitle(node)} · ${node.config.model} · ${node.config.size}`;
  }
  return `${node.config.model} · ${node.config.aspect_ratio} · ${node.config.size}`;
}

export const AigcFlowNodeCard = memo(AigcFlowNodeComponent);
