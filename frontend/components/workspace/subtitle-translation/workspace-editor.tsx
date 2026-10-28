"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Asset, SubtitleLanguage, SubtitleWorkspace } from "@/lib/api-types";
import { getAssetContentUrlById, getAssetDownloadUrlById } from "@/lib/asset-display";
import { segmentIssue, SUBTITLE_LANGUAGES, subtitleFieldClass, subtitleWarningMessage } from "@/lib/subtitle-translation";
import { SubtitleReviewDialog } from "./review-dialog";
import { SubtitleVideoInput } from "./video-input";
import { SubtitleVideoPreview } from "./video-preview";
import { useSubtitleWorkspace } from "./use-subtitle-workspace";
import { SubtitleLayoutNotice } from "./layout-notice";

const STAGE_LABELS = {
  draft: "等待导入 / 提取", extracting: "正在提取", extracted: "提取完成",
  translating: "正在翻译", review_ready: "等待校对", rendering: "正在压制",
  succeeded: "成片已完成", failed: "阶段失败，可重试"
};

export function SubtitleWorkspaceEditor({
  initial, assets, canWrite, onUpdate, onAsset, onDirtyChange
}: {
  initial: SubtitleWorkspace;
  assets: Asset[];
  canWrite: boolean;
  onUpdate: (workspace: SubtitleWorkspace) => void;
  onAsset: (asset: Asset) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const state = useSubtitleWorkspace(initial, onUpdate);
  const { workspace, busy, conflict, task } = state;
  const [review, setReview] = useState(false);
  const [reviewSession, setReviewSession] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const running = ["extracting", "translating", "rendering"].includes(workspace.stage);
  const blocked = busy || running || !canWrite || conflict;
  const durationDiff = workspace.reference_video && workspace.clean_video
    ? Math.abs(workspace.reference_video.duration_ms - workspace.clean_video.duration_ms) : 0;
  const missing = workspace.segments.filter((segment) => !segment.excluded && !segment.translated_text?.trim());
  const output = workspace.stage === "succeeded" && workspace.output_asset_id ? getAssetContentUrlById(workspace.output_asset_id) : null;
  const renderable = workspace.segments.filter((segment) => !segment.excluded &&
    (!workspace.clean_video || segment.start_ms < workspace.clean_video.duration_ms));
  const adjustments = workspace.clean_video ? workspace.segments.filter((segment) => !segment.excluded &&
    segment.end_ms > workspace.clean_video!.duration_ms) : [];

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-full"><h2 className="break-words text-xl font-semibold">{workspace.name}</h2><p className="text-xs text-muted-foreground">{STAGE_LABELS[workspace.stage]} · revision {workspace.revision}</p></div>
        <Button variant="outline" disabled={busy || running} onClick={() => void state.reload()}>刷新工作区</Button>
      </header>
      <p className="text-sm text-muted-foreground">两份视频应来自相同剪辑与时间原点。不会自动去字幕、配音或对齐时间轴。参考视频最长 600 秒。</p>
      <SubtitleLayoutNotice />
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <SubtitleVideoInput key={`reference-${workspace.id}`} role="reference" label="带字幕参考视频" assetId={workspace.reference_video_asset_id} assets={assets} disabled={blocked} onAsset={onAsset} onSelect={(id) => void state.update({ reference_video_asset_id: id })} />
        <SubtitleVideoInput key={`clean-${workspace.id}`} role="clean" label="无字幕成片视频" assetId={workspace.clean_video_asset_id} assets={assets} disabled={blocked} onAsset={onAsset} onSelect={(id) => void state.update({ clean_video_asset_id: id })} />
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        {([["参考视频", workspace.reference_video], ["无字幕视频", workspace.clean_video]] as const).map(([label, metadata]) => metadata ? <p key={label}>{label}：{metadata.width} × {metadata.height} 展示像素 · {metadata.duration_ms} ms · 旋转 {metadata.rotation}° · {metadata.fps ?? "未知"} FPS · {metadata.has_audio ? "保留音轨" : "无音轨"}</p> : null)}
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="text-sm">原语言<select aria-label="原语言" className={`${subtitleFieldClass} mt-1`} disabled={blocked} value={workspace.source_language} onChange={(event) => void state.update({ source_language: event.target.value as SubtitleLanguage | "auto" })}><option value="auto">自动识别</option>{SUBTITLE_LANGUAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="text-sm">目标语言<select aria-label="目标语言" className={`${subtitleFieldClass} mt-1`} disabled={blocked} value={workspace.target_language} onChange={(event) => void state.update({ target_language: event.target.value as SubtitleLanguage })}>{SUBTITLE_LANGUAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={blocked || !workspace.reference_video_asset_id} onClick={() => {
          if (!workspace.segments.length || window.confirm("重新提取将使当前字幕、译文和成片失效，继续？")) void state.run("extract");
        }}>1 · 提取字幕</Button>
        <Button disabled={blocked || !missing.length} onClick={() => void state.run("translate")}>2 · 翻译</Button>
        <Button variant="outline" disabled={busy || !workspace.segments.length} onClick={async () => {
          if (await state.reload()) { setReviewSession((n) => n + 1); setReview(true); }
        }}>3 · 原文 / 译文校对 ({workspace.segments.length})</Button>
        <Button disabled={blocked || !workspace.clean_video_asset_id || !renderable.length || workspace.segments.some((segment) => segmentIssue(segment))} onClick={() => void state.run("render")}>4 · 压制已保存字幕</Button>
        {missing.length ? <Button variant="outline" disabled={blocked} onClick={() => void state.run("translate", undefined, missing.map((segment) => segment.segment_id))}>仅重试缺失译文 ({missing.length})</Button> : null}
      </div>
      {durationDiff > 250 ? <p role="status" className="rounded-lg border border-amber-500/30 p-3 text-sm text-amber-600">两份视频时长相差 {durationDiff} ms，请核对同一剪辑与时间原点；可继续，尾部越界字幕会调整。</p> : null}
      {adjustments.length ? <div className="break-words rounded-lg border border-amber-500/30 p-3 text-sm"><p>压制时间调整清单</p>{adjustments.map((segment) => <p key={segment.segment_id}>{segment.segment_id}：{segment.start_ms >= workspace.clean_video!.duration_ms ? "完全越界，不参与压制" : `结束时间截到 ${workspace.clean_video!.duration_ms} ms`}</p>)}</div> : null}
      {state.error ? <p role="alert" className="text-sm text-destructive">{subtitleWarningMessage(state.error)}</p> : null}
      {conflict ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><span>revision 冲突，未覆盖远端修改。</span><Button variant="outline" onClick={() => void state.reload()}>重新加载远端</Button></div> : null}
      {task ? <div className="rounded-xl border border-border p-3 text-sm"><p>阶段任务 {String(task.input_snapshot.operation ?? "")} · {task.status}</p>{task.error ? <p role="alert">{subtitleWarningMessage(task.error.message)}</p> : null}{task.status === "failed" ? <Button variant="outline" disabled={blocked} onClick={() => void state.retry()}>重试失败阶段</Button> : null}</div> : null}
      {output ? <section className="space-y-3 rounded-xl border border-border p-4"><h3 className="font-semibold">当前成片</h3><SubtitleVideoPreview key={workspace.output_asset_id} url={output} label="字幕翻译成片" /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEnlarged(true)}>放大预览</Button><a className="rounded-lg border border-border px-4 py-2 text-sm" href={getAssetDownloadUrlById(workspace.output_asset_id!)!} download>下载 MP4</a></div></section> : null}
      {review ? <SubtitleReviewDialog key={`${workspace.id}-${reviewSession}-${workspace.revision}`} workspace={workspace} open readOnly={!canWrite || running} busy={busy} error={state.error} conflict={conflict} onClose={() => { onDirtyChange(false); setReview(false); }} onDirtyChange={onDirtyChange} onSave={state.save} onPreview={state.preview} onRender={(segments) => state.run("render", segments)} onRetry={(segments, ids) => state.run("translate", segments, ids)} onReload={async () => { if (await state.reload()) { setReview(false); onDirtyChange(false); } }} /> : null}
      <Dialog open={enlarged && Boolean(output)} onOpenChange={setEnlarged}><DialogContent className="max-w-6xl p-5"><DialogTitle>字幕翻译成片</DialogTitle><DialogDescription>最终压制结果</DialogDescription>{output ? <SubtitleVideoPreview url={output} label="放大成片" enlarged /> : null}</DialogContent></Dialog>
    </div>
  );
}
