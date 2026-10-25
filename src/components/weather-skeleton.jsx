function Block({ className }) {
  return <span aria-hidden="true" className={`skeleton-block ${className || ""}`} />;
}

function Panel({ className, children }) {
  return (
    <div className={`surface-card p-4 sm:p-5 ${className || ""}`} aria-hidden="true">
      {children}
    </div>
  );
}

export default function WeatherSkeleton({ message = "Loading the latest forecast" }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-3 md:space-y-4">
      <span className="sr-only">{message}</span>

      <div className="grid gap-3 md:gap-4 lg:grid-cols-12">
        <div
          aria-hidden="true"
          className="hero-surface relative flex min-h-[29rem] flex-col overflow-hidden rounded-[1.85rem] p-5 shadow-[var(--shadow-soft)] sm:p-7 md:rounded-[2.4rem] md:p-8 lg:col-span-7 lg:min-h-[32rem] xl:col-span-8 lg:p-9"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Block className="h-2.5 w-20 opacity-30" />
              <Block className="h-3 w-36 opacity-20" />
            </div>
            <Block className="h-2.5 w-24 opacity-20" />
          </div>
          <div className="mt-10 flex flex-1 items-center justify-between gap-4">
            <div>
              <Block className="h-[5.5rem] w-[8.5rem] opacity-25 sm:h-[7rem] sm:w-[11rem]" />
              <Block className="mt-6 h-6 w-44 opacity-20" />
              <Block className="mt-4 h-4 w-52 opacity-15" />
            </div>
            <Block className="aspect-square w-[7.5rem] rounded-[2.5rem] opacity-20 sm:w-[15rem]" />
          </div>
          <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--hero-line)" }}>
            <Block className="h-3 w-2/3 opacity-20" />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:gap-4 lg:col-span-5 xl:col-span-4">
          <Panel className="min-h-[15rem]">
            <div className="flex justify-between gap-4">
              <div className="space-y-2">
                <Block className="h-2.5 w-24" />
                <Block className="h-5 w-36" />
              </div>
              <Block className="h-6 w-20" />
            </div>
            <Block className="mx-auto mt-7 h-28 w-56 rounded-t-[8rem] rounded-b-none" />
            <div className="mt-4 flex justify-between gap-4">
              <Block className="h-8 w-20" />
              <Block className="h-8 w-20" />
            </div>
          </Panel>
          <Panel className="min-h-[17rem]">
            <div className="space-y-2">
              <Block className="h-2.5 w-20" />
              <Block className="h-5 w-40" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Block key={index} className="h-16 rounded-2xl" />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Block className="h-2.5 w-20" />
            <Block className="h-6 w-44" />
          </div>
          <Block className="hidden h-9 w-20 sm:block" />
        </div>
        <div className="mt-5 flex gap-2 overflow-hidden">
          {Array.from({ length: 12 }).map((_, index) => (
            <Block key={index} className="h-[7.65rem] w-[4.85rem] shrink-0 rounded-2xl sm:w-[5.35rem]" />
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="space-y-2">
          <Block className="h-2.5 w-20" />
          <Block className="h-6 w-48" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, index) => (
            <Block key={index} className="h-[10.6rem] rounded-[1.25rem]" />
          ))}
        </div>
      </Panel>
    </div>
  );
}
