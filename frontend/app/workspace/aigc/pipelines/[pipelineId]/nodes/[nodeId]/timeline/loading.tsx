export default function AigcTimelineEditorLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="AIGC 多轨时间线加载中"
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#0b0d10]"
    >
      <div className="h-14 shrink-0 animate-pulse border-b border-[#2a3038] bg-[#15181d]" />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_12rem] gap-px bg-[#2a3038]">
        <div className="grid place-items-center bg-[#0d1014] p-8">
          <div className="aspect-video h-full max-h-[28rem] max-w-full animate-pulse bg-[#1d2127]" />
        </div>
        <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-px bg-[#2a3038]">
          <div className="animate-pulse bg-[#15181d]" />
          <div className="animate-pulse bg-[#111419]" />
        </div>
      </div>
    </main>
  );
}
