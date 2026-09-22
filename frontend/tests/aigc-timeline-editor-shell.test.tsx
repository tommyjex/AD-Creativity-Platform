import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AigcTimelineEditorShell } from "@/components/workspace/aigc/aigc-timeline-editor-shell";
import type { AigcPipeline, AigcV2Node } from "@/lib/aigc/types";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn()
}));
const apiMocks = vi.hoisted(() => ({
  createAigcRun: vi.fn(),
  updateAigcPipeline: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      createAigcRun: apiMocks.createAigcRun,
      updateAigcPipeline: apiMocks.updateAigcPipeline
    }
  };
});

const node: Extract<AigcV2Node, { type: "multi_track_edit" }> = {
  id: "edit-node",
  type: "multi_track_edit",
  position: { x: 0, y: 0 },
  size: { width: 240, height: 160 },
  config: {
    canvas: {
      mode: "custom",
      width: 1920,
      height: 1080,
      background_color: "#000000FF"
    },
    output: { format: "mp4", fps: 30 },
    tracks: [
      {
        id: "text-track",
        name: "标题",
        type: "text",
        order: 0,
        hidden: false,
        muted: false,
        elements: [
          {
            id: "text-1",
            type: "text",
            source: null,
            inline_text: "新品发布",
            target_time: { start_ms: 0, end_ms: 3_000 },
            loop: false,
            transform: {
              x: 100,
              y: 100,
              width: 600,
              height: 120,
              rotation: 0
            },
            style: {
              font_size: 48,
              color: "#FFFFFFFF",
              bold: true,
              italic: false,
              underline: false,
              background_color: "#00000000"
            }
          }
        ]
      }
    ]
  }
};

const pipeline: AigcPipeline = {
  id: "pipeline-1",
  name: "广告成片",
  description: "",
  definition: {
    schemaVersion: 2,
    nodes: [node],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  },
  source_template_id: null,
  source_template_revision: null,
  revision: 4,
  latest_run_status: null,
  thumbnail_asset_id: null,
  thumbnail: null,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z"
};

describe("AigcTimelineEditorShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.updateAigcPipeline.mockResolvedValue({
      ...pipeline,
      revision: 5
    });
    apiMocks.createAigcRun.mockResolvedValue({
      run: { id: "run-1" },
      nodes: []
    });
  });

  it("renders the full-screen editor with reachable route actions", () => {
    render(<AigcTimelineEditorShell node={node} pipeline={pipeline} />);

    expect(screen.getByTestId("aigc-timeline-editor")).toHaveClass(
      "h-[100dvh]",
      "bg-[#0b0d10]"
    );
    expect(screen.getByRole("region", { name: "画面预览" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "多轨时间线" })).toBeInTheDocument();
    expect(screen.getByText(/最终效果以 MediaKit 合成为准/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存到节点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "执行剪辑" })).toBeEnabled();
  });

  it("saves before execution and returns to the pipeline canvas", async () => {
    render(<AigcTimelineEditorShell node={node} pipeline={pipeline} />);

    fireEvent.click(screen.getByRole("button", { name: "执行剪辑" }));

    await waitFor(() => {
      expect(apiMocks.updateAigcPipeline).toHaveBeenCalledWith(
        "pipeline-1",
        expect.objectContaining({ expected_revision: 4 })
      );
      expect(apiMocks.createAigcRun).toHaveBeenCalledWith(
        "pipeline-1",
        {
          expected_revision: 5,
          mode: "from_node",
          start_node_id: "edit-node"
        },
        expect.any(String)
      );
    });
    expect(router.push).toHaveBeenCalledWith(
      "/workspace/aigc/pipelines/pipeline-1"
    );
  });

  it("keeps the page open and explains revision conflicts", async () => {
    apiMocks.updateAigcPipeline.mockRejectedValue(
      Object.assign(new Error("revision conflict"), { status: 409 })
    );
    render(<AigcTimelineEditorShell node={node} pipeline={pipeline} />);

    fireEvent.click(screen.getByRole("button", { name: "执行剪辑" }));

    expect(
      await screen.findByText(/Pipeline 已被其他页面更新/)
    ).toBeInTheDocument();
    expect(apiMocks.createAigcRun).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeEnabled();
  });
});
