"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Eraser,
  FileStack,
  GitFork,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Workflow
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useMemo,
  useState
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AigcThumbnailDialog } from "@/components/workspace/aigc/aigc-thumbnail-dialog";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import { migrateAigcDefinitionV2 } from "@/lib/aigc/definition-migration";
import {
  countWorkspacePreviewModels,
  getWorkspacePreviewNodeTone,
  normalizeWorkspaceTopology,
  type WorkspacePreviewTone
} from "@/lib/aigc/workspace-preview";
import type {
  AigcPage,
  AigcPipeline,
  AigcPipelineDefinitionV2,
  AigcPipelineTemplate,
  AigcPipelineRunStatus,
  AigcV2Node
} from "@/lib/aigc/types";
import { formatDate } from "@/lib/project-display";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const EMPTY_DEFINITION: AigcPipelineDefinitionV2 = {
  schemaVersion: 2,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
};

function pipelineRoute(pipelineId: string): Route {
  return `/workspace/aigc/pipelines/${pipelineId}` as Route;
}

type AigcView = "templates" | "pipelines";
type AigcListItem = AigcPipelineTemplate | AigcPipeline;
type DeleteTarget = {
  id: string;
  kind: "pipeline" | "template";
  name: string;
};

interface AigcWorkspaceProps {
  initialError?: string;
  initialPipelines: AigcPage<AigcPipeline>;
  initialTemplates: AigcPage<AigcPipelineTemplate>;
  initialView?: AigcView;
}

export function AigcWorkspace({
  initialError,
  initialPipelines,
  initialTemplates,
  initialView = "templates"
}: AigcWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = useState<AigcView>(initialView);
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(
    initialError ?? null
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [thumbnailPipeline, setThumbnailPipeline] =
    useState<AigcPipeline | null>(null);

  const templatesQuery = useQuery({
    initialData:
      !initialError && page === 1 && query === ""
        ? initialTemplates
        : undefined,
    placeholderData: (previous) => previous,
    queryFn: () =>
      apiClient.listAigcTemplates({ page, pageSize: PAGE_SIZE, query }),
    queryKey: ["aigc", "templates", query, page],
    enabled: view === "templates"
  });
  const pipelinesQuery = useQuery({
    initialData:
      !initialError && page === 1 && query === ""
        ? initialPipelines
        : undefined,
    placeholderData: (previous) => previous,
    queryFn: () =>
      apiClient.listAigcPipelines({ page, pageSize: PAGE_SIZE, query }),
    queryKey: ["aigc", "pipelines", query, page],
    enabled: view === "pipelines"
  });
  const activeQuery = view === "templates" ? templatesQuery : pipelinesQuery;
  const activeData = activeQuery.data;

  const instantiateMutation = useMutation({
    mutationFn: (template: AigcPipelineTemplate) =>
      apiClient.instantiateAigcTemplate(template.id),
    onError: (error) => setFeedback(getUserFacingErrorMessage(error)),
    onSuccess: (pipeline) => {
      void queryClient.invalidateQueries({ queryKey: ["aigc", "pipelines"] });
      router.push(pipelineRoute(pipeline.id));
    }
  });
  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiClient.createAigcPipeline({
        name,
        description: "",
        definition: structuredClone(EMPTY_DEFINITION),
        source_template_id: null,
        source_template_revision: null
      }),
    onError: (error) => setFeedback(getUserFacingErrorMessage(error)),
    onSuccess: (pipeline) => {
      void queryClient.invalidateQueries({ queryKey: ["aigc", "pipelines"] });
      setIsCreateOpen(false);
      setNewPipelineName("");
      router.push(pipelineRoute(pipeline.id));
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (target: DeleteTarget) =>
      target.kind === "template"
        ? apiClient.deleteAigcTemplate(target.id)
        : apiClient.deleteAigcPipeline(target.id),
    onError: (error) => setDeleteError(getUserFacingErrorMessage(error)),
    onSuccess: (_result, target) => {
      setDeleteTarget(null);
      setDeleteError(null);
      void queryClient.invalidateQueries({
        queryKey: ["aigc", target.kind === "template" ? "templates" : "pipelines"]
      });
    }
  });

  const totalPages = Math.max(
    1,
    Math.ceil((activeData?.total ?? 0) / PAGE_SIZE)
  );
  const errorMessage = activeQuery.error
    ? getUserFacingErrorMessage(activeQuery.error)
    : feedback;

  function changeView(nextView: AigcView) {
    setView(nextView);
    setPage(1);
    setFeedback(null);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery.trim());
    setPage(1);
    setFeedback(null);
  }

  function clearSearch() {
    setDraftQuery("");
    setQuery("");
    setPage(1);
  }

  function submitNewPipeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newPipelineName.trim();
    if (name) createMutation.mutate(name);
  }

  function changeDeleteDialog(open: boolean) {
    if (!open && !deleteMutation.isPending) {
      setDeleteTarget(null);
      setDeleteError(null);
    }
  }

  function requestDelete(target: DeleteTarget) {
    setDeleteError(null);
    setDeleteTarget(target);
  }

  return (
    <main
      className="w-full max-w-none bg-[#0b0f14] bg-[radial-gradient(circle_at_12%_14%,rgba(66,153,255,0.18)_0_1px,transparent_1.5px),radial-gradient(circle_at_83%_20%,rgba(255,130,73,0.15)_0_1px,transparent_1.5px),linear-gradient(rgba(116,142,171,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(116,142,171,0.08)_1px,transparent_1px)] bg-[size:auto,auto,36px_36px,36px_36px] px-3 py-6 text-slate-100 sm:px-4 sm:py-8 lg:px-5"
      data-testid="aigc-workspace"
    >
      <header className="border-b border-slate-700/80 pb-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-400">
              DAG creation workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">
              星图创作台
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              从模板快速建立生成流程，或维护可重复执行的节点画布。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-slate-700 bg-slate-900/80 px-3 py-1.5 font-mono text-xs text-slate-300">
              {activeData?.total ?? 0} 个{view === "templates" ? "模板" : "画布"}
            </span>
            <Button
              className="bg-sky-500 text-slate-950 hover:bg-sky-400"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              新建空白画布
            </Button>
          </div>
        </div>
      </header>

      <section className="mt-5 flex flex-col gap-3 border-b border-slate-700/80 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div
          aria-label="AIGC 视图"
          className="flex w-full gap-1 border border-slate-700 bg-slate-950/60 p-1 sm:w-fit"
          role="tablist"
        >
          <ViewButton
            active={view === "templates"}
            icon={<FileStack className="h-4 w-4" />}
            label="画布模板"
            onClick={() => changeView("templates")}
          />
          <ViewButton
            active={view === "pipelines"}
            icon={<Workflow className="h-4 w-4" />}
            label="我的画布"
            onClick={() => changeView("pipelines")}
          />
        </div>

        <form className="flex w-full gap-2 lg:max-w-md" onSubmit={submitSearch}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="按名称筛选"
              className="border-slate-700 bg-slate-950/70 pl-9 text-slate-100 placeholder:text-slate-500"
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="按名称筛选"
              value={draftQuery}
            />
          </div>
          {draftQuery || query ? (
            <Button
              aria-label="清空筛选"
              onClick={clearSearch}
              size="icon"
              title="清空筛选"
              type="button"
              variant="ghost"
            >
              <Eraser className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
            type="submit"
            variant="outline"
          >
            筛选
          </Button>
        </form>
      </section>

      {errorMessage ? (
        <div
          className="mt-5 flex items-center justify-between gap-4 border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </span>
          <Button
            onClick={() => {
              setFeedback(null);
              void activeQuery.refetch();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            重试
          </Button>
        </div>
      ) : null}

      {activeQuery.isPending ? (
        <LoadingState />
      ) : activeData && activeData.items.length > 0 ? (
        <>
          <div
            className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5"
            data-testid="aigc-card-grid"
          >
            {activeData.items.map((item) => (
              <AigcCard
                busy={
                  view === "templates" &&
                  instantiateMutation.isPending &&
                  instantiateMutation.variables?.id === item.id
                }
                item={item}
                key={item.id}
                kind={view === "templates" ? "template" : "pipeline"}
                onDelete={requestDelete}
                onSelectThumbnail={(pipeline) => setThumbnailPipeline(pipeline)}
                onOpen={() => {
                  setFeedback(null);
                  if (view === "templates") {
                    instantiateMutation.mutate(item as AigcPipelineTemplate);
                  } else {
                    router.push(pipelineRoute(item.id));
                  }
                }}
              />
            ))}
          </div>
          <Pagination
            onPageChange={setPage}
            page={activeData.page}
            total={activeData.total}
            totalPages={totalPages}
          />
        </>
      ) : (
        <EmptyState
          hasQuery={query.length > 0}
          onCreate={() => setIsCreateOpen(true)}
          onReset={clearSearch}
          view={view}
        />
      )}

      <Dialog onOpenChange={setIsCreateOpen} open={isCreateOpen}>
        <DialogContent className="max-w-lg p-6 sm:p-7">
          <form onSubmit={submitNewPipeline}>
            <DialogHeader>
              <DialogTitle>新建空白画布</DialogTitle>
              <DialogDescription>
                创建后将进入独立画布页面，可继续添加输入、模型与输出节点。
              </DialogDescription>
            </DialogHeader>
            <div className="py-5">
              <Label htmlFor="aigc-pipeline-name">画布名称</Label>
              <Input
                autoFocus
                className="mt-2"
                id="aigc-pipeline-name"
                maxLength={120}
                onChange={(event) => setNewPipelineName(event.target.value)}
                placeholder="例如：商品主图生成流程"
                value={newPipelineName}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => setIsCreateOpen(false)}
                type="button"
                variant="ghost"
              >
                取消
              </Button>
              <Button
                disabled={!newPipelineName.trim() || createMutation.isPending}
                type="submit"
              >
                {createMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CirclePlus className="h-4 w-4" />
                )}
                创建画布
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={changeDeleteDialog}
        open={deleteTarget !== null}
      >
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>
              删除{deleteTarget?.kind === "template" ? "画布模板" : "画布"}？
            </DialogTitle>
            <DialogDescription>
              即将删除
              {deleteTarget?.kind === "template" ? "模板" : "画布"}
              “{deleteTarget?.name}”。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <div
              className="mt-4 flex items-start gap-2 border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {deleteError}
            </div>
          ) : null}
          <DialogFooter className="mt-6">
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => changeDeleteDialog(false)}
              type="button"
              variant="ghost"
            >
              取消
            </Button>
            <Button
              disabled={!deleteTarget || deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
              type="button"
              variant="destructive"
            >
              {deleteMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AigcThumbnailDialog
        onOpenChange={(open) => {
          if (!open) setThumbnailPipeline(null);
        }}
        onUpdated={() => undefined}
        open={thumbnailPipeline !== null}
        pipeline={thumbnailPipeline}
      />
    </main>
  );
}

function ViewButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "flex min-h-9 flex-1 items-center justify-center gap-2 rounded px-4 text-sm font-semibold transition sm:flex-none",
        active
          ? "bg-slate-800 text-sky-300 shadow-sm"
          : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function AigcCard({
  busy,
  item,
  kind,
  onDelete,
  onSelectThumbnail,
  onOpen
}: {
  busy: boolean;
  item: AigcListItem;
  kind: "pipeline" | "template";
  onDelete: (target: DeleteTarget) => void;
  onSelectThumbnail: (pipeline: AigcPipeline) => void;
  onOpen: () => void;
}) {
  const pipeline = kind === "pipeline" ? (item as AigcPipeline) : null;
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string | null>(
    null
  );
  const normalizedDefinition = useMemo(
    () => migrateAigcDefinitionV2(item.definition),
    [item.definition]
  );
  const modelCount = countWorkspacePreviewModels(normalizedDefinition.nodes);
  const typeLabel = kind === "template" ? "模板" : "画布";

  function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onDelete({ id: item.id, kind, name: item.name });
  }

  function handleThumbnail(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (pipeline) onSelectThumbnail(pipeline);
  }

  const thumbnail = pipeline?.thumbnail ?? null;
  const shouldUseTopology =
    thumbnail === null || failedThumbnailUrl === thumbnail.url;

  return (
    <article
      className="group min-w-0 overflow-hidden border border-slate-700 bg-slate-950/90 shadow-[0_12px_28px_rgba(0,0,0,0.2)] transition hover:border-sky-400/65 hover:shadow-[0_16px_36px_rgba(14,165,233,0.16)] focus-within:border-sky-400/65"
      data-testid="aigc-card"
    >
      <button
        aria-label={`${kind === "template" ? "使用模板" : "打开画布"}：${item.name}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
        disabled={busy}
        onClick={onOpen}
        type="button"
      >
        {shouldUseTopology ? (
          <TopologyPreview definition={normalizedDefinition} />
        ) : (
          <PipelineThumbnailPreview
            onError={() => setFailedThumbnailUrl(thumbnail.url)}
            thumbnail={thumbnail}
          />
        )}
      </button>
      <div className="border-t border-slate-700 px-3 py-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <button
            className="min-w-0 text-left"
            disabled={busy}
            onClick={onOpen}
            type="button"
          >
            <span className="block truncate text-sm font-semibold text-slate-100 group-hover:text-sky-300">
              {item.name}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {kind === "template" ? (
              <Button
                asChild
                aria-label={`编辑模板：${item.name}`}
                size="icon"
                title="编辑模板"
                variant="ghost"
              >
                <a href={`/workspace/aigc/templates/${item.id}`}>
                  <Pencil className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <>
                <StatusBadge status={pipeline?.latest_run_status ?? null} />
                <Button
                  aria-label={`选择缩略图：${item.name}`}
                  disabled={busy}
                  onClick={handleThumbnail}
                  size="icon"
                  title="选择缩略图"
                  type="button"
                  variant="ghost"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              aria-label={`删除${typeLabel}：${item.name}`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              disabled={busy}
              onClick={handleDelete}
              size="icon"
              title={`删除${typeLabel}`}
              type="button"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">
          {item.description || "未填写说明"}
        </p>
        <div className="mt-3 flex flex-col gap-1 border-t border-slate-800 pt-2 text-[0.68rem] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <GitFork className="h-3.5 w-3.5" />
            {item.definition.nodes.length} 节点 · {modelCount} 模型
          </span>
          <time
            className="whitespace-nowrap"
            dateTime={item.updated_at}
            suppressHydrationWarning
          >
            {formatDate(item.updated_at)}
          </time>
        </div>
        <Button
          className={cn(
            "mt-3 w-full",
            kind === "template"
              ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
              : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          )}
          disabled={busy}
          onClick={onOpen}
          size="sm"
          type="button"
          variant={kind === "template" ? "signal" : "outline"}
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {kind === "template" ? "使用模板" : "打开画布"}
          {!busy ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>
      </div>
    </article>
  );
}

function PipelineThumbnailPreview({
  onError,
  thumbnail
}: {
  onError: () => void;
  thumbnail: NonNullable<AigcPipeline["thumbnail"]>;
}) {
  if (thumbnail.kind === "video") {
    return (
      <video
        aria-label="画布缩略图视频"
        className="aspect-[16/10] w-full bg-[#101821] object-contain"
        muted
        onError={onError}
        playsInline
        preload="metadata"
        src={thumbnail.url}
      />
    );
  }
  return (
    <>
      {/* Signed URLs are remote and short-lived, so Next optimization is unsuitable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="画布缩略图"
        className="aspect-[16/10] w-full bg-[#101821] object-contain"
        onError={onError}
        src={thumbnail.url}
      />
    </>
  );
}

function TopologyPreview({
  definition
}: {
  definition: AigcPipelineDefinitionV2;
}) {
  const layout = useMemo(() => normalizeWorkspaceTopology(definition.nodes), [
    definition.nodes
  ]);
  const points = new Map(layout.map((entry) => [entry.node.id, entry]));

  return (
    <div
      className="relative aspect-[16/10] overflow-hidden bg-[#101821]"
      data-testid="aigc-topology-preview"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(100,145,185,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,145,185,0.14)_1px,transparent_1px)] bg-[size:20px_20px]"
      />
      {definition.nodes.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center text-slate-500">
          <span className="flex items-center gap-2 text-xs">
            <Plus className="h-4 w-4" />
            空白画布
          </span>
        </div>
      ) : (
        <>
          <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
            {definition.edges.map((edge) => {
              const source = points.get(edge.sourceNodeId);
              const target = points.get(edge.targetNodeId);
              if (!source || !target) return null;
              return (
                <line
                  className="stroke-sky-400/35"
                  key={edge.id}
                  strokeWidth="1.5"
                  x1={`${source.x}%`}
                  x2={`${target.x}%`}
                  y1={`${source.y}%`}
                  y2={`${target.y}%`}
                />
              );
            })}
          </svg>
          {layout.map(({ node, x, y }) => (
            <TopologyNode key={node.id} node={node} x={x} y={y} />
          ))}
        </>
      )}
    </div>
  );
}

const previewToneClasses: Record<WorkspacePreviewTone, string> = {
  audio:
    "border-pink-400/60 bg-pink-400/25 shadow-[0_0_14px_rgba(244,114,182,0.22)]",
  image:
    "border-emerald-400/60 bg-emerald-400/25 shadow-[0_0_14px_rgba(52,211,153,0.22)]",
  neutral: "border-slate-500/60 bg-slate-500/25",
  text: "border-sky-400/60 bg-sky-400/25 shadow-[0_0_14px_rgba(56,189,248,0.22)]",
  video:
    "border-orange-400/60 bg-orange-400/25 shadow-[0_0_14px_rgba(251,146,60,0.22)]"
};

function TopologyNode({
  node,
  x,
  y
}: {
  node: AigcV2Node;
  x: number;
  y: number;
}) {
  const tone = getWorkspacePreviewNodeTone(node);

  return (
    <span
      className={cn(
        "absolute h-5 w-8 -translate-x-1/2 -translate-y-1/2 border",
        previewToneClasses[tone]
      )}
      data-testid={`aigc-preview-node-${tone}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      title={node.type}
    />
  );
}

function StatusBadge({ status }: { status: AigcPipelineRunStatus | null }) {
  if (!status) {
    return <Badge variant="secondary">未运行</Badge>;
  }
  const labels: Record<AigcPipelineRunStatus, string> = {
    canceled: "已取消",
    failed: "失败",
    queued: "排队中",
    running: "运行中",
    succeeded: "已完成"
  };
  const variant =
    status === "succeeded"
      ? "success"
      : status === "failed" || status === "canceled"
        ? "destructive"
        : "info";
  return <Badge variant={variant}>{labels[status]}</Badge>;
}

function LoadingState() {
  return (
    <div
      className="mt-5 grid min-h-64 place-items-center border border-slate-700 bg-slate-950/70"
      role="status"
    >
      <span className="flex items-center gap-2 text-sm text-slate-400">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        正在加载画布
      </span>
    </div>
  );
}

function EmptyState({
  hasQuery,
  onCreate,
  onReset,
  view
}: {
  hasQuery: boolean;
  onCreate: () => void;
  onReset: () => void;
  view: AigcView;
}) {
  return (
    <div className="mt-5 grid min-h-72 place-items-center border border-dashed border-slate-700 bg-slate-950/70 px-6 text-center">
      <div>
        <Workflow className="mx-auto h-8 w-8 text-sky-400" />
        <h2 className="mt-4 text-base font-semibold text-slate-100">
          {hasQuery
            ? "没有匹配的画布"
            : view === "templates"
              ? "暂无画布模板"
              : "还没有我的画布"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {hasQuery ? "调整名称关键词后重新筛选。" : "从空白画布开始建立生成流程。"}
        </p>
        <Button
          className="mt-5 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          onClick={hasQuery ? onReset : onCreate}
          type="button"
          variant="outline"
        >
          {hasQuery ? <Eraser className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {hasQuery ? "清空筛选" : "新建空白画布"}
        </Button>
      </div>
    </div>
  );
}

function Pagination({
  onPageChange,
  page,
  total,
  totalPages
}: {
  onPageChange: (page: number) => void;
  page: number;
  total: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="画布分页"
      className="mt-5 flex items-center justify-between border-t border-slate-700 pt-4"
    >
      <span className="text-xs text-slate-400">共 {total} 项</span>
      <div className="flex items-center gap-2">
        <Button
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-16 text-center text-xs text-slate-400">
          {page} / {totalPages}
        </span>
        <Button
          aria-label="下一页"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
