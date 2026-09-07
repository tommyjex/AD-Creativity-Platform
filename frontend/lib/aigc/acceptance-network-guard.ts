const FORBIDDEN_PATH =
  /\/(?:enhance-video|face-blur-video|multi-track-edit)(?:[/?#]|$)/i;
const INSTALL_KEY = Symbol.for("aigc.acceptance.network-guard");

interface GuardedWindow extends Window {
  [INSTALL_KEY]?: {
    references: number;
    restore: () => void;
  };
}

export function isForbiddenAcceptanceRequest(
  input: RequestInfo | URL | string
): boolean {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  try {
    const url = new URL(raw, window.location.origin);
    return (
      url.hostname.toLowerCase().includes("mediakit") ||
      FORBIDDEN_PATH.test(url.pathname)
    );
  } catch {
    return /mediakit/i.test(raw) || FORBIDDEN_PATH.test(raw);
  }
}

export function installAcceptanceNetworkGuard(): () => void {
  const guardedWindow = window as GuardedWindow;
  const installed = guardedWindow[INSTALL_KEY];
  if (installed) {
    installed.references += 1;
    return () => releaseGuard(guardedWindow);
  }

  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const invokeOpen = originalOpen as unknown as (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async: boolean,
    username: string | null,
    password: string | null
  ) => void;
  const originalSendBeacon = navigator.sendBeacon?.bind(navigator);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    assertAllowed(input);
    return originalFetch(input, init);
  }) as typeof window.fetch;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ) {
    assertAllowed(url);
    return invokeOpen.call(
      this,
      method,
      url,
      async,
      username ?? null,
      password ?? null
    );
  };

  if (originalSendBeacon) {
    navigator.sendBeacon = ((url: string | URL, data?: BodyInit | null) => {
      assertAllowed(url);
      return originalSendBeacon(url, data);
    }) as typeof navigator.sendBeacon;
  }

  guardedWindow[INSTALL_KEY] = {
    references: 1,
    restore: () => {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalOpen;
      if (originalSendBeacon) navigator.sendBeacon = originalSendBeacon;
      delete guardedWindow[INSTALL_KEY];
    }
  };

  return () => releaseGuard(guardedWindow);
}

function assertAllowed(input: RequestInfo | URL | string): void {
  if (isForbiddenAcceptanceRequest(input)) {
    throw new Error(
      "Acceptance safety guard blocked a MediaKit processing request"
    );
  }
}

function releaseGuard(guardedWindow: GuardedWindow): void {
  const installed = guardedWindow[INSTALL_KEY];
  if (!installed) return;
  installed.references -= 1;
  if (installed.references === 0) installed.restore();
}
