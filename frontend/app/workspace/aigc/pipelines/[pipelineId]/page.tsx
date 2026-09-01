import { AigcEditor } from "@/components/workspace/aigc/aigc-editor";
import { createApiClient, getUserFacingErrorMessage } from "@/lib/api-client";

export default async function AigcPipelineEditorPage({
  params
}: {
  params: Promise<{ pipelineId: string }>;
}) {
  const { pipelineId } = await params;
  const api = createApiClient();
  let pipeline;

  try {
    pipeline = await api.getAigcPipeline(pipelineId, {
      cache: "no-store"
    });
  } catch (error) {
    return (
      <main className="grid h-[calc(100dvh-4rem)] place-items-center px-6">
        <p className="text-sm text-destructive">
          {getUserFacingErrorMessage(error)}
        </p>
      </main>
    );
  }

  return <AigcEditor entity={pipeline} mode="pipeline" />;
}
