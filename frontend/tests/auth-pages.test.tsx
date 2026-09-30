import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { LoginForm } from "@/components/auth/login-form";
import { SetupForm } from "@/components/auth/setup-form";
import { ApiError } from "@/lib/api-client";
import type { AuthUser } from "@/lib/api-types";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "next=%2Fworkspace%2Fassets"
}));
const auth = vi.hoisted(() => ({
  setSessionUser: vi.fn(),
  user: null as AuthUser | null
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.search)
}));

vi.mock("@/lib/auth/auth-provider", () => ({
  useAuth: () => auth
}));

const user: AuthUser = {
  created_at: "2026-09-29T00:00:00Z",
  display_name: "管理员",
  id: "user-1",
  is_enabled: true,
  last_login_at: null,
  must_change_password: false,
  role: "admin",
  updated_at: "2026-09-29T00:00:00Z",
  username: "admin.user"
};

describe("authentication forms", () => {
  beforeEach(() => {
    auth.setSessionUser.mockReset();
    auth.user = user;
    navigation.replace.mockReset();
    navigation.search = "next=%2Fworkspace%2Fassets";
  });

  it("validates setup fields before sending a request", async () => {
    const setup = vi.fn();
    render(<SetupForm client={{ setup }} />);

    fill("管理员用户名", "ab");
    fill("显示名称", " ");
    fill("密码", "short");
    fill("确认密码", "different");
    submit("创建管理员");

    expect(
      await screen.findByText(/用户名需为 3 至 64 位/)
    ).toBeVisible();
    expect(screen.getByText("请输入显示名称。")).toBeVisible();
    expect(screen.getByText("密码需为 12 至 128 个字符。")).toBeVisible();
    expect(screen.getByText("两次输入的密码不一致。")).toBeVisible();
    expect(setup).not.toHaveBeenCalled();
  });

  it("prevents duplicate setup submissions while the request is pending", async () => {
    let resolveSetup!: (value: AuthUser) => void;
    const setup = vi.fn(
      () =>
        new Promise<AuthUser>((resolve) => {
          resolveSetup = resolve;
        })
    );
    render(<SetupForm client={{ setup }} />);

    fill("管理员用户名", "admin.user");
    fill("显示名称", "管理员");
    fill("密码", "correct-horse-42");
    fill("确认密码", "correct-horse-42");
    submit("创建管理员");
    fireEvent.submit(screen.getByRole("form", { name: "创建首个管理员" }));

    expect(setup).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "正在创建..." })).toBeDisabled();

    resolveSetup(user);
    await waitFor(() => {
      expect(auth.setSessionUser).toHaveBeenCalledWith(user);
      expect(navigation.replace).toHaveBeenCalledWith("/workspace/assets");
    });
  });

  it("explains when setup has already been completed", async () => {
    const setup = vi.fn().mockRejectedValue(
      apiError(409, "setup_completed", "System initialization is complete.")
    );
    render(<SetupForm client={{ setup }} />);

    fill("管理员用户名", "admin.user");
    fill("显示名称", "管理员");
    fill("密码", "correct-horse-42");
    fill("确认密码", "correct-horse-42");
    submit("创建管理员");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "系统已完成初始化，请前往登录。"
    );
    expect(screen.getByRole("link", { name: "前往登录" })).toHaveAttribute(
      "href",
      "/login?next=%2Fworkspace%2Fassets"
    );
  });

  it("uses one generic message for all login failures", async () => {
    const login = vi.fn().mockRejectedValue(
      apiError(401, "authentication_failed", "account disabled")
    );
    render(<LoginForm client={{ login }} />);

    fill("用户名", "unknown.user");
    fill("密码", "wrong-password");
    submit("登录");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "用户名或密码错误，请重试。"
    );
    expect(screen.queryByText(/disabled/i)).toBeNull();
  });

  it("routes temporary-password users to forced password change", async () => {
    const forcedUser = { ...user, must_change_password: true };
    const login = vi.fn().mockResolvedValue(forcedUser);
    render(<LoginForm client={{ login }} />);

    fill("用户名", "admin.user");
    fill("密码", "temporary-password");
    submit("登录");

    await waitFor(() => {
      expect(auth.setSessionUser).toHaveBeenCalledWith(forcedUser);
      expect(navigation.replace).toHaveBeenCalledWith(
        "/change-password?next=%2Fworkspace%2Fassets"
      );
    });
  });

  it("changes the password and restores the original safe target", async () => {
    const changePassword = vi.fn().mockResolvedValue(user);
    render(<ChangePasswordForm client={{ changePassword }} />);

    fill("当前密码", "temporary-password");
    fill("新密码", "new-secure-password");
    fill("确认新密码", "new-secure-password");
    submit("更新密码");

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        current_password: "temporary-password",
        new_password: "new-secure-password"
      });
      expect(auth.setSessionUser).toHaveBeenCalledWith(user);
      expect(navigation.replace).toHaveBeenCalledWith("/workspace/assets");
    });
  });

  it("keeps the forced-password session when the current password is wrong", async () => {
    const forcedUser = { ...user, must_change_password: true };
    auth.user = forcedUser;
    const changePassword = vi.fn().mockRejectedValue(
      new ApiError({
        code: "current_password_invalid",
        message: "invalid current password",
        responseBody: {},
        status: 401
      })
    );
    render(<ChangePasswordForm client={{ changePassword }} />);

    fill("当前密码", "incorrect-password");
    fill("新密码", "new-secure-password");
    fill("确认新密码", "new-secure-password");
    submit("更新密码");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "当前密码不正确"
    );
    expect(auth.setSessionUser).toHaveBeenCalledWith(forcedUser);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function apiError(
  status: number,
  code: "authentication_failed" | "setup_completed",
  message: string
) {
  return new ApiError({
    code,
    message,
    responseBody: {},
    status
  });
}
