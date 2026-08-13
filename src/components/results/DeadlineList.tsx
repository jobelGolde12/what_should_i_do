"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  ExternalLink,
  BellRing,
  Loader2,
} from "lucide-react";
import { downloadIcs } from "@/lib/ics";
import { Button } from "@/components/ui/Button";
import {
  googleCalendarUrl,
  outlookCalendarUrl,
  parseDeadline,
  sortDeadlines,
} from "@/lib/deadline";
import {
  CUSTOM_MINUTES_MAX,
  CUSTOM_MINUTES_MIN,
  DEFAULT_REMINDER_PRESET,
  REMINDER_PRESETS,
  type ReminderPresetKey,
} from "@/lib/reminderPresets";
import { usePlan } from "@/lib/pro/usePlan";
import { toast } from "@/lib/toast";

type PlanEntry = { addedAt: number; remindAt?: number | null };
type Plan = Record<string, PlanEntry>;

type RemindersBody = { plan?: Plan };

export default function DeadlineList({
  deadlines,
  analysisId = null,
  actions = [],
}: {
  deadlines: string[];
  analysisId?: string | null;
  actions?: string[];
}) {
  const { isPro } = usePlan();
  const list = deadlines.filter((d) => d !== "No deadline mentioned");
  const parsed = sortDeadlines(list).map((d) => parseDeadline(d));

  const [plan, setPlan] = useState<Plan>({});
  const [preset, setPreset] = useState<ReminderPresetKey | "custom">(
    DEFAULT_REMINDER_PRESET
  );
  const [customMinutes, setCustomMinutes] = useState(60);
  const [busy, setBusy] = useState<"remind" | "calendar" | null>(null);

  // Load the persisted calendar plan so re-opened analyses show which
  // deadlines already have a reminder / were added to a calendar.
  useEffect(() => {
    if (!isPro || !analysisId) {
      setPlan({});
      return;
    }
    let active = true;
    void fetch(`/api/reminders?analysisId=${encodeURIComponent(analysisId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<RemindersBody>) : null))
      .then((body) => {
        if (active && body?.plan) setPlan(body.plan);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isPro, analysisId]);

  if (parsed.length === 0) return null;

  const reminderOffset = preset === "custom" ? customMinutes * 60_000 : null;

  async function remindMe() {
    if (!analysisId) return;
    setBusy("remind");
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          deadlines: list,
          ...(preset === "custom"
            ? { customMinutes }
            : { presetKey: preset }),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        created?: number;
        error?: string;
        plan?: Plan;
      };
      if (!res.ok || !body.ok) {
        toast(body.error ?? "Couldn't set reminders. Try again.", "error");
        return;
      }
      if (body.plan) setPlan(body.plan);
      toast(
        body.created
          ? `Reminder${body.created === 1 ? "" : "s"} set for ${body.created} deadline${body.created === 1 ? "" : "s"}`
          : "Reminders already set for these deadlines",
        body.created ? "success" : "info"
      );
    } catch {
      toast("Couldn't set reminders. Try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function addAllToCalendar() {
    downloadIcs(list, actions);
    if (!isPro || !analysisId) {
      toast("Calendar file downloaded", "success");
      return;
    }
    setBusy("calendar");
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          deadlines: list,
          markCalendar: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        plan?: Plan;
        error?: string;
      };
      if (res.ok && body.plan) setPlan(body.plan);
    } catch {
      /* download already happened; plan persists next time */
    } finally {
      setBusy(null);
    }
    toast("Calendar file downloaded", "success");
  }

  return (
    <div>
      <ul className="space-y-2">
        {parsed.map((item, i) => {
          const entry = analysisId ? plan[item.raw] : undefined;
          const hasReminder = entry?.remindAt != null;
          const hasCalendar = entry?.addedAt != null && !hasReminder;
          return (
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
              {hasReminder && (
                <span className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-label text-accent">
                  <BellRing className="h-3 w-3" /> Reminder set
                </span>
              )}
              {hasCalendar && (
                <span className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-label text-muted">
                  <CalendarPlus className="h-3 w-3" /> Added
                </span>
              )}
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
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isPro ? (
          <>
            <label className="flex items-center gap-2 text-xs text-muted">
              Remind me
              <select
                value={preset}
                onChange={(e) =>
                  setPreset(e.target.value as ReminderPresetKey | "custom")
                }
                className="h-8 rounded-tm border border-line bg-surface px-2 text-xs text-ink focus:outline-2 focus:outline-accent"
                aria-label="Reminder lead time"
              >
                {REMINDER_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </label>
            {preset === "custom" && (
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="number"
                  min={CUSTOM_MINUTES_MIN}
                  max={CUSTOM_MINUTES_MAX}
                  value={customMinutes}
                  onChange={(e) =>
                    setCustomMinutes(
                      Math.max(
                        CUSTOM_MINUTES_MIN,
                        Number(e.target.value) || CUSTOM_MINUTES_MIN
                      )
                    )
                  }
                  className="h-8 w-20 rounded-tm border border-line bg-surface px-2 text-xs text-ink focus:outline-2 focus:outline-accent"
                  aria-label="Custom minutes before deadline"
                />
                min before
              </label>
            )}
            <Button
              variant="dark"
              size="sm"
              onClick={() => void remindMe()}
              disabled={busy !== null || !analysisId || reminderOffset === null}
            >
              {busy === "remind" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BellRing className="h-4 w-4" />
              )}
              Remind me
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void addAllToCalendar()}
              disabled={busy !== null}
            >
              {busy === "calendar" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4" />
              )}
              Add all to calendar
            </Button>
          </>
        ) : (
          <Button variant="dark" size="md" onClick={() => downloadIcs(list, actions)}>
            <CalendarPlus className="h-4 w-4" />
            Export deadlines (.ics)
          </Button>
        )}
      </div>
    </div>
  );
}
