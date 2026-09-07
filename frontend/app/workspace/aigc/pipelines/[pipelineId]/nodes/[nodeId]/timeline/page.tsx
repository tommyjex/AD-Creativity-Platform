import { AigcTimelineEditorShell } from "@/components/workspace/aigc/aigc-timeline-editor-shell";
import { AigcTimelineLoadError } from "@/components/workspace/aigc/aigc-timeline-load-error";
import { AigcMultitrackAcceptance } from "@/components/workspace/aigc/aigc-multitrack-acceptance";
import { createApiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import { loadAigcTimelineEditorData } from "@/lib/aigc/timeline-loader";

const ACCEPTANCE_ID = "acceptance-multitrack";

export default async function AigcTimelineEditorPage({
  params
}: {
  params: Promise<{ nodeId: string; pipelineId: string }>;
}) {
  const { nodeId, pipelineId } = await params;
  if (
    process.env.NODE_ENV !== "production" &&
    pipelineId === ACCEPTANCE_ID &&
    nodeId === ACCEPTANCE_ID
  ) {
    return <AigcMultitrackAcceptance />;
  }
  const api = createApiClient();
  let data;

  try {
    data = await loadAigcTimelineEditorData(api, pipelineId, nodeId);
  } catch (error) {
    const message =
      error instanceof Error && error.name === "Error"
        ? error.message
        : getUserFacingErrorMessage(error);
    return (
      <AigcTimelineLoadError message={message} pipelineId={pipelineId} />
    );
  }
  return (
    <AigcTimelineEditorShell
      node={data.node}
      pipeline={data.pipeline}
      sources={data.sources}
    />
  );
}
