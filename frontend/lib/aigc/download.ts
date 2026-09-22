import { migrateAigcRunSnapshotV2 } from "@/lib/aigc/definition-migration";
import { deriveAigcNodeDisplayNames } from "@/lib/aigc/node-display-name";
import type {
  AigcPipelineDefinition,
  AigcPipelineDefinitionV2,
  AigcResultAsset
} from "@/lib/aigc/types";
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
  title: string,
  definition?: AigcPipelineDefinition | AigcPipelineDefinitionV2
): AigcAssetDownload | null {
  return getAigcAssetDownload(
    asset,
    title,
    "图片结果",
    imageExtension,
    true,
    definition
  );
}

export function getAigcVideoDownload(
  asset: AigcResultAsset | undefined,
  title: string,
  definition?: AigcPipelineDefinition | AigcPipelineDefinitionV2
): AigcAssetDownload | null {
  return getAigcAssetDownload(
    asset,
    title,
    "视频结果",
    videoExtension,
    true,
    definition
  );
}

export function getAigcAudioDownload(
  asset: AigcResultAsset | undefined,
  title: string
): AigcAssetDownload | null {
  return getAigcAssetDownload(
    asset,
    title,
    "音频结果",
    audioExtension,
    false
  );
}

export function getAigcSubtitleDownload(
  asset: AigcResultAsset | undefined,
  title: string
): AigcAssetDownload | null {
  return getAigcAssetDownload(asset, title, "字幕结果", () => "srt", false);
}

function getAigcAssetDownload(
  asset: AigcResultAsset | undefined,
  title: string,
  fallbackTitle: string,
  extension: (mimeType: string | null) => string,
  omitFirstOrdinalSuffix: boolean,
  definition?: AigcPipelineDefinition | AigcPipelineDefinitionV2
): AigcAssetDownload | null {
  if (
    !asset?.available ||
    !getSafeAssetContentUrl(asset.download_url) ||
    !asset.asset_id.trim()
  ) {
    return null;
  }
  const fileExtension = extension(asset.mime_type);
  const naming = aigcDownloadNaming(
    asset,
    title,
    fallbackTitle,
    definition
  );
  const ordinalSuffix =
    !naming.applyOrdinal ||
    (omitFirstOrdinalSuffix && asset.ordinal === 0)
      ? ""
      : `-${asset.ordinal + 1}`;
  const filename = utf8LimitedFilename(
    naming.basename,
    `${ordinalSuffix}.${fileExtension}`
  );
  const url = getAssetDownloadUrlById(asset.asset_id, filename);
  if (!url) return null;
  return {
    filename,
    url
  };
}

function aigcDownloadNaming(
  asset: AigcResultAsset,
  title: string,
  fallbackTitle: string,
  definition?: AigcPipelineDefinition | AigcPipelineDefinitionV2
): { applyOrdinal: boolean; basename: string } {
  const metadataName = metadataText(asset, "name");
  const nameScheme = metadataText(asset, "name_scheme");
  const explicitName =
    nameScheme === "user_defined_v1" ? metadataName : null;
  const currentNodeName = currentGeneratedNodeName(asset, definition);
  const generatedName = metadataText(asset, "generated_name");
  const candidate = explicitName ?? currentNodeName ?? generatedName;
  if (candidate) {
    return {
      applyOrdinal: explicitName === null,
      basename: sanitizeBasename(candidate, fallbackTitle)
    };
  }
  if (metadataName) {
    return {
      applyOrdinal: false,
      basename: sanitizeBasename(metadataName, fallbackTitle)
    };
  }
  return {
    applyOrdinal: true,
    basename: sanitizeBasename(title || fallbackTitle, fallbackTitle)
  };
}

function currentGeneratedNodeName(
  asset: AigcResultAsset,
  definition?: AigcPipelineDefinition | AigcPipelineDefinitionV2
): string | null {
  const nodeId = metadataText(asset, "node_id");
  if (!definition || !nodeId) return null;
  const migrated = migrateAigcRunSnapshotV2(definition);
  const node = migrated.nodes.find((candidate) => candidate.id === nodeId);
  if (
    !node ||
    !(
      node.type === "text_to_image" ||
      node.type === "video_generation" ||
      (node.type === "image_to_image" &&
        node.config.operation !== "layer_decomposition")
    )
  ) {
    return null;
  }
  return (
    deriveAigcNodeDisplayNames(migrated.nodes).get(nodeId)?.displayName ?? null
  );
}

function metadataText(asset: AigcResultAsset, key: string): string | null {
  const value = asset.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sanitizeBasename(value: string, fallback: string): string {
  let sanitized = value
    .trim()
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-")
    .replace(/[\s-]+/g, "-")
    .replace(/[.\s-]+$/g, "");
  for (const extension of [
    ".jpeg",
    ".mpeg",
    ".webm",
    ".jpg",
    ".mov",
    ".mp4",
    ".png",
    ".webp"
  ]) {
    if (sanitized.toLowerCase().endsWith(extension)) {
      sanitized = sanitized
        .slice(0, -extension.length)
        .replace(/[.\s-]+$/g, "");
      break;
    }
  }
  return sanitized || fallback;
}

function utf8LimitedFilename(basename: string, suffix: string): string {
  const encoder = new TextEncoder();
  const budget = 180 - encoder.encode(suffix).byteLength;
  let used = 0;
  let truncated = "";
  for (const character of basename) {
    const bytes = encoder.encode(character).byteLength;
    if (used + bytes > Math.max(1, budget)) break;
    truncated += character;
    used += bytes;
  }
  return `${truncated.replace(/[.\s-]+$/g, "") || "AIGC节点"}${suffix}`;
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
