import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceAssetsPage from "@/app/workspace/assets/page";
import { WORKSPACE_ASSET_SOURCES } from "@/lib/workspace-asset-source";

const apiMocks = vi.hoisted(() => ({
  listAssets: vi.fn(),
  listProjects: vi.fn(),
  listToolAssets: vi.fn(),
  listToolTasks: vi.fn()
}));

vi.mock("@/components/workspace/workspace-asset-library", () => ({
  WorkspaceAssetLibrary: ({
    filters
  }: {
    filters: { source?: string };
  }) => <div data-testid="asset-library-source">{filters.source ?? "all"}</div>
}));

vi.mock("@/lib/api-client", () => ({
  createApiClient: () => apiMocks,
  getUserFacingErrorMessage: () => "服务暂时不可用，请稍后重试。"
}));

describe("WorkspaceAssetsPage source parsing", () => {
  beforeEach(() => {
    apiMocks.listAssets.mockReset().mockResolvedValue([]);
    apiMocks.listProjects.mockReset().mockResolvedValue([]);
    apiMocks.listToolAssets.mockReset().mockResolvedValue([]);
    apiMocks.listToolTasks.mockReset().mockResolvedValue([]);
  });

  it("uses a stable runtime array for supported sources", () => {
    expect(Array.isArray(WORKSPACE_ASSET_SOURCES)).toBe(true);
    expect(Object.isFrozen(WORKSPACE_ASSET_SOURCES)).toBe(true);
    expect(WORKSPACE_ASSET_SOURCES.includes("aigc")).toBe(true);
  });

  it("parses source=aigc without reading runtime values from the client module", async () => {
    render(
      await WorkspaceAssetsPage({
        searchParams: Promise.resolve({ source: "aigc" })
      })
    );

    expect(screen.getByTestId("asset-library-source")).toHaveTextContent("aigc");
    expect(apiMocks.listAssets).not.toHaveBeenCalled();
    expect(apiMocks.listToolAssets).toHaveBeenCalledOnce();
  });

  it("falls back to all assets for an unknown source", async () => {
    render(
      await WorkspaceAssetsPage({
        searchParams: Promise.resolve({ source: "unknown-source" })
      })
    );

    expect(screen.getByTestId("asset-library-source")).toHaveTextContent("all");
    expect(apiMocks.listAssets).toHaveBeenCalledOnce();
    expect(apiMocks.listToolAssets).toHaveBeenCalledOnce();
  });
});
