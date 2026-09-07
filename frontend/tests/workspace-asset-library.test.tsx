import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceAssetsPage from "@/app/workspace/assets/page";
import { WorkspaceAssetLibrary } from "@/components/workspace/workspace-asset-library";
import {
  artifactMatchesKeyword,
  assetMatchesKeyword,
  buildArtifactItems,
  getSafeLastFrameUrl,
  getSafePreviewUrl,
  getWorkspaceAssetDescription,
  partitionWorkspaceAssets
} from "@/lib/asset-display";
import type { Asset, ProjectListItem } from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  deleteAsset: vi.fn(),
  deleteToolAsset: vi.fn(),
  listAssets: vi.fn(),
  listProjects: vi.fn(),
  listToolAssets: vi.fn(),
  listToolTasks: vi.fn(),
  renameAsset: vi.fn()
}));

vi.mock("@/lib/api-client", () => ({
  createApiClient: () => apiMocks,
  getBackendBaseUrl: () => "http://backend.local",
  getUserFacingErrorMessage: () => "服务暂时不可用，请稍后重试。"
}));

const project: ProjectListItem = {
  brief: {
    aspect_ratio: "9:16",
    audience: "通勤白领",
    duration_seconds: 30,
    image_purpose: null,
    product_name: "AeroPress Go",
    prompt: "制作一条便携咖啡广告",
    selling_points: ["便携"],
    style: "真实生活流",
    summary: null,
    target_language: "zh",
    target_platform: "douyin"
  },
  created_at: "2026-08-09T10:00:00Z",
  current_stage: "character",
  current_image_asset_id: null,
  current_image_prompt_version_id: null,
  id: "project-1",
  image_prompt_status: "draft",
  image_revision: 0,
  name: "便携咖啡机投放",
  project_type: "video_ad",
  status: "running",
  updated_at: "2026-08-09T10:00:00Z"
};

const characterAsset = createAsset({
  category: "character",
  id: "character-1",
  metadata: {
    description: "晨间通勤中的年轻女性",
    name: "咖啡主角",
    prompt: "一位手持咖啡杯的通勤者"
  },
  url: "https://cdn.example.test/character.png"
});

const sceneAsset = createAsset({
  category: "scene",
  id: "scene-1",
  metadata: { name: "晨光地铁站" },
  status: "queued",
  url: null
});

const storyboardVideoAsset = createAsset({
  category: null,
  id: "video-1",
  metadata: {
    last_frame_status: "available",
    last_frame_url: "/api/assets/video-1/last-frame"
  },
  stage: "video",
  type: "storyboard_video",
  url: "/api/assets/video-1/content"
});

const finalVideoAsset = createAsset({
  category: null,
  id: "final-1",
  stage: "compose",
  type: "final_video",
  url: "/api/assets/final-1/content"
});

const generatedImageAsset = createAsset({
  asset_role: "public",
  category: null,
  id: "generated-1",
  metadata: {
    format: "png",
    height: 1024,
    image_purpose: "ecommerce_main",
    layer_revision: 3,
    layer_set_id: "set-1",
    model: "doubao-seedream-5-0-pro",
    operation: "layer_composite",
    prompt_summary: "蓝色背景上的便携咖啡机",
    source_asset_id: "source-1",
    width: 1024
  },
  stage: "image",
  type: "generated_image",
  url: "/api/assets/generated-1/content"
});

const toolVideoAsset = createAsset({
  category: null,
  id: "tool-video-1",
  metadata: { name: "人物打码结果" },
  project_id: null,
  stage: null,
  tool_asset_role: "output",
  tool_task_id: "tool-task-1",
  type: "uploaded_video",
  url: "/api/assets/tool-video-1/content"
});

const aigcInputAsset = createAsset({
  asset_role: "public",
  category: null,
  id: "aigc-input",
  metadata: { aigc_role: "legacy-value", name: "参考商品图", origin: "aigc" },
  project_id: null,
  stage: null,
  tool_asset_role: "input",
  tool_task_id: null,
  type: "uploaded_image",
  url: "/api/assets/aigc-input/content"
});

const aigcOutputAsset = createAsset({
  ...aigcInputAsset,
  id: "aigc-output",
  metadata: {
    description: "Provider description",
    name: "商品主图-图生图1-图片1.png",
    name_scheme: "aigc_canvas_node_v1",
    origin: "aigc"
  },
  tool_asset_role: "output",
  type: "generated_image",
  url: "/api/assets/aigc-output/content"
});

const toolTask = {
  created_at: "2026-08-10T10:00:00Z",
  finished_at: null,
  id: "tool-task-1",
  input_snapshot: {},
  provider_task_id: "provider-task-1",
  started_at: "2026-08-10T10:01:00Z",
  status: "running" as const,
  type: "face_blur_video" as const,
  updated_at: "2026-08-10T10:01:00Z"
};

describe("WorkspaceAssetLibrary", () => {
  beforeEach(() => {
    apiMocks.deleteAsset.mockReset();
    apiMocks.deleteToolAsset.mockReset();
    apiMocks.listAssets.mockReset();
    apiMocks.listProjects.mockReset();
    apiMocks.listToolAssets.mockReset();
    apiMocks.listToolTasks.mockReset();
    apiMocks.renameAsset.mockReset();
  });

  it("fetches assets without a backend category and keeps sections client-side", async () => {
    apiMocks.listProjects.mockResolvedValue([project]);
    apiMocks.listAssets.mockResolvedValue([characterAsset]);
    apiMocks.listToolAssets.mockResolvedValue([]);
    apiMocks.listToolTasks.mockResolvedValue([]);

    render(
      await WorkspaceAssetsPage({
        searchParams: Promise.resolve({
          project_id: [` ${project.id} `, "ignored-project"],
          section: "character",
          status: "succeeded"
        })
      })
    );

    expect(apiMocks.listProjects).toHaveBeenCalledWith({
      next: { revalidate: 30 }
    });
    expect(apiMocks.listAssets).toHaveBeenCalledWith(
      {
        category: undefined,
        projectId: project.id,
        status: "succeeded"
      },
      { next: { revalidate: 30 } }
    );
    expect(apiMocks.listToolAssets).toHaveBeenCalledWith({
      next: { revalidate: 30 }
    });
    expect(screen.getByLabelText("项目")).toHaveValue(project.id);
    expect(screen.getByLabelText("状态")).toHaveValue("succeeded");
    // section from the URL seeds the sidebar selection, so only 角色 renders.
    expect(screen.getByRole("heading", { name: "角色资产" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "场景资产" })
    ).not.toBeInTheDocument();
  });

  it("does not forward artifacts section as a backend category", async () => {
    apiMocks.listProjects.mockResolvedValue([project]);
    apiMocks.listAssets.mockResolvedValue([storyboardVideoAsset]);
    apiMocks.listToolAssets.mockResolvedValue([]);
    apiMocks.listToolTasks.mockResolvedValue([]);

    render(
      await WorkspaceAssetsPage({
        searchParams: Promise.resolve({ section: "artifacts" })
      })
    );

    expect(apiMocks.listAssets).toHaveBeenCalledWith(
      { category: undefined, projectId: undefined, status: undefined },
      { next: { revalidate: 30 } }
    );
    expect(screen.getByRole("heading", { name: "产物" })).toBeInTheDocument();
  });

  it("loads only tool assets and tasks when the tools source is selected", async () => {
    apiMocks.listProjects.mockResolvedValue([project]);
    apiMocks.listToolAssets.mockResolvedValue([toolVideoAsset]);
    apiMocks.listToolTasks.mockResolvedValue([toolTask]);

    render(
      await WorkspaceAssetsPage({
        searchParams: Promise.resolve({
          project_id: "",
          source: "tools",
          status: ""
        })
      })
    );

    expect(apiMocks.listAssets).not.toHaveBeenCalled();
    expect(apiMocks.listToolAssets).toHaveBeenCalledWith({
      next: { revalidate: 30 }
    });
    expect(screen.getByLabelText("来源")).toHaveValue("tools");
    expect(screen.getByRole("heading", { name: "工具资产" })).toBeInTheDocument();
  });

  it("parses source=aigc and clears project filtering from requests and forms", async () => {
    apiMocks.listProjects.mockResolvedValue([project]);
    apiMocks.listToolAssets.mockResolvedValue([aigcInputAsset]);
    apiMocks.listToolTasks.mockResolvedValue([]);

    render(
      await WorkspaceAssetsPage({
        searchParams: Promise.resolve({
          project_id: project.id,
          source: "aigc"
        })
      })
    );

    expect(apiMocks.listAssets).not.toHaveBeenCalled();
    expect(screen.getByLabelText("来源")).toHaveValue("aigc");
    expect(screen.getByLabelText("项目")).toBeDisabled();
    expect(screen.getByLabelText("项目")).toHaveValue("");
    const form = screen.getByRole("button", { name: "筛选" }).closest("form");
    expect(new FormData(form as HTMLFormElement).has("project_id")).toBe(false);
    expect(
      screen.getByRole("heading", { name: "AIGC 工作台" })
    ).toBeInTheDocument();
  });

  it("falls back to all assets for an unknown source", async () => {
    apiMocks.listProjects.mockResolvedValue([project]);
    apiMocks.listAssets.mockResolvedValue([characterAsset]);
    apiMocks.listToolAssets.mockResolvedValue([toolVideoAsset]);
    apiMocks.listToolTasks.mockResolvedValue([toolTask]);

    render(
      await WorkspaceAssetsPage({
        searchParams: Promise.resolve({ source: "unknown-source" })
      })
    );

    expect(screen.getByLabelText("来源")).toHaveValue("all");
    expect(apiMocks.listAssets).toHaveBeenCalledOnce();
    expect(apiMocks.listToolAssets).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "工具资产" })).toBeInTheDocument();
  });

  it("drops stale project filters when the tools source is submitted repeatedly", async () => {
    apiMocks.listProjects.mockResolvedValue([project]);
    apiMocks.listToolAssets.mockResolvedValue([]);
    apiMocks.listToolTasks.mockResolvedValue([]);

    render(
      await WorkspaceAssetsPage({
        searchParams: Promise.resolve({
          project_id: project.id,
          source: "tools"
        })
      })
    );

    expect(apiMocks.listAssets).not.toHaveBeenCalled();
    expect(screen.getByLabelText("来源")).toHaveValue("tools");
    expect(screen.getByLabelText("项目")).toHaveValue("");
    expect(screen.getByLabelText("项目")).toBeDisabled();
    expect(screen.getByRole("heading", { name: "暂无匹配资产" })).toBeInTheDocument();
  });

  it("does not include a project field when submitting the tools source filter", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[]}
        filters={{}}
        projects={[project]}
      />
    );

    fireEvent.change(screen.getByLabelText("项目"), {
      target: { value: project.id }
    });
    fireEvent.change(screen.getByLabelText("来源"), {
      target: { value: "tools" }
    });

    const projectSelect = screen.getByLabelText("项目");
    const form = screen.getByRole("button", { name: "筛选" }).closest("form");
    expect(projectSelect).toBeDisabled();
    expect(new FormData(form as HTMLFormElement).has("project_id")).toBe(false);
  });

  it("renders all four sections including public generated images", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[
          characterAsset,
          sceneAsset,
          storyboardVideoAsset,
          finalVideoAsset,
          generatedImageAsset
        ]}
        filters={{}}
        projects={[project]}
      />
    );

    expect(screen.getByRole("heading", { name: "角色资产" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "场景资产" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "图片成品" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "产物" })).toBeInTheDocument();
    expect(screen.getByText("图层合成")).toBeInTheDocument();
  });

  it("shows tool cards with task metadata and a direct download", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[toolVideoAsset]}
        filters={{ source: "tools" }}
        projects={[project]}
        toolTasks={[toolTask]}
      />
    );

    expect(screen.getByRole("heading", { name: "工具资产" })).toBeInTheDocument();
    expect(screen.getByText("视频人物打码")).toBeInTheDocument();
    expect(screen.getByText("输出产物")).toBeInTheDocument();
    expect(screen.getAllByText("生成中")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "下载资产" })).toHaveAttribute(
      "href",
      "http://backend.local/api/assets/tool-video-1/content?download=1"
    );
  });

  it("shows AIGC input and output with dedicated source and role labels", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[aigcInputAsset, aigcOutputAsset]}
        filters={{ source: "aigc" }}
        projects={[project]}
      />
    );

    expect(screen.getAllByText("AIGC 工作台").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("AIGC 输入")).toBeInTheDocument();
    expect(screen.getByText("AIGC 输出")).toBeInTheDocument();
    expect(
      screen.getByText("商品主图-图生图1-图片1.png")
    ).toBeInTheDocument();
    expect(screen.queryByText("Provider description")).not.toBeInTheDocument();
  });

  it("keeps tools and AIGC mutually exclusive", () => {
    const { rerender } = render(
      <WorkspaceAssetLibrary
        assets={[toolVideoAsset, aigcInputAsset, aigcOutputAsset]}
        filters={{ source: "tools" }}
        projects={[project]}
        toolTasks={[toolTask]}
      />
    );

    expect(screen.getByText("人物打码结果")).toBeInTheDocument();
    expect(screen.queryByText("参考商品图")).not.toBeInTheDocument();

    rerender(
      <WorkspaceAssetLibrary
        assets={[toolVideoAsset, aigcInputAsset, aigcOutputAsset]}
        filters={{ source: "aigc" }}
        projects={[project]}
        toolTasks={[toolTask]}
      />
    );

    expect(screen.queryByText("人物打码结果")).not.toBeInTheDocument();
    expect(screen.getByText("参考商品图")).toBeInTheDocument();
  });

  it("combines AIGC source with status, section, and keyword filters", () => {
    const failedVideo = createAsset({
      ...aigcInputAsset,
      id: "aigc-video",
      metadata: { name: "失败视频", origin: "aigc" },
      mime_type: "video/mp4",
      status: "failed",
      type: "uploaded_video"
    });

    render(
      <WorkspaceAssetLibrary
        assets={[aigcInputAsset, aigcOutputAsset, failedVideo]}
        filters={{ section: "product", source: "aigc", status: "succeeded" }}
        projects={[project]}
      />
    );

    expect(screen.getByText("参考商品图")).toBeInTheDocument();
    expect(screen.queryByText("失败视频")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索资产"), {
      target: { value: "图生图1" }
    });

    expect(screen.queryByText("参考商品图")).not.toBeInTheDocument();
    expect(
      screen.getByText("商品主图-图生图1-图片1.png")
    ).toBeInTheDocument();
  });

  it("shows an AIGC-specific empty state", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[toolVideoAsset]}
        filters={{ source: "aigc" }}
        projects={[project]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "暂无 AIGC 工作台资产" })
    ).toBeInTheDocument();
    expect(screen.queryByText("人物打码结果")).not.toBeInTheDocument();
  });

  it("shows the unified AIGC name and source details in preview and download", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[aigcOutputAsset]}
        filters={{ source: "aigc" }}
        projects={[project]}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "放大查看商品主图-图生图1-图片1.png预览"
      })
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("商品主图-图生图1-图片1.png")).toBeInTheDocument();
    expect(within(dialog).getByText("AIGC 工作台")).toBeInTheDocument();
    expect(within(dialog).getByText("AIGC 输出")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "下载资产" })).toHaveAttribute(
      "href",
      expect.stringContaining(
        "filename=%E5%95%86%E5%93%81%E4%B8%BB%E5%9B%BE-%E5%9B%BE%E7%94%9F%E5%9B%BE1-%E5%9B%BE%E7%89%871.png"
      )
    );
  });

  it("uses the tool deletion endpoint without affecting project assets", async () => {
    apiMocks.deleteToolAsset.mockResolvedValue(undefined);

    render(
      <WorkspaceAssetLibrary
        assets={[toolVideoAsset, characterAsset]}
        filters={{ source: "tools" }}
        projects={[project]}
        toolTasks={[toolTask]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "删除资产" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("不会影响同一任务的其他资产");
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() =>
      expect(apiMocks.deleteToolAsset).toHaveBeenCalledWith("tool-video-1")
    );
    expect(apiMocks.deleteAsset).not.toHaveBeenCalled();
  });

  it("surfaces artifact assets and a derived last-frame card", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[storyboardVideoAsset, finalVideoAsset]}
        filters={{ section: "artifacts" }}
        projects={[project]}
      />
    );

    expect(screen.getByText("分镜视频片段")).toBeInTheDocument();
    expect(screen.getByText("尾帧图")).toBeInTheDocument();
    expect(screen.getByText("视频编辑结果")).toBeInTheDocument();
    // 资产类型 tags distinguish artifact subtypes.
    expect(screen.getByText("产物-分镜视频")).toBeInTheDocument();
    expect(screen.getByText("产物-尾帧")).toBeInTheDocument();
    expect(screen.getByText("产物-视频编辑")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "尾帧图预览" })
    ).toHaveAttribute("src", "http://backend.local/api/assets/video-1/last-frame");
    expect(screen.getAllByRole("button", { name: "重命名资产" })).toHaveLength(2);
    const lastFrameCard = screen
      .getByRole("img", { name: "尾帧图预览" })
      .closest("article");
    expect(
      within(lastFrameCard as HTMLElement).queryByRole("button", {
        name: "重命名资产"
      })
    ).not.toBeInTheDocument();
  });

  it("shows stable rename and delete actions outside independent thumbnails", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset, toolVideoAsset, aigcInputAsset]}
        filters={{}}
        projects={[project]}
        toolTasks={[toolTask]}
      />
    );

    const renameButtons = screen.getAllByRole("button", {
      name: "重命名资产"
    });
    expect(renameButtons).toHaveLength(3);
    for (const button of renameButtons) {
      expect(button).toHaveAttribute("title", "重命名资产");
      expect(button.closest("[data-asset-actions]")).toContainElement(
        within(button.closest("[data-asset-actions]") as HTMLElement).getByRole(
          "button",
          { name: "删除资产" }
        )
      );
      expect(button.closest("[data-asset-actions]")?.parentElement).not.toHaveClass(
        "absolute"
      );
    }
  });

  it("renames an asset and immediately updates search, preview, and download", async () => {
    const renamedAsset: Asset = {
      ...aigcOutputAsset,
      metadata: {
        ...aigcOutputAsset.metadata,
        name: "  用户新品图.png  ",
        name_scheme: "user_defined_v1"
      },
      url: "https://cdn.example.test/renamed.png"
    };
    apiMocks.renameAsset.mockResolvedValue(renamedAsset);

    render(
      <WorkspaceAssetLibrary
        assets={[aigcOutputAsset]}
        filters={{ source: "aigc" }}
        projects={[project]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "重命名资产" }));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText("资产名称");
    expect(input).toHaveValue("商品主图-图生图1-图片1.png");

    fireEvent.change(input, { target: { value: "  用户新品图.png  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(apiMocks.renameAsset).toHaveBeenCalledWith("aigc-output", {
        name: "用户新品图.png"
      })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("用户新品图.png")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索资产"), {
      target: { value: "商品主图" }
    });
    expect(
      screen.getByRole("heading", { name: "未找到匹配" })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索资产"), {
      target: { value: "用户新品" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "放大查看用户新品图.png预览" })
    );
    const previewDialog = screen.getByRole("dialog");
    expect(within(previewDialog).getByText("用户新品图.png")).toBeInTheDocument();
    expect(
      within(previewDialog).getByRole("img", { name: "用户新品图.png大图" })
    ).toHaveAttribute(
      "src",
      "https://cdn.example.test/renamed.png"
    );
    expect(
      within(previewDialog).getByRole("link", { name: "下载资产" })
    ).toHaveAttribute(
      "href",
      expect.stringContaining(
        "filename=%E7%94%A8%E6%88%B7%E6%96%B0%E5%93%81%E5%9B%BE.png"
      )
    );
  });

  it("disables invalid or unchanged names and enables a valid change", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset]}
        filters={{ section: "character" }}
        projects={[project]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "重命名资产" }));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText("资产名称");
    const saveButton = within(dialog).getByRole("button", { name: "保存" });

    expect(saveButton).toBeDisabled();

    fireEvent.change(input, {
      target: { value: "  晨间通勤中的年轻女性  " }
    });
    expect(saveButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "   " } });
    expect(saveButton).toBeDisabled();
    const blankNameError = within(dialog).getByRole("alert");
    expect(blankNameError).toHaveTextContent("请输入资产名称。");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", blankNameError.id);

    fireEvent.change(input, { target: { value: "😀".repeat(121) } });
    expect(saveButton).toBeDisabled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "名称不能超过 120 个字符。"
    );

    fireEvent.change(input, { target: { value: "名称\u0001" } });
    expect(saveButton).toBeDisabled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "名称不能包含控制字符。"
    );

    fireEvent.change(input, { target: { value: "有效的新名称😀" } });
    expect(saveButton).toBeEnabled();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(apiMocks.renameAsset).not.toHaveBeenCalled();
  });

  it("keeps the dialog and original name when renaming fails", async () => {
    apiMocks.renameAsset.mockRejectedValue(new Error("request failed"));
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset]}
        filters={{ section: "character" }}
        projects={[project]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "重命名资产" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("资产名称"), {
      target: { value: "失败的新名称" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "服务暂时不可用，请稍后重试。"
      )
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("晨间通勤中的年轻女性")).toBeInTheDocument();
  });

  it("disables rename controls and ignores duplicate submissions", async () => {
    let resolveRename: (asset: Asset) => void = () => undefined;
    apiMocks.renameAsset.mockImplementation(
      () =>
        new Promise<Asset>((resolve) => {
          resolveRename = resolve;
        })
    );
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset]}
        filters={{ section: "character" }}
        projects={[project]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "重命名资产" }));
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByLabelText("资产名称");
    fireEvent.change(input, { target: { value: "新角色名称" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(input).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "保存中…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "取消" })).toBeDisabled();
    expect(
      within(dialog).queryByRole("button", { name: "关闭" })
    ).not.toBeInTheDocument();
    expect(apiMocks.renameAsset).toHaveBeenCalledTimes(1);

    resolveRename({
      ...characterAsset,
      metadata: {
        ...characterAsset.metadata,
        name: "新角色名称",
        name_scheme: "user_defined_v1"
      }
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("keeps the last-frame title fixed while matching the renamed host", () => {
    const renamedStoryboard: Asset = {
      ...storyboardVideoAsset,
      metadata: {
        ...storyboardVideoAsset.metadata,
        name: "新版分镜",
        name_scheme: "user_defined_v1"
      }
    };
    render(
      <WorkspaceAssetLibrary
        assets={[renamedStoryboard]}
        filters={{ section: "artifacts" }}
        projects={[project]}
      />
    );

    fireEvent.change(screen.getByLabelText("搜索资产"), {
      target: { value: "新版分镜" }
    });

    expect(screen.getByText("新版分镜")).toBeInTheDocument();
    expect(screen.getByText("尾帧图")).toBeInTheDocument();
  });

  it("keeps external http URLs and categorized metadata", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset, sceneAsset]}
        filters={{ projectId: project.id, status: "succeeded" }}
        projects={[project]}
      />
    );

    const imagePreview = screen.getByRole("img", {
      name: "晨间通勤中的年轻女性预览"
    });
    expect(imagePreview).toHaveAttribute("src", characterAsset.url);
    expect(imagePreview).toHaveClass("object-contain");
    expect(screen.getByText("晨光地铁站")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "筛选" })).toBeInTheDocument();
  });

  it("opens an enlarged image preview dialog when a card image is clicked", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset]}
        filters={{ section: "character" }}
        projects={[project]}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "放大查看晨间通勤中的年轻女性预览" })
    );

    const dialog = screen.getByRole("dialog");
    const enlargedImage = within(dialog).getByRole("img", {
      name: "晨间通勤中的年轻女性大图"
    });
    expect(enlargedImage).toHaveAttribute("src", characterAsset.url);
    expect(enlargedImage).toHaveClass("object-contain");
    expect(within(dialog).getByText("便携咖啡机投放")).toBeInTheDocument();
  });

  it("opens a playable video dialog for artifact videos", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[storyboardVideoAsset]}
        filters={{ section: "artifacts" }}
        projects={[project]}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "播放分镜视频片段预览" })
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByLabelText("分镜视频片段播放")
    ).toHaveAttribute("src", "http://backend.local/api/assets/video-1/content");
    expect(
      screen.getByLabelText("分镜视频片段预览")
    ).toHaveClass("object-contain");
  });

  it("does not make cards without a preview URL clickable", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[sceneAsset]}
        filters={{ section: "scene" }}
        projects={[project]}
      />
    );

    expect(
      screen.queryByRole("button", { name: /放大查看/ })
    ).not.toBeInTheDocument();
    expect(screen.getByText("暂无预览")).toBeInTheDocument();
  });

  it("renders sidebar options with unfiltered section counts", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset, sceneAsset, storyboardVideoAsset, finalVideoAsset]}
        filters={{}}
        projects={[project]}
      />
    );

    const sidebar = screen.getByRole("navigation", { name: "资产分区" });
    // storyboard video contributes a video card plus a derived last-frame card,
    // and the final video adds one more, so 产物 totals 3 and 全部 totals 5.
    expect(within(sidebar).getByRole("button", { name: /全部/ })).toHaveTextContent(
      "5"
    );
    expect(within(sidebar).getByRole("button", { name: /角色/ })).toHaveTextContent(
      "1"
    );
    expect(within(sidebar).getByRole("button", { name: /场景/ })).toHaveTextContent(
      "1"
    );
    expect(within(sidebar).getByRole("button", { name: /图片/ })).toHaveTextContent(
      "0"
    );
    expect(within(sidebar).getByRole("button", { name: /产物/ })).toHaveTextContent(
      "3"
    );
  });

  it("shows generated image metadata and download in the detail dialog", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[generatedImageAsset]}
        filters={{ section: "product" }}
        projects={[project]}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "放大查看蓝色背景上的便携咖啡机预览"
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("图层合成")).toHaveLength(2);
    expect(within(dialog).getByText("ecommerce_main")).toBeInTheDocument();
    expect(within(dialog).getByText("source-1")).toBeInTheDocument();
    expect(within(dialog).getByText("1024 × 1024")).toBeInTheDocument();
    expect(within(dialog).getByText("doubao-seedream-5-0-pro")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "下载资产" })).toHaveAttribute(
      "href",
      "http://backend.local/api/assets/generated-1/content?download=1"
    );
  });

  it("switches the visible section from the sidebar without refetching", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset, sceneAsset, storyboardVideoAsset, finalVideoAsset]}
        filters={{}}
        projects={[project]}
      />
    );

    // "全部" renders every section by default.
    expect(screen.getByRole("heading", { name: "角色资产" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "场景资产" })).toBeInTheDocument();

    const sidebar = screen.getByRole("navigation", { name: "资产分区" });
    fireEvent.click(within(sidebar).getByRole("button", { name: /角色/ }));

    expect(screen.getByRole("heading", { name: "角色资产" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "场景资产" })
    ).not.toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole("button", { name: /全部/ }));
    expect(screen.getByRole("heading", { name: "场景资产" })).toBeInTheDocument();
  });

  it("filters visible assets by keyword and restores when cleared", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset, sceneAsset]}
        filters={{}}
        projects={[project]}
      />
    );

    fireEvent.change(screen.getByLabelText("搜索资产"), {
      target: { value: "地铁" }
    });

    expect(screen.getByText("晨光地铁站")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "晨间通勤中的年轻女性预览" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));

    expect(
      screen.getByRole("img", { name: "晨间通勤中的年轻女性预览" })
    ).toBeInTheDocument();
  });

  it("shows a no-match state when the keyword matches nothing", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset, sceneAsset]}
        filters={{}}
        projects={[project]}
      />
    );

    fireEvent.change(screen.getByLabelText("搜索资产"), {
      target: { value: "无匹配关键词" }
    });

    expect(
      screen.getByRole("heading", { name: "未找到匹配" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "角色资产" })
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索资产"), {
      target: { value: "" }
    });

    expect(
      screen.queryByRole("heading", { name: "未找到匹配" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "角色资产" })).toBeInTheDocument();
  });

  it("deletes an asset after confirmation and removes it from the list", async () => {
    apiMocks.deleteAsset.mockResolvedValue({});

    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset]}
        filters={{ section: "character" }}
        projects={[project]}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "删除资产" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() =>
      expect(apiMocks.deleteAsset).toHaveBeenCalledWith("project-1", "character-1")
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("img", { name: "晨间通勤中的年轻女性预览" })
      ).not.toBeInTheDocument()
    );
  });

  it("does not call the API when the delete dialog is cancelled", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset]}
        filters={{ section: "character" }}
        projects={[project]}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "删除资产" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(apiMocks.deleteAsset).not.toHaveBeenCalled();
    expect(
      screen.getByRole("img", { name: "晨间通勤中的年轻女性预览" })
    ).toBeInTheDocument();
  });

  it("warns that deleting a last-frame card removes the host storyboard video", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[storyboardVideoAsset]}
        filters={{ section: "artifacts" }}
        projects={[project]}
      />
    );

    // The last-frame card is the second artifact card.
    const deleteButtons = screen.getAllByRole("button", { name: "删除资产" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/删除后将同时删除对应分镜视频片段/)
    ).toBeInTheDocument();
  });

  it("paginates sections that exceed the page size", () => {
    const many = Array.from({ length: 32 }, (_, index) =>
      createAsset({
        category: "character",
        id: `character-${index}`,
        metadata: { name: `角色 ${index}` }
      })
    );

    render(
      <WorkspaceAssetLibrary
        assets={many}
        filters={{ section: "character" }}
        projects={[project]}
      />
    );

    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "删除资产" })).toHaveLength(30);

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "删除资产" })).toHaveLength(2);
  });

  it("keeps exactly thirty assets on one page without pagination", () => {
    const thirtyAssets = Array.from({ length: 30 }, (_, index) =>
      createAsset({
        category: "character",
        id: `single-page-character-${index}`,
        metadata: { name: `单页角色 ${index}` }
      })
    );

    render(
      <WorkspaceAssetLibrary
        assets={thirtyAssets}
        filters={{ section: "character" }}
        projects={[project]}
      />
    );

    expect(screen.getAllByRole("button", { name: "删除资产" })).toHaveLength(30);
    expect(screen.queryByRole("button", { name: "下一页" })).not.toBeInTheDocument();
  });

  it("uses the shared responsive grid for every asset section", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[
          characterAsset,
          sceneAsset,
          storyboardVideoAsset,
          generatedImageAsset,
          toolVideoAsset,
          aigcInputAsset
        ]}
        filters={{}}
        projects={[project]}
        toolTasks={[toolTask]}
      />
    );

    for (const heading of [
      "角色资产",
      "场景资产",
      "图片成品",
      "产物",
      "工具资产",
      "AIGC 工作台"
    ]) {
      const section = screen.getByRole("heading", { name: heading }).closest("section");
      const grid = section?.querySelector("[data-asset-grid]");

      expect(grid).toHaveClass(
        "min-w-0",
        "grid-cols-1",
        "sm:grid-cols-2",
        "lg:grid-cols-3",
        "xl:grid-cols-6"
      );
    }
  });

  it("shows a safe loading error instead of an empty-state action", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[]}
        error="服务暂时不可用，请稍后重试。"
        filters={{}}
        projects={[]}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("资产加载失败");
    expect(screen.queryByText("暂无匹配资产")).not.toBeInTheDocument();
  });

  it("shows a global empty state when no sections have content", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[]}
        filters={{ projectId: project.id }}
        projects={[project]}
      />
    );

    expect(screen.getByRole("heading", { name: "暂无匹配资产" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "返回项目创作流程" })
    ).toHaveAttribute("href", "/projects/project-1");
  });
});

describe("buildArtifactItems", () => {
  it("aggregates storyboard videos, last-frames, and final videos", () => {
    const items = buildArtifactItems([
      characterAsset,
      storyboardVideoAsset,
      finalVideoAsset
    ]);

    expect(items.map((item) => item.kind)).toEqual([
      "storyboard_video",
      "last_frame",
      "final_video"
    ]);
    expect(items[1].isLastFrame).toBe(true);
    expect(items[1].asset.id).toBe("video-1");
  });

  it("omits the last-frame item when the companion is unavailable", () => {
    const items = buildArtifactItems([
      createAsset({
        category: null,
        id: "video-2",
        metadata: { last_frame_status: "unavailable" },
        type: "storyboard_video",
        url: "/api/assets/video-2/content"
      })
    ]);

    expect(items.map((item) => item.kind)).toEqual(["storyboard_video"]);
  });
});

describe("partitionWorkspaceAssets", () => {
  it("uses project-first classification, hides internal assets, and deduplicates IDs", () => {
    const projectConflict = createAsset({
      id: "project-conflict",
      metadata: { origin: "aigc" },
      project_id: project.id,
      tool_asset_role: "output"
    });
    const internalAigc = createAsset({
      ...aigcOutputAsset,
      asset_role: "internal_layer",
      id: "internal-aigc"
    });
    const partition = partitionWorkspaceAssets([
      projectConflict,
      projectConflict,
      toolVideoAsset,
      aigcInputAsset,
      aigcOutputAsset,
      internalAigc,
      createAsset({ id: "orphan", project_id: null, tool_asset_role: null })
    ]);

    expect(partition.projects.map((item) => item.id)).toEqual([
      "project-conflict"
    ]);
    expect(partition.tools.map((item) => item.id)).toEqual(["tool-video-1"]);
    expect(partition.aigc.map((item) => item.id)).toEqual([
      "aigc-input",
      "aigc-output"
    ]);
    expect(
      new Set([
        ...partition.projects,
        ...partition.tools,
        ...partition.aigc
      ].map((item) => item.id)).size
    ).toBe(4);
  });
});

describe("keyword matchers", () => {
  it("matches assets on their resolved description, case-insensitively", () => {
    expect(assetMatchesKeyword(characterAsset, "通勤")).toBe(true);
    expect(assetMatchesKeyword(characterAsset, "地铁")).toBe(false);
    // An empty keyword matches everything.
    expect(assetMatchesKeyword(sceneAsset, "  ")).toBe(true);
  });

  it("matches artifacts on the kind label or the host asset description", () => {
    const [storyboardItem] = buildArtifactItems([storyboardVideoAsset]);

    expect(artifactMatchesKeyword(storyboardItem, "分镜")).toBe(true);
    expect(artifactMatchesKeyword(storyboardItem, "不存在")).toBe(false);
  });
});

describe("getWorkspaceAssetDescription", () => {
  it("uses description, name, prompt, then the category default", () => {
    expect(getWorkspaceAssetDescription(characterAsset)).toBe(
      "晨间通勤中的年轻女性"
    );
    expect(getWorkspaceAssetDescription(sceneAsset)).toBe("晨光地铁站");
    expect(
      getWorkspaceAssetDescription(
        createAsset({
          category: "scene",
          metadata: { prompt: "蓝调时刻的城市天台" }
        })
      )
    ).toBe("蓝调时刻的城市天台");
    expect(
      getWorkspaceAssetDescription(
        createAsset({ category: "character", metadata: {} })
      )
    ).toBe("角色形象资产");
  });
});

describe("getSafePreviewUrl", () => {
  it("accepts backend asset proxy URLs without exposing signed query strings", () => {
    expect(
      getSafePreviewUrl(
        createAsset({
          id: "asset-proxy",
          url: "/api/assets/asset-proxy/content"
        })
      )
    ).toBe("http://backend.local/api/assets/asset-proxy/content");
  });

  it("keeps external http URLs and rejects unsafe relative URLs", () => {
    expect(
      getSafePreviewUrl(createAsset({ url: "https://cdn.example.test/image.png" }))
    ).toBe("https://cdn.example.test/image.png");
    expect(getSafePreviewUrl(createAsset({ url: "/internal/file.png" }))).toBeNull();
  });

  it("accepts last-frame proxy metadata and rejects internal object keys", () => {
    expect(
      getSafeLastFrameUrl(
        createAsset({
          metadata: {
            last_frame_url: "/api/assets/video-1/last-frame"
          }
        })
      )
    ).toBe("http://backend.local/api/assets/video-1/last-frame");
    expect(
      getSafeLastFrameUrl(
        createAsset({
          metadata: {
            last_frame_object_key: "projects/project/video-last-frame.png"
          }
        })
      )
    ).toBeNull();
  });
});

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    category: "character",
    created_at: "2026-08-09T10:00:00Z",
    id: "asset-1",
    metadata: {},
    mime_type: "image/png",
    object_key: "projects/project-1/asset.png",
    project_id: "project-1",
    size_bytes: 1024,
    source_task_id: "task-1",
    stage: "character",
    status: "succeeded",
    type: "generated_image",
    updated_at: "2026-08-09T10:00:00Z",
    url: null,
    ...overrides
  };
}
