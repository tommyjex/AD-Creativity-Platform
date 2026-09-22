const skeletonRatios = [
  "aspect-[4/5]",
  "aspect-video",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[4/3]",
  "aspect-[9/14]",
  "aspect-square",
  "aspect-video",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-[4/3]",
  "aspect-square"
];

export default function Loading() {
  return (
    <main
      aria-label="正在加载创意产物"
      className="min-h-[calc(100dvh-4rem)] bg-[#080a0d] text-slate-100"
    >
      <section className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="mb-6 border-b border-white/10 pb-6">
          <div className="h-3 w-36 animate-pulse rounded bg-cyan-300/15" />
          <div className="mt-4 h-10 w-48 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded bg-white/[0.06]" />
        </div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="h-11 w-full animate-pulse rounded-[6px] bg-white/[0.06] sm:w-72" />
          <div className="h-10 w-full animate-pulse rounded-[6px] bg-white/[0.06] sm:w-64" />
        </div>
        <div className="columns-2 gap-3 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6">
          {skeletonRatios.map((ratio, index) => (
            <div
              className={`mb-3 break-inside-avoid animate-pulse rounded-[6px] border border-white/[0.06] bg-white/[0.045] ${ratio}`}
              key={`${ratio}-${index}`}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
