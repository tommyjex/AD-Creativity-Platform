import type { AuthUser } from "@/lib/api-types";

const PUBLIC_AUTH_PATHS = new Set([
  "/change-password",
  "/login",
  "/setup"
]);
const DEFAULT_AUTHENTICATED_PATH = "/workspace";

interface AuthRedirectInput {
  initialized: boolean;
  pathname: string;
  search: string;
  user: AuthUser | null;
}

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.has(normalizePathname(pathname));
}

export function getAuthRedirect({
  initialized,
  pathname,
  search,
  user
}: AuthRedirectInput): string | null {
  const normalizedPath = normalizePathname(pathname);
  const publicRoute = isPublicAuthPath(normalizedPath);
  const target = publicRoute
    ? getSafeNextPath(search) ?? DEFAULT_AUTHENTICATED_PATH
    : `${normalizedPath}${search ? `?${search}` : ""}`;

  if (!initialized) {
    return normalizedPath === "/setup"
      ? null
      : withNextPath("/setup", target);
  }

  if (!user) {
    return normalizedPath === "/login"
      ? null
      : withNextPath("/login", target);
  }

  if (user.must_change_password) {
    return normalizedPath === "/change-password"
      ? null
      : withNextPath("/change-password", target);
  }

  return publicRoute ? target : null;
}

export function withNextPath(path: string, target: string): string {
  const safeTarget = sanitizeNextPath(target) ?? DEFAULT_AUTHENTICATED_PATH;
  return safeTarget === DEFAULT_AUTHENTICATED_PATH
    ? path
    : `${path}?next=${encodeURIComponent(safeTarget)}`;
}

export function getSafeNextPath(search: string): string | null {
  return sanitizeNextPath(new URLSearchParams(search).get("next"));
}

function sanitizeNextPath(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    isPublicAuthPath(value.split(/[?#]/, 1)[0])
  ) {
    return null;
  }
  try {
    const base = "https://local.invalid";
    const resolved = new URL(value, base);
    if (resolved.origin !== base) {
      return null;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }
  return pathname.replace(/\/+$/, "") || "/";
}
