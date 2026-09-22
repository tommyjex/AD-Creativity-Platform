import { describe, expect, it } from "vitest";

import { resolveMultitrackTextPreview } from "@/lib/aigc/multitrack-text-preview";
import type { AigcTimelineSource } from "@/lib/aigc/multitrack-editor-store";
import type { MultiTrackTextElement } from "@/lib/aigc/types";

const upstreamElement: MultiTrackTextElement = {
  id: "upstream-text",
  type: "text",
  source: {
    source_handle: "text",
    source_node_id: "copy-node"
  },
  inline_text: null,
  target_time: { start_ms: 0, end_ms: 3000 },
  loop: false,
  transform: {
    x: 0,
    y: 0,
    width: 800,
    height: 160,
    rotation: 0
  },
  style: {
    font_size: 52,
    color: "#FFFFFFFF",
    bold: false,
    italic: false,
    underline: false,
    background_color: "#00000000"
  }
};

function source(
  previewText: string | null,
  status: AigcTimelineSource["text_preview_status"]
): AigcTimelineSource {
  return {
    available: true,
    kind: "text",
    preview_text: previewText,
    text_preview_status: status,
    source_handle: "text",
    source_node_id: "copy-node"
  };
}

describe("multi-track text preview", () => {
  it("uses inline text without looking up a source", () => {
    const inlineElement = {
      ...upstreamElement,
      source: null,
      inline_text: "  内联标题  "
    };

    expect(resolveMultitrackTextPreview(inlineElement, [])).toEqual({
      text: "内联标题",
      status: "inline"
    });
  });

  it("uses the resolved or configured upstream preview", () => {
    expect(
      resolveMultitrackTextPreview(
        upstreamElement,
        [source("  真实上游文案  ", "resolved")]
      )
    ).toEqual({
      text: "真实上游文案",
      status: "resolved"
    });
    expect(
      resolveMultitrackTextPreview(
        upstreamElement,
        [source("静态配置文案", "configured")]
      )
    ).toEqual({
      text: "静态配置文案",
      status: "configured"
    });
  });

  it("shows a stable waiting label when the source is unresolved", () => {
    expect(resolveMultitrackTextPreview(upstreamElement, [])).toEqual({
      text: "等待上游运行",
      status: "unavailable"
    });
    expect(
      resolveMultitrackTextPreview(
        upstreamElement,
        [source("   ", "resolved")]
      )
    ).toEqual({
      text: "等待上游运行",
      status: "unavailable"
    });
  });
});
