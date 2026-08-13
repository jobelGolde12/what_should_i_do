import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createUser, getSettings, updateUserData } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/session";
import { getDb, ensureSchema } from "@/lib/db";
import { setUserPlan } from "@/lib/pro/entitlements";
import { createReminder } from "@/lib/reminders";
import {
  normalizeDigestSettings,
  nowInTimeZone,
  isDigestDue,
  digestForUser,
  proUserIdsForDigest,
  recordDigestSent,
  DIGEST_LAST_SENT_KEY,
} from "@/lib/digest";
import { POST as cronPOST } from "@/app/api/cron/digest/route";
import type { BoardItem } from "@/lib/types";

async function clearTables() {
  await ensureSchema();
  const db = getDb();
  await db.execute("DELETE FROM reminders");
  await db.execute("DELETE FROM subscriptions");
  await db.execute("DELETE FROM user_settings");
  await db.execute("DELETE FROM analyses");
  await db.execute("DELETE FROM board_items");
  await db.execute("DELETE FROM templates");
  await db.execute("DELETE FROM users");
}

async function makeUser(email = "digest@example.com") {
  return createUser(email, hashPassword("secret123"));
}

async function makeProUser(email = "pro@example.com") {
  const user = await makeUser(email);
  await setUserPlan(user.id, "pro", { status: "active" });
  return user;
}

const NOW = Date.UTC(2026, 7, 10, 9, 0, 0); // Mon Aug 10 2026 09:00 UTC

describe("digest settings normalization", () => {
  it("applies defaults for a fresh user", () => {
    const s = normalizeDigestSettings({});
    expect(s.enabled).toBe(true);
    expect(s.day).toBe(1);
    expect(s.hour).toBe(9);
    expect(s.timezone).toBe("UTC");
    expect(s.lastSentAt).toBe(0);
  });

  it("reads stored values and clamps invalid ones", () => {
    const s = normalizeDigestSettings({
      "digest.enabled": false,
      "digest.day": 5,
      "digest.hour": 13,
      "digest.timezone": "Asia/Manila",
      "digest.last_sent_at": 1234,
    });
    expect(s.enabled).toBe(false);
    expect(s.day).toBe(5);
    expect(s.hour).toBe(13);
    expect(s.timezone).toBe("Asia/Manila");
    expect(s.lastSentAt).toBe(1234);

    const clamped = normalizeDigestSettings({
      "digest.day": 9,
      "digest.hour": -1,
      "digest.timezone": "",
    });
    expect(clamped.day).toBe(1);
    expect(clamped.hour).toBe(9);
    expect(clamped.timezone).toBe("UTC");
  });
});

describe("timezone math", () => {
  it("reports weekday + hour in UTC", () => {
    const t = nowInTimeZone(NOW, "UTC");
    expect(t.weekday).toBe(1); // Monday
    expect(t.hour).toBe(9);
  });

  it("falls back to server timezone for invalid timezones", () => {
    expect(() => nowInTimeZone(NOW, "Not/AZone")).not.toThrow();
  });
});

describe("isDigestDue", () => {
  it("fires when enabled and the day/hour match", () => {
    const s = normalizeDigestSettings({});
    expect(isDigestDue(s, NOW)).toBe(true);
  });

  it("does not fire when disabled", () => {
    const s = normalizeDigestSettings({ "digest.enabled": false });
    expect(isDigestDue(s, NOW)).toBe(false);
  });

  it("does not fire on the wrong weekday or hour", () => {
    const monday = normalizeDigestSettings({});
    expect(isDigestDue(monday, NOW + 24 * 60 * 60_000)).toBe(false); // Tue
    expect(isDigestDue(monday, NOW + 3_600_000)).toBe(false); // 10:00

    const sunday = normalizeDigestSettings({ "digest.day": 0, "digest.hour": 9 });
    expect(isDigestDue(sunday, NOW)).toBe(false);
  });

  it("dedupes within the week", async () => {
    const s = normalizeDigestSettings({});
    const fireAt = NOW + 7 * 24 * 60 * 60_000;
    expect(isDigestDue(s, fireAt)).toBe(true);
    s.lastSentAt = fireAt;
    expect(isDigestDue(s, fireAt + 24 * 60 * 60_000)).toBe(false);
  });
});

describe("digestForUser", () => {
  beforeEach(async () => {
    await clearTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  it("returns null when there is nothing to report", async () => {
    const user = await makeProUser();
    expect(await digestForUser(user.id, NOW)).toBeNull();
  });

  it("aggregates upcoming, overdue and top actions", async () => {
    const user = await makeProUser();
    await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Submit Q3 report",
      dueAt: NOW + 3 * 86_400_000,
      remindAt: NOW + 3 * 86_400_000 - 3_600_000,
    });
    await createReminder(user.id, {
      analysisId: "a2",
      deadlineText: "Pay invoice",
      dueAt: NOW - 86_400_000,
      remindAt: NOW - 86_400_000,
    });

    const board: BoardItem[] = [
      {
        id: "b1",
        sourceId: "a1",
        sourceIndex: 0,
        text: "Draft proposal",
        urgency: "Important",
        status: "in-progress",
        createdAt: NOW - 60_000,
      },
    ];
    await updateUserData(user.id, { history: [], templates: [], board });

    const payload = await digestForUser(user.id, NOW);
    expect(payload).not.toBeNull();
    expect(payload?.counts).toEqual({ upcoming: 1, overdue: 1, actions: 1 });
    expect(payload?.text).toContain("Submit Q3 report");
    expect(payload?.text).toContain("Pay invoice");
    expect(payload?.text).toContain("Draft proposal");
    expect(payload?.subject).toContain("deadline");
    expect(payload?.html).toContain("Upcoming deadlines");
  });

  it("excludes deadlines outside the 7-day window", async () => {
    const user = await makeProUser();
    await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Far away",
      dueAt: NOW + 30 * 86_400_000,
      remindAt: NOW + 30 * 86_400_000 - 3_600_000,
    });
    const payload = await digestForUser(user.id, NOW);
    expect(payload).toBeNull();
  });

  it("includes done-free board items only", async () => {
    const user = await makeProUser();
    const board: BoardItem[] = [
      { id: "b1", sourceId: "a1", sourceIndex: 0, text: "Open task", urgency: "Important", status: "todo", createdAt: NOW - 1 },
      { id: "b2", sourceId: "a1", sourceIndex: 1, text: "Finished task", urgency: "Important", status: "done", createdAt: NOW - 2 },
    ];
    await updateUserData(user.id, { history: [], templates: [], board });
    const payload = await digestForUser(user.id, NOW);
    expect(payload?.counts.actions).toBe(1);
    expect(payload?.text).toContain("Open task");
    expect(payload?.text).not.toContain("Finished task");
  });
});

describe("pro users + dedupe recording", () => {
  beforeEach(async () => {
    await clearTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  it("proUserIdsForDigest returns only active/trialing pro users", async () => {
    const pro = await makeProUser();
    await makeUser("free@example.com");
    const canceled = await makeUser("canceled@example.com");
    await setUserPlan(canceled.id, "pro", { status: "canceled" });

    const ids = await proUserIdsForDigest();
    expect(ids).toEqual([pro.id]);
  });

  it("recordDigestSent stores the timestamp for dedupe", async () => {
    const user = await makeProUser();
    await recordDigestSent(user.id, NOW);
    const settings = await getSettings(user.id);
    expect(settings[DIGEST_LAST_SENT_KEY]).toBe(NOW);
  });
});

describe("cron digest route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: "cron-test-secret" };
    return clearTables();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 without a valid cron secret", async () => {
    const res = await cronPOST(new Request("http://localhost/api/cron/digest", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("dry-run reports a would-be digest without sending", async () => {
    const user = await makeProUser();
    await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Submit Q3 report",
      dueAt: NOW + 3 * 86_400_000,
      remindAt: NOW + 3 * 86_400_000 - 3_600_000,
    });

    const res = await cronPOST(
      new Request("http://localhost/api/cron/digest?dry=1", {
        method: "POST",
        headers: { Authorization: "Bearer cron-test-secret" },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; dry: boolean; users: number; sent: number };
    expect(body.ok).toBe(true);
    expect(body.dry).toBe(true);
    expect(body.users).toBe(1);
    expect(body.sent).toBe(0);
  });

  it("attempts a real send when not dry (fails gracefully without Mailgun)", async () => {
    const user = await makeProUser();
    await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Submit Q3 report",
      dueAt: NOW + 3 * 86_400_000,
      remindAt: NOW + 3 * 86_400_000 - 3_600_000,
    });

    const res = await cronPOST(
      new Request(`http://localhost/api/cron/digest?now=${NOW}`, {
        method: "POST",
        headers: { Authorization: "Bearer cron-test-secret" },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sent: number; failed: number };
    expect(body.sent).toBe(0);
    expect(body.failed).toBe(1);
  });
});
