"use client";

import { Bold, Italic, Underline } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AigcMultitrackColorField } from "./aigc-multitrack-color-field";
import {
  fontTypeIssue,
  isMediaKitFontPreset,
  MEDIAKIT_FONT_PRESETS
} from "@/lib/aigc/multitrack-fonts";
import { useMultitrackPreviewFont } from "@/lib/aigc/multitrack-font-preview";
import { resolveMultitrackTextPreview } from "@/lib/aigc/multitrack-text-preview";
import type {
  AigcMultitrackEditorAction,
  AigcTimelineSource
} from "@/lib/aigc/multitrack-editor-store";
import type { MultiTrackValidationIssue } from "@/lib/aigc/multitrack";
import type {
  MultiTrackEditConfig,
  MultiTrackElement,
  MultiTrackFrameRate,
  MultiTrackTextElement,
  MultiTrackTrack
} from "@/lib/aigc/types";
import { cn } from "@/lib/utils";
import { TimelineDeleteAction } from "./aigc-multitrack-timeline";

export function AigcMultitrackInspector({
  config,
  dispatch,
  issues,
  selectedElement,
  selectedTrack,
  sources
}: {
  config: MultiTrackEditConfig;
  dispatch: (action: AigcMultitrackEditorAction) => void;
  issues: MultiTrackValidationIssue[];
  selectedElement: MultiTrackElement | null;
  selectedTrack: MultiTrackTrack | null;
  sources: AigcTimelineSource[];
}) {
  const transientConfig = useRef<MultiTrackEditConfig | null>(null);
  const replace = (next: MultiTrackEditConfig) =>
    dispatch({ type: "config/replace", config: next });
  const updateElement = (
    update: (element: MultiTrackElement) => MultiTrackElement
  ) => {
    if (!selectedElement) return;
    replace({
      ...config,
      tracks: config.tracks.map((track) => ({
        ...track,
        elements: track.elements.map((element) =>
          element.id === selectedElement.id ? update(element) : element
        )
      }))
    });
  };
  const updateTextStyleConfig = (
    base: MultiTrackEditConfig,
    patch: Partial<MultiTrackTextElement["style"]>
  ) => {
    if (!selectedElement) return base;
    return {
      ...base,
      tracks: base.tracks.map((track) => ({
        ...track,
        elements: track.elements.map((element) =>
          element.id === selectedElement.id &&
          (element.type === "text" || element.type === "subtitle")
            ? { ...element, style: { ...element.style, ...patch } }
            : element
        )
      }))
    };
  };
  const beginColorGesture = () => {
    transientConfig.current ??= structuredClone(config);
  };
  const previewColor = (
    patch: Partial<MultiTrackTextElement["style"]>
  ) => {
    dispatch({
      type: "config/replace-transient",
      config: updateTextStyleConfig(config, patch)
    });
  };
  const commitColorGesture = (
    patch: Partial<MultiTrackTextElement["style"]>
  ) => {
    const initialConfig = transientConfig.current;
    const next = updateTextStyleConfig(config, patch);
    transientConfig.current = null;
    if (!initialConfig) {
      replace(next);
      return;
    }
    dispatch({
      type: "config/commit-transient",
      config: next,
      initialConfig
    });
  };
  const cancelColorGesture = () => {
    const initialConfig = transientConfig.current;
    transientConfig.current = null;
    if (initialConfig) {
      dispatch({ type: "config/cancel-transient", initialConfig });
    }
  };
  const selectedTextPreview =
    selectedElement?.type === "text"
      ? resolveMultitrackTextPreview(selectedElement, sources)
      : null;

  return (
    <aside
      aria-label="属性检查器"
      className="h-full min-h-0 overflow-y-auto bg-[#15181d] text-zinc-200"
    >
      <InspectorHeading
        detail={
          selectedElement
            ? `${kindLabel(selectedElement.type)} · ${selectedElement.id}`
            : selectedTrack
              ? `${kindLabel(selectedTrack.type)}轨道`
              : "画布与输出"
        }
        title={
          selectedElement
            ? "片段属性"
            : selectedTrack
              ? selectedTrack.name
              : "工程属性"
        }
      />

      {selectedTrack && !selectedElement ? (
        <InspectorSection title="轨道">
          <Field label="轨道名称">
            <Input
              className={inputClass}
              onChange={(event) =>
                dispatch({
                  type: "track/rename",
                  trackId: selectedTrack.id,
                  name: event.target.value
                })
              }
              value={selectedTrack.name}
            />
          </Field>
        </InspectorSection>
      ) : null}

      {selectedElement ? (
        <>
          <InspectorSection title="时间">
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="开始时间（毫秒）"
                onChange={(value) =>
                  updateElement((element) => ({
                    ...element,
                    target_time: {
                      ...element.target_time,
                      start_ms: value
                    }
                  }))
                }
                value={selectedElement.target_time.start_ms}
              />
              <NumberField
                label="结束时间（毫秒）"
                onChange={(value) =>
                  updateElement((element) => ({
                    ...element,
                    target_time: {
                      ...element.target_time,
                      end_ms: value
                    }
                  }))
                }
                value={selectedElement.target_time.end_ms}
              />
            </div>
            <ToggleField
              checked={selectedElement.loop}
              label="循环填充目标时长"
              onChange={(checked) =>
                updateElement((element) => ({ ...element, loop: checked }))
              }
            />
          </InspectorSection>

          {selectedElement.type !== "subtitle" ? (
            <InspectorSection title="素材来源">
              {selectedElement.type === "text" ? (
                selectedElement.source && selectedTextPreview ? (
                  <Field label="上游文字">
                    <textarea
                      aria-label="上游文字预览"
                      className="min-h-20 w-full resize-y border border-[#343a43] bg-[#101318] px-2.5 py-2 text-xs text-zinc-300 outline-none"
                      readOnly
                      value={selectedTextPreview.text}
                    />
                    <p className="text-[10px] leading-4 text-zinc-500">
                      {selectedTextPreview.status === "resolved"
                        ? "来自最新成功运行"
                        : selectedTextPreview.status === "configured"
                          ? "来自静态文字配置"
                          : "上游节点成功运行后显示实际文字"}
                    </p>
                    <Button
                      className="w-full"
                      disabled={
                        selectedTextPreview.status === "unavailable"
                      }
                      onClick={() =>
                        updateElement((element) =>
                          element.type === "text"
                            ? {
                                ...element,
                                inline_text: selectedTextPreview.text,
                                source: null
                              }
                            : element
                        )
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      转为内联文字
                    </Button>
                  </Field>
                ) : (
                  <Field label="内联文字">
                    <textarea
                      aria-label="内联文字"
                      className="min-h-20 w-full resize-y border border-[#343a43] bg-[#101318] px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                      onChange={(event) =>
                        updateElement((element) =>
                          element.type === "text"
                            ? {
                                ...element,
                                inline_text: event.target.value,
                                source: null
                              }
                            : element
                        )
                      }
                      value={selectedElement.inline_text ?? ""}
                    />
                  </Field>
                )
              ) : (
                <Field label="直接上游">
                  <select
                    className={selectClass}
                    onChange={(event) => {
                      const source = sources.find(
                        (candidate) =>
                          sourceValue(candidate) === event.target.value
                      );
                      if (source) {
                        dispatch({
                          type: "element/bind-source",
                          elementId: selectedElement.id,
                          source
                        });
                      }
                    }}
                    value={sourceValue(selectedElement.source)}
                  >
                    {sources
                      .filter((source) => source.kind === selectedElement.type)
                      .map((source) => (
                        <option key={sourceValue(source)} value={sourceValue(source)}>
                          {source.source_node_id} · {source.source_handle}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
            </InspectorSection>
          ) : null}

          {"transform" in selectedElement ? (
            <InspectorSection title="Transform">
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "width", "height", "rotation"] as const).map(
                  (key) => (
                    <NumberField
                      key={key}
                      label={transformLabel(key)}
                      onChange={(value) =>
                        updateElement((element) =>
                          "transform" in element
                            ? {
                                ...element,
                                transform: {
                                  ...element.transform,
                                  [key]: value
                                }
                              }
                            : element
                        )
                      }
                      value={selectedElement.transform[key]}
                    />
                  )
                )}
              </div>
            </InspectorSection>
          ) : null}

          {selectedElement.type === "video" ||
          selectedElement.type === "audio" ? (
            <InspectorSection title="播放与声音">
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="倍速"
                  max={4}
                  min={0.1}
                  onChange={(value) =>
                    updateElement((element) =>
                      element.type === "video" || element.type === "audio"
                        ? { ...element, speed: value }
                        : element
                    )
                  }
                  step={0.1}
                  value={selectedElement.speed}
                />
                <NumberField
                  label="音量"
                  min={0}
                  onChange={(value) =>
                    updateElement((element) =>
                      element.type === "video" || element.type === "audio"
                        ? { ...element, volume: value }
                        : element
                    )
                  }
                  step={0.1}
                  value={selectedElement.volume}
                />
                <NumberField
                  label="淡入（毫秒）"
                  min={0}
                  onChange={(value) =>
                    updateElement((element) =>
                      element.type === "video" || element.type === "audio"
                        ? { ...element, fade_in_ms: value }
                        : element
                    )
                  }
                  value={selectedElement.fade_in_ms}
                />
                <NumberField
                  label="淡出（毫秒）"
                  min={0}
                  onChange={(value) =>
                    updateElement((element) =>
                      element.type === "video" || element.type === "audio"
                        ? { ...element, fade_out_ms: value }
                        : element
                    )
                  }
                  value={selectedElement.fade_out_ms}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="源裁切开始（毫秒）"
                  min={0}
                  onChange={(value) =>
                    updateElement((element) =>
                      element.type === "video" || element.type === "audio"
                        ? {
                            ...element,
                            source_trim: {
                              start_ms: value,
                              end_ms:
                                element.source_trim?.end_ms ??
                                element.target_time.end_ms
                            }
                          }
                        : element
                    )
                  }
                  value={selectedElement.source_trim?.start_ms ?? 0}
                />
                <NumberField
                  label="源裁切结束（毫秒）"
                  min={0}
                  onChange={(value) =>
                    updateElement((element) =>
                      element.type === "video" || element.type === "audio"
                        ? {
                            ...element,
                            source_trim: {
                              start_ms: element.source_trim?.start_ms ?? 0,
                              end_ms: value
                            }
                          }
                        : element
                    )
                  }
                  value={
                    selectedElement.source_trim?.end_ms ??
                    selectedElement.target_time.end_ms
                  }
                />
              </div>
            </InspectorSection>
          ) : null}

          {selectedElement.type === "video" ? (
            <InspectorSection title="转场">
              <Field label="类型">
                <select
                  className={selectClass}
                  onChange={(event) =>
                    updateElement((element) =>
                      element.type === "video"
                        ? {
                            ...element,
                            transition:
                              event.target.value === "fade"
                                ? {
                                    type: "fade",
                                    duration_ms:
                                      element.transition?.duration_ms ?? 300
                                  }
                                : null
                          }
                        : element
                    )
                  }
                  value={selectedElement.transition?.type ?? "none"}
                >
                  <option value="none">无</option>
                  <option value="fade">淡化</option>
                </select>
              </Field>
              {selectedElement.transition ? (
                <NumberField
                  label="转场时长（毫秒）"
                  min={1}
                  onChange={(value) =>
                    updateElement((element) =>
                      element.type === "video" && element.transition
                        ? {
                            ...element,
                            transition: {
                              ...element.transition,
                              duration_ms: value
                            }
                          }
                        : element
                    )
                  }
                  value={selectedElement.transition.duration_ms}
                />
              ) : null}
            </InspectorSection>
          ) : null}

          {selectedElement.type === "text" ||
          selectedElement.type === "subtitle" ? (
            <TextStyleSection
              beginColorGesture={beginColorGesture}
              cancelColorGesture={cancelColorGesture}
              commitColorGesture={commitColorGesture}
              element={selectedElement}
              key={`${selectedElement.id}:${selectedElement.style.font_type ?? ""}`}
              previewColor={previewColor}
              updateElement={updateElement}
            />
          ) : null}

          <div className="border-b border-[#2a3038] p-3">
            <TimelineDeleteAction
              dispatch={dispatch}
              elementId={selectedElement.id}
            />
          </div>
        </>
      ) : null}

      <ProjectSection config={config} replace={replace} />

      {issues.length > 0 ? (
        <InspectorSection title={`执行前检查 · ${issues.length}`}>
          <ul className="space-y-1.5" role="alert">
            {issues.map((issue, index) => (
              <li
                className="space-y-0.5 text-[11px] leading-4 text-amber-300"
                key={`${issue.path}-${index}`}
              >
                <div>{issue.message}</div>
                <div className="flex flex-wrap gap-x-2 text-[10px] text-zinc-500">
                  {issue.track_id ? <span>轨道 {issue.track_id}</span> : null}
                  {issue.element_id ? <span>元素 {issue.element_id}</span> : null}
                  <span>{issue.path}</span>
                </div>
              </li>
            ))}
          </ul>
        </InspectorSection>
      ) : null}
    </aside>
  );
}

function TextStyleSection({
  beginColorGesture,
  cancelColorGesture,
  commitColorGesture,
  element,
  previewColor,
  updateElement
}: {
  beginColorGesture: () => void;
  cancelColorGesture: () => void;
  commitColorGesture: (
    patch: Partial<MultiTrackTextElement["style"]>
  ) => void;
  element: MultiTrackTextElement | Extract<MultiTrackElement, { type: "subtitle" }>;
  previewColor: (patch: Partial<MultiTrackTextElement["style"]>) => void;
  updateElement: (
    update: (element: MultiTrackElement) => MultiTrackElement
  ) => void;
}) {
  const updateStyle = (
    patch: Partial<MultiTrackTextElement["style"]>
  ) =>
    updateElement((candidate) =>
      candidate.type === "text" || candidate.type === "subtitle"
        ? { ...candidate, style: { ...candidate.style, ...patch } }
        : candidate
    );
  const fontType = element.style.font_type ?? null;
  const [fontMode, setFontMode] = useState<"custom" | "preset">(() =>
    fontType !== null && !isMediaKitFontPreset(fontType) ? "custom" : "preset"
  );
  const [customFontDraft, setCustomFontDraft] = useState(() =>
    fontType !== null && !isMediaKitFontPreset(fontType) ? fontType : ""
  );
  const invalidCustomFont =
    customFontDraft !== "" && fontTypeIssue(customFontDraft) !== null;
  const previewFont = useMultitrackPreviewFont(fontType);

  function selectFontMode(mode: "custom" | "preset") {
    if (fontMode === mode) return;
    setFontMode(mode);
    if (mode === "preset") {
      updateStyle({ font_type: null });
    }
  }

  function commitCustomFont() {
    const nextFontType = customFontDraft || null;
    if (nextFontType !== fontType) {
      updateStyle({ font_type: nextFontType });
    }
  }

  return (
    <InspectorSection title="文字样式">
      <div className="space-y-2">
        <div
          aria-label="字体模式"
          className="grid grid-cols-2 border border-[#343a43] bg-[#101318] p-0.5"
          role="group"
        >
          {[
            { label: "预置字体", mode: "preset" as const },
            { label: "自定义 URL", mode: "custom" as const }
          ].map(({ label, mode }) => (
            <button
              aria-pressed={fontMode === mode}
              className={cn(
                "h-7 px-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500",
                fontMode === mode
                  ? "bg-blue-500/15 text-blue-300"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              )}
              key={mode}
              onClick={() => selectFontMode(mode)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {fontMode === "preset" ? (
          <>
            <Field label="预置字体">
              <select
                aria-label="预置字体"
                className={selectClass}
                onChange={(event) =>
                  updateStyle({ font_type: event.target.value || null })
                }
                value={isMediaKitFontPreset(fontType ?? "") ? fontType ?? "" : ""}
              >
                <option value="">默认字体</option>
                {MEDIAKIT_FONT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </Field>
            {isMediaKitFontPreset(fontType ?? "") ? (
              <p className="text-[10px] leading-4 text-zinc-500">
                预置字体仅用于 MediaKit 合成，最终字形以 MediaKit 合成为准。
              </p>
            ) : null}
            {fontType === "1187225" ? (
              <p className="text-[10px] leading-4 text-amber-300">
                该字体不支持中文，请仅用于拉丁字符。
              </p>
            ) : null}
          </>
        ) : (
          <div className="space-y-1.5">
            <Field label="字体文件 URL">
              <Input
                aria-invalid={invalidCustomFont}
                aria-label="字体文件 URL"
                className={cn(
                  inputClass,
                  "font-mono text-[10px]",
                  invalidCustomFont && "border-red-400 focus-visible:border-red-400"
                )}
                onBlur={commitCustomFont}
                onChange={(event) => setCustomFontDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitCustomFont();
                    event.currentTarget.blur();
                  }
                }}
                placeholder="https://example.com/font.ttf"
                type="url"
                value={customFontDraft}
              />
            </Field>
            <p className="text-[10px] leading-4 text-zinc-500">
              仅支持公网 HTTPS 地址，路径以 .ttf 或 .otf 结尾。
            </p>
            {invalidCustomFont ? (
              <p className="text-[10px] leading-4 text-red-300" role="alert">
                请输入公网 HTTPS TTF/OTF 字体文件 URL。
              </p>
            ) : null}
            {previewFont.status === "failed" ? (
              <p className="text-[10px] leading-4 text-amber-300" role="status">
                浏览器无法加载字体，MediaKit 合成仍会尝试使用该 URL
              </p>
            ) : null}
          </div>
        )}
      </div>
      <NumberField
        label="字号"
        min={1}
        onChange={(value) => updateStyle({ font_size: value })}
        value={element.style.font_size}
      />
      <div className="grid grid-cols-2 gap-2">
        <AigcMultitrackColorField
          label="文字颜色"
          onCommit={(value) => updateStyle({ color: value })}
          onGestureCancel={cancelColorGesture}
          onGestureCommit={(value) =>
            commitColorGesture({ color: value })
          }
          onGestureStart={beginColorGesture}
          onPreview={(value) => previewColor({ color: value })}
          value={element.style.color}
        />
        <AigcMultitrackColorField
          label="背景颜色"
          onCommit={(value) => updateStyle({ background_color: value })}
          onGestureCancel={cancelColorGesture}
          onGestureCommit={(value) =>
            commitColorGesture({ background_color: value })
          }
          onGestureStart={beginColorGesture}
          onPreview={(value) =>
            previewColor({ background_color: value })
          }
          value={element.style.background_color}
        />
      </div>
      <div className="flex gap-1">
        {[
          { key: "bold" as const, label: "粗体", icon: Bold },
          { key: "italic" as const, label: "斜体", icon: Italic },
          { key: "underline" as const, label: "下划线", icon: Underline }
        ].map(({ icon: Icon, key, label }) => (
          <Button
            aria-label={label}
            aria-pressed={element.style[key]}
            className={cn(
              "h-8 w-8 p-0",
              element.style[key] && "border-blue-500 bg-blue-500/10 text-blue-300"
            )}
            key={key}
            onClick={() => updateStyle({ [key]: !element.style[key] })}
            size="icon"
            type="button"
            variant="outline"
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
    </InspectorSection>
  );
}

function ProjectSection({
  config,
  replace
}: {
  config: MultiTrackEditConfig;
  replace: (config: MultiTrackEditConfig) => void;
}) {
  return (
    <InspectorSection title="画布与输出">
      <Field label="画布模式">
        <select
          className={selectClass}
          onChange={(event) =>
            replace({
              ...config,
              canvas: {
                ...config.canvas,
                mode: event.target.value as "auto" | "custom",
                width:
                  event.target.value === "custom"
                    ? config.canvas.width ?? 1920
                    : null,
                height:
                  event.target.value === "custom"
                    ? config.canvas.height ?? 1080
                    : null
              }
            })
          }
          value={config.canvas.mode}
        >
          <option value="auto">自动</option>
          <option value="custom">自定义</option>
        </select>
      </Field>
      {config.canvas.mode === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="画布宽度"
            max={8192}
            min={160}
            onChange={(value) =>
              replace({
                ...config,
                canvas: { ...config.canvas, width: value }
              })
            }
            value={config.canvas.width ?? 1920}
          />
          <NumberField
            label="画布高度"
            max={8192}
            min={160}
            onChange={(value) =>
              replace({
                ...config,
                canvas: { ...config.canvas, height: value }
              })
            }
            value={config.canvas.height ?? 1080}
          />
        </div>
      ) : null}
      <ColorField
        label="画布背景"
        onChange={(value) =>
          replace({
            ...config,
            canvas: { ...config.canvas, background_color: value }
          })
        }
        value={config.canvas.background_color}
      />
      <Field label="输出格式">
        <Input className={inputClass} disabled value="MP4" />
      </Field>
      <Field label="帧率">
        <select
          className={selectClass}
          onChange={(event) =>
            replace({
              ...config,
              output: {
                ...config.output,
                fps: Number(event.target.value) as MultiTrackFrameRate
              }
            })
          }
          value={config.output.fps}
        >
          {[24, 25, 30, 50, 60].map((fps) => (
            <option key={fps} value={fps}>
              {fps} FPS
            </option>
          ))}
        </select>
      </Field>
    </InspectorSection>
  );
}

function InspectorHeading({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="sticky top-0 z-10 border-b border-[#2a3038] bg-[#15181d]/95 px-3 py-3 backdrop-blur">
      <h2 className="truncate text-xs font-semibold">{title}</h2>
      <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600">
        {detail}
      </p>
    </div>
  );
}

function InspectorSection({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-3 border-b border-[#2a3038] p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <Label className="block space-y-1.5 text-[10px] text-zinc-500">
      <span>{label}</span>
      {children}
    </Label>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  step = 1,
  value
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <Field label={label}>
      <Input
        aria-label={label}
        className={inputClass}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={value}
      />
    </Field>
  );
}

function ColorField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field label={label}>
      <Input
        aria-label={label}
        className={`${inputClass} font-mono uppercase`}
        maxLength={9}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        value={value}
      />
    </Field>
  );
}

function ToggleField({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Label className="flex items-center justify-between text-[11px] text-zinc-400">
      {label}
      <input
        checked={checked}
        className="h-4 w-4 accent-blue-500"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </Label>
  );
}

const inputClass =
  "h-8 rounded-none border-[#343a43] bg-[#101318] px-2 text-xs shadow-none focus-visible:border-blue-500 focus-visible:ring-0";
const selectClass =
  "h-8 w-full border border-[#343a43] bg-[#101318] px-2 text-xs text-zinc-200 outline-none focus:border-blue-500";

function sourceValue(source: {
  source_node_id: string;
  source_handle: string;
}) {
  return `${source.source_node_id}\u0000${source.source_handle}`;
}

function kindLabel(kind: MultiTrackElement["type"]) {
  return {
    audio: "音频",
    image: "图片",
    subtitle: "字幕",
    text: "文字",
    video: "视频"
  }[kind];
}

function transformLabel(
  key: "height" | "rotation" | "width" | "x" | "y"
) {
  return {
    height: "高度",
    rotation: "旋转角度",
    width: "宽度",
    x: "位置 X",
    y: "位置 Y"
  }[key];
}
