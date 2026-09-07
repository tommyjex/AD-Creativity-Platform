"use client";

import { Bold, Italic, Underline } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          <Button
            className="w-full text-zinc-400 hover:text-red-300"
            onClick={() =>
              dispatch({ type: "track/remove", trackId: selectedTrack.id })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            删除轨道
          </Button>
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
                <Field label="内联文字">
                  <textarea
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
              element={selectedElement}
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
  element,
  updateElement
}: {
  element: MultiTrackTextElement | Extract<MultiTrackElement, { type: "subtitle" }>;
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
  return (
    <InspectorSection title="文字样式">
      <NumberField
        label="字号"
        min={1}
        onChange={(value) => updateStyle({ font_size: value })}
        value={element.style.font_size}
      />
      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label="文字颜色"
          onChange={(value) => updateStyle({ color: value })}
          value={element.style.color}
        />
        <ColorField
          label="背景颜色"
          onChange={(value) => updateStyle({ background_color: value })}
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
