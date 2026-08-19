import {
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceCreativeWorkflow } from "@/components/workspace/workspace-creative-workflow";
import type {
  GenerationTask,
  Project,
  Stage,
  Status,
  TextArtifact
} from "@/lib/api-types";
import type { TextGenerationController } from "@/lib/use-text-generation-stream";

const apiMocks = vi.hoisted(() => ({
  generateStage: vi.fn(),
  getProject: vi.fn(),
  getTask: vi.fn(),
  retryTask: vi.fn(),
  skipCharacters: vi.fn()
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiMocks,
  getBackendBaseUrl: () => "http://backend.local",
  getUserFacingErrorMessage: () => "请求未完成，请稍后重试。"
}));

const baseProject: Project = {
  assets: [],
  brief: {
    aspect_ratio: "9:16",
    audience: "通勤白领",
    duration_seconds: 30,
    image_purpose: null,
    product_name: "AeroPress Go",
    prompt: "制作一条便携咖啡机广告",
    selling_points: ["便携"],
    style: "真实生活流",
    summary: "通勤场景便携咖啡方案",
    target_language: "zh",
    target_platform: "douyin"
  },
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

describe("WorkspaceCreativeWorkflow", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
  });

  it("shows the six workspace stages in order with clear dependencies", () => {
    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={vi.fn()}
        project={baseProject}
      />
    );

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)
    ).toEqual([
      "故事",
      "角色",
      "剧本",
      "分镜脚本",
      "分镜视频",
      "剪辑成片"
    ]);
    expect(screen.getByRole("button", { name: "生成故事" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "生成角色" })).toBeDisabled();
    expect(
      screen.getByText("需先完成故事阶段，才能生成或跳过角色。")
    ).toBeInTheDocument();
    expect(
      screen.getByText("该阶段包含“分镜画面 → 分镜视频”两个生成步骤。")
    ).toBeInTheDocument();
  });

  it("requires a second explicit confirmation before skipping characters", async () => {
    const storyProject = withStory(baseProject);
    const skippedTask = taskFixture({
      finished_at: "2026-08-09T10:02:00Z",
      progress: 1,
      stage: "character",
      status: "skipped",
      updated_at: "2026-08-09T10:02:00Z"
    });
    const refreshedProject: Project = {
      ...storyProject,
      current_stage: "character",
      status: "skipped",
      tasks: [skippedTask],
      updated_at: skippedTask.updated_at
    };
    const onProjectUpdated = vi.fn();
    apiMocks.skipCharacters.mockResolvedValue(skippedTask);
    apiMocks.getProject.mockResolvedValue(refreshedProject);

    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={onProjectUpdated}
        project={storyProject}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "无角色需求，跳过" })
    );
    expect(apiMocks.skipCharacters).not.toHaveBeenCalled();
    expect(
      screen.getByText(/确认当前广告不需要人物或拟人角色/)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "确认跳过角色阶段" })
    );

    await waitFor(() => {
      expect(apiMocks.skipCharacters).toHaveBeenCalledWith("project-1");
      expect(apiMocks.getProject).toHaveBeenCalledWith("project-1", {
        cache: "no-store"
      });
      expect(onProjectUpdated).toHaveBeenCalledWith(refreshedProject);
    });
    expect(
      screen.getByText("已确认当前项目无需角色，可继续生成剧本。")
    ).toBeInTheDocument();
  });

  it("advances storyboard media generation from images to videos", async () => {
    const characterTask = taskFixture({
      finished_at: "2026-08-09T10:02:00Z",
      progress: 1,
      stage: "character",
      status: "skipped",
      updated_at: "2026-08-09T10:02:00Z"
    });
    const storyboardProject: Project = {
      ...baseProject,
      current_stage: "storyboard",
      status: "succeeded",
      tasks: [characterTask],
      text_artifacts: [
        artifactFixture({ stage: "story" }),
        artifactFixture({ stage: "script" }),
        artifactFixture({ stage: "storyboard" })
      ]
    };
    const imageTask = taskFixture({
      finished_at: "2026-08-09T10:04:00Z",
      progress: 1,
      stage: "image",
      status: "succeeded",
      updated_at: "2026-08-09T10:04:00Z"
    });
    apiMocks.generateStage.mockResolvedValue(imageTask);
    apiMocks.getProject.mockResolvedValue(storyboardProject);

    const firstRender = render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={vi.fn()}
        project={storyboardProject}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "先生成分镜画面" })
    );
    await waitFor(() => {
      expect(apiMocks.generateStage).toHaveBeenCalledWith("project-1", "image");
      expect(apiMocks.getProject).toHaveBeenCalledWith("project-1", {
        cache: "no-store"
      });
    });
    firstRender.unmount();

    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    const projectWithImages: Project = {
      ...storyboardProject,
      assets: [
        {
          category: "scene",
          created_at: "2026-08-09T10:04:00Z",
          id: "image-1",
          metadata: {},
          mime_type: "image/png",
          object_key: "projects/project-1/image/image-1.png",
          project_id: "project-1",
          size_bytes: 1024,
          source_task_id: imageTask.id,
          stage: "image",
          status: "succeeded",
          type: "generated_image",
          updated_at: "2026-08-09T10:04:00Z",
          url: "https://cdn.example.test/image-1.png"
        }
      ],
      current_stage: "image",
      tasks: [characterTask, imageTask]
    };
    const videoTask = taskFixture({
      finished_at: "2026-08-09T10:05:00Z",
      progress: 1,
      stage: "video",
      status: "succeeded",
      updated_at: "2026-08-09T10:05:00Z"
    });
    apiMocks.generateStage.mockResolvedValue(videoTask);
    apiMocks.getProject.mockResolvedValue(projectWithImages);

    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={vi.fn()}
        project={projectWithImages}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "生成分镜视频" }));
    await waitFor(() => {
      expect(apiMocks.generateStage).toHaveBeenCalledWith("project-1", "video");
      expect(apiMocks.getProject).toHaveBeenCalledWith("project-1", {
        cache: "no-store"
      });
    });
  });

  it("hides backend failure details and retries the failed task", async () => {
    const failedTask = taskFixture({
      error: {
        code: "generation_failed",
        detail: "Traceback: /private/service/key",
        message: "internal model credential failed"
      },
      finished_at: "2026-08-09T10:01:00Z",
      stage: "story",
      status: "failed",
      updated_at: "2026-08-09T10:01:00Z"
    });
    const failedProject = {
      ...baseProject,
      current_stage: "story" as const,
      status: "failed" as const,
      tasks: [failedTask]
    };
    const retryTask = taskFixture({
      id: "task-retry",
      stage: "story",
      status: "queued",
      updated_at: "2026-08-09T10:02:00Z"
    });
    apiMocks.retryTask.mockResolvedValue(retryTask);

    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={vi.fn()}
        project={failedProject}
      />
    );

    expect(
      screen.getByText("本阶段生成未完成，内部错误详情已隐藏，请重试。")
    ).toBeInTheDocument();
    expect(screen.queryByText(/credential|Traceback|private/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试本阶段" }));

    await waitFor(() => {
      expect(apiMocks.retryTask).toHaveBeenCalledWith(failedTask.id);
    });
  });

  it("polls queued tasks and refreshes the project after completion", async () => {
    const queuedTask = taskFixture({
      stage: "story",
      status: "queued"
    });
    const runningProject = {
      ...baseProject,
      current_stage: "story" as const,
      status: "queued" as const,
      tasks: [queuedTask]
    };
    const succeededTask = {
      ...queuedTask,
      finished_at: "2026-08-09T10:02:00Z",
      progress: 1,
      status: "succeeded" as const,
      updated_at: "2026-08-09T10:02:00Z"
    };
    const refreshedProject = withStory({
      ...runningProject,
      status: "succeeded",
      tasks: [succeededTask]
    });
    const onProjectUpdated = vi.fn();
    apiMocks.getTask.mockResolvedValue(succeededTask);
    apiMocks.getProject.mockResolvedValue(refreshedProject);

    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={onProjectUpdated}
        project={runningProject}
      />
    );

    await waitFor(() => {
      expect(apiMocks.getTask).toHaveBeenCalledWith(queuedTask.id);
      expect(apiMocks.getProject).toHaveBeenCalledWith("project-1", {
        cache: "no-store"
      });
      expect(onProjectUpdated).toHaveBeenCalledWith(refreshedProject);
    });
  });

  it("shows script task status and progress while generation is running", () => {
    const storyProject = withStory(baseProject);
    const skippedCharacterTask = taskFixture({
      finished_at: "2026-08-09T10:02:00Z",
      progress: 1,
      stage: "character",
      status: "skipped",
      updated_at: "2026-08-09T10:02:00Z"
    });
    const runningScriptTask = taskFixture({
      id: "task-script-running",
      progress: 0.42,
      stage: "script",
      status: "running",
      updated_at: "2026-08-09T10:03:00Z"
    });
    apiMocks.getTask.mockReturnValue(new Promise(() => undefined));

    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={vi.fn()}
        project={{
          ...storyProject,
          current_stage: "script",
          status: "running",
          tasks: [skippedCharacterTask, runningScriptTask]
        }}
      />
    );

    expect(screen.getByText("生成中")).toBeInTheDocument();
    expect(screen.getByText("当前任务进度 42%")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "任务进行中" })
    ).toBeDisabled();
  });

  it("starts script generation through the shared text stream controller", async () => {
    const storyProject = withStory(baseProject);
    const skippedCharacterTask = taskFixture({
      finished_at: "2026-08-09T10:02:00Z",
      progress: 1,
      stage: "character",
      status: "skipped",
      updated_at: "2026-08-09T10:02:00Z"
    });
    const projectReadyForScript: Project = {
      ...storyProject,
      current_stage: "character",
      tasks: [skippedCharacterTask]
    };
    const queuedScriptTask = taskFixture({
      id: "task-script",
      stage: "script",
      status: "queued",
      updated_at: "2026-08-09T10:03:00Z"
    });
    const succeededScriptTask = {
      ...queuedScriptTask,
      finished_at: "2026-08-09T10:04:00Z",
      output_text_artifact_id: "artifact-script",
      progress: 1,
      status: "succeeded" as const,
      updated_at: "2026-08-09T10:04:00Z"
    };
    const refreshedProject: Project = {
      ...projectReadyForScript,
      current_stage: "script",
      status: "succeeded",
      tasks: [skippedCharacterTask, succeededScriptTask],
      text_artifacts: [
        ...projectReadyForScript.text_artifacts,
        artifactFixture({
          content: "最新剧本正文",
          id: "artifact-script",
          stage: "script",
          title: "最新广告剧本",
          updated_at: "2026-08-09T10:04:00Z",
          version: 1
        })
      ],
      updated_at: "2026-08-09T10:04:00Z"
    };
    const onProjectUpdated = vi.fn();
    const textGeneration = textGenerationControllerFixture();
    apiMocks.generateStage.mockResolvedValue(queuedScriptTask);
    apiMocks.getTask.mockResolvedValue(succeededScriptTask);
    apiMocks.getProject.mockResolvedValue(refreshedProject);

    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={onProjectUpdated}
        project={projectReadyForScript}
        textGeneration={textGeneration}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "生成剧本" }));

    await waitFor(() => {
      expect(textGeneration.start).toHaveBeenCalledWith("script");
    });
    expect(apiMocks.generateStage).not.toHaveBeenCalled();
    expect(apiMocks.getTask).not.toHaveBeenCalled();
  });

  it("shows storyboard task status and progress while generation is running", () => {
    const projectReadyForStoryboard = withScriptReadyProject(baseProject);
    const runningStoryboardTask = taskFixture({
      id: "task-storyboard-running",
      progress: 0.36,
      stage: "storyboard",
      status: "running",
      updated_at: "2026-08-09T10:05:00Z"
    });
    apiMocks.getTask.mockReturnValue(new Promise(() => undefined));

    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={vi.fn()}
        project={{
          ...projectReadyForStoryboard,
          current_stage: "storyboard",
          status: "running",
          tasks: [...projectReadyForStoryboard.tasks, runningStoryboardTask]
        }}
      />
    );

    const storyboardCard = screen
      .getByRole("heading", { name: "分镜脚本" })
      .closest("li");

    expect(storyboardCard).not.toBeNull();
    expect(storyboardCard!).toHaveTextContent("生成中");
    expect(storyboardCard!).toHaveTextContent("当前任务进度 36%");
    expect(
      screen.getByRole("button", { name: "任务进行中" })
    ).toBeDisabled();
  });

  it("starts storyboard generation through the shared text stream controller", async () => {
    const projectReadyForStoryboard = withScriptReadyProject(baseProject);
    const queuedStoryboardTask = taskFixture({
      id: "task-storyboard",
      stage: "storyboard",
      status: "queued",
      updated_at: "2026-08-09T10:05:00Z"
    });
    const succeededStoryboardTask = {
      ...queuedStoryboardTask,
      finished_at: "2026-08-09T10:06:00Z",
      output_text_artifact_id: "artifact-storyboard",
      progress: 1,
      status: "succeeded" as const,
      updated_at: "2026-08-09T10:06:00Z"
    };
    const refreshedProject: Project = {
      ...projectReadyForStoryboard,
      current_stage: "storyboard",
      status: "succeeded",
      storyboard: [
        {
          created_at: "2026-08-09T10:06:00Z",
          description: "通勤电梯内，主角展示便携咖啡机。",
          duration_seconds: 12,
          id: "shot-1",
          first_frame_asset_id: null,
          first_frame_source_video_asset_id: null,
          image_asset_id: null,
          index: 1,
          is_merged: false,
          merge_source_count: 0,
          narration: "好咖啡随身出发。",
          project_id: "project-1",
          status: "succeeded",
          title: "通勤开场",
          updated_at: "2026-08-09T10:06:00Z",
          video_asset_id: null,
          video_prompt: null,
          reference_image_asset_ids: [],
          reference_video_asset_ids: [],
          reference_audio_asset_ids: [],
          visual_prompt: "真实摄影，通勤电梯，便携咖啡机产品露出"
        }
      ],
      tasks: [...projectReadyForStoryboard.tasks, succeededStoryboardTask],
      text_artifacts: [
        ...projectReadyForStoryboard.text_artifacts,
        artifactFixture({
          content: "镜头 1：通勤电梯内，主角展示便携咖啡机。",
          id: "artifact-storyboard",
          stage: "storyboard",
          title: "最新分镜脚本",
          updated_at: "2026-08-09T10:06:00Z",
          version: 1
        })
      ],
      updated_at: "2026-08-09T10:06:00Z"
    };
    const onProjectUpdated = vi.fn();
    const textGeneration = textGenerationControllerFixture();
    apiMocks.generateStage.mockResolvedValue(queuedStoryboardTask);
    apiMocks.getTask.mockResolvedValue(succeededStoryboardTask);
    apiMocks.getProject.mockResolvedValue(refreshedProject);

    render(
      <WorkspaceCreativeWorkflow
        onProjectUpdated={onProjectUpdated}
        project={projectReadyForStoryboard}
        textGeneration={textGeneration}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "生成分镜脚本" }));

    await waitFor(() => {
      expect(textGeneration.start).toHaveBeenCalledWith("storyboard");
    });
    expect(apiMocks.generateStage).not.toHaveBeenCalled();
    expect(apiMocks.getTask).not.toHaveBeenCalled();
  });
});

function textGenerationControllerFixture(): TextGenerationController {
  return {
    cancel: vi.fn(),
    retry: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    state: {
      error: null,
      stage: null,
      status: "idle",
      task: null,
      text: ""
    }
  };
}

function withStory(project: Project): Project {
  return {
    ...project,
    current_stage: "story",
    status: "succeeded",
    text_artifacts: [
      artifactFixture({
        stage: "story",
        updated_at: "2026-08-09T10:01:00Z"
      })
    ],
    updated_at: "2026-08-09T10:01:00Z"
  };
}

function withScriptReadyProject(project: Project): Project {
  const storyProject = withStory(project);
  const skippedCharacterTask = taskFixture({
    finished_at: "2026-08-09T10:02:00Z",
    progress: 1,
    stage: "character",
    status: "skipped",
    updated_at: "2026-08-09T10:02:00Z"
  });

  return {
    ...storyProject,
    current_stage: "script",
    status: "succeeded",
    tasks: [skippedCharacterTask],
    text_artifacts: [
      ...storyProject.text_artifacts,
      artifactFixture({
        content: "最新剧本正文",
        id: "artifact-script",
        stage: "script",
        title: "最新广告剧本",
        updated_at: "2026-08-09T10:04:00Z",
        version: 1
      })
    ],
    updated_at: "2026-08-09T10:04:00Z"
  };
}

function artifactFixture(
  overrides: Partial<TextArtifact> & { stage: Stage }
): TextArtifact {
  return {
    content: "故事内容",
    created_at: "2026-08-09T10:01:00Z",
    id: `artifact-${overrides.stage}`,
    project_id: "project-1",
    status: "succeeded",
    title: null,
    updated_at: "2026-08-09T10:01:00Z",
    version: 1,
    ...overrides
  };
}

function taskFixture(
  overrides: Partial<GenerationTask> & {
    stage: Stage;
    status: Status;
  }
): GenerationTask {
  return {
    created_at: "2026-08-09T10:00:00Z",
    error: null,
    finished_at: null,
    id: `task-${overrides.stage}`,
    input_hash: "input-hash",
    output_asset_ids: [],
    output_text_artifact_id: null,
    progress: 0,
    progress_message: null,
    project_id: "project-1",
    started_at: null,
    updated_at: "2026-08-09T10:00:00Z",
    ...overrides
  };
}
