/**
 * OAuth handshake state (PKCE + state nonce) for provider integrations.
 *
 * The pending flow is stored in `user_settings` under `oauth.state.<nonce>`
 * (bound to the signed-in user) and consumed — deleted — by the callback,
 * so a stolen state can't be replayed and callbacks require a session.
 */
import { randomBytes } from "crypto";
import { getSettings, upsertSetting, deleteSetting } from "@/lib/auth/users";
import {
  buildAuthorizeUrl,
  type IntegrationProvider,
  type OAuthConfig,
  pkcePair,
} from "@/lib/integrations";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function oauthStateKey(state: string): string {
  return `oauth.state.${state}`;
}

export type PendingOAuth = {
  provider: IntegrationProvider;
  verifier: string;
  userId: string;
  createdAt: number;
};

/** Stores a fresh state nonce + PKCE verifier and builds the authorize URL. */
export async function beginOAuth(
  userId: string,
  config: OAuthConfig
): Promise<{ state: string; authorizeUrl: string }> {
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = pkcePair();
  const pending: PendingOAuth = {
    provider: config.provider,
    verifier,
    userId,
    createdAt: Date.now(),
  };
  await upsertSetting(userId, oauthStateKey(state), pending);
  return {
    state,
    authorizeUrl: buildAuthorizeUrl(config, { state, codeChallenge: challenge }),
  };
}

/**
 * Validates + consumes a pending OAuth state for the session user. Returns the
 * PKCE verifier on success, or `null` for unknown / expired / mismatched state.
 */
export async function consumeOAuthState(
  userId: string,
  state: string,
  provider: IntegrationProvider
): Promise<string | null> {
  const settings = await getSettings(userId);
  const key = oauthStateKey(state);
  const raw = settings[key];
  await deleteSetting(userId, key);
  if (!raw || typeof raw !== "object") return null;
  const pending = raw as Partial<PendingOAuth>;
  if (pending.provider !== provider) return null;
  if (pending.userId !== userId) return null;
  if (typeof pending.createdAt !== "number") return null;
  if (Date.now() - pending.createdAt > OAUTH_STATE_TTL_MS) return null;
  return typeof pending.verifier === "string" && pending.verifier.length > 0
    ? pending.verifier
    : null;
}
