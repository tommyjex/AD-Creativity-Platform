import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import { ImageProjectWorkspace } from "@/components/workspace/image-project-workspace";
import type {
  Asset,
  GenerationTask,
  ImageLayerSetDetail,
  ImagePromptVersion,
  Project,
  ProjectListItem
} from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  decomposeImageLayers: vi.fn(),
  deleteProject: vi.fn(),
  editProjectImage: vi.fn(),
  generateImagePrompt: vi.fn(),
  generateProjectImage: vi.fn(),
  getImageLayerSet: vi.fn(),
  getProject: vi.fn(),
  getTask: vi.fn(),
  listImageLayerSets: vi.fn(),
  listImagePromptVersions: vi.fn(),
  listProjects: vi.fn(),
  retryTask: vi.fn(),
  saveImagePromptVersion: vi.fn(),
  selectCurrentImage: vi.fn(),
  updateImageLayerSet: vi.fn(),
  updateProject: vi.fn(),
  uploadImageProjectReference: vi.fn()
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...original,
    apiClient: apiMocks,
    getUserFacingErrorMessage: () => "请求失败"
  };
});

const imageProject: Project = {
  assets: [],
  brief: {
    aspect_ratio: "1:1",
    audience: "城市通勤人群",
    duration_seconds: null,
    image_purpose: "ecommerce_main",
    product_name: "便携咖啡机",
    prompt: "制作简洁的商品主图",
    selling_points: ["轻巧便携"],
    style: "自然晨光",
    summary: null,
    target_language: "zh",
    target_platform: "tmall"
  },
  character_cards: [],
  created_at: "2026-08-16T08:00:00Z",
  current_image_asset_id: null,
  current_image_prompt_version_id: "prompt-v1",
  current_stage: "image",
  id: "image-project-1",
  image_prompt_status: "succeeded",
  image_revision: 0,
  name: "咖啡机主图",
  project_type: "image_asset",
  status: "draft",
  storyboard: [],
  tasks: [],
  text_artifacts: [],
  updated_at: "2026-08-16T08:00:00Z"
};

const listItem: ProjectListItem = {
  brief: imageProject.brief,
  created_at: imageProject.created_at,
  current_image_asset_id: imageProject.current_image_asset_id,
  current_image_prompt_version_id:
    imageProject.current_image_prompt_version_id,
  current_stage: imageProject.current_stage,
  id: imageProject.id,
  image_prompt_status: imageProject.image_prompt_status,
  image_revision: imageProject.image_revision,
  name: imageProject.name,
  project_type: imageProject.project_type,
  status: imageProject.status,
  updated_at: imageProject.updated_at
};

const firstVersion: ImagePromptVersion = {
  aspect_ratio: "1:1",
  created_at: "2026-08-16T08:01:00Z",
  id: "prompt-v1",
  image_purpose: "ecommerce_main",
  project_id: imageProject.id,
  prompt: '白色背景，便携咖啡机居中，柔和自然光，加入卖点文案："轻巧便携"。',
  target_language: "zh",
  version: 1
};

const generatedAsset: Asset = {
  asset_role: "public",
  category: null,
  created_at: "2026-08-16T08:05:00Z",
  id: "generated-1",
  metadata: {
    format: "png",
    operation: "text_to_image",
    prompt_summary: "白色背景商品主图",
    prompt_version: 1,
    size: "2K"
  },
  mime_type: "image/png",
  object_key: "projects/image-project-1/generated-1.png",
  project_id: imageProject.id,
  size_bytes: 1024,
  source_task_id: "image-task-1",
  stage: "image",
  status: "succeeded",
  type: "generated_image",
  updated_at: "2026-08-16T08:05:00Z",
  url: "https://assets.example.com/generated-1.png"
};

const referenceAsset: Asset = {
  ...generatedAsset,
  category: "reference",
  id: "reference-1",
  metadata: {
    name: "咖啡机参考图.png",
    reference_kind: "image",
    usage: "image_generation_reference"
  },
  source_task_id: null,
  type: "uploaded_image",
  url: "https://assets.example.com/reference-1.png"
};

const layerSet: ImageLayerSetDetail = {
  base_asset: {
    ...generatedAsset,
    asset_role: "internal_base",
    id: "base-1",
    url: "https://assets.example.com/base.png"
  },
  base_asset_id: "base-1",
  canvas_height: 1024,
  canvas_width: 1024,
  created_at: "2026-08-16T08:10:00Z",
  id: "set-1",
  layers: [
    {
      asset_id: "layer-asset-1",
      bbox_absolute: [100, 100, 500, 500],
      bbox_normalized: [98, 98, 488, 488],
      description: "咖啡机主体",
      id: "layer-1",
      name: "咖啡机",
      scale: 1,
      set_id: "set-1",
      visible: true,
      x: 100,
      y: 100,
      z_index: 1
    }
  ],
  layers_assets: [
    {
      ...generatedAsset,
      asset_role: "internal_layer",
      id: "layer-asset-1",
      url: "https://assets.example.com/layer.png"
    }
  ],
  project_id: imageProject.id,
  revision: 0,
  source_asset_id: generatedAsset.id,
  status: "succeeded",
  updated_at: "2026-08-16T08:10:00Z"
};

function imageTask(
  overrides: Partial<GenerationTask> = {}
): GenerationTask {
  return {
    created_at: "2026-08-16T08:04:00Z",
    error: null,
    finished_at: null,
    frozen_input: {
      operation: "text_to_image",
      prompt_version_id: firstVersion.id
    },
    id: "image-task-1",
    input_hash: "hash-1",
    output_asset_ids: [],
    output_text_artifact_id: null,
    progress: 0,
    progress_message: null,
    project_id: imageProject.id,
    retry_of_task_id: null,
    stage: "image",
    started_at: null,
    status: "queued",
    updated_at: "2026-08-16T08:04:00Z",
    ...overrides
  };
}

function layerTask(
  overrides: Partial<GenerationTask> = {}
): GenerationTask {
  return imageTask({
    frozen_input: {
      kind: "layer_decomposition",
      source_asset_id: generatedAsset.id
    },
    id: "layer-task-1",
    ...overrides
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe("图片项目工作区", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.listImagePromptVersions.mockResolvedValue([firstVersion]);
    apiMocks.listImageLayerSets.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("显示图片用途标签并路由到独立图片工作区", async () => {
    apiMocks.getProject.mockResolvedValue(imageProject);
    render(<ProjectWorkspace initialProjects={[listItem]} />);

    expect(screen.getByText("电商主图")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /咖啡机主图/ }));

    expect(
      await screen.findByRole("heading", { name: "图片提示词" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("分辨率")).toHaveValue("2K");
    expect(screen.getByRole("button", { name: "生成图片" })).toBeEnabled();
    expect(screen.queryByText("故事生成")).not.toBeInTheDocument();
  });

  it("仅在顶部提供 Brief 入口并使用响应式弹窗编辑", async () => {
    apiMocks.getProject.mockResolvedValue(imageProject);
    render(<ProjectWorkspace initialProjects={[listItem]} />);

    fireEvent.click(screen.getByRole("button", { name: /咖啡机主图/ }));
    await screen.findByRole("heading", { name: "图片提示词" });

    expect(screen.queryByText("Brief Summary")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "项目与 Brief" })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "编辑 Brief" })
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "编辑 Brief" }));

    expect(
      screen.getByRole("dialog", { name: "编辑 Brief" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("brief-dialog-scroll-region")).toHaveClass(
      "overflow-y-auto"
    );
    expect(screen.getByLabelText("图片用途").closest(".grid")).toHaveClass(
      "md:grid-cols-2"
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭编辑" }));
    expect(
      screen.queryByRole("dialog", { name: "编辑 Brief" })
    ).not.toBeInTheDocument();
  });

  it("创建图片项目时隐藏时长并提交完整图片 Brief", async () => {
    apiMocks.createProject.mockResolvedValue(imageProject);
    render(<ProjectWorkspace initialProjects={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "新建第一个项目" }));
    fireEvent.click(screen.getByRole("button", { name: "图片素材" }));
    expect(screen.queryByLabelText("视频时长（秒）")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("项目名称"), {
      target: { value: "咖啡机主图" }
    });
    fireEvent.change(screen.getByLabelText("广告需求"), {
      target: { value: "制作简洁的商品主图" }
    });
    fireEvent.change(screen.getByLabelText("商品名称"), {
      target: { value: "便携咖啡机" }
    });
    fireEvent.change(screen.getByLabelText("目标受众"), {
      target: { value: "城市通勤人群" }
    });
    fireEvent.change(screen.getByLabelText("核心卖点（每行一项）"), {
      target: { value: "轻巧便携" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建项目" }));

    await waitFor(() => {
      expect(apiMocks.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          brief: expect.objectContaining({
            duration_seconds: null,
            image_purpose: "ecommerce_main",
            product_name: "便携咖啡机",
            selling_points: ["轻巧便携"]
          }),
          project_type: "image_asset"
        })
      );
    });
  });

  it("编辑图片 Brief 时保持图片字段矩阵", async () => {
    apiMocks.getProject.mockResolvedValue(imageProject);
    apiMocks.updateProject.mockResolvedValue({
      ...imageProject,
      brief: { ...imageProject.brief, image_purpose: "poster" }
    });
    render(<ProjectWorkspace initialProjects={[listItem]} />);

    fireEvent.click(screen.getByRole("button", { name: /咖啡机主图/ }));
    await screen.findByRole("heading", { name: "图片提示词" });
    fireEvent.click(screen.getByRole("button", { name: "编辑 Brief" }));

    expect(screen.queryByLabelText("视频时长（秒）")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("图片用途"), {
      target: { value: "poster" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(apiMocks.updateProject).toHaveBeenCalledWith(
        imageProject.id,
        expect.objectContaining({
          brief: expect.objectContaining({
            duration_seconds: null,
            image_purpose: "poster",
            selling_points: ["轻巧便携"]
          })
        })
      );
    });
    expect(
      screen.queryByRole("dialog", { name: "编辑 Brief" })
    ).not.toBeInTheDocument();
  });

  it("图片 Brief 保存失败时保留弹窗和已编辑内容", async () => {
    apiMocks.getProject.mockResolvedValue(imageProject);
    apiMocks.updateProject.mockRejectedValue(new Error("private error"));
    render(<ProjectWorkspace initialProjects={[listItem]} />);

    fireEvent.click(screen.getByRole("button", { name: /咖啡机主图/ }));
    await screen.findByRole("heading", { name: "图片提示词" });
    fireEvent.click(screen.getByRole("button", { name: "编辑 Brief" }));

    const nameInput = screen.getByLabelText("项目名称");
    fireEvent.change(nameInput, { target: { value: "未保存的主图项目" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("请求失败");
    expect(nameInput).toHaveValue("未保存的主图项目");
    expect(
      screen.getByRole("dialog", { name: "编辑 Brief" })
    ).toBeInTheDocument();
  });

  it("加载历史版本并保存单调的新版本", async () => {
    const secondVersion = {
      ...firstVersion,
      id: "prompt-v2",
      prompt: '更新后的商品主图提示词，画面文案："随时鲜萃"',
      version: 2
    };
    apiMocks.saveImagePromptVersion.mockResolvedValue(secondVersion);
    apiMocks.getProject.mockResolvedValue({
      ...imageProject,
      current_image_prompt_version_id: secondVersion.id
    });
    apiMocks.listImagePromptVersions
      .mockResolvedValueOnce([firstVersion])
      .mockResolvedValueOnce([secondVersion, firstVersion]);

    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    expect(await screen.findByDisplayValue(firstVersion.prompt)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("提示词内容"), {
      target: { value: secondVersion.prompt }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存新版本" }));

    await waitFor(() => {
      expect(apiMocks.saveImagePromptVersion).toHaveBeenCalledWith(
        imageProject.id,
        { prompt: secondVersion.prompt }
      );
    });
    expect(await screen.findByText("V2")).toBeInTheDocument();
  });

  it("当前提示词版本变化时重新显示各自的加载状态", async () => {
    const secondVersion: ImagePromptVersion = {
      ...firstVersion,
      id: "prompt-v2",
      prompt: '更新后的商品主图提示词，画面文案："随时鲜萃"',
      version: 2
    };
    const versionsRequest = deferred<ImagePromptVersion[]>();
    const layerSetsRequest = deferred<ImageLayerSetDetail[]>();
    const { rerender } = render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...imageProject, assets: [generatedAsset] }}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);
    await screen.findByRole("button", { name: "图层编辑" });

    apiMocks.listImagePromptVersions.mockReturnValueOnce(
      versionsRequest.promise
    );
    apiMocks.listImageLayerSets.mockReturnValueOnce(layerSetsRequest.promise);
    rerender(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{
          ...imageProject,
          assets: [generatedAsset],
          current_image_prompt_version_id: secondVersion.id
        }}
      />
    );

    expect(screen.getByText("正在加载版本...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "图层编辑（正在加载图层数据）"
      })
    ).toBeDisabled();

    versionsRequest.resolve([secondVersion, firstVersion]);
    expect(await screen.findByText("V2")).toBeInTheDocument();
    expect(screen.queryByText("正在加载版本...")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "图层编辑（正在加载图层数据）"
      })
    ).toBeDisabled();

    layerSetsRequest.resolve([]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "图层编辑" })).toBeEnabled();
    });
  });

  it("超出中文建议长度时要求二次确认但允许保存", async () => {
    const longPrompt = `${"图".repeat(301)} "轻巧便携"`;
    apiMocks.saveImagePromptVersion.mockResolvedValue({
      ...firstVersion,
      id: "prompt-v2",
      prompt: longPrompt,
      version: 2
    });
    apiMocks.getProject.mockResolvedValue(imageProject);
    apiMocks.listImagePromptVersions
      .mockResolvedValueOnce([firstVersion])
      .mockResolvedValueOnce([firstVersion]);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );

    await screen.findByDisplayValue(firstVersion.prompt);
    fireEvent.change(screen.getByLabelText("提示词内容"), {
      target: { value: longPrompt }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存新版本" }));
    expect(apiMocks.saveImagePromptVersion).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "确认保存超长版本" })
    );

    await waitFor(() => {
      expect(apiMocks.saveImagePromptVersion).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ["空文案", '画面文案：""', "不能为空"],
    ["未闭合", '画面文案："轻巧便携', "未成对闭合"],
    ["中文弯引号", "画面文案：“轻巧便携”", "改为英文双引号"],
    [
      "超过四条",
      '画面文案："卖点一"、"卖点二"、"卖点三"、"卖点四"、"卖点五"',
      "最多保留 4 条"
    ]
  ])(
    "提示词%s时显示原因并阻止保存",
    async (_caseName, invalidPrompt, expectedMessage) => {
      render(
        <ImageProjectWorkspace
          onProjectUpdated={vi.fn()}
          project={imageProject}
        />
      );
      await screen.findByDisplayValue(firstVersion.prompt);

      fireEvent.change(screen.getByLabelText("提示词内容"), {
        target: { value: invalidPrompt }
      });

      expect(screen.getByRole("alert")).toHaveTextContent(expectedMessage);
      expect(
        screen.getByRole("button", { name: "保存新版本" })
      ).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "保存新版本" }));
      expect(apiMocks.saveImagePromptVersion).not.toHaveBeenCalled();
    }
  );

  it("无画面文字的历史提示词仍允许保存和生成", async () => {
    const legacyVersion = {
      ...firstVersion,
      prompt: "历史商品主图提示词，没有画面文案"
    };
    apiMocks.listImagePromptVersions.mockResolvedValue([legacyVersion]);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );

    await screen.findByDisplayValue(legacyVersion.prompt);

    expect(screen.getByText(/当前未设置画面文字/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成图片" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "保存新版本" })
    ).toBeEnabled();
  });

  it("四条画面卖点文案合法并可保存", async () => {
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);

    fireEvent.change(screen.getByLabelText("提示词内容"), {
      target: {
        value: '画面文案："卖点一"、"卖点二"、"卖点三"、"卖点四"'
      }
    });

    expect(screen.getByText("已识别 4 条画面卖点文案。")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "保存新版本" })
    ).toBeEnabled();
  });

  it("AI 生成期间防重复并禁用图片生成，成功后仅写入编辑器", async () => {
    const request = deferred<{ model: string; prompt: string }>();
    apiMocks.generateImagePrompt.mockReturnValue(request.promise);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);

    fireEvent.click(screen.getByRole("button", { name: "AI 生成" }));
    const aiButton = screen.getByRole("button", { name: "生成中" });
    expect(aiButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "生成图片" })).toBeDisabled();
    fireEvent.click(aiButton);
    expect(apiMocks.generateImagePrompt).toHaveBeenCalledTimes(1);
    expect(apiMocks.generateImagePrompt).toHaveBeenCalledWith(imageProject.id, {
      current_prompt: firstVersion.prompt
    });

    request.resolve({
      model: "doubao-seed-evolving",
      prompt: 'AI 生成的商品主图提示词，画面文案："轻巧随行"'
    });
    expect(
      await screen.findByDisplayValue(
        'AI 生成的商品主图提示词，画面文案："轻巧随行"'
      )
    ).toBeInTheDocument();
    expect(apiMocks.saveImagePromptVersion).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "生成图片" })).toBeDisabled();
  });

  it("AI 结果替换脏提示词前明确确认，取消保留原文", async () => {
    apiMocks.generateImagePrompt.mockResolvedValue({
      model: "doubao-seed-evolving",
      prompt: '待替换的 AI 提示词，画面文案："随时鲜萃"'
    });
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);
    const dirtyPrompt = "用户尚未保存的提示词";
    fireEvent.change(screen.getByLabelText("提示词内容"), {
      target: { value: dirtyPrompt }
    });

    fireEvent.click(screen.getByRole("button", { name: "AI 生成" }));
    expect(
      await screen.findByRole("heading", { name: "替换当前提示词？" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消，保留原文" }));
    expect(screen.getByLabelText("提示词内容")).toHaveValue(dirtyPrompt);

    fireEvent.click(screen.getByRole("button", { name: "AI 生成" }));
    await screen.findByRole("heading", { name: "替换当前提示词？" });
    fireEvent.click(screen.getByRole("button", { name: "确认替换" }));
    expect(screen.getByLabelText("提示词内容")).toHaveValue(
      '待替换的 AI 提示词，画面文案："随时鲜萃"'
    );
  });

  it("AI 生成失败时保留原提示词并反馈", async () => {
    apiMocks.generateImagePrompt.mockRejectedValue(new Error("provider failed"));
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);

    fireEvent.click(screen.getByRole("button", { name: "AI 生成" }));

    expect(await screen.findByRole("status")).toHaveTextContent("请求失败");
    expect(screen.getByLabelText("提示词内容")).toHaveValue(firstVersion.prompt);
  });

  it("点击上传有效参考图并在生成 payload 中携带资产 ID", async () => {
    const queued = imageTask();
    apiMocks.uploadImageProjectReference.mockResolvedValue(referenceAsset);
    apiMocks.generateProjectImage.mockResolvedValue(queued);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);
    const file = new File(["png"], "咖啡机参考图.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText("参考图（可选）"), {
      target: { files: [file] }
    });

    expect(await screen.findByText(file.name)).toBeInTheDocument();
    expect(screen.getByAltText("当前参考图")).toHaveAttribute(
      "src",
      referenceAsset.url
    );
    expect(apiMocks.uploadImageProjectReference).toHaveBeenCalledWith(
      imageProject.id,
      file,
      { filename: file.name, mimeType: file.type }
    );
    fireEvent.click(screen.getByRole("button", { name: "生成图片" }));
    await waitFor(() => {
      expect(apiMocks.generateProjectImage).toHaveBeenCalledWith(
        imageProject.id,
        {
          format: "png",
          operation: "text_to_image",
          prompt_version_id: firstVersion.id,
          reference_asset_id: referenceAsset.id,
          size: "2K"
        }
      );
    });
  });

  it("前置拒绝无效 MIME 和超限参考图", async () => {
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);
    const input = screen.getByLabelText("参考图（可选）");

    fireEvent.change(input, {
      target: {
        files: [new File(["gif"], "reference.gif", { type: "image/gif" })]
      }
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "仅支持 PNG、JPEG 或 WebP"
    );
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.png", {
            type: "image/png"
          })
        ]
      }
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "参考图不能超过 20 MB"
    );
    expect(apiMocks.uploadImageProjectReference).not.toHaveBeenCalled();
  });

  it("支持拖拽上传，上传期间禁用生成", async () => {
    const request = deferred<Asset>();
    apiMocks.uploadImageProjectReference.mockReturnValue(request.promise);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);
    const file = new File(["webp"], "拖拽参考.webp", { type: "image/webp" });

    fireEvent.drop(
      screen.getByRole("button", { name: "点击或拖拽上传参考图" }),
      { dataTransfer: { files: [file] } }
    );
    expect(screen.getByRole("button", { name: "生成图片" })).toBeDisabled();
    request.resolve({
      ...referenceAsset,
      metadata: { ...referenceAsset.metadata, name: file.name }
    });
    expect(await screen.findByText(file.name)).toBeInTheDocument();
  });

  it("更换和移除仅更新单张本地选择，不删除后端资产", async () => {
    const replacement = {
      ...referenceAsset,
      id: "reference-2",
      metadata: { ...referenceAsset.metadata, name: "替换图.jpg" },
      mime_type: "image/jpeg"
    };
    apiMocks.uploadImageProjectReference
      .mockResolvedValueOnce(referenceAsset)
      .mockResolvedValueOnce(replacement);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);
    const input = screen.getByLabelText("参考图（可选）");

    fireEvent.change(input, {
      target: {
        files: [new File(["png"], "咖啡机参考图.png", { type: "image/png" })]
      }
    });
    await screen.findByText("咖啡机参考图.png");
    fireEvent.click(screen.getByRole("button", { name: "更换参考图" }));
    fireEvent.change(input, {
      target: {
        files: [new File(["jpg"], "替换图.jpg", { type: "image/jpeg" })]
      }
    });
    expect(await screen.findByText("替换图.jpg")).toBeInTheDocument();
    expect(screen.queryByText("咖啡机参考图.png")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "移除参考图" }));
    expect(
      screen.getByRole("button", { name: "点击或拖拽上传参考图" })
    ).toBeInTheDocument();
    expect(apiMocks.uploadImageProjectReference).toHaveBeenCalledTimes(2);
  });

  it("使用当前保存版本提交生成并轮询成功后刷新版本网格", async () => {
    const queued = imageTask();
    const succeeded = imageTask({
      finished_at: "2026-08-16T08:05:00Z",
      output_asset_ids: [generatedAsset.id],
      progress: 1,
      status: "succeeded"
    });
    apiMocks.generateProjectImage.mockResolvedValue(queued);
    apiMocks.getTask.mockResolvedValue(succeeded);
    apiMocks.getProject.mockResolvedValue({
      ...imageProject,
      assets: [generatedAsset]
    });

    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={imageProject}
      />
    );
    await screen.findByDisplayValue(firstVersion.prompt);
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("分辨率"), {
      target: { value: "1.5K" }
    });
    fireEvent.click(screen.getByRole("button", { name: "生成图片" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMocks.generateProjectImage).toHaveBeenCalledWith(
      imageProject.id,
      {
        format: "png",
        operation: "text_to_image",
        prompt_version_id: firstVersion.id,
        size: "1.5K"
      }
    );
    expect(screen.getByRole("button", { name: "生成中" })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(apiMocks.getTask).toHaveBeenCalledWith(queued.id, {
      cache: "no-store"
    });
    expect(screen.getByText("白色背景商品主图")).toBeInTheDocument();
  });

  it("stale 版本可预览编辑但不可设为 current", async () => {
    const staleAsset = { ...generatedAsset, id: "stale-1", status: "stale" as const };
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...imageProject, assets: [staleAsset] }}
      />
    );

    expect(await screen.findByText("STALE")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "失效版本不可设为当前" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "编辑图片" })).toBeEnabled();
  });

  it("选择版本时提交当前 image_revision", async () => {
    const onProjectUpdated = vi.fn();
    apiMocks.selectCurrentImage.mockResolvedValue({
      ...imageProject,
      assets: [generatedAsset],
      current_image_asset_id: generatedAsset.id,
      image_revision: 8
    });
    render(
      <ImageProjectWorkspace
        onProjectUpdated={onProjectUpdated}
        project={{ ...imageProject, assets: [generatedAsset], image_revision: 7 }}
      />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "设为当前成品" })
    );
    await waitFor(() => {
      expect(apiMocks.selectCurrentImage).toHaveBeenCalledWith(
        imageProject.id,
        {
          asset_id: generatedAsset.id,
          expected_image_revision: 7
        }
      );
    });
  });

  it("失败任务按冻结输入重试并恢复运行禁用态", async () => {
    const failed = imageTask({
      error: { code: "generation_failed", detail: null, message: "生成失败" },
      finished_at: "2026-08-16T08:05:00Z",
      status: "failed"
    });
    const retry = imageTask({
      id: "image-task-retry",
      retry_of_task_id: failed.id
    });
    apiMocks.retryTask.mockResolvedValue(retry);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...imageProject, tasks: [failed] }}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "失败重试" }));
    await waitFor(() => {
      expect(apiMocks.retryTask).toHaveBeenCalledWith(failed.id);
    });
    expect(screen.getByRole("button", { name: "生成中" })).toBeDisabled();
  });

  it("图层集合初次加载 pending 时仅禁用图层编辑", async () => {
    const layerSetsRequest = deferred<ImageLayerSetDetail[]>();
    apiMocks.listImageLayerSets.mockReturnValue(layerSetsRequest.promise);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...imageProject, assets: [generatedAsset] }}
      />
    );

    await screen.findByDisplayValue(firstVersion.prompt);
    const layerButton = screen.getByRole("button", {
      name: "图层编辑（正在加载图层数据）"
    });
    expect(layerButton).toBeDisabled();
    expect(layerButton).toHaveAttribute("title", "图层编辑（正在加载图层数据）");
    expect(screen.getByRole("link", { name: "预览图片" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "下载图片" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "编辑图片" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "设为当前成品" })).toBeEnabled();

    layerSetsRequest.resolve([]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "图层编辑" })).toBeEnabled();
    });
  });

  it("图层集合加载 resolve 已有 set 后直接打开编辑器", async () => {
    const layerSetsRequest = deferred<ImageLayerSetDetail[]>();
    apiMocks.listImageLayerSets.mockReturnValue(layerSetsRequest.promise);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...imageProject, assets: [generatedAsset] }}
      />
    );

    expect(
      screen.getByRole("button", { name: "图层编辑（正在加载图层数据）" })
    ).toBeDisabled();
    layerSetsRequest.resolve([layerSet]);
    const layerButton = await screen.findByRole("button", { name: "图层编辑" });
    fireEvent.click(layerButton);

    expect(
      await screen.findByRole("heading", { name: "图层编辑" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "创建可编辑图层" })
    ).not.toBeInTheDocument();
    expect(apiMocks.decomposeImageLayers).not.toHaveBeenCalled();
  });

  it("图层集合初次加载 reject 后恢复按钮并允许拆分", async () => {
    const layerSetsRequest = deferred<ImageLayerSetDetail[]>();
    apiMocks.listImageLayerSets.mockReturnValue(layerSetsRequest.promise);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...imageProject, assets: [generatedAsset] }}
      />
    );

    layerSetsRequest.reject(new Error("layer sets unavailable"));
    const layerButton = await screen.findByRole("button", { name: "图层编辑" });
    expect(layerButton).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("请求失败");
    fireEvent.click(layerButton);

    expect(
      await screen.findByRole("heading", { name: "创建可编辑图层" })
    ).toBeInTheDocument();
  });

  it("轮询成功后不等待项目刷新即可自动打开编辑器", async () => {
    const queued = layerTask();
    const succeeded = layerTask({
      finished_at: "2026-08-16T08:10:00Z",
      output_asset_ids: ["base-1", "layer-asset-1"],
      progress: 1,
      status: "succeeded"
    });
    apiMocks.decomposeImageLayers.mockResolvedValue(queued);
    apiMocks.getTask.mockResolvedValue(succeeded);
    apiMocks.getProject.mockReturnValue(new Promise(() => {}));
    apiMocks.listImageLayerSets
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([layerSet]);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...imageProject, assets: [generatedAsset] }}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "图层编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "指定对象" }));
    fireEvent.change(screen.getByLabelText("拆分说明"), {
      target: { value: "拆分咖啡机主体" }
    });
    fireEvent.click(screen.getByLabelText(/限定拆分区域/));
    fireEvent.change(screen.getByLabelText("拆分区域 X1"), {
      target: { value: "120" }
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "开始拆分" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMocks.decomposeImageLayers).toHaveBeenCalledWith(
      imageProject.id,
      {
        bbox: {
          type: "bbox",
          x1: 120,
          x2: 900,
          y1: 100,
          y2: 900
        },
        format: "png",
        prompt: "拆分咖啡机主体",
        size: "auto",
        source_asset_id: generatedAsset.id
      }
    );
    expect(screen.getByText("图层拆分")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(
      screen.getByRole("heading", { name: "图层编辑" })
    ).toBeInTheDocument();
  });

  it("图层拆分失败时显示状态并按冻结输入重试", async () => {
    const failed = layerTask({
      error: { code: "generation_failed", detail: null, message: "拆分失败" },
      finished_at: "2026-08-16T08:10:00Z",
      status: "failed"
    });
    const retry = layerTask({
      id: "layer-task-retry",
      retry_of_task_id: failed.id
    });
    apiMocks.retryTask.mockResolvedValue(retry);
    render(
      <ImageProjectWorkspace
        onProjectUpdated={vi.fn()}
        project={{
          ...imageProject,
          assets: [generatedAsset],
          tasks: [failed]
        }}
      />
    );

    expect(await screen.findByText("拆分失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试拆分" }));
    await waitFor(() => {
      expect(apiMocks.retryTask).toHaveBeenCalledWith(failed.id);
    });
    expect(screen.getByText("排队中")).toBeInTheDocument();
  });
});
