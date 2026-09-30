"use client";

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  ChevronDown,
  LogOut,
  Shield,
  UserRound,
  UsersRound
} from "lucide-react";
import { useState } from "react";

import {
  apiClient,
  getUserFacingErrorMessage,
  type ApiClient
} from "@/lib/api-client";
import type { UserRole } from "@/lib/api-types";
import { useAuth } from "@/lib/auth/auth-provider";
import { canManageUsers } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "管理员",
  creator: "创作者",
  viewer: "仅查看"
};

export function AccountMenu({
  client = apiClient,
  mode = "desktop",
  onNavigate
}: {
  client?: Pick<ApiClient, "logout">;
  mode?: "desktop" | "immersive" | "mobile";
  onNavigate?: () => void;
}) {
  const { clearSession, user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function logout() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await client.logout();
      clearSession();
      setOpen(false);
      onNavigate?.();
      router.replace("/login" as Route);
    } catch (requestError) {
      setError(getUserFacingErrorMessage(requestError));
      setPending(false);
    }
  }

  if (mode === "mobile") {
    return (
      <div className="mt-1 border-t border-[#ffe0a3]/20 pt-2">
        <AccountIdentity role={user.role} displayName={user.display_name} />
        <div className="mt-2 grid gap-1">
          {canManageUsers(user) ? (
            <Link
              className="flex items-center gap-2 rounded px-3 py-2.5 text-sm text-[#fff2dc]/85 transition hover:bg-[#ffe0a3]/10 hover:text-white"
              href={"/workspace/admin/users" as Route}
              onClick={onNavigate}
            >
              <UsersRound aria-hidden="true" className="h-4 w-4" />
              用户管理
            </Link>
          ) : null}
          <button
            className="flex items-center gap-2 rounded px-3 py-2.5 text-left text-sm text-[#fff2dc]/85 transition hover:bg-[#ffe0a3]/10 hover:text-white disabled:opacity-60"
            disabled={pending}
            onClick={logout}
            type="button"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            {pending ? "正在退出..." : "退出登录"}
          </button>
          {error ? (
            <p className="px-3 pb-1 text-xs text-[#ffd4c8]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const immersive = mode === "immersive";
  return (
    <div
      className={cn(
        immersive
          ? "fixed right-3 top-3 z-[90] sm:right-4 sm:top-4"
          : "hidden md:block"
      )}
    >
      <Popover.Root
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setError(null);
        }}
        open={open}
      >
        <Popover.Trigger asChild>
          <button
            aria-label={`打开账号菜单：${user.display_name}`}
            className={cn(
              "flex items-center rounded-xl border text-left shadow-lg outline-none transition focus-visible:ring-2",
              immersive
                ? "h-10 gap-2 border-white/15 bg-[#171a1f]/92 px-2.5 text-zinc-100 shadow-black/35 backdrop-blur-xl hover:border-white/25 focus-visible:ring-blue-500/50"
                : "h-11 gap-2.5 border-[#ffe0a3]/30 bg-[#6b0000]/45 px-2.5 text-[#fff2dc] shadow-[#4a0000]/25 backdrop-blur-xl hover:bg-[#ffe0a3]/10 focus-visible:ring-[#ffe0a3]/50"
            )}
            type="button"
          >
            <Avatar displayName={user.display_name} immersive={immersive} />
            <span className={cn("min-w-0", immersive && "hidden sm:block")}>
              <span className="block max-w-28 truncate text-xs font-semibold">
                {user.display_name}
              </span>
              <span
                className={cn(
                  "mt-0.5 block font-mono text-[0.6rem] uppercase tracking-[0.14em]",
                  immersive ? "text-zinc-500" : "text-[#ffe0a3]/65"
                )}
              >
                {ROLE_LABELS[user.role]}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-3.5 w-3.5 transition",
                immersive && "hidden sm:block",
                open && "rotate-180"
              )}
            />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            className="z-[100] w-64 rounded-xl border border-border bg-card/95 p-2 text-foreground shadow-2xl shadow-black/40 outline-none backdrop-blur-xl"
            collisionPadding={12}
            sideOffset={8}
          >
            <div className="border-b border-border px-3 py-3">
              <div className="truncate text-sm font-semibold">
                {user.display_name}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  @{user.username}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <Shield aria-hidden="true" className="h-3 w-3" />
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
            <div className="mt-1 grid gap-1">
              {canManageUsers(user) ? (
                <Link
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  href={"/workspace/admin/users" as Route}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                >
                  <UsersRound aria-hidden="true" className="h-4 w-4" />
                  用户管理
                </Link>
              ) : null}
              <button
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-60"
                disabled={pending}
                onClick={logout}
                type="button"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                {pending ? "正在退出..." : "退出登录"}
              </button>
            </div>
            {error ? (
              <p
                className="mt-1 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function AccountIdentity({
  displayName,
  role
}: {
  displayName: string;
  role: UserRole;
}) {
  return (
    <div className="flex items-center gap-3 rounded bg-[#5f0000]/35 px-3 py-3">
      <Avatar displayName={displayName} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">
          {displayName}
        </div>
        <div className="mt-0.5 flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#ffe0a3]/70">
          <UserRound aria-hidden="true" className="h-3 w-3" />
          {ROLE_LABELS[role]}
        </div>
      </div>
    </div>
  );
}

function Avatar({
  displayName,
  immersive = false
}: {
  displayName: string;
  immersive?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold",
        immersive
          ? "border border-blue-400/30 bg-blue-500/15 text-blue-200"
          : "border border-[#ffc348]/40 bg-[#8c0000]/50 text-[#ffe0a3]"
      )}
    >
      {displayName.trim().slice(0, 1).toUpperCase() || "U"}
    </span>
  );
}
