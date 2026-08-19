import type { Asset, AssetType, Stage, Status } from "@/lib/api-types";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "signal"
  | "success"
  | "warning"
  | "info";

export function summarizeAssets(assets: Asset[]) {
  return assets.reduce(
    (summary, asset) => {
      if (asset.type === "generated_image" || asset.type === "uploaded_image") {
        summary.images += 1;
      }

      if (asset.type === "storyboard_video" || asset.type === "uploaded_video") {
        summary.videos += 1;
      }

      if (asset.type === "final_video") {
        summary.finalVideos += 1;
      }

      return summary;
    },
    { finalVideos: 0, images: 0, videos: 0 }
  );
}

export function getStageLabel(stage: Stage): string {
  return (
    {
      brief: "Brief",
      character: "角色",
      compose: "剪辑",
      image: "生图",
      script: "剧本",
      story: "故事",
      storyboard: "分镜",
      video: "生视频"
    } satisfies Record<Stage, string>
  )[stage];
}

export function getAssetTypeLabel(type: AssetType): string {
  return (
    {
      final_video: "最终成片",
      generated_image: "生成图片",
      storyboard_video: "分镜视频",
      subtitle: "字幕文件",
      uploaded_audio: "上传音频",
      uploaded_video: "上传视频",
      uploaded_image: "上传图片"
    } satisfies Record<AssetType, string>
  )[type];
}

export function statusVariant(status: Status): BadgeVariant {
  if (status === "succeeded" || status === "skipped") {
    return "success";
  }

  if (status === "failed" || status === "cancelled" || status === "expired") {
    return "destructive";
  }

  if (status === "queued" || status === "running") {
    return "signal";
  }

  if (status === "stale") {
    return "warning";
  }

  return "secondary";
}

export function formatDate(value: string): string {
  const normalizedValue = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : `${value}Z`;
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(new Date(normalizedValue));
}

export function formatBytes(value: number | null): string {
  if (value === null) {
    return "未知大小";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
