"use client";

import {
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  ExternalLink,
} from "lucide-react";
import { downloadIcs } from "@/lib/ics";
import { Button } from "@/components/ui/Button";
import {
  googleCalendarUrl,
  outlookCalendarUrl,
  parseDeadline,
  sortDeadlines,
} from "@/lib/deadline";

export default function DeadlineList({ deadlines }: { deadlines: string[] }) {
  const parsed = sortDeadlines(
    deadlines.filter((d) => d !== "No deadline mentioned")
  ).map((d) => parseDeadline(d));

  if (parsed.length === 0) return null;

  return (
    <div>
      <ul className="space-y-2">
        {parsed.map((item, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-3 border-b border-line py-2 font-mono text-sm text-ink first:border-t"
          >
            {item.date ? (
              item.overdue ? (
                <CalendarX2 className="h-4 w-4 shrink-0 text-high" />
              ) : (
                <CalendarClock className="h-4 w-4 shrink-0 text-muted" />
              )
            ) : (
              <CalendarCheck2 className="h-4 w-4 shrink-0 text-muted" />
            )}
            <span className="min-w-0 flex-1">{item.raw}</span>
            {item.date && (
              <span
                className={`text-xs ${
                  item.overdue ? "text-high" : "text-muted"
                }`}
              >
                {item.label}
                {item.overdue ? " · overdue" : ""}
              </span>
            )}
            {item.date && (
              <span className="flex items-center gap-2 text-xs text-muted">
                <a
                  href={googleCalendarUrl(item.raw, item.date)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Add to Google Calendar"
                  className="inline-flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Google
                </a>
                <a
                  href={outlookCalendarUrl(item.raw, item.date)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Add to Outlook Calendar"
                  className="inline-flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Outlook
                </a>
              </span>
            )}
          </li>
        ))}
      </ul>
      <Button variant="dark" size="md" onClick={() => downloadIcs(deadlines)}>
        <CalendarPlus className="h-4 w-4" />
        Export deadlines (.ics)
      </Button>
    </div>
  );
}
