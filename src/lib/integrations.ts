/**
 * Email/calendar provider integrations (Pro).
 *
 * - Token encryption at rest: OAuth tokens are AES-256-GCM encrypted with a key
 *   derived from `INTEGRATION_ENCRYPTION_KEY` (falls back to `AUTH_SECRET` in
 *   dev) and stored in the `integrations` table — never plaintext.
 * - OAuth: PKCE + state nonce, minimal scopes. Gmail via the Gmail API,
 *   Outlook via Microsoft Graph.
 * - Provider calls use the native `fetch`; callers pass the integration so this
 *   module stays stateless and testable with a mocked fetch.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { getDb, ensureSchema } from "@/lib/db";
import { buildAppUrl } from "@/lib/mailgun";

export type IntegrationProvider = "gmail" | "outlook";

export const INTEGRATION_PROVIDERS: readonly IntegrationProvider[] = [
  "gmail",
  "outlook",
];

export function isIntegrationProvider(
  value: string
): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(value);
}

export type IntegrationRow = {
  userId: string;
  provider: IntegrationProvider;
  externalId: string;
  scopes: string[];
  connectedAt: number;
  updatedAt: number;
};

/** Integration with decrypted tokens (server-only). */
export type DecryptedIntegration = IntegrationRow & {
  accessToken: string;
  refreshToken: string;
};

export type ProviderMessage = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: number;
};

/* =========================================================
   Encryption at rest
   ========================================================= */

export function integrationEncryptionKey(): Buffer {
  const secret =
    process.env.INTEGRATION_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[integrations] INTEGRATION_ENCRYPTION_KEY is required in production."
      );
    }
    return createHash("sha256").update("dev-only-integration-key").digest();
  }
  return createHash("sha256").update(secret).digest();
}

/** `iv.tag.ciphertext` — all base64. Throws on key/config failure. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", integrationEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

/** Returns `null` on malformed payloads or tampered ciphertext (GCM auth). */
export function decryptSecret(payload: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      integrationEncryptionKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/* =========================================================
   Provider OAuth configuration
   ========================================================= */

export type OAuthConfig = {
  provider: IntegrationProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizeUrl: string;
  tokenUrl: string;
};

/** Resolves provider credentials; `null` when the integration isn't configured. */
export function providerConfig(
  provider: IntegrationProvider
): OAuthConfig | null {
  const redirectUri = buildAppUrl(`/api/integrations/${provider}/callback`);
  if (provider === "gmail") {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      clientId,
      clientSecret,
      redirectUri,
      scopes: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
      ],
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
    };
  }
  const clientId = process.env.OUTLOOK_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) return null;
  return {
    provider,
    clientId,
    clientSecret,
    redirectUri,
    scopes: [
      "https://graph.microsoft.com/Mail.ReadWrite",
      "https://graph.microsoft.com/Mail.Send",
      "offline_access",
    ],
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  };
}

/** PKCE code verifier + S256 challenge. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** Builds the provider's authorize URL with state + PKCE challenge. */
export function buildAuthorizeUrl(
  config: OAuthConfig,
  opts: { state: string; codeChallenge: string }
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

/* =========================================================
   Token exchange & refresh
   ========================================================= */

export type TokenResult = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  externalId: string | null;
};

/** Exchanges an authorization code for tokens (PKCE). */
export async function exchangeCode(
  provider: IntegrationProvider,
  code: string,
  codeVerifier: string
): Promise<TokenResult | null> {
  const config = providerConfig(provider);
  if (!config) return null;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.access_token !== "string") return null;
  return {
    accessToken: data.access_token as string,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : null,
    expiresIn: Number(data.expires_in ?? 3600),
    externalId:
      typeof data.sub === "string" ? (data.sub as string) : null,
  };
}

/** Refreshes an expired access token. */
export async function refreshAccessToken(
  provider: IntegrationProvider,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const config = providerConfig(provider);
  if (!config) return null;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (typeof data.access_token !== "string") return null;
  return {
    accessToken: data.access_token as string,
    expiresIn: Number(data.expires_in ?? 3600),
  };
}

/* =========================================================
   Repository (Turso `integrations` table)
   ========================================================= */

async function db() {
  await ensureSchema();
  return getDb();
}

export async function saveIntegration(
  userId: string,
  provider: IntegrationProvider,
  data: {
    accessTokenEnc: string;
    refreshTokenEnc: string;
    externalId?: string;
    scopes: string[];
  }
): Promise<void> {
  const database = await db();
  const now = Date.now();
  await database.execute(
    "INSERT INTO integrations(user_id, provider, external_id, access_token_enc, refresh_token_enc, scopes, connected_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_id, provider) DO UPDATE SET " +
      "external_id = excluded.external_id, access_token_enc = excluded.access_token_enc, refresh_token_enc = excluded.refresh_token_enc, scopes = excluded.scopes, connected_at = excluded.connected_at, updated_at = excluded.updated_at",
    [
      userId,
      provider,
      data.externalId ?? "",
      data.accessTokenEnc,
      data.refreshTokenEnc,
      data.scopes.join(","),
      now,
      now,
    ]
  );
}

function rowToIntegration(row: Record<string, unknown>): IntegrationRow {
  return {
    userId: row.user_id as string,
    provider: row.provider as IntegrationProvider,
    externalId: (row.external_id as string) ?? "",
    scopes: ((row.scopes as string) ?? "").split(",").filter(Boolean),
    connectedAt: Number(row.connected_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getIntegration(
  userId: string,
  provider: IntegrationProvider
): Promise<DecryptedIntegration | null> {
  const database = await db();
  const res = await database.execute(
    "SELECT * FROM integrations WHERE user_id = ? AND provider = ?",
    [userId, provider]
  );
  if (!res.rows?.length) return null;
  const row = res.rows[0] as Record<string, unknown>;
  const base = rowToIntegration(row);
  const accessToken = decryptSecret((row.access_token_enc as string) ?? "");
  const refreshToken = decryptSecret((row.refresh_token_enc as string) ?? "");
  if (accessToken === null || refreshToken === null) return null;
  return { ...base, accessToken, refreshToken };
}

export async function listIntegrations(
  userId: string
): Promise<IntegrationRow[]> {
  const database = await db();
  const res = await database.execute(
    "SELECT * FROM integrations WHERE user_id = ? ORDER BY connected_at DESC",
    [userId]
  );
  return (res.rows ?? []).map((r) => rowToIntegration(r as Record<string, unknown>));
}

export async function deleteIntegration(
  userId: string,
  provider: IntegrationProvider
): Promise<boolean> {
  const database = await db();
  const res = await database.execute(
    "DELETE FROM integrations WHERE user_id = ? AND provider = ?",
    [userId, provider]
  );
  return Number(res.rowsAffected) > 0;
}

/** Updates the stored access token after a refresh. */
export async function updateAccessToken(
  userId: string,
  provider: IntegrationProvider,
  accessToken: string
): Promise<void> {
  const database = await db();
  await database.execute(
    "UPDATE integrations SET access_token_enc = ?, updated_at = ? WHERE user_id = ? AND provider = ?",
    [encryptSecret(accessToken), Date.now(), userId, provider]
  );
}

/* =========================================================
   Provider API calls (Gmail API / Microsoft Graph)
   ========================================================= */

async function authedFetch(
  integration: DecryptedIntegration,
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${integration.accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && integration.refreshToken) {
    const refreshed = await refreshAccessToken(integration.provider, integration.refreshToken);
    if (refreshed) {
      await updateAccessToken(integration.userId, integration.provider, refreshed.accessToken);
      headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
      return fetch(url, { ...init, headers });
    }
  }
  return res;
}

/** Lists the N most recent messages with subject/sender/snippet. */
export async function listProviderMessages(
  integration: DecryptedIntegration,
  maxResults = 10
): Promise<ProviderMessage[]> {
  if (integration.provider === "gmail") {
    const listRes = await authedFetch(
      integration,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.max(
        1,
        Math.min(maxResults, 25)
      )}`
    );
    if (!listRes.ok) return [];
    const list = (await listRes.json()) as { messages?: { id: string }[] };
    const ids = (list.messages ?? []).slice(0, maxResults).map((m) => m.id);
    const out: ProviderMessage[] = [];
    for (const id of ids) {
      const msgRes = await authedFetch(
        integration,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
      );
      if (!msgRes.ok) continue;
      const msg = (await msgRes.json()) as {
        id: string;
        payload?: { headers?: { name: string; value: string }[] };
        snippet?: string;
        internalDate?: string;
      };
      const headers = msg.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
      out.push({
        id: msg.id,
        sender: get("from"),
        subject: get("subject") || "(no subject)",
        snippet: msg.snippet ?? "",
        receivedAt: Number(msg.internalDate ?? 0),
      });
    }
    return out;
  }

  const res = await authedFetch(
    integration,
    `https://graph.microsoft.com/v1.0/me/messages?$top=${Math.max(
      1,
      Math.min(maxResults, 25)
    )}&$select=id,subject,from,sentDateTime,bodyPreview`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    value?: {
      id: string;
      subject?: string;
      from?: { emailAddress?: { address?: string } };
      sentDateTime?: string;
      bodyPreview?: string;
    }[];
  };
  return (data.value ?? []).map((m) => ({
    id: m.id,
    sender: m.from?.emailAddress?.address ?? "",
    subject: m.subject || "(no subject)",
    snippet: m.bodyPreview ?? "",
    receivedAt: m.sentDateTime ? Date.parse(m.sentDateTime) || 0 : 0,
  }));
}

/** Fetches the full plaintext body of a message by provider id. */
export async function fetchProviderMessageBody(
  integration: DecryptedIntegration,
  messageId: string
): Promise<string> {
  if (integration.provider === "gmail") {
    const res = await authedFetch(
      integration,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    );
    if (!res.ok) return "";
    const msg = (await res.json()) as GmailMessage;
    return extractGmailBody(msg.payload);
  }
  const res = await authedFetch(
    integration,
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?$select=id,body`
  );
  if (!res.ok) return "";
  const msg = (await res.json()) as { body?: { content?: string } };
  return msg.body?.content ?? "";
}

export type ProviderMessageDetail = ProviderMessage & { body: string };

/** Fetches a message's metadata + full body in one round trip. */
export async function fetchProviderMessage(
  integration: DecryptedIntegration,
  messageId: string
): Promise<ProviderMessageDetail | null> {
  if (integration.provider === "gmail") {
    const res = await authedFetch(
      integration,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
    );
    if (!res.ok) return null;
    const msg = (await res.json()) as GmailMessage;
    const headers = msg.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
    return {
      id: msg.id,
      sender: get("from"),
      subject: get("subject") || "(no subject)",
      snippet: msg.snippet ?? "",
      receivedAt: Number(msg.internalDate ?? 0),
      body: extractGmailBody(msg.payload),
    };
  }

  const res = await authedFetch(
    integration,
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}?$select=id,subject,from,sentDateTime,bodyPreview,body`
  );
  if (!res.ok) return null;
  const msg = (await res.json()) as {
    id: string;
    subject?: string;
    from?: { emailAddress?: { address?: string } };
    sentDateTime?: string;
    bodyPreview?: string;
    body?: { content?: string };
  };
  return {
    id: msg.id,
    sender: msg.from?.emailAddress?.address ?? "",
    subject: msg.subject || "(no subject)",
    snippet: msg.bodyPreview ?? "",
    receivedAt: msg.sentDateTime ? Date.parse(msg.sentDateTime) || 0 : 0,
    body: msg.body?.content ?? "",
  };
}

type GmailMessage = {
  id: string;
  payload?: GmailPayload;
  snippet?: string;
  internalDate?: string;
};

type GmailPayload = {
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: { mimeType: string; body?: { data?: string } }[];
};

function extractGmailBody(payload?: GmailPayload): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  for (const part of payload.parts ?? []) {
    if (part.mimeType?.startsWith("text/") && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  return "";
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

/** Sends an email through the connected provider. */
export async function sendProviderMail(
  integration: DecryptedIntegration,
  opts: { to: string; subject: string; body: string }
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    if (integration.provider === "gmail") {
      const raw = buildRfc822(opts);
      const res = await authedFetch(
        integration,
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
        }
      );
      if (!res.ok) return { ok: false, error: `http_${res.status}` };
      const data = (await res.json()) as { id?: string };
      return { ok: true, messageId: data.id };
    }

    const res = await authedFetch(
      integration,
      "https://graph.microsoft.com/v1.0/me/sendMail",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject: opts.subject,
            body: { contentType: "Text", content: opts.body },
            toRecipients: [{ emailAddress: { address: opts.to } }],
          },
          saveToSentItems: true,
        }),
      }
    );
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

function buildRfc822(opts: { to: string; subject: string; body: string }): string {
  const headers = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject.replace(/[\r\n]/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
  ];
  const quoted = opts.body.replace(/\r?\n/g, "\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${quoted}`;
}
