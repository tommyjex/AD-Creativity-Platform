"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  ImageIcon,
  LayoutGrid,
  Maximize2,
  Music2,
  Package,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Wrench,
  X
} from "lucide-react";
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
import { createApiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import {
  ASSET_SECTIONS,
  ASSET_SIDEBAR_OPTIONS,
  artifactMatchesKeyword,
  assetMatchesKeyword,
  buildArtifactItems,
  getAssetDownloadUrl,
  getArtifactKindLabel,
  getArtifactKindTypeLabel,
  getAssetSectionDescription,
  getAssetSectionLabel,
  getAssetSidebarLabel,
  getImageOperationLabel,
  getSafeLastFrameUrl,
  getSafePreviewUrl,
  getStatusLabel,
  getWorkspaceAssetDescription,
  isImageProductAsset,
  partitionWorkspaceAssets,
  validateAssetDisplayName,
  type ArtifactDisplayItem,
  type AssetSection,
  type AssetSidebarOption
} from "@/lib/asset-display";
import type {
  Asset,
  ProjectListItem,
  Status,
  ToolAssetRole,
  ToolTask,
  ToolTaskType
} from "@/lib/api-types";
import { STATUSES } from "@/lib/api-types";
import { formatDate, statusVariant } from "@/lib/project-display";
import { cn } from "@/lib/utils";
import type {
  WorkspaceAssetFilters,
  WorkspaceAssetSource
} from "@/lib/workspace-asset-source";

const PAGE_SIZE = 30;
const ASSET_CARD_CLASS_NAME =
  "group relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-glass";
const ASSET_GRID_CLASS_NAME =
  "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";

const selectClassName =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/15";

const SECTION_ICONS = {
  artifacts: Film,
  character: UserRound,
  product: Package,
  scene: Sparkles
} as const;

const SIDEBAR_ICONS = {
  all: LayoutGrid,
  artifacts: Film,
  character: UserRound,
  product: Package,
  scene: Sparkles
} as const satisfies Record<AssetSidebarOption, typeof LayoutGrid>;

interface WorkspaceAssetLibraryProps {
  assets: Asset[];
  error?: string;
  filters: WorkspaceAssetFilters;
  projects: ProjectListItem[];
  toolTasks?: ToolTask[];
}

interface DeleteTarget {
  assetId: string;
  isToolAsset: boolean;
  label: string;
  isLastFrame: boolean;
  projectId: string | null;
}

interface PreviewTarget {
  asset?: Asset;
  assetRole?: string;
  assetSource?: string;
  createdAt: string;
  downloadUrl?: string | null;
  isAudio?: boolean;
  isVideo: boolean;
  projectName: string;
  status: Status;
  title: string;
  typeLabel: string;
  url: string;
}

export function WorkspaceAssetLibrary({
  assets: initialAssets,
  error,
  filters,
  projects,
  toolTasks = []
}: WorkspaceAssetLibraryProps) {
  const [assets, setAssets] = useState(initialAssets);
  const [prevInitialAssets, setPrevInitialAssets] = useState(initialAssets);
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [pendingPreview, setPendingPreview] = useState<PreviewTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingRename, setPendingRename] = useState<Asset | null>(null);
  const [renameName, setRenameName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameRequestInFlightRef = useRef(false);

  // A new server render (e.g. after filter change) supplies a fresh assets
  // array; resync local state during render rather than in an effect.
  if (prevInitialAssets !== initialAssets) {
    setPrevInitialAssets(initialAssets);
    setAssets(initialAssets);
  }

  const api = useMemo(() => createApiClient(), []);
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  );
  const toolTasksById = useMemo(
    () => new Map(toolTasks.map((task) => [task.id, task])),
    [toolTasks]
  );
  const source = filters.source ?? "all";
  const partition = useMemo(() => partitionWorkspaceAssets(assets), [assets]);
  const { aigcAssets, projectAssets, toolAssets } = useMemo(() => {
    const filterByStatus = (asset: Asset) =>
      filters.status === undefined ||
      getToolAssetStatus(asset, toolTasksById.get(asset.tool_task_id ?? "")) ===
        filters.status;
    return {
      aigcAssets: partition.aigc.filter(filterByStatus),
      projectAssets: partition.projects,
      toolAssets: partition.tools.filter(filterByStatus)
    };
  }, [filters.status, partition, toolTasksById]);

  const characterAssets = useMemo(
    () => projectAssets.filter((asset) => asset.category === "character"),
    [projectAssets]
  );
  const sceneAssets = useMemo(
    () => projectAssets.filter((asset) => asset.category === "scene"),
    [projectAssets]
  );
  const artifactItems = useMemo(
    () => buildArtifactItems(projectAssets),
    [projectAssets]
  );
  const imageProductAssets = useMemo(
    () => projectAssets.filter(isImageProductAsset),
    [projectAssets]
  );

  const [activeOption, setActiveOption] = useState<AssetSidebarOption>(
    filters.section ?? "all"
  );
  const [keyword, setKeyword] = useState("");
  const trimmedKeyword = keyword.trim();
  const hasKeyword = trimmedKeyword.length > 0;

  const filteredCharacter = useMemo(
    () => characterAssets.filter((asset) => assetMatchesKeyword(asset, keyword)),
    [characterAssets, keyword]
  );
  const filteredScene = useMemo(
    () => sceneAssets.filter((asset) => assetMatchesKeyword(asset, keyword)),
    [sceneAssets, keyword]
  );
  const filteredArtifacts = useMemo(
    () => artifactItems.filter((item) => artifactMatchesKeyword(item, keyword)),
    [artifactItems, keyword]
  );
  const filteredProducts = useMemo(
    () =>
      imageProductAssets.filter(
        (asset) =>
          assetMatchesKeyword(asset, keyword) ||
          getImageOperationLabel(asset).includes(keyword.trim())
      ),
    [imageProductAssets, keyword]
  );
  const filteredToolAssets = useMemo(
    () =>
      toolAssets.filter(
        (asset) =>
          assetMatchesSidebarOption(asset, activeOption) &&
          assetMatchesKeyword(asset, keyword)
      ),
    [activeOption, toolAssets, keyword]
  );
  const filteredAigcAssets = useMemo(
    () =>
      aigcAssets.filter(
        (asset) =>
          assetMatchesSidebarOption(asset, activeOption) &&
          assetMatchesKeyword(asset, keyword)
      ),
    [activeOption, aigcAssets, keyword]
  );

  // Sidebar badges show unfiltered totals so switching sections is predictable.
  const sidebarCounts = useMemo<Record<AssetSidebarOption, number>>(() => {
    const includeProjects = source === "all" || source === "projects";
    const nonProjectAssets = [
      ...(source === "all" || source === "tools" ? toolAssets : []),
      ...(source === "all" || source === "aigc" ? aigcAssets : [])
    ];
    const projectTotal = includeProjects
      ? characterAssets.length +
        sceneAssets.length +
        imageProductAssets.length +
        artifactItems.length
      : 0;
    const nonProjectCount = (option: AssetSidebarOption) =>
      nonProjectAssets.filter((asset) =>
        assetMatchesSidebarOption(asset, option)
      ).length;
    return {
      all: projectTotal + nonProjectAssets.length,
      artifacts:
        (includeProjects ? artifactItems.length : 0) +
        nonProjectCount("artifacts"),
      character:
        (includeProjects ? characterAssets.length : 0) +
        nonProjectCount("character"),
      product:
        (includeProjects ? imageProductAssets.length : 0) +
        nonProjectCount("product"),
      scene:
        (includeProjects ? sceneAssets.length : 0) + nonProjectCount("scene")
    };
  }, [
    source,
    toolAssets,
    aigcAssets,
    characterAssets.length,
    sceneAssets.length,
    artifactItems.length,
    imageProductAssets.length
  ]);

  const displayedAssetCount = sidebarCounts.all;

  const selectedProject = filters.projectId
    ? projects.find((project) => project.id === filters.projectId)
    : undefined;

  const visibleSections: readonly AssetSection[] =
    activeOption === "all" ? ASSET_SECTIONS : [activeOption];

  const visibleHasProjectMatch = visibleSections.some((section) => {
    if (section === "character") return filteredCharacter.length > 0;
    if (section === "scene") return filteredScene.length > 0;
    if (section === "artifacts") return filteredArtifacts.length > 0;
    if (section === "product") return filteredProducts.length > 0;
    return false;
  });
  const visibleHasMatch =
    ((source === "all" || source === "projects") && visibleHasProjectMatch) ||
    ((source === "all" || source === "tools") &&
      filteredToolAssets.length > 0) ||
    ((source === "all" || source === "aigc") &&
      filteredAigcAssets.length > 0);

  const showGlobalEmptyState =
    !error &&
    !hasKeyword &&
    activeOption === "all" &&
    displayedAssetCount === 0;
  const showNoMatchState = !error && hasKeyword && !visibleHasMatch;
  const renameValidation = validateAssetDisplayName(renameName);
  const renameValidationError =
    "error" in renameValidation ? renameValidation.error : null;
  const isRenameNameUnchanged =
    pendingRename !== null &&
    "name" in renameValidation &&
    renameValidation.name ===
      getWorkspaceAssetDescription(pendingRename).trim();
  const displayedRenameError = renameError ?? renameValidationError;
  const isRenameSubmitDisabled =
    isRenaming || renameValidationError !== null || isRenameNameUnchanged;

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      if (pendingDelete.isToolAsset) {
        await api.deleteToolAsset(pendingDelete.assetId);
      } else if (pendingDelete.projectId) {
        await api.deleteAsset(pendingDelete.projectId, pendingDelete.assetId);
      } else {
        return;
      }
      setAssets((previous) =>
        previous.filter((asset) => asset.id !== pendingDelete.assetId)
      );
      setPendingDelete(null);
    } catch (requestError) {
      setDeleteError(getUserFacingErrorMessage(requestError));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDialogChange(open: boolean) {
    if (open || isDeleting) {
      return;
    }
    setPendingDelete(null);
    setDeleteError(null);
  }

  function handleRequestRename(asset: Asset) {
    setPendingRename(asset);
    setRenameName(getWorkspaceAssetDescription(asset));
    setRenameError(null);
  }

  function handleRenameDialogChange(open: boolean) {
    if (open || renameRequestInFlightRef.current) {
      return;
    }
    setPendingRename(null);
    setRenameError(null);
  }

  async function handleRenameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingRename || renameRequestInFlightRef.current) {
      return;
    }

    if ("error" in renameValidation) {
      setRenameError(renameValidation.error);
      return;
    }
    if (isRenameNameUnchanged) {
      return;
    }

    renameRequestInFlightRef.current = true;
    setIsRenaming(true);
    setRenameError(null);
    try {
      const renamedAsset = await api.renameAsset(pendingRename.id, {
        name: renameValidation.name
      });
      setAssets((previous) =>
        previous.map((asset) =>
          asset.id === pendingRename.id ? renamedAsset : asset
        )
      );
      setPendingRename(null);
    } catch (requestError) {
      setRenameError(getUserFacingErrorMessage(requestError));
    } finally {
      renameRequestInFlightRef.current = false;
      setIsRenaming(false);
    }
  }

  return (
    <section
      aria-labelledby="workspace-assets-title"
      className="w-full max-w-none px-3 py-6 sm:px-4 sm:py-8 lg:px-5"
    >
      <div className="border-b border-border pb-7">
        <p className="ad-kicker">Workspace / Assets</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl"
              id="workspace-assets-title"
            >
              资产库
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              集中管理项目、工具与 AIGC 工作台资产，可追溯来源、任务状态与创建信息。
            </p>
          </div>
          <Badge className="w-fit" variant="info">
            {displayedAssetCount} 项资产
          </Badge>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row">
        <AssetSidebar
          activeOption={activeOption}
          counts={sidebarCounts}
          onSelect={setActiveOption}
        />

        <div className="min-w-0 flex-1">
          <AssetFilters filters={filters} projects={projects} />
          <AssetSearch
            onChange={setKeyword}
            onClear={() => setKeyword("")}
            value={keyword}
          />

          {error ? (
            <div
              className="mt-6 flex gap-3 rounded-2xl border border-destructive/25 bg-destructive/[0.06] p-4 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <div>
                <p className="font-semibold">资产加载失败</p>
                <p className="mt-1 leading-6">{error}</p>
              </div>
            </div>
          ) : showGlobalEmptyState ? (
            <div className="mt-7">
              <ProjectEmptyState
                action={
                  <Button asChild className="rounded-xl">
                    <Link
                      href={
                        source === "aigc"
                          ? "/workspace/aigc"
                          : filters.projectId
                          ? `/projects/${filters.projectId}`
                          : "/workspace/projects"
                      }
                    >
                      {source === "aigc"
                        ? "前往 AIGC 工作台"
                        : "返回项目创作流程"}
                    </Link>
                  </Button>
                }
                description={
                  source === "aigc"
                    ? "当前筛选条件下还没有公开的 AIGC 输入或输出资产。"
                    : selectedProject
                    ? `“${selectedProject.name}”在当前筛选条件下还没有资产，可返回项目继续生成。`
                    : "当前筛选条件下还没有资产，可返回项目模块继续创作。"
                }
                title={
                  source === "aigc"
                    ? "暂无 AIGC 工作台资产"
                    : "暂无匹配资产"
                }
              />
            </div>
          ) : showNoMatchState ? (
            <div className="mt-7">
              <ProjectEmptyState
                action={
                  <Button
                    className="rounded-xl"
                    onClick={() => setKeyword("")}
                    variant="outline"
                  >
                    清除搜索
                  </Button>
                }
                description={`没有与“${trimmedKeyword}”匹配的资产，可尝试其他关键词或清除搜索。`}
                title="未找到匹配"
              />
            </div>
          ) : (
            <div className="mt-7 space-y-8">
              {source === "all" || source === "projects"
                ? visibleSections.map((section) => {
                if (section === "character" || section === "scene") {
                  return (
                    <CategoryAssetSection
                      assets={
                        section === "character"
                          ? filteredCharacter
                          : filteredScene
                      }
                      key={section}
                      onRequestDelete={setPendingDelete}
                      onRequestPreview={setPendingPreview}
                      onRequestRename={handleRequestRename}
                      projectNames={projectNames}
                      section={section}
                    />
                  );
                }

                if (section === "artifacts") {
                  return (
                    <ArtifactsSection
                      items={filteredArtifacts}
                      key={section}
                      onRequestDelete={setPendingDelete}
                      onRequestPreview={setPendingPreview}
                      onRequestRename={handleRequestRename}
                      projectNames={projectNames}
                    />
                  );
                }

                return (
                  <ImageProductSection
                    assets={filteredProducts}
                    key={section}
                    onRequestDelete={setPendingDelete}
                    onRequestPreview={setPendingPreview}
                    onRequestRename={handleRequestRename}
                    projectNames={projectNames}
                  />
                );
              })
                : null}
              {source === "all" || source === "tools" ? (
                <ToolAssetsSection
                  assets={filteredToolAssets}
                  onRequestDelete={setPendingDelete}
                  onRequestPreview={setPendingPreview}
                  onRequestRename={handleRequestRename}
                  source="tools"
                  toolTasksById={toolTasksById}
                />
              ) : null}
              {source === "all" || source === "aigc" ? (
                <ToolAssetsSection
                  assets={filteredAigcAssets}
                  onRequestDelete={setPendingDelete}
                  onRequestPreview={setPendingPreview}
                  onRequestRename={handleRequestRename}
                  source="aigc"
                  toolTasksById={toolTasksById}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Dialog onOpenChange={handleDialogChange} open={pendingDelete !== null}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>删除资产</DialogTitle>
            <DialogDescription>
              确认删除“{pendingDelete?.label}”？该操作不可撤销。
              {pendingDelete?.isToolAsset
                ? "仅删除该工具资产，不会影响同一任务的其他资产。"
                : null}
              {pendingDelete?.isLastFrame
                ? "尾帧图依附于分镜视频，删除后将同时删除对应分镜视频片段。"
                : null}
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
              <Button disabled={isDeleting} variant="outline">
                取消
              </Button>
            </DialogClose>
            <Button
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              variant="destructive"
            >
              {isDeleting ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={handleRenameDialogChange}
        open={pendingRename !== null}
      >
        <DialogContent
          className="max-w-sm p-6"
          hideCloseButton={isRenaming}
        >
          <form onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>重命名资产</DialogTitle>
              <DialogDescription>
                输入 1 至 120 个字符的新名称。
              </DialogDescription>
            </DialogHeader>
            <label
              className="mt-5 block text-sm font-medium text-foreground"
              htmlFor="asset-rename-name"
            >
              资产名称
            </label>
            <Input
              aria-describedby={
                displayedRenameError ? "asset-rename-error" : undefined
              }
              aria-invalid={displayedRenameError ? true : undefined}
              autoFocus
              className="mt-2"
              disabled={isRenaming}
              id="asset-rename-name"
              onChange={(event) => {
                setRenameName(event.target.value);
                setRenameError(null);
              }}
              value={renameName}
            />
            {displayedRenameError ? (
              <p
                className="mt-3 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-3 text-sm text-destructive"
                id="asset-rename-error"
                role="alert"
              >
                {displayedRenameError}
              </p>
            ) : null}
            <DialogFooter className="mt-5">
              <DialogClose asChild>
                <Button disabled={isRenaming} type="button" variant="outline">
                  取消
                </Button>
              </DialogClose>
              <Button disabled={isRenameSubmitDisabled} type="submit">
                {isRenaming ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AssetPreviewDialog
        onClose={() => setPendingPreview(null)}
        target={pendingPreview}
      />
    </section>
  );
}

function AssetSidebar({
  activeOption,
  counts,
  onSelect
}: {
  activeOption: AssetSidebarOption;
  counts: Record<AssetSidebarOption, number>;
  onSelect: (option: AssetSidebarOption) => void;
}) {
  return (
    <nav
      aria-label="资产分区"
      className="shrink-0 lg:w-56"
    >
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {ASSET_SIDEBAR_OPTIONS.map((option) => {
          const Icon = SIDEBAR_ICONS[option];
          const isActive = option === activeOption;

          return (
            <li className="shrink-0 lg:shrink" key={option}>
              <button
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "border-primary/25 bg-primary/[0.08] text-primary shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                onClick={() => onSelect(option)}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">
                  {getAssetSidebarLabel(option)}
                </span>
                <span
                  className={cn(
                    "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {counts[option]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AssetSearch({
  onChange,
  onClear,
  value
}: {
  onChange: (value: string) => void;
  onClear: () => void;
  value: string;
}) {
  return (
    <div className="relative mt-4">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        aria-label="搜索资产"
        className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-9 text-sm text-foreground shadow-sm outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/15"
        onChange={(event) => onChange(event.target.value)}
        placeholder="按名称 / 描述搜索"
        type="search"
        value={value}
      />
      {value ? (
        <button
          aria-label="清除搜索"
          className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={onClear}
          type="button"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function AssetFilters({
  filters,
  projects
}: {
  filters: WorkspaceAssetFilters;
  projects: ProjectListItem[];
}) {
  const [selectedSource, setSelectedSource] = useState<WorkspaceAssetSource>(
    filters.source ?? "all"
  );
  const isNonProjectSource =
    selectedSource === "tools" || selectedSource === "aigc";

  return (
    <form
      action="/workspace/assets"
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
      method="get"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_auto] xl:items-end">
        <FilterField label="来源" name="source">
          <select
            className={selectClassName}
            defaultValue={filters.source ?? "all"}
            id="source"
            name="source"
            onChange={(event) =>
              setSelectedSource(event.target.value as WorkspaceAssetSource)
            }
          >
            <option value="all">全部资产</option>
            <option value="projects">项目资产</option>
            <option value="tools">工具资产</option>
            <option value="aigc">AIGC 工作台</option>
          </select>
        </FilterField>

        <FilterField label="项目" name="project_id">
          <select
            className={selectClassName}
            defaultValue={isNonProjectSource ? "" : filters.projectId ?? ""}
            disabled={isNonProjectSource}
            id="project_id"
            name="project_id"
          >
            <option value="">全部项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="状态" name="status">
          <select
            className={selectClassName}
            defaultValue={filters.status ?? ""}
            id="status"
            name="status"
          >
            <option value="">全部状态</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status)}
              </option>
            ))}
          </select>
        </FilterField>

        <div className="flex gap-2 md:col-span-2 xl:col-span-1">
          <Button className="h-10 flex-1 rounded-xl xl:flex-none" type="submit">
            <Search aria-hidden="true" className="h-4 w-4" />
            筛选
          </Button>
          <Button asChild className="h-10 rounded-xl" variant="outline">
            <Link aria-label="重置筛选" href="/workspace/assets">
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

function FilterField({
  children,
  label,
  name
}: {
  children: React.ReactNode;
  label: string;
  name: string;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-xs font-semibold text-muted-foreground"
        htmlFor={name}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionHeader({
  count,
  description,
  section,
  title
}: {
  count: number;
  description: string;
  section: AssetSection;
  title: string;
}) {
  const Icon = SECTION_ICONS[section];

  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <div>
        <h2
          className="text-xl font-semibold tracking-[-0.025em]"
          id={`${section}-assets-title`}
        >
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{`${count} 项 · ${description}`}</p>
      </div>
    </div>
  );
}

function SectionPager({
  onChange,
  page,
  pageCount
}: {
  onChange: (page: number) => void;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="mt-5 flex items-center justify-center gap-3">
      <Button
        aria-label="上一页"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        size="sm"
        variant="outline"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground">{`第 ${page + 1} / ${pageCount} 页`}</span>
      <Button
        aria-label="下一页"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
        size="sm"
        variant="outline"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
      当前筛选条件下暂无{label}资产
    </div>
  );
}

function AssetGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className={ASSET_GRID_CLASS_NAME} data-asset-grid>
      {children}
    </div>
  );
}

function usePagedItems<T>(items: T[]): {
  page: number;
  pageCount: number;
  pageItems: T[];
  setPage: (page: number) => void;
} {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  // Clamp on read so deletions that shrink the list can't strand us on an
  // out-of-range page (also keeps the slice offset in sync without an effect).
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;

  return {
    page: safePage,
    pageCount,
    pageItems: items.slice(start, start + PAGE_SIZE),
    setPage
  };
}

function CategoryAssetSection({
  assets,
  onRequestDelete,
  onRequestPreview,
  onRequestRename,
  projectNames,
  section
}: {
  assets: Asset[];
  onRequestDelete: (target: DeleteTarget) => void;
  onRequestPreview: (target: PreviewTarget) => void;
  onRequestRename: (asset: Asset) => void;
  projectNames: Map<string, string>;
  section: Extract<AssetSection, "character" | "scene">;
}) {
  const { page, pageCount, pageItems, setPage } = usePagedItems(assets);
  const label = getAssetSectionLabel(section);

  return (
    <section aria-labelledby={`${section}-assets-title`}>
      <SectionHeader
        count={assets.length}
        description={getAssetSectionDescription(section)}
        section={section}
        title={`${label}资产`}
      />

      {assets.length > 0 ? (
        <>
          <AssetGrid>
            {pageItems.map((asset) => (
              <WorkspaceAssetCard
                asset={asset}
                categoryLabel={label}
                key={asset.id}
                onRequestDelete={onRequestDelete}
                onRequestPreview={onRequestPreview}
                onRequestRename={onRequestRename}
                projectName={projectNames.get(asset.project_id ?? "") ?? "未知项目"}
              />
            ))}
          </AssetGrid>
          <SectionPager onChange={setPage} page={page} pageCount={pageCount} />
        </>
      ) : (
        <SectionEmpty label={label} />
      )}
    </section>
  );
}

function ArtifactsSection({
  items,
  onRequestDelete,
  onRequestPreview,
  onRequestRename,
  projectNames
}: {
  items: ArtifactDisplayItem[];
  onRequestDelete: (target: DeleteTarget) => void;
  onRequestPreview: (target: PreviewTarget) => void;
  onRequestRename: (asset: Asset) => void;
  projectNames: Map<string, string>;
}) {
  const { page, pageCount, pageItems, setPage } = usePagedItems(items);

  return (
    <section aria-labelledby="artifacts-assets-title">
      <SectionHeader
        count={items.length}
        description={getAssetSectionDescription("artifacts")}
        section="artifacts"
        title="产物"
      />

      {items.length > 0 ? (
        <>
          <AssetGrid>
            {pageItems.map((item) => (
              <ArtifactCard
                item={item}
                key={item.key}
                onRequestDelete={onRequestDelete}
                onRequestPreview={onRequestPreview}
                onRequestRename={onRequestRename}
                projectName={
                  projectNames.get(item.asset.project_id ?? "") ?? "未知项目"
                }
              />
            ))}
          </AssetGrid>
          <SectionPager onChange={setPage} page={page} pageCount={pageCount} />
        </>
      ) : (
        <SectionEmpty label="产物" />
      )}
    </section>
  );
}

function ImageProductSection({
  assets,
  onRequestDelete,
  onRequestPreview,
  onRequestRename,
  projectNames
}: {
  assets: Asset[];
  onRequestDelete: (target: DeleteTarget) => void;
  onRequestPreview: (target: PreviewTarget) => void;
  onRequestRename: (asset: Asset) => void;
  projectNames: Map<string, string>;
}) {
  const { page, pageCount, pageItems, setPage } = usePagedItems(assets);
  return (
    <section aria-labelledby="product-assets-title">
      <SectionHeader
        count={assets.length}
        description={getAssetSectionDescription("product")}
        section="product"
        title="图片成品"
      />
      {assets.length > 0 ? (
        <>
          <AssetGrid>
            {pageItems.map((asset) => (
              <WorkspaceAssetCard
                asset={asset}
                categoryLabel={getImageOperationLabel(asset)}
                key={asset.id}
                onRequestDelete={onRequestDelete}
                onRequestPreview={onRequestPreview}
                onRequestRename={onRequestRename}
                projectName={projectNames.get(asset.project_id ?? "") ?? "未知项目"}
              />
            ))}
          </AssetGrid>
          <SectionPager onChange={setPage} page={page} pageCount={pageCount} />
        </>
      ) : (
        <SectionEmpty label="图片成品" />
      )}
    </section>
  );
}

function ToolAssetsSection({
  assets,
  onRequestDelete,
  onRequestPreview,
  onRequestRename,
  source,
  toolTasksById
}: {
  assets: Asset[];
  onRequestDelete: (target: DeleteTarget) => void;
  onRequestPreview: (target: PreviewTarget) => void;
  onRequestRename: (asset: Asset) => void;
  source: Extract<WorkspaceAssetSource, "aigc" | "tools">;
  toolTasksById: Map<string, ToolTask>;
}) {
  const { page, pageCount, pageItems, setPage } = usePagedItems(assets);
  const isAigc = source === "aigc";
  const headingId = `${source}-assets-title`;
  const title = isAigc ? "AIGC 工作台" : "工具资产";
  const description = isAigc
    ? "AIGC 画布上传的输入素材与公开生成产物。"
    : "独立工具的输入素材与生成产物。";
  const Icon = isAigc ? Sparkles : Wrench;

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <h2
            className="text-xl font-semibold tracking-[-0.025em]"
            id={headingId}
          >
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {`${assets.length} 项 · ${description}`}
          </p>
        </div>
      </div>
      {assets.length > 0 ? (
        <>
          <AssetGrid>
            {pageItems.map((asset) => (
              <ToolAssetCard
                asset={asset}
                key={asset.id}
                onRequestDelete={onRequestDelete}
                onRequestPreview={onRequestPreview}
                onRequestRename={onRequestRename}
                source={source}
                task={asset.tool_task_id ? toolTasksById.get(asset.tool_task_id) : undefined}
              />
            ))}
          </AssetGrid>
          <SectionPager onChange={setPage} page={page} pageCount={pageCount} />
        </>
      ) : (
        <SectionEmpty label={isAigc ? "AIGC 工作台" : "工具"} />
      )}
    </section>
  );
}

function ToolAssetCard({
  asset,
  onRequestDelete,
  onRequestPreview,
  onRequestRename,
  source,
  task
}: {
  asset: Asset;
  onRequestDelete: (target: DeleteTarget) => void;
  onRequestPreview: (target: PreviewTarget) => void;
  onRequestRename: (asset: Asset) => void;
  source: Extract<WorkspaceAssetSource, "aigc" | "tools">;
  task?: ToolTask;
}) {
  const description = getWorkspaceAssetDescription(asset);
  const previewUrl = getSafePreviewUrl(asset);
  const isAudio = asset.type === "uploaded_audio";
  const isVideo =
    asset.type === "uploaded_video" ||
    asset.type === "storyboard_video" ||
    asset.type === "final_video";
  const taskType = task?.type ?? metadataToolTaskType(asset);
  const taskStatus = getToolAssetStatus(asset, task);
  const isAigc = source === "aigc";
  const sourceLabel = isAigc ? "AIGC 工作台" : "工具资产";
  const roleLabel = getToolAssetRoleLabel(asset.tool_asset_role, isAigc);
  const typeLabel = isAigc
    ? getAigcAssetTypeLabel(asset)
    : getToolTaskTypeLabel(taskType);

  return (
    <article className={ASSET_CARD_CLASS_NAME}>
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-secondary/50">
        {isAudio ? (
          <button
            aria-label={`播放${description}预览`}
            className="flex h-full w-full flex-col items-center justify-center gap-3 text-primary outline-none transition hover:bg-primary/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
            onClick={() =>
              previewUrl
                ? onRequestPreview({
                    asset,
                    assetRole: roleLabel,
                    assetSource: sourceLabel,
                    createdAt: asset.created_at,
                    downloadUrl: getAssetDownloadUrl(asset),
                    isAudio: true,
                    isVideo: false,
                    projectName: sourceLabel,
                    status: taskStatus,
                    title: description,
                    typeLabel,
                    url: previewUrl
                  })
                : undefined
            }
            type="button"
          >
            <Music2 aria-hidden="true" className="h-8 w-8" />
            <span className="text-xs font-medium">播放音频</span>
          </button>
        ) : (
          <AssetPreview
            alt={`${description}预览`}
            isVideo={isVideo}
            onOpen={
              previewUrl
                ? () =>
                    onRequestPreview({
                      asset,
                      assetRole: roleLabel,
                      assetSource: sourceLabel,
                      createdAt: asset.created_at,
                      downloadUrl: getAssetDownloadUrl(asset),
                      isVideo,
                      projectName: sourceLabel,
                      status: taskStatus,
                      title: description,
                      typeLabel,
                      url: previewUrl
                    })
                : undefined
            }
            url={previewUrl}
          />
        )}
        <Badge
          className="absolute left-3 top-3 border-white/70 bg-white/90 backdrop-blur"
          variant={statusVariant(taskStatus)}
        >
          {getStatusLabel(taskStatus)}
        </Badge>
      </div>
      <div className="min-w-0 p-3">
        <p className="line-clamp-2 min-h-10 break-words text-sm font-medium leading-5 text-foreground">
          {description}
        </p>
        <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs">
          <MetadataRow label="来源" value={sourceLabel} />
          <MetadataRow label="资产角色" value={roleLabel} />
          {isAigc ? null : <MetadataRow label="工具类型" value={typeLabel} />}
          <MetadataRow label="任务状态" value={getStatusLabel(taskStatus)} />
          <MetadataRow
            label="创建时间"
            value={<time dateTime={asset.created_at}>{formatDate(asset.created_at)}</time>}
          />
        </dl>
        <div className="mt-4 flex min-w-0 items-center gap-2">
          {previewUrl ? (
            <Button
              asChild
              className="min-w-0 flex-1 px-2"
              size="sm"
              variant="outline"
            >
              <a
                className="min-w-0"
                download
                href={getAssetDownloadUrl(asset) ?? previewUrl}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                <span className="truncate">下载资产</span>
              </a>
            </Button>
          ) : (
            <span className="flex-1" />
          )}
          <AssetCardActions
            onDelete={() =>
              onRequestDelete({
                assetId: asset.id,
                isLastFrame: false,
                isToolAsset: true,
                label: description,
                projectId: null
              })
            }
            onRename={() => onRequestRename(asset)}
          />
        </div>
      </div>
    </article>
  );
}

function AssetCardActions({
  onDelete,
  onRename
}: {
  onDelete: () => void;
  onRename?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5" data-asset-actions>
      {onRename ? (
        <Button
          aria-label="重命名资产"
          className="h-8 w-8 rounded-lg p-0 text-muted-foreground"
          onClick={onRename}
          size="icon"
          title="重命名资产"
          type="button"
          variant="outline"
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button
        aria-label="删除资产"
        className="h-8 w-8 rounded-lg p-0 text-destructive hover:text-destructive"
        onClick={onDelete}
        size="icon"
        title="删除资产"
        type="button"
        variant="outline"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AssetPreview({
  alt,
  isVideo,
  onOpen,
  url
}: {
  alt: string;
  isVideo: boolean;
  onOpen?: () => void;
  url: string | null;
}) {
  if (!url) {
    return (
      <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.14),transparent_65%)]">
        <div className="text-center text-muted-foreground">
          <ImageIcon aria-hidden="true" className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 text-xs">暂无预览</p>
        </div>
      </div>
    );
  }

  const media = isVideo ? (
    <video
      aria-label={alt}
      className="h-full w-full object-contain"
      muted
      playsInline
      preload="metadata"
      src={`${url}#t=0.1`}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.025]"
      loading="lazy"
      src={url}
    />
  );

  if (!onOpen) {
    return media;
  }

  const HintIcon = isVideo ? Play : Maximize2;

  return (
    <button
      aria-label={isVideo ? `播放${alt}` : `放大查看${alt}`}
      className="group/media absolute inset-0 h-full w-full cursor-zoom-in overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
      onClick={onOpen}
      type="button"
    >
      {media}
      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/0 transition duration-300 group-hover/media:bg-slate-950/25 group-focus-visible/media:bg-slate-950/25">
        <span className="grid h-11 w-11 scale-90 place-items-center rounded-full border border-white/70 bg-white/90 text-primary opacity-0 shadow-sm backdrop-blur transition duration-300 group-hover/media:scale-100 group-hover/media:opacity-100 group-focus-visible/media:scale-100 group-focus-visible/media:opacity-100">
          <HintIcon aria-hidden="true" className="h-5 w-5" />
        </span>
      </span>
    </button>
  );
}

function WorkspaceAssetCard({
  asset,
  categoryLabel,
  onRequestDelete,
  onRequestPreview,
  onRequestRename,
  projectName
}: {
  asset: Asset;
  categoryLabel: string;
  onRequestDelete: (target: DeleteTarget) => void;
  onRequestPreview: (target: PreviewTarget) => void;
  onRequestRename: (asset: Asset) => void;
  projectName: string;
}) {
  const description = getWorkspaceAssetDescription(asset);
  const previewUrl = getSafePreviewUrl(asset);

  return (
    <article className={ASSET_CARD_CLASS_NAME}>
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-secondary/50">
        <AssetPreview
          alt={`${description}预览`}
          isVideo={false}
          onOpen={
            previewUrl
              ? () =>
                  onRequestPreview({
                    asset,
                    createdAt: asset.created_at,
                    downloadUrl: getAssetDownloadUrl(asset),
                    isVideo: false,
                    projectName,
                    status: asset.status,
                    title: description,
                    typeLabel: categoryLabel,
                    url: previewUrl
                  })
              : undefined
          }
          url={previewUrl}
        />
        <Badge
          className="absolute left-3 top-3 border-white/70 bg-white/90 backdrop-blur"
          variant={statusVariant(asset.status)}
        >
          {getStatusLabel(asset.status)}
        </Badge>
      </div>

      <div className="min-w-0 p-3">
        <p className="line-clamp-2 min-h-10 break-words text-sm font-medium leading-5 text-foreground">
          {description}
        </p>
        <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs">
          <MetadataRow label="所属项目" value={projectName} />
          <MetadataRow label="资产类型" value={categoryLabel} />
          <MetadataRow
            label="创建时间"
            value={
              <time dateTime={asset.created_at}>{formatDate(asset.created_at)}</time>
            }
          />
        </dl>
        <div className="mt-4 flex justify-end">
          <AssetCardActions
            onDelete={() =>
              onRequestDelete({
                assetId: asset.id,
                isLastFrame: false,
                isToolAsset: false,
                label: description,
                projectId: asset.project_id
              })
            }
            onRename={() => onRequestRename(asset)}
          />
        </div>
      </div>
    </article>
  );
}

function ArtifactCard({
  item,
  onRequestDelete,
  onRequestPreview,
  onRequestRename,
  projectName
}: {
  item: ArtifactDisplayItem;
  onRequestDelete: (target: DeleteTarget) => void;
  onRequestPreview: (target: PreviewTarget) => void;
  onRequestRename: (asset: Asset) => void;
  projectName: string;
}) {
  const { asset, isLastFrame, kind } = item;
  const kindLabel = getArtifactKindLabel(kind);
  const displayName = isLastFrame
    ? kindLabel
    : getIndependentArtifactDisplayName(asset, kindLabel);
  const typeLabel = getArtifactKindTypeLabel(kind);
  const isVideo = kind === "storyboard_video" || kind === "final_video";
  const previewUrl = isLastFrame ? getSafeLastFrameUrl(asset) : getSafePreviewUrl(asset);

  return (
    <article className={ASSET_CARD_CLASS_NAME}>
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-secondary/50">
        <AssetPreview
          alt={`${displayName}预览`}
          isVideo={isVideo}
          onOpen={
            previewUrl
              ? () =>
                  onRequestPreview({
                    asset,
                    createdAt: asset.created_at,
                    downloadUrl: isLastFrame
                      ? undefined
                      : getAssetDownloadUrl(asset),
                    isVideo,
                    projectName,
                    status: asset.status,
                    title: displayName,
                    typeLabel,
                    url: previewUrl
                  })
              : undefined
          }
          url={previewUrl}
        />
        <Badge
          className="absolute left-3 top-3 border-white/70 bg-white/90 backdrop-blur"
          variant={statusVariant(asset.status)}
        >
          {getStatusLabel(asset.status)}
        </Badge>
      </div>

      <div className="min-w-0 p-3">
        <p className="break-words text-sm font-medium leading-5 text-foreground">
          {displayName}
        </p>
        <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs">
          <MetadataRow label="所属项目" value={projectName} />
          <MetadataRow label="资产类型" value={typeLabel} />
          <MetadataRow
            label="创建时间"
            value={
              <time dateTime={asset.created_at}>{formatDate(asset.created_at)}</time>
            }
          />
        </dl>
        <div className="mt-4 flex justify-end">
          <AssetCardActions
            onDelete={() =>
              onRequestDelete({
                assetId: asset.id,
                isLastFrame,
                isToolAsset: false,
                label: displayName,
                projectId: asset.project_id
              })
            }
            onRename={isLastFrame ? undefined : () => onRequestRename(asset)}
          />
        </div>
      </div>
    </article>
  );
}

function MetadataRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
      <dt className="whitespace-nowrap text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function AssetPreviewDialog({
  onClose,
  target
}: {
  onClose: () => void;
  target: PreviewTarget | null;
}) {
  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open={target !== null}>
      <DialogContent className="max-w-4xl p-0">
        {target ? (
          <div className="flex max-h-[calc(100dvh-3rem)] flex-col">
            <div className="grid place-items-center bg-slate-950">
              {target.isAudio ? (
                <audio aria-label={`${target.title}播放`} controls src={target.url} />
              ) : target.isVideo ? (
                <video
                  aria-label={`${target.title}播放`}
                  autoPlay
                  className="max-h-[70dvh] w-full"
                  controls
                  playsInline
                  src={target.url}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${target.title}大图`}
                  className="max-h-[70dvh] w-full object-contain"
                  src={target.url}
                />
              )}
            </div>
            <div className="border-t border-border p-5">
              <DialogHeader>
                <DialogTitle>{target.title}</DialogTitle>
                <DialogDescription>
                  {`${target.typeLabel} · ${target.projectName}`}
                </DialogDescription>
              </DialogHeader>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <MetadataRow
                  label={target.assetSource ? "来源" : "所属项目"}
                  value={target.assetSource ?? target.projectName}
                />
                {target.assetRole ? (
                  <MetadataRow label="资产角色" value={target.assetRole} />
                ) : null}
                <MetadataRow label="资产类型" value={target.typeLabel} />
                <MetadataRow
                  label="生成状态"
                  value={getStatusLabel(target.status)}
                />
                <MetadataRow
                  label="创建时间"
                  value={
                    <time dateTime={target.createdAt}>
                      {formatDate(target.createdAt)}
                    </time>
                  }
                />
                {target.asset ? (
                  <>
                    <MetadataRow
                      label="用途"
                      value={metadataText(target.asset, "image_purpose") ?? "未标注"}
                    />
                    <MetadataRow
                      label="操作"
                      value={getImageOperationLabel(target.asset)}
                    />
                    <MetadataRow
                      label="提示词"
                      value={metadataText(target.asset, "prompt_summary") ?? "无"}
                    />
                    <MetadataRow
                      label="源图"
                      value={metadataText(target.asset, "source_asset_id") ?? "无"}
                    />
                    <MetadataRow
                      label="尺寸"
                      value={imageSizeText(target.asset)}
                    />
                    <MetadataRow
                      label="格式"
                      value={metadataText(target.asset, "format") ?? target.asset.mime_type ?? "未知"}
                    />
                    <MetadataRow
                      label="模型"
                      value={metadataText(target.asset, "model") ?? "本地图层合成"}
                    />
                  </>
                ) : null}
              </dl>
              <Button asChild className="mt-4" variant="outline">
                <a
                  download
                  href={target.downloadUrl ?? target.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Download className="h-4 w-4" />
                  下载资产
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function metadataText(asset: Asset, key: string): string | null {
  const value = asset.metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataToolTaskType(asset: Asset): ToolTaskType | undefined {
  const value = metadataText(asset, "tool_task_type");
  return value === "face_blur_video" || value === "multimodal_video_generation"
    ? value
    : undefined;
}

function metadataToolTaskStatus(asset: Asset): Status | undefined {
  const value = metadataText(asset, "tool_task_status");
  return value && STATUSES.includes(value as Status) ? (value as Status) : undefined;
}

function getToolAssetStatus(asset: Asset, task?: ToolTask): Status {
  return task?.status ?? metadataToolTaskStatus(asset) ?? asset.status;
}

function getToolTaskTypeLabel(taskType: ToolTaskType | undefined): string {
  if (taskType === "face_blur_video") return "视频人物打码";
  if (taskType === "multimodal_video_generation") return "全模态参考生视频";
  return "工具任务";
}

function getToolAssetRoleLabel(
  role: ToolAssetRole | null | undefined,
  isAigc = false
): string {
  if (role === "input") return isAigc ? "AIGC 输入" : "输入素材";
  if (role === "output") return isAigc ? "AIGC 输出" : "输出产物";
  return "未标注";
}

function getAigcAssetTypeLabel(asset: Asset): string {
  if (asset.mime_type?.startsWith("image/")) return "图片";
  if (asset.mime_type?.startsWith("video/")) return "视频";
  if (asset.mime_type?.startsWith("audio/")) return "音频";
  if (asset.type === "subtitle") return "字幕";
  return "媒体资产";
}

function getIndependentArtifactDisplayName(
  asset: Asset,
  fallback: string
): string {
  const displayName = getWorkspaceAssetDescription(asset);
  return displayName === "创意资产" ? fallback : displayName;
}

function assetMatchesSidebarOption(
  asset: Asset,
  option: AssetSidebarOption
): boolean {
  if (option === "all") return true;
  if (option === "character" || option === "scene") {
    return asset.category === option;
  }
  const isImage =
    asset.mime_type?.startsWith("image/") === true ||
    asset.type === "uploaded_image" ||
    asset.type === "generated_image";
  return option === "product" ? isImage : !isImage;
}

function imageSizeText(asset: Asset): string {
  const width = asset.metadata.width;
  const height = asset.metadata.height;
  if (typeof width === "number" && typeof height === "number") {
    return `${width} × ${height}`;
  }
  return metadataText(asset, "size") ?? "未知";
}
