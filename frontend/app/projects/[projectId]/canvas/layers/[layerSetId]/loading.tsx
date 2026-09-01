export default function ProjectLayerEditorLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="图层编辑器加载中"
      className="min-h-[calc(100vh-4rem)]"
    >
      <div className="container py-12 lg:py-16">
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-2xl bg-secondary" />
          <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  className="h-12 animate-pulse rounded-2xl bg-secondary/70"
                  key={index}
                />
              ))}
            </div>
            <div className="aspect-square animate-pulse rounded-3xl bg-secondary/70" />
          </div>
        </div>
      </div>
    </main>
  );
}
