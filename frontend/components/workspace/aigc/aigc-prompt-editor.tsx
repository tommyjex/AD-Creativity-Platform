"use client";

import { useQueries } from "@tanstack/react-query";
import { LoaderCircle, WandSparkles } from "lucide-react";
import { useState } from "react";

import { BboxReferenceCard } from "@/components/workspace/canvas/visual-prompt-editor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import {
  AIGC_COORDINATE_TAG_PATTERN,
  bboxReferences
} from "@/lib/aigc/bbox-references";
import { useAigcEditorStore } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import type {
  AigcNode,
  AigcPipelineDefinition,
  AigcPromptOptimizationMode,
  TextInputConfig
} from "@/lib/aigc/types";

const MAX_INSTRUCTION_CODE_POINTS = 4000;

export function AigcPromptEditor({
  node
}: {
  node: Extract<AigcNode, { type: "text_input" }>;
}) {
  const definition = useAigcEditorStore((state) => state.definition);
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
  const references = bboxReferences(node);
  const sources = references.map((reference) =>
    definition.nodes.find(
      (candidate) => candidate.id === reference.source_node_id
    )
  );
  const assetIds = sources.map((source) =>
    source?.type === "image_input" ? source.config.asset_id : null
  );
  const assetQueries = useQueries({
    queries: assetIds.map((assetId) => ({
      enabled: Boolean(assetId),
      queryFn: () => apiClient.getAsset(assetId as string),
      queryKey: ["aigc", "image-asset", assetId]
    }))
  });
  const canOptimize = Boolean(
    node.config.text.trim() ||
      references.some((reference) => reference.instruction.trim())
  );

  function updateText(value: string) {
    if (AIGC_COORDINATE_TAG_PATTERN.test(value)) {
      setValidationMessage("坐标标签由框选生成，不能手工输入。");
      return;
    }
    setValidationMessage(null);
    setOptimizationMessage(null);
    update(node.id, { ...node.config, text: value });
  }

  function updateReferenceInstruction(sourceNodeId: string, value: string) {
    if (AIGC_COORDINATE_TAG_PATTERN.test(value)) {
      setValidationMessage("坐标标签由框选生成，不能手工输入。");
      return;
    }
    setValidationMessage(null);
    setOptimizationMessage(null);
    updateInstruction(
      node.id,
      sourceNodeId,
      truncateCodePoints(value, MAX_INSTRUCTION_CODE_POINTS)
    );
  }

  async function optimizePrompt() {
    if (!canOptimize || isOptimizing) return;
    const expected: TextInputConfig = {
      bbox_references: references.map((reference) => ({ ...reference })),
      text: node.config.text
    };
    const context = promptOptimizationContext(definition, node.id);
    setIsOptimizing(true);
    setOptimizationMessage(null);
    setValidationMessage(null);
    try {
      const result = await apiClient.optimizeAigcImagePrompt({
        generation_modes: context.generationModes,
        reference_image_count: context.referenceImageCount,
        reference_instructions: references.map(
          (reference) => reference.instruction
        ),
        text: node.config.text
      });
      const status = applyOptimizedPrompt(
        node.id,
        expected,
        result.optimized_text,
        result.optimized_reference_instructions
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
      }
    } catch (error) {
      setOptimizationMessage({
        kind: "error",
        text: getUserFacingErrorMessage(error)
      });
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`node-text-${node.id}`}>基础文本</Label>
          <Button
            aria-label="优化生图提示词"
            disabled={!canOptimize || isOptimizing}
            onClick={() => void optimizePrompt()}
            size="sm"
            title="根据 Seedream 提示词指南优化"
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
        <Textarea
          className="mt-1.5 min-h-24 resize-y"
          disabled={isOptimizing}
          id={`node-text-${node.id}`}
          onChange={(event) => updateText(event.target.value)}
          value={node.config.text}
        />
      </div>
      {references.length > 0 ? (
        <div aria-label="框选引用" className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>框选引用</Label>
            <span className="font-mono text-[10px] text-muted-foreground">
              {references.length}/10
            </span>
          </div>
          {references.map((reference, index) => {
            const source = sources[index];
            const asset = assetQueries[index]?.data;
            const bbox =
              source?.type === "image_input" ? source.config.bbox : null;
            if (!asset || !bbox) {
              return (
                <div
                  className="border border-dashed border-border p-2 text-xs text-muted-foreground"
                  key={reference.source_node_id}
                >
                  引用素材正在加载或已失效
                </div>
              );
            }
            const coordinates = `${bbox.x1} ${bbox.y1} ${bbox.x2} ${bbox.y2}`;
            return (
              <div className="space-y-1.5" key={reference.source_node_id}>
                <BboxReferenceCard
                  asset={asset}
                  bbox={bbox}
                  label={`图片节点 · ${shortNodeId(reference.source_node_id)}`}
                  onRemove={
                    isOptimizing
                      ? undefined
                      : () =>
                          removeReference(node.id, reference.source_node_id)
                  }
                  removeLabel={`移除框选引用：${reference.source_node_id}`}
                  reference={`bbox ${coordinates}`}
                  tone={index % 2 === 0 ? "rose" : "violet"}
                />
                <Textarea
                  aria-label={`框选引用说明：${reference.source_node_id}`}
                  className="min-h-16 resize-y text-xs"
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
    </div>
  );
}

function promptOptimizationContext(
  definition: AigcPipelineDefinition,
  textNodeId: string
): {
  generationModes: AigcPromptOptimizationMode[];
  referenceImageCount: number;
} {
  const directTargets = definition.edges
    .filter(
      (edge) =>
        edge.sourceNodeId === textNodeId && edge.targetHandle === "prompt"
    )
    .map((edge) =>
      definition.nodes.find((node) => node.id === edge.targetNodeId)
    )
    .filter(
      (
        target
      ): target is Extract<
        AigcNode,
        { type: "text_to_image" | "image_to_image" }
      > =>
        target?.type === "text_to_image" || target?.type === "image_to_image"
    );
  const modeSet = new Set<AigcPromptOptimizationMode>(
    directTargets.map((target) => target.type)
  );
  const generationModes: AigcPromptOptimizationMode[] =
    modeSet.size > 0
      ? (["text_to_image", "image_to_image"] as const).filter((mode) =>
          modeSet.has(mode)
        )
      : ["text_to_image"];
  const referenceImageCount = Math.max(
    0,
    ...directTargets
      .filter((target) => target.type === "image_to_image")
      .map(
        (target) =>
          definition.edges.filter(
            (edge) =>
              edge.targetNodeId === target.id &&
              edge.targetHandle === "image"
          ).length
      )
  );
  return { generationModes, referenceImageCount };
}

function truncateCodePoints(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}

function shortNodeId(nodeId: string): string {
  return nodeId.length > 18 ? `${nodeId.slice(0, 15)}…` : nodeId;
}
