"use client";

import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clapperboard,
  Combine,
  ImagePlus,
  LoaderCircle,
  Maximize2,
  PencilLine,
  PlayCircle,
  RefreshCw,
  Split,
  Trash2,
  WandSparkles
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent
} from "react";
import {
  StoryboardShotEditorDialog,
  type PreviousShotLastFrameOption,
  type StoryboardEditorFeedback
} from "@/components/workspace/storyboard-shot-editor-dialog";
import {
  StoryboardVideoComparisonDialog,
  StoryboardVideoEditDialog,
  type VideoEditFeedback
} from "@/components/workspace/storyboard-video-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  getSafeLastFrameUrl,
  getSafePreviewUrl,
  getStatusLabel,
  getWorkspaceAssetDescription
} from "@/lib/asset-display";
import {
  apiClient,
  getSafeProviderErrorSummary,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type {
  Asset,
  Brief,
  GenerationTask,
  Project,
  ReferenceAssetKind,
  Status,
  StoryboardShot,
  StoryboardShotVideoConfig
} from "@/lib/api-types";
import { formatDate, statusVariant } from "@/lib/project-display";
import { reindexReferencesAfterRemoval } from "@/lib/storyboard-reference";
import {
  canMergeShots,
  getMergeBlockedReason,
  getMergeDurationTotal,
  getSelectedShotsInOrder,
  MAX_MERGE_DURATION_SECONDS
} from "@/lib/storyboard-merge";
import {
  FIRST_FRAME_BLOCKS_REFERENCES_MESSAGE,
  getStoryboardVideoInputConflict,
  hasStoryboardFirstFrame,
  hasStoryboardReferenceMedia,
  REFERENCES_BLOCK_FIRST_FRAME_MESSAGE
} from "@/lib/storyboard-video-validation";
import {
  collectShotVideoVersions,
  type ComparisonVersion
} from "@/lib/storyboard-video-versions";
import { cn } from "@/lib/utils";

const REFERENCE_KINDS: Array<{
  accept: string;
  label: string;
  kind: ReferenceAssetKind;
  maxBytes: number;
}> = [
  {
    accept: "image/*",
    kind: "image",
    label: "参考图",
    maxBytes: 15 * 1024 * 1024
  },
  {
    accept: "video/*",
    kind: "video",
    label: "参考视频",
    maxBytes: 500 * 1024 * 1024
  },
  {
    accept: "audio/*",
    kind: "audio",
    label: "参考音频",
    maxBytes: 100 * 1024 * 1024
  }
];

const POLLING_STATUSES = new Set<Status>(["queued", "running"]);
const TERMINAL_STATUSES = new Set<Status>([
  "succeeded",
  "skipped",
  "failed",
  "cancelled",
  "expired",
  "stale"
]);

interface VideoComparisonContext {
  shotId: string;
  // 高亮/滚动定位到的最新候选（编辑刚生成时），无则为 null
  highlightAssetId: string | null;
}

interface StoryboardVideoWorkspaceProps {
  onProjectUpdated: (project: Project) => void;
  project: Project;
}

export function StoryboardVideoWorkspace({
  onProjectUpdated,
  project
}: StoryboardVideoWorkspaceProps) {
  const [shots, setShots] = useState(() => sortShots(project.storyboard));
  const [assets, setAssets] = useState(project.assets);
  const [selectedShotId, setSelectedShotId] = useState(
    () => sortShots(project.storyboard)[0]?.id ?? null
  );
  const [configs, setConfigs] = useState(() => configsFromShots(project.storyboard));
  const [draftPrompt, setDraftPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [configLoadError, setConfigLoadError] = useState<string | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [editorFeedback, setEditorFeedback] =
    useState<StoryboardEditorFeedback | null>(null);
  const [workspaceFeedback, setWorkspaceFeedback] = useState<{
    message: string;
    tone: "error" | "info" | "success";
  } | null>(null);
  const [shotTasks, setShotTasks] = useState<Record<string, GenerationTask>>(() =>
    syncStoryboardVideoTasks({}, project, sortShots(project.storyboard))
  );
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(
    () => new Set()
  );
  const [isMergeConfirmOpen, setIsMergeConfirmOpen] = useState(false);
  const [splitTargetShotId, setSplitTargetShotId] = useState<string | null>(
    null
  );
  const [isVideoEditOpen, setIsVideoEditOpen] = useState(false);
  const [videoEditPrompt, setVideoEditPrompt] = useState("");
  const [videoEditFeedback, setVideoEditFeedback] =
    useState<VideoEditFeedback | null>(null);
  const [videoComparison, setVideoComparison] =
    useState<VideoComparisonContext | null>(null);
  const editorSessionSequence = useRef(0);
  const isEditorOpenRef = useRef(isEditorOpen);
  const requestSequence = useRef(0);
  const promptOptimizationAbortRef = useRef<AbortController | null>(null);
  const selectedShotIdRef = useRef(selectedShotId);
  const shotsRef = useRef(shots);

  isEditorOpenRef.current = isEditorOpen;
  selectedShotIdRef.current = selectedShotId;

  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  useEffect(
    () => () => promptOptimizationAbortRef.current?.abort(),
    []
  );

  const selectedShot = useMemo(
    () => shots.find((shot) => shot.id === selectedShotId) ?? null,
    [selectedShotId, shots]
  );
  const selectedConfig = selectedShot ? configs[selectedShot.id] : undefined;
  const selectedVideoAsset = selectedConfig?.video_asset_id
    ? assets.find((asset) => asset.id === selectedConfig.video_asset_id) ?? null
    : null;
  const comparisonShot = videoComparison
    ? shots.find((shot) => shot.id === videoComparison.shotId) ?? null
    : null;
  const comparisonCurrentAssetId = videoComparison
    ? configs[videoComparison.shotId]?.video_asset_id ?? null
    : null;
  const comparisonVersions = useMemo<ComparisonVersion[]>(() => {
    if (!videoComparison) {
      return [];
    }
    return collectShotVideoVersions(
      assets,
      videoComparison.shotId,
      comparisonCurrentAssetId
    );
  }, [assets, comparisonCurrentAssetId, videoComparison]);
  const selectedInputConflict = selectedConfig
    ? getStoryboardVideoInputConflict(selectedConfig)
    : null;
  const previousShotLastFrame = useMemo<PreviousShotLastFrameOption>(() => {
    const selectedPosition = shots.findIndex(
      (shot) => shot.id === selectedShotId
    );
    const previousShot =
      selectedPosition > 0 ? shots[selectedPosition - 1] : undefined;
    if (!previousShot) {
      return {
        previewUrl: null,
        previousShotIndex: null,
        sourceVideoAssetId: null
      };
    }

    const videoAsset = previousShot.video_asset_id
      ? assets.find((asset) => asset.id === previousShot.video_asset_id)
      : undefined;
    const previewUrl = videoAsset ? getSafeLastFrameUrl(videoAsset) : null;
    return {
      previewUrl,
      previousShotIndex: previousShot.index,
      sourceVideoAssetId: previewUrl ? videoAsset?.id ?? null : null
    };
  }, [assets, selectedShotId, shots]);

  const mergeSelectionCount = mergeSelection.size;
  const canMerge = useMemo(
    () => canMergeShots(shots, mergeSelection),
    [shots, mergeSelection]
  );
  const mergeBlockedReason = useMemo(
    () => getMergeBlockedReason(shots, mergeSelection),
    [shots, mergeSelection]
  );
  const mergeDurationTotal = useMemo(
    () => getMergeDurationTotal(shots, mergeSelection),
    [shots, mergeSelection]
  );
  const orderedMergeShots = useMemo(
    () => getSelectedShotsInOrder(shots, mergeSelection),
    [shots, mergeSelection]
  );
  const mergeAtomicCount = useMemo(
    () =>
      orderedMergeShots.reduce(
        (total, shot) =>
          total + (shot.is_merged ? shot.merge_source_count : 1),
        0
      ),
    [orderedMergeShots]
  );
  const splitTargetShot = useMemo(
    () => shots.find((shot) => shot.id === splitTargetShotId) ?? null,
    [shots, splitTargetShotId]
  );
  const hasSubsequentShots = selectedShot
    ? shots.some((shot) => shot.index > selectedShot.index)
    : false;
  const isMerging = pendingAction === "merge";
  const isSplitting = splitTargetShot
    ? pendingAction === `split:${splitTargetShot.id}`
    : false;

  const toggleMergeMode = useCallback(() => {
    setIsMergeMode((current) => {
      const next = !current;
      if (!next) {
        setMergeSelection(new Set());
      }
      return next;
    });
    setWorkspaceFeedback(null);
  }, []);

  const toggleMergeSelection = useCallback((shotId: string) => {
    setMergeSelection((current) => {
      const next = new Set(current);
      if (next.has(shotId)) {
        next.delete(shotId);
      } else {
        next.add(shotId);
      }
      return next;
    });
  }, []);

  const applyProjectSnapshot = useCallback((freshProject: Project) => {
    const nextShots = sortShots(freshProject.storyboard);
    setShots(nextShots);
    setAssets(freshProject.assets);
    setConfigs(configsFromShots(nextShots));
    setShotTasks((current) =>
      syncStoryboardVideoTasks(current, freshProject, nextShots)
    );
  }, []);


  const loadSelectedConfig = useCallback(() => {
    const shot = shotsRef.current.find((item) => item.id === selectedShotId);

    if (!shot || !isEditorOpen) {
      return;
    }

    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setIsConfigLoading(true);
    setConfigLoadError(null);
    setEditorFeedback(null);

    apiClient
      .getStoryboardShotVideoConfig(project.id, shot.id, {
        cache: "no-store"
      })
      .then((config) => {
        if (requestSequence.current !== requestId) {
          return;
        }

        setConfigs((current) => ({ ...current, [shot.id]: config }));
        const prompt = config.effective_video_prompt;
        setDraftPrompt(prompt);
        setSavedPrompt(prompt);
        setIsConfigLoading(false);
      })
      .catch((error) => {
        if (requestSequence.current === requestId) {
          setConfigLoadError(getUserFacingErrorMessage(error));
          setIsConfigLoading(false);
        }
      });
  }, [isEditorOpen, project.id, selectedShotId]);

  useEffect(() => {
    loadSelectedConfig();
  }, [loadSelectedConfig]);

  const activeTaskIds = useMemo(
    () =>
      Object.values(shotTasks)
        .filter((task) => POLLING_STATUSES.has(task.status))
        .map((task) => task.id)
        .sort()
        .join("|"),
    [shotTasks]
  );

  const refreshProject = useCallback(async () => {
    const freshProject = await apiClient.getProject(project.id, {
      cache: "no-store"
    });
    applyProjectSnapshot(freshProject);
    onProjectUpdated(freshProject);
    return freshProject;
  }, [applyProjectSnapshot, onProjectUpdated, project.id]);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .getProject(project.id, { cache: "no-store" })
      .then((freshProject) => {
        if (cancelled) {
          return;
        }
        setShotTasks((current) =>
          syncStoryboardVideoTasks(current, freshProject, shotsRef.current)
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setWorkspaceFeedback({
            message: getUserFacingErrorMessage(error),
            tone: "error"
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    if (!activeTaskIds) {
      return;
    }

    let cancelled = false;

    async function pollTasks() {
      try {
        const updates = (
          await Promise.all(
          activeTaskIds.split("|").map((taskId) => apiClient.getTask(taskId))
          )
        ).filter((task): task is GenerationTask => Boolean(task));

        if (cancelled) {
          return;
        }

        setShotTasks((current) => mergeShotTasks(current, updates));

        if (updates.some((task) => TERMINAL_STATUSES.has(task.status))) {
          await refreshProject();
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceFeedback({
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

  function commitLocal(nextShots: StoryboardShot[], nextAssets = assets) {
    setShots(sortShots(nextShots));
    setAssets(nextAssets);
    onProjectUpdated({
      ...project,
      assets: nextAssets,
      storyboard: sortShots(nextShots),
      updated_at: new Date().toISOString()
    });
  }

  async function handleSavePrompt() {
    if (!selectedShot || pendingAction) {
      return;
    }

    setPendingAction(`save:${selectedShot.id}`);
    setEditorFeedback(null);

    try {
      const config = await apiClient.updateStoryboardShotVideoConfig(
        project.id,
        selectedShot.id,
        { video_prompt: draftPrompt.trim() || null }
      );
      setConfigs((current) => ({ ...current, [selectedShot.id]: config }));
      const nextShots = shots.map((shot) =>
        shot.id === selectedShot.id
          ? { ...shot, video_prompt: config.video_prompt }
          : shot
      );
      commitLocal(nextShots);
      const saved = config.effective_video_prompt;
      setDraftPrompt(saved);
      setSavedPrompt(saved);
      setEditorFeedback({
        message: "视频生成提示词已保存。",
        tone: "success"
      });
    } catch (error) {
      setEditorFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleOptimizePrompt() {
    if (!selectedShot || pendingAction) {
      return;
    }

    const shotId = selectedShot.id;
    const sessionId = editorSessionSequence.current;
    const action = `optimize:${shotId}`;
    const currentDraft = draftPrompt;
    const controller = new AbortController();
    promptOptimizationAbortRef.current?.abort();
    promptOptimizationAbortRef.current = controller;
    setPendingAction(action);
    setEditorFeedback(null);
    setDraftPrompt("");

    try {
      const response = await apiClient.optimizeStoryboardShotVideoPrompt(
        project.id,
        shotId,
        currentDraft.trim() || null,
        (event) => {
          if (
            event.type !== "delta" ||
            controller.signal.aborted ||
            editorSessionSequence.current !== sessionId ||
            !isEditorOpenRef.current ||
            selectedShotIdRef.current !== shotId
          ) {
            return;
          }
          setDraftPrompt((current) => current + event.text);
        },
        { signal: controller.signal }
      );
      if (
        editorSessionSequence.current !== sessionId ||
        !isEditorOpenRef.current ||
        selectedShotIdRef.current !== shotId
      ) {
        return;
      }

      setDraftPrompt(response.optimized_prompt);
      const isUnchanged =
        response.optimized_prompt.trim() === currentDraft.trim();
      setEditorFeedback({
        message: isUnchanged
          ? "AI 已复核，当前提示词已是优化版本。"
          : "AI 优化完成，请确认后保存。",
        tone: isUnchanged ? "info" : "success"
      });
    } catch (error) {
      if (
        !controller.signal.aborted &&
        editorSessionSequence.current === sessionId &&
        isEditorOpenRef.current &&
        selectedShotIdRef.current === shotId
      ) {
        setDraftPrompt(currentDraft);
        setEditorFeedback({
          message: getUserFacingErrorMessage(error),
          tone: "error"
        });
      }
    } finally {
      if (promptOptimizationAbortRef.current === controller) {
        promptOptimizationAbortRef.current = null;
      }
      setPendingAction((current) => (current === action ? null : current));
    }
  }

  async function handleUploadReference(
    kind: ReferenceAssetKind,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!selectedShot || !file || pendingAction) {
      return;
    }
    if (selectedConfig && hasStoryboardFirstFrame(selectedConfig)) {
      setEditorFeedback({
        message: FIRST_FRAME_BLOCKS_REFERENCES_MESSAGE,
        tone: "error"
      });
      return;
    }

    const validationError = validateReferenceFile(kind, file);
    if (validationError) {
      setEditorFeedback({ message: validationError, tone: "error" });
      return;
    }

    setPendingAction(`upload:${kind}`);
    setEditorFeedback(null);

    try {
      const response = await apiClient.uploadStoryboardShotReference(
        project.id,
        selectedShot.id,
        kind,
        file,
        {
          filename: file.name,
          mimeType: file.type || "application/octet-stream"
        }
      );
      setConfigs((current) => ({
        ...current,
        [selectedShot.id]: response.config
      }));
      const uploadedAsset: Asset = {
        category: "reference",
        created_at: new Date().toISOString(),
        id: response.asset_id,
        metadata: { name: file.name },
        mime_type: file.type || null,
        object_key: null,
        project_id: project.id,
        size_bytes: file.size,
        source_task_id: null,
        stage: "video",
        status: "succeeded",
        type: uploadedAssetType(kind),
        updated_at: new Date().toISOString(),
        url: null
      };
      const nextAssets = upsertAsset(assets, uploadedAsset);
      const nextShots = shots.map((shot) =>
        shot.id === selectedShot.id ? shotFromConfig(shot, response.config) : shot
      );
      commitLocal(nextShots, nextAssets);
      try {
        await refreshProject();
        setEditorFeedback({
          message: `${kindLabel(kind)}已添加到当前分镜。`,
          tone: "success"
        });
      } catch {
        setEditorFeedback({
          message: `${kindLabel(kind)}已添加，缩略图暂不可用。`,
          tone: "info"
        });
      }
    } catch (error) {
      setEditorFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAttachReference(kind: ReferenceAssetKind, assetId: string) {
    if (!selectedShot || pendingAction) {
      return;
    }
    if (selectedConfig && hasStoryboardFirstFrame(selectedConfig)) {
      setEditorFeedback({
        message: FIRST_FRAME_BLOCKS_REFERENCES_MESSAGE,
        tone: "error"
      });
      return;
    }

    setPendingAction(`attach:${kind}:${assetId}`);
    setEditorFeedback(null);

    try {
      const config = await apiClient.attachStoryboardShotReference(
        project.id,
        selectedShot.id,
        { asset_id: assetId, kind }
      );
      setConfigs((current) => ({ ...current, [selectedShot.id]: config }));
      const nextShots = shots.map((shot) =>
        shot.id === selectedShot.id ? shotFromConfig(shot, config) : shot
      );
      commitLocal(nextShots);
      setEditorFeedback({
        message: `已关联资产库${kindLabel(kind)}。`,
        tone: "success"
      });
    } catch (error) {
      setEditorFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSetFirstFrame(assetId: string) {
    if (!selectedShot || pendingAction) return;
    if (selectedConfig && hasStoryboardReferenceMedia(selectedConfig)) {
      setEditorFeedback({
        message: REFERENCES_BLOCK_FIRST_FRAME_MESSAGE,
        tone: "error"
      });
      return;
    }
    setPendingAction(`first-frame:set:${assetId}`);
    try {
      const config = await apiClient.setStoryboardShotFirstFrame(
        project.id, selectedShot.id, { asset_id: assetId }
      );
      setConfigs((current) => ({ ...current, [selectedShot.id]: config }));
      commitLocal(shots.map((shot) =>
        shot.id === selectedShot.id ? shotFromConfig(shot, config) : shot
      ));
    } catch (error) {
      setEditorFeedback({ message: getUserFacingErrorMessage(error), tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSetPreviousShotLastFrame(sourceVideoAssetId: string) {
    if (!selectedShot || pendingAction) return;
    if (selectedConfig && hasStoryboardReferenceMedia(selectedConfig)) {
      setEditorFeedback({
        message: REFERENCES_BLOCK_FIRST_FRAME_MESSAGE,
        tone: "error"
      });
      return;
    }
    setPendingAction(`first-frame:set-previous:${sourceVideoAssetId}`);
    try {
      const config = await apiClient.setStoryboardShotFirstFrame(
        project.id,
        selectedShot.id,
        { source_video_asset_id: sourceVideoAssetId }
      );
      setConfigs((current) => ({ ...current, [selectedShot.id]: config }));
      commitLocal(shots.map((shot) =>
        shot.id === selectedShot.id ? shotFromConfig(shot, config) : shot
      ));
      setEditorFeedback({
        message: "已将上一分镜尾帧设为当前首帧。",
        tone: "success"
      });
    } catch (error) {
      setEditorFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleClearFirstFrame() {
    if (!selectedShot || pendingAction) return;
    setPendingAction("first-frame:clear");
    try {
      const config = await apiClient.clearStoryboardShotFirstFrame(
        project.id, selectedShot.id
      );
      setConfigs((current) => ({ ...current, [selectedShot.id]: config }));
      commitLocal(shots.map((shot) =>
        shot.id === selectedShot.id ? shotFromConfig(shot, config) : shot
      ));
    } catch (error) {
      setEditorFeedback({ message: getUserFacingErrorMessage(error), tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUploadFirstFrame(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!selectedShot || !file || pendingAction) return;
    if (selectedConfig && hasStoryboardReferenceMedia(selectedConfig)) {
      setEditorFeedback({
        message: REFERENCES_BLOCK_FIRST_FRAME_MESSAGE,
        tone: "error"
      });
      return;
    }
    const validationError = validateReferenceFile("image", file);
    if (validationError) {
      setEditorFeedback({ message: validationError, tone: "error" });
      return;
    }
    setPendingAction("first-frame:upload");
    try {
      const response = await apiClient.uploadStoryboardShotFirstFrame(
        project.id, selectedShot.id, file,
        { filename: file.name, mimeType: file.type || "application/octet-stream" }
      );
      setConfigs((current) => ({ ...current, [selectedShot.id]: response.config }));
      commitLocal(shots.map((shot) =>
        shot.id === selectedShot.id ? shotFromConfig(shot, response.config) : shot
      ));
      await refreshProject();
    } catch (error) {
      setEditorFeedback({ message: getUserFacingErrorMessage(error), tone: "error" });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRemoveReference(kind: ReferenceAssetKind, assetId: string) {
    if (!selectedShot || pendingAction) {
      return;
    }

    const previousIds = getReferenceIds(
      configs[selectedShot.id] ?? configFromShot(selectedShot),
      kind
    );
    const removedIndex = previousIds.indexOf(assetId);
    setPendingAction(`remove:${kind}:${assetId}`);
    setEditorFeedback(null);

    try {
      const config = await apiClient.removeStoryboardShotReference(
        project.id,
        selectedShot.id,
        { asset_id: assetId, kind }
      );
      setConfigs((current) => ({ ...current, [selectedShot.id]: config }));
      const nextShots = shots.map((shot) =>
        shot.id === selectedShot.id ? shotFromConfig(shot, config) : shot
      );
      commitLocal(nextShots);
      const reindexedPrompt = reindexReferencesAfterRemoval(
        draftPrompt,
        kind,
        removedIndex,
        previousIds.length
      );
      setDraftPrompt(reindexedPrompt);
      setEditorFeedback({
        message:
          reindexedPrompt === draftPrompt
            ? "已移除当前分镜的素材关联，资产库文件保留。"
            : "素材已移除，引用编号已同步，请检查并保存提示词。",
        tone: reindexedPrompt === draftPrompt ? "success" : "info"
      });
    } catch (error) {
      setEditorFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerateVideo() {
    if (!selectedShot || pendingAction) {
      return;
    }
    if (selectedInputConflict) {
      setWorkspaceFeedback({
        message: selectedInputConflict,
        tone: "error"
      });
      return;
    }

    setPendingAction(`generate:${selectedShot.id}`);
    setWorkspaceFeedback(null);

    try {
      const task = await apiClient.generateStoryboardShotVideo(
        project.id,
        selectedShot.id
      );
      setShotTasks((current) => ({ ...current, [selectedShot.id]: task }));
      setWorkspaceFeedback({
        message:
          task.status === "failed"
            ? getSafeProviderErrorSummary(task.error?.detail) ??
              "当前分镜视频生成失败，请调整配置后重试。"
            : "单分镜视频任务已提交，状态会自动更新。",
        tone: task.status === "failed" ? "error" : "info"
      });

      if (TERMINAL_STATUSES.has(task.status)) {
        await refreshProject().catch(() => undefined);
      }
    } catch (error) {
      setWorkspaceFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  function openVideoEdit() {
    if (!selectedShot || !selectedVideoAsset || pendingAction) {
      return;
    }
    const versions = collectShotVideoVersions(
      assets,
      selectedShot.id,
      selectedConfig?.video_asset_id ?? null
    );
    const hasEditHistory = versions.some((version) => version.kind === "edit");
    if (hasEditHistory) {
      setVideoComparison({ shotId: selectedShot.id, highlightAssetId: null });
      return;
    }
    setVideoEditPrompt("");
    setVideoEditFeedback(null);
    setIsVideoEditOpen(true);
  }

  async function handleSubmitVideoEdit() {
    if (
      !selectedShot ||
      !selectedVideoAsset ||
      !videoEditPrompt.trim() ||
      pendingAction
    ) {
      return;
    }

    const shotId = selectedShot.id;
    const prompt = videoEditPrompt.trim();
    setPendingAction(`edit-video:${shotId}`);
    setVideoEditFeedback({
      message: "正在生成独立编辑候选，当前版本不会被覆盖。",
      tone: "info"
    });

    try {
      const task = await apiClient.editStoryboardShotVideo(project.id, shotId, {
        prompt
      });
      if (task.status === "failed") {
        throw new Error(
          getSafeProviderErrorSummary(task.error?.detail) ??
            "视频编辑失败，请调整指令后重试。"
        );
      }
      if (task.output_asset_ids.length !== 1) {
        throw new Error("视频编辑任务未返回唯一候选。");
      }

      const freshProject = await refreshProject();
      const candidateAssetId = task.output_asset_ids[0];
      const candidate = freshProject.assets.find(
        (asset) => asset.id === candidateAssetId
      );
      if (!candidate) {
        throw new Error("编辑候选暂不可预览，请刷新项目后重试。");
      }

      setVideoComparison({ shotId, highlightAssetId: candidateAssetId });
      setIsVideoEditOpen(false);
      setVideoEditFeedback(null);
    } catch (error) {
      setVideoEditFeedback({
        message:
          error instanceof Error && error.message.startsWith("视频")
            ? error.message
            : getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  function handleContinueEditing() {
    if (!videoComparison || pendingAction) {
      return;
    }
    setVideoEditPrompt("");
    setVideoEditFeedback(null);
    setIsVideoEditOpen(true);
  }

  async function handleKeepEditedVideo(assetId: string) {
    if (!videoComparison || pendingAction) {
      return;
    }

    const targetVersion = comparisonVersions.find(
      (version) => version.assetId === assetId
    );
    setPendingAction(`select-video:${videoComparison.shotId}`);
    try {
      await apiClient.selectStoryboardShotVideo(
        project.id,
        videoComparison.shotId,
        { asset_id: assetId }
      );
      await refreshProject();
      setVideoComparison(null);
      setWorkspaceFeedback({
        message:
          targetVersion?.kind === "original"
            ? "已回退为原视频，其余版本仍保存在资产库。"
            : "已将该编辑版设为当前分镜视频，其余版本仍保存在资产库。",
        tone: "success"
      });
    } catch (error) {
      setWorkspaceFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteCurrentVideo(assetId: string) {
    if (!selectedShot || pendingAction) {
      return;
    }

    setPendingAction(`delete-video:${selectedShot.id}`);
    setWorkspaceFeedback(null);

    try {
      const updatedProject = await apiClient.deleteAsset(project.id, assetId);
      const nextShots = sortShots(updatedProject.storyboard);
      setAssets(updatedProject.assets);
      setConfigs(configsFromShots(nextShots));
      commitLocal(nextShots);
      onProjectUpdated(updatedProject);
      setWorkspaceFeedback({
        message: "当前分镜视频已删除。",
        tone: "success"
      });
    } catch (error) {
      setWorkspaceFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleApplyLastFrameToSubsequentReferences() {
    if (!selectedShot || pendingAction) {
      return;
    }

    setPendingAction(`last-frame-reference:${selectedShot.id}`);
    setWorkspaceFeedback(null);

    try {
      const response = await apiClient.applyStoryboardShotLastFrameReference(
        project.id,
        selectedShot.id
      );
      await refreshProject();
      const appliedCount = response.applied_shot_ids.length;
      const skippedCount = response.skipped.length;
      const message =
        appliedCount > 0
          ? `已将当前尾帧加入 ${appliedCount} 个后续镜头参考图。`
          : "没有可更新的后续镜头，已跳过已有首帧或已关联的镜头。";
      setWorkspaceFeedback({
        message:
          skippedCount > 0
            ? `${message}已跳过 ${skippedCount} 个已有首帧或已关联的镜头。`
            : message,
        tone: appliedCount > 0 ? "success" : "info"
      });
    } catch (error) {
      setWorkspaceFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleEnsureLastFrameReferenceAsset() {
    if (!selectedShot || pendingAction) {
      return;
    }

    setPendingAction(`last-frame-reference-asset:${selectedShot.id}`);
    setWorkspaceFeedback(null);

    try {
      const asset = await apiClient.ensureStoryboardShotLastFrameReferenceAsset(
        project.id,
        selectedShot.id
      );
      const nextAssets = upsertAsset(assets, asset);
      setAssets(nextAssets);
      commitLocal(shots, nextAssets);
      setWorkspaceFeedback({
        message: "当前尾帧已存入参考图资产库，可在后续镜头中选择。",
        tone: "success"
      });
    } catch (error) {
      setWorkspaceFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMergeShots() {
    if (pendingAction || !canMerge) {
      return;
    }

    const orderedIds = orderedMergeShots.map((shot) => shot.id);
    setPendingAction("merge");
    setIsMergeConfirmOpen(false);
    setWorkspaceFeedback(null);

    try {
      const updatedProject = await apiClient.mergeStoryboardShots(
        project.id,
        orderedIds
      );
      const nextShots = sortShots(updatedProject.storyboard);
      setAssets(updatedProject.assets);
      setConfigs(configsFromShots(nextShots));
      setShots(nextShots);
      onProjectUpdated(updatedProject);
      setShotTasks({});
      setMergeSelection(new Set());
      setIsMergeMode(false);
      setSelectedShotId(
        nextShots.find((shot) => shot.id === orderedIds[0])?.id ??
          nextShots[0]?.id ??
          null
      );
      setWorkspaceFeedback({
        message:
          "分镜已合并，参考素材与视频已清空，请重新选择素材并生成视频。",
        tone: "success"
      });
    } catch (error) {
      setWorkspaceFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSplitShot() {
    if (!splitTargetShot || pendingAction) {
      return;
    }

    const restoredCount = splitTargetShot.merge_source_count;
    setPendingAction(`split:${splitTargetShot.id}`);
    setWorkspaceFeedback(null);

    try {
      const updatedProject = await apiClient.splitStoryboardShot(
        project.id,
        splitTargetShot.id
      );
      const nextShots = sortShots(updatedProject.storyboard);
      setAssets(updatedProject.assets);
      setConfigs(configsFromShots(nextShots));
      setShots(nextShots);
      onProjectUpdated(updatedProject);
      setShotTasks({});
      setSplitTargetShotId(null);
      setSelectedShotId(
        nextShots.find((shot) => shot.id === splitTargetShot.id)?.id ??
          nextShots[0]?.id ??
          null
      );
      setWorkspaceFeedback({
        message: `已恢复 ${restoredCount} 个原子分镜，参考素材与视频需重新选择并生成。`,
        tone: "success"
      });
    } catch (error) {
      setWorkspaceFeedback({
        message: getUserFacingErrorMessage(error),
        tone: "error"
      });
    } finally {
      setPendingAction(null);
    }
  }

  function openEditor(shotId: string) {
    promptOptimizationAbortRef.current?.abort();
    promptOptimizationAbortRef.current = null;
    editorSessionSequence.current += 1;
    setSelectedShotId(shotId);
    setEditorFeedback(null);
    setConfigLoadError(null);
    setDraftPrompt("");
    setSavedPrompt("");
    setIsEditorOpen(true);
  }

  function requestCloseEditor() {
    if (pendingAction) {
      return;
    }

    if (draftPrompt !== savedPrompt) {
      setIsDiscardConfirmOpen(true);
      return;
    }

    closeEditor();
  }

  function closeEditor() {
    promptOptimizationAbortRef.current?.abort();
    promptOptimizationAbortRef.current = null;
    editorSessionSequence.current += 1;
    requestSequence.current += 1;
    setIsEditorOpen(false);
    setIsDiscardConfirmOpen(false);
    setIsConfigLoading(false);
    setConfigLoadError(null);
    setEditorFeedback(null);
    setDraftPrompt("");
    setSavedPrompt("");
  }

  if (shots.length === 0) {
    return (
      <section
        aria-labelledby="storyboard-video-workspace-title"
        className="overflow-hidden rounded-3xl border border-dashed border-border bg-card/80 p-8 text-center shadow-glass"
      >
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary">
          <Clapperboard aria-hidden="true" className="h-6 w-6" />
        </div>
        <h2
          className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground"
          id="storyboard-video-workspace-title"
        >
          分镜视频工作台
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          请先完成分镜脚本生成，系统返回结构化镜头后即可逐镜头配置提示词、参考素材和视频生成。
        </p>
      </section>
    );
  }

  return (
    <>
      <section
        aria-labelledby="storyboard-video-workspace-title"
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-glass"
      >
        <div className="border-b border-border px-6 py-5 sm:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="ad-kicker">Storyboard Video Workspace</p>
              <h2
                className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl"
                id="storyboard-video-workspace-title"
              >
                分镜视频工作台
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                点击左侧镜头打开提示词与参考素材编辑弹窗，右侧查看当前分镜的视频状态、预览和重试入口。
              </p>
            </div>
            <Badge variant="info">{shots.length} 个镜头</Badge>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(18rem,3fr)_minmax(0,7fr)]">
          <div className="border-b border-border p-5 sm:p-7 xl:border-b-0 xl:border-r">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {isMergeMode ? "选择相邻分镜进行合并" : "镜头列表"}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {isMergeMode
                    ? `已选 ${mergeSelectionCount} 个 · 合计 ${formatDurationLabel(mergeDurationTotal)} 秒（上限 ${MAX_MERGE_DURATION_SECONDS} 秒）`
                    : "支持将相邻的短镜头合并为一个更长的镜头。"}
                </p>
              </div>
              <Button
                aria-pressed={isMergeMode}
                disabled={isMerging}
                onClick={toggleMergeMode}
                size="sm"
                type="button"
                variant={isMergeMode ? "secondary" : "outline"}
              >
                <Combine aria-hidden="true" className="h-4 w-4" />
                {isMergeMode ? "退出合并" : "合并分镜"}
              </Button>
            </div>

            {isMergeMode ? (
              <div className="mb-4 space-y-3 rounded-2xl border border-border bg-secondary/25 p-4">
                {mergeBlockedReason ? (
                  <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                    <AlertCircle
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    />
                    <span>{mergeBlockedReason}</span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-xs leading-5 text-success">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    />
                    <span>
                      可合并
                      {orderedMergeShots.length > 0
                        ? ` 镜头 ${orderedMergeShots[0].index}-${orderedMergeShots[orderedMergeShots.length - 1].index}`
                        : ""}
                      ，合并后需重新选择参考素材并生成视频。
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!canMerge || isMerging}
                    onClick={() => setIsMergeConfirmOpen(true)}
                    size="sm"
                    type="button"
                  >
                    {isMerging ? (
                      <LoaderCircle
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin"
                      />
                    ) : (
                      <Combine aria-hidden="true" className="h-4 w-4" />
                    )}
                    合并所选分镜
                  </Button>
                  <Button
                    disabled={isMerging || mergeSelectionCount === 0}
                    onClick={() => setMergeSelection(new Set())}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    清空选择
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid max-h-[38rem] gap-3 overflow-y-auto pr-1">
              {shots.map((shot) => (
                <ShotSelector
                  config={configs[shot.id] ?? configFromShot(shot)}
                  isMergeMode={isMergeMode}
                  isMergeSelected={mergeSelection.has(shot.id)}
                  isSelected={shot.id === selectedShotId}
                  key={shot.id}
                  onEdit={() => openEditor(shot.id)}
                  onSelect={() =>
                    isMergeMode
                      ? toggleMergeSelection(shot.id)
                      : setSelectedShotId(shot.id)
                  }
                  onSplit={() => setSplitTargetShotId(shot.id)}
                  onToggleMerge={() => toggleMergeSelection(shot.id)}
                  shot={shot}
                  task={shotTasks[shot.id]}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0 p-5 sm:p-7">
            {workspaceFeedback ? (
              <StoryboardVideoNotice {...workspaceFeedback} />
            ) : null}
            <VideoPreviewPanel
              aspectRatio={project.brief.aspect_ratio}
              assets={assets}
              config={selectedConfig}
              isDeleting={
                selectedShot
                  ? pendingAction === `delete-video:${selectedShot.id}`
                  : false
              }
              isGenerating={
                selectedShot
                  ? pendingAction === `generate:${selectedShot.id}` ||
                    (shotTasks[selectedShot.id]
                      ? POLLING_STATUSES.has(shotTasks[selectedShot.id].status)
                      : false)
                  : false
              }
              isEditing={
                selectedShot
                  ? pendingAction === `edit-video:${selectedShot.id}`
                  : false
              }
              inputValidationError={selectedInputConflict}
              hasSubsequentShots={hasSubsequentShots}
              isApplyingLastFrameReference={
                selectedShot
                  ? pendingAction === `last-frame-reference:${selectedShot.id}`
                  : false
              }
              isEnsuringLastFrameReferenceAsset={
                selectedShot
                  ? pendingAction ===
                    `last-frame-reference-asset:${selectedShot.id}`
                  : false
              }
              onDeleteVideo={handleDeleteCurrentVideo}
              onEditVideo={openVideoEdit}
              onApplyLastFrameReference={
                handleApplyLastFrameToSubsequentReferences
              }
              onEnsureLastFrameReferenceAsset={
                handleEnsureLastFrameReferenceAsset
              }
              onGenerate={handleGenerateVideo}
              selectedShot={selectedShot}
              task={selectedShot ? shotTasks[selectedShot.id] : undefined}
            />
          </div>
        </div>
      </section>

      <StoryboardShotEditorDialog
        assets={assets}
        config={selectedConfig}
        configLoadError={configLoadError}
        draftPrompt={draftPrompt}
        feedback={editorFeedback}
        isConfigLoading={isConfigLoading}
        isDiscardConfirmOpen={isDiscardConfirmOpen}
        onAttach={handleAttachReference}
        onChangePrompt={setDraftPrompt}
        onConfirmDiscard={() => {
          setDraftPrompt(savedPrompt);
          closeEditor();
        }}
        onContinueEditing={() => setIsDiscardConfirmOpen(false)}
        onClearFirstFrame={handleClearFirstFrame}
        onRemove={handleRemoveReference}
        onRequestClose={requestCloseEditor}
        onRetryConfig={loadSelectedConfig}
        onOptimize={handleOptimizePrompt}
        onSave={handleSavePrompt}
        onSetPreviousShotLastFrame={handleSetPreviousShotLastFrame}
        onSetFirstFrame={handleSetFirstFrame}
        onUpload={handleUploadReference}
        onUploadFirstFrame={handleUploadFirstFrame}
        open={isEditorOpen}
        pendingAction={pendingAction}
        previousShotLastFrame={previousShotLastFrame}
        shot={selectedShot}
      />

      <StoryboardVideoEditDialog
        aspectRatio={project.brief.aspect_ratio}
        asset={selectedVideoAsset}
        feedback={videoEditFeedback}
        isSubmitting={
          selectedShot
            ? pendingAction === `edit-video:${selectedShot.id}`
            : false
        }
        onOpenChange={(open) => {
          setIsVideoEditOpen(open);
          if (!open) setVideoEditFeedback(null);
        }}
        onPromptChange={setVideoEditPrompt}
        onSubmit={handleSubmitVideoEdit}
        open={isVideoEditOpen}
        prompt={videoEditPrompt}
        shot={selectedShot}
      />

      <StoryboardVideoComparisonDialog
        aspectRatio={project.brief.aspect_ratio}
        highlightAssetId={videoComparison?.highlightAssetId ?? null}
        isSelecting={
          videoComparison
            ? pendingAction === `select-video:${videoComparison.shotId}`
            : false
        }
        onClose={() => setVideoComparison(null)}
        onContinueEdit={handleContinueEditing}
        onSelectVersion={handleKeepEditedVideo}
        open={Boolean(videoComparison)}
        shot={comparisonShot}
        versions={comparisonVersions}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isMerging) {
            setIsMergeConfirmOpen(false);
          }
        }}
        open={isMergeConfirmOpen}
      >
        <DialogContent className="max-w-md p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle>确认合并所选分镜？</DialogTitle>
            <DialogDescription>
              {orderedMergeShots.length > 0
                ? `将镜头 ${orderedMergeShots[0].index}-${orderedMergeShots[orderedMergeShots.length - 1].index} 合并为一个镜头（合计 ${formatDurationLabel(mergeDurationTotal)} 秒）。`
                : "将所选分镜合并为一个镜头。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>合并后：</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>分镜脚本将按顺序拼接，其余分镜重新编号。</li>
              <li>
                将保存 {mergeAtomicCount} 个原子分镜，可稍后拆分恢复。
              </li>
              <li>已选参考素材、首帧与已生成视频将被清空，需要重新选择并生成。</li>
              <li>下游成片等产物将被标记为待更新。</li>
            </ul>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={isMerging}
              onClick={() => setIsMergeConfirmOpen(false)}
              type="button"
              variant="ghost"
            >
              取消
            </Button>
            <Button disabled={isMerging} onClick={handleMergeShots} type="button">
              {isMerging ? (
                <>
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  合并中
                </>
              ) : (
                <>
                  <Combine aria-hidden="true" className="h-4 w-4" />
                  确认合并
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isSplitting) {
            setSplitTargetShotId(null);
          }
        }}
        open={Boolean(splitTargetShot)}
      >
        <DialogContent className="max-w-md p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle>确认拆分合并分镜？</DialogTitle>
            <DialogDescription>
              {splitTargetShot
                ? `将当前镜头恢复为 ${splitTargetShot.merge_source_count} 个原子分镜。`
                : "将当前镜头恢复为原子分镜。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>拆分后：</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>恢复合并前的分镜脚本、时长与提示词。</li>
              <li>合并态提示词修改不会分摊回原子分镜。</li>
              <li>参考素材、首帧与已生成视频不会恢复，需要重新选择并生成。</li>
              <li>下游成片等产物将被标记为待更新。</li>
            </ul>
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={isSplitting}
              onClick={() => setSplitTargetShotId(null)}
              type="button"
              variant="ghost"
            >
              取消
            </Button>
            <Button
              disabled={isSplitting}
              onClick={handleSplitShot}
              type="button"
            >
              {isSplitting ? (
                <>
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  拆分中
                </>
              ) : (
                <>
                  <Split aria-hidden="true" className="h-4 w-4" />
                  确认拆分
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShotSelector({
  config,
  isMergeMode,
  isMergeSelected,
  isSelected,
  onEdit,
  onSelect,
  onSplit,
  onToggleMerge,
  shot,
  task
}: {
  config: StoryboardShotVideoConfig;
  isMergeMode: boolean;
  isMergeSelected: boolean;
  isSelected: boolean;
  onEdit: () => void;
  onSelect: () => void;
  onSplit: () => void;
  onToggleMerge: () => void;
  shot: StoryboardShot;
  task?: GenerationTask;
}) {
  const referenceCount =
    config.reference_image_asset_ids.length +
    config.reference_video_asset_ids.length +
    config.reference_audio_asset_ids.length;
  const isTaskActive = task ? POLLING_STATUSES.has(task.status) : false;
  const isTaskFailed = task?.status === "failed";
  const badgeVariant = isTaskActive
    ? "info"
    : isTaskFailed
      ? "destructive"
      : shot.video_asset_id
        ? "success"
        : "secondary";
  const badgeLabel = isTaskActive
    ? "生成中"
    : isTaskFailed
      ? "失败"
      : shot.video_asset_id
        ? "有视频"
        : "待生成";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border transition-all",
        isMergeMode && isMergeSelected
          ? "border-primary/45 bg-primary/[0.1] shadow-[inset_3px_0_0_hsl(var(--primary))]"
          : isSelected && !isMergeMode
            ? "border-primary/35 bg-primary/[0.07] shadow-[inset_3px_0_0_hsl(var(--primary))]"
            : "border-border bg-card hover:border-primary/20 hover:bg-primary/[0.035]"
      )}
    >
      <div className="flex items-start gap-2 p-4 pb-2">
        {isMergeMode ? (
          <button
            aria-label={`${isMergeSelected ? "取消选择" : "选择"}分镜 Shot ${String(shot.index).padStart(2, "0")}`}
            aria-pressed={isMergeSelected}
            className={cn(
              "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isMergeSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-transparent hover:border-primary/40"
            )}
            onClick={onToggleMerge}
            type="button"
          >
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          aria-label={
            isMergeMode
              ? `${isMergeSelected ? "取消选择" : "选择"}分镜 Shot ${String(shot.index).padStart(2, "0")} ${shot.title ?? `镜头 ${shot.index}`}`
              : `预览分镜 Shot ${String(shot.index).padStart(2, "0")} ${shot.title ?? `镜头 ${shot.index}`}，双击编辑`
          }
          aria-pressed={isMergeMode ? isMergeSelected : isSelected}
          className="block min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25"
          onClick={onSelect}
          onDoubleClick={isMergeMode ? undefined : onEdit}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary">
                Shot {String(shot.index).padStart(2, "0")}
              </p>
              <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">
                {shot.title ?? `镜头 ${shot.index}`}
              </h3>
            </div>
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          </div>
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {shot.description}
          </p>
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-2">
        <div className="flex min-w-0 flex-wrap gap-2">
          <Badge variant="secondary">{shot.duration_seconds} 秒</Badge>
          <Badge variant="outline">{referenceCount} 个参考素材</Badge>
        </div>
        {isMergeMode ? null : (
          <div className="flex shrink-0 items-center gap-1">
            {shot.is_merged && shot.merge_source_count > 1 ? (
              <Button
                aria-label={`拆分为 ${shot.merge_source_count} 个原子分镜`}
                className="h-8 w-8 rounded-lg"
                onClick={onSplit}
                size="icon"
                title={`拆分为 ${shot.merge_source_count} 个原子分镜`}
                type="button"
                variant="ghost"
              >
                <Split aria-hidden="true" className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              aria-label={`编辑分镜：${shot.title ?? `镜头 ${shot.index}`}`}
              className="h-8 w-8 rounded-lg"
              onClick={onEdit}
              size="icon"
              title="编辑参考素材和提示词"
              type="button"
              variant="ghost"
            >
              <PencilLine aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function VideoPreviewPanel({
  aspectRatio,
  assets,
  config,
  isDeleting,
  isEditing,
  isGenerating,
  hasSubsequentShots,
  inputValidationError,
  isApplyingLastFrameReference,
  isEnsuringLastFrameReferenceAsset,
  onApplyLastFrameReference,
  onDeleteVideo,
  onEditVideo,
  onEnsureLastFrameReferenceAsset,
  onGenerate,
  selectedShot,
  task
}: {
  aspectRatio: Brief["aspect_ratio"];
  assets: Asset[];
  config?: StoryboardShotVideoConfig;
  isDeleting: boolean;
  isEditing: boolean;
  isGenerating: boolean;
  hasSubsequentShots: boolean;
  inputValidationError: string | null;
  isApplyingLastFrameReference: boolean;
  isEnsuringLastFrameReferenceAsset: boolean;
  onApplyLastFrameReference: () => void;
  onDeleteVideo: (assetId: string) => void;
  onEditVideo: () => void;
  onEnsureLastFrameReferenceAsset: () => void;
  onGenerate: () => void;
  selectedShot: StoryboardShot | null;
  task?: GenerationTask;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const asset = assets.find((item) => item.id === config?.video_asset_id);
  const [mediaSelection, setMediaSelection] = useState<{
    assetId: string | null;
    index: number;
  }>({ assetId: asset?.id ?? null, index: 0 });
  const activeMediaIndex =
    mediaSelection.assetId === (asset?.id ?? null)
      ? mediaSelection.index
      : 0;
  const setActiveMediaIndex = (index: number) => {
    setMediaSelection({ assetId: asset?.id ?? null, index });
  };
  const previewUrl = asset ? getSafePreviewUrl(asset) : null;
  const lastFrameUrl = asset ? getSafeLastFrameUrl(asset) : null;
  const canEnsureLastFrameReferenceAsset = Boolean(asset && lastFrameUrl);
  const canApplyLastFrameReference = Boolean(
    asset && lastFrameUrl && hasSubsequentShots
  );
  const cssAspectRatio = aspectRatio.replace(":", " / ");
  const [aspectWidth, aspectHeight] = aspectRatio.split(":").map(Number);
  const previewMaxWidth = `min(100%, calc(34rem * ${aspectWidth} / ${aspectHeight}), calc(66dvh * ${aspectWidth} / ${aspectHeight}))`;
  const expandedMaxWidth = `min(100%, calc((90dvh - 7rem) * ${aspectWidth} / ${aspectHeight}))`;
  const failed =
    task?.status === "failed" ||
    selectedShot?.status === "failed" ||
    asset?.status === "failed";
  const providerErrorSummary = getSafeProviderErrorSummary(task?.error?.detail);

  if (!selectedShot || !config) {
    return (
      <div className="grid min-h-[32rem] place-items-center rounded-2xl border border-dashed border-border bg-secondary/30 text-center">
        <p className="text-sm text-muted-foreground">请选择一个分镜。</p>
      </div>
    );
  }

  return (
    <article className="mt-5 overflow-hidden rounded-2xl border border-border bg-secondary/25">
      <div className="border-b border-border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary">
              Shot {String(selectedShot.index).padStart(2, "0")} Preview
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-foreground">
              {selectedShot.title ?? `镜头 ${selectedShot.index}`}
            </h3>
          </div>
          <Badge variant={statusVariant(asset?.status ?? selectedShot.status)}>
            {getStatusLabel(asset?.status ?? selectedShot.status)}
          </Badge>
        </div>
      </div>

      <div className="p-5">
        <div className="grid min-h-[24rem] place-items-center overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.16),transparent_62%),hsl(var(--secondary)/0.5)] p-3 sm:min-h-[30rem]">
          <div
            className="relative grid w-full place-items-center overflow-hidden rounded-xl bg-black shadow-lg"
            data-testid="storyboard-video-frame"
            style={{
              aspectRatio: cssAspectRatio,
              maxWidth: previewMaxWidth
            }}
          >
            {previewUrl ? (
              <StoryboardMediaCarousel
                activeIndex={activeMediaIndex}
                lastFrameUrl={lastFrameUrl}
                onActiveIndexChange={setActiveMediaIndex}
                onExpand={() => setIsExpanded(true)}
                videoLabel="当前分镜视频预览"
                videoUrl={previewUrl}
              />
            ) : (
              <div className="max-w-sm px-6 text-center">
                {isGenerating ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="mx-auto h-10 w-10 animate-spin text-primary"
                  />
                ) : (
                  <PlayCircle
                    aria-hidden="true"
                    className="mx-auto h-10 w-10 text-primary"
                  />
                )}
                <h4 className="mt-3 text-base font-semibold text-white">
                  {isGenerating ? "正在生成当前分镜视频" : "尚未生成当前分镜视频"}
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {isGenerating
                    ? "视频生成通常需要几分钟，可切换页面后稍后回来查看进度。"
                    : "保存提示词并添加必要参考素材后，可生成单个分镜视频，不影响其他镜头。"}
                </p>
              </div>
            )}
          </div>
        </div>

        <Dialog onOpenChange={setIsExpanded} open={isExpanded}>
          <DialogContent className="grid h-[90dvh] w-[90vw] max-w-[90vw] grid-rows-[auto_minmax(0,1fr)] bg-slate-950 p-0 text-white">
            <DialogHeader className="border-b border-white/10 px-5 py-4 pr-16">
              <DialogTitle className="text-white">
                {selectedShot.title ?? `镜头 ${selectedShot.index}`}
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                Shot {String(selectedShot.index).padStart(2, "0")} · {aspectRatio}{" "}
                完整视频预览
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-h-0 place-items-center overflow-hidden p-3 sm:p-6">
              {previewUrl ? (
                <div
                  className="grid w-full overflow-hidden rounded-xl bg-black shadow-2xl"
                  style={{
                    aspectRatio: cssAspectRatio,
                    maxWidth: expandedMaxWidth
                  }}
                >
                  <StoryboardMediaCarousel
                    activeIndex={activeMediaIndex}
                    lastFrameUrl={lastFrameUrl}
                    onActiveIndexChange={setActiveMediaIndex}
                    videoLabel="当前分镜视频完整预览"
                    videoUrl={previewUrl}
                  />
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        {failed ? (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.07] px-3 py-2.5 text-sm leading-6 text-destructive"
            role="alert"
          >
            <AlertCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
            <span>
              {providerErrorSummary
                ? `当前分镜视频生成失败。${providerErrorSummary}`
                : "当前分镜视频生成失败，请调整配置后重试。"}
            </span>
          </div>
        ) : null}

        {inputValidationError ? (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-800"
            role="alert"
          >
            <AlertCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
            <span>{inputValidationError}</span>
          </div>
        ) : null}

        <dl className="mt-5 grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm md:grid-cols-2">
          <PreviewMetric label="镜头时长" value={`${selectedShot.duration_seconds} 秒`} />
          <PreviewMetric
            label="更新时间"
            value={
              <time dateTime={asset?.updated_at ?? selectedShot.updated_at}>
                {formatDate(asset?.updated_at ?? selectedShot.updated_at)}
              </time>
            }
          />
          <PreviewMetric
            label="参考素材"
            value={`${config.reference_image_asset_ids.length} 图 / ${config.reference_video_asset_ids.length} 视频 / ${config.reference_audio_asset_ids.length} 音频`}
          />
          <PreviewMetric
            label="视频资产"
            value={asset ? getWorkspaceAssetDescription(asset) : "未生成"}
          />
        </dl>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {asset ? (
            <Button
              className="min-w-36"
              disabled={isEditing || isGenerating}
              onClick={onEditVideo}
              type="button"
              variant="cinematic"
            >
              {isEditing ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles aria-hidden="true" className="h-4 w-4" />
              )}
              {isEditing ? "编辑中" : "编辑视频"}
            </Button>
          ) : null}
          <Button
            className="min-w-36"
            disabled={isEditing || isGenerating || Boolean(inputValidationError)}
            onClick={onGenerate}
            type="button"
          >
            {isGenerating ? (
              <>
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                生成中
              </>
            ) : failed ? (
              <>
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                重试当前分镜
              </>
            ) : asset ? (
              <>
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                重新生成当前分镜
              </>
            ) : (
              <>
                <PlayCircle aria-hidden="true" className="h-4 w-4" />
                生成当前分镜视频
              </>
            )}
          </Button>
          {asset ? (
            <Button
              className="min-w-40"
              disabled={
                isDeleting ||
                isEditing ||
                isGenerating ||
                isEnsuringLastFrameReferenceAsset ||
                !canEnsureLastFrameReferenceAsset
              }
              onClick={onEnsureLastFrameReferenceAsset}
              type="button"
              variant="outline"
            >
              {isEnsuringLastFrameReferenceAsset ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <ImagePlus aria-hidden="true" className="h-4 w-4" />
              )}
              尾帧存入参考图
            </Button>
          ) : null}
          {asset ? (
            <Button
              className="min-w-44"
              disabled={
                isDeleting ||
                isEditing ||
                isGenerating ||
                isApplyingLastFrameReference ||
                !canApplyLastFrameReference
              }
              onClick={onApplyLastFrameReference}
              type="button"
              variant="outline"
            >
              {isApplyingLastFrameReference ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <ImagePlus aria-hidden="true" className="h-4 w-4" />
              )}
              尾帧设为后续参考图
            </Button>
          ) : null}
          {asset ? (
            <Button
              disabled={isDeleting || isEditing || isGenerating}
              onClick={() => onDeleteVideo(asset.id)}
              type="button"
              variant="ghost"
            >
              {isDeleting ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
              ) : (
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              )}
              删除当前分镜视频
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function StoryboardMediaCarousel({
  activeIndex,
  lastFrameUrl,
  onActiveIndexChange,
  onExpand,
  videoLabel,
  videoUrl
}: {
  activeIndex: number;
  lastFrameUrl: string | null;
  onActiveIndexChange: (index: number) => void;
  onExpand?: () => void;
  videoLabel: string;
  videoUrl: string;
}) {
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const hasLastFrame = Boolean(lastFrameUrl);
  const currentIndex = hasLastFrame ? Math.min(activeIndex, 1) : 0;

  function finishDrag(clientX: number, clientY: number) {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || !hasLastFrame) {
      return;
    }
    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }
    onActiveIndexChange(deltaX > 0 ? 1 : 0);
  }

  return (
    <div
      aria-label="分镜视频与尾帧预览"
      className="relative h-full w-full touch-pan-y overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      data-testid="storyboard-media-carousel"
      onKeyDown={(event) => {
        if (!hasLastFrame) {
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onActiveIndexChange(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          onActiveIndexChange(0);
        }
      }}
      onPointerCancel={() => {
        dragStart.current = null;
      }}
      onPointerDown={(event) => {
        dragStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => finishDrag(event.clientX, event.clientY)}
      role="group"
      tabIndex={hasLastFrame ? 0 : -1}
    >
      {currentIndex === 0 ? (
        <video
          aria-label={videoLabel}
          className="h-full w-full object-contain"
          controls
          src={videoUrl}
        >
          当前浏览器不支持视频预览。
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="当前分镜视频尾帧"
          className="h-full w-full select-none object-contain"
          draggable={false}
          src={lastFrameUrl ?? undefined}
        />
      )}

      {onExpand && currentIndex === 0 ? (
        <Button
          aria-label="放大查看当前分镜视频"
          className="absolute right-3 top-3 border-white/25 bg-slate-950/75 text-white shadow-lg backdrop-blur hover:bg-slate-950/90 hover:text-white"
          onClick={onExpand}
          size="sm"
          type="button"
          variant="outline"
        >
          <Maximize2 aria-hidden="true" className="h-4 w-4" />
          放大查看
        </Button>
      ) : null}

      {hasLastFrame ? (
        <>
          <Button
            aria-label="查看视频"
            className="absolute left-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border-white/25 bg-slate-950/70 text-white shadow-lg hover:bg-slate-950/90 hover:text-white disabled:opacity-30"
            disabled={currentIndex === 0}
            onClick={() => onActiveIndexChange(0)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </Button>
          <Button
            aria-label="查看尾帧"
            className="absolute right-3 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border-white/25 bg-slate-950/70 text-white shadow-lg hover:bg-slate-950/90 hover:text-white disabled:opacity-30"
            disabled={currentIndex === 1}
            onClick={() => onActiveIndexChange(1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </Button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/75 px-3 py-1.5 text-[0.68rem] font-semibold text-white shadow-lg backdrop-blur">
            {["视频", "尾帧"].map((label, index) => (
              <button
                aria-label={`切换到${label}`}
                aria-pressed={currentIndex === index}
                className="flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                key={label}
                onClick={() => onActiveIndexChange(index)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    currentIndex === index ? "bg-white" : "bg-white/35"
                  )}
                />
                <span className={currentIndex === index ? "" : "sr-only"}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StoryboardVideoNotice({
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

function PreviewMetric({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatDurationLabel(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(1);
}

function sortShots(shots: StoryboardShot[]): StoryboardShot[] {
  return [...shots].sort((left, right) => {
    if (left.index !== right.index) {
      return left.index - right.index;
    }

    return left.updated_at.localeCompare(right.updated_at);
  });
}

function configsFromShots(
  shots: StoryboardShot[]
): Record<string, StoryboardShotVideoConfig> {
  return Object.fromEntries(shots.map((shot) => [shot.id, configFromShot(shot)]));
}

function configFromShot(shot: StoryboardShot): StoryboardShotVideoConfig {
  return {
    effective_video_prompt:
      shot.video_prompt ??
      [
        shot.description,
        shot.visual_prompt,
        shot.narration ? `旁白：${shot.narration}` : null,
        `镜头时长 ${shot.duration_seconds} 秒`
      ]
        .filter(Boolean)
        .join("\n"),
    first_frame_asset_id: shot.first_frame_asset_id,
    first_frame_source_video_asset_id:
      shot.first_frame_source_video_asset_id,
    reference_audio_asset_ids: shot.reference_audio_asset_ids,
    reference_image_asset_ids: shot.reference_image_asset_ids,
    reference_video_asset_ids: shot.reference_video_asset_ids,
    shot_id: shot.id,
    shot_index: shot.index,
    video_asset_id: shot.video_asset_id,
    video_prompt: shot.video_prompt
  };
}

function shotFromConfig(
  shot: StoryboardShot,
  config: StoryboardShotVideoConfig
): StoryboardShot {
  return {
    ...shot,
    first_frame_asset_id: config.first_frame_asset_id,
    first_frame_source_video_asset_id:
      config.first_frame_source_video_asset_id,
    reference_audio_asset_ids: config.reference_audio_asset_ids,
    reference_image_asset_ids: config.reference_image_asset_ids,
    reference_video_asset_ids: config.reference_video_asset_ids,
    video_asset_id: config.video_asset_id,
    video_prompt: config.video_prompt
  };
}

function getReferenceIds(
  config: StoryboardShotVideoConfig,
  kind: ReferenceAssetKind
): string[] {
  if (kind === "image") {
    return config.reference_image_asset_ids;
  }

  if (kind === "video") {
    return config.reference_video_asset_ids;
  }

  return config.reference_audio_asset_ids;
}

function validateReferenceFile(kind: ReferenceAssetKind, file: File): string | null {
  const definition = REFERENCE_KINDS.find((item) => item.kind === kind);
  const expectedPrefix = `${kind}/`;

  if (!definition) {
    return "不支持的参考素材类型。";
  }

  if (!file.type.startsWith(expectedPrefix)) {
    return `请选择${kindLabel(kind)}文件。`;
  }

  if (file.size > definition.maxBytes) {
    return `${kindLabel(kind)}文件过大，请压缩后重新上传。`;
  }

  return null;
}

function uploadedAssetType(kind: ReferenceAssetKind): Asset["type"] {
  if (kind === "image") {
    return "uploaded_image";
  }

  if (kind === "video") {
    return "uploaded_video";
  }

  return "uploaded_audio";
}

function kindLabel(kind: ReferenceAssetKind): string {
  if (kind === "image") {
    return "参考图";
  }

  if (kind === "video") {
    return "参考视频";
  }

  return "参考音频";
}

function upsertAsset(assets: Asset[], asset: Asset): Asset[] {
  if (assets.some((item) => item.id === asset.id)) {
    return assets.map((item) => (item.id === asset.id ? asset : item));
  }

  return [asset, ...assets];
}

function mergeShotTasks(
  current: Record<string, GenerationTask>,
  updates: GenerationTask[]
): Record<string, GenerationTask> {
  const taskIdToShotId = new Map(
    Object.entries(current).map(([shotId, task]) => [task.id, shotId])
  );
  const next = { ...current };

  for (const task of updates) {
    const shotId = taskIdToShotId.get(task.id);
    if (shotId) {
      next[shotId] = task;
    }
  }

  return next;
}

function syncStoryboardVideoTasks(
  current: Record<string, GenerationTask>,
  project: Project,
  shots: StoryboardShot[]
): Record<string, GenerationTask> {
  const shotIds = new Set(shots.map((shot) => shot.id));
  const next = Object.fromEntries(
    Object.entries(current).filter(([shotId]) => shotIds.has(shotId))
  );

  for (const task of project.tasks) {
    if (task.stage !== "video" || !POLLING_STATUSES.has(task.status)) {
      continue;
    }

    const shotId = getStoryboardVideoTaskShotId(task);
    if (shotId && shotIds.has(shotId)) {
      next[shotId] = task;
    }
  }

  return next;
}

function getStoryboardVideoTaskShotId(task: GenerationTask): string | null {
  const frozenInput = task.frozen_input;
  if (
    frozenInput &&
    typeof frozenInput === "object" &&
    typeof frozenInput.shot_id === "string"
  ) {
    return frozenInput.shot_id;
  }

  return null;
}
