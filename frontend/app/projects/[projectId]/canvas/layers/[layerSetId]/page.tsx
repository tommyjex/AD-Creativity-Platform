import { notFound } from "next/navigation";
import { LayerEditorPage } from "@/components/workspace/layer-editor-page";
import {
  createApiClient,
  getUserFacingErrorMessage,
  isApiError
} from "@/lib/api-client";
import type { ImageLayerSetDetail } from "@/lib/api-types";

interface ProjectLayerEditorPageProps {
  params: Promise<{
    layerSetId: string;
    projectId: string;
  }>;
}

export default async function ProjectLayerEditorPage({
  params
}: ProjectLayerEditorPageProps) {
  const { layerSetId, projectId } = await params;
  const api = createApiClient();
  let layerSet: ImageLayerSetDetail | undefined;
  let loadError: unknown;

  try {
    layerSet = await api.getImageLayerSet(projectId, layerSetId, {
      cache: "no-store"
    });
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      notFound();
    }

    loadError = error;
  }

  if (!layerSet) {
    return (
      <main className="container min-h-[calc(100vh-4rem)] py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-destructive/30 bg-destructive/10 p-8 shadow-glass">
          <p className="ad-kicker text-destructive">Layer Set Load Failed</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-foreground md:text-5xl">
            图层编辑器暂时无法加载。
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {formatLoadError(loadError)}
          </p>
        </div>
      </main>
    );
  }

  return <LayerEditorPage initialLayerSet={layerSet} projectId={projectId} />;
}

function formatLoadError(error: unknown): string {
  return getUserFacingErrorMessage(error);
}
