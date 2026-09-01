export default function WorkspaceToolsLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="工具工作台加载中"
      className="w-full max-w-none px-3 py-6 sm:px-4 sm:py-8 lg:px-5"
    >
      <div className="border-b border-border pb-6">
        <div className="h-3 w-36 animate-pulse rounded-full bg-secondary" />
        <div className="mt-3 h-9 w-32 animate-pulse rounded-2xl bg-secondary" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded-full bg-secondary/70" />
      </div>
      <div className="mt-6 h-12 w-full max-w-xl animate-pulse rounded-xl bg-secondary sm:w-[30rem]" />
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {[0, 1].map((index) => (
          <div className="min-h-[24rem] animate-pulse rounded-2xl border border-border bg-card/60 p-6" key={index}>
            <div className="h-5 w-36 rounded-full bg-secondary" />
            <div className="mt-3 h-4 w-64 max-w-full rounded-full bg-secondary/70" />
            <div className="mt-8 space-y-4">
              <div className="h-10 rounded-lg bg-secondary" />
              <div className="h-10 rounded-lg bg-secondary" />
              <div className="h-24 rounded-lg bg-secondary/70" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
