"use client";

import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Scissors,
  Trash2,
  Volume2,
  VolumeX
} from "lucide-react";
import { useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import type {
  AigcMultitrackEditorAction
} from "@/lib/aigc/multitrack-editor-store";
import type {
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackKind,
  MultiTrackTrack
} from "@/lib/aigc/types";
import { cn } from "@/lib/utils";

const BASE_PIXELS_PER_SECOND = 88;
const TRACK_HEIGHT = 44;
const TRACK_LABELS: Record<MultiTrackKind, string> = {
  audio: "音频",
  image: "图片",
  subtitle: "字幕",
  text: "文字",
  video: "视频"
};
const CLIP_STYLES: Record<MultiTrackKind, string> = {
  audio: "border-pink-400/45 bg-pink-950 text-pink-100",
  image: "border-emerald-400/45 bg-emerald-950 text-emerald-100",
  subtitle: "border-cyan-400/45 bg-cyan-950 text-cyan-100",
  text: "border-blue-400/45 bg-blue-950 text-blue-100",
  video: "border-orange-400/45 bg-orange-950 text-orange-100"
};

export function AigcMultitrackTimeline({
  config,
  dispatch,
  onSelectElement,
  onSelectTrack,
  playheadMs,
  selectedElementId,
  selectedTrackId,
  zoom
}: {
  config: MultiTrackEditConfig;
  dispatch: (action: AigcMultitrackEditorAction) => void;
  onSelectElement: (elementId: string) => void;
  onSelectTrack: (trackId: string) => void;
  playheadMs: number;
  selectedElementId: string | null;
  selectedTrackId: string | null;
  zoom: number;
}) {
  const pixelsPerMs = (BASE_PIXELS_PER_SECOND * zoom) / 1000;
  const durationMs = Math.max(
    10_000,
    ...config.tracks.flatMap((track) =>
      track.elements.map((element) => element.target_time.end_ms + 2000)
    )
  );
  const contentWidth = Math.max(880, durationMs * pixelsPerMs);
  const displayTracks = [...config.tracks].reverse();
  const rulerTicks = useMemo(() => {
    const interval = zoom >= 2 ? 500 : zoom < 0.65 ? 2000 : 1000;
    return Array.from(
      { length: Math.floor(durationMs / interval) + 1 },
      (_, index) => index * interval
    );
  }, [durationMs, zoom]);

  return (
    <section
      aria-label="多轨时间线"
      className="grid min-h-0 grid-cols-[9.5rem_minmax(0,1fr)] border-t border-[#2a3038] bg-[#101318] sm:grid-cols-[12rem_minmax(0,1fr)]"
    >
      <div className="min-h-0 border-r border-[#2a3038] bg-[#15181d]">
        <div className="flex h-8 items-center justify-between border-b border-[#2a3038] px-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            轨道
          </span>
          <span className="font-mono text-[10px] text-zinc-600">
            {config.tracks.length}/20
          </span>
        </div>
        {displayTracks.map((track) => (
          <TrackHeader
            dispatch={dispatch}
            index={config.tracks.findIndex(
              (candidate) => candidate.id === track.id
            )}
            isSelected={selectedTrackId === track.id}
            key={track.id}
            onSelect={() => onSelectTrack(track.id)}
            track={track}
            trackCount={config.tracks.length}
          />
        ))}
      </div>

      <div
        className="min-h-0 overflow-x-auto overflow-y-auto"
        data-testid="timeline-scroll-area"
      >
        <div className="relative min-h-full" style={{ width: contentWidth }}>
          <button
            aria-label="时间标尺"
            className="relative block h-8 w-full cursor-crosshair border-b border-[#2a3038] bg-[#12151a] text-left"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              dispatch({
                type: "playhead/set",
                timeMs: (event.clientX - rect.left) / pixelsPerMs
              });
            }}
            type="button"
          >
            {rulerTicks.map((tick) => (
              <span
                className="absolute inset-y-0 border-l border-white/10 pl-1 pt-1 font-mono text-[9px] text-zinc-600"
                key={tick}
                style={{ left: tick * pixelsPerMs }}
              >
                {(tick / 1000).toFixed(tick % 1000 ? 1 : 0)}s
              </span>
            ))}
          </button>
          <div className="relative">
            {displayTracks.map((track) => (
              <div
                className="relative border-b border-white/[0.06] bg-[#0d1014]"
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                style={{ height: TRACK_HEIGHT }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${
                      1000 * pixelsPerMs - 1
                    }px, rgba(255,255,255,.07) ${1000 * pixelsPerMs}px)`
                  }}
                />
                {track.elements.map((element) => (
                  <TimelineClip
                    dispatch={dispatch}
                    element={element}
                    isSelected={selectedElementId === element.id}
                    key={element.id}
                    onSelect={() => onSelectElement(element.id)}
                    pixelsPerMs={pixelsPerMs}
                    playheadMs={playheadMs}
                  />
                ))}
              </div>
            ))}
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-blue-400"
              data-testid="timeline-playhead"
              style={{ left: playheadMs * pixelsPerMs }}
            >
              <span className="absolute -left-1.5 -top-1 h-3 w-3 rotate-45 bg-blue-400" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrackHeader({
  dispatch,
  index,
  isSelected,
  onSelect,
  track,
  trackCount
}: {
  dispatch: (action: AigcMultitrackEditorAction) => void;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  track: MultiTrackTrack;
  trackCount: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b border-white/[0.06] px-1.5",
        isSelected && "bg-blue-500/[0.08]"
      )}
      style={{ height: TRACK_HEIGHT }}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-zinc-600" />
      <button
        className="min-w-0 flex-1 text-left"
        onClick={onSelect}
        title={track.name}
        type="button"
      >
        <span className="block truncate text-[11px] text-zinc-300">
          {track.name}
        </span>
        <span className="block text-[9px] text-zinc-600">
          {TRACK_LABELS[track.type]} · {track.elements.length}
        </span>
      </button>
      <MiniButton
        disabled={index === trackCount - 1}
        label="轨道上移"
        onClick={() =>
          dispatch({ type: "track/reorder", trackId: track.id, toIndex: index + 1 })
        }
      >
        <ChevronUp />
      </MiniButton>
      <MiniButton
        disabled={index === 0}
        label="轨道下移"
        onClick={() =>
          dispatch({ type: "track/reorder", trackId: track.id, toIndex: index - 1 })
        }
      >
        <ChevronDown />
      </MiniButton>
      <MiniButton
        label={track.hidden ? "显示轨道" : "隐藏轨道"}
        onClick={() => dispatch({ type: "track/toggle-hidden", trackId: track.id })}
      >
        {track.hidden ? <EyeOff /> : <Eye />}
      </MiniButton>
      <MiniButton
        label={track.muted ? "取消静音" : "轨道静音"}
        onClick={() => dispatch({ type: "track/toggle-muted", trackId: track.id })}
      >
        {track.muted ? <VolumeX /> : <Volume2 />}
      </MiniButton>
    </div>
  );
}

function TimelineClip({
  dispatch,
  element,
  isSelected,
  onSelect,
  pixelsPerMs,
  playheadMs
}: {
  dispatch: (action: AigcMultitrackEditorAction) => void;
  element: MultiTrackElement;
  isSelected: boolean;
  onSelect: () => void;
  pixelsPerMs: number;
  playheadMs: number;
}) {
  const drag = useRef<{ clientX: number; startMs: number } | null>(null);
  const trim = useRef<{
    clientX: number;
    edge: "end" | "start";
    timeMs: number;
  } | null>(null);
  const duration = element.target_time.end_ms - element.target_time.start_ms;
  const label =
    element.type === "text"
      ? element.inline_text?.trim() || "上游文字"
      : element.type === "subtitle"
        ? element.asset_id || "待上传字幕"
        : element.source.source_node_id;

  return (
    <button
      aria-label={`选择片段 ${label}`}
      className={cn(
        "group absolute top-1 flex h-9 min-w-7 items-center overflow-hidden border px-2 text-left text-[10px] shadow-sm",
        CLIP_STYLES[element.type],
        isSelected && "z-10 ring-1 ring-blue-400 ring-offset-1 ring-offset-[#0d1014]"
      )}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerDown={(event) => {
        drag.current = {
          clientX: event.clientX,
          startMs: element.target_time.start_ms
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (!drag.current) return;
        const deltaMs = (event.clientX - drag.current.clientX) / pixelsPerMs;
        dispatch({
          type: "element/move",
          elementId: element.id,
          startMs: drag.current.startMs + deltaMs,
          snap: true
        });
        drag.current = null;
      }}
      style={{
        left: element.target_time.start_ms * pixelsPerMs,
        width: Math.max(28, duration * pixelsPerMs)
      }}
      type="button"
    >
      <span
        aria-label="向左裁切"
        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/10 opacity-0 group-hover:opacity-100"
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          trim.current = {
            clientX: event.clientX,
            edge: "start",
            timeMs: element.target_time.start_ms
          };
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (!trim.current) return;
          dispatch({
            type: "element/trim",
            edge: trim.current.edge,
            elementId: element.id,
            timeMs:
              trim.current.timeMs +
              (event.clientX - trim.current.clientX) / pixelsPerMs
          });
          trim.current = null;
        }}
      />
      <span className="truncate">{label}</span>
      {isSelected && element.type !== "subtitle" ? (
        <span
          aria-label="在播放头分割"
          className="ml-auto hidden p-1 group-hover:block"
          onClick={(event) => {
            event.stopPropagation();
            dispatch({
              type: "element/split",
              elementId: element.id,
              newElementId: `${element.id}-${Date.now()}`,
              timeMs: playheadMs
            });
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();
            dispatch({
              type: "element/split",
              elementId: element.id,
              newElementId: `${element.id}-${Date.now()}`,
              timeMs: playheadMs
            });
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          role="button"
          tabIndex={0}
        >
          <Scissors className="h-3 w-3" />
        </span>
      ) : null}
      <span
        aria-label="向右裁切"
        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/10 opacity-0 group-hover:opacity-100"
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          trim.current = {
            clientX: event.clientX,
            edge: "end",
            timeMs: element.target_time.end_ms
          };
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (!trim.current) return;
          dispatch({
            type: "element/trim",
            edge: trim.current.edge,
            elementId: element.id,
            timeMs:
              trim.current.timeMs +
              (event.clientX - trim.current.clientX) / pixelsPerMs
          });
          trim.current = null;
        }}
      />
    </button>
  );
}

function MiniButton({
  children,
  disabled,
  label,
  onClick
}: {
  children: React.ReactElement<{ className?: string }>;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className="hidden h-6 w-6 shrink-0 p-0 text-zinc-500 hover:text-white sm:inline-flex"
      disabled={disabled}
      onClick={onClick}
      size="icon"
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

export function TimelineDeleteAction({
  dispatch,
  elementId
}: {
  dispatch: (action: AigcMultitrackEditorAction) => void;
  elementId: string;
}) {
  return (
    <Button
      className="text-zinc-400 hover:text-red-300"
      onClick={() => dispatch({ type: "element/remove", elementId })}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Trash2 className="h-3.5 w-3.5" />
      删除片段
    </Button>
  );
}
