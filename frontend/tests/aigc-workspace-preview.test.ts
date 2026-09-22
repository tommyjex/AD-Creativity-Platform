import { describe, expect, it } from "vitest";
import {
  countWorkspacePreviewModels,
  getWorkspacePreviewNodeTone,
  normalizeWorkspaceTopology
} from "@/lib/aigc/workspace-preview";

describe("AIGC workspace preview metadata", () => {
  it("maps text, image, video, and audio output nodes to modality tones", () => {
    expect(getWorkspacePreviewNodeTone({ type: "text" } as never)).toBe("text");
    expect(getWorkspacePreviewNodeTone({ type: "text_to_image" } as never)).toBe(
      "image"
    );
    expect(getWorkspacePreviewNodeTone({ type: "video_generation" } as never)).toBe(
      "video"
    );
    expect(getWorkspacePreviewNodeTone({ type: "audio" } as never)).toBe("audio");
  });

  it("uses a neutral tone for a node missing from the registry", () => {
    expect(getWorkspacePreviewNodeTone({ type: "unknown" } as never)).toBe(
      "neutral"
    );
  });

  it("counts only model nodes", () => {
    expect(
      countWorkspacePreviewModels([
        { type: "text" },
        { type: "text_to_image" },
        { type: "layer_canvas" },
        { type: "video_generation" }
      ] as never[])
    ).toBe(2);
  });

  it("keeps a single-node topology centered and bounds all normalized points", () => {
    const layout = normalizeWorkspaceTopology([
      { id: "single", position: { x: 200, y: 100 } }
    ] as never[]);

    expect(layout).toEqual([
      expect.objectContaining({ id: "single", x: 50, y: 50 })
    ]);
  });
});
