import {
  WorkspaceAssetLibrary,
  WORKSPACE_ASSET_SOURCES,
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
  type Status,
  type ToolTask
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
  let toolTasks: ToolTask[] = [];
  let error: string | undefined;

  try {
    // Cache the navigation render for 30s so switching project/section paints
    // quickly; deletes in the client refresh their own local state.
    const [nextProjects, projectAssets, toolAssets, nextToolTasks] =
      await Promise.all([
      api.listProjects({ next: { revalidate: 30 } }),
      filters.source === "tools"
        ? Promise.resolve([])
        : api.listAssets(toApiFilters(filters), { next: { revalidate: 30 } }),
      filters.source === "projects"
        ? Promise.resolve([])
        : api.listToolAssets({ next: { revalidate: 30 } }),
      filters.source === "projects"
        ? Promise.resolve([])
        : api.listToolTasks({ next: { revalidate: 30 } })
    ]);
    projects = nextProjects;
    assets = [...projectAssets, ...toolAssets];
    toolTasks = nextToolTasks;
  } catch (requestError) {
    error = getUserFacingErrorMessage(requestError);
  }

  return (
    <WorkspaceAssetLibrary
      assets={assets}
      error={error}
      filters={filters}
      projects={projects}
      toolTasks={toolTasks}
    />
  );
}

function parseFilters(
  searchParams: Awaited<SearchParams>
): WorkspaceAssetFilters {
  const projectId = firstValue(searchParams.project_id)?.trim();
  const section = firstValue(searchParams.section);
  const status = firstValue(searchParams.status);
  const source = firstValue(searchParams.source);
  const parsedSource = isWorkspaceAssetSource(source) ? source : undefined;

  return {
    projectId: parsedSource === "tools" ? undefined : projectId || undefined,
    section: isAssetSection(section) ? section : undefined,
    source: parsedSource,
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
    projectId: filters.source === "tools" ? undefined : filters.projectId,
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

function isWorkspaceAssetSource(
  value: string | undefined
): value is WorkspaceAssetFilters["source"] {
  return (
    value !== undefined &&
    WORKSPACE_ASSET_SOURCES.includes(
      value as (typeof WORKSPACE_ASSET_SOURCES)[number]
    )
  );
}
