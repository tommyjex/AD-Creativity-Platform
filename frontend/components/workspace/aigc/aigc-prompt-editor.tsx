"use client";

import { useQueries } from "@tanstack/react-query";
import { Expand, LoaderCircle, WandSparkles, X } from "lucide-react";
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
import { resolvePromptOptimizationSourceImage } from "@/lib/aigc/prompt-optimization-context";
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
  const [fullscreenEditorOpen, setFullscreenEditorOpen] = useState(false);
  const [fullscreenDraft, setFullscreenDraft] = useState("");
  const [fullscreenOpeningValue, setFullscreenOpeningValue] = useState("");
  const [optimizationOrigin, setOptimizationOrigin] = useState<
    "inspector" | "fullscreen"
  >("inspector");
  const [direction, setDirection] = useState("");
  const [targetNodeId, setTargetNodeId] = useState("");
  const mountedRef = useRef(true);
  const runDetailRef = useRef(runDetail);
  const optimizationAbortRef = useRef<AbortController | null>(null);
  const fullscreenEditorTriggerRef = useRef<HTMLElement | null>(null);
  const fullscreenOpeningValueRef = useRef("");
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
  const selectedOptimizationTarget = targets.find(
    (target) => target.id === targetNodeId
  );
  const showsVideoReferenceMarkerHint =
    selectedOptimizationTarget?.node.type === "video_generation";
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

  function updateText(value: string): boolean {
    if (AIGC_COORDINATE_TAG_PATTERN.test(value)) {
      setValidationMessage("坐标标签由框选生成，不能手工输入。");
      return false;
    }
    setValidationMessage(null);
    setOptimizationMessage(null);
    update(activeNode.id, {
      ...activeNode.config,
      ...(upstream
        ? { upstream_text_override: value }
        : { text: value })
    });
    return true;
  }

  function openFullscreenEditor(trigger: HTMLElement) {
    fullscreenEditorTriggerRef.current = trigger;
    fullscreenOpeningValueRef.current = effectiveText;
    setFullscreenOpeningValue(effectiveText);
    setFullscreenDraft(effectiveText);
    setFullscreenEditorOpen(true);
  }

  function closeFullscreenEditor() {
    setFullscreenEditorOpen(false);
    window.setTimeout(() => {
      fullscreenEditorTriggerRef.current?.focus();
    }, 0);
  }

  function applyFullscreenText(value: string, expectedValue: string): boolean {
    if (effectiveText !== expectedValue) {
      setValidationMessage("提示词内容已变化，请重新打开编辑器后再应用。");
      return false;
    }
    if (value === effectiveText) return true;
    return updateText(value);
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

  function openOptimizationDialog(
    origin: "inspector" | "fullscreen" = "inspector"
  ) {
    const optimizationText =
      origin === "fullscreen" ? fullscreenDraft : effectiveText;
    if (
      targets.length === 0 ||
      !(
        optimizationText.trim() ||
        references.some((reference) => reference.instruction.trim())
      )
    ) {
      return;
    }
    setTargetNodeId((current) =>
      targets.some((target) => target.id === current)
        ? current
        : (targets[0]?.id ?? "")
    );
    setOptimizationOrigin(origin);
    setOptimizationMessage(null);
    setDialogOpen(true);
  }

  async function optimizePrompt() {
    const selectedTarget = targets.find(
      (target) => target.id === targetNodeId
    );
    const sourceText =
      optimizationOrigin === "fullscreen" ? fullscreenDraft : effectiveText;
    const expectedEffectiveText =
      optimizationOrigin === "fullscreen"
        ? fullscreenOpeningValueRef.current
        : effectiveText;
    const canOptimizeSource =
      targets.length > 0 &&
      Boolean(
        sourceText.trim() ||
          references.some((reference) => reference.instruction.trim())
      );
    if (!canOptimizeSource || !selectedTarget || isOptimizing) return;
    const editorState = store.getState();
    const requestDefinition =
      editorState.definition as AigcPipelineDefinitionV2;
    const expected: TextConfig = {
      bbox_references: references.map((reference) => ({ ...reference })),
      text: activeNode.config.text,
      title: activeNode.config.title,
      upstream_text_override:
        activeNode.config.upstream_text_override ?? null
    };
    const request = buildPromptOptimizationRequest(
      requestDefinition,
      selectedTarget.node,
      sourceText,
      direction,
      references.map((reference) => reference.instruction),
      editorState.mode === "pipeline" && editorState.entityId
        ? {
            baseRevision: editorState.revision,
            pipelineId: editorState.entityId,
            runDetail
          }
        : null
    );
    const requestSnapshot = promptOptimizationSnapshot(
      requestDefinition,
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
      const latestState = store.getState();
      const latestDefinition =
        latestState.definition as AigcPipelineDefinitionV2;
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
            sourceText,
            direction,
            bboxReferences(latestNode).map(
              (reference) => reference.instruction
            ),
            latestState.mode === "pipeline" && latestState.entityId
              ? {
                  baseRevision: latestState.revision,
                  pipelineId: latestState.entityId,
                  runDetail: runDetailRef.current
                }
              : null
          ),
          latestNode.config
        ) !== requestSnapshot ||
        effectiveTextForSnapshot(
          latestDefinition,
          latestNode,
          runDetailRef.current
        ) !== expectedEffectiveText
      ) {
        setOptimizationMessage({
          kind: "info",
          text: "文本、Run、目标配置或连线已变化，本次优化结果未应用。"
        });
        return;
      }
      const status =
        optimizationOrigin === "fullscreen"
          ? result.optimized_text === sourceText
            ? "unchanged"
            : "updated"
          : applyOptimizedPrompt(
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
        if (optimizationOrigin === "fullscreen") setDialogOpen(false);
      } else {
        if (optimizationOrigin === "fullscreen") {
          setFullscreenDraft(result.optimized_text);
        }
        const generationType = result.generation_type;
        const explanation = result.optimization_explanation?.trim();
        setOptimizationMessage({
          kind: "success",
          text:
            generationType || explanation
              ? `提示词已优化${generationType ? `（${generationType}）` : ""}${
                  explanation ? `：${explanation}` : ""
                }`
              : "提示词已优化，可撤销恢复。"
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
        <Label>基础文本</Label>
        <div className="flex items-center gap-2">
          {references.length > 0 ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              {references.length}/10
            </span>
          ) : null}
          <Button
            aria-label="优化提示词"
            disabled={!canOptimize || isOptimizing}
            onClick={() => openOptimizationDialog()}
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
        <div className="relative border-b border-border/70">
          <button
            aria-label="展开编辑基础文本"
            className="min-h-24 max-h-40 w-full overflow-y-auto whitespace-pre-wrap px-3 py-2 pr-12 text-left font-mono text-sm leading-6 text-foreground outline-none transition hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="aigc-prompt-preview"
            disabled={isOptimizing}
            onClick={(event) => openFullscreenEditor(event.currentTarget)}
            type="button"
          >
            {effectiveText || "（空）"}
          </button>
          <Button
            aria-label="展开编辑基础文本"
            className="absolute right-2 top-2 border-border/70 bg-card/90"
            disabled={isOptimizing}
            onClick={(event) => openFullscreenEditor(event.currentTarget)}
            size="icon"
            title="展开编辑基础文本"
            type="button"
            variant="ghost"
          >
            <Expand aria-hidden="true" className="h-4 w-4" />
          </Button>
          <span className="absolute bottom-2 right-3 rounded bg-card/90 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {Array.from(effectiveText).length} 字符
          </span>
        </div>
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
      <PromptFullscreenEditor
        editable={canEditText && !isOptimizing}
        canOptimize={
          canEditText &&
          targets.length > 0 &&
          Boolean(
            fullscreenDraft.trim() ||
              references.some((reference) => reference.instruction.trim())
          )
        }
        draft={fullscreenDraft}
        isOptimizing={isOptimizing}
        nodeName={
          displayNames.get(activeNode.id)?.displayName ??
          activeNode.config.title ??
          "文本节点"
        }
        onApply={applyFullscreenText}
        onClose={closeFullscreenEditor}
        onDraftChange={setFullscreenDraft}
        onOptimize={() => openOptimizationDialog("fullscreen")}
        open={fullscreenEditorOpen}
        validationMessage={validationMessage}
        valueAtOpen={fullscreenOpeningValue}
      />
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!isOptimizing) setDialogOpen(open);
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100dvh-1rem)] flex-col border-[#343a43] bg-[#171a1f] text-zinc-100 sm:max-h-[calc(100dvh-3rem)] sm:max-w-xl [&_label]:text-zinc-200"
          closeButtonClassName="border-[#3d444e] bg-[#20242a] text-zinc-400 hover:bg-[#2a3038] hover:text-zinc-100"
          data-testid="aigc-prompt-optimization-dialog"
          hideCloseButton={isOptimizing}
          onEscapeKeyDown={(event) => {
            if (isOptimizing) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isOptimizing) event.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0 px-5 pt-5">
            <DialogTitle className="text-zinc-100">优化提示词</DialogTitle>
            <DialogDescription className="text-zinc-400">
              选择直接下游目标，优化结果将
              {optimizationOrigin === "fullscreen"
                ? "更新当前全屏草稿。"
                : "写回当前文本节点。"}
            </DialogDescription>
          </DialogHeader>
          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-2"
            data-testid="aigc-prompt-optimization-body"
          >
            <div>
              <Label>当前文本</Label>
              <p className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border border-[#343a43] bg-[#101318] px-3 py-2 text-xs leading-5 text-zinc-400">
                {optimizationOrigin === "fullscreen"
                  ? fullscreenDraft || "（空）"
                  : effectiveText || "（空）"}
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
            {showsVideoReferenceMarkerHint ? (
              <p className="text-xs leading-5 text-zinc-400" role="status">
                优化会尽量保留提示词中的参考媒体标记。
              </p>
            ) : null}
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
          <DialogFooter
            className="shrink-0 border-t border-[#343a43] px-5 py-4"
            data-testid="aigc-prompt-optimization-footer"
          >
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

function PromptFullscreenEditor({
  editable,
  canOptimize,
  draft,
  isOptimizing,
  nodeName,
  onApply,
  onClose,
  onDraftChange,
  onOptimize,
  open,
  validationMessage,
  valueAtOpen
}: {
  editable: boolean;
  canOptimize: boolean;
  draft: string;
  isOptimizing: boolean;
  nodeName: string;
  onApply: (value: string, expectedValue: string) => boolean;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onOptimize: () => void;
  open: boolean;
  validationMessage: string | null;
  valueAtOpen: string;
}) {
  function apply() {
    if (onApply(draft, valueAtOpen)) onClose();
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
    >
      <DialogContent
        className="grid h-[94dvh] w-[calc(100vw-1rem)] max-w-[96rem] grid-rows-[auto_minmax(0,1fr)_auto] border-[#343a43] bg-[#171a1f] p-0 text-zinc-100 sm:h-[92dvh] sm:w-[96vw] sm:max-w-[96rem] sm:rounded-xl [&_label]:text-zinc-200"
        closeButtonClassName="border-[#3d444e] bg-[#20242a] text-zinc-400 hover:bg-[#2a3038] hover:text-zinc-100"
        data-testid="aigc-fullscreen-prompt-editor"
      >
        <DialogHeader className="border-b border-[#343a43] px-5 py-4 pr-16">
          <div className="flex items-start justify-between gap-3 pr-10">
            <div className="min-w-0">
              <DialogTitle className="text-zinc-100">编辑基础文本</DialogTitle>
              <DialogDescription className="sr-only">
                完整查看和编辑{nodeName}的提示词
              </DialogDescription>
              <p className="mt-1 truncate text-xs text-zinc-400">
                {nodeName}
              </p>
              <p className="mt-2 font-mono text-xs text-zinc-500">
                {Array.from(draft).length} 字符
              </p>
            </div>
            <Button
              disabled={!canOptimize || isOptimizing}
              onClick={onOptimize}
              size="sm"
              title="根据目标模型优化当前草稿"
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
        </DialogHeader>
        <div className="min-h-0 p-4 sm:p-5">
          <Textarea
            aria-label="完整基础文本"
            autoFocus
            className="h-full min-h-0 resize-none border-[#343a43] bg-[#101318] font-mono text-sm leading-6 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-primary/55"
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                editable &&
                event.key === "Enter" &&
                (event.metaKey || event.ctrlKey)
              ) {
                event.preventDefault();
                apply();
              }
            }}
            readOnly={!editable}
            value={draft}
          />
          {validationMessage ? (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {validationMessage}
            </p>
          ) : null}
        </div>
        <DialogFooter
          className="border-t border-[#343a43] px-5 py-4"
          data-testid="aigc-fullscreen-prompt-editor-footer"
        >
          <Button
            className="border-[#3d444e] bg-[#20242a] text-zinc-200 hover:bg-[#2a3038]"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            取消
          </Button>
          {editable ? (
            <Button onClick={apply} type="button">
              应用
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  referenceInstructions: string[],
  pipeline:
    | {
        baseRevision: number;
        pipelineId: string;
        runDetail: AigcPipelineRunDetail | null;
      }
    | null = null
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
      ...(pipeline
        ? {
            pipeline_context: {
              base_revision: pipeline.baseRevision,
              definition_snapshot: structuredClone(definition),
              pipeline_id: pipeline.pipelineId,
              source_image: resolvePromptOptimizationSourceImage(
                definition,
                target.id,
                pipeline.runDetail
              )
            }
          }
        : {}),
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
    request: promptOptimizationSemanticRequest(request),
    runId
  });
}

function promptOptimizationSemanticRequest(
  request: AigcPromptOptimizeRequest
): unknown {
  if (
    request.target_type !== "image_to_image" ||
    !request.pipeline_context
  ) {
    return request;
  }
  return {
    ...request,
    pipeline_context: {
      definition_snapshot: request.pipeline_context.definition_snapshot,
      pipeline_id: request.pipeline_context.pipeline_id,
      source_image: request.pipeline_context.source_image
    }
  };
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
