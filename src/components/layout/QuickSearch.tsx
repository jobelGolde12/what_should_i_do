"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, History, Folder, CornerDownLeft, X } from "lucide-react";
import { useTask } from "@/context/TaskContext";
import { snippet } from "@/lib/format";

export default function QuickSearch() {
  const router = useRouter();
  const { history, templates } = useTask();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!open) setQuery("");
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchHistory = !q
      ? history.slice(0, 5)
      : history
          .filter(
            (r) =>
              r.input.toLowerCase().includes(q) ||
              r.output.nextStep.toLowerCase().includes(q)
          )
          .slice(0, 5);
    const matchTemplates = !q
      ? templates.slice(0, 5)
      : templates
          .filter(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              t.content.toLowerCase().includes(q)
          )
          .slice(0, 5);
    return { matchHistory, matchTemplates };
  }, [query, history, templates]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-night/40 p-4 pt-24"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Quick search"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[3px] border border-line bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history and saved templates…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="hidden rounded-[3px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close search"
            className="rounded-[3px] p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {results.matchHistory.length === 0 &&
            results.matchTemplates.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted">
                No matches.
              </p>
            )}

          {results.matchHistory.length > 0 && (
            <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              History
            </p>
          )}
          {results.matchHistory.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/analysis/${r.id}`);
              }}
              className="group flex w-full items-start gap-3 rounded-[3px] px-3 py-2.5 text-left hover:bg-surface-2"
            >
              <History className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">
                  {snippet(r.input, 60)}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {r.output.urgency} · {r.output.actions.length} actions
                </span>
              </span>
            </button>
          ))}

          {results.matchTemplates.length > 0 && (
            <p className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Templates
            </p>
          )}
          {results.matchTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/");
                setTimeout(() => {
                  window.dispatchEvent(
                    new CustomEvent("taskmind:apply-template", {
                      detail: t.content,
                    })
                  );
                }, 50);
              }}
              className="group flex w-full items-start gap-3 rounded-[3px] px-3 py-2.5 text-left hover:bg-surface-2"
            >
              <Folder className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">
                  {t.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {snippet(t.content, 80)}
                </span>
              </span>
              <CornerDownLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-muted/50" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <kbd>⌘K</kbd> to open
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
