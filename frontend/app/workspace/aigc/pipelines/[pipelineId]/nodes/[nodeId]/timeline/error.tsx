"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AigcTimelineEditorError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid h-[100dvh] place-items-center bg-[#0b0d10] p-6 text-[#f2f4f7]">
      <div className="w-full max-w-lg border border-[#343a43] bg-[#15181d] p-6">
        <h1 className="text-base font-semibold">时间线路由加载失败</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400" role="alert">
          页面遇到未预期错误，未对 Pipeline 写入任何修改。
        </p>
        <Button
          className="mt-5"
          onClick={reset}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcw className="h-4 w-4" />
          重试
        </Button>
      </div>
    </main>
  );
}
