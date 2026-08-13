import { parseDeadline } from "@/lib/deadline";

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

export function buildIcs(deadlines: string[], actions: string[] = []): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaskMind//TaskMind Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const actionList = actions.length
    ? `\nActions:\n${actions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
    : "";

  deadlines.forEach((deadline, i) => {
    const start = parseDeadline(deadline).date;
    if (!start) return;
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    lines.push(
      "BEGIN:VEVENT",
      `UID:taskmind-${i}-${now.getTime()}`,
      `DTSTAMP:${toIcalDate(now)}`,
      `DTSTART:${toIcalDate(start)}`,
      `DTEND:${toIcalDate(end)}`,
      `SUMMARY:${escapeIcs(deadline)}`,
      `DESCRIPTION:${escapeIcs(`Exported from TaskMind${actionList}`)}`,
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(deadlines: string[], actions: string[] = []): void {
  const content = buildIcs(deadlines, actions);
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
