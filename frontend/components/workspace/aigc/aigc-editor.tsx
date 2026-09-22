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
  type ReactFlowInstance,
  type Viewport
} from "@xyflow/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Type,
  Video,
  Upload
} from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useState
} from "react";
import {
  AigcFlowNodeCard,
  type AigcFlowNode
} from "@/components/workspace/aigc/aigc-flow-node";
import {
  AigcCanvasNodePicker,
  AigcNodeContextMenu,
  type AigcContextMenuPosition
} from "@/components/workspace/aigc/aigc-canvas-context-menu";
import { AigcImageDimensionsField } from "@/components/workspace/aigc/aigc-image-dimensions-field";
import { AigcMediaAssetDialog } from "@/components/workspace/aigc/aigc-media-asset-dialog";
import { AigcPromptEditor } from "@/components/workspace/aigc/aigc-prompt-editor";
import {
  AigcRunActionsProvider,
  AigcRunProvider
} from "@/components/workspace/aigc/aigc-run-context";
import {
  AigcVideoPlayer,
  formatVideoDuration
} from "@/components/workspace/aigc/aigc-video-player";
import { AigcAudioPlayer } from "@/components/workspace/aigc/aigc-audio-player";
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
import {
  AutosaveCoordinator,
  type AutosaveState
} from "@/lib/aigc/autosave-coordinator";
import {
  AIGC_EDITOR_NODE_REGISTRY,
  AIGC_NODE_REGISTRY_BY_TYPE,
  isAigcExecutionNodeType
} from "@/lib/aigc/node-registry";
import {
  mergeAigcServerRevision,
  serializeAigcEditorDefinition,
  type AigcEditorSnapshot,
  type AigcEditorStore
} from "@/lib/aigc/editor-store";
import {
  connectionValidationFeedback,
  getAigcConnectionValidationError
} from "@/lib/aigc/connection-validation";
import {
  jsonParserErrorMessage,
  jsonParserItemCount,
  jsonPathInputFeedback,
  managedTextSource
} from "@/lib/aigc/json-parser-ui";
import { resolveAigcLlmImageInput } from "@/lib/aigc/llm-image-input";
export {
  connectionValidationFeedback,
  getAigcConnectionValidationError,
  isValidAigcConnection
} from "@/lib/aigc/connection-validation";
import {
  getAigcAudioDownload,
  getAigcImageDownload,
  getAigcSubtitleDownload,
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
  aigcNodeBaseDisplayName,
  deriveAigcNodeDisplayNames
} from "@/lib/aigc/node-display-name";
import {
  isAigcVideoResult,
  projectAigcEffectiveText,
  projectAigcLayerCompositeResult,
  projectAigcModalityRunResult,
  projectAigcVideoResult
} from "@/lib/aigc/result-projection";
import {
  isSeedreamImageEdgeIncompatible,
  validateLayerDecompositionAssets,
  validateSeedreamImageDefinition
} from "@/lib/aigc/seedream-image";
import {
  isVideoEdgeIncompatible,
  seedancePromptLengthWarning,
  validateVideoGenerationAssets,
  validateVideoGenerationDefinition,
} from "@/lib/aigc/video-generation";
import {
  normalizeVideoEnhancementConfig,
  VIDEO_ENHANCEMENT_BIT_DEPTHS,
  VIDEO_ENHANCEMENT_BITRATE_LEVELS,
  VIDEO_ENHANCEMENT_BITRATE_RANGE,
  VIDEO_ENHANCEMENT_FPS_RANGE,
  VIDEO_ENHANCEMENT_RESOLUTIONS,
  VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE,
  VIDEO_ENHANCEMENT_SCENES,
  VIDEO_ENHANCEMENT_STYLES,
  VIDEO_ENHANCEMENT_TOOL_VERSIONS,
  type VideoEnhancementConfigCandidate
} from "@/lib/aigc/video-enhancement";
import {
  validateVideoFaceBlurDefinition,
  VIDEO_FACE_BLUR_MASK_MODES,
  VIDEO_FACE_BLUR_MASK_STRENGTHS,
  videoFaceBlurModeLabel,
  videoFaceBlurStrengthLabel
} from "@/lib/aigc/video-face-blur";
import {
  aigcQueryKeys,
  type AigcRunDetailQueryState,
  isAigcRunActive,
  useAigcRunDetails,
  useAigcRuns,
  useCancelAigcRun,
  useCreateAigcRun,
  useRetryAigcNode
} from "@/lib/aigc/queries";
import {
  createAigcRunProjection,
  getAigcProjectionNodeIds,
  getDownstreamAigcNodeIds,
  selectAigcProjectionRunIds
} from "@/lib/aigc/run-scope";
import {
  formatAigcDuration,
  formatAigcEndTime,
  formatAigcLogTime,
  getAigcCacheReuse,
  getAigcNodeLogError,
  getAigcProviderTrace,
  getAigcRunLogError,
  latestRelevantAttempt,
  type AigcLogError
} from "@/lib/aigc/run-log";
import type {
  AigcEdge,
  AigcImageOperation,
  AigcV2NodeType,
  AigcPipeline,
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcPipelineRun,
  AigcPipelineRunDetail,
  AigcPipelineTemplate,
  AigcResultAsset,
  AigcV2Node,
  AigcVideoGenerationMode,
  ImageModelConfig,
  VideoEnhancementConfig,
  VideoFaceBlurConfig
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
  AIGC_EDITOR_NODE_REGISTRY.map((item) => [item.type, AigcFlowNodeCard])
) as NodeTypes;
const subscribeToHydration = () => () => undefined;

type EditorEntity = AigcPipeline | AigcPipelineTemplate;
type InspectorTab = "config" | "result" | "run";
type EditorPanel = "nodes" | "inspector" | null;
const NODE_PALETTE_VISIBILITY_KEY = "aigc.node-palette.visible.v1";
type CanvasContextMenu =
  | {
      kind: "picker";
      flowPosition: { x: number; y: number };
      position: AigcContextMenuPosition;
    }
  | {
      kind: "node";
      nodeId: string;
      position: AigcContextMenuPosition;
    }
  | null;
const FULL_RUN_PENDING = "__full__";
interface AigcEditorDraft {
  definition: AigcPipelineDefinitionV2;
  description: string;
  name: string;
}

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
  const router = useRouter();
  const editorStore = useAigcEditorStoreApi();
  const queryClient = useQueryClient();
  const definition = useAigcEditorStore((state) => state.definition);
  const name = useAigcEditorStore((state) => state.name);
  const selectedNodeId = useAigcEditorStore((state) => state.selectedNodeId);
  const addNode = useAigcEditorStore((state) => state.addNode);
  const connect = useAigcEditorStore((state) => state.connect);
  const applyServerRevision = useAigcEditorStore(
    (state) => state.applyServerRevision
  );
  const applyGeneratedNodeNames = useAigcEditorStore(
    (state) => state.applyGeneratedNodeNames
  );
  const markSaved = useAigcEditorStore((state) => state.markSaved);
  const moveNode = useAigcEditorStore((state) => state.moveNode);
  const removeEdge = useAigcEditorStore((state) => state.removeEdge);
  const removeNode = useAigcEditorStore((state) => state.removeNode);
  const selectNode = useAigcEditorStore((state) => state.selectNode);
  const setRenamingNodeId = useAigcEditorStore(
    (state) => state.setRenamingNodeId
  );
  const setDescription = useAigcEditorStore((state) => state.setDescription);
  const setName = useAigcEditorStore((state) => state.setName);
  const setViewport = useAigcEditorStore((state) => state.setViewport);
  const [nodes, setNodes] = useState<AigcFlowNode[]>(() =>
    editorStore.getState().definition.nodes.map(toFlowNode)
  );
  const [edges, setEdges] = useState<Edge[]>(() => {
    const initialDefinition = editorStore.getState().definition;
    return initialDefinition.edges.map((edge) =>
      toFlowEdge(edge, initialDefinition.nodes, initialDefinition.edges)
    );
  });
  const [autosaveCoordinator] = useState(
    () =>
      new AutosaveCoordinator<AigcEditorDraft>({
        initialSnapshot: editorStore.getState().dirty
          ? editorDraftFromEntity(entity)
          : editorDraftFromState(editorStore.getState()),
        initialRevision: entity.revision,
        equals: editorDraftsEqual,
        getErrorMessage: autosaveErrorMessage,
        save: async ({ expectedRevision, snapshot }) => {
          const saved =
            mode === "template"
              ? await apiClient.updateAigcTemplate(entity.id, {
                  expected_revision: expectedRevision,
                  name: snapshot.name.trim(),
                  description: snapshot.description.trim(),
                  definition: serializeAigcEditorDefinition(snapshot.definition)
                })
              : await apiClient.updateAigcPipeline(entity.id, {
                  expected_revision: expectedRevision,
                  name: snapshot.name.trim(),
                  description: snapshot.description.trim(),
                  definition: serializeAigcEditorDefinition(snapshot.definition)
                });
          return { revision: saved.revision };
        },
        validate: validateEditorDraft
      })
  );
  const subscribeToAutosave = useCallback(
    (listener: () => void) => autosaveCoordinator.subscribe(listener),
    [autosaveCoordinator]
  );
  const getAutosaveState = useCallback(
    () => autosaveCoordinator.getState(),
    [autosaveCoordinator]
  );
  const autosaveState = useSyncExternalStore(
    subscribeToAutosave,
    getAutosaveState,
    getAutosaveState
  );
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("config");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState(entity.name);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<CanvasContextMenu>(null);
  const canvasContainerRef = useRef<HTMLElement>(null);
  const reactFlowRef = useRef<
    ReactFlowInstance<AigcFlowNode, Edge> | null
  >(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pendingRunStarts, setPendingRunStarts] = useState<Set<string>>(
    () => new Set()
  );
  const pendingRunStartsRef = useRef(pendingRunStarts);
  const [openPanel, setOpenPanel] = useState<EditorPanel>(null);
  const [desktopNodePaletteVisible, setDesktopNodePaletteVisible] =
    useState(readNodePaletteVisibility);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const isDesktop = useDesktopLayout();
  const runsQuery = useAigcRuns(entity.id, undefined, mode === "pipeline");
  const pipelineQuery = useQuery({
    enabled: mode === "pipeline",
    initialData: mode === "pipeline" ? (entity as AigcPipeline) : undefined,
    queryFn: () => apiClient.getAigcPipeline(entity.id),
    queryKey: aigcQueryKeys.pipeline(entity.id),
    staleTime: Number.POSITIVE_INFINITY
  });
  const validationAssets = useQuery({
    enabled: mode === "pipeline",
    queryKey: ["aigc", "media-validation-assets"],
    queryFn: loadAigcMediaAssets
  });
  const runs = useMemo(
    () => runsQuery.data?.items ?? [],
    [runsQuery.data?.items]
  );
  const projectionRunIds = useMemo(
    () =>
      mode === "pipeline"
        ? selectAigcProjectionRunIds(definition, runs, selectedRunId)
        : [],
    [definition, mode, runs, selectedRunId]
  );
  const projectionRunSummaries = useMemo(() => {
    const runsById = new Map(runs.map((run) => [run.id, run]));
    return projectionRunIds.flatMap((runId) => {
      const run = runsById.get(runId);
      return run ? [run] : [];
    });
  }, [projectionRunIds, runs]);
  const runDetailQueries = useAigcRunDetails(projectionRunSummaries);
  const runDetails = runDetailQueries.details;
  const projectionRuns = useMemo(() => {
    const byId = new Map(
      runs.map((run) => [run.id, runDetails.get(run.id)?.run ?? run])
    );
    for (const detail of runDetails.values()) {
      if (!byId.has(detail.run.id)) byId.set(detail.run.id, detail.run);
    }
    return [...byId.values()];
  }, [runDetails, runs]);
  const runProjection = useMemo(
    () =>
      createAigcRunProjection(
        definition,
        projectionRuns,
        runDetails,
        selectedRunId
      ),
    [definition, projectionRuns, runDetails, selectedRunId]
  );
  const selectedPanelRunId = selectedRunId ?? runs[0]?.id ?? null;
  const selectedRunDetail =
    selectedPanelRunId === null
      ? undefined
      : runDetails.get(selectedPanelRunId);
  const selectedRunDetailState =
    selectedPanelRunId === null
      ? undefined
      : runDetailQueries.states.get(selectedPanelRunId);
  const createRun = useCreateAigcRun(entity.id);
  const retryNode = useRetryAigcNode(entity.id);
  const cancelRun = useCancelAigcRun(entity.id);
  const refreshedPipelineRunsRef = useRef(new Set<string>());
  const authoritativeNodeNamesRef = useRef(new Map<string, string>());

  useEffect(() => {
    autosaveCoordinator.activate();
    autosaveCoordinator.update(editorDraftFromState(editorStore.getState()));
    return editorStore.subscribe((state, previous) => {
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
      autosaveCoordinator.update(editorDraftFromState(state));
    });
  }, [autosaveCoordinator, editorStore]);

  useEffect(() => {
    if (mode !== "pipeline") return;
    const parserNodeIds = new Set(
      definition.nodes.flatMap((node) =>
        node.type === "json_parser" ? [node.id] : []
      )
    );
    const completedMutations = [...runDetails.values()]
      .sort((left, right) => left.run.run_number - right.run.run_number)
      .flatMap((detail) => {
      const hasParserMutation = detail.nodes.some(
        (node) =>
          parserNodeIds.has(node.node_id) &&
          (node.status === "succeeded" || node.status === "reused")
      );
      const namedNodes = new Map(
        detail.nodes.flatMap((node) => {
          const generatedName =
            node.status === "succeeded" &&
            node.result.naming?.status === "succeeded"
              ? node.result.naming.name
              : null;
          if (!generatedName) return [];
          return generatedMediaNameTargetNodeIds(
            definition,
            node.node_id
          ).map((nodeId) => [nodeId, generatedName] as const);
        })
      );
        return hasParserMutation || namedNodes.size > 0
          ? [{ runId: detail.run.id, namedNodes }]
          : [];
      });
    const unseen = completedMutations.filter(
      ({ runId }) => !refreshedPipelineRunsRef.current.has(runId)
    );
    if (unseen.length === 0) return;
    const immediateNodeNames = new Map<string, string>();
    unseen.forEach(({ runId, namedNodes }) => {
      refreshedPipelineRunsRef.current.add(runId);
      namedNodes.forEach((name, nodeId) => {
        authoritativeNodeNamesRef.current.set(nodeId, name)
        immediateNodeNames.set(nodeId, name);
      });
    });
    applyGeneratedNodeNames(immediateNodeNames);
    void queryClient.invalidateQueries({
      queryKey: aigcQueryKeys.pipeline(entity.id)
    });
  }, [
    applyGeneratedNodeNames,
    definition,
    entity.id,
    mode,
    queryClient,
    runDetails
  ]);

  useEffect(() => {
    const server = pipelineQuery.data;
    if (mode !== "pipeline" || !server) return;
    const authoritativeNodeNames = new Map(
      authoritativeNodeNamesRef.current
    );
    void autosaveCoordinator
      .rebase({
        merge: (base, local, remote) =>
          mergeAigcServerRevision(
            base,
            local,
            remote,
            authoritativeNodeNames
          ),
        revision: server.revision,
        snapshot: editorDraftFromEntity(server)
      })
      .then((result) => {
        if (!result.applied) return;
        applyServerRevision(
          {
            definition: serializeAigcEditorDefinition(server.definition),
            description: server.description,
            name: server.name,
            revision: result.revision
          },
          {
            draft: structuredClone(
              result.snapshot
            ) as AigcEditorSnapshot,
            dirty: result.dirty,
            authoritativeNodeNames
          }
        );
        authoritativeNodeNames.forEach((_, nodeId) =>
          authoritativeNodeNamesRef.current.delete(nodeId)
        );
      })
      .catch((error: unknown) => {
        setFeedback(
          `Pipeline 刷新失败：${getUserFacingErrorMessage(error)}`
        );
      });
  }, [
    applyServerRevision,
    autosaveCoordinator,
    mode,
    pipelineQuery.data
  ]);

  useEffect(() => {
    if (
      !autosaveState.dirty &&
      editorStore.getState().revision !== autosaveState.revision
    ) {
      markSaved(autosaveState.revision);
    }
  }, [autosaveState.dirty, autosaveState.revision, editorStore, markSaved]);

  useEffect(() => {
    autosaveCoordinator.activate();
    return () => autosaveCoordinator.dispose();
  }, [autosaveCoordinator]);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!autosaveCoordinator.getState().dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [autosaveCoordinator]);

  const selectedNode = definition.nodes.find(
    (node) => node.id === selectedNodeId
  ) ?? null;
  const selectedNodeRunDetail = selectedNode
    ? runProjection.displayRunForNode(selectedNode.id) ?? undefined
    : selectedRunDetail;
  const selectedNodeIsActive = selectedNode
    ? runProjection.isNodeActive(selectedNode.id)
    : false;
  const runListUnavailable =
    mode === "pipeline" && !runsQuery.isSuccess;

  const submissionPendingForNode = useCallback(
    (
      nodeId: string,
      pendingStarts: ReadonlySet<string> = pendingRunStarts
    ): boolean => {
      if (pendingStarts.has(FULL_RUN_PENDING)) return true;
      const nodeScope = getDownstreamAigcNodeIds(definition, nodeId);
      return [...pendingStarts].some((startNodeId) => {
        const pendingScope = getDownstreamAigcNodeIds(
          definition,
          startNodeId
        );
        return setsOverlap(nodeScope, pendingScope);
      });
    },
    [definition, pendingRunStarts]
  );

  const pendingForNode = useCallback(
    (nodeId: string): boolean =>
      runListUnavailable ||
      runProjection.isNodeActive(nodeId) ||
      submissionPendingForNode(nodeId),
    [runListUnavailable, runProjection, submissionPendingForNode]
  );

  function updatePendingRunStart(key: string, pending: boolean) {
    const next = new Set(pendingRunStartsRef.current);
    if (pending) next.add(key);
    else next.delete(key);
    pendingRunStartsRef.current = next;
    setPendingRunStarts(next);
  }

  const hasPendingRun = pendingRunStarts.size > 0;
  const fullExecutionInProgress =
    runProjection.hasAnyActiveRun || hasPendingRun;
  const fullExecutionBlocked =
    runListUnavailable || fullExecutionInProgress;
  const selectedNodePending = selectedNode
    ? runListUnavailable || submissionPendingForNode(selectedNode.id)
    : false;

  const openInspector = useCallback((tab: InspectorTab) => {
    setInspectorTab(tab);
    setOpenPanel("inspector");
  }, [setInspectorTab, setOpenPanel]);

  const selectNodeAndInspect = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
      openInspector("config");
    },
    [openInspector, selectNode]
  );

  const dismissInspectorFromPane = useCallback(() => {
    selectNode(null);
    setContextMenu(null);
    setOpenPanel(null);
  }, [selectNode, setOpenPanel]);

  const contextPosition = useCallback(
    (
      event: globalThis.MouseEvent | MouseEvent,
      width: number,
      height: number
    ) => {
      const bounds = canvasContainerRef.current?.getBoundingClientRect();
      if (!bounds) return { left: 8, top: 8 };
      return {
        left: Math.max(
          8,
          Math.min(event.clientX - bounds.left, bounds.width - width - 8)
        ),
        top: Math.max(
          8,
          Math.min(event.clientY - bounds.top, bounds.height - height - 8)
        )
      };
    },
    []
  );

  const openNodePicker = useCallback(
    (event: globalThis.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const instance = reactFlowRef.current;
      if (!instance) return;
      const flowPosition = instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });
      if (
        !Number.isFinite(flowPosition.x) ||
        !Number.isFinite(flowPosition.y)
      ) {
        return;
      }
      setRenamingNodeId(null);
      setContextMenu({
        kind: "picker",
        flowPosition,
        position: contextPosition(event, 288, 420)
      });
    },
    [contextPosition, setRenamingNodeId]
  );

  const openNodeMenu = useCallback(
    (event: MouseEvent, node: AigcFlowNode) => {
      event.preventDefault();
      event.stopPropagation();
      selectNode(node.id);
      setRenamingNodeId(null);
      setContextMenu({
        kind: "node",
        nodeId: node.id,
        position: contextPosition(event, 160, 42)
      });
    },
    [contextPosition, selectNode, setRenamingNodeId]
  );

  useEffect(() => {
    if (!contextMenu) return;
    const close = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "[data-testid='aigc-canvas-node-picker'], [data-testid='aigc-node-context-menu']"
        )
      ) {
        return;
      }
      setContextMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [contextMenu]);

  const setDesktopNodePalettePreference = useCallback((visible: boolean) => {
    setDesktopNodePaletteVisible(visible);
    writeNodePaletteVisibility(visible);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    function clearNarrowNodePanel(event: MediaQueryListEvent) {
      if (event.matches) {
        setOpenPanel((current) => (current === "nodes" ? null : current));
      }
    }
    media.addEventListener("change", clearNarrowNodePanel);
    return () => media.removeEventListener("change", clearNarrowNodePanel);
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange<AigcFlowNode>[]) => {
      for (const change of changes) {
        if (change.type === "remove") removeNode(change.id);
        if (change.type === "select" && change.selected) {
          selectNodeAndInspect(change.id);
        }
      }
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [removeNode, selectNodeAndInspect]
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
        validationError === "port_type_mismatch" ||
        validationError === "system_only_output"
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

  async function flushLatestDraft(startNodeId?: string) {
    const result = await autosaveCoordinator.flush(
      startNodeId
        ? {
            validate: (draft) =>
              validateEditorDraft(draft, startNodeId)
          }
        : undefined
    );
    if (!result.ok) {
      setFeedback(result.message);
      return result;
    }
    setFeedback(null);
    return result;
  }

  async function navigateAfterFlush(href: Route) {
    const result = await flushLatestDraft();
    if (!result.ok) return;
    router.push(href);
  }

  async function saveAsTemplate() {
    if (mode !== "pipeline") return;
    const normalizedName = templateName.trim();
    if (!normalizedName) {
      setTemplateError("请输入模板名称。");
      return;
    }
    setTemplateError(null);
    const flushResult = await flushLatestDraft();
    if (!flushResult.ok) {
      setTemplateError(flushResult.message);
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

  async function execute(startNodeId?: string) {
    if (!allowExecution || mode !== "pipeline") return;
    if (runListUnavailable) return;
    if (startNodeId) {
      if (
        runProjection.isNodeActive(startNodeId) ||
        submissionPendingForNode(
          startNodeId,
          pendingRunStartsRef.current
        )
      ) {
        return;
      }
    } else if (
      runProjection.hasAnyActiveRun ||
      pendingRunStartsRef.current.size > 0
    ) {
      return;
    }
    const pendingKey = startNodeId ?? FULL_RUN_PENDING;
    updatePendingRunStart(pendingKey, true);
    try {
      const currentDefinition = editorStore.getState().definition;
      const validationDefinition = startNodeId
        ? definitionForNodeScope(currentDefinition, startNodeId)
        : currentDefinition;
      const validationIssue = definitionValidationIssue(validationDefinition);
      if (validationIssue) {
        setFeedback(validationIssue);
        return;
      }
      let validationAssetData = validationAssets.data;
      if (validationAssetData === undefined) {
        const result = await validationAssets.refetch();
        validationAssetData = result.data;
        if (validationAssetData === undefined) {
          setFeedback("媒体资产预检加载失败，请重试。");
          return;
        }
      }
      const assetValidationIssue = validationDefinition.nodes.flatMap<{
        message: string;
        nodeId: string;
      }>((node) =>
        node.type === "video_generation"
          ? validateVideoGenerationAssets(
              validationDefinition,
              node.id,
              validationAssetData
            )
          : node.type === "image_to_image"
            ? validateLayerDecompositionAssets(
                validationDefinition,
                node.id,
                validationAssetData
              )
            : []
      )[0];
      if (assetValidationIssue) {
        setFeedback(
          assetValidationIssue.nodeId &&
            validationDefinition.nodes.find(
              (node) =>
                node.id === assetValidationIssue.nodeId &&
                node.type === "image_to_image"
            )
            ? seedreamValidationFeedback(assetValidationIssue)
            : videoValidationFeedback(assetValidationIssue)
        );
        return;
      }
      const flushResult = await flushLatestDraft(startNodeId);
      if (!flushResult.ok) return;
      setFeedback(null);
      const detail = await createRun.mutateAsync({
        expected_revision: flushResult.revision,
        mode: startNodeId ? "from_node" : "full",
        start_node_id: startNodeId ?? null
      });
      setSelectedRunId(detail.run.id);
      openInspector("run");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      updatePendingRunStart(pendingKey, false);
    }
  }

  async function retryFailedNode(runId: string, nodeId: string) {
    if (
      runListUnavailable ||
      runProjection.isNodeActive(nodeId) ||
      submissionPendingForNode(nodeId, pendingRunStartsRef.current)
    ) {
      return;
    }
    updatePendingRunStart(nodeId, true);
    try {
      const detail = await retryNode.mutateAsync({ nodeId, runId });
      setSelectedRunId(detail.run.id);
      openInspector("run");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      updatePendingRunStart(nodeId, false);
    }
  }

  async function cancelActiveRun(runId: string) {
    try {
      await cancelRun.mutateAsync(runId);
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  const workspaceRoute = `/workspace/aigc?view=${
    mode === "pipeline" ? "pipelines" : "templates"
  }` as Route;

  function leave(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    void navigateAfterFlush(workspaceRoute);
  }

  function toggleDetails() {
    if (openPanel === "inspector" && inspectorTab === "config") {
      setOpenPanel(null);
      return;
    }
    openInspector("config");
  }

  const continueFromNode = useLatestCallback(
    (nodeId: string) => void execute(nodeId)
  );
  const openLayerEditor = useLatestCallback(
    (href: string) => void navigateAfterFlush(href as Route)
  );
  const runActions = useMemo(
    () => ({
      continueFromNode,
      openLayerEditor,
      pendingForNode
    }),
    [continueFromNode, openLayerEditor, pendingForNode]
  );

  return (
    <main
      className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#101318] text-[#e8eaed] [--accent-foreground:210_17%_92%] [--accent:218_11%_18%] [--background:220_20%_8%] [--border:218_12%_20%] [--card:220_13%_11%] [--foreground:210_17%_92%] [--input:218_12%_24%] [--muted-foreground:218_9%_60%] [--muted:220_11%_16%] [--secondary-foreground:210_17%_88%] [--secondary:218_11%_16%]"
      data-testid="aigc-editor-shell"
    >
      <header
        className="relative flex h-14 shrink-0 flex-row items-center gap-1 overflow-hidden border-b border-[#30353d] bg-[#171a1f] px-2 shadow-[0_3px_12px_rgba(0,0,0,0.22)] sm:px-3"
        data-testid="aigc-editor-header"
      >
        <div
          className="relative z-10 flex min-w-0 flex-1 items-center gap-2"
          data-testid="aigc-editor-title-row"
        >
          <Button
            asChild
            className="h-10 w-10 shrink-0 text-zinc-400 hover:bg-[#252a31] hover:text-white"
            size="icon"
            title="返回 AIGC 工作台"
            variant="ghost"
          >
            <Link aria-label="返回" href={workspaceRoute} onClick={leave}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1
              className="truncate text-sm font-medium text-zinc-100"
              data-testid="aigc-editor-title"
              title={name}
            >
              {name}
            </h1>
          </div>
          <Badge
            className="hidden shrink-0 border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400 md:inline-flex"
            data-testid="aigc-editor-mode"
            variant="outline"
          >
            {mode === "pipeline" ? "画布" : "模板"}
          </Badge>
        </div>
        <div
          aria-label={`自动保存状态：${autosaveStatusText(autosaveState)}`}
          aria-live="polite"
          className="sr-only"
          data-status={autosaveState.status}
          data-testid="aigc-autosave-status"
        >
          {autosaveStatusText(autosaveState)}
        </div>
        <ToolbarStarMap />
        <div
          aria-label="画布命令"
          className="relative z-10 flex shrink-0 items-center justify-end gap-1"
          data-testid="aigc-editor-actions"
        >
          <div
            aria-label="面板命令"
            className="flex items-center"
            data-testid="aigc-command-group-panel"
            role="group"
          >
            <Button
              aria-label="详情"
              aria-pressed={openPanel === "inspector" && inspectorTab === "config"}
              className="h-10 w-10 text-zinc-400 hover:bg-[#252a31] hover:text-white"
              data-testid="aigc-command-inspector"
              onClick={toggleDetails}
              size="icon"
              title="详情"
              type="button"
              variant="ghost"
            >
              {openPanel === "inspector" && inspectorTab === "config" ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRight className="h-4 w-4" />
              )}
            </Button>
          </div>
          {mode === "pipeline" ? (
            <>
              <div
                aria-label="文档命令"
                className="flex items-center border-l border-zinc-700/70 pl-1"
                data-testid="aigc-command-group-document"
                role="group"
              >
                <Button
                  aria-label="另存为模板"
                  className="h-10 min-w-10 px-0 text-zinc-300 hover:bg-[#252a31] hover:text-white lg:px-3"
                  data-testid="aigc-command-save-template"
                  disabled={isSavingTemplate}
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
                  <span className="hidden lg:inline">另存为模板</span>
                </Button>
              </div>
              <div
                aria-label="执行命令"
                className="flex items-center border-l border-zinc-700/70 pl-1"
                data-testid="aigc-command-group-execution"
                role="group"
              >
                <Button
                  aria-label={fullExecutionInProgress ? "运行中" : "执行"}
                  className="h-10 min-w-10 bg-blue-600 px-0 text-white hover:bg-blue-500 lg:px-3"
                  data-testid="aigc-command-execute"
                  disabled={
                    !allowExecution ||
                    fullExecutionBlocked ||
                    !definition.nodes.some((node) =>
                      isAigcExecutionNodeType(node.type)
                    )
                  }
                  onClick={() => void execute()}
                  size="sm"
                  title={fullExecutionInProgress ? "运行中" : "执行"}
                >
                  {hasPendingRun ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  <span className="hidden lg:inline">
                    {fullExecutionInProgress ? "运行中" : "执行"}
                  </span>
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {isDesktop && hydrated && desktopNodePaletteVisible ? (
          <NodePalette
            onAdd={addNode}
            onClose={() => setDesktopNodePalettePreference(false)}
          />
        ) : null}
        <section
          className="relative min-w-0 flex-1"
          ref={canvasContainerRef}
        >
          {isDesktop && (!hydrated || !desktopNodePaletteVisible) ? (
            <div className="absolute left-3 top-3 z-30 border border-[#30353d] bg-[#181b20] p-1 shadow-lg shadow-black/30">
              <Button
                aria-controls="aigc-node-palette"
                aria-expanded={false}
                aria-label="打开节点库"
                onClick={() => setDesktopNodePalettePreference(true)}
                size="icon"
                title="打开节点库"
                type="button"
                variant="ghost"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          {!isDesktop && openPanel !== "inspector" ? (
            <div
              className={cn(
                "absolute z-30 flex gap-1 border border-[#30353d] bg-[#181b20] p-1 shadow-lg shadow-black/30",
                openPanel === "nodes"
                  ? "left-[252px] top-[60px]"
                  : "left-3 top-3"
              )}
            >
              <Button
                aria-controls="aigc-node-palette"
                aria-expanded={openPanel === "nodes"}
                aria-label={
                  openPanel === "nodes" ? "关闭节点面板" : "打开节点面板"
                }
                onClick={() =>
                  setOpenPanel((current) =>
                    current === "nodes" ? null : "nodes"
                  )
                }
                size="icon"
                title={
                  openPanel === "nodes" ? "关闭节点面板" : "打开节点面板"
                }
                type="button"
                variant="ghost"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <Button
                aria-label="打开检查器"
                onClick={() => openInspector("config")}
                size="icon"
                type="button"
                variant="ghost"
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <AigcRunActionsProvider value={runActions}>
            <AigcRunProvider value={runProjection}>
              <NodeCanvas<AigcFlowNode>
                  backgroundProps={{
                    color: "#39404a",
                    gap: 20,
                    size: 1
                  }}
                  className="bg-[#101318]"
                  controlsProps={{
                    className:
                      "overflow-hidden rounded-md border border-[#343a43] bg-[#20242a] text-zinc-300 shadow-lg shadow-black/40 [&>button]:border-[#343a43] [&>button]:bg-[#20242a] [&>button]:fill-zinc-300 [&>button:hover]:bg-[#2a3038]",
                    orientation: "horizontal",
                    position: "bottom-center",
                    showInteractive: true
                  }}
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
                    onNodeClick: (_, node) => selectNodeAndInspect(node.id),
                    onNodeContextMenu: openNodeMenu,
                    onInit: (instance) => {
                      reactFlowRef.current = instance;
                    },
                    onPaneClick: dismissInspectorFromPane,
                    onPaneContextMenu: openNodePicker,
                    snapGrid: [16, 16],
                    snapToGrid: true
                  }}
              />
            </AigcRunProvider>
          </AigcRunActionsProvider>
          {contextMenu?.kind === "picker" ? (
            <AigcCanvasNodePicker
              onAdd={(type) => {
                addNode(type, contextMenu.flowPosition);
                setContextMenu(null);
              }}
              onClose={() => setContextMenu(null)}
              position={contextMenu.position}
            />
          ) : contextMenu?.kind === "node" ? (
            <AigcNodeContextMenu
              onClose={() => setContextMenu(null)}
              onRename={() => {
                setRenamingNodeId(contextMenu.nodeId);
                setContextMenu(null);
              }}
              position={contextMenu.position}
            />
          ) : null}
          {feedback ? (
            <div
              className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 border border-border bg-card px-3 py-2 text-xs shadow-md"
              role="status"
            >
              {feedback}
            </div>
          ) : null}
          {!isDesktop && openPanel === "nodes" ? (
            <NodePalette
              className="absolute inset-y-0 left-0 z-20 w-60 shadow-xl"
              onAdd={(type) => {
                addNode(type);
                setOpenPanel(null);
              }}
            />
          ) : null}
          {!isDesktop && openPanel === "inspector" ? (
            <Inspector
              className="absolute inset-y-0 right-0 z-20 w-[min(320px,100vw)] shadow-xl"
              allowExecution={allowExecution}
              mode={mode}
              node={selectedNode}
              onCancelRun={(runId) => void cancelActiveRun(runId)}
              onDescriptionChange={setDescription}
              onExecuteNode={(nodeId) => void execute(nodeId)}
              onNameChange={setName}
              onClose={() => setOpenPanel(null)}
              onRetryNode={(runId, nodeId) =>
                void retryFailedNode(runId, nodeId)
              }
              onSelectRun={setSelectedRunId}
              onTabChange={setInspectorTab}
              nodeActive={selectedNodeIsActive}
              nodePending={selectedNodePending}
              nodeRunDetail={selectedNodeRunDetail}
              runs={runs}
              selectedRunId={selectedPanelRunId}
              selectedRunDetail={selectedRunDetail}
              selectedRunDetailState={selectedRunDetailState}
              tab={inspectorTab}
            />
          ) : null}
        </section>
        {isDesktop && openPanel === "inspector" ? (
          <Inspector
            allowExecution={allowExecution}
            mode={mode}
            node={selectedNode}
            onCancelRun={(runId) => void cancelActiveRun(runId)}
            onDescriptionChange={setDescription}
            onExecuteNode={(nodeId) => void execute(nodeId)}
            onNameChange={setName}
            onClose={() => setOpenPanel(null)}
            onRetryNode={(runId, nodeId) =>
              void retryFailedNode(runId, nodeId)
            }
            onSelectRun={setSelectedRunId}
            onTabChange={setInspectorTab}
            nodeActive={selectedNodeIsActive}
            nodePending={selectedNodePending}
            nodeRunDetail={selectedNodeRunDetail}
            runs={runs}
            selectedRunId={selectedPanelRunId}
            selectedRunDetail={selectedRunDetail}
            selectedRunDetailState={selectedRunDetailState}
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
  onAdd,
  onClose
}: {
  className?: string;
  onAdd: (type: AigcV2NodeType) => void;
  onClose?: () => void;
}) {
  return (
    <aside
      className={cn(
        "w-[184px] shrink-0 overflow-y-auto border-r border-[#30353d] bg-[#181b20] px-2 py-3",
        className
      )}
      id="aigc-node-palette"
      data-testid="aigc-node-palette"
    >
      <div className="flex h-7 items-center justify-between gap-1">
        <h2 className="text-xs font-semibold text-foreground">节点</h2>
        {onClose ? (
          <Button
            aria-controls="aigc-node-palette"
            aria-expanded={true}
            aria-label="隐藏节点库"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
            size="icon"
            title="隐藏节点库"
            type="button"
            variant="ghost"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">点击添加到画布</p>
      {(["modality", "model", "control"] as const).map((category) => (
        <div className="mt-4" key={category}>
          <p className="mb-1.5 font-mono text-[10px] uppercase text-muted-foreground">
            {category === "modality"
              ? "模态"
              : category === "model"
                ? "模型"
                : "控制"}
          </p>
          <div className="space-y-1">
            {AIGC_EDITOR_NODE_REGISTRY.filter(
              (item) => item.category === category
            ).map((item) => (
              <button
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-foreground hover:bg-[#252a31]"
                key={item.type}
                onClick={() => onAdd(item.type)}
                type="button"
              >
                {item.type.includes("image") ? (
                  <ImageIcon className="h-4 w-4 text-info" />
                ) : item.type.includes("video") ? (
                  <Video
                    className="h-4 w-4"
                    style={{
                      color: getAigcModalityColors("video_asset").iconColor
                    }}
                  />
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
  onClose,
  onRetryNode,
  onSelectRun,
  onTabChange,
  nodeActive,
  nodePending,
  nodeRunDetail,
  runs,
  selectedRunDetail,
  selectedRunDetailState,
  selectedRunId,
  tab
}: {
  allowExecution: boolean;
  className?: string;
  mode: "pipeline" | "template";
  node: AigcV2Node | null;
  onCancelRun: (runId: string) => void;
  onDescriptionChange: (value: string) => void;
  onExecuteNode: (nodeId: string) => void;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onRetryNode: (runId: string, nodeId: string) => void;
  onSelectRun: (runId: string) => void;
  onTabChange: (tab: InspectorTab) => void;
  nodeActive: boolean;
  nodePending: boolean;
  nodeRunDetail: AigcPipelineRunDetail | undefined;
  runs: AigcPipelineRun[];
  selectedRunDetail: AigcPipelineRunDetail | undefined;
  selectedRunDetailState: AigcRunDetailQueryState | undefined;
  selectedRunId: string | null;
  tab: InspectorTab;
}) {
  const name = useAigcEditorStore((state) => state.name);
  const description = useAigcEditorStore((state) => state.description);
  const definition = useAigcEditorStore((state) => state.definition);
  return (
    <aside
      className={cn(
        "w-80 shrink-0 overflow-y-auto border-l border-[#30353d] bg-[#181b20]",
        className
      )}
      data-testid="aigc-inspector"
    >
      <div className="flex items-center gap-1 border-b border-[#30353d] p-1">
        <div className="grid min-w-0 flex-1 grid-cols-3">
          {(["config", "result", "run"] as const).map((item) => (
            <button
              aria-selected={tab === item}
              className={cn(
                "h-8 rounded text-xs font-semibold",
                tab === item
                  ? "bg-[#252a31] text-blue-400"
                  : "text-muted-foreground hover:bg-[#20242a] hover:text-foreground"
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
        <Button
          aria-label="关闭详情栏"
          className="shrink-0"
          onClick={onClose}
          size="icon"
          title="关闭详情栏"
          type="button"
          variant="ghost"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
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
              {node ? (
                <div className="space-y-4">
                  <NodeCustomNameField
                    key={`${node.id}:${node.custom_name ?? ""}`}
                    node={node}
                  />
                  <NodeConfig
                    mode={mode}
                    node={node}
                    runDetail={nodeRunDetail}
                  />
                </div>
              ) : (
                <InspectorEmpty />
              )}
            </div>
            {allowExecution &&
            mode === "pipeline" &&
            node &&
            isAigcExecutionNodeType(node.type) ? (
              <Button
                className="w-full"
                disabled={nodeActive || nodePending}
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
          <ResultPanel
            definition={definition}
            nodeId={node?.id ?? null}
            runDetail={nodeRunDetail}
          />
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
              runDetail={selectedRunDetail}
              runDetailState={selectedRunDetailState}
              runs={runs}
              selectedRunId={selectedRunId}
            />
          )
        )}
      </div>
    </aside>
  );
}

function NodeCustomNameField({ node }: { node: AigcV2Node }) {
  const setNodeCustomName = useAigcEditorStore(
    (state) => state.setNodeCustomName
  );
  const [draft, setDraft] = useState(node.custom_name ?? "");
  const cancelBlurRef = useRef(false);

  return (
    <div>
      <Label htmlFor={`node-custom-name-${node.id}`}>节点名称</Label>
      <Input
        className="mt-1.5"
        id={`node-custom-name-${node.id}`}
        maxLength={120}
        onBlur={() => {
          if (cancelBlurRef.current) {
            cancelBlurRef.current = false;
            return;
          }
          setNodeCustomName(node.id, draft);
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            setNodeCustomName(node.id, draft);
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelBlurRef.current = true;
            setDraft(node.custom_name ?? "");
            event.currentTarget.blur();
          }
        }}
        placeholder="使用系统自动名称"
        value={draft}
      />
      <p className="mt-1 text-[10px] text-muted-foreground">
        清空后恢复系统自动名称
      </p>
    </div>
  );
}

function NodeConfig({
  mode,
  node,
  runDetail
}: {
  mode: "pipeline" | "template";
  node: AigcV2Node;
  runDetail: AigcPipelineRunDetail | undefined;
}) {
  const update = useAigcEditorStore((state) => state.updateNodeConfig);
  const definition = useAigcEditorStore((state) => state.definition);
  const registration = AIGC_NODE_REGISTRY_BY_TYPE.get(node.type);
  const automaticDisplayName =
    deriveAigcNodeDisplayNames(definition.nodes).get(node.id)?.displayName ??
    aigcNodeBaseDisplayName(node);
  const managedSource = managedTextSource(node, definition.nodes);
  const displayName =
    node.custom_name?.trim() ||
    managedSource?.itemLabel ||
    automaticDisplayName;
  const modalityNode = asModalityNode(node);

  if (modalityNode) {
    return (
      <ModalityNodeConfig
        displayName={displayName}
        mode={mode}
        node={modalityNode}
        runDetail={runDetail}
      />
    );
  }

  if (node.type === "llm") {
    const imageInput = resolveAigcLlmImageInput(
      definition,
      node.id,
      runDetail
    );
    return (
      <ConfigGroup title={displayName}>
        <LlmImageInputStatus input={imageInput} />
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
  if (node.type === "video_generation") {
    return <VideoGenerationConfig displayName={displayName} node={node} />;
  }
  if (node.type === "video_enhancement") {
    return <VideoEnhancementConfig displayName={displayName} node={node} />;
  }
  if (node.type === "video_face_blur") {
    return <VideoFaceBlurNodeConfig displayName={displayName} node={node} />;
  }
  if (node.type === "json_parser") {
    return (
      <JsonParserNodeConfig
        displayName={displayName}
        node={node}
        runDetail={runDetail}
      />
    );
  }
  if (node.type === "image_to_image") {
    return <SeedreamImageConfig displayName={displayName} node={node} />;
  }
  if (node.type === "text_to_image") {
    return (
      <ConfigGroup title={displayName}>
        <AigcImageDimensionsField
          config={node.config}
          nodeId={node.id}
          onChange={(config) => update(node.id, config)}
        />
      </ConfigGroup>
    );
  }
  if (node.type === "layer_canvas" || node.type === "layer_composite") {
    return (
      <ConfigGroup title={displayName}>
        <p className="text-xs leading-5 text-muted-foreground">
          图层配置将在对应的图层工作流中编辑。
        </p>
      </ConfigGroup>
    );
  }
  return null;
}

function LlmImageInputStatus({
  input
}: {
  input: ReturnType<typeof resolveAigcLlmImageInput>;
}) {
  return (
    <div
      aria-label={`LLM 图片输入：${input.sourceLabel ?? "未连接"}，${input.statusLabel}`}
      className={cn(
        "mb-3 rounded border px-2.5 py-2 text-xs",
        input.state === "ready"
          ? "border-success/30 bg-success/10 text-success"
          : input.state === "unavailable"
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-border bg-muted/50 text-muted-foreground"
      )}
      data-testid="aigc-llm-image-input-inspector"
    >
      <p className="font-medium text-foreground">图片输入</p>
      <p className="mt-1 break-words">
        {input.sourceLabel ?? "未连接"} · {input.statusLabel}
      </p>
    </div>
  );
}

function JsonParserNodeConfig({
  displayName,
  node,
  runDetail
}: {
  displayName: string;
  node: Extract<AigcV2Node, { type: "json_parser" }>;
  runDetail: AigcPipelineRunDetail | undefined;
}) {
  const update = useAigcEditorStore((state) => state.updateNodeConfig);
  const feedback = jsonPathInputFeedback(node.config.json_path);
  const runNode = runDetail?.nodes.find((item) => item.node_id === node.id);
  const error = runNode ? getAigcNodeLogError(runNode) : null;
  const errorMessage = jsonParserErrorMessage(error);
  const count = jsonParserItemCount(runNode);

  return (
    <ConfigGroup title={displayName}>
      <Label htmlFor={`json-path-${node.id}`}>JSONPath</Label>
      <Input
        aria-describedby={`json-path-feedback-${node.id}`}
        aria-invalid={feedback.kind === "error"}
        className="mt-1.5 font-mono text-xs"
        id={`json-path-${node.id}`}
        maxLength={500}
        onChange={(event) =>
          update(node.id, {
            ...node.config,
            json_path: event.target.value
          })
        }
        placeholder="$.items"
        spellCheck={false}
        value={node.config.json_path}
      />
      <p
        className={cn(
          "mt-1.5 break-words text-[10px] leading-4",
          feedback.kind === "error"
            ? "text-destructive"
            : "text-muted-foreground"
        )}
        id={`json-path-feedback-${node.id}`}
        role={feedback.kind === "error" ? "alert" : undefined}
      >
        {feedback.message}
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded border border-border bg-muted/20 p-2 text-[10px]">
        <dt className="text-muted-foreground">状态</dt>
        <dd>{runNode ? nodeStatusLabel(runNode.status) : "未运行"}</dd>
        <dt className="text-muted-foreground">Item 数量</dt>
        <dd>{count === null ? "-" : `${count} 项`}</dd>
      </dl>
      {error ? (
        <div className="mt-3 border-l-2 border-destructive pl-2 text-[10px]">
          <p className="break-all font-mono text-destructive">
            {error.code ?? "json_parser_failed"}
          </p>
          <p className="mt-1 break-words text-destructive">{errorMessage}</p>
        </div>
      ) : null}
      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
        items 输出由系统自动连接，最多生成 20 个文本节点。
      </p>
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
  displayName,
  node
}: {
  displayName: string;
  node: Extract<AigcV2Node, { type: "image_to_image" }>;
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
    <ConfigGroup title={displayName}>
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
                    operation: option.value
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
        ) : operation === "image_to_image" ? (
          <AigcImageDimensionsField
            config={node.config as ImageModelConfig}
            nodeId={node.id}
            onChange={(config) =>
              update(node.id, { ...node.config, ...config })
            }
          />
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
  displayName,
  node
}: {
  displayName: string;
  node: Extract<AigcV2Node, { type: "video_generation" }>;
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
    promptNode?.type === "text" ? promptNode.config.text : ""
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
    <ConfigGroup title={displayName}>
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

const VIDEO_ENHANCEMENT_LABELS = {
  toolVersion: {
    standard: "标准版",
    professional: "专业版"
  },
  style: {
    hd: "高清",
    natural: "自然"
  },
  scene: {
    common: "通用",
    ugc: "UGC",
    short_series: "短剧",
    aigc: "AIGC",
    old_film: "老片修复"
  },
  bitrateLevel: {
    low: "低",
    medium: "中",
    high: "高"
  }
} as const;

function VideoEnhancementConfig({
  displayName,
  node
}: {
  displayName: string;
  node: Extract<AigcV2Node, { type: "video_enhancement" }>;
}) {
  const updateNodeConfig = useAigcEditorStore(
    (state) => state.updateNodeConfig
  );
  const config = node.config;
  const highCost = [
    config.tool_version === "professional" ? "专业版" : null,
    config.resolution_mode === "preset" &&
    (config.resolution === "4k" || config.resolution === "8k")
      ? config.resolution.toUpperCase()
      : null,
    config.bit_depth >= 12 ? `${config.bit_depth}-bit` : null
  ].filter(Boolean);

  function update(patch: Partial<VideoEnhancementConfigCandidate>) {
    updateNodeConfig(
      node.id,
      normalizeVideoEnhancementConfig({
        ...config,
        ...patch
      } as VideoEnhancementConfigCandidate)
    );
  }

  return (
    <ConfigGroup title={displayName}>
      <div className="space-y-3">
        <ConfigSection title="版本与风格">
          <SelectField
            label="版本"
            onChange={(value) =>
              update({
                tool_version:
                  value as VideoEnhancementConfig["tool_version"]
              })
            }
            options={VIDEO_ENHANCEMENT_TOOL_VERSIONS.map((value) => ({
              label: VIDEO_ENHANCEMENT_LABELS.toolVersion[value],
              value
            }))}
            value={config.tool_version}
          />
          <SelectField
            label="增强风格"
            onChange={(value) =>
              update({
                enhance_style:
                  value as VideoEnhancementConfig["enhance_style"]
              })
            }
            options={VIDEO_ENHANCEMENT_STYLES.map((value) => ({
              label: VIDEO_ENHANCEMENT_LABELS.style[value],
              value
            }))}
            value={config.enhance_style}
          />
        </ConfigSection>

        {config.tool_version === "standard" ? (
          <SelectField
            label="场景"
            onChange={(value) =>
              update({
                scene: value as NonNullable<VideoEnhancementConfig["scene"]>
              })
            }
            options={VIDEO_ENHANCEMENT_SCENES.map((value) => ({
              label: VIDEO_ENHANCEMENT_LABELS.scene[value],
              value
            }))}
            value={config.scene}
          />
        ) : null}

        <ConfigSection title="目标尺寸">
          <SelectField
            label="尺寸模式"
            onChange={(value) =>
              update({
                resolution_mode: value as
                  | "preset"
                  | "short_edge"
              })
            }
            options={[
              { label: "预设分辨率", value: "preset" },
              { label: "短边像素", value: "short_edge" }
            ]}
            value={config.resolution_mode}
          />
          {config.resolution_mode === "preset" ? (
            <SelectField
              label="分辨率"
              onChange={(value) =>
                update({
                  resolution:
                    value as NonNullable<VideoEnhancementConfig["resolution"]>
                })
              }
              options={VIDEO_ENHANCEMENT_RESOLUTIONS.map((value) => ({
                label: value.toUpperCase(),
                value
              }))}
              value={config.resolution}
            />
          ) : (
            <NumberField
              label="短边像素"
              max={VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE.maximum}
              min={VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE.minimum}
              onChange={(value) => update({ resolution_limit: value })}
              value={config.resolution_limit}
            />
          )}
        </ConfigSection>

        <ConfigSection title="帧率与码率">
          <SelectField
            label="帧率"
            onChange={(value) =>
              update({
                fps:
                  value === "source"
                    ? null
                    : config.fps ?? 30
              })
            }
            options={[
              { label: "保持原帧率", value: "source" },
              { label: "指定帧率", value: "custom" }
            ]}
            value={config.fps === null ? "source" : "custom"}
          />
          {config.fps === null ? (
            <div aria-hidden="true" className="hidden sm:block" />
          ) : (
            <NumberField
              label="目标 FPS"
              max={VIDEO_ENHANCEMENT_FPS_RANGE.maximum}
              min={VIDEO_ENHANCEMENT_FPS_RANGE.minimum}
              onChange={(value) => update({ fps: value })}
              value={config.fps}
            />
          )}
          {config.bit_depth !== 16 ? (
            <>
              <SelectField
                label="码率模式"
                onChange={(value) =>
                  update({
                    bitrate_mode: value as "level" | "custom"
                  })
                }
                options={[
                  { label: "档位", value: "level" },
                  { label: "精确码率", value: "custom" }
                ]}
                value={config.bitrate_mode}
              />
              {config.bitrate_mode === "level" ? (
                <SelectField
                  label="码率档位"
                  onChange={(value) =>
                    update({
                      bitrate_level:
                        value as NonNullable<
                          VideoEnhancementConfig["bitrate_level"]
                        >
                    })
                  }
                  options={VIDEO_ENHANCEMENT_BITRATE_LEVELS.map((value) => ({
                    label: VIDEO_ENHANCEMENT_LABELS.bitrateLevel[value],
                    value
                  }))}
                  value={config.bitrate_level}
                />
              ) : (
                <NumberField
                  label="码率 (kbps)"
                  max={VIDEO_ENHANCEMENT_BITRATE_RANGE.maximum}
                  min={VIDEO_ENHANCEMENT_BITRATE_RANGE.minimum}
                  onChange={(value) => update({ bitrate: value })}
                  value={config.bitrate}
                />
              )}
            </>
          ) : null}
        </ConfigSection>

        <SelectField
          disabled={config.tool_version === "standard"}
          label="色深"
          onChange={(value) =>
            update({
              bit_depth: Number(value) as VideoEnhancementConfig["bit_depth"]
            })
          }
          options={VIDEO_ENHANCEMENT_BIT_DEPTHS.map((value) => ({
            label: `${value}-bit`,
            value: String(value)
          }))}
          value={String(config.bit_depth)}
        />
        {config.tool_version === "standard" ? (
          <p className="text-[10px] leading-4 text-muted-foreground">
            标准版固定输出 8-bit；专业版可选择更高色深。
          </p>
        ) : config.bit_depth === 16 ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-900">
            16-bit 为高成本 MOV 输出，仅支持不超过 40 秒的视频，码率由服务自动处理。
          </p>
        ) : null}
        {highCost.length > 0 ? (
          <p className="rounded-md border border-orange-300 bg-orange-50 px-2.5 py-2 text-[10px] font-semibold text-orange-900">
            高成本配置：{highCost.join(" · ")}
          </p>
        ) : null}
      </div>
    </ConfigGroup>
  );
}

function VideoFaceBlurNodeConfig({
  displayName,
  node
}: {
  displayName: string;
  node: Extract<AigcV2Node, { type: "video_face_blur" }>;
}) {
  const updateNodeConfig = useAigcEditorStore(
    (state) => state.updateNodeConfig
  );

  function update(patch: Partial<VideoFaceBlurConfig>) {
    updateNodeConfig(node.id, { ...node.config, ...patch });
  }

  return (
    <ConfigGroup title={displayName}>
      <ConfigSection title="打码参数">
        <SelectField
          label="打码方式"
          onChange={(value) =>
            update({ mask_mode: value as VideoFaceBlurConfig["mask_mode"] })
          }
          options={VIDEO_FACE_BLUR_MASK_MODES.map((value) => ({
            label: videoFaceBlurModeLabel(value),
            value
          }))}
          value={node.config.mask_mode}
        />
        <SelectField
          label="打码强度"
          onChange={(value) =>
            update({
              mask_strength:
                value as VideoFaceBlurConfig["mask_strength"]
            })
          }
          options={VIDEO_FACE_BLUR_MASK_STRENGTHS.map((value) => ({
            label: videoFaceBlurStrengthLabel(value),
            value
          }))}
          value={node.config.mask_strength}
        />
      </ConfigSection>
    </ConfigGroup>
  );
}

type ModalityNode = Extract<
  AigcV2Node,
  { type: "audio" | "image" | "text" | "video" }
>;

function ModalityNodeConfig({
  displayName,
  mode,
  node,
  runDetail
}: {
  displayName: string;
  mode: "pipeline" | "template";
  node: ModalityNode;
  runDetail: AigcPipelineRunDetail | undefined;
}) {
  const definition = useAigcEditorStore((state) => state.definition);
  const update = useAigcEditorStore((state) => state.updateNodeConfig);
  const upstream = definition.edges.some(
    (edge) =>
      edge.targetNodeId === node.id && edge.targetHandle === node.type
  );
  const projection =
    upstream && runDetail
      ? node.type === "text"
        ? projectAigcEffectiveText(
            runDetail,
            definition as AigcPipelineDefinitionV2,
            node.id
          )
        : projectAigcModalityRunResult(runDetail, node.id)
      : null;
  const managedSource = managedTextSource(node, definition.nodes);
  const resolvedDisplayName =
    node.custom_name?.trim() || managedSource?.itemLabel || displayName;

  return (
    <ConfigGroup title={resolvedDisplayName}>
      <Label htmlFor={`node-title-${node.id}`}>内容标题</Label>
      <Input
        className="mt-1.5"
        disabled={upstream || Boolean(managedSource)}
        id={`node-title-${node.id}`}
        onChange={(event) =>
          update(node.id, { ...node.config, title: event.target.value || null })
        }
        placeholder={displayName}
        value={node.config.title ?? ""}
      />
      <div className="mt-4 border-t border-border pt-4">
        {managedSource && node.type === "text" ? (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground">
              只读上游内容 · 来源：{managedSource.parserName}
            </p>
            <div
              aria-label={`${managedSource.itemLabel}只读内容`}
              className="max-h-64 overflow-y-auto rounded border border-border bg-muted/20 p-2.5"
            >
              <p className="break-words whitespace-pre-wrap text-xs leading-5 text-foreground">
                {node.config.text || "无对应 item"}
              </p>
            </div>
          </div>
        ) : upstream && node.type === "text" ? (
          projection &&
          ["reused", "succeeded"].includes(projection.status) &&
          projection.text !== null ? (
            <div className="space-y-3">
              <AigcPromptEditor node={node} runDetail={runDetail} />
              {node.config.upstream_text_override != null ? (
                <Button
                  className="w-full"
                  onClick={() =>
                    update(node.id, {
                      ...node.config,
                      upstream_text_override: null
                    })
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  恢复上游文本
                </Button>
              ) : null}
            </div>
          ) : (
            <ModalityProjectionPreview
              displayName={displayName}
              node={node}
              projection={projection}
              runDetail={runDetail}
            />
          )
        ) : upstream ? (
          <ModalityProjectionPreview
            displayName={displayName}
            node={node}
            projection={projection}
            runDetail={runDetail}
          />
        ) : node.type === "text" ? (
          <AigcPromptEditor node={node} runDetail={runDetail} />
        ) : (
          <MediaInputConfig
            displayName={displayName}
            embedded
            mode={mode}
            node={node}
          />
        )}
      </div>
    </ConfigGroup>
  );
}

function ModalityProjectionPreview({
  displayName,
  node,
  projection,
  runDetail
}: {
  displayName: string;
  node: ModalityNode;
  projection: ReturnType<typeof projectAigcModalityRunResult>;
  runDetail: AigcPipelineRunDetail | undefined;
}) {
  const definition = useAigcEditorStore((state) => state.definition);
  if (!projection || ["idle", "ready", "queued", "running"].includes(projection.status)) {
    return <ModalityStatus copy="等待上游结果" />;
  }
  if (
    ["blocked", "canceled", "failed", "timed_out"].includes(
      projection.status
    )
  ) {
    return <ModalityStatus copy="上游执行失败" tone="error" />;
  }
  if (projection.text) {
    return (
      <div>
        <p className="whitespace-pre-wrap text-xs leading-5">
          {projection.text}
        </p>
        <Button
          className="mt-3 w-full"
          onClick={() => void navigator.clipboard.writeText(projection.text ?? "")}
          size="sm"
          type="button"
          variant="outline"
        >
          <Copy className="h-4 w-4" />
          复制文本
        </Button>
      </div>
    );
  }
  if (!projection.asset?.available || !projection.downloadUrl) {
    return <ModalityStatus copy="上游结果不可用，播放和下载已禁用" />;
  }
  return (
    <ModalityAsset
      asset={projection.asset}
      definition={definition}
      nodeId={node.id}
      runDetail={runDetail}
      title={displayName}
      type={node.type as "audio" | "image" | "video"}
    />
  );
}

function ModalityStatus({
  copy,
  tone = "muted"
}: {
  copy: string;
  tone?: "error" | "muted";
}) {
  return (
    <p
      className={cn(
        "rounded border border-dashed border-border px-3 py-6 text-center text-xs",
        tone === "error" ? "text-destructive" : "text-muted-foreground"
      )}
      role="status"
    >
      {copy}
    </p>
  );
}

type MediaInputNode = Extract<
  AigcV2Node,
  { type: "image" | "video" | "audio" }
>;

const MEDIA_INPUT_OPTIONS = {
  image: {
    accept: AIGC_MEDIA_ACCEPT.image,
    hint: "JPEG / PNG / WebP / BMP / TIFF / GIF / HEIC / HEIF；300-6000 px；小于 30 MB",
    kind: "image",
    label: "图片",
    queryKey: "selectable-image-assets"
  },
  video: {
    accept: AIGC_MEDIA_ACCEPT.video,
    hint: "MP4 / MOV；H.264 / H.265；24-60 FPS；不超过 200 MB",
    kind: "video",
    label: "视频",
    queryKey: "selectable-video-assets"
  },
  audio: {
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
  displayName,
  embedded = false,
  mode,
  node
}: {
  displayName: string;
  embedded?: boolean;
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
    node.type === "image" &&
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
    const content = (
      <p className="text-xs leading-5 text-muted-foreground">
        模板不保存具体{options.label}。创建画布实例后再选择或上传素材。
      </p>
    );
    return embedded ? content : (
      <ConfigGroup title={displayName}>{content}</ConfigGroup>
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

  const content = (
    <>
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
    </>
  );
  return embedded ? content : (
    <ConfigGroup title={displayName}>{content}</ConfigGroup>
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

function ConfigSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <fieldset className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/20 p-2 sm:grid-cols-2">
      <legend className="px-1 text-[10px] font-semibold text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <Input
        className="mt-1 h-9 text-xs text-foreground"
        max={max}
        min={min}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        step={1}
        type="number"
        value={value}
      />
    </label>
  );
}

function SelectField({
  disabled = false,
  label,
  onChange,
  options,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: readonly (string | { label: string; value: string })[];
  value: string;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
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
  definition,
  nodeId,
  runDetail
}: {
  definition: AigcPipelineDefinitionV2;
  nodeId: string | null;
  runDetail: AigcPipelineRunDetail | undefined;
}) {
  const snapshotDefinition = runDetail?.run.definition_snapshot;
  const snapshotNodes =
    snapshotDefinition?.schemaVersion === 2
      ? snapshotDefinition.nodes
      : [];
  const currentDisplayNames = deriveAigcNodeDisplayNames(definition.nodes);
  const snapshotDisplayNames = deriveAigcNodeDisplayNames(snapshotNodes);
  const resultNodes = runDetail?.nodes.filter(
    (item) =>
      (item.result.kind !== "none" ||
        item.result.metadata?.empty === true) &&
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
        const sourceNode = snapshotNodes.find(
          (candidate) => candidate.id === item.node_id
        );
        const sourceManagedLabel = sourceNode
          ? managedTextSource(sourceNode, snapshotNodes)?.itemLabel
          : null;
        const sourceName =
          currentDisplayNames.get(item.node_id)?.displayName ||
          sourceNode?.custom_name?.trim() ||
          sourceManagedLabel ||
          snapshotDisplayNames.get(item.node_id)?.displayName ||
          item.node_id;
        const modalityProjection = projectAigcModalityRunResult(
          runDetail,
          item.node_id
        );
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
              {sourceName}
            </span>
            <Badge variant={item.status === "reused" ? "info" : "success"}>
              {item.status === "reused" ? "复用" : "完成"}
            </Badge>
          </div>
          <ResultExecutionMetadata node={item} />
          {item.result.kind === "text" && item.result.text ? (
            <>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-foreground">
                {modalityProjection?.text ?? item.result.text}
              </p>
              <Button
                className="mt-3 w-full"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    modalityProjection?.text ?? item.result.text ?? ""
                  )
                }
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
                  definition={definition}
                  key={asset.asset_id}
                  nodeId={item.node_id}
                  runDetail={runDetail}
                  title={sourceName}
                />
              ))}
            </div>
          ) : null}
          {item.result.kind === "none" &&
          item.result.metadata?.empty === true ? (
            <p className="mt-3 text-xs text-muted-foreground">
              未识别到字幕
            </p>
          ) : null}
          {compositeProjection ? (
            <div className="mt-3 space-y-2">
              {compositeProjection.imageAsset ? (
                <ResultAsset
                  asset={compositeProjection.imageAsset}
                  definition={definition}
                  nodeId={item.node_id}
                  runDetail={runDetail}
                  title={sourceName}
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
  definition,
  nodeId,
  runDetail,
  title
}: {
  asset: AigcPipelineRunDetail["nodes"][number]["result"]["assets"][number];
  definition: AigcPipelineDefinitionV2;
  nodeId: string;
  runDetail: AigcPipelineRunDetail;
  title: string;
}) {
  const snapshotDefinition = runDetail.run.definition_snapshot;
  const resultUrl = asset.available
    ? getSafeAssetContentUrl(asset.download_url)
    : null;
  const modalityProjection = projectAigcModalityRunResult(runDetail, nodeId);
  const sourceNode = snapshotDefinition.nodes.find(
    (candidate) => candidate.id === nodeId
  );
  const resultTitle = title ||
    AIGC_NODE_REGISTRY_BY_TYPE.get(sourceNode?.type ?? "")?.label ||
    "字幕结果";
  if (
    asset.mime_type === "application/x-subrip" ||
    asset.mime_type === "text/srt"
  ) {
    return (
      <SubtitleResultAsset
        asset={asset}
        title={resultTitle}
      />
    );
  }
  if (
    modalityProjection &&
    modalityProjection.modality !== "text" &&
    asset.available
  ) {
    return (
      <ModalityAsset
        asset={asset}
        definition={definition}
        nodeId={nodeId}
        runDetail={runDetail}
        title={modalityProjection.title}
        type={modalityProjection.modality}
      />
    );
  }
  if (isAigcVideoResult(snapshotDefinition, nodeId, asset)) {
    const projection = projectAigcVideoResult(
      snapshotDefinition,
      nodeId,
      [asset]
    );
    const generatedMediaTitle =
      sourceNode?.type === "video_generation"
        ? resultTitle
        : projection.title;
    const download = getAigcVideoDownload(
      asset,
      generatedMediaTitle,
      definition
    );
    return (
      <div className="space-y-2">
        <AigcVideoPlayer
          audioState={projection.audioState}
          bitDepth={projection.bitDepth}
          fps={projection.fps}
          initialMetadata={{
            duration: projection.duration,
            height: null,
            width: null
          }}
          key={`${runDetail.run.id}:${asset.asset_id}`}
          mimeType={asset.mime_type}
          name={`${projection.title}-${asset.ordinal + 1}`}
          resolutionLabel={projection.resolution}
          toolVersion={projection.toolVersion}
          unavailableText="视频结果已不可用，资产可能已删除或无权访问"
          url={resultUrl}
          variant="panel"
        />
        <VideoResultMetadata projection={projection} />
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

  const download = getAigcImageDownload(asset, resultTitle, definition);
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

function SubtitleResultAsset({
  asset,
  title
}: {
  asset: AigcResultAsset;
  title: string;
}) {
  const resultUrl = asset.available
    ? getSafeAssetContentUrl(asset.download_url)
    : null;
  const subtitleQuery = useQuery({
    enabled: Boolean(resultUrl),
    queryKey: ["aigc", "subtitle-preview", asset.asset_id],
    queryFn: async () => {
      const response = await fetch(resultUrl as string);
      if (!response.ok) throw new Error("字幕预览加载失败");
      return response.text();
    }
  });
  const preview = parseSrtPreview(subtitleQuery.data ?? "");
  const download = getAigcSubtitleDownload(asset, title);
  if (!resultUrl) {
    return (
      <p className="text-xs text-muted-foreground">
        字幕结果已不可用，预览和下载已禁用
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="max-h-52 space-y-2 overflow-y-auto border border-border bg-card p-2.5">
        {subtitleQuery.isPending ? (
          <p className="text-xs text-muted-foreground">正在加载字幕预览</p>
        ) : subtitleQuery.isError ? (
          <p className="text-xs text-destructive">字幕预览加载失败</p>
        ) : preview.length === 0 ? (
          <p className="text-xs text-muted-foreground">未识别到字幕</p>
        ) : (
          preview.map((segment) => (
            <div className="grid grid-cols-[112px_1fr] gap-2 text-xs" key={segment.key}>
              <span className="font-mono text-[10px] text-muted-foreground">
                {segment.time}
              </span>
              <span className="whitespace-pre-wrap break-words text-foreground">
                {segment.text}
              </span>
            </div>
          ))
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <span>片段 {resultAssetMetadataNumber(asset, "segment_count") ?? preview.length}</span>
        <span>
          时长{" "}
          {formatVideoDuration(
            resultAssetMetadataNumber(asset, "duration_seconds") ?? 0
          )}
        </span>
      </div>
      {download ? (
        <Button asChild className="w-full" size="sm" variant="outline">
          <a download={download.filename} href={download.url}>
            <Download className="h-4 w-4" />
            下载字幕
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function parseSrtPreview(
  content: string
): Array<{ key: string; text: string; time: string }> {
  return content
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim());
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeIndex < 0) return null;
      const text = lines.slice(timeIndex + 1).filter(Boolean).join(" ");
      if (!text) return null;
      return {
        key: `${index}:${lines[timeIndex]}`,
        text,
        time: lines[timeIndex]
      };
    })
    .filter(
      (
        value
      ): value is { key: string; text: string; time: string } =>
        value !== null
    );
}

function ModalityAsset({
  asset,
  definition,
  nodeId,
  runDetail,
  title,
  type
}: {
  asset: AigcResultAsset;
  definition: AigcPipelineDefinitionV2;
  nodeId: string;
  runDetail: AigcPipelineRunDetail | undefined;
  title: string;
  type: "audio" | "image" | "video";
}) {
  const resultUrl = asset.available
    ? getSafeAssetContentUrl(asset.download_url)
    : null;
  if (type === "video") {
    const projection = runDetail
      ? projectAigcVideoResult(
          runDetail.run.definition_snapshot,
          nodeId,
          [asset]
        )
      : null;
    const download = getAigcVideoDownload(asset, title, definition);
    return (
      <div className="space-y-2">
        <AigcVideoPlayer
          audioState={projection?.audioState}
          bitDepth={projection?.bitDepth}
          fps={projection?.fps}
          initialMetadata={{
            duration:
              projection?.duration ??
              resultAssetMetadataNumber(asset, "duration_seconds"),
            height: resultAssetMetadataNumber(asset, "height"),
            width: resultAssetMetadataNumber(asset, "width")
          }}
          mimeType={asset.mime_type}
          name={title}
          resolutionLabel={projection?.resolution}
          toolVersion={projection?.toolVersion}
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
  if (type === "audio") {
    const download = getAigcAudioDownload(asset, title);
    return (
      <div className="space-y-2">
        <AigcAudioPlayer
          duration={resultAssetMetadataNumber(asset, "duration_seconds")}
          mimeType={asset.mime_type}
          name={title}
          unavailableText="音频结果已不可用，资产可能已删除或无权访问"
          url={resultUrl}
          variant="panel"
        />
        {download && resultUrl ? (
          <Button asChild className="w-full" size="sm" variant="outline">
            <a download={download.filename} href={download.url}>
              <Download className="h-4 w-4" />
              下载音频
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  const download = getAigcImageDownload(asset, title, definition);
  return resultUrl ? (
    <div className="space-y-2">
      <a
        aria-label={`查看原图：${title}`}
        className="block overflow-hidden border border-border bg-card"
        href={resultUrl}
        rel="noreferrer"
        target="_blank"
      >
        {/* Signed result URL is intentionally rendered directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={title}
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
    <ModalityStatus copy="图片结果已不可用，预览和下载已禁用" />
  );
}

function resultAssetMetadataNumber(
  asset: AigcResultAsset,
  key: string
): number | null {
  const value = asset.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function VideoResultMetadata({
  projection
}: {
  projection: ReturnType<typeof projectAigcVideoResult>;
}) {
  const items = [
    ...(projection.trackCount === null
      ? []
      : [["轨道", String(projection.trackCount)] as const]),
    ...(projection.elementCount === null
      ? []
      : [["元素", String(projection.elementCount)] as const]),
    ["分辨率", projection.resolution ?? "-"],
    ["帧率", projection.fps === null ? "-" : `${projection.fps} fps`],
    [
      "时长",
      projection.duration === null
        ? "-"
        : formatVideoDuration(projection.duration)
    ],
    [
      "版本",
      projection.toolVersion === null
        ? "-"
        : projection.toolVersion === "professional"
          ? "专业版"
          : "标准版"
    ],
    [
      "色深",
      projection.bitDepth === null ? "-" : `${projection.bitDepth}-bit`
    ],
    ...(projection.maskMode === null
      ? []
      : [["打码方式", videoFaceBlurModeLabel(projection.maskMode)] as const]),
    ...(projection.maskStrength === null
      ? []
      : [
          [
            "打码强度",
            videoFaceBlurStrengthLabel(projection.maskStrength)
          ] as const
        ]),
    ...(projection.provider === null
      ? []
      : [["供应商", projection.provider] as const]),
    ...(projection.providerTaskId === null
      ? []
      : [["供应商任务", projection.providerTaskId] as const]),
    ...(projection.providerRequestId === null
      ? []
      : [["Request ID", projection.providerRequestId] as const])
  ] as const;
  return (
    <dl
      aria-label="视频输出信息"
      className="grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-border bg-card px-2.5 py-2 text-[10px]"
    >
      {items.map(([label, value]) => (
        <div className="flex min-w-0 justify-between gap-2" key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate font-mono text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ResultExecutionMetadata({
  node
}: {
  node: AigcPipelineRunDetail["nodes"][number];
}) {
  const attempt = latestRelevantAttempt(node);
  const active =
    attempt?.status === "queued" || attempt?.status === "running";
  const cacheSource = getAigcCacheReuse(node);
  const providerTrace = getAigcProviderTrace(node);
  return (
    <dl
      aria-label={`结果执行信息：${node.node_id}`}
      className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-muted-foreground"
    >
      <dt>状态</dt>
      <dd>{nodeStatusLabel(node.status)}</dd>
      <dt>耗时</dt>
      <dd>
        {attempt
          ? formatAigcDuration(
              attempt.started_at,
              attempt.finished_at,
              active
            )
          : "-"}
      </dd>
      <dt>Attempt</dt>
      <dd>{attempt ? `#${attempt.attempt}` : "-"}</dd>
      {cacheSource ? (
        <>
          <dt>缓存复用</dt>
          <dd className="break-all font-mono">{cacheSource}</dd>
        </>
      ) : null}
      {providerTrace?.taskId ? (
        <>
          <dt>供应商任务</dt>
          <dd className="break-all font-mono">{providerTrace.taskId}</dd>
        </>
      ) : null}
      {providerTrace?.requestId ? (
        <>
          <dt>Request ID</dt>
          <dd className="break-all font-mono">{providerTrace.requestId}</dd>
        </>
      ) : null}
    </dl>
  );
}

function RunPanel({
  onCancel,
  onRetry,
  onSelectRun,
  runDetail,
  runDetailState,
  runs,
  selectedRunId
}: {
  onCancel: (runId: string) => void;
  onRetry: (runId: string, nodeId: string) => void;
  onSelectRun: (runId: string) => void;
  runDetail: AigcPipelineRunDetail | undefined;
  runDetailState: AigcRunDetailQueryState | undefined;
  runs: AigcPipelineRun[];
  selectedRunId: string | null;
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
            value={selectedRunId ?? runs[0]?.id}
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
      {!runDetail && runDetailState ? (
        <p className="text-xs text-muted-foreground" role="status">
          {runDetailState === "error"
            ? "运行详情加载失败，正在重试。"
            : "正在加载运行详情…"}
        </p>
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
                const cacheSource = getAigcCacheReuse(node);
                const providerTrace = getAigcProviderTrace(node);
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
                    {cacheSource ? (
                      <p className="text-[10px] text-info">
                        缓存复用 · 来源 Task{" "}
                        <span className="break-all font-mono">
                          {cacheSource}
                        </span>
                      </p>
                    ) : null}
                    {providerTrace ? (
                      <dl
                        aria-label={`供应商追踪标识：${node.node_id}`}
                        className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-muted-foreground"
                      >
                        {providerTrace.taskId ? (
                          <>
                            <dt>供应商任务 ID</dt>
                            <dd className="break-all font-mono">
                              {providerTrace.taskId}
                            </dd>
                          </>
                        ) : null}
                        {providerTrace.requestId ? (
                          <>
                            <dt>供应商 Request ID</dt>
                            <dd className="break-all font-mono">
                              {providerTrace.requestId}
                            </dd>
                          </>
                        ) : null}
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
  const message = jsonParserErrorMessage(error) ?? error.message;
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
      <p className="break-words text-destructive">{message}</p>
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

function readNodePaletteVisibility(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NODE_PALETTE_VISIBILITY_KEY) === "true";
  } catch {
    return false;
  }
}

function writeNodePaletteVisibility(visible: boolean): void {
  try {
    window.localStorage.setItem(
      NODE_PALETTE_VISIBILITY_KEY,
      String(visible)
    );
  } catch {
    // Keep the in-memory preference usable when browser storage is unavailable.
  }
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

function generatedMediaNameTargetNodeIds(
  definition: AigcPipelineDefinitionV2,
  sourceNodeId: string
): string[] {
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const targets = definition.edges.flatMap((edge) => {
    if (edge.sourceNodeId !== sourceNodeId) return [];
    const target = nodesById.get(edge.targetNodeId);
    return target?.type === "image" || target?.type === "video"
      ? [target.id]
      : [];
  });
  return [...new Set(targets.length > 0 ? targets : [sourceNodeId])];
}

function asModalityNode(node: AigcV2Node): ModalityNode | null {
  return node.type === "audio" ||
    node.type === "image" ||
    node.type === "text" ||
    node.type === "video"
    ? node
    : null;
}

function toFlowNode(node: AigcV2Node): AigcFlowNode {
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
  nodes: readonly AigcV2Node[] = [],
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
  definition: AigcPipelineDefinition | AigcPipelineDefinitionV2
): string | null {
  const seedreamIssue = validateSeedreamImageDefinition(definition)[0];
  if (seedreamIssue) {
    return seedreamValidationFeedback(seedreamIssue);
  }
  const videoIssue = validateVideoGenerationDefinition(definition)[0];
  if (videoIssue) {
    return videoValidationFeedback(videoIssue);
  }
  const faceBlurIssue = validateVideoFaceBlurDefinition(definition)[0];
  return faceBlurIssue
    ? `视频人脸打码节点（${faceBlurIssue.nodeId}）：${faceBlurIssue.message}`
    : null;
}

function definitionForNodeScope<
  TDefinition extends AigcPipelineDefinition | AigcPipelineDefinitionV2
>(definition: TDefinition, startNodeId: string): TDefinition {
  const nodeIds = getAigcProjectionNodeIds(definition, startNodeId);
  return {
    ...definition,
    nodes: definition.nodes.filter((node) => nodeIds.has(node.id)),
    edges: definition.edges.filter(
      (edge) =>
        nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)
    )
  } as TDefinition;
}

function setsOverlap(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): boolean {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function editorDraftFromEntity(entity: EditorEntity): AigcEditorDraft {
  return {
    definition: serializeAigcEditorDefinition(entity.definition),
    description: entity.description,
    name: entity.name
  };
}

function editorDraftFromState(
  state: ReturnType<AigcEditorStore["getState"]>
): AigcEditorDraft {
  return {
    definition: state.definition,
    description: state.description,
    name: state.name
  };
}

function editorDraftsEqual(
  left: Readonly<AigcEditorDraft>,
  right: Readonly<AigcEditorDraft>
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateEditorDraft(
  draft: Readonly<AigcEditorDraft>,
  startNodeId?: string
): string | null {
  if (!draft.name.trim()) return "名称不能为空。";
  return definitionValidationIssue(
    startNodeId
      ? definitionForNodeScope(draft.definition, startNodeId)
      : draft.definition
  );
}

function autosaveErrorMessage(error: unknown): string {
  if (
    (isApiError(error) && error.status === 409) ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 409)
  ) {
    return "保存冲突：服务端已有更新，请刷新后重新编辑。";
  }
  return getUserFacingErrorMessage(error);
}

function autosaveStatusText(state: AutosaveState): string {
  if (state.status === "pending") return "等待自动保存";
  if (state.status === "saving") {
    return state.retryAttempt > 0
      ? `正在保存（重试 ${state.retryAttempt}/3）`
      : "正在保存";
  }
  if (state.status === "failed") {
    return `自动保存失败：${state.message ?? "请稍后重试。"}`;
  }
  if (state.status === "conflict") {
    return state.message ?? "保存冲突：服务端已有更新，请刷新后重新编辑。";
  }
  if (state.status === "invalid") {
    return `草稿无效：${state.message ?? "请检查画布内容。"}`;
  }
  return `已保存 Revision ${state.revision}`;
}

function ToolbarStarMap() {
  const modalities = ["text", "image", "video", "audio"] as const;
  const pointPositions = [
    { left: "1%", top: 12 },
    { left: "9%", top: 27 },
    { left: "17%", top: 11 },
    { left: "25%", top: 28 },
    { left: "33%", top: 14 },
    { left: "41%", top: 25 },
    { left: "49%", top: 10 },
    { left: "57%", top: 29 },
    { left: "65%", top: 13 },
    { left: "73%", top: 26 },
    { left: "81%", top: 11 },
    { left: "89%", top: 28 }
  ] as const;
  const lineRotations = [
    7.5, -8, 8.5, -7, 5.5, -7.5, 9.5, -8, 6.5, -7.5, 8.5
  ] as const;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-2 top-0 z-0 hidden h-full xl:block"
      data-testid="aigc-toolbar-star-map"
    >
      {pointPositions.slice(0, -1).map((point, index) => (
        <span
          className="absolute h-px w-[8.1%] origin-left bg-[#718096]/25"
          data-testid="aigc-toolbar-star-line"
          key={`line-${index}`}
          style={{
            left: point.left,
            top: point.top + 2,
            transform: `rotate(${lineRotations[index]}deg)`
          }}
        />
      ))}
      {pointPositions.map((point, index) => {
        const modality = modalities[index % modalities.length];
        const color = `var(--aigc-modality-${modality})`;
        return (
          <span
            className="absolute h-[5px] w-[5px] rounded-full shadow-[0_0_9px_currentColor]"
            data-modality={modality}
            data-testid="aigc-toolbar-star-point"
            key={`${modality}-${index}`}
            style={{
              backgroundColor: color,
              color,
              left: point.left,
              top: point.top
            }}
          />
        );
      })}
    </div>
  );
}

function useLatestCallback<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  return useCallback(
    (...args: TArgs) => callbackRef.current(...args),
    []
  );
}
