import Link from "next/link";
import type { Route } from "next";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ProjectEmptyState({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-[-0.025em]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function BackToWorkflowButton({ href }: { href: string }) {
  return (
    <Button asChild className="rounded-2xl" variant="signal">
      <Link href={href as Route}>返回创作流程</Link>
    </Button>
  );
}
