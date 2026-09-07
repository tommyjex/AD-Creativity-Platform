export default function AigcLayerEditorLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="AIGC 图层编辑器加载中"
      className="flex h-[100dvh] flex-col overflow-hidden bg-[#0b0d10] lg:grid lg:grid-cols-[3.25rem_minmax(0,1fr)_20rem]"
    >
      <div className="h-14 shrink-0 border-b border-[#2a3038] bg-[#14171b] lg:h-auto lg:border-b-0 lg:border-r" />
      <div className="grid min-h-[24rem] flex-1 place-items-center bg-[#0d1014]">
        <div className="aspect-square h-2/3 max-w-2xl animate-pulse rounded-md bg-[#1d2127]" />
      </div>
      <div className="space-y-3 border-t border-[#2a3038] bg-[#171a1f] p-3 lg:border-l lg:border-t-0">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="h-16 animate-pulse rounded-md bg-[#1d2127]" key={index} />
        ))}
      </div>
    </main>
  );
}
