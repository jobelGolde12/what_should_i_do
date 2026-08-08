import type { UrgencyLevel } from "@/lib/types";
import { parseDeadline } from "@/lib/deadline";

/* =========================================================
   Single source of truth for urgency semantics.
   Used by: the rule classifier, the AI prompt, validation,
   and every UI element that renders urgency.
   ========================================================= */

export const URGENCY_LEVELS: {
  key: UrgencyLevel;
  label: string;
  order: number;
  color: string;
  fill: string;
  soft: string;
  help: string;
}[] = [
  {
    key: "Informational",
    label: "Info",
    order: 0,
    color: "text-low",
    fill: "bg-low",
    soft: "bg-low-bg",
    help: "No action needed — can be addressed later.",
  },
  {
    key: "Important",
    label: "Important",
    order: 1,
    color: "text-med",
    fill: "bg-med",
    soft: "bg-med-bg",
    help: "Should be addressed soon — within the next week.",
  },
  {
    key: "Urgent",
    label: "Urgent",
    order: 2,
    color: "text-high",
    fill: "bg-high",
    soft: "bg-high-bg",
    help: "Requires immediate attention.",
  },
];

export const URGENCY_META = Object.fromEntries(
  URGENCY_LEVELS.map((l) => [l.key, l])
) as Record<UrgencyLevel, (typeof URGENCY_LEVELS)[number]>;

export const URGENCY_VALUES: UrgencyLevel[] = URGENCY_LEVELS.map((l) => l.key);

export function isUrgencyLevel(value: unknown): value is UrgencyLevel {
  return typeof value === "string" && URGENCY_VALUES.includes(value as UrgencyLevel);
}

export function clampUrgency(value: unknown): UrgencyLevel {
  return isUrgencyLevel(value) ? value : "Informational";
}

export type UrgencyDecision = {
  level: UrgencyLevel;
  reason: string;
  confidence: number;
};

const URGENT_WORDS = [
  "today",
  "immediately",
  "asap",
  "urgent",
  "final notice",
  "effective",
  "until lifted",
  "deadline is today",
  "due today",
];

const WEATHER_WORDS = [
  "tropical cyclone",
  "heavy rainfall",
  "storm warning",
  "signal no",
  "typhoon",
  "evacuation",
  "flash flood",
];

const LOST_WORDS = [
  "lost",
  "missing",
  "un-possess",
  "not with its owner",
  "void in",
];

/** Milliseconds until the soonest deadline, or null when none parse. */
export function deadlineHorizon(
  deadlines: string[],
  now: Date = new Date()
): number | null {
  const dates = deadlines
    .map((d) => parseDeadline(d, now).date)
    .filter((d): d is Date => d !== null);
  if (dates.length === 0) return null;
  const soonest = Math.min(...dates.map((d) => d.getTime()));
  return soonest - now.getTime();
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Rule-based urgency classifier. Produces a level, a human-readable reason,
 * and a confidence score. Also available as the fallback when the AI path
 * fails, so semantics stay identical across both pipelines.
 */
export function classifyUrgency(
  input: string,
  deadlines: string[] = [],
  now: Date = new Date()
): UrgencyDecision {
  const lower = input.toLowerCase();
  const isLost = LOST_WORDS.some((w) => lower.includes(w));
  const isWeather = WEATHER_WORDS.some((w) => lower.includes(w));

  if (isLost) {
    return {
      level: "Informational",
      reason: "Lost-and-found notice — no immediate action required unless stated.",
      confidence: 0.9,
    };
  }

  if (isWeather) {
    return {
      level: "Urgent",
      reason: "Weather or safety alert.",
      confidence: 0.9,
    };
  }

  const urgentWord = URGENT_WORDS.find((w) => lower.includes(w));
  if (urgentWord) {
    return {
      level: "Urgent",
      reason: `Uses urgent language ("${urgentWord}").`,
      confidence: 0.85,
    };
  }

  const horizon = deadlineHorizon(deadlines, now);
  if (horizon !== null) {
    if (horizon <= 24 * HOUR_MS) {
      return {
        level: "Urgent",
        reason: "Deadline within 24 hours.",
        confidence: 0.8,
      };
    }
    if (horizon <= 7 * DAY_MS) {
      return {
        level: "Important",
        reason: "Deadline within the next week.",
        confidence: 0.75,
      };
    }
    return {
      level: "Important",
      reason: "Contains a deadline or timeframe.",
      confidence: 0.7,
    };
  }

  if (deadlines.length > 0) {
    return {
      level: "Important",
      reason: "Contains a deadline or timeframe.",
      confidence: 0.7,
    };
  }

  return {
    level: "Informational",
    reason: "No urgent or time-sensitive content detected.",
    confidence: 0.9,
  };
}

/** Per-item urgency for a single action string (Feature 03.1). */
export function urgencyForAction(action: string): UrgencyLevel {
  return classifyUrgency(action).level;
}
