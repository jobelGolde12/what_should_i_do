/**
 * Client-safe constants for deadline reminders (no DB / server imports).
 * Import these from client components; `@/lib/reminders` re-exports them for
 * server code. Kept dependency-free so importing never pulls in @libsql.
 */

export type ReminderPresetKey = "30m" | "1h" | "1d";

export const REMINDER_PRESETS: {
  key: ReminderPresetKey;
  label: string;
  ms: number;
}[] = [
  { key: "30m", label: "30 minutes before", ms: 30 * 60_000 },
  { key: "1h", label: "1 hour before", ms: 60 * 60_000 },
  { key: "1d", label: "1 day before", ms: 24 * 60 * 60_000 },
];

export const DEFAULT_REMINDER_PRESET = "1h";

/** Custom-lead-time bounds in minutes (10 min .. 7 days). */
export const CUSTOM_MINUTES_MIN = 10;
export const CUSTOM_MINUTES_MAX = 7 * 24 * 60;

/** Resolves a preset's lead time in ms, or `null` for unknown keys. */
export function presetMs(key: string): number | null {
  const found = REMINDER_PRESETS.find((p) => p.key === key);
  return found ? found.ms : null;
}
