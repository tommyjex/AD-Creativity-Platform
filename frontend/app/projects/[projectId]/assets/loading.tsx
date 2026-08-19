export default function ProjectAssetsLoading() {
  return (
    <main className="min-h-screen">
      <section className="container py-12 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="h-6 w-40 animate-pulse rounded-full bg-primary/20" />
            <div className="space-y-4">
              <div className="h-4 w-56 animate-pulse rounded-full bg-secondary" />
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

      <section className="container grid gap-4 pb-16 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            className="h-80 animate-pulse rounded-3xl border border-border bg-card"
            key={index}
          />
        ))}
      </section>
    </main>
  );
}
