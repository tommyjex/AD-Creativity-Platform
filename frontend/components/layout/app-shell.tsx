"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Menu, Workflow, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AccountMenu } from "@/components/layout/account-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "项目", href: "/workspace/projects" },
  { label: "资产库", href: "/workspace/assets" },
  { label: "工具", href: "/workspace/tools" },
  { label: "AIGC工作台", href: "/workspace/aigc" }
] as const;

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
        <AccountMenu mode="immersive" />
        <div data-testid="app-shell-content">{children}</div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#090d0c] text-foreground"
      data-testid="app-shell"
    >
      <AtmosphereLayer />
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-white/10 bg-[#080c0b]/95 text-white shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div
          className="relative mx-auto flex h-full w-full max-w-[1440px] items-center gap-4 px-4 lg:px-6"
          data-testid="app-shell-navigation-layout"
        >
          <Link className="group flex shrink-0 items-center gap-3" href="/">
            <BrandMark />
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-[0.18em] text-white">
                AD CREATIVITY
              </div>
              <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-white/45">
                Campaign generation deck
              </div>
            </div>
          </Link>

          <nav
            aria-label="主导航"
            className="hidden items-center gap-1 border border-white/10 bg-white/[0.035] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.2)] lg:absolute lg:left-1/2 lg:flex lg:-translate-x-1/2"
            data-testid="app-shell-primary-navigation"
          >
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                    isActive
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "text-white/60 hover:bg-white/[0.055] hover:text-white"
                  )}
                  href={item.href as Route}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            className="ml-auto hidden shrink-0 lg:block"
            data-testid="app-shell-account-slot"
          >
            <AccountMenu />
          </div>

          <button
            aria-controls="mobile-navigation-menu"
            aria-expanded={isMobileNavOpen}
            aria-label={isMobileNavOpen ? "关闭导航菜单" : "打开导航菜单"}
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center border border-white/15 bg-white/[0.04] text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 lg:hidden"
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
            className="absolute inset-x-4 top-[calc(100%+0.5rem)] grid gap-1 border border-white/10 bg-[#0d1311]/98 p-2 shadow-2xl backdrop-blur-xl lg:hidden"
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
                    "px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "text-white/65 hover:bg-white/[0.055] hover:text-white"
                  )}
                  href={item.href as Route}
                  key={item.href}
                  onClick={() => setMobileNavPathname(null)}
                >
                  {item.label}
                </Link>
              );
            })}
            <AccountMenu
              mode="mobile"
              onNavigate={() => setMobileNavPathname(null)}
            />
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
      <div className="ad-noise absolute inset-0 opacity-50" />
      <div className="ad-shell-grid absolute inset-0 opacity-35" />
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-emerald-400/[0.035] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#090d0c] via-[#090d0c]/70 to-transparent" />
    </div>
  );
}

function BrandMark() {
  return (
    <div
      className="relative grid h-10 w-10 place-items-center border border-emerald-400/40 bg-emerald-400/10"
      data-testid="app-shell-brand-mark"
    >
      <Workflow aria-hidden="true" className="h-5 w-5 text-emerald-300" />
    </div>
  );
}
