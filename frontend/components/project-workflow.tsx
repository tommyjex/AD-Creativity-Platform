"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Film, RefreshCw, Sparkles, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  apiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type {
  Asset,
  GenerationStage,
  GenerationTask,
  Project,
  Stage,
  Status,
  StoryboardShot,
  TextArtifact
} from "@/lib/api-types";
import {
  formatDate,
  getStageLabel,
  statusVariant,
  summarizeAssets
} from "@/lib/project-display";
import { cn } from "@/lib/utils";

const STAGE_CONFIGS: Array<{
  stage: GenerationStage;
  endpoint: string;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    description: "从 Brief 推导广告故事骨架、情绪转折与转化落点。",
    endpoint: "story",
    label: "故事生成",
    shortLabel: "故事",
    stage: "story"
  },
  {
    description: "把故事拆成可拍摄脚本，沉淀旁白、动作和节奏。",
    endpoint: "script",
    label: "剧本生成",
    shortLabel: "剧本",
    stage: "script"
  },
  {
    description: "生成镜头级分镜表，为后续生图和生视频提供控制面。",
    endpoint: "storyboard",
    label: "分镜生成",
    shortLabel: "分镜",
    stage: "storyboard"
  },
  {
    description: "按分镜视觉提示生成关键帧图片资产。",
    endpoint: "images",
    label: "生图",
    shortLabel: "图片",
    stage: "image"
  },
  {
    description: "把关键帧推进为镜头视频资产。",
    endpoint: "videos",
    label: "生视频",
    shortLabel: "视频",
    stage: "video"
  },
  {
    description: "汇总镜头视频并生成最终剪辑资产。",
    endpoint: "compose",
    label: "剪辑合成",
    shortLabel: "剪辑",
    stage: "compose"
  }
];

const STAGE_ORDER: Stage[] = [
  "brief",
  "story",
  "script",
  "storyboard",
  "image",
  "video",
  "compose"
];

const TERMINAL_STATUSES = new Set<Status>([
  "succeeded",
  "failed",
  "cancelled",
  "expired",
  "stale"
]);

const POLLING_STATUSES = new Set<Status>(["queued", "running"]);

interface ProjectWorkflowProps {
  initialAssets: Asset[];
  initialProject: Project;
}

export function ProjectWorkflow({
  initialAssets,
  initialProject
}: ProjectWorkflowProps) {
  const [project, setProject] = useState(initialProject);
  const [assets, setAssets] = useState(
    initialAssets.length > 0 ? initialAssets : initialProject.assets
  );
  const [tasks, setTasks] = useState(initialProject.tasks);
  const [pendingStage, setPendingStage] = useState<GenerationStage | null>(null);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "error" | "info";
    message: string;
  } | null>(null);

  const latestTasksByStage = useMemo(() => latestTaskMap(tasks), [tasks]);
  const latestArtifactsByStage = useMemo(
    () => latestArtifactMap(project.text_artifacts),
    [project.text_artifacts]
  );
  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [
    assets
  ]);
  const activeTaskIds = useMemo(
    () =>
      tasks
        .filter((task) => POLLING_STATUSES.has(task.status))
        .map((task) => task.id)
        .sort()
        .join("|"),
    [tasks]
  );
  const assetStats = useMemo(() => summarizeAssets(assets), [assets]);

  const refreshProjectSnapshot = useCallback(async () => {
    const [freshProject, freshAssets] = await Promise.all([
      apiClient.getProject(project.id, { cache: "no-store" }),
      apiClient.listProjectAssets(project.id, { cache: "no-store" })
    ]);

    setProject(freshProject);
    setAssets(freshAssets.length > 0 ? freshAssets : freshProject.assets);
    setTasks(freshProject.tasks);
  }, [project.id]);

  useEffect(() => {
    if (activeTaskIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function pollTasks() {
      const ids = activeTaskIds.split("|").filter(Boolean);

      try {
        const updates = await Promise.all(ids.map((id) => apiClient.getTask(id)));

        if (cancelled) {
          return;
        }

        setTasks((currentTasks) => mergeTaskUpdates(currentTasks, updates));

        if (updates.some((task) => task.status === "succeeded")) {
          await refreshProjectSnapshot();
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ message: formatError(error), tone: "error" });
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
  }, [activeTaskIds, refreshProjectSnapshot]);

  async function handleGenerate(stage: GenerationStage) {
    if (pendingStage !== null) {
      return;
    }

    setPendingStage(stage);
    setNotice(null);

    try {
      const task = await apiClient.generateStage(project.id, stage);
      setTasks((currentTasks) => mergeTaskUpdates(currentTasks, [task]));
      setNotice({
        message: `${getStageLabel(stage)}任务已创建：${task.id}`,
        tone: "info"
      });

      if (TERMINAL_STATUSES.has(task.status)) {
        await refreshProjectSnapshot();
      }
    } catch (error) {
      setNotice({ message: formatError(error), tone: "error" });
      await refreshProjectSnapshot().catch(() => undefined);
    } finally {
      setPendingStage(null);
    }
  }

  async function handleRetry(taskId: string) {
    if (retryingTaskId !== null) {
      return;
    }

    setRetryingTaskId(taskId);
    setNotice(null);

    try {
      const task = await apiClient.retryTask(taskId);
      setTasks((currentTasks) => mergeTaskUpdates(currentTasks, [task]));
      setNotice({
        message: `${getStageLabel(task.stage)}重试任务已创建：${task.id}`,
        tone: "info"
      });

      if (TERMINAL_STATUSES.has(task.status)) {
        await refreshProjectSnapshot();
      }
    } catch (error) {
      setNotice({ message: formatError(error), tone: "error" });
    } finally {
      setRetryingTaskId(null);
    }
  }

  return (
    <main className="min-h-screen">
      <section className="container py-12 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <div className="space-y-5">
              <Badge className="w-fit" variant="signal">
                PROJECT COMMAND ROOM
              </Badge>
              <div className="space-y-4">
                <p className="ad-kicker">项目详情创作流程 / Task 5</p>
                <h1 className="ad-display max-w-5xl">{project.name}</h1>
                <p className="ad-copy max-w-3xl">
                  围绕同一个广告 Brief 编排故事、剧本、分镜、图片、视频和最终剪辑。
                  本页负责创作流程推进、任务轮询和产物回看。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="rounded-2xl" variant="outline">
                  <Link href={`/projects/${project.id}/assets`}>打开资产库</Link>
                </Button>
                <Button asChild className="rounded-2xl" variant="signal">
                  <Link href={`/projects/${project.id}/export`}>查看导出预览</Link>
                </Button>
              </div>
            </div>

            <ProjectOverview project={project} stats={assetStats} />
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant={statusVariant(project.status)}>
                    {project.status}
                  </Badge>
                  <CardTitle className="mt-4 text-2xl md:text-3xl">
                    当前阶段：{getStageLabel(project.current_stage)}
                  </CardTitle>
                  <CardDescription>
                    更新时间 {formatDate(project.updated_at)} · 项目 ID {project.id}
                  </CardDescription>
                </div>
                <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3 text-primary shadow-energy-line">
                  <Sparkles className="h-6 w-6" aria-hidden="true" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Text Artifacts" value={project.text_artifacts.length} />
                <Metric label="Storyboard Shots" value={project.storyboard.length} />
                <Metric label="Assets" value={assets.length} />
                <Metric label="Tasks" value={tasks.length} />
              </div>
              {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container grid gap-6 pb-8 xl:grid-cols-[1.1fr_0.9fr]">
        <StageProgressPanel
          artifacts={latestArtifactsByStage}
          assets={assets}
          latestTasksByStage={latestTasksByStage}
          onGenerate={handleGenerate}
          pendingStage={pendingStage}
          project={project}
        />
        <TaskStatusPanel
          onRetry={handleRetry}
          retryingTaskId={retryingTaskId}
          tasks={tasks}
        />
      </section>

      <section className="container grid gap-6 pb-8 xl:grid-cols-[0.95fr_1.05fr]">
        <TextArtifactsPanel artifacts={project.text_artifacts} />
        <StoryboardPanel assetsById={assetsById} shots={project.storyboard} />
      </section>

      <section className="container pb-16">
        <AssetSummaryPanel assets={assets} stats={assetStats} />
      </section>
    </main>
  );
}

function ProjectOverview({
  project,
  stats
}: {
  project: Project;
  stats: ReturnType<typeof summarizeAssets>;
}) {
  const brief = project.brief;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-2xl">Brief Overview</CardTitle>
            <CardDescription>
              平台 {brief.target_platform} · 画幅 {brief.aspect_ratio} ·{" "}
              {brief.duration_seconds} 秒
            </CardDescription>
          </div>
          <Badge variant="secondary">{brief.product_name ?? "Unnamed Product"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <p className="rounded-3xl border border-border bg-card p-5 text-sm leading-7 text-foreground">
            {brief.prompt}
          </p>
          {brief.summary ? (
            <p className="text-sm leading-7 text-muted-foreground">{brief.summary}</p>
          ) : null}
        </div>
        <div className="space-y-3">
          <InfoRow label="视觉风格" value={brief.style ?? "等待生成策略收敛"} />
          <InfoRow label="目标受众" value={brief.audience ?? "未指定"} />
          <InfoRow label="卖点数量" value={`${brief.selling_points.length}`} />
          <InfoRow label="资产结构" value={`${stats.images} 图 / ${stats.videos} 视频`} />
          {brief.selling_points.length > 0 ? (
            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground">
                Selling Points
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {brief.selling_points.map((point) => (
                  <Badge key={point} variant="outline">
                    {point}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StageProgressPanel({
  artifacts,
  assets,
  latestTasksByStage,
  onGenerate,
  pendingStage,
  project
}: {
  artifacts: Map<Stage, TextArtifact>;
  assets: Asset[];
  latestTasksByStage: Map<Stage, GenerationTask>;
  onGenerate: (stage: GenerationStage) => void;
  pendingStage: GenerationStage | null;
  project: Project;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Stage Progress</CardTitle>
            <CardDescription>
              六个生成阶段按依赖顺序推进；运行中的任务会自动轮询。
            </CardDescription>
          </div>
          <Badge variant="info">LIVE POLLING</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {STAGE_CONFIGS.map((config, index) => {
          const latestTask = latestTasksByStage.get(config.stage);
          const state = getStageState({
            artifacts,
            assets,
            config,
            currentStage: project.current_stage,
            latestTask
          });
          const isRunning = latestTask ? POLLING_STATUSES.has(latestTask.status) : false;
          const isPending = pendingStage === config.stage;

          return (
            <div
              className="group relative overflow-hidden rounded-3xl border border-border bg-card p-4"
              key={config.stage}
            >
              <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-transparent opacity-45" />
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-4">
                  <div
                    className={cn(
                      "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border font-mono text-sm font-semibold",
                      state.completed
                        ? "border-success/30 bg-success/10 text-success"
                        : isRunning
                          ? "border-primary/30 bg-primary/10 text-primary shadow-energy-line"
                          : "border-border bg-secondary/40 text-muted-foreground"
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-[-0.025em]">
                        {config.label}
                      </h3>
                      <Badge variant={statusVariant(state.status)}>
                        {state.status}
                      </Badge>
                      <Badge variant="secondary">/{config.endpoint}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {config.description}
                    </p>
                    {latestTask ? (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.round(latestTask.progress * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                <Button
                  className="shrink-0 rounded-2xl"
                  disabled={pendingStage !== null || isRunning}
                  onClick={() => onGenerate(config.stage)}
                  type="button"
                  variant={state.completed ? "outline" : "cinematic"}
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                      发起中
                    </>
                  ) : isRunning ? (
                    "任务运行中"
                  ) : state.completed ? (
                    `重新生成${config.shortLabel}`
                  ) : (
                    config.label
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TaskStatusPanel({
  onRetry,
  retryingTaskId,
  tasks
}: {
  onRetry: (taskId: string) => void;
  retryingTaskId: string | null;
  tasks: GenerationTask[];
}) {
  const sortedTasks = [...tasks].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Task Status</CardTitle>
            <CardDescription>展示 task_id、阶段、状态、进度和失败重试入口。</CardDescription>
          </div>
          <div className="rounded-2xl border border-accent/25 bg-accent/10 p-3 text-accent">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        {sortedTasks.length > 0 ? (
          sortedTasks.map((task) => (
            <div
              className="rounded-3xl border border-border bg-secondary/40 p-4"
              key={task.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                    <span className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                      {getStageLabel(task.stage)}
                    </span>
                  </div>
                  <div className="mt-3 truncate font-mono text-xs text-foreground">
                    {task.id}
                  </div>
                </div>
                {task.status === "failed" ? (
                  <Button
                    disabled={retryingTaskId !== null}
                    onClick={() => onRetry(task.id)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    {retryingTaskId === task.id ? "重试中" : "重试"}
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    task.status === "failed"
                      ? "bg-destructive"
                      : "bg-primary"
                  )}
                  style={{ width: `${Math.round(task.progress * 100)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>Progress {Math.round(task.progress * 100)}%</span>
                <span>{formatDate(task.updated_at)}</span>
              </div>
              {task.error ? (
                <div className="mt-3 rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
                  {task.error.message}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState
            description="点击左侧任一阶段生成按钮后，任务会出现在这里并自动轮询。"
            title="还没有生成任务"
          />
        )}
      </CardContent>
    </Card>
  );
}

function TextArtifactsPanel({ artifacts }: { artifacts: TextArtifact[] }) {
  const sortedArtifacts = [...artifacts].sort(
    (a, b) =>
      STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) ||
      b.version - a.version
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-2xl">Text Artifacts</CardTitle>
        <CardDescription>故事、剧本和分镜文本产物按阶段展示，保留版本和状态。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {sortedArtifacts.length > 0 ? (
          sortedArtifacts.map((artifact) => (
            <article
              className="rounded-3xl border border-border bg-card p-5"
              key={artifact.id}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge variant={statusVariant(artifact.status)}>
                    {getStageLabel(artifact.stage)}
                  </Badge>
                  <h3 className="mt-3 text-lg font-semibold tracking-[-0.025em]">
                    {artifact.title ?? `${getStageLabel(artifact.stage)} V${artifact.version}`}
                  </h3>
                </div>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  v{artifact.version}
                </span>
              </div>
              <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl border border-border bg-secondary/40 p-4 text-sm leading-7 text-muted-foreground">
                {artifact.content}
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            description="故事、剧本或分镜生成成功后，文本产物会在这里展开。"
            title="暂无文本产物"
          />
        )}
      </CardContent>
    </Card>
  );
}

function StoryboardPanel({
  assetsById,
  shots
}: {
  assetsById: Map<string, Asset>;
  shots: StoryboardShot[];
}) {
  const sortedShots = [...shots].sort((a, b) => a.index - b.index);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Storyboard Table</CardTitle>
            <CardDescription>镜头描述、视觉提示、旁白、时长和关联图片/视频资产。</CardDescription>
          </div>
          <Badge variant="secondary">{shots.length} SHOTS</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sortedShots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border bg-card font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Shot</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">Visual Prompt</th>
                  <th className="px-5 py-4">Narration</th>
                  <th className="px-5 py-4">Assets</th>
                </tr>
              </thead>
              <tbody>
                {sortedShots.map((shot) => (
                  <tr className="border-b border-border align-top" key={shot.id}>
                    <td className="px-5 py-5">
                      <div className="font-mono text-lg font-semibold text-primary">
                        {String(shot.index).padStart(2, "0")}
                      </div>
                      <Badge className="mt-2" variant={statusVariant(shot.status)}>
                        {shot.status}
                      </Badge>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {shot.duration_seconds}s
                      </div>
                    </td>
                    <td className="max-w-64 px-5 py-5">
                      <div className="font-semibold text-foreground">
                        {shot.title ?? `镜头 ${shot.index}`}
                      </div>
                      <p className="mt-2 leading-6 text-muted-foreground">
                        {shot.description}
                      </p>
                    </td>
                    <td className="max-w-80 px-5 py-5 leading-6 text-muted-foreground">
                      {shot.visual_prompt}
                    </td>
                    <td className="max-w-64 px-5 py-5 leading-6 text-muted-foreground">
                      {shot.narration ?? "无旁白"}
                    </td>
                    <td className="px-5 py-5">
                      <AssetLink
                        asset={shot.image_asset_id ? assetsById.get(shot.image_asset_id) : undefined}
                        emptyLabel="未绑定图片"
                        label="Image"
                      />
                      <AssetLink
                        asset={shot.video_asset_id ? assetsById.get(shot.video_asset_id) : undefined}
                        emptyLabel="未绑定视频"
                        label="Video"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              description="完成分镜生成后，这里会出现镜头级创作表。"
              title="暂无分镜"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssetSummaryPanel({
  assets,
  stats
}: {
  assets: Asset[];
  stats: ReturnType<typeof summarizeAssets>;
}) {
  const recentAssets = [...assets]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Asset Signal</CardTitle>
            <CardDescription>
              仅展示项目详情内的资产摘要；完整资产库和导出页保留给后续任务。
            </CardDescription>
          </div>
          <Badge variant="outline">
            {stats.images} IMG · {stats.videos} VID · {stats.finalVideos} FINAL
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {recentAssets.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {recentAssets.map((asset) => (
              <div
                className="relative overflow-hidden rounded-3xl border border-border bg-card p-4"
                key={asset.id}
              >
                <div className="absolute right-[-2rem] top-[-2rem] h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={statusVariant(asset.status)}>{asset.status}</Badge>
                    <div className="mt-3 font-semibold text-foreground">
                      {asset.type.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {getStageLabel(asset.stage ?? "brief")}
                    </div>
                  </div>
                  <Film className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="relative mt-4 truncate font-mono text-[0.68rem] text-muted-foreground">
                  {asset.url ?? asset.object_key ?? asset.id}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            description="生图、生视频或剪辑合成成功后，项目资产摘要会显示在这里。"
            title="暂无资产"
          />
        )}
      </CardContent>
    </Card>
  );
}

function AssetLink({
  asset,
  emptyLabel,
  label
}: {
  asset?: Asset;
  emptyLabel: string;
  label: string;
}) {
  return (
    <div className="mb-2 rounded-2xl border border-border bg-secondary/40 px-3 py-2">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-xs text-foreground">
        {asset?.url ?? asset?.object_key ?? asset?.id ?? emptyLabel}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
        {value}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/40 px-4 py-3">
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function Notice({ message, tone }: { message: string; tone: "error" | "info" }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-2xl border px-4 py-3 text-sm leading-6",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-info/30 bg-info/10 text-info"
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function EmptyState({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-[-0.025em]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function getStageState({
  artifacts,
  assets,
  config,
  currentStage,
  latestTask
}: {
  artifacts: Map<Stage, TextArtifact>;
  assets: Asset[];
  config: (typeof STAGE_CONFIGS)[number];
  currentStage: Stage;
  latestTask?: GenerationTask;
}): { completed: boolean; status: Status } {
  const hasTextArtifact = artifacts.has(config.stage);
  const hasStoryboard = config.stage === "storyboard" && hasTextArtifact;
  const hasAsset = assets.some(
    (asset) => asset.stage === config.stage && asset.status === "succeeded"
  );
  const currentStageIndex = STAGE_ORDER.indexOf(currentStage);
  const stageIndex = STAGE_ORDER.indexOf(config.stage);
  const completed =
    latestTask?.status === "succeeded" ||
    hasTextArtifact ||
    hasStoryboard ||
    hasAsset ||
    (currentStageIndex > stageIndex && stageIndex > -1);
  const status: Status = latestTask?.status ?? (completed ? "succeeded" : "draft");

  return {
    completed,
    status
  };
}

function latestTaskMap(tasks: GenerationTask[]): Map<Stage, GenerationTask> {
  const map = new Map<Stage, GenerationTask>();

  for (const task of tasks) {
    const existing = map.get(task.stage);
    if (
      existing === undefined ||
      new Date(task.updated_at).getTime() > new Date(existing.updated_at).getTime()
    ) {
      map.set(task.stage, task);
    }
  }

  return map;
}

function latestArtifactMap(artifacts: TextArtifact[]): Map<Stage, TextArtifact> {
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

  return [...taskMap.values()].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function formatError(error: unknown): string {
  return getUserFacingErrorMessage(error);
}
