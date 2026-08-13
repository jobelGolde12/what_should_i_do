import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/cookies";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { createCheckoutSession } from "@/lib/pro/stripe";
import { billingConfigured, billingUnavailable, resolvePriceId } from "@/lib/pro/billing";
import { logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { price?: unknown };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!billingConfigured()) return billingUnavailable();

  const rl = rateLimit(getClientIp(request), 10);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  let price: string | null = null;
  try {
    const body = (await request.json()) as Body;
    if (typeof body.price === "string") {
      price = resolvePriceId(body.price);
    }
  } catch {
    /* handled below */
  }
  if (!price) {
    return NextResponse.json(
      { error: "Choose a valid plan (monthly or annual)." },
      { status: 400 }
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

  try {
    const session = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      priceId: price,
      successUrl: `${appUrl}/settings?checkout=success`,
      cancelUrl: `${appUrl}/settings?checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logWarn("billing", { action: "checkout", error: message, userId: user.id });
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 502 }
    );
  }
}
