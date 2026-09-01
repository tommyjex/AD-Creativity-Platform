"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Film,
  ImageIcon,
  LoaderCircle,
  Maximize2,
  Music2,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  Video,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  apiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type {
  Asset,
  FaceBlurVideoRequest,
  ReferenceAssetKind,
  ToolTask,
  ToolVideoGenerationRequest
} from "@/lib/api-types";
import {
  getAssetDownloadUrl,
  getSafePreviewUrl,
  getStatusLabel
} from "@/lib/asset-display";
import {
  SEEDANCE_ASPECT_RATIOS,
  SEEDANCE_CAPABILITIES,
  SEEDANCE_DEFAULT_MODEL,
  SEEDANCE_DEFAULT_RESOLUTION,
  SEEDANCE_MODELS
} from "@/lib/seedance";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES = new Set(["queued", "running"]);
const VIDEO_GENERATION_TASKS_PER_PAGE = 10;
const VIDEO_MODELS: Array<{
  label: string;
  value: ToolVideoGenerationRequest["model"];
}> = SEEDANCE_MODELS.map((model) => ({
  label: SEEDANCE_CAPABILITIES[model].displayName,
  value: model
}));
const VIDEO_ASPECT_RATIO_OPTIONS: Array<[ToolVideoGenerationRequest["aspect_ratio"], string]> = [
  ...SEEDANCE_ASPECT_RATIOS.map((ratio) => [
    ratio,
    {
      "16:9": "16:9 横屏",
      "4:3": "4:3",
      "1:1": "1:1 方形",
      "3:4": "3:4",
      "9:16": "9:16 竖屏",
      "21:9": "21:9 宽银幕",
      adaptive: "自适应"
    }[ratio]
  ] as [ToolVideoGenerationRequest["aspect_ratio"], string])
];
const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm transition-all focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15";

type ToolTab = "face-blur" | "video-generation";

export function ToolsWorkspace({
  initialAssets,
  initialTasks,
  initialError
}: {
  initialAssets: Asset[];
  initialTasks: ToolTask[];
  initialError?: string;
}) {
  const [tab, setTab] = useState<ToolTab>("face-blur");
  const [assets, setAssets] = useState(initialAssets);
  const [tasks, setTasks] = useState(initialTasks);
  const [feedback, setFeedback] = useState<string | null>(initialError ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setIsRefreshing(true);
    try {
      const [nextAssets, nextTasks] = await Promise.all([
        apiClient.listToolAssets({ cache: "no-store" }),
        apiClient.listToolTasks({ cache: "no-store" })
      ]);
      setAssets(nextAssets);
      setTasks(nextTasks);
      setFeedback(null);
    } catch (error) {
      setFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="w-full max-w-none px-3 py-6 sm:px-4 sm:py-8 lg:px-5">
      <div className="border-b border-border pb-6 sm:flex sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">
            Independent video tools
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground">
            视频工具
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            独立处理人物打码与全模态参考生视频，全部素材和结果会归档至工具资产。
          </p>
        </div>
        <Button
          className="mt-4 sm:mt-0"
          disabled={isRefreshing}
          onClick={refresh}
          type="button"
          variant="outline"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          刷新任务
        </Button>
      </div>

      <div
        aria-label="工具类型"
        className="mt-6 flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/60 p-1 sm:w-fit"
        role="tablist"
      >
        <ToolTabButton
          active={tab === "face-blur"}
          icon={<Video className="h-4 w-4" />}
          label="视频人物打码"
          onClick={() => setTab("face-blur")}
        />
        <ToolTabButton
          active={tab === "video-generation"}
          icon={<Film className="h-4 w-4" />}
          label="全模态参考生视频"
          onClick={() => setTab("video-generation")}
        />
      </div>

      {feedback ? (
        <div className="mt-5 flex gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {feedback}
        </div>
      ) : null}

      <div className="mt-6">
        {tab === "face-blur" ? (
          <FaceBlurPanel assets={assets} onAssetsChange={setAssets} onFeedback={setFeedback} onTasksChange={setTasks} tasks={tasks} />
        ) : (
          <VideoGenerationPanel assets={assets} onAssetsChange={setAssets} onFeedback={setFeedback} onTasksChange={setTasks} tasks={tasks} />
        )}
      </div>
    </section>
  );
}

function ToolTabButton({
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
        "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
        active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
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

function FaceBlurPanel(props: PanelProps) {
  const [videoAssetId, setVideoAssetId] = useState("");
  const [maskMode, setMaskMode] = useState<FaceBlurVideoRequest["mask_mode"]>("mosaic");
  const [strength, setStrength] = useState<FaceBlurVideoRequest["mask_strength"]>("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const faceBlurTasks = useMemo(
    () => props.tasks.filter((item) => item.type === "face_blur_video"),
    [props.tasks]
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    () => faceBlurTasks[0]?.id ?? null
  );
  const selectedTask = faceBlurTasks.find((item) => item.id === selectedTaskId) ?? null;
  const selectedVideoAsset = selectedTask
    ? inputVideoAssetForTask(selectedTask, props.assets)
    : props.assets.find((asset) => asset.id === videoAssetId) ?? null;
  const outputAsset = selectedTask?.status === "succeeded"
    ? props.assets.find((asset) => asset.tool_task_id === selectedTask.id && asset.tool_asset_role === "output") ?? null
    : null;

  useToolTaskPolling(selectedTask, props.onTasksChange, props.onAssetsChange);

  function selectInputVideo(ids: string[]) {
    setVideoAssetId(ids[0] ?? "");
    setSelectedTaskId(null);
  }

  function selectUploadedVideo(asset: Asset) {
    selectInputVideo([asset.id]);
  }

  async function submit() {
    if (!videoAssetId) return;
    setIsSubmitting(true);
    try {
      const nextTask = await apiClient.submitFaceBlurVideo({
        video_asset_id: videoAssetId,
        mask_mode: maskMode,
        mask_strength: strength
      });
      replaceTask(props.onTasksChange, nextTask);
      setSelectedTaskId(nextTask.id);
      props.onFeedback(null);
    } catch (error) {
      props.onFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>人物打码配置</CardTitle>
          <p className="text-sm text-muted-foreground">仅设置打码方式与强度，检测阈值使用 MediaKit 默认值。</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="grid gap-4 lg:grid-cols-[minmax(18rem,1.35fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)]"
            data-testid="face-blur-config-grid"
          >
            <AssetPicker
              accept="video/*"
              assets={compatibleAssets(props.assets, "video")}
              kind="video"
              label="输入视频"
              onAssetsChange={props.onAssetsChange}
              onFeedback={props.onFeedback}
              onUploaded={selectUploadedVideo}
              onSelect={selectInputVideo}
              selectedIds={videoAssetId ? [videoAssetId] : []}
            />
            <SelectField label="打码方式" onChange={(value) => setMaskMode(value as FaceBlurVideoRequest["mask_mode"])} value={maskMode} options={[["mosaic", "马赛克"], ["blur", "模糊"]]} />
            <SelectField label="打码强度" onChange={(value) => setStrength(value as FaceBlurVideoRequest["mask_strength"])} value={strength} options={[["low", "低"], ["medium", "中"], ["high", "高"]]} />
          </div>
          <div className="flex justify-end">
            <Button disabled={!videoAssetId || isSubmitting} onClick={submit} type="button">
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
              {isSubmitting ? "正在提交" : "开始人物打码"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[minmax(22rem,0.82fr)_minmax(0,1.18fr)]">
        <FaceBlurTaskList
          assets={props.assets}
          onSelectTask={setSelectedTaskId}
          onTasksChange={props.onTasksChange}
          selectedTaskId={selectedTaskId}
          tasks={faceBlurTasks}
        />
        <FaceBlurVideoComparison
          afterAsset={outputAsset}
          beforeAsset={selectedVideoAsset}
        />
      </div>
    </div>
  );
}

function VideoGenerationPanel(props: PanelProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ToolVideoGenerationRequest["model"]>(SEEDANCE_DEFAULT_MODEL);
  const [duration, setDuration] = useState("-1");
  const [aspectRatio, setAspectRatio] = useState<ToolVideoGenerationRequest["aspect_ratio"]>("adaptive");
  const [resolution, setResolution] = useState<ToolVideoGenerationRequest["resolution"]>(SEEDANCE_DEFAULT_RESOLUTION);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [audioIds, setAudioIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [page, setPage] = useState(1);
  const videoGenerationTasks = useMemo(
    () => props.tasks
      .filter((task) => task.type === "multimodal_video_generation")
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
    [props.tasks]
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    () => videoGenerationTasks[0]?.id ?? null
  );
  const totalPages = Math.max(
    1,
    Math.ceil(videoGenerationTasks.length / VIDEO_GENERATION_TASKS_PER_PAGE)
  );
  const displayedPage = Math.min(page, totalPages);
  const selectedTask = videoGenerationTasks.find((task) => task.id === selectedTaskId) ?? null;
  const referenceVideo = multimodalReferenceVideoAssetIds(selectedTask)
    .map((assetId) => props.assets.find((asset) => asset.id === assetId))
    .find((asset): asset is Asset => Boolean(asset && getSafePreviewUrl(asset)))
    ?? null;
  const outputVideo = selectedTask?.status === "succeeded"
    ? props.assets.find(
      (asset) =>
        asset.tool_task_id === selectedTask.id &&
        asset.tool_asset_role === "output" &&
        Boolean(getSafePreviewUrl(asset))
    ) ?? null
    : null;
  const durationRange = SEEDANCE_CAPABILITIES[model].duration;
  const durationValue = Number(duration);
  const durationError = getDurationError(durationValue, durationRange);

  useEffect(() => {
    if (selectedTaskId && videoGenerationTasks.some((task) => task.id === selectedTaskId)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSelectedTaskId(videoGenerationTasks[0]?.id ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedTaskId, videoGenerationTasks]);

  useToolTaskPolling(selectedTask, props.onTasksChange, props.onAssetsChange);

  async function submit() {
    if (!prompt.trim() || durationError) return;
    setIsSubmitting(true);
    try {
      const nextTask = await apiClient.generateToolVideo({
        model,
        prompt: prompt.trim(),
        duration_seconds: durationValue,
        resolution,
        aspect_ratio: aspectRatio,
        reference_image_asset_ids: imageIds,
        reference_video_asset_ids: videoIds,
        reference_audio_asset_ids: audioIds
      });
      replaceTask(props.onTasksChange, nextTask);
      setPage(1);
      setSelectedTaskId(nextTask.id);
      props.onFeedback(null);
    } catch (error) {
      props.onFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function optimize() {
    if (!prompt.trim() || isOptimizing || isSubmitting) return;
    setIsOptimizing(true);
    try {
      const { optimized_prompt } = await apiClient.optimizeToolVideoPrompt({
        prompt: prompt.trim(),
        reference_image_count: imageIds.length,
        reference_video_count: videoIds.length,
        reference_audio_count: audioIds.length
      });
      setPrompt(optimized_prompt);
      props.onFeedback(null);
    } catch (error) {
      props.onFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
      <div className="space-y-5">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>全模态参考生视频</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">开启音频生成，不提供首帧或尾帧控制。</p>
            </div>
            <Button disabled={!prompt.trim() || Boolean(durationError) || isSubmitting || isOptimizing} onClick={submit} type="button">
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
              {isSubmitting ? "正在提交" : "生成视频"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField
                label="模型"
                onChange={(value) => {
                  const nextModel = value as ToolVideoGenerationRequest["model"];
                  setModel(nextModel);
                  setDuration(String(constrainDuration(duration, SEEDANCE_CAPABILITIES[nextModel].duration)));
                  setResolution((current) => constrainResolution(current, nextModel));
                }}
                value={model}
                options={VIDEO_MODELS.map((item) => [item.value, item.label])}
              />
              <SelectField
                label="分辨率"
                onChange={(value) => setResolution(value as ToolVideoGenerationRequest["resolution"])}
                value={resolution}
                options={SEEDANCE_CAPABILITIES[model].resolutions.map((item) => [item, item])}
              />
              <div>
                <Label htmlFor="tool-video-duration">时长</Label>
                <input
                  aria-describedby="tool-video-duration-hint"
                  aria-invalid={Boolean(durationError)}
                  className={cn(selectClassName, "mt-2")}
                  id="tool-video-duration"
                  inputMode="numeric"
                  onChange={(event) =>
                    setDuration(event.target.value.replace(/[^\d.-]/g, ""))
                  }
                  type="text"
                  value={duration === "-1" ? "自动" : duration}
                />
                <p
                  className={cn(
                    "mt-1 text-xs",
                    durationError ? "text-destructive" : "text-muted-foreground"
                  )}
                  id="tool-video-duration-hint"
                >
                  {durationError ?? `自动或指定${durationRange.minimum}-${durationRange.maximum}s`}
                </p>
              </div>
              <SelectField label="画幅" onChange={(value) => setAspectRatio(value as ToolVideoGenerationRequest["aspect_ratio"])} value={aspectRatio} options={VIDEO_ASPECT_RATIO_OPTIONS} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <AssetPicker accept="image/*" assets={compatibleAssets(props.assets, "image")} kind="image" label="参考图" multiple onAssetsChange={props.onAssetsChange} onFeedback={props.onFeedback} onSelect={setImageIds} selectedIds={imageIds} />
              <AssetPicker accept="video/*" assets={compatibleAssets(props.assets, "video")} kind="video" label="参考视频" multiple onAssetsChange={props.onAssetsChange} onFeedback={props.onFeedback} onSelect={setVideoIds} selectedIds={videoIds} />
              <AssetPicker accept="audio/*" assets={compatibleAssets(props.assets, "audio")} kind="audio" label="参考音频" multiple onAssetsChange={props.onAssetsChange} onFeedback={props.onFeedback} onSelect={setAudioIds} selectedIds={audioIds} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="tool-video-prompt">创作提示词</Label>
                <Button
                  aria-label="优化提示词"
                  className="h-8 w-8"
                  disabled={!prompt.trim() || isOptimizing || isSubmitting}
                  onClick={optimize}
                  size="icon"
                  title="使用 seed evolving 优化提示词"
                  type="button"
                  variant="ghost"
                >
                  {isOptimizing ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Textarea id="tool-video-prompt" maxLength={12000} onChange={(event) => setPrompt(event.target.value)} placeholder="描述画面主体、动作、镜头语言、节奏和声音氛围。" value={prompt} />
            </div>
          </CardContent>
        </Card>
        <VideoGenerationComparison
          outputAsset={outputVideo}
          outputEmptyText={videoGenerationOutputEmptyText(selectedTask)}
          referenceAsset={referenceVideo}
          referenceEmptyText={videoGenerationReferenceEmptyText(selectedTask)}
        />
      </div>
      <VideoGenerationTaskList
        onFeedback={props.onFeedback}
        onPageChange={setPage}
        onPageReset={() => setPage(1)}
        onSelectTask={setSelectedTaskId}
        onTasksChange={props.onTasksChange}
        page={displayedPage}
        selectedTaskId={selectedTaskId}
        tasks={videoGenerationTasks}
      />
    </div>
  );
}

type PanelProps = {
  assets: Asset[];
  tasks: ToolTask[];
  onAssetsChange: Dispatch<SetStateAction<Asset[]>>;
  onTasksChange: Dispatch<SetStateAction<ToolTask[]>>;
  onFeedback: (message: string | null) => void;
};

function AssetPicker({
  accept,
  assets,
  kind,
  label,
  multiple = false,
  onAssetsChange,
  onFeedback,
  onUploaded,
  onSelect,
  selectedIds
}: {
  accept: string;
  assets: Asset[];
  kind: ReferenceAssetKind;
  label: string;
  multiple?: boolean;
  onAssetsChange: PanelProps["onAssetsChange"];
  onFeedback: PanelProps["onFeedback"];
  onUploaded?: (asset: Asset, file: File) => void;
  onSelect: (ids: string[]) => void;
  selectedIds: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  async function upload(file: File) {
    setIsUploading(true);
    try {
      const asset = await apiClient.uploadToolAsset(kind, file, {
        filename: file.name,
        mimeType: file.type
      });
      onAssetsChange((current) => [asset, ...current]);
      onSelect(multiple ? uniqueAssetIds([...selectedIds, asset.id]) : [asset.id]);
      onUploaded?.(asset, file);
    } catch (error) {
      onFeedback(getUserFacingErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  function openAssetDialog() {
    setPendingIds([]);
    setIsDialogOpen(true);
  }

  function togglePendingAsset(assetId: string) {
    setPendingIds((current) =>
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : multiple
          ? [...current, assetId]
          : [assetId]
    );
  }

  function confirmPendingAssets() {
    if (pendingIds.length > 0) {
      onSelect(multiple ? uniqueAssetIds([...selectedIds, ...pendingIds]) : [pendingIds[pendingIds.length - 1]]);
    }
    setIsDialogOpen(false);
    setPendingIds([]);
  }

  function addAsset(assetId: string) {
    if (!assetId) return;
    onSelect(multiple ? uniqueAssetIds([...selectedIds, assetId]) : [assetId]);
  }

  return (
    <div>
      <Label htmlFor={`${kind}-asset-picker`}>{label}</Label>
      <div className="mt-2 flex gap-2">
        {multiple ? (
          <Button
            className="flex-1 justify-start"
            id={`${kind}-asset-picker`}
            onClick={openAssetDialog}
            type="button"
            variant="outline"
          >
            从工具资产选择
          </Button>
        ) : (
          <select
            className={selectClassName}
            id={`${kind}-asset-picker`}
            onChange={(event) => {
              addAsset(event.currentTarget.value);
            }}
            value={selectedIds[0] ?? ""}
          >
            <option value="">选择资产</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{assetName(asset)}</option>)}
          </select>
        )}
        <input accept={accept} aria-label={`${label}文件`} className="sr-only" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }} ref={inputRef} type="file" />
        <Button aria-label={`上传${label}`} disabled={isUploading} onClick={() => inputRef.current?.click()} size="icon" type="button" variant="outline">
          {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
      {selectedIds.length > 0 ? (
        <ul aria-label={`${label}已选素材`} className="mt-2 space-y-1">
          {selectedIds.map((assetId) => {
            const asset = assets.find((item) => item.id === assetId);
            return (
              <li className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-2 py-1 text-xs" key={assetId}>
                <span className="min-w-0 truncate">{asset ? assetName(asset) : assetId}</span>
                <Button
                  aria-label={`移除${label} ${asset ? assetName(asset) : assetId}`}
                  className="h-6 w-6 shrink-0"
                  onClick={() => onSelect(selectedIds.filter((id) => id !== assetId))}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {multiple ? (
        <Dialog
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setPendingIds([]);
          }}
          open={isDialogOpen}
        >
          <DialogContent className="grid max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] p-0">
            <DialogHeader className="border-b border-border px-5 py-4 pr-16">
              <DialogTitle>选择{label}</DialogTitle>
              <DialogDescription>
                仅展示当前模态可用的工具资产。可多选后确认追加，关闭或取消不会修改已选素材。
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto p-5">
              {assets.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {assets.map((asset) => {
                    const checked = pendingIds.includes(asset.id);
                    return (
                      <button
                        aria-pressed={checked}
                        className={cn(
                          "overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary/35 hover:bg-secondary/30",
                          checked ? "border-primary/55 ring-2 ring-primary/15" : "border-border"
                        )}
                        key={asset.id}
                        onClick={() => togglePendingAsset(asset.id)}
                        type="button"
                      >
                        <AssetPickerCardPreview asset={asset} kind={kind} />
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium text-foreground">
                              {assetName(asset)}
                            </p>
                            <span
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0 rounded-full border",
                                checked
                                  ? "border-primary bg-primary shadow-[inset_0_0_0_3px_hsl(var(--card))]"
                                  : "border-muted-foreground/35"
                              )}
                              aria-hidden="true"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{referenceKindLabel(kind)}</Badge>
                            <span className="text-xs text-muted-foreground">{assetSourceLabel(asset)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatTaskTime(asset.created_at)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-[14rem] place-items-center rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center">
                  <div>
                    <AssetKindIcon className="mx-auto h-9 w-9 text-muted-foreground" kind={kind} />
                    <p className="mt-3 font-medium">暂无可选工具资产</p>
                    <p className="mt-1 text-sm text-muted-foreground">可先使用右侧上传按钮上传{label}，上传后会自动选中。</p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="border-t border-border px-5 py-4">
              <Button onClick={() => setIsDialogOpen(false)} type="button" variant="outline">
                取消
              </Button>
              <Button disabled={pendingIds.length === 0} onClick={confirmPendingAssets} type="button">
                确认选择{pendingIds.length > 0 ? `（${pendingIds.length}）` : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function AssetPickerCardPreview({
  asset,
  kind
}: {
  asset: Asset;
  kind: ReferenceAssetKind;
}) {
  const previewUrl = kind === "image" ? getSafePreviewUrl(asset) : null;
  return (
    <div className="grid aspect-video place-items-center overflow-hidden bg-slate-950">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={assetName(asset)}
          className="h-full w-full object-contain"
          loading="lazy"
          src={previewUrl}
        />
      ) : (
        <div className="grid place-items-center gap-2 text-slate-300">
          <AssetKindIcon className="h-8 w-8" kind={kind} />
          <span className="text-xs">{referenceKindLabel(kind)}</span>
        </div>
      )}
    </div>
  );
}

function AssetKindIcon({
  className,
  kind
}: {
  className?: string;
  kind: ReferenceAssetKind;
}) {
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "audio") return <Music2 className={className} />;
  return <Video className={className} />;
}

// Retained for other tool result views while task-list panels own their selection UI.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TaskResult({
  assets,
  onTasksChange,
  outputMode = "videos",
  task
}: Pick<PanelProps, "assets" | "onTasksChange"> & {
  outputMode?: "links" | "videos";
  task: ToolTask | null;
}) {
  const outputAssets = useMemo(
    () => task ? assets.filter((asset) => asset.tool_task_id === task.id && asset.tool_asset_role === "output") : [],
    [assets, task]
  );
  useToolTaskPolling(task, onTasksChange);

  if (!task) {
    return <TaskEmptyState />;
  }
  const active = ACTIVE_STATUSES.has(task.status);
  return (
    <Card className="min-h-[22rem]">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>当前任务</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">任务 ID：{task.id}</p>
        </div>
        <TaskStatus status={task.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {active ? <div className="flex items-center gap-2 rounded-lg bg-primary/[0.06] p-3 text-sm text-primary"><LoaderCircle className="h-4 w-4 animate-spin" />任务正在处理，页面会自动同步状态。</div> : null}
        {task.status === "failed" ? <div className="rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3 text-sm text-destructive">{task.error?.message ?? "任务未完成，请重试。"}</div> : null}
        <TaskSnapshot task={task} />
        {outputAssets.length > 0 ? (
          outputMode === "links" ? (
            <OutputAssetLinks assets={outputAssets} />
          ) : (
            outputAssets.map((asset) => <OutputVideo asset={asset} key={asset.id} />)
          )
        ) : null}
        {task.status === "failed" ? <Button onClick={async () => { const nextTask = await apiClient.retryToolTask(task.id); replaceTask(onTasksChange, nextTask); }} type="button" variant="outline"><RefreshCw className="h-4 w-4" />重试任务</Button> : null}
      </CardContent>
    </Card>
  );
}

function TaskEmptyState() {
  return <Card className="grid min-h-[22rem] place-items-center"><CardContent className="pt-6 text-center"><Video className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-medium">尚无任务</p><p className="mt-1 text-sm text-muted-foreground">提交配置后将在这里查看状态、参数和结果。</p></CardContent></Card>;
}

function FaceBlurTaskList({
  assets,
  onSelectTask,
  onTasksChange,
  selectedTaskId,
  tasks
}: Pick<PanelProps, "assets" | "onTasksChange"> & {
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  tasks: ToolTask[];
}) {
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
    () => new Set()
  );

  function toggleTaskDetails(taskId: string) {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  return (
    <Card className="min-h-[26rem]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>人物打码任务</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              仅选中的历史任务会驱动右侧打码前/后对比。
            </p>
          </div>
          <Badge variant="secondary">{tasks.length} 个</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="grid min-h-[16rem] place-items-center rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center">
            <div>
              <Video className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-medium">尚无人物打码任务</p>
              <p className="mt-1 text-sm text-muted-foreground">提交配置后，任务会出现在这里。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const active = task.id === selectedTaskId;
              const expanded = expandedTaskIds.has(task.id);
              const inputAsset = inputVideoAssetForTask(task, assets);
              return (
                <div
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition",
                    active
                      ? "border-primary/45 bg-primary/[0.06] shadow-sm"
                      : "border-border bg-card hover:border-primary/25 hover:bg-secondary/40"
                  )}
                  key={task.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      aria-label={`选择人物打码任务 ${task.id}`}
                      aria-pressed={active}
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelectTask(task.id)}
                      type="button"
                    >
                      <p className="truncate font-mono text-xs font-semibold text-foreground">
                        {task.id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTaskTime(task.created_at)}
                      </p>
                    </button>
                    <button
                      aria-controls={`face-blur-task-details-${task.id}`}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "收起" : "展开"}人物打码任务 ${task.id}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => toggleTaskDetails(task.id)}
                      title={expanded ? "收起任务详情" : "展开任务详情"}
                      type="button"
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expanded && "rotate-180"
                        )}
                      />
                    </button>
                  </div>
                  {expanded ? (
                    <div
                      className="mt-3 border-t border-border pt-3"
                      id={`face-blur-task-details-${task.id}`}
                    >
                      <dl className="grid gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-muted-foreground">状态</dt>
                          <dd className="mt-1"><TaskStatus status={task.status} /></dd>
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                          <dt className="text-muted-foreground">输入视频</dt>
                          <dd className="mt-0.5 truncate text-foreground">
                            {inputAsset ? assetName(inputAsset) : inputVideoAssetIdForTask(task) ?? "未记录"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">打码方式</dt>
                          <dd className="mt-0.5 text-foreground">
                            {maskModeLabel(task.input_snapshot.mask_mode)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">打码强度</dt>
                          <dd className="mt-0.5 text-foreground">
                            {maskStrengthLabel(task.input_snapshot.mask_strength)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">结果</dt>
                          <dd className="mt-0.5 text-foreground">
                            {task.status === "succeeded" ? "可预览" : getStatusLabel(task.status)}
                          </dd>
                        </div>
                      </dl>
                      {task.status === "failed" ? (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3 text-sm text-destructive">
                            {task.error?.message ?? "任务未完成，请重试。"}
                          </div>
                          <Button
                            onClick={async () => {
                              const nextTask = await apiClient.retryToolTask(task.id);
                              replaceTask(onTasksChange, nextTask);
                              onSelectTask(nextTask.id);
                            }}
                            type="button"
                            variant="outline"
                          >
                            <RefreshCw className="h-4 w-4" />
                            重试任务
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VideoGenerationTaskList({
  onFeedback,
  onPageChange,
  onPageReset,
  onSelectTask,
  onTasksChange,
  page,
  selectedTaskId,
  tasks
}: Pick<PanelProps, "onFeedback" | "onTasksChange"> & {
  onPageChange: (page: number) => void;
  onPageReset: () => void;
  onSelectTask: (taskId: string | null) => void;
  page: number;
  selectedTaskId: string | null;
  tasks: ToolTask[];
}) {
  const [pendingDeleteTask, setPendingDeleteTask] = useState<ToolTask | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(
    () => new Set()
  );
  const totalPages = Math.max(
    1,
    Math.ceil(tasks.length / VIDEO_GENERATION_TASKS_PER_PAGE)
  );
  const pagedTasks = tasks.slice(
    (page - 1) * VIDEO_GENERATION_TASKS_PER_PAGE,
    page * VIDEO_GENERATION_TASKS_PER_PAGE
  );

  function toggleTaskDetails(taskId: string) {
    setExpandedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  async function confirmDelete() {
    const taskToDelete = pendingDeleteTask;
    if (!taskToDelete) return;

    setIsDeleting(true);
    try {
      await apiClient.deleteToolTask(taskToDelete.id);
      const remainingTasks = tasks.filter((task) => task.id !== taskToDelete.id);
      const nextTotalPages = Math.max(
        1,
        Math.ceil(remainingTasks.length / VIDEO_GENERATION_TASKS_PER_PAGE)
      );
      const nextPage = Math.min(page, nextTotalPages);

      onTasksChange((currentTasks) =>
        currentTasks.filter((task) => task.id !== taskToDelete.id)
      );
      setExpandedTaskIds((current) => {
        const next = new Set(current);
        next.delete(taskToDelete.id);
        return next;
      });
      if (selectedTaskId === taskToDelete.id) {
        const nextSelectedTask = remainingTasks.slice(
          (nextPage - 1) * VIDEO_GENERATION_TASKS_PER_PAGE,
          nextPage * VIDEO_GENERATION_TASKS_PER_PAGE
        )[0] ?? null;
        onPageChange(nextPage);
        onSelectTask(nextSelectedTask?.id ?? null);
      }
      setPendingDeleteTask(null);
      setDeleteError(null);
      onFeedback(null);
    } catch (error) {
      const message = getUserFacingErrorMessage(error);
      setDeleteError(message);
      onFeedback(message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="min-h-[26rem]">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>生成任务</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              选择任务以查看提交时的参考视频和对应生成结果。
            </p>
          </div>
          <Badge variant="secondary">{tasks.length} 个</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="grid min-h-[16rem] place-items-center rounded-xl border border-dashed border-border bg-secondary/20 p-6 text-center">
            <div>
              <Film className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-medium">尚无生成任务</p>
              <p className="mt-1 text-sm text-muted-foreground">提交配置后，任务会出现在这里。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pagedTasks.map((task) => {
              const active = task.id === selectedTaskId;
              const expanded = expandedTaskIds.has(task.id);
              return (
                <div
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition",
                    active
                      ? "border-primary/45 bg-primary/[0.06] shadow-sm"
                      : "border-border bg-card hover:border-primary/25 hover:bg-secondary/40"
                  )}
                  key={task.id}
                >
                  <div className="flex items-start gap-3">
                    <button
                      aria-label={`选择生成任务 ${task.id}`}
                      aria-pressed={active}
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelectTask(task.id)}
                      type="button"
                    >
                      <p className="truncate font-mono text-xs font-semibold text-foreground">
                        {task.id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTaskTime(task.created_at)}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        aria-controls={`video-generation-task-details-${task.id}`}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "收起" : "展开"}生成任务 ${task.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => toggleTaskDetails(task.id)}
                        title={expanded ? "收起任务详情" : "展开任务详情"}
                        type="button"
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            "h-4 w-4 transition-transform",
                            expanded && "rotate-180"
                          )}
                        />
                      </button>
                      <button
                        aria-label={`删除生成任务 ${task.id}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDeleteTask(task);
                        }}
                        title="删除任务记录"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {expanded ? (
                    <div
                      className="mt-3 border-t border-border pt-3"
                      id={`video-generation-task-details-${task.id}`}
                    >
                      <dl className="grid gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
                        <div className="min-w-0 sm:col-span-3">
                          <dt className="text-muted-foreground">提示词</dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words leading-5 text-foreground">
                            {multimodalPrompt(task) || "未记录"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">状态</dt>
                          <dd className="mt-1"><TaskStatus status={task.status} /></dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">模型</dt>
                          <dd className="mt-0.5 text-foreground">
                            {multimodalModelLabel(task)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">参考视频</dt>
                          <dd className="mt-0.5 text-foreground">
                            {multimodalReferenceVideoAssetIds(task).length} 个
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">结果</dt>
                          <dd className="mt-0.5 text-foreground">
                            {task.status === "succeeded" ? "可预览" : getStatusLabel(task.status)}
                          </dd>
                        </div>
                      </dl>
                      {task.status === "failed" ? (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3 text-sm text-destructive">
                            {task.error?.message ?? "任务未完成，请重试。"}
                          </div>
                          <Button
                            onClick={async () => {
                              try {
                                const nextTask = await apiClient.retryToolTask(task.id);
                                replaceTask(onTasksChange, nextTask);
                                onPageReset();
                                onSelectTask(nextTask.id);
                                onFeedback(null);
                              } catch (error) {
                                onFeedback(getUserFacingErrorMessage(error));
                              }
                            }}
                            type="button"
                            variant="outline"
                          >
                            <RefreshCw className="h-4 w-4" />
                            重试任务
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {tasks.length > VIDEO_GENERATION_TASKS_PER_PAGE ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <Button
                  disabled={page === 1}
                  onClick={() => onPageChange(page - 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  上一页
                </Button>
                <span className="text-xs text-muted-foreground">
                  第 {page} / {totalPages} 页
                </span>
                <Button
                  disabled={page === totalPages}
                  onClick={() => onPageChange(page + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  下一页
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
      <Dialog
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteError(null);
            setPendingDeleteTask(null);
          }
        }}
        open={pendingDeleteTask !== null}
      >
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>删除生成任务</DialogTitle>
            <DialogDescription>
              确认删除任务记录“{pendingDeleteTask?.id}”？仅删除任务记录，参考素材和已生成资产会保留。
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
            <Button
              disabled={isDeleting}
              onClick={() => {
                setDeleteError(null);
                setPendingDeleteTask(null);
              }}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={isDeleting}
              onClick={confirmDelete}
              type="button"
              variant="destructive"
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FaceBlurVideoComparison({
  afterAsset,
  beforeAsset
}: {
  afterAsset: Asset | null;
  beforeAsset: Asset | null;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      <VideoPreviewCard
        asset={beforeAsset}
        emptyText="选择输入视频后可在这里查看打码前画面。"
        label="打码前视频"
      />
      <VideoPreviewCard
        asset={afterAsset}
        emptyText="当前任务成功后将在这里查看打码后视频。"
        label="打码后视频"
      />
    </div>
  );
}

function VideoGenerationComparison({
  outputAsset,
  outputEmptyText,
  referenceAsset,
  referenceEmptyText
}: {
  outputAsset: Asset | null;
  outputEmptyText: string;
  referenceAsset: Asset | null;
  referenceEmptyText: string;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2" data-testid="video-generation-comparison">
      <VideoPreviewCard
        asset={referenceAsset}
        emptyText={referenceEmptyText}
        label="参考视频"
      />
      <VideoPreviewCard
        asset={outputAsset}
        emptyText={outputEmptyText}
        label="生成结果视频"
      />
    </div>
  );
}

function VideoPreviewCard({
  asset,
  emptyText,
  label,
  previewUrlOverride = null
}: {
  asset: Asset | null;
  emptyText: string;
  label: string;
  previewUrlOverride?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const previewUrl = previewUrlOverride ?? (asset ? getSafePreviewUrl(asset) : null);
  const name = asset ? assetName(asset) : "";

  return (
    <Card className="min-h-[22rem] overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{label}</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            {asset ? name : emptyText}
          </p>
        </div>
        <Button
          aria-label={`放大查看${label}`}
          disabled={!previewUrl}
          onClick={() => setExpanded(true)}
          size="icon"
          type="button"
          variant="outline"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid aspect-video place-items-center overflow-hidden rounded-xl bg-slate-950">
          {previewUrl ? (
            <video
              aria-label={`${label}预览`}
              className="h-full w-full object-contain"
              controls
              key={previewUrl}
              playsInline
              preload="metadata"
              src={previewUrl}
            />
          ) : (
            <div className="px-6 text-center text-sm text-slate-300">{emptyText}</div>
          )}
        </div>
      </CardContent>
      <Dialog onOpenChange={setExpanded} open={expanded}>
        <DialogContent className="grid h-[92dvh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] bg-slate-950 p-0 text-white">
          <DialogHeader className="border-b border-white/10 px-5 py-4 pr-16">
            <DialogTitle className="text-white">{label}</DialogTitle>
            <DialogDescription className="text-slate-300">
              {name || "视频预览"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 place-items-center overflow-hidden p-3 sm:p-6">
            {previewUrl ? (
              <video
                aria-label={`${label}放大预览`}
                autoPlay
                className="max-h-full max-w-full object-contain"
                controls
                key={previewUrl}
                playsInline
                src={previewUrl}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OutputAssetLinks({ assets }: { assets: Asset[] }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
      <p className="font-medium text-foreground">结果资产</p>
      {assets.map((asset) => (
        <div className="flex items-center justify-between gap-3" key={asset.id}>
          <span className="truncate text-muted-foreground">{assetName(asset)}</span>
          <a className="shrink-0 font-semibold text-primary hover:underline" href={getAssetDownloadUrl(asset) ?? undefined}>下载</a>
        </div>
      ))}
    </div>
  );
}

function OutputVideo({ asset }: { asset: Asset }) {
  const previewUrl = getSafePreviewUrl(asset);
  return <div className="overflow-hidden rounded-xl border border-border"><div className="aspect-video bg-slate-950">{previewUrl ? <video className="h-full w-full object-contain" controls playsInline preload="metadata" src={previewUrl} /> : null}</div><div className="flex items-center justify-between gap-3 p-3 text-sm"><span className="truncate">{assetName(asset)}</span><a className="shrink-0 font-semibold text-primary hover:underline" href={getAssetDownloadUrl(asset) ?? undefined}>下载</a></div></div>;
}

function TaskSnapshot({ task }: { task: ToolTask }) {
  const entries = Object.entries(task.input_snapshot).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) return null;
  return <dl className="grid gap-x-4 gap-y-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs sm:grid-cols-2">{entries.slice(0, 8).map(([key, value]) => <div key={key}><dt className="text-muted-foreground">{key}</dt><dd className="mt-0.5 break-words text-foreground">{Array.isArray(value) ? `${value.length} 项` : String(value)}</dd></div>)}</dl>;
}

function TaskStatus({ status }: { status: ToolTask["status"] }) {
  const variant = status === "succeeded" ? "success" : status === "failed" ? "destructive" : status === "running" || status === "queued" ? "info" : "secondary";
  return <Badge variant={variant}><CheckCircle2 className="mr-1 h-3 w-3" />{getStatusLabel(status)}</Badge>;
}

function SelectField<T extends string>({ label, onChange, options, value }: { label: string; onChange: (value: T) => void; options: Array<[string, string]>; value: string }) {
  const id = `tool-select-${label}`;
  return <div><Label htmlFor={id}>{label}</Label><select className={cn(selectClassName, "mt-2")} id={id} onChange={(event) => onChange(event.target.value as T)} value={value}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}

function compatibleAssets(assets: Asset[], kind: ReferenceAssetKind): Asset[] {
  return assets.filter((asset) =>
    asset.project_id === null &&
    asset.tool_asset_role != null &&
    asset.mime_type?.startsWith(`${kind}/`)
  );
}

function getDurationError(
  duration: number,
  range: { maximum: number; minimum: number }
): string | null {
  if (!Number.isFinite(duration)) {
    return "请输入时长。";
  }
  if (!Number.isInteger(duration)) {
    return "时长必须为整数秒。";
  }
  if (duration === -1) {
    return null;
  }
  if (duration <= 0) {
    return "时长必须为 -1 或正整数秒。";
  }
  if (duration < range.minimum || duration > range.maximum) {
    return `当前模型仅支持 ${range.minimum}-${range.maximum} 秒。`;
  }
  return null;
}

function constrainDuration(
  value: string,
  range: { maximum: number; minimum: number }
): number {
  const duration = Number(value);
  if (!Number.isFinite(duration)) {
    return range.minimum;
  }
  if (duration === -1) {
    return -1;
  }
  return Math.min(range.maximum, Math.max(range.minimum, Math.round(duration)));
}

function constrainResolution(
  resolution: ToolVideoGenerationRequest["resolution"],
  model: ToolVideoGenerationRequest["model"]
): ToolVideoGenerationRequest["resolution"] {
  const resolutions: readonly ToolVideoGenerationRequest["resolution"][] =
    SEEDANCE_CAPABILITIES[model].resolutions;
  return resolutions.includes(resolution)
    ? resolution
    : SEEDANCE_DEFAULT_RESOLUTION;
}

function uniqueAssetIds(assetIds: string[]): string[] {
  return [...new Set(assetIds)];
}

function videoGenerationOutputEmptyText(task: ToolTask | null): string {
  if (!task) {
    return "选择生成任务后将在这里查看结果视频。";
  }
  if (ACTIVE_STATUSES.has(task.status)) {
    return "任务正在处理，完成后将在这里查看生成结果视频。";
  }
  if (task.status === "failed") {
    return "任务失败，重试后将在这里查看生成结果视频。";
  }
  return "所选任务尚无可播放的输出视频。";
}

function videoGenerationReferenceEmptyText(task: ToolTask | null): string {
  if (!task) {
    return "选择生成任务后将在这里查看参考视频。";
  }
  return "该任务未包含可播放的参考视频。";
}

function referenceKindLabel(kind: ReferenceAssetKind): string {
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  return "音频";
}

function assetSourceLabel(asset: Asset): string {
  return asset.tool_task_id ? "任务产物" : "工具上传";
}

function useToolTaskPolling(
  task: ToolTask | null,
  onTasksChange: PanelProps["onTasksChange"],
  onAssetsChange?: PanelProps["onAssetsChange"]
) {
  useEffect(() => {
    if (!task || !ACTIVE_STATUSES.has(task.status)) return;
    const timer = window.setTimeout(async () => {
      try {
        const nextTask = await apiClient.getToolTask(task.id, { cache: "no-store" });
        replaceTask(onTasksChange, nextTask);
        if (nextTask.status === "succeeded" && onAssetsChange) {
          const nextAssets = await apiClient.listToolAssets({ cache: "no-store" });
          onAssetsChange(nextAssets);
        }
      } catch {
        // Preserve the last persisted state. The explicit refresh control remains available.
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [onAssetsChange, onTasksChange, task]);
}

function replaceTask(setTasks: PanelProps["onTasksChange"], nextTask: ToolTask) {
  setTasks((tasks) => [nextTask, ...tasks.filter((task) => task.id !== nextTask.id)]);
}

function assetName(asset: Asset): string {
  return typeof asset.metadata.name === "string" ? asset.metadata.name : asset.id;
}

function inputVideoAssetForTask(task: ToolTask, assets: Asset[]): Asset | null {
  const inputAssetId = inputVideoAssetIdForTask(task);
  return inputAssetId ? assets.find((asset) => asset.id === inputAssetId) ?? null : null;
}

function inputVideoAssetIdForTask(task: ToolTask): string | null {
  const linkedAssetId = task.input_assets?.find((asset) => asset.kind === "video")?.asset_id;
  if (linkedAssetId) return linkedAssetId;
  const snapshotAssetId = task.input_snapshot.video_asset_id;
  return typeof snapshotAssetId === "string" ? snapshotAssetId : null;
}

function multimodalReferenceVideoAssetIds(task: ToolTask | null): string[] {
  const assetIds = task?.input_snapshot.reference_video_asset_ids;
  return Array.isArray(assetIds)
    ? assetIds.filter((assetId): assetId is string => typeof assetId === "string")
    : [];
}

function multimodalPrompt(task: ToolTask): string {
  const prompt = task.input_snapshot.prompt;
  if (typeof prompt !== "string") return "";
  return prompt.length > 96 ? `${prompt.slice(0, 96)}...` : prompt;
}

function multimodalModelLabel(task: ToolTask): string {
  const model = task.input_snapshot.model;
  if (typeof model !== "string") return "未记录";
  return VIDEO_MODELS.find((item) => item.value === model)?.label ?? "未记录";
}

function maskModeLabel(value: unknown): string {
  if (value === "mosaic") return "马赛克";
  if (value === "blur") return "模糊";
  return "未记录";
}

function maskStrengthLabel(value: unknown): string {
  if (value === "low") return "低";
  if (value === "medium") return "中";
  if (value === "high") return "高";
  return "未记录";
}

function formatTaskTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
