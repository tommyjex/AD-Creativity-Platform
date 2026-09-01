import { AigcLayerEditor, LayerEditorError } from "@/components/workspace/aigc/aigc-layer-editor";
import { createApiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import { loadAigcLayerEditorData } from "@/lib/aigc/layer-editor-loader";

export default async function AigcLayerEditorPage({
  params
}: {
  params: Promise<{ nodeId: string; pipelineId: string }>;
}) {
  const { nodeId, pipelineId } = await params;
  const api = createApiClient();
  let data;
  let loadError: unknown;

  try {
    data = await loadAigcLayerEditorData(
      api,
      pipelineId,
      nodeId
    );
  } catch (error) {
    loadError = error;
  }
  if (!data) {
    const message =
      loadError instanceof Error && loadError.name === "Error"
        ? loadError.message
        : getUserFacingErrorMessage(loadError);
    return <LayerEditorError message={message} />;
  }
  return (
    <AigcLayerEditor
      layerSet={data.layerSet}
      nodeId={nodeId}
      pipeline={data.pipeline}
      runId={data.runId}
    />
  );
}
