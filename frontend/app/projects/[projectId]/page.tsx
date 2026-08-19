import { notFound } from "next/navigation";
import { ProjectWorkflow } from "@/components/project-workflow";
import {
  createApiClient,
  getUserFacingErrorMessage,
  isApiError
} from "@/lib/api-client";
import type { Asset, Project } from "@/lib/api-types";

interface ProjectDetailPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectDetailPage({
  params
}: ProjectDetailPageProps) {
  const { projectId } = await params;
  const api = createApiClient();
  let result: [Project, Asset[]] | undefined;
  let loadError: unknown;

  try {
    // Cache the initial navigation render for 30s to speed up first paint.
    // In-page freshness still comes from client-side polling / refresh in
    // ProjectWorkflow, which bypasses this server cache.
    result = await Promise.all([
      api.getProject(projectId, { next: { revalidate: 30 } }),
      api.listProjectAssets(projectId, { next: { revalidate: 30 } })
    ]);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      notFound();
    }

    loadError = error;
  }

  if (!result) {
    return (
      <main className="container min-h-[calc(100vh-4rem)] py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-destructive/30 bg-destructive/10 p-8 shadow-glass">
          <p className="ad-kicker text-destructive">Project Load Failed</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground md:text-5xl">
            项目详情暂时无法加载。
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {formatLoadError(loadError)}
          </p>
        </div>
      </main>
    );
  }

  const [project, assets] = result;
  return <ProjectWorkflow initialAssets={assets} initialProject={project} />;
}

function formatLoadError(error: unknown): string {
  return getUserFacingErrorMessage(error);
}
