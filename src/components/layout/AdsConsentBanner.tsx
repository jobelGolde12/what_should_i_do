"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  ADS_CONSENT_EVENT,
  ADS_BANNER_DISMISSED_KEY,
  hasAdsConfig,
  adsConsented,
  setAdsConsent,
} from "@/lib/ads";
import { readStorage, writeStorage } from "@/lib/storage";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

/**
 * Non-intrusive opt-in banner shown when ads are configured but the visitor
 * has not yet granted ad consent. Granting consent enables the real AdSense
 * units to render and load; the visitor can also decline (banner is dismissed
 * and ads stay off) or remove ads entirely via the Pro tier.
 *
 * Because ad units subscribe to the broadcast ADS_CONSENT_EVENT, granting
 * consent here immediately flips the AdsRail / AdBlock placeholders into real,
 * fillable ads — this is what makes ads actually display.
 */
export default function AdsConsentBanner() {
  const [show, setShow] = useState(false);
  const configReady = hasAdsConfig();

  useEffect(() => {
    if (!configReady) return;
    const evaluate = () => {
      const dismissed = readStorage<boolean>(
        ADS_BANNER_DISMISSED_KEY,
        false
      );
      // Only show while ads are configured, not yet consented, and not dismissed.
      setShow(!adsConsented() && !dismissed);
    };
    evaluate();
    window.addEventListener(ADS_CONSENT_EVENT, evaluate);
    return () => window.removeEventListener(ADS_CONSENT_EVENT, evaluate);
  }, [configReady]);

  if (!configReady || !show) return null;

  const enableAds = () => {
    setAdsConsent(true);
    window.dispatchEvent(
      new CustomEvent(ADS_CONSENT_EVENT, { detail: { consented: true } })
    );
    setShow(false);
  };

  const dismiss = () => {
    writeStorage(ADS_BANNER_DISMISSED_KEY, true);
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label="Advertising consent"
      className="border-b border-line bg-surface"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
            <span className="font-semibold text-ink">
              Support {process.env.NEXT_PUBLIC_APP_NAME ?? "TaskMind"}
            </span>{" "}
            — this site is free thanks to ads.{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-ink"
            >
              Privacy
            </Link>
            {" · "}
            <Link
              href="/terms"
              className="underline underline-offset-2 hover:text-ink"
            >
              Terms
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="primary" onClick={enableAds}>
            Enable ads
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={dismiss}
            aria-label="No thanks"
          >
            No thanks
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-tm p-1 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
