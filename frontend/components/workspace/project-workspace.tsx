"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ImageIcon,
  LoaderCircle,
  MonitorPlay,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import { ProjectEmptyState } from "@/components/project-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import { WorkspaceCreativeWorkflow } from "@/components/workspace/workspace-creative-workflow";
import { ImageProjectReadOnlyDetail } from "@/components/workspace/image-project-read-only-detail";
import {
  ProjectDetailTabs,
  type DetailTab
} from "@/components/workspace/project-detail-tabs";
import type {
  Brief,
  BriefCreate,
  ImagePurpose,
  Project,
  ProjectCreate,
  ProjectListItem,
  ProjectType,
  ProjectUpdate,
  TargetLanguage
} from "@/lib/api-types";
import {
  formatDate,
  getStageLabel,
  statusVariant
} from "@/lib/project-display";
import { useTextGenerationStream } from "@/lib/use-text-generation-stream";
import { cn } from "@/lib/utils";

const platformOptions = [
  { label: "抖音", value: "douyin" },
  { label: "小红书", value: "xiaohongshu" },
  { label: "TikTok", value: "tiktok" },
  { label: "Bilibili", value: "bilibili" },
  { label: "YouTube", value: "youtube" },
  { label: "淘宝", value: "taobao" },
  { label: "天猫", value: "tmall" },
  { label: "京东", value: "jd" },
  { label: "拼多多", value: "pinduoduo" },
  { label: "抖音商城", value: "douyin_shop" },
  { label: "其他", value: "other" }
];

const aspectRatioOptions: Array<{
  label: string;
  value: Brief["aspect_ratio"];
}> = [
  { label: "9:16 竖屏", value: "9:16" },
  { label: "16:9 横屏", value: "16:9" },
  { label: "1:1 方形", value: "1:1" },
  { label: "4:3 横版", value: "4:3" },
  { label: "3:4 竖版", value: "3:4" }
];

const targetLanguageOptions: Array<{
  label: string;
  value: TargetLanguage;
}> = [
  { label: "中文", value: "zh" },
  { label: "英文", value: "en" }
];

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm transition-all focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

const projectListFilters = [
  {
    icon: FolderKanban,
    label: "全部项目",
    value: "all"
  },
  {
    icon: MonitorPlay,
    label: "视频项目",
    value: "video_ad"
  },
  {
    icon: ImageIcon,
    label: "图片",
    value: "image_asset"
  }
] as const;

type ProjectListFilter = (typeof projectListFilters)[number]["value"];

interface ProjectWorkspaceProps {
  initialError?: string;
  initialProjects: ProjectListItem[];
}

export function ProjectWorkspace({
  initialError,
  initialProjects
}: ProjectWorkspaceProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [loadError, setLoadError] = useState(initialError ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [projectListFilter, setProjectListFilter] =
    useState<ProjectListFilter>("all");
  const [pendingDelete, setPendingDelete] =
    useState<ProjectListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [listFeedback, setListFeedback] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const listRequestSequence = useRef(0);
  const hasMountedSearch = useRef(false);
  const filteredProjects = projects.filter(
    (project) =>
      projectListFilter === "all" ||
      project.project_type === projectListFilter
  );
  const projectCounts = {
    all: projects.length,
    image_asset: projects.filter(
      (project) => project.project_type === "image_asset"
    ).length,
    video_ad: projects.filter((project) => project.project_type === "video_ad")
      .length
  } satisfies Record<ProjectListFilter, number>;

  useEffect(() => {
    if (!hasMountedSearch.current) {
      hasMountedSearch.current = true;
      return;
    }

    const requestId = listRequestSequence.current + 1;
    listRequestSequence.current = requestId;
    const timeoutId = window.setTimeout(async () => {
      if (listRequestSequence.current !== requestId) {
        return;
      }

      const keyword = searchQuery.trim();
      setIsSearching(true);
      setSearchError(null);
      setListFeedback(null);

      try {
        const nextProjects = keyword
          ? await apiClient.listProjects(keyword, { cache: "no-store" })
          : await apiClient.listProjects({ cache: "no-store" });

        if (listRequestSequence.current === requestId) {
          setProjects(nextProjects);
        }
      } catch (error) {
        if (listRequestSequence.current === requestId) {
          setSearchError(getUserFacingErrorMessage(error));
        }
      } finally {
        if (listRequestSequence.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  async function handleSelectProject(projectId: string) {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setSelectedProjectId(projectId);
    setSelectedProject(null);
    setIsCreating(false);
    setIsLoadingProject(true);
    setLoadError(null);

    try {
      const project = await apiClient.getProject(projectId, {
        cache: "no-store"
      });

      if (requestSequence.current === requestId) {
        setSelectedProject(project);
      }
    } catch (error) {
      if (requestSequence.current === requestId) {
        setLoadError(getUserFacingErrorMessage(error));
      }
    } finally {
      if (requestSequence.current === requestId) {
        setIsLoadingProject(false);
      }
    }
  }

  function handleStartCreate() {
    requestSequence.current += 1;
    setSelectedProjectId(null);
    setSelectedProject(null);
    setIsLoadingProject(false);
    setIsCreating(true);
    setLoadError(null);
  }

  function handleCreated(project: Project) {
    listRequestSequence.current += 1;
    setIsSearching(false);
    setSearchError(null);
    setProjects((current) => {
      const item = toProjectListItem(project);
      return projectMatchesKeyword(item, searchQuery)
        ? [item, ...current.filter((candidate) => candidate.id !== item.id)]
        : current;
    });
    setSelectedProjectId(project.id);
    setSelectedProject(project);
    setIsCreating(false);
    setProjectListFilter(project.project_type);
  }

  function handleUpdated(project: Project) {
    setProjects((current) =>
      current.map((item) =>
        item.id === project.id ? toProjectListItem(project) : item
      )
    );
    setSelectedProject(project);
  }

  async function handleSearchRetry() {
    const requestId = listRequestSequence.current + 1;
    const keyword = searchQuery.trim();
    listRequestSequence.current = requestId;
    setIsSearching(true);
    setSearchError(null);
    setListFeedback(null);

    try {
      const nextProjects = keyword
        ? await apiClient.listProjects(keyword, { cache: "no-store" })
        : await apiClient.listProjects({ cache: "no-store" });

      if (listRequestSequence.current === requestId) {
        setProjects(nextProjects);
      }
    } catch (error) {
      if (listRequestSequence.current === requestId) {
        setSearchError(getUserFacingErrorMessage(error));
      }
    } finally {
      if (listRequestSequence.current === requestId) {
        setIsSearching(false);
      }
    }
  }

  function handleDeleteDialogChange(open: boolean) {
    if (!open && !isDeleting) {
      setPendingDelete(null);
      setDeleteError(null);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || isDeleting) {
      return;
    }

    const projectToDelete = pendingDelete;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.deleteProject(projectToDelete.id);
      listRequestSequence.current += 1;
      setIsSearching(false);
      setProjects((current) =>
        current.filter((project) => project.id !== projectToDelete.id)
      );

      if (selectedProjectId === projectToDelete.id) {
        requestSequence.current += 1;
        setSelectedProjectId(null);
        setSelectedProject(null);
        setIsLoadingProject(false);
        setLoadError(null);
      }

      setPendingDelete(null);
      setListFeedback(`已从项目列表隐藏“${projectToDelete.name}”。`);
    } catch (error) {
      setDeleteError(getUserFacingErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section
      aria-labelledby="workspace-page-title"
      className="w-full max-w-none px-3 py-6 sm:px-4 sm:py-8 lg:px-5"
    >
      <div className="flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="ad-kicker">Workspace / Projects</p>
          <h1
            className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl"
            id="workspace-page-title"
          >
            项目
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            集中管理广告视频与图片素材项目，维护 Brief 和当前创作状态。
          </p>
        </div>
        <Button
          className="h-11 rounded-xl px-5"
          onClick={handleStartCreate}
          type="button"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          新建项目
        </Button>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside
          aria-label="项目列表"
          className="rounded-3xl border border-border bg-card p-4 shadow-glass"
        >
          <div className="flex items-center justify-between gap-3 px-2 pb-4">
            <div>
              <h2 className="font-semibold text-foreground">
                {
                  projectListFilters.find(
                    (filter) => filter.value === projectListFilter
                  )?.label
                }
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {filteredProjects.length} 个项目
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/[0.08] text-primary">
              <FolderKanban aria-hidden="true" className="h-5 w-5" />
            </div>
          </div>

          <div
            aria-label="项目分类"
            className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-secondary/65 p-1"
            role="tablist"
          >
            {projectListFilters.map((filter) => {
              const Icon = filter.icon;
              const isActive = projectListFilter === filter.value;
              return (
                <button
                  aria-label={`${filter.label}（${projectCounts[filter.value]} 个项目）`}
                  aria-selected={isActive}
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                    isActive
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  )}
                  key={filter.value}
                  onClick={() => setProjectListFilter(filter.value)}
                  role="tab"
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{filter.label.replace("项目", "")}</span>
                  <span className="text-[10px] tabular-nums">
                    {projectCounts[filter.value]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative mb-3">
            <label className="sr-only" htmlFor="project-search">
              搜索项目
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-9 pl-9 pr-9 text-sm"
              id="project-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索项目"
              type="search"
              value={searchQuery}
            />
            {searchQuery ? (
              <button
                aria-label="清空项目搜索"
                className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                onClick={() => setSearchQuery("")}
                title="清空搜索"
                type="button"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {isSearching ? (
            <div
              className="mb-3 flex items-center gap-2 px-2 text-xs text-muted-foreground"
              role="status"
            >
              <LoaderCircle
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin"
              />
              正在搜索项目...
            </div>
          ) : null}

          {searchError ? (
            <div
              className="mb-3 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-3 text-xs text-destructive"
              role="alert"
            >
              <p>{searchError}</p>
              <Button
                className="mt-2 h-7 px-2 text-xs"
                disabled={isSearching}
                onClick={handleSearchRetry}
                type="button"
                variant="outline"
              >
                <RotateCcw aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                重试
              </Button>
            </div>
          ) : null}

          {listFeedback ? (
            <p
              className="mb-3 rounded-xl border border-success/25 bg-success/[0.06] px-3 py-2 text-xs text-success"
              role="status"
            >
              {listFeedback}
            </p>
          ) : null}

          {filteredProjects.length > 0 ? (
            <div className="grid max-h-[calc(100vh-15rem)] gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-1">
              {filteredProjects.map((project) => (
                <ProjectListButton
                  isSelected={selectedProjectId === project.id && !isCreating}
                  key={project.id}
                  onDelete={setPendingDelete}
                  onSelect={handleSelectProject}
                  project={project}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {searchQuery.trim()
                  ? "未找到匹配项目"
                  : projectListFilter === "all"
                    ? "暂无项目"
                    : `暂无${projectListFilter === "video_ad" ? "视频项目" : "图片"}`}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {searchQuery.trim()
                  ? "请尝试其他关键词，或切换项目分类查看。"
                  : projectListFilter === "all"
                    ? "新建首个项目后会显示在这里。"
                    : "可切换分类，或新建对应类型的项目。"}
              </p>
            </div>
          )}
        </aside>

        <div className="min-w-0">
          {isCreating ? (
            <ProjectEditor
              key="create-project"
              mode="create"
              onCancel={() => setIsCreating(false)}
              onCreated={handleCreated}
            />
          ) : isLoadingProject ? (
            <ProjectLoadingState />
          ) : loadError ? (
            <ProjectLoadError
              message={loadError}
              onRetry={
                selectedProjectId
                  ? () => handleSelectProject(selectedProjectId)
                  : undefined
              }
            />
          ) : selectedProject ? (
            <ProjectDetail
              key={selectedProject.id}
              onUpdated={handleUpdated}
              project={selectedProject}
            />
          ) : projects.length === 0 ? (
            <ProjectEmptyState
              action={
                <Button onClick={handleStartCreate} type="button">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  新建第一个项目
                </Button>
              }
              description="从一份清晰的广告 Brief 开始，创建后即可在这里继续维护项目信息。"
              title="还没有广告项目"
            />
          ) : (
            <ProjectEmptyState
              description="从左侧选择一个项目，系统会加载完整详情与关键摘要。"
              title="选择项目查看详情"
            />
          )}
        </div>
      </div>

      <Dialog
        onOpenChange={handleDeleteDialogChange}
        open={pendingDelete !== null}
      >
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>从列表中删除项目</DialogTitle>
            <DialogDescription>
              确认删除“{pendingDelete?.name}”？项目仅会从前端项目列表中隐藏，
              后端已生成的素材与产物将继续保留。
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p
              className="mt-1 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-3 text-sm text-destructive"
              role="alert"
            >
              {deleteError}
            </p>
          ) : null}
          <DialogFooter className="mt-5">
            <DialogClose asChild>
              <Button disabled={isDeleting} type="button" variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              type="button"
              variant="destructive"
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ProjectListButton({
  isSelected,
  onDelete,
  onSelect,
  project
}: {
  isSelected: boolean;
  onDelete: (project: ProjectListItem) => void;
  onSelect: (projectId: string) => void;
  project: ProjectListItem;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-2xl border transition-all",
        isSelected
          ? "border-primary/35 bg-primary/[0.07] shadow-[inset_3px_0_0_hsl(var(--primary))]"
          : "border-transparent bg-secondary/35 hover:border-primary/20 hover:bg-primary/[0.035]"
      )}
    >
      <button
        aria-pressed={isSelected}
        className="w-full rounded-2xl p-4 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        onClick={() => onSelect(project.id)}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <h3
            className="line-clamp-2 font-semibold leading-5 text-foreground"
            id={`project-list-name-${project.id}`}
          >
            {project.name}
          </h3>
          <Badge className="shrink-0" variant={statusVariant(project.status)}>
            {project.status}
          </Badge>
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {project.brief.prompt}
        </p>
        <Badge className="mt-3" variant="outline">
          {getProjectTypeLabel(project)}
        </Badge>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {getStageLabel(project.current_stage)} · {project.brief.aspect_ratio}
          </span>
          <time dateTime={project.updated_at} suppressHydrationWarning>
            {formatDate(project.updated_at)}
          </time>
        </div>
      </button>
      <button
        aria-describedby={`project-list-name-${project.id}`}
        aria-label="删除项目"
        className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-70 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/25 group-hover:opacity-100"
        onClick={() => onDelete(project)}
        title={`删除项目“${project.name}”`}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProjectDetail({
  onUpdated,
  project
}: {
  onUpdated: (project: Project) => void;
  project: Project;
}) {
  return project.project_type === "image_asset" ? (
    <ImageProjectDetail onUpdated={onUpdated} project={project} />
  ) : (
    <VideoProjectDetail onUpdated={onUpdated} project={project} />
  );
}

function VideoProjectDetail({
  onUpdated,
  project
}: {
  onUpdated: (project: Project) => void;
  project: Project;
}) {
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>(() =>
    initialDetailTab(project)
  );
  const textGeneration = useTextGenerationStream({
    onProjectUpdated: onUpdated,
    onStageStart: setActiveDetailTab,
    project
  });

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-glass">
        <div className="grid gap-5 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">
                <MonitorPlay aria-hidden="true" className="h-3.5 w-3.5" />
                广告视频
              </Badge>
              <Badge variant={statusVariant(project.status)}>
                {project.status}
              </Badge>
              <Badge variant="secondary">
                {getStageLabel(project.current_stage)}
              </Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-3xl">
              {project.name}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              {project.brief.summary ?? project.brief.prompt}
            </p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.045] px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Clock3 aria-hidden="true" className="h-4 w-4 text-primary" />
              最近更新
            </div>
            <time
              className="mt-1 block"
              dateTime={project.updated_at}
              suppressHydrationWarning
            >
              {formatDate(project.updated_at)}
            </time>
          </div>
        </div>
        <div className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-5">
          <SummaryItem label="投放平台" value={project.brief.target_platform} />
          <SummaryItem
            label="目标语言"
            value={getTargetLanguageLabel(project.brief.target_language)}
          />
          <SummaryItem label="画面规格" value={project.brief.aspect_ratio} />
          <SummaryItem
            label="视频时长"
            value={`${project.brief.duration_seconds} 秒`}
          />
          <SummaryItem
            label="商品名称"
            value={project.brief.product_name ?? "未填写"}
          />
        </div>
      </div>

      <WorkspaceCreativeWorkflow
        activeDetailTab={activeDetailTab}
        onDetailTabChange={setActiveDetailTab}
        onProjectUpdated={onUpdated}
        project={project}
        textGeneration={textGeneration}
      />

      <ProjectDetailTabs
        activeTab={activeDetailTab}
        briefPanel={
          <ProjectBriefPanel onUpdated={onUpdated} project={project} />
        }
        key={project.id}
        onActiveTabChange={setActiveDetailTab}
        onProjectUpdated={onUpdated}
        project={project}
        textGeneration={textGeneration}
      />
    </div>
  );
}

function ImageProjectDetail({
  onUpdated,
  project
}: {
  onUpdated: (project: Project) => void;
  project: Project;
}) {
  return <ImageProjectReadOnlyDetail onProjectUpdated={onUpdated} project={project} />;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border px-5 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(even)]:border-r-0 lg:border-b-0 lg:[&:nth-child(even)]:border-r lg:last:border-r-0">
      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function initialDetailTab(project: Project): DetailTab {
  if (
    project.current_stage === "video" ||
    project.assets.some((asset) => asset.type === "storyboard_video")
  ) {
    return "storyboardVideo";
  }
  if (project.current_stage === "compose") {
    return "compose";
  }
  return "brief";
}

type EditorValues = {
  projectType: ProjectType;
  imagePurpose: ImagePurpose;
  name: string;
  prompt: string;
  targetPlatform: string;
  targetLanguage: TargetLanguage;
  aspectRatio: Brief["aspect_ratio"];
  durationSeconds: string;
  productName: string;
  style: string;
  audience: string;
  sellingPoints: string;
};

type EditorErrors = Partial<Record<keyof EditorValues, string>>;

type ProjectEditorProps = (
  | {
      mode: "create";
      onCancel: () => void;
      onCreated: (project: Project) => void;
      onUpdated?: never;
      project?: never;
    }
  | {
      mode: "edit";
      onCancel: () => void;
      onCreated?: never;
      onUpdated: (project: Project) => void;
      project: Project;
    }
) & {
  presentation?: "dialog" | "panel";
};

function ProjectBriefPanel({
  onUpdated,
  project
}: {
  onUpdated: (project: Project) => void;
  project: Project;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <ProjectEditor
        key={`${project.id}:edit`}
        mode="edit"
        onCancel={() => setIsEditing(false)}
        onUpdated={(updatedProject) => {
          onUpdated(updatedProject);
          setIsEditing(false);
        }}
        project={project}
      />
    );
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-glass">
      <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
        <div>
          <p className="ad-kicker">Project Brief</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
            项目与 Brief
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            默认查看当前项目需求，点击编辑后可修改并保存。
          </p>
        </div>
        <Button onClick={() => setIsEditing(true)} type="button" variant="outline">
          <PencilLine aria-hidden="true" className="h-4 w-4" />
          编辑 Brief
        </Button>
      </div>

      <div className="space-y-6 p-6 sm:p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <BriefInfoItem label="项目名称" value={project.name} />
          <BriefInfoItem label="项目类型" value={getProjectTypeLabel(project)} />
          <BriefInfoItem label="投放平台" value={project.brief.target_platform} />
          <BriefInfoItem
            label="目标语言"
            value={getTargetLanguageLabel(project.brief.target_language)}
          />
          <BriefInfoItem label="画面比例" value={project.brief.aspect_ratio} />
          {project.project_type === "video_ad" ? (
            <BriefInfoItem
              label="视频时长"
              value={`${project.brief.duration_seconds} 秒`}
            />
          ) : (
            <BriefInfoItem
              label="图片用途"
              value={getProjectTypeLabel(project)}
            />
          )}
          <BriefInfoItem
            label="商品名称"
            value={project.brief.product_name ?? "未填写"}
          />
          <BriefInfoItem
            label="视觉风格"
            value={project.brief.style ?? "未填写"}
          />
          <BriefInfoItem
            label="目标受众"
            value={project.brief.audience ?? "未填写"}
          />
        </div>

        <section className="rounded-2xl border border-border bg-secondary/30 p-5">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-muted-foreground">
            广告需求
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">
            {project.brief.prompt}
          </p>
        </section>

        {project.brief.summary ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-muted-foreground">
              Brief 摘要
            </p>
            <p className="mt-3 text-sm leading-7 text-foreground">
              {project.brief.summary}
            </p>
          </section>
        ) : null}

        {project.brief.selling_points.length > 0 ? (
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-muted-foreground">
              核心卖点
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.brief.selling_points.map((point) => (
                <Badge key={point} variant="secondary">
                  {point}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function BriefInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-4">
      <p className="font-mono text-[0.64rem] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-foreground">
        {value}
      </p>
    </div>
  );
}

function ProjectEditor(props: ProjectEditorProps) {
  const isDialog = props.presentation === "dialog";
  const [values, setValues] = useState<EditorValues>(() =>
    editorValuesFromProject(props.project)
  );
  const [errors, setErrors] = useState<EditorErrors>({});
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function updateValue<Key extends keyof EditorValues>(
    key: Key,
    value: EditorValues[Key]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFeedback(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const nextErrors = validateEditor(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFeedback({
        message: "请检查标记的字段后再保存。",
        tone: "error"
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      if (props.mode === "create") {
        const project = await apiClient.createProject(toCreatePayload(values));
        props.onCreated(project);
      } else {
        const project = await apiClient.updateProject(
          props.project.id,
          toUpdatePayload(values)
        );
        setValues(editorValuesFromProject(project));
        props.onUpdated(project);
        setFeedback({ message: "项目与 Brief 已保存。", tone: "success" });
      }
    } catch (error) {
      setFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className={cn(
        "min-h-0 overflow-hidden bg-card",
        isDialog
          ? "h-full"
          : "rounded-3xl border border-border shadow-glass"
      )}
      noValidate
      onSubmit={handleSubmit}
    >
      {isDialog ? null : (
        <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="ad-kicker">
              {props.mode === "create" ? "New Project" : "Project Brief"}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
              {props.mode === "create" ? "新建广告项目" : "编辑项目与 Brief"}
            </h2>
          </div>
          {props.mode === "edit" ? (
            <Badge variant="info">9 个可编辑字段</Badge>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          "space-y-6 p-5 sm:p-7",
          isDialog && "h-full overflow-y-auto"
        )}
        data-testid={isDialog ? "brief-dialog-scroll-region" : undefined}
      >
        {props.mode === "create" ? (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">项目类型</legend>
            <div
              aria-label="项目类型"
              className="grid grid-cols-2 rounded-xl border border-border bg-secondary/45 p-1"
              role="group"
            >
              {([
                {
                  icon: MonitorPlay,
                  label: "广告视频",
                  value: "video_ad"
                },
                {
                  icon: ImageIcon,
                  label: "图片素材",
                  value: "image_asset"
                }
              ] as const).map((option) => {
                const Icon = option.icon;
                const selected = values.projectType === option.value;
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition",
                      selected
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    key={option.value}
                    onClick={() =>
                      updateValue("projectType", option.value)
                    }
                    type="button"
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <Badge variant="outline">{getProjectTypeLabel(props.project)}</Badge>
        )}

        <FormField error={errors.name} label="项目名称" name="project-name">
          <Input
            aria-invalid={Boolean(errors.name)}
            id="project-name"
            maxLength={120}
            onChange={(event) => updateValue("name", event.target.value)}
            placeholder="例如：秋季便携咖啡机投放"
            value={values.name}
          />
        </FormField>

        <FormField error={errors.prompt} label="广告需求" name="project-prompt">
          <Textarea
            aria-invalid={Boolean(errors.prompt)}
            className="min-h-32 resize-y"
            id="project-prompt"
            onChange={(event) => updateValue("prompt", event.target.value)}
            placeholder="描述投放目标、核心卖点、内容结构和必须出现的场景。"
            value={values.prompt}
          />
        </FormField>

        <div className="grid gap-5 md:grid-cols-2">
          {values.projectType === "image_asset" ? (
            <FormField
              error={errors.imagePurpose}
              label="图片用途"
              name="project-image-purpose"
            >
              <select
                aria-invalid={Boolean(errors.imagePurpose)}
                className={selectClassName}
                id="project-image-purpose"
                onChange={(event) =>
                  updateValue(
                    "imagePurpose",
                    event.target.value as ImagePurpose
                  )
                }
                value={values.imagePurpose}
              >
                <option value="ecommerce_main">电商主图</option>
                <option value="poster">海报</option>
              </select>
            </FormField>
          ) : null}

          <FormField
            error={errors.targetPlatform}
            label="投放平台"
            name="project-platform"
          >
            <select
              aria-invalid={Boolean(errors.targetPlatform)}
              className={selectClassName}
              id="project-platform"
              onChange={(event) =>
                updateValue("targetPlatform", event.target.value)
              }
              value={values.targetPlatform}
            >
              {platformOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={errors.aspectRatio}
            label="画面比例"
            name="project-aspect-ratio"
          >
            <select
              aria-invalid={Boolean(errors.aspectRatio)}
              className={selectClassName}
              id="project-aspect-ratio"
              onChange={(event) =>
                updateValue(
                  "aspectRatio",
                  event.target.value as Brief["aspect_ratio"]
                )
              }
              value={values.aspectRatio}
            >
              {aspectRatioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            error={errors.targetLanguage}
            label="目标语言"
            name="project-target-language"
          >
            <select
              aria-invalid={Boolean(errors.targetLanguage)}
              className={selectClassName}
              id="project-target-language"
              onChange={(event) =>
                updateValue(
                  "targetLanguage",
                  event.target.value as TargetLanguage
                )
              }
              value={values.targetLanguage}
            >
              {targetLanguageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          {values.projectType === "video_ad" ? (
            <FormField
              error={errors.durationSeconds}
              label="视频时长（秒）"
              name="project-duration"
            >
              <Input
                aria-invalid={Boolean(errors.durationSeconds)}
                id="project-duration"
                inputMode="numeric"
                max={300}
                min={1}
                onChange={(event) =>
                  updateValue("durationSeconds", event.target.value)
                }
                type="number"
                value={values.durationSeconds}
              />
            </FormField>
          ) : null}

          <FormField
            error={errors.productName}
            label="商品名称"
            name="project-product-name"
          >
            <Input
              aria-invalid={Boolean(errors.productName)}
              id="project-product-name"
              onChange={(event) => updateValue("productName", event.target.value)}
              placeholder="例如：AeroPress Go"
              value={values.productName}
            />
          </FormField>

          <FormField label="视觉风格" name="project-style">
            <Input
              id="project-style"
              onChange={(event) => updateValue("style", event.target.value)}
              placeholder="例如：真实生活流、自然晨光"
              value={values.style}
            />
          </FormField>

          <FormField
            error={errors.audience}
            label="目标受众"
            name="project-audience"
          >
            <Input
              aria-invalid={Boolean(errors.audience)}
              id="project-audience"
              onChange={(event) => updateValue("audience", event.target.value)}
              placeholder="例如：一线城市通勤白领"
              value={values.audience}
            />
          </FormField>
        </div>

        <FormField
          error={errors.sellingPoints}
          label="核心卖点（每行一项）"
          name="project-selling-points"
        >
          <Textarea
            aria-invalid={Boolean(errors.sellingPoints)}
            className="min-h-24 resize-y"
            id="project-selling-points"
            onChange={(event) =>
              updateValue("sellingPoints", event.target.value)
            }
            placeholder="便携轻巧&#10;快速冲泡"
            value={values.sellingPoints}
          />
        </FormField>

        {feedback ? (
          <EditorFeedback message={feedback.message} tone={feedback.tone} />
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          {props.mode === "create" || props.mode === "edit" ? (
            <Button
              disabled={isSaving}
              onClick={props.onCancel}
              type="button"
              variant="ghost"
            >
              {props.mode === "create" ? "取消" : "关闭编辑"}
            </Button>
          ) : null}
          <Button
            className="min-w-32"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
                {props.mode === "create" ? "创建中" : "保存中"}
              </>
            ) : props.mode === "create" ? (
              "创建项目"
            ) : (
              "保存修改"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

function FormField({
  children,
  error,
  label,
  name
}: {
  children: ReactNode;
  error?: string;
  label: string;
  name: string;
}) {
  const errorId = `${name}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <div aria-describedby={error ? errorId : undefined}>{children}</div>
      {error ? (
        <p className="text-xs leading-5 text-destructive" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EditorFeedback({
  message,
  tone
}: {
  message: string;
  tone: "error" | "success";
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm leading-6",
        tone === "success"
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
      role={tone === "success" ? "status" : "alert"}
    >
      <Icon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function ProjectLoadingState() {
  return (
    <div
      className="grid min-h-[32rem] place-items-center rounded-3xl border border-border bg-card shadow-glass"
      role="status"
    >
      <div className="text-center">
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto h-7 w-7 animate-spin text-primary"
        />
        <p className="mt-3 text-sm text-muted-foreground">正在加载项目详情...</p>
      </div>
    </div>
  );
}

function ProjectLoadError({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="rounded-3xl border border-destructive/30 bg-destructive/10 p-7"
      role="alert"
    >
      <AlertCircle aria-hidden="true" className="h-6 w-6 text-destructive" />
      <h2 className="mt-4 text-xl font-semibold text-foreground">
        项目数据暂时无法加载
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button
          className="mt-5"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          重新加载
        </Button>
      ) : null}
    </div>
  );
}

function editorValuesFromProject(project?: Project): EditorValues {
  return {
    aspectRatio: project?.brief.aspect_ratio ?? "9:16",
    audience: project?.brief.audience ?? "",
    durationSeconds: String(project?.brief.duration_seconds ?? 30),
    imagePurpose: project?.brief.image_purpose ?? "ecommerce_main",
    name: project?.name ?? "",
    productName: project?.brief.product_name ?? "",
    projectType: project?.project_type ?? "video_ad",
    prompt: project?.brief.prompt ?? "",
    sellingPoints: project?.brief.selling_points.join("\n") ?? "",
    style: project?.brief.style ?? "",
    targetLanguage: project?.brief.target_language ?? "zh",
    targetPlatform: project?.brief.target_platform ?? "douyin"
  };
}

function validateEditor(values: EditorValues): EditorErrors {
  const errors: EditorErrors = {};
  const durationSeconds = Number(values.durationSeconds);

  if (values.name.trim().length === 0) {
    errors.name = "请输入项目名称。";
  } else if (values.name.trim().length > 120) {
    errors.name = "项目名称不能超过 120 个字符。";
  }

  if (values.projectType === "video_ad" && values.prompt.trim().length === 0) {
    errors.prompt = "请输入广告需求。";
  }

  if (
    values.projectType === "video_ad" &&
    values.targetPlatform.trim().length === 0
  ) {
    errors.targetPlatform = "请选择投放平台。";
  }

  if (
    values.projectType === "video_ad" &&
    !aspectRatioOptions.some((option) => option.value === values.aspectRatio)
  ) {
    errors.aspectRatio = "请选择有效的画面比例。";
  }

  if (
    values.projectType === "video_ad" &&
    !targetLanguageOptions.some(
      (option) => option.value === values.targetLanguage
    )
  ) {
    errors.targetLanguage = "请选择有效的目标语言。";
  }

  if (
    values.projectType === "video_ad" &&
    (!Number.isInteger(durationSeconds) ||
      durationSeconds < 1 ||
      durationSeconds > 300)
  ) {
    errors.durationSeconds = "视频时长需为 1 至 300 秒的整数。";
  }

  return errors;
}

function toBriefPayload(values: EditorValues): BriefCreate {
  return {
    aspect_ratio: values.aspectRatio,
    audience: toOptionalValue(values.audience),
    duration_seconds:
      values.projectType === "video_ad"
        ? Number(values.durationSeconds)
        : null,
    image_purpose:
      values.projectType === "image_asset" ? values.imagePurpose : null,
    product_name: toOptionalValue(values.productName),
    prompt: values.prompt.trim(),
    selling_points: parseSellingPoints(values.sellingPoints),
    style: toOptionalValue(values.style),
    target_language: values.targetLanguage,
    target_platform: values.targetPlatform.trim()
  };
}

function toCreatePayload(values: EditorValues): ProjectCreate {
  return {
    brief: toBriefPayload(values),
    name: values.name.trim(),
    project_type: values.projectType
  };
}

function toUpdatePayload(values: EditorValues): ProjectUpdate {
  return {
    brief: toBriefPayload(values),
    name: values.name.trim()
  };
}

function toOptionalValue(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseSellingPoints(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTargetLanguageLabel(targetLanguage: TargetLanguage): string {
  return targetLanguageOptions.find((option) => option.value === targetLanguage)!
    .label;
}

function getProjectTypeLabel(
  project: Pick<Project, "project_type" | "brief">
): string {
  if (project.project_type === "video_ad") {
    return "广告视频";
  }
  return project.brief.image_purpose === "poster" ? "海报" : "电商主图";
}

function toProjectListItem(project: Project): ProjectListItem {
  return {
    brief: project.brief,
    created_at: project.created_at,
    current_stage: project.current_stage,
    current_image_asset_id: project.current_image_asset_id,
    current_image_prompt_version_id: project.current_image_prompt_version_id,
    id: project.id,
    image_prompt_status: project.image_prompt_status,
    image_revision: project.image_revision,
    name: project.name,
    project_type: project.project_type,
    status: project.status,
    updated_at: project.updated_at
  };
}

function projectMatchesKeyword(project: ProjectListItem, keyword: string) {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return [
    project.name,
    project.brief.prompt,
    project.brief.summary,
    project.brief.product_name
  ].some((value) => value?.toLocaleLowerCase().includes(normalizedKeyword));
}
