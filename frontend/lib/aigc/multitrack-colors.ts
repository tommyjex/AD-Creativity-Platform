const RGBA_HEX_PATTERN = /^#[0-9A-F]{8}$/i;

export function isRgbaHex(value: string): boolean {
  return RGBA_HEX_PATTERN.test(value);
}

export function normalizeRgbaHex(value: string): string | null {
  return isRgbaHex(value) ? value.toUpperCase() : null;
}

export function alphaHexToPercent(value: string): number {
  const alpha = Number.parseInt(value, 16);
  return Number.isFinite(alpha) ? Math.round((alpha / 255) * 100) : 100;
}

export function percentToAlphaHex(value: number): string {
  const percent = Math.min(100, Math.max(0, value));
  return Math.round((percent / 100) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}
