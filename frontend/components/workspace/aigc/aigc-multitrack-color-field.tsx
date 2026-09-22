"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, Pipette } from "lucide-react";
import { useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

import { Input } from "@/components/ui/input";
import {
  alphaHexToPercent,
  normalizeRgbaHex,
  percentToAlphaHex
} from "@/lib/aigc/multitrack-colors";
import { cn } from "@/lib/utils";

export function AigcMultitrackColorField({
  label,
  onCommit,
  onGestureCancel,
  onGestureCommit,
  onGestureStart,
  onPreview,
  value
}: {
  label: string;
  onCommit: (value: string) => void;
  onGestureCancel: () => void;
  onGestureCommit: (value: string) => void;
  onGestureStart: () => void;
  onPreview: (value: string) => void;
  value: string;
}) {
  const normalizedValue = normalizeRgbaHex(value) ?? "#000000FF";
  const [draftState, setDraftState] = useState({
    sourceValue: value,
    value,
    invalid: false
  });
  const draft =
    draftState.sourceValue === value
      ? draftState
      : { sourceValue: value, value, invalid: false };
  const gestureActive = useRef(false);
  const gestureValue = useRef(normalizedValue);
  const skipNextBlur = useRef(false);
  const alphaPercent = alphaHexToPercent(normalizedValue.slice(7, 9));

  function beginGesture() {
    if (gestureActive.current) return;
    gestureActive.current = true;
    gestureValue.current = normalizedValue;
    onGestureStart();
  }

  function preview(nextValue: string) {
    const normalized = normalizeRgbaHex(nextValue);
    if (!normalized) return;
    gestureValue.current = normalized;
    onPreview(normalized);
  }

  function commitGesture() {
    if (!gestureActive.current) return;
    gestureActive.current = false;
    onGestureCommit(gestureValue.current);
  }

  function cancelGesture() {
    if (!gestureActive.current) return;
    gestureActive.current = false;
    onGestureCancel();
  }

  function commitDraft() {
    const normalized = normalizeRgbaHex(draft.value);
    if (!normalized) {
      setDraftState({ ...draft, invalid: true });
      return;
    }
    setDraftState({
      sourceValue: normalized,
      value: normalized,
      invalid: false
    });
    onCommit(normalized);
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <span className="block text-[10px] text-zinc-500">{label}</span>
      <div className="flex min-w-0">
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              aria-label={`选择${label}`}
              className="relative h-8 w-9 shrink-0 overflow-hidden border border-r-0 border-[#343a43] bg-[linear-gradient(45deg,#52525b_25%,transparent_25%),linear-gradient(-45deg,#52525b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#52525b_75%),linear-gradient(-45deg,transparent_75%,#52525b_75%)] bg-[length:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0px] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              title={`选择${label}`}
              type="button"
            >
              <span
                className="absolute inset-0"
                style={{ backgroundColor: rgbaHexToCss(normalizedValue) }}
              />
              <Pipette className="absolute bottom-0.5 right-0.5 h-3 w-3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              aria-label={`${label}选择器`}
              className="z-[70] w-64 border border-[#3c424b] bg-[#1b1f25] p-3 text-zinc-200 shadow-2xl shadow-black/60 outline-none"
              collisionPadding={8}
              onEscapeKeyDown={cancelGesture}
              onKeyDownCapture={(event) => {
                if (isColorAdjustmentKey(event.key)) beginGesture();
              }}
              onKeyUpCapture={(event) => {
                if (isColorAdjustmentKey(event.key)) commitGesture();
              }}
              onPointerCancelCapture={cancelGesture}
              onPointerDownCapture={beginGesture}
              onPointerUpCapture={commitGesture}
              role="dialog"
              sideOffset={6}
            >
              <HexColorPicker
                className="!h-40 !w-full [&_.react-colorful__hue]:!h-2.5 [&_.react-colorful__hue]:!rounded-none [&_.react-colorful__hue-pointer]:!h-4 [&_.react-colorful__hue-pointer]:!w-2.5 [&_.react-colorful__pointer]:!border-2 [&_.react-colorful__pointer]:!shadow-[0_0_0_1px_rgba(0,0,0,0.8)] [&_.react-colorful__saturation]:!mb-3 [&_.react-colorful__saturation]:!rounded-none"
                color={normalizedValue.slice(0, 7)}
                onChange={(color) =>
                  preview(`${color}${normalizedValue.slice(7, 9)}`)
                }
              />
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>透明度</span>
                  <span className="font-mono text-zinc-300">
                    {alphaPercent}%
                  </span>
                </div>
                <input
                  aria-label={`${label}透明度`}
                  className="h-2 w-full cursor-pointer accent-blue-500"
                  max="100"
                  min="0"
                  onChange={(event) =>
                    preview(
                      `${normalizedValue.slice(0, 7)}${percentToAlphaHex(
                        Number(event.target.value)
                      )}`
                    )
                  }
                  type="range"
                  value={alphaPercent}
                />
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500">
                <Check className="h-3 w-3 text-blue-400" />
                松开指针后生成一条撤销记录
              </div>
              <Popover.Arrow className="fill-[#3c424b]" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Input
          aria-invalid={draft.invalid}
          aria-label={`${label} RGBA`}
          className={cn(
            "h-8 min-w-0 rounded-none border-[#343a43] bg-[#101318] px-2 font-mono text-[10px] uppercase shadow-none focus-visible:border-blue-500 focus-visible:ring-0",
            draft.invalid &&
              "border-red-400 focus-visible:border-red-400"
          )}
          maxLength={9}
          onBlur={() => {
            if (skipNextBlur.current) {
              skipNextBlur.current = false;
              return;
            }
            commitDraft();
          }}
          onChange={(event) =>
            setDraftState({
              sourceValue: value,
              value: event.target.value.toUpperCase(),
              invalid: false
            })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              skipNextBlur.current = true;
              commitDraft();
              event.currentTarget.blur();
            }
          }}
          value={draft.value}
        />
      </div>
      {draft.invalid ? (
        <p className="text-[10px] leading-4 text-red-300" role="alert">
          请输入 #RRGGBBAA 格式
        </p>
      ) : null}
    </div>
  );
}

function rgbaHexToCss(value: string) {
  const alpha = Number.parseInt(value.slice(7, 9), 16) / 255;
  return `rgba(${Number.parseInt(value.slice(1, 3), 16)}, ${Number.parseInt(
    value.slice(3, 5),
    16
  )}, ${Number.parseInt(value.slice(5, 7), 16)}, ${alpha})`;
}

function isColorAdjustmentKey(key: string) {
  return (
    key === "ArrowDown" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowUp" ||
    key === "End" ||
    key === "Home" ||
    key === "PageDown" ||
    key === "PageUp"
  );
}
