import type { CSSProperties } from "react";

export function getViewportBoundPreviewStyle(
  aspectRatio: string,
  maxHeightDvh: number,
  maxHeightRem: number
): CSSProperties {
  const [rawWidth, rawHeight] = aspectRatio
    .split(/[:/]/)
    .map((part) => Number(part.trim()));
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 16;
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 9;
  const ratio = width / height;

  return {
    aspectRatio: `${width} / ${height}`,
    width: `min(100%, ${formatCssNumber(maxHeightDvh * ratio)}dvh, ${formatCssNumber(maxHeightRem * ratio)}rem)`
  };
}

function formatCssNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}
