import type { ReactNode } from "react";
import type { UrgencyLevel } from "@/lib/types";

export type Tone = "low" | "med" | "high" | "neutral" | "accent";

const toneStyles: Record<Tone, string> = {
  low: "bg-low-bg text-low",
  med: "bg-med-bg text-med",
  high: "bg-high-bg text-high",
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-tm px-2 py-0.5 font-mono text-2xs font-medium tracking-wide ${toneStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const URGENCY_TONE: Record<UrgencyLevel, Tone> = {
  Urgent: "high",
  Important: "med",
  Informational: "low",
};

export function UrgencyBadge({
  level,
  className = "",
}: {
  level: UrgencyLevel;
  className?: string;
}) {
  const dot =
    level === "Urgent" ? "●" : level === "Important" ? "◐" : "○";
  return (
    <Badge tone={URGENCY_TONE[level]} className={className}>
      <span aria-hidden="true">{dot}</span>
      {level}
    </Badge>
  );
}
