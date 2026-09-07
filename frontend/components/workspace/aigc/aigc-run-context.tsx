"use client";

import { createContext, useContext } from "react";
import type { AigcRunProjection } from "@/lib/aigc/run-scope";

const AigcRunContext = createContext<AigcRunProjection | null>(null);
interface AigcRunActions {
  continueFromNode: (nodeId: string) => void;
  openLayerEditor: (href: string) => void;
  pendingForNode: (nodeId: string) => boolean;
}
const AigcRunActionsContext = createContext<AigcRunActions | null>(null);

export const AigcRunProvider = AigcRunContext.Provider;
export const AigcRunActionsProvider = AigcRunActionsContext.Provider;

export function useAigcRunProjection(nodeId: string) {
  return useContext(AigcRunContext)?.displayRunForNode(nodeId) ?? null;
}

export function useAigcActiveRun(nodeId: string) {
  return useContext(AigcRunContext)?.activeRunForNode(nodeId) ?? null;
}

export function useAigcLayerPreviewRun(nodeId: string) {
  return (
    useContext(AigcRunContext)?.latestSuccessfulRunForNode(nodeId) ?? null
  );
}

export function useAigcRunActions() {
  return useContext(AigcRunActionsContext);
}
