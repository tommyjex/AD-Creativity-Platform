import type { AuthUser, UserRole } from "@/lib/api-types";

type PermissionSubject =
  | UserRole
  | Pick<AuthUser, "role">
  | null
  | undefined;

let clientPermissionSubject: PermissionSubject = null;

function getRole(subject: PermissionSubject): UserRole | null {
  if (!subject) {
    return null;
  }
  return typeof subject === "string" ? subject : subject.role;
}

export function canView(subject: PermissionSubject): boolean {
  return getRole(subject) !== null;
}

export const canDownload = canView;

export function canCreate(subject: PermissionSubject): boolean {
  return ["admin", "creator"].includes(getRole(subject) ?? "");
}

export const canEdit = canCreate;
export const canDelete = canCreate;
export const canRun = canCreate;

export function canManageUsers(subject: PermissionSubject): boolean {
  return getRole(subject) === "admin";
}

export function setClientPermissionSubject(
  subject: PermissionSubject
): void {
  clientPermissionSubject = subject;
}

export function canClientMutate(): boolean {
  return (
    clientPermissionSubject === null ||
    clientPermissionSubject === undefined ||
    canCreate(clientPermissionSubject)
  );
}
