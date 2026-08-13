import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/cookies";
import { buildAppUrl } from "@/lib/mailgun";
import {
  encryptSecret,
  exchangeCode,
  isIntegrationProvider,
  providerConfig,
  saveIntegration,
} from "@/lib/integrations";
import { consumeOAuthState } from "@/lib/oauth";
import { logInfo, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth callback: exchanges the authorization code (with the stored PKCE
 * verifier), encrypts the tokens, and saves the integration. The user is
 * redirected back to Settings with a status fragment.
 */
export async function GET(
  request: Request,
  { params }: { params: { provider: string } }
) {
  const { provider } = params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const redirect = (fragment: string) =>
    NextResponse.redirect(buildAppUrl(`/settings#${fragment}`));

  if (!isIntegrationProvider(provider) || !code || !state) {
    return redirect("integrations=error");
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    logWarn("integrations", { event: "oauth_callback_anon", provider });
    return redirect("integrations=auth_required");
  }

  const verifier = await consumeOAuthState(userId, state, provider);
  if (!verifier) {
    logWarn("integrations", { event: "oauth_state_invalid", userId, provider });
    return redirect("integrations=expired");
  }

  const tokens = await exchangeCode(provider, code, verifier);
  if (!tokens || !tokens.refreshToken) {
    logWarn("integrations", { event: "oauth_exchange_failed", userId, provider });
    return redirect("integrations=error");
  }

  await saveIntegration(userId, provider, {
    accessTokenEnc: encryptSecret(tokens.accessToken),
    refreshTokenEnc: encryptSecret(tokens.refreshToken),
    externalId: tokens.externalId ?? undefined,
    scopes: providerConfig(provider)?.scopes ?? [],
  });

  logInfo("integrations", { event: "oauth_connected", userId, provider });
  return redirect("integrations=connected");
}
