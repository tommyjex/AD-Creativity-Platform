import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  StoryboardShotEditorDialog,
  type PreviousShotLastFrameOption,
  type StoryboardEditorFeedback
} from "@/components/workspace/storyboard-shot-editor-dialog";
import type {
  Asset,
  StoryboardShot,
  StoryboardShotVideoConfig
} from "@/lib/api-types";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...original,
    getBackendBaseUrl: () => "http://backend.local"
  };
});

const shot: StoryboardShot = {
  created_at: "2026-08-10T08:40:00Z",
  description: "地铁车厢内，主角拿出便携咖啡机。",
  duration_seconds: 3,
  id: "shot-1",
  first_frame_asset_id: "image-1",
  first_frame_source_video_asset_id: null,
  image_asset_id: null,
  index: 1,
  is_merged: false,
  merge_source_count: 0,
  narration: "随时喝到好咖啡。",
  project_id: "project-1",
  reference_audio_asset_ids: ["audio-1"],
  reference_image_asset_ids: ["image-1"],
  reference_video_asset_ids: ["video-1"],
  status: "succeeded",
  title: "地铁突生慌乱",
  updated_at: "2026-08-10T08:40:00Z",
  video_asset_id: null,
  video_prompt: "使用参考图1作为人物造型。",
  visual_prompt: "真实生活流"
};

const config: StoryboardShotVideoConfig = {
  effective_video_prompt: "使用参考图1作为人物造型。",
  first_frame_asset_id: "image-1",
  first_frame_source_video_asset_id: null,
  reference_audio_asset_ids: ["audio-1"],
  reference_image_asset_ids: ["image-1"],
  reference_video_asset_ids: ["video-1"],
  shot_id: shot.id,
  shot_index: shot.index,
  video_asset_id: null,
  video_prompt: "使用参考图1作为人物造型。"
};

const assets: Asset[] = [
  assetFixture({
    id: "image-1",
    metadata: { name: "人物造型参考" },
    mime_type: "image/png",
    type: "uploaded_image",
    url: "https://assets.example.com/image-1.png"
  }),
  assetFixture({
    id: "video-1",
    metadata: { name: "镜头运动参考" },
    mime_type: "video/mp4",
    type: "uploaded_video",
    url: "https://assets.example.com/video-1.mp4"
  }),
  assetFixture({
    id: "audio-1",
    metadata: { name: "环境声音参考" },
    mime_type: "audio/mpeg",
    type: "uploaded_audio",
    url: "https://assets.example.com/audio-1.mp3"
  })
];

describe("StoryboardShotEditorDialog", () => {
  it("places reference thumbnails before the prompt and previews media separately", async () => {
    render(<DialogHarness />);
    const dialog = screen.getByRole("dialog", { name: shot.title! });
    const references = within(dialog).getByRole("heading", {
      name: "参考素材"
    });
    const prompt = within(dialog).getByRole("heading", {
      name: "视频生成提示词"
    });
    const firstFrame = within(dialog).getByRole("heading", { name: "首帧" });
    const otherReferences = within(dialog).getByText("其他参考素材");

    expect(
      references.compareDocumentPosition(prompt) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      references.compareDocumentPosition(firstFrame) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      firstFrame.compareDocumentPosition(otherReferences) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      within(dialog).getByTestId("storyboard-editor-scroll-region")
    ).toHaveClass("min-h-0", "overflow-y-auto", "overscroll-contain");
    const compactImages = within(dialog).getAllByRole("img", {
      name: "人物造型参考 缩略图"
    });
    expect(compactImages[0]).toHaveAttribute(
      "src",
      "https://assets.example.com/image-1.png"
    );
    expect(compactImages[0]).toHaveClass("h-20");
    expect(compactImages[1]).toHaveClass("h-20");
    expect(
      within(dialog).getByRole("button", { name: "移除首帧" })
    ).toBeInTheDocument();
    expect(within(dialog).getByText("参考视频 1 · 参考音频 1")).toBeVisible();
    expect(
      within(dialog).getByLabelText("镜头运动参考 视频缩略图")
    ).not.toBeVisible();
    fireEvent.click(within(dialog).getByText("其他参考素材"));
    expect(
      within(dialog).getByLabelText("镜头运动参考 视频缩略图")
    ).toBeVisible();
    expect(within(dialog).getByText("参考音频1")).toBeVisible();

    const textarea = within(dialog).getByLabelText(
      "编辑视频生成提示词"
    ) as HTMLTextAreaElement;
    const initialValue = textarea.value;
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "预览参考素材 参考图1 人物造型参考"
      })
    );

    const previewDialog = await screen.findByRole("dialog", {
      name: /参考图1.*人物造型参考/
    });
    expect(
      within(previewDialog).getByRole("img", {
        name: "人物造型参考 完整预览"
      })
    ).toBeInTheDocument();
    expect(textarea).toHaveValue(initialValue);
  });

  it("shows thumbnails for selectable assets from the project library", () => {
    const selectableAssets = [
      ...assets,
      assetFixture({
        id: "image-2",
        metadata: { name: "候选人物参考" },
        mime_type: "image/png",
        type: "uploaded_image",
        url: "https://assets.example.com/image-2.png"
      }),
      assetFixture({
        id: "video-2",
        metadata: { name: "候选运镜参考" },
        mime_type: "video/mp4",
        type: "uploaded_video",
        url: "https://assets.example.com/video-2.mp4"
      }),
      assetFixture({
        id: "audio-2",
        metadata: { name: "候选环境音" },
        mime_type: "audio/mpeg",
        type: "uploaded_audio",
        url: null
      })
    ];

    render(
      <DialogHarness
        assetsOverride={selectableAssets}
        configOverride={{
          ...config,
          first_frame_asset_id: null,
          first_frame_source_video_asset_id: null
        }}
      />
    );
    const dialog = screen.getByRole("dialog", { name: shot.title! });

    fireEvent.click(within(dialog).getByText("从资产库选择参考图"));
    expect(
      within(dialog).getAllByRole("img", { name: "候选人物参考 缩略图" })[0]
    ).toHaveAttribute("src", "https://assets.example.com/image-2.png");
    expect(
      within(dialog).getAllByRole("button", {
        name: "选择资产 候选人物参考"
      })[0]
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByText("其他参考素材"));
    fireEvent.click(within(dialog).getByText("从资产库选择参考视频"));
    expect(
      within(dialog).getByLabelText("候选运镜参考 视频缩略图")
    ).toHaveAttribute("src", "https://assets.example.com/video-2.mp4");

    fireEvent.click(within(dialog).getByText("从资产库选择参考音频"));
    expect(within(dialog).getByText("候选环境音 暂无缩略图")).toHaveClass(
      "sr-only"
    );
  });

  it("offers the previous shot last frame without selecting it automatically", () => {
    const onSetPreviousShotLastFrame = vi.fn();
    render(
      <DialogHarness
        configOverride={{
          ...config,
          first_frame_asset_id: null,
          first_frame_source_video_asset_id: null,
          reference_audio_asset_ids: [],
          reference_image_asset_ids: [],
          reference_video_asset_ids: []
        }}
        onSetPreviousShotLastFrame={onSetPreviousShotLastFrame}
        previousShotLastFrame={{
          previewUrl: "http://backend.local/api/assets/video-previous/last-frame",
          previousShotIndex: 1,
          sourceVideoAssetId: "video-previous"
        }}
      />
    );

    const dialog = screen.getByRole("dialog", { name: shot.title! });
    expect(within(dialog).getByText("来自分镜 1")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: "上一分镜尾帧缩略图" })
    ).toHaveAttribute(
      "src",
      "http://backend.local/api/assets/video-previous/last-frame"
    );
    expect(onSetPreviousShotLastFrame).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "设为首帧" })
    );
    expect(onSetPreviousShotLastFrame).toHaveBeenCalledWith("video-previous");
  });

  it("blocks conflicting additions while keeping removal actions available", () => {
    render(<DialogHarness />);
    const dialog = screen.getByRole("dialog", { name: shot.title! });

    expect(
      within(dialog).getByText(
        "首帧控制不能与参考图、参考视频或参考音频同时使用，请移除其中一类素材后重试。"
      )
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("上传本地参考图")).toBeDisabled();
    expect(within(dialog).getByLabelText("上传本地首帧")).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "移除首帧" })
    ).toBeEnabled();
    expect(
      within(dialog).getByRole("button", {
        name: "移除参考素材 人物造型参考"
      })
    ).toBeEnabled();
  });

  it("explains which input mode must be cleared before switching", () => {
    const { rerender } = render(
      <DialogHarness
        configOverride={{
          ...config,
          reference_audio_asset_ids: [],
          reference_image_asset_ids: [],
          reference_video_asset_ids: []
        }}
      />
    );
    let dialog = screen.getByRole("dialog", { name: shot.title! });
    expect(
      within(dialog).getAllByText(
        "已启用首帧控制，如需添加参考素材，请先移除首帧。"
      ).length
    ).toBeGreaterThan(0);
    expect(within(dialog).getByLabelText("上传本地参考图")).toBeDisabled();

    rerender(
      <DialogHarness
        configOverride={{
          ...config,
          first_frame_asset_id: null,
          first_frame_source_video_asset_id: null
        }}
      />
    );
    dialog = screen.getByRole("dialog", { name: shot.title! });
    expect(
      within(dialog).getByText(
        "当前分镜已有参考素材，如需使用首帧控制，请先移除全部参考素材。"
      )
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("上传本地首帧")).toBeDisabled();
  });

  it("inserts a reference at the textarea cursor and saves without closing", () => {
    const onSave = vi.fn();
    render(<DialogHarness onSave={onSave} />);
    const dialog = screen.getByRole("dialog", { name: shot.title! });
    const textarea = within(dialog).getByLabelText(
      "编辑视频生成提示词"
    ) as HTMLTextAreaElement;

    fireEvent.click(within(dialog).getByText("其他参考素材"));
    textarea.focus();
    textarea.setSelectionRange(2, 2);
    fireEvent.select(textarea);
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "插入引用 参考视频1 镜头运动参考"
      })
    );

    expect(textarea).toHaveValue(
      "使用 (参考@视频1) 参考图1作为人物造型。"
    );
    expect(
      within(dialog).getByText(
        "点击素材卡片会在光标处插入“(参考@图1)”“(参考@视频1)”等标准引用。"
      )
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "保存提示词" })
    );
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("dialog", { name: shot.title! })
    ).toBeInTheDocument();
  });

  it("shows the AI optimization action and its serial loading state", () => {
    const onOptimize = vi.fn();
    const { rerender } = render(
      <DialogHarness onOptimize={onOptimize} />
    );
    let dialog = screen.getByRole("dialog", { name: shot.title! });
    const optimizeButton = within(dialog).getByRole("button", {
      name: "AI 优化视频生成提示词"
    });

    expect(optimizeButton).toBeEnabled();
    fireEvent.click(optimizeButton);
    expect(onOptimize).toHaveBeenCalledTimes(1);

    rerender(
      <DialogHarness
        onOptimize={onOptimize}
        pendingAction={`optimize:${shot.id}`}
      />
    );
    dialog = screen.getByRole("dialog", { name: shot.title! });
    expect(
      within(dialog).getByRole("button", {
        name: "AI 优化视频生成提示词"
      })
    ).toBeDisabled();
    expect(within(dialog).getByText("优化中")).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("编辑视频生成提示词")
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "保存提示词" })
    ).toBeDisabled();
  });

  it("asks for confirmation before discarding an unsaved prompt", () => {
    render(<DialogHarness />);
    const dialog = screen.getByRole("dialog", { name: shot.title! });
    fireEvent.change(within(dialog).getByLabelText("编辑视频生成提示词"), {
      target: { value: "尚未保存的新提示词" }
    });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "关闭分镜编辑弹窗"
      })
    );

    const confirmDialog = screen.getByRole("dialog", {
      name: "提示词尚未保存"
    });
    expect(confirmDialog).toBeInTheDocument();
    fireEvent.click(
      within(confirmDialog).getByRole("button", { name: "继续编辑" })
    );
    expect(
      screen.getByRole("dialog", { name: shot.title! })
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("dialog", { name: shot.title! })).getByRole(
        "button",
        { name: "取消" }
      )
    );
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "提示词尚未保存" })
      ).getByRole("button", { name: "放弃修改" })
    );
    expect(
      screen.queryByRole("dialog", { name: shot.title! })
    ).not.toBeInTheDocument();
  });

  it("shows loading and retry states without rendering stale inputs", () => {
    const { rerender } = render(
      <DialogHarness configOverride={undefined} isConfigLoading />
    );
    expect(screen.getByText("正在加载最新分镜配置")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("编辑视频生成提示词")
    ).not.toBeInTheDocument();

    rerender(
      <DialogHarness
        configLoadError="请求未完成，请检查网络连接后重试。"
        configOverride={undefined}
      />
    );
    expect(
      screen.getByRole("button", { name: "重新加载" })
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("编辑视频生成提示词")
    ).not.toBeInTheDocument();
  });
});

function DialogHarness({
  assetsOverride = assets,
  configLoadError = null,
  configOverride = config,
  isConfigLoading = false,
  onOptimize = vi.fn(),
  onSave = vi.fn(),
  onSetPreviousShotLastFrame = vi.fn(),
  pendingAction = null,
  previousShotLastFrame = {
    previewUrl: null,
    previousShotIndex: null,
    sourceVideoAssetId: null
  }
}: {
  assetsOverride?: Asset[];
  configLoadError?: string | null;
  configOverride?: StoryboardShotVideoConfig;
  isConfigLoading?: boolean;
  onOptimize?: () => void;
  onSave?: () => void;
  onSetPreviousShotLastFrame?: (sourceVideoAssetId: string) => void;
  pendingAction?: string | null;
  previousShotLastFrame?: PreviousShotLastFrameOption;
}) {
  const initialPrompt =
    configOverride?.video_prompt ??
    configOverride?.effective_video_prompt ??
    "";
  const [open, setOpen] = useState(true);
  const [draftPrompt, setDraftPrompt] = useState(initialPrompt);
  const [savedPrompt, setSavedPrompt] = useState(initialPrompt);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [feedback] = useState<StoryboardEditorFeedback | null>(null);

  function requestClose() {
    if (draftPrompt !== savedPrompt) {
      setIsConfirmOpen(true);
      return;
    }
    setOpen(false);
  }

  return (
    <StoryboardShotEditorDialog
      assets={assetsOverride}
      config={configOverride}
      configLoadError={configLoadError}
      draftPrompt={draftPrompt}
      feedback={feedback}
      isConfigLoading={isConfigLoading}
      isDiscardConfirmOpen={isConfirmOpen}
      onAttach={vi.fn()}
      onChangePrompt={setDraftPrompt}
      onConfirmDiscard={() => {
        setDraftPrompt(savedPrompt);
        setIsConfirmOpen(false);
        setOpen(false);
      }}
      onContinueEditing={() => setIsConfirmOpen(false)}
      onClearFirstFrame={vi.fn()}
      onRemove={vi.fn()}
      onRequestClose={requestClose}
      onRetryConfig={vi.fn()}
      onOptimize={onOptimize}
      onSave={() => {
        setSavedPrompt(draftPrompt);
        onSave();
      }}
      onSetPreviousShotLastFrame={onSetPreviousShotLastFrame}
      onSetFirstFrame={vi.fn()}
      onUpload={vi.fn()}
      onUploadFirstFrame={vi.fn()}
      open={open}
      pendingAction={pendingAction}
      previousShotLastFrame={previousShotLastFrame}
      shot={shot}
    />
  );
}

function assetFixture(overrides: Partial<Asset> = {}): Asset {
  return {
    category: "reference",
    created_at: "2026-08-10T09:00:00Z",
    id: "asset-1",
    metadata: { name: "参考素材" },
    mime_type: "image/png",
    object_key: null,
    project_id: "project-1",
    size_bytes: 1024,
    source_task_id: null,
    stage: "video",
    status: "succeeded",
    type: "uploaded_image",
    updated_at: "2026-08-10T09:00:00Z",
    url: null,
    ...overrides
  };
}
