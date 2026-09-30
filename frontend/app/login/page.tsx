import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthPageShell eyebrow="Authentication" title="登录创意工作区">
      <LoginForm />
    </AuthPageShell>
  );
}
