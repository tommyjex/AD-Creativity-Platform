import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AuthApp, AuthProvider } from "@/lib/auth/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AD Creativity",
  description: "Professional AI advertising creation platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <AuthProvider>
          <Suspense fallback={<AuthLoading />}>
            <AuthApp>{children}</AuthApp>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

function AuthLoading() {
  return (
    <main
      aria-label="正在验证登录状态"
      className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground"
    >
      正在验证登录状态...
    </main>
  );
}
