import { cookies } from "next/headers";
import { createApiClient } from "@/lib/api-client";

export async function createServerApiClient() {
  const cookieHeader = (await cookies()).toString();
  return createApiClient({
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined
  });
}
