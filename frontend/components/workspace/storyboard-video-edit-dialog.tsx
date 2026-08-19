"use client";

import {
  AlertCircle,
  LoaderCircle,
  Maximize2,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
  WandSparkles
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import type { Asset, Brief, StoryboardShot } from "@/lib/api-types";
import { getSafePreviewUrl } from "@/lib/asset-display";
import type { ComparisonVersion } from "@/lib/storyboard-video-versions";
import { cn } from "@/lib/utils";

export interface VideoEditFeedback {
  message: string;
  tone: "error" | "info";
}

export function StoryboardVideoEditDialog({
  aspectRatio,
  asset,
  feedback,
  isSubmitting,
  onOpenChange,
  onPromptChange,
  onSubmit,
  open,
  prompt,
  shot
}: {
  aspectRatio: Brief["aspect_ratio"];
  asset: Asset | null;
  feedback: VideoEditFeedback | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onPromptChange: (prompt: string) => void;
  onSubmit: () => void;
  open: boolean;
  prompt: string;
  shot: StoryboardShot | null;
}) {
  const previewUrl = asset ? getSafePreviewUrl(asset) : null;
  const [aspectWidth, aspectHeight] = aspectRatio.split(":").map(Number);
  const isPortrait = aspectHeight > aspectWidth;
  const cssAspectRatio = `${aspectWidth} / ${aspectHeight}`;
  const portraitPreviewMaxWidth = `min(100%, calc(52dvh * ${aspectWidth} / ${aspectHeight}))`;

  return (
    <Dialog onOpenChange={(next) => !isSubmitting && onOpenChange(next)} open={open}>
      <DialogContent
        className={cn(
          "grid h-[min(92dvh,60rem)] grid-rows-[auto_minmax(0,1fr)_auto]",
          isPortrait ? "max-w-4xl" : "max-w-6xl"
        )}
      >
        <DialogHeader className="border-b border-border px-5 py-4 pr-16 sm:px-6">
          <DialogTitle>编辑当前分镜视频</DialogTitle>
          <DialogDescription>
            {shot
              ? `镜头 ${String(shot.index).padStart(2, "0")} · ${
                  shot.title ?? "未命名镜头"
                }`
              : "基于当前视频生成一个独立编辑候选。"}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "grid min-h-0 items-start gap-5 overflow-y-auto p-5 sm:p-6",
            !isPortrait &&
              "lg:grid-cols-[minmax(20rem,1.15fr)_minmax(20rem,0.85fr)]"
          )}
        >
          <section className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">当前版本</p>
            <div
              className="mx-auto mt-2 grid w-full place-items-center overflow-hidden rounded-lg border border-border bg-slate-950"
              data-testid="storyboard-video-edit-preview-frame"
              style={{
                aspectRatio: cssAspectRatio,
                maxWidth: isPortrait ? portraitPreviewMaxWidth : "100%"
              }}
            >
              {previewUrl ? (
                <video
                  aria-label="待编辑的当前分镜视频"
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                  src={previewUrl}
                />
              ) : (
                <p className="px-4 text-center text-sm text-slate-300">
                  当前视频暂不可预览
                </p>
              )}
            </div>
          </section>

          <section
            className={cn(
              "min-w-0",
              !isPortrait && "lg:flex lg:min-h-full lg:flex-col"
            )}
          >
            <label
              className="text-sm font-semibold text-foreground"
              htmlFor="storyboard-video-edit-prompt"
            >
              编辑指令
            </label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              说明需要改变的画面、动作、节奏或镜头表现。未提及的主体与叙事将尽量保持。
            </p>
            <textarea
              className={cn(
                "mt-3 min-h-44 w-full resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:opacity-60",
                !isPortrait && "lg:min-h-0 lg:flex-1"
              )}
              disabled={isSubmitting}
              id="storyboard-video-edit-prompt"
              maxLength={4000}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="例如：增强产品特写，保持人物动作连续；结尾推近产品标识。"
              value={prompt}
            />
            <div className="mt-1 flex justify-end text-xs text-muted-foreground">
              {prompt.length} / 4000
            </div>

            {feedback ? (
              <div
                className={
                  feedback.tone === "error"
                    ? "mt-3 flex gap-2 rounded-lg border border-destructive/20 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive"
                    : "mt-3 flex gap-2 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-sm text-primary"
                }
                role={feedback.tone === "error" ? "alert" : "status"}
              >
                {feedback.tone === "error" ? (
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <LoaderCircle
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 animate-spin"
                  />
                )}
                <span>{feedback.message}</span>
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            取消
          </Button>
          <Button
            disabled={isSubmitting || !prompt.trim() || !previewUrl}
            onClick={onSubmit}
            type="button"
          >
            {isSubmitting ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <WandSparkles aria-hidden="true" className="h-4 w-4" />
            )}
            {isSubmitting ? "正在生成编辑候选" : "生成编辑候选"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StoryboardVideoComparisonDialog({
  aspectRatio,
  highlightAssetId,
  isSelecting,
  onClose,
  onContinueEdit,
  onSelectVersion,
  open,
  shot,
  versions
}: {
  aspectRatio: string;
  highlightAssetId: string | null;
  isSelecting: boolean;
  onClose: () => void;
  onContinueEdit: () => void;
  onSelectVersion: (assetId: string) => void;
  open: boolean;
  shot: StoryboardShot | null;
  versions: ComparisonVersion[];
}) {
  const hasVersions = versions.length > 0;

  return (
    <Dialog onOpenChange={(next) => !next && !isSelecting && onClose()} open={open}>
      <DialogContent
        className="grid h-[min(92dvh,58rem)] max-w-[96rem] grid-rows-[auto_minmax(0,1fr)_auto] bg-slate-950 text-white"
        hideCloseButton={isSelecting}
      >
        <DialogHeader className="border-b border-white/10 px-5 py-4 pr-16 sm:px-6">
          <DialogTitle className="text-white">视频版本对比</DialogTitle>
          <DialogDescription className="line-clamp-2 text-slate-300">
            {shot
              ? `镜头 ${String(shot.index).padStart(2, "0")} · ${
                  shot.title ?? "未命名镜头"
                } · 共 ${versions.length} 个版本，可逐个播放并设为当前`
              : "该分镜的原视频与历史编辑版本，可逐个播放并设为当前。"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
          {hasVersions ? (
            <VideoComparisonBoard
              aspectRatio={aspectRatio}
              highlightAssetId={highlightAssetId}
              isSelecting={isSelecting}
              onSelectVersion={onSelectVersion}
              versions={versions}
            />
          ) : (
            <div
              className="grid h-full min-h-72 place-items-center rounded-lg border border-red-400/30 bg-red-950/20 text-center text-sm text-red-200"
              role="alert"
            >
              暂无可预览的视频版本，请关闭后刷新项目再试。
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-slate-400">
            选择「设为当前」不会删除其他版本，全部版本都会保留在资产库。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={isSelecting}
              onClick={onContinueEdit}
              type="button"
              variant="secondary"
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
              继续编辑
            </Button>
            <Button
              disabled={isSelecting}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const FRAME_MAX_HEIGHT = "min(58dvh, 34rem)";

function parseAspectRatio(value: string): { width: number; height: number } {
  const [width, height] = value.split(/[:/]/).map((part) => Number(part.trim()));
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }
  return { width: 16, height: 9 };
}

function VideoComparisonBoard({
  aspectRatio,
  highlightAssetId,
  isSelecting,
  onSelectVersion,
  versions
}: {
  aspectRatio: string;
  highlightAssetId: string | null;
  isSelecting: boolean;
  onSelectVersion: (assetId: string) => void;
  versions: ComparisonVersion[];
}) {
  const cards = versions.map((version, index) => {
    const editSequence =
      version.kind === "edit"
        ? versions
            .slice(0, index + 1)
            .filter((item) => item.kind === "edit").length
        : 0;
    return {
      version,
      label: version.kind === "original" ? "原视频" : `编辑版 · ${editSequence}`,
      tag: version.kind === "original" ? "原视频" : `编辑版 ${editSequence}`
    };
  });

  const gridClass =
    versions.length <= 1
      ? "grid-cols-1"
      : versions.length === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div
      className={cn(
        "mx-auto grid h-full max-w-[92rem] items-start gap-3 grid-cols-1",
        gridClass
      )}
    >
      {cards.map(({ label, tag, version }) => (
        <VersionCard
          fallbackAspectRatio={aspectRatio}
          isHighlighted={version.assetId === highlightAssetId}
          isSelecting={isSelecting}
          key={version.assetId}
          label={label}
          onSelect={() => onSelectVersion(version.assetId)}
          tag={tag}
          version={version}
        />
      ))}
    </div>
  );
}

function VersionCard({
  fallbackAspectRatio,
  isHighlighted,
  isSelecting,
  label,
  onSelect,
  tag,
  version
}: {
  fallbackAspectRatio: string;
  isHighlighted: boolean;
  isSelecting: boolean;
  label: string;
  onSelect: () => void;
  tag: string;
  version: ComparisonVersion;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isHighlighted]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-xl border p-2.5 transition",
        version.isCurrent
          ? "border-blue-400/70 bg-blue-500/[0.08]"
          : isHighlighted
            ? "border-emerald-400/70 bg-emerald-500/[0.08]"
            : "border-white/10 bg-white/[0.02]"
      )}
      ref={cardRef}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <strong className="text-sm text-white">{label}</strong>
          {version.isCurrent ? (
            <span className="rounded bg-blue-500/25 px-2 py-0.5 text-[0.65rem] font-semibold text-blue-100">
              当前版本
            </span>
          ) : null}
          {isHighlighted && !version.isCurrent ? (
            <span className="rounded bg-emerald-500/25 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-100">
              最新
            </span>
          ) : null}
        </div>
      </div>

      <ComparisonVideoPlayer
        defaultMuted={version.kind === "original"}
        fallbackAspectRatio={fallbackAspectRatio}
        label={label}
        src={version.url}
        tag={tag}
      />

      {version.kind === "edit" && version.editPrompt ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
          编辑指令：{version.editPrompt}
        </p>
      ) : null}

      <button
        aria-label={version.isCurrent ? `${label}为当前版本` : `将${label}设为当前`}
        className={cn(
          "mt-2 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed",
          version.isCurrent
            ? "bg-white/10 text-slate-300 disabled:opacity-100"
            : "bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
        )}
        disabled={isSelecting || version.isCurrent}
        onClick={onSelect}
        type="button"
      >
        {isSelecting && !version.isCurrent ? (
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : null}
        {version.isCurrent ? "当前版本" : "设为当前"}
      </button>
    </div>
  );
}

function ComparisonVideoPlayer({
  defaultMuted = false,
  fallbackAspectRatio,
  label,
  src,
  tag
}: {
  defaultMuted?: boolean;
  fallbackAspectRatio: string;
  label: string;
  src: string;
  tag: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAfterSeekRef = useRef(false);
  const [ratio, setRatio] = useState(() => parseAspectRatio(fallbackAspectRatio));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(defaultMuted);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.readyState < 3) {
      setIsWaiting(true);
      setHasError(false);
      video.load();
      return;
    }
    try {
      await video.play();
      setIsPlaying(true);
      setIsWaiting(false);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      void play();
    }
  }, [isPlaying, pause, play]);

  const handleMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      setDuration(video.duration);
    }
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setRatio({ width: video.videoWidth, height: video.videoHeight });
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime);
  }, []);

  const handleSeek = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  }, []);

  const handleWaiting = useCallback(() => {
    if (isPlaying) setIsWaiting(true);
  }, [isPlaying]);

  const handlePlaying = useCallback(() => {
    setIsWaiting(false);
    setIsPlaying(true);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleError = useCallback(() => {
    setIsPlaying(false);
    setIsWaiting(false);
    setHasError(true);
  }, []);

  const reload = useCallback(() => {
    setHasError(false);
    setIsWaiting(true);
    setIsPlaying(false);
    videoRef.current?.load();
  }, []);

  return (
    <section className="flex min-h-0 flex-col">
      <div
        className="relative mx-auto grid min-h-0 place-items-center overflow-hidden rounded-lg border border-white/15 bg-black"
        ref={frameRef}
        style={{
          aspectRatio: `${ratio.width} / ${ratio.height}`,
          maxHeight: FRAME_MAX_HEIGHT,
          width: `min(100%, calc(${FRAME_MAX_HEIGHT} * ${ratio.width} / ${ratio.height}))`
        }}
      >
        <video
          aria-label={label}
          className="h-full w-full object-contain"
          controlsList="nodownload"
          muted={isMuted}
          onCanPlay={() => setIsWaiting(false)}
          onEnded={handleEnded}
          onError={handleError}
          onLoadedMetadata={handleMetadata}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPlaying={handlePlaying}
          onTimeUpdate={handleTimeUpdate}
          onWaiting={handleWaiting}
          playsInline
          preload="metadata"
          ref={videoRef}
          src={src}
        />
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[0.65rem] font-semibold text-white">
          {tag}
        </span>
        {hasError ? (
          <span className="absolute inset-0 grid place-items-center bg-red-950/75 px-4 text-center text-sm text-red-100">
            视频暂时无法加载
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <strong className="text-sm text-white">{label}</strong>
        <span className="text-xs text-slate-400">720p</span>
      </div>

      <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.05] p-2.5">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_5.5rem_2.25rem_2.25rem] items-center gap-2">
          <button
            aria-label={isPlaying ? `暂停${label}` : `播放${label}`}
            className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50"
            disabled={hasError}
            onClick={togglePlayback}
            title={isPlaying ? "暂停" : "播放"}
            type="button"
          >
            {isPlaying ? (
              <Pause aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Play aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
          <input
            aria-label={`${label}播放进度`}
            className="h-1.5 w-full cursor-pointer accent-blue-500"
            max={duration || 0}
            min={0}
            onChange={(event) => handleSeek(Number(event.target.value))}
            onPointerDown={() => {
              resumeAfterSeekRef.current = isPlaying;
              pause();
            }}
            onPointerUp={() => {
              if (resumeAfterSeekRef.current) void play();
            }}
            step={0.01}
            type="range"
            value={Math.min(currentTime, duration || 0)}
          />
          <span className="text-center font-mono text-[0.68rem] text-slate-300">
            {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
          </span>
          <button
            aria-label={isMuted ? `打开${label}声音` : `静音${label}`}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={() => setIsMuted((current) => !current)}
            title={isMuted ? "打开声音" : "静音"}
            type="button"
          >
            {isMuted ? (
              <VolumeX aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Volume2 aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
          <button
            aria-label={`全屏查看${label}`}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={() => void frameRef.current?.requestFullscreen()}
            title="全屏"
            type="button"
          >
            <Maximize2 aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex min-h-6 items-center justify-between gap-3">
          <p className="text-xs text-slate-400" role="status">
            {hasError
              ? "加载失败，请重新加载后再播放。"
              : isWaiting
                ? "正在缓冲..."
                : "可独立播放、静音与全屏查看此版本。"}
          </p>
          <button
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
            onClick={reload}
            type="button"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            重新加载视频
          </button>
        </div>
      </div>
    </section>
  );
}

function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00.0";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remaining
    .toFixed(1)
    .padStart(4, "0")}`;
}
