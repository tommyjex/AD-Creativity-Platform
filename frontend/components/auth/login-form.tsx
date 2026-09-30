"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  AuthError,
  AuthField,
  authSubmitClassName,
  type FieldErrors
} from "@/components/auth/form-controls";
import { apiClient, isApiError, type ApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-provider";
import { getSafeNextPath, withNextPath } from "@/lib/auth/route-guard";

type LoginClient = Pick<ApiClient, "login">;

const GENERIC_LOGIN_ERROR = "用户名或密码错误，请重试。";

export function LoginForm({
  client = apiClient
}: {
  client?: LoginClient;
}) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const { setSessionUser } = useAuth();
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const nextErrors: FieldErrors = {};
    if (!username) nextErrors.username = "请输入用户名。";
    if (!password) nextErrors.password = "请输入密码。";

    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const user = await client.login({ password, username });
      setSessionUser(user);
      const target = getSafeNextPath(search) ?? "/workspace";
      router.replace(
        (user.must_change_password
          ? withNextPath("/change-password", target)
          : target) as Route
      );
    } catch (error) {
      setRequestError(
        isApiError(error) &&
          ["authentication_failed", "login_rate_limited"].includes(error.code)
          ? GENERIC_LOGIN_ERROR
          : "登录请求未完成，请检查网络连接后重试。"
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        使用管理员为你分配的账号进入工作区。
      </p>
      <form
        aria-label="登录工作区"
        className="mt-7 space-y-5"
        onSubmit={handleSubmit}
      >
        <AuthField
          autoComplete="username"
          autoFocus
          disabled={isSubmitting}
          error={errors.username}
          id="login-username"
          label="用户名"
          name="username"
          placeholder="输入用户名"
        />
        <AuthField
          autoComplete="current-password"
          disabled={isSubmitting}
          error={errors.password}
          id="login-password"
          label="密码"
          name="password"
          placeholder="输入密码"
          type="password"
        />
        {requestError ? <AuthError>{requestError}</AuthError> : null}
        <Button
          className={authSubmitClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "正在登录..." : "登录"}
        </Button>
      </form>
    </>
  );
}
