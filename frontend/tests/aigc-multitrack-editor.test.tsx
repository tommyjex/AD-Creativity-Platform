import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AigcMultitrackEditor } from "@/components/workspace/aigc/aigc-multitrack-editor";
import { AigcMultitrackInspector } from "@/components/workspace/aigc/aigc-multitrack-inspector";
import type { MultiTrackEditConfig } from "@/lib/aigc/types";

const project: MultiTrackEditConfig = {
  canvas: {
    mode: "custom",
    width: 1920,
    height: 1080,
    background_color: "#101216FF"
  },
  output: { format: "mp4", fps: 30 },
  tracks: [
    {
      id: "video-track",
      name: "主画面",
      type: "video",
      order: 0,
      hidden: false,
      muted: false,
      elements: [
        {
          id: "video-1",
          type: "video",
          source: { source_node_id: "source-video", source_handle: "video" },
          target_time: { start_ms: 0, end_ms: 3000 },
          source_trim: { start_ms: 0, end_ms: 3000 },
          loop: false,
          transform: {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            rotation: 0
          },
          speed: 1,
          volume: 1,
          fade_in_ms: 0,
          fade_out_ms: 0,
          transition: null
        }
      ]
    },
    {
      id: "text-track",
      name: "标题",
      type: "text",
      order: 1,
      hidden: false,
      muted: false,
      elements: [
        {
          id: "text-1",
          type: "text",
          source: null,
          inline_text: "新品发布",
          target_time: { start_ms: 500, end_ms: 2500 },
          loop: false,
          transform: {
            x: 300,
            y: 100,
            width: 800,
            height: 160,
            rotation: 0
          },
          style: {
            font_size: 52,
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
};

const sources = [
  {
    source_node_id: "source-video",
    source_handle: "video",
    kind: "video" as const,
    available: true
  }
];

describe("AigcMultitrackEditor", () => {
  it("renders the approved workbench regions and structural preview", () => {
    render(
      <AigcMultitrackEditor
        config={project}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    expect(screen.getByRole("toolbar", { name: "时间线编辑操作" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "结构预览" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "多轨时间线" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "属性检查器" })).toBeInTheDocument();
    expect(screen.getAllByText("新品发布").length).toBeGreaterThan(0);
    expect(screen.getByText("最终效果以 MediaKit 合成为准")).toBeInTheDocument();
    expect(screen.getAllByText("主画面").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("时间标尺")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-playhead")).toBeInTheDocument();
  });

  it("updates precise element controls through history and supports undo", () => {
    render(
      <AigcMultitrackEditor
        config={project}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "选择片段 新品发布" }));
    fireEvent.change(screen.getByLabelText("开始时间（毫秒）"), {
      target: { value: "750" }
    });
    fireEvent.change(screen.getByLabelText("位置 X"), {
      target: { value: "420" }
    });
    fireEvent.click(screen.getByRole("button", { name: "斜体" }));

    expect(screen.getByText("有未保存修改")).toBeInTheDocument();
    expect(screen.getByLabelText("开始时间（毫秒）")).toHaveValue(750);
    expect(screen.getByLabelText("位置 X")).toHaveValue(420);
    expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByRole("button", { name: "斜体" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("adds a clip from a direct upstream source", () => {
    render(
      <AigcMultitrackEditor
        config={{ ...project, tracks: project.tracks.slice(1) }}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.change(screen.getByLabelText("添加上游素材"), {
      target: { value: "source-video\u0000video" }
    });

    expect(
      screen.getByRole("button", { name: "选择片段 source-video" })
    ).toBeInTheDocument();
    expect(screen.getByText("有未保存修改")).toBeInTheDocument();
  });

  it("validates and uploads SRT into an exclusive subtitle track", async () => {
    const upload = vi.fn().mockResolvedValue("subtitle-asset-1");
    render(
      <AigcMultitrackEditor
        config={project}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        onUploadSubtitle={upload}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    const input = screen.getByLabelText("上传 SRT 字幕");
    fireEvent.change(input, {
      target: { files: [new File(["not srt"], "captions.txt", { type: "text/plain" })] }
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("仅支持 .srt");
    expect(upload).not.toHaveBeenCalled();

    fireEvent.change(input, {
      target: {
        files: [
          new File(
            ["1\n00:00:00,000 --> 00:00:02,000\n新品发布\n"],
            "captions.srt",
            { type: "application/x-subrip" }
          )
        ]
      }
    });

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("captions.srt")).toBeInTheDocument();
    expect(screen.getByText(/模板不会保留该 SRT 资产 ID/)).toBeInTheDocument();
  });

  it("uses a mutually exclusive inspector drawer below 1024px", () => {
    render(
      <AigcMultitrackEditor
        config={project}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    const drawer = screen.getByTestId("mobile-inspector-drawer");
    expect(drawer).toHaveClass("lg:hidden");
    fireEvent.click(screen.getByRole("button", { name: "打开检查器" }));
    expect(drawer).toHaveAttribute("data-state", "open");
    expect(screen.getByTestId("timeline-scroll-area")).toHaveClass("overflow-x-auto");
  });

  it("shows every execution issue with track, element, and field path", () => {
    const issues = Array.from({ length: 7 }, (_, index) => ({
      code: `issue-${index}`,
      path: `tracks.${index}.elements.0.source_trim.end_ms`,
      message: `错误 ${index + 1}`,
      track_id: `track-${index + 1}`,
      element_id: `element-${index + 1}`
    }));

    render(
      <AigcMultitrackInspector
        config={project}
        dispatch={vi.fn()}
        issues={issues}
        selectedElement={null}
        selectedTrack={null}
        sources={sources}
      />
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByText("错误 7")).toBeInTheDocument();
    expect(screen.getByText("轨道 track-7")).toBeInTheDocument();
    expect(screen.getByText("元素 element-7")).toBeInTheDocument();
    expect(
      screen.getByText("tracks.6.elements.0.source_trim.end_ms")
    ).toBeInTheDocument();
  });
});
