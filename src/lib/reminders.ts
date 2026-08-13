/**
 * Deadline reminders engine (Pro).
 *
 * Backed by the `reminders` table (schema.ts). Rows are created when a Pro
 * analysis completes with deadlines ("Remind me" with a preset offset), swept
 * by `/api/cron/reminders`, and marked `sent` on delivery. Dedupe is
 * per `(user_id, analysis_id, deadline_text)` for unsent rows, so re-opening an
 * analysis never stacks duplicate reminders.
 *
 * A lightweight "calendar plan" is persisted in `user_settings` (per analysis)
 * so the UI can show which deadlines were already added to a calendar / had a
 * reminder set — preventing double-adds across re-opens.
 */
import { getDb, ensureSchema } from "@/lib/db";
import { uid } from "@/lib/storage";
import { parseDeadline } from "@/lib/deadline";
import { getSettings, upsertSetting } from "@/lib/auth/users";
import { buildAppUrl } from "@/lib/mailgun";
import {
  presetMs,
  CUSTOM_MINUTES_MAX,
  CUSTOM_MINUTES_MIN,
  REMINDER_PRESETS,
  type ReminderPresetKey,
} from "@/lib/reminderPresets";

export type ReminderChannel = "email";

export {
  presetMs,
  CUSTOM_MINUTES_MAX,
  CUSTOM_MINUTES_MIN,
  REMINDER_PRESETS,
  type ReminderPresetKey,
};

export type ReminderRow = {
  id: string;
  userId: string;
  analysisId: string;
  deadlineText: string;
  dueAt: number;
  remindAt: number;
  sent: boolean;
  channel: ReminderChannel;
  createdAt: number;
};

export type ReminderWithEmail = ReminderRow & { email: string };

async function db() {
  await ensureSchema();
  return getDb();
}

function rowToReminder(row: Record<string, unknown>): ReminderRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    analysisId: (row.analysis_id as string) ?? "",
    deadlineText: row.deadline_text as string,
    dueAt: Number(row.due_at),
    remindAt: Number(row.remind_at),
    sent: Number(row.sent) === 1,
    channel: (row.channel as ReminderChannel) ?? "email",
    createdAt: Number(row.created_at),
  };
}

/**
 * The absolute time a reminder should fire for a deadline `dueAt` when the lead
 * time is `offsetMs`. Pure — no clamping here so callers decide.
 */
export function remindAtFor(dueAt: number, offsetMs: number): number {
  return dueAt - offsetMs;
}

/**
 * Creates a single reminder. Returns `null` when an unsent reminder already
 * exists for the same user + analysis + deadline text (dedupe).
 */
export async function createReminder(
  userId: string,
  opts: {
    analysisId?: string;
    deadlineText: string;
    dueAt: number;
    remindAt: number;
    channel?: ReminderChannel;
  }
): Promise<ReminderRow | null> {
  const database = await db();
  const analysisId = opts.analysisId ?? "";
  const existing = await database.execute(
    "SELECT id FROM reminders WHERE user_id = ? AND analysis_id = ? AND deadline_text = ? AND sent = 0",
    [userId, analysisId, opts.deadlineText]
  );
  if (existing.rows?.length) return null;

  const id = uid();
  const now = Date.now();
  await database.execute(
    "INSERT INTO reminders(id, user_id, analysis_id, deadline_text, due_at, remind_at, sent, channel, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)",
    [
      id,
      userId,
      analysisId,
      opts.deadlineText,
      opts.dueAt,
      opts.remindAt,
      opts.channel ?? "email",
      now,
    ]
  );
  return {
    id,
    userId,
    analysisId,
    deadlineText: opts.deadlineText,
    dueAt: opts.dueAt,
    remindAt: opts.remindAt,
    sent: false,
    channel: opts.channel ?? "email",
    createdAt: now,
  };
}

/** Active (unsent) reminders for one analysis, newest first. */
export async function activeRemindersForAnalysis(
  userId: string,
  analysisId: string
): Promise<ReminderRow[]> {
  const database = await db();
  const res = await database.execute(
    "SELECT * FROM reminders WHERE user_id = ? AND analysis_id = ? AND sent = 0 ORDER BY remind_at ASC",
    [userId, analysisId]
  );
  return (res.rows ?? []).map((r) => rowToReminder(r as Record<string, unknown>));
}

/**
 * Queues reminders for every parseable, future deadline in a list. Overdue and
 * unparseable deadlines are skipped. A reminder whose lead time already passed
 * is clamped to `now` so the next cron sweep picks it up immediately.
 */
export async function queueRemindersForAnalysis(
  userId: string,
  analysisId: string,
  deadlineTexts: string[],
  opts: { offsetMs: number; now?: number; channel?: ReminderChannel }
): Promise<ReminderRow[]> {
  const now = opts.now ?? Date.now();
  const created: ReminderRow[] = [];
  for (const text of deadlineTexts) {
    const parsed = parseDeadline(text, new Date(now));
    if (!parsed.date) continue;
    const dueAt = parsed.date.getTime();
    if (dueAt <= now) continue;
    const remindAt = Math.max(remindAtFor(dueAt, opts.offsetMs), now);
    const row = await createReminder(userId, {
      analysisId,
      deadlineText: text,
      dueAt,
      remindAt,
      channel: opts.channel,
    });
    if (row) created.push(row);
  }
  return created;
}

/** All unsent reminders whose `remind_at` has passed, joined with the email. */
export async function dueReminders(now = Date.now()): Promise<ReminderWithEmail[]> {
  const database = await db();
  const res = await database.execute(
    "SELECT r.*, u.email FROM reminders r JOIN users u ON u.id = r.user_id " +
      "WHERE r.remind_at <= ? AND r.sent = 0 ORDER BY r.remind_at ASC",
    [now]
  );
  return (res.rows ?? []).map((r) => ({
    ...rowToReminder(r as Record<string, unknown>),
    email: (r as Record<string, unknown>).email as string,
  }));
}

export async function markReminderSent(id: string): Promise<void> {
  const database = await db();
  await database.execute("UPDATE reminders SET sent = 1 WHERE id = ?", [id]);
}

/** Reminders a user has for deadlines in a 7-day window (for the digest). */
export async function remindersInWindow(
  userId: string,
  now = Date.now(),
  windowMs = 7 * 24 * 60 * 60 * 1000
): Promise<ReminderRow[]> {
  const database = await db();
  const res = await database.execute(
    "SELECT * FROM reminders WHERE user_id = ? AND due_at <= ? ORDER BY due_at ASC LIMIT 30",
    [userId, now + windowMs]
  );
  return (res.rows ?? []).map((r) => rowToReminder(r as Record<string, unknown>));
}

/* =========================================================
   Calendar plan — persisted per analysis in user_settings so
   re-opening an analysis doesn't double-add deadlines.
   ========================================================= */

export const CALENDAR_PLAN_PREFIX = "reminder_plan:";

export type CalendarPlanEntry = {
  addedAt: number;
  remindAt?: number | null;
};

export type CalendarPlan = Record<string, CalendarPlanEntry>;

export function reminderPlanKey(analysisId: string): string {
  return `${CALENDAR_PLAN_PREFIX}${analysisId}`;
}

function isCalendarPlan(value: unknown): value is CalendarPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 200) return false;
  for (const [, entry] of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const e = entry as Record<string, unknown>;
    if (typeof e.addedAt !== "number" || !Number.isFinite(e.addedAt)) return false;
  }
  return true;
}

export async function getReminderPlan(
  userId: string,
  analysisId: string
): Promise<CalendarPlan> {
  if (!analysisId) return {};
  const settings = await getSettings(userId);
  const value = settings[reminderPlanKey(analysisId)];
  return isCalendarPlan(value) ? value : {};
}

/**
 * Marks deadlines as handled in the calendar plan. Every entry records
 * `addedAt`; `remindAt` is written when the caller supplies one (via the
 * single-value form or the per-text map) so the UI can distinguish "added to
 * calendar" from "reminder set".
 */
export async function markReminderPlan(
  userId: string,
  analysisId: string,
  deadlineTexts: string[],
  opts: {
    addedAt?: number;
    remindAt?: number | null;
    remindAtByText?: Record<string, number>;
  } = {}
): Promise<CalendarPlan> {
  if (!analysisId || deadlineTexts.length === 0) {
    return getReminderPlan(userId, analysisId);
  }
  const addedAt = opts.addedAt ?? Date.now();
  const plan = await getReminderPlan(userId, analysisId);
  for (const text of deadlineTexts) {
    const existing = plan[text];
    const next: CalendarPlanEntry = {
      addedAt,
      ...(existing?.remindAt != null ? { remindAt: existing.remindAt } : {}),
    };
    if (opts.remindAt != null) {
      next.remindAt = opts.remindAt;
    } else if (opts.remindAtByText?.[text] !== undefined) {
      next.remindAt = opts.remindAtByText[text];
    }
    plan[text] = next;
  }
  await upsertSetting(userId, reminderPlanKey(analysisId), plan);
  return plan;
}

/* =========================================================
   Email copy (reminder delivery)
   ========================================================= */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DUE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDueAt(ms: number): string {
  return DUE_FORMATTER.format(new Date(ms));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function buildReminderEmail(reminder: ReminderRow): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Reminder: ${truncate(reminder.deadlineText, 60)}`;
  const appUrl = buildAppUrl("/");
  const due = formatDueAt(reminder.dueAt);

  const text =
    `TaskMind reminder\n\n` +
    `"${reminder.deadlineText}" is due soon.\n\n` +
    `Scheduled for ${due}.\n\n` +
    `Open TaskMind to review: ${appUrl}`;

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">` +
    `<h2 style="margin:0 0 12px">TaskMind reminder</h2>` +
    `<p style="font-size:15px;line-height:1.5">Your deadline <strong>${escapeHtml(
      reminder.deadlineText
    )}</strong> is due soon.</p>` +
    `<p style="font-size:15px;line-height:1.5">Scheduled for <strong>${due}</strong>.</p>` +
    `<p><a href="${appUrl}" style="background:#222;color:#fff;border-radius:8px;padding:10px 16px;text-decoration:none;font-size:14px">Open TaskMind</a></p>` +
    `</div>`;

  return { subject, text, html };
}
