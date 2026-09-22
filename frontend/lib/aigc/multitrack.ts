import type {
  MultiTrackAudioElement,
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackSubtitleElement,
  MultiTrackTextElement,
  MultiTrackTrack,
  MultiTrackTransform,
  MultiTrackVideoElement
} from "@/lib/aigc/types";
import { fontTypeIssue } from "@/lib/aigc/multitrack-fonts";

export const MULTI_TRACK_MAX_TRACKS = 20;
export const MULTI_TRACK_MAX_ELEMENTS = 200;
export const MULTI_TRACK_MAX_SUBTITLE_TRACKS = 10;
export const MULTI_TRACK_CANVAS_MIN_SIZE = 160;
export const MULTI_TRACK_CANVAS_MAX_SIZE = 8192;

export const AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG: MultiTrackEditConfig = {
  canvas: {
    mode: "auto",
    width: null,
    height: null,
    background_color: "#000000FF"
  },
  output: { format: "mp4", fps: 30 },
  tracks: []
};

export interface MultiTrackValidationIssue {
  code: string;
  path: string;
  message: string;
  track_id: string | null;
  element_id: string | null;
}

const RGBA_PATTERN = /^#[0-9A-Fa-f]{8}$/;

export function normalizeMultiTrackEditConfig(
  config: MultiTrackEditConfig
): MultiTrackEditConfig {
  return {
    canvas: { ...config.canvas },
    output: { ...config.output },
    tracks: config.tracks.map((track, trackIndex) => ({
      ...track,
      id: track.id.trim(),
      name: track.name.trim(),
      order: trackIndex,
      elements: track.elements.map(normalizeElement)
    }))
  };
}

function normalizeElement(element: MultiTrackElement): MultiTrackElement {
  switch (element.type) {
    case "video":
      return {
        ...element,
        id: element.id.trim(),
        target_time: normalizeTimeRange(element.target_time),
        source: { ...element.source },
        source_trim: element.source_trim
          ? normalizeTimeRange(element.source_trim)
          : null,
        transform: { ...element.transform },
        fade_in_ms: Math.round(element.fade_in_ms),
        fade_out_ms: Math.round(element.fade_out_ms),
        transition: element.transition
          ? {
              ...element.transition,
              duration_ms: Math.round(element.transition.duration_ms)
            }
          : null
      };
    case "audio":
      return {
        ...element,
        id: element.id.trim(),
        target_time: normalizeTimeRange(element.target_time),
        source: { ...element.source },
        source_trim: element.source_trim
          ? normalizeTimeRange(element.source_trim)
          : null,
        fade_in_ms: Math.round(element.fade_in_ms),
        fade_out_ms: Math.round(element.fade_out_ms)
      };
    case "image":
      return {
        ...element,
        id: element.id.trim(),
        target_time: normalizeTimeRange(element.target_time),
        source: { ...element.source },
        transform: { ...element.transform }
      };
    case "text":
      return {
        ...element,
        id: element.id.trim(),
        target_time: normalizeTimeRange(element.target_time),
        source: element.source ? { ...element.source } : null,
        transform: { ...element.transform },
        style: { ...element.style, font_type: element.style.font_type ?? null }
      };
    case "subtitle":
      return {
        ...element,
        id: element.id.trim(),
        target_time: normalizeTimeRange(element.target_time),
        transform: { ...element.transform },
        style: { ...element.style, font_type: element.style.font_type ?? null }
      };
  }
}

function normalizeTimeRange(range: { start_ms: number; end_ms: number }) {
  return {
    start_ms: Math.round(range.start_ms),
    end_ms: Math.round(range.end_ms)
  };
}

export function validateMultiTrackEditConfig(
  config: MultiTrackEditConfig
): MultiTrackValidationIssue[] {
  const project = normalizeMultiTrackEditConfig(config);
  const issues: MultiTrackValidationIssue[] = [];
  const add = (
    code: string,
    path: string,
    message: string,
    track?: MultiTrackTrack,
    element?: MultiTrackElement
  ) => {
    issues.push({
      code,
      path,
      message,
      track_id: track?.id ?? null,
      element_id: element?.id ?? null
    });
  };

  const { canvas } = project;
  if (
    canvas.mode === "custom" &&
    (!integerInRange(
      canvas.width,
      MULTI_TRACK_CANVAS_MIN_SIZE,
      MULTI_TRACK_CANVAS_MAX_SIZE
    ) ||
      !integerInRange(
        canvas.height,
        MULTI_TRACK_CANVAS_MIN_SIZE,
        MULTI_TRACK_CANVAS_MAX_SIZE
      ))
  ) {
    add("invalid_canvas_size", "canvas", "自定义画布尺寸无效");
  }
  if (!RGBA_PATTERN.test(canvas.background_color)) {
    add(
      "invalid_background_color",
      "canvas.background_color",
      "背景色必须使用 #RRGGBBAA"
    );
  }
  if (project.tracks.length > MULTI_TRACK_MAX_TRACKS) {
    add("track_limit_exceeded", "tracks", "轨道数量不能超过 20");
  }

  const trackIds = project.tracks.map((track) => track.id);
  if (new Set(trackIds).size !== trackIds.length) {
    add("duplicate_track_id", "tracks", "轨道 ID 必须唯一");
  }
  const allElements = project.tracks.flatMap((track) => track.elements);
  if (allElements.length > MULTI_TRACK_MAX_ELEMENTS) {
    add("element_limit_exceeded", "tracks", "元素数量不能超过 200");
  }
  const elementIds = allElements.map((element) => element.id);
  if (new Set(elementIds).size !== elementIds.length) {
    add("duplicate_element_id", "tracks", "元素 ID 必须唯一");
  }
  if (!project.tracks.some((track) => !track.hidden)) {
    add("visible_track_required", "tracks", "至少需要一条未隐藏轨道");
  }
  if (
    project.tracks.filter((track) => track.type === "subtitle").length >
    MULTI_TRACK_MAX_SUBTITLE_TRACKS
  ) {
    add(
      "subtitle_track_limit_exceeded",
      "tracks",
      "字幕轨道数量不能超过 10"
    );
  }

  let validVisibleElements = 0;
  project.tracks.forEach((track, trackIndex) => {
    const trackPath = `tracks.${trackIndex}`;
    if (track.type === "subtitle" && track.elements.length > 1) {
      add(
        "subtitle_track_element_limit",
        `${trackPath}.elements`,
        "字幕轨道只能包含一个元素",
        track
      );
    }
    const elementIssueCounts = new Map<string, number>();
    track.elements.forEach((element, elementIndex) => {
      const before = issues.length;
      const path = `${trackPath}.elements.${elementIndex}`;
      if (track.type !== element.type) {
        add(
          "track_element_type_mismatch",
          `${path}.type`,
          "元素类型必须与轨道类型一致",
          track,
          element
        );
      }
      validateElement(project, track, element, path, add);
      elementIssueCounts.set(element.id, issues.length - before);
    });

    const sorted = [...track.elements].sort(
      (left, right) =>
        left.target_time.start_ms - right.target_time.start_ms ||
        left.target_time.end_ms - right.target_time.end_ms
    );
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const overlap =
        previous.target_time.end_ms - current.target_time.start_ms;
      if (overlap <= 0) continue;
      if (!hasLegalTransition(previous, current, overlap)) {
        add(
          "track_overlap",
          `${trackPath}.elements`,
          "同一轨道元素不能重叠",
          track,
          previous
        );
      }
    }
    if (!track.hidden) {
      validVisibleElements += track.elements.filter(
        (element) => elementIssueCounts.get(element.id) === 0
      ).length;
    }
  });
  if (validVisibleElements === 0) {
    add(
      "valid_element_required",
      "tracks",
      "至少需要一个位于未隐藏轨道的有效元素"
    );
  }
  return issues;
}

type AddIssue = (
  code: string,
  path: string,
  message: string,
  track?: MultiTrackTrack,
  element?: MultiTrackElement
) => void;

function validateElement(
  project: MultiTrackEditConfig,
  track: MultiTrackTrack,
  element: MultiTrackElement,
  path: string,
  add: AddIssue
) {
  const duration =
    element.target_time.end_ms - element.target_time.start_ms;
  if (
    element.target_time.start_ms < 0 ||
    element.target_time.end_ms <= element.target_time.start_ms
  ) {
    add(
      "invalid_target_time",
      `${path}.target_time`,
      "目标时间必须是非负递增整数区间",
      track,
      element
    );
  }
  if (element.type === "video" || element.type === "audio") {
    validateMediaElement(track, element, path, duration, add);
  }
  if (
    element.type === "video" ||
    element.type === "image" ||
    element.type === "text" ||
    element.type === "subtitle"
  ) {
    validateTransform(project, track, element, path, add);
  }
  if (element.type === "text") {
    const hasSource =
      Boolean(element.source?.source_node_id.trim()) &&
      Boolean(element.source?.source_handle.trim());
    if (!hasSource && !element.inline_text?.trim()) {
      add(
        "text_source_required",
        path,
        "文字需要上游来源或内联内容",
        track,
        element
      );
    }
    validateTextStyle(track, element, path, add);
  }
  if (element.type === "subtitle") {
    if (!element.asset_id?.trim()) {
      add(
        "subtitle_asset_required",
        `${path}.asset_id`,
        "字幕需要 SRT 资产",
        track,
        element
      );
    }
    validateTextStyle(track, element, path, add);
  }
  if (
    element.type === "video" &&
    element.transition !== null &&
    (element.transition.duration_ms <= 0 ||
      element.transition.duration_ms > duration)
  ) {
    add(
      "invalid_transition",
      `${path}.transition`,
      "转场时长必须为正且不超过片段时长",
      track,
      element
    );
  }
}

function validateMediaElement(
  track: MultiTrackTrack,
  element: MultiTrackVideoElement | MultiTrackAudioElement,
  path: string,
  duration: number,
  add: AddIssue
) {
  const speedIsValid =
    Number.isFinite(element.speed) && element.speed >= 0.1 && element.speed <= 4;
  if (!speedIsValid) {
    add("invalid_speed", `${path}.speed`, "倍速必须在 0.1 到 4 之间", track, element);
  }
  if (element.volume < 0) {
    add("invalid_volume", `${path}.volume`, "音量不能为负数", track, element);
  }
  if (
    element.fade_in_ms < 0 ||
    element.fade_out_ms < 0 ||
    element.fade_in_ms > duration ||
    element.fade_out_ms > duration
  ) {
    add("invalid_fade", path, "淡入淡出不能超过片段时长", track, element);
  }
  const trim = element.source_trim;
  if (trim) {
    const trimDuration = trim.end_ms - trim.start_ms;
    if (trim.start_ms < 0 || trim.end_ms <= trim.start_ms) {
      add(
        "invalid_source_trim",
        `${path}.source_trim`,
        "源裁切必须是非负递增区间",
        track,
        element
      );
    } else if (
      speedIsValid &&
      !element.loop &&
      Math.abs(trimDuration / element.speed - duration) > 1
    ) {
      add(
        "duration_mismatch",
        path,
        "裁切时长经倍速换算后必须匹配目标时长",
        track,
        element
      );
    }
  }
}

function validateTransform(
  project: MultiTrackEditConfig,
  track: MultiTrackTrack,
  element: MultiTrackElement & { transform: MultiTrackTransform },
  path: string,
  add: AddIssue
) {
  const value = element.transform;
  let invalid =
    value.width <= 0 || value.height <= 0 || value.x < 0 || value.y < 0;
  if (
    !invalid &&
    project.canvas.mode === "custom" &&
    project.canvas.width !== null &&
    project.canvas.height !== null
  ) {
    invalid =
      value.x + value.width > project.canvas.width ||
      value.y + value.height > project.canvas.height;
  }
  if (invalid) {
    add(
      "transform_out_of_canvas",
      `${path}.transform`,
      "Transform 必须位于画布内",
      track,
      element
    );
  }
}

function validateTextStyle(
  track: MultiTrackTrack,
  element: MultiTrackTextElement | MultiTrackSubtitleElement,
  path: string,
  add: AddIssue
) {
  if (fontTypeIssue(element.style.font_type ?? null)) {
    add(
      "invalid_font_type",
      `${path}.style.font_type`,
      "字体必须是官方预置 ID 或 HTTPS TTF/OTF URL",
      track,
      element
    );
  }
  if (
    element.style.font_size <= 0 ||
    !RGBA_PATTERN.test(element.style.color) ||
    !RGBA_PATTERN.test(element.style.background_color)
  ) {
    add(
      "invalid_text_style",
      `${path}.style`,
      "文字样式无效",
      track,
      element
    );
  }
}

function hasLegalTransition(
  previous: MultiTrackElement,
  current: MultiTrackElement,
  overlap: number
): boolean {
  if (
    previous.type !== "video" ||
    current.type !== "video" ||
    previous.transition === null
  ) {
    return false;
  }
  const duration = previous.transition.duration_ms;
  return (
    duration >= overlap &&
    duration > 0 &&
    duration <=
      Math.min(
        previous.target_time.end_ms - previous.target_time.start_ms,
        current.target_time.end_ms - current.target_time.start_ms
      )
  );
}

function integerInRange(
  value: number | null,
  minimum: number,
  maximum: number
): value is number {
  return (
    value !== null &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}
