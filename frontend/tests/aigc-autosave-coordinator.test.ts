import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTOSAVE_DEBOUNCE_MS,
  AutosaveCoordinator,
  type AutosaveRequest
} from "@/lib/aigc/autosave-coordinator";

interface Draft {
  name: string;
  nested: {
    value: number;
  };
}

function draft(name: string, value = 0): Draft {
  return { name, nested: { value } };
}

function createCoordinator(
  save: (request: AutosaveRequest<Draft>) => Promise<{ revision: number }>,
  options: {
    validate?: (snapshot: Readonly<Draft>) => string | null;
    onlineTarget?: {
      addEventListener(type: "online", listener: () => void): void;
      removeEventListener(type: "online", listener: () => void): void;
    } | null;
  } = {}
) {
  return new AutosaveCoordinator<Draft>({
    initialSnapshot: draft("initial"),
    initialRevision: 1,
    equals: (left, right) =>
      left.name === right.name && left.nested.value === right.nested.value,
    save,
    ...options
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function settleMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AutosaveCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes the complete state contract and saved snapshot marker", async () => {
    const save = vi.fn().mockResolvedValue({ revision: 2 });
    const coordinator = createCoordinator(save);

    expect(coordinator.getState()).toEqual({
      status: "idle",
      revision: 1,
      latestSnapshotId: 0,
      savedSnapshotId: 0,
      dirty: false,
      message: null,
      retryAttempt: 0
    });

    const snapshotId = coordinator.update(draft("changed"));
    expect(coordinator.getState()).toMatchObject({
      status: "pending",
      latestSnapshotId: snapshotId,
      savedSnapshotId: 0,
      dirty: true
    });

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);

    expect(coordinator.getState()).toMatchObject({
      status: "saved",
      revision: 2,
      latestSnapshotId: snapshotId,
      savedSnapshotId: snapshotId,
      dirty: false
    });
    coordinator.dispose();
  });

  it("debounces changes for 800ms and submits an immutable latest snapshot", async () => {
    const requests: AutosaveRequest<Draft>[] = [];
    const save = vi.fn(async (request: AutosaveRequest<Draft>) => {
      requests.push(request);
      return { revision: 2 };
    });
    const coordinator = createCoordinator(save);
    const first = draft("first", 1);
    const latest = draft("latest", 2);

    coordinator.update(first);
    await vi.advanceTimersByTimeAsync(600);
    coordinator.update(latest);
    latest.name = "mutated outside";
    latest.nested.value = 99;

    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(requests[0]).toMatchObject({
      snapshot: draft("latest", 2),
      expectedRevision: 1
    });
    expect(Object.isFrozen(requests[0].snapshot)).toBe(true);
    expect(Object.isFrozen(requests[0].snapshot.nested)).toBe(true);
    coordinator.dispose();
  });

  it("keeps saves single-flight and immediately continues with the latest draft", async () => {
    const firstSave = deferred<{ revision: number }>();
    const secondSave = deferred<{ revision: number }>();
    const save = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const coordinator = createCoordinator(save);

    coordinator.update(draft("first"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);

    coordinator.update(draft("second"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().status).toBe("saving");

    firstSave.resolve({ revision: 2 });
    await settleMicrotasks();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({
      snapshot: draft("second"),
      expectedRevision: 2
    });
    expect(coordinator.getState()).toMatchObject({
      status: "saving",
      revision: 2,
      dirty: true
    });

    secondSave.resolve({ revision: 3 });
    await settleMicrotasks();
    expect(coordinator.getState()).toMatchObject({
      status: "saved",
      revision: 3,
      dirty: false
    });
    coordinator.dispose();
  });

  it("retries network and 5xx failures after 1s, 2s, and 4s", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockRejectedValueOnce({ status: 503, message: "unavailable" })
      .mockRejectedValueOnce({ status: 500, message: "server error" })
      .mockResolvedValueOnce({ revision: 2 });
    const coordinator = createCoordinator(save);

    coordinator.update(draft("retry"));
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().retryAttempt).toBe(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(save).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(save).toHaveBeenCalledTimes(4);
    expect(coordinator.getState()).toMatchObject({
      status: "saved",
      revision: 2,
      retryAttempt: 0
    });
    coordinator.dispose();
  });

  it("fails after three retries and resumes on a new change", async () => {
    const save = vi
      .fn()
      .mockRejectedValue({ status: 500, message: "service unavailable" });
    const coordinator = createCoordinator(save);

    coordinator.update(draft("fails"));
    await vi.advanceTimersByTimeAsync(7_800);

    expect(save).toHaveBeenCalledTimes(4);
    expect(coordinator.getState()).toMatchObject({
      status: "failed",
      dirty: true,
      message: "service unavailable",
      retryAttempt: 3
    });

    save.mockResolvedValueOnce({ revision: 2 });
    coordinator.update(draft("recovered"));
    expect(coordinator.getState().status).toBe("pending");
    await vi.advanceTimersByTimeAsync(800);

    expect(save).toHaveBeenCalledTimes(5);
    expect(coordinator.getState()).toMatchObject({
      status: "saved",
      revision: 2,
      dirty: false
    });
    coordinator.dispose();
  });

  it("resumes an exhausted failed save when the browser comes online", async () => {
    let onlineListener = () => {};
    const onlineTarget = {
      addEventListener: vi.fn((_type: "online", listener: () => void) => {
        onlineListener = listener;
      }),
      removeEventListener: vi.fn()
    };
    const save = vi
      .fn()
      .mockRejectedValue({ status: 500, message: "offline" });
    const coordinator = createCoordinator(save, { onlineTarget });

    coordinator.update(draft("offline"));
    await vi.advanceTimersByTimeAsync(7_800);
    expect(coordinator.getState().status).toBe("failed");

    save.mockResolvedValueOnce({ revision: 2 });
    onlineListener();
    await settleMicrotasks();

    expect(save).toHaveBeenCalledTimes(5);
    expect(coordinator.getState()).toMatchObject({
      status: "saved",
      revision: 2
    });

    coordinator.dispose();
    expect(onlineTarget.removeEventListener).toHaveBeenCalledWith(
      "online",
      expect.any(Function)
    );
  });

  it("stops on 409 and returns a structured conflict without later overwrite", async () => {
    const save = vi
      .fn()
      .mockRejectedValue({ status: 409, message: "revision conflict" });
    const coordinator = createCoordinator(save);

    coordinator.update(draft("conflict"));
    const resultPromise = coordinator.flush();
    await settleMicrotasks();
    const result = await resultPromise;

    expect(result).toEqual({
      ok: false,
      reason: "conflict",
      revision: 1,
      message: "revision conflict"
    });
    expect(coordinator.getState()).toMatchObject({
      status: "conflict",
      dirty: true
    });

    coordinator.update(draft("still blocked"));
    coordinator.notifyOnline();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    coordinator.dispose();
  });

  it("returns a structured failure when flush exhausts transient retries", async () => {
    const save = vi
      .fn()
      .mockRejectedValue({ status: 503, message: "service unavailable" });
    const coordinator = createCoordinator(save);

    coordinator.update(draft("flush failure"));
    const resultPromise = coordinator.flush();
    await vi.advanceTimersByTimeAsync(7_000);

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      reason: "failed",
      revision: 1,
      message: "service unavailable"
    });
    expect(save).toHaveBeenCalledTimes(4);
    coordinator.dispose();
  });

  it("does not submit invalid drafts and recovers after validation succeeds", async () => {
    const save = vi.fn().mockResolvedValue({ revision: 2 });
    const coordinator = createCoordinator(save, {
      validate: (snapshot) => (snapshot.name.trim() ? null : "名称不能为空")
    });

    coordinator.update(draft(""));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).not.toHaveBeenCalled();
    expect(await coordinator.flush()).toEqual({
      ok: false,
      reason: "invalid",
      revision: 1,
      message: "名称不能为空"
    });

    coordinator.update(draft("valid"));
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);
    expect(coordinator.getState().status).toBe("saved");
    coordinator.dispose();
  });

  it("flushes pending work immediately and returns the latest saved revision", async () => {
    const firstSave = deferred<{ revision: number }>();
    const secondSave = deferred<{ revision: number }>();
    const save = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const coordinator = createCoordinator(save);

    coordinator.update(draft("first"));
    const flushPromise = coordinator.flush();
    expect(save).toHaveBeenCalledTimes(1);

    coordinator.update(draft("latest"));
    firstSave.resolve({ revision: 2 });
    await settleMicrotasks();
    expect(save).toHaveBeenCalledTimes(2);

    secondSave.resolve({ revision: 3 });
    await expect(flushPromise).resolves.toEqual({ ok: true, revision: 3 });
    expect(coordinator.getState().dirty).toBe(false);
    coordinator.dispose();
  });

  it("starts a scoped drain after an active global drain rejects the latest draft", async () => {
    const firstSave = deferred<{ revision: number }>();
    const secondSave = deferred<{ revision: number }>();
    const save = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);
    const coordinator = createCoordinator(save, {
      validate: (snapshot) =>
        snapshot.name === "invalid-other-flow"
          ? "其他流程无效"
          : null
    });

    coordinator.update(draft("valid-first"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);

    coordinator.update(draft("invalid-other-flow"));
    const scopedFlush = coordinator.flush({ validate: () => null });
    firstSave.resolve({ revision: 2 });
    await settleMicrotasks();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({
      snapshot: draft("invalid-other-flow"),
      expectedRevision: 2
    });

    secondSave.resolve({ revision: 3 });
    await expect(scopedFlush).resolves.toEqual({ ok: true, revision: 3 });
    expect(coordinator.getState()).toMatchObject({
      status: "saved",
      dirty: false,
      revision: 3
    });
    coordinator.dispose();
  });

  it("does not save duplicate snapshots or a draft reverted before debounce", async () => {
    const save = vi.fn().mockResolvedValue({ revision: 2 });
    const coordinator = createCoordinator(save);

    coordinator.update(draft("initial"));
    coordinator.update(draft("changed"));
    coordinator.update(draft("initial"));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(save).not.toHaveBeenCalled();
    expect(coordinator.getState()).toMatchObject({
      status: "saved",
      dirty: false
    });
    coordinator.dispose();
  });

  it("rebases clean and dirty snapshots onto a newer server revision", async () => {
    const save = vi.fn().mockResolvedValue({ revision: 4 });
    const coordinator = createCoordinator(save);

    await expect(
      coordinator.rebase({
        merge: (_base, local, server) => ({
          ...server,
          name: local.name
        }),
        revision: 2,
        snapshot: draft("server-clean", 2)
      })
    ).resolves.toEqual({
      applied: true,
      dirty: false,
      revision: 2,
      snapshot: draft("server-clean", 2)
    });

    coordinator.update(draft("local-dirty", 3));
    await expect(
      coordinator.rebase({
        merge: (_base, local, server) => ({
          ...server,
          name: local.name
        }),
        revision: 3,
        snapshot: draft("server-newer", 4)
      })
    ).resolves.toEqual({
      applied: true,
      dirty: true,
      revision: 3,
      snapshot: draft("local-dirty", 4)
    });

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: 3,
        snapshot: draft("local-dirty", 4)
      })
    );
    coordinator.dispose();
  });

  it("ignores duplicate server revisions", async () => {
    const coordinator = createCoordinator(vi.fn());

    await expect(
      coordinator.rebase({
        merge: (_base, local) => local,
        revision: 1,
        snapshot: draft("duplicate")
      })
    ).resolves.toMatchObject({
      applied: false,
      dirty: false,
      revision: 1,
      snapshot: draft("initial")
    });
    coordinator.dispose();
  });

  it("waits for an in-flight save before rebasing and resumes serially after conflict", async () => {
    const firstSave = deferred<{ revision: number }>();
    const save = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({ revision: 3 });
    const coordinator = createCoordinator(save);

    coordinator.update(draft("local-before-materialization", 1));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);

    const rebasePromise = coordinator.rebase({
      merge: (_base, local, server) => ({
        ...server,
        name: local.name
      }),
      revision: 2,
      snapshot: draft("server-materialized", 2)
    });
    await settleMicrotasks();
    expect(save).toHaveBeenCalledTimes(1);

    firstSave.reject({ status: 409, message: "revision conflict" });
    await expect(rebasePromise).resolves.toMatchObject({
      applied: true,
      dirty: true,
      revision: 2,
      snapshot: draft("local-before-materialization", 2)
    });

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({
      expectedRevision: 2,
      snapshot: draft("local-before-materialization", 2)
    });
    expect(coordinator.getState()).toMatchObject({
      dirty: false,
      revision: 3,
      status: "saved"
    });
    coordinator.dispose();
  });
});
