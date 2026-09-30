"use client";

import { Eye } from "lucide-react";

export function ReadOnlyNotice({
  className = ""
}: {
  className?: string;
}) {
  return (
    <p
      className={`flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground ${className}`}
      role="status"
    >
      <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      只读模式：可查看、预览和下载，不能修改或运行任务。
    </p>
  );
}
