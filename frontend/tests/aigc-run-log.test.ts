import { describe, expect, it } from "vitest";
import {
  AIGC_BLOCKED_MESSAGE,
  AIGC_RUN_ERROR_FALLBACK,
  formatAigcDuration,
  formatAigcEndTime,
  formatAigcErrorStage,
  formatAigcLogTime,
  getAigcCacheReuse,
  getAigcNodeLogError,
  getAigcProviderTrace,
  getAigcRunLogError,
  latestRelevantAttempt
} from "@/lib/aigc/run-log";
import type {
  AigcPipelineRunNode,
  AigcPipelineTaskAttempt
} from "@/lib/aigc/types";

function attempt(
  attemptNumber: number,
  overrides: Partial<AigcPipelineTaskAttempt> = {}
): AigcPipelineTaskAttempt {
  return {
    task_id: `task-${attemptNumber}`,
    pipeline_id: "pipeline-1",
    run_id: "run-1",
    node_id: "model",
    attempt: attemptNumber,
    type: "text_to_image",
    status: "succeeded",
    progress: 100,
    params: {},
    upstream: [],
    result: {
      kind: "none",
      text: null,
      text_digest: null,
      assets: []
    },
    error: null,
    metrics: { cost_tokens: 0, duration_ms: 0 },
    created_at: "2026-08-29T03:04:05",
    started_at: "2026-08-29T03:04:05",
    finished_at: "2026-08-29T03:05:10",
    ...overrides
  };
}

function node(
  overrides: Partial<AigcPipelineRunNode> = {}
): AigcPipelineRunNode {
  return {
    node_id: "model",
    included_in_plan: true,
    status: "succeeded",
    current_task_id: null,
    reused_from_task_id: null,
    input_hash: null,
    result: {
      kind: "none",
      text: null,
      text_digest: null,
      assets: []
    },
    attempts: [],
    ...overrides
  };
}

describe("AIGC run log helpers", () => {
  it("formats local timestamps with a stable shape and handles missing values", () => {
    expect(formatAigcLogTime("2026-08-29T03:04:05")).toBe(
      "2026-08-29 03:04:05"
    );
    expect(formatAigcLogTime(null)).toBe("-");
    expect(formatAigcLogTime("not-a-date")).toBe("-");
  });

  it("formats active placeholders and terminal durations", () => {
    expect(formatAigcEndTime(null, true)).toBe("进行中");
    expect(
      formatAigcDuration(
        "2026-08-29T03:04:05Z",
        "2026-08-29T04:05:10Z"
      )
    ).toBe("1 小时 1 分 5 秒");
    expect(
      formatAigcDuration("2026-08-29T03:04:05Z", null, true)
    ).toBe("进行中");
    expect(formatAigcDuration(null, null, true)).toBe("-");
    expect(
      formatAigcDuration(
        "2026-08-29T03:04:05.000Z",
        "2026-08-29T03:04:05.250Z"
      )
    ).toBe("250 毫秒");
  });

  it("selects the current task or highest attempt without relying on array order", () => {
    const first = attempt(1);
    const second = attempt(2);
    expect(
      latestRelevantAttempt(
        node({ attempts: [second, first], current_task_id: null })
      )
    ).toBe(second);
    expect(
      latestRelevantAttempt(
        node({ attempts: [second, first], current_task_id: first.task_id })
      )
    ).toBe(first);
  });

  it("selects safe run and task errors with stable fallback messages", () => {
    expect(
      getAigcRunLogError({
        status: "failed",
        error: {
          code: "SCHEDULING_FAILED",
          message: "运行调度失败",
          request_id: "request-run",
          stage: "scheduling"
        }
      })
    ).toEqual({
      code: "SCHEDULING_FAILED",
      message: "运行调度失败",
      requestId: "request-run",
      stage: "validate"
    });
    expect(
      getAigcNodeLogError(node({ status: "blocked" }))?.message
    ).toBe(AIGC_BLOCKED_MESSAGE);
    expect(
      getAigcNodeLogError(node({ status: "timed_out" }))?.message
    ).toBe(AIGC_RUN_ERROR_FALLBACK);
    expect(
      getAigcNodeLogError(
        node({
          status: "failed",
          current_task_id: "task-2",
          attempts: [
            attempt(1, {
              status: "failed",
              error: {
                code: "OLD",
                message: "旧错误",
                request_id: null,
                stage: null
              }
            }),
            attempt(2, {
              status: "failed",
              error: {
                code: "PROVIDER_FAILED",
                message: "服务商处理失败",
                request_id: "request-task",
                stage: "provider"
              }
            })
          ]
        })
      )
    ).toMatchObject({
      code: "PROVIDER_FAILED",
      message: "服务商处理失败",
      requestId: "request-task",
      stage: "provider"
    });
  });

  it("reads safe provider trace identifiers and rejects unsafe metadata", () => {
    expect(
      getAigcProviderTrace(
        node({
          attempts: [
            attempt(1, {
              type: "video_face_blur",
              result: {
                kind: "assets",
                text: null,
                text_digest: null,
                assets: [
                  {
                    asset_id: "blurred-video",
                    ordinal: 0,
                    mime_type: "video/mp4",
                    download_url: "/api/assets/blurred-video/content",
                    available: true,
                    metadata: {
                      provider_task_id: "mediakit-task_123",
                      provider_request_id: "request/456"
                    }
                  }
                ]
              }
            })
          ]
        })
      )
    ).toEqual({
      requestId: "request/456",
      taskId: "mediakit-task_123"
    });

    expect(
      getAigcProviderTrace(
        node({
          result: {
            kind: "assets",
            text: null,
            text_digest: null,
            assets: [
              {
                asset_id: "unsafe",
                ordinal: 0,
                mime_type: "video/mp4",
                download_url: "/api/assets/unsafe/content",
                available: true,
                metadata: {
                  provider_task_id: "task\nsecret=value",
                  provider_request_id: "<script>"
                }
              }
            ]
          }
        })
      )
    ).toBeNull();
  });

  it("maps multi-track stages, scheduling errors, and cache reuse safely", () => {
    expect(formatAigcErrorStage("scheduling")).toBe("validate");
    expect(formatAigcErrorStage("submit")).toBe("submit");
    expect(formatAigcErrorStage("poll")).toBe("poll");
    expect(formatAigcErrorStage("asset_transfer")).toBe("transfer");
    expect(formatAigcErrorStage("database")).toBe("persistence");
    expect(
      getAigcCacheReuse(
        node({
          status: "reused",
          reused_from_task_id: "multitrack-task-previous"
        })
      )
    ).toBe("multitrack-task-previous");
    expect(
      getAigcNodeLogError(
        node({
          status: "failed",
          error: {
            code: "invalid_input",
            message: "Signed URL https://provider.example/video?token=secret",
            request_id: "request-safe",
            stage: "scheduling"
          }
        })
      )
    ).toEqual({
      code: "invalid_input",
      message: "执行失败，错误详情已脱敏",
      requestId: "request-safe",
      stage: "validate"
    });
  });
});
