export default function WorkspaceAssetsLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="资产库加载中"
      className="w-full max-w-none px-3 py-6 sm:px-4 sm:py-8 lg:px-5"
    >
      <div className="border-b border-border pb-7">
        <div className="h-3 w-32 animate-pulse rounded-full bg-secondary" />
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="h-9 w-40 animate-pulse rounded-2xl bg-secondary" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-secondary/70" />
          </div>
          <div className="h-6 w-24 animate-pulse rounded-full bg-secondary" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row">
        <div className="flex shrink-0 gap-2 lg:w-56 lg:flex-col lg:gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              className="h-11 flex-1 animate-pulse rounded-xl bg-secondary lg:flex-none"
              key={index}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-10 animate-pulse rounded-xl bg-secondary" />
            <div className="h-10 animate-pulse rounded-xl bg-secondary" />
          </div>
          <div className="mt-4 h-10 animate-pulse rounded-xl bg-secondary" />

          <div className="mt-7 space-y-3">
            <div className="h-6 w-28 animate-pulse rounded-full bg-secondary" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded-full bg-secondary/70" />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                className="overflow-hidden rounded-2xl border border-border bg-card"
                key={index}
              >
                <div className="aspect-[16/10] animate-pulse bg-secondary" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded-full bg-secondary" />
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="h-3 w-full animate-pulse rounded-full bg-secondary/70" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-secondary/70" />
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-secondary/70" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
