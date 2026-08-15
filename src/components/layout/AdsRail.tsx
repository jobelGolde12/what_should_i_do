"use client";

import { useEffect, useRef, useState } from "react";
import {
  AD_CLIENT,
  AD_SLOT,
  ADS_CONSENT_EVENT,
  hasAdsConfig,
  adsConsented,
  loadAdSenseScript,
  pushAd,
} from "@/lib/ads";

type AdUnitProps = {
  className?: string;
  id?: string;
};

function AdUnit({ className = "", id = "ad-unit" }: AdUnitProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () =>
      typeof window !== "undefined" && !("IntersectionObserver" in window)
  );
  // Bumped whenever the visitor's consent changes so the unit re-evaluates
  // (once consent is granted we can render + fill the real ad, and we stop if
  // consent is revoked later).
  const [consentTick, setConsentTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onConsent = () => setConsentTick((t) => t + 1);
    window.addEventListener(ADS_CONSENT_EVENT, onConsent);
    window.addEventListener("storage", onConsent);
    return () => {
      window.removeEventListener(ADS_CONSENT_EVENT, onConsent);
      window.removeEventListener("storage", onConsent);
    };
  }, []);

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
      { rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const configReady = hasAdsConfig();
  // Re-read on every render (including after a consent change) so the correct
  // branch renders immediately when the visitor enables or revokes ads.
  const consented = adsConsented();

  // When visible and configured + consented, inject the loader lazily and
  // ask the network to fill the mounted unit once the loader is ready.
  useEffect(() => {
    if (!visible || !configReady || !consented) return;
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void loadAdSenseScript().then(() => {
      if (cancelled) return;
      timer = setTimeout(() => {
        const ins = node.querySelector<HTMLElement>("ins.adsbygoogle");
        if (ins) pushAd(ins);
      }, 120);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `consentTick` is included so the unit re-attempts fill (and stops)
    // whenever the visitor's consent state changes.
  }, [visible, configReady, consented, consentTick]);

  const sponsoredLabel = (
    <p className="mb-2 font-mono text-xxs uppercase tracking-label text-muted">
      Sponsored
    </p>
  );

  return (
    <div ref={ref} className={className}>
      {configReady && consented ? (
        <>
          {sponsoredLabel}
          <div className="min-h-[250px] w-full overflow-hidden border border-line bg-surface">
            <ins
              id={id}
              className="adsbygoogle block min-h-[250px] w-full"
              style={{ display: "block" }}
              data-ad-client={AD_CLIENT}
              data-ad-slot={AD_SLOT}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        </>
      ) : visible ? (
        <div
          aria-hidden="true"
          className="flex min-h-[250px] w-full flex-col items-center justify-center gap-2 border border-dashed border-line bg-surface"
        >
          <p className="text-xs text-muted">Advertisement</p>
          <p className="font-mono text-xxs uppercase tracking-label text-muted">
            Slot available
          </p>
          <p className="font-mono text-xxs uppercase tracking-label text-muted">
            Remove ads with Pro
          </p>
        </div>
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
          <AdUnit id="ad-rail-1" />
        </div>
        <div className="border-t-2 border-ink pt-3">
          <AdUnit id="ad-rail-2" />
        </div>
      </div>
    </aside>
  );
}

export function AdBlock() {
  return (
    <div className="mt-10 border-t-2 border-ink pt-4 lg:hidden">
      <AdUnit className="mx-auto max-w-[336px]" id="ad-block-1" />
    </div>
  );
}
