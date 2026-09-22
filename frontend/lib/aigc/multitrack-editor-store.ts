import { createStore, type StoreApi } from "zustand/vanilla";

import {
  MULTI_TRACK_MAX_ELEMENTS,
  MULTI_TRACK_MAX_SUBTITLE_TRACKS,
  MULTI_TRACK_MAX_TRACKS,
  normalizeMultiTrackEditConfig,
  validateMultiTrackEditConfig,
  type MultiTrackValidationIssue
} from "@/lib/aigc/multitrack";
import type {
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackKind,
  MultiTrackSource,
  MultiTrackTrack
} from "@/lib/aigc/types";

const HISTORY_LIMIT = 50;
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const DEFAULT_SNAP_THRESHOLD_MS = 50;

export type AigcTimelineSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export interface AigcTimelineSource extends MultiTrackSource {
  kind: Exclude<MultiTrackKind, "subtitle">;
  available: boolean;
  duration_ms?: number | null;
  mime_type?: string | null;
  preview_url?: string | null;
  preview_text?: string | null;
  text_preview_status?: "resolved" | "configured" | "unavailable";
}

export interface TimelineSnapOptions {
  thresholdMs: number;
  playheadMs: number;
  siblingEdgesMs: number[];
}

interface AigcMultitrackEditorSnapshot {
  config: MultiTrackEditConfig;
}

export interface AigcMultitrackEditorState {
  config: MultiTrackEditConfig;
  savedConfig: MultiTrackEditConfig;
  sources: AigcTimelineSource[];
  past: AigcMultitrackEditorSnapshot[];
  future: AigcMultitrackEditorSnapshot[];
  playheadMs: number;
  zoom: number;
  snapThresholdMs: number;
  revision: number;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: AigcTimelineSaveStatus;
  saveError: string | null;
  executionIssues: MultiTrackValidationIssue[];
  missingSourceElementIds: string[];
  canExecute: boolean;
}

export interface AigcMultitrackEditorInitialState {
  config: MultiTrackEditConfig;
  sources?: AigcTimelineSource[];
  playheadMs?: number;
  zoom?: number;
  snapThresholdMs?: number;
  revision?: number;
}

export type AigcMultitrackEditorAction =
  | { type: "config/replace"; config: MultiTrackEditConfig }
  | { type: "config/replace-transient"; config: MultiTrackEditConfig }
  | {
      type: "config/commit-transient";
      config: MultiTrackEditConfig;
      initialConfig: MultiTrackEditConfig;
    }
  | {
      type: "config/cancel-transient";
      initialConfig: MultiTrackEditConfig;
    }
  | { type: "track/add"; track: MultiTrackTrack }
  | { type: "track/remove"; trackId: string }
  | { type: "track/rename"; trackId: string; name: string }
  | { type: "track/reorder"; trackId: string; toIndex: number }
  | { type: "track/toggle-hidden"; trackId: string }
  | { type: "track/toggle-muted"; trackId: string }
  | {
      type: "element/add";
      trackId: string;
      element: MultiTrackElement;
    }
  | { type: "element/remove"; elementId: string }
  | {
      type: "element/bind-source";
      elementId: string;
      source: MultiTrackSource | null;
    }
  | {
      type: "element/move";
      elementId: string;
      targetTrackId?: string;
      startMs: number;
      snap?: boolean;
    }
  | {
      type: "element/trim";
      elementId: string;
      edge: "start" | "end";
      timeMs: number;
      snap?: boolean;
    }
  | {
      type: "element/split";
      elementId: string;
      newElementId: string;
      timeMs: number;
    }
  | { type: "playhead/set"; timeMs: number }
  | { type: "zoom/set"; zoom: number }
  | { type: "history/undo" }
  | { type: "history/redo" }
  | { type: "sources/set"; sources: AigcTimelineSource[] }
  | { type: "save/start" }
  | {
      type: "save/succeeded";
      config: MultiTrackEditConfig;
      revision: number;
    }
  | { type: "save/failed"; error: string }
  | { type: "save/conflict"; error: string }
  | {
      type: "project/reload";
      config: MultiTrackEditConfig;
      revision: number;
    }
  | { type: "project/discard" };

export interface AigcMultitrackEditorStoreState
  extends AigcMultitrackEditorState {
  dispatch: (action: AigcMultitrackEditorAction) => void;
  undo: () => void;
  redo: () => void;
  setSources: (sources: AigcTimelineSource[]) => void;
  beginSave: () => void;
  saveSucceeded: (config: MultiTrackEditConfig, revision: number) => void;
  saveFailed: (error: string) => void;
  saveConflict: (error: string) => void;
  reload: (config: MultiTrackEditConfig, revision: number) => void;
  discardChanges: () => void;
}

export type AigcMultitrackEditorStore =
  StoreApi<AigcMultitrackEditorStoreState>;

export function createAigcMultitrackEditorState(
  initial: AigcMultitrackEditorInitialState
): AigcMultitrackEditorState {
  const config = normalizeMultiTrackEditConfig(initial.config);
  return deriveState({
    config,
    savedConfig: structuredClone(config),
    sources: cloneSources(initial.sources ?? []),
    past: [],
    future: [],
    playheadMs: normalizeNonNegativeMs(initial.playheadMs ?? 0),
    zoom: normalizeZoom(initial.zoom ?? DEFAULT_ZOOM),
    snapThresholdMs: normalizeNonNegativeMs(
      initial.snapThresholdMs ?? DEFAULT_SNAP_THRESHOLD_MS
    ),
    revision: initial.revision ?? 0,
    saveStatus: "idle",
    saveError: null
  });
}

export function createAigcMultitrackEditorStore(
  initial: AigcMultitrackEditorInitialState
): AigcMultitrackEditorStore {
  return createStore<AigcMultitrackEditorStoreState>((set) => {
    const dispatch = (action: AigcMultitrackEditorAction) =>
      set((state) => reduceAigcMultitrackEditor(state, action));
    return {
      ...createAigcMultitrackEditorState(initial),
      dispatch,
      undo: () => dispatch({ type: "history/undo" }),
      redo: () => dispatch({ type: "history/redo" }),
      setSources: (sources) => dispatch({ type: "sources/set", sources }),
      beginSave: () => dispatch({ type: "save/start" }),
      saveSucceeded: (config, revision) =>
        dispatch({ type: "save/succeeded", config, revision }),
      saveFailed: (error) => dispatch({ type: "save/failed", error }),
      saveConflict: (error) => dispatch({ type: "save/conflict", error }),
      reload: (config, revision) =>
        dispatch({ type: "project/reload", config, revision }),
      discardChanges: () => dispatch({ type: "project/discard" })
    };
  });
}

export function reduceAigcMultitrackEditor(
  state: AigcMultitrackEditorState,
  action: AigcMultitrackEditorAction
): AigcMultitrackEditorState {
  switch (action.type) {
    case "config/replace":
      return updateConfigIfChanged(state, action.config);
    case "config/replace-transient":
      return replaceConfigTransiently(state, action.config);
    case "config/commit-transient":
      return commitTransientConfig(
        state,
        action.initialConfig,
        action.config
      );
    case "config/cancel-transient":
      return replaceConfigTransiently(state, action.initialConfig);
    case "track/add":
      if (!canAddTrack(state.config, action.track)) {
        return state;
      }
      return commitConfig(state, {
        ...state.config,
        tracks: [...state.config.tracks, structuredClone(action.track)]
      });
    case "track/remove":
      return updateConfigIfChanged(state, {
        ...state.config,
        tracks: state.config.tracks.filter(
          (track) => track.id !== action.trackId
        )
      });
    case "track/rename":
      return updateTrack(state, action.trackId, (track) => ({
        ...track,
        name: action.name
      }));
    case "track/reorder":
      return reorderTrack(state, action.trackId, action.toIndex);
    case "track/toggle-hidden":
      return updateTrack(state, action.trackId, (track) => ({
        ...track,
        hidden: !track.hidden
      }));
    case "track/toggle-muted":
      return updateTrack(state, action.trackId, (track) => ({
        ...track,
        muted: !track.muted
      }));
    case "element/add":
      return addElement(state, action.trackId, action.element);
    case "element/remove":
      return removeElement(state, action.elementId);
    case "element/bind-source":
      return bindElementSource(state, action.elementId, action.source);
    case "element/move":
      return moveElement(state, action);
    case "element/trim":
      return trimElement(state, action);
    case "element/split":
      return splitElement(state, action);
    case "playhead/set":
      return deriveState({
        ...state,
        playheadMs: normalizeNonNegativeMs(action.timeMs)
      });
    case "zoom/set":
      return deriveState({ ...state, zoom: normalizeZoom(action.zoom) });
    case "history/undo":
      return undo(state);
    case "history/redo":
      return redo(state);
    case "sources/set":
      return deriveState({
        ...state,
        sources: cloneSources(action.sources)
      });
    case "save/start":
      return deriveState({
        ...state,
        saveStatus: "saving",
        saveError: null
      });
    case "save/succeeded":
      return deriveState({
        ...state,
        savedConfig: normalizeMultiTrackEditConfig(action.config),
        revision: action.revision,
        saveStatus: "saved",
        saveError: null
      });
    case "save/failed":
      return deriveState({
        ...state,
        saveStatus: "error",
        saveError: action.error
      });
    case "save/conflict":
      return deriveState({
        ...state,
        saveStatus: "conflict",
        saveError: action.error
      });
    case "project/reload": {
      const config = normalizeMultiTrackEditConfig(action.config);
      return deriveState({
        ...state,
        config,
        savedConfig: structuredClone(config),
        past: [],
        future: [],
        revision: action.revision,
        saveStatus: "idle",
        saveError: null
      });
    }
    case "project/discard":
      return deriveState({
        ...state,
        config: structuredClone(state.savedConfig),
        past: [],
        future: [],
        saveStatus: "idle",
        saveError: null
      });
  }
}

export function snapTimelineTime(
  timeMs: number,
  options: TimelineSnapOptions
): number {
  const time = normalizeNonNegativeMs(timeMs);
  const candidates = [
    normalizeNonNegativeMs(options.playheadMs),
    ...options.siblingEdgesMs.map(normalizeNonNegativeMs),
    Math.round(time / 1000) * 1000
  ];
  let closest = time;
  let closestDistance = Math.max(0, options.thresholdMs) + 1;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - time);
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }
  return closestDistance <= Math.max(0, options.thresholdMs) ? closest : time;
}

function updateTrack(
  state: AigcMultitrackEditorState,
  trackId: string,
  update: (track: MultiTrackTrack) => MultiTrackTrack
) {
  const track = state.config.tracks.find(
    (candidate) => candidate.id === trackId
  );
  if (!track) return state;
  return commitConfig(state, {
    ...state.config,
    tracks: state.config.tracks.map((candidate) =>
      candidate.id === trackId ? update(candidate) : candidate
    )
  });
}

function reorderTrack(
  state: AigcMultitrackEditorState,
  trackId: string,
  toIndex: number
) {
  const fromIndex = state.config.tracks.findIndex(
    (track) => track.id === trackId
  );
  if (fromIndex < 0 || state.config.tracks.length < 2) return state;
  const targetIndex = Math.min(
    state.config.tracks.length - 1,
    Math.max(0, Math.round(toIndex))
  );
  if (fromIndex === targetIndex) return state;
  const tracks = [...state.config.tracks];
  const [moved] = tracks.splice(fromIndex, 1);
  if (!moved) return state;
  tracks.splice(targetIndex, 0, moved);
  return commitConfig(state, { ...state.config, tracks });
}

function addElement(
  state: AigcMultitrackEditorState,
  trackId: string,
  element: MultiTrackElement
) {
  const target = state.config.tracks.find((track) => track.id === trackId);
  const allElements = state.config.tracks.flatMap((track) => track.elements);
  const normalizedId = element.id.trim();
  if (
    !target ||
    target.type !== element.type ||
    allElements.length >= MULTI_TRACK_MAX_ELEMENTS ||
    !normalizedId ||
    allElements.some((candidate) => candidate.id === normalizedId) ||
    (target.type === "subtitle" && target.elements.length > 0)
  ) {
    return state;
  }
  return updateTrack(state, trackId, (track) => ({
    ...track,
    elements: [...track.elements, structuredClone(element)]
  }));
}

function removeElement(
  state: AigcMultitrackEditorState,
  elementId: string
) {
  const located = locateElement(state.config, elementId);
  if (!located) return state;
  return updateTrack(state, located.track.id, (track) => ({
    ...track,
    elements: track.elements.filter((element) => element.id !== elementId)
  }));
}

function bindElementSource(
  state: AigcMultitrackEditorState,
  elementId: string,
  source: MultiTrackSource | null
) {
  const located = locateElement(state.config, elementId);
  if (!located || located.element.type === "subtitle") return state;
  if (source === null && located.element.type !== "text") return state;
  return replaceElement(state, located.track.id, elementId, (element) => {
    if (element.type === "subtitle") return element;
    return { ...element, source: source ? { ...source } : null } as MultiTrackElement;
  });
}

function moveElement(
  state: AigcMultitrackEditorState,
  action: Extract<AigcMultitrackEditorAction, { type: "element/move" }>
) {
  const located = locateElement(state.config, action.elementId);
  if (!located) return state;
  const targetTrack = action.targetTrackId
    ? state.config.tracks.find((track) => track.id === action.targetTrackId)
    : located.track;
  if (!targetTrack || targetTrack.type !== located.element.type) return state;
  if (
    targetTrack.type === "subtitle" &&
    targetTrack.id !== located.track.id &&
    targetTrack.elements.length > 0
  ) {
    return state;
  }

  const duration =
    located.element.target_time.end_ms -
    located.element.target_time.start_ms;
  let startMs = normalizeNonNegativeMs(action.startMs);
  if (action.snap !== false) {
    const edges = siblingEdges(
      state.config,
      targetTrack.id,
      located.element.id
    );
    const startSnap = snapTimelineTime(startMs, {
      thresholdMs: state.snapThresholdMs,
      playheadMs: state.playheadMs,
      siblingEdgesMs: edges
    });
    const endSnap = snapTimelineTime(startMs + duration, {
      thresholdMs: state.snapThresholdMs,
      playheadMs: state.playheadMs,
      siblingEdgesMs: edges
    });
    startMs =
      Math.abs(startSnap - startMs) <=
      Math.abs(endSnap - (startMs + duration))
        ? startSnap
        : Math.max(0, endSnap - duration);
  }
  const moved: MultiTrackElement = {
    ...located.element,
    target_time: {
      start_ms: startMs,
      end_ms: startMs + duration
    }
  };
  const tracks = state.config.tracks.map((track) => ({
    ...track,
    elements: track.elements.filter(
      (element) => element.id !== located.element.id
    )
  }));
  const targetIndex = tracks.findIndex((track) => track.id === targetTrack.id);
  const target = tracks[targetIndex];
  if (!target) return state;
  tracks[targetIndex] = {
    ...target,
    elements: [...target.elements, moved]
  };
  return commitConfig(state, { ...state.config, tracks });
}

function trimElement(
  state: AigcMultitrackEditorState,
  action: Extract<AigcMultitrackEditorAction, { type: "element/trim" }>
) {
  const located = locateElement(state.config, action.elementId);
  if (!located) return state;
  const range = located.element.target_time;
  let timeMs = normalizeNonNegativeMs(action.timeMs);
  if (action.snap !== false) {
    timeMs = snapTimelineTime(timeMs, {
      thresholdMs: state.snapThresholdMs,
      playheadMs: state.playheadMs,
      siblingEdgesMs: siblingEdges(
        state.config,
        located.track.id,
        located.element.id
      )
    });
  }
  timeMs =
    action.edge === "start"
      ? Math.min(range.end_ms - 1, timeMs)
      : Math.max(range.start_ms + 1, timeMs);

  return replaceElement(
    state,
    located.track.id,
    located.element.id,
    (element) => {
      const target_time =
        action.edge === "start"
          ? { ...element.target_time, start_ms: timeMs }
          : { ...element.target_time, end_ms: timeMs };
      if (
        (element.type !== "video" && element.type !== "audio") ||
        !element.source_trim
      ) {
        return { ...element, target_time };
      }
      const targetDelta =
        action.edge === "start"
          ? timeMs - element.target_time.start_ms
          : timeMs - element.target_time.end_ms;
      const sourceDelta = Math.round(targetDelta * element.speed);
      const source_trim =
        action.edge === "start"
          ? {
              ...element.source_trim,
              start_ms: Math.max(
                0,
                element.source_trim.start_ms + sourceDelta
              )
            }
          : {
              ...element.source_trim,
              end_ms: Math.max(
                element.source_trim.start_ms + 1,
                element.source_trim.end_ms + sourceDelta
              )
            };
      return { ...element, source_trim, target_time };
    }
  );
}

function splitElement(
  state: AigcMultitrackEditorState,
  action: Extract<AigcMultitrackEditorAction, { type: "element/split" }>
) {
  const located = locateElement(state.config, action.elementId);
  if (
    !located ||
    !action.newElementId.trim() ||
    state.config.tracks
      .flatMap((track) => track.elements)
      .some((element) => element.id === action.newElementId) ||
    state.config.tracks.flatMap((track) => track.elements).length >=
      MULTI_TRACK_MAX_ELEMENTS ||
    located.element.type === "subtitle"
  ) {
    return state;
  }
  const splitMs = Math.round(action.timeMs);
  if (
    splitMs <= located.element.target_time.start_ms ||
    splitMs >= located.element.target_time.end_ms
  ) {
    return state;
  }

  const left = structuredClone(located.element);
  const right = structuredClone(located.element);
  left.id = located.element.id;
  right.id = action.newElementId.trim();
  left.target_time.end_ms = splitMs;
  right.target_time.start_ms = splitMs;
  if (
    (left.type === "video" || left.type === "audio") &&
    (right.type === "video" || right.type === "audio") &&
    left.source_trim &&
    right.source_trim
  ) {
    const sourceSplit = Math.round(
      left.source_trim.start_ms +
        (splitMs - located.element.target_time.start_ms) * left.speed
    );
    left.source_trim.end_ms = sourceSplit;
    right.source_trim.start_ms = sourceSplit;
  }
  if (left.type === "video" && right.type === "video") {
    left.transition = null;
  }

  return updateTrack(state, located.track.id, (track) => ({
    ...track,
    elements: track.elements.flatMap((element) =>
      element.id === located.element.id ? [left, right] : [element]
    )
  }));
}

function replaceElement(
  state: AigcMultitrackEditorState,
  trackId: string,
  elementId: string,
  update: (element: MultiTrackElement) => MultiTrackElement
) {
  return updateTrack(state, trackId, (track) => ({
    ...track,
    elements: track.elements.map((element) =>
      element.id === elementId ? update(element) : element
    )
  }));
}

function undo(state: AigcMultitrackEditorState) {
  const previous = state.past.at(-1);
  if (!previous) return state;
  return deriveState({
    ...state,
    config: structuredClone(previous.config),
    past: state.past.slice(0, -1),
    future: [
      { config: structuredClone(state.config) },
      ...state.future
    ].slice(0, HISTORY_LIMIT),
    saveStatus: "idle",
    saveError: null
  });
}

function redo(state: AigcMultitrackEditorState) {
  const next = state.future[0];
  if (!next) return state;
  return deriveState({
    ...state,
    config: structuredClone(next.config),
    past: [
      ...state.past,
      { config: structuredClone(state.config) }
    ].slice(-HISTORY_LIMIT),
    future: state.future.slice(1),
    saveStatus: "idle",
    saveError: null
  });
}

function updateConfigIfChanged(
  state: AigcMultitrackEditorState,
  config: MultiTrackEditConfig
) {
  const normalized = normalizeMultiTrackEditConfig(config);
  return sameConfig(normalized, state.config)
    ? state
    : commitNormalizedConfig(state, normalized);
}

function commitConfig(
  state: AigcMultitrackEditorState,
  config: MultiTrackEditConfig
) {
  return updateConfigIfChanged(state, config);
}

function commitNormalizedConfig(
  state: AigcMultitrackEditorState,
  config: MultiTrackEditConfig
) {
  return deriveState({
    ...state,
    config,
    past: [
      ...state.past,
      { config: structuredClone(state.config) }
    ].slice(-HISTORY_LIMIT),
    future: [],
    saveStatus: "idle",
    saveError: null
  });
}

function replaceConfigTransiently(
  state: AigcMultitrackEditorState,
  config: MultiTrackEditConfig
) {
  const normalized = normalizeMultiTrackEditConfig(config);
  if (sameConfig(normalized, state.config)) return state;
  return deriveState({
    ...state,
    config: normalized,
    saveStatus: "idle",
    saveError: null
  });
}

function commitTransientConfig(
  state: AigcMultitrackEditorState,
  initialConfig: MultiTrackEditConfig,
  config: MultiTrackEditConfig
) {
  const normalizedInitial = normalizeMultiTrackEditConfig(initialConfig);
  const normalized = normalizeMultiTrackEditConfig(config);
  if (sameConfig(normalizedInitial, normalized)) {
    return replaceConfigTransiently(state, normalized);
  }
  return deriveState({
    ...state,
    config: normalized,
    past: [
      ...state.past,
      { config: structuredClone(normalizedInitial) }
    ].slice(-HISTORY_LIMIT),
    future: [],
    saveStatus: "idle",
    saveError: null
  });
}

function deriveState(
  state: Omit<
    AigcMultitrackEditorState,
    | "dirty"
    | "canUndo"
    | "canRedo"
    | "executionIssues"
    | "missingSourceElementIds"
    | "canExecute"
  > &
    Partial<
      Pick<
        AigcMultitrackEditorState,
        | "dirty"
        | "canUndo"
        | "canRedo"
        | "executionIssues"
        | "missingSourceElementIds"
        | "canExecute"
      >
    >
): AigcMultitrackEditorState {
  const sourceIssues = validateSources(state.config, state.sources);
  const executionIssues = [
    ...validateMultiTrackEditConfig(state.config),
    ...sourceIssues
  ];
  return {
    ...state,
    dirty: !sameConfig(state.config, state.savedConfig),
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    executionIssues,
    missingSourceElementIds: sourceIssues
      .filter((issue) => issue.code === "source_missing")
      .map((issue) => issue.element_id)
      .filter((id): id is string => id !== null),
    canExecute: executionIssues.length === 0
  };
}

function validateSources(
  config: MultiTrackEditConfig,
  sources: AigcTimelineSource[]
): MultiTrackValidationIssue[] {
  const sourceMap = new Map(
    sources.map((source) => [sourceKey(source), source])
  );
  const issues: MultiTrackValidationIssue[] = [];
  config.tracks.forEach((track, trackIndex) => {
    track.elements.forEach((element, elementIndex) => {
      const source = elementSource(element);
      if (!source) return;
      const availableSource = sourceMap.get(sourceKey(source));
      const issue = (
        code: string,
        message: string
      ): MultiTrackValidationIssue => ({
        code,
        path: `tracks.${trackIndex}.elements.${elementIndex}.source`,
        message,
        track_id: track.id,
        element_id: element.id
      });
      if (!availableSource) {
        issues.push(issue("source_missing", "元素引用的直接上游来源已缺失"));
      } else if (availableSource.kind !== element.type) {
        issues.push(issue("source_type_mismatch", "元素来源类型不匹配"));
      } else if (!availableSource.available) {
        issues.push(issue("source_unavailable", "元素来源当前不可用于执行"));
      } else if (
        (element.type === "video" || element.type === "audio") &&
        element.source_trim &&
        typeof availableSource.duration_ms === "number" &&
        Number.isFinite(availableSource.duration_ms) &&
        availableSource.duration_ms >= 0 &&
        element.source_trim.end_ms > availableSource.duration_ms
      ) {
        issues.push({
          ...issue(
            "source_trim_out_of_bounds",
            `源裁切结束时间不能超过素材时长 ${availableSource.duration_ms} 毫秒`
          ),
          path: `tracks.${trackIndex}.elements.${elementIndex}.source_trim.end_ms`
        });
      }
    });
  });
  return issues;
}

function elementSource(element: MultiTrackElement) {
  return element.type === "subtitle" ? null : element.source;
}

function sourceKey(source: MultiTrackSource) {
  return `${source.source_node_id}\u0000${source.source_handle}`;
}

function locateElement(config: MultiTrackEditConfig, elementId: string) {
  for (const track of config.tracks) {
    const element = track.elements.find(
      (candidate) => candidate.id === elementId
    );
    if (element) return { track, element };
  }
  return null;
}

function siblingEdges(
  config: MultiTrackEditConfig,
  trackId: string,
  excludedElementId: string
) {
  const track = config.tracks.find((candidate) => candidate.id === trackId);
  return (
    track?.elements
      .filter((element) => element.id !== excludedElementId)
      .flatMap((element) => [
        element.target_time.start_ms,
        element.target_time.end_ms
      ]) ?? []
  );
}

function countSubtitleTracks(config: MultiTrackEditConfig) {
  return config.tracks.filter((track) => track.type === "subtitle").length;
}

function canAddTrack(
  config: MultiTrackEditConfig,
  track: MultiTrackTrack
) {
  const trackId = track.id.trim();
  const existingElements = config.tracks.flatMap(
    (candidate) => candidate.elements
  );
  const incomingElementIds = track.elements.map((element) =>
    element.id.trim()
  );
  return (
    config.tracks.length < MULTI_TRACK_MAX_TRACKS &&
    Boolean(trackId) &&
    !config.tracks.some((candidate) => candidate.id === trackId) &&
    (track.type !== "subtitle" ||
      (countSubtitleTracks(config) < MULTI_TRACK_MAX_SUBTITLE_TRACKS &&
        track.elements.length <= 1)) &&
    existingElements.length + track.elements.length <=
      MULTI_TRACK_MAX_ELEMENTS &&
    track.elements.every((element) => element.type === track.type) &&
    incomingElementIds.every(Boolean) &&
    new Set(incomingElementIds).size === incomingElementIds.length &&
    !existingElements.some((element) =>
      incomingElementIds.includes(element.id)
    )
  );
}

function normalizeNonNegativeMs(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function normalizeZoom(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function sameConfig(
  left: MultiTrackEditConfig,
  right: MultiTrackEditConfig
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneSources(sources: AigcTimelineSource[]) {
  return sources.map((source) => ({ ...source }));
}
