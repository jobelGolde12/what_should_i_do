"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Monitor,
  Sun,
  Moon,
  Keyboard,
  Database,
  Trash2,
  Download,
  Upload,
  ShieldCheck,
  Check,
  CloudUpload,
  CloudDownload,
  LogIn,
  Loader2,
} from "lucide-react";
import { useTheme } from "@/context/ThemeProvider";
import { useAuth } from "@/context/AuthContext";
import { useTask } from "@/context/TaskContext";
import { usePlan } from "@/lib/pro/usePlan";
import type { ThemePreference } from "@/lib/types";
import type { AnalysisRecord, Template, BoardItem } from "@/lib/types";
import { loadSyncMeta } from "@/lib/sync";
import { downloadJson, readJsonFile } from "@/lib/backup";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { SubscriptionCard } from "./SubscriptionCard";
import { RemindersDigestSettings } from "./RemindersDigestSettings";
import { IntegrationsSettings } from "./IntegrationsSettings";

const SYNC_NOW_EVENT = "taskmind:sync-now";

const THEME_OPTIONS: {
  key: ThemePreference;
  label: string;
  icon: typeof Sun | typeof Moon | typeof Monitor;
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

type DataBackup = {
  kind: "taskmind-backup";
  version: 1;
  exportedAt: number;
  history: AnalysisRecord[];
  templates: Template[];
  board: BoardItem[];
};

function isDataBackup(value: unknown): value is DataBackup {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<DataBackup>;
  return (
    v.kind === "taskmind-backup" &&
    Array.isArray(v.history) &&
    Array.isArray(v.templates) &&
    Array.isArray(v.board)
  );
}

export default function SettingsView() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, status, logout, pushData, pullData, deleteAccount } =
    useAuth();
  const { isPro } = usePlan();
  const {
    history,
    templates,
    board,
    clearHistory,
    clearBoard,
    clearTemplates,
    importHistory,
    importTemplates,
    importBoard,
    setAll,
  } = useTask();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<"push" | "pull" | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncMeta, setSyncMeta] = useState(() => loadSyncMeta());

  const totalRecords = history.length + templates.length + board.length;

  function refreshSyncMeta() {
    setSyncMeta(loadSyncMeta());
  }

  function formatSyncedAt(ms: number | null): string {
    if (!ms) return "never";
    const diff = Date.now() - ms;
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
    return new Date(ms).toLocaleString();
  }

  function clearAllData() {
    if (
      window.confirm(
        "Delete all history, templates, and board items? This cannot be undone."
      )
    ) {
      clearHistory();
      clearBoard();
      clearTemplates();
    }
  }

  function clearSection(label: string, fn: () => void) {
    if (window.confirm(`Delete all ${label}? This cannot be undone.`)) {
      fn();
    }
  }

  function exportAll() {
    const backup: DataBackup = {
      kind: "taskmind-backup",
      version: 1,
      exportedAt: Date.now(),
      history,
      templates,
      board,
    };
    downloadJson("taskmind-backup.json", backup);
  }

  async function importFile(file: File) {
    try {
      const parsed = await readJsonFile(file);
      if (!isDataBackup(parsed)) {
        setImportError(
          "That file isn't a TaskMind backup. Export one from Settings first."
        );
        return;
      }
      importHistory(parsed.history);
      importTemplates(parsed.templates);
      importBoard(parsed.board);
      setImportError(null);
      setImported(true);
      setTimeout(() => setImported(false), 2500);
      toast("Backup imported", "success");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  const dataRows: { label: string; count: number; onClear: () => void }[] = [
    {
      label: "History",
      count: history.length,
      onClear: () => clearSection("history", clearHistory),
    },
    {
      label: "Templates",
      count: templates.length,
      onClear: () => clearSection("templates", clearTemplates),
    },
    {
      label: "Actions board",
      count: board.length,
      onClear: () => clearSection("board items", clearBoard),
    },
  ];

  async function syncPush() {
    setSyncing("push");
    setSyncMessage(null);
    try {
      await pushData({ history, templates, board });
      setSyncMessage("Local data backed up to your account.");
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : "Sync failed. Try again."
      );
    } finally {
      setSyncing(null);
    }
  }

  async function syncPull() {
    setSyncing("pull");
    setSyncMessage(null);
    try {
      const data = await pullData();
      if (data) {
        importHistory(data.history as never);
        importTemplates(data.templates as never);
        importBoard(data.board as never);
      }
      setSyncMessage("Account data merged into this device.");
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : "Sync failed. Try again."
      );
    } finally {
      setSyncing(null);
    }
  }

  useEffect(() => {
    const refresh = () => refreshSyncMeta();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function syncNow() {
    setSyncMessage("Syncing…");
    window.dispatchEvent(new CustomEvent(SYNC_NOW_EVENT));
    window.setTimeout(() => {
      refreshSyncMeta();
      setSyncMessage("Sync requested. This device will push its changes now.");
    }, 500);
  }

  async function restoreFromBackup() {
    if (
      !window.confirm(
        "Replace everything on this device with the backup in your account? Local-only items not yet backed up will be removed."
      )
    ) {
      return;
    }
    setSyncing("pull");
    setSyncMessage(null);
    try {
      const data = await pullData();
      if (data) {
        setAll({
          history: (data.history ?? []) as AnalysisRecord[],
          templates: (data.templates ?? []) as Template[],
          board: (data.board ?? []) as BoardItem[],
        });
      }
      refreshSyncMeta();
      setSyncMessage("Device restored from your cloud backup.");
      toast("Backup restored", "success");
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : "Restore failed. Try again."
      );
    } finally {
      setSyncing(null);
    }
  }

  async function handleDeleteAccount() {
    if (
      window.confirm(
        "Delete your account and all synced data? Local data on this device stays. This cannot be undone."
      )
    ) {
      await deleteAccount();
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
                aria-label={`Select ${option.label} theme`}
                className={`flex flex-col items-center gap-2 rounded-tm border px-3 py-4 text-sm font-medium transition-colors ${
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
        <p
          suppressHydrationWarning
          className="px-5 pb-5 text-xs text-muted"
        >
          System mode follows your operating system preference and updates
          live. Currently showing {resolvedTheme === "dark" ? "dark" : "light"}.
        </p>
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
                <kbd className="rounded-tm border border-line bg-surface px-2 py-1 font-mono text-2xs text-ink">
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
            beyond the text you analyze (and, if you sign in, whatever you choose
            to sync to your account). {totalRecords} items are saved.
          </p>

          <div className="mt-4 divide-y divide-line border-y border-line">
            {dataRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 py-3"
              >
                <p className="text-sm text-ink">
                  {row.label}{" "}
                  <span className="text-muted">· {row.count}</span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={row.onClear}
                  disabled={row.count === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportAll}
              disabled={totalRecords === 0}
            >
              <Download className="h-3.5 w-3.5" /> Export all data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              {imported ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Imported
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" /> Import data
                </>
              )}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFile(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllData}
              disabled={totalRecords === 0}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all local data
            </Button>
          </div>
          {importError && (
            <p role="alert" className="mt-3 text-xs text-high">
              {importError}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 border border-line">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <ShieldCheck className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Privacy</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-muted">
            Your analyses, templates, and board items live only in this
            browser&apos;s local storage. When you analyze text, that text is
            sent to the analysis provider to generate results, then stored
            locally. Share links embed the result in the URL and are not
            encrypted. Cleared data cannot be recovered.
          </p>
        </div>
      </section>

      <section className="mt-6 border border-line">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <CloudUpload className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-ink">Account</h2>
        </div>
        <div className="px-5 py-4">
          {status === "loading" ? (
            <p className="text-sm text-muted">Checking sign-in status…</p>
          ) : user ? (
            <>
              <p className="text-sm text-muted">
                Signed in as{" "}
                <span className="font-medium text-ink">{user.email}</span>.
                {isPro
                  ? " Cloud sync keeps your history, templates, board, and theme in sync across devices."
                  : " Free accounts can push or pull an opaque backup of this device to their account."}
              </p>

              {isPro ? (
                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink">Cloud sync</p>
                    <span
                      className={`font-mono text-2xs uppercase tracking-label ${
                        syncMeta.lastSyncStatus === "error"
                          ? "text-high"
                          : "text-muted"
                      }`}
                    >
                      {syncMeta.lastSyncStatus === "error"
                        ? "Sync error"
                        : syncMeta.lastSyncAt
                          ? `Last synced ${formatSyncedAt(syncMeta.lastSyncAt)}`
                          : "Not synced yet"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {history.length} history · {templates.length} templates ·{" "}
                    {board.length} board items on this device.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncNow}
                      disabled={syncing !== null}
                    >
                      {syncing === "push" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CloudUpload className="h-3.5 w-3.5" />
                      )}
                      Back up now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void restoreFromBackup()}
                      disabled={syncing !== null}
                    >
                      {syncing === "pull" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CloudDownload className="h-3.5 w-3.5" />
                      )}
                      Restore from backup
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void logout()}>
                      <LogIn className="h-3.5 w-3.5" /> Sign out
                    </Button>
                  </div>
                  {syncMeta.lastSyncStatus === "error" && (
                    <p role="alert" className="mt-3 text-xs text-high">
                      The last sync failed. Your changes are saved on this
                      device and will retry automatically — or press{" "}
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={syncNow}
                      >
                        Sync now
                      </button>
                      .
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void syncPush()}
                    disabled={syncing !== null}
                  >
                    {syncing === "push" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5" />
                    )}
                    Back up local data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void syncPull()}
                    disabled={syncing !== null}
                  >
                    {syncing === "pull" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CloudDownload className="h-3.5 w-3.5" />
                    )}
                    Merge account data
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void logout()}>
                    <LogIn className="h-3.5 w-3.5" /> Sign out
                  </Button>
                </div>
              )}
              {syncMessage && (
                <p aria-live="polite" className="mt-3 text-xs text-muted">
                  {syncMessage}
                </p>
              )}
              <div className="mt-5 border-t border-line pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDeleteAccount()}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete account
                </Button>
                <p className="mt-1.5 text-xs text-muted">
                  Removes the account and all synced data. Local data on this
                  device is kept.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted">
                Create an account to back up your data and sync it across
                devices. Without an account everything stays on this device.
              </p>
              <Link
                href="/auth/login"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark"
              >
                <LogIn className="h-4 w-4" /> Sign in or create an account
              </Link>
            </>
          )}
        </div>
      </section>

      <IntegrationsSettings />

      <RemindersDigestSettings />

      <SubscriptionCard />

      <p className="mt-8 text-center font-mono text-2xs uppercase tracking-label text-muted">
        TaskMind · Analyses powered by AI, with rule-based fallback
      </p>
    </div>
  );
}
