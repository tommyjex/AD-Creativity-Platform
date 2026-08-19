import type { Asset } from "@/lib/api-types";
import { getSafePreviewUrl } from "@/lib/asset-display";

export interface ComparisonVersion {
  assetId: string;
  url: string;
  kind: "original" | "edit";
  editPrompt?: string;
  createdAt: string;
  isCurrent: boolean;
}

/**
 * 从项目资产中收集某个分镜的全部可播放视频版本。
 *
 * - 归属判断：`type === "storyboard_video"` 且 `metadata.shot_id === shotId`
 *   （原视频与编辑候选都写了 `shot_id`）。
 * - 只保留 `status === "succeeded"` 且有可用预览地址的版本，异常项跳过。
 * - `operation === "video_edit"` 的是编辑候选，否则视为原视频/基底。
 * - 按 `created_at` 升序排序（原视频通常最早，排在最前）。
 * - `currentAssetId` 用于标注哪个版本是该分镜当前视频。
 */
export function collectShotVideoVersions(
  assets: Asset[],
  shotId: string,
  currentAssetId: string | null
): ComparisonVersion[] {
  return assets
    .filter(
      (asset) =>
        asset.type === "storyboard_video" &&
        asset.metadata.shot_id === shotId &&
        asset.status === "succeeded"
    )
    .flatMap<ComparisonVersion>((asset) => {
      const url = getSafePreviewUrl(asset);
      if (!url) {
        return [];
      }
      const kind: ComparisonVersion["kind"] =
        asset.metadata.operation === "video_edit" ? "edit" : "original";
      const editPromptValue = asset.metadata.edit_prompt;
      return [
        {
          assetId: asset.id,
          url,
          kind,
          editPrompt:
            kind === "edit" && typeof editPromptValue === "string"
              ? editPromptValue
              : undefined,
          createdAt: asset.created_at,
          isCurrent: asset.id === currentAssetId
        }
      ];
    })
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}
