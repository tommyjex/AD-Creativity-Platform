"use client";

import { useEffect, useState } from "react";

import {
  isCustomFontUrl,
  isMediaKitFontPreset
} from "@/lib/aigc/multitrack-fonts";

export type PreviewFontState =
  | { status: "default"; family: null }
  | { status: "preset"; family: null }
  | { status: "loading"; family: null }
  | { status: "loaded"; family: string }
  | { status: "failed"; family: null };

type LoadedFontResult =
  | { status: "loaded"; family: string }
  | { status: "failed"; family: null };

interface FontResolution {
  result: LoadedFontResult;
  url: string;
}

const fontLoads = new Map<string, Promise<string>>();

export function useMultitrackPreviewFont(
  fontType: string | null
): PreviewFontState {
  const [resolution, setResolution] = useState<FontResolution | null>(null);
  const customUrl = fontType !== null && isCustomFontUrl(fontType)
    ? fontType
    : null;

  useEffect(() => {
    if (customUrl === null) return;
    let active = true;

    loadPreviewFont(customUrl).then(
      (family) => {
        if (active) {
          setResolution({
            result: { status: "loaded", family },
            url: customUrl
          });
        }
      },
      () => {
        if (active) {
          setResolution({
            result: { status: "failed", family: null },
            url: customUrl
          });
        }
      }
    );

    return () => {
      active = false;
    };
  }, [customUrl]);

  if (fontType === null) {
    return { status: "default", family: null };
  }
  if (isMediaKitFontPreset(fontType)) {
    return { status: "preset", family: null };
  }
  if (customUrl === null) {
    return { status: "default", family: null };
  }
  if (resolution?.url === customUrl) {
    return resolution.result;
  }
  return { status: "loading", family: null };
}

function loadPreviewFont(url: string): Promise<string> {
  const cached = fontLoads.get(url);
  if (cached) return cached;

  const family = previewFontFamily(url);
  const load = Promise.resolve().then(async () => {
    if (
      typeof FontFace === "undefined" ||
      typeof document === "undefined" ||
      !document.fonts
    ) {
      throw new Error("Browser font loading is unavailable");
    }
    const face = new FontFace(family, `url(${JSON.stringify(url)})`);
    const loadedFace = await face.load();
    document.fonts.add(loadedFace);
    return family;
  });
  fontLoads.set(url, load);
  return load;
}

function previewFontFamily(url: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < url.length; index += 1) {
    const code = url.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `aigc-custom-font-${unsignedHex(first)}${unsignedHex(second)}`;
}

function unsignedHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}
