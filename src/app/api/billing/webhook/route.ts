import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/pro/stripe";
import {
  setUserPlan,
  userIdByStripeCustomer,
} from "@/lib/pro/entitlements";
import { billingConfigured, webhooksConfigured } from "@/lib/pro/billing";
import { getDb, ensureSchema } from "@/lib/db";
import { sendMail } from "@/lib/mailgun";
import { logWarn, logInfo } from "@/lib/log";
import type { SubscriptionStatus } from "@/lib/pro/plans";

export const runtime = "nodejs";

async function markProcessed(eventId: string): Promise<boolean> {
  const database = await ensureSchema().then(() => getDb());
  const res = await database.execute(
    "INSERT OR IGNORE INTO webhook_events(id, processed_at) VALUES (?, ?)",
    [eventId, Date.now()]
  );
  return Number(res.rowsAffected) > 0;
}

type StripeSubscription = Stripe.Subscription;

function toSubscriptionStatus(status: StripeSubscription["status"]): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
      return status;
    default:
      return "canceled";
  }
}

function subscriptionPlanFields(sub: StripeSubscription) {
  return {
    status: toSubscriptionStatus(sub.status),
    priceId: sub.items?.data?.[0]?.price?.id ?? null,
    currentPeriodEnd: sub.current_period_end ?? null,
    stripeSubscriptionId: sub.id,
  };
}

export async function POST(request: Request) {
  if (!billingConfigured() || !webhooksConfigured()) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = await constructWebhookEvent(raw, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    logWarn("billing", { action: "webhook", error: message });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Idempotency: ignore events we've already processed.
  if (!(await markProcessed(event.id))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (userId && session.subscription) {
          const sub = session.subscription as string;
          await setUserPlan(userId, "pro", {
            status: "active",
            priceId: session.metadata?.priceId ?? null,
            stripeCustomerId: (session.customer as string) ?? "",
            stripeSubscriptionId: sub,
          });
          logInfo("billing", { event: "checkout.completed", userId });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as StripeSubscription;
        const userId = await userIdByStripeCustomer(sub.customer as string);
        if (!userId) break;
        const plan = sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
        await setUserPlan(userId, plan, {
          ...subscriptionPlanFields(sub),
          stripeCustomerId: sub.customer as string,
        });
        logInfo("billing", { event: "subscription.updated", userId, status: sub.status });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as StripeSubscription;
        const userId = await userIdByStripeCustomer(sub.customer as string);
        if (!userId) break;
        await setUserPlan(userId, "free", {
          status: "canceled",
          stripeCustomerId: sub.customer as string,
        });
        logInfo("billing", { event: "subscription.deleted", userId });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const userId = await userIdByStripeCustomer(invoice.customer as string);
          if (userId && invoice.customer_email) {
            await sendMail(
              invoice.customer_email,
              "TaskMind Pro — payment issue",
              "We couldn't process your Pro payment. Please update your payment method to keep Pro active."
            );
          }
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logWarn("billing", { action: "webhook_apply", event: event.type, error: message });
  }

  return NextResponse.json({ received: true });
}
