import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getAigcModalityColors } from "@/lib/aigc/modality-colors";
import type { AigcPortType } from "@/lib/aigc/types";

const globalsCss = readFileSync(
  resolve(process.cwd(), "app/globals.css"),
  "utf8"
);

const approvedTokens = {
  text: {
    portType: "text",
    main: "#2563eb",
    light: "#eff6ff"
  },
  image: {
    portType: "image_asset",
    main: "#16a34a",
    light: "#f0fdf4"
  },
  video: {
    portType: "video_asset",
    main: "#ea580c",
    light: "#fff7ed"
  },
  audio: {
    portType: "audio_asset",
    main: "#db2777",
    light: "#fdf2f8"
  }
} as const;

function cssToken(name: string): string {
  const match = globalsCss.match(
    new RegExp(`--${name}:\\s*([^;]+);`)
  );

  if (!match) {
    throw new Error(`Missing CSS token --${name}`);
  }

  return match[1].trim();
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`);
  }

  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(
    relativeLuminance(first),
    relativeLuminance(second)
  );
  const darker = Math.min(
    relativeLuminance(first),
    relativeLuminance(second)
  );

  return (lighter + 0.05) / (darker + 0.05);
}

describe("AIGC modality colors", () => {
  it("maps every port type to the semantic styles needed by the canvas", () => {
    for (const [token, definition] of Object.entries(approvedTokens)) {
      const mainColor = `var(--aigc-modality-${token})`;

      expect(getAigcModalityColors(definition.portType)).toEqual({
        handleColor: mainColor,
        edgeColor: mainColor,
        cardBorderColor: `var(--aigc-modality-${token}-border)`,
        cardHeaderBackgroundColor: `var(--aigc-modality-${token}-light)`,
        iconColor: mainColor
      });
      expect(
        getAigcModalityColors(definition.portType)
      ).toBe(getAigcModalityColors(definition.portType));
    }
  });

  it("falls back to neutral semantic colors for an unknown port type", () => {
    const neutralColors = {
      handleColor: "hsl(var(--border))",
      edgeColor: "hsl(var(--border))",
      cardBorderColor: "hsl(var(--border))",
      cardHeaderBackgroundColor: "hsl(var(--muted))",
      iconColor: "hsl(var(--muted-foreground))"
    };

    expect(
      getAigcModalityColors("unknown_asset" as AigcPortType)
    ).toEqual(neutralColors);
    expect(
      getAigcModalityColors("constructor" as AigcPortType)
    ).toEqual(neutralColors);
  });

  it("defines the approved tokens with at least 3:1 graphic contrast", () => {
    for (const [token, definition] of Object.entries(approvedTokens)) {
      expect(cssToken(`aigc-modality-${token}`)).toBe(definition.main);
      expect(cssToken(`aigc-modality-${token}-light`)).toBe(
        definition.light
      );
      expect(cssToken(`aigc-modality-${token}-border`)).toBe(
        `var(--aigc-modality-${token})`
      );
      expect(contrastRatio(definition.main, "#ffffff")).toBeGreaterThanOrEqual(
        3
      );
      expect(
        contrastRatio(definition.main, definition.light)
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
