import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/lib/api-client";
import { setClientPermissionSubject } from "@/lib/auth/permissions";
import type { AuthUser } from "@/lib/api-types";

const user: AuthUser = {
  created_at: "2026-09-29T00:00:00Z",
  display_name: "Admin",
  id: "user-1",
  is_enabled: true,
  last_login_at: null,
  must_change_password: false,
  role: "admin",
  updated_at: "2026-09-29T00:00:00Z",
  username: "admin"
};

describe("authentication API contract", () => {
  afterEach(() => {
    setClientPermissionSubject(null);
  });

  it("uses the specified auth endpoints and same-origin credentials", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/setup-status")) {
        return jsonResponse({ initialized: true });
      }
      if (path.endsWith("/logout")) {
        return new Response(null, { status: 204 });
      }
      return jsonResponse(user);
    });
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await api.getSetupStatus();
    await api.setup({
      display_name: "Admin",
      password: "correct horse battery staple",
      username: "admin"
    });
    await api.login({
      password: "correct horse battery staple",
      username: "admin"
    });
    await api.logout();
    await api.getCurrentUser();
    await api.changePassword({
      current_password: "temporary password 123",
      new_password: "permanent password 123"
    });

    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "http://backend.local/api/auth/setup-status",
      "http://backend.local/api/auth/setup",
      "http://backend.local/api/auth/login",
      "http://backend.local/api/auth/logout",
      "http://backend.local/api/auth/me",
      "http://backend.local/api/auth/change-password"
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      "GET",
      "POST",
      "POST",
      "POST",
      "GET",
      "POST"
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.credentials).toBe("same-origin");
    }
  });

  it("uses the specified admin user endpoints", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname;
      return jsonResponse(path.endsWith("/users") ? [user] : user);
    });
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await api.listUsers();
    await api.createUser({
      display_name: "Creator",
      password: "temporary password 123",
      role: "creator",
      username: "creator"
    });
    await api.updateUserRole("user/2", "viewer");
    await api.updateUserStatus("user/2", false);
    await api.resetUserPassword("user/2", "replacement password 123");

    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      "http://backend.local/api/admin/users",
      "http://backend.local/api/admin/users",
      "http://backend.local/api/admin/users/user%2F2/role",
      "http://backend.local/api/admin/users/user%2F2/status",
      "http://backend.local/api/admin/users/user%2F2/reset-password"
    ]);
  });

  it("emits one auth event for 401 and 403 responses without retrying", async () => {
    const unauthorized = vi.fn();
    const forbidden = vi.fn();
    window.addEventListener("ad-auth:unauthorized", unauthorized);
    window.addEventListener("ad-auth:forbidden", forbidden);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(errorResponse(401, "authentication_required"))
      .mockResolvedValueOnce(errorResponse(403, "permission_denied"));
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });

    await expect(api.getCurrentUser()).rejects.toMatchObject({ status: 401 });
    await expect(api.listUsers()).rejects.toMatchObject({ status: 403 });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(unauthorized).toHaveBeenCalledTimes(1);
    expect(forbidden).toHaveBeenCalledTimes(1);
    window.removeEventListener("ad-auth:unauthorized", unauthorized);
    window.removeEventListener("ad-auth:forbidden", forbidden);
  });

  it("blocks viewer business mutations before fetch while allowing reads and auth posts", async () => {
    const forbidden = vi.fn();
    window.addEventListener("ad-auth:forbidden", forbidden);
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/logout")) {
        return new Response(null, { status: 204 });
      }
      return jsonResponse(path.endsWith("/projects") ? [] : user);
    });
    const api = createApiClient({
      baseUrl: "http://backend.local",
      fetcher
    });
    setClientPermissionSubject("viewer");

    await api.listProjects();
    await api.logout();
    await expect(
      api.createProject({
        brief: {
          aspect_ratio: "16:9",
          duration_seconds: 30,
          prompt: "test",
          target_platform: "douyin"
        },
        name: "Blocked project",
        project_type: "video_ad"
      })
    ).rejects.toMatchObject({
      code: "permission_denied",
      status: 403
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(forbidden).toHaveBeenCalledTimes(1);
    window.removeEventListener("ad-auth:forbidden", forbidden);
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

function errorResponse(status: number, code: string): Response {
  return new Response(
    JSON.stringify({
      detail: { code, message: "request rejected" }
    }),
    {
      headers: { "content-type": "application/json" },
      status
    }
  );
}
