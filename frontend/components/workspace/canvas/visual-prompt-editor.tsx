"use client";

import { ImageIcon, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { Bbox } from "@/components/workspace/canvas/bbox-canvas";
import { Textarea } from "@/components/ui/textarea";
import { getSafePreviewUrl } from "@/lib/asset-display";
import type { Asset } from "@/lib/api-types";
import { cn } from "@/lib/utils";

/** Order-slot key reserved for the target image bbox (dialog editing form). */
export const TARGET_BBOX_ORDER_KEY = "__target__";

/**
 * Prompt editor with inline, tamper-proof bbox reference cards. Extracted from
 * `image-canvas-editor.tsx` so both the dialog editing form and the node
 * canvas' right dock render the exact same region-reference experience.
 */
export function VisualPromptEditor({
  bboxOrder,
  disabled,
  isInitialGeneration,
  onPromptChange,
  onRemoveReference,
  onSerializedPromptChange,
  prompt,
  referenceAssets,
  referenceBboxes,
  selectedReferenceAssets,
  targetAsset,
  targetBbox
}: {
  bboxOrder: string[];
  disabled: boolean;
  isInitialGeneration: boolean;
  onPromptChange: (prompt: string) => void;
  onRemoveReference?: (assetId: string) => void;
  onSerializedPromptChange: (prompt: string) => void;
  prompt: string;
  referenceAssets: Asset[];
  referenceBboxes: Record<string, Bbox>;
  selectedReferenceAssets: Asset[];
  targetAsset: Asset | null;
  targetBbox: Bbox | null;
}) {
  const referenceCards = isInitialGeneration
    ? selectedReferenceAssets.flatMap((asset) => {
        const bbox = referenceBboxes[asset.id];
        const displayIndex =
          referenceAssets.findIndex((candidate) => candidate.id === asset.id) + 1;
        const orderIndex = bboxOrder.indexOf(asset.id);
        return bbox
          ? [
              {
                asset,
                bbox,
                imageLabel: `图${displayIndex}`,
                index: displayIndex,
                order: orderIndex === -1 ? displayIndex + 1000 : orderIndex,
                reference: `图${displayIndex}<bbox>${bbox.x1} ${bbox.y1} ${bbox.x2} ${bbox.y2}</bbox>`,
                slotKey: asset.id
              }
            ]
          : [];
      })
    : [];
  const targetOrderIndex = bboxOrder.indexOf(TARGET_BBOX_ORDER_KEY);
  const cards = (
    targetAsset && targetBbox && !isInitialGeneration
      ? [
          {
            asset: targetAsset,
            bbox: targetBbox,
            imageLabel: "图1",
            index: 1,
            order: targetOrderIndex === -1 ? 0 : targetOrderIndex,
            reference: `图1<bbox>${targetBbox.x1} ${targetBbox.y1} ${targetBbox.x2} ${targetBbox.y2}</bbox>`,
            slotKey: TARGET_BBOX_ORDER_KEY
          },
          ...referenceCards
        ]
      : referenceCards
  ).sort((left, right) => left.order - right.order);
  const [textSlots, setTextSlots] = useState<Record<string, string>>({
    start: prompt
  });
  const hasCards = cards.length > 0;
  const placeholder = isInitialGeneration
    ? "例如：晨光中的便携咖啡机电商主图，干净背景，突出产品细节。"
    : "例如：将选中区域背景改为浅灰色摄影棚。";
  const serializedPrompt = buildPromptWithReferences(cards, textSlots);
  const textPrompt = Object.values(textSlots)
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    onPromptChange(textPrompt);
    onSerializedPromptChange(serializedPrompt);
  }, [onPromptChange, onSerializedPromptChange, serializedPrompt, textPrompt]);

  function updateTextSlot(slot: string, value: string) {
    setTextSlots((current) => ({ ...current, [slot]: value }));
  }

  if (!hasCards) {
    return (
      <div className="mt-2 rounded-xl border border-primary/45 bg-background p-2 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]">
        <Textarea
          className="min-h-32 resize-y border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
          disabled={disabled}
          id="canvas-edit-prompt"
          maxLength={4000}
          onChange={(event) => updateTextSlot("start", event.target.value)}
          placeholder={placeholder}
          value={textSlots.start ?? ""}
        />
      </div>
    );
  }

  return (
    <div
      aria-label="可视化区域框选编辑器"
      className="mt-2 min-h-48 rounded-xl border border-primary/45 bg-background p-2 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]"
      role="group"
    >
      <Textarea
        className="min-h-12 resize-y border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
        disabled={disabled}
        id="canvas-edit-prompt"
        maxLength={4000}
        onChange={(event) => updateTextSlot("start", event.target.value)}
        placeholder={placeholder}
        value={textSlots.start ?? ""}
      />
      <div className="space-y-2" aria-label="框选引用">
        {cards.map((card, cardIndex) => {
          const nextSlot = `after:${card.slotKey}`;
          return (
            <div className="space-y-1.5" key={card.slotKey}>
              <BboxReferenceCard
                asset={card.asset}
                bbox={card.bbox}
                label={`${card.imageLabel} 框选 #${cardIndex + 1}`}
                onRemove={
                  onRemoveReference
                    ? () => onRemoveReference(card.slotKey)
                    : undefined
                }
                removeLabel={`移除框选引用：${card.imageLabel}`}
                reference={card.reference}
                tone={card.index % 2 === 0 ? "rose" : "violet"}
              />
              <Textarea
                aria-label={`${card.imageLabel} 框选 #${cardIndex + 1} 后文字`}
                className="min-h-10 resize-y border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
                disabled={disabled}
                maxLength={4000}
                onChange={(event) => updateTextSlot(nextSlot, event.target.value)}
                placeholder="点击输入这张引用后的文字"
                value={textSlots[nextSlot] ?? ""}
              />
            </div>
          );
        })}
      </div>
      <p className="px-2 pb-1 text-[11px] leading-5 text-muted-foreground">
        已添加 {cards[cards.length - 1]?.reference}
      </p>
    </div>
  );
}

export function BboxReferenceCard({
  asset,
  bbox,
  label,
  onRemove,
  removeLabel,
  reference,
  tone
}: {
  asset: Asset;
  bbox: Bbox;
  label: string;
  onRemove?: () => void;
  removeLabel: string;
  reference: string;
  tone: "rose" | "violet";
}) {
  const previewUrl = getSafePreviewUrl(asset);
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center gap-2 rounded-xl border bg-card/95 p-2 text-xs shadow-sm",
        tone === "rose"
          ? "border-rose-400/80 shadow-rose-200/40"
          : "border-violet-500/70 shadow-violet-200/40"
      )}
    >
      <BboxThumbnail bbox={bbox} name={referenceName(asset)} url={previewUrl} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              tone === "rose" ? "bg-rose-400" : "bg-violet-500"
            )}
          />
          <span>{label}</span>
        </div>
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
          {reference}
        </p>
      </div>
      {onRemove ? (
        <button
          aria-label={removeLabel}
          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-destructive"
          onClick={onRemove}
          title={removeLabel}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function buildPromptWithReferences(
  cards: Array<{ reference: string; slotKey: string }>,
  textSlots: Record<string, string>
) {
  const segments = [textSlots.start?.trim() ?? ""];
  for (const card of cards) {
    segments.push(card.reference);
    segments.push(textSlots[`after:${card.slotKey}`]?.trim() ?? "");
  }
  return segments.filter(Boolean).join(" ").trim();
}

function BboxThumbnail({
  bbox,
  name,
  url
}: {
  bbox: Bbox;
  name: string;
  url: string | null;
}) {
  if (!url) {
    return (
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }

  const width = Math.max(1, bbox.x2 - bbox.x1);
  const height = Math.max(1, bbox.y2 - bbox.y1);
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-950">
      {/* Signed asset URLs must be passed through without image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={`${name} 框选缩略图`}
        className="absolute max-w-none select-none"
        draggable={false}
        src={url}
        style={{
          height: `${(1000 / height) * 100}%`,
          left: `${(-bbox.x1 / width) * 100}%`,
          top: `${(-bbox.y1 / height) * 100}%`,
          width: `${(1000 / width) * 100}%`
        }}
      />
    </div>
  );
}

function referenceName(asset: Asset) {
  return typeof asset.metadata.name === "string" ? asset.metadata.name : "参考图";
}
