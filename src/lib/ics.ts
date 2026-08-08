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

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcalDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
    d.getHours()
  )}${pad(d.getMinutes())}00`;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function findFirstDate(deadline: string): Date | null {
  const lower = deadline.toLowerCase();

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
      : new Date().getFullYear();
    return new Date(year, Number(usMatch[1]) - 1, Number(usMatch[2]));
  }

  const monthMatch = deadline.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i
  );
  if (monthMatch) {
    const monthIdx = MONTH_SHORT.indexOf(monthMatch[1].toLowerCase());
    const year = monthMatch[3]
      ? Number(monthMatch[3])
      : new Date().getFullYear();
    return new Date(year, monthIdx, Number(monthMatch[2]));
  }

  const dayMatch = lower.match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );
  if (dayMatch) {
    const target = DAYS.indexOf(dayMatch[1]);
    const now = new Date();
    const current = now.getDay();
    let diff = target - current;
    if (diff <= 0) diff += 7;
    const d = new Date(now.getTime() + diff * DAY_MS);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  if (/\btoday\b/.test(lower)) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
  }

  if (/\btomorrow\b/.test(lower)) {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      17,
      0,
      0
    );
  }

  if (/end of (the )?month|end-month/i.test(lower)) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 17, 0, 0);
  }

  return null;
}

function applyTime(deadline: string, date: Date): Date {
  const timeMatch = deadline.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
  );
  if (!timeMatch) return date;
  let hours = Number(timeMatch[1]);
  const minutes = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const meridiem = timeMatch[3].toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function buildIcs(deadlines: string[]): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaskMind//TaskMind Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  deadlines.forEach((deadline, i) => {
    const base = findFirstDate(deadline);
    if (!base) return;
    const start = applyTime(deadline, base);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    lines.push(
      "BEGIN:VEVENT",
      `UID:taskmind-${i}-${now.getTime()}`,
      `DTSTAMP:${toIcalDate(now)}`,
      `DTSTART:${toIcalDate(start)}`,
      `DTEND:${toIcalDate(end)}`,
      `SUMMARY:${escapeIcs(deadline)}`,
      "DESCRIPTION:Exported from TaskMind",
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(deadlines: string[]): void {
  const content = buildIcs(deadlines);
  const blob = new Blob([content], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "taskmind-deadlines.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
