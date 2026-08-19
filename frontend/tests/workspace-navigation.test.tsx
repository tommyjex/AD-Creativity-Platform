import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";

const navigationState = vi.hoisted(() => ({
  pathname: "/workspace/projects"
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname
}));

describe("AppShell top navigation", () => {
  beforeEach(() => {
    navigationState.pathname = "/workspace/projects";
  });

  it("exposes the projects and assets workspace entries", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    const projectLink = screen.getByRole("link", { name: "项目" });
    const assetLink = screen.getByRole("link", { name: "资产库" });

    expect(projectLink).toHaveAttribute("href", "/workspace/projects");
    expect(assetLink).toHaveAttribute("href", "/workspace/assets");
  });

  it("does not render the removed anchor navigation items", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: "创作中枢" })).toBeNull();
    expect(screen.queryByRole("link", { name: "平台能力" })).toBeNull();
    expect(screen.queryByRole("link", { name: "端到端流程" })).toBeNull();
  });

  it("marks the projects entry as current on the projects route", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "项目" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "资产库" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("marks the assets entry as current on the assets route", () => {
    navigationState.pathname = "/workspace/assets";
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "资产库" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "项目" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("links the home workspace entry to the projects module", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "进入工作台" })).toHaveAttribute(
      "href",
      "/workspace/projects"
    );
  });
});
