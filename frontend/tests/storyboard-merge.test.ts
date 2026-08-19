import { describe, expect, it } from "vitest";

import type { StoryboardShot } from "@/lib/api-types";
import {
  areShotsAdjacent,
  canMergeShots,
  getMergeBlockedReason,
  getMergeDurationTotal,
  getSelectedShotsInOrder,
  MAX_MERGE_DURATION_SECONDS,
  MERGE_DURATION_EXCEEDED_MESSAGE,
  MERGE_MIN_SELECTION_MESSAGE,
  MERGE_NOT_ADJACENT_MESSAGE
} from "@/lib/storyboard-merge";

function makeShot(overrides: Partial<StoryboardShot> & { index: number }): StoryboardShot {
  return {
    created_at: "2026-08-09T10:00:00Z",
    description: `镜头 ${overrides.index} 描述`,
    duration_seconds: 10,
    first_frame_asset_id: null,
    first_frame_source_video_asset_id: null,
    id: `shot-${overrides.index}`,
    image_asset_id: null,
    is_merged: false,
    merge_source_count: 0,
    narration: null,
    project_id: "project-1",
    reference_audio_asset_ids: [],
    reference_image_asset_ids: [],
    reference_video_asset_ids: [],
    status: "draft",
    title: `镜头 ${overrides.index}`,
    updated_at: "2026-08-09T10:00:00Z",
    video_asset_id: null,
    video_prompt: null,
    visual_prompt: `视觉 ${overrides.index}`,
    ...overrides
  };
}

const shots: StoryboardShot[] = [
  makeShot({ index: 1, duration_seconds: 8 }),
  makeShot({ index: 2, duration_seconds: 10 }),
  makeShot({ index: 3, duration_seconds: 12 }),
  makeShot({ index: 4, duration_seconds: 20 })
];

describe("getSelectedShotsInOrder", () => {
  it("returns selected shots ordered by index regardless of selection order", () => {
    const ordered = getSelectedShotsInOrder(shots, ["shot-3", "shot-1"]);
    expect(ordered.map((shot) => shot.index)).toEqual([1, 3]);
  });

  it("accepts a Set of ids", () => {
    const ordered = getSelectedShotsInOrder(shots, new Set(["shot-2", "shot-1"]));
    expect(ordered.map((shot) => shot.id)).toEqual(["shot-1", "shot-2"]);
  });
});

describe("getMergeDurationTotal", () => {
  it("sums the duration of the selected shots", () => {
    expect(getMergeDurationTotal(shots, ["shot-1", "shot-2"])).toBe(18);
  });
});

describe("areShotsAdjacent", () => {
  it("returns true for consecutive indices", () => {
    expect(areShotsAdjacent(shots, ["shot-2", "shot-3"])).toBe(true);
  });

  it("returns false for non-adjacent indices", () => {
    expect(areShotsAdjacent(shots, ["shot-2", "shot-4"])).toBe(false);
  });

  it("returns false when fewer than two are selected", () => {
    expect(areShotsAdjacent(shots, ["shot-2"])).toBe(false);
  });
});

describe("canMergeShots", () => {
  it("allows merging adjacent shots within the duration limit", () => {
    expect(canMergeShots(shots, ["shot-1", "shot-2"])).toBe(true);
  });

  it("allows merging when the total is exactly the limit", () => {
    const limitShots = [
      makeShot({ index: 1, duration_seconds: 15 }),
      makeShot({ index: 2, duration_seconds: 15 })
    ];
    expect(getMergeDurationTotal(limitShots, ["shot-1", "shot-2"])).toBe(
      MAX_MERGE_DURATION_SECONDS
    );
    expect(canMergeShots(limitShots, ["shot-1", "shot-2"])).toBe(true);
  });

  it("blocks merging non-adjacent shots", () => {
    expect(canMergeShots(shots, ["shot-2", "shot-4"])).toBe(false);
  });

  it("blocks merging when the total exceeds the limit", () => {
    expect(canMergeShots(shots, ["shot-3", "shot-4"])).toBe(false);
  });

  it("blocks merging a single shot", () => {
    expect(canMergeShots(shots, ["shot-1"])).toBe(false);
  });
});

describe("getMergeBlockedReason", () => {
  it("requires at least two shots", () => {
    expect(getMergeBlockedReason(shots, ["shot-1"])).toBe(
      MERGE_MIN_SELECTION_MESSAGE
    );
  });

  it("requires adjacency", () => {
    expect(getMergeBlockedReason(shots, ["shot-1", "shot-3"])).toBe(
      MERGE_NOT_ADJACENT_MESSAGE
    );
  });

  it("reports the duration overflow with the current total", () => {
    const reason = getMergeBlockedReason(shots, ["shot-3", "shot-4"]);
    expect(reason).toContain(MERGE_DURATION_EXCEEDED_MESSAGE);
    expect(reason).toContain("32");
  });

  it("returns null when merging is allowed", () => {
    expect(getMergeBlockedReason(shots, ["shot-1", "shot-2"])).toBeNull();
  });
});
