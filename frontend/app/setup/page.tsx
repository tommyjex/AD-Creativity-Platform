import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SetupForm } from "@/components/auth/setup-form";

export default function SetupPage() {
  return (
    <AuthPageShell eyebrow="First run" title="初始化工作区">
      <SetupForm />
    </AuthPageShell>
  );
}
