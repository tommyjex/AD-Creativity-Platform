import type { StoryboardShot } from "@/lib/api-types";

export const MAX_MERGE_DURATION_SECONDS = 30;

export const MERGE_MIN_SELECTION_MESSAGE =
  "请至少选择 2 个相邻分镜进行合并。";
export const MERGE_NOT_ADJACENT_MESSAGE = "仅支持合并相邻分镜。";
export const MERGE_DURATION_EXCEEDED_MESSAGE =
  "合并后镜头总时长不能超过 30 秒";

function toIdSet(selectedIds: Set<string> | string[]): Set<string> {
  return selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
}

function formatDuration(total: number): string {
  return Number.isInteger(total) ? String(total) : total.toFixed(1);
}

export function getSelectedShotsInOrder(
  shots: StoryboardShot[],
  selectedIds: Set<string> | string[]
): StoryboardShot[] {
  const ids = toIdSet(selectedIds);
  return shots
    .filter((shot) => ids.has(shot.id))
    .sort((a, b) => a.index - b.index);
}

export function getMergeDurationTotal(
  shots: StoryboardShot[],
  selectedIds: Set<string> | string[]
): number {
  return getSelectedShotsInOrder(shots, selectedIds).reduce(
    (total, shot) => total + shot.duration_seconds,
    0
  );
}

export function areShotsAdjacent(
  shots: StoryboardShot[],
  selectedIds: Set<string> | string[]
): boolean {
  const selected = getSelectedShotsInOrder(shots, selectedIds);
  if (selected.length < 2) {
    return false;
  }
  for (let i = 1; i < selected.length; i += 1) {
    if (selected[i].index - selected[i - 1].index !== 1) {
      return false;
    }
  }
  return true;
}

export function canMergeShots(
  shots: StoryboardShot[],
  selectedIds: Set<string> | string[]
): boolean {
  const selected = getSelectedShotsInOrder(shots, selectedIds);
  return (
    selected.length >= 2 &&
    areShotsAdjacent(shots, selectedIds) &&
    getMergeDurationTotal(shots, selectedIds) <= MAX_MERGE_DURATION_SECONDS
  );
}

export function getMergeBlockedReason(
  shots: StoryboardShot[],
  selectedIds: Set<string> | string[]
): string | null {
  const selected = getSelectedShotsInOrder(shots, selectedIds);
  if (selected.length < 2) {
    return MERGE_MIN_SELECTION_MESSAGE;
  }
  if (!areShotsAdjacent(shots, selectedIds)) {
    return MERGE_NOT_ADJACENT_MESSAGE;
  }
  const total = getMergeDurationTotal(shots, selectedIds);
  if (total > MAX_MERGE_DURATION_SECONDS) {
    return `${MERGE_DURATION_EXCEEDED_MESSAGE}（当前 ${formatDuration(total)}秒）`;
  }
  return null;
}
