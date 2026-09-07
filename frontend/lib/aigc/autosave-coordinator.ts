export const AUTOSAVE_DEBOUNCE_MS = 800;
export const AUTOSAVE_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

export type AutosaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "failed"
  | "conflict"
  | "invalid";

export interface AutosaveState {
  status: AutosaveStatus;
  revision: number;
  latestSnapshotId: number;
  savedSnapshotId: number;
  dirty: boolean;
  message: string | null;
  retryAttempt: number;
}

export interface AutosaveRequest<T> {
  snapshot: Readonly<T>;
  snapshotId: number;
  expectedRevision: number;
}

export type AutosaveFlushFailureReason = "failed" | "conflict" | "invalid";

export type AutosaveFlushResult =
  | {
      ok: true;
      revision: number;
    }
  | {
      ok: false;
      reason: AutosaveFlushFailureReason;
      revision: number;
      message: string;
    };

interface OnlineEventTarget {
  addEventListener(type: "online", listener: () => void): void;
  removeEventListener(type: "online", listener: () => void): void;
}

export interface AutosaveCoordinatorOptions<T> {
  initialSnapshot: T;
  initialRevision: number;
  save: (request: AutosaveRequest<T>) => Promise<{ revision: number }>;
  equals: (left: Readonly<T>, right: Readonly<T>) => boolean;
  validate?: (snapshot: Readonly<T>) => string | null;
  clone?: (snapshot: T) => T;
  isConflict?: (error: unknown) => boolean;
  isRetryable?: (error: unknown) => boolean;
  getErrorMessage?: (error: unknown) => string;
  onlineTarget?: OnlineEventTarget | null;
}

export interface AutosaveFlushOptions<T> {
  validate?: (snapshot: Readonly<T>) => string | null;
}

export interface AutosaveRebaseOptions<T> {
  snapshot: T;
  revision: number;
  merge: (
    base: Readonly<T>,
    local: Readonly<T>,
    server: Readonly<T>
  ) => T;
}

export interface AutosaveRebaseResult<T> {
  applied: boolean;
  dirty: boolean;
  revision: number;
  snapshot: Readonly<T>;
}

type Snapshot<T> = {
  id: number;
  value: T;
};

export class AutosaveCoordinator<T> {
  private readonly clone: (snapshot: T) => T;
  private readonly equals: AutosaveCoordinatorOptions<T>["equals"];
  private readonly getErrorMessage: (error: unknown) => string;
  private readonly isConflict: (error: unknown) => boolean;
  private readonly isRetryable: (error: unknown) => boolean;
  private readonly onlineTarget: OnlineEventTarget | null;
  private readonly save: AutosaveCoordinatorOptions<T>["save"];
  private readonly validate: (snapshot: Readonly<T>) => string | null;
  private readonly listeners = new Set<(state: AutosaveState) => void>();

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private drainPromise: Promise<void> | null = null;
  private disposed = false;
  private nextSnapshotId = 1;
  private latestSnapshot: Snapshot<T>;
  private savedSnapshot: Snapshot<T>;
  private state: AutosaveState;

  constructor(options: AutosaveCoordinatorOptions<T>) {
    this.clone = options.clone ?? defaultClone;
    this.equals = options.equals;
    this.getErrorMessage = options.getErrorMessage ?? defaultErrorMessage;
    this.isConflict = options.isConflict ?? defaultIsConflict;
    this.isRetryable = options.isRetryable ?? defaultIsRetryable;
    this.onlineTarget =
      options.onlineTarget === undefined ? defaultOnlineTarget() : options.onlineTarget;
    this.save = options.save;
    this.validate = options.validate ?? (() => null);

    const initialSnapshot = this.capture(options.initialSnapshot);
    this.latestSnapshot = { id: 0, value: initialSnapshot };
    this.savedSnapshot = { id: 0, value: initialSnapshot };
    this.state = freezeState({
      status: "idle",
      revision: options.initialRevision,
      latestSnapshotId: 0,
      savedSnapshotId: 0,
      dirty: false,
      message: null,
      retryAttempt: 0
    });
    this.onlineTarget?.addEventListener("online", this.handleOnline);
  }

  getState(): AutosaveState {
    return this.state;
  }

  subscribe(listener: (state: AutosaveState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(snapshot: T): number {
    if (this.disposed) return this.latestSnapshot.id;

    const captured = this.capture(snapshot);
    if (this.equals(captured, this.latestSnapshot.value)) {
      return this.latestSnapshot.id;
    }

    const next = { id: this.nextSnapshotId++, value: captured };
    this.latestSnapshot = next;

    if (!this.drainPromise && this.equals(next.value, this.savedSnapshot.value)) {
      this.clearDebounce();
      this.savedSnapshot = next;
      this.setState({
        status: "saved",
        latestSnapshotId: next.id,
        savedSnapshotId: next.id,
        dirty: false,
        message: null,
        retryAttempt: 0
      });
      return next.id;
    }

    if (this.state.status === "conflict") {
      this.setState({
        latestSnapshotId: next.id,
        dirty: true
      });
      return next.id;
    }

    const validationMessage = this.validate(next.value);
    if (validationMessage) {
      this.clearDebounce();
      this.setState({
        status: this.drainPromise ? "saving" : "invalid",
        latestSnapshotId: next.id,
        dirty: true,
        message: this.drainPromise ? null : validationMessage,
        retryAttempt: 0
      });
      return next.id;
    }

    if (this.drainPromise) {
      this.setState({
        status: "saving",
        latestSnapshotId: next.id,
        dirty: true,
        message: null
      });
      return next.id;
    }

    this.scheduleDebouncedSave();
    return next.id;
  }

  async flush(
    options: AutosaveFlushOptions<T> = {}
  ): Promise<AutosaveFlushResult> {
    this.clearDebounce();
    const validate = options.validate ?? this.validate;

    if (this.drainPromise) {
      const activeDrain = this.drainPromise;
      await activeDrain;
      if (this.drainPromise === activeDrain) {
        this.drainPromise = null;
      }
    }
    if (!this.state.dirty) {
      return { ok: true, revision: this.state.revision };
    }
    if (this.state.status === "conflict") {
      return this.failureResult("conflict");
    }

    const validationMessage = validate(this.latestSnapshot.value);
    if (validationMessage) {
      this.setState({
        status: "invalid",
        dirty: true,
        message: validationMessage,
        retryAttempt: 0
      });
      return this.failureResult("invalid");
    }

    await this.startDrain(validate);

    const settledState = this.getState();
    if (!settledState.dirty) {
      return { ok: true, revision: settledState.revision };
    }
    if (
      settledState.status === "conflict" ||
      settledState.status === "invalid" ||
      settledState.status === "failed"
    ) {
      return this.failureResult(settledState.status);
    }
    return this.failureResult("failed", "自动保存未能完成。");
  }

  async rebase(
    options: AutosaveRebaseOptions<T>
  ): Promise<AutosaveRebaseResult<T>> {
    this.clearDebounce();
    if (this.drainPromise) {
      const activeDrain = this.drainPromise;
      await activeDrain;
      if (this.drainPromise === activeDrain) {
        this.drainPromise = null;
      }
    }

    if (this.disposed || options.revision <= this.state.revision) {
      return {
        applied: false,
        dirty: this.state.dirty,
        revision: this.state.revision,
        snapshot: this.latestSnapshot.value
      };
    }

    const serverValue = this.capture(options.snapshot);
    const hadLocalChanges = !this.equals(
      this.latestSnapshot.value,
      this.savedSnapshot.value
    );
    const rebasedValue = hadLocalChanges
      ? this.capture(
          options.merge(
            this.savedSnapshot.value,
            this.latestSnapshot.value,
            serverValue
          )
        )
      : serverValue;
    const serverSnapshot = {
      id: this.nextSnapshotId++,
      value: serverValue
    };
    this.savedSnapshot = serverSnapshot;

    const dirty = !this.equals(rebasedValue, serverValue);
    this.latestSnapshot = dirty
      ? { id: this.nextSnapshotId++, value: rebasedValue }
      : serverSnapshot;
    this.setState({
      status: dirty ? "pending" : "saved",
      revision: options.revision,
      latestSnapshotId: this.latestSnapshot.id,
      savedSnapshotId: this.savedSnapshot.id,
      dirty,
      message: null,
      retryAttempt: 0
    });

    if (dirty) {
      const validationMessage = this.validate(rebasedValue);
      if (validationMessage) {
        this.setState({
          status: "invalid",
          message: validationMessage
        });
      } else {
        this.scheduleDebouncedSave();
      }
    }

    return {
      applied: true,
      dirty,
      revision: options.revision,
      snapshot: this.latestSnapshot.value
    };
  }

  notifyOnline(): void {
    if (
      this.disposed ||
      this.state.status !== "failed" ||
      !this.state.dirty ||
      this.drainPromise
    ) {
      return;
    }

    const validationMessage = this.validate(this.latestSnapshot.value);
    if (validationMessage) {
      this.setState({
        status: "invalid",
        message: validationMessage,
        retryAttempt: 0
      });
      return;
    }

    void this.startDrain();
  }

  activate(): void {
    if (!this.disposed) return;
    this.disposed = false;
    this.onlineTarget?.addEventListener("online", this.handleOnline);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearDebounce();
    this.onlineTarget?.removeEventListener("online", this.handleOnline);
    this.listeners.clear();
  }

  private readonly handleOnline = () => {
    this.notifyOnline();
  };

  private capture(snapshot: T): T {
    return deepFreeze(this.clone(snapshot));
  }

  private scheduleDebouncedSave(): void {
    this.clearDebounce();
    this.setState({
      status: "pending",
      latestSnapshotId: this.latestSnapshot.id,
      dirty: true,
      message: null,
      retryAttempt: 0
    });
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.startDrain();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  private startDrain(
    validate: (snapshot: Readonly<T>) => string | null = this.validate
  ): Promise<void> {
    if (this.drainPromise) return this.drainPromise;

    const promise = this.drain(validate);
    this.drainPromise = promise;
    void promise.finally(() => {
      if (this.drainPromise === promise) {
        this.drainPromise = null;
      }
    });
    return promise;
  }

  private async drain(
    validate: (snapshot: Readonly<T>) => string | null
  ): Promise<void> {
    while (!this.disposed && this.latestSnapshot.id !== this.savedSnapshot.id) {
      const submitted = this.latestSnapshot;
      const validationMessage = validate(submitted.value);
      if (validationMessage) {
        this.setState({
          status: "invalid",
          dirty: true,
          message: validationMessage,
          retryAttempt: 0
        });
        return;
      }

      this.setState({
        status: "saving",
        latestSnapshotId: this.latestSnapshot.id,
        dirty: true,
        message: null,
        retryAttempt: 0
      });

      const outcome = await this.saveWithRetry(submitted);
      if (outcome.ok) {
        this.savedSnapshot = submitted;
        const latestMatchesSaved = this.equals(
          this.latestSnapshot.value,
          submitted.value
        );
        if (latestMatchesSaved) {
          this.savedSnapshot = this.latestSnapshot;
        }
        this.setState({
          status: latestMatchesSaved ? "saved" : "saving",
          revision: outcome.revision,
          latestSnapshotId: this.latestSnapshot.id,
          savedSnapshotId: this.savedSnapshot.id,
          dirty: !latestMatchesSaved,
          message: null,
          retryAttempt: 0
        });
        continue;
      }

      if (outcome.reason === "conflict") {
        this.setState({
          status: "conflict",
          latestSnapshotId: this.latestSnapshot.id,
          dirty: true,
          message: outcome.message,
          retryAttempt: 0
        });
        return;
      }

      if (this.latestSnapshot.id !== submitted.id) {
        continue;
      }

      this.setState({
        status: "failed",
        latestSnapshotId: this.latestSnapshot.id,
        dirty: true,
        message: outcome.message,
        retryAttempt: outcome.retryAttempt
      });
      return;
    }
  }

  private async saveWithRetry(
    submitted: Snapshot<T>
  ): Promise<
    | { ok: true; revision: number }
    | {
        ok: false;
        reason: "failed" | "conflict";
        message: string;
        retryAttempt: number;
      }
  > {
    let retryAttempt = 0;

    while (!this.disposed) {
      try {
        const result = await this.save({
          snapshot: this.capture(submitted.value),
          snapshotId: submitted.id,
          expectedRevision: this.state.revision
        });
        return { ok: true, revision: result.revision };
      } catch (error) {
        if (this.isConflict(error)) {
          return {
            ok: false,
            reason: "conflict",
            message: this.getErrorMessage(error),
            retryAttempt
          };
        }
        if (
          !this.isRetryable(error) ||
          retryAttempt >= AUTOSAVE_RETRY_DELAYS_MS.length
        ) {
          return {
            ok: false,
            reason: "failed",
            message: this.getErrorMessage(error),
            retryAttempt
          };
        }

        const delay = AUTOSAVE_RETRY_DELAYS_MS[retryAttempt];
        retryAttempt += 1;
        this.setState({
          status: "saving",
          dirty: true,
          message: this.getErrorMessage(error),
          retryAttempt
        });
        await wait(delay);
      }
    }

    return {
      ok: false,
      reason: "failed",
      message: "自动保存协调器已停止。",
      retryAttempt
    };
  }

  private failureResult(
    reason: AutosaveFlushFailureReason,
    fallbackMessage?: string
  ): AutosaveFlushResult {
    return {
      ok: false,
      reason,
      revision: this.state.revision,
      message: this.state.message ?? fallbackMessage ?? "自动保存失败。"
    };
  }

  private clearDebounce(): void {
    if (this.debounceTimer === null) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  private setState(patch: Partial<AutosaveState>): void {
    this.state = freezeState({ ...this.state, ...patch });
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function defaultClone<T>(snapshot: T): T {
  return structuredClone(snapshot);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (
    value === null ||
    typeof value !== "object" ||
    ArrayBuffer.isView(value) ||
    seen.has(value)
  ) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }
  return Object.freeze(value);
}

function freezeState(state: AutosaveState): AutosaveState {
  return Object.freeze(state);
}

function errorStatus(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return null;
}

function defaultIsConflict(error: unknown): boolean {
  return errorStatus(error) === 409;
}

function defaultIsRetryable(error: unknown): boolean {
  const status = errorStatus(error);
  return error instanceof TypeError || status === 0 || (status !== null && status >= 500);
}

function defaultErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "自动保存失败。";
}

function defaultOnlineTarget(): OnlineEventTarget | null {
  return typeof globalThis.addEventListener === "function" &&
    typeof globalThis.removeEventListener === "function"
    ? globalThis
    : null;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
