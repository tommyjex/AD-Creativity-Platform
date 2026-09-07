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
  Copy,
  Download,
  Pencil,
  Play
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { AigcPreciseEditDialog } from "@/components/workspace/aigc/aigc-precise-edit-dialog";
import { AigcAudioPlayer } from "@/components/workspace/aigc/aigc-audio-player";
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
  getAigcAudioDownload,
  getAigcVideoDownload
} from "@/lib/aigc/download";
import { isSelectableMediaAsset } from "@/lib/aigc/media-assets";
import { getAigcModalityColors } from "@/lib/aigc/modality-colors";
import {
  aigcNodeBaseDisplayName,
  deriveAigcNodeDisplayNames
} from "@/lib/aigc/node-display-name";
import {
  applyLayerCanvasConfig,
  findUpstreamLayerSet,
  layerCanvasModificationCount,
  layerCanvasSourceIsCurrent
} from "@/lib/aigc/layers";
import {
  jsonParserErrorMessage,
  jsonParserItemCount,
  managedTextSource
} from "@/lib/aigc/json-parser-ui";
import { aigcNodeMinimumSize } from "@/lib/aigc/node-layout";
import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import {
  projectAigcEffectiveText,
  projectAigcImageBboxBinding,
  projectAigcLayerCompositeResult,
  projectAigcModalityRunResult,
  projectAigcVideoResult
} from "@/lib/aigc/result-projection";
import { getAigcNodeLogError } from "@/lib/aigc/run-log";
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
import {
  videoFaceBlurModeLabel,
  videoFaceBlurStrengthLabel
} from "@/lib/aigc/video-face-blur";
import type {
  AigcEdge,
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail,
  AigcResultAsset,
  AigcV2Node
} from "@/lib/aigc/types";
import type { Asset, ReferenceAssetKind } from "@/lib/api-types";
import {
  getAssetContentUrlById,
  getSafeAssetContentUrl,
  getSafePreviewUrl
} from "@/lib/asset-display";
import { SEEDANCE_CAPABILITIES } from "@/lib/seedance";
import { getLayerFrame } from "@/lib/layer-editor-geometry";
import { cn } from "@/lib/utils";

interface AigcFlowNodeData extends Record<string, unknown> {
  node: AigcV2Node;
}

function debugTimestamp() {
  return Date.now();
}

export type AigcFlowNode = Node<
  AigcFlowNodeData,
  AigcV2Node["type"]
>;

function AigcFlowNodeComponent({
  data,
  id,
  selected
}: NodeProps<AigcFlowNode>) {
  const resizeNode = useAigcEditorStore((state) => state.resizeNode);
  const definition = useAigcEditorStore((state) => state.definition);
  const edges = definition.edges;
  const runDetail = useAigcRunProjection(id);
  const layerPreviewRun = useAigcLayerPreviewRun(id);
  const runNode = runDetail?.nodes.find((item) => item.node_id === id);
  const layerCanvasRunDetail =
    data.node.type === "layer_canvas" &&
    runNode?.status !== "succeeded" &&
    layerPreviewRun
      ? layerPreviewRun
      : runDetail;
  const displayName =
    deriveAigcNodeDisplayNames(definition.nodes).get(data.node.id)
      ?.displayName ?? aigcNodeBaseDisplayName(data.node);
  const registration = AIGC_NODE_REGISTRY_BY_TYPE.get(data.node.type);
  const minimumSize = aigcNodeMinimumSize(data.node.type);
  const category = registration?.category ?? "model";
  const inputModalityColors =
    category === "modality"
      ? getAigcModalityColors(registration?.outputs[0]?.type)
      : data.node.type === "video_enhancement" ||
          data.node.type === "video_face_blur"
        ? getAigcModalityColors("video_asset")
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
  const inputAssetId = localMediaAssetId(data.node);
  const modality = modalityNodeType(data.node);
  const currentModalityTitle =
    modality &&
    typeof (data.node.config as { title?: unknown }).title === "string" &&
    (data.node.config as { title: string }).title.trim()
      ? (data.node.config as { title: string }).title.trim()
      : displayName;
  const currentModalityMode =
    modality &&
    edges.some(
      (edge) =>
        edge.targetNodeId === data.node.id &&
        edge.targetHandle === modalityHandle(modality)
    )
      ? "upstream"
      : "local";
  const modalityProjection =
    modality && runDetail
      ? modality === "text"
        ? projectAigcEffectiveText(
            runDetail,
            definition as AigcPipelineDefinitionV2,
            data.node.id
          )
        : projectAigcModalityRunResult(runDetail, data.node.id)
      : null;
  const modalityMode =
    modalityProjection?.mode ?? currentModalityMode;
  const modalityTitle =
    modalityProjection?.title ?? currentModalityTitle;
  const managedSource = managedTextSource(data.node, definition.nodes);
  const videoProjection =
    modality === "video" && modalityProjection && runDetail
      ? projectAigcVideoResult(
          runDetail.run.definition_snapshot,
          data.node.id,
          modalityProjection?.asset ? [modalityProjection.asset] : []
        )
      : null;
  const inputAssetQuery = useQuery({
    enabled: currentModalityMode === "local" && Boolean(inputAssetId),
    queryKey: ["aigc", "input-asset", inputAssetId],
    queryFn: () => apiClient.getAsset(inputAssetId as string)
  });
  const inputAsset =
    inputKind &&
    inputAssetQuery.data &&
    isSelectableMediaAsset(inputAssetQuery.data, inputKind)
      ? inputAssetQuery.data
      : undefined;
  const layerCompositeProjection =
    data.node.type === "layer_composite"
      ? projectAigcLayerCompositeResult(
          definition,
          data.node.id,
          runDetail?.nodes ?? []
        )
      : null;
  const multiTrackProjection =
    data.node.type === "multi_track_edit"
      ? projectAigcVideoResult(
          runDetail?.run.definition_snapshot ?? definition,
          data.node.id,
          runNode?.result.assets ?? []
        )
      : null;
  const modalityDownload =
    modalityProjection?.asset && modality === "audio"
      ? getAigcAudioDownload(modalityProjection.asset, modalityTitle)
      : null;
  const multiTrackDownload = multiTrackProjection
    ? getAigcVideoDownload(
        multiTrackProjection.asset,
        multiTrackProjection.title
      )
    : null;
  const outputDownload = modalityDownload ?? multiTrackDownload;
  const outputTitle = modality
    ? modalityTitle
    : multiTrackProjection?.title ?? "";
  const displayAsset = modalityProjection?.asset;
  const preciseEditAssetId =
    data.node.type !== "image"
      ? null
      : currentModalityMode === "upstream"
        ? displayAsset?.available
          ? displayAsset.asset_id
          : null
        : inputAsset?.id ?? null;
  const preciseEditUrl =
    data.node.type !== "image"
      ? null
      : currentModalityMode === "upstream"
        ? displayAsset?.available
          ? getAssetContentUrlById(displayAsset.asset_id)
          : null
        : inputAsset
          ? getSafePreviewUrl(inputAsset)
          : null;
  const preciseEditName =
    currentModalityMode === "upstream"
      ? assetName(displayAsset?.metadata?.name, modalityTitle)
      : assetName(inputAsset?.metadata.name, "图片输入");
  const imageBboxBinding =
    data.node.type === "image"
      ? projectAigcImageBboxBinding(
          definition as AigcPipelineDefinitionV2,
          data.node.id,
          preciseEditAssetId
        )
      : null;
  const media =
    modality === "image" && modalityProjection
      ? {
          alt: modalityTitle,
          emptyText: modalityStateText(modalityProjection, "image"),
          url:
            displayAsset?.available
              ? getAssetContentUrlById(displayAsset.asset_id)
              : null
        }
      : data.node.type === "image" && currentModalityMode === "local"
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
      : null;

  // #region debug-point A-D:image-node-selection
  const debugDisplayAssetId = displayAsset?.asset_id;
  const debugDisplayAssetAvailable = displayAsset?.available;
  const debugDisplayAssetDownloadUrl = displayAsset?.download_url;
  const debugInputAssetId = inputAsset?.id;
  const debugInputAssetUrl = inputAsset?.url;
  useEffect(() => {
    if (data.node.type !== "image") return;
    fetch("http://127.0.0.1:7777/event", {
      body: JSON.stringify({
        data: {
          currentModalityMode,
          displayAsset: debugDisplayAssetId
            ? {
                assetId: debugDisplayAssetId,
                available: debugDisplayAssetAvailable,
                downloadUrl: debugDisplayAssetDownloadUrl
              }
            : null,
          inputAsset: debugInputAssetId
            ? { id: debugInputAssetId, url: debugInputAssetUrl }
            : null,
          inputAssetId,
          inputQueryStatus: inputAssetQuery.status,
          mediaUrl: media?.url ?? null,
          modalityMode,
          runId: runDetail?.run.id ?? null,
          runStatus: runDetail?.run.status ?? null
        },
        hypothesisId: "A-D",
        location: "aigc-flow-node.tsx:AigcFlowNodeComponent",
        msg: "[DEBUG] Image node selected preview source",
        runId: "post-fix",
        sessionId: "aigc-image-preview-broken",
        traceId: data.node.id,
        ts: debugTimestamp()
      }),
      method: "POST"
    }).catch(() => {});
  }, [
    currentModalityMode,
    data.node.id,
    data.node.type,
    debugDisplayAssetAvailable,
    debugDisplayAssetDownloadUrl,
    debugDisplayAssetId,
    debugInputAssetId,
    debugInputAssetUrl,
    inputAssetId,
    inputAssetQuery.status,
    media?.url,
    modalityMode,
    runDetail?.run.id,
    runDetail?.run.status
  ]);
  // #endregion

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
        minHeight={minimumSize.height}
        minWidth={minimumSize.width}
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
            aria-label={`${port.label}输出${port.system_only ? "，仅系统可连接" : stateText}`}
            className="!h-2.5 !w-2.5 !border-2 !border-card"
            id={port.id}
            isConnectable={!inactive && !port.system_only}
            key={port.id}
            position={Position.Right}
            style={{
              backgroundColor: getAigcModalityColors(port.type).handleColor,
              opacity: inactive ? 0.4 : 1,
              top: `${((index + 1) / (renderedOutputPorts.length + 1)) * 100}%`
            }}
            title={
              port.system_only
                ? `${port.label}输出由系统自动管理`
                : inactive
                ? `${port.label}输出与当前模式或编辑目标不兼容，请断开连线`
                : `${port.label}输出`
            }
            type="source"
          />
        );
      })}

      <div
        className="group/title flex h-7 shrink-0 items-center justify-between px-2.5"
        data-testid="aigc-node-title-row"
      >
        <span
          className="min-w-0 truncate text-[11px] font-medium text-foreground"
          data-testid="aigc-node-title"
        >
          {managedSource?.itemLabel ?? displayName}
        </span>
        <div className="nodrag flex shrink-0 items-center gap-0.5">
          {outputDownload ? (
            <div className="opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-within/title:opacity-100">
              <a
                aria-label={`下载${downloadKindLabel(data.node)}：${outputTitle}`}
                className="nodrag grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-card hover:text-foreground"
                download={outputDownload.filename}
                href={outputDownload.url}
                onClick={(event) => event.stopPropagation()}
                title={`下载${downloadKindLabel(data.node)}`}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}
          {data.node.type === "image" ? (
            <AigcPreciseEditDialog
              assetId={preciseEditAssetId}
              assetName={preciseEditName}
              bboxState={imageBboxBinding?.state ?? "none"}
              node={data.node}
              sourceMode={currentModalityMode}
              url={preciseEditUrl}
            />
          ) : null}
        </div>
      </div>
      {modality === "text" ? (
        <ModalityTextBody
          displayName={modalityTitle}
          managedSource={managedSource}
          mode={modalityMode}
          projection={modalityProjection}
          text={(data.node.config as { text?: string }).text ?? ""}
        />
      ) : modality === "video" && modalityProjection ? (
        <AigcVideoPlayer
          audioState={videoProjection?.audioState}
          bitDepth={videoProjection?.bitDepth}
          fps={videoProjection?.fps}
          initialMetadata={{
            duration:
              resultMetadataNumber(displayAsset, "duration_seconds") ??
              videoProjection?.duration ??
              null,
            height: resultMetadataNumber(displayAsset, "height"),
            width: resultMetadataNumber(displayAsset, "width")
          }}
          key={`${runDetail?.run.id ?? "none"}:${displayAsset?.asset_id ?? "waiting"}`}
          mimeType={displayAsset?.mime_type ?? null}
          name={modalityTitle}
          resolutionLabel={videoProjection?.resolution}
          toolVersion={videoProjection?.toolVersion}
          unavailableText={modalityStateText(modalityProjection, "video")}
          url={
            displayAsset?.available
              ? getSafeAssetContentUrl(displayAsset.download_url)
              : null
          }
        />
      ) : modality === "audio" && modalityProjection ? (
        <AigcAudioPlayer
          duration={resultMetadataNumber(displayAsset, "duration_seconds")}
          key={`${runDetail?.run.id ?? "none"}:${displayAsset?.asset_id ?? "waiting"}`}
          mimeType={displayAsset?.mime_type ?? null}
          name={modalityTitle}
          unavailableText={modalityStateText(modalityProjection, "audio")}
          url={
            displayAsset?.available
              ? getSafeAssetContentUrl(displayAsset.download_url)
              : null
          }
        />
      ) : data.node.type === "video" || data.node.type === "audio" ? (
        <NodeInputMedia
          asset={inputAsset}
          kind={data.node.type}
          key={`${data.node.type}:${inputAssetId ?? "empty"}:${inputAsset?.updated_at ?? "loading"}`}
          loading={inputAssetQuery.isPending}
          referenced={Boolean(inputAssetId)}
        />
      ) : media ? (
        <NodeImageMedia
          alt={media.alt}
          emptyText={media.emptyText}
          hasBbox={
            data.node.type === "image" &&
            imageBboxBinding?.state === "valid"
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
          nodeId={data.node.id}
          projection={layerCompositeProjection}
          status={runNode?.status ?? null}
        />
      ) : data.node.type === "multi_track_edit" ? (
        <MultiTrackEditNodeBody
          node={data.node}
          projection={multiTrackProjection}
          status={runNode?.status ?? null}
        />
      ) : data.node.type === "json_parser" ? (
        <JsonParserNodeBody
          node={data.node}
          runNode={runNode}
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
          {data.node.type === "video_enhancement" ? (
            <VideoEnhancementCostBadges node={data.node} />
          ) : null}
          <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
            {nodeSummary(data.node)}
          </p>
        </div>
      )}
    </div>
  );
}

function ModalityTextBody({
  displayName,
  managedSource,
  mode,
  projection,
  text
}: {
  displayName: string;
  managedSource: ReturnType<typeof managedTextSource>;
  mode: "local" | "upstream";
  projection: ReturnType<typeof projectAigcModalityRunResult>;
  text: string;
}) {
  const visibleText =
    projection?.text ?? (mode === "local" || managedSource ? text : "");
  const stateText =
    projection || mode === "upstream"
      ? modalityStateText(projection, "text")
      : "配置输入文本";
  return (
    <div className="nodrag flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
      {managedSource ? (
        <div className="flex min-w-0 flex-wrap gap-1 text-[9px]">
          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
            只读上游内容
          </span>
          <span
            className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
            title={`来源：${managedSource.parserName}`}
          >
            来源：{managedSource.parserName}
          </span>
        </div>
      ) : null}
      <p className="line-clamp-5 break-words whitespace-pre-wrap text-xs leading-5 text-foreground">
        {visibleText || stateText}
      </p>
      {mode === "upstream" && visibleText ? (
        <button
          aria-label={`复制文本：${displayName}`}
          className="mt-auto inline-flex h-7 items-center justify-center gap-1.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            void navigator.clipboard.writeText(visibleText);
          }}
          type="button"
        >
          <Copy className="h-3 w-3" />
          复制
        </button>
      ) : null}
    </div>
  );
}

function JsonParserNodeBody({
  node,
  runNode
}: {
  node: Extract<AigcV2Node, { type: "json_parser" }>;
  runNode: AigcPipelineRunDetail["nodes"][number] | undefined;
}) {
  const count = jsonParserItemCount(runNode);
  const error = getAigcNodeLogError(
    runNode ?? {
      attempts: [],
      current_task_id: null,
      error: null,
      status: "idle"
    }
  );
  const errorMessage = jsonParserErrorMessage(error);
  const status = runNode ? parserStatusLabel(runNode.status) : "未运行";
  const failed = runNode?.status === "failed" || runNode?.status === "timed_out";

  return (
    <div className="nodrag flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 text-[10px]">
      <div className="rounded border border-border bg-background px-2 py-1.5">
        <p className="text-muted-foreground">JSONPath</p>
        <p
          className="mt-0.5 truncate font-mono text-xs text-foreground"
          title={node.config.json_path}
        >
          {node.config.json_path}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-medium",
            failed
              ? "bg-destructive/10 text-destructive"
              : runNode?.status === "succeeded" || runNode?.status === "reused"
                ? "bg-success/10 text-success"
                : "bg-muted text-muted-foreground"
          )}
        >
          {status}
        </span>
        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-medium text-blue-400">
          {count === null ? "等待 item" : `${count} 项`}
        </span>
      </div>
      {error ? (
        <div className="min-h-0 overflow-hidden border-l-2 border-destructive pl-2">
          <p className="break-all font-mono text-[9px] text-destructive">
            {error.code ?? "json_parser_failed"}
          </p>
          <p className="mt-1 line-clamp-3 break-words text-destructive">
            {errorMessage}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function parserStatusLabel(
  status: AigcPipelineRunDetail["nodes"][number]["status"]
): string {
  return {
    blocked: "阻塞",
    canceled: "已取消",
    failed: "失败",
    idle: "未运行",
    queued: "排队中",
    ready: "就绪",
    reused: "已复用",
    running: "解析中",
    succeeded: "已完成",
    timed_out: "超时"
  }[status];
}

function LayerCompositeNodeBody({
  nodeId,
  projection,
  status
}: {
  nodeId: string;
  projection: ReturnType<typeof projectAigcLayerCompositeResult>;
  status: AigcPipelineRunDetail["nodes"][number]["status"] | null;
}) {
  const mode = useAigcEditorStore((state) => state.mode);
  const runActions = useAigcRunActions();
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
      <div className="space-y-1 border-t border-border pt-2 text-muted-foreground">
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
      {mode === "pipeline" && runActions ? (
        <div
          className="mt-auto shrink-0 border-t border-border pt-2"
          data-testid="layer-composite-actions"
        >
          <ContinueFromLayerNodeButton
            nodeId={nodeId}
            nodeLabel="图层合成"
            runActions={runActions}
          />
        </div>
      ) : null}
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
  node: Extract<AigcV2Node, { type: "layer_canvas" }>;
  runDetail: AigcPipelineRunDetail | null | undefined;
}) {
  const runActions = useAigcRunActions();
  const pipelineId = useAigcEditorStore((state) => state.entityId);
  const mode = useAigcEditorStore((state) => state.mode);
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
      <div
        className={cn(
          "mt-auto grid shrink-0 gap-2 border-t border-border pt-2",
          href && runActions ? "grid-cols-2" : "grid-cols-1"
        )}
        data-testid="layer-canvas-actions"
      >
        {href ? (
          <Link
            className="inline-flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-accent hover:text-accent-foreground"
            href={href}
            onClick={(event) => {
              event.stopPropagation();
              if (!runActions) return;
              event.preventDefault();
              runActions.openLayerEditor(href);
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Pencil className="h-3 w-3 shrink-0" />
            打开图层编辑器
          </Link>
        ) : (
          <span className="text-center text-[10px] text-muted-foreground">
            Pipeline 实例中可编辑
          </span>
        )}
        {mode === "pipeline" && runActions ? (
          <ContinueFromLayerNodeButton
            nodeId={node.id}
            nodeLabel="图层画布"
            runActions={runActions}
          />
        ) : null}
      </div>
    </div>
  );
}

function MultiTrackEditNodeBody({
  node,
  projection,
  status
}: {
  node: Extract<AigcV2Node, { type: "multi_track_edit" }>;
  projection: ReturnType<typeof projectAigcVideoResult> | null;
  status: AigcPipelineRunDetail["nodes"][number]["status"] | null;
}) {
  const dirty = useAigcEditorStore((state) => state.dirty);
  const mode = useAigcEditorStore((state) => state.mode);
  const pipelineId = useAigcEditorStore((state) => state.entityId);
  const runActions = useAigcRunActions();
  const tracks = projection?.trackCount ?? node.config.tracks.length;
  const elements =
    projection?.elementCount ??
    node.config.tracks.reduce(
      (count, track) => count + track.elements.length,
      0
    );
  const durationMs =
    projection?.duration === null || projection?.duration === undefined
      ? node.config.tracks.reduce(
          (duration, track) =>
            track.elements.reduce(
              (trackDuration, element) =>
                Math.max(trackDuration, element.target_time.end_ms),
              duration
            ),
          0
        )
      : projection.duration * 1_000;
  const canvas = projection?.resolution
    ? projection.resolution.replace("x", " × ")
    : node.config.canvas.mode === "custom"
      ? `${node.config.canvas.width} × ${node.config.canvas.height}`
      : "自动画布";
  const resultUrl =
    projection?.asset?.available
      ? getSafeAssetContentUrl(projection.asset.download_url)
      : null;
  const href =
    mode === "pipeline" && pipelineId
      ? (`/workspace/aigc/pipelines/${pipelineId}/nodes/${node.id}/timeline` as Route)
      : null;

  return (
    <div className="nodrag flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 text-[10px]">
      {projection?.asset ? (
        <AigcVideoPlayer
          fps={projection.fps}
          initialMetadata={{
            duration: projection.duration,
            height: resultMetadataNumber(projection.asset, "height"),
            width: resultMetadataNumber(projection.asset, "width")
          }}
          mimeType={projection.asset.mime_type}
          name={projection.title}
          resolutionLabel={projection.resolution}
          unavailableText="多轨成片已不可用"
          url={resultUrl}
        />
      ) : null}
      <div className="grid grid-cols-3 gap-1 text-center">
        <span className="rounded border border-border bg-background px-1 py-1">
          {tracks} 轨道
        </span>
        <span className="rounded border border-border bg-background px-1 py-1">
          {elements} 元素
        </span>
        <span className="rounded border border-border bg-background px-1 py-1">
          {formatTimelineDuration(durationMs)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span>{canvas}</span>
        <span>{projection?.fps ?? node.config.output.fps} FPS</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <span>{dirty ? "未保存" : "已保存"}</span>
        <span>{multiTrackRunStatusLabel(status)}</span>
      </div>
      {href ? (
        <Link
          className="mt-auto inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-accent hover:text-accent-foreground"
          href={href}
          onClick={(event) => {
            event.stopPropagation();
            if (!runActions) return;
            event.preventDefault();
            runActions.openLayerEditor(href);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Pencil className="h-3 w-3" />
          编辑时间线
        </Link>
      ) : (
        <span className="mt-auto text-center text-muted-foreground">
          Pipeline 实例中可编辑
        </span>
      )}
    </div>
  );
}

function formatTimelineDuration(durationMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, durationMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function multiTrackRunStatusLabel(
  status: AigcPipelineRunDetail["nodes"][number]["status"] | null
): string {
  if (!status) return "未运行";
  const labels: Record<
    AigcPipelineRunDetail["nodes"][number]["status"],
    string
  > = {
    idle: "未运行",
    ready: "等待执行",
    queued: "排队中",
    running: "运行中",
    succeeded: "运行成功",
    failed: "运行失败",
    timed_out: "运行超时",
    canceled: "已取消",
    blocked: "已阻止",
    reused: "缓存复用"
  };
  return labels[status];
}

function ContinueFromLayerNodeButton({
  nodeId,
  nodeLabel,
  runActions
}: {
  nodeId: string;
  nodeLabel: "图层合成" | "图层画布";
  runActions: NonNullable<ReturnType<typeof useAigcRunActions>>;
}) {
  const pending = runActions.pendingForNode(nodeId);
  return (
    <button
      aria-label="从此节点继续"
      className="inline-flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        runActions.continueFromNode(nodeId);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      title={`复用可用的上游结果，从${nodeLabel}节点重新执行当前节点及下游`}
      type="button"
    >
      <Play className="h-3 w-3 shrink-0" />
      {pending ? "正在执行" : "从此节点继续"}
    </button>
  );
}

function VideoGenerationSummary({
  edges,
  node
}: {
  edges: AigcEditorState["definition"]["edges"];
  node: Extract<AigcV2Node, { type: "video_generation" }>;
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
                // #region debug-point B-C:image-load
                fetch("http://127.0.0.1:7777/event", {
                  body: JSON.stringify({
                    data: {
                      alt,
                      currentSrc: image.currentSrc,
                      naturalHeight: image.naturalHeight,
                      naturalWidth: image.naturalWidth,
                      url
                    },
                    hypothesisId: "B-C",
                    location: "aigc-flow-node.tsx:NodeImageMedia:onLoad",
                    msg: "[DEBUG] Image preview loaded",
                    runId: "post-fix",
                    sessionId: "aigc-image-preview-broken",
                    traceId: alt,
                    ts: Date.now()
                  }),
                  method: "POST"
                }).catch(() => {});
                // #endregion
                if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                  setDimensions({
                    height: image.naturalHeight,
                    url,
                    width: image.naturalWidth
                  });
                }
              }}
              onError={(event) => {
                const image = event.currentTarget;
                // #region debug-point A-D:image-error
                fetch("http://127.0.0.1:7777/event", {
                  body: JSON.stringify({
                    data: {
                      alt,
                      currentSrc: image.currentSrc,
                      url
                    },
                    hypothesisId: "A-D",
                    location: "aigc-flow-node.tsx:NodeImageMedia:onError",
                    msg: "[DEBUG] Image preview failed",
                    runId: "post-fix",
                    sessionId: "aigc-image-preview-broken",
                    traceId: alt,
                    ts: Date.now()
                  }),
                  method: "POST"
                }).catch(() => {});
                // #endregion
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

function modalityNodeType(
  node: AigcV2Node
): "audio" | "image" | "text" | "video" | null {
  const type = node.type as string;
  return type === "audio" ||
    type === "image" ||
    type === "text" ||
    type === "video"
    ? type
    : null;
}

function modalityHandle(
  modality: "audio" | "image" | "text" | "video"
): string {
  return modality;
}

function modalityStateText(
  projection: ReturnType<typeof projectAigcModalityRunResult>,
  modality: "audio" | "image" | "text" | "video"
): string {
  const label = {
    audio: "音频",
    image: "图片",
    text: "文本",
    video: "视频"
  }[modality];
  if (!projection || ["idle", "ready", "queued", "running"].includes(projection.status)) {
    return `等待上游${label}结果`;
  }
  if (
    ["blocked", "canceled", "failed", "timed_out"].includes(
      projection.status
    )
  ) {
    return `上游${label}生成失败`;
  }
  if (!projection.available && modality !== "text") {
    return `上游${label}结果不可用`;
  }
  return `等待上游${label}结果`;
}

function resultMetadataNumber(
  asset: AigcResultAsset | undefined,
  key: string
): number | null {
  const value = asset?.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function downloadKindLabel(node: AigcV2Node): "图片" | "视频" | "音频" {
  if (node.type === "audio") return "音频";
  if (node.type === "video" || node.type === "multi_track_edit") return "视频";
  return "图片";
}

function mediaInputKind(node: AigcV2Node): ReferenceAssetKind | null {
  if (node.type === "image") return "image";
  if (node.type === "video") return "video";
  if (node.type === "audio") return "audio";
  return null;
}

function localMediaAssetId(node: AigcV2Node): string | null {
  if (mediaInputKind(node) === null) return null;
  const assetId = (node.config as { asset_id?: unknown }).asset_id;
  return typeof assetId === "string" ? assetId : null;
}

function assetName(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nodeSummary(node: AigcV2Node): string {
  if (node.type === "text") {
    const config = node.config as {
      bbox_references?: readonly unknown[];
      text?: string;
    };
    const referenceCount = config.bbox_references?.length ?? 0;
    const text = config.text || "配置输入文本";
    return referenceCount > 0
      ? `${text} · ${referenceCount} 个区域引用`
      : text;
  }
  if (node.type === "image") {
    const assetId = localMediaAssetId(node);
    return assetId ? `资产 ${assetId}` : "选择或上传图片";
  }
  if (
    node.type === "video" ||
    node.type === "audio"
  ) {
    const assetId = localMediaAssetId(node);
    return assetId ? `资产 ${assetId}` : "尚未选择素材";
  }
  if (node.type === "llm") return node.config.model;
  if (node.type === "video_generation") {
    const taskType =
      node.config.generation_mode === "multimodal_reference"
        ? ` · ${node.config.task_type ?? "generate"}`
        : "";
    return `${node.config.model} · ${node.config.generation_mode}${taskType}`;
  }
  if (node.type === "video_enhancement") {
    const resolution =
      node.config.resolution_mode === "preset"
        ? node.config.resolution.toUpperCase()
        : `短边 ${node.config.resolution_limit}px`;
    const version =
      node.config.tool_version === "professional" ? "专业版" : "标准版";
    const fps = node.config.fps === null ? "原帧率" : `${node.config.fps} FPS`;
    const style = node.config.enhance_style === "hd" ? "高清" : "自然";
    return `${version} · ${resolution} · ${fps} · ${style}`;
  }
  if (node.type === "video_face_blur") {
    return `${videoFaceBlurModeLabel(node.config.mask_mode)} · ${videoFaceBlurStrengthLabel(node.config.mask_strength)}`;
  }
  if (node.type === "multi_track_edit") return "多轨剪辑工程";
  if (node.type === "json_parser") return node.config.json_path;
  if (node.type === "layer_canvas") {
    return node.config.selected_layer_id
      ? `已选择图层 ${node.config.selected_layer_id}`
      : "尚未选择图层";
  }
  if (node.type === "layer_composite") return "替换指定图层并合成图片";
  if (node.type === "image_to_image") {
    return `${seedreamImageTitle(node)} · ${node.config.model} · ${node.config.size}`;
  }
  return `${node.config.model} · ${node.config.aspect_ratio} · ${node.config.size}`;
}

function VideoEnhancementCostBadges({
  node
}: {
  node: Extract<AigcV2Node, { type: "video_enhancement" }>;
}) {
  const labels = [
    node.config.tool_version === "professional" ? "高成本 · 专业版" : null,
    node.config.resolution_mode === "preset" &&
    (node.config.resolution === "4k" || node.config.resolution === "8k")
      ? `高成本 · ${node.config.resolution.toUpperCase()}`
      : null,
    node.config.bit_depth >= 12
      ? `高成本 · ${node.config.bit_depth}-bit`
      : null
  ].filter((label): label is string => Boolean(label));

  if (labels.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-1" aria-label="高成本配置">
      {labels.map((label) => (
        <span
          className="rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[9px] font-semibold text-orange-900"
          key={label}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export const AigcFlowNodeCard = memo(AigcFlowNodeComponent);
