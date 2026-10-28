"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import type { Asset, SubtitleWorkspace } from "@/lib/api-types";
import { subtitleFieldClass } from "@/lib/subtitle-translation";
import { SubtitleWorkspaceEditor } from "./workspace-editor";

export function SubtitleTranslationPanel({
  assets, canWrite, onAssetsChange, onDirtyChange
}: {
  assets: Asset[];
  canWrite: boolean;
  onAssetsChange: (assets: Asset[]) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [history, setHistory] = useState<SubtitleWorkspace[]>([]);
  const [selected, setSelected] = useState<SubtitleWorkspace | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const requestId = useRef(0);
  const alive = useRef(true);
  const latestAssets = useRef(assets);
  useEffect(() => { latestAssets.current = assets; }, [assets]);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    apiClient.listSubtitleWorkspaces({ signal: controller.signal, cache: "no-store" })
      .then((items) => {
        if (!alive.current || controller.signal.aborted) return;
        setHistory(items);
        setSelected(items[0] ?? null);
      }).catch((cause) => { if (!controller.signal.aborted) setError(getUserFacingErrorMessage(cause)); })
      .finally(() => { if (alive.current) setBusy(false); });
    return () => { alive.current = false; controller.abort(); };
  }, []);

  const markDirty = useCallback((value: boolean) => {
    dirty.current = value;
    onDirtyChange(value);
  }, [onDirtyChange]);
  const updateHistory = useCallback((workspace: SubtitleWorkspace) => {
    setHistory((items) => [workspace, ...items.filter((item) => item.id !== workspace.id)]);
  }, []);
  function discardAllowed() {
    if (dirty.current && !window.confirm("切换工作区将放弃未保存校对，继续？")) return false;
    markDirty(false);
    return true;
  }
  async function select(id: string) {
    if (!discardAllowed()) return;
    const token = ++requestId.current;
    setSelected(null);
    setBusy(true);
    setError(null);
    try {
      const workspace = await apiClient.getSubtitleWorkspace(id, { cache: "no-store" });
      if (alive.current && token === requestId.current) setSelected(workspace);
    } catch (cause) {
      if (alive.current && token === requestId.current) setError(getUserFacingErrorMessage(cause));
    } finally { if (alive.current && token === requestId.current) setBusy(false); }
  }
  async function create() {
    if (busy || !canWrite || !discardAllowed()) return;
    const token = ++requestId.current;
    setBusy(true);
    setError(null);
    try {
      const workspace = await apiClient.createSubtitleWorkspace({ name: "视频字幕翻译", target_language: "de", source_language: "auto" });
      if (!alive.current || token !== requestId.current) return;
      updateHistory(workspace);
      setSelected(workspace);
    } catch (cause) {
      if (alive.current && token === requestId.current) setError(getUserFacingErrorMessage(cause));
    } finally { if (alive.current && token === requestId.current) setBusy(false); }
  }

  return (
    <section aria-label="视频字幕翻译" className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4">
        <label className="min-w-0 flex-1 text-sm">持久化工作区历史
          <select aria-label="字幕工作区历史" className={`${subtitleFieldClass} mt-1`} value={selected?.id ?? ""} disabled={busy} onChange={(event) => { if (event.target.value) void select(event.target.value); }}>
            <option value="">{busy ? "正在加载…" : "选择工作区"}</option>
            {history.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.target_language} · {workspace.stage} · r{workspace.revision}</option>)}
          </select>
        </label>
        <Button disabled={busy || !canWrite} onClick={() => void create()}>新建字幕工作区</Button>
      </div>
      {error ? <div role="alert" className="text-sm text-destructive">{error}<Button variant="outline" onClick={() => { if (selected) void select(selected.id); else window.location.reload(); }}>重新加载</Button></div> : null}
      {selected ? <SubtitleWorkspaceEditor key={selected.id} initial={selected} assets={assets} canWrite={canWrite} onUpdate={updateHistory} onDirtyChange={markDirty} onAsset={(asset) => onAssetsChange([asset, ...latestAssets.current.filter((item) => item.id !== asset.id)])} /> : !busy ? <p className="py-12 text-center text-sm text-muted-foreground">{canWrite ? "新建工作区开始提取、翻译与校对。" : "暂无可查看的字幕工作区。"}</p> : null}
    </section>
  );
}
