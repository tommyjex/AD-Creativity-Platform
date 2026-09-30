import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import {
  getUserFacingErrorMessage
} from "@/lib/api-client";
import { createServerApiClient } from "@/lib/auth/server-api-client";
import type { ProjectListItem } from "@/lib/api-types";

export default async function WorkspaceProjectsPage() {
  const api = await createServerApiClient();
  let projects: ProjectListItem[] = [];
  let initialError: string | undefined;

  try {
    projects = await api.listProjects({ cache: "no-store" });
  } catch (error) {
    initialError = getUserFacingErrorMessage(error);
  }

  return <ProjectWorkspace initialError={initialError} initialProjects={projects} />;
}
