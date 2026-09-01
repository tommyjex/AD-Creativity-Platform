"use client";

import { RotateCcw, ScanSearch } from "lucide-react";
import { useState } from "react";

import { BboxCanvas } from "@/components/workspace/canvas/bbox-canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  AIGC_MAX_BBOX_REFERENCES,
  bboxReferences,
  eligibleBboxTextTargets
} from "@/lib/aigc/bbox-references";
import { useAigcEditorStore } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import type { AigcBbox, AigcNode } from "@/lib/aigc/types";
import type { Asset } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function AigcPreciseEditDialog({
  asset,
  node,
  url
}: {
  asset: Asset | undefined;
  node: Extract<AigcNode, { type: "image_input" }>;
  url: string | null;
}) {
  const definition = useAigcEditorStore((state) => state.definition);
  const mode = useAigcEditorStore((state) => state.mode);
  const setBindings = useAigcEditorStore(
    (state) => state.setImageBboxBindings
  );
  const [open, setOpen] = useState(false);
  const [draftBbox, setDraftBbox] = useState<AigcBbox | null>(null);
  const [selectedTextNodeIds, setSelectedTextNodeIds] = useState<Set<string>>(
    new Set()
  );
  const textNodes = definition.nodes.filter(
    (candidate): candidate is Extract<AigcNode, { type: "text_input" }> =>
      candidate.type === "text_input"
  );
  const eligibleIds = new Set(
    eligibleBboxTextTargets(definition, node.id).map((candidate) => candidate.id)
  );
  const canOpen = mode === "pipeline" && Boolean(asset && url);
  const canConfirm =
    node.config.bbox && draftBbox === null
      ? true
      : Boolean(draftBbox && selectedTextNodeIds.size > 0);

  function openEditor() {
    if (!canOpen) return;
    setDraftBbox(node.config.bbox ?? null);
    setSelectedTextNodeIds(
      new Set(
        textNodes
          .filter((candidate) =>
            bboxReferences(candidate).some(
              (reference) => reference.source_node_id === node.id
            )
          )
          .map((candidate) => candidate.id)
      )
    );
    setOpen(true);
  }

  function toggleTarget(textNode: Extract<AigcNode, { type: "text_input" }>) {
    setSelectedTextNodeIds((current) => {
      const next = new Set(current);
      if (next.has(textNode.id)) next.delete(textNode.id);
      else next.add(textNode.id);
      return next;
    });
  }

  function confirm() {
    if (!canConfirm) return;
    setBindings(node.id, draftBbox, [...selectedTextNodeIds]);
    setOpen(false);
  }

  return (
    <>
      <button
        aria-label={`精准编辑：${assetName(asset)}`}
        className="nodrag grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canOpen}
        onClick={(event) => {
          event.stopPropagation();
          openEditor();
        }}
        title={canOpen ? "精准编辑" : "选择图片后可精准编辑"}
        type="button"
      >
        <ScanSearch className="h-3.5 w-3.5" />
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="grid h-[92dvh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:rounded-lg">
          <DialogHeader className="border-b border-border px-5 py-4 pr-14">
            <DialogTitle>精准编辑 · {assetName(asset)}</DialogTitle>
            <DialogDescription>
              框选一个主体，并引用到与该图片共享图生图下游的文本节点。
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.7fr)_20rem] lg:overflow-hidden">
            <div className="flex min-h-[24rem] min-w-0 flex-col bg-slate-950">
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 px-3 text-white">
                <span className="text-xs font-semibold">框选主体</span>
                <Button
                  className="text-slate-200 hover:bg-white/10 hover:text-white"
                  onClick={() => setDraftBbox(null)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <RotateCcw className="h-4 w-4" />
                  重置
                </Button>
              </div>
              <div className="min-h-0 flex-1 p-4">
                <BboxCanvas
                  alt={`精准编辑：${assetName(asset)}`}
                  bbox={draftBbox}
                  className="h-full min-h-[20rem] w-full border-slate-700"
                  disabled={false}
                  fillImageBox
                  onChange={setDraftBbox}
                  url={url}
                />
              </div>
            </div>
            <aside className="border-t border-border bg-card p-4 lg:overflow-y-auto lg:border-l lg:border-t-0">
              <div className="mb-4">
                <p className="text-xs font-semibold text-foreground">当前框选</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {draftBbox
                    ? `${draftBbox.x1} ${draftBbox.y1} ${draftBbox.x2} ${draftBbox.y2}`
                    : "尚未框选"}
                </p>
              </div>
              <p className="mb-2 text-xs font-semibold text-foreground">
                引用到文本节点
              </p>
              <div className="space-y-2">
                {textNodes.length > 0 ? (
                  textNodes.map((textNode) => {
                    const eligible = eligibleIds.has(textNode.id);
                    const alreadySelected = selectedTextNodeIds.has(textNode.id);
                    const hasExistingReference = bboxReferences(textNode).some(
                      (reference) => reference.source_node_id === node.id
                    );
                    const atLimit =
                      bboxReferences(textNode).length >=
                        AIGC_MAX_BBOX_REFERENCES && !hasExistingReference;
                    const disabled = !eligible || atLimit;
                    return (
                      <label
                        className={cn(
                          "flex items-start gap-2 border border-border p-2.5 text-xs",
                          alreadySelected && "border-primary/50 bg-primary/[0.05]",
                          disabled
                            ? "cursor-not-allowed opacity-55"
                            : "cursor-pointer hover:border-primary/35"
                        )}
                        key={textNode.id}
                      >
                        <input
                          checked={alreadySelected}
                          className="mt-0.5 h-4 w-4 accent-primary"
                          disabled={disabled}
                          onChange={() => toggleTarget(textNode)}
                          type="checkbox"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {textNode.config.text.trim() || "未命名文本输入"}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {!eligible
                              ? "不满足共同图生图下游规则"
                              : atLimit
                                ? "已达到 10 条引用上限"
                                : `${bboxReferences(textNode).length}/10 条引用`}
                          </span>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
                    暂无文本输入节点。先完成图片、文本与图生图节点连线。
                  </p>
                )}
              </div>
            </aside>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-[11px] text-muted-foreground">
              坐标由框选生成，保存后自动同步到所有引用。
            </p>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
                取消
              </Button>
              <Button disabled={!canConfirm} onClick={confirm} type="button">
                {draftBbox ? `引用到 ${selectedTextNodeIds.size} 个节点` : "清除框选"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function assetName(asset: Asset | undefined): string {
  const name = asset?.metadata.name;
  return typeof name === "string" && name.trim() ? name.trim() : "图片输入";
}
