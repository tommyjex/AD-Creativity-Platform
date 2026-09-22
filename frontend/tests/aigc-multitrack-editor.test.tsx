import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AigcMultitrackEditor } from "@/components/workspace/aigc/aigc-multitrack-editor";
import { AigcMultitrackInspector } from "@/components/workspace/aigc/aigc-multitrack-inspector";
import { MEDIAKIT_FONT_PRESETS } from "@/lib/aigc/multitrack-fonts";
import type { MultiTrackEditConfig } from "@/lib/aigc/types";

const CUSTOM_FONT_URL =
  "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf";
const fontFaceAdd = vi.fn();
const fontFaceLoad = vi.fn<(face: object) => Promise<object>>();
const MockFontFace = vi.fn(function (family: string, source: string) {
  const face = {
    family,
    load: () => fontFaceLoad(face),
    source
  };
  return face;
});
const originalDocumentFonts = Object.getOwnPropertyDescriptor(document, "fonts");

beforeEach(() => {
  fontFaceLoad.mockImplementation(() => new Promise(() => undefined));
  vi.stubGlobal("FontFace", MockFontFace);
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { add: fontFaceAdd }
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  if (originalDocumentFonts) {
    Object.defineProperty(document, "fonts", originalDocumentFonts);
  } else {
    Reflect.deleteProperty(document, "fonts");
  }
});

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
    available: true,
    mime_type: "video/mp4",
    preview_url: "http://localhost:8000/api/assets/video-asset/content"
  }
];

function projectWithTextFont(fontType: string | null): MultiTrackEditConfig {
  const candidate = structuredClone(project);
  const element = candidate.tracks[1]?.elements[0];
  if (!element || element.type !== "text") {
    throw new Error("expected text fixture");
  }
  element.style.font_type = fontType;
  return candidate;
}

describe("AigcMultitrackEditor", () => {
  it("renders the approved workbench regions and interactive preview", () => {
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
    expect(screen.getByRole("region", { name: "画面预览" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "多轨时间线" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "属性检查器" })).toBeInTheDocument();
    expect(screen.getAllByText("新品发布").length).toBeGreaterThan(0);
    expect(screen.getByText(/最终效果以 MediaKit 合成为准/)).toBeInTheDocument();
    expect(screen.getAllByText("主画面").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("背景视频 source-video")).toHaveAttribute(
      "data-preview-time-seconds",
      "0"
    );
    expect(screen.getByLabelText("时间标尺")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-playhead")).toBeInTheDocument();
  });

  it("renders actual upstream text consistently and converts it explicitly", () => {
    const upstreamProject = structuredClone(project);
    const textElement = upstreamProject.tracks[1]?.elements[0];
    if (!textElement || textElement.type !== "text") {
      throw new Error("expected text fixture");
    }
    textElement.source = {
      source_handle: "text",
      source_node_id: "copy-node"
    };
    textElement.inline_text = null;
    textElement.target_time.start_ms = 0;
    const upstreamSources = [
      ...sources,
      {
        available: true,
        kind: "text" as const,
        preview_text: "真实上游文案",
        text_preview_status: "resolved" as const,
        source_handle: "text",
        source_node_id: "copy-node"
      }
    ];
    render(
      <AigcMultitrackEditor
        config={upstreamProject}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={upstreamSources}
        title="广告成片"
      />
    );

    expect(screen.getByTestId("preview-element-text-1")).toHaveTextContent(
      "真实上游文案"
    );
    const clip = screen.getByRole("button", {
      name: "选择片段 真实上游文案"
    });
    fireEvent.click(clip);
    expect(screen.getByLabelText("上游文字预览")).toHaveValue("真实上游文案");

    fireEvent.click(screen.getByRole("button", { name: "转为内联文字" }));
    expect(screen.getByLabelText("内联文字")).toHaveValue("真实上游文案");

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByLabelText("上游文字预览")).toHaveValue("真实上游文案");
  });

  it("selects and moves visible text on the preview as one history step", () => {
    const onSave = vi.fn<(config: MultiTrackEditConfig) => void>();
    const interactiveProject = structuredClone(project);
    interactiveProject.tracks[1]!.elements[0]!.target_time.start_ms = 0;
    render(
      <AigcMultitrackEditor
        config={interactiveProject}
        onExecute={vi.fn()}
        onSave={onSave}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    const stage = screen.getByTestId("multitrack-preview-stage");
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      bottom: 540,
      height: 540,
      left: 0,
      right: 960,
      top: 0,
      width: 960,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    const previewText = screen.getByRole("button", {
      name: "选择文字 text-1"
    });

    fireEvent.pointerDown(previewText, {
      button: 0,
      clientX: 150,
      clientY: 50,
      pointerId: 1
    });
    expect(previewText).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "从右下角缩放 text-1" })
    ).toBeInTheDocument();

    fireEvent.pointerMove(stage, {
      clientX: 250,
      clientY: 100,
      pointerId: 1
    });
    fireEvent.pointerUp(stage, {
      clientX: 250,
      clientY: 100,
      pointerId: 1
    });

    expect(previewText).toHaveStyle({ left: `${(500 / 1920) * 100}%` });
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(previewText).toHaveStyle({ left: `${(300 / 1920) * 100}%` });
  });

  it("previews an image without cropping and resizes it proportionally", () => {
    const interactiveProject = structuredClone(project);
    interactiveProject.tracks.push({
      elements: [
        {
          id: "image-1",
          loop: true,
          source: {
            source_handle: "image",
            source_node_id: "source-image"
          },
          target_time: { end_ms: 3000, start_ms: 0 },
          transform: {
            height: 200,
            rotation: 0,
            width: 400,
            x: 100,
            y: 100
          },
          type: "image"
        }
      ],
      hidden: false,
      id: "image-track",
      muted: false,
      name: "商品图",
      order: 2,
      type: "image"
    });
    render(
      <AigcMultitrackEditor
        config={interactiveProject}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={[
          ...sources,
          {
            available: true,
            kind: "image",
            mime_type: "image/png",
            preview_url:
              "http://localhost:8000/api/assets/image-asset/content",
            source_handle: "image",
            source_node_id: "source-image"
          }
        ]}
        title="广告成片"
      />
    );

    const stage = screen.getByTestId("multitrack-preview-stage");
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      bottom: 540,
      height: 540,
      left: 0,
      right: 960,
      top: 0,
      width: 960,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    const imageElement = screen.getByTestId("preview-element-image-1");
    expect(imageElement.querySelector("img")).toHaveClass("object-contain");
    fireEvent.click(imageElement);

    const handle = screen.getByRole("button", {
      name: "从右下角缩放 image-1"
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 250,
      clientY: 150,
      pointerId: 2
    });
    fireEvent.pointerMove(stage, {
      clientX: 350,
      clientY: 200,
      pointerId: 2
    });
    fireEvent.pointerUp(stage, {
      clientX: 350,
      clientY: 200,
      pointerId: 2
    });

    expect(imageElement).toHaveStyle({
      height: `${(300 / 1080) * 100}%`,
      width: `${(600 / 1920) * 100}%`
    });
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(imageElement).toHaveStyle({
      height: `${(200 / 1080) * 100}%`,
      width: `${(400 / 1920) * 100}%`
    });
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

  it("previews a visual text color gesture and undoes it in one step", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "选择文字颜色" }));
    const alpha = screen.getByLabelText("文字颜色透明度");
    fireEvent.pointerDown(alpha, { pointerId: 8 });
    fireEvent.change(alpha, { target: { value: "25" } });
    expect(screen.getByLabelText("文字颜色 RGBA")).toHaveValue("#FFFFFF40");
    fireEvent.pointerUp(alpha, { pointerId: 8 });

    expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByLabelText("文字颜色 RGBA")).toHaveValue("#FFFFFFFF");
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
  });

  it("deletes an empty track directly from its action menu", () => {
    const candidate = structuredClone(project);
    candidate.tracks.push({
      id: "empty-audio-track",
      name: "空音轨",
      type: "audio",
      order: 2,
      hidden: false,
      muted: false,
      elements: []
    });
    render(
      <AigcMultitrackEditor
        config={candidate}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "轨道操作：空音轨" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "删除轨道" }));

    expect(screen.queryByTitle("空音轨")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms non-empty track deletion and restores it in one undo step", () => {
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
    fireEvent.click(
      screen.getByRole("button", { name: "轨道操作：标题" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "删除轨道" }));

    const dialog = screen.getByRole("dialog", {
      name: "删除轨道“标题”"
    });
    expect(dialog).toHaveTextContent("轨道内 1 个片段将一并删除。");
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(screen.getByTitle("标题")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "轨道操作：标题" })
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "删除轨道" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "删除轨道“标题”" })
      ).getByRole("button", { name: "确认删除轨道" })
    );

    expect(screen.queryByTitle("标题")).not.toBeInTheDocument();
    expect(screen.queryByText("片段属性")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByTitle("标题")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "选择片段 新品发布" })
    ).toBeInTheDocument();
  });

  it("keeps hide and mute actions in the track menu", () => {
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

    const openMenu = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "轨道操作：标题" })
      );
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "隐藏轨道" }));
    openMenu();
    expect(
      screen.getByRole("menuitem", { name: "显示轨道" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "轨道静音" }));
    openMenu();
    expect(
      screen.getByRole("menuitem", { name: "取消静音" })
    ).toBeInTheDocument();
  });

  it("shows the Chinese limitation for the unsupported preset", () => {
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
    expect(
      screen.getByRole("button", { name: "预置字体" })
    ).toHaveAttribute("aria-pressed", "true");

    const presetSelect = screen.getByRole("combobox", {
      name: "预置字体"
    });
    expect(presetSelect).toHaveValue("");
    expect(presetSelect.querySelectorAll("option")).toHaveLength(
      MEDIAKIT_FONT_PRESETS.length + 1
    );
    for (const preset of MEDIAKIT_FONT_PRESETS) {
      expect(
        screen.getByRole("option", { name: preset.label })
      ).toHaveValue(preset.id);
    }

    fireEvent.change(presetSelect, { target: { value: "1187225" } });
    expect(
      screen.getByText("该字体不支持中文，请仅用于拉丁字符。")
    ).toBeInTheDocument();
    expect(
      screen.getByText("预置字体仅用于 MediaKit 合成，最终字形以 MediaKit 合成为准。")
    ).toBeInTheDocument();
    expect(MockFontFace).not.toHaveBeenCalled();
  });

  it("loads one cached custom font per URL and applies its stable family", async () => {
    const fontUrl = "https://fonts.example.com/preview-success.ttf";
    fontFaceLoad.mockImplementationOnce(async (face) => face);
    const candidate = projectWithTextFont(fontUrl);
    const firstText = candidate.tracks[1]!.elements[0]!;
    if (firstText.type !== "text") throw new Error("expected text fixture");
    firstText.target_time.start_ms = 0;
    const secondText = structuredClone(firstText);
    secondText.id = "text-2";
    secondText.transform.x = 1200;
    candidate.tracks[1]!.elements.push(secondText);

    render(
      <AigcMultitrackEditor
        config={candidate}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    await waitFor(() => expect(MockFontFace).toHaveBeenCalledTimes(1));
    const family = MockFontFace.mock.calls[0]?.[0];
    expect(family).toMatch(/^aigc-custom-font-/);
    expect(MockFontFace).toHaveBeenCalledWith(family, `url("${fontUrl}")`);
    await waitFor(() =>
      expect(screen.getByTestId("preview-element-text-1")).toHaveStyle({
        fontFamily: family
      })
    );
    expect(screen.getByTestId("preview-element-text-2")).toHaveStyle({
      fontFamily: family
    });
    expect(fontFaceAdd).toHaveBeenCalledTimes(1);
  });

  it("falls back after a custom font failure without adding a validation issue", async () => {
    const fontUrl = "https://fonts.example.com/preview-failure.otf";
    fontFaceLoad.mockRejectedValueOnce(new Error("font unavailable"));
    const candidate = projectWithTextFont(fontUrl);
    candidate.tracks[1]!.elements[0]!.target_time.start_ms = 0;
    const onExecute = vi.fn();

    render(
      <AigcMultitrackEditor
        config={candidate}
        onExecute={onExecute}
        onSave={vi.fn()}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "选择片段 新品发布" }));
    expect(screen.getByTestId("preview-element-text-1").style.fontFamily).toBe("");
    expect(
      await screen.findByText(
        "浏览器无法加载字体，MediaKit 合成仍会尝试使用该 URL"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/执行前检查/)).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-element-text-1").style.fontFamily).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "执行剪辑" }));
    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
  });

  it("ignores a stale font failure after switching inspector elements", async () => {
    const firstUrl = "https://fonts.example.com/stale-first.ttf";
    const secondUrl = "https://fonts.example.com/current-second.ttf";
    const firstLoad = deferred<object>();
    const secondLoad = deferred<object>();
    fontFaceLoad
      .mockImplementationOnce(() => firstLoad.promise)
      .mockImplementationOnce(() => secondLoad.promise);
    const candidate = projectWithTextFont(firstUrl);
    const firstText = candidate.tracks[1]!.elements[0]!;
    if (firstText.type !== "text") throw new Error("expected text fixture");
    const secondText = structuredClone(firstText);
    secondText.id = "text-current";
    secondText.style.font_type = secondUrl;
    candidate.tracks[1]!.elements.push(secondText);
    const { rerender } = render(
      <AigcMultitrackInspector
        config={candidate}
        dispatch={vi.fn()}
        issues={[]}
        selectedElement={firstText}
        selectedTrack={candidate.tracks[1]!}
        sources={sources}
      />
    );

    rerender(
      <AigcMultitrackInspector
        config={candidate}
        dispatch={vi.fn()}
        issues={[]}
        selectedElement={secondText}
        selectedTrack={candidate.tracks[1]!}
        sources={sources}
      />
    );
    await act(async () => {
      firstLoad.reject(new Error("stale failure"));
      await Promise.resolve();
    });
    expect(
      screen.queryByText(
        "浏览器无法加载字体，MediaKit 合成仍会尝试使用该 URL"
      )
    ).not.toBeInTheDocument();

    await act(async () => {
      secondLoad.resolve({});
      await Promise.resolve();
    });
    expect(
      screen.queryByText(
        "浏览器无法加载字体，MediaKit 合成仍会尝试使用该 URL"
      )
    ).not.toBeInTheDocument();
  });

  it("blocks save and execute for an invalid custom font URL", () => {
    const onSave = vi.fn<(config: MultiTrackEditConfig) => void>();
    const onExecute = vi.fn<(config: MultiTrackEditConfig) => void>();
    render(
      <AigcMultitrackEditor
        config={project}
        onExecute={onExecute}
        onSave={onSave}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "选择片段 新品发布" }));
    fireEvent.click(screen.getByRole("button", { name: "自定义 URL" }));
    const input = screen.getByLabelText("字体文件 URL");

    fireEvent.change(input, {
      target: { value: "http://fonts.example.com/title.woff2" }
    });
    fireEvent.blur(input);

    expect(
      screen.getByText("请输入公网 HTTPS TTF/OTF 字体文件 URL。")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存到节点" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "执行剪辑" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "保存到节点" }));
    fireEvent.click(screen.getByRole("button", { name: "执行剪辑" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it("commits a cleared custom font as null in one undo step", async () => {
    const onSave = vi.fn<(config: MultiTrackEditConfig) => void>();
    render(
      <AigcMultitrackEditor
        config={projectWithTextFont(CUSTOM_FONT_URL)}
        onExecute={vi.fn()}
        onSave={onSave}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "选择片段 新品发布" }));
    const input = screen.getByLabelText("字体文件 URL");
    expect(input).toHaveValue(CUSTOM_FONT_URL);
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("button", { name: "撤销" })).toBeDisabled();
    fireEvent.blur(input);

    expect(
      screen.getByRole("button", { name: "预置字体" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "撤销" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "保存到节点" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const clearedText = onSave.mock.calls[0]?.[0].tracks[1]?.elements[0];
    expect(clearedText?.type).toBe("text");
    expect(
      clearedText?.type === "text" ? clearedText.style.font_type : undefined
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(
      screen.getByRole("button", { name: "自定义 URL" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("字体文件 URL")).toHaveValue(CUSTOM_FONT_URL);
  });

  it("saves a MediaKit preset for subtitles", async () => {
    const upload = vi.fn().mockResolvedValue("subtitle-font-asset");
    const onSave = vi.fn<(config: MultiTrackEditConfig) => void>();
    render(
      <AigcMultitrackEditor
        config={project}
        onExecute={vi.fn()}
        onSave={onSave}
        onUploadSubtitle={upload}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.change(screen.getByLabelText("上传 SRT 字幕"), {
      target: {
        files: [
          new File(
            ["1\n00:00:00,000 --> 00:00:02,000\n新品发布\n"],
            "font-captions.srt",
            { type: "application/x-subrip" }
          )
        ]
      }
    });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));

    const subtitleInspector = within(
      screen.getByTestId("mobile-inspector-drawer")
    );
    expect(
      subtitleInspector.getByRole("button", { name: "预置字体" })
    ).toHaveAttribute("aria-pressed", "true");
    const presetSelect = subtitleInspector.getByRole("combobox", {
      name: "预置字体"
    });
    expect(presetSelect.querySelectorAll("option")).toHaveLength(
      MEDIAKIT_FONT_PRESETS.length + 1
    );
    fireEvent.change(presetSelect, { target: { value: "SY_Black" } });
    const backgroundColor = subtitleInspector.getByLabelText("背景颜色 RGBA");
    fireEvent.change(backgroundColor, { target: { value: "#11223380" } });
    fireEvent.blur(backgroundColor);
    fireEvent.click(screen.getByRole("button", { name: "保存到节点" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedSubtitle = onSave.mock.calls[0]?.[0].tracks
      .flatMap((track) => track.elements)
      .find((element) => element.type === "subtitle");
    expect(savedSubtitle?.style.font_type).toBe("SY_Black");
    expect(savedSubtitle?.style.background_color).toBe("#11223380");
  });

  it("syncs font mode and value across selection and undo/redo", () => {
    const candidate = projectWithTextFont("SY_Black");
    const customText = structuredClone(candidate.tracks[1]!.elements[0]!);
    if (customText.type !== "text") throw new Error("expected text fixture");
    customText.id = "text-custom";
    customText.inline_text = "自定义字体";
    customText.style.font_type = CUSTOM_FONT_URL;
    candidate.tracks[1]!.elements.push(customText);
    render(
      <AigcMultitrackEditor
        config={candidate}
        onExecute={vi.fn()}
        onSave={vi.fn()}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "选择片段 新品发布" }));
    expect(screen.getByRole("combobox", { name: "预置字体" })).toHaveValue(
      "SY_Black"
    );
    fireEvent.click(screen.getByRole("button", { name: "选择片段 自定义字体" }));
    expect(
      screen.getByRole("button", { name: "自定义 URL" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("字体文件 URL")).toHaveValue(CUSTOM_FONT_URL);

    fireEvent.change(screen.getByLabelText("字体文件 URL"), {
      target: { value: "https://fonts.example.com/updated.otf" }
    });
    fireEvent.keyDown(screen.getByLabelText("字体文件 URL"), { key: "Enter" });
    expect(screen.getByLabelText("字体文件 URL")).toHaveValue(
      "https://fonts.example.com/updated.otf"
    );
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(screen.getByLabelText("字体文件 URL")).toHaveValue(CUSTOM_FONT_URL);
    fireEvent.click(screen.getByRole("button", { name: "重做" }));
    expect(screen.getByLabelText("字体文件 URL")).toHaveValue(
      "https://fonts.example.com/updated.otf"
    );
  });

  it("initializes new text elements with the default font", async () => {
    const onSave = vi.fn<(config: MultiTrackEditConfig) => void>();
    render(
      <AigcMultitrackEditor
        config={project}
        onExecute={vi.fn()}
        onSave={onSave}
        revision={4}
        sources={sources}
        title="广告成片"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "内联文字" }));
    fireEvent.click(screen.getByRole("button", { name: "保存到节点" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedText = onSave.mock.calls[0]?.[0].tracks
      .flatMap((track) => track.elements)
      .find(
        (element) =>
          element.type === "text" && element.inline_text === "输入文字"
      );
    expect(savedText?.type).toBe("text");
    expect(savedText?.type === "text" ? savedText.style.font_type : undefined).toBeNull();
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}
