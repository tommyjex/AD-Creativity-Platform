"use client";

import { memo } from "react";
import type { SubtitleSegment, SubtitleStyle } from "@/lib/api-types";
import { DEFAULT_SUBTITLE_PANEL_COLOR, segmentIssue, subtitleColorParts, subtitleColors, subtitleFieldClass, subtitlePanelColor, SUBTITLE_FONTS } from "@/lib/subtitle-translation";
import { Button } from "@/components/ui/button";

export const SubtitleSegmentEditor = memo(function SubtitleSegmentEditor({
  segment, index, readOnly, selected, onChange, onSeek
}: {
  segment: SubtitleSegment;
  index: number;
  readOnly: boolean;
  selected: boolean;
  onChange: (id: string, change: Partial<SubtitleSegment>) => void;
  onSeek: (segment: SubtitleSegment) => void;
}) {
  const issue = segmentIssue(segment);
  const changeStyle = (change: Partial<SubtitleStyle>) =>
    onChange(segment.segment_id, { style: { ...segment.style, ...change } });
  const title = `字幕 ${index + 1}`;
  const colors = subtitleColors(segment);
  const panelParts = subtitleColorParts(colors.panel);
  const panelMode = segment.style.background_color == null ? "auto" :
    subtitleColorParts(segment.style.background_color)?.alpha === 0 ? "none" : "custom";
  return (
    <article className={`min-w-0 rounded-xl border p-4 ${selected ? "border-primary bg-primary/[0.03]" : "border-border"}`}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => onSeek(segment)}>{title} · 定位</Button>
        <span className="text-xs text-muted-foreground">{segment.visual_role} · {segment.block_id} / {segment.line_index}</span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={segment.excluded} disabled={readOnly} onChange={(event) => onChange(segment.segment_id, { excluded: event.target.checked })} />
          排除此条
        </label>
      </div>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">原文 · 保留对照</p>
          <p className="whitespace-pre-wrap break-words rounded-lg bg-secondary p-3 text-sm">{segment.text}</p>
        </div>
        <label className="text-xs text-muted-foreground">
          译文 {segment.translation_status !== "succeeded" && !segment.translated_text ? "· 待处理" : ""}
          <textarea aria-label={`${title}译文`} className={`${subtitleFieldClass} mt-1 min-h-20 resize-y`} value={segment.translated_text ?? ""} disabled={readOnly} onChange={(event) => onChange(segment.segment_id, { translated_text: event.target.value, translation_status: event.target.value.trim() ? "succeeded" : "pending" })} />
        </label>
      </div>
      <fieldset disabled={readOnly} className="mt-3 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {(["start_ms", "end_ms"] as const).map((key) => (
          <label key={key} className="text-xs text-muted-foreground">{key === "start_ms" ? "开始 ms" : "结束 ms"}
            <input aria-label={`${title}${key}`} type="number" min="0" step="1" className={subtitleFieldClass} value={segment[key]} onChange={(event) => onChange(segment.segment_id, { [key]: Number(event.target.value) })} />
          </label>
        ))}
        {segment.bbox_normalized.map((value, coordinate) => (
          <label key={coordinate} className="text-xs text-muted-foreground">BBox {["x1", "y1", "x2", "y2"][coordinate]}
            <input aria-label={`${title}BBox${coordinate}`} type="number" min="0" max="999" step="1" className={subtitleFieldClass} value={value} onChange={(event) => {
              const bbox = [...segment.bbox_normalized] as SubtitleSegment["bbox_normalized"];
              bbox[coordinate] = Number(event.target.value);
              onChange(segment.segment_id, { bbox_normalized: bbox });
            }} />
          </label>
        ))}
        <label className="text-xs text-muted-foreground">字号上限 px
          <input aria-label={`${title}字号`} type="number" min="1" max="4096" className={subtitleFieldClass} value={segment.style.font_size_px ?? ""} onChange={(event) => changeStyle({ font_size_px: event.target.value ? Number(event.target.value) : null })} />
        </label>
        <label className="text-xs text-muted-foreground">字体
          <select aria-label={`${title}字体`} className={subtitleFieldClass} value={segment.style.font ?? ""} onChange={(event) => changeStyle({ font: event.target.value || null })}>
            <option value="">默认 · Century Gothic Bold</option>
            {SUBTITLE_FONTS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            {segment.style.font && !SUBTITLE_FONTS.some(({ id }) => id === segment.style.font) ? <option value={segment.style.font}>{segment.style.font}</option> : null}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">对齐
          <select aria-label={`${title}对齐`} className={subtitleFieldClass} value={segment.style.alignment ?? ""} onChange={(event) => changeStyle({ alignment: event.target.value as SubtitleStyle["alignment"] || null })}>
            <option value="">原始 {segment.alignment}</option><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">文字色
          <input aria-label={`${title}text_color`} className={subtitleFieldClass} value={segment.style.text_color ?? ""} placeholder="自动" onChange={(event) => changeStyle({ text_color: event.target.value || null })} />
        </label>
        <label className="text-xs text-muted-foreground">字幕底板
          <select aria-label={`${title}底板模式`} className={subtitleFieldClass} value={panelMode} onChange={(event) => changeStyle({
            background_color: event.target.value === "auto" ? null : event.target.value === "none" ? "#00000000" : DEFAULT_SUBTITLE_PANEL_COLOR
          })}>
            <option value="auto">自动 · 按背景选择</option>
            <option value="none">无底板</option>
            <option value="custom">自定义底板</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">底板颜色
          <input aria-label={`${title}底板颜色`} type="color" className={`${subtitleFieldClass} h-10`} disabled={panelMode !== "custom"} value={panelParts?.rgb ?? "#333333"} onChange={(event) => changeStyle({
            background_color: subtitlePanelColor(event.target.value, (panelParts?.alpha ?? 0.35) * 100)
          })} />
        </label>
        <label className="text-xs text-muted-foreground">底板不透明度 {Math.round((panelParts?.alpha ?? 0) * 100)}%
          <input aria-label={`${title}底板不透明度`} type="range" min="1" max="100" step="1" className="mt-2 w-full accent-emerald-400" disabled={panelMode !== "custom"} value={Math.max(1, Math.round((panelParts?.alpha ?? 0.35) * 100))} onChange={(event) => changeStyle({
            background_color: subtitlePanelColor(panelParts?.rgb ?? "#333333", Number(event.target.value))
          })} />
        </label>
        <label className="text-xs text-muted-foreground">底板色 · RGBA
          <input aria-label={`${title}background_color`} className={subtitleFieldClass} value={segment.style.background_color ?? ""} placeholder="自动" onChange={(event) => changeStyle({ background_color: event.target.value || null })} />
        </label>
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">画面背景估计 <i className="h-4 w-4 rounded border border-border" style={{ backgroundColor: segment.background_color ?? "transparent" }} />{segment.background_color ?? "未知 · 白字/半透明深灰底"}</span>
        <span>推荐文字色 {colors.recommended}</span>
        <span>当前底板 {panelParts?.alpha === 0 ? "无" : colors.panel}</span>
        <span>估算字号 {segment.estimated_font_size_px ?? "待计算"} · 输出字号 {segment.effective_font_size_px ?? "待计算"}</span>
        {segment.render_bbox_pixels ? <span>输出 BBox {segment.render_bbox_pixels.join(", ")}</span> : null}
      </div>
      <details className="mt-2 break-all text-xs text-muted-foreground">
        <summary>实际字体与版本</summary>
        <p>字体：{SUBTITLE_FONTS.find((font) => font.url === segment.font_type)?.label ?? "待计算"}</p>
        <p>字体 URL：{segment.font_type ?? "待计算"}</p>
        <p>SHA-256：{segment.font_sha256 ?? "待计算"}</p>
      </details>
      {issue ? <p className="mt-2 text-sm text-amber-600">{issue}</p> : null}
    </article>
  );
});
