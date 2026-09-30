import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AuthPageShell({
  children,
  eyebrow,
  title
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#05070a] text-zinc-50">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(234,179,8,0.16),transparent_28rem),radial-gradient(circle_at_88%_78%,rgba(220,38,38,0.13),transparent_32rem),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:auto,auto,48px_48px,48px_48px]"
      />
      <div className="relative mx-auto grid min-h-[100dvh] w-full max-w-7xl items-center gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,30rem)] lg:gap-20 lg:px-12">
        <section className="hidden max-w-2xl lg:block">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-4 py-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-amber-200">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Secure workspace
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.04] tracking-[-0.05em] text-white xl:text-6xl">
            创作空间，
            <span className="block text-zinc-500">只向正确的人开放。</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-8 text-zinc-400">
            统一管理广告创意、资产与生成流程。身份验证完成后，你将按账号角色进入共享工作区。
          </p>
        </section>

        <section className="mx-auto w-full max-w-[30rem]">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-amber-200">
                AD Creativity
              </p>
              <p className="text-sm text-zinc-400">Secure workspace</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div className="h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
            <div className="p-6 sm:p-8">
              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-amber-300">
                {eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">
                {title}
              </h2>
              {children}
            </div>
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-zinc-600">
            会话凭据仅通过安全 Cookie 传输，不会显示在页面中。
          </p>
        </section>
      </div>
    </main>
  );
}
