import { createStore, type StoreApi } from "zustand/vanilla";
import { isValidAigcConnection } from "@/lib/aigc/connection-validation";
import {
  migrateAigcDefinitionV2,
  migrateAigcRunSnapshotV2
} from "@/lib/aigc/definition-migration";
import {
  AIGC_DEFAULT_IMAGE_MODEL,
  AIGC_DEFAULT_IMAGE_OPERATION,
  AIGC_DEFAULT_JSON_PATH,
  AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG,
  AIGC_DEFAULT_TEXT_MODEL,
  AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
  AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG,
  AIGC_DEFAULT_VIDEO_CONFIG
} from "@/lib/aigc/node-registry";
import {
  AIGC_MAX_BBOX_REFERENCES
} from "@/lib/aigc/bbox-references";
import {
  aigcNodeDefaultSize,
  aigcNodeInitialPosition,
  aigcNodePositionFromCenter,
  normalizeAigcNodeSize
} from "@/lib/aigc/node-layout";
import {
  normalizeSeedreamImageConfig,
  normalizeSeedreamImageSizeForStorage,
  seedreamImageOperation
} from "@/lib/aigc/seedream-image";
import { normalizeVideoEnhancementConfig } from "@/lib/aigc/video-enhancement";
import type {
  AigcBbox,
  AigcBboxPromptReference,
  AigcEdge,
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcPoint,
  AigcSize,
  AigcV2Node,
  AigcV2NodeType,
  ImageToImageConfig,
  TextConfig,
  VideoEnhancementConfig
} from "@/lib/aigc/types";

const HISTORY_LIMIT = 30;

export interface AigcEditorSnapshot {
  definition: AigcPipelineDefinitionV2;
  description: string;
  name: string;
}

export interface AigcServerRevision extends AigcEditorSnapshot {
  revision: number;
}

export interface AigcResolvedServerRevision {
  draft: AigcEditorSnapshot;
  dirty: boolean;
  authoritativeNodeNames?: ReadonlyMap<string, string>;
}

export interface AigcEditorState extends AigcEditorSnapshot {
  dirty: boolean;
  entityId: string | null;
  future: AigcEditorSnapshot[];
  mode: "pipeline" | "template";
  past: AigcEditorSnapshot[];
  renamingNodeId: string | null;
  revision: number;
  selectedNodeId: string | null;
  addNode: (type: AigcV2NodeType, centerPosition?: AigcPoint) => void;
  applyGeneratedNodeNames: (names: ReadonlyMap<string, string>) => void;
  applyOptimizedTextPrompt: (
    nodeId: string,
    expected: TextConfig,
    optimizedText: string,
    optimizedInstructions: string[],
    optimizeReferences?: boolean
  ) => "applied" | "stale" | "unchanged";
  connect: (edge: AigcEdge) => boolean;
  initialize: (payload: {
    definition: AigcPipelineDefinition | AigcPipelineDefinitionV2;
    description: string;
    entityId: string;
    mode: AigcEditorState["mode"];
    name: string;
    revision: number;
  }) => void;
  applyServerRevision: (
    payload: AigcServerRevision,
    resolved?: AigcResolvedServerRevision
  ) => "applied" | "ignored";
  markSaved: (revision: number) => void;
  moveNode: (nodeId: string, position: AigcPoint) => void;
  redo: () => void;
  removeEdge: (edgeId: string) => void;
  removeNode: (nodeId: string) => void;
  resizeNode: (nodeId: string, size: AigcSize) => void;
  setRenamingNodeId: (nodeId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  setDescription: (description: string) => void;
  setName: (name: string) => void;
  setNodeCustomName: (nodeId: string, customName: string | null) => void;
  setViewport: (viewport: AigcPipelineDefinition["viewport"]) => void;
  setImageBboxBindings: (
    imageNodeId: string,
    bbox: AigcBbox | null,
    textNodeIds: string[],
    source?: {
      assetId: string | null;
      mode: "local" | "upstream";
    }
  ) => void;
  undo: () => void;
  updateBboxReferenceInstruction: (
    textNodeId: string,
    imageNodeId: string,
    instruction: string
  ) => void;
  updateNodeConfig: (
    nodeId: string,
    config: AigcV2Node["config"]
  ) => void;
  removeBboxReference: (textNodeId: string, imageNodeId: string) => void;
}

export interface AigcEditorInitialState {
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2;
  description: string;
  entityId: string;
  mode: AigcEditorState["mode"];
  name: string;
  revision: number;
}

export type AigcEditorStore = StoreApi<AigcEditorState>;

const emptyDefinition: AigcPipelineDefinitionV2 = {
  schemaVersion: 2,
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
  let serverSnapshot = normalizeEditorSnapshot(initialState);
  return createStore<AigcEditorState>((set, get) => ({
  definition: serverSnapshot.definition,
  description: initialState.description,
  dirty: false,
  entityId: initialState.entityId || null,
  future: [],
  mode: initialState.mode,
  name: initialState.name,
  past: [],
  renamingNodeId: null,
  revision: initialState.revision,
  selectedNodeId: null,

  initialize: (payload) => {
    serverSnapshot = normalizeEditorSnapshot(payload);
    set({
      ...payload,
      definition: serverSnapshot.definition,
      dirty: false,
      future: [],
      past: [],
      renamingNodeId: null,
      selectedNodeId: null
    });
  },
  applyServerRevision: (payload, resolved) => {
    const state = get();
    if (payload.revision <= state.revision) return "ignored";

    const remote = normalizeEditorSnapshot(payload);
    const next =
      resolved?.draft ??
      (state.dirty
        ? mergeAigcServerRevision(serverSnapshot, snapshot(state), remote)
        : remote);
    const dirty = resolved?.dirty ?? state.dirty;
    const rebaseHistory = (item: AigcEditorSnapshot) =>
      mergeAigcServerRevision(
        serverSnapshot,
        item,
        remote,
        resolved?.authoritativeNodeNames
      );
    serverSnapshot = remote;
    set({
      ...structuredClone(next),
      dirty,
      future: dirty ? state.future.map(rebaseHistory) : [],
      past: dirty ? state.past.map(rebaseHistory) : [],
      revision: payload.revision,
      selectedNodeId:
        state.selectedNodeId &&
        next.definition.nodes.some((node) => node.id === state.selectedNodeId)
          ? state.selectedNodeId
          : null
    });
    return "applied";
  },
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  setRenamingNodeId: (renamingNodeId) => set({ renamingNodeId }),
  markSaved: (revision) => {
    const state = get();
    serverSnapshot = snapshot(state);
    set({ dirty: false, revision });
  },
  setName: (name) => commit(set, get, { name }),
  setDescription: (description) => commit(set, get, { description }),
  setViewport: (viewport) =>
    set((state) => {
      if (
        state.definition.viewport.x === viewport.x &&
        state.definition.viewport.y === viewport.y &&
        state.definition.viewport.zoom === viewport.zoom
      ) {
        return state;
      }
      return {
        definition: { ...state.definition, viewport },
        dirty: true
      };
    }),
  addNode: (type, centerPosition) => {
    const state = get();
    const node = createNode(
      type,
      state.definition.nodes.length,
      centerPosition
    );
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes: [...state.definition.nodes, node]
      },
      selectedNodeId: node.id
    });
  },
  applyGeneratedNodeNames: (names) => {
    if (names.size === 0) return;
    const state = get();
    const applyNames = (definition: AigcPipelineDefinitionV2) => ({
      ...definition,
      nodes: definition.nodes.map((node) => {
        const name = names.get(node.id);
        return name === undefined ? node : { ...node, custom_name: name };
      })
    });
    const definition = applyNames(state.definition);
    if (definition.nodes.every(
      (node, index) =>
        node.custom_name === state.definition.nodes[index]?.custom_name
    )) {
      return;
    }
    set({
      definition,
      dirty: true,
      future: state.future.map((item) => ({
        ...item,
        definition: applyNames(item.definition)
      })),
      past: state.past.map((item) => ({
        ...item,
        definition: applyNames(item.definition)
      }))
    });
  },
  setNodeCustomName: (nodeId, customName) => {
    const state = get();
    const normalized = normalizeCustomName(customName);
    const current = state.definition.nodes.find((node) => node.id === nodeId);
    if (!current || (current.custom_name ?? null) === normalized) return;
    commit(set, get, {
      definition: {
        ...state.definition,
        nodes: state.definition.nodes.map((node) =>
          node.id === nodeId ? { ...node, custom_name: normalized } : node
        )
      }
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
          node.id === nodeId
            ? { ...node, size: normalizeAigcNodeSize(node.type, size) }
            : node
        )
      }
    });
  },
  updateNodeConfig: (nodeId, config) => {
    const state = get();
    const definition = editorDefinition(state.definition);
    const currentNode = definition.nodes.find((node) => node.id === nodeId);
    const imageAssetChanged =
      currentNode?.type === "image" &&
      "asset_id" in config &&
      currentNode.config.asset_id !== config.asset_id;
    const nodes = definition.nodes.map((node) => {
      if (node.id === nodeId) {
        return {
          ...node,
          config:
            imageAssetChanged && node.type === "image"
              ? { ...config, bbox: null, bbox_asset_id: null }
              : node.type === "image_to_image"
                ? normalizeSeedreamImageConfig(
                    config as ImageToImageConfig,
                    seedreamImageOperation(node)
                  )
              : node.type === "video_enhancement"
                ? normalizeVideoEnhancementConfig(
                    config as VideoEnhancementConfig
                  )
              : config
        } as AigcV2Node;
      }
      if (imageAssetChanged && node.type === "text") {
        return {
          ...node,
          config: {
            ...node.config,
            bbox_references: textReferences(node).filter(
              (reference) => reference.source_node_id !== nodeId
            )
          }
        };
      }
      return node;
    });
    commit(set, get, {
      definition: {
        ...definition,
        nodes
      }
    });
  },
  applyOptimizedTextPrompt: (
    nodeId,
    expected,
    optimizedText,
    optimizedInstructions,
    optimizeReferences = true
  ) => {
    const state = get();
    const definition = editorDefinition(state.definition);
    const node = definition.nodes.find(
      (candidate) => candidate.id === nodeId
    );
    if (node?.type !== "text") return "stale";
    const currentReferences = textReferences(node);
    const expectedReferences = expected.bbox_references ?? [];
    if (
      node.config.text !== expected.text ||
      (node.config.upstream_text_override ?? null) !==
        (expected.upstream_text_override ?? null) ||
      currentReferences.length !== expectedReferences.length ||
      currentReferences.some(
        (reference, index) =>
          reference.source_node_id !==
            expectedReferences[index]?.source_node_id ||
          reference.instruction !== expectedReferences[index]?.instruction
      ) ||
      (optimizeReferences &&
        optimizedInstructions.length !== currentReferences.length)
    ) {
      return "stale";
    }
    const nextReferences = optimizeReferences
      ? currentReferences.map((reference, index) => ({
          ...reference,
          instruction: optimizedInstructions[index] ?? ""
        }))
      : currentReferences;
    const upstream = definition.edges.some(
      (edge) =>
        edge.targetNodeId === nodeId && edge.targetHandle === "text"
    );
    const currentEffectiveText = upstream
      ? node.config.upstream_text_override
      : node.config.text;
    if (
      currentEffectiveText === optimizedText &&
      currentReferences.every(
        (reference, index) =>
          reference.instruction === nextReferences[index]?.instruction
      )
    ) {
      return "unchanged";
    }
    commit(set, get, {
      definition: {
        ...definition,
        nodes: definition.nodes.map((candidate) =>
          candidate.id === nodeId && candidate.type === "text"
            ? {
                ...candidate,
                config: {
                  ...candidate.config,
                  bbox_references: nextReferences,
                  ...(upstream
                    ? { upstream_text_override: optimizedText }
                    : { text: optimizedText })
                }
              }
            : candidate
        )
      }
    });
    return "applied";
  },
  setImageBboxBindings: (imageNodeId, bbox, textNodeIds, source) => {
    const state = get();
    const currentDefinition = editorDefinition(state.definition);
    const image = currentDefinition.nodes.find(
      (node) => node.id === imageNodeId
    );
    if (image?.type !== "image") return;
    const binding = source ?? {
      assetId: image.config.asset_id,
      mode: "local" as const
    };
    if (bbox && !binding.assetId) return;
    const selectedTargets = new Set(textNodeIds);
    const nodes = currentDefinition.nodes.map((node) => {
      if (node.id === imageNodeId && node.type === "image") {
        const bindingConfig =
          binding.mode === "upstream"
            ? {
                upstream_bbox: bbox,
                upstream_bbox_asset_id: bbox ? binding.assetId : null
              }
            : {
                bbox,
                bbox_asset_id: bbox ? binding.assetId : null
              };
        return {
          ...node,
          config: {
            ...node.config,
            ...bindingConfig
          }
        };
      }
      if (node.type !== "text") return node;
      const references = textReferences(node);
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
    const definition = {
      ...currentDefinition,
      nodes
    };
    commit(set, get, {
      definition
    });
  },
  updateBboxReferenceInstruction: (textNodeId, imageNodeId, instruction) => {
    const state = get();
    const definition = editorDefinition(state.definition);
    commit(set, get, {
      definition: {
        ...definition,
        nodes: definition.nodes.map((node) =>
          node.id === textNodeId && node.type === "text"
            ? {
                ...node,
                config: {
                  ...node.config,
                  bbox_references: textReferences(node).map((reference) =>
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
    const definition = editorDefinition(state.definition);
    commit(set, get, {
      definition: {
        ...definition,
        nodes: definition.nodes.map((node) =>
          node.id === textNodeId && node.type === "text"
            ? {
                ...node,
                config: {
                  ...node.config,
                  bbox_references: textReferences(node).filter(
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
    const currentDefinition = editorDefinition(state.definition);
    const definition = {
      ...currentDefinition,
      nodes: currentDefinition.nodes.filter((node) => node.id !== nodeId),
      edges: currentDefinition.edges.filter(
        (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId
      )
    };
    commit(set, get, {
      definition,
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId
    });
  },
  connect: (edge) => {
    const state = get();
    if (
      !isValidAigcConnection(
        {
          source: edge.sourceNodeId,
          sourceHandle: edge.sourceHandle,
          target: edge.targetNodeId,
          targetHandle: edge.targetHandle
        },
        state.definition.nodes,
        state.definition.edges
      )
    ) {
      return false;
    }
    commit(set, get, {
      definition: {
        ...state.definition,
        edges: [...state.definition.edges, edge]
      }
    });
    return true;
  },
  removeEdge: (edgeId) => {
    const state = get();
    const removedEdge = state.definition.edges.find(
      (edge) => edge.id === edgeId
    );
    const detachesManagedText =
      removedEdge?.sourceHandle === "items" &&
      removedEdge.targetHandle === "text";
    const definition = {
      ...state.definition,
      edges: state.definition.edges.filter((edge) => edge.id !== edgeId),
      nodes: detachesManagedText
        ? state.definition.nodes.map((node) =>
            node.id === removedEdge.targetNodeId &&
            node.type === "text" &&
            node.config.generated_by_parser_node_id ===
              removedEdge.sourceNodeId
              ? {
                  ...node,
                  config: {
                    ...node.config,
                    generated_by_parser_node_id: null,
                    generated_item_index: null,
                    generated_from_run_id: null
                  }
                }
              : node
          )
        : state.definition.nodes
    };
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

function snapshot(state: AigcEditorState): AigcEditorSnapshot {
  return structuredClone({
    definition: state.definition,
    description: state.description,
    name: state.name
  });
}

function normalizeEditorSnapshot(source: {
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2;
  description: string;
  name: string;
}): AigcEditorSnapshot {
  return {
    definition: normalizeDefinition(source.definition),
    description: source.description,
    name: source.name
  };
}

export function mergeAigcServerRevision(
  base: Readonly<AigcEditorSnapshot>,
  local: Readonly<AigcEditorSnapshot>,
  server: Readonly<AigcEditorSnapshot>,
  authoritativeNodeNames: ReadonlyMap<string, string> = new Map()
): AigcEditorSnapshot {
  return {
    definition: mergeAigcServerDefinition(
      base.definition,
      local.definition,
      server.definition,
      authoritativeNodeNames
    ),
    description: local.description,
    name: local.name
  };
}

function mergeAigcServerDefinition(
  base: Readonly<AigcPipelineDefinitionV2>,
  local: Readonly<AigcPipelineDefinitionV2>,
  server: Readonly<AigcPipelineDefinitionV2>,
  authoritativeNodeNames: ReadonlyMap<string, string>
): AigcPipelineDefinitionV2 {
  const baseManaged = new Map(
    base.nodes.flatMap((node) => {
      const key = managedNodeKey(node);
      return key ? [[key, node] as const] : [];
    })
  );
  const localManaged = new Map(
    local.nodes.flatMap((node) => {
      const key = managedNodeKey(node);
      return key ? [[key, node] as const] : [];
    })
  );
  const localById = new Map(local.nodes.map((node) => [node.id, node]));
  const serverById = new Map(server.nodes.map((node) => [node.id, node]));
  const deletedManagedKeys = new Set(
    [...baseManaged].flatMap(([key]) =>
      localManaged.has(key) ? [] : [key]
    )
  );
  for (const [key, node] of baseManaged) {
    const localNode = localById.get(node.id);
    if (localNode && managedNodeKey(localNode) !== key) {
      deletedManagedKeys.add(key);
    }
  }

  const serverManaged = new Map(
    server.nodes.flatMap((node) => {
      const key = managedNodeKey(node);
      return key ? [[key, node] as const] : [];
    })
  );
  const consumedManagedKeys = new Set<string>();
  const managedIdRemap = new Map<string, string>();
  const nodes = local.nodes.flatMap((node) => {
    const key = managedNodeKey(node);
    if (!key) {
      const remoteNode = serverById.get(node.id);
      return [
        {
          ...structuredClone(node),
          custom_name:
            authoritativeNodeNames.get(node.id) ??
            (authoritativeNodeNames.has(node.id) && remoteNode
              ? remoteNode.custom_name ?? null
              : node.custom_name ?? null
            )
        } as AigcV2Node
      ];
    }
    const remoteNode = serverManaged.get(key);
    if (!remoteNode || deletedManagedKeys.has(key)) return [];
    consumedManagedKeys.add(key);
    managedIdRemap.set(node.id, remoteNode.id);
    const baseNode = baseManaged.get(key);
    return [
      {
        ...structuredClone(remoteNode),
        custom_name: authoritativeNodeNames.has(node.id)
          ? authoritativeNodeNames.get(node.id) ??
            remoteNode.custom_name ??
            null
          : node.custom_name ?? null,
        position: structuredClone(
          baseNode && pointsEqual(node.position, baseNode.position)
            ? remoteNode.position
            : node.position
        ),
        size: structuredClone(
          baseNode && sizesEqual(node.size, baseNode.size)
            ? remoteNode.size
            : node.size
        )
      } as AigcV2Node
    ];
  });
  for (const serverNode of server.nodes) {
    const key = managedNodeKey(serverNode);
    if (
      !key ||
      consumedManagedKeys.has(key) ||
      deletedManagedKeys.has(key) ||
      nodes.some((node) => node.id === serverNode.id)
    ) {
      continue;
    }
    nodes.push(structuredClone(serverNode));
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const localSystemKeys = new Set(
    local.edges.flatMap((edge) => {
      const key = systemEdgeKey(edge, local.nodes);
      return key ? [key] : [];
    })
  );
  const deletedSystemKeys = new Set(
    base.edges.flatMap((edge) => {
      const key = systemEdgeKey(edge, base.nodes);
      return key && !localSystemKeys.has(key) ? [key] : [];
    })
  );
  const edges: AigcEdge[] = [];
  const edgeSignatures = new Set<string>();
  const addEdge = (edge: AigcEdge) => {
    const remapped = {
      ...structuredClone(edge),
      sourceNodeId: managedIdRemap.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      targetNodeId: managedIdRemap.get(edge.targetNodeId) ?? edge.targetNodeId
    };
    if (
      !nodeIds.has(remapped.sourceNodeId) ||
      !nodeIds.has(remapped.targetNodeId)
    ) {
      return;
    }
    const signature = edgeSignature(remapped);
    if (edgeSignatures.has(signature)) return;
    edgeSignatures.add(signature);
    edges.push(remapped);
  };

  for (const edge of local.edges) {
    if (!systemEdgeKey(edge, local.nodes)) addEdge(edge);
  }
  for (const edge of server.edges) {
    const key = systemEdgeKey(edge, server.nodes);
    if (key && !deletedSystemKeys.has(key)) addEdge(edge);
  }

  return {
    schemaVersion: 2,
    nodes,
    edges,
    viewport: structuredClone(local.viewport)
  };
}

function managedNodeKey(node: AigcV2Node): string | null {
  if (
    node.type !== "text" ||
    typeof node.config.generated_by_parser_node_id !== "string" ||
    typeof node.config.generated_item_index !== "number"
  ) {
    return null;
  }
  return `${node.config.generated_by_parser_node_id}\u0000${node.config.generated_item_index}`;
}

function systemEdgeKey(
  edge: AigcEdge,
  nodes: readonly AigcV2Node[]
): string | null {
  if (edge.sourceHandle !== "items" || edge.targetHandle !== "text") {
    return null;
  }
  const target = nodes.find((node) => node.id === edge.targetNodeId);
  const managedKey = target ? managedNodeKey(target) : null;
  return managedKey?.startsWith(`${edge.sourceNodeId}\u0000`)
    ? managedKey
    : null;
}

function edgeSignature(edge: AigcEdge): string {
  return [
    edge.sourceNodeId,
    edge.sourceHandle,
    edge.targetNodeId,
    edge.targetHandle
  ].join("\u0000");
}

function pointsEqual(left: AigcPoint, right: AigcPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

function sizesEqual(left: AigcSize, right: AigcSize): boolean {
  return left.width === right.width && left.height === right.height;
}

function normalizeDefinition(
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2
): AigcPipelineDefinitionV2 {
  const migrated = migrateAigcDefinitionV2(definition);
  return {
    ...migrated,
    nodes: migrated.nodes.map((node) => {
      const normalizedSize = normalizeAigcNodeSize(node.type, node.size);
      if (node.type === "text") {
        return {
          ...structuredClone(node),
          size: normalizedSize,
          config: {
            ...structuredClone(node.config),
            bbox_references: structuredClone(node.config.bbox_references ?? [])
          }
        };
      }
      if (node.type === "image") {
        return {
          ...structuredClone(node),
          size: normalizedSize,
          config: {
            ...structuredClone(node.config),
            bbox: node.config.bbox ?? null,
            bbox_asset_id: node.config.bbox_asset_id ?? null,
            upstream_bbox: node.config.upstream_bbox ?? null,
            upstream_bbox_asset_id:
              node.config.upstream_bbox_asset_id ?? null
          }
        };
      }
      if (node.type === "image_to_image") {
        return {
          ...structuredClone(node),
          size: normalizedSize,
          config: normalizeSeedreamImageConfig(
            structuredClone(node.config)
          )
        };
      }
      if (node.type === "text_to_image") {
        return {
          ...structuredClone(node),
          size: normalizedSize,
          config: {
            ...structuredClone(node.config),
            size: normalizeSeedreamImageSizeForStorage(
              node.config.size
            ) as typeof node.config.size
          }
        };
      }
      if (node.type === "video_enhancement") {
        return {
          ...structuredClone(node),
          size: normalizedSize,
          config: normalizeVideoEnhancementConfig(node.config)
        };
      }
      return {
        ...structuredClone(node),
        size: normalizedSize
      };
    })
  };
}

function createNode(
  type: AigcV2NodeType,
  index: number,
  centerPosition?: AigcPoint
): AigcV2Node {
  const nodeType = type;
  const id = `${nodeType}-${globalThis.crypto.randomUUID()}`;
  const common = {
    id,
    custom_name: null,
    position: centerPosition
      ? aigcNodePositionFromCenter(nodeType, centerPosition)
      : aigcNodeInitialPosition(nodeType, index),
    size: aigcNodeDefaultSize(nodeType)
  };

  if (nodeType === "text") {
    return {
      ...common,
      type: nodeType,
      config: {
        bbox_references: [],
        text: "",
        title: null,
        upstream_text_override: null
      }
    };
  }
  if (nodeType === "image") {
    return {
      ...common,
      type: nodeType,
      config: {
        asset_id: null,
        bbox: null,
        bbox_asset_id: null,
        title: null,
        upstream_bbox: null,
        upstream_bbox_asset_id: null
      }
    };
  }
  if (nodeType === "video" || nodeType === "audio") {
    return {
      ...common,
      type: nodeType,
      config: { asset_id: null, title: null }
    };
  }
  if (nodeType === "llm") {
    return {
      ...common,
      type: nodeType,
      config: {
        model: AIGC_DEFAULT_TEXT_MODEL,
        system_prompt: "",
        temperature: 0.7
      }
    };
  }
  if (nodeType === "video_generation") {
    return {
      ...common,
      type: nodeType,
      config: structuredClone(AIGC_DEFAULT_VIDEO_CONFIG)
    };
  }
  if (nodeType === "video_enhancement") {
    return {
      ...common,
      type: nodeType,
      config: structuredClone(AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG)
    };
  }
  if (nodeType === "video_face_blur") {
    return {
      ...common,
      type: nodeType,
      config: structuredClone(AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG)
    };
  }
  if (nodeType === "video_subtitle_extraction") {
    return {
      ...common,
      type: nodeType,
      config: { mode: "Subtitle" }
    };
  }
  if (nodeType === "multi_track_edit") {
    return {
      ...common,
      type: nodeType,
      config: structuredClone(AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG)
    };
  }
  if (nodeType === "json_parser") {
    return {
      ...common,
      type: nodeType,
      config: { json_path: AIGC_DEFAULT_JSON_PATH }
    };
  }
  if (nodeType === "layer_canvas") {
    return {
      ...common,
      type: nodeType,
      config: {
        selected_layer_id: null,
        source_layer_set: null,
        transform_patches: []
      }
    };
  }
  if (nodeType === "layer_composite") {
    return { ...common, type: nodeType, config: {} };
  }
  return {
    ...common,
    type: nodeType,
    config: {
      model: AIGC_DEFAULT_IMAGE_MODEL,
      aspect_ratio: "1:1",
      size: "2K",
      format: "png",
      ...(nodeType === "image_to_image"
        ? { operation: AIGC_DEFAULT_IMAGE_OPERATION }
        : {})
    }
  } as AigcV2Node;
}

function normalizeCustomName(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (
    normalized.length > 120 ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new Error("节点名称必须为不超过 120 个字符的单行文本");
  }
  return normalized;
}

export function deriveAigcModalityNodeMode(
  definition: Pick<AigcPipelineDefinitionV2, "edges" | "nodes">,
  nodeId: string
): "local" | "upstream" | null {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  if (
    node?.type !== "text" &&
    node?.type !== "image" &&
    node?.type !== "video" &&
    node?.type !== "audio"
  ) {
    return null;
  }
  return definition.edges.some((edge) => edge.targetNodeId === nodeId)
    ? "upstream"
    : "local";
}

export function serializeAigcEditorDefinition(
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2
): AigcPipelineDefinitionV2 {
  return structuredClone(migrateAigcDefinitionV2(definition));
}

export function readAigcRunDefinitionSnapshot(
  definitionSnapshot: unknown
): AigcPipelineDefinitionV2 {
  return migrateAigcRunSnapshotV2(definitionSnapshot);
}

function textReferences(
  node: Extract<AigcV2Node, { type: "text" }>
): AigcBboxPromptReference[] {
  return node.config.bbox_references ?? [];
}

function editorDefinition(
  definition: AigcPipelineDefinitionV2
): AigcPipelineDefinitionV2 {
  return definition;
}
