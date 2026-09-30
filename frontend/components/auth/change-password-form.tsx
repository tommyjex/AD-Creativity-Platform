"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  AuthError,
  AuthField,
  authSubmitClassName,
  type FieldErrors,
  validatePassword
} from "@/components/auth/form-controls";
import { apiClient, isApiError, type ApiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-provider";
import { getSafeNextPath } from "@/lib/auth/route-guard";

type ChangePasswordClient = Pick<ApiClient, "changePassword">;

export function ChangePasswordForm({
  client = apiClient
}: {
  client?: ChangePasswordClient;
}) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const { setSessionUser, user: currentUser } = useAuth();
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const nextErrors: FieldErrors = {};
    if (!currentPassword) nextErrors.currentPassword = "请输入当前密码。";
    const passwordError = validatePassword(newPassword);
    if (passwordError) nextErrors.newPassword = passwordError;
    if (newPassword && newPassword === currentPassword) {
      nextErrors.newPassword = "新密码不能与当前密码相同。";
    }
    if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = "两次输入的新密码不一致。";
    }

    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const user = await client.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setSessionUser(user);
      router.replace((getSafeNextPath(search) ?? "/workspace") as Route);
    } catch (error) {
      if (isApiError(error) && error.code === "current_password_invalid") {
        if (currentUser) {
          setSessionUser(currentUser);
        }
        setRequestError("当前密码不正确，请重新输入。");
      } else if (
        isApiError(error) &&
        error.code === "password_policy_failed"
      ) {
        setRequestError("新密码不符合安全策略，请检查后重试。");
      } else {
        setRequestError("密码更新未完成，请稍后重试。");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        当前账号使用的是临时密码。更新密码后才能访问工作区内容。
      </p>
      <form
        aria-label="更新账号密码"
        className="mt-7 space-y-5"
        onSubmit={handleSubmit}
      >
        <AuthField
          autoComplete="current-password"
          autoFocus
          disabled={isSubmitting}
          error={errors.currentPassword}
          id="change-current-password"
          label="当前密码"
          name="currentPassword"
          placeholder="输入当前密码"
          type="password"
        />
        <AuthField
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.newPassword}
          id="change-new-password"
          label="新密码"
          name="newPassword"
          placeholder="12 至 128 个字符"
          type="password"
        />
        <AuthField
          autoComplete="new-password"
          disabled={isSubmitting}
          error={errors.confirmPassword}
          id="change-confirm-password"
          label="确认新密码"
          name="confirmPassword"
          placeholder="再次输入新密码"
          type="password"
        />
        {requestError ? <AuthError>{requestError}</AuthError> : null}
        <Button
          className={authSubmitClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "正在更新..." : "更新密码"}
        </Button>
      </form>
    </>
  );
}
