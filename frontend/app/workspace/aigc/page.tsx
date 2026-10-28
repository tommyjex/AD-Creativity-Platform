import { AigcWorkspace } from "@/components/workspace/aigc/aigc-workspace";
import {
  getUserFacingErrorMessage
} from "@/lib/api-client";
import { createServerApiClient } from "@/lib/auth/server-api-client";
import type {
  AigcPage,
  AigcPipeline,
  AigcPipelineTemplate
} from "@/lib/aigc/types";
import { parseAigcView } from "@/lib/aigc/workspace-view";

const PAGE_SIZE = 20;

function emptyPage<T>(): AigcPage<T> {
  return {
    items: [],
    page: 1,
    page_size: PAGE_SIZE,
    total: 0
  };
}

export default async function AigcWorkspacePage({
  searchParams
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { view } = await searchParams;
  const api = await createServerApiClient();
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
      initialView={parseAigcView(view)}
    />
  );
}
