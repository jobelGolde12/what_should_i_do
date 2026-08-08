const PENDING_TEMPLATE_KEY = "taskmind:pending-template";

/**
 * Reliable template apply flow: stash the content in sessionStorage before
 * navigating to the dashboard, and let the dashboard consume it on mount.
 * Avoids the previous router.push + setTimeout + custom-event race.
 */
export function storePendingTemplate(content: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_TEMPLATE_KEY, content);
  } catch {
    /* sessionStorage unavailable */
  }
}

export function consumePendingTemplate(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = sessionStorage.getItem(PENDING_TEMPLATE_KEY);
    if (value !== null) sessionStorage.removeItem(PENDING_TEMPLATE_KEY);
    return value;
  } catch {
    return null;
  }
}
