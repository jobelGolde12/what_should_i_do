import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createUser, upsertSetting } from "@/lib/auth/users";
import { hashPassword } from "@/lib/auth/session";
import { getDb, ensureSchema } from "@/lib/db";
import {
  createReminder,
  queueRemindersForAnalysis,
  dueReminders,
  markReminderSent,
  activeRemindersForAnalysis,
  remindAtFor,
  presetMs,
  getReminderPlan,
  markReminderPlan,
  buildReminderEmail,
  reminderPlanKey,
} from "@/lib/reminders";
import { POST as cronPOST } from "@/app/api/cron/reminders/route";

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

async function makeUser(email = "remind@example.com") {
  return createUser(email, hashPassword("secret123"));
}

const NOW = Date.UTC(2026, 7, 10, 0, 0, 0); // Mon Aug 10 2026 00:00 UTC

describe("reminder presets & time math", () => {
  it("resolves preset lead times in milliseconds", () => {
    expect(presetMs("30m")).toBe(30 * 60_000);
    expect(presetMs("1h")).toBe(60 * 60_000);
    expect(presetMs("1d")).toBe(24 * 60 * 60_000);
    expect(presetMs("nope")).toBeNull();
  });

  it("remindAtFor subtracts the offset from the deadline", () => {
    expect(remindAtFor(10_000, 1_000)).toBe(9_000);
  });
});

describe("reminder rows", () => {
  beforeEach(async () => {
    await clearTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  it("creates a row and dedupes per analysis + deadline", async () => {
    const user = await makeUser();
    const row = await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Submit report",
      dueAt: NOW + 86_400_000,
      remindAt: NOW + 86_400_000 - 60_000,
    });
    expect(row).not.toBeNull();
    expect(row?.sent).toBe(false);

    const duplicate = await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Submit report",
      dueAt: NOW + 86_400_000,
      remindAt: NOW + 86_400_000 - 30 * 60_000,
    });
    expect(duplicate).toBeNull();
    expect(await activeRemindersForAnalysis(user.id, "a1")).toHaveLength(1);
  });

  it("allows a fresh reminder after the previous one was sent", async () => {
    const user = await makeUser();
    const first = await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Call vendor",
      dueAt: NOW + 86_400_000,
      remindAt: NOW + 60_000,
    });
    expect(first).not.toBeNull();
    await markReminderSent(first!.id);

    const second = await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Call vendor",
      dueAt: NOW + 172_800_000,
      remindAt: NOW + 120_000,
    });
    expect(second).not.toBeNull();
    expect(await activeRemindersForAnalysis(user.id, "a1")).toHaveLength(1);
  });

  it("queueRemindersForAnalysis skips unparseable and overdue deadlines", async () => {
    const user = await makeUser();
    const created = await queueRemindersForAnalysis(
      user.id,
      "a1",
      ["Submit by June 15, 2030", "Due yesterday", "definitely no date here"],
      { offsetMs: 60 * 60_000, now: NOW }
    );
    expect(created).toHaveLength(1);
    expect(created[0].deadlineText).toBe("Submit by June 15, 2030");
  });

  it("clamps a lead time that already passed to now", async () => {
    const user = await makeUser();
    const created = await queueRemindersForAnalysis(
      user.id,
      "a1",
      ["Due in two hours"],
      { offsetMs: 24 * 60 * 60_000, now: NOW }
    );
    expect(created).toHaveLength(1);
    expect(created[0].remindAt).toBe(NOW);
  });

  it("dueReminders returns only unsent rows with remind_at in the past", async () => {
    const user = await makeUser();
    await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Past due",
      dueAt: NOW + 60_000,
      remindAt: NOW - 60_000,
    });
    await createReminder(user.id, {
      analysisId: "a2",
      deadlineText: "Future",
      dueAt: NOW + 86_400_000,
      remindAt: NOW + 60_000,
    });

    const due = await dueReminders(NOW);
    expect(due).toHaveLength(1);
    expect(due[0].deadlineText).toBe("Past due");
    expect(due[0].email).toBe("remind@example.com");
  });

  it("markReminderSent removes the row from the due sweep", async () => {
    const user = await makeUser();
    const row = await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Pay bill",
      dueAt: NOW + 60_000,
      remindAt: NOW - 60_000,
    });
    await markReminderSent(row!.id);
    expect(await dueReminders(NOW)).toHaveLength(0);
  });
});

describe("calendar plan", () => {
  beforeEach(async () => {
    await clearTables();
  });

  afterEach(async () => {
    await clearTables();
  });

  it("round-trips added deadlines per analysis", async () => {
    const user = await makeUser();
    await markReminderPlan(user.id, "a1", ["One", "Two"], { addedAt: 111 });
    const plan = await getReminderPlan(user.id, "a1");
    expect(plan).toEqual({
      One: { addedAt: 111 },
      Two: { addedAt: 111 },
    });

    // A different analysis stays empty.
    expect(await getReminderPlan(user.id, "a2")).toEqual({});
  });

  it("stores remindAt when supplied and keeps existing entries", async () => {
    const user = await makeUser();
    await markReminderPlan(user.id, "a1", ["One"], { remindAt: 500 });
    const plan = await getReminderPlan(user.id, "a1");
    expect(plan.One).toEqual({ addedAt: expect.any(Number), remindAt: 500 });

    // Re-marking without remindAt keeps the reminder marker.
    await markReminderPlan(user.id, "a1", ["One", "Two"]);
    const updated = await getReminderPlan(user.id, "a1");
    expect(updated.One.remindAt).toBe(500);
    expect(updated.Two).toEqual({ addedAt: expect.any(Number) });
  });

  it("returns an empty plan for corrupt stored values", async () => {
    const user = await makeUser();
    await upsertSetting(user.id, reminderPlanKey("a1"), "not-an-object");
    expect(await getReminderPlan(user.id, "a1")).toEqual({});
  });
});

describe("reminder email copy", () => {
  it("builds subject, text and escaped html", () => {
    const mail = buildReminderEmail({
      id: "r1",
      userId: "u1",
      analysisId: "a1",
      deadlineText: "Ship <release> & docs",
      dueAt: Date.UTC(2026, 7, 15, 17, 0),
      remindAt: Date.UTC(2026, 7, 15, 16, 0),
      sent: false,
      channel: "email",
      createdAt: NOW,
    });
    expect(mail.subject).toContain("Ship");
    expect(mail.text).toContain("https://taskmind.app/");
    expect(mail.html).toContain("&lt;release&gt;");
    expect(mail.html).toContain("&amp; docs");
  });
});

describe("cron reminders route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: "cron-test-secret" };
    return clearTables();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 without a valid cron secret", async () => {
    const res = await cronPOST(new Request("http://localhost/api/cron/reminders", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("accepts the Bearer cron secret", async () => {
    const res = await cronPOST(
      new Request("http://localhost/api/cron/reminders?dry=1", {
        method: "POST",
        headers: { Authorization: "Bearer cron-test-secret" },
      })
    );
    expect(res.status).toBe(200);
  });

  it("dry-run does not mark reminders as sent", async () => {
    const user = await makeUser();
    await createReminder(user.id, {
      analysisId: "a1",
      deadlineText: "Due now",
      dueAt: NOW + 60_000,
      remindAt: NOW - 60_000,
    });
    const res = await cronPOST(
      new Request("http://localhost/api/cron/reminders?dry=1", {
        method: "POST",
        headers: { "x-cron-secret": "cron-test-secret" },
      })
    );
    const body = (await res.json()) as { dry: boolean; due: number; sent: number };
    expect(body).toEqual({ ok: true, dry: true, due: 1, sent: 0, failed: 0 });
    expect(await dueReminders(NOW)).toHaveLength(1);
  });

  it("refuses when CRON_SECRET is unset even with a matching header", async () => {
    process.env = { ...originalEnv };
    delete process.env.CRON_SECRET;
    const res = await cronPOST(
      new Request("http://localhost/api/cron/reminders", {
        method: "POST",
        headers: { "x-cron-secret": "cron-test-secret" },
      })
    );
    expect(res.status).toBe(401);
  });
});
