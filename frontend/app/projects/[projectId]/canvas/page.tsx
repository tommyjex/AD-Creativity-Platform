import { notFound } from "next/navigation";
import { ImageCanvasPage } from "@/components/workspace/image-canvas-page";
import {
  createApiClient,
  getUserFacingErrorMessage,
  isApiError
} from "@/lib/api-client";
import type { CanvasLayout, Project } from "@/lib/api-types";

interface ProjectCanvasPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectCanvasPage({
  params
}: ProjectCanvasPageProps) {
  const { projectId } = await params;
  const api = createApiClient();
  let project: Project | undefined;
  let loadError: unknown;

  const [projectResult, layoutResult] = await Promise.allSettled([
    api.getProject(projectId, { cache: "no-store" }),
    api.getCanvasLayout(projectId, { cache: "no-store" })
  ]);

  if (projectResult.status === "fulfilled") {
    project = projectResult.value;
  } else {
    const error = projectResult.reason;
    if (isApiError(error) && error.status === 404) {
      notFound();
    }

    loadError = error;
  }

  if (!project) {
    return (
      <main className="container min-h-[calc(100vh-4rem)] py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-destructive/30 bg-destructive/10 p-8 shadow-glass">
          <p className="ad-kicker text-destructive">Canvas Load Failed</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground md:text-5xl">
            画布暂时无法加载。
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {formatLoadError(loadError)}
          </p>
        </div>
      </main>
    );
  }

  const initialLayout: CanvasLayout =
    layoutResult.status === "fulfilled"
      ? layoutResult.value
      : {
          nodes: [],
          project_id: projectId,
          revision: 0,
          updated_at: new Date().toISOString()
        };

  return (
    <ImageCanvasPage initialLayout={initialLayout} initialProject={project} />
  );
}

function formatLoadError(error: unknown): string {
  return getUserFacingErrorMessage(error);
}
