"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  History,
  Folder,
  CornerDownLeft,
  X,
  Plus,
  LayoutGrid,
  Settings,
  FileText,
} from "lucide-react";
import { useTask } from "@/context/TaskContext";
import { useNavigation } from "@/lib/navigation";
import { snippet } from "@/lib/format";
import { storePendingTemplate } from "@/lib/applyTemplate";

const MAX_COMMANDS = 4;
const MAX_HISTORY = 5;
const MAX_TEMPLATES = 4;
const MAX_BOARD = 5;

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: "plus" | "grid" | "history" | "folder" | "settings";
  run: () => void;
};

function scoreMatch(query: string, haystack: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const h = haystack.toLowerCase();
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  const words = q.split(/\s+/);
  const wordHits = words.filter((w) => h.includes(w)).length;
  const anyHit = words.some((w) => h.includes(w)) ? 30 : 0;
  return wordHits * 20 + anyHit;
}

function buildCommands(navigate: (href: string) => void): Command[] {
  return [
    {
      id: "new-analysis",
      label: "New Analysis",
      hint: "Go to the input area",
      icon: "plus",
      run: () => navigate("/"),
    },
    {
      id: "actions-board",
      label: "My Actions",
      hint: "Open the actions board",
      icon: "grid",
      run: () => navigate("/actions"),
    },
    {
      id: "history",
      label: "History",
      hint: "Browse past analyses",
      icon: "history",
      run: () => navigate("/history"),
    },
    {
      id: "saved",
      label: "Saved",
      hint: "Manage templates",
      icon: "folder",
      run: () => navigate("/saved"),
    },
    {
      id: "settings",
      label: "Settings",
      hint: "Preferences",
      icon: "settings",
      run: () => navigate("/settings"),
    },
  ];
}

type Row =
  | { kind: "command"; command: Command }
  | {
      kind: "history";
      record: { id: string; input: string; output: { urgency: string; actions: unknown[] } };
    }
  | { kind: "template"; template: { id: string; name: string; content: string } }
  | { kind: "board"; item: { id: string; text: string; urgency: string } };

export default function QuickSearch() {
  const { navigate } = useNavigation();
  const { history, templates, board } = useTask();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setActiveIndex(0);
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const opener = () => {
      setActiveIndex(0);
      setOpen(true);
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("taskmind:open-search", opener);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("taskmind:open-search", opener);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const commands = buildCommands(navigate);
    const q = query.trim().toLowerCase();

    const commandRows: Row[] = commands
      .filter(
        (c) =>
          !q ||
          c.label.toLowerCase().includes(q) ||
          c.hint.toLowerCase().includes(q)
      )
      .slice(0, MAX_COMMANDS)
      .map((command) => ({ kind: "command", command }));

    const historyRows: Row[] = history
      .map((r) => ({
        row: {
          kind: "history" as const,
          record: {
            id: r.id,
            input: r.input,
            output: {
              urgency: r.output.urgency,
              actions: r.output.actions,
            },
          },
        },
        score: Math.max(
          scoreMatch(q, r.input),
          scoreMatch(q, r.output.nextStep)
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_HISTORY)
      .map(({ row }) => row);

    const templateRows: Row[] = templates
      .map((t) => ({
        row: {
          kind: "template" as const,
          template: { id: t.id, name: t.name, content: t.content },
        },
        score: Math.max(scoreMatch(q, t.name), scoreMatch(q, t.content)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_TEMPLATES)
      .map(({ row }) => row);

    const boardRows: Row[] = board
      .map((i) => ({
        row: {
          kind: "board" as const,
          item: { id: i.id, text: i.text, urgency: i.urgency },
        },
        score: scoreMatch(q, i.text),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_BOARD)
      .map(({ row }) => row);

    return [...commandRows, ...historyRows, ...templateRows, ...boardRows];
  }, [query, history, templates, board, navigate]);

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, rows.length - 1));

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[safeActiveIndex];
      if (row) selectRow(row);
    }
  }

  function selectRow(row: Row) {
    setOpen(false);
    setQuery("");
    switch (row.kind) {
      case "command":
        row.command.run();
        break;
      case "history":
        navigate(`/analysis/${row.record.id}`);
        break;
      case "template":
        storePendingTemplate(row.template.content);
        navigate("/");
        break;
      case "board":
        navigate("/actions");
        break;
    }
  }

  useEffect(() => {
    const active = listRef.current?.children[safeActiveIndex] as
      | HTMLElement
      | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [safeActiveIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-night/40 p-4 pt-24"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-tm border border-line bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search history, templates, actions…"
            aria-label="Search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="quick-search-list"
            aria-activedescendant={
              rows[safeActiveIndex] ? `qs-option-${safeActiveIndex}` : undefined
            }
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="hidden rounded-tm border border-line px-1.5 py-0.5 font-mono text-xxs text-muted sm:block">
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close search"
            className="rounded-tm p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2" role="presentation">
          {rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">
              No matches. Try a different search.
            </p>
          )}
          <ul ref={listRef} role="listbox" id="quick-search-list">
            {rows.map((row, index) => {
              const active = index === safeActiveIndex;
              let icon: React.ReactNode;
              let title: string;
              let subtitle: string | null = null;
              switch (row.kind) {
                case "command":
                  title = row.command.label;
                  subtitle = row.command.hint;
                  icon =
                    row.command.icon === "plus" ? (
                      <Plus className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
                    ) : row.command.icon === "grid" ? (
                      <LayoutGrid className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
                    ) : row.command.icon === "history" ? (
                      <History className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
                    ) : row.command.icon === "folder" ? (
                      <Folder className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
                    ) : (
                      <Settings className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
                    );
                  break;
                case "history":
                  title = snippet(row.record.input, 60);
                  subtitle = `${row.record.output.urgency} · ${row.record.output.actions.length} actions`;
                  icon = <History className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />;
                  break;
                case "template":
                  title = row.template.name;
                  subtitle = snippet(row.template.content, 80);
                  icon = <Folder className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />;
                  break;
                case "board":
                  title = snippet(row.item.text, 60);
                  subtitle = `Board · ${row.item.urgency}`;
                  icon = <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-accent" />;
                  break;
              }
              return (
                <li
                  key={`${row.kind}-${index}`}
                  id={`qs-option-${index}`}
                  role="option"
                  aria-selected={active}
                  className={`group flex w-full items-start gap-3 rounded-tm px-3 py-2.5 text-left ${
                    active ? "bg-surface-2" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectRow(row)}
                    onMouseEnter={() => setActiveIndex(index)}                    className="flex w-full items-start gap-3 text-left"
                  >
                    {icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{title}</span>
                      {subtitle && (
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {subtitle}
                        </span>
                      )}
                    </span>
                    {row.kind === "command" ? (
                      <CornerDownLeft className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2">
          <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
            <kbd>↑↓</kbd> navigate
          </span>
          <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
            <kbd>↵</kbd> select
          </span>
          <span className="font-mono text-xxs uppercase tracking-label-tight text-muted">
            <kbd>⌘K</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}
