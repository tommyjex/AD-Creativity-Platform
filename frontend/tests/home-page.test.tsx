import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import type { Asset } from "@/lib/api-types";

const apiMocks = vi.hoisted(() => ({
  listAssets: vi.fn(),
  listToolAssets: vi.fn()
}));

vi.mock("@/components/home-generated-media-gallery", () => ({
  HomeGeneratedMediaGallery: ({
    assets,
    error
  }: {
    assets: Asset[];
    error?: string;
  }) => (
    <div>
      <span data-testid="home-gallery-assets">{assets.length}</span>
      <span data-testid="home-gallery-error">{error ?? ""}</span>
    </div>
  )
}));

vi.mock("@/lib/api-client", () => ({
  createApiClient: () => apiMocks,
  getUserFacingErrorMessage: () => "服务暂时不可用，请稍后重试。"
}));

const projectAsset = { id: "project-asset" } as Asset;
const toolAsset = { id: "tool-asset" } as Asset;

describe("Home page", () => {
  beforeEach(() => {
    apiMocks.listAssets.mockReset().mockResolvedValue([projectAsset]);
    apiMocks.listToolAssets.mockReset().mockResolvedValue([toolAsset]);
  });

  it("loads and combines project, tool and AIGC assets", async () => {
    render(await Home());

    expect(apiMocks.listAssets).toHaveBeenCalledWith(
      {},
      { next: { revalidate: 30 } }
    );
    expect(apiMocks.listToolAssets).toHaveBeenCalledWith({
      next: { revalidate: 30 }
    });
    expect(screen.getByTestId("home-gallery-assets")).toHaveTextContent("2");
    expect(screen.getByTestId("home-gallery-error")).toBeEmptyDOMElement();
  });

  it("renders the gallery error state when asset loading fails", async () => {
    apiMocks.listToolAssets.mockRejectedValue(new Error("offline"));

    render(await Home());

    expect(screen.getByTestId("home-gallery-assets")).toHaveTextContent("0");
    expect(screen.getByTestId("home-gallery-error")).toHaveTextContent(
      "服务暂时不可用，请稍后重试。"
    );
  });
});
