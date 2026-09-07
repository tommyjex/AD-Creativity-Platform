import type {
  AigcPipelineRun,
  AigcPipelineRunNode,
  AigcPipelineTaskAttempt,
  AigcTaskError
} from "@/lib/aigc/types";

export const AIGC_RUN_ERROR_FALLBACK = "执行失败，未提供详细原因";
export const AIGC_REDACTED_ERROR_FALLBACK = "执行失败，错误详情已脱敏";
export const AIGC_BLOCKED_MESSAGE = "因上游失败被阻塞";

export interface AigcLogError {
  code: string | null;
  message: string;
  requestId: string | null;
  stage: string | null;
}

export interface AigcProviderTrace {
  requestId: string | null;
  taskId: string | null;
}

const localDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  year: "numeric"
});

export function formatAigcLogTime(value: string | null | undefined): string {
  if (!value) return "-";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "-";

  const parts = Object.fromEntries(
    localDateTimeFormatter
      .formatToParts(timestamp)
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatAigcEndTime(
  value: string | null | undefined,
  active: boolean
): string {
  const formatted = formatAigcLogTime(value);
  return formatted === "-" && active ? "进行中" : formatted;
}

export function formatAigcDuration(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
  active = false
): string {
  const started = parseTimestamp(startedAt);
  if (started === null) return "-";

  const finished = parseTimestamp(finishedAt);
  if (finished === null) return active ? "进行中" : "-";
  if (finished < started) return "-";

  return formatDurationMilliseconds(finished - started);
}

export function latestRelevantAttempt(
  node: Pick<AigcPipelineRunNode, "attempts" | "current_task_id">
): AigcPipelineTaskAttempt | null {
  if (node.attempts.length === 0) return null;

  const currentAttempt = node.current_task_id
    ? node.attempts.find(
        (attempt) => attempt.task_id === node.current_task_id
      )
    : undefined;
  if (currentAttempt) return currentAttempt;

  return node.attempts.reduce((latest, attempt) =>
    attempt.attempt > latest.attempt ? attempt : latest
  );
}

export function getAigcRunLogError(
  run: Pick<AigcPipelineRun, "error" | "status">
): AigcLogError | null {
  if (run.status !== "failed") return null;
  return toLogError(run.error);
}

export function getAigcNodeLogError(
  node: Pick<
    AigcPipelineRunNode,
    "attempts" | "current_task_id" | "error" | "status"
  >
): AigcLogError | null {
  if (node.status === "blocked") {
    return {
      code: null,
      message: AIGC_BLOCKED_MESSAGE,
      requestId: null,
      stage: null
    };
  }
  if (node.status !== "failed" && node.status !== "timed_out") return null;

  return toLogError(latestRelevantAttempt(node)?.error ?? node.error ?? null);
}

export function getAigcCacheReuse(
  node: Pick<AigcPipelineRunNode, "reused_from_task_id" | "status">
): string | null {
  return node.status === "reused"
    ? safeTraceValue(node.reused_from_task_id)
    : null;
}

export function formatAigcErrorStage(
  stage: string | null | undefined
): string | null {
  if (!stage) return null;
  const normalized = stage.trim().toLowerCase();
  if (
    ["initialization", "input_resolution", "scheduling", "validate", "validation"]
      .includes(normalized)
  ) {
    return "validate";
  }
  if (["create", "submit"].includes(normalized)) return "submit";
  if (["poll", "provider_poll"].includes(normalized)) return "poll";
  if (
    ["asset_transfer", "download", "store", "transfer"].includes(normalized)
  ) {
    return "transfer";
  }
  if (
    ["database", "db", "persist", "persistence", "repository"].includes(
      normalized
    )
  ) {
    return "persistence";
  }
  return safeStageValue(normalized);
}

export function getAigcProviderTrace(
  node: Pick<
    AigcPipelineRunNode,
    "attempts" | "current_task_id" | "result"
  >
): AigcProviderTrace | null {
  const attempt = latestRelevantAttempt(node);
  const assets =
    attempt?.result.assets.length
      ? attempt.result.assets
      : node.result.assets;
  const metadata = assets.find((asset) => asset.metadata)?.metadata;
  const requestId = safeTraceValue(metadata?.provider_request_id);
  const taskId = safeTraceValue(metadata?.provider_task_id);
  return requestId || taskId ? { requestId, taskId } : null;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDurationMilliseconds(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} 毫秒`;

  const totalSeconds = Math.floor(durationMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} 小时`);
  if (minutes > 0) parts.push(`${minutes} 分`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} 秒`);
  return parts.join(" ");
}

function toLogError(error: AigcTaskError | null): AigcLogError {
  return {
    code: error?.code ?? null,
    message: safeErrorMessage(error?.message),
    requestId: error?.request_id ?? null,
    stage: formatAigcErrorStage(error?.stage)
  };
}

function safeErrorMessage(value: string | null | undefined): string {
  if (!value) return AIGC_RUN_ERROR_FALLBACK;
  if (
    /https?:\/\//i.test(value) ||
    /\b(api[_ -]?key|authorization|bearer|credential|password|secret|signature|token)\b/i.test(
      value
    )
  ) {
    return AIGC_REDACTED_ERROR_FALLBACK;
  }
  return value;
}

function safeStageValue(value: string): string | null {
  return /^[a-z0-9_-]{1,80}$/.test(value) ? value : null;
}

function safeTraceValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[A-Za-z0-9._:/-]{1,255}$/.test(normalized) ? normalized : null;
}
