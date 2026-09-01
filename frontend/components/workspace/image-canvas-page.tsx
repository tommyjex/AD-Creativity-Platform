"use client";

import {
  useNodesState,
  type Node,
  type NodeChange,
  type OnNodeDrag
} from "@xyflow/react";
import { useRouter } from "next/navigation";
import { ImageIcon, ImagePlus, Library, Upload } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { Bbox } from "@/components/workspace/canvas/bbox-canvas";
import {
  CanvasHandlersProvider,
  REFERENCE_MEDIA_MIN_SIZE,
  REFERENCE_NODE_HORIZONTAL_CHROME,
  REFERENCE_NODE_VERTICAL_CHROME,
  type CanvasHandlers,
  type OutputNodeData,
  type ReferenceNodeData
} from "@/components/workspace/canvas/canvas-context";
import {
  CanvasDock,
  type GenerationMode
} from "@/components/workspace/canvas/canvas-dock";
import { NodeCanvas } from "@/components/workspace/canvas/node-canvas";
import { LayerDecomposeDialog } from "@/components/workspace/layer-decompose-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import { getAssetDownloadUrl, getSafePreviewUrl } from "@/lib/asset-display";
import type {
  Asset,
  Brief,
  CanvasLayout,
  CanvasNode,
  CanvasNodeSource,
  GenerationTask,
  ImageGenerationSize,
  ImageLayerSetDetail,
  ImageOutputFormat,
  Project
} from "@/lib/api-types";

const ACTIVE_TASK_STATUSES = new Set(["queued", "running"]);
const SAVE_DEBOUNCE_MS = 800;
const DEFAULT_NODE_SIZE = 260;
const OUTPUT_NODE_MIN_WIDTH = 140;
// Border (2px) + media padding (8px) + fixed header (32px) + toolbar (40px).
const OUTPUT_NODE_VERTICAL_CHROME = 82;
const OUTPUT_NODE_HORIZONTAL_CHROME = 10;

/**
 * Compute the reference media box from the intrinsic image dimensions. The
 * longer edge starts at `base`; extreme ratios expand it as needed so neither
 * media edge falls below the usable minimum.
 */
export function fitNodeSize(
  naturalWidth: number,
  naturalHeight: number,
  base = DEFAULT_NODE_SIZE
): { height: number; width: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { height: base, width: base };
  }
  if (naturalWidth >= naturalHeight) {
    const ratio = naturalWidth / naturalHeight;
    const height = Math.max(
      REFERENCE_MEDIA_MIN_SIZE,
      Math.floor(base / ratio)
    );
    return {
      height,
      width:
        height === REFERENCE_MEDIA_MIN_SIZE ? Math.ceil(height * ratio) : base
    };
  }
  const ratio = naturalWidth / naturalHeight;
  const width = Math.max(
    REFERENCE_MEDIA_MIN_SIZE,
    Math.floor(base * ratio)
  );
  return {
    height: width === REFERENCE_MEDIA_MIN_SIZE ? Math.ceil(width / ratio) : base,
    width
  };
}

export function fitReferenceNodeSize(
  naturalWidth: number,
  naturalHeight: number,
  base = DEFAULT_NODE_SIZE
): { height: number; width: number } {
  const media = fitNodeSize(naturalWidth, naturalHeight, base);
  return {
    height: media.height + REFERENCE_NODE_VERTICAL_CHROME,
    width: media.width + REFERENCE_NODE_HORIZONTAL_CHROME
  };
}

export function resizeReferenceNodeSize(
  requestedWidth: number,
  requestedHeight: number,
  currentWidth: number,
  currentHeight: number,
  imageAspectRatio: number
): { height: number; width: number } {
  if (
    requestedWidth <= 0 ||
    requestedHeight <= 0 ||
    currentWidth <= 0 ||
    currentHeight <= 0 ||
    imageAspectRatio <= 0
  ) {
    return { height: requestedHeight, width: requestedWidth };
  }

  const currentMediaWidth = Math.max(
    REFERENCE_MEDIA_MIN_SIZE,
    currentWidth - REFERENCE_NODE_HORIZONTAL_CHROME
  );
  const currentMediaHeight = Math.max(
    REFERENCE_MEDIA_MIN_SIZE,
    currentHeight - REFERENCE_NODE_VERTICAL_CHROME
  );
  const requestedMediaWidth = Math.max(
    1,
    requestedWidth - REFERENCE_NODE_HORIZONTAL_CHROME
  );
  const requestedMediaHeight = Math.max(
    1,
    requestedHeight - REFERENCE_NODE_VERTICAL_CHROME
  );
  const widthScale = requestedMediaWidth / currentMediaWidth;
  const heightScale = requestedMediaHeight / currentMediaHeight;
  const resizeFromWidth =
    Math.abs(Math.log(widthScale)) >= Math.abs(Math.log(heightScale));

  let mediaWidth = resizeFromWidth
    ? requestedMediaWidth
    : requestedMediaHeight * imageAspectRatio;
  mediaWidth = Math.max(
    mediaWidth,
    REFERENCE_MEDIA_MIN_SIZE,
    REFERENCE_MEDIA_MIN_SIZE * imageAspectRatio
  );
  const mediaHeight = mediaWidth / imageAspectRatio;

  return {
    height: Math.round(mediaHeight + REFERENCE_NODE_VERTICAL_CHROME),
    width: Math.round(mediaWidth + REFERENCE_NODE_HORIZONTAL_CHROME)
  };
}

export function isLegacyReferenceNodeSize(
  width: number,
  height: number,
  imageAspectRatio: number
): boolean {
  if (width <= 0 || height <= 0 || imageAspectRatio <= 0) return false;
  if (
    Math.abs(width - DEFAULT_NODE_SIZE) < 0.5 &&
    Math.abs(height - DEFAULT_NODE_SIZE) < 0.5
  ) {
    return true;
  }

  const mediaWidth = width - REFERENCE_NODE_HORIZONTAL_CHROME;
  const mediaHeight = height - REFERENCE_NODE_VERTICAL_CHROME;
  if (mediaWidth <= 0 || mediaHeight <= 0) return true;

  const ratioError = (ratio: number) =>
    Math.abs(Math.log(ratio / imageAspectRatio));
  return ratioError(width / height) + 0.01 < ratioError(mediaWidth / mediaHeight);
}

export function fitOutputNodeSize(
  naturalWidth: number,
  naturalHeight: number,
  base = DEFAULT_NODE_SIZE
): { height: number; width: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { height: base, width: base };
  }
  const media = fitNodeSize(naturalWidth, naturalHeight, base);
  return {
    height: media.height + OUTPUT_NODE_VERTICAL_CHROME,
    width: Math.max(
      OUTPUT_NODE_MIN_WIDTH,
      media.width + OUTPUT_NODE_HORIZONTAL_CHROME
    )
  };
}

type CanvasFlowNode = Node<ReferenceNodeData | OutputNodeData>;

export function ImageCanvasPage({
  initialLayout,
  initialProject
}: {
  initialLayout: CanvasLayout;
  initialProject: Project;
}) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initialProject);
  const assetsById = useMemo(
    () => new Map(project.assets.map((asset) => [asset.id, asset])),
    [project.assets]
  );
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const initialNodes = useMemo(
    () => buildInitialNodes(initialLayout, project),
    // Snapshot from the server payload; recomputed intentionally only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [nodes, setNodes, onNodesChangeBase] =
    useNodesState<CanvasFlowNode>(initialNodes);

  const [aspectRatio, setAspectRatio] = useState<Brief["aspect_ratio"]>(
    project.brief.aspect_ratio
  );
  const [format, setFormat] = useState<ImageOutputFormat>("png");
  const [size, setSize] = useState<ImageGenerationSize>("2K");
  const [prompt, setPrompt] = useState("");
  const [serializedPrompt, setSerializedPrompt] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [removeNodeId, setRemoveNodeId] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [decomposeContext, setDecomposeContext] = useState<{
    asset: Asset;
    nodeId: string;
  } | null>(null);
  const [layerBusyNodeId, setLayerBusyNodeId] = useState<string | null>(null);
  const [layerSets, setLayerSets] = useState<ImageLayerSetDetail[]>([]);

  // Layout persistence bookkeeping: current server revision, dirty flag, and
  // the latest nodes snapshot the debounced saver should serialize.
  const revisionRef = useRef<number>(initialLayout.revision);
  const dirtyRef = useRef<boolean>(false);
  const conflictRef = useRef<boolean>(false);
  const saveTimerRef = useRef<number | null>(null);
  const nodesRef = useRef<CanvasFlowNode[]>(nodes);
  const pendingReferenceSizeMigrationsRef = useRef<
    Map<string, { height: number; width: number }>
  >(new Map());
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const referenceNodes = useMemo(
    () =>
      nodes.filter(
        (node): node is Node<ReferenceNodeData> => node.type === "reference"
      ),
    [nodes]
  );

  // Derive the dock's region-reference inputs from reference nodes that carry a
  // bbox, ordered by their「图N」numbering (order_index).
  const orderedReferenceNodes = useMemo(
    () =>
      [...referenceNodes].sort(
        (a, b) => (a.data.orderIndex ?? 0) - (b.data.orderIndex ?? 0)
      ),
    [referenceNodes]
  );
  const referenceAssets = useMemo(
    () =>
      orderedReferenceNodes
        .map((node) => assetsById.get(node.data.assetId))
        .filter((asset): asset is Asset => asset !== undefined),
    [assetsById, orderedReferenceNodes]
  );
  const selectedReferenceAssets = useMemo(
    () =>
      orderedReferenceNodes
        .filter((node) => node.data.bbox !== null)
        .map((node) => assetsById.get(node.data.assetId))
        .filter((asset): asset is Asset => asset !== undefined),
    [assetsById, orderedReferenceNodes]
  );
  const referenceBboxes = useMemo(() => {
    const map: Record<string, Bbox> = {};
    for (const node of orderedReferenceNodes) {
      if (node.data.bbox) map[node.data.assetId] = node.data.bbox;
    }
    return map;
  }, [orderedReferenceNodes]);
  const bboxOrder = useMemo(
    () =>
      orderedReferenceNodes
        .filter((node) => node.data.bbox !== null)
        .map((node) => node.data.assetId),
    [orderedReferenceNodes]
  );

  // Project uploaded images eligible for「从资产库添加」, excluding assets that
  // already have a reference node on the canvas.
  const libraryCandidates = useMemo(() => {
    const usedAssetIds = new Set(
      referenceNodes.map((node) => node.data.assetId)
    );
    return project.assets.filter(
      (asset) =>
        asset.type === "uploaded_image" &&
        asset.asset_role === "public" &&
        asset.status === "succeeded" &&
        !usedAssetIds.has(asset.id)
    );
  }, [project.assets, referenceNodes]);

  const mode: GenerationMode =
    selectedReferenceAssets.length > 0 ? "image_to_image" : "text_to_image";
  const validationMessage = prompt.trim()
    ? null
    : "请输入图片提示词后生成。";

  const persistLayout = useCallback(async () => {
    if (!dirtyRef.current || conflictRef.current) return;
    const payloadNodes = serializeNodes(nodesRef.current);
    try {
      const saved = await apiClient.saveCanvasLayout(project.id, {
        expected_revision: revisionRef.current,
        nodes: payloadNodes
      });
      revisionRef.current = saved.revision;
      dirtyRef.current = false;
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        conflictRef.current = true;
        setFeedback("画布布局已在其它位置更新，请刷新页面后继续，以免覆盖远端改动。");
        return;
      }
      setFeedback(getUserFacingErrorMessage(error));
    }
  }, [project.id]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistLayout();
    }, SAVE_DEBOUNCE_MS);
  }, [persistLayout]);

  useEffect(() => {
    let didCommitMigration = false;
    for (const [nodeId, dimensions] of pendingReferenceSizeMigrationsRef.current) {
      const node = nodes.find((item) => item.id === nodeId);
      if (!node) {
        pendingReferenceSizeMigrationsRef.current.delete(nodeId);
        continue;
      }
      if (
        node.width === dimensions.width &&
        node.height === dimensions.height
      ) {
        pendingReferenceSizeMigrationsRef.current.delete(nodeId);
        didCommitMigration = true;
      }
    }
    if (didCommitMigration) scheduleSave();
  }, [nodes, scheduleSave]);

  // Navigation interception: warn before unload while there are unsaved layout
  // changes, matching the layer editor's confirm-on-close convention.
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiClient
      .listImageLayerSets(project.id, { cache: "no-store" })
      .then((sets) => {
        if (active) setLayerSets(sets);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [project.id]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      const normalizedChanges = changes.map((change) => {
        if (change.type !== "dimensions" || !change.dimensions) return change;
        const node = nodesRef.current.find((item) => item.id === change.id);
        if (!node || node.type !== "reference") return change;
        const imageAspectRatio = (node.data as ReferenceNodeData)
          .imageAspectRatio;
        if (!imageAspectRatio) return change;
        return {
          ...change,
          dimensions: resizeReferenceNodeSize(
            change.dimensions.width,
            change.dimensions.height,
            readDimension(node, "width"),
            readDimension(node, "height"),
            imageAspectRatio
          )
        };
      });
      onNodesChangeBase(normalizedChanges);
      const structural = normalizedChanges.some(
        (change) =>
          (change.type === "position" && change.dragging === false) ||
          (change.type === "dimensions" && change.resizing === false) ||
          change.type === "remove"
      );
      if (structural) scheduleSave();
    },
    [onNodesChangeBase, scheduleSave]
  );

  const onNodeDragStop = useCallback<OnNodeDrag<CanvasFlowNode>>(() => {
    scheduleSave();
  }, [scheduleSave]);

  const refreshProject = useCallback(async () => {
    const next = await apiClient.getProject(project.id, { cache: "no-store" });
    setProject(next);
    return next;
  }, [project.id]);

  const hasPendingOutput = nodes.some(
    (node) =>
      node.type === "output" &&
      node.data.status === "pending" &&
      node.data.taskId !== null
  );

  // Poll every pending output node until its task resolves; update node data in
  // place and persist the resolved asset reference into the layout.
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    const readPendingNodes = () =>
      nodesRef.current.filter(
        (node): node is Node<OutputNodeData> =>
          node.type === "output" &&
          node.data.status === "pending" &&
          node.data.taskId !== null
      );

    const schedulePoll = () => {
      const pending = readPendingNodes();
      if (cancelled || pending.length === 0) return;

      timer = window.setTimeout(runPoll, 1000);
    };

    async function runPoll() {
      timer = null;
      const pending = readPendingNodes();
      for (const node of pending) {
        try {
          const task = await apiClient.getTask(node.data.taskId as string, {
            cache: "no-store"
          });
          if (cancelled) continue;
          if (ACTIVE_TASK_STATUSES.has(task.status)) continue;
          if (task.status === "succeeded") {
            const nextProject = await refreshProject();
            if (cancelled) return;
            const asset = pickOutputAsset(task, nextProject);
            updateNodeData(setNodes, node.id, {
              assetId: asset?.id ?? null,
              name: asset ? assetName(asset, "生成结果") : "生成结果",
              status: "succeeded",
              url: asset ? getSafePreviewUrl(asset) : null
            });
            scheduleSave();
          } else {
            updateNodeData(setNodes, node.id, {
              errorMessage: task.error?.message ?? "生成失败，可重试。",
              status: "failed"
            });
          }
        } catch {
          // Transient polling failures retry on the next tick.
        }
      }
      schedulePoll();
    }

    schedulePoll();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [hasPendingOutput, refreshProject, scheduleSave, setNodes]);

  const addReferenceNode = useCallback(
    (asset: Asset) => {
      const nodeId = `reference-${asset.id}`;
      // Whether this asset already has a node decides if we should measure and
      // resize; existence dedup itself stays authoritative inside setNodes.
      const alreadyExists = nodesRef.current.some(
        (node) =>
          node.type === "reference" &&
          (node.data as ReferenceNodeData).assetId === asset.id
      );
      setNodes((current) => {
        if (
          current.some(
            (node) => node.type === "reference" && node.data.assetId === asset.id
          )
        ) {
          return current;
        }
        const orderIndex =
          current
            .filter((node) => node.type === "reference")
            .reduce(
              (max, node) =>
                Math.max(max, (node.data as ReferenceNodeData).orderIndex ?? 0),
              0
            ) + 1;
        const z =
          current.reduce((max, node) => Math.max(max, node.zIndex ?? 0), 0) + 1;
        const node: Node<ReferenceNodeData> = {
          data: {
            assetId: asset.id,
            bbox: null,
            disabled: false,
            imageAspectRatio: null,
            label: `图${orderIndex}`,
            name: assetName(asset, "参考图"),
            orderIndex,
            url: getSafePreviewUrl(asset)
          },
          height: DEFAULT_NODE_SIZE,
          id: nodeId,
          position: spawnPosition(current.length),
          type: "reference",
          width: DEFAULT_NODE_SIZE,
          zIndex: z
        };
        return [...current, node];
      });
      scheduleSave();
      // Asset metadata cannot be trusted to carry pixel dimensions, so measure
      // the image on the client and reshape the node to its native aspect ratio
      // once loaded. The node already appeared (square fallback) so the add flow
      // is never blocked; load failures simply keep the square.
      if (alreadyExists) return;
      const previewUrl = getSafePreviewUrl(asset);
      if (!previewUrl) return;
      const image = new window.Image();
      image.onload = () => {
        const imageAspectRatio = image.naturalWidth / image.naturalHeight;
        const { height, width } = fitReferenceNodeSize(
          image.naturalWidth,
          image.naturalHeight
        );
        if (!Number.isFinite(imageAspectRatio) || imageAspectRatio <= 0) return;
        setNodes((current) =>
          current.map((node) =>
            node.id === nodeId
              ? applyNodeDimensions(
                  {
                    ...node,
                    data: { ...node.data, imageAspectRatio }
                  },
                  { height, width }
                )
              : node
          )
        );
        scheduleSave();
      };
      image.src = previewUrl;
    },
    [scheduleSave, setNodes]
  );

  const handleRemoveReferenceBbox = useCallback(
    (assetId: string) => {
      const node = nodesRef.current.find(
        (item) =>
          item.type === "reference" &&
          (item.data as ReferenceNodeData).assetId === assetId
      );
      if (!node) return;
      updateNodeData(setNodes, node.id, { bbox: null });
      scheduleSave();
    },
    [scheduleSave, setNodes]
  );

  async function handleReferenceFiles(files: File[]) {
    if (files.length === 0 || isUploadingReference || isSubmitting) return;
    setIsUploadingReference(true);
    setFeedback(null);
    try {
      const uploaded = await Promise.all(
        files.map((file) =>
          apiClient.uploadImageProjectReference(project.id, file, {
            filename: file.name,
            mimeType: file.type
          })
        )
      );
      const nextProject = await apiClient.setImageProjectReferenceSelection(
        project.id,
        {
          asset_ids: [
            ...(project.image_reference_asset_ids ?? []),
            ...uploaded.map((asset) => asset.id)
          ]
        }
      );
      setProject(nextProject);
      for (const asset of uploaded) {
        const resolved =
          nextProject.assets.find((item) => item.id === asset.id) ?? asset;
        addReferenceNode(resolved);
      }
      setFeedback(`已添加 ${uploaded.length} 张参考图节点。`);
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsUploadingReference(false);
    }
  }

  async function handleGenerate() {
    if (isSubmitting || !prompt.trim()) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      let task: GenerationTask;
      if (mode === "image_to_image") {
        const version = await apiClient.saveImagePromptVersion(project.id, {
          prompt: serializedPrompt || prompt
        });
        task = await apiClient.generateProjectImage(project.id, {
          format,
          operation: "text_to_image",
          prompt_version_id: version.id,
          reference_asset_ids: selectedReferenceAssets.map((asset) => asset.id),
          size
        });
      } else {
        const version = await apiClient.saveImagePromptVersion(project.id, {
          prompt
        });
        task = await apiClient.generateProjectImage(project.id, {
          format,
          operation: "text_to_image",
          prompt_version_id: version.id,
          size
        });
      }
      addOutputNode(task, mode);
      setFeedback("图片生成中，请留在画布查看结果。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function addOutputNode(task: GenerationTask, source: CanvasNodeSource) {
    setNodes((current) => {
      const z =
        current.reduce((max, node) => Math.max(max, node.zIndex ?? 0), 0) + 1;
      const node: Node<OutputNodeData> = {
        data: {
          assetId: null,
          disabled: false,
          errorMessage: null,
          layerBusy: false,
          name: "生成结果",
          source,
          status: "pending",
          taskId: task.id,
          url: null
        },
        height: DEFAULT_NODE_SIZE,
        id: `output-${task.id}`,
        position: spawnPosition(current.length),
        type: "output",
        width: DEFAULT_NODE_SIZE,
        zIndex: z
      };
      return [...current, node];
    });
    scheduleSave();
  }

  const handlers: CanvasHandlers = useMemo(
    () => ({
      getOutputDownloadUrl: (nodeId) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        const assetId =
          node && node.type === "output"
            ? (node.data as OutputNodeData).assetId
            : null;
        const asset = assetId ? assetsById.get(assetId) : undefined;
        return asset ? getAssetDownloadUrl(asset) : null;
      },
      onOutputImageLoad: (nodeId, naturalWidth, naturalHeight) => {
        if (naturalWidth <= 0 || naturalHeight <= 0) return;
        const node = nodesRef.current.find((item) => item.id === nodeId);
        if (!node || node.type !== "output") return;
        const width = readDimension(node, "width");
        const height = readDimension(node, "height");
        // Migrate default square output nodes, including legacy saved layouts.
        // Preserve dimensions the user has already resized explicitly.
        if (
          Math.abs(width - DEFAULT_NODE_SIZE) >= 0.5 ||
          Math.abs(height - DEFAULT_NODE_SIZE) >= 0.5
        ) {
          return;
        }
        const fitted = fitOutputNodeSize(naturalWidth, naturalHeight);
        setNodes((current) =>
          current.map((item) =>
            item.id === nodeId ? { ...item, ...fitted } : item
          )
        );
        scheduleSave();
      },
      onOutputLayerDecompose: (nodeId) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        const assetId =
          node && node.type === "output"
            ? (node.data as OutputNodeData).assetId
            : null;
        const asset = assetId ? assetsById.get(assetId) : undefined;
        if (!asset) return;
        const existing = layerSets
          .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
          .find((set) => set.source_asset_id === asset.id);
        if (existing) {
          router.push(`/projects/${project.id}/canvas/layers/${existing.id}`);
          return;
        }
        setDecomposeContext({ asset, nodeId });
      },
      onOutputPreview: (nodeId) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        const assetId =
          node && node.type === "output"
            ? (node.data as OutputNodeData).assetId
            : null;
        const asset = assetId ? assetsById.get(assetId) : undefined;
        if (asset) setPreviewAsset(asset);
      },
      onOutputSetAsReference: (nodeId) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        const assetId =
          node && node.type === "output"
            ? (node.data as OutputNodeData).assetId
            : null;
        const asset = assetId ? assetsById.get(assetId) : undefined;
        if (asset) void handleSetOutputAsReference(asset);
      },
      onReferenceBboxChange: (nodeId, bbox) => {
        updateNodeData(setNodes, nodeId, { bbox });
        scheduleSave();
      },
      onReferenceImageLoad: (nodeId, naturalWidth, naturalHeight) => {
        if (naturalWidth <= 0 || naturalHeight <= 0) return;
        const imageAspectRatio = naturalWidth / naturalHeight;
        if (!Number.isFinite(imageAspectRatio) || imageAspectRatio <= 0) return;

        setNodes((current) => {
          const node = current.find((item) => item.id === nodeId);
          if (!node || node.type !== "reference") return current;

          const width = readDimension(node, "width");
          const height = readDimension(node, "height");
          const shouldMigrate = isLegacyReferenceNodeSize(
            width,
            height,
            imageAspectRatio
          );
          const isDefaultFallback =
            Math.abs(width - DEFAULT_NODE_SIZE) < 0.5 &&
            Math.abs(height - DEFAULT_NODE_SIZE) < 0.5;
          const migratedSize = isDefaultFallback
            ? fitReferenceNodeSize(naturalWidth, naturalHeight)
            : {
                height: height + REFERENCE_NODE_VERTICAL_CHROME,
                width: width + REFERENCE_NODE_HORIZONTAL_CHROME
              };

          return current.map((item) => {
            if (item.id !== nodeId) return item;
            const nextNode = {
              ...item,
              data: { ...item.data, imageAspectRatio }
            };
            if (!shouldMigrate) return nextNode;
            pendingReferenceSizeMigrationsRef.current.set(nodeId, migratedSize);
            return applyNodeDimensions(nextNode, migratedSize);
          });
        });
      },
      onReferencePreview: (nodeId) => {
        const node = nodesRef.current.find((item) => item.id === nodeId);
        const assetId =
          node && node.type === "reference"
            ? (node.data as ReferenceNodeData).assetId
            : null;
        const asset = assetId ? assetsById.get(assetId) : undefined;
        if (asset) setPreviewAsset(asset);
      },
      onRequestRemoveReference: (nodeId) => setRemoveNodeId(nodeId)
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assetsById, layerSets, project.id, router, scheduleSave, setNodes]
  );

  async function handleSetOutputAsReference(asset: Asset) {
    if (isUploadingReference) return;
    setFeedback(null);
    try {
      const nextProject = await apiClient.setImageProjectReferenceSelection(
        project.id,
        {
          asset_ids: Array.from(
            new Set([...(project.image_reference_asset_ids ?? []), asset.id])
          )
        }
      );
      setProject(nextProject);
      const resolved =
        nextProject.assets.find((item) => item.id === asset.id) ?? asset;
      addReferenceNode(resolved);
      setFeedback("已加入参考图并创建参考图节点。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function handleAddFromLibrary(asset: Asset) {
    if (isUploadingReference || isSubmitting) return;
    setIsLibraryOpen(false);
    setFeedback(null);
    try {
      const nextProject = await apiClient.setImageProjectReferenceSelection(
        project.id,
        {
          asset_ids: Array.from(
            new Set([...(project.image_reference_asset_ids ?? []), asset.id])
          )
        }
      );
      setProject(nextProject);
      const resolved =
        nextProject.assets.find((item) => item.id === asset.id) ?? asset;
      addReferenceNode(resolved);
      setFeedback("已从资产库添加参考图节点。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function confirmRemoveReference() {
    const nodeId = removeNodeId;
    if (!nodeId) return;
    const node = nodesRef.current.find((item) => item.id === nodeId);
    const assetId =
      node && node.type === "reference"
        ? (node.data as ReferenceNodeData).assetId
        : null;
    setRemoveNodeId(null);
    setNodes((current) => current.filter((item) => item.id !== nodeId));
    scheduleSave();
    if (!assetId) return;
    try {
      const nextProject = await apiClient.setImageProjectReferenceSelection(
        project.id,
        {
          asset_ids: (project.image_reference_asset_ids ?? []).filter(
            (id) => id !== assetId
          )
        }
      );
      setProject(nextProject);
      setFeedback("已从项目参考图中移除，后端原始资产仍保留。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function handleDecomposeSubmit({
    bbox,
    prompt: decomposePrompt
  }: {
    bbox: Parameters<typeof apiClient.decomposeImageLayers>[1]["bbox"];
    prompt: string | null;
  }) {
    if (!decomposeContext || layerBusyNodeId) return;
    const { asset, nodeId } = decomposeContext;
    setFeedback(null);
    setLayerBusyNodeId(nodeId);
    updateNodeData(setNodes, nodeId, { layerBusy: true });
    setDecomposeContext(null);
    try {
      const task = await apiClient.decomposeImageLayers(project.id, {
        bbox,
        format: "png",
        prompt: decomposePrompt,
        size: "auto",
        source_asset_id: asset.id
      });
      await pollLayerDecomposition(task, asset.id, nodeId);
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
      updateNodeData(setNodes, nodeId, { layerBusy: false });
      setLayerBusyNodeId(null);
    }
  }

  async function pollLayerDecomposition(
    task: GenerationTask,
    sourceAssetId: string,
    nodeId: string
  ) {
    let current = task;
    while (ACTIVE_TASK_STATUSES.has(current.status)) {
      await delay(1000);
      current = await apiClient.getTask(current.id, { cache: "no-store" });
    }
    updateNodeData(setNodes, nodeId, { layerBusy: false });
    setLayerBusyNodeId(null);
    if (current.status !== "succeeded") {
      setFeedback(current.error?.message ?? "图层拆分失败，可重试。");
      return;
    }
    const sets = await apiClient.listImageLayerSets(project.id, {
      cache: "no-store"
    });
    setLayerSets(sets);
    const created = sets
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
      .find((set) => set.source_asset_id === sourceAssetId);
    if (created) {
      router.push(`/projects/${project.id}/canvas/layers/${created.id}`);
    }
  }

  const isEmpty = nodes.length === 0;
  const previewName = previewAsset ? assetName(previewAsset, "图片") : "图片";
  const previewUrl = previewAsset ? getSafePreviewUrl(previewAsset) : null;
  const decomposeAsset = decomposeContext?.asset ?? null;

  return (
    <main
      className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden bg-card"
      data-canvas-revision={initialLayout.revision}
    >
      {feedback ? (
        <p className="sr-only" role="status">
          {feedback}
        </p>
      ) : null}
      <input
        accept="image/png,image/jpeg,image/webp"
        aria-label="上传参考图"
        className="sr-only"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void handleReferenceFiles(files);
        }}
        ref={referenceInputRef}
        type="file"
      />
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
        <Button
          disabled={isUploadingReference || isSubmitting}
          onClick={() => referenceInputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <Upload className="h-4 w-4" />
          添加参考图
        </Button>
        <Button
          disabled={isUploadingReference || isSubmitting}
          onClick={() => setIsLibraryOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Library className="h-4 w-4" />
          从资产库添加
        </Button>
        <Button
          aria-label="关闭"
          onClick={() => router.back()}
          size="sm"
          type="button"
          variant="ghost"
        >
          关闭
        </Button>
      </div>

      <CanvasHandlersProvider value={handlers}>
        <NodeCanvas
          nodes={nodes}
          onNodeDragStop={onNodeDragStop}
          onNodesChange={onNodesChange}
        >
          {isEmpty ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
              <div className="pointer-events-auto max-w-sm rounded-2xl border border-dashed border-border bg-card/90 p-6 text-center shadow-sm">
                <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-3 text-sm font-semibold text-foreground">
                  画布还是空的
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  添加参考图节点，或直接在右侧填写提示词生成第一张图片。
                </p>
                <Button
                  className="mt-4"
                  disabled={isUploadingReference || isSubmitting}
                  onClick={() => referenceInputRef.current?.click()}
                  size="sm"
                  type="button"
                >
                  <Upload className="h-4 w-4" />
                  添加参考图
                </Button>
                <Button
                  className="mt-2"
                  disabled={isUploadingReference || isSubmitting}
                  onClick={() => setIsLibraryOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Library className="h-4 w-4" />
                  从资产库添加
                </Button>
              </div>
            </div>
          ) : null}
          <CanvasDock
            aspectRatio={aspectRatio}
            bboxOrder={bboxOrder}
            disabled={false}
            feedback={feedback}
            format={format}
            isSubmitting={isSubmitting}
            mode={mode}
            onAspectRatioChange={setAspectRatio}
            onFormatChange={setFormat}
            onPromptChange={setPrompt}
            onRemoveReference={handleRemoveReferenceBbox}
            onSerializedPromptChange={setSerializedPrompt}
            onSizeChange={setSize}
            onSubmit={handleGenerate}
            prompt={prompt}
            referenceAssets={referenceAssets}
            referenceBboxes={referenceBboxes}
            selectedReferenceAssets={selectedReferenceAssets}
            size={size}
            validationMessage={validationMessage}
          />
        </NodeCanvas>
      </CanvasHandlersProvider>

      <LayerDecomposeDialog
        asset={decomposeAsset}
        isSubmitting={layerBusyNodeId !== null}
        onOpenChange={(open) => {
          if (!open) setDecomposeContext(null);
        }}
        onSubmit={handleDecomposeSubmit}
        open={decomposeAsset !== null}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) setRemoveNodeId(null);
        }}
        open={removeNodeId !== null}
      >
        <DialogContent className="max-w-md space-y-4 p-6">
          <DialogHeader>
            <DialogTitle>移除参考图节点</DialogTitle>
            <DialogDescription>
              将从画布与项目参考选择中移除该参考图，后端原始资产文件不会被删除。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setRemoveNodeId(null)}
              type="button"
              variant="ghost"
            >
              取消
            </Button>
            <Button
              onClick={() => void confirmRemoveReference()}
              type="button"
              variant="destructive"
            >
              移除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setIsLibraryOpen(false);
        }}
        open={isLibraryOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>从资产库添加参考图</DialogTitle>
            <DialogDescription>
              选择项目内已上传的图片，加入画布作为参考图节点。
            </DialogDescription>
          </DialogHeader>
          {libraryCandidates.length > 0 ? (
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {libraryCandidates.map((asset) => {
                const url = getSafePreviewUrl(asset);
                const name = assetName(asset, "参考图");
                return (
                  <button
                    aria-label={`添加参考图：${name}`}
                    className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-2 text-left transition hover:border-primary hover:ring-1 hover:ring-primary/20"
                    key={asset.id}
                    onClick={() => void handleAddFromLibrary(asset)}
                    type="button"
                  >
                    <div className="grid aspect-square w-full place-items-center overflow-hidden rounded bg-slate-950">
                      {url ? (
                        /* Signed asset URLs must be passed through without image optimization. */
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          alt={name}
                          className="h-full w-full object-contain"
                          draggable={false}
                          src={url}
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-slate-300" />
                      )}
                    </div>
                    <span className="truncate text-xs font-medium text-foreground">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
              资产库暂无可添加的图片。可先本地上传参考图。
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setPreviewAsset(null);
        }}
        open={previewAsset !== null}
      >
        <DialogContent className="grid h-[92dvh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-slate-700 bg-slate-950 p-0 text-white sm:rounded-xl">
          <DialogHeader className="border-b border-white/10 px-5 py-4 pr-14">
            <DialogTitle>查看原图</DialogTitle>
            <DialogDescription className="text-slate-300">
              {previewName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid h-full min-h-0 w-full place-items-center overflow-hidden p-4">
            {previewUrl ? (
              /* Signed asset URLs must be passed through without image optimization. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                alt={`${previewName} 原图预览`}
                className="block h-auto max-h-[calc(92dvh-7rem)] w-auto max-w-[calc(96vw-2rem)] object-contain"
                draggable={false}
                src={previewUrl}
              />
            ) : (
              <p className="grid h-full place-items-center text-sm text-slate-300">
                图片暂不可预览
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function buildInitialNodes(
  layout: CanvasLayout,
  project: Project
): CanvasFlowNode[] {
  const assetsById = new Map(project.assets.map((asset) => [asset.id, asset]));
  return layout.nodes.flatMap((node) => {
    if (node.kind === "reference") {
      const asset = node.asset_id ? assetsById.get(node.asset_id) : undefined;
      if (!asset) return [];
      const data: ReferenceNodeData = {
        assetId: asset.id,
        bbox: node.bbox ?? null,
        disabled: false,
        imageAspectRatio: null,
        label: `图${node.order_index ?? 1}`,
        name: assetName(asset, "参考图"),
        orderIndex: node.order_index ?? 1,
        url: getSafePreviewUrl(asset)
      };
      return [toFlowNode(node, data)];
    }
    const asset = node.asset_id ? assetsById.get(node.asset_id) : undefined;
    const data: OutputNodeData = {
      assetId: asset?.id ?? null,
      disabled: false,
      errorMessage: null,
      layerBusy: false,
      name: asset ? assetName(asset, "生成结果") : "生成结果",
      source: node.source ?? "text_to_image",
      status: asset ? "succeeded" : "pending",
      taskId: node.task_id ?? null,
      url: asset ? getSafePreviewUrl(asset) : null
    };
    return [toFlowNode(node, data)];
  });
}

function toFlowNode(
  node: CanvasNode,
  data: ReferenceNodeData | OutputNodeData
): CanvasFlowNode {
  return {
    data,
    height: node.height,
    id: node.id,
    position: { x: node.x, y: node.y },
    type: node.kind,
    width: node.width,
    zIndex: node.z
  };
}

function serializeNodes(nodes: CanvasFlowNode[]): CanvasNode[] {
  return nodes.map((node, index) => {
    const width = readDimension(node, "width");
    const height = readDimension(node, "height");
    if (node.type === "reference") {
      const data = node.data as ReferenceNodeData;
      return {
        asset_id: data.assetId,
        bbox: data.bbox,
        height,
        id: node.id,
        kind: "reference",
        order_index: data.orderIndex,
        width,
        x: node.position.x,
        y: node.position.y,
        z: node.zIndex ?? index
      };
    }
    const data = node.data as OutputNodeData;
    return {
      asset_id: data.assetId,
      height,
      id: node.id,
      kind: "output",
      source: data.source,
      task_id: data.taskId,
      width,
      x: node.position.x,
      y: node.position.y,
      z: node.zIndex ?? index
    };
  });
}

function readDimension(node: CanvasFlowNode, key: "width" | "height"): number {
  const explicit = node[key];
  if (typeof explicit === "number" && explicit > 0) return explicit;
  const styled = node.style?.[key];
  if (typeof styled === "number" && styled > 0) return styled;
  const measured = node.measured?.[key];
  if (typeof measured === "number" && measured > 0) return measured;
  return DEFAULT_NODE_SIZE;
}

function applyNodeDimensions(
  node: CanvasFlowNode,
  dimensions: { height: number; width: number }
): CanvasFlowNode {
  const { height, width } = dimensions;
  return {
    ...node,
    height,
    width
  };
}

function updateNodeData<TData extends Record<string, unknown>>(
  setNodes: ReturnType<typeof useNodesState<CanvasFlowNode>>[1],
  nodeId: string,
  patch: Partial<TData>
) {
  setNodes((current) =>
    current.map((node) =>
      node.id === nodeId
        ? ({ ...node, data: { ...node.data, ...patch } } as CanvasFlowNode)
        : node
    )
  );
}

function spawnPosition(count: number) {
  const column = count % 3;
  const row = Math.floor(count / 3);
  return { x: 80 + column * 300, y: 80 + row * 300 };
}

function pickOutputAsset(task: GenerationTask, project: Project): Asset | null {
  const outputId = task.output_asset_ids.at(-1);
  if (outputId) {
    const asset = project.assets.find((item) => item.id === outputId);
    if (asset) return asset;
  }
  return (
    project.assets
      .filter((asset) => asset.source_task_id === task.id)
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
  );
}

function getErrorStatus(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return null;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function assetName(asset: Asset, fallback: string) {
  return typeof asset.metadata.name === "string" ? asset.metadata.name : fallback;
}
