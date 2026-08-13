/**
 * Thin Stripe client wrapper. Lazily instantiated so the app boots without a
 * Stripe key; every accessor throws a clear, catchable error when billing is
 * not configured so routes can return a 503 instead of crashing.
 *
 * Server-only — never import from client components.
 */
import Stripe from "stripe";
import { billingConfigured } from "./billing";

let client: Stripe | null = null;

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !billingConfigured()) {
    throw new Error("Stripe is not configured (missing STRIPE_SECRET_KEY).");
  }
  if (!client) {
    client = new Stripe(key, {
      typescript: true,
    });
  }
  return client;
}

export function getStripe(): Stripe {
  return stripe();
}

export async function createCheckoutSession(opts: {
  userId: string;
  userEmail: string;
  priceId: string;
  mode?: Stripe.Checkout.SessionCreateParams["mode"];
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const session = await stripe().checkout.sessions.create({
    mode: opts.mode ?? "subscription",
    line_items: [{ price: opts.priceId, quantity: 1 }],
    customer_email: opts.userEmail,
    client_reference_id: opts.userId,
    subscription_data:
      opts.mode === "subscription"
        ? { metadata: { userId: opts.userId } }
        : undefined,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { userId: opts.userId },
  });
  return session;
}

export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return stripe().billingPortal.sessions.create({
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
}

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("Stripe webhook secret is not configured.");
  }
  return stripe().webhooks.constructEvent(payload, signature, secret);
}
