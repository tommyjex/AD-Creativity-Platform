import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import { StoryboardVideoWorkspace } from "@/components/workspace/storyboard-video-workspace";
import {
  MERGE_DURATION_EXCEEDED_MESSAGE,
  MERGE_NOT_ADJACENT_MESSAGE
} from "@/lib/storyboard-merge";
import type {
  Asset,
  CharacterCard,
  CharacterCardImageGenerationResponse,
  GenerationTask,
  Project,
  ProjectListItem,
  StoryboardShot,
  StoryboardShotVideoConfig
} from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  applyStoryboardShotLastFrameReference: vi.fn(),
  attachStoryboardShotReference: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  deleteCharacterCard: vi.fn(),
  editStoryboardShotVideo: vi.fn(),
  ensureStoryboardShotLastFrameReferenceAsset: vi.fn(),
  generateCharacterCardImage: vi.fn(),
  generateStoryboardShotVideo: vi.fn(),
  getStoryboardShotVideoConfig: vi.fn(),
  getProject: vi.fn(),
  getTask: vi.fn(),
  iterateCharacterAsset: vi.fn(),
  listProjects: vi.fn(),
  listImagePromptVersions: vi.fn(),
  mergeStoryboardShots: vi.fn(),
  optimizeStoryboardShotVideoPrompt: vi.fn(),
  removeStoryboardShotReference: vi.fn(),
  selectStoryboardShotVideo: vi.fn(),
  splitStoryboardShot: vi.fn(),
  saveImagePromptVersion: vi.fn(),
  updateCharacterCard: vi.fn(),
  updateStoryboardShotVideoConfig: vi.fn(),
  updateTextArtifact: vi.fn(),
  updateProject: vi.fn(),
  uploadStoryboardShotReference: vi.fn()
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...original,
    apiClient: apiMocks,
    getBackendBaseUrl: () => "http://backend.local",
    getUserFacingErrorMessage: () => "请求未完成，请检查网络连接后重试。"
  };
});

const project: Project = {
  assets: [],
  brief: {
    aspect_ratio: "9:16",
    audience: "通勤白领",
    duration_seconds: 30,
    image_purpose: null,
    product_name: "AeroPress Go",
    prompt: "为便携咖啡机制作一条 30 秒短视频广告",
    selling_points: ["便携"],
    style: "真实生活流",
    summary: "面向通勤场景的便携咖啡解决方案",
    target_language: "zh",
    target_platform: "douyin"
  },
  character_cards: [],
  created_at: "2026-08-09T10:00:00Z",
  current_stage: "brief",
  current_image_asset_id: null,
  current_image_prompt_version_id: null,
  id: "project-1",
  image_prompt_status: "draft",
  image_revision: 0,
  name: "便携咖啡机投放",
  project_type: "video_ad",
  status: "draft",
  storyboard: [],
  tasks: [],
  text_artifacts: [],
  updated_at: "2026-08-09T10:00:00Z"
};

const projectListItem: ProjectListItem = {
  brief: project.brief,
  created_at: project.created_at,
  current_stage: project.current_stage,
  current_image_asset_id: project.current_image_asset_id,
  current_image_prompt_version_id: project.current_image_prompt_version_id,
  id: project.id,
  name: project.name,
  image_prompt_status: project.image_prompt_status,
  image_revision: project.image_revision,
  project_type: project.project_type,
  status: project.status,
  updated_at: project.updated_at
};

const secondProject: Project = {
  ...project,
  id: "project-2",
  name: "户外水杯夏季推广",
  brief: {
    ...project.brief,
    product_name: "轻量水杯",
    prompt: "突出户外徒步和轻量设计"
  }
};

const secondProjectListItem: ProjectListItem = {
  brief: secondProject.brief,
  created_at: secondProject.created_at,
  current_stage: secondProject.current_stage,
  current_image_asset_id: secondProject.current_image_asset_id,
  current_image_prompt_version_id:
    secondProject.current_image_prompt_version_id,
  id: secondProject.id,
  name: secondProject.name,
  image_prompt_status: secondProject.image_prompt_status,
  image_revision: secondProject.image_revision,
  project_type: secondProject.project_type,
  status: secondProject.status,
  updated_at: secondProject.updated_at
};

const imageProjectListItem: ProjectListItem = {
  ...projectListItem,
  brief: {
    ...projectListItem.brief,
    duration_seconds: null,
    image_purpose: "poster",
    prompt: "为夏季气泡水制作一张清爽的社交媒体海报"
  },
  id: "image-project-1",
  name: "气泡水夏季海报",
  project_type: "image_asset"
};

describe("ProjectWorkspace", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.getProject.mockResolvedValue(project);
    apiMocks.getStoryboardShotVideoConfig.mockImplementation(
      async (_projectId: string, shotId: string) => {
        const shot = project.storyboard.find((item) => item.id === shotId);

        return storyboardVideoConfigFixture(shot ?? {
          created_at: "2026-08-10T08:40:00Z",
          description: "通勤电梯内，主角从包中取出便携咖啡机。",
          duration_seconds: 12,
          id: shotId,
          first_frame_asset_id: null,
          first_frame_source_video_asset_id: null,
          image_asset_id: null,
          index: shotId.endsWith("2") ? 2 : 1,
          is_merged: false,
          merge_source_count: 0,
          narration: "好咖啡，随身出发。",
          project_id: project.id,
          reference_audio_asset_ids: [],
          reference_image_asset_ids: [],
          reference_video_asset_ids: [],
          status: "succeeded",
          title: shotId.endsWith("2") ? "办公室产品特写" : "通勤开场",
          updated_at: "2026-08-10T08:40:00Z",
          video_asset_id: null,
          video_prompt: null,
          visual_prompt: "真实摄影，通勤电梯，白领取出便携咖啡机"
        });
      }
    );
  });

  it("shows an actionable empty state and creates a project", async () => {
    apiMocks.createProject.mockResolvedValue(project);
    render(<ProjectWorkspace initialProjects={[]} />);

    expect(
      screen.getByRole("heading", { name: "还没有广告项目" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "新建第一个项目" })
    );
    fireEvent.change(screen.getByLabelText("项目名称"), {
      target: { value: "便携咖啡机投放" }
    });
    fireEvent.change(screen.getByLabelText("广告需求"), {
      target: { value: "为便携咖啡机制作一条 30 秒短视频广告" }
    });
    const targetLanguageSelect = screen.getByLabelText("目标语言");
    expect(targetLanguageSelect).toHaveValue("zh");
    expect(
      within(targetLanguageSelect).getAllByRole("option").map((option) => ({
        label: option.textContent,
        value: (option as HTMLOptionElement).value
      }))
    ).toEqual([
      { label: "中文", value: "zh" },
      { label: "英文", value: "en" }
    ]);
    fireEvent.click(screen.getByRole("button", { name: "创建项目" }));

    await waitFor(() => {
      expect(apiMocks.createProject).toHaveBeenCalledWith({
        brief: {
          aspect_ratio: "9:16",
          audience: null,
          duration_seconds: 30,
          image_purpose: null,
          product_name: null,
          prompt: "为便携咖啡机制作一条 30 秒短视频广告",
          selling_points: [],
          style: null,
          target_language: "zh",
          target_platform: "douyin"
        },
        name: "便携咖啡机投放",
        project_type: "video_ad"
      });
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: project.name })
    ).toBeInTheDocument();
  });

  it("loads full details after selecting a project", async () => {
    apiMocks.getProject.mockResolvedValue(project);
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);

    expect(
      screen.getByRole("heading", { name: "选择项目查看详情" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );

    await waitFor(() => {
      expect(apiMocks.getProject).toHaveBeenCalledWith("project-1", {
        cache: "no-store"
      });
    });
    expect(
      await screen.findByRole("heading", { level: 2, name: project.name })
    ).toBeInTheDocument();
    expect(screen.getAllByText(project.brief.summary!).length).toBeGreaterThan(0);
    expect(screen.getAllByText(project.brief.prompt).length).toBeGreaterThan(0);
    expect(screen.getAllByText("目标语言")).toHaveLength(2);
    expect(screen.getAllByText("中文")).toHaveLength(2);
    expect(screen.queryByDisplayValue(project.brief.prompt)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "编辑 Brief" })
    ).toBeInTheDocument();
  });

  it("debounces backend project search and clears back to all projects", async () => {
    let resolveSearch!: (projects: ProjectListItem[]) => void;
    const searchRequest = new Promise<ProjectListItem[]>((resolve) => {
      resolveSearch = resolve;
    });
    apiMocks.listProjects
      .mockReturnValueOnce(searchRequest)
      .mockResolvedValueOnce([]);
    render(
      <ProjectWorkspace
        initialProjects={[projectListItem, secondProjectListItem]}
      />
    );

    const searchInput = screen.getByLabelText("搜索项目");
    fireEvent.change(searchInput, { target: { value: "户外" } });

    expect(apiMocks.listProjects).not.toHaveBeenCalled();
    expect(
      await screen.findByText("正在搜索项目...", {}, { timeout: 1000 })
    ).toBeInTheDocument();
    await act(async () => {
      resolveSearch([secondProjectListItem]);
      await searchRequest;
    });
    await waitFor(() => {
      expect(apiMocks.listProjects).toHaveBeenCalledWith("户外", {
        cache: "no-store"
      });
    });
    expect(screen.getByText(secondProject.name)).toBeInTheDocument();
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "不存在" } });
    expect(
      await screen.findByText("未找到匹配项目", {}, { timeout: 1000 })
    ).toBeInTheDocument();

    apiMocks.listProjects.mockResolvedValueOnce([
      projectListItem,
      secondProjectListItem
    ]);
    fireEvent.click(screen.getByRole("button", { name: "清空项目搜索" }));

    await waitFor(
      () => {
        expect(apiMocks.listProjects).toHaveBeenLastCalledWith({
          cache: "no-store"
        });
      },
      { timeout: 1000 }
    );
    expect(await screen.findByText(project.name)).toBeInTheDocument();
    expect(screen.getByText(secondProject.name)).toBeInTheDocument();
    expect(searchInput).toHaveValue("");
  });

  it("filters the sidebar project list by video and image project types", () => {
    render(
      <ProjectWorkspace
        initialProjects={[
          projectListItem,
          secondProjectListItem,
          imageProjectListItem
        ]}
      />
    );

    const categoryTabs = screen.getByLabelText("项目分类");
    expect(within(categoryTabs).getByRole("tab", { name: /全部项目（3 个项目）/ }))
      .toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(project.name)).toBeInTheDocument();
    expect(screen.getByText(secondProject.name)).toBeInTheDocument();
    expect(screen.getByText(imageProjectListItem.name)).toBeInTheDocument();

    fireEvent.click(
      within(categoryTabs).getByRole("tab", { name: /视频项目（2 个项目）/ })
    );
    expect(screen.getByText(project.name)).toBeInTheDocument();
    expect(screen.getByText(secondProject.name)).toBeInTheDocument();
    expect(screen.queryByText(imageProjectListItem.name)).not.toBeInTheDocument();

    fireEvent.click(
      within(categoryTabs).getByRole("tab", { name: /图片（1 个项目）/ })
    );
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    expect(screen.queryByText(secondProject.name)).not.toBeInTheDocument();
    expect(screen.getByText(imageProjectListItem.name)).toBeInTheDocument();
  });

  it("shows a searchable error and retries the current keyword", async () => {
    apiMocks.listProjects
      .mockRejectedValueOnce(new Error("private search failure"))
      .mockResolvedValueOnce([projectListItem]);
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);

    fireEvent.change(screen.getByLabelText("搜索项目"), {
      target: { value: "咖啡" }
    });

    expect(
      await screen.findByText(
        "请求未完成，请检查网络连接后重试。",
        {},
        { timeout: 1000 }
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(apiMocks.listProjects).toHaveBeenCalledTimes(2);
    });
    expect(apiMocks.listProjects).toHaveBeenLastCalledWith("咖啡", {
      cache: "no-store"
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a newly created matching project when an older search resolves", async () => {
    let resolveSearch!: (projects: ProjectListItem[]) => void;
    const searchRequest = new Promise<ProjectListItem[]>((resolve) => {
      resolveSearch = resolve;
    });
    apiMocks.listProjects.mockReturnValueOnce(searchRequest);
    apiMocks.createProject.mockResolvedValue(project);
    render(<ProjectWorkspace initialProjects={[secondProjectListItem]} />);

    fireEvent.change(screen.getByLabelText("搜索项目"), {
      target: { value: "咖啡" }
    });
    await screen.findByText("正在搜索项目...", {}, { timeout: 1000 });

    fireEvent.click(screen.getByRole("button", { name: "新建项目" }));
    fireEvent.change(screen.getByLabelText("项目名称"), {
      target: { value: project.name }
    });
    fireEvent.change(screen.getByLabelText("广告需求"), {
      target: { value: project.brief.prompt }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建项目" }));

    expect(
      await screen.findByRole("heading", { level: 2, name: project.name })
    ).toBeInTheDocument();
    await act(async () => {
      resolveSearch([]);
      await searchRequest;
    });

    const projectList = screen.getByLabelText("项目列表");
    expect(within(projectList).getByText(project.name)).toBeInTheDocument();
    expect(screen.getByLabelText("搜索项目")).toHaveValue("咖啡");
  });

  it("opens delete confirmation without selecting and supports cancel", () => {
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "删除项目" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(project.name);
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "项目仅会从前端项目列表中隐藏"
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "后端已生成的素材与产物将继续保留"
    );
    expect(apiMocks.getProject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiMocks.deleteProject).not.toHaveBeenCalled();
  });

  it("deletes a non-current project and keeps the current details", async () => {
    apiMocks.getProject.mockResolvedValue(project);
    apiMocks.deleteProject.mockResolvedValue(undefined);
    render(
      <ProjectWorkspace
        initialProjects={[projectListItem, secondProjectListItem]}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    expect(
      await screen.findByRole("heading", { level: 2, name: project.name })
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "删除项目" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => {
      expect(apiMocks.deleteProject).toHaveBeenCalledWith(secondProject.id);
    });
    expect(screen.queryByText(secondProject.name)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: project.name })
    ).toBeInTheDocument();
    expect(
      screen.getByText(`已从项目列表隐藏“${secondProject.name}”。`)
    ).toBeInTheDocument();
  });

  it("clears details and selection after deleting the current project", async () => {
    apiMocks.getProject.mockResolvedValue(project);
    apiMocks.deleteProject.mockResolvedValue(undefined);
    render(
      <ProjectWorkspace
        initialProjects={[projectListItem, secondProjectListItem]}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    await screen.findByRole("heading", { level: 2, name: project.name });
    fireEvent.click(screen.getAllByRole("button", { name: "删除项目" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(
      await screen.findByRole("heading", { name: "选择项目查看详情" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: project.name })
    ).not.toBeInTheDocument();
    expect(screen.getByText(secondProject.name)).toBeInTheDocument();
  });

  it("keeps delete confirmation open on failure and allows retry", async () => {
    apiMocks.deleteProject
      .mockRejectedValueOnce(new Error("private delete failure"))
      .mockResolvedValueOnce(undefined);
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);

    fireEvent.click(screen.getByRole("button", { name: "删除项目" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    expect(
      await screen.findByText("请求未完成，请检查网络连接后重试。")
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => {
      expect(apiMocks.deleteProject).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(project.name)).not.toBeInTheDocument();
  });

  it("uses the final video instead of a newer compose subtitle asset", async () => {
    const finalVideo = assetFixture({
      id: "final-video-1",
      mime_type: "video/mp4",
      stage: "compose",
      type: "final_video",
      updated_at: "2026-08-15T03:00:25Z",
      url: "/api/assets/final-video-1/content"
    });
    const subtitle = assetFixture({
      id: "subtitle-1",
      mime_type: "application/x-subrip",
      stage: "compose",
      type: "subtitle",
      updated_at: "2026-08-15T03:00:26Z",
      url: "/api/assets/subtitle-1/content"
    });
    apiMocks.getProject.mockResolvedValue({
      ...project,
      assets: [finalVideo, subtitle],
      current_stage: "compose",
      status: "succeeded"
    });

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "剪辑成片" }));

    expect(screen.getByText("资产 ID").nextSibling).toHaveTextContent(
      finalVideo.id
    );
    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "http://backend.local/api/assets/final-video-1/content"
    );
    expect(screen.getByTestId("compose-video-preview-frame")).toHaveStyle({
      aspectRatio: "9 / 16",
      width: "min(100%, 29.25dvh, 18rem)"
    });
    expect(document.querySelector("video")).toHaveClass(
      "h-full",
      "w-full",
      "object-contain"
    );
  });

  it("validates and saves all editable project fields", async () => {
    apiMocks.getProject.mockResolvedValue(project);
    apiMocks.updateProject.mockImplementation(
      async (
        _projectId: string,
        payload: { brief: { target_language: "zh" | "en" }; name: string }
      ) => ({
        ...project,
        brief: {
          ...project.brief,
          target_language: payload.brief.target_language
        },
        name: payload.name,
        updated_at: "2026-08-09T11:00:00Z"
      })
    );
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );

    fireEvent.click(await screen.findByRole("button", { name: "编辑 Brief" }));
    const nameInput = await screen.findByLabelText("项目名称");
    const targetLanguageSelect = screen.getByLabelText("目标语言");
    expect(targetLanguageSelect).toHaveValue("zh");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByText("请输入项目名称。")).toBeInTheDocument();
    expect(apiMocks.updateProject).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: "咖啡机秋季 Campaign" } });
    fireEvent.change(targetLanguageSelect, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByText("请选择有效的目标语言。")).toBeInTheDocument();
    expect(apiMocks.updateProject).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("广告需求"), {
      target: { value: "突出通勤与露营场景" }
    });
    fireEvent.change(screen.getByLabelText("投放平台"), {
      target: { value: "xiaohongshu" }
    });
    fireEvent.change(screen.getByLabelText("画面比例"), {
      target: { value: "1:1" }
    });
    fireEvent.change(targetLanguageSelect, {
      target: { value: "en" }
    });
    fireEvent.change(screen.getByLabelText("视频时长（秒）"), {
      target: { value: "45" }
    });
    fireEvent.change(screen.getByLabelText("商品名称"), {
      target: { value: "AeroPress Go Plus" }
    });
    fireEvent.change(screen.getByLabelText("视觉风格"), {
      target: { value: "自然晨光" }
    });
    fireEvent.change(screen.getByLabelText("目标受众"), {
      target: { value: "城市户外人群" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(apiMocks.updateProject).toHaveBeenCalledWith("project-1", {
        brief: {
          aspect_ratio: "1:1",
          audience: "城市户外人群",
          duration_seconds: 45,
          image_purpose: null,
          product_name: "AeroPress Go Plus",
          prompt: "突出通勤与露营场景",
          selling_points: ["便携"],
          style: "自然晨光",
          target_language: "en",
          target_platform: "xiaohongshu"
        },
        name: "咖啡机秋季 Campaign"
      });
    });
    expect(
      await screen.findByRole("button", { name: "编辑 Brief" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("英文")).toHaveLength(2);
    expect(screen.queryByLabelText("项目名称")).not.toBeInTheDocument();
  });

  it("keeps edited input and shows a safe message when saving fails", async () => {
    apiMocks.getProject.mockResolvedValue(project);
    apiMocks.updateProject.mockRejectedValue(
      new Error("Traceback: private backend path")
    );
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );

    fireEvent.click(await screen.findByRole("button", { name: "编辑 Brief" }));
    const nameInput = await screen.findByLabelText("项目名称");
    fireEvent.change(nameInput, { target: { value: "尚未保存的名称" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    expect(
      await screen.findByText("请求未完成，请检查网络连接后重试。")
    ).toBeInTheDocument();
    expect(nameInput).toHaveValue("尚未保存的名称");
    expect(screen.queryByText(/Traceback/)).not.toBeInTheDocument();
  });

  it("closes Brief editing and discards unsaved local changes", async () => {
    apiMocks.getProject.mockResolvedValue(project);
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );

    fireEvent.click(await screen.findByRole("button", { name: "编辑 Brief" }));
    const nameInput = await screen.findByLabelText("项目名称");
    fireEvent.change(nameInput, { target: { value: "未保存名称" } });
    fireEvent.click(screen.getByRole("button", { name: "关闭编辑" }));

    expect(apiMocks.updateProject).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "编辑 Brief" })
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue("未保存名称")).not.toBeInTheDocument();
    expect(screen.getAllByText(project.name).length).toBeGreaterThan(0);
  });

  it("switches between Brief, the latest story, latest script, storyboard, and succeeded characters", async () => {
    const enrichedProject: Project = {
      ...project,
      assets: [
        {
          category: "character",
          created_at: "2026-08-10T08:30:00Z",
          id: "character-success",
          metadata: {
            description: "可信、自然的品牌体验官",
            name: "品牌体验官"
          },
          mime_type: "image/png",
          object_key: "projects/project-1/character/character-success.png",
          project_id: project.id,
          size_bytes: 2048,
          source_task_id: "task-character",
          stage: "character",
          status: "succeeded",
          type: "generated_image",
          updated_at: "2026-08-10T08:30:00Z",
          url: "https://assets.example.com/character-success.png"
        },
        {
          category: "character",
          created_at: "2026-08-10T08:31:00Z",
          id: "character-failed",
          metadata: { name: "失败角色" },
          mime_type: "image/png",
          object_key: null,
          project_id: project.id,
          size_bytes: null,
          source_task_id: "task-character",
          stage: "character",
          status: "failed",
          type: "generated_image",
          updated_at: "2026-08-10T08:31:00Z",
          url: null
        }
      ],
      character_cards: [
        characterCardFixture({
          asset_id: "character-success",
          status: "succeeded",
          updated_at: "2026-08-10T08:35:00Z"
        })
      ],
      current_stage: "character",
      status: "succeeded",
      text_artifacts: [
        {
          content: "旧故事内容",
          created_at: "2026-08-09T10:00:00Z",
          id: "story-v1",
          project_id: project.id,
          stage: "story",
          status: "succeeded",
          title: "旧故事",
          updated_at: "2026-08-09T10:00:00Z",
          version: 1
        },
        {
          content: "已过期故事内容",
          created_at: "2026-08-09T11:00:00Z",
          id: "story-stale",
          project_id: project.id,
          stage: "story",
          status: "stale",
          title: "已过期故事",
          updated_at: "2026-08-09T11:00:00Z",
          version: 3
        },
        {
          content: "最新有效故事内容",
          created_at: "2026-08-10T08:00:00Z",
          id: "story-v2",
          project_id: project.id,
          stage: "story",
          status: "succeeded",
          title: "最新广告故事",
          updated_at: "2026-08-10T08:00:00Z",
          version: 2
        },
        {
          content: "旧剧本内容",
          created_at: "2026-08-10T08:10:00Z",
          id: "script-v1",
          project_id: project.id,
          stage: "script",
          status: "succeeded",
          title: "旧剧本",
          updated_at: "2026-08-10T08:10:00Z",
          version: 1
        },
        {
          content: "失败剧本内部错误内容",
          created_at: "2026-08-10T08:20:00Z",
          id: "script-failed",
          project_id: project.id,
          stage: "script",
          status: "failed",
          title: "失败剧本",
          updated_at: "2026-08-10T08:20:00Z",
          version: 3
        },
        {
          content: "场次一：通勤路上，主角拿出便携咖啡机。\n旁白：好咖啡随身出发。",
          created_at: "2026-08-10T08:15:00Z",
          id: "script-v2",
          project_id: project.id,
          stage: "script",
          status: "succeeded",
          title: "最新广告剧本",
          updated_at: "2026-08-10T08:15:00Z",
          version: 2
        },
        {
          content: "旧分镜正文",
          created_at: "2026-08-10T08:30:00Z",
          id: "storyboard-v1",
          project_id: project.id,
          stage: "storyboard",
          status: "succeeded",
          title: "旧分镜脚本",
          updated_at: "2026-08-10T08:30:00Z",
          version: 1
        },
        {
          content:
            "镜头 1：通勤电梯里，主角从包中取出便携咖啡机。\n镜头 2：办公室窗边，咖啡香气带出产品特写。",
          created_at: "2026-08-10T08:40:00Z",
          id: "storyboard-v2",
          project_id: project.id,
          stage: "storyboard",
          status: "succeeded",
          title: "最新分镜脚本",
          updated_at: "2026-08-10T08:40:00Z",
          version: 2
        }
      ],
      storyboard: [
        {
          created_at: "2026-08-10T08:40:00Z",
          description: "办公室窗边逆光，咖啡香气上升，产品置于画面中心。",
          duration_seconds: 18,
          id: "shot-2",
          first_frame_asset_id: null,
          first_frame_source_video_asset_id: null,
          image_asset_id: null,
          index: 2,
          is_merged: false,
          merge_source_count: 0,
          narration: "把好咖啡带到每一个工作日。",
          project_id: project.id,
          status: "succeeded",
          title: "办公室产品特写",
          updated_at: "2026-08-10T08:40:00Z",
          video_asset_id: null,
          video_prompt: null,
          reference_image_asset_ids: [],
          reference_video_asset_ids: [],
          reference_audio_asset_ids: [],
          visual_prompt: "真实生活流，办公室晨光，便携咖啡机产品特写"
        },
        {
          created_at: "2026-08-10T08:40:00Z",
          description: "通勤电梯内，主角从包中取出便携咖啡机。",
          duration_seconds: 12,
          id: "shot-1",
          first_frame_asset_id: null,
          first_frame_source_video_asset_id: null,
          image_asset_id: null,
          index: 1,
          is_merged: false,
          merge_source_count: 0,
          narration: "好咖啡，随身出发。",
          project_id: project.id,
          status: "succeeded",
          title: "通勤开场",
          updated_at: "2026-08-10T08:40:00Z",
          video_asset_id: null,
          video_prompt: null,
          reference_image_asset_ids: [],
          reference_video_asset_ids: [],
          reference_audio_asset_ids: [],
          visual_prompt: "真实摄影，通勤电梯，白领取出便携咖啡机"
        }
      ]
    };
    apiMocks.getProject.mockResolvedValue(enrichedProject);
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );

    const briefTab = await screen.findByRole("tab", { name: "Brief" });
    expect(briefTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText(project.brief.prompt).length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue(project.brief.prompt)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "故事" }));
    expect(
      screen.getByRole("heading", { name: "最新广告故事" })
    ).toBeInTheDocument();
    expect(screen.getByText("最新有效故事内容")).toBeInTheDocument();
    expect(screen.getByText("版本 2")).toBeInTheDocument();
    expect(screen.queryByText("已过期故事内容")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "剧本" }));
    expect(
      screen.getByRole("heading", { name: "最新广告剧本" })
    ).toBeInTheDocument();
    expect(screen.getByText(/场次一：通勤路上/)).toBeInTheDocument();
    expect(screen.getByText(/旁白：好咖啡随身出发/)).toBeInTheDocument();
    expect(screen.getByText("版本 2")).toBeInTheDocument();
    expect(screen.queryByText("失败剧本内部错误内容")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "分镜脚本" }));
    expect(
      screen.getByRole("heading", { name: "最新分镜脚本" })
    ).toBeInTheDocument();
    expect(screen.getByText(/镜头 1：通勤电梯里/)).toBeInTheDocument();
    expect(screen.getByText(/镜头 2：办公室窗边/)).toBeInTheDocument();
    expect(screen.getByText("版本 2")).toBeInTheDocument();
    expect(screen.getAllByText("2 个镜头").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Shot 01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("通勤开场").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12 秒").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("通勤电梯内，主角从包中取出便携咖啡机。").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("好咖啡，随身出发。")).toBeInTheDocument();
    expect(screen.getByText("真实摄影，通勤电梯，白领取出便携咖啡机")).toBeInTheDocument();
    expect(screen.getAllByText("Shot 02").length).toBeGreaterThan(0);
    expect(screen.getAllByText("办公室产品特写").length).toBeGreaterThan(0);
    expect(screen.queryByText("旧分镜正文")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "角色" }));
    expect(
      screen.getByRole("heading", { name: "品牌体验官" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("可信、自然的品牌体验官").length).toBeGreaterThan(0);
    expect(screen.queryByText("失败角色")).not.toBeInTheDocument();
    const image = screen.getByRole("img", { name: "品牌体验官角色设定" });
    expect(image).toHaveAttribute(
      "src",
      "https://assets.example.com/character-success.png"
    );

    fireEvent.error(image);
    expect(
      screen.getByRole("heading", { name: "品牌体验官" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("图片暂时无法预览")
    ).toBeInTheDocument();
  });

  it("keeps character cards visible with placeholders when images cannot be displayed", async () => {
    const loadedProject: Project = {
      ...project,
      assets: [
        assetFixture({
          category: "character",
          id: "character-without-url-1",
          metadata: {
            description: "目标用户",
            name: "目标用户"
          },
          stage: "character",
          status: "succeeded",
          type: "generated_image",
          url: null
        }),
        assetFixture({
          category: "character",
          id: "character-without-url-2",
          metadata: {
            description: "品牌体验官",
            name: "品牌体验官"
          },
          stage: "character",
          status: "succeeded",
          type: "generated_image",
          url: null
        })
      ],
      character_cards: [
        characterCardFixture({
          asset_id: "character-without-url-1",
          description: "目标用户",
          id: "character-card-target",
          name: "目标用户",
          sort_order: 0
        }),
        characterCardFixture({
          asset_id: "character-without-url-2",
          description: "品牌体验官",
          id: "character-card-guide",
          name: "品牌体验官",
          sort_order: 1
        })
      ],
      current_stage: "character",
      status: "succeeded"
    };
    apiMocks.getProject.mockResolvedValue(loadedProject);

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "角色" }));

    expect(screen.queryByRole("heading", { name: "尚未生成角色" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "目标用户" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "品牌体验官" })).toBeInTheDocument();
    expect(screen.getAllByText("图片暂时无法预览")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "形象生成" })).toHaveLength(2);
  });

  it("edits story text, closes without saving, and refreshes after save", async () => {
    const loadedProject: Project = {
      ...project,
      text_artifacts: [
        {
          content: "原始故事正文",
          created_at: "2026-08-10T08:00:00Z",
          id: "story-v1",
          project_id: project.id,
          stage: "story",
          status: "succeeded",
          title: "广告故事",
          updated_at: "2026-08-10T08:00:00Z",
          version: 1
        }
      ]
    };
    const updatedProject: Project = {
      ...loadedProject,
      text_artifacts: [
        {
          ...loadedProject.text_artifacts[0],
          content: "编辑后的故事正文",
          updated_at: "2026-08-10T08:10:00Z",
          version: 2
        }
      ],
      updated_at: "2026-08-10T08:10:00Z"
    };
    apiMocks.getProject.mockResolvedValue(loadedProject);
    apiMocks.updateTextArtifact.mockResolvedValue(updatedProject);

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "故事" }));

    fireEvent.click(screen.getByRole("button", { name: "编辑故事" }));
    const storyInput = screen.getByLabelText("编辑故事");
    fireEvent.change(storyInput, { target: { value: "临时故事草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "关闭编辑" }));
    expect(apiMocks.updateTextArtifact).not.toHaveBeenCalled();
    expect(screen.getByText("原始故事正文")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑故事" }));
    fireEvent.change(screen.getByLabelText("编辑故事"), {
      target: { value: "   " }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存故事" }));
    expect(screen.getByText("请输入故事正文。")).toBeInTheDocument();
    expect(apiMocks.updateTextArtifact).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("编辑故事"), {
      target: { value: "编辑后的故事正文" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存故事" }));

    await waitFor(() => {
      expect(apiMocks.updateTextArtifact).toHaveBeenCalledWith(
        "project-1",
        "story",
        {
          content: "编辑后的故事正文"
        }
      );
    });
    expect(screen.getByText("编辑后的故事正文")).toBeInTheDocument();
    expect(screen.queryByLabelText("编辑故事")).not.toBeInTheDocument();
  });

  it("keeps script edits visible and safe when saving fails", async () => {
    const loadedProject: Project = {
      ...project,
      text_artifacts: [
        {
          content: "原始剧本正文",
          created_at: "2026-08-10T08:00:00Z",
          id: "script-v1",
          project_id: project.id,
          stage: "script",
          status: "succeeded",
          title: "广告剧本",
          updated_at: "2026-08-10T08:00:00Z",
          version: 1
        }
      ]
    };
    apiMocks.getProject.mockResolvedValue(loadedProject);
    apiMocks.updateTextArtifact.mockRejectedValue(
      new Error("Traceback: private backend path")
    );

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "剧本" }));

    fireEvent.click(screen.getByRole("button", { name: "编辑剧本" }));
    const scriptInput = screen.getByLabelText("编辑剧本");
    fireEvent.change(scriptInput, { target: { value: "未保存的剧本草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存剧本" }));

    await waitFor(() => {
      expect(apiMocks.updateTextArtifact).toHaveBeenCalledWith(
        "project-1",
        "script",
        {
          content: "未保存的剧本草稿"
        }
      );
    });
    expect(
      await screen.findByText("请求未完成，请检查网络连接后重试。")
    ).toBeInTheDocument();
    expect(scriptInput).toHaveValue("未保存的剧本草稿");
    expect(screen.queryByText(/Traceback/)).not.toBeInTheDocument();
  });

  it("edits storyboard text while keeping the structured shot list visible", async () => {
    const loadedProject: Project = {
      ...project,
      storyboard: [
        {
          created_at: "2026-08-10T08:40:00Z",
          description: "通勤电梯内，主角从包中取出便携咖啡机。",
          duration_seconds: 12,
          id: "shot-1",
          first_frame_asset_id: null,
          first_frame_source_video_asset_id: null,
          image_asset_id: null,
          index: 1,
          is_merged: false,
          merge_source_count: 0,
          narration: "好咖啡，随身出发。",
          project_id: project.id,
          status: "succeeded",
          title: "通勤开场",
          updated_at: "2026-08-10T08:40:00Z",
          video_asset_id: null,
          video_prompt: null,
          reference_image_asset_ids: [],
          reference_video_asset_ids: [],
          reference_audio_asset_ids: [],
          visual_prompt: "真实摄影，通勤电梯，白领取出便携咖啡机"
        }
      ],
      text_artifacts: [
        {
          content: "原始分镜脚本正文",
          created_at: "2026-08-10T08:40:00Z",
          id: "storyboard-v1",
          project_id: project.id,
          stage: "storyboard",
          status: "succeeded",
          title: "分镜脚本",
          updated_at: "2026-08-10T08:40:00Z",
          version: 1
        }
      ]
    };
    const updatedProject: Project = {
      ...loadedProject,
      text_artifacts: [
        {
          ...loadedProject.text_artifacts[0],
          content: "编辑后的分镜脚本正文",
          updated_at: "2026-08-10T08:50:00Z",
          version: 2
        }
      ],
      updated_at: "2026-08-10T08:50:00Z"
    };
    apiMocks.getProject.mockResolvedValue(loadedProject);
    apiMocks.updateTextArtifact.mockResolvedValue(updatedProject);

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "分镜脚本" }));

    fireEvent.click(screen.getByRole("button", { name: "编辑分镜脚本" }));
    fireEvent.change(screen.getByLabelText("编辑分镜脚本"), {
      target: { value: "编辑后的分镜脚本正文" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存分镜脚本" }));

    await waitFor(() => {
      expect(apiMocks.updateTextArtifact).toHaveBeenCalledWith(
        "project-1",
        "storyboard",
        {
          content: "编辑后的分镜脚本正文"
        }
      );
    });
    expect(screen.getByText("编辑后的分镜脚本正文")).toBeInTheDocument();
    expect(screen.getByText("版本 2")).toBeInTheDocument();
    expect(screen.getByText("结构化分镜镜头")).toBeInTheDocument();
    expect(screen.getAllByText("通勤开场").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("编辑分镜脚本")).not.toBeInTheDocument();
  });

  it("saves double-click character card edits and refreshes the project", async () => {
    const sourceAsset = {
      category: "character" as const,
      created_at: "2026-08-10T08:30:00Z",
      id: "character-source",
      metadata: {
        character_key: "brand-guide",
        current_prompt: "真实摄影风格的品牌体验官，白色通勤外套",
        description: "可信、自然的品牌体验官",
        name: "品牌体验官"
      },
      mime_type: "image/png",
      object_key: "projects/project-1/character/source.png",
      project_id: project.id,
      size_bytes: 2048,
      source_task_id: "task-character",
      stage: "character" as const,
      status: "succeeded" as const,
      type: "generated_image" as const,
      updated_at: "2026-08-10T08:30:00Z",
      url: "https://assets.example.com/source.png"
    };
    const sourceCard = characterCardFixture({
      asset_id: sourceAsset.id,
      id: "character-card-guide"
    });
    const loadedProject: Project = {
      ...project,
      assets: [sourceAsset],
      character_cards: [sourceCard],
      current_stage: "character",
      status: "succeeded"
    };
    const renamedProject: Project = {
      ...loadedProject,
      character_cards: [
        {
          ...sourceCard,
          name: "通勤品牌体验官",
          updated_at: "2026-08-10T08:35:00Z"
        }
      ]
    };
    const renamedCard = renamedProject.character_cards?.[0] ?? sourceCard;
    const describedProject: Project = {
      ...renamedProject,
      character_cards: [
        {
          ...renamedCard,
          description: "浅蓝色外套，表情更自然",
          updated_at: "2026-08-10T08:36:00Z"
        }
      ]
    };
    apiMocks.getProject
      .mockResolvedValueOnce(loadedProject)
      .mockResolvedValueOnce(renamedProject)
      .mockResolvedValueOnce(describedProject);
    apiMocks.updateCharacterCard.mockResolvedValue(sourceCard);

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "角色" }));

    fireEvent.doubleClick(screen.getByRole("heading", { name: "品牌体验官" }));
    fireEvent.change(screen.getByLabelText("角色名称"), {
      target: { value: "通勤品牌体验官" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(apiMocks.updateCharacterCard).toHaveBeenCalledWith(
        "project-1",
        "character-card-guide",
        { name: "通勤品牌体验官" }
      );
      expect(apiMocks.getProject).toHaveBeenLastCalledWith("project-1", {
        cache: "no-store"
      });
    });

    expect(
      await screen.findByRole("heading", { name: "通勤品牌体验官" })
    ).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText("可信、自然的品牌体验官"));
    fireEvent.change(screen.getByLabelText("角色描述"), {
      target: { value: "浅蓝色外套，表情更自然" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(apiMocks.updateCharacterCard).toHaveBeenLastCalledWith(
        "project-1",
        "character-card-guide",
        { description: "浅蓝色外套，表情更自然" }
      );
    });
    expect(
      await screen.findByText("浅蓝色外套，表情更自然")
    ).toBeInTheDocument();
  });

  it("cancels character card edit mode before submitting", async () => {
    const sourceAsset = {
      category: "character" as const,
      created_at: "2026-08-10T08:30:00Z",
      id: "character-source",
      metadata: {
        description: "可信、自然的品牌体验官",
        name: "品牌体验官"
      },
      mime_type: "image/png",
      object_key: "projects/project-1/character/source.png",
      project_id: project.id,
      size_bytes: 2048,
      source_task_id: "task-character",
      stage: "character" as const,
      status: "succeeded" as const,
      type: "generated_image" as const,
      updated_at: "2026-08-10T08:30:00Z",
      url: "https://assets.example.com/source.png"
    };
    apiMocks.getProject.mockResolvedValue({
      ...project,
      assets: [sourceAsset],
      character_cards: [
        characterCardFixture({
          asset_id: sourceAsset.id,
          id: "character-card-guide"
        })
      ],
      current_stage: "character",
      status: "succeeded"
    });

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "角色" }));
    fireEvent.doubleClick(screen.getByRole("heading", { name: "品牌体验官" }));
    expect(screen.getByLabelText("角色名称")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(apiMocks.updateCharacterCard).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("角色名称")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "品牌体验官角色设定" })
    ).toBeInTheDocument();
  });

  it("deletes a character card and refreshes from the project response", async () => {
    const characterCard = characterCardFixture({
      id: "character-card-guide"
    });
    const loadedProject: Project = {
      ...project,
      character_cards: [characterCard],
      current_stage: "character",
      status: "succeeded"
    };
    const updatedProject: Project = {
      ...loadedProject,
      character_cards: [],
      updated_at: "2026-08-10T08:45:00Z"
    };
    apiMocks.getProject.mockResolvedValue(loadedProject);
    apiMocks.deleteCharacterCard.mockResolvedValue(updatedProject);

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "角色" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(apiMocks.deleteCharacterCard).toHaveBeenCalledWith(
        "project-1",
        "character-card-guide"
      );
    });
    expect(
      await screen.findByRole("heading", { name: "尚未生成角色" })
    ).toBeInTheDocument();
  });

  it("generates and regenerates character card images then refreshes project details", async () => {
    const existingAsset = assetFixture({
      category: "character",
      id: "character-existing-image",
      metadata: {
        description: "可信、自然的品牌体验官",
        name: "品牌体验官"
      },
      object_key: "projects/project-1/character/existing.png",
      stage: "character",
      status: "succeeded",
      type: "generated_image",
      url: "https://assets.example.com/existing.png"
    });
    const generatedAsset = assetFixture({
      category: "character",
      id: "character-target-image",
      metadata: {
        description: "目标用户角色",
        name: "目标用户"
      },
      object_key: "projects/project-1/character/target.png",
      stage: "character",
      status: "succeeded",
      type: "generated_image",
      url: "https://assets.example.com/target.png"
    });
    const regeneratedAsset = assetFixture({
      category: "character",
      id: "character-guide-regenerated",
      metadata: {
        description: "可信、自然的品牌体验官",
        name: "品牌体验官"
      },
      object_key: "projects/project-1/character/regenerated.png",
      stage: "character",
      status: "succeeded",
      type: "generated_image",
      url: "https://assets.example.com/regenerated.png"
    });
    const targetCard = characterCardFixture({
      asset_id: null,
      description: "目标用户角色",
      id: "character-card-target",
      name: "目标用户",
      sort_order: 0
    });
    const guideCard = characterCardFixture({
      asset_id: existingAsset.id,
      id: "character-card-guide",
      sort_order: 1,
      status: "succeeded"
    });
    const loadedProject: Project = {
      ...project,
      assets: [existingAsset],
      character_cards: [targetCard, guideCard],
      current_stage: "character",
      status: "succeeded"
    };
    const generatedProject: Project = {
      ...loadedProject,
      assets: [existingAsset, generatedAsset],
      character_cards: [
        {
          ...targetCard,
          asset_id: generatedAsset.id,
          status: "succeeded",
          updated_at: "2026-08-10T08:40:00Z"
        },
        guideCard
      ]
    };
    const regeneratedProject: Project = {
      ...generatedProject,
      assets: [generatedAsset, regeneratedAsset],
      character_cards: [
        generatedProject.character_cards?.[0] ?? targetCard,
        {
          ...guideCard,
          asset_id: regeneratedAsset.id,
          updated_at: "2026-08-10T08:45:00Z"
        }
      ]
    };
    apiMocks.getProject
      .mockResolvedValueOnce(loadedProject)
      .mockResolvedValueOnce(generatedProject)
      .mockResolvedValueOnce(regeneratedProject);
    apiMocks.generateCharacterCardImage.mockResolvedValue({
      asset: generatedAsset,
      character_card: generatedProject.character_cards?.[0] ?? targetCard,
      task: taskFixture({
        output_asset_ids: [generatedAsset.id],
        stage: "character",
        status: "succeeded"
      })
    });

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "角色" }));

    fireEvent.click(screen.getByRole("button", { name: "形象生成" }));

    await waitFor(() => {
      expect(apiMocks.generateCharacterCardImage).toHaveBeenCalledWith(
        "project-1",
        "character-card-target"
      );
      expect(apiMocks.getProject).toHaveBeenLastCalledWith("project-1", {
        cache: "no-store"
      });
    });
    expect(
      await screen.findByRole("img", { name: "目标用户角色设定" })
    ).toHaveAttribute("src", "https://assets.example.com/target.png");
    expect(screen.getAllByRole("button", { name: "重新生成" })).toHaveLength(2);

    const guideArticle = screen
      .getByRole("heading", { name: "品牌体验官" })
      .closest("article");
    expect(guideArticle).not.toBeNull();
    fireEvent.click(
      within(guideArticle as HTMLElement).getByRole("button", {
        name: "重新生成"
      })
    );

    await waitFor(() => {
      expect(apiMocks.generateCharacterCardImage).toHaveBeenLastCalledWith(
        "project-1",
        "character-card-guide"
      );
    });
    expect(
      await screen.findByRole("img", { name: "品牌体验官角色设定" })
    ).toHaveAttribute("src", "https://assets.example.com/regenerated.png");
  });

  it("starts character card image generation independently per card", async () => {
    const targetCard = characterCardFixture({
      description: "目标用户角色",
      id: "character-card-target",
      name: "目标用户",
      sort_order: 0
    });
    const guideCard = characterCardFixture({
      id: "character-card-guide",
      sort_order: 1
    });
    const loadedProject: Project = {
      ...project,
      character_cards: [targetCard, guideCard],
      current_stage: "character",
      status: "succeeded"
    };
    const generationResolvers: Record<
      string,
      ((value: CharacterCardImageGenerationResponse) => void) | undefined
    > = {};

    apiMocks.getProject.mockResolvedValue(loadedProject);
    apiMocks.generateCharacterCardImage.mockImplementation(
      (_projectId: string, cardId: string) =>
        new Promise<CharacterCardImageGenerationResponse>((resolve) => {
          generationResolvers[cardId] = resolve;
        })
    );

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "角色" }));

    const targetArticle = screen
      .getByRole("heading", { name: "目标用户" })
      .closest("article");
    const guideArticle = screen
      .getByRole("heading", { name: "品牌体验官" })
      .closest("article");
    expect(targetArticle).not.toBeNull();
    expect(guideArticle).not.toBeNull();

    fireEvent.click(
      within(targetArticle as HTMLElement).getByRole("button", {
        name: "形象生成"
      })
    );
    fireEvent.click(
      within(guideArticle as HTMLElement).getByRole("button", {
        name: "形象生成"
      })
    );

    await waitFor(() => {
      expect(apiMocks.generateCharacterCardImage).toHaveBeenCalledWith(
        "project-1",
        "character-card-target"
      );
      expect(apiMocks.generateCharacterCardImage).toHaveBeenCalledWith(
        "project-1",
        "character-card-guide"
      );
    });
    expect(
      within(targetArticle as HTMLElement).getByRole("button", {
        name: "形象生成"
      })
    ).toBeDisabled();
    expect(
      within(guideArticle as HTMLElement).getByRole("button", {
        name: "形象生成"
      })
    ).toBeDisabled();

    expect(generationResolvers[targetCard.id]).toBeDefined();
    expect(generationResolvers[guideCard.id]).toBeDefined();
    await act(async () => {
      generationResolvers[targetCard.id]!({
        asset: assetFixture({ id: "character-card-target-asset" }),
        character_card: targetCard,
        task: taskFixture({ stage: "character", status: "succeeded" })
      });
      generationResolvers[guideCard.id]!({
        asset: assetFixture({ id: "character-card-guide-asset" }),
        character_card: guideCard,
        task: taskFixture({ stage: "character", status: "succeeded" })
      });
    });
  });

  it("manages the storyboard video workspace from shot config to preview and retry", async () => {
    const shotOne = storyboardShotFixture({
      id: "shot-1",
      index: 1,
      title: "通勤开场"
    });
    const shotTwo = storyboardShotFixture({
      description: "办公室窗边逆光，咖啡香气上升，产品置于画面中心。",
      duration_seconds: 18,
      id: "shot-2",
      index: 2,
      narration: "把好咖啡带到每一个工作日。",
      title: "办公室产品特写",
      video_asset_id: "video-shot-2",
      visual_prompt: "真实生活流，办公室晨光，便携咖啡机产品特写"
    });
    const libraryImage = assetFixture({
      id: "library-image",
      metadata: { name: "资产库参考图" },
      mime_type: "image/png",
      type: "uploaded_image",
      url: "https://assets.example.com/library-image.png"
    });
    const libraryVideo = assetFixture({
      id: "library-video",
      metadata: { name: "资产库参考视频" },
      mime_type: "video/mp4",
      type: "uploaded_video",
      url: "https://assets.example.com/library-video.mp4"
    });
    const libraryAudio = assetFixture({
      id: "library-audio",
      metadata: { name: "资产库参考音频" },
      mime_type: "audio/mpeg",
      type: "uploaded_audio",
      url: "https://assets.example.com/library-audio.mp3"
    });
    const shotTwoVideo = assetFixture({
      category: null,
      id: "video-shot-2",
      metadata: {
        last_frame_url: "/api/assets/video-shot-2/last-frame",
        name: "办公室产品特写视频"
      },
      mime_type: "video/mp4",
      stage: "video",
      type: "storyboard_video",
      url: "https://assets.example.com/shot-2.mp4"
    });
    const uploadedImage = assetFixture({
      id: "uploaded-image",
      metadata: { name: "本地参考图.png" },
      mime_type: "image/png",
      type: "uploaded_image",
      url: "https://assets.example.com/uploaded-image.png"
    });
    const loadedProject: Project = {
      ...project,
      assets: [libraryImage, libraryVideo, libraryAudio, shotTwoVideo],
      current_stage: "storyboard",
      status: "succeeded",
      storyboard: [shotTwo, shotOne],
      text_artifacts: [
        {
          content: "镜头 1：通勤开场\n镜头 2：办公室产品特写",
          created_at: "2026-08-10T08:40:00Z",
          id: "storyboard-v1",
          project_id: project.id,
          stage: "storyboard",
          status: "succeeded",
          title: "分镜脚本",
          updated_at: "2026-08-10T08:40:00Z",
          version: 1
        }
      ],
      updated_at: "2026-08-10T08:40:00Z"
    };
    const promptConfig = storyboardVideoConfigFixture({
      ...shotOne,
      video_prompt: "新的通勤开场视频提示词"
    });
    const uploadedImageConfig: StoryboardShotVideoConfig = {
      ...promptConfig,
      reference_image_asset_ids: ["uploaded-image"]
    };
    const attachedVideoConfig: StoryboardShotVideoConfig = {
      ...uploadedImageConfig,
      reference_video_asset_ids: ["library-video"]
    };
    const attachedAudioConfig: StoryboardShotVideoConfig = {
      ...attachedVideoConfig,
      reference_audio_asset_ids: ["library-audio"]
    };
    const removedVideoConfig: StoryboardShotVideoConfig = {
      ...attachedAudioConfig,
      reference_video_asset_ids: []
    };
    const failedTask = taskFixture({
      error: {
        code: "generation_failed",
        detail:
          "provider_code=RateLimitExceeded; request_id=request-safe-456; phase=poll",
        message: "provider credential failed"
      },
      id: "task-shot-video-failed",
      stage: "video",
      status: "failed"
    });
    const retryTask = taskFixture({
      id: "task-shot-video-retry",
      stage: "video",
      status: "queued"
    });

    apiMocks.getProject
      .mockResolvedValueOnce(loadedProject)
      .mockResolvedValue({
        ...loadedProject,
        assets: [uploadedImage, ...loadedProject.assets],
        storyboard: [
          shotTwo,
          {
            ...shotOne,
            reference_image_asset_ids: ["uploaded-image"]
          }
        ]
      });
    apiMocks.getStoryboardShotVideoConfig.mockImplementation(
      async (_projectId: string, shotId: string) =>
        storyboardVideoConfigFixture(shotId === "shot-2" ? shotTwo : shotOne)
    );
    apiMocks.updateStoryboardShotVideoConfig.mockResolvedValue(promptConfig);
    apiMocks.uploadStoryboardShotReference.mockResolvedValue({
      asset_id: "uploaded-image",
      config: uploadedImageConfig
    });
    apiMocks.attachStoryboardShotReference
      .mockResolvedValueOnce(attachedVideoConfig)
      .mockResolvedValueOnce(attachedAudioConfig);
    apiMocks.removeStoryboardShotReference.mockResolvedValue(removedVideoConfig);
    apiMocks.generateStoryboardShotVideo
      .mockResolvedValueOnce(failedTask)
      .mockResolvedValueOnce(retryTask);

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );

    expect(
      await screen.findByRole("heading", { name: "分镜视频工作台" })
    ).toBeInTheDocument();
    expect(screen.getByText("Shot 01")).toBeInTheDocument();
    expect(screen.getByText("Shot 02")).toBeInTheDocument();
    expect(screen.getByText("尚未生成当前分镜视频")).toBeInTheDocument();

    const shotOnePreviewButton = screen.getByRole("button", {
      name: /预览分镜 Shot 01.*通勤开场/
    });
    fireEvent.click(shotOnePreviewButton);
    expect(
      screen.queryByRole("dialog", { name: "通勤开场" })
    ).not.toBeInTheDocument();
    fireEvent.doubleClick(shotOnePreviewButton);
    const editorDialog = await screen.findByRole("dialog", {
      name: "通勤开场"
    });
    fireEvent.change(within(editorDialog).getByLabelText("编辑视频生成提示词"), {
      target: { value: "新的通勤开场视频提示词" }
    });
    fireEvent.click(
      within(editorDialog).getByRole("button", { name: "保存提示词" })
    );

    await waitFor(() => {
      expect(apiMocks.updateStoryboardShotVideoConfig).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        { video_prompt: "新的通勤开场视频提示词" }
      );
    });

    const imageFile = new File(["image-bytes"], "本地参考图.png", {
      type: "image/png"
    });
    fireEvent.change(within(editorDialog).getByLabelText("上传本地参考图"), {
      target: { files: [imageFile] }
    });

    await waitFor(() => {
      expect(apiMocks.uploadStoryboardShotReference).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        "image",
        imageFile,
        {
          filename: "本地参考图.png",
          mimeType: "image/png"
        }
      );
    });
    expect(
      (await within(editorDialog).findAllByText("本地参考图.png")).length
    ).toBeGreaterThan(0);

    fireEvent.click(
      within(editorDialog).getByText("从资产库选择参考视频")
    );
    fireEvent.click(
      within(editorDialog).getByRole("button", {
        name: "选择资产 资产库参考视频"
      })
    );
    await waitFor(() => {
      expect(apiMocks.attachStoryboardShotReference).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        { asset_id: "library-video", kind: "video" }
      );
    });
    expect(within(editorDialog).getByText("资产库参考视频")).toBeInTheDocument();

    fireEvent.click(
      within(editorDialog).getByText("从资产库选择参考音频")
    );
    fireEvent.click(
      within(editorDialog).getByRole("button", {
        name: "选择资产 资产库参考音频"
      })
    );
    await waitFor(() => {
      expect(apiMocks.attachStoryboardShotReference).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        { asset_id: "library-audio", kind: "audio" }
      );
    });

    fireEvent.click(
      within(editorDialog).getByRole("button", {
        name: "移除参考素材 资产库参考视频"
      })
    );
    await waitFor(() => {
      expect(apiMocks.removeStoryboardShotReference).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        { asset_id: "library-video", kind: "video" }
      );
    });

    fireEvent.click(
      within(editorDialog).getByRole("button", {
        name: "关闭分镜编辑弹窗"
      })
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "通勤开场" })
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /预览分镜 Shot 02.*办公室产品特写/
      })
    );
    await waitFor(() => {
      expect(document.querySelector("video")).toHaveAttribute(
        "src",
        "https://assets.example.com/shot-2.mp4"
      );
    });
    expect(screen.getAllByText("办公室产品特写视频").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("dialog", { name: "办公室产品特写" })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "编辑分镜：办公室产品特写" })
    );
    const shotTwoDialog = await screen.findByRole("dialog", {
      name: "办公室产品特写"
    });
    fireEvent.click(
      within(shotTwoDialog).getByRole("button", {
        name: "关闭分镜编辑弹窗"
      })
    );
    expect(screen.getByTestId("storyboard-video-frame")).toHaveStyle({
      aspectRatio: "9 / 16"
    });
    expect(
      screen.getByLabelText("当前分镜视频预览")
    ).toBeInTheDocument();
    const carousel = screen.getByTestId("storyboard-media-carousel");
    fireEvent(
      carousel,
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientX: 20,
        clientY: 20
      })
    );
    fireEvent(
      carousel,
      new MouseEvent("pointerup", {
        bubbles: true,
        clientX: 80,
        clientY: 22
      })
    );
    expect(
      screen.getByRole("img", { name: "当前分镜视频尾帧" })
    ).toHaveAttribute(
      "src",
      "http://backend.local/api/assets/video-shot-2/last-frame"
    );
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(
      screen.getByLabelText("当前分镜视频预览")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "放大查看当前分镜视频" })
    );
    const videoPreviewDialog = await screen.findByRole("dialog", {
      name: "办公室产品特写"
    });
    expect(
      within(videoPreviewDialog).getByLabelText("当前分镜视频完整预览")
    ).toHaveAttribute("src", "https://assets.example.com/shot-2.mp4");
    fireEvent.click(
      within(videoPreviewDialog).getByRole("button", { name: "查看尾帧" })
    );
    expect(
      within(videoPreviewDialog).getByRole("img", {
        name: "当前分镜视频尾帧"
      })
    ).toBeInTheDocument();
    fireEvent.click(
      within(videoPreviewDialog).getByRole("button", { name: "关闭" })
    );
    await waitFor(() => {
      expect(
        screen.queryByLabelText("当前分镜视频完整预览")
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "编辑分镜：通勤开场" })
    );
    const reopenedDialog = await screen.findByRole("dialog", {
      name: "通勤开场"
    });
    fireEvent.click(
      within(reopenedDialog).getByRole("button", {
        name: "关闭分镜编辑弹窗"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "生成当前分镜视频" }));
    await waitFor(() => {
      expect(apiMocks.generateStoryboardShotVideo).toHaveBeenCalledWith(
        "project-1",
        "shot-1"
      );
    });
    expect(
      screen.getByText(
        "当前分镜视频生成失败。方舟错误码：RateLimitExceeded · Request ID：request-safe-456"
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Traceback|credential|secret/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试当前分镜" }));
    await waitFor(() => {
      expect(apiMocks.generateStoryboardShotVideo).toHaveBeenCalledTimes(2);
    });
  });

  it("restores a running storyboard video task when returning to the workspace", async () => {
    const shot = storyboardShotFixture({
      id: "shot-1",
      index: 1,
      title: "通勤开场"
    });
    const runningTask = taskFixture({
      frozen_input: {
        kind: "storyboard_shot_video_generation",
        shot_id: shot.id
      },
      id: "task-shot-video-running",
      progress: 0.35,
      progress_message: "视频生成中",
      stage: "video",
      status: "running"
    });
    const freshProject: Project = {
      ...project,
      current_stage: "video",
      storyboard: [shot],
      tasks: [runningTask]
    };
    apiMocks.getProject.mockResolvedValue(freshProject);
    apiMocks.getTask.mockResolvedValue(runningTask);

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...project, storyboard: [shot], tasks: [] }}
      />
    );

    expect(
      await screen.findByText("正在生成当前分镜视频")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成中" })).toBeDisabled();
    await waitFor(() => {
      expect(apiMocks.getTask).toHaveBeenCalledWith("task-shot-video-running");
    });
  });

  it("applies the current shot last frame to subsequent storyboard references", async () => {
    const shotOne = storyboardShotFixture({
      id: "shot-1",
      index: 1,
      title: "开场视频",
      video_asset_id: "video-shot-1"
    });
    const shotTwo = storyboardShotFixture({
      id: "shot-2",
      index: 2,
      title: "后续镜头"
    });
    const shotThree = storyboardShotFixture({
      first_frame_asset_id: "first-frame-3",
      id: "shot-3",
      index: 3,
      title: "已有首帧"
    });
    const sourceVideo = assetFixture({
      category: null,
      id: "video-shot-1",
      metadata: {
        last_frame_url: "/api/assets/video-shot-1/last-frame",
        name: "开场视频"
      },
      mime_type: "video/mp4",
      stage: "video",
      type: "storyboard_video",
      url: "https://assets.example.com/shot-1.mp4"
    });
    const referenceAsset = assetFixture({
      id: "tail-frame-reference",
      metadata: { name: "分镜 1 尾帧参考图" },
      mime_type: "image/png",
      stage: "video",
      type: "generated_image",
      url: "https://assets.example.com/tail-frame-reference.png"
    });
    const loadedProject: Project = {
      ...project,
      assets: [sourceVideo],
      current_stage: "video",
      storyboard: [shotOne, shotTwo, shotThree]
    };
    const updatedProject: Project = {
      ...loadedProject,
      assets: [sourceVideo, referenceAsset],
      storyboard: [
        shotOne,
        {
          ...shotTwo,
          reference_image_asset_ids: ["tail-frame-reference"]
        },
        shotThree
      ]
    };
    apiMocks.getProject
      .mockResolvedValueOnce(loadedProject)
      .mockResolvedValueOnce(updatedProject);
    apiMocks.applyStoryboardShotLastFrameReference.mockResolvedValue({
      applied_shot_ids: ["shot-2"],
      reference_asset_id: "tail-frame-reference",
      skipped: [
        {
          reason: "has_first_frame",
          shot_id: "shot-3",
          shot_index: 3
        }
      ],
      source_shot_id: "shot-1",
      source_video_asset_id: "video-shot-1"
    });

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={loadedProject}
      />
    );

    const applyButton = await screen.findByRole("button", {
      name: "尾帧设为后续参考图"
    });
    expect(applyButton).toBeEnabled();
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(
        apiMocks.applyStoryboardShotLastFrameReference
      ).toHaveBeenCalledWith("project-1", "shot-1");
    });
    expect(
      await screen.findByText(
        "已将当前尾帧加入 1 个后续镜头参考图。已跳过 1 个已有首帧或已关联的镜头。"
      )
    ).toBeInTheDocument();
  });

  it("edits a storyboard video as a candidate and selects it after comparison", async () => {
    const original = assetFixture({
      category: null,
      id: "video-original",
      metadata: { name: "原版视频", shot_id: "shot-1" },
      mime_type: "video/mp4",
      type: "storyboard_video",
      url: "https://assets.example.com/original.mp4"
    });
    const candidate = assetFixture({
      category: null,
      id: "video-candidate",
      metadata: {
        edit_prompt: "增强产品特写",
        operation: "video_edit",
        shot_id: "shot-1",
        source_asset_id: original.id,
        source_shot_id: "shot-1"
      },
      mime_type: "video/mp4",
      type: "storyboard_video",
      url: "https://assets.example.com/candidate.mp4"
    });
    const loadedShot = storyboardShotFixture({
      video_asset_id: original.id
    });
    const selectedShot = {
      ...loadedShot,
      video_asset_id: candidate.id
    };
    const loadedProject: Project = {
      ...project,
      assets: [original],
      current_stage: "video",
      storyboard: [loadedShot]
    };
    const candidateProject: Project = {
      ...loadedProject,
      assets: [original, candidate],
      storyboard: [loadedShot]
    };
    const selectedProject: Project = {
      ...candidateProject,
      storyboard: [selectedShot]
    };
    const editTask = taskFixture({
      id: "task-video-edit",
      output_asset_ids: [candidate.id],
      stage: "video",
      status: "succeeded"
    });
    apiMocks.editStoryboardShotVideo.mockResolvedValue(editTask);
    apiMocks.getProject
      .mockResolvedValueOnce(loadedProject)
      .mockResolvedValueOnce(candidateProject)
      .mockResolvedValue(selectedProject);
    apiMocks.selectStoryboardShotVideo.mockResolvedValue(
      storyboardVideoConfigFixture(selectedShot)
    );

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={loadedProject}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑视频" }));
    const editDialog = await screen.findByRole("dialog", {
      name: "编辑当前分镜视频"
    });
    expect(
      within(editDialog).getByTestId("storyboard-video-edit-preview-frame")
    ).toHaveStyle({
      aspectRatio: "9 / 16",
      maxWidth: "min(100%, calc(52dvh * 9 / 16))"
    });
    fireEvent.change(within(editDialog).getByLabelText("编辑指令"), {
      target: { value: "增强产品特写" }
    });
    fireEvent.click(
      within(editDialog).getByRole("button", { name: "生成编辑候选" })
    );

    await waitFor(() => {
      expect(apiMocks.editStoryboardShotVideo).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        { prompt: "增强产品特写" }
      );
    });
    const comparison = await screen.findByRole("dialog", {
      name: "视频版本对比"
    });
    expect(within(comparison).getByLabelText("原视频")).toHaveAttribute(
      "src",
      "https://assets.example.com/original.mp4"
    );
    expect(within(comparison).getByLabelText("编辑版 · 1")).toHaveAttribute(
      "src",
      "https://assets.example.com/candidate.mp4"
    );
    expect(
      within(comparison).getByRole("button", { name: "播放原视频" })
    ).toBeInTheDocument();
    expect(
      within(comparison).getByRole("button", { name: "播放编辑版 · 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("当前分镜视频预览")
    ).toHaveAttribute("src", "https://assets.example.com/original.mp4");

    fireEvent.click(
      within(comparison).getByRole("button", {
        name: "将编辑版 · 1设为当前"
      })
    );
    await waitFor(() => {
      expect(apiMocks.selectStoryboardShotVideo).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        { asset_id: candidate.id }
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "视频版本对比" })
      ).not.toBeInTheDocument();
    });
  });

  it("opens the multi-version comparison directly when the shot has edit history", async () => {
    const original = assetFixture({
      category: null,
      created_at: "2026-08-10T09:00:00Z",
      id: "video-original",
      metadata: { name: "原版视频", shot_id: "shot-1" },
      mime_type: "video/mp4",
      type: "storyboard_video",
      url: "https://assets.example.com/original.mp4"
    });
    const firstEdit = assetFixture({
      category: null,
      created_at: "2026-08-10T09:05:00Z",
      id: "video-edit-1",
      metadata: {
        edit_prompt: "增强产品特写",
        operation: "video_edit",
        shot_id: "shot-1",
        source_asset_id: original.id,
        source_shot_id: "shot-1"
      },
      mime_type: "video/mp4",
      type: "storyboard_video",
      url: "https://assets.example.com/edit-1.mp4"
    });
    const loadedShot = storyboardShotFixture({
      video_asset_id: firstEdit.id
    });
    const loadedProject: Project = {
      ...project,
      assets: [original, firstEdit],
      current_stage: "video",
      storyboard: [loadedShot]
    };
    apiMocks.getProject.mockResolvedValue(loadedProject);
    apiMocks.selectStoryboardShotVideo.mockResolvedValue(
      storyboardVideoConfigFixture({ ...loadedShot, video_asset_id: original.id })
    );

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={loadedProject}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑视频" }));

    const comparison = await screen.findByRole("dialog", {
      name: "视频版本对比"
    });
    expect(
      screen.queryByRole("dialog", { name: "编辑当前分镜视频" })
    ).not.toBeInTheDocument();
    expect(within(comparison).getByLabelText("原视频")).toHaveAttribute(
      "src",
      "https://assets.example.com/original.mp4"
    );
    expect(within(comparison).getByLabelText("编辑版 · 1")).toHaveAttribute(
      "src",
      "https://assets.example.com/edit-1.mp4"
    );
    expect(apiMocks.editStoryboardShotVideo).not.toHaveBeenCalled();

    fireEvent.click(
      within(comparison).getByRole("button", { name: "将原视频设为当前" })
    );
    await waitFor(() => {
      expect(apiMocks.selectStoryboardShotVideo).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        { asset_id: original.id }
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "视频版本对比" })
      ).not.toBeInTheDocument();
    });
  });

  it("opens the edit prompt dialog when the shot has no edit history", async () => {
    const original = assetFixture({
      category: null,
      id: "video-original",
      metadata: { name: "原版视频", shot_id: "shot-1" },
      mime_type: "video/mp4",
      type: "storyboard_video",
      url: "https://assets.example.com/original.mp4"
    });
    const loadedShot = storyboardShotFixture({
      video_asset_id: original.id
    });
    const loadedProject: Project = {
      ...project,
      assets: [original],
      current_stage: "video",
      storyboard: [loadedShot]
    };
    apiMocks.getProject.mockResolvedValue(loadedProject);

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={loadedProject}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑视频" }));

    expect(
      await screen.findByRole("dialog", { name: "编辑当前分镜视频" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "视频版本对比" })
    ).not.toBeInTheDocument();
  });

  it("replaces only the local draft after AI optimization and keeps discard confirmation", async () => {
    const savedPrompt = "已保存的原始提示词";
    const optimizedPrompt = "AI 优化后的完整提示词";
    const loadedShot = storyboardShotFixture({
      video_prompt: savedPrompt
    });
    const loadedProject: Project = {
      ...project,
      current_stage: "storyboard",
      storyboard: [loadedShot]
    };
    apiMocks.getStoryboardShotVideoConfig.mockResolvedValue(
      storyboardVideoConfigFixture(loadedShot)
    );
    apiMocks.optimizeStoryboardShotVideoPrompt.mockResolvedValue({
      optimized_prompt: optimizedPrompt
    });

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={loadedProject}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "编辑分镜：通勤开场" })
    );
    const dialog = await screen.findByRole("dialog", { name: "通勤开场" });
    const optimizeButton = within(dialog).getByRole("button", {
      name: "AI 优化视频生成提示词"
    });
    fireEvent.click(optimizeButton);

    expect(optimizeButton).toBeDisabled();
    expect(within(dialog).getByText("优化中")).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMocks.optimizeStoryboardShotVideoPrompt).toHaveBeenCalledWith(
        "project-1",
        "shot-1",
        savedPrompt,
        expect.any(Function),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });
    expect(
      await within(dialog).findByDisplayValue(optimizedPrompt)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("AI 优化完成，请确认后保存。")
    ).toBeInTheDocument();
    expect(apiMocks.updateStoryboardShotVideoConfig).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "关闭分镜编辑弹窗"
      })
    );
    expect(
      screen.getByRole("dialog", { name: "提示词尚未保存" })
    ).toBeInTheDocument();
  });

  it("shows a clear notice when AI optimization returns the same prompt", async () => {
    const savedPrompt = "已是优化版本的完整提示词";
    const loadedShot = storyboardShotFixture({
      video_prompt: savedPrompt
    });
    apiMocks.getStoryboardShotVideoConfig.mockResolvedValue(
      storyboardVideoConfigFixture(loadedShot)
    );
    apiMocks.optimizeStoryboardShotVideoPrompt.mockResolvedValue({
      optimized_prompt: savedPrompt
    });

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...project, storyboard: [loadedShot] }}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "编辑分镜：通勤开场" })
    );
    const dialog = await screen.findByRole("dialog", { name: "通勤开场" });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "AI 优化视频生成提示词"
      })
    );

    expect(
      await within(dialog).findByText("AI 已复核，当前提示词已是优化版本。")
    ).toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("编辑视频生成提示词")
    ).toHaveValue(savedPrompt);
  });

  it("keeps the current draft when AI optimization fails", async () => {
    const currentDraft = "用户尚未保存的草稿";
    const loadedShot = storyboardShotFixture({
      video_prompt: "已保存提示词"
    });
    apiMocks.getStoryboardShotVideoConfig.mockResolvedValue(
      storyboardVideoConfigFixture(loadedShot)
    );
    apiMocks.optimizeStoryboardShotVideoPrompt.mockRejectedValue(
      new Error("provider secret")
    );

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...project, storyboard: [loadedShot] }}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "编辑分镜：通勤开场" })
    );
    const dialog = await screen.findByRole("dialog", { name: "通勤开场" });
    const textarea = within(dialog).getByLabelText("编辑视频生成提示词");
    fireEvent.change(textarea, { target: { value: currentDraft } });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "AI 优化视频生成提示词"
      })
    );

    expect(
      await within(dialog).findByText("请求未完成，请检查网络连接后重试。")
    ).toBeInTheDocument();
    expect(textarea).toHaveValue(currentDraft);
    expect(apiMocks.updateStoryboardShotVideoConfig).not.toHaveBeenCalled();
  });

  it("ignores an AI optimization response after the selected shot changes", async () => {
    const shotOne = storyboardShotFixture({
      id: "shot-1",
      index: 1,
      video_prompt: "镜头一提示词"
    });
    const shotTwo = storyboardShotFixture({
      id: "shot-2",
      index: 2,
      title: "办公室产品特写",
      video_prompt: "镜头二提示词"
    });
    let resolveOptimization:
      | ((value: { optimized_prompt: string }) => void)
      | undefined;
    apiMocks.getStoryboardShotVideoConfig.mockImplementation(
      async (_projectId: string, shotId: string) =>
        storyboardVideoConfigFixture(shotId === shotOne.id ? shotOne : shotTwo)
    );
    apiMocks.optimizeStoryboardShotVideoPrompt.mockImplementation(
      () =>
        new Promise<{ optimized_prompt: string }>((resolve) => {
          resolveOptimization = resolve;
        })
    );

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={{ ...project, storyboard: [shotOne, shotTwo] }}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "编辑分镜：通勤开场" })
    );
    const firstDialog = await screen.findByRole("dialog", {
      name: "通勤开场"
    });
    fireEvent.click(
      within(firstDialog).getByRole("button", {
        name: "AI 优化视频生成提示词"
      })
    );
    fireEvent.click(
      document.querySelector(
        '[aria-label^="预览分镜 Shot 02 办公室产品特写"]'
      ) as HTMLButtonElement
    );
    const secondDialog = await screen.findByRole("dialog", {
      name: "办公室产品特写"
    });
    await waitFor(() => {
      expect(
        within(secondDialog).getByLabelText("编辑视频生成提示词")
      ).toHaveValue("镜头二提示词");
    });

    await act(async () => {
      resolveOptimization?.({ optimized_prompt: "不应写入的过期结果" });
    });
    expect(
      within(secondDialog).getByLabelText("编辑视频生成提示词")
    ).toHaveValue("镜头二提示词");
    expect(
      within(secondDialog).queryByDisplayValue("不应写入的过期结果")
    ).not.toBeInTheDocument();
  });

  it("gates the merge action by adjacency and duration and confirms before merging", async () => {
    const shotOne = storyboardShotFixture({
      duration_seconds: 8,
      id: "shot-1",
      index: 1,
      title: "开场"
    });
    const shotTwo = storyboardShotFixture({
      duration_seconds: 10,
      id: "shot-2",
      index: 2,
      title: "特写"
    });
    const shotThree = storyboardShotFixture({
      duration_seconds: 25,
      id: "shot-3",
      index: 3,
      title: "收尾"
    });
    const loadedProject: Project = {
      ...project,
      current_stage: "storyboard",
      status: "succeeded",
      storyboard: [shotOne, shotTwo, shotThree]
    };
    const mergedProject: Project = {
      ...loadedProject,
      storyboard: [
        storyboardShotFixture({
          duration_seconds: 18,
          id: "shot-1",
          index: 1,
          is_merged: true,
          merge_source_count: 2,
          status: "draft",
          title: "镜头 1-2"
        }),
        storyboardShotFixture({
          duration_seconds: 25,
          id: "shot-3",
          index: 2,
          title: "收尾"
        })
      ]
    };
    apiMocks.mergeStoryboardShots.mockResolvedValue(mergedProject);

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={loadedProject}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "合并分镜" }));

    // Non-adjacent selection keeps the merge action disabled and explains why.
    fireEvent.click(
      screen.getByRole("button", { name: "选择分镜 Shot 01" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "选择分镜 Shot 03" })
    );
    expect(
      screen.getByRole("button", { name: "合并所选分镜" })
    ).toBeDisabled();
    expect(screen.getByText(MERGE_NOT_ADJACENT_MESSAGE)).toBeInTheDocument();

    // Selecting shots that exceed 30s is also blocked.
    fireEvent.click(
      screen.getByRole("button", { name: "取消选择分镜 Shot 01" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "选择分镜 Shot 02" })
    );
    expect(
      screen.getByRole("button", { name: "合并所选分镜" })
    ).toBeDisabled();
    expect(
      screen.getByText(new RegExp(MERGE_DURATION_EXCEEDED_MESSAGE))
    ).toBeInTheDocument();

    // Adjacent, within-limit selection enables the merge action.
    fireEvent.click(
      screen.getByRole("button", { name: "取消选择分镜 Shot 03" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "选择分镜 Shot 01" })
    );
    const mergeButton = screen.getByRole("button", {
      name: "合并所选分镜"
    });
    expect(mergeButton).toBeEnabled();

    fireEvent.click(mergeButton);
    expect(
      await screen.findByText("将保存 2 个原子分镜，可稍后拆分恢复。")
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "确认合并" }));

    await waitFor(() => {
      expect(apiMocks.mergeStoryboardShots).toHaveBeenCalledWith("project-1", [
        "shot-1",
        "shot-2"
      ]);
    });
    expect(
      await screen.findByText(
        "分镜已合并，参考素材与视频已清空，请重新选择素材并生成视频。"
      )
    ).toBeInTheDocument();
  });

  it("splits a reversible merged shot after explicit confirmation", async () => {
    const mergedShot = storyboardShotFixture({
      duration_seconds: 18,
      id: "shot-merged",
      index: 1,
      is_merged: true,
      merge_source_count: 2,
      title: "镜头 1-2"
    });
    const trailingShot = storyboardShotFixture({
      id: "shot-3",
      index: 2,
      title: "收尾"
    });
    const loadedProject: Project = {
      ...project,
      current_stage: "storyboard",
      status: "succeeded",
      storyboard: [mergedShot, trailingShot]
    };
    const restoredOne = storyboardShotFixture({
      id: "shot-1",
      index: 1,
      title: "开场"
    });
    const restoredTwo = storyboardShotFixture({
      id: "shot-2",
      index: 2,
      title: "特写"
    });
    apiMocks.splitStoryboardShot.mockResolvedValue({
      ...loadedProject,
      storyboard: [
        restoredOne,
        restoredTwo,
        storyboardShotFixture({
          id: "shot-3",
          index: 3,
          title: "收尾"
        })
      ]
    });

    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={loadedProject}
      />
    );

    expect(
      screen.getByRole("button", { name: "拆分为 2 个原子分镜" })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "拆分为 2 个原子分镜" })
    );

    expect(
      screen.getByRole("heading", { name: "确认拆分合并分镜？" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("合并态提示词修改不会分摊回原子分镜。")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "参考素材、首帧与已生成视频不会恢复，需要重新选择并生成。"
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认拆分" }));

    await waitFor(() => {
      expect(apiMocks.splitStoryboardShot).toHaveBeenCalledWith(
        "project-1",
        "shot-merged"
      );
    });
    expect(
      await screen.findByText(
        "已恢复 2 个原子分镜，参考素材与视频需重新选择并生成。"
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "拆分为 2 个原子分镜" })
    ).not.toBeInTheDocument();
  });

  it("blocks video generation when first frame and reference media conflict", async () => {
    const conflictShot = storyboardShotFixture({
      first_frame_asset_id: "first-frame",
      id: "shot-conflict",
      reference_audio_asset_ids: ["audio-reference"],
      title: "冲突分镜"
    });
    const loadedProject: Project = {
      ...project,
      current_stage: "storyboard",
      status: "succeeded",
      storyboard: [conflictShot],
      text_artifacts: [
        {
          content: "冲突分镜脚本",
          created_at: "2026-08-10T08:40:00Z",
          id: "storyboard-conflict",
          project_id: project.id,
          stage: "storyboard",
          status: "succeeded",
          title: "分镜脚本",
          updated_at: "2026-08-10T08:40:00Z",
          version: 1
        }
      ]
    };
    render(
      <StoryboardVideoWorkspace
        onProjectUpdated={vi.fn()}
        project={loadedProject}
      />
    );

    expect(
      screen.getByRole("heading", { name: "分镜视频工作台" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "首帧控制不能与参考图、参考视频或参考音频同时使用，请移除其中一类素材后重试。"
      )
    ).toBeInTheDocument();
    const generateButton = screen.getByRole("button", {
      name: "生成当前分镜视频"
    });
    expect(generateButton).toBeDisabled();
    fireEvent.click(generateButton);
    expect(apiMocks.generateStoryboardShotVideo).not.toHaveBeenCalled();
  });

  it("keeps character cards visible when image generation fails", async () => {
    const existingAsset = {
      category: "character" as const,
      created_at: "2026-08-10T08:30:00Z",
      id: "character-existing-image",
      metadata: {
        description: "可信、自然的品牌体验官",
        name: "品牌体验官"
      },
      mime_type: "image/png",
      object_key: "projects/project-1/character/existing.png",
      project_id: project.id,
      size_bytes: 2048,
      source_task_id: "task-character",
      stage: "character" as const,
      status: "succeeded" as const,
      type: "generated_image" as const,
      updated_at: "2026-08-10T08:30:00Z",
      url: "https://assets.example.com/existing.png"
    };
    apiMocks.getProject.mockResolvedValue({
      ...project,
      assets: [existingAsset],
      character_cards: [
        characterCardFixture({
          asset_id: null,
          description: "目标用户角色",
          id: "character-card-target",
          name: "目标用户",
          sort_order: 0
        }),
        characterCardFixture({
          asset_id: existingAsset.id,
          id: "character-card-guide",
          sort_order: 1,
          status: "succeeded"
        })
      ],
      current_stage: "character",
      status: "succeeded"
    });
    apiMocks.generateCharacterCardImage.mockRejectedValue(
      new Error("Traceback: private provider credential")
    );

    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );
    fireEvent.click(await screen.findByRole("tab", { name: "角色" }));

    expect(screen.getByRole("heading", { name: "目标用户" })).toBeInTheDocument();
    expect(screen.getByText("图片暂时无法预览")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "形象生成" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新生成" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "形象生成" }));

    await waitFor(() => {
      expect(apiMocks.generateCharacterCardImage).toHaveBeenCalledWith(
        "project-1",
        "character-card-target"
      );
    });
    expect(
      await screen.findByText("请求未完成，请检查网络连接后重试。")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Traceback|credential|private/)
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "目标用户" })).toBeInTheDocument();
    expect(screen.getByText("图片暂时无法预览")).toBeInTheDocument();
  });

  it("shows story and skipped-character empty states", async () => {
    apiMocks.getProject.mockResolvedValue({
      ...project,
      current_stage: "character",
      status: "skipped",
      tasks: [
        {
          created_at: "2026-08-10T08:00:00Z",
          error: null,
          finished_at: "2026-08-10T08:01:00Z",
          id: "task-skip",
          input_hash: null,
          output_asset_ids: [],
          output_text_artifact_id: null,
          progress: 1,
          project_id: project.id,
          stage: "character",
          started_at: "2026-08-10T08:00:00Z",
          status: "skipped",
          updated_at: "2026-08-10T08:01:00Z"
        }
      ]
    });
    render(<ProjectWorkspace initialProjects={[projectListItem]} />);
    fireEvent.click(
      screen.getByRole("button", { name: /便携咖啡机投放/ })
    );

    await screen.findByRole("tab", { name: "故事" });
    fireEvent.click(screen.getByRole("tab", { name: "故事" }));
    expect(
      screen.getByRole("heading", { name: "尚未生成故事" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "角色" }));
    expect(
      screen.getByRole("heading", { name: "角色阶段已跳过" })
    ).toBeInTheDocument();
  });
});

function storyboardShotFixture(
  overrides: Partial<StoryboardShot> = {}
): StoryboardShot {
  return {
    created_at: "2026-08-10T08:40:00Z",
    description: "通勤电梯内，主角从包中取出便携咖啡机。",
    duration_seconds: 12,
    id: "shot-1",
    first_frame_asset_id: null,
    first_frame_source_video_asset_id: null,
    image_asset_id: null,
    index: 1,
    is_merged: false,
    merge_source_count: 0,
    narration: "好咖啡，随身出发。",
    project_id: project.id,
    reference_audio_asset_ids: [],
    reference_image_asset_ids: [],
    reference_video_asset_ids: [],
    status: "succeeded",
    title: "通勤开场",
    updated_at: "2026-08-10T08:40:00Z",
    video_asset_id: null,
    video_prompt: null,
    visual_prompt: "真实摄影，通勤电梯，白领取出便携咖啡机",
    ...overrides
  };
}

function storyboardVideoConfigFixture(
  shot: StoryboardShot
): StoryboardShotVideoConfig {
  return {
    effective_video_prompt:
      shot.video_prompt ??
      `${shot.description}\n${shot.visual_prompt}\n旁白：${shot.narration ?? "无"}\n镜头时长 ${shot.duration_seconds} 秒`,
    first_frame_asset_id: shot.first_frame_asset_id,
    first_frame_source_video_asset_id:
      shot.first_frame_source_video_asset_id,
    reference_audio_asset_ids: shot.reference_audio_asset_ids,
    reference_image_asset_ids: shot.reference_image_asset_ids,
    reference_video_asset_ids: shot.reference_video_asset_ids,
    shot_id: shot.id,
    shot_index: shot.index,
    video_asset_id: shot.video_asset_id,
    video_prompt: shot.video_prompt
  };
}

function assetFixture(overrides: Partial<Asset> = {}): Asset {
  return {
    category: "reference",
    created_at: "2026-08-10T09:00:00Z",
    id: "asset-1",
    metadata: { name: "参考素材" },
    mime_type: "image/png",
    object_key: null,
    project_id: project.id,
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

function characterCardFixture(
  overrides: Partial<CharacterCard> = {}
): CharacterCard {
  return {
    asset_id: null,
    created_at: "2026-08-10T08:25:00Z",
    description: "可信、自然的品牌体验官",
    id: "character-card-1",
    name: "品牌体验官",
    project_id: project.id,
    sort_order: 0,
    status: "draft",
    updated_at: "2026-08-10T08:25:00Z",
    ...overrides
  };
}

function taskFixture(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    created_at: "2026-08-10T09:10:00Z",
    error: null,
    finished_at: null,
    id: "task-video",
    input_hash: null,
    output_asset_ids: [],
    output_text_artifact_id: null,
    progress: 0,
    progress_message: null,
    project_id: project.id,
    stage: "video",
    started_at: null,
    status: "queued",
    updated_at: "2026-08-10T09:10:00Z",
    ...overrides
  };
}
