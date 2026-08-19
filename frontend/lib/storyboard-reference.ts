import type { ReferenceAssetKind } from "@/lib/api-types";

const REFERENCE_PREFIXES = {
  audio: "参考音频",
  image: "参考图",
  video: "参考视频"
} satisfies Record<ReferenceAssetKind, string>;

const REFERENCE_PROMPT_TYPES = {
  audio: "音频",
  image: "图",
  video: "视频"
} satisfies Record<ReferenceAssetKind, string>;

const NO_SPACE_BEFORE = /[\s([{\u3008-\u3011“‘《【（：:，,。.!！？?；;、]$/u;
const NO_SPACE_AFTER = /^[\s)\]}\u3009-\u3011”’》】）：:，,。.!！？?；;、]/u;

export interface ReferenceInsertion {
  selectionEnd: number;
  selectionStart: number;
  text: string;
}

export function getReferenceLabel(
  kind: ReferenceAssetKind,
  zeroBasedIndex: number
): string {
  return `${REFERENCE_PREFIXES[kind]}${Math.max(0, zeroBasedIndex) + 1}`;
}

export function getReferencePromptToken(
  kind: ReferenceAssetKind,
  zeroBasedIndex: number
): string {
  return `(参考@${REFERENCE_PROMPT_TYPES[kind]}${Math.max(0, zeroBasedIndex) + 1})`;
}

export function insertReferenceAtSelection(
  text: string,
  label: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined
): ReferenceInsertion {
  const start = clampSelection(selectionStart, text.length);
  const end = Math.max(start, clampSelection(selectionEnd, text.length));
  const before = text.slice(0, start);
  const after = text.slice(end);
  const prefix = before.length > 0 && !NO_SPACE_BEFORE.test(before) ? " " : "";
  const suffix = after.length > 0 && !NO_SPACE_AFTER.test(after) ? " " : "";
  const inserted = `${prefix}${label}${suffix}`;
  const cursor = before.length + inserted.length;

  return {
    selectionEnd: cursor,
    selectionStart: cursor,
    text: `${before}${inserted}${after}`
  };
}

export function reindexReferencesAfterRemoval(
  text: string,
  kind: ReferenceAssetKind,
  removedZeroBasedIndex: number,
  previousCount: number
): string {
  if (
    removedZeroBasedIndex < 0 ||
    removedZeroBasedIndex >= previousCount ||
    previousCount <= 0
  ) {
    return text;
  }

  const prefix = REFERENCE_PREFIXES[kind];
  const promptType = REFERENCE_PROMPT_TYPES[kind];
  const removedNumber = removedZeroBasedIndex + 1;
  const promptTokenPattern = new RegExp(
    `\\(参考@${promptType}(\\d+)(?!\\d)\\)`,
    "gu"
  );
  const referencePattern = new RegExp(`${prefix}(\\d+)(?!\\d)`, "gu");
  const reindex = (
    match: string,
    rawNumber: string,
    format: (number: number) => string
  ) => {
    const number = Number(rawNumber);

    if (number === removedNumber) {
      return "";
    }

    if (number > removedNumber && number <= previousCount) {
      return format(number - 1);
    }

    return match;
  };
  const updated = text
    .replace(promptTokenPattern, (match, rawNumber: string) =>
      reindex(
        match,
        rawNumber,
        (number) => `(参考@${promptType}${number})`
      )
    )
    .replace(referencePattern, (match, rawNumber: string) =>
      reindex(match, rawNumber, (number) => `${prefix}${number}`)
    );

  return cleanRemovedReferenceSpacing(updated);
}

function clampSelection(value: number | null | undefined, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return max;
  }

  return Math.min(max, Math.max(0, Math.trunc(value)));
}

function cleanRemovedReferenceSpacing(value: string): string {
  return value
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/[ \t]+([，,。.!！？?；;、])/gu, "$1")
    .replace(/([，,。.!！？?；;、])[ \t]+/gu, "$1")
    .replace(/^[，,。.!！？?；;、]+[ \t]*/u, "")
    .replace(/^[ \t]+|[ \t]+$/gmu, "");
}
