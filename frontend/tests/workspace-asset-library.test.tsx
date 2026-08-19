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
  getWorkspaceAssetDescription
} from "@/lib/asset-display";
import type { Asset, ProjectListItem } from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  deleteAsset: vi.fn(),
  listAssets: vi.fn(),
  listProjects: vi.fn()
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

describe("WorkspaceAssetLibrary", () => {
  beforeEach(() => {
    apiMocks.deleteAsset.mockReset();
    apiMocks.listAssets.mockReset();
    apiMocks.listProjects.mockReset();
  });

  it("fetches assets without a backend category and keeps sections client-side", async () => {
    apiMocks.listProjects.mockResolvedValue([project]);
    apiMocks.listAssets.mockResolvedValue([characterAsset]);

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
  });

  it("keeps external http URLs and categorized metadata", () => {
    render(
      <WorkspaceAssetLibrary
        assets={[characterAsset, sceneAsset]}
        filters={{ projectId: project.id, status: "succeeded" }}
        projects={[project]}
      />
    );

    expect(
      screen.getByRole("img", { name: "晨间通勤中的年轻女性预览" })
    ).toHaveAttribute("src", characterAsset.url);
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
    expect(
      within(dialog).getByRole("img", { name: "晨间通勤中的年轻女性大图" })
    ).toHaveAttribute("src", characterAsset.url);
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
      "http://backend.local/api/assets/generated-1/content"
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
    const many = Array.from({ length: 8 }, (_, index) =>
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
    expect(screen.getAllByRole("button", { name: "删除资产" })).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "删除资产" })).toHaveLength(2);
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
