"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "项目", href: "/workspace/projects" },
  { label: "资产库", href: "/workspace/assets" },
  { label: "工具", href: "/workspace/tools" },
  { label: "AIGC工作台", href: "/workspace/aigc" }
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AtmosphereLayer />
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-6">
          <Link className="group flex items-center gap-3" href="/">
            <BrandMark />
            <div className="leading-none">
              <div className="text-sm font-semibold tracking-[0.18em] text-foreground">
                AD CREATIVITY
              </div>
              <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">
                Campaign generation deck
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-border bg-secondary/70 p-1 md:flex">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-medium transition hover:bg-card hover:text-primary hover:shadow-sm",
                    isActive
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground"
                  )}
                  href={item.href as Route}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Badge variant="signal">BRIEF READY</Badge>
            <Button asChild size="sm" variant="outline">
              <Link href="/workspace/projects">进入工作台</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 pt-16">{children}</div>
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
