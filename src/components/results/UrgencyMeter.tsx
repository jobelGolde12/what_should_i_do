import type { UrgencyLevel } from "@/lib/types";

const LEVELS: { key: UrgencyLevel; label: string; bar: string; fill: string }[] = [
  { key: "Informational", label: "Info", bar: "bg-low-bg", fill: "bg-low" },
  { key: "Important", label: "Important", bar: "bg-med-bg", fill: "bg-med" },
  { key: "Urgent", label: "Urgent", bar: "bg-high-bg", fill: "bg-high" },
];

export default function UrgencyMeter({ level }: { level: UrgencyLevel }) {
  const activeIndex = LEVELS.findIndex((l) => l.key === level);

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {LEVELS.map((l, i) => (
          <div
            key={l.key}
            aria-hidden="true"
            className={`h-1.5 ${i <= activeIndex ? l.fill : "bg-line"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">Urgency</span>
        <span
          className={`font-mono text-xs ${
            level === "Urgent"
              ? "text-high"
              : level === "Important"
                ? "text-med"
                : "text-low"
          }`}
        >
          {level}
        </span>
      </div>
    </div>
  );
}
