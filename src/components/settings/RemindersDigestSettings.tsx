"use client";

import { useEffect, useState } from "react";
import { BellRing, CalendarClock, Loader2 } from "lucide-react";
import { usePlan } from "@/lib/pro/usePlan";
import {
  DEFAULT_REMINDER_PRESET,
  REMINDER_PRESETS,
} from "@/lib/reminderPresets";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { ProGate } from "@/components/ui/ProGate";

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type Prefs = {
  reminders: { enabled: boolean; preset: string };
  digest: {
    enabled: boolean;
    day: number;
    hour: number;
    timezone: string;
  };
};

const DEFAULT_PREFS: Prefs = {
  reminders: { enabled: true, preset: DEFAULT_REMINDER_PRESET },
  digest: {
    enabled: true,
    day: 1,
    hour: 9,
    timezone: "UTC",
  },
};

const inputClass =
  "h-9 rounded-tm border border-line bg-surface px-2 text-xs text-ink focus:outline-2 focus:outline-accent";

export function RemindersDigestSettings() {
  const { isPro } = usePlan();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isPro) return;
    let active = true;
    void fetch("/api/settings/reminders")
      .then((res) => (res.ok ? (res.json() as Promise<Prefs>) : null))
      .then((body) => {
        if (!active || !body) return;
        setPrefs({
          reminders: {
            enabled: body.reminders?.enabled ?? true,
            preset: body.reminders?.preset ?? DEFAULT_REMINDER_PRESET,
          },
          digest: {
            enabled: body.digest?.enabled ?? true,
            day: body.digest?.day ?? 1,
            hour: body.digest?.hour ?? 9,
            timezone:
              body.digest?.timezone ||
              Intl.DateTimeFormat().resolvedOptions().timeZone ||
              "UTC",
          },
        });
        setLoaded(true);
      })
      .catch(() => {
        setPrefs((p) => ({
          ...p,
          digest: {
            ...p.digest,
            timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          },
        }));
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [isPro]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminders: {
            enabled: prefs.reminders.enabled,
            preset: prefs.reminders.preset,
          },
          digest: {
            enabled: prefs.digest.enabled,
            day: prefs.digest.day,
            hour: prefs.digest.hour,
            timezone: prefs.digest.timezone,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        toast(body.error ?? "Couldn't save preferences. Try again.", "error");
        return;
      }
      toast("Preferences saved", "success");
    } catch {
      toast("Couldn't save preferences. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  return (
    <section className="mt-6 border border-line">
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <BellRing className="h-4 w-4 text-muted" />
        <h2 className="text-sm font-semibold text-ink">
          Reminders &amp; weekly digest
        </h2>
      </div>
      <div className="px-5 py-4">
        {isPro ? (
          <>
            <div className="divide-y divide-line">
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm text-ink">Deadline reminders</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Email me before a deadline extracted from an analysis.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.reminders.enabled}
                  onChange={(e) =>
                    set("reminders", {
                      ...prefs.reminders,
                      enabled: e.target.checked,
                    })
                  }
                  aria-label="Enable deadline reminders"
                  className="h-4 w-4 accent-ink"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-ink">Default reminder lead time</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Preselected when you press &quot;Remind me&quot; on a result.
                  </p>
                </div>
                <select
                  value={prefs.reminders.preset}
                  onChange={(e) =>
                    set("reminders", {
                      ...prefs.reminders,
                      preset: e.target.value,
                    })
                  }
                  className={inputClass}
                  aria-label="Default reminder lead time"
                >
                  {REMINDER_PRESETS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm text-ink">Weekly digest</p>
                  <p className="mt-0.5 text-xs text-muted">
                    A Sunday-style summary of upcoming deadlines and top actions.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.digest.enabled}
                  onChange={(e) =>
                    set("digest", {
                      ...prefs.digest,
                      enabled: e.target.checked,
                    })
                  }
                  aria-label="Enable weekly digest"
                  className="h-4 w-4 accent-ink"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <p className="text-sm text-ink">Digest schedule</p>
                <div className="flex items-center gap-2">
                  <select
                    value={prefs.digest.day}
                    onChange={(e) =>
                      set("digest", {
                        ...prefs.digest,
                        day: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                    aria-label="Digest weekday"
                  >
                    {WEEKDAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={prefs.digest.hour}
                    onChange={(e) =>
                      set("digest", {
                        ...prefs.digest,
                        hour: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                    aria-label="Digest hour"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i % 12 === 0 ? 12 : i % 12}
                        {i < 12 ? " AM" : " PM"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 py-3">
                <p className="text-sm text-ink">Timezone</p>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {prefs.digest.timezone || "Your device timezone"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" onClick={() => void save()} disabled={saving || !loaded}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save preferences
              </Button>
              {!loaded && (
                <span className="text-xs text-muted">Loading…</span>
              )}
            </div>
          </>
        ) : (
          <ProGate feature="Deadline reminders & weekly digest">
            <p className="text-sm text-muted">You are on Pro.</p>
          </ProGate>
        )}
      </div>
    </section>
  );
}
