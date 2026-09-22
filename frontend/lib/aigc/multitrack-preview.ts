import type {
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackTransform
} from "@/lib/aigc/types";

export type PreviewResizeHandle = "ne" | "nw" | "se" | "sw";

export interface PreviewGuideState {
  horizontal: number | null;
  vertical: number | null;
}

export interface PreviewVisualLayer {
  element: Exclude<
    MultiTrackElement,
    { type: "audio" | "subtitle" }
  >;
  trackId: string;
  zIndex: number;
}

export function getPreviewCanvasSize(config: MultiTrackEditConfig) {
  return {
    height: config.canvas.height ?? 1080,
    width: config.canvas.width ?? 1920
  };
}

export function getPreviewVisualLayers(
  config: MultiTrackEditConfig,
  playheadMs: number
): PreviewVisualLayer[] {
  const trackCount = config.tracks.length;
  return config.tracks.flatMap((track, trackIndex) => {
    if (track.hidden) return [];
    return track.elements.flatMap((element) => {
      if (
        element.type === "audio" ||
        element.type === "subtitle" ||
        element.target_time.start_ms > playheadMs ||
        element.target_time.end_ms <= playheadMs
      ) {
        return [];
      }
      return [
        {
          element,
          trackId: track.id,
          zIndex: trackCount - trackIndex
        }
      ];
    });
  });
}

export function getPreviewSourceKey(source: {
  source_handle: string;
  source_node_id: string;
}) {
  return `${source.source_node_id}\u0000${source.source_handle}`;
}

export function getVideoPreviewTimeSeconds(
  element: Extract<MultiTrackElement, { type: "video" }>,
  playheadMs: number
) {
  const trimStart = element.source_trim?.start_ms ?? 0;
  const trimEnd = element.source_trim?.end_ms ?? null;
  let elapsed =
    Math.max(0, playheadMs - element.target_time.start_ms) * element.speed;
  if (element.loop && trimEnd !== null && trimEnd > trimStart) {
    elapsed %= trimEnd - trimStart;
  }
  const sourceMs =
    trimEnd === null
      ? trimStart + elapsed
      : Math.min(trimEnd - 1, trimStart + elapsed);
  return Math.max(0, sourceMs) / 1000;
}

export function movePreviewTransform(
  initial: MultiTrackTransform,
  deltaX: number,
  deltaY: number,
  canvasWidth: number,
  canvasHeight: number,
  snapThreshold: number
) {
  const next = {
    ...initial,
    x: initial.x + deltaX,
    y: initial.y + deltaY
  };
  const horizontal = nearestSnap(
    [
      { guide: 0, value: 0 },
      {
        guide: canvasHeight / 2,
        value: (canvasHeight - initial.height) / 2
      },
      { guide: canvasHeight, value: canvasHeight - initial.height }
    ],
    next.y,
    snapThreshold
  );
  const vertical = nearestSnap(
    [
      { guide: 0, value: 0 },
      {
        guide: canvasWidth / 2,
        value: (canvasWidth - initial.width) / 2
      },
      { guide: canvasWidth, value: canvasWidth - initial.width }
    ],
    next.x,
    snapThreshold
  );
  return {
    guides: {
      horizontal: horizontal?.guide ?? null,
      vertical: vertical?.guide ?? null
    } satisfies PreviewGuideState,
    transform: {
      ...next,
      x: Math.round(vertical?.value ?? next.x),
      y: Math.round(horizontal?.value ?? next.y)
    }
  };
}

export function resizePreviewTransform(
  initial: MultiTrackTransform,
  handle: PreviewResizeHandle,
  deltaX: number,
  deltaY: number,
  canvasWidth: number,
  canvasHeight: number,
  snapThreshold: number
) {
  const horizontalScale =
    handle.endsWith("e")
      ? (initial.width + deltaX) / initial.width
      : (initial.width - deltaX) / initial.width;
  const verticalScale =
    handle.startsWith("s")
      ? (initial.height + deltaY) / initial.height
      : (initial.height - deltaY) / initial.height;
  let scale =
    Math.abs(horizontalScale - 1) >= Math.abs(verticalScale - 1)
      ? horizontalScale
      : verticalScale;
  const minScale = Math.max(16 / initial.width, 16 / initial.height);
  scale = Math.max(minScale, scale);

  const candidates = resizeSnapCandidates(
    initial,
    handle,
    canvasWidth,
    canvasHeight
  );
  const snapped = nearestScale(candidates, scale, initial, snapThreshold);
  scale = snapped?.scale ?? scale;

  const width = Math.max(16, Math.round(initial.width * scale));
  const height = Math.max(16, Math.round(initial.height * scale));
  return {
    guides: snapped?.guides ?? {
      horizontal: null,
      vertical: null
    },
    transform: {
      ...initial,
      height,
      width,
      x: handle.endsWith("w")
        ? Math.round(initial.x + initial.width - width)
        : initial.x,
      y: handle.startsWith("n")
        ? Math.round(initial.y + initial.height - height)
        : initial.y
    }
  };
}

function nearestSnap(
  candidates: Array<{ guide: number; value: number }>,
  value: number,
  threshold: number
) {
  let best: { guide: number; value: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate.value - value);
    if (distance <= threshold && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function resizeSnapCandidates(
  initial: MultiTrackTransform,
  handle: PreviewResizeHandle,
  canvasWidth: number,
  canvasHeight: number
) {
  const result: Array<{
    axis: "horizontal" | "vertical";
    guide: number;
    scale: number;
  }> = [];
  for (const guide of [0, canvasWidth / 2, canvasWidth]) {
    result.push({
      axis: "vertical",
      guide,
      scale: handle.endsWith("e")
        ? (guide - initial.x) / initial.width
        : (initial.x + initial.width - guide) / initial.width
    });
  }
  for (const guide of [0, canvasHeight / 2, canvasHeight]) {
    result.push({
      axis: "horizontal",
      guide,
      scale: handle.startsWith("s")
        ? (guide - initial.y) / initial.height
        : (initial.y + initial.height - guide) / initial.height
    });
  }
  return result;
}

function nearestScale(
  candidates: ReturnType<typeof resizeSnapCandidates>,
  scale: number,
  initial: MultiTrackTransform,
  threshold: number
) {
  let best:
    | {
        guides: PreviewGuideState;
        scale: number;
      }
    | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.scale) || candidate.scale <= 0) continue;
    const size =
      candidate.axis === "vertical" ? initial.width : initial.height;
    const distance = Math.abs(candidate.scale - scale) * size;
    if (distance <= threshold && distance < bestDistance) {
      best = {
        guides: {
          horizontal:
            candidate.axis === "horizontal" ? candidate.guide : null,
          vertical: candidate.axis === "vertical" ? candidate.guide : null
        },
        scale: candidate.scale
      };
      bestDistance = distance;
    }
  }
  return best;
}
