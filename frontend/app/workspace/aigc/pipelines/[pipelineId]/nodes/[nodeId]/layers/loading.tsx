export default function AigcLayerEditorLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="AIGC 图层编辑器加载中"
      className="grid h-[calc(100dvh-4rem)] grid-cols-[3.25rem_minmax(0,1fr)_20rem]"
    >
      <div className="border-r bg-card" />
      <div className="grid place-items-center bg-secondary/20">
        <div className="aspect-square h-2/3 max-w-2xl animate-pulse rounded-lg bg-secondary" />
      </div>
      <div className="space-y-3 border-l bg-card p-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="h-16 animate-pulse rounded-lg bg-secondary" key={index} />
        ))}
      </div>
    </main>
  );
}
