/**
 * High-fidelity route skeletons — layout placeholders only.
 * No spinners, progress bars, or "Loading…" text.
 */

function Bone({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-tm bg-surface-2 ${className}`}
    />
  );
}

function SkeletonHeader({
  titleWidth = "w-48",
  kicker = true,
}: {
  titleWidth?: string;
  kicker?: boolean;
}) {
  return (
    <header className="dot-grid-fade relative mb-8 border-b border-line pb-8">
      <Bone className="h-3 w-24" />
      <Bone className={`mt-3 h-10 ${titleWidth} sm:h-12`} />
      {kicker && <Bone className="mt-4 h-4 w-72 max-w-full" />}
    </header>
  );
}

export function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true">
      <SkeletonHeader titleWidth="w-64" />
      <div className="border border-line bg-surface p-4">
        <Bone className="h-40 w-full" />
        <div className="mt-4 flex justify-end gap-2">
          <Bone className="h-9 w-24" />
          <Bone className="h-9 w-32" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-line p-3">
            <Bone className="h-4 w-4" />
            <Bone className="mt-3 h-3 w-20" />
            <Bone className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true">
      <SkeletonHeader titleWidth="w-40" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Bone className="h-10 flex-1" />
        <div className="flex gap-2">
          <Bone className="h-9 w-20" />
          <Bone className="h-9 w-20" />
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-8 w-16" />
        ))}
      </div>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-start gap-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex gap-2">
                <Bone className="h-5 w-16" />
                <Bone className="h-5 w-20" />
                <Bone className="h-5 w-28" />
              </div>
              <Bone className="mt-2 h-4 w-full" />
              <Bone className="mt-1.5 h-4 w-full max-w-md" />
            </div>
            <Bone className="h-8 w-8 shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SavedSkeleton() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true">
      <SkeletonHeader titleWidth="w-32" />
      <ul className="divide-y divide-line border-y border-line">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-start gap-4 py-4">
            <div className="min-w-0 flex-1">
              <Bone className="h-4 w-40" />
              <Bone className="mt-2 h-4 w-full" />
              <Bone className="mt-1.5 h-4 w-full max-w-sm" />
            </div>
            <div className="flex gap-1.5">
              <Bone className="h-8 w-8" />
              <Bone className="h-8 w-8" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ActionsSkeleton() {
  return (
    <div className="mx-auto max-w-5xl" aria-hidden="true">
      <SkeletonHeader titleWidth="w-44" />
      <div className="mb-4 flex gap-2">
        <Bone className="h-10 flex-1 max-w-xs" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-8 w-14" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, col) => (
          <div key={col} className="border border-line bg-surface p-3">
            <Bone className="mb-3 h-4 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, row) => (
                <div
                  key={row}
                  className="rounded-tm border border-line bg-background p-3"
                >
                  <Bone className="h-3 w-full max-w-[12rem]" />
                  <Bone className="mt-2 h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true">
      <div className="mb-6 flex items-center justify-between">
        <Bone className="h-4 w-28" />
        <Bone className="h-3 w-32" />
      </div>
      <div className="mb-6 border-l-2 border-line bg-surface px-4 py-3">
        <Bone className="h-3 w-24" />
        <Bone className="mt-2 h-4 w-full" />
        <Bone className="mt-1.5 h-4 w-full max-w-lg" />
      </div>
      <div className="space-y-4">
        <div className="border border-line p-4">
          <Bone className="h-4 w-20" />
          <Bone className="mt-3 h-6 w-40" />
        </div>
        <div className="border border-line p-4">
          <Bone className="h-4 w-24" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bone key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="border border-line p-4">
          <Bone className="h-4 w-28" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Bone key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-2xl" aria-hidden="true">
      <SkeletonHeader titleWidth="w-36" kicker={false} />
      {Array.from({ length: 3 }).map((_, section) => (
        <section key={section} className="mt-6 border border-line first:mt-0">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Bone className="h-4 w-4" />
            <Bone className="h-4 w-28" />
          </div>
          <div className="p-5">
            {section === 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Bone key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-full max-w-md" />
                <Bone className="h-9 w-32" />
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function NotFoundSkeleton() {
  return (
    <div className="mx-auto max-w-3xl" aria-hidden="true">
      <SkeletonHeader titleWidth="w-52" />
      <div className="border border-dashed border-line bg-surface px-6 py-16">
        <Bone className="mx-auto h-12 w-12" />
        <Bone className="mx-auto mt-4 h-5 w-48" />
        <Bone className="mx-auto mt-3 h-4 w-72 max-w-full" />
      </div>
    </div>
  );
}

export function RouteSkeleton({
  route,
}: {
  route: string | null;
}) {
  switch (route) {
    case "/":
    case "/dashboard":
      return <HomeSkeleton />;
    case "/history":
      return <HistorySkeleton />;
    case "/saved":
      return <SavedSkeleton />;
    case "/actions":
      return <ActionsSkeleton />;
    case "/analysis/[id]":
    case "/analysis":
      return <AnalysisSkeleton />;
    case "/settings":
      return <SettingsSkeleton />;
    default:
      return <NotFoundSkeleton />;
  }
}
