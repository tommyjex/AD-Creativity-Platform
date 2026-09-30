"use client";

import {
  KeyRound,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserRoundCheck,
  UserRoundX
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiClient,
  getUserFacingErrorMessage,
  isApiError,
  type ApiClient
} from "@/lib/api-client";
import type { AuthUser, CreateUserRequest, UserRole } from "@/lib/api-types";
import { canManageUsers } from "@/lib/auth/permissions";

type AdminUsersClient = Pick<
  ApiClient,
  | "createUser"
  | "listUsers"
  | "resetUserPassword"
  | "updateUserRole"
  | "updateUserStatus"
>;

type UserAction =
  | { type: "role"; user: AuthUser }
  | { type: "status"; user: AuthUser }
  | { type: "password"; user: AuthUser };

interface CreateDraft {
  confirmPassword: string;
  displayName: string;
  password: string;
  role: UserRole;
  username: string;
}

const EMPTY_CREATE_DRAFT: CreateDraft = {
  confirmPassword: "",
  displayName: "",
  password: "",
  role: "creator",
  username: ""
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "管理员",
  creator: "创作者",
  viewer: "仅查看"
};

const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
  year: "numeric"
});

export function UserManagement({
  client = apiClient,
  currentUser
}: {
  client?: AdminUsersClient;
  currentUser: AuthUser | null;
}) {
  const allowed = canManageUsers(currentUser);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(allowed);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] =
    useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [action, setAction] = useState<UserAction | null>(null);
  const [roleDraft, setRoleDraft] = useState<UserRole>("viewer");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!allowed) return;

    let active = true;
    client.listUsers().then(
      (nextUsers) => {
        if (!active) return;
        setUsers(nextUsers);
        setLoading(false);
      },
      (error: unknown) => {
        if (!active) return;
        setLoadError(getUserFacingErrorMessage(error));
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [allowed, client]);

  if (!allowed) {
    return (
      <main className="container py-16 2xl:max-w-[1600px]">
        <div
          className="mx-auto max-w-xl rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-8 text-center"
          role="alert"
        >
          <ShieldAlert
            aria-hidden="true"
            className="mx-auto mb-4 h-8 w-8 text-destructive"
          />
          <h1 className="text-xl font-semibold">无权访问用户管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            当前账号没有管理员权限，此页面不会请求用户数据。
          </p>
        </div>
      </main>
    );
  }

  function replaceUser(updated: AuthUser) {
    setUsers((current) =>
      current.map((user) => (user.id === updated.id ? updated : user))
    );
  }

  function openAction(nextAction: UserAction) {
    setDialogError(null);
    setPasswordDraft("");
    setPasswordConfirm("");
    if (nextAction.type === "role") {
      setRoleDraft(nextAction.user.role);
    }
    setAction(nextAction);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const validationError = validateCreateDraft(createDraft);
    if (validationError) {
      setDialogError(validationError);
      return;
    }

    setSubmitting(true);
    setDialogError(null);
    const payload: CreateUserRequest = {
      display_name: createDraft.displayName.trim(),
      password: createDraft.password,
      role: createDraft.role,
      username: createDraft.username.trim()
    };
    try {
      const created = await client.createUser(payload);
      setUsers((current) => [...current, created]);
      setCreateOpen(false);
      setCreateDraft(EMPTY_CREATE_DRAFT);
      setFeedback(`${created.username} 已创建，并需在首次登录后修改密码。`);
    } catch (error) {
      setDialogError(getManagementErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || submitting) return;
    if (action.type === "password") {
      const validationError = validatePassword(
        passwordDraft,
        passwordConfirm,
        action.user.username
      );
      if (validationError) {
        setDialogError(validationError);
        return;
      }
    }

    setSubmitting(true);
    setDialogError(null);
    try {
      let updated: AuthUser;
      if (action.type === "role") {
        updated = await client.updateUserRole(action.user.id, roleDraft);
        setFeedback(`${updated.username} 的角色已更新为${ROLE_LABELS[updated.role]}。`);
      } else if (action.type === "status") {
        const nextEnabled = !action.user.is_enabled;
        updated = await client.updateUserStatus(action.user.id, nextEnabled);
        setFeedback(
          `${updated.username} 已${updated.is_enabled ? "启用" : "停用"}。`
        );
      } else {
        updated = await client.resetUserPassword(
          action.user.id,
          passwordDraft
        );
        setFeedback(
          `${updated.username} 的临时密码已重置，下次登录必须修改密码。`
        );
      }
      replaceUser(updated);
      setAction(null);
    } catch (error) {
      setDialogError(getManagementErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const enabledCount = users.filter((user) => user.is_enabled).length;
  const forcedPasswordCount = users.filter(
    (user) => user.must_change_password
  ).length;

  return (
    <main className="container py-8 sm:py-12 2xl:max-w-[1600px]">
      <section className="mb-8 flex flex-col gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.22em] text-primary">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Access Control
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            用户管理
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            创建共享工作区账号，调整角色与访问状态，并管理首次登录临时密码。
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} type="button">
          <Plus aria-hidden="true" className="h-4 w-4" />
          创建用户
        </Button>
      </section>

      <div className="mb-5 grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3">
        <Stat label="账号总数" value={users.length} />
        <Stat label="启用账号" value={enabledCount} />
        <Stat label="待改密码" value={forcedPasswordCount} />
      </div>

      {feedback ? (
        <div
          className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
          role="status"
        >
          {feedback}
        </div>
      ) : null}

      {loadError ? (
        <div
          className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-sm"
          role="alert"
        >
          <span>{loadError}</span>
          <Button
            onClick={() => window.location.reload()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            重试
          </Button>
        </div>
      ) : null}

      <section
        aria-label="用户列表"
        className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur"
      >
        <div className="hidden grid-cols-[minmax(12rem,1.4fr)_8rem_8rem_8rem_10rem_10rem_minmax(17rem,auto)] gap-3 border-b border-border bg-secondary/45 px-5 py-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground xl:grid">
          <span>用户</span>
          <span>角色</span>
          <span>状态</span>
          <span>密码</span>
          <span>最近登录</span>
          <span>创建时间</span>
          <span className="text-right">操作</span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            正在加载用户...
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            暂无用户
          </div>
        ) : (
          <ul className="divide-y divide-border/80">
            {users.map((user) => (
              <UserRow key={user.id} onAction={openAction} user={user} />
            ))}
          </ul>
        )}
      </section>

      <CreateUserDialog
        draft={createDraft}
        error={dialogError}
        onDraftChange={setCreateDraft}
        onOpenChange={(open) => {
          if (submitting) return;
          setCreateOpen(open);
          setDialogError(null);
          if (!open) setCreateDraft(EMPTY_CREATE_DRAFT);
        }}
        onSubmit={createUser}
        open={createOpen}
        submitting={submitting}
      />

      <UserActionDialog
        action={action}
        error={dialogError}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setAction(null);
            setDialogError(null);
          }
        }}
        onPasswordChange={setPasswordDraft}
        onPasswordConfirmChange={setPasswordConfirm}
        onRoleChange={setRoleDraft}
        onSubmit={submitAction}
        password={passwordDraft}
        passwordConfirm={passwordConfirm}
        role={roleDraft}
        submitting={submitting}
      />
    </main>
  );
}

function UserRow({
  onAction,
  user
}: {
  onAction: (action: UserAction) => void;
  user: AuthUser;
}) {
  return (
    <li className="grid gap-4 px-4 py-5 xl:grid-cols-[minmax(12rem,1.4fr)_8rem_8rem_8rem_10rem_10rem_minmax(17rem,auto)] xl:items-center xl:gap-3 xl:px-5 xl:py-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{user.display_name}</div>
        <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
          {user.username}
        </div>
      </div>
      <LabeledCell label="角色">
        <RoleBadge role={user.role} />
      </LabeledCell>
      <LabeledCell label="状态">
        <Badge variant={user.is_enabled ? "success" : "destructive"}>
          {user.is_enabled ? "已启用" : "已停用"}
        </Badge>
      </LabeledCell>
      <LabeledCell label="密码">
        <Badge variant={user.must_change_password ? "warning" : "secondary"}>
          {user.must_change_password ? "需改密" : "正常"}
        </Badge>
      </LabeledCell>
      <LabeledCell label="最近登录">
        <TimeValue value={user.last_login_at} />
      </LabeledCell>
      <LabeledCell label="创建时间">
        <TimeValue value={user.created_at} />
      </LabeledCell>
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <Button
          aria-label={`修改 ${user.username} 的角色`}
          onClick={() => onAction({ type: "role", user })}
          size="sm"
          type="button"
          variant="outline"
        >
          <UserCog aria-hidden="true" className="h-3.5 w-3.5" />
          角色
        </Button>
        <Button
          aria-label={`${user.is_enabled ? "停用" : "启用"} ${user.username}`}
          onClick={() => onAction({ type: "status", user })}
          size="sm"
          type="button"
          variant="outline"
        >
          {user.is_enabled ? (
            <UserRoundX aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <UserRoundCheck aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {user.is_enabled ? "停用" : "启用"}
        </Button>
        <Button
          aria-label={`重置 ${user.username} 的密码`}
          onClick={() => onAction({ type: "password", user })}
          size="sm"
          type="button"
          variant="outline"
        >
          <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
          重置密码
        </Button>
      </div>
    </li>
  );
}

function LabeledCell({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 xl:block">
      <span className="w-20 shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground xl:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const variant =
    role === "admin" ? "default" : role === "creator" ? "info" : "secondary";
  return <Badge variant={variant}>{ROLE_LABELS[role]}</Badge>;
}

function TimeValue({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-xs text-muted-foreground">从未登录</span>;
  }
  return (
    <time
      className="text-xs tabular-nums text-muted-foreground"
      dateTime={value}
    >
      {DATE_FORMATTER.format(new Date(value))}
    </time>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/65 px-3 py-3">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CreateUserDialog({
  draft,
  error,
  onDraftChange,
  onOpenChange,
  onSubmit,
  open,
  submitting
}: {
  draft: CreateDraft;
  error: string | null;
  onDraftChange: (draft: CreateDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  submitting: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <form
          aria-label="创建用户"
          className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-6 sm:p-7"
          onSubmit={onSubmit}
        >
          <DialogHeader className="pr-10">
            <DialogTitle>创建用户</DialogTitle>
            <DialogDescription>
              新账号默认启用，并须在首次登录后修改临时密码。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="用户名">
              <Input
                autoComplete="off"
                id="create-username"
                onChange={(event) =>
                  onDraftChange({ ...draft, username: event.target.value })
                }
                placeholder="creative.user"
                value={draft.username}
              />
            </Field>
            <Field label="显示名称">
              <Input
                autoComplete="off"
                id="create-display-name"
                onChange={(event) =>
                  onDraftChange({ ...draft, displayName: event.target.value })
                }
                placeholder="创作用户"
                value={draft.displayName}
              />
            </Field>
            <Field label="角色">
              <select
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/15"
                id="create-role"
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    role: event.target.value as UserRole
                  })
                }
                value={draft.role}
              >
                <RoleOptions />
              </select>
            </Field>
            <div className="hidden sm:block" />
            <Field label="临时密码">
              <Input
                autoComplete="new-password"
                id="create-password"
                onChange={(event) =>
                  onDraftChange({ ...draft, password: event.target.value })
                }
                type="password"
                value={draft.password}
              />
            </Field>
            <Field label="确认临时密码">
              <Input
                autoComplete="new-password"
                id="create-confirm-password"
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    confirmPassword: event.target.value
                  })
                }
                type="password"
                value={draft.confirmPassword}
              />
            </Field>
          </div>
          <DialogError message={error} />
          <DialogFooter className="mt-6">
            <Button
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              取消
            </Button>
            <Button disabled={submitting} type="submit">
              {submitting ? "正在创建..." : "确认创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserActionDialog({
  action,
  error,
  onOpenChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onRoleChange,
  onSubmit,
  password,
  passwordConfirm,
  role,
  submitting
}: {
  action: UserAction | null;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onRoleChange: (role: UserRole) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  passwordConfirm: string;
  role: UserRole;
  submitting: boolean;
}) {
  const title = getActionTitle(action);
  return (
    <Dialog onOpenChange={onOpenChange} open={action !== null}>
      <DialogContent className="max-w-md">
        <form
          aria-label={title}
          className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-6 sm:p-7"
          onSubmit={onSubmit}
        >
          <DialogHeader className="pr-10">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {action ? getActionDescription(action) : ""}
            </DialogDescription>
          </DialogHeader>

          {action?.type === "role" ? (
            <div className="mt-6">
              <Field label="新角色">
                <select
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary/45 focus:ring-2 focus:ring-primary/15"
                  id="action-role"
                  onChange={(event) =>
                    onRoleChange(event.target.value as UserRole)
                  }
                  value={role}
                >
                  <RoleOptions />
                </select>
              </Field>
            </div>
          ) : null}

          {action?.type === "password" ? (
            <div className="mt-6 grid gap-4">
              <Field label="新临时密码">
                <Input
                  autoComplete="new-password"
                  id="reset-password"
                  onChange={(event) => onPasswordChange(event.target.value)}
                  type="password"
                  value={password}
                />
              </Field>
              <Field label="确认新临时密码">
                <Input
                  autoComplete="new-password"
                  id="reset-password-confirm"
                  onChange={(event) =>
                    onPasswordConfirmChange(event.target.value)
                  }
                  type="password"
                  value={passwordConfirm}
                />
              </Field>
            </div>
          ) : null}

          <DialogError message={error} />
          <DialogFooter className="mt-6">
            <Button
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              取消
            </Button>
            <Button
              disabled={submitting}
              type="submit"
              variant={
                action?.type === "status" && action.user.is_enabled
                  ? "destructive"
                  : "default"
              }
            >
              {submitting ? "正在提交..." : getActionSubmitLabel(action)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  children,
  label
}: {
  children: React.ReactElement<{ id?: string }>;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={children.props.id}>{label}</Label>
      {children}
    </div>
  );
}

function DialogError({ message }: { message: string | null }) {
  return message ? (
    <div
      className="mt-5 rounded-lg border border-destructive/30 bg-destructive/[0.07] px-3 py-2 text-sm text-destructive"
      role="alert"
    >
      {message}
    </div>
  ) : null;
}

function RoleOptions() {
  return (
    <>
      <option value="admin">管理员</option>
      <option value="creator">创作者</option>
      <option value="viewer">仅查看</option>
    </>
  );
}

function validateCreateDraft(draft: CreateDraft): string | null {
  if (!/^[a-z0-9._-]{3,64}$/.test(draft.username.trim().toLowerCase())) {
    return "用户名需为 3 至 64 位，仅可使用字母、数字、点、下划线和连字符。";
  }
  if (!draft.displayName.trim() || draft.displayName.trim().length > 80) {
    return "显示名称需为 1 至 80 个字符。";
  }
  return validatePassword(
    draft.password,
    draft.confirmPassword,
    draft.username
  );
}

function validatePassword(
  password: string,
  confirmPassword: string,
  username: string
): string | null {
  if (password.length < 12 || password.length > 128) {
    return "密码需为 12 至 128 个字符。";
  }
  if (password.toLowerCase() === username.trim().toLowerCase()) {
    return "密码不能与用户名相同。";
  }
  if (password !== confirmPassword) {
    return "两次输入的密码不一致。";
  }
  return null;
}

function getManagementErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === "last_admin_required") {
      return "必须保留至少一个已启用的管理员。请先启用或指定其他管理员。";
    }
    if (error.code === "username_conflict") {
      return "该用户名已存在，请使用其他用户名。";
    }
    if (error.code === "user_not_found") {
      return "该用户已不存在，请刷新列表。";
    }
  }
  return getUserFacingErrorMessage(error);
}

function getActionTitle(action: UserAction | null): string {
  if (!action) return "用户操作";
  if (action.type === "role") return "修改用户角色";
  if (action.type === "password") return "重置临时密码";
  return action.user.is_enabled ? "停用用户" : "启用用户";
}

function getActionDescription(action: UserAction): string {
  if (action.type === "role") {
    return `修改 ${action.user.username} 的角色后，该用户的现有会话将失效。`;
  }
  if (action.type === "password") {
    return `为 ${action.user.username} 设置新临时密码；其现有会话将失效。`;
  }
  return action.user.is_enabled
    ? `停用 ${action.user.username} 后，该用户将立即退出且无法重新登录。`
    : `启用 ${action.user.username} 后，该用户可以重新登录。`;
}

function getActionSubmitLabel(action: UserAction | null): string {
  if (!action) return "确认";
  if (action.type === "role") return "保存角色";
  if (action.type === "password") return "确认重置";
  return action.user.is_enabled ? "确认停用" : "确认启用";
}
