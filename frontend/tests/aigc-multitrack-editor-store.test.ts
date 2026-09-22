import { describe, expect, it } from "vitest";

import {
  createAigcMultitrackEditorStore,
  createAigcMultitrackEditorState,
  reduceAigcMultitrackEditor,
  snapTimelineTime
} from "@/lib/aigc/multitrack-editor-store";
import type {
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackTrack,
  MultiTrackVideoElement
} from "@/lib/aigc/types";

function source(sourceNodeId = "video-source", sourceHandle = "video") {
  return {
    source_node_id: sourceNodeId,
    source_handle: sourceHandle
  };
}

function videoElement(
  overrides: Partial<MultiTrackVideoElement> = {}
): MultiTrackVideoElement {
  return {
    id: "video-1",
    type: "video",
    source: source(),
    target_time: { start_ms: 0, end_ms: 2000 },
    source_trim: { start_ms: 100, end_ms: 2100 },
    loop: false,
    transform: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      rotation: 0
    },
    speed: 1,
    volume: 1,
    fade_in_ms: 0,
    fade_out_ms: 0,
    transition: null,
    ...overrides
  };
}

function track(
  overrides: Partial<MultiTrackTrack> = {}
): MultiTrackTrack {
  return {
    id: "video-track",
    name: "视频轨道",
    type: "video",
    order: 0,
    hidden: false,
    muted: false,
    elements: [videoElement()],
    ...overrides
  };
}

function config(tracks: MultiTrackTrack[] = [track()]): MultiTrackEditConfig {
  return {
    canvas: {
      mode: "custom",
      width: 1920,
      height: 1080,
      background_color: "#000000FF"
    },
    output: { format: "mp4", fps: 30 },
    tracks
  };
}

const availableVideoSource = {
  ...source(),
  kind: "video" as const,
  available: true
};

describe("AIGC multi-track editor reducer", () => {
  it("replaces a normalized project through the undo history", () => {
    const initial = createAigcMultitrackEditorState({
      config: config(),
      sources: [availableVideoSource]
    });
    const updated = reduceAigcMultitrackEditor(initial, {
      type: "config/replace",
      config: {
        ...initial.config,
        canvas: {
          ...initial.config.canvas,
          background_color: "#112233FF"
        }
      }
    });

    expect(updated.config.canvas.background_color).toBe("#112233FF");
    expect(updated.dirty).toBe(true);
    expect(updated.canUndo).toBe(true);
    expect(
      reduceAigcMultitrackEditor(updated, { type: "history/undo" }).config
        .canvas.background_color
    ).toBe("#000000FF");
  });

  it("commits repeated transient color previews as one history step", () => {
    const initial = createAigcMultitrackEditorState({
      config: config(),
      sources: [availableVideoSource]
    });
    const initialConfig = structuredClone(initial.config);
    const firstPreview = reduceAigcMultitrackEditor(initial, {
      type: "config/replace-transient",
      config: {
        ...initial.config,
        canvas: { ...initial.config.canvas, background_color: "#112233FF" }
      }
    });
    const secondPreview = reduceAigcMultitrackEditor(firstPreview, {
      type: "config/replace-transient",
      config: {
        ...firstPreview.config,
        canvas: { ...firstPreview.config.canvas, background_color: "#44556680" }
      }
    });

    expect(secondPreview.config.canvas.background_color).toBe("#44556680");
    expect(secondPreview.past).toHaveLength(0);

    const committed = reduceAigcMultitrackEditor(secondPreview, {
      type: "config/commit-transient",
      config: secondPreview.config,
      initialConfig
    });
    expect(committed.past).toHaveLength(1);
    expect(
      reduceAigcMultitrackEditor(committed, { type: "history/undo" }).config
        .canvas.background_color
    ).toBe("#000000FF");
  });

  it("restores a canceled transient color preview without history", () => {
    const initial = createAigcMultitrackEditorState({
      config: config(),
      sources: [availableVideoSource]
    });
    const preview = reduceAigcMultitrackEditor(initial, {
      type: "config/replace-transient",
      config: {
        ...initial.config,
        canvas: { ...initial.config.canvas, background_color: "#44556680" }
      }
    });
    const canceled = reduceAigcMultitrackEditor(preview, {
      type: "config/cancel-transient",
      initialConfig: initial.config
    });

    expect(canceled.config.canvas.background_color).toBe("#000000FF");
    expect(canceled.past).toHaveLength(0);
    expect(canceled.canUndo).toBe(false);
  });

  it("adds, renames, reorders, toggles, and removes tracks without mutation", () => {
    const initial = createAigcMultitrackEditorState({
      config: config(),
      sources: [availableVideoSource]
    });
    const audioTrack = track({
      id: "audio-track",
      name: "环境声",
      type: "audio",
      elements: []
    });

    let state = reduceAigcMultitrackEditor(initial, {
      type: "track/add",
      track: audioTrack
    });
    state = reduceAigcMultitrackEditor(state, {
      type: "track/rename",
      trackId: "audio-track",
      name: "  音乐  "
    });
    state = reduceAigcMultitrackEditor(state, {
      type: "track/reorder",
      trackId: "audio-track",
      toIndex: 0
    });
    state = reduceAigcMultitrackEditor(state, {
      type: "track/toggle-hidden",
      trackId: "video-track"
    });
    state = reduceAigcMultitrackEditor(state, {
      type: "track/toggle-muted",
      trackId: "audio-track"
    });

    expect(initial.config.tracks).toHaveLength(1);
    expect(state.config.tracks).toMatchObject([
      { id: "audio-track", name: "音乐", order: 0, muted: true },
      { id: "video-track", order: 1, hidden: true }
    ]);

    state = reduceAigcMultitrackEditor(state, {
      type: "track/remove",
      trackId: "audio-track"
    });
    expect(state.config.tracks.map((candidate) => candidate.id)).toEqual([
      "video-track"
    ]);
    expect(state.config.tracks[0]?.order).toBe(0);
  });

  it("restores a removed track and all of its elements in one undo step", () => {
    const initial = createAigcMultitrackEditorState({
      config: config(),
      sources: [availableVideoSource]
    });
    const removed = reduceAigcMultitrackEditor(initial, {
      type: "track/remove",
      trackId: "video-track"
    });

    expect(removed.config.tracks).toHaveLength(0);
    expect(removed.past).toHaveLength(1);

    const restored = reduceAigcMultitrackEditor(removed, {
      type: "history/undo"
    });
    expect(restored.config.tracks).toEqual(initial.config.tracks);
    expect(restored.config.tracks[0]?.elements).toHaveLength(1);
  });

  it("rejects structurally invalid additions instead of hiding repairs", () => {
    const initial = createAigcMultitrackEditorState({
      config: config(),
      sources: [availableVideoSource]
    });
    const duplicateTrack = reduceAigcMultitrackEditor(initial, {
      type: "track/add",
      track: track({ id: " video-track " })
    });
    const mismatchedTrack = reduceAigcMultitrackEditor(initial, {
      type: "track/add",
      track: track({
        id: "audio-track",
        type: "audio",
        elements: [videoElement({ id: "foreign-video" })]
      })
    });
    const duplicateElement = reduceAigcMultitrackEditor(initial, {
      type: "element/add",
      trackId: "video-track",
      element: videoElement({ id: " video-1 " })
    });

    expect(duplicateTrack).toBe(initial);
    expect(mismatchedTrack).toBe(initial);
    expect(duplicateElement).toBe(initial);
  });

  it("adds, binds, moves, and removes compatible elements", () => {
    const initial = createAigcMultitrackEditorState({
      config: config([
        track(),
        track({
          id: "overlay-track",
          name: "叠加视频",
          order: 1,
          elements: []
        })
      ]),
      sources: [
        availableVideoSource,
        {
          ...source("replacement", "video"),
          kind: "video",
          available: true
        }
      ]
    });
    const second = videoElement({
      id: "video-2",
      source: source("replacement", "video"),
      target_time: { start_ms: 2000.4, end_ms: 3000.6 },
      source_trim: { start_ms: 0, end_ms: 1000.2 }
    });

    let state = reduceAigcMultitrackEditor(initial, {
      type: "element/add",
      trackId: "video-track",
      element: second
    });
    state = reduceAigcMultitrackEditor(state, {
      type: "element/bind-source",
      elementId: "video-2",
      source: source()
    });
    state = reduceAigcMultitrackEditor(state, {
      type: "element/move",
      elementId: "video-2",
      targetTrackId: "overlay-track",
      startMs: 1500.4,
      snap: false
    });

    expect(state.config.tracks[0]?.elements).toHaveLength(1);
    expect(state.config.tracks[1]?.elements[0]).toMatchObject({
      id: "video-2",
      source: source(),
      target_time: { start_ms: 1500, end_ms: 2501 }
    });

    state = reduceAigcMultitrackEditor(state, {
      type: "element/remove",
      elementId: "video-2"
    });
    expect(state.config.tracks[1]?.elements).toEqual([]);
  });

  it("snaps moves to the closest playhead, sibling edge, or whole second", () => {
    expect(
      snapTimelineTime(1982, {
        thresholdMs: 25,
        playheadMs: 2000,
        siblingEdgesMs: [1970, 3000]
      })
    ).toBe(1970);
    expect(
      snapTimelineTime(2990, {
        thresholdMs: 25,
        playheadMs: 2000,
        siblingEdgesMs: []
      })
    ).toBe(3000);

    const initial = createAigcMultitrackEditorState({
      config: config([
        track({
          elements: [
            videoElement({ id: "first" }),
            videoElement({
              id: "second",
              target_time: { start_ms: 2500, end_ms: 3500 },
              source_trim: { start_ms: 0, end_ms: 1000 }
            })
          ]
        })
      ]),
      playheadMs: 4000,
      snapThresholdMs: 30,
      sources: [availableVideoSource]
    });
    const moved = reduceAigcMultitrackEditor(initial, {
      type: "element/move",
      elementId: "second",
      startMs: 2018,
      snap: true
    });

    expect(moved.config.tracks[0]?.elements[1]?.target_time).toEqual({
      start_ms: 2000,
      end_ms: 3000
    });
  });

  it("clamps edge trims, adjusts source trim by speed, and preserves overlap errors", () => {
    const initial = createAigcMultitrackEditorState({
      config: config([
        track({
          elements: [
            videoElement({
              id: "first",
              speed: 2,
              source_trim: { start_ms: 100, end_ms: 4100 }
            }),
            videoElement({
              id: "second",
              target_time: { start_ms: 2500, end_ms: 3500 },
              source_trim: { start_ms: 0, end_ms: 1000 }
            })
          ]
        })
      ]),
      sources: [availableVideoSource]
    });

    let state = reduceAigcMultitrackEditor(initial, {
      type: "element/trim",
      edge: "start",
      elementId: "first",
      timeMs: -100,
      snap: false
    });
    expect(state.config.tracks[0]?.elements[0]).toMatchObject({
      target_time: { start_ms: 0, end_ms: 2000 },
      source_trim: { start_ms: 100, end_ms: 4100 }
    });

    state = reduceAigcMultitrackEditor(state, {
      type: "element/trim",
      edge: "end",
      elementId: "first",
      timeMs: 3000,
      snap: false
    });
    expect(state.config.tracks[0]?.elements[0]).toMatchObject({
      target_time: { start_ms: 0, end_ms: 3000 },
      source_trim: { start_ms: 100, end_ms: 6100 }
    });
    expect(state.executionIssues.map((issue) => issue.code)).toContain(
      "track_overlap"
    );
  });

  it("splits media at an integer millisecond and keeps the outgoing transition", () => {
    const initial = createAigcMultitrackEditorState({
      config: config([
        track({
          elements: [
            videoElement({
              transition: { type: "fade", duration_ms: 200 }
            })
          ]
        })
      ]),
      sources: [availableVideoSource]
    });
    const state = reduceAigcMultitrackEditor(initial, {
      type: "element/split",
      elementId: "video-1",
      newElementId: "video-2",
      timeMs: 750.6
    });

    expect(state.config.tracks[0]?.elements).toMatchObject([
      {
        id: "video-1",
        target_time: { start_ms: 0, end_ms: 751 },
        source_trim: { start_ms: 100, end_ms: 851 },
        transition: null
      },
      {
        id: "video-2",
        target_time: { start_ms: 751, end_ms: 2000 },
        source_trim: { start_ms: 851, end_ms: 2100 },
        transition: { type: "fade", duration_ms: 200 }
      }
    ]);
  });
});

describe("AIGC multi-track editor store history and validation", () => {
  it("keeps playhead and zoom out of history while undoing project changes", () => {
    const store = createAigcMultitrackEditorStore({
      config: config(),
      sources: [availableVideoSource]
    });

    store.getState().dispatch({ type: "playhead/set", timeMs: 1200.7 });
    store.getState().dispatch({ type: "zoom/set", zoom: 2.5 });
    store.getState().dispatch({
      type: "track/rename",
      trackId: "video-track",
      name: "主视频"
    });
    expect(store.getState()).toMatchObject({
      dirty: true,
      playheadMs: 1201,
      zoom: 2.5,
      canUndo: true,
      canRedo: false
    });

    store.getState().undo();
    expect(store.getState()).toMatchObject({
      dirty: false,
      playheadMs: 1201,
      zoom: 2.5,
      canUndo: false,
      canRedo: true
    });
    expect(store.getState().config.tracks[0]?.name).toBe("视频轨道");

    store.getState().redo();
    expect(store.getState().config.tracks[0]?.name).toBe("主视频");
    expect(store.getState().dirty).toBe(true);
  });

  it("tracks in-flight saves, newer edits, failures, and conflict reloads", () => {
    const store = createAigcMultitrackEditorStore({
      config: config(),
      revision: 4,
      sources: [availableVideoSource]
    });
    store.getState().dispatch({
      type: "track/rename",
      trackId: "video-track",
      name: "已提交"
    });
    const submitted = structuredClone(store.getState().config);
    store.getState().beginSave();
    expect(store.getState().saveStatus).toBe("saving");

    store.getState().dispatch({
      type: "track/rename",
      trackId: "video-track",
      name: "更新草稿"
    });
    store.getState().saveSucceeded(submitted, 5);
    expect(store.getState()).toMatchObject({
      dirty: true,
      revision: 5,
      saveStatus: "saved"
    });

    store.getState().saveFailed("网络错误");
    expect(store.getState()).toMatchObject({
      dirty: true,
      saveError: "网络错误",
      saveStatus: "error"
    });
    store.getState().saveConflict("版本冲突");
    expect(store.getState().saveStatus).toBe("conflict");

    const remote = config([
      track({ name: "远端版本", elements: [] })
    ]);
    store.getState().reload(remote, 6);
    expect(store.getState()).toMatchObject({
      dirty: false,
      revision: 6,
      saveError: null,
      saveStatus: "idle",
      canUndo: false,
      canRedo: false
    });
    expect(store.getState().config.tracks[0]?.name).toBe("远端版本");
  });

  it("aggregates missing, unavailable, and mismatched sources with config issues", () => {
    const elements: MultiTrackElement[] = [
      videoElement({ id: "missing", source: source("deleted", "video") }),
      videoElement({
        id: "unavailable",
        source: source("pending", "video"),
        target_time: { start_ms: 2000, end_ms: 3000 },
        source_trim: { start_ms: 0, end_ms: 1000 }
      }),
      videoElement({
        id: "wrong-kind",
        source: source("audio-source", "audio"),
        target_time: { start_ms: 3000, end_ms: 4000 },
        source_trim: { start_ms: 0, end_ms: 1000 }
      }),
      videoElement({
        id: "overlap",
        target_time: { start_ms: 3500, end_ms: 4500 },
        source_trim: { start_ms: 0, end_ms: 1000 }
      })
    ];
    const store = createAigcMultitrackEditorStore({
      config: config([track({ elements })]),
      sources: [
        availableVideoSource,
        {
          ...source("pending", "video"),
          kind: "video",
          available: false
        },
        {
          ...source("audio-source", "audio"),
          kind: "audio",
          available: true
        }
      ]
    });

    expect(store.getState().missingSourceElementIds).toEqual(["missing"]);
    expect(store.getState().executionIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "track_overlap",
        "source_missing",
        "source_unavailable",
        "source_type_mismatch"
      ])
    );
    expect(store.getState().canExecute).toBe(false);

    store.getState().setSources([
      availableVideoSource,
      {
        ...source("deleted", "video"),
        kind: "video",
        available: true
      },
      {
        ...source("pending", "video"),
        kind: "video",
        available: true
      },
      {
        ...source("audio-source", "audio"),
        kind: "audio",
        available: true
      }
    ]);
    expect(store.getState().missingSourceElementIds).toEqual([]);
    expect(store.getState().dirty).toBe(false);
  });

  it("validates video and audio source trims against available media durations", () => {
    const audioSource = {
      ...source("audio-source", "audio"),
      kind: "audio" as const,
      available: true,
      duration_ms: 2_100
    };
    const audioElement: MultiTrackElement = {
      id: "audio-1",
      type: "audio",
      source: source("audio-source", "audio"),
      target_time: { start_ms: 0, end_ms: 2000 },
      source_trim: { start_ms: 100, end_ms: 2100 },
      loop: false,
      speed: 1,
      volume: 1,
      fade_in_ms: 0,
      fade_out_ms: 0
    };
    const valid = createAigcMultitrackEditorState({
      config: config([
        track(),
        track({
          id: "audio-track",
          name: "音频轨道",
          type: "audio",
          order: 1,
          elements: [audioElement]
        })
      ]),
      sources: [
        { ...availableVideoSource, duration_ms: 2_100 },
        audioSource
      ]
    });

    expect(
      valid.executionIssues.map((issue) => issue.code)
    ).not.toContain("source_trim_out_of_bounds");

    const invalid = createAigcMultitrackEditorState({
      config: {
        ...valid.config,
        tracks: valid.config.tracks.map((candidate) => ({
          ...candidate,
          elements: candidate.elements.map((element) =>
            element.type === "video" || element.type === "audio"
              ? {
                  ...element,
                  source_trim: {
                    ...element.source_trim!,
                    end_ms: 2_101
                  }
                }
              : element
          )
        }))
      },
      sources: [
        { ...availableVideoSource, duration_ms: 2_100 },
        audioSource
      ]
    });
    const trimIssues = invalid.executionIssues.filter(
      (issue) => issue.code === "source_trim_out_of_bounds"
    );

    expect(trimIssues).toHaveLength(2);
    expect(trimIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "tracks.0.elements.0.source_trim.end_ms",
          track_id: "video-track",
          element_id: "video-1"
        }),
        expect.objectContaining({
          path: "tracks.1.elements.0.source_trim.end_ms",
          track_id: "audio-track",
          element_id: "audio-1"
        })
      ])
    );
    expect(invalid.canExecute).toBe(false);
  });
});
