import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createUser } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/session";
import { getDb, ensureSchema } from "@/lib/db";
import { setUserPlan } from "@/lib/pro/entitlements";
import { saveIntegration, encryptSecret } from "@/lib/integrations";
import { GET as forwardGET } from "@/app/api/inbox/forward/route";
import { POST as analyzePOST } from "@/app/api/inbox/analyze/route";
import { POST as sendPOST } from "@/app/api/inbox/send/route";

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
  await db.execute("DELETE FROM inbound_routes");
  await db.execute("DELETE FROM users");
}

async function makeProUser(email = "inbox-routes@example.com") {
  const user = await createUser(email, hashPassword("secret123"));
  await setUserPlan(user.id, "pro", { status: "active" });
  return user;
}

describe("inbox routes auth + gating", () => {
  const original = process.env;

  beforeEach(async () => {
    await clearTables();
    process.env = { ...original, INTEGRATION_ENCRYPTION_KEY: "inbox-routes-key" };
    vi.mocked(getCurrentUserId).mockReset();
  });

  afterEach(() => {
    process.env = original;
    vi.unstubAllGlobals();
  });

  it("forward: 401 without a session", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    const res = await forwardGET();
    expect(res.status).toBe(401);
  });

  it("forward: 403 for a free user", async () => {
    const user = await createUser("free@example.com", hashPassword("secret123"));
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await forwardGET();
    expect(res.status).toBe(403);
  });

  it("forward: returns the private address for a pro user", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await forwardGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { address: string };
    expect(body.address).toMatch(/^[0-9a-f]{10}@in.taskmind.app$/);
  });

  it("analyze: 400 with an invalid body", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await analyzePOST(
      new Request("http://localhost/api/inbox/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("analyze: 409 when the provider isn't connected", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await analyzePOST(
      new Request("http://localhost/api/inbox/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gmail", messageId: "m1" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("send: 400 for an invalid recipient", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await sendPOST(
      new Request("http://localhost/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "not-an-email", subject: "Hi", body: "Hello" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("send: 409 when no account is connected", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    const res = await sendPOST(
      new Request("http://localhost/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "alice@example.com", subject: "Hi", body: "Hello there" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("send: returns 502 when the provider call fails", async () => {
    const user = await makeProUser();
    vi.mocked(getCurrentUserId).mockResolvedValue(user.id);
    await saveIntegration(user.id, "gmail", {
      accessTokenEnc: encryptSecret("access"),
      refreshTokenEnc: encryptSecret("refresh"),
      scopes: ["gmail.send"],
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("denied", { status: 403 })));
    const res = await sendPOST(
      new Request("http://localhost/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "alice@example.com", subject: "Hi", body: "Hello there" }),
      })
    );
    expect(res.status).toBe(502);
  });
});
