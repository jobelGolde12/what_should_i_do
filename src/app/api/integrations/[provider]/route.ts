import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import { deleteIntegration, isIntegrationProvider } from "@/lib/integrations";
import { logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Disconnects a provider integration (revokes + deletes the stored tokens). */
export async function DELETE(
  _request: Request,
  { params }: { params: { provider: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const denied = await proGate(userId);
  if (denied) return denied;

  const { provider } = params;
  if (!isIntegrationProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  await deleteIntegration(userId, provider);
  logInfo("integrations", { event: "oauth_disconnected", userId, provider });
  return NextResponse.json({ ok: true });
}
