import { URGENCY_LEVELS } from "@/lib/urgency";
import type { UrgencyLevel } from "@/lib/types";

export default function UrgencyMeter({
  level,
  reason,
}: {
  level: UrgencyLevel;
  reason?: string;
}) {
  const activeIndex = URGENCY_LEVELS.findIndex((l) => l.key === level);
  // Defensive: an unrecognized level would otherwise index into undefined.
  const safeIndex = activeIndex === -1 ? URGENCY_LEVELS.length - 1 : activeIndex;
  const active = URGENCY_LEVELS[safeIndex];

  return (
    <div className="max-w-md">
      <div
        role="img"
        aria-label={`Urgency: ${active.label}`}
        className="grid grid-cols-3 gap-1.5"
      >
        {URGENCY_LEVELS.map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={`h-1 ${i <= safeIndex ? "bg-ink" : "bg-line"}`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-ink">{active.label}</span>
        <span className="font-mono text-2xs uppercase tracking-label-tight text-muted">
          {level}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {reason ?? active.help}
      </p>
    </div>
  );
}
