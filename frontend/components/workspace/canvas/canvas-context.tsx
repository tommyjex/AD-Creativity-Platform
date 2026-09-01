"use client";

import { createContext, useContext } from "react";

import type { Bbox } from "@/components/workspace/canvas/bbox-canvas";
import type { CanvasNodeSource } from "@/lib/api-types";

export const REFERENCE_MEDIA_MIN_SIZE = 80;
// Outer border (2px) + media padding (16px) + media border (2px).
export const REFERENCE_NODE_HORIZONTAL_CHROME = 20;
// Fixed header (32px) plus the same border and media chrome.
export const REFERENCE_NODE_VERTICAL_CHROME = 52;

/** Runtime status of an output node while its generation task resolves. */
export type OutputNodeStatus = "pending" | "succeeded" | "failed";

/** Persistent + derived display fields carried on a reference React Flow node. */
export interface ReferenceNodeData extends Record<string, unknown> {
  assetId: string;
  bbox: Bbox | null;
  disabled: boolean;
  /** Runtime-only intrinsic ratio used to normalize NodeResizer dimensions. */
  imageAspectRatio: number | null;
  /** Derived「图N」badge, ranked by addition order. */
  label: string;
  name: string;
  orderIndex: number;
  url: string | null;
}

/** Persistent + derived display fields carried on an output React Flow node. */
export interface OutputNodeData extends Record<string, unknown> {
  assetId: string | null;
  disabled: boolean;
  errorMessage: string | null;
  layerBusy: boolean;
  name: string;
  source: CanvasNodeSource;
  status: OutputNodeStatus;
  taskId: string | null;
  url: string | null;
}

/**
 * Stable canvas action handlers shared with custom node components through
 * context. Handlers are wrapped in `useCallback` by the page so passing them
 * via context does not force node re-renders; live display updates flow through
 * each node's `data`.
 */
export interface CanvasHandlers {
  getOutputDownloadUrl: (nodeId: string) => string | null;
  onOutputImageLoad: (
    nodeId: string,
    naturalWidth: number,
    naturalHeight: number
  ) => void;
  onOutputLayerDecompose: (nodeId: string) => void;
  onOutputPreview: (nodeId: string) => void;
  onOutputSetAsReference: (nodeId: string) => void;
  onReferenceBboxChange: (nodeId: string, bbox: Bbox | null) => void;
  onReferenceImageLoad: (
    nodeId: string,
    naturalWidth: number,
    naturalHeight: number
  ) => void;
  onReferencePreview: (nodeId: string) => void;
  onRequestRemoveReference: (nodeId: string) => void;
}

const noop = () => undefined;

const CanvasHandlersContext = createContext<CanvasHandlers>({
  getOutputDownloadUrl: () => null,
  onOutputImageLoad: noop,
  onOutputLayerDecompose: noop,
  onOutputPreview: noop,
  onOutputSetAsReference: noop,
  onReferenceBboxChange: noop,
  onReferenceImageLoad: noop,
  onReferencePreview: noop,
  onRequestRemoveReference: noop
});

export const CanvasHandlersProvider = CanvasHandlersContext.Provider;

export function useCanvasHandlers() {
  return useContext(CanvasHandlersContext);
}
