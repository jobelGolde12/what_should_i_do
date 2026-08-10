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
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {URGENCY_LEVELS.map((l, i) => (
          <div
            key={l.key}
            aria-hidden="true"
            title={l.help}
            className={`h-1.5 ${i <= safeIndex ? l.fill : "bg-line"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-ink">Urgency</span>
        <span className={`font-mono text-xs ${active.color}`}>
          {active.label}
        </span>
      </div>
      {(reason || active) && (
        <p className="mt-1 font-mono text-2xs text-muted">
          {reason ?? active.help}
        </p>
      )}
    </div>
  );
}
