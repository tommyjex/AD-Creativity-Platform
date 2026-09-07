"use client";

import {
  ArrowLeft,
  Captions,
  ChevronDown,
  FilePlus2,
  LoaderCircle,
  PanelRight,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  X
} from "lucide-react";
import { useRef, useState } from "react";
import { useStore } from "zustand";

import { Button } from "@/components/ui/button";
import { AigcMultitrackInspector } from "@/components/workspace/aigc/aigc-multitrack-inspector";
import { AigcMultitrackPreview } from "@/components/workspace/aigc/aigc-multitrack-preview";
import { AigcMultitrackTimeline } from "@/components/workspace/aigc/aigc-multitrack-timeline";
import {
  createAigcMultitrackEditorStore,
  type AigcTimelineSource
} from "@/lib/aigc/multitrack-editor-store";
import type {
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackKind,
  MultiTrackSubtitleElement,
  MultiTrackTrack
} from "@/lib/aigc/types";
import { cn } from "@/lib/utils";

const MAX_SRT_BYTES = 5 * 1024 * 1024;

export interface AigcMultitrackSaveResult {
  config: MultiTrackEditConfig;
  revision: number;
}

export function AigcMultitrackEditor({
  config,
  onBack,
  onExecute,
  onReload,
  onSave,
  onUploadSubtitle,
  revision,
  sources,
  title
}: {
  config: MultiTrackEditConfig;
  onBack?: () => void;
  onExecute: (config: MultiTrackEditConfig) => Promise<void> | void;
  onReload?: () => void;
  onSave: (
    config: MultiTrackEditConfig
  ) => Promise<AigcMultitrackSaveResult | void> | AigcMultitrackSaveResult | void;
  onUploadSubtitle?: (file: File) => Promise<string>;
  revision: number;
  sources: AigcTimelineSource[];
  title: string;
}) {
  const [store] = useState(() =>
      createAigcMultitrackEditorStore({
        config,
        revision,
        sources
      })
  );
  const state = useStore(store);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(
    config.tracks[0]?.id ?? null
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [pending, setPending] = useState<"execute" | "save" | "subtitle" | null>(
    null
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedTrack =
    state.config.tracks.find((track) => track.id === selectedTrackId) ?? null;
  const selectedElement =
    state.config.tracks
      .flatMap((track) => track.elements)
      .find((element) => element.id === selectedElementId) ?? null;

  async function save() {
    if (!state.dirty || pending) return;
    setPending("save");
    setFeedback(null);
    store.getState().beginSave();
    try {
      const current = store.getState().config;
      const result = await onSave(current);
      store
        .getState()
        .saveSucceeded(result?.config ?? current, result?.revision ?? state.revision);
      setFeedback("草稿已保存。");
    } catch (error) {
      const message = errorMessage(error);
      if (errorStatus(error) === 409) {
        store.getState().saveConflict(message);
      } else {
        store.getState().saveFailed(message);
      }
      setFeedback(message);
    } finally {
      setPending(null);
    }
  }

  async function execute() {
    if (!state.canExecute || pending) return;
    setPending("execute");
    setFeedback(null);
    try {
      await onExecute(store.getState().config);
    } catch (error) {
      const message = errorMessage(error);
      if (errorStatus(error) === 409) {
        store.getState().saveConflict(message);
      }
      setFeedback(message);
    } finally {
      setPending(null);
    }
  }

  async function uploadSubtitle(file: File | undefined) {
    if (!file) return;
    const validationError = await validateSrt(file);
    if (validationError) {
      setFeedback(validationError);
      return;
    }
    if (!onUploadSubtitle) {
      setFeedback("字幕上传服务尚不可用，未修改当前草稿。");
      return;
    }
    setPending("subtitle");
    setFeedback(null);
    try {
      const assetId = await onUploadSubtitle(file);
      const trackId = uniqueId(
        "subtitle-track",
        state.config.tracks.map((track) => track.id)
      );
      const elementId = uniqueId(
        "subtitle",
        state.config.tracks.flatMap((track) =>
          track.elements.map((element) => element.id)
        )
      );
      const endMs = projectDuration(state.config);
      const canvasWidth = state.config.canvas.width ?? 1920;
      const canvasHeight = state.config.canvas.height ?? 1080;
      const element: MultiTrackSubtitleElement = {
        asset_id: assetId,
        id: elementId,
        loop: false,
        style: {
          background_color: "#00000099",
          bold: false,
          color: "#FFFFFFFF",
          font_size: 42,
          italic: false,
          underline: false
        },
        target_time: { end_ms: Math.max(1000, endMs), start_ms: 0 },
        transform: {
          height: Math.round(canvasHeight * 0.15),
          rotation: 0,
          width: Math.round(canvasWidth * 0.8),
          x: Math.round(canvasWidth * 0.1),
          y: Math.round(canvasHeight * 0.8)
        },
        type: "subtitle"
      };
      const track: MultiTrackTrack = {
        elements: [element],
        hidden: false,
        id: trackId,
        muted: false,
        name: file.name,
        order: state.config.tracks.length,
        type: "subtitle"
      };
      store.getState().dispatch({ type: "track/add", track });
      setSelectedTrackId(trackId);
      setSelectedElementId(elementId);
      setMobileInspectorOpen(true);
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setPending(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function addSourceElement(source: AigcTimelineSource) {
    const current = store.getState();
    const track =
      current.config.tracks.find((candidate) => candidate.type === source.kind) ??
      createEmptyTrack(source.kind, current.config.tracks);
    if (!current.config.tracks.some((candidate) => candidate.id === track.id)) {
      current.dispatch({ type: "track/add", track });
    }
    const element = createSourceElement(
      source,
      current.config,
      current.playheadMs
    );
    store.getState().dispatch({
      type: "element/add",
      element,
      trackId: track.id
    });
    setSelectedTrackId(track.id);
    setSelectedElementId(element.id);
  }

  function addInlineText() {
    const current = store.getState();
    const track =
      current.config.tracks.find((candidate) => candidate.type === "text") ??
      createEmptyTrack("text", current.config.tracks);
    if (!current.config.tracks.some((candidate) => candidate.id === track.id)) {
      current.dispatch({ type: "track/add", track });
    }
    const element = createInlineTextElement(
      current.config,
      current.playheadMs
    );
    store.getState().dispatch({
      type: "element/add",
      element,
      trackId: track.id
    });
    setSelectedTrackId(track.id);
    setSelectedElementId(element.id);
  }

  return (
    <main
      className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#0b0d10] text-[#f2f4f7] [--accent-foreground:210_20%_96%] [--accent:216_13%_17%] [--background:216_20%_7%] [--border:215_14%_19%] [--card-foreground:210_20%_96%] [--card:216_13%_11%] [--foreground:210_20%_96%] [--input:215_14%_22%] [--muted-foreground:215_9%_63%] [--muted:216_13%_15%] [--primary-foreground:0_0%_100%] [--primary:217_91%_60%] [--secondary-foreground:210_16%_90%] [--secondary:216_13%_15%]"
      data-testid="aigc-timeline-editor"
    >
      <header
        aria-label="时间线编辑操作"
        className="flex h-14 shrink-0 items-center gap-1.5 border-b border-[#2a3038] bg-[#15181d] px-2 sm:gap-2 sm:px-3"
        role="toolbar"
      >
        <Button
          aria-label="返回 AIGC 画布"
          className="text-zinc-400 hover:bg-[#252a31] hover:text-white"
          onClick={onBack}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xs font-semibold sm:text-sm">{title}</h1>
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-600">
            多轨时间线 · Revision {state.revision}
          </p>
        </div>
        <span className="hidden text-[10px] text-zinc-500 sm:inline">
          {saveStatusLabel(state.dirty, state.saveStatus)}
        </span>
        <Button
          aria-label="撤销"
          className="h-8 w-8 p-0"
          disabled={!state.canUndo || Boolean(pending)}
          onClick={state.undo}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          aria-label="重做"
          className="hidden h-8 w-8 p-0 sm:inline-flex"
          disabled={!state.canRedo || Boolean(pending)}
          onClick={state.redo}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          aria-label="放弃修改"
          className="hidden sm:inline-flex"
          disabled={!state.dirty || Boolean(pending)}
          onClick={() => {
            state.discardChanges();
            setFeedback(null);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">放弃</span>
        </Button>
        <Button
          aria-label="保存到节点"
          disabled={!state.dirty || Boolean(pending)}
          onClick={() => void save()}
          size="sm"
          type="button"
          variant="outline"
        >
          {pending === "save" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="hidden md:inline">保存</span>
        </Button>
        <Button
          aria-label="执行剪辑"
          disabled={!state.canExecute || Boolean(pending)}
          onClick={() => void execute()}
          size="sm"
          type="button"
        >
          {pending === "execute" ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span className="hidden md:inline">执行剪辑</span>
        </Button>
      </header>

      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[#2a3038] bg-[#101318] px-2 sm:px-3">
        <AddTrackControl
          onAdd={(track) => {
            state.dispatch({ type: "track/add", track });
            setSelectedTrackId(track.id);
            setSelectedElementId(null);
          }}
          tracks={state.config.tracks}
        />
        <AddSourceControl onAdd={addSourceElement} sources={state.sources} />
        <Button
          className="h-7 border-[#343a43] px-2 text-[10px] text-zinc-400"
          onClick={addInlineText}
          size="sm"
          type="button"
          variant="outline"
        >
          <FilePlus2 className="h-3 w-3" />
          <span className="hidden sm:inline">内联文字</span>
        </Button>
        <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 border border-[#343a43] px-2 text-[10px] font-medium text-zinc-400 hover:border-blue-500/50 hover:text-white">
          {pending === "subtitle" ? (
            <LoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <Captions className="h-3 w-3" />
          )}
          上传 SRT
          <input
            accept=".srt,application/x-subrip,text/srt"
            aria-label="上传 SRT 字幕"
            className="sr-only"
            disabled={Boolean(pending)}
            onChange={(event) => void uploadSubtitle(event.target.files?.[0])}
            ref={fileInput}
            type="file"
          />
        </label>
        <span className="hidden text-[10px] text-zinc-600 md:inline">
          字幕独占轨道 · 模板不会保留该 SRT 资产 ID
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="hidden items-center gap-2 text-[10px] text-zinc-500 sm:flex">
            缩放
            <input
              aria-label="时间线缩放"
              className="w-24 accent-blue-500"
              max="4"
              min="0.25"
              onChange={(event) =>
                state.dispatch({
                  type: "zoom/set",
                  zoom: Number(event.target.value)
                })
              }
              step="0.25"
              type="range"
              value={state.zoom}
            />
          </label>
          <Button
            aria-label="打开检查器"
            className="h-7 lg:hidden"
            onClick={() => setMobileInspectorOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <PanelRight className="h-3.5 w-3.5" />
            属性
          </Button>
        </div>
      </div>

      {feedback ? (
        <div
          className={cn(
            "shrink-0 border-b border-[#2a3038] px-3 py-2 text-[11px]",
            state.saveStatus === "conflict" || state.saveStatus === "error"
              ? "text-red-300"
              : "text-amber-300"
          )}
          role={feedback.includes("仅支持") ? "alert" : "status"}
        >
          {feedback}
          {state.saveStatus === "conflict" && onReload ? (
            <Button
              className="ml-3 h-7"
              onClick={onReload}
              size="sm"
              type="button"
              variant="outline"
            >
              重新加载
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(14rem,1fr)_minmax(12rem,38%)] lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-[minmax(14rem,1fr)_minmax(12rem,38%)]">
        <AigcMultitrackPreview
          config={state.config}
          playheadMs={state.playheadMs}
        />
        <div className="hidden min-h-0 border-l border-[#2a3038] lg:row-span-2 lg:block">
          <AigcMultitrackInspector
            config={state.config}
            dispatch={state.dispatch}
            issues={state.executionIssues}
            selectedElement={selectedElement}
            selectedTrack={selectedTrack}
            sources={state.sources}
          />
        </div>
        <AigcMultitrackTimeline
          config={state.config}
          dispatch={state.dispatch}
          onSelectElement={(elementId) => {
            setSelectedElementId(elementId);
            const track = state.config.tracks.find((candidate) =>
              candidate.elements.some((element) => element.id === elementId)
            );
            setSelectedTrackId(track?.id ?? null);
          }}
          onSelectTrack={(trackId) => {
            setSelectedTrackId(trackId);
            setSelectedElementId(null);
          }}
          playheadMs={state.playheadMs}
          selectedElementId={selectedElementId}
          selectedTrackId={selectedTrackId}
          zoom={state.zoom}
        />
      </div>

      <div
        className={cn(
          "absolute inset-0 z-40 bg-black/55 transition-opacity lg:hidden",
          mobileInspectorOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        data-state={mobileInspectorOpen ? "open" : "closed"}
        data-testid="mobile-inspector-drawer"
        onClick={() => setMobileInspectorOpen(false)}
      >
        <div
          className={cn(
            "absolute inset-y-0 right-0 w-[min(88vw,22rem)] border-l border-[#343a43] bg-[#15181d] transition-transform",
            mobileInspectorOpen ? "translate-x-0" : "translate-x-full"
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            aria-label="关闭检查器"
            className="absolute right-2 top-2 z-20 h-7 w-7 p-0"
            onClick={() => setMobileInspectorOpen(false)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
          {mobileInspectorOpen ? (
            <AigcMultitrackInspector
              config={state.config}
              dispatch={state.dispatch}
              issues={state.executionIssues}
              selectedElement={selectedElement}
              selectedTrack={selectedTrack}
              sources={state.sources}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function AddTrackControl({
  onAdd,
  tracks
}: {
  onAdd: (track: MultiTrackTrack) => void;
  tracks: MultiTrackTrack[];
}) {
  return (
    <label className="relative inline-flex h-7 items-center border border-[#343a43] text-[10px] text-zinc-400">
      <span className="pointer-events-none pl-2">添加轨道</span>
      <ChevronDown className="pointer-events-none mx-1 h-3 w-3" />
      <select
        aria-label="添加轨道"
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(event) => {
          if (!event.target.value) return;
          const kind = event.target.value as MultiTrackKind;
          const id = uniqueId(
            `${kind}-track`,
            tracks.map((track) => track.id)
          );
          onAdd({
            elements: [],
            hidden: false,
            id,
            muted: false,
            name: `${kindLabel(kind)}轨道`,
            order: tracks.length,
            type: kind
          });
          event.target.value = "";
        }}
        value=""
      >
        <option value="">添加轨道</option>
        {(["video", "image", "audio", "text", "subtitle"] as const).map(
          (kind) => (
            <option key={kind} value={kind}>
              {kindLabel(kind)}
            </option>
          )
        )}
      </select>
    </label>
  );
}

function AddSourceControl({
  onAdd,
  sources
}: {
  onAdd: (source: AigcTimelineSource) => void;
  sources: AigcTimelineSource[];
}) {
  return (
    <label className="relative inline-flex h-7 items-center border border-[#343a43] text-[10px] text-zinc-400">
      <span className="pointer-events-none pl-2">上游素材</span>
      <ChevronDown className="pointer-events-none mx-1 h-3 w-3" />
      <select
        aria-label="添加上游素材"
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={sources.length === 0}
        onChange={(event) => {
          const source = sources.find(
            (candidate) => sourceValue(candidate) === event.target.value
          );
          if (source) onAdd(source);
          event.target.value = "";
        }}
        value=""
      >
        <option value="">选择直接上游</option>
        {sources.map((source) => (
          <option key={sourceValue(source)} value={sourceValue(source)}>
            {kindLabel(source.kind)} · {source.source_node_id}
          </option>
        ))}
      </select>
    </label>
  );
}

async function validateSrt(file: File) {
  if (!file.name.toLowerCase().endsWith(".srt")) return "仅支持 .srt 字幕文件。";
  if (file.size === 0) return "SRT 字幕文件不能为空。";
  if (file.size > MAX_SRT_BYTES) return "SRT 字幕文件不能超过 5 MB。";
  const content = await readFileText(file);
  if (!/\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(content)) {
    return "SRT 字幕缺少合法时间码。";
  }
  return null;
}

function readFileText(file: File) {
  if (typeof file.text === "function") return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("读取 SRT 失败。"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

function uniqueId(prefix: string, existing: string[]) {
  let index = 1;
  let candidate = prefix;
  while (existing.includes(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }
  return candidate;
}

function createEmptyTrack(
  kind: MultiTrackKind,
  tracks: MultiTrackTrack[]
): MultiTrackTrack {
  return {
    elements: [],
    hidden: false,
    id: uniqueId(
      `${kind}-track`,
      tracks.map((track) => track.id)
    ),
    muted: false,
    name: `${kindLabel(kind)}轨道`,
    order: tracks.length,
    type: kind
  };
}

function createSourceElement(
  source: AigcTimelineSource,
  config: MultiTrackEditConfig,
  playheadMs: number
): MultiTrackElement {
  const startMs = Math.round(playheadMs);
  const endMs = startMs + 3000;
  const id = uniqueId(
    source.kind,
    config.tracks.flatMap((track) =>
      track.elements.map((element) => element.id)
    )
  );
  const base = {
    id,
    loop: source.kind === "image",
    source: {
      source_handle: source.source_handle,
      source_node_id: source.source_node_id
    },
    target_time: { end_ms: endMs, start_ms: startMs }
  };
  if (source.kind === "audio") {
    return {
      ...base,
      fade_in_ms: 0,
      fade_out_ms: 0,
      source_trim: { end_ms: 3000, start_ms: 0 },
      speed: 1,
      type: "audio",
      volume: 1
    };
  }
  const transform = fullCanvasTransform(config);
  if (source.kind === "video") {
    return {
      ...base,
      fade_in_ms: 0,
      fade_out_ms: 0,
      source_trim: { end_ms: 3000, start_ms: 0 },
      speed: 1,
      transform,
      transition: null,
      type: "video",
      volume: 1
    };
  }
  if (source.kind === "image") {
    return { ...base, transform, type: "image" };
  }
  return {
    ...base,
    inline_text: null,
    style: defaultTextStyle(),
    transform,
    type: "text"
  };
}

function createInlineTextElement(
  config: MultiTrackEditConfig,
  playheadMs: number
): MultiTrackElement {
  const canvasWidth = config.canvas.width ?? 1920;
  const canvasHeight = config.canvas.height ?? 1080;
  return {
    id: uniqueId(
      "text",
      config.tracks.flatMap((track) =>
        track.elements.map((element) => element.id)
      )
    ),
    inline_text: "输入文字",
    loop: false,
    source: null,
    style: defaultTextStyle(),
    target_time: {
      end_ms: Math.round(playheadMs) + 3000,
      start_ms: Math.round(playheadMs)
    },
    transform: {
      height: Math.round(canvasHeight * 0.15),
      rotation: 0,
      width: Math.round(canvasWidth * 0.6),
      x: Math.round(canvasWidth * 0.2),
      y: Math.round(canvasHeight * 0.12)
    },
    type: "text"
  };
}

function fullCanvasTransform(config: MultiTrackEditConfig) {
  return {
    height: config.canvas.height ?? 1080,
    rotation: 0,
    width: config.canvas.width ?? 1920,
    x: 0,
    y: 0
  };
}

function defaultTextStyle() {
  return {
    background_color: "#00000000",
    bold: false,
    color: "#FFFFFFFF",
    font_size: 48,
    italic: false,
    underline: false
  };
}

function sourceValue(source: {
  source_handle: string;
  source_node_id: string;
}) {
  return `${source.source_node_id}\u0000${source.source_handle}`;
}

function projectDuration(config: MultiTrackEditConfig) {
  return Math.max(
    1000,
    ...config.tracks.flatMap((track) =>
      track.elements.map((element) => element.target_time.end_ms)
    )
  );
}

function kindLabel(kind: MultiTrackKind) {
  return {
    audio: "音频",
    image: "图片",
    subtitle: "字幕",
    text: "文字",
    video: "视频"
  }[kind];
}

function saveStatusLabel(
  dirty: boolean,
  status: "conflict" | "error" | "idle" | "saved" | "saving"
) {
  if (status === "saving") return "保存中";
  if (status === "conflict") return "保存冲突";
  if (status === "error") return "保存失败";
  return dirty ? "有未保存修改" : "已保存";
}

function errorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}
