"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type NodeTypes,
  type Viewport
} from "@xyflow/react";
import type { Route } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  AudioLines,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  Files,
  ImageIcon,
  LoaderCircle,
  PanelLeft,
  PanelRight,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Type,
  Undo2,
  Video,
  Upload
} from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  useState
} from "react";
import {
  AigcFlowNodeCard,
  type AigcFlowNode
} from "@/components/workspace/aigc/aigc-flow-node";
import { AigcMediaAssetDialog } from "@/components/workspace/aigc/aigc-media-asset-dialog";
import { AigcPromptEditor } from "@/components/workspace/aigc/aigc-prompt-editor";
import {
  AigcLayerPreviewRunProvider,
  AigcRunActionsProvider,
  AigcRunProvider
} from "@/components/workspace/aigc/aigc-run-context";
import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";
import {
  AigcEditorStoreProvider,
  useAigcEditorStore,
  useAigcEditorStoreApi
} from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import { NodeCanvas } from "@/components/workspace/canvas/node-canvas";
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
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  getUserFacingErrorMessage,
  isApiError
} from "@/lib/api-client";
import { AIGC_NODE_REGISTRY, AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import type { AigcEditorStore } from "@/lib/aigc/editor-store";
import { connectionBreaksBboxReferences } from "@/lib/aigc/bbox-references";
import {
  getAigcImageDownload,
  getAigcVideoDownload
} from "@/lib/aigc/download";
import { isSelectableMediaAsset } from "@/lib/aigc/media-assets";
import {
  AIGC_MEDIA_ACCEPT,
  aigcMediaCompatibility,
  layerDecompositionCompatibility,
  validateLayerDecompositionFile,
  validateAigcMediaFile
} from "@/lib/aigc/media-validation";
import { getAigcModalityColors } from "@/lib/aigc/modality-colors";
import {
  isAigcVideoResult,
  projectAigcLayerCompositeResult,
  projectAigcVideoResult
} from "@/lib/aigc/result-projection";
import {
  isSeedreamImageEdgeIncompatible,
  isSeedreamImageInputActive,
  isSeedreamImageOutputActive,
  seedreamImageInputLimit,
  seedreamImageTitle,
  validateLayerDecompositionAssets,
  validateSeedreamImageDefinition
} from "@/lib/aigc/seedream-image";
import {
  isVideoEdgeIncompatible,
  isVideoPortActive,
  seedancePromptLengthWarning,
  validateVideoGenerationAssets,
  validateVideoGenerationDefinition,
  videoInputLimit
} from "@/lib/aigc/video-generation";
import {
  isAigcRunActive,
  layerPreviewFallbackRunId,
  newestActiveOrRecentRun,
  useAigcRun,
  useAigcRuns,
  useCancelAigcRun,
  useCreateAigcRun,
  useRetryAigcNode
} from "@/lib/aigc/queries";
import {
  formatAigcDuration,
  formatAigcEndTime,
  formatAigcLogTime,
  getAigcNodeLogError,
  getAigcRunLogError,
  latestRelevantAttempt,
  type AigcLogError
} from "@/lib/aigc/run-log";
import type {
  AigcEdge,
  AigcImageOperation,
  AigcNode,
  AigcNodeType,
  AigcPipeline,
  AigcPipelineRun,
  AigcPipelineRunDetail,
  AigcPipelineTemplate,
  AigcVideoGenerationMode
} from "@/lib/aigc/types";
import type { Asset, ReferenceAssetKind } from "@/lib/api-types";
import { getSafeAssetContentUrl } from "@/lib/asset-display";
import {
  SEEDANCE_ASPECT_RATIOS,
  SEEDANCE_CAPABILITIES,
  SEEDANCE_MODELS,
  normalizeSeedanceVideoParameters,
  seedanceInputDurationLimit,
  seedanceVideoInputMinimum,
  type SeedanceAspectRatio,
  type SeedanceModel,
  type SeedanceResolution,
  type SeedanceTaskType
} from "@/lib/seedance";
import { cn } from "@/lib/utils";

const AIGC_NODE_TYPES = Object.fromEntries(
  AIGC_NODE_REGISTRY.map((item) => [item.type, AigcFlowNodeCard])
) as NodeTypes;

type EditorEntity = AigcPipeline | AigcPipelineTemplate;
type InspectorTab = "config" | "result" | "run";

export function AigcEditor({
  allowExecution = true,
  entity,
  mode,
  store
}: {
  allowExecution?: boolean;
  entity: EditorEntity;
  mode: "pipeline" | "template";
  store?: AigcEditorStore;
}) {
  const initialState = useMemo(
    () => ({
      definition: entity.definition,
      description: entity.description,
      entityId: entity.id,
      mode,
      name: entity.name,
      revision: entity.revision
    }),
    [entity, mode]
  );

  return (
    <AigcEditorStoreProvider initialState={initialState} store={store}>
      <AigcEditorContent
        allowExecution={allowExecution}
        entity={entity}
        key={`${mode}:${entity.id}:${entity.revision}`}
        mode={mode}
      />
    </AigcEditorStoreProvider>
  );
}

function AigcEditorContent({
  allowExecution,
  entity,
  mode
}: {
  allowExecution: boolean;
  entity: EditorEntity;
  mode: "pipeline" | "template";
}) {
  const editorStore = useAigcEditorStoreApi();
  const definition = useAigcEditorStore((state) => state.definition);
  const name = useAigcEditorStore((state) => state.name);
  const description = useAigcEditorStore((state) => state.description);
  const revision = useAigcEditorStore((state) => state.revision);
  const dirty = useAigcEditorStore((state) => state.dirty);
  const past = useAigcEditorStore((state) => state.past);
  const future = useAigcEditorStore((state) => state.future);
  const selectedNodeId = useAigcEditorStore((state) => state.selectedNodeId);
  const addNode = useAigcEditorStore((state) => state.addNode);
  const connect = useAigcEditorStore((state) => state.connect);
  const markSaved = useAigcEditorStore((state) => state.markSaved);
  const moveNode = useAigcEditorStore((state) => state.moveNode);
  const removeEdge = useAigcEditorStore((state) => state.removeEdge);
  const removeNode = useAigcEditorStore((state) => state.removeNode);
  const selectNode = useAigcEditorStore((state) => state.selectNode);
  const setDescription = useAigcEditorStore((state) => state.setDescription);
  const setName = useAigcEditorStore((state) => state.setName);
  const setViewport = useAigcEditorStore((state) => state.setViewport);
  const undo = useAigcEditorStore((state) => state.undo);
  const redo = useAigcEditorStore((state) => state.redo);
  const [nodes, setNodes] = useState<AigcFlowNode[]>(() =>
    entity.definition.nodes.map(toFlowNode)
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    entity.definition.edges.map((edge) =>
      toFlowEdge(edge, entity.definition.nodes, entity.definition.edges)
    )
  );
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("config");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState(entity.name);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"nodes" | "inspector" | null>(
    null
  );
  const isDesktop = useDesktopLayout();
  const runsQuery = useAigcRuns(entity.id, undefined, mode === "pipeline");
  const validationAssets = useQuery({
    enabled: mode === "pipeline",
    queryKey: ["aigc", "media-validation-assets"],
    queryFn: loadAigcMediaAssets
  });
  const preferredRun = newestActiveOrRecentRun(runsQuery.data?.items ?? []);
  const visibleRunId = selectedRunId ?? preferredRun?.id ?? null;
  const runQuery = useAigcRun(mode === "pipeline" ? visibleRunId : null);
  const createRun = useCreateAigcRun(entity.id);
  const retryNode = useRetryAigcNode(entity.id);
  const cancelRun = useCancelAigcRun(entity.id);
  const runDetail = runQuery.data;
  const previewFallbackRunId = layerPreviewFallbackRunId(
    runsQuery.data?.items ?? [],
    runDetail
  );
  const previewRunQuery = useAigcRun(
    mode === "pipeline" ? previewFallbackRunId : null
  );

  useEffect(
    () =>
      editorStore.subscribe((state, previous) => {
        if (state.definition.nodes !== previous.definition.nodes) {
          setNodes(state.definition.nodes.map(toFlowNode));
          setEdges(
            state.definition.edges.map((edge) =>
              toFlowEdge(edge, state.definition.nodes, state.definition.edges)
            )
          );
        }
        if (state.definition.edges !== previous.definition.edges) {
          setEdges(
            state.definition.edges.map((edge) =>
              toFlowEdge(edge, state.definition.nodes, state.definition.edges)
            )
          );
        }
      }),
    [editorStore]
  );

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!editorStore.getState().dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [editorStore]);

  const selectedNode = definition.nodes.find(
    (node) => node.id === selectedNodeId
  ) ?? null;

  const onNodesChange = useCallback(
    (changes: NodeChange<AigcFlowNode>[]) => {
      for (const change of changes) {
        if (change.type === "remove") removeNode(change.id);
        if (change.type === "select" && change.selected) selectNode(change.id);
      }
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [removeNode, selectNode]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === "remove") removeEdge(change.id);
      }
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [removeEdge]
  );
  const onConnect = useCallback(
    (connection: Connection) => {
      const validationError = getAigcConnectionValidationError(
        connection,
        definition.nodes,
        definition.edges
      );
      if (validationError) {
        setFeedback(
          connectionValidationFeedback(
            validationError,
            connection,
            definition.nodes
          )
        );
        return;
      }
      const edge = connectionToDomainEdge(connection);
      connect(edge);
      setEdges((current) =>
        addEdge(
          toFlowEdge(edge, definition.nodes, [...definition.edges, edge]),
          current
        )
      );
      setFeedback(null);
    },
    [connect, definition.edges, definition.nodes]
  );
  const validateConnection = useCallback(
    (connection: Connection | Edge) => {
      const validationError = getAigcConnectionValidationError(
        connection,
        definition.nodes,
        definition.edges
      );
      if (
        validationError === "target_connection_limit" ||
        validationError === "bbox_reference_conflict" ||
        validationError === "input_not_allowed_for_mode" ||
        validationError === "output_not_allowed_for_mode" ||
        validationError === "port_type_mismatch"
      ) {
        setFeedback(
          connectionValidationFeedback(
            validationError,
            connection,
            definition.nodes
          )
        );
      }
      return validationError === null;
    },
    [definition.edges, definition.nodes]
  );

  async function save(): Promise<boolean> {
    const state = editorStore.getState();
    if (!state.name.trim()) return false;
    const validationIssue = definitionValidationIssue(state.definition);
    if (validationIssue) {
      setFeedback(validationIssue);
      return false;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved =
        mode === "template"
          ? await apiClient.updateAigcTemplate(entity.id, {
              expected_revision: state.revision,
              name: state.name.trim(),
              description: state.description.trim(),
              definition: structuredClone(state.definition)
            })
          : await apiClient.updateAigcPipeline(entity.id, {
              expected_revision: state.revision,
              name: state.name.trim(),
              description: state.description.trim(),
              definition: structuredClone(state.definition)
            });
      markSaved(saved.revision);
      setFeedback(`已保存 Revision ${saved.revision}`);
      return true;
    } catch (error) {
      setFeedback(
        isApiError(error) && error.status === 409
          ? "保存冲突：服务端已有更新，请刷新后重新编辑。"
          : getUserFacingErrorMessage(error)
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAsTemplate() {
    if (mode !== "pipeline") return;
    const normalizedName = templateName.trim();
    if (!normalizedName) {
      setTemplateError("请输入模板名称。");
      return;
    }
    setTemplateError(null);
    if (editorStore.getState().dirty && !(await save())) {
      setTemplateError("画布保存失败，请解决保存问题后重试。");
      return;
    }
    setIsSavingTemplate(true);
    try {
      const state = editorStore.getState();
      await apiClient.saveAigcPipelineAsTemplate(entity.id, {
        name: normalizedName,
        description: state.description.trim()
      });
      setFeedback(`已保存为模板：${normalizedName}`);
      setSaveTemplateOpen(false);
    } catch (error) {
      setTemplateError(getUserFacingErrorMessage(error));
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function execute(
    startNodeId?: string,
    options: { saveDirty?: boolean } = {}
  ) {
    if (
      !allowExecution ||
      mode !== "pipeline" ||
      isAigcRunActive(runDetail)
    ) {
      return;
    }
    const validationIssue = definitionValidationIssue(
      editorStore.getState().definition
    );
    if (validationIssue) {
      setFeedback(validationIssue);
      return;
    }
    const currentDefinition = editorStore.getState().definition;
    let validationAssetData = validationAssets.data;
    if (validationAssetData === undefined) {
      const result = await validationAssets.refetch();
      validationAssetData = result.data;
      if (validationAssetData === undefined) {
        setFeedback("媒体资产预检加载失败，请重试。");
        return;
      }
    }
    const assetValidationIssue = currentDefinition.nodes.flatMap<{
      message: string;
      nodeId: string;
    }>((node) =>
      node.type === "video_generation"
        ? validateVideoGenerationAssets(
            currentDefinition,
            node.id,
            validationAssetData
          )
        : node.type === "image_to_image"
          ? validateLayerDecompositionAssets(
              currentDefinition,
              node.id,
              validationAssetData
            )
          : []
    )[0];
    if (assetValidationIssue) {
      setFeedback(
        assetValidationIssue.nodeId &&
          currentDefinition.nodes.find(
            (node) =>
              node.id === assetValidationIssue.nodeId &&
              node.type === "image_to_image"
          )
          ? seedreamValidationFeedback(assetValidationIssue)
          : videoValidationFeedback(assetValidationIssue)
      );
      return;
    }
    if (editorStore.getState().dirty) {
      if (options.saveDirty === false) {
        setFeedback("主画布有未保存修改，请先保存 Pipeline 后再从此节点继续。");
        return;
      }
      if (!(await save())) return;
    }
    setFeedback(null);
    try {
      const detail = await createRun.mutateAsync({
        expected_revision: editorStore.getState().revision,
        mode: startNodeId ? "from_node" : "full",
        start_node_id: startNodeId ?? null
      });
      setSelectedRunId(detail.run.id);
      setInspectorTab("run");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function retryFailedNode(runId: string, nodeId: string) {
    try {
      const detail = await retryNode.mutateAsync({ nodeId, runId });
      setSelectedRunId(detail.run.id);
      setInspectorTab("run");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function cancelActiveRun(runId: string) {
    try {
      await cancelRun.mutateAsync(runId);
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  function leave(event: MouseEvent<HTMLAnchorElement>) {
    if (dirty && !window.confirm("存在未保存的画布修改，确定离开吗？")) {
      event.preventDefault();
    }
  }

  return (
    <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-background">
      <header
        className="flex shrink-0 flex-col gap-1 border-b border-border bg-card px-3 py-1 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-0"
        data-testid="aigc-editor-header"
      >
        <div
          className="flex h-9 w-full min-w-0 items-center gap-2 sm:h-auto sm:flex-1"
          data-testid="aigc-editor-title-row"
        >
          <Button asChild size="icon" title="返回 AIGC 工作台" variant="ghost">
            <Link href={"/workspace/aigc" as Route} onClick={leave}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1
                className="min-w-0 flex-1 truncate text-sm font-semibold"
                data-testid="aigc-editor-title"
              >
                {name}
              </h1>
              <Badge
                className="shrink-0"
                variant={mode === "template" ? "info" : "secondary"}
              >
                {mode === "template" ? "模板编辑" : `Revision ${revision}`}
              </Badge>
              {dirty ? (
                <Badge className="shrink-0" variant="warning">
                  未保存
                </Badge>
              ) : null}
            </div>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {description || "暂无描述"}
            </p>
          </div>
        </div>
        <div
          className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto"
          data-testid="aigc-editor-actions"
        >
          <Button
            aria-label="撤销"
            data-testid="aigc-command-undo"
            disabled={past.length === 0}
            onClick={undo}
            size="icon"
            title="撤销"
            type="button"
            variant="ghost"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            aria-label="重做"
            data-testid="aigc-command-redo"
            disabled={future.length === 0}
            onClick={redo}
            size="icon"
            title="重做"
            type="button"
            variant="ghost"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          {mode === "pipeline" ? (
            <>
              <Button
                aria-label="另存为模板"
                data-testid="aigc-command-save-template"
                disabled={isSaving || isSavingTemplate}
                onClick={() => {
                  setTemplateName(editorStore.getState().name);
                  setTemplateError(null);
                  setSaveTemplateOpen(true);
                }}
                size="sm"
                title="另存为模板"
                type="button"
                variant="ghost"
              >
                {isSavingTemplate ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Files className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">另存为模板</span>
              </Button>
              <Button
                aria-label={isAigcRunActive(runDetail) ? "运行中" : "执行"}
                data-testid="aigc-command-execute"
                disabled={
                  !allowExecution ||
                  createRun.isPending ||
                  isAigcRunActive(runDetail) ||
                  !definition.nodes.some((node) =>
                    [
                      "llm",
                      "text_to_image",
                      "image_to_image",
                      "video_generation"
                    ].includes(node.type)
                  )
                }
                onClick={() => void execute()}
                size="sm"
                title={isAigcRunActive(runDetail) ? "运行中" : "执行"}
                variant="outline"
              >
                {createRun.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isAigcRunActive(runDetail) ? "运行中" : "执行"}
                </span>
              </Button>
            </>
          ) : null}
          <Button
            aria-label="保存"
            data-testid="aigc-command-save"
            disabled={!dirty || isSaving || !name.trim()}
            onClick={() => void save()}
            size="sm"
            title="保存"
            type="button"
          >
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">保存</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {isDesktop ? <NodePalette onAdd={addNode} /> : null}
        <section className="relative min-w-0 flex-1">
          {!isDesktop ? (
            <div className="absolute left-3 top-3 z-30 flex gap-1 border border-border bg-card p-1 shadow-md">
              <Button
                aria-label="打开节点面板"
                onClick={() =>
                  setMobilePanel((current) =>
                    current === "nodes" ? null : "nodes"
                  )
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button
                aria-label="打开检查器"
                onClick={() =>
                  setMobilePanel((current) =>
                    current === "inspector" ? null : "inspector"
                  )
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <AigcRunActionsProvider
            value={{
              continueFromNode: (nodeId) =>
                void execute(nodeId, { saveDirty: false }),
              pending:
                createRun.isPending || isAigcRunActive(runDetail)
            }}
          >
            <AigcRunProvider value={runDetail ?? null}>
              <AigcLayerPreviewRunProvider
                value={previewRunQuery.data ?? null}
              >
                <NodeCanvas<AigcFlowNode>
                  edges={edges}
                  nodeTypes={AIGC_NODE_TYPES}
                  nodes={nodes}
                  onNodeDragStop={(_, node) =>
                    moveNode(node.id, { x: node.position.x, y: node.position.y })
                  }
                  onNodesChange={onNodesChange}
                  reactFlowProps={{
                    ...(isDesktop
                      ? {}
                      : {
                          fitViewOptions: { minZoom: 0.25 },
                          minZoom: 0.25
                        }),
                    defaultViewport: definition.viewport,
                    deleteKeyCode: ["Backspace", "Delete"],
                    edgesReconnectable: false,
                    isValidConnection: validateConnection,
                    onConnect,
                    onEdgesChange,
                    onMoveEnd: (_, viewport: Viewport) => setViewport(viewport),
                    onNodeClick: (_, node) => selectNode(node.id),
                    onPaneClick: () => selectNode(null),
                    snapGrid: [16, 16],
                    snapToGrid: true
                  }}
                />
              </AigcLayerPreviewRunProvider>
            </AigcRunProvider>
          </AigcRunActionsProvider>
          {feedback ? (
            <div
              className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 border border-border bg-card px-3 py-2 text-xs shadow-md"
              role="status"
            >
              {feedback}
            </div>
          ) : null}
          {!isDesktop && mobilePanel === "nodes" ? (
            <NodePalette
              className="absolute inset-y-0 left-0 z-20 w-60 shadow-xl"
              onAdd={(type) => {
                addNode(type);
                setMobilePanel(null);
              }}
            />
          ) : null}
          {!isDesktop && mobilePanel === "inspector" ? (
            <Inspector
              className="absolute inset-y-0 right-0 z-20 w-72 shadow-xl"
              allowExecution={allowExecution}
              mode={mode}
              node={selectedNode}
              onCancelRun={(runId) => void cancelActiveRun(runId)}
              onDescriptionChange={setDescription}
              onExecuteNode={(nodeId) => void execute(nodeId)}
              onNameChange={setName}
              onRetryNode={(runId, nodeId) =>
                void retryFailedNode(runId, nodeId)
              }
              onSelectRun={setSelectedRunId}
              onTabChange={setInspectorTab}
              runDetail={runDetail}
              runs={runsQuery.data?.items ?? []}
              tab={inspectorTab}
            />
          ) : null}
        </section>
        {isDesktop ? (
          <Inspector
            allowExecution={allowExecution}
            mode={mode}
            node={selectedNode}
            onCancelRun={(runId) => void cancelActiveRun(runId)}
            onDescriptionChange={setDescription}
            onExecuteNode={(nodeId) => void execute(nodeId)}
            onNameChange={setName}
            onRetryNode={(runId, nodeId) =>
              void retryFailedNode(runId, nodeId)
            }
            onSelectRun={setSelectedRunId}
            onTabChange={setInspectorTab}
            runDetail={runDetail}
            runs={runsQuery.data?.items ?? []}
            tab={inspectorTab}
          />
        ) : null}
      </div>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (isSavingTemplate) return;
          setSaveTemplateOpen(nextOpen);
          if (!nextOpen) setTemplateError(null);
        }}
        open={saveTemplateOpen}
      >
        <DialogContent className="max-w-md p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveAsTemplate();
            }}
          >
            <DialogHeader>
              <DialogTitle>另存为模板</DialogTitle>
              <DialogDescription>
                当前画布将保存为可复用模板，具体图片和框选引用不会写入模板。
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5">
              <Label htmlFor="save-template-name">模板名称</Label>
              <Input
                autoFocus
                className="mt-1.5"
                id="save-template-name"
                maxLength={120}
                onChange={(event) => {
                  setTemplateName(event.target.value);
                  setTemplateError(null);
                }}
                value={templateName}
              />
              {templateError ? (
                <p className="mt-2 text-xs text-destructive" role="alert">
                  {templateError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="mt-6">
              <Button
                disabled={isSavingTemplate}
                onClick={() => setSaveTemplateOpen(false)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
              <Button
                disabled={isSavingTemplate || !templateName.trim()}
                type="submit"
              >
                {isSavingTemplate ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Files className="h-4 w-4" />
                )}
                {isSavingTemplate ? "保存中" : "保存模板"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function NodePalette({
  className,
  onAdd
}: {
  className?: string;
  onAdd: (type: AigcNodeType) => void;
}) {
  return (
    <aside
      className={cn(
        "w-60 shrink-0 overflow-y-auto border-r border-border bg-card p-3",
        className
      )}
    >
      <h2 className="text-xs font-semibold text-foreground">节点</h2>
      <p className="mt-1 text-[11px] text-muted-foreground">点击添加到画布</p>
      {(["input", "model", "control", "output"] as const).map((category) => (
        <div className="mt-4" key={category}>
          <p className="mb-1.5 font-mono text-[10px] uppercase text-muted-foreground">
            {category}
          </p>
          <div className="space-y-1">
            {AIGC_NODE_REGISTRY.filter(
              (item) => item.category === category
            ).map((item) => (
              <button
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-foreground hover:bg-secondary"
                key={item.type}
                onClick={() => onAdd(item.type)}
                type="button"
              >
                {item.type.includes("image") ? (
                  <ImageIcon className="h-4 w-4 text-info" />
                ) : item.type.includes("video") ? (
                  <Video className="h-4 w-4 text-info" />
                ) : item.type.includes("audio") ? (
                  <AudioLines className="h-4 w-4 text-info" />
                ) : item.type.includes("text") ? (
                  <Type className="h-4 w-4 text-info" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

function Inspector({
  allowExecution,
  className,
  mode,
  node,
  onCancelRun,
  onDescriptionChange,
  onExecuteNode,
  onNameChange,
  onRetryNode,
  onSelectRun,
  onTabChange,
  runDetail,
  runs,
  tab
}: {
  allowExecution: boolean;
  className?: string;
  mode: "pipeline" | "template";
  node: AigcNode | null;
  onCancelRun: (runId: string) => void;
  onDescriptionChange: (value: string) => void;
  onExecuteNode: (nodeId: string) => void;
  onNameChange: (value: string) => void;
  onRetryNode: (runId: string, nodeId: string) => void;
  onSelectRun: (runId: string) => void;
  onTabChange: (tab: InspectorTab) => void;
  runDetail: AigcPipelineRunDetail | undefined;
  runs: AigcPipelineRun[];
  tab: InspectorTab;
}) {
  const name = useAigcEditorStore((state) => state.name);
  const description = useAigcEditorStore((state) => state.description);
  return (
    <aside
      className={cn(
        "w-72 shrink-0 overflow-y-auto border-l border-border bg-card",
        className
      )}
    >
      <div className="grid grid-cols-3 border-b border-border p-1">
        {(["config", "result", "run"] as const).map((item) => (
          <button
            aria-selected={tab === item}
            className={cn(
              "h-8 rounded text-xs font-semibold",
              tab === item
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={item}
            onClick={() => onTabChange(item)}
            role="tab"
            type="button"
          >
            {item === "config" ? "配置" : item === "result" ? "结果" : "运行"}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === "config" ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="aigc-editor-name">名称</Label>
              <Input
                className="mt-1.5"
                id="aigc-editor-name"
                maxLength={120}
                onChange={(event) => onNameChange(event.target.value)}
                value={name}
              />
            </div>
            <div>
              <Label htmlFor="aigc-editor-description">描述</Label>
              <Textarea
                className="mt-1.5 min-h-20"
                id="aigc-editor-description"
                maxLength={500}
                onChange={(event) => onDescriptionChange(event.target.value)}
                value={description}
              />
            </div>
            <div className="border-t border-border pt-4">
              {node ? <NodeConfig mode={mode} node={node} /> : <InspectorEmpty />}
            </div>
            {allowExecution &&
            mode === "pipeline" &&
            node &&
            [
              "llm",
              "text_to_image",
              "image_to_image",
              "video_generation"
            ].includes(node.type) ? (
              <Button
                className="w-full"
                disabled={isAigcRunActive(runDetail)}
                onClick={() => onExecuteNode(node.id)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Play className="h-4 w-4" />
                从此节点运行
              </Button>
            ) : null}
          </div>
        ) : tab === "result" ? (
          <ResultPanel nodeId={node?.id ?? null} runDetail={runDetail} />
        ) : (
          mode === "template" ? (
            <InspectorPlaceholder
              copy="模板不可执行，请先创建画布实例。"
              title="模板编辑模式"
            />
          ) : (
            <RunPanel
              onCancel={onCancelRun}
              onRetry={onRetryNode}
              onSelectRun={onSelectRun}
              runDetail={runDetail}
              runs={runs}
            />
          )
        )}
      </div>
    </aside>
  );
}

function NodeConfig({
  mode,
  node
}: {
  mode: "pipeline" | "template";
  node: AigcNode;
}) {
  const update = useAigcEditorStore((state) => state.updateNodeConfig);
  const registration = AIGC_NODE_REGISTRY_BY_TYPE.get(node.type);

  if (node.type === "text_input") {
    return (
      <ConfigGroup title={registration?.label ?? node.type}>
        <AigcPromptEditor node={node} />
      </ConfigGroup>
    );
  }
  if (node.type === "image_input") {
    return <MediaInputConfig mode={mode} node={node} />;
  }
  if (node.type === "video_input" || node.type === "audio_input") {
    return <MediaInputConfig mode={mode} node={node} />;
  }
  if (node.type === "llm") {
    return (
      <ConfigGroup title={registration?.label ?? node.type}>
        <Label htmlFor="node-model">模型</Label>
        <select
          className="mt-1.5 h-10 w-full rounded-md border border-input bg-card px-2 text-xs"
          id="node-model"
          onChange={(event) =>
            update(node.id, { ...node.config, model: event.target.value })
          }
          value={node.config.model}
        >
          {registration?.models.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
        <Label className="mt-3 block" htmlFor="node-system">System Prompt</Label>
        <Textarea
          className="mt-1.5 min-h-24"
          id="node-system"
          onChange={(event) =>
            update(node.id, {
              ...node.config,
              system_prompt: event.target.value
            })
          }
          value={node.config.system_prompt}
        />
      </ConfigGroup>
    );
  }
  if (
    node.type === "text_output" ||
    node.type === "image_output" ||
    node.type === "video_output"
  ) {
    return (
      <ConfigGroup title={registration?.label ?? node.type}>
        <Label htmlFor="node-title">结果标题</Label>
        <Input
          className="mt-1.5"
          id="node-title"
          onChange={(event) => update(node.id, { title: event.target.value })}
          value={node.config.title}
        />
      </ConfigGroup>
    );
  }
  if (node.type === "video_generation") {
    return <VideoGenerationConfig node={node} />;
  }
  if (node.type === "image_to_image") {
    return <SeedreamImageConfig node={node} />;
  }
  if (node.type === "layer_canvas" || node.type === "layer_composite") {
    return (
      <ConfigGroup title={registration?.label ?? node.type}>
        <p className="text-xs leading-5 text-muted-foreground">
          图层配置将在对应的图层工作流中编辑。
        </p>
      </ConfigGroup>
    );
  }
  return (
    <ConfigGroup title={registration?.label ?? node.type}>
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="画幅"
          onChange={(value) =>
            update(node.id, {
              ...node.config,
              aspect_ratio: value as typeof node.config.aspect_ratio
            })
          }
          options={["1:1", "16:9", "9:16", "4:3", "3:4"]}
          value={node.config.aspect_ratio}
        />
        <SelectField
          label="尺寸"
          onChange={(value) =>
            update(node.id, {
              ...node.config,
              size: value as typeof node.config.size
            })
          }
          options={["1K", "1.5K", "2K"]}
          value={node.config.size}
        />
      </div>
    </ConfigGroup>
  );
}

const SEEDREAM_IMAGE_OPERATION_OPTIONS: {
  label: string;
  value: AigcImageOperation;
}[] = [
  { label: "图生图", value: "image_to_image" },
  { label: "图片编辑", value: "image_edit" },
  { label: "图层拆分", value: "layer_decomposition" }
];

function SeedreamImageConfig({
  node
}: {
  node: Extract<AigcNode, { type: "image_to_image" }>;
}) {
  const update = useAigcEditorStore((state) => state.updateNodeConfig);
  const definition = useAigcEditorStore((state) => state.definition);
  const operation = node.config.operation ?? "image_to_image";
  const validationAssets = useQuery({
    queryKey: ["aigc", "media-validation-assets"],
    queryFn: loadAigcMediaAssets
  });
  const definitionIssue = validateSeedreamImageDefinition(definition).find(
    (candidate) => candidate.nodeId === node.id
  );
  const assetIssue = validateLayerDecompositionAssets(
    definition,
    node.id,
    validationAssets.data ?? []
  )[0];
  const issue = definitionIssue ?? assetIssue;

  return (
    <ConfigGroup title={seedreamImageTitle(node)}>
      <div className="space-y-3">
        <div>
          <Label>操作模式</Label>
          <div
            aria-label="操作模式"
            className="mt-1.5 grid grid-cols-3 rounded-md border border-input bg-muted/40 p-0.5"
            role="group"
          >
            {SEEDREAM_IMAGE_OPERATION_OPTIONS.map((option) => (
              <button
                aria-pressed={operation === option.value}
                className={cn(
                  "h-8 rounded px-1 text-[11px] font-semibold transition-colors",
                  operation === option.value
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                key={option.value}
                onClick={() =>
                  update(node.id, {
                    ...node.config,
                    operation: option.value,
                    size:
                      option.value === "layer_decomposition"
                        ? "auto"
                        : node.config.size === "auto"
                          ? "2K"
                          : node.config.size
                  })
                }
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/25 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
          <p className="font-medium text-foreground">Seedream 5.0 Pro</p>
          <p>
            {operation === "image_to_image"
              ? "连接 1-10 张参考图和必填提示词，输出新图片。"
              : operation === "image_edit"
                ? "连接一张编辑图片或一个编辑图层，并连接必填提示词。"
                : "连接一张 PNG/JPEG；提示词可选，留空时自动识别主要元素。"}
          </p>
        </div>
        {operation === "layer_decomposition" ? (
          <>
            <SelectField
              label="拆分尺寸"
              onChange={(value) =>
                update(node.id, {
                  ...node.config,
                  size: value as typeof node.config.size
                })
              }
              options={[
                { label: "自动", value: "auto" },
                "1K",
                "1.5K",
                "2K"
              ]}
              value={node.config.size}
            />
            <p className="text-[10px] leading-4 text-muted-foreground">
              输入比例 1:16-16:1，总像素 262,144-36,000,000，文件小于 30 MB。
            </p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label="画幅"
                onChange={(value) =>
                  update(node.id, {
                    ...node.config,
                    aspect_ratio: value as typeof node.config.aspect_ratio
                  })
                }
                options={["1:1", "16:9", "9:16", "4:3", "3:4"]}
                value={node.config.aspect_ratio}
              />
              <SelectField
                label="尺寸"
                onChange={(value) =>
                  update(node.id, {
                    ...node.config,
                    size: value as typeof node.config.size
                  })
                }
                options={["1K", "1.5K", "2K"]}
                value={node.config.size}
              />
            </div>
            <SelectField
              label="输出格式"
              onChange={(value) =>
                update(node.id, {
                  ...node.config,
                  format: value as typeof node.config.format
                })
              }
              options={[
                { label: "PNG", value: "png" },
                { label: "JPEG", value: "jpeg" }
              ]}
              value={node.config.format}
            />
          </>
        )}
        {issue ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive"
            role="alert"
          >
            {issue.message}
          </p>
        ) : null}
      </div>
    </ConfigGroup>
  );
}

const VIDEO_MODE_OPTIONS: {
  label: string;
  value: AigcVideoGenerationMode;
}[] = [
  { label: "文生视频", value: "text_to_video" },
  { label: "首帧图生视频", value: "first_frame" },
  { label: "首尾帧图生视频", value: "first_last_frame" },
  { label: "全模态参考生视频", value: "multimodal_reference" }
];

const VIDEO_TASK_TYPE_OPTIONS: {
  label: string;
  value: SeedanceTaskType;
}[] = [
  { label: "生成新视频", value: "generate" },
  { label: "编辑视频", value: "edit" },
  { label: "延长视频", value: "extend" }
];

function VideoGenerationConfig({
  node
}: {
  node: Extract<AigcNode, { type: "video_generation" }>;
}) {
  const update = useAigcEditorStore((state) => state.updateNodeConfig);
  const definition = useAigcEditorStore((state) => state.definition);
  const capabilities = SEEDANCE_CAPABILITIES[node.config.model];
  const validationAssets = useQuery({
    queryKey: ["aigc", "video-validation-assets"],
    queryFn: loadAigcMediaAssets
  });
  const definitionIssue = validateVideoGenerationDefinition(definition).find(
    (candidate) => candidate.nodeId === node.id
  );
  const assetIssue = validateVideoGenerationAssets(
    definition,
    node.id,
    validationAssets.data ?? []
  )[0];
  const issue = definitionIssue ?? assetIssue;
  const promptEdge = definition.edges.find(
    (edge) => edge.targetNodeId === node.id && edge.targetHandle === "prompt"
  );
  const promptNode = definition.nodes.find(
    (candidate) => candidate.id === promptEdge?.sourceNodeId
  );
  const promptWarning = seedancePromptLengthWarning(
    promptNode?.type === "text_input" ? promptNode.config.text : ""
  );
  const supportedLanguages = capabilities.promptLanguages.join("、");
  const inputDurationMaximum = seedanceInputDurationLimit(node.config.model);
  const inputVideoMinimum = seedanceVideoInputMinimum(
    node.config.model,
    node.config.task_type ?? "generate"
  );

  function updateModel(model: SeedanceModel) {
    const normalized = normalizeSeedanceVideoParameters(model, node.config);
    update(node.id, {
      ...node.config,
      model,
      duration_seconds: normalized.duration_seconds,
      resolution: normalized.resolution
    });
  }

  return (
    <ConfigGroup title="生视频">
      <div className="space-y-3">
        <SelectField
          label="模型"
          onChange={(value) => updateModel(value as SeedanceModel)}
          options={SEEDANCE_MODELS.map((model) => ({
            label: SEEDANCE_CAPABILITIES[model].displayName,
            value: model
          }))}
          value={node.config.model}
        />
        <SelectField
          label="生成模式"
          onChange={(value) =>
            update(node.id, {
              ...node.config,
              generation_mode: value as AigcVideoGenerationMode
            })
          }
          options={VIDEO_MODE_OPTIONS}
          value={node.config.generation_mode}
        />
        {node.config.generation_mode === "multimodal_reference" ? (
          <SelectField
            label="任务类型"
            onChange={(value) =>
              update(node.id, {
                ...node.config,
                task_type: value as SeedanceTaskType
              })
            }
            options={VIDEO_TASK_TYPE_OPTIONS}
            value={node.config.task_type ?? "generate"}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="分辨率"
            onChange={(value) =>
              update(node.id, {
                ...node.config,
                resolution: value as SeedanceResolution
              })
            }
            options={[...capabilities.resolutions]}
            value={node.config.resolution}
          />
          <SelectField
            label="宽高比"
            onChange={(value) =>
              update(node.id, {
                ...node.config,
                aspect_ratio: value as SeedanceAspectRatio
              })
            }
            options={[...SEEDANCE_ASPECT_RATIOS]}
            value={node.config.aspect_ratio}
          />
        </div>
        <SelectField
          label="时长"
          onChange={(value) =>
            update(node.id, {
              ...node.config,
              duration_seconds: Number(value)
            })
          }
          options={[
            { label: "智能时长", value: "-1" },
            ...Array.from(
              {
                length:
                  capabilities.duration.maximum -
                  capabilities.duration.minimum +
                  1
              },
              (_, index) => {
                const seconds = capabilities.duration.minimum + index;
                return { label: `${seconds} 秒`, value: String(seconds) };
              }
            )
          ]}
          value={String(node.config.duration_seconds)}
        />
        <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground">
          生成音频
          <input
            checked={node.config.generate_audio}
            className="h-4 w-4 accent-primary"
            onChange={(event) =>
              update(node.id, {
                ...node.config,
                generate_audio: event.target.checked
              })
            }
            type="checkbox"
          />
        </label>
        <p className="text-[10px] leading-4 text-muted-foreground">
          全模态上限：图片 {capabilities.maxReferenceImages}、视频{" "}
          {capabilities.maxReferenceVideos}、音频{" "}
          {capabilities.maxReferenceAudios}
        </p>
        {node.config.generation_mode === "multimodal_reference" ? (
          <p className="text-[10px] leading-4 text-muted-foreground">
            输入时长：视频 {inputVideoMinimum}-{inputDurationMaximum} 秒/个，
            音频 2-{inputDurationMaximum} 秒/段；视频、音频各自合计不超过{" "}
            {inputDurationMaximum} 秒
          </p>
        ) : null}
        <p className="text-[10px] leading-4 text-muted-foreground">
          提示词语言：{supportedLanguages}
        </p>
        {promptWarning ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900">
            {promptWarning}
          </p>
        ) : null}
        {issue ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive"
            role="alert"
          >
            {issue.message}
          </p>
        ) : null}
      </div>
    </ConfigGroup>
  );
}

type MediaInputNode = Extract<
  AigcNode,
  { type: "image_input" | "video_input" | "audio_input" }
>;

const MEDIA_INPUT_OPTIONS = {
  image_input: {
    accept: AIGC_MEDIA_ACCEPT.image,
    hint: "JPEG / PNG / WebP / BMP / TIFF / GIF / HEIC / HEIF；300-6000 px；小于 30 MB",
    kind: "image",
    label: "图片",
    queryKey: "selectable-image-assets"
  },
  video_input: {
    accept: AIGC_MEDIA_ACCEPT.video,
    hint: "MP4 / MOV；H.264 / H.265；24-60 FPS；不超过 200 MB",
    kind: "video",
    label: "视频",
    queryKey: "selectable-video-assets"
  },
  audio_input: {
    accept: AIGC_MEDIA_ACCEPT.audio,
    hint: "WAV / MP3；不超过 15 MB",
    kind: "audio",
    label: "音频",
    queryKey: "selectable-audio-assets"
  }
} as const satisfies Record<
  MediaInputNode["type"],
  {
    accept: string;
    hint: string;
    kind: ReferenceAssetKind;
    label: string;
    queryKey: string;
  }
>;

function MediaInputConfig({
  mode,
  node
}: {
  mode: "pipeline" | "template";
  node: MediaInputNode;
}) {
  const update = useAigcEditorStore((state) => state.updateNodeConfig);
  const definition = useAigcEditorStore((state) => state.definition);
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const options = MEDIA_INPUT_OPTIONS[node.type];
  const isLayerDecompositionInput =
    node.type === "image_input" &&
    definition.edges.some((edge) => {
      if (
        edge.sourceNodeId !== node.id ||
        edge.sourceHandle !== "image" ||
        edge.targetHandle !== "image"
      ) {
        return false;
      }
      const target = definition.nodes.find(
        (candidate) => candidate.id === edge.targetNodeId
      );
      return (
        target?.type === "image_to_image" &&
        target.config.operation === "layer_decomposition"
      );
    });
  const assetsQuery = useQuery({
    enabled: mode === "pipeline",
    queryKey: ["aigc", options.queryKey],
    queryFn: async () => {
      const [projectAssets, toolAssets] = await Promise.all([
        apiClient.listAssets(),
        apiClient.listToolAssets()
      ]);
      const byId = new Map(
        [...projectAssets, ...toolAssets]
          .filter((asset) => isSelectableMediaAsset(asset, options.kind))
          .map((asset) => [asset.id, asset])
      );
      return [...byId.values()];
    }
  });

  if (mode === "template") {
    return (
      <ConfigGroup title={`${options.label}输入`}>
        <p className="text-xs leading-5 text-muted-foreground">
          模板不保存具体{options.label}。创建画布实例后再选择或上传素材。
        </p>
      </ConfigGroup>
    );
  }

  async function uploadMedia(file: File | undefined) {
    if (!file) return;
    const validationError = isLayerDecompositionInput
      ? validateLayerDecompositionFile(file)
      : validateAigcMediaFile(options.kind, file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const asset = await apiClient.uploadAigcMedia(options.kind, file, {
        filename: file.name,
        mimeType: file.type
      });
      update(node.id, { ...node.config, asset_id: asset.id });
      queryClient.setQueryData<Asset[]>(
        ["aigc", options.queryKey],
        (current = []) => [asset, ...current.filter((item) => item.id !== asset.id)]
      );
      queryClient.setQueryData<Asset[]>(
        ["aigc", "media-validation-assets"],
        (current = []) => [
          asset,
          ...current.filter((item) => item.id !== asset.id)
        ]
      );
    } catch (error) {
      setUploadError(getUserFacingErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <ConfigGroup title={`${options.label}输入`}>
      <Label>资产库{options.label}</Label>
      <AigcMediaAssetDialog
        assets={assetsQuery.data ?? []}
        currentAssetId={node.config.asset_id}
        isLoading={assetsQuery.isPending}
        kind={options.kind}
        label={options.label}
        getCompatibility={(asset) =>
          isLayerDecompositionInput
            ? layerDecompositionCompatibility(asset)
            : aigcMediaCompatibility(asset, options.kind)
        }
        onSelect={(assetId) =>
          update(node.id, {
            ...node.config,
            asset_id: assetId
          })
        }
      />
      <label className="mt-3 flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border text-xs font-semibold text-foreground hover:border-primary/35 hover:text-primary">
        {isUploading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {isUploading ? "上传中" : "本地上传"}
        <input
          accept={
            isLayerDecompositionInput
              ? ".jpeg,.jpg,.png,image/jpeg,image/png"
              : options.accept
          }
          className="sr-only"
          disabled={isUploading}
          onChange={(event) => {
            void uploadMedia(event.target.files?.[0]);
            event.target.value = "";
          }}
          type="file"
        />
      </label>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
        {isLayerDecompositionInput
          ? "PNG / JPEG；比例 1:16-16:1；总像素 262,144-36,000,000；小于 30 MB"
          : options.hint}
      </p>
      {uploadError ? (
        <p className="mt-2 text-xs text-destructive">{uploadError}</p>
      ) : null}
    </ConfigGroup>
  );
}

async function loadAigcMediaAssets(): Promise<Asset[]> {
  const [projectAssets, toolAssets] = await Promise.all([
    apiClient.listAssets(),
    apiClient.listToolAssets()
  ]);
  return [...new Map(
    [...projectAssets, ...toolAssets].map((asset) => [asset.id, asset])
  ).values()];
}

function ConfigGroup({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly (string | { label: string; value: string })[];
  value: string;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { label: option, value: option }
              : option;
          return (
            <option key={item.value} value={item.value}>{item.label}</option>
          );
        })}
      </select>
    </label>
  );
}

function ResultPanel({
  nodeId,
  runDetail
}: {
  nodeId: string | null;
  runDetail: AigcPipelineRunDetail | undefined;
}) {
  const resultNodes = runDetail?.nodes.filter(
    (item) =>
      item.result.kind !== "none" &&
      (!nodeId || item.node_id === nodeId)
  ) ?? [];
  if (!runDetail || resultNodes.length === 0) {
    return (
      <InspectorPlaceholder
        copy="选择有结果的节点，或执行画布后查看输出。"
        title="暂无结果"
      />
    );
  }
  return (
    <div className="space-y-3">
      {resultNodes.map((item) => {
        const compositeProjection =
          item.result.kind === "layer_composite"
            ? projectAigcLayerCompositeResult(
                runDetail.run.definition_snapshot,
                item.node_id,
                runDetail.nodes
              )
            : null;
        return (
          <div className="border border-border bg-background p-3" key={item.node_id}>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {item.node_id}
            </span>
            <Badge variant={item.status === "reused" ? "info" : "success"}>
              {item.status === "reused" ? "复用" : "完成"}
            </Badge>
          </div>
          {item.result.kind === "text" && item.result.text ? (
            <>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-foreground">
                {item.result.text}
              </p>
              <Button
                className="mt-3 w-full"
                onClick={() => void navigator.clipboard.writeText(item.result.text ?? "")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Copy className="h-4 w-4" />
                复制文本
              </Button>
            </>
          ) : null}
          {item.result.kind === "assets" ? (
            <div className="mt-3 space-y-2">
              {item.result.assets.map((asset) => (
                <ResultAsset
                  asset={asset}
                  key={asset.asset_id}
                  nodeId={item.node_id}
                  runDetail={runDetail}
                />
              ))}
            </div>
          ) : null}
          {compositeProjection ? (
            <div className="mt-3 space-y-2">
              {compositeProjection.imageAsset ? (
                <ResultAsset
                  asset={compositeProjection.imageAsset}
                  nodeId={item.node_id}
                  runDetail={runDetail}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  最终扁平图片暂不可用
                </p>
              )}
              {compositeProjection.layerSet ? (
                <div className="rounded border border-border bg-card px-2.5 py-2 text-xs">
                  <p className="font-medium text-foreground">
                    图层集 v{compositeProjection.layerSet.version} ·{" "}
                    {compositeProjection.layerSet.layers.length + 1} 个图层
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    已保留新图层集，可连接后续图层画布继续编辑
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          {item.result.kind === "unavailable" ? (
            <p className="mt-3 text-xs text-muted-foreground">
              历史结果已不可用，资产可能已删除或无权访问
            </p>
          ) : null}
        </div>
        );
      })}
    </div>
  );
}

function ResultAsset({
  asset,
  nodeId,
  runDetail
}: {
  asset: AigcPipelineRunDetail["nodes"][number]["result"]["assets"][number];
  nodeId: string;
  runDetail: AigcPipelineRunDetail;
}) {
  const definition = runDetail.run.definition_snapshot;
  const resultUrl = asset.available
    ? getSafeAssetContentUrl(asset.download_url)
    : null;
  if (isAigcVideoResult(definition, nodeId, asset)) {
    const projection = projectAigcVideoResult(definition, nodeId, [asset]);
    const download = getAigcVideoDownload(asset, projection.title);
    return (
      <div className="space-y-2">
        <AigcVideoPlayer
          audioState={projection.audioState}
          initialMetadata={{
            duration: projection.duration,
            height: null,
            width: null
          }}
          key={`${runDetail.run.id}:${asset.asset_id}`}
          mimeType={asset.mime_type}
          name={`${projection.title}-${asset.ordinal + 1}`}
          resolutionLabel={projection.resolution}
          unavailableText="视频结果已不可用，资产可能已删除或无权访问"
          url={resultUrl}
          variant="panel"
        />
        {download && resultUrl ? (
          <Button asChild className="w-full" size="sm" variant="outline">
            <a download={download.filename} href={download.url}>
              <Download className="h-4 w-4" />
              下载视频
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  const sourceNode = definition.nodes.find(
    (candidate) => candidate.id === nodeId
  );
  const resultTitle =
    sourceNode?.type === "image_output"
      ? sourceNode.config.title
      : (AIGC_NODE_REGISTRY_BY_TYPE.get(sourceNode?.type ?? "image_output")
          ?.label ?? "图片结果");
  const download = getAigcImageDownload(asset, resultTitle);
  return resultUrl ? (
    <div className="space-y-2">
      <a
        className="block overflow-hidden border border-border bg-card"
        href={resultUrl}
        rel="noreferrer"
        target="_blank"
      >
        {/* Signed result URL is intentionally rendered directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`生成结果 ${asset.ordinal + 1}`}
          className="block max-h-52 w-full object-contain"
          src={resultUrl}
        />
      </a>
      {download ? (
        <Button asChild className="w-full" size="sm" variant="outline">
          <a download={download.filename} href={download.url}>
            <Download className="h-4 w-4" />
            下载图片
          </a>
        </Button>
      ) : null}
    </div>
  ) : (
    <p className="text-xs text-muted-foreground">
      结果资产已不可用，资产可能已删除或无权访问
    </p>
  );
}

function RunPanel({
  onCancel,
  onRetry,
  onSelectRun,
  runDetail,
  runs
}: {
  onCancel: (runId: string) => void;
  onRetry: (runId: string, nodeId: string) => void;
  onSelectRun: (runId: string) => void;
  runDetail: AigcPipelineRunDetail | undefined;
  runs: AigcPipelineRun[];
}) {
  if (!runDetail && runs.length === 0) {
    return (
      <InspectorPlaceholder
        copy="点击顶部执行按钮创建第一次运行。"
        title="暂无运行"
      />
    );
  }
  return (
    <div className="space-y-4">
      {runs.length > 0 ? (
        <label className="block text-xs font-medium text-muted-foreground">
          运行历史
          <select
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground"
            onChange={(event) => onSelectRun(event.target.value)}
            value={runDetail?.run.id ?? runs[0]?.id}
          >
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                #{run.run_number} · {runStatusLabel(run.status)} ·{" "}
                {formatAigcLogTime(run.created_at)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {runDetail ? (
        <>
          <div className="flex items-center justify-between border-y border-border py-3">
            <span className="text-xs font-semibold">
              Run #{runDetail.run.run_number}
            </span>
            <Badge variant={runStatusVariant(runDetail.run.status)}>
              {runStatusLabel(runDetail.run.status)}
            </Badge>
          </div>
          <RunTimingSummary run={runDetail.run} />
          <LogErrorDetails
            error={getAigcRunLogError(runDetail.run)}
            label="Run 失败原因"
          />
          {isAigcRunActive(runDetail) ? (
            <Button
              className="w-full"
              onClick={() => onCancel(runDetail.run.id)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Ban className="h-4 w-4" />
              取消运行
            </Button>
          ) : null}
          <div className="space-y-2">
            {runDetail.nodes
              .filter((node) => node.included_in_plan)
              .map((node) => {
                const attempt = latestRelevantAttempt(node);
                const attemptActive =
                  attempt?.status === "queued" || attempt?.status === "running";
                return (
                  <div
                    aria-label={`节点日志：${node.node_id}`}
                    className="space-y-2 border border-border bg-background px-2.5 py-2"
                    key={node.node_id}
                    role="group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[10px] text-foreground">
                          {node.node_id}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {nodeStatusLabel(node.status)}
                          {attempt
                            ? ` · ${node.attempts.length} 次尝试 · Attempt #${attempt.attempt}`
                            : ""}
                        </p>
                      </div>
                      {["failed", "timed_out", "blocked"].includes(node.status) ? (
                        <Button
                          aria-label={`重试节点：${node.node_id}`}
                          onClick={() => onRetry(runDetail.run.id, node.node_id)}
                          size="icon"
                          title="重试节点"
                          type="button"
                          variant="ghost"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      ) : node.status === "succeeded" ||
                        node.status === "reused" ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : node.status === "running" ? (
                        <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                      ) : null}
                    </div>
                    {attempt ? (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        <dt>开始</dt>
                        <dd>{formatAigcLogTime(attempt.started_at)}</dd>
                        <dt>结束</dt>
                        <dd>
                          {formatAigcEndTime(
                            attempt.finished_at,
                            attemptActive
                          )}
                        </dd>
                        <dt>耗时</dt>
                        <dd>
                          {formatAigcDuration(
                            attempt.started_at,
                            attempt.finished_at,
                            attemptActive
                          )}
                        </dd>
                      </dl>
                    ) : null}
                    <LogErrorDetails
                      error={getAigcNodeLogError(node)}
                      label={`节点失败原因：${node.node_id}`}
                    />
                  </div>
                );
              })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function RunTimingSummary({ run }: { run: AigcPipelineRun }) {
  const active = run.status === "queued" || run.status === "running";
  return (
    <dl
      aria-label="Run 时间摘要"
      className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"
    >
      <dt className="text-muted-foreground">开始时间</dt>
      <dd>{formatAigcLogTime(run.started_at)}</dd>
      <dt className="text-muted-foreground">结束时间</dt>
      <dd>{formatAigcEndTime(run.finished_at, active)}</dd>
      <dt className="text-muted-foreground">耗时</dt>
      <dd>{formatAigcDuration(run.started_at, run.finished_at, active)}</dd>
    </dl>
  );
}

function LogErrorDetails({
  error,
  label
}: {
  error: AigcLogError | null;
  label: string;
}) {
  if (!error) return null;
  const metadata = [
    error.code ? `错误码：${error.code}` : null,
    error.stage ? `阶段：${error.stage}` : null,
    error.requestId ? `Request ID：${error.requestId}` : null
  ].filter((item): item is string => item !== null);

  return (
    <div
      aria-label={label}
      className="border-l-2 border-destructive pl-2 text-[10px]"
    >
      <p className="break-words text-destructive">{error.message}</p>
      {metadata.length > 0 ? (
        <p className="mt-1 break-words text-muted-foreground">
          {metadata.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function runStatusLabel(status: AigcPipelineRun["status"]): string {
  return {
    canceled: "已取消",
    failed: "失败",
    queued: "排队中",
    running: "运行中",
    succeeded: "已完成"
  }[status];
}

function runStatusVariant(status: AigcPipelineRun["status"]) {
  if (status === "succeeded") return "success" as const;
  if (status === "failed" || status === "canceled") return "destructive" as const;
  return "info" as const;
}

function nodeStatusLabel(status: AigcPipelineRunDetail["nodes"][number]["status"]) {
  return {
    blocked: "阻塞",
    canceled: "已取消",
    failed: "失败",
    idle: "未执行",
    queued: "排队中",
    ready: "就绪",
    reused: "已复用",
    running: "运行中",
    succeeded: "已完成",
    timed_out: "超时"
  }[status];
}

function useDesktopLayout(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(min-width: 1024px)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false
  );
}

function InspectorEmpty() {
  return (
    <div className="py-8 text-center text-xs text-muted-foreground">
      选择节点后编辑配置
    </div>
  );
}

function InspectorPlaceholder({ copy, title }: { copy: string; title: string }) {
  return (
    <div className="py-8 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy}</p>
    </div>
  );
}

function toFlowNode(node: AigcNode): AigcFlowNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: { node },
    style: { height: node.size.height, width: node.size.width }
  };
}

export function toFlowEdge(
  edge: AigcEdge,
  nodes: readonly AigcNode[] = [],
  edges: readonly AigcEdge[] = [edge]
): Edge {
  const incompatible =
    isVideoEdgeIncompatible(edge, nodes) ||
    isSeedreamImageEdgeIncompatible(edge, nodes, edges);
  const source = nodes.find((node) => node.id === edge.sourceNodeId);
  const sourcePort = source
    ? AIGC_NODE_REGISTRY_BY_TYPE.get(source.type)?.outputs.find(
        (port) => port.id === edge.sourceHandle
      )
    : undefined;
  const edgeColor = getAigcModalityColors(sourcePort?.type).edgeColor;
  return {
    id: edge.id,
    animated: incompatible,
    label: incompatible ? "与当前模式不兼容" : undefined,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourceHandle,
    style: {
      stroke: incompatible ? "hsl(var(--destructive))" : edgeColor,
      strokeWidth: 2
    },
    target: edge.targetNodeId,
    targetHandle: edge.targetHandle
  };
}

function connectionToDomainEdge(connection: Connection): AigcEdge {
  return {
    id: `edge-${globalThis.crypto.randomUUID()}`,
    sourceNodeId: connection.source,
    sourceHandle: connection.sourceHandle ?? "",
    targetNodeId: connection.target,
    targetHandle: connection.targetHandle ?? ""
  };
}

export function isValidAigcConnection(
  connection: Pick<
    Connection | Edge,
    "source" | "sourceHandle" | "target" | "targetHandle"
  >,
  nodes: AigcNode[],
  edges: AigcEdge[]
): boolean {
  return getAigcConnectionValidationError(connection, nodes, edges) === null;
}

type AigcConnectionValidationError =
  | "bbox_reference_conflict"
  | "invalid_connection"
  | "duplicate_edge"
  | "input_not_allowed_for_mode"
  | "output_not_allowed_for_mode"
  | "port_type_mismatch"
  | "target_connection_limit";

export function getAigcConnectionValidationError(
  connection: Pick<
    Connection | Edge,
    "source" | "sourceHandle" | "target" | "targetHandle"
  >,
  nodes: AigcNode[],
  edges: AigcEdge[]
): AigcConnectionValidationError | null {
  if (
    !connection.source ||
    !connection.target ||
    !connection.sourceHandle ||
    !connection.targetHandle ||
    connection.source === connection.target
  ) {
    return "invalid_connection";
  }
  if (
    edges.some(
      (edge) =>
        edge.sourceNodeId === connection.source &&
        edge.sourceHandle === connection.sourceHandle &&
        edge.targetNodeId === connection.target &&
        edge.targetHandle === connection.targetHandle
    )
  ) {
    return "duplicate_edge";
  }
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target) return "invalid_connection";
  const sourcePort = AIGC_NODE_REGISTRY_BY_TYPE.get(source.type)?.outputs.find(
    (port) => port.id === connection.sourceHandle
  );
  const targetPort = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type)?.inputs.find(
    (port) => port.id === connection.targetHandle
  );
  if (!sourcePort || !targetPort || sourcePort.type !== targetPort.type) {
    return "port_type_mismatch";
  }
  if (
    target.type === "video_generation" &&
    !isVideoPortActive(targetPort, target.config.generation_mode)
  ) {
    return "input_not_allowed_for_mode";
  }
  if (
    target.type === "image_to_image" &&
    !isSeedreamImageInputActive(target, targetPort.id, edges)
  ) {
    return "input_not_allowed_for_mode";
  }
  if (
    source.type === "image_to_image" &&
    !isSeedreamImageOutputActive(source, sourcePort.id, edges)
  ) {
    return "output_not_allowed_for_mode";
  }
  if (
    connectionBreaksBboxReferences(
      {
        sourceNodeId: connection.source,
        sourceHandle: connection.sourceHandle,
        targetNodeId: connection.target,
        targetHandle: connection.targetHandle
      },
      nodes,
      edges
    )
  ) {
    return "bbox_reference_conflict";
  }
  const connectionCount = edges.filter(
    (edge) =>
      edge.targetNodeId === connection.target &&
      edge.targetHandle === connection.targetHandle
  ).length;
  const maxConnections =
    target.type === "video_generation"
      ? videoInputLimit(target, targetPort)
      : target.type === "image_to_image"
        ? seedreamImageInputLimit(target, targetPort)
        : targetPort.max_connections;
  return connectionCount >= maxConnections
    ? "target_connection_limit"
    : null;
}

export function connectionValidationFeedback(
  validationError: AigcConnectionValidationError,
  connection: Pick<Connection | Edge, "target" | "targetHandle">,
  nodes: AigcNode[]
): string {
  const target = nodes.find((node) => node.id === connection.target);
  if (
    validationError === "target_connection_limit" &&
    target?.type === "image_to_image" &&
    connection.targetHandle === "image"
  ) {
    const registration = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type);
    const port = registration?.inputs.find(
      (candidate) => candidate.id === connection.targetHandle
    );
    const limit = port ? seedreamImageInputLimit(target, port) : 1;
    return (target.config.operation ?? "image_to_image") === "image_to_image"
      ? `图生图节点最多支持 ${limit} 张参考图`
      : `${seedreamImageTitle(target)}节点最多支持 ${limit} 张图片`;
  }
  if (
    validationError === "target_connection_limit" &&
    target?.type === "video_generation"
  ) {
    const port = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type)?.inputs.find(
      (candidate) => candidate.id === connection.targetHandle
    );
    if (port) {
      return `${port.label}最多支持 ${videoInputLimit(target, port)} 个连接`;
    }
  }
  if (
    validationError === "input_not_allowed_for_mode" &&
    target?.type === "video_generation"
  ) {
    const port = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type)?.inputs.find(
      (candidate) => candidate.id === connection.targetHandle
    );
    return `${port?.label ?? "该输入"}不适用于当前生成模式`;
  }
  if (
    validationError === "input_not_allowed_for_mode" &&
    target?.type === "image_to_image"
  ) {
    const port = AIGC_NODE_REGISTRY_BY_TYPE.get(target.type)?.inputs.find(
      (candidate) => candidate.id === connection.targetHandle
    );
    return `${port?.label ?? "该输入"}不适用于${seedreamImageTitle(target)}模式`;
  }
  if (validationError === "output_not_allowed_for_mode") {
    return "该输出不适用于当前 Seedream 模式或编辑目标";
  }
  if (validationError === "duplicate_edge") {
    return "该连线已存在。";
  }
  if (validationError === "bbox_reference_conflict") {
    return "该文本节点含框选引用，只能连接到同时接收对应图片的图生图节点。";
  }
  return "端口类型不匹配，或目标端口已有输入。";
}

function videoValidationFeedback(
  issue: { message: string; nodeId: string }
): string {
  return `生视频节点（${issue.nodeId}）：${issue.message}`;
}

function seedreamValidationFeedback(
  issue: { message: string; nodeId: string }
): string {
  return `Seedream 图片节点（${issue.nodeId}）：${issue.message}`;
}

function definitionValidationIssue(
  definition: AigcPipeline["definition"]
): string | null {
  const seedreamIssue = validateSeedreamImageDefinition(definition)[0];
  if (seedreamIssue) {
    return seedreamValidationFeedback(seedreamIssue);
  }
  const videoIssue = validateVideoGenerationDefinition(definition)[0];
  return videoIssue ? videoValidationFeedback(videoIssue) : null;
}
