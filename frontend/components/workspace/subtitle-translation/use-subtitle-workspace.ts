"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, getUserFacingErrorMessage, isApiError } from "@/lib/api-client";
import type { SubtitleOperation, SubtitleSegment, SubtitleWorkspace, SubtitleWorkspacePatch, ToolTask } from "@/lib/api-types";

export function useSubtitleWorkspace(initial: SubtitleWorkspace, onUpdate: (workspace: SubtitleWorkspace) => void) {
  const [workspace, setWorkspace] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [task, setTask] = useState<ToolTask | null>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const version = useRef(0);
  const current = useRef(workspace);
  const updateCallback = useRef(onUpdate);
  useEffect(() => { updateCallback.current = onUpdate; }, [onUpdate]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const accept = useCallback((next: SubtitleWorkspace) => {
    if (!alive.current || next.id !== current.current.id || next.revision < current.current.revision) return;
    current.current = next;
    setWorkspace(next);
    updateCallback.current(next);
  }, []);

  function fail(cause: unknown) {
    if (!alive.current) return;
    setConflict(isApiError(cause) && cause.status === 409);
    setError(getUserFacingErrorMessage(cause));
  }

  const active = workspace.active_task_id;
  const lastTaskId = active ?? workspace.stage_task_ids.render ?? workspace.stage_task_ids.translate ?? workspace.stage_task_ids.extract;
  useEffect(() => {
    if (active || !lastTaskId) return;
    const controller = new AbortController();
    apiClient.getToolTask(lastTaskId, { signal: controller.signal, cache: "no-store" })
      .then((next) => { if (!controller.signal.aborted && alive.current) setTask(next); })
      .catch((cause) => { if (!controller.signal.aborted && alive.current) setError(getUserFacingErrorMessage(cause)); });
    return () => controller.abort();
  }, [active, lastTaskId]);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const token = version.current;
    async function poll() {
      try {
        const [nextTask, nextWorkspace] = await Promise.all([
          apiClient.getToolTask(active!, { signal: controller.signal, cache: "no-store" }),
          apiClient.getSubtitleWorkspace(initial.id, { signal: controller.signal, cache: "no-store" })
        ]);
        if (stopped || !alive.current || token !== version.current) return;
        if (current.current.active_task_id === active) {
          setTask(nextTask);
          accept(nextWorkspace);
        }
        if (nextTask.status === "queued" || nextTask.status === "running") timer = setTimeout(poll, 2000);
      } catch (cause) {
        if (stopped || !alive.current) return;
        setError(getUserFacingErrorMessage(cause));
        timer = setTimeout(poll, 4000);
      }
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [active, initial.id, accept]);

  async function transaction(action: () => Promise<boolean>, invalidate = true) {
    if (locked.current) return false;
    locked.current = true;
    if (invalidate) version.current++;
    setBusy(true);
    setError(null);
    try { return await action(); }
    catch (cause) { fail(cause); return false; }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  async function patch(change: Omit<SubtitleWorkspacePatch, "expected_revision">) {
    const next = await apiClient.patchSubtitleWorkspace(current.current.id, {
      expected_revision: current.current.revision, ...change
    });
    if (!alive.current) return null;
    accept(next);
    setTask(null);
    setConflict(false);
    return next;
  }

  function update(change: Omit<SubtitleWorkspacePatch, "expected_revision">) {
    return transaction(async () => Boolean(await patch(change)));
  }

  function save(segments: SubtitleSegment[]) { return update({ segments }); }

  function run(operation: SubtitleOperation, segments?: SubtitleSegment[], ids?: string[]) {
    return transaction(async () => {
      if (segments && !await patch({ segments })) return false;
      if (!alive.current) return false;
      const base = current.current;
      const nextTask = await apiClient.runSubtitleOperation(base.id, operation, {
        expected_revision: base.revision, ...(ids ? { segment_ids: ids } : {})
      });
      if (!alive.current) return false;
      setTask(nextTask);
      if (nextTask.status === "queued" || nextTask.status === "running") {
        accept({
          ...base, active_task_id: nextTask.id,
          stage: operation === "extract" ? "extracting" : operation === "translate" ? "translating" : "rendering",
          stage_task_ids: { ...base.stage_task_ids, [operation]: nextTask.id },
          output_asset_id: null
        });
      }
      const next = await apiClient.getSubtitleWorkspace(base.id, { cache: "no-store" });
      accept(next);
      setConflict(false);
      return true;
    });
  }

  function retry() {
    return transaction(async () => {
      if (!task || task.status !== "failed") return false;
      const nextTask = await apiClient.retryToolTask(task.id);
      if (!alive.current) return false;
      setTask(nextTask);
      accept(await apiClient.getSubtitleWorkspace(current.current.id, { cache: "no-store" }));
      return true;
    });
  }

  async function reload() {
    return transaction(async () => {
      const next = await apiClient.getSubtitleWorkspace(current.current.id, { cache: "no-store" });
      if (!alive.current) return false;
      accept(next);
      setConflict(false);
      return true;
    }, false);
  }

  async function preview(segments: SubtitleSegment[]) {
    let result: SubtitleWorkspace | null = null;
    await transaction(async () => {
      result = await apiClient.previewSubtitleWorkspace(current.current.id, {
        expected_revision: current.current.revision, segments
      }, { cache: "no-store" });
      return true;
    });
    return alive.current ? result : null;
  }
  return { workspace, busy, error, conflict, task, update, save, run, retry, reload, preview };
}
