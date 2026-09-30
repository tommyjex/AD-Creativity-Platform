import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FieldErrors = Record<string, string>;

export function AuthField({
  error,
  label,
  ...props
}: ComponentProps<typeof Input> & {
  error?: string;
  label: string;
}) {
  const errorId = error && props.id ? `${props.id}-error` : undefined;

  return (
    <div className="space-y-2">
      <Label className="text-zinc-200" htmlFor={props.id}>
        {label}
      </Label>
      <Input
        {...props}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className="h-11 border-white/10 bg-white/[0.045] text-zinc-50 shadow-none placeholder:text-zinc-600 focus-visible:border-amber-300/55 focus-visible:ring-amber-300/15"
      />
      {error ? (
        <p className="text-xs leading-5 text-red-300" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-red-400/20 bg-red-400/[0.08] px-3.5 py-3 text-sm leading-6 text-red-200"
      role="alert"
    >
      {children}
    </div>
  );
}

export const authSubmitClassName =
  "h-11 w-full rounded-xl bg-amber-300 text-zinc-950 shadow-[0_12px_32px_rgba(252,211,77,0.18)] hover:bg-amber-200";

export function validateUsername(username: string): string | null {
  return /^[a-z0-9._-]{3,64}$/.test(username.trim().toLowerCase())
    ? null
    : "用户名需为 3 至 64 位，仅可使用字母、数字、点、下划线或连字符。";
}

export function validatePassword(password: string): string | null {
  return password.length >= 12 && password.length <= 128
    ? null
    : "密码需为 12 至 128 个字符。";
}
