import type { ReactNode } from "react";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";

export default function AigcLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return <AigcQueryProvider>{children}</AigcQueryProvider>;
}
