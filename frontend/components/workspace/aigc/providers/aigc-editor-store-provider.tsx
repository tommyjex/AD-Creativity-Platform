"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo
} from "react";
import { useStore } from "zustand";
import {
  createAigcEditorStore,
  type AigcEditorInitialState,
  type AigcEditorState,
  type AigcEditorStore
} from "@/lib/aigc/editor-store";

const AigcEditorStoreContext = createContext<AigcEditorStore | null>(null);

export function AigcEditorStoreProvider({
  children,
  initialState,
  store
}: {
  children: ReactNode;
  initialState?: AigcEditorInitialState;
  store?: AigcEditorStore;
}) {
  if (!store && !initialState) {
    throw new Error("AigcEditorStoreProvider requires initialState or store");
  }
  const editorStore = useMemo(
    () => store ?? createAigcEditorStore(initialState),
    [initialState, store]
  );

  return (
    <AigcEditorStoreContext.Provider value={editorStore}>
      {children}
    </AigcEditorStoreContext.Provider>
  );
}

export function useAigcEditorStore<T>(
  selector: (state: AigcEditorState) => T
): T {
  return useStore(useAigcEditorStoreApi(), selector);
}

export function useAigcEditorStoreApi(): AigcEditorStore {
  const store = useContext(AigcEditorStoreContext);
  if (!store) {
    throw new Error(
      "useAigcEditorStore must be used within AigcEditorStoreProvider"
    );
  }
  return store;
}
