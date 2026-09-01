import { ToolsWorkspace } from "@/components/workspace/tools-workspace";
import {
  createApiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type { Asset, ToolTask } from "@/lib/api-types";

export default async function WorkspaceToolsPage() {
  const api = createApiClient();
  let initialAssets: Asset[] = [];
  let initialTasks: ToolTask[] = [];
  let initialError: string | undefined;

  try {
    [initialAssets, initialTasks] = await Promise.all([
      api.listToolAssets({ cache: "no-store" }),
      api.listToolTasks({ cache: "no-store" })
    ]);
  } catch (error) {
    initialError = getUserFacingErrorMessage(error);
  }

  return (
    <ToolsWorkspace
      initialAssets={initialAssets}
      initialError={initialError}
      initialTasks={initialTasks}
    />
  );
}
