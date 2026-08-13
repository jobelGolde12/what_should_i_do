import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import {
  planForUser,
  subscriptionForUser,
} from "@/lib/pro/entitlements";
import type { PlanTier } from "@/lib/pro/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  const plan: PlanTier = await planForUser(userId);
  if (!userId) {
    return NextResponse.json({ plan });
  }

  const sub = await subscriptionForUser(userId);
  return NextResponse.json({
    plan,
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
  });
}
