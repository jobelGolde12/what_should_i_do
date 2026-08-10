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

let scriptPromise: Promise<void> | null = null;

/**
 * Injects the AdSense loader exactly once, lazily. Resolves once the script
 * has loaded (or failed — pushAd will simply no-op then) so callers can push
 * their unit after `window.adsbygoogle` is actually available.
 */
export function loadAdSenseScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.adsbygoogle) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      AD_CLIENT
    )}`;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return scriptPromise;
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
