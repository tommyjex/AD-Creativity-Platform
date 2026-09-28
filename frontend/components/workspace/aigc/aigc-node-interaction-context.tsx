"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { useAigcEditorStoreApi } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import type { AigcPipelineRunDetail } from "@/lib/aigc/types";

export interface OpenAigcTextEditorRequest {
  focusTarget: HTMLElement | null;
  nodeId: string;
  runDetail?: AigcPipelineRunDetail | null;
}

interface AigcNodeInteractionValue {
  closeTextEditor: () => void;
  openTextEditor: (request: OpenAigcTextEditorRequest) => void;
  textEditorRequest: OpenAigcTextEditorRequest | null;
}

const AigcNodeInteractionContext =
  createContext<AigcNodeInteractionValue | null>(null);

export function AigcNodeInteractionProvider({
  children
}: {
  children: ReactNode;
}) {
  const editorStore = useAigcEditorStoreApi();
  const [textEditorRequest, setTextEditorRequest] =
    useState<OpenAigcTextEditorRequest | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const textEditorRequestRef = useRef(textEditorRequest);

  const openTextEditor = useCallback(
    (request: OpenAigcTextEditorRequest) => {
      if (textEditorRequest?.nodeId === request.nodeId) return;
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      textEditorRequestRef.current = request;
      setTextEditorRequest(request);
    },
    [textEditorRequest?.nodeId]
  );

  const closeTextEditor = useCallback(() => {
    const focusTarget = textEditorRequestRef.current?.focusTarget;
    textEditorRequestRef.current = null;
    setTextEditorRequest(null);
    if (focusTarget?.isConnected) {
      focusTimerRef.current = window.setTimeout(() => {
        focusTimerRef.current = null;
        focusTarget.focus();
      }, 0);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = editorStore.subscribe((state) => {
      const request = textEditorRequestRef.current;
      if (
        request &&
        !state.definition.nodes.some(
          (node) => node.id === request.nodeId && node.type === "text"
        )
      ) {
        closeTextEditor();
      }
    });
    return () => {
      unsubscribe();
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
      }
    };
  }, [closeTextEditor, editorStore]);

  const value = useMemo(
    () => ({
      closeTextEditor,
      openTextEditor,
      textEditorRequest
    }),
    [closeTextEditor, openTextEditor, textEditorRequest]
  );

  return (
    <AigcNodeInteractionContext.Provider value={value}>
      {children}
    </AigcNodeInteractionContext.Provider>
  );
}

export function useAigcNodeInteraction() {
  return useContext(AigcNodeInteractionContext);
}
