"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  SEEDREAM_COMMON_IMAGE_DIMENSIONS,
  SEEDREAM_IMAGE_ASPECT_RATIOS,
  SEEDREAM_IMAGE_PRESET_SIZES,
  SeedreamImageDimensionError,
  isSeedreamImagePresetSize,
  normalizeSeedreamCustomImageSize
} from "@/lib/aigc/image-dimensions";
import type {
  AigcImageFormat,
  AigcImageSize,
  ImageModelConfig
} from "@/lib/aigc/types";

interface DimensionDraft {
  height: string;
  width: string;
}

interface DimensionDraftOverride extends DimensionDraft {
  size: AigcImageSize;
}

export function AigcImageDimensionsField({
  config,
  nodeId,
  onChange
}: {
  config: ImageModelConfig;
  nodeId: string;
  onChange: (config: ImageModelConfig) => void;
}) {
  const presetMode = isSeedreamImagePresetSize(config.size);
  const [draftOverride, setDraftOverride] =
    useState<DimensionDraftOverride | null>(null);
  const draft =
    draftOverride?.size === config.size
      ? draftOverride
      : draftFromSize(config.size);
  const errors = validateDimensionDraft(draft);

  function selectCustomMode() {
    if (!isSeedreamImagePresetSize(config.size)) return;
    const dimensions =
      SEEDREAM_COMMON_IMAGE_DIMENSIONS[config.size][config.aspect_ratio];
    const next = {
      height: String(dimensions.height),
      width: String(dimensions.width)
    };
    setDraftOverride({ ...next, size: dimensions.size });
    onChange({ ...config, size: dimensions.size });
  }

  function selectPresetMode() {
    if (isSeedreamImagePresetSize(config.size)) return;
    onChange({ ...config, size: "2K" });
  }

  function updateDraft(key: keyof DimensionDraft, value: string) {
    const next = { ...draft, [key]: value };
    const rawSize = `${next.width}x${next.height}`;
    let size = rawSize as AigcImageSize;
    try {
      size = normalizeSeedreamCustomImageSize(rawSize);
    } catch {
      // Invalid intermediate input stays in the draft definition so save/run
      // validation cannot silently fall back to the previous valid size.
    }
    setDraftOverride({ ...next, size });
    onChange({ ...config, size });
  }

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <span className="text-xs font-medium text-muted-foreground">
          尺寸方式
        </span>
        <div
          aria-label="尺寸方式"
          className="mt-1 grid min-w-0 grid-cols-2 rounded-md border border-input bg-muted/40 p-0.5"
          role="group"
        >
          <DimensionModeButton
            active={presetMode}
            label="分辨率档位"
            onClick={selectPresetMode}
          />
          <DimensionModeButton
            active={!presetMode}
            label="自定义像素"
            onClick={selectCustomMode}
          />
        </div>
      </div>

      {presetMode ? (
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <SelectField
            label="画幅"
            onChange={(value) =>
              onChange({
                ...config,
                aspect_ratio: value as ImageModelConfig["aspect_ratio"]
              })
            }
            options={SEEDREAM_IMAGE_ASPECT_RATIOS}
            value={config.aspect_ratio}
          />
          <SelectField
            label="分辨率档位"
            onChange={(value) =>
              onChange({
                ...config,
                size: value as ImageModelConfig["size"]
              })
            }
            options={SEEDREAM_IMAGE_PRESET_SIZES}
            value={config.size}
          />
        </div>
      ) : (
        <div
          className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"
          data-testid="aigc-custom-dimensions-grid"
        >
          <DimensionInput
            error={errors.width}
            id={`${nodeId}-image-width`}
            label="宽度"
            onChange={(value) => updateDraft("width", value)}
            value={draft.width}
          />
          <DimensionInput
            error={errors.height}
            id={`${nodeId}-image-height`}
            label="高度"
            onChange={(value) => updateDraft("height", value)}
            value={draft.height}
          />
          {errors.combined ? (
            <p
              className="min-w-0 text-[10px] leading-4 text-destructive sm:col-span-2"
              role="alert"
            >
              {errors.combined}
            </p>
          ) : null}
        </div>
      )}

      <SelectField
        label="输出格式"
        onChange={(value) =>
          onChange({ ...config, format: value as AigcImageFormat })
        }
        options={[
          { label: "PNG", value: "png" },
          { label: "JPEG", value: "jpeg" }
        ]}
        value={config.format}
      />
    </div>
  );
}

function DimensionModeButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "min-w-0 rounded px-2 py-2 text-[11px] font-semibold transition-colors",
        active
          ? "bg-card text-primary shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function DimensionInput({
  error,
  id,
  label,
  onChange,
  value
}: {
  error: string | null;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const errorId = `${id}-error`;
  return (
    <label
      className="min-w-0 text-xs font-medium text-muted-foreground"
      htmlFor={id}
    >
      {label}
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className="mt-1 h-9 min-w-0 w-full text-xs text-foreground"
        id={id}
        inputMode="numeric"
        min={1}
        onChange={(event) => onChange(event.currentTarget.value)}
        step={1}
        type="number"
        value={value}
      />
      {error ? (
        <span
          className="mt-1 block text-[10px] leading-4 text-destructive"
          id={errorId}
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly (string | { label: string; value: string })[];
  value: string;
}) {
  return (
    <label className="min-w-0 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className="mt-1 h-9 min-w-0 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground"
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { label: option, value: option }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function draftFromSize(size: AigcImageSize): DimensionDraft {
  if (isSeedreamImagePresetSize(size)) {
    return { height: "", width: "" };
  }
  const separator = size.indexOf("x");
  if (separator < 0) return { height: "", width: String(size) };
  return {
    height: size.slice(separator + 1),
    width: size.slice(0, separator)
  };
}

function validateDimensionDraft(draft: DimensionDraft): {
  combined: string | null;
  height: string | null;
  width: string | null;
} {
  const width = validateDimensionValue(draft.width, "宽度");
  const height = validateDimensionValue(draft.height, "高度");
  if (width || height) return { combined: null, height, width };

  try {
    normalizeSeedreamCustomImageSize(`${draft.width}x${draft.height}`);
    return { combined: null, height: null, width: null };
  } catch (error) {
    if (error instanceof SeedreamImageDimensionError) {
      if (error.code === "pixel_count_out_of_range") {
        return {
          combined: "总像素必须在 921,600–4,624,220 之间",
          height: null,
          width: null
        };
      }
      if (error.code === "aspect_ratio_out_of_range") {
        return {
          combined: "宽高比必须在 1:16–16:1 之间",
          height: null,
          width: null
        };
      }
    }
    return {
      combined: "图片尺寸格式必须为 WIDTHxHEIGHT",
      height: null,
      width: null
    };
  }
}

function validateDimensionValue(value: string, label: string): string | null {
  if (value === "") return `请输入${label}`;
  if (!/^[0-9]+$/.test(value) || BigInt(value) === BigInt(0)) {
    return `${label}必须为正整数`;
  }
  return null;
}
