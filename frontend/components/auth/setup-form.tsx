"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  AuthError,
  AuthField,
  authSubmitClassName,
  type FieldErrors,
  validatePassword,
  validateUsername
} from "@/components/auth/form-controls";
import { apiClient, isApiError, type ApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-provider";
import { getSafeNextPath, withNextPath } from "@/lib/auth/route-guard";

type SetupClient = Pick<ApiClient, "setup">;

export function SetupForm({
  client = apiClient
}: {
  client?: SetupClient;
}) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const { setSessionUser } = useAuth();
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [setupClosed, setSetupClosed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const displayName = String(form.get("displayName") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const nextErrors: FieldErrors = {};
    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);

    if (usernameError) nextErrors.username = usernameError;
    if (!displayName) nextErrors.displayName = "请输入显示名称。";
    if (displayName.length > 80) {
      nextErrors.displayName = "显示名称不能超过 80 个字符。";
    }
    if (passwordError) nextErrors.password = passwordError;
    if (password && password.toLowerCase() === username) {
      nextErrors.password = "密码不能与用户名相同。";
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = "两次输入的密码不一致。";
    }

    setErrors(nextErrors);
    setRequestError(null);
    setSetupClosed(false);
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const user = await client.setup({
        display_name: displayName,
        password,
        username
      });
      setSessionUser(user);
      router.replace((getSafeNextPath(search) ?? "/workspace") as Route);
    } catch (error) {
      if (isApiError(error) && error.code === "setup_completed") {
        setSetupClosed(true);
        setRequestError("系统已完成初始化，请前往登录。");
      } else {
        setRequestError(
          isApiError(error) && error.code === "password_policy_failed"
            ? "密码不符合安全策略，请检查后重试。"
            : "初始化未完成，请稍后重试。"
        );
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        创建系统中的首个管理员账号。完成后将直接进入共享工作区。
      </p>
      <form
        aria-label="创建首个管理员"
        className="mt-7 space-y-5"
        onSubmit={handleSubmit}
      >
        <AuthField
          autoComplete="username"
          disabled={isSubmitting}
          error={errors.username}
          id="setup-username"
          label="管理员用户名"
          name="username"
          placeholder="例如 admin.team"
        />
        <AuthField
          autoComplete="name"
          disabled={isSubmitting}
          error={errors.displayName}
          id="setup-display-name"
          label="显示名称"
          maxLength={80}
          name="displayName"
          placeholder="例如 创意平台主管"
        />
        <AuthField
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.password}
          id="setup-password"
          label="密码"
          name="password"
          placeholder="12 至 128 个字符"
          type="password"
        />
        <AuthField
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.confirmPassword}
          id="setup-confirm-password"
          label="确认密码"
          name="confirmPassword"
          placeholder="再次输入密码"
          type="password"
        />
        {requestError ? (
          <AuthError>
            {requestError}
            {setupClosed ? (
              <>
                {" "}
                <Link
                  className="font-semibold text-red-100 underline underline-offset-4"
                  href={
                    withNextPath(
                      "/login",
                      getSafeNextPath(search) ?? "/workspace"
                    ) as Route
                  }
                >
                  前往登录
                </Link>
              </>
            ) : null}
          </AuthError>
        ) : null}
        <Button
          className={authSubmitClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "正在创建..." : "创建管理员"}
        </Button>
      </form>
    </>
  );
}
