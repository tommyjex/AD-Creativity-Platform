"use client";

import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  FileImage,
  History,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ImageCanvasEditor,
  type CanvasEditInput
} from "@/components/workspace/image-canvas-editor";
import { LayerDecomposeDialog } from "@/components/workspace/layer-decompose-dialog";
import { LayerEditorDialog } from "@/components/workspace/layer-editor-dialog";
import { getSafePreviewUrl } from "@/lib/asset-display";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import type {
  Asset,
  GenerationTask,
  ImageGenerationSize,
  ImageLayerSetDetail,
  ImageOutputFormat,
  ImagePromptVersion,
  Project
} from "@/lib/api-types";
import { validateImagePromptCopy } from "@/lib/image-prompt-copy";
import { formatDate, statusVariant } from "@/lib/project-display";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15";
const ACTIVE_TASK_STATUSES = new Set(["queued", "running"]);
const IMAGE_REFERENCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const MAX_IMAGE_REFERENCE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_REFERENCES = 10;

export function ImageProjectWorkspace({
  onProjectUpdated,
  project
}: {
  onProjectUpdated: (project: Project) => void;
  project: Project;
}) {
  const [workspaceProject, setWorkspaceProject] = useState(project);
  const [versions, setVersions] = useState<ImagePromptVersion[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    project.current_image_prompt_version_id
  );
  const [activeTask, setActiveTask] = useState<GenerationTask | null>(() =>
    latestImageGenerationTask(project.tasks)
  );
  const [layerTask, setLayerTask] = useState<GenerationTask | null>(() =>
    latestLayerTask(project.tasks)
  );
  const [layerSets, setLayerSets] = useState<ImageLayerSetDetail[]>([]);
  const [decomposeAsset, setDecomposeAsset] = useState<Asset | null>(null);
  const [editorSet, setEditorSet] = useState<ImageLayerSetDetail | null>(null);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [loadedVersionsRequestKey, setLoadedVersionsRequestKey] = useState<
    string | null
  >(null);
  const [loadedLayerSetsRequestKey, setLoadedLayerSetsRequestKey] = useState<
    string | null
  >(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [isUpdatingCanvasAspectRatio, setIsUpdatingCanvasAspectRatio] =
    useState(false);
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);
  const [confirmLongPrompt, setConfirmLongPrompt] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [size, setSize] = useState<ImageGenerationSize>("2K");
  const [format, setFormat] = useState<ImageOutputFormat>("png");
  const promptRef = useRef(prompt);
  const savedPromptRef = useRef<string | null>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const loadRequestKey = `${project.id}:${project.current_image_prompt_version_id ?? ""}`;
  const isLoading = loadedVersionsRequestKey !== loadRequestKey;
  const isLayerSetsLoading = loadedLayerSetsRequestKey !== loadRequestKey;

  const promptCount = useMemo(
    () => countPrompt(prompt, workspaceProject.brief.target_language),
    [prompt, workspaceProject.brief.target_language]
  );
  const selectedSavedPrompt = useMemo(
    () =>
      versions.find((version) => version.id === selectedVersionId)?.prompt ?? null,
    [selectedVersionId, versions]
  );
  const promptCopyValidation = useMemo(
    () => validateImagePromptCopy(prompt),
    [prompt]
  );
  const currentPromptCopyValidation = useMemo(() => {
    const currentPrompt =
      versions.find(
        (version) =>
          version.id === workspaceProject.current_image_prompt_version_id
      )?.prompt ?? "";
    return validateImagePromptCopy(currentPrompt);
  }, [versions, workspaceProject.current_image_prompt_version_id]);
  const recommendedLimit =
    workspaceProject.brief.target_language === "zh" ? 300 : 600;
  const isOverRecommendation = promptCount > recommendedLimit;
  const isPromptDirty = hasUnsavedPromptChanges(prompt, selectedSavedPrompt);
  const isTaskRunning = activeTask
    ? ACTIVE_TASK_STATUSES.has(activeTask.status)
    : false;
  const isGenerationBusy =
    isTaskRunning || isGenerating || isUploadingReference || isAiGenerating;
  const imageAssets = useMemo(
    () =>
      workspaceProject.assets
        .filter(
          (asset) =>
            asset.type === "generated_image" &&
            (asset.asset_role === undefined || asset.asset_role === "public") &&
            (asset.status === "succeeded" || asset.status === "stale")
        )
        .toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
    [workspaceProject.assets]
  );
  const referenceAssets = useMemo(
    () => referenceAssetsFromProject(workspaceProject),
    [workspaceProject]
  );

  const refreshProject = useCallback(
    async (showBusy = false) => {
      if (showBusy) setIsRefreshing(true);
      try {
        const nextProject = await apiClient.getProject(project.id, {
          cache: "no-store"
        });
        setWorkspaceProject(nextProject);
        onProjectUpdated(nextProject);
        return nextProject;
      } finally {
        if (showBusy) setIsRefreshing(false);
      }
    },
    [onProjectUpdated, project.id]
  );

  useEffect(() => {
    let active = true;
    apiClient
      .listImagePromptVersions(project.id, { cache: "no-store" })
      .then((items) => {
        if (!active) return;
        setVersions(items);
        const current =
          items.find(
            (item) => item.id === project.current_image_prompt_version_id
          ) ?? items[0];
        setSelectedVersionId(current?.id ?? null);
        setPrompt(current?.prompt ?? "");
        promptRef.current = current?.prompt ?? "";
        savedPromptRef.current = current?.prompt ?? null;
      })
      .catch((error) => {
        if (active) setFeedback(getUserFacingErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadedVersionsRequestKey(loadRequestKey);
      });
    apiClient
      .listImageLayerSets(project.id, { cache: "no-store" })
      .then((sets) => {
        if (active) setLayerSets(sets);
      })
      .catch((error) => {
        if (active) setFeedback(getUserFacingErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadedLayerSetsRequestKey(loadRequestKey);
      });
    return () => {
      active = false;
    };
  }, [loadRequestKey, project.current_image_prompt_version_id, project.id]);

  useEffect(() => {
    if (!activeTask || !ACTIVE_TASK_STATUSES.has(activeTask.status)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextTask = await apiClient.getTask(activeTask.id, {
          cache: "no-store"
        });
        if (cancelled) return;
        setActiveTask(nextTask);
        if (!ACTIVE_TASK_STATUSES.has(nextTask.status)) {
          await refreshProject();
          if (!cancelled) {
            if (nextTask.status === "succeeded") {
              setEditAsset(null);
            }
            setFeedback(
              nextTask.status === "succeeded"
                ? "图片版本已生成。"
                : nextTask.error?.message ?? "图片任务失败，可重试。"
            );
          }
        }
      } catch (error) {
        if (!cancelled) setFeedback(getUserFacingErrorMessage(error));
      }
    }, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTask, refreshProject]);

  useEffect(() => {
    if (!layerTask || !ACTIVE_TASK_STATUSES.has(layerTask.status)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const nextTask = await apiClient.getTask(layerTask.id, {
          cache: "no-store"
        });
        if (cancelled) return;
        if (ACTIVE_TASK_STATUSES.has(nextTask.status)) {
          setLayerTask(nextTask);
          return;
        }

        const sets =
          nextTask.status === "succeeded"
            ? await apiClient.listImageLayerSets(project.id, {
                cache: "no-store"
              })
            : null;
        if (cancelled) return;

        setLayerTask(nextTask);
        if (sets) {
          setLayerSets(sets);
          const sourceAssetId = layerTaskSourceId(nextTask);
          const created = sets
            .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
            .find((set) => set.source_asset_id === sourceAssetId);
          if (created) setEditorSet(created);
          setFeedback("图层拆分完成，已打开图层编辑器。");
        } else {
          setFeedback(nextTask.error?.message ?? "图层拆分失败，可重试。");
        }
        await refreshProject();
      } catch (error) {
        if (!cancelled) setFeedback(getUserFacingErrorMessage(error));
      }
    }, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [layerTask, project.id, refreshProject]);

  function handleSelectVersion(version: ImagePromptVersion) {
    setSelectedVersionId(version.id);
    setPrompt(version.prompt);
    promptRef.current = version.prompt;
    savedPromptRef.current = version.prompt;
    setConfirmLongPrompt(false);
    setFeedback(null);
  }

  async function handleGenerateAiPrompt() {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    setFeedback(null);
    try {
      const currentPrompt = promptRef.current.trim();
      const suggestion = await apiClient.generateImagePrompt(project.id, {
        current_prompt: currentPrompt || null
      });
      if (
        hasUnsavedPromptChanges(
          promptRef.current,
          savedPromptRef.current
        )
      ) {
        setPendingAiPrompt(suggestion.prompt);
      } else {
        setPrompt(suggestion.prompt);
        promptRef.current = suggestion.prompt;
        setConfirmLongPrompt(false);
        setFeedback("AI 提示词已写入编辑器，保存后方可用于图片生成。");
      }
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsAiGenerating(false);
    }
  }

  async function handleReferenceFiles(files: File[]) {
    if (isUploadingReference) return;
    if (files.length === 0) return;
    if (referenceAssets.length + files.length > MAX_IMAGE_REFERENCES) {
      setFeedback(`参考图最多支持 ${MAX_IMAGE_REFERENCES} 张，请减少本次选择数量。`);
      return;
    }
    const validationError = files
      .map(validateImageReference)
      .find((message) => message !== null);
    if (validationError) {
      setFeedback(validationError);
      return;
    }

    setIsUploadingReference(true);
    setFeedback(null);
    const uploadedAssets: Asset[] = [];
    try {
      for (const file of files) {
        const uploaded = await apiClient.uploadImageProjectReference(
          project.id,
          file,
          {
            filename: file.name,
            mimeType: file.type
          }
        );
        uploadedAssets.push(uploaded);
      }
      const nextProject = await apiClient.setImageProjectReferenceSelection(
        project.id,
        {
          asset_ids: [
            ...(workspaceProject.image_reference_asset_ids ?? []),
            ...uploadedAssets.map((asset) => asset.id)
          ]
        }
      );
      setWorkspaceProject(nextProject);
      onProjectUpdated(nextProject);
      setFeedback(`已添加 ${uploadedAssets.length} 张参考图。`);
    } catch (error) {
      if (uploadedAssets.length > 0) {
        try {
          const nextProject = await apiClient.setImageProjectReferenceSelection(
            project.id,
            {
              asset_ids: [
                ...(workspaceProject.image_reference_asset_ids ?? []),
                ...uploadedAssets.map((asset) => asset.id)
              ]
            }
          );
          setWorkspaceProject(nextProject);
          onProjectUpdated(nextProject);
        } catch {
          // Preserve the upload error because saving the partial selection failed too.
        }
      }
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsUploadingReference(false);
    }
  }

  async function handleRemoveReference(assetId: string) {
    if (isUploadingReference) return;
    setIsUploadingReference(true);
    setFeedback(null);
    try {
      const nextProject = await apiClient.setImageProjectReferenceSelection(
        project.id,
        {
          asset_ids: (workspaceProject.image_reference_asset_ids ?? []).filter(
            (id) => id !== assetId
          )
        }
      );
      setWorkspaceProject(nextProject);
      onProjectUpdated(nextProject);
      setFeedback("已从项目参考图中移除，后端资产仍保留。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsUploadingReference(false);
    }
  }

  async function handleCanvasAspectRatioChange(
    aspectRatio: Project["brief"]["aspect_ratio"]
  ) {
    if (
      isUpdatingCanvasAspectRatio ||
      workspaceProject.brief.aspect_ratio === aspectRatio
    ) {
      return;
    }
    setIsUpdatingCanvasAspectRatio(true);
    setFeedback(null);
    try {
      const nextProject = await apiClient.updateProject(project.id, {
        brief: { aspect_ratio: aspectRatio }
      });
      setWorkspaceProject(nextProject);
      onProjectUpdated(nextProject);
      setFeedback("画幅已更新；保存提示词后将用于新的图片版本。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsUpdatingCanvasAspectRatio(false);
    }
  }

  async function handleSavePrompt() {
    if (!prompt.trim() || !promptCopyValidation.valid || isSaving) return;
    if (isOverRecommendation && !confirmLongPrompt) {
      setConfirmLongPrompt(true);
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await apiClient.saveImagePromptVersion(project.id, {
        prompt: prompt.trim()
      });
      const [nextProject, nextVersions] = await Promise.all([
        apiClient.getProject(project.id, { cache: "no-store" }),
        apiClient.listImagePromptVersions(project.id, { cache: "no-store" })
      ]);
      setVersions(nextVersions);
      setSelectedVersionId(saved.id);
      setPrompt(saved.prompt);
      promptRef.current = saved.prompt;
      savedPromptRef.current = saved.prompt;
      setWorkspaceProject(nextProject);
      setConfirmLongPrompt(false);
      setFeedback(`提示词版本 V${saved.version} 已保存。`);
      onProjectUpdated(nextProject);
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerate() {
    const promptVersionId = workspaceProject.current_image_prompt_version_id;
    if (
      !promptVersionId ||
      !currentPromptCopyValidation.valid ||
      isGenerationBusy ||
      isPromptDirty
    ) {
      return;
    }
    setIsGenerating(true);
    setFeedback(null);
    try {
      const task = await apiClient.generateProjectImage(project.id, {
        format,
        operation: "text_to_image",
        prompt_version_id: promptVersionId,
        ...(referenceAssets.length > 0
          ? { reference_asset_ids: referenceAssets.map((asset) => asset.id) }
          : {}),
        size
      });
      setActiveTask(task);
      setFeedback("图片任务已提交，正在等待结果。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRetry() {
    if (!activeTask || activeTask.status !== "failed") return;
    setFeedback(null);
    try {
      const task = await apiClient.retryTask(activeTask.id);
      setActiveTask(task);
      setFeedback("已按原冻结输入创建重试任务。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function handleSelectCurrent(asset: Asset) {
    if (asset.status === "stale" || isSelecting) return;
    setIsSelecting(true);
    setFeedback(null);
    try {
      const nextProject = await apiClient.selectCurrentImage(project.id, {
        asset_id: asset.id,
        expected_image_revision: workspaceProject.image_revision
      });
      setWorkspaceProject(nextProject);
      onProjectUpdated(nextProject);
      setFeedback("已设为当前成品。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
      await refreshProject();
    } finally {
      setIsSelecting(false);
    }
  }

  async function handleEditSubmit({
    annotation,
    prompt: editPrompt
  }: CanvasEditInput) {
    if (!editAsset || isTaskRunning) return;
    setFeedback(null);
    try {
      const task = await apiClient.editProjectImage(project.id, {
        annotation,
        edit_mode: "single_region",
        format,
        operation: "image_to_image",
        prompt: editPrompt,
        prompt_version_id:
          workspaceProject.current_image_prompt_version_id ?? undefined,
        size,
        source_asset_id: editAsset.id
      });
      setActiveTask(task);
      setFeedback("编辑任务已提交，结果将作为新版本保存。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  function handleLayerEdit(asset: Asset) {
    const existing = layerSets
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
      .find((set) => set.source_asset_id === asset.id);
    if (existing) {
      setEditorSet(existing);
      return;
    }
    setDecomposeAsset(asset);
  }

  async function handleDecomposeSubmit({
    bbox,
    prompt: decompositionPrompt
  }: {
    bbox: NonNullable<
      Parameters<typeof apiClient.decomposeImageLayers>[1]["bbox"]
    > | null;
    prompt: string | null;
  }) {
    if (!decomposeAsset || (layerTask && ACTIVE_TASK_STATUSES.has(layerTask.status))) {
      return;
    }
    setFeedback(null);
    try {
      const task = await apiClient.decomposeImageLayers(project.id, {
        bbox,
        format: "png",
        prompt: decompositionPrompt,
        size: "auto",
        source_asset_id: decomposeAsset.id
      });
      setLayerTask(task);
      setDecomposeAsset(null);
      setFeedback("图层拆分任务已提交。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  async function handleLayerRetry() {
    if (!layerTask || layerTask.status !== "failed") return;
    setFeedback(null);
    try {
      const task = await apiClient.retryTask(layerTask.id);
      setLayerTask(task);
      setFeedback("已按原拆分配置创建重试任务。");
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    }
  }

  return (
    <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.55fr)]">
        <section className="min-w-0 space-y-4">
          <article className="rounded-3xl border border-border bg-card p-4 shadow-glass sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="ad-kicker">Image Prompt</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                  图片提示词
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  disabled={isAiGenerating}
                  onClick={handleGenerateAiPrompt}
                  size="sm"
                  title="根据项目 Brief 生成或改写提示词"
                  type="button"
                  variant="outline"
                >
                  {isAiGenerating ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isAiGenerating ? "生成中" : "AI 生成"}
                </Button>
                <Badge variant={statusVariant(workspaceProject.image_prompt_status)}>
                  {workspaceProject.image_prompt_status}
                </Badge>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="image-project-prompt">提示词内容</Label>
                <span
                  className={cn(
                    "font-mono text-xs",
                    isOverRecommendation
                      ? "font-semibold text-warning"
                      : "text-muted-foreground"
                  )}
                >
                  {promptCount} / 建议 {recommendedLimit}
                  {workspaceProject.brief.target_language === "zh" ? " 字" : " 词"}
                </span>
              </div>
              <Textarea
                className="min-h-44 resize-y leading-7"
                id="image-project-prompt"
                onChange={(event) => {
                  setPrompt(event.target.value);
                  promptRef.current = event.target.value;
                  setConfirmLongPrompt(false);
                  setFeedback(null);
                }}
                placeholder={'描述主体、构图、场景和光线。画面文字可选；如需显示，最多 4 条并用英文双引号标出，例如 "轻巧随行"。'}
                value={prompt}
              />
              <p
                className={cn(
                  "text-xs leading-5",
                  promptCopyValidation.valid
                    ? "text-muted-foreground"
                    : "font-medium text-destructive"
                )}
                role={promptCopyValidation.valid ? undefined : "alert"}
              >
                {promptCopyValidation.message}
              </p>
            </div>
            {isOverRecommendation ? (
              <div
                className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-5 text-warning"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                已超过官方建议长度。可精简描述，或再次确认保存当前版本。
              </div>
            ) : null}
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor="image-reference-upload">参考图（可选）</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG、JPEG 或 WebP，单张最大 20 MB，最多 10 张。
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {referenceAssets.length} / {MAX_IMAGE_REFERENCES}
                </span>
              </div>
              <input
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={
                  isUploadingReference ||
                  referenceAssets.length >= MAX_IMAGE_REFERENCES
                }
                id="image-reference-upload"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length > 0) void handleReferenceFiles(files);
                }}
                multiple
                ref={referenceInputRef}
                type="file"
              />
              <button
                className="mt-3 flex min-h-20 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/20 px-3 py-4 text-sm text-muted-foreground transition hover:border-primary/35 hover:bg-primary/[0.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  isUploadingReference ||
                  referenceAssets.length >= MAX_IMAGE_REFERENCES
                }
                onClick={() => referenceInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const files = Array.from(event.dataTransfer.files);
                  if (files.length > 0) void handleReferenceFiles(files);
                }}
                title="点击或拖拽上传参考图"
                type="button"
              >
                {isUploadingReference ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="truncate">
                  {isUploadingReference
                    ? "参考图上传中..."
                    : referenceAssets.length >= MAX_IMAGE_REFERENCES
                      ? "已达到 10 张参考图上限"
                      : "点击或拖拽添加参考图"}
                </span>
              </button>
              {referenceAssets.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {referenceAssets.map((asset) => {
                    const name = referenceAssetName(asset);
                    return (
                      <div
                        className="min-w-0 rounded-xl border border-border bg-secondary/25 p-2"
                        key={asset.id}
                      >
                        <ReferenceThumbnail asset={asset} />
                        <div className="mt-2 flex items-center gap-1">
                          <p className="min-w-0 flex-1 truncate text-xs font-medium">
                            {name}
                          </p>
                          <Button
                            aria-label={`移除参考图：${name}`}
                            disabled={isUploadingReference}
                            onClick={() => void handleRemoveReference(asset.id)}
                            size="icon"
                            title={`移除参考图：${name}`}
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                disabled={
                  !prompt.trim() || !promptCopyValidation.valid || isSaving
                }
                onClick={handleSavePrompt}
                type="button"
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {confirmLongPrompt ? "确认保存超长版本" : "保存新版本"}
              </Button>
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card p-4 shadow-glass sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <ImagePlus className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">生成设置</h3>
              {activeTask ? (
                <Badge variant={statusVariant(activeTask.status)}>
                  {taskStatusLabel(activeTask)}
                </Badge>
              ) : null}
              <Button
                aria-label="刷新图片版本"
                className="ml-auto"
                disabled={isRefreshing}
                onClick={() => refreshProject(true)}
                size="icon"
                title="刷新图片版本"
                type="button"
                variant="ghost"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                />
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="image-size">分辨率</Label>
                <select
                  className={selectClassName}
                  disabled={isTaskRunning}
                  id="image-size"
                  onChange={(event) =>
                    setSize(event.target.value as ImageGenerationSize)
                  }
                  value={size}
                >
                  <option value="1K">1K</option>
                  <option value="1.5K">1.5K</option>
                  <option value="2K">2K</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-format">输出格式</Label>
                <select
                  className={selectClassName}
                  disabled={isTaskRunning}
                  id="image-format"
                  onChange={(event) =>
                    setFormat(event.target.value as ImageOutputFormat)
                  }
                  value={format}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={
                  isGenerationBusy ||
                  isPromptDirty ||
                  !currentPromptCopyValidation.valid ||
                  !workspaceProject.current_image_prompt_version_id
                }
                onClick={handleGenerate}
                type="button"
              >
                {isTaskRunning || isGenerating ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isTaskRunning || isGenerating ? "生成中" : "生成图片"}
              </Button>
              {activeTask?.status === "failed" ? (
                <Button onClick={handleRetry} type="button" variant="outline">
                  <RefreshCw className="h-4 w-4" />
                  失败重试
                </Button>
              ) : null}
            </div>
            {feedback ? (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                {feedback}
              </p>
            ) : null}
          </article>

          <article className="min-w-0 rounded-3xl border border-border bg-card p-4 shadow-glass sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="ad-kicker">Version Contact Sheet</p>
                <h3 className="mt-2 font-semibold">图片版本</h3>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {imageAssets.length} VERSIONS
              </span>
            </div>
            {layerTask ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/35 px-3 py-2">
                <Layers3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">图层拆分</span>
                <Badge variant={statusVariant(layerTask.status)}>
                  {layerTaskStatusLabel(layerTask)}
                </Badge>
                {layerTask.progress_message ? (
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {layerTask.progress_message}
                  </span>
                ) : (
                  <span className="flex-1" />
                )}
                {layerTask.status === "failed" ? (
                  <Button
                    onClick={handleLayerRetry}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw className="h-4 w-4" />
                    重试拆分
                  </Button>
                ) : null}
              </div>
            ) : null}
            {imageAssets.length > 0 ? (
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
                {imageAssets.map((asset) => (
                  <ImageVersionCard
                    asset={asset}
                    current={workspaceProject.current_image_asset_id === asset.id}
                    disabled={isTaskRunning || isGenerating || isSelecting}
                    key={asset.id}
                    layerEditDisabled={isLayerSetsLoading}
                    onEdit={() => setEditAsset(asset)}
                    onLayerEdit={() => handleLayerEdit(asset)}
                    onSelect={() => handleSelectCurrent(asset)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid min-h-44 place-items-center rounded-2xl border border-dashed border-border bg-secondary/25 p-6 text-center">
                <div>
                  <FileImage className="mx-auto h-7 w-7 text-primary" />
                  <h4 className="mt-3 font-semibold">暂无图片版本</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    保存提示词后生成第一张图片。
                  </p>
                </div>
              </div>
            )}
          </article>
        </section>

        <aside className="min-w-0 space-y-4">
          <article className="rounded-3xl border border-border bg-card p-5 shadow-glass">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">提示词版本</h3>
            </div>
            {isLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">正在加载版本...</p>
            ) : versions.length > 0 ? (
              <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1">
                {versions.map((version) => (
                  <button
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      selectedVersionId === version.id
                        ? "border-primary/35 bg-primary/[0.07]"
                        : "border-border hover:border-primary/20"
                    )}
                    key={version.id}
                    onClick={() => handleSelectVersion(version)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        V{version.version}
                      </span>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={version.created_at}
                      >
                        {formatDate(version.created_at)}
                      </time>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {version.prompt}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                尚未保存提示词版本。
              </p>
            )}
          </article>

        </aside>
      </div>

      <ImageCanvasEditor
        aspectRatio={workspaceProject.brief.aspect_ratio}
        format={format}
        isUploadingReference={
          isUploadingReference || isUpdatingCanvasAspectRatio
        }
        isSubmitting={isTaskRunning}
        onAspectRatioChange={(nextAspectRatio) =>
          void handleCanvasAspectRatioChange(nextAspectRatio)
        }
        onFormatChange={setFormat}
        onOpenChange={(open) => {
          if (!open) setEditAsset(null);
        }}
        onReferenceFiles={(files) => void handleReferenceFiles(files)}
        onSizeChange={setSize}
        onSubmit={handleEditSubmit}
        open={editAsset !== null}
        referenceAssets={referenceAssets}
        size={size}
        targetAsset={editAsset}
      />
      <LayerDecomposeDialog
        asset={decomposeAsset}
        isSubmitting={
          layerTask ? ACTIVE_TASK_STATUSES.has(layerTask.status) : false
        }
        onOpenChange={(open) => {
          if (!open) setDecomposeAsset(null);
        }}
        onSubmit={handleDecomposeSubmit}
        open={decomposeAsset !== null}
      />
      {editorSet ? (
        <LayerEditorDialog
          initialLayerSet={editorSet}
          key={`${editorSet.id}:${editorSet.revision}`}
          onLayerSetChange={(updated) => {
            setEditorSet(updated);
            setLayerSets((current) =>
              current.map((set) => (set.id === updated.id ? updated : set))
            );
          }}
          onOpenChange={(open) => {
            if (!open) setEditorSet(null);
          }}
          open
        />
      ) : null}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setPendingAiPrompt(null);
        }}
        open={pendingAiPrompt !== null}
      >
        <DialogContent className="max-w-md p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>替换当前提示词？</DialogTitle>
            <DialogDescription>
              当前编辑器包含未保存改动。AI 生成结果会替换现有内容，但不会自动保存为版本。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setPendingAiPrompt(null)}
              type="button"
              variant="ghost"
            >
              取消，保留原文
            </Button>
            <Button
              onClick={() => {
                if (pendingAiPrompt === null) return;
                setPrompt(pendingAiPrompt);
                promptRef.current = pendingAiPrompt;
                setPendingAiPrompt(null);
                setConfirmLongPrompt(false);
                setFeedback("AI 提示词已替换编辑器内容，保存后方可用于图片生成。");
              }}
              type="button"
            >
              确认替换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReferenceThumbnail({ asset }: { asset: Asset }) {
  const previewUrl = getSafePreviewUrl(asset);
  return (
    <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-slate-950">
      {previewUrl ? (
        // Signed assets intentionally retain the backend proxy URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={referenceAssetName(asset)}
          className="h-full w-full object-cover"
          src={previewUrl}
        />
      ) : (
        <FileImage className="h-5 w-5 text-slate-300" />
      )}
    </div>
  );
}

function ImageVersionCard({
  asset,
  current,
  disabled,
  layerEditDisabled,
  onEdit,
  onLayerEdit,
  onSelect
}: {
  asset: Asset;
  current: boolean;
  disabled: boolean;
  layerEditDisabled: boolean;
  onEdit: () => void;
  onLayerEdit: () => void;
  onSelect: () => void;
}) {
  const previewUrl = getSafePreviewUrl(asset);
  const metadata = asset.metadata;
  const stale = asset.status === "stale";
  return (
    <article
      className={cn(
        "group min-w-0 overflow-hidden rounded-2xl border bg-background transition",
        current ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.12)]" : "border-border"
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-slate-950">
        {previewUrl ? (
          <>
            {/* Signed assets intentionally retain the backend proxy URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="图片生成版本"
              className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.015]"
              loading="lazy"
              src={previewUrl}
            />
          </>
        ) : (
          <div className="grid h-full place-items-center text-xs text-slate-300">
            无法预览
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {current ? <Badge variant="default">CURRENT</Badge> : null}
          {stale ? <Badge variant="warning">STALE</Badge> : null}
        </div>
        <div className="absolute bottom-2 right-2 flex gap-1 rounded-lg border border-white/15 bg-slate-950/75 p-1 backdrop-blur">
          <IconLink href={previewUrl} icon={Eye} label="预览图片" />
          <IconLink
            download
            href={previewUrl}
            icon={Download}
            label="下载图片"
          />
          <IconButton
            disabled={disabled}
            icon={Pencil}
            label="编辑图片"
            onClick={onEdit}
          />
          <IconButton
            disabled={disabled || layerEditDisabled}
            icon={Layers3}
            label={
              layerEditDisabled ? "图层编辑（正在加载图层数据）" : "图层编辑"
            }
            onClick={onLayerEdit}
          />
          <IconButton
            disabled={disabled || stale || current}
            icon={Check}
            label={stale ? "失效版本不可设为当前" : "设为当前成品"}
            onClick={onSelect}
          />
        </div>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
          <span className="truncate font-semibold">
            {operationLabel(metadata.operation)}
          </span>
          <time className="shrink-0 text-muted-foreground" dateTime={asset.created_at}>
            {formatDate(asset.created_at)}
          </time>
        </div>
        <p className="line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
          {metadataText(metadata.prompt_summary) ?? "无提示词摘要"}
        </p>
        <div className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>{metadataText(metadata.size) ?? "AUTO"}</span>
          <span>{(metadataText(metadata.format) ?? asset.mime_type ?? "image").toUpperCase()}</span>
          <span>V{metadataText(metadata.prompt_version) ?? "-"}</span>
          {metadataText(metadata.source_asset_id) ? <span>有源图</span> : null}
        </div>
      </div>
    </article>
  );
}

function IconButton({
  disabled,
  icon: Icon,
  label,
  onClick
}: {
  disabled: boolean;
  icon: typeof Eye;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

function IconLink({
  download = false,
  href,
  icon: Icon,
  label
}: {
  download?: boolean;
  href: string | null;
  icon: typeof Eye;
  label: string;
}) {
  if (!href) {
    return <IconButton disabled icon={Icon} label={label} onClick={() => {}} />;
  }
  return (
    <a
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-white transition hover:bg-white/15"
      download={download || undefined}
      href={href}
      rel="noreferrer"
      target={download ? undefined : "_blank"}
      title={label}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </a>
  );
}

function latestImageGenerationTask(tasks: GenerationTask[]) {
  return tasks
    .filter(
      (task) =>
        task.stage === "image" &&
        task.frozen_input &&
        task.frozen_input.kind !== "layer_decomposition"
    )
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function latestLayerTask(tasks: GenerationTask[]) {
  return tasks
    .filter(
      (task) =>
        task.stage === "image" &&
        task.frozen_input?.kind === "layer_decomposition"
    )
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

function layerTaskSourceId(task: GenerationTask) {
  const value = task.frozen_input?.source_asset_id;
  return typeof value === "string" ? value : null;
}

function taskStatusLabel(task: GenerationTask) {
  if (task.status === "failed") return "生成失败";
  if (task.status === "queued") return "排队中";
  if (task.status === "running") return "生成中";
  if (task.status === "succeeded") return "已完成";
  return task.status;
}

function layerTaskStatusLabel(task: GenerationTask) {
  if (task.status === "failed") return "拆分失败";
  if (task.status === "queued") return "排队中";
  if (task.status === "running") return "拆分中";
  if (task.status === "succeeded") return "已完成";
  return task.status;
}

function operationLabel(value: unknown) {
  return value === "image_to_image" ? "图片编辑" : "文生图";
}

function metadataText(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function referenceAssetName(asset: Asset) {
  return metadataText(asset.metadata.name) ?? "已上传参考图";
}

function referenceAssetsFromProject(project: Project): Asset[] {
  const assetsById = new Map(
    project.assets
      .filter(
        (asset) =>
          asset.type === "uploaded_image" &&
          asset.asset_role === "public" &&
          asset.status === "succeeded"
      )
      .map((asset) => [asset.id, asset])
  );
  return (project.image_reference_asset_ids ?? [])
    .map((assetId) => assetsById.get(assetId))
    .filter((asset): asset is Asset => asset !== undefined);
}

function hasUnsavedPromptChanges(
  currentPrompt: string,
  savedPrompt: string | null
) {
  return savedPrompt === null
    ? currentPrompt.trim().length > 0
    : currentPrompt !== savedPrompt;
}

function validateImageReference(file: File) {
  if (!IMAGE_REFERENCE_MIME_TYPES.has(file.type)) {
    return "仅支持 PNG、JPEG 或 WebP 参考图。";
  }
  if (file.size <= 0) {
    return "参考图不能为空。";
  }
  if (file.size > MAX_IMAGE_REFERENCE_BYTES) {
    return "参考图不能超过 20 MB。";
  }
  return null;
}

export function countPrompt(prompt: string, language: "zh" | "en") {
  if (language === "zh") {
    return Array.from(prompt.trim()).length;
  }
  return prompt.trim() ? prompt.trim().split(/\s+/u).length : 0;
}
