import { redirect } from "next/navigation";

import { AigcEditor } from "@/components/workspace/aigc/aigc-editor";
import { getUserFacingErrorMessage, isApiError } from "@/lib/api-client";
import { createServerApiClient } from "@/lib/auth/server-api-client";

export default async function AigcPipelineEditorPage({
  params
}: {
  params: Promise<{ pipelineId: string }>;
}) {
  const { pipelineId } = await params;
  // #region debug-point A,D:route-entry
  void fetch("http://127.0.0.1:7777/event", { method: "POST", body: JSON.stringify({ sessionId: "new-db-stale-pipeline", runId: "post-fix", hypothesisId: "A,D", location: "pipelines/[pipelineId]/page.tsx:route-entry", msg: "[DEBUG] Pipeline route requested", data: { pipelineId } }) }).catch(() => {});
  // #endregion
  const api = await createServerApiClient();
  let pipeline;

  try {
    pipeline = await api.getAigcPipeline(pipelineId, {
      cache: "no-store"
    });
    // #region debug-point A,C:load-success
    void fetch("http://127.0.0.1:7777/event", { method: "POST", body: JSON.stringify({ sessionId: "new-db-stale-pipeline", runId: "post-fix", hypothesisId: "A,C", location: "pipelines/[pipelineId]/page.tsx:load-success", msg: "[DEBUG] Pipeline loaded", data: { pipelineId, loadedPipelineId: pipeline.id } }) }).catch(() => {});
    // #endregion
  } catch (error) {
    // #region debug-point A,B,D:load-error
    void fetch("http://127.0.0.1:7777/event", { method: "POST", body: JSON.stringify({ sessionId: "new-db-stale-pipeline", runId: "post-fix", hypothesisId: "A,B,D", location: "pipelines/[pipelineId]/page.tsx:load-error", msg: "[DEBUG] Pipeline load failed", data: { pipelineId, isApiError: isApiError(error), status: isApiError(error) ? error.status : null, code: isApiError(error) ? error.code : null } }) }).catch(() => {});
    // #endregion
    if (isApiError(error) && error.status === 404) {
      redirect("/workspace/aigc?view=pipelines");
    }
    return (
      <main className="grid h-[100dvh] place-items-center px-6">
        <p className="text-sm text-destructive">
          {getUserFacingErrorMessage(error)}
        </p>
      </main>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden [&>main]:!h-full">
      <AigcEditor entity={pipeline} mode="pipeline" />
    </div>
  );
}
