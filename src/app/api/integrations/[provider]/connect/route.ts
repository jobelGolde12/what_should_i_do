import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { proGate } from "@/lib/pro/entitlements";
import {
  isIntegrationProvider,
  providerConfig,
} from "@/lib/integrations";
import { beginOAuth } from "@/lib/oauth";
import { logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts an OAuth connect flow for a provider. The user is redirected to the
 * provider's authorize page with a state nonce + PKCE challenge; the pending
 * flow (verifier bound to this user) is stored in `user_settings`.
 */
export async function GET(
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
  const config = providerConfig(provider);
  if (!config) {
    return NextResponse.json(
      { error: "This provider isn't configured." },
      { status: 400 }
    );
  }

  const { authorizeUrl } = await beginOAuth(userId, config);
  logInfo("integrations", { event: "oauth_start", userId, provider });
  return NextResponse.redirect(authorizeUrl);
}
