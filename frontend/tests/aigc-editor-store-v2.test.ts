import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAigcConnectionValidationError,
  isValidAigcConnection
} from "@/lib/aigc/connection-validation";
import {
  createAigcEditorStore,
  deriveAigcModalityNodeMode,
  readAigcRunDefinitionSnapshot,
  serializeAigcEditorDefinition
} from "@/lib/aigc/editor-store";
import {
  AIGC_EDITOR_NODE_REGISTRY,
  AIGC_NODE_REGISTRY_BY_TYPE
} from "@/lib/aigc/node-registry";
import { deriveAigcNodeDisplayNames } from "@/lib/aigc/node-display-name";
import type {
  AigcEdge,
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcV2Node
} from "@/lib/aigc/types";

const legacyDefinition: AigcPipelineDefinition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "legacy-text",
      type: "text_input",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { text: "保留文本", bbox_references: [] }
    },
    {
      id: "model",
      type: "llm",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        model: "doubao-seed-evolving",
        system_prompt: "",
        temperature: 0.7
      }
    },
    {
      id: "legacy-output",
      type: "text_output",
      position: { x: 640, y: 0 },
      size: { width: 240, height: 160 },
      config: { title: "文案结果" }
    }
  ],
  edges: [
    {
      id: "text-to-model",
      sourceNodeId: "legacy-text",
      sourceHandle: "text",
      targetNodeId: "model",
      targetHandle: "prompt"
    },
    {
      id: "model-to-output",
      sourceNodeId: "model",
      sourceHandle: "text",
      targetNodeId: "legacy-output",
      targetHandle: "text"
    }
  ],
  viewport: { x: 10, y: 20, zoom: 0.8 }
};

function modalityNode(
  id: string,
  type: "text" | "image" | "video" | "audio"
): AigcV2Node {
  const config =
    type === "text"
      ? { text: "", bbox_references: [], title: null }
      : type === "image"
        ? {
            asset_id: null,
            bbox: null,
            bbox_asset_id: null,
            title: null,
            upstream_bbox: null,
            upstream_bbox_asset_id: null
          }
        : { asset_id: null, title: null };
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    size: { width: 240, height: 160 },
    config
  } as AigcV2Node;
}

function definition(
  nodes: AigcV2Node[],
  edges: AigcEdge[] = []
): AigcPipelineDefinitionV2 {
  return {
    schemaVersion: 2,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 }
  };
}

describe("AIGC v2 editor registry", () => {
  it("exposes only modality, model, and control groups to the node panel", () => {
    expect(
      AIGC_EDITOR_NODE_REGISTRY.filter(
        (item) => item.category === "modality"
      ).map((item) => item.type)
    ).toEqual(["text", "image", "video", "audio"]);
    expect(
      new Set(AIGC_EDITOR_NODE_REGISTRY.map((item) => item.category))
    ).toEqual(new Set(["modality", "model", "control"]));
    expect(
      AIGC_EDITOR_NODE_REGISTRY.some((item) =>
        item.type.endsWith("_input") || item.type.endsWith("_output")
      )
    ).toBe(false);
    expect(AIGC_NODE_REGISTRY_BY_TYPE.get("image")).toMatchObject({
      label: "图片节点",
      inputs: [{ id: "image", max_connections: 1, required: false }],
      outputs: [{ id: "image" }]
    });
  });
});

describe("AIGC v2 editor store", () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000004"
    );
  });

  it.each(["pipeline", "template"] as const)(
    "read-only migrates a v1 %s definition on load",
    (mode) => {
      const source = structuredClone(legacyDefinition);
      const store = createAigcEditorStore({
        definition: source,
        description: "",
        entityId: `${mode}-1`,
        mode,
        name: "迁移测试",
        revision: 3
      });

      expect(source).toEqual(legacyDefinition);
      expect(store.getState().definition).toMatchObject({
        schemaVersion: 2,
        nodes: [
          {
            id: "legacy-text",
            type: "text",
            config: { text: "保留文本", title: null }
          },
          { id: "model", type: "llm" },
          {
            id: "legacy-output",
            type: "text",
            config: { text: "", title: "文案结果" }
          }
        ],
        edges: legacyDefinition.edges,
        viewport: legacyDefinition.viewport
      });
      expect(store.getState().dirty).toBe(false);
    }
  );

  it("read-only adapts historical run snapshots without writing them back", () => {
    const snapshot = structuredClone(legacyDefinition);

    const adapted = readAigcRunDefinitionSnapshot(snapshot);

    expect(snapshot).toEqual(legacyDefinition);
    expect(adapted.schemaVersion).toBe(2);
    expect(adapted.nodes.map((node) => node.type)).toEqual([
      "text",
      "llm",
      "text"
    ]);
  });

  it("creates canonical local configs for all four modality nodes", () => {
    const store = createAigcEditorStore();

    store.getState().addNode("text");
    store.getState().addNode("image");
    store.getState().addNode("video");
    store.getState().addNode("audio");

    expect(store.getState().definition.nodes).toMatchObject([
      {
        type: "text",
        config: { text: "", bbox_references: [], title: null }
      },
      {
        type: "image",
        config: {
          asset_id: null,
          bbox: null,
          bbox_asset_id: null,
          title: null
        }
      },
      { type: "video", config: { asset_id: null, title: null } },
      { type: "audio", config: { asset_id: null, title: null } }
    ]);
  });

  it("creates a multi-track edit node with an isolated default project", () => {
    const store = createAigcEditorStore();

    store.getState().addNode("multi_track_edit");
    const firstNode = store.getState().definition.nodes[0];

    expect(firstNode).toMatchObject({
      type: "multi_track_edit",
      config: {
        canvas: {
          mode: "auto",
          width: null,
          height: null,
          background_color: "#000000FF"
        },
        output: { format: "mp4", fps: 30 },
        tracks: []
      }
    });

    if (firstNode?.type === "multi_track_edit") {
      firstNode.config.tracks.push({
        id: "track-local",
        name: "本地修改",
        type: "video",
        order: 0,
        hidden: false,
        muted: false,
        elements: []
      });
    }
    store.getState().addNode("multi_track_edit");

    const secondNode = store.getState().definition.nodes[1];
    expect(
      secondNode?.type === "multi_track_edit"
        ? secondNode.config.tracks
        : null
    ).toEqual([]);
  });

  it("numbers unified modality display names in definition order", () => {
    const nodes = [
      modalityNode("image-1", "image"),
      modalityNode("text-1", "text"),
      modalityNode("image-2", "image")
    ];

    expect(
      [...deriveAigcNodeDisplayNames(nodes).values()].map(
        (item) => item.displayName
      )
    ).toEqual(["图片节点1", "文本节点", "图片节点2"]);
  });

  it("derives upstream mode from the sole input and restores local config on disconnect", () => {
    const localText = modalityNode("local", "text");
    if (localText.type === "text") localText.config.text = "本地备用";
    const relay = modalityNode("relay", "text");
    const edge: AigcEdge = {
      id: "local-to-relay",
      sourceNodeId: "local",
      sourceHandle: "text",
      targetNodeId: "relay",
      targetHandle: "text"
    };
    const store = createAigcEditorStore({
      definition: definition([localText, relay]),
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "模式测试",
      revision: 1
    });

    expect(deriveAigcModalityNodeMode(store.getState().definition, "relay")).toBe(
      "local"
    );
    expect(store.getState().connect(edge)).toBe(true);
    expect(deriveAigcModalityNodeMode(store.getState().definition, "relay")).toBe(
      "upstream"
    );
    expect(store.getState().definition.nodes[1]?.config).toEqual({
      ...relay.config,
      upstream_text_override: null
    });

    store.getState().removeEdge(edge.id);
    expect(deriveAigcModalityNodeMode(store.getState().definition, "relay")).toBe(
      "local"
    );
    expect(store.getState().definition.nodes[1]?.config).toEqual({
      ...relay.config,
      upstream_text_override: null
    });
  });

  it("keeps deletion, undo/redo, dirty state, and v2 serialization coherent", () => {
    const source = modalityNode("source", "image");
    const relay = modalityNode("relay", "image");
    const edge: AigcEdge = {
      id: "source-to-relay",
      sourceNodeId: source.id,
      sourceHandle: "image",
      targetNodeId: relay.id,
      targetHandle: "image"
    };
    const store = createAigcEditorStore({
      definition: definition([source, relay], [edge]),
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "历史测试",
      revision: 1
    });

    store.getState().removeNode(source.id);
    expect(store.getState()).toMatchObject({
      dirty: true,
      definition: { nodes: [{ id: relay.id }], edges: [] }
    });
    store.getState().undo();
    expect(store.getState().definition).toEqual(definition([source, relay], [edge]));
    store.getState().redo();
    expect(store.getState().definition.edges).toEqual([]);

    const serialized = serializeAigcEditorDefinition(
      store.getState().definition
    );
    expect(serialized.schemaVersion).toBe(2);
    expect(serialized).not.toBe(store.getState().definition);
    serialized.nodes[0]!.position.x = 999;
    expect(store.getState().definition.nodes[0]!.position.x).toBe(0);
  });

  it("detaches managed text atomically when its parser system edge is deleted", () => {
    const parser: AigcV2Node = {
      id: "parser",
      type: "json_parser",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { json_path: "$.items" }
    };
    const managedText: AigcV2Node = {
      id: "managed-text",
      type: "text",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        text: "保留当前 item",
        bbox_references: [],
        title: "JSON 项 2",
        generated_by_parser_node_id: parser.id,
        generated_item_index: 1,
        generated_from_run_id: "run-1"
      }
    };
    const systemEdge: AigcEdge = {
      id: "parser-item-2",
      sourceNodeId: parser.id,
      sourceHandle: "items",
      targetNodeId: managedText.id,
      targetHandle: "text"
    };
    const store = createAigcEditorStore({
      definition: definition([parser, managedText], [systemEdge]),
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "受管关系",
      revision: 1
    });
    store.getState().selectNode(managedText.id);
    const initialDefinition = structuredClone(store.getState().definition);

    store.getState().removeEdge(systemEdge.id);

    expect(store.getState().selectedNodeId).toBe(managedText.id);
    expect(store.getState().definition.edges).toEqual([]);
    expect(store.getState().definition.nodes[1]).toMatchObject({
      id: managedText.id,
      config: {
        text: "保留当前 item",
        title: "JSON 项 2",
        generated_by_parser_node_id: null,
        generated_item_index: null,
        generated_from_run_id: null
      }
    });

    store.getState().undo();
    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().definition).toEqual(initialDefinition);

    store.getState().redo();
    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().definition.edges).toEqual([]);
    expect(store.getState().definition.nodes[1]).toMatchObject({
      config: {
        generated_by_parser_node_id: null,
        generated_item_index: null,
        generated_from_run_id: null
      }
    });
  });

  it("deletes a selected managed node and keeps undo/redo selection coherent", () => {
    const managedText = modalityNode("managed-text", "text");
    if (managedText.type !== "text") throw new Error("expected text node");
    managedText.config = {
      ...managedText.config,
      generated_by_parser_node_id: "parser",
      generated_item_index: 0,
      generated_from_run_id: "run-1"
    };
    const store = createAigcEditorStore({
      definition: definition([managedText]),
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "删除受管节点",
      revision: 1
    });
    store.getState().selectNode(managedText.id);

    store.getState().removeNode(managedText.id);
    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().definition.nodes).toEqual([]);

    store.getState().undo();
    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().definition.nodes).toHaveLength(1);

    store.getState().redo();
    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().definition.nodes).toEqual([]);
  });

  it("fully replaces a clean draft with a newer server revision", () => {
    const local = modalityNode("local", "text");
    const remote = modalityNode("remote", "text");
    const store = createAigcEditorStore({
      definition: definition([local]),
      description: "旧描述",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "旧名称",
      revision: 3
    });

    expect(
      store.getState().applyServerRevision({
        definition: {
          ...definition([remote]),
          viewport: { x: 12, y: 24, zoom: 0.8 }
        },
        description: "服务端描述",
        name: "服务端名称",
        revision: 4
      })
    ).toBe("applied");

    expect(store.getState()).toMatchObject({
      definition: {
        nodes: [{ id: "remote" }],
        viewport: { x: 12, y: 24, zoom: 0.8 }
      },
      description: "服务端描述",
      dirty: false,
      name: "服务端名称",
      revision: 4
    });
  });

  it("rebases a dirty draft onto server-managed nodes and system edges", () => {
    const parser: AigcV2Node = {
      id: "parser",
      type: "json_parser",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { json_path: "$.items" }
    };
    const ordinary = modalityNode("ordinary", "text");
    const deleted = modalityNode("deleted", "text");
    const managed = modalityNode("managed-0", "text");
    if (ordinary.type !== "text" || managed.type !== "text") {
      throw new Error("expected text nodes");
    }
    ordinary.config.text = "服务端基线";
    managed.config = {
      ...managed.config,
      text: "旧 item",
      title: "JSON 项 1",
      generated_by_parser_node_id: parser.id,
      generated_item_index: 0,
      generated_from_run_id: "run-1"
    };
    const systemEdge: AigcEdge = {
      id: "system-0",
      sourceNodeId: parser.id,
      sourceHandle: "items",
      targetNodeId: managed.id,
      targetHandle: "text"
    };
    const store = createAigcEditorStore({
      definition: definition(
        [parser, ordinary, deleted, managed],
        [systemEdge]
      ),
      description: "基线描述",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "基线名称",
      revision: 3
    });

    store.getState().setName("本地名称");
    store.getState().updateNodeConfig(ordinary.id, {
      ...ordinary.config,
      text: "本地编辑"
    });
    store.getState().moveNode(managed.id, { x: 720, y: 144 });
    store.getState().resizeNode(managed.id, { width: 360, height: 240 });
    store.getState().removeNode(deleted.id);
    store.getState().connect({
      id: "ordinary-edge",
      sourceNodeId: managed.id,
      sourceHandle: "text",
      targetNodeId: ordinary.id,
      targetHandle: "text"
    });

    const remoteManaged = structuredClone(managed);
    if (remoteManaged.type !== "text") throw new Error("expected text node");
    remoteManaged.config.text = "服务端新 item";
    remoteManaged.config.generated_from_run_id = "run-2";
    const remoteAdded = modalityNode("managed-1", "text");
    if (remoteAdded.type !== "text") throw new Error("expected text node");
    remoteAdded.config = {
      ...remoteAdded.config,
      text: "服务端第二项",
      title: "JSON 项 2",
      generated_by_parser_node_id: parser.id,
      generated_item_index: 1,
      generated_from_run_id: "run-2"
    };
    const remote = definition(
      [parser, ordinary, deleted, remoteManaged, remoteAdded],
      [
        systemEdge,
        {
          id: "system-1",
          sourceNodeId: parser.id,
          sourceHandle: "items",
          targetNodeId: remoteAdded.id,
          targetHandle: "text"
        }
      ]
    );

    expect(
      store.getState().applyServerRevision({
        definition: remote,
        description: "服务端描述",
        name: "服务端名称",
        revision: 4
      })
    ).toBe("applied");

    const state = store.getState();
    expect(state.revision).toBe(4);
    expect(state.dirty).toBe(true);
    expect(state.name).toBe("本地名称");
    expect(state.description).toBe("基线描述");
    expect(state.definition.nodes.some((node) => node.id === deleted.id)).toBe(
      false
    );
    expect(
      state.definition.nodes.find((node) => node.id === ordinary.id)
    ).toMatchObject({ config: { text: "本地编辑" } });
    expect(
      state.definition.nodes.find((node) => node.id === managed.id)
    ).toMatchObject({
      position: { x: 720, y: 144 },
      size: { width: 360, height: 240 },
      config: {
        text: "服务端新 item",
        generated_from_run_id: "run-2"
      }
    });
    expect(
      state.definition.nodes.find((node) => node.id === remoteAdded.id)
    ).toMatchObject({ config: { text: "服务端第二项" } });
    expect(state.definition.edges.map((edge) => edge.id)).toEqual(
      expect.arrayContaining(["ordinary-edge", "system-0", "system-1"])
    );

    expect(
      store.getState().applyServerRevision({
        definition: remote,
        description: "重复通知",
        name: "重复通知",
        revision: 4
      })
    ).toBe("ignored");
    expect(store.getState().name).toBe("本地名称");
  });

  it("replays explicit managed node and system edge deletion", () => {
    const parser: AigcV2Node = {
      id: "parser",
      type: "json_parser",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { json_path: "$.items" }
    };
    const managed = modalityNode("managed", "text");
    if (managed.type !== "text") throw new Error("expected text node");
    managed.config = {
      ...managed.config,
      generated_by_parser_node_id: parser.id,
      generated_item_index: 0,
      generated_from_run_id: "run-1"
    };
    const systemEdge: AigcEdge = {
      id: "system",
      sourceNodeId: parser.id,
      sourceHandle: "items",
      targetNodeId: managed.id,
      targetHandle: "text"
    };
    const initial = definition([parser, managed], [systemEdge]);

    const deletedNodeStore = createAigcEditorStore({
      definition: initial,
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "删除节点",
      revision: 1
    });
    deletedNodeStore.getState().removeNode(managed.id);
    deletedNodeStore.getState().applyServerRevision({
      definition: initial,
      description: "",
      name: "删除节点",
      revision: 2
    });
    expect(deletedNodeStore.getState().definition.nodes).toEqual([parser]);
    expect(deletedNodeStore.getState().definition.edges).toEqual([]);

    const detachedStore = createAigcEditorStore({
      definition: initial,
      description: "",
      entityId: "pipeline-2",
      mode: "pipeline",
      name: "解除关系",
      revision: 1
    });
    detachedStore.getState().removeEdge(systemEdge.id);
    detachedStore.getState().applyServerRevision({
      definition: initial,
      description: "",
      name: "解除关系",
      revision: 2
    });
    expect(detachedStore.getState().definition.edges).toEqual([]);
    expect(detachedStore.getState().definition.nodes[1]).toMatchObject({
      id: managed.id,
      config: {
        generated_by_parser_node_id: null,
        generated_item_index: null,
        generated_from_run_id: null
      }
    });
  });

  it("stores upstream bbox bindings without overwriting the local fallback", () => {
    const image = modalityNode("image", "image");
    if (image.type !== "image") throw new Error("expected image node");
    image.config = {
      ...image.config,
      asset_id: "local-image",
      bbox: { type: "bbox", x1: 10, y1: 20, x2: 300, y2: 400 },
      bbox_asset_id: "local-image"
    };
    const store = createAigcEditorStore({
      definition: definition([image]),
      description: "",
      entityId: "pipeline-1",
      mode: "pipeline",
      name: "上游框选",
      revision: 1
    });

    store.getState().setImageBboxBindings(
      "image",
      { type: "bbox", x1: 100, y1: 200, x2: 700, y2: 800 },
      [],
      { assetId: "upstream-image", mode: "upstream" }
    );

    const updated = store.getState().definition.nodes[0];
    expect(updated?.type).toBe("image");
    if (updated?.type !== "image") throw new Error("expected image node");
    expect(updated.config).toMatchObject({
      asset_id: "local-image",
      bbox: { type: "bbox", x1: 10, y1: 20, x2: 300, y2: 400 },
      bbox_asset_id: "local-image",
      upstream_bbox: {
        type: "bbox",
        x1: 100,
        y1: 200,
        x2: 700,
        y2: 800
      },
      upstream_bbox_asset_id: "upstream-image"
    });
  });
});

describe("AIGC v2 connection validation", () => {
  const source = modalityNode("source", "text");
  const relay = modalityNode("relay", "text");
  const fanout = modalityNode("fanout", "text");
  const image = modalityNode("image", "image");
  const nodes = [source, relay, fanout, image];
  const firstEdge: AigcEdge = {
    id: "source-to-relay",
    sourceNodeId: source.id,
    sourceHandle: "text",
    targetNodeId: relay.id,
    targetHandle: "text"
  };

  it("rejects user-created edges from parser.items", () => {
    const parser: AigcV2Node = {
      id: "parser",
      type: "json_parser",
      position: { x: 0, y: 0 },
      size: { width: 240, height: 160 },
      config: { json_path: "$.items" }
    };
    expect(
      getAigcConnectionValidationError(
        {
          source: parser.id,
          sourceHandle: "items",
          target: relay.id,
          targetHandle: "text"
        },
        [parser, relay],
        []
      )
    ).toBe("system_only_output");
  });

  it("allows fanout and acyclic same-modality relay chains", () => {
    expect(
      isValidAigcConnection(
        {
          source: source.id,
          sourceHandle: "text",
          target: fanout.id,
          targetHandle: "text"
        },
        nodes,
        [firstEdge]
      )
    ).toBe(true);
    expect(
      isValidAigcConnection(
        {
          source: relay.id,
          sourceHandle: "text",
          target: fanout.id,
          targetHandle: "text"
        },
        nodes,
        [firstEdge]
      )
    ).toBe(true);
  });

  it.each([
    [
      "second input",
      {
        source: fanout.id,
        sourceHandle: "text",
        target: relay.id,
        targetHandle: "text"
      },
      "target_connection_limit"
    ],
    [
      "type mismatch",
      {
        source: image.id,
        sourceHandle: "image",
        target: fanout.id,
        targetHandle: "text"
      },
      "port_type_mismatch"
    ],
    [
      "self loop",
      {
        source: relay.id,
        sourceHandle: "text",
        target: relay.id,
        targetHandle: "text"
      },
      "invalid_connection"
    ],
    [
      "indirect cycle",
      {
        source: relay.id,
        sourceHandle: "text",
        target: source.id,
        targetHandle: "text"
      },
      "cycle"
    ]
  ])("rejects %s", (_name, connection, error) => {
    expect(
      getAigcConnectionValidationError(connection, nodes, [firstEdge])
    ).toBe(error);
  });
});
