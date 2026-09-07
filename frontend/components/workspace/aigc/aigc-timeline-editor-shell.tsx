"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AigcMultitrackEditor,
  type AigcMultitrackSaveResult
} from "@/components/workspace/aigc/aigc-multitrack-editor";
import {
  apiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type { AigcTimelineSource } from "@/lib/aigc/multitrack-editor-store";
import {
  executeAigcTimelineDraft,
  saveAigcTimelineDraft
} from "@/lib/aigc/timeline-actions";
import { timelineSources } from "@/lib/aigc/timeline-loader";
import type {
  AigcPipeline,
  AigcV2Node,
  MultiTrackEditConfig
} from "@/lib/aigc/types";

type MultiTrackEditNode = Extract<
  AigcV2Node,
  { type: "multi_track_edit" }
>;

export function AigcTimelineEditorShell({
  node,
  pipeline,
  sources: loadedSources
}: {
  node: MultiTrackEditNode;
  pipeline: AigcPipeline;
  sources?: AigcTimelineSource[];
}) {
  const router = useRouter();
  const [currentPipeline, setCurrentPipeline] = useState(pipeline);
  const pipelineRoute =
    `/workspace/aigc/pipelines/${pipeline.id}` as Route;
  const sources = loadedSources ?? timelineSources(pipeline, node.id);

  async function save(
    config: MultiTrackEditConfig
  ): Promise<AigcMultitrackSaveResult> {
    try {
      const saved = await saveAigcTimelineDraft(
        apiClient,
        currentPipeline,
        node.id,
        config
      );
      setCurrentPipeline(saved);
      return { config, revision: saved.revision };
    } catch (error) {
      throw userFacingError(error);
    }
  }

  async function execute(config: MultiTrackEditConfig) {
    try {
      const result = await executeAigcTimelineDraft(
        apiClient,
        currentPipeline,
        node.id,
        config
      );
      setCurrentPipeline(result.pipeline);
      router.push(pipelineRoute);
    } catch (error) {
      throw userFacingError(error);
    }
  }

  return (
    <AigcMultitrackEditor
      config={node.config}
      onBack={() => router.push(pipelineRoute)}
      onExecute={execute}
      onReload={() => router.refresh()}
      onSave={save}
      onUploadSubtitle={async (file) => {
        const asset = await apiClient.uploadAigcSubtitle(file, {
          filename: file.name,
          mimeType: file.type || "application/x-subrip"
        });
        return asset.id;
      }}
      revision={currentPipeline.revision}
      sources={sources}
      title={pipeline.name}
    />
  );
}

function userFacingError(error: unknown) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : null;
  const wrapped = new Error(
    status === 409
      ? "保存冲突：Pipeline 已被其他页面更新，本地草稿未覆盖远端。"
      : getUserFacingErrorMessage(error)
  );
  if (
    status !== null
  ) {
    Object.assign(wrapped, { status });
  }
  return wrapped;
}
