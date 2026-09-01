"use client";

import { createContext, useContext } from "react";
import type { AigcPipelineRunDetail } from "@/lib/aigc/types";

const AigcRunContext = createContext<AigcPipelineRunDetail | null>(null);
const AigcLayerPreviewRunContext =
  createContext<AigcPipelineRunDetail | null>(null);
interface AigcRunActions {
  continueFromNode: (nodeId: string) => void;
  pending: boolean;
}
const AigcRunActionsContext = createContext<AigcRunActions | null>(null);

export const AigcRunProvider = AigcRunContext.Provider;
export const AigcLayerPreviewRunProvider = AigcLayerPreviewRunContext.Provider;
export const AigcRunActionsProvider = AigcRunActionsContext.Provider;

export function useAigcRunProjection() {
  return useContext(AigcRunContext);
}

export function useAigcLayerPreviewRun() {
  return useContext(AigcLayerPreviewRunContext);
}

export function useAigcRunActions() {
  return useContext(AigcRunActionsContext);
}
