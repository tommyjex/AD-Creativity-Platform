import { AIGC_NODE_REGISTRY_BY_TYPE } from "@/lib/aigc/node-registry";
import { seedreamImageTitle } from "@/lib/aigc/seedream-image";
import type { AigcV2Node } from "@/lib/aigc/types";

const MODALITY_NODE_BASE_NAMES = {
  text: "文本节点",
  image: "图片节点",
  video: "视频节点",
  audio: "音频节点"
} as const;

export interface AigcNodeDisplayName {
  readonly baseName: string;
  readonly duplicateCount: number;
  readonly index: number;
  readonly displayName: string;
}

export function aigcNodeBaseDisplayName(node: AigcV2Node): string {
  if (node.type in MODALITY_NODE_BASE_NAMES) {
    return MODALITY_NODE_BASE_NAMES[
      node.type as keyof typeof MODALITY_NODE_BASE_NAMES
    ];
  }
  if (node.type === "image_to_image") {
    return seedreamImageTitle(node);
  }
  return AIGC_NODE_REGISTRY_BY_TYPE.get(node.type)?.label ?? node.type;
}

export function deriveAigcNodeDisplayNames(
  nodes: readonly AigcV2Node[]
): ReadonlyMap<string, AigcNodeDisplayName> {
  const baseNames = nodes.map(aigcNodeBaseDisplayName);
  const counts = new Map<string, number>();
  for (const baseName of baseNames) {
    counts.set(baseName, (counts.get(baseName) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return new Map(
    nodes.map((node, nodeIndex) => {
      const baseName = baseNames[nodeIndex];
      const duplicateCount = counts.get(baseName) ?? 1;
      const index = (seen.get(baseName) ?? 0) + 1;
      seen.set(baseName, index);
      return [
        node.id,
        {
          baseName,
          duplicateCount,
          index,
          displayName:
            duplicateCount === 1 ? baseName : `${baseName}${index}`
        }
      ];
    })
  );
}
