import type { ReactNode } from "react";

export default function WorkspaceLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background/70">
      <main>{children}</main>
    </div>
  );
}
