import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolsWorkspace } from "@/components/workspace/tools-workspace";
import type { Asset, ToolTask } from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  deleteToolTask: vi.fn(),
  deleteToolAsset: vi.fn(),
  generateToolVideo: vi.fn(),
  getToolTask: vi.fn(),
  listToolAssets: vi.fn(),
  listToolTasks: vi.fn(),
  optimizeToolVideoPrompt: vi.fn(),
  retryToolTask: vi.fn(),
  submitFaceBlurVideo: vi.fn(),
  uploadToolAsset: vi.fn()
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiMocks,
  getBackendBaseUrl: () => "http://api.test",
  getUserFacingErrorMessage: () => "请求未完成，请检查网络连接后重试。"
}));

const videoAsset: Asset = {
  category: null,
  created_at: "2026-08-24T12:00:00Z",
  id: "video-input",
  metadata: { name: "人物采访.mp4", tool_asset_kind: "video" },
  mime_type: "video/mp4",
  object_key: "tools/task/video.mp4",
  project_id: null,
  size_bytes: 1024,
  source_task_id: null,
  stage: null,
  status: "succeeded",
  tool_asset_role: "input",
  tool_task_id: null,
  type: "uploaded_video",
  updated_at: "2026-08-24T12:00:00Z",
  url: "/api/assets/video-input/content"
};

const secondVideoAsset: Asset = {
  ...videoAsset,
  id: "video-input-second",
  metadata: { name: "会议记录.mp4", tool_asset_kind: "video" },
  object_key: "tools/task/video-second.mp4",
  url: "/api/assets/video-input-second/content"
};

const imageAsset: Asset = {
  ...videoAsset,
  id: "image-input",
  metadata: { name: "产品参考.png", tool_asset_kind: "image" },
  mime_type: "image/png",
  type: "uploaded_image",
  url: "/api/assets/image-input/content"
};

const secondImageAsset: Asset = {
  ...imageAsset,
  id: "image-input-second",
  metadata: { name: "包装参考.png", tool_asset_kind: "image" },
  url: "/api/assets/image-input-second/content"
};

const projectImageAsset: Asset = {
  ...imageAsset,
  id: "project-image",
  metadata: { name: "项目图片.png" },
  project_id: "project-1",
  tool_asset_role: null,
  url: "/api/assets/project-image/content"
};

const audioAsset: Asset = {
  ...videoAsset,
  id: "audio-input",
  metadata: { name: "品牌配乐.mp3", tool_asset_kind: "audio" },
  mime_type: "audio/mpeg",
  type: "uploaded_audio",
  url: "/api/assets/audio-input/content"
};

const faceBlurOutputAsset: Asset = {
  ...videoAsset,
  id: "video-output",
  metadata: { name: "人物采访-打码后.mp4", tool_asset_kind: "video" },
  object_key: "tools/task/output.mp4",
  tool_asset_role: "output",
  tool_task_id: "task-face-success",
  url: "/api/assets/video-output/content"
};

const secondFaceBlurOutputAsset: Asset = {
  ...faceBlurOutputAsset,
  id: "video-output-second",
  metadata: { name: "会议记录-打码后.mp4", tool_asset_kind: "video" },
  object_key: "tools/task/output-second.mp4",
  tool_task_id: "task-face-second",
  url: "/api/assets/video-output-second/content"
};

const videoGenerationOutputAsset: Asset = {
  ...faceBlurOutputAsset,
  id: "video-generation-output",
  metadata: { name: "产品展示-生成结果.mp4", tool_asset_kind: "video" },
  object_key: "tools/task/video-generation-output.mp4",
  tool_task_id: "task-video-success",
  url: "/api/assets/video-generation-output/content"
};

const failedTask: ToolTask = {
  created_at: "2026-08-24T12:00:00Z",
  error: { code: "generation_failed", message: "服务暂时不可用", detail: null },
  finished_at: "2026-08-24T12:01:00Z",
  id: "task-face",
  input_assets: [
    {
      asset_id: videoAsset.id,
      created_at: "2026-08-24T12:00:00Z",
      kind: "video",
      task_id: "task-face"
    }
  ],
  input_snapshot: {
    mask_mode: "mosaic",
    mask_strength: "medium",
    video_asset_id: videoAsset.id
  },
  provider_task_id: "provider-1",
  retry_of_task_id: null,
  started_at: "2026-08-24T12:00:05Z",
  status: "failed",
  type: "face_blur_video",
  updated_at: "2026-08-24T12:01:00Z"
};

const succeededTask: ToolTask = {
  ...failedTask,
  error: null,
  finished_at: "2026-08-24T12:02:00Z",
  id: "task-face-success",
  status: "succeeded",
  updated_at: "2026-08-24T12:02:00Z"
};

const succeededVideoGenerationTask: ToolTask = {
  ...succeededTask,
  created_at: "2026-08-24T12:00:00Z",
  id: "task-video-success",
  input_snapshot: {
    model: "doubao-seedance-2-5-260628",
    prompt: "产品在晨光中缓慢旋转，配合轻快音乐。",
    reference_video_asset_ids: [videoAsset.id]
  },
  type: "multimodal_video_generation"
};

const secondVideoGenerationOutputAsset: Asset = {
  ...videoGenerationOutputAsset,
  id: "video-generation-output-second",
  metadata: { name: "会议记录-生成结果.mp4", tool_asset_kind: "video" },
  tool_task_id: "task-video-history",
  url: "/api/assets/video-generation-output-second/content"
};

const historicalVideoGenerationTask: ToolTask = {
  ...succeededVideoGenerationTask,
  created_at: "2026-08-24T11:00:00Z",
  id: "task-video-history",
  input_snapshot: {
    model: "doubao-seedance-2-0-fast-260128",
    prompt: "会议场景中的产品演示。",
    reference_video_asset_ids: [secondVideoAsset.id]
  }
};

function paginatedVideoGenerationTask(index: number): ToolTask {
  return {
    ...succeededVideoGenerationTask,
    created_at: `2026-08-24T12:${String(index).padStart(2, "0")}:00Z`,
    id: `task-video-page-${index}`,
    input_snapshot: {
      model: "doubao-seedance-2-5-260628",
      prompt: `分页任务 ${index}`,
      reference_video_asset_ids: [videoAsset.id]
    }
  };
}

const secondSucceededTask: ToolTask = {
  ...succeededTask,
  created_at: "2026-08-24T12:05:00Z",
  finished_at: "2026-08-24T12:06:00Z",
  id: "task-face-second",
  input_assets: [
    {
      asset_id: secondVideoAsset.id,
      created_at: "2026-08-24T12:05:00Z",
      kind: "video",
      task_id: "task-face-second"
    }
  ],
  input_snapshot: {
    mask_mode: "blur",
    mask_strength: "high",
    video_asset_id: secondVideoAsset.id
  },
  updated_at: "2026-08-24T12:06:00Z"
};

function openReferenceAssetDialog(label: string) {
  fireEvent.click(screen.getByLabelText(label));
  return screen.getByRole("dialog");
}

function chooseDialogAsset(dialog: HTMLElement, name: string) {
  fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(name) }));
}

describe("ToolsWorkspace", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:uploaded-video-preview")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
  });

  it("renders both independent tool tabs and restores the latest task", () => {
    render(
      <ToolsWorkspace
        initialAssets={[videoAsset, imageAsset]}
        initialTasks={[failedTask]}
      />
    );

    expect(screen.getByRole("tab", { name: "视频人物打码" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByText("服务暂时不可用")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开人物打码任务 ${failedTask.id}`
      })
    );
    expect(screen.getByText("服务暂时不可用")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试任务" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    expect(
      screen.getByRole("textbox", { name: "创作提示词" })
    ).toBeInTheDocument();
    const videoPanel = screen
      .getByRole("textbox", { name: "创作提示词" })
      .closest("div.grid");
    expect(videoPanel).not.toBeNull();
    expect(videoPanel).toHaveAttribute(
      "class",
      "grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]"
    );
    expect(
      videoPanel?.className
        .split(" ")
        .filter((className) => className.startsWith("grid-cols-"))
    ).toEqual([]);
    expect(screen.getByLabelText("模型")).toHaveValue(
      "doubao-seedance-2-5-260628"
    );
    expect(screen.getByLabelText("时长")).toHaveValue("自动");
    expect(screen.getByLabelText("画幅")).toHaveValue("adaptive");
    expect(screen.getByLabelText("分辨率")).toHaveValue("720p");
  });

  it("submits constrained face blur options with the selected tool video", async () => {
    const queuedTask: ToolTask = {
      ...failedTask,
      error: null,
      finished_at: null,
      status: "queued",
      updated_at: "2026-08-24T12:02:00Z"
    };
    apiMocks.submitFaceBlurVideo.mockResolvedValue(queuedTask);

    render(<ToolsWorkspace initialAssets={[videoAsset]} initialTasks={[]} />);
    fireEvent.change(screen.getByLabelText("输入视频"), {
      target: { value: videoAsset.id }
    });
    fireEvent.change(screen.getByLabelText("打码方式"), {
      target: { value: "blur" }
    });
    fireEvent.change(screen.getByLabelText("打码强度"), {
      target: { value: "high" }
    });
    fireEvent.click(screen.getByRole("button", { name: "开始人物打码" }));

    await waitFor(() =>
      expect(apiMocks.submitFaceBlurVideo).toHaveBeenCalledWith({
        video_asset_id: videoAsset.id,
        mask_mode: "blur",
        mask_strength: "high"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开人物打码任务 ${queuedTask.id}`
      })
    );
    expect(screen.getAllByText("排队中").length).toBeGreaterThan(0);
  });

  it("lays out face blur config horizontally and previews selected task videos", async () => {
    render(
      <ToolsWorkspace
        initialAssets={[videoAsset, faceBlurOutputAsset]}
        initialTasks={[succeededTask]}
      />
    );

    expect(screen.getByTestId("face-blur-config-grid")).toHaveClass(
      "lg:grid-cols-[minmax(18rem,1.35fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)]"
    );
    expect(screen.getByText("人物打码任务")).toBeInTheDocument();

    expect(screen.getByLabelText("打码前视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-input/content"
    );
    expect(screen.getByLabelText("打码后视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-output/content"
    );
  });

  it("switches the comparison videos when selecting face blur history tasks", async () => {
    render(
      <ToolsWorkspace
        initialAssets={[
          videoAsset,
          secondVideoAsset,
          faceBlurOutputAsset,
          secondFaceBlurOutputAsset
        ]}
        initialTasks={[succeededTask, secondSucceededTask]}
      />
    );

    expect(screen.getByLabelText("打码后视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-output/content"
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `选择人物打码任务 ${secondSucceededTask.id}`
      })
    );

    expect(screen.getByLabelText("打码前视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-input-second/content"
    );
    expect(screen.getByLabelText("打码后视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-output-second/content"
    );
  });

  it("expands multiple face blur task details without changing the selected task", () => {
    render(
      <ToolsWorkspace
        initialAssets={[
          videoAsset,
          secondVideoAsset,
          faceBlurOutputAsset,
          secondFaceBlurOutputAsset
        ]}
        initialTasks={[succeededTask, secondSucceededTask]}
      />
    );

    const selectedTask = screen.getByRole("button", {
      name: `选择人物打码任务 ${succeededTask.id}`
    });
    const otherTask = screen.getByRole("button", {
      name: `选择人物打码任务 ${secondSucceededTask.id}`
    });
    expect(
      screen.getByRole("button", {
        name: `展开人物打码任务 ${succeededTask.id}`
      })
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(
      screen.getByRole("button", {
        name: `展开人物打码任务 ${succeededTask.id}`
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开人物打码任务 ${secondSucceededTask.id}`
      })
    );

    expect(
      document.getElementById(`face-blur-task-details-${succeededTask.id}`)
    ).not.toBeNull();
    expect(
      document.getElementById(`face-blur-task-details-${secondSucceededTask.id}`)
    ).not.toBeNull();
    expect(selectedTask).toHaveAttribute("aria-pressed", "true");
    expect(otherTask).toHaveAttribute("aria-pressed", "false");
  });

  it("clears the selected task output and previews the normalized uploaded video", async () => {
    const uploadedVideo: Asset = {
      ...videoAsset,
      id: "video-uploaded",
      metadata: { name: "新上传.mp4", tool_asset_kind: "video" },
      object_key: "tools/task/uploaded.mp4",
      url: "/api/assets/video-uploaded/content"
    };
    apiMocks.uploadToolAsset.mockResolvedValue(uploadedVideo);
    const { container } = render(
      <ToolsWorkspace
        initialAssets={[videoAsset, faceBlurOutputAsset]}
        initialTasks={[succeededTask]}
      />
    );

    expect(screen.getByLabelText("打码后视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-output/content"
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["video"], "new-video.mp4", { type: "video/mp4" })]
      }
    });

    await waitFor(() =>
      expect(screen.getByLabelText("打码前视频预览")).toHaveAttribute(
        "src",
        "http://api.test/api/assets/video-uploaded/content"
      )
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("打码后视频预览")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("当前任务成功后将在这里查看打码后视频。").length
    ).toBeGreaterThan(0);
  });

  it("keeps the normalized uploaded video URL after submitting the face blur task", async () => {
    const uploadedVideo: Asset = {
      ...videoAsset,
      id: "video-uploaded",
      metadata: { name: "新上传.mp4", tool_asset_kind: "video" },
      object_key: "tools/task/uploaded.mp4",
      url: "/api/assets/video-uploaded/content"
    };
    const queuedTask: ToolTask = {
      ...failedTask,
      error: null,
      finished_at: null,
      id: "task-face-uploaded",
      input_assets: [
        {
          asset_id: uploadedVideo.id,
          created_at: "2026-08-24T12:10:00Z",
          kind: "video",
          task_id: "task-face-uploaded"
        }
      ],
      input_snapshot: {
        mask_mode: "mosaic",
        mask_strength: "medium",
        video_asset_id: uploadedVideo.id
      },
      status: "queued",
      updated_at: "2026-08-24T12:10:00Z"
    };
    apiMocks.uploadToolAsset.mockResolvedValue(uploadedVideo);
    apiMocks.submitFaceBlurVideo.mockResolvedValue(queuedTask);
    const { container } = render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["video"], "new-video.mp4", { type: "video/mp4" })]
      }
    });

    await waitFor(() =>
      expect(screen.getByLabelText("打码前视频预览")).toHaveAttribute(
        "src",
        "http://api.test/api/assets/video-uploaded/content"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "开始人物打码" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: `选择人物打码任务 ${queuedTask.id}`
        })
      ).toHaveAttribute("aria-pressed", "true")
    );
    expect(screen.getByLabelText("打码前视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-uploaded/content"
    );
  });

  it("refreshes the selected face blur output video after polling completes", async () => {
    vi.useFakeTimers();
    const queuedTask: ToolTask = {
      ...failedTask,
      error: null,
      finished_at: null,
      id: "task-face-new",
      input_assets: [
        {
          asset_id: videoAsset.id,
          created_at: "2026-08-24T12:10:00Z",
          kind: "video",
          task_id: "task-face-new"
        }
      ],
      input_snapshot: {
        mask_mode: "mosaic",
        mask_strength: "medium",
        video_asset_id: videoAsset.id
      },
      status: "queued",
      updated_at: "2026-08-24T12:10:00Z"
    };
    const completedTask: ToolTask = {
      ...queuedTask,
      finished_at: "2026-08-24T12:11:00Z",
      status: "succeeded",
      updated_at: "2026-08-24T12:11:00Z"
    };
    const completedOutput: Asset = {
      ...faceBlurOutputAsset,
      id: "video-output-new",
      tool_task_id: queuedTask.id,
      url: "/api/assets/video-output-new/content"
    };
    apiMocks.submitFaceBlurVideo.mockResolvedValue(queuedTask);
    apiMocks.getToolTask.mockResolvedValue(completedTask);
    apiMocks.listToolAssets.mockResolvedValue([videoAsset, completedOutput]);

    render(<ToolsWorkspace initialAssets={[videoAsset]} initialTasks={[]} />);
    fireEvent.change(screen.getByLabelText("输入视频"), {
      target: { value: videoAsset.id }
    });
    fireEvent.click(screen.getByRole("button", { name: "开始人物打码" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole("button", { name: `选择人物打码任务 ${queuedTask.id}` })
    ).toHaveAttribute("aria-pressed", "true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByLabelText("打码后视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-output-new/content"
    );
  });

  it("opens and closes expanded face blur video previews", async () => {
    render(
      <ToolsWorkspace
        initialAssets={[videoAsset, faceBlurOutputAsset]}
        initialTasks={[succeededTask]}
      />
    );
    fireEvent.change(screen.getByLabelText("输入视频"), {
      target: { value: videoAsset.id }
    });

    fireEvent.click(screen.getByRole("button", { name: "放大查看打码前视频" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("打码前视频放大预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-input/content"
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭" }));

    await waitFor(() =>
      expect(screen.queryByLabelText("打码前视频放大预览")).not.toBeInTheDocument()
    );
  });

  it("submits a multimodal video request without first or last frame fields", async () => {
    const queuedTask: ToolTask = {
      ...failedTask,
      error: null,
      id: "task-video",
      finished_at: null,
      status: "queued",
      type: "multimodal_video_generation"
    };
    apiMocks.generateToolVideo.mockResolvedValue(queuedTask);

    render(<ToolsWorkspace initialAssets={[imageAsset]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "产品在晨光中缓慢旋转，配合轻快音乐。" }
    });
    fireEvent.change(screen.getByLabelText("时长"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("画幅"), { target: { value: "9:16" } });
    const dialog = openReferenceAssetDialog("参考图");
    chooseDialogAsset(dialog, "产品参考.png");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认选择（1）" }));
    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));

    await waitFor(() =>
      expect(apiMocks.generateToolVideo).toHaveBeenCalledWith({
        aspect_ratio: "9:16",
        duration_seconds: 8,
        model: "doubao-seedance-2-5-260628",
        prompt: "产品在晨光中缓慢旋转，配合轻快音乐。",
        reference_audio_asset_ids: [],
        reference_image_asset_ids: [imageAsset.id],
        reference_video_asset_ids: [],
        resolution: "720p"
      })
    );
    expect(
      screen.getByRole("button", { name: `选择生成任务 ${queuedTask.id}` })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("sorts generation tasks and expands multiple task details independently", () => {
    render(
      <ToolsWorkspace
        initialAssets={[
          videoAsset,
          secondVideoAsset,
          videoGenerationOutputAsset,
          secondVideoGenerationOutputAsset
        ]}
        initialTasks={[historicalVideoGenerationTask, succeededTask, succeededVideoGenerationTask]}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    expect(screen.getByText("生成任务")).toBeInTheDocument();
    expect(screen.queryByText("当前任务")).not.toBeInTheDocument();
    const taskButtons = screen.getAllByRole("button", { name: /选择生成任务/ });
    expect(taskButtons).toHaveLength(2);
    expect(taskButtons[0]).toHaveAttribute(
      "aria-label",
      `选择生成任务 ${succeededVideoGenerationTask.id}`
    );
    expect(taskButtons[0]).toHaveAttribute("aria-pressed", "true");
    expect(taskButtons[1]).toHaveAttribute(
      "aria-label",
      `选择生成任务 ${historicalVideoGenerationTask.id}`
    );
    expect(screen.queryByText("产品在晨光中缓慢旋转，配合轻快音乐。")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: `展开生成任务 ${succeededVideoGenerationTask.id}`
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开生成任务 ${historicalVideoGenerationTask.id}`
      })
    );

    const currentDetails = document.getElementById(
      `video-generation-task-details-${succeededVideoGenerationTask.id}`
    );
    const historicalDetails = document.getElementById(
      `video-generation-task-details-${historicalVideoGenerationTask.id}`
    );
    expect(currentDetails).not.toBeNull();
    expect(historicalDetails).not.toBeNull();
    const prompt = within(currentDetails as HTMLElement).getByText(
      "产品在晨光中缓慢旋转，配合轻快音乐。"
    );
    expect(prompt).toHaveClass("whitespace-pre-wrap", "break-words");
    expect(prompt).not.toHaveClass("truncate");
    expect(within(currentDetails as HTMLElement).getByText("1 个")).toBeInTheDocument();
    expect(within(currentDetails as HTMLElement).getByText("模型")).toBeInTheDocument();
    expect(within(currentDetails as HTMLElement).getByText("Seedance 2.5")).toBeInTheDocument();
    expect(within(historicalDetails as HTMLElement).getByText("Seedance 2.0 Fast")).toBeInTheDocument();
    expect(taskButtons[0]).toHaveAttribute("aria-pressed", "true");
    expect(taskButtons[1]).toHaveAttribute("aria-pressed", "false");

    expect(screen.getByTestId("video-generation-comparison")).toHaveClass("lg:grid-cols-2");
    expect(screen.getByLabelText("参考视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-input/content"
    );
    expect(screen.getByLabelText("生成结果视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-generation-output/content"
    );
  });

  it("paginates generation tasks, keeps selections across pages, and hides controls for ten or fewer tasks", () => {
    const tasks = Array.from({ length: 11 }, (_, index) =>
      paginatedVideoGenerationTask(index + 1)
    );
    const { unmount } = render(
      <ToolsWorkspace initialAssets={[videoAsset]} initialTasks={tasks} />
    );
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    expect(screen.getByText("11 个")).toBeInTheDocument();
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /选择生成任务/ })).toHaveLength(10);
    expect(
      screen.getByRole("button", { name: "选择生成任务 task-video-page-11" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "选择生成任务 task-video-page-1" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument();
    const finalTask = screen.getByRole("button", {
      name: "选择生成任务 task-video-page-1"
    });
    fireEvent.click(finalTask);
    expect(finalTask).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "上一页" }));
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument();

    unmount();
    render(
      <ToolsWorkspace
        initialAssets={[videoAsset]}
        initialTasks={tasks.slice(0, 10)}
      />
    );
    fireEvent.click(
      screen.getByRole("tab", { name: "全模态参考生视频" })
    );
    expect(screen.queryByText(/第 \d+ \/ \d+ 页/)).not.toBeInTheDocument();
  });

  it("returns to the first page and selects a newly submitted generation task", async () => {
    const tasks = Array.from({ length: 11 }, (_, index) =>
      paginatedVideoGenerationTask(index + 1)
    );
    const newTask = {
      ...paginatedVideoGenerationTask(12),
      id: "task-video-new"
    };
    apiMocks.generateToolVideo.mockResolvedValue(newTask);

    render(<ToolsWorkspace initialAssets={[videoAsset]} initialTasks={tasks} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "新建任务回到第一页。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `选择生成任务 ${newTask.id}` })
      ).toHaveAttribute("aria-pressed", "true")
    );
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument();
  });

  it("returns to the first page and selects a retried generation task", async () => {
    const failedTaskOnLastPage: ToolTask = {
      ...paginatedVideoGenerationTask(1),
      error: { code: "generation_failed", message: "生成失败", detail: null },
      status: "failed"
    };
    const tasks = [
      ...Array.from({ length: 10 }, (_, index) =>
        paginatedVideoGenerationTask(index + 2)
      ),
      failedTaskOnLastPage
    ];
    const retryTask = {
      ...paginatedVideoGenerationTask(12),
      id: "task-video-page-retry",
      retry_of_task_id: failedTaskOnLastPage.id
    };
    apiMocks.retryToolTask.mockResolvedValue(retryTask);

    render(<ToolsWorkspace initialAssets={[videoAsset]} initialTasks={tasks} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: `选择生成任务 ${failedTaskOnLastPage.id}`
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开生成任务 ${failedTaskOnLastPage.id}`
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "重试任务" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `选择生成任务 ${retryTask.id}` })
      ).toHaveAttribute("aria-pressed", "true")
    );
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument();
  });

  it("confirms task deletion without removing related assets", async () => {
    apiMocks.deleteToolTask.mockResolvedValue(undefined);
    render(
      <ToolsWorkspace
        initialAssets={[
          videoAsset,
          secondVideoAsset,
          videoGenerationOutputAsset,
          secondVideoGenerationOutputAsset
        ]}
        initialTasks={[succeededVideoGenerationTask, historicalVideoGenerationTask]}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开生成任务 ${succeededVideoGenerationTask.id}`
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开生成任务 ${historicalVideoGenerationTask.id}`
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `删除生成任务 ${succeededVideoGenerationTask.id}`
      })
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("仅删除任务记录");

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(apiMocks.deleteToolTask).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", {
        hidden: true,
        name: `选择生成任务 ${succeededVideoGenerationTask.id}`
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: `删除生成任务 ${succeededVideoGenerationTask.id}`
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() =>
      expect(apiMocks.deleteToolTask).toHaveBeenCalledWith(
        succeededVideoGenerationTask.id
      )
    );
    expect(
      screen.queryByRole("button", {
        name: `选择生成任务 ${succeededVideoGenerationTask.id}`
      })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("生成结果视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-generation-output-second/content"
    );
    expect(
      screen.getByRole("button", {
        name: `收起生成任务 ${historicalVideoGenerationTask.id}`
      })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      document.getElementById(
        `video-generation-task-details-${historicalVideoGenerationTask.id}`
      )
    ).not.toBeNull();
    const dialog = openReferenceAssetDialog("参考视频");
    expect(within(dialog).getByText("产品展示-生成结果.mp4")).toBeInTheDocument();
  });

  it("does not change the selected task when opening generation task deletion", () => {
    render(
      <ToolsWorkspace
        initialAssets={[videoAsset]}
        initialTasks={[succeededVideoGenerationTask, historicalVideoGenerationTask]}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    const selectedTask = screen.getByRole("button", {
      name: `选择生成任务 ${succeededVideoGenerationTask.id}`
    });
    const otherTask = screen.getByRole("button", {
      name: `选择生成任务 ${historicalVideoGenerationTask.id}`
    });
    expect(selectedTask).toHaveAttribute("aria-pressed", "true");
    expect(otherTask).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      screen.getByRole("button", {
        name: `删除生成任务 ${historicalVideoGenerationTask.id}`
      })
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(selectedTask).toHaveAttribute("aria-pressed", "true");
    expect(otherTask).toHaveAttribute("aria-pressed", "false");
  });

  it("returns from an emptied final page after deleting its selected task", async () => {
    const tasks = Array.from({ length: 11 }, (_, index) =>
      paginatedVideoGenerationTask(index + 1)
    );
    apiMocks.deleteToolTask.mockResolvedValue(undefined);
    render(<ToolsWorkspace initialAssets={[videoAsset]} initialTasks={tasks} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "选择生成任务 task-video-page-1"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "删除生成任务 task-video-page-1"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() =>
      expect(screen.queryByText(/第 \d+ \/ \d+ 页/)).not.toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", {
        name: "选择生成任务 task-video-page-11"
      })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("preserves generation tasks and selection when deletion fails", async () => {
    apiMocks.deleteToolTask.mockRejectedValue(new Error("network"));
    render(
      <ToolsWorkspace
        initialAssets={[videoAsset]}
        initialTasks={[succeededVideoGenerationTask, historicalVideoGenerationTask]}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: `删除生成任务 ${succeededVideoGenerationTask.id}`
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "请求未完成，请检查网络连接后重试。"
      )
    );
    expect(
      screen.getByRole("button", {
        hidden: true,
        name: `选择生成任务 ${succeededVideoGenerationTask.id}`
      })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows 未记录 for generation tasks without a recorded model", () => {
    const legacyTask: ToolTask = {
      ...succeededVideoGenerationTask,
      id: "task-video-legacy",
      input_snapshot: {
        prompt: "历史任务没有记录模型。",
        reference_video_asset_ids: [videoAsset.id]
      }
    };

    render(<ToolsWorkspace initialAssets={[videoAsset]} initialTasks={[legacyTask]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    const taskButton = screen.getByRole("button", {
      name: `选择生成任务 ${legacyTask.id}`
    });
    expect(within(taskButton).queryByText("模型")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开生成任务 ${legacyTask.id}`
      })
    );
    const taskDetails = document.getElementById(
      `video-generation-task-details-${legacyTask.id}`
    );
    expect(taskDetails).not.toBeNull();
    expect(within(taskDetails as HTMLElement).getByText("模型")).toBeInTheDocument();
    expect(within(taskDetails as HTMLElement).getByText("未记录")).toBeInTheDocument();
    expect(screen.getByLabelText("参考视频预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-input/content"
    );
  });

  it("switches reference and output players from the selected task snapshot", () => {
    render(
      <ToolsWorkspace
        initialAssets={[
          videoAsset,
          secondVideoAsset,
          videoGenerationOutputAsset,
          secondVideoGenerationOutputAsset
        ]}
        initialTasks={[succeededVideoGenerationTask, historicalVideoGenerationTask]}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    fireEvent.click(
      screen.getByRole("button", {
        name: `选择生成任务 ${historicalVideoGenerationTask.id}`
      })
    );

    const referencePreview = screen.getByLabelText("参考视频预览");
    expect(referencePreview).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-input-second/content"
    );
    expect(referencePreview).toHaveAttribute("controls");
    expect(referencePreview).toHaveClass("object-contain");
    expect(
      screen.getByLabelText("生成结果视频预览")
    ).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-generation-output-second/content"
    );
    fireEvent.click(
      screen.getByRole("button", { name: "放大查看参考视频" })
    );
    expect(screen.getByLabelText("参考视频放大预览")).toHaveAttribute(
      "src",
      "http://api.test/api/assets/video-input-second/content"
    );
  });

  it.each<[string, ToolTask[], string]>([
    ["no task", [], "选择生成任务后将在这里查看结果视频。"],
    [
      "running task",
      [
        {
          ...succeededVideoGenerationTask,
          finished_at: null,
          status: "running",
          updated_at: "2026-08-24T12:03:00Z"
        }
      ],
      "任务正在处理，完成后将在这里查看生成结果视频。"
    ],
    [
      "failed task",
      [
        {
          ...succeededVideoGenerationTask,
          error: { code: "generation_failed", message: "生成失败", detail: null },
          status: "failed"
        }
      ],
      "任务失败，重试后将在这里查看生成结果视频。"
    ],
    [
      "successful task without output",
      [succeededVideoGenerationTask],
      "所选任务尚无可播放的输出视频。"
    ]
  ])("shows a result preview empty state for %s", (_state, tasks, emptyText) => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={tasks} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    expect(screen.queryByLabelText("生成结果视频预览")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("video-generation-comparison")).getAllByText(
        emptyText
      )
    ).toHaveLength(2);
  });

  it("shows a reference empty state when the selected task has no playable reference", () => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={[succeededVideoGenerationTask]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    expect(screen.queryByLabelText("参考视频预览")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("video-generation-comparison")).getAllByText(
        "该任务未包含可播放的参考视频。"
      )
    ).toHaveLength(2);
  });

  it("allows automatic duration and sends -1 in the video request", async () => {
    const queuedTask: ToolTask = {
      ...failedTask,
      error: null,
      finished_at: null,
      id: "task-video-duration",
      status: "queued",
      type: "multimodal_video_generation"
    };
    apiMocks.generateToolVideo.mockResolvedValue(queuedTask);

    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "城市夜景中的产品展示。" }
    });
    fireEvent.change(screen.getByLabelText("时长"), { target: { value: "-1" } });

    expect(screen.getByLabelText("时长")).toHaveValue("自动");
    expect(
      screen.getByText("自动或指定4-30s")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成视频" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));

    await waitFor(() =>
      expect(apiMocks.generateToolVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          duration_seconds: -1,
          model: "doubao-seedance-2-5-260628"
        })
      )
    );
  });

  it("preserves automatic duration and constrains positive duration when switching models", async () => {
    const queuedTask: ToolTask = {
      ...failedTask,
      error: null,
      finished_at: null,
      id: "task-video-duration",
      status: "queued",
      type: "multimodal_video_generation"
    };
    apiMocks.generateToolVideo.mockResolvedValue(queuedTask);

    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "城市夜景中的产品展示。" }
    });
    fireEvent.change(screen.getByLabelText("时长"), { target: { value: "-1" } });
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-fast-260128" }
    });

    expect(screen.getByLabelText("时长")).toHaveValue("自动");
    expect(
      screen.getByText("自动或指定4-15s")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成视频" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("时长"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-260128" }
    });
    expect(screen.getByLabelText("时长")).toHaveValue("15");
    expect(
      screen.getByText("自动或指定4-15s")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("时长"), { target: { value: "16" } });
    expect(screen.getByText("当前模型仅支持 4-15 秒。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成视频" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("时长"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));

    await waitFor(() =>
      expect(apiMocks.generateToolVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          duration_seconds: 4,
          model: "doubao-seedance-2-0-260128"
        })
      )
    );
  });

  it.each([
    ["-2", "时长必须为 -1 或正整数秒。"],
    ["0", "时长必须为 -1 或正整数秒。"],
    ["4.5", "时长必须为整数秒。"]
  ])("blocks invalid duration %s", (duration, errorMessage) => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "城市夜景中的产品展示。" }
    });
    fireEvent.change(screen.getByLabelText("时长"), { target: { value: duration } });

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成视频" })).toBeDisabled();
    expect(apiMocks.generateToolVideo).not.toHaveBeenCalled();
  });

  it("automatically selects uploaded image, video, and audio references", async () => {
    const uploadedImage = { ...imageAsset, id: "uploaded-image" };
    const uploadedVideo = { ...videoAsset, id: "uploaded-video" };
    const uploadedAudio = { ...audioAsset, id: "uploaded-audio" };
    const queuedTask: ToolTask = {
      ...failedTask,
      error: null,
      finished_at: null,
      id: "task-video-uploaded-references",
      status: "queued",
      type: "multimodal_video_generation"
    };
    apiMocks.uploadToolAsset.mockImplementation((kind: string) =>
      Promise.resolve(
        kind === "image"
          ? uploadedImage
          : kind === "video"
            ? uploadedVideo
            : uploadedAudio
      )
    );
    apiMocks.generateToolVideo.mockResolvedValue(queuedTask);

    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "产品展示视频。" }
    });
    fireEvent.change(screen.getByLabelText("参考图文件"), {
      target: { files: [new File(["image"], "reference.png", { type: "image/png" })] }
    });
    fireEvent.change(screen.getByLabelText("参考视频文件"), {
      target: { files: [new File(["video"], "reference.mp4", { type: "video/mp4" })] }
    });
    fireEvent.change(screen.getByLabelText("参考音频文件"), {
      target: { files: [new File(["audio"], "reference.mp3", { type: "audio/mpeg" })] }
    });

    await waitFor(() => {
      expect(within(screen.getByLabelText("参考图已选素材")).getByText("产品参考.png")).toBeInTheDocument();
      expect(within(screen.getByLabelText("参考视频已选素材")).getByText("人物采访.mp4")).toBeInTheDocument();
      expect(within(screen.getByLabelText("参考音频已选素材")).getByText("品牌配乐.mp3")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));
    await waitFor(() =>
      expect(apiMocks.generateToolVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          reference_audio_asset_ids: [uploadedAudio.id],
          reference_image_asset_ids: [uploadedImage.id],
          reference_video_asset_ids: [uploadedVideo.id]
        })
      )
    );
  });

  it("selects compatible tool asset cards and removes each reference without deleting assets", () => {
    render(
      <ToolsWorkspace
        initialAssets={[
          imageAsset,
          secondImageAsset,
          projectImageAsset,
          videoAsset,
          audioAsset
        ]}
        initialTasks={[]}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    let dialog = openReferenceAssetDialog("参考图");
    expect(within(dialog).getByText("产品参考.png")).toBeInTheDocument();
    expect(within(dialog).getByText("包装参考.png")).toBeInTheDocument();
    expect(within(dialog).getAllByText("图片").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("工具上传").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/08\/24/).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText("项目图片.png")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("人物采访.mp4")).not.toBeInTheDocument();
    chooseDialogAsset(dialog, "产品参考.png");
    chooseDialogAsset(dialog, "包装参考.png");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认选择（2）" }));

    expect(within(screen.getByLabelText("参考图已选素材")).getByText("产品参考.png")).toBeInTheDocument();
    expect(within(screen.getByLabelText("参考图已选素材")).getByText("包装参考.png")).toBeInTheDocument();

    dialog = openReferenceAssetDialog("参考图");
    chooseDialogAsset(dialog, "产品参考.png");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认选择（1）" }));
    expect(within(screen.getByLabelText("参考图已选素材")).getAllByText("产品参考.png")).toHaveLength(1);

    dialog = openReferenceAssetDialog("参考视频");
    expect(within(dialog).getByText("人物采访.mp4")).toBeInTheDocument();
    expect(within(dialog).getAllByText("视频").length).toBeGreaterThan(0);
    expect(within(dialog).queryByText("产品参考.png")).not.toBeInTheDocument();
    chooseDialogAsset(dialog, "人物采访.mp4");
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByLabelText("参考视频已选素材")).not.toBeInTheDocument();

    dialog = openReferenceAssetDialog("参考视频");
    chooseDialogAsset(dialog, "人物采访.mp4");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认选择（1）" }));

    dialog = openReferenceAssetDialog("参考音频");
    expect(within(dialog).getByText("品牌配乐.mp3")).toBeInTheDocument();
    expect(within(dialog).getAllByText("音频").length).toBeGreaterThan(0);
    chooseDialogAsset(dialog, "品牌配乐.mp3");
    fireEvent.click(within(dialog).getByRole("button", { name: "确认选择（1）" }));

    expect(screen.getByLabelText("参考图已选素材")).toBeInTheDocument();
    expect(screen.getByLabelText("参考视频已选素材")).toBeInTheDocument();
    expect(screen.getByLabelText("参考音频已选素材")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "移除参考图 产品参考.png" }));
    fireEvent.click(screen.getByRole("button", { name: "移除参考图 包装参考.png" }));
    fireEvent.click(screen.getByRole("button", { name: "移除参考视频 人物采访.mp4" }));
    fireEvent.click(screen.getByRole("button", { name: "移除参考音频 品牌配乐.mp3" }));

    expect(screen.queryByLabelText("参考图已选素材")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("参考视频已选素材")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("参考音频已选素材")).not.toBeInTheDocument();
    expect(apiMocks.deleteToolAsset).not.toHaveBeenCalled();
  });

  it("retries a failed persisted task", async () => {
    apiMocks.retryToolTask.mockResolvedValue({
      ...failedTask,
      error: null,
      status: "queued"
    });
    render(<ToolsWorkspace initialAssets={[videoAsset]} initialTasks={[failedTask]} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: `展开人物打码任务 ${failedTask.id}`
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "重试任务" }));

    await waitFor(() =>
      expect(apiMocks.retryToolTask).toHaveBeenCalledWith(failedTask.id)
    );
    expect(screen.getAllByText("排队中").length).toBeGreaterThan(0);
  });

  it("selects the newly created task after retrying a failed generation task", async () => {
    const retryTask: ToolTask = {
      ...succeededVideoGenerationTask,
      created_at: "2026-08-24T13:00:00Z",
      error: null,
      finished_at: null,
      id: "task-video-retry",
      retry_of_task_id: "task-video-failed",
      status: "queued"
    };
    const failedVideoTask: ToolTask = {
      ...succeededVideoGenerationTask,
      error: { code: "generation_failed", message: "生成失败", detail: null },
      id: "task-video-failed",
      status: "failed"
    };
    apiMocks.retryToolTask.mockResolvedValue(retryTask);

    render(<ToolsWorkspace initialAssets={[videoAsset]} initialTasks={[failedVideoTask]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    expect(screen.queryByText("生成失败")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `展开生成任务 ${failedVideoTask.id}`
      })
    );
    expect(screen.getByText("生成失败")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试任务" }));

    await waitFor(() =>
      expect(apiMocks.retryToolTask).toHaveBeenCalledWith(failedVideoTask.id)
    );
    expect(
      screen.getByRole("button", { name: `选择生成任务 ${retryTask.id}` })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: `选择生成任务 ${failedVideoTask.id}` })
    ).toBeInTheDocument();
  });

  it("shows the resolution options that match the selected video model", () => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    const resolutionSelect = screen.getByLabelText("分辨率");
    const optionValues = () =>
      within(resolutionSelect)
        .getAllByRole("option")
        .map((option) => (option as HTMLOptionElement).value);

    // 默认 Seedance 2.5：480p / 720p / 1080p，不含 4k
    expect(optionValues()).toEqual(["480p", "720p", "1080p"]);
    expect(
      within(resolutionSelect).queryByRole("option", { name: "4k" })
    ).toBeNull();

    // Seedance 2.0：出现 4k 选项
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-260128" }
    });
    expect(optionValues()).toEqual(["480p", "720p", "1080p", "4k"]);
    expect(
      within(resolutionSelect).getByRole("option", { name: "4k" })
    ).toBeInTheDocument();

    // Seedance 2.0 Fast：仅 480p / 720p
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-fast-260128" }
    });
    expect(optionValues()).toEqual(["480p", "720p"]);

    // Seedance 2.0 Mini：仅 480p / 720p
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-mini-260615" }
    });
    expect(optionValues()).toEqual(["480p", "720p"]);
  });

  it("normalizes the resolution to 720p when the model no longer supports it", () => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    // 在 Seedance 2.0 下选择 4k
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-260128" }
    });
    fireEvent.change(screen.getByLabelText("分辨率"), {
      target: { value: "4k" }
    });
    expect(screen.getByLabelText("分辨率")).toHaveValue("4k");

    // 切到不支持 4k 的 Fast 模型，收敛为 720p
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-fast-260128" }
    });
    expect(screen.getByLabelText("分辨率")).toHaveValue("720p");
  });

  it("keeps the resolution when the target model still supports it", () => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    // 在 Seedance 2.0 下选择 1080p
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-260128" }
    });
    fireEvent.change(screen.getByLabelText("分辨率"), {
      target: { value: "1080p" }
    });
    expect(screen.getByLabelText("分辨率")).toHaveValue("1080p");

    // 切回 Seedance 2.5 仍支持 1080p，保留原值
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-5-260628" }
    });
    expect(screen.getByLabelText("分辨率")).toHaveValue("1080p");
  });

  it("exposes the extended aspect ratio options", () => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    const aspectSelect = screen.getByLabelText("画幅");
    const optionValues = within(aspectSelect)
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);

    expect(optionValues).toEqual([
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16",
      "21:9",
      "adaptive"
    ]);
  });

  it("submits the selected resolution and extended aspect ratio", async () => {
    const queuedTask: ToolTask = {
      ...failedTask,
      error: null,
      finished_at: null,
      id: "task-video-resolution",
      status: "queued",
      type: "multimodal_video_generation"
    };
    apiMocks.generateToolVideo.mockResolvedValue(queuedTask);

    render(<ToolsWorkspace initialAssets={[imageAsset]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "自适应画幅的产品展示。" }
    });
    // Seedance 2.0 支持 4k
    fireEvent.change(screen.getByLabelText("模型"), {
      target: { value: "doubao-seedance-2-0-260128" }
    });
    fireEvent.change(screen.getByLabelText("分辨率"), {
      target: { value: "4k" }
    });
    fireEvent.change(screen.getByLabelText("画幅"), {
      target: { value: "adaptive" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成视频" }));

    await waitFor(() =>
      expect(apiMocks.generateToolVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          aspect_ratio: "adaptive",
          model: "doubao-seedance-2-0-260128",
          resolution: "4k"
        })
      )
    );
  });

  it("keeps the optimize prompt button disabled without a prompt", () => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));

    expect(screen.getByRole("button", { name: "优化提示词" })).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "   " }
    });

    expect(screen.getByRole("button", { name: "优化提示词" })).toBeDisabled();
    expect(apiMocks.optimizeToolVideoPrompt).not.toHaveBeenCalled();
  });

  it("enables the optimize prompt button once a prompt is entered", () => {
    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "产品在晨光中缓慢旋转。" }
    });

    expect(screen.getByRole("button", { name: "优化提示词" })).toBeEnabled();
  });

  it("replaces the prompt text after a successful optimization", async () => {
    apiMocks.optimizeToolVideoPrompt.mockResolvedValue({
      optimized_prompt: "编辑任务：把视频1中4-6秒喝咖啡改为拖地。"
    });

    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "  把视频里喝咖啡改成拖地  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "优化提示词" }));

    await waitFor(() =>
      expect(apiMocks.optimizeToolVideoPrompt).toHaveBeenCalledWith({
        prompt: "把视频里喝咖啡改成拖地",
        reference_image_count: 0,
        reference_video_count: 0,
        reference_audio_count: 0
      })
    );
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "创作提示词" })).toHaveValue(
        "编辑任务：把视频1中4-6秒喝咖啡改为拖地。"
      )
    );
  });

  it("disables the generate button while optimizing the prompt", async () => {
    apiMocks.optimizeToolVideoPrompt.mockReturnValue(new Promise(() => {}));

    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "产品在晨光中缓慢旋转。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "优化提示词" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "生成视频" })).toBeDisabled()
    );
    expect(screen.getByRole("button", { name: "优化提示词" })).toBeDisabled();
  });

  it("keeps the draft prompt and surfaces an error when optimization fails", async () => {
    apiMocks.optimizeToolVideoPrompt.mockRejectedValue(new Error("boom"));

    render(<ToolsWorkspace initialAssets={[]} initialTasks={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "全模态参考生视频" }));
    fireEvent.change(screen.getByRole("textbox", { name: "创作提示词" }), {
      target: { value: "产品在晨光中缓慢旋转。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "优化提示词" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "请求未完成，请检查网络连接后重试。"
      )
    );
    expect(screen.getByRole("textbox", { name: "创作提示词" })).toHaveValue(
      "产品在晨光中缓慢旋转。"
    );
  });
});
