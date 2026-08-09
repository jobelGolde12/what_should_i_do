/**
 * Feature flags for instant navigation architecture.
 * Flip INSTANT_NAV_ENABLED to false for passthrough rollback
 * (App Router + existing Suspense only; no prefetch/skeleton management).
 */
export const INSTANT_NAV_ENABLED = true;

export function isInstantNavEnabled(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_INSTANT_NAV === "0") {
    return false;
  }
  return INSTANT_NAV_ENABLED;
}
