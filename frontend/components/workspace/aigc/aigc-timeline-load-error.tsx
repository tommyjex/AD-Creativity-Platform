import { AlertTriangle, ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AigcTimelineLoadError({
  message,
  pipelineId
}: {
  message: string;
  pipelineId?: string;
}) {
  const href = pipelineId
    ? (`/workspace/aigc/pipelines/${pipelineId}` as Route)
    : ("/workspace/aigc" as Route);

  return (
    <main className="grid h-[100dvh] place-items-center bg-[#0b0d10] p-6 text-[#f2f4f7]">
      <div className="w-full max-w-lg border border-[#343a43] bg-[#15181d] p-6">
        <AlertTriangle className="h-5 w-5 text-amber-300" />
        <h1 className="mt-4 text-base font-semibold">无法打开时间线</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400" role="alert">
          {message}
        </p>
        <Button asChild className="mt-5" size="sm" variant="outline">
          <Link href={href}>
            <ArrowLeft className="h-4 w-4" />
            返回 AIGC 画布
          </Link>
        </Button>
      </div>
    </main>
  );
}
