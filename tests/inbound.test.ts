import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
import { createUser } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/session";
import { getDb, ensureSchema } from "@/lib/db";
import {
  deriveInboundSlug,
  inboundAddress,
  ensureInboundRoute,
  findUserIdByInboundSlug,
  verifyMailgunSignature,
  parseInboundMessage,
  parseMessageHeaders,
  isAutoReply,
  isTransactionalSender,
  analyzeEmail,
  inboundRateLimited,
  analyzeInboundEmail,
} from "@/lib/inbound";
import { getInboxByAnalysisId, getInboxMessages } from "@/lib/inbox";
import { POST as inboundPOST } from "@/app/api/mailgun/inbound/route";
import type { AnalysisResult } from "@/app/actions/analyzeText";

vi.mock("@/lib/inbound", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/inbound")>();
  return { ...mod, analyzeInboundEmail: vi.fn() };
});

async function clearTables() {
  await ensureSchema();
  const db = getDb();
  await db.execute("DELETE FROM inbox_messages");
  await db.execute("DELETE FROM inbound_routes");
  await db.execute("DELETE FROM analyses");
  await db.execute("DELETE FROM board_items");
  await db.execute("DELETE FROM templates");
  await db.execute("DELETE FROM user_settings");
  await db.execute("DELETE FROM subscriptions");
  await db.execute("DELETE FROM users");
}

async function makeUser(email = "inbound@example.com") {
  return createUser(email, hashPassword("secret123"));
}

const fakeResult: AnalysisResult = {
  actions: ["Reply to sender"],
  deadlines: [],
  urgency: "Important",
  urgencyReason: "test",
  confusingParts: [],
  nextStep: "Reply to sender",
  summary: "Analyzed test email.",
  analysisMethod: "fallback",
};

describe("inbound slug & address", () => {
  it("derives a stable 10-char slug from the user id", () => {
    const a = deriveInboundSlug("user_123");
    const b = deriveInboundSlug("user_123");
    expect(a).toBe(b);
    expect(a).toHaveLength(10);
    expect(deriveInboundSlug("user_456")).not.toBe(a);
  });

  it("builds the full address from the domain", () => {
    const prev = process.env.INBOUND_DOMAIN;
    process.env.INBOUND_DOMAIN = "in.example.com";
    try {
      expect(inboundAddress("abc123def0")).toBe("abc123def0@in.example.com");
    } finally {
      if (prev === undefined) delete process.env.INBOUND_DOMAIN;
      else process.env.INBOUND_DOMAIN = prev;
    }
  });
});

describe("inbound routes repo", () => {
  beforeEach(clearTables);
  afterEach(clearTables);

  it("ensures a route and resolves the user by slug", async () => {
    const user = await makeUser();
    const slug = await ensureInboundRoute(user.id);
    expect(await findUserIdByInboundSlug(slug)).toBe(user.id);
    expect(await findUserIdByInboundSlug("nope")).toBeNull();
  });
});

describe("mailgun signature verification", () => {
  const key = "test-signing-key";

  function signedForm(overrides: Record<string, string> = {}) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = "tok_" + Math.random().toString(36).slice(2);
    const signature = createHmac("sha256", key)
      .update(`${timestamp}${token}`)
      .digest("hex");
    return { timestamp, token, signature, ...overrides };
  }

  it("accepts a valid signature", () => {
    expect(verifyMailgunSignature(signedForm(), { key })).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const form = signedForm();
    form.signature = form.signature.replace(/^./, form.signature[0] === "0" ? "1" : "0");
    expect(verifyMailgunSignature(form, { key })).toBe(false);
  });

  it("rejects stale timestamps (replay protection)", () => {
    const form = signedForm();
    expect(
      verifyMailgunSignature(form, { key, now: Date.now() + 20 * 60 * 1000 })
    ).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(verifyMailgunSignature({}, { key })).toBe(false);
  });

  it("rejects when no key is configured", () => {
    const prev = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    const prev2 = process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    delete process.env.MAILGUN_API_KEY;
    try {
      expect(verifyMailgunSignature(signedForm(), { key })).toBe(true);
      expect(verifyMailgunSignature(signedForm(), {})).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
      else process.env.MAILGUN_WEBHOOK_SIGNING_KEY = prev;
      if (prev2 === undefined) delete process.env.MAILGUN_API_KEY;
      else process.env.MAILGUN_API_KEY = prev2;
    }
  });
});

describe("inbound message parsing", () => {
  it("parses recipient slug, sender, subject, and stripped body", () => {
    const msg = parseInboundMessage({
      recipient: "abc123def0@in.taskmind.app",
      from: "Alice <alice@example.com>",
      subject: "Project update",
      "stripped-text": "Body text here",
    });
    expect(msg.slug).toBe("abc123def0");
    expect(msg.sender).toBe("Alice <alice@example.com>");
    expect(msg.subject).toBe("Project update");
    expect(msg.body).toBe("Body text here");
  });

  it("falls back to body-plain and tolerates a missing recipient", () => {
    const msg = parseInboundMessage({ "body-plain": "Plain body" });
    expect(msg.slug).toBeNull();
    expect(msg.body).toBe("Plain body");
  });

  it("parses the message-headers JSON blob", () => {
    const headers = parseMessageHeaders(
      JSON.stringify([
        ["Auto-Submitted", "auto-replied"],
        ["Subject", "Re: hi"],
      ])
    );
    expect(headers["auto-submitted"]).toBe("auto-replied");
    expect(parseMessageHeaders("not-json")).toEqual({});
  });

  it("detects auto-replies and transactional senders", () => {
    expect(isAutoReply({ "auto-submitted": "auto-replied" })).toBe(true);
    expect(isAutoReply({ precedence: "bulk" })).toBe(true);
    expect(isAutoReply({ "x-autoreply": "yes" })).toBe(true);
    expect(isAutoReply({ "auto-submitted": "no" })).toBe(false);
    expect(isTransactionalSender("No-Reply <no-reply@example.com>")).toBe(true);
    expect(isTransactionalSender("alice@example.com")).toBe(false);
  });
});

describe("analyzeEmail (forwarded messages)", () => {
  beforeEach(clearTables);
  afterEach(clearTables);

  it("analyzes, saves to history + inbox, and returns the record", async () => {
    const user = await makeUser();
    const record = await analyzeEmail(
      user.id,
      { sender: "alice@example.com", subject: "Follow up", body: "Please follow up on the proposal by Friday." },
      { provider: "forward", analyzer: async () => fakeResult }
    );
    expect(record).not.toBeNull();
    expect(record?.sourceLabel).toBe("Email: alice@example.com");

    const inbox = await getInboxMessages(user.id);
    expect(inbox).toHaveLength(1);
    expect(inbox[0].provider).toBe("forward");
    expect(inbox[0].analyzed).toBe(true);
    expect(inbox[0].analysisId).toBe(record!.id);
    expect(await getInboxByAnalysisId(user.id, record!.id)).not.toBeNull();
  });

  it("saves forwarded messages with the external id (dedupe key)", async () => {
    const user = await makeUser();
    const record = await analyzeEmail(
      user.id,
      { sender: "bob@example.com", subject: "Hello", body: "Some message content that is long enough.", externalId: "ext_1" },
      { provider: "forward", analyzer: async () => fakeResult }
    );
    expect(record).not.toBeNull();
    const inbox = await getInboxMessages(user.id);
    expect(inbox[0].provider).toBe("forward");
    expect(inbox[0].externalId).toBe("ext_1");
  });

  it("returns null for too-short messages without calling the analyzer", async () => {
    const user = await makeUser();
    let called = false;
    const record = await analyzeEmail(
      user.id,
      { sender: "a@b.co", subject: "", body: "hi" },
      { provider: "forward", analyzer: async () => { called = true; return fakeResult; } }
    );
    expect(record).toBeNull();
    expect(called).toBe(false);
    expect(await getInboxMessages(user.id)).toHaveLength(0);
  });

  it("returns null when the analyzer fails", async () => {
    const user = await makeUser();
    const record = await analyzeEmail(
      user.id,
      { sender: "a@b.co", subject: "Subject", body: "A longer message body here for analysis." },
      { provider: "forward", analyzer: async () => { throw new Error("provider down"); } }
    );
    expect(record).toBeNull();
  });
});

describe("inbound rate limiting", () => {
  it("allows up to the limit then blocks in the same window", () => {
    const slug = "ratelimit-" + Math.random().toString(36).slice(2, 8);
    for (let i = 0; i < 60; i++) {
      expect(inboundRateLimited(slug)).toBe(false);
    }
    expect(inboundRateLimited(slug)).toBe(true);
  });
});

describe("mailgun inbound route", () => {
  const originalEnv = process.env;
  const key = "webhook-test-key";

  function signedForm(overrides: Record<string, string> = {}) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = "tok_" + Math.random().toString(36).slice(2);
    const signature = createHmac("sha256", key)
      .update(`${timestamp}${token}`)
      .digest("hex");
    return { timestamp, token, signature, ...overrides };
  }

  async function postForm(record: Record<string, string>) {
    const form = new FormData();
    for (const [k, v] of Object.entries(record)) form.append(k, v);
    return inboundPOST(new Request("http://localhost/api/mailgun/inbound", { method: "POST", body: form }));
  }

  beforeEach(() => {
    process.env = { ...originalEnv, MAILGUN_WEBHOOK_SIGNING_KEY: key, MAILGUN_FROM: "no-reply@taskmind.app" };
    return clearTables();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 for a bad signature", async () => {
    const res = await postForm({ ...signedForm(), signature: "deadbeef" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await postForm(signedForm({ recipient: "nope@in.taskmind.app" }));
    expect(res.status).toBe(404);
  });

  it("analyzes a forwarded email end-to-end", async () => {
    const user = await makeUser();
    const slug = await ensureInboundRoute(user.id);
    vi.mocked(analyzeInboundEmail).mockResolvedValue({
      id: "a1",
      timestamp: Date.now(),
      input: "input",
      output: fakeResult,
      sourceLabel: "Email: alice@example.com",
    });
    const res = await postForm(
      signedForm({
        recipient: `${slug}@in.taskmind.app`,
        from: "alice@example.com",
        subject: "Follow up",
        "stripped-text": "Please follow up on the proposal by Friday.",
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; analysisId: string };
    expect(body).toEqual({ ok: true, analysisId: "a1" });
    expect(analyzeInboundEmail).toHaveBeenCalled();
  });

  it("returns 422 when analysis is skipped (too short / failed)", async () => {
    const user = await makeUser();
    const slug = await ensureInboundRoute(user.id);
    vi.mocked(analyzeInboundEmail).mockResolvedValue(null);
    const res = await postForm(
      signedForm({
        recipient: `${slug}@in.taskmind.app`,
        from: "alice@example.com",
        subject: "Follow up",
        "stripped-text": "Please follow up on the proposal by Friday.",
      })
    );
    expect(res.status).toBe(422);
  });

  it("rate-limits a single forward address", async () => {
    const user = await makeUser();
    const slug = await ensureInboundRoute(user.id);
    vi.mocked(analyzeInboundEmail).mockResolvedValue({
      id: "a1",
      timestamp: Date.now(),
      input: "input",
      output: fakeResult,
    });
    const base = {
      recipient: `${slug}@in.taskmind.app`,
      from: "alice@example.com",
      subject: "Follow up",
      "stripped-text": "Please follow up on the proposal by Friday.",
    };
    for (let i = 0; i < 60; i++) {
      const res = await postForm(signedForm(base));
      expect(res.status).toBe(200);
    }
    const blocked = await postForm(signedForm(base));
    expect(blocked.status).toBe(429);
  });

  it("skips auto-replies", async () => {
    const user = await makeUser();
    const slug = await ensureInboundRoute(user.id);
    const res = await postForm(
      signedForm({
        recipient: `${slug}@in.taskmind.app`,
        from: "alice@example.com",
        subject: "Re: hi",
        "stripped-text": "This is an auto-generated reply body.",
        "message-headers": JSON.stringify([["Auto-Submitted", "auto-replied"]]),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { skipped: boolean };
    expect(body.skipped).toBe(true);
    expect(await getInboxMessages(user.id)).toHaveLength(0);
  });
});
