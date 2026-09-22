import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("exposes the projects, assets, tools and AIGC workspace entries", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    const projectLink = screen.getByRole("link", { name: "项目" });
    const assetLink = screen.getByRole("link", { name: "资产库" });
    const toolsLink = screen.getByRole("link", { name: "工具" });
    const aigcLink = screen.getByRole("link", { name: "AIGC工作台" });

    expect(projectLink).toHaveAttribute("href", "/workspace/projects");
    expect(assetLink).toHaveAttribute("href", "/workspace/assets");
    expect(toolsLink).toHaveAttribute("href", "/workspace/tools");
    expect(aigcLink).toHaveAttribute("href", "/workspace/aigc");
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

  it("marks the tools entry as current on the tools route", () => {
    navigationState.pathname = "/workspace/tools";
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "工具" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "项目" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("keeps the global shell and AIGC highlight on the AIGC list route", () => {
    navigationState.pathname = "/workspace/aigc";
    render(
      <AppShell>
        <div>AIGC 列表内容</div>
      </AppShell>
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AIGC工作台" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "项目" })).not.toHaveAttribute(
      "aria-current"
    );
    expect(screen.getByTestId("app-shell-content")).toHaveClass("pt-16");
  });

  it("uses the immersive shell on the Pipeline canvas route", () => {
    navigationState.pathname = "/workspace/aigc/pipelines/pipeline-1";
    render(
      <AppShell>
        <div>Pipeline 画布内容</div>
      </AppShell>
    );

    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByText("AD CREATIVITY")).toBeNull();
    expect(screen.queryByRole("button", { name: "打开导航菜单" })).toBeNull();
    expect(screen.getByTestId("app-shell")).toHaveClass(
      "min-h-[100dvh]",
      "bg-[#0b0d10]"
    );
    expect(screen.getByTestId("app-shell-content")).not.toHaveClass("pt-16");
  });

  it("uses the immersive shell on the template canvas route", () => {
    navigationState.pathname = "/workspace/aigc/templates/template-1/";
    render(
      <AppShell>
        <div>模板画布内容</div>
      </AppShell>
    );

    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByText("AD CREATIVITY")).toBeNull();
    expect(screen.queryByRole("button", { name: "打开导航菜单" })).toBeNull();
    expect(screen.getByTestId("app-shell")).toHaveClass(
      "min-h-[100dvh]",
      "bg-[#0b0d10]"
    );
    expect(screen.getByTestId("app-shell-content")).not.toHaveClass("pt-16");
  });

  it("uses the immersive shell on the AIGC layer editor route", () => {
    navigationState.pathname =
      "/workspace/aigc/pipelines/pipeline-1/nodes/canvas-node/layers";
    render(
      <AppShell>
        <div>图层编辑内容</div>
      </AppShell>
    );

    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByText("AD CREATIVITY")).toBeNull();
    expect(screen.getByTestId("app-shell")).toHaveClass(
      "min-h-[100dvh]",
      "bg-[#0b0d10]"
    );
    expect(screen.getByTestId("app-shell-content")).not.toHaveClass("pt-16");
  });

  it("uses the immersive shell on the AIGC timeline editor route", () => {
    navigationState.pathname =
      "/workspace/aigc/pipelines/pipeline-1/nodes/edit-node/timeline";
    render(
      <AppShell>
        <div>时间线编辑内容</div>
      </AppShell>
    );

    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.getByTestId("app-shell")).toHaveClass(
      "min-h-[100dvh]",
      "bg-[#0b0d10]"
    );
    expect(screen.getByTestId("app-shell-content")).not.toHaveClass("pt-16");
  });

  it("keeps the global shell on non-editor AIGC subroutes", () => {
    navigationState.pathname =
      "/workspace/aigc/pipelines/pipeline-1/nodes/canvas-node";
    render(
      <AppShell>
        <div>普通 AIGC 内容</div>
      </AppShell>
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AIGC工作台" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByTestId("app-shell-content")).toHaveClass("pt-16");
  });

  it("keeps the global shell and route highlight on ordinary workspace routes", () => {
    navigationState.pathname = "/workspace/assets";
    render(
      <AppShell>
        <div>资产库内容</div>
      </AppShell>
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "资产库" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByTestId("app-shell-content")).toHaveClass("pt-16");
  });

  it("removes the redundant status and workspace actions", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    expect(screen.queryByText("BRIEF READY")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "进入工作台" })
    ).toBeNull();
  });

  it("renders the decorative dark navigation background", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    const background = screen.getByTestId(
      "app-shell-navigation-background"
    );
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background.style.backgroundImage).toContain(
      "/images/navigation-generative-constellation.webp"
    );
    expect(background.style.backgroundImage).not.toContain(
      "copilot-cn.bytedance.net"
    );
    expect(background).toHaveClass("bg-cover", "bg-center");
    expect(screen.getByRole("banner")).toHaveClass("bg-[#14191f]");
  });

  it("uses a wider navigation container on extra-wide screens", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    expect(screen.getByTestId("app-shell-navigation-layout")).toHaveClass(
      "container",
      "2xl:max-w-[1600px]"
    );
  });

  it("opens and closes the mobile navigation menu", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    const trigger = screen.getByRole("button", { name: "打开导航菜单" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("mobile-navigation-menu")).toBeNull();

    fireEvent.click(trigger);
    const menu = screen.getByTestId("mobile-navigation-menu");
    expect(
      screen.getByRole("button", { name: "关闭导航菜单" })
    ).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getByRole("link", { name: "项目" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭导航菜单" }));
    expect(screen.queryByTestId("mobile-navigation-menu")).toBeNull();
  });

  it("closes the mobile navigation menu after selecting an entry", () => {
    render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
    const menu = screen.getByTestId("mobile-navigation-menu");
    const assetLink = within(menu).getByRole("link", { name: "资产库" });
    assetLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(assetLink);

    expect(screen.queryByTestId("mobile-navigation-menu")).toBeNull();
  });

  it("closes the mobile navigation menu when the route changes", () => {
    const { rerender } = render(
      <AppShell>
        <div>首页内容</div>
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
    expect(screen.getByTestId("mobile-navigation-menu")).toBeInTheDocument();

    navigationState.pathname = "/workspace/assets";
    rerender(
      <AppShell>
        <div>资产库内容</div>
      </AppShell>
    );

    expect(screen.queryByTestId("mobile-navigation-menu")).toBeNull();
  });
});
