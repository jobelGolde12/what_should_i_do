import type * as ChronoTypes from "chrono-node";

/* =========================================================
   Deadline parsing — chrono-node first, with regex fallbacks
   for expressions chrono misses (EOD, end of month, …).
   ========================================================= */

type ChronoModule = typeof ChronoTypes;

/*
 * chrono-node is a large dependency (~150 KB minified) used solely for
 * natural-language date parsing. Loading it lazily keeps it out of the
 * initial client bundle: until the chunk resolves, parseDeadline() relies
 * on the hand-rolled regex fallbacks below, which cover the common
 * deadline expressions. Await `chronoReady` when deterministic full
 * parsing is required (tests, server-side batch work).
 */
let chronoLib: ChronoModule | null = null;

export const chronoReady: Promise<void> = import("chrono-node").then(
  (mod) => {
    const withDefault = mod as { default?: ChronoModule };
    chronoLib = (withDefault.default ?? mod) as ChronoModule;
  },
  () => {
    /* Chunk failed to load — the regex fallback layer handles parsing. */
  }
);

export type ParsedDeadline = {
  raw: string;
  date: Date | null;
  label: string | null;
  overdue: boolean;
};

const DAY_MS = 86_400_000;
const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3));

/** Regex fallbacks for expressions chrono-node misses. */
function parseFallback(deadline: string): Date | null {
  const lower = deadline.toLowerCase();
  const now = new Date();

  // Relative: "in N days", "sa loob ng N araw", "next week", "in a week",
  // "sa isang linggo", "next month", "sa isang buwan", "next quarter".
  // Two separate matches so the day count is always capture group 1 (the
  // previous single-alternation regex mis-indexed the English branch).
  const inDays =
    lower.match(/\bsa loob ng (\d+)\s+(?:araw|days?)\b/) ??
    lower.match(/\bin (\d+)\s+(?:days?|d)\b/);
  if (inDays) {
    const days = Number(inDays[1]);
    const d = new Date(now.getTime() + days * DAY_MS);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  const weekMatch = lower.match(
    /\b(next week|in a week|sa isang linggo|in one week)\b/
  );
  if (weekMatch) {
    const d = new Date(now.getTime() + 7 * DAY_MS);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  const monthMatchRel = lower.match(
    /\b(next month|in a month|sa isang buwan|in one month)\b/
  );
  if (monthMatchRel) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 9, 0, 0);
    return d;
  }

  const quarterMatch = lower.match(/\bnext quarter\b/);
  if (quarterMatch) {
    const d = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate(), 9, 0, 0);
    return d;
  }

  // Filipino: "bukas" (tomorrow), "ngayon"/"today", "mamaya" (later).
  if (/\bbukas\b|\btomorrow\b/.test(lower)) {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      17,
      0,
      0
    );
  }

  if (/\bngayon\b|\btoday\b/.test(lower)) {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      17,
      0,
      0
    );
  }

  if (/\bmamaya\b/.test(lower)) {
    return new Date(now.getTime() + 2 * 60 * 60 * 1000);
  }

  const isoMatch = deadline.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    return new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }

  const usMatch = deadline.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (usMatch) {
    const year = usMatch[3]
      ? Number(usMatch[3]) < 100
        ? 2000 + Number(usMatch[3])
        : Number(usMatch[3])
      : now.getFullYear();
    return new Date(year, Number(usMatch[1]) - 1, Number(usMatch[2]));
  }

  const monthMatch = deadline.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i
  );
  if (monthMatch) {
    const monthIdx = MONTH_SHORT.indexOf(monthMatch[1].toLowerCase());
    const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear();
    return new Date(year, monthIdx, Number(monthMatch[2]));
  }

  const dayMatch = lower.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );
  if (dayMatch) {
    const target = DAYS.indexOf(dayMatch[1]);
    const current = now.getDay();
    let diff = target - current;
    if (diff <= 0) diff += 7;
    const d = new Date(now.getTime() + diff * DAY_MS);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  if (/\bend of (?:this |the )?month|end-month\b/i.test(lower)) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 17, 0, 0);
  }

  // EOD / end of day / before close of business.
  if (/\b(eod|end of (the )?day|cob|close of business)\b/i.test(lower)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
  }

  return null;
}

function applyTime(deadline: string, date: Date): Date {
  const timeMatch = deadline.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
  );
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const meridiem = timeMatch[3].toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  // 24-hour clock, e.g. "at 18:00" or "before 09:30".
  const h24Match = deadline.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24Match) {
    const d = new Date(date);
    d.setHours(Number(h24Match[1]), Number(h24Match[2]), 0, 0);
    return d;
  }

  return date;
}

// chrono parses these to wrong dates (next-day 9am for "end of the day",
// Aug 1 for "end of this month"), so short-circuit to the hand-rolled
// fallback which gets them right.
const EOD_LIKE = /^(?:eod|end of (?:the )?day|end of today|cob|close of business)$/i;
const EOM_LIKE = /^(?:end of (?:this |the )?month|end-month)$/i;

export function parseDeadline(
  raw: string | null | undefined,
  now: Date = new Date()
): ParsedDeadline {
  const clean = (typeof raw === "string" ? raw : "").trim();
  let date: Date | null = null;
  if (clean) {
    if (EOD_LIKE.test(clean) || EOM_LIKE.test(clean)) {
      date = parseFallback(clean);
    } else {
      date = chronoLib
        ? chronoLib.parseDate(clean, now, { forwardDate: true }) ?? null
        : null;
      if (!date) date = parseFallback(clean);
    }
    if (date) date = applyTime(clean, date);
  }
  const overdue = date !== null && date.getTime() < now.getTime() - 60_000;
  const label = date ? formatDeadline(date) : null;

  return { raw: clean, date, label, overdue };
}

export function formatDeadline(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Sorts deadline strings chronologically. Parseable deadlines come first
 * (soonest first), unparseable ones follow in lexical order.
 */
export function sortDeadlines(deadlines: string[]): string[] {
  const parsed = deadlines.map((d) => ({ d, date: parseDeadline(d).date }));
  return [...parsed]
    .sort((a, b) => {
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date) return -1;
      if (b.date) return 1;
      return a.d.localeCompare(b.d);
    })
    .map((x) => x.d);
}

function icalStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
    d.getHours()
  )}${pad(d.getMinutes())}00`;
}

/** "Add to Google Calendar" deep link for a parsed deadline. */
export function googleCalendarUrl(
  text: string,
  date: Date
): string {
  const start = icalStamp(date);
  const end = icalStamp(new Date(date.getTime() + 60 * 60 * 1000));
  const ctz = encodeURIComponent(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text,
    dates: `${start}/${end}`,
    details: "Deadline from TaskMind",
    ctz,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** "Add to Outlook" deep link for a parsed deadline. */
export function outlookCalendarUrl(
  text: string,
  date: Date
): string {
  const iso = (d: Date) => d.toISOString();
  const params = new URLSearchParams({
    subject: text,
    startdt: iso(date),
    enddt: iso(new Date(date.getTime() + 60 * 60 * 1000)),
    body: "Deadline from TaskMind",
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}
