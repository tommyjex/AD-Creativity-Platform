"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AccountMenu } from "@/components/layout/account-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "项目", href: "/workspace/projects" },
  { label: "资产库", href: "/workspace/assets" },
  { label: "工具", href: "/workspace/tools" },
  { label: "AIGC工作台", href: "/workspace/aigc" }
] as const;

const navigationBackgroundUrl =
  "/images/navigation-national-day-red.webp";

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
      className="relative min-h-screen overflow-hidden bg-background text-foreground"
      data-testid="app-shell"
    >
      <AtmosphereLayer />
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-[#ffe0a3]/20 bg-[#b61519] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          data-testid="app-shell-navigation-background"
          style={{ backgroundImage: `url("${navigationBackgroundUrl}")` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(84,0,0,0.06)_0%,rgba(91,0,0,0.24)_100%),linear-gradient(90deg,rgba(91,0,0,0.78)_0%,rgba(132,5,5,0.38)_22%,rgba(174,12,8,0.14)_52%,rgba(127,3,3,0.34)_74%,rgba(82,0,0,0.70)_100%)]"
        />
        <div
          className="relative z-10 flex h-full w-full items-center gap-4 px-4 lg:px-6"
          data-testid="app-shell-navigation-layout"
        >
          <Link className="group flex shrink-0 items-center gap-3" href="/">
            <BrandMark />
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-[0.18em] text-white">
                AD CREATIVITY
              </div>
              <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-[#ffe0a3]/70">
                Campaign generation deck
              </div>
            </div>
          </Link>

          <nav
            aria-label="主导航"
            className="hidden items-center gap-1 rounded-full border border-[#ffe0a3]/25 bg-[#6b0000]/45 p-1 shadow-[0_8px_24px_rgba(74,0,0,0.24)] backdrop-blur-xl md:absolute md:left-1/2 md:flex md:-translate-x-1/2"
            data-testid="app-shell-primary-navigation"
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
                      ? "bg-[linear-gradient(180deg,#ffe0a3_0%,#f0b433_100%)] text-[#6f110b] shadow-sm"
                      : "text-[#fff2dc]/85 hover:bg-[#ffe0a3]/10 hover:text-white"
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
            className="ml-auto hidden shrink-0 md:block"
            data-testid="app-shell-account-slot"
          >
            <AccountMenu />
          </div>

          <button
            aria-controls="mobile-navigation-menu"
            aria-expanded={isMobileNavOpen}
            aria-label={isMobileNavOpen ? "关闭导航菜单" : "打开导航菜单"}
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#ffe0a3]/35 bg-[#6b0000]/35 text-[#fff2dc] transition hover:bg-[#ffe0a3]/10 md:hidden"
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
            className="absolute inset-x-4 top-[calc(100%+0.5rem)] grid gap-1 rounded-md border border-[#ffe0a3]/25 bg-[#7a0809]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden"
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
                      ? "bg-[linear-gradient(180deg,#ffe0a3_0%,#f0b433_100%)] text-[#6f110b]"
                      : "text-[#fff2dc]/85 hover:bg-[#ffe0a3]/10 hover:text-white"
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
      <div className="ad-noise absolute inset-0" />
      <div className="ad-shell-grid absolute inset-0 opacity-70" />
      <div className="absolute left-1/2 top-[-22rem] h-[34rem] w-[58rem] -translate-x-1/2 rounded-full bg-primary/[0.055] blur-3xl" />
      <div className="absolute right-[-12rem] top-24 h-[24rem] w-[24rem] rounded-full bg-accent/[0.04] blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  );
}

function BrandMark() {
  return (
    <div
      className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#ffc348]/60 bg-[#8c0000]/35"
      data-testid="app-shell-brand-mark"
    >
      <div className="absolute inset-1 rounded-lg border border-[#ffc348]/25" />
      <div className="h-3 w-3 rounded bg-[#ffc348] shadow-[0_0_16px_rgba(255,195,72,0.55)]" />
    </div>
  );
}
