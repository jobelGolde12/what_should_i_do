/**
 * Entitlements & gating — decides who gets what.
 *
 * Server side: `planForUser` / `limitsForUser` read the `subscriptions` table
 * (written by the billing webhook) so a user can be flipped to Pro in the DB to
 * dry-run features without Stripe. `proGate` returns a 403 Response for
 * non-Pro callers on Pro-only endpoints.
 *
 * Client side: `usePlan` derives the tier from AuthContext's plan state and
 * exposes the matching limits for UX (gating UI). The client is never trusted
 * for enforcement — server routes always check again.
 */
import { getDb, ensureSchema } from "@/lib/db";
import {
  type PlanTier,
  type PlanLimits,
  type SubscriptionStatus,
  PRO_GRANTING_STATUSES,
  limitsForTier,
} from "./plans";

async function db() {
  await ensureSchema();
  return getDb();
}

type SubscriptionRow = {
  plan: PlanTier;
  status: SubscriptionStatus;
  current_period_end: number | null;
  stripeCustomerId: string | null;
};

async function getSubscription(userId: string): Promise<SubscriptionRow | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT plan, status, current_period_end, stripe_customer_id FROM subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
    [userId]
  );
  if (!res.rows?.length) return null;
  const row = res.rows[0] as Record<string, unknown>;
  return {
    plan: (row.plan as PlanTier) ?? "free",
    status: (row.status as SubscriptionStatus) ?? "free",
    current_period_end:
      row.current_period_end == null ? null : Number(row.current_period_end),
    stripeCustomerId:
      row.stripe_customer_id == null || row.stripe_customer_id === ""
        ? null
        : (row.stripe_customer_id as string),
  };
}

/** Resolves the effective tier for a user (null = anonymous = free). */
export async function planForUser(userId: string | null): Promise<PlanTier> {
  if (!userId) return "free";
  const sub = await getSubscription(userId);
  if (
    sub &&
    sub.plan === "pro" &&
    PRO_GRANTING_STATUSES.includes(sub.status)
  ) {
    return "pro";
  }
  return "free";
}

export async function isProUser(userId: string | null): Promise<boolean> {
  return (await planForUser(userId)) === "pro";
}

export async function limitsForUser(
  userId: string | null
): Promise<PlanLimits> {
  return limitsForTier(await planForUser(userId));
}

/** Current subscription metadata for display (Settings/billing card). */
export async function subscriptionForUser(
  userId: string
): Promise<SubscriptionRow | null> {
  return getSubscription(userId);
}

/** Maps a Stripe customer id back to its user (webhook handling). */
export async function userIdByStripeCustomer(
  customerId: string
): Promise<string | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT user_id FROM subscriptions WHERE stripe_customer_id = ? LIMIT 1",
    [customerId]
  );
  if (!res.rows?.length) return null;
  return res.rows[0].user_id as string;
}

/**
 * Returns a 403 JSON Response when the caller is not a Pro user, or `null`
 * when they are allowed. Use at the top of Pro-only route handlers.
 */
export async function proGate(userId: string | null): Promise<Response | null> {
  if (await isProUser(userId)) return null;
  return Response.json(
    {
      error: "This feature requires TaskMind Pro.",
      code: "PRO_REQUIRED",
    },
    { status: 403 }
  );
}

/** Writes the plan state for a user (billing webhook + dry-run/testing). */
export async function setUserPlan(
  userId: string,
  plan: PlanTier,
  opts: {
    status?: SubscriptionStatus;
    priceId?: string | null;
    currentPeriodEnd?: number | null;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  } = {}
): Promise<void> {
  const database = await db();
  await database.execute(
    `INSERT INTO subscriptions(user_id, stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end, plan, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id,
       status = excluded.status,
       price_id = excluded.price_id,
       current_period_end = excluded.current_period_end,
       plan = excluded.plan,
       updated_at = excluded.updated_at`,
    [
      userId,
      opts.stripeCustomerId ?? "",
      opts.stripeSubscriptionId ?? "",
      opts.status ?? "free",
      opts.priceId ?? null,
      opts.currentPeriodEnd ?? null,
      plan,
      Date.now(),
    ]
  );
}
