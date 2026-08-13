import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { ensureInboundRoute, inboundAddress } from "@/lib/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns the user's private forward-to-TaskMind address. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const slug = await ensureInboundRoute(userId);
  return NextResponse.json({ address: inboundAddress(slug) });
}
