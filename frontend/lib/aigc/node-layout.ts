import type {
  AigcNodeType,
  AigcSize,
  AigcV2NodeType
} from "@/lib/aigc/types";

const DEFAULT_NODE_SIZE: AigcSize = { width: 240, height: 160 };
const DEFAULT_LAYER_CANVAS_SIZE: AigcSize = { width: 420, height: 460 };
const DEFAULT_LAYER_COMPOSITE_SIZE: AigcSize = { width: 400, height: 380 };

const MINIMUM_NODE_SIZE: AigcSize = { width: 190, height: 120 };
const MINIMUM_LAYER_CANVAS_SIZE: AigcSize = { width: 380, height: 420 };
const MINIMUM_LAYER_COMPOSITE_SIZE: AigcSize = { width: 360, height: 340 };

type SupportedNodeType = AigcNodeType | AigcV2NodeType;

const LAYER_NODE_TYPES = new Set<SupportedNodeType>([
  "layer_canvas",
  "layer_composite"
]);

export function aigcNodeDefaultSize(type: SupportedNodeType): AigcSize {
  if (type === "layer_canvas") return { ...DEFAULT_LAYER_CANVAS_SIZE };
  if (type === "layer_composite") return { ...DEFAULT_LAYER_COMPOSITE_SIZE };
  return { ...DEFAULT_NODE_SIZE };
}

export function aigcNodeMinimumSize(type: SupportedNodeType): AigcSize {
  if (type === "layer_canvas") return { ...MINIMUM_LAYER_CANVAS_SIZE };
  if (type === "layer_composite") return { ...MINIMUM_LAYER_COMPOSITE_SIZE };
  return { ...MINIMUM_NODE_SIZE };
}

export function normalizeAigcNodeSize(
  type: SupportedNodeType,
  size: AigcSize
): AigcSize {
  const minimum = aigcNodeMinimumSize(type);
  return {
    height: Math.max(size.height, minimum.height),
    width: Math.max(size.width, minimum.width)
  };
}

export function aigcNodeInitialPosition(
  type: SupportedNodeType,
  index: number
): { x: number; y: number } {
  const columnGap = LAYER_NODE_TYPES.has(type) ? 460 : 300;
  const rowGap = LAYER_NODE_TYPES.has(type) ? 500 : 230;
  const columns = LAYER_NODE_TYPES.has(type) ? 3 : 4;
  return {
    x: 80 + (index % columns) * columnGap,
    y: 80 + Math.floor(index / columns) * rowGap
  };
}
