import { describe, expect, it } from "vitest";
import {
  getAigcConnectionValidationError,
  isValidAigcConnection
} from "@/components/workspace/aigc/aigc-editor";
import { migrateAigcDefinitionV2 } from "@/lib/aigc/definition-migration";
import { createAigcEditorStore } from "@/lib/aigc/editor-store";
import { deriveAigcNodeDisplayNames } from "@/lib/aigc/node-display-name";
import {
  AIGC_NODE_REGISTRY,
  isAigcExecutionNodeType
} from "@/lib/aigc/node-registry";

describe("AIGC video subtitle extraction contract", () => {
  it("registers a video input and subtitle output", () => {
    expect(
      AIGC_NODE_REGISTRY.find(
        (item) => item.type === "video_subtitle_extraction"
      )
    ).toMatchObject({
      label: "视频识别字幕",
      category: "model",
      executable: true,
      inputs: [
        {
          id: "video",
          type: "video_asset",
          required: true,
          max_connections: 1
        }
      ],
      outputs: [{ id: "subtitle", type: "subtitle_asset" }]
    });
    expect(isAigcExecutionNodeType("video_subtitle_extraction")).toBe(true);
  });

  it("creates the node with fixed Subtitle mode", () => {
    const store = createAigcEditorStore();
    store.getState().addNode("video_subtitle_extraction");
    const node = store.getState().definition.nodes[0];

    expect(node).toMatchObject({
      type: "video_subtitle_extraction",
      custom_name: null,
      config: { mode: "Subtitle" }
    });
    expect(
      deriveAigcNodeDisplayNames([node]).get(node.id)?.displayName
    ).toBe("视频识别字幕");
  });

  it("loads historical nodes without rewriting their type or custom name", () => {
    const historicalNode = {
      id: "ocr",
      type: "video_subtitle_extraction",
      position: { x: 0, y: 0 },
      size: { width: 280, height: 200 },
      config: { mode: "Subtitle" }
    };
    const migrate = (customName?: string) =>
      migrateAigcDefinitionV2({
        schemaVersion: 2,
        nodes: [
          customName === undefined
            ? historicalNode
            : { ...historicalNode, custom_name: customName }
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      });

    const unnamed = migrate();
    expect(unnamed.nodes[0]).toMatchObject({
      type: "video_subtitle_extraction",
      custom_name: null,
      config: { mode: "Subtitle" }
    });
    expect(
      deriveAigcNodeDisplayNames(unnamed.nodes).get("ocr")?.displayName
    ).toBe("视频识别字幕");

    const custom = migrate(" 我的字幕 ");
    expect(custom.nodes[0]).toMatchObject({
      type: "video_subtitle_extraction",
      custom_name: "我的字幕",
      config: { mode: "Subtitle" }
    });
    expect(
      deriveAigcNodeDisplayNames(custom.nodes).get("ocr")?.displayName
    ).toBe("我的字幕");
  });

  it("connects subtitle output only to multi-track subtitles", () => {
    const store = createAigcEditorStore();
    store.getState().addNode("video_subtitle_extraction");
    store.getState().addNode("multi_track_edit");
    const [source, target] = store.getState().definition.nodes;
    const valid = {
      source: source.id,
      sourceHandle: "subtitle",
      target: target.id,
      targetHandle: "subtitles"
    };

    expect(isValidAigcConnection(valid, [source, target], [])).toBe(true);
    expect(
      getAigcConnectionValidationError(
        { ...valid, targetHandle: "videos" },
        [source, target],
        []
      )
    ).toBe("port_type_mismatch");
  });

  it("caps multi-track subtitle connections at ten", () => {
    const registration = AIGC_NODE_REGISTRY.find(
      (item) => item.type === "multi_track_edit"
    );
    expect(
      registration?.inputs.find((port) => port.id === "subtitles")
    ).toMatchObject({
      type: "subtitle_asset",
      required: false,
      multiple: true,
      max_connections: 10
    });
  });
});
