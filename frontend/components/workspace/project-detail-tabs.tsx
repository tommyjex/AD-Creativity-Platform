"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Film,
  FileText,
  LoaderCircle,
  PencilLine,
  FilePenLine,
  ImageIcon,
  PlayCircle,
  RefreshCw,
  SkipForward,
  ScrollText,
  Trash2,
  Video,
  UserRound
} from "lucide-react";
import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StoryboardVideoWorkspace } from "@/components/workspace/storyboard-video-workspace";
import {
  getSafePreviewUrl,
  getWorkspaceAssetDescription
} from "@/lib/asset-display";
import {
  apiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type {
  Asset,
  CharacterCard,
  GenerationTask,
  Project,
  Stage,
  Status,
  StoryboardShot,
  TextArtifact
} from "@/lib/api-types";
import { getViewportBoundPreviewStyle } from "@/lib/media-layout";
import { formatDate, statusVariant } from "@/lib/project-display";
import type { TextGenerationController } from "@/lib/use-text-generation-stream";
import { cn } from "@/lib/utils";

export type DetailTab =
  | "brief"
  | "story"
  | "characters"
  | "script"
  | "storyboard"
  | "storyboardVideo"
  | "compose";

const TABS: Array<{
  icon: typeof FilePenLine;
  id: DetailTab;
  label: string;
}> = [
  { icon: FilePenLine, id: "brief", label: "Brief" },
  { icon: ScrollText, id: "story", label: "故事" },
  { icon: UserRound, id: "characters", label: "角色" },
  { icon: FileText, id: "script", label: "剧本" },
  { icon: Clapperboard, id: "storyboard", label: "分镜脚本" },
  { icon: Video, id: "storyboardVideo", label: "分镜视频" },
  { icon: Film, id: "compose", label: "剪辑成片" }
];

const POLLING_STATUSES = new Set<Status>(["queued", "running"]);
const TERMINAL_STATUSES = new Set<Status>([
  "succeeded",
  "failed",
  "cancelled",
  "expired",
  "skipped"
]);

interface ProjectDetailTabsProps {
  activeTab: DetailTab;
  briefPanel: ReactNode;
  onActiveTabChange: (tab: DetailTab) => void;
  onProjectUpdated: (project: Project) => void;
  project: Project;
  textGeneration: TextGenerationController;
}

export function ProjectDetailTabs({
  activeTab,
  briefPanel,
  onActiveTabChange,
  onProjectUpdated,
  project,
  textGeneration
}: ProjectDetailTabsProps) {
  const baseId = useId();

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: DetailTab
  ) {
    const currentIndex = TABS.findIndex((tab) => tab.id === currentTab);
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = TABS[nextIndex].id;
    onActiveTabChange(nextTab);
    document.getElementById(`${baseId}-${nextTab}-tab`)?.focus();
  }

  return (
    <section
      aria-label="项目内容"
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-glass"
    >
      <div className="border-b border-border px-4 pt-4 sm:px-6 sm:pt-5">
        <div
          aria-label="项目内容分类"
          className="flex gap-1 overflow-x-auto"
          role="tablist"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                aria-controls={`${baseId}-${tab.id}-panel`}
                aria-selected={isActive}
                className={cn(
                  "relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                  isActive
                    ? "bg-primary/[0.07] text-primary"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
                id={`${baseId}-${tab.id}-tab`}
                key={tab.id}
                onClick={() => onActiveTabChange(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {tab.label}
                {isActive ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div
        aria-labelledby={`${baseId}-${activeTab}-tab`}
        id={`${baseId}-${activeTab}-panel`}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab === "brief" ? briefPanel : null}
        {activeTab === "story" ? (
          <StoryPanel
            onProjectUpdated={onProjectUpdated}
            project={project}
            textGeneration={textGeneration}
          />
        ) : null}
        {activeTab === "script" ? (
          <ScriptPanel
            onProjectUpdated={onProjectUpdated}
            project={project}
            textGeneration={textGeneration}
          />
        ) : null}
        {activeTab === "storyboard" ? (
          <StoryboardPanel
            onProjectUpdated={onProjectUpdated}
            project={project}
            textGeneration={textGeneration}
          />
        ) : null}
        {activeTab === "storyboardVideo" ? (
          <StoryboardVideoWorkspace
            onProjectUpdated={onProjectUpdated}
            project={project}
          />
        ) : null}
        {activeTab === "characters" ? (
          <CharacterPanel
            onProjectUpdated={onProjectUpdated}
            project={project}
          />
        ) : null}
        {activeTab === "compose" ? (
          <ComposePanel onProjectUpdated={onProjectUpdated} project={project} />
        ) : null}
      </div>
    </section>
  );
}

function StoryPanel({
  onProjectUpdated,
  project,
  textGeneration
}: {
  onProjectUpdated: (project: Project) => void;
  project: Project;
  textGeneration: TextGenerationController;
}) {
  const story = latestTextArtifact(project.text_artifacts, "story", {
    includeNonStale: true
  });
  const streamState =
    textGeneration.state.stage === "story" ? textGeneration.state : null;

  if (
    streamState &&
    (streamState.status === "streaming" || streamState.status === "completed")
  ) {
    return (
      <StreamingTextArtifactPanel
        label="故事生成中"
        text={streamState.text}
      />
    );
  }

  if (!story) {
    return (
      <EmptyPanel
        action={
          <div className="space-y-3">
            <StageGenerateButton
              label="生成故事"
              onProjectUpdated={onProjectUpdated}
              onGenerate={() => textGeneration.start("story")}
              project={project}
              stage="story"
            />
            {streamState?.error ? (
              <IterationFeedback message={streamState.error} tone="error" />
            ) : null}
          </div>
        }
        description="基于 Brief 生成故事骨架、情绪转折和转化落点。"
        icon={ScrollText}
        title="尚未生成故事"
      />
    );
  }

  return (
    <EditableTextArtifactPanel
      artifact={story}
      emptyMessage="请输入故事正文。"
      generationError={streamState?.error ?? null}
      kicker="Story Artifact"
      onProjectUpdated={onProjectUpdated}
      project={project}
      regenerateLabel="重新生成故事"
      onRegenerate={() => textGeneration.start("story")}
      saveLabel="保存故事"
      stage="story"
      titleFallback="广告故事"
      deleteLabel="删除故事"
      triggerLabel="编辑故事"
    />
  );
}

function ScriptPanel({
  onProjectUpdated,
  project,
  textGeneration
}: {
  onProjectUpdated: (project: Project) => void;
  project: Project;
  textGeneration: TextGenerationController;
}) {
  const script = latestTextArtifact(project.text_artifacts, "script", {
    succeededOnly: true
  });
  const streamState =
    textGeneration.state.stage === "script" ? textGeneration.state : null;

  if (
    streamState &&
    (streamState.status === "streaming" || streamState.status === "completed")
  ) {
    return (
      <StreamingTextArtifactPanel
        label="剧本生成中"
        text={streamState.text}
      />
    );
  }

  if (!script) {
    return (
      <EmptyPanel
        action={
          <div className="space-y-3">
            <StageGenerateButton
              label="生成剧本"
              onProjectUpdated={onProjectUpdated}
              onGenerate={() => textGeneration.start("script")}
              project={project}
              stage="script"
            />
            {streamState?.error ? (
              <IterationFeedback message={streamState.error} tone="error" />
            ) : null}
          </div>
        }
        description="基于已确认故事和角色决策生成旁白、动作和节奏完整的剧本。"
        icon={FileText}
        title="尚未生成剧本"
      />
    );
  }

  return (
    <EditableTextArtifactPanel
      artifact={script}
      emptyMessage="请输入剧本正文。"
      generationError={streamState?.error ?? null}
      kicker="Script Artifact"
      onProjectUpdated={onProjectUpdated}
      project={project}
      regenerateLabel="重新生成剧本"
      onRegenerate={() => textGeneration.start("script")}
      saveLabel="保存剧本"
      stage="script"
      titleFallback="广告剧本"
      deleteLabel="删除剧本"
      triggerLabel="编辑剧本"
    />
  );
}

function StoryboardPanel({
  onProjectUpdated,
  project,
  textGeneration
}: {
  onProjectUpdated: (project: Project) => void;
  project: Project;
  textGeneration: TextGenerationController;
}) {
  const storyboard = latestTextArtifact(project.text_artifacts, "storyboard");
  const shots = [...project.storyboard].sort((left, right) => {
    if (left.index !== right.index) {
      return left.index - right.index;
    }

    return left.updated_at.localeCompare(right.updated_at);
  });
  const streamState =
    textGeneration.state.stage === "storyboard"
      ? textGeneration.state
      : null;

  if (
    streamState &&
    (streamState.status === "streaming" || streamState.status === "completed")
  ) {
    return (
      <StreamingTextArtifactPanel
        label="分镜脚本生成中"
        text={streamState.text}
      />
    );
  }

  if (!storyboard) {
    return (
      <EmptyPanel
        action={
          <div className="space-y-3">
            <StageGenerateButton
              label="生成分镜脚本"
              onProjectUpdated={onProjectUpdated}
              onGenerate={() => textGeneration.start("storyboard")}
              project={project}
              stage="storyboard"
            />
            {streamState?.error ? (
              <IterationFeedback message={streamState.error} tone="error" />
            ) : null}
          </div>
        }
        description="把剧本拆解为镜头级描述、视觉提示、旁白和时长。"
        icon={Clapperboard}
        title="尚未生成分镜脚本"
      />
    );
  }

  return (
    <EditableTextArtifactPanel
      afterContent={
        <StoryboardShotList
          onProjectUpdated={onProjectUpdated}
          project={project}
          shots={shots}
        />
      }
      artifact={storyboard}
      emptyMessage="请输入分镜脚本正文。"
      generationError={streamState?.error ?? null}
      kicker="Storyboard Artifact"
      onProjectUpdated={onProjectUpdated}
      project={project}
      regenerateLabel="重新生成分镜脚本"
      onRegenerate={() => textGeneration.start("storyboard")}
      saveLabel="保存分镜脚本"
      stage="storyboard"
      titleFallback="分镜脚本"
      deleteLabel="删除分镜脚本"
      triggerLabel="编辑分镜脚本"
    />
  );
}

function StoryboardShotList({
  onProjectUpdated,
  project,
  shots
}: {
  onProjectUpdated: (project: Project) => void;
  project: Project;
  shots: StoryboardShot[];
}) {
  const [deletingShotId, setDeletingShotId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);

  async function handleDeleteShot(shot: StoryboardShot) {
    if (deletingShotId !== null) {
      return;
    }
    setDeletingShotId(shot.id);
    setFeedback(null);
    try {
      const updatedProject = await apiClient.deleteStoryboardShot(
        project.id,
        shot.id
      );
      onProjectUpdated(updatedProject);
      setFeedback({ message: `镜头 ${shot.index} 已删除。`, tone: "success" });
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setDeletingShotId(null);
    }
  }

  if (shots.length === 0) {
    return (
      <section
        aria-labelledby="storyboard-shots-title"
        className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center"
      >
        <h3
          className="text-sm font-semibold tracking-[-0.01em] text-foreground"
          id="storyboard-shots-title"
        >
          结构化分镜镜头
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          当前分镜暂未返回结构化镜头列表。
        </p>
      </section>
    );
  }

  return (
    <section className="mt-7" aria-labelledby="storyboard-shots-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ad-kicker">Shot List</p>
          <h3
            className="mt-2 text-lg font-semibold tracking-[-0.025em] text-foreground"
            id="storyboard-shots-title"
          >
            结构化分镜镜头
          </h3>
        </div>
        <Badge variant="info">{shots.length} 个镜头</Badge>
      </div>
      {feedback ? (
        <IterationFeedback message={feedback.message} tone={feedback.tone} />
      ) : null}

      <div className="mt-4 grid gap-4">
        {shots.map((shot) => (
          <article
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            key={shot.id}
          >
            <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary">
                  Shot {String(shot.index).padStart(2, "0")}
                </p>
                <h4 className="mt-1 text-base font-semibold text-foreground">
                  {shot.title ?? `镜头 ${shot.index}`}
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{shot.duration_seconds} 秒</Badge>
                <Badge variant={statusVariant(shot.status)}>{shot.status}</Badge>
                <Button
                  disabled={deletingShotId !== null}
                  onClick={() => handleDeleteShot(shot)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {deletingShotId === shot.id ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : (
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  )}
                  删除镜头
                </Button>
              </div>
            </div>

            <dl className="mt-4 grid gap-4 md:grid-cols-2">
              <ShotField label="画面描述" value={shot.description} />
              <ShotField label="旁白或字幕" value={shot.narration ?? "无"} />
              <ShotField
                className="md:col-span-2"
                label="视觉提示词"
                value={shot.visual_prompt}
              />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function ShotField({
  className,
  label,
  value
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm leading-6 text-foreground">{value}</dd>
    </div>
  );
}

function StreamingTextArtifactPanel({
  label,
  text
}: {
  label: string;
  text: string;
}) {
  return (
    <article aria-live="polite" className="p-6 sm:p-7">
      <div className="flex items-center gap-2 border-b border-border pb-5">
        <LoaderCircle
          aria-hidden="true"
          className="h-4 w-4 animate-spin text-primary"
        />
        <h2 className="text-base font-semibold text-foreground">{label}</h2>
      </div>
      <div className="mt-6 min-h-64 whitespace-pre-wrap border-l-2 border-primary/25 pl-5 text-sm leading-8 text-foreground">
        {text || "正在连接生成服务..."}
      </div>
    </article>
  );
}

function EditableTextArtifactPanel({
  afterContent,
  artifact,
  deleteLabel,
  emptyMessage,
  generationError,
  kicker,
  onProjectUpdated,
  onRegenerate,
  project,
  regenerateLabel,
  saveLabel,
  stage,
  titleFallback,
  triggerLabel
}: {
  afterContent?: ReactNode;
  artifact: TextArtifact;
  deleteLabel: string;
  emptyMessage: string;
  generationError: string | null;
  kicker: string;
  onProjectUpdated: (project: Project) => void;
  onRegenerate: () => Promise<void>;
  project: Project;
  regenerateLabel: string;
  saveLabel: string;
  stage: "story" | "script" | "storyboard";
  titleFallback: string;
  triggerLabel: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(artifact.content);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "delete" | "generate" | null
  >(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      setFeedback({ message: emptyMessage, tone: "error" });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedProject = await apiClient.updateTextArtifact(
        project.id,
        stage,
        { content: trimmedContent }
      );
      onProjectUpdated(updatedProject);
      setIsEditing(false);
      setFeedback({ message: "内容已保存。", tone: "success" });
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setIsSaving(false);
    }
  }

  function closeEditor() {
    if (isSaving) {
      return;
    }
    setContent(artifact.content);
    setFeedback(null);
    setIsEditing(false);
  }

  async function handleRegenerate() {
    if (pendingAction !== null || isSaving) {
      return;
    }
    setPendingAction("generate");
    setFeedback(null);
    try {
      await onRegenerate();
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (pendingAction !== null || isSaving) {
      return;
    }
    setPendingAction("delete");
    setFeedback(null);
    try {
      const updatedProject = await apiClient.deleteTextArtifact(
        project.id,
        artifact.id
      );
      onProjectUpdated(updatedProject);
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <article className="p-6 sm:p-7">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ad-kicker">{kicker}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {artifact.title ?? titleFallback}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(artifact.status)}>{artifact.status}</Badge>
          <Badge variant="secondary">版本 {artifact.version}</Badge>
          <time
            className="text-xs text-muted-foreground"
            dateTime={artifact.updated_at}
            suppressHydrationWarning
          >
            {formatDate(artifact.updated_at)}
          </time>
          {!isEditing ? (
            <>
              <Button
                onClick={() => {
                  setContent(artifact.content);
                  setFeedback(null);
                  setIsEditing(true);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <PencilLine aria-hidden="true" className="h-4 w-4" />
                {triggerLabel}
              </Button>
              <Button
                disabled={pendingAction !== null}
                onClick={handleRegenerate}
                size="sm"
                type="button"
                variant="outline"
              >
                {pendingAction === "generate" ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                )}
                {regenerateLabel}
              </Button>
              <Button
                disabled={pendingAction !== null}
                onClick={handleDelete}
                size="sm"
                type="button"
                variant="ghost"
              >
                {pendingAction === "delete" ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                ) : (
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                )}
                {deleteLabel}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {generationError ? (
        <IterationFeedback message={generationError} tone="error" />
      ) : null}

      {isEditing ? (
        <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${artifact.id}-content`}>{triggerLabel}</Label>
            <Textarea
              className="min-h-64 resize-y"
              disabled={isSaving}
              id={`${artifact.id}-content`}
              onChange={(event) => {
                setContent(event.target.value);
                setFeedback(null);
              }}
              value={content}
            />
          </div>
          {feedback ? (
            <IterationFeedback message={feedback.message} tone={feedback.tone} />
          ) : null}
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              disabled={isSaving}
              onClick={closeEditor}
              type="button"
              variant="ghost"
            >
              关闭编辑
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                  />
                  保存中
                </>
              ) : (
                saveLabel
              )}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {feedback ? (
            <IterationFeedback message={feedback.message} tone={feedback.tone} />
          ) : null}
          <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-border bg-secondary/30 p-5 text-sm leading-8 text-foreground sm:p-6">
            {artifact.content}
          </div>
          {afterContent}
        </>
      )}
    </article>
  );
}

function CharacterPanel({
  onProjectUpdated,
  project
}: {
  onProjectUpdated: (project: Project) => void;
  project: Project;
}) {
  const [failedImageAssetIds, setFailedImageAssetIds] = useState<Set<string>>(
    () => new Set()
  );
  const [pendingCharacterAction, setPendingCharacterAction] = useState<
    "skip" | null
  >(null);
  const [editingField, setEditingField] = useState<{
    cardId: string;
    field: "description" | "name";
  } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [generatingCardIds, setGeneratingCardIds] = useState<Set<string>>(
    () => new Set()
  );
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const characterCards = sortCharacterCards(project.character_cards ?? []);
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  const characterSkipped = project.tasks.some(
    (task) => task.stage === "character" && task.status === "skipped"
  );

  async function handleSkipCharacters() {
    if (pendingCharacterAction !== null) {
      return;
    }
    setPendingCharacterAction("skip");
    setFeedback(null);
    try {
      await apiClient.skipCharacters(project.id);
      const freshProject = await apiClient.getProject(project.id, {
        cache: "no-store"
      });
      onProjectUpdated(freshProject);
      setFeedback({ message: "已跳过角色阶段。", tone: "success" });
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingCharacterAction(null);
    }
  }

  function beginEdit(card: CharacterCard, field: "description" | "name") {
    if (savingCardId !== null) {
      return;
    }
    setEditingField({ cardId: card.id, field });
    setDraftValue(field === "name" ? card.name : card.description);
    setFeedback(null);
  }

  function cancelEdit() {
    setEditingField(null);
    setDraftValue("");
  }

  async function saveCardField(card: CharacterCard) {
    if (!editingField || savingCardId !== null) {
      return;
    }

    const field = editingField.field;
    const nextValue = draftValue.trim();
    const currentValue = field === "name" ? card.name : card.description;

    if (nextValue.length === 0) {
      setFeedback({
        message: field === "name" ? "角色名称不能为空。" : "角色描述不能为空。",
        tone: "error"
      });
      return;
    }

    if (nextValue === currentValue) {
      cancelEdit();
      return;
    }

    setSavingCardId(card.id);
    setFeedback(null);
    try {
      await apiClient.updateCharacterCard(project.id, card.id, {
        [field]: nextValue
      });
      const freshProject = await apiClient.getProject(project.id, {
        cache: "no-store"
      });
      onProjectUpdated(freshProject);
      cancelEdit();
      setFeedback({ message: "角色卡已保存。", tone: "success" });
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setSavingCardId(null);
    }
  }

  async function handleGenerateImage(card: CharacterCard) {
    if (
      generatingCardIds.has(card.id) ||
      deletingCardId === card.id ||
      savingCardId === card.id
    ) {
      return;
    }
    setGeneratingCardIds((current) => {
      const next = new Set(current);
      next.add(card.id);
      return next;
    });
    setFeedback(null);
    try {
      await apiClient.generateCharacterCardImage(project.id, card.id);
      const freshProject = await apiClient.getProject(project.id, {
        cache: "no-store"
      });
      onProjectUpdated(freshProject);
      setFeedback({ message: "角色形象已生成，项目详情已刷新。", tone: "success" });
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setGeneratingCardIds((current) => {
        const next = new Set(current);
        next.delete(card.id);
        return next;
      });
    }
  }

  async function handleDeleteCharacter(card: CharacterCard) {
    if (
      pendingCharacterAction !== null ||
      deletingCardId !== null ||
      generatingCardIds.has(card.id)
    ) {
      return;
    }
    setDeletingCardId(card.id);
    setFeedback(null);
    try {
      const updatedProject = await apiClient.deleteCharacterCard(project.id, card.id);
      onProjectUpdated(updatedProject);
      setFeedback({ message: "角色卡已删除。", tone: "success" });
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setDeletingCardId(null);
    }
  }

  if (characterCards.length === 0) {
    return (
      <EmptyPanel
        action={
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <StageGenerateButton
              label="生成角色"
              onProjectUpdated={onProjectUpdated}
              project={project}
              stage="character"
            />
            <Button
              disabled={pendingCharacterAction !== null}
              onClick={handleSkipCharacters}
              type="button"
              variant="outline"
            >
              {pendingCharacterAction === "skip" ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <SkipForward aria-hidden="true" className="h-4 w-4" />
              )}
              无角色需求，跳过
            </Button>
          </div>
        }
        description={
          characterSkipped
            ? "该项目已确认无需角色，可继续后续创作流程。"
            : "请先在上方创作流程生成角色卡，成功后会在这里展示角色设定和 TOS 图片。"
        }
        icon={UserRound}
        title={characterSkipped ? "角色阶段已跳过" : "尚未生成角色"}
      />
    );
  }

  return (
    <div className="p-6 sm:p-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ad-kicker">Character Cards</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            角色设定
          </h2>
        </div>
        <Badge variant="info">{characterCards.length} 个角色</Badge>
      </div>
      {feedback ? (
        <IterationFeedback message={feedback.message} tone={feedback.tone} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {characterCards.map((card) => {
          const asset = card.asset_id ? assetsById.get(card.asset_id) : undefined;
          const previewUrl =
            asset && !failedImageAssetIds.has(asset.id)
              ? getSafePreviewUrl(asset)
              : null;
          const hasImage = Boolean(previewUrl);
          const isEditingName =
            editingField?.cardId === card.id && editingField.field === "name";
          const isEditingDescription =
            editingField?.cardId === card.id &&
            editingField.field === "description";
          const isSaving = savingCardId === card.id;
          const isGenerating = generatingCardIds.has(card.id);
          const isDeleting = deletingCardId === card.id;

          return (
            <article
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              key={card.id}
            >
              <div className="aspect-square overflow-hidden border-b border-border bg-secondary/50">
                {previewUrl ? (
                  <button
                    type="button"
                    className="block h-full w-full cursor-zoom-in"
                    onClick={() =>
                      setPreviewImage({ url: previewUrl, name: card.name })
                    }
                    aria-label={`放大查看${card.name}角色设定`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`${card.name}角色设定`}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                      onError={() => {
                        if (!asset) {
                          return;
                        }
                        setFailedImageAssetIds((current) => {
                          const next = new Set(current);
                          next.add(asset.id);
                          return next;
                        });
                      }}
                      src={previewUrl}
                    />
                  </button>
                ) : (
                  <div className="grid h-full place-items-center text-center text-muted-foreground">
                    <div>
                      <ImageIcon
                        aria-hidden="true"
                        className="mx-auto h-7 w-7 text-primary"
                      />
                      <p className="mt-2 text-xs">图片暂时无法预览</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {isEditingName ? (
                      <InlineCharacterEdit
                        ariaLabel="角色名称"
                        disabled={isSaving}
                        isSaving={isSaving}
                        onCancel={cancelEdit}
                        onChange={setDraftValue}
                        onSave={() => void saveCardField(card)}
                        value={draftValue}
                      />
                    ) : (
                      <h3
                        className="cursor-text break-words text-sm font-semibold text-foreground"
                        onDoubleClick={() => beginEdit(card, "name")}
                        title="双击编辑角色名称"
                      >
                        {card.name}
                      </h3>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <Button
                      disabled={isGenerating || isDeleting || isSaving}
                      onClick={() => void handleGenerateImage(card)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isGenerating ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="h-3.5 w-3.5 animate-spin"
                        />
                      ) : (
                        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      {hasImage ? "重新生成" : "形象生成"}
                    </Button>
                    <Button
                      disabled={isGenerating || isDeleting || isSaving}
                      onClick={() => void handleDeleteCharacter(card)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {isDeleting ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="h-3.5 w-3.5 animate-spin"
                        />
                      ) : (
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      删除
                    </Button>
                  </div>
                </div>

                <div className="mt-2.5 flex-1">
                  {isEditingDescription ? (
                    <InlineCharacterEdit
                      ariaLabel="角色描述"
                      disabled={isSaving}
                      isSaving={isSaving}
                      multiline
                      onCancel={cancelEdit}
                      onChange={setDraftValue}
                      onSave={() => void saveCardField(card)}
                      value={draftValue}
                    />
                  ) : (
                    <div className="flex items-start gap-1.5">
                      <p
                        className="cursor-text flex-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground line-clamp-3"
                        onDoubleClick={() => beginEdit(card, "description")}
                        title="双击编辑角色描述"
                      >
                        {card.description}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => beginEdit(card, "description")}
                        disabled={isGenerating || isDeleting || isSaving}
                        aria-label="编辑角色描述"
                        title="编辑角色描述"
                        type="button"
                      >
                        <PencilLine className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                <time
                  className="mt-3 block border-t border-border pt-3 text-[0.6875rem] text-muted-foreground"
                  dateTime={card.updated_at}
                  suppressHydrationWarning
                >
                  更新于 {formatDate(card.updated_at)}
                </time>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog
        open={previewImage !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImage(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
          <DialogTitle className="sr-only">
            {previewImage?.name} 角色预览
          </DialogTitle>
          {previewImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage.url}
              alt={`${previewImage.name}角色设定`}
              className="max-h-[85vh] w-full rounded-2xl object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InlineCharacterEdit({
  ariaLabel,
  disabled,
  isSaving,
  multiline = false,
  onCancel,
  onChange,
  onSave,
  value
}: {
  ariaLabel: string;
  disabled: boolean;
  isSaving: boolean;
  multiline?: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  value: string;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <form className="space-y-2" noValidate onSubmit={handleSubmit}>
      {multiline ? (
        <Textarea
          aria-label={ariaLabel}
          autoFocus
          disabled={disabled}
          maxLength={4000}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <input
          aria-label={ariaLabel}
          autoFocus
          className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          maxLength={120}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button
          disabled={disabled}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="ghost"
        >
          取消
        </Button>
        <Button disabled={disabled} size="sm" type="submit">
          {isSaving ? (
            <>
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              保存中
            </>
          ) : (
            "保存"
          )}
        </Button>
      </div>
    </form>
  );
}

function ComposePanel({
  onProjectUpdated,
  project
}: {
  onProjectUpdated: (project: Project) => void;
  project: Project;
}) {
  const [pendingDelete, setPendingDelete] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const finalVideo = latestFinalVideoAsset(project.assets);
  const previewUrl = finalVideo ? getSafePreviewUrl(finalVideo) : null;
  const previewStyle = getViewportBoundPreviewStyle(
    project.brief.aspect_ratio,
    52,
    32
  );

  async function handleDelete() {
    if (!finalVideo || pendingDelete) {
      return;
    }
    setPendingDelete(true);
    setFeedback(null);
    try {
      const updatedProject = await apiClient.deleteAsset(project.id, finalVideo.id);
      onProjectUpdated(updatedProject);
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingDelete(false);
    }
  }

  if (!finalVideo) {
    return (
      <EmptyPanel
        action={
          <StageGenerateButton
            label="生成剪辑成片"
            onProjectUpdated={onProjectUpdated}
            project={project}
            stage="compose"
          />
        }
        description="分镜视频完成后，可汇总全部镜头生成最终广告成片。"
        icon={Film}
        title="尚未生成剪辑成片"
      />
    );
  }

  return (
    <article className="p-6 sm:p-7">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ad-kicker">Final Composition</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            剪辑成片
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            查看最终视频资产，也可以重新剪辑或删除当前成片。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StageGenerateButton
            label="重新剪辑成片"
            onProjectUpdated={onProjectUpdated}
            project={project}
            stage="compose"
            variant="outline"
          />
          <Button
            disabled={pendingDelete}
            onClick={handleDelete}
            type="button"
            variant="ghost"
          >
            {pendingDelete ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            )}
            删除成片
          </Button>
        </div>
      </div>

      {feedback ? (
        <IterationFeedback message={feedback.message} tone={feedback.tone} />
      ) : null}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="grid min-h-48 place-items-center overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.16),transparent_62%),hsl(var(--secondary)/0.5)]">
          {previewUrl ? (
            <div
              className="grid max-w-full place-items-center overflow-hidden bg-black"
              data-testid="compose-video-preview-frame"
              style={previewStyle}
            >
              <video
                className="h-full w-full bg-black object-contain"
                controls
                preload="metadata"
                src={previewUrl}
              >
                当前浏览器不支持视频预览。
              </video>
            </div>
          ) : (
            <div className="grid aspect-video w-full max-w-3xl place-items-center px-6 text-center text-muted-foreground">
              <div>
                <PlayCircle aria-hidden="true" className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-sm">最终视频暂时无法预览。</p>
              </div>
            </div>
          )}
        </div>
        <dl className="grid content-start gap-3 rounded-2xl border border-border bg-card p-5 text-sm">
          <ShotField label="资产 ID" value={finalVideo.id} />
          <ShotField label="状态" value={finalVideo.status} />
          <ShotField
            label="类型"
            value={getWorkspaceAssetDescription(finalVideo)}
          />
          <ShotField
            label="更新时间"
            value={formatDate(finalVideo.updated_at)}
          />
        </dl>
      </div>
    </article>
  );
}

function StageGenerateButton({
  label,
  onProjectUpdated,
  onGenerate,
  project,
  stage,
  variant = "default"
}: {
  label: string;
  onProjectUpdated: (project: Project) => void;
  onGenerate?: () => Promise<void>;
  project: Project;
  stage: Exclude<Stage, "brief">;
  variant?: "default" | "outline";
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTask, setActiveTask] = useState<GenerationTask | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "info" | "success";
  } | null>(null);

  useEffect(() => {
    if (!activeTask || !POLLING_STATUSES.has(activeTask.status)) {
      return;
    }
    let cancelled = false;
    const timer = window.setInterval(() => {
      void apiClient
        .getTask(activeTask.id, { cache: "no-store" })
        .then(async (task) => {
          if (cancelled) {
            return;
          }
          setActiveTask(task);
          setFeedback({
            message: task.progress_message ?? "剪辑处理中，请稍候。",
            tone: "info"
          });
          if (TERMINAL_STATUSES.has(task.status)) {
            window.clearInterval(timer);
            if (task.status === "succeeded") {
              const freshProject = await apiClient.getProject(project.id, {
                cache: "no-store"
              });
              if (!cancelled) {
                onProjectUpdated(freshProject);
                setFeedback({
                  message: task.progress_message ?? "剪辑完成。",
                  tone: "success"
                });
                setIsGenerating(false);
              }
            } else if (!cancelled) {
              setFeedback({
                message:
                  task.error?.message ??
                  task.progress_message ??
                  "剪辑成片失败，请稍后重试。",
                tone: "error"
              });
              setIsGenerating(false);
            }
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          window.clearInterval(timer);
          setFeedback({
            message: getUserFacingErrorMessage(error),
            tone: "error"
          });
          setIsGenerating(false);
        });
    }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTask, onProjectUpdated, project.id]);

  async function handleGenerate() {
    if (isGenerating) {
      return;
    }
    setIsGenerating(true);
    setFeedback(null);
    try {
      if (onGenerate) {
        await onGenerate();
        setIsGenerating(false);
        return;
      }
      const task = await apiClient.generateStage(project.id, stage);
      setActiveTask(task);
      if (POLLING_STATUSES.has(task.status)) {
        setFeedback({
          message: task.progress_message ?? "剪辑处理中，请稍候。",
          tone: "info"
        });
        return;
      }
      const freshProject = await apiClient.getProject(project.id, {
        cache: "no-store"
      });
      onProjectUpdated(freshProject);
      setFeedback({
        message: task.progress_message ?? "生成任务已完成，项目详情已刷新。",
        tone: task.status === "failed" ? "error" : "success"
      });
      setIsGenerating(false);
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
      setIsGenerating(false);
    }
  }

  return (
    <div>
      <Button
        disabled={isGenerating}
        onClick={handleGenerate}
        type="button"
        variant={variant}
      >
        {isGenerating ? (
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
        )}
        {label}
      </Button>
      {feedback ? (
        <IterationFeedback message={feedback.message} tone={feedback.tone} />
      ) : null}
    </div>
  );
}

function IterationFeedback({
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
        "mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-5",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : tone === "success"
            ? "border-success/30 bg-success/10 text-success"
            : "border-info/30 bg-info/10 text-info"
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EmptyPanel({
  action,
  description,
  icon: Icon,
  title
}: {
  action?: ReactNode;
  description: string;
  icon: typeof ScrollText;
  title: string;
}) {
  return (
    <div className="p-6 sm:p-7">
      <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-12 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/[0.08] text-primary">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

function latestTextArtifact(
  artifacts: TextArtifact[],
  stage: Stage,
  options: {
    includeNonStale?: boolean;
    succeededOnly?: boolean;
  } = {}
): TextArtifact | undefined {
  return artifacts
    .filter((artifact) => {
      if (artifact.stage !== stage) {
        return false;
      }

      if (options.succeededOnly) {
        return artifact.status === "succeeded";
      }

      if (options.includeNonStale) {
        return artifact.status !== "stale";
      }

      return true;
    })
    .reduce<TextArtifact | undefined>((latest, artifact) => {
      if (!latest || artifact.version > latest.version) {
        return artifact;
      }
      if (
        artifact.version === latest.version &&
        artifact.updated_at > latest.updated_at
      ) {
        return artifact;
      }
      return latest;
    }, undefined);
}

function sortCharacterCards(cards: CharacterCard[]): CharacterCard[] {
  return [...cards].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    const createdCompare = left.created_at.localeCompare(right.created_at);
    return createdCompare === 0 ? left.id.localeCompare(right.id) : createdCompare;
  });
}

function latestFinalVideoAsset(assets: Asset[]): Asset | undefined {
  return assets
    .filter(
      (asset) =>
        asset.status === "succeeded" &&
        asset.type === "final_video" &&
        asset.mime_type?.startsWith("video/") === true
    )
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
}
