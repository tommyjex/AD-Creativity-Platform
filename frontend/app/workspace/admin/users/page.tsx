"use client";

import { UserManagement } from "@/components/admin/user-management";
import { useAuth } from "@/lib/auth/auth-provider";

export default function AdminUsersPage() {
  const { user } = useAuth();

  return <UserManagement currentUser={user} />;
}
