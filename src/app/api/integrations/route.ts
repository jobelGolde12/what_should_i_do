import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { listIntegrations } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists the user's connected provider integrations (no tokens). */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const integrations = await listIntegrations(userId);
  return NextResponse.json({
    integrations: integrations.map((i) => ({
      provider: i.provider,
      externalId: i.externalId,
      scopes: i.scopes,
      connectedAt: i.connectedAt,
    })),
  });
}
