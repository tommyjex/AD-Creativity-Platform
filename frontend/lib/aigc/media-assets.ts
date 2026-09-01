import type { Asset, ReferenceAssetKind } from "@/lib/api-types";

const MEDIA_ASSET_TYPES: Record<
  ReferenceAssetKind,
  ReadonlySet<Asset["type"]>
> = {
  image: new Set(["generated_image", "uploaded_image"]),
  video: new Set(["uploaded_video", "storyboard_video", "final_video"]),
  audio: new Set(["uploaded_audio"])
};

export function isSelectableMediaAsset(
  asset: Asset,
  kind: ReferenceAssetKind
): boolean {
  if (
    asset.status !== "succeeded" ||
    asset.asset_role === "internal_base" ||
    asset.asset_role === "internal_layer"
  ) {
    return false;
  }
  return Boolean(
    asset.mime_type?.startsWith(`${kind}/`) ||
      MEDIA_ASSET_TYPES[kind].has(asset.type)
  );
}
