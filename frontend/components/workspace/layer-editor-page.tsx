"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LayerEditorDialog } from "@/components/workspace/layer-editor-dialog";
import type { ImageLayerSetDetail } from "@/lib/api-types";

export function LayerEditorPage({
  initialLayerSet,
  projectId
}: {
  initialLayerSet: ImageLayerSetDetail;
  projectId: string;
}) {
  const router = useRouter();
  const [layerSet, setLayerSet] = useState<ImageLayerSetDetail>(initialLayerSet);

  return (
    <LayerEditorDialog
      initialLayerSet={layerSet}
      key={`${layerSet.id}:${layerSet.revision}`}
      onLayerSetChange={(updated) => setLayerSet(updated)}
      onOpenChange={(open) => {
        if (!open) router.push(`/projects/${projectId}/canvas`);
      }}
      open
    />
  );
}
