import {
  getAssetDownloadUrl,
  getSafePreviewUrl,
  getWorkspaceAssetDescription
} from "@/lib/asset-display";
import type { Asset, AssetType } from "@/lib/api-types";

export type HomeMediaKind = "image" | "video";

export interface HomeMediaItem {
  asset: Asset;
  downloadUrl: string;
  id: string;
  kind: HomeMediaKind;
  name: string;
  previewUrl: string;
  updatedAt: string;
}

const IMAGE_TYPES = new Set<AssetType>([
  "generated_image",
  "uploaded_image"
]);
const VIDEO_TYPES = new Set<AssetType>([
  "final_video",
  "storyboard_video",
  "uploaded_video"
]);

export function buildHomeMediaItems(assets: Asset[]): HomeMediaItem[] {
  const uniqueAssets = new Map<string, Asset>();

  for (const asset of assets) {
    if (!uniqueAssets.has(asset.id)) {
      uniqueAssets.set(asset.id, asset);
    }
  }

  return Array.from(uniqueAssets.values())
    .map(toHomeMediaItem)
    .filter((item): item is HomeMediaItem => item !== null)
    .sort(
      (left, right) =>
        parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt)
    );
}

function toHomeMediaItem(asset: Asset): HomeMediaItem | null {
  if (
    asset.asset_role === "internal_base" ||
    asset.asset_role === "internal_layer" ||
    asset.tool_asset_role === "input" ||
    (asset.project_id !== null &&
      (asset.type === "uploaded_image" || asset.type === "uploaded_video"))
  ) {
    return null;
  }

  const kind = getHomeMediaKind(asset);
  const previewUrl = getSafePreviewUrl(asset);
  const downloadUrl = getAssetDownloadUrl(asset);
  if (!kind || !previewUrl || !downloadUrl) {
    return null;
  }

  return {
    asset,
    downloadUrl,
    id: asset.id,
    kind,
    name: getWorkspaceAssetDescription(asset),
    previewUrl,
    updatedAt: asset.updated_at
  };
}

function getHomeMediaKind(asset: Asset): HomeMediaKind | null {
  if (IMAGE_TYPES.has(asset.type)) {
    return "image";
  }
  if (VIDEO_TYPES.has(asset.type)) {
    return "video";
  }
  if (asset.mime_type?.startsWith("image/")) {
    return "image";
  }
  if (asset.mime_type?.startsWith("video/")) {
    return "video";
  }
  return null;
}

function parseTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
