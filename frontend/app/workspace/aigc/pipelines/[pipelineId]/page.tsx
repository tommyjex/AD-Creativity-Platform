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
