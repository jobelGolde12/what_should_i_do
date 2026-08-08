"use client";

import { Monitor, Sun, Moon, Keyboard, Database, Trash2 } from "lucide-react";
import { useTheme } from "@/context/ThemeProvider";
import { useTask } from "@/context/TaskContext";
import type { ThemePreference } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";

const THEME_OPTIONS: {
  key: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
];

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "⌘ / Ctrl + Enter", action: "Analyze the current input" },
  { keys: "Esc", action: "Clear the input area" },
  { keys: "⌘ / Ctrl + K", action: "Quick search history and templates" },
];

export default function SettingsView() {
  const { theme, setTheme } = useTheme();
  const { clearHistory, deleteTemplate, history, templates, board } = useTask();

  const totalRecords =
    history.length + templates.length + board.length;

  function clearAllData() {
    if (
      window.confirm(
        "Delete all history, templates, and board items? This cannot be undone."
      )
    ) {
      clearHistory();
      templates.forEach((t) => deleteTemplate(t.id));
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />

      <section className="border border-line">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Monitor className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Appearance</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 p-5">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = theme === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setTheme(option.key)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-2 rounded-[3px] border px-3 py-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-ink bg-ink text-background"
                    : "border-line text-muted hover:border-ink hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6 border border-line">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Keyboard className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Keyboard shortcuts</h2>
        </div>
        <dl className="divide-y divide-line">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <dt className="text-sm text-muted">{shortcut.action}</dt>
              <dd>
                <kbd className="rounded-[3px] border border-line bg-surface px-2 py-1 font-mono text-[11px] text-ink">
                  {shortcut.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6 border border-line">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <Database className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Data</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted">
            Everything is stored locally in your browser — nothing is uploaded
            beyond the text you analyze. {totalRecords} items are saved.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllData}
            disabled={totalRecords === 0}
            className="mt-4"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all local data
          </Button>
        </div>
      </section>

      <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        TaskMind · Analyses powered by AI, with rule-based fallback
      </p>
    </div>
  );
}
