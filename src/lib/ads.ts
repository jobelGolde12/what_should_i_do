import { readStorage, writeStorage, storageKeys } from "./storage";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "";

/**
 * Custom event name broadcast whenever the visitor's ad consent changes.
 * Components that render ad units subscribe to this so they can re-evaluate
 * and start loading ads the moment consent is granted (or stop if revoked).
 */
export const ADS_CONSENT_EVENT = "taskmind:ads-consent-changed";

/** Storage key flag used to hide the consent banner after it is dismissed. */
export const ADS_BANNER_DISMISSED_KEY = "taskmind:ads-banner-dismissed";

export function hasAdsConfig(): boolean {
  return Boolean(AD_CLIENT && AD_SLOT);
}

/** Consent gate — ads only load after the visitor consents. */
export function adsConsented(): boolean {
  return readStorage<boolean>(storageKeys().adsConsent, false) ?? false;
}

export function setAdsConsent(consented: boolean): void {
  writeStorage(storageKeys().adsConsent, consented);
}

let scriptInjected = false;

/** Injects the AdSense loader exactly once, lazily. */
export function loadAdSenseScript(): void {
  if (scriptInjected) return;
  if (typeof window === "undefined") return;
  if (window.adsbygoogle) {
    scriptInjected = true;
    return;
  }
  scriptInjected = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
    AD_CLIENT
  )}`;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

const pushedUnits = new WeakSet<HTMLElement>();

/**
 * Signals AdSense that a mounted ad unit is ready to fill. Each unit is only
 * pushed once; errors are swallowed so a broken unit never breaks the page.
 */
export function pushAd(unit: HTMLElement): void {
  try {
    if (pushedUnits.has(unit)) return;
    if (!window.adsbygoogle) return;
    pushedUnits.add(unit);
    window.adsbygoogle.push({});
  } catch {
    /* ads are non-critical */
  }
}
