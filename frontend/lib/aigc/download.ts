import type { AigcResultAsset } from "@/lib/aigc/types";
import {
  getAssetDownloadUrlById,
  getSafeAssetContentUrl
} from "@/lib/asset-display";

export interface AigcAssetDownload {
  filename: string;
  url: string;
}

export function getAigcImageDownload(
  asset: AigcResultAsset | undefined,
  title: string
): AigcAssetDownload | null {
  return getAigcAssetDownload(asset, title, "图片结果", imageExtension);
}

export function getAigcVideoDownload(
  asset: AigcResultAsset | undefined,
  title: string
): AigcAssetDownload | null {
  return getAigcAssetDownload(asset, title, "视频结果", videoExtension);
}

export function getAigcAudioDownload(
  asset: AigcResultAsset | undefined,
  title: string
): AigcAssetDownload | null {
  return getAigcAssetDownload(asset, title, "音频结果", audioExtension);
}

function getAigcAssetDownload(
  asset: AigcResultAsset | undefined,
  title: string,
  fallbackTitle: string,
  extension: (mimeType: string | null) => string
): AigcAssetDownload | null {
  if (
    !asset?.available ||
    !getSafeAssetContentUrl(asset.download_url) ||
    !asset.asset_id.trim()
  ) {
    return null;
  }
  const baseName =
    title
      .trim()
      .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[.\s-]+$/g, "")
      .slice(0, 80) || fallbackTitle;
  const filename = `${baseName}-${asset.ordinal + 1}.${extension(asset.mime_type)}`;
  const url = getAssetDownloadUrlById(asset.asset_id, filename);
  if (!url) return null;
  return {
    filename,
    url
  };
}

function imageExtension(mimeType: string | null): "jpg" | "png" | "webp" {
  const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/webp") return "webp";
  return "png";
}

function videoExtension(
  mimeType: string | null
): "mov" | "mp4" | "mpeg" | "webm" {
  const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
  if (normalized === "video/quicktime") return "mov";
  if (normalized === "video/webm") return "webm";
  if (normalized === "video/mpeg") return "mpeg";
  return "mp4";
}

function audioExtension(
  mimeType: string | null
): "aac" | "m4a" | "mp3" | "ogg" | "wav" {
  const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
  if (normalized === "audio/aac") return "aac";
  if (normalized === "audio/mp4" || normalized === "audio/x-m4a") return "m4a";
  if (normalized === "audio/ogg") return "ogg";
  if (normalized === "audio/wav" || normalized === "audio/x-wav") return "wav";
  return "mp3";
}
