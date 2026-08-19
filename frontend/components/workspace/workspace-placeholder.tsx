import type { LucideIcon } from "lucide-react";

interface WorkspacePlaceholderProps {
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
}

export function WorkspacePlaceholder({
  description,
  eyebrow,
  icon: Icon,
  title
}: WorkspacePlaceholderProps) {
  return (
    <section
      aria-labelledby="workspace-page-title"
      className="w-full max-w-none px-3 py-6 sm:px-4 sm:py-8 lg:px-5"
    >
      <div className="max-w-3xl">
        <p className="ad-kicker">{eyebrow}</p>
        <h1
          className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl"
          id="workspace-page-title"
        >
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>

      <div className="mt-8 min-h-[24rem] rounded-3xl border border-border bg-card p-6 shadow-glass sm:p-8">
        <div className="flex h-full min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-primary/[0.025] px-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/15 bg-primary/[0.08] text-primary">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-foreground">
            模块布局已就绪
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            当前任务仅提供工作台布局与导航骨架，业务内容将在后续任务中实现。
          </p>
        </div>
      </div>
    </section>
  );
}
