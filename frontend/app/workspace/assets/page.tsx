import {
  WorkspaceAssetLibrary,
  type WorkspaceAssetFilters
} from "@/components/workspace/workspace-asset-library";
import {
  createApiClient,
  getUserFacingErrorMessage,
  type AssetFilters
} from "@/lib/api-client";
import { ASSET_SECTIONS, type AssetSection } from "@/lib/asset-display";
import {
  STATUSES,
  type Asset,
  type ProjectListItem,
  type Status
} from "@/lib/api-types";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function WorkspaceAssetsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const filters = parseFilters(await searchParams);
  const api = createApiClient();
  let assets: Asset[] = [];
  let projects: ProjectListItem[] = [];
  let error: string | undefined;

  try {
    // Cache the navigation render for 30s so switching project/section paints
    // quickly; deletes in the client refresh their own local state.
    [projects, assets] = await Promise.all([
      api.listProjects({ next: { revalidate: 30 } }),
      api.listAssets(toApiFilters(filters), { next: { revalidate: 30 } })
    ]);
  } catch (requestError) {
    error = getUserFacingErrorMessage(requestError);
  }

  return (
    <WorkspaceAssetLibrary
      assets={assets}
      error={error}
      filters={filters}
      projects={projects}
    />
  );
}

function parseFilters(
  searchParams: Awaited<SearchParams>
): WorkspaceAssetFilters {
  const projectId = firstValue(searchParams.project_id)?.trim();
  const section = firstValue(searchParams.section);
  const status = firstValue(searchParams.status);

  return {
    projectId: projectId || undefined,
    section: isAssetSection(section) ? section : undefined,
    status: isStatus(status) ? status : undefined
  };
}

/**
 * Sections are now selected client-side, so we no longer translate `section`
 * into a backend `category` filter — we fetch the full set (scoped only by
 * project/status) and classify into 全部/角色/场景/商品/产物 in the browser.
 */
function toApiFilters(filters: WorkspaceAssetFilters): AssetFilters {
  return {
    category: undefined,
    projectId: filters.projectId,
    status: filters.status
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isAssetSection(value: string | undefined): value is AssetSection {
  return (
    value !== undefined && ASSET_SECTIONS.includes(value as AssetSection)
  );
}

function isStatus(value: string | undefined): value is Status {
  return value !== undefined && STATUSES.includes(value as Status);
}
