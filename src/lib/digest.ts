/**
 * Weekly digest (Pro) — one email per week summarising what's coming up.
 *
 * Aggregates the user's upcoming deadlines (next 7 days), overdue items, and
 * top open board actions, then builds the email payload. The digest is opt-out
 * (`digest.enabled`, default true) and deduped per user/week via
 * `digest.last_sent_at`. Scheduling is timezone-aware: the user picks a weekday
 * + hour in their own timezone, and the daily cron only sends when the current
 * time there matches — so a single `daily` Vercel Cron job can fan out weekly
 * digests correctly per user.
 */
import { getDb, ensureSchema } from "@/lib/db";
import { upsertSetting, type SettingsRecord } from "@/lib/auth/users";
import { PRO_GRANTING_STATUSES } from "@/lib/pro/plans";
import { formatDueAt } from "@/lib/reminders";
import { buildAppUrl } from "@/lib/mailgun";

export const DIGEST_ENABLED_KEY = "digest.enabled";
export const DIGEST_DAY_KEY = "digest.day";
export const DIGEST_HOUR_KEY = "digest.hour";
export const DIGEST_TIMEZONE_KEY = "digest.timezone";
export const DIGEST_LAST_SENT_KEY = "digest.last_sent_at";

export const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Don't send more than one digest per user per ~6 days. */
export const DIGEST_DEDUPE_MS = 6 * 24 * 60 * 60 * 1000;

export const DEFAULT_DIGEST_DAY = 1; // Monday
export const DEFAULT_DIGEST_HOUR = 9;
export const DEFAULT_DIGEST_TIMEZONE = "UTC";

export type DigestSettings = {
  enabled: boolean;
  day: number; // 0 = Sunday … 6 = Saturday
  hour: number; // 0–23
  timezone: string;
  lastSentAt: number;
};

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function intIn(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value < min || value > max) return fallback;
  return Math.floor(value);
}

export function normalizeDigestSettings(
  settings: SettingsRecord
): DigestSettings {
  return {
    enabled: bool(settings[DIGEST_ENABLED_KEY], true),
    day: intIn(settings[DIGEST_DAY_KEY], 0, 6, DEFAULT_DIGEST_DAY),
    hour: intIn(settings[DIGEST_HOUR_KEY], 0, 23, DEFAULT_DIGEST_HOUR),
    timezone:
      typeof settings[DIGEST_TIMEZONE_KEY] === "string" &&
      settings[DIGEST_TIMEZONE_KEY]
        ? (settings[DIGEST_TIMEZONE_KEY] as string)
        : DEFAULT_DIGEST_TIMEZONE,
    lastSentAt: intIn(settings[DIGEST_LAST_SENT_KEY], 0, Number.MAX_SAFE_INTEGER, 0),
  };
}

/** True for a syntactically valid IANA time zone (throws otherwise). */
export function isValidTimeZone(value: string): boolean {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Local wall-clock hour + weekday for `now` in the given IANA timezone. */
export function nowInTimeZone(
  now: number,
  timeZone: string
): { hour: number; weekday: number } {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    });
    fmt.format(new Date(0)); // throws for invalid timezones
  } catch {
    fmt = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    });
  }
  const parts = fmt.formatToParts(new Date(now));
  let hour = 0;
  let weekday = 0;
  for (const part of parts) {
    if (part.type === "hour") hour = Number(part.value) || 0;
    if (part.type === "weekday") weekday = WEEKDAY_INDEX[part.value] ?? 0;
  }
  return { hour, weekday };
}

/** True when the digest should fire for this user right now (day/hour + dedupe). */
export function isDigestDue(settings: DigestSettings, now: number): boolean {
  if (!settings.enabled) return false;
  if (now - settings.lastSentAt < DIGEST_DEDUPE_MS) return false;
  const t = nowInTimeZone(now, settings.timezone);
  return t.weekday === settings.day && t.hour === settings.hour;
}

async function db() {
  await ensureSchema();
  return getDb();
}

/** User ids currently entitled to Pro (the digest targets). */
export async function proUserIdsForDigest(): Promise<string[]> {
  const database = await db();
  const res = await database.execute(
    `SELECT user_id FROM subscriptions WHERE plan = 'pro' AND status IN (?, ?)`,
    PRO_GRANTING_STATUSES
  );
  return (res.rows ?? []).map((r) => r.user_id as string);
}

export type DigestPayload = {
  subject: string;
  text: string;
  html: string;
  counts: { upcoming: number; overdue: number; actions: number };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function actionStatusLabel(status: string): string {
  switch (status) {
    case "in-progress":
      return "In progress";
    case "done":
      return "Done";
    default:
      return "To do";
  }
}

/**
 * Builds the digest for a user (deadlines in the next 7 days, overdue items,
 * and the top open actions) or `null` when there's nothing to report.
 */
export async function digestForUser(
  userId: string,
  now = Date.now()
): Promise<DigestPayload | null> {
  const database = await db();
  const windowEnd = now + DIGEST_WINDOW_MS;

  const [reminders, actionsRes] = await database.batch([
    [
      "SELECT deadline_text, due_at, analysis_id FROM reminders WHERE user_id = ? AND due_at <= ? ORDER BY due_at ASC LIMIT 30",
      [userId, windowEnd],
    ],
    [
      "SELECT text, status FROM board_items WHERE user_id = ? AND deleted_at IS NULL AND status != 'done' ORDER BY created_at DESC LIMIT 5",
      [userId],
    ],
  ]);

  const rows = (reminders.rows ?? []) as Record<string, unknown>[];
  const upcoming = rows
    .filter((r) => Number(r.due_at) >= now)
    .slice(0, 20)
    .map((r) => ({
      text: r.deadline_text as string,
      dueAt: Number(r.due_at),
      analysisId: (r.analysis_id as string) ?? "",
    }));
  const overdue = rows
    .filter((r) => Number(r.due_at) < now)
    .slice(0, 10)
    .map((r) => ({
      text: r.deadline_text as string,
      dueAt: Number(r.due_at),
      analysisId: (r.analysis_id as string) ?? "",
    }));
  const actions = (actionsRes.rows ?? []).map((r) => ({
    text: (r as Record<string, unknown>).text as string,
    status: (r as Record<string, unknown>).status as string,
  }));

  if (upcoming.length === 0 && overdue.length === 0 && actions.length === 0) {
    return null;
  }

  const appUrl = buildAppUrl("/");
  const weekLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(windowEnd));

  const lines: string[] = [
    `TaskMind weekly digest — up to ${weekLabel}`,
    "",
  ];
  if (upcoming.length) {
    lines.push(`UPCOMING DEADLINES (${upcoming.length})`);
    for (const d of upcoming) {
      lines.push(`  • ${formatDueAt(d.dueAt)} — ${d.text}`);
    }
    lines.push("");
  }
  if (overdue.length) {
    lines.push(`OVERDUE (${overdue.length})`);
    for (const d of overdue) {
      lines.push(`  • ${formatDueAt(d.dueAt)} — ${d.text}`);
    }
    lines.push("");
  }
  if (actions.length) {
    lines.push(`TOP ACTIONS (${actions.length})`);
    for (const a of actions) {
      lines.push(`  • [${actionStatusLabel(a.status)}] ${a.text}`);
    }
    lines.push("");
  }
  lines.push(`Open TaskMind: ${appUrl}`);
  const text = lines.join("\n");

  const rowsHtml = (d: { text: string; dueAt: number }[]) =>
    d
      .map(
        (item) =>
          `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555;white-space:nowrap">${formatDueAt(
            item.dueAt
          )}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#222">${escapeHtml(
            item.text
          )}</td></tr>`
      )
      .join("");

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">` +
    `<h2 style="margin:0 0 4px">Your TaskMind week ahead</h2>` +
    `<p style="margin:0 0 20px;color:#888;font-size:13px">Up to ${weekLabel}</p>` +
    (upcoming.length
      ? `<h3 style="margin:20px 0 8px;font-size:14px">Upcoming deadlines</h3>` +
        `<table style="border-collapse:collapse;width:100%;font-size:14px">${rowsHtml(upcoming)}</table>`
      : "") +
    (overdue.length
      ? `<h3 style="margin:20px 0 8px;font-size:14px;color:#c0392b">Overdue</h3>` +
        `<table style="border-collapse:collapse;width:100%;font-size:14px">${rowsHtml(overdue)}</table>`
      : "") +
    (actions.length
      ? `<h3 style="margin:20px 0 8px;font-size:14px">Top actions</h3>` +
        `<ul style="margin:0;padding-left:18px;font-size:14px;color:#222">${actions
          .map((a) => `<li>${escapeHtml(a.text)} <span style="color:#888">(${actionStatusLabel(a.status)})</span></li>`)
          .join("")}</ul>`
      : "") +
    `<p style="margin:24px 0 0"><a href="${appUrl}" style="background:#222;color:#fff;border-radius:8px;padding:10px 16px;text-decoration:none;font-size:14px">Open TaskMind</a></p>` +
    `</div>`;

  return {
    subject: `Your TaskMind week ahead — ${upcoming.length} deadline${upcoming.length === 1 ? "" : "s"} coming up`,
    text,
    html,
    counts: { upcoming: upcoming.length, overdue: overdue.length, actions: actions.length },
  };
}

/** Records a digest send so the weekly dedupe holds. */
export async function recordDigestSent(userId: string, at = Date.now()): Promise<void> {
  await upsertSetting(userId, DIGEST_LAST_SENT_KEY, at);
}
