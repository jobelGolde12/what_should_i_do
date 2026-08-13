import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createUser } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/session";
import { getDb, ensureSchema } from "@/lib/db";
import { setUserPlan } from "@/lib/pro/entitlements";
import { getIntegration } from "@/lib/integrations";
import { getSettings } from "@/lib/auth/users";
import { oauthStateKey } from "@/lib/oauth";
import { GET as connectGET } from "@/app/api/integrations/[provider]/connect/route";
import { GET as callbackGET } from "@/app/api/integrations/[provider]/callback/route";
import { DELETE as disconnectDELETE } from "@/app/api/integrations/[provider]/route";

vi.mock("@/lib/auth/cookies", () => ({
  getCurrentUserId: vi.fn(),
}));

import { getCurrentUserId } from "@/lib/auth/cookies";

async function clearTables() {
  await ensureSchema();
  const db = getDb();
  await db.execute("DELETE FROM integrations");
  await db.execute("DELETE FROM user_settings");
  await db.execute("DELETE FROM subscriptions");
  await db.execute("DELETE FROM analyses");
  await db.execute("DELETE FROM inbox_messages");
  await db.execute("DELETE FROM users");
}

async function makeProUser(email = "routes@example.com") {
  const user = await createUser(email, hashPassword("secret123"));
  await setUserPlan(user.id, "pro", { status: "active" });
  return user;
}

describe("integration connect route", () => {
  const original = process.env;

  beforeEach(async () => {
    await clearTables();
    process.env = { ...original, NEXT_PUBLIC_APP_URL: "https://taskmind.app" };
    vi.mocked(getCurrentUserId).mockReset();
  });

  afterEach(() => {
    process.env = original;
  });

  it("returns 401 without a session", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await connectGET(
      new Request("http://localhost/api/integrations/gmail/connect"),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a free user", async () => {
    const user = await createUser("free@example.com", hashPassword("secret123"));
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await connectGET(
      new Request("http://localhost/api/integrations/gmail/connect"),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(403);
  });

  it("rejects unknown providers", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await connectGET(
      new Request("http://localhost/api/integrations/gmail/connect"),
      { params: { provider: "yahoo" } }
    );
    expect(res.status).toBe(400);
  });

  it("rejects when the provider isn't configured", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const res = await connectGET(
      new Request("http://localhost/api/integrations/gmail/connect"),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(400);
  });

  it("redirects to the provider and stores a pending state", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    process.env.GOOGLE_CLIENT_ID = "g-id";
    process.env.GOOGLE_CLIENT_SECRET = "g-secret";

    const res = await connectGET(
      new Request("http://localhost/api/integrations/gmail/connect"),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("code_challenge_method=S256");

    const state = new URL(location).searchParams.get("state");
    expect(state).toBeTruthy();
    const pending = (await getSettings(user.id))[oauthStateKey(state!)];
    expect(pending).toMatchObject({ provider: "gmail", userId: user.id });
  });
});

describe("integration callback route", () => {
  const original = process.env;

  beforeEach(async () => {
    await clearTables();
    process.env = { ...original, NEXT_PUBLIC_APP_URL: "https://taskmind.app" };
    process.env.GOOGLE_CLIENT_ID = "g-id";
    process.env.GOOGLE_CLIENT_SECRET = "g-secret";
    process.env.INTEGRATION_ENCRYPTION_KEY = "callback-test-key";
    vi.mocked(getCurrentUserId).mockReset();
  });

  afterEach(() => {
    process.env = original;
    vi.unstubAllGlobals();
  });

  it("redirects to settings with error when params are missing", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await callbackGET(
      new Request("http://localhost/api/integrations/gmail/callback"),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://taskmind.app/settings#integrations=error");
  });

  it("redirects to expired when the state doesn't match", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await callbackGET(
      new Request("http://localhost/api/integrations/gmail/callback?code=c&state=nope"),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://taskmind.app/settings#integrations=expired");
  });

  it("exchanges the code and saves the integration", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);

    // Start a flow to get a real state, then replay it with a mocked exchange.
    const start = await connectGET(
      new Request("http://localhost/api/integrations/gmail/connect"),
      { params: { provider: "gmail" } }
    );
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            access_token: "access-1",
            refresh_token: "refresh-1",
            expires_in: 3600,
            sub: "ext-1",
          }),
          { status: 200 }
        )
      )
    );

    const res = await callbackGET(
      new Request(`http://localhost/api/integrations/gmail/callback?code=code-1&state=${state}`),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://taskmind.app/settings#integrations=connected");

    const saved = await getIntegration(user.id, "gmail");
    expect(saved?.accessToken).toBe("access-1");
    expect(saved?.refreshToken).toBe("refresh-1");
    expect(saved?.externalId).toBe("ext-1");
  });
});

describe("integration disconnect route", () => {
  const original = process.env;

  beforeEach(async () => {
    await clearTables();
    process.env = { ...original, INTEGRATION_ENCRYPTION_KEY: "disconnect-key" };
    vi.mocked(getCurrentUserId).mockReset();
  });

  afterEach(() => {
    process.env = original;
  });

  it("returns 401 without a session", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await disconnectDELETE(
      new Request("http://localhost/api/integrations/gmail", { method: "DELETE" }),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a free user", async () => {
    const user = await createUser("free@example.com", hashPassword("secret123"));
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await disconnectDELETE(
      new Request("http://localhost/api/integrations/gmail", { method: "DELETE" }),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(403);
  });

  it("deletes the stored integration for a pro user", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const { saveIntegration, encryptSecret } = await import("@/lib/integrations");
    await saveIntegration(user.id, "gmail", {
      accessTokenEnc: encryptSecret("a"),
      refreshTokenEnc: encryptSecret("r"),
      scopes: [],
    });
    expect(await getIntegration(user.id, "gmail")).not.toBeNull();

    const res = await disconnectDELETE(
      new Request("http://localhost/api/integrations/gmail", { method: "DELETE" }),
      { params: { provider: "gmail" } }
    );
    expect(res.status).toBe(200);
    expect(await getIntegration(user.id, "gmail")).toBeNull();
  });
});
