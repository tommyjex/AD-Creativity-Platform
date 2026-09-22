export const MEDIAKIT_FONT_PRESETS = [
  { id: "1187225", label: "站酷意大利体", supportsChinese: false },
  { id: "1187223", label: "站酷仓耳渔阳体", supportsChinese: true },
  { id: "1187221", label: "站酷高端黑", supportsChinese: true },
  { id: "1187219", label: "站酷酷黑体", supportsChinese: true },
  { id: "1187217", label: "站酷快乐体", supportsChinese: true },
  { id: "1187213", label: "站酷文艺体", supportsChinese: true },
  { id: "1187211", label: "站酷小薇 LOGO 体", supportsChinese: true },
  { id: "SY_Black", label: "思源黑体", supportsChinese: true },
  { id: "ALi_PuHui", label: "阿里巴巴普惠体", supportsChinese: true },
  { id: "PM_ZhengDao", label: "庞门正道标题体", supportsChinese: true }
] as const;

export type MediaKitFontPresetId =
  (typeof MEDIAKIT_FONT_PRESETS)[number]["id"];

const MEDIAKIT_FONT_PRESET_IDS = new Set<string>(
  MEDIAKIT_FONT_PRESETS.map((preset) => preset.id)
);
const FONT_FILE_PATH_PATTERN = /\.(?:ttf|otf)$/i;
const ASCII_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const IPV4_HOST_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const NUMERIC_HOST_LABEL_PATTERN = /^(?:\d+|0x[0-9a-f]+)$/i;
const LOCAL_HOST_SUFFIXES = [".local", ".internal", ".lan", ".home"] as const;
export const MULTITRACK_FONT_TYPE_MAX_LENGTH = 2048;

function isNumericHostname(hostname: string): boolean {
  const labels = hostname.replace(/\.$/, "").split(".");
  return (
    labels.length > 0 &&
    labels.every((label) => NUMERIC_HOST_LABEL_PATTERN.test(label))
  );
}

export function isMediaKitFontPreset(
  value: string
): value is MediaKitFontPresetId {
  return MEDIAKIT_FONT_PRESET_IDS.has(value);
}

export function isCustomFontUrl(value: string): boolean {
  if (
    value.length > MULTITRACK_FONT_TYPE_MAX_LENGTH ||
    value !== value.trim() ||
    value.includes("\\") ||
    ASCII_CONTROL_PATTERN.test(value) ||
    !/^https:\/\//i.test(value)
  ) {
    return false;
  }
  try {
    const url = new URL(value);
    const authority = value.slice(value.indexOf("//") + 2).split(/[/?#]/, 1)[0];
    const rawHostname = (
      authority.startsWith("[")
        ? authority.slice(1, authority.indexOf("]"))
        : authority.split(":", 1)[0]
    ).toLowerCase();
    const hostname = url.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "");
    const isIpLiteral =
      hostname.includes(":") || IPV4_HOST_PATTERN.test(hostname);
    const isLocalHostname =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      LOCAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    return (
      url.protocol === "https:" &&
      Boolean(authority) &&
      Boolean(hostname) &&
      !isIpLiteral &&
      !isNumericHostname(rawHostname) &&
      !isLocalHostname &&
      !authority.includes("@") &&
      url.username === "" &&
      url.password === "" &&
      FONT_FILE_PATH_PATTERN.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function fontTypeIssue(
  value: string | null
): "invalid_font_type" | null {
  if (
    value === null ||
    isMediaKitFontPreset(value) ||
    isCustomFontUrl(value)
  ) {
    return null;
  }
  return "invalid_font_type";
}
