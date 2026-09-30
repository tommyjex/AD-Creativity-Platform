import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApp, AuthProvider } from "@/lib/auth/auth-provider";
import {
  getAuthRedirect,
  isPublicAuthPath
} from "@/lib/auth/route-guard";
import {
  canCreate,
  canManageUsers,
  canView
} from "@/lib/auth/permissions";
import type { AuthUser } from "@/lib/api-types";

const navigation = vi.hoisted(() => ({
  pathname: "/workspace/projects",
  replace: vi.fn(),
  search: ""
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search)
}));

const creator: AuthUser = {
  created_at: "2026-09-29T00:00:00Z",
  display_name: "Creator",
  id: "user-1",
  is_enabled: true,
  last_login_at: null,
  must_change_password: false,
  role: "creator",
  updated_at: "2026-09-29T00:00:00Z",
  username: "creator"
};

describe("authentication routing", () => {
  beforeEach(() => {
    navigation.pathname = "/workspace/projects";
    navigation.replace.mockReset();
    navigation.search = "";
  });

  it("routes setup, login and forced-password states while preserving target", () => {
    expect(
      getAuthRedirect({
        initialized: false,
        pathname: "/workspace/assets",
        search: "source=aigc",
        user: null
      })
    ).toBe("/setup?next=%2Fworkspace%2Fassets%3Fsource%3Daigc");
    expect(
      getAuthRedirect({
        initialized: true,
        pathname: "/workspace/assets",
        search: "",
        user: null
      })
    ).toBe("/login?next=%2Fworkspace%2Fassets");
    expect(
      getAuthRedirect({
        initialized: true,
        pathname: "/workspace/aigc",
        search: "view=pipelines",
        user: { ...creator, must_change_password: true }
      })
    ).toBe(
      "/change-password?next=%2Fworkspace%2Faigc%3Fview%3Dpipelines"
    );
  });

  it("does not redirect a matching public auth route", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
    expect(isPublicAuthPath("/setup/")).toBe(true);
    expect(isPublicAuthPath("/change-password")).toBe(true);
    expect(
      getAuthRedirect({
        initialized: true,
        pathname: "/login",
        search: "next=%2Fworkspace%2Fprojects",
        user: null
      })
    ).toBeNull();
  });

  it("rejects external and backslash-based return targets", () => {
    expect(
      getAuthRedirect({
        initialized: true,
        pathname: "/login",
        search: "next=https%3A%2F%2Fevil.example",
        user: creator
      })
    ).toBe("/workspace");
    expect(
      getAuthRedirect({
        initialized: true,
        pathname: "/login",
        search: "next=%2F%5Cevil.example",
        user: creator
      })
    ).toBe("/workspace");
  });

  it("centralizes role permissions", () => {
    expect(canView("viewer")).toBe(true);
    expect(canCreate("viewer")).toBe(false);
    expect(canCreate("creator")).toBe(true);
    expect(canManageUsers("creator")).toBe(false);
    expect(canManageUsers("admin")).toBe(true);
  });

  it("loads auth once and renders protected content for a valid user", async () => {
    const client = {
      getCurrentUser: vi.fn().mockResolvedValue(creator),
      getSetupStatus: vi.fn().mockResolvedValue({ initialized: true })
    };

    render(
      <AuthProvider client={client}>
        <AuthApp>
          <div>受保护内容</div>
        </AuthApp>
      </AuthProvider>
    );

    expect(screen.queryByText("受保护内容")).toBeNull();
    expect(await screen.findByText("受保护内容")).toBeInTheDocument();
    expect(client.getSetupStatus).toHaveBeenCalledTimes(1);
    expect(client.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("redirects on 401 without retrying and keeps session on 403", async () => {
    const client = {
      getCurrentUser: vi.fn().mockResolvedValue(creator),
      getSetupStatus: vi.fn().mockResolvedValue({ initialized: true })
    };

    render(
      <AuthProvider client={client}>
        <AuthApp>
          <div>受保护内容</div>
        </AuthApp>
      </AuthProvider>
    );
    await screen.findByText("受保护内容");

    act(() => {
      window.dispatchEvent(new CustomEvent("ad-auth:forbidden"));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("权限不足");
    expect(screen.getByText("受保护内容")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent("ad-auth:unauthorized"));
    });
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        "/login?next=%2Fworkspace%2Fprojects"
      );
    });
    expect(client.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("renders public auth routes without the workspace shell", async () => {
    navigation.pathname = "/login";
    const client = {
      getCurrentUser: vi.fn().mockRejectedValue({ status: 401 }),
      getSetupStatus: vi.fn().mockResolvedValue({ initialized: true })
    };

    render(
      <AuthProvider client={client}>
        <AuthApp>
          <div>登录内容</div>
        </AuthApp>
      </AuthProvider>
    );

    expect(await screen.findByText("登录内容")).toBeInTheDocument();
    expect(screen.queryByTestId("app-shell")).toBeNull();
  });
});
