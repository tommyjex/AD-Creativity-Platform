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
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import type {
  AigcNode,
  AigcPage,
  AigcPipeline,
  AigcPipelineDefinition,
  AigcPipelineTemplate,
  AigcPipelineRunStatus
} from "@/lib/aigc/types";
import { formatDate } from "@/lib/project-display";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const EMPTY_DEFINITION: AigcPipelineDefinition = {
  schemaVersion: 1,
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
}

export function AigcWorkspace({
  initialError,
  initialPipelines,
  initialTemplates
}: AigcWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = useState<AigcView>("templates");
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
    <main className="w-full max-w-none px-3 py-6 sm:px-4 sm:py-8 lg:px-5">
      <header className="border-b border-border pb-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">
              DAG creation workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              AIGC 工作台
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              从模板快速建立生成流程，或维护可重复执行的节点画布。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {activeData?.total ?? 0} {view === "templates" ? "Templates" : "Pipelines"}
            </Badge>
            <Button onClick={() => setIsCreateOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              新建空白画布
            </Button>
          </div>
        </div>
      </header>

      <section className="mt-5 flex flex-col gap-3 border-b border-border pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div
          aria-label="AIGC 视图"
          className="flex w-full gap-1 rounded-lg border border-border bg-secondary/70 p-1 sm:w-fit"
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
              className="pl-9"
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
          <Button type="submit" variant="outline">
            筛选
          </Button>
        </form>
      </section>

      {errorMessage ? (
        <div
          className="mt-5 flex items-center justify-between gap-4 border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive"
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
            className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
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
              className="mt-4 flex items-start gap-2 border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive"
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
        "flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition sm:flex-none",
        active
          ? "bg-card text-primary shadow-sm"
          : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
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
  onOpen
}: {
  busy: boolean;
  item: AigcListItem;
  kind: "pipeline" | "template";
  onDelete: (target: DeleteTarget) => void;
  onOpen: () => void;
}) {
  const pipeline = kind === "pipeline" ? (item as AigcPipeline) : null;
  const modelCount = item.definition.nodes.filter((node) =>
    ["llm", "text_to_image", "image_to_image"].includes(node.type)
  ).length;
  const typeLabel = kind === "template" ? "模板" : "画布";

  function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onDelete({ id: item.id, kind, name: item.name });
  }

  return (
    <article className="group min-w-0 overflow-hidden border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <button
        aria-label={`${kind === "template" ? "使用模板" : "打开画布"}：${item.name}`}
        className="block w-full text-left"
        disabled={busy}
        onClick={onOpen}
        type="button"
      >
        <TopologyPreview definition={item.definition} />
      </button>
      <div className="border-t border-border px-3 py-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <button
            className="min-w-0 text-left"
            disabled={busy}
            onClick={onOpen}
            type="button"
          >
            <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">
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
              <StatusBadge status={pipeline?.latest_run_status ?? null} />
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
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
          {item.description || "暂无描述"}
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2 text-[0.68rem] text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitFork className="h-3.5 w-3.5" />
            {item.definition.nodes.length} 节点 · {modelCount} 模型
          </span>
          <time dateTime={item.updated_at} suppressHydrationWarning>
            {formatDate(item.updated_at)}
          </time>
        </div>
        <Button
          className="mt-3 w-full"
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

function TopologyPreview({
  definition
}: {
  definition: AigcPipelineDefinition;
}) {
  const layout = useMemo(() => normalizeTopology(definition.nodes), [definition.nodes]);
  const points = new Map(layout.map((entry) => [entry.node.id, entry]));

  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-secondary/55">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.42)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.42)_1px,transparent_1px)] bg-[size:20px_20px]" />
      {definition.nodes.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
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
                  className="stroke-primary/35"
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
            <span
              className={cn(
                "absolute h-5 w-8 -translate-x-1/2 -translate-y-1/2 border shadow-sm",
                nodeTone(node)
              )}
              key={node.id}
              style={{ left: `${x}%`, top: `${y}%` }}
              title={node.type}
            />
          ))}
        </>
      )}
    </div>
  );
}

function normalizeTopology(nodes: AigcNode[]) {
  if (nodes.length === 0) return [];
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const maxX = Math.max(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxY = Math.max(...nodes.map((node) => node.position.y));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  return nodes.map((node) => ({
    node,
    x: 14 + ((node.position.x - minX) / width) * 72,
    y: 18 + ((node.position.y - minY) / height) * 64
  }));
}

function nodeTone(node: AigcNode): string {
  if (node.type === "text_input" || node.type === "image_input") {
    return "border-info/45 bg-info/20";
  }
  if (node.type === "text_output" || node.type === "image_output") {
    return "border-success/45 bg-success/20";
  }
  return "border-primary/45 bg-primary/20";
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
      className="mt-5 grid min-h-64 place-items-center border border-border bg-card/60"
      role="status"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
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
    <div className="mt-5 grid min-h-72 place-items-center border border-dashed border-border bg-card/55 px-6 text-center">
      <div>
        <Workflow className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-base font-semibold text-foreground">
          {hasQuery
            ? "没有匹配的画布"
            : view === "templates"
              ? "暂无画布模板"
              : "还没有我的画布"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasQuery ? "调整名称关键词后重新筛选。" : "从空白画布开始建立生成流程。"}
        </p>
        <Button
          className="mt-5"
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
      className="mt-5 flex items-center justify-between border-t border-border pt-4"
    >
      <span className="text-xs text-muted-foreground">共 {total} 项</span>
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
        <span className="min-w-16 text-center text-xs text-muted-foreground">
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
