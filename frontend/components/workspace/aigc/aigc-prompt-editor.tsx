"use client";

import { useQueries } from "@tanstack/react-query";
import { LoaderCircle, WandSparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import {
  AIGC_COORDINATE_TAG_PATTERN,
  bboxReferences,
  isBboxReferencePaused
} from "@/lib/aigc/bbox-references";
import { deriveAigcNodeDisplayNames } from "@/lib/aigc/node-display-name";
import {
  useAigcEditorStore,
  useAigcEditorStoreApi
} from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import { useAigcRunProjection } from "@/components/workspace/aigc/aigc-run-context";
import {
  projectAigcEffectiveText,
  projectAigcImageBboxBinding,
  projectAigcModalityRunResult
} from "@/lib/aigc/result-projection";
import { SEEDANCE_DEFAULT_TASK_TYPE } from "@/lib/seedance";
import type {
  AigcPromptOptimizeRequest,
  AigcPipelineDefinitionV2,
  AigcPipelineRunDetail,
  AigcV2Node,
  TextConfig
} from "@/lib/aigc/types";

const MAX_INSTRUCTION_CODE_POINTS = 4000;
const MAX_DIRECTION_CODE_POINTS = 2000;

export function AigcPromptEditor({
  node,
  runDetail: runDetailProp
}: {
  node: Extract<AigcV2Node, { type: "text" }>;
  runDetail?: AigcPipelineRunDetail | null;
}) {
  const definition = useAigcEditorStore((state) => state.definition);
  const store = useAigcEditorStoreApi();
  const runContext = useAigcRunProjection(node.id);
  const runDetail =
    runDetailProp !== undefined ? runDetailProp : runContext;
  const graphDefinition =
    definition as unknown as AigcPipelineDefinitionV2;
  const currentNode = graphDefinition.nodes.find(
    (
      candidate
    ): candidate is Extract<AigcV2Node, { type: "text" }> =>
      candidate.id === node.id && candidate.type === "text"
  );
  const activeNode = currentNode ?? node;
  const update = useAigcEditorStore((state) => state.updateNodeConfig);
  const applyOptimizedPrompt = useAigcEditorStore(
    (state) => state.applyOptimizedTextPrompt
  );
  const updateInstruction = useAigcEditorStore(
    (state) => state.updateBboxReferenceInstruction
  );
  const removeReference = useAigcEditorStore(
    (state) => state.removeBboxReference
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );
  const [optimizationMessage, setOptimizationMessage] = useState<{
    kind: "error" | "info" | "success";
    text: string;
  } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [direction, setDirection] = useState("");
  const [targetNodeId, setTargetNodeId] = useState("");
  const mountedRef = useRef(true);
  const runDetailRef = useRef(runDetail);
  const optimizationAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    runDetailRef.current = runDetail;
  }, [runDetail]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      optimizationAbortRef.current?.abort();
    };
  }, []);
  const references = bboxReferences(activeNode);
  const displayNames = deriveAigcNodeDisplayNames(graphDefinition.nodes);
  const sources = references.map((reference) =>
    graphDefinition.nodes.find(
      (candidate) => candidate.id === reference.source_node_id
    )
  );
  const sourceBboxBindings = sources.map((source) => {
    if (source?.type !== "image") return null;
    const usesUpstream = graphDefinition.edges.some(
      (edge) =>
        edge.targetNodeId === source.id && edge.targetHandle === "image"
    );
    const projection = runDetail
      ? projectAigcModalityRunResult(runDetail, source.id)
      : null;
    const effectiveAssetId = usesUpstream
      ? projection?.asset?.available
        ? projection.asset.asset_id
        : null
      : source.config.asset_id;
    return projectAigcImageBboxBinding(
      graphDefinition,
      source.id,
      effectiveAssetId
    );
  });
  // #region debug-point A-D:reference-resolution
  useEffect(() => {
    fetch("http://127.0.0.1:7778/event", {
      body: JSON.stringify({
        data: {
          definitionNodeIds: graphDefinition.nodes.map((candidate) => candidate.id),
          references: references.map((reference, index) => {
            const source = sources[index];
            return {
              bbox: source?.type === "image" ? source.config.bbox : null,
              bboxAssetId:
                source?.type === "image" ? source.config.bbox_asset_id : null,
              bindingState: sourceBboxBindings[index]?.state ?? null,
              effectiveBbox: sourceBboxBindings[index]?.bbox ?? null,
              incomingEdges: graphDefinition.edges.filter(
                (edge) => edge.targetNodeId === reference.source_node_id
              ),
              sourceExists: Boolean(source),
              sourceNodeId: reference.source_node_id,
              sourceType: source?.type ?? null,
              upstreamBbox:
                source?.type === "image" ? source.config.upstream_bbox : null,
              upstreamBboxAssetId:
                source?.type === "image"
                  ? source.config.upstream_bbox_asset_id
                  : null
            };
          }),
          textNodeId: activeNode.id
        },
        hypothesisId: "A-D",
        location: "aigc-prompt-editor.tsx:AigcPromptEditor",
        msg: "[DEBUG] Resolved bbox prompt references",
        runId: "post-fix",
        sessionId: "bbox-reference-invalid",
        traceId: activeNode.id
      }),
      method: "POST"
    }).catch(() => {});
  }, [
    activeNode.id,
    graphDefinition.edges,
    graphDefinition.nodes,
    references,
    sourceBboxBindings,
    sources
  ]);
  // #endregion
  const assetIds = sources.map((source) =>
    source?.type === "image" ? source.config.asset_id : null
  );
  const assetQueries = useQueries({
    queries: assetIds.map((assetId) => ({
      enabled: Boolean(assetId),
      queryFn: () => apiClient.getAsset(assetId as string),
      queryKey: ["aigc", "image-asset", assetId]
    }))
  });
  const upstream = graphDefinition.edges.some(
    (edge) =>
      edge.targetNodeId === activeNode.id && edge.targetHandle === "text"
  );
  const effectiveProjection =
    upstream && runDetail
      ? projectAigcEffectiveText(runDetail, graphDefinition, activeNode.id)
      : null;
  const effectiveText = upstream
    ? (effectiveProjection?.text ?? "")
    : activeNode.config.text;
  const targets = promptOptimizationTargets(graphDefinition, activeNode.id);
  const canEditText =
    !upstream ||
    Boolean(
      effectiveProjection &&
        ["reused", "succeeded"].includes(effectiveProjection.status) &&
        effectiveProjection.text !== null
    );
  const canOptimize =
    targets.length > 0 &&
    Boolean(
      effectiveText.trim() ||
        references.some((reference) => reference.instruction.trim())
    );

  function updateText(value: string) {
    if (AIGC_COORDINATE_TAG_PATTERN.test(value)) {
      setValidationMessage("坐标标签由框选生成，不能手工输入。");
      return;
    }
    setValidationMessage(null);
    setOptimizationMessage(null);
    update(activeNode.id, {
      ...activeNode.config,
      ...(upstream
        ? { upstream_text_override: value }
        : { text: value })
    });
  }

  function updateReferenceInstruction(sourceNodeId: string, value: string) {
    if (AIGC_COORDINATE_TAG_PATTERN.test(value)) {
      setValidationMessage("坐标标签由框选生成，不能手工输入。");
      return;
    }
    setValidationMessage(null);
    setOptimizationMessage(null);
    updateInstruction(
      activeNode.id,
      sourceNodeId,
      truncateCodePoints(value, MAX_INSTRUCTION_CODE_POINTS)
    );
  }

  function openOptimizationDialog() {
    if (!canOptimize) return;
    setTargetNodeId((current) =>
      targets.some((target) => target.id === current)
        ? current
        : (targets[0]?.id ?? "")
    );
    setOptimizationMessage(null);
    setDialogOpen(true);
  }

  async function optimizePrompt() {
    const selectedTarget = targets.find(
      (target) => target.id === targetNodeId
    );
    if (!canOptimize || !selectedTarget || isOptimizing) return;
    const expected: TextConfig = {
      bbox_references: references.map((reference) => ({ ...reference })),
      text: activeNode.config.text,
      title: activeNode.config.title,
      upstream_text_override:
        activeNode.config.upstream_text_override ?? null
    };
    const request = buildPromptOptimizationRequest(
      graphDefinition,
      selectedTarget.node,
      effectiveText,
      direction,
      references.map((reference) => reference.instruction)
    );
    const requestSnapshot = promptOptimizationSnapshot(
      graphDefinition,
      activeNode.id,
      runDetail?.run.id ?? null,
      request,
      expected
    );
    const controller = new AbortController();
    optimizationAbortRef.current?.abort();
    optimizationAbortRef.current = controller;
    setIsOptimizing(true);
    setOptimizationMessage(null);
    setValidationMessage(null);
    try {
      const result = await apiClient.optimizeAigcPrompt(request, {
        signal: controller.signal
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      const latestDefinition = store.getState()
        .definition as AigcPipelineDefinitionV2;
      const latestNode = latestDefinition.nodes.find(
        (candidate) => candidate.id === activeNode.id
      );
      const latestTarget = latestDefinition.nodes.find(
        (candidate) => candidate.id === selectedTarget.id
      );
      if (
        latestNode?.type !== "text" ||
        !latestTarget ||
        promptOptimizationSnapshot(
          latestDefinition,
          activeNode.id,
          runDetailRef.current?.run.id ?? null,
          buildPromptOptimizationRequest(
            latestDefinition,
            latestTarget,
            effectiveTextForSnapshot(
              latestDefinition,
              latestNode,
              runDetailRef.current
            ),
            direction,
            bboxReferences(latestNode).map(
              (reference) => reference.instruction
            )
          ),
          latestNode.config
        ) !== requestSnapshot
      ) {
        setOptimizationMessage({
          kind: "info",
          text: "文本、Run、目标配置或连线已变化，本次优化结果未应用。"
        });
        return;
      }
      const status = applyOptimizedPrompt(
        activeNode.id,
        expected,
        result.optimized_text,
        result.optimized_reference_instructions,
        request.target_type === "text_to_image" ||
          request.target_type === "image_to_image"
      );
      if (status === "stale") {
        setOptimizationMessage({
          kind: "info",
          text: "提示词已发生变化，本次优化结果未应用，请重新优化。"
        });
      } else if (status === "unchanged") {
        setOptimizationMessage({
          kind: "info",
          text: "当前提示词无需调整。"
        });
      } else {
        setOptimizationMessage({
          kind: "success",
          text: "提示词已优化，可撤销恢复。"
        });
        setDialogOpen(false);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setOptimizationMessage({
        kind: "error",
        text: getUserFacingErrorMessage(error)
      });
    } finally {
      if (optimizationAbortRef.current === controller) {
        optimizationAbortRef.current = null;
        if (mountedRef.current) setIsOptimizing(false);
      }
    }
  }

  function cancelOptimization() {
    const controller = optimizationAbortRef.current;
    optimizationAbortRef.current = null;
    controller?.abort();
    setIsOptimizing(false);
    setOptimizationMessage({
      kind: "info",
      text: "已取消优化。"
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`node-text-${activeNode.id}`}>基础文本</Label>
        <div className="flex items-center gap-2">
          {references.length > 0 ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              {references.length}/10
            </span>
          ) : null}
          <Button
            aria-label="优化提示词"
            disabled={!canOptimize || isOptimizing}
            onClick={openOptimizationDialog}
            size="sm"
            title={
              targets.length === 0
                ? "请先连接 LLM、生图或生视频目标节点"
                : "根据目标模型优化提示词"
            }
            type="button"
            variant="outline"
          >
            {isOptimizing ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <WandSparkles className="h-3.5 w-3.5" />
            )}
            {isOptimizing ? "优化中" : "优化提示词"}
          </Button>
        </div>
      </div>
      <div
        aria-label="提示词编辑面"
        className="max-h-96 overflow-y-auto rounded-lg border border-input bg-card shadow-sm transition focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/15"
        role="group"
      >
        <Textarea
          className="min-h-24 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
          disabled={isOptimizing || !canEditText}
          id={`node-text-${activeNode.id}`}
          onChange={(event) => updateText(event.target.value)}
          value={effectiveText}
        />
        {references.length > 0 ? (
          <div className="space-y-2 border-t border-border/70 p-2">
            {references.map((reference, index) => {
              const source = sources[index];
              const binding = sourceBboxBindings[index];
              const bbox = binding?.state === "valid" ? binding.bbox : null;
              const sourceLabel =
                source?.type === "image"
                  ? (displayNames.get(reference.source_node_id)?.displayName ??
                    "图片节点")
                  : "失效图片节点";
              const paused = isBboxReferencePaused(
                graphDefinition,
                reference.source_node_id,
                activeNode.id
              );
              const coordinates = bbox
                ? `bbox ${bbox.x1} ${bbox.y1} ${bbox.x2} ${bbox.y2}`
                : null;
              const assetQuery = assetQueries[index];
              const status =
                !source || !bbox
                  ? "引用来源已失效"
                  : paused
                    ? "已暂停"
                  : assetQuery?.isPending
                    ? "素材加载中"
                    : assetQuery?.isError
                      ? "缩略图加载失败"
                      : null;
              return (
                <div className="space-y-1.5" key={reference.source_node_id}>
                  <div
                    aria-label={`BBox 引用：${sourceLabel}，${coordinates ?? "引用来源已失效"}`}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    role="group"
                    tabIndex={0}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {sourceLabel}
                    </span>
                    {coordinates ? (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {coordinates}
                      </span>
                    ) : null}
                    {status ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {status}
                      </span>
                    ) : null}
                    <button
                      aria-label={`移除框选引用：${sourceLabel}`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                      disabled={isOptimizing}
                      onClick={() =>
                        removeReference(activeNode.id, reference.source_node_id)
                      }
                      title={`移除框选引用：${sourceLabel}`}
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Textarea
                    aria-label={`框选引用说明：${sourceLabel}`}
                    className="min-h-14 resize-y border-0 bg-transparent px-2 py-1.5 text-xs shadow-none focus-visible:ring-0"
                    disabled={isOptimizing}
                    onChange={(event) =>
                      updateReferenceInstruction(
                        reference.source_node_id,
                        event.target.value
                      )
                    }
                    placeholder="描述如何使用这个框选主体"
                    value={reference.instruction}
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      {validationMessage ? (
        <p className="text-xs text-destructive" role="alert">
          {validationMessage}
        </p>
      ) : null}
      {optimizationMessage ? (
        <p
          className={
            optimizationMessage.kind === "error"
              ? "text-xs text-destructive"
              : optimizationMessage.kind === "success"
                ? "text-xs text-success"
                : "text-xs text-muted-foreground"
          }
          role={optimizationMessage.kind === "error" ? "alert" : "status"}
        >
          {optimizationMessage.text}
        </p>
      ) : null}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!isOptimizing) setDialogOpen(open);
        }}
      >
        <DialogContent
          className="border-[#343a43] bg-[#171a1f] text-zinc-100 sm:max-w-xl [&_label]:text-zinc-200"
          closeButtonClassName="border-[#3d444e] bg-[#20242a] text-zinc-400 hover:bg-[#2a3038] hover:text-zinc-100"
          hideCloseButton={isOptimizing}
          onEscapeKeyDown={(event) => {
            if (isOptimizing) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isOptimizing) event.preventDefault();
          }}
        >
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="text-zinc-100">优化提示词</DialogTitle>
            <DialogDescription className="text-zinc-400">
              选择直接下游目标，优化结果将写回当前文本节点。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto px-5 py-2">
            <div>
              <Label>当前文本</Label>
              <p className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border border-[#343a43] bg-[#101318] px-3 py-2 text-xs leading-5 text-zinc-400">
                {effectiveText || "（空）"}
              </p>
            </div>
            <div>
              <Label htmlFor={`prompt-target-${activeNode.id}`}>
                目标模型
              </Label>
              <select
                aria-label="目标模型"
                className="mt-1.5 h-9 w-full rounded-md border border-[#343a43] bg-[#101318] px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-primary/35 disabled:opacity-50"
                disabled={isOptimizing}
                id={`prompt-target-${activeNode.id}`}
                onChange={(event) => setTargetNodeId(event.target.value)}
                value={targetNodeId}
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`prompt-direction-${activeNode.id}`}>
                优化方向
              </Label>
              <Textarea
                className="mt-1.5 min-h-24 border-[#343a43] bg-[#101318] text-zinc-100 placeholder:text-zinc-600"
                disabled={isOptimizing}
                id={`prompt-direction-${activeNode.id}`}
                maxLength={MAX_DIRECTION_CODE_POINTS}
                onChange={(event) =>
                  setDirection(
                    truncateCodePoints(
                      event.target.value,
                      MAX_DIRECTION_CODE_POINTS
                    )
                  )
                }
                placeholder="可选，例如：强化镜头节奏，保持品牌文字不变"
                value={direction}
              />
            </div>
            {optimizationMessage?.kind === "error" ? (
              <p className="text-xs text-destructive" role="alert">
                {optimizationMessage.text}
              </p>
            ) : null}
          </div>
          <DialogFooter className="border-t border-[#343a43] px-5 py-4">
            <Button
              className="border-[#3d444e] bg-[#20242a] text-zinc-200 hover:bg-[#2a3038]"
              onClick={() =>
                isOptimizing
                  ? cancelOptimization()
                  : setDialogOpen(false)
              }
              type="button"
              variant="outline"
            >
              {isOptimizing ? "取消优化" : "取消"}
            </Button>
            <Button
              disabled={isOptimizing || !targetNodeId}
              onClick={() => void optimizePrompt()}
              type="button"
            >
              {isOptimizing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="h-4 w-4" />
              )}
              {isOptimizing ? "优化中" : "开始优化"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PromptOptimizationTarget {
  id: string;
  displayName: string;
  node: Extract<
    AigcV2Node,
    { type: "llm" | "text_to_image" | "image_to_image" | "video_generation" }
  >;
}

function promptOptimizationTargets(
  definition: AigcPipelineDefinitionV2,
  textNodeId: string
): PromptOptimizationTarget[] {
  const displayNames = deriveAigcNodeDisplayNames(definition.nodes);
  return definition.edges
    .filter(
      (edge) =>
        edge.sourceNodeId === textNodeId &&
        edge.sourceHandle === "text" &&
        edge.targetHandle === "prompt"
    )
    .map((edge) =>
      definition.nodes.find((node) => node.id === edge.targetNodeId)
    )
    .filter(
      (
        target
      ): target is Extract<
        AigcV2Node,
        {
          type:
            | "llm"
            | "text_to_image"
            | "image_to_image"
            | "video_generation";
        }
      > =>
        target?.type === "llm" ||
        target?.type === "text_to_image" ||
        target?.type === "image_to_image" ||
        target?.type === "video_generation"
    )
    .map((node) => ({
      displayName: displayNames.get(node.id)?.displayName ?? node.type,
      id: node.id,
      node
    }));
}

function buildPromptOptimizationRequest(
  definition: AigcPipelineDefinitionV2,
  target: AigcV2Node,
  text: string,
  optimizationDirection: string,
  referenceInstructions: string[]
): AigcPromptOptimizeRequest {
  const common = {
    optimization_direction: optimizationDirection,
    target_node_id: target.id,
    text
  };
  if (target.type === "llm") {
    return {
      ...common,
      reference_instructions: [],
      target_config: {
        model: target.config.model,
        system_prompt: target.config.system_prompt
      },
      target_type: "llm"
    };
  }
  if (target.type === "text_to_image") {
    return {
      ...common,
      reference_instructions: referenceInstructions,
      target_config: {
        aspect_ratio: target.config.aspect_ratio,
        model: target.config.model,
        reference_image_count: 0,
        size: target.config.size
      },
      target_type: "text_to_image"
    };
  }
  if (target.type === "image_to_image") {
    return {
      ...common,
      reference_instructions: referenceInstructions,
      target_config: {
        aspect_ratio: target.config.aspect_ratio,
        model: target.config.model,
        operation: target.config.operation ?? "image_to_image",
        reference_image_count: definition.edges.filter(
          (edge) =>
            edge.targetNodeId === target.id && edge.targetHandle === "image"
        ).length,
        size: target.config.size
      },
      target_type: "image_to_image"
    };
  }
  if (target.type !== "video_generation") {
    throw new Error("unsupported prompt optimization target");
  }
  const handleOrder = [
    "first_frame",
    "last_frame",
    "reference_images",
    "reference_videos",
    "reference_audios"
  ] as const;
  const roleByHandle = {
    first_frame: "first_frame",
    last_frame: "last_frame",
    reference_images: "reference_image",
    reference_videos: "reference_video",
    reference_audios: "reference_audio"
  } as const;
  const mediaByHandle = {
    first_frame: "image",
    last_frame: "image",
    reference_images: "image",
    reference_videos: "video",
    reference_audios: "audio"
  } as const;
  const references = handleOrder.flatMap((targetHandle) =>
    definition.edges
      .filter(
        (edge) =>
          edge.targetNodeId === target.id &&
          edge.targetHandle === targetHandle
      )
      .map((edge, index) => ({
        media_type: mediaByHandle[targetHandle],
        ordinal: index + 1,
        role: roleByHandle[targetHandle],
        source_handle: mediaByHandle[targetHandle],
        source_node_id: edge.sourceNodeId,
        target_handle: targetHandle
      }))
  );
  return {
    ...common,
    reference_instructions: [],
    target_config: {
      aspect_ratio: target.config.aspect_ratio,
      duration_seconds: target.config.duration_seconds,
      generate_audio: target.config.generate_audio,
      generation_mode: target.config.generation_mode,
      model: target.config.model,
      references,
      task_type: target.config.task_type ?? SEEDANCE_DEFAULT_TASK_TYPE
    },
    target_type: "video_generation"
  };
}

function promptOptimizationSnapshot(
  definition: AigcPipelineDefinitionV2,
  textNodeId: string,
  runId: string | null,
  request: AigcPromptOptimizeRequest,
  config: TextConfig
): string {
  return JSON.stringify({
    config: {
      bbox_references: config.bbox_references ?? [],
      text: config.text,
      upstream_text_override: config.upstream_text_override ?? null
    },
    edges: definition.edges.filter(
      (edge) =>
        edge.sourceNodeId === textNodeId ||
        edge.targetNodeId === textNodeId ||
        edge.targetNodeId === request.target_node_id
    ),
    request,
    runId
  });
}

function effectiveTextForSnapshot(
  definition: AigcPipelineDefinitionV2,
  node: Extract<AigcV2Node, { type: "text" }>,
  runDetail: AigcPipelineRunDetail | null
): string {
  const upstream = definition.edges.some(
    (edge) =>
      edge.targetNodeId === node.id && edge.targetHandle === "text"
  );
  if (!upstream) return node.config.text;
  if (node.config.upstream_text_override != null) {
    return node.config.upstream_text_override;
  }
  return runDetail
    ? (projectAigcEffectiveText(runDetail, definition, node.id)?.text ?? "")
    : "";
}

function truncateCodePoints(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}
