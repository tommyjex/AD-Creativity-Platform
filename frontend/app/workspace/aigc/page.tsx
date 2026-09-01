import { AigcWorkspace } from "@/components/workspace/aigc/aigc-workspace";
import {
  createApiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type {
  AigcPage,
  AigcPipeline,
  AigcPipelineTemplate
} from "@/lib/aigc/types";

const PAGE_SIZE = 20;

function emptyPage<T>(): AigcPage<T> {
  return {
    items: [],
    page: 1,
    page_size: PAGE_SIZE,
    total: 0
  };
}

export default async function AigcWorkspacePage() {
  const api = createApiClient();
  let initialTemplates = emptyPage<AigcPipelineTemplate>();
  let initialPipelines = emptyPage<AigcPipeline>();
  let initialError: string | undefined;

  try {
    [initialTemplates, initialPipelines] = await Promise.all([
      api.listAigcTemplates(
        { page: 1, pageSize: PAGE_SIZE },
        { cache: "no-store" }
      ),
      api.listAigcPipelines(
        { page: 1, pageSize: PAGE_SIZE },
        { cache: "no-store" }
      )
    ]);
  } catch (error) {
    initialError = getUserFacingErrorMessage(error);
  }

  return (
    <AigcWorkspace
      initialError={initialError}
      initialPipelines={initialPipelines}
      initialTemplates={initialTemplates}
    />
  );
}
