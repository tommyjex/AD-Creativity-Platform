import type {
  AigcPipelineRun,
  AigcPipelineRunNode,
  AigcPipelineTaskAttempt,
  AigcTaskError
} from "@/lib/aigc/types";

export const AIGC_RUN_ERROR_FALLBACK = "执行失败，未提供详细原因";
export const AIGC_BLOCKED_MESSAGE = "因上游失败被阻塞";

export interface AigcLogError {
  code: string | null;
  message: string;
  requestId: string | null;
  stage: string | null;
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
    "attempts" | "current_task_id" | "status"
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

  return toLogError(latestRelevantAttempt(node)?.error ?? null);
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
    message: error?.message || AIGC_RUN_ERROR_FALLBACK,
    requestId: error?.request_id ?? null,
    stage: error?.stage ?? null
  };
}
