import type {
  Asset,
  AssetCategory,
  AssetMetadataValue,
  AssetType,
  Status
} from "@/lib/api-types";
import { getBackendBaseUrl } from "@/lib/api-client";

const CATEGORY_LABELS = {
  character: "角色",
  reference: "参考素材",
  scene: "场景"
} satisfies Record<AssetCategory, string>;

export const ASSET_SECTIONS = [
  "character",
  "scene",
  "product",
  "artifacts"
] as const;

export type AssetSection = (typeof ASSET_SECTIONS)[number];

export const ASSET_SIDEBAR_OPTIONS = [
  "all",
  "character",
  "scene",
  "product",
  "artifacts"
] as const;

export type AssetSidebarOption = (typeof ASSET_SIDEBAR_OPTIONS)[number];

const SECTION_LABELS = {
  artifacts: "产物",
  character: "角色",
  product: "图片",
  scene: "场景"
} satisfies Record<AssetSection, string>;

const SECTION_DESCRIPTIONS = {
  artifacts: "分镜视频片段、尾帧图与视频编辑结果等创作产物。",
  character: "项目中的角色形象资产。",
  product: "文生图、图片编辑与图层合成的公开图片成品。",
  scene: "项目中的场景视觉资产。"
} satisfies Record<AssetSection, string>;

export type ArtifactKind = "storyboard_video" | "last_frame" | "final_video";

const ARTIFACT_KIND_LABELS = {
  final_video: "视频编辑结果",
  last_frame: "尾帧图",
  storyboard_video: "分镜视频片段"
} satisfies Record<ArtifactKind, string>;

/** Short "资产类型" tags that distinguish artifact subtypes on cards. */
const ARTIFACT_KIND_TYPE_LABELS = {
  final_video: "产物-视频编辑",
  last_frame: "产物-尾帧",
  storyboard_video: "产物-分镜视频"
} satisfies Record<ArtifactKind, string>;

const ARTIFACT_ASSET_TYPES = new Set<AssetType>([
  "storyboard_video",
  "final_video"
]);
const IMAGE_PRODUCT_OPERATIONS = new Set([
  "text_to_image",
  "image_to_image",
  "layer_composite"
]);

export interface ArtifactDisplayItem {
  key: string;
  kind: ArtifactKind;
  /** Host asset. For last-frame items this is the parent storyboard video asset. */
  asset: Asset;
  isLastFrame: boolean;
}

const STATUS_LABELS = {
  cancelled: "已取消",
  draft: "草稿",
  expired: "已过期",
  failed: "失败",
  queued: "排队中",
  running: "生成中",
  skipped: "已跳过",
  stale: "需更新",
  succeeded: "已完成"
} satisfies Record<Status, string>;

const DEFAULT_DESCRIPTIONS = {
  character: "角色形象资产",
  reference: "分镜视频参考素材",
  scene: "场景视觉资产"
} satisfies Record<AssetCategory, string>;

export function getAssetCategoryLabel(category: AssetCategory): string {
  return CATEGORY_LABELS[category];
}

export function getAssetSectionLabel(section: AssetSection): string {
  return SECTION_LABELS[section];
}

export function getAssetSidebarLabel(option: AssetSidebarOption): string {
  return option === "all" ? "全部" : SECTION_LABELS[option];
}

export function getAssetSectionDescription(section: AssetSection): string {
  return SECTION_DESCRIPTIONS[section];
}

export function getArtifactKindLabel(kind: ArtifactKind): string {
  return ARTIFACT_KIND_LABELS[kind];
}

export function getArtifactKindTypeLabel(kind: ArtifactKind): string {
  return ARTIFACT_KIND_TYPE_LABELS[kind];
}

export function isArtifactAsset(asset: Asset): boolean {
  return ARTIFACT_ASSET_TYPES.has(asset.type);
}

export function isImageProductAsset(asset: Asset): boolean {
  return (
    asset.type === "generated_image" &&
    asset.asset_role !== "internal_base" &&
    asset.asset_role !== "internal_layer" &&
    typeof asset.metadata.operation === "string" &&
    IMAGE_PRODUCT_OPERATIONS.has(asset.metadata.operation)
  );
}

export function getImageOperationLabel(asset: Asset): string {
  const operation = asset.metadata.operation;
  if (operation === "text_to_image") return "文生图";
  if (operation === "image_to_image") return "图片编辑";
  if (operation === "layer_composite") return "图层合成";
  return "图片产物";
}

function hasAvailableLastFrame(asset: Asset): boolean {
  return (
    asset.type === "storyboard_video" &&
    asset.metadata.last_frame_status === "available" &&
    getSafeLastFrameUrl(asset) !== null
  );
}

/**
 * Aggregate the "产物" section from raw assets. Storyboard videos and final
 * videos surface directly, and every storyboard video that carries an available
 * last-frame companion additionally yields a derived "尾帧图" display item.
 */
export function buildArtifactItems(assets: Asset[]): ArtifactDisplayItem[] {
  const items: ArtifactDisplayItem[] = [];

  for (const asset of assets) {
    if (asset.type === "storyboard_video") {
      items.push({
        asset,
        isLastFrame: false,
        key: asset.id,
        kind: "storyboard_video"
      });
      if (hasAvailableLastFrame(asset)) {
        items.push({
          asset,
          isLastFrame: true,
          key: `${asset.id}:last-frame`,
          kind: "last_frame"
        });
      }
    } else if (asset.type === "final_video") {
      items.push({
        asset,
        isLastFrame: false,
        key: asset.id,
        kind: "final_video"
      });
    }
  }

  return items;
}

export function getStatusLabel(status: Status): string {
  return STATUS_LABELS[status];
}

export function getWorkspaceAssetDescription(asset: Asset): string {
  const metadata = asset.metadata;

  return (
    getMetadataText(metadata.description) ??
    getMetadataText(metadata.name) ??
    getMetadataText(metadata.prompt_summary) ??
    getMetadataText(metadata.prompt) ??
    (asset.category ? DEFAULT_DESCRIPTIONS[asset.category] : "创意资产")
  );
}

/** Case-insensitive substring match; an empty keyword matches everything. */
function matchesKeyword(text: string, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return text.toLowerCase().includes(needle);
}

export function assetMatchesKeyword(asset: Asset, keyword: string): boolean {
  return matchesKeyword(getWorkspaceAssetDescription(asset), keyword);
}

export function artifactMatchesKeyword(
  item: ArtifactDisplayItem,
  keyword: string
): boolean {
  return (
    matchesKeyword(getArtifactKindLabel(item.kind), keyword) ||
    matchesKeyword(getWorkspaceAssetDescription(item.asset), keyword)
  );
}

export function getSafePreviewUrl(asset: Asset): string | null {
  return getSafeMediaUrl(asset.url, "/content");
}

export function getSafeLastFrameUrl(asset: Asset): string | null {
  const value = asset.metadata.last_frame_url;
  return getSafeMediaUrl(
    typeof value === "string" ? value : null,
    "/last-frame"
  );
}

function getSafeMediaUrl(
  value: string | null,
  expectedApiSuffix: string
): string | null {
  if (!value) {
    return null;
  }

  if (
    value.startsWith("/api/assets/") &&
    value.endsWith(expectedApiSuffix)
  ) {
    return `${getBackendBaseUrl().replace(/\/+$/, "")}${value}`;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getMetadataText(value: AssetMetadataValue | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
