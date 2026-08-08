"use client";

import { useEffect, useRef, useState } from "react";

const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

function AdUnit({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () =>
      typeof window !== "undefined" && !("IntersectionObserver" in window)
  );

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const label = (
    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
      Sponsored
    </p>
  );

  return (
    <div ref={ref} className={className}>
      {label}
      {visible ? (
        AD_CLIENT ? (
          <div
            className="min-h-[250px] w-full border border-line bg-surface"
            data-ad-client={AD_CLIENT}
          >
            <div className="flex min-h-[250px] items-center justify-center">
              <p className="px-4 text-center text-xs text-muted">
                Advertisement
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[250px] w-full flex-col items-center justify-center gap-2 border border-dashed border-line bg-surface">
            <p className="text-xs text-muted">Advertisement</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted/70">
              Slot available
            </p>
          </div>
        )
      ) : (
        <div className="min-h-[250px] w-full border border-dashed border-line bg-surface" />
      )}
    </div>
  );
}

export function AdsRail() {
  return (
    <aside className="hidden w-[25vw] shrink-0 lg:block" aria-label="Sponsored content">
      <div className="sticky top-6 space-y-6">
        <div className="border-t-2 border-ink pt-3">
          <AdUnit />
        </div>
        <div className="border-t-2 border-ink pt-3">
          <AdUnit />
        </div>
      </div>
    </aside>
  );
}

export function AdBlock() {
  return (
    <div className="mt-10 border-t-2 border-ink pt-4 lg:hidden">
      <AdUnit className="mx-auto max-w-[336px]" />
    </div>
  );
}
