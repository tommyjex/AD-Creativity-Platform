import { describe, expect, it } from "vitest";
import {
  getAigcConnectionValidationError,
  isValidAigcConnection
} from "@/components/workspace/aigc/aigc-editor";
import { createAigcEditorStore } from "@/lib/aigc/editor-store";
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
      label: "视频字幕提取",
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

    expect(store.getState().definition.nodes[0]).toMatchObject({
      type: "video_subtitle_extraction",
      config: { mode: "Subtitle" }
    });
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
