export default function ProjectCanvasLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="画布加载中"
      className="min-h-[calc(100vh-4rem)]"
    >
      <div className="container py-12 lg:py-16">
        <div className="space-y-6">
          <div className="h-8 w-56 animate-pulse rounded-2xl bg-secondary" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="aspect-video animate-pulse rounded-3xl bg-secondary/70" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-16 animate-pulse rounded-2xl bg-secondary/70"
                  key={index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
