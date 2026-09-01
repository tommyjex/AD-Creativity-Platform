export const MIN_LAYER_SCALE = 0.05;
export const MAX_LAYER_SCALE = 20;

export interface EditableLayerGeometry {
  bbox_absolute: readonly [number, number, number, number];
  id: string;
  scale: number;
  visible: boolean;
  x: number;
  y: number;
  z_index: number;
}

export interface LayerFrame {
  heightPercent: number;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
}

export function getLayerFrame(
  layer: EditableLayerGeometry,
  canvasWidth: number,
  canvasHeight: number
): LayerFrame {
  const [x1, y1, x2, y2] = layer.bbox_absolute;
  return {
    heightPercent: ((y2 - y1) * layer.scale * 100) / canvasHeight,
    leftPercent: (layer.x * 100) / canvasWidth,
    topPercent: (layer.y * 100) / canvasHeight,
    widthPercent: ((x2 - x1) * layer.scale * 100) / canvasWidth
  };
}

export function positionFromDrag(
  start: Pick<EditableLayerGeometry, "x" | "y">,
  deltaX: number,
  deltaY: number,
  renderedWidth: number,
  renderedHeight: number,
  canvasWidth: number,
  canvasHeight: number
) {
  if (renderedWidth <= 0 || renderedHeight <= 0) return start;
  return {
    x: roundCoordinate(start.x + (deltaX / renderedWidth) * canvasWidth),
    y: roundCoordinate(start.y + (deltaY / renderedHeight) * canvasHeight)
  };
}

export function clampLayerScale(value: number) {
  if (!Number.isFinite(value)) return MIN_LAYER_SCALE;
  return Math.min(MAX_LAYER_SCALE, Math.max(MIN_LAYER_SCALE, value));
}

export function scaleFromResize(
  start: {
    layerHeight: number;
    layerWidth: number;
    scale: number;
  },
  deltaX: number,
  deltaY: number,
  renderedWidth: number,
  renderedHeight: number,
  canvasWidth: number,
  canvasHeight: number
) {
  if (
    renderedWidth <= 0 ||
    renderedHeight <= 0 ||
    canvasWidth <= 0 ||
    canvasHeight <= 0
  ) {
    return start.scale;
  }
  const baseWidth = (start.layerWidth / canvasWidth) * renderedWidth;
  const baseHeight = (start.layerHeight / canvasHeight) * renderedHeight;
  const diagonalSquared = baseWidth ** 2 + baseHeight ** 2;
  if (diagonalSquared <= 0) return start.scale;
  const projectedScaleDelta =
    (deltaX * baseWidth + deltaY * baseHeight) / diagonalSquared;
  return clampLayerScale(start.scale + projectedScaleDelta);
}

export function moveLayer<T extends EditableLayerGeometry>(
  layers: readonly T[],
  layerId: string,
  direction: "down" | "up"
): T[] {
  const ordered = layers.toSorted((a, b) => a.z_index - b.z_index);
  const index = ordered.findIndex((layer) => layer.id === layerId);
  const targetIndex = direction === "up" ? index + 1 : index - 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
    return [...layers];
  }
  const current = ordered[index];
  const target = ordered[targetIndex];
  return ordered
    .map((layer) => {
      if (layer.id === current.id) {
        return { ...layer, z_index: target.z_index };
      }
      if (layer.id === target.id) {
        return { ...layer, z_index: current.z_index };
      }
      return layer;
    })
    .toSorted((a, b) => a.z_index - b.z_index);
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}
