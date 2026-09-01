import type { AigcPortType } from "@/lib/aigc/types";

export interface AigcModalityColors {
  handleColor: string;
  edgeColor: string;
  cardBorderColor: string;
  cardHeaderBackgroundColor: string;
  iconColor: string;
}

function modalityColors(token: string): AigcModalityColors {
  const mainColor = `var(--aigc-modality-${token})`;

  return Object.freeze({
    handleColor: mainColor,
    edgeColor: mainColor,
    cardBorderColor: `var(--aigc-modality-${token}-border)`,
    cardHeaderBackgroundColor: `var(--aigc-modality-${token}-light)`,
    iconColor: mainColor
  });
}

const AIGC_MODALITY_COLORS = {
  text: modalityColors("text"),
  image_asset: modalityColors("image"),
  video_asset: modalityColors("video"),
  audio_asset: modalityColors("audio"),
  layer_set: modalityColors("image"),
  image_layer: modalityColors("image"),
  edited_layer: modalityColors("image")
} satisfies Record<AigcPortType, AigcModalityColors>;

const AIGC_NEUTRAL_MODALITY_COLORS = Object.freeze({
  handleColor: "hsl(var(--border))",
  edgeColor: "hsl(var(--border))",
  cardBorderColor: "hsl(var(--border))",
  cardHeaderBackgroundColor: "hsl(var(--muted))",
  iconColor: "hsl(var(--muted-foreground))"
}) satisfies AigcModalityColors;

export function getAigcModalityColors(
  portType: AigcPortType | null | undefined
): AigcModalityColors {
  if (
    portType &&
    Object.prototype.hasOwnProperty.call(AIGC_MODALITY_COLORS, portType)
  ) {
    return AIGC_MODALITY_COLORS[portType];
  }

  return AIGC_NEUTRAL_MODALITY_COLORS;
}
