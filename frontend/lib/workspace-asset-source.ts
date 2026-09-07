import type { AssetSection } from "@/lib/asset-display";
import type { Status } from "@/lib/api-types";

export const WORKSPACE_ASSET_SOURCES = Object.freeze([
  "all",
  "projects",
  "tools",
  "aigc"
] as const);

export type WorkspaceAssetSource = (typeof WORKSPACE_ASSET_SOURCES)[number];

export interface WorkspaceAssetFilters {
  projectId?: string;
  section?: AssetSection;
  status?: Status;
  source?: WorkspaceAssetSource;
}
