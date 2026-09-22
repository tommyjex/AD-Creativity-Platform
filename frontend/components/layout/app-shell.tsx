"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "项目", href: "/workspace/projects" },
  { label: "资产库", href: "/workspace/assets" },
  { label: "工具", href: "/workspace/tools" },
  { label: "AIGC工作台", href: "/workspace/aigc" }
] as const;

const navigationBackgroundUrl =
  "/images/navigation-generative-constellation.webp";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNavPathname, setMobileNavPathname] = useState<string | null>(
    null
  );
  const isMobileNavOpen = mobileNavPathname === pathname;
  const isImmersiveAigcEditorRoute =
    /^\/workspace\/aigc\/(?:(?:pipelines|templates)\/[^/]+|pipelines\/[^/]+\/nodes\/[^/]+\/(?:layers|timeline))\/?$/.test(
      pathname
    );

  if (isImmersiveAigcEditorRoute) {
    return (
      <div
        className="min-h-[100dvh] overflow-hidden bg-[#0b0d10] text-[#f2f4f7]"
        data-testid="app-shell"
      >
        <div data-testid="app-shell-content">{children}</div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
      data-testid="app-shell"
    >
      <AtmosphereLayer />
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-white/10 bg-[#14191f] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          data-testid="app-shell-navigation-background"
          style={{ backgroundImage: `url("${navigationBackgroundUrl}")` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,11,0.04)_0%,rgba(3,7,11,0.22)_100%),linear-gradient(90deg,rgba(11,15,20,0.92)_0%,rgba(12,17,23,0.56)_22%,rgba(10,15,21,0.34)_52%,rgba(9,14,20,0.48)_74%,rgba(8,12,17,0.82)_100%)]"
        />
        <div
          className="container relative z-10 flex h-full items-center justify-between gap-6 2xl:max-w-[1600px]"
          data-testid="app-shell-navigation-layout"
        >
          <Link className="group flex items-center gap-3" href="/">
            <BrandMark className="border-blue-400/40 bg-blue-500/15" />
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-[0.18em] text-white">
                AD CREATIVITY
              </div>
              <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-slate-400">
                Campaign generation deck
              </div>
            </div>
          </Link>

          <nav
            aria-label="主导航"
            className="hidden items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl md:flex"
          >
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium transition",
                    isActive
                      ? "bg-primary/90 text-white shadow-sm"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                  href={item.href as Route}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            aria-controls="mobile-navigation-menu"
            aria-expanded={isMobileNavOpen}
            aria-label={isMobileNavOpen ? "关闭导航菜单" : "打开导航菜单"}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/15 bg-black/25 text-slate-100 transition hover:bg-white/10 md:hidden"
            onClick={() =>
              setMobileNavPathname(isMobileNavOpen ? null : pathname)
            }
            type="button"
          >
            {isMobileNavOpen ? (
              <X aria-hidden="true" size={19} />
            ) : (
              <Menu aria-hidden="true" size={19} />
            )}
          </button>
        </div>

        {isMobileNavOpen ? (
          <nav
            aria-label="移动导航"
            className="absolute inset-x-4 top-[calc(100%+0.5rem)] grid gap-1 rounded-md border border-white/10 bg-[#171c23]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden"
            data-testid="mobile-navigation-menu"
            id="mobile-navigation-menu"
          >
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded px-3 py-2.5 text-sm transition",
                    isActive
                      ? "bg-primary/90 text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  )}
                  href={item.href as Route}
                  key={item.href}
                  onClick={() => setMobileNavPathname(null)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>

      <div className="relative z-10 pt-16" data-testid="app-shell-content">
        {children}
      </div>
    </div>
  );
}

function AtmosphereLayer() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <div className="ad-noise absolute inset-0" />
      <div className="ad-shell-grid absolute inset-0 opacity-70" />
      <div className="absolute left-1/2 top-[-22rem] h-[34rem] w-[58rem] -translate-x-1/2 rounded-full bg-primary/[0.055] blur-3xl" />
      <div className="absolute right-[-12rem] top-24 h-[24rem] w-[24rem] rounded-full bg-accent/[0.04] blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid h-10 w-10 place-items-center rounded-xl border border-primary/20 bg-primary/[0.08]",
        className
      )}
    >
      <div className="absolute inset-1 rounded-lg border border-primary/10" />
      <div className="h-3 w-3 rounded bg-primary" />
    </div>
  );
}
