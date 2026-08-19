export default function ProjectDetailLoading() {
  return (
    <main aria-busy="true" aria-label="项目详情加载中" className="min-h-screen">
      <section className="container py-12 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-7">
            <div className="space-y-5">
              <div className="h-6 w-48 animate-pulse rounded-full bg-secondary" />
              <div className="space-y-4">
                <div className="h-3 w-40 animate-pulse rounded-full bg-secondary/70" />
                <div className="h-12 w-3/4 animate-pulse rounded-2xl bg-secondary" />
                <div className="space-y-2">
                  <div className="h-4 w-full max-w-3xl animate-pulse rounded-full bg-secondary/70" />
                  <div className="h-4 w-5/6 max-w-2xl animate-pulse rounded-full bg-secondary/70" />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="h-11 w-full animate-pulse rounded-2xl bg-secondary sm:w-36" />
                <div className="h-11 w-full animate-pulse rounded-2xl bg-secondary sm:w-40" />
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="h-5 w-32 animate-pulse rounded-full bg-secondary" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    className="h-16 animate-pulse rounded-2xl bg-secondary/70"
                    key={index}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="border-b border-border p-6">
              <div className="h-6 w-20 animate-pulse rounded-full bg-secondary" />
              <div className="mt-4 h-8 w-2/3 animate-pulse rounded-2xl bg-secondary" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-secondary/70" />
            </div>
            <div className="grid gap-3 p-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  className="h-20 animate-pulse rounded-2xl bg-secondary/70"
                  key={index}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container grid gap-6 pb-8 xl:grid-cols-[1.1fr_0.9fr]">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            className="overflow-hidden rounded-3xl border border-border bg-card"
            key={index}
          >
            <div className="border-b border-border p-6">
              <div className="h-6 w-40 animate-pulse rounded-full bg-secondary" />
              <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded-full bg-secondary/70" />
            </div>
            <div className="space-y-4 p-6">
              {Array.from({ length: 3 }).map((_, row) => (
                <div
                  className="h-24 animate-pulse rounded-3xl border border-border bg-secondary/40"
                  key={row}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
