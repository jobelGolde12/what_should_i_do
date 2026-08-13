import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "crypto";
import { createUser } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/session";
import { getDb, ensureSchema } from "@/lib/db";
import {
  INTEGRATION_PROVIDERS,
  isIntegrationProvider,
  integrationEncryptionKey,
  encryptSecret,
  decryptSecret,
  providerConfig,
  pkcePair,
  buildAuthorizeUrl,
  exchangeCode,
  refreshAccessToken,
  saveIntegration,
  getIntegration,
  listIntegrations,
  deleteIntegration,
  updateAccessToken,
  fetchProviderMessageBody,
  fetchProviderMessage,
  sendProviderMail,
  type DecryptedIntegration,
} from "@/lib/integrations";

async function clearTables() {
  await ensureSchema();
  const db = getDb();
  await db.execute("DELETE FROM inbox_messages");
  await db.execute("DELETE FROM integrations");
  await db.execute("DELETE FROM analyses");
  await db.execute("DELETE FROM board_items");
  await db.execute("DELETE FROM templates");
  await db.execute("DELETE FROM user_settings");
  await db.execute("DELETE FROM subscriptions");
  await db.execute("DELETE FROM users");
}

async function makeUser(email = "integrations@example.com") {
  return createUser(email, hashPassword("secret123"));
}

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

const integration: DecryptedIntegration = {
  userId: "u1",
  provider: "gmail",
  externalId: "ext1",
  scopes: ["gmail.readonly"],
  connectedAt: 1,
  updatedAt: 1,
  accessToken: "access-1",
  refreshToken: "refresh-1",
};

describe("integration provider helpers", () => {
  it("lists the supported providers and validates them", () => {
    expect(INTEGRATION_PROVIDERS).toEqual(["gmail", "outlook"]);
    expect(isIntegrationProvider("gmail")).toBe(true);
    expect(isIntegrationProvider("outlook")).toBe(true);
    expect(isIntegrationProvider("yahoo")).toBe(false);
  });

  it("builds a PKCE pair with a verifier and S256 challenge", () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(32);
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(challenge).toBe(expected);
  });

  it("builds an authorize URL with state, challenge, and scopes", () => {
    const url = buildAuthorizeUrl(
      {
        provider: "gmail",
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://taskmind.app/api/integrations/gmail/callback",
        scopes: ["gmail.readonly", "gmail.send"],
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
      },
      { state: "nonce-123", codeChallenge: "challenge-abc" }
    );
    expect(url).toContain("client_id=client-id");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=nonce-123");
    expect(url).toContain("code_challenge=challenge-abc");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("gmail.send");
  });
});

describe("provider config", () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  it("returns null when credentials are missing", () => {
    process.env = { ...original };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.OUTLOOK_CLIENT_ID;
    delete process.env.OUTLOOK_CLIENT_SECRET;
    expect(providerConfig("gmail")).toBeNull();
    expect(providerConfig("outlook")).toBeNull();
  });

  it("resolves gmail config with read/send/modify scopes", () => {
    process.env = { ...original, GOOGLE_CLIENT_ID: "g-id", GOOGLE_CLIENT_SECRET: "g-secret" };
    const config = providerConfig("gmail");
    expect(config?.clientId).toBe("g-id");
    expect(config?.scopes.join(" ")).toContain("gmail.readonly");
    expect(config?.scopes.join(" ")).toContain("gmail.send");
  });

  it("resolves outlook config with offline_access", () => {
    process.env = { ...original, OUTLOOK_CLIENT_ID: "o-id", OUTLOOK_CLIENT_SECRET: "o-secret" };
    const config = providerConfig("outlook");
    expect(config?.clientId).toBe("o-id");
    expect(config?.scopes).toContain("offline_access");
  });
});

describe("token encryption at rest", () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
    vi.unstubAllGlobals();
  });

  it("derives a 32-byte key from the env secret", () => {
    process.env = { ...original, INTEGRATION_ENCRYPTION_KEY: "super-secret-key" };
    delete process.env.AUTH_SECRET;
    expect(integrationEncryptionKey()).toHaveLength(32);
  });

  it("falls back to a dev-only key when unset outside production", () => {
    process.env = { ...original, NODE_ENV: "test" };
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    delete process.env.AUTH_SECRET;
    expect(integrationEncryptionKey()).toHaveLength(32);
  });

  it("throws in production when no key is configured", () => {
    process.env = { ...original, NODE_ENV: "production" };
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    delete process.env.AUTH_SECRET;
    expect(() => integrationEncryptionKey()).toThrow(/required in production/);
  });

  it("round-trips secrets and rejects tampering", () => {
    process.env = { ...original, INTEGRATION_ENCRYPTION_KEY: "key-for-encrypt" };
    const encrypted = encryptSecret("sensitive-token");
    expect(encrypted).not.toContain("sensitive-token");
    expect(decryptSecret(encrypted)).toBe("sensitive-token");

    const parts = encrypted.split(".");
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(decryptSecret(parts.join("."))).toBeNull();
    expect(decryptSecret("not-a-valid-payload")).toBeNull();
  });
});

describe("token exchange & refresh (mocked provider)", () => {
  const original = process.env;

  beforeEach(() => {
    process.env = {
      ...original,
      GOOGLE_CLIENT_ID: "g-id",
      GOOGLE_CLIENT_SECRET: "g-secret",
      OUTLOOK_CLIENT_ID: "o-id",
      OUTLOOK_CLIENT_SECRET: "o-secret",
    };
  });

  afterEach(() => {
    process.env = original;
    vi.unstubAllGlobals();
  });

  it("exchanges an authorization code for tokens", async () => {
    stubFetch(async () =>
      new Response(
        JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600, sub: "user-1" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const tokens = await exchangeCode("gmail", "code-1", "verifier-1");
    expect(tokens?.accessToken).toBe("at");
    expect(tokens?.refreshToken).toBe("rt");
    expect(tokens?.externalId).toBe("user-1");
  });

  it("returns null on provider errors", async () => {
    stubFetch(async () => new Response("bad", { status: 400 }));
    expect(await exchangeCode("gmail", "code", "verifier")).toBeNull();
  });

  it("refreshes an access token", async () => {
    stubFetch(async () =>
      new Response(JSON.stringify({ access_token: "new-at", expires_in: 3600 }), { status: 200 })
    );
    const refreshed = await refreshAccessToken("outlook", "refresh-1");
    expect(refreshed?.accessToken).toBe("new-at");
  });
});

describe("integration repo", () => {
  beforeEach(async () => {
    await clearTables();
    process.env.INTEGRATION_ENCRYPTION_KEY = "repo-test-key";
  });

  afterEach(() => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
  });

  it("saves, lists, reads, updates, and deletes integrations", async () => {
    const user = await makeUser();
    await saveIntegration(user.id, "gmail", {
      accessTokenEnc: encryptSecret("access-1"),
      refreshTokenEnc: encryptSecret("refresh-1"),
      externalId: "ext-1",
      scopes: ["gmail.readonly", "gmail.send"],
    });

    const listed = await listIntegrations(user.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].provider).toBe("gmail");
    expect(listed[0].externalId).toBe("ext-1");

    const decrypted = await getIntegration(user.id, "gmail");
    expect(decrypted?.accessToken).toBe("access-1");
    expect(decrypted?.refreshToken).toBe("refresh-1");

    await updateAccessToken(user.id, "gmail", "access-2");
    expect((await getIntegration(user.id, "gmail"))?.accessToken).toBe("access-2");

    expect(await deleteIntegration(user.id, "gmail")).toBe(true);
    expect(await getIntegration(user.id, "gmail")).toBeNull();
    expect(await listIntegrations(user.id)).toHaveLength(0);
  });

  it("scopes integrations per user", async () => {
    const a = await makeUser("a@example.com");
    const b = await makeUser("b@example.com");
    await saveIntegration(a.id, "gmail", {
      accessTokenEnc: encryptSecret("a"),
      refreshTokenEnc: encryptSecret("r"),
      scopes: [],
    });
    expect(await getIntegration(b.id, "gmail")).toBeNull();
    expect(await listIntegrations(b.id)).toHaveLength(0);
  });

  it("returns null when stored tokens fail to decrypt", async () => {
    const user = await makeUser();
    const db = getDb();
    await db.execute(
      "INSERT INTO integrations(user_id, provider, external_id, access_token_enc, refresh_token_enc, scopes, connected_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [user.id, "gmail", "", "garbage", "garbage", "", Date.now(), Date.now()]
    );
    expect(await getIntegration(user.id, "gmail")).toBeNull();
  });
});

describe("provider API calls (mocked fetch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches a gmail message body (base64url)", async () => {
    const body = Buffer.from("Hello from gmail").toString("base64url");
    stubFetch(async () =>
      new Response(JSON.stringify({ payload: { body: { data: body } } }), { status: 200 })
    );
    expect(await fetchProviderMessageBody(integration, "msg-1")).toBe("Hello from gmail");
  });

  it("fetches gmail metadata + body together", async () => {
    const body = Buffer.from("Meeting notes").toString("base64url");
    stubFetch(async () =>
      new Response(
        JSON.stringify({
          id: "msg-1",
          internalDate: "1700000000000",
          snippet: "Meeting notes",
          payload: {
            headers: [
              { name: "From", value: "alice@example.com" },
              { name: "Subject", value: "Agenda" },
            ],
            body: { data: body },
          },
        }),
        { status: 200 }
      )
    );
    const msg = await fetchProviderMessage(integration, "msg-1");
    expect(msg?.sender).toBe("alice@example.com");
    expect(msg?.subject).toBe("Agenda");
    expect(msg?.body).toBe("Meeting notes");
  });

  it("returns null when the provider call fails", async () => {
    stubFetch(async () => new Response("nope", { status: 403 }));
    expect(await fetchProviderMessage(integration, "msg-1")).toBeNull();
  });

  it("sends mail via gmail", async () => {
    stubFetch(async () => new Response(JSON.stringify({ id: "sent-1" }), { status: 200 }));
    const result = await sendProviderMail(integration, {
      to: "alice@example.com",
      subject: "Re: Agenda",
      body: "Sounds good.",
    });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe("sent-1");
  });

  it("reports send failures without throwing", async () => {
    stubFetch(async () => new Response("denied", { status: 403 }));
    const result = await sendProviderMail(integration, {
      to: "alice@example.com",
      subject: "Re: Agenda",
      body: "Sounds good.",
    });
    expect(result.ok).toBe(false);
  });

  it("auto-refreshes the access token on a 401 and retries", async () => {
    let calls = 0;
    stubFetch(async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("token")) {
        return new Response(JSON.stringify({ access_token: "refreshed-at", expires_in: 3600 }), { status: 200 });
      }
      if (calls === 1) return new Response("expired", { status: 401 });
      return new Response(JSON.stringify({ messages: [{ id: "m1" }] }), { status: 200 });
    });
    process.env.GOOGLE_CLIENT_ID = "g-id";
    process.env.GOOGLE_CLIENT_SECRET = "g-secret";
    process.env.INTEGRATION_ENCRYPTION_KEY = "auto-refresh-key";
    try {
      const res = await import("@/lib/integrations").then((m) =>
        m.listProviderMessages({ ...integration, accessToken: "expired-at" }, 1)
      );
      expect(res).toHaveLength(1);
    } finally {
      delete process.env.INTEGRATION_ENCRYPTION_KEY;
    }
  });
});
