"use client";

import {
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  Eye,
  FileAudio,
  FileVideo,
  ImageIcon,
  LoaderCircle,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getSafePreviewUrl,
  getWorkspaceAssetDescription
} from "@/lib/asset-display";
import type {
  Asset,
  ReferenceAssetKind,
  StoryboardShot,
  StoryboardShotVideoConfig
} from "@/lib/api-types";
import {
  getReferenceLabel,
  getReferencePromptToken,
  insertReferenceAtSelection
} from "@/lib/storyboard-reference";
import {
  FIRST_FRAME_BLOCKS_REFERENCES_MESSAGE,
  getStoryboardVideoInputConflict,
  hasStoryboardFirstFrame,
  hasStoryboardReferenceMedia,
  REFERENCES_BLOCK_FIRST_FRAME_MESSAGE
} from "@/lib/storyboard-video-validation";
import { cn } from "@/lib/utils";

const REFERENCE_KINDS: Array<{
  accept: string;
  label: string;
  kind: ReferenceAssetKind;
}> = [
  { accept: "image/*", kind: "image", label: "参考图" },
  { accept: "video/*", kind: "video", label: "参考视频" },
  { accept: "audio/*", kind: "audio", label: "参考音频" }
];
const PRIMARY_REFERENCE_KIND = REFERENCE_KINDS[0];
const SECONDARY_REFERENCE_KINDS = REFERENCE_KINDS.slice(1);

export interface StoryboardEditorFeedback {
  message: string;
  tone: "error" | "info" | "success";
}

export interface PreviousShotLastFrameOption {
  previewUrl: string | null;
  previousShotIndex: number | null;
  sourceVideoAssetId: string | null;
}

interface StoryboardShotEditorDialogProps {
  assets: Asset[];
  config?: StoryboardShotVideoConfig;
  configLoadError: string | null;
  draftPrompt: string;
  feedback: StoryboardEditorFeedback | null;
  isConfigLoading: boolean;
  isDiscardConfirmOpen: boolean;
  onAttach: (kind: ReferenceAssetKind, assetId: string) => void;
  onChangePrompt: (value: string) => void;
  onConfirmDiscard: () => void;
  onContinueEditing: () => void;
  onClearFirstFrame: () => void;
  onRemove: (kind: ReferenceAssetKind, assetId: string) => void;
  onRequestClose: () => void;
  onRetryConfig: () => void;
  onOptimize: () => void;
  onSave: () => void;
  onSetPreviousShotLastFrame: (sourceVideoAssetId: string) => void;
  onSetFirstFrame: (assetId: string) => void;
  onUpload: (
    kind: ReferenceAssetKind,
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  onUploadFirstFrame: (event: ChangeEvent<HTMLInputElement>) => void;
  open: boolean;
  pendingAction: string | null;
  previousShotLastFrame: PreviousShotLastFrameOption;
  shot: StoryboardShot | null;
}

export function StoryboardShotEditorDialog({
  assets,
  config,
  configLoadError,
  draftPrompt,
  feedback,
  isConfigLoading,
  isDiscardConfirmOpen,
  onAttach,
  onChangePrompt,
  onConfirmDiscard,
  onContinueEditing,
  onClearFirstFrame,
  onRemove,
  onRequestClose,
  onRetryConfig,
  onOptimize,
  onSave,
  onSetPreviousShotLastFrame,
  onSetFirstFrame,
  onUpload,
  onUploadFirstFrame,
  open,
  pendingAction,
  previousShotLastFrame,
  shot
}: StoryboardShotEditorDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{ end: number; start: number } | null>(null);
  const [preview, setPreview] = useState<{
    asset?: Asset;
    description?: string;
    kind: ReferenceAssetKind;
    label: string;
    previewUrl?: string;
  } | null>(null);
  const disabled = pendingAction !== null;

  function rememberSelection() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    selectionRef.current = {
      end: textarea.selectionEnd,
      start: textarea.selectionStart
    };
  }

  function insertReference(kind: ReferenceAssetKind, index: number) {
    const selection = selectionRef.current;
    const result = insertReferenceAtSelection(
      draftPrompt,
      getReferencePromptToken(kind, index),
      selection?.start,
      selection?.end
    );
    onChangePrompt(result.text);
    selectionRef.current = {
      end: result.selectionEnd,
      start: result.selectionStart
    };
    window.setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    }, 0);
  }

  return (
    <>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onRequestClose();
          }
        }}
        open={open}
      >
        <DialogContent
          aria-describedby="storyboard-shot-editor-description"
          className="grid-rows-[auto_minmax(0,1fr)_auto] max-w-[60rem]"
          hideCloseButton
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            onRequestClose();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
            onRequestClose();
          }}
        >
          <div className="border-b border-border bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),transparent_58%)] px-5 py-5 pr-16 sm:px-7">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary">
                  Shot {String(shot?.index ?? 0).padStart(2, "0")} Editor
                </p>
                {shot ? (
                  <Badge variant="secondary">{shot.duration_seconds} 秒</Badge>
                ) : null}
              </div>
              <DialogTitle className="text-xl sm:text-2xl">
                {shot?.title ?? "编辑分镜"}
              </DialogTitle>
              <DialogDescription id="storyboard-shot-editor-description">
                先确认参考素材及其编号，再编辑视频生成提示词。点击素材卡片可在光标处插入引用。
              </DialogDescription>
            </DialogHeader>
            <Button
              aria-label="关闭分镜编辑弹窗"
              className="absolute right-5 top-5 rounded-full"
              disabled={disabled}
              onClick={onRequestClose}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>

          <div
            className="min-h-0 overflow-y-auto overscroll-contain"
            data-testid="storyboard-editor-scroll-region"
          >
            {isConfigLoading ? (
              <div
                className="grid min-h-[26rem] place-items-center px-6 py-12 text-center"
                role="status"
              >
                <div>
                  <LoaderCircle
                    aria-hidden="true"
                    className="mx-auto h-8 w-8 animate-spin text-primary"
                  />
                  <p className="mt-4 text-sm font-medium text-foreground">
                    正在加载最新分镜配置
                  </p>
                </div>
              </div>
            ) : configLoadError ? (
              <div className="grid min-h-[26rem] place-items-center px-6 py-12 text-center">
                <div className="max-w-md">
                  <AlertCircle
                    aria-hidden="true"
                    className="mx-auto h-8 w-8 text-destructive"
                  />
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    分镜配置加载失败
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {configLoadError}
                  </p>
                  <Button
                    className="mt-5"
                    onClick={onRetryConfig}
                    type="button"
                    variant="outline"
                  >
                    重新加载
                  </Button>
                </div>
              </div>
            ) : shot && config ? (
              <div className="space-y-7 px-5 py-6 sm:px-7">
                {feedback ? <EditorNotice {...feedback} /> : null}

                <ReferenceManager
                  assets={assets}
                  config={config}
                  disabled={disabled}
                  onAttach={onAttach}
                  onClearFirstFrame={onClearFirstFrame}
                  onInsertReference={insertReference}
                  onPreview={(kind, label, asset, previewUrl) =>
                    setPreview({
                      asset,
                      description: previewUrl ? "上一分镜视频尾帧" : undefined,
                      kind,
                      label,
                      previewUrl
                    })
                  }
                  onRemove={onRemove}
                  onSetPreviousShotLastFrame={onSetPreviousShotLastFrame}
                  onSetFirstFrame={onSetFirstFrame}
                  onUpload={onUpload}
                  onUploadFirstFrame={onUploadFirstFrame}
                  pendingAction={pendingAction}
                  previousShotLastFrame={previousShotLastFrame}
                />

                <section aria-labelledby="shot-video-prompt-title">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="ad-kicker">Prompt</p>
                      <h3
                        className="mt-1 text-base font-semibold tracking-[-0.02em] text-foreground"
                        id="shot-video-prompt-title"
                      >
                        视频生成提示词
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        点击素材卡片会在光标处插入“(参考@图1)”“(参考@视频1)”等标准引用。
                      </p>
                    </div>
                    <Button
                      aria-label="AI 优化视频生成提示词"
                      disabled={disabled}
                      onClick={onOptimize}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {pendingAction === `optimize:${shot.id}` ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                      ) : (
                        <Sparkles aria-hidden="true" className="h-4 w-4" />
                      )}
                      {pendingAction === `optimize:${shot.id}`
                        ? "优化中"
                        : "AI 优化"}
                    </Button>
                  </div>
                  <Label
                    className="sr-only"
                    htmlFor={`video-prompt-${shot.id}`}
                  >
                    编辑视频生成提示词
                  </Label>
                  <Textarea
                    className="mt-3 min-h-44 resize-y bg-card leading-6"
                    disabled={disabled}
                    id={`video-prompt-${shot.id}`}
                    onChange={(event) => {
                      onChangePrompt(event.target.value);
                      rememberSelection();
                    }}
                    onClick={rememberSelection}
                    onKeyUp={rememberSelection}
                    onSelect={rememberSelection}
                    ref={textareaRef}
                    value={draftPrompt}
                  />
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    未保存自定义提示词时，系统会基于画面描述、视觉提示词、旁白和时长提供默认提示词。
                  </p>
                </section>
              </div>
            ) : null}
          </div>

          {!isConfigLoading && !configLoadError && shot && config ? (
            <div className="border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-7">
              <DialogFooter>
                <Button
                  disabled={disabled}
                  onClick={onRequestClose}
                  type="button"
                  variant="ghost"
                >
                  取消
                </Button>
                <Button
                  disabled={disabled}
                  onClick={onSave}
                  type="button"
                >
                  {pendingAction === `save:${shot.id}` ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin"
                    />
                  ) : (
                    <Save aria-hidden="true" className="h-4 w-4" />
                  )}
                  保存提示词
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ReferenceAssetPreviewDialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPreview(null);
          }
        }}
        preview={preview}
      />

      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            onContinueEditing();
          }
        }}
        open={isDiscardConfirmOpen}
      >
        <DialogContent className="max-w-md" hideCloseButton>
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>提示词尚未保存</DialogTitle>
              <DialogDescription>
                关闭后将丢弃本次提示词修改，已经上传或关联的参考素材会保留。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6">
              <Button
                onClick={onContinueEditing}
                type="button"
                variant="ghost"
              >
                继续编辑
              </Button>
              <Button
                onClick={onConfirmDiscard}
                type="button"
                variant="destructive"
              >
                放弃修改
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReferenceManager({
  assets,
  config,
  disabled,
  onAttach,
  onClearFirstFrame,
  onInsertReference,
  onPreview,
  onRemove,
  onSetPreviousShotLastFrame,
  onSetFirstFrame,
  onUpload,
  onUploadFirstFrame,
  pendingAction,
  previousShotLastFrame
}: {
  assets: Asset[];
  config: StoryboardShotVideoConfig;
  disabled: boolean;
  onAttach: (kind: ReferenceAssetKind, assetId: string) => void;
  onClearFirstFrame: () => void;
  onInsertReference: (kind: ReferenceAssetKind, index: number) => void;
  onPreview: (
    kind: ReferenceAssetKind,
    label: string,
    asset?: Asset,
    previewUrl?: string
  ) => void;
  onRemove: (kind: ReferenceAssetKind, assetId: string) => void;
  onSetPreviousShotLastFrame: (sourceVideoAssetId: string) => void;
  onSetFirstFrame: (assetId: string) => void;
  onUpload: (
    kind: ReferenceAssetKind,
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  onUploadFirstFrame: (event: ChangeEvent<HTMLInputElement>) => void;
  pendingAction: string | null;
  previousShotLastFrame: PreviousShotLastFrameOption;
}) {
  const assetById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets]
  );
  const hasFirstFrame = hasStoryboardFirstFrame(config);
  const hasReferenceMedia = hasStoryboardReferenceMedia(config);
  const inputConflict = getStoryboardVideoInputConflict(config);

  return (
    <section aria-labelledby="shot-references-title">
      <div>
        <p className="ad-kicker">References</p>
        <h3
          className="mt-1 text-base font-semibold tracking-[-0.02em] text-foreground"
          id="shot-references-title"
        >
          参考素材
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          点击卡片插入引用；使用眼睛按钮打开完整预览。
        </p>
      </div>

      {inputConflict ? (
        <div
          className="mt-4 rounded-xl border border-destructive/25 bg-destructive/[0.07] px-3 py-2.5 text-xs leading-5 text-destructive"
          role="alert"
        >
          {inputConflict}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        <ReferenceKindSection
          actionsDisabled={disabled}
          addDisabled={disabled || hasFirstFrame}
          addDisabledMessage={
            hasFirstFrame ? FIRST_FRAME_BLOCKS_REFERENCES_MESSAGE : null
          }
          assetById={assetById}
          assets={assets}
          config={config}
          definition={PRIMARY_REFERENCE_KIND}
          onAttach={onAttach}
          onInsertReference={onInsertReference}
          onPreview={onPreview}
          onRemove={onRemove}
          onUpload={onUpload}
          pendingAction={pendingAction}
        />

        <FirstFrameSection
          actionsDisabled={disabled}
          assetById={assetById}
          assets={assets}
          config={config}
          onClear={onClearFirstFrame}
          onPreview={(asset) => onPreview("image", "首帧", asset)}
          onPreviewPrevious={() =>
            onPreview(
              "image",
              "上一分镜尾帧",
              undefined,
              previousShotLastFrame.previewUrl ?? undefined
            )
          }
          onSetPrevious={onSetPreviousShotLastFrame}
          onSet={onSetFirstFrame}
          onUpload={onUploadFirstFrame}
          pendingAction={pendingAction}
          previousShotLastFrame={previousShotLastFrame}
          selectionDisabled={disabled || hasReferenceMedia}
          selectionDisabledMessage={
            hasReferenceMedia ? REFERENCES_BLOCK_FIRST_FRAME_MESSAGE : null
          }
        />

        <details
          className="group overflow-hidden rounded-2xl border border-border bg-secondary/20"
          key={config.shot_id}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25">
            <span>
              <span className="block text-sm font-semibold text-foreground">
                其他参考素材
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                参考视频 {config.reference_video_asset_ids.length} · 参考音频{" "}
                {config.reference_audio_asset_ids.length}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-primary">
              管理
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="grid gap-4 border-t border-border p-4">
            {SECONDARY_REFERENCE_KINDS.map((definition) => (
              <ReferenceKindSection
                actionsDisabled={disabled}
                addDisabled={disabled || hasFirstFrame}
                addDisabledMessage={
                  hasFirstFrame
                    ? FIRST_FRAME_BLOCKS_REFERENCES_MESSAGE
                    : null
                }
                assetById={assetById}
                assets={assets}
                config={config}
                definition={definition}
                key={definition.kind}
                onAttach={onAttach}
                onInsertReference={onInsertReference}
                onPreview={onPreview}
                onRemove={onRemove}
                onUpload={onUpload}
                pendingAction={pendingAction}
              />
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

function ReferenceKindSection({
  actionsDisabled,
  addDisabled,
  addDisabledMessage,
  assetById,
  assets,
  config,
  definition,
  onAttach,
  onInsertReference,
  onPreview,
  onRemove,
  onUpload,
  pendingAction
}: {
  actionsDisabled: boolean;
  addDisabled: boolean;
  addDisabledMessage: string | null;
  assetById: Map<string, Asset>;
  assets: Asset[];
  config: StoryboardShotVideoConfig;
  definition: (typeof REFERENCE_KINDS)[number];
  onAttach: (kind: ReferenceAssetKind, assetId: string) => void;
  onInsertReference: (kind: ReferenceAssetKind, index: number) => void;
  onPreview: (
    kind: ReferenceAssetKind,
    label: string,
    asset?: Asset
  ) => void;
  onRemove: (kind: ReferenceAssetKind, assetId: string) => void;
  onUpload: (
    kind: ReferenceAssetKind,
    event: ChangeEvent<HTMLInputElement>
  ) => void;
  pendingAction: string | null;
}) {
  const selectedIds = getReferenceIds(config, definition.kind);
  const selectedIdSet = new Set(selectedIds);
  const candidates = assets.filter(
    (asset) =>
      isAssetCompatibleWithKind(asset, definition.kind) &&
      !selectedIdSet.has(asset.id)
  );

  return (
    <div className="rounded-2xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ReferenceIcon kind={definition.kind} />
          <h4 className="text-sm font-semibold text-foreground">
            {definition.label}
          </h4>
          <Badge variant="secondary">{selectedIds.length}</Badge>
        </div>
        <label
          aria-disabled={addDisabled}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition",
            addDisabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:border-primary/25 hover:bg-primary/[0.035]"
          )}
        >
          <Upload aria-hidden="true" className="h-3.5 w-3.5" />
          上传本地{definition.label}
          <input
            accept={definition.accept}
            aria-label={`上传本地${definition.label}`}
            className="sr-only"
            disabled={addDisabled}
            onChange={(event) => onUpload(definition.kind, event)}
            type="file"
          />
        </label>
      </div>

      {addDisabledMessage ? (
        <p className="mt-2 text-xs leading-5 text-amber-700">
          {addDisabledMessage}
        </p>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className={cn(
          "mt-3 grid gap-3",
          definition.kind === "image"
            ? "sm:grid-cols-3 lg:grid-cols-4"
            : "sm:grid-cols-2 lg:grid-cols-3"
        )}>
          {selectedIds.map((assetId, index) => {
            const label = getReferenceLabel(definition.kind, index);
            const asset = assetById.get(assetId);
            return (
              <ReferenceAssetCard
                asset={asset}
                assetId={assetId}
                disabled={actionsDisabled}
                key={assetId}
                kind={definition.kind}
                label={label}
                onInsert={() => onInsertReference(definition.kind, index)}
                onPreview={() => onPreview(definition.kind, label, asset)}
                onRemove={() => onRemove(definition.kind, assetId)}
                pending={
                  pendingAction === `remove:${definition.kind}:${assetId}`
                }
              />
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-card/70 px-3 py-3 text-xs text-muted-foreground">
          当前分镜尚未关联{definition.label}。
        </p>
      )}

      <AssetPicker
        assets={candidates}
        disabled={addDisabled}
        kind={definition.kind}
        onAttach={onAttach}
        pendingAction={pendingAction}
      />
    </div>
  );
}

function FirstFrameSection({
  actionsDisabled,
  assetById,
  assets,
  config,
  onClear,
  onPreview,
  onPreviewPrevious,
  onSetPrevious,
  onSet,
  onUpload,
  pendingAction,
  previousShotLastFrame,
  selectionDisabled,
  selectionDisabledMessage
}: {
  actionsDisabled: boolean;
  assetById: Map<string, Asset>;
  assets: Asset[];
  config: StoryboardShotVideoConfig;
  onClear: () => void;
  onPreview: (asset?: Asset) => void;
  onPreviewPrevious: () => void;
  onSetPrevious: (sourceVideoAssetId: string) => void;
  onSet: (assetId: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  pendingAction: string | null;
  previousShotLastFrame: PreviousShotLastFrameOption;
  selectionDisabled: boolean;
  selectionDisabledMessage: string | null;
}) {
  const asset = config.first_frame_asset_id
    ? assetById.get(config.first_frame_asset_id)
    : undefined;
  const candidates = assets.filter(
    (item) =>
      isAssetCompatibleWithKind(item, "image") &&
      item.id !== config.first_frame_asset_id
  );
  const description = asset
    ? getWorkspaceAssetDescription(asset)
    : config.first_frame_source_video_asset_id
      ? "上一分镜视频尾帧"
      : "当前分镜尚未指定首帧";
  const previousFrameSelected = Boolean(
    previousShotLastFrame.sourceVideoAssetId &&
      config.first_frame_source_video_asset_id ===
        previousShotLastFrame.sourceVideoAssetId
  );
  const previousFrameAvailable = Boolean(
    previousShotLastFrame.sourceVideoAssetId &&
      previousShotLastFrame.previewUrl
  );
  const hasFirstFrame = Boolean(
    config.first_frame_asset_id ||
      config.first_frame_source_video_asset_id
  );

  return (
    <div className="rounded-2xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon aria-hidden="true" className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">首帧</h4>
            <Badge variant="secondary">
              {hasFirstFrame ? "已指定" : "未指定"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            控制视频起始画面，不参与参考图编号。
          </p>
        </div>
        <label className={cn(
          "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-input bg-card px-3 text-xs font-semibold",
          selectionDisabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer"
        )}>
          <Upload aria-hidden="true" className="h-3.5 w-3.5" />
          上传本地首帧
          <input
            accept="image/*"
            aria-label="上传本地首帧"
            className="sr-only"
            disabled={selectionDisabled}
            onChange={onUpload}
            type="file"
          />
        </label>
      </div>
      {selectionDisabledMessage ? (
        <p className="mt-2 text-xs leading-5 text-amber-700">
          {selectionDisabledMessage}
        </p>
      ) : null}
      <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">
              上一分镜尾帧
            </p>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              {previousShotLastFrame.previousShotIndex === null
                ? "当前为第一分镜，无上一分镜。"
                : previousFrameAvailable
                  ? `来自分镜 ${previousShotLastFrame.previousShotIndex}`
                  : `分镜 ${previousShotLastFrame.previousShotIndex} 暂无可用尾帧。`}
            </p>
          </div>
          {previousFrameSelected ? (
            <Badge variant="secondary">当前首帧</Badge>
          ) : null}
        </div>
        {previousFrameAvailable ? (
          <div className="mt-3 flex items-center gap-3">
            <button
              aria-label="预览上一分镜尾帧"
              className="overflow-hidden rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              onClick={onPreviewPrevious}
              type="button"
            >
              {/* Backend-proxied companion image URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="上一分镜尾帧缩略图"
                className="h-20 w-32 bg-secondary object-cover"
                src={previousShotLastFrame.previewUrl ?? undefined}
              />
            </button>
            <Button
              disabled={selectionDisabled || previousFrameSelected}
              onClick={() =>
                onSetPrevious(previousShotLastFrame.sourceVideoAssetId!)
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {pendingAction ===
              `first-frame:set-previous:${previousShotLastFrame.sourceVideoAssetId}` ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {previousFrameSelected ? "已设为首帧" : "设为首帧"}
            </Button>
          </div>
        ) : null}
      </div>
      {hasFirstFrame ? (
        <article className="mt-3 w-full overflow-hidden rounded-xl border border-border bg-card sm:w-[calc(33.333%-0.5rem)] lg:w-[calc(25%-0.75rem)]">
          <ReferenceThumbnail
            compact
            description={description}
            kind="image"
            onError={() => undefined}
            previewUrl={
              asset
                ? getSafePreviewUrl(asset)
                : previousShotLastFrame.previewUrl
            }
          />
          <div className="flex items-center gap-2 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-xs font-medium">{description}</p>
            <Button aria-label={`预览首帧 ${description}`} onClick={asset ? () => onPreview(asset) : onPreviewPrevious} size="icon" type="button" variant="ghost">
              <Eye aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button aria-label="移除首帧" disabled={actionsDisabled} onClick={onClear} size="icon" type="button" variant="ghost">
              {pendingAction === "first-frame:clear" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </article>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-card/70 px-3 py-3 text-xs text-muted-foreground">
          {description}
        </p>
      )}
      <AssetPicker
        assets={candidates}
        compact
        disabled={selectionDisabled}
        kind="image"
        label="首帧"
        onAttach={(_kind, assetId) => onSet(assetId)}
        pendingAction={pendingAction}
      />
    </div>
  );
}

function ReferenceAssetCard({
  asset,
  assetId,
  disabled,
  kind,
  label,
  onInsert,
  onPreview,
  onRemove,
  pending
}: {
  asset?: Asset;
  assetId: string;
  disabled: boolean;
  kind: ReferenceAssetKind;
  label: string;
  onInsert: () => void;
  onPreview: () => void;
  onRemove: () => void;
  pending: boolean;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewUrl = asset ? getSafePreviewUrl(asset) : null;
  const description = asset ? getWorkspaceAssetDescription(asset) : assetId;
  const canPreview = Boolean(previewUrl) && !previewFailed;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md">
      <button
        aria-label={`插入引用 ${label} ${description}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={onInsert}
        type="button"
      >
        <ReferenceThumbnail
          compact={kind === "image"}
          description={description}
          kind={kind}
          onError={() => setPreviewFailed(true)}
          previewUrl={canPreview ? previewUrl : null}
        />
        <div className="px-3 pb-12 pt-3">
          <p className="font-mono text-[0.67rem] font-semibold tracking-[0.08em] text-primary">
            {label}
          </p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {description}
          </p>
          <p className="mt-1 text-[0.67rem] text-muted-foreground">
            点击卡片插入引用
          </p>
        </div>
      </button>
      <div className="absolute bottom-2.5 right-2.5 flex gap-1">
        <Button
          aria-label={`预览参考素材 ${label} ${description}`}
          disabled={disabled || !canPreview}
          onClick={onPreview}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Eye aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          aria-label={`移除参考素材 ${description}`}
          disabled={disabled}
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          {pending ? (
            <LoaderCircle
              aria-hidden="true"
              className="h-4 w-4 animate-spin"
            />
          ) : (
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          )}
        </Button>
      </div>
    </article>
  );
}

function ReferenceThumbnail({
  compact = false,
  description,
  kind,
  onError,
  previewUrl
}: {
  compact?: boolean;
  description: string;
  kind: ReferenceAssetKind;
  onError: () => void;
  previewUrl: string | null;
}) {
  if (kind === "image" && previewUrl) {
    return (
      // User-provided asset URLs are dynamic and may be signed by the backend.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`${description} 缩略图`}
        className={cn(compact ? "h-20" : "aspect-video", "w-full bg-secondary object-cover")}
        onError={onError}
        src={previewUrl}
      />
    );
  }

  if (kind === "video" && previewUrl) {
    return (
      <video
        aria-label={`${description} 视频缩略图`}
        className="aspect-video w-full bg-slate-950 object-cover"
        muted
        onError={onError}
        playsInline
        preload="metadata"
        src={previewUrl}
      />
    );
  }

  return (
    <div className={cn("grid place-items-center bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.16),transparent_68%),hsl(var(--secondary)/0.7)]", compact ? "h-20" : "aspect-video")}>
      <ReferenceIcon kind={kind} large />
      <span className="sr-only">{description} 暂无缩略图</span>
    </div>
  );
}

function ReferenceAssetPreviewDialog({
  onOpenChange,
  preview
}: {
  onOpenChange: (open: boolean) => void;
  preview: {
    asset?: Asset;
    description?: string;
    kind: ReferenceAssetKind;
    label: string;
    previewUrl?: string;
  } | null;
}) {
  const [failed, setFailed] = useState(false);
  const previewUrl =
    preview?.previewUrl ??
    (preview?.asset ? getSafePreviewUrl(preview.asset) : null);
  const description =
    preview?.description ??
    (preview?.asset
      ? getWorkspaceAssetDescription(preview.asset)
      : "参考素材");

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFailed(false);
    }
    onOpenChange(open);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={preview !== null}>
      <DialogContent className="max-w-4xl">
        <div className="border-b border-border px-6 py-5 pr-16">
          <DialogHeader>
            <DialogTitle>
              {preview?.label ?? "参考素材"} · {description}
            </DialogTitle>
            <DialogDescription>
              预览仅用于确认素材内容，不会修改提示词。
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="grid min-h-[20rem] place-items-center overflow-auto bg-secondary/30 p-5 sm:p-8">
          {!previewUrl || failed ? (
            <div className="text-center">
              <AlertCircle
                aria-hidden="true"
                className="mx-auto h-8 w-8 text-muted-foreground"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                当前素材暂无法预览。
              </p>
            </div>
          ) : preview?.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${description} 完整预览`}
              className="max-h-[65dvh] max-w-full rounded-xl object-contain shadow-lg"
              onError={() => setFailed(true)}
              src={previewUrl}
            />
          ) : preview?.kind === "video" ? (
            <video
              aria-label={`${description} 完整视频预览`}
              className="max-h-[65dvh] max-w-full rounded-xl bg-black shadow-lg"
              controls
              onError={() => setFailed(true)}
              src={previewUrl}
            >
              当前浏览器不支持视频预览。
            </video>
          ) : (
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
              <FileAudio
                aria-hidden="true"
                className="mx-auto h-10 w-10 text-primary"
              />
              <p className="mt-3 text-sm font-medium text-foreground">
                {description}
              </p>
              <audio
                aria-label={`${description} 音频预览`}
                className="mt-5 w-full"
                controls
                onError={() => setFailed(true)}
                src={previewUrl}
              >
                当前浏览器不支持音频预览。
              </audio>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetPicker({
  assets,
  compact = false,
  disabled,
  kind,
  label,
  onAttach,
  pendingAction
}: {
  assets: Asset[];
  compact?: boolean;
  disabled: boolean;
  kind: ReferenceAssetKind;
  label?: string;
  onAttach: (kind: ReferenceAssetKind, assetId: string) => void;
  pendingAction: string | null;
}) {
  if (assets.length === 0) {
    return (
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        资产库暂无可选{label ?? kindLabel(kind)}。
      </p>
    );
  }

  return (
    <details className="group mt-3 rounded-xl border border-border bg-card/70">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20">
        <span className="flex items-center justify-between gap-3">
          <span>从资产库选择{label ?? kindLabel(kind)}</span>
          <span className="font-mono text-[0.65rem] text-primary">
            {assets.length} 个可选
          </span>
        </span>
      </summary>
      <div className={cn("grid gap-3 border-t border-border p-3", compact || kind === "image" ? "sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {assets.map((asset) => (
          <AssetCandidateCard
            asset={asset}
            disabled={disabled}
            key={asset.id}
            kind={kind}
            compact={compact || kind === "image"}
            onSelect={() => onAttach(kind, asset.id)}
            pending={pendingAction === `attach:${kind}:${asset.id}`}
          />
        ))}
      </div>
    </details>
  );
}

function AssetCandidateCard({
  asset,
  compact,
  disabled,
  kind,
  onSelect,
  pending
}: {
  asset: Asset;
  compact: boolean;
  disabled: boolean;
  kind: ReferenceAssetKind;
  onSelect: () => void;
  pending: boolean;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewUrl = getSafePreviewUrl(asset);
  const description = getWorkspaceAssetDescription(asset);

  return (
    <button
      aria-label={`选择资产 ${description}`}
      className="group overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <ReferenceThumbnail
        compact={compact}
        description={description}
        kind={kind}
        onError={() => setPreviewFailed(true)}
        previewUrl={previewFailed ? null : previewUrl}
      />
      <span className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-foreground">
            {description}
          </span>
          <span className="mt-0.5 block text-[0.66rem] text-muted-foreground">
            {asset.mime_type ?? kindLabel(kind)}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-primary">
          {pending ? "关联中" : "选择"}
        </span>
      </span>
    </button>
  );
}

function EditorNotice({ message, tone }: StoryboardEditorFeedback) {
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

function ReferenceIcon({
  kind,
  large = false
}: {
  kind: ReferenceAssetKind;
  large?: boolean;
}) {
  const className = large ? "h-8 w-8 text-primary" : "h-4 w-4 text-primary";

  if (kind === "image") {
    return <ImageIcon aria-hidden="true" className={className} />;
  }

  if (kind === "video") {
    return <FileVideo aria-hidden="true" className={className} />;
  }

  return <FileAudio aria-hidden="true" className={className} />;
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

function isAssetCompatibleWithKind(
  asset: Asset,
  kind: ReferenceAssetKind
): boolean {
  if (asset.status !== "succeeded") {
    return false;
  }

  if (kind === "image") {
    return asset.type === "uploaded_image" || asset.type === "generated_image";
  }

  if (kind === "video") {
    return (
      asset.type === "uploaded_video" ||
      asset.type === "storyboard_video" ||
      asset.type === "final_video"
    );
  }

  return asset.type === "uploaded_audio";
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
