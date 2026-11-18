import type { SubtitleEffectiveRenderMode, SubtitleRenderMode, SubtitleSegment, SubtitleVideoCategory, ToolTask } from "@/lib/api-types";

export type { SubtitleVideoCategory } from "@/lib/api-types";

export function subtitleVideoCategory(workspace: { video_category?: SubtitleVideoCategory }) {
  return workspace.video_category ?? "unboxing";
}

export function subtitleVideoCategoryLabel(category: SubtitleVideoCategory) {
  return category === "product" ? "产品视频" : "开箱视频";
}

export function subtitleRenderMode(workspace: { render_mode?: SubtitleRenderMode }) {
  return workspace.render_mode ?? "png";
}

export function subtitleCrf(workspace: { crf?: number }) {
  return workspace.crf ?? 16;
}

function validCrf(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 30;
}

export function subtitleRenderModeLabel(mode: SubtitleEffectiveRenderMode) {
  return ({ png: "PNG · 图片绘制", text: "Text · 原生文字", mixed: "PNG / Text · 混合" })[mode];
}

function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function resultMode(value: unknown): SubtitleEffectiveRenderMode | null {
  return value === "png" || value === "text" || value === "mixed" ? value : null;
}

// Never infer historical output parameters from the current workspace selection.
export function subtitleRenderSummaryLabel(value: unknown) {
  const summary = record(value);
  const requested = summary.render_mode === "png" || summary.render_mode === "text" ? summary.render_mode : null;
  const effective = resultMode(summary.effective_render_mode);
  const crf = validCrf(summary.crf) ? summary.crf :
    summary.encoding_policy_version === "crf16-h264-v2" ? 16 : null;
  const encoding = crf !== null && (summary.video_codec === "h264" ||
    ["crf16-h264-v2", "configurable-crf-h264-v3"].includes(String(summary.encoding_policy_version)));
  const fallback = requested === "png" && effective === "text" ? "已回退 Text" :
    requested === "png" && effective === "mixed" ? "部分字幕回退 Text" : null;
  return [
    requested ? `请求 ${subtitleRenderModeLabel(requested)}` : "请求方式未知",
    effective ? `实际 ${subtitleRenderModeLabel(effective)}` : "实际方式未记录",
    fallback,
    encoding ? `H.264 · CRF ${crf}` : "历史参数"
  ].filter(Boolean).join(" · ");
}

export function subtitleTaskRenderSummaryLabel(task: ToolTask) {
  const snapshot = task.input_snapshot;
  const payload = record(snapshot.input_payload);
  const result = record(snapshot.result);
  const frozen = record(snapshot.encoding_result);
  const encoding = validCrf(result.crf) ? result : validCrf(frozen.crf) ? frozen :
    validCrf(snapshot.crf) ? snapshot : {};
  return subtitleRenderSummaryLabel({
    ...result,
    ...encoding,
    render_mode: snapshot.render_mode ?? payload.render_mode ?? result.render_mode,
    effective_render_mode: resultMode(result.effective_render_mode) ?? resultMode(snapshot.effective_render_mode),
    encoding_policy_version: snapshot.encoding_policy_version ?? payload.encoding_policy_version ?? result.encoding_policy_version
  });
}

export function subtitleTextProductWarning(warnings: string[]) {
  return warnings.some((warning) => warning.split(":").some((part) => part.trim() === "text_product_font_fallback"))
    ? WARNING_MESSAGES.text_product_font_fallback : null;
}

export const SUBTITLE_LANGUAGES = [
  ["en", "英语"], ["de", "德语"], ["fr", "法语"], ["es", "西班牙语"],
  ["it", "意大利语"], ["pt", "葡萄牙语"], ["zh", "中文"], ["ja", "日语"]
] as const;

// Keep resource versions aligned with subtitle_translation_layout.FONT_RESOURCES.
const SOURCE_HAN_ROOT = "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF";
export const DEFAULT_SUBTITLE_FONT_ID = "CenturyGothic";
export const SUBTITLE_FONTS = [
  { id: "SY_Black", label: "思源黑体 · 简体中文", url: `${SOURCE_HAN_ROOT}/CN/SourceHanSansCN-Regular.otf` },
  { id: "SY_Black_JP", label: "思源黑体 · 日文", url: `${SOURCE_HAN_ROOT}/JP/SourceHanSansJP-Regular.otf` },
  { id: "CenturyGothic", label: "世纪哥特体", url: "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf" },
  { id: "CenturyGothicBold", label: "世纪哥特体 · 粗体", url: "https://xujianhua-utils.tos-cn-beijing.volces.com/CenturyGothic/centurygothic_bold.ttf" },
  { id: "AvenirLTStdBlack", label: "Avenir · 型号 Black", url: "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/AvenirLTStd-Black.otf" },
  { id: "AvenirLTStdLight", label: "Avenir · 规格 Light", url: "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/AvenirLTStd-Light.otf" }
] as const;

export const SUBTITLE_CAPACITY_NOTICE =
  "Tool limit: 500 subtitles, 4000 characters per subtitle. MediaKit publishes no text/track capacity limit; these tool limits are not a provider capacity guarantee.";

const WARNING_MESSAGES: Record<string, string> = {
  text_product_font_fallback: "Text 模式：产品名按整行字体压制",
  brand_content_skipped: "品牌片尾已跳过。",
  product_recognition_unavailable: "产品名称自动识别暂不可用，已保留普通字幕。",
  product_recognition_invalid_split: "无效的产品拆分已自动忽略，保留普通字幕。",
  product_layout_unavailable: "产品混合字体暂不可用，已自动保留普通字幕排版。",
  product_layer_storage_unavailable: "产品图层存储暂不可用，已自动显示普通文字预览。",
  product_layer_materialization_unavailable: "产品图层暂不可用，已自动回退普通字幕压制。",
  product_name_marker_invalid: "产品名称保护异常已由系统处理，保留可用字幕。",
  product_name_missing_after_translation: "产品名称暂未恢复，已保留可用字幕。",
  product_glyph_font_fallback: "部分字符已自动使用覆盖完整的备用字体。",
  font_size_reduced: "已优先自动扩宽；受可用宽度或框高度限制，输出字号已缩小以保持单行。",
  bbox_expanded: "译文框已自动横向扩宽，原始坐标和对齐锚点保持不变。",
  bbox_expansion_limited: "自动扩宽已达到安全边距或相邻字幕限制，请核对输出字号。",
  original_bbox_overlap: "原字幕框在同一时间已有重叠，已保留原框并停止扩宽，请核对位置。",
  expanded_background_unverified: "扩宽区域的背景尚未核对，请检查文字色和底板的可读性。",
  font_size_small: "输出字号偏小，请精简译文或扩大文字框后重新计算排版。",
  font_size_minimum_applied: "已使用最小合法字号，请检查文字框与译文。",
  missing_glyphs: "所选字体缺少部分字形，压制将回退到 MediaKit 预置阿里巴巴普惠体。",
  font_fallback: "已使用 MediaKit 预置阿里巴巴普惠体（ALi_PuHui），请核对成片。",
  font_metrics_unverified: "回退字体的字号与预览按所选字体估算，最终排版请以成片为准。",
  preset_glyph_coverage_unverified: "预置字体的实际字形覆盖由 MediaKit 渲染决定，请核对特殊字符。",
  font_url_version_unverified: "字体版本尚未确认，请核对实际字体并检查成片。",
  background_unknown: "画面背景未知，已用白字和半透明深灰底，请核对可读性。",
  background_color_unavailable: "无法可靠估计画面背景，请核对文字色与底板色。",
  low_contrast: "文字与背景对比度偏低，请调整文字色或底板色。",
  contrast_unverified: "背景变化下的对比度尚未验证，请核对视频中的可读性。",
  alignment_defaulted: "原始对齐缺失，已居中，请核对位置。",
  time_outside_video: "此条完全超出成片时长，不参与压制，请调整时间或排除。",
  time_clipped: "结束时间已截到成片尾部，请核对时间。",
  video_duration_mismatch: "两份视频时长不同，请核对剪辑与时间原点。",
  fps_fallback_30: "源帧率不受支持，输出将使用 30 FPS，请核对成片。",
  fps_support_local_contract_only: "此帧率仅通过本地接口校验，尚未真实压制验证。",
  source_rotation_real_render_unverified: "旋转视频的最终输出方向尚未真实验证，请检查成片。",
  source_has_no_audio: "无字幕视频没有音轨，成片也将没有音轨。",
  provider_text_capacity_unverified: "供应商未公开文字与轨道容量；工具上限不代表供应商容量保证。",
  provider_vertical_anchor_unverified: "最终字形的垂直锚点尚未真实验证，请核对成片位置。",
  provider_literal_escaping_unverified: "特殊文本解释与转义尚未真实验证，请核对成片文字。",
  real_render_unverified: "尚未进行真实压制验证；字体测量和排版示意不等于最终效果。",
  video_metadata_unavailable: "暂缺视频尺寸，无法测量字号，请补充视频后重新计算。",
  source_video_bit_rate_unavailable: "未能读取底片视频码率，本次使用默认编码码率，请检查成片清晰度与体积。",
  video_source_unavailable: "视频暂不可访问，请刷新或重新导入后计算排版。",
  missing_translation: "请补齐译文或排除此条后计算排版。",
  measurement_unavailable: "暂时无法测量字号，请稍后重新计算；草稿已保留。",
  font_resource_unavailable: "字体暂不可用，请更换字体或稍后重新计算排版。",
  font_resource_too_large: "字体文件超出支持范围，请更换字体。",
  font_unicode_cmap_missing: "字体缺少字形映射，请更换字体。",
  invalid_font_cmap: "字体字形映射无效，请更换字体。",
  bbox_below_font_minimum: "文字框过小，无法容纳最小字号，请扩大文字框。",
  bbox_below_pixel_resolution: "文字框小于输出像素，请扩大文字框后重新计算。",
  text_cannot_fit_at_minimum_font: "最小字号仍无法保持单行，请精简译文或扩大文字框。",
  text_must_be_single_line: "译文含换行，请改为单行后重新计算。",
  invalid_bbox: "文字框坐标无效，请检查范围与宽高。",
  invalid_segment_time: "字幕时间无效，请检查起止时间。",
  invalid_text_color: "文字色无效，请使用有效颜色值。",
  invalid_panel_color: "底板色无效，请使用有效颜色值。",
  no_renderable_subtitles: "没有可压制字幕，请补齐译文并检查排除状态与时间范围。",
  invalid_font_size: "字号无效，请设置合法正值后重新计算。",
  segment_capacity_exceeded: "字幕超过工具 500 条上限，请减少条目；供应商未公开容量，工具上限不代表容量保证。",
  text_capacity_exceeded: "单条译文超过 4000 字符，请精简译文；供应商未公开容量，工具上限不代表容量保证。"
};

const PRODUCT_WARNING_MESSAGES: Record<string, string> = {
  background_unknown: "画面背景未知，字幕无底板，请核对文字可读性。",
  background_color_unavailable: "无法可靠估计画面背景，请核对文字色。",
  expanded_background_unverified: "扩宽区域的背景尚未核对，请检查文字色的可读性。",
  low_contrast: "文字与背景对比度偏低，请调整文字色。",
  invalid_panel_color: "产品视频的底板配置不生效，字幕无底板。"
};

export function subtitleWarningMessage(warning: string, category: SubtitleVideoCategory = "unboxing", renderMode: SubtitleRenderMode = "png") {
  if (warning === SUBTITLE_CAPACITY_NOTICE) return WARNING_MESSAGES.provider_text_capacity_unverified;
  const parts = warning.split(":").map((part) => part.trim());
  const code = parts.find((part) => WARNING_MESSAGES[part]);
  if (code) {
    if (renderMode === "text" && ["background_unknown", "background_color_unavailable", "expanded_background_unverified", "low_contrast", "invalid_panel_color"].includes(code)) {
      return "底板使用接口默认值，请在成片中核对文字可读性。";
    }
    return (category === "product" ? PRODUCT_WARNING_MESSAGES[code] : null) ?? WARNING_MESSAGES[code];
  }
  if (/^[a-z0-9_:.-]+$/i.test(warning)) return "此条排版尚需核对，请检查译文、时间和样式后重新计算。";
  return warning;
}

export function subtitlePreviewFont(segment: SubtitleSegment) {
  if (segment.style.font) {
    const manual = SUBTITLE_FONTS.find((font) =>
      font.id === segment.style.font || font.url === segment.style.font
    );
    if (manual) return manual;
    const fallback = SUBTITLE_FONTS.find((font) => font.url === segment.font_type);
    if (fallback) return fallback;
  }
  // Derived summaries may predate the role rule; they are not manual overrides.
  const automaticId = segment.visual_role === "headline" ? "CenturyGothicBold" : DEFAULT_SUBTITLE_FONT_ID;
  return SUBTITLE_FONTS.find((font) => font.id === automaticId)!;
}

export const DEFAULT_SUBTITLE_PANEL_COLOR = "#33333359"; // 35% opacity.

export function subtitleColorParts(color: string | null | undefined) {
  if (!color || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) return null;
  return {
    rgb: color.slice(0, 7),
    alpha: color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1
  };
}

export function subtitlePanelColor(rgb: string, opacity: number) {
  return rgb.slice(0, 7) + Math.round(Math.min(100, Math.max(0, opacity)) / 100 * 255)
    .toString(16).padStart(2, "0").toUpperCase();
}

export function subtitleColors(segment: SubtitleSegment, category: SubtitleVideoCategory = "unboxing") {
  const background = segment.background_color;
  const valid = background != null && /^#[0-9a-f]{6}$/i.test(background);
  const channels = valid ? [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16)) : [];
  const white = valid && Math.min(...channels) >= 245;
  const black = valid && Math.max(...channels) <= 16;
  const recommended = white ? "#000000" : "#FFFFFF";
  const panel = category === "product" ? "#00000000" :
    segment.style.background_color ?? (white || black ? "#00000000" : DEFAULT_SUBTITLE_PANEL_COLOR);
  const customPanel = category !== "product" && segment.style.background_color != null &&
    (subtitleColorParts(segment.style.background_color)?.alpha ?? 0) > 0;
  return {
    text: segment.style.text_color ?? (customPanel ? "#FFFFFF" : recommended),
    panel,
    recommended
  };
}

export function clearSubtitleLayout(segment: SubtitleSegment, modeChanged = false): SubtitleSegment {
  return {
    ...segment,
    estimated_font_size_px: null, effective_font_size_px: null, render_bbox_pixels: null,
    recommended_text_color: null, font_type: null, font_sha256: null,
    render_layer_asset_id: null, render_layer_url: null, text_runs: null,
    ...(modeChanged ? { effective_render_mode: null } : {}),
    warnings: clearSubtitleLayoutWarnings(segment.warnings, modeChanged)
  };
}

export function clearSubtitleLayoutWarnings(warnings: string[], modeChanged = false) {
  return warnings.filter((warning) => ![
      "bbox_expanded", "bbox_expansion_limited", "original_bbox_overlap",
      "expanded_background_unverified", "font_size_reduced", "font_size_small",
      "background_unknown", "background_color_unavailable", "low_contrast", "contrast_unverified",
      "font_fallback", "font_metrics_unverified", "product_layout_unavailable",
      "product_layer_storage_unavailable", "product_layer_materialization_unavailable",
      "png_text_fallback", "png_mixed_fallback", "subtitle_raster_unavailable",
      ...(modeChanged ? [
        "text_product_font_fallback", "missing_glyphs", "font_size_minimum_applied",
        "preset_glyph_coverage_unverified", "font_url_version_unverified", "font_resource_unavailable",
        "font_resource_too_large", "font_unicode_cmap_missing", "invalid_font_cmap",
        "measurement_unavailable", "bbox_below_font_minimum", "bbox_below_pixel_resolution",
        "text_cannot_fit_at_minimum_font", "provider_vertical_anchor_unverified",
        "provider_literal_escaping_unverified", "real_render_unverified", "product_glyph_font_fallback"
      ] : [])
    ].some((code) => warning.split(":").some((part) => part.trim() === code)));
}

export const subtitleFieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

export function subtitleDraftSignature(segments: SubtitleSegment[]) {
  return JSON.stringify(segments.map((segment) => ({
    segment_id: segment.segment_id,
    translated_text: segment.translated_text,
    start_ms: segment.start_ms, end_ms: segment.end_ms,
    bbox_normalized: segment.bbox_normalized,
    excluded: segment.excluded, style: segment.style,
    product_names_enabled: segment.product_names_enabled ?? true
  })));
}

export function subtitleProductText(segment: SubtitleSegment, start: number, end: number) {
  return Array.from(segment.translated_text ?? "").slice(start, end).join("");
}

export function containedVideoRect(
  width: number, height: number, videoWidth: number, videoHeight: number
) {
  if (Math.min(width, height, videoWidth, videoHeight) <= 0) return null;
  const scale = Math.min(width / videoWidth, height / videoHeight);
  return {
    left: (width - videoWidth * scale) / 2,
    top: (height - videoHeight * scale) / 2,
    width: videoWidth * scale,
    height: videoHeight * scale,
    scale
  };
}

export function subtitlePreviewBox(segment: SubtitleSegment, videoWidth: number, videoHeight: number) {
  const box = segment.render_bbox_pixels;
  if (box && videoWidth > 0 && videoHeight > 0) {
    return {
      left: box[0] / videoWidth * 100, top: box[1] / videoHeight * 100,
      width: (box[2] - box[0]) / videoWidth * 100,
      height: (box[3] - box[1]) / videoHeight * 100
    };
  }
  const [x1, y1, x2, y2] = segment.bbox_normalized;
  return {
    left: x1 / 999 * 100, top: y1 / 999 * 100,
    width: (x2 - x1) / 999 * 100, height: (y2 - y1) / 999 * 100
  };
}

export function segmentDraftIssue(segment: SubtitleSegment): string | null {
  if (!Number.isInteger(segment.start_ms) || !Number.isInteger(segment.end_ms) ||
      segment.start_ms < 0 || segment.end_ms <= segment.start_ms) {
    return "起止时间必须为有效毫秒，结束时间应大于开始时间。";
  }
  const [x1, y1, x2, y2] = segment.bbox_normalized;
  if (segment.bbox_normalized.some((n) => !Number.isInteger(n) || n < 0 || n > 999) ||
      x1 >= x2 || y1 >= y2) return "BBox 使用 0–999 整数坐标且必须具有正面积。";
  if (segment.translated_text && /[\u0000-\u001f\u2028\u2029]/.test(segment.translated_text)) return "译文必须保持单行。";
  if (segment.translated_text && segment.translated_text.length > 4000) return "译文不能超过 4000 个字符。";
  if (segment.style.font_size_px != null &&
      (!Number.isFinite(segment.style.font_size_px) || segment.style.font_size_px <= 0 || segment.style.font_size_px > 4096)) return "字号上限必须大于 0 且不超过 4096。";
  if ([segment.style.text_color, segment.style.background_color].some((color) =>
    color != null && !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color))) return "颜色请使用 #RRGGBB 或 #RRGGBBAA。";
  return null;
}

export function segmentIssue(segment: SubtitleSegment): string | null {
  if (subtitleBrandSkipped(segment)) return null;
  return segmentDraftIssue(segment) ??
    (!segment.excluded && !segment.translated_text?.trim() ? "待补齐译文或明确排除。" : null);
}

export function subtitleBrandSkipped(segment: SubtitleSegment) {
  return segment.warnings.includes("brand_content_skipped");
}
