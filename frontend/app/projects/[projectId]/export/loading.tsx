export default function ProjectExportLoading() {
  return (
    <main className="min-h-screen">
      <section className="container py-12 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="h-6 w-40 animate-pulse rounded-full bg-primary/20" />
            <div className="space-y-4">
              <div className="h-4 w-60 animate-pulse rounded-full bg-secondary" />
              <div className="h-16 max-w-3xl animate-pulse rounded-3xl bg-secondary" />
              <div className="h-20 max-w-2xl animate-pulse rounded-3xl bg-secondary/70" />
            </div>
          </div>
          <div className="ad-panel rounded-2xl p-6">
            <div className="h-7 w-48 animate-pulse rounded-full bg-secondary" />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-24 animate-pulse rounded-2xl border border-border bg-card"
                  key={index}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container grid gap-6 pb-16 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="ad-panel rounded-2xl p-6">
          <div className="aspect-video animate-pulse rounded-[2rem] bg-secondary/50" />
          <div className="mt-5 h-11 w-48 animate-pulse rounded-2xl bg-primary/20" />
        </div>
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <div className="ad-panel rounded-2xl p-6" key={index}>
              <div className="h-7 w-44 animate-pulse rounded-full bg-secondary" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: 4 }).map((__, rowIndex) => (
                  <div
                    className="h-16 animate-pulse rounded-2xl bg-card"
                    key={rowIndex}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
