import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
