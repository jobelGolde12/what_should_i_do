/**
 * Billing configuration & validation. Stripe credentials are server-only; the
 * app must keep working (degraded, clearly) when they are not configured —
 * e.g. local dev without keys. `billingConfigured()` is the switch every billing
 * route checks before touching Stripe.
 */

export const STRIPE_PRICE_MONTHLY =
  process.env.STRIPE_PRICE_MONTHLY?.trim() || "";
export const STRIPE_PRICE_ANNUAL =
  process.env.STRIPE_PRICE_ANNUAL?.trim() || "";
export const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET?.trim() || "";

export function billingConfigured(): boolean {
  return (
    Boolean(process.env.STRIPE_SECRET_KEY) &&
    Boolean(STRIPE_PRICE_MONTHLY) &&
    Boolean(STRIPE_PRICE_ANNUAL)
  );
}

export function webhooksConfigured(): boolean {
  return billingConfigured() && Boolean(STRIPE_WEBHOOK_SECRET);
}

/** Standard "billing not configured" response (kept honest + not crashy). */
export function billingUnavailable(): Response {
  return Response.json(
    {
      error: "Payments are not configured yet. Please try again later.",
      code: "BILLING_UNAVAILABLE",
    },
    { status: 503 }
  );
}

/** Resolves a requested price id against the configured catalog. */
export function resolvePriceId(priceId?: string): string | null {
  if (priceId === "monthly") return STRIPE_PRICE_MONTHLY;
  if (priceId === "annual") return STRIPE_PRICE_ANNUAL;
  if (priceId === STRIPE_PRICE_MONTHLY) return STRIPE_PRICE_MONTHLY;
  if (priceId === STRIPE_PRICE_ANNUAL) return STRIPE_PRICE_ANNUAL;
  return null;
}
