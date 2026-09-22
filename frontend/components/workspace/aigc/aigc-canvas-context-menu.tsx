"use client";

import {
  AudioLines,
  ImageIcon,
  Pencil,
  Search,
  Sparkles,
  Type,
  Video
} from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import {
  AIGC_EDITOR_NODE_REGISTRY
} from "@/lib/aigc/node-registry";
import type {
  AigcNodeCategory,
  AigcV2NodeRegistryItem,
  AigcV2NodeType
} from "@/lib/aigc/types";
import { cn } from "@/lib/utils";

export interface AigcContextMenuPosition {
  left: number;
  top: number;
}

const CATEGORY_ORDER = ["modality", "model", "control"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  modality: "模态",
  model: "模型",
  control: "控制"
};

export function AigcCanvasNodePicker({
  onAdd,
  onClose,
  position
}: {
  onAdd: (type: AigcV2NodeType) => void;
  onClose: () => void;
  position: AigcContextMenuPosition;
}) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return AIGC_EDITOR_NODE_REGISTRY;
    return AIGC_EDITOR_NODE_REGISTRY.filter(
      (item) =>
        item.label.toLocaleLowerCase().includes(normalized) ||
        item.type.toLocaleLowerCase().includes(normalized)
    );
  }, [query]);
  const safeIndex =
    filtered.length === 0
      ? 0
      : Math.min(highlightedIndex, filtered.length - 1);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length === 0) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex(
        (safeIndex + direction + filtered.length) % filtered.length
      );
      return;
    }
    if (event.key === "Enter" && filtered[safeIndex]) {
      event.preventDefault();
      onAdd(filtered[safeIndex].type);
    }
  }

  return (
    <div
      aria-label="添加节点"
      className="absolute z-50 flex max-h-[min(420px,calc(100%-16px))] w-72 flex-col overflow-hidden border border-[#3f4650] bg-[#20242a] shadow-2xl shadow-black/60"
      data-testid="aigc-canvas-node-picker"
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      role="dialog"
      style={position}
    >
      <div className="relative border-b border-[#343a43] p-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <Input
          aria-controls="aigc-node-picker-options"
          aria-label="搜索节点"
          autoFocus
          className="h-8 border-[#3f4650] bg-[#15181d] pl-8 text-xs"
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="搜索节点"
          value={query}
        />
      </div>
      <div
        className="min-h-0 overflow-y-auto p-1.5"
        id="aigc-node-picker-options"
        role="listbox"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-zinc-500">
            未找到匹配节点
          </p>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const items = filtered.filter(
              (item) => item.category === category
            );
            if (items.length === 0) return null;
            return (
              <div className="mb-1.5 last:mb-0" key={category}>
                <p className="px-2 py-1 font-mono text-[10px] uppercase text-zinc-500">
                  {CATEGORY_LABELS[category]}
                </p>
                {items.map((item) => {
                  const index = filtered.indexOf(item);
                  return (
                    <button
                      aria-selected={index === safeIndex}
                      className={cn(
                        "flex h-9 w-full items-center gap-2 px-2 text-left text-xs text-zinc-200",
                        index === safeIndex
                          ? "bg-[#303640] text-white"
                          : "hover:bg-[#292e36]"
                      )}
                      key={item.type}
                      onClick={() => onAdd(item.type)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      role="option"
                      type="button"
                    >
                      <NodeTypeIcon item={item} />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      <span className="font-mono text-[9px] text-zinc-600">
                        {item.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function AigcNodeContextMenu({
  onClose,
  onRename,
  position
}: {
  onClose: () => void;
  onRename: () => void;
  position: AigcContextMenuPosition;
}) {
  return (
    <div
      aria-label="节点操作"
      className="absolute z-50 w-40 border border-[#3f4650] bg-[#20242a] p-1 shadow-xl shadow-black/50"
      data-testid="aigc-node-context-menu"
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      role="menu"
      style={position}
    >
      <button
        autoFocus
        className="flex h-8 w-full items-center gap-2 px-2 text-left text-xs text-zinc-200 hover:bg-[#303640]"
        onClick={onRename}
        role="menuitem"
        type="button"
      >
        <Pencil className="h-3.5 w-3.5" />
        重命名
      </button>
    </div>
  );
}

function NodeTypeIcon({ item }: { item: AigcV2NodeRegistryItem }) {
  const className =
    item.category === ("control" satisfies AigcNodeCategory)
      ? "h-4 w-4 text-amber-400"
      : "h-4 w-4 text-blue-400";
  if (item.type.includes("image")) {
    return <ImageIcon className="h-4 w-4 text-emerald-400" />;
  }
  if (item.type.includes("video")) {
    return <Video className="h-4 w-4 text-orange-400" />;
  }
  if (item.type.includes("audio")) {
    return <AudioLines className="h-4 w-4 text-pink-400" />;
  }
  if (item.type.includes("text")) {
    return <Type className="h-4 w-4 text-blue-400" />;
  }
  return <Sparkles className={className} />;
}
