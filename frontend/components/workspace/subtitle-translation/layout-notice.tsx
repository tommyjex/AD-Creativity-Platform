export function SubtitleLayoutNotice() {
  return (
    <aside className="rounded-lg border border-amber-500/30 p-3 text-xs text-muted-foreground">
      <p className="font-semibold">压制支持边界 · 请在提交前核对</p>
      <p>工具最多 500 条字幕，每条译文 4000 字符；MediaKit 未公开文字 / 轨道容量，工具上限不代表供应商容量保证，超限不会静默截断。</p>
      <p>最终字形的垂直锚点及特殊文本解释 / 转义尚未进行真实成片验证。字体测量和排版示意不等于供应商最终效果。</p>
    </aside>
  );
}
