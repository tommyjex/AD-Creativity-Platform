import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserManagement } from "@/components/admin/user-management";
import { ApiError, type ApiClient } from "@/lib/api-client";
import type { AuthUser, UserRole } from "@/lib/api-types";

const admin = makeUser({
  display_name: "系统管理员",
  id: "admin-1",
  last_login_at: "2026-09-29T02:30:00Z",
  role: "admin",
  username: "admin"
});
const viewer = makeUser({
  created_at: "2026-09-28T01:00:00Z",
  display_name: "审阅用户",
  id: "viewer-1",
  must_change_password: true,
  role: "viewer",
  username: "reviewer"
});

describe("admin user management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call the admin API for a non-admin visitor", () => {
    const client = makeClient();

    render(
      <UserManagement
        client={client}
        currentUser={{ ...viewer, role: "creator" }}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("无权访问用户管理");
    expect(client.listUsers).not.toHaveBeenCalled();
  });

  it("shows the compact user list and account state", async () => {
    const client = makeClient();
    render(<UserManagement client={client} currentUser={admin} />);

    expect(await screen.findByText("reviewer")).toBeInTheDocument();
    expect(screen.getByText("审阅用户")).toBeInTheDocument();
    expect(screen.getByText("仅查看")).toBeInTheDocument();
    expect(screen.getByText("需改密")).toBeInTheDocument();
    expect(screen.getAllByText("已启用")).toHaveLength(2);
    expect(screen.getByText("从未登录")).toBeInTheDocument();
    expect(client.listUsers).toHaveBeenCalledTimes(1);
  });

  it("creates a user once and appends the returned account", async () => {
    const created = makeUser({
      display_name: "创作用户",
      id: "creator-2",
      role: "creator",
      username: "creative.user"
    });
    const client = makeClient({
      createUser: vi.fn().mockResolvedValue(created)
    });
    render(<UserManagement client={client} currentUser={admin} />);
    await screen.findByText("reviewer");

    fireEvent.click(screen.getByRole("button", { name: "创建用户" }));
    fill("用户名", "creative.user");
    fill("显示名称", "创作用户");
    fireEvent.change(screen.getByLabelText("角色"), {
      target: { value: "creator" }
    });
    fill("临时密码", "temporary-pass-42");
    fill("确认临时密码", "temporary-pass-42");
    fireEvent.click(screen.getByRole("button", { name: "确认创建" }));
    fireEvent.submit(screen.getByRole("form", { name: "创建用户" }));

    expect(client.createUser).toHaveBeenCalledTimes(1);
    expect(client.createUser).toHaveBeenCalledWith({
      display_name: "创作用户",
      password: "temporary-pass-42",
      role: "creator",
      username: "creative.user"
    });
    expect(await screen.findByText("creative.user")).toBeInTheDocument();
  });

  it("shows a readable username conflict in the create dialog", async () => {
    const client = makeClient({
      createUser: vi.fn().mockRejectedValue(
        new ApiError({
          code: "username_conflict",
          message: "Username already exists.",
          responseBody: {},
          status: 409
        })
      )
    });
    render(<UserManagement client={client} currentUser={admin} />);
    await screen.findByText("reviewer");

    fireEvent.click(screen.getByRole("button", { name: "创建用户" }));
    fill("用户名", "reviewer");
    fill("显示名称", "重复用户");
    fireEvent.change(screen.getByLabelText("角色"), {
      target: { value: "viewer" }
    });
    fill("临时密码", "temporary-pass-42");
    fill("确认临时密码", "temporary-pass-42");
    fireEvent.click(screen.getByRole("button", { name: "确认创建" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "该用户名已存在"
    );
    expect(
      screen.getByRole("dialog", { name: "创建用户" })
    ).toBeInTheDocument();
  });

  it("changes a role and disables an account through confirmation dialogs", async () => {
    const promoted = { ...viewer, role: "creator" as const };
    const disabled = { ...promoted, is_enabled: false };
    const client = makeClient({
      updateUserRole: vi.fn().mockResolvedValue(promoted),
      updateUserStatus: vi.fn().mockResolvedValue(disabled)
    });
    render(<UserManagement client={client} currentUser={admin} />);
    await screen.findByText("reviewer");

    fireEvent.click(
      screen.getByRole("button", { name: "修改 reviewer 的角色" })
    );
    fireEvent.change(screen.getByLabelText("新角色"), {
      target: { value: "creator" }
    });
    fireEvent.click(screen.getByRole("button", { name: "保存角色" }));

    await waitFor(() => {
      expect(client.updateUserRole).toHaveBeenCalledWith(
        "viewer-1",
        "creator"
      );
    });
    expect(screen.getByText("创作者")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "停用 reviewer" })
    );
    fireEvent.click(screen.getByRole("button", { name: "确认停用" }));

    await waitFor(() => {
      expect(client.updateUserStatus).toHaveBeenCalledWith("viewer-1", false);
    });
    expect(screen.getByText("已停用")).toBeInTheDocument();
  });

  it("resets a temporary password and shows the forced-change state", async () => {
    const resetUser = { ...viewer, must_change_password: true };
    const client = makeClient({
      resetUserPassword: vi.fn().mockResolvedValue(resetUser)
    });
    render(<UserManagement client={client} currentUser={admin} />);
    await screen.findByText("reviewer");

    fireEvent.click(
      screen.getByRole("button", { name: "重置 reviewer 的密码" })
    );
    fill("新临时密码", "reset-password-42");
    fill("确认新临时密码", "reset-password-42");
    fireEvent.click(screen.getByRole("button", { name: "确认重置" }));

    await waitFor(() => {
      expect(client.resetUserPassword).toHaveBeenCalledWith(
        "viewer-1",
        "reset-password-42"
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "reviewer 的临时密码已重置"
    );
  });

  it("keeps the dialog open and explains the last-admin conflict", async () => {
    const client = makeClient({
      updateUserStatus: vi.fn().mockRejectedValue(
        new ApiError({
          code: "last_admin_required",
          message: "at least one enabled admin is required",
          responseBody: {},
          status: 409
        })
      )
    });
    render(<UserManagement client={client} currentUser={admin} />);
    await screen.findByText("reviewer");

    fireEvent.click(screen.getByRole("button", { name: "停用 admin" }));
    fireEvent.click(screen.getByRole("button", { name: "确认停用" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "必须保留至少一个已启用的管理员"
    );
    expect(
      screen.getByRole("dialog", { name: "停用用户" })
    ).toBeInTheDocument();
  });
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function makeUser(
  overrides: Partial<AuthUser> & {
    id: string;
    role: UserRole;
    username: string;
  }
): AuthUser {
  return {
    created_at: "2026-09-29T00:00:00Z",
    display_name: overrides.username,
    is_enabled: true,
    last_login_at: null,
    must_change_password: false,
    updated_at: "2026-09-29T00:00:00Z",
    ...overrides
  };
}

function makeClient(
  overrides: Partial<Pick<
    ApiClient,
    | "createUser"
    | "listUsers"
    | "resetUserPassword"
    | "updateUserRole"
    | "updateUserStatus"
  >> = {}
) {
  return {
    createUser: vi.fn(),
    listUsers: vi.fn().mockResolvedValue([admin, viewer]),
    resetUserPassword: vi.fn(),
    updateUserRole: vi.fn(),
    updateUserStatus: vi.fn(),
    ...overrides
  };
}
