import type { AigcTimelineSource } from "@/lib/aigc/multitrack-editor-store";
import type { MultiTrackTextElement } from "@/lib/aigc/types";

export interface MultitrackTextPreview {
  text: string;
  status: "inline" | "resolved" | "configured" | "unavailable";
}

export function resolveMultitrackTextPreview(
  element: MultiTrackTextElement,
  sources: readonly AigcTimelineSource[]
): MultitrackTextPreview {
  if (element.source === null) {
    return {
      text: element.inline_text?.trim() || "输入文字",
      status: "inline"
    };
  }

  const source = sources.find(
    (candidate) =>
      candidate.source_node_id === element.source?.source_node_id &&
      candidate.source_handle === element.source?.source_handle
  );
  const text = source?.preview_text?.trim();
  if (!text) {
    return {
      text: "等待上游运行",
      status: "unavailable"
    };
  }
  return {
    text,
    status:
      source?.text_preview_status === "configured"
        ? "configured"
        : "resolved"
  };
}
