import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function ChangePasswordPage() {
  return (
    <AuthPageShell eyebrow="Security update" title="设置新的登录密码">
      <ChangePasswordForm />
    </AuthPageShell>
  );
}
