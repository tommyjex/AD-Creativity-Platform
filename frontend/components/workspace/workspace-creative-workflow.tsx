"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  FileText,
  ImageIcon,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Users
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  apiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type {
  GenerationStage,
  GenerationTask,
  Project,
  Stage,
  Status,
  TextArtifact
} from "@/lib/api-types";
import { getStageLabel } from "@/lib/project-display";
import {
  isTextStreamStage,
  type TextGenerationController
} from "@/lib/use-text-generation-stream";
import { cn } from "@/lib/utils";

export type DetailTab =
  | "brief"
  | "story"
  | "characters"
  | "script"
  | "storyboard"
  | "storyboardVideo"
  | "compose";

const POLLING_STATUSES = new Set<Status>(["queued", "running"]);
const TERMINAL_STATUSES = new Set<Status>([
  "succeeded",
  "skipped",
  "failed",
  "cancelled",
  "expired",
  "stale"
]);

type WorkspaceStage =
  | "story"
  | "character"
  | "script"
  | "storyboard"
  | "video"
  | "compose";

interface StageDefinition {
  detailTab: DetailTab;
  description: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  stage: WorkspaceStage;
}

interface StageViewModel extends StageDefinition {
  actionStage: GenerationStage;
  completed: boolean;
  dependencyHint: string;
  dependencyMet: boolean;
  latestTask?: GenerationTask;
  status: Status;
  supportingText?: string;
}

const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    description: "故事骨架、情绪转折和转化落点。",
    detailTab: "story",
    icon: Sparkles,
    label: "故事",
    stage: "story"
  },
  {
    description: "统一角色形象或确认无角色需求。",
    detailTab: "characters",
    icon: Users,
    label: "角色",
    stage: "character"
  },
  {
    description: "旁白、动作和节奏完整的脚本。",
    detailTab: "script",
    icon: FileText,
    label: "剧本",
    stage: "script"
  },
  {
    description: "镜头级描述、画面提示和时长。",
    detailTab: "storyboard",
    icon: Clapperboard,
    label: "分镜脚本",
    stage: "storyboard"
  },
  {
    description: "分镜画面与镜头视频。",
    detailTab: "storyboardVideo",
    icon: ImageIcon,
    label: "分镜视频",
    stage: "video"
  },
  {
    description: "汇总镜头视频生成最终成片。",
    detailTab: "compose",
    icon: CheckCircle2,
    label: "剪辑成片",
    stage: "compose"
  }
];

const STATUS_LABELS: Record<Status, string> = {
  cancelled: "已取消",
  draft: "待开始",
  expired: "已过期",
  failed: "失败",
  queued: "排队中",
  running: "生成中",
  skipped: "已跳过",
  stale: "需更新",
  succeeded: "已完成"
};

interface WorkspaceCreativeWorkflowProps {
  activeDetailTab?: DetailTab;
  onDetailTabChange?: (tab: DetailTab) => void;
  onProjectUpdated: (project: Project) => void;
  project: Project;
  textGeneration?: TextGenerationController;
}

export function WorkspaceCreativeWorkflow({
  activeDetailTab = "brief",
  onDetailTabChange,
  onProjectUpdated,
  project,
  textGeneration
}: WorkspaceCreativeWorkflowProps) {
  const [taskUpdates, setTaskUpdates] = useState<GenerationTask[]>([]);
  const [pendingRetryTaskId, setPendingRetryTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "error" | "info" | "success";
  } | null>(null);
  const tasks = useMemo(
    () => mergeTaskUpdates(project.tasks, taskUpdates),
    [project.tasks, taskUpdates]
  );

  const textGenerationState = textGeneration?.state;
  const latestTasks = useMemo(() => latestTaskMap(tasks), [tasks]);
  const stages = useMemo(() => {
    const built = buildStageViewModels(project, latestTasks);
    if (textGenerationState?.status !== "streaming") return built;
    return built.map((stage) =>
      stage.stage === textGenerationState.stage
        ? {
            ...stage,
            latestTask: textGenerationState.task ?? stage.latestTask,
            status: "running" as Status,
            supportingText: "内容正在实时生成"
          }
        : stage
    );
  }, [latestTasks, project, textGenerationState]);
  const activeTaskIds = useMemo(
    () =>
      tasks
        .filter((task) => POLLING_STATUSES.has(task.status))
        .map((task) => task.id)
        .sort()
        .join("|"),
    [tasks]
  );
  const legacyActionMode = onDetailTabChange === undefined;
  const displayedNotice =
    textGenerationState?.status === "failed"
      ? {
          message: textGenerationState.error ?? "文本生成失败，请重试。",
          tone: "error" as const
        }
      : notice;

  const refreshProject = useCallback(async () => {
    const freshProject = await apiClient.getProject(project.id, {
      cache: "no-store"
    });
    setTaskUpdates([]);
    onProjectUpdated(freshProject);
  }, [onProjectUpdated, project.id]);

  useEffect(() => {
    if (activeTaskIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function pollTasks() {
      try {
        const updates = await Promise.all(
          activeTaskIds
            .split("|")
            .filter(Boolean)
            .map((taskId) => apiClient.getTask(taskId))
        );

        if (cancelled) {
          return;
        }

        setTaskUpdates((current) => mergeTaskUpdates(current, updates));

        if (updates.some((task) => TERMINAL_STATUSES.has(task.status))) {
          await refreshProject();
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({
            message: getUserFacingErrorMessage(error),
            tone: "error"
          });
        }
      }
    }

    void pollTasks();
    const intervalId = window.setInterval(() => {
      void pollTasks();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeTaskIds, refreshProject]);

  async function handleRetry(task: GenerationTask) {
    if (pendingRetryTaskId !== null) {
      return;
    }

    setPendingRetryTaskId(task.id);
    setNotice(null);

    try {
      if (isTextStreamStage(task.stage) && textGeneration) {
        await textGeneration.retry(task);
        return;
      }
      const retryTask = await apiClient.retryTask(task.id);
      setTaskUpdates((current) => mergeTaskUpdates(current, [retryTask]));
      setNotice({
        message: `${getStageLabel(task.stage)}重试任务已提交。`,
        tone: "info"
      });

      if (TERMINAL_STATUSES.has(retryTask.status)) {
        await refreshProject();
      }
    } catch (error) {
      setNotice({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingRetryTaskId(null);
    }
  }

  async function handleGenerateStage(stage: GenerationStage) {
    setNotice(null);
    try {
      if (isTextStreamStage(stage)) {
        if (!textGeneration) {
          throw new Error("text generation controller is unavailable");
        }
        await textGeneration.start(stage);
        return;
      }
      const task = await apiClient.generateStage(project.id, stage);
      setTaskUpdates((current) => mergeTaskUpdates(current, [task]));
      setNotice({
        message: `${getStageLabel(stage)}任务已提交，状态会自动更新。`,
        tone: task.status === "failed" ? "error" : "info"
      });
      if (TERMINAL_STATUSES.has(task.status)) {
        await refreshProject();
      }
    } catch (error) {
      setNotice({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    }
  }

  async function handleSkipCharacters() {
    setNotice(null);
    try {
      const task = await apiClient.skipCharacters(project.id);
      setTaskUpdates((current) => mergeTaskUpdates(current, [task]));
      await refreshProject();
      setNotice({
        message: "已确认当前项目无需角色，可继续生成剧本。",
        tone: "success"
      });
    } catch (error) {
      setNotice({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    }
  }

  return (
    <section
      aria-labelledby="creative-workflow-title"
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-glass"
    >
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ad-kicker">Creative Workflow</p>
            <h2
              className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl"
              id="creative-workflow-title"
            >
              六阶段创作流程
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              流程图只展示阶段状态。点击节点进入对应标签页完成生成、编辑和删除。
            </p>
          </div>
          <Badge variant={activeTaskIds ? "signal" : "secondary"}>
            {activeTaskIds ? "任务同步中" : "状态已同步"}
          </Badge>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {displayedNotice ? <WorkflowNotice {...displayedNotice} /> : null}
        <ol className="grid gap-3 xl:grid-cols-6 md:grid-cols-3 sm:grid-cols-2">
          {stages.map((stage) => (
            <StageFlowNode
              active={activeDetailTab === stage.detailTab}
              key={stage.stage}
              onClick={() => onDetailTabChange?.(stage.detailTab)}
              onGenerate={handleGenerateStage}
              onRetry={handleRetry}
              onSkipCharacters={handleSkipCharacters}
              pendingRetry={pendingRetryTaskId === stage.latestTask?.id}
              project={project}
              showLegacyActions={legacyActionMode}
              stage={stage}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

function StageFlowNode({
  active,
  onClick,
  onGenerate,
  onRetry,
  onSkipCharacters,
  pendingRetry,
  project,
  showLegacyActions,
  stage
}: {
  active: boolean;
  onClick: () => void;
  onGenerate: (stage: GenerationStage) => void;
  onRetry: (task: GenerationTask) => void;
  onSkipCharacters: () => void;
  pendingRetry: boolean;
  project: Project;
  showLegacyActions: boolean;
  stage: StageViewModel;
}) {
  const Icon = stage.icon;
  const [skipConfirming, setSkipConfirming] = useState(false);
  const taskIsActive = stage.latestTask
    ? POLLING_STATUSES.has(stage.latestTask.status)
    : false;
  const canRetry = stage.latestTask?.status === "failed";
  const progress = stage.latestTask
    ? Math.round(stage.latestTask.progress * 100)
    : stage.completed
      ? 100
      : 0;

  return (
    <li>
      <button
        aria-current={active ? "step" : undefined}
        className={cn(
          "group relative flex min-h-28 w-full flex-col rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          active
            ? "border-primary/45 bg-primary/[0.08] shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]"
            : stage.completed
              ? "border-success/20 bg-success/[0.025] hover:border-success/35"
              : stage.status === "failed"
                ? "border-destructive/30 bg-destructive/[0.025]"
                : "border-border bg-secondary/25 hover:border-primary/25 hover:bg-primary/[0.035]"
        )}
        onClick={onClick}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                stage.completed
                  ? "border-success/25 bg-success/10 text-success"
                  : active
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-primary/15 bg-primary/[0.07] text-primary"
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold leading-5 text-foreground">
                {stage.label}
              </h3>
              {showLegacyActions ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {STATUS_LABELS[stage.status]}
                </span>
              ) : null}
            </div>
          </div>
          <span
            aria-label={STATUS_LABELS[stage.status]}
            className={cn(
              "mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4",
              statusDotClassName(stage.status)
            )}
            title={STATUS_LABELS[stage.status]}
          />
        </div>

        {showLegacyActions ? (
          <>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {stage.supportingText ?? stage.description}
            </p>
            <p
              className={cn(
                "mt-2 line-clamp-2 text-xs leading-5",
                stage.dependencyMet ? "text-muted-foreground" : "text-warning"
              )}
            >
              {stage.stage === "character" && !stage.dependencyMet
                ? "需先完成故事阶段，才能生成或跳过角色。"
                : stage.dependencyHint}
            </p>
          </>
        ) : null}
        {showLegacyActions && stage.status === "failed" ? (
          <p className="mt-2 text-xs leading-5 text-destructive">
            本阶段生成未完成，内部错误详情已隐藏，请重试。
          </p>
        ) : null}
        {showLegacyActions && taskIsActive ? (
          <p className="mt-2 text-xs leading-5 text-primary">
            当前任务进度 {progress}%
          </p>
        ) : null}

        <div className="mt-auto pt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                stage.status === "failed" ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{taskIsActive ? "任务进行中" : `进度 ${progress}%`}</span>
          </div>
        </div>
      </button>

      {canRetry && stage.latestTask ? (
        <Button
          className="mt-2 w-full"
          disabled={pendingRetry}
          onClick={() => onRetry(stage.latestTask!)}
          size="sm"
          type="button"
          variant="outline"
        >
          {pendingRetry ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          )}
          重试本阶段
        </Button>
      ) : null}
      {showLegacyActions && !canRetry ? (
        <div className="mt-2 grid gap-2">
          {skipConfirming ? (
            <div className="rounded-xl border border-warning/25 bg-warning/[0.08] p-3">
              <p className="text-xs leading-5 text-warning">
                确认当前广告不需要人物或拟人角色后，将跳过角色阶段。
              </p>
              <Button
                className="mt-2 w-full"
                onClick={() => {
                  setSkipConfirming(false);
                  onSkipCharacters();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                确认跳过角色阶段
              </Button>
            </div>
          ) : null}
          <Button
            disabled={!stage.dependencyMet || taskIsActive || stage.completed}
            onClick={() => {
              if (stage.stage === "video") {
                onGenerate(hasGeneratedImages(project) ? "video" : "image");
                return;
              }
              onGenerate(stage.actionStage);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {taskIsActive ? "任务进行中" : legacyGenerateLabel(stage, project)}
          </Button>
          {stage.stage === "character" ? (
            <Button
              disabled={!stage.dependencyMet || taskIsActive || stage.completed}
              onClick={() => setSkipConfirming(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              无角色需求，跳过
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function WorkflowNotice({
  message,
  tone
}: {
  message: string;
  tone: "error" | "info" | "success";
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : tone === "success"
            ? "border-success/30 bg-success/10 text-success"
            : "border-info/30 bg-info/10 text-info"
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function statusDotClassName(status: Status): string {
  if (status === "succeeded" || status === "skipped") {
    return "bg-success ring-success/15";
  }

  if (status === "queued" || status === "running") {
    return "bg-primary ring-primary/15";
  }

  if (status === "failed") {
    return "bg-destructive ring-destructive/15";
  }

  if (status === "stale" || status === "expired" || status === "cancelled") {
    return "bg-warning ring-warning/15";
  }

  return "bg-muted-foreground/45 ring-muted-foreground/10";
}

function legacyGenerateLabel(stage: StageViewModel, project: Project): string {
  if (stage.stage === "story") {
    return "生成故事";
  }
  if (stage.stage === "character") {
    return "生成角色";
  }
  if (stage.stage === "script") {
    return "生成剧本";
  }
  if (stage.stage === "storyboard") {
    return "生成分镜脚本";
  }
  if (stage.stage === "video") {
    return hasGeneratedImages(project) ? "生成分镜视频" : "先生成分镜画面";
  }
  return "生成剪辑成片";
}

function hasGeneratedImages(project: Project): boolean {
  return project.assets.some(
    (asset) => asset.stage === "image" && asset.status === "succeeded"
  );
}

function buildStageViewModels(
  project: Project,
  latestTasks: Map<Stage, GenerationTask>
): StageViewModel[] {
  const latestArtifacts = latestArtifactMap(project.text_artifacts);
  const storyArtifact = latestArtifacts.get("story");
  const storyComplete = storyArtifact?.status === "succeeded";
  const characterTask = latestTasks.get("character");
  const characterAssetComplete = project.assets.some(
    (asset) =>
      asset.stage === "character" &&
      asset.category === "character" &&
      asset.status === "succeeded"
  );
  const characterDecisionIsCurrent =
    storyArtifact !== undefined &&
    characterTask !== undefined &&
    new Date(characterTask.updated_at).getTime() >=
      new Date(storyArtifact.updated_at).getTime();
  const characterComplete =
    characterDecisionIsCurrent &&
    (characterTask.status === "skipped" ||
      (characterTask.status === "succeeded" && characterAssetComplete));
  const scriptComplete = latestArtifacts.get("script")?.status === "succeeded";
  const storyboardComplete =
    latestArtifacts.get("storyboard")?.status === "succeeded";
  const imageComplete = project.assets.some(
    (asset) => asset.stage === "image" && asset.status === "succeeded"
  );
  const videoComplete = project.assets.some(
    (asset) => asset.stage === "video" && asset.status === "succeeded"
  );
  const composeComplete = project.assets.some(
    (asset) => asset.stage === "compose" && asset.status === "succeeded"
  );

  return STAGE_DEFINITIONS.map((definition) => {
    if (definition.stage === "story") {
      const latestTask = latestTasks.get("story");
      return {
        ...definition,
        actionStage: "story",
        completed: storyComplete,
        dependencyHint: "依赖已满足：项目 Brief 已就绪。",
        dependencyMet: true,
        latestTask,
        status: resolveStageStatus(storyComplete, latestTask)
      };
    }

    if (definition.stage === "character") {
      return {
        ...definition,
        actionStage: "character",
        completed: characterComplete,
        dependencyHint: storyComplete
          ? "依赖已满足：故事已完成。"
          : "需先完成故事阶段。",
        dependencyMet: storyComplete,
        latestTask: characterTask,
        status: characterComplete
          ? characterTask?.status ?? "succeeded"
          : resolveStageStatus(false, characterTask)
      };
    }

    if (definition.stage === "script") {
      const latestTask = latestTasks.get("script");
      return {
        ...definition,
        actionStage: "script",
        completed: scriptComplete,
        dependencyHint:
          storyComplete && characterComplete
            ? "依赖已满足：故事和角色决策已完成。"
            : "需先完成故事，并生成角色或确认无角色需求。",
        dependencyMet: storyComplete && characterComplete,
        latestTask,
        status: resolveStageStatus(scriptComplete, latestTask)
      };
    }

    if (definition.stage === "storyboard") {
      const latestTask = latestTasks.get("storyboard");
      return {
        ...definition,
        actionStage: "storyboard",
        completed: storyboardComplete,
        dependencyHint: scriptComplete
          ? "依赖已满足：剧本已完成。"
          : "需先完成剧本阶段。",
        dependencyMet: scriptComplete,
        latestTask,
        status: resolveStageStatus(storyboardComplete, latestTask)
      };
    }

    if (definition.stage === "video") {
      const actionStage: GenerationStage = imageComplete ? "video" : "image";
      const latestTask = latestTasks.get(actionStage);
      return {
        ...definition,
        actionStage,
        completed: videoComplete,
        dependencyHint: storyboardComplete
          ? "依赖已满足：分镜脚本已完成。"
          : "需先完成分镜脚本阶段。",
        dependencyMet: storyboardComplete,
        latestTask,
        status: resolveStageStatus(videoComplete, latestTask),
        supportingText:
          imageComplete && !videoComplete
            ? "分镜画面已就绪，下一步可生成分镜视频。"
            : !imageComplete
              ? "该阶段包含“分镜画面 → 分镜视频”两个生成步骤。"
              : undefined
      };
    }

    const latestTask = latestTasks.get("compose");
    return {
      ...definition,
      actionStage: "compose",
      completed: composeComplete,
      dependencyHint: videoComplete
        ? "依赖已满足：分镜视频已完成。"
        : "需先完成分镜视频阶段。",
      dependencyMet: videoComplete,
      latestTask,
      status: resolveStageStatus(composeComplete, latestTask)
    };
  });
}

function resolveStageStatus(
  completed: boolean,
  latestTask?: GenerationTask
): Status {
  if (latestTask && POLLING_STATUSES.has(latestTask.status)) {
    return latestTask.status;
  }

  if (latestTask?.status === "failed") {
    return "failed";
  }

  if (completed) {
    return "succeeded";
  }

  if (
    latestTask?.status === "stale" ||
    latestTask?.status === "cancelled" ||
    latestTask?.status === "expired"
  ) {
    return latestTask.status;
  }

  return "draft";
}

function latestTaskMap(tasks: GenerationTask[]): Map<Stage, GenerationTask> {
  const map = new Map<Stage, GenerationTask>();

  for (const task of tasks) {
    const existing = map.get(task.stage);
    if (
      existing === undefined ||
      new Date(task.updated_at).getTime() >
        new Date(existing.updated_at).getTime()
    ) {
      map.set(task.stage, task);
    }
  }

  return map;
}

function latestArtifactMap(
  artifacts: TextArtifact[]
): Map<Stage, TextArtifact> {
  const map = new Map<Stage, TextArtifact>();

  for (const artifact of artifacts) {
    const existing = map.get(artifact.stage);
    if (
      existing === undefined ||
      artifact.version > existing.version ||
      (artifact.version === existing.version &&
        new Date(artifact.updated_at).getTime() >
          new Date(existing.updated_at).getTime())
    ) {
      map.set(artifact.stage, artifact);
    }
  }

  return map;
}

function mergeTaskUpdates(
  currentTasks: GenerationTask[],
  updates: GenerationTask[]
): GenerationTask[] {
  const taskMap = new Map(currentTasks.map((task) => [task.id, task]));

  for (const update of updates) {
    taskMap.set(update.id, update);
  }

  return [...taskMap.values()];
}
