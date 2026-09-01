import { createStore, type StoreApi } from "zustand/vanilla";
import {
  AIGC_DEFAULT_IMAGE_MODEL,
  AIGC_DEFAULT_IMAGE_OPERATION,
  AIGC_DEFAULT_TEXT_MODEL,
  AIGC_DEFAULT_VIDEO_CONFIG
} from "@/lib/aigc/node-registry";
import {
  AIGC_MAX_BBOX_REFERENCES,
  bboxReferences,
  sanitizeBboxReferences
} from "@/lib/aigc/bbox-references";
import type {
  AigcBbox,
  AigcEdge,
  AigcNode,
  AigcNodeType,
  AigcPipelineDefinition,
  AigcPoint,
  AigcSize,
  TextInputConfig
} from "@/lib/aigc/types";

const HISTORY_LIMIT = 30;

interface EditorSnapshot {
  definition: AigcPipelineDefinition;
  description: string;
  name: string;
}

export interface AigcEditorState extends EditorSnapshot {
  dirty: boolean;
  entityId: string | null;
  future: EditorSnapshot[];
  mode: "pipeline" | "template";
  past: EditorSnapshot[];
  revision: number;
  selectedNodeId: string | null;
  addNode: (type: AigcNodeType) => void;
  applyOptimizedTextPrompt: (
    nodeId: string,
    expected: TextInputConfig,
    optimizedText: string,
    optimizedInstructions: string[]
  ) => "applied" | "stale" | "unchanged";
  connect: (edge: AigcEdge) => void;
  initialize: (payload: {
    definition: AigcPipelineDefinition;
    description: string;
    entityId: string;
    mode: AigcEditorState["mode"];
    name: string;
    revision: number;
  }) => void;
  markSaved: (revision: number) => void;
  moveNode: (nodeId: string, position: AigcPoint) => void;
  redo: () => void;
  removeEdge: (edgeId: string) => void;
  removeNode: (nodeId: string) => void;
  resizeNode: (nodeId: string, size: AigcSize) => void;
  selectNode: (nodeId: string | null) => void;
  setDescription: (description: string) => void;
  setName: (name: string) => void;
  setViewport: (viewport: AigcPipelineDefinition["viewport"]) => void;
  setImageBboxBindings: (
    imageNodeId: string,
    bbox: AigcBbox | null,
    textNodeIds: string[]
  ) => void;
  undo: () => void;
  updateBboxReferenceInstruction: (
    textNodeId: string,
    imageNodeId: string,
    instruction: string
  ) => void;
  updateNodeConfig: (nodeId: string, config: AigcNode["config"]) => void;
  removeBboxReference: (textNodeId: string, imageNodeId: string) => void;
}

export interface AigcEditorInitialState {
  definition: AigcPipelineDefinition;
  description: string;
  entityId: string;
  mode: AigcEditorState["mode"];
  name: string;
  revision: number;
}

export type AigcEditorStore = StoreApi<AigcEditorState>;

const emptyDefinition: AigcPipelineDefinition = {
  schemaVersion: 1,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
};

const emptyInitialState: AigcEditorInitialState = {
  definition: emptyDefinition,
  description: "",
  entityId: "",
  mode: "pipeline",
  name: "",
  revision: 0
};

export function createAigcEditorStore(
  initialState: AigcEditorInitialState = emptyInitialState
): AigcEditorStore {
  return createStore<AigcEditorState>((set, get) => ({
  definition: normalizeDefinition(initialState.definition),
  description: initialState.description,
  dirty: false,
  entityId: initialState.entityId || null,
  future: [],
  mode: initialState.mode,
  name: initialState.name,
  past: [],
  revision: initialState.revision,
  selectedNodeId: null,

  initialize: (payload) =>
    set({
      ...payload,
      definition: normalizeDefinition(payload.definition),
      dirty: false,
      future: [],
      past: [],
      selectedNodeId: null
    }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  markSaved: (revision) => set({ dirty: false, revision }),
  setName: (name) => commit(set, get, { name }),
  setDescription: (description) => commit(set, get, { description }),
  setViewport: (viewport) =>
    set((state) => ({
      definition: { ...state.definition, viewport }
    })),
  addNode: (type) => {
    const state = get();
    const node = createNode(type, state.definition.nodes.length);
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes: [...state.definition.nodes, node]
      },
      selectedNodeId: node.id
    });
  },
  moveNode: (nodeId, position) => {
    const state = get();
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes: state.definition.nodes.map((node) =>
          node.id === nodeId ? { ...node, position } : node
        )
      }
    });
  },
  resizeNode: (nodeId, size) => {
    const state = get();
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes: state.definition.nodes.map((node) =>
          node.id === nodeId ? { ...node, size } : node
        )
      }
    });
  },
  updateNodeConfig: (nodeId, config) => {
    const state = get();
    const currentNode = state.definition.nodes.find((node) => node.id === nodeId);
    const imageAssetChanged =
      currentNode?.type === "image_input" &&
      "asset_id" in config &&
      currentNode.config.asset_id !== config.asset_id;
    const nodes = state.definition.nodes.map((node) => {
      if (node.id === nodeId) {
        return {
          ...node,
          config:
            imageAssetChanged && node.type === "image_input"
              ? { ...config, bbox: null, bbox_asset_id: null }
              : config
        } as AigcNode;
      }
      if (imageAssetChanged && node.type === "text_input") {
        return {
          ...node,
          config: {
            ...node.config,
            bbox_references: bboxReferences(node).filter(
              (reference) => reference.source_node_id !== nodeId
            )
          }
        };
      }
      return node;
    });
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes
      }
    });
  },
  applyOptimizedTextPrompt: (
    nodeId,
    expected,
    optimizedText,
    optimizedInstructions
  ) => {
    const state = get();
    const node = state.definition.nodes.find(
      (candidate) => candidate.id === nodeId
    );
    if (node?.type !== "text_input") return "stale";
    const currentReferences = bboxReferences(node);
    const expectedReferences = expected.bbox_references ?? [];
    if (
      node.config.text !== expected.text ||
      currentReferences.length !== expectedReferences.length ||
      currentReferences.some(
        (reference, index) =>
          reference.source_node_id !==
            expectedReferences[index]?.source_node_id ||
          reference.instruction !== expectedReferences[index]?.instruction
      ) ||
      optimizedInstructions.length !== currentReferences.length
    ) {
      return "stale";
    }
    const nextReferences = currentReferences.map((reference, index) => ({
      ...reference,
      instruction: optimizedInstructions[index] ?? ""
    }));
    if (
      node.config.text === optimizedText &&
      currentReferences.every(
        (reference, index) =>
          reference.instruction === nextReferences[index]?.instruction
      )
    ) {
      return "unchanged";
    }
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes: state.definition.nodes.map((candidate) =>
          candidate.id === nodeId && candidate.type === "text_input"
            ? {
                ...candidate,
                config: {
                  ...candidate.config,
                  bbox_references: nextReferences,
                  text: optimizedText
                }
              }
            : candidate
        )
      }
    });
    return "applied";
  },
  setImageBboxBindings: (imageNodeId, bbox, textNodeIds) => {
    const state = get();
    const image = state.definition.nodes.find(
      (node) => node.id === imageNodeId
    );
    if (image?.type !== "image_input" || (bbox && !image.config.asset_id)) return;
    const selectedTargets = new Set(textNodeIds);
    const nodes = state.definition.nodes.map((node) => {
      if (node.id === imageNodeId && node.type === "image_input") {
        return {
          ...node,
          config: {
            ...node.config,
            bbox,
            bbox_asset_id: bbox ? node.config.asset_id : null
          }
        };
      }
      if (node.type !== "text_input") return node;
      const references = bboxReferences(node);
      const existing = references.find(
        (reference) => reference.source_node_id === imageNodeId
      );
      let nextReferences = references;
      if (!bbox || !selectedTargets.has(node.id)) {
        nextReferences = references.filter(
          (reference) => reference.source_node_id !== imageNodeId
        );
      } else if (!existing && references.length < AIGC_MAX_BBOX_REFERENCES) {
        nextReferences = [
          ...references,
          { instruction: "", source_node_id: imageNodeId }
        ];
      }
      return nextReferences === references
        ? node
        : {
            ...node,
            config: { ...node.config, bbox_references: nextReferences }
          };
    });
    const definition = sanitizeBboxReferences({
      ...state.definition,
      nodes
    });
    commit(set, get, { definition });
  },
  updateBboxReferenceInstruction: (textNodeId, imageNodeId, instruction) => {
    const state = get();
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes: state.definition.nodes.map((node) =>
          node.id === textNodeId && node.type === "text_input"
            ? {
                ...node,
                config: {
                  ...node.config,
                  bbox_references: bboxReferences(node).map((reference) =>
                    reference.source_node_id === imageNodeId
                      ? { ...reference, instruction }
                      : reference
                  )
                }
              }
            : node
        )
      }
    });
  },
  removeBboxReference: (textNodeId, imageNodeId) => {
    const state = get();
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes: state.definition.nodes.map((node) =>
          node.id === textNodeId && node.type === "text_input"
            ? {
                ...node,
                config: {
                  ...node.config,
                  bbox_references: bboxReferences(node).filter(
                    (reference) => reference.source_node_id !== imageNodeId
                  )
                }
              }
            : node
        )
      }
    });
  },
  removeNode: (nodeId) => {
    const state = get();
    const definition = sanitizeBboxReferences({
      ...state.definition,
      nodes: state.definition.nodes.filter((node) => node.id !== nodeId),
      edges: state.definition.edges.filter(
        (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId
      )
    });
    commit(set, get, {
      definition,
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId
    });
  },
  connect: (edge) => {
    const state = get();
    commit(set, get, {
      definition: {
        ...state.definition,
        edges: [...state.definition.edges, edge]
      }
    });
  },
  removeEdge: (edgeId) => {
    const state = get();
    const definition = sanitizeBboxReferences({
      ...state.definition,
      edges: state.definition.edges.filter((edge) => edge.id !== edgeId)
    });
    commit(set, get, {
      definition
    });
  },
  undo: () => {
    const state = get();
    const previous = state.past.at(-1);
    if (!previous) return;
    set({
      ...structuredClone(previous),
      dirty: true,
      future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
      past: state.past.slice(0, -1),
      selectedNodeId: null
    });
  },
  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    set({
      ...structuredClone(next),
      dirty: true,
      future: state.future.slice(1),
      past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
      selectedNodeId: null
    });
  }
  }));
}

function commit(
  set: (
    partial:
      | Partial<AigcEditorState>
      | ((state: AigcEditorState) => Partial<AigcEditorState>)
  ) => void,
  get: () => AigcEditorState,
  changes: Partial<AigcEditorState>
) {
  const state = get();
  set({
    ...changes,
    dirty: true,
    future: [],
    past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT)
  });
}

function snapshot(state: AigcEditorState): EditorSnapshot {
  return structuredClone({
    definition: state.definition,
    description: state.description,
    name: state.name
  });
}

function normalizeDefinition(
  definition: AigcPipelineDefinition
): AigcPipelineDefinition {
  return sanitizeBboxReferences({
    ...structuredClone(definition),
    nodes: definition.nodes.map((node) => {
      if (node.type === "text_input") {
        return {
          ...structuredClone(node),
          config: {
            ...structuredClone(node.config),
            bbox_references: structuredClone(node.config.bbox_references ?? [])
          }
        };
      }
      if (node.type === "image_input") {
        return {
          ...structuredClone(node),
          config: {
            ...structuredClone(node.config),
            bbox: node.config.bbox ?? null,
            bbox_asset_id: node.config.bbox_asset_id ?? null
          }
        };
      }
      if (node.type === "image_to_image") {
        return {
          ...structuredClone(node),
          config: {
            ...structuredClone(node.config),
            operation: node.config.operation ?? AIGC_DEFAULT_IMAGE_OPERATION
          }
        };
      }
      return structuredClone(node);
    })
  });
}

function createNode(type: AigcNodeType, index: number): AigcNode {
  const id = `${type}-${globalThis.crypto.randomUUID()}`;
  const common = {
    id,
    position: { x: 80 + (index % 4) * 300, y: 80 + Math.floor(index / 4) * 230 },
    size: { width: 240, height: 160 }
  };

  if (type === "text_input") {
    return { ...common, type, config: { bbox_references: [], text: "" } };
  }
  if (type === "image_input") {
    return {
      ...common,
      type,
      config: { asset_id: null, bbox: null, bbox_asset_id: null }
    };
  }
  if (type === "video_input" || type === "audio_input") {
    return { ...common, type, config: { asset_id: null } } as AigcNode;
  }
  if (type === "llm") {
    return {
      ...common,
      type,
      config: {
        model: AIGC_DEFAULT_TEXT_MODEL,
        system_prompt: "",
        temperature: 0.7
      }
    };
  }
  if (type === "text_output") {
    return { ...common, type, config: { title: "文本结果" } };
  }
  if (type === "image_output") {
    return { ...common, type, config: { title: "图片结果" } };
  }
  if (type === "video_generation") {
    return {
      ...common,
      type,
      config: structuredClone(AIGC_DEFAULT_VIDEO_CONFIG)
    };
  }
  if (type === "video_output") {
    return { ...common, type, config: { title: "视频结果" } };
  }
  if (type === "layer_canvas") {
    return {
      ...common,
      type,
      config: {
        selected_layer_id: null,
        source_layer_set: null,
        transform_patches: []
      }
    };
  }
  if (type === "layer_composite") {
    return { ...common, type, config: {} };
  }
  return {
    ...common,
    type,
    config: {
      model: AIGC_DEFAULT_IMAGE_MODEL,
      aspect_ratio: "1:1",
      size: "2K",
      format: "png",
      ...(type === "image_to_image"
        ? { operation: AIGC_DEFAULT_IMAGE_OPERATION }
        : {})
    }
  } as AigcNode;
}
