import type { Asset, ReferenceAssetKind } from "@/lib/api-types";

const MB = 1024 * 1024;
const LAYER_DECOMPOSITION_MAX_BYTES = 30 * MB;
const LAYER_DECOMPOSITION_MIN_PIXELS = 262_144;
const LAYER_DECOMPOSITION_MAX_PIXELS = 36_000_000;

const MEDIA_RULES = {
  image: {
    extensions: new Set(["bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "tif", "tiff", "webp"]),
    maxBytes: 30 * MB,
    mimeTypes: new Set([
      "image/bmp",
      "image/gif",
      "image/heic",
      "image/heif",
      "image/jpeg",
      "image/png",
      "image/tiff",
      "image/webp"
    ]),
    strictMaximum: true
  },
  video: {
    extensions: new Set(["mov", "mp4"]),
    maxBytes: 200 * MB,
    mimeTypes: new Set(["video/mp4", "video/quicktime"]),
    strictMaximum: false
  },
  audio: {
    extensions: new Set(["mp3", "wav"]),
    maxBytes: 15 * MB,
    mimeTypes: new Set(["audio/mpeg", "audio/wav", "audio/x-wav"]),
    strictMaximum: false
  }
} as const;

export type MediaCompatibility =
  | { state: "available"; message: "规格可用" }
  | { state: "pending"; message: "执行前检测" }
  | { state: "incompatible"; message: string };

export function validateAigcMediaFile(
  kind: ReferenceAssetKind,
  file: Pick<File, "name" | "size" | "type">
): string | null {
  const rule = MEDIA_RULES[kind];
  const extension = file.name.split(".").pop()?.toLocaleLowerCase() ?? "";
  const mimeType = file.type.split(";", 1)[0].trim().toLocaleLowerCase();
  if (
    !rule.extensions.has(extension as never) ||
    (mimeType && !rule.mimeTypes.has(mimeType as never))
  ) {
    return `${mediaLabel(kind)}格式不支持`;
  }
  const exceeds = rule.strictMaximum
    ? file.size >= rule.maxBytes
    : file.size > rule.maxBytes;
  if (exceeds) {
    const qualifier = rule.strictMaximum ? "必须小于" : "不能超过";
    return `${mediaLabel(kind)}大小${qualifier} ${rule.maxBytes / MB} MB`;
  }
  return null;
}

export function aigcMediaCompatibility(
  asset: Asset,
  kind: ReferenceAssetKind
): MediaCompatibility {
  const rule = MEDIA_RULES[kind];
  const mimeType = asset.mime_type?.split(";", 1)[0].trim().toLocaleLowerCase();
  if (!mimeType || !rule.mimeTypes.has(mimeType as never)) {
    return { state: "incompatible", message: `${mediaLabel(kind)}格式不支持` };
  }
  if (asset.size_bytes !== null) {
    const exceeds = rule.strictMaximum
      ? asset.size_bytes >= rule.maxBytes
      : asset.size_bytes > rule.maxBytes;
    if (exceeds) {
      return { state: "incompatible", message: `${mediaLabel(kind)}文件过大` };
    }
  }
  if (asset.metadata.inspection_version !== 1) {
    return { state: "pending", message: "执行前检测" };
  }
  const intrinsicError = validateInspectedMetadata(asset, kind);
  return intrinsicError
    ? { state: "incompatible", message: intrinsicError }
    : { state: "available", message: "规格可用" };
}

export function validateLayerDecompositionFile(
  file: Pick<File, "name" | "size" | "type">
): string | null {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase() ?? "";
  const mimeType = file.type.split(";", 1)[0].trim().toLocaleLowerCase();
  if (
    !new Set(["jpeg", "jpg", "png"]).has(extension) ||
    (mimeType && mimeType !== "image/jpeg" && mimeType !== "image/png")
  ) {
    return "图层拆分仅支持 PNG/JPEG 图片";
  }
  return file.size >= LAYER_DECOMPOSITION_MAX_BYTES
    ? "图层拆分图片大小必须小于 30 MB"
    : null;
}

export function layerDecompositionCompatibility(
  asset: Asset
): MediaCompatibility {
  const message = layerDecompositionAssetError(asset);
  if (message) return { state: "incompatible", message };
  return asset.metadata.inspection_version === 1
    ? { state: "available", message: "规格可用" }
    : { state: "pending", message: "执行前检测" };
}

export function layerDecompositionAssetError(asset: Asset): string | null {
  const mimeType = asset.mime_type
    ?.split(";", 1)[0]
    .trim()
    .toLocaleLowerCase();
  if (mimeType !== "image/png" && mimeType !== "image/jpeg") {
    return "图层拆分仅支持 PNG/JPEG 图片";
  }
  if (
    asset.size_bytes !== null &&
    asset.size_bytes >= LAYER_DECOMPOSITION_MAX_BYTES
  ) {
    return "图层拆分图片大小必须小于 30 MB";
  }
  if (asset.metadata.inspection_version !== 1) return null;
  const width = metadataNumber(asset, "width");
  const height = metadataNumber(asset, "height");
  if (width === null || height === null) {
    return "图层拆分图片缺少尺寸信息";
  }
  const ratio = width / height;
  if (ratio < 1 / 16 || ratio > 16) {
    return "图层拆分图片宽高比需为 1:16-16:1";
  }
  const pixels = width * height;
  if (
    pixels < LAYER_DECOMPOSITION_MIN_PIXELS ||
    pixels > LAYER_DECOMPOSITION_MAX_PIXELS
  ) {
    return "图层拆分图片总像素需为 262,144-36,000,000";
  }
  return null;
}

function validateInspectedMetadata(
  asset: Asset,
  kind: ReferenceAssetKind
): string | null {
  const width = metadataNumber(asset, "width");
  const height = metadataNumber(asset, "height");
  if (kind !== "audio") {
    if (!width || !height) return "缺少尺寸信息";
    if (width < 300 || width > 6000 || height < 300 || height > 6000) {
      return "宽高需为 300-6000 px";
    }
    const ratio = width / height;
    if (ratio < 0.4 || ratio > 2.5) return "宽高比需为 0.4-2.5";
  }
  if (kind === "video") {
    const pixels = (width ?? 0) * (height ?? 0);
    if (pixels < 407_696 || pixels > 8_295_044) return "视频像素数不符合要求";
    const fps = metadataNumber(asset, "fps");
    if (!fps || fps < 24 || fps > 60) return "视频帧率需为 24-60 FPS";
  }
  return null;
}

function metadataNumber(asset: Asset, key: string): number | null {
  const value = asset.metadata[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function mediaLabel(kind: ReferenceAssetKind): string {
  if (kind === "image") return "图片";
  if (kind === "video") return "视频";
  return "音频";
}

export const AIGC_MEDIA_ACCEPT = {
  image: ".bmp,.gif,.heic,.heif,.jpeg,.jpg,.png,.tif,.tiff,.webp",
  video: ".mp4,.mov,video/mp4,video/quicktime",
  audio: ".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
} as const;
