import { ProjectWorkspace } from "@/components/workspace/project-workspace";
import {
  createApiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type { ProjectListItem } from "@/lib/api-types";

export default async function WorkspaceProjectsPage() {
  const api = createApiClient();
  let projects: ProjectListItem[] = [];
  let initialError: string | undefined;

  try {
    projects = await api.listProjects({ cache: "no-store" });
  } catch (error) {
    initialError = getUserFacingErrorMessage(error);
  }

  return <ProjectWorkspace initialError={initialError} initialProjects={projects} />;
}
