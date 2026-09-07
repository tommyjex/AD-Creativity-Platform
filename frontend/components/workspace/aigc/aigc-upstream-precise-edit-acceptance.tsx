"use client";

import { useState } from "react";

import { AigcPreciseEditDialog } from "@/components/workspace/aigc/aigc-precise-edit-dialog";
import { AigcEditorStoreProvider } from "@/components/workspace/aigc/providers/aigc-editor-store-provider";
import { createAigcEditorStore } from "@/lib/aigc/editor-store";
import type { AigcPipelineDefinitionV2 } from "@/lib/aigc/types";

const ASSET_ID = "acceptance-upstream-image";
const IMAGE_URL =
  "https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=Professional%20studio%20product%20photograph%20of%20a%20minimal%20white%20wireless%20speaker%20on%20a%20neutral%20gray%20surface%2C%20front%20three-quarter%20view%2C%20softbox%20lighting%2C%20sharp%20details%2C%20clean%20commercial%20composition&image_size=landscape_4_3";

const imageNode = {
  id: "acceptance-image",
  type: "image",
  position: { x: 0, y: 0 },
  size: { width: 240, height: 180 },
  config: {
    asset_id: "local-backup",
    bbox: null,
    bbox_asset_id: null,
    title: "上游商品图",
    upstream_bbox: {
      type: "bbox",
      x1: 160,
      y1: 180,
      x2: 820,
      y2: 860
    },
    upstream_bbox_asset_id: ASSET_ID
  }
} as const;

const definition: AigcPipelineDefinitionV2 = {
  schemaVersion: 2,
  nodes: [
    {
      id: "acceptance-producer",
      type: "text_to_image",
      position: { x: -320, y: 0 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "4:3",
        size: "2K",
        format: "png"
      }
    },
    imageNode,
    {
      id: "acceptance-prompt",
      type: "text",
      position: { x: 0, y: 240 },
      size: { width: 240, height: 180 },
      config: {
        text: "保留商品主体，调整包装细节",
        bbox_references: [
          {
            source_node_id: imageNode.id,
            instruction: "保持主体位置"
          }
        ],
        title: null,
        upstream_text_override: null
      }
    },
    {
      id: "acceptance-model",
      type: "image_to_image",
      position: { x: 320, y: 120 },
      size: { width: 240, height: 180 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        operation: "image_to_image",
        aspect_ratio: "4:3",
        size: "2K",
        format: "png"
      }
    }
  ],
  edges: [
    {
      id: "producer-image",
      sourceNodeId: "acceptance-producer",
      sourceHandle: "image",
      targetNodeId: imageNode.id,
      targetHandle: "image"
    },
    {
      id: "image-model",
      sourceNodeId: imageNode.id,
      sourceHandle: "image",
      targetNodeId: "acceptance-model",
      targetHandle: "image"
    },
    {
      id: "prompt-model",
      sourceNodeId: "acceptance-prompt",
      sourceHandle: "text",
      targetNodeId: "acceptance-model",
      targetHandle: "prompt"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};

export function AigcUpstreamPreciseEditAcceptance() {
  const [store] = useState(() =>
    createAigcEditorStore({
      definition,
      description: "",
      entityId: "acceptance-upstream-precise-edit",
      mode: "pipeline",
      name: "上游图片精准编辑验收",
      revision: 1
    })
  );

  return (
    <AigcEditorStoreProvider store={store}>
      <main
        className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-slate-950 p-4"
        data-testid="upstream-precise-edit-acceptance"
      >
        <AigcPreciseEditDialog
          assetId={ASSET_ID}
          assetName="上游商品图.png"
          bboxState="valid"
          node={imageNode}
          sourceMode="upstream"
          url={IMAGE_URL}
        />
      </main>
    </AigcEditorStoreProvider>
  );
}
