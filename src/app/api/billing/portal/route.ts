import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { proGate, subscriptionForUser } from "@/lib/pro/entitlements";
import { createPortalSession } from "@/lib/pro/stripe";
import { billingConfigured, billingUnavailable } from "@/lib/pro/billing";
import { logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!billingConfigured()) return billingUnavailable();

  const denied = await proGate(user.id);
  if (denied) return denied;

  const rl = rateLimit(getClientIp(request), 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  const sub = await subscriptionForUser(user.id);
  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No subscription found for this account." },
      { status: 400 }
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

  try {
    const session = await createPortalSession({
      customerId: sub.stripeCustomerId,
      returnUrl: `${appUrl}/settings?portal=return`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logWarn("billing", { action: "portal", error: message, userId: user.id });
    return NextResponse.json(
      { error: "Couldn't open the billing portal. Please try again." },
      { status: 502 }
    );
  }
}
