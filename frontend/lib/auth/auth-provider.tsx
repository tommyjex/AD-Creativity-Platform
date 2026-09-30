"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  apiClient,
  AUTH_FORBIDDEN_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
  isApiError,
  type ApiClient
} from "@/lib/api-client";
import type { AuthUser, SetupStatusResponse } from "@/lib/api-types";
import {
  getAuthRedirect,
  isPublicAuthPath,
  withNextPath
} from "@/lib/auth/route-guard";
import {
  canCreate,
  setClientPermissionSubject
} from "@/lib/auth/permissions";

type AuthStatus = "loading" | "ready" | "error";

interface AuthClient {
  getCurrentUser: ApiClient["getCurrentUser"];
  getSetupStatus: ApiClient["getSetupStatus"];
}

interface AuthContextValue {
  clearSession: () => void;
  error: string | null;
  initialized: boolean | null;
  refresh: () => Promise<void>;
  setSessionUser: (user: AuthUser) => void;
  status: AuthStatus;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  client = apiClient
}: {
  children: ReactNode;
  client?: AuthClient;
}) {
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const setupStatus: SetupStatusResponse = await client.getSetupStatus({
        cache: "no-store"
      });
      setInitialized(setupStatus.initialized);
      if (!setupStatus.initialized) {
        setUser(null);
        setStatus("ready");
        return;
      }

      try {
        setUser(
          await client.getCurrentUser({
            cache: "no-store"
          })
        );
      } catch (requestError) {
        if (!hasStatus(requestError, 401)) {
          throw requestError;
        }
        setUser(null);
      }
      setStatus("ready");
    } catch {
      setError("认证状态暂时无法加载，请稍后重试。");
      setStatus("error");
    }
  }, [client]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setInitialized(true);
      setUser(null);
      setStatus("ready");
    };
    const handleForbidden = () => setForbidden(true);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(AUTH_FORBIDDEN_EVENT, handleForbidden);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(AUTH_FORBIDDEN_EVENT, handleForbidden);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  useEffect(() => {
    setClientPermissionSubject(user);
    return () => setClientPermissionSubject(null);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      clearSession: () => {
        setInitialized(true);
        setUser(null);
        setStatus("ready");
      },
      error,
      initialized,
      refresh,
      setSessionUser: (nextUser) => {
        setInitialized(true);
        setUser(nextUser);
        setStatus("ready");
      },
      status,
      user
    }),
    [error, initialized, refresh, status, user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {forbidden ? (
        <div
          className="fixed bottom-4 right-4 z-[100] rounded-md border border-destructive/40 bg-background px-4 py-3 text-sm text-foreground shadow-2xl"
          role="alert"
        >
          权限不足，当前账号不能执行此操作。
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function AuthApp({ children }: { children: ReactNode }) {
  const { error, initialized, status, user } = useAuth();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const redirect =
    status === "ready" && initialized !== null
      ? getAuthRedirect({ initialized, pathname, search, user })
      : null;

  useEffect(() => {
    if (redirect) {
      router.replace(redirect as Route);
    }
  }, [redirect, router]);

  if (status === "loading" || redirect) {
    return (
      <main
        aria-label="正在验证登录状态"
        className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground"
      >
        正在验证登录状态...
      </main>
    );
  }

  if (status === "error") {
    return (
      <main
        className="grid min-h-screen place-items-center bg-background px-6 text-sm text-destructive"
        role="alert"
      >
        {error}
      </main>
    );
  }

  return isPublicAuthPath(pathname) ? (
    children
  ) : (
    <AppShell>{children}</AppShell>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useCanWrite(): boolean {
  const auth = useOptionalAuth();
  return auth ? canCreate(auth.user) : true;
}

export function getLoginRedirect(pathname: string, search = ""): string {
  return withNextPath(
    "/login",
    `${pathname}${search ? `?${search}` : ""}`
  );
}

function hasStatus(error: unknown, status: number): boolean {
  return (
    (isApiError(error) && error.status === status) ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === status)
  );
}
