"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { SubtitleSegment, SubtitleWorkspace } from "@/lib/api-types";
import { getAssetContentUrlById } from "@/lib/asset-display";
import { segmentDraftIssue, segmentIssue, subtitleDraftSignature, subtitleWarningMessage } from "@/lib/subtitle-translation";
import { SubtitleVideoPreview } from "./video-preview";
import { SubtitleSegmentEditor } from "./segment-editor";
import { SubtitleLayoutNotice } from "./layout-notice";

export function SubtitleReviewDialog({
  workspace, open, readOnly, busy, error, conflict, onClose, onSave, onRender, onRetry, onReload, onPreview, onDirtyChange
}: {
  workspace: SubtitleWorkspace;
  open: boolean;
  readOnly: boolean;
  busy: boolean;
  error: string | null;
  conflict: boolean;
  onClose: () => void;
  onSave: (segments: SubtitleSegment[]) => Promise<boolean>;
  onRender: (segments: SubtitleSegment[]) => Promise<boolean>;
  onRetry: (segments: SubtitleSegment[], ids: string[]) => Promise<boolean>;
  onReload: () => Promise<void>;
  onPreview: (segments: SubtitleSegment[]) => Promise<SubtitleWorkspace | null>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [segments, setSegments] = useState(workspace.segments);
  const [baseline, setBaseline] = useState(workspace.segments);
  const [selected, setSelected] = useState(workspace.segments[0]?.segment_id);
  const [seekRequest, setSeekRequest] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = subtitleDraftSignature(segments) !== subtitleDraftSignature(baseline);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const edit = useCallback((id: string, change: Partial<SubtitleSegment>) => {
    // Geometry/time/exclusion edits can change neighbors' reserved widths too.
    setSegments((current) => current.map((segment) => ({
      ...segment, ...(segment.segment_id === id ? change : {}),
      estimated_font_size_px: null, effective_font_size_px: null, render_bbox_pixels: null,
      recommended_text_color: null, font_type: null, font_sha256: null,
      warnings: segment.warnings.filter((warning) => ![
        "bbox_expanded", "bbox_expansion_limited", "original_bbox_overlap",
        "expanded_background_unverified", "font_size_reduced", "font_size_small"
      ].includes(warning))
    })));
  }, []);
  const active = segments.find((segment) => segment.segment_id === selected);
  const missing = segments.filter((segment) => !segment.excluded && !segment.translated_text?.trim()).map((segment) => segment.segment_id);
  const invalid = segments.some((segment) => segmentIssue(segment));
  const invalidDraft = segments.some((segment) => segmentDraftIssue(segment));
  const previewUrl = getAssetContentUrlById(workspace.clean_video_asset_id ?? workspace.reference_video_asset_id ?? "");
  const close = () => { if (busy) return; if (dirty) setConfirmClose(true); else onClose(); };
  async function save() {
    if (invalidDraft) return false;
    const saved = await onSave(segments);
    if (saved) setBaseline(segments);
    return saved;
  }
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] max-w-[1500px] flex-col gap-0 p-0 sm:h-[calc(100dvh-3rem)]" onInteractOutside={(event) => { if (busy || dirty) { event.preventDefault(); close(); } }}>
        <header className="border-b border-border p-4 pr-16">
          <DialogTitle>原文 / 译文校对</DialogTitle>
          <DialogDescription>保留单行与原位置 · revision {workspace.revision}{dirty ? " · 未保存修改" : " · 已保存"}{readOnly ? " · 只读" : ""}</DialogDescription>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          <SubtitleLayoutNotice />
          {previewUrl ? <SubtitleVideoPreview key={workspace.clean_video_asset_id ?? workspace.reference_video_asset_id} url={previewUrl} layoutSize={workspace.clean_video ?? workspace.reference_video} targetLanguage={workspace.target_language} segments={segments} selectedId={selected} seekRequest={seekRequest} seekMs={active?.start_ms} label={workspace.clean_video_asset_id ? "无字幕视频 · 译文排版示意" : "参考视频 · 译文排版示意"} /> : null}
          <div className="mt-4 space-y-3">
            {segments.map((segment, index) => <SubtitleSegmentEditor key={segment.segment_id} segment={segment} index={index} readOnly={readOnly || busy || conflict} selected={selected === segment.segment_id} onChange={edit} onSeek={(item) => { setSelected(item.segment_id); setSeekRequest((n) => n + 1); }} />)}
          </div>
        </div>
        <footer className="space-y-3 border-t border-border p-4">
          {error ? <p role="alert" className="text-sm text-destructive">{subtitleWarningMessage(error)}</p> : null}
          {conflict ? <div className="flex flex-wrap items-center gap-2 text-sm"><span>远端 revision 已变更，未覆盖本地草稿。请先保留修改再重新加载。</span><Button variant="outline" disabled={busy} onClick={() => {
            if (!dirty || window.confirm("重新加载将丢弃本地未保存修改，继续？")) void onReload();
          }}>重新加载远端</Button></div> : null}
          {confirmClose ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><span>有未保存修改，如何关闭？</span><Button disabled={busy || readOnly || conflict} onClick={async () => { if (await save()) onClose(); }}>保存并关闭</Button><Button variant="outline" onClick={() => { onDirtyChange(false); onClose(); }}>放弃修改并关闭</Button><Button variant="outline" onClick={() => setConfirmClose(false)}>继续校对</Button></div> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy || readOnly || conflict || invalidDraft} onClick={async () => {
              const result = await onPreview(segments);
              if (result && result.id === workspace.id && result.revision === workspace.revision) {
                setSegments(result.segments);
              }
            }}>计算排版 · 不保存</Button>
            <Button variant="outline" disabled={busy || readOnly || conflict || invalidDraft || !missing.length} onClick={async () => { if (await onRetry(segments, missing)) { setBaseline(segments); onClose(); } }}>仅重试缺失译文 ({missing.length})</Button>
            <Button variant="outline" disabled={busy || readOnly || conflict || invalidDraft} onClick={() => void save()}>保存校对</Button>
            <Button disabled={busy || readOnly || conflict || invalid || !segments.some((segment) => !segment.excluded && (!workspace.clean_video || segment.start_ms < workspace.clean_video.duration_ms)) || !workspace.clean_video_asset_id} onClick={async () => { if (await onRender(segments)) { setBaseline(segments); onClose(); } }}>保存并压制视频</Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
