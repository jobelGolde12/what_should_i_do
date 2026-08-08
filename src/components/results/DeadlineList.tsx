"use client";

import { CalendarPlus, CalendarX2 } from "lucide-react";
import { downloadIcs } from "@/lib/ics";

export default function DeadlineList({ deadlines }: { deadlines: string[] }) {
  const hasDate = deadlines.some((d) => d !== "No deadline mentioned");
  if (!hasDate) return null;

  return (
    <div>
      <ul className="space-y-2">
        {deadlines.map((deadline, i) => (
          <li
            key={i}
            className="flex items-center gap-3 border-b border-line py-2 font-mono text-sm text-ink first:border-t"
          >
            <CalendarX2 className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0">{deadline}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => downloadIcs(deadlines)}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-[3px] bg-night px-4 text-xs font-semibold text-white transition-colors hover:bg-night-soft"
      >
        <CalendarPlus className="h-4 w-4" />
        Export deadlines (.ics)
      </button>
    </div>
  );
}
